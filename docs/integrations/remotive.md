# Remotive

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/remotive.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Job board remoto con feed publico y condiciones de redistribucion explicitas.

- **Categoria:** job_board
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://remotive.com

## Official Documentation

https://github.com/remotive-com/remote-jobs-api

## Authentication

No requiere.

### Configuracion requerida en el panel ADMIN

- No requiere configuracion: funciona apenas se habilita.

## Endpoints

- `GET https://remotive.com/api/remote-jobs?limit=...&search=...`
- `El dominio remotive.io esta obsoleto: se usa remotive.com.`

## Search

Palabras clave via `search`. El salario llega como texto libre y se parsea localmente.

## Job Detail

El feed trae la descripcion completa en HTML, que se normaliza a texto plano.

## Application

No hay API de postulacion; se deriva a la URL original.

## Application Questions

No aplica.

## Application Status

No aplica.

## Rate Limits

- 10 requests por minuto
- 120 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Backoff ante 429; aislamiento por fuente.

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

- Prohibido enviar las ofertas a terceros como Jooble, Neuvoo, Google Jobs o LinkedIn Jobs.
- Debe enlazarse siempre a la URL original de la oferta en Remotive.

**Atribucion obligatoria:** Ofertas provistas por Remotive (remotive.com)

## Implementation Status

- Busqueda: implementada y verificada.
- Detalle: implementado.
- Postulacion: no disponible en la fuente.

## Tests

Verificada manualmente contra el feed real.
