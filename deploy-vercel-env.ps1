# ============================================================
# IUSMK.COM — Configura env vars su Vercel
# Esegui DOPO aver fatto il primo deploy di api-server e barber-artist:
#   powershell -ExecutionPolicy Bypass -File deploy-vercel-env.ps1
# ============================================================

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  IUSMK.COM — Configurazione env vars Vercel" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Carica .env
if (-not (Test-Path "$ProjectRoot\.env")) {
    Write-Host "File .env non trovato!" -ForegroundColor Red
    exit 1
}

$envVars = @{}
Get-Content "$ProjectRoot\.env" | ForEach-Object {
    if ($_ -match '^\s*([^#=\s][^=]*)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

# Chiedi URL reale del backend
Write-Host "Inserisci l'URL del BACKEND deployato su Vercel" -ForegroundColor Yellow
Write-Host "(es. https://iusmk-api.vercel.app):" -ForegroundColor Yellow
$backendUrl = Read-Host "VITE_API_URL"
if ($backendUrl) { $envVars["VITE_API_URL"] = $backendUrl }

# Chiedi URL reale del frontend
Write-Host ""
Write-Host "Inserisci l'URL del FRONTEND deployato su Vercel" -ForegroundColor Yellow
Write-Host "(es. https://iusmk.vercel.app) — serve per i link email di reset password:" -ForegroundColor Yellow
$frontendUrl = Read-Host "APP_URL"
if ($frontendUrl) { $envVars["APP_URL"] = $frontendUrl }

# ── Backend env vars ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Configurazione env vars per il BACKEND (iusmk-api)..." -ForegroundColor Cyan
Set-Location "$ProjectRoot\artifacts\api-server"

$backendVars = @(
    "DATABASE_URL", "JWT_SECRET", "ADMIN_JWT_SECRET", "VIDEO_JWT_SECRET",
    "PASSWORD_SALT", "ADMIN_PASSWORD_HASH", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
    "APP_URL", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
    "OPENAI_API_KEY", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"
)

$tmpEnvFile = "$env:TEMP\iusmk_vercel_val.txt"

foreach ($var in $backendVars) {
    $val = $envVars[$var]
    if ($val -and $val.Length -gt 0) {
        Write-Host "  → $var" -ForegroundColor Gray
        # Scrivi il valore su file temporaneo ed usa < per stdin (evita problemi con caratteri speciali)
        [System.IO.File]::WriteAllText($tmpEnvFile, $val, [System.Text.Encoding]::UTF8)
        $result = & cmd /c "vercel env add $var production < `"$tmpEnvFile`"" 2>&1
        Write-Host "  OK $var" -ForegroundColor Green
    } else {
        Write-Host "  - $var (vuota, skip)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Rideploy backend con le nuove env vars..." -ForegroundColor Yellow
vercel --prod
Write-Host "  ✓ Backend ridistribuito" -ForegroundColor Green

# ── Frontend env vars ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Configurazione env vars per il FRONTEND (iusmk)..." -ForegroundColor Cyan
Set-Location "$ProjectRoot\artifacts\barber-artist"

$frontendVars = @("VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VAPID_PUBLIC_KEY")

foreach ($var in $frontendVars) {
    $val = $envVars[$var]
    if ($val -and $val.Length -gt 0) {
        Write-Host "  → $var" -ForegroundColor Gray
        [System.IO.File]::WriteAllText($tmpEnvFile, $val, [System.Text.Encoding]::UTF8)
        $result = & cmd /c "vercel env add $var production < `"$tmpEnvFile`"" 2>&1
        Write-Host "  OK $var" -ForegroundColor Green
    }
}
Remove-Item $tmpEnvFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Rideploy frontend con le nuove env vars..." -ForegroundColor Yellow
vercel --prod
Write-Host "  ✓ Frontend ridistribuito" -ForegroundColor Green

Set-Location $ProjectRoot

# ── Riepilogo finale ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  DEPLOY COMPLETATO!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Cose rimaste da fare manualmente su Vercel Dashboard:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. SumUp (Settings → iusmk-api → Environment Variables):" -ForegroundColor White
Write-Host "     SUMUP_API_KEY=..." -ForegroundColor Gray
Write-Host "     SUMUP_MERCHANT_EMAIL=..." -ForegroundColor Gray
Write-Host "     SUMUP_WEBHOOK_SECRET=..." -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Webhook SumUp:" -ForegroundColor White
Write-Host "     URL: $backendUrl/api/sumup/webhook" -ForegroundColor Gray
Write-Host "     Evento: CHECKOUT_STATUS_CHANGED" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Dominio custom (se richiesto):" -ForegroundColor White
Write-Host "     Vercel Dashboard → il tuo progetto → Settings → Domains" -ForegroundColor Gray
Write-Host ""
Write-Host "  Login admin:" -ForegroundColor Yellow
Write-Host "  Username: iusmk  |  Password: iusmk123!" -ForegroundColor White
Write-Host ""
