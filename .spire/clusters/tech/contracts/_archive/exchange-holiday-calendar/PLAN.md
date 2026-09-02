# exchange-holiday-calendar — implementation plan

> **For agentic workers:** implement task-by-task, in order inside a lane. Steps use checkbox
> (`- [ ]`) syntax. Each task carries its own TDD cycle: write the failing test → run it, watch it
> fail → implement minimally → run it, watch it pass. If this plan contradicts the tree, **report
> the conflict — do not resolve it silently** (`PLAN_METHOD.md`, "Plans are code"). Do not edit
> `SPEC.md` or `INTERFACE_CONTRACT.md`. Lanes implement themselves — ignore any “superpowers nested
> subagents” header elsewhere.

**Goal:** Make NYSE **full-day** weekday closures a first-class not-due / ineligible occupancy in
the same **family** as Sat/Sun, with a **distinct reason**, so a closed weekday is not a missing
paid book, not an empty extract, not a coverage hole, not an ensure wake, and not a live regular
session. `Authorizes: nothing`.

**Architecture:** One vendor-free domain module next to `domain/market.rs` owns a compile-time
NYSE full-day table (`2020..=2032`) and three predicates (`is_et_weekend` Sat/Sun only,
`is_nyse_full_day_holiday`, `is_et_session_day`). Every existing weekend gate consumes
`is_et_session_day` for due-ness and a **sibling** holiday arm for the reason. Coverage reuses the
shipped no-expected framing string keyed off **not a session day**. Tape/keep print `ineligible
holiday`. Both live classifiers session-day-gate to `ClosedPre` / `"closed"` all clock hours that
ET date. Scanner slow-lane idles like a weekend; badge Closed from a generated/pin-tested replica.
Ticker chip binds SSE `market_session === 'closed'` (closed wins over `live.live`). No
`GET /api/holidays`. Empty `libs/quant-engine` diff.

**Tech stack:** Rust 2021 · Axum/Tokio (`apps/api`, crate `api-rust`) · `chrono` +
`chrono_tz::America::New_York` (already in `apps/api/Cargo.toml` — **no** calendar crate). React 19
+ Vite + MUI (`apps/dashboard`, `@convexa/dashboard`). Tests: `cargo test -p api-rust --locked`
(add `-p quant-engine` in the closer) · `npx nx test @convexa/dashboard` · `npx nx typecheck
@convexa/dashboard`. Serve: `npx nx serve api` :8000 · `npx nx serve @convexa/dashboard` :4200.

**Spec:** `.spire/clusters/tech/contracts/exchange-holiday-calendar/SPEC.md` (APPROVED 2026-08-31)
**Interface:** `.spire/clusters/tech/contracts/exchange-holiday-calendar/INTERFACE_CONTRACT.md`

---

## Cited live (read at source — do not assume a calendar exists)

There is **no** in-tree holiday table today. `apps/api/Cargo.toml` has `chrono` + `chrono-tz` only.

- `apps/api/src/domain/market.rs` `MarketPhase::classify` — `et.weekday().num_days_from_monday() >= 5` → `ClosedPre`; else 10:00 ET on a Thursday is `Rth`. Existing pin `rth_weekday` uses **2026-08-10** 14:00 UTC = 10:00 ET → `Rth`.
- `apps/api/src/services/session_chain_archive/coverage.rs` `is_et_date_weekday` (local, weekday `< 5`) → `weekend: true` empty matrix; `d_is_due` weekday-only; `render_cli` short-circuits **only** on `matrix.weekend` (the `n == 0` path still prints `Expected due:` then `[NOT DUE]`).
- `apps/api/src/routes/research_session_coverage.rs` `envelope` keys `FRAMING` vs `FRAMING_WEEKEND` (`RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`) off `matrix.weekend` only. `CoverageOkBody` has **no** `weekend` field. Future session weekday plant `2099-01-05` already asserts ordinary `FRAMING` + `not yet due` rows.
- `apps/api/src/services/session_chain_archive/ensure.rs` `is_et_weekday` — same Sat/Sun rule; `ensure_eligible` uses it. `ensure_worker.rs` `worker_skips_weekend_force` dials 0 on Saturday.
- `apps/api/src/services/day_tape/clocks.rs` local `is_et_date_weekday`; `in_path_a_append_window` / `path_b_mark_for` drop only `weekday >= 5`. `literals.rs` `LIST_CLOCK_INELIGIBLE_WEEKEND = "ineligible weekend"` — no holiday sibling. `occupancy.rs` `derive_axis_a`: `!is_et_date_weekday` → `AxisA::IneligibleWeekend`. Replay `construct.rs` refuses weekend with `ineligible_weekend("SPY", "2026-08-15")`.
- `apps/api/src/services/flat_file_keep/clocks.rs` `is_et_weekend` Sat/Sun only. `keep.rs` `pre_get_refuse` gates weekend before GET. Test `holiday_weekday_zero_rows_is_empty_extract_not_weekend` is on **`D = "2026-08-10"`** (`EmptyExtract`, `!is_et_weekend`, not `IneligibleWeekend`, not `Miss`). **Do not invert that test in place.**
- `apps/api/src/routes/stream.rs` `market_session_at` — weekend ≥ 5 → `"closed"` except late Sunday `"overnight"`; weekday 10:00 → `"regular"`. Calendar must not write `live: false`.
- `apps/api/src/services/scanner/loop.rs` `should_sweep` uses `Utc::now()` and weekend ≥ 5; call site `should_sweep(true)` then `cfg_slow.market_hours_only && !hours_open`. Fast lane already writes heartbeat every tick (`SWEEP_DOWN_AFTER_S ≈ 180s`).
- `apps/dashboard/src/app/pages/scanner/format.ts` `marketSessionPhase` — Sat/Sun → `closed`; weekday 10:00 → `rth`. No holiday set.
- `apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.tsx` `const weekend = m.verdict === 'not_due'` then substitutes `COPY.coverageFramingWeekend` and hides rows/verdict — **coverage-card footgun** (collapses not-yet-due session weekdays).
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx` `liveStatus` short-circuits `live.live` **before** `market_session === 'closed'`. Lag tip currently contains `or it is a market holiday`.

Parse helpers (`parse_et_date`, `today_et_date`) stay **local** in tape / keep / coverage. Those files **may** `use crate::domain::{...}`. They **must not** import each other.

---

## S2 Important residuals (named pins — not new SPEC ACs)

Human-approved. Do **not** invent AC-31+. Plant these inside the named tasks.

1. **Juneteenth year gate (B.domain).** First NYSE full-day Juneteenth is **2022-06-20**. In-set pin `2022-06-20`. Out-set pins **`2021-06-18`** (Friday) and **`2020-06-19`** (Friday) so a table that closes those Fridays goes red. Generator must skip Juneteenth for `year < 2022`.
2. **Early-close still eligible (B.domain + clocks).** Civil date **`2026-11-27`** (Friday after Thanksgiving 2026 — known NYSE 13:00 ET early close) is **not** full-day ineligible. 10:00 ET may be `Rth` / `"regular"` / due / keep-eligible. Poison: `assert!(!is_nyse_full_day_holiday(d(2026,11,27)))`.
3. **Coverage-card footgun (F.card).** Empty-expected chrome keys off payload `framing === RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES` **and** empty `rows`/`holes`, **not** `verdict === 'not_due'` alone. Plant a **not-yet-due session weekday** (`2099-01-05`, already a BE HTTP plant) that must still show ordinary framing + visible rows + a verdict token.
4. **Holiday CLI short-circuit (B.coverage).** Holiday empty-expected CLI shares the weekend short-circuit (no row dump, no `Expected due:` line, `[NOT DUE] … Not a coverage pass.`) keyed off **`!is_et_session_day`**, not `matrix.weekend` only.
5. **Scanner badge all clock hours (F.replica pin, S2 Minor).** AC-18 samples 10:00 ET only. Also pin 2026-11-26 08:00 ET (would-be pre) and 17:00 ET (would-be after) → `closed`. Not a new AC.

**Coverage discriminator (S2 Minor, named so lanes do not diverge):** `CoverageMatrix` grows internal `holiday: bool` (full-day weekday only). `weekend` stays Sat/Sun only and is **not** on the HTTP envelope. Do **not** set `weekend: true` on a Thursday.

---

## Track map

| Track | Tasks | Notes |
|---|---|---|
| **Backend** (`apps/api`) | **B.domain → {B.classify ∥ B.stream ∥ B.coverage ∥ B.tape ∥ B.keep ∥ B.ensure ∥ B.scanner} → B.closer** | Product clocks + occupancy. B.domain is the foundation. |
| **Frontend** (`apps/dashboard`) | **F.replica → F.ticker → F.card → F.isolation → F.closer** | SPEC §4 does not name files → all `Independent: no`. Sequential in one FE worker. |
| **Verification** | **V1 → V8** after both closers | Exact commands + expected output. GATE Q hermetic owns holiday **values**. |

**Parallelism:** Backend and Frontend tracks are independently executable. Do not wait for the other track’s closer. Verification runs after both land. Intra-backend: finish **B.domain** first, then up to two `Independent: yes` workers at a time.

**Git (binding):** this tree is mixed-dirty (`codex/browser-quality-gates`). **Do not** `git stash`, `git stash pop`, `git restore`, `git reset`, or `git commit`. Skip every commit step. Stage nothing. Touch only this feature’s paths listed per task.

---

## Global Constraints

Every task's requirements implicitly include this section.

### Standing project constraints (each has bitten this repo)

- **Check EXIT CODES, not printed summaries.** PowerShell: `$LASTEXITCODE` after every gate command.
- **A green `nx test` does not mean TS types are sound.** Run `npx nx typecheck @convexa/dashboard` before any frontend green claim. Vitest transpiles without typechecking.
- **Never run a bare `nx format:write`.** Scope it: `npx nx format:write --files path/a,path/b`. Rust is `cargo fmt -p api-rust` only.
- **Never write a literal NUL byte.**
- **Never `git stash` / restore / reset** while other sessions may hold uncommitted work. **Skip commits** on this mixed dirty tree.
- **`npm run ports:free` before any run-the-app verification** (stale Vite on `:4200` / `[::1]`; never 8001).
- **Cite live Axum / dashboard sources.** Do not cite `archive/api-python/`.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, council files, BRIEF, `DESIGN_SYSTEM.md`, or other feature folders.

### Feature hard rules (settled — do not re-open)

- One compile-time NYSE **full-day** table `2020..=2032` in `apps/api/src/domain/`. Lookup `fn(NaiveDate) -> bool` is total — never `Result`, never HTTP, never a missing file at serve. Unlisted (including outside the span) ≠ holiday. Weekend stays Sat/Sun. Do **not** widen `is_et_weekend`.
- Sibling occupancy: holiday weekday ≠ weekend ≠ miss ≠ empty extract ≠ empty-while-storing ≠ not-yet-due session weekday. Do **not** reuse `IneligibleWeekend` / `weekend: true` for Thanksgiving.
- Coverage HTTP reuses `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`. No sixth cell, no holiday name, no coverage HTTP `weekend` field, no `[PASS]` on empty-expected.
- Tape/keep sibling literals exactly as SPEC §4 / INTERFACE. Keep gates **before GET**. Leave `holiday_weekday_zero_rows_is_empty_extract_not_weekend` on **2026-08-10**. Add **2026-11-26** ineligible-holiday (files-call 0).
- Session-day gate first: holiday civil date is `ClosedPre` / `"closed"` **all clock hours** that ET date. Late-Sunday `"overnight"` remains **Sunday only**. Calendar does **not** write `live: false`. `market_session === 'closed'` wins over the live short-circuit.
- Scanner replica is generated **or** pin-equality-tested — **not** a hand-pasted independent FE book. No `GET /api/holidays`. Ticker chip binds SSE `closed`, not the replica.
- `authorizes` is exactly `nothing`. Empty `libs/quant-engine` diff. Pages `_research` 404 stands (`functions/api/[[path]].ts` — **do not edit**). `/lab` still `data-testid="lab-index"`. No new trader nav, no new operator URL, no `/api/holidays`.
- Half-days / early close are **not** full-day ineligible. Canonical holiday weekday D = **2026-11-26**. Ordinary weekday = **2026-08-10**. Weekend oracles `2026-08-08` / `2026-08-15`.
- Do **not** mark `"auth": true` on conformance. Do **not** live-fetch `GET /api/stream/{ticker}` as JSON 200.
- Do **not** occupy `/lab`. Do not reopen `supply-chain-automation`.

### Conformance spec

Live `interface_conformance.mjs --url` runs `endpoints` only (HTTP JSON). `sse_data_event` is the machine-checkable ticker SSE `data:` shape the client branches on; live fetch of `GET /api/stream/{ticker}` 200 is event-stream and must **not** be hung as a 200 JSON probe. GATE Q validates `market_session` on a planted holiday instant in sample mode / hermetic tests. Exact `verdict` / `framing` **values** on `et_date=2026-11-26` are GATE Q (today that date is a future session weekday on an unshipped calendar; after ship it is empty-expected). Live G1 checks **types and presence**.

```json
{
  "sse_data_event": {
    "method": "GET",
    "path": "/api/stream/{ticker}",
    "note": "SSE data JSON; not live-fetched by interface_conformance.mjs",
    "required_always": {
      "ticker": "string",
      "mid": "number|null",
      "bid": "number|null",
      "ask": "number|null",
      "spread": "number|null",
      "net_flow": "number",
      "buy_vol": "number",
      "sell_vol": "number",
      "flow_window_s": "number",
      "spot_ts": "number",
      "live": "boolean",
      "tick_age_s": "number|null",
      "market_session": "string",
      "feed": "string",
      "ts": "number",
      "gamma_flip": "number|null",
      "last_trade": "number|null"
    }
  },
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbols": "array",
        "symbols[]": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].et_date": "string",
        "rows[].cell": "string",
        "rows[].last_readable": "string",
        "holes": "array",
        "holes[].symbol": "string",
        "holes[].et_date": "string",
        "holes[].class": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": { "et_date": "2026-08-08" },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "authorizes": "string",
        "license": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "holes": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": { "et_date": "2026-11-26" },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "authorizes": "string",
        "license": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "holes": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": { "et_date": "not-a-date" },
      "expect_status": 422,
      "required": {
        "error": "string",
        "detail": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    }
  ]
}
```

---

## Backend track

### B.domain — NYSE full-day module + three predicates

**Files:** `apps/api/src/domain/nyse_full_day.rs` (new), `apps/api/src/domain/mod.rs`.

**Depends on:** —

- [ ] **Step 1: Failing tests first.** Create `apps/api/src/domain/nyse_full_day.rs` with `#[cfg(test)]` tests that call the public predicates (they will not compile until Step 3). Then add the module to `domain/mod.rs` so `cargo test -p api-rust --lib domain::nyse_full_day` is the gate.

