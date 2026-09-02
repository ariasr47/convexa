# session-day-tape-capture — council decisions

R3 input: `council/conflicts.json` (22 conflicts, 22/22 quotes verified, 11 self-revisions).
Human product rulings are recorded below as they land. Technical folds that already match
are listed as conductor folds; remaining technical pairs go to one resolution exchange.
Crossed self-revisions that still disagree are surfaced as human product calls.

## Self-revisions (folded; not human, not a re-spawn)

- Architect withdraws **all in-window trades + 1 s last quote** (`daf84924…`). Proposes
  every decoded `Trade` and `Quote` already on `StockStreamHub` for the locked trio;
  recv loop never awaits I/O; overflow = Path-A gap records. **Does not lock the keep-set**
  — PM simultaneously withdraws the unsampled-all-quotes lock toward 1 s last quote
  (`f99f5708…`). Surfaced as human **D1**.
- Architect withdraws **RTH-only append** (`10068494…`). Proposes Path-A keep
  ClosedPre/AfterClose ticks that already arrive; Path-B stays clock-aligned
  09:30–16:00. **Does not lock the Path-A window** — PM simultaneously withdraws
  extended-hours keep toward RTH-only capture (`f4beceac…`). Surfaced as human **D2**.
- Architect withdraws **elapsed 300 s wall-clock** Path-B (`cc911052…`). Proposes
  `floor(now_et, 5min)` at most one already-paid snapshot per mark 09:30–16:00
  inclusive, persist hook still inside `refresh_analytics` (no new REST, still no
  `spawn_capture`). PM (`2b74bb89…`) and UX (`0d046c32…`) asked the same. **Folded:
  clock-aligned 5-minute Path-B marks.** Elapsed 300 s is not the series.
- Architect withdraws occupancy tokens `not_due` / `missing` / collapsed `closed` /
  one `gap` (`17adc319…`). Types stay per-path; UX owns operator strings; never
  coverage `present`/`missing`. PM (`948460c9…`) and UX (`677662fc…`) asked the same
  on the original list. **Folded: no coverage cells on this vehicle.** Remaining
  literal inventory goes to the architect–ux technical exchange.
- Architect withdraws **hard cap 8** (`34c34be2…`). Proposes a sibling closed set
  whose v1 members are exactly SPY, QQQ, IWM (not an alias of `ENSURE_SYMBOLS` /
  `WARM_SYMBOLS` / universe). UX (`1dea2545…`) asked the same. **Folded: locked trio
  this slice.** Expansion is Future + owner.
- Architect withdraws **default-on production fail-closed** (`53b87f1e…`). Proposes
  default unset/disabled = `not_storing` and the listener still binds; explicit
  enable refuses on missing/unwritable/conflicting root. PM (`dd04f673…`) still
  treats missing/unwritable dedicated root as desk-up `not_storing`, and root
  collision as a possible start refusal. **Does not lock enablement.** Surfaced as
  human **D3** after D1/D2.
- PM withdraws unsampled-all-quotes (`f99f5708…`) toward 1 s last quote. Crossed
  with architect `daf84924…` → **D1**.
- PM withdraws extended-hours keep (`f4beceac…`) toward RTH-only Path-A. Crossed
  with architect `10068494…` → **D2**.
- PM withdraws operator-facing **complete RTH** as a success class (`2551a5c7…`).
  Architect–ux exchange folded that withdrawal: `complete_rth` is not an occupancy
  arm. Partial is named; through-window is a non-success fact and does not
  certify open-to-close. Empty-while-storing, Path-B gaps, and kind/snapshot
  counts remain the honesty surface; no percent.
- UX withdraws “they have not locked a session window” (`3548cc1b…`). Percent
  headlines stay banned; named complete-RTH vs partial may exist if occupancy
  can carry them without a percent.
- UX withdraws six-literal collapse (`8c345e93…`). Closed set extends with
  Path-B not-capturing ≠ Path-B gap ≠ empty-while-storing; weekend ≠ not-expected
  ≠ no-identity; partial ≠ complete RTH. Zero Path-A ticks stays not a coverage
  `[FAIL]`. Literal strings remain UX-owned in the technical exchange.

## Unanimous technical folds (no exchange)

- Sibling research day-tape store — not session archive, not 48/14d ring, not a
  `MarketDataPort` playback arm, not trader chrome. `NO_UI_CHANGE`. Pages 404
  `_research` / `_metrics`. Tape write failure never fails bundle / scan / SSE /
  ensure. Score/tier/fingerprint untouched. `Authorizes: nothing`.
- Path-A sidecar on existing `StockStreamHub.subscribe_events()` — not a second
  socket. Recv loop must not await disk.
- Path-B persist only from already-paid `refresh_analytics` / warmer `_vendor`
  (still dropped from `spawn_capture`). No extra Massive REST for this slice.
  No OPRA options-quote files. No S3 ingest.
- Watchlist v1 = SPY, QQQ, IWM as a **sibling closed set** (not `ENSURE_SYMBOLS`
  alias). Ensure-set edits must not resize the tape.
- Path-B series = America/New_York clock-aligned 5-minute marks 09:30 … 16:00
  inclusive; at most one already-paid snapshot per mark; missing mark = honest
  Path-B gap. Independent of `WARM_INTERVAL_SECS` (default 25).
- Tape occupants never `MarketDataSourceKind::LiveMassive` and never coverage
  `present`. `present-is-live-paid-only`.
- Local research read is not hosted/production coverage.
- Replay playback, S3 flat-file keep, remote body store, trader UI, hist-chain:
  out of this slice.

## Human product rulings

