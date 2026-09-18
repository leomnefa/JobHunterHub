import {
  SKILL_DICTIONARY,
  normalizeSeniority,
  normalizeText,
  skillPattern,
} from "../core/normalize.ts";
import type { EmploymentType, Seniority } from "../core/types.ts";

/**
 * El perfil del candidato es un archivo Markdown: esa es la unica fuente de
 * verdad. Este parser extrae una vista estructurada para el motor de matching,
 * pero NUNCA inventa datos: lo que no aparece en el Markdown queda vacio.
 */

export interface ParsedExperience {
  company?: string;
  role?: string;
  period?: string;
  bullets: string[];
}

export interface ParsedProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  country?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  languages: { name: string; level: string }[];
  education: string[];
  certifications: string[];
  experiences: ParsedExperience[];
  yearsOfExperience?: number;
  seniority: Seniority;
  preferredEmploymentTypes: EmploymentType[];
  remotePreference?: "remote" | "hybrid" | "onsite";
  salaryExpectation?: { amount: number; currency: string; period: string };
  sections: Record<string, string>;
  wordCount: number;
}

interface Section {
  title: string;
  level: number;
  body: string;
}

function splitSections(markdown: string): Section[] {
  const lines = markdown.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[2].trim(), level: heading[1].length, body: "" };
    } else if (current) {
      current.body += `${line}\n`;
    } else {
      current = { title: "__intro__", level: 0, body: `${line}\n` };
    }
  }
  if (current) sections.push(current);
  return sections;
}

/**
 * Busca una seccion por titulo. Entre varias coincidencias gana la que tiene
 * contenido: "# Perfil Profesional" (solo titulo) no debe tapar a "## Perfil".
 */
function findSection(sections: Section[], patterns: RegExp[]): Section | undefined {
  const matches = sections.filter((section) =>
    patterns.some((pattern) => pattern.test(section.title)),
  );
  if (matches.length === 0) return undefined;
  return matches.find((section) => section.body.trim().length > 0) ?? matches[0];
}

function bulletList(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*+]\s+/, "").trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/.test(line));
}

function matchValue(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = pattern.exec(text);
    if (found?.[1]) return found[1].trim();
  }
  return undefined;
}

const EMPLOYMENT_KEYWORDS: [RegExp, EmploymentType][] = [
  [/full[\s-]?time|tiempo completo|jornada completa/i, "full_time"],
  [/part[\s-]?time|medio tiempo|media jornada/i, "part_time"],
  [/contract|contrato|b2b/i, "contract"],
  [/freelance|autonomo|independiente/i, "freelance"],
  [/intern|pasant/i, "internship"],
  [/temporal|temporary/i, "temporary"],
];

const LANGUAGE_NAMES =
  /(espanol|español|ingles|inglés|english|spanish|portugues|português|portuguese|frances|français|french|aleman|alemán|german|italiano|italian)/i;

/**
 * Los bloques de codigo se descartan antes de analizar: un ejemplo con
 * `name: string;` no debe terminar convertido en el nombre del candidato.
 */
function stripCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "\n").replace(/`[^`\n]*`/g, " ");
}

const NAME_LIKE = /^[\p{L}][\p{L}\s.'-]{2,59}$/u;

export function parseProfileMarkdown(markdown: string): ParsedProfile {
  const clean = stripCodeBlocks(markdown);
  const sections = splitSections(clean);
  const plain = clean.replace(/\r/g, "");
  const lower = plain.toLowerCase();

  /* -------------------------- Datos de contacto ------------------------- */
  const email = matchValue(plain, [/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i]);
  const phone = matchValue(plain, [
    /(?:tel[eé]fono|phone|celular|m[oó]vil|whatsapp)\s*:?\s*([+\d][\d\s().-]{6,})/i,
  ]);
  const linkedin = matchValue(plain, [/(https?:\/\/(?:www\.)?linkedin\.com\/[^\s)\]]+)/i]);
  const github = matchValue(plain, [/(https?:\/\/(?:www\.)?github\.com\/[^\s)\]]+)/i]);
  const portfolio = matchValue(plain, [
    /(?:portfolio|portafolio|sitio web|website)\s*:?\s*(https?:\/\/[^\s)\]]+)/i,
  ]);
  const nameCandidate = matchValue(plain, [
    /(?:^|\n)\s*(?:nombre completo|nombre|full name|name)\s*:?\s*([^\n]+)/i,
    /(?:^|\n)#\s+([^\n#]{3,60})\n/,
  ])
    ?.replace(/[*_`]/g, "")
    .trim();
  const fullName = nameCandidate && NAME_LIKE.test(nameCandidate) ? nameCandidate : undefined;
  const location = matchValue(plain, [
    /(?:ubicaci[oó]n|location|ciudad|city|reside)\s*:?\s*([^\n]+)/i,
  ]);
  const country = matchValue(plain, [/(?:pa[ií]s|country)\s*:?\s*([^\n]+)/i]) ?? location;

  /* ------------------------------- Skills -------------------------------- */
  const skillsSection = findSection(sections, [
    /^(skills|habilidades|tecnolog[ií]as|competencias|stack)/i,
  ]);
  const declaredSkills = skillsSection
    ? bulletList(skillsSection.body)
        .flatMap((line) => line.split(/[,;|/]/))
        .map((skill) => skill.trim().toLowerCase())
        .filter((skill) => skill.length > 1 && skill.length <= 40)
    : [];

  const detected = new Set(declaredSkills);
  for (const skill of SKILL_DICTIONARY) {
    if (skillPattern(skill).test(lower)) detected.add(skill);
  }

  /* ------------------------------ Idiomas -------------------------------- */
  const languagesSection = findSection(sections, [/^(idiomas|languages|lenguas)/i]);
  const languages: { name: string; level: string }[] = [];
  const languageLines = languagesSection
    ? bulletList(languagesSection.body)
    : plain.split(/\r?\n/).filter((line) => LANGUAGE_NAMES.test(line) && /:/.test(line));
  for (const line of languageLines) {
    const parts = line.split(/[:\-–]/);
    const name = parts[0]?.trim();
    if (!name || !LANGUAGE_NAMES.test(name)) continue;
    languages.push({ name, level: parts.slice(1).join(" ").trim() || "sin especificar" });
  }

  /* ---------------------- Educacion y certificaciones -------------------- */
  const educationSection = findSection(sections, [/^(educaci[oó]n|education|formaci[oó]n|estudios)/i]);
  const certificationsSection = findSection(sections, [
    /^(certificaciones|certifications|cursos|courses)/i,
  ]);

  /* ----------------------------- Experiencia ----------------------------- */
  const experienceIndex = sections.findIndex((section) =>
    /^(experiencia|experience|trayectoria|historial laboral)/i.test(section.title),
  );
  const experiences: ParsedExperience[] = [];
  if (experienceIndex >= 0) {
    const parentLevel = sections[experienceIndex].level;
    for (let i = experienceIndex + 1; i < sections.length; i += 1) {
      const section = sections[i];
      if (section.level <= parentLevel) break;
      const period = matchValue(section.body, [
        /((?:19|20)\d{2}\s*[-–a]{1,3}\s*(?:(?:19|20)\d{2}|actualidad|present|hoy))/i,
      ]);
      // La linea del periodo no es un logro: no debe repetirse como bullet.
      const bullets = bulletList(section.body).filter((bullet) => bullet !== period);
      experiences.push({
        company: section.title,
        role: bullets.find((bullet) =>
          /engineer|developer|analyst|lead|manager|consultor|dba|arquitect/i.test(bullet),
        ),
        period,
        bullets,
      });
    }
  }

  /* ----------------------- Anios totales de experiencia ------------------ */
  const yearsDeclared = matchValue(plain, [
    /(?:m[aá]s de\s+)?(\d{1,2})\s*\+?\s*(?:a[nñ]os|years)\s+(?:de\s+)?(?:experiencia|experience)/i,
    /(?:experiencia|experience)\s*:?\s*(\d{1,2})\s*\+?\s*(?:a[nñ]os|years)/i,
  ]);
  let yearsOfExperience = yearsDeclared ? Number(yearsDeclared) : undefined;
  if (yearsOfExperience === undefined) {
    // Fallback: rango entre el anio mas antiguo mencionado y hoy.
    const years = [...plain.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)].map((match) => Number(match[1]));
    if (years.length >= 2) {
      const earliest = Math.min(...years);
      const span = new Date().getFullYear() - earliest;
      if (span > 0 && span < 60) yearsOfExperience = span;
    }
  }

  /* ----------------------------- Preferencias ---------------------------- */
  const preferencesSection = findSection(sections, [/^(preferencias|preferences|disponibilidad)/i]);
  const preferencesText = `${preferencesSection?.body ?? ""}\n${plain.slice(0, 2000)}`;
  const preferredEmploymentTypes: EmploymentType[] = [];
  for (const [pattern, type] of EMPLOYMENT_KEYWORDS) {
    if (pattern.test(preferencesText) && !preferredEmploymentTypes.includes(type)) {
      preferredEmploymentTypes.push(type);
    }
  }

  const remotePreference = /remoto|remote|teletrabajo/i.test(preferencesText)
    ? "remote"
    : /h[ií]brido|hybrid/i.test(preferencesText)
      ? "hybrid"
      : /presencial|onsite/i.test(preferencesText)
        ? "onsite"
        : undefined;

  const salaryMatch =
    /(?:salario|salary|pretensi[oó]n|expectativa)[^\n]*?([A-Z]{3}|\$|usd|eur)?\s*([\d.,]{3,})\s*(?:k|mil)?\s*(?:\/?\s*(a[nñ]o|year|mes|month|hora|hour))?/i.exec(
      preferencesText,
    );
  let salaryExpectation: ParsedProfile["salaryExpectation"];
  if (salaryMatch) {
    const raw = Number(salaryMatch[2].replace(/[.,]/g, ""));
    if (Number.isFinite(raw) && raw > 0) {
      salaryExpectation = {
        amount: raw,
        currency: (salaryMatch[1] ?? "USD").toUpperCase().replace("$", "USD"),
        period: /hora|hour/i.test(salaryMatch[3] ?? "")
          ? "hour"
          : /mes|month/i.test(salaryMatch[3] ?? "")
            ? "month"
            : "year",
      };
    }
  }

  /* ------------------------------- Resumen ------------------------------- */
  const summarySection = findSection(sections, [
    /^(perfil|summary|resumen|sobre m[ií]|about|profile)/i,
  ]);
  const summaryLines = (body: string): string =>
    body
      .split(/\r?\n/)
      .filter((line) => line.trim() && !/^[-*+]\s/.test(line))
      .slice(0, 6)
      .join(" ")
      .trim();

  // Si la seccion de perfil no aporta texto, se usa el primer parrafo real.
  const summary =
    summaryLines(summarySection?.body ?? "") ||
    summaryLines(sections.find((section) => summaryLines(section.body).length > 40)?.body ?? "");

  // Exige inicio de linea y dos puntos: evita que "Desarrollador" dispare "rol".
  const headline =
    matchValue(plain, [
      /(?:^|\n)\s*(?:puesto|rol|cargo|title|headline|posicionamiento)\s*:\s*([^\n]+)/i,
    ]) ?? (summary ? summary.split(/[.!?]/)[0].slice(0, 120) : undefined);

  const sectionMap: Record<string, string> = {};
  for (const section of sections) {
    if (section.title !== "__intro__") sectionMap[section.title] = section.body.trim();
  }

  return {
    fullName,
    email,
    phone,
    location,
    country,
    linkedin,
    github,
    portfolio,
    headline,
    summary,
    skills: [...detected].sort(),
    languages,
    education: educationSection ? bulletList(educationSection.body) : [],
    certifications: certificationsSection ? bulletList(certificationsSection.body) : [],
    experiences,
    yearsOfExperience,
    seniority: normalizeSeniority(headline, summary, plain.slice(0, 1500)),
    preferredEmploymentTypes,
    remotePreference,
    salaryExpectation,
    sections: sectionMap,
    wordCount: normalizeText(plain).split(" ").filter(Boolean).length,
  };
}

/** Indicador simple de completitud para guiar al usuario en la UI. */
export function profileCompleteness(profile: ParsedProfile): {
  score: number;
  missing: string[];
} {
  const checks: [string, boolean][] = [
    ["Nombre", Boolean(profile.fullName)],
    ["Email", Boolean(profile.email)],
    ["Ubicacion", Boolean(profile.location)],
    ["Resumen profesional", Boolean(profile.summary && profile.summary.length > 60)],
    ["Skills", profile.skills.length >= 5],
    ["Experiencia", profile.experiences.length > 0],
    ["Educacion", profile.education.length > 0],
    ["Idiomas", profile.languages.length > 0],
    ["Anios de experiencia", profile.yearsOfExperience !== undefined],
    ["Preferencias laborales", profile.preferredEmploymentTypes.length > 0],
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}
