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
 * Remotive - https://remotive.com/api/remote-jobs
 * Feed publico sin autenticacion.
 *
 * RESTRICCION declarada por la propia API: no enviar las ofertas de Remotive a
 * terceros como Jooble, Neuvoo, Google Jobs o LinkedIn Jobs, y enlazar siempre
 * de vuelta a la URL original.
 */

const API_BASE = "https://remotive.com/api/remote-jobs";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveResponse {
  "job-count"?: number;
  jobs?: RemotiveJob[];
}

const CAPS = capabilities({ search: true, jobDetails: true });

/** Remotive entrega el salario como texto libre ("$50,000 - $70,000"). */
function parseSalaryText(text?: string): NormalizedJob["salary"] {
  if (!text) return undefined;
  const numbers = text.match(/\d[\d.,]*/g);
  if (!numbers?.length) return undefined;
  const values = numbers
    .map((value) => Number(value.replace(/[.,]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return undefined;
  const currency = /eur|€/i.test(text) ? "EUR" : /gbp|£/i.test(text) ? "GBP" : "USD";
  const period = /hour|hr\b|\/h/i.test(text) ? "hour" : /month|\/mo/i.test(text) ? "month" : "year";
  return {
    min: values[0],
    max: values.length > 1 ? values[1] : undefined,
    currency,
    period,
  };
}

function mapJob(job: RemotiveJob): NormalizedJob {
  const description = stripHtml(job.description ?? "");
  const location = job.candidate_required_location || "Worldwide";

  return {
    id: buildJobId("remotive", String(job.id)),
    source: "remotive",
    sourceJobId: String(job.id),
    sourceUrl: job.url,
    title: job.title,
    company: { name: job.company_name, logoUrl: job.company_logo },
    description,
    location,
    country: location,
    remoteType: "remote",
    worldwide: isWorldwide(location),
    employmentType: normalizeEmploymentType(job.job_type),
    seniority: normalizeSeniority(job.title),
    salary: parseSalaryText(job.salary),
    skills: extractSkills(`${job.title} ${description}`, job.tags ?? []),
    categories: job.category ? [job.category] : [],
    publishedAt: toIsoDate(job.publication_date),
    retrievedAt: new Date().toISOString(),
    applicationUrl: job.url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: job,
  };
}

export const remotiveConnector: JobConnector = {
  id: "remotive",
  name: "Remotive",
  homepage: "https://remotive.com",
  docsUrl: "https://github.com/remotive-com/remote-jobs-api",
  category: "job_board",
  mode: "SEARCH_ONLY",
  attribution: "Ofertas provistas por Remotive (remotive.com)",
  restrictions: [
    "Prohibido enviar las ofertas a terceros como Jooble, Neuvoo, Google Jobs o LinkedIn Jobs.",
    "Debe enlazarse siempre a la URL original de la oferta en Remotive.",
  ],
  settingsSchema: [],
  rateLimit: { requestsPerMinute: 10, requestsPerHour: 120 },

  getCapabilities: () => CAPS,
  isConfigured: () => true,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const url = new URL(API_BASE);
    const keywords = (params.keywords ?? []).join(" ").trim();
    if (keywords) url.searchParams.set("search", keywords);
    if (params.limit) url.searchParams.set("limit", String(params.limit));

    const response = await ctx.fetchJson<RemotiveResponse>(url.toString());
    const jobs = (response.jobs ?? []).map(mapJob);

    return {
      jobs: applyClientFilters(jobs, {
        excludedKeywords: params.excludedKeywords,
        salaryMin: params.salaryMin,
      }),
      totalAvailable: response["job-count"],
    };
  },

  async getJob(externalJobId, ctx) {
    const response = await ctx.fetchJson<RemotiveResponse>(`${API_BASE}?limit=200`);
    const job = (response.jobs ?? []).find((item) => String(item.id) === externalJobId);
    return job ? mapJob(job) : null;
  },

  healthCheck: (ctx) => pingHealth("remotive", `${API_BASE}?limit=1`, ctx),
};
