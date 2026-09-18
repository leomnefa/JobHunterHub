#!/usr/bin/env node
/**
 * Genera /docs/integrations/<connector>.md a partir del registro de connectors.
 *
 * La parte factual (capacidades, rate limits, restricciones, modo de
 * integracion) se lee del codigo, de manera que la documentacion no pueda
 * quedar desincronizada. La parte narrativa de cada fuente vive en DETAILS.
 *
 * Uso: node scripts/generate-docs.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectorRegistry } from "../server/src/connectors/registry.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, "docs", "integrations");

/** Detalle verificado de cada fuente. `estado` refleja lo realmente implementado. */
const DETAILS = {
  himalayas: {
    resumen:
      "Job board de trabajos 100% remotos con API publica sin autenticacion. Es una de las fuentes mas productivas del sistema.",
    endpoints: [
      "GET https://himalayas.app/jobs/api?limit=20 — feed general",
      "GET https://himalayas.app/jobs/api/search?query=...&limit=20 — busqueda por texto",
      "Parametros soportados: limit, query, cursor, country, worldwide, company",
    ],
    autenticacion: "No requiere. Es una API publica de lectura.",
    busqueda:
      "Se usa /search cuando hay palabras clave y el feed general cuando no. La paginacion es por cursor (`nextCursor`); el parametro `offset` esta deprecado segun el aviso que devuelve la propia API.",
    detalle:
      "El feed ya incluye la descripcion completa, el rango salarial, el seniority y las restricciones de ubicacion y huso horario, por lo que no hace falta una segunda llamada.",
    postulacion:
      "No existe endpoint de postulacion. El usuario es derivado a `applicationLink`, la URL original de la oferta.",
    preguntas: "No aplica: la fuente no expone formularios de postulacion.",
    estadoPostulacion: "No aplica.",
    errores:
      "Los 429 se reintentan con backoff exponencial y jitter respetando `Retry-After`. Un fallo de esta fuente no afecta al resto de la busqueda.",
    estado: [
      "Busqueda: implementada y verificada contra la API en produccion.",
      "Detalle: implementado (se resuelve desde el feed por `guid`).",
      "Postulacion: no disponible en la fuente.",
    ],
    pruebas:
      "Cubierta por las pruebas del registro (`server/test/services.test.ts`) y verificada manualmente contra la API real.",
  },
  jobicy: {
    resumen:
      "Agregador de trabajo remoto con API publica v2. Devuelve hasta 200 ofertas por request con descripcion completa.",
    endpoints: [
      "GET https://jobicy.com/api/v2/remote-jobs?count=200",
      "Parametros soportados: count, tag (texto libre), geo (region), industry",
    ],
    autenticacion: "No requiere API key al momento de la implementacion.",
    busqueda:
      "Las palabras clave se envian en `tag` y el pais en `geo` normalizado a minusculas con guiones. El filtrado por salario y las exclusiones se aplican localmente.",
    detalle: "La respuesta incluye `jobDescription` completo, salario anual, industria y geo.",
    postulacion:
      "No hay endpoint de postulacion. Se deriva al usuario a la URL original, tal como exige la fuente.",
    preguntas: "No aplica.",
    estadoPostulacion: "No aplica.",
    errores: "Reintentos con backoff ante 429/503; el resto de las fuentes sigue funcionando.",
    estado: [
      "Busqueda: implementada y verificada.",
      "Detalle: implementado.",
      "Postulacion: no disponible en la fuente.",
    ],
    pruebas: "Verificada manualmente contra la API real durante la implementacion.",
  },
  remotive: {
    resumen: "Job board remoto con feed publico y condiciones de redistribucion explicitas.",
    endpoints: [
      "GET https://remotive.com/api/remote-jobs?limit=...&search=...",
      "El dominio remotive.io esta obsoleto: se usa remotive.com.",
    ],
    autenticacion: "No requiere.",
    busqueda: "Palabras clave via `search`. El salario llega como texto libre y se parsea localmente.",
    detalle: "El feed trae la descripcion completa en HTML, que se normaliza a texto plano.",
    postulacion: "No hay API de postulacion; se deriva a la URL original.",
    preguntas: "No aplica.",
    estadoPostulacion: "No aplica.",
    errores: "Backoff ante 429; aislamiento por fuente.",
    estado: [
      "Busqueda: implementada y verificada.",
      "Detalle: implementado.",
      "Postulacion: no disponible en la fuente.",
    ],
    pruebas: "Verificada manualmente contra el feed real.",
  },
  remoteok: {
    resumen:
      "Feed publico de Remote OK. El primer elemento del array es un aviso legal, no una oferta, y se descarta explicitamente.",
    endpoints: ["GET https://remoteok.com/api"],
    autenticacion:
      "No requiere, pero exige un User-Agent identificable: sin el, la fuente suele responder 403.",
    busqueda:
      "El feed no acepta filtros del lado del servidor: se descarga completo y se filtra localmente por palabras clave, exclusiones y salario.",
    detalle: "Incluye descripcion, tags, ubicacion y rango salarial cuando la oferta lo publica.",
    postulacion: "Sin API de postulacion; se deriva a `apply_url` o a la URL de la oferta.",
    preguntas: "No aplica.",
    estadoPostulacion: "No aplica.",
    errores:
      "Rate limit conservador (6 req/min) porque el feed completo es pesado y la fuente penaliza el abuso.",
    estado: [
      "Busqueda: implementada y verificada.",
      "Detalle: implementado.",
      "Postulacion: no disponible en la fuente.",
    ],
    pruebas: "Verificada manualmente contra el feed real.",
  },
  adzuna: {
    resumen:
      "Agregador global con API REST oficial. Cubre mercados locales que los job boards remotos no alcanzan.",
    endpoints: [
      "GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}",
      "Parametros: what, what_exclude, where, salary_min, company, full_time, part_time, contract, results_per_page",
    ],
    autenticacion:
      "Requiere `app_id` y `app_key` propios, obtenidos en developer.adzuna.com. Se cargan desde el panel ADMIN (cifrados) o desde .env.",
    busqueda:
      "El pais se resuelve contra la lista de mercados soportados por Adzuna; si el solicitado no existe se usa el configurado por defecto.",
    detalle: "La respuesta de busqueda ya incluye descripcion, categoria, contrato y salario.",
    postulacion: "Adzuna es un agregador: la postulacion ocurre en el sitio de destino (`redirect_url`).",
    preguntas: "No aplica.",
    estadoPostulacion: "No aplica.",
    errores:
      "Sin credenciales el connector no ejecuta llamadas y reporta NOT_CONFIGURED en el health check.",
    estado: [
      "Busqueda: implementada (requiere credenciales para ejecutarse).",
      "Detalle: incluido en la busqueda.",
      "Postulacion: no disponible en la fuente.",
    ],
    pruebas: "Cubierta por las pruebas de configuracion del registro.",
  },
  greenhouse: {
    resumen:
      "ATS muy extendido. Su Job Board API publica permite leer los puestos de cada empresa y, con una API key del cliente, enviar candidaturas reales.",
    endpoints: [
      "GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true",
      "GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{id}?questions=true",
      "POST https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{id}",
    ],
    autenticacion:
      "La lectura es publica. El POST de candidaturas usa Basic Auth con la Job Board API key del cliente y multipart/form-data.",
    busqueda:
      "Se consulta un board token por empresa. Si un board falla, se registra el aviso y el resto continua.",
    detalle: "El detalle incluye contenido HTML completo y, con `questions=true`, el formulario real.",
    postulacion:
      "Implementada via POST multipart con CV y carta adjuntos. Sin API key configurada, el connector devuelve REQUIRES_USER_ACTION en lugar de simular un envio.",
    preguntas:
      "Se leen de `questions[]` y se mapean a los tipos internos (text, textarea, file, select, multiselect), respetando `required`.",
    estadoPostulacion:
      "La Job Board API no expone el estado posterior de la candidatura: el seguimiento se lleva en la base local.",
    errores:
      "Los errores de un board no invalidan a los demas. Los 4xx no se reintentan (la respuesta no cambiaria); los 429 si, con backoff.",
    estado: [
      "Busqueda: implementada y verificada con un board real.",
      "Detalle y formulario: implementados.",
      "Postulacion: implementada; requiere API key valida con permisos.",
      "Estado de la candidatura: no disponible en la API publica.",
    ],
    pruebas: "Busqueda verificada contra un board publico real; capacidades cubiertas por tests.",
  },
  lever: {
    resumen: "ATS con Postings API publica y endpoint documentado de creacion de candidaturas.",
    endpoints: [
      "GET https://api.lever.co/v0/postings/{site}?mode=json",
      "GET https://api.lever.co/v0/postings/{site}/{posting-id}?mode=json",
      "POST https://api.lever.co/v0/postings/{site}/{posting-id}?key={APIKEY}",
    ],
    autenticacion: "Lectura publica. El POST requiere API key con permisos de creacion.",
    busqueda: "Un site por empresa; los errores se aislan por site.",
    detalle:
      "Se combinan `descriptionPlain`, las `lists` (requisitos, beneficios) y `additionalPlain` en una descripcion unica.",
    postulacion:
      "Implementada via multipart con nombre, email, URLs, comentarios y CV. Sin API key devuelve REQUIRES_USER_ACTION.",
    preguntas:
      "La API publica de postings NO expone las preguntas personalizadas de cada empresa: se declaran solo los campos base documentados y el formulario se marca como no autoritativo.",
    estadoPostulacion: "No expuesto por la API publica.",
    errores:
      "El endpoint de creacion tiene rate limiting agresivo: se aplica backoff exponencial, se respeta `Retry-After` y un 429 se reporta como REQUIRES_USER_ACTION en vez de reintentar indefinidamente.",
    estado: [
      "Busqueda: implementada y verificada con un site real.",
      "Detalle: implementado.",
      "Formulario: parcial (solo campos base documentados).",
      "Postulacion: implementada; requiere API key.",
    ],
    pruebas: "Busqueda verificada contra un site publico real.",
  },
  ashby: {
    resumen:
      "ATS moderno con job board publico por empresa y API privada para el envio de candidaturas.",
    endpoints: [
      "GET https://api.ashbyhq.com/posting-api/job-board/{jobBoardName}?includeCompensation=true",
      "POST https://api.ashbyhq.com/applicationForm.info (API key)",
      "POST https://api.ashbyhq.com/applicationForm.submit (API key)",
    ],
    autenticacion:
      "El job board es publico. `applicationForm.submit` requiere API key con permiso `candidatesWrite`.",
    busqueda: "Se filtran las ofertas con `isListed === false`. Un board caido no afecta al resto.",
    detalle: "Incluye compensacion estructurada, ubicaciones secundarias y flag de remoto.",
    postulacion:
      "Implementada via multipart con `applicationForm` en JSON. Una API de lectura publica NO habilita el envio: sin key con `candidatesWrite` el connector devuelve REQUIRES_USER_ACTION.",
    preguntas:
      "Se obtienen de `applicationForm.info` cuando hay API key; sin credenciales el formulario se marca como no autoritativo.",
    estadoPostulacion: "No implementado.",
    errores: "Errores por board aislados; backoff estandar.",
    estado: [
      "Busqueda: implementada y verificada con un job board real.",
      "Detalle: implementado.",
      "Formulario y postulacion: implementados; requieren API key con permisos.",
    ],
    pruebas: "Busqueda verificada contra un job board publico real.",
  },
  smartrecruiters: {
    resumen:
      "ATS con Posting API publica por empresa y endpoint de configuracion que expone las screening questions.",
    endpoints: [
      "GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings",
      "GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{id}",
      "GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{uuid}/configuration",
      "POST https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{id}/candidates",
    ],
    autenticacion:
      "Lectura publica. El envio de candidaturas usa OAuth 2.0 con el scope `candidate_applications_manage`.",
    busqueda: "Soporta `q` (texto) y `country`. Multi empresa con aislamiento de errores.",
    detalle: "La descripcion se arma concatenando las secciones del `jobAd`.",
    postulacion:
      "Implementada via POST JSON con datos del candidato y respuestas. Sin access token valido devuelve REQUIRES_USER_ACTION.",
    preguntas:
      "Se leen de `/configuration` (screening questions). Es el unico ATS de la lista que expone tambien politicas de privacidad y preguntas de diversidad.",
    estadoPostulacion: "La API lo contempla; no implementado en esta version.",
    errores: "Aislamiento por empresa y backoff estandar.",
    estado: [
      "Busqueda: implementada y verificada contra una empresa real.",
      "Detalle y formulario: implementados.",
      "Postulacion: implementada; requiere OAuth con el scope correcto.",
    ],
    pruebas: "Busqueda verificada contra la Posting API real.",
  },
  workable: {
    resumen: "ATS con widget publico de cuenta que expone los puestos publicados de cada empresa.",
    endpoints: [
      "GET https://apply.workable.com/api/v1/widget/accounts/{subdomain}?details=true",
    ],
    autenticacion:
      "El widget es publico. La API autenticada (SPI v3) requiere token del cliente y no se usa en esta version.",
    busqueda: "Un subdominio por empresa; filtrado local de palabras clave y exclusiones.",
    detalle: "Se combinan descripcion, requisitos y beneficios.",
    postulacion:
      "No implementada: el envio requiere la API autenticada del cliente. Se deriva al formulario original.",
    preguntas: "No disponibles por el widget publico.",
    estadoPostulacion: "No aplica.",
    errores: "Un subdominio inexistente devuelve 404 y queda como aviso, sin cortar la busqueda.",
    estado: [
      "Busqueda: implementada (requiere cargar subdominios).",
      "Detalle: implementado.",
      "Postulacion: no implementada (requiere credenciales del cliente).",
    ],
    pruebas: "Estructura de respuesta verificada contra una cuenta real.",
  },
  workday: {
    resumen:
      "Workday no tiene una API publica universal: cada empresa expone su propio career site (tenant). La integracion es por empresa y de solo lectura.",
    endpoints: [
      "POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs",
      'Cuerpo: { "appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "" }',
    ],
    autenticacion: "No requiere para el listado publico del career site.",
    busqueda:
      "Se pagina de a 20 resultados hasta cubrir el limite pedido, con un tope duro para no hacer scraping agresivo. El career site se configura con su URL completa.",
    detalle:
      "El listado entrega titulo, ubicaciones y fecha, pero NO la descripcion completa: el usuario debe abrir la oferta original. Esto se informa como aviso en cada busqueda.",
    postulacion:
      "No existe API publica de postulacion. Requiere el flujo propio del tenant (cuenta de candidato), por lo que se marca como BROWSER_APPLICATION y se deriva al usuario.",
    preguntas: "No disponibles.",
    estadoPostulacion: "No aplica.",
    errores: "Rate limit conservador (6 req/min) y aislamiento por tenant.",
    estado: [
      "Busqueda: implementada y verificada contra un career site real.",
      "Detalle completo: no disponible en el endpoint de listado.",
      "Postulacion: requiere navegador e intervencion humana.",
    ],
    pruebas: "Parseo de la URL del career site cubierto por el codigo del connector.",
  },
  recruitee: {
    resumen: "ATS con feed publico de ofertas por empresa.",
    endpoints: ["GET https://{company}.recruitee.com/api/offers/"],
    autenticacion: "El feed publico no requiere autenticacion (el endpoint api.recruitee.com si).",
    busqueda: "Un subdominio por empresa; filtrado local.",
    detalle: "Incluye descripcion, requisitos, ubicacion, tipo de empleo y tags.",
    postulacion: "No implementada: se deriva a la careers page de la empresa.",
    preguntas: "No disponibles por el feed publico.",
    estadoPostulacion: "No aplica.",
    errores: "Un subdominio inexistente devuelve 404 y queda como aviso.",
    estado: [
      "Busqueda: implementada segun la documentacion oficial del feed publico.",
      "Detalle: implementado.",
      "Postulacion: no implementada.",
      "Pendiente: validar el mapeo con un tenant real en produccion.",
    ],
    pruebas: "Mapeo defensivo; pendiente de validacion con un tenant real.",
  },
  bamboohr: {
    resumen: "ATS con listado publico de la careers page de cada empresa.",
    endpoints: ["GET https://{company}.bamboohr.com/careers/list"],
    autenticacion: "No requiere para el listado publico.",
    busqueda: "Un subdominio por empresa; filtrado local.",
    detalle:
      "BambooHR no publica un contrato formal para este endpoint, por lo que el mapeo prueba varios nombres de campo y descarta la oferta si falta id o titulo.",
    postulacion: "No implementada: se deriva a la careers page.",
    preguntas: "No disponibles.",
    estadoPostulacion: "No aplica.",
    errores: "Respuestas no esperadas se descartan sin romper la busqueda.",
    estado: [
      "Busqueda: implementada con mapeo defensivo.",
      "Postulacion: no implementada.",
      "Pendiente: validar los nombres de campo con un tenant que tenga vacantes publicadas.",
    ],
    pruebas: "Forma de la respuesta ({ meta, result[] }) verificada contra tenants reales.",
  },
  personio: {
    resumen: "ATS con feed XML publico en la careers page de cada empresa.",
    endpoints: ["GET https://{company}.jobs.personio.de/xml"],
    autenticacion: "No requiere.",
    busqueda: "Un subdominio por empresa. El XML se parsea sin dependencias externas.",
    detalle:
      "Cada `<position>` incluye oficina, departamento, tipo de empleo, seniority y las secciones de descripcion en CDATA.",
    postulacion: "No implementada: se deriva a la careers page.",
    preguntas: "No disponibles.",
    estadoPostulacion: "No aplica.",
    errores: "Un XML vacio o invalido no rompe la busqueda.",
    estado: [
      "Busqueda: implementada y verificada contra un feed real.",
      "Detalle: implementado.",
      "Postulacion: no implementada.",
    ],
    pruebas: "Estructura `<workzag-jobs><position>` verificada contra un feed real.",
  },
  teamtailor: {
    resumen:
      "ATS sin feed publico: la lectura de ofertas requiere una API key emitida por cada empresa.",
    endpoints: [
      "GET https://api.teamtailor.com/v1/jobs?page[size]=100",
      "Cabeceras: Authorization: Token token=<API_KEY>, X-Api-Version: <fecha>",
    ],
    autenticacion: "Obligatoria: API key de la cuenta de Teamtailor.",
    busqueda: "Formato JSON:API. Sin API key el connector queda NOT_CONFIGURED.",
    detalle: "Incluye cuerpo del aviso, estado remoto y tags.",
    postulacion: "No implementada: se deriva al portal de la empresa.",
    preguntas: "No implementadas.",
    estadoPostulacion: "No aplica.",
    errores: "Sin credenciales no se ejecuta ninguna llamada.",
    estado: [
      "Busqueda: implementada segun la documentacion oficial; requiere API key para ejecutarse.",
      "Postulacion: no implementada.",
    ],
    pruebas: "Cubierta por las pruebas de configuracion del registro.",
  },
  breezy: {
    resumen: "ATS con feed JSON publico en la careers page de cada empresa.",
    endpoints: ["GET https://{company}.breezy.hr/json"],
    autenticacion: "No requiere.",
    busqueda: "Un subdominio por empresa; filtrado local.",
    detalle: "Array plano de posiciones con tipo, experiencia, ubicacion y descripcion HTML.",
    postulacion: "No implementada: se deriva al portal de Breezy.",
    preguntas: "No disponibles.",
    estadoPostulacion: "No aplica.",
    errores: "Un subdominio inexistente devuelve HTML en vez de JSON y queda como aviso.",
    estado: [
      "Busqueda: implementada y verificada contra un feed real.",
      "Detalle: implementado.",
      "Postulacion: no implementada.",
    ],
    pruebas: "Forma de la respuesta verificada contra un feed real.",
  },
  upwork: {
    resumen:
      "Marketplace freelance con API GraphQL oficial. Requiere una aplicacion aprobada por Upwork y OAuth 2.0.",
    endpoints: [
      "POST https://api.upwork.com/graphql",
      "Query: marketplaceJobPostings(marketPlaceJobFilter, first)",
    ],
    autenticacion:
      "OAuth 2.0 con access token. Opcionalmente se envia `X-Upwork-API-TenantId` cuando la cuenta lo requiere.",
    busqueda:
      "Filtro por texto (`searchExpression_eq`). Sin access token el connector no ejecuta llamadas ni devuelve datos inventados.",
    detalle: "Incluye presupuesto fijo o por hora, skills, duracion y datos del cliente.",
    postulacion:
      "NO implementada. El envio de proposals depende de permisos explicitos de la aplicacion aprobada: tener lectura no habilita escribir. Se devuelve REQUIRES_USER_ACTION.",
    preguntas: "No implementadas.",
    estadoPostulacion: "No implementado.",
    errores: "Los errores GraphQL se devuelven como avisos de la busqueda.",
    estado: [
      "Busqueda: implementada segun la documentacion oficial; requiere credenciales para ejecutarse.",
      "Postulacion: deliberadamente no automatizada.",
    ],
    pruebas: "Cubierta por las pruebas de configuracion del registro.",
  },
  freelancer: {
    resumen: "Marketplace freelance con API REST oficial y sandbox de pruebas.",
    endpoints: [
      "GET https://www.freelancer.com/api/projects/0.1/projects/active/",
      "Cabecera: freelancer-oauth-v1: <access token>",
      "Sandbox: https://www.freelancer-sandbox.com/api/projects/0.1",
    ],
    autenticacion: "OAuth token propio enviado por cabecera.",
    busqueda: "Parametros `query`, `limit`, `job_details`, `full_description`.",
    detalle: "Incluye presupuesto, moneda, skills, ubicacion del cliente y estadisticas de bids.",
    postulacion:
      "NO implementada. El envio de bids requiere un token con permisos de escritura verificados; se devuelve REQUIRES_USER_ACTION.",
    preguntas: "No aplica.",
    estadoPostulacion: "No implementado.",
    errores: "Sin token el connector no ejecuta llamadas.",
    estado: [
      "Busqueda: implementada segun la documentacion oficial; requiere token.",
      "Postulacion: deliberadamente no automatizada.",
    ],
    pruebas: "Cubierta por las pruebas de configuracion del registro.",
  },
  jobgether: {
    resumen:
      "Jobgether no publica una API abierta documentada. El connector existe en el registro con estado UNKNOWN y no ejecuta ninguna llamada.",
    endpoints: ["Ninguno implementado."],
    autenticacion: "Desconocida.",
    busqueda: "No implementada. La busqueda devuelve una lista vacia con un aviso explicito.",
    detalle: "No implementado.",
    postulacion: "No implementada.",
    preguntas: "No aplica.",
    estadoPostulacion: "No aplica.",
    errores: "No aplica: no se realizan llamadas.",
    estado: [
      "Pendiente: confirmar con la fuente si existe una API publica y bajo que condiciones de uso.",
      "No se hace scraping: si no hay API oficial utilizable, la fuente permanece deshabilitada.",
    ],
    pruebas: "Cubierta por la prueba de coherencia del registro.",
  },
  pinpoint: {
    resumen:
      "ATS cuya API exige una API key emitida por cada cliente. No se encontro un feed publico verificable.",
    endpoints: ["Pendientes de verificar con una cuenta real."],
    autenticacion: "API key por cliente.",
    busqueda: "No implementada: el connector queda NOT_CONFIGURED.",
    detalle: "No implementado.",
    postulacion: "No implementada.",
    preguntas: "No aplica.",
    estadoPostulacion: "No aplica.",
    errores: "No aplica: no se realizan llamadas.",
    estado: [
      "Pendiente: validar endpoints y autenticacion con una cuenta real antes de habilitar.",
      "No se implementan endpoints no verificados.",
    ],
    pruebas: "Cubierta por la prueba de coherencia del registro.",
  },
};

