import type {
  EmploymentType,
  NormalizedJob,
  RemoteType,
  SalaryRange,
  Seniority,
} from "./types.ts";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "-",
  "&mdash;": "-",
};

export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EMPLOYMENT_PATTERNS: [RegExp, EmploymentType][] = [
  [/full[\s_-]?time|fulltime|permanent|jornada completa/i, "full_time"],
  [/part[\s_-]?time|parttime|media jornada/i, "part_time"],
  [/contract(or)?|contrato|b2b|c2c/i, "contract"],
  [/freelance|freelancer|autonom/i, "freelance"],
  [/intern(ship)?|pasant/i, "internship"],
  [/temporary|temp\b|seasonal|temporal/i, "temporary"],
];

export function normalizeEmploymentType(value?: string | null): EmploymentType {
  if (!value) return "unknown";
  for (const [pattern, type] of EMPLOYMENT_PATTERNS) {
    if (pattern.test(value)) return type;
  }
  return "unknown";
}

const SENIORITY_PATTERNS: [RegExp, Seniority][] = [
  [/\b(c-?level|cto|ceo|cio|vp|vice president|executive)\b/i, "executive"],
  [/\b(director|head of)\b/i, "director"],
  [/\b(manager|management|gerente)\b/i, "manager"],
  [/\b(lead|principal|staff|architect|arquitect)\b/i, "lead"],
  [/\b(senior|sr\.?|expert|experto)\b/i, "senior"],
  [/\b(mid[\s-]?level|semi[\s-]?senior|ssr\.?|intermediate)\b/i, "mid"],
  [/\b(junior|jr\.?|entry[\s-]?level|graduate|trainee)\b/i, "junior"],
  [/\b(intern|internship|pasante)\b/i, "intern"],
];

export function normalizeSeniority(...values: (string | undefined | null)[]): Seniority {
  const haystack = values.filter(Boolean).join(" ");
  if (!haystack) return "unknown";
  for (const [pattern, level] of SENIORITY_PATTERNS) {
    if (pattern.test(haystack)) return level;
  }
  return "unknown";
}

export function normalizeRemoteType(...values: (string | undefined | null)[]): RemoteType {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return "unknown";
  if (/hybrid|hibrid/.test(haystack)) return "hybrid";
  if (/remote|remoto|anywhere|worldwide|work from home|teletrabajo/.test(haystack)) {
    return "remote";
  }
  if (/on[\s-]?site|presencial|in[\s-]?office/.test(haystack)) return "onsite";
  return "unknown";
}

export function isWorldwide(location?: string | null): boolean {
  if (!location) return false;
  return /worldwide|anywhere|global|any location/i.test(location);
}

const SALARY_PERIODS: Record<string, NonNullable<SalaryRange["period"]>> = {
  annual: "year",
  yearly: "year",
  year: "year",
  annually: "year",
  monthly: "month",
  month: "month",
  weekly: "week",
  week: "week",
  daily: "day",
  day: "day",
  hourly: "hour",
  hour: "hour",
  project: "project",
};

export function normalizeSalaryPeriod(value?: string | null): SalaryRange["period"] {
  if (!value) return "unknown";
  return SALARY_PERIODS[value.toLowerCase()] ?? "unknown";
}

/** Convierte cualquier periodo a un equivalente anual aproximado, para comparar. */
export function annualizeSalary(salary?: SalaryRange): number | undefined {
  if (!salary) return undefined;
  const base = salary.max ?? salary.min;
  if (!base || base <= 0) return undefined;
  switch (salary.period) {
    case "hour":
      return base * 40 * 52;
    case "day":
      return base * 5 * 52;
    case "week":
      return base * 52;
    case "month":
      return base * 12;
    case "year":
      return base;
    default:
      // Heuristica conservadora: valores chicos suelen ser tarifa horaria.
      if (base < 500) return base * 40 * 52;
      if (base < 30000) return base * 12;
      return base;
  }
}

