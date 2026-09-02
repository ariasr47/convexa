# R1 — architect position: exchange-holiday-calendar

## Position

NYSE **full-day** closures are a **session-day clock**, not a vendor fetch, not a score input, and not a new corpus. Weekend ineligibility already exists as six independent Sat/Sun predicates. This slice adds one in-process holiday predicate those clocks consume so a closed weekday is the same **due-ness class** as Sat/Sun (not due / not eligible / not RTH) without collapsing the **reason** into “weekend.”

There is **no** holiday table in-tree today. Verified live (not briefing HTML, not archived Python):

- `apps/api/Cargo.toml` has `chrono` + `chrono-tz`; **no** holiday/exchange-calendar crate.
- `MarketPhase::classify` (`apps/api/src/domain/market.rs`) returns `ClosedPre` only when `et.weekday().num_days_from_monday() >= 5`. Comment already says “weekend / holiday”; the body does not. Monday 2026-08-10 14:00 UTC (10:00 ET) is tested as `Rth`. A holiday Thursday at 10:00 ET is therefore `Rth` today.
- Coverage `is_et_date_weekday` (`session_chain_archive/coverage.rs`) is Sat/Sun only. Non-weekday short-circuits to `CoverageMatrix { due: false, weekend: true, rows: [], holes: [] }` → `http_verdict() == "not_due"`, `expected_due() == 0`, CLI `[NOT DUE]` not `[PASS]`. `IdentityStatus::IneligibleWeekend` exists but is matrix-level; weekday holidays fall through to `missing` / `present` cells.
- Ensure `is_et_weekday` (`ensure.rs`) is the same weekday rule; `ensure_eligible` = trio ∩ weekday ∩ archive-enabled. `ensure_worker.rs` `worker_skips_weekend_force` proves a Saturday force-pass dials 0.
- Tape `day_tape/clocks.rs`: `is_et_date_weekday`, `in_path_a_append_window`, `path_b_mark_for` all gate on weekday ≥ 5. Header: “Local copies — do not import ensure.rs / coverage.rs.” Occupancy `AxisA::IneligibleWeekend` (`occupancy.rs`); construct/CLI refuse with `literals::ineligible_weekend`.
- Keep `flat_file_keep/clocks.rs` `is_et_weekend` is Sat/Sun only; keep gate + `classify_dated` return `Occupancy::IneligibleWeekend` before GET. Test `holiday_weekday_zero_rows_is_empty_extract_not_weekend` uses `D = "2026-08-10"` (Monday) and asserts zero-row gzip → `EmptyExtract`, `!is_et_weekend(D)`, not `IneligibleWeekend`, not `Miss`. That test documents the hole: without a calendar, a **holiday** weekday with zero rows is a content-hit empty extract.
- Scanner slow lane (`scanner/loop.rs` `should_sweep`): weekday 04:00–20:00 ET via `num_days_from_monday() >= 5`; `SCAN_MARKET_HOURS_ONLY` defaults ON (`config.rs`). Fast lane stays always-on (heartbeat). BACKLOG `scanner-market-hours-gate`: “Holidays are NOT covered.”
- A **second** session classifier lives in `routes/stream.rs` `market_session_at`: weekend → `"closed"` (late Sunday ≥ 20:00 → `"overnight"`); weekday 09:30–16:00 → `"regular"`. Ticker chrome already mentions holiday in copy while this function cannot know one (`TickerHeader.tsx` binds `live.market_session === 'closed'` vs the no-ticks fallback). GEX spot selection (`infrastructure/massive/market_phase.rs` `resolve_gex_spot`) already handles `ClosedPre` → prior close; it is not a third calendar.
- OPEN_THREADS 7as–7av all leave “No NYSE holiday calendar”; 7av names the keep zero-row weekday as empty extract.

### Council locks (technical pick, axes named)