const CAPABILITY_LABELS = {
  search: "Busqueda",
  jobDetails: "Detalle de la oferta",
  applicationForm: "Formulario de postulacion",
  apply: "Envio de candidatura",
  applicationStatus: "Estado de la candidatura",
  oauth: "OAuth",
  apiKey: "API key",
  browserAutomationRequired: "Requiere navegador",
  resumeUpload: "Adjuntar CV",
  coverLetterUpload: "Adjuntar carta",
  customQuestions: "Preguntas personalizadas",
};

const MODE_LABELS = {
  SEARCH_ONLY: "SEARCH_ONLY — solo busqueda",
  API_APPLICATION: "API_APPLICATION — permite postular por API oficial",
  BROWSER_APPLICATION: "BROWSER_APPLICATION — requiere navegador",
  HUMAN_REQUIRED: "HUMAN_REQUIRED — requiere intervencion humana",
  UNKNOWN: "UNKNOWN — pendiente de verificacion",
};

function table(rows) {
  return ["| Capacidad | Soportada |", "| --- | --- |", ...rows].join("\n");
}

function render(connector, detail) {
  const capabilities = connector.getCapabilities();
  const capabilityRows = Object.entries(CAPABILITY_LABELS).map(
    ([key, label]) => `| ${label} | ${capabilities[key] ? "Si" : "No"} |`,
  );

  const settings = connector.settingsSchema.length
    ? connector.settingsSchema
        .map(
          (field) =>
            `- \`${field.key}\` — ${field.label}${field.required ? " (obligatorio)" : " (opcional)"}${field.help ? `. ${field.help}` : ""}`,
        )
        .join("\n")
    : "- No requiere configuracion: funciona apenas se habilita.";

  return `# ${connector.name}

> Documento generado por \`scripts/generate-docs.mjs\` a partir del connector
> \`server/src/connectors/${connector.id}.ts\`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

${detail.resumen}

- **Categoria:** ${connector.category}
- **Modo de integracion:** ${MODE_LABELS[connector.mode] ?? connector.mode}
- **Sitio:** ${connector.homepage}

## Official Documentation

${connector.docsUrl}

## Authentication

${detail.autenticacion}

### Configuracion requerida en el panel ADMIN

${settings}

## Endpoints

${detail.endpoints.map((endpoint) => `- \`${endpoint}\``).join("\n")}

