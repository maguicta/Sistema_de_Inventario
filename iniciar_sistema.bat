@echo off
setlocal
cd /d "%~dp0"
title Sistema de Inventario - Iniciando...

echo ========================================================
echo         INICIANDO SISTEMA DE INVENTARIO 
echo  #####################################################
echo  ################## Maguicta #########################
echo  #####################################################
echo ========================================================
echo.

REM 1. Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado. Por favor instale Node.js.
    pause
    exit /b
)

REM 2. Instalar dependencias si falta node_modules
if not exist "node_modules\" (
    echo [INFO] La carpeta node_modules no existe. Instalando dependencias...
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo [ERROR] Error instalando dependencias. Verifique su conexion a internet.
        pause
        exit /b
    )
)

REM 3. Comprobar si la base de datos esta inicializada
echo [INFO] Comprobando conexion a la base de datos...
node database/check_connection.js

if %errorlevel% neq 0 (
    echo [!] Base de datos no encontrada o no inicializada.
    echo [INFO] Inicializando base de datos - creando tablas y datos base...
    call npm run db:init
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo inicializar la base de datos. 
        echo Asegurese de que MySQL - XAMPP o WampServer - este encendido.
        pause
        exit /b
    )
) else (
    echo [OK] Base de datos conectada correctamente.
)

REM 4. Abrir el navegador (esperar un poco para que el servidor suba)
echo [INFO] Abriendo navegador...
start http://localhost:3000

REM 5. Iniciar el servidor
echo.
echo ========================================================
echo             SISTEMA LISTO Y CORRIENDO
echo ========================================================
echo.
call npm start

pause
