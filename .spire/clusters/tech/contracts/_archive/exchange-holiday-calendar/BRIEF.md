# exchange-holiday-calendar — brief
Goal:            Make NYSE **full-day holidays** a first-class “not due / ineligible”
                 occupancy the same way **Sat/Sun** already are — so a closed weekday
                 (Thanksgiving, Christmas, Independence Day, …) is not treated as a
                 missing paid book, an empty extract, a coverage hole, an ensure wake,
                 or a live RTH session. One shared America/New_York holiday predicate;
                 vehicles that already have a weekend gate consume it. **Authorizes:
                 nothing.** Do not retune `opportunity_score`. Do not lift Pages
                 `_research` 404. Do not occupy `/lab`.

Decision impact: Whether the operator (and the desk) **trust occupancy on a market
                 holiday**. Observed by: on a known NYSE full-day holiday ET date D,
                 coverage is `not_due` (weekend-class empty expected — **not** three
                 `missing` cells, **not** a `[PASS]`); tape/keep print the ineligible
                 class (not miss, not empty-extract success); `MarketPhase` is not
                 `rth` at 10:00 ET that weekday; ensure does not wake SPY/QQQ/IWM;
                 scanner market-hours gate idles like a weekend. A normal weekday
                 remains due/eligible. Sat/Sun behavior unchanged.

Feasibility:     pass — code-grounded 2026-08-31: **weekend-only** clocks, no holiday
                 crate in `Cargo.toml`. Cite live, do not assume a calendar exists:
                 `MarketPhase::classify` (`apps/api/src/domain/market.rs`) returns
                 `ClosedPre` only when ET weekday ≥ 5, else 10:00 ET is `Rth` even on
                 a holiday Thursday; coverage `is_et_date_weekday` (`coverage.rs`)
                 sets `weekend: true` → HTTP `not_due` empty expected for Sat/Sun
                 only; `ensure.rs` `is_et_weekday` same rule; tape
                 `day_tape/clocks.rs` `is_et_date_weekday` +
                 `literals::ineligible_weekend`; keep `flat_file_keep/clocks.rs`
                 `is_et_weekend` + keep test **already asserts** a holiday weekday
                 with zero rows is **empty extract, not weekend**
                 (`keep.rs` `holiday_weekday_zero_rows_is_empty_extract_not_weekend`).
                 Scanner `SCAN_MARKET_HOURS_ONLY` exists (`config.rs`); holidays are
                 the remaining piece of shipped `scanner-market-hours-gate` (BACKLOG:
                 “Holidays are NOT covered”). Ticker copy already *mentions* holiday
                 as feed-lag (`TickerHeader.tsx`) without a calendar. Mechanism is a
                 **closed NYSE full-day holiday set** in-process (no vendor fetch);
                 council names the module boundary vs continuing per-leaf copies.
                 Half-days (early close) are a distinct class — council In vs Future.

Effort:          S–M

Invariant watch: `absent-is-not-none` (**HARD** — holiday ineligible ≠ miss ≠ empty
                 extract ≠ not-storing ≠ coverage `missing`) ·
                 `present-is-live-paid-only` (holiday is never `present` / never a
                 fabricated LiveMassive day) ·
                 `cited-code-is-verified-not-assumed` (cite the clocks above; do not
                 invent an existing holiday table) ·
                 `structural-over-prose-enforcement` (poison a holiday weekday as
                 Sat/Sun-ineligible and the build goes red; anti-vacuity) ·
                 `additive-keeps-score-byte-identical` (`Authorizes: nothing`) ·
                 `local-evidence-is-not-hosted-evidence` ·
                 `single-ticker-on-demand` (ensure/scanner stay off the ticker
                 request path) ·
                 `operator-vs-trader-path-separation` (no new trader nav; research
                 occupancy words stay on existing operator surfaces)

Context tags:    architecture,backend,invariants,observability,frontend

Source:          harvest 2026-08-31 (`exchange-holiday-calendar`); owner named it
                 after `research-lab-surface` GATE S. Repeat seam on tape/keep/
                 coverage/scanner (OPEN_THREADS 7as–7av; keep test documents the
                 hole).

Considered:      exchange-holiday-calendar (CHOSEN — owner named; decision-impact:
                 occupancy honesty on NYSE full-day holidays; weekend path already
                 exists and is the attach point) ·
                 grounded-morning-snapshot (culled: harvest unnamed-go default, not
                 this ask) ·
                 research-lab-sibling-reads (culled: owner named holiday, not tape/
                 extract chrome) ·
                 ops-metrics-sitting-origin (culled: not this ask) ·
                 tape-store-start-watermark (culled: related residual, not the
                 calendar) ·
                 remote-archive-body-store (culled: production-maturity #6 next in
                 *that* program) ·
                 supply-chain-automation (culled: GATE Q FAIL; do not reopen) ·
                 opportunity_score reweight (culled: wait #5; Authorizes nothing).