/**
 * Catalogo de tecnologias reconocidas. Se usa para extraer skills de una
 * descripcion cuando la fuente no las entrega estructuradas.
 */
export const SKILL_DICTIONARY: string[] = [
  "sql", "sql server", "t-sql", "mysql", "postgresql", "oracle", "mongodb", "redis",
  "snowflake", "databricks", "bigquery", "redshift", "synapse", "ssis", "ssrs", "ssas",
  "etl", "elt", "data warehouse", "data lake", "dbt", "airflow", "kafka", "spark",
  "hadoop", "power bi", "qlik", "qlikview", "qlik sense", "tableau", "looker",
  "python", "java", "javascript", "typescript", "c#", ".net", "vb.net", "asp.net",
  "node.js", "react", "angular", "vue", "next.js", "svelte", "php", "ruby", "go",
  "rust", "kotlin", "swift", "scala", "matlab", "bash", "powershell",
  "docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions",
  "gitlab ci", "aws", "azure", "gcp", "google cloud", "linux", "windows server",
  "rest", "graphql", "grpc", "soap", "api", "microservices", "ci/cd", "devops",
  "machine learning", "deep learning", "nlp", "llm", "openai", "anthropic",
  "langchain", "rag", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch",
  "git", "jira", "scrum", "agile", "kanban", "html", "css", "tailwind", "sass",
  "excel", "vba", "sharepoint", "salesforce", "sap", "dynamics",
];

/**
 * Patron de deteccion de una tecnologia dentro de texto libre.
 * Acepta que la palabra termine la frase ("... Python.") pero evita capturar
 * prefijos de otro termino ("node" dentro de "node.js").
 */
export function skillPattern(skill: string): RegExp {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9+#])${escaped}(?![a-z0-9+#])(?!\\.[a-z0-9])`, "i");
}

export function extractSkills(text: string, extra: string[] = []): string[] {
  const haystack = ` ${text.toLowerCase()} `;
  const found = new Set<string>();
  for (const skill of SKILL_DICTIONARY) {
    if (skillPattern(skill).test(haystack)) found.add(skill);
  }
  for (const item of extra) {
    const clean = item.trim().toLowerCase();
    if (clean && clean.length <= 40) found.add(clean);
  }
  return [...found].sort();
}

/** Normaliza texto para comparaciones (dedup, matching). */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMPANY_NOISE =
  /\b(inc|llc|ltd|limited|srl|sas|gmbh|bv|plc|corp|corporation|company|co|group|technologies|tech|solutions|labs|studio)\b/g;

export function normalizeCompany(name: string): string {
  return normalizeText(name).replace(COMPANY_NOISE, "").replace(/\s+/g, " ").trim();
}

export function toIsoDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  let date: Date;
  if (typeof value === "number") {
    // Timestamps en segundos vs milisegundos.
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else {
    date = new Date(String(value));
  }
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Identificador interno estable y unico por fuente + id externo. */
export function buildJobId(source: string, sourceJobId: string): string {
  return `${source}:${sourceJobId}`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}...`;
}

/** Aplica los filtros que la fuente no soporta de forma nativa. */
export function applyClientFilters(
  jobs: NormalizedJob[],
  params: { keywords?: string[]; excludedKeywords?: string[]; salaryMin?: number },
): NormalizedJob[] {
  const keywords = (params.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);
  const excluded = (params.excludedKeywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);
  return jobs.filter((job) => {
    const haystack =
      `${job.title} ${job.company.name} ${job.description} ${job.skills.join(" ")} ${job.categories.join(" ")}`.toLowerCase();
    if (keywords.length && !keywords.some((k) => haystack.includes(k))) return false;
    if (excluded.length && excluded.some((k) => haystack.includes(k))) return false;
    if (params.salaryMin) {
      const annual = annualizeSalary(job.salary);
      if (annual !== undefined && annual < params.salaryMin) return false;
    }
    return true;
  });
}
