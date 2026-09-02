# RESUME-B6 — capacity-baseline

**Resume status:** DONE

## Done

B6 complete: clap nested `capacity {load|soak}` + thin `cmd_capacity` in `main.rs`.

### Paths written
- `apps/api/src/main.rs` (Capacity / CapacityAction + early ExitCode dispatch + `cmd_capacity` + `capacity_wiring` tests)

### Verified
```
cargo test -p api-rust --bin api-rust -- --nocapture
→ EXIT=0 · 16 passed (6 capacity_wiring + prior bin guards)

cargo run -p api-rust --locked -- capacity --help
→ load + soak listed; not serve

cargo run -p api-rust --locked -- capacity load --help
cargo run -p api-rust --locked -- capacity soak --help
→ EXIT=0 each; independently invocable

NUL scan main.rs = 0 · cargo fmt applied
```

### Behaviors locked
- `capacity load` / `capacity soak` are distinct nested commands (not aliases of each other or `serve`)
- Bare `capacity` requires a subcommand (parse err)
- `--evidence` / `--ci` clap flags rejected (evidence stays env-classified in the leaf)
- `--json` / `--out` parse on parent (global so they work after `load`/`soak`)
- `cmd_capacity` maps `CapacityAction::{Load,Soak}` → `capacity_harness::Command::{Load,Soak}` and calls `capacity_harness::run` only
- No `Config::from_env` / `server::serve` / Massive / live port / `connect_async` in `cmd_capacity`
- Capacity dispatched before `run()` so FAIL ExitCodes are not wrapped as `error: …`
- No 600s soak in cargo test; no D1 auto-tune; no CI / Nx / conformance-receipt edits

### Invariants checked
- `[operator-vs-trader-path-separation]` — CLI-only; no HTTP capacity route
- `[additive-keeps-score-byte-identical]` — wiring only; no Path-B / score change
- `[production-fails-closed]` — still refuses via harness leaf; cmd does not call `Config::from_env`
- `NO_UI_CHANGE` — dashboard untouched

## Not in scope (later)
B7 isolation/cli/load crate tests · B8 Nx/npm/CI · B9 conformance-receipt

## Gotchas for joiners
- `--json`/`--out` use `global = true` so `capacity load --json --out …` parses (parent args after subcommand).
- Action→Command match lives inside `cmd_capacity` so the body source-scan sees `Command::Load`/`Soak`.
- Do not run 600s soak under `cargo test`. Do not write `conformance-receipt.json` until B9.
