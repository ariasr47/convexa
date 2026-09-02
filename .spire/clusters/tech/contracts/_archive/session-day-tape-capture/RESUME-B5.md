# RESUME-B5 — HTTP list/load + OpenAPI 53 → 55

**Resume status:** DONE

## Done

- Created `apps/api/src/routes/research_session_day_tape.rs`:
  - `GET /api/_research/session-day-tape/{symbol}` list + `.../{symbol}/day` load
  - Metrics-token gate (not `"auth": true`); `vendor_called` always false; `authorizes: "nothing"`
  - Axis A order: NotInWatchlist → NotStoring → weekend → NotElapsed → NoIdentity (GATE Z: no NotExpectedPreStore 200)
  - `detail` string|null lock; NVDA not-in-watchlist 200 without tape root; NotElapsed 200; et_date not-a-date 422
  - Combined Path-A + Path-B envelope; list `days[].clock` closed set (no pre-store wording)
  - 16 colocated handler tests green
- Wired tape `add!` **before** session-books in `routes/mod.rs`; operator security + RESPONSE_CONVERSION + schemas
- Direct-edited `precutover-operation-baseline.json` ops + `operation_count` **55** (did **not** run baseline:accept)
- Updated `tools/api-contract.mjs` / `.spec.mjs` routeSource order (tape before archive before session) + pins 55
- Re-pinned router/parity `53→55`; direct-HTTP harness uses NVDA + `?et_date=2020-01-02` for `/day`
- Ran `npm run api:contract:generate` then `api:contract:check` — both exit 0
- Generated: `convexa.openapi.json`, `parity-coverage.json`, `generated-artifacts.manifest.json`, `boundary-evidence.json`, `libs/api/src/generated/schema.ts`

## Tests / exit codes observed

| Command | Exit |
| --- | --- |
| `cargo test -p api-rust --locked --lib -- research_session_day_tape::` | **0** (16 passed) |
| `npm run api:contract:generate` | **0** |
| `npm run api:contract:check` | **0** |
| `node --test tools/api-contract.spec.mjs` | **0** (61 passed) |
| `cargo test -p api-rust --locked --test api_contract_router` | **0** (7 passed) |
| `cargo test … api_contract_parity -- ordinary_http_has_typed_responses` | **0** |
| `cargo test … api_contract_parity -- http_parity_harness_observes_all_operations` | **0** (`observed == 55`) |
| tape boundary_evidence_025…032 | **0** |

## Operation count

**55** (parity / baseline / OpenAPI / registration pairs / add!−1).

## Carry forward

- Suggested commit (not made here): `feat(api): research session-day-tape list/load`
- B7 isolation / poison / runtime-auth oneshots still pending; this spawn did not add http-fragment rows for tape (risk-tiered; generate/check green without them)
- Do not touch `path_a.rs` / `path_b.rs` / `analytics.rs` / `server.rs` / `main.rs` / `cli.rs` from a B5 resume
- Do not run `api:contract:baseline:accept`
- Probe_id `openapi-router-integration-all-52` / `registration_count: 52` left unchanged per PLAN
