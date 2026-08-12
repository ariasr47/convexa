# R3 — ux resolution: score-lab-signal-comparison

Settling #9, #13, #15 (one vocabulary), #14 (the reader-facing line I hold), plus the two items the
rulings require me to re-issue: the under-powered literal under C-2, and the evidence header with the
standing verdict withdrawn. Rulings C-1 and C-2 and §A self-revisions are taken as binding and are not
re-argued below.

---

## 1. #9 + #13 + #15 — RESOLVED. One vocabulary, three layers, eight literals.

**Converged with PM.** PM proposed extending six literals to eight; I proposed a union `CellState` of
eight over three layers. They are the *same eight*. PM's two named gaps (no-paired-outcome; splitting
"no variation") are both in; my two gaps (no-paired-outcome, and a head word that survives four
`Ineligible` reasons) are closed. Nothing in this table is new scope.

**The three layers — stated once in SPEC, never restated per section:**

| Layer | Owner | What it is | Ever rendered on its own? |
|---|---|---|---|
| L1 `Ineligible` (4: `InputAbsent{field}` · `InputNonFinite{field}` · `VolScalarUnavailable` · `DegenerateInput{field}`) | architect | why **one row** left **one candidate** | **No.** Appears only as reason text with a count, inside an L3 literal's parenthetical. Confirming the architect's R2 ask: four reasons, one literal shape, reasons inside the parens, each with its own count. Collapsing them to the word "unavailable" for width is forbidden (UX-6). |
| L2 `CellState` (8 rendering keys below) | architect (field), me (meaning of each) | the **cell's** disposition; a required field even when `excluded_by_reason` is empty | No — it selects the literal. |
| L3 rendering literal (8 shapes below) | **me** | the only strings a cell may contain | Yes — this is the whole surface. |

**Closure rule (unchanged, now over eight):** a cell contains exactly one L3 literal or a computed
value. If any lane adds an L2 variant later, it adds an L3 literal **in the same change**.

### The eight literals (exact)

| # | L2 rendering key | Exact literal shape | What is true when it prints |
|---|---|---|---|
| 1 | `Computed`, above both floors | `0.47 (n=147, sessions=4)` | computed on 147 eligible rows from 4 distinct sessions |
| 2 | `Computed`, `under_powered` | `0.47 (n=4, sessions=1 — under-powered: below row floor 30 and session floor 2)` | computed **and shown**; below the row floor, the session floor, or both — each failed floor named |
| 3 | `NoEligibleRows { by_reason }` | `no eligible rows (0 of 221 paired rows: net_gex absent 147, vol scalar unavailable 74)` | rows existed, every one was ineligible for **this candidate**; reasons and counts sum to the scope's paired rows |
| 4 | `NoPairedOutcome { n_samples }` | `no paired outcome (0 of 74 IWM samples labelled at horizon 1d)` | samples existed, nothing was labelled at this horizon — the group never reached an extractor |
| 5 | `DegenerateCandidate` | `no variation in the candidate (147 eligible rows, all = 0.00; ranking undefined)` | the candidate is constant here — remedy: look at the input/rounding |
| 6 | `DegenerateLabel` | `no variation in the label (147 rows, 0 positive / 147 negative at large_abs_move >= 0.42%; ranking undefined)` | the label is constant here — remedy: look at the threshold. Covers no-positives **and** no-negatives |
| 7 | `NotApplicable` | `not applicable (calibration is not defined for a boolean candidate)` | the metric does not exist for this candidate × label pair; the reason is mandatory |
| 8 | `NotRun { flag }` | `not run (--driver-loo off; 221 samples loaded, none examined)` | the block was switched off; nothing was examined |

### What I withdraw from my R1 §3 to make this hold

- **`too few (n=4, floor 30)` — dead.** Replaced by literal 2 per C-2. Nothing is suppressed anywhere.
- **`undefined (base rate 0.00)` — withdrawn.** It could not express the no-**negatives** case
  (base rate 1.00), and its head word named no cause. Absorbed into literal 6.
- **`— not applicable` → `not applicable (...)`.** The leading em dash was a banned carrier in my own
  §3, and a leading-punctuation literal trims to a bare `not applicable` with the reason gone.
- **`no input (...)` → `no eligible rows (...)`.** `no input` is only true for `InputAbsent`; it
  **renames** `InputNonFinite`, `VolScalarUnavailable` and `DegenerateInput`. That is my own defining
  failure mode and I am withdrawing the head word, keeping the count-and-reason parenthetical.
