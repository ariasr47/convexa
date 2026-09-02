# exchange-holiday-calendar — spec

**Source brief:** .spire/clusters/tech/contracts/exchange-holiday-calendar/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-31

## 1. Goal + scope

Make NYSE **full-day** weekday closures a first-class **not-due / ineligible** occupancy the same **family** as Sat/Sun, with a **distinct reason**, so a closed weekday is not a missing paid book, not an empty extract, not a coverage hole, not an ensure wake, and not a live regular session. The buyers are the research operator who already trusts weekend occupancy and the desk that already trusts session standing. `Authorizes: nothing`. This is occupancy honesty on the already-shipped weekend path — not a calendar product, not a vendor fetch, not a score change, not a new surface.

**Human ruling A (2026-08-31).** Include the `/scanner` session badge. Holiday weekday 10:00 ET shows **Closed**, not RTH. Canonical set stays the Rust domain module. Dashboard `marketSessionPhase` consumes a **generated or pin-equality-tested replica** of that same set, used only by the scanner session badge. No `GET /api/holidays`, no bundle calendar field, no calendar editor. Ticker chip still binds SSE `market_session === 'closed'`, not the replica. Reasoning: the badge is already a weekend gate (Sat/Sun → Closed, weekday 10:00 → RTH). Worker idle plus ticker `closed` leaves Thanksgiving 10:00 ET reading RTH on the desk — the same class of lie as holiday-as-feed-lag. BRIEF: vehicles that already have a weekend gate consume the holiday answer.

<!-- spire:council-resolution:v1 3671f1d48874189277d6d111661d44216b18e02e3e1bf97d888fb6b18e7c3fcd folded -->

**In scope:**

- NYSE **full-day** closures on America/New_York **weekdays**, including **observed weekdays** when the named holiday falls on a weekend.
- One in-process full-day membership (`fn(NaiveDate) -> bool`), years **2020..=2032** inclusive. Unlisted dates, including outside the span, are **not** holidays — Mon–Fri stays a session weekday.
- Every existing weekend gate consumes that one answer: coverage, session-day tape, flat-file keep, liquid-name ensure, scanner market-hours idle, both server session classifiers (`MarketPhase::classify`, `market_session_at`), and the dashboard scanner badge (`marketSessionPhase`).
- Coverage: holiday weekday = **empty expected / not_due**, existing no-expected framing, not three `missing` cells, not a pass, not a sixth cell, not a holiday name.
- Tape / keep: sibling **ineligible holiday** (not miss, not empty extract, not empty-while-storing, not `ineligible weekend`). Keep gates **before GET**.
- Ensure: no wake / no paid fetch / no LiveMassive insert or promote for `(SPY|QQQ|IWM, D)`.
- Live session standing: session-day gate first. Holiday civil date is **ClosedPre / `closed` all clock hours** that ET date. 10:00 ET is not regular hours and not feed-lag.
- Scanner: existing market-hours gate idles like a weekend; fast-lane heartbeat continues; badge **Closed**. Gate off ⇒ holiday sweeps the same way weekend would.
- Ticker consume: `market_session === 'closed'` wins over the live short-circuit; lag copy drops holiday. No new ticker widget.
- Score / isolation: empty `libs/quant-engine` diff; Pages `_research` 404 stands; `/lab` still demos; no new trader nav; no new operator URL.

**Out of scope:**

- Vendor or MIC holiday fetch; crates.io calendar; Massive “market status”; `GET /api/holidays`; a bundle calendar field.
- Holiday-admin UI, Settings calendar, named-holiday glossary, Command Deck pin, Ask-AI holiday clause.
- New trader nav, ticker widget, operator URL, `/lab` occupation, Pages `_research` proxy.
- Retuning `opportunity_score` / tier / fingerprint / entry gate.
- Treating leftover live paid books, tape, or extracts on a holiday date as coverage `present` or successful session keep.
- Dual NASDAQ-vs-NYSE calendars (SPY/QQQ/IWM follow this one US-equity full-day set).
- Earnings `events.json`; VWAP bar cushion; keep `due_instant` retune (still D+1 11:00 ET).
- Overnight vendor coverage (OPEN_THREADS §2). Replay-player chrome.

**Future (deliberately deferred):**

- **Half-days / early close** as their own class (short session, still due in the morning — never aliased to full-day ineligible).
- Refreshing the closed set from an entitled vendor calendar without collapsing unlisted dates into “unknown holiday.”
- Unscheduled overlay dates beyond the empty v1 attach point; multi-year maintenance past 2032.
- Other-venue calendars.

## 2. Architecture

NYSE full-day closures are a **session-day clock**, not a vendor fetch, not a score input, and not a new corpus. Weekend ineligibility already exists as independent Sat/Sun predicates. This slice adds **one** in-process holiday predicate those clocks consume so a closed weekday has the same **due-ness** as Sat/Sun without collapsing the **reason** into weekend.

There is **no** holiday table in-tree today (`apps/api/Cargo.toml` has `chrono` + `chrono-tz` only). Cite live clocks, do not assume a calendar exists: `MarketPhase::classify` (`apps/api/src/domain/market.rs`) is weekday ≥ 5 → `ClosedPre`, else 10:00 ET is `Rth`; coverage `is_et_date_weekday` (`session_chain_archive/coverage.rs`); ensure `is_et_weekday` (`ensure.rs`); tape `day_tape/clocks.rs` (`is_et_date_weekday` — local copy, do not import ensure/coverage); keep `flat_file_keep/clocks.rs` `is_et_weekend`; scanner `should_sweep` (`scanner/loop.rs`); SSE `market_session_at` (`routes/stream.rs`). Keep test `holiday_weekday_zero_rows_is_empty_extract_not_weekend` currently documents the hole on `D = "2026-08-10"`.

### One domain module

New vendor-free module next to `domain/market.rs`, re-exported from `domain/mod.rs`. It owns the closed date set and three predicates:

- `is_et_weekend(date)` — **Sat/Sun only** (`num_days_from_monday() >= 5`). Do **not** widen this to holidays.
- `is_nyse_full_day_holiday(date)` — membership in the compiled full-day set.
- `is_et_session_day(date)` — weekday ∧ ¬ full-day holiday.

