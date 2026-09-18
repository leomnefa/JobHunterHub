# PROYECTO: MOTOR UNIFICADO DE BÚSQUEDA Y POSTULACIÓN LABORAL

## CONTEXTO

Estoy desarrollando una plataforma propia para buscar oportunidades laborales de manera centralizada.

La plataforma debe permitir:

1. Buscar trabajos remotos.
2. Buscar trabajos freelance.
3. Buscar trabajos por proyecto.
4. Buscar trabajos full-time.
5. Buscar trabajos part-time.
6. Buscar contratos.
7. Buscar oportunidades internacionales.
8. Buscar oportunidades compatibles con Argentina / LATAM.
9. Centralizar ofertas provenientes de múltiples plataformas.
10. Normalizar las ofertas en un único formato.
11. Analizar automáticamente cada oferta mediante IA.
12. Determinar el nivel de compatibilidad entre mi perfil y cada oferta.
13. Generar o seleccionar automáticamente el CV adecuado.
14. Generar una carta de presentación cuando corresponda.
15. Responder preguntas de postulaciones utilizando información previamente almacenada.
16. Automatizar la postulación cuando la plataforma lo permita legal y técnicamente.
17. Asistir al usuario cuando la postulación no pueda automatizarse.
18. Registrar cada postulación.
19. Hacer seguimiento del estado de cada candidatura.
20. Evitar postulaciones duplicadas.
21. Priorizar oportunidades relevantes.
22. Mantener un historial completo.

---

# REGLA PRINCIPAL

NO quiero crear simplemente un buscador de trabajos.

Quiero construir un:

> **AGENTE / PLATAFORMA CENTRALIZADA DE BÚSQUEDA, ANÁLISIS Y POSTULACIÓN LABORAL.**

La arquitectura debe estar preparada para incorporar nuevas fuentes y nuevas plataformas sin modificar todo el sistema.

Cada plataforma debe implementarse mediante un sistema de **connectors/adapters/plugins**.

Ejemplo conceptual:

```text
                    ┌─────────────────────┐
                    │   MI PLATAFORMA     │
                    │                     │
                    │ Job Search Engine   │
                    │ AI Matching         │
                    │ Application Engine  │
                    │ Tracking            │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
           JOB SOURCES    ATS SOURCES   FREELANCE
                 │             │             │
          ┌──────┴──────┐ ┌────┴────┐ ┌────┴────┐
          │             │ │         │ │         │
       Himalayas      Greenhouse  Upwork   Freelancer
       Jobicy         Lever       etc.      etc.
       Remote OK      Ashby
       Adzuna         SmartRecruiters
       Remotive       Workable
       Jobgether      Workday
                     Recruitee
                     BambooHR
                     Personio
                     Teamtailor
                     Breezy
                     Pinpoint
```

---

# OBJETIVO

Quiero que analices el proyecto existente antes de realizar modificaciones.

NO reemplaces arquitectura existente sin necesidad.

NO reconstruyas la aplicación desde cero.

Primero:

1. Inspeccioná el proyecto.
2. Identificá stack tecnológico.
3. Identificá arquitectura actual.
4. Identificá base de datos.
5. Identificá backend.
6. Identificá frontend.
7. Identificá autenticación.
8. Identificá modelos existentes.
9. Identificá servicios existentes.
10. Identificá cualquier integración ya implementada.
11. Identificá qué partes pueden reutilizarse.
12. Identificá problemas técnicos.
13. Identificá qué debe agregarse.

Después diseñá la integración respetando la arquitectura existente.

---

# FUENTES DE TRABAJO A INTEGRAR

La plataforma debe estar preparada para integrar, como mínimo, las siguientes fuentes.

## PRIORIDAD 1 — FREELANCE / MARKETPLACES

### 1. Upwork

Debe investigarse e integrarse mediante sus APIs oficiales cuando sea posible.

Objetivos:

* Buscar proyectos.
* Obtener información del proyecto.
* Obtener presupuesto.
* Obtener skills.
* Obtener cliente.
* Obtener modalidad.
* Obtener ubicación/restricciones.
* Obtener duración.
* Obtener propuestas cuando la API/autorización lo permita.
* Preparar/enviar proposals cuando la API y permisos lo permitan.
* Registrar la propuesta enviada.
* Registrar estado.

No asumir que todas las funcionalidades están disponibles sin autenticación.

Implementar OAuth/API credentials de manera segura.

---

### 2. Freelancer

Investigar e integrar API oficial.

Objetivos:

* Buscar proyectos.
* Obtener descripción.
* Presupuesto.
* Skills.
* Duración.
* Cliente.
* Estado.
* Bids/propuestas.
* Postulación cuando la API lo permita.
* Seguimiento.

---

# PRIORIDAD 1 — JOB BOARDS CON API

## 3. Himalayas

API pública.

Documentación oficial:

https://himalayas.app/api

Actualmente dispone de:

```text
GET /jobs/api
GET /jobs/api/search
```

No requiere autenticación para búsqueda pública.

Debe soportar:

* búsqueda general
* keywords
* país
* worldwide
* seniority
* employment type
* company
* timezone
* orden
* paginación

Usar cursor cuando corresponda.

NO asumir que los cursores son calculables manualmente.

La API tiene límite actual de hasta 20 trabajos por request.

La plataforma debe respetar rate limits.

Debe conservarse:

```text
source = "himalayas"
sourceJobId
sourceUrl
```

Cuando se muestre información proveniente de Himalayas debe respetarse su requisito de atribución.

IMPORTANTE:

Himalayas prohíbe utilizar sus trabajos para enviarlos a determinados terceros como Google Jobs, LinkedIn Jobs, Jooble, etc.

No realizar esa distribución.

---

## 4. Jobicy

API pública:

```text
GET https://jobicy.com/api/v2/remote-jobs
```

Actualmente no requiere API key.

Puede devolver hasta 200 trabajos según documentación actual.

Integrar:

* jobs
* company
* title
* description
* location
* job type
* salary
* industry
* geo
* URL
* fecha
* skills cuando estén disponibles

Soportar filtros.

Respetar fair-use y condiciones de la fuente.

---

## 5. Remote OK

Investigar API/feed oficial.

Integrar:

* trabajos remotos
* categorías
* tags
* empresa
* título
* descripción
* ubicación
* salario
* URL
* fecha
* tags

No hacer scraping si existe una API/feed oficial utilizable.

---

## 6. Adzuna

API oficial:

https://developer.adzuna.com/

Requiere:

```text
app_id
app_key
```

Debe integrarse mediante configuración segura.

No almacenar credenciales en código.

Debe soportar:

* búsqueda
* ubicación
* keywords
* categorías
* salario
* empresa
* estadísticas cuando sean útiles

Adzuna dispone de API REST y múltiples endpoints para anuncios y datos laborales.

---

## 7. Jobgether

Investigar e integrar su API pública/documentada.

Objetivos:

* búsqueda
* filtros
* ubicación
* industria
* experiencia
* contrato
* remote
* salario
* compatibilidad

---

## 8. Remotive

Integrar API/feed oficial si las condiciones actuales permiten utilizarla.

IMPORTANTE:

Respetar sus condiciones de uso y atribución.

No redistribuir los datos hacia plataformas donde esté expresamente prohibido.

---

# PRIORIDAD 1 — ATS

Esta es una parte FUNDAMENTAL del sistema.

No limitar la plataforma a job boards.

Miles de empresas publican directamente mediante ATS.

La aplicación debe poder descubrir y consultar ofertas directamente desde ATS.

---

# 9. GREENHOUSE

API oficial:

https://docs.greenhouse.io/job-board.html

Debe implementarse:

```text
GET /v1/boards/{board_token}/jobs
GET /v1/boards/{board_token}/jobs/{job_id}
```

Cuando sea posible:

```text
POST /v1/boards/{board_token}/jobs/{id}
```

El endpoint GET público no requiere autenticación.

La presentación de aplicaciones requiere autenticación/API key.

La aplicación debe poder:

1. Obtener puestos.
2. Obtener descripción.
3. Obtener preguntas.
4. Detectar campos obligatorios.
5. Construir dinámicamente el formulario.
6. Preparar respuestas.
7. Adjuntar CV.
8. Adjuntar cover letter cuando corresponda.
9. Enviar candidatura cuando exista autorización válida.
10. Registrar resultado.

IMPORTANTE:

Nunca exponer API keys en frontend.

Toda operación sensible debe pasar por backend.

Greenhouse indica expresamente que la submission requiere Basic Auth y que las aplicaciones pueden enviarse mediante multipart form-data.

---

# 10. LEVER

API:

https://github.com/lever/postings-api

Debe soportar:

```text
GET /v0/postings/{site}
GET /v0/postings/{site}/{posting-id}
POST /v0/postings/{site}/{posting-id}?key={APIKEY}
```

Objetivos:

* Obtener trabajos.
* Obtener detalles.
* Obtener campos.
* Construir candidatura.
* Enviar candidatura cuando exista API key/permisos.
* Adjuntar CV.
* Registrar respuesta.