## Search

${detail.busqueda}

## Job Detail

${detail.detalle}

## Application

${detail.postulacion}

## Application Questions

${detail.preguntas}

## Application Status

${detail.estadoPostulacion}

## Rate Limits

- ${connector.rateLimit.requestsPerMinute} requests por minuto
- ${connector.rateLimit.requestsPerHour} requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

${detail.errores}

## Capabilities

${table(capabilityRows)}

## Terms / Restrictions

${
  connector.restrictions?.length
    ? connector.restrictions.map((restriction) => `- ${restriction}`).join("\n")
    : "- Sin restricciones particulares declaradas por la fuente."
}
${connector.attribution ? `\n**Atribucion obligatoria:** ${connector.attribution}\n` : ""}
## Implementation Status

${detail.estado.map((item) => `- ${item}`).join("\n")}

## Tests

${detail.pruebas}
`;
}

mkdirSync(OUT_DIR, { recursive: true });

const generated = [];
const missing = [];

for (const connector of connectorRegistry.list()) {
  const detail = DETAILS[connector.id];
  if (!detail) {
    missing.push(connector.id);
    continue;
  }
  const file = join(OUT_DIR, `${connector.id}.md`);
  writeFileSync(file, render(connector, detail), "utf8");
  generated.push(connector.id);
}

/* Indice ---------------------------------------------------------------- */

const rows = connectorRegistry
  .list()
  .filter((connector) => DETAILS[connector.id])
  .map((connector) => {
    const capabilities = connector.getCapabilities();
    return `| [${connector.name}](${connector.id}.md) | ${connector.category} | ${connector.mode} | ${capabilities.search ? "Si" : "No"} | ${capabilities.apply ? "Si" : "No"} | ${connector.settingsSchema.some((field) => field.required) ? "Si" : "No"} |`;
  });

writeFileSync(
  join(OUT_DIR, "README.md"),
  `# Integraciones