Test body (put in `nyse_full_day.rs`):

```rust
use chrono::NaiveDate;

fn d(y: i32, m: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(y, m, day).unwrap()
}

#[test]
fn table_is_nonempty_anti_vacuity() {
    assert!(!NYSE_FULL_DAY.is_empty());
}

#[test]
fn in_set_pins_2026() {
    for (y, m, day) in [
        (2026, 1, 1),
        (2026, 4, 3),
        (2026, 7, 3),
        (2026, 11, 26),
        (2026, 12, 25),
    ] {
        let x = d(y, m, day);
        assert!(is_nyse_full_day_holiday(x), "{x} must be in-set");
        assert!(!is_et_weekend(x), "{x} is a weekday");
        assert!(!is_et_session_day(x));
    }
}

#[test]
fn poison_holiday_is_not_weekend() {
    let thanksgiving = d(2026, 11, 26);
    assert!(is_nyse_full_day_holiday(thanksgiving) && !is_et_weekend(thanksgiving));
}

#[test]
fn observed_independence_friday_is_holiday_saturday_is_weekend() {
    assert!(is_nyse_full_day_holiday(d(2026, 7, 3)));
    assert!(is_et_weekend(d(2026, 7, 4)));
    assert!(!is_nyse_full_day_holiday(d(2026, 7, 4)));
}

#[test]
fn out_set_session_days() {
    for (y, m, day) in [
        (2026, 8, 10),  // keep D, Monday
        (2026, 10, 12), // Columbus Day — NYSE open
        (2026, 11, 11), // Veterans Day — NYSE open
        (2026, 11, 27), // S2 pin: Day-after-Thanksgiving early close, still eligible
    ] {
        let x = d(y, m, day);
        assert!(!is_nyse_full_day_holiday(x), "{x} must stay eligible");
        assert!(is_et_session_day(x));
    }
}

#[test]
fn juneteenth_year_gate() {
    // S2 Important pin — not a new AC.
    assert!(is_nyse_full_day_holiday(d(2022, 6, 20)));
    assert!(!is_nyse_full_day_holiday(d(2021, 6, 18)));
    assert!(!is_nyse_full_day_holiday(d(2020, 6, 19)));
    assert!(is_et_session_day(d(2021, 6, 18)));
    assert!(is_et_session_day(d(2020, 6, 19)));
}

#[test]
fn weekend_oracles_unchanged() {
    assert!(is_et_weekend(d(2026, 8, 8)));
    assert!(is_et_weekend(d(2026, 8, 15)));
    assert!(!is_nyse_full_day_holiday(d(2026, 8, 8)));
    assert!(!is_et_session_day(d(2026, 8, 8)));
}

#[test]
fn unlisted_outside_span_is_not_holiday() {
    // 2019-11-28 Thanksgiving Thursday; 2033-11-24 Thanksgiving Thursday.
    assert!(!is_nyse_full_day_holiday(d(2019, 11, 28)));
    assert!(is_et_session_day(d(2019, 11, 28)));
    assert!(!is_nyse_full_day_holiday(d(2033, 11, 24)));
    assert!(is_et_session_day(d(2033, 11, 24)));
}

#[test]
fn empty_unscheduled_overlay_does_not_close_session_days() {
    assert!(UNSCHEDULED_FULL_DAY.is_empty());
}

#[test]
fn static_table_equals_generated_regular_set() {
    let generated = generated_regular_nyse_full_days();
    assert_eq!(NYSE_FULL_DAY, generated.as_slice());
}

#[test]
fn table_is_sorted_unique() {
    for w in NYSE_FULL_DAY.windows(2) {
        assert!(w[0] < w[1], "table must be strictly sorted for binary_search");
    }
}

#[test]
fn quant_engine_sources_do_not_mention_calendar() {
    // Walk the engine crate's src (not a product import).
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../../libs/quant-engine/src");
    let mut hits = Vec::new();
    fn walk(dir: &std::path::Path, hits: &mut Vec<String>) {
        for e in std::fs::read_dir(dir).unwrap() {
            let p = e.unwrap().path();
            if p.is_dir() {
                walk(&p, hits);
            } else if p.extension().and_then(|s| s.to_str()) == Some("rs") {
                let s = std::fs::read_to_string(&p).unwrap();
                if s.contains("nyse_full_day") || s.contains("is_nyse_full_day_holiday") {
                    hits.push(p.display().to_string());
                }
            }
        }
    }
    walk(std::path::Path::new(root), &mut hits);
    assert!(hits.is_empty(), "quant-engine must not import the calendar: {hits:?}");
}
```

- [ ] **Step 2: Watch fail.**

```powershell
cargo test -p api-rust --locked --lib domain::nyse_full_day
echo $LASTEXITCODE
```

Expected: compile error (module / predicates / `NYSE_FULL_DAY` missing) or test fail on empty table. `$LASTEXITCODE` ≠ 0.

- [ ] **Step 3: Implement the module.** Production lookup is the static table + binary search. Test-only generator does **not** run in production. Juneteenth only for `year >= 2022`. Loop holiday years `2019..=2033` and **keep** dates whose year is in `2020..=2032` (captures 2033-01-01 Saturday → observed **2032-12-31**).

`apps/api/src/domain/mod.rs` — add:

```rust
pub mod nyse_full_day;

pub use nyse_full_day::{is_et_session_day, is_et_weekend, is_nyse_full_day_holiday};
```

Keep existing `pub use market::{MarketPhase, OptionsMarketState};`.

`apps/api/src/domain/nyse_full_day.rs` production + generator (fill `NYSE_FULL_DAY` from the generator so the equality test is green — do not hand-type a subset):

