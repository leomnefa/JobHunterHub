# Workday

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/workday.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Workday no tiene una API publica universal: cada empresa expone su propio career site (tenant). La integracion es por empresa y de solo lectura.

- **Categoria:** ats
- **Modo de integracion:** BROWSER_APPLICATION — requiere navegador
- **Sitio:** https://www.workday.com

## Official Documentation

https://community.workday.com/

## Authentication

No requiere para el listado publico del career site.

### Configuracion requerida en el panel ADMIN

- `sites` — Career sites (obligatorio). URL completa del career site de cada empresa, una por linea.

## Endpoints

- `POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs`
- `Cuerpo: { "appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "" }`

## Search

Se pagina de a 20 resultados hasta cubrir el limite pedido, con un tope duro para no hacer scraping agresivo. El career site se configura con su URL completa.

## Job Detail

El listado entrega titulo, ubicaciones y fecha, pero NO la descripcion completa: el usuario debe abrir la oferta original. Esto se informa como aviso en cada busqueda.

## Application

No existe API publica de postulacion. Requiere el flujo propio del tenant (cuenta de candidato), por lo que se marca como BROWSER_APPLICATION y se deriva al usuario.

## Application Questions

No disponibles.

## Application Status

No aplica.

## Rate Limits

- 6 requests por minuto
- 100 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Rate limit conservador (6 req/min) y aislamiento por tenant.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | Si |
| Detalle de la oferta | No |
| Formulario de postulacion | No |
| Envio de candidatura | No |
| Estado de la candidatura | No |
| OAuth | No |
| API key | No |
| Requiere navegador | Si |
| Adjuntar CV | No |
| Adjuntar carta | No |
| Preguntas personalizadas | No |

## Terms / Restrictions

- No existe una API publica universal de postulacion en Workday: la integracion es por empresa/tenant.
- Solo se consulta el endpoint que utiliza la propia career site, sin scraping agresivo y respetando rate limits.
- La postulacion requiere el flujo propio del tenant (cuenta de candidato): se deriva al usuario.

## Implementation Status

- Busqueda: implementada y verificada contra un career site real.
- Detalle completo: no disponible en el endpoint de listado.
- Postulacion: requiere navegador e intervencion humana.

## Tests

Parseo de la URL del career site cubierto por el codigo del connector.
