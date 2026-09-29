# JobHunter AI

Plataforma local y multiusuario para **buscar, analizar y gestionar postulaciones
laborales** desde una sola aplicacion. Centraliza ofertas de job boards, ATS y
marketplaces freelance, las normaliza en un unico formato, las compara contra el
perfil profesional real de cada usuario y prepara la candidatura (CV adaptado,
carta y respuestas) lista para enviar.

Corre entera en una PC: base de datos local, credenciales cifradas y APIs
oficiales respetando sus terminos de uso.

---

## Instalacion rapida (Windows)

1. Instalar **Node.js 22.6 o superior** desde <https://nodejs.org> (recomendado: la ultima LTS).
2. Hacer doble clic en **`instalar.bat`**.
3. Anotar el usuario y la contrasena de administrador que muestra el instalador.
4. Hacer doble clic en **`iniciar.bat`**: se abre el navegador en <http://127.0.0.1:4100>.

### Instalacion por linea de comandos (cualquier sistema)

```bash
npm run setup     # verifica Node, crea .env, instala y compila la interfaz
npm start         # inicia la aplicacion en http://127.0.0.1:4100
```

### Dejarlo corriendo siempre (servicio de Windows)

Clic derecho en **`instalar-servicio.bat`** → **Ejecutar como administrador**.

Queda arrancando solo al encender el equipo, sin necesidad de iniciar sesión, y
se reintenta si el proceso se cae. Se administra con `servicio.bat`
(`status`, `start`, `stop`, `restart`, `logs`).

Detalle completo en [`docs/SERVICIO.md`](docs/SERVICIO.md).

### Desarrollo

```bash
npm run dev       # backend con recarga + Vite en http://127.0.0.1:5173
npm test          # pruebas del backend
```

---

## Primeros pasos

### 1. Entrar como administrador

Use el usuario que genero el instalador (`admin@jobhunter.local` por defecto) y
cambie la contrasena desde la aplicacion.

### 2. Habilitar fuentes (Conectores)

Cuatro fuentes publicas funcionan sin configuracion y quedan habilitadas desde el
primer arranque: **Himalayas, Jobicy, Remotive y Remote OK**.

El resto necesita datos del panel ADMIN:

| Fuente | Que hay que cargar |
| --- | --- |
| Adzuna | `app_id` y `app_key` de <https://developer.adzuna.com> |
| Greenhouse | board tokens de las empresas (`vercel`, `stripe`, ...) |
| Lever | sites de Lever (`leverdemo`, ...) |
| Ashby | job boards (`ramp`, ...) |
| SmartRecruiters | identificadores de empresa |
| Workable / Recruitee / BambooHR / Personio / Breezy | subdominio de cada empresa |
| Workday | URL completa del career site de cada empresa |
| Teamtailor | API key de la cuenta |
| Upwork / Freelancer | credenciales OAuth propias |

### 3. Crear usuarios

En **Usuarios** se crean las cuentas de candidato. Cada usuario tiene su propio
perfil, CVs, busquedas y postulaciones, completamente aislados del resto.

### 4. Cargar el perfil (como usuario)

El perfil es un archivo **Markdown** y es la **unica fuente de verdad**: de ahi
salen el analisis de compatibilidad, el CV adaptado, la carta y las respuestas de
los formularios.

Se puede subir un `.md`, escribirlo con la plantilla incluida o generarlo con IA
pegando informacion propia.

### 5. Buscar, analizar y postular

1. **Buscar trabajos** consulta en vivo todas las fuentes habilitadas.
2. Cada oferta muestra su compatibilidad con el perfil y las skills que coinciden y faltan.
3. **Preparar postulacion** genera CV adaptado, carta y respuestas del formulario.
4. Si la fuente lo permite y hay credenciales validas, la candidatura se envia por API;
   si no, la aplicacion deriva al formulario original y registra la postulacion igual.

---

## Que hace y que no hace

**Hace**

- Busca en 20 conectores (job boards, ATS, agregadores, freelance) con una sola consulta.
- Normaliza todas las ofertas a un modelo interno unico.
- Deduplica por `source + sourceJobId` y por similitud de empresa, titulo, ubicacion y descripcion.
- Calcula compatibilidad explicable: skills, experiencia, seniority, ubicacion, contrato, salario e idioma.
- Detecta riesgos concretos (autorizacion laboral, huso horario, presencialidad, idioma, salario bajo).
- Genera CV adaptado y carta de presentacion sin modificar el perfil original.
- Completa formularios con datos del perfil y respuestas guardadas.
- Registra cada postulacion con su historial de estados y evita duplicados.
- Ejecuta busquedas guardadas en segundo plano y genera alertas.

