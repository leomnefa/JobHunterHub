import { connectorRegistry } from "../connectors/registry.ts";
import { all, get, nowIso, run, toJson } from "../db/index.ts";
import { newId } from "../util/crypto.ts";
import type {
  ApplicationForm,
  ApplicationPayload,
  ApplicationStatus,
  NormalizedJob,
} from "../core/types.ts";
import { answerApplicationForm } from "./documents.ts";
import type { AnsweredField } from "./documents.ts";
import { getJob } from "./jobs.ts";
import type { JobMatch } from "./matching.ts";
import type { ParsedProfile } from "./profile.ts";
import { resolveSettings } from "./sources.ts";

/**
 * Ciclo de vida de una postulacion.
 *
 * Niveles de automatizacion:
 *   1 DISCOVERY            - solo descubrir y guardar.
 *   2 ASSISTED APPLICATION - la plataforma prepara todo y el usuario confirma.
 *   3 AUTOMATED            - envio por API oficial, solo con credenciales validas.
 *
 * Nunca se intenta saltar CAPTCHA, MFA ni controles anti-bot. Cuando hace falta
 * una persona, el estado pasa a REQUIRES_USER_ACTION.
 */

/** Transiciones validas de la maquina de estados. */
const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DISCOVERED: ["MATCHED", "WITHDRAWN"],
  MATCHED: ["READY_TO_APPLY", "WITHDRAWN", "REQUIRES_USER_ACTION"],
  READY_TO_APPLY: ["WAITING_USER_CONFIRMATION", "APPLYING", "WITHDRAWN", "REQUIRES_USER_ACTION"],
  WAITING_USER_CONFIRMATION: ["APPLYING", "WITHDRAWN", "REQUIRES_USER_ACTION"],
  APPLYING: ["SUBMITTED", "FAILED", "REQUIRES_USER_ACTION"],
  SUBMITTED: ["INTERVIEW", "REJECTED", "OFFER", "HIRED", "WITHDRAWN"],
  FAILED: ["READY_TO_APPLY", "APPLYING", "WITHDRAWN", "REQUIRES_USER_ACTION"],
  REQUIRES_USER_ACTION: ["APPLYING", "SUBMITTED", "WITHDRAWN", "READY_TO_APPLY"],
  WITHDRAWN: [],
  REJECTED: [],
  INTERVIEW: ["OFFER", "REJECTED", "HIRED", "WITHDRAWN"],
  OFFER: ["HIRED", "REJECTED", "WITHDRAWN"],
  HIRED: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export interface ApplicationRow {
  id: string;
  user_id: string;
  job_id: string;
  source: string;
  external_application_id: string | null;
  status: ApplicationStatus;
  automation_level: number;
  resume_id: string | null;
  cover_letter_id: string | null;
  match_score: number | null;
  notes: string | null;
  error_message: string | null;
  metadata_json: string;
  submitted_at: string | null;
  last_status_update: string | null;
  created_at: string;
  updated_at: string;
}

export function addEvent(
  applicationId: string,
  status: ApplicationStatus,
  message?: string,
  data?: unknown,
): void {
  run(
    `INSERT INTO application_events (id, application_id, status, message, data_json, created_at)
     VALUES (?,?,?,?,?,?)`,
    newId("evt_"),
    applicationId,
    status,
    message ?? null,
    toJson(data ?? {}),
    nowIso(),
  );
}

export function getApplication(userId: string, applicationId: string): ApplicationRow | undefined {
  return get<ApplicationRow>(
    "SELECT * FROM applications WHERE id = ? AND user_id = ?",
    applicationId,
    userId,
  );
}

export function findApplicationByJob(userId: string, jobId: string): ApplicationRow | undefined {
  return get<ApplicationRow>(
    "SELECT * FROM applications WHERE user_id = ? AND job_id = ?",
    userId,
    jobId,
  );
}

