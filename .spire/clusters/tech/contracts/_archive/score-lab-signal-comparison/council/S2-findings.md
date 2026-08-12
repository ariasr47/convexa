# S2 — skeptic findings: score-lab-signal-comparison

## Critical  (blocks — must loop back to R4)

- **Literal 10's own worked example is unreachable under the spec's own precedence rule — a dead
  branch reintroduced one level below the one the spec claims to have eliminated.** SPEC.md §4
  ("Copy — the ten literals") gives, as "a second instance of literal 10":
  `undefined for this data (lift needs a non-zero base rate; 0 positive of 147 rows at
  large_abs_move >= 0.42%)`.
  But SPEC.md §2.4's state-precedence function says, first match wins: *"5. `n_positive == 0` or
  `n_positive == n_eligible` → `DegenerateLabel`"* — **before** step 6, `Computed`. `MetricState`
  (and therefore literal 10) is legal **only where `CellState = Computed`** (§2.5(b): *"if the cell
  carries a cell-level disposition (literals 3–8), that literal renders and no metric-level literal
  appears — a metric cannot be 'undefined' inside a cell that was never computed"*). A cell with "0
  positive of 147 rows" is, by construction, `DegenerateLabel` — and its literal is already given,
  verbatim, as literal 6's own example: `no variation in the label (147 rows, 0 positive / 147
  negative at large_abs_move >= 0.42%; ranking undefined)` (SPEC.md §4, literal 6 row). The two
  worked examples use the **identical fixture** (147 rows, 0 positive, same threshold) to illustrate
  two literals that the precedence rule says cannot both exist for the same cell — meaning literal
  10's lift example, as written, can never actually be produced by a conforming implementation.
  This is not a synthesis slip invented at R4: it is inherited unreconciled from
  `council/R3-ux.md` §8.3, where UX's own text states, two lines below giving that exact example:
  *"Under the precedence rule, a base rate of 0 over the whole cell makes the cell `DegenerateLabel`
  (literal 6) and lift never reaches literal 10 by that path."* UX kept the (self-admitted dead)
  lift example anyway "for the shape," and the synthesizer copied it into the binding SPEC without
  flagging or removing it. §2.5(b) closes with *"Not a dead branch, on mechanism rather than
  likelihood"* — the exact claim this example falsifies. Fix: drop the lift/base-rate-zero instance
  from literal 10's worked examples (it is already covered, correctly, by literal 6), or name the
  actual mechanism (if any) by which a per-statistic base rate can be zero while the cell-level
  `n_positive` is not — none is given.

- **`definitionally_coupled`'s reachability for the feature's own headline motivating case is
  unverifiable, because `label.inputs` is never specified anywhere in the spec or the council
  record.** The mechanism is stated once: *"`definitionally_coupled` is derived, not
  hand-maintained: `candidate.inputs ∩ label.inputs ≠ ∅`, emitted as a boolean plus the intersecting
  field names"* (SPEC.md §2.2), and AC-55 requires it fire "wherever [the] figure appears." The
  candidate registry's `inputs` are fully specified (SPEC.md §2.2 table: e.g.
  `proximity_to_flip` → `dist_to_flip_pct`, `proximity_to_nearer_wall` → `dist_to_wall_pct`). But no
  file anywhere declares what `structure_event`'s (or `up_move`'s) `inputs` list contains.
  This matters because the canonical worked example for the whole mechanism — PM's own words,
  `R1-pm.md` §"Product behavior": *"A candidate that shares its inputs with a label —
  distance-to-wall scored against a label defined as 'price reached the wall' — produces an
  impressive number that means almost nothing... an unmarked 0.93 in that cell is the single most
  likely way this feature produces a false mandate"* — is **exactly** `proximity_to_nearer_wall` /
  `proximity_to_flip` scored against `structure_event` ("path geometry hit: wall touch or flip
  cross," SPEC.md §4 term table), and `structure_event` AUC 0.932 is one of the BRIEF's two named
  motivating findings. `structure_event`'s actual determinants, per `R1-architect.md`'s `LabRow`,
  are the **forward outcome flags** `hit_call_wall` / `hit_put_wall` / `crossed_flip` — not the
  candidates' snapshot fields `dist_to_flip_pct` / `dist_to_wall_pct`. If `label.inputs` is declared
  as those outcome-flag names (the natural, literal choice), the field-name intersection is
  **empty**, and the exact cell PM named as the single most likely false mandate ships with **no**
  coupling caveat — silently reproducing the deep dive's original unflagged risk. Unlike
  `NotApplicable` (§2.5(a), which gets an explicit unreachability proof) or the three IDENTITY
  invariants (§2.6, each with a stated mechanism), no comparable proof or worked example is given
  here to establish that AC-55 actually fires for `structure_event` × either geometry candidate, and
  no AC requires that it does (there is no "must-fire" negative-space test analogous to AC-38's
  unreachability test in the other direction). This is a genuinely unbuildable acceptance criterion
  as written — an implementer has no way to know what `label.inputs` should contain, and the
  quietest choice (the label's own computed-outcome fields) is the one that fails silently.

## Important  (should fix)

- **No worked example shows the one composition rule AC-34 mandates.** §2.5(b) states an
  under-powered cell's block header carries the marker while a sibling metric rendering literal 9 or
  10 renders "alone" with no marker of its own, and AC-34 makes this a `test`-verified requirement.
  Both "rendered in place" illustrations given (§2.4 near the type definitions, and §4 in the Copy
  section) show only above-floor, non-marked cells (`AUC 0.63 (n=147, sessions=4)` /
  `Lift@10 1.21 (n=147, sessions=4)` / `Pearson  not enough rows for this statistic (...)`) — none of
  them is drawn from an under-powered cell. Given that AC-52's own note explicitly warns that a
  marker "can regress to unconditional and stay green, the same wallpaper failure the standing
  verdict was retracted over," the one interaction most likely to regress silently (marker present in
  the header, absent on the metric line, in the *same* cell) has no concrete instance to test
  against or diff a future render regression against.

- **The MetricState 3→2 correction trades a type-level distinction for a prose-payload one for the
  `BaseRateZero` cause**, which is in tension with `[structural-over-prose-enforcement]`'s stated
  preference ("where both were available, prefer the shape that makes the violation impossible ...
  rather than by prose an implementer must remember" — SPEC.md §8). §2.5(b) states *"the causes...
  ride inside `UndefinedOnThisData`'s `precondition` / `failing_fact` payload"* rather than being
  separately typed, as the architect's original three-variant sketch had them. This is lower-severity
  than it looks only because the first Critical finding above shows `BaseRateZero` is not actually
  reachable through this literal in practice — but that itself was never established anywhere in the
  chain (R3-architect → R3-ux → SPEC), so the "nothing is lost" claim in §2.5(b) rests on an
  unexamined premise.

## Minor / advisory

- The coverage map's citations (`C1b`, `S2a`/`S2b`, `V1`, `P5`, `L1`/`L2`, `D4a`/`D4b`, `D5b`,
  `G3a`–`G3f`) are **not** traceable to `R1-pm.md` alone — they require `R3-pm.md`, which restates
  and splits PM's original criteria. I verified all of these against `R3-pm.md` and they check out
  (see "Checked and clean" below), but the map itself gives no pointer to `R3-pm.md`/`R3-ux.md`, so a
  reader auditing "so nothing is silently dropped" from SPEC.md alone cannot actually verify it
  without independently locating the R3 files — worth a one-line pointer in the map's preamble.

## Checked and clean

- **Silent-drop check (checklist #1), PM side.** Cross-referenced every ID in the coverage map's `PM
  AC-*` list against `R1-pm.md` and `R3-pm.md`. Every entry — including the ones with no counterpart
  in `R1-pm.md` (`C1b`, `S2a`/`S2b`, `V1`, `P5`, `L1`/`L2`, `D4a`/`D4b`, `D5b`, `G3a`–`G3f`) — is a
  documented restatement/split from `R3-pm.md`, itself produced by the converged R3 exchange
  recorded in `council/decisions.md` §F. No PM criterion is missing from the final AC-1..74 set;
  several are demonstrably strengthened (e.g. AC-59's three-cause failure vs. PM's original
  two-cause AC-E1).
- **Silent-drop check, UX side (spot-checked).** UX-1 through UX-28 (R1 + the R3 exchange-2 additions
  in `R3-ux.md`'s appended §"R3 exchange 2") all map to an AC in the final set; the metric-level
  literals 9/10 (UX-25..28) are present as AC-33..36.
- **Interface conformance block (attack surface #2).** Verified against source: `symbol`, `basis`,
  `stored_count`, `backend` (`StructureHistoryResponse`, `scan.rs:203-212`) and `samples[].symbol`,
  `samples[].as_of` (`StructureSample`, `store.rs:73-85`) carry **no** `skip_serializing_if` — they
  are unconditionally present, so asserting them as `"required"` in the conformance JSON cannot
  false-fail on an empty or pre-analytics diary. The four analytics fields and `score_drivers` do
  carry `skip_serializing_if = "Option::is_none"` (`store.rs:64,87,90,93,96,99`) and are correctly
  **not** asserted. The block parses under `.claude/tools/interface_conformance.mjs`'s
  `## Conformance spec` heading regex and its fan-out-on-`samples[]` logic passes vacuously on an
  empty array, matching the file's own stated claim.
