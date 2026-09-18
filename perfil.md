# CONTEXTO COMPLETO DEL PROYECTO

## 1. SOBRE EL USUARIO / CREADOR DEL PROYECTO

El creador de esta plataforma es un profesional informático argentino con más de 20 años de experiencia en tecnología.

### Perfil profesional

* Licenciado en Informática.
* Más de 20 años de experiencia profesional.
* Experiencia como:

  * Programador.
  * Desarrollador Senior.
  * Full Stack Developer.
  * Tech Lead.
  * Analista Funcional.
  * Ingeniero de Datos.
  * Especialista BI.
  * DBA SQL Server.
  * Consultor QlikView / Qlik Sense.
  * Integrador de sistemas.
  * Especialista en automatización.
* Experiencia liderando proyectos de punta a punta.
* Experiencia trabajando directamente con clientes y stakeholders.
* Experiencia definiendo requerimientos, arquitectura, desarrollo, implementación y soporte.
* Alta capacidad de adaptación tecnológica.
* Utiliza herramientas de IA y nuevas tecnologías para acelerar considerablemente el desarrollo.

### Tecnologías y conocimientos

#### Bases de datos

* Microsoft SQL Server.
* SQL Server 2008 / 2008 R2.
* SQL Server 2012.
* SQL Server 2014.
* SQL Server moderno.
* SQL Server Agent.
* Database Mail.
* Linked Servers.
* MySQL.
* Diseño y mantenimiento de bases de datos.
* Stored Procedures.
* ETL.
* Optimización.
* Integraciones entre sistemas.

#### Business Intelligence

* QlikView.
* Qlik Sense.
* QVD.
* Dashboards.
* Modelado de datos.
* ETL.
* KPIs.
* Reporting.
* Integración de múltiples fuentes.

Tiene experiencia específica con QlikView/Qlik Sense, incluyendo desarrollo de dashboards, modelos de datos, QVD, integraciones y consultoría.

#### Desarrollo

Experiencia con:

* .NET.
* VB.NET.
* desarrollo backend.
* desarrollo frontend.
* aplicaciones empresariales.
* APIs.
* integraciones.
* automatización.
* sistemas internos.
* aplicaciones de escritorio.
* aplicaciones web.

#### Infraestructura

También posee experiencia práctica en:

* servidores.
* redes.
* comunicaciones.
* soporte técnico.
* backups.
* monitoreo.
* servicios cloud.
* AWS.
* Google Workspace.
* integración de servicios.
* administración de sistemas.

#### Automatización / IA

Interés y experiencia creciente en:

* Inteligencia Artificial.
* integración de LLM.
* automatización mediante IA.
* agentes.
* generación automática de contenido.
* análisis automático.
* estimación.
* integración de IA con aplicaciones empresariales.
* automatización de procesos.

---

# 2. POSICIONAMIENTO PROFESIONAL

El perfil profesional actual puede describirse principalmente como:

> **Senior Data Engineer / Senior Software Engineer / AI & Data Integration Specialist**

con especial fortaleza en:

```text
Data Engineering
SQL Server
ETL
BI
QlikView
Qlik Sense
Software Development
APIs
System Integration
Automation
Artificial Intelligence
```

También existe experiencia importante en análisis funcional, liderazgo técnico y relación con clientes.

---

# 3. OBJETIVO PROFESIONAL

El objetivo actual es reducir progresivamente la dependencia de un empleo tradicional y desarrollar alternativas basadas en:

* trabajo remoto.
* proyectos.
* freelance.
* consultoría.
* desarrollo de software.
* servicios tecnológicos.
* IA.
* automatización.
* productos propios.
* SaaS.
* comercialización de soluciones tecnológicas.

La plataforma de búsqueda laboral nace como una herramienta para centralizar oportunidades y posteriormente puede evolucionar hacia un producto comercial.

---

# 4. CONCEPTO ORIGINAL DE LA APLICACIÓN

La aplicación comenzó como una herramienta personal para buscar trabajo remoto.

La idea inicial era:

```text
Buscar trabajo
        ↓
Encontrar ofertas
        ↓
Analizar ofertas
        ↓
Postularse
```

Pero la visión evolucionó hacia:

```text
PLATAFORMA CENTRALIZADA DE EMPLEO
```

capaz de:

