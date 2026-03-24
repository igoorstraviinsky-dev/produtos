$ErrorActionPreference = "Stop"

$root = "C:\Users\goohf\Desktop\parceiros\frontend"
$logs = Join-Path $root ".logs"
$out = Join-Path $logs "frontend.out.log"
$err = Join-Path $logs "frontend.err.log"

New-Item -ItemType Directory -Force $logs | Out-Null
if (Test-Path $out) { Remove-Item $out -Force }
if (Test-Path $err) { Remove-Item $err -Force }

Set-Location $root
& "C:\Program Files\nodejs\npm.cmd" "run" "dev" "--" "--host" "127.0.0.1" "--port" "5173" 1>> $out 2>> $err
