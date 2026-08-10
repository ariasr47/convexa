# Python backend — RETIRED (production)

**Date:** 2026-08-10

Production runtime is **`api-rust`** (Axum) on Railway:

- Service: `api-rust`
- Public URL: `https://convexa-production.up.railway.app`
- Durable store: Postgres (`DATABASE_URL`)
- Scanner: embedded in `api-rust` (`SCAN_ENABLED=1`) — no separate `scanner-worker`

## What was removed from Railway

| Former service   | Role                         | Status        |
|------------------|------------------------------|---------------|
| `api`            | Python FastAPI               | **Deleted**   |
| `scanner-worker` | Python `worker.py` sweep     | **Deleted**   |

## What remains in this tree

- Characterization / fixture helpers under `tests/`
- `src/scanner/config/universe.json` (still copied into the Rust Docker image)
- Historical FastAPI source for reference until deleted later

## Local dev

```bash
# Default backend
npm run serve:api          # → cargo run -p api-rust -- serve  (:8000)

# Do not use for production path
nx run api:serve-python-legacy
```

See `docs/API_RUST_DEPLOY.md`.
