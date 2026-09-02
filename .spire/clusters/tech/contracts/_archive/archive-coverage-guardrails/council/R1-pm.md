# R1 — pm position: archive-coverage-guardrails

## Position

### Who this is for, and what job it does

The buyer is the **operator / owner of the paid session archive**, not the trader on Landing /
Ticker / Positions / Scanner. Convexa already keeps one prune-proof session book per symbol per
America/New_York calendar day for the liquid names **SPY, QQQ, IWM**, and already refuses to
redistribute those books on a trader path. What it does **not** do is say, **the same ET day a
weekday book fails to land**, which of those expected identities are **present**, **missing**, or
**unreadable**. Production learned SPY’s 24–25 Aug books were gone only after the 48-slot ring had
pruned the only remaining copy (Massive chain-snapshot history is not applicable). Write failures
logged thousands of times without one identity-keyed signal.

The job: **turn a silent lost paid Options day into an operator-visible hole the same ET day,
before prune removes the ring copy.** A due expected identity is classified. A missing or
unreadable row after the locked ET checkpoint emits **exactly one** structured warning for that
`(symbol, ET date)`. A local audit command prints the **same** matrix and exits **non-zero** if
any due expected identity is missing or unreadable. Coverage never fetches the vendor, never fills
a gap with reconstructed history, never writes a live paid book, never changes live score, and
never appears in trader UI.

This is research/operator insurance for books we already paid for. It is **not** tape capture, not
a trader lab, not object-storage migration, and not production SLOs.

### Locked product rules (this slice)

| Lock | Product rule |
|---|---|
| **Names** | Expected symbols are the closed trio **SPY, QQQ, IWM** only. |
| **Calendar** | Eligible dates are **ET weekdays** (Monday–Friday in America/New_York). Saturday and Sunday are **ineligible**, never **missing**. |
| **Checkpoint** | **16:00 America/New_York** on an eligible date. After that instant, that date’s trio is **due**. Before it, that date’s trio is **not yet due**. |
| **Due window** | Every eligible date from the first ET weekday this environment’s session archive was **storing** through the last **due** date (yesterday, plus today once 16:00 ET has passed). Dates from before the store was storing are not expected. |
| **Classes** | Each due identity is exactly one of **present** · **missing** · **unreadable**. Ineligible, not-yet-due, seed/conformance fixture, and store-not-storing are **other states**, never collapsed into those three. |
| **Present** | A **loadable live paid-vendor session book** for that exact identity. |
| **Warning** | After checkpoint, each missing or unreadable due identity emits **exactly one** structured warning per `(symbol, ET date)` for the life of that process. |
| **Audit** | One named local command prints the same classifications and exits **0** only when every due expected identity is **present**; **non-zero** on any missing, unreadable, not-storing, or coverage-compute failure. |
| **Clock** | Identity and checkpoint use America/New_York. A local audit receipt is **not** production coverage. |

Exchange-holiday weekdays stay **expected** this slice (same eligibility the liquid-name ensure
already uses: ET weekdays). A holiday false alarm is cheaper than a silent skip. A NYSE holiday
calendar is Future-dated.

### User stories

- **S1** — As the operator, I want a **read-only coverage matrix** of due SPY/QQQ/IWM session
  identities classified present / missing / unreadable, so I can see which paid weekday books
  exist without opening trader UI or calling the vendor.
- **S2** — As the operator, I want **exactly one structured warning per `(symbol, ET date)`**
  after the 16:00 ET checkpoint when that due identity is missing or unreadable, so a lost day is
  visible the same ET day instead of drowning in repeated write-failure noise.
- **S3** — As the operator, I want a **named local audit command** that prints the same matrix
  and exits non-zero on a hole, so a stranger (or GATE Q) can fail a planted miss without treating
  a laptop receipt as hosted production coverage.
- **S4** — As the operator, I want **missing ≠ unreadable ≠ not-yet-due ≠ weekend ≠ fixture ≠
  store-not-storing ≠ reconstructed**, so I never certify a day we did not actually keep as a live
  paid book.
- **S5** — As the operator, I want **last readable identity** for a symbol when any live paid book
  exists on or before that row’s date, and an honest **none** when none exists, so a hole does not
  invent a prior success.