IMPORTANTE:

La creación de aplicaciones puede estar limitada por rate limiting.

Implementar:

```text
HTTP 429
retry
exponential backoff
logging
```

No realizar loops agresivos.

---

# 11. ASHBY

Investigar y utilizar APIs oficiales.

Debe soportar:

* obtener job postings
* obtener información del puesto
* obtener application form
* obtener campos
* detectar campos requeridos
* generar respuestas
* enviar aplicación cuando la autorización/permisos estén disponibles

Existe:

```text
applicationForm.submit
```

que permite enviar un formulario completo de aplicación.

La API requiere permisos apropiados, incluyendo:

```text
candidatesWrite
```

No asumir que una API pública de lectura permite automáticamente enviar candidaturas.

---

# 12. SMARTRECRUITERS

Utilizar Application API cuando corresponda.

Debe soportar:

```text
GET /postings/:uuid/configuration
```

para obtener:

* screening questions
* diversity questions
* privacy policies

Y posteriormente crear la aplicación.

La API utiliza autenticación y OAuth 2.0.

Cuando corresponda:

```text
candidate_applications_manage
```

Debe implementarse:

* OAuth
* token management
* refresh
* secure storage
* application submission
* status tracking

---

# 13. WORKABLE

Investigar API oficial y feeds de jobs.

Debe soportar:

* jobs
* company
* description
* location
* requirements
* application URL
* application flow

Implementar aplicación directa únicamente si existe endpoint/API oficialmente autorizado.

---

# 14. WORKDAY

Workday es especialmente importante porque muchas empresas grandes utilizan esta plataforma.

NO asumir que existe una API universal pública de aplicación.

La integración debe ser por empresa/tenant cuando corresponda.

Debe poder:

* detectar Workday
* descubrir career site
* obtener jobs cuando exista endpoint público
* normalizar jobs
* detectar URL de aplicación
* utilizar browser-assisted application si no existe API de submission

No realizar scraping agresivo.

---

# 15. RECRUITEE

Investigar API pública/feeds oficiales.

Soportar:

* ofertas
* empresa
* ubicación
* descripción
* requisitos
* URL
* application form cuando esté disponible

---

# 16. BAMBOOHR

Investigar API/career feeds oficiales.

Soportar:

* jobs
* ubicación
* descripción
* departamento
* employment type
* application URL

---

# 17. PERSONIO

Investigar career/API/feed.

Soportar:

* jobs
* company
* location
* description
* employment type
* URL
* application data cuando esté disponible.

---

# 18. TEAMTAILOR

Investigar API pública/career pages.

Soportar:

* jobs
* company
* location
* description
* requirements
* application URL.

---

# 19. BREEZY HR

Investigar feeds/API.

Soportar:

* jobs
* company
* location
* description
* requirements
* application URL.

---

# 20. PINPOINT

Investigar endpoints públicos/API.

Soportar:

* jobs
* company
* location
* description
* application URL.

---

# ARQUITECTURA DE CONNECTORS

No crear lógica específica de cada plataforma directamente dentro del servicio principal.

Crear una interfaz:

```typescript
interface JobConnector {
    getName(): string;

    getCapabilities(): ConnectorCapabilities;

    searchJobs(
        params: JobSearchParams
    ): Promise<JobSearchResult>;

    getJob(
        externalJobId: string
    ): Promise<NormalizedJob>;

    getApplicationForm?(
        externalJobId: string
    ): Promise<ApplicationForm>;

    submitApplication?(
        externalJobId: string,
        application: ApplicationPayload
    ): Promise<ApplicationResult>;

    getApplicationStatus?(
        externalApplicationId: string
    ): Promise<ApplicationStatus>;

    healthCheck(): Promise<ConnectorHealth>;
}
```

---

# CAPACIDADES

Cada connector debe declarar explícitamente sus capacidades.

Ejemplo:

```typescript
interface ConnectorCapabilities {
    search: boolean;
    jobDetails: boolean;
    applicationForm: boolean;
    apply: boolean;
    applicationStatus: boolean;
    oauth: boolean;
    apiKey: boolean;
    browserAutomationRequired: boolean;
    resumeUpload: boolean;
    coverLetterUpload: boolean;
    customQuestions: boolean;
}
```

Esto permitirá que el motor sepa automáticamente qué puede hacer.

Ejemplo:

```text
GREENHOUSE

search = true
jobDetails = true
applicationForm = true
apply = true*
resumeUpload = true
customQuestions = true
browserAutomationRequired = false

* requiere credenciales/permisos válidos
```

---

