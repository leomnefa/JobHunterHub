import { all, get, nowIso, run } from "../db/index.ts";
import { hashPassword, newId } from "../util/crypto.ts";
import {
  asObject,
  badRequest,
  conflict,
  notFound,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireString,
} from "../http/router.ts";
import type { Router } from "../http/router.ts";
import { clearCache } from "../core/http.ts";
import { audit, listAudit, purgeAudit } from "../services/audit.ts";
import { aiStatus, getAiSettings, saveAiSettings } from "../services/ai.ts";
import type { AiProvider } from "../services/ai.ts";
import { jobStats, purgeOldJobs } from "../services/jobs.ts";
import { checkAllConnectors } from "../services/search.ts";
import {
  describeSource,
  listSources,
  setSourceEnabled,
  setSyncInterval,
  updateSourceSettings,
} from "../services/sources.ts";
import { executionStats, runSyncCycle, schedulerStatus, syncSource } from "../services/sync.ts";

/**
 * Panel de administracion.
 *
 * El ADMIN administra la plataforma: usuarios, conectores, fuentes, IA, logs y
 * estado del sistema. No busca trabajo ni genera CVs: esas rutas le estan
 * vedadas en los modulos de candidato.
 */

const ADMIN_ONLY = { roles: ["ADMIN" as const] };

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  active: number;
  must_change_password: number;
  created_at: string;
  last_login_at: string | null;
}