- **S6** — As the desk owner, I want coverage, warnings, and the audit command **off every trader
  path**, **zero vendor I/O**, **no gap fill**, and **byte-identical score / tier / fingerprint**,
  so noticing a hole cannot bill Massive, fake provenance, or take down bundle / scan / SSE /
  ensure (`operator-vs-trader-path-separation`, `best-effort-isolated-or-null`,
  `additive-keeps-score-byte-identical`, `absent-is-not-none`).
- **S7** — As a reviewer, I want a local audit result labeled as **local / not hosted production
  coverage**, so a green laptop run cannot launder into “production kept every book”
  (`local-evidence-is-not-hosted-evidence`).

### Scope

#### In

- Read-only coverage of **due** expected identities for **SPY, QQQ, IWM** over the storing window
  defined above.
- Operator-visible classification **present / missing / unreadable**, plus distinguishable
  **not-yet-due**, **ineligible (weekend)**, **seed/conformance fixture excluded**, and
  **store-not-storing**.
- Last readable live paid identity for that symbol **on or before** the row’s ET date, or honest
  none.
- On the **running service**, after 16:00 ET: **exactly one** structured operator warning per
  missing or unreadable `(symbol, ET date)` for the life of that process.
- A **named local audit command** (BRIEF candidate `archive-coverage`; council may rename) that
  prints the same classifications and exits non-zero on any hole / unreadable / not-storing /
  coverage-compute failure.
- Operator-token gate on any networked coverage read; **unlinked from trader UI**; trader origin
  continues to fail closed on operator/research diagnostics the same way it already does.
- **Zero vendor calls** on the coverage path (matrix, warning, audit), including on miss.
- Coverage **does not write** session books, **does not start ensure**, **does not insert**
  reconstructed or flat-file artifacts as live paid books.
- Isolation: coverage/warning/audit failure never fails bundle / scan / SSE / ensure; coverage is
  never a scoring input.
- Hermetic GATE Q proof: planted missing and planted unreadable fail the audit; a complete due
  fixture matrix passes; reconstructed/fixture identities do not pass as present.

#### Out

- Fetching Massive (or any vendor) to fill a hole.
- Reconstructing history, downloading entitled flat files, or inserting any non-live artifact as a
  live paid session book.
- Changing live scoring, tier, entry gate, fingerprint, scanner, or SSE ticks.
- Taping the live stream; `session-day-tape-capture` and `day-replay-mock-adapter` stay sequenced
  **after** this ship so replay is not certified on a hole.
- Any trader UI, nav item, Settings control, ticker chrome, or redistribution of stored books as a
  trader feed (`NO_UI_CHANGE`).
- Moving bodies to object storage / remote volume (`remote-archive-body-store`, program #6).
- Production SLOs, paid monitoring subscriptions, paging, or alert vendors (`telemetry-slos`).
- Railway volume warning/critical runbook thresholds (named in the 26 Aug audit; **not** this
  BRIEF).
- A high-cardinality write-failure time series that re-creates the permission-denied flood. The
  identity-keyed checkpoint warning **is** the operator signal.
- Expanding expected names beyond SPY/QQQ/IWM.
- Declaring the session-corpus wait complete, starting AI-rec lab, or buying hist-chain.
- Wiring merge CI to production’s live archive (CI cannot see hosted books; a local pass is not
  hosted evidence).
- Durable once-ever warning suppression across process restarts (process-lifetime “exactly one”
  is this ship).
- A NYSE/exchange-holiday calendar beyond the existing ET-weekday eligibility.

#### Future-dated

- Tape capture and day-replay, only after coverage can fail a hole.
- Holiday calendar aligned with exchange closures, if weekday false alarms become noise.
- Durable warning suppression across restarts, if process-lifetime re-emit on bounce is too loud.
- Optional merge-CI audit against **fixtures only** (still not production coverage).
- Operator lab UI (`research-lab-surface`) to browse books — visibility of the lab, not this alarm.
- Remote body store, volume thresholds, and telemetry SLOs in the production-maturity sequence.
- Ensure/coverage for names beyond the liquid trio.

### Product behavior

**Actors:** operator / maintainer at logs, an operator diagnostic read, or a terminal. **Not** the
trader.

**Happy path**

| Situation | What must be true |
|---|---|
| Eligible ET weekday D, session archive storing, 16:00 ET has passed, live paid books exist for `(SPY, D)`, `(QQQ, D)`, `(IWM, D)` | Matrix classifies all three **present**. No hole warning for those identities. Audit command exits **0**. |
| Operator reads coverage | Same classifications as the audit command. **Zero vendor calls.** No session book is written. |
| Last readable | Each present row’s last readable identity is itself. A later missing row for that symbol still points at the most recent **present** identity **on or before** that row’s date. |
| Trader desk | Bundle / scan / SSE / ensure unchanged. No coverage chrome. Score / tier / fingerprint unchanged. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path)**

