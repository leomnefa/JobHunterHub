@echo off
title JobHunter AI - Servicio
cd /d "%~dp0"

if "%~1"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\service.ps1" -Action status
    echo.
    echo  Uso: servicio.bat [status^|start^|stop^|restart^|logs]
    echo.
    pause
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\service.ps1" -Action %1
