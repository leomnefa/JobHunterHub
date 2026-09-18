# Teamtailor

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/teamtailor.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS sin feed publico: la lectura de ofertas requiere una API key emitida por cada empresa.

- **Categoria:** ats
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://www.teamtailor.com

## Official Documentation

https://docs.teamtailor.com/

## Authentication

Obligatoria: API key de la cuenta de Teamtailor.

### Configuracion requerida en el panel ADMIN

- `companies` — empresas (obligatorio). Subdominio de la careers page: {empresa}.teamtailor.com
- `api_key` — API key de Teamtailor (obligatorio). Obligatoria: Teamtailor no publica un feed sin autenticacion.

## Endpoints

- `GET https://api.teamtailor.com/v1/jobs?page[size]=100`
- `Cabeceras: Authorization: Token token=<API_KEY>, X-Api-Version: <fecha>`

## Search

Formato JSON:API. Sin API key el connector queda NOT_CONFIGURED.

## Job Detail

Incluye cuerpo del aviso, estado remoto y tags.

## Application

No implementada: se deriva al portal de la empresa.

## Application Questions

No implementadas.

## Application Status

No aplica.

## Rate Limits

- 10 requests por minuto
- 120 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Sin credenciales no se ejecuta ninguna llamada.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | Si |
| Detalle de la oferta | Si |
| Formulario de postulacion | No |
| Envio de candidatura | No |
| Estado de la candidatura | No |
| OAuth | No |
| API key | Si |
| Requiere navegador | No |
| Adjuntar CV | No |
| Adjuntar carta | No |
| Preguntas personalizadas | No |

## Terms / Restrictions

- Requiere API key emitida por la empresa duena de la cuenta.
- El envio de candidaturas no esta implementado: se deriva al portal de la empresa.

## Implementation Status

- Busqueda: implementada segun la documentacion oficial; requiere API key para ejecutarse.
- Postulacion: no implementada.

## Tests

Cubierta por las pruebas de configuracion del registro.
