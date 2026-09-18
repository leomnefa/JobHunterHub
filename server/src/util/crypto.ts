import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { config } from "../config.ts";

/* ------------------------------------------------------------------ */
/* Passwords: scrypt (incluido en Node, sin dependencias nativas)      */
/* ------------------------------------------------------------------ */

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/* Tokens de sesion: JWT HS256 firmado localmente                      */
/* ------------------------------------------------------------------ */

export interface TokenPayload {
  sub: string;
  email: string;
  role: "ADMIN" | "USER";
  name: string;
  exp: number;
  iat: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signToken(payload: Omit<TokenPayload, "exp" | "iat">): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + config.sessionHours * 3600;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat, exp }));
  const data = `${header}.${body}`;
  const signature = b64url(createHmac("sha256", config.jwtSecret).update(data).digest());
  return `${data}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = b64url(
    createHmac("sha256", config.jwtSecret).update(`${header}.${body}`).digest(),
  );
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as TokenPayload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Credenciales de conectores: AES-256-GCM en base de datos            */
/* ------------------------------------------------------------------ */

const credentialsKey = createHash("sha256").update(config.credentialsKey).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialsKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return "";
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      credentialsKey,
      Buffer.from(parts[1], "base64"),
    );
    decipher.setAuthTag(Buffer.from(parts[2], "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

/** Enmascara un secreto para poder mostrarlo en pantalla sin revelarlo. */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 3)}${"*".repeat(Math.min(12, value.length - 6))}${value.slice(-3)}`;
}

export function newId(prefix = ""): string {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

export function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}
