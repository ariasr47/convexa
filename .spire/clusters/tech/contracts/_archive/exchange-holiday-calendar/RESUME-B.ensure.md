# RESUME-B.ensure — exchange-holiday-calendar

**Resume status:** CONSUMED

## Done

- `ensure_eligible` now keys off `crate::domain::is_et_session_day(et_date)` (not `is_et_weekday`)
- `is_et_weekday` left as Mon–Fri Sat/Sun complement (holiday Thursday stays true)
- PLAN tests: `ensure_eligible_false_on_holiday_thursday`, `ensure_eligible_true_on_ordinary_monday`
- PLAN test: `worker_skips_holiday_force` (Thanksgiving 15:00 UTC / 10:00 ET → force_calls 0)
- Worker needs no extra branch — already gates on `ensure_eligible`

## Verified

- RED observed: holiday Thursday `ensure_eligible` true + worker dialed force (`EXIT=101`, 2 failed)
- GREEN: `cargo test -p api-rust --locked --lib services::session_chain_archive::ensure` → 24 passed, `EXIT=0`
- `worker_skips_weekend_force` still 0 dials; ordinary Monday still eligible

## Next (not this task)

- Sibling Independent tasks (B.classify / B.stream / B.tape / B.keep / B.scanner as needed)
- B.closer writes `conformance-receipt.json` — this spawn did not

## Gotchas

- Do **not** widen `is_et_weekday` to return false on holidays — that overloads weekend and breaks `liquid_names_session_capture` weekend assert
- Thanksgiving oracle: `2026-11-26`; ordinary Monday: `2026-08-10`
- Integration `--test liquid_names_session_capture` hit locked `target/debug/api-rust.exe` (Access denied); lib pins already cover weekend/`is_et_weekday`
