# S2 — skeptic findings: ai-rec-grounding

Reviewed: `SPEC.md` (730 lines), `INTERFACE_CONTRACT.md` (303 lines), `BRIEF.md`, `council/decisions.md`,
`council/conflicts.json` (28/28 conflicts), R1/R3 architect/pm/ux artifacts as needed. Method: walked
every closed vocabulary end to end (wire member → literal, at both files), walked four card shapes
(no_trade, normal trade, local-fallback, block-absent) counting what actually renders, checked every
claimed structural guard in §2.6 against its own poison-test bar, checked all 19 T-items / 7 D-items
(including the owner's D7 ruling) / 5 self-revisions against the shipped text, and grepped both files for
banned words.

## Critical  (blocks — must loop back to R4)

- **AC-50 is ship-blocking and has no named enforcement mechanism.** AC-50 (SPEC.md:381): "Weakening or
  removing the grounding requirement on any one checked figure makes the build go red, and that poison
  test is proven non-vacuous. **(SB)**" This is exactly the bar the task set for structural guards
  (poison it, prove the poison test non-vacuous), and it is the one ship-blocking AC in §3 that maps to
  **none** of the seven named guards in §2.6 (SPEC.md:249-262). Cross-check against the other SB
  structural ACs, which *do* each map cleanly: AC-49→guard 1 (exhaustive match), AC-51→guard 2
  (partition), AC-52→guard 4 (pinned structurally-unchecked set), AC-53→guard 5 (count identity),
  AC-55→guard 3 (leaf-purity + explicit "anti-vacuity assertion", SPEC.md:254), AC-48→guard 6
  (score_identity pins). AC-50 talks about *weakening an existing field's resolution rule* — e.g.
  loosening `ExitStop`'s tolerance formula, or widening `ExitTarget`'s containment window — and nothing
  in §2.6 names a mutation/boundary test for that. The fabrication fixture (AC-42) would catch a
  wholesale removal of the check (fabricated levels are chosen "far from every named anchor," so even a
  coarse weakening might still miss), but nothing pins a *boundary* poison test (e.g., a value placed
  exactly at `tolerance ± ε`, or a target placed exactly at the pruned-move edge) the way the `max_risk`
  parser poison test is concretely specified ("the poison test is that changing any input's parse
  *outcome* reds the build," SPEC.md:236). Compare the specificity gap directly: guard 3 gets an
  explicit "anti-vacuity assertion" name-check; AC-50's poison test gets none. A build lane could satisfy
  every §2.6 guard by name and still ship an AC-50 that is unproven.

## Important  (should fix)

- **Composition: an "all traced" card — the happy path — still carries up to six grounding-adjacent
  lines**, on top of an already-dense card. Walking a normal, fully-traced trade card: the card-level line
  (1, `all_traced`) + per-figure clauses on exit stop, exit target, invalidation (3) + the unchanged
  `CitedContractLine` (1) + the unchanged `CapAnnotation` (1, now carrying a refusal-reason sentence when
  the risk figure fails to parse) = up to 6 lines this feature touches or adds, layered onto the
  pre-existing "stale-born strip, the stale strip, the superseded strip, provenance chips, `Levels in
  play`, `What the numbers said`, the freshness line" (SPEC.md:541-545, the spec's own "Density, named as
  the largest cost" paragraph). The spec self-discloses the cost honestly but the only committed
  mitigation is wording restraint (no percentage, no named-levels row, suppressed structurally-constant
  clauses) — there is no line-count budget, no collapsing mechanism, and AC-60 (SPEC.md:391) tests only
  *horizontal* overflow at 393px, never vertical density or one-glance scannability. This is the same
  shape as the `tradeable-rec-inputs` Critical the task asked me to hunt for — individually-justified
  rules stacking — except here it is disclosed rather than accidental. I flag it as Important rather than
  Critical because it was negotiated with eyes open (T25, AC-15/18 all argue for exactly this trade), but
  the self-disclosure stops short of a concrete bound.

- **AC-35 directly contradicts the copy the same spec prescribes.** AC-35 (SPEC.md:366): "The definition
  surface names exactly what this feature checks and names **no** figure it does not check…" The
  definition tooltip it governs (SPEC.md:488-490): "Convexa checks the stop, the target and the
  invalidation level. **It doesn't check the suggested size**; the contract named and your risk cap each
  have their own line." The tooltip explicitly names "the suggested size" — a figure this feature does
  **not** check — which is precisely what AC-35's own sentence forbids ("names no figure it does not
  check"). Either AC-35 is mis-worded (its evident intent is "does not *claim coverage* of a figure it
  doesn't check," not "never mentions it") or the shipped tooltip violates a review-gated AC as written. A
  reviewer implementing AC-35 literally would have to flag the spec's own prescribed copy.

- **The halo-effect risk on the four excluded bare-dash fields is prevented only at the false-clause
  level, not tested at the reader-inference level.** AC-25 (SPEC.md:356) correctly stops a grounding
  clause, marker, chip or tint from attaching to `Structure`, `Strike(s)`, `Expiration`, `Entry trigger` —
  the literal form of UX's "grounding a lie" objection (`conflicts.json` id `485199f3…`). But that
  objection's deeper concern — that a reader who sees loud, specific grounding language on stop/target/
  invalidation will infer "no marker here = this one's fine" about the four still-bare-dash fields — is
  neither tested nor discussed anywhere in §3 or §4. The definition tooltip enumerates only what *is*
  checked (SPEC.md:488-490) and is silent about the four excluded fields entirely, which is defensible as
  an honest allowlist but is asserted, not verified against a reader. `rec-absence-literals-hole` books
  the underlying `—` defect as a known cut (SPEC.md:64-66); it does not book or test the generalization
  risk this specific council round raised. Worth a review-tier AC even if not ship-blocking.

- **No structural guard ties the `basis` enum to which `RecField` may legitimately produce it.** Per
  §2.3/§2.3-interface, `ExitStop` and `InvalidationLevel` should only ever emit `basis ∈ {exact, near}`
  and `ExitTarget` should only ever emit `basis = inside_range` — but this is stated only in the prose
  rule table (SPEC.md:147-151, INTERFACE_CONTRACT.md:139-143), not in any of the seven §2.6 guards. A
  match-arm bug that has `ExitStop` accidentally return `inside_range`, or `ExitTarget` return `exact`,
  would compile cleanly (both are legal members of the shared `basis` enum) and would only be caught if a
  fixture happens to exercise exactly that field in exactly that state — nothing enumerated is a poison
  test for this specific cross-field invariant.

- **`score_identity.rs`'s "must not be updated" discipline (guard 6) is asserted, not structurally
  enforced.** SPEC.md:260: "`apps/api/tests/score_identity.rs` constants stay byte-identical **and must
  not be "updated"**." Unlike the other six guards in §2.6, none of which merely assert a human discipline,
  nothing here describes a mechanism that would catch a build lane "fixing" a failing
  `additive-keeps-score-byte-identical` test by editing the pinned golden constants themselves rather than
  the code — the exact class of risk the task named ("a guard that satisfies a required NAME without the
  required BEHAVIOUR is worse than no guard"). The task's checklist item 9 specifically asks whether the
  spec says *how* byte-identity is enforced rather than asserted; for this one guard, the answer is: by
  policy sentence only.

- **The 11-member `anchor_kind` set has no display-label mapping anywhere in either document.** Every
  other closed vocabulary in this feature (card members, per-field states, not-checkable reasons,
  `risk_refusal` tokens) gets an explicit literal table in SPEC.md §4. `anchor_kind` does not: SPEC.md:471
  and INTERFACE_CONTRACT.md:132-133 both assert a "**total** lookup" over `gex_spot · call_wall ·
  put_wall · peak_gex_strike · gamma_flip · max_pain · vwap · vwap_upper_2 · vwap_upper_3 · vwap_lower_2 ·
  vwap_lower_3` exists and renders each as a human name inside `traces to Convexa's {anchor} ({value})`,
  but neither document names what any of the 11 renders as, or where that lookup already lives (if it is
  meant to reuse an existing shipped label from `Levels in play`). Given `digested-labels-not-raw-dump` is
  a HARD-adjacent rule this feature is built to satisfy, leaving the one multi-member lookup table that
  actually needs 11 English strings completely unspecified is a real totality gap, not a stylistic one.

- **The endpoint carrying this feature's own payload is entirely outside the machine-checkable
  conformance block, and the sole live-HTTP check of it is non-ship-blocking and key-gated.**
  `POST /api/recommendation/{ticker}` — the only endpoint that actually serializes `grounding`,
  `cap_check.risk_refusal`, and `field_reasons.invalidation_level` — is explicitly excluded from the
  conformance JSON (INTERFACE_CONTRACT.md:202-207), with the stated substitute being the in-process Rust
  fixture tests in `recommendation.rs:839`. The **only** path that would exercise the real HTTP round trip
  is the "Live browser arm," which SPEC.md §7 point 4 (line 617) marks **not ship-blocking** and which
  needs `AI_REC_LOCAL_ONLY=1` **plus a resolvable provider key** (SPEC.md:619-623). So at a GATE Q run with
  no key available, nothing confirms the actual live-served JSON shape matches the documented contract —
  only that a helper function's in-process return value does. The spec calls this the same carve-out
  `tradeable-rec-inputs` already used (INTERFACE_CONTRACT.md:207); I did not independently verify that
  precedent's text, so I flag rather than assert it is a new gap — but the task specifically asked whether
  this carve-out leaves the feature's actual payload unverified at GATE Q, and on the evidence in this
  contract, it does whenever no key is present.

- **`local_rules`'s dependency on `gamma_flip` being non-null can silently collapse the card to
  `not_applicable`, losing the calm-caption distinction the feature exists to add.** The card enum's fixed
  order puts `not_applicable` (fires when `checked == 0`, among other conditions) **before**
  `local_rules` (SPEC.md:194-201, INTERFACE_CONTRACT.md:151-160). A local-fallback rec's stop and
  invalidation are set to `gamma_flip` (T17, `decisions.md`); if `gamma_flip` is null for a given
  snapshot, those fields presumably fall back to `null` too, making `checked == 0` and firing
  `not_applicable` — under which "nothing renders" (SPEC.md:448) — **before** the calm `local_rules`
  member (whose entire purpose per T17/AC-20 is to avoid the local-fallback card looking like a normal
  unchecked/alarming one) ever gets evaluated. SPEC.md §9 Open question 4 already flags that "the hoist of
  the `local_only` env read… was read in the tree but not run" and that "the `local_rules` card member and
  the live evidence arm both depend on it" — but it does not name this specific concrete failure mode
  (order-of-evaluation causing `not_applicable` to preempt `local_rules`), only the untested-hoist risk in
  general.

## Minor / advisory

- **Component-states table places `local_rules` in the "error / degraded" column**, despite it being an
  explicitly calm, non-degraded member everywhere else in the document. SPEC.md:426: "…`could not check`
  in warning chrome; **local-rules source ⇒ the calm caption member**" sits inside the row's
  "error / degraded" header, contradicting the copy table two pages later (SPEC.md:447: `local_rules |
  … | caption · text.secondary · no icon`) and AC-20 ("no warning colour and no warning icon"). Resolvable
  by reading the more authoritative copy table, but worth a table fix — an implementer skimming only the
  component-states matrix could reasonably apply degraded styling.

- **Per-field internal branch order is not given the same "fixed order / DO NOT REORDER" formality as the
  two headline vocabularies.** §2.2 and §2.4 both explicitly declare "fixed evaluation order, first match
  wins" and invoke `CapVerdict`'s `DO NOT REORDER` discipline (SPEC.md:106, 192). The per-field resolution
  rules in §2.3 (e.g. `ExitTarget`'s "no expiration cited ⇒ `not_checkable(no_cited_expiration)`; move
  absent/not `Ok`/tenor missing ⇒ `not_checkable(straddle_move_unavailable)`") are two conditions that can
  both hold at once (no cited expiration also implies no tenor to check the move against), and their
  relative priority is only implied by table row order, never declared as a checked, ordered contract the
  way the other two enums are.

- **`grounding.counts.not_checkable`'s exact composition is only derivable from the invariant, not
  stated directly.** `counts.checked` gets its own "stated exactly" paragraph
  (INTERFACE_CONTRACT.md:164-168) explicitly excluding `not_checkable/structurally_unchecked` fields. The
  `not_checkable` integer's composition is never given the same direct statement — it is only inferable
  from the pinned invariant `traced + untraced + not_checkable == checked` (SPEC.md:208-209, AC-53) that
  it must *also* exclude `structurally_unchecked` fields, or the sum would exceed `checked` by 2 on every
  rec that states a `max_risk`/`position_size`. The ambiguity is caught by AC-53's test if implemented
  wrong, so this is a documentation clarity note, not a coverage gap.

## Checked and clean

- **Dropped-conflicts check (highest priority item), run in full.** Walked all 19 technical resolutions
  (T0–T25, excluding gaps in the numbering) and all 7 product/owner decisions (D1–D7) in
  `council/decisions.md` against `SPEC.md`/`INTERFACE_CONTRACT.md`; every one is reflected, none is
  contradicted. Checked all 5 self-revisions (S1–S5) specifically for reappearance of the withdrawn claim
  (the Python-era `ScenarioLLMProvider`/`AI_REC_SCENARIOS_ENABLED` mechanism, the quoted-cost-at-size
  `max_risk` reconciliation, the "`max_risk.rs` untouched" claim, the six-then-five-then-six card member
  count, the scripted chip+strip state row) — none reappears; the scenario mechanism is additionally
  actively rejected in §2.6's "Not buildable" list (SPEC.md:292-298), which is stronger than silence.
- **Totality of the closed sets at both wire and literal layers**, aside from the `anchor_kind` label gap
  above: `RiskRefusal` (3 members, both files agree, both copy-mapped), `basis` (3 members, copy-mapped),
  `CardGrounding` (6 wire + 1 client-selected, copy-mapped in full), per-field `state` (4 members,
  copy-mapped with the `structurally_unchecked` "nothing renders" carve-out consistent across both
  documents), `NotCheckableReason` (4 members, 3 with clauses + 1 silent, consistent), the 11-member
  `anchor_kind` id set against the `GET /api/ticker/{ticker}` conformance block (exact match, 11-for-11).
  The one dropped literal the synthesizer already reports (`candidate_quotes`, from R3-ux.md:272) is
  correctly dropped — it was UX's proposed reason for a quoted-cost-reconciliation arm on `MaxRisk` that
  T22 withdrew entirely, so no field can ever emit it in the shipped design; I found no second orphaned
  literal of this kind.
- **The `max_risk` parser poison test (checklist item 5).** Verified non-vacuous: it is stated to reuse
  the shipped, currently-passing `max_risk.rs` test suite unchanged (SPEC.md:233-237,
  INTERFACE_CONTRACT.md:179-186) as its own proof — since those tests already pin which inputs refuse vs.
  parse, any accidental loosening of the acceptance set breaks an existing, unmodified assertion rather
  than a new one written to order.
- **The D7 ladder (owner-ruled, laddered measurement).** Confirmed pre-committed in spec text rather than
  left to GATE Q discretion (SPEC.md:645-660), matching `decisions.md`'s D7 ruling near-verbatim, including
  the explicit "never a tolerance widening, never a scope cut… never a synthesized run" language and the
  retained ship-blocking status of the AC-33/AC-38-equivalents (AC-42, and AC-50 itself per SPEC.md:659 —
  though see the Critical finding above on AC-50's missing mechanism).
- **Banned-word / naming scan (AC-10).** Grepped both files for `verified`/`unverified` outside meta-
  discussion of the naming rule itself; none appears in a user-facing literal. `Traced`/`Untraced` naming
  is applied consistently; no copy string in either §4 table contains `grounding`, `hallucinated`,
  `suspect`, `invalid`, `safe`, `trusted`, `confirmed`, `validated` or `approved`.
- **`no-real-order-path` / `single-shared-sim-entry-dialog` / `single-motion-moment`.** No entry-dialog or
  order-path change is described anywhere in the diff; AC-7/AC-57 correctly gate this.
- **Card-composition walk for `no_trade` and `block-absent` cards specifically.** Both are clean: `no_trade`
  renders zero grounding surface by construction (rule 1 of the card enum fires before any other check,
  AC-19 SB), and block-absent renders exactly one substitute line in place of all per-figure clauses
  (AC-27 SB) — neither composes the way the "all traced" and local-fallback cards do (see Important
  finding above).
