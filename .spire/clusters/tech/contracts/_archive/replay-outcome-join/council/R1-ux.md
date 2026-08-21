# R1 — ux position: replay-outcome-join

## Position

### 0. What the surface actually is (and what it is not)

There is **no trader screen here.** The BRIEF is explicit: join next-session stock-bar labels
(already paid via `join-outcomes`) to **replayed** scores from stored options books
(`batch-backtest`), emit a dated research report, and stop. It does **not** change the live
score, buy hist-chain, or add a trader UI. `[operator-vs-trader-path-separation]` is HARD.

So the user-facing surface I own is exactly two coupled artifacts (plus hard negative space):

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S1 | **CLI stdout** — progress + terminal summary for one join/measure run | the operator, while the shell is open | every printed word, state wording, absence literals, banned terms |
| S2 | **Dated research report artifact** (console twin + durable file under research output) | the operator later; any future council that quotes the run | every label, framing block, rate caption, absence literal; what the report is allowed to claim |
| S3 | **Negative space — trader product** | every trader on Ticker / Settings / Ask-AI / Scanner / Positions / Landing / shell | what must **never** appear: no route, nav, chip, panel, badge, or Ask-AI disclosure for this join / ranking measurement |

**Design-system note (binding, for SPEC §4):** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is
`Status: SET` (The Curvature Terminal). This feature touches **no dashboard surface** — no route, no
component, no token spend. SPEC §4 must carry **`NO_UI_CHANGE`** and must not restate the token table.
I request **no amendment** to `DESIGN_SYSTEM.md`. Honesty rules from the canon still bind the **words**
on S1/S2 (never present a frozen/replayed number as live; never overclaim). Anyone proposing a
`/_ops` outcome browser, a Ticker "Score worked?" widget, a Settings research toggle, or an Ask-AI
"we measured your score against next-day moves" line is re-scoping — raise it as an R2 `product`
conflict, do not fold it in.

### 1. Intended user, primary job, information structure, vocabulary

- **Intended user:** the operator / desk owner (research path), not the anonymous or signed-in trader.
- **Primary job:** *"On the exact paid Options books we already keep, did the replayed opportunity
  score rank the next-session stock move — without pretending this run is live, without collapsing
  missing labels into empty books, and without treating the report as permission to change the live
  score?"*
- **Information structure (S1/S2):**
  1. Standing / framing block first (what this run is — replay join, not live).
  2. Corpus + label provenance (replayed-score source, label source, horizons, counts).
  3. Paired rows (replayed score × 1d/5d label) or honest absence per row.
  4. Aggregate ranking rates — **each carrying horizon + n** (facts only; no verdict).
  5. Closing reminder: measurement only — **Authorizes: nothing** on the live path.
- **Failure I am designing against:** a pasted AUC/lift/rate that (a) looks like a live desk claim,
  (b) collapses `no label` into `empty book` or `no snapshot`, (c) omits horizon or n so a thin
  cell reads as a product ruling, or (d) says the score "is good / works / should ship." That is the
  defining copy failure for this feature. Withdrawing an undefendable "score is good" claim is a
  success of this council.

**User vocabulary — closed term set. These are the only words the output may use for these things:**

| Concept | Approved term | **Banned** (asserts meaning the data cannot carry) |
|---|---|---|
| What the CLI did | **replay–outcome join** / **research join** / **paired replayed score × forward label** | "live backtest", "live validation", "production A/B", "market feed" |
| The score side | **replayed score** on a **stored chain snapshot** · `captured at <UTC>` | "live score", "current tier", "desk reading", "validated score" |
| The label side | **forward stock-bar label** · **session-count horizon** (`1d` / `5d`) from join-outcomes / Stocks aggs | "Options outcome", "P&L", "fill result", "trade return" |
| Provenance | lineage tokens for snapshot source + label source (allowed as **lineage**, not market claims) | rendering lineage as a **Live** badge/chip next to a number |
| The output document | **research report** · **join artifact** | "scorecard", "results dashboard", "recommendation", "go/no-go" |
| Ranking rates | **ranking rate / metric on this slice** — always with **horizon + n** | "accuracy", "edge", "works", "predictive", "winner", "score is good" |
| Missing forward label | **`no label`** (exact family below) | "empty book", "no snapshot", "no options", bare `0`, trader `—` |
| Missing stored book | **`no snapshot`** / reuse batch-backtest miss family | collapsing into `no label` |
| Empty stored book | **`empty book`** / reuse batch-backtest empty-book family | collapsing into `no label` or `no snapshot` |
| Authorization | **Authorizes: nothing** on live score / tier / gate / fingerprint / weight | "should change the live score", "adopt", "roll out", "promote weights", "ship the fix" |
| Relation to siblings | **joins** batch-backtest replay + join-outcomes labels; **distinct from** score-lab diary ranking | language that collapses all three into one "lab says update production" |

