import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.tsx";
import { Spinner } from "./components/primitives.tsx";
import { Layout } from "./components/Layout.tsx";
import { LoginPage } from "./pages/Login.tsx";
import { DashboardPage } from "./pages/Dashboard.tsx";
import { SearchPage } from "./pages/Search.tsx";
import { SavedJobsPage } from "./pages/SavedJobs.tsx";
import { AlertsPage, SavedSearchesPage } from "./pages/SavedSearches.tsx";
import { ApplicationsPage } from "./pages/Applications.tsx";
import { ResumesPage } from "./pages/Resumes.tsx";
import { ProfilePage } from "./pages/Profile.tsx";
import { PreferencesPage } from "./pages/Preferences.tsx";
import { AdminDashboardPage } from "./pages/admin/AdminDashboard.tsx";
import { AdminUsersPage } from "./pages/admin/AdminUsers.tsx";
import { AdminSourcesPage } from "./pages/admin/AdminSources.tsx";
import { AdminAiPage, AdminLogsPage, AdminSystemPage } from "./pages/admin/AdminSystem.tsx";

/**
 * Enrutado por rol.
 * El ADMIN administra la plataforma y no accede a las pantallas de candidato;
 * el USER no accede a /admin. El backend aplica la misma regla, aca solo se
 * evita mostrar pantallas que no corresponden.
 */
export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Cargando JobHunter AI..." />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={isAdmin ? "/admin" : "/"} replace />} />

      <Route element={<Layout />}>
        {isAdmin ? (
          <>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/usuarios" element={<AdminUsersPage />} />
            <Route path="/admin/conectores" element={<AdminSourcesPage />} />
            <Route path="/admin/ia" element={<AdminAiPage />} />
            <Route path="/admin/estado" element={<AdminSystemPage />} />
            <Route path="/admin/logs" element={<AdminLogsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/buscar" element={<SearchPage />} />
            <Route path="/ofertas" element={<SavedJobsPage />} />
            <Route path="/busquedas" element={<SavedSearchesPage />} />
            <Route path="/alertas" element={<AlertsPage />} />
            <Route path="/postulaciones" element={<ApplicationsPage />} />
            <Route path="/cv" element={<ResumesPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/preferencias" element={<PreferencesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Route>
    </Routes>
  );
}