| Situation | Observable outcome |
|---|---|
| Due identity has no session book | Class **missing**. After checkpoint: **exactly one** structured warning for that `(symbol, ET date)` naming **missing**. Audit exits **non-zero**. |
| Due identity is claimed stored but the book cannot be loaded (missing object, corrupt body, unparseable) | Class **unreadable**, **not missing**. After checkpoint: **exactly one** warning naming **unreadable**. Audit exits **non-zero**. |
| Two of three names missing the same due date | **Two** warnings (one per identity), not one collapsed “liquid names” warning that drops which name failed. Audit non-zero. |
| ET Saturday or Sunday | Those dates are **ineligible**. They are **not** missing, do **not** warn, and do **not** fail the audit. |
| Eligible today, local ET time **before** 16:00 | Today’s trio is **not yet due**. Not classified missing. No hole warning for today. Audit does **not** fail because of today. **Prior due** holes still fail the audit and still warn (if this process has not already warned them). |
| Eligible today, local ET time **at or after** 16:00 | Today’s trio is **due**. Missing/unreadable today warns once per identity and fails the audit. |
| Seed / conformance fixture identity (including the known SPY 2020-01-02 fixture) | **Excluded** from the expected set. Does **not** make a live due date **present**. Does **not** fill last-readable. |
| Session archive **not storing** (disabled, unset, or otherwise not keeping books) | Operator sees **store-not-storing**, distinct from N missing rows. **No** fabricated present. Audit exits **non-zero** as not-storing, not as a passed empty matrix. Desk still serves. |
| Dates before this environment was storing | **Not expected.** Not a grid of missing cells for days the archive could not keep. |
| Reconstructed, flat-file, or other non-live artifact for a due identity | **Never present** as a live paid book. This feature **never inserts** such an artifact into the live session archive. If one is already there, live coverage still fails that cell (not present). |
| No live paid book for that symbol on or before D | Last-readable is **none** — not a blank that looks like a date, not the fixture, not another symbol’s date. |
| Repeated coverage checks in the same process after a warning already fired for `(symbol, D)` | **No second** warning for that identity. Matrix may still show the hole. |
| Process restart after a warning | A **single** re-emit of that identity is allowed. A restart must not reproduce thousands of lines per identity. |
| Coverage derivation itself fails | Operator-visible **coverage unavailable / failed**, **not** an all-present matrix. Audit exits **non-zero** as a compute failure, distinct from missing-book failure and from not-storing. Desk still serves. |
| Networked coverage read without the operator token when a token is required | **Refused.** No matrix body. Not a trader-session pass. |
| Trader origin / trader UI | **No** coverage surface. Existing trader-origin refusal of operator/research diagnostics remains. Stored books are not redistributed. |
| Coverage path is asked to “just fetch it” | **Does not.** Zero vendor I/O; no ensure kick-off; miss stays miss. |
| Bundle / scan / SSE / ensure during coverage failure | Those paths **still succeed**. Coverage cannot fail the desk. |
| Local audit vs production | Local command output/receipt states it is **not** hosted production coverage. Deleting surrounding prose cannot remove that standing. |
| Secrets in the environment | Matrix, warning, and audit output contain **no** secret values. |
| All due identities present | Audit **0**; no hole warnings. Empty-looking output is not this case — the matrix still names the present identities. |

**Closed product rules (binding)**

