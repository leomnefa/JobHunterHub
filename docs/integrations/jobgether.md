# Jobgether

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/jobgether.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Jobgether no publica una API abierta documentada. El connector existe en el registro con estado UNKNOWN y no ejecuta ninguna llamada.

- **Categoria:** job_board
- **Modo de integracion:** UNKNOWN — pendiente de verificacion
- **Sitio:** https://jobgether.com

## Official Documentation

https://jobgether.com

## Authentication

Desconocida.

### Configuracion requerida en el panel ADMIN

- No requiere configuracion: funciona apenas se habilita.

## Endpoints

- `Ninguno implementado.`

## Search

No implementada. La busqueda devuelve una lista vacia con un aviso explicito.

## Job Detail

No implementado.

## Application

No implementada.

## Application Questions

No aplica.

## Application Status

No aplica.

## Rate Limits

- 5 requests por minuto
- 50 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

No aplica: no se realizan llamadas.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | No |
| Detalle de la oferta | No |
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

- Jobgether no publica una API abierta documentada. Pendiente de confirmar endpoints y condiciones de uso con la fuente antes de implementar; no se hace scraping.

## Implementation Status

- Pendiente: confirmar con la fuente si existe una API publica y bajo que condiciones de uso.
- No se hace scraping: si no hay API oficial utilizable, la fuente permanece deshabilitada.

## Tests

Cubierta por la prueba de coherencia del registro.