**1. One domain module. Not per-leaf holiday copies. Not a crate.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Shared `apps/api/src/domain/` module; leaves import predicates only | one table + thin adapters | one maint surface | O(log n) lookup | `domain/market.rs` is already the shared phase type |
| B. Paste holiday dates into each `clocks.rs` / `should_sweep` / `classify` | six copies | drift is the BRIEF failure | n/a | matches today’s “local copies” comments |
| C. crates.io exchange calendar | new dep + API | supply-chain + review | n/a | **zero** in `Cargo.toml`; OPEN_THREADS still carries `supply-chain-automation` GATE Q FAIL |

Pick **A**. Decisive axes: **drift prevention + supply-chain + BRIEF** (“council names the module boundary vs continuing per-leaf copies”).

Mechanism: new vendor-free module next to `domain/market.rs` (re-exported from `domain/mod.rs`). It owns the closed date set and three predicates:

- `is_et_weekend(date)` — **Sat/Sun only** (`num_days_from_monday() >= 5`). Do **not** widen this to holidays.
- `is_nyse_full_day_holiday(date)` — membership in the compiled full-day set.
- `is_et_session_day(date)` — weekday ∧ ¬ full-day holiday.

Parse helpers (`parse_et_date`, `today_et_date`) stay local in tape/keep/coverage; those files already duplicate them to avoid importing ensure/coverage. They **may** import `crate::domain` (tape already imports `StreamEvent`). They **must not** import each other.

`quant-engine` does not import the calendar. Enforcement: empty `libs/quant-engine` diff. Score / tier / fingerprint stay byte-identical because no path from this module into `generate_signals`.

**2. Compile-time closed date table. Not a vendor MIC fetch. Not runtime JSON that can fail open.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Sorted `&'static [(y,m,d)]` + binary search; `#[cfg(test)]` generator asserts set equality for the spanned years | table + test computus | periodic date maint | ~10 dates/year | const watchlists (`ENSURE_SYMBOLS`) |
| B. Runtime recurrence (nth Monday, observed-shift, Easter/Good Friday) as the production path | Easter + observed rules on every call | write-once | O(1) | **none** in-repo; a rule bug fabricates open/closed |
| C. Hot-loaded JSON beside `universe.json` | parse + I/O | operator-editable | fail-open if missing | earnings `events.json` was this shape (Python-era, not this clock) |

Pick **A**. Decisive axes: **fail-closed + complexity**. Occupancy classification is not `[best-effort-isolated-or-null]`: a missing calendar that “degrades” to weekday **fabricates due-ness** (`absent-is-not-none`). Mechanism: dates are integer triples in the binary; lookup cannot return `Err` and cannot panic on serve. Invalid operator `et_date` strings stay at the existing parse (`None` / coverage `UnparseableDate`). No Massive/HTTP calendar; `COVERAGE_VENDOR_CALLS` stays 0.

Test-time generator (nth-weekday, weekend observed-shift, Good Friday via Gregorian computus) **does not run in production**. It asserts the static table **equals** the generated regular-NYSE full-day set for every year in the span, **and** independent fixture pins cannot be satisfied by an empty table (anti-vacuity: table length > 0).

**Span (attackable):** inclusive calendar years **2020..=2032** (covers archive seed era `SPY 2020-01-02` and near future). Outside the span, `is_nyse_full_day_holiday` is **false** (not “unknown occupancy”). Named residual under Risks. An empty `UNSCHEDULED_FULL_DAY` overlay in the same module is the attach point for one-off closures (weather, mourning) without a second module; v1 may be empty.

**Regular NYSE full-day set (content, not wire):** New Year’s Day, MLK Jr. Day, Washington’s Birthday, Good Friday, Memorial Day, Juneteenth National Independence Day, Independence Day, Labor Day, Thanksgiving Day, Christmas Day — each with NYSE weekend **observed-shift** (Saturday → prior Friday; Sunday → next Monday). **Not** Columbus Day, **not** Veterans Day, **not** Election Day. Federal holiday ≠ NYSE full-day holiday.

