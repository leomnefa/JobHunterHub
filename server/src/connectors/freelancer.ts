import {
  applyClientFilters,
  buildJobId,
  extractSkills,
  stripHtml,
  toIsoDate,
} from "../core/normalize.ts";
import type { JobConnector, JobSearchResult, NormalizedJob } from "../core/types.ts";
import { capabilities, notConfigured, pingHealth } from "./base.ts";

/**
 * Freelancer.com - API oficial:
 *   GET https://www.freelancer.com/api/projects/0.1/projects/active/
 *   Cabecera: freelancer-oauth-v1: <access token>
 *
 * El envio de propuestas (bids) esta documentado en /api/projects/0.1/bids/ y
 * exige un token con los permisos correspondientes. Mientras no haya token con
 * permiso de escritura, el connector reporta REQUIRES_USER_ACTION en vez de
 * simular una postulacion.
 */

const API_BASE = "https://www.freelancer.com/api/projects/0.1";

interface FreelancerProject {
  id: number;
  title: string;
  seo_url?: string;
  description?: string;
  preview_description?: string;
  type?: string;
  status?: string;
  submitdate?: number;
  time_submitted?: number;
  currency?: { code?: string };
  budget?: { minimum?: number; maximum?: number };
  jobs?: { id: number; name: string }[];
  location?: { country?: { name?: string }; city?: string };
  bid_stats?: { bid_count?: number; bid_avg?: number };
}

interface FreelancerResponse {
  status?: string;
  result?: { projects?: FreelancerProject[]; total_count?: number };
  message?: string;
}

const CAPS = capabilities({
  search: true,
  jobDetails: true,
  oauth: true,
  apiKey: true,
});

function mapProject(project: FreelancerProject): NormalizedJob {
  const description = stripHtml(project.description ?? project.preview_description ?? "");
  const skills = (project.jobs ?? []).map((job) => job.name);
  const url = project.seo_url
    ? `https://www.freelancer.com/projects/${project.seo_url}`
    : `https://www.freelancer.com/projects/${project.id}`;

  return {
    id: buildJobId("freelancer", String(project.id)),
    source: "freelancer",
    sourceJobId: String(project.id),
    sourceUrl: url,
    title: project.title,
    company: { name: "Cliente de Freelancer.com" },
    description,
    location: project.location?.country?.name ?? "Remoto",
    country: project.location?.country?.name,
    remoteType: "remote",
    worldwide: true,
    employmentType: "freelance",
    seniority: "unknown",
    salary: project.budget
      ? {
          min: project.budget.minimum,
          max: project.budget.maximum,
          currency: project.currency?.code ?? "USD",
          period: project.type === "hourly" ? "hour" : "project",
        }
      : undefined,
    skills: extractSkills(`${project.title} ${description}`, skills),
    categories: skills,
    publishedAt: toIsoDate(project.submitdate ?? project.time_submitted),
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: project,
  };
}

export const freelancerConnector: JobConnector = {
  id: "freelancer",
  name: "Freelancer.com",
  homepage: "https://www.freelancer.com",
  docsUrl: "https://developers.freelancer.com/docs",
  category: "freelance",
  mode: "HUMAN_REQUIRED",
  restrictions: [
    "Requiere OAuth token propio. El envio de bids necesita permisos de escritura explicitos.",
    "No se envian propuestas automaticas sin token con permiso verificado.",
  ],
  settingsSchema: [
    {
      key: "oauth_token",
      label: "OAuth access token",
      type: "secret",
      required: true,
      help: "Se envia en la cabecera freelancer-oauth-v1.",
    },
    {
      key: "sandbox",
      label: "Usar sandbox",
      type: "text",
      required: false,
      placeholder: "false",
      help: "true para apuntar a la API de pruebas de Freelancer.",
    },
  ],
  rateLimit: { requestsPerMinute: 10, requestsPerHour: 200 },

  getCapabilities: () => CAPS,
  isConfigured: (settings) => Boolean(settings.oauth_token?.trim()),

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const token = ctx.settings.oauth_token;
    if (!token) {
      return {
        jobs: [],
        warnings: ["Freelancer sin configurar: falta el OAuth access token."],
      };
    }

    const base =
      ctx.settings.sandbox === "true"
        ? "https://www.freelancer-sandbox.com/api/projects/0.1"
        : API_BASE;
    const url = new URL(`${base}/projects/active/`);
    url.searchParams.set("limit", String(Math.min(params.limit ?? 30, 100)));
    url.searchParams.set("job_details", "true");
    url.searchParams.set("full_description", "true");
    if (params.keywords?.length) url.searchParams.set("query", params.keywords.join(" "));

    const response = await ctx.fetchJson<FreelancerResponse>(url.toString(), {
      headers: { "freelancer-oauth-v1": token },
    });

    const jobs = (response.result?.projects ?? []).map(mapProject);
    return {
      jobs: applyClientFilters(jobs, { excludedKeywords: params.excludedKeywords }),
      totalAvailable: response.result?.total_count,
    };
  },

  async getJob(externalJobId, ctx) {
    const token = ctx.settings.oauth_token;
    if (!token) return null;
    const response = await ctx.fetchJson<{ result?: FreelancerProject }>(
      `${API_BASE}/projects/${encodeURIComponent(externalJobId)}/?full_description=true&job_details=true`,
      { headers: { "freelancer-oauth-v1": token } },
    );
    return response.result ? mapProject(response.result) : null;
  },

  async submitApplication() {
    return {
      status: "REQUIRES_USER_ACTION" as const,
      message:
        "El envio de bids en Freelancer requiere un token con permisos de escritura verificados. Revise y envie la propuesta manualmente.",
    };
  },

  async healthCheck(ctx) {
    const token = ctx.settings.oauth_token;
    if (!token) return notConfigured("freelancer", "Falta el OAuth access token.");
    return pingHealth("freelancer", `${API_BASE}/projects/active/?limit=1`, ctx, {
      headers: { "freelancer-oauth-v1": token },
    });
  },
};
