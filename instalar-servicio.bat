@echo off
title JobHunter AI - Instalar como servicio
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Se necesitan permisos de administrador. Solicitandolos...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\service.ps1" -Action install
echo.
pause
