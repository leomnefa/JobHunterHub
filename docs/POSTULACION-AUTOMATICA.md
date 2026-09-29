# ¿Se puede postular de forma automática?

Respuesta corta: **hoy no, salvo en casos muy específicos.** Todo el trabajo
previo a apretar "enviar" sí está automatizado, y esa es la parte que consume
tiempo de verdad. El envío final sigue siendo manual en la enorme mayoría de las
ofertas, y hay razones técnicas concretas para eso.

Este documento explica exactamente dónde está el límite, por qué, y qué haría
falta para moverlo.

---

## 1. Lo que ya es automático

Para **cualquiera** de las 20 fuentes, sin importar la plataforma:

| Paso | Estado |
| --- | --- |
| Buscar en todas las fuentes a la vez | Automático |
| Normalizar las ofertas a un formato único | Automático |
| Detectar y descartar duplicados entre fuentes | Automático |
| Calcular compatibilidad con tu perfil | Automático |
| Detectar riesgos (visa, huso horario, idioma, salario) | Automático |
| Generar un CV adaptado a esa oferta | Automático |
| Redactar la carta de presentación | Automático |
| Completar las respuestas del formulario | Automático |
| Detectar preguntas que no puede responder | Automático (quedan en `UNKNOWN`) |
| **Enviar la candidatura** | **Manual, salvo excepciones** |
| Registrar la postulación y su estado | Automático |
| Evitar postular dos veces a lo mismo | Automático |
| Avisarte de ofertas nuevas compatibles | Automático |

El flujo real hoy es: buscás, la aplicación analiza y prepara todo, vos revisás
el CV y las respuestas, hacés clic en **Postular en el sitio**, pegás lo generado
y enviás. Lo que antes eran 20 minutos por oferta pasa a ser un par de minutos.

---

## 2. Dónde está el límite exacto

De las 20 fuentes integradas:

| Situación | Fuentes | Cuántas |
| --- | --- | --- |
| Permiten enviar por API oficial | Greenhouse, Lever, Ashby, SmartRecruiters | 4 |
| No tienen API de postulación: se completa en el sitio | Himalayas, Jobicy, Remotive, Remote OK, Adzuna, Workable, Recruitee, BambooHR, Personio, Breezy, Teamtailor | 11 |
| Requieren navegador y cuenta propia del portal | Workday | 1 |
| La automatización sería contraria a sus condiciones | Upwork, Freelancer | 2 |
| Sin API pública verificable | Jobgether, Pinpoint | 2 |

### El detalle que cambia todo

Los 4 conectores que **sí** pueden enviar por API necesitan una credencial que
**emite la empresa que publica la oferta**, no el candidato:

- **Greenhouse**: Job Board API key de la cuenta del empleador.
- **Lever**: API key con permiso de creación de candidaturas.
- **Ashby**: API key con permiso `candidatesWrite`.
- **SmartRecruiters**: OAuth con scope `candidate_applications_manage`.

Como candidato particular **no tenés forma de obtener esas keys** para el board
de otra empresa. No es una limitación de esta aplicación: es cómo están
diseñadas esas APIs. Están pensadas para que un portal de empleos o una
consultora envíe candidatos al ATS de su cliente, no para que un postulante se
postule solo.

**Cuándo sí sirven:** si trabajás en selección, si tenés acuerdo con las empresas,
o si administrás el ATS de tu propia organización. En ese caso la aplicación
envía la candidatura completa, con CV y carta adjuntos, sin intervención.

Sin la key, el conector no simula nada: devuelve `REQUIRES_USER_ACTION` y te
deriva al formulario original. Nunca vas a ver una postulación marcada como
enviada si no se envió de verdad.

---

## 3. Lo que falta para postular con un clic

La pieza que falta está diseñada en la arquitectura pero **no construida**:
`BrowserApplicationConnector`. Un navegador controlado por la aplicación que
abre el formulario real y lo completa con los datos ya generados.

Lo que habría que construir:

1. Abrir la URL de la oferta en un navegador controlado.
2. Detectar el formulario y sus campos.
3. Mapear cada campo a los datos del perfil y las respuestas ya generadas.
4. Adjuntar el CV y la carta.
5. **Detenerse ante CAPTCHA, MFA o verificación** y pedirte que intervengas.
6. Continuar después de tu intervención.
7. Registrar el resultado con captura de pantalla como comprobante.

Es trabajo real: Playwright ya está disponible como dependencia de desarrollo, y
el resto de las piezas (perfil, respuestas, documentos, estados) ya existen. Lo
que hay que resolver es la detección de formularios, que varía por plataforma.

**Estimación honesta:** para los 3 o 4 portales más frecuentes de tu búsqueda,
es abordable. Una solución genérica que funcione en cualquier sitio no lo es —
ningún producto del mercado lo logra de forma confiable.

**Prioridad sugerida:** antes de esto conviene cargar los conectores del
[checklist](CHECKLIST-CONECTORES.md). Ampliar la cobertura de búsqueda da más
resultado que automatizar el último clic de un universo chico de ofertas.

---

## 4. Lo que la aplicación no va a hacer

No por falta de capacidad técnica, sino por decisión de diseño:

- **Saltear CAPTCHAs, MFA o controles anti-bot.** Cuando aparece uno, el estado
  pasa a `REQUIRES_USER_ACTION` y te avisa.
- **Postular masivamente sin revisión.** El envío indiscriminado perjudica al
  candidato: los ATS detectan el patrón y las empresas lo penalizan.
- **Inventar datos para completar un formulario.** Si una pregunta no se responde
  desde tu perfil, queda en `UNKNOWN` y la completás vos. Nunca se envía una
  respuesta fabricada.
- **Operar contra los términos de uso de una plataforma.** Upwork y Freelancer
  tienen APIs de lectura funcionando, pero el envío de propuestas requiere
  permisos explícitos que no se pueden asumir.

Estas restricciones están implementadas en el código, no son solo una intención:
cada conector declara qué puede hacer y el motor respeta esa declaración.

---

## 5. Cómo sacarle el máximo hoy

1. **Cargá los ATS del checklist.** Greenhouse, Lever y Ashby publican ofertas
   que muchas veces no llegan a los job boards, y son las plataformas donde el
   envío por API es técnicamente posible.
2. **Guardá búsquedas con alertas.** El worker las ejecuta solo y te avisa cuando
   aparece algo compatible. Esa es la automatización que más tiempo devuelve.
3. **Subí el umbral de alerta** en Preferencias si recibís demasiado ruido.
4. **Usá "Ya me postulé"** cuando completes un formulario en el sitio: mantiene
   el historial completo y evita que postules dos veces.
5. **Revisá siempre el CV generado** antes de enviarlo. La IA reordena y prioriza
   tu contenido real, pero el criterio final es tuyo.

---

## Resumen

| Pregunta | Respuesta |
| --- | --- |
| ¿Puedo postularme automáticamente a cualquier oferta? | No. |
| ¿A alguna? | Sí, a las de Greenhouse, Lever, Ashby y SmartRecruiters, **si tenés la API key de esa empresa**. |
| ¿Como candidato particular voy a tener esas keys? | Normalmente no. |
| ¿Entonces para qué sirve? | Automatiza todo lo demás: descubrir, analizar, priorizar, generar el CV y la carta, responder el formulario y llevar el seguimiento. |
| ¿Se puede llegar a un clic? | Sí, construyendo la automatización por navegador, acotada a los portales que más uses. |
| ¿Cuánto falta para eso? | Es la última pieza pendiente de la arquitectura. Las demás ya están. |
