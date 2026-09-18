import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Eye, EyeOff, LogIn, Moon, Sparkles, Sun, Zap, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth.tsx";
import { errorMessage, useTheme } from "../lib/ui.tsx";
import { Button, Field, Input } from "../components/primitives.tsx";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, toggleTheme] = useTheme();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.role === "ADMIN" ? "/admin" : "/", { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
      <button
        onClick={toggleTheme}
        className="text-muted absolute top-5 right-5 z-20 rounded-xl border bg-[var(--surface-raised)] p-2.5 transition hover:text-[var(--text-strong)]"
        aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      {/* Panel de marca */}
      <div className="hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="from-brand-500 to-accent-500 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg shadow-brand-600/30">
            <BriefcaseBusiness size={22} />
          </span>
          <span className="text-lg font-semibold text-[var(--text-strong)]">JobHunter AI</span>
        </div>

        <div className="max-w-lg">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-[var(--text-strong)]">
            Una sola plataforma para{" "}
            <span className="from-brand-400 to-accent-400 bg-gradient-to-r bg-clip-text text-transparent">
              buscar, analizar y postular
            </span>
          </h1>
          <p className="text-muted mt-4 text-sm leading-relaxed">
            Centraliza ofertas de job boards, ATS y marketplaces freelance, las normaliza en un
            unico formato y las compara contra tu perfil profesional real.
          </p>

          <div className="mt-10 space-y-4">
            {[
              {
                icon: Zap,
                title: "Busqueda unificada",
                text: "Himalayas, Jobicy, Remotive, Remote OK, Greenhouse, Lever, Ashby y mas, sin duplicados.",
              },
              {
                icon: Sparkles,
                title: "Analisis con IA",
                text: "Compatibilidad explicada, CV adaptado y carta de presentacion a partir de tu perfil.",
              },
              {
                icon: ShieldCheck,
                title: "Datos en tu PC",
                text: "Base local, credenciales cifradas y APIs oficiales respetando sus terminos de uso.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="bg-brand-500/12 text-brand-400 mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl">
                  <item.icon size={17} />
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--text-strong)]">{item.title}</p>
                  <p className="text-muted mt-0.5 text-xs leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-muted text-[11px]">
          Instalacion local · Los datos de cada usuario quedan aislados en esta computadora.
        </p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="surface animate-fade-up w-full max-w-md rounded-3xl p-8">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="from-brand-500 to-accent-500 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white">
              <BriefcaseBusiness size={20} />
            </span>
            <span className="text-base font-semibold text-[var(--text-strong)]">JobHunter AI</span>
          </div>

          <h2 className="text-xl font-semibold text-[var(--text-strong)]">Iniciar sesion</h2>
          <p className="text-muted mt-1 text-sm">Ingresa con tu usuario para continuar.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                autoComplete="username"
                autoFocus
                required
              />
            </Field>

            <Field label="Contrasena" required>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-muted absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 hover:text-[var(--text-strong)]"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} icon={<LogIn size={16} />} className="w-full">
              Ingresar
            </Button>
          </form>

          <p className="text-muted mt-6 text-center text-[11px] leading-relaxed">
            Si es la primera vez, use el usuario administrador definido en el archivo{" "}
            <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5">.env</code> y cambie la
            contrasena al ingresar.
          </p>
        </div>
      </div>
    </div>
  );
}
