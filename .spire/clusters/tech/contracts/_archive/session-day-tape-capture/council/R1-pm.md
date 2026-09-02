# R1 — pm position: session-day-tape-capture

## Position

### Who this is for, and what job it does

The buyer is the **research operator / owner**, not the trader on Landing / Ticker / Positions /
Scanner. Convexa already keeps (a) a latest-wins live price for the desk, (b) one first-wins
**start-of-day** paid session book per ET date for **SPY, QQQ, IWM** (QQQ/IWM 24–26 Aug books had
**zero trades** — they are not an open-to-close day), and (c) a 48/14-day ring of cold/scanner
captures that **prunes**. What it does **not** keep is Tuesday’s **intraday stock tape** or
**intraday options structure**. Cancel Massive tomorrow and those hours are gone. Coverage now
tells you a session book is missing; it does not keep the stream.

The job: **persist a replayable open-to-close day for a closed watchlist**, going forward from the
moment storing starts, so a cancelled vendor subscription does not erase a Tuesday we already
lived. Path-A: append every stock-feed event the live desk already received for those names
(instead of only latest-wins). Path-B: keep timed options-structure snapshots from work **already
paid**, at an operator-visible interval, instead of dropping them. Research list/load with **zero
vendor I/O**, including after the vendor is gone. Tape write failure never takes down the desk.
Tape is **never** a live paid session book, **never** a scoring input, **never** played into the
ticker page this slice.

This is a **research tape store**. It is not playback, not S3 flat files, not a trader lab, not a
second session archive, and not a score change.

### Locked product rules (this slice)

| Lock | Product rule |
|---|---|
| **Watchlist** | Closed trio **SPY, QQQ, IWM** only. Not the warmer’s list, not the scanner universe, not an operator-editable set this slice. |
| **Why these names** | Same liquid names we already guarantee a session book and coverage matrix for. Highest research value per byte. Three names bound Path-A volume. Expanding the list is an owner decision, not a silent default. |
| **Day identity** | `(symbol, America/New_York calendar date)`. Eligible dates are **ET weekdays**. Saturday and Sunday are **ineligible**, never “empty Tuesday.” |
| **Open-to-close clock** | Regular hours **09:30–16:00 America/New_York**. Completeness is claimed against that window. |
| **Path-A keep-set (trades vs quotes)** | The operator is promised **every last-trade print** the live stocks path already received for a locked name that day, **and** the **quote / mid updates that already ride that same stocks path** (the mid is what the live desk anchors on). **Not** promised: options quotes, a second socket, OPRA, or next-day S3 quote files. I am **not** sampling Path-A to dodge volume; if the already-received stocks stream cannot be appended for three names, that is an R2 architecture conflict, not a quiet “trades only” narrowing. |
| **Path-B cadence** | Operator-visible interval is **5 minutes**, clock-aligned on America/New_York during RTH: **09:30, 09:35, …, 16:00**. Not the warmer’s ~25s default (that is a live-refresh implementation, not a research series). Not 15 minutes (too coarse around open / close / event minutes — the failure mode of the midnight session book). Not 60s this slice (Future if playback later needs tighter structure). At most **one** kept structure snapshot per name per 5-minute mark. |
| **Path-B source** | Persist structure **already fetched** for live warm/refresh work. **No new vendor product, no extra paid poller, no second Options round-trip invented for the tape.** If that already-paid fetch is off, Path-B is honestly not-capturing — not a surprise bill. |
| **Tape store** | A **sibling research store**. Not the session archive. Not the 48/14-day ring. Ring prune must not delete a tape day. Session-archive bodies do not move. |
| **Provenance** | Tape occupants are **research tape**, never a live paid session book. Loading or reconstructing from tape must **not** make coverage classify that identity **present**. |
| **Forward-only** | Capture starts when storing starts. This slice **does not backfill** last week. Dates before storing are not-expected, not empty tapes. |
| **Playback** | **Out.** Capture is not playing the tape into the ticker page, the live stream, or the fixture clock. |
| **S3** | **Out.** Next-day files reconstruct price/quote history, not same-day greeks/IV/OI. |
| **Score** | **Authorizes: nothing.** |

Exchange-holiday weekdays stay **eligible** (same ET-weekday rule as liquid-name session books).
A holiday with no prints is an **empty stored day**, not ineligible. A holiday calendar is
Future-dated.

### User stories