**Fixture pins the build must go red without** (America/New_York calendar dates; 2026 because live tests already pin that year):

- In: `2026-01-01` New Year’s, `2026-04-03` Good Friday, `2026-07-03` Independence **observed** (July 4 is Saturday), `2026-11-26` Thanksgiving, `2026-12-25` Christmas.
- Out (session days): `2026-08-10` (keep `D`, Monday), `2026-10-12` Columbus Day (NYSE open), `2026-11-11` Veterans Day (NYSE open).
- Unchanged weekend: `2026-08-08` Saturday, `2026-08-15` Saturday — still `is_et_weekend`, still not a holiday membership.

Poison the forbidden collapse: `assert!(is_nyse_full_day_holiday(thanksgiving) && !is_et_weekend(thanksgiving))`. If someone implements holiday as `is_et_weekend`, both the in-set pin and this split go red. If someone marks Columbus Day closed, the out-set pin goes red.

**3. Distinct ineligible reason. Same due-ness as weekend. Do not overload `is_et_weekend` or `CoverageMatrix.weekend`.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Sibling occupancy / identity arm (holiday) next to existing weekend arm; shared `is_et_session_day` for due-ness | one arm per exhaustive match | copy is UX; types are this lane | n/a | existing `IneligibleWeekend` / `AxisA::IneligibleWeekend` |
| B. Set `weekend: true` / reuse `IneligibleWeekend` for Thanksgiving | zero new arms | **type-level lie** | n/a | false: keep/tape framing literals say “weekend” |
| C. New due-ness class (holiday is `missing` with a note, or a `[PASS]` with zero expected) | fights shipped coverage | operator mistrust | n/a | contradicts BRIEF |

Pick **A**. Decisive axis: **`[absent-is-not-none]`**. BRIEF wants weekend-**class empty expected** (`not_due`, not three `missing` cells, not `[PASS]`). Coverage HTTP framing for weekend is already generic “NO EXPECTED IDENTITIES” (`research_session_coverage.rs` `FRAMING_WEEKEND`); tape/keep framing strings still say WEEKEND. Overloading the weekend **arm** would print “ineligible weekend” for a Thursday. Mechanism:

- Coverage `derive`: if `!is_et_session_day(d)` → empty rows/holes, `due: false`, `http_verdict() == "not_due"`, `expected_due() == 0`, CLI `[NOT DUE]` (same as `weekend_is_not_due_empty_expected_exit_0`). `CoverageMatrix.weekend` stays **Sat/Sun only**. Holiday is a distinct matrix-level discriminator so `if matrix.weekend` is not the holiday path. `d_is_due` uses `is_et_session_day`, not weekday-only. `cell_literal` returns `None` for the holiday identity arm the way it does for `IneligibleWeekend` (no `present`/`missing` cell).
- Keep: gate **before GET** on `!is_et_session_day`, sibling of `Occupancy::IneligibleWeekend`. Files-call 0. Not `EmptyExtract`, not `Miss`, not `Kept`. Existing Monday-zero-row test **stays** empty-extract (2026-08-10 is not a holiday). New holiday-weekday test stores nothing.
- Tape occupancy/construct/CLI: sibling of `AxisA::IneligibleWeekend`; Path-A append + Path-B marks closed on a holiday even at noon ET. Replay construct refuses a holiday `et_date` the way it refuses `2026-08-15`.
- Ensure: `ensure_eligible` / worker pass use `is_et_session_day(now.et_date)`; holiday Thursday force-pass dials 0 (clone `worker_skips_weekend_force`).
- Exhaustive `match` on keep `Occupancy` / tape `AxisA` / coverage `IdentityStatus` is the enforcement: a forgotten leaf does not compile, or its holiday fixture stays red.

Wire tokens / HTTP field names for the new discriminator are **not** this lane. Data-structure content is: weekend and full-day holiday are different reasons; both are not-due / not-eligible.

**4. Both live session classifiers consume the predicate. Time-of-day branches run only on a session day.**

