import {
  buildJobId,
  extractSkills,
  normalizeRemoteType,
  normalizeSeniority,
  stripHtml,
  toIsoDate,
} from "../core/normalize.ts";
import { capabilities } from "./base.ts";
import { createTenantAtsConnector } from "./ats-common.ts";
import type { NormalizedJob } from "../core/types.ts";

/**
 * Teamtailor - API publica JSON:API:
 *   GET https://api.teamtailor.com/v1/jobs
 *   Cabeceras obligatorias: Authorization: Token token=<API_KEY>, X-Api-Version: <fecha>
 *
 * La API key la emite cada empresa desde su cuenta de Teamtailor. Sin key el
 * connector queda NOT_CONFIGURED: no existe feed publico sin autenticacion.
 */

const API_VERSION = "20210218";

interface TeamtailorJob {
  id: string;
  attributes?: {
    title?: string;
    body?: string;
    "apply-button-text"?: string;
    "careersite-job-url"?: string;
    "created-at"?: string;
    "start-date"?: string;
    status?: string;
    remote?: boolean;
    "remote-status"?: string;
    pitch?: string;
    tags?: string[];
  };
  relationships?: unknown;
}

interface TeamtailorResponse {
  data?: TeamtailorJob[];
}

const CAPS = capabilities({ search: true, jobDetails: true, apiKey: true });

function mapJob(job: TeamtailorJob, tenant: string): NormalizedJob | null {
  const attributes = job.attributes ?? {};
  const title = attributes.title;
  if (!title) return null;

  const description = stripHtml(attributes.body ?? attributes.pitch ?? "");
  const url = attributes["careersite-job-url"] ?? `https://${tenant}.teamtailor.com/jobs/${job.id}`;

  return {
    id: buildJobId("teamtailor", `${tenant}:${job.id}`),
    source: "teamtailor",
    sourceJobId: `${tenant}:${job.id}`,
    sourceUrl: url,
    title,
    company: { name: tenant, website: `https://${tenant}.teamtailor.com` },
    description,
    location: attributes["remote-status"] ?? "",
    remoteType: attributes.remote
      ? "remote"
      : normalizeRemoteType(attributes["remote-status"], title),
    worldwide: false,
    employmentType: "unknown",
    seniority: normalizeSeniority(title),
    skills: extractSkills(`${title} ${description}`, attributes.tags ?? []),
    categories: attributes.tags ?? [],
    publishedAt: toIsoDate(attributes["created-at"]),
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: job,
  };
}

export const teamtailorConnector = createTenantAtsConnector({
  id: "teamtailor",
  name: "Teamtailor",
  homepage: "https://www.teamtailor.com",
  docsUrl: "https://docs.teamtailor.com/",
  tenantSettingKey: "companies",
  tenantLabel: "empresas",
  tenantPlaceholder: "empresa1",
  tenantHelp: "Subdominio de la careers page: {empresa}.teamtailor.com",
  extraSettings: [
    {
      key: "api_key",
      label: "API key de Teamtailor",
      type: "secret",
      required: true,
      help: "Obligatoria: Teamtailor no publica un feed sin autenticacion.",
    },
  ],
  caps: { apiKey: true },
  rateLimit: { requestsPerMinute: 10, requestsPerHour: 120 },
  restrictions: [
    "Requiere API key emitida por la empresa duena de la cuenta.",
    "El envio de candidaturas no esta implementado: se deriva al portal de la empresa.",
  ],
  feedUrl: () => "https://api.teamtailor.com/v1/jobs?page[size]=100",
  headers: (ctx) =>
    ctx.settings.api_key
      ? {
          Authorization: `Token token=${ctx.settings.api_key}`,
          "X-Api-Version": API_VERSION,
          Accept: "application/vnd.api+json",
        }
      : undefined,
  parse: (body, tenant) => {
    const response = JSON.parse(body) as TeamtailorResponse;
    return (response.data ?? [])
      .map((job) => mapJob(job, tenant))
      .filter((job): job is NormalizedJob => job !== null);
  },
});
