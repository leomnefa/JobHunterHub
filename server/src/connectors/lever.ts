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
  JobConnector,
  JobSearchResult,
  NormalizedJob,
} from "../core/types.ts";
import { capabilities, notConfigured, pingHealth, settingList } from "./base.ts";

/**
 * Lever Postings API - https://github.com/lever/postings-api
 *
 *   GET  /v0/postings/{site}?mode=json
 *   GET  /v0/postings/{site}/{posting-id}?mode=json
 *   POST /v0/postings/{site}/{posting-id}?key={APIKEY}
 *
 * El POST esta sujeto a rate limiting agresivo por parte de Lever: el cliente
 * HTTP compartido aplica backoff exponencial y respeta Retry-After.
 */

const API_BASE = "https://api.lever.co/v0/postings";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  workplaceType?: string;
}

const SEARCH_CAPS = capabilities({ search: true, jobDetails: true, applicationForm: true });
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

function mapJob(posting: LeverPosting, site: string, canApply: boolean): NormalizedJob {
  const lists = (posting.lists ?? []).map((l) => `${l.text}\n${stripHtml(l.content)}`).join("\n\n");
  const description = [
    stripHtml(posting.descriptionPlain ?? posting.description ?? ""),
    lists,
    stripHtml(posting.additionalPlain ?? ""),
  ]
    .filter(Boolean)
    .join("\n\n");
  const location =
    posting.categories?.location ?? posting.categories?.allLocations?.join(", ") ?? "";

  return {
    id: buildJobId("lever", `${site}:${posting.id}`),
    source: "lever",
    sourceJobId: `${site}:${posting.id}`,
    sourceUrl: posting.hostedUrl,
    title: posting.text,
    company: { name: site, website: `https://jobs.lever.co/${site}` },
    description,
    location,
    country: location.split(",").pop()?.trim(),
    remoteType: normalizeRemoteType(posting.workplaceType, location, posting.text),
    worldwide: false,
    employmentType: normalizeEmploymentType(posting.categories?.commitment),
    seniority: normalizeSeniority(posting.text),
    skills: extractSkills(`${posting.text} ${description}`),
    categories: [posting.categories?.department, posting.categories?.team].filter(
      (value): value is string => Boolean(value),
    ),
    publishedAt: toIsoDate(posting.createdAt),
    retrievedAt: new Date().toISOString(),
    applicationUrl: posting.applyUrl ?? posting.hostedUrl,
    applicationMethod: canApply ? "api" : "external",
    connectorCapabilities: canApply ? APPLY_CAPS : SEARCH_CAPS,
    rawData: posting,
  };
}

function splitJobId(externalJobId: string): { site: string; postingId: string } {
  const index = externalJobId.indexOf(":");
  if (index < 0) return { site: "", postingId: externalJobId };
  return { site: externalJobId.slice(0, index), postingId: externalJobId.slice(index + 1) };
}

/**
 * Lever no publica el detalle de las preguntas personalizadas en la API publica
 * de postings. Solo se declaran los campos base documentados para el POST.
 */
const BASE_FIELDS: ApplicationFormField[] = [
  { id: "name", label: "Nombre completo", type: "text", required: true },
  { id: "email", label: "Email", type: "email", required: true },
  { id: "phone", label: "Telefono", type: "phone", required: false },
  { id: "org", label: "Empresa actual", type: "text", required: false },
  { id: "urls[LinkedIn]", label: "LinkedIn", type: "url", required: false },
  { id: "urls[GitHub]", label: "GitHub", type: "url", required: false },
  { id: "urls[Portfolio]", label: "Portfolio", type: "url", required: false },
  { id: "comments", label: "Carta de presentacion / comentarios", type: "textarea", required: false },
  { id: "resume", label: "CV", type: "file", required: true },
];

