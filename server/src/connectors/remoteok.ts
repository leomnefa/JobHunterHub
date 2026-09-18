import {
  applyClientFilters,
  buildJobId,
  extractSkills,
  isWorldwide,
  normalizeEmploymentType,
  normalizeSeniority,
  stripHtml,
  toIsoDate,
} from "../core/normalize.ts";
import type { JobConnector, JobSearchResult, NormalizedJob } from "../core/types.ts";
import { capabilities, pingHealth } from "./base.ts";

/**
 * Remote OK - https://remoteok.com/api
 * Feed publico JSON. El primer elemento del array es un aviso legal, no una oferta.
 *
 * RESTRICCION declarada en el propio feed: hay que enlazar de vuelta a Remote OK
 * (sin nofollow) y mencionarlo como fuente, o suspenden el acceso a la API.
 */

const API_BASE = "https://remoteok.com/api";

interface RemoteOkEntry {
  id?: string | number;
  slug?: string;
  company?: string;
  company_logo?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  epoch?: number;
  salary_min?: number;
  salary_max?: number;
  legal?: string;
}

const CAPS = capabilities({ search: true, jobDetails: true });

function isJobEntry(entry: RemoteOkEntry): boolean {
  return entry.id !== undefined && Boolean(entry.position);
}

function mapJob(job: RemoteOkEntry): NormalizedJob {
  const description = stripHtml(job.description ?? "");
  const location = job.location || "Worldwide";
  const url = job.url ?? `https://remoteok.com/remote-jobs/${job.slug ?? job.id}`;

  return {
    id: buildJobId("remoteok", String(job.id)),
    source: "remoteok",
    sourceJobId: String(job.id),
    sourceUrl: url,
    title: job.position ?? "",
    company: { name: job.company ?? "Sin especificar", logoUrl: job.company_logo },
    description,
    location,
    country: location,
    remoteType: "remote",
    worldwide: isWorldwide(location),
    employmentType: normalizeEmploymentType((job.tags ?? []).join(" ")),
    seniority: normalizeSeniority(job.position, (job.tags ?? []).join(" ")),
    salary:
      job.salary_min || job.salary_max
        ? { min: job.salary_min, max: job.salary_max, currency: "USD", period: "year" }
        : undefined,
    skills: extractSkills(`${job.position ?? ""} ${description}`, job.tags ?? []),
    categories: job.tags ?? [],
    publishedAt: toIsoDate(job.date ?? job.epoch),
    retrievedAt: new Date().toISOString(),
    applicationUrl: job.apply_url ?? url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: job,
  };
}

export const remoteOkConnector: JobConnector = {
  id: "remoteok",
  name: "Remote OK",
  homepage: "https://remoteok.com",
  docsUrl: "https://remoteok.com/api",
  category: "job_board",
  mode: "SEARCH_ONLY",
  attribution: "Ofertas provistas por Remote OK (remoteok.com)",
  restrictions: [
    "Obligatorio enlazar de vuelta a Remote OK sin nofollow y mencionarlo como fuente.",
    "Prohibido usar el logo de Remote OK sin permiso escrito.",
  ],
  settingsSchema: [],
  rateLimit: { requestsPerMinute: 6, requestsPerHour: 60 },

  getCapabilities: () => CAPS,
  isConfigured: () => true,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    // El feed no acepta filtros server-side: se descarga completo y se filtra local.
    const entries = await ctx.fetchJson<RemoteOkEntry[]>(API_BASE);
    const jobs = entries.filter(isJobEntry).map(mapJob);
    const filtered = applyClientFilters(jobs, {
      keywords: params.keywords,
      excludedKeywords: params.excludedKeywords,
      salaryMin: params.salaryMin,
    });

    return {
      jobs: filtered.slice(0, params.limit ?? 50),
      totalAvailable: jobs.length,
      warnings:
        params.countries?.length || params.company
          ? ["Remote OK no soporta filtros por pais o empresa en la API; se filtro localmente."]
          : undefined,
    };
  },

  async getJob(externalJobId, ctx) {
    const entries = await ctx.fetchJson<RemoteOkEntry[]>(API_BASE);
    const job = entries.filter(isJobEntry).find((item) => String(item.id) === externalJobId);
    return job ? mapJob(job) : null;
  },

  healthCheck: (ctx) => pingHealth("remoteok", API_BASE, ctx),
};