* buscar oportunidades.
* agregar múltiples fuentes.
* analizar ofertas con IA.
* comparar ofertas contra el perfil.
* seleccionar CV.
* generar cover letters.
* completar preguntas.
* postularse.
* registrar postulaciones.
* realizar seguimiento.
* automatizar tareas.
* utilizar APIs.
* utilizar ATS.
* utilizar browser automation cuando corresponda.

---

# 5. EVOLUCIÓN DEL PRODUCTO

La plataforma debe poder evolucionar desde:

```text
PERSONAL JOB SEARCH TOOL
```

hacia:

```text
MULTIUSER JOB SEARCH PLATFORM
```

y eventualmente:

```text
JOB SEARCH / APPLICATION SaaS
```

Esto significa que el sistema ya NO debe estar diseñado alrededor de una única persona.

Todo aquello que actualmente esté almacenado como información fija del usuario debe pasar a estar asociado a un:

```text
User
```

y posteriormente a un:

```text
CandidateProfile
```

---

# 6. PROBLEMA ACTUAL

La aplicación fue desarrollada originalmente pensando en un único usuario.

Por lo tanto, posiblemente existan elementos como:

* CV.
* experiencia.
* skills.
* preferencias.
* búsquedas.
* configuraciones.
* credenciales.
* aplicaciones.
* documentos.
* respuestas.
* perfiles de búsqueda.

que actualmente puedan estar globales.

Esto debe corregirse.

## REGLA FUNDAMENTAL

Ningún usuario debe poder acceder accidentalmente a información perteneciente a otro usuario.

---

# 7. OBJETIVO DEL NUEVO MÓDULO

Agregar un:

# PROFILE MANAGEMENT MODULE

que permita que múltiples personas utilicen la misma aplicación.

Cada usuario debe tener uno o más perfiles laborales.

Ejemplo:

```text
Usuario
   │
   ├── Perfil principal
   │
   ├── Perfil Data Engineer
   │
   ├── Perfil Software Engineer
   │
   └── Perfil Qlik / BI
```

Esto permitirá que una misma persona pueda utilizar la plataforma para diferentes tipos de búsqueda.

---

# 8. MULTI-TENANCY / MULTIUSER

La aplicación debe pasar conceptualmente de:

```text
APPLICATION
   ↓
ONE CANDIDATE
```

a:

```text
APPLICATION
   ↓
USERS
   ↓
CANDIDATE PROFILES
   ↓
JOBS
   ↓
MATCHES
   ↓
APPLICATIONS
```

---

# 9. ENTIDAD USER

Crear o adaptar:

```typescript
User
```

Campos mínimos:

```typescript
interface User {
    id: string;

    email: string;

    passwordHash?: string;

    firstName: string;

    lastName: string;

    isActive: boolean;

    emailVerified: boolean;

    createdAt: Date;

    updatedAt: Date;

    lastLoginAt?: Date;
}
```

No almacenar passwords en texto plano.

---

# 10. USER ROLES

Preparar inicialmente:

```text
USER
ADMIN
```

Opcionalmente dejar preparada la arquitectura para:

```text
SUPER_ADMIN
RECRUITER
COMPANY
```

pero NO implementar funcionalidades innecesarias todavía.

---

# 11. CANDIDATE PROFILE

Crear:

```typescript
CandidateProfile
```

Debe pertenecer a un usuario.

```text
User
  │
  └── CandidateProfile
```

Campos sugeridos:

```typescript
interface CandidateProfile {
    id: string;

    userId: string;

    name: string;

    headline?: string;

    professionalSummary?: string;

    country?: string;

    city?: string;

    timezone?: string;

    phone?: string;

    email?: string;

    linkedinUrl?: string;

    githubUrl?: string;

    portfolioUrl?: string;

    websiteUrl?: string;

    yearsOfExperience?: number;

    preferredEmploymentTypes?: string[];

    preferredWorkModes?: string[];

    preferredCountries?: string[];

    preferredTimezones?: string[];

    minimumSalary?: number;

    salaryCurrency?: string;

    languages?: string[];

    isDefault: boolean;

    createdAt: Date;

    updatedAt: Date;
}
```

---

# 12. EXPERIENCIA PROFESIONAL

No guardar toda la experiencia directamente en CandidateProfile.

Crear:

```text
ProfessionalExperience
```

Ejemplo:

