import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { WEB_DIST_DIR, config } from "./config.ts";
import { seedAdmin } from "./db/index.ts";
import { installFileLogger } from "./util/logger.ts";
import { Router, handleApiRequest, sendJson } from "./http/router.ts";
import { registerAdminRoutes } from "./routes/admin.ts";
import { registerApplicationRoutes } from "./routes/applications.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerJobRoutes } from "./routes/jobs.ts";
import { registerProfileRoutes } from "./routes/profile.ts";
import { ensureSourcesRegistered } from "./services/sources.ts";
import { startScheduler, stopScheduler } from "./services/sync.ts";
import { aiStatus } from "./services/ai.ts";

/* ------------------------------ Arranque ------------------------------- */

// Se instala antes que nada: corriendo como servicio no hay consola que mirar.
const logDir = installFileLogger();

const seed = seedAdmin();
ensureSourcesRegistered();

const router = new Router();
registerAuthRoutes(router);
registerProfileRoutes(router);
registerJobRoutes(router);
registerApplicationRoutes(router);
registerAdminRoutes(router);

router.get(
  "/api/health",
  () => ({
    status: "ok",
    version: "1.0.0",
    ai: aiStatus(),
    time: new Date().toISOString(),
  }),
  { auth: false },
);

/* --------------------------- Archivos estaticos ------------------------ */

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function serveStatic(pathname: string, res: ServerResponse): boolean {
  if (!existsSync(WEB_DIST_DIR)) return false;

  // normalize + resolve evitan cualquier intento de path traversal.
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const candidate = resolve(WEB_DIST_DIR, relative);
  if (!candidate.startsWith(resolve(WEB_DIST_DIR))) return false;

  const target =
    existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(WEB_DIST_DIR, "index.html");
  if (!existsSync(target)) return false;

  const extension = extname(target).toLowerCase();
  const isHashedAsset = /\.[0-9a-f]{8,}\./i.test(target);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
    "Cache-Control": isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  });
  createReadStream(target).pipe(res);
  return true;
}

/* ------------------------------- Servidor ------------------------------ */

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  // La app corre en la PC del usuario: solo se aceptan peticiones same-origin.
  const origin = req.headers.origin;
  if (origin && !origin.includes(req.headers.host ?? "")) {
    sendJson(res, 403, { error: "Origen no permitido." });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApiRequest(router, req, res, url.pathname, url.searchParams);
    if (!handled) sendJson(res, 404, { error: `Ruta no encontrada: ${url.pathname}` });
    return;
  }

  if (serveStatic(url.pathname, res)) return;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>JobHunter AI</title>
     <style>body{font-family:system-ui,sans-serif;background:#0b1020;color:#e6ebff;display:grid;place-items:center;height:100vh;margin:0}
     div{max-width:640px;padding:2rem;line-height:1.6}code{background:#1b2440;padding:.15rem .4rem;border-radius:.3rem}</style></head>
     <body><div><h1>JobHunter AI</h1>
     <p>El backend esta funcionando, pero todavia no se compilo la interfaz web.</p>
     <p>Ejecute <code>npm run setup</code> en la carpeta del proyecto y vuelva a iniciar con <code>npm start</code>.</p>
     <p>Para desarrollo use <code>npm run dev</code>.</p></div></body></html>`,
  );
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (!res.writableEnded) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error("");
    console.error(`  El puerto ${config.port} ya esta en uso.`);
    console.error("  Puede que JobHunter AI ya este abierto en otra ventana.");
    console.error("  Si no es asi, cambie PORT en el archivo .env y vuelva a iniciar.");
    console.error("");
    process.exit(1);
  }
  if (error.code === "EACCES") {
    console.error(`\n  Sin permisos para escuchar en el puerto ${config.port}.`);
    console.error("  Elija un puerto mayor a 1024 en el archivo .env.\n");
    process.exit(1);
  }
  throw error;
});

server.listen(config.port, config.host, () => {
  const status = aiStatus();
  console.log("");
  console.log("  JobHunter AI");
  console.log(`  ---------------------------------------------`);
  console.log(`  Aplicacion:  http://${config.host}:${config.port}`);
  console.log(`  Base datos:  ${config.dbPath}`);
  console.log(`  IA:          ${status.provider} (${status.detail})`);
  console.log(`  Sync:        cada ${config.syncIntervalMinutes} min`);
  console.log(`  Logs:        ${logDir}`);
  if (seed.created) {
    console.log("");
    console.log(`  Usuario administrador creado: ${seed.email}`);
    console.log(`  Contrasena inicial: la definida en .env (ADMIN_PASSWORD)`);
    console.log(`  Cambiela desde la aplicacion en el primer ingreso.`);
  }
  console.log("");
});

startScheduler(config.syncIntervalMinutes);

function shutdown(signal: string): void {
  console.log(`\n${signal} recibido, cerrando JobHunter AI...`);
  stopScheduler();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
