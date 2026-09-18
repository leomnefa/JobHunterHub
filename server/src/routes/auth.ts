import { get, nowIso, run } from "../db/index.ts";
import { hashPassword, signToken, verifyPassword } from "../util/crypto.ts";
import { asObject, badRequest, forbidden, requireString, unauthorized } from "../http/router.ts";
import type { Router } from "../http/router.ts";
import { audit } from "../services/audit.ts";

/**
 * Autenticacion y sesion.
 *
 * Reglas: el rol lo decide el backend a partir del usuario autenticado;
 * los intentos fallidos se limitan por IP para evitar fuerza bruta.
 */

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  password_hash: string;
  active: number;
  must_change_password: number;
}

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const LOCK_MS = 10 * 60 * 1000;

function checkThrottle(key: string): void {
  const entry = attempts.get(key);
  if (entry && entry.count >= MAX_ATTEMPTS && entry.until > Date.now()) {
    const minutes = Math.ceil((entry.until - Date.now()) / 60000);
    throw badRequest(`Demasiados intentos fallidos. Reintente en ${minutes} minuto(s).`);
  }
}

function registerFailure(key: string): void {
  const entry = attempts.get(key) ?? { count: 0, until: 0 };
  entry.count += 1;
  entry.until = Date.now() + LOCK_MS;
  attempts.set(key, entry);
}

export function registerAuthRoutes(router: Router): void {
  router.post(
    "/api/auth/login",
    ({ body, ip }) => {
      const input = asObject(body);
      const email = requireString(input, "email", 200).toLowerCase();
      const password = requireString(input, "password", 200);
      const throttleKey = `${ip}:${email}`;
      checkThrottle(throttleKey);

      const user = get<UserRow>("SELECT * FROM users WHERE email = ?", email);
      if (!user || !verifyPassword(password, user.password_hash)) {
        registerFailure(throttleKey);
        audit({ action: "LOGIN", userEmail: email, result: "FAILURE", ip, detail: "credenciales invalidas" });
        throw unauthorized("Email o contrasena incorrectos.");
      }
      if (user.active !== 1) {
        audit({ action: "LOGIN", userEmail: email, result: "FAILURE", ip, detail: "usuario inactivo" });
        throw forbidden("El usuario esta desactivado. Contacte al administrador.");
      }

      attempts.delete(throttleKey);
      run("UPDATE users SET last_login_at = ? WHERE id = ?", nowIso(), user.id);
      audit({ action: "LOGIN", userId: user.id, userEmail: user.email, result: "SUCCESS", ip });

      return {
        token: signToken({ sub: user.id, email: user.email, role: user.role, name: user.name }),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.must_change_password === 1,
        },
      };
    },
    { auth: false },
  );

  router.get("/api/auth/me", ({ user }) => {
    const row = get<UserRow>("SELECT * FROM users WHERE id = ?", user!.sub);
    if (!row || row.active !== 1) throw unauthorized("La sesion ya no es valida.");
    return {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        mustChangePassword: row.must_change_password === 1,
      },
    };
  });

  router.post("/api/auth/change-password", ({ body, user, ip }) => {
    const input = asObject(body);
    const current = requireString(input, "currentPassword", 200);
    const next = requireString(input, "newPassword", 200);
    if (next.length < 8) throw badRequest("La nueva contrasena debe tener al menos 8 caracteres.");

    const row = get<UserRow>("SELECT * FROM users WHERE id = ?", user!.sub);
    if (!row || !verifyPassword(current, row.password_hash)) {
      audit({ action: "CHANGE_PASSWORD", userId: user!.sub, userEmail: user!.email, result: "FAILURE", ip });
      throw unauthorized("La contrasena actual no es correcta.");
    }

    run(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
      hashPassword(next),
      nowIso(),
      row.id,
    );
    audit({ action: "CHANGE_PASSWORD", userId: row.id, userEmail: row.email, result: "SUCCESS", ip });
    return { ok: true };
  });

  router.post("/api/auth/logout", ({ user, ip }) => {
    audit({ action: "LOGOUT", userId: user!.sub, userEmail: user!.email, ip });
    return { ok: true };
  });
}
