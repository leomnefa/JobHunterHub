import { DatabaseSync } from "node:sqlite";
import { config } from "../config.ts";
import { hashPassword, newId } from "../util/crypto.ts";
import { SCHEMA_STATEMENTS } from "./schema.ts";

export const db = new DatabaseSync(config.dbPath);

for (const statement of SCHEMA_STATEMENTS) {
  db.exec(statement);
}

export function nowIso(): string {
  return new Date().toISOString();
}

type Row = Record<string, unknown>;

/** SELECT que devuelve muchas filas. */
export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

/** SELECT que devuelve una fila o undefined. */
export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

/** INSERT / UPDATE / DELETE. */
export function run(sql: string, ...params: unknown[]): { changes: number } {
  const result = db.prepare(sql).run(...(params as never[]));
  return { changes: Number(result.changes) };
}

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value === "") return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function bool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

/* ------------------------------------------------------------------ */
/* Semilla inicial                                                     */
/* ------------------------------------------------------------------ */

export function seedAdmin(): { created: boolean; email: string } {
  const existing = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN'",
  );
  if (existing && existing.count > 0) {
    return { created: false, email: config.admin.email };
  }
  const timestamp = nowIso();
  run(
    `INSERT INTO users (id, email, name, role, password_hash, active, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, 'ADMIN', ?, 1, 1, ?, ?)`,
    newId("usr_"),
    config.admin.email.toLowerCase(),
    "Administrador",
    hashPassword(config.admin.password),
    timestamp,
    timestamp,
  );
  return { created: true, email: config.admin.email };
}

export function getSetting(key: string): string | undefined {
  return get<{ value: string }>("SELECT value FROM system_settings WHERE key = ?", key)?.value;
}

export function setSetting(key: string, value: string, isSecret = false): void {
  run(
    `INSERT INTO system_settings (key, value, is_secret, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_secret = excluded.is_secret, updated_at = excluded.updated_at`,
    key,
    value,
    isSecret ? 1 : 0,
    nowIso(),
  );
}
