import { config } from "../config.ts";

/**
 * Cliente HTTP compartido por todos los connectors.
 * Aporta: rate limiting por fuente, reintentos con backoff exponencial + jitter,
 * respeto de Retry-After, timeout y cache en memoria de respuestas GET.
 */

export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class HttpError extends Error {
  readonly status: number;
  readonly body?: string;

  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

interface Bucket {
  minuteStart: number;
  minuteCount: number;
  hourStart: number;
  hourCount: number;
  requestsPerMinute: number;
  requestsPerHour: number;
}

const buckets = new Map<string, Bucket>();

export function configureRateLimit(
  key: string,
  requestsPerMinute: number,
  requestsPerHour: number,
): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (existing) {
    existing.requestsPerMinute = requestsPerMinute;
    existing.requestsPerHour = requestsPerHour;
    return;
  }
  buckets.set(key, {
    minuteStart: now,
    minuteCount: 0,
    hourStart: now,
    hourCount: 0,
    requestsPerMinute,
    requestsPerHour,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function takeSlot(key: string): Promise<void> {
  const bucket = buckets.get(key);
  if (!bucket) return;
  const now = Date.now();

  if (now - bucket.minuteStart >= 60_000) {
    bucket.minuteStart = now;
    bucket.minuteCount = 0;
  }
  if (now - bucket.hourStart >= 3_600_000) {
    bucket.hourStart = now;
    bucket.hourCount = 0;
  }

  if (bucket.minuteCount >= bucket.requestsPerMinute) {
    const wait = 60_000 - (now - bucket.minuteStart) + 50;
    await sleep(wait);
    return takeSlot(key);
  }
  if (bucket.hourCount >= bucket.requestsPerHour) {
    throw new RateLimitError(
      `Limite horario alcanzado para ${key}`,
      3_600_000 - (now - bucket.hourStart),
    );
  }

  bucket.minuteCount += 1;
  bucket.hourCount += 1;
}

/* --------------------------- Cache en memoria --------------------------- */

interface CacheEntry {
  body: string;
  expiresAt: number;
  fetchedAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

export function cacheStats(): { entries: number; oldest?: string } {
  return { entries: responseCache.size };
}

export function clearCache(prefix?: string): number {
  if (!prefix) {
    const size = responseCache.size;
    responseCache.clear();
    return size;
  }
  let removed = 0;
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
      removed += 1;
    }
  }
  return removed;
}

function cacheGet(key: string): string | undefined {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return undefined;
  }
  return entry.body;
}

function cacheSet(key: string, body: string, ttlMs: number): void {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { body, expiresAt: Date.now() + ttlMs, fetchedAt: Date.now() });
}

/* ------------------------------ Peticiones ------------------------------ */

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number;
  /** Clave de rate limit; normalmente el id del connector. */
  rateLimitKey?: string;
  skipCache?: boolean;
}

export interface RequestStats {
  url: string;
  status: number;
  durationMs: number;
  fromCache: boolean;
  attempts: number;
}

const inflight = new Map<string, Promise<string>>();

export async function requestText(
  url: string,
  options: RequestOptions = {},
): Promise<{ body: string; stats: RequestStats }> {
  const {
    timeoutMs = 20_000,
    retries = 2,
    cacheTtlMs = DEFAULT_TTL_MS,
    rateLimitKey,
    skipCache = false,
    ...init
  } = options;

  const method = (init.method ?? "GET").toUpperCase();
  const cacheable = method === "GET" && !skipCache && cacheTtlMs > 0;
  const cacheKey = `${rateLimitKey ?? ""}|${url}`;
  const started = Date.now();

  if (cacheable) {
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) {
      return {
        body: cached,
        stats: { url, status: 200, durationMs: Date.now() - started, fromCache: true, attempts: 0 },
      };
    }
    // Coalescencia: dos busquedas simultaneas no golpean la fuente dos veces.
    const pending = inflight.get(cacheKey);
    if (pending) {
      const body = await pending;
      return {
        body,
        stats: { url, status: 200, durationMs: Date.now() - started, fromCache: true, attempts: 0 },
      };
    }
  }

  let attempts = 0;
  let lastStatus = 0;

  const run = async (): Promise<string> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      attempts = attempt + 1;
      if (rateLimitKey) await takeSlot(rateLimitKey);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            "User-Agent": config.userAgent,
            Accept: "application/json, text/plain, */*",
            ...(init.headers as Record<string, string> | undefined),
          },
        });
        lastStatus = response.status;

        if (response.status === 429 || response.status === 503) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterMs = retryAfterHeader
            ? Number(retryAfterHeader) * 1000
            : 2 ** attempt * 1000 + Math.random() * 500;
          if (attempt === retries) {
            throw new RateLimitError(
              `${response.status} recibido de ${new URL(url).host}`,
              retryAfterMs,
            );
          }
          await sleep(Math.min(retryAfterMs, 30_000));
          continue;
        }

        const body = await response.text();
        if (!response.ok) {
          throw new HttpError(
            `HTTP ${response.status} en ${new URL(url).host}`,
            response.status,
            body.slice(0, 500),
          );
        }
        return body;
      } catch (error) {
        lastError = error;
        const isAbort = error instanceof Error && error.name === "AbortError";
        const isHttp4xx =
          error instanceof HttpError && error.status >= 400 && error.status < 500;
        // 4xx (salvo 429) no se reintenta: la respuesta no va a cambiar sola.
        if (isHttp4xx || attempt === retries) throw error;
        if (!isAbort && error instanceof RateLimitError) throw error;
        await sleep(2 ** attempt * 400 + Math.random() * 300);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Fallo desconocido de red");
  };

  const promise = run();
  if (cacheable) inflight.set(cacheKey, promise);

  try {
    const body = await promise;
    if (cacheable) cacheSet(cacheKey, body, cacheTtlMs);
    return {
      body,
      stats: {
        url,
        status: lastStatus || 200,
        durationMs: Date.now() - started,
        fromCache: false,
        attempts,
      },
    };
  } finally {
    if (cacheable) inflight.delete(cacheKey);
  }
}

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { body } = await requestText(url, options);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(`Respuesta no-JSON de ${new URL(url).host}`, 500, body.slice(0, 300));
  }
}
