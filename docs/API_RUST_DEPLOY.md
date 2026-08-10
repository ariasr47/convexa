# api-rust — Postgres + Docker / Railway deploy

This is the cutover path to retire the Python FastAPI service (`apps/api`) as the runtime backend.

## Durable stores

| Mode | When | Backends |
|------|------|----------|
| **JSON** (default local) | No `DATABASE_URL`, or binary built without `--features postgres` | `data/auth.json`, `data/iv_timeseries.json`, `data/scan.json` |
| **Postgres** (multi-instance) | Binary built with `--features postgres` **and** `DATABASE_URL` set | Tables: `users`, `sessions`, `user_settings`, `credentials`, `iv_samples`, `scan_rows`, `scan_heartbeat` |

Schema is idempotent (`CREATE TABLE IF NOT EXISTS`) and mirrors the Python postgres adapters enough for a shared Railway Postgres plugin.

```bash
# Local release with Postgres support (Linux / Docker — preferred)
cargo build -p api-rust --release --features postgres
export DATABASE_URL=postgres://...
export MASSIVE_API_KEY=...
export AUTH_SESSION_SIGNING_KEY=...
export AI_KEY_ENCRYPTION_KEY=...
./target/release/api-rust serve
```

Health payload includes `"durable_store": "postgres" | "json"`.

## Docker

Build from **repo root** (workspace needs `libs/quant-engine`):

```bash
docker build -f apps/api-rust/Dockerfile -t convexa-api-rust .
docker run --rm -p 8000:8000 \
  -e MASSIVE_API_KEY=... \
  -e AUTH_SESSION_SIGNING_KEY=... \
  -e AI_KEY_ENCRYPTION_KEY=... \
  -e DATABASE_URL=postgres://... \
  convexa-api-rust
```

The image always enables `--features postgres`. Without `DATABASE_URL` it falls back to JSON under `/app/data`.

## Railway (recommended service: `api-rust`)

### Before you click Deploy

Railway builds **from the GitHub branch**, not your uncommitted working tree. If
`apps/api-rust/`, `libs/quant-engine/`, root `Cargo.toml`, and `Cargo.lock` are
not on `main` (or whatever branch the service tracks), the image build fails
with a generic **"failed to build an image"** (missing `COPY` sources / no
Dockerfile).

```bash
# From repo root — confirm remote has the Rust workspace
git ls-files Cargo.toml Cargo.lock apps/api-rust/Dockerfile libs/quant-engine/src/lib.rs
# If empty: commit + push first, then redeploy.
```

1. Railway project **convexa** → New service from GitHub (branch with the files above).
2. Settings → **Dockerfile** path: `apps/api-rust/Dockerfile`, **Root Directory**: leave **empty** (repo root).  
   Do **not** set Root Directory to `apps/api-rust` — the Dockerfile `COPY`s workspace paths from monorepo root.
3. Attach **Postgres** plugin (or reuse existing).
4. Variables (minimum):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `MASSIVE_API_KEY` | secret |
| `AUTH_SESSION_SIGNING_KEY` | stable random (must not change across deploys) |
| `AI_KEY_ENCRYPTION_KEY` | stable random (must not change or stored keys die) |
| `AUTH_COOKIE_SECURE` | `true` |
| `HTTP_BIND` | optional — image uses `PORT` |
| `WARM_SYMBOLS` | e.g. `SPY,QQQ,NVDA` |
| `POSITIONS_PROVIDER` | `stub` until Webull client lands |
| `ANTHROPIC_API_KEY` / `AUTH_ADMIN_EMAILS` | optional shared AI pool |
| `REDIS_URL` | optional shared price cache |

5. Generate domain → point Cloudflare Pages `API_ORIGIN` at `https://<api-rust>.up.railway.app`.
6. Smoke: `GET /api/health` → `status=ok`, `durable_store=postgres`.

**Scanner worker:** api-rust embeds the scanner when `SCAN_ENABLED=1` (default). A separate Python `scanner-worker` is **not** required for the Rust path.

## Cutover / remove Python

Order of operations:

1. Deploy **api-rust** beside existing Python `api` (same Postgres optional but recommended for auth continuity only if you migrate rows — greenfield is fine).
2. Point Pages / Vite proxy at api-rust; soak.
3. Stop Python `api` + `scanner-worker` services.
4. Delete or archive `apps/api` runtime (keep characterization fixtures under `apps/api/tests` if still useful for quant-engine).

Do **not** delete Python until health + login + scanner + ticker + rec + broker stub are green on Railway for a full market session.

## Local Windows note

This host may be `windows-gnu` without `dlltool`. Default builds **omit** the `postgres` feature so JSON stores work. Use Docker for a postgres-enabled binary.