```typescript
interface ProfessionalExperience {
    id: string;

    profileId: string;

    company: string;

    position: string;

    description?: string;

    startDate: Date;

    endDate?: Date;

    current: boolean;

    achievements?: string[];
}
```

---

# 13. SKILLS

Crear:

```text
ProfileSkill
```

Ejemplo:

```typescript
interface ProfileSkill {
    id: string;

    profileId: string;

    skill: string;

    category?: string;

    yearsExperience?: number;

    level?:
        | "basic"
        | "intermediate"
        | "advanced"
        | "expert";
}
```

---

# 14. EDUCATION

Crear:

```text
Education
```

con:

* institución.
* título.
* área.
* fecha.
* descripción.

---

# 15. CERTIFICATIONS

Crear:

```text
Certification
```

con:

* nombre.
* institución.
* fecha.
* URL.
* credential ID cuando corresponda.

---

# 16. IDIOMAS

Crear:

```text
ProfileLanguage
```

con:

```text
language
level
```

Ejemplo:

```text
English
Spanish
Portuguese
```

---

# 17. DOCUMENTOS

Los documentos deben pertenecer al perfil.

```text
CandidateProfile
       │
       ├── Resume
       ├── Cover Letter
       ├── Portfolio
       └── Other Documents
```

Crear:

```typescript
CandidateDocument
```

con:

```typescript
interface CandidateDocument {
    id: string;

    profileId: string;

    type:
        | "resume"
        | "cover_letter"
        | "portfolio"
        | "certificate"
        | "other";

    name: string;

    filePath?: string;

    mimeType?: string;

    isDefault: boolean;

    createdAt: Date;
}
```

---

# 18. MÚLTIPLES CV

Un usuario debe poder tener:

```text
CV General
CV Data Engineer
CV Software Engineer
CV Qlik / BI
CV AI
```

La IA podrá seleccionar el CV más adecuado para cada oferta.

---

# 19. RESPUESTAS DEL CANDIDATO

Crear:

```text
CandidateAnswer
```

Ejemplo:

```typescript
interface CandidateAnswer {
    id: string;

    profileId: string;

    question: string;

    answer: string;

    verified: boolean;

    createdAt: Date;

    updatedAt: Date;
}
```

La IA podrá utilizar respuestas previamente verificadas.

No debe inventar información.

---

# 20. PREFERENCIAS DE BÚSQUEDA

Crear:

```text
JobSearchPreference
```

Debe permitir:

```text
keywords
excludedKeywords
locations
countries
remoteOnly
employmentTypes
seniority
minimumSalary
salaryCurrency
skills
industries
companies
timezones
```

---

# 21. SAVED SEARCHES

Cada usuario debe poder tener búsquedas guardadas.

```text
User
  │
  └── SavedSearch
```

Ejemplo:

```text
Senior Data Engineer
Remote Qlik Developer
AI Engineer
Senior Software Engineer
```

---

# 22. JOBS Y MULTIUSUARIO

Los trabajos son datos compartidos de las fuentes.

Por lo tanto:

```text
Job
```

NO necesariamente pertenece a un usuario.

Ejemplo:

```text
Greenhouse
     ↓
Job
     ↓
puede ser visto por
     ↓
User A
User B
User C
```

Pero el análisis individual sí pertenece al usuario:

```text
Job
 │
 ├── JobMatch → User A
 ├── JobMatch → User B
 └── JobMatch → User C
```

---

# 23. MATCHING MULTIUSUARIO

NO guardar el score de compatibilidad directamente en Job.

Debe ser:

```text
JobMatch
```

relacionado con:

```text
profileId
jobId
```

Ejemplo:

```text
JOB #123

User A / Profile Data Engineer
Match = 94%

User B / Profile Developer
Match = 71%

User C / Profile BI
Match = 86%
```

---

# 24. APPLICATIONS MULTIUSUARIO

Una candidatura pertenece al perfil que la realizó.

```text
CandidateProfile
       ↓
Application
       ↓
Job
```

Nunca:

```text
Job
 ↓
Application global
```

porque múltiples usuarios pueden postularse al mismo trabajo.

---

# 25. CONNECTOR CREDENTIALS

Las credenciales de plataformas externas son SIEMPRE propiedad del usuario.

Ejemplo:

```text
User A
 ├── Upwork credentials
 ├── Freelancer credentials
 └── SmartRecruiters credentials

User B
 ├── Upwork credentials
 └── Freelancer credentials
```

Nunca mezclar credenciales entre usuarios.

---

# 26. SEGURIDAD MULTIUSUARIO

Esta es una prioridad crítica.

Todas las consultas deben filtrar por:

```text
userId
```

o:

```text
profileId
```

según corresponda.

Ejemplo:

```sql
WHERE userId = @currentUserId
```

Nunca confiar solamente en IDs enviados por frontend.

El backend debe obtener el usuario autenticado desde:

```text
session
JWT
OAuth
```

y validar ownership.

---

# 27. IDOR / BROKEN ACCESS PREVENTION

Prevenir:

```text
GET /api/profiles/123
```

si:

```text
profile 123
```

pertenece a otro usuario.

El backend debe devolver:

```text
403
```

o:

```text
404
```

según la arquitectura de seguridad.

Lo mismo debe aplicarse a:

* CV.
* documentos.
* aplicaciones.
* búsquedas.
* respuestas.
* credenciales.
* configuraciones.
* preferencias.

---

# 28. DASHBOARD PERSONALIZADO

Después de autenticarse:

```text
USER
 ↓
DEFAULT PROFILE
 ↓
DASHBOARD
```

Mostrar:

```text
Nuevas ofertas
Ofertas compatibles
Postulaciones
Entrevistas
Pendientes
Acciones requeridas
```

---

# 29. PROFILE SWITCHER

Si el usuario tiene múltiples perfiles:

```text
┌──────────────────────────────┐
│ Perfil activo                │
│                              │
│ ● Data Engineer              │
│ ○ Software Engineer          │
│ ○ Qlik / BI                  │
│                              │
│ [Cambiar perfil]             │
└──────────────────────────────┘
```

El perfil seleccionado determina:

* matching.
* CV.
* preferencias.
* búsqueda.
* análisis.
* aplicaciones.

---

# 30. FLUJO DE USUARIO

## REGISTRO

```text
Register
 ↓
Verify email
 ↓
Create Candidate Profile
 ↓
Upload CV
 ↓
AI extracts information
 ↓
User verifies information
 ↓
Profile ready
```

---

# 31. IMPORTACIÓN DEL CV MEDIANTE IA

El usuario puede subir un CV.

La IA puede extraer:

```text
Nombre
Headline
Experiencia
Empresas
Cargos
Skills
Educación
Certificaciones
Idiomas
Links
```

Pero:

> La información extraída por IA debe quedar como "pendiente de verificación" hasta que el usuario la confirme.

No asumir que una extracción automática es correcta.

---

# 32. JOB SEARCH

Cuando el usuario busca:

```text
Senior Data Engineer
```

la aplicación consulta los connectors.

Los jobs son globales.

Después:

```text
Job
 ↓
CandidateProfile
 ↓
AI Matching
```

---

# 33. POSTULACIÓN

Cuando el usuario pulsa:

```text
APPLY
```

la aplicación debe utilizar:

```text
activeProfile
```

para determinar:

* CV.
* cover letter.
* respuestas.
* experiencia.
* preferencias.
* credenciales del connector.

---

# 34. APPLICATION ISOLATION

Una aplicación:

```text
Application #100
```

debe pertenecer inequívocamente a:

```text
User #5
Profile #12
```

y no ser visible para:

```text
User #6
```

---

# 35. ADMIN PANEL

Crear inicialmente un panel administrativo básico.

El administrador debe poder:

```text
Usuarios
Perfiles
Connectors
Estado de APIs
Jobs
Errores
Logs
```

NO debe poder acceder a credenciales privadas de usuarios en texto plano.

---

# 36. ADMIN USER MANAGEMENT

Permitir:

```text
listar usuarios
activar usuario
desactivar usuario
ver fecha de registro
ver último login
ver cantidad de perfiles
ver cantidad de aplicaciones
```

No permitir modificar información personal innecesariamente.

---

# 37. CONNECTOR ADMINISTRATION

Admin debe poder ver:

```text
Connector
Status
Last Sync
Jobs Retrieved
Errors
Rate Limits
```

Ejemplo:

```text
Himalayas       ONLINE
Jobicy          ONLINE
Remote OK       ONLINE
Adzuna          ONLINE
Greenhouse      ONLINE
Lever           ONLINE
Ashby           ONLINE
```

