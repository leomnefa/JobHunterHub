import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

/* ----------------------------- Utilidades ------------------------------ */

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function formatDate(value?: string | null, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function relativeTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return "—";
  const diff = Date.now() - date;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "recien";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return formatDate(value);
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "US$", EUR: "€", GBP: "£", ARS: "$" };

export function formatSalary(salary?: {
  min?: number;
  max?: number;
  currency?: string;
  period?: string;
}): string | null {
  if (!salary || (!salary.min && !salary.max)) return null;
  const symbol = CURRENCY_SYMBOLS[salary.currency ?? "USD"] ?? `${salary.currency ?? ""} `;
  const compact = (value: number) =>
    value >= 1000 ? `${Math.round(value / 100) / 10}k`.replace(".0k", "k") : String(value);
  const range =
    salary.min && salary.max
      ? `${compact(salary.min)} - ${compact(salary.max)}`
      : compact((salary.max ?? salary.min) as number);
  const periods: Record<string, string> = {
    year: "/ano",
    month: "/mes",
    hour: "/hora",
    day: "/dia",
    week: "/semana",
    project: "/proyecto",
  };
  return `${symbol}${range} ${periods[salary.period ?? ""] ?? ""}`.trim();
}

export const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contrato",
  freelance: "Freelance",
  temporary: "Temporal",
  internship: "Pasantia",
  unknown: "Sin especificar",
};

export const SENIORITY_LABELS: Record<string, string> = {
  intern: "Pasante",
  junior: "Junior",
  mid: "Semi senior",
  senior: "Senior",
  lead: "Lead",
  manager: "Manager",
  director: "Director",
  executive: "Ejecutivo",
  unknown: "Sin especificar",
};

export const REMOTE_LABELS: Record<string, string> = {
  remote: "Remoto",
  hybrid: "Hibrido",
  onsite: "Presencial",
  unknown: "Sin especificar",
};

export const STATUS_LABELS: Record<string, string> = {
  DISCOVERED: "Descubierta",
  MATCHED: "Analizada",
  READY_TO_APPLY: "Lista para postular",
  WAITING_USER_CONFIRMATION: "Esperando confirmacion",
  APPLYING: "Enviando",
  SUBMITTED: "Enviada",
  FAILED: "Fallida",
  REQUIRES_USER_ACTION: "Requiere accion",
  WITHDRAWN: "Retirada",
  REJECTED: "Rechazada",
  INTERVIEW: "Entrevista",
  OFFER: "Oferta",
  HIRED: "Contratada",
};

export const STATUS_TONES: Record<string, string> = {
  DISCOVERED: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  MATCHED: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  READY_TO_APPLY: "bg-brand-500/15 text-brand-300 border-brand-500/25",
  WAITING_USER_CONFIRMATION: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  APPLYING: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  SUBMITTED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  FAILED: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  REQUIRES_USER_ACTION: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  WITHDRAWN: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  REJECTED: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  INTERVIEW: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  OFFER: "bg-teal-500/15 text-teal-300 border-teal-500/25",
  HIRED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export function scoreTone(score: number): { text: string; ring: string; label: string } {
  if (score >= 80) return { text: "text-emerald-400", ring: "#34d399", label: "Alta" };
  if (score >= 60) return { text: "text-sky-400", ring: "#38bdf8", label: "Media" };
  if (score >= 40) return { text: "text-amber-400", ring: "#fbbf24", label: "Baja" };
  return { text: "text-rose-400", ring: "#fb7185", label: "Muy baja" };
}

/* -------------------------------- Tema --------------------------------- */

type Theme = "dark" | "light";
const THEME_KEY = "jobhunter.theme";

const ThemeContext = createContext<[Theme, () => void] | null>(null);

/**
 * El tema vive en un unico contexto: asi el login y el resto de la aplicacion
 * comparten siempre el mismo estado y no hay salto visual al iniciar sesion.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY) as Theme | null;
      if (stored === "dark" || stored === "light") return stored;
    } catch {
      /* sin storage: se usa el tema del sistema */
    }
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignorado */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((current) => (current === "dark" ? "light" : "dark")), []);
  const value = useMemo<[Theme, () => void]>(() => [theme, toggle], [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): [Theme, () => void] {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return context;
}

/** Media query reactiva: evita duplicar paneles entre layout ancho y modal. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

/* ------------------------------- Toasts -------------------------------- */

export interface Toast {
  id: number;
  tone: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
}

interface ToastApi {
  push: (toast: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de ToastProvider");
  return context;
}

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
} as const;

const TOAST_TONES = {
  success: "border-emerald-500/30 text-emerald-400",
  error: "border-rose-500/30 text-rose-400",
  info: "border-brand-500/30 text-brand-300",
  warning: "border-amber-500/30 text-amber-400",
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...toast, id }]);
      setTimeout(() => remove(id), toast.tone === "error" ? 8000 : 5000);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) => push({ tone: "success", title, description }),
      error: (title, description) => push({ tone: "error", title, description }),
      info: (title, description) => push({ tone: "info", title, description }),
      warning: (title, description) => push({ tone: "warning", title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2.5">
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className={cx(
                "surface animate-fade-up flex items-start gap-3 rounded-2xl px-4 py-3",
                TOAST_TONES[toast.tone],
              )}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-muted mt-0.5 text-xs leading-relaxed break-words">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => remove(toast.id)}
                className="text-muted rounded-lg p-1 transition hover:bg-black/10 dark:hover:bg-white/10"
                aria-label="Cerrar notificacion"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Extrae un mensaje legible de cualquier error. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