`MarketPhase::classify` and `market_session_at` are **two clocks**. Fixing only `MarketPhase` leaves SSE `market_session` as `"regular"` at 10:00 ET on Thanksgiving; the ticker then takes the “covered session, no ticks / maybe holiday” path instead of closed.

Mechanism: **session-day gate first**, then the existing time-of-day split.

- `MarketPhase::classify`: if weekend **or** full-day holiday → `ClosedPre` (any clock time that ET date). Do **not** fall through to `AfterClose` after 16:00 on a holiday — `resolve_gex_spot` for `AfterClose` prefers **today’s** close; a full-day closed market has no session close. `ClosedPre` already prefers prior close.
- `market_session_at`: if full-day holiday → `"closed"` before premarket/regular/afterhours. Leave the late-Sunday `"overnight"` exception on **Sunday** only.
- Scanner `should_sweep`: if `!is_et_session_day` → false (idle slow lane), even inside 04:00–20:00. When `SCAN_MARKET_HOURS_ONLY` is off, still 24/7 (same as weekend today). Fast lane remains always-on so idle ≠ worker-down. Extract `should_sweep_at(now, …)` so holiday tests are not wall-clock flakes; production wraps `Utc::now()`. Do not enable the gate on the existing suite path BACKLOG exempted (time-of-day flakes).

`[live-vs-static-isolation]`: this is a **static session clock**, not a live tick. Holiday `ClosedPre` / `"closed"` is not an SSE-drop degrade. Bundle math still uses `resolve_gex_spot` on the phase it is given.

`[single-ticker-on-demand]`: lookup is in-process; no vendor call; ensure/scanner stay off the ticker request path.

**5. Half-days are Future. Unscheduled closures beyond the overlay are Future.**

| Option | Complexity | Cost | Why not now |
| --- | --- | --- | --- |
| Treat early-close as full-day ineligible | would skip ensure/tape on a day that **did** session | false `not_due` | 10:00 ET is still RTH; BRIEF is full-day |
| Early-close clocks (AfterClose at 13:00, Path-A/B retune) | new class + new windows | out of BRIEF | distinct occupancy, not this predicate |
| Vendor “is the market open” poll | network on the clock | fails `[cited-code]` / vendor-on-coverage | BRIEF: closed in-process set |

Half-day at 10:00 ET must remain `Rth` / `"regular"` / due / eligible. Putting early closes in the full-day set would **create** missing books. Overnight gap (OPEN_THREADS §2) is untouched.

### Data flow (one sentence each)

1. Operator or clock supplies an America/New_York **calendar date** (named `et_date` or `now` converted with `chrono_tz::America::New_York` — already the house TZ).
2. Domain module classifies that date: weekend | full-day holiday | session day (and, outside 2020..=2032, “not in the holiday table”).
3. Session-day → existing weekday paths unchanged (coverage cells, ensure wake, tape append, keep GET, `Rth` at 10:00 ET, scanner sweep window).
4. Weekend → existing weekend arms unchanged.
5. Full-day holiday → sibling ineligible / not-due / `ClosedPre` / `"closed"` / no ensure dial / no keep GET / no Path-A append / scanner slow idle.
6. Nothing in this flow writes a session book, keep extract, or tape occupant. `[present-is-live-paid-only]`: a holiday is never `present` and never inserted as `LiveMassive`. A book that already exists on that date is irrelevant because the date is not due.

### Component boundary

```
domain/nyse full-day module  (table + predicates)
        ↑
        |  import predicates only
        |
 +------+--------+------------+--------------+----------------+------------------+
 |      |        |            |              |                |                  |
 market  stream  coverage     ensure         day_tape/clocks  keep/clocks     scanner/loop
 classify session_at
        |
        +-- resolve_gex_spot (phase in, no calendar)
```

Forbidden edges: tape/keep ↛ coverage/ensure; calendar ↛ `quant-engine` / `signals`; calendar ↛ Massive REST/WS/files; FE ↛ a second holiday table.

