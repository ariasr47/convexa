# S2 — skeptic findings (VERIFICATION PASS): score-lab-signal-comparison

Scope: confirm the two prior Criticals are genuinely fixed, independently re-verify the newest
`opportunity_score`/dark-pool claim at source, and sweep the rest of the file for regression. R4 is
spent — nothing here loops back automatically; each item states plainly whether it blocks handoff.

## Critical (blocks — must go to the human)

None. Both prior Criticals are genuinely closed (see Part 1 below), and I did not find a new defect
that meets the "unbuildable / silently wrong" bar the two originals met. The two Important findings
below are real and should be fixed, but neither invalidates a shipped acceptance criterion or leaves an
implementer with no way to build the feature — which is the line the prior Criticals crossed and this
pass's findings do not.

## Important (should fix before handoff)

- **§1's rewritten "honesty" framing of the 0.932-vs-0.467 contrast mischaracterizes what the deep dive
  actually shows, and in doing so quietly reintroduces the exact "structure signal" confusion the
  banned-term table exists to prevent.** SPEC.md §1 states: *"the contrast as the deep dive states it —
  `structure_event` AUC **0.932** beside composite **0.467** — reads as two independent signals measured
  against one label, and it is not."* This is not what `docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md`
  contains. Its "Global ranking metrics (primary)" table (lines 18–24) has **one** candidate — the
  composite score, the only thing the pre-feature lab ever scored — and **three label rows**:
  `large_abs_move` → AUC 0.467, `up_move` → AUC 0.569, `structure_event` → AUC 0.932. Both 0.467 and
  0.932 are the **same signal** (`opportunity_score`) scored against **two different labels**, not two
  different signals scored against one label — SPEC.md's own §7 confirms this independently
  ("the parity oracle... asserting the `(Pooled, opportunity_score, large_abs_move)` cell reproduces its
  `auc`... exactly," pinning 0.467 to `opportunity_score × large_abs_move`; the deep dive's own table pins
  0.932 to the same candidate against `structure_event`). So the sentence has the shape of the error
  backwards: the deep dive did not present "two signals, one label" — it presented "one signal, two
  labels," and the actual failure mode (which SPEC.md correctly disclosed via AC-55/AC-76/AC-77
  elsewhere) is that the composite is a poor magnitude predictor (0.467) but scores near-perfectly against
  a label it is partly built from (0.932) — a within-signal artifact, not a cross-signal one. Worse,
  writing "`structure_event` AUC 0.932" as a thing standing beside "composite 0.467" implicitly treats
  `structure_event` — which the spec's own term table (§4) is careful to ban calling a "signal" or
  "event prediction," precisely because it is a **label**, not a candidate — as if it had its own,
  independently measured AUC. That is the same category of error the banned-term row exists to prevent,
  now sitting in the section that motivates the whole feature. The underlying disclosure requirement this
  paragraph leads into (AC-55, AC-76, AC-77) is independently and correctly grounded via the
  `signals.rs:477,493` citations and the derivation-intersection mechanism (verified sound in Part 1/2
  below), so **this does not block handoff** — but the narrative that justifies the feature to its reader
  is currently inaccurate and should be corrected: it should say the composite is compared against
  different labels, not that two different signals were compared against one.

