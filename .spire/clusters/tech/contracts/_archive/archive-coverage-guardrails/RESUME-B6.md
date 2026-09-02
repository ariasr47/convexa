# RESUME-B6 — archive-coverage-guardrails

**Resume status:** DONE

## Done

- Created `apps/api/tests/archive_coverage_guardrails_isolation.rs` — Massive/score/gate
  source scans (prod slice only), Pages 404, trader chrome, OperatorMetrics STAGES,
  `@convexa/api` facade, list/load framing, write-skipped warn, worker disabled no-op,
  URL-safe base64 ≥32 token shape
- Created `apps/api/tests/archive_coverage_guardrails.rs` — shared CLI/HTTP matrix
  (pass/fail missing/unreadable/blocked, weekend/before-checkpoint/future not_due,
  disabled 500/ERROR, canary non-leak, AC-27 cell+hole identity)
- Extended `api_contract_runtime_auth_research.rs`
  `operator_research_runtime_evidence_covers_success_validation_auth_and_miss` with
  coverage 200 / 422 `et_date_unparseable` / 401 oneshots + token-shape assert;
  list/load assertions preserved; `research_snapshot` byte-identity held

## Verified

- `cargo test -p api-rust --test archive_coverage_guardrails --test archive_coverage_guardrails_isolation -- --nocapture` → **8 + 12 passed**, EXIT=0
- `cargo test -p api-rust --test api_contract_runtime_auth_research -- --nocapture` → **7 passed**, EXIT=0
- NUL scan = 0 on all three B6 paths

## Next (not this task)

- **B7** closer: fmt/check/full test + serve + `conformance-receipt.json` only

## Gotchas

- `insert_if_absent` appears under `#[cfg(test)]` plant helpers in `coverage.rs`; AC-19
  scan must use the production slice before `#[cfg(test)]` (same pattern as B1’s
  `production_source()`)
- `ensure_worker` is `pub(crate)` — AC-36 runtime tick is covered in-crate; B6 proves
  disabled early-return via source scan + public `emit_latched_warnings` no-op
- `metrics_token_ok` requires URL-safe base64 of ≥32 decoded bytes
  (`CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws`); plain canary strings always 401
- Coverage HTTP uses `Utc::now()` — shared due cells use a **past** weekday
  (`2026-08-10`); future not_due uses a dynamic +14d weekday
- Do **not** write `conformance-receipt.json` here (B7 only)
- Runtime-evidence fixture catalog still has 17 entries; new coverage
  `DIRECT_HTTP_EVIDENCE_OUTCOME` lines emit but are not yet catalog rows — B7 /
  contract-check may want fixture append (out of B6 path scope)