### Isolation / error rules

- Calendar lookup is total on a parsed `NaiveDate`: never `Result`, never null, never HTTP.
- Corrupt table is a **compile/test** failure, not a serve-time fallback to “treat as weekday.”
- `[best-effort-isolated-or-null]` does not apply to this classification.
- Coverage/tape/keep remain zero-Massive on the holiday path (gate before GET/dial).
- Scanner gate-off (`SCAN_MARKET_HOURS_ONLY` false) still sweeps holidays — same as weekends; not a new fail-open.
- Production-fails-closed: do not add a runtime holiday-file prerequisite; the table is in the binary. Do not refuse bind if “calendar missing.”

### Explicit non-goals

- Vendor or MIC holiday fetch; any crates.io calendar; AWS/Massive “market status” API.
- Half-day / early-close windows; retuning Path-A 04:00–20:00 or Path-B 09:30–16:00 for early close.
- Widening `is_et_weekend` to mean “market closed.”
- Treating a holiday weekday zero-row keep as `EmptyExtract` success (that is the hole we close).
- Fabricating `LiveMassive` / coverage `present` / keep `kept` for a closed day.
- Retuning keep `due_instant` (still calendar D+1 11:00 ET, including Friday→Saturday).
- Retuning `opportunity_score` / tier / fingerprint / entry gate (`Authorizes: nothing`).
- Lifting Pages `/api/_research` 404; occupying `/lab`; new trader nav; new operator route.
- Earnings `events.json` / bundle event calendar (different fact, different honesty rule).
- Dual NASDAQ-vs-NYSE calendars (SPY/QQQ/IWM follow the US equity full-day set named NYSE here).
- Overnight vendor coverage (OPEN_THREADS §2).
- VWAP 4-day bar cushion in `rest.rs` (`fetch_intraday_bars` already comments “weekends/holidays”).
- Frontend copy, layout, or a client-side holiday list.
- Endpoint signatures and JSON field names for the new discriminator (synthesizer / other lanes).

### Restated binding constraints

- **`[absent-is-not-none]`**: holiday ineligible ≠ weekend ≠ miss ≠ empty extract ≠ not-storing ≠ coverage `missing` ≠ `not yet due`. Enforced by distinct occupancy/identity arms and by not overloading `CoverageMatrix.weekend` / `is_et_weekend`.
- **`[present-is-live-paid-only]`**: holiday path never mints `LiveMassive` / `present`; keep success word stays `kept` on session days only.
- **`[cited-code-is-verified-not-assumed]`**: clocks cited above; no assumed in-tree holiday table (`Cargo.toml` has none).
- **`[structural-over-prose-enforcement]`**: poison a holiday weekday as weekend-only ineligible → red; poison Columbus Day as closed → red; empty table → red; exhaustive match on new occupancy arm → forgotten leaf does not compile.
- **`[additive-keeps-score-byte-identical]`**: calendar module is not an input to `quant-engine::signals`; empty engine diff.
- **`[local-evidence-is-not-hosted-evidence]`**: unit/CLI proofs are local; they are not a hosted NYSE certification.
- **`[single-ticker-on-demand]`**: no in-request sweep; ensure/scanner stay off the ticker path; holiday lookup is not I/O.
- **`[operator-vs-trader-path-separation]`**: no new trader surface; operator occupancy stays on existing coverage/tape/keep/research-lab reads. Trader-visible effect is the **existing** phase/session classifiers becoming honest (`ClosedPre` / `"closed"`), not a new route.
- **`[operator-vs-trader]`** does not forbid fixing `market_session_at`; that function already feeds the ticker chip.

## Risks I see

