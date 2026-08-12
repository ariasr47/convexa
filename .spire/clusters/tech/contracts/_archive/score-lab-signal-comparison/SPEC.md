# score-lab-signal-comparison — spec

**Source brief:** .spire/clusters/tech/contracts/score-lab-signal-comparison/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** draft

## 1. Goal + scope

The weekly score-lab answers one question per run — how well `opportunity_score` ranks large moves. This
feature turns it into a **comparative, per-symbol measurement**: a fixed set of five candidate signals is
ranked against the same labels on the same slice, pooled **and** split by symbol, in one run, with the
thinness of the evidence carried in the output rather than in the operator's memory. The user is one
person — the owner, running the runbook from a terminal once a week — and the surface is that CLI's
console output plus its durable JSON artifact. There is no trader-facing surface and none may be added.

This feature **measures only**. Ranking a candidate here is not adopting it; nothing the run prints
authorizes a score change.

**In scope**

1. A **fixed, declared candidate set of FIVE**, scored side by side on the same slice, same horizon, same
   labels, printed by the run in its declared order (owner ruling C-1, 2026-08-12):
   `opportunity_score` · `net_gex_vol_norm_abs` · `net_gex_abs_raw` (control, paired eligibility) ·
   `proximity_to_flip` · `proximity_to_nearer_wall`.
2. **Pooled and per-symbol by default**, no new flag. Groups are enumerated from the **requested** symbol
   set before pairing, so a requested symbol that produced nothing still emits its cells.
3. **Per-cell provenance**: horizon, window, label rule **and its threshold value**, basis expression,
   row count, distinct-session count, vol-basis mix, exclusion counts by reason.
4. **One closed absence vocabulary** at four layers (row reason → carrier state → carrier literal →
   metric literal), so absent ≠ empty ≠ undefined ≠ thin, from the type to the printed string.
5. **Exclusion accounting** that reconciles arithmetically, per scope and across scopes.
6. An **evidence header** (facts only) emitted by the tool on every run, first in console and artifact,
   including a **retention estimate derived from the run's own rows** (§4) rather than a baked-in figure.
7. **Derivation-provenance marks**: which candidate × label pairs are definitionally coupled, and which
   candidates share determinants with each other — both derived from declared provenance, not prose.
8. The **score-driver residual** the BRIEF folds in: a capture-side log when an `ok` row yields null
   `score_drivers`.
9. **Continuity** of the composite score's ranking figures against the pre-feature lab.
10. **Freezing the 2026-08-11 slice as a committed fixture, now** (controller ruling §D.1). The raw diary
    is a per-symbol ring capped at `STRUCTURE_HISTORY_MAX = 576` samples, oldest evicted first. At the
    capture rate **measured on 2026-08-12** — 168 samples/symbol/day (SPY 168, QQQ 168, IWM 166) — that
    cap fills in **≈3.4 days**, and SPY already held 250 of 576. The rate is an observation as of that
    date, not a standing fact; the **cap** is the stable quantity, and the rate has already changed once
    (an earlier R1 estimate of ~74/session gave "about seven sessions", which measurement disproved). Both
    readings agree on the only thing that matters here: the motivating rows leave the ring on a horizon of
    days. This is a deadline, not a preference — extraction is in scope for this feature.
11. A **strict (no-fallback) analytics read** for the lab's Postgres load path only.

**Out of scope**

- Any change to `opportunity_score`, `opportunity_tier`, the entry gate, weights, constants, or the
  fingerprint basis. Folding any candidate into the score.
- Any HTTP route, handler, dashboard widget or operator page for lab results; any alert or badge derived
  from them.
- `net_gex_vol_norm_signed` — **out of v1 entirely**, including as a greyed placeholder or a footnote
  promising it later. An absent candidate must be absent.
- Any adoption recommendation, "winner", "best signal", or per-run pass/fail against the runbook's
  multi-week bar. The tool prints the bar's text beside the run's values and **never** the outcome of that
  comparison.
- New capture fields, schema migration, vendor call, recompute, cache mutation, or any write to the diary.
- Backfilling, repairing or synthesising historical null `score_drivers`.
- Raising `STRUCTURE_HISTORY_MAX` or archiving raw rows. The ring bound is **reported**, not fixed here;
  it is logged to BACKLOG at GATE S as a separate durable-storage decision. (The in-code comment claiming
  ~2 RTH weeks is wrong and is corrected in passing.)
- New labels or KPIs beyond the three the lab already scores; any P&L-based label.
- Cross-run aggregation, trend lines, or week-over-week roll-up inside the tool.
- Regime / vol-regime grouping; an absolute-threshold label variant; confidence intervals of any kind;
  a cross-horizon composite artifact.
- **Deconfounding** — no partial correlation, no residualized candidate, no "score minus its proximity
  term" variant. This feature *discloses* shared derivation (§2.2); measuring a signal's independent
  contribution is a modelling change and is future-dated.

**Future (deliberately deferred)**

- `net_gex_vol_norm_signed`, reported **against the direction label only** and labelled a direction
  hypothesis, alongside `iv_hv_ratio` extremity as a candidate.
- Multi-week roll-up across saved artifacts — the only shape that can test the runbook's multi-week bar.
  This feature's artifact is required to **carry the fields** such a roll-up needs (§2), because once a
  week's raw rows leave the ring the artifact is the only surviving record of that week.
- A level-free composite variant, or any residualized candidate, if the disclosure in §2.2 turns out to
  make the composite's rows uninterpretable rather than merely qualified.
- Per-regime split; the 5-day horizon; driver leave-one-out at usable n; a rendered markdown emission
  (the JSON artifact is the contract, and every claim-bearing string already exists inside it as text).
- Bootstrap CIs blocked by session, once `n_sessions > 1`.

**Why five and not six** (owner ruling C-1). `net_gex_vol_norm_signed` is not a control; it is a
directional hypothesis scored mostly against **magnitude** labels, where it sits near 0.50 by
construction and its most likely output reads to the operator as *"vol-normalized GEX ranks at chance"*
while having tested something else. A wrong-reading cell is worse than an absent one, and it added 12 of
72 cells against a named legibility risk. `net_gex_abs_raw` **is in**, although it was not among the
BRIEF's three families: without it, a strong vol-norm row cannot be attributed to the normalization
rather than to raw GEX magnitude. The BRIEF's families were never a scope fence — recorded here so a
later reader does not "correct" this back. Grid: 5 candidates × 3 labels × (1 pooled + 3 symbols) =
**60 cells**, always 60, however thin the slice.

<!-- spire:council-resolution:v1 d6474bc1b8acfcb60f754a815f0b89a2a45cfd96d95a689aa5fc55ca7234270c folded -->
<!-- spire:council-resolution:v1 e78d1f13b13e9a1c24507757dd73b98cb18c566a3f2b3f4fc834981992237b90 folded -->

**Secondary labels stay — and the motivating finding is ONE candidate against THREE labels.** `up_move`
(direction) and `structure_event` remain in the report, visibly secondary, and in the artifact
unconditionally: the structure-event result is one of the two findings that motivated the feature, and a
label dropped for width is unrecoverable once the ring evicts that week's rows, not merely deferred.

State the finding correctly, because the BRIEF's phrasing inverts it and that inversion propagates. The
deep dive's "Global ranking metrics" table (`docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md:20-24`) has
**Label** as its first column: every row is the **same candidate**, `opportunity_score`, scored against a
different label.

| ranker | label | AUC |
|---|---|---|
| `opportunity_score` | `large_abs_move` (primary KPI) | 0.467 |
| `opportunity_score` | `up_move` | 0.569 |
| `opportunity_score` | `structure_event` | 0.932 |

So the finding is: **the composite score ranks structure events almost perfectly while ranking large moves
worse than chance — one candidate, two labels, opposite outcomes.** `structure_event` is a **label**; it
is not a ranker and has **no AUC of its own**. The doc's own prose agrees — *"Top-score rows hit wall/flip
path labels almost perfectly"* — the score is the ranker in every row. Any wording that reads 0.932 as
`structure_event`'s performance treats a label as a signal, which is exactly the confusion §4's banned-term
table exists to prevent.

Correcting the framing makes the coupling disclosure **sharper, not weaker**. The composite is built in
substantial part from proximity to the call wall, the put wall and the gamma flip, and `structure_event`
*means* price reached a wall or crossed the flip (§2.2). So the 0.932 is substantially the definitional
coupling AC-76 now marks: the score ranks well against a label defined in terms of the same levels the
score is computed from. That is why the composite × `structure_event` cell carries the coupling mark
exactly as the geometry cells do (AC-55, AC-76), and why the composite's own label carries a
shared-derivation note naming the two geometry candidates (AC-77). This is disclosure, not correction —
untangling it would be a modelling change, which is out of scope above and future-dated.

## 2. Architecture

### 2.1 Modules and one-way boundary

```
scanner::store::StructureSample  ─┐
                                  ├─► research::pairing     → Vec<LabRow>   (score-agnostic)
research::outcomes::StructureOutcome ─┘
                                          ├─► research::candidates  (registry: pure fn per signal)
                                          │        extract(&LabRow) -> Result<CandidateValue, Ineligible>
                                          ├─► research::labels      (registry + thresholds computed ONCE)
                                          └─► research::comparison  (group × candidate × label → Cell)
                                                       └─► artifact + console (main.rs cmd)
```

- `services::research` may import `services::scanner::store` types **read-only**; nothing under
  `services::scanner`, `signals`, `projection.rs` or `quant-engine`'s scoring path may import
  `services::research`. The arrow is one-way, so a lab value reaching the score is a compile-time
  impossibility rather than a review catch.
- `candidates` is pure and I/O-free. `comparison` consumes an already-oriented, already-eligible
  `Vec<f64>` plus index-aligned labels and never sees a `StructureSample` — that boundary is what makes
  adding a candidate a registry entry instead of a metrics change.
- `main.rs` remains the only place doing file I/O and store access.
- **Pairing becomes score-agnostic.** The `score.filter(is_finite)` drop at `score_lab.rs:157` moves out
  of pairing into the `opportunity_score` extractor; a sample with `net_gex` but no `score` is now
  ineligible for one candidate and a full participant in the other four.
- `evaluate_baseline` / `ScoreLabReport` are **not deleted** and **not run alongside** the new block:
  they survive as a **test-only parity oracle** (§7).

### 2.2 The two registries, and derivation provenance

**`derived_from` is the TRANSITIVE determinant set**, not the immediate field read. That is the whole
mechanism: a candidate that reads one stored scalar still declares every underlying quantity that scalar
was computed from, because the question the mark answers is "what does this number ultimately depend on".

**`DerivationKey` is a closed enum:** `Score` · `NetGex` · `VolScalar` · `IvHvRatio` · `Setups` ·
`Flip` · `CallWall` · `PutWall` · `PeakGex` · `OffExchange` · `ForwardPricePath`. Both registries declare
against it; `derived_from` has **no default and may not be empty**, so a new candidate or label that fails
to declare its provenance does not compile, and a registry test asserts every entry's set is non-empty.
Omission is a build-time event, never a silent pass.

**Candidates — five entries.**

| key | family | oriented scalar | required inputs | derived from (transitive) | role |
|---|---|---|---|---|---|
| `opportunity_score` | Score | `score` | `score` | `Score`, `CallWall`, `PutWall`, `Flip`, `PeakGex`, `OffExchange`, `IvHvRatio`, `Setups` | primary |
| `net_gex_vol_norm_abs` | GexMagnitude | abs(net_gex) ÷ vol scalar | `net_gex` + (`atm_iv` or `hv_30d`) | `NetGex`, `VolScalar` | primary |
| `net_gex_abs_raw` | GexMagnitude | abs(net_gex) | `net_gex` **+ a resolvable vol scalar it does not use** | `NetGex` | control for `net_gex_vol_norm_abs` |
| `proximity_to_flip` | LevelGeometry | −abs(`dist_to_flip_pct`) | `dist_to_flip_pct` | `Flip` | primary |
| `proximity_to_nearer_wall` | LevelGeometry | −abs(`dist_to_wall_pct`) | `dist_to_wall_pct` | `CallWall`, `PutWall` | primary |

