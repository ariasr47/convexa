# R3 — architect ⇄ ux: exchange-holiday-calendar

One exchange. Conflicts:

- `27ff0c5386600ffaf9c526c8fb9cbc76739b896a651d06e15f85b8aeb4473639` (keep test D=2026-08-10)
- `073800100cc7492d580b1fc6571cf94ba1dd1630a3a613cc7eef90707c98f1cd` (live vs market_session)

Self-revisions already in `decisions.md` stay folded. Scanner replica, coverage framing, and 21:00 ET overnight-vs-closed are **not** this pair.

---

## 1. Keep oracle — `27ff0c53…`

**Status: CONVERGED**

**Quoted UX claim I attacked:** “Architect inverts the keep oracle `holiday_weekday_zero_rows_is_empty_extract_not_weekend`: after this feature, holiday D is ineligible, **not** `Occupancy::EmptyExtract`.”

**What stands.** A **known NYSE full-day holiday weekday** with a zero-row gzip is **not** `Occupancy::EmptyExtract`, **not** `Miss`, **not** `IneligibleWeekend`. Keep gates **before GET** (files-call 0, stores nothing). That is the hole OPEN_THREADS 7av named. PM AC-15/AC-29 still distinguish holiday-ineligible from ordinary-weekday empty extract.

**What I retract.** Reading that sentence as “rewrite the named test in place.” I will not invert `holiday_weekday_zero_rows_is_empty_extract_not_weekend` onto Thanksgiving. That test’s `D` is the module constant `"2026-08-10"` (ordinary Monday; R1 out-set pin; UX’s ordinary-weekday oracle). Inverting it would mark a session weekday ineligible and fight AC-29.

**UX retracts.** Treating the **named** keep test as the holiday oracle. The name documents today’s hole (any weekday zero-row gzip is EmptyExtract because no calendar exists). The date is a stand-in, not Thanksgiving. After this slice the named test is the **out-set / session-weekday** pin, not the lie.

### Mechanism

Keep already short-circuits `is_et_weekend(et_date)` → `Occupancy::IneligibleWeekend` in `pre_get_gate` **and** `classify_dated` **before** GET / before content facts (`Kept` / `EmptyExtract` / `Miss`). `is_et_weekend` stays Sat/Sun only (`num_days_from_monday() >= 5`). Do not widen it.

Holiday membership is a **sibling arm** on that same Axis A, keyed off `is_nyse_full_day_holiday` / `!is_et_session_day`, not off weekend:

- If weekend → existing `IneligibleWeekend` (literals unchanged).
- If full-day holiday weekday → sibling occupancy (holiday-ineligible). Gate before GET. `send_count` 0. Store load is **not** a content-hit (`is_content_hit` stays `Kept | EmptyExtract` only).
- Else session weekday → existing due / GET / empty-extract path.

Exhaustive `match` on `Occupancy` is the forgotten-leaf stop. Poison holiday-as-weekend on keep still goes red (Thanksgiving is in-set **and** `!is_et_weekend`).

### Two fixtures (not one invert)

| Fixture | Date | Why that date | Assert |
|---|---|---|---|
| **Keep existing** `holiday_weekday_zero_rows_is_empty_extract_not_weekend` | **2026-08-10** | Ordinary Monday, out-set. Not a NYSE full-day holiday. | Plant zero-row gzip → GET happens → `Occupancy::EmptyExtract` stored; `!is_et_weekend`; not `IneligibleWeekend`; not `Miss`; `is_content_hit`; process exit 0. |
| **Add new** keep fixture | **2026-11-26** | Thanksgiving 2026, in-set weekday. | Gate before GET; files-call 0; stores nothing; occupancy is holiday-ineligible, **not** `EmptyExtract`, **not** `Miss`, **not** `IneligibleWeekend`. |

Copy tokens for the sibling print stay UX’s lane. Type content is the sibling arm + the two-date split above.

---

## 2. Ticker live vs `market_session` — `07380010…`

**Status: CONVERGED**

**Quoted UX claim I attacked:** “On holiday D at 10:00 ET the chip must see `live: false` and `market_session: 'closed'` so `liveStatus` takes the closed branch.”

**What stands.** At 10:00 ET on a full-day holiday weekday the chip takes the **closed** branch, not live, not overnight, not the covered-session lag branch. `market_session_at` returns closed (lock 4: session-day gate first). Holiday-as-feed-lag copy is UX’s lane; the standing split is this one.

**What I retract.** Nothing on the data-flow. I still refuse the calendar writing a tick flag.

**UX retracts.** Requiring `live: false` as a holiday **input**. Closed is session standing, not tick-age. The conjunction `live.live === false` **and** `market_session === 'closed'` is how the chip is written **today**, not how holiday ClosedPre is produced.

### Mechanism

`live` and `market_session` are already independent facts on the existing SSE body:

- **`live`** is tick-age freshness only. `build_live_update_body` (no session-tape occupancy) sets it as `tick_age.is_some_and(|a| a < LIVE_TICK_MAX_AGE_S)` with `LIVE_TICK_MAX_AGE_S = 30`. The calendar module does **not** write `live: false`. Session-tape occupancy already forces `live: false` on a different arm; holiday must **not** reuse that path.
- **`market_session`** is the static session clock. `market_session_at`: if full-day holiday → closed **before** premarket/regular/afterhours. Same session-day-first rule as `MarketPhase::classify` → `ClosedPre` (any clock hour that ET date, so `resolve_gex_spot` does not take `AfterClose` and prefer today’s close). Late-Sunday overnight exception stays **Sunday** only.

Today `liveStatus` short-circuits: `if (live.live)` return the live chip **before** reading `market_session === 'closed'`. The live-session label map has no `closed` key, so `live === true` + `market_session === 'closed'` paints `● live · closed` via the `?? live.market_session` fallback. Forcing `live` false to dodge that paint would make the calendar lie about tick-age (`[live-vs-static-isolation]`: holiday closed is not an SSE-drop and not a no-ticks degrade).

**Classifier order (existing consumed fields, not a new wire):** `market_session === 'closed'` is evaluated **before** the `live.live` short-circuit. Closed wins. The chip never paints live-and-closed. Tick-age may still be true on a closed holiday; that does not select the live branch.

Session-tape standing still branches **before** `liveStatus` (`consumeStanding` / `connectionChip`). Unchanged. Mark-freeze / no-live-cross already key off `market_session === 'closed'` and do not need `live` false.

UX owns chip labels, tooltip strings, and the `liveStatus` source edit. Architect owns: calendar does not write `live`; `market_session_at` is the holiday standing; closed beats live in the classifier so the two facts cannot compose into a live closed session.

---

## Pairing close

Both items **CONVERGED**. Nothing here promotes to product.

| Item | Architect | UX |
|---|---|---|
| Keep named test | Leave on **2026-08-10** as EmptyExtract | Do not treat that fn as the holiday invert |
| Holiday keep honesty | New **2026-11-26** fixture, sibling arm, pre-GET | Holiday weekday is not empty-extract success |
| `live` | Tick-age only; calendar does not write it | Retract `live: false` as holiday standing |
| Chip | Closed predicate wins over `live.live` | Closed branch without requiring live false |
