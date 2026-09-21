import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCheck, ExternalLink, Play, Star, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import { errorMessage, formatDate, relativeTime, scoreTone, useToast } from "../lib/ui.tsx";
import { Badge, Button, Card, EmptyState, Skeleton, Toggle } from "../components/primitives.tsx";
import { PageHeader } from "../components/Layout.tsx";
import { sourceLabel } from "../components/JobCard.tsx";

interface SavedSearch {
  id: string;
  name: string;
  params: {
    keywords?: string[];
    excludedKeywords?: string[];
    countries?: string[];
    employmentTypes?: string[];
    salaryMin?: number;
    worldwideOnly?: boolean;
  };
  alertsEnabled: boolean;
  lastRunAt: string | null;
  updatedAt: string;
}

export function SavedSearchesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * `showSkeleton` solo en la carga inicial o al cambiar de filtro. Tras una
   * accion del usuario se refresca en silencio: reemplazar la lista por
   * skeletons colapsa la altura de la pagina y el scroll salta al tope.
   */
  const load = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const result = await api.get<{ searches: SavedSearch[] }>("/api/saved-searches");
      setSearches(result.searches);
    } catch (error) {
      toast.error("No se pudieron cargar las busquedas", errorMessage(error));
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAlerts = async (search: SavedSearch) => {
    try {
      await api.put(`/api/saved-searches/${search.id}`, {
        name: search.name,
        params: search.params,
        alertsEnabled: !search.alertsEnabled,
      });
      await load();
    } catch (error) {
      toast.error("No se pudo actualizar", errorMessage(error));
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/api/saved-searches/${id}`);
      toast.success("Busqueda eliminada");
      await load();
    } catch (error) {
      toast.error("No se pudo eliminar", errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Automatizacion"
        title="Mis busquedas"
        description="Las busquedas guardadas se ejecutan automaticamente y generan alertas con las ofertas nuevas compatibles."
        actions={
          <Button onClick={() => navigate("/buscar")} icon={<Star size={15} />}>
            Nueva busqueda
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Star size={24} />}
            title="Todavia no guardo ninguna busqueda"
            description="Guarde una busqueda desde la pantalla de busqueda para que JobHunter la ejecute periodicamente y le avise cuando aparezcan ofertas compatibles."
            action={<Button onClick={() => navigate("/buscar")}>Ir a buscar</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {searches.map((search) => (
            <Card key={search.id} className="animate-fade-up">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[var(--text-strong)]">
                    {search.name}
                  </h3>
                  <p className="text-muted mt-0.5 text-[11px]">
                    {search.lastRunAt
                      ? `Ultima ejecucion ${relativeTime(search.lastRunAt)}`
                      : "Sin ejecutar todavia"}
                  </p>
                </div>
                <Toggle
                  checked={search.alertsEnabled}
                  onChange={() => toggleAlerts(search)}
                  label="Alertas"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {search.params.keywords?.map((keyword) => (
                  <Badge key={keyword} tone="brand">
                    {keyword}
                  </Badge>
                ))}
                {search.params.countries?.map((country) => (
                  <Badge key={country}>{country}</Badge>
                ))}
                {search.params.employmentTypes?.map((type) => (
                  <Badge key={type}>{type}</Badge>
                ))}
                {search.params.salaryMin ? (
                  <Badge tone="success">desde {search.params.salaryMin}</Badge>
                ) : null}
                {search.params.worldwideOnly && <Badge tone="info">worldwide</Badge>}
                {search.params.excludedKeywords?.map((keyword) => (
                  <Badge key={keyword} tone="danger">
                    -{keyword}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                <span className="text-muted inline-flex items-center gap-1.5 text-[11px]">
                  {search.alertsEnabled ? <Bell size={12} /> : <BellOff size={12} />}
                  {search.alertsEnabled ? "Alertas activas" : "Alertas pausadas"}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Play size={12} />}
                    onClick={() => navigate("/buscar")}
                  >
                    Ejecutar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={12} />}
                    onClick={() => remove(search.id)}
                  >
                    Borrar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface Alert {
  id: string;
  job_id: string | null;
  title: string;
  body: string;
  score: number | null;
  read: number;
  created_at: string;
  source?: string;
  source_url?: string;
  location?: string;
}

export function AlertsPage() {
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * `showSkeleton` solo en la carga inicial o al cambiar de filtro. Tras una
   * accion del usuario se refresca en silencio: reemplazar la lista por
   * skeletons colapsa la altura de la pagina y el scroll salta al tope.
   */
  const load = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const result = await api.get<{ alerts: Alert[] }>("/api/alerts");
      setAlerts(result.alerts);
    } catch (error) {
      toast.error("No se pudieron cargar las alertas", errorMessage(error));
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAll = async () => {
    await api.post("/api/alerts/read-all");
    await load();
  };

  const unread = alerts.filter((alert) => alert.read === 0).length;

  return (
    <div>
      <PageHeader
        title="Alertas"
        description={`${unread} sin leer de ${alerts.length} alertas generadas por sus busquedas guardadas.`}
        actions={
          unread > 0 ? (
            <Button variant="secondary" icon={<CheckCheck size={15} />} onClick={markAll}>
              Marcar todas como leidas
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell size={24} />}
            title="Sin alertas por ahora"
            description="Guarde una busqueda con alertas activas: cuando aparezca una oferta compatible con su perfil, la vera aca."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((alert) => {
            const tone = alert.score !== null ? scoreTone(alert.score) : null;
            return (
              <Card
                key={alert.id}
                className={alert.read === 0 ? "border-brand-500/30" : undefined}
              >
                <div className="flex items-start gap-3">
                  {tone && (
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-semibold tabular-nums ${tone.text}`}
                      style={{ background: `color-mix(in srgb, ${tone.ring} 14%, transparent)` }}
                    >
                      {Math.round(alert.score!)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-[var(--text-strong)]">
                      {alert.title}
                    </h3>
                    <p className="text-muted mt-0.5 text-xs">{alert.body}</p>
                    <p className="text-muted mt-1 text-[10px]">{formatDate(alert.created_at, true)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {alert.source && <Badge tone="brand">{sourceLabel(alert.source)}</Badge>}
                    {alert.source_url && (
                      <a href={alert.source_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" icon={<ExternalLink size={12} />}>
                          Ver
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
