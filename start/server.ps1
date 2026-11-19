# Map2Model lokal starten: kleiner Webserver nur für diesen Rechner (http://localhost:8080)
# Wird von „Map2Model starten.cmd“ aufgerufen. Fenster schließen = Server aus.
param([string]$Root = (Split-Path -Parent $PSScriptRoot), [int]$Port = 8080)

$types = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json"; ".svg" = "image/svg+xml"; ".png" = "image/png"; ".jpg" = "image/jpeg"
  ".wasm" = "application/wasm"; ".ifc" = "application/octet-stream"; ".md" = "text/plain; charset=utf-8"
}
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch {
  Write-Host "Port $Port ist schon belegt – läuft Map2Model vielleicht schon? Einfach http://localhost:$Port im Browser öffnen."
  Read-Host "Enter zum Schließen"; exit 1
}
Write-Host ""
Write-Host "  Map2Model läuft auf http://localhost:$Port"
Write-Host "  Dieses Fenster offen lassen. Schließen = Map2Model beenden."
Write-Host ""
$rootFull = [System.IO.Path]::GetFullPath($Root)
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq "") { $rel = "index.html" }
    $path = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    if ($path.StartsWith($rootFull) -and (Test-Path $path -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
      $ctx.Response.Headers.Add("Cache-Control", "no-store")
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { $ctx.Response.StatusCode = 500 }
  finally { $ctx.Response.Close() }
}
