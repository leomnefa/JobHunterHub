import { all, get, nowIso, run, toJson, fromJson } from "../db/index.ts";
import { newId } from "../util/crypto.ts";
import {
  asObject,
  badRequest,
  forbidden,
  notFound,
  optionalNumber,
  optionalString,
  requireString,
  stringArray,
} from "../http/router.ts";
import type { Router } from "../http/router.ts";
import { audit } from "../services/audit.ts";
import { AiError, complete, isLlmEnabled } from "../services/ai.ts";
import { parseProfileMarkdown, profileCompleteness } from "../services/profile.ts";

/**
 * Perfil profesional del candidato.
 *
 * El Markdown es la unica fuente de verdad. Cada usuario ve y edita solo su
 * propio perfil: el id de usuario proviene del token verificado, nunca del body.
 */

interface ProfileRow {
  id: string;
  user_id: string;
  name: string;
  markdown: string;
  parsed_json: string;
  source_filename: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_PROFILE_CHARS = 400_000;

function ensureCandidate(role: string): void {
  // El ADMIN administra la plataforma; no es candidato.
  if (role === "ADMIN") {
    throw forbidden("El administrador no tiene perfil de candidato.");
  }
}

export function getPrimaryProfile(userId: string): ProfileRow | undefined {
  return get<ProfileRow>(
    "SELECT * FROM candidate_profiles WHERE user_id = ? AND is_primary = 1",
    userId,
  );
}

function saveProfile(userId: string, markdown: string, filename?: string): ProfileRow {
  if (markdown.length > MAX_PROFILE_CHARS) {
    throw badRequest("El perfil supera el tamano maximo permitido (400.000 caracteres).");
  }
  const parsed = parseProfileMarkdown(markdown);
  const timestamp = nowIso();
  const existing = getPrimaryProfile(userId);

  if (existing) {
    run(
      `UPDATE candidate_profiles SET markdown = ?, parsed_json = ?, source_filename = COALESCE(?, source_filename), updated_at = ?
       WHERE id = ?`,
      markdown,
      toJson(parsed),
      filename ?? null,
      timestamp,
      existing.id,
    );
    return getPrimaryProfile(userId)!;
  }

  run(
    `INSERT INTO candidate_profiles (id, user_id, name, is_primary, markdown, parsed_json, source_filename, created_at, updated_at)
     VALUES (?, ?, 'Perfil principal', 1, ?, ?, ?, ?, ?)`,
    newId("prf_"),
    userId,
    markdown,
    toJson(parsed),
    filename ?? null,
    timestamp,
    timestamp,
  );
  return getPrimaryProfile(userId)!;
}

export function registerProfileRoutes(router: Router): void {
  router.get("/api/profile", ({ user }) => {
    ensureCandidate(user!.role);
    const row = getPrimaryProfile(user!.sub);
    if (!row) {
      return { profile: null, parsed: null, completeness: { score: 0, missing: [] } };
    }
    const parsed = parseProfileMarkdown(row.markdown);
    return {
      profile: {
        id: row.id,
        name: row.name,
        markdown: row.markdown,
        sourceFilename: row.source_filename,
        updatedAt: row.updated_at,
      },
      parsed,
      completeness: profileCompleteness(parsed),
    };
  });

  router.put("/api/profile", ({ body, user, ip }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const markdown = requireString(input, "markdown", MAX_PROFILE_CHARS);
    const filename = optionalString(input, "filename", 300);
    const row = saveProfile(user!.sub, markdown, filename);
    const parsed = parseProfileMarkdown(row.markdown);

    audit({
      action: "PROFILE_UPDATE",
      userId: user!.sub,
      userEmail: user!.email,
      entity: "candidate_profile",
      entityId: row.id,
      ip,
      detail: `${markdown.length} caracteres`,
    });

    return {
      profile: {
        id: row.id,
        name: row.name,
        markdown: row.markdown,
        sourceFilename: row.source_filename,
        updatedAt: row.updated_at,
      },
      parsed,
      completeness: profileCompleteness(parsed),
    };
  });

  /** Genera un perfil en Markdown a partir de texto libre del usuario. */
  router.post("/api/profile/generate", async ({ body, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const rawText = requireString(input, "text", 60000);

    if (!isLlmEnabled()) {
      throw badRequest(
        "No hay un proveedor de IA configurado. Pida a un administrador que lo active, o pegue su perfil en Markdown manualmente.",
      );
    }

    const prompt = `Convierte la siguiente informacion en un perfil profesional estructurado en Markdown para una plataforma de busqueda laboral.

REGLAS:
- Usa unicamente los datos entregados. No inventes empresas, tecnologias, titulos, certificaciones, idiomas ni anios de experiencia.
- Si falta un dato, omite esa seccion en lugar de completarla.
- Estructura sugerida: # Perfil Profesional, ## Datos personales, ## Perfil, ## Experiencia, ## Skills, ## Educacion, ## Idiomas, ## Preferencias.
- Devolve solo el Markdown, sin explicaciones.

=== INFORMACION DEL USUARIO ===
${rawText}`;

    try {
      const markdown = await complete(prompt, { maxTokens: 4000, temperature: 0.3 });
      return { markdown, parsed: parseProfileMarkdown(markdown) };
    } catch (error) {
      if (error instanceof AiError) throw badRequest(error.message);
      throw error;
    }
  });

  /* --------------------------- Preferencias ---------------------------- */

  router.get("/api/preferences", ({ user }) => {
    ensureCandidate(user!.role);
    const row = get<Record<string, unknown>>(
      "SELECT * FROM candidate_preferences WHERE user_id = ?",
      user!.sub,
    );
    if (!row) {
      return {
        preferences: {
          desiredRoles: [],
          employmentTypes: [],
          remotePreference: "remote",
          countriesAllowed: [],
          timezones: [],
          salaryMin: null,
          salaryCurrency: "USD",
          availability: "",
          excludedKeywords: [],
          minMatchAlert: 80,
        },
      };
    }
    return {
      preferences: {
        desiredRoles: fromJson<string[]>(row.desired_roles, []),
        employmentTypes: fromJson<string[]>(row.employment_types, []),
        remotePreference: row.remote_preference,
        countriesAllowed: fromJson<string[]>(row.countries_allowed, []),
        timezones: fromJson<string[]>(row.timezones, []),
        salaryMin: row.salary_min,
        salaryCurrency: row.salary_currency,
        availability: row.availability,
        excludedKeywords: fromJson<string[]>(row.excluded_keywords, []),
        minMatchAlert: row.min_match_alert,
      },
    };
  });

  router.put("/api/preferences", ({ body, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const remote = optionalString(input, "remotePreference", 20) ?? "remote";
    if (!["remote", "hybrid", "onsite", "any"].includes(remote)) {
      throw badRequest("Preferencia de modalidad invalida.");
    }

    run(
      `INSERT INTO candidate_preferences (
         user_id, desired_roles, employment_types, remote_preference, countries_allowed,
         timezones, salary_min, salary_currency, availability, excluded_keywords, min_match_alert, updated_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         desired_roles = excluded.desired_roles,
         employment_types = excluded.employment_types,
         remote_preference = excluded.remote_preference,
         countries_allowed = excluded.countries_allowed,
         timezones = excluded.timezones,
         salary_min = excluded.salary_min,
         salary_currency = excluded.salary_currency,
         availability = excluded.availability,
         excluded_keywords = excluded.excluded_keywords,
         min_match_alert = excluded.min_match_alert,
         updated_at = excluded.updated_at`,
      user!.sub,
      toJson(stringArray(input, "desiredRoles")),
      toJson(stringArray(input, "employmentTypes")),
      remote,
      toJson(stringArray(input, "countriesAllowed")),
      toJson(stringArray(input, "timezones")),
      optionalNumber(input, "salaryMin") ?? null,
      optionalString(input, "salaryCurrency", 10) ?? "USD",
      optionalString(input, "availability", 200) ?? null,
      toJson(stringArray(input, "excludedKeywords")),
      Math.max(0, Math.min(100, optionalNumber(input, "minMatchAlert") ?? 80)),
      nowIso(),
    );
    return { ok: true };
  });

  /* ----------------------- Respuestas reutilizables --------------------- */

  router.get("/api/answers", ({ user }) => {
    ensureCandidate(user!.role);
    return {
      answers: all(
        "SELECT id, question, answer, tags, verified, updated_at FROM candidate_answers WHERE user_id = ? ORDER BY updated_at DESC",
        user!.sub,
      ),
    };
  });

  router.post("/api/answers", ({ body, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const id = newId("ans_");
    const timestamp = nowIso();
    run(
      `INSERT INTO candidate_answers (id, user_id, question, answer, tags, verified, created_at, updated_at)
       VALUES (?,?,?,?,?,1,?,?)`,
      id,
      user!.sub,
      requireString(input, "question", 500),
      requireString(input, "answer", 5000),
      toJson(stringArray(input, "tags")),
      timestamp,
      timestamp,
    );
    return { id };
  });

  router.put("/api/answers/:id", ({ body, params, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const changes = run(
      `UPDATE candidate_answers SET question = ?, answer = ?, tags = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      requireString(input, "question", 500),
      requireString(input, "answer", 5000),
      toJson(stringArray(input, "tags")),
      nowIso(),
      params.id,
      user!.sub,
    ).changes;
    if (!changes) throw notFound("Respuesta no encontrada.");
    return { ok: true };
  });

  router.delete("/api/answers/:id", ({ params, user }) => {
    ensureCandidate(user!.role);
    const changes = run(
      "DELETE FROM candidate_answers WHERE id = ? AND user_id = ?",
      params.id,
      user!.sub,
    ).changes;
    if (!changes) throw notFound("Respuesta no encontrada.");
    return { ok: true };
  });
}
