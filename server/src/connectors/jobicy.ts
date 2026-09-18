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
 * Jobicy - https://jobicy.com/api/v2/remote-jobs
 * API publica sin key. Hasta 200 ofertas por request.
 * La propia respuesta pide credito visible y que los botones de postulacion
 * apunten a la URL original de la oferta.
 */

const API_BASE = "https://jobicy.com/api/v2/remote-jobs";
const MAX_COUNT = 200;

interface JobicyJob {
  id: number;
  url: string;
  jobSlug?: string;
  jobTitle: string;
  companyName: string;
  companyLogo?: string;
  jobIndustry?: string[] | string;
  jobType?: string[] | string;
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: number | null;
  annualSalaryMax?: number | null;
  salaryCurrency?: string | null;
}

interface JobicyResponse {
  jobCount?: number;
  jobs?: JobicyJob[];
}

const CAPS = capabilities({ search: true, jobDetails: true });

function asArray(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mapJob(job: JobicyJob): NormalizedJob {
  const description = stripHtml(job.jobDescription ?? job.jobExcerpt ?? "");
  const geo = job.jobGeo || "Worldwide";
  const industries = asArray(job.jobIndustry);

  return {
    id: buildJobId("jobicy", String(job.id)),
    source: "jobicy",
    sourceJobId: String(job.id),
    sourceUrl: job.url,
    title: job.jobTitle,
    company: { name: job.companyName, logoUrl: job.companyLogo },
    description,
    location: geo,
    country: geo,
    remoteType: "remote",
    worldwide: isWorldwide(geo),
    employmentType: normalizeEmploymentType(asArray(job.jobType)[0]),
    seniority: normalizeSeniority(job.jobLevel, job.jobTitle),
    salary:
      job.annualSalaryMin || job.annualSalaryMax
        ? {
            min: job.annualSalaryMin ?? undefined,
            max: job.annualSalaryMax ?? undefined,
            currency: job.salaryCurrency ?? "USD",
            period: "year",
          }
        : undefined,
    skills: extractSkills(`${job.jobTitle} ${description}`, industries),
    categories: industries,
    publishedAt: toIsoDate(job.pubDate),
    retrievedAt: new Date().toISOString(),
    applicationUrl: job.url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: job,
  };
}

export const jobicyConnector: JobConnector = {
  id: "jobicy",
  name: "Jobicy",
  homepage: "https://jobicy.com",
  docsUrl: "https://jobi.cy/apidocs",
  category: "job_board",
  mode: "SEARCH_ONLY",
  attribution: "Ofertas provistas por Jobicy (jobicy.com)",
  restrictions: [
    "Debe acreditarse a Jobicy con un enlace directo a la fuente.",
    "Los botones de postulacion deben redirigir a la URL original de la oferta.",
  ],
  settingsSchema: [],
  rateLimit: { requestsPerMinute: 15, requestsPerHour: 300 },

  getCapabilities: () => CAPS,
  isConfigured: () => true,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const url = new URL(API_BASE);
    url.searchParams.set("count", String(Math.min(params.limit ?? 50, MAX_COUNT)));
    const keywords = (params.keywords ?? []).join(" ").trim();
    if (keywords) url.searchParams.set("tag", keywords);
    if (params.countries?.length) {
      url.searchParams.set("geo", params.countries[0].toLowerCase().replace(/\s+/g, "-"));
    }

    const response = await ctx.fetchJson<JobicyResponse>(url.toString());
    const jobs = (response.jobs ?? []).map(mapJob);

    return {
      jobs: applyClientFilters(jobs, {
        excludedKeywords: params.excludedKeywords,
        salaryMin: params.salaryMin,
      }),
      totalAvailable: response.jobCount,
    };
  },

  async getJob(externalJobId, ctx) {
    const url = new URL(API_BASE);
    url.searchParams.set("count", String(MAX_COUNT));
    const response = await ctx.fetchJson<JobicyResponse>(url.toString());
    const job = (response.jobs ?? []).find((item) => String(item.id) === externalJobId);
    return job ? mapJob(job) : null;
  },

  healthCheck: (ctx) => pingHealth("jobicy", `${API_BASE}?count=1`, ctx),
};
