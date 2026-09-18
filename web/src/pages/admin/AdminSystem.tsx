import { useEffect, useState } from "react";
import {
  Activity,
  Brain,
  Database,
  Eraser,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "../../lib/api.ts";
import { cx, errorMessage, formatDate, relativeTime, useToast } from "../../lib/ui.tsx";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Skeleton,
  Spinner,
} from "../../components/primitives.tsx";
import { PageHeader } from "../../components/Layout.tsx";

/* --------------------------------- IA ---------------------------------- */

interface AiConfig {
  status: { provider: string; ready: boolean; detail: string };
  settings: {
    provider: string;
    anthropicModel: string;
    openaiModel: string;
    ollamaBaseUrl: string;
    ollamaModel: string;
    hasAnthropicKey: boolean;
    hasOpenaiKey: boolean;
  };
}

export function AdminAiPage() {
  const toast = useToast();
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [provider, setProvider] = useState("heuristic");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const result = await api.get<AiConfig>("/api/admin/ai");
      setConfig(result);
      setProvider(result.settings.provider);
      setAnthropicModel(result.settings.anthropicModel);
      setOpenaiModel(result.settings.openaiModel);
      setOllamaUrl(result.settings.ollamaBaseUrl);
      setOllamaModel(result.settings.ollamaModel);
    } catch (error) {
      toast.error("No se pudo cargar la configuracion de IA", errorMessage(error));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/api/admin/ai", {
        provider,
        anthropicApiKey: anthropicKey || undefined,
        anthropicModel,
        openaiApiKey: openaiKey || undefined,
        openaiModel,
        ollamaBaseUrl: ollamaUrl,
        ollamaModel,
      });
      setAnthropicKey("");
      setOpenaiKey("");
      toast.success("Configuracion guardada");
      await load();
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!config) return <Spinner label="Cargando configuracion..." />;

  return (
    <div>
      <PageHeader
        title="Inteligencia artificial"
        description="El proveedor de IA enriquece el analisis, el CV adaptado y las respuestas. Sin IA la plataforma funciona igual con el motor deterministico."
        actions={
          <Button icon={<Save size={15} />} loading={saving} onClick={save}>
            Guardar
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Proveedor" subtitle="Solo uno activo a la vez" icon={<Brain size={17} />} />

          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              {
                id: "heuristic",
                name: "Solo local (heuristico)",
                detail: "Sin API externa. Scoring deterministico y documentos armados desde el perfil.",
              },
              {
                id: "anthropic",
                name: "Anthropic Claude",
                detail: "Analisis y redaccion con modelos Claude.",
              },
              {
                id: "openai",
                name: "OpenAI",
                detail: "Compatible con la API de chat completions.",
              },
              {
                id: "ollama",
                name: "Ollama (local)",
                detail: "Modelos ejecutandose en esta misma PC.",
              },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setProvider(option.id)}
                className={cx(
                  "rounded-xl border p-3.5 text-left transition",
                  provider === option.id
                    ? "border-brand-500/50 bg-brand-500/10"
                    : "hover:bg-[var(--surface-sunken)]",
                )}
              >
                <p className="text-sm font-medium text-[var(--text-strong)]">{option.name}</p>
                <p className="text-muted mt-1 text-[11px] leading-relaxed">{option.detail}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4 border-t pt-5">
            {provider === "anthropic" && (
              <>
                <Field
                  label="API key de Anthropic"
                  hint={
                    config.settings.hasAnthropicKey
                      ? "Ya hay una key guardada. Dejar vacio para conservarla."
                      : "Se guarda cifrada en la base local."
                  }
                >
                  <Input
                    type="password"
                    value={anthropicKey}
                    onChange={(event) => setAnthropicKey(event.target.value)}
                    placeholder="sk-ant-..."
                  />
                </Field>
                <Field label="Modelo">
                  <Input
                    value={anthropicModel}
                    onChange={(event) => setAnthropicModel(event.target.value)}
                    placeholder="claude-sonnet-5"
                  />
                </Field>
              </>
            )}

            {provider === "openai" && (
              <>
                <Field
                  label="API key de OpenAI"
                  hint={
                    config.settings.hasOpenaiKey
                      ? "Ya hay una key guardada. Dejar vacio para conservarla."
                      : "Se guarda cifrada en la base local."
                  }
                >
                  <Input
                    type="password"
                    value={openaiKey}
                    onChange={(event) => setOpenaiKey(event.target.value)}
                    placeholder="sk-..."
                  />
                </Field>
                <Field label="Modelo">
                  <Input value={openaiModel} onChange={(event) => setOpenaiModel(event.target.value)} />
                </Field>
              </>
            )}

            {provider === "ollama" && (
              <>
                <Field label="URL de Ollama">
                  <Input value={ollamaUrl} onChange={(event) => setOllamaUrl(event.target.value)} />
                </Field>
                <Field label="Modelo">
                  <Input value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)} />
                </Field>
              </>
            )}

            {provider === "heuristic" && (
              <p className="text-muted text-xs leading-relaxed">
                Sin proveedor externo. El matching usa el scoring deterministico y los documentos se
                arman reordenando el contenido real del perfil. Ninguna informacion sale de esta PC.
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Estado actual" icon={<Sparkles size={17} />} />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-strong)] capitalize">
                {config.status.provider}
              </span>
              <Badge tone={config.status.ready ? "success" : "warning"}>
                {config.status.ready ? "Operativo" : "Falta configurar"}
              </Badge>
            </div>
            <p className="text-muted mt-2 text-xs">{config.status.detail}</p>
          </Card>

          <Card>
            <CardHeader title="Garantias de la IA" icon={<ShieldCheck size={17} />} />
            <ul className="text-muted space-y-2 text-[11px] leading-relaxed">
              <li>• La IA usa unicamente el perfil cargado por el usuario.</li>
              <li>• Nunca inventa experiencia, empresas, tecnologias ni certificaciones.</li>
              <li>• Si un dato no existe, responde UNKNOWN y pide intervencion humana.</li>
              <li>• Toda respuesta generada queda marcada para revision antes de enviarse.</li>
              <li>• Las API keys se guardan cifradas y nunca llegan al navegador.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Estado -------------------------------- */

interface ExecutionStats {
  recent: {
    id: string;
    source_id: string;
    started_at: string;
    status: string;
    jobs_received: number;
    jobs_inserted: number;
    jobs_duplicated: number;
    duration_ms: number;
    triggered_by: string;
    error_message: string | null;
  }[];
  bySource: {
    source_id: string;
    runs: number;
    errors: number;
    jobs_received: number;
    jobs_inserted: number;
    jobs_duplicated: number;
    rate_limit_hits: number;
    avg_duration_ms: number;
    last_run: string;
  }[];
}

export function AdminSystemPage() {
  const toast = useToast();
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [health, setHealth] = useState<
    { id: string; name: string; status: string; latencyMs?: number; message?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [executions, healthResult] = await Promise.all([
        api.get<ExecutionStats>("/api/admin/executions?limit=40"),
        api.get<{ connectors: typeof health }>("/api/admin/health"),
      ]);
      setStats(executions);
      setHealth(healthResult.connectors);
    } catch (error) {
      toast.error("No se pudo cargar el estado", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maintenance = async (action: string, label: string, body?: unknown) => {
    setBusy(action);
    try {
      const result = await api.post<{ removed: number }>(
        `/api/admin/maintenance/${action}`,
        body ?? {},
      );
      toast.success(label, `${result.removed} registros afectados`);
      await load();
    } catch (error) {
      toast.error("La operacion fallo", errorMessage(error));
    } finally {
      setBusy("");
    }
  };

  const online = health.filter((item) => item.status === "ONLINE").length;

  return (
    <div>
      <PageHeader
        title="Estado del sistema"
        description="Salud de los conectores, metricas de ejecucion y mantenimiento de la base local."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={load} loading={loading}>
            Actualizar
          </Button>
        }
      />

      <Card className="mb-5">
        <CardHeader
          title={`Salud de conectores (${online}/${health.length} online)`}
          subtitle="Chequeo en vivo contra cada fuente"
          icon={<Activity size={17} />}
        />
        {loading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {health.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-sunken)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--text-strong)]">{item.name}</p>
                  {item.message && (
                    <p className="text-muted truncate text-[10px]" title={item.message}>
                      {item.message}
                    </p>
                  )}
                </div>
                <Badge
                  tone={
                    item.status === "ONLINE"
                      ? "success"
                      : item.status === "NOT_CONFIGURED"
                        ? "neutral"
                        : item.status === "DEGRADED"
                          ? "warning"
                          : "danger"
                  }
                >
                  {item.status === "ONLINE" && item.latencyMs ? `${item.latencyMs}ms` : item.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="Metricas por fuente"
          subtitle="Acumulado de todas las ejecuciones"
          icon={<Database size={17} />}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b text-left">
                <th className="pb-2 font-medium">Fuente</th>
                <th className="pb-2 font-medium">Ejecuciones</th>
                <th className="pb-2 font-medium">Errores</th>
                <th className="pb-2 font-medium">Recibidas</th>
                <th className="pb-2 font-medium">Insertadas</th>
                <th className="pb-2 font-medium">Duplicadas</th>
                <th className="pb-2 font-medium">429</th>
                <th className="pb-2 font-medium">Duracion</th>
                <th className="pb-2 font-medium">Ultima</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.bySource ?? []).map((row) => (
                <tr key={row.source_id} className="border-b last:border-0">
                  <td className="py-2 font-medium text-[var(--text-strong)]">{row.source_id}</td>
                  <td className="text-muted py-2 tabular-nums">{row.runs}</td>
                  <td className={cx("py-2 tabular-nums", row.errors > 0 ? "text-rose-400" : "text-muted")}>
                    {row.errors}
                  </td>
                  <td className="text-muted py-2 tabular-nums">{row.jobs_received}</td>
                  <td className="py-2 tabular-nums text-emerald-400">{row.jobs_inserted}</td>
                  <td className="text-muted py-2 tabular-nums">{row.jobs_duplicated}</td>
                  <td
                    className={cx(
                      "py-2 tabular-nums",
                      row.rate_limit_hits > 0 ? "text-amber-400" : "text-muted",
                    )}
                  >
                    {row.rate_limit_hits}
                  </td>
                  <td className="text-muted py-2 tabular-nums">{Math.round(row.avg_duration_ms)} ms</td>
                  <td className="text-muted py-2">{relativeTime(row.last_run)}</td>
                </tr>
              ))}
              {!stats?.bySource.length && (
                <tr>
                  <td colSpan={9} className="text-muted py-6 text-center">
                    Sin ejecuciones registradas todavia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Mantenimiento"
          subtitle="Operaciones sobre la base local de esta PC"
          icon={<Eraser size={17} />}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <MaintenanceAction
            title="Purgar ofertas antiguas"
            description="Elimina ofertas de mas de 90 dias que no tengan postulaciones ni analisis asociados."
            action="purge-jobs"
            busy={busy}
            onRun={() => maintenance("purge-jobs", "Ofertas purgadas", { days: 90 })}
          />
          <MaintenanceAction
            title="Purgar auditoria"
            description="Borra entradas del log de auditoria con mas de 180 dias."
            action="purge-logs"
            busy={busy}
            onRun={() => maintenance("purge-logs", "Auditoria purgada", { days: 180 })}
          />
          <MaintenanceAction
            title="Vaciar cache HTTP"
            description="Limpia las respuestas cacheadas de las fuentes para forzar consultas frescas."
            action="clear-cache"
            busy={busy}
            onRun={() => maintenance("clear-cache", "Cache vaciada")}
          />
        </div>
      </Card>
    </div>
  );
}

function MaintenanceAction({
  title,
  description,
  action,
  busy,
  onRun,
}: {
  title: string;
  description: string;
  action: string;
  busy: string;
  onRun: () => void;
}) {
  return (
    <div className="rounded-xl border bg-[var(--surface-sunken)] p-3.5">
      <p className="text-xs font-medium text-[var(--text-strong)]">{title}</p>
      <p className="text-muted mt-1 text-[11px] leading-relaxed">{description}</p>
      <Button
        size="sm"
        variant="secondary"
        className="mt-3 w-full"
        loading={busy === action}
        onClick={onRun}
        icon={<Trash2 size={12} />}
      >
        Ejecutar
      </Button>
    </div>
  );
}

/* ------------------------------ Auditoria ------------------------------ */

interface AuditRow {
  id: string;
  user_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  source: string | null;
  result: string;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export function AdminLogsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "150" });
      if (action) params.set("action", action);
      const result = await api.get<{ entries: AuditRow[]; total: number }>(
        `/api/admin/logs?${params.toString()}`,
      );
      setRows(result.entries);
      setTotal(result.total);
    } catch (error) {
      toast.error("No se pudieron cargar los logs", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const actions = [...new Set(rows.map((row) => row.action))].sort();

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description={`${total} eventos registrados. Se guarda quien hizo que, sobre que fuente y con que resultado.`}
        actions={
          <Select value={action} onChange={(event) => setAction(event.target.value)} className="w-56">
            <option value="">Todas las acciones</option>
            {actions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        }
      />

      <Card padded={false}>
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-9" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b text-left">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Accion</th>
                  <th className="px-4 py-3 font-medium">Entidad</th>
                  <th className="px-4 py-3 font-medium">Resultado</th>
                  <th className="px-4 py-3 font-medium">Detalle</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-[var(--surface-sunken)]">
                    <td className="text-muted px-4 py-2.5 whitespace-nowrap">
                      {formatDate(row.created_at, true)}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-strong)]">{row.user_email ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone="brand">{row.action}</Badge>
                    </td>
                    <td className="text-muted px-4 py-2.5">
                      {row.entity ? `${row.entity}${row.entity_id ? ` · ${row.entity_id.slice(0, 12)}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        tone={
                          row.result === "SUCCESS"
                            ? "success"
                            : row.result === "WARNING"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {row.result}
                      </Badge>
                    </td>
                    <td className="text-muted max-w-sm truncate px-4 py-2.5" title={row.detail ?? ""}>
                      {row.detail ?? "—"}
                    </td>
                    <td className="text-muted px-4 py-2.5">{row.ip ?? "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted py-10 text-center">
                      Sin eventos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
