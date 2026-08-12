# R1 — pm position: score-lab-signal-comparison

## Position

### Who this is for, and what job it does

One user: the owner, running a weekly research loop on his own trading edge. He runs the lab from a
terminal (the three steps in `docs/research/WEEKLY_SCORE_LAB_RUNBOOK.md`), reads the output, and
writes a short weekly record. He is not a general audience, he is not being sold anything, and he
already knows the numbers are thin. What he cannot do today is see **more than one signal at a
time**, or **more than one symbol pooled together**, without doing the pairing by hand — which is
exactly how the two most decision-relevant findings of 2026-08-11 were produced.

The job: **turn the weekly run from "how did the composite score do?" into "how did each of my
signals do, on each symbol, on this same slice?" — with the thinness of the evidence carried in the
output rather than in the operator's memory.**

The surface is the research CLI's own report (what prints, and the artifact it saves). There is no
trader-facing surface in this feature, and adding one would violate
`[operator-vs-trader-path-separation]`.

### User stories

- **S1** — As the operator, running the weekly lab once, I want every candidate signal scored on the
  same KPI over the same slice in one report, so I can compare them without hand-pairing numbers
  into a write-up.
- **S2** — As the operator, I want every result reported per symbol as well as pooled, so a pooled
  figure can never hide an inversion like SPY +0.51 / QQQ −0.31.
- **S3** — As the operator reading any single number in the report, I want its horizon, window,
  symbol scope, sample count, label definition and basis right there, so I cannot quote a figure
  without its assumptions.
- **S4** — As the operator, I want a candidate that had **no usable samples** to look nothing like a
  candidate that **computed and found no effect**, so I never re-live the 2026-08-11 driver cells,
  where every cell read `n = 0` and only a hand-written note explained why.
- **S5** — As the operator, I want the report itself to state the measurement-only limits of the run
  (span, distinct sessions, sample counts, and that no result here authorizes a score change), so
  the hedge survives even when the write-up around it does not.
- **S6** — As the operator filling in the weekly record, I want every item the runbook asks me to
  record to be readable straight off the run, so the ritual costs minutes, not an afternoon.
- **S7** — As the operator comparing this week to last week, I want the composite score's figures to
  stay comparable with the artifacts I already have, so making the lab comparative does not silently
  break my only time series.

### Scope

**In**

1. A **fixed, named candidate set**, scored side by side on the same slice, same horizon, same
   labels: the composite opportunity score · vol-normalized GEX magnitude · distance-to-flip ·
   distance-to-wall. The set is **printed by the run**, so what was compared is never inferred.
2. **Per-symbol and pooled by default** — every candidate × label reported both ways, with no new
   flag required. The symbol list comes from the slice, not from a hardcoded list.
3. **Per-cell provenance** — sample count, window, horizon, symbol scope, label definition, and (for
   the vol-normalized candidate) which vol scalar the samples actually used.
4. **A closed vocabulary of not-a-number cell states** (see below) so absent ≠ empty ≠ undefined.
5. **Exclusion accounting** — a sample missing one candidate's input is dropped from that candidate's
   row and **counted with a reason**; counted + excluded reconciles to the paired total.
6. **A machine-carried evidence-strength statement** on every run and in the saved artifact: span,
   distinct trading sessions, sample counts, and the measurement-only limits.
7. **The score-driver residual named in the brief** — when loaded samples carry no driver breakdown,
   the run says so with counts, and a live capture that yields an empty breakdown on an otherwise-ok
   row is logged rather than silently indistinguishable from an old capture.
8. Continuity of the composite score's existing figures, so week-over-week comparison survives.

**Out (this feature)**

- Any change to the opportunity score, tier, entry gate, weights, constants, or fingerprint basis —
  `[score-change-is-deliberate-and-measured]` and `[additive-keeps-score-byte-identical]`. This
  feature **measures only**.
- Folding vol-normalized GEX (or any candidate) into the score. Ranking it here is not adopting it.
- Any adoption recommendation, "winner", "best signal", or per-run pass/fail against the runbook's
  multi-week bar.
- New capture, vendor calls, recompute, cache mutation, or any write to the diary.
- Backfilling, repairing or inventing driver values on historical rows the deep dive already hedged.
- Any trader-facing or web surface for lab results; any alert, notification or badge derived from
  them ("do not amplify score via alerts until KPI stabilizes").
- New labels/KPIs beyond the ones the lab already scores; any P&L-based label.
- Cross-run aggregation, trend lines, or week-over-week roll-up inside the tool.

**Future-dated (named, not built)**

