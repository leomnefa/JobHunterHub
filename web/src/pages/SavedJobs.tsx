import { useEffect, useState } from "react";
import { BriefcaseBusiness, Database, Search as SearchIcon } from "lucide-react";
import { api } from "../lib/api.ts";
import type { Job, Match } from "../lib/api.ts";
import { errorMessage, useMediaQuery, useToast } from "../lib/ui.tsx";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
} from "../components/primitives.tsx";
import { JobCard } from "../components/JobCard.tsx";
import { JobDetailPanel } from "../components/JobDetail.tsx";
import { PageHeader } from "../components/Layout.tsx";

/** Ofertas ya normalizadas y guardadas en la base local. */
export function SavedJobsPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [remoteType, setRemoteType] = useState("");
  const [orderBy, setOrderBy] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ job: Job; match?: Match } | null>(null);
  const wideLayout = useMediaQuery("(min-width: 1280px)");

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "60", orderBy });
      if (query.trim()) params.set("q", query.trim());
      if (remoteType) params.set("remoteType", remoteType);
      const result = await api.get<{
        jobs: Job[];
        total: number;
        matches: Record<string, Match>;
      }>(`/api/jobs?${params.toString()}`);
      setJobs(result.jobs);
      setMatches(result.matches ?? {});
      setTotal(result.total);
    } catch (error) {
      toast.error("No se pudieron cargar las ofertas", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBy, remoteType]);

  return (
    <div>
      <PageHeader
        eyebrow="Base local"
        title="Ofertas guardadas"
        description={`${total} ofertas normalizadas y deduplicadas en la base local de esta PC.`}
      />

      <Card className="mb-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <SearchIcon
              size={16}
              className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar por titulo, empresa, tecnologia..."
              className="pl-10"
            />
          </div>
          <Select
            value={remoteType}
            onChange={(event) => setRemoteType(event.target.value)}
            className="sm:w-44"
          >
            <option value="">Toda modalidad</option>
            <option value="remote">Remoto</option>
            <option value="hybrid">Hibrido</option>
            <option value="onsite">Presencial</option>
          </Select>
          <Select
            value={orderBy}
            onChange={(event) => setOrderBy(event.target.value)}
            className="sm:w-48"
          >
            <option value="recent">Mas recientes</option>
            <option value="salary">Mayor salario</option>
            <option value="title">Titulo (A-Z)</option>
          </Select>
          <Button type="submit" icon={<SearchIcon size={15} />}>
            Filtrar
          </Button>
        </form>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="space-y-3">
          {loading &&
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-44" />)}

          {!loading && jobs.length === 0 && (
            <Card>
              <EmptyState
                icon={<Database size={24} />}
                title="La base local esta vacia"
                description="Ejecute una busqueda para traer ofertas desde las fuentes habilitadas. Todo lo que se descarga queda guardado aca."
              />
            </Card>
          )}

          {!loading &&
            jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                match={matches[job.id]}
                selected={selected?.job.id === job.id}
                onOpen={() => setSelected({ job, match: matches[job.id] })}
              />
            ))}
        </div>

        <aside className="hidden xl:block">
          {selected ? (
            <div className="surface sticky top-6 max-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl">
              <JobDetailPanel
                job={selected.job}
                initialMatch={selected.match}
                onClose={() => setSelected(null)}
              />
            </div>
          ) : (
            <Card className="sticky top-6">
              <EmptyState
                icon={<BriefcaseBusiness size={22} />}
                title="Seleccione una oferta"
                description="Para ver el analisis completo y preparar la postulacion."
              />
            </Card>
          )}
        </aside>
      </div>

      <Modal
        open={selected !== null && !wideLayout}
        onClose={() => setSelected(null)}
        title="Detalle de la oferta"
        size="xl"
      >
        {selected && (
          <JobDetailPanel
            job={selected.job}
            initialMatch={selected.match}
            onClose={() => setSelected(null)}
          />
        )}
      </Modal>
    </div>
  );
}
