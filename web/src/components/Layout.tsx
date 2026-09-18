import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Cable,
  ChevronLeft,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "../lib/auth.tsx";
import { api } from "../lib/api.ts";
import { cx, useTheme } from "../lib/ui.tsx";
import { Button } from "./primitives.tsx";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Gauge;
  badge?: number;
}

const USER_NAV: NavItem[] = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/buscar", label: "Buscar trabajos", icon: Search },
  { to: "/ofertas", label: "Ofertas guardadas", icon: BriefcaseBusiness },
  { to: "/busquedas", label: "Mis busquedas", icon: Star },
  { to: "/postulaciones", label: "Mis postulaciones", icon: ScrollText },
  { to: "/cv", label: "Mis CV", icon: FileText },
  { to: "/perfil", label: "Mi perfil", icon: UserRound },
  { to: "/preferencias", label: "Preferencias", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Panel", icon: Gauge },
  { to: "/admin/usuarios", label: "Usuarios", icon: Users },
  { to: "/admin/conectores", label: "Conectores", icon: Cable },
  { to: "/admin/ia", label: "Inteligencia artificial", icon: Sparkles },
  { to: "/admin/estado", label: "Estado del sistema", icon: Activity },
  { to: "/admin/logs", label: "Auditoria", icon: ShieldCheck },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const isAdmin = user?.role === "ADMIN";
  const nav = isAdmin ? ADMIN_NAV : USER_NAV;

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await api.get<{ alerts: unknown[] }>("/api/alerts?unread=true");
        if (!cancelled) setUnread(result.alerts.length);
      } catch {
        /* silencioso: el contador de alertas no es critico */
      }
    };
    void load();
    const timer = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isAdmin, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-[var(--surface-raised)] transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="from-brand-500 to-accent-500 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg shadow-brand-600/25">
            <BriefcaseBusiness size={20} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-strong)]">JobHunter AI</p>
            <p className="text-muted text-[11px]">
              {isAdmin ? "Administracion" : "Busqueda inteligente"}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted ml-auto rounded-lg p-1.5 hover:bg-black/5 lg:hidden dark:hover:bg-white/5"
            aria-label="Cerrar menu"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/" || item.to === "/admin"}
              className={({ isActive }) =>
                cx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  isActive
                    ? "bg-brand-500/12 text-brand-300 font-medium shadow-[inset_2px_0_0_0_var(--color-brand-500)]"
                    : "text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-strong)] dark:hover:bg-white/5",
                )
              }
            >
              <item.icon size={17} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}

          {!isAdmin && (
            <NavLink
              to="/alertas"
              className={({ isActive }) =>
                cx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  isActive
                    ? "bg-brand-500/12 text-brand-300 font-medium shadow-[inset_2px_0_0_0_var(--color-brand-500)]"
                    : "text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-strong)] dark:hover:bg-white/5",
                )
              }
            >
              <Bell size={17} className="shrink-0" />
              <span className="flex-1 truncate">Alertas</span>
              {unread > 0 && (
                <span className="bg-brand-500 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </NavLink>
          )}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="from-brand-400 to-accent-500 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--text-strong)]">{user?.name}</p>
              <p className="text-muted truncate text-[11px]">{user?.email}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={toggleTheme}
              icon={theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            >
              {theme === "dark" ? "Claro" : "Oscuro"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              icon={<LogOut size={14} />}
              aria-label="Cerrar sesion"
            >
              Salir
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menu"
        />
      )}

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-[var(--surface)]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="text-muted rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-[var(--text-strong)]">JobHunter AI</span>
        </header>

        <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-2xl">
          {title}
        </h1>
        {description && <p className="text-muted mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
