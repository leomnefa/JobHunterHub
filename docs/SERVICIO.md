# Instalación como servicio

Cómo dejar JobHunter AI corriendo en este equipo de forma permanente: arranca
solo al encender la máquina, sigue funcionando sin que nadie inicie sesión y se
reinicia si el proceso se cae.

---

## Instalación

1. **Primero** ejecutá `instalar.bat` si todavía no lo hiciste (compila la interfaz).
2. Clic derecho en **`instalar-servicio.bat`** → **Ejecutar como administrador**.

Eso es todo. El instalador verifica la versión de Node, registra el servicio, lo
arranca y comprueba que responda antes de terminar.

> La elevación es obligatoria: registrar un arranque automático del sistema
> requiere permisos de administrador. Es el único paso que los necesita.

---

## Operación diaria

Desde la carpeta del proyecto, con `servicio.bat`:

| Comando | Qué hace |
| --- | --- |
| `servicio.bat` | Estado: si está registrado, si está corriendo y si responde |
| `servicio.bat start` | Arranca el servicio |
| `servicio.bat stop` | Lo detiene |
| `servicio.bat restart` | Lo reinicia (después de cambiar `.env`, por ejemplo) |
| `servicio.bat logs` | Últimas 40 líneas del log |

La aplicación queda en **http://127.0.0.1:4100**.

Para desinstalarlo: clic derecho en **`desinstalar-servicio.bat`** → Ejecutar como
administrador. Los datos de `data\` no se tocan.

---

## Por qué una tarea programada y no un servicio con `sc.exe`

Node no implementa el protocolo del Administrador de Servicios de Windows. Crear
un servicio nativo con `sc.exe` exigiría un envoltorio externo — NSSM o WinSW —
que habría que descargar y mantener.

Una tarea programada del sistema, corriendo como `SYSTEM` con disparador *al
iniciar el equipo*, da exactamente el mismo resultado operativo:

- arranca sola al encender la máquina,
- no necesita que nadie inicie sesión,
- se reintenta hasta 3 veces si falla, con un minuto entre intentos,
- no tiene límite de tiempo de ejecución,
- sobrevive al cierre de sesión del usuario.

Y no agrega ninguna dependencia. Si en algún momento preferís un servicio
nativo, NSSM funciona sobre esta misma instalación sin cambiar nada de la app.

Aparece en el **Programador de tareas de Windows** con el nombre `JobHunterAI`.

---

## Logs

Corriendo como servicio no hay consola donde mirar, así que todo lo que la
aplicación escribe queda en archivo:

```
data\logs\jobhunter-AAAA-MM-DD.log
```

- Un archivo por día.
- Se purgan automáticamente los de más de 30 días (`LOG_RETENTION_DAYS` en `.env`).
- Incluye excepciones no capturadas y promesas rechazadas: nada muere en silencio.

Ver el log en vivo:

```powershell
Get-Content data\logs\jobhunter-*.log -Tail 50 -Wait
```

---

## Actualizar la aplicación

```bat
servicio.bat stop
git pull
npm run setup
servicio.bat start
```

La base de datos no se toca: los usuarios, perfiles, CVs y postulaciones se
conservan entre actualizaciones.

---

## Copia de seguridad

Todo el estado vive en dos lugares:

| Qué | Dónde | Importancia |
| --- | --- | --- |
| Base de datos | `data\jobhunter.db` | Crítica: usuarios, perfiles, CVs, postulaciones |
| Clave de sesión | `data\secret.key` | Si se pierde, todos deben volver a iniciar sesión |
| Configuración | `.env` | Contiene la clave que descifra las credenciales de conectores |

**`.env` y `data\` van juntos.** Si restaurás la base sin el `.env` original, las
credenciales de los conectores quedan ilegibles y hay que volver a cargarlas.

Copia en caliente (SQLite en modo WAL lo permite):

```powershell
Copy-Item data\jobhunter.db "C:\backups\jobhunter-$(Get-Date -f yyyyMMdd).db"
Copy-Item .env "C:\backups\jobhunter-$(Get-Date -f yyyyMMdd).env"
```

---

## Acceso desde otra computadora de la red

Por defecto la aplicación escucha **solo en `127.0.0.1`**: nadie fuera de este
equipo puede acceder. Es la configuración correcta para uso personal.

Si necesitás entrar desde otra máquina de la red local:

1. En `.env`, cambiar `HOST=127.0.0.1` por `HOST=0.0.0.0`.
2. Abrir el puerto en el firewall:

   ```powershell
   New-NetFirewallRule -DisplayName "JobHunter AI" -Direction Inbound `
     -LocalPort 4100 -Protocol TCP -Action Allow -Profile Private
   ```

3. `servicio.bat restart`.

**Antes de hacerlo, tené presente:**

- El tráfico viaja **sin cifrar** (HTTP). En una red doméstica o de oficina
  confiable es aceptable; en una red abierta, no.
- La aplicación contiene tu perfil profesional, tus postulaciones y las
  credenciales de las plataformas. Cualquiera en la red podrá intentar entrar.
- Usá contraseñas fuertes para todos los usuarios y verificá que `JWT_SECRET`
  sea el generado por el instalador, no un valor de ejemplo.
- **No expongas el puerto a internet** abriéndolo en el router. Para eso haría
  falta HTTPS con certificado y un repaso de seguridad que hoy no está hecho.

---

## Si algo no arranca

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `servicio.bat` dice "no responde en el puerto" | Otro proceso ocupa el 4100 | Cambiar `PORT` en `.env` y reiniciar |
| El log dice `EADDRINUSE` | La app ya estaba corriendo a mano | `servicio.bat stop`, después `start` |
| "Se requiere Node.js 22.6 o superior" | Node viejo o no está en el PATH del sistema | Instalar Node LTS desde nodejs.org y reinstalar el servicio |
| "La interfaz web no está compilada" | Falta el `npm run setup` | Ejecutar `instalar.bat` |
| Arranca pero el navegador muestra la página de "backend funcionando" | `web\dist` incompleto | `npm run build:web` y reiniciar |

Para diagnosticar a fondo, detené el servicio y corré la aplicación a mano: los
errores salen por consola en tiempo real.

```bat
servicio.bat stop
npm start
```