### 2. Binding framing (must ship on every successful report)

`(a)` **Standing block is first** on stdout and in the artifact, before any paired number or rate:

```
RESEARCH JOIN — REPLAYED SCORES × FORWARD LABELS · NOT LIVE
  Corpus:      <symbol / as_of span the architect names> · horizons <1d,5d or as run>
  Inputs:      replayed scores from stored snapshots · labels from join-outcomes (Stocks aggs)
  Framing:     Measurement on books we already paid for. Not a live desk feed. Not Options API.
  Authorizes:  nothing. No live score, tier, gate, weight, or fingerprint change
               on the strength of this report.  [score-change-is-deliberate-and-measured]
```

`(b)` **No Live badge on replayed numbers or rates.** Success rows may show
`stored` / `captured at <UTC>` / `loaded from store`. Label rows may show label provenance
(join-outcomes artifact path / Stocks aggs when fetched for missing labels). Closed lineage tokens
are **allowed as provenance only** and must **never** render as a Live chip, "● Live", or any label
that means "this quote is live."

`(c)` **The report does not say the score is good, or that the live score should change.** No
adoption verb, no "next step: update opportunity_score", no "production recommendation", no
"AUC proves the composite works." Facts about paired rows and rates only — and every rate carries
its **horizon** and **n**. If a human write-up wants a score-change feature later, that is a
**different** BRIEF under `[score-change-is-deliberate-and-measured]` — this artifact must not
authorize it by tone. Prior score-lab evidence (e.g. digested AUC 0.467) may be **cited as prior
measurement context** only when the artifact also states this run's own horizon + n; it must not be
restated as a verdict that this join "confirms failure" or "confirms success."

`(d)` Repeat one closing line at the bottom of stdout:
`RESEARCH JOIN — NOT LIVE · Authorizes: nothing on the live score path.`

`(e)` **Rates carry assumptions in-band** (`[model-read-carries-its-assumptions]`): every printed
ranking rate / AUC / lift / precision-style figure is inseparable from `horizon=<…>` and `n=<…>`
(and any floor/under-powered marker architect/PM already use in research). A detached `0.62` with
no horizon and no n is a fabricated product claim — withhold it rather than print it naked.

### 3. States (CLI + report) — complete matrix

There is no dashboard component matrix. These are the **operator-visible run states**.
`no label`, `no snapshot`, and `empty book` must stay **visibly distinct**
(`[absent-is-not-none]`). BRIEF Decision impact names that triangle explicitly.

| State | When | Operator sees | Must not happen |
|---|---|---|---|
| **default / success** | ≥1 paired (replayed score, forward label) row; report written | Standing block → provenance → paired rows and/or aggregates with horizon+n → closing Authorizes line | Live badge; Options API call; "score is good"; rate without horizon or n |
| **working / loading** | Long multi-symbol / multi-day join in flight; optional Stocks aggs fetch for **missing labels only** | Progress lines naming phase (load replay corpus → load/join labels → pair → write) and counts; if Stocks aggs run, say **labels only · Stocks aggs · not Options** | A truncated artifact titled as the final measurement; silence that looks like a hang; implying an Options fetch |
| **empty / no pairs** | Corpus or labels yield **zero** honest pairs after an honest attempt | Named empty: which side failed (no replay rows / no labels / no overlap at this horizon); **no** measurement artifact that can be quoted as "we measured and the score failed/succeeded" | Silent Options fetch; fabricating pairs; writing a fake AUC 0.5 |
| **no snapshot (miss)** | Requested symbol/identity has no stored chain snapshot | Exact miss family from batch-backtest/capture: **`no stored snapshot for <SYMBOL>`** (optional ` at <as_of>`) — **not** `no label`, **not** `empty book` | "no label"; live Massive Options fill-in |
| **empty book (distinct)** | Snapshot exists and loads, but stored chain has no contracts / is market-empty as stored | Exact empty-book family: **`empty stored book for <SYMBOL>`** — **not** miss, **not** `no label` | Collapsing into miss or unlabeled |
| **no label (distinct)** | Replayed score row exists, but forward stock-bar label is missing / inapplicable for that horizon | Exact **`no label`** family (below) — carries symbol, as_of/horizon, and why unlabeled when known | Collapsing into miss or empty book; rendering as score `0` or rate contribution |
| **error — unreadable / join fault** | Store/artifact unreadable, corrupt replay row, or label artifact unusable | Named fault literal; siblings may continue when isolation allows; no success theater | HTTP error on the trader desk; treating fault as `no label` |
| **partial** | Some identities pair; some are miss / empty book / no label / fault | Each row keeps its **own** disposition literal; header notes partial; aggregates state which n they used | Dropping unlabeled rows silently from counts so n looks healthier than it is |
| **offline (N/A as SSE)** | Not a trader stream feature | — | Inventing a "Live offline" chip for research CLI |
| **stale (research sense)** | Report always describes historical as_of + forward label horizon; "stale" is the **point** | Every figure tied to `captured at` / as_of / horizon | Relabeling old as_of as current/live |

