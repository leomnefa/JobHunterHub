import { normalizeCompany, normalizeText } from "./normalize.ts";
import type { NormalizedJob } from "./types.ts";

/**
 * Deduplicacion en dos niveles:
 *  1. Clave dura  -> source + sourceJobId (identidad exacta dentro de una fuente).
 *  2. Clave blanda -> empresa + titulo + ubicacion normalizados, reforzada con
 *     similitud de descripcion cuando hay dudas.
 *
 * Regla del proyecto: cuando la confianza es baja NO se elimina nada; la oferta
 * queda marcada como duplicateCandidate para revision humana.
 */

export const DUPLICATE_THRESHOLD = 0.82;
export const CANDIDATE_THRESHOLD = 0.6;

export function hardKey(job: Pick<NormalizedJob, "source" | "sourceJobId">): string {
  return `${job.source}::${job.sourceJobId}`;
}

export function softKey(job: NormalizedJob): string {
  const company = normalizeCompany(job.company.name);
  const title = normalizeText(job.title);
  const location = normalizeText(job.location ?? "");
  return `${company}|${title}|${location}`;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

/** Indice de Jaccard sobre tokens: barato, estable y suficiente para ofertas. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface DuplicateVerdict {
  isDuplicate: boolean;
  isCandidate: boolean;
  confidence: number;
  reason: string;
}

export function compareJobs(a: NormalizedJob, b: NormalizedJob): DuplicateVerdict {
  if (hardKey(a) === hardKey(b)) {
    return { isDuplicate: true, isCandidate: false, confidence: 1, reason: "source + sourceJobId" };
  }

  const companyScore = similarity(normalizeCompany(a.company.name), normalizeCompany(b.company.name));
  const titleScore = similarity(a.title, b.title);
  if (companyScore < 0.5 || titleScore < 0.5) {
    return {
      isDuplicate: false,
      isCandidate: false,
      confidence: Math.min(companyScore, titleScore),
      reason: "empresa o titulo distintos",
    };
  }

  const locationScore = similarity(a.location ?? "", b.location ?? "");
  const descriptionScore = similarity(
    a.description.slice(0, 4000),
    b.description.slice(0, 4000),
  );

  const confidence =
    companyScore * 0.3 + titleScore * 0.3 + descriptionScore * 0.3 + locationScore * 0.1;

  if (confidence >= DUPLICATE_THRESHOLD) {
    return { isDuplicate: true, isCandidate: true, confidence, reason: "similitud alta" };
  }
  if (confidence >= CANDIDATE_THRESHOLD) {
    return {
      isDuplicate: false,
      isCandidate: true,
      confidence,
      reason: "posible duplicado, requiere revision",
    };
  }
  return { isDuplicate: false, isCandidate: false, confidence, reason: "sin coincidencia" };
}

export interface DedupResult {
  unique: NormalizedJob[];
  duplicates: { job: NormalizedJob; duplicateOf: string; confidence: number }[];
  candidates: { job: NormalizedJob; similarTo: string; confidence: number }[];
}

/**
 * Colapsa un lote de ofertas provenientes de varias fuentes.
 * Se conserva la primera aparicion (el orden de entrada define la prioridad).
 */
export function dedupeJobs(jobs: NormalizedJob[]): DedupResult {
  const unique: NormalizedJob[] = [];
  const duplicates: DedupResult["duplicates"] = [];
  const candidates: DedupResult["candidates"] = [];
  const seenHard = new Map<string, NormalizedJob>();
  const bySoftKey = new Map<string, NormalizedJob[]>();

  for (const job of jobs) {
    const hard = hardKey(job);
    const existing = seenHard.get(hard);
    if (existing) {
      duplicates.push({ job, duplicateOf: existing.id, confidence: 1 });
      continue;
    }

    const company = normalizeCompany(job.company.name);
    const bucket = bySoftKey.get(company) ?? [];
    let matched = false;

    for (const other of bucket) {
      const verdict = compareJobs(job, other);
      if (verdict.isDuplicate) {
        duplicates.push({ job, duplicateOf: other.id, confidence: verdict.confidence });
        matched = true;
        break;
      }
      if (verdict.isCandidate) {
        candidates.push({ job, similarTo: other.id, confidence: verdict.confidence });
      }
    }

    if (matched) continue;

    seenHard.set(hard, job);
    bucket.push(job);
    bySoftKey.set(company, bucket);
    unique.push(job);
  }

  return { unique, duplicates, candidates };
}
