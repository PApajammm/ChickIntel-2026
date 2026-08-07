@echo off
setlocal enabledelayedexpansion
title ChickIntel - Automatic Setup & Launcher
color 0A

cd /d "%~dp0"

echo ============================================================
echo           ChickIntel 2026 - Automatic Project Setup
echo ============================================================
echo.

:: Step 1: Check Node.js
echo [1/4] Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js is NOT installed on this computer!
    echo.
    echo Please download and install Node.js (LTS version) from:
    echo https://nodejs.org/
    echo.
    echo After installing Node.js, restart your computer or command window
    echo and double-click this setup file again.
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js detected: 
node -v
echo.

:: Step 2: Check .env file
echo [2/4] Checking Environment Configuration (.env)...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [OK] Created .env file from .env.example!
    ) else (
        echo [WARNING] .env file not found and .env.example is missing.
    )
) else (
    echo [OK] .env file exists.
)
echo.

:: Step 3: Install Dependencies
echo [3/4] Checking dependencies (node_modules)...
if not exist "node_modules\" (
    echo [INFO] node_modules folder not found. Installing packages...
    echo [INFO] Running 'npm install'... This may take a few minutes. Please wait...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo.
        echo [ERROR] npm install failed! Please check your internet connection and try again.
        echo.
        pause
        exit /b %ERRORLEVEL%
    )
    echo.
    echo [OK] Dependencies installed successfully!
) else (
    echo [OK] Dependencies are already installed!
)
echo.

:: Step 4: Run Options
echo [4/4] Setup completed! Select how you want to run the project:
echo.
echo  ============================================================
echo   [1] Start Expo Dev Server  (Default: Scan QR code with Expo Go)
echo   [2] Start with Tunnel      (Use if phone and PC are on different Wi-Fi)
echo   [3] Start in Web Browser   (Runs app in browser)
echo   [4] Reinstall Dependencies (npm install)
echo   [5] Exit
echo  ============================================================
echo.

set /p CHOICE="Enter choice [1-5] (Default is 1): "

if "%CHOICE%"=="" set CHOICE=1
if "%CHOICE%"=="1" goto START_EXPO
if "%CHOICE%"=="2" goto START_TUNNEL
if "%CHOICE%"=="3" goto START_WEB
if "%CHOICE%"=="4" goto REINSTALL
if "%CHOICE%"=="5" goto END

:START_EXPO
echo.
echo Starting Expo Dev Server...
echo Press Ctrl + C to stop the server anytime.
echo.
call npx expo start
goto END

:START_TUNNEL
echo.
echo Starting Expo Dev Server in Tunnel mode...
echo.
call npx expo start --tunnel
goto END

:START_WEB
echo.
echo Starting Expo in Web mode...
echo.
call npx expo start --web
goto END

:REINSTALL
echo.
echo Reinstalling dependencies...
call npm install
echo.
pause
goto END

:END
echo.
echo Goodbye!
pause
