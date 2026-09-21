import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Cable,
  Database,
  RefreshCw,
  Server,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../lib/api.ts";
import { STATUS_LABELS, errorMessage, relativeTime, useToast } from "../../lib/ui.tsx";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
  StatCard,
} from "../../components/primitives.tsx";
import { PageHeader } from "../../components/Layout.tsx";

interface Overview {
  jobs: {
    total: number;
    duplicates: number;
    last24h: number;
    bySource: { source: string; count: number }[];
  };
  users: { total: number; active: number; admins: number };
  sources: {
    total: number;
    enabled: number;
    configured: number;
    byCategory: Record<string, number>;
  };
  applications: { status: string; count: number }[];
  executions: {
    recent: {
      id: string;
      source_id: string;
      started_at: string;
      status: string;
      jobs_received: number;
      duration_ms: number;
      error_message: string | null;
    }[];
    bySource: {
      source_id: string;
      runs: number;
      errors: number;
      jobs_received: number;
      jobs_inserted: number;
      rate_limit_hits: number;
      avg_duration_ms: number;
      last_run: string;
    }[];
  };
  ai: { provider: string; ready: boolean; detail: string };
  scheduler: { active: boolean; running: boolean };
}

// Escala --chart-1..5 del sistema visual de Grupo FM.
const CHART_COLORS = ["#6366f1", "#a05ce8", "#e08c33", "#a855f7", "#e0457b", "#818cf8", "#c4b5fd"];

export function AdminDashboardPage() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    try {
      setData(await api.get<Overview>("/api/admin/overview"));
    } catch (error) {
      toast.error("No se pudo cargar el panel", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSync = async () => {
    setSyncing(true);
    try {
      const report = await api.post<{
        jobsFound: number;
        alertsCreated: number;
        savedSearches: number;
        errors: string[];
      }>("/api/admin/sync");
      toast.success(
        "Sincronizacion completa",
        `${report.savedSearches} busquedas · ${report.jobsFound} ofertas · ${report.alertsCreated} alertas`,
      );
      if (report.errors.length) toast.warning("Con avisos", report.errors.join(" · "));
      await load();
    } catch (error) {
      toast.error("La sincronizacion fallo", errorMessage(error));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const bySource = (data?.jobs.bySource ?? []).slice(0, 10).map((item) => ({
    name: item.source,
    ofertas: item.count,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Administracion"
        title="Panel de administracion"
        description="Estado general de la plataforma, fuentes y sincronizacion."
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => load()}>
              Actualizar
            </Button>
            <Button icon={<RefreshCw size={15} />} loading={syncing} onClick={runSync}>
              Sincronizar ahora
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ofertas en base"
          value={data?.jobs.total ?? 0}
          hint={`${data?.jobs.last24h ?? 0} en las ultimas 24 h`}
          icon={<Database size={20} />}
        />
        <StatCard
          label="Fuentes activas"
          value={`${data?.sources.enabled ?? 0}/${data?.sources.total ?? 0}`}
          hint={`${data?.sources.configured ?? 0} configuradas`}
          icon={<Cable size={20} />}
          tone="info"
        />
        <StatCard
          label="Usuarios"
          value={data?.users.total ?? 0}
          hint={`${data?.users.active ?? 0} activos · ${data?.users.admins ?? 0} admin`}
          icon={<Users size={20} />}
          tone="success"
        />
        <StatCard
          label="Duplicados detectados"
          value={data?.jobs.duplicates ?? 0}
          hint="No se muestran a los usuarios"
          icon={<TriangleAlert size={20} />}
          tone="warning"
        />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Ofertas por fuente"
            subtitle="Distribucion de la base local"
            icon={<Database size={17} />}
          />
          {bySource.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySource} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "var(--text-strong)",
                    }}
                    cursor={{ fill: "color-mix(in srgb, var(--text-muted) 8%, transparent)" }}
                  />
                  <Bar dataKey="ofertas" radius={[6, 6, 0, 0]}>
                    {bySource.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<Database size={22} />}
              title="Sin ofertas todavia"
              description="Configure y habilite fuentes, luego ejecute una sincronizacion."
              action={
                <Link to="/admin/conectores">
                  <Button size="sm">Ir a conectores</Button>
                </Link>
              }
            />
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Inteligencia artificial" subtitle="Proveedor configurado" icon={<Sparkles size={17} />} />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-strong)] capitalize">
                  {data?.ai.provider}
                </p>
                <p className="text-muted mt-0.5 text-[11px]">{data?.ai.detail}</p>
              </div>
              <Badge tone={data?.ai.ready ? "success" : "warning"}>
                {data?.ai.ready ? "Operativo" : "Sin credenciales"}
              </Badge>
            </div>
            <Link to="/admin/ia" className="mt-3 block">
              <Button variant="secondary" size="sm" className="w-full">
                Configurar IA
              </Button>
            </Link>
          </Card>

          <Card>
            <CardHeader title="Sincronizacion" subtitle="Worker automatico" icon={<Server size={17} />} />
            <div className="flex items-center justify-between">
              <span className="text-muted text-xs">Estado del scheduler</span>
              <Badge tone={data?.scheduler.active ? "success" : "neutral"}>
                {data?.scheduler.active ? "Activo" : "Detenido"}
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted text-xs">Ejecutando ahora</span>
              <Badge tone={data?.scheduler.running ? "info" : "neutral"}>
                {data?.scheduler.running ? "Si" : "No"}
              </Badge>
            </div>
          </Card>

          <Card>
            <CardHeader title="Postulaciones" subtitle="Total de la plataforma" icon={<Activity size={17} />} />
            {data?.applications.length ? (
              <div className="space-y-1.5">
                {data.applications.map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-xs">
                    <span className="text-muted">{STATUS_LABELS[item.status] ?? item.status}</span>
                    <span className="font-medium tabular-nums text-[var(--text-strong)]">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-xs">Sin postulaciones registradas.</p>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Ultimas ejecuciones de conectores"
          subtitle="Observabilidad: duracion, resultados y errores"
          icon={<Activity size={17} />}
          action={
            <Link to="/admin/estado">
              <Button variant="ghost" size="sm">
                Ver estado completo
              </Button>
            </Link>
          }
        />
        {data?.executions.recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b text-left">
                  <th className="pb-2 font-medium">Fuente</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium">Ofertas</th>
                  <th className="pb-2 font-medium">Duracion</th>
                  <th className="pb-2 font-medium">Cuando</th>
                </tr>
              </thead>
              <tbody>
                {data.executions.recent.slice(0, 12).map((execution) => (
                  <tr key={execution.id} className="border-b last:border-0">
                    <td className="py-2 font-medium text-[var(--text-strong)]">
                      {execution.source_id}
                    </td>
                    <td className="py-2">
                      <Badge tone={execution.status === "ERROR" ? "danger" : "success"}>
                        {execution.status}
                      </Badge>
                    </td>
                    <td className="text-muted py-2 tabular-nums">{execution.jobs_received}</td>
                    <td className="text-muted py-2 tabular-nums">{execution.duration_ms} ms</td>
                    <td className="text-muted py-2">{relativeTime(execution.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-xs">Todavia no se ejecuto ningun conector.</p>
        )}
      </Card>
    </div>
  );
}
