# R1 — architect position: score-lab-signal-comparison

## Position

### 0. Ground truth I verified in code (not taken from prose)

Everything below is built on these, each read this session in the Rust tree (the Python paths in older
canon are archived and irrelevant):

1. **`score_lab.rs` is structurally single-scalar.** `ScoreLabRow.score` is a bare `f64`, not
   `Option<f64>`, and `pair_samples_outcomes` drops any sample whose `score` is not finite
   (`score_lab.rs:157`). Every metric function (`label_metrics`, `man_whitney_auc`,
   `top_decile_precision_recall`, `calibration_curve`) reads `r.score` directly. The one-scalar
   assumption is in the **type**, not in the call sites, so generalizing means changing the row type,
   not adding a parameter.
2. **The `large_abs_move` threshold is slice-relative and recomputed per row.**
   `binary_label(row, LargeAbsMove, all)` re-collects and re-sorts every `abs_move` in `all` on
   **every call** (`score_lab.rs:289-301`), and `calibration_curve` calls it once per member per bin.
   Today that is O(n^2 log n) at n=221. Multiplied by candidates x groups it becomes
   O(n^2 * c * g * log n). This is a cost fact, not a style opinion.
3. **The geometry fields are SIGNED, not distances.** `projection.rs:25-45`:
   `signed_dist_pct = ((price - level)/price) * 100`, rounded to 2dp, and `nearer_wall_dist` picks the
   wall with the smaller absolute gap but **returns the signed value**. So `dist_to_wall_pct` is
   negative when the nearer wall is the call wall and positive when it is the put wall. Ranking that
   raw does not test "near a wall" — it tests "below the call wall vs above the put wall", which is a
   different and largely meaningless hypothesis. The BRIEF's phrase "distance-to-flip /
   distance-to-wall" hides this.
4. **The vol-norm inputs are captured and unit-aligned, but the shipped entry point is unusable
   here.** `loop.rs:466-472` appends every structure sample through `with_analytics`, which sets
   `net_gex`, `iv_hv_ratio`, `atm_iv` (decimal) and `hv_30d` (percent) from the same
   `AnalyticsSnapshot` that produced the row; `pg_scan.rs:428-453` persists all four columns and
   `:586` reads them back. But `vol_gex::vol_normalize_gex` requires `call_gex`, `put_gex` and
   `total_gex`, **which the sample does not carry**. The reusable shipped piece is
   `resolve_vol_scalar(Option<IvDecimal>, Option<HvPercent>)` plus one divide — see §8.
5. **The diary is a ring buffer, not an archive.** `store.rs:29-31`: `STRUCTURE_HISTORY_MAX = 576`
   per symbol, `STRUCTURE_HISTORY_MIN_INTERVAL_SECS = 300`, and `pg_scan.rs:488` prunes to the same
   cap in Postgres. At one sample per 5 minutes over a 6.5h RTH session that is ~78 samples/day, so
   the retained window is **~7 sessions per symbol**, not the "~2 RTH weeks" the comment claims. The
   BRIEF's premise ("the diary is accumulating daily") is true for the *artifacts*, not for the raw
   rows. This has a direct design consequence (§7, §12).
6. **`from_row` nulls the analytics fields** (`store.rs:130-133`) and only `with_analytics` fills
   them. Any sample constructed off the fast/price-only path would carry `net_gex: None`. Today only
   the slow lane appends, so this is currently safe — but it is a code path, not a guarantee, and it
   is exactly the shape of the failure that produced the all-null `score_drivers` cells.

### 1. Binding constraints I restate (and how each is *enforced*, not remembered)

- **`[score-change-is-deliberate-and-measured]`** — this feature measures only. Enforcement is a
  **module-boundary direction**: `services::research` may import `services::scanner::store` types
  read-only; nothing under `services::scanner`, `signals`, `projection.rs` or `quant-engine`'s scoring
  path may import `services::research`. The dependency arrow is one-way, so a scoring input from the
  lab is a compile-time impossibility, not a review catch.
