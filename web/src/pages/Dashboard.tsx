import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  FileText,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { api } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { STATUS_LABELS, STATUS_TONES, cx, relativeTime, scoreTone } from "../lib/ui.tsx";
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, StatCard } from "../components/primitives.tsx";
import { PageHeader } from "../components/Layout.tsx";
import { sourceLabel } from "../components/JobCard.tsx";

interface DashboardData {
  profile: { headline?: string; skills: number; updatedAt?: string } | null;
  applications: { status: string; count: number }[];
  topMatches: {
    job_id: string;
    compatibility_score: number;
    recommendation: string;
    title: string;
    company_name: string;
    location: string | null;
    source: string;
    remote_type: string;
    source_url: string;
  }[];
  recentApplications: {
    id: string;
    job_title: string;
    company_name: string;
    status: string;
    updated_at: string;
  }[];
  unreadAlerts: number;
  savedSearches: number;
  resumes: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardData>("/api/dashboard")
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const totalApplications = data?.applications.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const submitted =
    data?.applications
      .filter((item) => ["SUBMITTED", "INTERVIEW", "OFFER", "HIRED"].includes(item.status))
      .reduce((sum, item) => sum + item.count, 0) ?? 0;

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const noProfile = !data?.profile;

  return (
    <div>
      <PageHeader
        title={`Hola, ${user?.name?.split(" ")[0] ?? ""}`}
        description={
          data?.profile?.headline
            ? data.profile.headline
            : "Cargue su perfil profesional para empezar a recibir analisis de compatibilidad."
        }
        actions={
          <Link to="/buscar">
            <Button icon={<Search size={15} />}>Buscar trabajos</Button>
          </Link>
        }
      />

      {noProfile && (
        <Card className="border-brand-500/30 from-brand-500/10 mb-5 bg-gradient-to-r to-transparent">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="bg-brand-500/15 text-brand-400 grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
              <UserRound size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">
                Su perfil profesional todavia no esta cargado
              </h3>
              <p className="text-muted mt-1 text-xs leading-relaxed">
                El perfil en Markdown es la fuente de verdad de JobHunter: de ahi salen el analisis
                de compatibilidad, el CV adaptado y las respuestas de los formularios.
              </p>
            </div>
            <Link to="/perfil">
              <Button icon={<ArrowRight size={15} />}>Cargar perfil</Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Postulaciones"
          value={totalApplications}
          hint={`${submitted} enviadas`}
          icon={<BriefcaseBusiness size={20} />}
        />
        <StatCard
          label="Alertas sin leer"
          value={data?.unreadAlerts ?? 0}
          icon={<Bell size={20} />}
          tone="warning"
        />
        <StatCard
          label="Busquedas guardadas"
          value={data?.savedSearches ?? 0}
          icon={<Star size={20} />}
          tone="info"
        />
        <StatCard
          label="Documentos generados"
          value={data?.resumes ?? 0}
          icon={<FileText size={20} />}
          tone="success"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Mejores coincidencias"
            subtitle="Ofertas con mayor compatibilidad segun su perfil"
            icon={<TrendingUp size={17} />}
            action={
              <Link to="/ofertas">
                <Button variant="ghost" size="sm" icon={<ArrowRight size={13} />}>
                  Ver todas
                </Button>
              </Link>
            }
          />

          {data?.topMatches.length ? (
            <div className="space-y-2">
              {data.topMatches.map((match) => {
                const tone = scoreTone(match.compatibility_score);
                return (
                  <a
                    key={match.job_id}
                    href={match.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[var(--surface-sunken)]"
                  >
                    <span
                      className={cx(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-semibold tabular-nums",
                        tone.text,
                      )}
                      style={{ background: `color-mix(in srgb, ${tone.ring} 14%, transparent)` }}
                    >
                      {Math.round(match.compatibility_score)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-strong)]">
                        {match.title}
                      </p>
                      <p className="text-muted truncate text-xs">
                        {match.company_name} · {match.location || "Sin ubicacion"}
                      </p>
                    </div>
                    <Badge tone="brand">{sourceLabel(match.source)}</Badge>
                  </a>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles size={22} />}
              title="Todavia no hay analisis"
              description="Busque ofertas y analicelas para ver aca sus mejores coincidencias."
              action={
                <Link to="/buscar">
                  <Button size="sm">Ir a buscar</Button>
                </Link>
              }
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Ultimas postulaciones"
            subtitle="Estado de sus candidaturas"
            icon={<BriefcaseBusiness size={17} />}
            action={
              <Link to="/postulaciones">
                <Button variant="ghost" size="sm" icon={<ArrowRight size={13} />}>
                  Ver
                </Button>
              </Link>
            }
          />

          {data?.recentApplications.length ? (
            <div className="space-y-2">
              {data.recentApplications.map((application) => (
                <Link
                  key={application.id}
                  to="/postulaciones"
                  className="block rounded-xl px-3 py-2.5 transition hover:bg-[var(--surface-sunken)]"
                >
                  <p className="truncate text-sm font-medium text-[var(--text-strong)]">
                    {application.job_title}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-muted truncate text-xs">{application.company_name}</span>
                    <span
                      className={cx(
                        "rounded-lg border px-1.5 py-0.5 text-[10px] whitespace-nowrap",
                        STATUS_TONES[application.status],
                      )}
                    >
                      {STATUS_LABELS[application.status] ?? application.status}
                    </span>
                  </div>
                  <p className="text-muted mt-1 text-[10px]">{relativeTime(application.updated_at)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BriefcaseBusiness size={22} />}
              title="Sin postulaciones"
              description="Cuando prepare o registre una postulacion, aparecera aca."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
