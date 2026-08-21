# RESUME — `replay-outcome-join` — backend absorb 2026-08-19

**Resume status:** CONSUMED (as of 2026-08-19)

Crash-recovery re-verify completed. B1–B10 still on disk and green. One in-lane isolation carve-out. Builder receipt PASS. Do not start GATE Q from this file.

## Objective

Third research CLI (`replay-outcome-join`) joining batch-backtest replayed scores to forward `1d`/`5d` labels. Measures; **Authorizes: nothing**. `NO_UI_CHANGE`. One-field producer additive `display_spot`.

## Done (re-verified this session)

- **B1–B10** still present; V1 all green. Do not rewrite.
- **V1** `cargo test -p api-rust replay_outcome_join -- --nocapture` → **exit 0** (18 unit + 1 clap + 4 CLI)
- **V1** `cargo test -p api-rust --test replay_outcome_join_cli -- --nocapture` → **exit 0** (4/4)
- **V1** `cargo test -p api-rust --test replay_outcome_join_isolation -- --nocapture` → **exit 0** (4/4)
- **V2 helps** all **exit 0**: `score-lab`, `batch-backtest`, `join-outcomes`, `replay-outcome-join`
- **V2** `cargo test -p quant-engine` → **exit 0** (83 + 3 + 8 + 2)
- **V4** live `interface_conformance` → **exit 0 / PASS 4/4** vs `http://127.0.0.1:8000`
- Receipt: `.spire/clusters/tech/contracts/replay-outcome-join/conformance-receipt.json` (2026-08-19T18:21:42Z)

## In-lane change this session

- `apps/api/tests/research_isolation.rs` — `no_http_client_on_the_score_lab_path` still bans `reqwest` / `MassiveRestClient` / `Client::new` everywhere under `research/`; allows `MarketDataPort` **only** in `replay_outcome_join.rs` (PLAN B7/B9 Stocks fill). Anti-vacuity requires that file stay in the scan.

## Incomplete / not this lane

- **V2** `cargo test -p api-rust -p quant-engine` → **exit 101** on **sibling** `grounding_isolation::the_base_closure_grounds_against_the_pruned_move_never_the_raw_one` (`recommendation.rs` source-scan). Not replay-outcome-join. Do not “fix” it here.
- No `QA_REPORT.md` — GATE Q has not run
- PLAN.md checkboxes still `[ ]` — not evidence of missing code; **do not edit PLAN**
- F1 / V3 are frontend-lane

## Next concrete step

Conductor: absorb this resume, then GATE Q (or frontend V3 if F1 not yet verified). Do not rewrite B1–B10.

## Gotchas

- Dirty tree still includes OTHER uncommitted features. **Never `git stash`.** Do not revert sibling files.
- Do not edit `SPEC.md`, `INTERFACE_CONTRACT.md`, `PLAN.md`.
- P-keyspace-universe = **replayed** identities; all-degraded + labels = hard error.
- `ports:free` is IPv4-only. Prior FAIL receipt was a dead listener, not a missing route.
- Pre-existing red: `cargo fmt --check` ~54 files; sibling `grounding_isolation`.
