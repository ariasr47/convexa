# S2 — skeptic findings: tradeable-rec-inputs

## Critical  (blocks — must loop back to R4)

- **The cap annotation has no defined state for a `no_trade` verdict, and the unconditional
  cap-verdict computation predictably produces a false-failure caveat on the exact verdict class
  this feature exists to improve.** AC-57 states, without carve-out: "With a risk figure that
  cannot be read as an unambiguous dollar amount — **including when it is absent** — the surface
  states that it could not check against the cap, never a pass by default." §2.5 defines
  `cap_check.verdict = not_checkable` as covering exactly that case ("**Includes the null case.**
  Never a pass by default") and states the verdict is "computed in the rec assembly path... at the
  same point the risk block is read" with no gate on `decision`. Every `no_trade` response has
  `max_risk = null` on both existing code paths
  (`apps/api/src/services/recommendation.rs:524-534` — the empty-setups branch — and `:561-571` —
  the local rule-based branch, both leaving `max_risk`/no analogous field set for no_trade; the
  spec's own AC-70 confirms `max_risk` is always absent on `no_trade`: "A `no_trade` verdict
  renders `—` on all four fields... never `unavailable`"). Combine these three binding rules and a
  `no_trade` verdict with a cap set computes `cap_check.verdict = not_checkable` **every time**,
  which by AC-57 must render "Couldn't check against your cap" in the `warning.*` + icon treatment
  (AC-60) — a caveat that reads as Convexa having tried and failed to check something, attached to
  the verdict class the owner just ruled (2026-08-12) must read as "a result, never an empty
  state" (§4, line ~757) and must never carry "empty or zero-result" framing (AC-68). Neither the
  Cap annotation's component-states row (§4) nor any AC scopes the annotation away from `no_trade`,
  and no AC exercises the both-missing case. — evidence: SPEC.md AC-57 (§3, S5 row) vs AC-70 (§3, S6 row)
  vs §4 "The `no_trade` verdict is a result, never an empty state" vs AC-68 vs §2.5 "The cap
  verdict is computed in the rec assembly path... at the same point the risk block is read";
  `apps/api/src/services/recommendation.rs:517-579` (both `local_strategy_from_bundle` branches
  confirm `max_risk` absence/non-numeric-string on the no-LLM path used for offline/CI verification,
  which is exactly the path the build's own tests will exercise for `no_trade`).

## Important  (should fix)

- **`field_reasons.position_size`'s `missing_input` token has no tie-break rule when its two
  named dependencies are both absent.** §2.5's dependency table states `position_size` depends on
  "the risk block **and** candidate quotes," and the rule for the `unavailable` case is "null with
  at least one required input in an absent/not-set/not-derivable state ⇒ `unavailable`, **with the
  missing input named**." The wire field is a single-value closed enum
  (`missing_input: "risk_block" | "candidate_quotes" | "straddle_move" | null`,
  INTERFACE_CONTRACT §5) — it cannot carry two reasons. When an owner has no risk block set **and**
  the candidate set comes back empty/unavailable for the same request (a realistic simultaneous
  failure, not a contrived edge case), the spec never states which single token wins. This is
  exactly the class of ambiguity the document is otherwise scrupulous about closing — the cap
  verdict's triggers are "pinned so two implementations cannot disagree," the drop-reason
  vocabulary has a "fixed evaluation order... each contract counted exactly once" specifically so
  two implementations can't diverge — but `position_size`'s dual dependency has no equivalent
  priority rule anywhere in §2.5, the R3-architect UX-1 answer (which introduces the mechanism), or
  the interface contract. No AC exercises the both-missing case.

## Minor / advisory

- **BRIEF.md's "(AC-92)" cross-reference for the before/after verdict comparison ship condition is
  stale.** BRIEF.md line 46 reads: "A recorded **before/after verdict comparison** produced as a
  ship condition (AC-92)." In the final SPEC.md, that criterion is **AC-89** ("A recorded
  before/after comparison of rec verdicts exists across at least five named tickers... **(ship-
  blocking)**"); AC-92 in SPEC.md is an unrelated export-drawer criterion ("A category that was not
  sent renders an explicit `Not sent` line rather than an omitted section"). SPEC.md's own
  ship-blocking list (end of §3) is internally consistent and correctly cites AC-89, so this is
  upstream drift in BRIEF.md from the AC-renumbering during R2/R3 folding, not a SPEC.md defect —
  but it is worth a synthesizer note since it could mislead a reader cross-checking the ship gate
  against the brief. **[Pass-1 note, self-corrected in Pass 2: SPEC.md's own §1 "in scope" bullet
  also carried this exact stale "(AC-92)" at the time of this finding — it was not purely an
  upstream BRIEF issue. See Pass 2 below.]**
- **§2.5's summary sentence ("multi-strike structure, right absent, or expiration absent ⇒ no cited
  contract ⇒ no per-contract quote line, falling through to the literals in §4") reads as though
  right-absent collapses into the same generic bucket as multi-strike/expiration-absent. It does
  not: §4 and the interface contract (`cited_contract.state`) correctly split it into its own
  `right_undetermined` state with dedicated two-legs/no-quote-shown copy, and R3-UX's binding
  correction explicitly forbids reusing the off-set literal for it ("Do not... fall back to UX's
  off-set literal"). The imprecise §2.5 phrasing risks reintroducing exactly the ambiguity that
  correction closed, even though the correct detail is present elsewhere.
- **§2.4(a)'s claim that "a shipped export sentence promises no account data leaves" (governing why
  account size is excluded from the outcome ledger) is the one empirical claim in the document not
  backed by a file:line citation, unlike virtually every other cross-reference in this spec. It
  plausibly refers to the FE-only `outcome-ledger` feature's export path
  (`features/trading/outcomes/`), but I could not confirm which specific surface/string it points to
  in the time available — worth tightening to the same evidentiary standard as the rest of the
  document.

## Checked and clean

- **Checklist #1 — dropped conflicts (highest priority, done first).** Cross-referenced all 22
  `conflict_id`s in `council/conflicts.json` against SPEC.md's `<!-- spire:council-resolution -->`
  folding receipt (the JSON block at the file's footer) and against `council/decisions.md` plus all
  three `R3-response-{pm,architect,ux}.md` files. All 22 are folded; none are missing, and none
  appear only as a marker without matching bound text. Spot-checked ~12 by reading the actual bound
  wording in SPEC §1–§4 against the R3 resolution: window-monotonicity replacing "strictly fewer
  expirations," the server-side-derived effective-dollar-cap for percent caps, the right-token
  schema addition with no default, `position_size` never parsed, the tenor/candidate consistency
  invariant + pruned-`market_state`-clone mechanism, the four-member cap-verdict vocabulary with
  pinned triggers, the broker-book exclusion (both the architect's and UX's independent conflicts on
  it), one-cap-not-min-of-two, the `not set` vs `not entered` vs `size not suggested` vocabulary
  sweep, the basis-line anchor-spot addition, session-basis as set-level-only, and — the task's
  named owner ruling — the digested no_trade liquidity line (`c134ba40` + `ff3e6c92`), where SPEC
  §4's "no_trade is a result" section and AC-66 both faithfully carry the owner's exact content
  definition (candidate count × expiration count, ATM spread band, wide-quotes marker) plus the
  drop-count-with-reason addition that `decisions.md`'s cross-response-reconciliation section
  explicitly folds into that same line. Found no dropped conflict and no cosmetically-folded one.
- **Checklist #6 — guardrail breach, with code grounding.** Verified every cited source line against
  the actual tree, not just the prose: `apps/api/src/services/llm.rs:120-147,124-131,341-390,
  364-371,372-389,137` (schema string, `parse_strategy_json`'s tolerant re-projection, the `bias`
  default vs. the proposed right token's no-default rule, `market_state` forwarded wholesale);
  `apps/api/src/services/recommendation.rs:432-448,517-579` (`as_of`/`pinned_fingerprint` at
  436-437, both `local_strategy_from_bundle` branches, the `position_size` literal at line 570);
  `apps/api/src/infrastructure/massive/rest.rs:737-747,775-834` (the zero-bid filter at 822-824 —
  spec cites 823-824 for the two `filter(|x| *x > 0.0)` lines, exact — and the IV-coercion-to-0.0
  at 813-817, exact); `apps/api/src/state.rs:240-242` (`AnalyticsSnapshot.contracts` is
  `#[serde(skip)]`, confirmed); `apps/api/src/domain/market.rs` (`MarketPhase::classify`,
  `rth`/`after_close`/`closed_pre`); `apps/api/src/routes/stream.rs:61-80` (`market_session()`,
  confirmed differently-membered — `premarket|regular|afterhours|overnight|closed`);
  `apps/api/src/routes/auth.rs:133-166` (settings GET/PUT both session-gated via
  `resolve_session`); `apps/api/src/routes/recommendation.rs:26-64` (POST rec is auth-outermost via
  `require_user`; GET export is anonymous, no session resolution today — consistent with the
  interface contract's forward-looking claim to *add* optional session resolution, citing the
  already-session-resolving `get_status` at the correct lines 84-88, as the mechanism to reuse);
  `apps/api/src/routes/mod.rs:78` (export route registration); `apps/dashboard/.../AiRecPanel.tsx`
  (anonymous export-floor reachability, lines matching the R3-UX citation); `apps/dashboard/.../
  copy.ts:66-73` (the exact live "no account or identity" string AC-90 requires be removed, and
  which the SPEC's new egress copy correctly replaces); `apps/dashboard/.../copy.ts:18,157-159`
  (the existing `Get a fresh recommendation`/stale-strip machinery the spec proposes reusing, not
  inventing); `libs/quant-engine/src/types.rs:58-89` (`Contract`/`Greeks` field list matches
  exactly); `libs/quant-engine/src/signals.rs:169,623` (`generate_signals`/`market_state_from_gex`
  both exist as named, supporting the "fixed positional argument list" scoring-isolation claim).
  Every citation checked matched the tree, including specific line numbers. No item in §8's
  guardrail list, nor any of the ten standing invariants named in the task, is contradicted by the
  design as written.
- **Checklist #4 — interface mismatch.** Walked every field SPEC §4's UI/copy/state tables consume
  against the INTERFACE_CONTRACT wire shape for all five endpoints (candidates, ticker bundle,
  export, settings GET/PUT, rec POST). No FE-consumed field lacks a wire promise, and no wire field
  goes unused. The conformance JSON's required-field list is a deliberate subset of the full field
  tables (e.g. it doesn't assert `contracts[].spread_abs` or several per-tenor fields) — reasonable
  for a smoke-test runner, not a mismatch, and the document says as much ("machine-checkable
  conformance block" vs. "asserted by the build's own tests").
- **Checklist #5 — internal contradiction, remainder.** The 11 inline `**(ship-blocking)**` markers
  in §3's AC table match the "Ship-blocking rows" list at the end of §3 exactly, one-for-one. The
  prompt-block consistency invariant (`tenors(move) ⊆ tenors(candidate)`) is correctly scoped as
  vacuous on the bundle (which carries no candidate block) and is enforced on the in-app prompt via
  the documented pruned-`market_state`-clone mechanism. The two budget tables in §2.2 (64-record
  dedicated/hand-off, 20-record prompt) match the R3-architect binding text and the interface
  contract's `caps.*` fields arithmetically (4×2×8=64, 2×2×5=20).
- **Checklist #2/#3 — unobservable ACs / unspecified states, remainder.** Read all 97 ACs plus the
  §4 component-state tables end to end; besides the Critical and Important items above, every other
  AC is checkable from outside the code (wire tokens, closed literals, counts) and every named
  component in §4 has default/loading/empty/error/offline-stale rows filled in (not left as "TBD"
  or silently omitted).

---

# Pass 2 — verification of the S2-fix pass (loop cap, final skeptic pass)

Re-read `SPEC.md` and `INTERFACE_CONTRACT.md` in full (both now headed
`Status: draft — S2 skeptic pass 1 folded (R4 pass 2)`), verified the fix for every Pass-1 finding
against the actual diffed text, re-checked the folding receipts, and probed the three named changed
surfaces (`not_applicable`, AC-58a, amended AC-29) for anything newly broken.

## Per-finding verdict

### 1. Critical — cap annotation on `no_trade` → **RESOLVED**

The fix is structurally sound, not cosmetic, and directly falsifies the composition I found.

- **New fifth verdict member, evaluated first.** §2.5's cap-verdict table now reads, in fixed
  order, first-match-wins: `1. not_applicable` ("the rec states no entry... nothing to check —
  this is not a failure to check") → `2. no_cap` → `3. not_checkable` → `4. within` → `5. above`.
  Because `not_applicable` is evaluated **before** `not_checkable`, a `no_trade` rec with a cap set
  can no longer reach `not_checkable` — the exact path that produced the false "couldn't check"
  caveat is now closed by construction, not by a documentation promise. Confirmed identically in
  INTERFACE_CONTRACT §5's `cap_check.verdict` table (same five members, same order, same trigger
  text).
- **UI renders nothing on `no_trade`, stated four separate times, consistently.** The §4 "Cap
  annotation" component-states table's `empty` column: "**`no_trade`: nothing renders at all** — no
  comparison, no caveat, no cap readout, no `not set` cap literal." The §4 "no_trade is a result"
  prose section restates it. The Copy list adds "**No cap string exists for `no_trade`,
  deliberately**." The §5 Error-handling table adds a `Verdict is no_trade` row: "**no cap surface
  at all**... `cap_check.verdict = not_applicable` still rides the envelope, so the drawer and any
  later reader can see that no audit was owed rather than that one silently vanished" (a good catch
  — the token isn't discarded, it's just never rendered as a caveat). All four statements agree.
- **AC-56/57/58 correctly scoped, and the new AC-58a is the right shape.** AC-56/57/58 now open
  with "On a verdict that states an entry," closing off the no-carve-out reading that created the
  bug. **AC-58a is ship-blocking and explicitly covers both sub-cases** — "this holds both with a
  cap set and with no cap set" — which is exactly the composition that needed to be proven
  impossible, not just the cap-set half. AC-60/AC-63 were amended to match (AC-63 now names the
  fixed order and `not_applicable`'s priority explicitly).
- **The "not a reopening" argument holds up against the actual R3 record.** §2.5 argues the R3
  ruling "forbade **splitting the two no-cap reasons** into separate verdicts... those still
  collapse into `no_cap`." I checked this against `R3-response-architect.md`'s UX-3 answer, which is
  the actual source of the "never off a fifth verdict member" language: that sentence is attached
  specifically to the `no_cap` trigger ("Both collapse to this one verdict; the reason is read off
  the cap field's own not-derivable state... **not off a fifth verdict member**") — i.e. it forbids
  a member that would split "nothing entered" from "percent-with-no-account-size," not a member on
  an orthogonal axis (whether an entry exists to audit at all). No R1/R2/R3 document I reviewed ever
  discusses or forbids a decision-level member. `not_applicable` is genuinely a different axis, not
  a re-litigation of the settled one — the argument is accurate, not a rules-lawyering dodge.
- **The composition is now guarded against regression, not just fixed once.** §7's testing strategy
  gained a named, three-part test ("A `no_trade` fixture with a cap set must yield `not_applicable`
  and render no cap surface; the same fixture with no cap set must yield the same thing (not
  `no_cap`); an entry-stating fixture with a null risk figure must still yield `not_checkable`")
  explicitly framed as "what stop[s] the Critical from being reintroduced by a later refactor of the
  verdict switch." That is the right test to have named.

No loose end found on this finding. The `no_trade` + cap-set composition that produced the false
caveat is now unreachable by construction (fixed evaluation order) and covered by a named
regression test, and the "not a reopening" argument is accurate against the actual R3 text.

### 2. Important — `missing_input` tie-break → **RESOLVED**

§2.5 now states the dependency order explicitly ("`position_size` | **1.** the risk block ·
**2.** candidate quotes") and the tie-break rule with its rationale: "When both are absent the
token is `risk_block`, because that is the input the owner can fix and the one the `Set your risk
inputs` action clears." New ship-condition-adjacent AC-72a (`test`) pins it: "the named missing
input is the risk block, deterministically, on every run." Mirrored verbatim in INTERFACE_CONTRACT
§5 ("**when both are absent the token is `risk_block`**... The wire carries one token, never two")
and added to §5 Error-handling and §7's Automated test list ("A fixture with no risk block **and**
no candidate quotes must name the risk block, on every run"). Same discipline the doc already uses
for the drop-reason ledger's fixed evaluation order — the fix generalizes the pattern rather than
inventing an ad hoc rule. No gap left.

### 3. Minor 1 — stale `(AC-92)` cross-reference → **RESOLVED, and the fix is broader than my
   Pass-1 characterization**

Spot-checked all four corrections named in the coordinator's message, plus their surrounding
context:

- **§1 AC-92→AC-89** (line 47): now reads "(AC-89)". Correct — AC-89 is the before/after ship
  condition.
- **§1 AC-85→AC-82** (line 97, the "Ledger breakdown" Future bullet): now reads "the capture ships
  now (AC-82)". Correct — AC-82 is "A position entered from a rec records whether a risk block was
  present at entry," which is what "the capture" refers to.
- **§2.1 AC-48→AC-46** (line 160): now reads "the FE is forbidden from inferring one from a null
  (§4, AC-46)". Correct — AC-46 ("no surface picks the literal by inspecting a null") is the one
  actually about null-inference; the old AC-48 reference pointed at an unrelated no-expiration-in-
  window criterion.
- **§2.2 AC-100→AC-97** (line 273): now reads "That fact is what keeps AC-97 (the anonymous
  hand-off export) in scope". Correct — AC-97 is the anonymous-hand-off-export criterion; AC-100
  doesn't exist in this document's numbering.

All four verified correct against the current AC table. **Self-correction from Pass 1:** I
characterized this as "upstream drift in BRIEF.md... not a SPEC.md defect." Re-reading my own
Pass-1 transcript, SPEC.md's own §1 line 46 *at that time* also read "(AC-92)" — the same wrong
number, inside SPEC.md itself, not only in BRIEF.md. The fix pass corrected both the SPEC-internal
instance and left a clean provenance note explaining the BRIEF-side one ("Upstream cross-reference
note (not a SPEC defect)... The BRIEF is an upstream input to this synthesis and is not edited
here"), which correctly respects the coordinator's stated two-file lane. Net: the fix resolved more
than what I precisely named, and did so without touching BRIEF.md.

### 4. Minor 2 — right-absent one-liner → **RESOLVED**

§2.5 now states three distinct closed states in place of the collapsed one-liner: "(i) **Right
absent** while strike and expiration *are* in the set ⇒ `right_undetermined`... It must **never**
fall through to the off-set literal... (ii) **Strike or expiration absent from the set** ⇒
`off_set`... (iii) **Multi-strike structure, or no identity at all** ⇒ `none`." This matches §4's
copy and the interface contract's `cited_contract.state` enum exactly, and the interface contract's
new Match-rule paragraph restates the off-set-literal prohibition in the same terms ("`right_
undetermined` is its own state and **never** renders the `off_set` literal — the strike and
expiration *were* sent, so that literal would assert a falsehood"). Clean, precise fix; no gap left.

### 5. Minor 3 — §2.4(a) uncited ledger claim → **RESOLVED**

§2.4(a) no longer asserts an unverifiable "shipped export sentence" fact. It now states the
exclusion as **a rule this spec sets** ("this spec forbids it from being written into any persisted
rec artifact"), gives the reason ("the ledger is client-local and exportable, so an equity figure
inside it would leave the machine through the ledger's own export rather than through the rec's"),
and cites `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts:66-73`. I re-read that exact
range: it is the `export.egress` string object, lines 66–73 precisely bound the field — citation is
accurate. AC-29 gained the matching clause: "no account size is written into a persisted rec
artifact or the outcome ledger." Evidentiary bar now matches the rest of the document.

## Receipt integrity — confirmed

- **22/22 conflict markers present, all in their originally-cited sections.** Recounted every
  in-body `<!-- spire:council-resolution:v1 ... folded -->` marker in SPEC.md: `5a6006c4` (§1),
  `e053ee0a` (§1), `5e7c21d3` (§2.1), `3f64a61d` (§2.2), `90073ec3` (§2.2), `3458de7f` (§2.4),
  `7ab2bb4f` (§2.4), `0e325aa0` (§2.4), `f1259f15` (§2.4), `7d618628` (§2.5), `b3fb59df` (§2.5),
  `54314ed9` (§2.5), `16511e5b` (§3), `6b77b44f` (§3), `56b47beb` (§4), `e42c4455` (§4), `cb992bd1`
  (§4), `c134ba40` (§4), `ff3e6c92` (§4), `c5fe2f82` (§4), `7f314ca0` (§4), `6232972a` (§4) — 22
  distinct ids, matching `council/conflicts.json`'s 22 entries and the footer JSON receipt's 22
  resolution records one-for-one. Unchanged from Pass 1 — the fix pass did not disturb any existing
  fold.
- **Single folding receipt.** Exactly one `<!-- spire:council-folding:v1 {...} -->` JSON block, at
  the file's footer. No duplicate or partial second block.
- **Bare `## Conformance spec` heading**, unqualified, unchanged.

## New findings from probing the changed surfaces

### New — Important: the outcome-ledger account-size exclusion is prose-only, with no structural
enforcement, no named test, and no listed touched file

Probing the amended AC-29 and its source rule in §2.4(a) turned up a real gap. §2.4(a) states, as a
hard rule: "if the client stores the rec in the outcome ledger it stores the digest, the cap as
entered and the effective cap — **never the account size**." AC-29 (verify-by: `review`) now
carries the matching clause. But:

- **No file that would enforce this is listed as touched.** §2.6's "Where state lives, and what is
  touched" table lists every FE surface this feature modifies (Settings, `ai-rec/`, the ticker
  widget, `TradeEntryDialog.tsx` + `features/trading/model/`) but never mentions
  `features/trading/outcomes/` or `captureDigest.ts` — the actual mechanism (from the prior,
  separately-shipped `outcome-ledger` feature) that builds `DecisionRecord.entry_context`. If this
  feature's build never touches that file, the "never the account size" rule has no code path to
  bind to within this feature's own scope, and it is unclear whether it is a live constraint on
  work this feature performs or forward-only guidance for a future editor of that mechanism.
- **No automated test backs the claim, and the doc's own methodology says one should exist.** §7's
  Automated (`test`) list is thorough about analogous privacy/egress claims — the egress-note claim
  (AC-90) is `test` and ship-blocking, with an explicit "copy parity" test named. The account-size
  exclusion is verify-by `review` only, and no entry in §7's Automated list (I re-read all of it)
  or its "Invariants that must never silently regress" summary mentions the outcome ledger or
  account size. By the document's own stated rule for choosing `test` over `review` — "`test` where
  a silent regression under an unrelated change is plausible" — a future refactor of
  `captureDigest.ts` that enriches the digest (e.g. to add the cap-as-entered/effective-cap fields
  §2.4(a) itself anticipates) silently pulling in `account_size` alongside them is exactly this
  class of risk, and is not something "a human notices on a normal pass."
- This is not a functional break today (nothing in the current build path writes account size into
  the ledger), and it doesn't reopen the Critical or Important findings above — it's a rigor gap
  specific to a clause the fix pass itself just added. Given the document elsewhere prefers
  structural enforcement over prose (`[structural-over-prose-enforcement]`) and treats the sibling
  egress claim as ship-blocking `test`, this asymmetry is worth closing: either name
  `captureDigest.ts` (or wherever the enforcement actually lives) in §2.6 with a concrete test, or
  state plainly that the rule is forward-only guidance not backed by any test in this feature's own
  build.

No new Critical was introduced. `not_applicable` and AC-58a hold up under adversarial re-reading
(including cross-checking that the export drawer's separate, always-shown "Your risk inputs"
section — governed by AC-65/AC-91, a different named component from the "Cap annotation" AC-58a
scopes — is not accidentally forced to omit the as-sent cap figure by AC-58a's "no cap surface at
all" language; it isn't, because AC-58a's language is scoped to the rec-panel's Cap annotation
component specifically, and the drawer's risk-inputs readout was never framed as an audit verdict).

---

# Final verdict: PASS, with one new Important finding

All five Pass-1 findings (1 Critical, 1 Important, 3 Minor) are **RESOLVED** — the fixes are
structural (fixed evaluation order, a ship-blocking AC covering both sub-cases, a named regression
test), not cosmetic, and the "not a reopening" argument for the new `not_applicable` verdict member
holds up against the actual R3 record. Receipts hold: 22/22 conflict markers, single folding
receipt, bare `## Conformance spec` heading.

One **new Important** finding surfaced while probing the changed surfaces: the outcome-ledger
account-size exclusion (§2.4(a), AC-29) is prose-only — no touched-file listing, no automated test,
`review`-only verify-by — despite the document's own risk-based testing rule and its own
`[structural-over-prose-enforcement]` preference elsewhere. This does not block ship on functional
grounds (nothing currently writes account size to the ledger) but should be closed before the gate
gets called clean, either by naming the enforcement point or by stating explicitly that the rule is
forward-only guidance.

**Unresolved items:** none from Pass 1. One new Important item (outcome-ledger exclusion rigor) not
yet addressed by any fix pass.
