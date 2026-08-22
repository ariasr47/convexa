# apps/api (Rust) — Postgres + Docker / Railway deploy

**Status:** Python FastAPI is archived under `archive/api-python/`. Runtime is
Axum under `apps/api` (Cargo package name `api-rust`).

Public URL: `https://convexa-production.up.railway.app`  
Health: `service=api-rust`, `durable_store=postgres`.

## Durable stores

## Release migration gate

The production order is: build the target image → Railway pre-deploy `api-rust postgres-migrate` →
if the nonzero outcome is `unsafe database refused` or `execution failed`, stop promotion and do not
start replicas → otherwise, on `work applied` or `already current`, start `serve` → check
`/api/health`. The migration runner owns a single advisory-locked session and commits each version
atomically. `serve` performs only read-only history/probe checks and refuses before binding when
migrations are absent, inconsistent, future, incompatible, or unverifiable. Earlier versions can
remain committed if a later version fails.

The root GATE-S release conductor owns direct Railway review; QA independently checks the deterministic
repository/process receipt. The receipt does not assert Railway status, image identity, or health.

### Exact migration and startup copy

Progress records use only the matching message below:

| State                 | Exact message                               |
| --------------------- | ------------------------------------------- |
| `checking`            | `Checking PostgreSQL schema…`               |
| `waiting`             | `Another migration run is active. Waiting…` |
| `version_started`     | `Applying migration {version} ({name})…`    |
| `version_committed`   | `Migration {version} ({name}) committed.`   |
| `version_rolled_back` | `Migration {version} ({name}) rolled back.` |

Terminal records use only these outcome/reason messages. `work applied` and `already current` exit
zero. `unsafe database refused` and `execution failed` exit nonzero and stop promotion before any
replica starts.

| Outcome / reason                                   | Exact message                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `work applied` / `migrations applied`              | `Migrations applied. The PostgreSQL schema is ready for this release.`                              |
| `already current` / `already current`              | `No migrations were needed. The PostgreSQL schema is ready for this release.`                       |
| `unsafe database refused` / `inconsistent history` | `Migration refused: the database migration history is inconsistent with this release.`              |
| `unsafe database refused` / `future history`       | `Migration refused: the database records migrations newer than this release.`                       |
| `unsafe database refused` / `schema incompatible`  | `Migration refused: the PostgreSQL schema is incomplete or incompatible with this release.`         |
| `execution failed` / `schema unverifiable`         | `Migration failed: the PostgreSQL schema could not be verified.`                                    |
| `execution failed` / `postgres unavailable`        | `Migration failed: PostgreSQL is unavailable.`                                                      |
| `execution failed` / `migration owner busy`        | `Migration failed: another migration run remained active past the wait deadline.`                   |
| `execution failed` / `transaction failed`          | `Migration failed. The failing schema version was not committed.`                                   |
| `execution failed` / `post-apply schema rejected`  | `Migrations were committed, but the resulting PostgreSQL schema was not accepted for this release.` |
| `execution failed` / `commit status unverifiable`  | `Migration failed. Commit status could not be verified.`                                            |
| `execution failed` / `manifest invalid`            | `Migration failed: this release contains an invalid migration manifest.`                            |
| `execution failed` / `cancelled`                   | `Migration failed: the migration operation was cancelled.`                                          |
| `execution failed` / `internal failure`            | `Migration failed: the migration operation could not complete.`                                     |

Production startup refusal uses only the matching message and occurs before listener bind or worker
start:

| Condition                     | Exact message                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Missing versions              | `Startup refused: required PostgreSQL migrations are missing.`                            |
| Inconsistent history          | `Startup refused: the PostgreSQL migration history is inconsistent with this release.`    |
| Future history                | `Startup refused: the database records migrations newer than this release.`               |
| Deterministic schema mismatch | `Startup refused: the PostgreSQL schema is incomplete or incompatible with this release.` |
| Unverifiable schema           | `Startup refused: the PostgreSQL schema could not be verified.`                           |

`Highest committed version: {version}.` may appear only after a fresh ledger read proves an exact
manifest prefix. A `version_rolled_back` progress message and the transaction-failure terminal message
are permitted only after rollback or a fresh ledger read proves the failing version absent.

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