---

# 38. MODELO DE DATOS

La relación conceptual debe ser:

```text
User
 │
 ├── CandidateProfile
 │       │
 │       ├── ProfessionalExperience
 │       ├── ProfileSkill
 │       ├── Education
 │       ├── Certification
 │       ├── ProfileLanguage
 │       ├── CandidateDocument
 │       ├── CandidateAnswer
 │       ├── JobSearchPreference
 │       └── SavedSearch
 │
 ├── ConnectorCredential
 │
 └── Application
         │
         └── Job
```

Mientras:

```text
Job
 │
 ├── JobMatch → Profile
 └── Application → Profile
```

---

# 39. AUDIT

Registrar:

```text
login
logout
profile created
profile updated
CV uploaded
CV deleted
connector connected
connector disconnected
job analyzed
application prepared
application submitted
application failed
```

---

# 40. PRIVACIDAD

Los datos del usuario deben considerarse privados.

No exponer:

* CV.
* teléfono.
* email.
* documentos.
* credenciales.
* respuestas.
* historial de postulaciones.

a otros usuarios.

---

# 41. FUTURA EVOLUCIÓN

La arquitectura debe quedar preparada para:

```text
Free User
Paid User
Professional
Recruiter
Company
```

pero inicialmente implementar solamente:

```text
USER
ADMIN
```

No construir funcionalidades comerciales todavía salvo que sean necesarias para no bloquear la arquitectura.

---

# 42. SUSCRIPCIONES FUTURAS

Dejar preparada la arquitectura para eventualmente tener:

```text
Free
Pro
Premium
```

con límites como:

```text
cantidad de perfiles
cantidad de búsquedas
cantidad de análisis IA
cantidad de aplicaciones
cantidad de CV
cantidad de connectors
automatización
```

Pero NO implementar billing todavía si el proyecto actual no lo necesita.

---

# 43. ARQUITECTURA FINAL

La plataforma debe evolucionar hacia:

```text
                         ┌───────────────────┐
                         │      USERS        │
                         └─────────┬─────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
             CANDIDATE PROFILES              CREDENTIALS
                    │
         ┌──────────┼───────────┐
         │          │           │
         ▼          ▼           ▼
       CVs       SKILLS      PREFERENCES
         │
         ▼
     AI MATCHING
         │
         ▼
     GLOBAL JOBS
         │
    ┌────┴─────────────────────────────────┐
    │                                      │
    ▼                                      ▼
JOB BOARDS                              ATS
    │                                      │
    ├── Himalayas                          ├── Greenhouse
    ├── Jobicy                             ├── Lever
    ├── Remote OK                          ├── Ashby
    ├── Adzuna                             ├── SmartRecruiters
    ├── Jobgether                          ├── Workable
    ├── Remotive                           ├── Workday
    ├── Upwork                             ├── Recruitee
    └── Freelancer                         ├── BambooHR
                                           ├── Personio
                                           ├── Teamtailor
                                           ├── Breezy
                                           └── Pinpoint
                                                │
                                                ▼
                                          APPLICATION
                                                │
                                                ▼
                                         TRACKING / CRM
```

---

# 44. INSTRUCCIONES PARA CLAUDE

## PASO 1 — ANALIZAR

Antes de modificar cualquier archivo:

* inspeccionar todo el proyecto.
* identificar stack.
* identificar arquitectura.
* identificar database.
* identificar authentication.
* identificar modelos.
* identificar servicios.
* identificar frontend.
* identificar backend.
* identificar jobs.
* identificar connectors.
* identificar información actualmente hardcodeada del candidato.

---

## PASO 2 — DETECTAR DATOS PERSONALES ACTUALES

Buscar información que actualmente represente al candidato único.

Por ejemplo:

```text
nombre
email
CV
skills
experiencia
preferencias
LinkedIn
GitHub
salary
location
API credentials
```

Determinar dónde está almacenada.

---

## PASO 3 — PROPONER MIGRACIÓN

Antes de implementar:

crear:

```text
/docs/multiuser-architecture.md
```

explicando:

```text
Current Architecture
Current Single User Model
Target Multiuser Model
Database Changes
Authentication Changes
Authorization Changes
Migration Plan
Security
Testing
```

---

# 45. MIGRACIÓN DE DATOS EXISTENTES

MUY IMPORTANTE.