- Per-**regime** split (vol regime, session) once per-symbol is routine — the deep dive's own "and
  later per-regime".
- Multi-week roll-up across saved artifacts — the shape that could actually test the runbook's
  "consistently ≳ 1.1 across weeks" bar. That, not this, is the thing a score change would cite.
- The 5-day horizon once enough forward sessions exist to label it.
- Driver leave-one-out attribution at usable n, once post-2026-08-10 captures accumulate.
- Any operator-route rendering of lab results.

### Product behavior

**One run, one report.** The operator runs the same runbook steps he runs today; the report comes
back comparative and per-symbol **without asking for it**. The headline is a single comparison on
the primary KPI (large absolute move) — one line per candidate, pooled, then one block per symbol.
The secondary labels (direction, structure event) are reported below it and visibly secondary, so
the primary question stays the primary question.

**Every cell is in exactly one of these states, and they are visually and textually distinct:**

| State | Means | Must not be shown as |
|---|---|---|
| computed | a value, with its n | — |
| computed, under-powered | a value, with its n, marked as below the stated minimum | a bare value |
| not computed — no sample carried this input | the input was absent on every paired sample | `0`, `—`, or a value |
| not computed — no paired outcome | samples exist but nothing was labelled for this horizon | `0` or absent |
| not computed — no variation | every sample carried the same value, so ranking is undefined | `0.5`, or "no effect" |

"Computed, no effect" is a **value** (a ranking metric at chance) and lives in the first row of that
table. `[absent-is-not-none]` is satisfied only when the operator can tell those apart **from the
output alone**, with no note beside it.

**Definitional coupling is marked.** A candidate that shares its inputs with a label — distance-to-
wall scored against a label defined as "price reached the wall" — produces an impressive number that
means almost nothing. Any such candidate × label pair is marked as definitionally coupled in the
report. This is a product requirement, not a nicety: an unmarked 0.93 in that cell is the single
most likely way this feature produces a false mandate.

**What the report must never claim** — it reports measurements, it does not rule. No candidate is
called better, best, winning, promising or ready. No per-run pass/fail against the multi-week bar.
No direction claim off a ranking metric. No P&L claim off a path-geometry label. No statement that a
result "supports" a score change. The evidence base is one 7-hour window of 221 samples; the deep
dive is explicit that it justifies no score change, and the report's own words must not outrun that.

### Acceptance criteria

