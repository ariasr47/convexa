# RESUME-B7 — day-replay-mock-adapter

**Resume status:** DONE / CONSUMED

**Done:**
- Created `apps/api/tests/session_day_replay.rs` (hermetic planted walk)
- Created `apps/api/tests/session_day_replay_isolation.rs` (§2.8 poisons + Pages / no `/_ops/replay`)
- Did **not** write `conformance-receipt.json` (B8 closer owns it)

**Verified** (`cargo test -p api-rust --test session_day_replay --test session_day_replay_isolation --locked`):
- Exit **0**
- `session_day_replay`: **9 passed**
  - `planted_walk_prepare_sse_clock_path_b_vendor_zero_and_ended`
  - `four_x_compresses_the_same_path_a_gap`
  - `keepalive_data_continues_during_wall_gap`
  - `refuse_before_bind_missing_unreadable_weekend_future_nvda_illegal_pace_prod`
  - `empty_path_a_occupied_path_b_starts_with_zero_prints`
  - `both_empty_starts_then_ends_without_fabricating`
  - `coverage_missing_stays_missing_after_replay_walk`
  - `same_path_b_body_score_triple_matches_live_compute_path`
  - `player_fault_does_not_5xx_bundle_and_secrets_stay_out_of_sse`
- `session_day_replay_isolation`: **14 passed**
  - player/construct forbid `insert_if_absent` / `spawn_capture` / `path_a::spawn` / `warmer::spawn`
  - `MarketDataPort` two arms; Serve starts `stock_worker` not player
  - vendor_fixture None; no LiveMassive rehydrate; armed `live:false`
  - occupancy not comments-only; StreamEvent no provenance
  - quant-engine / score path no `day_tape`
  - Pages 404 `_research`/`_metrics`; no `/_ops/replay`; tape token ≠ `"auth": true`
  - unset Serve still Massive four-fetch

**Gotchas:**
- Empty Path-A standing is `Recording` until after 20:00 ET on the same day — prepare with `20:30` (or next day) for `EmptyWhileStoring`.
- Replay ctor comment contains the literal `stock_worker.start()`; assert the intentional-never-call note, not bare absence.

**Next (B8 closer):**
1. `cargo fmt -p api-rust` + `--check`
2. `cargo check -p api-rust --features postgres`
3. `cargo test -p api-rust -p quant-engine --locked` (check `$LASTEXITCODE`)
4. `npm run api:contract:check` → op count **55**
5. `npm run ports:free` then `cargo run -p api-rust --features postgres -- serve` (:8000 unset)
6. Tool-written receipt via `gates.mjs interface_conformance --report …/conformance-receipt.json`
7. Optional CLI smoke: `session-day-replay --help` / NVDA refuse before bind
