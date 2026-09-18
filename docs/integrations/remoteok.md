# Remote OK

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/remoteok.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Feed publico de Remote OK. El primer elemento del array es un aviso legal, no una oferta, y se descarta explicitamente.

- **Categoria:** job_board
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://remoteok.com

## Official Documentation

https://remoteok.com/api

## Authentication

No requiere, pero exige un User-Agent identificable: sin el, la fuente suele responder 403.

### Configuracion requerida en el panel ADMIN

- No requiere configuracion: funciona apenas se habilita.

## Endpoints

- `GET https://remoteok.com/api`

## Search

El feed no acepta filtros del lado del servidor: se descarga completo y se filtra localmente por palabras clave, exclusiones y salario.

## Job Detail

Incluye descripcion, tags, ubicacion y rango salarial cuando la oferta lo publica.

## Application

Sin API de postulacion; se deriva a `apply_url` o a la URL de la oferta.

## Application Questions

No aplica.

## Application Status

No aplica.

## Rate Limits

- 6 requests por minuto
- 60 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Rate limit conservador (6 req/min) porque el feed completo es pesado y la fuente penaliza el abuso.

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

- Obligatorio enlazar de vuelta a Remote OK sin nofollow y mencionarlo como fuente.
- Prohibido usar el logo de Remote OK sin permiso escrito.

**Atribucion obligatoria:** Ofertas provistas por Remote OK (remoteok.com)

## Implementation Status

- Busqueda: implementada y verificada.
- Detalle: implementado.
- Postulacion: no disponible en la fuente.

## Tests

Verificada manualmente contra el feed real.
