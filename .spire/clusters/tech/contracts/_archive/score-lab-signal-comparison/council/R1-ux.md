# R1 — ux position: score-lab-signal-comparison

## Position

### 0. What the surface actually is (and what it is not)

There is **no screen here.** `[operator-vs-trader-path-separation]` keeps research off every
trader/bundle route, and the BRIEF is backend-only. So the user-facing surface I own is exactly
three coupled artifacts:

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S1 | **Terminal summary** — the non-`--json` stdout block at the end of a `score-lab` run (today `main.rs:645-668`) | the operator, once a week, while the shell is still open | every printed word, ordering, the absence literals |
| S2 | **Report artifact** — the run's durable output under `data/research/` | the operator later, and the human write-up that quotes it | every label, every definition string, every not-a-number literal, the standing block |
| S3 | **The hand-written write-up + runbook** (`docs/research/SCORE_LAB_DEEP_DIVE_*.md`, `WEEKLY_SCORE_LAB_RUNBOOK.md`) | the owner, and future council rounds citing it as evidence | what the human is still allowed to type vs. what must be pasted |

**Design-system note (binding, for SPEC §4):** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is
`Status: SET` (The Curvature Terminal). This feature touches **no dashboard surface** — no route, no
component, no token. SPEC §4 must carry **`NO_UI_CHANGE`** and must not restate the token table.
I am requesting **no amendment** to `DESIGN_SYSTEM.md`. Anyone proposing a `/\_ops` page or a scanner
tile for these numbers is re-scoping — raise it as an R2 conflict, do not fold it in.

### 1. Intended user, primary job, vocabulary

- **User:** the operator (one person, the owner), weekly, non-adversarial but time-poor and prone to
  reading a number as a verdict. Same person who wrote "SPY looks usable" from a 7-hour window.
- **Primary job:** *"Which of our own signals, if any, has earned any trust yet — and is this run
  allowed to change anything?"* The second half of that question is the part the current output
  answers not at all.
- **Failure I am designing against:** a number in this report being quoted six weeks later, in a
  council round, without its window and its sample count attached. That has already half-happened —
  the deep dive's per-symbol table is labeled *"(hand-paired)"* and the driver block's `n = 0` was
  explained only by prose beneath it.

**User vocabulary — the closed term set. These are the only words the output may use for these things:**

| Concept | Approved term | **Banned** (asserts meaning the data cannot carry) |
|---|---|---|
| A thing being measured | **candidate signal** | "signal", "model", "strategy", "factor" |
| What the run did to it | **ranked on this slice** | "validated", "backtested", "proved", "scored" |
| A candidate doing well | **ranks *label* well on this slice** | "accurate", "predictive", "works", "wins", "best", "winner", "top signal" |
| The metric family | **ranking metrics** | "performance", "accuracy", "quality", "edge" |
| AUC | **AUC — ranking of \<label\>; 0.50 = chance** | "accuracy", "hit rate", "success rate" |
| lift@top10 | **Lift @ top decile — 1.00 = chance** | "return", "gain", "improvement" |
| Vol-norm GEX candidate | **Vol-normalized GEX magnitude (basis: …)** | "vol-norm score", "vol-adjusted signal", "normalized strength" |
| Level geometry candidates | **Distance to flip (%)**, **Distance to wall (%)** | "level signal", "geometry score", "proximity edge" |
| `structure_event` | **structure_event — path geometry hit (wall touch or flip cross), not P&L** | "structure signal", "event prediction" |
| The whole artifact | **research read** | "report card", "results", "findings", "verdict" |

The vol-norm rule is not stylistic. `X2_VOL_NORMALIZED_GEX_STATUS.md` §"Do not" and the BRIEF both
say ranking it here is **not** adopting it; the moment the column header says "score" the artifact has
adopted it in the reader's head. Same for `structure_event`: **AUC 0.932 next to the word "signal"
is a product claim**, and the label is a path-geometry hit, not P&L.

### 2. The standing block — `[model-read-carries-its-assumptions]` made structural

Today the hedge is line 3 of a hand-typed markdown file:

> **Not a product ruling.** Thin window; multi-week bar still open.

A reader can skip it, a quoter can drop it, and nothing regenerates it. My position, concretely:

**(a) The tool emits it, the human never types it.** The standing block is the **first** thing printed
by the run and the **first** block in the report artifact, before any metric.

