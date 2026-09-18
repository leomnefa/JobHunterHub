import { annualizeSalary, normalizeCompany } from "../core/normalize.ts";
import { compareJobs } from "../core/dedup.ts";
import { all, fromJson, get, nowIso, run, toJson } from "../db/index.ts";
import { newId } from "../util/crypto.ts";
import type { NormalizedJob } from "../core/types.ts";

/**
 * Persistencia de ofertas normalizadas, con deduplicacion contra lo ya guardado.
 * Se conserva siempre la trazabilidad completa: source, sourceJobId, sourceUrl,
 * retrievedAt y rawData.
 */

export interface JobRow {
  id: string;
  source: string;
  source_job_id: string;
  source_url: string;
  title: string;
  company_name: string;
  description: string;
  location: string | null;
  country: string | null;
  remote_type: string;
  worldwide: number;
  employment_type: string;
  seniority: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_annualized: number | null;
  skills_json: string;
  categories_json: string;
  published_at: string | null;
  expires_at: string | null;
  retrieved_at: string;
  application_url: string | null;
  application_method: string;
  capabilities_json: string;
  raw_json: string | null;
  duplicate_of: string | null;
  duplicate_candidate: number;
  duplicate_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export function rowToJob(row: JobRow): NormalizedJob {
  return {
    id: row.id,
    source: row.source,
    sourceJobId: row.source_job_id,
    sourceUrl: row.source_url,
    title: row.title,
    company: { name: row.company_name },
    description: row.description,
    location: row.location ?? undefined,
    country: row.country ?? undefined,
    remoteType: row.remote_type as NormalizedJob["remoteType"],
    worldwide: row.worldwide === 1,
    employmentType: row.employment_type as NormalizedJob["employmentType"],
    seniority: row.seniority as NormalizedJob["seniority"],
    salary:
      row.salary_min !== null || row.salary_max !== null
        ? {
            min: row.salary_min ?? undefined,
            max: row.salary_max ?? undefined,
            currency: row.salary_currency ?? undefined,
            period: (row.salary_period ?? "unknown") as NonNullable<NormalizedJob["salary"]>["period"],
          }
        : undefined,
    skills: fromJson<string[]>(row.skills_json, []),
    categories: fromJson<string[]>(row.categories_json, []),
    publishedAt: row.published_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    retrievedAt: row.retrieved_at,
    applicationUrl: row.application_url ?? undefined,
    applicationMethod: row.application_method as NormalizedJob["applicationMethod"],
    connectorCapabilities: fromJson(row.capabilities_json, {} as NormalizedJob["connectorCapabilities"]),
    rawData: row.raw_json ? fromJson(row.raw_json, undefined) : undefined,
  };
}

function upsertCompany(job: NormalizedJob): string {
  const normalized = normalizeCompany(job.company.name);
  const existing = get<{ id: string }>(
    "SELECT id FROM companies WHERE normalized_name = ? LIMIT 1",
    normalized,
  );
  if (existing) return existing.id;
  const id = newId("cmp_");
  run(
    `INSERT INTO companies (id, name, normalized_name, website, logo_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    job.company.name,
    normalized,
    job.company.website ?? null,
    job.company.logoUrl ?? null,
    nowIso(),
  );
  return id;
}

export interface SaveResult {
  inserted: number;
  updated: number;
  duplicated: number;
  rejected: number;
}

/**
 * Guarda un lote. Antes de insertar, busca duplicados entre ofertas ya
 * almacenadas de la MISMA empresa pero de otra fuente.
 */
export function saveJobs(jobs: NormalizedJob[]): SaveResult {
  const result: SaveResult = { inserted: 0, updated: 0, duplicated: 0, rejected: 0 };
  const timestamp = nowIso();

  for (const job of jobs) {
    if (!job.title || !job.sourceJobId) {
      result.rejected += 1;
      continue;
    }

    const existing = get<JobRow>(
      "SELECT * FROM jobs WHERE source = ? AND source_job_id = ?",
      job.source,
      job.sourceJobId,
    );
    const companyId = upsertCompany(job);

    let duplicateOf: string | null = null;
    let duplicateCandidate = 0;
    let duplicateConfidence: number | null = null;

    if (!existing) {
      // Candidatos: misma empresa normalizada, distinta fuente.
      const siblings = all<JobRow>(
        `SELECT j.* FROM jobs j
         WHERE j.company_id = ? AND j.source <> ? AND j.duplicate_of IS NULL
         ORDER BY j.created_at DESC LIMIT 40`,
        companyId,
        job.source,
      );
      for (const sibling of siblings) {
        const verdict = compareJobs(job, rowToJob(sibling));
        if (verdict.isDuplicate) {
          duplicateOf = sibling.id;
          duplicateCandidate = 1;
          duplicateConfidence = verdict.confidence;
          break;
        }
        if (verdict.isCandidate && duplicateConfidence === null) {
          duplicateCandidate = 1;
          duplicateConfidence = verdict.confidence;
        }
      }
    }

    const annualized = annualizeSalary(job.salary) ?? null;

    if (existing) {
      run(
        `UPDATE jobs SET
           source_url = ?, title = ?, company_id = ?, company_name = ?, description = ?,
           location = ?, country = ?, remote_type = ?, worldwide = ?, employment_type = ?,
           seniority = ?, salary_min = ?, salary_max = ?, salary_currency = ?, salary_period = ?,
           salary_annualized = ?, skills_json = ?, categories_json = ?, published_at = ?,
           expires_at = ?, retrieved_at = ?, application_url = ?, application_method = ?,
           capabilities_json = ?, raw_json = ?, updated_at = ?
         WHERE id = ?`,
        job.sourceUrl,
        job.title,
        companyId,
        job.company.name,
        job.description,
        job.location ?? null,
        job.country ?? null,
        job.remoteType,
        job.worldwide ? 1 : 0,
        job.employmentType ?? "unknown",
        job.seniority ?? "unknown",
        job.salary?.min ?? null,
        job.salary?.max ?? null,
        job.salary?.currency ?? null,
        job.salary?.period ?? null,
        annualized,
        toJson(job.skills),
        toJson(job.categories),
        job.publishedAt ?? null,
        job.expiresAt ?? null,
        job.retrievedAt,
        job.applicationUrl ?? null,
        job.applicationMethod,
        toJson(job.connectorCapabilities),
        job.rawData ? toJson(job.rawData) : null,
        timestamp,
        existing.id,
      );
      result.updated += 1;
      continue;
    }

    run(
      `INSERT INTO jobs (
         id, source, source_job_id, source_url, title, company_id, company_name, description,
         location, country, remote_type, worldwide, employment_type, seniority,
         salary_min, salary_max, salary_currency, salary_period, salary_annualized,
         skills_json, categories_json, published_at, expires_at, retrieved_at,
         application_url, application_method, capabilities_json, raw_json,
         duplicate_of, duplicate_candidate, duplicate_confidence, created_at, updated_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      job.id,
      job.source,
      job.sourceJobId,
      job.sourceUrl,
      job.title,
      companyId,
      job.company.name,
      job.description,
      job.location ?? null,
      job.country ?? null,
      job.remoteType,
      job.worldwide ? 1 : 0,
      job.employmentType ?? "unknown",
      job.seniority ?? "unknown",
      job.salary?.min ?? null,
      job.salary?.max ?? null,
      job.salary?.currency ?? null,
      job.salary?.period ?? null,
      annualized,
      toJson(job.skills),
      toJson(job.categories),
      job.publishedAt ?? null,
      job.expiresAt ?? null,
      job.retrievedAt,
      job.applicationUrl ?? null,
      job.applicationMethod,
      toJson(job.connectorCapabilities),
      job.rawData ? toJson(job.rawData) : null,
      duplicateOf,
      duplicateCandidate,
      duplicateConfidence,
      timestamp,
      timestamp,
    );

    if (duplicateOf) result.duplicated += 1;
    else result.inserted += 1;
  }

  return result;
}

export function getJob(id: string): NormalizedJob | null {
  const row = get<JobRow>("SELECT * FROM jobs WHERE id = ?", id);
  return row ? rowToJob(row) : null;
}

export interface JobQuery {
  keywords?: string;
  sources?: string[];
  remoteType?: string;
  employmentTypes?: string[];
  seniority?: string[];
  salaryMin?: number;
  worldwideOnly?: boolean;
  includeDuplicates?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: "recent" | "salary" | "title";
}

export function queryJobs(query: JobQuery): { jobs: NormalizedJob[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];

  if (!query.includeDuplicates) where.push("duplicate_of IS NULL");
  if (query.keywords?.trim()) {
    where.push("(LOWER(title) LIKE ? OR LOWER(company_name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(skills_json) LIKE ?)");
    const pattern = `%${query.keywords.trim().toLowerCase()}%`;
    params.push(pattern, pattern, pattern, pattern);
  }
  if (query.sources?.length) {
    where.push(`source IN (${query.sources.map(() => "?").join(",")})`);
    params.push(...query.sources);
  }
  if (query.remoteType) {
    where.push("remote_type = ?");
    params.push(query.remoteType);
  }
  if (query.employmentTypes?.length) {
    where.push(`employment_type IN (${query.employmentTypes.map(() => "?").join(",")})`);
    params.push(...query.employmentTypes);
  }
  if (query.seniority?.length) {
    where.push(`seniority IN (${query.seniority.map(() => "?").join(",")})`);
    params.push(...query.seniority);
  }
  if (query.salaryMin) {
    where.push("(salary_annualized IS NULL OR salary_annualized >= ?)");
    params.push(query.salaryMin);
  }
  if (query.worldwideOnly) where.push("worldwide = 1");

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order =
    query.orderBy === "salary"
      ? "ORDER BY salary_annualized DESC NULLS LAST"
      : query.orderBy === "title"
        ? "ORDER BY title ASC"
        : "ORDER BY COALESCE(published_at, retrieved_at) DESC";

  const total =
    get<{ count: number }>(`SELECT COUNT(*) AS count FROM jobs ${clause}`, ...params)?.count ?? 0;
  const rows = all<JobRow>(
    `SELECT * FROM jobs ${clause} ${order} LIMIT ? OFFSET ?`,
    ...params,
    Math.min(query.limit ?? 50, 200),
    query.offset ?? 0,
  );

  return { jobs: rows.map(rowToJob), total };
}

export function jobStats(): {
  total: number;
  bySource: { source: string; count: number }[];
  duplicates: number;
  last24h: number;
} {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  return {
    total: get<{ count: number }>("SELECT COUNT(*) AS count FROM jobs")?.count ?? 0,
    bySource: all<{ source: string; count: number }>(
      "SELECT source, COUNT(*) AS count FROM jobs WHERE duplicate_of IS NULL GROUP BY source ORDER BY count DESC",
    ),
    duplicates:
      get<{ count: number }>("SELECT COUNT(*) AS count FROM jobs WHERE duplicate_of IS NOT NULL")
        ?.count ?? 0,
    last24h:
      get<{ count: number }>("SELECT COUNT(*) AS count FROM jobs WHERE created_at >= ?", since)
        ?.count ?? 0,
  };
}

/** Limpieza de ofertas viejas para que la base local no crezca sin control. */
export function purgeOldJobs(days: number): number {
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  return run(
    `DELETE FROM jobs
     WHERE COALESCE(published_at, retrieved_at) < ?
       AND id NOT IN (SELECT job_id FROM applications)
       AND id NOT IN (SELECT job_id FROM job_matches)`,
    cutoff,
  ).changes;
}
