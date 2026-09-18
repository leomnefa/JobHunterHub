import {
  applyClientFilters,
  buildJobId,
  extractSkills,
  normalizeRemoteType,
  normalizeSeniority,
  stripHtml,
} from "../core/normalize.ts";
import type { JobConnector, JobSearchResult, NormalizedJob } from "../core/types.ts";
import { capabilities, notConfigured, settingList } from "./base.ts";

/**
 * Workday - NO existe una API universal publica de postulacion.
 *
 * Cada empresa expone su propio career site (tenant). El endpoint CXS que usa
 * el propio sitio de carreras acepta POST con paginacion:
 *
 *   POST https://{tenant}.{wdN}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
 *   body: { "appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "" }
 *
 * La integracion es POR EMPRESA y solo de lectura. La postulacion requiere el
 * flujo propio del tenant (cuenta de candidato), por lo que se marca como
 * BROWSER_APPLICATION / HUMAN_REQUIRED y se deriva al usuario.
 */

const PAGE_SIZE = 20;

interface WorkdayPosting {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

interface WorkdayResponse {
  total?: number;
  jobPostings?: WorkdayPosting[];
}

const CAPS = capabilities({
  search: true,
  jobDetails: false,
  browserAutomationRequired: true,
});

/** "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite" -> partes CXS. */
interface TenantConfig {
  raw: string;
  origin: string;
  tenant: string;
  site: string;
}

export function parseWorkdaySite(entry: string): TenantConfig | null {
  try {
    const url = new URL(entry.trim());
    const host = url.hostname; // {tenant}.wdN.myworkdayjobs.com
    const tenant = host.split(".")[0];
    const segments = url.pathname.split("/").filter(Boolean);
    // La ruta puede incluir el locale: /en-US/SiteName
    const site = segments[segments.length - 1];
    if (!tenant || !site) return null;
    return { raw: entry, origin: url.origin, tenant, site };
  } catch {
    return null;
  }
}

function mapJob(posting: WorkdayPosting, config: TenantConfig): NormalizedJob {
  const jobPath = posting.externalPath.startsWith("/")
    ? posting.externalPath
    : `/${posting.externalPath}`;
  const url = `${config.origin}/${config.site}${jobPath}`;
  const requisition = posting.bulletFields?.[0] ?? jobPath;
  const location = posting.locationsText ?? "";

  return {
    id: buildJobId("workday", `${config.tenant}:${requisition}`),
    source: "workday",
    sourceJobId: `${config.tenant}:${requisition}`,
    sourceUrl: url,
    title: posting.title,
    company: { name: config.tenant, website: config.origin },
    // El endpoint de listado no entrega la descripcion completa.
    description: stripHtml(`${posting.title}. Ubicaciones: ${location}. Publicado: ${posting.postedOn ?? "s/d"}.`),
    location,
    remoteType: normalizeRemoteType(location, posting.title),
    worldwide: false,
    employmentType: "unknown",
    seniority: normalizeSeniority(posting.title),
    skills: extractSkills(posting.title),
    categories: [],
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "browser",
    connectorCapabilities: CAPS,
    rawData: posting,
  };
}

export const workdayConnector: JobConnector = {
  id: "workday",
  name: "Workday",
  homepage: "https://www.workday.com",
  docsUrl: "https://community.workday.com/",
  category: "ats",
  mode: "BROWSER_APPLICATION",
  restrictions: [
    "No existe una API publica universal de postulacion en Workday: la integracion es por empresa/tenant.",
    "Solo se consulta el endpoint que utiliza la propia career site, sin scraping agresivo y respetando rate limits.",
    "La postulacion requiere el flujo propio del tenant (cuenta de candidato): se deriva al usuario.",
  ],
  settingsSchema: [
    {
      key: "sites",
      label: "Career sites",
      type: "list",
      required: true,
      placeholder: "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite",
      help: "URL completa del career site de cada empresa, una por linea.",
    },
  ],
  rateLimit: { requestsPerMinute: 6, requestsPerHour: 100 },

  getCapabilities: () => CAPS,
  isConfigured: (settings) => settingList(settings, "sites").length > 0,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const entries = settingList(ctx.settings, "sites");
    if (entries.length === 0) {
      return { jobs: [], warnings: ["Workday sin configurar: cargue al menos un career site."] };
    }

    const warnings: string[] = [];
    const jobs: NormalizedJob[] = [];
    const searchText = (params.keywords ?? []).join(" ").trim();
    const wanted = Math.min(params.limit ?? 40, 100);

    for (const entry of entries) {
      const config = parseWorkdaySite(entry);
      if (!config) {
        warnings.push(`Career site invalido: "${entry}"`);
        continue;
      }

      try {
        let offset = 0;
        while (jobs.length < wanted && offset < 200) {
          const response = await ctx.fetchJson<WorkdayResponse>(
            `${config.origin}/wday/cxs/${config.tenant}/${config.site}/jobs`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                appliedFacets: {},
                limit: PAGE_SIZE,
                offset,
                searchText,
              }),
            },
          );
          const postings = response.jobPostings ?? [];
          for (const posting of postings) jobs.push(mapJob(posting, config));
          if (postings.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }
      } catch (error) {
        warnings.push(
          `Career site "${config.tenant}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    warnings.push(
      "Workday entrega descripciones resumidas en el listado: abra la oferta original para el detalle completo.",
    );

    return {
      jobs: applyClientFilters(jobs, {
        excludedKeywords: params.excludedKeywords,
      }).slice(0, wanted),
      totalAvailable: jobs.length,
      warnings,
    };
  },

  async healthCheck(ctx) {
    const entries = settingList(ctx.settings, "sites");
    if (entries.length === 0) return notConfigured("workday", "Sin career sites configurados.");
    const config = parseWorkdaySite(entries[0]);
    if (!config) return notConfigured("workday", `Career site invalido: ${entries[0]}`);

    const started = Date.now();
    try {
      await ctx.fetchJson<WorkdayResponse>(
        `${config.origin}/wday/cxs/${config.tenant}/${config.site}/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
        },
      );
      return {
        connector: "workday",
        status: "ONLINE",
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        connector: "workday",
        status: "OFFLINE",
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
