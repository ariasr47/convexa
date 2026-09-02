# RESUME-B5 — day-replay-mock-adapter

**Resume status:** DONE

**Done:**
- `apps/api/src/services/analytics.rs`: `load_analytics` / `load_or_compute` peek `ReplayHold` before `gex_cache` while armed; miss → `Ok((None,"session_tape"))` / `NotFound` (not 5xx)
- `compute_analytics` + `refresh_analytics` refuse Massive while armed (defense in depth)
- Armed path never reaches `spawn_capture` / four-fetch for any ticker (incl. QQQ on SPY-armed)
- Unset construct unchanged (fixture / four-fetch source pin intact)
- Score triple identity: same Path-B body via fixture `load_analytics` vs `compute_analytics_from_vendor(..., iv_store=None)`

**Tests:** `cargo test -p api-rust --lib services::analytics --locked -- --nocapture` → exit 0 (11 passed)

**Next:** B4 (stream occupancy) independent; B8 lane closer writes conformance-receipt. No B5 receipt.
