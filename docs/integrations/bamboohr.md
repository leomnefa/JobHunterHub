# BambooHR

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/bamboohr.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS con listado publico de la careers page de cada empresa.

- **Categoria:** ats
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://www.bamboohr.com

## Official Documentation

https://documentation.bamboohr.com/reference/get-applicant-tracking-jobs

## Authentication

No requiere para el listado publico.

### Configuracion requerida en el panel ADMIN

- `companies` — empresas (obligatorio). Subdominio que aparece en {empresa}.bamboohr.com/careers

## Endpoints

- `GET https://{company}.bamboohr.com/careers/list`

## Search

Un subdominio por empresa; filtrado local.

## Job Detail

BambooHR no publica un contrato formal para este endpoint, por lo que el mapeo prueba varios nombres de campo y descarta la oferta si falta id o titulo.

## Application

No implementada: se deriva a la careers page.

## Application Questions

No disponibles.

## Application Status

No aplica.

## Rate Limits

- 10 requests por minuto
- 150 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Respuestas no esperadas se descartan sin romper la busqueda.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | Si |
| Detalle de la oferta | Si |
| Formulario de postulacion | No |
| Envio de candidatura | No |
| Estado de la candidatura | No |
| OAuth | No |
| API key | No |
| Requiere navegador | No |
| Adjuntar CV | No |
| Adjuntar carta | No |
| Preguntas personalizadas | No |

## Terms / Restrictions

- El listado publico de careers no tiene contrato documentado: el mapeo es defensivo y puede requerir ajuste por tenant.
- La postulacion se completa en la careers page de la empresa.

## Implementation Status

- Busqueda: implementada con mapeo defensivo.
- Postulacion: no implementada.
- Pendiente: validar los nombres de campo con un tenant que tenga vacantes publicadas.

## Tests

Forma de la respuesta ({ meta, result[] }) verificada contra tenants reales.
