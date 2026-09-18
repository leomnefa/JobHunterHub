import { annualizeSalary, normalizeText, truncate } from "../core/normalize.ts";
import type { NormalizedJob, Seniority } from "../core/types.ts";
import type { ParsedProfile } from "./profile.ts";
import { AiError, complete, isLlmEnabled, parseJsonResponse } from "./ai.ts";

/**
 * Motor de matching.
 *
 * Siempre corre el scoring deterministico (explicable, reproducible y sin
 * costo). Si hay un LLM configurado, ademas se enriquece el analisis con
 * texto, riesgos y recomendacion. El score es una herramienta de priorizacion,
 * nunca una decision irreversible.
 */

export interface JobMatch {
  jobId: string;
  compatibilityScore: number;
  skillsMatch: number;
  experienceMatch: number;
  locationMatch: number;
  salaryMatch: number;
  seniorityMatch: number;
  contractMatch: number;
  languageMatch: number;
  aiAnalysis: string;
  missingSkills: string[];
  matchedSkills: string[];
  risks: string[];
  recommendation: "apply" | "review" | "ignore";
  analyzedBy: "heuristic" | "llm";
}

export interface MatchPreferences {
  countriesAllowed?: string[];
  remotePreference?: "remote" | "hybrid" | "onsite" | "any";
  employmentTypes?: string[];
  salaryMin?: number;
  excludedKeywords?: string[];
}

const SENIORITY_ORDER: Record<Seniority, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  manager: 5,
  director: 6,
  executive: 7,
  unknown: -1,
};

const WEIGHTS = {
  skills: 0.34,
  experience: 0.16,
  seniority: 0.14,
  location: 0.14,
  contract: 0.1,
  salary: 0.07,
  language: 0.05,
} as const;

/** Skills del aviso que realmente importan (las que el aviso menciona). */
function splitSkills(
  job: NormalizedJob,
  profile: ParsedProfile,
): { matched: string[]; missing: string[] } {
  const profileSkills = new Set(profile.skills.map((skill) => skill.toLowerCase()));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of job.skills) {
    const key = skill.toLowerCase();
    if (profileSkills.has(key)) {
      matched.push(skill);
      continue;
    }
    // Coincidencia parcial: "sql server" cubre "sql", "qlik sense" cubre "qlik".
    const partial = [...profileSkills].some(
      (candidate) => candidate.includes(key) || key.includes(candidate),
    );
    if (partial) matched.push(skill);
    else missing.push(skill);
  }

  return { matched, missing };
}

function scoreSkills(matched: string[], missing: string[]): number {
  const total = matched.length + missing.length;
  if (total === 0) return 50; // Sin skills declaradas: score neutro, no penaliza.
  return Math.round((matched.length / total) * 100);
}

function scoreExperience(job: NormalizedJob, profile: ParsedProfile): number {
  const required = /(\d{1,2})\s*\+?\s*(?:years|anos|años)/i.exec(job.description);
  if (!required || profile.yearsOfExperience === undefined) return 60;
  const needed = Number(required[1]);
  if (!Number.isFinite(needed) || needed <= 0) return 60;
  const ratio = profile.yearsOfExperience / needed;
  if (ratio >= 1) return 100;
  return Math.max(10, Math.round(ratio * 100));
}

function scoreSeniority(job: NormalizedJob, profile: ParsedProfile): number {
  const jobLevel = SENIORITY_ORDER[job.seniority ?? "unknown"];
  const profileLevel = SENIORITY_ORDER[profile.seniority];
  if (jobLevel < 0 || profileLevel < 0) return 60;
  const distance = Math.abs(jobLevel - profileLevel);
  if (distance === 0) return 100;
  if (distance === 1) return 80;
  if (distance === 2) return 55;
  return 25;
}

function scoreLocation(job: NormalizedJob, preferences: MatchPreferences): number {
  const preference = preferences.remotePreference ?? "remote";
  const allowed = (preferences.countriesAllowed ?? []).map(normalizeText).filter(Boolean);
  const jobLocation = normalizeText(`${job.location ?? ""} ${job.country ?? ""}`);

  let score = 50;
  if (preference === "any") score = 80;
  else if (job.remoteType === preference) score = 100;
  else if (preference === "remote" && job.remoteType === "hybrid") score = 60;
  else if (job.remoteType === "unknown") score = 55;
  else score = 30;

  if (job.worldwide) return Math.max(score, 95);
  if (allowed.length && jobLocation) {
    const compatible = allowed.some(
      (country) => jobLocation.includes(country) || country.includes(jobLocation),
    );
    if (compatible) score = Math.max(score, 90);
    else if (job.remoteType === "remote") score = Math.min(score, 70);
    else score = Math.min(score, 25);
  }
  return score;
}

function scoreSalary(job: NormalizedJob, preferences: MatchPreferences, profile: ParsedProfile): number {
  const expected =
    preferences.salaryMin ??
    (profile.salaryExpectation
      ? annualizeSalary({
          min: profile.salaryExpectation.amount,
          currency: profile.salaryExpectation.currency,
          period: profile.salaryExpectation.period as "year" | "month" | "hour",
        })
      : undefined);
  if (!expected) return 70; // Sin expectativa declarada: neutro.
  const offered = annualizeSalary(job.salary);
  if (!offered) return 60; // El aviso no publica salario: no penaliza fuerte.
  if (offered >= expected) return 100;
  const ratio = offered / expected;
  return Math.max(10, Math.round(ratio * 90));
}