```rust
//! NYSE full-day closures on America/New_York civil dates.
//! Vendor-free. Lookup is total. Weekend is Sat/Sun only.

use chrono::{Datelike, NaiveDate, Weekday};

/// Sorted unique `(year, month, day)` triples. Years 2020..=2032 inclusive.
/// Fill from `generated_regular_nyse_full_days()` so the equality test holds.
const NYSE_FULL_DAY: &[(i32, u8, u8)] = &[]; // replace with generator output in the same step

/// Attach point for one-off closures. v1 is empty.
const UNSCHEDULED_FULL_DAY: &[(i32, u8, u8)] = &[];

pub fn is_et_weekend(date: NaiveDate) -> bool {
    date.weekday().num_days_from_monday() >= 5
}

pub fn is_nyse_full_day_holiday(date: NaiveDate) -> bool {
    let key = (date.year(), date.month() as u8, date.day() as u8);
    NYSE_FULL_DAY.binary_search(&key).is_ok() || UNSCHEDULED_FULL_DAY.binary_search(&key).is_ok()
}

pub fn is_et_session_day(date: NaiveDate) -> bool {
    !is_et_weekend(date) && !is_nyse_full_day_holiday(date)
}

/// Sorted ISO `YYYY-MM-DD` of the compile-time table (replica pin / V dump).
pub fn nyse_full_day_iso_dates() -> Vec<String> {
    NYSE_FULL_DAY
        .iter()
        .map(|(y, m, d)| format!("{y:04}-{m:02}-{d:02}"))
        .collect()
}

#[cfg(test)]
pub(crate) fn generated_regular_nyse_full_days() -> Vec<(i32, u8, u8)> {
    let mut out = Vec::new();
    for y in 2019..=2033 {
        push_observed(&mut out, y, 1, 1); // New Year's
        push_nth_weekday(&mut out, y, 1, 3, Weekday::Mon); // MLK
        push_nth_weekday(&mut out, y, 2, 3, Weekday::Mon); // Washington's Birthday
        push_good_friday(&mut out, y);
        push_last_weekday(&mut out, y, 5, Weekday::Mon); // Memorial
        if y >= 2022 {
            push_observed(&mut out, y, 6, 19); // Juneteenth
        }
        push_observed(&mut out, y, 7, 4); // Independence
        push_nth_weekday(&mut out, y, 9, 1, Weekday::Mon); // Labor
        push_nth_weekday(&mut out, y, 11, 4, Weekday::Thu); // Thanksgiving
        push_observed(&mut out, y, 12, 25); // Christmas
    }
    out.retain(|&(y, _, _)| (2020..=2032).contains(&y));
    out.sort_unstable();
    out.dedup();
    out
}

#[cfg(test)]
fn keep_if_span(out: &mut Vec<(i32, u8, u8)>, date: NaiveDate) {
    let y = date.year();
    if (2020..=2032).contains(&y) {
        out.push((y, date.month() as u8, date.day() as u8));
    }
}

#[cfg(test)]
fn push_observed(out: &mut Vec<(i32, u8, u8)>, y: i32, m: u32, day: u32) {
    let date = NaiveDate::from_ymd_opt(y, m, day).unwrap();
    let observed = match date.weekday() {
        Weekday::Sat => date.pred_opt().unwrap(),
        Weekday::Sun => date.succ_opt().unwrap(),
        _ => date,
    };
    keep_if_span(out, observed);
}

#[cfg(test)]
fn push_nth_weekday(out: &mut Vec<(i32, u8, u8)>, y: i32, m: u32, n: u8, wd: Weekday) {
    let mut d = NaiveDate::from_ymd_opt(y, m, 1).unwrap();
    let mut seen = 0u8;
    while d.month() == m {
        if d.weekday() == wd {
            seen += 1;
            if seen == n {
                keep_if_span(out, d);
                return;
            }
        }
        d = d.succ_opt().unwrap();
    }
    panic!("nth weekday not found {y}-{m} n={n}");
}

#[cfg(test)]
fn push_last_weekday(out: &mut Vec<(i32, u8, u8)>, y: i32, m: u32, wd: Weekday) {
    let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    let mut d = NaiveDate::from_ymd_opt(ny, nm, 1).unwrap().pred_opt().unwrap();
    while d.weekday() != wd {
        d = d.pred_opt().unwrap();
    }
    keep_if_span(out, d);
}

#[cfg(test)]
fn push_good_friday(out: &mut Vec<(i32, u8, u8)>, y: i32) {
    // Anonymous Gregorian (Meeus/Jones/Butcher). Easter Sunday → minus 2 days.
    let a = y % 19;
    let b = y / 100;
    let c = y % 100;
    let dd = b / 4;
    let e = b % 4;
    let f = (b + 8) / 25;
    let g = (b - f + 1) / 3;
    let h = (19 * a + b - dd - g + 15) % 30;
    let i = c / 4;
    let k = c % 4;
    let l = (32 + 2 * e + 2 * i - h - k) % 7;
    let m = (a + 11 * h + 22 * l) / 451;
    let month = (h + l - 7 * m + 114) / 31;
    let day = (h + l - 7 * m + 114) % 31 + 1;
    let easter = NaiveDate::from_ymd_opt(y, month as u32, day as u32).unwrap();
    keep_if_span(out, easter.pred_opt().unwrap().pred_opt().unwrap());
}
```

Fill `NYSE_FULL_DAY` by running the generator in a throwaway `dbg!` / a one-shot assert print, then paste the sorted triples. The equality test is the gate — do not ship `&[]`. Confirm 2026 Good Friday is `2026-04-03` (Easter 2026-04-05).

Do **not** include Columbus Day, Veterans Day, Election Day, or `2026-11-27`.

- [ ] **Step 4: Watch pass.**

```powershell
cargo test -p api-rust --locked --lib domain::nyse_full_day
echo $LASTEXITCODE
```

Expected: all `nyse_full_day` tests pass, `$LASTEXITCODE` `0`. `table_is_nonempty_anti_vacuity` is non-vacuous (`NYSE_FULL_DAY.len() > 0`).

**Reviewer probe:** poison `is_et_weekend(d(2026,11,26))` → red; poison `is_nyse_full_day_holiday(d(2021,6,18))` → red; poison `is_nyse_full_day_holiday(d(2026,11,27))` → red; empty table → red.

---

### B.classify — `MarketPhase::classify` session-day gate → `ClosedPre`

**Files:** `apps/api/src/domain/market.rs`.

**Depends on:** B.domain

- [ ] **Step 1: Failing tests** in the existing `#[cfg(test)]` module (keep `rth_weekday` on 2026-08-10):

```rust
fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
    New_York
        .with_ymd_and_hms(y, m, d, h, min, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc)
}

#[test]
fn holiday_weekday_all_hours_are_closed_pre() {
    // 2026-11-26 Thanksgiving. EST = UTC-5.
    assert_eq!(MarketPhase::classify(et_hm(2026, 11, 26, 10, 0)), MarketPhase::ClosedPre);
    assert_eq!(MarketPhase::classify(et_hm(2026, 11, 26, 17, 0)), MarketPhase::ClosedPre);
    assert_eq!(MarketPhase::classify(et_hm(2026, 11, 26, 21, 0)), MarketPhase::ClosedPre);
    assert_ne!(MarketPhase::classify(et_hm(2026, 11, 26, 17, 0)), MarketPhase::AfterClose);
}

#[test]
fn ordinary_weekday_1000_is_rth() {
    assert_eq!(MarketPhase::classify(et_hm(2026, 8, 10, 10, 0)), MarketPhase::Rth);
}

#[test]
fn early_close_weekday_1000_may_be_rth() {
    assert_eq!(MarketPhase::classify(et_hm(2026, 11, 27, 10, 0)), MarketPhase::Rth);
}
```

Add `use chrono_tz::America::New_York;` in tests if missing. `et_hm` already exists in other leaves; this file currently uses `Utc.with_ymd_and_hms` — either style is fine as long as 2026-08-10 14:00 UTC stays `Rth`.

- [ ] **Step 2: Watch fail** — Thanksgiving 10:00 still `Rth`.

```powershell
cargo test -p api-rust --locked --lib domain::market
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.** At the top of `classify`, after converting to ET:

```rust
use super::{is_et_weekend, is_nyse_full_day_holiday};

pub fn classify(now: DateTime<Utc>) -> Self {
    let et = now.with_timezone(&New_York);
    let date = et.date_naive();
    if is_et_weekend(date) || is_nyse_full_day_holiday(date) {
        return Self::ClosedPre;
    }
    // existing open/close time split unchanged
}
```

Do **not** fall through to `AfterClose` after 16:00 on a holiday (`resolve_gex_spot` for `AfterClose` prefers **today’s** close).

- [ ] **Step 4: Watch pass** — same command, `$LASTEXITCODE` `0`. Existing `rth_weekday` / `after_close_weekday` / `closed_pre_weekend` still green.

**Reviewer probe:** holiday 17:00 is `ClosedPre`, not `AfterClose`. 2026-08-10 10:00 remains `Rth`.

---

### B.stream — `market_session_at` session-day gate → `"closed"`

**Files:** `apps/api/src/routes/stream.rs`.

**Depends on:** B.domain

- [ ] **Step 1: Failing tests** in the existing `#[cfg(test)]` of `stream.rs`. Make `market_session_at` `pub(crate)` so the tests (same module) stay simple. Do **not** change `live` construction.

```rust
#[test]
fn holiday_civil_date_market_session_is_closed_all_hours() {
    assert_eq!(market_session_at(et_hm(2026, 11, 26, 10, 0)), "closed");
    assert_eq!(market_session_at(et_hm(2026, 11, 26, 17, 0)), "closed");
    assert_eq!(market_session_at(et_hm(2026, 11, 26, 21, 0)), "closed");
    assert_ne!(market_session_at(et_hm(2026, 11, 26, 10, 0)), "regular");
    assert_ne!(market_session_at(et_hm(2026, 11, 26, 21, 0)), "overnight");
}

#[test]
fn late_sunday_overnight_remains_sunday_only() {
    // 2026-08-09 is Sunday; 21:00 ET.
    assert_eq!(market_session_at(et_hm(2026, 8, 9, 21, 0)), "overnight");
}

#[test]
fn ordinary_monday_1000_is_regular() {
    assert_eq!(market_session_at(et_hm(2026, 8, 10, 10, 0)), "regular");
}

#[test]
fn calendar_does_not_write_live_false_on_unset_sample() {
    let json = serde_json::to_value(sample_unset_body()).unwrap();
    assert_eq!(json["live"], true);
    assert_eq!(json["live"].as_bool(), Some(true));
}
```

Reuse or add the same `et_hm` helper as other leaves (`New_York.with_ymd_and_hms`). `sample_unset_body` already exists and sets `live: true` — that test documents the calendar does not own `live`.

- [ ] **Step 2: Watch fail** — Thanksgiving 10:00 is `"regular"`.

