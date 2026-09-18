/**
 * Modelo interno unico al que se normalizan TODAS las fuentes.
 * Ningun campo especifico de una plataforma debe filtrarse fuera del connector.
 */

export type RemoteType = "remote" | "hybrid" | "onsite" | "unknown";

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "freelance"
  | "temporary"
  | "internship"
  | "unknown";

export type Seniority =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "manager"
  | "director"
  | "executive"
  | "unknown";

export type ApplicationMethod = "api" | "browser" | "external" | "email" | "unknown";

/** Como declara cada connector lo que realmente puede hacer. Nunca se asume. */
export interface ConnectorCapabilities {
  search: boolean;
  jobDetails: boolean;
  applicationForm: boolean;
  apply: boolean;
  applicationStatus: boolean;
  oauth: boolean;
  apiKey: boolean;
  browserAutomationRequired: boolean;
  resumeUpload: boolean;
  coverLetterUpload: boolean;
  customQuestions: boolean;
}

export const NO_CAPABILITIES: ConnectorCapabilities = {
  search: false,
  jobDetails: false,
  applicationForm: false,
  apply: false,
  applicationStatus: false,
  oauth: false,
  apiKey: false,
  browserAutomationRequired: false,
  resumeUpload: false,
  coverLetterUpload: false,
  customQuestions: false,
};

/** Clasificacion honesta del nivel de integracion alcanzado. */
export type IntegrationMode =
  | "SEARCH_ONLY"
  | "API_APPLICATION"
  | "BROWSER_APPLICATION"
  | "HUMAN_REQUIRED"
  | "UNKNOWN";

export interface SalaryRange {
  min?: number;
  max?: number;
  currency?: string;
  period?: "hour" | "day" | "week" | "month" | "year" | "project" | "unknown";
}

export interface CompanyRef {
  name: string;
  website?: string;
  logoUrl?: string;
}

export interface NormalizedJob {
  id: string;
  source: string;
  sourceJobId: string;
  sourceUrl: string;
  title: string;
  company: CompanyRef;
  description: string;
  location?: string;
  country?: string;
  remoteType: RemoteType;
  worldwide?: boolean;
  employmentType?: EmploymentType;
  seniority?: Seniority;
  salary?: SalaryRange;
  skills: string[];
  categories: string[];
  publishedAt?: string;
  expiresAt?: string;
  retrievedAt: string;
  applicationUrl?: string;
  applicationMethod: ApplicationMethod;
  connectorCapabilities: ConnectorCapabilities;
  rawData?: unknown;
}

export interface JobSearchParams {
  keywords?: string[];
  excludedKeywords?: string[];
  countries?: string[];
  location?: string;
  remoteOnly?: boolean;
  worldwideOnly?: boolean;
  employmentTypes?: EmploymentType[];
  seniority?: Seniority[];
  salaryMin?: number;
  company?: string;
  limit?: number;
  cursor?: string;
  page?: number;
}

export interface JobSearchResult {
  jobs: NormalizedJob[];
  nextCursor?: string;
  totalAvailable?: number;
  /** Avisos no fatales: rate limit, filtros no soportados por la fuente, etc. */
  warnings?: string[];
}

/* ------------------------- Formularios / postulacion -------------------- */

export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "boolean"
  | "file";

export interface ApplicationFormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: { value: string; label: string }[];
  description?: string;
}

export interface ApplicationForm {
  jobId: string;
  source: string;
  fields: ApplicationFormField[];
  /** true cuando el formulario proviene de la API oficial y no de una inferencia. */
  authoritative: boolean;
  notes?: string[];
}

export interface ApplicationPayload {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  resume?: { filename: string; contentType: string; content: string };
  coverLetter?: { filename: string; contentType: string; content: string };
  answers?: Record<string, string>;
}

export type ApplicationStatus =
  | "DISCOVERED"
  | "MATCHED"
  | "READY_TO_APPLY"
  | "WAITING_USER_CONFIRMATION"
  | "APPLYING"
  | "SUBMITTED"
  | "FAILED"
  | "REQUIRES_USER_ACTION"
  | "WITHDRAWN"
  | "REJECTED"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED";

export interface ApplicationResult {
  status: ApplicationStatus;
  externalApplicationId?: string;
  message?: string;
  raw?: unknown;
}

export interface ConnectorHealth {
  connector: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE" | "NOT_CONFIGURED";
  latencyMs?: number;
  checkedAt: string;
  message?: string;
}

export interface ConnectorSettingField {
  key: string;
  label: string;
  type: "text" | "secret" | "list";
  required: boolean;
  placeholder?: string;
  help?: string;
}

/** Contrato unico que implementan todos los connectors. */
export interface JobConnector {
  readonly id: string;
  readonly name: string;
  readonly homepage: string;
  readonly docsUrl: string;
  readonly category: "job_board" | "ats" | "freelance" | "aggregator";
  readonly mode: IntegrationMode;
  readonly attribution?: string;
  readonly restrictions?: string[];
  /** Campos que el ADMIN debe completar para habilitar el connector. */
  readonly settingsSchema: ConnectorSettingField[];
  readonly rateLimit: { requestsPerMinute: number; requestsPerHour: number };

  getCapabilities(): ConnectorCapabilities;
  /** false cuando faltan credenciales o parametros obligatorios. */
  isConfigured(settings: ConnectorSettings): boolean;
  searchJobs(params: JobSearchParams, ctx: ConnectorContext): Promise<JobSearchResult>;
  getJob?(externalJobId: string, ctx: ConnectorContext): Promise<NormalizedJob | null>;
  getApplicationForm?(externalJobId: string, ctx: ConnectorContext): Promise<ApplicationForm>;
  submitApplication?(
    externalJobId: string,
    application: ApplicationPayload,
    ctx: ConnectorContext,
  ): Promise<ApplicationResult>;
  getApplicationStatus?(
    externalApplicationId: string,
    ctx: ConnectorContext,
  ): Promise<ApplicationResult>;
  healthCheck(ctx: ConnectorContext): Promise<ConnectorHealth>;
}

export type ConnectorSettings = Record<string, string>;

/** Todo lo que el connector necesita del host: settings, fetch limitado y logging. */
export interface ConnectorContext {
  settings: ConnectorSettings;
  fetchJson: <T>(url: string, init?: RequestInit) => Promise<T>;
  fetchText: (url: string, init?: RequestInit) => Promise<string>;
  log: (message: string, data?: unknown) => void;
}
