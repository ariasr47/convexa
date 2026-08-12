# R3 — architect resolution: score-lab-signal-comparison

Scope: conflict **#14** (ux → architect), conflict **#2** (architect → pm), the final
`Ineligible` / `CellState` shape under rulings C-1 (five candidates) and C-2 (marked value, nothing
suppressed), and confirmation of the two capture/read caveats. Rulings C-1 and C-2 are taken as
binding and are not re-argued. `InsufficientN` stays withdrawn.

---

## 1. Conflict #14 — ACCEPTED in full, and the hole is one notch deeper than UX found it

UX quoted my R1 §4: *"Every cell carries `n_eligible` **and** an `excluded_by_reason` map keyed by
the enum variant."* The critique is correct and I concede it without qualification: the map is a
tally of extractor returns, so it can only speak for rows that reached an extractor. A group with
zero paired rows produces an empty map, and an empty map plus a zero count is the 2026-08-11 `n = 0`
cell wearing a different hat.

**The hole is worse than stated.** In my R1 the group set was implicitly derived from the paired
rows (§5: `GroupKey = Pooled | Symbol(String)`, with pooled as the `|_| true` predicate over the
paired set). Under that construction a symbol with zero paired rows does not produce an *empty* cell
— it produces **no cell at all**, and the symbol vanishes from the report silently. That is strictly
worse than what UX described and it breaks PM's AC-S3 outright. Two mechanisms, both required:

1. **Group enumeration is an input, not a residue.** The run records `requested_symbols` before
   pairing — the CLI's symbol argument, or the distinct symbols of the loaded sample set when no
   argument is given — and `groups = {Pooled} ∪ {Symbol(s) : s ∈ requested_symbols}`. The cell grid is
   the full cross product `groups × candidates × labels`, emitted in declared order, with **no
   filtering step anywhere that can remove a coordinate**. At S = 3 and ruling C-1 that is
   `4 × 5 × 3 = 60` cells, always 60, regardless of how thin the slice is.
2. **Totality test (architect-side, `test`):** for a fixture whose symbol set includes a symbol with
   zero paired rows, the artifact contains exactly `|groups| × |candidates| × |labels|` cells and the
   set of `(group, candidate, label)` keys equals the declared cross product. This is the test that
   catches the vanished symbol; UX's proposed invariant (no `n_eligible == 0` with an empty
   `excluded_by_reason` and a state that names no group-level cause) is adopted as well, but it can
   only fire on a cell that exists.

**Fields adopted from UX's proposal, verbatim in intent:**

- `state: CellState` — **required on every cell**, including `Computed` ones. Not derived at render
  time, not optional, not omitted when the map is non-empty.
- `n_paired_in_group` — paired rows for this group at this horizon (one horizon per artifact,
  non-goal 8 unchanged).
- I add `n_samples_in_group` — loaded samples for this group before the outcome join. This is what
  separates "the diary has 74 samples for IWM and none of them joined an outcome at 30m" from "IWM
  was requested and the diary holds nothing for it". Both are `NoPairedOutcome`; the two counts in
  the literal are what distinguish them (see §2 for the one choice this leaves UX).

**A third gap I found while checking that the reconciliation actually closes.** My four `Ineligible`
variants are all candidate-side. But eligibility for a *cell* is `candidate inputs resolve` **AND**
`the label is defined for that row` — and `binary_label` returns `Option<bool>`
(`score_lab.rs:253-257` `filter_map`s the `None`s away today, silently). `up_move` is undefined when
`ret_simple` is `None`; `structure_event` is undefined when the three flags are `None`. Without a
label-side reason the closure identity in §3 fails for every label with missing values, and the
missing rows are invisible. So `Ineligible` gains a fifth variant, `LabelUndefined { label }`, and
the exclusion tally is over the union of candidate-side and label-side reasons. This is the second
place the empty-map hole leaks; UX found the first.

---

## 2. Final vocabulary — `Ineligible` (5) → `CellState` (7) → `MetricValue`

### 2.1 Row level

```rust
pub enum Ineligible {
    InputAbsent { field: &'static str },      // the field is None on the sample
    InputNonFinite { field: &'static str },   // reachable only for score / geometry — see §5
    VolScalarUnavailable,                     // neither atm_iv nor hv_30d resolved
    DegenerateInput { field: &'static str },  // resolvable but unusable (e.g. zero divisor)
    LabelUndefined { label: &'static str },   // NEW — the row carried the input, not the outcome
}
```

`Result<CandidateValue, Ineligible>` stays; `Option<f64>` stays banned from the extractor signature.

