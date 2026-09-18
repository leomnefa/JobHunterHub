@echo off
title JobHunter AI - Instalacion
cd /d "%~dp0"

echo.
echo  ============================================
echo   JobHunter AI - Instalacion
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo  ERROR: No se encontro Node.js en este equipo.
    echo.
    echo  Instale Node.js 22.6 o superior desde https://nodejs.org
    echo  y vuelva a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

node scripts\setup.mjs
if errorlevel 1 (
    echo.
    echo  La instalacion no pudo completarse.
    pause
    exit /b 1
)

echo.
echo  Listo. Ejecute "iniciar.bat" para abrir JobHunter AI.
echo.
pause