- **S1** — As the research operator, I want **every stock-path event the live desk already
  received for SPY, QQQ, and IWM** appended onto that ET day’s tape instead of dying as
  latest-wins, so that after the vendor is cancelled I still have Tuesday’s **price tape** (last
  trades **and** the mids/quotes that already arrived on that stocks path).
- **S2** — As the research operator, I want **timed options-structure snapshots** for those same
  names at a **5-minute RTH interval**, taken from fetches we **already paid for**, so that after
  cancel I still have Tuesday’s **intraday GEX / IV / OI evolution**, not only a start-of-day
  session book that can show zero trades.
- **S3** — As the research operator, I want to **list and load** a stored day with **zero vendor
  calls**, including when the vendor is gone, so research does not re-bill and does not depend on
  a live subscription to remember Tuesday.
- **S4** — As the research operator, I want **empty ≠ not-storing ≠ unreadable ≠ no-ticks ≠
  no-structure ≠ partial ≠ weekend ≠ unauthorized ≠ coverage-missing session book**, so I never
  certify a full open-to-close day we did not actually keep, and never treat a session-archive
  hole as filled because a tape exists.
- **S5** — As the desk owner, I want tape **write failure, storage-down, and capture-off** to
  leave bundle / scan / live stream / session-ensure intact, live ticks **neither dimmed nor
  blanked**, and score / tier / fingerprint **byte-identical**, so research storage cannot take
  down the desk or drift the score (`best-effort-isolated-or-null`,
  `live-vs-static-isolation`, `additive-keeps-score-byte-identical`).
- **S6** — As the desk owner, I want the tape **off every trader path**, unlinked from trader UI,
  refused on the trader origin the same way existing research diagnostics already are, with
  **no extra vendor fetch on a tape read**, so stored ticks stay **our research** and are never
  a trader feed (`operator-vs-trader-path-separation`; Massive license).
- **S7** — As the archive owner, I want a tape day to be **unable to count as a live paid session
  book** and **unable to fill a coverage hole**, so a later replay is not certified on a silent
  missing book and reconstructions are never “present.”
- **S8** — As a reviewer, I want **forward capture only**, **no playback this slice**, **no S3
  download**, and **no trader chrome**, so this ship cannot absorb the next three harvest items.

### Scope

#### In

- Forward capture, ET weekdays, closed watchlist **SPY, QQQ, IWM**.
- Path-A: append-only stock-path events (last trades **and** the quote/mid updates already on
  that same stocks path) for those names; not latest-wins-only.
- Path-B: at most one already-paid options-structure snapshot per name per **5-minute** RTH mark
  from 09:30 through 16:00 ET inclusive; provenance **not** live paid session book.
- Completeness claimed against RTH 09:30–16:00 ET. Extended-hours stock events that already
  arrive **are kept** (do not throw paid ticks) but are **not required** to call a day complete.
- Sibling research tape store, listable/loadable by `(symbol, ET date)`, **zero vendor I/O** on
  list and on load, including after vendor cancel.
- Operator-token gate on any networked tape read; trader origin continues to fail closed on the
  research/operator diagnostic family it already cannot reach; **unlinked from trader UI**.
- Honest classes: complete RTH · partial · empty-while-storing · Path-A-empty · Path-B-empty /
  Path-B-gap · not-storing · unreadable · ineligible-weekend · not-expected-pre-store ·
  unauthorized.
- Isolation: tape write / store / capture failure never fails bundle / scan / live stream /
  session-ensure; capture stays **off the trader request path**; sidecar must not dim or blank
  live ticks.
- Score / tier / fingerprint byte-identical; tape is never a scoring input.
- Tape must not write, promote, or occupy a session-archive identity as a live paid book;
  coverage holes stay holes.
- Ring prune must not delete a tape day. Session-archive bodies do not move.
- Secret hygiene: tape material and list/load output contain no secrets.
- Hermetic GATE Q: planted ticks append and remain loadable; planted 5-minute structure lands;
  write failure leaves the desk up; empty/not-storing/unreadable/weekend/unauthorized split;
  tape load does not call the vendor; tape occupant does not classify as live paid present.

#### Out

- Playing the tape back into the ticker page, live stream, or fixture clock
  (`day-replay-mock-adapter` is blocked-on this tape — do not bundle).
- Downloading or reconstituting **S3 flat files** (`massive-flat-file-keep` — next-day price
  history, not same-day greeks).
