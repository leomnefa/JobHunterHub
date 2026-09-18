import { useEffect, useState } from "react";
import { Download, FileText, Mail, Plus, Printer, Save, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api.ts";
import { cx, errorMessage, formatDate, useToast } from "../lib/ui.tsx";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from "../components/primitives.tsx";
import { PageHeader } from "../components/Layout.tsx";

interface ResumeRow {
  id: string;
  label: string;
  kind: "base" | "tailored" | "cover_letter";
  generated_by: string;
  created_at: string;
  job_id: string | null;
  job_title: string | null;
  company_name: string | null;
}

const KIND_LABELS: Record<string, string> = {
  base: "CV base",
  tailored: "CV adaptado",
  cover_letter: "Carta",
};

export function ResumesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ResumeRow[]>([]);
  const [filter, setFilter] = useState<"" | "base" | "tailored" | "cover_letter">("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string; label: string; content: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  /**
   * `showSkeleton` solo en la carga inicial o al cambiar de filtro. Tras una
   * accion del usuario se refresca en silencio: reemplazar la lista por
   * skeletons colapsa la altura de la pagina y el scroll salta al tope.
   */
  const load = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const result = await api.get<{ resumes: ResumeRow[] }>(
        `/api/resumes${filter ? `?kind=${filter}` : ""}`,
      );
      setRows(result.resumes);
    } catch (error) {
      toast.error("No se pudieron cargar los documentos", errorMessage(error));
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const open = async (id: string) => {
    try {
      const result = await api.get<{ resume: { id: string; label: string; content: string } }>(
        `/api/resumes/${id}`,
      );
      setEditing(result.resume);
    } catch (error) {
      toast.error("No se pudo abrir", errorMessage(error));
    }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/api/resumes/${editing.id}`, {
        label: editing.label,
        content: editing.content,
      });
      toast.success("Documento guardado");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    setSaving(true);
    try {
      await api.post("/api/resumes", { label: newLabel, content: newContent });
      toast.success("CV creado");
      setCreating(false);
      setNewLabel("");
      setNewContent("");
      await load();
    } catch (error) {
      toast.error("No se pudo crear", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/api/resumes/${id}`);
      toast.success("Documento eliminado");
      await load();
    } catch (error) {
      toast.error("No se pudo eliminar", errorMessage(error));
    }
  };

  const download = (label: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label.replace(/[^\w\s-]/g, "").trim() || "documento"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Mis CV"
        description="CVs adaptados y cartas generadas para cada oferta. El perfil original nunca se modifica."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>
            Nuevo CV base
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {[
          { value: "", label: "Todos" },
          { value: "tailored", label: "CV adaptados" },
          { value: "base", label: "CV base" },
          { value: "cover_letter", label: "Cartas" },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value as typeof filter)}
            className={cx(
              "rounded-lg border px-3 py-1.5 text-xs transition",
              filter === option.value
                ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={24} />}
            title="Todavia no hay documentos"
            description="Cuando prepare una postulacion, el CV adaptado y la carta quedan guardados aca para reutilizarlos."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className="animate-fade-up flex flex-col">
              <div className="flex items-start gap-3">
                <span
                  className={cx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    row.kind === "cover_letter"
                      ? "bg-accent-500/12 text-accent-400"
                      : "bg-brand-500/12 text-brand-400",
                  )}
                >
                  {row.kind === "cover_letter" ? <Mail size={17} /> : <FileText size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-medium text-[var(--text-strong)]">
                    {row.label}
                  </h3>
                  <p className="text-muted mt-0.5 text-[11px]">{formatDate(row.created_at)}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={row.kind === "tailored" ? "brand" : "neutral"}>
                  {KIND_LABELS[row.kind]}
                </Badge>
                <Badge tone={row.generated_by === "llm" ? "info" : "neutral"}>
                  {row.generated_by === "llm" ? "IA" : row.generated_by === "manual" ? "Manual" : "Local"}
                </Badge>
              </div>

              {row.company_name && (
                <p className="text-muted mt-2 truncate text-[11px]">
                  Para: {row.job_title} · {row.company_name}
                </p>
              )}

              <div className="mt-auto flex gap-1.5 border-t pt-3">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => open(row.id)}>
                  Abrir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={12} />}
                  onClick={() => remove(row.id)}
                  aria-label="Eliminar"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.label ?? ""}
        size="xl"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<Printer size={13} />}
              onClick={() => window.print()}
            >
              Imprimir / PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={13} />}
              onClick={() => editing && download(editing.label, editing.content)}
            >
              Descargar
            </Button>
            <Button size="sm" loading={saving} onClick={save} icon={<Save size={13} />}>
              Guardar
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Nombre del documento">
              <Input
                value={editing.label}
                onChange={(event) => setEditing({ ...editing, label: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Contenido (Markdown)">
                <Textarea
                  value={editing.content}
                  onChange={(event) => setEditing({ ...editing, content: event.target.value })}
                  rows={20}
                  className="font-mono text-xs"
                />
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--text-strong)]">Vista previa</p>
                <div className="markdown-body max-h-[30rem] overflow-y-auto rounded-xl border bg-[var(--surface-sunken)] p-4">
                  <Markdown remarkPlugins={[remarkGfm]}>{editing.content}</Markdown>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo CV base"
        description="Un CV de referencia que puede reutilizar como punto de partida."
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button size="sm" loading={saving} onClick={create} disabled={!newLabel || !newContent}>
              Crear
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre" required>
            <Input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="CV Senior Data Engineer"
            />
          </Field>
          <Field label="Contenido en Markdown" required>
            <Textarea
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              rows={14}
              className="font-mono text-xs"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