**What was verified for the composite, and where.** Provenance was traced through **both** the scoring
callee and its caller in `libs/quant-engine/src/signals.rs`; this list is the result of reading both, not
of inspecting the function name:

- `:477` `opportunity_score_parts` collects `[dist.call_wall_pct, dist.put_wall_pct, dist.gamma_flip_pct]`,
  takes the **nearest** by absolute value, and awards `40.0 * (1.0 - nearest / FAR_LEVEL_PCT)` — up to
  **40 of 100 points** — with `FAR_LEVEL_PCT = 0.03` (`:13`). Which of the three levels supplies those
  points is data-dependent, so all three are determinants and all three are declared.
- `:493` adds `transition = 10.0` when `near_flip`, which `:241` derives from `gamma_flip_pct` against
  `FLIP_PROXIMITY_PCT = 0.01` (`:19`) — a further **10 points** of pure flip proximity.
- `:491` `IvHvRatio` (up to 25) and `:492` `Setups` (up to 25) supply the remainder of the base score.
- `:459-464` — **at the caller** — `dark_pool_confluence` adds a capped bonus on top
  (`matches × DARK_POOL_BONUS_EACH`, capped at `DARK_POOL_BONUS_CAP`), and `:520-525` shows it matches
  off-exchange print prices against four gamma levels: `call_wall`, `put_wall`, `gamma_flip` **and
  `peak_gex_strike`**. So the composite also depends on `PeakGex` and on the off-exchange prints
  themselves (`OffExchange`). This path is live by default in production, so it is not a hypothetical
  branch. Consistent with `[dark-pool-context-only]`, the contribution is capped and toggleable — but
  "capped" is not "absent", and a determinant is a determinant.

So **up to half the composite's scale is level proximity**, plus a capped level-matching bonus. This
closed a question this spec previously left open; it is recorded here rather than in §9 because it is now
settled fact with citations a later reader can re-verify. The claim is scoped to what was read: the two
functions above and the constants they reference. `PeakGex` and `OffExchange` were **missed on the first
pass** because provenance was traced through the scoring function alone and not its caller — recorded so
the next reader knows the completeness bar is "trace every contributor to the emitted value", not "read
the obviously-named function".

**`PeakGex` and `OffExchange` do not change the pinned coupled set.** No v1 candidate and no v1 label
derives from either, so their intersections are empty everywhere and AC-76 stays at exactly three pairs.
They are declared because the declaration must be true, not because they change an outcome — and an
incomplete declaration is precisely the failure mode that would make a future label silently uncoupled.

Each candidate entry carries `key` (stable, never reworded), `family`, `orientation`, `basis` (the exact
expression + units, verbatim into the artifact), `inputs: &'static [&'static str]`,
`derived_from: &'static [DerivationKey]`, `role`, and a `fn` extractor — values in a `const` slice, not
match arms or trait objects.

**Labels — three entries, each declaring the same provenance.**

| key | binary rule | derived from (transitive) |
|---|---|---|
| `large_abs_move` | `abs_move` at or above the slice median (threshold computed once, §2.3) | `ForwardPricePath` |
| `up_move` | `ret_simple` positive | `ForwardPricePath` |
| `structure_event` | any of `hit_call_wall`, `hit_put_wall`, `crossed_flip` | `ForwardPricePath`, `CallWall`, `PutWall`, `Flip` |

`structure_event`'s three flags are forward-path facts computed **against the sample's own levels**, which
is why its provenance names those levels and not merely the price path. That is the whole coupling story
for this feature, and it is why provenance — not field names — is what the coupling test reads.

- **Orientation is mandatory.** `projection.rs:25-45` proves the geometry fields are **signed**
  (`signed_dist_pct = ((price − level)/price) × 100`; `nearer_wall_dist` returns the signed value). Ranked
  raw, they would rank the *farthest* rows into the top decile and read as "level geometry is
  anti-predictive". Every extractor returns a scalar where higher = more of the hypothesis, and records
  which raw field it came from and whether it was negated.
- **Paired eligibility for the control.** `net_gex_abs_raw` deliberately requires a resolvable vol scalar
  it never uses, so raw and vol-norm are measured over the identical row set. Otherwise the two AUCs come
  from different populations and the A/B is silently void. Encoded, not noted — IDENTITY 3 (§2.6).
- **Vol scalar** comes from `resolve_vol_scalar(IvDecimal::try_from_decimal(atm_iv),
  HvPercent::try_from_percent(hv_30d))` (`quant-engine/src/vol_gex.rs:82`) plus one divide. Not
  `vol_normalize_gex` — the sample carries no call/put/total GEX, so that entry point cannot be called at
  all. Units verified: `atm_iv` is a decimal (`store.rs:95`), `hv_30d` is percent annualized
  (`store.rs:99`). `IvDecimal` rejects > 5.0, so a percent-shaped IV that ever leaked in becomes
  `VolScalarUnavailable` and is **counted**, never silently divided. No rounding in the lab path — rank
  metrics only care about order and rounding can only create ties.
- **`basis_mix`** is a counts map per `(group, candidate)` — `{ atm_iv: 140, hv_30d: 12, unavailable: 69 }`
  — never a single basis word. The fallback is resolved per sample; a run-level or cell-level single word
  would be a false claim. If width ever forces one word, it is a derived field with a stated rule
  (majority, else `mixed`), computed once, never picked by the renderer.

**`definitionally_coupled` is derived from declared provenance, not from field names.** The mark is
`candidate.derived_from ∩ label.derived_from ≠ ∅` over the closed enum, emitted as a boolean **plus the
shared keys** so the cell says *why* it is coupled. A **field-name** intersection — the shape stated in an
earlier draft of this spec — silently fails on the exact cells the mark exists for:
`proximity_to_nearer_wall`'s input is `dist_to_wall_pct` while `structure_event`'s determinants are
`hit_call_wall` / `hit_put_wall` / `crossed_flip`, so the two strings never meet even though the label is
"price reached the level this candidate measures the distance to". Under transitive provenance the mark
fires on **three** pairs in v1:

| coupled pair | shared keys | why it matters |
|---|---|---|
| `proximity_to_nearer_wall` × `structure_event` | `CallWall`, `PutWall` | distance-to-wall scored against price-reached-the-wall |
| `proximity_to_flip` × `structure_event` | `Flip` | distance-to-flip scored against price-crossed-the-flip |
| `opportunity_score` × `structure_event` | `CallWall`, `PutWall`, `Flip` | up to half the composite's points are proximity to those same levels (`signals.rs:477,493`) — this is the 0.932 row (§1) |

The third is the one nobody would have found by reading candidate names, and it is the row the deep
dive's headline number sits on. The mark correctly does **not** fire for any candidate against
`large_abs_move` or `up_move` (`ForwardPricePath` alone is shared with no snapshot-time read), so it stays
meaningful rather than universal.

Derivation is still preferable to a hand-kept per-pair list — a hand-kept list is one candidate away from
being wrong and silent — but derivation over a **closed, mandatory, human-declared** provenance set is the
honest middle: the *declaration* is deliberate and build-enforced, the *pairing* is computed. Because a
declaration can still be wrong — as the missed `PeakGex` above proves — the coupled set over the v1 grid
is additionally **set-equality pinned** (AC-76): narrowing or emptying any `derived_from` fails a test
rather than quietly unmarking a cell.

**Candidate × candidate overlap is surfaced too — as a different mark, decided here rather than left
implied.** `opportunity_score` shares `{CallWall, PutWall, Flip}` with both geometry candidates, so the
composite row and the two geometry rows are **not independent hypotheses**; an operator comparing them is
partly comparing a signal with a component of itself. Scope decision, recorded so it is not re-argued:

- The **`definitionally_coupled` mark stays candidate × label only**. A cell is keyed by a
  candidate and a label, and the false mandate it guards against is a metric scoring well against a label
  it shares determinants with. Widening that mark to candidate × candidate would put two different facts
  behind one word.
- Candidate × candidate overlap is surfaced as a **separate `shares_derivation_with` field on the
  candidate registry record**, rendered as a note on the candidate's own label (once per candidate, not
  per cell), naming the other candidates and the shared keys (AC-77). It is derived from the same
  declarations, so it costs no new vocabulary and cannot drift from the coupling mark.
- For the GEX pair this restates what `role: Control { for_candidate }` already declares. That redundancy
  is accepted rather than special-cased: a suppression rule would be one more branch for a reader to
  learn, and this spec's totality philosophy is that every derived fact prints for every entry.

### 2.3 Grouping, grid totality, labels

- `GroupKey = Pooled | Symbol(String)`; pooled is not a special case but a group whose predicate is
  `|_| true`, so there is exactly one metrics code path and pooled cannot drift from per-symbol.
- **Groups are enumerated from `requested_symbols` BEFORE pairing** — the `--symbols` argument, or the
  distinct symbols of the loaded sample set when it is absent. `groups = {Pooled} ∪ {Symbol(s)}`. The
  cell grid is the full cross product `groups × candidates × labels`, emitted in declared order, with
  **no filtering step anywhere that can remove a coordinate**. Deriving the group set from the paired
  rows (the R1 shape) made a symbol with zero paired rows vanish entirely rather than render an
  unexplained `n = 0` — strictly worse than the failure it was meant to prevent.
- Every cell carries `state: CellState` as a **required first-class field** (not derived at render time,
  never omitted), plus `n_paired_in_group` and `n_samples_in_group`. Those two counts are what separate
  "the diary holds 74 IWM samples and none joined an outcome at this horizon" from "IWM was requested and
  the diary holds nothing for it".
- **The label threshold is computed exactly once per (horizon, slice)**, over the full paired row set,
  before any grouping or candidate eligibility filtering, and held fixed across every cell. Per-group
  medians would pin every symbol's base rate to ~0.50 and measure SPY's lift and QQQ's lift against
  different bars — destroying the cross-symbol comparison while looking fine. Consequences that are
  features: per-symbol base rates become informative, and lift is comparable because the positives are
  literally the same rows everywhere. The threshold **value** and the rule that produced it ride on every
  cell, because a median-relative label moves the bar with the slice.
- Thresholds precompute into a `LabelSet` (`Vec<Option<bool>>` per label, index-aligned to the row
  vector), removing today's O(n² log n) re-sort per row per bin.
- **Calibration uses quantile (quintile) bins** of the candidate's own eligible values within the group,
  each bin reporting its quantile range *and* its native-unit edges — one binning rule for every
  candidate. The shipped equal-width rule is defensible for a bounded 0–100 score and useless for a
  heavy-tailed ratio spanning orders of magnitude. This changes `opportunity_score`'s calibration table
  relative to the 2026-08-11 run; that is declared by a bump of `SCORE_LAB_VERSION`, never silent.

<!-- spire:council-resolution:v1 06800a8fec1e0e713998c0f385a454e5402982d83047acfe2847db3234ea7b13 folded -->

### 2.4 One absence vocabulary, four layers

