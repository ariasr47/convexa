# Convexa — deploy runbook (Rust)

> **Last updated 2026-08-10.** Python FastAPI is **archived** (`archive/api-python/`). Production
> backend is **`api-rust`** (Axum). The scanner is **embedded in `serve`** — not a separate
> `python worker.py` process.
>
> Companion: [`API_RUST_DEPLOY.md`](./API_RUST_DEPLOY.md) (image, env, local).  
> Frontend first-time Pages setup: [`CLOUDFLARE_PAGES_SETUP.md`](./CLOUDFLARE_PAGES_SETUP.md).  
> Improvement checklist: [`IMPROVEMENT_BACKLOG.md`](./IMPROVEMENT_BACKLOG.md) §1.1–1.3.
>
> **This is an OWNER runbook.** Secrets stay in Railway / Cloudflare dashboards — never commit them.

---

## Topology (current)

| Piece                  | Host                                   | Process                                           |
| ---------------------- | -------------------------------------- | ------------------------------------------------- |
| SPA                    | Cloudflare Pages (`convexa.pages.dev`) | Static Vite build + Pages Function proxy `/api/*` |
| API + scanner + warmer | Railway service **`api`**              | **One** container: `api-rust serve`               |
| DB                     | Railway **Postgres** plugin            | Shared by all replicas                            |

```text
Browser  →  https://convexa.pages.dev
              └─ /api/*  →  Pages Function  →  Railway api-rust
              └─ static assets from Pages
```

**Scanner:** started inside `serve` when `SCAN_ENABLED` is not off (default on). Shared durable
store = Postgres when `DATABASE_URL` is set and the image is built with `--features postgres`
(the production Dockerfile always enables postgres).

**Do not** deploy a second service with `python worker.py` — that entrypoint no longer exists in
the image.

---

## Naming (Railway)

- **Project** = product: `convexa`
- **Service** = role: **`api`** (not `convexa`, not `api-rust` required)
- **Postgres** plugin name stays Railway’s default (reference `${{Postgres.DATABASE_URL}}`)
- Optional second service only if you later split a dedicated scanner binary; today **one `api` service** is correct

---

## Phase 1 — Railway `api`

1. Project `convexa` → service **`api`** → Deploy from GitHub `ariasr47/convexa`.
2. **Build**
   - Root Directory: **empty** (repo root)
   - Builder: **Dockerfile**
   - Dockerfile path: **`apps/api/Dockerfile`**
3. Add **Postgres** plugin if missing.
4. **Variables** (service `api`):

   **Required**

   | Variable                   | Notes                                                  |
   | -------------------------- | ------------------------------------------------------ |
   | `DATABASE_URL`             | `${{Postgres.DATABASE_URL}}`                           |
   | `MASSIVE_API_KEY`          | Vendor key                                             |
   | `AUTH_SESSION_SIGNING_KEY` | Stable random; keep across deploys or all sessions die |
   | `AI_KEY_ENCRYPTION_KEY`    | Stable Fernet/key material; keep across deploys        |
   | `AUTH_COOKIE_SECURE`       | `true` in prod                                         |
   | `AUTH_COOKIE_SAMESITE`     | `lax` (Pages Function keeps cookie first-party)        |

   **Security / capacity**

   | Variable                    | Notes                                                                                                                                                |
   | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `PUBLIC_RATE_LIMIT_PER_MIN` | Default **120** if unset. Per-IP limit on expensive routes (`/api/ticker/*`, `/api/stream/*`, market slices, scan). **`0` = disabled** (local only). |
   | `METRICS_SECRET_TOKEN`      | If set, `GET /api/_metrics` requires `Authorization: Bearer …` or `X-Metrics-Token`. Pages edge already 404s this path.                              |
   | `ALLOWED_ORIGINS`           | Optional defence-in-depth; browser is same-origin via Pages Function                                                                                 |

   **Scanner / warm (defaults are fine)**

   | Variable                          | Notes                                         |
   | --------------------------------- | --------------------------------------------- |
   | `SCAN_ENABLED`                    | Unset or `1` — scanner loop inside `serve`    |
   | `SCAN_MARKET_HOURS_ONLY`          | Default on — idles slow lane outside coverage |
   | `WARM_ENABLED`                    | Default on — pre-warm liquid names            |
   | `WARM_SYMBOLS` / `LIQUID_SYMBOLS` | Optional override lists                       |
   | `SCAN_UNIVERSE_PATH`              | Image default `/app/universe.json`            |

   **Auth lockdown (private testing)**

   | Variable                 | Notes                                                                                 |
   | ------------------------ | ------------------------------------------------------------------------------------- |
   | `AUTH_REGISTRATION_OPEN` | Leave unset/`false` in prod                                                           |
   | Owner seed vars          | Whatever your current seed path is (`OWNER_*` / `SEED_ACCOUNTS` — match live service) |
   | `AI_REC_ADMIN_EMAILS`    | Your login for shared-key allowance                                                   |

5. **Start command:** leave default image `CMD` (`api-rust serve` on `$PORT`). Do **not** set `python worker.py`.
6. **Replicas:** **1 is the supported default.** Multi-replica requires Postgres (already) for scan/auth and accepts shared scan latest-wins. **AI-rec daily caps remain process-local** (`ai_meter` on `/api/health`) — N replicas ≈ N× cap until a shared meter ships. Do not run a second _Python_ worker.

7. **Deploy**, then smoke the **Railway URL** directly (Phase 3).

---

## Phase 2 — Cloudflare Pages (frontend)