- **`opportunity_score`'s `derived_from` — `{Score, CallWall, PutWall, Flip, IvHvRatio, Setups}` —
  is not actually complete, and the "verified, not assumed" claim overclaims what was checked.**
  §2.2 verifies the composite's determinants by citing `opportunity_score_parts` (`signals.rs:477,493`)
  only — the `proximity` (40 pts, wall/flip nearest) and `transition` (10 pts, flip proximity) terms. But
  the caller one function up (`:458–464`) adds a **further, real determinant** after that function
  returns: `let (dp_bonus, dp_matches) = dark_pool_confluence(state, off_exchange); ... drivers.total =
  (drivers.total + dp_bonus).min(100);` — up to `DARK_POOL_BONUS_CAP = 6` more points, live in production
  (`state.rs:450`, `main.rs:252,544` all default `include_dark_pool: true`, wired through
  `analytics.rs:316–327`'s `compute_analytics` → `load_or_compute`, which is what the scanner loop calls
  to produce the very `score` `StructureSample` stores and the lab reads). `dark_pool_confluence`
  (`:506–546`) matches off-exchange print prices against **four** levels — `call_wall`, `put_wall`,
  `gamma_flip` (already covered by the declared `CallWall`/`PutWall`/`Flip` keys) **and `peak_gex_strike`**
  — which has **no representation anywhere in the closed `DerivationKey` enum** (`Score · NetGex ·
  VolScalar · IvHvRatio · Setups · Flip · CallWall · PutWall · ForwardPricePath` — no `PeakGex`). The
  spec's own justification for declaring the wall/flip keys applies with equal force here — *"which of
  the three levels supplies the 40 is data-dependent... so all three are determinants and all three are
  declared"* — but that discipline was not applied past line 493 to the dark-pool block that sits ~15–50
  lines further down in the same function's caller. Consequence, scoped honestly: **this does not change
  AC-76's pinned three-pair set today** — no v1 candidate or label reads `peak_gex_strike` or any
  dark-pool field, so nothing is currently silently unmarked. But it does mean (a) the "verified, not
  assumed... a later reader can re-verify in one grep" claim is not true of the full determinant set, only
  the documented half of it, and (b) the closed enum is not actually closed over everything `score`
  depends on — which is precisely the gap Critical 2's fix was designed to make impossible by
  construction. If a `PeakGex`-adjacent candidate or label is ever added (a plausible "Future" item, given
  dark-pool confluence is already a first-class field on the artifact's own `score_drivers`/`ScoreDrivers`
  struct), it would silently fail to couple against `opportunity_score` because the key literally does not
  exist to intersect on. **Does not block handoff** — no shipped AC or test depends on this being complete
  — but should be corrected before the derivation registry is implemented, either by adding a `PeakGex`
  key and including it in `opportunity_score`'s row, or by an explicit, honest note that the dark-pool
  contribution is out of the provenance model's current scope (rather than the current silent omission
  dressed as a completed verification).

## Minor / advisory

- Given the dark-pool finding above, §2.2's "up to half the composite's scale is level proximity" is
  itself slightly conservative — a fully-loaded score with a dark-pool match could be up to 56/100 (before
  the `.min(100)` clamp on the *base* absorbs it), not "up to half." Cosmetic once the Important finding
  above is addressed; not worth its own fix otherwise.

## Part 1 — the two prior Criticals: both genuinely fixed

