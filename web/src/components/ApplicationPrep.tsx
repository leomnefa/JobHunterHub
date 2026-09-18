import { useMemo, useState } from "react";
import { AlertTriangle, Download, ExternalLink, FileText, Mail, Send } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api.ts";
import type { Match } from "../lib/api.ts";
import { cx, errorMessage, useToast } from "../lib/ui.tsx";
import { Badge, Button, Field, Input, Textarea } from "./primitives.tsx";

export interface PreparedApplication {
  applicationId: string;
  status: string;
  match: Match;
  cv: { id: string; content: string; generatedBy: string; warnings: string[] };
  coverLetter: { id: string; content: string; generatedBy: string; warnings: string[] } | null;
  form: {
    fields: { id: string; label: string; type: string; required: boolean; description?: string }[];
    authoritative: boolean;
    notes?: string[];
  };
  answers: {
    fieldId: string;
    label: string;
    answer: string;
    source: string;
    confidence: number;
    needsReview: boolean;
  }[];
  canSubmitByApi: boolean;
  blockers: string[];
  warnings: string[];
  applicationUrl: string;
}

type Tab = "cv" | "carta" | "formulario";

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Revision previa al envio: CV adaptado, carta y respuestas del formulario.
 * Nada se envia sin que el usuario lo confirme.
 */
export function ApplicationPrep({
  data,
  onDone,
}: {
  data: PreparedApplication;
  onDone: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("cv");
  const [cv, setCv] = useState(data.cv.content);
  const [cover, setCover] = useState(data.coverLetter?.content ?? "");
  const [answers, setAnswers] = useState(data.answers);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const pending = useMemo(
    () => answers.filter((answer) => answer.answer === "UNKNOWN" || answer.needsReview).length,
    [answers],
  );

  const saveAll = async () => {
    setSaving(true);
    try {
      await api.put(`/api/resumes/${data.cv.id}`, { label: "CV adaptado", content: cv });
      if (data.coverLetter) {
        await api.put(`/api/resumes/${data.coverLetter.id}`, {
          label: "Carta de presentacion",
          content: cover,
        });
      }
      await api.put(`/api/applications/${data.applicationId}/answers`, {
        answers: answers.map((answer) => ({ fieldId: answer.fieldId, answer: answer.answer })),
      });
      toast.success("Cambios guardados");
      setEditing(false);
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      await saveAll();
      const result = await api.post<{ status: string; message: string; applicationUrl?: string }>(
        `/api/applications/${data.applicationId}/apply`,
      );
      if (result.status === "SUBMITTED") {
        toast.success("Candidatura enviada", result.message);
        onDone();
      } else {
        toast.warning("Requiere completarse manualmente", result.message);
      }
    } catch (error) {
      toast.error("No se pudo enviar", errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { id: "cv", label: "CV adaptado", icon: FileText },
    ...(data.coverLetter ? [{ id: "carta" as Tab, label: "Carta", icon: Mail }] : []),
    { id: "formulario", label: "Formulario", icon: Send, count: data.form.fields.length },
  ];

  return (
    <div className="space-y-4">
      {(data.warnings.length > 0 || data.blockers.length > 0) && (
        <div className="space-y-2">
          {data.blockers.map((blocker) => (
            <div
              key={blocker}
              className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/8 px-3.5 py-2.5 text-[11px] text-rose-300"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {blocker}
            </div>
          ))}
          {data.warnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5 text-[11px] text-amber-300"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {warning}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                tab === item.id
                  ? "bg-brand-500/12 text-brand-300"
                  : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
              )}
            >
              <item.icon size={13} />
              {item.label}
              {item.count !== undefined && (
                <span className="text-muted text-[10px]">({item.count})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={data.cv.generatedBy === "llm" ? "brand" : "neutral"}>
            {data.cv.generatedBy === "llm" ? "Generado con IA" : "Generado localmente"}
          </Badge>
          <Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)}>
            {editing ? "Vista previa" : "Editar"}
          </Button>
        </div>
      </div>

      <div className="min-h-[18rem]">
        {tab === "cv" &&
          (editing ? (
            <Textarea
              value={cv}
              onChange={(event) => setCv(event.target.value)}
              rows={20}
              className="font-mono text-xs"
            />
          ) : (
            <div className="markdown-body max-h-[26rem] overflow-y-auto rounded-xl border bg-[var(--surface-sunken)] p-5">
              <Markdown remarkPlugins={[remarkGfm]}>{cv}</Markdown>
            </div>
          ))}

        {tab === "carta" &&
          (editing ? (
            <Textarea
              value={cover}
              onChange={(event) => setCover(event.target.value)}
              rows={16}
              className="text-xs"
            />
          ) : (
            <div className="max-h-[26rem] overflow-y-auto rounded-xl border bg-[var(--surface-sunken)] p-5 text-xs leading-relaxed whitespace-pre-wrap">
              {cover}
            </div>
          ))}

        {tab === "formulario" && (
          <div className="space-y-3">
            {!data.form.authoritative && (
              <p className="text-muted text-[11px]">
                La fuente no expone el formulario real por API: estos son los campos habituales.
              </p>
            )}
            {answers.length === 0 && (
              <p className="text-muted text-xs">Esta oferta no requiere respuestas adicionales.</p>
            )}
            {answers.map((answer, index) => {
              const field = data.form.fields.find((item) => item.id === answer.fieldId);
              const unknown = answer.answer === "UNKNOWN";
              return (
                <Field
                  key={answer.fieldId}
                  label={`${answer.label}${field?.required ? " *" : ""}`}
                  hint={
                    unknown
                      ? "Sin dato en el perfil: completelo usted."
                      : answer.source === "llm"
                        ? "Sugerido por IA: revise antes de enviar."
                        : answer.source === "stored"
                          ? "Tomado de sus respuestas guardadas."
                          : "Tomado del perfil."
                  }
                >
                  {field?.type === "textarea" ? (
                    <Textarea
                      rows={3}
                      value={unknown ? "" : answer.answer}
                      placeholder={unknown ? "Escriba su respuesta" : ""}
                      onChange={(event) => {
                        const next = [...answers];
                        next[index] = { ...answer, answer: event.target.value, needsReview: false };
                        setAnswers(next);
                      }}
                      className={cx(unknown && "border-amber-500/40")}
                    />
                  ) : (
                    <Input
                      value={unknown ? "" : answer.answer}
                      placeholder={unknown ? "Escriba su respuesta" : ""}
                      onChange={(event) => {
                        const next = [...answers];
                        next[index] = { ...answer, answer: event.target.value, needsReview: false };
                        setAnswers(next);
                      }}
                      className={cx(unknown && "border-amber-500/40")}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Download size={13} />}
            onClick={() => downloadText("cv-adaptado.md", cv)}
          >
            Descargar CV
          </Button>
          {data.coverLetter && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Download size={13} />}
              onClick={() => downloadText("carta-presentacion.md", cover)}
            >
              Descargar carta
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 && (
            <span className="text-[11px] text-amber-400">{pending} respuesta(s) a revisar</span>
          )}
          <Button size="sm" variant="secondary" loading={saving} onClick={saveAll}>
            Guardar
          </Button>
          {data.canSubmitByApi ? (
            <Button size="sm" loading={sending} onClick={send} icon={<Send size={13} />}>
              Enviar candidatura
            </Button>
          ) : (
            <a href={data.applicationUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" icon={<ExternalLink size={13} />}>
                Postular en el sitio
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
