import type { ConnectorSettingField, JobConnector } from "../core/types.ts";
import { capabilities } from "./base.ts";

/**
 * Connectors declarados pero NO implementados.
 *
 * Existen en el registro para que aparezcan en el panel ADMIN con su estado
 * real, pero no ejecutan ninguna llamada ni devuelven datos inventados. Se
 * activan recien cuando se verifica documentacion oficial vigente para la
 * fuente (endpoints, autenticacion, limites y condiciones de uso).
 */

interface PendingOptions {
  id: string;
  name: string;
  homepage: string;
  docsUrl: string;
  category: JobConnector["category"];
  reason: string;
  settingsSchema?: ConnectorSettingField[];
}

const CAPS = capabilities({});

function createPendingConnector(options: PendingOptions): JobConnector {
  return {
    id: options.id,
    name: options.name,
    homepage: options.homepage,
    docsUrl: options.docsUrl,
    category: options.category,
    mode: "UNKNOWN",
    restrictions: [options.reason],
    settingsSchema: options.settingsSchema ?? [],
    rateLimit: { requestsPerMinute: 5, requestsPerHour: 50 },

    getCapabilities: () => CAPS,
    isConfigured: () => false,

    async searchJobs() {
      return { jobs: [], warnings: [`${options.name}: ${options.reason}`] };
    },

    async healthCheck() {
      return {
        connector: options.id,
        status: "NOT_CONFIGURED" as const,
        checkedAt: new Date().toISOString(),
        message: options.reason,
      };
    },
  };
}

export const jobgetherConnector = createPendingConnector({
  id: "jobgether",
  name: "Jobgether",
  homepage: "https://jobgether.com",
  docsUrl: "https://jobgether.com",
  category: "job_board",
  reason:
    "Jobgether no publica una API abierta documentada. Pendiente de confirmar endpoints y condiciones de uso con la fuente antes de implementar; no se hace scraping.",
});

export const pinpointConnector = createPendingConnector({
  id: "pinpoint",
  name: "Pinpoint",
  homepage: "https://www.pinpointhq.com",
  docsUrl: "https://developers.pinpointhq.com/",
  category: "ats",
  reason:
    "La API de Pinpoint exige API key emitida por cada cliente y no expone un feed publico verificable. Pendiente de validar con una cuenta real antes de habilitar.",
  settingsSchema: [
    { key: "api_key", label: "API key", type: "secret", required: true },
    {
      key: "subdomain",
      label: "Subdominio",
      type: "text",
      required: true,
      placeholder: "empresa",
      help: "Aparece en {empresa}.pinpointhq.com",
    },
  ],
});

export const PENDING_CONNECTORS: JobConnector[] = [jobgetherConnector, pinpointConnector];
