# R3 — pm resolution: score-lab-signal-comparison

Settling conflicts **#2**, **#9**, **#13**, **#15**, plus the two owner-confirmable defaults §C-2 left
to this exchange. Rulings **C-1** (five candidates) and **C-2** (below-floor cells show the value with
its marker) are taken as binding and are not re-argued. Every criterion below is observable by running
the lab and reading its console output and its artifact.

**What I withdraw here, in one place:**

- My R1 five-state cell table, **as an independent vocabulary**. Replaced by the single eight-state
  vocabulary in §3. It was declared exhaustive and was not.
- My single "no variation" state. Split into two (§3.2).
- AC-S2 as written. It is arithmetically false; the architect is right (§2).
- "not attempted" in AC-D5. It asserts something the run did not do (§3.4).

---

## 1. Scope corrections forced by ruling C-1

**Scope In, item 1 restated.** A fixed, named candidate set of **five**, scored side by side on the
same slice, same horizon, same labels: the composite opportunity score · vol-normalized GEX magnitude ·
**raw GEX magnitude (control)** · closeness to flip · closeness to nearer wall. The set is printed by
the run in its declared order. The directional vol-normalized candidate is **Future-dated**, alongside
IV/HV-ratio extremity; if it is ever resurfaced it is reported against the direction label only and
labelled a direction hypothesis.

The grid is therefore **5 candidates × 3 labels × (1 pooled + one block per symbol in the slice)**.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-C1** *(restated)* | S1 | A run with no flags beyond today's runbook invocation prints the declared candidate set, and the number of candidates it reports equals the number it printed — five in v1. | review |
| **AC-C1b** *(new)* | S1 | The raw-GEX candidate is labelled a **control** wherever its figure appears, in console and artifact, with one sentence stating why it is present (so the vol-normalized row can be attributed). It is never presented as a candidate under consideration. | review |

AC-C1b exists because ruling C-1 admitted a candidate that is not a hypothesis. An unlabelled control
row is a sixth signal in the operator's head, which is the legibility cost the ruling was trying to
avoid paying.

---

## 2. Conflict #2 — AC-S2's identity. Accepted, restated.

The architect's arithmetic is correct and my sentence was wrong: pooled used **plus** exclusions
double-counts the exclusions. I accept the correction in full and replace the one criterion with the
two identities that are separately true and separately checkable.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-S2a** *(composition)* | S2 | For every candidate × label, the pooled used-sample count printed in the report equals the sum of the used-sample counts printed in the per-symbol blocks; and for each named exclusion reason, the pooled count for that reason equals the sum of the per-symbol counts for that reason. Checked on a slice in which at least one symbol contributes exclusions and at least one does not. | test |
| **AC-S2b** *(closure)* | S2 | Within any single scope — the pooled block, or one symbol's block — used samples plus total excluded samples equals **that scope's own** paired row count, and that scope's paired row count is printed in the same block as the figures it bounds. | test |

AC-S2a is the stronger of the two: it is the one that fails when a symbol is silently dropped from the
per-symbol section, which AC-S2b alone cannot see.

**UX-7 carries the neighbouring slip and I do not contest the fix.** "used + excluded = paired rows" is
true only when the row's scope is the whole slice; for a per-symbol row the right-hand side is that
symbol's paired rows. This is a factual correction, not a scope call — UX owns the row's copy, I only
need the scope to be the row's own.

---

## 3. Conflicts #9 / #13 / #15 — ONE absence vocabulary. Converged.

**I adopt UX's three-layer proposal as written.** One vocabulary, three layers, stated once in the SPEC:
the architect's **row-level ineligibility reasons** (why one sample left one candidate) → the
**cell-level state** (one per cell, required even when no row-level reason exists) → **exactly one
rendering literal per cell state, literals owned by UX**. My "extend my five to eight" framing is
withdrawn; the enumeration below is UX's union, not a third list.

### 3.1 The eight cell states (closed, one literal each)

| Cell state | Means | Reachable in v1 by |
|---|---|---|
| computed | a value, with its row count and session count | the normal case |
| computed, under-powered | a value, its counts, **and** the marker — one literal, per ruling C-2 | any thin cell; the 47–57 calibration bin |
| no eligible rows | rows reached the candidate and every one was excluded, with the reasons and counts | driver attribution on pre-2026-08-10 captures |
| no paired outcome | rows exist in the group but nothing was labelled for this horizon; names the horizon and the row count | a symbol whose newest session has no forward outcome yet |
| candidate constant | every eligible value in the scope is identical, so ranking is undefined | a flat input on a short slice |
| label constant | the label has no positives (or no negatives) in the scope, so the ranking metric and lift are undefined | a symbol with no large move in the window |
| not applicable | this metric does not exist for this candidate × label pair | **see §6 — may be unreachable in v1** |
| not run | the block was switched off by a flag; nothing was attempted | attribution block off |