- **UX-7's scope slip** (accepted from the architect's #2): closure is `used + excluded = **that
  scope's** paired rows`, never the pooled total.

### #15 — the wording that is true

Attribution **was attempted on every sample**; no sample carried the input. So:

- attempted, nothing eligible → literal **3**, e.g.
  `no eligible rows (0 of 221 samples carried score_drivers)`
- switched off, nothing examined → literal **8**: `not run (--driver-loo off; 221 samples loaded, none examined)`

**`not attempted` is retired as a phrase** — it is only true of literal 8, where `not run` already says
it more precisely. AC-D5's text should carry literal 3's wording, which also restores consistency with
PM's own AC-D1.

---

## 2. #14 — the line I hold (architect answering)

The reader must be able to tell these three apart **from the cell alone**, because they have three
different remedies:

| Cell reads | Cause | Remedy the operator takes |
|---|---|---|
| literal 4 `no paired outcome (...)` | group had **zero paired rows** — no row reached an extractor, so `excluded_by_reason` is legitimately **empty** | run the join / wait for outcomes at this horizon |
| literal 3 `no eligible rows (...)` | group had paired rows; **all** were ineligible — `excluded_by_reason` is non-empty and reconciles | the field is not being captured |
| literal 8 `not run (...)` | block switched off — nothing examined | turn the flag on |

What that requires of the data, and all it requires: `state` as a **first-class required field** (not
derived from the reason map) plus `n_paired_in_group`, so `n_eligible + Σ excluded_by_reason =
n_paired_in_group` reconciles and an empty reason map is *explained* rather than merely empty.

**UX-21 (new AC):** a cell with `n_eligible = 0` and an empty `excluded_by_reason` renders literal 4 or
literal 8 and never literal 3; the three are pairwise non-identical strings. **Verify by: test** — this
is the 2026-08-11 `n = 0` failure returning one level up, and it is invisible to review.

*Residual:* if the architect declines a required group-level `state` field and keeps the reason map as
the only carrier, literal 4 has no source and #14 is **unresolved and needs a human call**. I do not
expect that — `CellState` is his own construct — but I am naming the condition rather than assuming it.

---

## 3. C-2 — the under-powered literal, and the distinctness proof

Ruling taken. Shape is PM's (value + n + marker in one atom). Two refinements the already-folded §A
row 6 forces, neither of which touches the ruling: the atom carries **`sessions=`** as well as `n=`,
and it **names which floor was missed** — because "under-powered" over 221 autocorrelated rows from one
session is a different fact from "under-powered" over 4 rows across six sessions.

**Plain-text paste, no surrounding prose — every literal, a bare above-floor value, and a blank:**

```
0.47 (n=147, sessions=4)
0.47 (n=4, sessions=6 — under-powered: below row floor 30)
0.47 (n=221, sessions=1 — under-powered: below session floor 2)
0.47 (n=4, sessions=1 — under-powered: below row floor 30 and session floor 2)
no eligible rows (0 of 221 paired rows: net_gex absent 147, vol scalar unavailable 74)
no paired outcome (0 of 74 IWM samples labelled at horizon 1d)
no variation in the candidate (147 eligible rows, all = 0.00; ranking undefined)
no variation in the label (147 rows, 0 positive / 147 negative at large_abs_move >= 0.42%; ranking undefined)
not applicable (calibration is not defined for a boolean candidate)
not run (--driver-loo off; 221 samples loaded, none examined)

```

**Why that paste is unambiguous:**

1. **First character partitions it.** A digit or `-` ⇒ a computed value. A lowercase letter ⇒ an
   absence. No literal begins with punctuation or whitespace.
2. **Marked vs. bare value.** Both start with digits; the marked one contains the required substring
   `— under-powered:`, which appears in **no** other literal and in no bare value. A bare above-floor
   value can therefore never be mistaken for a thin one, or the reverse, after any amount of copying.
3. **Marked vs. absence.** No absence literal contains a leading numeral, so a thin *number* and *no
   number* never collide — this is the `[absent-is-not-none]` axis the ruling protects at both ends.
4. **Absence literals vs. each other.** Heads are `no eligible rows` · `no paired outcome` ·
   `no variation in the candidate` · `no variation in the label` · `not applicable` · `not run`. No
   head is a complete other literal, and every one differs by its second token.