```powershell
cargo test -p api-rust --locked --lib routes::stream
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.** Import `crate::domain::{is_et_weekend, is_nyse_full_day_holiday}`. In `market_session_at`:

```rust
fn market_session_at(when: DateTime<Utc>) -> &'static str {
    let et = when.with_timezone(&New_York);
    let date = et.date_naive();
    if is_nyse_full_day_holiday(date) {
        return "closed";
    }
    if is_et_weekend(date) {
        if et.weekday().num_days_from_monday() == 6 && et.hour() >= 20 {
            return "overnight";
        }
        return "closed";
    }
    // existing weekday minute buckets unchanged
}
```

Holiday check **before** the Sunday overnight exception. Do not set `live` from this function. Armed replay path (`armed_market_session`) stays tape-stamp / `session_tape`.

- [ ] **Step 4: Watch pass.** Existing `armed_null_cursor_market_session_is_session_tape_not_wall` still expects `"regular"` for a **2026-08-10** 10:30 tape stamp.

**Reviewer probe:** holiday 21:00 is `"closed"`, not overnight-as-session-weekday; Sunday 21:00 still `"overnight"`.

---

### B.coverage — empty-expected keyed off `!is_et_session_day`

**Files:** `apps/api/src/services/session_chain_archive/coverage.rs`, `apps/api/src/routes/research_session_coverage.rs`.

**Depends on:** B.domain

- [ ] **Step 1: Failing tests** in `coverage.rs` next to `weekend_is_not_due_empty_expected_exit_0`, plus HTTP twins in `research_session_coverage.rs` next to `coverage_weekend_200_not_due_empty_rows`.

Coverage derive / CLI:

```rust
#[tokio::test]
async fn holiday_weekday_is_empty_expected_not_due_not_weekend() {
    let _g = begin_test();
    let archive = SessionChainArchive::memory();
    let now = et_hm(2026, 11, 27, 12, 0); // day after — D is past
    let m = derive(&archive, now, "2026-11-26").await.unwrap();
    assert!(!m.weekend, "do not set weekend true on a Thursday");
    assert!(m.holiday);
    assert!(m.rows.is_empty());
    assert!(m.holes.is_empty());
    assert_eq!(m.http_verdict(), "not_due");
    assert_eq!(m.expected_due(), 0);
    assert_eq!(m.present, 0);
    let (stdout, code) = render_cli(&m, true);
    assert!(exit_success(code));
    assert!(stdout.contains("[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass."));
    assert!(!stdout.contains("[PASS]"));
    assert!(!stdout.contains("Expected due:"), "holiday CLI shares weekend short-circuit");
    assert!(!stdout.to_lowercase().contains("weekend"));
}

#[tokio::test]
async fn today_holiday_before_checkpoint_is_empty_expected_not_not_yet_due() {
    let _g = begin_test();
    let archive = SessionChainArchive::memory();
    let now = et_hm(2026, 11, 26, 10, 0);
    let m = derive(&archive, now, "2026-11-26").await.unwrap();
    assert!(m.holiday);
    assert!(m.rows.is_empty());
    assert!(!m.rows.iter().any(|r| r.cell == "not yet due"));
}

#[tokio::test]
async fn leftover_live_paid_on_holiday_is_not_present_and_not_pass() {
    let _g = begin_test();
    let archive = SessionChainArchive::memory();
    let as_of = et_hm(2026, 11, 26, 17, 0);
    for sym in ["SPY", "QQQ", "IWM"] {
        plant_live(&archive, sym, as_of).await;
    }
    let now = et_hm(2026, 11, 27, 12, 0);
    let m = derive(&archive, now, "2026-11-26").await.unwrap();
    assert_eq!(m.http_verdict(), "not_due");
    assert_ne!(m.http_verdict(), "pass");
    assert_eq!(m.present, 0);
    assert!(m.rows.is_empty());
}

#[tokio::test]
async fn ordinary_tuesday_after_checkpoint_still_due_missing() {
    let _g = begin_test();
    let archive = SessionChainArchive::memory();
    let now = et_hm(2026, 8, 10, 16, 0);
    let m = derive(&archive, now, "2026-08-10").await.unwrap();
    assert!(!m.weekend);
    assert!(!m.holiday);
    assert_eq!(m.rows.len(), 3);
    assert!(m.rows.iter().any(|r| r.cell == "missing"));
}

#[tokio::test]
async fn future_holiday_is_empty_expected_not_future_session_rows() {
    let _g = begin_test();
    let archive = SessionChainArchive::memory();
    let now = et_hm(2026, 8, 10, 17, 0);
    let m = derive(&archive, now, "2026-11-26").await.unwrap();
    assert!(m.holiday);
    assert!(m.rows.is_empty());
}

#[tokio::test]
async fn span_hole_2019_thanksgiving_is_due_missing() {
    let _g = begin_test();
    let archive = SessionChainArchive::memory();
    let now = et_hm(2026, 8, 10, 17, 0);
    let m = derive(&archive, now, "2019-11-28").await.unwrap();
    assert!(!m.holiday);
    assert!(!m.weekend);
    assert!(m.rows.iter().any(|r| r.cell == "missing"));
}
```

HTTP (`research_session_coverage.rs`):

```rust
#[tokio::test]
async fn coverage_holiday_200_not_due_empty_rows_no_weekend_word() {
    begin();
    let state = AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
        .await
        .unwrap();
    let res = call(state, Some("2026-11-26"), HeaderMap::new()).await;
    let (status, v) = body_json(res).await;
    assert_eq!(status, StatusCode::OK, "{v}");
    assert_eq!(v["verdict"], "not_due");
    assert_eq!(v["framing"], FRAMING_WEEKEND);
    assert!(!v["framing"].as_str().unwrap().to_lowercase().contains("weekend"));
    assert_eq!(v["expected_due"], 0);
    assert_eq!(v["rows"].as_array().unwrap().len(), 0);
    assert_eq!(v["holes"].as_array().unwrap().len(), 0);
    assert_eq!(v["vendor_called"], false);
    assert_eq!(v["authorizes"], "nothing");
    assert_eq!(v["evidence"], "this process");
    assert!(v.get("weekend").is_none());
}

#[tokio::test]
async fn coverage_unparseable_is_422_not_empty_expected_holiday() {
    // existing coverage_422_unparseable_et_date already pins this — keep it.
}
```

Keep `coverage_named_future_weekday_is_not_due_framing_without_weekend_suffix` (`2099-01-05`) green — that is the not-yet-due session-weekday control.

- [ ] **Step 2: Watch fail.**

```powershell
cargo test -p api-rust --locked --lib services::session_chain_archive::coverage holiday
cargo test -p api-rust --locked --lib routes::research_session_coverage coverage_holiday
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.**

`CoverageMatrix` — add `pub holiday: bool`. Both struct literals (weekend empty arm ~line 301 and weekday arm ~line 375) must set it.

`IdentityStatus` — add `IneligibleHoliday`. `cell_literal` returns `None` for `IneligibleHoliday` the same way as `IneligibleWeekend`.

`d_is_due` — parse `NaiveDate`, return false when `!is_et_session_day`. Do not use weekday-only.

`derive` — after store-enabled checks:

```rust
use crate::domain::{is_et_session_day, is_et_weekend, is_nyse_full_day_holiday};

let nd = NaiveDate::parse_from_str(d, "%Y-%m-%d").ok();
if nd.is_some_and(is_et_weekend) {
    return Ok(CoverageMatrix { weekend: true, holiday: false, due: false, rows: vec![], holes: vec![], /* zeros */ et_date: d.to_string(), .. });
}
if nd.is_some_and(is_nyse_full_day_holiday) {
    return Ok(CoverageMatrix { weekend: false, holiday: true, due: false, rows: vec![], holes: vec![], /* zeros */ et_date: d.to_string(), .. });
}
```

Do **not** set `weekend: true` on a Thursday. Parse helpers stay local — only predicates come from `crate::domain`.

`render_cli` — replace `if matrix.weekend` with session-day:

```rust
let session_day = NaiveDate::parse_from_str(&matrix.et_date, "%Y-%m-%d")
    .is_some_and(is_et_session_day);
if !session_day {
    // existing weekend short-circuit body (closing + [NOT DUE], no Expected due)
    return (out, ExitCode::SUCCESS);
}
```

`envelope` in `research_session_coverage.rs`:

```rust
let session_day = NaiveDate::parse_from_str(&matrix.et_date, "%Y-%m-%d")
    .is_some_and(crate::domain::is_et_session_day);
let framing = if !session_day { FRAMING_WEEKEND } else { FRAMING };
```

Keep the const name `FRAMING_WEEKEND`; the string has no word `weekend`. Do not add HTTP keys.

- [ ] **Step 4: Watch pass.** Weekend test `coverage_weekend_200_not_due_empty_rows` / `weekend_is_not_due_empty_expected_exit_0` still green. `COVERAGE_VENDOR_CALLS` stays 0. `authorizes` `"nothing"`.

**Reviewer probe:** CLI on 2026-11-26 has no `Expected due:` line; HTTP framing equals the no-expected string; `weekend` JSON key absent; leftover LiveMassive on D is not `present`.

---

### B.tape — sibling `ineligible holiday`

**Files:**
- `apps/api/src/services/day_tape/literals.rs`
- `apps/api/src/services/day_tape/clocks.rs`
- `apps/api/src/services/day_tape/occupancy.rs`
- `apps/api/src/services/day_tape/construct.rs`
- `apps/api/src/services/day_tape/cli.rs`
- `apps/api/src/services/day_tape/mod.rs`
- `apps/api/src/routes/research_session_day_tape.rs`

**Depends on:** B.domain

- [ ] **Step 1: Failing tests** in `occupancy.rs` / `clocks.rs` / `construct.rs` / HTTP route.

```rust
#[test]
fn holiday_weekday_is_ineligible_holiday_not_weekend() {
    let now = et_hm(2026, 11, 27, 12, 0);
    let a = derive_axis_a("SPY", "2026-11-26", now, true, false, false);
    assert_eq!(a, AxisA::IneligibleHoliday);
    assert_ne!(a, AxisA::IneligibleWeekend);
    assert_eq!(list_clock(a, None), Some("ineligible holiday"));
    assert_eq!(
        axis_a_detail(a, "SPY", "2026-11-26", ""),
        Some("session day tape ineligible holiday: SPY on 2026-11-26".into())
    );
}

#[test]
fn saturday_stays_ineligible_weekend() {
    let now = et_hm(2026, 8, 10, 12, 0);
    let a = derive_axis_a("SPY", "2026-08-15", now, true, false, false);
    assert_eq!(a, AxisA::IneligibleWeekend);
}

#[test]
fn path_a_window_closed_at_noon_et_on_holiday() {
    assert!(!in_path_a_append_window(et_hm(2026, 11, 26, 12, 0)));
    assert_eq!(path_b_mark_for(et_hm(2026, 11, 26, 12, 0)), None);
    // ordinary Monday noon still open
    assert!(in_path_a_append_window(et_hm(2026, 8, 10, 12, 0)));
}
```

Replay refuse (clone `unreadable_weekend_not_elapsed_nvda_not_storing_refuse_before_bind` Saturday plant):

```rust
#[tokio::test]
async fn holiday_et_date_refuses_before_bind_with_holiday_literal() {
    // prepare_then_bind("SPY", "2026-11-26", ...) expect_err
    // assert_eq!(err, literals::ineligible_holiday("SPY", "2026-11-26"));
    // assert_ne!(err, literals::ineligible_weekend("SPY", "2026-11-26"));
}
```