export function createApplication(input: {
  userId: string;
  job: NormalizedJob;
  status: ApplicationStatus;
  matchScore?: number;
  automationLevel?: number;
}): ApplicationRow {
  const existing = findApplicationByJob(input.userId, input.job.id);
  // Regla del proyecto: nunca postular dos veces a la misma oferta.
  if (existing) return existing;

  const id = newId("app_");
  const timestamp = nowIso();
  run(
    `INSERT INTO applications (
       id, user_id, job_id, source, status, automation_level, match_score,
       metadata_json, last_status_update, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    input.userId,
    input.job.id,
    input.job.source,
    input.status,
    input.automationLevel ?? 2,
    input.matchScore ?? null,
    "{}",
    timestamp,
    timestamp,
    timestamp,
  );
  addEvent(id, input.status, "Postulacion creada");
  return get<ApplicationRow>("SELECT * FROM applications WHERE id = ?", id)!;
}

export function updateStatus(
  applicationId: string,
  status: ApplicationStatus,
  options: { message?: string; externalId?: string; error?: string; force?: boolean } = {},
): ApplicationRow | undefined {
  const current = get<ApplicationRow>("SELECT * FROM applications WHERE id = ?", applicationId);
  if (!current) return undefined;
  if (!options.force && !canTransition(current.status, status)) {
    throw new Error(`Transicion invalida: ${current.status} -> ${status}`);
  }

  const timestamp = nowIso();
  run(
    `UPDATE applications SET status = ?, external_application_id = COALESCE(?, external_application_id),
       error_message = ?, last_status_update = ?, submitted_at = CASE WHEN ? = 'SUBMITTED' THEN ? ELSE submitted_at END,
       updated_at = ?
     WHERE id = ?`,
    status,
    options.externalId ?? null,
    options.error ?? null,
    timestamp,
    status,
    timestamp,
    timestamp,
    applicationId,
  );
  addEvent(applicationId, status, options.message);
  return get<ApplicationRow>("SELECT * FROM applications WHERE id = ?", applicationId);
}

export function saveDocument(
  applicationId: string,
  kind: "resume" | "cover_letter",
  filename: string,
  contentType: string,
  content: string,
): string {
  const id = newId("doc_");
  run("DELETE FROM application_documents WHERE application_id = ? AND kind = ?", applicationId, kind);
  run(
    `INSERT INTO application_documents (id, application_id, kind, filename, content_type, content, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    id,
    applicationId,
    kind,
    filename,
    contentType,
    content,
    nowIso(),
  );
  return id;
}

export function saveFormAndAnswers(
  applicationId: string,
  form: ApplicationForm,
  answers: AnsweredField[],
): void {
  run("DELETE FROM application_questions WHERE application_id = ?", applicationId);
  run("DELETE FROM application_answers WHERE application_id = ?", applicationId);

  form.fields.forEach((field, position) => {
    run(
      `INSERT INTO application_questions (id, application_id, field_id, label, type, required, options_json, position)
       VALUES (?,?,?,?,?,?,?,?)`,
      newId("q_"),
      applicationId,
      field.id,
      field.label,
      field.type,
      field.required ? 1 : 0,
      toJson(field.options ?? []),
      position,
    );
  });

  for (const answer of answers) {
    run(
      `INSERT INTO application_answers (id, application_id, field_id, answer, source, confidence, needs_review, updated_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(application_id, field_id) DO UPDATE SET
         answer = excluded.answer, source = excluded.source,
         confidence = excluded.confidence, needs_review = excluded.needs_review,
         updated_at = excluded.updated_at`,
      newId("ans_"),
      applicationId,
      answer.fieldId,
      answer.answer,
      answer.source,
      answer.confidence,
      answer.needsReview ? 1 : 0,
      nowIso(),
    );
  }
}

export interface PreparedApplication {
  application: ApplicationRow;
  form: ApplicationForm;
  answers: AnsweredField[];
  canSubmitByApi: boolean;
  blockers: string[];
  warnings: string[];
}

const GENERIC_FIELDS: ApplicationForm["fields"] = [
  { id: "full_name", label: "Nombre completo", type: "text", required: true },
  { id: "email", label: "Email", type: "email", required: true },
  { id: "phone", label: "Telefono", type: "phone", required: false },
  { id: "location", label: "Ubicacion", type: "text", required: false },
  { id: "linkedin", label: "LinkedIn", type: "url", required: false },
];

/**
 * Prepara la postulacion: obtiene el formulario real cuando el connector lo
 * expone, y completa las respuestas con perfil + respuestas guardadas + IA.
 */
export async function prepareApplication(input: {
  userId: string;
  job: NormalizedJob;
  profile: ParsedProfile;
  profileMarkdown: string;
  match: JobMatch;
  storedAnswers: { question: string; answer: string }[];
}): Promise<PreparedApplication> {
  const application =
    findApplicationByJob(input.userId, input.job.id) ??
    createApplication({
      userId: input.userId,
      job: input.job,
      status: "MATCHED",
      matchScore: input.match.compatibilityScore,
    });

  const connector = connectorRegistry.get(input.job.source);
  const settings = connector ? resolveSettings(connector.id) : {};
  const warnings: string[] = [];
  const blockers: string[] = [];

  let form: ApplicationForm = {
    jobId: input.job.sourceJobId,
    source: input.job.source,
    fields: GENERIC_FIELDS,
    authoritative: false,
    notes: ["Formulario generico: la fuente no expone el formulario real por API."],
  };

  if (connector?.getApplicationForm) {
    try {
      const context = connectorRegistry.context(connector.id, settings);
      form = await connector.getApplicationForm(input.job.sourceJobId, context);
      if (form.notes?.length) warnings.push(...form.notes);
      if (!form.fields.length) {
        form = { ...form, fields: GENERIC_FIELDS };
        warnings.push("La fuente no devolvio campos: se usa un formulario generico.");
      }
    } catch (error) {
      warnings.push(
        `No se pudo obtener el formulario oficial: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const answers = await answerApplicationForm(
    form,
    input.profile,
    input.profileMarkdown,
    input.job,
    input.storedAnswers,
  );

  for (const answer of answers) {
    const field = form.fields.find((item) => item.id === answer.fieldId);
    if (field?.required && answer.answer === "UNKNOWN") {
      blockers.push(`Falta responder un campo obligatorio: ${field.label}`);
    }
  }

  const capabilities = connector?.getCapabilities();
  const canSubmitByApi = Boolean(
    capabilities?.apply && connector?.submitApplication && connector.isConfigured(settings),
  );
  if (!canSubmitByApi) {
    warnings.push(
      "Esta fuente no permite enviar la candidatura por API con la configuracion actual: se completa en el formulario original.",
    );
  }

  saveFormAndAnswers(application.id, form, answers);
  const updated =
    application.status === "MATCHED" || application.status === "DISCOVERED"
      ? (updateStatus(application.id, "READY_TO_APPLY", { message: "Postulacion preparada" }) ??
        application)
      : application;

  return { application: updated, form, answers, canSubmitByApi, blockers, warnings };
}

export interface SubmitResult {
  status: ApplicationStatus;
  message: string;
  externalApplicationId?: string;
  applicationUrl?: string;
}

/** Envia la candidatura por API cuando existe autorizacion; si no, deriva al usuario. */
export async function submitApplication(input: {
  userId: string;
  applicationId: string;
  payload: ApplicationPayload;
}): Promise<SubmitResult> {
  const application = getApplication(input.userId, input.applicationId);
  if (!application) throw new Error("Postulacion no encontrada");

  const job = getJob(application.job_id);
  if (!job) throw new Error("La oferta asociada ya no existe");

  const connector = connectorRegistry.get(job.source);
  const settings = connector ? resolveSettings(job.source) : {};

  if (!connector?.submitApplication || !connector.getCapabilities().apply) {
    const result: SubmitResult = {
      status: "REQUIRES_USER_ACTION",
      message: `${job.source} no ofrece envio de candidaturas por API. Complete la postulacion en el formulario original.`,
      applicationUrl: job.applicationUrl ?? job.sourceUrl,
    };
    updateStatus(application.id, "REQUIRES_USER_ACTION", { message: result.message, force: true });
    return result;
  }

  if (!connector.isConfigured(settings)) {
    const result: SubmitResult = {
      status: "REQUIRES_USER_ACTION",
      message: `Faltan credenciales validas para ${connector.name}. Configure la fuente o postule manualmente.`,
      applicationUrl: job.applicationUrl ?? job.sourceUrl,
    };
    updateStatus(application.id, "REQUIRES_USER_ACTION", { message: result.message, force: true });
    return result;
  }

  updateStatus(application.id, "APPLYING", { message: "Enviando candidatura", force: true });

  try {
    const context = connectorRegistry.context(job.source, settings);
    const outcome = await connector.submitApplication(job.sourceJobId, input.payload, context);
    updateStatus(application.id, outcome.status, {
      message: outcome.message,
      externalId: outcome.externalApplicationId,
      error: outcome.status === "FAILED" ? outcome.message : undefined,
      force: true,
    });
    return {
      status: outcome.status,
      message: outcome.message ?? "Sin mensaje del proveedor",
      externalApplicationId: outcome.externalApplicationId,
      applicationUrl: job.applicationUrl ?? job.sourceUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateStatus(application.id, "FAILED", { message, error: message, force: true });
    return { status: "FAILED", message, applicationUrl: job.applicationUrl ?? job.sourceUrl };
  }
}

export interface ApplicationView extends ApplicationRow {
  job_title: string;
  company_name: string;
  source_url: string;
  location: string | null;
  remote_type: string;
}

export function listApplications(
  userId: string,
  filters: { status?: string; limit?: number; offset?: number } = {},
): { applications: ApplicationView[]; total: number } {
  const where = ["a.user_id = ?"];
  const params: unknown[] = [userId];
  if (filters.status) {
    where.push("a.status = ?");
    params.push(filters.status);
  }
  const clause = `WHERE ${where.join(" AND ")}`;

  return {
    total:
      get<{ count: number }>(`SELECT COUNT(*) AS count FROM applications a ${clause}`, ...params)
        ?.count ?? 0,
    applications: all<ApplicationView>(
      `SELECT a.*, j.title AS job_title, j.company_name, j.source_url, j.location, j.remote_type
       FROM applications a JOIN jobs j ON j.id = a.job_id
       ${clause}
       ORDER BY a.updated_at DESC
       LIMIT ? OFFSET ?`,
      ...params,
      Math.min(filters.limit ?? 100, 300),
      filters.offset ?? 0,
    ),
  };
}

export function applicationStats(userId: string): { status: string; count: number }[] {
  return all<{ status: string; count: number }>(
    "SELECT status, COUNT(*) AS count FROM applications WHERE user_id = ? GROUP BY status",
    userId,
  );
}