- Changing live scoring, tier, entry gate, fingerprint, scanner, or live ticks.
- Inserting tape, reconstructions, fixtures, or flat files as **live paid session books**.
- Filling session-archive coverage holes; starting ensure; moving session-archive bodies
  (`remote-archive-body-store`).
- Any trader UI, nav item, Settings control, ticker chrome, or redistribution of stored ticks /
  snapshots as a trader feed (`NO_UI_CHANGE`).
- Expanding the watchlist to the warmer list, scanner universe, or a user-editable set.
- A new Options poller, a second websocket, OPRA, overnight vendor coverage, or any new paid
  Massive SKU.
- Storing the warmer’s ~25s firehose as the Path-B product series.
- Backfilling ET days from before storing started.
- Research-lab UI (`research-lab-surface`), grounded morning snapshot, hist-chain, telemetry
  SLOs, Kubernetes/Kafka.
- Declaring the session-corpus wait complete or authorizing a score change.

#### Future-dated

- **Day replay** that emits a captured day through the existing live contract (blocked-on this
  tape; Fixture today is a frozen snapshot, not a clock).
- **S3 flat-file keep** for entitled next-day trades/quotes/aggregates, provenance-labeled,
  never as a live paid book.
- Operator lab UI to browse tapes / books / score-lab.
- Watchlist expansion beyond SPY/QQQ/IWM by explicit owner decision.
- Optional 60s Path-B grain if playback later needs it.
- NYSE/exchange-holiday calendar.
- Named retention cap / cold archive for tape days (this slice: **do not** prune tape on the
  48/14-day ring schedule; unbounded-all-symbols retention is not in because the list is three
  names).
- Remote body store and production SLOs in the production-maturity sequence.

### Product behavior

**Actors:** operator / maintainer at a research list/load or terminal. **Not** the trader.

**Happy path**

| Situation | What must be true |
|---|---|
| ET weekday, storing on, live stocks path delivers events for SPY, QQQ, IWM | Those events **append** to that ET day’s Path-A tape for each name. A later event does not erase an earlier one. Latest-wins live price may continue for the desk; it is **not** the tape. |
| Same day, already-paid options structure is being fetched during RTH | At each 5-minute ET mark from 09:30 through 16:00, each locked name has **at most one** kept Path-B snapshot from that already-paid fetch. Operator-visible series is 5-minute grain, not ~25s. |
| Operator lists tapes | Sees which locked names have a tape on which ET dates, without trader UI and with **zero vendor calls**. |
| Operator loads Tuesday for a locked name (vendor still up **or** cancelled) | Path-A tape and Path-B series for that identity load with **zero vendor calls**. No live tick is synthesized. |
| RTH elapsed, capture was on from at or before 09:30 through 16:00 ET | That identity may be claimed **complete RTH** only if Path-A was storing across that window **and** every 5-minute mark either has a snapshot or is an honest **gap** (not silently filled). |
| Trader desk during capture | Bundle / scan / live stream / session-ensure unchanged. Live ticks still arrive; they do not dim or blank because a sidecar is writing. No tape chrome. Score / tier / fingerprint unchanged. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path)**

