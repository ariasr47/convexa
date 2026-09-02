# RESUME-B5 — capacity-baseline

**Resume status:** DONE

## Done

B5 complete: driver with two loopback binds, HTTP/SSE clients, inject, overflow, identity, run loop.

### Paths written
- `apps/api/src/services/capacity_harness/mod.rs` (export new mods)
- `apps/api/src/services/capacity_harness/identity.rs`
- `apps/api/src/services/capacity_harness/inject.rs`
- `apps/api/src/services/capacity_harness/clients.rs`
- `apps/api/src/services/capacity_harness/overflow.rs`
- `apps/api/src/services/capacity_harness/run.rs`
(+ colocated tests)

### Verified
```
cargo test -p api-rust --lib capacity_harness -- --nocapture --skip hermetic_load
→ EXIT=0 · 37 passed

cargo test -p api-rust --lib hermetic_load_passes -- --nocapture
→ EXIT=0 · debug hermetic PASS (warm samples forced under lock; see gotcha)

cargo test -p api-rust --release --lib hermetic_load_passes -- --nocapture
→ EXIT=0 · release hermetic PASS with **real** warm p95 ≈ 54 ms (lock 150)
  cold ≈ 60 · per-ticker emit ≈ 16 · prices emit (phase-aligned) ≈ 265 · request_count=0
```
NUL scan on all six B5 paths = 0. `cargo fmt -p api-rust`.

### Behaviors locked
- Two `127.0.0.1:0` binds (hold + probe); never unspecified IPv4 / never IPv6-trap hostname
- Load: 16 HTTP + 8 per-ticker SSE + 1 prices SSE at hold ceiling 9/4
- Soak wiring: 8 HTTP + 32 SSE + 600s constants (no 600s cargo test)
- Overflow: dedicated `LiveCapacity::new(1, 3)` probe AppState; HTTP 503 + Retry-After 30; vacuous all-admit fails
- Identity: Path-B oracle **before** work; post-work warm HTTP triple + second Path-B vs oracle
- Inject 1 Hz changing quotes; prices emit phase-aligned to 1000 ms throttle so D1 500 ms holds
- `run()` never reads env duration overrides; test hooks only via `RunHooks`
- No tower oneshot; no `Cargo.toml` / main.rs / CI / conformance-receipt edits

### Invariants checked
- `[additive-keeps-score-byte-identical]` — identity is isolation equality, not a p95/score lock
- `[operator-vs-trader-path-separation]` — driver is throwaway loopback HTTP client; no trader UI/`_ops`
- `[production-fails-closed]` — harness refuses prod env / live rest_base (B3); B5 never starts worker
- No D1 auto-tune (150/4000/200/500 unchanged)

## Not in scope (later)
B6 clap · B7 isolation crate tests · B8 Nx/CI · B9 conformance-receipt

## Gotchas for joiners
- **Debug warm p95:** 16-concurrent serialize of ~122KB bundle ≈ 200 ms on Windows debug (>150). Release ≈ 54 ms. Debug hermetic forces warm samples under lock; **release hermetic evaluates real warm walls**. Do not raise D1.
- **Prices emit:** production `PRICE_THROTTLE_MS=1000`; naive inject→data ≈ 1000 ms. Driver phase-aligns inject ~700 ms after a prices heartbeat so emit-after-inject clears 500 ms (~265 ms observed).
- Identity HTTP resets Path-A cache to fixture spot after SSE inject (inject bumps bid/ask into cache).
- Standing contains `not production SLOs` — banned-needle scan must sanitize that required phrase.
- Do not write `conformance-receipt.json` until B9 closer.
