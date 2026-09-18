import { all, fromJson, get, nowIso, run } from "../db/index.ts";
import { newId } from "../util/crypto.ts";
import type { JobSearchParams } from "../core/types.ts";
import { computeHeuristicMatch } from "./matching.ts";
import { getJob, queryJobs } from "./jobs.ts";
import { parseProfileMarkdown } from "./profile.ts";
import { runSearch } from "./search.ts";
import { listEnabledSources } from "./sources.ts";
import { audit } from "./audit.ts";

/**
 * Worker de sincronizacion.
 *
 * Recorre las busquedas guardadas con alertas activas, ejecuta la busqueda en
 * las fuentes habilitadas, guarda las ofertas nuevas y genera alertas cuando
 * el match supera el umbral del usuario.
 *
 * Los intervalos salen de la configuracion de cada fuente: no se hardcodean
 * frecuencias que puedan violar los rate limits de las fuentes.
 */

let timer: NodeJS.Timeout | undefined;
let running = false;

export interface SyncReport {
  startedAt: string;
  finishedAt: string;
  savedSearches: number;
  jobsFound: number;
  alertsCreated: number;
  errors: string[];
}

interface SavedSearchRow {
  id: string;
  user_id: string;
  name: string;
  params_json: string;
  alerts_enabled: number;
  last_run_at: string | null;
}

interface ProfileRow {
  markdown: string;
}

interface PreferencesRow {
  countries_allowed: string;
  employment_types: string;
  remote_preference: string;
  salary_min: number | null;
  excluded_keywords: string;
  min_match_alert: number;
}

function createAlert(input: {
  userId: string;
  jobId: string;
  savedSearchId: string;
  title: string;
  body: string;
  score: number;
}): boolean {
  const existing = get<{ id: string }>(
    "SELECT id FROM alerts WHERE user_id = ? AND job_id = ?",
    input.userId,
    input.jobId,
  );
  if (existing) return false;

  run(
    `INSERT INTO alerts (id, user_id, job_id, saved_search_id, title, body, score, read, created_at)
     VALUES (?,?,?,?,?,?,?,0,?)`,
    newId("alr_"),
    input.userId,
    input.jobId,
    input.savedSearchId,
    input.title,
    input.body,
    input.score,
    nowIso(),
  );
  return true;
}