HTTP: plant `et_date=2026-11-26`, assert framing `RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY`, 200, `authorizes` `"nothing"`. Saturday still `… INELIGIBLE WEEKEND`.

- [ ] **Step 2: Watch fail** — Thanksgiving currently `AxisA::StoringReady` / NoIdentity (it is a weekday).

```powershell
cargo test -p api-rust --locked --lib services::day_tape holiday
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.**

`literals.rs`:

```rust
pub const LIST_CLOCK_INELIGIBLE_HOLIDAY: &str = "ineligible holiday";
pub const FRAMING_HOLIDAY: &str = "RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY"; // if HTTP uses occupancy, still add the HTTP const in the route

pub fn ineligible_holiday(symbol: &str, et_date: &str) -> String {
    format!("session day tape ineligible holiday: {symbol} on {et_date}")
}
```

Add `LIST_CLOCK_INELIGIBLE_HOLIDAY` to `LIST_CLOCK_CLOSED`. Re-export from `day_tape/mod.rs`.

`clocks.rs` — keep `is_et_date_weekday` as Sat/Sun complement (do **not** fold holidays into it). Session-day gate the windows:

```rust
use crate::domain::is_et_session_day;

pub fn in_path_a_append_window(now: DateTime<Utc>) -> bool {
    let et = now.with_timezone(&New_York);
    if !is_et_session_day(et.date_naive()) {
        return false;
    }
    // existing 04:00 ≤ t < 20:00
}

pub fn path_b_mark_for(now: DateTime<Utc>) -> Option<(u32, u32)> {
    let et = now.with_timezone(&New_York);
    if !is_et_session_day(et.date_naive()) {
        return None;
    }
    // existing mark math
}
```

`occupancy.rs` `AxisA` — add `IneligibleHoliday`. `derive_axis_a`:

```rust
use crate::domain::{is_et_weekend, is_nyse_full_day_holiday};

let nd = NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok();
if nd.is_some_and(is_et_weekend) {
    return AxisA::IneligibleWeekend;
}
if nd.is_some_and(is_nyse_full_day_holiday) {
    return AxisA::IneligibleHoliday;
}
```

Do **not** map holiday through `!is_et_date_weekday` (that would print weekend). Exhaustive `match` on `AxisA` in `list_clock`, `axis_a_detail`, `axis_a_label`, `construct.rs` (both early + loaded matches), `cli.rs` (both matches), `research_session_day_tape.rs` `framing_for_axis_a`, and the occupancy exhaustive-arm test arrays. Forgotten leaf **must not compile**.

`construct.rs` refuse arm:

```rust
AxisA::IneligibleHoliday => Prepare::Refuse {
    literal: literals::ineligible_holiday(&symbol, &et_date),
},
```

Route `framing_for_axis_a`:

```rust
AxisA::IneligibleHoliday => FRAMING_HOLIDAY, // "RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY"
```

Add `const FRAMING_HOLIDAY` next to `FRAMING_WEEKEND` in the route.

- [ ] **Step 4: Watch pass.** Saturday plants still `ineligible weekend`. Noon Monday 2026-08-10 Path-A still open.

**Reviewer probe:** exhaustive match compiles; leftover tape on D inspects as ineligible holiday; replay refuse literal is holiday, not weekend.

---

### B.keep — sibling `ineligible holiday`; 2026-08-10 EmptyExtract unchanged

**Files:**
- `apps/api/src/services/flat_file_keep/literals.rs`
- `apps/api/src/services/flat_file_keep/clocks.rs`
- `apps/api/src/services/flat_file_keep/occupancy.rs`
- `apps/api/src/services/flat_file_keep/keep.rs`
- `apps/api/src/services/flat_file_keep/cli.rs`
- `apps/api/src/services/flat_file_keep/mod.rs`
- `apps/api/src/routes/research_flat_files.rs`

**Depends on:** B.domain

- [ ] **Step 1: Failing tests.** **Do not change** `holiday_weekday_zero_rows_is_empty_extract_not_weekend` (`D = "2026-08-10"`). Add a **new** test:

```rust
#[tokio::test]
async fn thanksgiving_2026_11_26_is_ineligible_holiday_files_call_0() {
    let client = StubClient::both(StubResp::AssertNotCalled);
    let store = FlatFilesStore::memory();
    let tmp = temp_dir();
    let now = et_hm(2026, 11, 27, 12, 0); // due clock would have elapsed if it were a session day
    let report = run_keep(
        &client,
        &store,
        "2026-11-26",
        "SPY",
        now,
        KeepCredentialGate::Ready,
        &tmp,
    )
    .await;
    assert_eq!(report.trades, ClassVerdict::Gate(Occupancy::IneligibleHoliday));
    assert_eq!(report.quotes, ClassVerdict::Gate(Occupancy::IneligibleHoliday));
    assert_eq!(client.send_count(ExtractClass::Trades), 0);
    assert_eq!(client.send_count(ExtractClass::Quotes), 0);
    assert_ne!(report.trades, ClassVerdict::Stored(Occupancy::EmptyExtract));
    assert_ne!(occupancy_token(&Occupancy::IneligibleHoliday), "ineligible weekend");
    assert_eq!(occupancy_token(&Occupancy::IneligibleHoliday), "ineligible holiday");
}

#[test]
fn leftover_kept_on_holiday_inspects_as_ineligible_holiday() {
    let now = et_hm(2026, 11, 27, 12, 0);
    let o = classify_dated(
        "SPY",
        "2026-11-26",
        now,
        StoreLevel::Storing,
        Some(&OccupantFact::Kept { row_count: 3 }),
    );
    assert_eq!(o, Occupancy::IneligibleHoliday);
    assert_ne!(o, Occupancy::Kept { row_count: 3 });
    assert_ne!(o, Occupancy::EmptyExtract);
    assert_ne!(o, Occupancy::Miss);
    assert_ne!(o, Occupancy::IneligibleWeekend);
}
```

Keep `is_et_weekend("2026-08-10")` false.

- [ ] **Step 2: Watch fail.**

```powershell
cargo test -p api-rust --locked --lib services::flat_file_keep thanksgiving
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.**

`literals.rs`:

```rust
pub const FRAMING_HOLIDAY: &str = "RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE HOLIDAY";
pub fn ineligible_holiday(et_date: &str) -> String {
    format!("flat files ineligible holiday: {et_date}")
}
```

Re-export from `mod.rs`.

`Occupancy` — add `IneligibleHoliday`. Exhaustive matches **must compile**: `occupancy_token`, `operator_print`, `occupancy_label`, `load_envelope`, `classify_dated`, `keep.rs` `pre_get_refuse`, `cli.rs` (`inspect_exit_code`, inspect verdict, keep-process arms), `research_flat_files.rs` (wildcard `_` / `other => occupancy_token(other)` is OK for list tokens).

`classify_dated` / `pre_get_refuse` — **after** store-level, **before** due/elapsed and **before GET**:

```rust
use crate::domain::{is_et_weekend as domain_weekend, is_nyse_full_day_holiday};

fn naive(et_date: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok()
}

if naive(et_date).is_some_and(domain_weekend) {
    return Occupancy::IneligibleWeekend; // keep.rs: Some(...)
}
if naive(et_date).is_some_and(is_nyse_full_day_holiday) {
    return Occupancy::IneligibleHoliday;
}
```

Do **not** widen local `clocks::is_et_weekend` to holidays. Keep’s local `is_et_weekend` stays Sat/Sun (the 2026-08-10 test calls it).

`load_envelope` holiday arm (sibling of weekend): HTTP 200, `framing: FRAMING_HOLIDAY`, `detail: Some(ineligible_holiday(et_date))`.

`cli.rs` — treat `IneligibleHoliday` like `IneligibleWeekend` for exit 0 / `[OK]` not-miss. Print holiday detail, never `ineligible weekend` on D.

- [ ] **Step 4: Watch pass.** Re-run the **unchanged** 2026-08-10 test:

```powershell
cargo test -p api-rust --locked --lib services::flat_file_keep::keep::tests::holiday_weekday_zero_rows_is_empty_extract_not_weekend
cargo test -p api-rust --locked --lib services::flat_file_keep thanksgiving
echo $LASTEXITCODE
```

Expected: both pass. 2026-08-10 is still `EmptyExtract`.

**Reviewer probe:** `pre_get_refuse` on 2026-11-26 never constructs the files client; leftover extract is not `kept` success.

---

### B.ensure — no wake / no insert on holiday D

**Files:** `apps/api/src/services/session_chain_archive/ensure.rs`, `apps/api/src/services/session_chain_archive/ensure_worker.rs`.

**Depends on:** B.domain

- [ ] **Step 1: Failing tests.** Keep `is_et_weekday` meaning = Mon–Fri (Sat/Sun false) so `apps/api/tests/liquid_names_session_capture.rs` weekend assert stays valid. Eligibility uses session-day.

In `ensure.rs` tests:

```rust
#[test]
fn ensure_eligible_false_on_holiday_thursday() {
    let now = New_York.with_ymd_and_hms(2026, 11, 26, 10, 0).single().unwrap().with_timezone(&Utc);
    assert!(!ensure_eligible("SPY", now, true));
    assert!(is_et_weekday(now), "holiday is still a weekday; do not widen is_et_weekend");
}

#[test]
fn ensure_eligible_true_on_ordinary_monday() {
    let now = New_York.with_ymd_and_hms(2026, 8, 10, 10, 0).single().unwrap().with_timezone(&Utc);
    assert!(ensure_eligible("SPY", now, true));
}
```

In `ensure_worker.rs`, clone `worker_skips_weekend_force`:

```rust
#[tokio::test]
async fn worker_skips_holiday_force() {
    // same setup as worker_skips_weekend_force, now = Thanksgiving 2026-11-26 15:00 UTC = 10:00 ET
    let now = Utc.with_ymd_and_hms(2026, 11, 26, 15, 0, 0).unwrap();
    // force_calls == 0, unreachable!("holiday")
}
```

- [ ] **Step 2: Watch fail** — `ensure_eligible` is true on Thanksgiving because it is a weekday.

```powershell
cargo test -p api-rust --locked --lib services::session_chain_archive::ensure
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.** `ensure_eligible`:

```rust
pub fn ensure_eligible(symbol: &str, now: DateTime<Utc>, archive_enabled: bool) -> bool {
    let date = now.with_timezone(&New_York).date_naive();
    is_ensure_symbol(symbol) && crate::domain::is_et_session_day(date) && archive_enabled
}
```

Leave `is_et_weekday` as the Sat/Sun complement (do not make it return false on holidays — that would overload weekend). Worker already calls `ensure_eligible` per symbol — no extra branch needed.

- [ ] **Step 4: Watch pass.** `worker_skips_weekend_force` still 0 dials.

**Reviewer probe:** holiday Thursday `is_et_weekday` remains true; `ensure_eligible` is false; force_calls 0.

---

### B.scanner — `should_sweep_at` holiday idle like weekend

**Files:** `apps/api/src/services/scanner/loop.rs`.

**Depends on:** B.domain

- [ ] **Step 1: Failing tests** in a new `#[cfg(test)]` at the bottom of `loop.rs`. Extract `should_sweep_at` so tests are not wall-clock flakes. Do **not** turn `SCAN_MARKET_HOURS_ONLY` on for the BACKLOG-exempted always-on suite path.