1. **Operator feature, not a trader feature.** No in-app trader surface this round.
2. **Closed trio only.** SPY, QQQ, IWM — not the scanner universe.
3. **ET weekday eligibility, 16:00 ET due-clock.** Weekend ≠ missing. Not-yet-due ≠ missing.
4. **Three hole-relevant classes stay split:** present ≠ missing ≠ unreadable
   (`absent-is-not-none`). Store-not-storing, fixture, ineligible, not-yet-due, and coverage-compute
   failure are additional splits, not aliases of missing.
5. **Present means a live paid-vendor session book** for that exact `(symbol, ET date)`. Fixture
   and reconstructed material cannot satisfy present.
6. **One warning per identity per process after checkpoint** — the antidote to the permission-denied
   flood. The warning names symbol, ET date, and missing vs unreadable.
7. **Audit exit code is the structural gate** (`structural-over-prose-enforcement`): plant a missing
   due book → command goes red; plant a reconstructed body as the only occupant → command stays
   red; complete live present matrix → green.
8. **Coverage is read-only and zero-vendor.** It does not fill, fetch, or promote.
9. **Desk wins under failure** (`best-effort-isolated-or-null`).
10. **Authorizes: nothing** on live score (`additive-keeps-score-byte-identical`,
    `score-change-is-deliberate-and-measured`).
11. **Local ≠ hosted** (`local-evidence-is-not-hosted-evidence`).
12. **Massive license:** stored books remain our research, never a trader feed.
13. **Do not absorb** tape, object store, volume runbooks, holiday calendars, or lab UI.

### Acceptance criteria

