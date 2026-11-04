@echo off
rem Double-click to refresh the dashboard data. It opens the Google sign-in only when it is needed.
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\sync-now.ps1"
echo.
pause
