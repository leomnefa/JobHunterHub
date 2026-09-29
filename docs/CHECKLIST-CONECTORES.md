# Checklist de conectores

Qué falta para dejar operativa cada una de las 20 plataformas integradas.

Todo se carga desde **Panel de administración → Conectores**. Las credenciales
quedan cifradas en la base local y nunca se muestran en claro ni salen al
navegador.

**Estado de esta instalación al 29/09/2026:** 4 fuentes funcionando
(Himalayas, Jobicy, Remote OK, Remotive), 16 pendientes.

---

## Nivel 1 — Ya funcionan, sin nada que hacer

Son APIs públicas que no piden credenciales. Quedaron habilitadas desde la
instalación.

- [x] **Himalayas** — trabajos 100% remotos. Es la fuente más productiva.
- [x] **Jobicy** — hasta 200 ofertas por consulta.
- [x] **Remote OK** — feed completo, se filtra localmente.
- [ ] **Remotive** — ⚠️ está configurada pero **apagada**. Prendé el interruptor
      en Conectores y listo, no requiere nada más.

---

## Nivel 2 — Un dato público, cinco minutos cada una

Estos ATS publican las ofertas de cada empresa sin autenticación. Solo hay que
decirle a la aplicación **qué empresas te interesan**. Podés cargar todas las que
quieras, separadas por coma.

El dato sale de la URL del portal de empleos de la empresa.

- [ ] **Greenhouse** → campo `board_tokens`
      URL: `job-boards.greenhouse.io/`**`vercel`** → cargás `vercel`
- [ ] **Lever** → campo `sites`
      URL: `jobs.lever.co/`**`leverdemo`** → cargás `leverdemo`
- [ ] **Ashby** → campo `job_boards`
      URL: `jobs.ashbyhq.com/`**`ramp`** → cargás `ramp`
- [ ] **SmartRecruiters** → campo `companies`
      URL: `jobs.smartrecruiters.com/`**`empresa`**
- [ ] **Workable** → campo `accounts`
      URL: `apply.workable.com/`**`empresa`**`/`
- [ ] **Recruitee** → campo `companies`
      URL: **`empresa`**`.recruitee.com`
- [ ] **Personio** → campo `companies`
      URL: **`empresa`**`.jobs.personio.de`
- [ ] **Breezy HR** → campo `companies`
      URL: **`empresa`**`.breezy.hr`
- [ ] **BambooHR** → campo `companies`
      URL: **`empresa`**`.bamboohr.com/careers`
      ⚠️ BambooHR no documenta este listado: el mapeo es defensivo y puede
      necesitar ajuste según el tenant.
- [ ] **Workday** → campo `sites`, URL completa del portal
      Ejemplo: `https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite`
      ⚠️ El listado no trae la descripción completa: hay que abrir la oferta
      original para leerla entera.

**Cómo armar la lista.** Pensá en 20 o 30 empresas donde te gustaría trabajar,
entrá a su página de empleos y fijate en la URL: ahí te dice qué ATS usan y cuál
es el identificador. Esta es la vía con mejor relación esfuerzo/resultado de
toda la lista: son ofertas que muchas veces no llegan a los job boards.

---

## Nivel 3 — Requieren cuenta y credenciales

- [ ] **Adzuna** → `app_id` + `app_key`
      Registro gratuito en https://developer.adzuna.com/
      Opcional: `country` (código ISO de 2 letras, por defecto `gb`).
      Aporta mercados locales que los job boards remotos no cubren.

- [ ] **Teamtailor** → `companies` + `api_key` (obligatoria)
      La API key la emite cada empresa desde su cuenta. Sin ella no hay feed
      público, así que solo sirve si tenés acceso a una cuenta.

- [ ] **Upwork** → `access_token` OAuth 2.0
      Requiere una **aplicación aprobada por Upwork**. Trámite de días o semanas,
      no minutos. Opcionales: `refresh_token`, `client_id`, `client_secret`,
      `organization_uid`.

- [ ] **Freelancer.com** → `oauth_token`
      Se genera desde la cuenta de desarrollador. Opcional: `sandbox=true` para
      probar contra el entorno de pruebas.

---

## Nivel 4 — Bloqueadas, no dependen de vos

- [ ] **Jobgether** — no publica una API abierta documentada. El conector existe
      en el registro con estado `UNKNOWN` y **no ejecuta ninguna llamada**. Para
      habilitarlo habría que confirmar con la fuente si existe API y bajo qué
      condiciones. No se hace scraping.

- [ ] **Pinpoint** — la API exige API key emitida por cada cliente y no se
      encontró un feed público verificable. Requiere validar endpoints con una
      cuenta real antes de implementar.

---

## Credenciales adicionales para postular por API

Distinto de lo anterior: los campos de arriba habilitan **buscar**. Estos
habilitan **enviar la candidatura** desde la aplicación.

- [ ] **Greenhouse** → `api_key` (Job Board API key del cliente, Basic Auth)
- [ ] **Lever** → `api_key` (con permiso de creación de candidaturas)
- [ ] **Ashby** → `api_key` con permiso `candidatesWrite`
- [ ] **SmartRecruiters** → `access_token` OAuth con scope `candidate_applications_manage`

⚠️ **Estas keys las emite la empresa que publica la oferta, no vos.** Un
candidato particular normalmente no las tiene. Ver
[POSTULACION-AUTOMATICA.md](POSTULACION-AUTOMATICA.md) para entender qué implica.

---

## Inteligencia artificial

- [x] **Anthropic configurado** — proveedor activo con modelo `claude-sonnet-5`.
      Habilita análisis enriquecido, CV adaptado y redacción de cartas.

Alternativas en **Administración → Inteligencia artificial**: OpenAI, Ollama
(local, sin costo ni salida de datos) o solo heurístico.

Sin IA la plataforma funciona completa: el scoring determinista y los documentos
armados desde el perfil siguen disponibles.

---

## Orden sugerido

1. **Prendé Remotive** — 10 segundos, ya está configurada.
2. **Cargá 20 empresas en Greenhouse, Lever y Ashby** — es el mayor salto de
   cobertura por esfuerzo invertido, y son los tres ATS donde además se puede
   postular por API.
3. **Registrate en Adzuna** — 5 minutos, suma el mercado local argentino y
   español.
4. **Sumá el resto de los ATS** a medida que identifiques empresas.
5. Upwork y Freelancer solo si vas a trabajar por proyectos; el trámite es largo.

---

## Verificar que quedó bien

En **Administración → Estado del sistema**, el botón *Chequear estado* consulta
cada fuente en vivo y muestra:

- `ONLINE` con la latencia real — funcionando.
- `NOT_CONFIGURED` — falta cargar el dato.
- `OFFLINE` — la fuente no responde o el identificador es incorrecto.

En **Conectores**, el botón *Sincronizar* de cada tarjeta trae ofertas al
instante y te dice cuántas encontró.
