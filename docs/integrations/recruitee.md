# Recruitee

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/recruitee.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS con feed publico de ofertas por empresa.

- **Categoria:** ats
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://recruitee.com

## Official Documentation

https://docs.recruitee.com/reference/offers

## Authentication

El feed publico no requiere autenticacion (el endpoint api.recruitee.com si).

### Configuracion requerida en el panel ADMIN

- `companies` — empresas (obligatorio). Subdominio que aparece en {empresa}.recruitee.com

## Endpoints

- `GET https://{company}.recruitee.com/api/offers/`

## Search

Un subdominio por empresa; filtrado local.

## Job Detail

Incluye descripcion, requisitos, ubicacion, tipo de empleo y tags.

## Application

No implementada: se deriva a la careers page de la empresa.

## Application Questions

No disponibles por el feed publico.

## Application Status

No aplica.

## Rate Limits

- 15 requests por minuto
- 250 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Un subdominio inexistente devuelve 404 y queda como aviso.

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

- Feed publico de solo lectura; la postulacion se completa en la careers page.

## Implementation Status

- Busqueda: implementada segun la documentacion oficial del feed publico.
- Detalle: implementado.
- Postulacion: no implementada.
- Pendiente: validar el mapeo con un tenant real en produccion.

## Tests

Mapeo defensivo; pendiente de validacion con un tenant real.
