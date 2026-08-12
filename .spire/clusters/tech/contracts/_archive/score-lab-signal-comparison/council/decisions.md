# score-lab-signal-comparison — R3 reconcile ledger

Input: `council/conflicts.json` (18 conflicts, 18/18 quotes machine-verified; 13 technical / 5 product;
4 self-revisions). Controller: conductor. Product calls are the owner's; technical conflicts return to
the two voices involved for one exchange.

---

## A. Self-revisions — folded, no exchange
A voice quoting its **own** R1 to withdraw a claim it can no longer defend. There is no opposing voice
to re-spawn and nothing for the owner to rule on.

| # | Voice | Withdrawn | Why it could not stand | Folded resolution |
|---|---|---|---|---|
| 5 | pm | **AC-C4** — "Re-running the retained 2026-08-11 paired slice reproduces the deep dive's published figures" | Three independent kills: (a) "retained" is false — `STRUCTURE_HISTORY_MAX = 576` + 300s thinning ⇒ ~7 sessions/symbol, so the rows evict before the feature is built; (b) the published SPY/QQQ lifts were **hand**-computed against unknown threshold scoping, which the architect's pooled-once scoping changes by construction; (c) the two Pearson figures had no field in the architect's cell shape. | Split into (i) a **pinned-fixture continuity** criterion against a committed slice and (ii) a **sign-and-ordering inversion** criterion (SPY positive / QQQ negative), which is the durable finding. Hand-derived numbers are **not** promoted to a test oracle. |
| 6 | pm | **AC-G3** — the under-powered marker keyed to a sample floor alone | A floor in *samples* certifies 221 autocorrelated rows from one 7-hour window as fully powered — the marker would be **absent on exactly the slice that motivated the feature**. | Restated with a **row floor AND a session floor**. Carries the architect's `n_sessions` as the honest evidence bound. |
| 11 | ux | **UX-2** — the derived `BELOW BAR` / `AT BAR` standing verdict | PM's Out list forbids "any per-run pass/fail against the runbook's multi-week bar" and PM's own AC-G4 string scan would flag it. A derived standing verdict **is** that pass/fail: the day it prints `AT BAR` the tool has issued the mandate the invariant exists to prevent. The architect separately proved `AT BAR` is **unreachable** — the ring buffer caps one run under two calendar weeks and cross-run roll-up is Out. | Anti-wallpaper property kept **without** the verdict: the varying token comes from the architect's `evidence_class` (facts only — `SINGLE SESSION` / `MULTI-SESSION (d=3)`), the bar's text prints beside the run's values, and the **outcome of the comparison is never emitted**. |
| 12 | ux | **"Distance to flip (%)" / "Distance to wall (%)"** as approved labels | The architect verified `projection.rs:25-45`: these fields are **signed**, and `nearer_wall_dist` returns the signed value. A label saying "distance" over a signed quantity renames the value — UX's own defining failure mode, caught by a sibling. | Relabelled **Closeness to flip** / **Closeness to nearer wall**, basis expression inline, ranked scalar `-abs(...)`. "Proximity" un-banned — UX's R1 had banned the only honest word available. |

## B. Rendered moot by the retractions above — closed, no exchange
| # | Raised | Against | Status |
|---|---|---|---|
| 0 | architect → pm | AC-C4's "retained" | Closed by **#5**. The architect's fixture-freeze proposal is adopted; see §D deadline. |
| 4 | architect → pm | AC-C5 "figures" unqualified | Closed by **#5**. Scoped to the stable ranking metrics; quantile calibration bins are **not** reproducible across a threshold-scoping change, and PM's AC-P4 version marker carries that. |
| 17 | ux → pm | AC-C4 promoting hand-derived numbers to a test oracle | Closed by **#5** — this was the same defect UX independently identified. |
| 1 | architect → ux | UX-2's unreachable `AT BAR` branch | Closed by **#11**. |
| 10 | pm → ux | UX-2's derived standing verdict | Closed by **#11**. PM's supplied bar numbers survive as owner-confirmable recommendations, not as an emitted verdict. |