- **`NotApplicable` reserved-and-unreachable (attack surface #3).** Confirmed the asymmetry with `AT
  BAR` holds: `AT BAR` was a *verdict* the output would print as if it might be reached (a claim
  about the data), made unreachable only by an external fact (retention); `NotApplicable` is simply
  never assigned by the six-arm precedence function in §2.4/§2.5(a) — no code path constructs it, and
  the enum member exists only so a future boolean candidate has somewhere to land. AC-38 tests the
  negative (no cell ever carries it) rather than asserting a positive it cannot produce. This is a
  materially different, and coherent, shape.
- **C-1 / C-2 ruling fidelity (attack surface #6).** Grepped SPEC.md for `net_gex_vol_norm_signed` —
  appears only in the "Out of scope" and "Future" prose, never in the candidate registry, the
  declared-order table, or any AC; AC-3 makes its total absence a `test`. Grepped for any
  suppression/withholding language for below-floor cells — none found; AC-49/AC-53/§4's "Component
  states" table are all consistent with "shown, marked, never suppressed." No re-litigation found in
  either file.
- **Buildability against confirmed capture-path facts (attack surface #8).** No AC or prose assumes
  `InputNonFinite` is reachable for `net_gex`/`atm_iv`/`hv_30d`/`iv_hv_ratio` (SPEC.md §2.7 states the
  unreachability directly, matching `R3-architect.md` §5A); AC-28's wording constraint ("not carried,
  or dropped at capture as non-finite/non-positive," never "never captured") matches the verified
  capture-path fact. `STRUCTURE_HISTORY_MAX = 576` / `STRUCTURE_HISTORY_MIN_INTERVAL_SECS = 300.0`
  confirmed at `store.rs:29,31`, matching the "~7 sessions" arithmetic used throughout §1/§2.7/§4.
- **Open questions (§9).** All three are genuine, unresolved owner/product calls, not synthesizer
  punts: Q1 (bar numbers) is explicitly "owner-confirmable" throughout the R3 record with no voice
  claiming authorship; Q2 (the second capture-side log) was explicitly left unscoped by every voice
  per `council/decisions.md` §F.3 ("No voice scoped it in; the synthesizer will not scope it in
  unilaterally"); Q3 (fixture size in-repo) was asked by PM (`R2-pm.md` ask #2) and never answered by
  any voice or ruling — correctly left open rather than silently assumed.
