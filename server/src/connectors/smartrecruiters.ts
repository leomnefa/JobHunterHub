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
 * SmartRecruiters - Posting API publica:
 *   GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings
 *   GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{id}
 *   GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{uuid}/configuration
 *
 * La configuracion expone screening questions, preguntas de diversidad y
 * politicas de privacidad. El envio de candidaturas usa OAuth 2.0 con el scope
 * candidate_applications_manage.
 */

const API_BASE = "https://api.smartrecruiters.com/v1/companies";

interface SmartRecruitersPosting {
  id: string;
  uuid?: string;
  name: string;
  jobAdId?: string;
  refNumber?: string;
  releasedDate?: string;
  company?: { identifier?: string; name?: string };
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  industry?: { id?: string; label?: string };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
  customField?: { fieldLabel?: string; valueLabel?: string }[];
  ref?: string;
  applyUrl?: string;
  jobAd?: {
    sections?: Record<string, { title?: string; text?: string }>;
  };
}

interface PostingsResponse {
  offset?: number;
  limit?: number;
  totalFound?: number;
  content?: SmartRecruitersPosting[];
}

interface PostingConfiguration {
  screeningQuestions?: {
    questions?: {
      id: string;
      field?: { label?: string; required?: boolean; kind?: string };
      required?: boolean;
      label?: string;
    }[];
  };
}

const SEARCH_CAPS = capabilities({ search: true, jobDetails: true, applicationForm: true, customQuestions: true });
const APPLY_CAPS = capabilities({
  search: true,
  jobDetails: true,
  applicationForm: true,
  apply: true,
  oauth: true,
  resumeUpload: true,
  coverLetterUpload: true,
  customQuestions: true,
  applicationStatus: true,
});

function buildDescription(posting: SmartRecruitersPosting): string {
  const sections = posting.jobAd?.sections ?? {};
  return Object.values(sections)
    .map((section) => `${section?.title ?? ""}\n${stripHtml(section?.text ?? "")}`.trim())
    .filter(Boolean)
    .join("\n\n");
}

function mapJob(posting: SmartRecruitersPosting, company: string, canApply: boolean): NormalizedJob {
  const description = buildDescription(posting);
  const location = [posting.location?.city, posting.location?.region, posting.location?.country]
    .filter(Boolean)
    .join(", ");

  return {
    id: buildJobId("smartrecruiters", `${company}:${posting.id}`),
    source: "smartrecruiters",
    sourceJobId: `${company}:${posting.id}`,
    sourceUrl:
      posting.applyUrl ?? `https://jobs.smartrecruiters.com/${company}/${posting.id}`,
    title: posting.name,
    company: { name: posting.company?.name ?? company },
    description,
    location,
    country: posting.location?.country,
    remoteType: posting.location?.remote ? "remote" : normalizeRemoteType(location, posting.name),
    worldwide: false,
    employmentType: normalizeEmploymentType(posting.typeOfEmployment?.label),
    seniority: normalizeSeniority(posting.experienceLevel?.label, posting.name),
    skills: extractSkills(`${posting.name} ${description}`),
    categories: [posting.department?.label, posting.function?.label, posting.industry?.label].filter(
      (value): value is string => Boolean(value),
    ),
    publishedAt: toIsoDate(posting.releasedDate),
    retrievedAt: new Date().toISOString(),
    applicationUrl: posting.applyUrl,
    applicationMethod: canApply ? "api" : "external",
    connectorCapabilities: canApply ? APPLY_CAPS : SEARCH_CAPS,
    rawData: posting,
  };
}

function splitJobId(externalJobId: string): { company: string; postingId: string } {
  const index = externalJobId.indexOf(":");
  if (index < 0) return { company: "", postingId: externalJobId };
  return { company: externalJobId.slice(0, index), postingId: externalJobId.slice(index + 1) };
}