**No hace, a proposito**

- No inventa experiencia, empresas, tecnologias, titulos ni idiomas. Si un dato no
  esta en el perfil, responde `UNKNOWN` y pide intervencion del usuario.
- No saltea CAPTCHAs, MFA ni controles anti-bot.
- No hace scraping agresivo ni implementa endpoints no documentados.
- No redistribuye ofertas hacia terceros donde la fuente lo prohibe.
- No declara capacidades de postulacion que la fuente no soporte.

---

## Arquitectura

```
web/ (React + Vite)          →  interfaz: candidato y administrador
server/ (Node + TypeScript)  →  API, motor de busqueda, matching, postulaciones
  core/        modelo unico, normalizacion, deduplicacion, HTTP con rate limit
  connectors/  una carpeta por plataforma, todas implementan JobConnector
  services/    perfil, IA, matching, documentos, postulaciones, sync, auditoria
  routes/      API interna por dominio
data/                         →  SQLite local, credenciales cifradas, uploads
docs/integrations/            →  estado real de cada fuente integrada
```

Agregar una plataforma nueva es crear su archivo en `server/src/connectors/`,
implementar la interfaz `JobConnector` y registrarla. El nucleo no cambia.

Detalle completo en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

### Sin dependencias en el backend

El servidor no instala paquetes de terceros: Node 22.6+ ejecuta TypeScript de
forma nativa y `node:sqlite` provee la base de datos. Menos superficie de
ataque y una instalacion mas simple.

---

## Inteligencia artificial

La IA es **opcional**. Sin proveedor configurado la plataforma funciona completa
con el motor deterministico local (scoring explicable y documentos armados
reordenando el perfil real).

Proveedores soportados desde el panel ADMIN: **Anthropic**, **OpenAI**, **Ollama**
(local) o **solo heuristico**. Las API keys se guardan cifradas con AES-256-GCM y
nunca llegan al navegador.

---

## Seguridad

- Contrasenas con `scrypt`; sesiones con JWT HS256 firmado localmente.
- El backend determina el usuario desde el token: nunca confia en un `userId` del cliente.
- Aislamiento total entre usuarios en perfil, CVs, busquedas, matches y postulaciones.
- El ADMIN administra la plataforma y **no** puede operar como candidato.
- Credenciales de conectores cifradas en la base y enmascaradas en la interfaz.
- Limite de intentos de login por IP y auditoria de cada accion sensible.
- El servidor escucha solo en `127.0.0.1` por defecto.

---

## Configuracion (`.env`)

El instalador crea el archivo con claves generadas. Valores principales:

| Variable | Para que sirve |
| --- | --- |
| `PORT`, `HOST` | Donde escucha la aplicacion (por defecto `127.0.0.1:4100`) |
| `JWT_SECRET` | Firma de las sesiones (se genera sola) |
| `CREDENTIALS_KEY` | Clave maestra para cifrar credenciales de conectores |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Usuario administrador inicial |
| `AI_PROVIDER` | `heuristic`, `anthropic`, `openai` u `ollama` |
| `SYNC_INTERVAL_MINUTES` | Frecuencia del worker de sincronizacion (0 lo desactiva) |

Las credenciales de cada fuente pueden cargarse por `.env` o, mejor, desde el
panel ADMIN, donde quedan cifradas en la base local.

---

## Comandos

| Comando | Que hace |
| --- | --- |
| `npm run setup` | Instala y compila todo |
| `npm start` | Inicia la aplicacion |
| `npm run dev` | Backend con recarga + frontend con hot reload |
| `npm test` | Pruebas del backend |
| `npm run build:web` | Recompila solo la interfaz |
| `node scripts/generate-docs.mjs` | Regenera `docs/integrations/` desde el codigo |

---

## Documentación

| Documento | Para qué |
| --- | --- |
| [`docs/SERVICIO.md`](docs/SERVICIO.md) | Instalación como servicio, logs, backup, actualización |
| [`docs/CHECKLIST-CONECTORES.md`](docs/CHECKLIST-CONECTORES.md) | Qué falta para conectar cada una de las 20 plataformas |
| [`docs/POSTULACION-AUTOMATICA.md`](docs/POSTULACION-AUTOMATICA.md) | Qué se puede automatizar hoy y qué falta para el envío con un clic |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo está construida y cómo agregar fuentes |
| [`docs/integrations/`](docs/integrations/README.md) | Ficha técnica de cada fuente |

## Licencia y uso

Herramienta de productividad personal. Cada fuente tiene sus propios terminos:
las restricciones de atribucion y redistribucion estan documentadas por conector
en [`docs/integrations/`](docs/integrations/README.md) y visibles en el panel ADMIN.
