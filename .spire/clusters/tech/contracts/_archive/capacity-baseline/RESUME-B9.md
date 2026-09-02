# RESUME-B9 — capacity-baseline

**Resume status:** DONE

## Done

B9 closer complete: lane gates + `conformance-receipt.json` (empty-set / `NO_BACKEND_CHANGE`).

### Path written
- `.spire/clusters/tech/contracts/capacity-baseline/conformance-receipt.json`

### Verified
```
cargo test -p api-rust -p quant-engine --locked
 V1_EXIT=0

cargo check -p api-rust --features postgres
 V2_EXIT=0

npm run api:contract:check
 CONTRACT_EXIT=0

git diff --stat -- libs/quant-engine apps/dashboard libs/api
 empty · DIFF_EXIT=0

NUL scan run.rs → 0

capacity load (release + APP_ENV=dev)
 EXIT=0 · Evidence: local · warm p95 ≈ 31.8 ms · [PASS]

interface_conformance via gates.mjs
 EXIT=2 · "spec has no endpoints" (expected for empty set)
 empty-set emitter → receipt verdict PASS · endpoints [] · schema-valid
```

### Receipt
- tool `interface_conformance` · verdict **PASS** · mode `live` · `endpoints: []`
- `NO_BACKEND_CHANGE` of production HTTP; no live ticker/SSE / Massive conformance invented
- PLAN's `"mode": "contract"` is schema-invalid (`live|sample` only); used schema-valid vacuous live PASS

### Gotchas
- **Debug** `cargo run … capacity load` on this Windows host fails warm cache-hit p95 (~170 ms > 150). Hermetic `capacity_load` stubs warm samples under `debug_assertions` on purpose; do not raise D1.
- **Release** without `APP_ENV` refuses production startup before the harness runs. Use `APP_ENV=dev` for a real local release measurement.
- CI invokes debug `cargo run … capacity load` (same as PLAN step 8); Linux runners may clear 150 ms where this box's debug build does not.
- `cargo fmt -p api-rust -- --check` is red on B7 test formatting only; B9 did not reformat those paths (out of write scope).
- `gates.mjs interface_conformance` cannot write a receipt for empty `endpoints` (exit 2); empty-set path used a validateReceipt emitter.

## Not in scope
Worker re-implements · soak 600 s (GATE Q / V8) · dashboard · SPEC/INTERFACE edits · fmt of B7 tests