# NORMALIZACIÓN

Todas las fuentes deben convertirse al modelo interno:

```typescript
interface NormalizedJob {
    id: string;

    source: string;

    sourceJobId: string;

    sourceUrl: string;

    title: string;

    company: {
        name: string;
        website?: string;
        logoUrl?: string;
    };

    description: string;

    location?: string;

    country?: string;

    remoteType:
        | "remote"
        | "hybrid"
        | "onsite"
        | "unknown";

    worldwide?: boolean;

    employmentType?:
        | "full_time"
        | "part_time"
        | "contract"
        | "freelance"
        | "temporary"
        | "internship"
        | "unknown";

    seniority?:
        | "intern"
        | "junior"
        | "mid"
        | "senior"
        | "lead"
        | "manager"
        | "director"
        | "executive"
        | "unknown";

    salary?: {
        min?: number;
        max?: number;
        currency?: string;
        period?: string;
    };

    skills: string[];

    categories: string[];

    publishedAt?: Date;

    expiresAt?: Date;

    applicationUrl?: string;

    applicationMethod:
        | "api"
        | "browser"
        | "external"
        | "email"
        | "unknown";

    connectorCapabilities: ConnectorCapabilities;

    rawData?: unknown;
}
```

---

# DEDUPLICACIÓN

Una misma oferta puede aparecer en:

* Adzuna
* Jobicy
* Remote OK
* agregadores
* ATS
* otros feeds

No mostrar duplicados.

Crear sistema de deduplicación mediante:

```text
source + sourceJobId
```

y adicionalmente:

```text
normalized company
+
normalized title
+
location
+
similarity(description)
```

Cuando dos ofertas parezcan ser la misma:

```text
duplicateCandidate = true
```

y ejecutar algoritmo de similitud.

No eliminar automáticamente cuando la confianza sea baja.

---

# PERFIL DEL CANDIDATO

Crear un perfil centralizado.

Debe almacenar:

```text
CandidateProfile
```

con:

* nombre
* email
* teléfono
* ubicación
* país
* LinkedIn
* GitHub
* portfolio
* CV principal
* CVs alternativos
* experiencia
* empresas
* cargos
* tecnologías
* skills
* idiomas
* educación
* certificaciones
* disponibilidad
* modalidad preferida
* salario esperado
* tipos de contrato
* países permitidos
* zonas horarias
* respuestas frecuentes
* preguntas frecuentes de aplicaciones

---

# CV MANAGEMENT

Permitir múltiples CV.

Ejemplo:

```text
CV Senior Data Engineer
CV Qlik / BI
CV Software Engineer
CV AI / Data
CV General
```

La IA debe poder seleccionar el CV más adecuado según la oferta.

Nunca inventar experiencia.

Nunca inventar certificaciones.

Nunca inventar tecnologías.

Nunca inventar empresas.

---

# MOTOR DE MATCHING

Crear un servicio:

```text
JobMatchingService
```

Entrada:

```text
CandidateProfile
+
NormalizedJob
```

Salida:

```typescript
interface JobMatch {
    jobId: string;

    compatibilityScore: number;

    skillsMatch: number;

    experienceMatch: number;

    locationMatch: number;

    salaryMatch: number;

    seniorityMatch: number;

    contractMatch: number;

    languageMatch: number;

    aiAnalysis: string;

    missingSkills: string[];

    matchedSkills: string[];

    risks: string[];

    recommendation:
        | "apply"
        | "review"
        | "ignore";
}
```

El score es una herramienta interna de matching, NO una decisión irreversible.

Debe poder explicarse por qué una oferta obtuvo determinado resultado.

---

# IA PARA CADA OFERTA

La IA debe analizar:

```text
JOB DESCRIPTION
       +
CANDIDATE PROFILE
       +
CV
       ↓
LLM
       ↓
MATCH ANALYSIS
```

Debe identificar:

### Coincidencias

```text
SQL Server
Qlik
Data Engineering
ETL
Python
AI
APIs
```

### Faltantes

```text
AWS
Kafka
Spark
etc.
```

### Riesgos

```text
US timezone required
US work authorization required
salary below preference
English requirement
onsite requirement
```

### Resultado

```text
APPLY
REVIEW
IGNORE
```

No inventar información faltante.

---

# GENERACIÓN DE POSTULACIONES

Crear:

```text
ApplicationService
```

Flujo:

```text
JOB
 ↓
MATCH
 ↓
SELECT CV
 ↓
GENERATE COVER LETTER
 ↓
LOAD APPLICATION FORM
 ↓
MAP QUESTIONS
 ↓
GENERATE ANSWERS
 ↓
VALIDATE
 ↓
SUBMIT
```