```rust
#[cfg(test)]
mod holiday_sweep_tests {
    use super::*;
    use chrono::TimeZone;
    use chrono_tz::America::New_York;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn holiday_rth_clock_idles_when_gate_on() {
        let now = et_hm(2026, 11, 26, 10, 0);
        assert!(!should_sweep_at(now, true));
        assert!(should_sweep_at(now, false), "gate off still 24/7 including holidays");
    }

    #[test]
    fn weekend_parity_gate_on_off() {
        let sat = et_hm(2026, 8, 8, 12, 0);
        assert!(!should_sweep_at(sat, true));
        assert!(should_sweep_at(sat, false));
    }

    #[test]
    fn ordinary_monday_1000_sweeps_when_gate_on() {
        assert!(should_sweep_at(et_hm(2026, 8, 10, 10, 0), true));
    }
}
```

- [ ] **Step 2: Watch fail.**

```powershell
cargo test -p api-rust --locked --lib services::scanner::loop::holiday_sweep_tests
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.** Replace private `should_sweep` with:

```rust
fn should_sweep(market_hours_only: bool) -> bool {
    should_sweep_at(Utc::now(), market_hours_only)
}

pub(crate) fn should_sweep_at(now: DateTime<Utc>, market_hours_only: bool) -> bool {
    if !market_hours_only {
        return true;
    }
    use crate::domain::is_et_session_day;
    use chrono::Timelike;
    let et = now.with_timezone(&New_York);
    if !is_et_session_day(et.date_naive()) {
        return false;
    }
    let mins = et.hour() * 60 + et.minute();
    (4 * 60..20 * 60).contains(&mins)
}
```

Keep the slow-lane call `should_sweep(true)` as “is the vendor window open?” — after this change it is false on holidays, so `cfg_slow.market_hours_only && !hours_open && !need_catchup` idles. Gate-off (`market_hours_only == false`) still does not idle. Do **not** stop the fast lane (heartbeat must continue). Do not add a holiday lookup-failure idle.

Need `use chrono::{DateTime, Utc};` and `chrono_tz::America::New_York` at the `should_sweep_at` site (the live `should_sweep` already imports them inside the function — lift or duplicate cleanly).

- [ ] **Step 4: Watch pass.**

**Reviewer probe:** gate-off Thanksgiving still `true`; fast-lane heartbeat write in `apply_fast_tick` is untouched.

---

### B.closer — serve + conformance receipt only

**Files:** `.spire/clusters/tech/contracts/exchange-holiday-calendar/conformance-receipt.json` (write). Does **not** re-implement worker paths.

**Depends on:** B.domain, B.classify, B.stream, B.coverage, B.tape, B.keep, B.ensure, B.scanner

- [ ] **Step 1: Full backend gate**

```powershell
cargo test -p api-rust --locked
echo $LASTEXITCODE
cargo test -p quant-engine --locked
echo $LASTEXITCODE
```

Expected: both `0`. Named holiday tests green. 2026-08-10 keep EmptyExtract still green.

- [ ] **Step 2: Empty engine diff**

```powershell
git diff --name-only -- libs/quant-engine
```

Expected: empty. If this working tree already had unrelated quant-engine dirt from another session, do **not** revert it; only assert this lane added nothing (no `nyse` / `holiday` hits under `libs/quant-engine`).

- [ ] **Step 3: Serve + live G1 (types/presence).** Do **not** pass `--auth-cookie` / `--auth-signup`. Do **not** fetch SSE as JSON.

```powershell
npm run ports:free
npx nx serve api
```

In another shell, `METRICS_SECRET_TOKEN` **unset**:

```powershell
node .grok/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/exchange-holiday-calendar/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/exchange-holiday-calendar/conformance-receipt.json
echo $LASTEXITCODE
```

Expected: exit `0`, `verdict: "PASS"`. Coverage GET shape (including `et_date=2026-11-26` **types/presence**) + 422 `not-a-date` + session-books list. Exact holiday `framing`/`verdict` **values** on 2026-11-26 are GATE Q hermetic (already asserted in B.coverage). Live archive must be **storing**; disabled store is 500 not-storing — do not treat as miss.

- [ ] **Step 4:** Confirm `functions/api/[[path]].ts` was **not** edited. Confirm no new route `holidays` in `apps/api/src/routes/`. Skip git commit.

**Reviewer probe:** receipt exists; SSE was not hung; `"auth": true` absent; closer diff is the receipt only.

---

## Frontend track

SPEC §4 names components, not files → every FE row is `Independent: no`. One worker, sequential.

### F.replica — scanner badge replica + `marketSessionPhase`

**Files:**
- `apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.ts` (new)
- `apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.spec.ts` (new)
- `apps/dashboard/src/app/pages/scanner/format.ts`
- `apps/dashboard/src/app/pages/scanner/format.spec.ts`

**Depends on:** —

- [ ] **Step 1: Failing tests** in `format.spec.ts` (extend the existing `marketSessionPhase` describe) and a new replica spec.

```ts
it('Thanksgiving 2026-11-26 10:00 ET is Closed, not RTH', () => {
  // EST (DST already ended): 10:00 ET = 15:00 UTC
  expect(marketSessionPhase(Date.UTC(2026, 10, 26, 15, 0, 0))).toBe('closed');
  expect(sessionBadge(Date.UTC(2026, 10, 26, 15, 0, 0)).label).toBe(SESSION_LABEL.closed);
});

it('holiday pre and after clocks are Closed (S2 pin, not a new AC)', () => {
  expect(marketSessionPhase(Date.UTC(2026, 10, 26, 13, 0, 0))).toBe('closed'); // 08:00 ET
  expect(marketSessionPhase(Date.UTC(2026, 10, 26, 22, 0, 0))).toBe('closed'); // 17:00 ET
});

it('ordinary Monday 10:00 ET remains RTH', () => {
  expect(marketSessionPhase(Date.UTC(2026, 7, 10, 14, 0, 0))).toBe('rth');
});

it('Saturday remains Closed', () => {
  expect(marketSessionPhase(Date.UTC(2026, 7, 8, 15, 0, 0))).toBe('closed');
});
```

Replica spec (`nyseFullDayHolidays.spec.ts`): implement a **test-only** generator that matches B.domain (nth-weekday, observed-shift Sat→Fri / Sun→Mon, Good Friday via the same Anonymous Gregorian integers, Juneteenth `year >= 2022`, keep years `2020..=2032`). Assert:

```ts
expect(sorted(NYSE_FULL_DAY_HOLIDAYS)).toEqual(sorted(generatedRegularNyseFullDays()));
expect(NYSE_FULL_DAY_HOLIDAYS.size).toBeGreaterThan(0);
expect(isNyseFullDayHolidayIso('2026-11-26')).toBe(true);
expect(isNyseFullDayHolidayIso('2026-08-10')).toBe(false);
expect(isNyseFullDayHolidayIso('2026-10-12')).toBe(false);
expect(isNyseFullDayHolidayIso('2026-11-11')).toBe(false);
expect(isNyseFullDayHolidayIso('2026-11-27')).toBe(false); // early close
expect(isNyseFullDayHolidayIso('2022-06-20')).toBe(true);
expect(isNyseFullDayHolidayIso('2021-06-18')).toBe(false);
expect(isNyseFullDayHolidayIso('2020-06-19')).toBe(false);
expect(isNyseFullDayHolidayIso('2019-11-28')).toBe(false);
```

A hand-pasted Set that drifts from the generator goes red. Do **not** fetch `/api/holidays`.

- [ ] **Step 2: Watch fail.**

```powershell
npx nx test @convexa/dashboard -- src/app/pages/scanner/format.spec.ts src/app/pages/scanner/nyseFullDayHolidays.spec.ts
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.**

`nyseFullDayHolidays.ts` — committed replica used **only** by `marketSessionPhase`:

```ts
/** Generated/pin-tested replica of `apps/api/src/domain/nyse_full_day.rs`. Scanner badge only. */
export const NYSE_FULL_DAY_HOLIDAYS: ReadonlySet<string> = new Set([
  /* paste ISO dates equal to Rust `nyse_full_day_iso_dates()` — equality test is the gate */
]);

export function isNyseFullDayHolidayIso(iso: string): boolean {
  return NYSE_FULL_DAY_HOLIDAYS.has(iso);
}
```

Fill the Set from the test-only generator (same rules as Rust). Runtime lookup is `Set.has`, not the generator.

`format.ts` `marketSessionPhase` — after Sat/Sun, before hour buckets, classify the ET civil date:

```ts
import { isNyseFullDayHolidayIso } from './nyseFullDayHolidays';

export function marketSessionPhase(nowMs: number): MarketSessionPhase {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekday = pick('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  const iso = `${pick('year')}-${pick('month')}-${pick('day')}`;
  if (isNyseFullDayHolidayIso(iso)) return 'closed';
  // existing hour buckets unchanged
}
```

`sessionBadge` already maps `SESSION_LABEL.closed` → `Closed`. `aria-label={SCAN_COPY.sessionAria}` (`US equity session`) stays. No fifth label `Holiday`.

- [ ] **Step 4: Watch pass.** Existing RTH/pre/after/closed weekday+weekend cases in `format.spec.ts` stay green.

**Reviewer probe:** replica pin-equality vs generator is non-vacuous (`size > 0`); Columbus/early-close/Juneteenth-2021 out.

---

### F.ticker — `liveStatus` closed wins over live; lag tip drops holiday

**Files:**
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx`
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.liveStatus.spec.ts` (new)

**Depends on:** F.replica

- [ ] **Step 1: Failing tests.** Build a minimal `LiveUpdate` (only fields `liveStatus` reads: `live`, `market_session`, `mid`, `feed`):

