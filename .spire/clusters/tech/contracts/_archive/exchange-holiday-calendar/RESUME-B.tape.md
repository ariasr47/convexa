# RESUME-B.tape — exchange-holiday-calendar

**Resume status:** CONSUMED

## Done

- `LIST_CLOCK_INELIGIBLE_HOLIDAY` + `ineligible_holiday(symbol, et_date)` in `literals.rs`; closed set length 4
- `AxisA::IneligibleHoliday` sibling of weekend; `derive_axis_a` uses `is_et_weekend` then `is_nyse_full_day_holiday` (not `!is_et_date_weekday`)
- `list_clock` / `axis_a_detail` / `axis_a_label` + exhaustive arm arrays updated
- Path-A / Path-B clocks session-day-gated via `is_et_session_day` (`is_et_date_weekday` stays Sat/Sun complement)
- `construct.rs` + `cli.rs` refuse/print holiday literal before bind/load
- Route `FRAMING_HOLIDAY` + `framing_for_axis_a` / early gate / loaded gate arms
- Re-export `LIST_CLOCK_INELIGIBLE_HOLIDAY` from `day_tape/mod.rs`

## Verified

- `cargo test -p api-rust --locked --lib -- holiday` → 15 passed, EXIT=0
- `cargo test -p api-rust --locked --lib services::day_tape` → 92 passed, EXIT=0
- `cargo test -p api-rust --locked --lib routes::research_session_day_tape` → 17 passed, EXIT=0
- Saturday still `ineligible weekend`; noon Monday 2026-08-10 Path-A still open; Thanksgiving leftover still ineligible holiday

## Next (not this task)

- Sibling Independent tasks (B.classify / B.stream / B.keep / B.ensure / B.scanner) if not already JOINED
- B.closer writes `conformance-receipt.json` — this spawn did not

## Gotchas

- Do not map holiday through `!is_et_date_weekday` (prints weekend)
- Keep `is_et_date_weekday` as Sat/Sun only; windows use `is_et_session_day`
- Holiday gate before NotElapsed so future Thanksgiving still returns ineligible holiday under wall clock
