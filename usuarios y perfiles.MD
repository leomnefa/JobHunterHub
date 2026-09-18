# JobHunter AI — Módulo de usuarios y perfiles

Quiero modificar la aplicación actual **JobHunter AI** para convertirla en una aplicación multiusuario, manteniendo todo lo que ya existe y sin romper las funcionalidades actuales.

## 1. LOGIN

Agregar una pantalla inicial de login.

Debe existir:

* Email / usuario
* Password
* Iniciar sesión

Según el usuario que ingrese, determinar qué puede hacer.

Debe existir como mínimo:

```text
ADMIN
USUARIO
```

---

# 2. USUARIO NORMAL

El usuario normal puede:

* Iniciar sesión.
* Ver su perfil.
* Cargar/modificar su perfil profesional.
* Buscar trabajos.
* Analizar trabajos.
* Generar CV.
* Generar CV adaptado a una oferta.
* Generar cover letter.
* Postularse.
* Ver sus postulaciones.
* Ver su historial.

Cada usuario debe tener sus propios datos completamente separados de los demás usuarios.

---

# 3. PERFIL PROFESIONAL

El concepto más importante es que **cada usuario tenga un perfil profesional independiente**.

El perfil NO debe estar hardcodeado en el código.

Debe almacenarse como un archivo de texto/Markdown.

Ejemplo:

```text
perfil.md
```

El usuario debe poder:

* Crear perfil.
* Subir perfil `.md`.
* Subir `.txt`.
* Editar perfil.
* Descargar perfil.
* Reemplazar perfil.
* Ver el contenido actual.

---

# 4. PERFIL EN MARKDOWN

El perfil puede ser generado previamente utilizando cualquier IA.

Por ejemplo, el usuario puede pedirle a ChatGPT, Claude, Gemini, etc.:

> "Generame mi perfil profesional completo en Markdown para utilizarlo en JobHunter AI."

Luego puede cargar ese archivo en la aplicación.

Ejemplo:

```markdown
# Perfil Profesional

## Datos personales

Nombre: Juan Pérez
Ubicación: Argentina
Email: juan@email.com

## Perfil

Senior Data Engineer con 15 años de experiencia...

## Experiencia

### Empresa XYZ
Senior Data Engineer
2020 - Actualidad

- SQL Server
- Python
- ETL
- Qlik
- APIs

## Skills

- SQL Server
- Python
- Qlik Sense
- QlikView
- .NET
- APIs
- ETL
- AI

## Educación

Licenciado en Informática

## Idiomas

Español: Nativo
Inglés: Avanzado

## Preferencias

Trabajo remoto
Full time
Freelance
Contract
```

No es necesario imponer una estructura rígida.

La IA debe poder interpretar el Markdown.

---

# 5. USO DEL PERFIL POR LA IA

El perfil cargado será la **fuente principal de información del candidato**.

Cuando el usuario seleccione una oferta:

```text
JOB
 +
PERFIL DEL USUARIO
 ↓
IA
 ↓
ANÁLISIS
 ↓
CV ADAPTADO
```

La IA debe utilizar únicamente la información existente en el perfil.

NO inventar:

* experiencia.
* empresas.
* tecnologías.
* títulos.
* certificaciones.
* idiomas.
* años de experiencia.
* proyectos.

Si una información no existe, debe considerarse desconocida.

---

# 6. CV A MEDIDA

La aplicación debe permitir generar un CV específico para cada oferta.

Ejemplo:

```text
Perfil original
       ↓
Oferta Senior Data Engineer
       ↓
IA analiza requisitos
       ↓
Selecciona información relevante del perfil
       ↓
Genera CV adaptado
```

El CV adaptado debe enfatizar las experiencias y skills relevantes para esa oferta.

Pero nunca debe agregar información falsa.

---

# 7. MANTENER EL PERFIL ORIGINAL

El archivo:

```text
perfil.md
```

es la fuente original.

Los CV generados son documentos derivados.

No modificar automáticamente el perfil original cuando se genere un CV.

---

# 8. MULTIUSUARIO

Cada usuario debe tener:

