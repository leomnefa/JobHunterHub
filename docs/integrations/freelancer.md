# Freelancer.com

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/freelancer.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Marketplace freelance con API REST oficial y sandbox de pruebas.

- **Categoria:** freelance
- **Modo de integracion:** HUMAN_REQUIRED — requiere intervencion humana
- **Sitio:** https://www.freelancer.com

## Official Documentation

https://developers.freelancer.com/docs

## Authentication

OAuth token propio enviado por cabecera.

### Configuracion requerida en el panel ADMIN

- `oauth_token` — OAuth access token (obligatorio). Se envia en la cabecera freelancer-oauth-v1.
- `sandbox` — Usar sandbox (opcional). true para apuntar a la API de pruebas de Freelancer.

## Endpoints

- `GET https://www.freelancer.com/api/projects/0.1/projects/active/`
- `Cabecera: freelancer-oauth-v1: <access token>`
- `Sandbox: https://www.freelancer-sandbox.com/api/projects/0.1`

## Search

Parametros `query`, `limit`, `job_details`, `full_description`.

## Job Detail

Incluye presupuesto, moneda, skills, ubicacion del cliente y estadisticas de bids.

## Application

NO implementada. El envio de bids requiere un token con permisos de escritura verificados; se devuelve REQUIRES_USER_ACTION.

## Application Questions

No aplica.

## Application Status

No implementado.

## Rate Limits

- 10 requests por minuto
- 200 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Sin token el connector no ejecuta llamadas.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | Si |
| Detalle de la oferta | Si |
| Formulario de postulacion | No |
| Envio de candidatura | No |
| Estado de la candidatura | No |
| OAuth | Si |
| API key | Si |
| Requiere navegador | No |
| Adjuntar CV | No |
| Adjuntar carta | No |
| Preguntas personalizadas | No |

## Terms / Restrictions

- Requiere OAuth token propio. El envio de bids necesita permisos de escritura explicitos.
- No se envian propuestas automaticas sin token con permiso verificado.

## Implementation Status

- Busqueda: implementada segun la documentacion oficial; requiere token.
- Postulacion: deliberadamente no automatizada.

## Tests

Cubierta por las pruebas de configuracion del registro.