| Situation | Observable outcome |
|---|---|
| Storing on, eligible RTH elapsed, **no stock events** arrived for name S | Path-A for `(S, D)` is **empty-while-storing** — not not-storing, not unreadable, not weekend. Completeness must not invent prints. |
| Storing on, already-paid structure fetch **off** or producing nothing | Path-B is **not-capturing / empty** for those marks. **No extra vendor fetch** is invented to pretty the series. Path-A may still append. |
| A 5-minute RTH mark has no persisted snapshot while Path-B storing was on | That mark is a **gap**. It stays a gap. No fill fetch, no interpolation presented as a snapshot. |
| Tape store disabled / unset / not keeping days | Operator sees **not-storing**, distinct from a grid of empty days. No fabricated complete day. Desk still serves. |
| Identity claimed stored but cannot be loaded (missing body, corrupt, unparseable) | **Unreadable**, not empty, not missing-never-stored, not not-storing. Zero vendor calls on that read. |
| Path-A has prints and Path-B has none (or the reverse) | The two sides are **independently** empty/gapped/present. One side must not stand in for the other. |
| ET Saturday or Sunday | **Ineligible.** No expected tape. Not empty-while-storing, not missing, not a failed complete-day claim. |
| Eligible weekday **before** storing started in this environment | **Not expected.** Not a row of empty tapes for days we could not keep. |
| Process starts mid-RTH (e.g. 11:00 ET) while storing is on | That day’s tape is **partial**, never **complete RTH**. Partial must not read as open-to-close. |
| Process stops before 16:00 ET | Same: **partial**, not complete. |
| Name **not** on the closed watchlist (e.g. a universe megacap) | **Not taped.** No Path-A, no Path-B, no “empty day” that implies we tried. |
| Tape write fails for a tick or a 5-minute snapshot | Desk **still succeeds** (bundle / scan / live stream / ensure). That event/mark is **not** on the tape. Operator can detect the miss (count unchanged / gap / still empty). No false stored success. |
| Networked tape read without the operator token when a token is required | **Refused.** No tape body. Not a trader-session pass. |
| Trader origin / trader UI | **No** tape surface. Existing trader-origin refusal of research/operator diagnostics remains. Stored ticks/snapshots are not redistributed. |
| Tape path is asked to “just fetch it” or “just play it into the ticker” | **Does not.** Zero vendor I/O on read. No playback this slice. |
| Session-archive coverage for `(S, D)` is missing / unreadable | **Stays a hole.** Loading or writing tape does **not** insert a live paid session book and does **not** flip coverage to present. |
| Reconstructed / fixture / tape-derived occupant offered as a live paid book | **Never present** as a live paid session book. This feature never inserts that occupant into the session archive. |
| Vendor cancelled after Tuesday was stored | Tuesday remains listable/loadable with zero vendor calls. New days without a feed are **not-capturing / feed-absent**, not empty-complete days. |
| Capture stall or sidecar fault on the live path | Live ticks **do not** go blank; live-derived UI does not dim **because of tape capture**. Capture is off the trader request path. |
| Secrets in the environment | List/load/tape output contains **no** secret values. |
| Holiday weekday with no prints | **Empty-while-storing** (eligible), not ineligible. |

**Closed product rules (binding)**

1. **Operator feature, not a trader feature.** No in-app trader surface this round.
2. **Closed trio only.** SPY, QQQ, IWM — not the warmer list, not the universe.
3. **ET weekday eligibility, RTH completeness clock 09:30–16:00 America/New_York.** Weekend ≠
   empty. Partial ≠ complete. Pre-store ≠ empty.
4. **Path-A is append-only of what the stocks path already delivered** — last trades **and**
   already-arriving quote/mid updates. Not OPRA. Not a second socket. Not a sampled “one print
   per minute” unless architecture proves the unsampled stream cannot be stored and wins that
   conflict in R2.
5. **Path-B operator interval is 5 minutes**, clock-aligned, from already-paid fetches only.
   25s is not the product. 15 minutes is not this slice. Extra REST is forbidden.
6. **Tape ≠ session book ≠ 48/14-day ring.** Provenance cannot be live paid. Coverage holes stay
   holes (`present-is-live-paid-only`, `absent-is-not-none`).
7. **Desk wins under failure** (`best-effort-isolated-or-null`). Sidecar must not dim/blank live
   ticks (`live-vs-static-isolation`). Capture is off the trader request path
   (`single-ticker-on-demand`).
8. **Authorizes: nothing** on live score.
9. **Read path is zero-vendor** and trader-origin-refused (`operator-vs-trader-path-separation`).
10. **Forward-only.** No backfill, no S3, no playback this slice.
11. **Massive license:** stored ticks/snapshots remain our research, never a trader feed.
12. **Do not absorb** replay, flat files, lab UI, object store, or watchlist expansion.

### Acceptance criteria