function scoreContract(job: NormalizedJob, preferences: MatchPreferences, profile: ParsedProfile): number {
  const wanted = (
    preferences.employmentTypes?.length
      ? preferences.employmentTypes
      : profile.preferredEmploymentTypes
  ).filter(Boolean);
  if (!wanted.length) return 70;
  if (!job.employmentType || job.employmentType === "unknown") return 60;
  return wanted.includes(job.employmentType) ? 100 : 35;
}

const ADVANCED_LEVEL = /(avanzado|advanced|fluent|fluido|c1|c2|b2|nativo|native|bilingue|biling[uü]e)/i;

function scoreLanguage(job: NormalizedJob, profile: ParsedProfile): number {
  const requiresEnglish = /\benglish\b|\bingl[eé]s\b/i.test(job.description) || /\benglish\b/i.test(job.title);
  if (!requiresEnglish) return 100;
  const english = profile.languages.find((language) => /ingl[eé]s|english/i.test(language.name));
  if (!english) return 40;
  return ADVANCED_LEVEL.test(english.level) ? 100 : 65;
}

/** Riesgos detectados por reglas explicitas sobre el texto del aviso. */
function detectRisks(job: NormalizedJob, profile: ParsedProfile, preferences: MatchPreferences): string[] {
  const risks: string[] = [];
  const text = `${job.title} ${job.description}`.toLowerCase();

  if (/work authorization|authorized to work|us citizen|security clearance|green card/i.test(text)) {
    risks.push("Puede exigir autorizacion de trabajo o ciudadania del pais de la oferta.");
  }
  if (/\b(pst|est|cst|mst|us timezone|overlap with us)\b/i.test(text)) {
    risks.push("Requiere solapamiento con husos horarios de Estados Unidos.");
  }
  if (/\b(cet|cest|european timezone|uk hours)\b/i.test(text)) {
    risks.push("Requiere solapamiento con husos horarios europeos.");
  }
  if (job.remoteType === "onsite") {
    risks.push("La oferta es presencial.");
  }
  if (job.remoteType === "hybrid") {
    risks.push("La oferta es hibrida: requiere presencia en oficina.");
  }
  if (/\b(english|ingl[eé]s)\b/i.test(text) && !profile.languages.some((l) => /ingl[eé]s|english/i.test(l.name))) {
    risks.push("Menciona ingles y el perfil no declara ese idioma.");
  }

  const offered = annualizeSalary(job.salary);
  const expected =
    preferences.salaryMin ??
    (profile.salaryExpectation?.period === "year" ? profile.salaryExpectation.amount : undefined);
  if (offered && expected && offered < expected) {
    risks.push(`Salario publicado por debajo de la expectativa (${offered} vs ${expected}).`);
  }

  for (const keyword of preferences.excludedKeywords ?? []) {
    if (keyword && text.includes(keyword.toLowerCase())) {
      risks.push(`Contiene una palabra excluida por el usuario: "${keyword}".`);
    }
  }

  return risks;
}

function recommend(score: number, risks: string[]): JobMatch["recommendation"] {
  if (score >= 78 && risks.length <= 2) return "apply";
  if (score >= 55) return "review";
  return "ignore";
}