Observable from **operator matrix, structured warning, audit command exit/output, vendor-call
absence, desk still serving, and score identity**. No source reading required. `Verify by` is
risk-based: `test` where silent regression is plausible; `review` where the behavior is
visible/intentional. Never one-test-per-AC. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | S1 | Given a storing archive and at least one due ET weekday, the operator matrix includes each of SPY, QQQ, and IWM for every due expected date in the storing window, and each of those cells is classified exactly one of present, missing, or unreadable. | test |
| **AC-2 (SB)** | S1 | Given every due expected identity holds a loadable live paid-vendor session book, the matrix classifies all of them present and the audit command exits 0. | test |
| **AC-3 (SB)** | S1 | Given exactly one due expected identity has no session book and the others are present live paid books, that cell is missing and the other due cells remain present. | test |
| **AC-4 (SB)** | S4 | Given a due identity whose stored body cannot be loaded, the cell is unreadable and is not classified missing and is not classified present. | test |
| **AC-5 (SB)** | S5 | Given symbol S has a present live paid book on due date D1 and is missing on later due date D2, the D2 row’s last-readable identity is S on D1 (on or before D2). | test |
| **AC-6 (SB)** | S5 | Given symbol S has no live paid book on or before due date D, that row’s last-readable is an honest none — not a fabricated date, not a seed/conformance fixture identity, not another symbol’s date. | test |
| **AC-7 (SB)** | S4 | An ET Saturday or Sunday for SPY, QQQ, or IWM is not classified missing, does not emit a hole warning, and does not by itself make the audit command exit non-zero. | test |
| **AC-8 (SB)** | S4 | On an eligible ET weekday before 16:00 America/New_York, that calendar date’s SPY/QQQ/IWM identities are not yet due: they are not classified missing, and they do not emit a hole warning, and they do not by themselves fail the audit. | test |
| **AC-9 (SB)** | S2 | On an eligible ET weekday at or after 16:00 America/New_York, that calendar date’s SPY/QQQ/IWM identities are due (they appear in the due matrix). | test |
| **AC-10 (SB)** | S4 | A seed/conformance fixture identity is absent from the expected set and does not classify any live due date as present. | test |
| **AC-11 (SB)** | S4 | When the session archive is not storing, the operator outcome is store-not-storing — not a grid of missing cells, not an all-present pass — and the audit command exits non-zero as not-storing. | test |
| **AC-12 (SB)** | S4 | Eligible ET weekdays from before this environment’s archive was storing are not classified missing. | test |
| **AC-13 (SB)** | S4 | A reconstructed or flat-file artifact occupying a due identity is not classified present as a live paid-vendor session book; the audit command does not exit 0 on the strength of that artifact. | test |
| **AC-14 (SB)** | S4 | The coverage path does not insert a reconstructed or flat-file artifact into the session archive as a live paid book. | test |
| **AC-15 (SB)** | S2 | After 16:00 ET, a due missing identity causes exactly one structured operator warning for that `(symbol, ET date)` that names the symbol, the ET date, and missing. | test |
| **AC-16 (SB)** | S2 | After 16:00 ET, a due unreadable identity causes exactly one structured operator warning for that `(symbol, ET date)` that names unreadable (the missing wording is not reused as the only signal). | test |
| **AC-17 (SB)** | S2 | Given two due identities missing on the same date, two identity-keyed warnings fire (one per `(symbol, ET date)`), not a single warning that omits which symbol failed. | test |
| **AC-18 (SB)** | S2 | After the one warning for `(symbol, D)` has fired, further coverage checks in the same process emit no additional warning for that same identity. | test |
| **AC-19 (SB)** | S2 | Before 16:00 ET, today’s eligible identities produce no hole warning. | test |
| **AC-20 (SB)** | S3 | A named archive-coverage audit command is listed with the API crate’s existing research commands; the name reads as coverage/audit of session books, not as fetch, backfill, or score-lab. | review |
| **AC-21 (SB)** | S3 | The audit command prints the same present / missing / unreadable / not-yet-due / ineligible / not-storing classifications the operator matrix uses for the same clock and store. | test |
| **AC-22 (SB)** | S3 | Given a planted missing due expected book, the audit command exits non-zero. | test |
| **AC-23 (SB)** | S3 | Given a planted unreadable due expected book, the audit command exits non-zero. | test |
| **AC-24 (SB)** | S3 | When coverage cannot be computed, the audit command exits non-zero as a compute failure, and the operator outcome is coverage unavailable/failed — not an all-present matrix. | test |
| **AC-25 (SB)** | S6 | Matrix derivation, checkpoint warning, and audit each complete with **zero vendor calls** on present, missing, unreadable, not-storing, and compute-failure paths. | test |
| **AC-26 (SB)** | S6 | A coverage read or audit run does not write a session book and does not start an ensure/fill for a missing identity. | test |
| **AC-27 (SB)** | S6 | If coverage derivation, warning emission, or the audit command fails, trader bundle, scan, SSE, and ensure still succeed. | test |
| **AC-28 (SB)** | S6 | For the same market inputs, opportunity score, tier, and state fingerprint are byte-identical with coverage on vs off and with coverage succeeding vs failing. | test |
| **AC-29 (SB)** | S6 | No trader-facing route, nav item, or screen is added or changed. | review |
| **AC-30 (SB)** | S6 | A trader origin cannot obtain the coverage matrix (refused the same way existing operator/research diagnostics are refused on that origin). | test |
| **AC-31 (SB)** | S6 | When an operator token is required, a coverage read without it is refused and returns no matrix. | test |
| **AC-32 (SB)** | S7 | Local audit output states it is not hosted production coverage; deleting surrounding prose cannot remove that standing from the emitted result. | test |
| **AC-33 (SB)** | S7 | Canary secret values present in the environment do not appear in matrix, warning, or audit output. | test |
| **AC-34 (SB)** | S4 | Not-storing, missing-book, unreadable-book, and coverage-compute-failure outcomes are distinguishable in operator/audit results without reading source. | test |
| **AC-35** | S6 | This ship does not add tape capture, object-storage migration, a paid monitor, or volume-threshold runbook automation. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent money/honesty failures:** class splits (AC-1–4, AC-7–13,
  AC-34), last-readable honesty (AC-5/6), checkpoint timing (AC-8/9/19), one-warning-per-identity
  and no flood (AC-15–18), audit exit on planted hole/unreadable/compute-fail (AC-21–24), zero
  vendor and no fill (AC-25/26), desk isolation and score identity (AC-27/28), trader-origin and
  token refuse (AC-30/31), local≠hosted and secret-egress (AC-32/33). These can die under a
  “helpful” fetch or a fixture counted as present while demos still look green.
