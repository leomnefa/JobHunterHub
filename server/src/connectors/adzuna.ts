import {
  applyClientFilters,
  buildJobId,
  extractSkills,
  normalizeEmploymentType,
  normalizeRemoteType,
  normalizeSeniority,
  stripHtml,
  toIsoDate,
} from "../core/normalize.ts";
import type { JobConnector, JobSearchResult, NormalizedJob } from "../core/types.ts";
import { capabilities, notConfigured, pingHealth, requireSettings } from "./base.ts";

/**
 * Adzuna - https://developer.adzuna.com/
 * API REST oficial. Requiere app_id + app_key (se cargan desde el panel ADMIN
 * o desde .env; nunca viajan al frontend).
 *
 * Endpoint de busqueda:
 *   GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
 */

const API_BASE = "https://api.adzuna.com/v1/api/jobs";
const DEFAULT_COUNTRY = "gb";

/** Codigos de pais soportados por Adzuna (segun su portal de desarrolladores). */
const SUPPORTED_COUNTRIES = new Set([
  "at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb",
  "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za",
]);

interface AdzunaResult {
  id: string;
  title: string;
  description?: string;
  redirect_url: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string; tag?: string };
  contract_type?: string;
  contract_time?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
}

interface AdzunaResponse {
  count?: number;
  results?: AdzunaResult[];
}

const CAPS = capabilities({ search: true, jobDetails: true, apiKey: true });

function mapJob(job: AdzunaResult, country: string): NormalizedJob {
  const description = stripHtml(job.description ?? "");
  const location = job.location?.display_name ?? "";
  const contract = [job.contract_type, job.contract_time].filter(Boolean).join(" ");

  return {
    id: buildJobId("adzuna", job.id),
    source: "adzuna",
    sourceJobId: job.id,
    sourceUrl: job.redirect_url,
    title: job.title,
    company: { name: job.company?.display_name ?? "Sin especificar" },
    description,
    location,
    country: job.location?.area?.[0] ?? country.toUpperCase(),
    remoteType: normalizeRemoteType(location, job.title, description.slice(0, 600)),
    worldwide: false,
    employmentType: normalizeEmploymentType(contract),
    seniority: normalizeSeniority(job.title),
    salary:
      job.salary_min || job.salary_max
        ? {
            min: job.salary_min,
            max: job.salary_max,
            currency: country === "us" ? "USD" : country === "gb" ? "GBP" : "EUR",
            period: "year",
          }
        : undefined,
    skills: extractSkills(`${job.title} ${description}`),
    categories: job.category?.label ? [job.category.label] : [],
    publishedAt: toIsoDate(job.created),
    retrievedAt: new Date().toISOString(),
    applicationUrl: job.redirect_url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: job,
  };
}

function resolveCountry(settings: Record<string, string>, requested?: string[]): string {
  const candidate = (requested?.[0] ?? settings.country ?? DEFAULT_COUNTRY)
    .toLowerCase()
    .slice(0, 2);
  return SUPPORTED_COUNTRIES.has(candidate) ? candidate : DEFAULT_COUNTRY;
}

export const adzunaConnector: JobConnector = {
  id: "adzuna",
  name: "Adzuna",
  homepage: "https://www.adzuna.com",
  docsUrl: "https://developer.adzuna.com/",
  category: "aggregator",
  mode: "SEARCH_ONLY",
  attribution: "Ofertas provistas por Adzuna",
  restrictions: [
    "Requiere app_id y app_key propios, sujetos a los limites del plan contratado.",
    "Las credenciales nunca deben exponerse en el frontend.",
  ],
  settingsSchema: [
    { key: "app_id", label: "App ID", type: "secret", required: true, help: "developer.adzuna.com" },
    { key: "app_key", label: "App Key", type: "secret", required: true },
    {
      key: "country",
      label: "Pais por defecto",
      type: "text",
      required: false,
      placeholder: "gb",
      help: "Codigo ISO de 2 letras: us, gb, es, de, br, mx, ...",
    },
  ],
  rateLimit: { requestsPerMinute: 25, requestsPerHour: 250 },

  getCapabilities: () => CAPS,
  isConfigured: (settings) => requireSettings(settings, ["app_id", "app_key"]),

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const { app_id: appId, app_key: appKey } = ctx.settings;
    if (!appId || !appKey) {
      return { jobs: [], warnings: ["Adzuna no esta configurado: faltan app_id / app_key."] };
    }

    const country = resolveCountry(ctx.settings, params.countries);
    const page = params.page && params.page > 0 ? params.page : 1;
    const url = new URL(`${API_BASE}/${country}/search/${page}`);
    url.searchParams.set("app_id", appId);
    url.searchParams.set("app_key", appKey);
    url.searchParams.set("results_per_page", String(Math.min(params.limit ?? 50, 50)));
    url.searchParams.set("content-type", "application/json");
    if (params.keywords?.length) url.searchParams.set("what", params.keywords.join(" "));
    if (params.excludedKeywords?.length) {
      url.searchParams.set("what_exclude", params.excludedKeywords.join(" "));
    }
    if (params.location) url.searchParams.set("where", params.location);
    if (params.salaryMin) url.searchParams.set("salary_min", String(params.salaryMin));
    if (params.company) url.searchParams.set("company", params.company);
    if (params.employmentTypes?.includes("full_time")) url.searchParams.set("full_time", "1");
    if (params.employmentTypes?.includes("part_time")) url.searchParams.set("part_time", "1");
    if (params.employmentTypes?.includes("contract")) url.searchParams.set("contract", "1");

    const response = await ctx.fetchJson<AdzunaResponse>(url.toString());
    const jobs = (response.results ?? []).map((job) => mapJob(job, country));

    return {
      jobs: applyClientFilters(jobs, { excludedKeywords: params.excludedKeywords }),
      totalAvailable: response.count,
      warnings: params.remoteOnly
        ? ["Adzuna no distingue remoto de forma nativa; se infiere del texto de la oferta."]
        : undefined,
    };
  },

  async healthCheck(ctx) {
    const { app_id: appId, app_key: appKey } = ctx.settings;
    if (!appId || !appKey) {
      return notConfigured("adzuna", "Faltan credenciales app_id / app_key.");
    }
    const country = resolveCountry(ctx.settings);
    const url = `${API_BASE}/${country}/search/1?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}&results_per_page=1`;
    return pingHealth("adzuna", url, ctx);
  },
};
