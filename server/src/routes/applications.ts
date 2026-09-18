import { all, get, nowIso, run } from "../db/index.ts";
import { newId } from "../util/crypto.ts";
import {
  asObject,
  badRequest,
  forbidden,
  notFound,
  optionalString,
  requireString,
} from "../http/router.ts";
import type { Router } from "../http/router.ts";
import type { ApplicationPayload, ApplicationStatus } from "../core/types.ts";
import { audit } from "../services/audit.ts";
import {
  applicationStats,
  getApplication,
  listApplications,
  saveDocument,
  submitApplication,
  updateStatus,
} from "../services/applications.ts";
import { getJob } from "../services/jobs.ts";
import { parseProfileMarkdown } from "../services/profile.ts";
import { getPrimaryProfile } from "./profile.ts";

/**
 * Centro de postulaciones: listado, detalle, envio, reintento y seguimiento.
 * Cada consulta filtra por el usuario del token: un usuario nunca ve datos de otro.
 */

const VALID_STATUSES: ApplicationStatus[] = [
  "DISCOVERED",
  "MATCHED",
  "READY_TO_APPLY",
  "WAITING_USER_CONFIRMATION",
  "APPLYING",
  "SUBMITTED",
  "FAILED",
  "REQUIRES_USER_ACTION",
  "WITHDRAWN",
  "REJECTED",
  "INTERVIEW",
  "OFFER",
  "HIRED",
];

function ensureCandidate(role: string): void {
  if (role === "ADMIN") throw forbidden("El administrador no gestiona postulaciones propias.");
}

