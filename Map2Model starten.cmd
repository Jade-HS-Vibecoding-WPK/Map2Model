@echo off
rem Map2Model auf diesem Rechner starten (ohne Installation).
rem Es oeffnet sich ein kleines Fenster (Server) und der Browser mit der App.
rem Zum Beenden das Server-Fenster schliessen.
start "Map2Model-Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start\server.ps1"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8080/%~1"
