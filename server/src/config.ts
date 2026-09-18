import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Raiz del repositorio (C:\dev\JobHunterHub). */
export const ROOT_DIR = resolve(here, "..", "..");
export const DATA_DIR = join(ROOT_DIR, "data");
export const UPLOAD_DIR = join(DATA_DIR, "uploads");
export const WEB_DIST_DIR = join(ROOT_DIR, "web", "dist");

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Lector de .env sin dependencias. No sobreescribe variables ya presentes
 * en el entorno real del proceso.
 */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(ROOT_DIR, ".env"));

function str(key: string, fallback = ""): string {
  const value = process.env[key];
  return value === undefined || value === "" ? fallback : value;
}

function num(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * El secreto de sesion se persiste en data/secret.key cuando no viene por .env,
 * asi las sesiones sobreviven a un reinicio sin obligar a configurar nada.
 */
function resolveJwtSecret(): string {
  const fromEnv = str("JWT_SECRET");
  if (fromEnv) return fromEnv;
  const keyFile = join(DATA_DIR, "secret.key");
  if (existsSync(keyFile)) return readFileSync(keyFile, "utf8").trim();
  const generated = randomBytes(48).toString("hex");
  writeFileSync(keyFile, generated, { mode: 0o600 });
  return generated;
}

const jwtSecret = resolveJwtSecret();

export const config = {
  port: num("PORT", 4100),
  host: str("HOST", "127.0.0.1"),
  env: str("NODE_ENV", "production"),
  jwtSecret,
  credentialsKey: str("CREDENTIALS_KEY", jwtSecret),
  sessionHours: num("SESSION_HOURS", 12),
  admin: {
    email: str("ADMIN_EMAIL", "admin@jobhunter.local"),
    password: str("ADMIN_PASSWORD", "admin1234"),
  },
  ai: {
    provider: str("AI_PROVIDER", "heuristic"),
    anthropicApiKey: str("ANTHROPIC_API_KEY"),
    anthropicModel: str("ANTHROPIC_MODEL", "claude-sonnet-5"),
    openaiApiKey: str("OPENAI_API_KEY"),
    openaiModel: str("OPENAI_MODEL", "gpt-4o-mini"),
    ollamaBaseUrl: str("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
    ollamaModel: str("OLLAMA_MODEL", "llama3.1"),
  },
  syncIntervalMinutes: num("SYNC_INTERVAL_MINUTES", 60),
  dbPath: join(DATA_DIR, "jobhunter.db"),
  userAgent: "JobHunterHub/1.0 (local job search assistant)",
} as const;

export type AppConfig = typeof config;