export function registerApplicationRoutes(router: Router): void {
  router.get("/api/applications", ({ query, user }) => {
    ensureCandidate(user!.role);
    const result = listApplications(user!.sub, {
      status: query.get("status") ?? undefined,
      limit: query.get("limit") ? Number(query.get("limit")) : 100,
      offset: query.get("offset") ? Number(query.get("offset")) : 0,
    });
    return { ...result, stats: applicationStats(user!.sub) };
  });

  router.get("/api/applications/:id", ({ params, user }) => {
    ensureCandidate(user!.role);
    const application = getApplication(user!.sub, params.id);
    if (!application) throw notFound("Postulacion no encontrada.");

    return {
      application,
      job: getJob(application.job_id),
      questions: all(
        "SELECT * FROM application_questions WHERE application_id = ? ORDER BY position",
        params.id,
      ),
      answers: all(
        "SELECT * FROM application_answers WHERE application_id = ?",
        params.id,
      ),
      documents: all(
        "SELECT id, kind, filename, content_type, created_at FROM application_documents WHERE application_id = ?",
        params.id,
      ),
      events: all(
        "SELECT * FROM application_events WHERE application_id = ? ORDER BY created_at DESC",
        params.id,
      ),
      resume: application.resume_id
        ? get("SELECT id, label, content, generated_by FROM candidate_resumes WHERE id = ?", application.resume_id)
        : null,
      coverLetter: application.cover_letter_id
        ? get("SELECT id, label, content, generated_by FROM candidate_resumes WHERE id = ?", application.cover_letter_id)
        : null,
    };
  });

  /** Guarda las respuestas revisadas por el usuario antes de enviar. */
  router.put("/api/applications/:id/answers", ({ params, body, user }) => {
    ensureCandidate(user!.role);
    const application = getApplication(user!.sub, params.id);
    if (!application) throw notFound("Postulacion no encontrada.");

    const input = asObject(body);
    const answers = input.answers;
    if (!Array.isArray(answers)) throw badRequest("Se esperaba una lista de respuestas.");

    for (const entry of answers) {
      const item = asObject(entry);
      const fieldId = requireString(item, "fieldId", 200);
      const answer = optionalString(item, "answer", 10000) ?? "";
      run(
        `INSERT INTO application_answers (id, application_id, field_id, answer, source, confidence, needs_review, updated_at)
         VALUES (?,?,?,?,'user',1,0,?)
         ON CONFLICT(application_id, field_id) DO UPDATE SET
           answer = excluded.answer, source = 'user', confidence = 1, needs_review = 0, updated_at = excluded.updated_at`,
        newId("ans_"),
        params.id,
        fieldId,
        answer,
        nowIso(),
      );
    }
    return { ok: true };
  });

  /** Envio por API oficial. Si no hay autorizacion, devuelve REQUIRES_USER_ACTION. */
  router.post("/api/applications/:id/apply", async ({ params, body, user, ip }) => {
    ensureCandidate(user!.role);
    const application = getApplication(user!.sub, params.id);
    if (!application) throw notFound("Postulacion no encontrada.");
    if (application.status === "SUBMITTED") {
      throw badRequest("Esta postulacion ya fue enviada.");
    }

    const profileRow = getPrimaryProfile(user!.sub);
    if (!profileRow) throw badRequest("Cargue su perfil antes de postular.");
    const profile = parseProfileMarkdown(profileRow.markdown);

    const input = asObject(body ?? {});
    const answers = all<{ field_id: string; answer: string }>(
      "SELECT field_id, answer FROM application_answers WHERE application_id = ?",
      params.id,
    );
    const resume = application.resume_id
      ? get<{ content: string }>("SELECT content FROM candidate_resumes WHERE id = ?", application.resume_id)
      : null;
    const coverLetter = application.cover_letter_id
      ? get<{ content: string }>("SELECT content FROM candidate_resumes WHERE id = ?", application.cover_letter_id)
      : null;

    const fullName = optionalString(input, "fullName", 200) ?? profile.fullName ?? "";
    const [firstName, ...rest] = fullName.split(" ");
    const email = optionalString(input, "email", 200) ?? profile.email;
    if (!email) throw badRequest("Falta el email del candidato: completelo en el perfil.");

    const payload: ApplicationPayload = {
      fullName,
      firstName,
      lastName: rest.join(" ") || undefined,
      email,
      phone: optionalString(input, "phone", 60) ?? profile.phone,
      location: optionalString(input, "location", 200) ?? profile.location,
      linkedin: profile.linkedin,
      github: profile.github,
      portfolio: profile.portfolio,
      resume: resume
        ? { filename: "cv.md", contentType: "text/markdown", content: resume.content }
        : undefined,
      coverLetter: coverLetter
        ? { filename: "carta.md", contentType: "text/markdown", content: coverLetter.content }
        : undefined,
      answers: Object.fromEntries(
        answers
          .filter((item) => item.answer && item.answer !== "UNKNOWN")
          .map((item) => [item.field_id, item.answer]),
      ),
    };

    if (resume) {
      saveDocument(params.id, "resume", "cv.md", "text/markdown", resume.content);
    }
    if (coverLetter) {
      saveDocument(params.id, "cover_letter", "carta.md", "text/markdown", coverLetter.content);
    }

    const result = await submitApplication({
      userId: user!.sub,
      applicationId: params.id,
      payload,
    });

    audit({
      action: "APPLY",
      userId: user!.sub,
      userEmail: user!.email,
      entity: "application",
      entityId: params.id,
      source: application.source,
      result: result.status === "SUBMITTED" ? "SUCCESS" : "WARNING",
      detail: result.message,
      ip,
    });

    return result;
  });

  router.post("/api/applications/:id/status", ({ params, body, user, ip }) => {
    ensureCandidate(user!.role);
    const application = getApplication(user!.sub, params.id);
    if (!application) throw notFound("Postulacion no encontrada.");

    const input = asObject(body);
    const status = requireString(input, "status", 40) as ApplicationStatus;
    if (!VALID_STATUSES.includes(status)) throw badRequest("Estado invalido.");

    const updated = updateStatus(params.id, status, {
      message: optionalString(input, "message", 1000) ?? "Actualizado manualmente por el usuario",
      force: true,
    });

    audit({
      action: "APPLICATION_STATUS",
      userId: user!.sub,
      userEmail: user!.email,
      entity: "application",
      entityId: params.id,
      detail: `${application.status} -> ${status}`,
      ip,
    });

    return { application: updated };
  });

  router.post("/api/applications/:id/retry", async ({ params, user }) => {
    ensureCandidate(user!.role);
    const application = getApplication(user!.sub, params.id);
    if (!application) throw notFound("Postulacion no encontrada.");
    if (!["FAILED", "REQUIRES_USER_ACTION"].includes(application.status)) {
      throw badRequest("Solo se pueden reintentar postulaciones fallidas o en espera de accion.");
    }
    const updated = updateStatus(params.id, "READY_TO_APPLY", {
      message: "Reintento solicitado por el usuario",
      force: true,
    });
    return { application: updated };
  });

  router.post("/api/applications/:id/cancel", ({ params, user, ip }) => {
    ensureCandidate(user!.role);
    const application = getApplication(user!.sub, params.id);
    if (!application) throw notFound("Postulacion no encontrada.");
    const updated = updateStatus(params.id, "WITHDRAWN", {
      message: "Cancelada por el usuario",
      force: true,
    });
    audit({
      action: "APPLICATION_CANCEL",
      userId: user!.sub,
      userEmail: user!.email,
      entity: "application",
      entityId: params.id,
      ip,
    });
    return { application: updated };
  });

  router.put("/api/applications/:id/notes", ({ params, body, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const changes = run(
      "UPDATE applications SET notes = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      optionalString(input, "notes", 5000) ?? null,
      nowIso(),
      params.id,
      user!.sub,
    ).changes;
    if (!changes) throw notFound("Postulacion no encontrada.");
    return { ok: true };
  });

  /* ------------------------------ Mis CV -------------------------------- */

  router.get("/api/resumes", ({ user, query }) => {
    ensureCandidate(user!.role);
    const kind = query.get("kind");
    return {
      resumes: all(
        `SELECT r.id, r.label, r.kind, r.format, r.generated_by, r.created_at, r.job_id,
                j.title AS job_title, j.company_name
         FROM candidate_resumes r
         LEFT JOIN jobs j ON j.id = r.job_id
         WHERE r.user_id = ? ${kind ? "AND r.kind = ?" : ""}
         ORDER BY r.created_at DESC LIMIT 200`,
        ...(kind ? [user!.sub, kind] : [user!.sub]),
      ),
    };
  });

  router.get("/api/resumes/:id", ({ params, user }) => {
    ensureCandidate(user!.role);
    const resume = get(
      "SELECT * FROM candidate_resumes WHERE id = ? AND user_id = ?",
      params.id,
      user!.sub,
    );
    if (!resume) throw notFound("Documento no encontrado.");
    return { resume };
  });

  router.put("/api/resumes/:id", ({ params, body, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const changes = run(
      "UPDATE candidate_resumes SET label = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      requireString(input, "label", 200),
      requireString(input, "content", 200000),
      nowIso(),
      params.id,
      user!.sub,
    ).changes;
    if (!changes) throw notFound("Documento no encontrado.");
    return { ok: true };
  });

  router.post("/api/resumes", ({ body, user }) => {
    ensureCandidate(user!.role);
    const input = asObject(body);
    const id = newId("cv_");
    const timestamp = nowIso();
    run(
      `INSERT INTO candidate_resumes (id, user_id, label, kind, format, content, generated_by, created_at, updated_at)
       VALUES (?,?,?,'base','markdown',?, 'manual', ?, ?)`,
      id,
      user!.sub,
      requireString(input, "label", 200),
      requireString(input, "content", 200000),
      timestamp,
      timestamp,
    );
    return { id };
  });

  router.delete("/api/resumes/:id", ({ params, user }) => {
    ensureCandidate(user!.role);
    const changes = run(
      "DELETE FROM candidate_resumes WHERE id = ? AND user_id = ?",
      params.id,
      user!.sub,
    ).changes;
    if (!changes) throw notFound("Documento no encontrado.");
    return { ok: true };
  });

  /* ---------------------------- Dashboard ------------------------------- */

  router.get("/api/dashboard", ({ user }) => {
    ensureCandidate(user!.role);
    const profile = getPrimaryProfile(user!.sub);
    const parsed = profile ? parseProfileMarkdown(profile.markdown) : null;

    return {
      profile: parsed
        ? { headline: parsed.headline, skills: parsed.skills.length, updatedAt: profile?.updated_at }
        : null,
      applications: applicationStats(user!.sub),
      topMatches: all(
        `SELECT m.job_id, m.compatibility_score, m.recommendation, j.title, j.company_name,
                j.location, j.source, j.remote_type, j.source_url
         FROM job_matches m JOIN jobs j ON j.id = m.job_id
         WHERE m.user_id = ?
         ORDER BY m.compatibility_score DESC LIMIT 8`,
        user!.sub,
      ),
      recentApplications: listApplications(user!.sub, { limit: 6 }).applications,
      unreadAlerts:
        get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM alerts WHERE user_id = ? AND read = 0",
          user!.sub,
        )?.count ?? 0,
      savedSearches:
        get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM saved_searches WHERE user_id = ?",
          user!.sub,
        )?.count ?? 0,
      resumes:
        get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM candidate_resumes WHERE user_id = ?",
          user!.sub,
        )?.count ?? 0,
    };
  });
}
