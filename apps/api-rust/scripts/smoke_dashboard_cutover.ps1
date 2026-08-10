# Dashboard cutover smoke against api-rust on :8000.
# Prerequisites: api-rust `serve` running with MASSIVE_API_KEY.
# Usage (from repo root):
#   powershell -File apps/api-rust/scripts/smoke_dashboard_cutover.ps1

$ErrorActionPreference = "Continue"
$base = $env:API_BASE
if (-not $base) { $base = "http://127.0.0.1:8000" }

$pass = 0
$fail = 0
$results = @()

function Assert-Ok($name, $cond, $detail = "") {
  if ($cond) {
    $script:pass++
    $script:results += [pscustomobject]@{ Status = "PASS"; Name = $name; Detail = $detail }
    Write-Host "  PASS  $name  $detail" -ForegroundColor Green
  } else {
    $script:fail++
    $script:results += [pscustomobject]@{ Status = "FAIL"; Name = $name; Detail = $detail }
    Write-Host "  FAIL  $name  $detail" -ForegroundColor Red
  }
}

function Get-Json($path, $method = "GET", $body = $null, $session = $null) {
  $uri = "$base$path"
  $params = @{
    Uri = $uri
    Method = $method
    UseBasicParsing = $true
    TimeoutSec = 120
  }
  if ($session) { $params.WebSession = $session }
  if ($null -ne $body) {
    $params.ContentType = "application/json"
    $params.Body = ($body | ConvertTo-Json -Compress -Depth 8)
  }
  try {
    $r = Invoke-WebRequest @params
    return @{
      ok = $true
      status = [int]$r.StatusCode
      json = ($r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue)
      raw = $r.Content
      headers = $r.Headers
      session = $session
    }
  } catch {
    $resp = $_.Exception.Response
    $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
    $text = ""
    try {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $text = $sr.ReadToEnd()
    } catch {}
    return @{ ok = $false; status = $code; json = $null; raw = $text; error = "$_" }
  }
}

Write-Host "`n=== Dashboard cutover smoke → $base ===`n" -ForegroundColor Cyan

# 1. Health
$h = Get-Json "/api/health"
Assert-Ok "GET /api/health" ($h.ok -and $h.status -eq 200) "status=$($h.status)"

# 2. Session anonymous
$s = Get-Json "/api/auth/session"
Assert-Ok "GET /api/auth/session (anon)" (
  $s.ok -and $s.json.authenticated -eq $false
) "authenticated=$($s.json.authenticated)"

# 3. Scan universe FE shape
$u = Get-Json "/api/scan/universe"
Assert-Ok "GET /api/scan/universe symbols[]" (
  $u.ok -and $null -ne $u.json.symbols -and $u.json.universe_size -ge 1
) "size=$($u.json.universe_size) first=$($u.json.symbols[0])"

# 4. Scan envelope
$scan = Get-Json "/api/scan"
Assert-Ok "GET /api/scan envelope" (
  $scan.ok -and $scan.json.view -and $scan.json.rows -and ($scan.json.rows.Count -ge 1)
) "rows=$($scan.json.rows.Count) view_src=$($scan.json.view.source)"
Assert-Ok "GET /api/scan building-fill" (
  ($scan.json.rows | Where-Object { $_.symbol -and $_.status }).Count -eq $scan.json.rows.Count
) "all rows have symbol+status"

# 5. Personas
$p = Get-Json "/api/personas"
Assert-Ok "GET /api/personas array" (
  $p.ok -and ($p.json -is [System.Array]) -and $p.json.Count -ge 1
) "n=$($p.json.Count)"