Lookup on a parsed `NaiveDate` is **total**: `fn(NaiveDate) -> bool` — never `Result`, never null, never HTTP, never a missing file at serve. A date the set does not name, including outside **2020..=2032**, is **not** a holiday (Mon–Fri stays a session weekday). Unparseable `et_date` / zone stays existing `CoverageFault::UnparseableDate` / HTTP 422. Corrupt table is a **compile/test** failure, not a serve-time fallback to “treat as weekday.” `[best-effort-isolated-or-null]` does **not** apply to this classification.

<!-- spire:council-resolution:v1 7c7fe42330cb7d8d1c71479d941d1696ba5a4e8648b2214810b07c6f672d6acb folded -->
<!-- spire:council-resolution:v1 c74ceda679f2e4044fae63e8f9655ffa95c1c12de53e22d4bcc74325629eadcf folded -->

Parse helpers (`parse_et_date`, `today_et_date`) stay local in tape/keep/coverage. Those files **may** import `crate::domain`. They **must not** import each other.

`quant-engine` does not import the calendar. Enforcement: empty `libs/quant-engine` diff.

### Compile-time closed table

Sorted `&'static` integer triples + binary search. Dates cannot return `Err` and cannot panic on serve. No hot-loaded JSON, no crates.io calendar, no Massive/HTTP calendar; `COVERAGE_VENDOR_CALLS` stays 0.

Test-time generator (nth-weekday, weekend observed-shift, Good Friday via Gregorian computus) **does not run in production**. It asserts the static table **equals** the generated regular-NYSE full-day set for every year in **2020..=2032**, and independent fixture pins cannot be satisfied by an empty table (anti-vacuity: table length > 0).

Empty `UNSCHEDULED_FULL_DAY` overlay in the same module is the attach point for one-off closures; v1 may be empty.

**Regular NYSE full-day set (content, not wire):** New Year’s Day, MLK Jr. Day, Washington’s Birthday, Good Friday, Memorial Day, Juneteenth National Independence Day, Independence Day, Labor Day, Thanksgiving Day, Christmas Day — each with NYSE weekend **observed-shift** (Saturday → prior Friday; Sunday → next Monday). **Not** Columbus Day, **not** Veterans Day, **not** Election Day. Federal holiday ≠ NYSE full-day holiday.

**Fixture pins (America/New_York civil dates):**

- In: `2026-01-01` New Year’s, `2026-04-03` Good Friday, `2026-07-03` Independence **observed** (July 4 is Saturday), `2026-11-26` Thanksgiving, `2026-12-25` Christmas.
- Out (session days): `2026-08-10` (keep `D`, Monday), `2026-10-12` Columbus Day (NYSE open), `2026-11-11` Veterans Day (NYSE open).
- Unchanged weekend: `2026-08-08` Saturday, `2026-08-15` Saturday — still `is_et_weekend`, still not holiday membership.

Poison the forbidden collapse: `assert!(is_nyse_full_day_holiday(thanksgiving) && !is_et_weekend(thanksgiving))`. Half-day at 10:00 ET must remain `Rth` / `"regular"` / due / eligible.

### Distinct ineligible reason; same due-ness

Sibling occupancy / identity arm **holiday** next to existing weekend arm. Shared `is_et_session_day` for due-ness. Do **not** overload `is_et_weekend` or `CoverageMatrix.weekend`. Overloading the weekend arm would print “ineligible weekend” for a Thursday.

**Coverage** (`coverage.rs` derive + `routes/research_session_coverage.rs` `envelope`): if `!is_et_session_day(d)` → empty rows/holes, `due: false`, `http_verdict() == "not_due"`, `expected_due() == 0`, CLI `[NOT DUE]` (same family as `weekend_is_not_due_empty_expected_exit_0`). `CoverageMatrix.weekend` stays **Sat/Sun only**. Holiday is a distinct matrix-level discriminator so `if matrix.weekend` is not the holiday path. `d_is_due` uses `is_et_session_day`, not weekday-only. `cell_literal` returns `None` for the holiday identity arm the way it does for `IneligibleWeekend` (no `present`/`missing` cell). HTTP `framing` already exists (`FRAMING` vs `FRAMING_WEEKEND`). Holiday uses the **existing** no-expected literal `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES` (that string does not contain the word weekend). Key it off **not a session day** (holiday or Sat/Sun), **not** by setting `weekend: true` on a Thursday. No sixth cell, no holiday name, no new coverage HTTP reason token, no `[PASS]`. Today-holiday is empty expected / not due, **not** “not yet due until 16:00.” Leftover live paid books on D do not mint a pass or `present`.

<!-- spire:council-resolution:v1 fc17cd773eb24410aa7022af52d18a010b69a2264f6606793c85b7b96dec7429 folded -->

**Keep:** gate **before GET** on `!is_et_session_day`, sibling of `Occupancy::IneligibleWeekend`. Files-call 0. Not `EmptyExtract`, not `Miss`, not `Kept`. Exhaustive `match` on `Occupancy` must compile after the new arm.

**Tape:** sibling of `AxisA::IneligibleWeekend`; Path-A append + Path-B marks closed on a holiday even at noon ET. Replay construct refuses a holiday `et_date` the way it refuses `2026-08-15`. List `days[].clock` gains sibling `ineligible holiday`.

**Ensure:** `ensure_eligible` / worker pass use `is_et_session_day(now.et_date)`; holiday Thursday force-pass dials 0 (clone `worker_skips_weekend_force`).

### Both live session classifiers; session-day gate first

`MarketPhase::classify` and `market_session_at` are **two clocks**. Fixing only `MarketPhase` leaves SSE `market_session` as `"regular"` at 10:00 ET on Thanksgiving.

- `MarketPhase::classify`: if weekend **or** full-day holiday → `ClosedPre` (any clock time that ET date). Do **not** fall through to `AfterClose` after 16:00 on a holiday — `resolve_gex_spot` for `AfterClose` prefers **today’s** close; a full-day closed market has no session close. `ClosedPre` already prefers prior close.
- `market_session_at`: if full-day holiday → `"closed"` before premarket/regular/afterhours. Leave the late-Sunday `"overnight"` exception on **Sunday** only.
- Holiday 17:00 ET is not `AfterClose`. Holiday 21:00 ET is not overnight-as-session-weekday.

