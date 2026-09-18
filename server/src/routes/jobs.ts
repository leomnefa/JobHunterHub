import { all, fromJson, get, nowIso, run, toJson } from "../db/index.ts";
import { newId } from "../util/crypto.ts";
import {
  asObject,
  badRequest,
  forbidden,
  notFound,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireString,
  stringArray,
} from "../http/router.ts";
import type { Router } from "../http/router.ts";
import type { EmploymentType, JobSearchParams, Seniority } from "../core/types.ts";
import { audit } from "../services/audit.ts";
import { getJob, jobStats, queryJobs } from "../services/jobs.ts";
import { computeHeuristicMatch, computeMatch } from "../services/matching.ts";
import type { JobMatch, MatchPreferences } from "../services/matching.ts";
import { parseProfileMarkdown } from "../services/profile.ts";
import type { ParsedProfile } from "../services/profile.ts";
import { runSearch } from "../services/search.ts";
import { listSources } from "../services/sources.ts";
import { generateCoverLetter, generateTailoredCv } from "../services/documents.ts";
import { createApplication, prepareApplication } from "../services/applications.ts";
import { getPrimaryProfile } from "./profile.ts";

/**
 * Busqueda, analisis y preparacion de postulaciones.
 * Todas las rutas trabajan sobre el usuario autenticado (nunca sobre un id
 * recibido del cliente) y estan vedadas al rol ADMIN, que no es candidato.
 */

function ensureCandidate(role: string): void {
  if (role === "ADMIN") {
    throw forbidden("El administrador no puede operar como candidato.");
  }
}

interface ProfileContext {
  markdown: string;
  parsed: ParsedProfile;
  preferences: MatchPreferences;
}

function loadProfileContext(userId: string): ProfileContext {
  const row = getPrimaryProfile(userId);
  if (!row?.markdown) {
    throw badRequest("Primero cargue su perfil profesional en Mi Perfil.");
  }
  const preferencesRow = get<Record<string, unknown>>(
    "SELECT * FROM candidate_preferences WHERE user_id = ?",
    userId,
  );
  return {
    markdown: row.markdown,
    parsed: parseProfileMarkdown(row.markdown),
    preferences: {
      countriesAllowed: fromJson<string[]>(preferencesRow?.countries_allowed, []),
      employmentTypes: fromJson<string[]>(preferencesRow?.employment_types, []),
      remotePreference:
        (preferencesRow?.remote_preference as MatchPreferences["remotePreference"]) ?? "remote",
      salaryMin: (preferencesRow?.salary_min as number | null) ?? undefined,
      excludedKeywords: fromJson<string[]>(preferencesRow?.excluded_keywords, []),
    },
  };
}

function parseSearchParams(input: Record<string, unknown>): JobSearchParams {
  return {
    keywords: stringArray(input, "keywords"),
    excludedKeywords: stringArray(input, "excludedKeywords"),
    countries: stringArray(input, "countries"),
    location: optionalString(input, "location", 200),
    remoteOnly: optionalBoolean(input, "remoteOnly"),
    worldwideOnly: optionalBoolean(input, "worldwideOnly"),
    employmentTypes: stringArray(input, "employmentTypes") as EmploymentType[],
    seniority: stringArray(input, "seniority") as Seniority[],
    salaryMin: optionalNumber(input, "salaryMin"),
    company: optionalString(input, "company", 200),
    limit: Math.min(optionalNumber(input, "limit") ?? 50, 200),
    page: optionalNumber(input, "page"),
    cursor: optionalString(input, "cursor", 500),
  };
}

function persistMatch(userId: string, match: JobMatch): void {
  const timestamp = nowIso();
  run(
    `INSERT INTO job_matches (
       id, user_id, job_id, compatibility_score, skills_match, experience_match, location_match,
       salary_match, seniority_match, contract_match, language_match, ai_analysis,
       matched_skills, missing_skills, risks, recommendation, analyzed_by, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id, job_id) DO UPDATE SET
       compatibility_score = excluded.compatibility_score,
       skills_match = excluded.skills_match,
       experience_match = excluded.experience_match,
       location_match = excluded.location_match,
       salary_match = excluded.salary_match,
       seniority_match = excluded.seniority_match,
       contract_match = excluded.contract_match,
       language_match = excluded.language_match,
       ai_analysis = excluded.ai_analysis,
       matched_skills = excluded.matched_skills,
       missing_skills = excluded.missing_skills,
       risks = excluded.risks,
       recommendation = excluded.recommendation,
       analyzed_by = excluded.analyzed_by,
       updated_at = excluded.updated_at`,
    newId("mat_"),
    userId,
    match.jobId,
    match.compatibilityScore,
    match.skillsMatch,
    match.experienceMatch,
    match.locationMatch,
    match.salaryMatch,
    match.seniorityMatch,
    match.contractMatch,
    match.languageMatch,
    match.aiAnalysis,
    toJson(match.matchedSkills),
    toJson(match.missingSkills),
    toJson(match.risks),
    match.recommendation,
    match.analyzedBy,
    timestamp,
    timestamp,
  );
}

