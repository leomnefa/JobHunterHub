import { connectorRegistry } from "../connectors/registry.ts";
import { dedupeJobs } from "../core/dedup.ts";
import { nowIso, run } from "../db/index.ts";
import { newId } from "../util/crypto.ts";
import type { JobSearchParams, NormalizedJob } from "../core/types.ts";
import { saveJobs } from "./jobs.ts";
import { listEnabledSources, markSourceSync, resolveSettings } from "./sources.ts";

/**
 * Orquestador de busqueda multi-fuente.
 *
 * Cada connector se ejecuta aislado: si Adzuna falla, Himalayas y Greenhouse
 * siguen respondiendo. Los resultados se normalizan, deduplican y persisten.
 */

export interface SourceOutcome {
  source: string;
  name: string;
  status: "ok" | "error" | "empty";
  jobs: number;
  durationMs: number;
  warnings: string[];
  error?: string;
}

export interface SearchOutcome {
  jobs: NormalizedJob[];
  outcomes: SourceOutcome[];
  duplicatesRemoved: number;
  duplicateCandidates: number;
  durationMs: number;
  attributions: string[];
}

export interface RunSearchOptions {
  params: JobSearchParams;
  sources?: string[];
  persist?: boolean;
  userId?: string;
  triggeredBy?: string;
}

function recordExecution(
  sourceId: string,
  outcome: SourceOutcome,
  saved: { inserted: number; updated: number; duplicated: number; rejected: number },
  triggeredBy: string,
): void {
  run(
    `INSERT INTO connector_executions (
       id, source_id, started_at, finished_at, duration_ms, status,
       jobs_received, jobs_inserted, jobs_updated, jobs_duplicated, jobs_rejected,
       rate_limit_hits, error_message, triggered_by
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    newId("exec_"),
    sourceId,
    new Date(Date.now() - outcome.durationMs).toISOString(),
    nowIso(),
    outcome.durationMs,
    outcome.status === "error" ? "ERROR" : "OK",
    outcome.jobs,
    saved.inserted,
    saved.updated,
    saved.duplicated,
    saved.rejected,
    outcome.warnings.filter((warning) => /429|rate|limite/i.test(warning)).length,
    outcome.error ?? null,
    triggeredBy,
  );
}

export async function runSearch(options: RunSearchOptions): Promise<SearchOutcome> {
  const started = Date.now();
  const available = listEnabledSources();
  const wanted = options.sources?.length
    ? available.filter((source) => options.sources?.includes(source.id))
    : available;

  const outcomes: SourceOutcome[] = [];
  const collected: NormalizedJob[] = [];
  const attributions = new Set<string>();

  const results = await Promise.allSettled(
    wanted.map(async (source) => {
      const connector = connectorRegistry.require(source.id);
      const context = connectorRegistry.context(source.id, resolveSettings(source.id));
      const sourceStarted = Date.now();
      try {
        const result = await connector.searchJobs(options.params, context);
        return { source, result, durationMs: Date.now() - sourceStarted };
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
          source,
          durationMs: Date.now() - sourceStarted,
        });
      }
    }),
  );

  for (const settled of results) {
    if (settled.status === "fulfilled") {
      const { source, result, durationMs } = settled.value;
      const outcome: SourceOutcome = {
        source: source.id,
        name: source.name,
        status: result.jobs.length ? "ok" : "empty",
        jobs: result.jobs.length,
        durationMs,
        warnings: result.warnings ?? [],
      };
      outcomes.push(outcome);
      collected.push(...result.jobs);
      if (source.attribution) attributions.add(source.attribution);

      const saved = options.persist === false
        ? { inserted: 0, updated: 0, duplicated: 0, rejected: 0 }
        : saveJobs(result.jobs);
      recordExecution(source.id, outcome, saved, options.triggeredBy ?? "search");
      markSourceSync(source.id, outcome.status === "empty" ? "EMPTY" : "OK");
    } else {
      const error = settled.reason as Error & { source?: { id: string; name: string }; durationMs?: number };
      const sourceId = error.source?.id ?? "desconocido";
      const outcome: SourceOutcome = {
        source: sourceId,
        name: error.source?.name ?? sourceId,
        status: "error",
        jobs: 0,
        durationMs: error.durationMs ?? 0,
        warnings: [],
        error: error.message,
      };
      outcomes.push(outcome);
      if (error.source) {
        recordExecution(
          sourceId,
          outcome,
          { inserted: 0, updated: 0, duplicated: 0, rejected: 0 },
          options.triggeredBy ?? "search",
        );
        markSourceSync(sourceId, "ERROR", error.message);
      }
    }
  }

  const deduped = dedupeJobs(collected);
  const durationMs = Date.now() - started;

  if (options.userId) {
    run(
      `INSERT INTO search_queries (id, user_id, params_json, sources, results, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId("qry_"),
      options.userId,
      JSON.stringify(options.params),
      JSON.stringify(wanted.map((source) => source.id)),
      deduped.unique.length,
      durationMs,
      nowIso(),
    );
  }

  return {
    jobs: deduped.unique,
    outcomes,
    duplicatesRemoved: deduped.duplicates.length,
    duplicateCandidates: deduped.candidates.length,
    durationMs,
    attributions: [...attributions],
  };
}

/** Comprobacion de salud de todas las fuentes habilitadas. */
export async function checkAllConnectors(): Promise<
  { id: string; name: string; status: string; latencyMs?: number; message?: string }[]
> {
  const sources = connectorRegistry.list();
  const checks = await Promise.allSettled(
    sources.map(async (connector) => {
      const settings = resolveSettings(connector.id);
      const context = connectorRegistry.context(connector.id, settings);
      const health = await connector.healthCheck(context);
      return { id: connector.id, name: connector.name, ...health };
    }),
  );

  return checks.map((check, index) => {
    if (check.status === "fulfilled") {
      return {
        id: check.value.id,
        name: check.value.name,
        status: check.value.status,
        latencyMs: check.value.latencyMs,
        message: check.value.message,
      };
    }
    return {
      id: sources[index].id,
      name: sources[index].name,
      status: "OFFLINE",
      message: check.reason instanceof Error ? check.reason.message : String(check.reason),
    };
  });
}