**Note on the pattern:** five of the thirteen technical conflicts were resolved by voices retracting their
own claims rather than by adjudication. R1 blindness plus a sighted second round is what produced that —
each voice was shown a verified fact its own position had assumed away.

## C. Product conflicts — owner's call (surfaced one at a time)
| # | Raised by | Question | Status |
|---|---|---|---|
| 7, 16 | pm, ux (both → architect) | **v1 candidate set: six or five?** `net_gex_vol_norm_signed` is a directional hypothesis scored mostly against magnitude labels, near chance by construction; it adds 12 of 72 cells against a named legibility risk. Both voices accept `net_gex_abs_raw` as a load-bearing control. | **RULED (owner, 2026-08-12): option A — FIVE.** |
| 3, 8 | architect, pm (both → ux) | **Below-floor cells: value-with-marker, or withheld?** | **RULED (owner, 2026-08-12): option A — SHOW IT, MARKED.** |

### Ruling C-2 — below-floor cells show the value with its marker (owner, 2026-08-12)
Binding for R4 and both build tracks. UX's `withheld, not shown small` is **overruled**; UX's closure
discipline and contrast test survive intact and now apply to the marked-value literal.

- **Console renders the value with the marker in ONE literal** — shape per PM, e.g.
  `0.47 (n=4, below floor 30 — under-powered)` — textually distinct from an absence literal, from an
  above-floor value, and from a blank, **in a plain-text paste with no surrounding prose**.
- **Nothing is ever suppressed** in either the console or the artifact. The narrow-stdout suppression
  carve-out offered as UX's fallback is not taken.
- Rationale of record: withholding trades one collapse for another — a withheld cell and an
  uncomputable cell both render as "no number here", which is **`[absent-is-not-none]` failing at the
  opposite end of the same axis**. On this evidence base most cells stay thin for months, so
  suppression would leave the operator with almost no numbers and no way to watch a figure move. The
  danger of a thin number is that it is quoted **bare**; the fix is the marker plus the session count,
  not deletion. Live instance: the 47–57 calibration bin (n=4) the deep dive itself quoted.
- Unchanged by this ruling (ruled at §D.3 either way): the artifact always carries every computed
  value plus `n_eligible`, `floor_in_force`, and the derived `under_powered` boolean.
- The architect's `InsufficientN { n, floor }` CellState **stays withdrawn** — it carried no metric,
  which destroyed information at the data layer and made reproduction impossible for any thin cell.
- The floor itself is a **stated constant printed in the report**, not a hidden one. PM's
  recommendations (30 rows, plus a session floor; `n_sessions` as the honest evidence bound) stand as
  the default unless the exchange in §E surfaces a reason to change them.

### Ruling C-1 — v1 candidate set is FIVE (owner, 2026-08-12)
Binding for R4 and both build tracks:
`opportunity_score` · `net_gex_vol_norm_abs` · `net_gex_abs_raw` (control, paired eligibility) ·
`proximity_to_flip` · `proximity_to_nearer_wall`.

- **`net_gex_vol_norm_signed` is OUT of v1** and future-dated alongside `iv_hv_ratio` extremity. It is
  not cut for being wrong — it is a directional hypothesis scored mostly against **magnitude** labels
  (`large_abs_move`, `structure_event`), where it sits near 0.50 by construction and its most likely
  output reads to the operator as *"vol-normalized GEX ranks at chance"* while having tested something
  else. A wrong-reading cell is worse than an absent one. If it is ever resurfaced it is reported
  against the **direction label only** and labelled a direction hypothesis, never a magnitude read.
- **`net_gex_abs_raw` is IN**, though it was not among the BRIEF's three families. Both PM and UX
  accepted it into scope on the architect's attribution argument: a strong vol-norm row cannot be
  attributed to the normalization rather than to raw GEX magnitude without it. The BRIEF's families
  were not treated as a scope fence — recorded so a later reader does not "correct" this back.