function readMatch(userId: string, jobId: string): JobMatch | null {
  const row = get<Record<string, unknown>>(
    "SELECT * FROM job_matches WHERE user_id = ? AND job_id = ?",
    userId,
    jobId,
  );
  if (!row) return null;
  return {
    jobId,
    compatibilityScore: Number(row.compatibility_score),
    skillsMatch: Number(row.skills_match),
    experienceMatch: Number(row.experience_match),
    locationMatch: Number(row.location_match),
    salaryMatch: Number(row.salary_match),
    seniorityMatch: Number(row.seniority_match),
    contractMatch: Number(row.contract_match),
    languageMatch: Number(row.language_match),
    aiAnalysis: String(row.ai_analysis ?? ""),
    matchedSkills: fromJson<string[]>(row.matched_skills, []),
    missingSkills: fromJson<string[]>(row.missing_skills, []),
    risks: fromJson<string[]>(row.risks, []),
    recommendation: String(row.recommendation) as JobMatch["recommendation"],
    analyzedBy: String(row.analyzed_by) as JobMatch["analyzedBy"],
  };
}

export function registerJobRoutes(router: Router): void {
  /** Busqueda en vivo contra las fuentes habilitadas. */
  router.post("/api/jobs/search", async ({ body, user, ip }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const params = parseSearchParams(input);
    const sources = stringArray(input, "sources");

    const outcome = await runSearch({
      params,
      sources: sources.length ? sources : undefined,
      userId: user!.sub,
      triggeredBy: "user-search",
    });

    audit({
      action: "SEARCH",
      userId: user!.sub,
      userEmail: user!.email,
      ip,
      detail: `${params.keywords?.join(" ") ?? ""} -> ${outcome.jobs.length} resultados`,
    });

    // El match se calcula si el usuario ya tiene perfil; si no, se devuelven las
    // ofertas igual para que pueda explorar antes de cargarlo.
    // En la busqueda masiva se usa solo el scoring deterministico: es inmediato
    // y no consume creditos de IA. El analisis con LLM se pide por oferta.
    let matches: Record<string, JobMatch> = {};
    try {
      const context = loadProfileContext(user!.sub);
      for (const job of outcome.jobs) {
        matches[job.id] = computeHeuristicMatch(job, context.parsed, context.preferences);
      }
    } catch {
      matches = {};
    }

    return {
      jobs: outcome.jobs,
      matches,
      outcomes: outcome.outcomes,
      duplicatesRemoved: outcome.duplicatesRemoved,
      duplicateCandidates: outcome.duplicateCandidates,
      durationMs: outcome.durationMs,
      attributions: outcome.attributions,
    };
  });

  /** Ofertas ya guardadas en la base local. */
  router.get("/api/jobs", ({ query, user }) => {
    ensureCandidate(user!.role);
    const result = queryJobs({
      keywords: query.get("q") ?? undefined,
      sources: query.getAll("source"),
      remoteType: query.get("remoteType") ?? undefined,
      employmentTypes: query.getAll("employmentType"),
      seniority: query.getAll("seniority"),
      salaryMin: query.get("salaryMin") ? Number(query.get("salaryMin")) : undefined,
      worldwideOnly: query.get("worldwide") === "true",
      limit: query.get("limit") ? Number(query.get("limit")) : 50,
      offset: query.get("offset") ? Number(query.get("offset")) : 0,
      orderBy: (query.get("orderBy") as "recent" | "salary" | "title") ?? "recent",
    });

    const matches = Object.fromEntries(
      result.jobs
        .map((job) => [job.id, readMatch(user!.sub, job.id)] as const)
        .filter(([, match]) => match !== null),
    );

    return { ...result, matches };
  });

  router.get("/api/jobs/:id", ({ params, user }) => {
    ensureCandidate(user!.role);
    const job = getJob(params.id);
    if (!job) throw notFound("Oferta no encontrada.");
    return { job, match: readMatch(user!.sub, job.id) };
  });

  /** Analisis con IA (o heuristico si no hay proveedor). */
  router.post("/api/jobs/:id/analyze", async ({ params, user, ip }) => {
    ensureCandidate(user!.role);
    const job = getJob(params.id);
    if (!job) throw notFound("Oferta no encontrada.");

    const context = loadProfileContext(user!.sub);
    const match = await computeMatch(job, context.parsed, context.markdown, context.preferences, true);
    persistMatch(user!.sub, match);

    audit({
      action: "ANALYZE",
      userId: user!.sub,
      userEmail: user!.email,
      entity: "job",
      entityId: job.id,
      source: job.source,
      ip,
      detail: `score=${match.compatibilityScore} via=${match.analyzedBy}`,
    });

    return { match };
  });

  router.get("/api/jobs/:id/match", ({ params, user }) => {
    ensureCandidate(user!.role);
    const match = readMatch(user!.sub, params.id);
    if (!match) throw notFound("Todavia no se analizo esta oferta.");
    return { match };
  });

  /** Genera CV adaptado + carta y prepara el formulario de postulacion. */
  router.post("/api/jobs/:id/prepare-application", async ({ params, body, user, ip }) => {
    ensureCandidate(user!.role);
    const job = getJob(params.id);
    if (!job) throw notFound("Oferta no encontrada.");

    const input = asObject(body ?? {});
    const withCoverLetter = optionalBoolean(input, "coverLetter") ?? true;
    const context = loadProfileContext(user!.sub);

    const match =
      readMatch(user!.sub, job.id) ??
      (await computeMatch(job, context.parsed, context.markdown, context.preferences, true));
    persistMatch(user!.sub, match);

    const cv = await generateTailoredCv(context.parsed, context.markdown, job, match);
    const cover = withCoverLetter
      ? await generateCoverLetter(context.parsed, context.markdown, job, match)
      : null;

    const timestamp = nowIso();
    const cvId = newId("cv_");
    run(
      `INSERT INTO candidate_resumes (id, user_id, job_id, label, kind, format, content, generated_by, created_at, updated_at)
       VALUES (?,?,?,?,'tailored','markdown',?,?,?,?)`,
      cvId,
      user!.sub,
      job.id,
      `CV para ${job.title} — ${job.company.name}`,
      cv.content,
      cv.generatedBy,
      timestamp,
      timestamp,
    );

    let coverId: string | undefined;
    if (cover) {
      coverId = newId("cl_");
      run(
        `INSERT INTO candidate_resumes (id, user_id, job_id, label, kind, format, content, generated_by, created_at, updated_at)
         VALUES (?,?,?,?,'cover_letter','markdown',?,?,?,?)`,
        coverId,
        user!.sub,
        job.id,
        `Carta para ${job.title} — ${job.company.name}`,
        cover.content,
        cover.generatedBy,
        timestamp,
        timestamp,
      );
    }

    const storedAnswers = all<{ question: string; answer: string }>(
      "SELECT question, answer FROM candidate_answers WHERE user_id = ?",
      user!.sub,
    );

    const prepared = await prepareApplication({
      userId: user!.sub,
      job,
      profile: context.parsed,
      profileMarkdown: context.markdown,
      match,
      storedAnswers,
    });

    run(
      "UPDATE applications SET resume_id = ?, cover_letter_id = ?, match_score = ?, updated_at = ? WHERE id = ?",
      cvId,
      coverId ?? null,
      match.compatibilityScore,
      timestamp,
      prepared.application.id,
    );

    audit({
      action: "PREPARE_APPLICATION",
      userId: user!.sub,
      userEmail: user!.email,
      entity: "application",
      entityId: prepared.application.id,
      source: job.source,
      ip,
    });

    return {
      applicationId: prepared.application.id,
      status: prepared.application.status,
      match,
      cv: { id: cvId, content: cv.content, generatedBy: cv.generatedBy, warnings: cv.warnings },
      coverLetter: cover
        ? { id: coverId, content: cover.content, generatedBy: cover.generatedBy, warnings: cover.warnings }
        : null,
      form: prepared.form,
      answers: prepared.answers,
      canSubmitByApi: prepared.canSubmitByApi,
      blockers: prepared.blockers,
      warnings: [...prepared.warnings, ...cv.warnings, ...(cover?.warnings ?? [])],
      applicationUrl: job.applicationUrl ?? job.sourceUrl,
    };
  });

  /** Registra una postulacion hecha manualmente en el sitio original. */
  router.post("/api/jobs/:id/track", ({ params, body, user, ip }) => {
    ensureCandidate(user!.role);
    const job = getJob(params.id);
    if (!job) throw notFound("Oferta no encontrada.");
    const input = asObject(body ?? {});

    const application = createApplication({
      userId: user!.sub,
      job,
      status: "SUBMITTED",
      matchScore: readMatch(user!.sub, job.id)?.compatibilityScore,
    });
    run(
      "UPDATE applications SET status = 'SUBMITTED', submitted_at = ?, notes = ?, last_status_update = ?, updated_at = ? WHERE id = ?",
      nowIso(),
      optionalString(input, "notes", 2000) ?? null,
      nowIso(),
      nowIso(),
      application.id,
    );

    audit({
      action: "TRACK_APPLICATION",
      userId: user!.sub,
      userEmail: user!.email,
      entity: "application",
      entityId: application.id,
      source: job.source,
      ip,
    });

    return { applicationId: application.id };
  });

  /* ------------------------- Busquedas guardadas ------------------------ */

  router.get("/api/saved-searches", ({ user }) => {
    ensureCandidate(user!.role);
    const rows = all<Record<string, unknown>>(
      "SELECT * FROM saved_searches WHERE user_id = ? ORDER BY updated_at DESC",
      user!.sub,
    );
    return {
      searches: rows.map((row) => ({
        id: row.id,
        name: row.name,
        params: fromJson(row.params_json, {}),
        alertsEnabled: row.alerts_enabled === 1,
        lastRunAt: row.last_run_at,
        updatedAt: row.updated_at,
      })),
    };
  });

  router.post("/api/saved-searches", ({ body, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const id = newId("sav_");
    const timestamp = nowIso();
    run(
      `INSERT INTO saved_searches (id, user_id, name, params_json, alerts_enabled, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      id,
      user!.sub,
      requireString(input, "name", 120),
      toJson(parseSearchParams(asObject(input.params ?? {}))),
      optionalBoolean(input, "alertsEnabled") === false ? 0 : 1,
      timestamp,
      timestamp,
    );
    return { id };
  });

  router.put("/api/saved-searches/:id", ({ params, body, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const changes = run(
      `UPDATE saved_searches SET name = ?, params_json = ?, alerts_enabled = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      requireString(input, "name", 120),
      toJson(parseSearchParams(asObject(input.params ?? {}))),
      optionalBoolean(input, "alertsEnabled") === false ? 0 : 1,
      nowIso(),
      params.id,
      user!.sub,
    ).changes;
    if (!changes) throw notFound("Busqueda guardada no encontrada.");
    return { ok: true };
  });

  router.delete("/api/saved-searches/:id", ({ params, user }) => {
    ensureCandidate(user!.role);
    const changes = run(
      "DELETE FROM saved_searches WHERE id = ? AND user_id = ?",
      params.id,
      user!.sub,
    ).changes;
    if (!changes) throw notFound("Busqueda guardada no encontrada.");
    return { ok: true };
  });

  /* -------------------------------- Alertas ----------------------------- */

  router.get("/api/alerts", ({ user, query }) => {
    ensureCandidate(user!.role);
    const unreadOnly = query.get("unread") === "true";
    return {
      alerts: all(
        `SELECT a.*, j.source, j.source_url, j.location
         FROM alerts a LEFT JOIN jobs j ON j.id = a.job_id
         WHERE a.user_id = ? ${unreadOnly ? "AND a.read = 0" : ""}
         ORDER BY a.created_at DESC LIMIT 100`,
        user!.sub,
      ),
    };
  });

  router.post("/api/alerts/:id/read", ({ params, user }) => {
    ensureCandidate(user!.role);
    run("UPDATE alerts SET read = 1 WHERE id = ? AND user_id = ?", params.id, user!.sub);
    return { ok: true };
  });

  router.post("/api/alerts/read-all", ({ user }) => {
    ensureCandidate(user!.role);
    run("UPDATE alerts SET read = 1 WHERE user_id = ?", user!.sub);
    return { ok: true };
  });

  /* ------------------------------- Catalogos ---------------------------- */

  router.get("/api/sources", () => ({
    sources: listSources().map((source) => ({
      id: source.id,
      name: source.name,
      category: source.category,
      mode: source.mode,
      enabled: source.enabled,
      configured: source.configured,
      capabilities: source.capabilities,
      attribution: source.attribution,
      restrictions: source.restrictions,
      homepage: source.homepage,
    })),
  }));

  router.get("/api/stats/jobs", ({ user }) => {
    ensureCandidate(user!.role);
    return jobStats();
  });
}