- **D1 — Path-A keep-set = every already-received trade and quote.** Owner `A` 2026-08-29.
  For the locked trio, Path-A appends every decoded `StreamKind::Trade` and every
  decoded `StreamKind::Quote` already delivered on `StockStreamHub`. Recv loop
  never awaits disk; lag / channel-full / hub close / persist fault become Path-A
  gap records (`path-a gap: hub or writer…`). Do not persist collapsed `LivePrice`.
  Operator copy may say those quotes arrived; 1-second last-quote sampling is out
  this slice (denser sampling is not a v1 hedge). Conflicts `daf84924…`,
  `f99f5708…`, `60d2ff54…` closed.
- **D2 — Path-A window = Massive-covered hours we already pay for.** Owner
  `A` 2026-08-29 (keep everything we pay for in the hours they offer).
  Path-A appends already-received stocks-path events on ET weekdays during
  Massive’s stock session: pre-market through after-hours
  (`ClosedPre` 04:00–09:30, `Rth` 09:30–16:00, `AfterClose` 16:00–20:00
  America/New_York). Overnight (8 PM–4 AM) is out of vendor coverage — nothing
  to keep, not an empty tape. Weekend stays ineligible. Path-B marks remain
  09:30…16:00 inclusive. Partial / through-window still judge **regular hours
  09:30–16:00 only**; extended-hours ticks are extra kept data, not a
  completeness requirement. Conflicts `10068494…`, `f4beceac…`, `e855c3b9…`
  closed.
- **D3 — desk stays up if the tape disk is missing; traders never see it.**
  Owner `A` 2026-08-29. Missing or unwritable **dedicated** tape root → process
  still binds; operator/research/CLI/logs show `session day tape not storing`
  (no fake stored success). **Trader UI is silent** — no banner, chip, Settings
  line, or “we are not recording.” Refuse to start only if the tape path would
  **collide** with session-archive index, session-archive body root, or the
  48/14d ring (extend `body_root_conflicts`). When a dedicated tape root is
  present, writable, and non-colliding, capture is **on** (keep what we pay
  for). Unset root is honest not-storing, not a nested default path. Runtime
  write failure still swallows; bundle / scan / SSE / ensure stay up.
  Conflicts `53b87f1e…`, `dd04f673…` closed.

## Pending human product rulings

- none

## GATE Z — AC-32 (owner `A` 2026-08-29)

**Do not tell “before we recorded” apart from “no tape that day.”** There is no
recorded store-start fact (no baked date, no marker file, no min(present)).
A named past weekday with no day container is **`NoIdentity`** /
`no session day tape…`. Default **today** never pretends old history is a
failure (list is stored days only). Drop ship-blocking **AC-32**. Operator
literal `session day tape not expected before storing…` is **not required**.
Derive must not invent `NotExpectedPreStore` from the store. Poison still
forbids `SESSION_DAY_TAPE_STORE_STARTED` / watermark / first-arm-as-start.
Same residual as session-archive coverage (no `since`).

## Technical exchanges (one round)

- **Verify-by (`5380f8da…`) — ux ↔ pm converged.** Trader-chrome absence, Pages
  404 of `_research`/`_metrics`, `/_ops/metrics` non-render, and no trader-consumed
  tape list/load are **`test`**. AC-27 remainder (“no named dashboard route chosen”;
  does not certify silence) stays **`review`**. AC-37 (no S3) and AC-38 (no lab UI /
  body-move / watchlist expansion) stay **`review`**. Standing-block / glossary /
  SPEC §4 `NO_UI_CHANGE` stay **`review`**. GATE Q is one structural scan plus
  Pages 404 plus closed-stage assertion — not one-test-per-AC.

- **Occupancy / provenance / completeness (`677662fc…`, `7da8e836…`,
  `446e10df…`) — architect ↔ ux converged.** Occupancy is three composing
  axes (gate, per-path content, per-path capture span), not one tag.
  Operator literals (UX): weekend `session day tape ineligible weekend: {SYMBOL}
  on {ET_DATE}`; not-expected-pre-store `session day tape not expected before
  storing: {SYMBOL} on {ET_DATE}`; Path-A hub/writer gap is first-class
  `path-a gap: hub or writer for {SYMBOL} on {ET_DATE}`; Path-B missing mark
  `path-b gap: no snapshot at {HH:MM} ET for {SYMBOL} on {ET_DATE}`; Path-B
  not-capturing `path-b not capturing: already-paid fetch off for {SYMBOL} on
  {ET_DATE}`; partial `session day tape partial: capture not through
  09:30–16:00 ET for {SYMBOL} on {ET_DATE}`; through-window
  `session day tape through-window 09:30–16:00 ET for {SYMBOL} on {ET_DATE} ·
  does not certify open-to-close`. **`complete_rth` is not an occupancy arm
  and not a success class** (PM withdrawal folded). Percent completeness
  banned. Inner Path-B persist drops `MarketDataSourceKind` so tape never
  stamps `LiveMassive`. Coverage `classify_loaded` stays off the tape path.
  Coverage `present`/`missing` never print. Through-window does not certify
  open-to-close when Path-A is empty or Path-B is all gaps.

## Technical exchanges (in flight)

- none — remaining work is D1/D2/D3 product clocks.

## Pending technical exchanges (after D1/D2)

- none — D1/D2/D3 lock the remaining implementation: unsampled Path-A trades+quotes
  on Massive-covered weekday hours (04:00–20:00 ET); recv never awaits disk;
  overflow = Path-A gap; Path-B clock-aligned 5-minute marks from already-paid
  `refresh_analytics`; capture on iff dedicated non-colliding writable tape
  root; missing root = operator not-storing + desk up.
