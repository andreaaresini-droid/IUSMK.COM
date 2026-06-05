# ============================================================
# IUSMK.COM — Script di setup pre-deploy
# Esegui dalla root del progetto:
#   cd "C:\Users\andre\desktop\ClaudeCode\IUSMK.COM"
#   powershell -ExecutionPolicy Bypass -File deploy-setup.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Users\andre\desktop\ClaudeCode\IUSMK.COM"
Set-Location $ProjectRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  IUSMK.COM — Setup pre-deploy" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Verifica Node.js ──────────────────────────────────────────────────────────
Write-Host "[1/6] Verifica Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = & node --version 2>&1
    Write-Host "  OK Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ERRORE: Node.js non trovato!" -ForegroundColor Red
    exit 1
}

# ── Installa/verifica pnpm ────────────────────────────────────────────────────
Write-Host "[2/6] Verifica pnpm..." -ForegroundColor Yellow
$pnpmOk = $false
try {
    $pnpmVer = & pnpm --version 2>&1
    Write-Host "  OK pnpm $pnpmVer" -ForegroundColor Green
    $pnpmOk = $true
} catch {
    Write-Host "  pnpm non trovato, installazione..." -ForegroundColor Yellow
    & npm install -g pnpm
    $pnpmVer = & pnpm --version 2>&1
    Write-Host "  OK pnpm $pnpmVer installato" -ForegroundColor Green
    $pnpmOk = $true
}

# ── Carica variabili .env nell'ambiente ───────────────────────────────────────
Write-Host "[3/6] Caricamento .env..." -ForegroundColor Yellow
$envFile = "$ProjectRoot\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "  ERRORE: .env non trovato in $ProjectRoot" -ForegroundColor Red
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
        $varName = $matches[1].Trim()
        $varValue = $matches[2].Trim()
        # Rimuovi virgolette se presenti
        $varValue = $varValue -replace '^["'']|["'']$', ''
        Set-Item -Path "Env:$varName" -Value $varValue
    }
}
Write-Host "  OK variabili caricate" -ForegroundColor Green
$dbPreview = $env:DATABASE_URL.Substring(0, [Math]::Min(55, $env:DATABASE_URL.Length))
Write-Host "  DATABASE_URL: $dbPreview..." -ForegroundColor Gray

# ── pnpm install ──────────────────────────────────────────────────────────────
Write-Host "[4/6] pnpm install (può richiedere qualche minuto)..." -ForegroundColor Yellow
& pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRORE durante pnpm install" -ForegroundColor Red
    exit 1
}
Write-Host "  OK dipendenze installate" -ForegroundColor Green

# ── Drizzle-kit push ──────────────────────────────────────────────────────────
Write-Host "[5/6] Creazione tabelle Supabase..." -ForegroundColor Yellow
Write-Host "  Connessione al database..." -ForegroundColor Gray

# Usa il drizzle-kit locale (già installato in lib/db/node_modules)
Set-Location "$ProjectRoot\lib\db"
$drizzleBin = "$ProjectRoot\lib\db\node_modules\.bin\drizzle-kit.CMD"

if (Test-Path $drizzleBin) {
    Write-Host "  Usando drizzle-kit locale..." -ForegroundColor Gray
    & $drizzleBin push --config ./drizzle.js.config.mjs --force
    $exitCode = $LASTEXITCODE
} else {
    Write-Host "  Drizzle-kit locale non trovato, uso pnpm run push..." -ForegroundColor Gray
    & pnpm run push
    $exitCode = $LASTEXITCODE
}

Set-Location $ProjectRoot

if ($exitCode -ne 0) {
    Write-Host "  ERRORE drizzle-kit push. Controlla DATABASE_URL nel .env" -ForegroundColor Red
    exit 1
}
Write-Host "  OK tabelle create su Supabase" -ForegroundColor Green

# ── Crea bucket Supabase Storage (via REST API, senza dipendenze Node) ────────
Write-Host "[6/6] Creazione bucket Supabase Storage..." -ForegroundColor Yellow

$supabaseUrl = $env:SUPABASE_URL
$serviceKey  = $env:SUPABASE_SERVICE_ROLE_KEY

$headers = @{
    "Authorization" = "Bearer $serviceKey"
    "Content-Type"  = "application/json"
}
$body = @{
    id                = "iusmk-media"
    public            = $true
    file_size_limit   = 52428800
    allowed_mime_types = @("image/jpeg","image/png","image/webp","image/jpg","video/mp4","video/quicktime","video/webm")
} | ConvertTo-Json

try {
    $null = Invoke-RestMethod -Uri "$supabaseUrl/storage/v1/bucket" -Method POST -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "  OK bucket iusmk-media creato" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errBody    = $null
    try { $errBody = $_ | ConvertFrom-Json } catch {}
    if ($statusCode -eq 400 -or ($errBody -and $errBody.error -like "*already exist*") -or $_.ToString() -like "*already exist*") {
        Write-Host "  OK bucket iusmk-media già esiste" -ForegroundColor Green
    } else {
        Write-Host "  ATTENZIONE: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  (Se il bucket non esiste, crealo manualmente su Supabase Dashboard → Storage)" -ForegroundColor Gray
    }
}

# ── Verifica Vercel CLI ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "Verifica Vercel CLI..." -ForegroundColor Yellow
try {
    $vercelVer = & vercel --version 2>&1
    Write-Host "  OK Vercel CLI $vercelVer" -ForegroundColor Green
} catch {
    Write-Host "  Vercel CLI non trovato, installazione..." -ForegroundColor Yellow
    & npm install -g vercel
    Write-Host "  OK Vercel CLI installato" -ForegroundColor Green
}

Write-Host ""
Write-Host "Verifica login Vercel..." -ForegroundColor Yellow
$vercelWho = & vercel whoami 2>&1
if ($LASTEXITCODE -ne 0 -or $vercelWho -match "error|not logged") {
    Write-Host "  Non sei loggato su Vercel. Esegui: vercel login" -ForegroundColor Yellow
    & vercel login
} else {
    Write-Host "  OK loggato come: $vercelWho" -ForegroundColor Green
}

# ── Riepilogo ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETATO!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ora esegui i seguenti comandi per il deploy:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  STEP A — Deploy BACKEND:" -ForegroundColor White
Write-Host "    cd artifacts\api-server" -ForegroundColor Cyan
Write-Host "    vercel --prod" -ForegroundColor Cyan
Write-Host "    [Rispondi: Y, account tuo, N, iusmk-api, .]" -ForegroundColor Gray
Write-Host ""
Write-Host "  STEP B — Copia l'URL del backend (es. https://iusmk-api.vercel.app)" -ForegroundColor White
Write-Host "  e aggiornalo nel .env: VITE_API_URL=https://iusmk-api.vercel.app" -ForegroundColor Gray
Write-Host ""
Write-Host "  STEP C — Deploy FRONTEND:" -ForegroundColor White
Write-Host "    cd ..\barber-artist" -ForegroundColor Cyan
Write-Host "    vercel --prod" -ForegroundColor Cyan
Write-Host "    [Rispondi: Y, account tuo, N, iusmk, .]" -ForegroundColor Gray
Write-Host ""
Write-Host "  STEP D — Configura env vars Vercel:" -ForegroundColor White
Write-Host "    cd ..\.." -ForegroundColor Cyan
Write-Host "    powershell -ExecutionPolicy Bypass -File deploy-vercel-env.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login admin sito:" -ForegroundColor Yellow
Write-Host "  Username: iusmk  |  Password: iusmk123!  (i minuscola)" -ForegroundColor White
Write-Host ""