# 6. Ticker bundle (live)
Write-Host "`n  (fetching SPY chain — may take 10–60s)..." -ForegroundColor DarkGray
$t = Get-Json "/api/ticker/SPY"
Assert-Ok "GET /api/ticker/SPY 200" ($t.ok -and $t.status -eq 200) "status=$($t.status)"
if ($t.ok -and $t.json) {
  $ms = $t.json.market_state
  $sig = $t.json.signals
  $meta = $t.json.meta
  $ai = $t.json.ai_eval
  Assert-Ok "bundle.market_state.price" ($null -ne $ms.price -and $ms.price -gt 0) "price=$($ms.price)"
  Assert-Ok "bundle.market_state.gamma_flip" ($null -ne $ms.gamma_flip) "flip=$($ms.gamma_flip)"
  Assert-Ok "bundle.signals.opportunity_score" ($null -ne $sig.opportunity_score) "score=$($sig.opportunity_score)"
  Assert-Ok "bundle.signals.opportunity_tier" ($null -ne $sig.opportunity_tier) "tier=$($sig.opportunity_tier)"
  Assert-Ok "bundle.signals.prime_prompt_eligible" ($null -ne $sig.prime_prompt_eligible) "ppe=$($sig.prime_prompt_eligible)"
  Assert-Ok "bundle.ai_eval.state_fingerprint" ($null -ne $ai.state_fingerprint -and $ai.state_fingerprint -ne "") "fp=$($ai.state_fingerprint)"
  Assert-Ok "bundle.ai_eval.changed" ($null -ne $ai.changed) "changed=$($ai.changed)"
  Assert-Ok "bundle.meta.served_at" ($null -ne $meta.served_at) "served_at=$($meta.served_at)"
  Assert-Ok "bundle.meta.cache" ($null -ne $meta.cache) "hit=$($meta.cache.hit)"
  Assert-Ok "bundle.meta.freshness" ($null -ne $meta.freshness) "stale=$($meta.freshness.stale)"
  Assert-Ok "bundle.strike_profile.strikes" ($null -ne $t.json.strike_profile.strikes) "n=$($t.json.strike_profile.strikes.Count)"
  Assert-Ok "bundle.position_eval key" ($t.raw -match '"position_eval"') "present"

  # 7. Contract lookup — pick ATM-ish from strike profile if possible
  $strikes = @($t.json.strike_profile.strikes)
  if ($strikes.Count -gt 0) {
    $near = $strikes | Sort-Object { [math]::Abs($_.strike - $ms.price) } | Select-Object -First 1
    $exp = if ($ms.max_pain_expiration) { $ms.max_pain_expiration } else { $null }
    # Try a few contracts from profile if available; else skip with note
    if ($near.strike) {
      $cq = "/api/contract/SPY?expiration=$((Get-Date).ToString('yyyy-MM-dd'))&strike=$($near.strike)&right=call"
      # Prefer an expiration from chain if we can guess from max_pain
      if ($exp) {
        $cq = "/api/contract/SPY?expiration=$exp&strike=$($near.strike)&right=call"
      }
      $c = Get-Json $cq
      # 200 with body or 404 are both valid contract semantics for wrong exp
      Assert-Ok "GET /api/contract (attempt)" (
        $c.status -eq 200 -or $c.status -eq 404
      ) "status=$($c.status) strike=$($near.strike)"
    }
  }

  # 8. Rec status / export (anonymous)
  $rs = Get-Json "/api/recommendation/status/SPY"
  Assert-Ok "GET /api/recommendation/status/SPY" (
    $rs.ok -and $null -ne $rs.json.gate -and $null -ne $rs.json.availability
  ) "in_app=$($rs.json.availability.in_app_enabled) gate=$($rs.json.gate.state)"

  $re = Get-Json "/api/recommendation/export/SPY"
  Assert-Ok "GET /api/recommendation/export/SPY" (
    $re.ok -and $re.json.ticker -eq "SPY" -and $null -ne $re.json.context
  ) "has context+prompt"
}

# 9. Price path A
$pr = Get-Json "/api/price/SPY"
Assert-Ok "GET /api/price/SPY" ($pr.ok -and $pr.json.price -gt 0) "price=$($pr.json.price) src=$($pr.json.source)"

# 10. Login smoke (demo seed if configured)
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Get-Json "/api/auth/login" "POST" @{ email = "smoke@convexa.io"; password = "smokepass1" } $session
if ($login.ok -and $login.json.authenticated) {
  Assert-Ok "POST /api/auth/login demo seed" $true "user=$($login.json.user.email)"
  $sg = Get-Json "/api/positions/sim-trade/gate" "POST" @{} $session
  Assert-Ok "POST /api/positions/sim-trade/gate" ($sg.ok -and $sg.json.authorized -eq $true) "authorized=$($sg.json.authorized)"
} else {
  Assert-Ok "POST /api/auth/login demo seed" $false "status=$($login.status) (set AUTH_DEMO_SEED if expected)"
}

Write-Host "`n=== Summary: $pass passed, $fail failed ===`n" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
if ($fail -gt 0) { exit 1 } else { exit 0 }
