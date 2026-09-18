import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { api } from "../../lib/api.ts";
import { useAuth } from "../../lib/auth.tsx";
import { cx, errorMessage, formatDate, relativeTime, useToast } from "../../lib/ui.tsx";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Toggle,
} from "../../components/primitives.tsx";
import { PageHeader } from "../../components/Layout.tsx";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  active: number;
  must_change_password: number;
  created_at: string;
  last_login_at: string | null;
  applications: number;
  has_profile: number;
}

export function AdminUsersPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.get<{ users: UserRow[] }>("/api/admin/users");
      setUsers(result.users);
    } catch (error) {
      toast.error("No se pudieron cargar los usuarios", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("USER");
    setActive(true);
    setFormOpen(true);
  };

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setName(row.name);
    setEmail(row.email);
    setPassword("");
    setRole(row.role);
    setActive(row.active === 1);
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/admin/users/${editing.id}`, { name, email, role, active });
        toast.success("Usuario actualizado");
      } else {
        await api.post("/api/admin/users", { name, email, password, role, active });
        toast.success("Usuario creado", "Debera cambiar la contrasena al ingresar.");
      }
      setFormOpen(false);
      await load();
    } catch (error) {
      toast.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    if (!resetFor) return;
    try {
      await api.post(`/api/admin/users/${resetFor.id}/reset-password`, { password: resetPassword });
      toast.success("Contrasena reseteada", `${resetFor.email} debera cambiarla al ingresar.`);
      setResetFor(null);
      setResetPassword("");
    } catch (error) {
      toast.error("No se pudo resetear", errorMessage(error));
    }
  };

  const remove = async (row: UserRow) => {
    try {
      await api.delete(`/api/admin/users/${row.id}`);
      toast.success("Usuario eliminado", "Se borraron tambien sus datos asociados.");
      await load();
    } catch (error) {
      toast.error("No se pudo eliminar", errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Cada usuario tiene su propio perfil, CVs y postulaciones, completamente aislados del resto."
        actions={
          <Button icon={<Plus size={15} />} onClick={openCreate}>
            Nuevo usuario
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <EmptyState icon={<Users size={24} />} title="Sin usuarios" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {users.map((row) => (
            <Card key={row.id} className="animate-fade-up">
              <div className="flex flex-wrap items-center gap-4">
                <span
                  className={cx(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white",
                    row.role === "ADMIN"
                      ? "bg-gradient-to-br from-amber-500 to-orange-600"
                      : "from-brand-400 to-accent-500 bg-gradient-to-br",
                  )}
                >
                  {row.name.charAt(0).toUpperCase()}
                </span>

                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-strong)]">{row.name}</h3>
                    <Badge tone={row.role === "ADMIN" ? "warning" : "brand"}>
                      {row.role === "ADMIN" ? (
                        <>
                          <ShieldCheck size={10} /> Admin
                        </>
                      ) : (
                        <>
                          <UserRound size={10} /> Usuario
                        </>
                      )}
                    </Badge>
                    {row.active === 0 && <Badge tone="danger">Inactivo</Badge>}
                    {row.must_change_password === 1 && (
                      <Badge tone="warning">Debe cambiar contrasena</Badge>
                    )}
                  </div>
                  <p className="text-muted mt-0.5 text-xs">{row.email}</p>
                </div>

                <div className="text-muted grid grid-cols-3 gap-4 text-[11px]">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">{row.applications}</p>
                    <p>postulaciones</p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">
                      {row.has_profile ? "Si" : "No"}
                    </p>
                    <p>perfil</p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">
                      {row.last_login_at ? relativeTime(row.last_login_at) : "nunca"}
                    </p>
                    <p>ultimo acceso</p>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" icon={<Pencil size={12} />} onClick={() => openEdit(row)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<KeyRound size={12} />}
                    onClick={() => setResetFor(row)}
                  >
                    Reset
                  </Button>
                  {row.id !== currentUser?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={12} />}
                      onClick={() => remove(row)}
                      aria-label="Eliminar"
                    />
                  )}
                </div>
              </div>
              <p className="text-muted mt-3 border-t pt-2 text-[10px]">
                Creado el {formatDate(row.created_at)}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar usuario" : "Nuevo usuario"}
        description={
          editing
            ? "Los datos del candidato (perfil, CVs, postulaciones) no se modifican."
            : "El usuario debera cambiar la contrasena en su primer ingreso."
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              loading={saving}
              onClick={save}
              disabled={!name || !email || (!editing && password.length < 8)}
            >
              {editing ? "Guardar" : "Crear"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          {!editing && (
            <Field label="Contrasena inicial" required hint="Minimo 8 caracteres">
              <Input
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rol" hint="El admin no puede buscar trabajo ni postularse">
              <Select
                value={role}
                onChange={(event) => setRole(event.target.value as "ADMIN" | "USER")}
              >
                <option value="USER">Usuario (candidato)</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            </Field>
            <div className="flex items-end gap-3 pb-2">
              <Toggle checked={active} onChange={setActive} label="Activo" />
              <span className="text-xs text-[var(--text-strong)]">
                {active ? "Usuario activo" : "Usuario desactivado"}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={resetFor !== null}
        onClose={() => setResetFor(null)}
        title="Resetear contrasena"
        description={`Se asignara una nueva contrasena a ${resetFor?.email ?? ""}.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setResetFor(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={doReset} disabled={resetPassword.length < 8}>
              Resetear
            </Button>
          </>
        }
      >
        <Field label="Nueva contrasena" required hint="Minimo 8 caracteres. Comuniquesela al usuario.">
          <Input value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
