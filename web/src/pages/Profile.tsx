import { useEffect, useRef, useState } from "react";
import {
  Award,
  Briefcase,
  Download,
  Eye,
  GraduationCap,
  Languages,
  Pencil,
  Save,
  Sparkles,
  Upload,
  Wrench,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api.ts";
import type { ParsedProfile } from "../lib/api.ts";
import { cx, errorMessage, formatDate, useToast } from "../lib/ui.tsx";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  Spinner,
  Textarea,
} from "../components/primitives.tsx";
import { PageHeader } from "../components/Layout.tsx";

interface ProfileResponse {
  profile: { id: string; markdown: string; sourceFilename?: string; updatedAt: string } | null;
  parsed: ParsedProfile | null;
  completeness: { score: number; missing: string[] };
}

const TEMPLATE = `# Perfil Profesional

## Datos personales
Nombre:
Ubicacion:
Email:
Telefono:
LinkedIn:
GitHub:

## Perfil
Describa en 3 o 4 lineas su posicionamiento profesional y sus anos de experiencia.

## Experiencia

### Empresa
2020 - Actualidad
- Rol y responsabilidades
- Tecnologias utilizadas
- Logros medibles

## Skills
-
-

## Educacion
-

## Certificaciones
-

## Idiomas
Espanol: Nativo
Ingles:

## Preferencias
Modalidad: remoto
Tipos de contrato: full time, contract, freelance
Salario esperado: USD  por ano
Disponibilidad:
`;