- **`[additive-keeps-score-byte-identical]`** — the feature's diff touches **zero** file that
  contributes to `opportunity_score` / `opportunity_tier` / `state_fingerprint`. The one exception I
  am proposing (§10) is a `warn!` log in `loop.rs` that reads already-computed values and appends the
  same sample it appends today.
- **`[operator-vs-trader-path-separation]`** — the lab is CLI + file artifact. **No HTTP route, no
  handler, no `AppState` read at serve time, no cache mutation, no vendor call.** `cmd_score_lab`
  already runs with an empty `MASSIVE_API_KEY` (`main.rs:511-554`); that offline property is part of
  the contract, and the comparison path must not regress it.
- **`[model-read-carries-its-assumptions]`** — every metric cell carries, *as fields*, its horizon,
  its label rule **and threshold value**, its candidate's basis expression, its row count, its
  **distinct-session count**, and (for vol-norm) the mix of vol bases used. The 2026-08-11 doc's
  hand-written "Not a product ruling" blockquote becomes a machine-readable field (§7).
- **`[absent-is-not-none]`** — a cell that cannot be computed states *which* of the reasons applies
  through a closed enum, never a bare `null` and never a `0`. The driver cells that all read `n = 0`
  are the exact failure this must make impossible.
- **`[best-effort-isolated-or-null]`** — a sample missing one candidate's input is excluded from
  **that candidate only**, counted by reason, and still participates in every other candidate. A
  candidate that yields zero eligible rows still emits a row in the report; omitting it would be
  indistinguishable from "we never tried it".
- **Vol-norm GEX stays a magnitude read.** Ranking it here is not adopting it. No `net_gex_vol_norm`
  field is added to `StructureSample` (§8, §12).

### 2. Component boundaries and data flow

One new module beside the existing two, and one generalized pairing step:

```
scanner::store::StructureSample  ─┐
                                  ├─► research::pairing   → Vec<LabRow>        (score-agnostic)
research::outcomes::StructureOutcome ─┘
                                          │
                                          ├─► research::candidates  (registry: pure fn per signal)
                                          │        extract(&LabRow) -> Result<f64, Ineligible>
                                          │
                                          ├─► research::labels      (thresholds computed ONCE)
                                          │
                                          └─► research::comparison  (group x candidate x label → Cell)
                                                       │
                                                       └─► artifact (main.rs cmd)
```

- `candidates` is **pure and I/O-free**, depends only on `StructureSample` + `quant_engine::vol_gex`
  + `quant_engine::vol_units`. It knows nothing about grouping, metrics, or artifacts.
- `comparison` owns the metric math; it consumes an *already-oriented, already-eligible* `Vec<f64>`
  paired with `Vec<bool>` labels. It never touches a `StructureSample`. This is the boundary that
  makes adding a candidate a registry entry rather than a metrics change.
- `main.rs` stays the only place doing file I/O and store access. Loading, filtering and artifact
  writing are unchanged in kind.
- `evaluate_baseline` / `ScoreLabReport` are **not deleted**; they become the parity oracle (§11).

### 3. The candidate-signal registry (data-structure content)

A candidate is a value, not a match arm:

```rust
pub struct CandidateSignal {
    key: &'static str,          // stable identity, e.g. "opportunity_score"
    family: CandidateFamily,    // Score | GexMagnitude | LevelGeometry
    orientation: Orientation,   // declared; extractor returns an ALREADY-oriented scalar
    basis: &'static str,        // the exact expression + units, verbatim into the artifact
    extract: fn(&LabRow) -> Result<CandidateValue, Ineligible>,
}
```

`orientation` is the fix for finding 3. Every extractor returns a scalar where **higher means "more
of the hypothesis"**, and the descriptor records which raw field it came from and whether it was
negated. Without this, `proximity_to_flip` would report AUC ~0.2 and read as "level geometry is
anti-predictive" when the hypothesis is the opposite; and `top_decile_precision_recall` (which sorts
descending) would score the *farthest* rows.

v1 set — six candidates, three families, all derivable from captured fields:

| key | family | oriented scalar | inputs required |
|---|---|---|---|
| `opportunity_score` | Score | `score` | `score` |
| `net_gex_vol_norm_abs` | GexMagnitude | `abs(net_gex) / vol_scalar` | `net_gex` + (`atm_iv` or `hv_30d`) |
| `net_gex_vol_norm_signed` | GexMagnitude | `net_gex / vol_scalar` | same |
| `net_gex_abs_raw` | GexMagnitude | `abs(net_gex)` | `net_gex` **+ a resolvable vol scalar** (see below) |
| `proximity_to_flip` | LevelGeometry | `-abs(dist_to_flip_pct)` | `dist_to_flip_pct` |
| `proximity_to_nearer_wall` | LevelGeometry | `-abs(dist_to_wall_pct)` | `dist_to_wall_pct` |

Two of those need defending:

- **`net_gex_abs_raw` is the control, and it is load-bearing.** Without it, a strong
  `net_gex_vol_norm_abs` row cannot be attributed to the *normalization* rather than to GEX magnitude
  itself, and the report would let someone argue for vol-norm on evidence that never tested it. This
  is the "true hist A/B" X2 §"Suggested remaining work" item 4 wants, and it costs one registry entry.
- **Paired eligibility.** `net_gex_abs_raw` deliberately requires a resolvable vol scalar it does not
  use, so that raw and vol-norm are evaluated over the **identical row set**. Otherwise raw gets extra
  rows (those with no IV/HV) and the two AUCs are computed on different populations — a confound that
  is invisible in the output. The eligibility predicate is a property of the *comparison pair*, and I
  am encoding it in the extractor rather than in a note.

`iv_hv_ratio` extremity (`abs(iv_hv_ratio - 1)`) is a natural seventh candidate and is deliberately
**out of v1** — the point of the registry shape is that adding it later is one entry and zero changes
to `comparison`. If that is not true when the executioner gets there, the boundary in §2 is wrong.

### 4. Row and eligibility model (isolation rules)

```rust
pub struct LabRow {
    sample: StructureSample,      // whole sample, not a projection of one scalar
    horizon: String,
    session_date_et: Option<String>,
    ret_simple: Option<f64>,
    abs_move: Option<f64>,
    hit_call_wall: Option<bool>,
    hit_put_wall: Option<bool>,
    crossed_flip: Option<bool>,
}
```

- **Pairing becomes score-agnostic.** The `score.filter(is_finite)` drop at `score_lab.rs:157` must
  move out of pairing and into the `opportunity_score` extractor. Today a sample with `net_gex` but no
  `score` never reaches the lab at all; after the change it is an `Ineligible::InputAbsent{"score"}`
  for one candidate and a full participant in the other five. Leaving that drop in pairing is a direct
  `[best-effort-isolated-or-null]` violation, and it is silent.
- **`Ineligible` is a closed enum, and `Option<f64>` is banned from the extractor signature.**
  `InputAbsent { field }` · `InputNonFinite { field }` · `VolScalarUnavailable` ·
  `DegenerateInput { field }` (e.g. `net_gex == 0.0` with a zero divisor). `Option` collapses four
  distinguishable states into one and is precisely how the driver cells came to read `n = 0` with the
  explanation living in a human's paragraph. `Result<_, Ineligible>` makes it impossible to obtain a
  number without dispositioning the reason — `[structural-over-prose-enforcement]`.
- Every cell carries `n_eligible` **and** an `excluded_by_reason` map keyed by the enum variant. A
  reader of the 2026-08-11-shaped failure would have seen
  `{ input_absent_score_drivers: 74 }` instead of `n = 0`.
- No candidate's ineligibility aborts the run or affects another candidate's row set. The CLI errors
  only where it errors today: zero paired rows for the horizon (`main.rs:605-612`).

### 5. Grouping, and how per-symbol composes with pooled

`GroupKey = Pooled | Symbol(String)`. **Pooled is not a special case** — it is a group whose
membership predicate is `|_| true`. The evaluator is called once per group with the same signature,
so there is exactly one metrics code path and pooled/per-symbol cannot drift apart. (The 2026-08-11
per-symbol table was hand-computed precisely because there was no second path; adding one is not the
fix.)