El proyecto actual ya contiene información correspondiente al usuario original.

NO eliminarla.

Crear un usuario inicial:

```text
DEFAULT / OWNER USER
```

y asociar todos los datos existentes a ese usuario.

Conceptualmente:

```text
DATOS EXISTENTES
       ↓
OWNER USER
       ↓
DEFAULT PROFILE
```

De esta manera la aplicación debe seguir funcionando exactamente como antes para el usuario original.

---

# 46. BACKWARD COMPATIBILITY

Después de implementar multiusuario:

El usuario original debe poder:

```text
login
 ↓
ver su perfil
 ↓
ver sus jobs
 ↓
ver sus matches
 ↓
ver sus aplicaciones
 ↓
utilizar sus connectors
```

sin perder información.

---

# 47. TESTS

Crear tests para verificar:

### Usuario A

Puede:

```text
ver Profile A
ver CV A
ver Applications A
```

### Usuario B

Puede:

```text
ver Profile B
ver CV B
ver Applications B
```

### Usuario A intentando acceder a datos de B

Debe fallar.

Probar:

```text
profile
resume
document
application
credential
saved search
candidate answer
```

---

# 48. TEST DE SEGURIDAD CRÍTICO

Crear explícitamente tests de:

```text
Horizontal Privilege Escalation
IDOR
Broken Access Control
Cross-user data leakage
Credential leakage
Document leakage
```

---

# 49. API

Todos los endpoints actuales deben revisarse.

Cualquier endpoint que devuelva datos de usuario debe obtener el usuario autenticado desde el contexto de autenticación.

NO aceptar:

```text
userId
```

desde el frontend como mecanismo de autorización.

Ejemplo incorrecto:

```text
GET /api/applications?userId=5
```

El backend debe determinar:

```text
currentUserId
```

a partir de la sesión/token.

---

# 50. API ESPERADA

Agregar o adaptar:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout

GET /api/me

GET /api/profiles
POST /api/profiles
GET /api/profiles/:id
PUT /api/profiles/:id
DELETE /api/profiles/:id

POST /api/profiles/:id/set-default

GET /api/profiles/:id/experiences
POST /api/profiles/:id/experiences

GET /api/profiles/:id/skills
POST /api/profiles/:id/skills

GET /api/profiles/:id/documents
POST /api/profiles/:id/documents
DELETE /api/profiles/:id/documents/:documentId

GET /api/profiles/:id/preferences
PUT /api/profiles/:id/preferences

GET /api/profiles/:id/saved-searches
POST /api/profiles/:id/saved-searches

GET /api/profiles/:id/applications
```

Adaptar estos endpoints al estilo y framework que ya utilice el proyecto.

NO imponer una tecnología nueva si no es necesaria.

---

# 51. FRONTEND

Agregar:

```text
Login
Register
Forgot Password
Profile
Profile Editor
Profile Switcher
Documents
Preferences
Applications
Settings
```

El dashboard debe utilizar el perfil activo.

---

# 52. PERFIL ACTIVO

Mantener:

```text
activeProfileId
```

en sesión/contexto de usuario.

Pero nunca confiar en él para autorización.

Debe utilizarse solamente como contexto de UI.

El backend siempre debe verificar:

```text
profile.userId === authenticatedUser.id
```

---

# 53. IA Y MULTIUSUARIO

La IA debe recibir solamente la información del perfil activo.

Ejemplo:

```text
JOB
+
ACTIVE PROFILE
+
ACTIVE PROFILE CV
+
ACTIVE PROFILE ANSWERS
```

Nunca:

```text
JOB
+
ALL USERS
```

---

# 54. CACHE DE IA

Si se cachea un análisis:

NO asumir que un resultado específico del candidato es global.

Ejemplo:

```text
Job Analysis
```

puede ser global si solamente analiza el job.

Pero:

```text
Job Match
```

debe pertenecer al perfil.

---

# 55. SEPARAR JOB ANALYSIS DE CANDIDATE MATCH

Crear conceptualmente:

```text
JobAnalysis
```

para información general del puesto:

```text
skills required
seniority
salary
remote
requirements
```

Y:

```text
JobMatch
```

para comparar contra un perfil específico.

Esto evita procesar el mismo job repetidamente.

---

# 56. EJEMPLO

```text
JOB #500