---

# SISTEMA DE RESPUESTAS

Crear una base:

```text
CandidateAnswers
```

Ejemplos:

```text
Years of experience
Current location
Salary expectation
Availability
Work authorization
English level
Relocation
Remote experience
Management experience
Technical skills
```

La IA puede generar una respuesta basándose en información previamente validada.

IMPORTANTE:

No permitir que la IA invente respuestas.

Si no existe información:

```text
UNKNOWN
```

y solicitar intervención del usuario.

---

# NIVEL DE AUTOMATIZACIÓN

Implementar tres niveles:

## LEVEL 1 — DISCOVERY

Solo:

```text
buscar
normalizar
guardar
```

## LEVEL 2 — ASSISTED APPLICATION

La plataforma prepara:

```text
CV
cover letter
answers
form
```

y el usuario confirma.

## LEVEL 3 — AUTOMATED APPLICATION

Cuando exista:

* API oficial
* autenticación válida
* permiso
* endpoint de aplicación

la plataforma puede enviar automáticamente.

Nunca intentar saltar:

* CAPTCHA
* MFA
* anti-bot
* controles de seguridad
* restricciones de plataforma
* términos de servicio.

Si se requiere interacción humana:

```text
REQUIRES_USER_ACTION
```

---

# BROWSER AUTOMATION

Para plataformas sin API de aplicación:

NO implementar scraping indiscriminado.

Crear:

```text
BrowserApplicationConnector
```

que pueda:

1. abrir URL
2. detectar formulario
3. completar campos
4. cargar CV
5. cargar cover letter
6. completar preguntas conocidas
7. detenerse ante CAPTCHA/MFA
8. pedir intervención humana
9. continuar después de la intervención
10. registrar resultado

La automatización debe utilizarse solamente cuando sea compatible con las reglas de la plataforma.

---

# APPLICATION STATE MACHINE

Cada postulación debe tener estado:

```text
DISCOVERED
MATCHED
READY_TO_APPLY
WAITING_USER_CONFIRMATION
APPLYING
SUBMITTED
FAILED
REQUIRES_USER_ACTION
WITHDRAWN
REJECTED
INTERVIEW
OFFER
HIRED
```

---

# DATABASE

Crear modelos equivalentes a:

```text
JobSource
Job
Company
CandidateProfile
CandidateResume
CandidateSkill
CandidateAnswer
JobMatch
Application
ApplicationQuestion
ApplicationAnswer
ApplicationDocument
ApplicationEvent
ConnectorCredential
ConnectorExecution
SearchQuery
SavedSearch
```

---

# APPLICATION

Modelo:

```typescript
interface Application {
    id: string;

    jobId: string;

    source: string;

    externalApplicationId?: string;

    status: ApplicationStatus;

    resumeId: string;

    coverLetterId?: string;

    submittedAt?: Date;

    lastStatusUpdate?: Date;

    errorMessage?: string;

    metadata?: unknown;
}
```

---

# CREDENCIALES

TODAS las credenciales deben estar protegidas.

Nunca:

```text
API KEY
CLIENT SECRET
ACCESS TOKEN
REFRESH TOKEN
```

en:

```text
frontend
Git
logs
console
database plaintext
```

Usar:

```text
environment variables
secret manager
encrypted database storage
```

cuando corresponda.

---

# RATE LIMITING

Cada connector debe tener:

```text
rateLimit
requestsPerMinute
requestsPerHour
retryPolicy
backoff
```

Implementar:

```text
429
Retry-After
exponential backoff
jitter
```

No realizar scraping agresivo.

---

# CACHE

No consultar continuamente la misma fuente.

Crear cache:

```text
JobCache
```

con:

```text
source
endpoint
parameters
response
fetchedAt
expiresAt
```

---

# JOB SYNC

Crear scheduler:

```text
JobSyncWorker
```

Ejemplo:

```text
Himalayas       cada X minutos
Jobicy          cada X minutos
Remote OK       según feed/API
Adzuna          según límites
ATS             según configuración
```

No hardcodear intervalos sin verificar rate limits.

---

# OBSERVABILITY

Registrar:

```text
connector
endpoint
duration
statusCode
jobsReceived
jobsInserted
jobsUpdated
jobsDuplicated
jobsRejected
errors
rateLimitHits
```

Dashboard:

```text
Connector Health
```

Ejemplo:

```text
Himalayas       ONLINE
Jobicy          ONLINE
Adzuna          ONLINE
Greenhouse      ONLINE
Lever           ONLINE
Ashby           ONLINE
SmartRecruiters ONLINE
```

