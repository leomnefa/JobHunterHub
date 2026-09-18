# Himalayas

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/himalayas.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Job board de trabajos 100% remotos con API publica sin autenticacion. Es una de las fuentes mas productivas del sistema.

- **Categoria:** job_board
- **Modo de integracion:** SEARCH_ONLY — solo busqueda
- **Sitio:** https://himalayas.app

## Official Documentation

https://himalayas.app/api

## Authentication

No requiere. Es una API publica de lectura.

### Configuracion requerida en el panel ADMIN

- No requiere configuracion: funciona apenas se habilita.

## Endpoints

- `GET https://himalayas.app/jobs/api?limit=20 — feed general`
- `GET https://himalayas.app/jobs/api/search?query=...&limit=20 — busqueda por texto`
- `Parametros soportados: limit, query, cursor, country, worldwide, company`

## Search

Se usa /search cuando hay palabras clave y el feed general cuando no. La paginacion es por cursor (`nextCursor`); el parametro `offset` esta deprecado segun el aviso que devuelve la propia API.

## Job Detail

El feed ya incluye la descripcion completa, el rango salarial, el seniority y las restricciones de ubicacion y huso horario, por lo que no hace falta una segunda llamada.

## Application

No existe endpoint de postulacion. El usuario es derivado a `applicationLink`, la URL original de la oferta.

## Application Questions

No aplica: la fuente no expone formularios de postulacion.

## Application Status

No aplica.

## Rate Limits

- 20 requests por minuto
- 400 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Los 429 se reintentan con backoff exponencial y jitter respetando `Retry-After`. Un fallo de esta fuente no afecta al resto de la busqueda.

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

- Prohibido redistribuir las ofertas a Google Jobs, LinkedIn Jobs, Jooble o agregadores similares.
- Requiere atribucion visible a Himalayas junto a los resultados.
- Maximo 20 ofertas por request; usar cursor para paginar.

**Atribucion obligatoria:** Ofertas provistas por Himalayas (himalayas.app)

## Implementation Status

- Busqueda: implementada y verificada contra la API en produccion.
- Detalle: implementado (se resuelve desde el feed por `guid`).
- Postulacion: no disponible en la fuente.

## Tests

Cubierta por las pruebas del registro (`server/test/services.test.ts`) y verificada manualmente contra la API real.