`live` on SSE stays tick-age freshness (`tick_age < LIVE_TICK_MAX_AGE_S`). The calendar does **not** write `live: false`. Holiday `ClosedPre` / `"closed"` is a **static session clock**, not an SSE-drop degrade.

Scanner `should_sweep`: extract `should_sweep_at(now, …)` so holiday tests are not wall-clock flakes; production wraps `Utc::now()`. If `!is_et_session_day` → false (idle slow lane), even inside 04:00–20:00. When `SCAN_MARKET_HOURS_ONLY` is off, still 24/7 (same as weekend today). Fast lane remains always-on so idle ≠ worker-down (heartbeat already written every fast tick; `SWEEP_DOWN_AFTER_S ≈ 180s`). Inherited catchup-if-never-completed stays. Do not turn the gate on for the existing suite path BACKLOG exempted (time-of-day flakes). Scanner fail-open remains gate-off, not a new lookup-failure idle.

### Dashboard replica (scanner badge only)

Canonical closed set stays the Rust domain module. Dashboard `marketSessionPhase` (`apps/dashboard/src/app/pages/scanner/format.ts`) consumes a **generated or pin-equality-tested replica** of that same set, used **only** by the scanner session badge. Not a hand-pasted FE list. No `GET /api/holidays`, no bundle calendar field, no calendar UI. Ticker chip binds SSE `market_session === 'closed'`, not the replica.

<!-- spire:council-resolution:v1 4b1635768b6b20831765fde94d96903f06d531175fa3987d1d177c6f5d4f5a01 folded -->
<!-- spire:council-resolution:v1 969a8c98e6d2a6899d31f7427192d8c3bbeb39082baac09132974f307a538e51 folded -->

### Data flow

1. Operator or clock supplies an America/New_York **calendar date** (`et_date` or `now` via `chrono_tz::America::New_York`).
2. Domain module classifies: weekend | full-day holiday | session day (outside 2020..=2032: not in the holiday table).
3. Session-day → existing weekday paths unchanged.
4. Weekend → existing weekend arms unchanged.
5. Full-day holiday → sibling ineligible / not-due / `ClosedPre` / `"closed"` / no ensure dial / no keep GET / no Path-A append / scanner slow idle / badge Closed.
6. Nothing in this flow writes a session book, keep extract, or tape occupant. A holiday is never `present` and never inserted as `LiveMassive`.

### Component boundary

```
domain/ NYSE full-day module  (table + predicates)
        ↑
        |  import predicates only
        |
 +------+--------+------------+--------------+----------------+------------------+
 |      |        |            |              |                |                  |
 market  stream  coverage     ensure         day_tape/clocks  keep/clocks     scanner/loop
 classify session_at
        |
        +-- resolve_gex_spot (phase in, no calendar)

dashboard marketSessionPhase ← generated/pin-tested replica (scanner badge only)
TickerHeader liveStatus      ← SSE market_session === 'closed' (not the replica)
```

Forbidden edges: tape/keep ↛ coverage/ensure; calendar ↛ `quant-engine` / `signals`; calendar ↛ Massive REST/WS/files; FE ↛ a **hand-maintained** second date book. Generated replica is the allowed share path.

**Touched / created (cite live; `[lane-check]` if a path moves):**

| Piece | Owns |
|---|---|
| New `apps/api/src/domain/` NYSE full-day module + `domain/mod.rs` re-export | Table + three predicates |
| `domain/market.rs` `MarketPhase::classify` | Session-day gate → `ClosedPre` |
| `routes/stream.rs` `market_session_at` | Session-day gate → `"closed"` |
| `session_chain_archive/coverage.rs` + `routes/research_session_coverage.rs` | `d_is_due` / empty-expected envelope keyed off `!is_et_session_day` |
| `session_chain_archive/ensure.rs` + `ensure_worker.rs` | `ensure_eligible` uses `is_et_session_day` |
| `day_tape/clocks.rs`, `occupancy.rs`, `literals.rs` + `routes/research_session_day_tape.rs` | Sibling ineligible-holiday arm + Path-A/B closed |
| `flat_file_keep/clocks.rs`, `occupancy.rs`, `literals.rs`, `keep.rs` | Sibling arm; gate before GET |
| `scanner/loop.rs` `should_sweep` → `should_sweep_at` | Holiday idle like weekend |
| `apps/dashboard/.../scanner/format.ts` `marketSessionPhase` | Replica membership → `closed` |
| `TickerHeader.tsx` `liveStatus` | `closed` wins over `live.live`; lag tip drops holiday |
| `/_ops/research` coverage card | Empty-expected chrome keys off no-expected framing + empty rows |

### Failure modes + isolation

- Calendar lookup cannot fail open or fail closed at serve: unlisted ≠ holiday; unparseable stays existing 422 / coverage-failed; not-storing still wins as store-level standing where those vehicles already put it first.
- Coverage/tape/keep remain zero-Massive on the holiday path (gate before GET/dial).
- Scanner gate-off still sweeps holidays — same as weekends; not a new fail-open.
- Production-fails-closed: do not add a runtime holiday-file prerequisite; the table is in the binary. Do not refuse bind if “calendar missing.”
- Holiday-path work does not take down trader bundle / scan read / live stream. Classification is in-process, not I/O.
- `[single-ticker-on-demand]`: lookup is in-process; ensure/scanner stay off the ticker request path.
- Honest `ClosedPre` / `closed` on a full-day holiday **changes spot selection** versus today’s false RTH at 10:00 ET. That is intended. Do not require Thanksgiving’s score to match a session Tuesday.

### Not buildable / rejected approaches

- Per-leaf holiday date copies (drift is the BRIEF failure).
- crates.io exchange calendar (supply-chain; OPEN_THREADS still carries `supply-chain-automation` GATE Q FAIL).
- Runtime JSON beside `universe.json` (fail-open if missing fabricates due-ness).
- Production recurrence engine as the lookup path (a rule bug fabricates open/closed).
- Setting `weekend: true` / reusing `IneligibleWeekend` for Thanksgiving (type-level lie; tape/keep print “weekend”).
- Sixth coverage cell `holiday`, a holiday name line, or a new coverage HTTP reason token.
- `GET /api/holidays` or a bundle calendar field.
- Treating early-close as full-day ineligible (would skip a real session).
- Forcing SSE `live: false` as the holiday mechanism.
- Inverting `holiday_weekday_zero_rows_is_empty_extract_not_weekend` in place on **2026-08-10**.
- Hand-maintained independent TS calendar.
- Occupying `/lab`; lifting Pages `_research` 404; new trader nav.

