@echo off
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 goto no_node
node.exe server.js
pause
exit /b 0

:no_node
echo Node.js LTS is required.
echo Download: https://nodejs.org
pause
exit /b 1