**Closed absence vocabulary (three-way — do not invent a fourth collapsing synonym):**

| Literal (exact / family) | Means |
|---|---|
| `no stored snapshot for <SYMBOL>` (+ optional ` at <as_of>`) | **no snapshot** — nothing stored for that identity. |
| `empty stored book for <SYMBOL>` (+ optional ` at <as_of>`) | **empty book** — snapshot present; book empty as stored. |
| `no label for <SYMBOL> at horizon <H>` (+ optional as_of / reason) | **no label** — replayed score side present (or attempted); forward stock-bar label absent for that horizon. |
| `stored snapshot unreadable: <reason>` | Store/replay-artifact fault — not miss, not unlabeled. |

Banned competing empties on this CLI: `n/a`, blank, bare `0`, `no options`, `empty chain`, trader
`—`, `unavailable this cycle` (Ticker-cycle register — wrong here), and any single "unavailable"
string shared across the three BRIEF states.

**Stocks-aggs-for-missing-labels (operator-visible honesty):** when the run fetches Stocks daily
aggs because labels are missing, progress/provenance must say so. It must **never** imply an
Options snapshot/API call. Zero Options API calls remains a copy claim that architect must make true.

### 4. What must never appear on Ticker / Settings / Ask-AI (hard negative space)

Per BRIEF + `[operator-vs-trader-path-separation]`, this feature adds:

- **No** Ticker widget, Command Deck control, badge, or freshness line about replay–outcome join.
- **No** Settings panel for "run join", corpus browse, or Massive hist-chain / Options upsell.
- **No** Ask-AI disclosure, prompt clause, or recommendation footnote that cites this report as a
  reason the live score or tier moved (it must not have moved) or as proof the score "works."
- **No** Scanner column, Positions track-record cell, or Landing CTA for this measurement.
- **No** Live badge/chip on any number that originated from this join — including if someone later
  pastes figures into a doc beside the app.

Structural proof belongs to architect/FE empty-diff / path guards; **copy proof** is: zero new
trader-facing strings in dashboard copy tables for this feature. SPEC marks **`NO_UI_CHANGE`**.

### 5. Microcopy integrity rules (defining failure mode)

1. Trace every printed number to a **replayed** field from a **loaded stored snapshot** and/or a
   **forward label** from join-outcomes / Stocks aggs — or mark it absent with the closed vocabulary.
   No orphan "score improved" / "score is good" claim.
2. Do not rename replayed `opportunity_score` into "live score", "desk score", "validated score",
   or "proven edge."
3. Do not label the run a filled-trade "backtest" or Options P&L study — labels are **next-session
   stock-bar** moves at session-count horizons, not option fills.
4. **Every rate carries horizon + n.** If either is missing, withhold the rate rather than invent
   a default horizon or silently reuse another cell's n (`[model-read-carries-its-assumptions]`).
5. **`no label` ≠ `no snapshot` ≠ `empty book`.** Three literals, three meanings; collapsing any
   pair is a fabricated claim (`[absent-is-not-none]`).
