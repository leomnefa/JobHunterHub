<#
.SYNOPSIS
    Instala JobHunter AI como servicio de Windows que arranca solo al encender
    el equipo, sin necesidad de que nadie inicie sesion.

.DESCRIPTION
    Se usa una tarea programada del sistema en lugar de sc.exe porque Node no
    implementa el protocolo del Administrador de Servicios: crear un servicio
    nativo exigiria un envoltorio externo (NSSM o WinSW) que habria que
    descargar. Una tarea que corre como SYSTEM con disparador "al iniciar el
    equipo" da el mismo resultado operativo -- arranque automatico, sin sesion
    iniciada y con reintentos ante fallo -- sin agregar dependencias.

.PARAMETER Action
    install | uninstall | start | stop | restart | status | logs

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\service.ps1 -Action install
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('install', 'uninstall', 'start', 'stop', 'restart', 'status', 'logs')]
    [string]$Action = 'status',

    [Parameter(Mandatory = $false)]
    [int]$Lines = 40
)

$ErrorActionPreference = 'Stop'

$TaskName = 'JobHunterAI'
$Root = Split-Path -Parent $PSScriptRoot
$Entry = Join-Path $Root 'server\src\index.ts'
$LogDir = Join-Path $Root 'data\logs'

function Write-Title($text) {
    Write-Host ''
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host '  ---------------------------------------------'
}

function Write-Ok($text) { Write-Host "  $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "  $text" -ForegroundColor Yellow }
function Write-Err($text) { Write-Host "  $text" -ForegroundColor Red }

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-NodePath {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        throw "No se encontro Node.js en el PATH. Instalelo desde https://nodejs.org (version 22.6 o superior)."
    }
    # Se guarda la ruta absoluta: SYSTEM puede tener un PATH distinto al del usuario.
    return $node.Source
}

function Get-AppPort {
    $envFile = Join-Path $Root '.env'
    if (Test-Path $envFile) {
        $match = Select-String -Path $envFile -Pattern '^PORT=(\d+)' -ErrorAction SilentlyContinue
        if ($match) { return $match.Matches[0].Groups[1].Value }
    }
    return '4100'
}

function Get-Task {
    return Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}

function Install-Service {
    if (-not (Test-Admin)) {
        Write-Err 'Esta operacion requiere permisos de administrador.'
        Write-Host '  Haga clic derecho en instalar-servicio.bat y elija "Ejecutar como administrador".'
        exit 1
    }

    $nodePath = Get-NodePath
    $version = & $nodePath --version
    $major = [int]($version -replace '^v(\d+)\..*$', '$1')
    $minor = [int]($version -replace '^v\d+\.(\d+)\..*$', '$1')
    if ($major -lt 22 -or ($major -eq 22 -and $minor -lt 6)) {
        Write-Err "Se requiere Node.js 22.6 o superior (detectado $version)."
        exit 1
    }

    if (-not (Test-Path (Join-Path $Root 'web\dist\index.html'))) {
        Write-Warn2 'La interfaz web no esta compilada. Ejecute primero instalar.bat.'
        exit 1
    }

    Write-Title 'Instalando el servicio JobHunter AI'
    Write-Host "  Node:      $nodePath ($version)"
    Write-Host "  Proyecto:  $Root"

    if (Get-Task) {
        Write-Warn2 'Ya existia una instalacion previa: se reemplaza.'
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

    $action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$Entry`"" -WorkingDirectory $Root

    # Dos disparadores: al encender el equipo y al iniciar sesion cualquier
    # usuario. El segundo cubre el caso de un reinicio con la tarea detenida.
    $triggers = @(
        (New-ScheduledTaskTrigger -AtStartup),
        (New-ScheduledTaskTrigger -AtLogOn)
    )

    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
        -MultipleInstances IgnoreNew

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Description 'JobHunter AI - plataforma de busqueda y postulacion laboral' `
        -Action $action `
        -Trigger $triggers `
        -Principal $principal `
        -Settings $settings | Out-Null

    Write-Ok 'Servicio registrado.'

    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 4

    $port = Get-AppPort
    $ok = $false
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 8
        $ok = $response.StatusCode -eq 200
    } catch {
        $ok = $false
    }

    if ($ok) {
        Write-Ok "Servicio iniciado y respondiendo en http://127.0.0.1:$port"
    } else {
        Write-Warn2 "El servicio quedo registrado pero todavia no responde en el puerto $port."
        Write-Host "  Revise el log:  powershell -File scripts\service.ps1 -Action logs"
    }

    Write-Host ''
    Write-Host '  Arranca solo cuando se enciende el equipo, sin iniciar sesion.'
    Write-Host "  Aplicacion:  http://127.0.0.1:$port"
    Write-Host "  Logs:        $LogDir"
    Write-Host ''
}

function Uninstall-Service {
    if (-not (Test-Admin)) {
        Write-Err 'Esta operacion requiere permisos de administrador.'
        exit 1
    }
    Write-Title 'Desinstalando el servicio JobHunter AI'
    if (-not (Get-Task)) {
        Write-Warn2 'El servicio no estaba instalado.'
        return
    }
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Ok 'Servicio eliminado. Los datos en data\ no se tocaron.'
}

function Start-Service2 {
    if (-not (Get-Task)) { Write-Err 'El servicio no esta instalado.'; exit 1 }
    Start-ScheduledTask -TaskName $TaskName
    Write-Ok 'Servicio iniciado.'
}

function Stop-Service2 {
    if (-not (Get-Task)) { Write-Err 'El servicio no esta instalado.'; exit 1 }
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    # Stop-ScheduledTask no siempre termina el proceso hijo: se cierra por puerto.
    $port = Get-AppPort
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Ok 'Servicio detenido.'
}

function Show-Status {
    Write-Title 'Estado del servicio JobHunter AI'
    $task = Get-Task
    if (-not $task) {
        Write-Warn2 'No esta instalado como servicio.'
        Write-Host '  Para instalarlo: clic derecho en instalar-servicio.bat -> Ejecutar como administrador'
        return
    }

    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "  Registrado:      si"
    Write-Host "  Estado:          $($task.State)"
    Write-Host "  Ultimo inicio:   $($info.LastRunTime)"
    Write-Host "  Ultimo resultado: $($info.LastTaskResult)"

    $port = Get-AppPort
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 5
        $health = $response.Content | ConvertFrom-Json
        Write-Ok "Responde en http://127.0.0.1:$port (IA: $($health.ai.provider))"
    } catch {
        Write-Warn2 "No responde en el puerto $port."
    }
}

function Show-Logs {
    $latest = Get-ChildItem -Path $LogDir -Filter 'jobhunter-*.log' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Warn2 "No hay archivos de log en $LogDir"
        return
    }
    Write-Title "Ultimas $Lines lineas de $($latest.Name)"
    Get-Content $latest.FullName -Tail $Lines
}

switch ($Action) {
    'install'   { Install-Service }
    'uninstall' { Uninstall-Service }
    'start'     { Start-Service2 }
    'stop'      { Stop-Service2 }
    'restart'   { Stop-Service2; Start-Sleep -Seconds 2; Start-Service2 }
    'status'    { Show-Status }
    'logs'      { Show-Logs }
}
