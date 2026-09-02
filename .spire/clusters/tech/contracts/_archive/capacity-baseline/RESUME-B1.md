# RESUME-B1 — capacity-baseline

**Resume status:** DONE

## Done

B1 foundation complete: receipt types, standing, thresholds, evidence, golden loader.

### Paths written
- `apps/api/src/services/mod.rs` — `pub mod capacity_harness;`
- `apps/api/src/services/capacity_harness/{mod,types,evidence,standing,thresholds,receipt,fixture}.rs`

### Verified
```
cargo test -p api-rust --lib capacity_harness -- --nocapture
```
EXIT=0 · 20 passed / 0 failed. `cargo fmt -p api-rust`. NUL scan = 0 on all B1 files.

### Behaviors locked
- Evidence: `CI=true` → local; `GITHUB_ACTIONS` / `CONVEXA_CAPACITY_CI_STEP` → ci (`classify_with`)
- p95 per named basis; empty samples fail (no blended ticker-analysis p95)
- Vouched standing has `MOCKED VENDORS`; blocked standing does not
- Load measurement cannot print `Command: soak`
- Fixture floor: `syn_mini` refused; missing path hard error; `gex_SPY` loads ≥1000 contracts as SPY
- Receipt parser requires `standing`; short non-measurement has no p95 table; pass JSON has identity triple + SPY inventory

## Not in scope (later tasks)
B2 hub · B3 `for_capacity_harness` · B4 Path-B fixture arm · B5 driver · B6 clap · B7 isolation · B8 Nx/CI · B9 receipt

## Gotchas for joiners
- `sample_ids(cmd, evidence, hold_subscribers, hold_sessions, probe_sessions, probe_subscribers)` — load sample is `(9, 4, 1, 3)`
- Golden loader accepts `spot` or `synchronized_spot` alias so `syn_mini` hits the contract floor (not a serde miss)
- Do not write `conformance-receipt.json` until B9
- Cold p95 > 4000 ms later → GATE Z; do not auto-tune D1
