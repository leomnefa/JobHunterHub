import { applyClientFilters, buildJobId, extractSkills, stripHtml, toIsoDate } from "../core/normalize.ts";
import type { JobConnector, JobSearchResult, NormalizedJob } from "../core/types.ts";
import { capabilities, notConfigured } from "./base.ts";

/**
 * Upwork - API GraphQL oficial: https://www.upwork.com/developer/documentation/graphql
 *
 *   POST https://api.upwork.com/graphql
 *   Authorization: Bearer <access token OAuth2>
 *
 * Upwork exige una aplicacion aprobada y OAuth 2.0. El acceso a la busqueda de
 * proyectos y al envio de propuestas depende de los permisos concedidos a esa
 * aplicacion: NO se asume que un token de lectura habilite enviar proposals.
 * Sin credenciales el connector queda NOT_CONFIGURED y no inventa resultados.
 */

const GRAPHQL_ENDPOINT = "https://api.upwork.com/graphql";

const SEARCH_QUERY = `
  query marketplaceJobPostings($marketPlaceJobFilter: MarketplaceJobFilter, $limit: Int) {
    marketplaceJobPostings(marketPlaceJobFilter: $marketPlaceJobFilter, first: $limit) {
      edges {
        node {
          id
          title
          description
          ciphertext
          duration
          engagement
          createdDateTime
          skills { name }
          amount { rawValue currency }
          hourlyBudgetMin { rawValue currency }
          hourlyBudgetMax { rawValue currency }
          client { location { country } totalHires }
        }
      }
    }
  }
`;

interface UpworkNode {
  id: string;
  title: string;
  description?: string;
  ciphertext?: string;
  duration?: string;
  engagement?: string;
  createdDateTime?: string;
  skills?: { name: string }[];
  amount?: { rawValue?: string; currency?: string };
  hourlyBudgetMin?: { rawValue?: string; currency?: string };
  hourlyBudgetMax?: { rawValue?: string; currency?: string };
  client?: { location?: { country?: string }; totalHires?: number };
}

interface UpworkResponse {
  data?: { marketplaceJobPostings?: { edges?: { node: UpworkNode }[] } };
  errors?: { message: string }[];
}

const CAPS = capabilities({ search: true, jobDetails: true, oauth: true });

function toNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapNode(node: UpworkNode): NormalizedJob {
  const description = stripHtml(node.description ?? "");
  const skills = (node.skills ?? []).map((skill) => skill.name);
  const url = node.ciphertext
    ? `https://www.upwork.com/jobs/${node.ciphertext}`
    : "https://www.upwork.com/nx/search/jobs/";
  const hourlyMin = toNumber(node.hourlyBudgetMin?.rawValue);
  const hourlyMax = toNumber(node.hourlyBudgetMax?.rawValue);
  const fixed = toNumber(node.amount?.rawValue);

  return {
    id: buildJobId("upwork", node.id),
    source: "upwork",
    sourceJobId: node.id,
    sourceUrl: url,
    title: node.title,
    company: { name: "Cliente de Upwork" },
    description,
    location: node.client?.location?.country ?? "Remoto",
    country: node.client?.location?.country,
    remoteType: "remote",
    worldwide: true,
    employmentType: "freelance",
    seniority: "unknown",
    salary:
      hourlyMin || hourlyMax
        ? {
            min: hourlyMin,
            max: hourlyMax,
            currency: node.hourlyBudgetMin?.currency ?? "USD",
            period: "hour",
          }
        : fixed
          ? { min: fixed, max: fixed, currency: node.amount?.currency ?? "USD", period: "project" }
          : undefined,
    skills: extractSkills(`${node.title} ${description}`, skills),
    categories: skills,
    publishedAt: toIsoDate(node.createdDateTime),
    retrievedAt: new Date().toISOString(),
    applicationUrl: url,
    applicationMethod: "external",
    connectorCapabilities: CAPS,
    rawData: node,
  };
}

export const upworkConnector: JobConnector = {
  id: "upwork",
  name: "Upwork",
  homepage: "https://www.upwork.com",
  docsUrl: "https://www.upwork.com/developer/documentation/graphql/api/docs/index.html",
  category: "freelance",
  mode: "HUMAN_REQUIRED",
  restrictions: [
    "Requiere una aplicacion aprobada por Upwork y OAuth 2.0 con los scopes concedidos a esa aplicacion.",
    "El envio de proposals depende de permisos explicitos: no se asume disponible por tener lectura.",
    "Las credenciales se guardan cifradas en el backend y nunca llegan al frontend.",
  ],
  settingsSchema: [
    { key: "access_token", label: "OAuth access token", type: "secret", required: true },
    { key: "refresh_token", label: "OAuth refresh token", type: "secret", required: false },
    { key: "client_id", label: "Client ID", type: "secret", required: false },
    { key: "client_secret", label: "Client Secret", type: "secret", required: false },
    {
      key: "organization_uid",
      label: "Organization UID",
      type: "text",
      required: false,
      help: "Se envia como cabecera X-Upwork-API-TenantId cuando la cuenta lo requiere.",
    },
  ],
  rateLimit: { requestsPerMinute: 10, requestsPerHour: 150 },

  getCapabilities: () => CAPS,
  isConfigured: (settings) => Boolean(settings.access_token?.trim()),

  async searchJobs(params, ctx): Promise<JobSearchResult> {
    const token = ctx.settings.access_token;
    if (!token) {
      return {
        jobs: [],
        warnings: [
          "Upwork sin configurar: requiere una aplicacion aprobada y un access token OAuth 2.0.",
        ],
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (ctx.settings.organization_uid) {
      headers["X-Upwork-API-TenantId"] = ctx.settings.organization_uid;
    }

    const response = await ctx.fetchJson<UpworkResponse>(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: {
          limit: Math.min(params.limit ?? 20, 50),
          marketPlaceJobFilter: {
            searchExpression_eq: (params.keywords ?? []).join(" ") || undefined,
          },
        },
      }),
    });

    if (response.errors?.length) {
      return {
        jobs: [],
        warnings: response.errors.map((error) => `Upwork: ${error.message}`),
      };
    }

    const jobs = (response.data?.marketplaceJobPostings?.edges ?? []).map((edge) =>
      mapNode(edge.node),
    );
    return { jobs: applyClientFilters(jobs, { excludedKeywords: params.excludedKeywords }) };
  },

  async submitApplication() {
    return {
      status: "REQUIRES_USER_ACTION" as const,
      message:
        "El envio de proposals en Upwork requiere permisos explicitos de la aplicacion aprobada. Revise y envie la propuesta desde Upwork.",
    };
  },

  async healthCheck(ctx) {
    const token = ctx.settings.access_token;
    if (!token) return notConfigured("upwork", "Falta el access token OAuth 2.0.");

    const started = Date.now();
    try {
      await ctx.fetchJson<UpworkResponse>(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: "{ __typename }" }),
      });
      return {
        connector: "upwork",
        status: "ONLINE",
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        connector: "upwork",
        status: "OFFLINE",
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