export function ProfilePage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = async () => {
    try {
      const result = await api.get<ProfileResponse>("/api/profile");
      setData(result);
      setMarkdown(result.profile?.markdown ?? "");
      setMode(result.profile ? "preview" : "edit");
      if (!result.profile) setMarkdown(TEMPLATE);
    } catch (error) {
      toast.error("No se pudo cargar el perfil", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!markdown.trim()) {
      toast.warning("El perfil esta vacio");
      return;
    }
    setSaving(true);
    try {
      const result = await api.put<ProfileResponse>("/api/profile", { markdown });
      setData(result);
      setMode("preview");
      toast.success("Perfil guardado", `Completitud: ${result.completeness.score}%`);
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    const text = await file.text();
    setMarkdown(text);
    setMode("edit");
    toast.info("Archivo cargado", "Revise el contenido y guarde para confirmar.");
  };

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "perfil.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateWithAi = async () => {
    setAiLoading(true);
    try {
      const result = await api.post<{ markdown: string }>("/api/profile/generate", { text: aiText });
      setMarkdown(result.markdown);
      setMode("edit");
      setAiOpen(false);
      setAiText("");
      toast.success("Perfil generado", "Revise el contenido antes de guardarlo.");
    } catch (error) {
      toast.error("No se pudo generar", errorMessage(error));
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <Spinner label="Cargando perfil..." />;

  const parsed = data?.parsed;
  const completeness = data?.completeness ?? { score: 0, missing: [] };

  return (
    <div>
      <PageHeader
        eyebrow="Fuente de verdad"
        title="Mi perfil"
        description="Su perfil en Markdown es la unica fuente de verdad: de aca salen el matching, el CV adaptado y las respuestas."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".md,.markdown,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
            <Button variant="secondary" icon={<Upload size={15} />} onClick={() => fileInput.current?.click()}>
              Subir .md
            </Button>
            <Button variant="secondary" icon={<Sparkles size={15} />} onClick={() => setAiOpen(true)}>
              Crear con IA
            </Button>
            <Button variant="secondary" icon={<Download size={15} />} onClick={download} disabled={!markdown}>
              Descargar
            </Button>
            <Button icon={<Save size={15} />} loading={saving} onClick={save}>
              Guardar
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card padded={false}>
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <div className="flex gap-1">
              <button
                onClick={() => setMode("preview")}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  mode === "preview"
                    ? "bg-brand-500/12 text-brand-300"
                    : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
                )}
              >
                <Eye size={13} /> Vista previa
              </button>
              <button
                onClick={() => setMode("edit")}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  mode === "edit"
                    ? "bg-brand-500/12 text-brand-300"
                    : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
                )}
              >
                <Pencil size={13} /> Editar
              </button>
            </div>
            <span className="text-muted text-[11px]">
              {data?.profile ? `Actualizado ${formatDate(data.profile.updatedAt, true)}` : "Sin guardar"}
            </span>
          </div>

          <div className="p-5">
            {mode === "edit" ? (
              <Textarea
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                rows={28}
                className="font-mono text-xs"
                placeholder="Pegue aca su perfil en Markdown"
              />
            ) : markdown ? (
              <div className="markdown-body max-h-[42rem] overflow-y-auto">
                <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
              </div>
            ) : (
              <EmptyState
                icon={<Pencil size={22} />}
                title="Sin perfil cargado"
                description="Suba un archivo .md, generelo con IA o escribalo usando la plantilla."
                action={
                  <Button size="sm" onClick={() => { setMarkdown(TEMPLATE); setMode("edit"); }}>
                    Usar plantilla
                  </Button>
                }
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Completitud del perfil" subtitle="Cuanto puede aprovechar el motor de matching" />
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 100 100" className="-rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-sunken)" strokeWidth="9" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={completeness.score >= 80 ? "#34d399" : completeness.score >= 50 ? "#38bdf8" : "#fbbf24"}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - completeness.score / 100)}
                    style={{ transition: "stroke-dashoffset 700ms ease" }}
                  />
                </svg>
                <span className="absolute inset-0 grid place-items-center text-lg font-semibold text-[var(--text-strong)]">
                  {completeness.score}
                </span>
              </div>
              <div className="min-w-0">
                {completeness.missing.length ? (
                  <>
                    <p className="text-muted mb-1.5 text-xs">Falta completar:</p>
                    <div className="flex flex-wrap gap-1">
                      {completeness.missing.map((item) => (
                        <Badge key={item} tone="warning">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-emerald-400">Perfil completo.</p>
                )}
              </div>
            </div>
          </Card>

          {parsed && (
            <Card>
              <CardHeader title="Lo que JobHunter detecto" subtitle="Datos extraidos automaticamente" />
              <dl className="space-y-2.5 text-xs">
                {[
                  ["Nombre", parsed.fullName],
                  ["Email", parsed.email],
                  ["Ubicacion", parsed.location],
                  ["Anos de experiencia", parsed.yearsOfExperience?.toString()],
                  ["Seniority", parsed.seniority],
                  ["Modalidad preferida", parsed.remotePreference],
                  [
                    "Salario esperado",
                    parsed.salaryExpectation
                      ? `${parsed.salaryExpectation.amount} ${parsed.salaryExpectation.currency}/${parsed.salaryExpectation.period}`
                      : undefined,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-muted">{label}</dt>
                    <dd className="truncate text-right text-[var(--text-strong)]">
                      {value || <span className="text-muted">sin detectar</span>}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 space-y-3 border-t pt-4">
                <Detected icon={<Wrench size={13} />} label={`Skills (${parsed.skills.length})`}>
                  {parsed.skills.slice(0, 24).map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </Detected>
                {parsed.languages.length > 0 && (
                  <Detected icon={<Languages size={13} />} label="Idiomas">
                    {parsed.languages.map((language) => (
                      <Badge key={language.name}>
                        {language.name}: {language.level}
                      </Badge>
                    ))}
                  </Detected>
                )}
                {parsed.experiences.length > 0 && (
                  <Detected icon={<Briefcase size={13} />} label={`Experiencia (${parsed.experiences.length})`}>
                    {parsed.experiences.slice(0, 6).map((experience, index) => (
                      <Badge key={index}>
                        {experience.company}
                        {experience.period ? ` · ${experience.period}` : ""}
                      </Badge>
                    ))}
                  </Detected>
                )}
                {parsed.education.length > 0 && (
                  <Detected icon={<GraduationCap size={13} />} label="Educacion">
                    {parsed.education.slice(0, 4).map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </Detected>
                )}
                {parsed.certifications.length > 0 && (
                  <Detected icon={<Award size={13} />} label="Certificaciones">
                    {parsed.certifications.slice(0, 6).map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </Detected>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="Crear perfil con IA"
        description="Pegue su informacion (CV en texto, LinkedIn, notas). La IA la estructura en Markdown sin inventar datos."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAiOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" loading={aiLoading} onClick={generateWithAi} disabled={aiText.length < 50}>
              Generar
            </Button>
          </>
        }
      >
        <Field label="Su informacion profesional" hint="Minimo 50 caracteres. Cuanto mas detalle, mejor.">
          <Textarea
            value={aiText}
            onChange={(event) => setAiText(event.target.value)}
            rows={12}
            placeholder="Soy ingeniero de datos con 15 anos de experiencia. Trabaje en... Manejo SQL Server, Python..."
          />
        </Field>
        <p className="text-muted mt-3 text-[11px]">
          Requiere un proveedor de IA configurado por el administrador. El resultado es editable
          antes de guardarlo.
        </p>
      </Modal>
    </div>
  );
}

function Detected({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted mb-1.5 flex items-center gap-1.5 text-[11px] font-medium">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
