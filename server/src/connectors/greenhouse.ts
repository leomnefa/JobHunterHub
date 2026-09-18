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
  ApplicationFormField,
  ApplicationResult,
  FormFieldType,
  JobConnector,
  JobSearchResult,
  NormalizedJob,
} from "../core/types.ts";
import { capabilities, notConfigured, pingHealth, settingList } from "./base.ts";

/**
 * Greenhouse Job Board API - https://docs.greenhouse.io/job-board.html
 *
 *   GET  /v1/boards/{board_token}/jobs?content=true        (publico, sin auth)
 *   GET  /v1/boards/{board_token}/jobs/{id}?questions=true (publico, sin auth)
 *   POST /v1/boards/{board_token}/jobs/{id}                (Basic Auth con API key)
 *
 * El POST de candidaturas requiere Basic Auth con la Job Board API key del
 * cliente y admite multipart/form-data. Sin esa key, el connector queda en
 * modo busqueda y deriva al usuario al formulario original.
 */

const API_BASE = "https://boards-api.greenhouse.io/v1/boards";

interface GreenhouseJob {
  id: number;
  internal_job_id?: number;
  title: string;
  updated_at?: string;
  first_published?: string;
  requisition_id?: string;
  absolute_url: string;
  location?: { name?: string };
  offices?: { name?: string; location?: string }[];
  departments?: { name?: string }[];
  metadata?: { name?: string; value?: unknown }[];
  content?: string;
  questions?: GreenhouseQuestion[];
}

interface GreenhouseQuestion {
  description?: string | null;
  label: string;
  required: boolean;
  fields: {
    name: string;
    type: string;
    values?: { label: string; value: string | number }[];
  }[];
}

interface GreenhouseListResponse {
  jobs?: GreenhouseJob[];
  meta?: { total?: number };
}

const SEARCH_CAPS = capabilities({
  search: true,
  jobDetails: true,
  applicationForm: true,
  customQuestions: true,
});

const APPLY_CAPS = capabilities({
  search: true,
  jobDetails: true,
  applicationForm: true,
  apply: true,
  customQuestions: true,
  apiKey: true,
  resumeUpload: true,
  coverLetterUpload: true,
});

function mapFieldType(greenhouseType: string): FormFieldType {
  switch (greenhouseType) {
    case "input_text":
      return "text";
    case "textarea":
      return "textarea";
    case "input_file":
      return "file";
    case "multi_value_single_select":
      return "select";
    case "multi_value_multi_select":
      return "multiselect";
    default:
      return "text";
  }
}

function mapJob(job: GreenhouseJob, boardToken: string, canApply: boolean): NormalizedJob {
  const description = stripHtml(job.content ?? "");
  const location = job.location?.name ?? job.offices?.[0]?.name ?? "";
  const departments = (job.departments ?? []).map((d) => d.name ?? "").filter(Boolean);

  return {
    id: buildJobId("greenhouse", `${boardToken}:${job.id}`),
    source: "greenhouse",
    sourceJobId: `${boardToken}:${job.id}`,
    sourceUrl: job.absolute_url,
    title: job.title,
    company: { name: boardToken, website: `https://job-boards.greenhouse.io/${boardToken}` },
    description,
    location,
    country: location.split(",").pop()?.trim(),
    remoteType: normalizeRemoteType(location, job.title, description.slice(0, 800)),
    worldwide: false,
    employmentType: normalizeEmploymentType(`${job.title} ${description.slice(0, 400)}`),
    seniority: normalizeSeniority(job.title),
    skills: extractSkills(`${job.title} ${description}`),
    categories: departments,
    publishedAt: toIsoDate(job.first_published ?? job.updated_at),
    retrievedAt: new Date().toISOString(),
    applicationUrl: job.absolute_url,
    applicationMethod: canApply ? "api" : "external",
    connectorCapabilities: canApply ? APPLY_CAPS : SEARCH_CAPS,
    rawData: job,
  };
}

function splitJobId(externalJobId: string): { boardToken: string; jobId: string } {
  const index = externalJobId.indexOf(":");
  if (index < 0) return { boardToken: "", jobId: externalJobId };
  return {
    boardToken: externalJobId.slice(0, index),
    jobId: externalJobId.slice(index + 1),
  };
}

