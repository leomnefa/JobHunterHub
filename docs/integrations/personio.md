# Personio

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/personio.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS con feed XML publico en la careers page de cada empresa.

- **Categoria:** ats
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://www.personio.com

## Official Documentation

https://developer.personio.de/docs/using-the-xml-feed

## Authentication

No requiere.

### Configuracion requerida en el panel ADMIN

- `companies` — empresas (obligatorio). Subdominio que aparece en {empresa}.jobs.personio.de

## Endpoints

- `GET https://{company}.jobs.personio.de/xml`

## Search

Un subdominio por empresa. El XML se parsea sin dependencias externas.

## Job Detail

Cada `<position>` incluye oficina, departamento, tipo de empleo, seniority y las secciones de descripcion en CDATA.

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

Un XML vacio o invalido no rompe la busqueda.

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

- Feed XML publico de solo lectura; la postulacion ocurre en la careers page.

## Implementation Status

- Busqueda: implementada y verificada contra un feed real.
- Detalle: implementado.
- Postulacion: no implementada.

## Tests

Estructura `<workzag-jobs><position>` verificada contra un feed real.