**(b) It is derived, not constant.** Its wording changes with the data. A fixed string is just a
comment; it stops being read on run three. Proposed shape and exact copy:

```
RESEARCH READ — NOT A PRODUCT RULING
  Standing:    BELOW BAR — single-session window
  Bar:         large_abs_move lift @ top decile >= 1.10, sustained across >= N sessions
               spanning >= M calendar weeks
  This run:    1 session · 2026-08-10 17:15-23:58 UTC (6h43m) · 221 paired rows · 3 symbols
  Authorizes:  nothing. No weight, constant, gate threshold or fingerprint basis changes
               on the strength of this run.  [score-change-is-deliberate-and-measured]
  Ranking a candidate signal here is not adopting it.
```

`N` and `M` are **PM's numbers, not mine** — I own only that the bar's own text is printed beside the
run's value, so the gap is arithmetic the reader cannot skip. The runbook already carries an informal
bar ("consistently ≳ 1.1 across weeks, not one day"); it must move out of the runbook and into the
emitted output, because a bar living only in a runbook is a bar nobody checks at read time.

**(c) It is inseparable from the numbers.** The same standing text (and the fields that produced it —
`standing_verdict`, `bar_text`, `window_utc_first`, `window_utc_last`, `sessions_counted`,
`n_paired`) sit **in the artifact**, not only on stdout, so anything downstream that quotes the
numbers has already been handed the hedge. I name these fields as things the report consumes; their
shape is architect/PM's.

**(d) It is repeated at the end of stdout.** Operators read the top and the bottom of a scroll and
skim the middle. One line, verbatim: `RESEARCH READ — NOT A PRODUCT RULING · standing: BELOW BAR`.

**(e) Standing is a closed vocabulary**, never free prose: `BELOW BAR` · `AT BAR` ·
`INSUFFICIENT — cannot evaluate` · `DEGENERATE — single symbol` · `DEGENERATE — single session`.
Two of these can be true at once, and the output must show both rather than pick one.

### 3. `[absent-is-not-none]` — the closed absence vocabulary (my highest-priority ruling)

In the 2026-08-11 run **every driver-attribution cell read `n = 0`** and only prose explained that the
cause was `score_drivers: null` on every pulled sample. `n = 0` is also what "computed, effect nil"
would have printed. That collapse is the whole failure. Today's stdout makes it worse: `main.rs:655`
and `:659` both render `Option::None` as the single literal `"n/a"`, so "AUC not computable" and
"label never evaluated" are already the same pixel.

**Every metric cell renders as exactly one of these six literals. `n/a`, blank, `null`, `NaN`, `-`,
and a bare `0` are banned** — a bare `0` and a blank are indistinguishable from an interpolation bug
in a pasted table.

| Literal (exact) | Means | Example rendering |
|---|---|---|
| `no input (0 of 221 samples carried score_drivers)` | **n=0 because no sample carried this candidate's input.** Count of samples checked is mandatory. | driver attribution, 2026-08-11 |
| `0.00 (n=221)` | **Computed, and the effect is nil.** A number always carries its n. | a real flat Pearson |
| `too few (n=4, floor 30)` | Computed set exists but is below the reporting floor; the value is **withheld, not shown small** | the 47–57 calibration bin |
| `undefined (base rate 0.00)` | Arithmetic undefined for this cell — no positives to lift over | lift with no positives |
| `— not applicable` | This metric does not exist for this candidate/label pair | calibration on a boolean candidate |
| `not run (--driver-loo off)` | The block was requested off; nothing was attempted | operator flag |

Rule that makes it hold: **`no input` and `too few` rows carry the excluded count and the reason, and
`[best-effort-isolated-or-null]` means the excluded samples are counted, never silently zeroed.**
Every candidate row therefore prints `n = <used> (excluded <k>: <reason>)` — e.g.
`n = 147 (excluded 74: atm_iv and hv_30d both absent)`. A row where used + excluded ≠ paired rows is
a copy bug, not a rounding detail.

Second rule: **every metric carries its ranking direction.** `AUC 0.07` and `AUC 0.93` are the same
finding with opposite sign conventions, and a reader cannot tell an inverse relationship from a
sign bug without it. Each candidate row states, in words, `ranked: higher value = higher rank` or
`ranked: nearer to level = higher rank`.

### 4. Information structure of the read (fixed, in this order)

