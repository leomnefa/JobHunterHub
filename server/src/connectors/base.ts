import { requestJson, requestText, configureRateLimit } from "../core/http.ts";
import type { RequestOptions } from "../core/http.ts";
import type {
  ConnectorCapabilities,
  ConnectorContext,
  ConnectorHealth,
  ConnectorSettings,
  JobConnector,
} from "../core/types.ts";
import { NO_CAPABILITIES } from "../core/types.ts";

/** Construye las capacidades declarando solo lo que realmente se soporta. */
export function capabilities(overrides: Partial<ConnectorCapabilities>): ConnectorCapabilities {
  return { ...NO_CAPABILITIES, ...overrides };
}

/** Contexto de ejecucion que el host entrega a cada connector. */
export function createContext(
  connectorId: string,
  settings: ConnectorSettings,
  rateLimit: { requestsPerMinute: number; requestsPerHour: number },
  logger: (message: string, data?: unknown) => void = () => {},
): ConnectorContext {
  configureRateLimit(connectorId, rateLimit.requestsPerMinute, rateLimit.requestsPerHour);
  const base: RequestOptions = { rateLimitKey: connectorId };
  return {
    settings,
    fetchJson: <T>(url: string, init?: RequestInit) =>
      requestJson<T>(url, { ...base, ...(init as RequestOptions) }),
    fetchText: async (url: string, init?: RequestInit) => {
      const { body } = await requestText(url, { ...base, ...(init as RequestOptions) });
      return body;
    },
    log: logger,
  };
}

/**
 * Health check generico: pega a una URL y clasifica el resultado.
 * Nunca lanza: un connector caido no puede tumbar al resto.
 */
export async function pingHealth(
  connectorId: string,
  url: string,
  ctx: ConnectorContext,
  init?: RequestInit,
): Promise<ConnectorHealth> {
  const started = Date.now();
  try {
    await ctx.fetchText(url, init);
    return {
      connector: connectorId,
      status: "ONLINE",
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      connector: connectorId,
      status: /429|limite|rate/i.test(message) ? "DEGRADED" : "OFFLINE",
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      message,
    };
  }
}

export function notConfigured(connectorId: string, message: string): ConnectorHealth {
  return {
    connector: connectorId,
    status: "NOT_CONFIGURED",
    checkedAt: new Date().toISOString(),
    message,
  };
}

/** Lee un setting que puede venir como lista separada por comas o saltos de linea. */
export function settingList(settings: ConnectorSettings, key: string): string[] {
  const raw = settings[key];
  if (!raw) return [];
  return raw
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function requireSettings(settings: ConnectorSettings, keys: string[]): boolean {
  return keys.every((key) => Boolean(settings[key]?.trim()));
}

/** Utilidad minima para leer los XML planos que publican algunos ATS. */
export function xmlTagValues(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let match = pattern.exec(xml);
  while (match !== null) {
    out.push(match[1]);
    match = pattern.exec(xml);
  }
  return out;
}

export function xmlTagValue(xml: string, tag: string): string | undefined {
  const values = xmlTagValues(xml, tag);
  if (values.length === 0) return undefined;
  return decodeXml(values[0]);
}

export function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

export type { JobConnector };
