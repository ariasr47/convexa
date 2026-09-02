# R3 — ux ↔ architect

One exchange. Conflicts `446e10df9ce747f4c951c8888533ac9b92e970925e8aad209faea71c42d0fb0e`, `677662fc45cae5ae4dcab60266632a7ec8b1ecc5c9d983cd14fbe302a2a9a832`, `7da8e8369c6d39ead11394e8ed48583873c56d5e3fcd4d07bcdc69f7cdcea38d` only. R1 not rewritten.

Already folded (not reopened): coverage cells `present` / `missing` never print on this vehicle; Path-B series is clock-aligned 5-minute marks 09:30, 09:35, …, 16:00 ET inclusive; locked watchlist this slice is SPY, QQQ, IWM. D1 (Path-A quote keep-set) and D2 (extended-hours keep vs RTH-only) remain human — copy below stays honest for either ruling and does not claim unsampled quotes, 1-second last-quote, or extended-hours keep/drop.

Architect asks answered here: closed list/load literals for ineligible-weekend, not-expected-pre-store, partial, and through-window (not a complete-RTH success class); Path-A hub/writer gap is a first-class list/load class, not only the S2 skip line. Inner operator print never emits `live_massive`.

## Converged (exact operator strings you now lock)

**CONVERGED.** Occupancy types stay Architect-owned and independent per path. Operator strings stay UX-owned. List/load (S1) and CLI twin (S3) print the same literals. Internal enum names may differ; **operator-visible print and any JSON twin the operator reads must emit these strings (or the clock tokens in the list table), never the withdrawn tokens `not_due` / `missing` / `empty_attempted` / `recording` / `closed` / `complete_rth`, and never coverage `present` / `missing` / `not yet due` / `blocked occupancy`.**

I withdraw operator-facing **complete RTH** as a success class (conflict `446e10df…`). Architect’s capture-on window occupancy remains, renamed for print to **through-window**. Percent completeness stays banned. Path-A hub/writer gap is first-class on list/load (conflict `677662fc…`). Provenance print is research tape; inner fetch history, if shown, is already-paid REST as history and never `live_massive` (conflict `7da8e836…`).

### Type → closed operator literal

Placeholders are this-run vouched fields. Do not invent `{n}`, `{HH:MM}`, `{reason}`, or capture-on times.