1. **Standing block** (§2) — before any number.
2. **Provenance line** — `report_version`, generated-at UTC, the outcomes artifact path consumed, the
   sample source (prod pull / local store / `--samples` file), horizon. Every number in the artifact
   is vouched by this line; nothing may be reported that this line cannot source.
3. **Slice description** — symbols, paired rows, window first→last UTC, sessions covered, label
   definitions (verbatim from `LabelKind::definition()`, one per label, **in the same block as the
   metric**, never in a legend at the bottom).
4. **Candidates × labels, pooled.** One row per candidate per label.
5. **Candidates × labels, per symbol.** Headed `Per symbol — pooled above is not a summary of these`.
   The deep dive's own finding (SPY +0.51 vs QQQ −0.31) is exactly why pooled must not read as an
   average.
6. **Calibration**, per candidate, with `too few` bins withheld rather than printed.
7. **Driver attribution**, with §3's vocabulary.
8. **Standing one-liner**, repeated.

**Ordering is declared, never sorted by metric.** Candidates appear in a fixed declared order
(`opportunity_score`, vol-normalized GEX magnitude, distance-to-flip, distance-to-wall) and symbols in
their input order. Sorting the table by AUC manufactures a leaderboard, and a leaderboard reads as an
endorsement — which is precisely the adoption this feature is forbidden from performing.

### 5. Component states

The report is a component with states, and every state has to be reachable *and* readable.

| State | When | What the operator sees | What must **not** happen |
|---|---|---|---|
| **Default (full comparison)** | ≥1 candidate computed pooled + per symbol, every candidate above the floor | Full §4 structure; standing `BELOW BAR` / `AT BAR` | A candidate silently missing because its inputs were absent |
| **Partial** | ≥1 candidate below the reporting floor or missing inputs, ≥1 computed | The candidate **still has a row**, rendered `no input (…)` / `too few (…)`; header line `Partial comparison — 2 of 4 candidates evaluable` | A candidate dropped from the table entirely (absence becomes invisible), or its cell reading `0.00` |
| **Degenerate — single symbol** | one symbol survives the filter | Per-symbol section still renders, with `Pooled = SPY only; pooled and per-symbol are the same 74 rows`; standing gains `DEGENERATE — single symbol` | A "pooled" table that is silently one symbol, implying cross-symbol generality |
| **Degenerate — window too short** | window covers < the stated session bar | Standing `DEGENERATE — single session`, plus per-table banner `Window: 6h43m within one session. Ranking metrics are exploratory.` | Metrics printed at full precision with no window qualifier — the 2026-08-11 shape |
| **Stale diary** | newest paired sample materially older than run time | `Newest sample 2026-08-04 (7 days before this run) — this read describes an older diary, not today` | The run date being mistaken for the data date |
| **Cannot compute** | no paired rows (today: `main.rs:606` `anyhow::bail!`) | A named-precondition failure that says which of the three inputs was empty and the exact next command: `No paired rows for horizon=1d. Samples loaded: 221. Outcomes loaded: 0. Run join-outcomes first: cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM` | A bare error/stack that is indistinguishable from a crash; or a written artifact that looks like a real (empty) result |
| **Working / long run** | reading a large store | Progress lines naming the phase (`reading structure history: SPY …`) | Silence long enough to read as a hang |

No `loading`, `offline`, `success-toast` or `empty-list` state exists here — a CLI run is
synchronous and single-shot. `offline` is meaningless by construction: the BRIEF forbids any vendor
call, so a network failure cannot be a state of this artifact. If one appears, that is a
`[operator-vs-trader-path-separation]` violation, not a state to design.

### 6. What the human is still allowed to type (S3)

- The runbook's **"Record"** section — "Per-symbol note if you split manually", "Do not change live
  score from a single week" — must be replaced by: *"Paste the emitted standing block and tables.
  Do not retype numbers."* Hand-transcription is where the unvouched claim entered last time; the
  word `(hand-paired)` in the current deep dive is an honest tell that must become impossible.
- If a number in a write-up is **not** from the artifact, it is prefixed `hand-derived, unvouched:`.
  There is no third option and no silent third option.
- The human write-up keeps prose interpretation ("maybe pinning / mean-reversion regime") — that is
  reasoning, and reasoning is allowed to be typed. Only **claims about what the data says** must be
  pasted.

### 7. Acceptance criteria → states → `Verify by`