Estado real de cada fuente integrada en JobHunter AI. Este indice se genera con
\`node scripts/generate-docs.mjs\` a partir del registro de connectors, asi que
refleja siempre lo que el codigo hace de verdad.

Convenciones de estado:

- \`SEARCH_ONLY\`: la fuente permite buscar, no postular.
- \`API_APPLICATION\`: permite enviar la candidatura por API oficial (con credenciales validas).
- \`BROWSER_APPLICATION\`: requiere completar el formulario en el navegador.
- \`HUMAN_REQUIRED\`: requiere intervencion humana.
- \`UNKNOWN\`: pendiente de verificar documentacion oficial vigente.

| Fuente | Categoria | Modo | Busqueda | Postulacion por API | Requiere credenciales |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Regla de honestidad

Ninguna fuente declara una capacidad que no este implementada y verificada.
Cuando una plataforma no documenta publicamente un endpoint, el connector queda
en \`UNKNOWN\` y no ejecuta llamadas: preferimos una fuente deshabilitada antes
que datos inventados o scraping no autorizado.
`,
  "utf8",
);

console.log(`Documentacion generada para ${generated.length} connectors en docs/integrations/`);
if (missing.length) {
  console.warn(`Sin detalle narrativo (revisar DETAILS): ${missing.join(", ")}`);
  process.exitCode = 1;
}
