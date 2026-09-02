# R3 — ux ↔ architect: exchange-holiday-calendar

One exchange. Conflicts:

- `27ff0c5386600ffaf9c526c8fb9cbc76739b896a651d06e15f85b8aeb4473639` (keep test D=2026-08-10)
- `073800100cc7492d580b1fc6571cf94ba1dd1630a3a613cc7eef90707c98f1cd` (live vs market_session)

R1 not rewritten. Self-revisions in `decisions.md` stay folded. Scanner replica, coverage framing, and 21:00 ET overnight-vs-closed are **not** this pair.

Architect `R3-architect-ux.md` already CONVERGED both items. This file is the matching retract + copy/state lock.

---

## 1. Keep oracle — CONVERGED

**Quoted R1-ux I retract:** “Architect inverts the keep oracle `holiday_weekday_zero_rows_is_empty_extract_not_weekend`: after this feature, holiday D is ineligible, **not** `Occupancy::EmptyExtract`.”

That sentence treated the **named test** as the holiday weekday oracle. I cannot defend that. The test’s `D` is `"2026-08-10"`, a Monday, already my ordinary-weekday oracle (R1 §7). Inverting it in place would print ineligible-holiday for a session weekday — the same rename I forbid the other way (weekend copy on a Thursday). It would also fight PM AC-29 (normal weekday zero-row keep is empty extract, not ineligible).

**What still stands.** A **known NYSE full-day holiday weekday** is not empty-extract success, not miss, not weekend. That honesty lives on a **new** in-set fixture, not on rewriting 2026-08-10.

**What I retract.** Risk 8’s “if the named test is not inverted, the suite certifies the lie.” After this slice the named test is the **out-set / session-weekday** pin. The name documents today’s hole (any weekday zero-row gzip is EmptyExtract because no calendar exists). The date is a stand-in, not Thanksgiving.

### Two fixtures (not one invert)

| Fixture | Date | Operator / suite must see | Must not |
|---|---|---|---|
| Keep existing `holiday_weekday_zero_rows_is_empty_extract_not_weekend` | **2026-08-10** | Ordinary Monday, out-set. Plant zero-row gzip → GET happens → `EmptyExtract` stored; `!is_et_weekend`; not `IneligibleWeekend`; not Miss; content-hit; exit 0. | Ineligible holiday · weekend · treating this Monday as full-day closed |
| **Add new** keep fixture | **2026-11-26** Thanksgiving (in-set weekday) | Gate **before GET**; files-call 0; stores nothing. Occupancy is holiday-ineligible, **not** `EmptyExtract`, **not** Miss, **not** weekend / `IneligibleWeekend`. | `empty extract` · `ineligible weekend` · Kept · present · a GET that then “succeeds” as empty |

Architect names the sibling occupancy arm. I print (already R1 §8; `{et_date}` = `2026-11-26` on this fixture):

- Framing: `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE HOLIDAY`
- Detail: `flat files ineligible holiday: {et_date}`
- Occupancy token: `ineligible holiday`

Weekend keep literals stay byte-identical on Sat/Sun. Do not print `ineligible holiday` on 2026-08-10. Do not print `ineligible weekend` on 2026-11-26.

Verify by: **test** on both rows (silent occupancy lie).

---

## 2. Ticker live vs `market_session` — CONVERGED

**Quoted R1-ux I retract:** “On holiday D at 10:00 ET the chip must see `live: false` and `market_session: 'closed'` so `liveStatus` takes the closed branch.”

I also retract the state-matrix **when** for closed: “`live.live === false` and `market_session === 'closed'`.” That conjunction is how the chip is written **today**, not how holiday closed is produced.

`live` is tick-age freshness (`tick_age < 30s`), not session standing. Requiring `live: false` as a holiday input is the calendar writing a tick flag. Shipped `liveStatus` returns the live chip whenever `live.live` is true **before** reading `market_session`. The live-session label map has no `closed` key, so `live: true` + `closed` paints `● live · closed` via `?? live.market_session`. That paint is the lie. Forcing tick-age false to dodge it is a second lie.

**What still stands.** At 10:00 ET on holiday D the chip is the **closed** state, not live, not overnight, not lag. Closed copy stays. Lag copy must not name holiday.

### Classifier (existing fields, no new wire)

`market_session === 'closed'` is evaluated **before** the `live.live` short-circuit. Closed wins. Tick-age may still be true on a closed holiday; that does **not** select the live branch. Calendar does **not** write `live: false`.

Session-tape standing still branches **before** `liveStatus`. Unchanged.

Pulse follows the chip: closed is `○` + default tone, so `connectionChip` pulse (`●` ∧ info) does not fire. I do not add a holiday pulse path.

### Exact closed copy (unchanged)

| Slot | String |
|---|---|
| Label | `○ market closed` (+ ` · mid $…` when last mid is present) |
| Tooltip | `Market is closed (weekend/holiday). Showing the last completed session.` |
| Tone | default / neutral — not warning-as-lag, not success |

Never: `● live · closed`. Never a `Holiday` chip. Never overnight copy at 10:00 ET on D. Never the lag branch on holiday D at 10:00 ET.

### Lag tooltip (already this lane — not reopened)

This pair does **not** invent lag copy. R1 already drops the fabricated alternative. Exact replacement:

`In a covered session but no ticks are arriving — the feed may be lagging.`

Substring `holiday` absent. Shipped `TickerHeader.tsx` still carries `or it is a market holiday.` — that clause is the feature’s lag-integrity edit, not a calendar field.

### State-matrix restatement

| State | When | Desk sees |
|---|---|---|
| **closed** | `market_session === 'closed'` (weekend **or** full-day holiday), **even if** `live.live` is true | `○ market closed` + closed tooltip |
| **live** | `live.live` **and** a covered (non-closed) session | existing `● live · …` |
| **lag** | `live.live === false`, session is a **covered** session, not overnight, not closed | `○ no live ticks` + lag tooltip without `holiday` |

Verify by: **test** that `live: true` + `market_session: 'closed'` is the closed chip and never contains `● live · closed` (silent). Closed tooltip **review** (intentional copy; pair with the branch test). Lag substring **test** (re-introducing `holiday` is silent).

---

## Pairing close

Both items **CONVERGED**. Nothing here promotes to product.

| Item | Status | Lock |
|---|---|---|
| Keep named test | **CONVERGED** | Leave `holiday_weekday_zero_rows_is_empty_extract_not_weekend` on **2026-08-10** as EmptyExtract / not weekend. I do not treat that fn as the holiday invert. |
| Holiday keep honesty | **CONVERGED** | New **2026-11-26** fixture: ineligible-holiday, not EmptyExtract, not weekend, not Miss; gate before GET. Operator strings above. |
| `live` | **CONVERGED** | Tick-age only. Calendar does **not** write `live: false`. |
| Chip | **CONVERGED** | `market_session === 'closed'` wins over `live.live`. Never `● live · closed`. Closed copy stays. Lag tooltip already drops `or it is a market holiday.` |
