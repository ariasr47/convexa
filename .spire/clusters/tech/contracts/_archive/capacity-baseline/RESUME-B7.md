# RESUME-B7 — capacity-baseline

**Resume status:** DONE

## Done

B7 complete: isolation + CLI exit + hermetic load crate tests (no 600s soak).

### Paths written
- `apps/api/tests/capacity_baseline_isolation.rs`
- `apps/api/tests/capacity_cli.rs`
- `apps/api/tests/capacity_load.rs`

### Verified
```
cargo test -p api-rust --test capacity_baseline_isolation -- --nocapture
→ EXIT=0 · 30 passed · ~7.4s (no 600s soak)

cargo test -p api-rust --test capacity_cli -- --nocapture
→ EXIT=0 · 5 passed

cargo test -p api-rust --test capacity_load -- --nocapture
→ EXIT=0 · 1 passed · wall ~28.5s (< 60s)
  debug: force_warm_samples under D1 (same as B5); do not raise D1
```
NUL scan on all three paths = 0.

### Behaviors locked
- Source scan: no live vendor seams in harness leaf / `cmd_capacity`; anti-vacuity (oracle before work, HTTP+Path-B vs oracle); score-as-threshold forbidden
- Fixture floor refuses `syn_mini`; receipt parser fails when `standing` omitted
- `bump_request_count` → BLOCKED without `MOCKED VENDORS`
- CI backend job has capacity load; soak absent as a step
- HubCmd: HTTP admits on harness hub leave `cmds_enqueued()==0`
- Force-fail hooks name warm p95 / unexpected-error / stream-hold drops / client timeout
- Vacuous vs partial surface wording distinct; D1 locks pinned 150/4000/200/500
- Soak wiring only: `SOAK_HOLD==600s`, 8 HTTP, 32 SSE, 500/50; follow-up helper source-scanned
- Hermetic load: Command load, 16/8+1, MAX_LIVE_SUBSCRIBERS=9, identity triple equal, request_count=0, Evidence local, standing first

### Invariants checked
- `[additive-keeps-score-byte-identical]` — identity equality, not score-as-threshold
- `[operator-vs-trader-path-separation]` — CLI/isolation only; dashboard empty of capacity literals
- `[production-fails-closed]` — prod fixture poison + live rest_base refuse wired
- `[no-secrets-in-image]` — canary `MASSIVE_API_KEY` absent from receipt
- No D1 auto-tune; no 600s soak under cargo test

## Not in scope
B9 conformance-receipt · editing main.rs / CI / SPEC / INTERFACE · running capacity soak

## Gotchas for joiners
- Receipt `verdict` field is the full `[PASS]/[FAIL] …` line, not bare `PASS`/`FAIL`.
- Debug hermetic load forces warm samples under 150 ms; release evaluates real warm walls (B5).
- Do not write `conformance-receipt.json` until B9 closer.