6. Tooltips/glossary: N/A on trader UI. Inside the report, a short legend may define horizons and
   rate names — definitions explain; they do not invent new metrics or a pass/fail bar unless PM
   supplies one as **printed facts beside values**, never as an emitted verdict that authorizes
   a live change (score-lab precedent: Evidence facts, not go/no-go).
7. Relationship to **score-lab** and **batch-backtest**: this feature **joins** replayed books to
   labels; it does not replace score-lab's diary ranking chrome, and it must not retitle itself as
   "score-lab" or "live Path-B." Architect names the CLI shape; I own that the operator-facing title
   does not collapse the three tools into one adoption story.

### 6. Acceptance criteria → states → `Verify by`

These are the user-visible / operator-visible criteria I own. Marks land in synthesized SPEC §3
`Verify by` per `spire-tech-risk-based-verify`. There is no trader frontend to implement cases —
the "surface" is CLI render + the hard absence of trader UI.

| ID | Acceptance criterion | State(s) | Verify by | Why this mark |
|---|---|---|---|---|
| UX-1 | SPEC §4 carries **`NO_UI_CHANGE`**; no new trader route, nav, Settings, Ask-AI, Ticker, Scanner, or Positions affordance for this join | negative space | **test** | Silent addition of a trader string/route is invisible on a CLI-only review pass; structural empty-diff / path scan |
| UX-2 | Standing block is the **first** block of stdout and of the report artifact on every **successful** measurement run | default / success | **test** | Hedge drop on one branch is negative space |
| UX-3 | Standing / closing copy states **NOT LIVE** and **Authorizes: nothing** on live score/tier/gate/fingerprint/weight | default / success | **review** (wording) + **test** (required tokens present) | Exact prose is reviewable; required token presence silently regresses |
| UX-4 | No Live badge/chip and no label meaning "this quote is live" appears on any replayed score, label, or rate; lineage tokens are provenance only | default / success | **test** | A Live mark on stored replay is the defining integrity failure; scannable |
| UX-5 | Report / stdout never contains an adoption verb, "score is good/works/wins," or sentence that the live score **should** change | all success paths | **review** | Visible intentional posture; banned-phrase scan may assist but wording judgment is review |
| UX-6 | Every printed ranking rate / AUC / lift / precision-style figure carries **horizon** and **n** in the same block as the number; a figure lacking either is withheld | default / success, partial | **test** | Detached rates become product claims; silent n/horizon drop is invisible in a pasted table (`[model-read-carries-its-assumptions]`) |
| UX-7 | Requesting a symbol with no snapshots prints the **`no stored snapshot`** family and does **not** print `no label` or `empty book` for that identity | no snapshot | **test** | Exact three-way invariant; silent rewrite is a lie |
| UX-8 | Empty **stored book** uses the **`empty stored book`** family — never the miss string, never `no label` | empty book | **test** | Same invariant; requires both fixtures |
| UX-9 | A row with replayed score but missing forward label prints the **`no label … horizon <H>`** family — never miss, never empty book, never score `0` as a stand-in | no label, partial | **test** | BRIEF's named triangle; zero-as-unlabeled is invisible |
| UX-10 | Honest zero-pair / empty join produces **no** measurement artifact that could later be quoted as "we measured and found the score good/bad" | empty / no pairs | **test** | Empty-artifact-as-result is the worst research failure mode |
| UX-11 | Partial runs keep per-row dispositions; aggregate n reflects only rows actually used — unlabeled/miss/empty-book rows are not silently dropped from the denominator story | partial | **test** | Inflated n is a silent overclaim |
| UX-12 | When Stocks aggs are fetched for missing labels, progress/provenance states **labels only · Stocks · not Options**; no copy claims an Options API call occurred | working, default | **test** (token / counter pairing) + **review** (wording) | Money/license boundary; wording is intentional, call-count is silent-risk |
| UX-13 | Every paired success figure block carries `captured at` / as_of (score side) and horizon (label side) | default / success | **test** | Detached numbers become live claims when timestamps/horizons drop |
| UX-14 | Progress lines during long runs name phase + counts; partial output is not titled as the final research report | working | **review** | Visible, low silent-regression risk |
| UX-15 | Operator-facing title/chrome names this as **replay–outcome join** (or architect's chosen command title) and does not collapse it into score-lab diary ranking or live Path-B | default / success | **review** | Naming/ordering intentional |
| UX-16 | Banned trader-cycle literals (`unavailable this cycle`, Live offline chip copy, sim `—` as miss) do not appear as CLI absence copy | all | **test** | Closed-vocabulary scan; wrong-register copy silently lands from shared helpers |
| UX-17 | Second run on the same corpus + labels does not change operator-facing measurement claims (byte-identical measurement body per architect's exclusion of clocks) — copy must not invent a "new verdict" on rerun | default / success | **test** | BRIEF Decision impact; silent drift is the failure |

## Risks I see

1. **`no label` collapses into miss or empty book.** Operators will "simplify" three strings into one
   "unavailable." That is exactly the fabricated claim `[absent-is-not-none]` forbids — and BRIEF
   named the triangle for a reason.
2. **Rates print without horizon or n.** A naked AUC becomes a product ruling the moment it is
   pasted into a weekly note. UX-6 exists for this.
3. **"Score is good / works" creeps in via headers or closing lines.** Even "composite still failing"
   is a verdict tone this artifact must not emit as authorization; facts + horizon + n only.
4. **`source: live_massive` (or similar lineage) is misread as Live.** Same failure class as
   batch-backtest; UX-4.
5. **Stocks aggs for missing labels is mis-described as an Options refresh.** License and
   operator-vs-trader both break if copy implies Options API.
6. **Trader UI creep** under a friendly `/_ops` "Score measurement" page. BRIEF forbids it;
   `NO_UI_CHANGE` assumes the other lanes do not reopen it without GATE Z.
7. **Confusion with score-lab.** Diary AUC and replay-join rates will land in the same note; if
   titles rhyme, one adoption story writes itself.
8. **My own failure mode, named:** inventing a pass/fail bar, a "score is good" claim, or dashboard
   states the BRIEF does not support. I have not named CLI flags, join math, or endpoint shapes —
   those are architect/PM. If I authored a live-score recommendation in this file, withdraw it.

## Assumptions I'm making about the other two lanes

- **Architect keeps this off the trader request path** and guarantees **zero Options API calls** on
  the join path — Stocks aggs only when labels are missing — so my "NOT LIVE / not Options" and
  "labels only · Stocks" copy are true, not aspirational.
- **Architect reuses the batch-backtest/capture miss and empty-book literal families**
  (`no stored snapshot for <SYMBOL>`, `empty stored book for <SYMBOL>`, unreadable family) rather
  than inventing a second vocabulary — UX-7/UX-8 bind to those strings.
- **Architect exposes a first-class `no label` disposition** (distinct from miss and empty book),
  including horizon on the literal — without that signal UX-9 cannot be implemented honestly.
- **Architect/PM ensure every aggregate rate field the report prints is accompanied by horizon and
  n** (and any under-powered/floor fields they already use) so UX-6 is a render rule, not a hope.
- **Architect names how this CLI coexists with `cmd_score_lab`, `cmd_batch_backtest`, and
  `cmd_join_outcomes`** (extend one vs third consumer) with a distinct operator-facing title — so
  UX-15 is not lying.
- **Architect makes same-corpus+labels reruns byte-identical on the measurement body** (clocks
  excluded as they decide) so UX-17's "no new verdict on rerun" claim is backed by bytes.
- **PM's AC set includes explicit ship-blocking rows** for: no trader UI, no live score/tier/
  fingerprint write, no Options API on this path, Authorizes: nothing, and the three-way absence
  split — so my copy claims are backed by verified product criteria, not only UX prose.
- **PM does not scope a trader-visible measurement surface, hist-chain purchase, live-score change,
  or a report-emitted go/no-go verdict** into this feature; if PM's position does, I will file an R2
  `product` conflict rather than design it.
- **PM does not require the report to assert that the score "is good" or "is bad"** — only to present
  paired facts and rates with horizon + n; any bar text is printed as evidence beside values, never
  as authorization.
- **Nobody proposes folding these rates into Ask-AI context or Ticker tiles** in this BRIEF's
  window; DESIGN_SYSTEM `NO_UI_CHANGE` / no-amendment assumes both other lanes agree.
- **Backend emits per-identity success vs no-label vs miss vs empty-book vs unreadable/fault** in a
  form the CLI renderer can map 1:1 onto the state table — a single boolean "had data" is not enough
  for `[absent-is-not-none]`.