/** Analisis deterministico: siempre disponible, siempre explicable. */
export function computeHeuristicMatch(
  job: NormalizedJob,
  profile: ParsedProfile,
  preferences: MatchPreferences = {},
): JobMatch {
  const { matched, missing } = splitSkills(job, profile);
  const skillsMatch = scoreSkills(matched, missing);
  const experienceMatch = scoreExperience(job, profile);
  const seniorityMatch = scoreSeniority(job, profile);
  const locationMatch = scoreLocation(job, preferences);
  const salaryMatch = scoreSalary(job, preferences, profile);
  const contractMatch = scoreContract(job, preferences, profile);
  const languageMatch = scoreLanguage(job, profile);

  const weighted =
    skillsMatch * WEIGHTS.skills +
    experienceMatch * WEIGHTS.experience +
    seniorityMatch * WEIGHTS.seniority +
    locationMatch * WEIGHTS.location +
    contractMatch * WEIGHTS.contract +
    salaryMatch * WEIGHTS.salary +
    languageMatch * WEIGHTS.language;

  /**
   * Ubicacion e idioma no son un factor mas: son condiciones de acceso.
   * Una oferta presencial en un pais donde el candidato no puede trabajar no
   * deberia aparecer como "muy compatible" por mas que el stack coincida, asi
   * que se aplica un techo en vez de promediarla contra el resto.
   */
  const caps: number[] = [100];
  if (locationMatch < 40) caps.push(55);
  if (languageMatch < 50) caps.push(70);
  if (contractMatch < 40) caps.push(85);

  const compatibilityScore = Math.round(Math.min(weighted, ...caps));

  const risks = detectRisks(job, profile, preferences);

  const analysis = [
    `Compatibilidad global ${compatibilityScore}%.`,
    matched.length
      ? `Coincidencias: ${matched.slice(0, 12).join(", ")}.`
      : "No se detectaron coincidencias explicitas de tecnologias.",
    missing.length ? `Faltantes segun el aviso: ${missing.slice(0, 12).join(", ")}.` : "",
    `Desglose - skills ${skillsMatch}, experiencia ${experienceMatch}, seniority ${seniorityMatch}, ubicacion ${locationMatch}, contrato ${contractMatch}, salario ${salaryMatch}, idioma ${languageMatch}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    jobId: job.id,
    compatibilityScore,
    skillsMatch,
    experienceMatch,
    locationMatch,
    salaryMatch,
    seniorityMatch,
    contractMatch,
    languageMatch,
    aiAnalysis: analysis,
    matchedSkills: matched,
    missingSkills: missing,
    risks,
    recommendation: recommend(compatibilityScore, risks),
    analyzedBy: "heuristic",
  };
}

interface LlmMatchResponse {
  analisis?: string;
  coincidencias?: string[];
  faltantes?: string[];
  riesgos?: string[];
  recomendacion?: string;
  ajuste_score?: number;
}

function buildMatchPrompt(job: NormalizedJob, profileMarkdown: string, base: JobMatch): string {
  return `Analiza la compatibilidad entre este candidato y esta oferta.

=== PERFIL DEL CANDIDATO (unica fuente de verdad) ===
${truncate(profileMarkdown, 12000)}

=== OFERTA ===
Titulo: ${job.title}
Empresa: ${job.company.name}
Fuente: ${job.source}
Ubicacion: ${job.location ?? "sin especificar"} (${job.remoteType})
Tipo de contrato: ${job.employmentType ?? "unknown"}
Seniority detectado: ${job.seniority ?? "unknown"}
Salario publicado: ${job.salary ? `${job.salary.min ?? "?"} - ${job.salary.max ?? "?"} ${job.salary.currency ?? ""} por ${job.salary.period ?? "?"}` : "no publicado"}
Skills detectadas en el aviso: ${job.skills.join(", ") || "ninguna"}

Descripcion:
${truncate(job.description, 9000)}

=== ANALISIS DETERMINISTICO PREVIO ===
Score base: ${base.compatibilityScore}
Coincidencias: ${base.matchedSkills.join(", ") || "ninguna"}
Faltantes: ${base.missingSkills.join(", ") || "ninguna"}
Riesgos detectados por reglas: ${base.risks.join(" | ") || "ninguno"}

Devolve SOLO un objeto JSON con esta forma exacta:
{
  "analisis": "2 a 4 frases explicando la compatibilidad real",
  "coincidencias": ["tecnologia o experiencia del perfil que el aviso pide"],
  "faltantes": ["requisito del aviso que el perfil NO demuestra"],
  "riesgos": ["riesgo concreto: zona horaria, autorizacion laboral, idioma, salario, presencialidad"],
  "recomendacion": "apply" | "review" | "ignore",
  "ajuste_score": numero entre -15 y 15 para corregir el score base
}

No inventes nada que no este en el perfil. Si un dato falta, escribi UNKNOWN.`;
}

/** Analisis completo: heuristico + LLM si esta disponible. */
export async function computeMatch(
  job: NormalizedJob,
  profile: ParsedProfile,
  profileMarkdown: string,
  preferences: MatchPreferences = {},
  useLlm = true,
): Promise<JobMatch> {
  const base = computeHeuristicMatch(job, profile, preferences);
  if (!useLlm || !isLlmEnabled()) return base;

  try {
    const raw = await complete(buildMatchPrompt(job, profileMarkdown, base), {
      json: true,
      maxTokens: 1200,
    });
    const parsed = parseJsonResponse<LlmMatchResponse>(raw);
    if (!parsed) return base;

    const adjustment = Math.max(-15, Math.min(15, Number(parsed.ajuste_score) || 0));
    const score = Math.max(0, Math.min(100, base.compatibilityScore + adjustment));
    const recommendation = ["apply", "review", "ignore"].includes(parsed.recomendacion ?? "")
      ? (parsed.recomendacion as JobMatch["recommendation"])
      : recommend(score, parsed.riesgos ?? base.risks);

    return {
      ...base,
      compatibilityScore: score,
      aiAnalysis: parsed.analisis?.trim() || base.aiAnalysis,
      matchedSkills: parsed.coincidencias?.length ? parsed.coincidencias : base.matchedSkills,
      missingSkills: parsed.faltantes?.length ? parsed.faltantes : base.missingSkills,
      risks: parsed.riesgos?.length ? parsed.riesgos : base.risks,
      recommendation,
      analyzedBy: "llm",
    };
  } catch (error) {
    // Si el LLM falla, el analisis deterministico sigue siendo valido.
    if (error instanceof AiError) return base;
    return {
      ...base,
      aiAnalysis: `${base.aiAnalysis} (El analisis con IA no pudo completarse: ${error instanceof Error ? error.message : String(error)})`,
    };
  }
}
