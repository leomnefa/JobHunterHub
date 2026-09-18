import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Filter,
  Save,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api } from "../lib/api.ts";
import type { Job, Match, SearchResponse } from "../lib/api.ts";
import { cx, errorMessage, useMediaQuery, useToast } from "../lib/ui.tsx";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
} from "../components/primitives.tsx";
import { JobCard, sourceLabel } from "../components/JobCard.tsx";
import { JobDetailPanel } from "../components/JobDetail.tsx";
import { PageHeader } from "../components/Layout.tsx";

interface SourceOption {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  configured: boolean;
}

const EMPLOYMENT_OPTIONS = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contrato" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Pasantia" },
];

const SENIORITY_OPTIONS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Semi senior" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
];

export function SearchPage() {
  const toast = useToast();
  const [keywords, setKeywords] = useState("");
  const [excluded, setExcluded] = useState("");
  const [countries, setCountries] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<string[]>([]);
  const [worldwideOnly, setWorldwideOnly] = useState(false);
  const [limit, setLimit] = useState(50);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [sources, setSources] = useState<SourceOption[]>([]);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ job: Job; match?: Match } | null>(null);
  const [sortBy, setSortBy] = useState<"match" | "recent">("match");
  const [saveOpen, setSaveOpen] = useState(false);
  // En pantallas anchas el detalle vive en el panel lateral; en chicas, en un modal.
  const wideLayout = useMediaQuery("(min-width: 1280px)");
  const [searchName, setSearchName] = useState("");

  useEffect(() => {
    api
      .get<{ sources: SourceOption[] }>("/api/sources")
      .then((data) => setSources(data.sources.filter((source) => source.enabled && source.configured)))
      .catch(() => undefined);
  }, []);

  const buildParams = () => ({
    keywords: keywords.split(/[,\n]/).map((value) => value.trim()).filter(Boolean),
    excludedKeywords: excluded.split(/[,\n]/).map((value) => value.trim()).filter(Boolean),
    countries: countries.split(/[,\n]/).map((value) => value.trim()).filter(Boolean),
    employmentTypes,
    seniority,
    salaryMin: salaryMin ? Number(salaryMin) : undefined,
    worldwideOnly,
    limit,
  });

  const search = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setSelected(null);
    try {
      const response = await api.post<SearchResponse>("/api/jobs/search", {
        ...buildParams(),
        sources: selectedSources,
      });
      setResult(response);
      const failed = response.outcomes.filter((outcome) => outcome.status === "error");
      if (failed.length) {
        toast.warning(
          `${failed.length} fuente(s) con error`,
          failed.map((outcome) => `${outcome.name}: ${outcome.error}`).join(" · "),
        );
      }
      if (!response.jobs.length) {
        toast.info("Sin resultados", "Pruebe con otras palabras clave o menos filtros.");
      }
    } catch (error) {
      toast.error("La busqueda fallo", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const saveSearch = async () => {
    try {
      await api.post("/api/saved-searches", {
        name: searchName || keywords || "Busqueda sin nombre",
        params: { ...buildParams(), sources: selectedSources },
        alertsEnabled: true,
      });
      toast.success("Busqueda guardada", "Se generaran alertas con las ofertas nuevas compatibles.");
      setSaveOpen(false);
      setSearchName("");
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    }
  };

  const jobs = result?.jobs ?? [];
  const sorted = [...jobs].sort((a, b) => {
    if (sortBy === "match") {
      return (
        (result?.matches[b.id]?.compatibilityScore ?? -1) -
        (result?.matches[a.id]?.compatibilityScore ?? -1)
      );
    }
    return (
      new Date(b.publishedAt ?? b.retrievedAt).getTime() -
      new Date(a.publishedAt ?? a.retrievedAt).getTime()
    );
  });

  const toggle = (list: string[], value: string, setter: (value: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  return (
    <div>
      <PageHeader
        title="Buscar trabajos"
        description="Consulta en vivo todas las fuentes habilitadas, normaliza y deduplica los resultados."
        actions={
          <Button
            variant="secondary"
            icon={<Save size={15} />}
            onClick={() => setSaveOpen(true)}
            disabled={!keywords.trim()}
          >
            Guardar busqueda
          </Button>
        }
      />

      {/* Buscador */}
      <Card className="mb-5">
        <form onSubmit={search} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon
                size={17}
                className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
              />
              <Input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="Senior Data Engineer, SQL Server, Qlik..."
                className="h-11 pl-10"
              />
            </div>
            <Button type="submit" size="lg" loading={loading} icon={<SearchIcon size={16} />}>
              Buscar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setShowFilters((value) => !value)}
              icon={<SlidersHorizontal size={16} />}
            >
              Filtros
              <ChevronDown
                size={14}
                className={cx("transition-transform", showFilters && "rotate-180")}
              />
            </Button>
          </div>

          {showFilters && (
            <div className="animate-fade-up space-y-4 border-t pt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Excluir palabras" hint="Separadas por coma">
                  <Input
                    value={excluded}
                    onChange={(event) => setExcluded(event.target.value)}
                    placeholder="crypto, sales"
                  />
                </Field>
                <Field label="Paises" hint="Separados por coma">
                  <Input
                    value={countries}
                    onChange={(event) => setCountries(event.target.value)}
                    placeholder="Argentina, United States"
                  />
                </Field>
                <Field label="Salario minimo anual (USD)">
                  <Input
                    type="number"
                    value={salaryMin}
                    onChange={(event) => setSalaryMin(event.target.value)}
                    placeholder="60000"
                  />
                </Field>
                <Field label="Resultados por fuente">
                  <Select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--text-strong)]">Tipo de contrato</p>
                  <div className="flex flex-wrap gap-1.5">
                    {EMPLOYMENT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggle(employmentTypes, option.value, setEmploymentTypes)}
                        className={cx(
                          "rounded-lg border px-2.5 py-1 text-[11px] transition",
                          employmentTypes.includes(option.value)
                            ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                            : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--text-strong)]">Seniority</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SENIORITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggle(seniority, option.value, setSeniority)}
                        className={cx(
                          "rounded-lg border px-2.5 py-1 text-[11px] transition",
                          seniority.includes(option.value)
                            ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                            : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--text-strong)]">Otros</p>
                  <Checkbox
                    checked={worldwideOnly}
                    onChange={setWorldwideOnly}
                    label="Solo ofertas worldwide"
                    description="Sin restriccion de pais"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[var(--text-strong)]">
                  Fuentes ({selectedSources.length || sources.length} de {sources.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => toggle(selectedSources, source.id, setSelectedSources)}
                      className={cx(
                        "rounded-lg border px-2.5 py-1 text-[11px] transition",
                        selectedSources.includes(source.id)
                          ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                          : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
                      )}
                    >
                      {source.name}
                    </button>
                  ))}
                  {selectedSources.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSources([])}
                      className="text-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] hover:text-[var(--text-strong)]"
                    >
                      <X size={11} /> Todas
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </Card>

      {/* Resumen de fuentes */}
      {result && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            {jobs.length} ofertas en {(result.durationMs / 1000).toFixed(1)}s
          </Badge>
          {result.duplicatesRemoved > 0 && (
            <Badge tone="info">{result.duplicatesRemoved} duplicados filtrados</Badge>
          )}
          {result.duplicateCandidates > 0 && (
            <Badge tone="warning">{result.duplicateCandidates} posibles duplicados</Badge>
          )}
          {result.outcomes.map((outcome) => (
            <Badge
              key={outcome.source}
              tone={outcome.status === "error" ? "danger" : outcome.jobs ? "success" : "neutral"}
            >
              {outcome.status === "error" ? (
                <AlertTriangle size={10} />
              ) : (
                <CheckCircle2 size={10} />
              )}
              {sourceLabel(outcome.source)} · {outcome.jobs}
            </Badge>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Filter size={13} className="text-muted" />
            <Select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "match" | "recent")}
              className="h-8 w-40 text-xs"
            >
              <option value="match">Mayor compatibilidad</option>
              <option value="recent">Mas recientes</option>
            </Select>
          </div>
        </div>
      )}

      {/* Resultados */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="space-y-3">
          {loading &&
            Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full" />
            ))}

          {!loading && !result && (
            <Card>
              <EmptyState
                icon={<SearchIcon size={24} />}
                title="Busque su proxima oportunidad"
                description="Escriba el puesto o las tecnologias que le interesan. JobHunter consulta todas las fuentes habilitadas, normaliza los resultados y los compara con su perfil."
              />
            </Card>
          )}

          {!loading && result && sorted.length === 0 && (
            <Card>
              <EmptyState
                icon={<SearchIcon size={24} />}
                title="Sin resultados"
                description="Ninguna fuente devolvio ofertas con esos criterios. Pruebe con menos filtros o palabras mas generales."
              />
            </Card>
          )}

          {!loading &&
            sorted.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                match={result?.matches[job.id]}
                selected={selected?.job.id === job.id}
                onOpen={() => setSelected({ job, match: result?.matches[job.id] })}
              />
            ))}

          {result && result.attributions.length > 0 && (
            <p className="text-muted pt-2 text-[10px] leading-relaxed">
              {result.attributions.join(" · ")}
            </p>
          )}
        </div>

        {/* Panel lateral en pantallas grandes */}
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
                icon={<SlidersHorizontal size={22} />}
                title="Seleccione una oferta"
                description="Vera el analisis de compatibilidad, los riesgos detectados y podra preparar la postulacion."
              />
            </Card>
          )}
        </aside>
      </div>

      {/* Detalle como modal en pantallas chicas */}
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

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Guardar busqueda"
        description="Se ejecutara automaticamente y le avisara cuando aparezcan ofertas compatibles."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSaveOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={saveSearch}>
              Guardar
            </Button>
          </>
        }
      >
        <Field label="Nombre de la busqueda" required>
          <Input
            value={searchName}
            onChange={(event) => setSearchName(event.target.value)}
            placeholder={keywords || "Senior Data Engineer remoto"}
            autoFocus
          />
        </Field>
      </Modal>
    </div>
  );
}
