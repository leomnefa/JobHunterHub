import {
  Building2,
  Clock,
  ExternalLink,
  Globe2,
  MapPin,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { Job, Match } from "../lib/api.ts";
import {
  EMPLOYMENT_LABELS,
  REMOTE_LABELS,
  SENIORITY_LABELS,
  cx,
  formatSalary,
  relativeTime,
  scoreTone,
} from "../lib/ui.tsx";
import { Badge, Button, ScoreRing } from "./primitives.tsx";

const SOURCE_LABELS: Record<string, string> = {
  himalayas: "Himalayas",
  jobicy: "Jobicy",
  remotive: "Remotive",
  remoteok: "Remote OK",
  adzuna: "Adzuna",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  workday: "Workday",
  recruitee: "Recruitee",
  bamboohr: "BambooHR",
  personio: "Personio",
  teamtailor: "Teamtailor",
  breezy: "Breezy HR",
  upwork: "Upwork",
  freelancer: "Freelancer",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function JobCard({
  job,
  match,
  onOpen,
  selected,
}: {
  job: Job;
  match?: Match;
  onOpen: () => void;
  selected?: boolean;
}) {
  const salary = formatSalary(job.salary);
  const tone = match ? scoreTone(match.compatibilityScore) : null;

  return (
    <article
      onClick={onOpen}
      className={cx(
        "surface group animate-fade-up cursor-pointer rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5",
        selected && "ring-brand-500/50 ring-2",
      )}
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            {job.company.logoUrl ? (
              <img
                src={job.company.logoUrl}
                alt=""
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-xl border object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="bg-brand-500/10 text-brand-400 grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                <Building2 size={18} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <h3 className="group-hover:text-brand-300 line-clamp-2 text-sm leading-snug font-semibold text-[var(--text-strong)] transition-colors">
                {job.title}
              </h3>
              <p className="text-muted mt-0.5 truncate text-xs">{job.company.name}</p>
            </div>
          </div>

          <div className="text-muted mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1">
              {job.worldwide ? <Globe2 size={12} /> : <MapPin size={12} />}
              <span className="max-w-[16rem] truncate">
                {job.worldwide ? "Worldwide" : job.location || "Sin ubicacion"}
              </span>
            </span>
            {salary && (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <Wallet size={12} />
                {salary}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {relativeTime(job.publishedAt ?? job.retrievedAt)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="brand">{sourceLabel(job.source)}</Badge>
            <Badge>{REMOTE_LABELS[job.remoteType] ?? job.remoteType}</Badge>
            {job.employmentType && job.employmentType !== "unknown" && (
              <Badge>{EMPLOYMENT_LABELS[job.employmentType] ?? job.employmentType}</Badge>
            )}
            {job.seniority && job.seniority !== "unknown" && (
              <Badge>{SENIORITY_LABELS[job.seniority] ?? job.seniority}</Badge>
            )}
            {job.connectorCapabilities?.apply && <Badge tone="success">Postulacion por API</Badge>}
          </div>

          {match && match.matchedSkills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {match.matchedSkills.slice(0, 5).map((skill) => (
                <span
                  key={skill}
                  className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400"
                >
                  {skill}
                </span>
              ))}
              {match.missingSkills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="text-muted rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] line-through decoration-1"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          {match && tone ? (
            <>
              <ScoreRing score={match.compatibilityScore} color={tone.ring} size={52} />
              <span className={cx("text-[10px] font-medium", tone.text)}>{tone.label}</span>
            </>
          ) : (
            <span className="text-muted grid h-[52px] w-[52px] place-items-center rounded-full border border-dashed text-[10px]">
              s/ perfil
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="subtle"
          icon={<Sparkles size={13} />}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          Ver y analizar
        </Button>
        <a
          href={job.applicationUrl ?? job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="text-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition hover:text-[var(--text-strong)]"
        >
          Oferta original <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
