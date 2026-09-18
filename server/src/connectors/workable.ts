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
 * Workable - widget publico de cada cuenta:
 *   GET https://apply.workable.com/api/v1/widget/accounts/{subdomain}?details=true
 *
 * La API autenticada (SPI v3) permite mas operaciones, pero el envio de
 * candidaturas requiere token del cliente y no esta habilitado aca: la
 * postulacion se completa en el formulario original.
 */

interface WorkableJob {
  id?: string;
  shortcode?: string;
  title: string;
  full_title?: string;
  department?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: { city?: string; region?: string; country?: string; workplace_type?: string };
  telecommuting?: boolean;
  employment_type?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  published_on?: string;
  created_at?: string;
  application_url?: string;
  url?: string;
  shortlink?: string;
}

interface WorkableAccount {
  name?: string;
  jobs?: WorkableJob[];
}

const CAPS = capabilities({ search: true, jobDetails: true });

function mapJob(job: WorkableJob, tenant: string, accountName: string): NormalizedJob {
  const description = [job.description, job.requirements, job.benefits]
    .filter(Boolean)
    .map((part) => stripHtml(part))
    .join("\n\n");
  const location =
    [job.location?.city ?? job.city, job.location?.region ?? job.state, job.location?.country ?? job.country]
      .filter(Boolean)
      .join(", ");
  const code = job.shortcode ?? job.id ?? job.title;
  const url = job.application_url ?? job.url ?? job.shortlink ?? `https://apply.workable.com/${tenant}/`;

  return {
    id: buildJobId("workable", `${tenant}:${code}`),
    source: "workable",
    sourceJobId: `${tenant}:${code}`,
    sourceUrl: url,
    title: job.full_title ?? job.title,
    company: { name: accountName || tenant, website: `https://apply.workable.com/${tenant}/` },
    description,
    location,
    country: job.location?.country ?? job.country,
    remoteType: job.telecommuting
      ? "remote"
      : normalizeRemoteType(job.location?.workplace_type, location, job.title),
    worldwide: false,
    employmentType: normalizeEmploymentType(job.employment_type),
    seniority: normalizeSeniority(job.title),
    skills: extractSkills(`${job.title} ${description}`),
    categories: job.department ? [job.department] : [],
    publishedAt: toIsoDate(job.published_on ?? job.created_at),
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: job,
  };
}

export const workableConnector = createTenantAtsConnector({
  id: "workable",
  name: "Workable",
  homepage: "https://www.workable.com",
  docsUrl: "https://workable.readme.io/reference/generate-an-access-token",
  tenantSettingKey: "accounts",
  tenantLabel: "subdominios",
  tenantPlaceholder: "empresa1, empresa2",
  tenantHelp: "Subdominio que aparece en apply.workable.com/{subdominio}",
  rateLimit: { requestsPerMinute: 15, requestsPerHour: 250 },
  restrictions: [
    "El widget publico solo permite lectura. El envio de candidaturas requiere la API autenticada del cliente.",
  ],
  feedUrl: (tenant) =>
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(tenant)}?details=true`,
  parse: (body, tenant) => {
    const account = JSON.parse(body) as WorkableAccount;
    return (account.jobs ?? []).map((job) => mapJob(job, tenant, account.name ?? tenant));
  },
});
