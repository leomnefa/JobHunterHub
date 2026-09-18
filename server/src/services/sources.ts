import { connectorRegistry } from "../connectors/registry.ts";
import { config } from "../config.ts";
import { all, get, nowIso, run } from "../db/index.ts";
import { decryptSecret, encryptSecret, maskSecret, newId } from "../util/crypto.ts";
import type { ConnectorSettings, JobConnector } from "../core/types.ts";

/**
 * Estado y configuracion de cada fuente.
 *
 * Los valores no sensibles viven en job_sources.settings_json; los secretos
 * (API keys, tokens) se guardan cifrados en connector_credentials y jamas se
 * devuelven en claro al frontend.
 */

export interface SourceRow {
  id: string;
  name: string;
  category: string;
  mode: string;
  enabled: number;
  settings_json: string;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_status: string | null;
  last_message: string | null;
}

/** Crea la fila de cada connector registrado la primera vez que arranca. */
export function ensureSourcesRegistered(): void {
  const timestamp = nowIso();
  for (const connector of connectorRegistry.list()) {
    const existing = get<{ id: string }>("SELECT id FROM job_sources WHERE id = ?", connector.id);
    if (existing) {
      run(
        "UPDATE job_sources SET name = ?, category = ?, mode = ?, updated_at = ? WHERE id = ?",
        connector.name,
        connector.category,
        connector.mode,
        timestamp,
        connector.id,
      );
      continue;
    }
    // Las fuentes publicas sin credenciales arrancan habilitadas.
    const enabled = connector.settingsSchema.length === 0 ? 1 : 0;
    run(
      `INSERT INTO job_sources (id, name, category, mode, enabled, settings_json, sync_interval_minutes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?)`,
      connector.id,
      connector.name,
      connector.category,
      connector.mode,
      enabled,
      config.syncIntervalMinutes || 60,
      timestamp,
      timestamp,
    );
  }
}

function credentialsFor(sourceId: string): Record<string, string> {
  const rows = all<{ key: string; value_enc: string }>(
    "SELECT key, value_enc FROM connector_credentials WHERE source_id = ?",
    sourceId,
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    const plain = decryptSecret(row.value_enc);
    if (plain) result[row.key] = plain;
  }
  return result;
}

/** Variables de entorno que actuan como valor por defecto de cada credencial. */
const ENV_DEFAULTS: Record<string, Record<string, string | undefined>> = {
  adzuna: { app_id: process.env.ADZUNA_APP_ID, app_key: process.env.ADZUNA_APP_KEY },
  greenhouse: { api_key: process.env.GREENHOUSE_API_KEY },
  lever: { api_key: process.env.LEVER_API_KEY },
  smartrecruiters: {
    client_id: process.env.SMARTRECRUITERS_CLIENT_ID,
    client_secret: process.env.SMARTRECRUITERS_CLIENT_SECRET,
  },
  upwork: {
    client_id: process.env.UPWORK_CLIENT_ID,
    client_secret: process.env.UPWORK_CLIENT_SECRET,
  },
  freelancer: { oauth_token: process.env.FREELANCER_OAUTH_TOKEN },
};

/** Settings efectivos de una fuente: .env < settings guardados < credenciales. */
export function resolveSettings(sourceId: string): ConnectorSettings {
  const row = get<SourceRow>("SELECT * FROM job_sources WHERE id = ?", sourceId);
  const stored = row ? (JSON.parse(row.settings_json || "{}") as ConnectorSettings) : {};
  const envDefaults = ENV_DEFAULTS[sourceId] ?? {};
  const result: ConnectorSettings = {};

  for (const [key, value] of Object.entries(envDefaults)) {
    if (value) result[key] = value;
  }
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value === "string" && value) result[key] = value;
  }
  for (const [key, value] of Object.entries(credentialsFor(sourceId))) {
    result[key] = value;
  }
  return result;
}

export interface SourceView {
  id: string;
  name: string;
  category: JobConnector["category"];
  mode: JobConnector["mode"];
  homepage: string;
  docsUrl: string;
  enabled: boolean;
  configured: boolean;
  capabilities: ReturnType<JobConnector["getCapabilities"]>;
  settingsSchema: JobConnector["settingsSchema"];
  settings: Record<string, string>;
  restrictions: string[];
  attribution?: string;
  rateLimit: JobConnector["rateLimit"];
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
}

