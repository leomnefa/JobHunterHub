/**
 * Cliente HTTP de la aplicacion.
 * El token se guarda en localStorage y se envia en cada request; si el backend
 * responde 401 la sesion se limpia y la UI vuelve al login.
 */

const TOKEN_KEY = "jobhunter.token";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* modo privado sin storage: la sesion dura lo que la pestana */
  }
}

let onUnauthorized: (() => void) | undefined;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(
      (payload.error as string) ?? `Error ${response.status}`,
      response.status,
      payload.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

/* ------------------------------- Tipos --------------------------------- */

export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  mustChangePassword?: boolean;
}

export interface Job {
  id: string;
  source: string;
  sourceJobId: string;
  sourceUrl: string;
  title: string;
  company: { name: string; website?: string; logoUrl?: string };
  description: string;
  location?: string;
  country?: string;
  remoteType: "remote" | "hybrid" | "onsite" | "unknown";
  worldwide?: boolean;
  employmentType?: string;
  seniority?: string;
  salary?: { min?: number; max?: number; currency?: string; period?: string };
  skills: string[];
  categories: string[];
  publishedAt?: string;
  retrievedAt: string;
  applicationUrl?: string;
  applicationMethod: string;
  connectorCapabilities: Record<string, boolean>;
}

export interface Match {
  jobId: string;
  compatibilityScore: number;
  skillsMatch: number;
  experienceMatch: number;
  locationMatch: number;
  salaryMatch: number;
  seniorityMatch: number;
  contractMatch: number;
  languageMatch: number;
  aiAnalysis: string;
  matchedSkills: string[];
  missingSkills: string[];
  risks: string[];
  recommendation: "apply" | "review" | "ignore";
  analyzedBy: "heuristic" | "llm";
}

export interface SourceOutcome {
  source: string;
  name: string;
  status: "ok" | "error" | "empty";
  jobs: number;
  durationMs: number;
  warnings: string[];
  error?: string;
}

export interface SearchResponse {
  jobs: Job[];
  matches: Record<string, Match>;
  outcomes: SourceOutcome[];
  duplicatesRemoved: number;
  duplicateCandidates: number;
  durationMs: number;
  attributions: string[];
}

export interface ApplicationRow {
  id: string;
  job_id: string;
  source: string;
  status: string;
  match_score: number | null;
  notes: string | null;
  error_message: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  job_title: string;
  company_name: string;
  source_url: string;
  location: string | null;
  remote_type: string;
  resume_id: string | null;
  cover_letter_id: string | null;
  external_application_id: string | null;
}

export interface SourceView {
  id: string;
  name: string;
  category: string;
  mode: string;
  homepage: string;
  docsUrl: string;
  enabled: boolean;
  configured: boolean;
  capabilities: Record<string, boolean>;
  settingsSchema: {
    key: string;
    label: string;
    type: "text" | "secret" | "list";
    required: boolean;
    placeholder?: string;
    help?: string;
  }[];
  settings: Record<string, string>;
  restrictions: string[];
  attribution?: string;
  rateLimit: { requestsPerMinute: number; requestsPerHour: number };
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
}

export interface ParsedProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  languages: { name: string; level: string }[];
  education: string[];
  certifications: string[];
  experiences: { company?: string; role?: string; period?: string; bullets: string[] }[];
  yearsOfExperience?: number;
  seniority: string;
  preferredEmploymentTypes: string[];
  remotePreference?: string;
  salaryExpectation?: { amount: number; currency: string; period: string };
  wordCount: number;
}