- Grid is therefore **5 candidates × 3 labels × (1 pooled + 3 symbols)**. UX's constraints bind
  unchanged: printed as the declared set (AC-C1), in declared order, **never sorted by metric**
  (UX-10, verified by test — a later `sort_by(auc)` is green and silently converts a measurement into
  a leaderboard).

## D. Controller rulings (technical, no exchange needed)
1. **Freeze the 2026-08-11 slice as a committed fixture, now.** PM's open decision #2 becomes a
   **deadline**: at ~74 samples/symbol/session against `STRUCTURE_HISTORY_MAX = 576`, the motivating
   slice leaves the ring buffer in roughly seven sessions. Both voices independently reached this;
   there is nothing to adjudicate and delay is irreversible. Extraction is in scope for this feature.
2. **The raw diary's ring-buffer bound is recorded as a finding, not fixed here.** The BRIEF's premise
   that "the diary is accumulating daily" is **wrong for raw rows** (true only for emitted artifacts).
   Raising `STRUCTURE_HISTORY_MAX` or archiving rows is a separate durable-storage decision and is
   **out of scope** for this feature — logged to BACKLOG at GATE S. The in-code comment claiming
   ~2 RTH weeks is wrong and is corrected in passing.
3. **The artifact always carries every computed value.** Adopted from the architect's data/rendering
   split (#3 proposal) *independent of* how the owner rules the rendering question: a withheld
   artifact value cannot be reproduced, diffed week-over-week, or fed to a future roll-up. Only the
   console literal is in question.

## F. R3 exchange 1 — outcomes (all converged; zero escalations to the owner)
Artifacts: `council/R3-architect.md` · `R3-pm.md` · `R3-ux.md`.

**#2 — AC-S2's false identity: CONVERGED.** PM accepted the double-count as a factual correction.
Encoded as two identities the architect stated exactly, both quantified over the full grid with no
carve-out: **COMPOSITION** (pooled used = Σ per-symbol used; pooled exclusions = Σ per-symbol
exclusions *reason by reason*) and **CLOSURE** (within one scope, used + Σ exclusions = that scope's
own paired row count). PM notes COMPOSITION is the load-bearing one — it is what fails when a symbol
is silently dropped. Architect added **IDENTITY 3**: `net_gex_abs_raw` and `net_gex_vol_norm_abs` must
have equal eligibility counts and equal reason maps in every group and label — the encoded form of the
control's paired eligibility, which a future reader would otherwise delete as dead code. UX-7's
neighbouring scope slip fixed the same way (right-hand side is the row's own scope).

**#9 / #13 / #15 — the three vocabularies: CONVERGED ON ONE.** PM and UX independently arrived at the
**same eight** cell states; PM withdrew its five-state table as an independent vocabulary and adopted
UX's three-layer structure wholesale. Final: **L1 `Ineligible`** (row-level; never rendered alone —
reasons ride inside a parenthetical with counts) → **L2 `CellState`** (cell-level) → **L3 exactly one
literal per key, owned by UX**. Both named gaps closed: `NoPairedOutcome` added (PM's AC-S3);
**`no variation` split into `DegenerateCandidate` / `DegenerateLabel`** — a flat input and an
event-free slice are different facts with different reader remedies (AC-D4 → AC-D4a/AC-D4b). **#15
conceded fully:** "not attempted" asserts something the run did not do — attribution *was* attempted
on every sample — so AC-D5 splits into attempted-nothing-eligible (`no eligible rows (0 of 221 samples
carried score_drivers)`) and block-switched-off (`not run (--driver-loo off; 221 samples loaded, none
examined)`).
Four further UX self-withdrawals to make the set hold: `too few` (dead under C-2),
`undefined (base rate 0.00)` (could not express *no negatives*), a leading em dash that trimmed to a
reason-free string, and — the significant one — **`no input` → `no eligible rows`**, because
`no input` is true only for `InputAbsent` and silently renamed the other three reasons.

**#14 — the empty-map hole: ACCEPTED IN FULL, and it was deeper than UX found.** In the architect's R1
the group set was derived *from the paired rows*, so a symbol with zero paired rows produced **no cell
at all** — the symbol vanished rather than rendering an unexplained `n = 0`. Resolution: groups are
enumerated from `requested_symbols` **before** pairing; the grid is the total cross product (**60 cells**
at S=3 under C-1) with **no filtering step**; `state: CellState` is **required on every cell**, plus
`n_paired_in_group` and `n_samples_in_group`. A **totality test over the declared cross product** is
what catches the vanished symbol — UX's invariant can only fire on a cell that exists.

**A third defect fell out of checking that the reconciliation closes.** `binary_label` returns
`Option<bool>` and `score_lab.rs:253-257` `filter_map`s the `None`s away **silently**, so eligibility
is candidate-inputs **AND** label-defined. `Ineligible` gains a fifth variant `LabelUndefined { label }`;
without it the CLOSURE identity is false for every label with missing outcome flags.

### F.1 Two capture-path caveats — CONFIRMED, and one is a source-level `[absent-is-not-none]` breach
The architect was asked for a plain yes/no on whether either can manufacture a **false "never carried"**.
Both answers are yes.
1. **`store.rs:138-149` (`with_analytics` writes `None` for a non-finite value).** Confirmed. Consequence
   the architect **withdrew** from its own R1: `InputNonFinite` is **unreachable** for `net_gex` /
   `atm_iv` / `hv_30d` / `iv_hv_ratio` (reachable only for `score` and the geometry fields). Not fixable
   at capture — NaN is not JSON-representable and the diary round-trips through serde — so the
   constraint lands on **wording**: the literal must not claim "never captured".
2. **`pg_scan.rs:598-623` base-columns-only fallback SELECT** (decoder `try_get(...).ok().flatten()` at
   `:72-76`). Confirmed, and **worse than framed at R2**: the trigger is *any* SQL error, not only partial
   schema; it is **per symbol**, so SPY can come back analytics-rich while QQQ comes back analytics-blind,
   **poisoning the cross-symbol comparison that is this feature's whole point**; and the only trace is a
   server log while the artifact is permanent and the raw rows evict in ~7 sessions.
   **Resolution taken:** the lab loads through a **strict read with no fallback** — a hard CLI error
   before any metric is computed or any artifact is written. The serve path keeps its fallback unchanged.
   The provenance-field alternative was rejected on vocabulary cost.

### F.2 Final type shape (architect, binding for the build)
`Ineligible` (5 variants) → `CellState` (7 variants) → 8 literals (Powered/UnderPowered split off one
variant), matching UX's union 1:1. **Metrics live *inside* `Computed { metrics, power }`, so a thin cell
structurally cannot lack its numbers** — ruling C-2 made unbreakable by construction rather than by
prose. State is a total pure function via a stated precedence. `net_gex_abs_raw` needs **no** distinct
state — only a `role: Control { for_candidate }` registry field plus IDENTITY 3.

### F.3 Residuals carried into R4
- **`not applicable` may have no reachable instance in v1** (PM). All five candidates are continuous;
  UX's example assumed a boolean candidate. PM correctly names this as the `AT BAR` defect one level
  down. R4 must either name a reachable case or declare the state **reserved-and-unreachable in v1**.
- **Metric-level absence inside a `Computed` cell** (architect). `pearson` returns `None` at n < 3
  (`score_lab.rs:488-492`) and lift is undefined at base rate 0 — neither is `no eligible rows`, nor
  degenerate, nor under-powered, and the cell may be well above both floors. The stated fallback is a
  **blank**, which is the exact failure the vocabulary exists to prevent, sitting inside a cell that
  otherwise looks fully trustworthy. **Routed to UX as R3 exchange 2** (literals are UX's lane; the
  controller does not author them, and neither should the synthesizer). **RESOLVED — see §F.4.**

### F.4 R3 exchange 2 — metric-level absence (UX; loop cap reached, closed)
**Not a ninth state — a new layer.** All eight existing literals are dispositions of the **whole cell**;
rendering one for a missing metric inside a `Computed` cell would assert that a trustworthy cell is
untrustworthy — UX's defining failure mode pointing the other way. The vocabulary gains **L2m
`MetricState`**, legal **only** where `CellState = Computed`, under a precedence rule: if the cell carries
a cell-level disposition (literals 3–8), that literal renders and **no** metric-level literal appears.

**Two literals, not one** — UX applied the same test that split `no variation`, and it splits the same
way, because the causes have **opposite remedies**:
- **9** `not enough rows for this statistic (pearson needs 3 usable pairs; 2 of 147 eligible rows)` —
  the number will exist later; wait.
- **10** `undefined for this data (pearson needs the outcome to vary; abs_move is constant at 0.42
  across 147 rows)` — waiting will never produce it; the scope or threshold is what to examine.

Collapsing them would tell the reader to wait for a number that can never arrive.

**The load-bearing detail:** both literals carry **the statistic's own n**, a different fact from the
cell's `n=`. A cell can read `n=147` while `pearson` has 2 usable pairs, because the continuous outcome
is absent on the rest. **UX-27 forbids reusing the cell's n as the statistic's n** — that is the silent,
plausible-looking wrong number this pair exists to prevent.

**Dead-branch challenge answered on mechanism, not likelihood.** Under the precedence rule a base rate of
0 across the whole cell is `DegenerateLabel` (literal 6), so lift does not reach literal 10 by that path.
Literal 10 is still required: `pearson` against a constant **continuous** outcome is covered by no
cell-level state (`DegenerateLabel` concerns the **binary** label), and the zero-denominator guard exists
in code regardless of firing rate and must render something. *A literal that is the output of an existing
guard is not a dead branch; the `AT BAR` verdict — which nothing could produce — was.*

Cell trustworthiness is carried **structurally, not by words**: the literal replaces one metric's value on
that metric's own line, siblings render their numbers, and the cell's `n=` / `sessions=` are untouched. No
per-instance reassurance text was added — that is prose that drifts. Distinctness re-proved over 12
strings + a blank; first-character partition holds, neither new string contains `— under-powered:`, both
end in a balanced paren so UX-23 covers them unchanged. **UX-28 bans the bare string `undefined (`** —
the retired `undefined (base rate 0.00)` would otherwise creep back as an abbreviation of literal 10 under
width pressure. Four new ACs (UX-25…UX-28, all `test`); UX-4/5/6 extend from eight strings to ten.

**Loop status: R3 exchange cap (2) reached. All 18 conflicts closed — 0 outstanding, 0 unresolved, and
none requiring a further owner ruling beyond C-1 and C-2.**

## E. Open technical conflicts — one exchange, dispatched after the product rulings
Held deliberately: both depend on the owner's two rulings (the vocabulary must encode the
withhold decision; the candidate set determines whether a control-block state exists).

| # | Pair | Substance |
|---|---|---|
| 2 | architect → pm | **AC-S2's identity is arithmetically false** — pooled = Σ per-symbol + exclusions double-counts exclusions. Split into a composition identity and a closure identity. UX-7 carries the neighbouring scope slip. |
| 9, 13, 15 | pm ↔ ux | **Three closed vocabularies over the same cells** (PM 5 states · UX 6 literals · architect `Ineligible` 4 + `CellState`). They do not map 1:1: PM lacks "not applicable to this pair" and "block off"; UX lacks "no paired outcome" (needed by AC-S3); PM's single "no variation" must cover both a constant candidate and a constant label. UX proposes one vocabulary at three layers; PM proposes extending to eight. Also #15: "not attempted" asserts something the run did not do — attribution *was* attempted. |
| 14 | ux → architect | **Structural hole in the honesty mechanism**: `excluded_by_reason` is keyed by the *extractor* enum, so it can only explain rows that reached an extractor. A group with zero paired rows yields an **empty map** — the `n = 0` cell reappearing one level up, through the mechanism built to prevent it. Requires a group-level `state` + `n_paired_in_group`. |
