@echo off
rem Map2Model-Oeffner und Revit-Add-in wieder entfernen
reg delete "HKCU\Software\Classes\map2model" /f >nul 2>&1
if exist "%LOCALAPPDATA%\Map2Model-Oeffner" rmdir /s /q "%LOCALAPPDATA%\Map2Model-Oeffner"
del /q "%APPDATA%\Autodesk\Revit\Addins\2026\Map2ModelRevit.addin" >nul 2>&1
if exist "%APPDATA%\Autodesk\Revit\Addins\2026\Map2Model" rmdir /s /q "%APPDATA%\Autodesk\Revit\Addins\2026\Map2Model"
echo.
echo  Der Map2Model-Oeffner und das Revit-Add-in wurden entfernt.
echo.
pause
