import { useEffect, useState } from "react";
import {
  Building2,
  ExternalLink,
  FileText,
  Filter,
  RotateCcw,
  ScrollText,
  Trash2,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api.ts";
import type { ApplicationRow } from "../lib/api.ts";
import {
  STATUS_LABELS,
  STATUS_TONES,
  cx,
  errorMessage,
  formatDate,
  relativeTime,
  scoreTone,
  useToast,
} from "../lib/ui.tsx";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from "../components/primitives.tsx";
import { PageHeader } from "../components/Layout.tsx";
import { sourceLabel } from "../components/JobCard.tsx";

interface ApplicationDetail {
  application: ApplicationRow;
  job: { title: string; company: { name: string }; sourceUrl: string; description: string } | null;
  questions: { id: string; field_id: string; label: string; required: number }[];
  answers: { field_id: string; answer: string; source: string; needs_review: number }[];
  events: { id: string; status: string; message: string | null; created_at: string }[];
  resume: { id: string; label: string; content: string } | null;
  coverLetter: { id: string; label: string; content: string } | null;
}

const STATUS_FILTERS = [
  "",
  "READY_TO_APPLY",
  "REQUIRES_USER_ACTION",
  "SUBMITTED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "FAILED",
  "WITHDRAWN",
];

export function ApplicationsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [stats, setStats] = useState<{ status: string; count: number }[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [notes, setNotes] = useState("");

  /**
   * `showSkeleton` solo en la carga inicial o al cambiar de filtro. Tras una
   * accion del usuario se refresca en silencio: reemplazar la lista por
   * skeletons colapsa la altura de la pagina y el scroll salta al tope.
   */
  const load = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const result = await api.get<{
        applications: ApplicationRow[];
        stats: { status: string; count: number }[];
      }>(`/api/applications${status ? `?status=${status}` : ""}`);
      setRows(result.applications);
      setStats(result.stats);
    } catch (error) {
      toast.error("No se pudieron cargar las postulaciones", errorMessage(error));
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const open = async (id: string) => {
    try {
      const result = await api.get<ApplicationDetail>(`/api/applications/${id}`);
      setDetail(result);
      setNotes(result.application.notes ?? "");
    } catch (error) {
      toast.error("No se pudo abrir la postulacion", errorMessage(error));
    }
  };

  const changeStatus = async (id: string, next: string) => {
    try {
      await api.post(`/api/applications/${id}/status`, { status: next });
      toast.success("Estado actualizado");
      await load();
      if (detail?.application.id === id) await open(id);
    } catch (error) {
      toast.error("No se pudo actualizar", errorMessage(error));
    }
  };

  const saveNotes = async (id: string) => {
    try {
      await api.put(`/api/applications/${id}/notes`, { notes });
      toast.success("Notas guardadas");
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    }
  };

  const cancel = async (id: string) => {
    try {
      await api.post(`/api/applications/${id}/cancel`);
      toast.success("Postulacion retirada");
      setDetail(null);
      await load();
    } catch (error) {
      toast.error("No se pudo retirar", errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Mis postulaciones"
        description="Historial completo con estado, documentos y trazabilidad de cada candidatura."
        actions={
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-52">
              {STATUS_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value ? (STATUS_LABELS[value] ?? value) : "Todos los estados"}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {stats.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {stats.map((item) => (
            <button
              key={item.status}
              onClick={() => setStatus(item.status === status ? "" : item.status)}
              className={cx(
                "rounded-xl border px-3 py-1.5 text-xs transition",
                STATUS_TONES[item.status],
                status === item.status && "ring-2 ring-brand-500/40",
              )}
            >
              {STATUS_LABELS[item.status] ?? item.status}
              <span className="ml-1.5 font-semibold tabular-nums">{item.count}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ScrollText size={24} />}
            title="Sin postulaciones registradas"
            description="Cuando prepare una postulacion desde una oferta, o registre una manual, aparecera en este historial."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => {
            const tone = row.match_score !== null ? scoreTone(row.match_score) : null;
            return (
              <Card
                key={row.id}
                className="animate-fade-up cursor-pointer transition hover:-translate-y-0.5"
              >
                <div onClick={() => open(row.id)} className="flex items-start gap-4">
                  <span className="bg-brand-500/10 text-brand-400 grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                    <Building2 size={18} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-[var(--text-strong)]">
                      {row.job_title}
                    </h3>
                    <p className="text-muted mt-0.5 truncate text-xs">
                      {row.company_name} · {row.location || "Sin ubicacion"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone="brand">{sourceLabel(row.source)}</Badge>
                      <span
                        className={cx(
                          "rounded-lg border px-2 py-0.5 text-[10px]",
                          STATUS_TONES[row.status],
                        )}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                      {row.resume_id && <Badge tone="info">CV generado</Badge>}
                      {row.external_application_id && (
                        <Badge tone="success">id {row.external_application_id}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {tone && (
                      <span className={cx("text-lg font-semibold tabular-nums", tone.text)}>
                        {Math.round(row.match_score!)}
                      </span>
                    )}
                    <span className="text-muted text-[10px]">{relativeTime(row.updated_at)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.application.job_title ?? ""}
        description={`${detail?.application.company_name ?? ""} · ${sourceLabel(detail?.application.source ?? "")}`}
        size="xl"
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={detail.application.status}
                onChange={(event) => changeStatus(detail.application.id, event.target.value)}
                className="w-56"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <a href={detail.application.source_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary" icon={<ExternalLink size={13} />}>
                  Oferta original
                </Button>
              </a>
              {["FAILED", "REQUIRES_USER_ACTION"].includes(detail.application.status) && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RotateCcw size={13} />}
                  onClick={async () => {
                    await api.post(`/api/applications/${detail.application.id}/retry`);
                    toast.success("Marcada para reintento");
                    await open(detail.application.id);
                    await load();
                  }}
                >
                  Reintentar
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={13} />}
                onClick={() => cancel(detail.application.id)}
              >
                Retirar
              </Button>
            </div>

            {detail.application.error_message && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-3.5 py-2.5 text-[11px] text-rose-300">
                {detail.application.error_message}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold text-[var(--text-strong)]">
                  Respuestas enviadas
                </h4>
                {detail.answers.length ? (
                  <dl className="space-y-1.5 text-[11px]">
                    {detail.answers.map((answer) => (
                      <div key={answer.field_id} className="rounded-lg bg-[var(--surface-sunken)] p-2">
                        <dt className="text-muted">
                          {detail.questions.find((q) => q.field_id === answer.field_id)?.label ??
                            answer.field_id}
                        </dt>
                        <dd className="mt-0.5 text-[var(--text-strong)]">{answer.answer}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-muted text-[11px]">Sin respuestas registradas.</p>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold text-[var(--text-strong)]">Historial</h4>
                <ol className="space-y-2">
                  {detail.events.map((event) => (
                    <li key={event.id} className="flex gap-2.5">
                      <span className="bg-brand-500/40 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-[var(--text-strong)]">
                          {STATUS_LABELS[event.status] ?? event.status}
                        </p>
                        {event.message && (
                          <p className="text-muted text-[10px] leading-relaxed">{event.message}</p>
                        )}
                        <p className="text-muted text-[10px]">{formatDate(event.created_at, true)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {detail.resume && (
              <details className="rounded-xl border bg-[var(--surface-sunken)] p-3">
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--text-strong)]">
                  <FileText size={13} /> CV enviado
                </summary>
                <div className="markdown-body mt-3 max-h-80 overflow-y-auto">
                  <Markdown remarkPlugins={[remarkGfm]}>{detail.resume.content}</Markdown>
                </div>
              </details>
            )}

            {detail.coverLetter && (
              <details className="rounded-xl border bg-[var(--surface-sunken)] p-3">
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--text-strong)]">
                  <FileText size={13} /> Carta de presentacion
                </summary>
                <p className="mt-3 max-h-80 overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap">
                  {detail.coverLetter.content}
                </p>
              </details>
            )}

            <div>
              <h4 className="mb-2 text-xs font-semibold text-[var(--text-strong)]">Notas</h4>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Contacto, seguimiento, proximos pasos..."
                className="text-xs"
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => saveNotes(detail.application.id)}>
                  Guardar notas
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