Observable from **operator list/load, presence/absence of a day’s Path-A events and Path-B
marks, vendor-call count, desk still serving, live ticks still flowing, coverage class
unchanged, and score identity**. No source reading required. `Verify by` is risk-based: `test`
where silent regression is plausible; `review` where the behavior is visible/intentional. Never
one-test-per-AC. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | S1 | Given storing is on and the live stocks path delivers events for SPY, QQQ, and IWM on an ET weekday D, each of those three names has a Path-A tape for D that contains those events. | test |
| **AC-2 (SB)** | S1 | Given two successive stock-path events for locked name S on D, both remain loadable on the Path-A tape afterward (the later event does not replace the earlier one). | test |
| **AC-3 (SB)** | S1 | A loaded Path-A tape for a locked name includes last-trade prints **and** the quote/mid updates that already arrived on that same stocks path for that name that day — not last-trades only unless R2 explicitly changes this lock. | test |
| **AC-4 (SB)** | S1 | Path-A for a locked name does **not** include options-quote / OPRA events. | test |
| **AC-5 (SB)** | S1 | A name that is not SPY, QQQ, or IWM receives **no** Path-A tape and **no** Path-B series (not an empty-while-storing day that implies we tried). | test |
| **AC-6 (SB)** | S2 | Given already-paid options structure is being fetched through an ET weekday RTH while Path-B storing is on, each locked name has at most one kept Path-B snapshot per clock-aligned 5-minute mark from 09:30 through 16:00 America/New_York inclusive. | test |
| **AC-7 (SB)** | S2 | On a complete-capture RTH fixture where an already-paid fetch existed at every 5-minute mark, the operator-visible Path-B series is 5-minute grain: successive kept snapshots are 5 minutes apart, not ~25s, not 15 minutes, not 60s. | test |
| **AC-8 (SB)** | S2 | Path-B persistence performs **no additional vendor fetch** beyond the already-paid fetch the live warm/refresh work already made. | test |
| **AC-9 (SB)** | S2 | A kept Path-B snapshot is labeled as research-tape structure, **not** as a live paid session book. | test |
| **AC-10 (SB)** | S3 | Listing stored tape days completes with **zero vendor calls**. | test |
| **AC-11 (SB)** | S3 | Loading a stored `(symbol, ET date)` Path-A tape and Path-B series completes with **zero vendor calls**, including on empty, gap, unreadable, and not-found paths. | test |
| **AC-12 (SB)** | S3 | After a stored Tuesday exists, a subsequent “vendor unavailable / cancelled” condition still lets the operator list and load that Tuesday with zero vendor calls. | test |
| **AC-13 (SB)** | S4 | Given storing was on for a full eligible RTH and **no** stock events arrived for S, Path-A is empty-while-storing — not not-storing, not unreadable, not ineligible. | test |
| **AC-14 (SB)** | S4 | When the tape store is not storing, the operator outcome is **not-storing** — not a grid of empty complete days, not an all-present pass. | test |
| **AC-15 (SB)** | S4 | Given an identity whose stored tape cannot be loaded, the outcome is **unreadable** and is not classified empty-while-storing and is not classified not-storing. | test |
| **AC-16 (SB)** | S4 | Path-A empty and Path-B empty/gapped are independently observable; a present Path-B series does not imply a present Path-A tape, and the reverse. | test |
| **AC-17 (SB)** | S4 | An ET Saturday or Sunday for SPY, QQQ, or IWM is ineligible: not empty-while-storing, not a failed complete-RTH claim, not not-storing. | test |
| **AC-18 (SB)** | S4 | Eligible ET weekdays from before this environment was storing tapes are not classified as empty stored days. | test |
| **AC-19 (SB)** | S4 | Given capture for D starts after 09:30 ET or ends before 16:00 ET, that identity is **partial** and is not claimed complete RTH. | test |
| **AC-20 (SB)** | S4 | Given Path-B storing is on and a 5-minute RTH mark has no persisted snapshot, that mark is an honest **gap** and is not filled by a new vendor fetch or by interpolating neighboring marks as if they were that mark. | test |
| **AC-21 (SB)** | S4 | Given the already-paid structure fetch is off, Path-B is not-capturing/empty, Path-A may still append, and **no** new vendor poller starts. | test |
| **AC-22 (SB)** | S5 | If a Path-A or Path-B write fails after the live path already had the event or the already-paid snapshot, bundle / scan / live stream / session-ensure still succeed, and the tape does not gain that event/mark. | test |
| **AC-23 (SB)** | S5 | If the tape store is unavailable / not configured, the trader desk remains available; capture does not report a false stored success. | test |
| **AC-24 (SB)** | S5 | Enabling tape capture does not fail or delay the trader request path: capture remains off-request, best-effort relative to the desk. | test |
| **AC-25 (SB)** | S5 | While the sidecar is capturing, live ticks for the desk continue to arrive; they are not blanked, and live-derived trader UI is not dimmed **because capture is running**. | test |
| **AC-26 (SB)** | S5 | For the same market inputs, opportunity score, tier, and state fingerprint are byte-identical with capture on vs off and with capture succeeding vs failing. | test |
| **AC-27 (SB)** | S6 | No trader-facing route, nav item, or screen is added or changed. | review |
| **AC-28 (SB)** | S6 | A trader origin cannot obtain a tape list or tape body (refused the same way existing operator/research diagnostics are refused on that origin). | test |
| **AC-29 (SB)** | S6 | When an operator token is required, a tape read without it is refused and returns no tape body. | test |
| **AC-30 (SB)** | S6 | No trader-facing product path redistributes stored ticks or structure snapshots as a market-data feed. | test |
| **AC-31 (SB)** | S7 | Writing or loading a tape does not insert a session-archive identity and does not classify that identity as a live paid **present** book. | test |
| **AC-32 (SB)** | S7 | Given session-archive coverage for `(S, D)` is missing, capturing or loading tape for `(S, D)` leaves that coverage cell missing. | test |
| **AC-33 (SB)** | S7 | A tape-derived or reconstructed occupant is never accepted as a live paid session book; coverage/audit of session books does not exit as all-present on the strength of tape. | test |
| **AC-34 (SB)** | S4 | Empty-while-storing, not-storing, unreadable, Path-A-empty, Path-B-gap, partial, ineligible-weekend, and unauthorized outcomes are distinguishable in operator list/load results without reading source. | test |
| **AC-35 (SB)** | S3 | Canary secret values present in the environment do not appear in tape bodies or list/load output. | test |
| **AC-36 (SB)** | S8 | This ship does not play a stored day into the ticker page or the live stream. | test |
| **AC-37 (SB)** | S8 | This ship does not download or ingest S3 flat files. | review |
| **AC-38** | S8 | This ship does not add a trader/operator lab UI, move session-archive bodies, or expand the watchlist beyond SPY, QQQ, IWM. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent honesty / money / desk failures:** append vs latest-wins
  (AC-1/2), trades+quotes keep-set and no OPRA (AC-3/4), closed watchlist (AC-5), 5-minute grain
  and no extra fetch (AC-6–8), provenance not live paid (AC-9/31–33), zero vendor on list/load
  and after cancel (AC-10–12), absence splits (AC-13–21, AC-34), write-fail isolation and live
  ticks not blanked (AC-22–25), score identity (AC-26), trader-origin and token refuse
  (AC-28–30), no playback (AC-36), secret egress (AC-35). These can die under a “helpful” fetch,
  a 25s dump labeled as 5-minute research, a fixture counted as a live book, or a sidecar that
  starves the live path while demos still look green.