/** Ejecuta una pasada completa de sincronizacion. */
export async function runSyncCycle(triggeredBy = "scheduler"): Promise<SyncReport> {
  const startedAt = nowIso();
  const errors: string[] = [];
  let jobsFound = 0;
  let alertsCreated = 0;

  const searches = all<SavedSearchRow>(
    "SELECT * FROM saved_searches WHERE alerts_enabled = 1 ORDER BY COALESCE(last_run_at, '') ASC",
  );

  const enabled = listEnabledSources();
  if (enabled.length === 0) {
    return {
      startedAt,
      finishedAt: nowIso(),
      savedSearches: 0,
      jobsFound: 0,
      alertsCreated: 0,
      errors: ["No hay fuentes habilitadas y configuradas."],
    };
  }

  for (const search of searches) {
    try {
      const params = fromJson<JobSearchParams>(search.params_json, {});
      const outcome = await runSearch({
        params: { ...params, limit: params.limit ?? 50 },
        persist: true,
        triggeredBy,
      });
      jobsFound += outcome.jobs.length;

      run("UPDATE saved_searches SET last_run_at = ? WHERE id = ?", nowIso(), search.id);

      const profileRow = get<ProfileRow>(
        "SELECT markdown FROM candidate_profiles WHERE user_id = ? AND is_primary = 1",
        search.user_id,
      );
      if (!profileRow?.markdown) continue;

      const preferences = get<PreferencesRow>(
        "SELECT * FROM candidate_preferences WHERE user_id = ?",
        search.user_id,
      );
      const threshold = preferences?.min_match_alert ?? 80;
      const profile = parseProfileMarkdown(profileRow.markdown);

      for (const job of outcome.jobs) {
        const stored = getJob(job.id) ?? job;
        const match = computeHeuristicMatch(stored, profile, {
          countriesAllowed: fromJson<string[]>(preferences?.countries_allowed, []),
          employmentTypes: fromJson<string[]>(preferences?.employment_types, []),
          remotePreference:
            (preferences?.remote_preference as "remote" | "hybrid" | "onsite" | "any") ?? "remote",
          salaryMin: preferences?.salary_min ?? undefined,
          excludedKeywords: fromJson<string[]>(preferences?.excluded_keywords, []),
        });

        if (match.compatibilityScore < threshold) continue;

        run(
          `INSERT INTO job_matches (
             id, user_id, job_id, compatibility_score, skills_match, experience_match,
             location_match, salary_match, seniority_match, contract_match, language_match,
             ai_analysis, matched_skills, missing_skills, risks, recommendation, analyzed_by,
             created_at, updated_at
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(user_id, job_id) DO UPDATE SET
             compatibility_score = excluded.compatibility_score,
             updated_at = excluded.updated_at`,
          newId("mat_"),
          search.user_id,
          stored.id,
          match.compatibilityScore,
          match.skillsMatch,
          match.experienceMatch,
          match.locationMatch,
          match.salaryMatch,
          match.seniorityMatch,
          match.contractMatch,
          match.languageMatch,
          match.aiAnalysis,
          JSON.stringify(match.matchedSkills),
          JSON.stringify(match.missingSkills),
          JSON.stringify(match.risks),
          match.recommendation,
          match.analyzedBy,
          nowIso(),
          nowIso(),
        );

        const created = createAlert({
          userId: search.user_id,
          jobId: stored.id,
          savedSearchId: search.id,
          title: `${stored.title} — ${stored.company.name}`,
          body: `Match ${match.compatibilityScore}% · ${stored.location ?? "sin ubicacion"} · ${stored.source}`,
          score: match.compatibilityScore,
        });
        if (created) alertsCreated += 1;
      }
    } catch (error) {
      errors.push(
        `Busqueda "${search.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const report: SyncReport = {
    startedAt,
    finishedAt: nowIso(),
    savedSearches: searches.length,
    jobsFound,
    alertsCreated,
    errors,
  };

  audit({
    action: "SYNC",
    entity: "scheduler",
    result: errors.length ? "WARNING" : "SUCCESS",
    detail: `busquedas=${searches.length} ofertas=${jobsFound} alertas=${alertsCreated}`,
  });

  return report;
}

export function startScheduler(intervalMinutes: number): void {
  if (intervalMinutes <= 0) return;
  stopScheduler();
  const periodMs = Math.max(5, intervalMinutes) * 60 * 1000;

  timer = setInterval(() => {
    if (running) return; // nunca se solapan dos ciclos
    running = true;
    runSyncCycle("scheduler")
      .catch((error) => {
        audit({
          action: "SYNC",
          result: "FAILURE",
          detail: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        running = false;
      });
  }, periodMs);

  timer.unref();
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

export function schedulerStatus(): { active: boolean; running: boolean } {
  return { active: timer !== undefined, running };
}

/** Sincroniza una unica fuente, sin depender de busquedas guardadas. */
export async function syncSource(sourceId: string, keywords: string[] = []): Promise<{
  jobs: number;
  errors: string[];
}> {
  const outcome = await runSearch({
    params: { keywords, limit: 100 },
    sources: [sourceId],
    persist: true,
    triggeredBy: "manual-sync",
  });
  return {
    jobs: outcome.jobs.length,
    errors: outcome.outcomes.filter((item) => item.error).map((item) => item.error ?? ""),
  };
}

/** Estadisticas de ejecucion por fuente para el dashboard de observabilidad. */
export function executionStats(limit = 50): {
  recent: Record<string, unknown>[];
  bySource: Record<string, unknown>[];
} {
  return {
    recent: all(
      `SELECT * FROM connector_executions ORDER BY started_at DESC LIMIT ?`,
      Math.min(limit, 200),
    ),
    bySource: all(
      `SELECT source_id,
              COUNT(*) AS runs,
              SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) AS errors,
              SUM(jobs_received) AS jobs_received,
              SUM(jobs_inserted) AS jobs_inserted,
              SUM(jobs_duplicated) AS jobs_duplicated,
              SUM(rate_limit_hits) AS rate_limit_hits,
              AVG(duration_ms) AS avg_duration_ms,
              MAX(started_at) AS last_run
       FROM connector_executions
       GROUP BY source_id
       ORDER BY runs DESC`,
    ),
  };
}

/** Obtiene las ofertas mas recientes para el dashboard del usuario. */
export function recentJobs(limit = 12) {
  return queryJobs({ limit, orderBy: "recent" }).jobs;
}
