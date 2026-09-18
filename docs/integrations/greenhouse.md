# Greenhouse

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/greenhouse.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS muy extendido. Su Job Board API publica permite leer los puestos de cada empresa y, con una API key del cliente, enviar candidaturas reales.

- **Categoria:** ats
- **Modo de integracion:** API_APPLICATION — permite postular por API oficial
- **Sitio:** https://www.greenhouse.io

## Official Documentation

https://docs.greenhouse.io/job-board.html

## Authentication

La lectura es publica. El POST de candidaturas usa Basic Auth con la Job Board API key del cliente y multipart/form-data.

### Configuracion requerida en el panel ADMIN

- `board_tokens` — Board tokens (obligatorio). Un token por empresa. Aparece en la URL del job board publico.
- `api_key` — Job Board API key (opcional). Solo necesaria para ENVIAR candidaturas por API (Basic Auth).

## Endpoints

- `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true`
- `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{id}?questions=true`
- `POST https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{id}`

## Search

Se consulta un board token por empresa. Si un board falla, se registra el aviso y el resto continua.

## Job Detail

El detalle incluye contenido HTML completo y, con `questions=true`, el formulario real.

## Application

Implementada via POST multipart con CV y carta adjuntos. Sin API key configurada, el connector devuelve REQUIRES_USER_ACTION en lugar de simular un envio.

## Application Questions

Se leen de `questions[]` y se mapean a los tipos internos (text, textarea, file, select, multiselect), respetando `required`.

## Application Status

La Job Board API no expone el estado posterior de la candidatura: el seguimiento se lleva en la base local.

## Rate Limits

- 30 requests por minuto
- 600 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Los errores de un board no invalidan a los demas. Los 4xx no se reintentan (la respuesta no cambiaria); los 429 si, con backoff.

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

- La lectura del job board es publica; el envio de candidaturas exige Basic Auth con la Job Board API key del cliente.
- La API key jamas debe exponerse en el frontend: todo el envio pasa por el backend.

## Implementation Status

- Busqueda: implementada y verificada con un board real.
- Detalle y formulario: implementados.
- Postulacion: implementada; requiere API key valida con permisos.
- Estado de la candidatura: no disponible en la API publica.

## Tests

Busqueda verificada contra un board publico real; capacidades cubiertas por tests.