- **`review` owns** absence of trader UI (AC-27), no S3 ingest (AC-37), and non-absorption of lab
  UI / body-move / watchlist expansion (AC-38).
- Prefer **one** hermetic pass: inject an ET weekday clock → plant two Path-A events for each of
  SPY/QQQ/IWM → both loadable, NVDA absent → plant already-paid structure at 5-minute marks →
  series is 5-minute not 25s, vendor-call counter stays at the already-paid fetches only → load
  with vendor stub down → still loads → plant write failure → desk/live stream still succeed,
  tape lacks that mark → empty / not-storing / unreadable / weekend / partial / unauthorized
  each distinct → coverage missing stays missing → score triple identical — not a named
  micro-harness per row.
- GATE Q must show **both** a rejecting path (write-fail isolation, unauthorized refuse, tape
  does not mint a live paid present book, weekend is not empty-complete) **and** an accepting
  planted complete-RTH fixture. A suite that only ever lists a happy tape has not proved the
  gate.
- No DOM harness. Observability is operator list/load, vendor-call count, desk + live ticks +
  score identity, coverage class unchanged.
- Playback and S3 are Out: AC-36/37 fail if either lands in this ship, even as a “small hook.”

**Ship-blocking set:** AC-1–AC-37. AC-38 is a required scope-honesty check (`review`).

### Product decisions locked in this position

1. **Audience = research operator.** Trader UI is out (`NO_UI_CHANGE`).
2. **Watchlist = SPY, QQQ, IWM.** Reason: same liquid corpus as session books + coverage;
   bounded Path-A volume; do not default to warmer/universe. Expansion is Future + owner.
3. **Path-A keep-set = full stocks-path events already received** (last trades **and**
   already-arriving quote/mid). Options quotes / OPRA / second socket / S3 = Out. I will not
   pre-sample quotes to make storage easier.
4. **Path-B interval = 5 minutes ET RTH, 09:30–16:00 inclusive, clock-aligned, at most one
   snapshot per mark, from already-paid fetches only.** Reject 25s as product grain. Reject 15
   minutes as this slice. Reject 60s as this slice (Future).
