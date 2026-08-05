Param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Info($msg) { Write-Host "• $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "✓ $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

Set-Location $Root

# Merge parent DB credentials if newgeneration/.env is missing MYSQL_HOST
if (-not (Test-Path "$Root\.env")) {
  if (Test-Path "$Root\..\.env") {
    Info "Copying parent .env → newgeneration/.env"
    Copy-Item "$Root\..\.env" "$Root\.env"
  } else {
    Fail "No .env found. Copy .env.example to .env and set MYSQL_* values."
  }
}

# Ensure dashboard port overrides exist
$localEnv = "$Root\.env.local"
if (-not (Test-Path $localEnv)) {
  @"
PORT=3010
CLIENT_ORIGIN=http://localhost:5174
VITE_CLIENT_PORT=5174
VITE_API_PORT=3010
"@ | Set-Content -Path $localEnv -Encoding UTF8
  Ok "Created .env.local with local ports (API 3010, UI 5174)"
}

if (-not $SkipInstall) {
  Info "Installing dependencies…"
  npm install --silent
  Push-Location server; npm install --silent; Pop-Location
  Push-Location client; npm install --silent; Pop-Location
  Ok "Dependencies installed"
}

# Load env for child processes (server reads ../.env; client reads VITE_* from client dir)
Info "Starting dashboard…"
Info "  UI:  http://localhost:5174"
Info "  API: http://localhost:3010/api/health"
Write-Host ""
npm run dev
