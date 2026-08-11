# apps/api (Rust) — Postgres + Docker / Railway deploy

**Status:** Python FastAPI is archived under `archive/api-python/`. Runtime is
Axum under `apps/api` (Cargo package name `api-rust`).

Public URL: `https://convexa-production.up.railway.app`  
Health: `service=api-rust`, `durable_store=postgres`.

## Durable stores

| Mode                          | When                                                               | Backends                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **JSON** (default local)      | No `DATABASE_URL`, or binary built without `--features postgres`   | `data/auth.json`, `data/iv_timeseries.json`, `data/scan.json`                                                                      |
| **Postgres** (multi-instance) | Binary built with `--features postgres` **and** `DATABASE_URL` set | Tables: `users`, `sessions`, `user_settings`, `credentials`, `iv_samples`, `scan_rows`, `scan_heartbeat`, `scan_structure_history` |

```bash
cargo build -p api-rust --release --features postgres
export DATABASE_URL=postgres://...
export MASSIVE_API_KEY=...
export AUTH_SESSION_SIGNING_KEY=...
export AI_KEY_ENCRYPTION_KEY=...
./target/release/api-rust serve
```

## Docker

Build from **repo root**:

```bash
docker build -f apps/api/Dockerfile -t convexa-api .
docker run --rm -p 8000:8000 \
  -e MASSIVE_API_KEY=... \
  -e AUTH_SESSION_SIGNING_KEY=... \
  -e AI_KEY_ENCRYPTION_KEY=... \
  -e DATABASE_URL=postgres://... \
  convexa-api
```

## Railway

1. Dockerfile path: **`apps/api/Dockerfile`**, Root Directory: **empty**.
2. Service may still be named `api-rust` on Railway (rename optional).
3. Variables: `DATABASE_URL`, `MASSIVE_API_KEY`, `AUTH_SESSION_SIGNING_KEY`,
   `AI_KEY_ENCRYPTION_KEY`, `AUTH_COOKIE_SECURE=true`, `WARM_SYMBOLS`, …
   Optional: `PUBLIC_RATE_LIMIT_PER_MIN` (default 120; `0` disables).
4. Domain: `convexa-production.up.railway.app` (Pages `API_ORIGIN` unchanged).
5. Smoke: full checklist in [`DEPLOY_RUNBOOK.md`](./DEPLOY_RUNBOOK.md) Phase 3 —
   at minimum `GET /api/health` → `status=ok`, `durable_store=postgres`,
   `scanner.enabled=true`.

## Local

```bash
cp apps/api/.env.example apps/api/.env   # once; fill MASSIVE_API_KEY etc.
npm run serve:api   # cargo run -p api-rust -- serve
```

See [`ENVIRONMENTS.md`](./ENVIRONMENTS.md) for dev/test/prod, research CLIs
(`join-outcomes` / `score-lab`), and multi-provider notes. Template of every
supported var: [`apps/api/.env.example`](../apps/api/.env.example).

## Windows note

This host may be `windows-gnu` without `dlltool`. Default builds omit the
`postgres` feature so JSON stores work. Use Docker for a postgres-enabled binary.
