@echo off
title JobHunter AI
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo  ERROR: No se encontro Node.js. Ejecute primero "instalar.bat".
    pause
    exit /b 1
)

if not exist "web\dist\index.html" (
    echo  La interfaz web no esta compilada. Ejecutando la instalacion...
    node scripts\setup.mjs
    if errorlevel 1 (
        pause
        exit /b 1
    )
)

echo.
echo  Iniciando JobHunter AI...
echo  Para detenerlo, cierre esta ventana o presione Ctrl+C.
echo.

start "" http://127.0.0.1:4100
node server\src\index.ts

pause