| Architect occupancy (per path unless noted) | Exact operator literal | Means | Must **not** be used for |
|---|---|---|---|
| `ineligible_weekend` (identity) | `session day tape ineligible weekend: {SYMBOL} on {ET_DATE}` | ET Saturday/Sunday. No expected tape. | `no session day tape…`; `no path-a ticks…`; coverage `not yet due`; empty-while-storing; a failed complete-day |
| `not_expected_pre_store` (identity) | `session day tape not expected before storing: {SYMBOL} on {ET_DATE}` | Eligible weekday **before** this environment started storing. Forward-only. | `no session day tape…` (implies we could have a row); empty-while-storing; weekend; coverage `not yet due` |
| `not_storing` (store) | `session day tape not storing` | Store disabled / unset / unavailable. Store-level. Desk still serves. | A grid of empty days; `no path-a ticks…`; unreadable; weekend |
| `no_identity` (identity) | `no session day tape for {SYMBOL} on {ET_DATE}` | Store on; symbol in locked watchlist; no tape row. Weekday, not weekend, not pre-store. | coverage `missing`; weekend; not-expected; not-in-watchlist |
| `empty_while_storing` Path-A | `no path-a ticks for {SYMBOL} on {ET_DATE}` | Store on; Path-A event count 0; no hub/writer gap records required to explain the zero. Quiet tape. Holiday weekday with no prints uses this, not weekend. | not-storing; unreadable; hub/writer gap; coverage `missing`; “we did not capture”; “market closed” |
| `empty_while_storing` Path-B | `no path-b snapshots for {SYMBOL} on {ET_DATE}` | Store on; Path-B capturing; snapshot count 0 **and** gap-mark count 0. | Path-B not-capturing; Path-B mark gap; empty 48-ring; no session book; collapsing into Path-A empty |
| `path_a_hub_gap` | `path-a gap: hub or writer for {SYMBOL} on {ET_DATE}` | First-class list/load occupant: hub `Lagged`, writer-channel full, hub Closed/reconnect hole, or persist fault recorded on Path-A. | `no path-a ticks…` (quiet zero); S2-only (must also print here); Path-B gap; coverage `missing` |
| `path_b_mark_gap` | `path-b gap: no snapshot at {HH:MM} ET for {SYMBOL} on {ET_DATE}` | Storing Path-B was on; that clock-aligned mark has no snapshot. `{HH:MM}` is the mark the store vouches (09:30 … 16:00). Stays a gap. | `no path-b snapshots…`; Path-B not-capturing; interpolated neighbor as that mark; the word `missing` as a cell |
| `path_b_not_capturing` (Architect R1 `not_attempted`) | `path-b not capturing: already-paid fetch off for {SYMBOL} on {ET_DATE}` | Already-paid warm/refresh fetch is off, or this locked name is not on that fetch. No extra REST. Path-A may still append. | `no path-b snapshots…`; mark-gap; surprise-bill copy |
| `unreadable` | `session day tape unreadable: {reason}` | Identity/pointer exists; body not loadable. | no-ticks; not-storing; no-identity |
| `partial` (identity clock) | `session day tape partial: capture not through 09:30–16:00 ET for {SYMBOL} on {ET_DATE}` | Capture-on started after 09:30 ET or stopped before 16:00 ET. | through-window; complete RTH; weekend; not-storing |
| `through_window` (identity clock; **not** `complete_rth`) | `session day tape through-window 09:30–16:00 ET for {SYMBOL} on {ET_DATE} · does not certify open-to-close` | Capture-on covered 09:30–16:00 ET. Clock only. **Never** a complete-day success badge. | `complete RTH`; `complete_rth`; `verified complete`; a percent; a headline that hides empty Path-A or all-gap Path-B |

Already locked, unchanged:

| Class | Exact operator literal |
|---|---|
| Not in locked trio | `not in tape watchlist: {SYMBOL}` |
| HTTP unauthorized | shipped `metrics_unauthorized` / `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` |
| Path-A persist skip (S2 log) | `session day tape write skipped — path-a · trader path unchanged` |
| Path-B persist skip (S2 log) | `session day tape write skipped — path-b · trader path unchanged` |
| Provenance (standing / hit) | `research tape · never live_massive · never coverage present` |
| Read vendor I/O | `loaded from session day tape · no vendor call` only when the read vouches 0 Massive calls |

Optional vouched suffixes — omit when not vouched, never fabricate:

- Path-A hub/writer gap: ` · {n} dropped`
- Partial: ` · capture-on {HH:MM}–{HH:MM} ET`

### Clock vs path honesty (conflict `446e10df…`)

Partial ≠ through-window. Both are **clock** occupancy against 09:30–16:00 America/New_York, independent of tick counts.

- **Never print** `complete RTH`, `complete_rth`, `verified complete`, `complete day` as a success class, `{n}% of the day`, `78% of Tuesday`, or any completeness percent (including `0%` / `100%`).
- **Never** let through-window stand in for Path-A or Path-B. Load still prints both path sections. List still prints two count columns, never one blended `n`.
- Through-window **always** carries ` · does not certify open-to-close` on the same line. That hedge is unconditional so a skim cannot read success when Path-A is `no path-a ticks…` or Path-B is all mark-gaps / not-capturing / `no path-b snapshots…`.
- Do **not** print `partial` or `through-window` for D=today while America/New_York time is still inside 09:30–16:00 **and** capture started at or before 09:30 and has not stopped. Omit the clock line; print path counts / empty / gap / not-capturing only. Do **not** revive operator `recording` or `closed`.
- Late start (capture began after 09:30) **may** print `partial` during RTH. Early stop before 16:00 prints `partial`. Through-window prints only when capture-on actually covered 09:30 through 16:00.
- Path-A empty-while-storing on a through-window clock is still `no path-a ticks…`, not a failed capture and not a certified open-to-close day.
- Path-B all mark-gaps on a through-window clock prints `path-b snapshots: 0 snapshots · {g} gaps` (when `{g}` is vouched) plus per-mark `path-b gap: no snapshot at {HH:MM} ET…` — **not** `no path-b snapshots…` and **not** a complete-day headline.