export function registerAdminRoutes(router: Router): void {
  /* ------------------------------ Usuarios ----------------------------- */

  router.get(
    "/api/admin/users",
    () => ({
      users: all<UserRow & { applications: number; has_profile: number }>(
        `SELECT u.id, u.email, u.name, u.role, u.active, u.must_change_password,
                u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) AS applications,
                (SELECT COUNT(*) FROM candidate_profiles p WHERE p.user_id = u.id) AS has_profile
         FROM users u ORDER BY u.created_at DESC`,
      ),
    }),
    ADMIN_ONLY,
  );

  router.post(
    "/api/admin/users",
    ({ body, user, ip }) => {
      const input = asObject(body);
      const email = requireString(input, "email", 200).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Email invalido.");
      const password = requireString(input, "password", 200);
      if (password.length < 8) throw badRequest("La contrasena debe tener al menos 8 caracteres.");
      const role = (optionalString(input, "role", 10) ?? "USER").toUpperCase();
      if (!["ADMIN", "USER"].includes(role)) throw badRequest("Rol invalido.");

      if (get("SELECT id FROM users WHERE email = ?", email)) {
        throw conflict("Ya existe un usuario con ese email.");
      }

      const id = newId("usr_");
      const timestamp = nowIso();
      run(
        `INSERT INTO users (id, email, name, role, password_hash, active, must_change_password, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        id,
        email,
        requireString(input, "name", 120),
        role,
        hashPassword(password),
        optionalBoolean(input, "active") === false ? 0 : 1,
        optionalBoolean(input, "mustChangePassword") === false ? 0 : 1,
        timestamp,
        timestamp,
      );

      audit({
        action: "USER_CREATE",
        userId: user!.sub,
        userEmail: user!.email,
        entity: "user",
        entityId: id,
        detail: `${email} (${role})`,
        ip,
      });
      return { id };
    },
    ADMIN_ONLY,
  );

  router.put(
    "/api/admin/users/:id",
    ({ params, body, user, ip }) => {
      const input = asObject(body);
      const target = get<UserRow>("SELECT * FROM users WHERE id = ?", params.id);
      if (!target) throw notFound("Usuario no encontrado.");

      const role = (optionalString(input, "role", 10) ?? target.role).toUpperCase();
      if (!["ADMIN", "USER"].includes(role)) throw badRequest("Rol invalido.");
      const active = optionalBoolean(input, "active");

      // No se permite dejar la plataforma sin administradores activos.
      const activeAdmins =
        get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND active = 1 AND id <> ?",
          params.id,
        )?.count ?? 0;
      if (activeAdmins === 0 && (role !== "ADMIN" || active === false)) {
        throw badRequest("Debe existir al menos un administrador activo.");
      }

      run(
        `UPDATE users SET name = ?, email = ?, role = ?, active = ?, updated_at = ? WHERE id = ?`,
        optionalString(input, "name", 120) ?? target.name,
        (optionalString(input, "email", 200) ?? target.email).toLowerCase(),
        role,
        active === undefined ? target.active : active ? 1 : 0,
        nowIso(),
        params.id,
      );

      audit({
        action: "USER_UPDATE",
        userId: user!.sub,
        userEmail: user!.email,
        entity: "user",
        entityId: params.id,
        ip,
      });
      return { ok: true };
    },
    ADMIN_ONLY,
  );

  router.post(
    "/api/admin/users/:id/reset-password",
    ({ params, body, user, ip }) => {
      const input = asObject(body);
      const password = requireString(input, "password", 200);
      if (password.length < 8) throw badRequest("La contrasena debe tener al menos 8 caracteres.");
      const changes = run(
        "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?",
        hashPassword(password),
        nowIso(),
        params.id,
      ).changes;
      if (!changes) throw notFound("Usuario no encontrado.");

      audit({
        action: "USER_RESET_PASSWORD",
        userId: user!.sub,
        userEmail: user!.email,
        entity: "user",
        entityId: params.id,
        ip,
      });
      return { ok: true };
    },
    ADMIN_ONLY,
  );

  router.delete(
    "/api/admin/users/:id",
    ({ params, user, ip }) => {
      if (params.id === user!.sub) throw badRequest("No puede eliminar su propio usuario.");
      const target = get<UserRow>("SELECT * FROM users WHERE id = ?", params.id);
      if (!target) throw notFound("Usuario no encontrado.");
      if (target.role === "ADMIN") {
        const remaining =
          get<{ count: number }>(
            "SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND id <> ?",
            params.id,
          )?.count ?? 0;
        if (remaining === 0) throw badRequest("Debe existir al menos un administrador.");
      }

      // Las tablas dependientes tienen ON DELETE CASCADE: se borra todo su rastro.
      run("DELETE FROM users WHERE id = ?", params.id);
      audit({
        action: "USER_DELETE",
        userId: user!.sub,
        userEmail: user!.email,
        entity: "user",
        entityId: params.id,
        detail: target.email,
        ip,
      });
      return { ok: true };
    },
    ADMIN_ONLY,
  );

  /* ------------------------------ Conectores --------------------------- */

  router.get("/api/admin/sources", () => ({ sources: listSources() }), ADMIN_ONLY);

  router.get(
    "/api/admin/sources/:id",
    ({ params }) => {
      const source = describeSource(params.id);
      if (!source) throw notFound("Fuente no encontrada.");
      return {
        source,
        executions: all(
          "SELECT * FROM connector_executions WHERE source_id = ? ORDER BY started_at DESC LIMIT 25",
          params.id,
        ),
      };
    },
    ADMIN_ONLY,
  );

  router.put(
    "/api/admin/sources/:id",
    ({ params, body, user, ip }) => {
      const input = asObject(body);
      const source = describeSource(params.id);
      if (!source) throw notFound("Fuente no encontrada.");

      const enabled = optionalBoolean(input, "enabled");
      if (enabled !== undefined) setSourceEnabled(params.id, enabled);

      const interval = optionalNumber(input, "syncIntervalMinutes");
      if (interval !== undefined) setSyncInterval(params.id, interval);

      if (input.settings && typeof input.settings === "object") {
        updateSourceSettings(params.id, input.settings as Record<string, string>);
      }

      audit({
        action: "SOURCE_UPDATE",
        userId: user!.sub,
        userEmail: user!.email,
        entity: "job_source",
        entityId: params.id,
        source: params.id,
        ip,
      });
      return { source: describeSource(params.id) };
    },
    ADMIN_ONLY,
  );

  router.post(
    "/api/admin/sources/:id/sync",
    async ({ params, body, user, ip }) => {
      const input = asObject(body ?? {});
      const keywords = optionalString(input, "keywords", 300)?.split(/[\s,]+/).filter(Boolean) ?? [];
      const result = await syncSource(params.id, keywords);
      audit({
        action: "SOURCE_SYNC",
        userId: user!.sub,
        userEmail: user!.email,
        entity: "job_source",
        entityId: params.id,
        source: params.id,
        result: result.errors.length ? "WARNING" : "SUCCESS",
        detail: `${result.jobs} ofertas`,
        ip,
      });
      return result;
    },
    ADMIN_ONLY,
  );

  router.get(
    "/api/admin/health",
    async () => ({ connectors: await checkAllConnectors(), scheduler: schedulerStatus() }),
    ADMIN_ONLY,
  );

  /* --------------------------------- IA -------------------------------- */

  router.get(
    "/api/admin/ai",
    () => {
      const settings = getAiSettings();
      return {
        status: aiStatus(),
        settings: {
          provider: settings.provider,
          anthropicModel: settings.anthropicModel,
          openaiModel: settings.openaiModel,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          ollamaModel: settings.ollamaModel,
          hasAnthropicKey: Boolean(settings.anthropicApiKey),
          hasOpenaiKey: Boolean(settings.openaiApiKey),
        },
      };
    },
    ADMIN_ONLY,
  );

  router.put(
    "/api/admin/ai",
    ({ body, user, ip }) => {
      const input = asObject(body);
      const provider = optionalString(input, "provider", 20) as AiProvider | undefined;
      if (provider && !["heuristic", "anthropic", "openai", "ollama"].includes(provider)) {
        throw badRequest("Proveedor de IA invalido.");
      }

      saveAiSettings({
        provider,
        anthropicApiKey: optionalString(input, "anthropicApiKey", 300),
        anthropicModel: optionalString(input, "anthropicModel", 100),
        openaiApiKey: optionalString(input, "openaiApiKey", 300),
        openaiModel: optionalString(input, "openaiModel", 100),
        ollamaBaseUrl: optionalString(input, "ollamaBaseUrl", 300),
        ollamaModel: optionalString(input, "ollamaModel", 100),
      });

      audit({
        action: "AI_SETTINGS_UPDATE",
        userId: user!.sub,
        userEmail: user!.email,
        detail: provider ?? "sin cambio de proveedor",
        ip,
      });
      return { status: aiStatus() };
    },
    ADMIN_ONLY,
  );

  /* ------------------------- Estado y observabilidad -------------------- */

  router.get(
    "/api/admin/overview",
    () => {
      const sources = listSources();
      return {
        jobs: jobStats(),
        users: {
          total: get<{ count: number }>("SELECT COUNT(*) AS count FROM users")?.count ?? 0,
          active: get<{ count: number }>("SELECT COUNT(*) AS count FROM users WHERE active = 1")?.count ?? 0,
          admins: get<{ count: number }>("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN'")?.count ?? 0,
        },
        sources: {
          total: sources.length,
          enabled: sources.filter((source) => source.enabled).length,
          configured: sources.filter((source) => source.configured).length,
          byCategory: sources.reduce<Record<string, number>>((acc, source) => {
            acc[source.category] = (acc[source.category] ?? 0) + 1;
            return acc;
          }, {}),
        },
        applications: all(
          "SELECT status, COUNT(*) AS count FROM applications GROUP BY status",
        ),
        executions: executionStats(20),
        ai: aiStatus(),
        scheduler: schedulerStatus(),
      };
    },
    ADMIN_ONLY,
  );

  router.get(
    "/api/admin/logs",
    ({ query }) =>
      listAudit({
        limit: query.get("limit") ? Number(query.get("limit")) : 100,
        offset: query.get("offset") ? Number(query.get("offset")) : 0,
        action: query.get("action") ?? undefined,
        userEmail: query.get("userEmail") ?? undefined,
      }),
    ADMIN_ONLY,
  );

  router.get(
    "/api/admin/executions",
    ({ query }) => executionStats(query.get("limit") ? Number(query.get("limit")) : 50),
    ADMIN_ONLY,
  );

  router.post(
    "/api/admin/sync",
    async ({ user, ip }) => {
      const report = await runSyncCycle("manual");
      audit({
        action: "SYNC_MANUAL",
        userId: user!.sub,
        userEmail: user!.email,
        result: report.errors.length ? "WARNING" : "SUCCESS",
        detail: `${report.jobsFound} ofertas, ${report.alertsCreated} alertas`,
        ip,
      });
      return report;
    },
    ADMIN_ONLY,
  );

  /* ----------------------------- Mantenimiento -------------------------- */

  router.post(
    "/api/admin/maintenance/purge-jobs",
    ({ body, user, ip }) => {
      const input = asObject(body ?? {});
      const days = Math.max(7, optionalNumber(input, "days") ?? 90);
      const removed = purgeOldJobs(days);
      audit({
        action: "PURGE_JOBS",
        userId: user!.sub,
        userEmail: user!.email,
        detail: `${removed} ofertas anteriores a ${days} dias`,
        ip,
      });
      return { removed };
    },
    ADMIN_ONLY,
  );

  router.post(
    "/api/admin/maintenance/purge-logs",
    ({ body, user, ip }) => {
      const input = asObject(body ?? {});
      const days = Math.max(7, optionalNumber(input, "days") ?? 180);
      const removed = purgeAudit(days);
      audit({
        action: "PURGE_LOGS",
        userId: user!.sub,
        userEmail: user!.email,
        detail: `${removed} entradas`,
        ip,
      });
      return { removed };
    },
    ADMIN_ONLY,
  );

  router.post(
    "/api/admin/maintenance/clear-cache",
    ({ user, ip }) => {
      const removed = clearCache();
      audit({
        action: "CLEAR_CACHE",
        userId: user!.sub,
        userEmail: user!.email,
        detail: `${removed} entradas`,
        ip,
      });
      return { removed };
    },
    ADMIN_ONLY,
  );
}
