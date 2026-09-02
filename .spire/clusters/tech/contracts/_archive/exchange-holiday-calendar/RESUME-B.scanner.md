# RESUME-B.scanner — exchange-holiday-calendar

**Resume status:** CONSUMED

## Done

- Extracted `should_sweep_at(now, market_hours_only)`; production `should_sweep` wraps `Utc::now()`
- Gate-on idle uses `crate::domain::is_et_session_day` (weekend **or** full-day holiday)
- Gate-off still returns true (24/7 including Thanksgiving) — same as weekend
- Colocated `holiday_sweep_tests`: Thanksgiving 10:00 ET idle when gate on; weekend parity; ordinary Monday sweeps
- Fast-lane `apply_fast_tick` heartbeat write untouched; `SCAN_MARKET_HOURS_ONLY` suite path not flipped on

## Verified

- RED: `holiday_rth_clock_idles_when_gate_on` failed on weekday-only baseline (`EXIT=101`)
- GREEN: `cargo test -p api-rust --locked --lib holiday_sweep_tests` → 3 passed, `EXIT=0`
- Filter note: module is `services::scanner::r#loop::…` (`loop` is a keyword); bare `holiday_sweep_tests` works

## Next (not this task)

- Sibling Independent tasks if still open
- B.closer writes `conformance-receipt.json` — this spawn did not

## Gotchas

- Do **not** turn `SCAN_MARKET_HOURS_ONLY` on for the BACKLOG-exempted always-on suite path
- Slow lane still calls `should_sweep(true)` as “is vendor window open?”; cfg gate decides whether to idle
- Thanksgiving oracle: `2026-11-26`; ordinary Monday: `2026-08-10`; Saturday: `2026-08-08`