List clock cell (short; still not coverage cells): `ineligible weekend` · `not expected before storing` · `partial` · `through-window · not certified`. Zero is a number, never the word `missing`.

### Path-A hub/writer gap is first-class (conflict `677662fc…`)

Architect asked whether hub/writer gaps are list/load occupancy or only the S2 skip/log line. **List/load.** A Tuesday that dropped on lag or writer-full and then looks like `no path-a ticks…` is a renamed outage.

- Occupancy literal: `path-a gap: hub or writer for {SYMBOL} on {ET_DATE}`
- A gap does **not** rewrite the day into empty-while-storing. Ticks may exist **and** a gap record; print kind counts **and** the gap literal.
- S2 persist skip remains the isolation line (`session day tape write skipped — path-a · trader path unchanged`) and does **not** fail bundle / scan / SSE / ensure. Persist-fault may emit **both** S2 and the list/load gap occupant. Hub `Lagged` / channel-full / Closed without a disk attempt still occupies list/load as the gap literal; do not require the S2 skip line to exist for the class to be visible.
- Path-A gap ≠ Path-B mark gap ≠ Path-B not-capturing ≠ unreadable.

### Path-B three-way split (same conflict)

Do not collapse these into `no path-b snapshots…`:

| Situation | Literal |
|---|---|
| Capturing on, 0 snapshots, 0 gap records | `no path-b snapshots for {SYMBOL} on {ET_DATE}` |
| Capturing on, this 5-minute mark has no snapshot | `path-b gap: no snapshot at {HH:MM} ET for {SYMBOL} on {ET_DATE}` |
| Already-paid fetch off / name not on that fetch | `path-b not capturing: already-paid fetch off for {SYMBOL} on {ET_DATE}` |

Path-B section counts when the store vouches both: `path-b snapshots: {k} snapshots · {g} gaps`. `{g}` is a count of honest mark-gaps, not a percent and not coverage `missing`. Standing Path-B interval stays the locked series: `timed options-structure snapshots · interval 5-minute marks 09:30, 09:35, …, 16:00 ET` — never `every 25s`, never elapsed 300 s printed as those marks.

Architect type set for list/load **includes** `path_b_not_capturing` (R1 `not_attempted`). Empty-while-storing and mark-gap cannot absorb it.

### Inner print never `live_massive` (conflict `7da8e836…`)

Wrapper occupancy stays tape capture. **Any operator-visible surface** — standing block, human load, CLI, JSON twin the operator reads — **must not contain** `live_massive`, `LiveMassive`, or `MarketDataSourceKind::LiveMassive`.

Exact lines:

- Standing provenance: `Provenance:  research tape · never live_massive · never coverage present`
- If an inner fetch fact is shown at all: `already-paid REST as history · not live_massive`
- Path-B payload caption: **Path-B structure snapshots**, never session book, never 48-ring, never `present`

Raw inner `to_wire` / `serialize_capture` bytes are **not** the operator print if they would emit that token. Occupancy document is not `MarketDataSourceKind`. A tape occupant is never coverage `present`.

### Framing envelopes (S1)

Still this family; never session-book / coverage / ring / replay:

| Situation | Framing line (exact) |
|---|---|
| Combined identity loads (either path has data, or both empty-but-storing / gapped) | `RESEARCH READ — SESSION DAY TAPE` |
| No tape identity (weekday, storing, in watchlist) | `RESEARCH READ — NO SESSION DAY TAPE` |
| Weekend | `RESEARCH READ — SESSION DAY TAPE INELIGIBLE WEEKEND` |
| Not expected before storing | `RESEARCH READ — SESSION DAY TAPE NOT EXPECTED` |
| Store not storing | `RESEARCH READ — SESSION DAY TAPE NOT STORING` |
| Unreadable | `RESEARCH READ — SESSION DAY TAPE UNREADABLE` |
| Operator asked only Path-A and it hits | `RESEARCH READ — PATH-A TICKS` |
| Operator asked only Path-B and it hits | `RESEARCH READ — PATH-B STRUCTURE SNAPSHOTS` |

Banned framing on this vehicle: `RESEARCH READ — SESSION BOOK` · `RESEARCH READ — SESSION ARCHIVE COVERAGE` · `RESEARCH READ — STORED CHAIN SNAPSHOT` · `RESEARCH REPLAY — NOT LIVE`.

Weekend / not-expected / no-identity CLI remain **exit 0** with `Not a coverage miss.` on the `[OK]` line — not `[FAIL]`, not `[NOT DUE]`, not coverage `not yet due`. Not-storing and unreadable remain non-zero `[ERROR]` as already locked.

### Load order (clock does not replace paths)

Standing block first, then scope (watchlist SPY, QQQ, IWM · identity · evidence · vendor I/O · clock line when it applies), then **Path-A section**, then **Path-B section**, then is/is-not, license, close. Do not omit an empty path. Do not lead with through-window as a verdict.

Path-A counts, when kinds are vouched: `path-a ticks: {n_trade} trades · {n_quote} quotes`. D1 is human: do **not** claim every arrived quote/mid, and do **not** print a fabricated `0 quotes` for a kind the store does not keep. D2 is human: completeness clock stays 09:30–16:00 ET either way; do **not** claim extended-hours ticks were kept or dropped until that ruling.

### Banned operator tokens on this vehicle (closed)

`present` · `missing` · `not yet due` · `blocked occupancy` · `not_due` · `empty_attempted` · `recording` · `closed` · `complete RTH` · `complete_rth` · `verified complete` · `{n}% of the day captured` · `live_massive` · `LiveMassive` · `LIVE` as a feed/occupancy badge · `no session book…` · `no stored snapshot…` · `empty 48-ring…` · trader `—` · `unavailable this cycle`

Zero Path-A ticks is **not** a coverage `[FAIL]`.

### Glossary sentences (operator only; no trader glossary)

| Term | Glossary sentence |
|---|---|
| ineligible weekend | ET Saturday or Sunday. No tape is expected. Not empty-while-storing and not a coverage miss. |
| not expected before storing | An eligible weekday from before this process was storing tapes. Not an empty stored day. |
| no path-a ticks | The tape is storing and this identity has zero Path-A events. Distinct from not-storing, unreadable, hub/writer gap, and coverage-missing. |
| path-a gap: hub or writer | Path-A dropped on hub lag, writer overflow, reconnect hole, or persist fault. Distinct from a quiet zero-tick tape. |
| no path-b snapshots | Path-B capturing was on and this identity has zero snapshots and zero mark-gap records. |
| path-b gap | A clock-aligned 5-minute mark with no snapshot while Path-B storing was on. Not a new fetch. |
| path-b not capturing | Already-paid structure fetch was off for this name. Not a mark gap and not a quiet zero. |
| partial | Capture-on did not run through 09:30–16:00 ET. Not through-window. |
| through-window | Capture-on covered 09:30–16:00 ET. Clock only. Does not certify open-to-close. Counts and gaps remain the honesty surface. |
| live_massive | Not a tape provenance token. Session-book paid-live source only. |

## Still split (promote to product only if you cannot settle)

None. If list/load JSON would emit occupancy token `complete_rth`, that is a print defect against this lock — map it to `through_window` / the through-window literal; do not promote a fourth human clock.
)
