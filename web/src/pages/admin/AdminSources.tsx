import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { api } from "../../lib/api.ts";
import type { SourceView } from "../../lib/api.ts";
import { cx, errorMessage, formatDate, relativeTime, useToast } from "../../lib/ui.tsx";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
  Toggle,
} from "../../components/primitives.tsx";
import { PageHeader } from "../../components/Layout.tsx";

const CATEGORY_LABELS: Record<string, string> = {
  job_board: "Job boards",
  ats: "ATS",
  freelance: "Freelance",
  aggregator: "Agregadores",
};

const MODE_LABELS: Record<string, { label: string; tone: "success" | "info" | "warning" | "neutral" }> = {
  SEARCH_ONLY: { label: "Solo busqueda", tone: "info" },
  API_APPLICATION: { label: "Postulacion por API", tone: "success" },
  BROWSER_APPLICATION: { label: "Requiere navegador", tone: "warning" },
  HUMAN_REQUIRED: { label: "Requiere intervencion", tone: "warning" },
  UNKNOWN: { label: "Pendiente de verificar", tone: "neutral" },
};

const CAPABILITY_LABELS: Record<string, string> = {
  search: "Busqueda",
  jobDetails: "Detalle",
  applicationForm: "Formulario",
  apply: "Postular",
  applicationStatus: "Estado",
  oauth: "OAuth",
  apiKey: "API key",
  browserAutomationRequired: "Navegador",
  resumeUpload: "Subir CV",
  coverLetterUpload: "Subir carta",
  customQuestions: "Preguntas",
};