---

# ERROR HANDLING

Cada connector debe aislar sus errores.

Si:

```text
Adzuna falla
```

NO debe caer:

```text
Himalayas
Jobicy
Greenhouse
Lever
```

Usar arquitectura independiente.

---

# PLUGIN ARCHITECTURE

Cada integración debe vivir en:

```text
/connectors
```

Ejemplo:

```text
/connectors
    /upwork
    /freelancer
    /himalayas
    /jobicy
    /remote-ok
    /adzuna
    /jobgether
    /remotive
    /greenhouse
    /lever
    /ashby
    /smartrecruiters
    /workable
    /workday
    /recruitee
    /bamboohr
    /personio
    /teamtailor
    /breezy
    /pinpoint
```

Cada connector:

```text
client
mapper
normalizer
auth
rate-limit
application
tests
```

cuando corresponda.

---

# CONNECTOR REGISTRY

Crear:

```typescript
ConnectorRegistry
```

Ejemplo:

```typescript
registry.register(
    new HimalayasConnector()
);

registry.register(
    new JobicyConnector()
);

registry.register(
    new GreenhouseConnector()
);
```

Después:

```typescript
connectorRegistry
    .get("greenhouse")
    .searchJobs(...)
```

---

# CONFIGURACIÓN

No hardcodear credenciales.

Ejemplo:

```env
UPWORK_CLIENT_ID=
UPWORK_CLIENT_SECRET=

FREELANCER_CLIENT_ID=
FREELANCER_CLIENT_SECRET=

ADZUNA_APP_ID=
ADZUNA_APP_KEY=

GREENHOUSE_API_KEY=
LEVER_API_KEY=
SMARTRECRUITERS_CLIENT_ID=
SMARTRECRUITERS_CLIENT_SECRET=
```

Solo agregar variables correspondientes a integraciones realmente utilizadas.

---

# API INTERNA

Crear endpoints internos equivalentes a:

```text
GET /api/jobs
GET /api/jobs/:id
POST /api/jobs/search

GET /api/sources
GET /api/sources/:source

POST /api/sources/:source/sync

POST /api/jobs/:id/analyze

GET /api/jobs/:id/match

POST /api/jobs/:id/prepare-application

POST /api/jobs/:id/apply

GET /api/applications
GET /api/applications/:id

POST /api/applications/:id/retry
POST /api/applications/:id/cancel
```

---

# DASHBOARD

El frontend debe mostrar:

```text
┌─────────────────────────────────────────┐
│ JOB SEARCH                              │
├─────────────────────────────────────────┤
│ Keyword: Senior Data Engineer           │
│ Remote: Worldwide                       │
│ Salary: > X                             │
│                                         │
│ [ SEARCH ]                              │
└─────────────────────────────────────────┘
```

Resultados:

```text
Senior Data Engineer
Company XYZ
Remote - Worldwide

Skills:
SQL
Python
ETL
Azure

Match: 94%

Source:
Greenhouse

[ ANALYZE ]
[ APPLY ]
```

---

# APPLICATION CENTER

Criar tela:

```text
APPLICATIONS
```

com:

```text
Company
Position
Source
Date
CV
Status
Match
Last Update
```

Filtros:

```text
Submitted
Interview
Rejected
Waiting
Requires Action
Failed
```

---

# SAVED SEARCHES

Permitir:

```text
Senior Data Engineer
Qlik Developer
Data Engineer
BI Developer
SQL Server DBA
AI Engineer
Software Engineer
```

Cada búsqueda puede tener:

```text
keywords
countries
remote
salary
seniority
employment type
skills
excluded keywords
```

---

# ALERTAS

Crear sistema de alertas.

Ejemplo:

```text
Nueva oferta compatible

Senior Data Engineer
Empresa XYZ

Match: 93%

Remote: Worldwide
Salary: USD 70k-90k

[VIEW]
```

---

# IA COMO AGENTE

La arquitectura debe quedar preparada para que posteriormente la plataforma tenga un agente:

```text
JOB SEARCH AGENT
```

El agente puede:

1. buscar ofertas
2. analizar
3. filtrar
4. priorizar
5. seleccionar CV
6. preparar candidatura
7. pedir aprobación
8. postular
9. registrar resultado
10. hacer seguimiento

---

# MCP

Investigar la posibilidad de incorporar MCP.

Himalayas actualmente ofrece MCP para búsqueda de trabajos y otras funcionalidades relacionadas con candidatos.

