# S2 — skeptic findings: curvature-v2-desk-and-read

## Critical (blocks — must loop back to R4)

- **P4's `no_edge` disposition is justified by a false claim about the shipped code, and the SPEC
  leaves the actual reachable collision unaddressed.** §4.5's disposition table says `no_edge`
  "carries `resultState: null` — so it lives inside the idle body phase by construction, not by
  choice." That is not what the code does. `presentationPolicy.ts:106-136` computes `requestState`
  and `resultState` independently: `requestState` becomes `'no_edge'` whenever
  `readinessGateState === 'no_fresh_edge'` (`:125`) regardless of `rec.status`, and `resultState` is
  set from `rec.strategy` whenever `rec.status === 'produced'` (`:128-136`) — nothing in the function
  makes these mutually exclusive. So a user who already has a **produced, pinned trade** (`rec.status
  === 'produced'`) can simultaneously have `readinessGateState === 'no_fresh_edge'`
  (e.g. conditions moved after the read was produced, before it went stale by the `stale`/`stale_born`
  mechanism): `requestState = 'no_edge'`, `resultState = 'fresh_trade'` (or `'no_trade'` /
  `'incomplete_trade'`) — not `null`.
  Worse, I traced what the **host component** actually renders in that state:
  `AiRecPanel.tsx:205` computes `producedRec = signedIn && rec?.status === 'produced' && rec.strategy
  ? rec : null` — independent of `requestState` — and `:387-388` mounts `<DecisionCard>` whenever
  `producedRec` is truthy, while `:423` mounts `<ActionRegion>` (the component that renders the A1b
  quiet-gate note, `AiRecPanelBlocks.tsx:205-224`) **only when `!producedRec`**. `no_edge` is not in
  `POWERING_STATES` (`AiRecPanel.tsx:52-61`), so `poweringCta` is false and does not force the
  no-edge branch either. Net effect: in this reachable state, the produced trade renders exactly as
  a normal fresh trade, and the A1b quiet-gate note (`no_edge`'s entire named disposition) **never
  mounts at all** — there is no visible sign anywhere that the guardrails currently see no fresh edge.
  Nothing in §2.6's "one total mapping function `(requestState, resultState) → ReadLayout`" or in
  §4.5's case table names a destination for the pair `(no_edge, fresh_trade)` (or `no_edge` paired
  with any non-null result state) — the mapping's "exhaustive switch with a `never` default arm" the
  SPEC requires will have to invent behavior here with zero spec guidance, which is exactly the
  silent-fall-through risk P4 was ruled to close. This is not a hypothetical edge case: it is the
  ordinary shape of "the market moved and the guardrails tightened after I got my read," which is
  precisely the risk canon 16 and ruling P4 exist to be honest about. — evidence:
  `presentationPolicy.ts:106-136`, `AiRecPanel.tsx:52-61,176-183,186-196,205,387-388,423-432`,
  `AiRecPanelBlocks.tsx:205-224`; SPEC.md §4.5 disposition table row for `no_edge`, and §2.6.

## Important (should fix)

