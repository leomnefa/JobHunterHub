import { useEffect, useState } from "react";
import { KeyRound, MessageSquareText, Plus, Save, Settings, Trash2 } from "lucide-react";
import { api } from "../lib/api.ts";
import { errorMessage, useToast } from "../lib/ui.tsx";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from "../components/primitives.tsx";
import { PageHeader } from "../components/Layout.tsx";

interface Preferences {
  desiredRoles: string[];
  employmentTypes: string[];
  remotePreference: string;
  countriesAllowed: string[];
  timezones: string[];
  salaryMin: number | null;
  salaryCurrency: string;
  availability: string;
  excludedKeywords: string[];
  minMatchAlert: number;
}

interface StoredAnswer {
  id: string;
  question: string;
  answer: string;
  updated_at: string;
}

const join = (values: string[] | undefined) => (values ?? []).join(", ");

export function PreferencesPage() {
  const toast = useToast();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [answers, setAnswers] = useState<StoredAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [answerOpen, setAnswerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = async () => {
    try {
      const [preferencesResult, answersResult] = await Promise.all([
        api.get<{ preferences: Preferences }>("/api/preferences"),
        api.get<{ answers: StoredAnswer[] }>("/api/answers"),
      ]);
      setPreferences(preferencesResult.preferences);
      setAnswers(answersResult.answers);
    } catch (error) {
      toast.error("No se pudieron cargar las preferencias", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!preferences) return;
    setSaving(true);
    try {
      await api.put("/api/preferences", preferences);
      toast.success("Preferencias guardadas");
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveAnswer = async () => {
    try {
      if (editingId) await api.put(`/api/answers/${editingId}`, { question, answer });
      else await api.post("/api/answers", { question, answer });
      toast.success("Respuesta guardada");
      setAnswerOpen(false);
      setEditingId(null);
      setQuestion("");
      setAnswer("");
      await load();
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    }
  };

  const removeAnswer = async (id: string) => {
    await api.delete(`/api/answers/${id}`);
    await load();
  };

  const changePassword = async () => {
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      toast.success("Contrasena actualizada");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error("No se pudo cambiar la contrasena", errorMessage(error));
    }
  };

  if (loading || !preferences) return <Spinner label="Cargando preferencias..." />;

  const update = (patch: Partial<Preferences>) => setPreferences({ ...preferences, ...patch });
  const split = (value: string) =>
    value.split(",").map((item) => item.trim()).filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Preferencias"
        description="Estos criterios alimentan el motor de matching y las alertas automaticas."
        actions={
          <Button icon={<Save size={15} />} loading={saving} onClick={save}>
            Guardar cambios
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Criterios de busqueda"
            subtitle="Lo que se considera una buena oportunidad para usted"
            icon={<Settings size={17} />}
          />
          <div className="space-y-4">
            <Field label="Puestos de interes" hint="Separados por coma">
              <Input
                value={join(preferences.desiredRoles)}
                onChange={(event) => update({ desiredRoles: split(event.target.value) })}
                placeholder="Senior Data Engineer, Qlik Developer"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Modalidad preferida">
                <Select
                  value={preferences.remotePreference}
                  onChange={(event) => update({ remotePreference: event.target.value })}
                >
                  <option value="remote">Remoto</option>
                  <option value="hybrid">Hibrido</option>
                  <option value="onsite">Presencial</option>
                  <option value="any">Indistinto</option>
                </Select>
              </Field>
              <Field label="Tipos de contrato" hint="full_time, contract, freelance">
                <Input
                  value={join(preferences.employmentTypes)}
                  onChange={(event) => update({ employmentTypes: split(event.target.value) })}
                  placeholder="full_time, contract"
                />
              </Field>
            </div>

            <Field label="Paises permitidos" hint="Vacio = sin restriccion">
              <Input
                value={join(preferences.countriesAllowed)}
                onChange={(event) => update({ countriesAllowed: split(event.target.value) })}
                placeholder="Argentina, United States, Worldwide"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Salario minimo anual">
                <Input
                  type="number"
                  value={preferences.salaryMin ?? ""}
                  onChange={(event) =>
                    update({ salaryMin: event.target.value ? Number(event.target.value) : null })
                  }
                  placeholder="70000"
                />
              </Field>
              <Field label="Moneda">
                <Select
                  value={preferences.salaryCurrency}
                  onChange={(event) => update({ salaryCurrency: event.target.value })}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="ARS">ARS</option>
                </Select>
              </Field>
            </div>

            <Field label="Zonas horarias compatibles" hint="Ej: UTC-3, UTC-5">
              <Input
                value={join(preferences.timezones)}
                onChange={(event) => update({ timezones: split(event.target.value) })}
                placeholder="UTC-3, UTC-5"
              />
            </Field>

            <Field label="Disponibilidad">
              <Input
                value={preferences.availability ?? ""}
                onChange={(event) => update({ availability: event.target.value })}
                placeholder="Inmediata / 15 dias"
              />
            </Field>

            <Field label="Palabras excluidas" hint="Ofertas con estas palabras bajan de prioridad">
              <Input
                value={join(preferences.excludedKeywords)}
                onChange={(event) => update({ excludedKeywords: split(event.target.value) })}
                placeholder="crypto, ventas, call center"
              />
            </Field>

            <Field
              label={`Umbral de alerta: ${preferences.minMatchAlert}%`}
              hint="Solo se generan alertas por ofertas con compatibilidad igual o mayor"
            >
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={preferences.minMatchAlert}
                onChange={(event) => update({ minMatchAlert: Number(event.target.value) })}
                className="accent-brand-500 w-full"
              />
            </Field>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Respuestas reutilizables"
              subtitle="Se usan para completar formularios de postulacion sin inventar datos"
              icon={<MessageSquareText size={17} />}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus size={13} />}
                  onClick={() => {
                    setEditingId(null);
                    setQuestion("");
                    setAnswer("");
                    setAnswerOpen(true);
                  }}
                >
                  Agregar
                </Button>
              }
            />

            {answers.length === 0 ? (
              <EmptyState
                icon={<MessageSquareText size={20} />}
                title="Sin respuestas guardadas"
                description="Guarde respuestas frecuentes (autorizacion laboral, disponibilidad, expectativa salarial) para reutilizarlas en cada postulacion."
              />
            ) : (
              <div className="space-y-2">
                {answers.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-xl bg-[var(--surface-sunken)] p-3 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--text-strong)]">
                          {item.question}
                        </p>
                        <p className="text-muted mt-1 text-[11px] leading-relaxed">{item.answer}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(item.id);
                            setQuestion(item.question);
                            setAnswer(item.answer);
                            setAnswerOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 size={12} />}
                          onClick={() => removeAnswer(item.id)}
                          aria-label="Eliminar"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Seguridad" subtitle="Cambiar la contrasena de acceso" icon={<KeyRound size={17} />} />
            <div className="space-y-3">
              <Field label="Contrasena actual">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              <Field label="Nueva contrasena" hint="Minimo 8 caracteres">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Button
                variant="secondary"
                onClick={changePassword}
                disabled={!currentPassword || newPassword.length < 8}
              >
                Cambiar contrasena
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={answerOpen}
        onClose={() => setAnswerOpen(false)}
        title={editingId ? "Editar respuesta" : "Nueva respuesta"}
        description="Estos datos se usan tal cual: la IA nunca los reemplaza por informacion inventada."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAnswerOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={saveAnswer} disabled={!question || !answer}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Pregunta" required hint="Como aparece en los formularios">
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Are you authorized to work in the United States?"
            />
          </Field>
          <Field label="Respuesta" required>
            <Textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={4}
              placeholder="No, requiero sponsorship. Trabajo como contractor desde Argentina."
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
