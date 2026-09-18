# Workable

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/workable.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS con widget publico de cuenta que expone los puestos publicados de cada empresa.

- **Categoria:** ats
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://www.workable.com

## Official Documentation

https://workable.readme.io/reference/generate-an-access-token

## Authentication

El widget es publico. La API autenticada (SPI v3) requiere token del cliente y no se usa en esta version.

### Configuracion requerida en el panel ADMIN

- `accounts` — subdominios (obligatorio). Subdominio que aparece en apply.workable.com/{subdominio}

## Endpoints

- `GET https://apply.workable.com/api/v1/widget/accounts/{subdomain}?details=true`

## Search

Un subdominio por empresa; filtrado local de palabras clave y exclusiones.

## Job Detail

Se combinan descripcion, requisitos y beneficios.

## Application

No implementada: el envio requiere la API autenticada del cliente. Se deriva al formulario original.

## Application Questions

No disponibles por el widget publico.

## Application Status

No aplica.

## Rate Limits

- 15 requests por minuto
- 250 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Un subdominio inexistente devuelve 404 y queda como aviso, sin cortar la busqueda.

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

- El widget publico solo permite lectura. El envio de candidaturas requiere la API autenticada del cliente.

## Implementation Status

- Busqueda: implementada (requiere cargar subdominios).
- Detalle: implementado.
- Postulacion: no implementada (requiere credenciales del cliente).

## Tests

Estructura de respuesta verificada contra una cuenta real.