export const greenhouseConnector: JobConnector = {
  id: "greenhouse",
  name: "Greenhouse",
  homepage: "https://www.greenhouse.io",
  docsUrl: "https://docs.greenhouse.io/job-board.html",
  category: "ats",
  mode: "API_APPLICATION",
  restrictions: [
    "La lectura del job board es publica; el envio de candidaturas exige Basic Auth con la Job Board API key del cliente.",
    "La API key jamas debe exponerse en el frontend: todo el envio pasa por el backend.",
  ],
  settingsSchema: [
    {
      key: "board_tokens",
      label: "Board tokens",
      type: "list",
      required: true,
      placeholder: "vercel, stripe, airbnb",
      help: "Un token por empresa. Aparece en la URL del job board publico.",
    },
    {
      key: "api_key",
      label: "Job Board API key",
      type: "secret",
      required: false,
      help: "Solo necesaria para ENVIAR candidaturas por API (Basic Auth).",
    },
  ],
  rateLimit: { requestsPerMinute: 30, requestsPerHour: 600 },

  getCapabilities: () => APPLY_CAPS,
  isConfigured: (settings) => settingList(settings, "board_tokens").length > 0,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const boards = settingList(ctx.settings, "board_tokens");
    if (boards.length === 0) {
      return {
        jobs: [],
        warnings: ["Greenhouse sin configurar: cargue al menos un board token en el panel ADMIN."],
      };
    }

    const canApply = Boolean(ctx.settings.api_key);
    const warnings: string[] = [];
    const jobs: NormalizedJob[] = [];

    for (const board of boards) {
      try {
        const response = await ctx.fetchJson<GreenhouseListResponse>(
          `${API_BASE}/${encodeURIComponent(board)}/jobs?content=true`,
        );
        for (const job of response.jobs ?? []) jobs.push(mapJob(job, board, canApply));
      } catch (error) {
        // Un board caido no invalida al resto.
        warnings.push(
          `Board "${board}": ${error instanceof Error ? error.message : String(error)}`,
        );
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
    const { boardToken, jobId } = splitJobId(externalJobId);
    if (!boardToken) return null;
    const job = await ctx.fetchJson<GreenhouseJob>(
      `${API_BASE}/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}?questions=true`,
    );
    return mapJob(job, boardToken, Boolean(ctx.settings.api_key));
  },

  async getApplicationForm(externalJobId, ctx): Promise<ApplicationForm> {
    const { boardToken, jobId } = splitJobId(externalJobId);
    const job = await ctx.fetchJson<GreenhouseJob>(
      `${API_BASE}/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}?questions=true`,
    );

    const fields: ApplicationFormField[] = [];
    for (const question of job.questions ?? []) {
      for (const field of question.fields) {
        fields.push({
          id: field.name,
          label: question.label,
          type: mapFieldType(field.type),
          required: question.required,
          description: question.description ? stripHtml(question.description) : undefined,
          options: field.values?.map((value) => ({
            value: String(value.value),
            label: value.label,
          })),
        });
      }
    }

    return {
      jobId: externalJobId,
      source: "greenhouse",
      fields,
      authoritative: true,
      notes: ctx.settings.api_key
        ? undefined
        : ["Sin Job Board API key configurada el envio automatico no esta disponible."],
    };
  },

  async submitApplication(externalJobId, application, ctx): Promise<ApplicationResult> {
    const apiKey = ctx.settings.api_key;
    if (!apiKey) {
      return {
        status: "REQUIRES_USER_ACTION",
        message:
          "Greenhouse requiere una Job Board API key con permiso de envio. Sin ella la postulacion debe completarse en el formulario original.",
      };
    }

    const { boardToken, jobId } = splitJobId(externalJobId);
    const form = new FormData();
    form.set("id", jobId);
    if (application.firstName) form.set("first_name", application.firstName);
    if (application.lastName) form.set("last_name", application.lastName);
    form.set("email", application.email);
    if (application.phone) form.set("phone", application.phone);
    if (application.location) form.set("location", application.location);

    if (application.resume) {
      form.set(
        "resume",
        new Blob([application.resume.content], { type: application.resume.contentType }),
        application.resume.filename,
      );
    }
    if (application.coverLetter) {
      form.set(
        "cover_letter",
        new Blob([application.coverLetter.content], { type: application.coverLetter.contentType }),
        application.coverLetter.filename,
      );
    }
    for (const [key, value] of Object.entries(application.answers ?? {})) {
      if (value && value !== "UNKNOWN") form.set(key, value);
    }

    try {
      const raw = await ctx.fetchText(
        `${API_BASE}/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          },
          body: form,
        },
      );
      return { status: "SUBMITTED", message: "Candidatura enviada a Greenhouse.", raw };
    } catch (error) {
      return {
        status: "FAILED",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async healthCheck(ctx) {
    const boards = settingList(ctx.settings, "board_tokens");
    if (boards.length === 0) {
      return notConfigured("greenhouse", "Sin board tokens configurados.");
    }
    return pingHealth(
      "greenhouse",
      `${API_BASE}/${encodeURIComponent(boards[0])}/jobs?content=false`,
      ctx,
    );
  },
};