These are the user-visible criteria I own. `Verify by` per `spire-tech-risk-based-verify`.

| ID | Acceptance criterion | State(s) | Verify by | Why this mark |
|---|---|---|---|---|
| UX-1 | The standing block is the first block of both stdout and the artifact on **every** run, including partial, degenerate and stale runs | all | **test** | Negative space: a condition change that drops the hedge on one branch is invisible — the reader only notices what is present |
| UX-2 | The standing verdict is **derived from the run's window/sample counts**, not a constant: a run below the session bar renders `BELOW BAR`/`DEGENERATE`, a run meeting it does not | default, degenerate | **test** | Silently regresses to a hardcoded string under refactor; a constant hedge is the current failure |
| UX-3 | Standing block **wording** (the six lines in §2, incl. "Ranking a candidate signal here is not adopting it") matches the approved copy | all | **review** | Visible, intentional wording |
| UX-4 | `n=0 because the input was absent` renders as `no input (0 of N samples carried <field>)` and **never** as `0`, `0.00`, `n/a`, blank or `null` | partial | **test** | This is the exact 2026-08-11 defect class and it is invisible in a green suite — `[absent-is-not-none]` |
| UX-5 | A computed-and-nil value renders as `0.00 (n=N)` — distinguishable from UX-4 in a plain-text paste with no surrounding prose | default, partial | **test** | The distinction is the feature; a snapshot of one literal is worthless without the contrast case |
| UX-6 | The literal `n/a` appears nowhere in the report or stdout; the only absence literals are the six in §3 | all | **test** | Closed-vocabulary invariant, mechanically scannable, silently reintroduced by any new `Option` render (today's `main.rs:655`/`:659` are the live instances) |
| UX-7 | Every candidate row prints `n = <used> (excluded <k>: <reason>)`, and used + excluded = paired rows | default, partial | **test** | `[best-effort-isolated-or-null]` — silent zeroing is exactly what must not happen, and an off-by-one here is invisible |
| UX-8 | Every metric row carries its label definition **in the same block** as the number, verbatim from the label's definition string | default, partial | **test** | Structural (definition rides with metric); a legend that drifts from the metric is a silent lie |
| UX-9 | Every candidate row states its ranking direction in words | default, partial | **test** | Without it, an inverted sign and a genuine inverse relationship are indistinguishable |
| UX-10 | Candidate and symbol ordering is the declared order; the table is never sorted by a metric value | default, partial | **test** | Ordering here is an invariant, not cosmetics — a `sort_by(auc)` added later is green and changes the artifact's meaning into a leaderboard. Deliberate deviation from the skill's "ordering → review" default |
| UX-11 | Vol-normalized GEX rows carry the vol basis actually used (`ATM IV` / `HV 30d`) per row, and are labeled "magnitude", never "score" or "signal" | default, partial | **test** | Showing an HV-fallback row as ATM-IV basis is a wrong claim that renders identically to a right one |
| UX-12 | No column header, row label or note uses a banned term from §1's table | all | **review** | Copy wording, visible on inspection |
| UX-13 | A single-symbol run renders the per-symbol section and states that pooled is that one symbol | degenerate — single symbol | **test** | Rare branch, never hit in normal weekly use, silently wrong when it is |
| UX-14 | A window shorter than the stated session bar renders the window banner on the metric tables, not only in the standing block | degenerate — window | **test** | The tables are what gets pasted; a qualifier that only exists above them travels alone |
| UX-15 | The stale-diary line appears when the newest paired sample predates the run beyond one session, naming both dates | stale | **test** | Absence of the line is the failure, and absence is unobservable by review |
| UX-16 | The cannot-compute state names which input was empty and prints the exact next command; it does not write a report artifact that could be mistaken for a result | cannot compute | **test** | An empty artifact quoted later as "we measured and found nothing" is the worst outcome this feature can produce |
| UX-17 | Progress lines name the phase during a long store read | working | **review** | Visible, low-risk, cosmetic |
| UX-18 | `WEEKLY_SCORE_LAB_RUNBOOK.md` "Record" step instructs paste-not-retype, and the bar lives in the emitted output rather than only in the runbook | — (doc) | **review** | Static doc content |
| UX-19 | The report/stdout contains no recommendation, adoption verb, or "next step" that implies a score change | all | **review** | Wording; the whole `[score-change-is-deliberate-and-measured]` posture in one row |

## Risks I see

1. **The standing block becomes wallpaper.** Any hedge printed identically 40 weeks running stops
   being read. That is why UX-2 demands derivation and why standing is a closed verdict vocabulary
   rather than a paragraph — the operator should be able to notice the word `BELOW BAR` change to
   `AT BAR` at a glance, which is the only moment the hedge has ever mattered.
2. **The six absence literals get "tidied" into `n/a` by a later hand.** Highest-probability
   regression in the whole feature — it is a one-line "cleanup" that looks like polish. UX-6 is
   written as a scan for this reason.
3. **Someone sorts the table.** Ranking candidates by AUC is such an obvious readability improvement
   that it will be proposed sincerely. It converts a measurement into an endorsement. UX-10.
4. **`structure_event` AUC 0.932 gets quoted without its definition.** This number is already in a
   repo doc and already reads like a discovery. If the per-row definition is dropped to save width,
   the artifact starts asserting a trade signal.
5. **Excluded-sample counts get computed but not printed** because the row "looks noisy" with them.
   Then `[best-effort-isolated-or-null]` is satisfied in the data and violated in the read, which is
   the same as violated.
6. **Terminal width.** Four candidates × three labels × four metrics × per-symbol does not fit 80
   columns without dropping qualifiers — and the qualifiers are the honesty. If it does not fit, the
   stdout summary must **narrow the metric set** (fewer columns) and never the qualifiers, pointing
   at the artifact for the rest. I would rather print fewer numbers than unlabeled ones.
7. **A markdown/human-readable report emission may be judged out of scope** by PM or architect, since
   only the JSON artifact exists today. If so, my floor position is: every claim-bearing string in
   §2–§4 must exist **inside the JSON artifact as text**, so the human write-up can only copy vouched
   strings. I will not accept "the human types the hedge" as the resolution — the BRIEF explicitly
   forbids it.
8. **My own failure mode, named:** I do not know what the session/week bar should be (`N`, `M`), and I
   have deliberately not invented one. If the synthesized SPEC contains a bar number I authored, that
   is a defect — it must come from PM.

## Assumptions I'm making about the other two lanes

- **PM sets the numeric bar** (`N` sessions, `M` weeks, the lift threshold) that the standing block
  prints, and sets the **reporting floor** below which a metric renders `too few` instead of a value.
  I assume PM will supply both as explicit numbers; if PM's position omits them, I will raise it in
  R2 as a blocking gap rather than fill it in.
- **PM's AC set includes at least one criterion that this feature changes no score-affecting value**
  (`[additive-keeps-score-byte-identical]`), so my copy claim "Authorizes: nothing" is backed by a
  verified property and not just a sentence I wrote.
- **The architect's design produces per-candidate per-symbol metrics in a single run** — the operator
  runs one command and gets pooled + per-symbol in one artifact, not one invocation per symbol. If
  the design requires N invocations, my §4 structure and UX-13 do not hold and I will contest it.
- **The architect exposes, per candidate row, the used-sample count, the excluded-sample count, and a
  machine-readable exclusion reason** (input absent vs. below floor vs. non-finite). UX-4/UX-7 are
  unimplementable without all three; a boolean "had data" is not enough.
- **The architect exposes the vol basis actually used per candidate row** (`atm_iv` / `hv_30d` /
  unavailable) rather than one basis for the whole run — the fallback is per-sample, so a run-level
  basis label would be a false claim (UX-11).
- **The architect treats "no paired rows" as a first-class reportable outcome** with distinguishable
  causes (no samples / no outcomes / no overlap at this horizon), not a single generic bail — UX-16
  depends on knowing which one.
- **Nobody proposes a web or `/_ops` surface for these numbers.** I have designed none, and the
  DESIGN_SYSTEM adherence position (`NO_UI_CHANGE`, no amendment requested) assumes both other lanes
  agree this stays a CLI + artifact feature.
- **PM keeps `structure_event` in the candidate/label set rather than promoting it**, and no lane
  proposes acting on the 0.932 result inside this feature. If any position contains an adoption step,
  it is my defining failure mode arriving from another lane and I will file it as a `product` conflict.
- **The architect keeps the `score_drivers`-null logging piece** the BRIEF folds in (Considered §
  `score-drivers-capture-integrity`), because UX-4's copy — "0 of N samples carried `score_drivers`" —
  needs the count of ok-rows-with-null-drivers to be knowable at report time.