5. **Completeness = RTH 09:30–16:00 ET.** Extended-hours ticks that arrive are kept but not
   required. Partial (late start / early stop) cannot claim complete. Weekend ineligible.
   Holiday weekday = eligible empty if no prints.
6. **Forward-only.** No backfill of days before storing.
7. **Tape store is a sibling.** Not session archive, not the 48/14-day ring. Ring prune cannot
   delete a tape day. Tape cannot occupy live paid present.
8. **Playback out. S3 out. Lab UI out. Body move out.**
9. **Running service exposes list/load to an authenticated operator** (not CLI-only). Transport
   is architecture’s choice among existing operator/research diagnostic families; it must stay
   operator-token, zero-vendor, trader-origin-refused, unlinked from trader UI.
10. **Desk wins; live ticks stay live; score unchanged.**
11. Architect names sidecar vs second socket (product forbids a second socket **as a new vendor
    product**; if a second socket is the only way to append without dimming live ticks, that is
    an R2 conflict against `live-vs-static-isolation` / license / cost — I will not silently
    drop Path-A). Product binds: live ticks must not dim/blank, and Path-A must still append
    what the stocks path already delivered for three names.
12. Architect names which already-paid fetch is downsampled into Path-B (warmer drop vs other
    already-paid structure). Product binds: no new REST, 5-minute operator grain, warmer-off is
    honest Path-B empty.

### Binding constraints restated

- **`operator-vs-trader-path-separation`:** tape capture and list/load stay on the
  operator/research side; unlinked from trader UI; no vendor fetch on a tape **read**; trader
  origin still fails closed.
- **`best-effort-isolated-or-null`:** tape write failure never fails bundle / scan / live
  stream / session-ensure.
- **`additive-keeps-score-byte-identical`:** tape is never a scoring input. **Authorizes:
  nothing.**
- **`live-vs-static-isolation`:** sidecar must not dim or blank live ticks.
- **`present-is-live-paid-only`:** tape / reconstructed occupants are never present live paid
  session books.
- **`absent-is-not-none`:** empty-while-storing ≠ not-storing ≠ unreadable ≠ Path-A-empty ≠
  Path-B-gap ≠ partial ≠ weekend ≠ unauthorized ≠ coverage-missing.
- **`single-ticker-on-demand`:** capture is off the trader request path.
- **`no-secrets-in-image`:** no secrets in artifacts or tape output.
- **`cited-code-is-verified-not-assumed`:** this position does not assert reusable source
  locations. Mechanism reuse is an architecture assumption below.
- **`structural-over-prose-enforcement`:** poison a live paid insert from tape → build/gate
  goes red; poison a vendor fetch on tape load → red; poison weekend-as-empty-complete → red;
  poison a 25s Path-B dump as the operator series → red. Poison tests must be non-vacuous.
- **`local-evidence-is-not-hosted-evidence`:** a local planted-tape receipt is not production
  “we kept every Tuesday.”
- **`score-change-is-deliberate-and-measured`:** this feature authorizes nothing on the live
  score.
- Massive license: stored ticks/snapshots remain our research, never redistributed on a trader
  route; this is the stocks path + paid structure we already fetch, **not** OPRA options-quote
  files.

## Risks I see

- **Watchlist silently expands** to the warmer list or universe “because the fetch is free.”
  That is a different product (unbounded Path-A volume, unbounded Path-B). AC-5.
- **Path-A stays latest-wins.** Then cancel still erases Tuesday. AC-1/2.
- **Quotes dropped without an R2 fight** to save volume, leaving a tape that cannot later
  reconstruct the mid-anchored desk. AC-3. I will not pre-concede this.
- **Path-B stored at ~25s** (second firehose, collides with why warm refresh is excluded from
  the ring) **or at 15 minutes** (midnight-book failure in a new costume). AC-6/7.
- **Helpful extra Options poller** when warmer is off — bills the vendor this feature exists
  not to re-bill. AC-8/21.
- **Tape counted as a live paid present book** so coverage greens a hole. The exact failure
  coverage just shipped to stop. AC-31–33.
- **Empty day collapsed into not-storing** (or the reverse): operator cannot tell “market was
  quiet / feed sent nothing” from “we never kept a tape.” AC-13/14/34.
- **Partial day claimed complete** because *some* ticks exist. Replay later would look like
  open-to-close and lie. AC-19.
- **Write-fail takes down the desk**, or reports stored success with nothing loadable.
  AC-22/23.
