@echo off
setlocal

:: Get the directory where this script is located
set SCRIPT_DIR=%~dp0

:: Change to the script directory
cd /d "%SCRIPT_DIR%"

:: Parse command line arguments
set HEADLESS=false
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--headless" set HEADLESS=true
shift
goto parse_args
:end_parse

echo Installing dependencies...
call bun i

echo Starting dev-browser server...
set HEADLESS=%HEADLESS%
call bun x tsx scripts/start-server.ts