JobAnalysis
 ├── Required Skills
 ├── Seniority
 ├── Location
 ├── Salary
 └── Requirements

JobMatch / Profile A
 ├── Score
 ├── Matched Skills
 └── Missing Skills

JobMatch / Profile B
 ├── Score
 ├── Matched Skills
 └── Missing Skills
```

---

# 57. OBJETIVO DE PRODUCTO

La plataforma ya no debe pensarse como:

> "Mi buscador de trabajo".

Debe pensarse como:

> **"Una plataforma multiusuario de búsqueda, análisis y gestión automatizada de oportunidades laborales."**

Esto permitirá posteriormente ofrecerla a:

* profesionales.
* freelancers.
* desarrolladores.
* ingenieros.
* diseñadores.
* analistas.
* consultores.
* estudiantes.
* personas buscando trabajo remoto.

---

# 58. REGLAS PARA IMPLEMENTAR

### NO

* reescribir todo.
* eliminar datos existentes.
* eliminar funcionalidades existentes.
* duplicar lógica.
* hardcodear usuarios.
* hardcodear perfiles.
* almacenar passwords en texto plano.
* exponer API keys.
* confiar en userId enviado desde frontend.
* mezclar información de usuarios.
* inventar funcionalidades de APIs externas.

### SÍ

* reutilizar arquitectura existente.
* migrar datos actuales.
* crear User.
* crear CandidateProfile.
* relacionar datos existentes.
* aislar información por usuario.
* implementar authorization.
* crear tests de aislamiento.
* mantener connectors desacoplados.
* mantener compatibilidad con funcionalidades existentes.

---

# 59. ORDEN DE IMPLEMENTACIÓN

Implementar en este orden:

```text
1. Analizar proyecto existente
2. Diseñar modelo multiusuario
3. User
4. Authentication
5. CandidateProfile
6. Migración del usuario existente
7. Authorization
8. Profile UI
9. Documents / CV
10. Preferences
11. Saved Searches
12. JobMatch por Profile
13. Applications por Profile
14. Connector credentials por User
15. Admin
16. Security tests
17. Integration tests
18. Regression tests
```

---

# 60. RESULTADO FINAL ESPERADO

Al finalizar, la aplicación debe permitir:

```text
              ┌───────────────┐
              │    USUARIO    │
              └───────┬───────┘
                      │
             ┌────────┴────────┐
             │                 │
             ▼                 ▼
         PROFILE 1         PROFILE 2
             │                 │
             ▼                 ▼
          CV / IA           CV / IA
             │                 │
             └────────┬────────┘
                      │
                      ▼
                 JOB SEARCH
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       JOB BOARDS    ATS       FREELANCE
          │           │           │
          └───────────┼───────────┘
                      ▼
                 NORMALIZATION
                      │
                      ▼
                  JOB ANALYSIS
                      │
                      ▼
                 AI MATCHING
                      │
                      ▼
                 APPLICATION
                      │
                      ▼
                 TRACKING
```

Y simultáneamente:

```text
USER A ──> PROFILE A ──> APPLICATIONS A

USER B ──> PROFILE B ──> APPLICATIONS B

USER C ──> PROFILE C ──> APPLICATIONS C
```

sin posibilidad de mezclar información.

---

# 61. INSTRUCCIÓN FINAL PARA CLAUDE

**No comiences inmediatamente a modificar código.**

Primero inspeccioná el proyecto existente y generá un diagnóstico técnico.

Después proponé la migración a multiusuario.

Después implementá la solución de forma incremental.

La aplicación existente debe continuar funcionando.

El usuario actual debe conservar todos sus datos.

El nuevo modelo debe permitir agregar usuarios ilimitados desde el punto de vista arquitectónico, sin asumir que la aplicación seguirá siendo utilizada por una única persona.

La arquitectura debe quedar preparada para transformar posteriormente este proyecto en un producto SaaS.

**Prioridad absoluta:**

```text
SEGURIDAD
>
AISLAMIENTO DE DATOS
>
COMPATIBILIDAD CON EL PROYECTO EXISTENTE
>
CORRECTNESS
>
ESCALABILIDAD
>
NUEVAS FUNCIONALIDADES
```

No implementar funcionalidades innecesarias solamente para "completar" el módulo.

Primero lograr un **multiusuario sólido, seguro y funcional** sobre la arquitectura existente.