There is **one** vocabulary over every reported figure, stated once here and never restated per section.
Three competing closed sets existed at R1 (PM's five states, UX's six literals, the architect's enums);
shipping two of them would put two different words on the same state, which is precisely the failure
`[absent-is-not-none]` exists to prevent.

**Carriers.** A *carrier* is any reported figure group that holds a state: a **cell**, keyed
`(group, candidate, label)`; a **candidate-scope record**, keyed `(group, candidate)`, which holds the
correlations (§2.8); and the **driver-attribution block**. One state type governs all of them — two state
enums would be two vocabularies.

| Layer | Owner | What it disposes | Rendered alone? |
|---|---|---|---|
| **L1 `Ineligible`** (5) | architect | why **one row** left **one candidate** | No — reasons appear only inside an L3 parenthetical, each with its own count |
| **L2 `CellState`** (7 variants → 8 rendering keys) | architect (field) / UX (meaning) | the **carrier**; required even when the reason map is empty | No — it selects the literal |
| **L2m `MetricState`** (2) | UX | **one metric inside a `Computed` carrier** | No — it selects literal 9 or 10 |
| **L3 literals** (10) | UX | the only strings a carrier may contain | Yes — this is the whole surface (§4) |

```rust
pub enum Ineligible {
    InputAbsent { field: &'static str },
    InputNonFinite { field: &'static str },   // reachable only for score + the geometry fields — see §2.7
    VolScalarUnavailable,
    DegenerateInput { field: &'static str },
    LabelUndefined { label: &'static str },   // the row carried the input, not the outcome
}

pub enum CellState {
    Computed { metrics: Metrics, power: Power },
    NoPairedOutcome { n_samples_in_group: usize, horizon: String },
    NoEligibleRows { by_reason: BTreeMap<ReasonKey, usize> },   // non-empty by construction
    DegenerateCandidate { value: f64, n: usize },
    DegenerateLabel { n_pos: usize, n_neg: usize },
    NotApplicable { metric: &'static str, reason: &'static str },   // reserved — see §2.5
    NotRun { block: &'static str, flag: &'static str },
}

pub enum Power { Powered, UnderPowered { n_rows, n_sessions, row_floor, session_floor, causes } }

pub enum MetricValue { Value(f64), Absent(MetricState) }
pub enum MetricState {
    UnderMinimum       { stat, needs, unit, have, carrier_n },     // → literal 9
    UndefinedOnThisData { stat, precondition, failing_fact },      // → literal 10
}
```

`LabelUndefined` is load-bearing and was missed at R1: `binary_label` returns `Option<bool>` and
`score_lab.rs:253-257` `filter_map`s the `None`s away **silently**, so cell eligibility is
candidate-inputs **AND** label-defined. Without a label-side reason the closure identity is false for
every label with missing outcome flags, and those rows are invisible. (A candidate-scope record has no
label, so `LabelUndefined` cannot arise there; its closure is the label-free analogue — §2.6.)

**Ruling C-2 is structural, not conventional.** Metrics live *inside* `Computed`, with `power` as their
sibling, so it is **unrepresentable** for a thin carrier to lack its numbers, and there is no
`metrics: Option<_>` that could be `None` while the state says otherwise. A metric exists **iff** the
state is `Computed`. The architect's earlier `InsufficientN { n, floor }` variant stays **withdrawn** —
it carried no metric, which destroyed information at the data layer and made reproduction impossible for
exactly the thin cells the deep dive quoted. `under_powered` is also emitted as a flat derived boolean
beside `n_eligible`, `n_sessions`, `row_floor_in_force` and `session_floor_in_force` for diffability, as a
projection of `power` computed in one place. Nothing is suppressed from console or artifact.

<!-- spire:council-resolution:v1 99f4b332a3c1a2a39da6d96709590e6061067344e1b8999652195c1ad747dcac folded -->
<!-- spire:council-resolution:v1 5f86038146472799eee61408f25bca2c7529101bfa0fd23f2cb67ee635fc2c71 folded -->

**State is a total, pure function of the row set**, by this precedence, first match wins:

1. block switched off → `NotRun`
2. `n_paired_in_group == 0` → `NoPairedOutcome`
3. `n_eligible == 0` → `NoEligibleRows` (map necessarily non-empty, since `n_paired_in_group > 0`)
4. all eligible candidate values identical → `DegenerateCandidate`
5. `n_positive == 0` or `n_positive == n_eligible` → `DegenerateLabel`
6. otherwise → `Computed`

Two runs over the same rows cannot land on two different states. **Arm 5 is label-scoped and is therefore
evaluated for cells only**; a candidate-scope record has no label and runs arms 1–4 then 6. That
difference is not cosmetic — it is exactly what makes literal 10 reachable (§2.5(b)).
`NoEligibleRows` with an empty map is unreachable in practice because carriers are constructed through
**one** function that dispositions every paired row into eligible-or-reason before choosing a state — the
*type* does not forbid it, a single construction site plus the invariant test does, so that test is
load-bearing rather than decorative.

`NotRun { block, flag }` and `NotApplicable { metric, reason }` are legal members of the same enum
because the enum governs every carrier, not just the comparison grid — which is also why an unselected
candidate would emit `NotRun` cells rather than vanish, if a selector is ever added.

### 2.5 The two residuals R3 handed to synthesis — both resolved here

**(a) `NotApplicable` is RESERVED AND NOT REACHABLE IN v1.** All five v1 candidates are continuous and
all three labels are binary, so every metric in the grid is defined in principle; UX's motivating example
(calibration on a boolean candidate) has no v1 instance. Confirming it structurally: the precedence
function above has **no arm that emits `NotApplicable`**. The state and its literal are **kept** — removing
them would push a future boolean candidate's cells into a literal that means something else — but the
artifact's literal legend marks this one `reserved — not reachable in v1`, no acceptance criterion asserts
its appearance, and a test asserts no cell in any run or fixture carries it. This is the `AT BAR` lesson
applied one level down: an unreachable state that is *declared* unreachable is honest; an undeclared one
is a dead branch.

**(b) `MetricState` composes with `Computed { metrics, power }` without contradiction — confirmed, with
two corrections that make the layers line up 1:1 and the reachability argument survive its own precedence
rule.** The composition:

- `MetricState` is legal **only** where the carrier's state is `Computed`. **Precedence:** if the carrier
  holds a carrier-level disposition (literals 3–8), that literal renders and **no** metric-level literal
  appears — a metric cannot be "undefined" inside a carrier that was never computed. This is what keeps
  the two layers from printing two different words for the same fact.
- Every scalar metric field is a `MetricValue`, never a bare `Option<f64>`, so `Metrics` is total and no
  blank is reachable inside a `Computed` carrier.
- **Correction 1 — the key count.** The architect's sketch had three reason variants (`TooFewRows` /
  `BaseRateZero` / `NoVariationInMetricInput`) against UX's two rendering keys, a 3→2 map that would have
  broken the one-literal-per-key rule the whole vocabulary rests on. `TooFewRows` ≡ `UnderMinimum`;
  `NoVariationInMetricInput` ≡ `UndefinedOnThisData`; and `BaseRateZero` is **deleted rather than folded
  into a payload** — see correction 2. The result is a genuine **2→2** mapping: one key, one literal, one
  cause each, with nothing standing in prose where a type belongs. The `precondition` / `failing_fact`
  payload carries the *instance's* numbers (which statistic, which fact, what counts), exactly as literal
  3's parenthetical carries its reason counts; it does not encode a distinction between causes.
- **Correction 2 — `BaseRateZero` is not reachable through this layer, and its worked example is
  withdrawn.** Lift's denominator is the **carrier's own base rate**. A cell whose base rate is zero has
  `n_positive == 0`, which precedence arm 5 catches *before* `Computed` — so that cell renders literal 6
  (`no variation in the label …`) as a whole and never reaches a metric-level literal at all. The
  zero-denominator guard in code is therefore dispositioned one layer up, correctly, and needs no
  `MetricState` variant. An earlier draft of this spec carried a lift/base-rate-zero instance as literal
  10's "second example"; it was inherited from `R3-ux.md` §8.3, it contradicts this precedence function,
  and it is **removed**. Do not re-add it: an example that a conforming implementation cannot produce is
  the dead branch this vocabulary exists to eliminate.
- **Reachability of literal 10, on mechanism rather than likelihood — at the carrier where it actually
  lives.** The correlations are **candidate-scope records**, not cells (§2.8), and a record runs arms 1–4
  then 6: it has **no label**, therefore **no `DegenerateLabel` arm**. So a record can be `Computed` — its
  candidate varies, it has eligible rows — while the **continuous outcome** it is correlated against is
  constant across the usable pairs. `pearson` then has a zero-variance denominator, no carrier-level state
  describes it, and it must render something; today that something is a blank, which is the exact failure
  the vocabulary exists to prevent, sitting inside a carrier that otherwise looks fully trustworthy. That
  is literal 10, and AC-75 pins it with a fixture. Note the asymmetry that makes this work and makes the
  lift case fail: `DegenerateLabel` concerns the **binary** label at cell scope; nothing at record scope
  concerns the **continuous** outcome.
- **Reachability of literal 9.** `LabRow.ret_simple` and `LabRow.abs_move` are `Option`s, so a record with
  147 eligible rows can hold 2 usable pairs, and `pearson` returns `None` below 3
  (`score_lab.rs:488-492`). At cell scope the same key is reachable through the quintile calibration
  series, which needs 5 usable rows and can sit inside a perfectly well-formed 3-row cell.
- **Both metric literals carry the statistic's own n**, which is a different fact from the carrier's `n=`.
  A carrier can read `n=147` while `pearson` has 2 usable pairs, because the continuous outcome is absent
  on the rest. Reusing the carrier's n as the statistic's n is the silent, plausible-looking wrong number
  this pair exists to prevent.
- **Power composes orthogonally.** An under-powered carrier may still contain a metric with no value. On
  that carrier, each metric line carrying a value renders the under-powered atom (value + `n=` +
  `sessions=` + which floor was missed); a metric line with no value renders literal 9 or 10 **alone**,
  and the carrier's own `n=` / `sessions=` / floor marker still appear in its block header. The marker is
  *not* appended to literals 9/10: the substring `— under-powered:` may appear only in a value-bearing
  atom and in a block header, never inside literals 3–10, or the distinctness proof (§4) collapses. The
  marker repeats on every value line deliberately — UX-20 requires a pasted single line to carry it — and
  the header is what carries it for the lines that are not value atoms. §4 shows this rendered.

### 2.6 The three identities the artifact must satisfy

Fix a horizon. For scope `g`, let `P(g) = n_paired_in_group(g)`; for a cell `(g, c, l)` let `U` be
`n_eligible` and `E(...,r)` the exclusion count for reason `r`.

- **IDENTITY 1 — COMPOSITION.** `U(Pooled, c, l) = Σ_s U(Symbol(s), c, l)`, and
  `E(Pooled, c, l, r) = Σ_s E(Symbol(s), c, l, r)` **for every reason r**.
- **IDENTITY 2 — CLOSURE.** `U(g, c, l) + Σ_r E(g, c, l, r) = P(g)`, and `P(Pooled) = Σ_s P(Symbol(s))`.
- **IDENTITY 3 — PAIRED ELIGIBILITY.** For every group and label,
  `U(g, net_gex_abs_raw, l) = U(g, net_gex_vol_norm_abs, l)` and their reason maps are equal reason by
  reason.

The false form that must stay out of this spec is *"pooled count = sum of per-symbol counts **plus**
exclusions"* — it double-counts `E` and is true only when `E = 0`, i.e. never once a candidate has a real
exclusion. Composition is the stronger of the two: it is what fails when a symbol is silently dropped from
the per-symbol section. Closure only holds because `LabelUndefined` exists. Identity 3 is the encoded form
of the control's whole point — a future reader will see the unused vol-scalar requirement as dead code and
delete it, and this identity is what makes that deletion fail a test rather than pass review. All three are
universally quantified over the full 60-cell grid with no carve-out (they hold with all terms zero for a
`NoPairedOutcome` group), which is only possible because the grid is total.

Corollary at record scope: a candidate-scope record's closure is the label-free analogue —
used + excluded = `P(g)` over candidate-side reasons only — and a statistic's own usable count inside that
record may be strictly smaller than the record's used count, which is the fact literal 9 prints.

### 2.7 Failure modes + isolation

- **Degraded analytics read (the serious one).** `pg_scan.rs:598-623` catches *any* error from the full
  SELECT — a pool timeout, a cancelled statement, a connection reset, not only a partial schema — and
  retries with a projection omitting `score_drivers, net_gex, iv_hv_ratio, atm_iv, hv_30d`; the decoder's
  `try_get(...).ok().flatten()` (`:72-76`) then yields `None` for all four. It is **per symbol**, so SPY
  can return analytics-rich while QQQ returns analytics-blind, poisoning the cross-symbol comparison this
  feature exists to produce; the only trace is a server log, while the artifact is permanent and the raw
  rows evict once the per-symbol ring fills — a horizon of **days**, not weeks (§1.10: 576-sample cap
  against 168 samples/symbol/day measured 2026-08-12). **Resolution: the lab loads through a strict read
  with no fallback** — a full-SELECT failure is a hard CLI error naming the symbol and the underlying SQL
  error, raised **before any metric is computed and before any artifact is written**. The **serve path
  keeps its fallback unchanged**: `GET /api/scan/{symbol}/history` has a real availability requirement and
  degrades honestly there; the lab has none — it is offline, CLI and re-runnable, and a lab that refuses
  to run beats a lab that records a false absence in a file that outlives the data. The provenance-field
  alternative (`analytics_columns_present` + a new `CellState`) was rejected on vocabulary cost: one call
  site and no vocabulary growth versus one field, one variant, one literal and a permanent widening of the
  absence vocabulary.