```text
Usuario
 └── Perfil.md
      ├── CVs generados
      ├── búsquedas
      ├── matches
      └── postulaciones
```

Ejemplo:

```text
USER 1
 ├── profile.md
 ├── CVs
 ├── applications
 └── searches

USER 2
 ├── profile.md
 ├── CVs
 ├── applications
 └── searches
```

Los usuarios NO pueden acceder a información de otros usuarios.

---

# 9. ADMIN

Debe existir un usuario/rol:

```text
ADMIN
```

El administrador tiene una interfaz completamente diferente.

El ADMIN:

### Puede

* Crear usuarios.
* Modificar usuarios.
* Eliminar usuarios.
* Activar/desactivar usuarios.
* Resetear passwords.
* Ver estado de usuarios.
* Administrar conectores.
* Configurar APIs.
* Activar/desactivar conectores.
* Ver errores.
* Ver logs.
* Administrar configuración general.
* Administrar las fuentes de trabajos.
* Ver estado de sincronización.
* Administrar parámetros generales de la aplicación.

### NO puede

El ADMIN **NO es un candidato**.

Por lo tanto:

```text
ADMIN
❌ Buscar trabajo
❌ Analizar ofertas como candidato
❌ Generar CV
❌ Postularse
❌ Tener aplicaciones laborales
```

El ADMIN solamente administra la plataforma.

---

# 10. PANEL ADMIN

Crear un menú similar al que ya existe actualmente, conservando las funcionalidades administrativas existentes.

Ejemplo:

```text
ADMIN
│
├── Dashboard
├── Usuarios
├── Conectores
├── Fuentes
├── Configuración
├── Logs
└── Estado del sistema
```

No eliminar funcionalidades administrativas existentes.

Si actualmente existe un ABM de conectores, conservarlo y adaptarlo al nuevo sistema.

---

# 11. PANEL USUARIO

El usuario normal debe tener:

```text
JOBHUNTER AI
│
├── Dashboard
├── Buscar trabajos
├── Mis búsquedas
├── Mi perfil
├── Mis CV
├── Mis postulaciones
└── Configuración
```

---

# 12. DIFERENCIACIÓN POR LOGIN

Después del login:

```text
IF role == ADMIN
    → Admin Dashboard

IF role == USER
    → User Dashboard
```

El usuario no debe poder acceder a rutas administrativas.

El administrador no debe acceder a funcionalidades de candidato.

---

# 13. SEGURIDAD

Es fundamental que exista aislamiento entre usuarios.

Nunca confiar en un `userId` enviado desde el frontend.

El backend debe determinar el usuario autenticado.

Por ejemplo:

```text
Usuario A
→ solamente puede acceder a datos de Usuario A

Usuario B
→ solamente puede acceder a datos de Usuario B
```

Esto debe aplicarse a:

* perfil.
* CV.
* búsquedas.
* matches.
* postulaciones.
* documentos.
* configuraciones.

---

# 14. MIGRACIÓN DEL PROYECTO ACTUAL

IMPORTANTE:

La aplicación ya existe.

NO quiero que la reconstruyas desde cero.

Primero analizá:

* estructura actual.
* frontend.
* backend.
* base de datos.
* autenticación existente.
* ABM existente.
* conectores existentes.
* configuración existente.
* generación de CV existente.

Después incorporá el sistema de usuarios.

Toda la información que actualmente representa al usuario original debe convertirse en:

```text
USER
+
PROFILE.MD
```

sin perder información.

---

# 15. COMPATIBILIDAD

Todo lo que actualmente funciona debe continuar funcionando.

No eliminar:

* conectores.
* búsqueda.
* IA.
* generación de CV.
* configuración.
* ABM.
* funcionalidades existentes.

Adaptarlas al nuevo modelo cuando sea necesario.

---

# 16. EXPERIENCIA DE USUARIO

Quiero una interfaz simple y profesional.

Pantalla inicial:

```text
┌──────────────────────────────┐
│         JOBHUNTER AI         │
│                              │
│ Email                        │
│ [________________________]   │
│                              │
│ Password                     │
│ [________________________]   │
│                              │
│       [ INGRESAR ]           │
└──────────────────────────────┘
```

