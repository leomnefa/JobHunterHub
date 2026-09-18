import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Globe2,
  MapPin,
  Sparkles,
  Wallet,
} from "lucide-react";
import { api } from "../lib/api.ts";
import type { Job, Match } from "../lib/api.ts";
import {
  EMPLOYMENT_LABELS,
  REMOTE_LABELS,
  SENIORITY_LABELS,
  cx,
  errorMessage,
  formatDate,
  formatSalary,
  scoreTone,
  useToast,
} from "../lib/ui.tsx";
import { Badge, Button, MeterBar, Modal, ScoreRing, Spinner } from "./primitives.tsx";
import { sourceLabel } from "./JobCard.tsx";
import { ApplicationPrep } from "./ApplicationPrep.tsx";
import type { PreparedApplication } from "./ApplicationPrep.tsx";

/** Panel de detalle de una oferta: analisis, riesgos y acciones de postulacion. */
export function JobDetailPanel({
  job,
  initialMatch,
  onClose,
}: {
  job: Job;
  initialMatch?: Match;
  onClose: () => void;
}) {
  const toast = useToast();
  const [match, setMatch] = useState<Match | undefined>(initialMatch);
  const [analyzing, setAnalyzing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<PreparedApplication | null>(null);
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    setMatch(initialMatch);
    setPrepared(null);
  }, [job.id, initialMatch]);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const result = await api.post<{ match: Match }>(`/api/jobs/${encodeURIComponent(job.id)}/analyze`);
      setMatch(result.match);
      toast.success(
        `Analisis completo: ${result.match.compatibilityScore}%`,
        result.match.analyzedBy === "llm" ? "Analizado con IA" : "Analisis deterministico local",
      );
    } catch (error) {
      toast.error("No se pudo analizar la oferta", errorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  };

  const prepare = async () => {
    setPreparing(true);
    try {
      const result = await api.post<PreparedApplication>(
        `/api/jobs/${encodeURIComponent(job.id)}/prepare-application`,
        { coverLetter: true },
      );
      setPrepared(result);
      setMatch(result.match);
      toast.success("Postulacion preparada", "Revise el CV, la carta y las respuestas antes de enviar.");
    } catch (error) {
      toast.error("No se pudo preparar la postulacion", errorMessage(error));
    } finally {
      setPreparing(false);
    }
  };

  const track = async () => {
    setTracking(true);
    try {
      await api.post(`/api/jobs/${encodeURIComponent(job.id)}/track`, {
        notes: "Postulacion registrada manualmente desde la oferta original.",
      });
      toast.success("Postulacion registrada", "Quedo marcada como enviada en tu historial.");
    } catch (error) {
      toast.error("No se pudo registrar", errorMessage(error));
    } finally {
      setTracking(false);
    }
  };

  const salary = formatSalary(job.salary);
  const tone = match ? scoreTone(match.compatibilityScore) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="border-b p-5">
        <div className="flex items-start gap-3">
          {job.company.logoUrl ? (
            <img
              src={job.company.logoUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl border object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="bg-brand-500/10 text-brand-400 grid h-12 w-12 shrink-0 place-items-center rounded-xl">
              <Building2 size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base leading-snug font-semibold text-[var(--text-strong)]">
              {job.title}
            </h2>
            <p className="text-muted mt-0.5 text-sm">{job.company.name}</p>
          </div>
          {match && tone && <ScoreRing score={match.compatibilityScore} color={tone.ring} size={58} />}
        </div>

        <div className="text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-1.5">
            {job.worldwide ? <Globe2 size={13} /> : <MapPin size={13} />}
            {job.worldwide ? "Worldwide" : job.location || "Sin ubicacion"}
          </span>
          {salary && (
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <Wallet size={13} />
              {salary}
            </span>
          )}
          <span>Publicado: {formatDate(job.publishedAt)}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="brand">{sourceLabel(job.source)}</Badge>
          <Badge>{REMOTE_LABELS[job.remoteType] ?? job.remoteType}</Badge>
          {job.employmentType && job.employmentType !== "unknown" && (
            <Badge>{EMPLOYMENT_LABELS[job.employmentType]}</Badge>
          )}
          {job.seniority && job.seniority !== "unknown" && (
            <Badge>{SENIORITY_LABELS[job.seniority]}</Badge>
          )}
          {job.connectorCapabilities?.apply ? (
            <Badge tone="success">Permite postular por API</Badge>
          ) : (
            <Badge tone="warning">Postulacion en el sitio original</Badge>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={match ? "secondary" : "primary"}
            loading={analyzing}
            onClick={analyze}
            icon={<Sparkles size={14} />}
          >
            {match ? "Re-analizar con IA" : "Analizar con IA"}
          </Button>
          <Button
            size="sm"
            loading={preparing}
            onClick={prepare}
            icon={<FileText size={14} />}
          >
            Preparar postulacion
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={tracking}
            onClick={track}
            icon={<ClipboardCheck size={14} />}
          >
            Ya me postule
          </Button>
          <a href={job.applicationUrl ?? job.sourceUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" icon={<ExternalLink size={14} />}>
              Abrir original
            </Button>
          </a>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 overflow-y-auto p-5">
        {analyzing && <Spinner label="Analizando compatibilidad..." />}

        {match && !analyzing && (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">
                Analisis de compatibilidad
              </h3>
              <Badge tone={match.analyzedBy === "llm" ? "brand" : "neutral"}>
                {match.analyzedBy === "llm" ? "IA" : "Local"}
              </Badge>
            </div>

            <div
              className={cx(
                "mb-4 rounded-xl border px-3.5 py-3 text-xs leading-relaxed",
                match.recommendation === "apply"
                  ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
                  : match.recommendation === "review"
                    ? "border-amber-500/25 bg-amber-500/8 text-amber-300"
                    : "border-rose-500/25 bg-rose-500/8 text-rose-300",
              )}
            >
              <strong className="mr-1.5">
                {match.recommendation === "apply"
                  ? "Recomendado: postular."
                  : match.recommendation === "review"
                    ? "Revisar antes de postular."
                    : "Poco compatible."}
              </strong>
              {match.aiAnalysis}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MeterBar label="Skills" value={match.skillsMatch} />
              <MeterBar label="Experiencia" value={match.experienceMatch} />
              <MeterBar label="Seniority" value={match.seniorityMatch} />
              <MeterBar label="Ubicacion" value={match.locationMatch} />
              <MeterBar label="Contrato" value={match.contractMatch} />
              <MeterBar label="Salario" value={match.salaryMatch} />
              <MeterBar label="Idioma" value={match.languageMatch} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 size={13} /> Coincidencias ({match.matchedSkills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {match.matchedSkills.length ? (
                    match.matchedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted text-[11px]">Sin coincidencias detectadas.</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted mb-2 text-xs font-medium">
                  Faltantes ({match.missingSkills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {match.missingSkills.length ? (
                    match.missingSkills.map((skill) => (
                      <span
                        key={skill}
                        className="text-muted rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px]"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted text-[11px]">Nada relevante faltante.</span>
                  )}
                </div>
              </div>
            </div>

            {match.risks.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3.5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-400">
                  <AlertTriangle size={13} /> Riesgos detectados
                </p>
                <ul className="space-y-1">
                  {match.risks.map((risk) => (
                    <li key={risk} className="text-[11px] leading-relaxed text-amber-300/90">
                      • {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-strong)]">
            Descripcion de la oferta
          </h3>
          {job.skills.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {job.skills.slice(0, 20).map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          )}
          <p className="text-muted text-xs leading-relaxed whitespace-pre-wrap">
            {job.description || "La fuente no entrego una descripcion completa. Abra la oferta original."}
          </p>
        </section>

        <p className="text-muted mt-6 border-t pt-4 text-[10px]">
          Fuente: {sourceLabel(job.source)} · id {job.sourceJobId} · recuperado el{" "}
          {formatDate(job.retrievedAt, true)}
        </p>
      </div>

      <Modal
        open={prepared !== null}
        onClose={() => setPrepared(null)}
        title="Postulacion preparada"
        description={`${job.title} — ${job.company.name}`}
        size="xl"
      >
        {prepared && <ApplicationPrep data={prepared} onDone={() => setPrepared(null)} />}
      </Modal>

      <button className="sr-only" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}