1. Pages project on `ariasr47/convexa` (or fork).
2. Build (repo root, framework **None**):
   - Build command: `npx nx build @convexa/dashboard --configuration=production`
   - Output directory: `apps/dashboard/dist`
   - Root directory: empty
3. Env:
   - `API_ORIGIN=https://convexa-production.up.railway.app` (no trailing slash; match your Railway public domain)
   - `NODE_VERSION` = value from `.nvmrc` (e.g. `26.7.0`)
4. **Continuous deploy:** connect the GitHub repo so **every push to `main`** builds Pages. That is the SPA CD path.
5. Confirm Pages Function still proxies `/api/*` to `API_ORIGIN` (see `functions/api/[[path]].ts`).

---

## Phase 2b — Continuous deploy (backend)

| Surface             | CD mechanism                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Pages (SPA)**     | Cloudflare ↔ GitHub: auto-build on `main` (enable in CF dashboard if not already)          |
| **Railway (`api`)** | Railway ↔ GitHub: auto-deploy on `main` (service settings → Source → wait for CI optional) |

**Recommended:** Railway **“Wait for CI”** so a red `CI` workflow blocks deploy.

Optional GitHub Action: [`.github/workflows/deploy-smoke.yml`](../.github/workflows/deploy-smoke.yml) runs **post-merge smoke** against public URLs when `SMOKE_API_ORIGIN` is set as a repo secret (read-only checks; no deploy credentials required).

---

## Phase 3 — Prod smoke checklist

Run after every production deploy (Railway and/or Pages). Replace hosts with yours.

### A. API direct (Railway)

```bash
# A1 — liveness + durable backend
curl -sS "$API/api/health" | tee /tmp/health.json
# Expect: status=ok, service=api-rust, durable_store=postgres

# A2 — personas (anon)
curl -sS -o /dev/null -w "%{http_code}\n" "$API/api/personas"
# Expect: 200

# A3 — ticker (vendor + GEX path)
curl -sS "$API/api/ticker/SPY" | head -c 200
# Expect: JSON with market_state; optional vol_normalized_gex object or null

# A4 — scan (anon-open on current Rust API)
curl -sS "$API/api/scan" | head -c 400
# Expect: 200 + rows (may be building briefly after cold boot)
# After ~2–5 min RTH: rows with scores, sweep heartbeat present

# A5 — structure history
curl -sS "$API/api/scan/SPY/history?limit=5"
# Expect: 200 + { symbol, samples, basis }; samples may be [] until slow-lane samples land

# A6 — rate limit (optional): burst > PUBLIC_RATE_LIMIT_PER_MIN against /api/ticker/SPY
# Expect: eventually 429 with a clear body
```

| Check | Pass criteria                            |
| ----- | ---------------------------------------- |
| A1    | `durable_store=postgres` in prod         |
| A3    | Bundle returns; no 5xx                   |
| A4    | Not permanent empty after warm-up in RTH |
| A5    | Endpoint exists (not 404)                |
| A6    | 429 when limit enabled                   |

### B. Via Pages (end-to-end)

| #   | Action                                                   | Pass                                                          |
| --- | -------------------------------------------------------- | ------------------------------------------------------------- |
| B1  | Open `https://convexa.pages.dev`                         | SPA loads                                                     |
| B2  | Ticker `/ticker/SPY` signed out                          | Bundle + live tiles (SSE through Function)                    |
| B3  | Dealer grid shows **Vol-norm GEX** or honest unavailable | Not a blank error                                             |
| B4  | Structure path widget                                    | Empty “building” or samples — not crash                       |
| B5  | `/scanner`                                               | Rows + structure freshness (not infinite skeleton)            |
| B6  | `/api/_metrics` from Pages                               | **Not** publicly useful without token (Function block or 401) |
| B7  | Login + gated sim write                                  | Works signed-in; 403 signed-out                               |

### C. Scanner-specific

| #   | Pass                                                                 |
| --- | -------------------------------------------------------------------- |
| C1  | Railway logs show scanner loop / compute ok (not “scanner disabled”) |
| C2  | `SCAN_ENABLED=0` is **not** set in prod unless intentional           |
| C3  | Outside RTH, idle is OK; after open, rows refresh                    |

---

## Risks (know before deploy)

- **First Postgres bootstrap** for new tables is idempotent `CREATE IF NOT EXISTS` — watch first boot logs after schema additions (e.g. `scan_structure_history`).
- **Vendor cost:** warmer + scanner call Massive; market-hours gate reduces waste; rate limits protect public HTTP.
- **Multi-replica:** all replicas run embedded scanners if `SCAN_ENABLED` — prefer **1 replica** unless you accept duplicate vendor work (rows are latest-wins).
- **Secrets rotation** of `AUTH_SESSION_SIGNING_KEY` / `AI_KEY_ENCRYPTION_KEY` logs everyone out / breaks stored AI keys.

---

## Rollback

- **Railway:** redeploy previous successful deployment for service `api`.
- **Pages:** rollback deployment in Cloudflare.
- Stopping the API stops the embedded scanner; last scan rows remain in Postgres until overwritten.

---

## Quick local parity

```bash
# From repo root
npm run serve:api          # api-rust serve (JSON stores without DATABASE_URL)
npm run serve:dashboard    # :4200 proxies /api → :8000
```

Production-like binary:

```bash
docker build -f apps/api/Dockerfile -t convexa-api .
docker run --rm -p 8000:8000 \
  -e MASSIVE_API_KEY=... \
  -e AUTH_SESSION_SIGNING_KEY=... \
  -e AI_KEY_ENCRYPTION_KEY=... \
  -e DATABASE_URL=postgres://... \
  -e PUBLIC_RATE_LIMIT_PER_MIN=120 \
  convexa-api
```
