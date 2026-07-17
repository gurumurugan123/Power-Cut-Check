@echo off
set "PATH=%USERPROFILE%\nodejs-portable\node-v22.17.0-win-x64;%PATH%"
cd /d "%~dp0"
npm run dev
