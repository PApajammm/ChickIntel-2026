@echo off
title ChickIntel APK Builder
echo ============================================================
echo               ChickIntel - APK Builder Script
echo ============================================================
echo.
echo Building new Android APK with the latest app features...
echo Please wait, compiling native Android bundle...
echo.

cd /d "%~dp0android"
call gradlew.bat assembleRelease

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] APK Build failed! Check the errors above.
    exit /b %ERRORLEVEL%
)

cd /d "%~dp0"
if not exist "output-apk" mkdir "output-apk"

copy /Y "android\app\build\outputs\apk\release\app-release.apk" "output-apk\ChickIntel.apk" >nul

echo.
echo ============================================================
echo SUCCESS! Your new ChickIntel APK is ready!
echo.
echo Saved at: %~dp0output-apk\ChickIntel.apk
echo.
echo You can now upload output-apk\ChickIntel.apk to MediaFire!
echo ============================================================
echo.
