# Breezy HR

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/breezy.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS con feed JSON publico en la careers page de cada empresa.

- **Categoria:** ats
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://breezy.hr

## Official Documentation

https://developer.breezy.hr/docs

## Authentication

No requiere.

### Configuracion requerida en el panel ADMIN

- `companies` — empresas (obligatorio). Subdominio que aparece en {empresa}.breezy.hr

## Endpoints

- `GET https://{company}.breezy.hr/json`

## Search

Un subdominio por empresa; filtrado local.

## Job Detail

Array plano de posiciones con tipo, experiencia, ubicacion y descripcion HTML.

## Application

No implementada: se deriva al portal de Breezy.

## Application Questions

No disponibles.

## Application Status

No aplica.

## Rate Limits

- 12 requests por minuto
- 200 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Un subdominio inexistente devuelve HTML en vez de JSON y queda como aviso.

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

- Feed publico de solo lectura; la postulacion se completa en el portal de Breezy.

## Implementation Status

- Busqueda: implementada y verificada contra un feed real.
- Detalle: implementado.
- Postulacion: no implementada.

## Tests

Forma de la respuesta verificada contra un feed real.
