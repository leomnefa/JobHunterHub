# Pinpoint

> Documento generado por `scripts/generate-docs.mjs` a partir del connector
> `server/src/connectors/pinpoint.ts`. No editar a mano: los datos de
> capacidades, limites y restricciones se leen del codigo.

## Overview

ATS cuya API exige una API key emitida por cada cliente. No se encontro un feed publico verificable.

- **Categoria:** ats
- **Modo de integracion:** UNKNOWN — pendiente de verificacion
- **Sitio:** https://www.pinpointhq.com

## Official Documentation

https://developers.pinpointhq.com/

## Authentication

API key por cliente.

### Configuracion requerida en el panel ADMIN

- `api_key` — API key (obligatorio)
- `subdomain` — Subdominio (obligatorio). Aparece en {empresa}.pinpointhq.com

## Endpoints

- `Pendientes de verificar con una cuenta real.`

## Search

No implementada: el connector queda NOT_CONFIGURED.

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

- La API de Pinpoint exige API key emitida por cada cliente y no expone un feed publico verificable. Pendiente de validar con una cuenta real antes de habilitar.

## Implementation Status

- Pendiente: validar endpoints y autenticacion con una cuenta real antes de habilitar.
- No se implementan endpoints no verificados.

## Tests

Cubierta por la prueba de coherencia del registro.