/** Vista segura de una fuente: los secretos salen enmascarados. */
export function describeSource(sourceId: string): SourceView | null {
  const connector = connectorRegistry.get(sourceId);
  const row = get<SourceRow>("SELECT * FROM job_sources WHERE id = ?", sourceId);
  if (!connector || !row) return null;

  const settings = resolveSettings(sourceId);
  const visible: Record<string, string> = {};
  for (const field of connector.settingsSchema) {
    const value = settings[field.key] ?? "";
    visible[field.key] = field.type === "secret" ? maskSecret(value) : value;
  }

  return {
    id: connector.id,
    name: connector.name,
    category: connector.category,
    mode: connector.mode,
    homepage: connector.homepage,
    docsUrl: connector.docsUrl,
    enabled: row.enabled === 1,
    configured: connector.isConfigured(settings),
    capabilities: connector.getCapabilities(),
    settingsSchema: connector.settingsSchema,
    settings: visible,
    restrictions: connector.restrictions ?? [],
    attribution: connector.attribution,
    rateLimit: connector.rateLimit,
    syncIntervalMinutes: row.sync_interval_minutes,
    lastSyncAt: row.last_sync_at,
    lastStatus: row.last_status,
    lastMessage: row.last_message,
  };
}

export function listSources(): SourceView[] {
  return connectorRegistry
    .list()
    .map((connector) => describeSource(connector.id))
    .filter((source): source is SourceView => source !== null);
}

export function listEnabledSources(): SourceView[] {
  return listSources().filter((source) => source.enabled && source.configured);
}

export function setSourceEnabled(sourceId: string, enabled: boolean): void {
  run(
    "UPDATE job_sources SET enabled = ?, updated_at = ? WHERE id = ?",
    enabled ? 1 : 0,
    nowIso(),
    sourceId,
  );
}

export function setSyncInterval(sourceId: string, minutes: number): void {
  run(
    "UPDATE job_sources SET sync_interval_minutes = ?, updated_at = ? WHERE id = ?",
    Math.max(5, Math.min(1440, Math.round(minutes))),
    nowIso(),
    sourceId,
  );
}

/**
 * Guarda la configuracion de una fuente.
 * Un valor enmascarado o vacio significa "no cambiar" y preserva el secreto.
 */
export function updateSourceSettings(sourceId: string, input: Record<string, string>): void {
  const connector = connectorRegistry.require(sourceId);
  const row = get<SourceRow>("SELECT * FROM job_sources WHERE id = ?", sourceId);
  if (!row) throw new Error(`Fuente desconocida: ${sourceId}`);

  const plain = JSON.parse(row.settings_json || "{}") as Record<string, string>;
  const timestamp = nowIso();

  for (const field of connector.settingsSchema) {
    const incoming = input[field.key];
    if (incoming === undefined) continue;
    const value = incoming.trim();

    if (field.type === "secret") {
      if (!value || value.includes("*")) continue; // valor enmascarado: se conserva
      run(
        `INSERT INTO connector_credentials (id, source_id, key, value_enc, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(source_id, key) DO UPDATE SET value_enc = excluded.value_enc, updated_at = excluded.updated_at`,
        newId("cred_"),
        sourceId,
        field.key,
        encryptSecret(value),
        timestamp,
      );
      continue;
    }
    plain[field.key] = value;
  }

  run(
    "UPDATE job_sources SET settings_json = ?, updated_at = ? WHERE id = ?",
    JSON.stringify(plain),
    timestamp,
    sourceId,
  );
}

export function deleteCredential(sourceId: string, key: string): void {
  run("DELETE FROM connector_credentials WHERE source_id = ? AND key = ?", sourceId, key);
}

export function markSourceSync(
  sourceId: string,
  status: string,
  message?: string,
): void {
  run(
    "UPDATE job_sources SET last_sync_at = ?, last_status = ?, last_message = ?, updated_at = ? WHERE id = ?",
    nowIso(),
    status,
    message ?? null,
    nowIso(),
    sourceId,
  );
}
