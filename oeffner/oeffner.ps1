# =========================================================
#  Map2Model-Öffner
#  Wird vom Browser über eine Adresse wie
#     map2model://oeffnen?programm=revit&datei=Map2Model_Ort_2026-11-18.ifc
#  aufgerufen. Er sucht die gerade heruntergeladene IFC-Datei im
#  Download-Ordner und öffnet sie im gewählten CAD-Programm.
#
#  Sicherheit: Es werden NUR .ifc-Dateien aus dem eigenen Download-Ordner
#  geöffnet, und NUR mit den Programmen aus der Liste unten.
#
#  Test ohne etwas zu öffnen:
#     powershell -File oeffner.ps1 "map2model://oeffnen?programm=revit&datei=Test.ifc" -Probe
# =========================================================
param(
  [string]$Adresse,
  [switch]$Probe
)

$ErrorActionPreference = 'Stop'

function Melde([string]$text) {
  if ($Probe) { Write-Output $text; return }
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($text, 'Map2Model-Öffner') | Out-Null
}

# ---------- Adresse zerlegen ----------
$werte = @{}
$abfrage = ($Adresse -replace '^map2model://[^?]*\?', '')
foreach ($teil in $abfrage.Split('&')) {
  $kv = $teil.Split('=', 2)
  if ($kv.Count -eq 2) { $werte[$kv[0]] = [Uri]::UnescapeDataString($kv[1]) }
}
$programm = [string]$werte['programm']
$dateiname = [string]$werte['datei']

if ($dateiname -notmatch '^[\w\-\. äöüÄÖÜß()]+\.ifc$') {
  Melde "Ungültiger Dateiname: $dateiname"
  exit 1
}

# ---------- Download-Ordner ----------
$downloads = $null
try { $downloads = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path } catch { }
if (-not $downloads) { $downloads = Join-Path $env:USERPROFILE 'Downloads' }

# Datei finden: genauer Name oder Browser-Kopie „Name (1).ifc“, frisch heruntergeladen.
# Bis zu 30 Sekunden warten, bis der Download fertig ist.
$basis = [IO.Path]::GetFileNameWithoutExtension($dateiname)
$gefunden = $null
for ($i = 0; $i -lt 60 -and -not $gefunden; $i++) {
  $kandidaten = Get-ChildItem -LiteralPath $downloads -Filter '*.ifc' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.BaseName -eq $basis -or $_.BaseName -like ($basis + ' (*)') } |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) } |
    Sort-Object LastWriteTime -Descending
  if ($kandidaten) { $gefunden = $kandidaten[0] }
  elseif ($Probe) { break }
  else { Start-Sleep -Milliseconds 500 }
}

# ---------- Programm suchen (nur diese Liste) ----------
$muster = @{
  'revit'       = @('C:\Program Files\Autodesk\Revit 20*\Revit.exe')
  'archicad'    = @('C:\Program Files\Graphisoft\Archicad*\Archicad.exe', 'C:\Program Files\GRAPHISOFT\ARCHICAD*\ARCHICAD.exe')
  'vectorworks' = @('C:\Program Files\Vectorworks*\Vectorworks*.exe')
  'allplan'     = @('C:\Program Files\Allplan\Allplan 20*\Prg\Allplan*.exe')
  'bricscad'    = @('C:\Program Files\Bricsys\BricsCAD V*\bricscad.exe')
  'freecad'     = @('C:\Program Files\FreeCAD*\bin\FreeCAD.exe')
}
$exe = $null
if ($muster.ContainsKey($programm)) {
  foreach ($m in $muster[$programm]) {
    $treffer = Get-ChildItem -Path $m -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
    if ($treffer) { $exe = $treffer[0].FullName; break }
  }
}

if ($Probe) {
  Write-Output "Programm: $programm"
  Write-Output "Datei:    $dateiname"
  Write-Output "Ordner:   $downloads"
  Write-Output ("Gefunden: " + $(if ($gefunden) { $gefunden.FullName } else { '(keine passende Datei)' }))
  Write-Output ("Starten:  " + $(if ($exe) { $exe } else { 'Standardprogramm von Windows' }))
  if ($programm -eq 'revit') {
    Write-Output ("Revit läuft schon: " + [bool](Get-Process -Name 'Revit' -ErrorAction SilentlyContinue))
    Write-Output ("Add-in vorhanden: " + (Test-Path (Join-Path $env:APPDATA 'Autodesk\Revit\Addins\2026\Map2ModelRevit.addin')))
  }
  exit 0
}

if (-not $gefunden) {
  Melde "Die Datei $dateiname wurde im Download-Ordner nicht gefunden.`nBitte prüfen, ob der Download fertig ist."
  exit 1
}

# Pfad zusätzlich in die Zwischenablage – falls das Programm die Datei nicht selbst öffnet,
# geht es mit „Datei → Öffnen → IFC“ und Strg + V.
try { Set-Clipboard -Value $gefunden.FullName } catch { }

if ($programm -eq 'revit' -and $exe) {
  # Revit öffnet keine IFC, die man beim Start übergibt. Stattdessen bekommt das
  # Map2Model-Add-in in Revit einen Auftrag und öffnet die Datei, sobald Revit bereit ist.
  $auftrag = Join-Path $env:LOCALAPPDATA 'Map2Model-Oeffner\auftrag.txt'
  [IO.File]::WriteAllText($auftrag, $gefunden.FullName, (New-Object Text.UTF8Encoding($false)))
  $laeuft = Get-Process -Name 'Revit' -ErrorAction SilentlyContinue
  if ($laeuft) {
    # Revit ist schon offen → nur nach vorne holen, das Add-in öffnet die Datei dort
    try {
      Add-Type -Namespace M2M -Name Fenster -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);'
      [M2M.Fenster]::SetForegroundWindow($laeuft[0].MainWindowHandle) | Out-Null
    } catch { }
  } else {
    Start-Process -FilePath $exe
  }
} elseif ($exe) {
  Start-Process -FilePath $exe -ArgumentList ('"' + $gefunden.FullName + '"')
} else {
  # kein bekanntes Programm gefunden → das Programm, das Windows für .ifc eingestellt hat
  Start-Process -FilePath $gefunden.FullName
}
