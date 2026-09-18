import { truncate } from "../core/normalize.ts";
import type { ApplicationForm, NormalizedJob } from "../core/types.ts";
import { complete, isLlmEnabled } from "./ai.ts";
import type { JobMatch } from "./matching.ts";
import type { ParsedProfile } from "./profile.ts";

/**
 * Generacion de documentos derivados del perfil.
 *
 * El perfil (profile.md) es la fuente de verdad y NUNCA se modifica al generar
 * un CV. Los documentos generados son derivados: CV adaptado, carta de
 * presentacion y respuestas a preguntas del formulario.
 *
 * Sin LLM configurado el sistema igual produce documentos utiles, armados por
 * reordenamiento y seleccion del contenido real del perfil.
 */

export interface GeneratedDocument {
  content: string;
  generatedBy: "heuristic" | "llm";
  warnings: string[];
}

const NO_INVENTION_RULE = `Usa exclusivamente la informacion del perfil. Esta prohibido inventar experiencia, empresas, tecnologias, titulos, certificaciones, idiomas, anios de experiencia o proyectos. Si falta un dato, omitilo; no lo completes con supuestos.`;

/* ------------------------------------------------------------------ */
/* CV adaptado                                                         */
/* ------------------------------------------------------------------ */

function heuristicTailoredCv(
  profile: ParsedProfile,
  profileMarkdown: string,
  job: NormalizedJob,
  match: JobMatch,
): string {
  const relevant = match.matchedSkills.length ? match.matchedSkills : profile.skills.slice(0, 15);
  const header = [
    `# ${profile.fullName ?? "Candidato"}`,
    profile.headline ? `**${profile.headline}**` : "",
    [profile.location, profile.email, profile.phone].filter(Boolean).join(" · "),
    [profile.linkedin, profile.github, profile.portfolio].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .join("\n\n");

  const objective = `## Perfil para ${job.title}\n\n${profile.summary || "Perfil profesional segun el documento cargado."}`;

  const skillsBlock = `## Tecnologias relevantes para esta busqueda\n\n${relevant
    .map((skill) => `- ${skill}`)
    .join("\n")}`;

  const otherSkills = profile.skills.filter((skill) => !relevant.includes(skill));
  const otherBlock = otherSkills.length
    ? `\n\n## Otras tecnologias del perfil\n\n${otherSkills.map((skill) => `- ${skill}`).join("\n")}`
    : "";

  const experienceBlock = profile.experiences.length
    ? `## Experiencia\n\n${profile.experiences
        .map((experience) => {
          const title = [experience.company, experience.period].filter(Boolean).join(" — ");
          const bullets = experience.bullets.map((bullet) => `- ${bullet}`).join("\n");
          return `### ${title}\n\n${bullets}`;
        })
        .join("\n\n")}`
    : `## Experiencia\n\n${truncate(profileMarkdown, 3000)}`;

  const educationBlock = profile.education.length
    ? `## Educacion\n\n${profile.education.map((item) => `- ${item}`).join("\n")}`
    : "";
  const certificationsBlock = profile.certifications.length
    ? `## Certificaciones\n\n${profile.certifications.map((item) => `- ${item}`).join("\n")}`
    : "";
  const languagesBlock = profile.languages.length
    ? `## Idiomas\n\n${profile.languages.map((language) => `- ${language.name}: ${language.level}`).join("\n")}`
    : "";

  return [
    header,
    objective,
    skillsBlock + otherBlock,
    experienceBlock,
    educationBlock,
    certificationsBlock,
    languagesBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateTailoredCv(
  profile: ParsedProfile,
  profileMarkdown: string,
  job: NormalizedJob,
  match: JobMatch,
): Promise<GeneratedDocument> {
  const fallback = heuristicTailoredCv(profile, profileMarkdown, job, match);
  if (!isLlmEnabled()) {
    return {
      content: fallback,
      generatedBy: "heuristic",
      warnings: [
        "Generado sin IA: el contenido proviene del reordenamiento del perfil cargado.",
      ],
    };
  }

  const prompt = `Adapta el CV del candidato a esta oferta concreta.

${NO_INVENTION_RULE}

=== PERFIL (fuente de verdad) ===
${truncate(profileMarkdown, 14000)}

=== OFERTA ===
Titulo: ${job.title}
Empresa: ${job.company.name}
Ubicacion: ${job.location ?? "sin especificar"} (${job.remoteType})
Skills pedidas: ${job.skills.join(", ") || "sin detallar"}
Descripcion:
${truncate(job.description, 8000)}

=== ANALISIS PREVIO ===
Coincidencias: ${match.matchedSkills.join(", ") || "ninguna"}
Faltantes: ${match.missingSkills.join(", ") || "ninguna"}

Devolve UNICAMENTE el CV en Markdown, listo para enviar, con esta estructura:
# Nombre
Titular profesional
Datos de contacto

## Resumen
## Tecnologias
## Experiencia
## Educacion
## Idiomas

Prioriza y reordena lo que ya existe en el perfil para que lo relevante a esta oferta aparezca primero. No agregues secciones con informacion que el perfil no tenga.`;

  try {
    const content = await complete(prompt, { maxTokens: 4000, temperature: 0.3 });
    if (!content || content.length < 200) {
      return {
        content: fallback,
        generatedBy: "heuristic",
        warnings: ["La IA devolvio una respuesta demasiado corta; se uso la version local."],
      };
    }
    return { content, generatedBy: "llm", warnings: [] };
  } catch (error) {
    return {
      content: fallback,
      generatedBy: "heuristic",
      warnings: [
        `No se pudo usar la IA (${error instanceof Error ? error.message : String(error)}); se genero la version local.`,
      ],
    };
  }
}

/* ------------------------------------------------------------------ */
/* Carta de presentacion                                               */
/* ------------------------------------------------------------------ */

function heuristicCoverLetter(
  profile: ParsedProfile,
  job: NormalizedJob,
  match: JobMatch,
): string {
  const name = profile.fullName ?? "";
  const skills = match.matchedSkills.slice(0, 6).join(", ");
  const years = profile.yearsOfExperience ? `${profile.yearsOfExperience} anos` : "varios anos";

  return `Estimado equipo de ${job.company.name}:

Me postulo a la busqueda de ${job.title}. Cuento con ${years} de experiencia profesional${
    profile.headline ? ` como ${profile.headline}` : ""
  }.

${skills ? `Mi experiencia incluye trabajo directo con ${skills}, tecnologias que esta posicion menciona explicitamente.` : "Mi perfil completo detalla la experiencia tecnica que puedo aportar a esta posicion."}

${profile.summary ? truncate(profile.summary, 600) : ""}

Quedo a disposicion para ampliar cualquier punto en una entrevista.

Saludos cordiales,
${name}${profile.email ? `\n${profile.email}` : ""}${profile.linkedin ? `\n${profile.linkedin}` : ""}`;
}

export async function generateCoverLetter(
  profile: ParsedProfile,
  profileMarkdown: string,
  job: NormalizedJob,
  match: JobMatch,
): Promise<GeneratedDocument> {
  const fallback = heuristicCoverLetter(profile, job, match);
  if (!isLlmEnabled()) {
    return {
      content: fallback,
      generatedBy: "heuristic",
      warnings: ["Generada sin IA a partir de los datos del perfil."],
    };
  }

  const prompt = `Escribi una carta de presentacion para esta postulacion.

${NO_INVENTION_RULE}

=== PERFIL ===
${truncate(profileMarkdown, 10000)}

=== OFERTA ===
${job.title} en ${job.company.name}
${truncate(job.description, 6000)}

=== COINCIDENCIAS REALES ===
${match.matchedSkills.join(", ") || "ninguna detectada"}

Requisitos de la carta:
- Entre 180 y 320 palabras.
- Tono profesional y directo, sin formulas vacias.
- Menciona 2 o 3 puntos concretos del perfil que conecten con la oferta.
- No menciones tecnologias que el perfil no tenga.
- Termina con una linea de cierre y el nombre del candidato.
- Devolve solo el texto de la carta, sin encabezados de Markdown.`;

  try {
    const content = await complete(prompt, { maxTokens: 1200, temperature: 0.4 });
    if (!content || content.length < 150) {
      return { content: fallback, generatedBy: "heuristic", warnings: ["Respuesta de IA muy corta."] };
    }
    return { content, generatedBy: "llm", warnings: [] };
  } catch (error) {
    return {
      content: fallback,
      generatedBy: "heuristic",
      warnings: [`IA no disponible: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/* ------------------------------------------------------------------ */
/* Respuestas a preguntas del formulario                               */
/* ------------------------------------------------------------------ */

export interface StoredAnswer {
  question: string;
  answer: string;
}

export interface AnsweredField {
  fieldId: string;
  label: string;
  answer: string;
  source: "profile" | "stored" | "llm" | "unknown";
  confidence: number;
  needsReview: boolean;
}

/** Coincidencia por palabras clave entre la pregunta del ATS y las respuestas guardadas. */
function findStoredAnswer(label: string, stored: StoredAnswer[]): StoredAnswer | undefined {
  const target = label.toLowerCase();
  let best: { item: StoredAnswer; score: number } | undefined;

  for (const item of stored) {
    const words = item.question.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
    if (!words.length) continue;
    const hits = words.filter((word) => target.includes(word)).length;
    const score = hits / words.length;
    if (score >= 0.5 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}

/** Respuestas directas derivadas del perfil, sin IA. */
function answerFromProfile(label: string, profile: ParsedProfile): string | undefined {
  const target = label.toLowerCase();
  // El nombre completo se evalua primero: "nombre completo" tambien contiene "nombre".
  if (/full name|nombre completo|nombre y apellido/.test(target)) return profile.fullName;
  if (/first name|nombre\b/.test(target) && profile.fullName) return profile.fullName.split(" ")[0];
  if (/last name|apellido/.test(target) && profile.fullName) {
    return profile.fullName.split(" ").slice(1).join(" ") || undefined;
  }
  if (/e-?mail|correo/.test(target)) return profile.email;
  if (/phone|tel[eé]fono|celular|m[oó]vil/.test(target)) return profile.phone;
  if (/linkedin/.test(target)) return profile.linkedin;
  if (/github/.test(target)) return profile.github;
  if (/portfolio|website|sitio/.test(target)) return profile.portfolio;
  if (/location|ubicaci[oó]n|city|ciudad|country|pa[ií]s/.test(target)) return profile.location;
  if (/years? of experience|anos de experiencia|años de experiencia/.test(target)) {
    return profile.yearsOfExperience !== undefined ? String(profile.yearsOfExperience) : undefined;
  }
  if (/salary|salario|compensation|pretensi[oó]n/.test(target) && profile.salaryExpectation) {
    const salary = profile.salaryExpectation;
    return `${salary.amount} ${salary.currency} / ${salary.period}`;
  }
  if (/english level|nivel de ingl[eé]s/.test(target)) {
    return profile.languages.find((language) => /ingl[eé]s|english/i.test(language.name))?.level;
  }
  return undefined;
}

/**
 * Construye las respuestas del formulario.
 * Prioridad: perfil -> respuestas guardadas -> IA -> UNKNOWN.
 * Nunca se inventa: lo que no se sabe queda como UNKNOWN y pide intervencion.
 */
export async function answerApplicationForm(
  form: ApplicationForm,
  profile: ParsedProfile,
  profileMarkdown: string,
  job: NormalizedJob,
  stored: StoredAnswer[],
): Promise<AnsweredField[]> {
  const results: AnsweredField[] = [];
  const pendingForLlm: { field: ApplicationForm["fields"][number]; index: number }[] = [];

  for (const field of form.fields) {
    if (field.type === "file") continue;

    const fromProfile = answerFromProfile(field.label, profile);
    if (fromProfile) {
      results.push({
        fieldId: field.id,
        label: field.label,
        answer: fromProfile,
        source: "profile",
        confidence: 1,
        needsReview: false,
      });
      continue;
    }

    const fromStore = findStoredAnswer(field.label, stored);
    if (fromStore) {
      results.push({
        fieldId: field.id,
        label: field.label,
        answer: fromStore.answer,
        source: "stored",
        confidence: 0.9,
        needsReview: false,
      });
      continue;
    }

    results.push({
      fieldId: field.id,
      label: field.label,
      answer: "UNKNOWN",
      source: "unknown",
      confidence: 0,
      needsReview: true,
    });
    pendingForLlm.push({ field, index: results.length - 1 });
  }

  if (!pendingForLlm.length || !isLlmEnabled()) return results;

  const prompt = `Responde las preguntas del formulario de postulacion usando SOLO el perfil del candidato.

${NO_INVENTION_RULE}
Si la respuesta no surge del perfil, responde exactamente UNKNOWN.

=== PERFIL ===
${truncate(profileMarkdown, 10000)}

=== OFERTA ===
${job.title} en ${job.company.name}
${truncate(job.description, 3000)}

=== PREGUNTAS ===
${pendingForLlm.map((item, index) => `${index + 1}. [${item.field.type}] ${item.field.label}`).join("\n")}

Devolve un JSON con la forma {"respuestas": ["...", "..."]}, en el mismo orden y cantidad que las preguntas.`;

  try {
    const raw = await complete(prompt, { json: true, maxTokens: 1500 });
    const parsed = JSON.parse(
      /\{[\s\S]*\}/.exec(raw)?.[0] ?? "{}",
    ) as { respuestas?: string[] };

    parsed.respuestas?.forEach((answer, position) => {
      const target = pendingForLlm[position];
      if (!target || !answer) return;
      const clean = answer.trim();
      if (!clean || clean.toUpperCase() === "UNKNOWN") return;
      results[target.index] = {
        ...results[target.index],
        answer: clean,
        source: "llm",
        confidence: 0.6,
        // Toda respuesta generada por IA se marca para revision humana.
        needsReview: true,
      };
    });
  } catch {
    // Si la IA falla, las preguntas quedan en UNKNOWN y las completa el usuario:
    // preferimos un hueco visible antes que una respuesta inventada.
  }

  return results;
}
