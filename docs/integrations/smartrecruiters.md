# SmartRecruiters

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/smartrecruiters.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS con Posting API publica por empresa y endpoint de configuracion que expone las screening questions.

- **Categoria:** ats
- **Modo de integracion:** API_APPLICATION — permite postular por API oficial
- **Sitio:** https://www.smartrecruiters.com

## Official Documentation

https://developers.smartrecruiters.com/reference/postings

## Authentication

Lectura publica. El envio de candidaturas usa OAuth 2.0 con el scope `candidate_applications_manage`.

### Configuracion requerida en el panel ADMIN

- `companies` — Identificadores de empresa (obligatorio). Aparece en jobs.smartrecruiters.com/{companyId}
- `access_token` — OAuth access token (opcional)
- `refresh_token` — OAuth refresh token (opcional)
- `client_id` — Client ID (opcional)
- `client_secret` — Client Secret (opcional)

## Endpoints

- `GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings`
- `GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{id}`
- `GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{uuid}/configuration`
- `POST https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{id}/candidates`

## Search

Soporta `q` (texto) y `country`. Multi empresa con aislamiento de errores.

## Job Detail

La descripcion se arma concatenando las secciones del `jobAd`.

## Application

Implementada via POST JSON con datos del candidato y respuestas. Sin access token valido devuelve REQUIRES_USER_ACTION.

## Application Questions

Se leen de `/configuration` (screening questions). Es el unico ATS de la lista que expone tambien politicas de privacidad y preguntas de diversidad.

## Application Status

La API lo contempla; no implementado en esta version.

## Rate Limits

- 20 requests por minuto
- 400 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Aislamiento por empresa y backoff estandar.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | Si |
| Detalle de la oferta | Si |
| Formulario de postulacion | Si |
| Envio de candidatura | Si |
| Estado de la candidatura | No |
| OAuth | Si |
| API key | No |
| Requiere navegador | No |
| Adjuntar CV | Si |
| Adjuntar carta | Si |
| Preguntas personalizadas | Si |

## Terms / Restrictions

- La Posting API de lectura es publica; el envio de candidaturas requiere OAuth 2.0 con scope candidate_applications_manage.
- El token de acceso se guarda cifrado en el backend y nunca se envia al frontend.

## Implementation Status

- Busqueda: implementada y verificada contra una empresa real.
- Detalle y formulario: implementados.
- Postulacion: implementada; requiere OAuth con el scope correcto.

## Tests

Busqueda verificada contra la Posting API real.
