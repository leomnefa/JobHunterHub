# Ashby

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/ashby.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS moderno con job board publico por empresa y API privada para el envio de candidaturas.

- **Categoria:** ats
- **Modo de integracion:** API_APPLICATION — permite postular por API oficial
- **Sitio:** https://www.ashbyhq.com

## Official Documentation

https://developers.ashbyhq.com/reference/introduction

## Authentication

El job board es publico. `applicationForm.submit` requiere API key con permiso `candidatesWrite`.

### Configuracion requerida en el panel ADMIN

- `job_boards` — Job boards (obligatorio). Nombre que aparece en jobs.ashbyhq.com/{board}
- `api_key` — API key (candidatesWrite) (opcional). Necesaria unicamente para enviar candidaturas.

## Endpoints

- `GET https://api.ashbyhq.com/posting-api/job-board/{jobBoardName}?includeCompensation=true`
- `POST https://api.ashbyhq.com/applicationForm.info (API key)`
- `POST https://api.ashbyhq.com/applicationForm.submit (API key)`

## Search

Se filtran las ofertas con `isListed === false`. Un board caido no afecta al resto.

## Job Detail

Incluye compensacion estructurada, ubicaciones secundarias y flag de remoto.

## Application

Implementada via multipart con `applicationForm` en JSON. Una API de lectura publica NO habilita el envio: sin key con `candidatesWrite` el connector devuelve REQUIRES_USER_ACTION.

## Application Questions

Se obtienen de `applicationForm.info` cuando hay API key; sin credenciales el formulario se marca como no autoritativo.

## Application Status

No implementado.

## Rate Limits

- 20 requests por minuto
- 300 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Errores por board aislados; backoff estandar.

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

- El job board publico no requiere autenticacion, pero applicationForm.submit exige API key con permiso candidatesWrite.
- No se asume que la lectura publica habilite el envio de candidaturas.

## Implementation Status

- Busqueda: implementada y verificada con un job board real.
- Detalle: implementado.
- Formulario y postulacion: implementados; requieren API key con permisos.

## Tests

Busqueda verificada contra un job board publico real.
