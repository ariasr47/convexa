# RESUME-B.coverage — exchange-holiday-calendar

**Resume status:** CONSUMED

## Done

- `CoverageMatrix.holiday: bool` (internal; Sat/Sun stay on `weekend` only)
- `IdentityStatus::IneligibleHoliday` + `cell_literal` → `None` (same as weekend)
- `d_is_due` / `derive` empty-expected keyed off `!is_et_session_day` (weekend arm + holiday arm)
- `render_cli` short-circuit keyed off `!is_et_session_day` (not `matrix.weekend` only)
- HTTP `envelope` framing uses existing `FRAMING_WEEKEND` when `!is_et_session_day`
- PLAN holiday tests in `coverage.rs` + `coverage_holiday_200_…` in `research_session_coverage.rs`

## Verified

- `cargo test -p api-rust --locked --lib -- holiday` → 10 passed, EXIT=0
- `cargo test -p api-rust --locked --lib services::session_chain_archive::coverage` → 31 passed, EXIT=0
- `cargo test -p api-rust --locked --lib routes::research_session_coverage` → 12 passed, EXIT=0
- Weekend + named-future `2099-01-05` + ordinary Tuesday + 2019 span-hole controls green

## Next (not this task)

- Sibling Independent tasks (B.classify / B.stream / B.tape / B.keep / B.ensure / B.scanner)
- B.closer writes `conformance-receipt.json` — this spawn did not

## Gotchas

- PLAN snippet used `.is_some_and` on `parse_from_str` (`Result`); production uses `.ok().is_some_and(...)`
- Do not set `weekend: true` on a Thursday; HTTP must not grow a `weekend` key
- Keep const name `FRAMING_WEEKEND`; string has no word `weekend`