5. **Vs. a blank.** Every literal has non-zero length and a non-whitespace first character; a blank
   cell has length zero. `n/a`, `null`, `NaN`, `-` and a bare `0` are banned outright (UX-6), so the
   empty string is not reachable as a rendering.
6. **Truncation is detectable.** Every literal ends in `)` and contains exactly one balanced
   parenthetical, so a width-saving cut leaves an unbalanced paren rather than a shorter true-looking
   string. **UX-23 (new AC):** no rendered cell ends without its closing paren. **Verify by: test** —
   this is the exact width pressure I named as R1 risk 6.
7. **Layout consequence I own:** the stdout summary is **candidate-major line blocks, not a column
   grid**. Literal 2's longest form is 78 characters; a fixed-width grid cannot hold it without
   dropping the qualifiers, and the qualifiers are the honesty. Fewer metrics per line, never shorter
   literals (R1 risk 6 stands).

*Owner-visible consequence of a number that is not mine:* PM recommends a session floor of **2**, which
is what makes every single-session cell — including the entire 2026-08-11 slice — carry the marker. A
session floor of 1 removes the marker from exactly the slice that motivated the feature. Row floor 30
is PM's. I author neither; the copy prints the floor in force verbatim.

---

## 4. The evidence header, standing verdict withdrawn (facts only)

Block renamed from **Standing** to **Evidence** — "standing" implies a verdict, and there is no longer
one. First block of stdout and of the artifact, before any number; one-line repeat at the end of stdout.

```
RESEARCH READ — NOT A PRODUCT RULING
  Evidence:   SINGLE SESSION (d=1) · symbols: SPY, QQQ, IWM
  This run:   2026-08-10 17:15–23:58 UTC (6h43m) · 221 paired rows · horizon 1d
  Bar (runbook text, printed beside the run's values; this run does not evaluate it):
              large_abs_move lift @ top decile >= 1.10, sustained across >= 10 sessions
              spanning >= 3 calendar weeks
  Not evaluable here: the multi-week half spans more sessions than one run can hold — the raw
              diary keeps about 7 sessions per symbol (STRUCTURE_HISTORY_MAX = 576).
  Authorizes: nothing. No weight, constant, gate threshold or fingerprint basis changes on the
              strength of this run.  [score-change-is-deliberate-and-measured]
  Ranking a candidate signal here is not adopting it.
```

- **`Evidence:` is the varying token and is facts only** — derived from `n_sessions` over the full
  paired set and from the group set. Closed set: `SINGLE SESSION (d=1)` · `MULTI-SESSION (d=3)` ·
  `MULTI-WEEK (d=11, span 18 calendar days)`. `d` = distinct trading sessions, always.
- **Symbol scope is a second, independent fact** on the same line (`symbols: SPY` when one survives),
  not a third enum value — two facts can be true at once and the block shows both.
- **`BELOW BAR` / `AT BAR` are gone**, and so is **`INSUFFICIENT — cannot evaluate`**. Answering PM's
  R2 ask directly: my vocabulary does **not** need a fifth value for the un-evaluable multi-week half,
  and adding one would re-create the dead branch. Because the tool never evaluates the bar, there is no
  state meaning "we could not evaluate it" — there is a **fact line** saying the multi-week half is not
  evaluable from one run, and why.
- **The comparison outcome is never emitted.** The bar's text and the run's values sit adjacent; no
  token whose value depends on comparing them is printed.