- **Non-finite collapse at capture.** `store.rs:138-149` writes `None` for a non-finite `net_gex` and for
  an `atm_iv`/`hv_30d` that is non-finite or ≤ 0, and `from_row` has already nulled all four. So
  "carried but invalid" is indistinguishable from "never carried" for those four fields. It is **not
  fixable at capture** — NaN is not JSON-representable and the diary round-trips through serde on both the
  disk and Postgres paths, so the filter is load-bearing. Two consequences accepted rather than papered
  over: `Ineligible::InputNonFinite` is **unreachable for `net_gex`, `atm_iv`, `hv_30d`, `iv_hv_ratio`**
  (reachable only for `score` and the two geometry fields, which `from_row` copies unfiltered); and the
  absent-reason wording for those four fields must say *not carried, or dropped at capture as
  non-finite/non-positive* and must **not** claim "never captured", because the run cannot know that.
- **A candidate with no eligible rows still emits its cells.** A sample missing one candidate's input is
  excluded from **that candidate only**, counted by reason, and participates fully in the other four. No
  candidate's ineligibility aborts the run or touches another candidate's row set.
- **Duplicate `(symbol, as_of_ms)` keys** collapse today via `HashMap::insert` (`score_lab.rs:145`) with
  no count. Low likelihood under 300s thinning, zero cost to count — the collapse count is emitted.
- **Tie density** in the geometry candidates is real (`dist_to_flip_pct` is rounded to 2dp and is exactly
  0.00 on the flip; `man_whitney_auc` credits ties at 0.5), biasing those cells *toward* the null. That is
  the safe direction to be wrong, but it must be visible: `tie_fraction` is a cell field.
- **Precondition failure** (zero paired rows) is a named error with three distinguishable causes, not
  today's single `bail!`, and writes no artifact (§5).

### 2.8 Artifact shape (key naming is settled here, per architect non-goal 10)

One JSON file per run under `data/research/`, top-level: `version` (`SCORE_LAB_VERSION`, bumped by this
feature), `generated_at_utc`, `horizon`, `requested_symbols`, `sample_source` (prod pull / local store /
`--samples` path), `outcomes_path`, `window_utc_first`/`window_utc_last`, `session_dates` (the **set**,
not merely a count), `n_samples_loaded`, `n_outcomes_loaded`, `n_paired`, `evidence_class`, `bar_text`,
`bar_evaluable_from_single_run: false` + its stated reason, `retention[]` (see below), `authorizes` (the
measurement-only statement), `row_floor_in_force`, `session_floor_in_force`, `labels[]` (key, verbatim
definition string, threshold value in force, `derived_from`), `candidates[]` (registry echo: key, family,
basis expression, orientation, inputs, `derived_from`, `shares_derivation_with`, role), `cells[]` (flat
vector keyed `(group, candidate, label)`, in declared order), `candidate_scope[]` (keyed
`(group, candidate)`), `driver_attribution`, and `literal_legend` (the ten literals with their meanings
and the reserved marking).

**`retention[]` — one entry per requested symbol, every figure derived from this run's own rows.**
`symbol`, `samples_loaded`, `cap` (`STRUCTURE_HISTORY_MAX`, the one stable constant), `sessions_covered`,
`samples_per_session_observed` (= `samples_loaded / sessions_covered`), and
`cap_holds_sessions_estimate` (= `cap / samples_per_session_observed`), plus the window the estimate was
computed over. No retention figure may be a literal in code or copy: a capture-rate change must move the
printed number by itself. This is the same rule the rest of the spec applies to thresholds and floors —
the constant that is *known* (the cap) is printed as a constant; the quantity that is *observed* (the
rate, and the span it implies) is computed and labelled as an estimate from these rows.

> **New requirement, named for the planner rather than assumed available.** `samples_loaded` and
> `sessions_covered` exist today only at **cell** scope (`n_samples_in_group`, `n_sessions`), and the
> evidence header is emitted **before** any cell. Producing `retention[]` therefore needs those two
> quantities hoisted to **run scope, per requested symbol**, computed in the same pass that computes
> `evidence_class` (which §6 of the architect's R3 already defines as one pure function over a row set
> with two call sites — this is a third call site, not a second definition). Nothing else in the artifact
> supplies them. If the plan does not already carry a task for that hoist, it needs one.

Flat, not nested: every consumer of this artifact filters or pivots ("all cells for `large_abs_move`",
"all cells for QQQ"), and a flat vector makes cell count, cell absence and cell comparison trivially
checkable. Nesting optimizes a traversal nobody performs.

**Cell fields:** `state`, `n_paired_in_group`, `n_samples_in_group`, `n_eligible`, `excluded_by_reason`,
`n_positive`, `base_rate`, `auc`, `precision_top_decile`, `recall_top_decile`, `lift_top_decile`,
`top_decile_n`, `n_positive_in_top`, calibration series, `n_rows`, `n_sessions`, `evidence_class`,
`tie_fraction`, `under_powered`, `definitionally_coupled` + the shared derivation keys, label rule +
threshold value, horizon.