La arquitectura propia también debe poder exponer herramientas MCP posteriormente.

Ejemplo:

```text
search_jobs
get_job
analyze_job
match_candidate
prepare_application
submit_application
get_application_status
```

---

# SEGURIDAD

Implementar:

* OAuth cuando corresponda.
* encrypted credentials.
* HTTPS.
* CSRF protection.
* rate limiting.
* audit log.
* secure file upload.
* antivirus/file validation.
* access control.
* session security.
* secret management.
* no secrets in frontend.
* no secrets in Git.
* no sensitive information in logs.

---

# AUDIT LOG

Registrar:

```text
USER
ACTION
SOURCE
JOB
TIMESTAMP
RESULT
```

Ejemplo:

```text
2026-09-17
USER
APPLY
GREENHOUSE
JOB 12345
SUCCESS
```

---

# REQUISITO FUNDAMENTAL DE TRAZABILIDAD

Para cada oferta conservar:

```text
source
sourceJobId
sourceUrl
retrievedAt
rawData
normalizedData
```

Para cada candidatura:

```text
applicationId
jobId
source
externalApplicationId
timestamp
status
documents
answers
events
```

---

# POLÍTICAS DE INTEGRACIÓN

La plataforma debe:

* priorizar APIs oficiales.
* respetar términos de uso.
* respetar robots/rate limits cuando correspondan.
* respetar atribución.
* respetar restricciones de redistribución.
* no saltarse CAPTCHAs.
* no saltarse MFA.
* no evadir controles anti-bot.
* no realizar ataques ni abuso de APIs.
* no crear cuentas masivas.
* no realizar spam.
* no enviar postulaciones indiscriminadas.

El objetivo es construir una herramienta legítima de productividad laboral.

---

# DESCUBRIMIENTO AUTOMÁTICO DE ATS

Una función avanzada debe permitir identificar qué ATS utiliza una empresa.

Por ejemplo:

```text
empresa.com/careers
```

Detectar:

```text
Greenhouse
Lever
Ashby
Workday
SmartRecruiters
Workable
Recruitee
BambooHR
Personio
Teamtailor
Breezy
Pinpoint
```

Si se detecta un ATS conocido:

```text
ATS Detector
      ↓
ATS Connector
      ↓
Jobs
```

Esto permitirá ampliar masivamente la cobertura sin depender únicamente de job boards.

---

# PRIORIDADES DE IMPLEMENTACIÓN

## FASE 1

Implementar:

```text
Core Job Model
Connector Interface
Connector Registry
Job normalization
Deduplication
Job search
Candidate profile
Database
```

## FASE 2

Implementar:

```text
Himalayas
Jobicy
Remote OK
Adzuna
Jobgether
Remotive
```

## FASE 3

Implementar:

```text
Greenhouse
Lever
Ashby
SmartRecruiters
```

## FASE 4

Implementar:

```text
Workable
Workday
Recruitee
BambooHR
Personio
Teamtailor
Breezy
Pinpoint
```

## FASE 5

Implementar:

```text
Upwork
Freelancer
```

con autenticación y funcionalidades de marketplace.

## FASE 6

Implementar:

```text
AI Matching
CV Selection
Cover Letter
Question Answering
Application Preparation
```

## FASE 7

Implementar:

```text
API Application Submission
```

## FASE 8

Implementar:

```text
Browser-assisted applications
```

solo cuando sea necesario y permitido.

## FASE 9

Implementar:

```text
AI Agent
MCP
Automated workflows
Application tracking
Alerts
```

---

# CRITERIO DE ÉXITO

No considerar terminada una integración simplemente porque:

```text
GET /jobs
```

funciona.

Cada connector debe documentar:

```text
SEARCH
DETAIL
AUTH
APPLICATION FORM
APPLY
STATUS
RATE LIMIT
ERRORS
CAPABILITIES
TERMS
```

Ejemplo:

```text
GREENHOUSE

Search:              YES
Details:             YES
Questions:           YES
Apply:               YES*
Status:              LIMITED/DEPENDS
Authentication:      API KEY
Resume upload:       YES
Cover letter:        YES
Browser required:    NO

* requiere credenciales/permisos apropiados
```

---

# INVESTIGACIÓN AUTOMÁTICA

Antes de implementar cada connector:

1. Consultar documentación oficial actual.
2. Confirmar endpoints actuales.
3. Confirmar autenticación.
4. Confirmar rate limits.
5. Confirmar condiciones de uso.
6. Confirmar si se permite application submission.
7. Confirmar formato de CV.
8. Confirmar preguntas.
9. Confirmar estados.
10. Confirmar cambios recientes de API.

