# RESUME-B4 — capacity-baseline

**Resume status:** DONE

## Done

B4 complete: Path-B fixture arm on `compute_analytics` + price call sites switched to `quick_live_price`.

### Paths written
- `apps/api/src/services/analytics.rs` (+ colocated hermetic tests)
- `apps/api/src/routes/ticker.rs` (+ colocated source-scan test)
- `apps/api/src/routes/price.rs` (+ colocated source-scan test)

### Verified
```
cargo test -p api-rust --lib vendor_fixture -- --nocapture
cargo test -p api-rust --lib hermetic_tests -- --nocapture
cargo test -p api-rust --lib resolve_price_fast_uses_fixture_aware -- --nocapture
cargo test -p api-rust --lib get_price_cold_path_uses_fixture_aware -- --nocapture
```
EXIT=0 on all. NUL scan on the three paths = 0.

### Behaviors locked
- `vendor_fixture=Some` → `FixtureCatalog::resolve` + `compute_analytics_from_vendor` (no Massive; `request_count==0`; `contract_count>=1000` on gex_SPY)
- `vendor_fixture=None` → today's four-fetch `tokio::join!` byte-identical (`fetch_options_market_state` / `fetch_daily_bars` / `fetch_intraday_bars` / `fetch_recent_trades`)
- No `MarketDataPort::live` inside `compute_analytics`
- `refresh_analytics`, `resolve_price_fast`, `get_price` cold path use `state.quick_live_price` (None arm still hits Massive via that wrap)
- Production HTTP shapes untouched

### Invariants checked
- `[additive-keeps-score-byte-identical]` — fixture arm is additive Some-only; None path unchanged
- `[production-fails-closed]` — production construct still refuses fixture Some (B3); this task never sets Some on prod
- `[best-effort-isolated-or-null]` — optional Path-B fields unchanged
- No D1 auto-tune

## Not in scope (later tasks)
B5 driver · B6 clap · B7 isolation · B8 Nx/CI · B9 receipt / conformance-receipt

## Gotchas for joiners
- Fixture arm sets `iv_rank_enabled: false` and `iv_store: None` (matches planned identity Path-B knobs)
- `include_str!("analytics.rs")` self-match: do not assert absence of a string that the test itself contains
- Do not write `conformance-receipt.json` until closer; do not touch `state.rs` / hub / `capacity_harness/` driver mods