## 3. Acceptance criteria (with user stories)

Stories: **S1** archive operator (coverage empty-expected, not three missing, not a pass) · **S2** tape operator (ineligible holiday, not empty-while-storing) · **S3** keep operator (ineligible holiday, no fetch, not empty extract) · **S4** desk owner (ensure stays asleep; no fabricated live paid day) · **S5** trader on ticker (10:00 ET not RTH, not feed-lag) · **S6** scanner operator (idle like weekend; badge Closed) · **S7** operator distinguishability (holiday ≠ weekend ≠ miss ≠ empty extract ≠ unlisted weekday) · **S8** desk owner isolation (off request path, Authorizes nothing, no new surfaces) · **S9** reviewer (poison + half-days out + one answer).

Canonical holiday weekday D in oracles is **2026-11-26** (Thanksgiving Thursday). Ordinary weekday oracle is **2026-08-10**. Weekend oracles stay Sat/Sun (`2026-08-08` / `2026-08-15`). Observed Independence Friday is **2026-07-03**; Saturday **2026-07-04** is weekend. Injected America/New_York civil date; no live Thanksgiving required. Dashboard has Vitest + jsdom and Playwright (H3). Occupancy tokens, session classification, nav/path negative space, and the lag-tip substring are **test**. Paint/focus-ring polish stays **review**. Load-bearing holiday membership for the scanner clock belongs in a **pure function** (same shape as `marketSessionPhase`).

Ship-blocking: AC-1–AC-27. AC-28–AC-30 are required scope / copy-honesty checks (`review`). Prefer **one** hermetic injected-clock matrix over a named micro-harness per row. GATE Q must show **both** rejecting paths and an accepting holiday weekday.