NO confiar exclusivamente en blogs, StackOverflow o código antiguo.

Preferir:

```text
official documentation
official GitHub repositories
official developer portals
official API specifications
```

---

# REQUISITO PARA CLAUDE

Antes de escribir código:

### PASO 1

Analizar completamente el proyecto existente.

### PASO 2

Crear un informe:

```text
CURRENT ARCHITECTURE
CURRENT FEATURES
CURRENT DATABASE
CURRENT API
CURRENT FRONTEND
CURRENT AUTH
CURRENT INTEGRATIONS
CURRENT PROBLEMS
```

### PASO 3

Crear:

```text
PROPOSED ARCHITECTURE
```

### PASO 4

Mostrar qué archivos se modificarán.

### PASO 5

Mostrar qué archivos nuevos serán necesarios.

### PASO 6

Implementar incrementalmente.

NO destruir funcionalidades existentes.

---

# PRINCIPIO ARQUITECTÓNICO

La plataforma debe poder pasar de:

```text
20 connectors
```

a:

```text
50
```

y eventualmente:

```text
100+
```

sin que el core tenga que modificarse sustancialmente.

Agregar una nueva plataforma debería consistir aproximadamente en:

```text
crear connector
+
implementar interface
+
mapper
+
auth
+
tests
+
registrar connector
```

y NO modificar todo el sistema.

---

# OBJETIVO FINAL

La visión final es:

```text
                 ┌─────────────────────────────┐
                 │       CANDIDATE PROFILE     │
                 └──────────────┬──────────────┘
                                │
                                ▼
                     ┌────────────────────┐
                     │    AI JOB AGENT    │
                     └─────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
           SEARCH           ANALYZE          MATCH
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                       SELECT OPPORTUNITY
                               │
                               ▼
                         SELECT CV
                               │
                               ▼
                     GENERATE APPLICATION
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
               API APPLY             BROWSER APPLY
                    │                     │
                    └──────────┬──────────┘
                               ▼
                       APPLICATION TRACKER
                               │
                               ▼
                           FOLLOW-UP
```

La aplicación debe terminar convirtiéndose en un **sistema central de búsqueda y gestión de oportunidades laborales**, donde el usuario no tenga que visitar manualmente decenas de sitios para descubrir y gestionar oportunidades.

---

# IMPORTANTE

No implementes funcionalidades ficticias.

Si una plataforma:

```text
permite búsqueda pero no aplicación
```

marcar:

```text
SEARCH_ONLY
```

Si:

```text
permite aplicación mediante API
```

marcar:

```text
API_APPLICATION
```

Si:

```text
requiere navegador
```

marcar:

```text
BROWSER_APPLICATION
```

Si:

```text
requiere intervención humana
```

marcar:

```text
HUMAN_REQUIRED
```

Si no se sabe:

```text
UNKNOWN
```

Nunca asumir que una API permite una operación que no está documentada.

---

# ENTREGABLES

Quiero que Claude entregue y mantenga:

```text
/docs/integrations/
```

con:

```text
upwork.md
freelancer.md
himalayas.md
jobicy.md
remote-ok.md
adzuna.md
jobgether.md
remotive.md
greenhouse.md
lever.md
ashby.md
smartrecruiters.md
workable.md
workday.md
recruitee.md
bamboohr.md
personio.md
teamtailor.md
breezy.md
pinpoint.md
```

Cada documento debe incluir:

```text
Overview
Official Documentation
Authentication
Endpoints
Search
Job Detail
Application
Application Questions
Application Status
Rate Limits
Errors
Capabilities
Terms/Restrictions
Implementation Status
Tests
```

---

# RESULTADO ESPERADO

No quiero solamente documentación.

Quiero que esta especificación se convierta progresivamente en código funcional dentro del proyecto existente.

Primero analizar.

Después diseñar.

Después implementar.

Después probar.

Después integrar.

Después documentar.

Y finalmente dejar la plataforma preparada para incorporar nuevas fuentes de trabajo sin modificar el núcleo.

**NO REESCRIBIR EL PROYECTO EXISTENTE SIN JUSTIFICACIÓN.**

**NO ELIMINAR FUNCIONALIDADES EXISTENTES.**

**NO INVENTAR APIs.**

**NO INVENTAR ENDPOINTS.**

**NO INVENTAR CAPACIDADES DE POSTULACIÓN.**

**VERIFICAR SIEMPRE LA DOCUMENTACIÓN OFICIAL ACTUAL ANTES DE IMPLEMENTAR UNA INTEGRACIÓN.**