- **A sixth conductor-made call is presented in SPEC.md without the DELEGATED marking the document's
  own preamble promises "everywhere it is cited."** SPEC.md's header states "Five product calls in
  this spec were taken by the conductor under a written delegation... marked DELEGATED — not RULED —
  everywhere they are cited" (SPEC.md:7-12), and only P1–P5 carry that tag. But
  `OVERNIGHT_DECISIONS.md` §"Decided at R4" (D-14) records a **sixth** solo call: "`decisions.md`
  settled that one vocabulary member covers every null level... It did not say which... **Decided (by
  the R4 synthesizer, recorded here because it is a real call, not a drafting choice): `-`**." That
  is the same shape as P1–P5 (a conductor call made without full three-voice convergence, while the
  owner was asleep), yet SPEC §4.3 and §9 item 1 narrate the `—` choice as a resolved-on-precedent
  determination ("§4.3 resolves it to `—` on shipped precedent... Recorded here because the divergence
  is real") with **no DELEGATED tag, no P-number, and no cross-reference to
  OVERNIGHT_DECISIONS.md's own admission that this was a synthesizer call, not a council
  convergence**. A reader of SPEC.md alone — which is the document GATE Q and the build lane actually
  consume — has no way to know this literal was picked unilaterally rather than by the same
  file:line-settled technical-conflict process that resolved the other sixteen conflicts in
  `decisions.md` §2. This is the exact failure mode the delegation-marking discipline exists to
  prevent: it hides from the owner which decisions were taken for them. — evidence:
  `OVERNIGHT_DECISIONS.md` §"Decided at R4 (the synthesizer hit a gap my record left open)" / D-14;
  `SPEC.md:1-13` (preamble), `SPEC.md` §4.3 ("`—`... on shipped precedent"), §9 item 1.

## Minor / advisory

- **DELEGATED lineage on individual acceptance-criteria rows is indirect.** Rows 30, 31, 36, 38, 39,
  41–43 (P2/P4) and rows 52–53 (P5) and rows 23–24 (P1) trace back to DELEGATED rulings only through
  the "Design direction" rule table (SPEC.md §4.6, lines ~686–691) and the P1/P4/P5 prose sections —
  no row in the §3 AC table itself carries an inline DELEGATED marker. A reviewer scanning only the AC
  table (the artifact most likely to be pasted into GATE Q or a build ticket) would not see the
  delegation lineage without cross-referencing three other sections. Not incorrect, just one hop
  further than the document's own stated design ("marked... everywhere they are cited").
- **`term_structure`'s current three-way rendering (`null` → `'unavailable'`, `points.length < 2` →
  `'—'`, else `.state`) is untouched by the SPEC's read-strip closure language**, and §2.4/criterion
  28 do not explicitly bless or change this three-arm behavior. Both `'unavailable'` and `'—'` are
  legal members of the closed nine (`notANumber.ts:26-36`), so this is not a guardrail breach, but the
  SPEC never states whether the read-strip's `term_structure` slot keeps this shipped three-way split
  or collapses to the single member criterion 28's neighbours (`off_exchange`) use — worth a sentence
  so the build lane doesn't have to guess. — evidence: `DealerPositioning.tsx:189-205`.

## Checked and clean

- **Dropped conflicts (check 1).** Counted and cross-read all 32 `spire:council-resolution:v1`
  markers against `decisions.md` and the folding JSON at SPEC.md's tail (10 architect + 9 pm + 13 ux
  = 32, matching `decisions.md`'s "32/32" claim). For every marker I checked the cited section
  actually carries substance addressing the named conflict (not just a marker sitting near unrelated
  prose): the gamma-flip fabrication and the "value + boolean both from the latch" fix (§2.2), the
  distance-anchor triple resolution (§2.3), the read-strip 7-vs-8 cardinality reversal and the
  off-exchange dual-cause `not provided` (§2.4), the container-query hazard and the strip-vs-cell
  naming fix (§2.5), the count-shaped-criterion withdrawal (§3 commentary), the overflow scheme split
  (§3 commentary, cross-checked against source below), the "useful primary action" replacement (§3
  commentary), the unconditional amber census (§3 commentary), the `Live`/`Mid` word deletion (§4.2),
  the ladder absent-value member and the distance-cell-never-blank rule (§4.3), the canvas
  name/summary/debt three-way split (§4.4), the A6a/A6b split and the P4 dispositions table (§4.5),
  and the four-canon-amendments table (§4.6). All 32 substantively resolve, with one exception
  (`no_edge`'s disposition, filed above as Critical).
- **Citations, spot-checked at source (check 7).** Read the actual files and line ranges for a large
  sample of the SPEC's `file:line` claims and found them accurate, including the two the council
  flagged as previously-wrong-and-now-corrected: `ai-rec/copy.ts:318` (confirmed: `gex_spot: 'levels
  spot', // NOT \`spot\`...`) and `design/src/lib.mjs:296` (confirmed:
  `role="img" aria-label="Net dealer gamma by strike"`). Also verified:
  `useFlashOnChange.ts:44-46` (write-before-guard) and `:71-74` (dynamic `@keyframes flash-{tone}-{id}`
  minting); `single-motion-moment.spec.ts:54-55,58` (literal-name scan, dynamic-keyframe gate);
  `no-overflow.spec.ts:43-54,398` (one-scheme wide bands, the `Call wall` readiness anchor);
  `LiveTape.tsx:93,96,110,116,180-184,188,190,199,204`; `TapePulseStrip.tsx:31-34,71,73,199,204,207-211,
  219-221`; `FigureCell.tsx:129-148,216-217,251,260,267-275,285,305`; `DealerPositioning.tsx:109,117,
  127,133,147,157`; `distanceToLevel.ts:11-14`; `notANumber.ts:9,14-16,26-36`;
  `StructureFieldCanvas.tsx:11,18,223,237,434`; `generated/schema.ts:1687,1703,1705,1716,1731,1748`;
  `Widget.tsx:163`; `hex-discipline.spec.ts` (live, self-checking exemption list);
  `AlertsPage.tsx:24-49`; `DESIGN_SYSTEM.md:161,168,169,171,172,173,177` (rules 6, 13, 14, 16, 17, 18,
  22). Every one of these matched the SPEC's description exactly. No new false citations found beyond
  the two already corrected.
- **Overflow widths (check 8).** Rows 49–50 and the supporting narrative correctly state **393 in
  both colour schemes, 834/900/1280 in the one scheme the standing suite runs** — matching
  `no-overflow.spec.ts:43-54` exactly. This is the error the council caught twice before; it is not
  present a third time in the SPEC text.
- **Motion enforcement (check 5, "does it actually bite").** The SPEC's own §7 narrative ("How the
  motion rule actually bites — and what it still cannot see") accurately describes
  `single-motion-moment.spec.ts`'s two real blind spots (literal-keyframe-name scanning cannot see a
  rAF paint loop; `useFlashOnChange`'s dynamic `flash-{tone}-{id}` names are gated only by home-file
  membership, not by content) and correctly does **not** claim the shipped allowlist test, by itself,
  enforces the rAF-driven field/trail motion — it instead requires a **new** extracted pure-paint-step
  test against a recording fake context (criterion 20) and is explicit that if that extraction is
  dropped, criterion 20 degrades to `review`, not to a `test` mark on something no harness can see. I
  poisoned this mentally against the actual allowlist test and confirmed: adding a new named
  `@keyframes` red-builds (set-equality assertion, `:114-125`); a rAF loop with no named keyframe does
  not red-build the allowlist test (as the SPEC itself says) and depends entirely on the not-yet-built
  extraction. The SPEC does not overclaim here.
