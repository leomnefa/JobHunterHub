import { all, get, nowIso, run } from "../db/index.ts";
import { newId } from "../util/crypto.ts";

/**
 * Registro de auditoria: quien hizo que, sobre que fuente y con que resultado.
 * Nunca se guardan credenciales ni contenido sensible, solo metadatos.
 */

export interface AuditEntry {
  userId?: string;
  userEmail?: string;
  action: string;
  entity?: string;
  entityId?: string;
  source?: string;
  result?: "SUCCESS" | "FAILURE" | "WARNING";
  detail?: string;
  ip?: string;
}

export function audit(entry: AuditEntry): void {
  run(
    `INSERT INTO audit_log (id, user_id, user_email, action, entity, entity_id, source, result, detail, ip, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    newId("aud_"),
    entry.userId ?? null,
    entry.userEmail ?? null,
    entry.action,
    entry.entity ?? null,
    entry.entityId ?? null,
    entry.source ?? null,
    entry.result ?? "SUCCESS",
    entry.detail ? entry.detail.slice(0, 1000) : null,
    entry.ip ?? null,
    nowIso(),
  );
}

export interface AuditRow {
  id: string;
  user_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  source: string | null;
  result: string;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export function listAudit(options: {
  limit?: number;
  offset?: number;
  action?: string;
  userEmail?: string;
}): { entries: AuditRow[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (options.action) {
    where.push("action = ?");
    params.push(options.action);
  }
  if (options.userEmail) {
    where.push("user_email = ?");
    params.push(options.userEmail);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return {
    total: get<{ count: number }>(`SELECT COUNT(*) AS count FROM audit_log ${clause}`, ...params)?.count ?? 0,
    entries: all<AuditRow>(
      `SELECT * FROM audit_log ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      Math.min(options.limit ?? 100, 500),
      options.offset ?? 0,
    ),
  };
}

/** Borra auditoria antigua para que la base local no crezca indefinidamente. */
export function purgeAudit(days: number): number {
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  return run("DELETE FROM audit_log WHERE created_at < ?", cutoff).changes;
}
