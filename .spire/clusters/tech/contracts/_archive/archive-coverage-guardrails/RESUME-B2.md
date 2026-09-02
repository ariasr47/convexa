# RESUME-B2 — archive-coverage-guardrails

**Resume status:** DONE

## Done

- clap `Commands::ArchiveCoverage { et_date }` in `apps/api/src/main.rs`
- ExitCode dispatch before `run()` (beside Capacity); unreachable arm in `run()`
- `cmd_archive_coverage` → `open_session_archive_for_cli` + `evaluate_cli`; score-lab empty-key Config stub; no Massive / live port / sleep
- `archive_coverage_wiring` tests (3) green

## Verified

- `cargo test -p api-rust --bin api-rust archive_coverage_wiring` → 3 passed, EXIT=0
- `cargo test -p api-rust --lib session_chain_archive::coverage` → 23 passed, EXIT=0
- `cargo run -p api-rust -- archive-coverage --help` lists command + `--et-date`

## Next (not this task)

- B3 worker / B4 HTTP / B5 OpenAPI (parallel after B1) — do not re-touch `main.rs` for coverage
- Unparseable `--et-date` surfaces only after a storing archive opens; NotStoring from empty-key stub is expected when `Config::from_env` falls back

## Gotchas

- Do not nest under Capacity. Do not invent `--json` / `--fetch`.
- Stdout title / verdict token stays `archive-coverage` even if clap about text changes.