export const smartRecruitersConnector: JobConnector = {
  id: "smartrecruiters",
  name: "SmartRecruiters",
  homepage: "https://www.smartrecruiters.com",
  docsUrl: "https://developers.smartrecruiters.com/reference/postings",
  category: "ats",
  mode: "API_APPLICATION",
  restrictions: [
    "La Posting API de lectura es publica; el envio de candidaturas requiere OAuth 2.0 con scope candidate_applications_manage.",
    "El token de acceso se guarda cifrado en el backend y nunca se envia al frontend.",
  ],
  settingsSchema: [
    {
      key: "companies",
      label: "Identificadores de empresa",
      type: "list",
      required: true,
      placeholder: "smartrecruiters, empresa2",
      help: "Aparece en jobs.smartrecruiters.com/{companyId}",
    },
    { key: "access_token", label: "OAuth access token", type: "secret", required: false },
    { key: "refresh_token", label: "OAuth refresh token", type: "secret", required: false },
    { key: "client_id", label: "Client ID", type: "secret", required: false },
    { key: "client_secret", label: "Client Secret", type: "secret", required: false },
  ],
  rateLimit: { requestsPerMinute: 20, requestsPerHour: 400 },

  getCapabilities: () => APPLY_CAPS,
  isConfigured: (settings) => settingList(settings, "companies").length > 0,

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const companies = settingList(ctx.settings, "companies");
    if (companies.length === 0) {
      return { jobs: [], warnings: ["SmartRecruiters sin configurar: cargue al menos una empresa."] };
    }

    const canApply = Boolean(ctx.settings.access_token);
    const warnings: string[] = [];
    const jobs: NormalizedJob[] = [];
    const limit = Math.min(params.limit ?? 100, 100);

    for (const company of companies) {
      try {
        const url = new URL(`${API_BASE}/${encodeURIComponent(company)}/postings`);
        url.searchParams.set("limit", String(limit));
        if (params.keywords?.length) url.searchParams.set("q", params.keywords.join(" "));
        if (params.countries?.length) url.searchParams.set("country", params.countries[0]);

        const response = await ctx.fetchJson<PostingsResponse>(url.toString());
        for (const posting of response.content ?? []) {
          jobs.push(mapJob(posting, company, canApply));
        }
      } catch (error) {
        warnings.push(
          `Empresa "${company}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      jobs: applyClientFilters(jobs, {
        excludedKeywords: params.excludedKeywords,
        salaryMin: params.salaryMin,
      }).slice(0, params.limit ?? 100),
      totalAvailable: jobs.length,
      warnings,
    };
  },

  async getJob(externalJobId, ctx) {
    const { company, postingId } = splitJobId(externalJobId);
    if (!company) return null;
    const posting = await ctx.fetchJson<SmartRecruitersPosting>(
      `${API_BASE}/${encodeURIComponent(company)}/postings/${encodeURIComponent(postingId)}`,
    );
    return mapJob(posting, company, Boolean(ctx.settings.access_token));
  },

  async getApplicationForm(externalJobId, ctx): Promise<ApplicationForm> {
    const { company, postingId } = splitJobId(externalJobId);
    const fields: ApplicationFormField[] = [
      { id: "firstName", label: "Nombre", type: "text", required: true },
      { id: "lastName", label: "Apellido", type: "text", required: true },
      { id: "email", label: "Email", type: "email", required: true },
      { id: "phoneNumber", label: "Telefono", type: "phone", required: false },
      { id: "resume", label: "CV", type: "file", required: true },
    ];
    const notes: string[] = [];

    try {
      const configuration = await ctx.fetchJson<PostingConfiguration>(
        `${API_BASE}/${encodeURIComponent(company)}/postings/${encodeURIComponent(postingId)}/configuration`,
      );
      for (const question of configuration.screeningQuestions?.questions ?? []) {
        fields.push({
          id: question.id,
          label: question.field?.label ?? question.label ?? question.id,
          type: question.field?.kind === "boolean" ? "boolean" : "text",
          required: Boolean(question.required ?? question.field?.required),
        });
      }
    } catch (error) {
      notes.push(
        `No se pudo leer la configuracion del posting: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!ctx.settings.access_token) {
      notes.push("Sin OAuth access token el envio automatico no esta habilitado.");
    }

    return { jobId: externalJobId, source: "smartrecruiters", fields, authoritative: true, notes };
  },

  async submitApplication(externalJobId, application, ctx): Promise<ApplicationResult> {
    const token = ctx.settings.access_token;
    if (!token) {
      return {
        status: "REQUIRES_USER_ACTION",
        message:
          "SmartRecruiters requiere OAuth 2.0 con scope candidate_applications_manage para enviar candidaturas.",
      };
    }

    const { company, postingId } = splitJobId(externalJobId);
    try {
      const raw = await ctx.fetchText(
        `${API_BASE}/${encodeURIComponent(company)}/postings/${encodeURIComponent(postingId)}/candidates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firstName: application.firstName,
            lastName: application.lastName,
            email: application.email,
            phoneNumber: application.phone,
            location: application.location ? { city: application.location } : undefined,
            web: {
              linkedin: application.linkedin,
              website: application.portfolio,
            },
            answers: Object.entries(application.answers ?? {})
              .filter(([, value]) => value && value !== "UNKNOWN")
              .map(([questionId, value]) => ({ questionId, value })),
          }),
        },
      );
      return { status: "SUBMITTED", message: "Candidatura enviada a SmartRecruiters.", raw };
    } catch (error) {
      return { status: "FAILED", message: error instanceof Error ? error.message : String(error) };
    }
  },

  async healthCheck(ctx) {
    const companies = settingList(ctx.settings, "companies");
    if (companies.length === 0) {
      return notConfigured("smartrecruiters", "Sin empresas configuradas.");
    }
    return pingHealth(
      "smartrecruiters",
      `${API_BASE}/${encodeURIComponent(companies[0])}/postings?limit=1`,
      ctx,
    );
  },
};
