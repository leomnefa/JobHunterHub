import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyToken } from "../util/crypto.ts";
import type { TokenPayload } from "../util/crypto.ts";

/**
 * Router minimo sobre node:http. Sin dependencias externas:
 * menos superficie de ataque y una instalacion mas simple en la PC del usuario.
 */

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  user?: TokenPayload;
  ip: string;
}

export type Handler = (ctx: RequestContext) => Promise<unknown> | unknown;
export type Role = "ADMIN" | "USER";

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
  auth: boolean;
  roles?: Role[];
}

export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = "Sesion no valida") => new HttpError(401, message);
export const forbidden = (message = "No tiene permisos para esta operacion") => new HttpError(403, message);
export const notFound = (message = "Recurso no encontrado") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB: suficiente para un perfil o un CV

export class Router {
  private readonly routes: Route[] = [];

  add(method: string, path: string, handler: Handler, options: { auth?: boolean; roles?: Role[] } = {}): this {
    this.routes.push({
      method: method.toUpperCase(),
      segments: path.split("/").filter(Boolean),
      handler,
      auth: options.auth ?? true,
      roles: options.roles,
    });
    return this;
  }

  get = (path: string, handler: Handler, options?: { auth?: boolean; roles?: Role[] }) =>
    this.add("GET", path, handler, options);
  post = (path: string, handler: Handler, options?: { auth?: boolean; roles?: Role[] }) =>
    this.add("POST", path, handler, options);
  put = (path: string, handler: Handler, options?: { auth?: boolean; roles?: Role[] }) =>
    this.add("PUT", path, handler, options);
  patch = (path: string, handler: Handler, options?: { auth?: boolean; roles?: Role[] }) =>
    this.add("PATCH", path, handler, options);
  delete = (path: string, handler: Handler, options?: { auth?: boolean; roles?: Role[] }) =>
    this.add("DELETE", path, handler, options);

  match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    const segments = pathname.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      if (route.segments.length !== segments.length) continue;

      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i += 1) {
        const pattern = route.segments[i];
        if (pattern.startsWith(":")) {
          params[pattern.slice(1)] = decodeURIComponent(segments[i]);
        } else if (pattern !== segments[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { route, params };
    }
    return null;
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw badRequest("El cuerpo de la peticion es demasiado grande.");
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return undefined;

  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      throw badRequest("JSON invalido.");
    }
  }
  return raw;
}

function clientIp(req: IncomingMessage): string {
  return (req.socket.remoteAddress ?? "desconocida").replace("::ffff:", "");
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload ?? null);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

export async function handleApiRequest(
  router: Router,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  query: URLSearchParams,
): Promise<boolean> {
  const found = router.match(req.method ?? "GET", pathname);
  if (!found) return false;

  try {
    const { route, params } = found;
    let user: TokenPayload | undefined;

    if (route.auth) {
      const header = req.headers.authorization ?? "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      // El backend decide quien es el usuario: nunca se confia en un userId del cliente.
      const payload = token ? verifyToken(token) : null;
      if (!payload) throw unauthorized();
      if (route.roles && !route.roles.includes(payload.role)) throw forbidden();
      user = payload;
    }

    const body = await readBody(req);
    const result = await route.handler({
      req,
      res,
      params,
      query,
      body,
      user,
      ip: clientIp(req),
    });

    if (res.writableEnded) return true;
    sendJson(res, 200, result ?? { ok: true });
    return true;
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message, details: error.details });
      return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
    return true;
  }
}

/* ------------------------------ Validacion ------------------------------ */

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Se esperaba un objeto JSON.");
  }
  return value as Record<string, unknown>;
}

export function requireString(source: Record<string, unknown>, key: string, max = 20000): string {
  const value = source[key];
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest(`El campo "${key}" es obligatorio.`);
  }
  if (value.length > max) throw badRequest(`El campo "${key}" excede el maximo permitido.`);
  return value.trim();
}

export function optionalString(source: Record<string, unknown>, key: string, max = 20000): string | undefined {
  const value = source[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw badRequest(`El campo "${key}" debe ser texto.`);
  if (value.length > max) throw badRequest(`El campo "${key}" excede el maximo permitido.`);
  return value.trim();
}

export function optionalNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw badRequest(`El campo "${key}" debe ser numerico.`);
  return parsed;
}

export function optionalBoolean(source: Record<string, unknown>, key: string): boolean | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  return value === true || value === "true" || value === 1;
}

export function stringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  throw badRequest(`El campo "${key}" debe ser una lista.`);
}
