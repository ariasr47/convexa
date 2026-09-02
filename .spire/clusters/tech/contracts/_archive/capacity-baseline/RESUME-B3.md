# RESUME-B3 — capacity-baseline

**Resume status:** DONE

## Done

B3 complete: additive `vendor_fixture` + `AppState::for_capacity_harness` hold constructor.

### Paths written
- `apps/api/src/state.rs` only (+ colocated tests)

### Verified
```
cargo test -p api-rust --lib state:: -- --nocapture
```
EXIT=0 · 9 passed / 0 failed. Focused `for_capacity_harness` filter also EXIT=0 (2/2). NUL scan on `state.rs` = 0.

### Behaviors locked
- `vendor_fixture: None` on `construct` / `for_tests` / `for_runtime_guardrail_tests`
- `for_capacity_harness(catalog, 4, 9)` → fixture Some, LiveCapacity 9/4, limiter 0, `rest_base=http://127.0.0.1:1`, warm/scan off, harness-only hub (`cmds_enqueued` stays 0 after subscribe)
- Never `Config::from_env`; never starts stock worker; capture stores `disabled()`
- `for_capacity_harness_with_env(..., Some("prod"))` refuses (no process-env mutation)
- `construct_with_fixture_for_poison` → production + fixture Some refuses
- `quick_live_price` resolves from fixture when Some; None arm = `massive.fetch_quick_live_price`
- `for_tests` still wrong constructor: ceilings 0/0, `rest_base=https://api.massive.com`

## Not in scope (later tasks)
B4 Path-B fixture arm · B5 driver · B6 clap · B7 isolation · B8 Nx/CI · B9 receipt / conformance-receipt

## Gotchas for joiners
- Hold ceilings for load are **9 subscribers / 4 sessions** (D2); probe is separate AppState later (B5)
- `for_capacity_harness_with_env` is private; public entry reads `APP_ENV`
- Dummy key is `capacity-harness-dummy-not-a-secret` — refuse if it equals env `MASSIVE_API_KEY`
- Do not write `conformance-receipt.json` until closer; do not touch `analytics.rs` / routes (B4)