- `MULTI-WEEK` stays in the enum because it is a pure function of the data and would be silently wrong
  to omit if retention ever changes; the artifact states it is unreachable under the current cap and
  why (the architect's own `bar_evaluable_from_single_run` shape).
- The three bar numbers (1.10, 10 sessions, 3 calendar weeks) are **PM's recommendations pending the
  owner**. My copy prints whatever is in force; if a bar number in the synthesized SPEC was authored by
  me, that is a defect (R1 risk 8 stands).

**UX-2 (restated, replaces the withdrawn version):** the run's evidence class is derived from
`n_sessions` and the group set, never a constant, and contains no pass/fail token.
**Verify by: test** — two fixtures (1 session vs 3 sessions) must emit different evidence-class
tokens, and a scan asserts no cell or header contains `AT BAR`, `BELOW BAR`, `PASS`, `FAIL`, `MEETS`,
`above the bar` or `below the bar` (this is the derivation half; AC-G4 covers adoption language).

---

## 5. C-1 — five candidates: declared order and labels

Declared order (UX-10 binds it; **never** sorted by a metric). Grid is 5 × 3 labels × (1 pooled + 3
symbols) = **60 cells**. AC-C1's printed set and count are these five, in this order:

| # | key | Approved label, rendered with its basis inline |
|---|---|---|
| 1 | `opportunity_score` | **Composite opportunity score** |
| 2 | `net_gex_vol_norm_abs` | **Vol-normalized GEX magnitude** `(ranked on |net GEX| / vol scalar; basis mix: ATM IV 140, HV 30d 12, unavailable 0)` |
| 3 | `net_gex_abs_raw` | **Raw GEX magnitude — control** `(ranked on |net GEX|; same eligible rows as the row above, so a vol-norm result can be attributed to the normalization)` |
| 4 | `proximity_to_flip` | **Closeness to flip** `(ranked on -|signed distance to flip, %|; higher = nearer)` |
| 5 | `proximity_to_nearer_wall` | **Closeness to nearer wall** `(ranked on -|signed distance to nearer wall, %|; higher = nearer)` |

- Row 3 prints **immediately after** row 2 and carries the control marker in its own label, not in a
  legend — it is a control, and "control" must survive a paste of one line. With five candidates the
  subordinate control *block* I asked for in R2 is unnecessary; one marked row is enough.
- `net_gex_vol_norm_signed` appears nowhere — not as a row, not as a greyed placeholder, not as a
  footnote promising it later. An absent candidate must be absent.
- Answering the architect's R2 ask on UX-11's "per row": **per report row (cell)**, and the honest
  cell-level field is the **counts triple** — `basis mix: ATM IV 140, HV 30d 12, unavailable 0`. Never
  a single basis word, and never the lone word "mixed". `basis_mix` as he proposed it is exactly right.
- `evidence_class` for the header must be computed **run-level from the full paired set**, not taken
  from the weakest cell — the header describes the slice. Cells carry `n=` and `sessions=` as facts.

---

## 6. Acceptance criteria touched, with `Verify by`

| ID | Criterion (restated / new) | State(s) | Verify by | Why |
|---|---|---|---|---|
| UX-2 | Evidence class derived from `n_sessions` + group set, never constant, no pass/fail token | all | **test** | Regresses to a hardcoded string invisibly; the constant hedge is the current failure |
| UX-3 | Evidence-header wording matches §4 verbatim, incl. "Ranking a candidate signal here is not adopting it" | all | **review** | Visible, intentional copy |
| UX-4 | Every cell renders exactly one of the eight §1 literals or a computed value; L1 reasons appear only inside a parenthetical, each with a count | all | **test** | Closed-vocabulary invariant, mechanically scannable |
| UX-5 | The eight literals plus a bare above-floor value are pairwise distinct in a plain-text paste with no surrounding prose (§3) | all | **test** | The distinction *is* the feature; a snapshot of one literal proves nothing without the contrast set |
| UX-6 | `n/a`, blank, `null`, `NaN`, `-`, bare `0` appear in no cell | all | **test** | One-line "cleanup" reintroduces it; today's `main.rs:655`/`:659` are live instances |
| UX-7 | Every candidate row prints `n = <used> (excluded <k>: <reason>)`; used + excluded = **that scope's** paired rows | default, partial | **test** | Off-by-one is invisible; scope corrected per architect #2 |
| UX-10 | Declared candidate order (§5) and input symbol order; never sorted by a metric | all | **test** | `sort_by(auc)` is green and converts a measurement into a leaderboard |
| UX-20 | The under-powered value, its `n=`, its `sessions=` and the marker render as **one atom** — no line break, column boundary or truncation may separate the number from its marker | default, partial | **test** | A separated marker is a bare thin number, which is the whole danger C-2 names |
| UX-21 | `no paired outcome` / `no eligible rows` / `not run` are pairwise distinct, and a zero-row group never renders `no eligible rows` | partial, degenerate | **test** | The `n = 0` failure returning one level up (#14) |
| UX-22 | No candidate label uses "distance" unqualified by its sign treatment | all | **test** | A later width-saving edit silently reintroduces it |
| UX-23 | No rendered cell ends without its closing paren | all | **test** | Truncation guard; width pressure is the named regression path |
| UX-24 | Row 3 prints its control marker in its own label, adjacent to row 2 | default | **review** | Visible ordering and copy |

Unchanged from R1 and not re-listed: UX-1, UX-8, UX-9, UX-11 (with §5's counts-triple reading), UX-12
through UX-19.

---

## 7. What is not settled here

1. **#14's data half** — pending the architect's answer. Blocking only if he declines a required
   group-level `state` field (§2 residual); then it needs a human call.
2. **The two floor numbers** (row 30, session 2) and the three bar numbers are the owner's. My copy
   prints them verbatim and I author none of them.
3. Nothing else. #9, #13 and #15 are converged with PM; C-1 and C-2 are implemented above as ruled.

---

## R3 exchange 2 — metric-level absence literal

§2's residual and §7.1 are closed: the architect's R3 accepted the required group-level `state`,
`n_paired_in_group` and `n_samples_in_group`, and enumerates groups from `requested_symbols` before
pairing. This section answers only the gap that finding exposed.

### 8.1 The gap is real, and it is a new *layer*, not a ninth `CellState`

The cell is `Computed` and may be well above both floors. One **individual metric inside it** has no
value. My eight literals cannot express this because all eight are dispositions of the **whole cell** —
rendering any of them here would assert that a trustworthy cell is untrustworthy, which is my defining
failure mode pointed the other way.

So the vocabulary gains a **fourth layer, not a ninth state**:

| Layer | What it disposes | Cardinality |
|---|---|---|
| L2 `CellState` | the cell | 8 rendering keys — **unchanged** |
| **L2m `MetricState`** (new) | **one metric within a `Computed` cell** | 2 rendering keys |

`MetricState` is only legal where `CellState = Computed`. **Precedence rule:** if the cell has a
cell-level disposition (literals 3–8), that literal renders and no metric-level literal appears — a
metric cannot be "undefined" inside a cell that was never computed. This is what keeps the two layers
from ever printing two different words for the same fact.

### 8.2 Two literals, not one — same test I applied to `no variation`

I split `no variation` because a constant *candidate* and a constant *label* are different facts with
different reader remedies. The same test applied here splits the same way:

| Cause | What the reader concludes | Remedy | Verdict |
|---|---|---|---|
| the statistic's **own** input set is smaller than the statistic's minimum (`pearson` needs 3 usable pairs; a cell of 147 eligible rows can have 2 usable pairs, because the continuous outcome is absent on the rest) | "wait — this number will exist later" | more sessions / more labelled outcomes | **literal 9** |
| the statistic is **undefined on this data** — a precondition of the statistic itself fails (zero denominator; an input series with no variance) | "waiting will not help — the scope or the threshold is the thing to look at" | change the scope or the threshold; nothing accumulates into a value | **literal 10** |

They are as different as literals 5 and 6, and collapsing them would tell a reader to wait for a number
that can never arrive. Split.

### 8.3 The two literals (exact)

| # | L2m key | Exact literal shape |
|---|---|---|
| 9 | `MetricUnderMinimum { stat, needs, have }` | `not enough rows for this statistic (pearson needs 3 usable pairs; 2 of 147 eligible rows)` |
| 10 | `MetricUndefinedOnThisData { stat, precondition }` | `undefined for this data (pearson needs the outcome to vary; abs_move is constant at 0.42 across 147 rows)` |

Shapes, which are the binding part (the parentheticals above are instances):

- 9 — `not enough rows for this statistic (<stat> needs <minimum> <unit>; <have> of <cell n> eligible rows)`
- 10 — `undefined for this data (<stat> needs <precondition>; <the fact that fails it>)`

Both carry the **statistic's own n**, which is a distinct fact from the cell's `n=`. That distinction is
the whole point: a cell may be `n=147` and a statistic inside it may have 2 usable pairs, and a reader
who sees only the cell's n would compute the wrong confidence in the missing number.

Second instance of literal 10, the lift case:
`undefined for this data (lift needs a non-zero base rate; 0 positive of 147 rows at large_abs_move >= 0.42%)`

**Reachability, stated so this is not a dead branch.** Under the precedence rule, a base rate of 0 over
the whole cell makes the cell `DegenerateLabel` (literal 6) and lift never reaches literal 10 by that
path. Literal 10 is still required and still live, for two reasons that are not arguments about
likelihood: (a) `pearson` with a constant continuous outcome is reachable and is covered by **no**
cell-level state — `DegenerateLabel` is about the *binary* label, not the continuous outcome; and
(b) the zero-denominator guard exists in code regardless of how often it fires, and **it has to render
something** — the current answer is a blank, which is unavailable to me. A literal that is the output of
an existing guard is not a dead branch; a *verdict* nothing can produce was.

### 8.4 Distinctness — plain-text paste, no surrounding prose

```
0.47 (n=147, sessions=4)
0.47 (n=4, sessions=6 — under-powered: below row floor 30)
0.47 (n=221, sessions=1 — under-powered: below session floor 2)
0.47 (n=4, sessions=1 — under-powered: below row floor 30 and session floor 2)
no eligible rows (0 of 221 paired rows: net_gex absent 147, vol scalar unavailable 74)
no paired outcome (0 of 74 IWM samples labelled at horizon 1d)
no variation in the candidate (147 eligible rows, all = 0.00; ranking undefined)
no variation in the label (147 rows, 0 positive / 147 negative at large_abs_move >= 0.42%; ranking undefined)
not applicable (calibration is not defined for a boolean candidate)
not run (--driver-loo off; 221 samples loaded, none examined)
not enough rows for this statistic (pearson needs 3 usable pairs; 2 of 147 eligible rows)
undefined for this data (pearson needs the outcome to vary; abs_move is constant at 0.42 across 147 rows)

```

Why the two new strings collide with nothing:

1. **Vs. a bare value and vs. the under-powered atom** — both start with a lowercase letter, so §3's
   first-character partition still holds: digit ⇒ a number is present, letter ⇒ no number here.
   Neither contains `— under-powered:`, so neither can be read as a thin value.
2. **Vs. the six cell-level absence heads** — head tokens are now
   `no eligible rows` · `no paired outcome` · `no variation in the candidate` ·
   `no variation in the label` · `not applicable` · `not run` · **`not enough rows for this statistic`** ·
   **`undefined for this data`**. `not enough` differs from `not applicable` / `not run` at the second
   token. `undefined for this data` shares no first token with anything. No head is a prefix of another
   complete literal.
3. **Vs. the retired `undefined (base rate 0.00)`** — the head is the four-word `undefined for this
   data`, never a bare `undefined`. UX-6's scan must reject the string `undefined (` so the retired
   literal cannot creep back in as an abbreviation of the new one.
4. **Vs. a blank** — non-zero length, non-whitespace first character, same as every other literal.
5. **Truncation guard** — both end in `)` with exactly one balanced parenthetical, so UX-23 covers them
   unchanged. Both are within 110 characters, which the candidate-major line-block layout (§3.7) holds;
   neither may be shortened by dropping the semicolon clause, because that clause is the reason.
6. **"The cell is still trustworthy" is carried structurally, not by words.** The literal replaces
   **one metric's value on that metric's own line**, inside a cell whose sibling metrics render their
   numbers normally, and the cell's own `n=`/`sessions=` are unchanged. No wording is added to say
   "the rest is fine" — the rest visibly *is* fine, and a per-instance reassurance would be prose that
   drifts.

Rendered in place, which is what a reader actually sees:

```
  AUC       0.63 (n=147, sessions=4)
  Lift@10   1.21 (n=147, sessions=4)
  Pearson   not enough rows for this statistic (pearson needs 3 usable pairs; 2 of 147 eligible rows)
```

### 8.5 Acceptance criteria — additions only

| ID | Criterion | State(s) | Verify by | Why |
|---|---|---|---|---|
| UX-25 | A metric with no value inside a `Computed` cell renders literal 9 or literal 10 — never a blank, never `n/a`, never a cell-level literal, never a substituted `0` | default, partial | **test** | This is `[absent-is-not-none]` at metric granularity, inside a cell that otherwise looks fully trustworthy — the most quotable place a blank can hide |
| UX-26 | A metric-level literal changes neither the cell's `CellState` nor its `n=`/`sessions=`, and sibling metrics in the same cell still render their values | default | **test** | The failure is contagion — one undefined statistic silently demoting a valid cell, or the reverse |
| UX-27 | Literal 9 prints the **statistic's own** usable count and the statistic's minimum; it never reuses the cell's `n=` as the statistic's n | default, partial | **test** | Reusing the cell's n is the silent, plausible-looking wrong number — a reader would compute the wrong confidence in what is missing |
| UX-28 | Literal 10 names the failed precondition and the fact that failed it; the string `undefined (` (bare, no reason) appears nowhere | all | **test** | The retired `undefined (base rate 0.00)` returns as an abbreviation under width pressure |

UX-4, UX-5 and UX-6 extend from eight strings to **ten**; the closure rule is otherwise unchanged, and
adding an L2m variant later requires its literal in the same change, exactly as for L2.