- **Stale table.** NYSE can add/move an observed day after we ship. Until the table updates, a new full-day close looks like a due weekday (`missing` / empty extract / ensure wake). Mitigation: test generator + pins; span end (2032) is a dated alarm; unscheduled overlay exists. Residual: we will lag one-off closures unless someone lands a date.
- **Span hole.** Named `et_date` outside 2020..=2032 is never a holiday. A 2019 or 2033 Thanksgiving weekday would still be due. If PM needs unbounded history, lock 2 (static table) is the wrong pick — attack it in R2.
- **Two classifiers, one missed.** If execution wires `MarketPhase` and forgets `market_session_at` (or scanner `should_sweep`), trader chrome or the slow lane stays wrong while coverage looks honest. Mitigation: one predicate, fixtures on every consumer listed in lock 4.
- **AfterClose trap.** Gating only the RTH interval and leaving holiday 17:00 ET as `AfterClose` would prefer today’s close. Session-day gate must precede time-of-day.
- **Overload pressure.** Coverage’s weekend framing is already generic, so the cheapest patch is `weekend: true` on Thanksgiving. That patch passes due-ness tests and fails honesty on tape/keep. R2 should reject any position that reuses the weekend arm for holiday reason.
- **Half-day confusion.** Operators may expect 13:00 early close to idle the scanner. Doing that under this predicate would skip a real session. Keep half-days Future.
- **Scanner test flakes.** `should_sweep` currently reads `Utc::now()`. Injecting `now` is required; turning the gate on for the existing always-on test path is how BACKLOG said the suite becomes time-of-day flaky.

## Assumptions I'm making about the other two lanes

- PM will accept **weekend-class due-ness** (coverage `not_due`, empty expected, exit 0, not `[PASS]`) as the product outcome for a named NYSE full-day holiday, and will still require a **distinct occupancy reason** so a Thursday is not accepted as “weekend.” If PM instead wants holiday cells to render as `missing` with a footnote, lock 3 is wrong.
- PM will place **half-days / early close in Future** and will not require Independence-eve 13:00 clocks in this slice. If PM marks half-days In, the session-day predicate is the wrong attach point.
- PM will accept a **compiled table for years 2020..=2032** plus an (empty) unscheduled overlay, not an unbounded runtime rule engine and not a vendor calendar. If PM requires every named historical date through 1990, lock 2’s span is insufficient.
- PM’s acceptance will name **every consumer** in lock 4 (coverage, ensure, tape, keep, `MarketPhase`, `market_session_at`, scanner slow lane), not a coverage-only ship. If PM drops the ticker phase, I still need `market_session_at` for closed-vs-lagging honesty.
- PM will keep **`Authorizes: nothing`**: no `opportunity_score` retune, no Pages `_research` 404 lift, no `/lab`, no new trader nav. Research occupancy stays on existing operator surfaces (coverage GET, tape/keep CLI, `/_ops/research` as shipped).
- PM will not require retuning keep **D+1 11:00 ET** due, and will not treat a holiday weekday vendor gzip as a keep success path.
- PM will accept **one NYSE full-day set** as the session calendar for SPY/QQQ/IWM (not a per-listing-exchange matrix).
- UX will **not** ship a second frontend holiday table or a calendar editor. Ticker honesty binds to the existing session/phase closed states once those clocks consume the domain predicate.
- UX will write **distinct operator copy** for holiday vs weekend vs miss vs empty extract vs not-storing; this lane only forces distinct types/arms so weekend literals cannot be the only arm. If UX reuses weekend copy for Thanksgiving, `[absent-is-not-none]` is violated in prose even if types are split — I assume they will not.
- UX will retarget the ticker no-ticks tooltip that today says a covered session “may be a market holiday”: after this slice, a full-day holiday should take the **closed** state, and that tooltip should mean feed-lag only. If UX leaves holiday mentioned on the lagging path, the chip will lie whenever `market_session_at` correctly returns `"closed"`.
- UX will not add trader navigation, `/lab`, or a new `/_ops` route; the research-lab coverage card continues to consume the existing coverage GET and will map whatever discriminator the synthesizer names without a new endpoint.
- UX/PM own wire field names. I assume they will **not** encode holiday solely as `weekend: true` on the coverage matrix, even though that boolean already drives the empty-expected HTTP framing.
