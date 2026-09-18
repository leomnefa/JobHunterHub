#!/usr/bin/env node
/**
 * Modo desarrollo: levanta el backend (con recarga automatica) y el servidor de
 * Vite en paralelo, y los cierra juntos.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
// Se invoca npm-cli.js con el propio Node: evita el shell y sus problemas de
// escapado de argumentos en Windows.
const NPM_CLI = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

const children = [];

function run(name, command, args, cwd, color) {
  const child = spawn(command, args, { cwd, env: process.env });

  const prefix = `[${color}m[${name}][0m `;
  const pipe = (stream, target) => {
    stream.on("data", (chunk) => {
      const text = String(chunk).trimEnd();
      if (text) target.write(`${text.split("\n").map((line) => prefix + line).join("\n")}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${prefix}termino con codigo ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("\n  JobHunter AI - modo desarrollo");
console.log("  Backend: http://127.0.0.1:4100");
console.log("  Frontend (con recarga): http://127.0.0.1:5173\n");

run("api", process.execPath, ["--watch", join(ROOT, "server", "src", "index.ts")], ROOT, "36");
run("web", process.execPath, [NPM_CLI, "run", "dev"], join(ROOT, "web"), "35");
