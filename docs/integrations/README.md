# Integraciones

Estado real de cada fuente integrada en JobHunter AI. Este indice se genera con
`node scripts/generate-docs.mjs` a partir del registro de connectors, asi que
refleja siempre lo que el codigo hace de verdad.

Convenciones de estado:

- `SEARCH_ONLY`: la fuente permite buscar, no postular.
- `API_APPLICATION`: permite enviar la candidatura por API oficial (con credenciales validas).
- `BROWSER_APPLICATION`: requiere completar el formulario en el navegador.
- `HUMAN_REQUIRED`: requiere intervencion humana.
- `UNKNOWN`: pendiente de verificar documentacion oficial vigente.

| Fuente | Categoria | Modo | Busqueda | Postulacion por API | Requiere credenciales |
| --- | --- | --- | --- | --- | --- |
| [Adzuna](adzuna.md) | aggregator | SEARCH_ONLY | Si | No | Si |
| [Ashby](ashby.md) | ats | API_APPLICATION | Si | Si | Si |
| [BambooHR](bamboohr.md) | ats | SEARCH_ONLY | Si | No | Si |
| [Breezy HR](breezy.md) | ats | SEARCH_ONLY | Si | No | Si |
| [Freelancer.com](freelancer.md) | freelance | HUMAN_REQUIRED | Si | No | Si |
| [Greenhouse](greenhouse.md) | ats | API_APPLICATION | Si | Si | Si |
| [Himalayas](himalayas.md) | job_board | SEARCH_ONLY | Si | No | No |
| [Jobgether](jobgether.md) | job_board | UNKNOWN | No | No | No |
| [Jobicy](jobicy.md) | job_board | SEARCH_ONLY | Si | No | No |
| [Lever](lever.md) | ats | API_APPLICATION | Si | Si | Si |
| [Personio](personio.md) | ats | SEARCH_ONLY | Si | No | Si |
| [Pinpoint](pinpoint.md) | ats | UNKNOWN | No | No | Si |
| [Recruitee](recruitee.md) | ats | SEARCH_ONLY | Si | No | Si |
| [Remote OK](remoteok.md) | job_board | SEARCH_ONLY | Si | No | No |
| [Remotive](remotive.md) | job_board | SEARCH_ONLY | Si | No | No |
| [SmartRecruiters](smartrecruiters.md) | ats | API_APPLICATION | Si | Si | Si |
| [Teamtailor](teamtailor.md) | ats | SEARCH_ONLY | Si | No | Si |
| [Upwork](upwork.md) | freelance | HUMAN_REQUIRED | Si | No | Si |
| [Workable](workable.md) | ats | SEARCH_ONLY | Si | No | Si |
| [Workday](workday.md) | ats | BROWSER_APPLICATION | Si | No | Si |

## Regla de honestidad

Ninguna fuente declara una capacidad que no este implementada y verificada.
Cuando una plataforma no documenta publicamente un endpoint, el connector queda
en `UNKNOWN` y no ejecuta llamadas: preferimos una fuente deshabilitada antes
que datos inventados o scraping no autorizado.