### 2.2 Cell level — one enum, seven variants, metrics live *inside* `Computed`

```rust
pub enum CellState {
    Computed { metrics: Metrics, power: Power },
    NoPairedOutcome { n_samples_in_group: usize, horizon: String },
    NoEligibleRows { by_reason: BTreeMap<ReasonKey, usize> },   // non-empty by construction
    DegenerateCandidate { value: f64, n: usize },               // every eligible value identical
    DegenerateLabel { n_pos: usize, n_neg: usize },             // no positives or no negatives
    NotApplicable { metric: &'static str, reason: &'static str },
    NotRun { block: &'static str, flag: &'static str },
}

pub enum Power {
    Powered,
    UnderPowered { n_rows, n_sessions, row_floor, session_floor, causes: Vec<PowerCause> },
}
```

Four properties this shape buys, each a mechanism rather than a promise:

- **Ruling C-2 is structural, not conventional.** `UnderPowered` is a sibling of `metrics` inside
  the same variant, so it is *unrepresentable* for a thin cell to lack its numbers. UX's R2 ask
  ("does an under-powered cell still CARRY its `auc`, `lift` and n") is answered YES,
  unconditionally, by the type. `under_powered` is also emitted as a flat derived boolean beside
  `n_eligible`, `n_sessions`, `row_floor_in_force` and `session_floor_in_force` for diffability, and
  it is a projection of `power`, computed in one place.
- **No null metric can exist.** There is no `metrics: Option<Metrics>` field to be `None` while the
  state says something else. A metric exists **iff** the state is `Computed`.
- **State is a total, pure function of the row set**, by this precedence, first match wins:
  1. block switched off → `NotRun`
  2. `n_paired_in_group == 0` → `NoPairedOutcome`
  3. `n_eligible == 0` → `NoEligibleRows` (map necessarily non-empty, since `n_paired_in_group > 0`)
  4. all eligible candidate values identical → `DegenerateCandidate`
  5. `n_positive == 0` or `n_positive == n_eligible` → `DegenerateLabel`
  6. otherwise → `Computed`
  Precedence is what makes the state→literal map total and testable. Two different runs over the
  same rows cannot land on two different states.
- **`NoEligibleRows` with an empty map is not reachable in practice** because cells are constructed
  only through one function that dispositions every paired row into eligible-or-reason before
  choosing a state. I am naming the limit honestly: the *type* does not forbid an empty map — a
  single constructor plus UX's invariant test does. If someone adds a second construction site the
  guarantee is gone, so the test is load-bearing, not decorative.

**Mapping to UX's eight-literal union:** `Computed{Powered}` and `Computed{UnderPowered}` are two
literals off one variant, and the remaining six variants are one literal each — eight literals, 1:1,
exactly UX's set. `Computed { under_powered: n, floor }` as a *separate variant* is the one thing I
decline, because it re-creates the value-destroying split ruling C-2 killed; the literal survives
intact.

### 2.3 The ninth literal UX must add — metric-level absence inside a computed cell

`CellState` is per cell; some metrics are undefined while the cell is otherwise fine. Verified:
`pearson` returns `None` for `n < 3` (`score_lab.rs:488-492`), and lift is undefined at
`base_rate == 0`. A cell with n = 2, one positive and one negative, passes precedence steps 4 and 5
and is `Computed` — with a Pearson that does not exist.

```rust
pub enum MetricValue { Value(f64), Undefined { reason: MetricUndefined } }
// MetricUndefined = TooFewRows { n, min } | BaseRateZero | NoVariationInMetricInput
```

Every scalar metric field is a `MetricValue`, never a bare `Option<f64>`. **This needs one rendering
literal that does not exist in either sibling's set** — it is not `no input`, not `no variation` (the
cell has variation), and not the under-powered atom (the cell may be well-powered for AUC and still
have no calibration bin edges). If UX declines to add it, we do not converge and it is a human call;
the alternative is printing a blank where a metric is undefined, which is `[absent-is-not-none]`
failing inside a `Computed` cell.

### 2.4 One vocabulary, every reported figure

`CellState` is the state type for **every reported figure in the artifact** — comparison cells,
driver-attribution rows, tier slices — not just the comparison grid. Two state enums would be two
vocabularies, which is the failure UX's #13 is about. That is what makes `NotRun { block, flag }`
(the `--driver-loo` case) and `NotApplicable { metric, reason }` legal members rather than a
category error. Consequence I will hold to in the grid: if the interface ever offers a
candidate/label selector, an unselected candidate still emits its cells as `NotRun { flag }` — it
never vanishes, because vanishing is indistinguishable from never having existed. (Flag names and
the CLI surface remain non-goal 10; I state only that the state exists and totality survives.)

