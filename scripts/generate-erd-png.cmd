@echo off
REM Run this from the project root: generate-erd-png.cmd
SET "INPUT=docs\ERD_COMPARISON.mmd"
SET "OUTPUT=docs\ERD_COMPARISON.png"
SET "WIDTH=3840"
SET "HEIGHT=2160"

IF NOT EXIST "%INPUT%" (
  echo Mermaid source file not found: %INPUT%
  exit /b 1
)

echo Generating high-resolution PNG from %INPUT% into %OUTPUT%...

npx --yes @mermaid-js/mermaid-cli -i "%INPUT%" -o "%OUTPUT%" --width %WIDTH% --height %HEIGHT%

IF EXIST "%OUTPUT%" (
  echo File created: %OUTPUT%
) ELSE (
  echo PNG generation failed. Ensure Node.js/npm are installed.
  exit /b 1
)
