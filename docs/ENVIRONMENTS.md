# Environments — dev / test / prod

> Working design for Convexa API + research. Complements `apps/api/.env.example`
> and `docs/API_RUST_DEPLOY.md`. Not a Spire feature pipeline item.

## Why

One stack (today: Railway “prod” + laptop) mixes:

- live vendor spend (Massive)
- durable user/scan data
- research CLIs (`join-outcomes`, `score-lab`)
- signup-open conformance runs

Separate **dev / test / prod** environments let us:

| Goal | Without multi-env | With multi-env |
|------|-------------------|----------------|
| Safe research joins | Risk pointing CLI at prod with wrong flags | `test` DB copy or read-only role |
| Roll out scoring / scanner changes | Ship straight to users | Validate on `test` first |
| Swap data providers | Edit prod vars | Provider pin per env |
| CI auth-signup | Fight prod lockdown | `test` has registration open |
| Reproduce history_samples bugs | Guess from prod | Isolated store + fixtures |

## Environment definitions

| Env | Purpose | Data | Vendor | Registration |
|-----|---------|------|--------|--------------|
| **dev** | Laptop day-to-day | Local disk JSON/SQLite under `data/` | Real Massive key OK (personal) | Open (`AUTH_REGISTRATION_OPEN=1`) |
| **test** | CI + pre-prod smoke + research | Separate DB or disposable `data/test/*` | Real or delayed/fixture later | Open |
| **prod** | Users | Railway Postgres | Real Massive | Closed unless intentional |

Optional later: **staging** = prod-like Railway service with synthetic users only.

## Naming

Use a single label:

```text
APP_ENV=dev|test|prod|staging
```

Host variable groups (Railway, GitHub Actions, local files) should set the same name.
Do not invent a second parallel scheme (`NODE_ENV` alone is not enough for the API).

## File layout (local)

All real secrets stay gitignored (`apps/api/.env`, `apps/api/.env.*` except `*.example`).

```text
apps/api/.env.example      # committed template (this repo)
apps/api/.env              # your default local (usually dev)
apps/api/.env.dev          # optional
apps/api/.env.test         # optional CI/laptop test
apps/api/.env.prod.local   # optional, research-only prod credentials — high caution
```

Loader today (`load_dotenv` in `main.rs`): first existing of  
`apps/api/.env` → repo-root `.env` → cwd `.env`.  
**Layered `.env.$APP_ENV` is not auto-loaded yet** — set vars in the one file you use, or export in the shell / host. Auto-layering is a small follow-up if we want it.

## Infrastructure mapping (recommended)

| Env | API host | Front end | Postgres | Notes |
|-----|----------|-----------|----------|--------|
| dev | `localhost:8000` | Vite `:4200` proxy | none / optional local PG | `SCAN_STORE=disk` |
| test | Railway service `convexa-api-test` *or* CI ephemeral | optional Pages preview | separate `DATABASE_URL` | Never share prod URL |
| prod | `convexa-production.up.railway.app` | `convexa.pages.dev` | Railway Postgres | `SCAN_STORE=postgres`, metrics token, rate limit |

Cloudflare Pages: keep `API_ORIGIN` (or equivalent) pointed at the env’s API.

## Data providers

Today the live path is **Massive** (`MASSIVE_API_KEY`, `DATA_FEED`, `MASSIVE_REST_BASE`).

Multi-env benefits:

| Pattern | Use |
|---------|-----|
| Same provider, different keys | Dev key with lower limits vs prod key |
| Delayed vs realtime | `DATA_FEED=delayed` on test to reduce cost |
| Fixture / offline | Research score-lab after `join-outcomes` artifact exists (no Massive) |
| Future second vendor | `DATA_PROVIDER=…` + port (P1 MarketDataPort already points this way) |

Do **not** silently change prod provider without a measured cutover plan.

## Research track (join-outcomes / score-lab)

```text
scanner slow-lane → structure samples (scan store)
                 → join-outcomes (Massive daily bars) → data/research/outcomes_*.json
                 → score-lab (offline) → data/research/score_lab_*.json
```

| Step | Env advice |
|------|------------|
| Capture samples | `dev` or `prod` scanner running; prefer a **test** universe size if burn is a concern |
| join-outcomes | Needs `MASSIVE_API_KEY` + store with samples; prefer **read-only** DB URL or restored dump on `test` |
| score-lab | Can run fully offline once outcomes file exists |

**Prod anomaly to fix before trusting research against prod:**  
`history_samples > 0` on `/api/health` but `/api/scan/SPY/history` returns `samples: []`.  
Same `read_structure_history` path is used by `join-outcomes`. Investigate Postgres read errors / symbol keys before burning vendor quota.

## Rollout discipline (minimal)

1. Change lands on `main` behind normal CI.  
2. Deploy **test** (when it exists) → run health + scan history + optional score-lab.  
3. Deploy **prod**.  
4. Never run destructive migrations on prod without a backup; scan/auth migrations are in `apps/api` Postgres migrator — test first.

## Hard rules

1. **No secrets in git** — only `.env.example` and this doc.  
2. **Prod DB URL never in CI** for write tests; use test DB or mocks.  
3. **`AUTH_REGISTRATION_OPEN` open only on dev/test** (or temporary prod exceptions).  
4. **Stable** `AUTH_SESSION_SIGNING_KEY` + `AI_KEY_ENCRYPTION_KEY` on any durable env.  
5. **`METRICS_SECRET_TOKEN` set on prod** (and test if exposed).  
6. Research laptops: prefer artifact export over long-lived full prod admin credentials.

## Implementation backlog (not done yet)

| Item | Priority | Notes |
|------|----------|--------|
| Harden `.env.example` to match Rust names | **done (this change)** | `AUTH_REGISTRATION_OPEN`, `SCAN_*_SECS`, research section |
| Auto-load `.env.$APP_ENV` after base `.env` | M | Small `load_dotenv` change |
| Railway `convexa-api-test` service + var group | H for safe research | Separate `DATABASE_URL` |
| Pages preview → test API | M | |
| Fixture Massive / recorded daily bars for CI join | M | Unblocks join tests without vendor |
| Fix structure-history read vs count mismatch | **H** | Blocks honest research on prod |
| `DATA_PROVIDER` wired as real selector | L | After second provider exists |

## Quick start (dev)

```bash
cp apps/api/.env.example apps/api/.env
# edit: MASSIVE_API_KEY, APP_ENV=dev, AUTH_REGISTRATION_OPEN=1, AUTH_COOKIE_SECURE=0
npm run serve:api
curl -sS http://127.0.0.1:8000/api/health
```

## Production runtime guardrails

Production is fail-closed before the API listener binds. Set `APP_ENV=prod`, build with
`--features postgres`, provide `DATABASE_URL`, an explicit `ALLOWED_BROWSER_ORIGINS`,
`METRICS_SECRET_TOKEN` (base64url, at least 32 decoded bytes), addressed session/encryption key
maps, and `SESSION_CHAIN_ARCHIVE_BODY_ROOT`. Production does not fall back to JSON, SQLite,
memory, wildcard CORS, or ephemeral key material.

The archive-root probe proves only path reachability and writeability. For release evidence, keep
replicas at one during startup, run `api-rust production-volume-drill prepare`, replace/restart the
service, then run `verify` and retain the generated receipt with before/after platform evidence.
Health is not volume-durability proof; deployment and QA evidence remain required for AC7/AC26.
