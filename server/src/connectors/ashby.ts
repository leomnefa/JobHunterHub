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
import type {
  ApplicationForm,
  ApplicationResult,
  JobConnector,
  JobSearchResult,
  NormalizedJob,
} from "../core/types.ts";
import { capabilities, notConfigured, pingHealth, settingList } from "./base.ts";

/**
 * Ashby - Job Posting API publica:
 *   GET https://api.ashbyhq.com/posting-api/job-board/{jobBoardName}?includeCompensation=true
 *
 * El envio de candidaturas usa la API privada (applicationForm.submit), que
 * exige una API key con permiso candidatesWrite. Una API publica de lectura NO
 * habilita automaticamente el envio: mientras no haya key, el connector reporta
 * REQUIRES_USER_ACTION.
 */

const PUBLIC_BASE = "https://api.ashbyhq.com/posting-api/job-board";
const PRIVATE_BASE = "https://api.ashbyhq.com";

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  publishedAt?: string;
  isListed?: boolean;
  isRemote?: boolean;
  descriptionHtml?: string;
  descriptionPlain?: string;
  jobUrl?: string;
  applyUrl?: string;
  compensation?: {
    compensationTierSummary?: string;
    summaryComponents?: {
      summary?: string;
      minValue?: number;
      maxValue?: number;
      currencyCode?: string;
      interval?: string;
    }[];
  };
}

interface AshbyBoardResponse {
  jobs?: AshbyJob[];
}

const SEARCH_CAPS = capabilities({ search: true, jobDetails: true });
const APPLY_CAPS = capabilities({
  search: true,
  jobDetails: true,
  applicationForm: true,
  apply: true,
  apiKey: true,
  resumeUpload: true,
  coverLetterUpload: true,
  customQuestions: true,
});

const INTERVAL_MAP: Record<string, "hour" | "month" | "year"> = {
  HOURLY: "hour",
  MONTHLY: "month",
  YEARLY: "year",
  ANNUAL: "year",
};

function mapJob(job: AshbyJob, board: string, canApply: boolean): NormalizedJob {
  const description = stripHtml(job.descriptionPlain ?? job.descriptionHtml ?? "");
  const locations = [job.location, ...(job.secondaryLocations ?? []).map((l) => l.location)]
    .filter(Boolean)
    .join(", ");
  const component = job.compensation?.summaryComponents?.[0];

  return {
    id: buildJobId("ashby", `${board}:${job.id}`),
    source: "ashby",
    sourceJobId: `${board}:${job.id}`,
    sourceUrl: job.jobUrl ?? `https://jobs.ashbyhq.com/${board}/${job.id}`,
    title: job.title,
    company: { name: board, website: `https://jobs.ashbyhq.com/${board}` },
    description,
    location: locations,
    country: job.location?.split(",").pop()?.trim(),
    remoteType: job.isRemote ? "remote" : normalizeRemoteType(locations, job.title),
    worldwide: false,
    employmentType: normalizeEmploymentType(job.employmentType),
    seniority: normalizeSeniority(job.title),
    salary: component
      ? {
          min: component.minValue,
          max: component.maxValue,
          currency: component.currencyCode,
          period: INTERVAL_MAP[(component.interval ?? "").toUpperCase()] ?? "unknown",
        }
      : undefined,
    skills: extractSkills(`${job.title} ${description}`),
    categories: [job.department, job.team].filter((value): value is string => Boolean(value)),
    publishedAt: toIsoDate(job.publishedAt),
    retrievedAt: new Date().toISOString(),
    applicationUrl: job.applyUrl ?? job.jobUrl,
    applicationMethod: canApply ? "api" : "external",
    connectorCapabilities: canApply ? APPLY_CAPS : SEARCH_CAPS,
    rawData: job,
  };
}

function splitJobId(externalJobId: string): { board: string; jobId: string } {
  const index = externalJobId.indexOf(":");
  if (index < 0) return { board: "", jobId: externalJobId };
  return { board: externalJobId.slice(0, index), jobId: externalJobId.slice(index + 1) };
}