### 2.5 Where each field lives — one correction to my own R2 proposal

Correlations are computed against the **continuous** outcome and do not involve the label, so a
per-cell Pearson would print the same number in all three label rows and manufacture three findings
from one. Corrected placement:

- **Cell**, keyed `(group, candidate, label)`: `state`, `n_paired_in_group`, `n_samples_in_group`,
  `n_eligible`, `excluded_by_reason`, `n_positive`, `base_rate`, `auc`, `precision_top_decile`,
  `recall_top_decile`, `lift_top_decile`, `top_decile_n`, `n_positive_in_top`, calibration series,
  `n_rows`, `n_sessions`, `evidence_class`, `tie_fraction`, `definitionally_coupled` + the
  intersecting field names, label rule + **threshold value**, horizon.
- **Candidate-scope record**, keyed `(group, candidate)` — 20 records at S = 3:
  `pearson_vs_ret_simple`, `pearson_vs_abs_move` (both `MetricValue`), `basis_mix`, `role`,
  `basis` expression, `n_paired_in_group`. This is where PM's replacement AC-C4(b) inversion claim
  is asserted. This also matches the shipped shape — `score_vs_abs_move` / `score_vs_ret_simple` are
  already report-scope, not label-scope, in `ScoreLabReport`.
- Both correlations are computed on the **oriented** scalar and the record says so, because
  `proximity_to_flip` ranks `-|dist_to_flip_pct|`; a Pearson on the raw signed field has the opposite
  sign and renders identically.

---

## 3. Conflict #2 — the exact two identities to encode (plus a third that is mine)

Notation for the ledger only; PM writes the AC prose. Fix a horizon. For scope `g ∈ {Pooled} ∪
{Symbol(s)}`, let `P(g) = n_paired_in_group(g)`. For a cell `(g, c, l)` let `U(g,c,l) = n_eligible`
and `E(g,c,l,r)` = the exclusion count for reason `r`.

**IDENTITY 1 — COMPOSITION** (across groups, per cell coordinate). For every candidate `c` and label
`l`:

```
U(Pooled, c, l)    = Σ_s U(Symbol(s), c, l)
E(Pooled, c, l, r) = Σ_s E(Symbol(s), c, l, r)      for every reason r
```

**IDENTITY 2 — CLOSURE** (within a single scope). For every `(g, c, l)`:

```
U(g, c, l) + Σ_r E(g, c, l, r) = P(g)
P(Pooled) = Σ_s P(Symbol(s))
```

Prose PM can paste, in PM's register:

> **Composition** — for every candidate and label, the pooled used count equals the sum of the
> per-symbol used counts, and the pooled exclusion count for each reason equals the sum of the
> per-symbol exclusion counts for that reason.
> **Closure** — within any one scope (pooled, or one symbol), the used count plus the exclusion
> counts across all reasons equals that scope's paired row count, and that count is printed.

The false form to keep out of the SPEC is *"pooled count = sum of per-symbol counts **plus**
exclusions"* — it double-counts `E` and is true only when `E = 0`. Composition is the stronger of
the two: it is the one that catches a symbol silently dropped from the per-symbol section, which is
the same defect as #14 seen from the arithmetic side. Closure only holds because of
`LabelUndefined` (§1) — without a label-side reason, rows with a missing outcome flag fall out of
both sides of the equation. UX-7's neighbouring form (`used + excluded = paired rows`) is Closure
with the scope left implicit; it must name the scope, or it is false for every per-symbol row.

Note for both identities: they hold with all terms zero for a `NoPairedOutcome` group
(`0 + 0 = 0`), so they are **universally quantified over the full 60-cell grid** with no carve-out —
which is only possible because §1 makes the grid total.

**IDENTITY 3 — PAIRED ELIGIBILITY (architect-side test, mine).** For every group `g` and label `l`:

```
U(g, net_gex_abs_raw, l)    = U(g, net_gex_vol_norm_abs, l)
E(g, net_gex_abs_raw, l, r) = E(g, net_gex_vol_norm_abs, l, r)      for every reason r
```

This is the encoded form of the control's whole point. `net_gex_abs_raw` deliberately requires a
resolvable vol scalar it does not use so raw and vol-norm are measured over the identical row set. A
future reader will see that requirement as dead code and remove it; the two AUCs then come from
different populations and the A/B is silently void. This identity is the mechanism that makes that
removal fail a test rather than pass review.

