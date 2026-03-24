$ErrorActionPreference = "Stop"

$root = "C:\Users\goohf\Desktop\parceiros"
$logs = Join-Path $root ".logs"
$out = Join-Path $logs "app.out.log"
$err = Join-Path $logs "app.err.log"

New-Item -ItemType Directory -Force $logs | Out-Null
if (Test-Path $out) { Remove-Item $out -Force }
if (Test-Path $err) { Remove-Item $err -Force }

Set-Location $root
& "C:\Program Files\nodejs\node.exe" "dist/server.js" 1>> $out 2>> $err
