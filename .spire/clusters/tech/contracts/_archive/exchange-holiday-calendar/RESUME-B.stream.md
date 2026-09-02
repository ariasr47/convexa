# RESUME-B.stream — exchange-holiday-calendar

**Resume status:** CONSUMED

## Done

- `market_session_at` is `pub(crate)`; holiday gate via `is_nyse_full_day_holiday` **before** weekend / Sunday overnight
- Weekend arm uses `is_et_weekend` (Sat/Sun only); weekday minute buckets unchanged
- PLAN tests: Thanksgiving 10/17/21 `"closed"`; Sunday 21:00 `"overnight"`; Monday 10:00 `"regular"`; unset sample `live: true`
- Did **not** write `live: false`; `armed_market_session` / replay path untouched

## Verified

- RED: `holiday_civil_date…` failed with left `"regular"` / right `"closed"` (Thanksgiving 10:00)
- GREEN: `cargo test -p api-rust --locked --lib routes::stream` → 18 passed, EXIT=0
- `armed_null_cursor_market_session_is_session_tape_not_wall` still `"regular"` for 2026-08-10 10:30 tape stamp

## Next (not this task)

- Sibling Independent tasks still in flight (B.tape / B.keep / B.ensure / B.scanner as applicable)
- B.closer writes `conformance-receipt.json` — this spawn did not

## Gotchas

- Holiday check must precede the late-Sunday overnight exception (else holiday 21:00 could be misread if someone widened weekend)
- Calendar must never own `live`; tick-age freshness stays separate from session standing
