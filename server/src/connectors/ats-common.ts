import { applyClientFilters } from "../core/normalize.ts";
import type {
  ConnectorCapabilities,
  ConnectorContext,
  ConnectorSettingField,
  IntegrationMode,
  JobConnector,
  JobSearchParams,
  JobSearchResult,
  NormalizedJob,
} from "../core/types.ts";
import { capabilities, notConfigured, pingHealth, settingList } from "./base.ts";

/**
 * Fabrica para los ATS que publican un feed publico por tenant (empresa) y que
 * solo permiten BUSQUEDA: la postulacion siempre termina en el formulario
 * original de la empresa.
 *
 * Cada connector concreto aporta su URL y su mapper; el resto del
 * comportamiento (multi-tenant, aislamiento de errores, filtros locales,
 * health check) es identico y vive aca.
 */

export interface TenantAtsOptions {
  id: string;
  name: string;
  homepage: string;
  docsUrl: string;
  mode?: IntegrationMode;
  tenantSettingKey: string;
  tenantLabel: string;
  tenantPlaceholder: string;
  tenantHelp: string;
  extraSettings?: ConnectorSettingField[];
  rateLimit?: { requestsPerMinute: number; requestsPerHour: number };
  restrictions?: string[];
  attribution?: string;
  caps?: Partial<ConnectorCapabilities>;
  /** URL del feed de ofertas para un tenant. */
  feedUrl: (tenant: string, ctx: ConnectorContext) => string;
  /** Cabeceras opcionales (por ejemplo API keys). */
  headers?: (ctx: ConnectorContext) => Record<string, string> | undefined;
  /** Convierte el cuerpo crudo del feed en ofertas normalizadas. */
  parse: (body: string, tenant: string, ctx: ConnectorContext) => NormalizedJob[];
}

export function createTenantAtsConnector(options: TenantAtsOptions): JobConnector {
  const caps = capabilities({ search: true, jobDetails: true, ...options.caps });
  const rateLimit = options.rateLimit ?? { requestsPerMinute: 15, requestsPerHour: 200 };

  return {
    id: options.id,
    name: options.name,
    homepage: options.homepage,
    docsUrl: options.docsUrl,
    category: "ats",
    mode: options.mode ?? "SEARCH_ONLY",
    attribution: options.attribution,
    restrictions: options.restrictions,
    settingsSchema: [
      {
        key: options.tenantSettingKey,
        label: options.tenantLabel,
        type: "list",
        required: true,
        placeholder: options.tenantPlaceholder,
        help: options.tenantHelp,
      },
      ...(options.extraSettings ?? []),
    ],
    rateLimit,

    getCapabilities: () => caps,
    isConfigured: (settings) => settingList(settings, options.tenantSettingKey).length > 0,

    async searchJobs(params: JobSearchParams, ctx: ConnectorContext): Promise<JobSearchResult> {
      const tenants = settingList(ctx.settings, options.tenantSettingKey);
      if (tenants.length === 0) {
        return {
          jobs: [],
          warnings: [`${options.name} sin configurar: cargue al menos un ${options.tenantLabel}.`],
        };
      }

      const warnings: string[] = [];
      const jobs: NormalizedJob[] = [];
      const headers = options.headers?.(ctx);

      for (const tenant of tenants) {
        try {
          const body = await ctx.fetchText(options.feedUrl(tenant, ctx), { headers });
          jobs.push(...options.parse(body, tenant, ctx));
        } catch (error) {
          // Aislamiento: si una empresa falla, el resto sigue funcionando.
          warnings.push(
            `${options.tenantLabel} "${tenant}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const filtered = applyClientFilters(jobs, {
        keywords: params.keywords,
        excludedKeywords: params.excludedKeywords,
        salaryMin: params.salaryMin,
      });

      return {
        jobs: filtered.slice(0, params.limit ?? 100),
        totalAvailable: jobs.length,
        warnings,
      };
    },

    async getJob(externalJobId, ctx) {
      const index = externalJobId.indexOf(":");
      if (index < 0) return null;
      const tenant = externalJobId.slice(0, index);
      const body = await ctx.fetchText(options.feedUrl(tenant, ctx), {
        headers: options.headers?.(ctx),
      });
      return options.parse(body, tenant, ctx).find((job) => job.sourceJobId === externalJobId) ?? null;
    },

    async healthCheck(ctx) {
      const tenants = settingList(ctx.settings, options.tenantSettingKey);
      if (tenants.length === 0) {
        return notConfigured(options.id, `Sin ${options.tenantLabel} configurados.`);
      }
      return pingHealth(options.id, options.feedUrl(tenants[0], ctx), ctx, {
        headers: options.headers?.(ctx),
      });
    },
  };
}
