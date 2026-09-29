import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../config.ts";

/**
 * Registro a archivo.
 *
 * Cuando la aplicacion corre como servicio no hay consola donde mirar: todo lo
 * que se escribe por console queda espejado en data/logs/jobhunter-AAAA-MM-DD.log.
 * Un archivo por dia, con purga automatica de los mas viejos.
 */

const LOG_DIR = join(DATA_DIR, "logs");
const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS ?? 30);

let currentDay = "";
let currentFile = "";

function fileForToday(): string {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== currentDay) {
    currentDay = day;
    currentFile = join(LOG_DIR, `jobhunter-${day}.log`);
    pruneOldLogs();
  }
  return currentFile;
}

/** Borra los logs que superan la retencion configurada. */
function pruneOldLogs(): void {
  if (RETENTION_DAYS <= 0) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;
  try {
    for (const name of readdirSync(LOG_DIR)) {
      if (!name.startsWith("jobhunter-") || !name.endsWith(".log")) continue;
      const path = join(LOG_DIR, name);
      if (statSync(path).mtimeMs < cutoff) unlinkSync(path);
    }
  } catch {
    /* la purga nunca debe impedir que la aplicacion arranque */
  }
}

function format(level: string, args: unknown[]): string {
  const text = args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ""}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
  return `${new Date().toISOString()} [${level}] ${text}\n`;
}

let installed = false;

/**
 * Espeja console.log/warn/error a disco sin perder la salida por consola:
 * en modo interactivo se sigue viendo todo en la terminal.
 */
export function installFileLogger(): string {
  if (installed) return LOG_DIR;
  mkdirSync(LOG_DIR, { recursive: true });

  const levels: [keyof Console, string][] = [
    ["log", "INFO"],
    ["info", "INFO"],
    ["warn", "WARN"],
    ["error", "ERROR"],
  ];

  for (const [method, level] of levels) {
    const original = console[method] as (...args: unknown[]) => void;
    (console[method] as unknown) = (...args: unknown[]) => {
      original(...args);
      try {
        appendFileSync(fileForToday(), format(level, args));
      } catch {
        /* si el disco falla, la aplicacion sigue funcionando */
      }
    };
  }

  // Nada debe morir en silencio cuando corre como servicio.
  process.on("uncaughtException", (error) => {
    console.error("Excepcion no capturada:", error);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("Promesa rechazada sin manejar:", reason);
  });

  installed = true;
  return LOG_DIR;
}

export { LOG_DIR };
