#!/usr/bin/env node
/**
 * Instalador de JobHunter AI.
 *
 * Verifica la version de Node, crea el archivo .env si no existe, instala las
 * dependencias del frontend y lo compila. El backend no tiene dependencias:
 * Node 22.6+ ejecuta TypeScript de forma nativa y node:sqlite provee la base.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const colors = {
  reset: "[0m",
  dim: "[2m",
  green: "[32m",
  yellow: "[33m",
  red: "[31m",
  cyan: "[36m",
  bold: "[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function step(number, total, message) {
  log(`\n[${number}/${total}] ${message}`, "cyan");
}

function fail(message) {
  log(`\n  ERROR: ${message}\n`, "red");
  process.exit(1);
}

/**
 * Ejecuta npm sin pasar por el shell.
 *
 * En Windows `npm` es un .cmd y Node ya no lo lanza sin shell, pero usar shell
 * concatena los argumentos sin escaparlos. La via limpia es invocar el propio
 * npm-cli.js con el Node que esta corriendo.
 */
function runNpm(args, cwd) {
  const cli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (existsSync(cli)) {
    return spawnSync(process.execPath, [cli, ...args], { cwd, stdio: "inherit" });
  }
  // Instalaciones no estandar (nvm, volta, gestores de paquetes): se cae al shell.
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(npm, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

const TOTAL = 4;

log("\n==============================================", "bold");
log("  JobHunter AI - instalacion", "bold");
log("==============================================", "bold");

/* 1. Node --------------------------------------------------------------- */
step(1, TOTAL, "Verificando Node.js");

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  fail(
    `Se requiere Node.js 22.6 o superior (detectado ${process.versions.node}).\n` +
      `  Descarguelo desde https://nodejs.org y vuelva a ejecutar la instalacion.`,
  );
}
try {
  await import("node:sqlite");
} catch {
  fail(
    "Esta instalacion de Node no incluye node:sqlite.\n" +
      "  Actualice a Node.js 22.6+ (idealmente la version LTS mas reciente).",
  );
}
log(`  Node ${process.versions.node} y node:sqlite disponibles.`, "green");

/* 2. Configuracion ------------------------------------------------------ */
step(2, TOTAL, "Preparando configuracion");

const envPath = join(ROOT, ".env");
const envExample = join(ROOT, ".env.example");

if (!existsSync(envPath)) {
  copyFileSync(envExample, envPath);
  const secret = randomBytes(48).toString("hex");
  const adminPassword = `jh-${randomBytes(6).toString("hex")}`;
  const content = readFileSync(envPath, "utf8")
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`)
    .replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${adminPassword}`);
  writeFileSync(envPath, content);

  log("  Archivo .env creado con claves generadas.", "green");
  log(`  Usuario admin:    admin@jobhunter.local`, "yellow");
  log(`  Contrasena admin: ${adminPassword}`, "yellow");
  log("  Guarde estos datos: podra cambiarlos desde la aplicacion.", "dim");
} else {
  log("  Ya existe un archivo .env: se conserva sin cambios.", "dim");
}

mkdirSync(join(ROOT, "data", "uploads"), { recursive: true });
log("  Carpeta data/ lista.", "green");

/* 3. Frontend ----------------------------------------------------------- */
step(3, TOTAL, "Instalando dependencias de la interfaz web");

const install = runNpm(["install", "--no-audit", "--no-fund"], join(ROOT, "web"));
if (install.status !== 0) fail("No se pudieron instalar las dependencias del frontend.");

/* 4. Build -------------------------------------------------------------- */
step(4, TOTAL, "Compilando la interfaz web");

const build = runNpm(["run", "build"], join(ROOT, "web"));
if (build.status !== 0) fail("La compilacion del frontend fallo.");

/* Listo ----------------------------------------------------------------- */
const port = (readFileSync(envPath, "utf8").match(/^PORT=(\d+)/m) ?? [])[1] ?? "4100";

log("\n==============================================", "bold");
log("  Instalacion completa", "green");
log("==============================================", "bold");
log(`\n  Iniciar la aplicacion:   ${colors.bold}npm start${colors.reset}`);
log(`  Abrir en el navegador:   ${colors.bold}http://127.0.0.1:${port}${colors.reset}`);
log(`\n  Modo desarrollo:         npm run dev`);
log(`  Configuracion:           .env\n`, "dim");