The report is a **flat vector of cells** keyed `(group, candidate, label)`, not a nested
group→candidate→label tree. Flat is the right shape because every consumer of this artifact is a
filter/pivot ("all cells for `large_abs_move`", "all cells for QQQ"), and a flat vector makes cell
count, cell absence and cell comparison trivially checkable. Nesting optimizes for a traversal nobody
performs.

Cell count for v1: `(1 pooled + S symbols) x 6 candidates x 3 labels`. At S=3 that is 72 cells. That
is the honest cost of "comparative and per-symbol by default", and it is why §7's suppression rules
matter more than the metrics themselves.

Regime grouping (`regime`, `vol_regime` — both captured on the sample) is admitted by the `GroupKey`
shape and is **explicitly out of v1** (§12).

### 6. Label and threshold scope — the one decision that can silently invalidate the report

`large_abs_move` is defined relative to the **median of the evaluation set**. That definition
interacts with grouping in a way that will be wrong by default:

- If the median is computed **per group**, every symbol's base rate is pinned to ~0.50 by
  construction, and SPY's lift and QQQ's lift are measured against *different bars*. Cross-symbol
  comparison — the entire point of the feature — becomes meaningless while looking fine.
- If the median is computed **per candidate** (i.e. over that candidate's eligible rows), two
  candidates get different positive sets and their AUCs are not comparable either.

**Position: the label threshold is computed exactly once per (horizon, slice), over the full paired
row set, before any grouping or candidate eligibility filtering, and is held fixed across every
cell.** Consequences that are features, not bugs: per-symbol base rates become *informative*
(a symbol that moved more than the pool shows a base rate above 0.5), and lift is comparable across
groups and candidates because the positives are literally the same rows everywhere.

The threshold **value** and the rule that produced it are carried on every cell. This matters
week-over-week: a median-relative label means the bar moves with the slice, so this week's AUC is not
comparable to last week's unless the reader can see both thresholds. An absolute-threshold variant
(e.g. `abs_move >= 1.0%`) is the honest long-run fix and is a named non-goal for v1 (§12).

Mechanically this also removes finding 2's cost: thresholds move into a precomputed `LabelSet`
(`Vec<Option<bool>>` per label, index-aligned to the row vector), computed once at O(n log n) instead
of re-sorted per row per bin per candidate per group.

### 7. Cell content, and the honesty fields that replace the human preamble

Each cell carries: candidate key + basis expression, group, label rule + threshold value, horizon,
`n_eligible`, `n_positive`, `base_rate`, `excluded_by_reason`, `auc`, `precision_top_decile`,
`recall_top_decile`, `lift_top_decile`, `top_decile_n`, `n_positive_in_top`, and the calibration
series (§9).

Two additions I consider non-optional:

- **`CellState` is a closed enum, never a null metric.** `Computed` · `NoEligibleRows { by_reason }` ·
  `InsufficientN { n, floor }` · `Degenerate { reason }` (all values tied, so AUC is undefined; or no
  positives / no negatives, which is the `None` that `man_whitney_auc` returns today with no
  explanation attached).
- **`n_sessions` — the distinct `session_date_et` count in the cell's rows — sits beside `n_rows`,
  and an `evidence_class` is derived from it by a stated rule** (`SingleSession` / `MultiSession{d}` /
  `MultiWeek{d}`). This is the single most important field in the artifact. The 2026-08-11 slice's
  221 rows came from **one 7-hour window on one day**; its true evidence weight is 1 session, not 221
  samples, and nothing in the current report says so. `session_date_et` already exists
  (`outcomes.rs:40`), so this is a group-by, not new math. Combined with the ring-cap arithmetic in
  finding 5, this field is also what will make retention pressure visible when it starts evicting
  sessions.

I am **rejecting** closed-form AUC confidence intervals (Hanley-McNeil is O(1) off `n_pos`, `n_neg`,
`auc` and needs no dependency) on a specific technical ground, not on effort: it assumes independent
observations, and 78 samples/day from a 5-minute cadence on the same underlying are massively
autocorrelated. The interval would be badly too narrow, and a too-narrow CI printed beside
"AUC 0.932" is *worse* than no CI — it manufactures exactly the false confidence
`[score-change-is-deliberate-and-measured]` exists to prevent. `n_sessions` is the honest bound.
Bootstrap CIs blocked by session are the right v2 answer once `n_sessions > 1`.

### 8. Where vol-norm comes from

`resolve_vol_scalar(IvDecimal::try_from_decimal(atm_iv), HvPercent::try_from_percent(hv_30d))` from
`quant-engine/src/vol_gex.rs:82`, then one divide. Not `vol_normalize_gex` — the sample carries no
call/put/total GEX (finding 4), so that entry point cannot be called at all. Calling
`resolve_vol_scalar` is reuse of the shipped **fallback chain and unit guard**, which is the part
that carries the footgun protection; the divide is the same single line the shipped function
performs.

Unit alignment is exact and verified: `StructureSample.atm_iv` is documented and captured as a
**decimal** (`store.rs:95`, set from `snap.atm_iv`), which is what `IvDecimal::try_from_decimal`
wants; `hv_30d` is **percent annualized** (`store.rs:99`), which is what `HvPercent::try_from_percent`
wants. `IvDecimal` rejects values > 5.0, so a percent-shaped IV that ever leaked into the diary
becomes `VolScalarUnavailable` and is **counted**, not silently divided by 45.

Two rules on top:

- **The basis is per-row and its mix is reported per cell.** A cell whose divisor was `atm_iv` for
  140 rows and `hv_30d` for 12 is a mixed measurement, and `[model-read-carries-its-assumptions]`
  makes that a field (`basis_mix`), not a footnote. A cell that is majority-`hv_30d` should be read
  more weakly, and the reader cannot know that today.
- **No rounding in the lab path.** `vol_normalize_gex` rounds to 2dp; rank-based metrics only care
  about order, and rounding can only create ties. Skip it.

### 9. Calibration binning

The existing `calibration_curve` uses **equal-width** bins over `[min, max]` of the scalar. That is
tolerable for a 0-100 score and useless for `abs(net_gex)/iv`, which is heavy-tailed across symbols
spanning orders of magnitude — equal-width would put nearly every row in bin 1 and one row in bin 5,
and the table would be unreadable rather than wrong-looking.

**Position: quantile bins (quintiles) of the candidate's own eligible values within the group**, with
each bin reporting its quantile range *and* its native-unit edges. One rule for all candidates: a
per-candidate binning rule would mean the calibration column is not comparable across the rows of the
same table.

This changes the shape of the `opportunity_score` calibration table relative to the 2026-08-11 run.
That is acceptable and must be declared by a version bump on the report constant (`SCORE_LAB_VERSION`
exists for exactly this: "bump when metric definitions change").

### 10. The folded-in residual: log when an ok row yields null drivers

The BRIEF folds in the one genuine remainder of `score-drivers-capture-integrity`. Placement:
`loop.rs`, in the `Some(sample)` arm at :468, where `row.status == "ok"` and a score exists but
`row.score_drivers.is_none()`. Emit a `warn!` with symbol / as_of / score, mirroring the existing
`from_row`-skipped warning at :475. Rules: **log only** — it must not change what is appended, must
not synthesize drivers, and must not touch past rows. Its whole purpose is to let a future reader
distinguish a pre-2026-08-10 capture from a live regression, which is currently impossible.

### 11. Options I considered and rejected

- **Keep `evaluate_baseline` running alongside the new comparison block** (both in the artifact).
  Rejected: two paths computing the same `opportunity_score` metrics under two different calibration
  definitions is the drift `[structural-over-prose-enforcement]` warns about, and the two blocks would
  disagree the first time someone edits one. **Instead**: the comparison block replaces it, and
  `evaluate_baseline` survives as a **test-only parity oracle** — a fixture test asserting that the
  `(Pooled, opportunity_score, large_abs_move)` cell reproduces `evaluate_baseline`'s `auc`,
  `base_rate`, `precision_top_decile` and `lift_top_decile` exactly. Continuity with the 2026-08-11
  numbers without a second live path; calibration is excepted by §9 and that exception is stated in
  the test.
- **Store `net_gex_vol_norm` + basis on `StructureSample`** (X2 §"Suggested remaining work" item 2).
  Rejected. Complexity: a new column, a migration, and a formula version frozen into the diary — so a
  formula change makes old and new rows silently incomparable, with no field saying which is which.
  Cost of the alternative: one divide per row per run, at n in the hundreds. Scalability: derivation
  stays O(n) and the formula version lives in the report where it can be bumped. **Attackable
  assumption**: this only holds because `atm_iv`/`hv_30d` are themselves captured — verified at
  `store.rs:143-147` and `pg_scan.rs:450-453`. If they were not, storing the derived value would be
  the only option.
- **Trait objects / a `Signal` trait per candidate.** Rejected: `fn` pointers in a `const` slice give
  the same extensibility with no dynamic dispatch, no lifetimes and a registry that can be iterated
  in a test to assert every candidate has a non-empty basis string. Team familiarity: the codebase
  already uses this shape (`LabelKind::as_str`/`definition`, the `names` array in
  `driver_attribution`).
- **Emitting a rendered markdown table from the CLI.** Deferred, not rejected — the artifact is the
  contract; rendering is a consumer. I do not own the report's presentation.

### 12. Explicit non-goals

1. No change to `opportunity_score`, `opportunity_tier`, the entry gate, or `state_fingerprint`. No
   file on the scoring path is touched.
2. No HTTP endpoint, no route, no UI, no dashboard surface. This is CLI + artifact.
3. No new capture field, no schema migration, no vendor call, no recompute of anything. Vol-norm is
   derived at read time (§11).
4. No change to `STRUCTURE_HISTORY_MAX` / retention. The ring cap (finding 5) is **reported** via
   `n_sessions` and the slice's earliest/latest `as_of`, not fixed here. Raising it is a separate
   owner decision with a storage cost, and this feature's job is to make the constraint visible.
5. No repair, backfill, or synthesis of historical null `score_drivers`.
6. No regime / vol-regime grouping in v1 (the `GroupKey` shape admits it; scope does not).
7. No absolute-threshold label variant in v1, and no bootstrap/parametric confidence intervals (§7).
8. No cross-horizon composite report. One horizon per artifact, as today.
9. No adoption, recommendation, or ranking-of-winners language anywhere in the artifact. Cells carry
   metrics; the "this is not a product ruling" status is a field, and a candidate scoring well here
   is not a candidate adopted.
10. Artifact **key naming** and the CLI's flag surface are not mine — I specify content and
    semantics; the interface belongs to the synthesizer.

## Risks I see

1. **The vol-norm candidate may come back all-ineligible, and I cannot verify prod from here.** I
   verified the *code path* populates `net_gex`/`atm_iv`/`hv_30d` and that Postgres persists and reads
   them. I did **not** verify that the rows currently in the prod diary carry them — older captures
   may predate `with_analytics`, which is exactly what happened to `score_drivers`. Mitigation is
   structural rather than preventive: §4's `excluded_by_reason` makes the failure read as
   `{ vol_scalar_unavailable: 221 }` on the first run instead of a mysterious empty table. The feature
   is designed so this specific failure is legible, which is the most I can promise.
2. **72 cells is a lot of surface for a thin slice.** If most cells land in `InsufficientN`, the
   report becomes noise and the reader stops reading it. The `n_sessions`/`evidence_class` field is
   what should drive suppression or de-emphasis; if the consuming presentation ignores it, the
   feature ships a wall of unreliable numbers with the reliability marker present but unused.
3. **The pooled-median threshold makes cells slice-dependent.** Adding IWM to a SPY/QQQ run shifts
   the threshold and therefore every symbol's base rate. Carrying the threshold value makes this
   auditable, not absent. Someone will still compare two runs' AUCs without checking it.
4. **Tie density in the geometry candidates.** `dist_to_flip_pct` is rounded to 2dp and is exactly
   `0.00` whenever price sits on the flip. `man_whitney_auc` credits ties at 0.5, which pulls AUC
   toward chance and will *understate* geometry. This is a real bias in the direction of the null, so
   it is the safe direction to be wrong — but it should be visible, e.g. as a tie fraction on the
   geometry cells.
5. **`pair_samples_outcomes` silently keeps the last sample on a duplicate `(symbol, as_of_ms)` key**
   (`score_lab.rs:145`, `HashMap::insert`). Two samples 400ms apart across a JSON round-trip collapse
   to one with no count. Low likelihood given the 300s thinning; zero cost to count it.
6. **`net_gex` magnitude is not symbol-comparable.** SPY's net GEX dwarfs IWM's, so the *pooled*
   `net_gex_vol_norm_abs` cell is partly ranking "is this SPY", not "is dealer positioning extreme".
   The per-symbol cells are the honest ones for this family, and the pooled GEX cell risks being read
   as if it meant the same thing. A per-symbol z-score variant is the obvious answer and is v2 scope,
   not v1 — but the pooled cell needs its caveat as a field, or it will be quoted.
7. **Scope creep toward a mini modelling framework.** The registry shape invites candidate #7 through
   #20. The boundary that holds is §2: `comparison` never sees a `StructureSample`. If a proposed
   candidate needs a metrics change, that is the signal to stop, not to widen the interface.

## Assumptions I'm making about the other two lanes

- **Nobody proposes an HTTP endpoint or a dashboard surface for this.** The BRIEF marks it
  backend-only and `[operator-vs-trader-path-separation]` puts the artifact off every trader route. If
  either sibling specifies a route or a widget, my module boundaries in §2 are under-specified for it
  and I will need to rework, not patch.
- **The report's consumer is a human reading a generated table (or the raw JSON), not a program.** I
  optimized the cell shape for pivot/filter by a person and for diffability across weekly runs. If PM
  or UX assumes a programmatic consumer with a stable schema contract, the flat-vector choice in §5
  and the version-bump-on-definition-change stance in §9 need to be revisited.
- **The PM lane will accept that per-symbol cells are the primary read and pooled is secondary**, and
  will not ask for a single headline "which signal won" number. A single ranked verdict over 6
  candidates x 3 labels x 4 groups on a one-session slice is precisely the false confidence the
  invariant watch forbids, and I have deliberately not designed a mechanism to produce one.
- **The UX/tech-writer lane owns how `CellState`, `excluded_by_reason` and `evidence_class` are
  *worded*** in whatever rendering exists; I own only that the distinctions exist in the data and
  cannot be collapsed at a boundary. I am assuming they will not ask me to reduce the four `Ineligible`
  variants to one "unavailable" for readability — that collapse is the `[absent-is-not-none]`
  violation.
- **Nobody's acceptance criteria depend on the multi-week window existing yet.** Finding 5 says the
  raw diary retains ~7 sessions per symbol, and today's slice is 1 session. If a sibling writes an AC
  like "report shows multi-week stability", it is unmeetable on current retention and would silently
  become a retention-change feature.
- **The candidate set is allowed to include a control that is not one of the three named families.**
  `net_gex_abs_raw` is not in the BRIEF's list; I added it because the vol-norm result is
  uninterpretable without it. If PM treats the BRIEF's three families as an exhaustive scope fence,
  this is the first thing to argue about in R2.
- **The `score_drivers` null-log fold-in (§10) is in scope for this feature**, per the BRIEF's
  "Considered" entry. If PM scopes it out, my `[additive-keeps-score-byte-identical]` restatement
  becomes a strict empty-diff claim on `apps/api/src/services/scanner/`, which is simpler for me and
  I will not defend the fold-in.
- **No one will ask for the 2026-08-11 artifact to remain byte-comparable to the new one.** §9 changes
  the calibration binning and §6 changes threshold scoping; both are declared via a version bump, and
  the parity oracle in §11 covers only the four ranking metrics, not calibration.