- **Sidecar starves or blanks live ticks** (`live-vs-static-isolation`). AC-25.
- **Read path fetches the vendor** “to refresh” — cancel then breaks the thing we kept.
  AC-10–12.
- **Trader-path creep** (a “tape” widget, playback hook, research prefix opened on Pages).
  AC-27/28/36.
- **S3 / replay / lab absorbed** because they sit next in the harvest. AC-36–38.
- **Backfill ambition** — reconstructing last week is a different item (flat files, and they
  still lack same-day greeks). Forward-only is the lock.
- **Unobservable criteria.** If synthesis rewrites rows into “tape works” intentions that
  require reading source, those rows should be cut or restated — not kept for theater.

## Assumptions I'm making about the other two lanes

- The architecture lane can **append Path-A from the existing stocks path** for exactly
  SPY/QQQ/IWM without opening a **second vendor socket** and without dimming or blanking live
  ticks (AC-1, AC-25). If a second socket is required to keep live ticks healthy, architecture
  must say so in R2 rather than shipping a silent live-path regression; I will not drop Path-A
  to avoid that fight.
- The architecture lane can persist **every already-received stocks-path event** (last trades
  **and** quote/mid updates already on that path) for **three** names for one ET day without
  sampling. If quote volume makes that false, architecture must contradict AC-3 with a measured
  bound at R2 — not a quiet trades-only store.
- The architecture lane can **downsample already-paid warm/refresh structure** into one snapshot
  per 5-minute ET RTH mark with **zero extra vendor fetches**, including when the warm loop is
  off (AC-6–8, AC-21). I am not picking the internal hook; I am assuming one already-paid
  structure source exists to downsample. If none exists without a new REST poller, that is an
  R2 conflict — I will not silently skip Path-B.
- The architecture lane can inject an **America/New_York clock** so weekday vs weekend, RTH
  09:30–16:00, 5-minute marks, partial vs complete, and pre-store vs storing are testable
  without waiting for wall time, and so those clocks follow ET — not the host’s local zone.
- The architecture lane can name a **sibling tape store** that is structurally not the session
  archive and not the 48/14-day ring, such that ring prune cannot delete a tape day and a tape
  write cannot `present` a live paid session book (AC-31–33). If the only cheap store is the
  session archive, that is an R2 conflict — I will not let tape occupy live paid present.
- The architecture lane can name **one** operator-token, zero-vendor, trader-origin-refused
  transport for list/load (existing research/operator diagnostic family). I am **not** picking
  the path spelling. If the only way to list a day is a trader-linked surface, that is an R2
  conflict, not a quiet CLI-only narrowing of S3/S6.
- The architecture lane can keep capture **off** the trader request path and **isolated** from
  bundle / scan / live stream / session-ensure, including on write failure and store-down
  (AC-22–24). If capture cannot be isolated, that is an R2 conflict — I will not drop desk
  isolation to ship the tape.
- The architecture lane will verify **live Rust** stocks-path / warm-refresh / session-archive /
  research-read surfaces — not Python-era paths, not briefing HTML as an oracle
  (`cited-code-is-verified-not-assumed`). This position does not assume filenames, types, or
  route strings.
- The architecture lane can prove score / tier / fingerprint byte-identity and zero vendor
  calls on tape read without Massive credentials in the build environment.
- The UX / tech-writer lane will design **no trader UI and no playback chrome**. If UX proposes
  a dashboard, nav item, ticker widget, tape scrubber, or in-app lab browser, that contradicts
  this Out list and `operator-vs-trader-path-separation`, and I will raise it as a conflict at
  R2.
- The UX / tech-writer lane owns exact operator wording for: complete RTH · partial ·
  empty-while-storing · Path-A-empty · Path-B-gap / Path-B not-capturing · not-storing ·
  unreadable · ineligible-weekend · not-expected-pre-store · unauthorized · “research tape, not
  a live paid session book.” I own only that those distinctions exist, are mutually
  distinguishable as words, and that tape/fixture/reconstructed cannot read as live paid
  present.
- The UX / tech-writer lane can keep list/load copy from implying a hosted production pass, a
  score-change authorization, a trader-facing “history” product, or that a session-archive hole
  was filled.
- The UX / tech-writer lane will not specify layout, motion, or ticker placement, because there
  is no trader presentation this slice; operator-facing research copy and absence vocabulary
  are the UX surface.
