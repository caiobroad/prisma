@echo off
rem Compila (se precisar) e abre o Prisma.
setlocal
where node >nul 2>nul || set "PATH=C:\Claude\tools\node;%PATH%"
set "APP=%~dp0"
if "%APP:~-1%"=="\" set "APP=%APP:~0,-1%"
cd /d "%APP%"
if not exist "%APP%\out\main\index.js" call npm run build
start "" "%APP%\node_modules\electron\dist\electron.exe" "%APP%"
