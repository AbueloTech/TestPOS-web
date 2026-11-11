@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install --omit=dev
)
start "" http://localhost:3000
node server.js
pause