export const ashbyConnector: JobConnector = {
  id: "ashby",
  name: "Ashby",
  homepage: "https://www.ashbyhq.com",
  docsUrl: "https://developers.ashbyhq.com/reference/introduction",
  category: "ats",
  mode: "API_APPLICATION",
  restrictions: [
    "El job board publico no requiere autenticacion, pero applicationForm.submit exige API key con permiso candidatesWrite.",
    "No se asume que la lectura publica habilite el envio de candidaturas.",
  ],
  settingsSchema: [
    {
      key: "job_boards",
      label: "Job boards",
      type: "list",
      required: true,
      placeholder: "ramp, notion",
      help: "Nombre que aparece en jobs.ashbyhq.com/{board}",
    },
    {
      key: "api_key",
      label: "API key (candidatesWrite)",
      type: "secret",
      required: false,
      help: "Necesaria unicamente para enviar candidaturas.",
    },
  ],
  rateLimit: { requestsPerMinute: 20, requestsPerHour: 300 },

  getCapabilities: () => APPLY_CAPS,
  isConfigured: (settings) => settingList(settings, "job_boards").length > 0,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const boards = settingList(ctx.settings, "job_boards");
    if (boards.length === 0) {
      return { jobs: [], warnings: ["Ashby sin configurar: cargue al menos un job board."] };
    }

    const canApply = Boolean(ctx.settings.api_key);
    const warnings: string[] = [];
    const jobs: NormalizedJob[] = [];

    for (const board of boards) {
      try {
        const response = await ctx.fetchJson<AshbyBoardResponse>(
          `${PUBLIC_BASE}/${encodeURIComponent(board)}?includeCompensation=true`,
        );
        for (const job of response.jobs ?? []) {
          if (job.isListed === false) continue;
          jobs.push(mapJob(job, board, canApply));
        }
      } catch (error) {
        warnings.push(`Board "${board}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const filtered = applyClientFilters(jobs, {
      keywords: params.keywords,
      excludedKeywords: params.excludedKeywords,
      salaryMin: params.salaryMin,
    });

    return { jobs: filtered.slice(0, params.limit ?? 100), totalAvailable: jobs.length, warnings };
  },

  async getJob(externalJobId, ctx) {
    const { board, jobId } = splitJobId(externalJobId);
    if (!board) return null;
    const response = await ctx.fetchJson<AshbyBoardResponse>(
      `${PUBLIC_BASE}/${encodeURIComponent(board)}?includeCompensation=true`,
    );
    const job = (response.jobs ?? []).find((item) => item.id === jobId);
    return job ? mapJob(job, board, Boolean(ctx.settings.api_key)) : null;
  },

  async getApplicationForm(externalJobId, ctx): Promise<ApplicationForm> {
    const apiKey = ctx.settings.api_key;
    const { jobId } = splitJobId(externalJobId);

    if (!apiKey) {
      return {
        jobId: externalJobId,
        source: "ashby",
        fields: [],
        authoritative: false,
        notes: [
          "El formulario real de Ashby solo se obtiene con API key. Sin credenciales, complete la postulacion en el formulario original.",
        ],
      };
    }

    try {
      const response = await ctx.fetchJson<{
        results?: { fields?: { path: string; title: string; isRequired: boolean; type: string }[] };
      }>(`${PRIVATE_BASE}/applicationForm.info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify({ jobPostingId: jobId }),
      });

      return {
        jobId: externalJobId,
        source: "ashby",
        fields: (response.results?.fields ?? []).map((field) => ({
          id: field.path,
          label: field.title,
          type: field.type === "File" ? "file" : field.type === "LongText" ? "textarea" : "text",
          required: field.isRequired,
        })),
        authoritative: true,
      };
    } catch (error) {
      return {
        jobId: externalJobId,
        source: "ashby",
        fields: [],
        authoritative: false,
        notes: [`No se pudo obtener el formulario: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  },

  async submitApplication(externalJobId, application, ctx): Promise<ApplicationResult> {
    const apiKey = ctx.settings.api_key;
    if (!apiKey) {
      return {
        status: "REQUIRES_USER_ACTION",
        message:
          "Ashby requiere API key con permiso candidatesWrite para enviar candidaturas por API.",
      };
    }

    const { jobId } = splitJobId(externalJobId);
    const form = new FormData();
    form.set("jobPostingId", jobId);
    form.set(
      "applicationForm",
      JSON.stringify({
        fieldSubmissions: [
          { path: "_systemfield_name", value: application.fullName ?? application.email },
          { path: "_systemfield_email", value: application.email },
          ...Object.entries(application.answers ?? {})
            .filter(([, value]) => value && value !== "UNKNOWN")
            .map(([path, value]) => ({ path, value })),
        ],
      }),
    );
    if (application.resume) {
      form.set(
        "_systemfield_resume",
        new Blob([application.resume.content], { type: application.resume.contentType }),
        application.resume.filename,
      );
    }

    try {
      const raw = await ctx.fetchText(`${PRIVATE_BASE}/applicationForm.submit`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
        body: form,
      });
      return { status: "SUBMITTED", message: "Candidatura enviada a Ashby.", raw };
    } catch (error) {
      return { status: "FAILED", message: error instanceof Error ? error.message : String(error) };
    }
  },

  async healthCheck(ctx) {
    const boards = settingList(ctx.settings, "job_boards");
    if (boards.length === 0) return notConfigured("ashby", "Sin job boards configurados.");
    return pingHealth("ashby", `${PUBLIC_BASE}/${encodeURIComponent(boards[0])}`, ctx);
  },
};