Después del login:

### Usuario

```text
Bienvenido, Juan

Perfil:
Senior Data Engineer

[ BUSCAR TRABAJOS ]
[ MI PERFIL ]
[ MIS CV ]
[ MIS POSTULACIONES ]
```

### Admin

```text
JobHunter AI - Administración

[ USUARIOS ]
[ CONECTORES ]
[ FUENTES ]
[ CONFIGURACIÓN ]
[ LOGS ]
```

---

# 17. PERFIL — INTERFAZ

La pantalla "Mi Perfil" debe permitir:

```text
┌─────────────────────────────────┐
│ MI PERFIL                       │
├─────────────────────────────────┤
│                                 │
│ [Subir perfil.md]               │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ # Perfil Profesional        │ │
│ │                             │ │
│ │ Senior Data Engineer...     │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ [ GUARDAR ]                     │
│ [ DESCARGAR ]                   │
└─────────────────────────────────┘
```

Puede utilizarse un editor Markdown si ya existe alguno en el proyecto.

No agregar una dependencia innecesaria si puede reutilizarse algo existente.

---

# 18. GENERACIÓN DE PERFIL CON IA

Agregar opcionalmente un botón:

```text
[ CREAR PERFIL CON IA ]
```

que permita al usuario pegar información sobre sí mismo y generar un Markdown estructurado.

Pero el usuario debe poder editarlo antes de guardarlo.

---

# 19. PERFIL COMO FUENTE DE VERDAD

La regla debe ser:

```text
PROFILE.MD
     ↓
SOURCE OF TRUTH
```

Todo lo demás deriva de allí:

```text
PROFILE.MD
   ├── CV
   ├── CV adaptado
   ├── Cover Letter
   ├── respuestas
   └── matching
```

---

# 20. PREPARAR PARA FUTURO

La arquitectura debe quedar preparada para que posteriormente un usuario pueda tener:

```text
Perfil Data Engineer
Perfil Software Engineer
Perfil Qlik
Perfil AI Engineer
```

Pero por ahora se puede implementar:

```text
1 perfil principal por usuario
```

si eso simplifica la primera versión.

No implementar complejidad innecesaria.

---

# 21. OBJETIVO

Quiero que JobHunter AI pase de ser una aplicación utilizada por una sola persona a ser:

> **una plataforma multiusuario donde cada persona pueda cargar su propio perfil profesional en Markdown y utilizar IA para buscar trabajos y generar CVs personalizados para cada oportunidad.**

El administrador solamente administra la plataforma.

---

# 22. ORDEN DE TRABAJO

Antes de modificar código:

1. Analizar el proyecto actual.
2. Identificar cómo funciona actualmente el login, si existe.
3. Identificar cómo funciona actualmente el ADMIN.
4. Identificar cómo están almacenados actualmente los datos del candidato.
5. Identificar los conectores existentes.
6. Identificar la base de datos.
7. Proponer los cambios mínimos necesarios.
8. Implementar usuarios.
9. Implementar roles.
10. Implementar perfiles Markdown.
11. Asociar datos existentes al usuario original.
12. Adaptar generación de CV.
13. Adaptar matching.
14. Adaptar postulaciones.
15. Probar aislamiento de usuarios.
16. Probar ADMIN.
17. Probar que las funcionalidades actuales siguen funcionando.

---

# REGLA FINAL

No quiero una reconstrucción completa de la aplicación.

Quiero una **evolución de la aplicación existente**.

Prioridades:

```text
1. NO romper lo existente
2. Login funcional
3. Usuarios separados
4. Perfil Markdown por usuario
5. CV personalizado mediante IA
6. ADMIN separado del candidato
7. Seguridad / aislamiento
8. Mantener conectores y funcionalidades existentes
```

Implementá primero la base multiusuario y después las mejoras visuales.

Si encontrás decisiones arquitectónicas existentes que permitan resolver esto de manera más simple, reutilizalas en lugar de introducir una arquitectura completamente nueva.
