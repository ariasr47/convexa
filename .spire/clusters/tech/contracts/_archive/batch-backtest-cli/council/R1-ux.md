# R1 — ux position: batch-backtest-cli

## Position

### 0. What the surface actually is (and what it is not)

There is **no trader screen here.** The BRIEF is explicit: P3 is a research CLI that lists/loads
dated stored chain snapshots and emits an artifact report. It does **not** add a trader UI, change
live scoring, or buy hist-chain products. `[operator-vs-trader-path-separation]` is HARD.

So the user-facing surface I own is exactly two coupled artifacts (plus a hard negative space):

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S1 | **CLI stdout** — progress + terminal summary for one batch-replay run | the operator, while the shell is open | every printed word, state wording, absence literals, banned terms |
| S2 | **Dated research report artifact** (console twin + durable file under research output) | the operator later; any future council that quotes the run | every label, framing block, metric caption, absence literal; what the report is allowed to claim |
| S3 | **Negative space — trader product** | every trader on Ticker / Settings / Ask-AI / Scanner / Positions / Landing / shell | what must **never** appear: no route, nav, chip, panel, badge, or Ask-AI disclosure for replay / backtest / stored-chain browse |

**Design-system note (binding, for SPEC §4):** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is
`Status: SET` (The Curvature Terminal). This feature touches **no dashboard surface** — no route, no
component, no token spend. SPEC §4 must carry **`NO_UI_CHANGE`** and must not restate the token table.
I request **no amendment** to `DESIGN_SYSTEM.md`. Honesty rules from the canon still bind the **words**
on S1/S2 (never present a frozen/replayed number as live; never overclaim). Anyone proposing a
`/_ops` chain browser, a Ticker "Backtest" widget, a Settings toggle, or an Ask-AI "we measured your
score" line is re-scoping — raise it as an R2 `product` conflict, do not fold it in.

### 1. Intended user, primary job, information structure, vocabulary

- **Intended user:** the operator / desk owner (research path), not the anonymous or signed-in trader.
- **Primary job:** *"On the exact paid books we already keep, does our score / structure / GEX path
  produce a measurable read — without pretending this run is live, and without treating the report as
  permission to change the live score?"*
- **Information structure (S1/S2):**
  1. Standing / framing block first (what this run is).
  2. Corpus identity (symbols, date range / split rule as named by architect, snapshot counts).
  3. Per-snapshot / per-symbol replay outcomes (or honest absence).
  4. Aggregate research summary (facts only).
  5. Closing reminder: measurement only — authorizes nothing on the live path.
- **Failure I am designing against:** a replayed opportunity score (or GEX figure) pasted into a
  trader screenshot, a Live chip, or a sentence that says the live score "should" move. That is the
  defining copy failure for this feature.

**User vocabulary — closed term set. These are the only words the output may use for these things:**

| Concept | Approved term | **Banned** (asserts meaning the data cannot carry) |
|---|---|---|
| What the CLI did | **replay from stored snapshot** / **research replay** | "live backtest", "live run", "market feed", "real-time score" |
| The input book | **stored chain snapshot** · **captured at \<UTC\>** | "live chain", "current book", "today's options" (unless the as_of really is today — still not "live") |
| Provenance token from capture | wire/lineage `source: live_massive` \| `fixture` (allowed — **lineage**, not a market claim) | rendering that token as a **Live** badge/chip or the word "Live" next to a number |
| The output document | **research report** · **replay artifact** | "results dashboard", "scorecard that updates production", "recommendation" |
| What the numbers are | **replayed analytics** on a **stored book** | "live score", "current tier", "desk reading" |
| Empty corpus / capture off | **no stored snapshot** family (see §3) | "no options", "empty chain", "market closed", silent success |
| Authorization | **Authorizes: nothing** on live score / tier / gate / fingerprint | "should change the live score", "adopt", "roll out", "promote weights" |
| Relation to score-lab | **distinct from score-lab** (diary ranking) — this replays **stored chains** | language that collapses the two tools into one "lab result" that updates production |

### 2. Binding framing (must ship on every successful report)

`(a)` **Standing block is first** on stdout and in the artifact, before any replayed number:

```
RESEARCH REPLAY — STORED SNAPSHOTS · NOT LIVE
  Corpus:      <symbol list or count> · <as_of span the architect's split names>
  Snapshots:   <n loaded> · zero Massive calls this run
  Framing:     Replayed compute on books we already captured. Not a live desk feed.
  Authorizes:  nothing. No live score, tier, gate, weight, or fingerprint change
               on the strength of this report.  [score-change-is-deliberate-and-measured]
```

`(b)` **No Live badge on replayed numbers.** A successful per-snapshot block may show
`stored` / `captured at <UTC>` / `loaded from store · no vendor call`. Closed lineage
`source: live_massive` or `source: fixture` is **allowed** as provenance (same ruling as
`chain-snapshot-capture` AC-25) and must **never** be rendered as a Live chip, "● Live", or any
label that means "this quote is live."

`(c)` **The report does not say the live score should change.** No adoption verb, no "next step:
update opportunity_score", no "production recommendation." Facts about replayed metrics only.
If a human write-up wants a score-change feature later, that is a **different** BRIEF under
`[score-change-is-deliberate-and-measured]` — this artifact must not authorize it by tone.

`(d)` Repeat one closing line at the bottom of stdout:
`RESEARCH REPLAY — NOT LIVE · Authorizes: nothing on the live score path.`

### 3. States (CLI + report) — complete matrix

There is no dashboard component matrix. These are the **operator-visible run states**. Empty,
no-snapshot, and error must stay **visibly distinct** (`[absent-is-not-none]`).

