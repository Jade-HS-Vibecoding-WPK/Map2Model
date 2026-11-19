@echo off
rem =========================================================
rem  Map2Model-Oeffner installieren (einmalig, ohne Adminrechte)
rem  - kopiert oeffner.ps1 nach %LOCALAPPDATA%\Map2Model-Oeffner
rem  - meldet die Adresse "map2model://" fuer den eigenen Benutzer an
rem  - richtet das Map2Model-Add-in fuer Revit 2026 ein (falls vorhanden),
rem    damit Revit die IFC nach dem Start automatisch oeffnet
rem  Entfernen: Deinstallieren.cmd
rem =========================================================
setlocal
set "ZIEL=%LOCALAPPDATA%\Map2Model-Oeffner"

if not exist "%~dp0oeffner.ps1" (
  echo Die Datei oeffner.ps1 fehlt neben dieser Datei. Bitte die ZIP-Datei zuerst entpacken.
  pause
  exit /b 1
)

if not exist "%ZIEL%" mkdir "%ZIEL%"
copy /Y "%~dp0oeffner.ps1" "%ZIEL%\oeffner.ps1" >nul

reg add "HKCU\Software\Classes\map2model" /ve /d "URL:Map2Model-Oeffner" /f >nul
reg add "HKCU\Software\Classes\map2model" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\map2model\shell\open\command" /ve /d "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%ZIEL%\oeffner.ps1\" \"%%1\"" /f >nul

rem ---------- Revit-Add-in (nur wenn Revit 2026 installiert ist) ----------
set "ADDINS=%APPDATA%\Autodesk\Revit\Addins\2026"
if exist "%~dp0Map2ModelRevit.dll" if exist "%ADDINS%" (
  if not exist "%ADDINS%\Map2Model" mkdir "%ADDINS%\Map2Model"
  copy /Y "%~dp0Map2ModelRevit.dll" "%ADDINS%\Map2Model\Map2ModelRevit.dll" >nul
  copy /Y "%~dp0Map2ModelRevit.addin" "%ADDINS%\Map2ModelRevit.addin" >nul
  echo  Revit-Add-in eingerichtet: Revit oeffnet die IFC jetzt automatisch.
  echo  Beim naechsten Start fragt Revit einmal nach dem Add-in "Map2Model" - bitte "Immer laden".
)

echo.
echo  Fertig! Der Map2Model-Oeffner ist installiert.
echo  Zurueck zur Website: In Schritt 2 das Programm waehlen und "In ... oeffnen" klicken.
echo  Der Browser fragt beim ersten Mal, ob er den Map2Model-Oeffner starten darf - bitte erlauben.
echo  Ist Revit gerade offen: Revit einmal schliessen und neu starten, damit das Add-in geladen wird.
echo.
pause