export const leverConnector: JobConnector = {
  id: "lever",
  name: "Lever",
  homepage: "https://www.lever.co",
  docsUrl: "https://github.com/lever/postings-api",
  category: "ats",
  mode: "API_APPLICATION",
  restrictions: [
    "El endpoint de creacion de candidaturas esta sujeto a rate limiting; se aplica backoff exponencial y se respeta Retry-After.",
    "Las preguntas personalizadas de cada empresa no se exponen en la API publica de postings.",
  ],
  settingsSchema: [
    {
      key: "sites",
      label: "Sites de Lever",
      type: "list",
      required: true,
      placeholder: "leverdemo, empresa2",
      help: "Identificador que aparece en jobs.lever.co/{site}",
    },
    {
      key: "api_key",
      label: "API key de postulacion",
      type: "secret",
      required: false,
      help: "Solo para enviar candidaturas por API.",
    },
  ],
  rateLimit: { requestsPerMinute: 20, requestsPerHour: 400 },

  getCapabilities: () => APPLY_CAPS,
  isConfigured: (settings) => settingList(settings, "sites").length > 0,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const sites = settingList(ctx.settings, "sites");
    if (sites.length === 0) {
      return { jobs: [], warnings: ["Lever sin configurar: cargue al menos un site."] };
    }

    const canApply = Boolean(ctx.settings.api_key);
    const warnings: string[] = [];
    const jobs: NormalizedJob[] = [];

    for (const site of sites) {
      try {
        const postings = await ctx.fetchJson<LeverPosting[]>(
          `${API_BASE}/${encodeURIComponent(site)}?mode=json&limit=100`,
        );
        for (const posting of postings) jobs.push(mapJob(posting, site, canApply));
      } catch (error) {
        warnings.push(`Site "${site}": ${error instanceof Error ? error.message : String(error)}`);
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
    const { site, postingId } = splitJobId(externalJobId);
    if (!site) return null;
    const posting = await ctx.fetchJson<LeverPosting>(
      `${API_BASE}/${encodeURIComponent(site)}/${encodeURIComponent(postingId)}?mode=json`,
    );
    return mapJob(posting, site, Boolean(ctx.settings.api_key));
  },

  async getApplicationForm(externalJobId, ctx): Promise<ApplicationForm> {
    return {
      jobId: externalJobId,
      source: "lever",
      fields: BASE_FIELDS,
      authoritative: false,
      notes: [
        "Campos base documentados por Lever. Las preguntas personalizadas de la empresa pueden requerir completar el formulario original.",
        ctx.settings.api_key ? "" : "Sin API key el envio automatico no esta habilitado.",
      ].filter(Boolean),
    };
  },

  async submitApplication(externalJobId, application, ctx): Promise<ApplicationResult> {
    const apiKey = ctx.settings.api_key;
    if (!apiKey) {
      return {
        status: "REQUIRES_USER_ACTION",
        message: "Lever requiere una API key con permiso de creacion de candidaturas.",
      };
    }

    const { site, postingId } = splitJobId(externalJobId);
    const form = new FormData();
    form.set("name", application.fullName ?? `${application.firstName ?? ""} ${application.lastName ?? ""}`.trim());
    form.set("email", application.email);
    if (application.phone) form.set("phone", application.phone);
    if (application.linkedin) form.set("urls[LinkedIn]", application.linkedin);
    if (application.github) form.set("urls[GitHub]", application.github);
    if (application.portfolio) form.set("urls[Portfolio]", application.portfolio);
    if (application.coverLetter) form.set("comments", application.coverLetter.content);
    if (application.resume) {
      form.set(
        "resume",
        new Blob([application.resume.content], { type: application.resume.contentType }),
        application.resume.filename,
      );
    }
    for (const [key, value] of Object.entries(application.answers ?? {})) {
      if (value && value !== "UNKNOWN") form.set(key, value);
    }

    try {
      const raw = await ctx.fetchText(
        `${API_BASE}/${encodeURIComponent(site)}/${encodeURIComponent(postingId)}?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", body: form },
      );
      return { status: "SUBMITTED", message: "Candidatura enviada a Lever.", raw };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: /429|rate|limite/i.test(message) ? "REQUIRES_USER_ACTION" : "FAILED",
        message,
      };
    }
  },

  async healthCheck(ctx) {
    const sites = settingList(ctx.settings, "sites");
    if (sites.length === 0) return notConfigured("lever", "Sin sites configurados.");
    return pingHealth(
      "lever",
      `${API_BASE}/${encodeURIComponent(sites[0])}?mode=json&limit=1`,
      ctx,
    );
  },
};