<!-- spire:council-resolution:v1 0a53712f4e05a54c0fafb645b0b163d48feb33a8109f2d672209f4b3cc3e51bf folded -->

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | S1 — As the archive operator, I want a known NYSE full-day holiday ET weekday to be not due so Thanksgiving does not look like we lost three paid books | Given in-set holiday weekday D that is past, or today ET at/after 16:00, coverage of SPY/QQQ/IWM for D is the **empty-expected envelope**: `verdict: not_due`, framing exactly `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`, `expected_due: 0`, `present/missing/unreadable/not_yet_due/blocked_occupancy` all `0`, `rows: []`, `holes: []`, `vendor_called: false`, `authorizes: "nothing"`. Not three due cells. Not three `missing` cells. | test |
| 2 | S1 | Under AC-1, the operator coverage card shows that no-expected framing, a counts line of zeros, **no** row stack, **no** verdict token (`pass` / `fail` / `not_due` all withheld — framing carries the claim). It does **not** print `[PASS]`, a coverage pass of present books, a coverage **cell** `holiday`, or a holiday **name**. | test |
| 3 | S1 | Given today ET is holiday weekday D and the clock is **before** 16:00 America/New_York, coverage for D is empty expected / not due — **not** `not yet due` rows implying a session in progress. | test |
| 4 | S1 | A named **future** in-set holiday weekday is empty expected / not due as holiday ineligible, not framed as a future **session** weekday waiting to become due. | test |
| 5 | S1 | A leftover loadable live paid book for `(S, D)` on holiday weekday D does **not** make coverage a pass and does **not** classify that identity `present` as a session day. `present` remains a loadable `LiveMassive` body only. | test |
| 6 | S1 | A normal ET weekday **not** in the full-day set, at/after 16:00 ET, remains **due**: a missing book is still missing. Framing is `RESEARCH READ — SESSION ARCHIVE COVERAGE` (**without** the no-expected suffix). Rows exist. | test |
| 7 | S1 / S7 | An ET Saturday or Sunday is **weekend** ineligible / not due, **not** holiday-weekday occupancy, including when the named calendar holiday falls on that weekend date (e.g. 2026-07-04). Weekend coverage presentation and weekend keep/tape literals are unchanged. | test |
| 8 | S1 | CLI coverage empty-expected (weekend **or** holiday) still uses `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.` — never `[PASS] n/n`. HTTP card does not put that CLI wrapper on screen (`Evidence: this process`). | test |
| 9 | S1 | Coverage HTTP/UI does **not** print the word **weekend** on a holiday Thursday. Operator-visible holiday-vs-weekend distinguishability lives on tape/keep sibling literals, not on a new coverage reason token. | test |
| 10 | S2 — As the tape operator, I want that date to print ineligible (holiday, not weekend) so a closed weekday is not a failed capture day | Given holiday weekday D, tape occupancy for each locked name is **ineligible holiday**: framing `RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY`, detail `session day tape ineligible holiday: {SYMBOL} on {D}`, list clock `ineligible holiday`. Not empty-while-storing, not a no-tape hole, not a coverage miss word, not `ineligible weekend`. Leftover tape on D still inspects as ineligible. Replay construct refuses a holiday `et_date`. | test |
| 11 | S3 — As the keep operator, I want that date ineligible with no fetch so a zero-row file cannot certify a holiday as a successful empty session | Given holiday weekday **2026-11-26**, keep occupancy is **ineligible holiday** and keep **does not fetch** (files-call 0). Framing `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE HOLIDAY`, detail `flat files ineligible holiday: 2026-11-26`, occupancy token `ineligible holiday`. Not `miss`, not `empty extract`, not `ineligible weekend`, not a keep outage. Leftover stored extract on D still inspects as ineligible — not kept-session success. | test |
| 12 | S3 / S7 | On ordinary weekday **2026-08-10**, keep of a published file with zero rows for S is **empty extract**, not ineligible. `holiday_weekday_zero_rows_is_empty_extract_not_weekend` stays on that date (`EmptyExtract`, `!is_et_weekend`, not `IneligibleWeekend`, not `Miss`). | test |
| 13 | S4 — As the desk owner, I want liquid-name ensure to stay asleep so we do not pay for a session NYSE did not hold | Given holiday weekday D and ensure on, ensure **does not wake** SPY, QQQ, or IWM for D (no paid fetch) and **does not insert or promote** a live paid session book for those identities. | test |
| 14 | S5 — As a trader on the ticker, I want 10:00 ET on that weekday to be not regular hours and not feed-lag | At 10:00 America/New_York on holiday weekday D: `MarketPhase` is **not** `rth` (it is `ClosedPre`); SSE `market_session` is `closed` (not `regular`, not `overnight`). Ticker `liveStatus` is the **closed** state (label `○ market closed`), not live, not overnight, not lag. | test |
| 15 | S5 | The calendar does **not** write `live: false`. `market_session === 'closed'` is evaluated **before** the `live.live` short-circuit (never `● live · closed`). | test |
| 16 | S5 | Lag tooltip is exactly `In a covered session but no ticks are arriving — the feed may be lagging.` — substring `holiday` **absent**. Holiday D at 10:00 ET does not take this branch. | test |
| 17 | S5 | On a full-day holiday civil date, `MarketPhase` / `market_session_at` are **closed / ClosedPre for every clock hour that ET date**. Holiday 17:00 ET is not `AfterClose`. Holiday 21:00 ET is not overnight-as-session-weekday. Late-Sunday `"overnight"` remains **Sunday only**. At 10:00 ET on ordinary weekday 2026-08-10, standing **may be** regular / `Rth`. | test |
| 18 | S6 — As the scanner operator, I want the existing market-hours gate and session badge to treat that weekday like a weekend | Scanner badge at 10:00 ET on holiday D is **`Closed`** (`SESSION_LABEL.closed`), not `RTH`, not a fifth label `Holiday`. Ordinary weekday 10:00 ET remains `RTH`. Sat/Sun remains `Closed`. `aria` remains `US equity session`. | test |
| 19 | S6 | Given `SCAN_MARKET_HOURS_ONLY` on, during what would have been regular hours on holiday D the **slow lane is idle** as on a weekend; worker **heartbeat continues** so idle is distinguishable from worker-dead; `scan-worker-down` does **not** engage solely because the slow lane slept; last-known rows remain. Given the gate **off**, holiday D is **not** specially idled — behavior matches weekend with that gate off. | test |
| 20 | S7 — As the operator, I want holiday ≠ weekend ≠ miss ≠ empty extract so I never treat a closed Thursday as Saturday | Holiday ineligible, weekend ineligible, miss, empty extract, empty-while-storing, not-yet-due session weekday, not-storing, unreadable, and unauthorized are **mutually distinguishable** in operator standing without reading source. Poisoning a holiday weekday as weekend-ineligible, as coverage missing, as empty extract, as empty-while-storing, or as regular hours at 10:00 ET makes verification **go red**. The poison is non-vacuous: a real in-set holiday weekday fixture is required. Coverage, tape, keep, ensure, scanner market-hours, session standing, and the scanner badge **agree** on planted D. | test |
| 21 | S7 / S9 | A weekday the full-day set does **not** name — including a known **early-close** session day — remains **eligible / due** as a session weekday this slice: not full-day ineligible, not empty-expected holiday, 10:00 ET may be RTH. Out-set pins: `2026-10-12` Columbus Day, `2026-11-11` Veterans Day. | test |
| 22 | S7 | Unlisted dates, including outside **2020..=2032**, are **not** holidays (Mon–Fri stays a session weekday). Invalid `et_date` stays existing unparseable / coverage-failed (HTTP 422 `et_date_unparseable`) — **not** empty-expected holiday. There is no serve-time “holiday set unreadable” class and no planted unreadable-set GATE Q arm. | test |
| 23 | S8 — As the desk owner, I want this off the ticker request path with zero vendor holiday fetch | Classifying D as holiday / weekend / session weekday completes with **zero vendor holiday fetches** on coverage, tape inspect, keep inspect, ensure-skip, session standing, scanner idle, and ticker/bundle paths. A ticker request does **not** fetch a holiday calendar and does **not** become a market sweep. No `GET /api/holidays`. | test |
| 24 | S8 | `libs/quant-engine` diff is **empty**. For the same market inputs **including phase**, opportunity score, tier, and state fingerprint are byte-identical. Holiday membership is not a scoring feature. Do **not** require a holiday weekday’s output to equal a session weekday’s output when standing is correctly closed vs RTH. | test |
| 25 | S8 | Pages trader origin still **refuses** `/api/_research` and `/api/_research/*` (same 404-class refusal already shipped). `/lab` still presents instrument demos (`data-testid="lab-index"`) and does **not** gain a holiday occupancy matrix. Trader TopNav still has **no** new control for holidays, coverage, tape, keep, or operator research. `/_ops/research` stays off-shell. | test |
| 26 | S8 | Local holiday classification / audit standing cannot be read as hosted/CI/production coverage of NYSE. HTTP coverage `evidence` stays `this process`. CLI evidence stays `local`. | test |
| 27 | S9 — As a reviewer, I want poisoned holiday-as-weekend to go red and half-days out | In-set pins hold: `2026-01-01`, `2026-04-03`, `2026-07-03`, `2026-11-26`, `2026-12-25`. Table length > 0 (anti-vacuity). `2026-07-03` is holiday weekday; `2026-07-04` is weekend. Empty table, Columbus-as-closed, and holiday-as-`is_et_weekend` each go red. | test |
| 28 | S8 | This ship adds **no** new trader route, **no** new operator URL, **no** holiday-admin UI, and **no** Settings calendar. Existing session standing and existing operator prints are the surfaces. | review |
| 29 | S5 | Closed tooltip remains exactly `Market is closed (weekend/holiday). Showing the last completed session.` Neutral tone (not warning-as-lag, not success). Do not upgrade it to a holiday name. | review |
| 30 | S9 | This ship does not add a vendor holiday API, half-day occupancy class, `/lab` occupation, Pages research proxy, score retune, replay chrome, or parked harvest (Benzinga, hist-chain, remote body store, supply-chain-automation). Coverage `fail` / unreadable / not-storing still warning+icon; `not_due` / `Closed` are not success-green or direction-red. AppBar / coverage standing / closing / `Evidence: this process` / `Authorizes: nothing` strings unchanged except the empty-expected framing already shipped. | review |

## 4. UI + interaction