Two states resolve gaps my R1 set did not have (**not applicable**, **not run**); one resolves the gap
UX's six did not have (**no paired outcome**, which AC-S3 requires).

### 3.2 "No variation" is TWO states, not one

Decided: **two.** A constant candidate and a constant label are different facts with different reader
remedies — a constant candidate says the input is flat or broken and the candidate is unmeasurable;
a constant label says the slice contains no events and *every* candidate is unmeasurable against it.
Collapsing them re-creates, one axis over, the exact collapse this feature exists to kill. UX's
`undefined (base rate 0.00)` literal covered only the no-positives half of the second one.

### 3.3 Criteria over the vocabulary

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-V1** *(replaces my R1 state table)* | S4 | Every metric cell, in console and artifact, is in exactly one of the eight declared states, and the artifact records that state as its own stated value rather than leaving it to be inferred from a missing number. | test |
| **AC-D1** *(restated)* | S4 | A candidate whose input was absent on **every** paired row in a scope renders the **no eligible rows** literal with the count of rows checked and the reason — and renders no numeric value, no zero, and no bare dash. | test |
| **AC-D2** *(unchanged)* | S4 | A candidate that computed over the full row set and found no ranking effect renders a numeric value at chance with its counts, textually distinct from AC-D1 in a plain-text paste with no surrounding prose. | test |
| **AC-D4a** *(split)* | S4 | A candidate whose value is identical across every eligible row in a scope renders the **candidate constant** literal — not a chance-level value, not the absent literal. | test |
| **AC-D4b** *(split, new)* | S4 | A scope in which the label has no positives (or no negatives) renders the **label constant** literal for every candidate in that scope, naming the positive and negative counts — not a chance-level value and not the candidate-constant literal. | test |
| **AC-S3** *(restated)* | S2 | A symbol present in the slice whose rows produced no paired outcome for the requested horizon appears in the per-symbol section carrying the **no paired outcome** literal, naming the horizon and its row count — rather than being omitted from the report. | test |

The closed-vocabulary scan itself (no `n/a`, no blank, no `null`, no `NaN`, no bare dash, no bare `0`,
nothing outside the declared literal set) is **UX-6's row, not mine** — I depend on it and do not
duplicate it. My only structural addition: if any lane adds a ninth state later, it adds its literal in
the same change.

### 3.4 Conflict #15 — AC-D5. Conceded in full.

UX is right and my own AC-D1 already used the correct words for the same situation. Attribution *was*
attempted; every row lacked the input. One criterion becomes two, so the two remedies stay distinct.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-D5** *(restated)* | S4 | When the attribution block ran and no loaded row carried a driver breakdown, the block renders the **no eligible rows** literal naming how many of how many rows were checked — and prints no rows of `n = 0`. | test |
| **AC-D5b** *(new)* | S4 | When the attribution block was switched off by its flag, the block renders the **not run** literal naming that flag — never the no-eligible-rows literal, and never a blank section. | test |
| **AC-D6** *(unchanged)* | S4 | When some loaded rows carry a driver breakdown and others do not, attribution is computed on those that do and reports its reduced count plus the excluded count. | test |

Wording is UX's. UX's proposed literals — one naming the count checked, one naming the flag — satisfy
me exactly; I require only that neither word is borrowed for the other case.

---

## 4. The floor, as an owner-confirmable default (now stated)

Answering the architect's third ask and UX's fourth ask. These are the numbers; neither lane invents
one, and the copy does not have to hedge them as provisional.

- **Row floor: 30**, scoped **per cell** — per candidate × label × group. The cell is what gets
  quoted, so the cell is what carries the marker.
- **Session floor: 2 distinct trading sessions**, same scope.
- **Marker fires on EITHER floor.** A cell below 30 rows is under-powered; a cell from a single session
  is under-powered regardless of its row count. The 2026-08-11 slice — 221 rows, one 7-hour window —
  is the case that must be marked, and a row floor alone would certify it as fully powered.
- **Both floors are stated constants printed in the run**, console and artifact.
- The criteria below reference **"the floor in force as printed"**, never the literal 30. The owner can
  change either number without touching a single acceptance criterion; only the printed constant moves.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-G3a** | S5 | Every cell prints its row count **and** its distinct-session count, in console and artifact. | test |
| **AC-G3b** | S5 | A cell below the printed row floor **or** below the printed session floor renders its value and the under-powered marker as **one literal**, carrying the value, the row count and the floor it fell below. | test |
| **AC-G3c** | S5 | Both floors in force are printed as numbers once per run, in console and artifact; the marker's stated floor equals the printed floor. | test |
| **AC-G3d** *(degraded, own row)* | S5 | A cell drawn from exactly one distinct session carries the single-session marker **even when its row count is above the row floor**. | test |
| **AC-G3e** *(contrast, own row)* | S5 | A cell above both floors carries **no** under-powered marker and no single-session marker — the marker is absent on the case it does not describe. | test |
| **AC-G3f** *(encodes ruling C-2)* | S5 | No cell's value is suppressed for being below a floor. Every computed value appears in both the console and the artifact, marked. A below-floor cell is textually distinct from every absence literal, from an above-floor value, and from a blank, in a plain-text paste with no surrounding prose. | test |

