import {
  buildJobId,
  extractSkills,
  normalizeEmploymentType,
  normalizeRemoteType,
  normalizeSeniority,
  stripHtml,
  toIsoDate,
} from "../core/normalize.ts";
import { capabilities, decodeXml, xmlTagValue, xmlTagValues } from "./base.ts";
import { createTenantAtsConnector } from "./ats-common.ts";
import type { NormalizedJob } from "../core/types.ts";

/**
 * Personio - feed XML publico de la careers page:
 *   GET https://{company}.jobs.personio.de/xml
 *
 * Estructura verificada: <workzag-jobs><position>...</position></workzag-jobs>
 * Solo lectura; la postulacion se realiza en la careers page de la empresa.
 */

const CAPS = capabilities({ search: true, jobDetails: true });

function mapPosition(xml: string, tenant: string): NormalizedJob | null {
  const id = xmlTagValue(xml, "id");
  const title = xmlTagValue(xml, "name");
  if (!id || !title) return null;

  const office = xmlTagValue(xml, "office") ?? "";
  const department = xmlTagValue(xml, "department") ?? "";
  const employmentType = xmlTagValue(xml, "employmentType") ?? "";
  const seniority = xmlTagValue(xml, "seniority") ?? "";
  const schedule = xmlTagValue(xml, "schedule") ?? "";
  const description = xmlTagValues(xml, "jobDescription")
    .map((block) => {
      const name = xmlTagValue(block, "name") ?? "";
      const value = stripHtml(decodeXml(xmlTagValue(block, "value") ?? ""));
      return `${name}\n${value}`.trim();
    })
    .join("\n\n");
  const url =
    xmlTagValue(xml, "jobUrl") ??
    `https://${tenant}.jobs.personio.de/job/${id}`;

  return {
    id: buildJobId("personio", `${tenant}:${id}`),
    source: "personio",
    sourceJobId: `${tenant}:${id}`,
    sourceUrl: url,
    title,
    company: {
      name: xmlTagValue(xml, "subcompany") ?? tenant,
      website: `https://${tenant}.jobs.personio.de`,
    },
    description,
    location: office,
    country: office.split(",").pop()?.trim(),
    remoteType: normalizeRemoteType(office, title, description.slice(0, 600)),
    worldwide: false,
    employmentType: normalizeEmploymentType(`${employmentType} ${schedule}`),
    seniority: normalizeSeniority(seniority, title),
    skills: extractSkills(`${title} ${description}`),
    categories: department ? [department] : [],
    publishedAt: toIsoDate(xmlTagValue(xml, "createdAt")),
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: { xml: xml.slice(0, 4000) },
  };
}

export const personioConnector = createTenantAtsConnector({
  id: "personio",
  name: "Personio",
  homepage: "https://www.personio.com",
  docsUrl: "https://developer.personio.de/docs/using-the-xml-feed",
  tenantSettingKey: "companies",
  tenantLabel: "empresas",
  tenantPlaceholder: "personio, empresa2",
  tenantHelp: "Subdominio que aparece en {empresa}.jobs.personio.de",
  rateLimit: { requestsPerMinute: 10, requestsPerHour: 150 },
  restrictions: ["Feed XML publico de solo lectura; la postulacion ocurre en la careers page."],
  feedUrl: (tenant) => `https://${encodeURIComponent(tenant)}.jobs.personio.de/xml`,
  parse: (body, tenant) =>
    xmlTagValues(body, "position")
      .map((position) => mapPosition(position, tenant))
      .filter((job): job is NormalizedJob => job !== null),
});