| State | When | Operator sees | Must not happen |
|---|---|---|---|
| **default / success** | ≥1 stored snapshot loaded; replay completed; report written | Standing block → corpus identity → replayed figures with `captured at` / stored framing → closing "Authorizes: nothing" | Live badge; Massive call; language that the live desk updated |
| **working / loading** | Long multi-symbol / multi-day replay in flight | Progress lines naming phase (list → load → replay → write) and counts; no partial report presented as final | A truncated artifact that looks like a finished measurement |
| **empty corpus** | Capture off, store configured-empty, or symbol set has **zero** stored snapshots after an honest list | Exact **no-stored-snapshot family** (below); exit is an honest empty; **no report that claims a measurement** | Silent live Massive fetch; "0 opportunities"; trader-facing empty `—` |
| **no stored snapshot (miss)** | List/load miss for a requested symbol or dated identity | Exact miss copy from capture: **`no stored snapshot for <SYMBOL>`** (optional ` at <as_of>` when a dated identity was requested) | "empty chain", "no options", "unavailable this cycle", fabricated book |
| **empty book (distinct)** | A snapshot **exists and loads**, but the stored chain book itself has no contracts / is market-empty **as stored** | Wording that names **empty stored book** (or architect's closed token for that case) — **not** the miss string | Collapsing into `no stored snapshot` (that would lie: we *did* have a snapshot) |
| **error — unreadable** | Store fault / corrupt blob / capture-not-storing | **`stored snapshot unreadable: <reason>`** family (capture's store-fault detail); no measurement artifact | HTTP error on the trader desk; treating fault as empty miss |
| **error — replay failed** | Snapshot loaded but `compute_analytics_from_vendor` (or equivalent) failed for that identity | Named replay error for that `(symbol, as_of)`; siblings may still succeed; report marks the row failed | Presenting the row as a zero score; falling back to live vendor |
| **offline (N/A as SSE)** | Not a trader stream feature | — | Inventing a "Live offline" chip for research CLI |
| **stale (research sense)** | Report always carries historical `as_of`; "stale" is the **point**, not a degrade | Every figure tied to its `captured at` / `as_of` | Relabeling old as_of as current/live |

**Closed miss / fault vocabulary (reuse capture — do not invent a second family):**

| Literal (exact) | Means |
|---|---|
| `no stored snapshot for <SYMBOL>` | Miss — nothing stored for that symbol (list empty / identity absent). Optional ` at <as_of>`. |
| `stored snapshot unreadable: <reason>` | Store fault — not the same as miss. |
| (architect-named) empty-stored-book token | Snapshot present; book empty as stored — **not** a miss. |

Banned competing empties on this CLI: `n/a`, blank, bare `0`, `no options`, `empty chain`, trader
`—`, `unavailable this cycle` (that last string is a **Ticker cycle** literal — wrong register here).

### 4. What must never appear on Ticker / Settings / Ask-AI (hard negative space)

Per BRIEF + `[operator-vs-trader-path-separation]` + capture's trader-UI ban, this feature adds:

- **No** Ticker widget, Command Deck control, badge, or freshness line about batch replay / backtest.
- **No** Settings panel for "run backtest", corpus browse, or Massive hist-chain upsell.
- **No** Ask-AI disclosure, prompt clause, or recommendation footnote that cites this report as a
  reason the live score or tier moved (it must not have moved).
- **No** Scanner column, Positions track-record cell, or Landing CTA for P3.
- **No** Live badge/chip on any number that originated from this replay — including if someone later
  pastes figures into a doc that sits beside the app.

Structural proof belongs to architect/FE empty-diff / path guards; **copy proof** is: zero new
trader-facing strings in dashboard copy tables for this feature. SPEC marks **`NO_UI_CHANGE`**.

### 5. Microcopy integrity rules (defining failure mode)

1. Trace every printed number to a **replayed** field from a **loaded stored snapshot** (or mark it
   absent with the closed vocabulary). No orphan "score improved" claim.
2. Do not rename replayed `opportunity_score` into "live score", "desk score", or "validated score."
3. Do not label the run "backtest results" in a way that implies broker P&L or live fill truth —
   this is **analytics replay on captured books**, not a filled-trade backtest (outcomes join is
   out of scope per BRIEF considered list).
4. Tooltips/glossary: N/A on trader UI. Inside the report, a short legend may define split names and
   metric labels — definitions explain; they do not invent new metrics.
5. Relationship to **score-lab**: score-lab ranks the **digested structure diary**; this CLI replays
   **stored chains**. Report chrome must not say this run "is score-lab" or silently replace it.
   Architect names flags / coexistence; I own that the operator-facing title does not collapse them.

### 6. Acceptance criteria → states → `Verify by`

These are the user-visible / operator-visible criteria I own. Marks land in synthesized SPEC §3
`Verify by` per `spire-tech-risk-based-verify`. Frontend implements required cases only where a
trader surface exists — here the "frontend" of the feature is CLI render + the hard absence of
trader UI.

| ID | Acceptance criterion | State(s) | Verify by | Why this mark |
|---|---|---|---|---|
| UX-1 | SPEC §4 carries **`NO_UI_CHANGE`**; no new trader route, nav, Settings, Ask-AI, Ticker, Scanner, or Positions affordance for batch replay | negative space | **test** | Silent addition of a trader string/route is invisible on a CLI-only review pass; structural empty-diff / path scan |
| UX-2 | Standing block is the **first** block of stdout and of the report artifact on every **successful** run | default / success | **test** | Hedge drop on one branch is negative space |
| UX-3 | Standing / closing copy states **NOT LIVE**, **zero Massive calls this run**, and **Authorizes: nothing** on live score/tier/gate/fingerprint | default / success | **review** (wording) + **test** (required tokens present) | Exact prose is reviewable; required token presence silently regresses |
| UX-4 | No Live badge/chip and no label meaning "this quote is live" appears on any replayed number; `source: live_massive` may appear only as lineage/provenance | default / success | **test** | A Live mark on stored replay is the defining integrity failure; scannable |
| UX-5 | Report / stdout never contains an adoption verb or sentence that the live score **should** change | all success paths | **review** | Visible intentional posture; banned-phrase scan may assist but wording judgment is review |
| UX-6 | Requesting a symbol with no snapshots prints exactly **`no stored snapshot for <SYMBOL>`** (optional ` at <as_of>`) and does not call Massive | empty corpus / miss | **test** | Exact-string invariant from capture; silent rewrite to "empty chain" is a lie |
| UX-7 | Store fault prints **`stored snapshot unreadable: <reason>`** (or capture-equivalent) and is distinguishable from UX-6 | error — unreadable | **test** | Miss vs fault collapse is `[absent-is-not-none]` |
| UX-8 | Empty **stored book** (snapshot present, book empty) uses a distinct literal from UX-6 — never the miss string | empty book | **test** | Same invariant; requires both fixtures |
| UX-9 | Replay failure for one identity is labeled a replay error for that identity; not rendered as score `0` and not a vendor fallback | error — replay failed | **test** | Zero-as-failure is invisible in a pasted table |
| UX-10 | Honest empty corpus (capture off / empty store) produces **no** measurement artifact that could later be quoted as "we measured and found nothing scored" | empty corpus | **test** | Empty-artifact-as-result is the worst research failure mode |
| UX-11 | Every replayed figure block carries `captured at <UTC>` (or equivalent as_of) and stored/no-vendor framing | default / success | **test** | Detached numbers become live claims when timestamps drop |
| UX-12 | Progress lines during long runs name phase + counts; partial output is not titled as the final research report | working | **review** | Visible, low silent-regression risk |
| UX-13 | Operator-facing title/chrome distinguishes this tool from **score-lab** (chain replay vs diary ranking) | default / success | **review** | Naming/ordering intentional |
| UX-14 | Banned trader-cycle literals (`unavailable this cycle`, Live offline chip copy, sim `—` as miss) do not appear as CLI absence copy | all | **test** | Closed-vocabulary scan; wrong-register copy silently lands from shared helpers |

## Risks I see

1. **`source: live_massive` is misread as Live.** Capture already allowed the lineage token; a renderer
   that pretty-prints it as a Live chip reintroduces the banned claim. UX-4 exists for this.
2. **Miss / empty-book / unreadable collapse into one "no data" string.** That is exactly the
   fabricated claim `[absent-is-not-none]` forbids — especially dangerous when the next "fix" is
   a live Massive fetch.
3. **The report's measurement tone drifts into authorization.** A single closing sentence like
   "consider raising wall weight" turns P3 into an unmeasured score change. UX-5 / standing block.
4. **Trader UI creep** under a friendly `/_ops` or Settings "Research" tab. BRIEF forbids it; my
   `NO_UI_CHANGE` position assumes the other lanes do not reopen it without GATE Z.
5. **Confusion with score-lab.** Operators will paste both artifacts into the same weekly note; if
   titles rhyme too hard, a diary AUC and a chain-replay figure get cited as one "lab says ship it."
6. **My own failure mode, named:** inventing dashboard states or metric labels the BRIEF does not
   support. I have not named CLI flags, split math, or endpoint shapes — those are architect/PM. If
   I authored a live-score recommendation in this file, withdraw it.

## Assumptions I'm making about the other two lanes

- **Architect keeps this off the trader request path** and guarantees **zero Massive calls on
  replay**, including on miss/empty — so my "loaded from store · no vendor call" and "honest empty"
  copy are true, not aspirational.
- **Architect reuses the capture miss/fault detail family** (`no stored snapshot for <SYMBOL>`,
  `stored snapshot unreadable: <reason>`) rather than inventing a second vocabulary — UX-6/UX-7 bind
  to those exact strings.
- **Architect exposes a distinguishable empty-stored-book outcome** (snapshot loaded, book empty)
  separate from miss — without that signal UX-8 cannot be implemented honestly.
- **Architect names how this CLI coexists with `score-lab`** (does not silently replace it); I assume
  a distinct command/module name so UX-13 is not lying.
- **Architect/PM define the time-based split rule and multi-symbol selection** as named, printable
  labels I can put in the standing block — I will not invent split math or default windows.
- **PM's AC set includes explicit ship-blocking rows** for: no trader UI, no live score/tier/
  fingerprint write, no Massive on replay, and report-does-not-authorize-score-change — so my copy
  claims are backed by verified product criteria, not only UX prose.
- **PM does not scope a trader-visible backtest surface, hist-chain purchase, or live-score change**
  into this feature; if PM's position does, I will file an R2 `product` conflict rather than design it.
- **Nobody proposes folding replayed numbers into Ask-AI context or Ticker tiles** in this BRIEF's
  window; DESIGN_SYSTEM `NO_UI_CHANGE` / no-amendment assumes both other lanes agree.
- **Backend emits per-identity success vs replay-error vs miss vs unreadable** in a form the CLI
  renderer can map 1:1 onto the state table — a single boolean "had data" is not enough for
  `[absent-is-not-none]`.