- **`review` owns** command discoverability/naming (AC-20), absence of trader UI (AC-29), and
  non-absorption of tape/object-store/monitor/volume (AC-35).
- Prefer **one** hermetic pass: fixture store with a due complete trio → audit 0 → plant one miss
  → audit non-zero + one warning after injected 16:00 ET → repeat check → still one warning →
  plant unreadable → distinct class + non-zero → weekend/before-16:00 not missing → fixture and
  reconstructed do not pass as present → not-storing distinct → zero vendor counter on every arm
  → desk/score untouched — not a named micro-harness per row.
- GATE Q must show **both** a rejecting planted hole and an accepting complete present matrix.
  A suite that only ever exits 0 has not proved the gate.
- No DOM harness. Observability is operator matrix / warning / command exit / vendor-call
  absence / desk + score identity.
- Merge CI is **not** required to audit production. GATE Q runs the command against fixtures.

**Ship-blocking set:** AC-1–AC-34. AC-35 is a required scope-honesty check (`review`).

### Product decisions locked in this position

1. **Audience = operator of the paid session archive.** Trader UI is out.
2. **Names = SPY, QQQ, IWM.** No universe expansion.
3. **Eligibility = ET weekdays** in America/New_York; weekends ineligible.
4. **Checkpoint = 16:00 America/New_York.** Same-day due clock; not-yet-due is not missing.
5. **Storing window** starts the first ET weekday this environment was actually storing — the
   21 Aug “unset root” days must not count as missing.
6. **Present = live paid-vendor session book only.** Fixture and reconstructed never satisfy it.
7. **One structured warning per `(symbol, ET date)` per process** after checkpoint; missing and
   unreadable are different warnings.
8. **Audit command is the structural fail-the-hole gate**; exit 0 only on all-due-present.
9. **Running service exposes the matrix to an authenticated operator** (not CLI-only). Transport
   (existing operator diagnostics vs sibling research read) is architecture’s choice; both must
   stay operator-token, zero-vendor, unlinked from trader UI.
10. **Coverage never fetches, fills, or writes.**
11. **Local audit is not production coverage.**
12. **Do not absorb** tape, object store, volume runbooks, paid monitors, or lab UI.
13. Architect names mechanism, command spelling (if renamed), and warning sink. Product binds the
    outcomes and clocks above.

### Binding constraints restated

- **`operator-vs-trader-path-separation`:** coverage, warning, and audit stay on the
  operator/research side; unlinked from trader UI; read-only; no vendor fetch on a coverage read.
- **`best-effort-isolated-or-null`:** coverage/warning failure never fails bundle / scan / SSE /
  ensure.
- **`additive-keeps-score-byte-identical`:** coverage is never a scoring input.
- **`absent-is-not-none`:** missing ≠ unreadable ≠ not-storing ≠ weekend ineligible ≠ not-yet-due
  ≠ fixture ≠ none-last-readable.
- **`no-secrets-in-image`:** no secrets in artifacts or coverage output.
- **`cited-code-is-verified-not-assumed`:** this position does not assert reusable source
  locations. Mechanism reuse is an architecture assumption below.
- **`structural-over-prose-enforcement`:** a planted missing due book must fail the audit; a
  reconstructed body must not count as present. Poison must go red.
- **`local-evidence-is-not-hosted-evidence`:** a local audit receipt is not production coverage.
- **`score-change-is-deliberate-and-measured`:** this feature authorizes nothing on the live score.
- Massive license: stored books remain our research, never redistributed on a trader route.

## Risks I see

- **Not-yet-due collapsed into missing.** A daytime audit would always fail today’s trio and train
  people to ignore the gate. AC-8/19.
- **Weekend collapsed into missing.** Same false-alarm path. AC-7.
- **Fixture counted as present.** A 2020-01-02 SPY seed would green a live hole. AC-10/6.
- **Reconstructed counted as present.** The exact failure the 26 Aug audit forbade: backtests look
  complete when the live paid book was never kept. AC-13/14.
- **Store-not-storing reported as nine missing books.** Wrong diagnosis; looks like ensure failed
  when the archive was never writing. AC-11/12/34.