```ts
import { liveStatus } from './TickerHeader';

const base = { mid: 400, feed: 'massive' as const };

it('closed wins over live.live — never ● live · closed', () => {
  const s = liveStatus({
    ...base,
    live: true,
    market_session: 'closed',
  } as never);
  expect(s?.label).toMatch(/^○ market closed/);
  expect(s?.label).not.toContain('● live');
  expect(s?.tip).toBe(
    'Market is closed (weekend/holiday). Showing the last completed session.',
  );
});

it('lag tip has no holiday substring and is the replacement sentence', () => {
  const s = liveStatus({
    ...base,
    live: false,
    market_session: 'regular',
  } as never);
  expect(s?.label).toMatch(/^○ no live ticks/);
  expect(s?.tip).toBe(
    'In a covered session but no ticks are arriving — the feed may be lagging.',
  );
  expect(s?.tip.toLowerCase()).not.toContain('holiday');
});

it('holiday closed does not take the lag branch even when live is false', () => {
  const s = liveStatus({
    ...base,
    live: false,
    market_session: 'closed',
  } as never);
  expect(s?.label).toMatch(/^○ market closed/);
  expect(s?.tip.toLowerCase()).not.toContain('lagging');
});
```

If `as never` fails the `LiveUpdate` type, construct a full object from `libs/api` type with dummy numbers (`ticker: 'SPY'`, zeros for volumes, `ts: 0`, etc.). Prefer a typed helper over `never`.

Also assert `connectionChip(..., reduced: false)` for `{ live: true, market_session: 'closed' }` has `pulse: false` (live-dot must not pulse on holiday closed). Import `connectionChip` from the same file.

- [ ] **Step 2: Watch fail** — current order returns `● live · closed`.

```powershell
npx nx test @convexa/dashboard -- src/app/pages/ticker/widgets/chrome/TickerHeader.liveStatus.spec.ts
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.** Reorder `liveStatus`:

```ts
export function liveStatus(live: LiveUpdate | null): ... {
  if (!live) return null;
  const last = live.mid != null ? ` · mid $${live.mid.toFixed(2)}` : '';
  if (live.market_session === 'closed') {
    return {
      color: 'default',
      label: `○ market closed${last}`,
      tip: 'Market is closed (weekend/holiday). Showing the last completed session.',
    };
  }
  if (live.live) {
    // existing live short-circuit — market_session is not 'closed' here
  }
  if (live.market_session === 'overnight') { /* unchanged */ }
  return {
    color: 'warning',
    label: `○ no live ticks${last}`,
    tip: 'In a covered session but no ticks are arriving — the feed may be lagging.',
  };
}
```

Do **not** write `live: false` anywhere. Closed tooltip stays the weekend/holiday sentence (AC-29 review copy — do not upgrade to a holiday **name**). Pulse stays `dot === '●' && tone === 'info'` — closed is `○` + `default`, so it will not pulse.

- [ ] **Step 4: Watch pass.** Existing CommandDeck session-tape tests still green.

**Reviewer probe:** `live: true` + `closed` cannot produce `● live · closed`; lag tip byte-equals the replacement sentence.

---

### F.card — coverage empty-expected chrome (footgun fix)

**Files:**
- `apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.tsx`
- `apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.states.spec.tsx`
- `apps/dashboard/src/app/pages/operator-session-archive/copy.ts` (optional rename only)

**Depends on:** F.ticker

- [ ] **Step 1: Failing tests** in `OperatorSessionArchive.states.spec.tsx`. Reuse `unlockUsable` / `wrap` / `listHit`.

```ts
const NO_EXPECTED = 'RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES';
const ORDINARY = 'RESEARCH READ — SESSION ARCHIVE COVERAGE';

const coverageHoliday = jsonResult(200, {
  framing: NO_EXPECTED,
  command: 'archive-coverage',
  evidence: 'this process',
  symbols: ['SPY', 'QQQ', 'IWM'],
  et_date: '2026-11-26',
  checkpoint: 'after 16:00 America/New_York',
  vendor_called: false,
  authorizes: 'nothing',
  license: 'Our research · not redistributed on a trader route.',
  verdict: 'not_due',
  expected_due: 0,
  present: 0,
  missing: 0,
  unreadable: 0,
  not_yet_due: 0,
  blocked_occupancy: 0,
  rows: [],
  holes: [],
});

const coverageNotYetDue = jsonResult(200, {
  framing: ORDINARY,
  command: 'archive-coverage',
  evidence: 'this process',
  symbols: ['SPY', 'QQQ', 'IWM'],
  et_date: '2099-01-05',
  checkpoint: 'after 16:00 America/New_York',
  vendor_called: false,
  authorizes: 'nothing',
  license: 'Our research · not redistributed on a trader route.',
  verdict: 'not_due',
  expected_due: 0,
  present: 0,
  missing: 0,
  unreadable: 0,
  not_yet_due: 3,
  blocked_occupancy: 0,
  rows: [
    { symbol: 'SPY', et_date: '2099-01-05', cell: 'not yet due', last_readable: 'none (seed fixture excluded)' },
    { symbol: 'QQQ', et_date: '2099-01-05', cell: 'not yet due', last_readable: 'none (seed fixture excluded)' },
    { symbol: 'IWM', et_date: '2099-01-05', cell: 'not yet due', last_readable: 'none (seed fixture excluded)' },
  ],
  holes: [],
});

it('holiday empty-expected: no-expected framing, zero counts, no rows, no verdict token, no weekend word', async () => {
  const user = userEvent.setup();
  const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
    if (tail.includes('coverage')) return coverageHoliday;
    return listHit;
  });
  wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
  await unlockUsable(fetchImpl, user);
  const card = await screen.findByTestId('osa-coverage');
  expect(card).toHaveTextContent(NO_EXPECTED);
  expect(card).toHaveTextContent('Expected due: 0 · present: 0 · missing: 0 · unreadable: 0 · not yet due: 0 · blocked occupancy: 0');
  expect(screen.queryByTestId('osa-coverage-rows')).not.toBeInTheDocument();
  expect(card.textContent).not.toMatch(/\bpass\b/i);
  expect(card.textContent).not.toMatch(/\bfail\b/i);
  expect(card.textContent).not.toMatch(/not_due/);
  expect(card.textContent).not.toMatch(/\[PASS\]/);
  expect(card.textContent?.toLowerCase()).not.toContain('weekend');
  expect(card.textContent).not.toMatch(/Thanksgiving/i);
  expect(card).toHaveTextContent(COPY.coverageClosing);
});

it('not-yet-due session weekday is ordinary framing + rows + verdict (footgun pin)', async () => {
  const user = userEvent.setup();
  const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
    if (tail.includes('coverage')) return coverageNotYetDue;
    return listHit;
  });
  wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
  await unlockUsable(fetchImpl, user);
  const card = await screen.findByTestId('osa-coverage');
  expect(card).toHaveTextContent(ORDINARY);
  expect(card.textContent).not.toContain('NO EXPECTED IDENTITIES');
  expect(screen.getByTestId('osa-coverage-rows')).toBeInTheDocument();
  expect(card).toHaveTextContent('not_due');
  expect(card).toHaveTextContent('not yet due');
});
```

- [ ] **Step 2: Watch fail** — today’s `verdict === 'not_due'` hides rows on the not-yet-due plant and ignores `m.framing`.

```powershell
npx nx test @convexa/dashboard -- src/app/pages/operator-session-archive/OperatorSessionArchive.states.spec.tsx
echo $LASTEXITCODE
```

- [ ] **Step 3: Implement.** Replace the footgun:

```ts
const NO_EXPECTED = 'RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES';
const emptyExpected =
  m.framing === NO_EXPECTED && m.rows.length === 0 && m.holes.length === 0;
```

- Framing: always `m.framing || COPY.coverageFraming` (payload wins). Do **not** substitute COPY when `verdict === 'not_due'`.
- Hide verdict token **and** row stack only when `emptyExpected`.
- Counts line always renders (zeros are correct on holiday).
- Closing always `COPY.coverageClosing`.
- Last-readable / holes maps are no-ops when arrays are empty.

Optional: rename `COPY.coverageFramingWeekend` → `coverageFramingNoExpected` (same string). Not required if unused.

- [ ] **Step 4: Watch pass.** Existing coverage-unavailable / not-storing tests still green.

**Reviewer probe:** a `not_due` envelope with ordinary framing and rows cannot be painted as no-expected.

---

### F.isolation — no new surfaces; Pages 404; `/lab`; TopNav; no `/api/holidays`

**Files:** `apps/dashboard/src/app/exchange-holiday-calendar.structural.spec.ts` (new)

**Depends on:** F.card

- [ ] **Step 1: Failing structural spec** (clone the glob style of `research-lab-surface.structural.spec.ts`):

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PAGES_FN = 'functions/api/[[path]].ts';

describe('exchange-holiday-calendar structural', () => {
  it('Pages Function 404 for /api/_research unchanged', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(src).toMatch(/pathname\s*===\s*['"]\/api\/_research['"]/);
    expect(src).toMatch(/pathname\.startsWith\(\s*['"]\/api\/_research\/['"]\s*\)/);
  });

  it('no GET /api/holidays product path in dashboard src', () => {
    const keys = Object.keys(import.meta.glob('../**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>);
    // Use the same DASHBOARD_SOURCES pattern the sibling structural specs already use if glob-from-here is awkward — copy their import.
  });
});
```

Prefer copying the live `DASHBOARD_SOURCES` import from `apps/dashboard/src/app/research-lab-surface.structural.spec.ts` rather than inventing a new glob. Assertions:

- `functions/api/[[path]].ts` still 404s `/api/_research` and `/api/_research/*`.
- Trader `TopNav.tsx` has no `to:` for `/_ops/research`, `/_ops/metrics`, holidays, coverage, tape, keep.
- `app.tsx` still mounts `/lab` → `LabIndex`; `LabIndex.tsx` still `data-testid="lab-index"`.
- No product string `'/api/holidays'` in dashboard `src/app` (allowlist the structural spec itself if it mentions the needle).
- Replica module is imported from `pages/scanner/format.ts` and **not** from `TickerHeader.tsx` (ticker binds SSE).

Worker-down ≠ holiday idle: add in `format.spec.ts` (or this file) that `sweepBanner({ updated_at: nowS - 30, sweep_last_completed: nowS - 120, universe_size: 2 }, nowS)` is `{ engaged: false }` — a fresh heartbeat (fast lane) does not engage `scan-worker-down`. Existing `scanner.risk.spec.tsx` already covers the engaged banner; do not weaken it.

- [ ] **Step 2: Watch fail** if the spec file’s imports are wrong; then it should pass on Pages/TopNav/`/lab` (already shipped) and fail only if you assert a replica import that is not wired — after F.replica it should be wired.

- [ ] **Step 3: Implement the spec only.** Do **not** edit Pages Function, TopNav, or `/lab`.

- [ ] **Step 4: Watch pass.**

```powershell
npx nx test @convexa/dashboard -- src/app/exchange-holiday-calendar.structural.spec.ts
echo $LASTEXITCODE
```

**Reviewer probe:** poison a `to: '/_ops/research'` in TopNav → red; poison `'/api/holidays'` in `convexa.ts` → red.