Observable by running the lab and reading its output/artifact — no source reading required.
`Verify by` is risk-based: `test` where a silent regression is plausible, `review` where the
behavior is visible and intentional.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-C1** | S1 | A run with no flags beyond today's runbook invocation reports every candidate in the named set; the set is printed in the run output and the number of candidates reported equals it. | review |
| **AC-C2** | S1 | Every candidate is reported on the same KPI family (AUC, lift@top10, precision@top10, calibration) — no candidate carries a metric another candidate omits without an explicit not-computed state. | test |
| **AC-C3** | S1 | Given a constructed slice in which one candidate ranks the label perfectly and another ranks it exactly inversely, the report places them at opposite extremes of the ranking metric, and a third candidate with values unrelated to the label reports at chance. | test |
| **AC-C4** | S7 | Re-running the retained 2026-08-11 paired slice reproduces the deep dive's published figures to their published precision: composite AUC 0.467 and lift@top10 0.17, structure-event AUC 0.932, SPY Pearson +0.51, QQQ Pearson −0.31, SPY lift 1.43, QQQ lift 0.56. | test |
| **AC-C5** | S7 | For the same slice and horizon, the composite score's pooled figures match what the pre-feature lab reported for that slice — the weekly series is not silently rebased. | test |
| **AC-C6** | S1 | Two runs over identical inputs produce identical figures; the artifacts differ only in run timestamp and output path. | test |
| **AC-S1** | S2 | Every candidate × label is reported once pooled and once per symbol present in the slice; a run restricted to two symbols produces per-symbol blocks for exactly those two and no others. | test |
| **AC-S2** | S2 | For each candidate, the pooled sample count equals the sum of its per-symbol counts plus its counted exclusions — the arithmetic reconciles in the printed output. | test |
| **AC-S3** | S2 | A symbol present in the slice whose samples produced no paired outcomes appears in the per-symbol section carrying the "no paired outcome" state, rather than being omitted from the report. | test |
| **AC-S4** | S2 | Candidates and symbols appear in the same stated order on every run, so two weeks' outputs diff line-for-line. | review |
| **AC-P1** | S3 | Any single figure in the report can be read together with its horizon, window start/end (UTC), symbol scope, sample count and label definition, without opening another file. | review |
| **AC-P2** | S3 | The vol-normalized candidate's rows state how many of their samples used the ATM-IV basis, how many fell back to HV, and how many had neither — a run in which every sample fell back is distinguishable from one in which none did. | test |
| **AC-P3** | S3 | The saved artifact alone contains every figure and every state marker shown in the console output; nothing quoted on screen is missing from the file. | test |
| **AC-P4** | S3 | The report carries a version marker for the lab's own output shape, so an artifact from a later run is not silently compared against an incompatible earlier one. | review |
| **AC-D1** | S4 | A candidate whose input was absent on **every** paired sample renders the "no sample carried this input" state with the count of samples checked — and renders no numeric value, no zero, and no bare dash. | test |
| **AC-D2** | S4 | A candidate that computed over the full sample set and found no ranking effect renders a numeric value at chance with its n — and is textually distinct from the AC-D1 state, distinguishable by reading the report alone. | test |
| **AC-D3** | S4 | A candidate whose input is present on some samples and absent on others is scored on the samples it has, and the excluded count with its reason is printed beside that row; counted + excluded equals the paired total for that scope. | test |
| **AC-D4** | S4 | A candidate whose value is identical across every sample in a scope renders the "no variation" state, not a chance-level value and not the absent state. | test |
| **AC-D5** | S4 | When no loaded sample carries a score-driver breakdown, the attribution section states that it was **not attempted** and gives the count of samples lacking it — it does not print rows of `n = 0`. | test |
| **AC-D6** | S4 | When some loaded samples carry a driver breakdown and others do not, attribution is computed on those that do and reports its reduced n plus the excluded count. | test |
| **AC-D7** | S4 | A live capture that produces an otherwise-ok row with an empty driver breakdown emits a log line naming the symbol and time, so a present-day regression is distinguishable from a pre-2026-08-10 capture. | test |
| **AC-E1** | S1 | A run with zero paired rows fails loudly, names which side was empty (samples vs outcomes), and leaves **no** result artifact that could later be read as a run with no findings. | test |
| **AC-E2** | S1 | A requested horizon for which no outcomes were labelled fails naming that horizon, rather than reporting zeros for every candidate. | test |
| **AC-E3** | S1 | A missing or unreadable outcomes input fails naming the path it tried, and writes no artifact. | review |
| **AC-G1** | S5 | Every run — console and artifact — carries the slice's span, its count of distinct trading sessions, its sample counts, and an explicit statement that the run authorizes no score change. Deleting the prose around the numbers cannot remove it. | test |
| **AC-G2** | S5 | A slice covering fewer than two distinct trading sessions is labelled as single-session in both the console output and the artifact. | test |
| **AC-G3** | S5 | Any cell below the report's stated minimum sample count carries the under-powered marker, and the minimum in force is printed in the run. | test |
| **AC-G4** | S5 | The report contains no adoption or verdict language: no candidate is described as better, best, winning, recommended, promising or ready, and no per-run pass/fail against the multi-week bar appears. Enforced by a scan over the run's own strings, not by reviewer memory. | test |
| **AC-G5** | S5 | Any candidate × label pair whose label is defined in terms of that candidate's own inputs is marked as definitionally coupled wherever its figure appears. | test |
| **AC-I1** | — | The lab completes with no vendor credential present in the environment, confirming the run makes no vendor call. | test |
| **AC-I2** | — | The diary/sample store is byte-identical before and after a run — the lab reads and never writes to it. | test |
| **AC-I3** | — | For a fixed ticker, the score, tier and state fingerprint served by the app are byte-identical before and after this feature. | test |
| **AC-R1** | S6 | Every item the weekly runbook's Record step asks for (date, artifact path, paired count, the lift figures, the per-symbol note) is readable directly off one run's output, with no hand computation and no second command. | review |
| **AC-R2** | S6 | The runbook's existing invocation still works unchanged and now returns the comparative, per-symbol report — comparative is the default, not an opt-in flag. | review |

### Open product decisions for the human (do not let a lane invent these)

1. **The minimum sample count** behind AC-G3 is not decided. The evidence says 74 per symbol was
   already called thin, and the outcome-ledger precedent uses 20 with an interval. My recommendation
   is **30 per cell**, printed in the report, marked but never suppressed — a research tool must show
   thin numbers, it just must not show them bare. Owner's call.
2. **Retention of the 2026-08-11 slice** as a fixture. AC-C4 is the strongest single proof this
   feature does what the write-up did by hand; it needs that slice to still exist. If it cannot be
   retained, AC-C4 downgrades to a constructed fixture and we lose the reproduction claim.