- **Warning flood.** Re-emitting on every check recreates the permission-denied incident in a new
  costume. AC-15/18.
- **One combined warning for all three names.** Operator cannot tell which paid day was lost.
  AC-17.
- **Helpful vendor fetch or ensure kick-off** on a coverage read — bills Options, races ensure,
  and can still miss history. AC-25/26.
- **CLI-only matrix.** Hosted production would stay silent until someone remembers to run a
  command. Locked: running service exposes the matrix; CLI is the audit gate, not the only notice.
- **Checkpoint too late.** Waiting until evening increases the chance the 48-slot ring has already
  dropped the only recoverable copy. 16:00 ET is the lock; if architecture shows ensure still
  in-flight then, that is an R2 conflict — not a quiet slide to next midnight.
- **Checkpoint too early.** False missing while ensure’s first retry window has not run. Same R2
  rule: evidence, not silence. I will not silently drop same-day notice.
- **Local receipt quoted as production.** AC-32.
- **Trader-path creep** (a “session books” widget). AC-29/30.
- **Program absorption** (tape, object store, disk runbooks). AC-35.
- **Unobservable criteria.** If synthesis rewrites rows into “coverage is correct” intentions that
  require reading source, those rows should be cut or restated — not kept for theater.

## Assumptions I'm making about the other two lanes

- The architecture lane can derive the coverage matrix from the **already-shipped** session-archive
  list/load path with a hard **vendor-call count of zero**, including on miss, unreadable,
  not-storing, and compute-failure, so AC-25 is implementable without a new vendor client.
- The architecture lane can inject an America/New_York clock so 16:00 ET due vs not-yet-due is
  testable without waiting for wall time, and so weekend vs weekday follows that zone — not the
  host’s local zone.
- The architecture lane can name **one** operator-token, zero-vendor, trader-unlinked transport for
  the live matrix (existing operator diagnostics **or** a sibling research read). I am **not**
  picking which; I am assuming one of those two families can carry the matrix without a trader
  route. If neither can without a trader-linked surface, that is an R2 conflict, not a quiet
  CLI-only narrowing.
- The architecture lane can emit **exactly one** structured warning per `(symbol, ET date)` for the
  life of the process after checkpoint, distinct in wording for missing vs unreadable, without
  paging vendors or a paid monitor.
- The architecture lane can add one named research command on the existing API crate runner whose
  exit code is 0 only when every due expected identity is a live paid present book.
- The architecture lane can exclude seed/conformance fixture identities from the expected set and
  can distinguish a live paid-vendor session book from a reconstructed/flat-file artifact so AC-10
  and AC-13/14 are enforceable by construction, not prose.
- The architecture lane can observe “this environment was not storing yet” so pre-storing dates are
  not a missing grid (the 21 Aug unset-root case), without inventing expected books for days the
  store could not keep.
- The architecture lane can keep coverage **off** ensure, bundle, scan, and SSE: a coverage failure
  does not fail those paths and does not start a fill. If coverage cannot be isolated, that is an
  R2 conflict — I will not drop desk isolation to ship the matrix.
- The architecture lane will verify **live Rust** session-archive / ensure / operator-diagnostic
  surfaces — not Python-era archive paths and not the 26 Aug audit prose as an oracle
  (`cited-code-is-verified-not-assumed`). This position does not assume filenames, types, or
  command flags.
- The architecture lane can prove score / tier / fingerprint byte-identity without Massive
  credentials in the build environment.
- The UX / tech-writer lane will design **no trader UI**. If UX proposes a dashboard, nav item,
  ticker widget, or in-app archive browser, that contradicts this Out list and
  `operator-vs-trader-path-separation`, and I will raise it as a conflict at R2.
- The UX / tech-writer lane owns exact operator wording: class labels, warning text, audit matrix
  print, not-yet-due vs missing vs unreadable vs not-storing vs coverage-failed, and the
  local/not-production standing. I own only that those distinctions exist, are mutually
  distinguishable as words, and that reconstructed/fixture cannot read as present.
- The UX / tech-writer lane can keep command and receipt copy from implying a hosted production
  pass, a score-change authorization, or a trader-facing “history” product.