This is **not** `NO_UI_CHANGE`: lying session standing is in the observed-by. It **is** no new surface. Occupancy words stay on existing operator prints (`/_ops/research` coverage card, tape/keep CLIs) and existing desk chrome (ticker connection chip, scanner session badge). Landing, Positions, Settings, Ask-AI, TopNav, `/lab` grow nothing.

**Flows:**

1. Operator unlocks `/_ops/research` as today. Coverage GET for default D. If D is a full-day holiday: nested not-due empty-expected. If D is a normal weekday: default matrix. Sat/Sun: nested not-due, weekend copy unchanged.
2. Operator keep / tape CLI on holiday D: ineligible-holiday print; process does not treat zero rows as empty-extract success; does not print miss; does not print `ineligible weekend`.
3. Desk opens `/ticker/SPY` at 10:00 ET on D: connection chip **closed**, last completed session, not lag-warning-as-holiday. `live.live` may still be true from tick-age; closed wins.
4. Desk opens `/scanner` at 10:00 ET on D: badge **Closed**; board is last-known structure; not worker-down theater.
5. Next ordinary weekday: due/eligible/RTH as today.

No keep/ensure/fill button. No “acknowledge holiday.” No nav.

**Component states** — holiday is a nested occupancy / session classification, not a new page state:

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Coverage card (`/_ops/research`) | Due weekday: existing coverage framing, counts, rows, `verdict` `pass`\|`fail`; `present` is the only load button | Existing in-flight | **Nested not-due (empty expected):** Sat/Sun **or** NYSE full-day holiday D. Framing `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`. Counts line of zeros. **No** row stack. **No** verdict token. Closing `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`. Must not print `weekend` on a holiday Thursday, a holiday **name**, a cell `holiday`, three `missing` cells, `[PASS]`, or success-green | Unauthorized / coverage withheld (not-storing / store-error) / invariant-fault unchanged — holiday is not a lock and not three `missing` cells | Coverage has **no** stale keep-last. Unclassified transport → existing coverage-unavailable. Nested **not-yet** (future session weekday with `not yet due` rows + ordinary framing) must **not** hide behind no-expected chrome |
| Ticker connection chip | `live.live` and a **covered** session → existing `● live · …`. Must **not** fire when `market_session === 'closed'` | n/a (stream-driven) | n/a | Stream offline / session-tape standing unchanged; holiday is not a tape phase | **Closed** (weekend **or** full-day holiday): label `○ market closed` (+ last mid if present), closed tip below, **neutral**. **Overnight**: existing overnight tip — not for a holiday RTH clock. **Lag**: `live.live === false`, session covered, not overnight, not closed → `○ no live ticks` + replacement lag tip, warning+icon. Holiday D at 10:00 ET does **not** take lag |
| Scanner session badge | Ordinary weekday not in the full-day set: existing `RTH` / `Pre` / `After` | n/a (clock-derived) | n/a | n/a | **Closed** on ET Sat/Sun **or** NYSE full-day holiday (any clock hour that would otherwise be pre/rth/after). Half-day Future: still pre/rth/after until a later early-close class exists |
| Scanner board | Last-known rows; cadence line is methodology (`Prices live · structure ~3 min…`) — do not retune it into a holiday sentence | Existing skeleton | Existing empty view | `scan-worker-down` only when weekend idle would show it (heartbeat aged past 180s). Holiday slow-lane idle **must not** engage it | Degraded poll keeps last-known rows as shipped |

Empty-expected chrome keys off **payload** `framing === RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES` **and** empty `rows` / `holes`, **not** `verdict === 'not_due'` alone and not a client weekday guess. (Today’s local name `weekend` on `verdict === 'not_due'` is a footgun for not-yet-due session weekdays; do not extend it.)

`liveStatus`: evaluate `market_session === 'closed'` **before** the `live.live` short-circuit. Existing closed-session treatments that consume `market_session === 'closed'` (mark ladder freeze, no modeled ticks, reassessment suppression, no live-cross fills) apply automatically. No holiday-specific freeze label. Live-dot pulse stays gated on genuine live — holiday closed must not pulse.

<!-- spire:council-resolution:v1 3e034cdc22da9e0cd16f8b8fedc0493019a3f080eb5a59e53c72d182f474899a folded -->

**Copy** (exact strings):

Coverage HTTP/UI (holiday D = weekend-class empty expected — **same layout and the existing no-expected string**; no sibling framing literal this slice):

- Framing: `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`
- Command: `Command: archive-coverage`
- Evidence: `Evidence: this process`
- Symbols: `Symbols: SPY · QQQ · IWM`
- Checkpoint: `Checkpoint: after 16:00 America/New_York`
- Counts: `Expected due: 0 · present: 0 · missing: 0 · unreadable: 0 · not yet due: 0 · blocked occupancy: 0`
- Closing: `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`
- CLI (local evidence): `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.`

<!-- spire:council-resolution:v1 a4e70d63281345f6b5d5927653922591a8837288da2c09b2ac9757c89b9ceb9b folded -->

Keep (holiday weekday D only):

- Framing: `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE HOLIDAY`
- Detail: `flat files ineligible holiday: {et_date}`
- Occupancy token: `ineligible holiday`
- Weekend D unchanged: `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE WEEKEND` / `flat files ineligible weekend: {et_date}` / `ineligible weekend`

Tape (holiday weekday D only):

- Framing: `RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY`
- Detail: `session day tape ineligible holiday: {symbol} on {et_date}`
- List clock: `ineligible holiday`
- Weekend unchanged: `RESEARCH READ — SESSION DAY TAPE INELIGIBLE WEEKEND` / `session day tape ineligible weekend: {symbol} on {et_date}` / `ineligible weekend`

Ticker:

- Closed tip (keep): `Market is closed (weekend/holiday). Showing the last completed session.`
- Lag tip (replace): `In a covered session but no ticks are arriving — the feed may be lagging.`
- Closed label (keep): `○ market closed`

Scanner:

- Badge: `Closed`
- No new banner copy this slice.

