import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "../lib/ui.tsx";

/* ------------------------------- Boton --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white shadow-lg shadow-brand-600/25 hover:bg-brand-600 disabled:bg-brand-500/50",
  secondary:
    "border bg-[var(--surface-raised)] text-[var(--text-strong)] hover:border-brand-500/50 hover:bg-brand-500/5",
  ghost: "text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-strong)] dark:hover:bg-white/5",
  danger: "bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-600/20",
  subtle: "bg-brand-500/12 text-brand-300 hover:bg-brand-500/20 border border-brand-500/20",
};

// Pildoras: es la forma que usan los CTA de Grupo FM.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs gap-1.5 rounded-full",
  md: "h-10 px-5 text-sm gap-2 rounded-full",
  lg: "h-11 px-7 text-sm gap-2.5 rounded-full",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------ Formulario ------------------------------ */

const FIELD_BASE =
  "w-full rounded-xl border bg-[var(--surface-sunken)] px-3.5 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)]/70 transition focus:border-brand-500/50 disabled:opacity-60";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-[var(--text-strong)]">
          {label}
          {required && <span className="text-rose-400">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="text-muted mt-1 block text-[11px] leading-snug">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-rose-400">{error}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(FIELD_BASE, "h-10", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(FIELD_BASE, "py-2.5 leading-relaxed", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cx(FIELD_BASE, "h-10 cursor-pointer", className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-[var(--border-soft)] accent-[var(--color-brand-500)]"
      />
      <span className="min-w-0">
        <span className="block text-sm text-[var(--text-strong)]">{label}</span>
        {description && <span className="text-muted block text-[11px] leading-snug">{description}</span>}
      </span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        // ring-inset en lugar de border: el borde cambiaria el tamano de la caja
        // entre los dos estados y descentraria el circulo.
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full ring-1 ring-inset transition-colors duration-200",
        checked
          ? "bg-brand-500 ring-brand-500"
          : "bg-[var(--surface-sunken)] ring-[var(--border-soft)]",
      )}
    >
      {/* left explicito: sin el, la posicion estatica del span lo manda al
          extremo derecho de la pista y el desplazamiento lo saca de la caja. */}
      <span
        className={cx(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

/* -------------------------------- Card --------------------------------- */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cx(
        "surface rounded-2xl transition-colors duration-500 hover:border-brand-500/30",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="bg-brand-500/12 text-brand-400 grid h-9 w-9 shrink-0 place-items-center rounded-xl">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-[var(--text-strong)]">
            {title}
          </h2>
          {subtitle && <p className="text-muted mt-0.5 text-xs">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Badge -------------------------------- */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-soft)]",
    brand: "bg-brand-500/12 text-brand-300 border-brand-500/25",
    success: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
    warning: "bg-amber-500/12 text-amber-400 border-amber-500/25",
    danger: "bg-rose-500/12 text-rose-400 border-rose-500/25",
    info: "bg-sky-500/12 text-sky-400 border-sky-500/25",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------ Estados -------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <span className="bg-brand-500/10 text-brand-400 mb-4 grid h-14 w-14 place-items-center rounded-2xl">
          {icon}
        </span>
      )}
      <h3 className="text-sm font-semibold text-[var(--text-strong)]">{title}</h3>
      {description && (
        <p className="text-muted mt-1.5 max-w-md text-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-xl", className)} />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-12">
      <Loader2 size={18} className="text-brand-400 animate-spin" />
      {label && <span className="text-muted text-sm">{label}</span>}
    </div>
  );
}

/* -------------------------------- Modal -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Cerrar"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          // El dialogo nunca supera la altura de la ventana: el cuerpo scrollea
          // y el pie de botones queda siempre visible.
          "surface animate-fade-up relative flex max-h-[92vh] w-full flex-col rounded-t-3xl sm:max-h-[88vh] sm:rounded-2xl",
          widths[size],
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--text-strong)]">{title}</h2>
            {description && <p className="text-muted mt-1 text-xs leading-relaxed">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Indicadores ------------------------------ */

export function ScoreRing({
  score,
  size = 56,
  color,
  label,
}: {
  score: number;
  size?: number;
  color: string;
  label?: string;
}) {
  const stroke = size >= 56 ? 5 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="font-semibold tabular-nums"
          style={{ fontSize: size / 3.6, color: "var(--text-strong)" }}
        >
          {Math.round(score)}
        </span>
      </div>
      {label && <span className="text-muted mt-1 block text-center text-[10px]">{label}</span>}
    </div>
  );
}

export function MeterBar({
  value,
  label,
  color = "var(--color-brand-500)",
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-[var(--text-strong)]">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    brand: "from-brand-500/15 to-brand-500/0 text-brand-400",
    success: "from-emerald-500/15 to-emerald-500/0 text-emerald-400",
    warning: "from-amber-500/15 to-amber-500/0 text-amber-400",
    danger: "from-rose-500/15 to-rose-500/0 text-rose-400",
    info: "from-sky-500/15 to-sky-500/0 text-sky-400",
  };

  return (
    <div className="surface relative overflow-hidden rounded-2xl p-4">
      <div className={cx("absolute inset-0 bg-gradient-to-br", tones[tone])} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--text-strong)]">
            {value}
          </p>
          {hint && <p className="text-muted mt-1 truncate text-[11px]">{hint}</p>}
        </div>
        {icon && <span className={cx("shrink-0", tones[tone].split(" ").pop())}>{icon}</span>}
      </div>
    </div>
  );
}
