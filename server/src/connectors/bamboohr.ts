import {
  buildJobId,
  extractSkills,
  normalizeEmploymentType,
  normalizeRemoteType,
  normalizeSeniority,
  stripHtml,
  toIsoDate,
} from "../core/normalize.ts";
import { capabilities } from "./base.ts";
import { createTenantAtsConnector } from "./ats-common.ts";
import type { NormalizedJob } from "../core/types.ts";

/**
 * BambooHR - listado publico de la careers page:
 *   GET https://{company}.bamboohr.com/careers/list
 *
 * Devuelve { meta, result[] }. El mapeo es defensivo porque BambooHR no publica
 * un contrato formal para este endpoint: se prueban varios nombres de campo y
 * se descarta la oferta si no hay id o titulo.
 * Solo lectura; la postulacion ocurre en la careers page.
 */

interface BambooJob {
  id?: string | number;
  jobOpeningId?: string | number;
  jobOpeningName?: string;
  title?: string;
  departmentLabel?: string;
  department?: string;
  employmentStatusLabel?: string;
  employmentStatus?: string;
  isRemote?: boolean | string;
  location?: { city?: string; state?: string; country?: string } | string;
  atsLocation?: { city?: string; state?: string; country?: string };
  postedDate?: string;
  datePosted?: string;
  jobDescription?: string;
  description?: string;
}

interface BambooResponse {
  meta?: { totalCount?: number };
  result?: BambooJob[];
}

const CAPS = capabilities({ search: true, jobDetails: true });

function formatLocation(job: BambooJob): string {
  if (typeof job.location === "string") return job.location;
  const source = job.location ?? job.atsLocation;
  if (!source) return "";
  return [source.city, source.state, source.country].filter(Boolean).join(", ");
}

function mapJob(job: BambooJob, tenant: string): NormalizedJob | null {
  const id = job.id ?? job.jobOpeningId;
  const title = job.jobOpeningName ?? job.title;
  if (id === undefined || !title) return null;

  const description = stripHtml(job.jobDescription ?? job.description ?? "");
  const location = formatLocation(job);
  const department = job.departmentLabel ?? job.department;
  const url = `https://${tenant}.bamboohr.com/careers/${id}`;
  const remote = job.isRemote === true || job.isRemote === "true" || job.isRemote === "1";

  return {
    id: buildJobId("bamboohr", `${tenant}:${id}`),
    source: "bamboohr",
    sourceJobId: `${tenant}:${id}`,
    sourceUrl: url,
    title,
    company: { name: tenant, website: `https://${tenant}.bamboohr.com/careers` },
    description,
    location,
    country: typeof job.location === "object" ? job.location?.country : undefined,
    remoteType: remote ? "remote" : normalizeRemoteType(location, title),
    worldwide: false,
    employmentType: normalizeEmploymentType(job.employmentStatusLabel ?? job.employmentStatus),
    seniority: normalizeSeniority(title),
    skills: extractSkills(`${title} ${description}`),
    categories: department ? [department] : [],
    publishedAt: toIsoDate(job.postedDate ?? job.datePosted),
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: job,
  };
}

export const bambooHrConnector = createTenantAtsConnector({
  id: "bamboohr",
  name: "BambooHR",
  homepage: "https://www.bamboohr.com",
  docsUrl: "https://documentation.bamboohr.com/reference/get-applicant-tracking-jobs",
  tenantSettingKey: "companies",
  tenantLabel: "empresas",
  tenantPlaceholder: "empresa1, empresa2",
  tenantHelp: "Subdominio que aparece en {empresa}.bamboohr.com/careers",
  rateLimit: { requestsPerMinute: 10, requestsPerHour: 150 },
  restrictions: [
    "El listado publico de careers no tiene contrato documentado: el mapeo es defensivo y puede requerir ajuste por tenant.",
    "La postulacion se completa en la careers page de la empresa.",
  ],
  feedUrl: (tenant) => `https://${encodeURIComponent(tenant)}.bamboohr.com/careers/list`,
  parse: (body, tenant) => {
    const response = JSON.parse(body) as BambooResponse;
    return (response.result ?? [])
      .map((job) => mapJob(job, tenant))
      .filter((job): job is NormalizedJob => job !== null);
  },
});