**Banned on these surfaces:** `[PASS]` · coverage cell `holiday` · `ineligible weekend` on a holiday weekday · `ineligible holiday` on Sat/Sun · `empty extract` as holiday success · `miss` as holiday absence · ticker lag naming holiday · `RTH` at 10:00 ET on D · `present` / `kept` / `LIVE` as holiday occupancy · `$398` · hosted/CI on `evidence: this process` · a holiday **name** without a vouched field · new trader nav · `/lab` corpus chrome · `● live · closed`.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` — **Status: SET** (The Curvature Terminal).

**Design direction:** Adhere. No amendment: no new tokens, no new shared component, no fourth convex arc, no new keyframe family, no hardcoded hex, no success/error tint on occupancy, no holiday chip palette. Operator chrome stays metrics-sibling (`AppBar`, outlined `read-only`, `Alert`, dense table, token-only). Ticker chip stays the existing stream-driven status. Scanner badge stays the existing desk strip. Occupancy / `not_due` / `Closed` are **not** P/L — no success green on empty-expected; lag remains `warning.*` + icon; closed chip stays **neutral/default**, as shipped for weekends. IBM Plex Sans for chrome; IBM Plex Mono for occupancy tokens, `et_date`, counts, `verdict`. Mode-aware values stay on `extrasFor(theme)` / `elevationFor(theme)`. Closed vs lag is **label + tooltip**, not color alone. No extra holiday row that overflows 393px. Chip/label text stays ≥11px. Honor `useReducedMotion` vacuously. Sibling `ineligible holiday` literals are occupancy-deck copy on existing operator vehicles, not a new shared pattern.

## 5. Error handling

| Failure class | User / operator sees | Logs | Retry |
|---|---|---|---|
| Unlisted weekday (including outside 2020..=2032, including a Thursday a human remembers as closed, including early-close) | **Session weekday.** Coverage can be due. Tape/keep eligible. Zero keep rows = empty extract. 10:00 ET may be RTH. Not empty-expected holiday | none as holiday | n/a — membership is total |
| Unparseable `et_date` / zone | Existing coverage-failed / HTTP **422** `error: et_date_unparseable`, `detail: et_date must be YYYY-MM-DD`, `vendor_called: false`. **Not** empty-expected holiday | existing | Fix the date |
| Store-level not-storing on a holiday | **Not storing** still wins where those vehicles already put it first. Holiday does not launder not-storing into a pass | not-storing | existing Retry; desk still serves |
| Unauthorized research GET | **401** `metrics_unauthorized` — no corpus body. Holiday does not become an unauthenticated empty-success | none as skip | Supply metrics token |
| Pages trader origin hits `/api/_research` | **Still 404** (same refusal already shipped). Not a holiday calendar feed | n/a | n/a |
| `SCAN_MARKET_HOURS_ONLY` off | Holiday is **not** specially idled; sweep continues as weekend-with-gate-off | existing | n/a |
| Scanner slow-lane idle (gate on) | Last-known rows; **no** `scan-worker-down` if weekend idle does not show one. Fast-lane heartbeat continues | idle log as today | n/a |
| Keep/tape leftover on holiday D | Inspecting D remains **ineligible holiday**. Leftover is not empty-extract success, not kept-session success, not coverage `present` | none as miss | n/a |
| SSE `live: true` on a closed holiday | Chip still **closed** (`market_session === 'closed'` wins). Not lag. Not `● live · closed` | none | n/a |
| Stream drop on a holiday | Existing live-offline degrade of live-derived tiles; holiday closed is not that path | existing | existing reconnect |
| Score / desk | Unchanged formula. Honest closed standing may change spot vs today’s false RTH — intended. Bundle / scan / SSE still succeed | trader path untouched | n/a |

No retry storm. No fabricated zeros. No vendor holiday fetch on failure. Token never appears in Alert/aria/title/query/logs.

## 6. Interface — pointer  ← THE LOAD-BEARING LINK

**Interface:** `.spire/clusters/tech/contracts/exchange-holiday-calendar/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This feature **changes backend occupancy and session clocks**. It does **not** add `GET /api/holidays` or a bundle calendar field. Re-pin existing `GET /api/_research/session-archive/coverage` (holiday D reuses the existing no-expected `framing` literal; `CoverageMatrix.weekend` is not a HTTP field and must not be set true on a Thursday). Re-pin existing ticker SSE `GET /api/stream/{ticker}` `market_session` (holiday civil date → `closed`; calendar does not write `live: false`). Auth on `_research` remains the metrics token, **not** `"auth": true`. Tape/keep grow sibling occupancy literals on existing research envelopes / CLIs. Field lists live in that file.

## 7. Testing strategy

Risk-based, not one-test-per-AC. Invariants that must not silently regress: one domain membership; `is_et_weekend` stays Sat/Sun; unlisted ≠ holiday; empty-expected coverage vs three `missing` vs `[PASS]`; today-holiday ≠ not-yet-due; leftover present does not mint a pass; tape/keep ineligible-holiday vs weekend vs miss vs empty extract; keep **2026-08-10** remains EmptyExtract; new **2026-11-26** gates before GET; ensure no-wake; both session classifiers ClosedPre/`closed` all clock hours on D; `live: false` not written by the calendar; `liveStatus` closed-wins-over-live; lag tip substring `holiday` absent; scanner badge Closed from the replica; slow-lane idle ≠ worker-down; gate-off parity with weekend; half-day still eligible; span hole (2019/2033 Thanksgiving weekday still due); zero vendor holiday fetch; empty `quant-engine` diff; Pages `_research` 404; `/lab` still demos; TopNav silence; local ≠ hosted.

**Pure unit (no DOM / injected clock):** Domain predicates + fixture pins + poison holiday-as-weekend + Columbus-as-closed + empty-table anti-vacuity + test-time generator set-equality for 2020..=2032. Coverage derive on planted D / Saturday / 2026-08-10 / early-close weekday / 2019-11-28. `MarketPhase::classify` and `market_session_at` at 10:00 / 17:00 / 21:00 ET on D vs Sunday overnight exception. `should_sweep_at(now, …)` holiday idle vs gate-off. Ensure force-pass dials 0. Tape Path-A/B closed at noon ET on D; replay refuse. Keep 2026-11-26 files-call 0 vs 2026-08-10 EmptyExtract. `liveStatus({ live: true, market_session: 'closed' })` is closed, not live. Lag tip has no `holiday`. `marketSessionPhase` on replica: 2026-11-26 10:00 ET → `closed`; 2026-08-10 10:00 ET → `rth`; Saturday → `closed`.

