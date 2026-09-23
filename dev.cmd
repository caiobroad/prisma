@echo off
rem Inicia o Prisma em modo de desenvolvimento (hot reload do renderer).
rem Usa o Node instalado no sistema; se não houver, usa a cópia portátil em C:\Claude\tools\node.
setlocal
where node >nul 2>nul || set "PATH=C:\Claude\tools\node;%PATH%"
cd /d "%~dp0"
call npm run dev
