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
 * Breezy HR - feed publico de la careers page:
 *   GET https://{company}.breezy.hr/json
 *
 * Estructura verificada: array plano de posiciones publicadas.
 * Solo lectura; la postulacion se completa en el portal de la empresa.
 */

interface BreezyPosition {
  id: string;
  friendly_id?: string;
  name: string;
  url?: string;
  published_date?: string;
  type?: { id?: string; name?: string };
  experience?: { id?: string; name?: string };
  education?: string;
  location?: {
    name?: string;
    city?: string;
    country?: { id?: string; name?: string };
    is_remote?: boolean;
  };
  department?: string;
  description?: string;
  category?: { id?: string; name?: string };
  tags?: string[];
}

const CAPS = capabilities({ search: true, jobDetails: true });

function mapJob(position: BreezyPosition, tenant: string): NormalizedJob {
  const description = stripHtml(position.description ?? "");
  const location =
    position.location?.name ??
    [position.location?.city, position.location?.country?.name].filter(Boolean).join(", ");
  const url = position.url ?? `https://${tenant}.breezy.hr/p/${position.friendly_id ?? position.id}`;

  return {
    id: buildJobId("breezy", `${tenant}:${position.id}`),
    source: "breezy",
    sourceJobId: `${tenant}:${position.id}`,
    sourceUrl: url,
    title: position.name,
    company: { name: tenant, website: `https://${tenant}.breezy.hr` },
    description,
    location,
    country: position.location?.country?.name,
    remoteType: position.location?.is_remote
      ? "remote"
      : normalizeRemoteType(location, position.name),
    worldwide: false,
    employmentType: normalizeEmploymentType(position.type?.name),
    seniority: normalizeSeniority(position.experience?.name, position.name),
    skills: extractSkills(`${position.name} ${description}`, position.tags ?? []),
    categories: [position.department, position.category?.name].filter(
      (value): value is string => Boolean(value),
    ),
    publishedAt: toIsoDate(position.published_date),
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: position,
  };
}

export const breezyConnector = createTenantAtsConnector({
  id: "breezy",
  name: "Breezy HR",
  homepage: "https://breezy.hr",
  docsUrl: "https://developer.breezy.hr/docs",
  tenantSettingKey: "companies",
  tenantLabel: "empresas",
  tenantPlaceholder: "breezy, empresa2",
  tenantHelp: "Subdominio que aparece en {empresa}.breezy.hr",
  rateLimit: { requestsPerMinute: 12, requestsPerHour: 200 },
  restrictions: ["Feed publico de solo lectura; la postulacion se completa en el portal de Breezy."],
  feedUrl: (tenant) => `https://${encodeURIComponent(tenant)}.breezy.hr/json`,
  parse: (body, tenant) => {
    const positions = JSON.parse(body) as BreezyPosition[];
    return (Array.isArray(positions) ? positions : []).map((position) => mapJob(position, tenant));
  },
});