AC-G3e is not padding. Without it the marker can regress to unconditional and stay green, which is the
same wallpaper failure UX-2 was retracted over.

---

## 5. Secondary labels: KEEP. (Third R1 open decision, settled.)

Direction and structure-event stay in the report, **visibly secondary**, and stay in the artifact
unconditionally. Two reasons: the structure-event contrast (0.932 beside 0.467) is one of the two
findings that motivated the feature and is the live demonstration that a coupled label manufactures a
number; and once the ring evicts a week's rows, the artifact is the **only** surviving record of that
week — a label dropped for width is unrecoverable, not deferred.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-L1** | S1 | The primary-KPI block appears before any secondary-label block in both console and artifact, and each secondary block is labelled as secondary. | review |
| **AC-L2** | S1 | The artifact contains a cell for **every** candidate × label × group in the declared grid, each carrying a state — none omitted, for width or any other reason. When the console narrows, it drops metric columns, never markers, counts or qualifiers. | test |

The coupling mark on structure-event cells is AC-G5, unchanged; the label definition riding in the same
block as the metric is UX-8, unchanged. I do not restate either.

---

## 6. Corrections carried in from the folded self-revisions (§A), stated precisely

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-C4a** *(continuity)* | S7 | A run over the **committed 2026-08-11 fixture** (a samples file and an outcomes file read through the file input path, never the live diary) reports for the composite candidate, pooled, the base rate, ranking metric and lift@top decile the pre-feature lab reported for that slice — AUC 0.467 and lift@top decile 0.17 — asserted against the retained parity oracle. | test |
| **AC-C4b** *(inversion)* | S7 | On that same fixture, the SPY cell and the QQQ cell for the composite candidate report **opposite-signed** association with the continuous outcome, and each cell states its sign. Asserted as a sign-and-ordering claim, never to two decimals. | test |
| **AC-C5** *(rescoped)* | S7 | For the same slice and horizon, the composite candidate's pooled base rate, ranking metric, precision@top decile and lift@top decile match what the pre-feature lab reported. Calibration bin edges change with the new binning rule; that change is declared by a bump of the printed report version, and both the pre- and post-change values are recorded. | test |

Hand-derived figures are **not** promoted to a test oracle. The published per-symbol lifts stay in the
write-up as comparison, prefixed as hand-derived and unvouched (UX's §6), with any divergence named and
attributed to the pooled-once threshold scoping — a divergence there is expected and is itself a
finding.

**Answering the architect's second ask — yes, carry the roll-up fields, and no, do not build the
roll-up.** Cross-run aggregation stays Out; the multi-week roll-up stays Future-dated. But once a
week's raw rows leave the ring, the artifact is the only record of that week, so the cost of omitting
them now is unrecoverable.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-P5** *(new)* | S7 | Every saved artifact records the run's report version, the **set of distinct trading session dates** covered (not merely their count), the label threshold value in force for the run, and a stable identifier per candidate that does not change when a display label is reworded. | test |

`test`, because nothing consumes these fields yet — which is precisely why a later refactor can drop
one and stay green.

---

## 7. Answers to the two asks pointed at me

- **UX's ask — is "no paired outcome" the rare branch?** It is **expected in normal weekly use**, not
  rare. The 1-day horizon needs a forward session, so the newest session in any pull routinely has
  rows and no labels; any symbol added mid-week starts there too. It gets **terminal-summary space**,
  not artifact-only space, under the width budget.
- **The architect's third ask — floor number and scope.** Answered in §4: 30 rows and 2 sessions, both
  per cell, both printed.

The standing block's bar numbers (in-run lift ≥ 1.10 on the primary label at ≥ 10 distinct sessions;
cross-artifact sustained across ≥ 3 calendar weeks) remain **owner-confirmable recommendations**, per
§B row 10. They print as the bar's own text beside the run's values; the tool never emits the outcome
of that comparison.

---

## 8. Residual — one item I cannot close myself

**"Not applicable" may have no reachable instance in v1.** UX's example was calibration on a boolean
candidate, and all five v1 candidates are continuous. If the architect cannot name a v1-reachable case,
this is the `AT BAR` defect one level down: a vocabulary state the code can never emit, with a test that
can only assert its absence. Resolution should be one of two, decided at R4 — either the architect names
the reachable case, or the state is declared **reserved and not reachable in v1**, so no criterion
asserts it and no reader waits for it. I am not asking for it to be deleted; an unreachable state that
is *declared* unreachable is honest, and an undeclared one is a dead branch.

Everything else in #2, #9, #13 and #15 is converged. **Nothing in this round needs a human call.**
