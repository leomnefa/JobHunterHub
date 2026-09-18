import {
  applyClientFilters,
  buildJobId,
  extractSkills,
  isWorldwide,
  normalizeEmploymentType,
  normalizeSalaryPeriod,
  normalizeSeniority,
  stripHtml,
  toIsoDate,
} from "../core/normalize.ts";
import type { JobConnector, JobSearchResult, NormalizedJob } from "../core/types.ts";
import { capabilities, pingHealth } from "./base.ts";

/**
 * Himalayas - https://himalayas.app/api
 * Endpoints publicos verificados: GET /jobs/api y GET /jobs/api/search
 * Sin autenticacion. Maximo 20 trabajos por request. Paginacion por cursor
 * (el offset esta deprecado segun el aviso de la propia API).
 *
 * RESTRICCION: Himalayas prohibe redistribuir sus ofertas a Google Jobs,
 * LinkedIn Jobs, Jooble y similares. Requiere atribucion visible.
 */

const API_BASE = "https://himalayas.app/jobs/api";
const MAX_LIMIT = 20;

interface HimalayasJob {
  title: string;
  excerpt?: string;
  description?: string;
  companyName: string;
  companySlug?: string;
  companyLogo?: string;
  employmentType?: string;
  minSalary?: number;
  maxSalary?: number;
  salaryPeriod?: string;
  currency?: string;
  seniority?: string[];
  locationRestrictions?: string[];
  timezoneRestrictions?: number[];
  categories?: string[];
  parentCategories?: string[];
  pubDate?: number;
  expiryDate?: number;
  applicationLink: string;
  guid: string;
}

interface HimalayasResponse {
  offset?: number;
  limit?: number;
  totalCount?: number;
  nextCursor?: string;
  jobs: HimalayasJob[];
}

const CAPS = capabilities({ search: true, jobDetails: true });

function mapJob(job: HimalayasJob): NormalizedJob {
  const description = stripHtml(job.description ?? job.excerpt ?? "");
  const location = job.locationRestrictions?.length
    ? job.locationRestrictions.join(", ")
    : "Worldwide";
  const categories = [...(job.categories ?? []), ...(job.parentCategories ?? [])];

  return {
    id: buildJobId("himalayas", job.guid),
    source: "himalayas",
    sourceJobId: job.guid,
    sourceUrl: job.applicationLink,
    title: job.title,
    company: {
      name: job.companyName,
      website: job.companySlug ? `https://himalayas.app/companies/${job.companySlug}` : undefined,
      logoUrl: job.companyLogo,
    },
    description,
    location,
    country: job.locationRestrictions?.[0],
    remoteType: "remote",
    worldwide: !job.locationRestrictions?.length || isWorldwide(location),
    employmentType: normalizeEmploymentType(job.employmentType),
    seniority: normalizeSeniority(job.seniority?.join(" "), job.title),
    salary:
      job.minSalary || job.maxSalary
        ? {
            min: job.minSalary,
            max: job.maxSalary,
            currency: job.currency ?? "USD",
            period: normalizeSalaryPeriod(job.salaryPeriod),
          }
        : undefined,
    skills: extractSkills(`${job.title} ${description}`, job.categories ?? []),
    categories,
    publishedAt: toIsoDate(job.pubDate),
    expiresAt: toIsoDate(job.expiryDate),
    retrievedAt: new Date().toISOString(),
    applicationUrl: job.applicationLink,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: job,
  };
}

export const himalayasConnector: JobConnector = {
  id: "himalayas",
  name: "Himalayas",
  homepage: "https://himalayas.app",
  docsUrl: "https://himalayas.app/api",
  category: "job_board",
  mode: "SEARCH_ONLY",
  attribution: "Ofertas provistas por Himalayas (himalayas.app)",
  restrictions: [
    "Prohibido redistribuir las ofertas a Google Jobs, LinkedIn Jobs, Jooble o agregadores similares.",
    "Requiere atribucion visible a Himalayas junto a los resultados.",
    "Maximo 20 ofertas por request; usar cursor para paginar.",
  ],
  settingsSchema: [],
  rateLimit: { requestsPerMinute: 20, requestsPerHour: 400 },

  getCapabilities: () => CAPS,
  isConfigured: () => true,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const keywords = (params.keywords ?? []).join(" ").trim();
    const warnings: string[] = [];
    // /jobs/api/search acepta busqueda por texto; /jobs/api entrega el feed general.
    const url = new URL(keywords ? `${API_BASE}/search` : API_BASE);
    url.searchParams.set("limit", String(Math.min(params.limit ?? MAX_LIMIT, MAX_LIMIT)));
    if (keywords) url.searchParams.set("query", keywords);
    if (params.cursor) url.searchParams.set("cursor", params.cursor);
    if (params.countries?.length) url.searchParams.set("country", params.countries[0]);
    if (params.worldwideOnly) url.searchParams.set("worldwide", "true");
    if (params.company) url.searchParams.set("company", params.company);

    if ((params.limit ?? 0) > MAX_LIMIT) {
      warnings.push(`Himalayas limita a ${MAX_LIMIT} ofertas por request.`);
    }

    const response = await ctx.fetchJson<HimalayasResponse>(url.toString());
    const jobs = (response.jobs ?? []).map(mapJob);

    return {
      jobs: applyClientFilters(jobs, {
        excludedKeywords: params.excludedKeywords,
        salaryMin: params.salaryMin,
      }),
      nextCursor: response.nextCursor,
      totalAvailable: response.totalCount,
      warnings,
    };
  },

  async getJob(externalJobId, ctx) {
    const url = new URL(`${API_BASE}/search`);
    url.searchParams.set("limit", String(MAX_LIMIT));
    url.searchParams.set("query", externalJobId);
    const response = await ctx.fetchJson<HimalayasResponse>(url.toString());
    const job = (response.jobs ?? []).find((item) => item.guid === externalJobId);
    return job ? mapJob(job) : null;
  },

  healthCheck: (ctx) => pingHealth("himalayas", `${API_BASE}?limit=1`, ctx),
};
