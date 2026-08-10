# Dashboard cutover smoke (api-rust)

## Goal

Run the **existing** Vite dashboard against **api-rust** on `:8000` (same proxy as Python FastAPI) and verify FE-critical wire shapes.

Vite already proxies `/api` → `http://127.0.0.1:8000` (`apps/dashboard/vite.config.mts`). No FE config change is required for a local smoke.

## 1. Start api-rust

From repo root (PowerShell):

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH
$env:AUTH_COOKIE_SECURE = "0"                 # http://localhost
$env:AUTH_REGISTRATION_OPEN = "1"             # optional
$env:AUTH_DEMO_SEED = "smoke@convexa.io:smokepass1"
$env:SCAN_MARKET_HOURS_ONLY = "0"             # allow overnight smoke
$env:WARM_ENABLED = "1"
$env:WARM_SYMBOLS = "SPY,QQQ,NVDA"
$env:SCAN_ENABLED = "1"
$env:HTTP_BIND = "127.0.0.1:8000"
$env:RUST_LOG = "info,api_rust=info"

# MASSIVE_API_KEY is loaded from apps/api/.env automatically
cargo run -p api-rust -- serve
```

Open progressive demo: http://127.0.0.1:8000/

## 2. API-only smoke (no browser)

With serve running:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/api/scripts/smoke_dashboard_cutover.ps1
```

Expect **25/25 PASS** (health, session, scan universe shape, scan rows, personas, ticker bundle FE keys, contract, rec status/export, price, login, sim-trade gate).

## 3. Dashboard UI

```powershell
# If npx is blocked by execution policy:
cmd /c "npm exec nx -- serve dashboard"
```

Open http://localhost:4200/

Manual checks:

| Route | Expect |
|-------|--------|
| `/scanner` | Table fills (default view); scores/tiers when sweep has computed; live prices when WS ticks |
| `/ticker/SPY` | Price + GEX levels + score tier; freshness line; SSE live tape (may be quiet after hours) |
| Sign-in | `smoke@convexa.io` / `smokepass1` if demo seed set |
| Settings | Theme/default ticker after login |
| AI rec panel | Status/export work; Get recommendation may show `no_key` without `ANTHROPIC_API_KEY` |

## FE wire fixes applied for cutover

- `GET /api/scan/universe` → `{ symbols, universe_size }` (was `universe`/`size`)
- `GET /api/ticker/{t}` `meta` → `{ served_at, cache, freshness }` (FE requires these)
- Signals → `opportunity_tier`, `prime_prompt_eligible`
- `ai_eval.changed`
- Richer `market_state` nulls for optional fields the TS types declare

## BYO AI key + shared provider keys

Settings UI already calls `GET/PUT/DELETE /api/auth/ai-key` (write-only; masked last-4 only).

| Env | Purpose |
|-----|---------|
| `AI_KEY_ENCRYPTION_KEY` | Passphrase for encrypting stored user keys (set in prod) |
| `ANTHROPIC_API_KEY` | Shared Anthropic key (admin pool) |
| `OPENAI_API_KEY` | Shared OpenAI key |
| `XAI_API_KEY` | Shared Grok/xAI key |
| `GEMINI_API_KEY` | Shared Gemini key |
| `AUTH_ADMIN_EMAILS` | Comma list; shared keys only for these users (after own-key miss) |
| `AI_REC_LOCAL_ONLY=1` | Skip paid LLM; use rule-based setups from signals |
| `AI_REC_MODEL_ANTHROPIC` / `_OPENAI` / `_XAI` / `_GEMINI` | Optional model overrides |

**Resolution order:** user BYO key (any provider, auto-detected from prefix) → shared env key if admin → `no_key`.

Provider auto-detect: `sk-ant-`→Anthropic, `sk-`→OpenAI, `xai-`→xAI, `AIza`→Gemini. Optional body field `{ "key": "...", "provider": "openai" }`.

## Known residual gaps (UI may degrade, not blank)

- **Done:** IV skew + term structure (full-chain; cached on analytics snapshot)
- **Done:** VWAP bands (minute aggs parallel fetch; ±2σ fed into signals)
- **Done:** market_context pack (post-score; 400d daily OHLC; trend/shape/flow/ATR)
- **Done:** dark pool / off_exchange (parallel trades fetch; levels+blocks; score confluence)
- **Done:** iv_rank (CM30 sample write-through + rolling window; JSON store under data/)
- **Perf:** scanner mutex released during slow compute; scan store debounced flush (~2s);
  gex singleflight + scanner prefers warm cache (`load_or_compute`)
- **Done:** Google OAuth routes (`/api/auth/google/*`); `google_available` false until
  `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` set (FE button stays disabled)
- **Done:** Broker credential trio + book GET/refresh (default `POSITIONS_PROVIDER=stub`;
  `webull` returns typed `adapter_fault` until native client lands)
- Scan auth lockdown (Python private-testing gate) not mirrored — anon can read scan
- FE Settings soft-warns non-`sk-ant-` keys but still submits; backend accepts any provider
- **Durable DB:** build `--features postgres` + `DATABASE_URL` for multi-instance auth/IV
  (see `docs/API_RUST_DEPLOY.md`). Default local remains JSON-on-disk.
- **Docker/Railway:** `apps/api/Dockerfile` (postgres feature on). See `docs/API_RUST_DEPLOY.md`.