**Candidate-scope record fields** (20 records at S=3): `state` (the same required `CellState`, chosen by
the label-free arms of §2.4's precedence), `n_paired_in_group`, `n_eligible`, `excluded_by_reason`,
`pearson_vs_abs_move`, `pearson_vs_ret_simple` (both `MetricValue`), `basis_mix`, `role`, `basis`
expression. Correlations sit here and **not** on the cell: they are computed against the continuous
outcome and do not involve the label, so a per-cell Pearson would print the same number in all three label
rows and manufacture three findings from one. This also matches the shipped shape, where
`score_vs_abs_move` / `score_vs_ret_simple` are already report-scope. Both correlations are computed on
the **oriented** scalar and the record says so, because a Pearson on the raw signed geometry field has the
opposite sign and renders identically.

**CLI surface** (unchanged flags, comparative by default): `score-lab --outcomes <path> --horizon <h>
[--store <path>] [--samples <path>] [--symbols SPY,QQQ,IWM] [--out <path>] [--driver-loo <bool>]
[--json]`. No new flag is required for the comparative, per-symbol report. `--symbols`, when given, is now
the **requested** symbol set that enumerates groups (previously a post-load filter); absent, the requested
set is the distinct symbols of the loaded samples.

### 2.9 The folded-in capture residual

In `loop.rs`, in the `Some(sample)` arm (~`:468`), where `row.status == "ok"` and a score exists but
`row.score_drivers.is_none()`, emit a `warn!` naming symbol / `as_of` / score, mirroring the existing
`from_row`-skipped warning. **Log only** — it must not change what is appended, must not synthesize
drivers, and must not touch past rows. Its whole purpose is to let a future reader distinguish a
pre-2026-08-10 capture from a live regression, which is impossible today.

### 2.10 Not buildable / rejected (do not re-propose)

- **A hardcoded retention figure in emitted copy or in spec prose.** An earlier draft printed "the diary
  keeps about 7 sessions per symbol" inside the evidence header. It was inherited from an R1 estimate of
  ~74 samples/symbol/session; measurement on 2026-08-12 found 168/symbol/day, which fills the 576 cap in
  ≈3.4 days. The lesson is not "use 168" — that rate will change too — it is that the run must derive the
  span from its own rows (§2.8 `retention[]`, AC-78) and print only the cap as a constant.
- **Field-name intersection as the coupling test** (`candidate.inputs ∩ label.inputs`). It cannot see the
  three pairs it exists for, because each candidate reads a snapshot scalar while the label reads forward
  flags computed from the same level under different field names — and it misses the composite entirely,
  whose level dependence is two function calls deep. Transitive provenance intersection over a closed,
  mandatory `DerivationKey` set replaces it (§2.2).
- **Deconfounding the composite** — partial correlation, residualizing the score against its proximity
  term, or scoring a synthetic "score minus proximity". All three are modelling changes that would put a
  number in the report no shipped code produces. This feature discloses the entanglement and stops there.
- **Storing `net_gex_vol_norm` + basis on `StructureSample`.** A new column, a migration, and a formula
  version frozen into the diary, so a formula change makes old and new rows silently incomparable with no
  field saying which is which. Cost of the alternative: one divide per row per run at n in the hundreds.
  (Holds only because `atm_iv`/`hv_30d` are themselves captured — verified.)
- **Running `evaluate_baseline` alongside the new block.** Two paths computing the same metrics under two
  calibration definitions is exactly the drift `[structural-over-prose-enforcement]` warns about.
- **Closed-form (Hanley–McNeil) AUC confidence intervals.** They assume independent observations; the
  observed capture cadence on the same underlying is massively autocorrelated, so the interval would be
  badly too narrow — and a too-narrow CI printed beside an AUC of 0.932 is *worse* than no CI.
  `n_sessions` is the honest bound.
- **Trait objects / a `Signal` trait per candidate** — `fn` pointers in a `const` slice give the same
  extensibility with no dynamic dispatch and a registry a test can iterate.
- **A derived `BELOW BAR` / `AT BAR` standing verdict.** `AT BAR` is unreachable from one run by
  construction (the ring cannot hold a multi-week window), and a per-run pass/fail against the multi-week
  bar *is* the mandate this feature is forbidden to issue.
- **A `BaseRateZero` metric-level state, and any lift/base-rate-zero example of literal 10.** Dispositioned
  one layer up by `DegenerateLabel` (§2.5(b)).
- **Withholding below-floor values** (owner ruling C-2, §4), and **`InsufficientN` as a metric-free state**.
- **Per-group or per-candidate label thresholds; per-candidate calibration binning rules; changing the
  capture-side non-finite filter; raising `STRUCTURE_HISTORY_MAX`.**

## 3. Acceptance criteria (with user stories)

Every criterion below is observable by running the lab and reading its console output and its artifact —
no source reading required. `Verify by` is risk-based: `test` where a silent regression is plausible
(invariants, negative space, arithmetic, closed vocabularies, ordering), `review` where the behaviour is
visible and intentional (copy, presence, ordering of blocks a reader sees).

**Stories.** **S1** compare every candidate on one KPI in one run · **S2** every result per symbol as well
as pooled · **S3** every number readable with its assumptions · **S4** an unusable cell must look nothing
like a computed one · **S5** the run states its own measurement-only limits · **S6** the weekly ritual
stays minutes · **S7** week-over-week comparability survives · **S8** the write-up pastes vouched strings
instead of retyping numbers.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | S1 | A run with no flags beyond today's runbook invocation prints the declared candidate set, and the number of candidates it reports equals the number it printed — five in v1. | review |
| AC-2 | S1 | The raw-GEX candidate is labelled a **control** wherever its figure appears, in console and artifact, in its own label (not a legend), printed immediately after the vol-normalized row, with one sentence stating why it is present. It is never presented as a candidate under consideration. | review |
| AC-3 | S1 | The string `net_gex_vol_norm_signed`, and any display label for it, appears nowhere in the console output or the artifact — no row, no placeholder, no footnote promising it later. | test |
| AC-4 | S1 | Every candidate is reported on the same metric family (AUC, lift@top decile, precision@top decile, calibration); no candidate silently omits a metric another carries — an omitted metric renders its metric-level literal. | test |
| AC-5 | S1 | On a constructed slice where one candidate ranks the label perfectly and another ranks it exactly inversely, the report places them at opposite extremes of the ranking metric, and a third candidate whose values are unrelated to the label reports at chance. | test |
| AC-6 | S1 | Two runs over identical inputs produce identical figures; the artifacts differ only in run timestamp and output path. | test |
| AC-7 | S1 | Candidates appear in the declared order and symbols in their input order on every run; the table is never sorted by a metric value. | test |
| AC-8 | S2 | The artifact contains exactly `groups × candidates × labels` cells and the set of `(group, candidate, label)` keys equals the declared cross product — including for a fixture whose requested symbols contain one with zero paired rows. Every cell carries a state. | test |
| AC-9 | S2 | Every candidate × label is reported once pooled and once per **requested** symbol; a run restricted to two symbols produces per-symbol blocks for exactly those two and no others. | test |
| AC-10 | S2 | **Composition:** for every candidate × label, the pooled used count printed in the report equals the sum of the per-symbol used counts, and for each named exclusion reason the pooled count equals the sum of the per-symbol counts for that reason. Checked on a slice where at least one symbol contributes exclusions and at least one does not. | test |
| AC-11 | S2 | **Closure:** within any single scope, used samples plus total excluded samples equals **that scope's own** paired row count, printed in the same block as the figures it bounds, and rendered on each candidate row as `n = <used> (excluded <k>: <reason>)` with every reason counted. | test |
| AC-12 | S2 | **Paired eligibility:** in every group and every label, the raw-GEX control and the vol-normalized candidate report equal used counts and equal exclusion counts reason by reason. | test |
| AC-13 | S2 | A requested symbol whose rows produced no paired outcome for the horizon appears in the per-symbol section carrying the no-paired-outcome literal, naming the horizon and both counts — never omitted from the report. | test |
| AC-14 | S2 | A single-symbol run still renders the per-symbol section and states that the pooled block is that one symbol over the same rows. | test |
| AC-15 | S2 | Pooled cells for the GEX-magnitude family carry, as a field wherever the figure appears, the caveat that net GEX magnitude is not symbol-comparable and that the per-symbol cells are the honest read. | test |
| AC-16 | S3 | Any single figure in the report can be read together with its horizon, window start/end (UTC), symbol scope, row and session counts, label definition and threshold value, without opening another file. | review |
| AC-17 | S3 | Every metric row carries its label definition verbatim from the label's own definition string, in the same block as the number — never in a legend at the bottom. | test |
| AC-18 | S3 | Every candidate row states its ranking direction in words. | test |
| AC-19 | S3 | The vol-normalized rows carry the vol-basis **counts triple** (ATM IV / HV 30d / unavailable), so a scope where every sample fell back to HV is distinguishable from one where none did; those rows are labelled a magnitude read, never "score" or "signal". | test |
| AC-20 | S3 | No candidate label uses the word "distance" unqualified by its sign treatment; every geometry row prints both the raw field name and the fold applied to it. | test |
| AC-21 | S3 | The saved artifact alone contains every figure and every state marker shown in the console output; nothing quoted on screen is missing from the file. | test |
| AC-22 | S3 | The run prints a version marker for the lab's own output shape, in console and artifact. | review |
| AC-23 | S7 | Every saved artifact records the report version, the **set** of distinct trading session dates covered (not merely their count), the label threshold value in force, and a stable identifier per candidate that does not change when a display label is reworded. | test |
| AC-24 | S4 | Every metric cell, in console and artifact, is in exactly one of the eight declared cell states, and the artifact records that state as its own value rather than leaving it to be inferred from a missing number. | test |
| AC-25 | S4 | The ten declared literals plus a bare above-floor value are pairwise distinct in a plain-text paste with no surrounding prose. | test |
| AC-26 | S4 | `n/a`, a blank, `null`, `NaN`, `-`, and a bare `0` appear in no cell, and no string outside the declared literal set appears in any cell. | test |
| AC-27 | S4 | A candidate whose input was absent on **every** paired row in a scope renders the no-eligible-rows literal with the count of rows checked and each reason with its own count — and renders no numeric value, no zero and no bare dash. | test |
| AC-28 | S4 | The row-level reasons are never collapsed into one word: each reason appears with its own count inside the literal's parenthetical, and for `net_gex` / `atm_iv` / `hv_30d` / `iv_hv_ratio` the reason text says the value was not carried **or was dropped at capture as non-finite/non-positive**, never that it was "never captured". | test |
| AC-29 | S4 | A candidate that computed over the full row set and found no ranking effect renders a numeric value at chance with its counts, textually distinct from AC-27 in a plain-text paste with no surrounding prose. | test |
| AC-30 | S4 | A candidate whose value is identical across every eligible row in a scope renders the candidate-constant literal — not a chance-level value, not the absent literal. | test |
| AC-31 | S4 | A scope in which the label has no positives (or no negatives) renders the label-constant literal for every candidate in that scope, naming the positive and negative counts. | test |
| AC-32 | S4 | A cell with `n_eligible = 0` and an empty reason map renders the no-paired-outcome or the not-run literal and **never** the no-eligible-rows literal; those three strings are pairwise non-identical. | test |
| AC-33 | S4 | A metric with no value inside a `Computed` carrier — a cell or a candidate-scope record — renders literal 9 or literal 10, never a blank, never `n/a`, never a carrier-level literal, never a substituted `0`. | test |
| AC-34 | S4 | A metric-level literal changes neither the carrier's state nor its `n=` / `sessions=`; sibling metrics in the same carrier still render their values; and inside an under-powered carrier the literal renders alone while the carrier's counts and under-powered marker still appear in its block header. | test |
| AC-35 | S4 | Literal 9 prints the statistic's **own** usable count and the statistic's minimum; it never reuses the carrier's `n=` as the statistic's n. | test |
| AC-36 | S4 | Literal 10 names the failed precondition and the fact that failed it; the bare string `undefined (` appears nowhere in console or artifact. | test |
| AC-37 | S4 | No rendered cell ends without its closing parenthesis. | test |
| AC-38 | S4 | The `not applicable` state is reserved and unreachable in v1: no cell in any run or fixture carries it, and the artifact's literal legend marks it `reserved — not reachable in v1`. | test |
| AC-39 | S4 | When the attribution block ran and no loaded row carried a driver breakdown, the block renders the no-eligible-rows literal naming how many of how many rows were checked — and prints no rows of `n = 0`. | test |
| AC-40 | S4 | When the attribution block was switched off by its flag, the block renders the not-run literal naming that flag — never the no-eligible-rows literal, and never a blank section. | test |
| AC-41 | S4 | When some loaded rows carry a driver breakdown and others do not, attribution is computed on those that do and reports its reduced count plus the excluded count. | test |
| AC-42 | S4 | A live capture that produces an otherwise-ok row with an empty driver breakdown emits a log line naming the symbol and the time, so a present-day regression is distinguishable from a pre-2026-08-10 capture. | test |
| AC-43 | S5 | The evidence block is the first block of both console output and artifact on **every** run — including partial, degenerate and stale runs — and its one-line form is repeated at the end of the console output. | test |
| AC-44 | S5 | The run's evidence class is derived from the distinct-session count and the group set, never a constant: two fixtures (1 session vs 3 sessions) emit different evidence-class tokens. No cell or header contains `AT BAR`, `BELOW BAR`, `PASS`, `FAIL`, `MEETS`, `above the bar` or `below the bar`. | test |
| AC-45 | S5 | The evidence header's wording matches the approved copy in §4 — including the bar's own text printed verbatim beside the run's values, the line stating that the multi-week half is not evaluable from one run and why, and the sentence "Ranking a candidate signal here is not adopting it." | review |
| AC-46 | S5 | Every run — console and artifact — carries the slice's span, its count of distinct trading sessions, its sample counts, and an explicit statement that the run authorizes no score change. Deleting the prose around the numbers cannot remove it. | test |
| AC-47 | S5 | A slice covering fewer than two distinct trading sessions is labelled single-session in both console output and artifact, and the window banner appears on the metric tables themselves, not only in the header block. | test |
| AC-48 | S5 | Every cell prints its row count **and** its distinct-session count, in console and artifact. | test |
| AC-49 | S5 | A cell below the printed row floor **or** below the printed session floor renders its value, its counts and the under-powered marker as **one literal**, naming which floor(s) it fell below; no line break, column boundary or truncation may separate the number from its marker. | test |
| AC-50 | S5 | Both floors in force are printed as numbers once per run, in console and artifact, and the floor named in a marker equals the printed floor. | test |
| AC-51 | S5 | A cell drawn from exactly one distinct session carries the single-session marker even when its row count is above the row floor. | test |
| AC-52 | S5 | A cell above both floors carries **no** under-powered marker and no single-session marker. | test |
| AC-53 | S5 | No cell's value is suppressed for being below a floor: every computed value appears in both console and artifact, marked; a below-floor cell is textually distinct from every absence literal, from an above-floor value and from a blank, in a plain-text paste with no surrounding prose. | test |
| AC-54 | S5 | The report contains no adoption or verdict language: no candidate is described as better, best, winning, recommended, promising or ready, and no per-run pass/fail against the multi-week bar appears. Enforced by a scan over the run's own strings. | test |
| AC-55 | S5 | Any candidate × label pair whose **declared derivation provenance intersects** is marked as definitionally coupled wherever its figure appears, inside the cell's own text, naming the shared derivation keys. | test |
| AC-56 | S5 | No column header, row label or note uses a banned term from the vocabulary table in §4, and no output contains a recommendation, adoption verb or "next step" implying a score change. | review |
| AC-57 | S1 | The artifact contains a cell for every candidate × label × group in the declared grid — none omitted for width or any other reason. When the console narrows, it drops metric columns, never markers, counts or qualifiers. | test |
| AC-58 | S1 | The primary-KPI block appears before any secondary-label block in both console and artifact, and each secondary block is labelled as secondary. | review |
| AC-59 | S1 | A run with zero paired rows fails loudly, names which of the three causes fired (no samples loaded / no outcomes loaded / no overlap at this horizon) with each count, prints the exact next command, and leaves **no** artifact that could later be read as a run with no findings. | test |
| AC-60 | S1 | A requested horizon for which no outcomes were labelled fails naming that horizon, rather than reporting zeros for every candidate. | test |
| AC-61 | S1 | A missing or unreadable outcomes input fails naming the path it tried, and writes no artifact. | review |
| AC-62 | S1 | When the analytics read for any symbol cannot be served in full, the run aborts naming that symbol and the underlying error, before any metric is computed and before any artifact is written; it never reports that symbol's analytics fields as absent. | test |
| AC-63 | S1 | Progress lines name the phase during a long store read. | review |
| AC-64 | S3 | When the newest paired sample predates the run beyond one session, the stale-diary line appears naming both dates. | test |
| AC-65 | — | The lab completes with no vendor credential present in the environment. | test |
| AC-66 | — | The diary/sample store is byte-identical before and after a run — the lab reads and never writes to it. | test |
| AC-67 | — | For a fixed ticker, the score, tier and state fingerprint served by the app are byte-identical before and after this feature, and the feature's diff touches no file on the scoring path except the log-only capture warning. | test |
| AC-68 | — | The running server exposes no new route for lab results and no change to the routes it exposed before this feature; `GET /api/scan/{symbol}/history` answers 200 with its existing shape (see `INTERFACE_CONTRACT.md`). | test |
| AC-69 | S7 | A run over the **committed 2026-08-11 fixture** (a samples file and an outcomes file read through the file input path, never the live diary) reports for the composite candidate, pooled, the base rate, ranking metric and lift@top decile the pre-feature lab reported for that slice — AUC 0.467 and lift@top decile 0.17 against `large_abs_move` — asserted against the retained parity oracle. | test |
| AC-70 | S7 | On that same fixture, the SPY and QQQ candidate-scope records for the composite candidate report **opposite-signed** association with the continuous outcome, each stating its sign. Asserted as a sign-and-ordering claim, never to two decimals. | test |
| AC-71 | S7 | For the same slice and horizon, the composite candidate's pooled base rate, ranking metric, precision@top decile and lift@top decile match what the pre-feature lab reported. Calibration bin edges change with the new binning rule; that change is declared by a bump of the printed report version, and both the pre- and post-change values are recorded. | test |
| AC-72 | S8 | Every published figure that was **hand-derived** — the deep dive's per-symbol table, which its own heading marks `(hand-paired)` — appears only as a difference log beside the run's own cells, prefixed `hand-derived, unvouched:`, with any divergence named and attributed to the pooled-once threshold scoping. No hand-derived figure is asserted as a test oracle. The global ranking-metrics table (including the composite's 0.932 against `structure_event`) was tool-produced and is **not** labelled hand-derived. | review |
| AC-73 | S6 | Every item the weekly runbook's Record step asks for is readable directly off one run's output, with no hand computation and no second command; the runbook's Record step instructs paste-not-retype, and the bar lives in the emitted output rather than only in the runbook. | review |
| AC-74 | S6 | The runbook's existing invocation still works unchanged and now returns the comparative, per-symbol report — comparative is the default, not an opt-in flag. | review |
| AC-75 | S4 | Literal 10 is reachable and literal 6 covers the case it does not: on a fixture where a candidate's values vary but the continuous outcome is constant across the usable pairs, that candidate-scope record is `Computed` and its correlation line renders literal 10 naming the failed precondition; on a fixture where a scope has no positives, every cell in that scope renders literal 6 and **no** metric-level literal appears anywhere in that scope. | test |
| AC-76 | S5 | The set of candidate × label pairs marked definitionally coupled over the declared grid equals the pinned expected set — in v1 exactly `proximity_to_flip × structure_event`, `proximity_to_nearer_wall × structure_event` and `opportunity_score × structure_event`, in every group. Emptying or narrowing any registry `derived_from` declaration fails this test rather than silently unmarking a cell. | test |
| AC-77 | S5 | Every candidate whose declared derivation set intersects another candidate's prints a shared-derivation note wherever its own label appears, naming the other candidate(s) and the shared keys; the composite score's note names both geometry candidates and their shared level keys. The note is distinct from the definitional-coupling mark and never replaces it. | test |
| AC-78 | S5 | Every retention figure the run prints — samples held, sessions covered, observed samples-per-session and the implied cap-holds-sessions estimate — is **derived from that run's own loaded rows**, per requested symbol, and is labelled an estimate over a stated window. Two fixtures with different capture rates produce different printed figures. The only retention constant in the emitted copy is the cap itself; no session-count or samples-per-day figure appears as a literal anywhere in the emitted strings. | test |

**Coverage map** (so nothing is silently dropped; PM ids resolve against `R1-pm.md` **and** `R3-pm.md`,
which restates and splits several — likewise UX ids against `R1-ux.md` and the appended R3 exchange 2 in
`R3-ux.md`): PM AC-C1→1, C1b→2, C2→4, C3→5, C4a→69, C4b→70, C5→71,
C6→6, S1→9, S2a→10, S2b→11, S3→13, S4→7, P1→16, P2→19, P3→21, P4→22, P5→23, V1→24, D1→27, D2→29, D3→11,
D4a→30, D4b→31, D5→39, D5b→40, D6→41, D7→42, E1→59, E2→60, E3→61, G1→46, G2→47, G3a→48, G3b→49, G3c→50,
G3d→51, G3e→52, G3f→53, G4→54, G5→55, I1→65, I2→66, I3→67, L1→58, L2→57, R1→73, R2→74 · UX-1→43, 2→44,
3→45, 4→27/28, 5→25, 6→26, 7→11, 8→17, 9→18, 10→7, 11→19, 12→56, 13→14, 14→47, 15→64, 16→59, 17→63,
18→73, 19→56, 20→49, 21→32, 22→20, 23→37, 24→2, 25→33, 26→34, 27→35, 28→36 · architect: totality→8,
IDENTITY 1→10, IDENTITY 2→11, IDENTITY 3→12, strict read→62, capture-wording constraint→28,
no-new-route→68, `NotApplicable` reserved→38 · S2 skeptic: literal-10 reachability→75, coupling
must-fire→76 · verified scorer provenance (`signals.rs:477,493,459-464`): composite coupling→76, shared
derivation→77 · GATE Z retention amendment (measured 2026-08-12): derived retention→78.

<!-- spire:council-resolution:v1 89dce98ea1243ee758462e3eafd081ab064be6b50c4d2695d796a808b4d9d627 folded -->
<!-- spire:council-resolution:v1 f3912c4232d6c81773929903579d1a32c2c6815ca82e8c233cf2ebfe8dbc6afd folded -->
<!-- spire:council-resolution:v1 fe8dbed572296c5d11facf93297987f25a70f66397260ecdd4b55cd406fcb648 folded -->
<!-- spire:council-resolution:v1 8e7d12f2ca02c613259ca9e01dbe5bb9a23cd4e7189619b473c6152b380c31a8 folded -->
<!-- spire:council-resolution:v1 f5d058036b581b828383c0494ae244286f38af27244c1d54b4efe9009f888464 folded -->
<!-- spire:council-resolution:v1 89c6b6c72bcbf4ffed47ffe78fe57260ed01cd4e6d11c7e4788efc83f690b78d folded -->
<!-- spire:council-resolution:v1 e738d99c04852f735222cdcbe53805f9785f5a826626888d3870ec96b1d77585 folded -->

Notes on six of these marks. AC-7 deliberately deviates from the "ordering → review" default: a later
`sort_by(auc)` is green, invisible, and converts a measurement into a leaderboard. AC-52 is not padding —
without it the marker can regress to unconditional and stay green, the same wallpaper failure the standing
verdict was retracted over. AC-23 is `test` precisely *because* nothing consumes those fields yet, which is
what lets a later refactor drop one and stay green. AC-75 and AC-76 are the two must-fire counterparts to
AC-38's must-not-fire: a vocabulary state and a leakage mark are both worthless if nothing proves they can
be produced on the cases they exist for. AC-77 is `test` rather than `review` for the same reason as
AC-55 — the failure is an **absent** note, and absence is what review does not see. AC-78 is `test` because
a derived figure silently regressing to a constant is invisible on any single run: it looks correct until
the rate moves, which is exactly how the "7 sessions" figure survived into approved copy.

## 4. UI + interaction

**`NO_UI_CHANGE`.** This feature touches no dashboard surface — no route, no component, no token, no
design-system amendment is requested. A web or `/_ops` page for lab results would breach
`[operator-vs-trader-path-separation]` and is out of scope (§1). The surfaces below are the CLI's console
output and its JSON artifact.

**Flows.** One command, one report. The operator runs the runbook's existing invocation; the comparative,
per-symbol report comes back without asking for it. Console order is fixed:

1. **Evidence header** — before any number.
2. **Provenance line** — report version, generated-at UTC, outcomes artifact path consumed, sample source,
   horizon. Nothing may be reported that this line cannot source.
3. **Slice description** — requested symbols, paired rows, window first→last UTC, sessions covered, label
   definitions verbatim with their threshold values.
4. **Candidates × primary label, pooled** — candidate-major line blocks.
5. **Candidates × primary label, per symbol**, headed `Per symbol — pooled above is not a summary of these`.
6. **Secondary labels**, visibly secondary.
7. **Calibration**, per candidate — thin bins marked, never withheld.
8. **Driver attribution**, in the same vocabulary.
9. **Evidence one-liner**, repeated.

Layout is **candidate-major line blocks, not a column grid**: the longest literal is 78 characters and the
two metric-level literals reach 110, which no fixed-width grid holds without dropping the qualifiers — and
the qualifiers are the honesty. Under width pressure the console prints **fewer metrics per line, never
shorter literals**, and points at the artifact for the rest.

**Component states** (a CLI run is synchronous, single-shot and offline; `loading`, `offline` and
`success` states are unreachable by construction — the run makes no vendor call, so a network failure
cannot be a state of this artifact):

| State | When | What the operator sees | What must not happen |
|---|---|---|---|
| Default | every candidate computed pooled + per symbol | the full nine-block structure above | a candidate silently missing because its inputs were absent |
| Partial | ≥1 cell below a floor or with no eligible rows, ≥1 computed | the cell **still exists**, rendered with its literal; header states how many of five candidates were evaluable | a candidate or symbol dropped from the grid, or a cell reading `0.00` for an absence |
| Degenerate — single symbol | one symbol requested or surviving | per-symbol section still renders, stating pooled is that one symbol over the same rows | a "pooled" table that is silently one symbol, implying cross-symbol generality |
| Degenerate — single session | window covers one session | evidence class `SINGLE SESSION (d=1)` plus the window banner on the metric tables | full-precision metrics with no window qualifier — the 2026-08-11 shape |
| Stale diary | newest paired sample materially older than run time | `Newest sample 2026-08-04 (7 days before this run) — this read describes an older diary, not today` | the run date being mistaken for the data date |
| Cannot compute | zero paired rows, or a degraded analytics read | a named precondition failure with counts and the exact next command; **no artifact written** | a bare error indistinguishable from a crash, or an empty artifact readable as "we measured and found nothing" |
| Working | long store read | progress lines naming the phase | silence long enough to read as a hang |

### Copy — the evidence header (exact)

Renamed from "Standing" to **Evidence**: "standing" implies a verdict, and there is no longer one. The
`Evidence:` token is the varying part and is **facts only**, derived run-level from the full paired set
(not from the weakest cell). Closed set: `SINGLE SESSION (d=1)` · `MULTI-SESSION (d=3)` ·
`MULTI-WEEK (d=11, span 18 calendar days)`, where `d` is always distinct trading sessions. Symbol scope is
a second, independent fact on the same line, not a third enum value — two facts can be true at once and
the block shows both.

```
RESEARCH READ — NOT A PRODUCT RULING
  Evidence:   SINGLE SESSION (d=1) · symbols: SPY, QQQ, IWM
  This run:   2026-08-10 17:15–23:58 UTC (6h43m) · 221 paired rows · horizon 1d
  Bar (runbook text, printed beside the run's values; this run does not evaluate it):
              large_abs_move lift @ top decile >= 1.10, sustained across >= 10 sessions
              spanning >= 3 calendar weeks
  Not evaluable here: the multi-week half needs more history than the raw diary holds. The diary is
              a per-symbol ring capped at STRUCTURE_HISTORY_MAX = 576 samples, oldest evicted first.
              At this run's own observed rate — SPY 250 of 576 over 2 sessions, 125/session — the
              cap holds about 4 sessions. Derived from these rows over 2026-08-10→2026-08-12; not a
              stored constant, and it moves when the capture rate moves.
  Authorizes: nothing. No weight, constant, gate threshold or fingerprint basis changes on the
              strength of this run.  [score-change-is-deliberate-and-measured]
  Ranking a candidate signal here is not adopting it.
```

**Every number in the "Not evaluable here" block except the cap is computed per run** from `retention[]`
(§2.8) — the figures above are an instance, not literals. `STRUCTURE_HISTORY_MAX = 576` is printed as a
constant because it *is* one; the samples held, the sessions covered, the observed per-session rate and
the implied span are observations, and they are labelled as such. This is the same discipline the spec
applies to label thresholds and power floors, and it exists because the previous draft baked "about 7
sessions per symbol" into this very block from an R1 estimate that measurement later disproved by a factor
of two (§1.10, §2.10). AC-78 tests it.

`BELOW BAR`, `AT BAR` and `INSUFFICIENT — cannot evaluate` are **gone**. The tool never evaluates the bar,
so there is no state meaning "we could not evaluate it" — there is a **fact line** saying the multi-week
half is not evaluable from one run, and why. `MULTI-WEEK` stays in the enum because it is a pure function
of the data and would be silently wrong to omit if retention ever changed; the artifact records that it is
unreachable under the current cap (`bar_evaluable_from_single_run: false`) and states the reason.

<!-- spire:council-resolution:v1 20de414e9280c54dcab4cf3164e7df10559adae4ea83de98a28f13685d4b2960 folded -->
<!-- spire:council-resolution:v1 59d18fe2d1497f4c8bb076ccce8e3d593f9b61c5effe80c9365f146bdfab5b50 folded -->
<!-- spire:council-resolution:v1 8606fa508b1bee6f3dcce88c6aeece32942f808adf5ae4256661402d8d655146 folded -->

### Copy — the ten literals (exact shapes)

Owner ruling C-2 (2026-08-12): **a below-floor cell renders its value WITH its marker, in one literal, and
nothing is suppressed** in console or artifact. Withholding trades one collapse for another — a withheld
cell and an uncomputable cell both read as "no number here", which is `[absent-is-not-none]` failing at the
opposite end of the same axis. On this evidence base most cells stay thin for months, so suppression would
leave the operator with almost no numbers and no way to watch a figure move. The danger of a thin number is
that it is quoted **bare**; the fix is the marker plus the session count, not deletion. The narrow-stdout
suppression carve-out is explicitly not taken.

| # | Rendering key | Exact literal shape (instance) |
|---|---|---|
| 1 | `Computed`, above both floors | `0.47 (n=147, sessions=4)` |
| 2 | `Computed`, under-powered | `0.47 (n=4, sessions=1 — under-powered: below row floor 30 and session floor 2)` |
| 3 | `NoEligibleRows` | `no eligible rows (0 of 221 paired rows: net_gex absent 147, vol scalar unavailable 74)` |
| 4 | `NoPairedOutcome` | `no paired outcome (0 of 74 IWM samples labelled at horizon 1d)` |
| 5 | `DegenerateCandidate` | `no variation in the candidate (147 eligible rows, all = 0.00; ranking undefined)` |
| 6 | `DegenerateLabel` | `no variation in the label (147 rows, 0 positive / 147 negative at large_abs_move >= 0.42%; ranking undefined)` |
| 7 | `NotApplicable` — **reserved, not reachable in v1** | `not applicable (calibration is not defined for a boolean candidate)` |
| 8 | `NotRun` | `not run (--driver-loo off; 221 samples loaded, none examined)` |
| 9 | `MetricState::UnderMinimum` | `not enough rows for this statistic (pearson needs 3 usable pairs; 2 of 147 eligible rows)` |
| 10 | `MetricState::UndefinedOnThisData` | `undefined for this data (pearson needs the outcome to vary; abs_move is constant at 0.42 across 147 rows)` |

Binding shapes for the two metric literals (the parentheticals above are instances):
`not enough rows for this statistic (<stat> needs <minimum> <unit>; <have> of <carrier n> eligible rows)`
and `undefined for this data (<stat> needs <precondition>; <the fact that fails it>)`. A second instance of
literal 9, at cell scope: `not enough rows for this statistic (quintile calibration needs 5 usable rows;
3 of 3 eligible rows)`. Literal 8's "off" denotes `--driver-loo false`.

**There is deliberately no lift/base-rate-zero instance of literal 10.** Lift's denominator is the
carrier's own base rate, and a base rate of zero makes the whole carrier `DegenerateLabel` at precedence
arm 5 — so that case renders literal 6 for the entire cell and never reaches a metric-level literal. An
earlier draft carried such an instance, inherited from `R3-ux.md` §8.3; it could not be produced by a
conforming implementation and is withdrawn (§2.5(b)). Do not re-add it.

**Closure rule:** a carrier contains exactly one literal or a computed value; if any lane adds an L2 or
L2m variant later, it adds its literal **in the same change**. Retired and forbidden:
`too few (n=4, floor 30)` (dead under C-2), `undefined (base rate 0.00)` (could not express *no
negatives*, and named no cause), `— not applicable` with a leading em dash (trims to a reason-free
string), `no input (...)` as a head word (true only for `InputAbsent`; it silently renamed the other
reasons), and the phrase `not attempted` (attribution *was* attempted on every sample — literal 3 covers
attempted-nothing-eligible, literal 8 covers switched-off).

**Distinctness, proved over 12 strings and a blank.** (1) First character partitions: a digit ⇒ a number is
present, a lowercase letter ⇒ no number here; no literal begins with punctuation or whitespace. (2) The
marked value contains the substring `— under-powered:`, which appears in no other literal and in no bare
value, so a paste can never separate a thin number from its marker. (3) No absence literal begins with a
numeral, so a thin *number* and *no number* never collide. (4) The eight absence heads differ by their
second token and no head is a complete other literal. (5) Every literal has non-zero length and a
non-whitespace first character, so a blank is unreachable. (6) Every literal ends in `)` with exactly one
balanced parenthetical, so a width-saving cut leaves an unbalanced paren rather than a shorter true-looking
string. (7) `undefined for this data` is never abbreviated to a bare `undefined (`.

Rendered in place — a well-powered carrier, where the missing statistic is the only thing that changes:

```
  AUC       0.63 (n=147, sessions=4)
  Lift@10   1.21 (n=147, sessions=4)
  Pearson   not enough rows for this statistic (pearson needs 3 usable pairs; 2 of 147 eligible rows)
```

And the composition AC-34 mandates — an **under-powered** cell that also holds a valueless metric. The
marker rides on every value-bearing atom (UX-20: a pasted single line must carry it) and on the block
header; the metric literal renders alone, and the cell's counts are unchanged by it:

```
  Closeness to nearer wall — large_abs_move · IWM
  n = 3 (excluded 71: dist_to_wall_pct absent 71) · sessions = 1 — under-powered: below row floor 30 and session floor 2
  AUC          0.67 (n=3, sessions=1 — under-powered: below row floor 30 and session floor 2)
  Lift@10      1.50 (n=3, sessions=1 — under-powered: below row floor 30 and session floor 2)
  Calibration  not enough rows for this statistic (quintile calibration needs 5 usable rows; 3 of 3 eligible rows)
```

Cell trustworthiness is carried **structurally, not by words**: the literal replaces one metric's value on
that metric's own line, siblings render their numbers, and the carrier's `n=` / `sessions=` are untouched.
No per-instance reassurance text is added — that is prose that drifts.

<!-- spire:council-resolution:v1 6da93e3f6f271298dff650101c8a09c2fc5f4dcd1707c824505c0051f311a158 folded -->
<!-- spire:council-resolution:v1 4457e51e1ccc29e29150a38922b27d6f32d688ff739c10cc50e90f1df1559bbc folded -->

### Copy — candidate labels, in declared order

```
1  Composite opportunity score
   shares derivation with: Closeness to flip, Closeness to nearer wall (call wall, put wall, flip —
   up to 40 of its 100 points are proximity to the nearest of those levels, plus 10 for flip proximity)
2  Vol-normalized GEX magnitude (ranked on |net GEX| / vol scalar; basis mix: ATM IV 140, HV 30d 12, unavailable 0)
   shares derivation with: Raw GEX magnitude — control (net GEX)
3  Raw GEX magnitude — control (ranked on |net GEX|; same eligible rows as the row above, so a vol-norm result can be attributed to the normalization)
   shares derivation with: Vol-normalized GEX magnitude (net GEX)
4  Closeness to flip (ranked on -|signed distance to flip, %|; higher = nearer)
   shares derivation with: Composite opportunity score (flip)
5  Closeness to nearer wall (ranked on -|signed distance to nearer wall, %|; higher = nearer)
   shares derivation with: Composite opportunity score (call wall, put wall)
```

Row 3 prints immediately after row 2 and carries its control marker in its own label, not in a legend — a
control must survive a paste of one line. "Closeness", not "Distance": the underlying fields are signed,
the ranked scalar is the negated absolute value, and a column headed "Distance to flip" over a folded
absolute value renames what the value is — in two different directions depending on whether orientation
was applied. Every geometry row prints both the raw field name and the fold, because "we ranked the
absolute distance" and "we ranked the signed distance" are different findings that render identically
without it.

The shared-derivation note above is **not** the coupling mark and never replaces it. The coupling mark
rides inside the cell's own text and names its shared keys, e.g.
`definitionally coupled with structure_event (shared: call wall, put wall)` — never in a legend, because
the cell is what gets pasted. In v1 that mark appears on three cells per group: both geometry candidates
**and the composite score** against `structure_event` (§2.2).

<!-- spire:council-resolution:v1 12e776f113d8906ae8e70dfa0a625fe283cb2b3ec9ee56f02358074c4e54f5fa folded -->

### Copy — the closed term set

| Concept | Approved term | Banned |
|---|---|---|
| a thing being measured | candidate signal | signal, model, strategy, factor |
| what the run did to it | ranked on this slice | validated, backtested, proved, scored |
| a candidate doing well | ranks *label* well on this slice | accurate, predictive, works, wins, best, winner, top signal |
| the metric family | ranking metrics | performance, accuracy, quality, edge |
| AUC | AUC — ranking of *label*; 0.50 = chance | accuracy, hit rate, success rate |
| lift@top decile | Lift @ top decile — 1.00 = chance | return, gain, improvement |
| the vol-norm candidate | Vol-normalized GEX magnitude (basis: …) | vol-norm score, vol-adjusted signal, normalized strength |
| level geometry | Closeness to flip / Closeness to nearer wall | level signal, geometry score, proximity edge |
| `structure_event` | structure_event — a **label**: path geometry hit (wall touch or flip cross), not P&L, and never itself a ranker | structure signal, event prediction, "structure_event's AUC" |
| shared determinants | shares derivation with / definitionally coupled with | independent, unrelated, orthogonal, standalone |
| retention | the cap (a constant) · observed rate / estimated span (derived, over a stated window) | any standing claim of how many sessions or days the diary "keeps" |
| the whole artifact | research read | report card, results, findings, verdict |

"Proximity" is **un-banned** (it is the only honest word for the oriented scalar); "proximity edge" stays
banned — "edge" is the adoption word. Three rows carry extra weight: a **label never has an AUC of its
own** (an AUC belongs to the candidate that ranked it), calling any pair of these five candidates
"independent" would be a claim the registry contradicts, and a retention span stated as a standing fact is
the defect this spec was amended to remove.

**Floors in force** (owner-confirmable defaults, settled at R3): **row floor 30** and **session floor 2
distinct trading sessions**, both scoped **per cell** (candidate × label × group), both printed as numbers
once per run in console and artifact. The marker fires on **either** floor. Acceptance criteria reference
"the floor in force as printed", never the literal number, so the owner can change either without touching
a criterion. The session floor of 2 is what makes every single-session cell — including the entire
2026-08-11 slice — carry the marker; a session floor of 1 would remove the marker from exactly the slice
that motivated the feature.

**What the human may still type.** The runbook's Record step becomes *"Paste the emitted evidence block and
tables. Do not retype numbers."* Any number in a write-up that is not from the artifact is prefixed
`hand-derived, unvouched:` — there is no third option. Prose interpretation stays typed; claims about what
the data says must be pasted.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The Curvature
Terminal). **Design direction:** none applied — this feature renders no dashboard surface, requests no
amendment, and restates no token table.

## 5. Error handling

| Failure | Behaviour | Artifact | Logged |
|---|---|---|---|
| Zero paired rows | Named precondition failure distinguishing the three causes with counts, plus the exact next command, e.g. `No paired rows for horizon=1d. Samples loaded: 221. Outcomes loaded: 0. Run join-outcomes first: cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM` | none written | CLI stderr |
| Horizon with no labelled outcomes | Fails naming that horizon; never zeros across the grid | none written | CLI stderr |
| Missing / unreadable outcomes or samples file | Fails naming the path it tried | none written | CLI stderr |
| Analytics SELECT cannot be served in full for any symbol | Hard error naming the symbol and the underlying SQL error, **before any metric or artifact** | none written | CLI stderr; the serve path's own fallback and its `warn!` are unchanged |
| A registry entry declares an empty `derived_from` | Build failure (the field has no default) or a red registry test; the run never starts | none written | compiler / test output |
| A requested symbol has zero loaded samples (retention estimate has no denominator) | `retention[]` still carries an entry for that symbol with `samples_loaded = 0` and the estimate rendered as the no-eligible-rows literal — never a zero, never a blank, never an omitted symbol | written | — |
| One candidate's inputs missing on some rows | That candidate is scored on the rows it has; excluded rows counted by reason and printed; other candidates unaffected | written | — |
| One candidate's inputs missing on every row | The cell renders literal 3 with counts and reasons; the run completes | written | — |
| A requested symbol with no paired outcome | The cell renders literal 4 with both counts; the symbol is never dropped | written | — |
| A statistic undefined inside a computed carrier | That metric's line renders literal 9 or 10; siblings and the carrier's counts are untouched | written | — |
| `ok` capture row with null `score_drivers` | Capture-side `warn!` naming symbol / `as_of` / score; nothing appended changes | n/a | server log |

An empty or partial artifact is never written. An artifact quoted later as "we measured and found nothing"
is the worst thing this feature can emit.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/score-lab-signal-comparison/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** this feature adds **no endpoint, no route and no wire payload
change** — it is a CLI subcommand plus a file artifact, and a web surface for lab results would breach
`[operator-vs-trader-path-separation]`. The interface file therefore carries one endpoint,
`GET /api/scan/{symbol}/history`, **not** because this feature changes it but as a machine-checked
non-regression guard: the lab's strict-read resolution (§2.7) forks from the read path that endpoint
serves, and "the serve path keeps its fallback unchanged" is a claim better verified than asserted. The
authoritative field list lives in that file.

## 7. Testing strategy

Risk-based, not one test per criterion. This is a Rust-only feature; there are no FE test tiers to
consider and no network boundary to mock — the lab makes no network call at all (AC-65).

**Automated, because a silent regression is plausible:**

- **The three identities** (§2.6) as property-style assertions over the full 60-cell grid of every
  fixture, with no carve-out. Composition is the one that catches a silently dropped symbol.
- **Totality** — the artifact's `(group, candidate, label)` key set equals the declared cross product, on
  a fixture whose requested symbols include one with zero paired rows. UX's "no `n_eligible == 0` with an
  empty reason map and a state naming no group-level cause" invariant rides alongside, but it can only fire
  on a cell that exists, which is why totality is the primary guard.
- **The closed vocabulary** — a scan over every rendered string in console and artifact: nothing outside
  the ten literals; no `n/a`, blank, `null`, `NaN`, `-`, bare `0`, or bare `undefined (`. This is the
  highest-probability regression in the whole feature: it is a one-line "cleanup" that looks like polish,
  and today's `main.rs:655`/`:659` are the live instances of exactly it.
- **Distinctness** — the twelve strings plus a blank asserted pairwise distinct as a *set*, not as twelve
  independent snapshots. A snapshot of one literal proves nothing without the contrast set.
- **Both metric literals must be producible, and only where they belong** (AC-75) — one fixture with a
  constant continuous outcome and a varying candidate (literal 10 on the record's correlation line), one
  with no positives in a scope (literal 6 for the whole cell, no metric literal anywhere in it), and one
  three-row cell (literal 9 on the quintile calibration series). Without these, "not a dead branch" is a
  sentence rather than a property — which is exactly how the retracted `AT BAR` verdict survived a round.
- **Derived retention** (AC-78) — two fixtures whose capture rates differ must print different retention
  figures, and a scan asserts no session-count or samples-per-day literal appears in the emitted strings.
  Same shape as the evidence-class derivation test, and for the same reason: the previous hardcoded figure
  read correctly on the day it was written and was wrong by a factor of two within weeks.
- **The coupled-set pin** (AC-76) — set equality over the declared grid against the three v1 pairs,
  including `opportunity_score × structure_event`. Narrowing a `derived_from` declaration must go red; a
  registry entry with an empty provenance set must fail to compile or fail the registry test. This pin is
  the only thing standing between a future edit and an unmarked 0.932 on the feature's headline row.
- **The shared-derivation note** (AC-77) — asserted present on all five candidates' labels with the
  expected partner sets, since an absent note is invisible to review.
- **Ordering** — declared candidate order and input symbol order, asserted on the emitted vector, so a
  later `sort_by(auc)` fails rather than passes green.
- **The parity oracle** — `evaluate_baseline` retained test-only, asserting the
  `(Pooled, opportunity_score, large_abs_move)` cell reproduces its `auc`, `base_rate`,
  `precision_top_decile` and `lift_top_decile` exactly, with the calibration exception stated in the test
  itself and both pre- and post-change bin values recorded.
- **Two fixtures for derivation** — 1 session vs 3 sessions must emit different evidence-class tokens; a
  single-fixture assertion cannot falsify a hardcoded string.
- **Marker presence AND absence** — the under-powered marker on a below-floor cell (AC-49) and its absence
  on an above-floor cell (AC-52). Presence alone stays green when the marker regresses to unconditional.
- **The pinned 2026-08-11 fixture**, read through the file input path, never the live diary. A test that
  reads the ring buffer goes red on a calendar date rather than on a code change — the worst failure mode a
  regression test can have.
- **Isolation** — store byte-identity before/after a run; score/tier/fingerprint byte-identity; the empty
  diff over the scoring path except the log-only warning; no new route.

**Reviewed, because the behaviour is visible and intentional:** the evidence header's wording, the banned-
term scan's judgement calls, block ordering (primary before secondary), the control row's sentence, the
runbook edit, progress lines, and the hand-derived difference log.

**Invariants that must never silently regress**, named so a later session can find them: the three
identities; grid totality; the closed literal set and its distinctness; declared ordering; the one-way
module boundary; the paired eligibility of the control; the coupled-set pin and the non-empty provenance
rule; the derived-not-constant rule for retention; and the presence of the evidence block on every branch,
including the degenerate ones.

## 8. Guardrails this feature must not break

- **`[score-change-is-deliberate-and-measured]`** — this feature **measures only**. It changes no weight,
  constant, gate threshold or fingerprint basis; ranking a candidate is not adopting it, and no result here
  authorizes a score change on its own. Honoured three ways: the one-way module boundary makes a lab value
  reaching the score a compile-time impossibility; the tool never emits the *outcome* of the bar comparison
  (AC-44, AC-54); and the "Authorizes: nothing" line is emitted by the tool, not typed by a human (AC-46).
  The composite's newly documented level dependence (§2.2) is a **finding about the current scorer**, not
  a licence to change it — if it ever motivates one, that is a separate score-changing feature with its
  own before/after and fingerprint bump.
- **`[additive-keeps-score-byte-identical]`** — `opportunity_score`, `opportunity_tier` and
  `state_fingerprint` stay byte-identical (AC-67). The lab is a read over captured diary rows, never a
  second transform. The feature's diff touches zero file on the scoring path except one log-only `warn!`
  in `loop.rs` that reads already-computed values and appends the same sample it appends today. Declaring
  the composite's derivation provenance was a **read** of `signals.rs`, never an edit to it.
- **`[operator-vs-trader-path-separation]`** — research CLI + artifacts stay off every trader/bundle route,
  read-only and side-effect-free: no vendor fetch (AC-65), no recompute, no cache mutation, no write to the
  diary (AC-66), no new route (AC-68). `NO_UI_CHANGE` in §4 is the same rule stated on the design side.
- **`[dark-pool-context-only]`** — the off-exchange contribution to the composite is declared as a
  determinant (§2.2) and nothing more. This feature adds no dark-pool read, changes no cap, and never
  presents off-exchange confluence as directional; it only records that the score it is ranking already
  contains a capped, toggleable bonus derived from print prices matching gamma levels.
- **`[absent-is-not-none]`** — the whole vocabulary in §2.4 and §4 exists for this. Four layers carry the
  distinction from the row-level reason to the printed string; the type bans `Option<f64>` from the
  extractor signature so a number cannot be obtained without dispositioning the reason; the state is a
  required field, not an inference from a missing number; the metric layer closes the last hole (a blank
  inside an otherwise trustworthy carrier), and AC-75 proves that layer can actually fire; and C-2 closes
  the *other* end of the axis, where a withheld number and an uncomputable one would have collapsed into
  "no number here". The 2026-08-11 driver cells that all read `n = 0` are the failure this must make
  impossible.
- **`[best-effort-isolated-or-null]`** — a sample missing one candidate's inputs is excluded from that
  candidate's row and **counted by reason**, never silently zeroed, and participates fully in the other
  four (AC-11, AC-27).
- **`[model-read-carries-its-assumptions]`** — every reported metric carries its horizon, window, row and
  session counts, label rule and threshold value, basis expression and vol-basis mix, as **fields** rather
  than a human preamble a reader may skip (AC-16..AC-19, AC-46). Two later amendments extended the same
  rule rather than adding a new one: shared derivation is an assumption a number carries (AC-55, AC-77),
  and so is retention — the run computes its own span from its own rows and prints only the cap as a
  constant (AC-78), because a baked-in span is a model read that cannot carry its basis. `n_sessions` is
  the honest evidence bound; no confidence interval is printed, because a too-narrow one beside a 0.932
  manufactures the false confidence these rules exist to prevent.
- **`[structural-over-prose-enforcement]`** — where both were available, the shape that makes the violation
  impossible was chosen: metrics live *inside* `Computed`, so C-2 cannot be broken by an implementer who
  forgets it; the one-way import boundary rather than a review rule; `Result<_, Ineligible>` rather than
  `Option<f64>`; group enumeration before pairing plus a totality test rather than a note about vanished
  symbols; IDENTITY 3 rather than a comment explaining why the control requires an input it never uses;
  a mandatory, non-empty `derived_from` on every registry entry plus a set-equality pin on the coupled
  set, rather than a coupling list someone keeps in sync; two `MetricState` keys mapping 1:1 to two
  literals rather than three causes collapsed behind one string; a scan for retention literals rather than
  a reviewer remembering that the last hardcoded one went stale; and a scan for the retired literals
  rather than a memory of them.
- **`[digested-labels-not-raw-dump]`** — the artifact carries labelled cells and closed-vocabulary states,
  never a raw series; and it is not fed to the AI at all.

## 9. Open questions

1. **The three bar numbers are owner-confirmable recommendations, not settled constants.** In-run lift
   ≥ 1.10 on the primary label at ≥ 10 distinct sessions; cross-artifact sustained across ≥ 3 calendar
   weeks. They print as the bar's own **text** beside the run's values and the tool never evaluates them,
   so nothing in §3 depends on their values — but the owner should confirm them before they appear in a
   printed artifact. (The two floors, 30 rows and 2 sessions, **are** settled; §4.)
2. **Whether the second capture-side log is in scope.** The architect recommends but does not require a
   `warn!` when `with_analytics` drops a non-finite or non-positive analytic, so a live regression becomes
   distinguishable from an old capture *going forward*. It is the same class as the mandated fold-in (log
   only, changes nothing appended) and it is the only thing that could ever retire AC-28's wording
   constraint. No voice scoped it in; the synthesizer will not scope it in unilaterally.
3. **Whether a checked-in fixture of the 2026-08-11 slice's size is acceptable in this repo.** PM asked;
   nobody answered. Extraction is in scope and is a deadline (§1.10) — and the measured 168/symbol/day rate
   makes that deadline tighter than the seven-session estimate suggested. The size question is real. Note
   the trap: thinning the fixture to shrink it would change every metric it exists to pin, so the honest
   fallbacks are compression or a reduced symbol set — and a reduced symbol set weakens AC-70's inversion
   claim, which needs SPY *and* QQQ.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"89dce98ea1243ee758462e3eafd081ab064be6b50c4d2695d796a808b4d9d627","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":1,"conflict_id":"20de414e9280c54dcab4cf3164e7df10559adae4ea83de98a28f13685d4b2960","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":2,"conflict_id":"8e7d12f2ca02c613259ca9e01dbe5bb9a23cd4e7189619b473c6152b380c31a8","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":3,"conflict_id":"99f4b332a3c1a2a39da6d96709590e6061067344e1b8999652195c1ad747dcac","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"f5d058036b581b828383c0494ae244286f38af27244c1d54b4efe9009f888464","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":0,"conflict_id":"f3912c4232d6c81773929903579d1a32c2c6815ca82e8c233cf2ebfe8dbc6afd","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":1,"conflict_id":"89c6b6c72bcbf4ffed47ffe78fe57260ed01cd4e6d11c7e4788efc83f690b78d","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":2,"conflict_id":"d6474bc1b8acfcb60f754a815f0b89a2a45cfd96d95a689aa5fc55ca7234270c","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":3,"conflict_id":"6da93e3f6f271298dff650101c8a09c2fc5f4dcd1707c824505c0051f311a158","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":4,"conflict_id":"4457e51e1ccc29e29150a38922b27d6f32d688ff739c10cc50e90f1df1559bbc","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":5,"conflict_id":"8606fa508b1bee6f3dcce88c6aeece32942f808adf5ae4256661402d8d655146","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":0,"conflict_id":"59d18fe2d1497f4c8bb076ccce8e3d593f9b61c5effe80c9365f146bdfab5b50","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"12e776f113d8906ae8e70dfa0a625fe283cb2b3ec9ee56f02358074c4e54f5fa","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":2,"conflict_id":"5f86038146472799eee61408f25bca2c7529101bfa0fd23f2cb67ee635fc2c71","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":3,"conflict_id":"06800a8fec1e0e713998c0f385a454e5402982d83047acfe2847db3234ea7b13","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":4,"conflict_id":"e738d99c04852f735222cdcbe53805f9785f5a826626888d3870ec96b1d77585","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":5,"conflict_id":"e78d1f13b13e9a1c24507757dd73b98cb18c566a3f2b3f4fc834981992237b90","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":6,"conflict_id":"fe8dbed572296c5d11facf93297987f25a70f66397260ecdd4b55cd406fcb648","disposition":"folded","section":"§3"}]}
-->
