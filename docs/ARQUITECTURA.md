# Arquitectura de JobHunter AI

Este documento describe como esta construida la plataforma y por que. Es la
referencia para incorporar nuevas fuentes sin tocar el nucleo.

---

## 1. Vision general

```
                       ┌──────────────────────────────┐
                       │      CANDIDATE PROFILE       │
                       │        (profile.md)          │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │   MOTOR JOBHUNTER     │
                          │  search · match · apply│
                          └───────────┬───────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
        CONNECTOR REGISTRY      MATCHING ENGINE        APPLICATION ENGINE
              │                       │                       │
    ┌─────────┼─────────┐             │             ┌─────────┴─────────┐
    ▼         ▼         ▼             ▼             ▼                   ▼
 JOB BOARDS  ATS   FREELANCE    heuristico + LLM   API APPLY      ASSISTED APPLY
                                                        │                   │
                                                        └─────────┬─────────┘
                                                                  ▼
                                                        APPLICATION TRACKER
```

---

## 2. Estructura del repositorio

```
JobHunterHub/
├── instalar.bat / iniciar.bat     Instalacion y arranque en Windows
├── scripts/
│   ├── setup.mjs                  Instalador multiplataforma
│   ├── dev.mjs                    Backend + frontend en paralelo
│   └── generate-docs.mjs          Genera docs/integrations desde el codigo
├── server/src/
│   ├── config.ts                  Lectura de .env sin dependencias
│   ├── index.ts                   Servidor HTTP, estaticos y arranque
│   ├── core/                      Contratos y mecanica compartida
│   │   ├── types.ts               NormalizedJob, JobConnector, capacidades
│   │   ├── normalize.ts           HTML→texto, salarios, seniority, skills
│   │   ├── dedup.ts               Deduplicacion en dos niveles
│   │   └── http.ts                Rate limit, backoff, cache, coalescencia
│   ├── connectors/                Una plataforma = un archivo
│   │   ├── base.ts                Helpers comunes
│   │   ├── ats-common.ts          Fabrica para ATS multi-tenant de solo lectura
│   │   ├── registry.ts            Registro y contexto de ejecucion
│   │   └── <plataforma>.ts        20 conectores
│   ├── services/                  Logica de negocio
│   │   ├── profile.ts             Parseo del perfil Markdown
│   │   ├── matching.ts            Scoring deterministico + analisis LLM
│   │   ├── ai.ts                  Proveedor de IA intercambiable
│   │   ├── documents.ts           CV adaptado, carta y respuestas
│   │   ├── applications.ts        Maquina de estados y envio
│   │   ├── search.ts              Orquestacion multi-fuente
│   │   ├── sync.ts                Worker de sincronizacion y alertas
│   │   ├── sources.ts             Configuracion y credenciales por fuente
│   │   ├── jobs.ts                Persistencia y consultas de ofertas
│   │   └── audit.ts               Registro de auditoria
│   ├── routes/                    API interna por dominio
│   ├── http/router.ts             Router minimo sobre node:http
│   └── db/                        Esquema SQLite y acceso
├── web/src/                       Interfaz React
└── docs/integrations/             Estado real de cada fuente
```

---

## 3. Contrato de connector

Toda plataforma implementa la misma interfaz:

```ts
interface JobConnector {
  id, name, homepage, docsUrl, category, mode
  settingsSchema      // que necesita el ADMIN para habilitarlo
  rateLimit           // limites declarados
  restrictions        // condiciones de uso de la fuente
  getCapabilities()   // que puede hacer realmente
  isConfigured(settings)
  searchJobs(params, ctx)
  getJob?(externalJobId, ctx)
  getApplicationForm?(externalJobId, ctx)
  submitApplication?(externalJobId, payload, ctx)
  getApplicationStatus?(externalApplicationId, ctx)
  healthCheck(ctx)
}
```

Reglas que hacen que el sistema escale:

1. **Ningun dato crudo sale del connector.** Todo se normaliza a `NormalizedJob`.
2. **Las capacidades se declaran, no se asumen.** Si una fuente no permite
   postular, `apply: false` y el motor deriva al formulario original.
3. **Los errores se aislan.** `runSearch` usa `Promise.allSettled`: si Adzuna
   falla, Himalayas y Greenhouse siguen respondiendo.
4. **El contexto lo provee el host.** El connector recibe `fetchJson`/`fetchText`
   ya limitados por rate limit, con cache y backoff; no crea sus propios clientes.

### Agregar una fuente nueva

```ts
// server/src/connectors/mi-fuente.ts
export const miFuenteConnector: JobConnector = { /* ... */ };

// server/src/connectors/registry.ts
connectorRegistry.register(miFuenteConnector);
```

Para ATS multi-tenant de solo lectura alcanza con `createTenantAtsConnector`,
aportando la URL del feed y el mapper. Despues: `node scripts/generate-docs.mjs`.

---

## 4. Normalizacion y deduplicacion

Todas las fuentes convergen en `NormalizedJob`, que conserva trazabilidad
completa: `source`, `sourceJobId`, `sourceUrl`, `retrievedAt` y `rawData`.

La deduplicacion trabaja en dos niveles:

1. **Clave dura:** `source + sourceJobId` (identidad exacta dentro de una fuente).
2. **Clave blanda:** empresa + titulo + ubicacion normalizados, reforzada con
   similitud de Jaccard sobre la descripcion.

Umbrales: `>= 0.82` se considera duplicado; entre `0.6` y `0.82` la oferta queda
marcada como `duplicateCandidate` y **no se elimina**: baja confianza nunca borra
informacion.

---

## 5. Motor de matching

El scoring deterministico corre siempre: es explicable, reproducible y gratis.

| Dimension | Peso | Como se calcula |
| --- | --- | --- |
| Skills | 34% | Interseccion entre skills del aviso y del perfil, con coincidencia parcial |
| Experiencia | 16% | Anos pedidos por el aviso vs anos del perfil |
| Seniority | 14% | Distancia entre niveles |
| Ubicacion | 14% | Modalidad preferida, paises permitidos y worldwide |
| Contrato | 10% | Tipos de contrato aceptados |
| Salario | 7% | Salario anualizado vs expectativa |
| Idioma | 5% | Requisito de ingles vs nivel declarado |

Ubicacion e idioma no son un factor mas, son **condiciones de acceso**: cuando
fallan se aplica un techo al score total (55 y 70 respectivamente), porque una
oferta presencial en un pais donde el candidato no puede trabajar no deberia
aparecer como "muy compatible" por mas que el stack coincida.

Con un LLM configurado, el analisis se enriquece con texto, riesgos y
recomendacion, y puede ajustar el score base en ±15 puntos. Si el LLM falla, el
resultado deterministico sigue siendo valido.

---

## 6. Perfil como fuente de verdad

`profile.md` es la unica fuente de informacion del candidato. El parser extrae
contacto, skills, idiomas, experiencia, educacion, anos de experiencia y
preferencias, ignorando bloques de codigo y validando que lo detectado tenga
forma razonable.

Los documentos generados (CV adaptado, carta) son **derivados**: nunca modifican
el perfil original.

La regla que atraviesa todo el sistema: **si un dato no existe en el perfil, la
respuesta es `UNKNOWN`** y se pide intervencion del usuario. Ni el motor ni la IA
completan huecos con suposiciones.

---

## 7. Postulaciones

Tres niveles de automatizacion:

1. **Discovery** — buscar, normalizar, guardar.
2. **Assisted** — la plataforma prepara CV, carta, formulario y respuestas; el usuario confirma.
3. **Automated** — envio por API oficial, solo con credenciales y permisos validos.

Maquina de estados:

```
DISCOVERED → MATCHED → READY_TO_APPLY → WAITING_USER_CONFIRMATION → APPLYING
   → SUBMITTED → INTERVIEW → OFFER → HIRED
   → FAILED / REQUIRES_USER_ACTION / WITHDRAWN / REJECTED
```

Las transiciones invalidas se rechazan. Nunca se intenta saltear CAPTCHA, MFA ni
controles anti-bot: cuando hace falta una persona, el estado pasa a
`REQUIRES_USER_ACTION`.

Una oferta no puede tener dos postulaciones del mismo usuario: la unicidad
`(user_id, job_id)` lo garantiza en la base.

---

## 8. Datos

Modelos principales en SQLite (`data/jobhunter.db`):

`users`, `candidate_profiles`, `candidate_preferences`, `candidate_resumes`,
`candidate_answers`, `job_sources`, `connector_credentials`,
`connector_executions`, `companies`, `jobs`, `job_matches`, `applications`,
`application_questions`, `application_answers`, `application_documents`,
`application_events`, `search_queries`, `saved_searches`, `alerts`,
`audit_log`, `system_settings`.

Las tablas de usuario tienen `ON DELETE CASCADE`: eliminar un usuario borra todo
su rastro.

---

## 9. Observabilidad

Cada ejecucion de connector registra fuente, duracion, ofertas recibidas,
insertadas, actualizadas, duplicadas, rechazadas, golpes de rate limit y error.
El panel ADMIN muestra salud en vivo, metricas acumuladas y las ultimas
ejecuciones.

---

## 10. Seguridad

- `scrypt` para contrasenas, JWT HS256 para sesiones, AES-256-GCM para credenciales.
- El backend resuelve el usuario desde el token; el `userId` del cliente se ignora.
- Toda consulta de datos de candidato filtra por el usuario autenticado.
- El rol ADMIN no accede a rutas de candidato y viceversa, validado en el backend.
- Secretos enmascarados en la interfaz y ausentes de los logs.
- Path traversal bloqueado al servir estaticos; peticiones solo same-origin.

---

## 11. Extensiones previstas

La arquitectura queda preparada para:

- **Browser-assisted application**: un `BrowserApplicationConnector` que complete
  formularios y se detenga ante CAPTCHA/MFA pidiendo intervencion humana.
- **Deteccion automatica de ATS**: identificar que ATS usa `empresa.com/careers`
  y dar de alta el tenant correspondiente.
- **MCP**: exponer `search_jobs`, `get_job`, `analyze_job`, `match_candidate`,
  `prepare_application`, `submit_application` y `get_application_status` como
  herramientas, reutilizando los servicios existentes sin cambiar el nucleo.
- **Multiples perfiles por usuario**: el esquema ya contempla `is_primary`.
