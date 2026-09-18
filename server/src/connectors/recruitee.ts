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
 * Recruitee - feed publico de ofertas por empresa:
 *   GET https://{company}.recruitee.com/api/offers/
 *
 * Solo lectura. La postulacion se realiza en la careers page de la empresa.
 */

interface RecruiteeOffer {
  id: number;
  slug?: string;
  title: string;
  description?: string;
  requirements?: string;
  location?: string;
  city?: string;
  country?: string;
  country_code?: string;
  remote?: boolean;
  employment_type_code?: string;
  employment_type?: string;
  experience_code?: string;
  department?: string;
  category?: string;
  careers_url?: string;
  careers_apply_url?: string;
  published_at?: string;
  created_at?: string;
  tags?: string[];
  min_hours?: number;
  max_hours?: number;
}

interface RecruiteeResponse {
  offers?: RecruiteeOffer[];
}

const CAPS = capabilities({ search: true, jobDetails: true });

function mapJob(offer: RecruiteeOffer, tenant: string): NormalizedJob {
  const description = [offer.description, offer.requirements]
    .filter(Boolean)
    .map((part) => stripHtml(part))
    .join("\n\n");
  const location = offer.location ?? [offer.city, offer.country].filter(Boolean).join(", ");
  const url =
    offer.careers_apply_url ??
    offer.careers_url ??
    `https://${tenant}.recruitee.com/o/${offer.slug ?? offer.id}`;

  return {
    id: buildJobId("recruitee", `${tenant}:${offer.id}`),
    source: "recruitee",
    sourceJobId: `${tenant}:${offer.id}`,
    sourceUrl: url,
    title: offer.title,
    company: { name: tenant, website: `https://${tenant}.recruitee.com` },
    description,
    location,
    country: offer.country ?? offer.country_code,
    remoteType: offer.remote ? "remote" : normalizeRemoteType(location, offer.title),
    worldwide: false,
    employmentType: normalizeEmploymentType(offer.employment_type_code ?? offer.employment_type),
    seniority: normalizeSeniority(offer.experience_code, offer.title),
    skills: extractSkills(`${offer.title} ${description}`, offer.tags ?? []),
    categories: [offer.department, offer.category].filter((value): value is string => Boolean(value)),
    publishedAt: toIsoDate(offer.published_at ?? offer.created_at),
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: offer,
  };
}

export const recruiteeConnector = createTenantAtsConnector({
  id: "recruitee",
  name: "Recruitee",
  homepage: "https://recruitee.com",
  docsUrl: "https://docs.recruitee.com/reference/offers",
  tenantSettingKey: "companies",
  tenantPlaceholder: "empresa1, empresa2",
  tenantLabel: "empresas",
  tenantHelp: "Subdominio que aparece en {empresa}.recruitee.com",
  rateLimit: { requestsPerMinute: 15, requestsPerHour: 250 },
  restrictions: ["Feed publico de solo lectura; la postulacion se completa en la careers page."],
  feedUrl: (tenant) => `https://${encodeURIComponent(tenant)}.recruitee.com/api/offers/`,
  parse: (body, tenant) => {
    const response = JSON.parse(body) as RecruiteeResponse;
    return (response.offers ?? []).map((offer) => mapJob(offer, tenant));
  },
});
