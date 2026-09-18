# Jobicy

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/jobicy.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Agregador de trabajo remoto con API publica v2. Devuelve hasta 200 ofertas por request con descripcion completa.

- **Categoria:** job_board
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://jobicy.com

## Official Documentation

https://jobi.cy/apidocs

## Authentication

No requiere API key al momento de la implementacion.

### Configuracion requerida en el panel ADMIN

- No requiere configuracion: funciona apenas se habilita.

## Endpoints

- `GET https://jobicy.com/api/v2/remote-jobs?count=200`
- `Parametros soportados: count, tag (texto libre), geo (region), industry`

## Search

Las palabras clave se envian en `tag` y el pais en `geo` normalizado a minusculas con guiones. El filtrado por salario y las exclusiones se aplican localmente.

## Job Detail

La respuesta incluye `jobDescription` completo, salario anual, industria y geo.

## Application

No hay endpoint de postulacion. Se deriva al usuario a la URL original, tal como exige la fuente.

## Application Questions

No aplica.

## Application Status

No aplica.

## Rate Limits

- 15 requests por minuto
- 300 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Reintentos con backoff ante 429/503; el resto de las fuentes sigue funcionando.

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

- Debe acreditarse a Jobicy con un enlace directo a la fuente.
- Los botones de postulacion deben redirigir a la URL original de la oferta.

**Atribucion obligatoria:** Ofertas provistas por Jobicy (jobicy.com)

## Implementation Status

- Busqueda: implementada y verificada.
- Detalle: implementado.
- Postulacion: no disponible en la fuente.

## Tests

Verificada manualmente contra la API real durante la implementacion.