- **DELEGATED preservation for P1–P5 (check 2).** All five are consistently marked DELEGATED (never
  RULED) at every site I found them cited: the in-scope bullet (P5), the four-amendments list (P1
  part 3, P3, P4), §4.4 (P1), §4.5's rule-16 amendment header (P4), §4.6's amber-scope subsection
  (P2), and the design-direction rule table (P2/P3/P4). See the Important finding above for the one
  place a sixth, non-P-numbered conductor call is *not* held to the same discipline.
- **Interface contract vs data flow (check 4).** Cross-read `INTERFACE_CONTRACT.md`'s pinned fields
  against SPEC §2's data-flow claims (the `gex_spot ?? price` anchor, the five nullable level fields,
  `off_exchange`'s dual-cause omission, the gate/cap fields behind cooldown vs daily-cap). All
  consistent; no field the UI in §4 consumes is missing from the conformance block, and no pinned
  field contradicts §2.
- **Vacuous-proof shape (check 6).** No acceptance criterion in §3 asserts a bare count where
  closure/non-synonymy was meant (rows 32–35 explicitly replace the withdrawn tally per owner ruling
  3's precedent — confirmed in `decisions.md` §1 item 2), and no criterion asserts a bare absence
  without a positive check (row 5, row 13, row 26 all pair "renders member X" with "and never renders
  member Y / a zero / `$—`"). Invariant 1's compile-time `@ts-expect-error`/TS2578 mechanism
  (§7) is a real, non-vacuous enforcement shape, not an `expect(true).toBe(true)` in spirit.

## Pass 2

**Scope note.** This pass verifies the four pass-1 repairs at source and hunts for regressions. It
does not re-litigate the 32 markers' substance, the overflow widths' correctness, the §7 motion
narrative, the P1–P5 DELEGATED tags, or the ~40 spot-checked citations beyond a sampling sufficient to
catch a regression — those are pass 1's job and stand as recorded above.

### 1. The Critical — CLOSED, verified total over the reachable grid

Re-derived the 15×7 grid from `presentationPolicy.ts:106-136` directly (not from the SPEC's
description of it) and checked §2.6's per-request-state reachability table against that derivation:

- `loading` / `signed_out`: reachable with `resultState ≠ null` — confirmed. `resultState` is computed
  independently of `signedIn`/`loading` (`:128-136` reads only `rec`/`stale`/`superseded`), and
  `AiRecPanel.tsx:205` gates `producedRec` on `signedIn && rec?.status === 'produced'`, so when
  `signedIn` is false or `loading` is true, `producedRec` is forced `null` regardless of `resultState`
  — the host genuinely suppresses the body, matching "the produced read is suppressed by the host, not
  annotated."
- `unavailable` + the 7 powering-reason states: **not** reachable with `resultState ≠ null` —
  confirmed. `resultState ≠ null` requires `produced` (`rec.status === 'produced' && rec.strategy !=
  null`, `:108`), and both routes that can produce these 8 request states are foreclosed when
  `produced` is true: `responseKeyState(rec)` (`:101-104`) returns non-null only when `rec.status ===
  'unavailable'`, and the host's `poweringReason` (`AiRecPanel.tsx:176-181`) is forced `null` whenever
  `rec?.status === 'produced'`, so `poweringRequestState(null)` also returns `null` (`:97` default
  case). Both routes closed ⇒ genuinely unreachable, exactly as claimed.
- `missing_key`: reachable with `resultState ≠ null` **by the one route named** — confirmed.
  `!input.inAppEnabled && !scenarioSelected` (`:122`) reads neither `rec` nor `produced`, so it can
  fire regardless of result state. The SPEC's claim that this collision is real and shipped ("the
  powering CTA renders beside the produced read... independent branches") is independently confirmed
  below (§2 of this pass) — it is not an invented scenario, it is live in `AiRecPanel.tsx`.
- `daily_cap` / `cooldown`: reachable with `resultState ≠ null` — confirmed, both conditions
  (`:123-124`) read only `cap.over_limit` / `cooldownRemaining`, never `rec`.
- `no_edge`: reachable with `resultState ≠ null` — confirmed (the Critical's own subject).
- `idle`: reachable trivially (the fallback; this is the ordinary produced-read case) — confirmed.

All 15 request states are accounted for in the table, each with a stated reachability verdict and a
mechanical reason, and every reason checks out against the actual `??` chain rather than against the
SPEC's paraphrase of it. The `(no_edge, fresh_trade)`/`(no_edge, no_trade)`/`(no_edge, incomplete_trade)`
pairs — the specific hole the Critical named — now have a named destination (A1c) with an evidence
column that accurately describes the current gap (`AiRecPanel.tsx:423` gates `ActionRegion` on
`!producedRec`, so A1c is honestly described as "the render change that closes that hole," not as
already-shipped behavior). **This closes the Critical as filed**: the false-claim sentence is gone,
replaced by a corrected disposition, and the "correction carried in" paragraph (SPEC.md:692-702)
narrates the original error accurately, including citing itself as a source of the error
(`[cited-code-is-verified-not-assumed]`, §8, now explicitly extended to cover claims about behavior,
not just paths).

**Pass-1 Critical: CLOSED.**

### 2. The three mechanical claims — two confirmed exactly, one confirmed-but-imprecise

- **`askAnyway` on `no_edge` alone.** Confirmed at `presentationPolicy.ts:168`:
  `askAnyway: !loading && requestState === 'no_edge'`. (Your checklist cited this as
  `AiRecPanel.tsx:168`; that line in `AiRecPanel.tsx` is actually
  `const poweringCta = POWERING_STATES.has(presentation.requestState);`, unrelated. The SPEC itself
  never makes this misattribution — its own prose establishes the `:NNN` references as
  `presentationPolicy.ts` line numbers earlier in the same paragraph (`:125`, `:128-136`) and stays
  consistent — so this is not a SPEC defect, just a note in case the file attribution matters
  downstream.) **True as stated.**
- **`daily_cap`/`cooldown` precede `no_edge` in one `??` chain.** Confirmed:
  `presentationPolicy.ts:115-126` is a single chained `??` expression assigning one variable; `:123`
  (`daily_cap`) and `:124` (`cooldown`) are evaluated before `:125` (`no_edge`), and because the whole
  expression assigns exactly one final value, a capped/cooling-down request can never simultaneously
  be `no_edge`. **True as stated** (and, trivially, true of any single-assignment `??` chain — the
  claim doesn't depend on ordering so much as on there being one variable, but the ordering claim
  itself is accurate).
- **`retry`/`refresh` require `requestState === 'idle'`, so a stale/superseded read under `no_edge`
  has neither.** **Refresh: true exactly as stated** —
  `refresh: !loading && degraded && requestState === 'idle'` (`:177`) is a strict conjunction with
  `'idle'`; under `no_edge` it is unconditionally `false`.
  **Retry: the conclusion holds, but the premise as phrased overstates the code.**
  `retry: !loading && ((degraded && requestState === 'idle') || unavailableRetryGate)` (`:169`) is an
  **OR** of two independent paths — the `'idle'` path, and a second path gated on
  `requestState === 'unavailable'` (`unavailableRetryGate`, `:152-157`), not `'idle'`. Retry does
  **not**, in the general case, "require `requestState === 'idle'`" — it can be `true` under
  `'unavailable'` with no `'idle'` in sight. The SPEC's specific application (a stale/superseded read
  *under `no_edge`*) still lands correctly, because under `no_edge` both disjuncts are false
  (`requestState` is neither `'idle'` nor `'unavailable'`), so `retry: false` holds — but the
  sentence licenses a broader, false generalization about `retry`'s gating that a future reader could
  carry into a different context (e.g. assuming retry is idle-gated when reasoning about the
  `unavailable`/A10 case) and get wrong. **Minor, filed below** — the specific criteria resting on it
  (row 58's "the note supplies the only recovery control" framing) are not undermined, since the
  conclusion for the actual `no_edge` state is correct.

### 3. The Important (D-14, six not five) — CLOSED

Traced the six-count and the DELEGATED tag through every site the checklist named:

- Preamble: "there are six, not five" (SPEC.md:7), names D-14 explicitly alongside P1–P5, states all
  six are DELEGATED "everywhere they are cited, including on the acceptance-criteria rows."
- §4.3 heading: `### 4.3 ... — DELEGATED (D-14)` (SPEC.md:553).
- §4.3 body: "**That member is `—`** — and this is **DELEGATED (D-14)**, the sixth call, not a
  council convergence." (SPEC.md:566).
- AC row 5: "... — **DELEGATED (D-14)** for the choice of `—`" (SPEC.md:378).
- §9 item 1: "The level-absence member is a DELEGATED call — D-14, the sixth." (SPEC.md:989) and item
  2: "The six delegated calls (P1–P5 and D-14)..." (SPEC.md:1000).

Grepped the whole document for `conductor`, `R4 synthesizer`, and `DELEGATED` (35 hits) and found no
seventh untagged conductor call hiding in the rewrite: every DELEGATED-adjacent sentence resolves to
one of P1–P5 or D-14. The `term_structure` three-way-render blessing in §2.4 (flagged as Minor in pass
1, not Important) is explicitly framed as *preserving shipped behavior unchanged*, not as a new call —
that framing is consistent with it staying untagged, whether or not you'd have drawn that line the
same way.

**Pass-1 Important: CLOSED.**

### 4. The two Minor findings — both CLOSED

- **AC-row lineage.** Sixteen rows now carry an inline `DELEGATED (Pn)` / `DELEGATED (D-14)` tag: 5,
  23, 24, 30, 32, 33, 34, 35, 36, 41, 42, 43, 52, 53, 58, 59 — plus the legend paragraph immediately
  above the table ("**DELEGATED lineage is carried on the row itself.**", SPEC.md:365-370) stating the
  provenance rule and naming the section each P-number/D-number resolves in. A reviewer scanning only
  the AC table now sees the tag on the row itself, no cross-reference required.
- **`term_structure`'s three-way render.** §2.4 now has an explicit named subsection ("`term_structure`
  keeps its shipped three-way render, and that is not a second vocabulary," SPEC.md:216-228) arguing
  the three-way split is legitimate (the two absences *are* distinguishable for this field, unlike
  off-exchange), and criterion 60 pins exactly the three arms (`unavailable` / `—` / wire `state`) with
  a closing "never a fourth literal." Checked against `DealerPositioning.tsx:189-205` — the three arms
  described match the shipped code exactly (`:194` → `unavailable`, `:196` → `—`, `:197` → `.state`).

**Both pass-1 Minor findings: CLOSED.**

### 5. The self-repairs, audited as work

- **§4.5 header arithmetic.** Recounted the actual 13-row case table (SPEC.md:621-635) by its own
  "composition" column: exclusive body = A1a, A1b, A2, A3, A4, A6a, A6b, A8, A10 (**9**); outer gate =
  A7 (**1**); composes over = A5, A9, A1c (**3**). `9 + 1 + 3 = 13`, matching the header's "thirteen
  render cases on three axes — nine exclusive body cases, one outer gate, and three that compose over
  a produced read" (SPEC.md:617-618) exactly. No hand-waving found — recomputed independently of the
  header's own prose and it matches the table, row for row.
- **Criterion 59 / the conjunction discriminator.** Confirmed the discriminator is load-bearing, not
  decorative. Row 59 asserts two paired facts at two fixtures: at the A1c fixture (verdict mounted +
  `no_edge`), the Mono `no_trade` line must be **absent**; at the A1b fixture (no verdict mounted +
  `no_edge`), it must be **present**. If a build collapsed the discriminator — e.g. rendered the note
  purely off the shared string `No fresh edge right now` without conditioning the Mono line on
  verdict-mount status — one of those two fixture assertions necessarily fails: either A1c gains the
  line it must not have, or A1b loses the line it must have. There is no way to satisfy row 59 by
  accident once the discriminator is removed; poisoning it (mentally, against the described fixture
  shape) reds. This is a real, non-vacuous test shape, not a restatement of row 33's general
  non-collapse rule — row 33 says "don't identify two cases by a shared marker alone" in the abstract,
  row 59 is the concrete two-fixture proof that the abstract rule is actually enforced for this
  specific colliding pair.

**No defect found in either self-repair.**

### 6. Regressions — none found

- **32 markers, same sections.** Recounted the `spire:council-folding:v1` JSON block at SPEC.md's
  tail: 10 architect + 9 pm + 13 ux = 32, matching pass 1's count. Spot-checked several markers whose
  surrounding prose was touched by this pass's repair (`33c52bfb...` — §4.3, still sits directly after
  the D-14 paragraph and before "The distance cell is never blank"; `022d67fa...` — §4.5, still sits
  directly after the corrected `no_edge` disposition table; `6b4274a2...` — §4.5/§4.6, still anchors
  the amber-scope subsection) — none moved section, none lost its anchor to unrelated prose.
- **Overflow widths.** Rows 49–50 (SPEC.md:422-423) still read "At 393px in both colour schemes, and
  at 834, 900 and 1280 in the one scheme the standing suite runs" — unchanged, still matches
  `no-overflow.spec.ts:43-54`.
- **No criterion went vacuous, count-based, or absence-only.** Checked the criteria nearest the
  rewrite (rows 5, 41, 42, 58, 59, and the §4.5 disposition table's `no_edge` row) — each pairs a
  positive assertion with a negative one (row 5: renders `—` *and* never a zero/`$—`/dropped row; row
  58: the read stays present and readable *and* the note never replaces it; row 59: the two-fixture
  presence/absence pair above). None reintroduces a bare tally or a bare-negative check.

**No regressions found.**

### 7. The residue (§9 item 6) — recording is not sufficient; this is the same defect, differently named

§9 item 6 states plainly that `cooldown`/`daily_cap` over a produced, pinned read are "structurally the
same shape as `no_edge`," reachable the same way (`presentationPolicy.ts:123-124` don't read
`rec.status`, exactly like `:125`), and that the shipped host renders **neither** the countdown nor the
cap notice in that state — because `ActionRegion` (their only home) is gated on `!producedRec`
(`AiRecPanel.tsx:423`) exactly as the original `no_edge` bug was. I traced this independently
(§1 above, "daily_cap/cooldown: reachable with `resultState ≠ null`") and confirm the mechanism is
identical: a capped or cooling-down user holding a pinned trade sees that trade rendered with **zero**
visible sign that a further ask is blocked, for the same structural reason `no_edge` silently dropped
its gate note before this pass's repair.

The SPEC's defense for treating them differently is a single sentence: `no_edge` is "a claim about the
market the pinned read describes" (so it qualifies the read itself), while cooldown/cap are "a claim
about the request budget" (so they qualify only the *next* ask, not the read on screen). That
distinction is doing all the work of leaving this unresolved, and it has three problems:

1. **It was never put to the council.** "P4's obligation named `no_edge`, `superseded_inputs` and
   `incomplete_trade`; it did not name these, and no voice argued them" (SPEC.md:1026-1027) is an
   honest admission that this is a synthesizer opinion, not a ruling — yet unlike D-14, it carries no
   DELEGATED tag, no P-number, and isn't listed in the "six, not five" preamble. It is a seventh
   unilateral call, just one framed as an open question instead of a decision, which is a distinction
   without a difference for a reader trying to know which product judgments were actually
   council-tested.
2. **The distinction doesn't survive contact with `[model-read-carries-its-assumptions]`** (§8), which
   this very SPEC invokes to justify A1c: "a read the guardrails no longer back carries that fact on
   its face... rather than reading as an ordinary fresh trade." A daily cap or a cooldown *is* the
   guardrails declining to back a further ask — the read on screen is exactly as unbacked by "can I get
   another opinion on this" as it is under `no_edge`. The guardrail text draws no exception for
   request-budget claims versus market claims; the SPEC's own rationale for A1c applies to this pair
   with no textual seam to hang the difference on.
3. **The asymmetry is not cost-neutral.** The SPEC treats `no_edge`'s silence as a Critical-grade defect
   requiring a new render case (A1c) with two acceptance criteria (58, 59) and a dedicated invariant
   (§7 invariant 5's runtime companion), while an admittedly-identical mechanism for `daily_cap`/
   `cooldown` gets a paragraph in Open Questions and ships unchanged. If the owner reads §9 quickly (as
   the ADHD-scannable-report convention this repo's own global agreement assumes), the phrase "and
   nobody ruled on them" reads like a footnote, not like "this ships with the same silent-guardrail gap
   you just paid a whole council round to close for the sibling case."

**Judgment: this is the same defect wearing a different name, not a genuinely distinguished residual
question.** Recording it is necessary but not sufficient — the honest disclosure in §9 is real progress
over silence, but the disclosure itself contains the argument for why it should have been folded into
P4's obligation (or DELEGATED under a D-15) rather than left open. I am not filing this as a fresh
Critical, because the SPEC does not misstate the code here the way the original `no_edge` disposition
did — the mapping is total, the behavior is accurately described, and it is visibly flagged rather than
hidden. But "no voice argued them" is not the same claim as "the voices considered and declined to
extend P4 here," and the paragraph reads as if it were. Filed as **Important** below rather than
Critical, on the strength of that distinction — but a synthesizer or owner treating §9 item 6 as
adequately resolved-by-disclosure should not be surprised if a future council round reopens it as the
same shape of finding, filed against the same evidence.

## Important (pass 2 addition)

- **§9 item 6's "nobody ruled on them" is itself an undisclosed seventh conductor call, and the
  distinction it offers does not survive the SPEC's own guardrail text.** See "The residue" analysis
  above in full. Evidence: `presentationPolicy.ts:123-125` (identical reachability mechanism for
  `daily_cap`/`cooldown`/`no_edge`), `AiRecPanel.tsx:423` (identical `!producedRec` gate silencing all
  three), SPEC.md §8 `[model-read-carries-its-assumptions]`, SPEC.md §9 item 6 (SPEC.md:1016-1029).

## Minor / advisory (pass 2 addition)

- **The `retry`/`refresh`-require-`'idle'` claim (§4.5, "Four consequences," bullet 3) overstates
  `retry`'s actual gating.** `retry` (`presentationPolicy.ts:169`) is `(degraded && requestState ===
  'idle') || unavailableRetryGate`, where `unavailableRetryGate` requires `requestState ===
  'unavailable'`, not `'idle'`. The specific conclusion drawn (no retry control under `no_edge`) is
  correct, because neither disjunct is satisfiable when `requestState === 'no_edge'` — but the sentence
  states a blanket premise ("both require `requestState === 'idle'`") that is false of `retry` in
  general and could mislead a reader reasoning about a different request state (e.g. A10/`unavailable`)
  where `retry` is in fact sometimes true. — evidence: `presentationPolicy.ts:152-157,169`.
