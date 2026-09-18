# Lever

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/lever.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS con Postings API publica y endpoint documentado de creacion de candidaturas.

- **Categoria:** ats
- **Modo de integracion:** API_APPLICATION — permite postular por API oficial
- **Sitio:** https://www.lever.co

## Official Documentation

https://github.com/lever/postings-api

## Authentication

Lectura publica. El POST requiere API key con permisos de creacion.

### Configuracion requerida en el panel ADMIN

- `sites` — Sites de Lever (obligatorio). Identificador que aparece en jobs.lever.co/{site}
- `api_key` — API key de postulacion (opcional). Solo para enviar candidaturas por API.

## Endpoints

- `GET https://api.lever.co/v0/postings/{site}?mode=json`
- `GET https://api.lever.co/v0/postings/{site}/{posting-id}?mode=json`
- `POST https://api.lever.co/v0/postings/{site}/{posting-id}?key={APIKEY}`

## Search

Un site por empresa; los errores se aislan por site.

## Job Detail

Se combinan `descriptionPlain`, las `lists` (requisitos, beneficios) y `additionalPlain` en una descripcion unica.

## Application

Implementada via multipart con nombre, email, URLs, comentarios y CV. Sin API key devuelve REQUIRES_USER_ACTION.

## Application Questions

La API publica de postings NO expone las preguntas personalizadas de cada empresa: se declaran solo los campos base documentados y el formulario se marca como no autoritativo.

## Application Status

No expuesto por la API publica.

## Rate Limits

- 20 requests por minuto
- 400 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

El endpoint de creacion tiene rate limiting agresivo: se aplica backoff exponencial, se respeta `Retry-After` y un 429 se reporta como REQUIRES_USER_ACTION en vez de reintentar indefinidamente.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | Si |
| Detalle de la oferta | Si |
| Formulario de postulacion | Si |
| Envio de candidatura | Si |
| Estado de la candidatura | No |
| OAuth | No |
| API key | Si |
| Requiere navegador | No |
| Adjuntar CV | Si |
| Adjuntar carta | Si |
| Preguntas personalizadas | Si |

## Terms / Restrictions

- El endpoint de creacion de candidaturas esta sujeto a rate limiting; se aplica backoff exponencial y se respeta Retry-After.
- Las preguntas personalizadas de cada empresa no se exponen en la API publica de postings.

## Implementation Status

- Busqueda: implementada y verificada con un site real.
- Detalle: implementado.
- Formulario: parcial (solo campos base documentados).
- Postulacion: implementada; requiere API key.

## Tests

Busqueda verificada contra un site publico real.
