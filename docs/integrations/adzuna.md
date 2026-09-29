# Adzuna

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/adzuna.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Agregador global con API REST oficial. Cubre mercados locales que los job boards remotos no alcanzan.

- **Categoria:** aggregator
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://www.adzuna.com

## Official Documentation

https://developer.adzuna.com/

## Authentication

Requiere `app_id` y `app_key` propios, obtenidos en developer.adzuna.com. Se cargan desde el panel ADMIN (cifrados) o desde .env.

### Configuracion requerida en el panel ADMIN

- `app_id` — App ID (obligatorio). developer.adzuna.com
- `app_key` — App Key (obligatorio)
- `country` — Pais por defecto (opcional). Codigo ISO de 2 letras: us, gb, es, de, br, mx, ...

## Endpoints

- `GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}`
- `Parametros: what, what_exclude, where, salary_min, company, full_time, part_time, contract, results_per_page`

## Search

El pais se resuelve contra la lista de mercados soportados por Adzuna; si el solicitado no existe se usa el configurado por defecto.

## Job Detail

La respuesta de busqueda ya incluye descripcion, categoria, contrato y salario.

## Application

Adzuna es un agregador: la postulacion ocurre en el sitio de destino (`redirect_url`).

## Application Questions

No aplica.

## Application Status

No aplica.

## Rate Limits

- 25 requests por minuto
- 250 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Sin credenciales el connector no ejecuta llamadas y reporta NOT_CONFIGURED en el health check.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | Si |
| Detalle de la oferta | No |
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

- Requiere app_id y app_key propios, sujetos a los limites del plan contratado.
- Las credenciales nunca deben exponerse en el frontend.

**Atribucion obligatoria:** Ofertas provistas por Adzuna

## Implementation Status

- Busqueda: implementada (requiere credenciales para ejecutarse).
- Detalle: incluido en la busqueda.
- Postulacion: no disponible en la fuente.

## Tests

Cubierta por las pruebas de configuracion del registro.