3. **Whether the secondary labels stay in the report at all.** Keeping them costs legibility;
   dropping them loses the structure-event contrast that motivated the feature. I default to keeping
   them, visibly secondary, with AC-G5's coupling mark.

## Risks I see

- **The mandate risk is the whole risk.** A comparative report is a machine that manufactures a
  best-looking number every week. On this evidence base — one 7-hour window, 221 samples, zero
  five-day outcomes — a 0.93 beside a 0.47 will feel like a decision even when it is not one. AC-G1
  through AC-G5 exist for exactly this, and if any of them is softened during synthesis, this
  feature becomes a route to an unearned score change.
- **Definitional coupling produces the most convincing false result.** Level geometry scored against
  a level-path label is close to scoring a signal against itself. Unmarked, it will read as "our
  best signal by far" — and it is the highest number in the existing evidence.
- **Absent-vs-none collapsing at a boundary.** The 2026-08-11 driver cells failed precisely because
  a distinction died before it reached the operator. If the stored samples cannot distinguish
  "field absent" from "field zero", AC-D1/AC-D2/AC-D4 are unbuildable as written — I need that
  answered at R2, not discovered at build.
- **Report legibility collapse.** Four candidates × three labels × pooled + N symbols is a matrix,
  and a matrix nobody reads is a feature that shipped and did nothing. The mitigation is the fixed
  small candidate set, the primary/secondary split, and stable ordering (AC-S4) — all of which are
  cheap to lose to "while we're here, add another candidate".
- **Ritual friction.** If comparative output requires new flags or a slower run, the weekly loop
  degrades and the diary keeps accumulating unanswered. AC-R2 pins the default.
- **My own criteria could drift into unobservable territory.** "The comparison is correct" is not a
  criterion. Every row above is checkable by running the thing and reading what it printed; if any
  row survives synthesis in a form that requires reading source to check, it should be cut or
  restated, not kept for coverage.

## Assumptions I'm making about the other two lanes

- **Architecture:** every candidate in my named set is derivable from fields already captured on
  stored samples — no new capture, no vendor call, no recompute — exactly as the brief's feasibility
  note asserts. If any candidate (most likely the vol-normalized magnitude, or one of the distance
  reads) is **not** present on historical samples, AC-C1 cannot hold for past slices and the
  architect must say so at R2 rather than quietly scoring a shorter candidate set.
- **Architecture:** stored samples can distinguish **"this field was never carried"** from **"this
  field was carried and its value is zero"** at load time. If storage collapses the two, AC-D1 and
  AC-D2 are not implementable as written, and that is a conflict I need surfaced at R2.
- **Architecture:** one run can produce pooled + per-symbol for all candidates × all labels in a
  single pass over the slice, in seconds rather than minutes, at the scale the diary reaches over
  the next few months (low thousands of samples). If the comparative run is materially slower than
  today's, the weekly ritual is at risk and I want the trade named.
- **Architecture:** the saved artifact can carry **per-cell state labels from a closed set**, not
  just numbers and nulls — i.e. the absent/no-outcome/no-variation distinction survives into the
  file, not only into the console text.
- **Architecture:** the run stays offline-capable (completes with no vendor credential set) and
  read-only over the sample store, so AC-I1 and AC-I2 are checkable without special setup.
- **Architecture:** making the lab comparative does not change how the composite score's own figures
  are computed for a given slice — AC-C5 holds without a compatibility shim.
- **Architecture:** the driver-breakdown capture-side log in AC-D7 can be emitted from the existing
  capture path without touching scoring, keeping `[additive-keeps-score-byte-identical]` intact.
- **UX/Tech-writer:** there is **no web surface here**. The thing UX shapes is the terminal report
  and the artifact's readability — the wording of each not-computed state, the primary/secondary
  split, the ordering, and the phrasing of the measurement-only statement. If the UX position
  proposes a dashboard, route or widget for lab results, that conflicts with my Out list and with
  `[operator-vs-trader-path-separation]`, and I will raise it as a conflict at R2.
- **UX/Tech-writer:** the not-a-number states are rendered as **words**, not symbols or colour — a
  terminal report may be piped, pasted into a document, or read in a monochrome log, so `—` and a
  red cell cannot be the sole carriers of a distinction AC-D1 depends on.
- **UX/Tech-writer:** they own the exact wording of the measurement-only statement and the
  definitionally-coupled marker; I own only that both exist in both the console output and the saved
  artifact, and that the wording contains no adoption language (AC-G4 scans it).
