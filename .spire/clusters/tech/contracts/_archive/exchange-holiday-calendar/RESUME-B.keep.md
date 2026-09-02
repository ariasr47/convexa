# RESUME-B.keep — exchange-holiday-calendar

**Resume status:** CONSUMED

## Done

- `Occupancy::IneligibleHoliday` sibling of `IneligibleWeekend`
- Literals: `FRAMING_HOLIDAY`, `ineligible_holiday(et_date)` → `flat files ineligible holiday: {et_date}`; token `ineligible holiday`
- `classify_dated` / `pre_get_refuse`: after store-level, weekend then holiday via `crate::domain::{is_et_weekend, is_nyse_full_day_holiday}`, **before** due/elapsed and **before GET**
- `load_envelope` holiday arm: HTTP 200, `FRAMING_HOLIDAY`, holiday detail
- CLI: `IneligibleHoliday` exit 0 / `[OK]` not-miss (same family as weekend); prints holiday detail
- Local `clocks::is_et_weekend` stays Sat/Sun (Thanksgiving pin)
- 2026-08-10 `holiday_weekday_zero_rows_is_empty_extract_not_weekend` **unchanged** → still `EmptyExtract`
- Research load hermetic: Thanksgiving framing/token via `research_flat_files.rs`

## Verified

- `cargo test -p api-rust --locked --lib thanksgiving` → keep Thanksgiving + coverage span-hole; EXIT=0
- `cargo test -p api-rust --locked --lib leftover_kept_on_holiday` → EXIT=0
- `cargo test -p api-rust --locked --lib services::flat_file_keep` → 72 passed, EXIT=0
- `cargo test -p api-rust --locked --lib routes::research_flat_files` → 11 passed, EXIT=0
- `cargo test -p api-rust --locked --lib services::flat_file_keep::keep::tests::holiday_weekday_zero_rows_is_empty_extract_not_weekend` → EXIT=0

## Next (not this task)

- Sibling Independent tasks remaining; B.closer writes `conformance-receipt.json` — this spawn did not

## Gotchas

- Cargo filter is one pattern: use `thanksgiving` / full test path, not `services::flat_file_keep thanksgiving`
- Do not widen local `is_et_weekend` to holidays; domain holiday predicate is the gate
- Holiday gate is before due/elapsed, so future holiday D still refuses GET / load as ineligible-holiday