- **Critical 1 (unreachable literal-10 example) — fixed, and traced to its root rather than papered
  over.** Confirmed via `MetricState` in SPEC.md §2.4: only `UnderMinimum` and `UndefinedOnThisData`
  remain — `BaseRateZero` is gone, not folded into a payload (§2.5(b) correction 2 says so explicitly and
  §2.10's "not buildable" list records the rejection). Confirmed the withdrawn worked example is actually
  withdrawn: SPEC.md §4's literal-10 row now reads `undefined for this data (pearson needs the outcome to
  vary; abs_move is constant at 0.42 across 147 rows)` — a pearson-vs-constant-continuous-outcome
  instance, not the old lift-vs-zero-base-rate one — and §4 adds an explicit "There is deliberately no
  lift/base-rate-zero instance of literal 10... Do not re-add it" callout. Confirmed the reachability
  argument that makes this work is real, not asserted: §2.4's precedence function now states plainly
  *"Arm 5 is label-scoped and is therefore evaluated for cells only; a candidate-scope record has no label
  and runs arms 1–4 then 6."* I checked this carve-out is exercised consistently everywhere the vocabulary
  is used — the Carriers table (§2.4) scopes correlations to "a candidate-scope record... which holds the
  correlations (§2.8)," §2.8 itself keeps `pearson_vs_abs_move`/`pearson_vs_ret_simple` on
  `candidate_scope[]` and not on `cells[]`, the §2.6 corollary states the record-scope closure is
  "label-free," and AC-70/AC-75 both talk in terms of "candidate-scope record," never "cell," for the
  correlation. No section still treats correlations as if they lived on a cell or were subject to arm 5. I
  also traced the fix to the council record to confirm it isn't a synthesizer invention: `R3-ux.md` §8.3
  (lines 305–311) has **both** the now-withdrawn lift example **and** the correct pearson-vs-constant-
  outcome reasoning UX itself wrote alongside it — the current SPEC.md keeps the latter and drops the
  former, exactly as the original S2 finding asked for. AC-75 pins both directions with fixtures (literal
  10 reachable via a constant-outcome record; literal 6, not literal 10, on a no-positives scope), and §7
  lists this as one of the two "must-fire" tests alongside AC-76. **Verdict: fixed, no residue.**

- **Critical 2 (`definitionally_coupled` unverifiable / silently unreachable on the headline case) —
  fixed, and I independently recomputed the intersections rather than trusting the prose.** The mechanism
  is now `candidate.derived_from ∩ label.derived_from ≠ ∅` over the closed `DerivationKey` enum, with
  `derived_from` mandatory-non-empty by construction (SPEC.md §2.2, §5's new "empty `derived_from`" error
  row, §8's guardrail list). I recomputed all 5×3 = 15 candidate×label pairs from the declared sets printed
  in the two registry tables:
  - `opportunity_score {Score, CallWall, PutWall, Flip, IvHvRatio, Setups}` × `structure_event
    {ForwardPricePath, CallWall, PutWall, Flip}` → `{CallWall, PutWall, Flip}` ≠ ∅ — **fires**.
  - `proximity_to_flip {Flip}` × `structure_event` → `{Flip}` ≠ ∅ — **fires**.
  - `proximity_to_nearer_wall {CallWall, PutWall}` × `structure_event` → `{CallWall, PutWall}` ≠ ∅ —
    **fires**.
  - Every other one of the remaining 12 pairs (all three candidates against `large_abs_move`/`up_move`,
    both `net_gex_*` candidates against all three labels) intersects the empty set, because `large_abs_move`
    and `up_move` declare only `ForwardPricePath` and neither `net_gex_vol_norm_abs` nor `net_gex_abs_raw`
    declares it, and `structure_event`'s three level keys never appear in the GEX candidates' `{NetGex,
    VolScalar}` / `{NetGex}` sets.
  This reproduces AC-76's pinned set of exactly three pairs **exactly**, with nothing extra and nothing
  missing, under the registry as declared. I also checked the reverse direction — candidate×candidate
  `shares_derivation_with` (AC-77) — against the same declared sets and confirmed the five copy blocks in
  §4 ("Copy — candidate labels") match the pairwise intersections precisely (composite↔both geometry
  candidates via shared level keys; the two GEX candidates ↔ each other via `NetGex`; no other pair). The
  original blocker — `label.inputs` never being specified anywhere — is closed: the labels table (§2.2)
  now declares `derived_from` for all three labels, `structure_event`'s explicitly naming
  `ForwardPricePath, CallWall, PutWall, Flip` with a stated reason ("its three flags are forward-path facts
  computed **against the sample's own levels**"), which is the R1-architect `LabRow` fact (`hit_call_wall`
  / `hit_put_wall` / `crossed_flip`) the original finding said was undeclared. **Verdict: fixed** — modulo
  the Important finding above, which shows the *candidate* side of this mechanism (`opportunity_score`'s
  own `derived_from`) is not fully complete, though not in a way that changes AC-76's pinned output today.

## Part 2 — the new `opportunity_score`/wall/flip claim: verified at source, with one gap found

Read `libs/quant-engine/src/signals.rs` directly rather than trusting the spec's citations:
- `:471` `opportunity_score_parts` — confirmed signature and body match the spec's description.
- `:13` `FAR_LEVEL_PCT = 0.03` — confirmed, used at `:486` (`40.0 * (1.0 - nearest / FAR_LEVEL_PCT)`).
- `:241` `near_flip = gamma_flip_pct.is_some_and(|d| d.abs() <= FLIP_PROXIMITY_PCT)` — confirmed.
- `:19` `FLIP_PROXIMITY_PCT = 0.01` — confirmed, and `:493` `transition = if near_flip { 10.0 } else {
  0.0 }` — confirmed, up to 10 points.
- `:477` `[dist.call_wall_pct, dist.put_wall_pct, dist.gamma_flip_pct]` fed through `.flatten()`, nearest by
  abs value, `(40.0 * (1.0 - nearest / FAR_LEVEL_PCT)).max(0.0)` — confirmed, up to 40 points.
So the specific line-numbered claims in §2.2 are all accurate as far as they go. The gap is what they
don't cover — the dark-pool bonus block described in the Important finding above, which I found by reading
past line 493 to the caller (`:458–464`) and its callee (`:506–546`). That is the one place this
verification pass disagrees with the spec's "complete and correct" framing of `opportunity_score`'s
`derived_from`.

§1's honesty claim for the 0.932-vs-0.467 contrast: **not honest as currently worded** — see the Important
finding above. The underlying disclosure mechanism it leads into is sound; the framing sentence
misdescribes what is being contrasted.

## Part 3 — regression sweep

All eight claimed side effects verified present and accounted for, nothing else found to have moved:

1. **New Out-of-scope bullet (deconfounding)** — present, SPEC.md §1: *"Deconfounding — no partial
   correlation, no residualized candidate, no 'score minus its proximity term' variant... measuring a
   signal's independent contribution is a modelling change and is future-dated."*
2. **Four new banned terms** — present, §4 term table, "shared determinants" row: `independent, unrelated,
   orthogonal, standalone` — exactly four, matching the claim.
3. **§1 In-scope renumbered 1–11** — confirmed, items 1 through 11 present and sequential.
4. **§9 cross-reference §1.9 → §1.10** — confirmed: §9 item 3 now reads "(§1.10)"; grepped the whole file
   for `§1.9` and found zero remaining instances — no stale reference left behind.
5. **New §5 row** — present: "A registry entry declares an empty `derived_from` | Build failure... | none
   written | compiler / test output" — a direct, sensible consequence of the Critical-2 fix's mandatory-
   non-empty constraint.
6. **AC-76 amended in place** — confirmed, now the coupled-set pin with the three named pairs and the
   "narrowing/emptying fails a test" language.
7. **AC-77 appended** — confirmed, last criterion before the coverage map, `shares_derivation_with`.
8. **§9 reduced to three items** — confirmed, exactly three open questions remain (bar numbers, second
   capture-side log, fixture-size-in-repo). I cannot independently confirm a fourth item existed and was
   closed (no prior SPEC.md revision was available to diff), but the current three are consistent with
   what a resolved Critical-2 would leave behind, and none reads like a punt.

**Re-checked items my prior pass marked clean, against source, in case the wholesale `Write` rewrites
reproduced them incorrectly:**

- **Interface-conformance block.** Re-read `apps/api/src/routes/scan.rs:196–212` and
  `apps/api/src/services/scanner/store.rs:55–101` directly. `StructureHistoryResponse`'s `symbol`,
  `samples`, `basis`, `stored_count`, `backend` and `StructureSample`'s `symbol`, `as_of` still carry no
  `skip_serializing_if` — unconditionally present, matching `INTERFACE_CONTRACT.md`'s `"required"` list.
  The four analytics fields and `score_drivers` still carry `#[serde(default, skip_serializing_if =
  "Option::is_none")]` (`store.rs:64,87,90,93,96,99`) and are still correctly omitted from the "required"
  set. No drift.
- **`STRUCTURE_HISTORY_MAX`/`MIN_INTERVAL` arithmetic.** Re-read `store.rs:27–33` —
  `STRUCTURE_HISTORY_MAX = 576`, `STRUCTURE_HISTORY_MIN_INTERVAL_SECS = 300.0`, still there, still backing
  the "~7 sessions" / "roughly seven sessions" arithmetic used in §1 item 10 and §2.7. The stale in-code
  comment ("~2 RTH weeks") is still present and still correctly described by the spec as "wrong... corrected
  in passing" (Out-of-scope bullet) — no regression, and nothing claims it's already fixed.
- **`NotApplicable`-vs-`AT BAR` asymmetry.** §2.5(a)'s text is materially unchanged from what the prior
  pass verified: `NotApplicable` remains structurally unreachable (no arm of the precedence function emits
  it), kept only as a reserved member, with AC-38 testing the negative. No new arm was added anywhere in
  §2.4's precedence function that would make it reachable, and no new v1 candidate was introduced that
  would need it.
- **C-1/C-2 ruling fidelity.** Re-grepped the current SPEC.md for `net_gex_vol_norm_signed` — still absent
  from the candidate table, declared-order text, and every AC; present only in Out-of-scope/Future/C-1
  rationale prose, with AC-3 still enforcing its total absence as a `test`. Re-grepped for
  suppression/withholding language — still none that contradicts "shown, marked, never suppressed"; C-2's
  ruling language is reproduced consistently in §4 and §2.10. No re-litigation.
- **Silent-drop coverage map.** Spot-checked a sample of IDs against the current coverage-map line
  (`PM AC-C1→1, ... architect: ... NotApplicable reserved→38 · S2 skeptic: literal-10 reachability→75,
  coupling must-fire→76 · verified scorer provenance (signals.rs:477,493): composite coupling→76, shared
  derivation→77`) — all consistent with the ACs' actual content (AC-1 is the five-candidate declared set;
  AC-38 is the `NotApplicable` reserved-and-unreachable test; AC-75/76/77 are exactly the three ACs this
  verification pass exercised in Parts 1–2). No numbering drift found in the areas I could cross-check
  against source or the R3 record.
- **§9 open questions.** Still exactly three, still the same three (bar numbers, second capture-side log,
  fixture-size-in-repo), still correctly unresolved rather than silently assumed — matches the prior
  pass's verdict and `decisions.md` §F.3's explicit "the synthesizer will not scope it in unilaterally" for
  Q2.

## Checked and clean (this pass)

- Re-verified §2.4's precedence function and the "arm 5 is cell-only" carve-out against every place the
  vocabulary is used (Carriers table, §2.8 artifact shape, §2.6 corollary, AC-70/75) for internal
  consistency — no contradiction found.
- Recomputed all 15 candidate×label derivation intersections by hand from the declared registry tables —
  reproduces AC-76's pinned three pairs exactly, and reproduces all five `shares_derivation_with` notes in
  §4's copy block exactly.
- Read `signals.rs:1–40, 155–260, 380–470, 471–560` directly to verify every line-numbered claim in §2.2
  and to find what the citations omitted (the dark-pool block).
- Traced `dark_pool_confluence`'s wiring to production defaults (`state.rs:450`, `main.rs:252,544`,
  `analytics.rs:316–327`, `analytics.rs:71–88` `load_or_compute` called from the scanner loop) to confirm
  the omitted determinant is live in the code path that produces the diary's `score` field, not a dead or
  test-only branch.
- Read `docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md` in full to ground the §1 framing finding in the
  actual source document rather than the spec's paraphrase of it.
- Read `council/R3-ux.md` §8.3 and `council/decisions.md` §F.3/§F.4 directly to confirm the Critical-1 fix
  traces to a real, pre-existing council resolution rather than a fresh synthesizer claim.
- Re-read `scan.rs`/`store.rs` field-by-field against `INTERFACE_CONTRACT.md`'s conformance block; re-read
  the `STRUCTURE_HISTORY_MAX`/`MIN_INTERVAL_SECS` constants; grepped for `net_gex_vol_norm_signed` and
  suppression language across the current SPEC.md.

## Net verdict

Both prior Criticals are genuinely, traceably fixed — not just reworded. The two Important findings above
are real and should be corrected, but neither reopens a Critical: the derivation-intersection mechanism
that Critical 2 was about produces the correct pinned set today regardless of the `PeakGex` gap, and the
literal-10 reachability that Critical 1 was about holds up under a full internal-consistency sweep. **This
spec is buildable as written.** Fix the two Important findings before or shortly after handoff; neither
blocks starting the plan.
