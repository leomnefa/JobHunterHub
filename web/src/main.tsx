import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.tsx";
import { AuthProvider } from "./lib/auth.tsx";
import { ThemeProvider, ToastProvider } from "./lib/ui.tsx";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) throw new Error("No se encontro el contenedor #root");

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