---

### F.closer — leftover visual / serve states

**Files:** leftover tests under scanner / ticker chrome / operator-session-archive only. Does **not** re-implement worker paths. Does **not** write `conformance-receipt.json`.

**Depends on:** F.replica, F.ticker, F.card, F.isolation

- [ ] **Step 1:** Confirm no `$398`, no `[PASS]` on the holiday card, no success-green on `not_due` / `Closed`, no new `@keyframes`, no hardcoded hex, no new trader route. Closed chip stays `color: 'default'`. Lag remains `warning` + icon. IBM Plex Mono still on occupancy tokens / `et_date` / counts / `verdict`.

- [ ] **Step 2: Serve dashboard** (optional visual check; do not claim hosted NYSE certification):

```powershell
npm run ports:free
npx nx serve @convexa/dashboard
```

Expected: :4200. `/scanner` badge is clock-derived. `/_ops/research` still off-shell. `/lab` still demos.

- [ ] **Step 3: Full frontend gate**

```powershell
npx nx test @convexa/dashboard
echo $LASTEXITCODE
npx nx typecheck @convexa/dashboard
echo $LASTEXITCODE
```

Expected: both `0`. If phantom `dist` errors appear, delete `apps/dashboard/dist` / `out-tsc` / `*.tsbuildinfo` and rebuild `tsconfig.app.json` before `tsconfig.spec.json`.

- [ ] **Step 4:** Scoped format if you touch TS (never bare `nx format:write`). **Skip git commit.**

**Reviewer probe:** `TickerHeader.tsx` does not import `nyseFullDayHolidays`; typecheck 0.

---

## Independence

SPEC §4 does not name files, so no frontend row is `Independent: yes`. Backend `yes` rows have disjoint write paths (prefix rule). B.domain is the foundation; workers `Depends on` it. One closer per lane.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B.domain | backend | apps/api/src/domain/nyse_full_day.rs; apps/api/src/domain/mod.rs | — | yes |
| B.classify | backend | apps/api/src/domain/market.rs | B.domain | yes |
| B.stream | backend | apps/api/src/routes/stream.rs | B.domain | yes |
| B.coverage | backend | apps/api/src/services/session_chain_archive/coverage.rs; apps/api/src/routes/research_session_coverage.rs | B.domain | yes |
| B.tape | backend | apps/api/src/services/day_tape/literals.rs; apps/api/src/services/day_tape/clocks.rs; apps/api/src/services/day_tape/occupancy.rs; apps/api/src/services/day_tape/construct.rs; apps/api/src/services/day_tape/cli.rs; apps/api/src/services/day_tape/mod.rs; apps/api/src/routes/research_session_day_tape.rs | B.domain | yes |
| B.keep | backend | apps/api/src/services/flat_file_keep/literals.rs; apps/api/src/services/flat_file_keep/clocks.rs; apps/api/src/services/flat_file_keep/occupancy.rs; apps/api/src/services/flat_file_keep/keep.rs; apps/api/src/services/flat_file_keep/cli.rs; apps/api/src/services/flat_file_keep/mod.rs; apps/api/src/routes/research_flat_files.rs | B.domain | yes |
| B.ensure | backend | apps/api/src/services/session_chain_archive/ensure.rs; apps/api/src/services/session_chain_archive/ensure_worker.rs | B.domain | yes |
| B.scanner | backend | apps/api/src/services/scanner/loop.rs | B.domain | yes |
| B.closer | backend | .spire/clusters/tech/contracts/exchange-holiday-calendar/conformance-receipt.json | B.domain, B.classify, B.stream, B.coverage, B.tape, B.keep, B.ensure, B.scanner | no |
| F.replica | frontend | apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.ts; apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.spec.ts; apps/dashboard/src/app/pages/scanner/format.ts; apps/dashboard/src/app/pages/scanner/format.spec.ts | — | no |
| F.ticker | frontend | apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx; apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.liveStatus.spec.ts | F.replica | no |
| F.card | frontend | apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.tsx; apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.states.spec.tsx; apps/dashboard/src/app/pages/operator-session-archive/copy.ts | F.ticker | no |
| F.isolation | frontend | apps/dashboard/src/app/exchange-holiday-calendar.structural.spec.ts | F.card | no |
| F.closer | frontend | apps/dashboard/src/app/pages/scanner/format.spec.ts | F.replica, F.ticker, F.card, F.isolation | no |

---

## Verification track

Run after both closers. Exact commands; check `$LASTEXITCODE`.

### V1 — Backend unit / hermetic (AC-1–27 rejecting + accepting holiday weekday)

```powershell
cargo test -p api-rust --locked
echo $LASTEXITCODE
```

Expected: exit `0`. Must include (names as landed): domain pins + Juneteenth in/out + early-close `2026-11-27` + poison holiday-as-weekend + empty-table anti-vacuity + generator equality; coverage empty-expected on `2026-11-26` (today-before-checkpoint, leftover not present, CLI no `Expected due:`); weekend `2026-08-08` unchanged; ordinary `2026-08-10` due; tape/keep sibling literals; keep 2026-08-10 EmptyExtract **and** 2026-11-26 files-call 0; ensure dial 0; both classifiers ClosedPre/`closed` at 10:00/17:00/21:00 ET on D; `should_sweep_at` gate-on idle / gate-off parity; unparseable 422; `COVERAGE_VENDOR_CALLS` 0.

### V2 — Quant-engine isolation

```powershell
cargo test -p quant-engine --locked
echo $LASTEXITCODE
git diff --name-only -- libs/quant-engine
```

Expected: tests `0`; this lane added no files under `libs/quant-engine`. Score/tier/fingerprint stay byte-identical for the **same** inputs **including phase**. Do not require a holiday weekday’s output to equal a session weekday’s output when standing is correctly closed vs RTH.

### V3 — Dashboard unit + typecheck

```powershell
npx nx test @convexa/dashboard
echo $LASTEXITCODE
npx nx typecheck @convexa/dashboard
echo $LASTEXITCODE
```

Expected: both `0`. Includes replica pin-equality, `marketSessionPhase` Closed vs RTH, `liveStatus` closed-over-live, lag tip without `holiday`, coverage card holiday empty-expected **and** not-yet-due footgun plant, structural Pages/TopNav/`/lab`/no `/api/holidays`.

### V4 — Replica pin-equality vs Rust set (drift → red)

```powershell
python -c "
import re, pathlib
rs = pathlib.Path('apps/api/src/domain/nyse_full_day.rs').read_text(encoding='utf-8')
ts = pathlib.Path('apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.ts').read_text(encoding='utf-8')
# triples in the const table
block = rs.split('NYSE_FULL_DAY')[1].split(';')[0]
rt = re.findall(r'\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)', block)
iso_r = sorted(f'{int(y):04d}-{int(m):02d}-{int(d):02d}' for y,m,d in rt)
iso_t = sorted(re.findall(r\"'(\d{4}-\d{2}-\d{2})'\", ts))
assert iso_r, 'empty rust table'
assert iso_r == iso_t, (set(iso_r)^set(iso_t), len(iso_r), len(iso_t))
print('replica-pin', len(iso_r), 'dates')
"
echo $LASTEXITCODE
```

Expected: prints `replica-pin N dates` with `N > 0`, exit `0`. A hand-pasted FE list that dropped Juneteenth-2022 or added 2021-06-18 goes red.

### V5 — Live interface re-pin (G1 types/presence)

```powershell
npm run ports:free
npx nx serve api
```

```powershell
node .grok/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/exchange-holiday-calendar/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/exchange-holiday-calendar/conformance-receipt.json
echo $LASTEXITCODE
```

Expected: `verdict: "PASS"`, exit `0`. Do **not** `--auth-cookie`. Do **not** hang `GET /api/stream/{ticker}` as JSON. Exact `framing`/`verdict` on `et_date=2026-11-26` is V1 hermetic, not this live wall-clock.

### V6 — Pages 404 + no new HTTP family

```powershell
git diff --name-only -- "functions/api/[[path]].ts"
rg -n "api/holidays" apps/api/src apps/dashboard/src --glob "!*.structural.spec.ts"
```

Expected: Pages file unedited (empty diff from this lane). No product `api/holidays` path.

### V7 — GATE Q operator/desk walk (injected clock; local evidence)

Prefer **one** hermetic pass covering AC-1–27 (already V1+V3) plus:

- Coverage HTTP/UI on D: no-expected framing, zeros, no rows, no verdict token, no word `weekend`, `Evidence: this process`, `Authorizes: nothing`.
- Not-yet-due session weekday card still shows ordinary framing + rows (footgun).
- Tape/keep CLI/HTTP sibling literals on D; Saturday still weekend literals.
- Ticker: `liveStatus({ live: true, market_session: 'closed' })` is `○ market closed`; lag tip has no `holiday`.
- Scanner badge Closed at 10:00 ET on D; RTH on 2026-08-10; `aria` `US equity session`.
- `/lab` still `lab-index`. TopNav silent. `/_ops/research` still off-shell.

Local proofs are **local**, not hosted NYSE certification.

### V8 — Desk intact

With holiday clocks honest, `/ticker/SPY` still loads and SSE still attaches (existing ticker tests green in V3). Scanner last-known rows remain under idle (heartbeat fresh → no `scan-worker-down`). Do not POST recommendation. Do not retune `opportunity_score`.

---

## Reviewer probes (per-task summary)

| Task | Probe |
|---|---|
| B.domain | Juneteenth 2021/2020 out; 2022-06-20 in; 2026-11-27 out; empty table red; holiday-as-weekend red |
| B.classify | Thanksgiving 17:00 `ClosedPre`; 2026-08-10 10:00 `Rth` |
| B.stream | Thanksgiving 21:00 `"closed"`; Sunday 21:00 `"overnight"`; `live` untouched |
| B.coverage | CLI no `Expected due:` on D; HTTP no `weekend` key; leftover not `present` |
| B.tape | `AxisA::IneligibleHoliday` exhaustive; Path-A noon ET closed on D |
| B.keep | 2026-08-10 EmptyExtract unchanged; 2026-11-26 files-call 0 |
| B.ensure | `is_et_weekday` still true on D; `ensure_eligible` false; dials 0 |
| B.scanner | `should_sweep_at` gate-off true on D; fast heartbeat untouched |
| B.closer | receipt PASS; no SSE hang |
| F.replica | generator pin; pre/after on D are `closed` |
| F.ticker | no `● live · closed`; lag tip exact replacement |
| F.card | 2099-01-05 shows rows + verdict |
| F.isolation | Pages 404 byte-stable; no `/api/holidays` |
| F.closer | typecheck 0 |

If an implementer finds this plan contradicting the tree, **report the conflict** — do not silently “fix” the spec.