---

## 4. `net_gex_abs_raw` as a control — no new state, two other things

**No distinct `CellState` variant, and no distinct absence literal.** A control is a candidate; it
has the same five row-level reasons, the same seven cell states, the same three labels. Inventing a
control-only state would put a second word on states that already have one.

What it does need, both as data so nothing is hand-maintained in copy:

1. `role: Role` on the registry entry — `Primary` or `Control { for_candidate: "net_gex_vol_norm_abs" }`.
   UX's subordinate "controls — present so the vol-norm row can be attributed" block is then derived
   from the artifact, not from a list someone keeps in sync. The artifact also records *why* the row
   exists, which is the thing a reader six months out will not otherwise recover.
2. Identity 3 above.

Grid under ruling C-1: 5 candidates × 3 labels × 4 groups = **60 cells** and 20 candidate-scope
records. Declared order, never sorted by a metric (UX-10), holds unchanged.
`net_gex_vol_norm_signed` is out of v1 and is not carried in the artifact at all — a future-dated
candidate that ships as an empty column is a cell that reads as "we measured nothing", which is the
failure this whole feature exists to remove.

---

## 5. The two caveats — both CONFIRMED, and B is worse than I framed it at R2

### A. `with_analytics` collapses non-finite into "never carried" at capture time — CONFIRMED

`store.rs:138-149`, read this session:

```rust
let net = snap.gex.net_gex;
if net.is_finite() { self.net_gex = Some(net); }
self.iv_hv_ratio = snap.iv_hv_ratio.filter(|r| r.is_finite());
if snap.atm_iv.is_finite() && snap.atm_iv > 0.0 { self.atm_iv = Some(snap.atm_iv); }
self.hv_30d = snap.hv_30d.filter(|h| h.is_finite() && *h > 0.0);
```

`from_row` has already set all four to `None` (`store.rs:130-133`). So a non-finite `net_gex`, or an
`atm_iv`/`hv_30d` that is non-finite **or ≤ 0**, is written to the diary as `None` and is
indistinguishable at read time from "the slow lane never enriched this row" and from "the column was
NULL".

**Plainly: yes, this can produce a false "never carried" in the report** — but only for these four
analytics fields, and only for the "the value existed and was invalid" cause. Two consequences I
accept rather than paper over:

- **`Ineligible::InputNonFinite` is unreachable for `net_gex`, `atm_iv`, `hv_30d`, `iv_hv_ratio`.**
  Every one of them arrives as `InputAbsent`. It remains reachable for `score`,
  `dist_to_flip_pct` and `dist_to_wall_pct`, which `from_row` copies unfiltered
  (`store.rs:120, 125, 128`) — `score_lab.rs:157` exists today precisely because a non-finite `score`
  does occur. I withdraw the implicit R1 claim that all four variants are reachable for every input.
- **I am not proposing to change the capture filter.** NaN is not representable in JSON; the diary
  round-trips through `serde_json` on both the disk and the Postgres paths, so storing a non-finite
  would break the round-trip. The filter is load-bearing.

Therefore the fix is at the level of what the report is allowed to *claim*: the reason legend is a
field in the artifact, and for these four fields the absent reason must be worded "not carried, or
dropped at capture as non-finite/non-positive" — the literal must **not** say "never captured",
because the run cannot know that. That is a copy constraint on UX's `no input (...)` parenthetical
that comes from a verified code fact, not a preference. Optional and cheap, same class and same
rules as the §10 fold-in (log only, changes nothing appended): a `warn!` when `with_analytics` drops
a non-finite or non-positive analytic, so a live regression becomes distinguishable from an old
capture *going forward*. I recommend it; I do not make it a requirement.

### B. The base-columns fallback SELECT — CONFIRMED, and it defeats `[absent-is-not-none]` at the source

`pg_scan.rs:598-623`: any error from the full SELECT is caught, `warn!`ed, and retried with a
projection that omits `score_drivers, net_gex, iv_hv_ratio, atm_iv, hv_30d`. The decoder reads those
columns as `r.try_get("net_gex").ok().flatten()` (`pg_scan.rs:72-76`) — on the fallback projection
the column is **not in the row**, `try_get` returns `Err(ColumnNotFound)`, `.ok()` maps it to `None`,
and the sample is built with all four analytics fields `None`.

**Plainly: yes. This produces a false "never carried" for every row of the affected symbol, and
nothing in the returned data records that it happened.** Three details that make it more serious
than I framed it in R2:

1. **The trigger is not only a partial schema.** It is *any* `Err` from the full SELECT — a pool
   timeout, a cancelled statement, a transient connection reset. The comment says
   "pre-migration-6 deploys / partial schema"; the code catches everything.
2. **It is per symbol.** `read_structure_history` takes one symbol, so SPY can come back with
   analytics and QQQ without. The GEX-family per-symbol cells then compare a real population against
   an empty one, which poisons exactly the cross-symbol comparison this feature exists to produce —
   and the pooled cell silently becomes SPY-only.
3. **The only trace is a server log line.** The lab's artifact is durable and the raw rows evict
   within ~7 sessions, so a degraded run permanently records `{ vol_scalar_unavailable: 221 }` for a
   week whose rows *did* carry `net_gex`, and nothing can ever correct it.

**Resolution (mine, and I am taking it rather than listing it):** the research read path does not
accept a degraded projection. The lab loads through a **strict** read that does not fall back; a
full-SELECT failure is a hard CLI error naming the symbol and the underlying SQL error, raised
before any metric is computed and before any artifact is written. The serve path keeps its fallback
— the chart has a real availability requirement and degrades honestly there. The lab has none: it is
offline, CLI, re-runnable, and a lab that refuses to run is strictly better than a lab that records
a false absence in a file that outlives the data.

The alternative I considered and rejected: keep the shared fallback and carry provenance
(`analytics_columns_present: bool` per symbol) into a new `CellState` variant meaning "storage could
not tell us". It works, but it costs a state, a literal, and a reader who must learn a distinction
that only exists because of an error-handling shortcut. Cost comparison: strict read is one call
site and no vocabulary growth; provenance is one field, one enum variant, one literal, and a
permanent widening of the absence vocabulary. Strict read wins on both complexity and legibility.

Two things this does **not** touch: the file/JSON input path (the pinned 2026-08-11 fixture never
goes through Postgres, so §D.1's continuity criterion is unaffected), and `[additive-keeps-score-
byte-identical]` (the read path contributes nothing to `opportunity_score` / `opportunity_tier` /
`state_fingerprint`).

---

## 6. Three standing asks the types must satisfy — short answers

- **`evidence_class` scope (UX).** Both, from one function. `evidence_class(rows)` is a pure
  function of the distinct `session_date_et` count of whatever row set it is given. The **run-level**
  value is computed from the full paired row set (not the weakest cell, not a min over cells — a
  3-session run containing a 1-session symbol is honestly a 3-session run); each **cell** carries its
  own. One function, two call sites, so they cannot drift into two definitions of "session".
- **`basis_mix` (UX).** A counts map per candidate-scope record, e.g.
  `{ atm_iv: 140, hv_30d: 12, unavailable: 69 }` — not a single basis word. A cell whose divisor was
  `hv_30d` for a fifth of its rows is a mixed measurement and one word would assert otherwise. If a
  single-word rendering is needed for width, it is a derived field with a stated rule (majority, else
  `mixed`) computed from the map, never picked by the renderer.
- **`definitionally_coupled` (UX, for PM's AC-G5).** Derived, not hand-maintained: the registry
  declares `inputs: &'static [&'static str]` per candidate and per label, and the mark is
  `candidate.inputs ∩ label.inputs ≠ ∅`, emitted as a boolean **plus the intersecting field names**
  so the cell says *why* it is coupled. A hand-kept list is one candidate away from being wrong and
  silent.

---

## 7. What I withdraw, and what still needs a human

**Withdrawn (in addition to `InsufficientN`, already withdrawn at R2):**

- R1 §5's implicit derivation of the group set from the paired rows — replaced by enumeration from
  `requested_symbols` (§1).
- R1 §4's implicit claim that all four `Ineligible` variants are reachable for every input —
  `InputNonFinite` is unreachable for the four analytics fields (§5A).
- My R2 proposal to put the two Pearson figures on the cell — they belong at `(group, candidate)`
  scope (§2.5).

**Needs a human only if the sibling declines:**

- **The metric-level undefined literal (§2.3).** UX owns the wording; I need the state to have a
  literal. If UX's set stays at eight, a `Computed` cell with an undefined Pearson has nothing legal
  to render, and the fallback is a blank — which is the failure mode the closed vocabulary exists to
  prevent. This is the one genuine open item from my side.

**UX's call, types support either:** whether `NoPairedOutcome` renders as one literal with the two
counts in its parenthetical (`n_samples_in_group` = 0 vs 74), or as two literals split on
`n_samples_in_group == 0`. The remedies differ for the reader (nothing captured vs nothing joined),
so I would not object to two; I am not inventing a second literal inside UX's lane.
