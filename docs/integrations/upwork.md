# Upwork

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/upwork.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

Marketplace freelance con API GraphQL oficial. Requiere una aplicacion aprobada por Upwork y OAuth 2.0.

- **Categoria:** freelance
- **Modo de integracion:** HUMAN_REQUIRED — requiere intervencion humana
- **Sitio:** https://www.upwork.com

## Official Documentation

https://www.upwork.com/developer/documentation/graphql/api/docs/index.html

## Authentication

OAuth 2.0 con access token. Opcionalmente se envia `X-Upwork-API-TenantId` cuando la cuenta lo requiere.

### Configuracion requerida en el panel ADMIN

- `access_token` — OAuth access token (obligatorio)
- `refresh_token` — OAuth refresh token (opcional)
- `client_id` — Client ID (opcional)
- `client_secret` — Client Secret (opcional)
- `organization_uid` — Organization UID (opcional). Se envia como cabecera X-Upwork-API-TenantId cuando la cuenta lo requiere.

## Endpoints

- `POST https://api.upwork.com/graphql`
- `Query: marketplaceJobPostings(marketPlaceJobFilter, first)`

## Search

Filtro por texto (`searchExpression_eq`). Sin access token el connector no ejecuta llamadas ni devuelve datos inventados.

## Job Detail

Incluye presupuesto fijo o por hora, skills, duracion y datos del cliente.

## Application

NO implementada. El envio de proposals depende de permisos explicitos de la aplicacion aprobada: tener lectura no habilita escribir. Se devuelve REQUIRES_USER_ACTION.

## Application Questions

No implementadas.

## Application Status

No implementado.

## Rate Limits

- 10 requests por minuto
- 150 requests por hora

El cliente HTTP compartido aplica estos limites, cachea las respuestas GET y
coalesce las peticiones simultaneas identicas.

## Errors

Los errores GraphQL se devuelven como avisos de la busqueda.

## Capabilities

| Capacidad | Soportada |
| --- | --- |
| Busqueda | Si |
| Detalle de la oferta | No |
| Formulario de postulacion | No |
| Envio de candidatura | No |
| Estado de la candidatura | No |
| OAuth | Si |
| API key | No |
| Requiere navegador | No |
| Adjuntar CV | No |
| Adjuntar carta | No |
| Preguntas personalizadas | No |

## Terms / Restrictions

- Requiere una aplicacion aprobada por Upwork y OAuth 2.0 con los scopes concedidos a esa aplicacion.
- El envio de proposals depende de permisos explicitos: no se asume disponible por tener lectura.
- Las credenciales se guardan cifradas en el backend y nunca llegan al frontend.

## Implementation Status

- Busqueda: implementada segun la documentacion oficial; requiere credenciales para ejecutarse.
- Postulacion: deliberadamente no automatizada.

## Tests

Cubierta por las pruebas de configuracion del registro.