export function AdminSourcesPage() {
  const toast = useToast();
  const [sources, setSources] = useState<SourceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Record<string, { status: string; latencyMs?: number; message?: string }>>({});
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState<SourceView | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [interval, setIntervalValue] = useState(60);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.get<{ sources: SourceView[] }>("/api/admin/sources");
      setSources(result.sources);
    } catch (error) {
      toast.error("No se pudieron cargar las fuentes", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const result = await api.get<{
        connectors: { id: string; status: string; latencyMs?: number; message?: string }[];
      }>("/api/admin/health");
      setHealth(
        Object.fromEntries(
          result.connectors.map((connector) => [
            connector.id,
            { status: connector.status, latencyMs: connector.latencyMs, message: connector.message },
          ]),
        ),
      );
      toast.success("Chequeo completo");
    } catch (error) {
      toast.error("No se pudo chequear", errorMessage(error));
    } finally {
      setChecking(false);
    }
  };

  const toggleEnabled = async (source: SourceView) => {
    try {
      await api.put(`/api/admin/sources/${source.id}`, { enabled: !source.enabled });
      await load();
    } catch (error) {
      toast.error("No se pudo actualizar", errorMessage(error));
    }
  };

  const openSettings = (source: SourceView) => {
    setEditing(source);
    setValues({ ...source.settings });
    setIntervalValue(source.syncIntervalMinutes);
  };

  const saveSettings = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/sources/${editing.id}`, {
        settings: values,
        syncIntervalMinutes: interval,
      });
      toast.success("Configuracion guardada");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async (source: SourceView) => {
    setSyncingId(source.id);
    try {
      const result = await api.post<{ jobs: number; errors: string[] }>(
        `/api/admin/sources/${source.id}/sync`,
      );
      if (result.errors.length) toast.warning(`${source.name}: con avisos`, result.errors.join(" · "));
      else toast.success(`${source.name}: ${result.jobs} ofertas sincronizadas`);
      await load();
    } catch (error) {
      toast.error("La sincronizacion fallo", errorMessage(error));
    } finally {
      setSyncingId(null);
    }
  };

  const grouped = useMemo(() => {
    const groups: Record<string, SourceView[]> = {};
    for (const source of sources) {
      (groups[source.category] ??= []).push(source);
    }
    return groups;
  }, [sources]);

  return (
    <div>
      <PageHeader
        title="Conectores"
        description="Cada plataforma se integra como un connector independiente. Un fallo en uno no afecta al resto."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={15} />} loading={checking} onClick={checkHealth}>
            Chequear estado
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52" />
          ))}
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-7">
            <h2 className="text-muted mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              <Cable size={13} />
              {CATEGORY_LABELS[category] ?? category}
              <span className="text-[10px] font-normal">({items.length})</span>
            </h2>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((source) => {
                const mode = MODE_LABELS[source.mode] ?? MODE_LABELS.UNKNOWN;
                const status = health[source.id];
                return (
                  <Card key={source.id} className="animate-fade-up flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-[var(--text-strong)]">
                          {source.name}
                        </h3>
                        <a
                          href={source.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted mt-0.5 inline-flex items-center gap-1 text-[11px] hover:text-[var(--text-strong)]"
                        >
                          Documentacion <ExternalLink size={10} />
                        </a>
                      </div>
                      <Toggle checked={source.enabled} onChange={() => toggleEnabled(source)} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge tone={mode.tone}>{mode.label}</Badge>
                      <Badge tone={source.configured ? "success" : "warning"}>
                        {source.configured ? "Configurado" : "Falta configurar"}
                      </Badge>
                      {status && (
                        <Badge
                          tone={
                            status.status === "ONLINE"
                              ? "success"
                              : status.status === "NOT_CONFIGURED"
                                ? "neutral"
                                : status.status === "DEGRADED"
                                  ? "warning"
                                  : "danger"
                          }
                        >
                          {status.status === "ONLINE" ? (
                            <CheckCircle2 size={10} />
                          ) : (
                            <AlertTriangle size={10} />
                          )}
                          {status.status}
                          {status.latencyMs ? ` ${status.latencyMs}ms` : ""}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {Object.entries(source.capabilities)
                        .filter(([, enabled]) => enabled)
                        .map(([key]) => (
                          <span
                            key={key}
                            className="text-muted rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px]"
                          >
                            {CAPABILITY_LABELS[key] ?? key}
                          </span>
                        ))}
                    </div>

                    {source.restrictions.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-muted flex cursor-pointer items-center gap-1.5 text-[11px]">
                          <ShieldAlert size={11} /> Restricciones de uso ({source.restrictions.length})
                        </summary>
                        <ul className="text-muted mt-1.5 space-y-1 text-[10px] leading-relaxed">
                          {source.restrictions.map((restriction) => (
                            <li key={restriction}>• {restriction}</li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <p className="text-muted mt-3 text-[10px]">
                      {source.lastSyncAt
                        ? `Ultima sync ${relativeTime(source.lastSyncAt)} · ${source.lastStatus}`
                        : "Sin sincronizar"}
                      {" · "}
                      {source.rateLimit.requestsPerMinute}/min
                    </p>

                    <div className="mt-auto flex gap-1.5 border-t pt-3">
                      {source.settingsSchema.length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          icon={<Settings2 size={12} />}
                          onClick={() => openSettings(source)}
                        >
                          Configurar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={source.settingsSchema.length ? "ghost" : "secondary"}
                        className={source.settingsSchema.length ? undefined : "flex-1"}
                        icon={<RefreshCw size={12} />}
                        loading={syncingId === source.id}
                        disabled={!source.enabled || !source.configured}
                        onClick={() => syncNow(source)}
                      >
                        Sincronizar
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Configurar ${editing?.name ?? ""}`}
        description="Los secretos se guardan cifrados en la base local y nunca se devuelven en claro."
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button size="sm" loading={saving} onClick={saveSettings} icon={<Save size={13} />}>
              Guardar
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            {editing.settingsSchema.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                required={field.required}
                hint={
                  field.type === "secret"
                    ? `${field.help ?? ""} Dejar vacio para conservar el valor actual.`.trim()
                    : field.help
                }
              >
                {field.type === "list" ? (
                  <Textarea
                    rows={3}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                    placeholder={field.placeholder}
                    className="font-mono text-xs"
                  />
                ) : (
                  <Input
                    type={field.type === "secret" ? "password" : "text"}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                    placeholder={field.placeholder}
                  />
                )}
              </Field>
            ))}

            <Field
              label={`Intervalo de sincronizacion: ${interval} minutos`}
              hint={`Limite de la fuente: ${editing.rateLimit.requestsPerMinute} req/min, ${editing.rateLimit.requestsPerHour} req/hora`}
            >
              <input
                type="range"
                min={5}
                max={720}
                step={5}
                value={interval}
                onChange={(event) => setIntervalValue(Number(event.target.value))}
                className="accent-brand-500 w-full"
              />
            </Field>

            {editing.lastMessage && (
              <div
                className={cx(
                  "rounded-xl border px-3.5 py-2.5 text-[11px]",
                  editing.lastStatus === "ERROR"
                    ? "border-rose-500/25 bg-rose-500/8 text-rose-300"
                    : "text-muted bg-[var(--surface-sunken)]",
                )}
              >
                Ultimo mensaje ({formatDate(editing.lastSyncAt, true)}): {editing.lastMessage}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