Leave `holiday_weekday_zero_rows_is_empty_extract_not_weekend` on **2026-08-10** as EmptyExtract / `!is_et_weekend` / not `IneligibleWeekend`. Add a new fixture on **2026-11-26** that gates before GET, stores nothing, and is not EmptyExtract / not Miss / not IneligibleWeekend.

<!-- spire:council-resolution:v1 c522a8aa5234cf34278c6bfc314556e5b43f495ceb8bba8a73eabc5e8df15e43 folded -->

**Component / jsdom:** coverage card nested not-due (no-expected framing, no rows, no verdict token, no `weekend` on a Thursday fixture). Ticker chip closed vs lag vs `live: true` + `closed`. Scanner badge Closed vs RTH. Worker-down banner absent under holiday idle heartbeat.

**Structural scans (anti-vacuous):** poison holiday weekday as `is_et_weekend` → red; poison Columbus Day closed → red; empty table → red; exhaustive match on new occupancy/identity/`AxisA` arm → forgotten leaf does not compile; replica pin-equality vs Rust set → red on drift; hand-pasted independent FE list without pin → red; `GET /api/holidays` product path → red; TopNav operator/holiday href → red; `/lab` occupancy → red; `quant-engine` import of the calendar → red; Pages Function `_research` 404 prefix unchanged.

**CLI / HTTP hermetic:** one injected America/New_York pass covering AC-1–AC-27 (coverage empty-expected on D, weekend unchanged, ordinary Tuesday due, tape/keep sibling literals, ensure wake count 0, 10:00 not RTH, scanner idle + heartbeat, leftover book not a pass, unparseable 422, vendor holiday-fetch counter 0, score triple identical for same inputs including phase). Live `interface_conformance.mjs` re-pins coverage GET **shape** (and 422); exact holiday literals and `market_session === "closed"` values are GATE Q hermetic / sample, not a live wall-clock Thanksgiving.

**Not required:** e2e that waits for a real exchange holiday; one test per AC; hosted NYSE certification; turning the scanner gate on for the BACKLOG-exempted always-on suite path.

## 8. Guardrails this feature must not break

- **`absent-is-not-none` (HARD)** — holiday ineligible ≠ weekend ineligible ≠ miss ≠ empty extract ≠ empty-while-storing ≠ not-yet-due session weekday ≠ not-storing ≠ unreadable ≠ coverage failed ≠ unlisted weekday. Enforced by distinct occupancy/identity arms and by not overloading `CoverageMatrix.weekend` / `is_et_weekend`.
- **`present-is-live-paid-only`** — holiday path never mints `LiveMassive` / `present`; leftover books do not mint a pass; keep success word stays `kept` on session days only.
- **`cited-code-is-verified-not-assumed`** — clocks cited in §2; no assumed in-tree holiday table. Unverifiable claims stay `[lane-check]`.
- **`structural-over-prose-enforcement`** — poison holiday-as-weekend, holiday-as-miss, holiday-as-empty-extract, holiday-as-RTH, Columbus-as-closed, empty table; anti-vacuity required; exhaustive match on new arms.
- **`additive-keeps-score-byte-identical` / Authorizes: nothing** — calendar module is not an input to `quant-engine::signals`; empty engine diff; do not retune the formula. Honest closed standing may change spot vs false RTH; do not require holiday-vs-session-weekday score identity.

<!-- spire:council-resolution:v1 ac0fa767366017c0fa6bc18f621b87e611f7b228210c42a46d2c6d18da659328 folded -->

- **`local-evidence-is-not-hosted-evidence`** — unit/CLI proofs are local; they are not a hosted NYSE certification.
- **`single-ticker-on-demand`** — no in-request sweep; ensure/scanner stay off the ticker path; holiday lookup is not I/O; no vendor holiday fetch on a ticker request.
- **`operator-vs-trader-path-separation`** — no new trader surface; operator occupancy stays on existing coverage/tape/keep/research-lab reads. Trader-visible effect is the **existing** phase/session classifiers and scanner badge becoming honest, not a new route. Pages `_research` 404 stands. `/lab` untouched.
- **`live-vs-static-isolation`** — holiday ClosedPre / `closed` is a static session clock, not an SSE-drop degrade. Live-dot pulse stays gated on genuine live.
- **`theme-token-discipline` / `single-motion-moment`** — no hardcoded hex; no new keyframe family.
- **`production-fails-closed`** — do not add a runtime holiday-file bind prerequisite.

## 9. Open questions

None. Human ruling **A (2026-08-31)** put the scanner badge in this slice. Coverage framing default-with-veto (2026-08-31) kept the existing no-expected envelope string and keyed it off not-a-session-day. Session-day gate (2026-08-31) is ClosedPre / `closed` for every clock hour that holiday ET date. Keep fixtures, `live: false`, membership totality, and score identity are folded. Half-days remain Future.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"7c7fe42330cb7d8d1c71479d941d1696ba5a4e8648b2214810b07c6f672d6acb","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"fc17cd773eb24410aa7022af52d18a010b69a2264f6606793c85b7b96dec7429","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"c522a8aa5234cf34278c6bfc314556e5b43f495ceb8bba8a73eabc5e8df15e43","disposition":"folded","section":"§7"},{"source":"R2-architect.md","index":3,"conflict_id":"4b1635768b6b20831765fde94d96903f06d531175fa3987d1d177c6f5d4f5a01","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"3e034cdc22da9e0cd16f8b8fedc0493019a3f080eb5a59e53c72d182f474899a","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":0,"conflict_id":"3671f1d48874189277d6d111661d44216b18e02e3e1bf97d888fb6b18e7c3fcd","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":1,"conflict_id":"0a53712f4e05a54c0fafb645b0b163d48feb33a8109f2d672209f4b3cc3e51bf","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":2,"conflict_id":"c74ceda679f2e4044fae63e8f9655ffa95c1c12de53e22d4bcc74325629eadcf","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"ac0fa767366017c0fa6bc18f621b87e611f7b228210c42a46d2c6d18da659328","disposition":"folded","section":"§8"},{"source":"R2-ux.md","index":0,"conflict_id":"969a8c98e6d2a6899d31f7427192d8c3bbeb39082baac09132974f307a538e51","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":1,"conflict_id":"a4e70d63281345f6b5d5927653922591a8837288da2c09b2ac9757c89b9ceb9b","disposition":"folded","section":"§4"}]}
-->
