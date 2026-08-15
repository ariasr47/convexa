# S2 — skeptic findings: rec-absence-literals-hole

## Critical  (blocks — must loop back to R4)

- **The Layer-2 em-dash source scan (§7) is internally inconsistent about scope, and if built as
  described ("modeled byte-for-byte" on the folder-wide `bannedWords.scan.spec.ts`) it reds on day one
  against ~40 pre-existing, legitimate punctuation em-dashes already shipped in `copy.ts` — none of
  which are in the enumerated exempt set.**
  Evidence: §7 Layer 2 states the rule as *"U+2014 may not appear in `AiRecPanel.tsx` at all; its only
  permitted home is the named constant in `copy.ts`, listed in an EXEMPT set with an
  every-EXEMPT-path-still-exists assertion"* and separately claims it is *"Modeled byte-for-byte on the
  scan already shipped in this folder (`bannedWords.scan.spec.ts`: same
  `import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', eager: true })`...)."* I read the shipped
  `bannedWords.scan.spec.ts` directly: it globs and scans **every** `.ts`/`.tsx` file in the folder
  (including `copy.ts`) for banned literal content, not one file. I then read `copy.ts` directly and
  found the em-dash used as plain prose punctuation at roughly 40 sites — lines 11, 29, 30, 45, 57, 75,
  82, 88, 100, 107, 114, 126, 131, 134, 137, 148–149, 156, 160, 194, 200, 206, 213–214, 216, 222, 228,
  247, **252** (`GROUNDING_CARD.local_rules: "No AI read here — these figures come from Convexa's own
  rules."`, the exact site the task brief flagged), 255, 257, 259, 263, 272, 282, 284, 289–291, 297,
  311, 319, 322, 329, 338, 342, 347 — none of which is "the named constant" (singular) the rule names as
  the sole permitted home, and none of which is one of AC-16's two enumerated `quoteTextFor` exemptions.
  If the new guard genuinely reuses the folder-wide glob the way the shipped scan does, it breaks the
  build against code this feature does not and must not touch (out of the §2.6 allow-list's intent — a
  banner line, a cap message, a drop-liquidity string). If instead the guard is meant to be scoped to
  `AiRecPanel.tsx`'s own source text only, then the "modeled byte-for-byte on the same glob" claim is
  false, and AC-16's own "explicitly out of this sweep" punctuation carve-out (a DOM-level distinction)
  has no counterpart at the Layer-2 source-text level, which the spec text does not state. Either way,
  the "enumerated, not hand-waved" bar this exact check was invoked to verify is not met: the actual
  exempt set needed is roughly 40 sites, the spec names essentially one plus two, and the spec's own
  wording doesn't tell a build lane which reading is correct.

- **The load-bearing AC-12/AC-13 distinction ("`prefill === undefined` keeps defaults;
  `prefill.strike === null` must not fall back") is asserted as an outcome but the mechanism to make it
  true is never specified, and the ONE code line the spec itself cites as ground truth would not produce
  it.**
  Evidence: §2.5 states as settled fact, *"the submit predicate tests `d.strike !== ''`
  (`TradeEntryDialogView.tsx:363`), which `0` passes — so the form is submittable."* Nothing in the
  spec instructs this predicate to also reject `null` once `strike` is widened to nullable. Worse, the
  *seed* fallback the spec discusses, `prefill?.strike ?? nearest` (`:214`), cannot express the required
  distinction either: `??` fires on both `null` and `undefined` identically, so once `AiPrefill.strike`
  is widened to nullable, a field the producer never named (`prefill.strike === null`) and a dialog
  opened with **no prefill at all** (`prefill === undefined`) would *both* fall through to `nearest`
  under that unchanged line — exactly the collision AC-12a forbids and AC-13 requires stay open. The
  spec's own §2.5 sentence, *"`prefill === undefined` keeps today's behaviour; `prefill.strike === null`
  must not fall back,"* is therefore a requirement with no cited or described implementation path, in a
  spec that is otherwise scrupulous about naming exact lines and exact mechanisms (the confidence
  evaluation order, `PlanInputPresence`, the `candidate_set` predicate). No AC and no line in §7 targets
  the predicate update itself — §7's coverage is generic ("component ... the entry dialog's
  seeded/unseeded states"). This is precisely the failure class CLAUDE.md's trap list warns about — "a
  guard with no in-process test that could fail, found only by attempting the poison" — applied to the
  one safety property the owner's ruling `A` exists to buy (E.1 §2/§3). A build lane that widens the
  type, sees the dialog visually render "unseeded," and never re-derives the submit predicate would ship
  a `strike: null` that is still one click from `strike: 0`'s old behaviour but now silently
  submittable, and both AC-12a and AC-13 as worded could still be checked off by a superficial
  implementation.

## Important  (should fix)

- **AC-4's rewrite to pairwise-distinctness is not proven non-vacuous, unlike its sibling AC-17.** The
  three strings it must keep apart — `not given`, `unavailable`, `—` — are fixed literal constants from
  the closed vocabulary (`literals.ts:41-46`, `copy.ts:182/192-195`). As worded, *"the rendered strings
  ... are pairwise distinct"* can be satisfied by comparing three string constants without ever
  rendering a card or exercising the selector that assigns which literal applies to which condition —
  which is the actual thing worth protecting (a build could satisfy AC-4 while shipping a selector that
  renders the wrong literal for the wrong condition, so long as the three constants themselves stay
  distinct). AC-17, addressing a structurally similar risk, explicitly requires the poison test be
  "demonstrated **non-vacuous**"; AC-4 (also SB) carries no such requirement. §7's method notes group
  AC-4 with the DOM-level Layer-3 fixtures, so a careful implementer likely gets this right in practice
  — but the AC's own text doesn't require it, and the synthesizer flagged this exact rewrite as a place
  worth a skeptic's attention.
- **§6's single-source-of-truth claim is violated by SPEC.md's own §2.2, which restates
  INTERFACE_CONTRACT.md content near-verbatim.** §6 states: *"Every token spelling, nullability and
  evaluation order is authoritative in that file and is not restated here ... because two copies of a
  closed lookup table is exactly how the two drift apart."* Yet SPEC.md §2.2 reproduces the `confidence`
  fixed-evaluation-order rule ("DO NOT REORDER: (1) null or trimmed-empty ⇒ `not_given`; (2) a member of
  `{low, medium, high}` ⇒ no token (`None`); (3) otherwise ⇒ `unrecognized_value`") and the full
  per-field `value_present` table, both of which also appear, word-for-word in substance, in
  INTERFACE_CONTRACT.md. The two copies do not currently disagree, but the spec's own stated mechanism
  for preventing drift (a single owning file) is not what was actually built here — this is the exact
  failure mode §6 warns against, just not yet triggered.
- **`time_horizon`'s no-other-consumer precondition is asymmetric with `confidence`'s, and is
  prose-enforced only.** §2.4 explicitly notes architect confirmed no other backend consumer reads
  `strategy.confidence` before ruling its default out of scope, but *"the same confirmation was never
  obtained for `strategy.time_horizon`"* — booked as open question §9.5 rather than closed before R4.
  I ran the check myself: `grep -r time_horizon apps/api` returns matches in exactly two files,
  `recommendation.rs` (the assembler being edited) and `llm.rs` (the prompt schema + the LLM
  pass-through, an unrelated, untouched path). No `ai_eval`, outcome-ledger, export or stored-evaluation
  code reads it. FE-side hits are the shared type definition (`convexa.ts:1446`), the display site
  (`AiRecPanel.tsx`), and test fixtures (`testBackend.ts`, `orders.risk.spec.tsx`,
  `stage3-headings.spec.tsx`) that hardcode arbitrary values unrelated to the deleted constant.
  `features/personas/template.ts`'s `"time_horizon": "expected holding period"` is a static prompt-schema
  string mirroring the backend prompt, not a value consumer. **My own search found nothing that would
  break — but the spec ships this as an unresolved open question with no AC or test gating it**, an
  inconsistent standard against the sibling field the spec itself treats as requiring proof before
  deletion, in a spec that otherwise holds `[structural-over-prose-enforcement]` as HARD.

## Minor / advisory

- `PlanFieldLiteral = FieldLiteral | { kind: 'unrecognized' }` is described as a "disjoint sibling"
  union, but it is not disjoint from `FieldLiteral` — it is a proper superset (every `FieldLiteral` value
  is also a `PlanFieldLiteral` value). The mechanism is still sound (TS structural typing rejects passing
  a `PlanFieldLiteral`-typed value into a function parameter typed `FieldLiteral`, so the six cannot leak
  into a shipped consumer without an explicit unsafe cast), but the "disjoint" terminology misdescribes
  the actual relationship and is worth correcting for a future reader who takes "disjoint" as "the two
  unions share no members," which is false here.
- The reworded DTE caption (`· your DTE window: {min}–{max}`) uses U+2013 (en dash), matching the
  existing shipped caption's character (`AiRecPanel.tsx:1094`, also U+2013) — confirmed by direct read.
  Not a defect; noted only because the Layer-2 guard's poison is specifically U+2014 and the two glyphs
  are easy to conflate when hand-writing the new copy.

## Checked and clean

- **Dropped conflicts (checklist #1).** Cross-referenced all 28 `conflict_id`s in `council/conflicts.json`
  against both the per-section `<!-- spire:council-resolution:v1 ... folded -->` markers scattered
  through SPEC.md and the master `<!-- spire:council-folding:v1 -->` JSON block at end of §3/§9. All 28
  are accounted for with `"disposition":"folded"` and a target section. Spot-checked direction, not just
  presence, on the two highest-risk items: (a) D.2's reversal of "Accept is display-only" (conflict
  `c7c2002e...`) — verified in decisions.md that architect's own R1 sentence was contradicted by its own
  R2 code citation, and the SPEC correctly reinstates B3/B4 and promotes AC-13 to ship-blocking, matching
  the record; (b) conflicts `78a4e7b9...` (pm) and `fb9acbb0...` (ux), both proposing deletion of the
  confidence default as a fabrication fix — the SPEC's Out-of-scope section explicitly declines this,
  citing controller-verified decisions.md §D.1 (conviction is rule-authored via a non-optional `Setup`
  field, not a fallback that ever fires), a legitimate supersession of both voices' rulings by a later,
  code-checked finding, not a silent drop. Also verified the self-revision count: conflicts.json marks
  exactly 9 `self_revision:true` entries, matching decisions.md §A's "Nine were filed... Eight fold in as
  written" (8 rows) plus the one A.9 controller catch (`c7c2002e...`) — consistent.
- **Interface mismatch (checklist #4).** Every field the UI in §4 consumes (`field_reasons.*`,
  `strategy.time_horizon`) is present in INTERFACE_CONTRACT.md's response-additions table and required
  paths; nothing in §4 assumes a field the interface doesn't promise.
- **Conformance block.** The `## Conformance spec` JSON in INTERFACE_CONTRACT.md is present and valid
  JSON (two GET endpoints, well-formed `required` maps). `POST /api/recommendation/{ticker}` is
  correctly excluded from that block, and §1a explicitly states the named gap — *"The receipt records
  the check as not-run with that reason; it is never recorded as a pass"* — never framed as a pass.
- **Score identity (`[additive-keeps-score-byte-identical]`).** AC-20/AC-36 and INTERFACE_CONTRACT rule 8
  correctly rely on a structural guarantee (empty diff under `libs/quant-engine/` and every
  signals/scoring/SSE module, verified by AC-36) rather than claiming the generic conformance runner
  itself proves byte-identity — the runner's JSON schema only supports presence/type checks, and the spec
  doesn't overclaim that it does more.
- **Guardrail breach (checklist #6).** Scanned §8 against §2/§4: no new hex/sx colour, no warning chrome
  on the six or the standing line, `[single-shared-sim-entry-dialog]` and `[no-real-order-path]` both
  honored (AC-37), `[best-effort-isolated-or-null]` consistent with the cited `unwrap_or(Value::Null)`
  degradation path. Verified the guard citation `ai-rec.grounding.spec.tsx:516` directly — it does pin
  `TradeEntryDialogView.tsx` by exact path as claimed.
- **Owner ruling `A` and its six consequences (decisions.md §E.1).** All six are present and correctly
  carried in SPEC.md: superseded Effort (§1), the enlarged §2.6 allow-list including the tradeEntry tree
  and the pinned guard (updated deliberately, pin re-proved — §1 and §2.6), B3-as-change/B4-outcome
  (§2.5), AC-12's five criteria including 12c/12e (§3), the three named defaults with individual
  mechanisms (§2.5 table), and `[single-shared-sim-entry-dialog]`/`[no-real-order-path]` untouched (§1,
  §8, AC-37).
- **Unspecified component states (checklist #3).** §4's state table covers default/loading/empty/
  error/offline-stale for every named component including the two new entry-dialog states; no gap found
  against the states actually named in §1/§4.

---

# Pass 2

**Verdict up front: neither pass-1 Critical is actually closed. Both revisions satisfy their NAME —
"re-homed the em-dash guard," "stated the prefill mechanism line by line" — while missing their
BEHAVIOUR, and I can point at the exact line each one breaks on.** Two new, source-verified Criticals
below replace the old ones (same underlying risk, moved one layer deeper by the revision). All three
pass-1 Importants are genuinely closed. The `biasToRight` fold is sound. The 28-conflict receipt
survived intact.

## Critical (new this pass — replace pass-1 Criticals, do not add to them)

- **Pass-1 Critical 1 did not close — it moved. Layer 2's foundational claim, "queried ... by the test
  ids the shipped card specs already use," is false: no such test ids exist anywhere in this codebase
  today.** I read the actual rendering primitive every risk/plan field value passes through,
  `Field` (`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/reasoning.tsx:22-53`) — its props are
  `label`, `value`, `tip`, `valueSx`. **No `data-testid` prop exists on it at all.** I then read how the
  shipped specs actually locate a field's value today: `ai-rec.risk.spec.tsx:1139` —
  `within(panel()).getByText(COPY.risk.maxRisk)` (the LABEL text), then
  `maxRiskLabel.parentElement?.querySelector('svg')` for the tooltip icon — never a per-field test id. I
  grepped every `data-testid` in `AiRecPanel.tsx` and every `getByTestId` in both `ai-rec.risk.spec.tsx`
  and `ai-rec.grounding.spec.tsx`: the only ones that exist are widget/line-level (`ai-rec-panel`,
  `grounding-card-line`, `cited-contract-line`, `no-trade-four-field-row`, `clause-stop` /
  `clause-target` — the last two tag the grounding *clause* text beside a value, not the value slot
  itself) and gated-state boxes (`data-testid={cfg.testid}`). **There is no existing per-field
  value-slot id for any of the five shipped risk fields, let alone the six new ones.** Layer 2's "already
  use" framing therefore describes a mechanism that must be invented from scratch by this feature — a new
  `data-testid` prop added to the shared `Field` component (itself a real, uncited code change, since
  `reasoning.tsx` is not named anywhere in §2.6, though it is covered by the `ai-rec/**` glob so at least
  it wouldn't violate the allow-list) plus new per-field id strings threaded through both `RiskField` and
  the new plan/chip renderers. That is buildable, but it is not the low-risk reuse of "the test ids the
  shipped card specs already use" the spec claims, and the claim is exactly the thing that made pass 1's
  Critical 1 finding go away on paper. The anti-vacuity arm (§7: "the query matched a non-empty set of
  slots with non-empty text") is real protection against the ids going *stale*, but it cannot protect
  against the ids being *wrong from day one* — the same PR that invents the ids also writes the guard
  that queries them, so a systematic mislabeling (e.g. tagging five of six fields correctly and silently
  missing one) still satisfies "non-empty" and would ship undetected. This is the CRLF-episode failure
  shape named in this very spec's own precedent, one layer removed: a guard whose justification for
  being trustworthy does not hold up against the source it claims to describe.

- **Pass-1 Critical 2 did not close either — the corrected mechanism for `strike`/`expiration` is sound
  and I verified it against source, but the parallel fix for `right` does not type-check as described,
  because it requires an edit to a file outside the stated mechanism and outside the §2.6 allow-list.**
  I read `TradeEntryDialogView.tsx:190-430` directly and confirm the spec's new mechanism claims are
  accurate as far as they go: `nearest` is genuinely `number | ''` (`:204-206`), the shipped submit
  predicate is genuinely `(d) => d.qty >= 1 && (d.kind === 'equity' || (d.strike !== '' && !!d.expiration))`
  (`:363`, byte-for-byte as cited), `d.right` is genuinely absent from it, and `:316`/`:420` genuinely do
  `d.strike === '' ? null : Number(d.strike)`. Mapping `prefill.strike === null` into the draft's existing
  `''` sentinel via `strike: prefill ? (prefill.strike ?? '') : nearest` is a real fix — I traced all
  three cases (`prefill` undefined, `prefill.strike` a real number, `prefill.strike === null`) against
  the unchanged `:363` predicate and it correctly discriminates all three. **But `right` cannot go through
  the same trick**, because there is no pre-existing "unstated" sentinel for `right` the way `''` already
  serves for `strike`/`expiration` — the fix instead makes the DRAFT itself carry `null`
  (`right: prefill ? prefill.right : 'call'`) and adds a new `!!d.right` conjunct to the predicate. That
  requires `LegDraft.right`'s TYPE to widen from `OptionRight` to `OptionRight | null`. I read the type
  declaration directly: `apps/dashboard/src/app/features/trading/tradeEntry/types.ts:152` —
  `right: OptionRight;`, non-nullable, in the same `LegDraft` interface as `strike: number | ''`
  (`:151`) and the `newDraft()` factory (`:158-166`) that defaults `right: 'call'` (`:166`). **This file
  is a sibling of `TradeEntryDialogView.tsx`, not the same file, and §2.6's allow-list names only
  `apps/dashboard/src/app/features/trading/tradeEntry/TradeEntryDialogView.tsx` — no `**` glob for that
  tree the way the ai-rec entry gets one.** Assigning `prefill ? prefill.right : 'call'` (type
  `OptionRight | null`) into a field declared `right: OptionRight` is a TypeScript compile error as the
  mechanism is written; the fix cannot ship without also editing `types.ts`, and the spec's own "THE
  MECHANISM ... all verified this pass" claim — which enumerates exactly `:214`, `:207`, `:215`, `:363` —
  never traces to the type declaration those edits depend on. This will very likely be *caught* by
  `nx typecheck` (Layer 1's own strength working against the spec here), which is the mitigating factor —
  it is not a silent-ship risk the way pass 1's gap was. But it means the "mechanism, stated line by
  line" section is incomplete on its own terms, in exactly the place the coordinator asked me to look
  hardest, and a build lane hitting the compile error with no spec guidance for `types.ts` is exactly the
  kind of surprise this spec otherwise prides itself on eliminating ("confirm its folder before editing;
  do not guess a path").

## Important (new this pass)

- **The `biasToRight` fold (§2.5: "`:44` stands when structure is present but names neither word") is
  directionally sound but under-mechanized in the same way.** I read `prefill.ts:38-46` directly. The
  fold's judgment call is correct and not scope creep: decisions.md §E.1 names only `prefill.ts:45` (the
  `'call'` default) as a fix site, but line 44 — `if (strategy.bias === 'short') return 'put';` — fires
  unconditionally whenever `bias === 'short'`, regardless of whether `structure` was named. A rec with
  `structure: null, bias: 'short'` would still get a submittable `'put'` out of `biasToRight` even with
  line 45 fixed, directly violating AC-12c ("no option direction a single confirm can submit" for an
  unnamed structure) — the owner's ENUMERATED mechanism (E.1 §4) is incomplete relative to the owner's
  RULED OUTCOME (AC-12c, named ship-blocking in E.1 §3), and closing that gap is following the ruling, not
  widening it. But the fold's own text — "`biasToRight` returns `null` when structure is **absent**" —
  doesn't explain how, and the current function conflates "absent" and "present but unparseable" through
  the exact `(strategy.structure ?? '').toLowerCase()` pattern (`:41`) this whole feature exists to stop
  doing server-side (§2.2's own hazard, applied here client-side): both `structure: null` and
  `structure: "iron condor"` currently produce `s = ''`-or-non-matching and fall through to the SAME line
  44/45 path. Making the fold's stated distinction real requires an explicit presence check *before* the
  `?? ''` collapse (e.g. `if (structure == null || structure.trim() === '') return null;` ahead of the
  lowercasing), which is a real code shape the spec doesn't show — a smaller version of the same
  "asserted the outcome, didn't show the line" gap as the two Criticals above, in a function this pass's
  own remediation newly depends on.

## Confirmed closed (verified against source, not against the spec's description of it)

- **AC-4's non-vacuity gap — CLOSED.** New text: *"Proven non-vacuous: collapsing any two conditions onto
  one literal ... makes this check go red. Comparing three string constants without exercising the
  selector does not satisfy this row."* This directly forecloses the pass-1 vacuous-implementation path.
- **§2.2 no longer restates the interface — CLOSED.** Read in full: §2.2 now reads *"The token vocabulary,
  the per-field `value_present` predicates, the `confidence` evaluation order and the `candidate_set`
  truth condition are owned by ... INTERFACE_CONTRACT.md §1 and are NOT restated here,"* and the
  evaluation-order table and `value_present` table that were duplicated in pass 1 are in fact gone from
  this revision — confirmed by reading the full 667-line file, not by trusting the claim.
- **`time_horizon` precondition — CLOSED, and independently correct.** §2.4 now states the same evidence
  I produced in my pass-1 Important finding (the same two `apps/api` files, the same FE hits), and §9
  carries an explicit renumbering note: *"Pass-1 open question 5 ... is CLOSED with evidence at §2.4 and
  no longer appears here."* I did not re-derive the grep this pass since pass 1's result is what the spec
  now cites verbatim; the file set matches.
- **Rejected approach recorded — CLOSED.** §2.6's rejected-approaches list now ends with *"a
  character-level em-dash source scan (§7 — it would red against 50 legitimate punctuation em-dashes in
  `copy.ts` and 57 in `AiRecPanel.tsx`)"* — present, so it cannot be silently re-proposed at a later gate.
- **The 28 `conflict_id` markers and the folding receipt — CLOSED, byte-identical to pass 1.** Recounted
  all markers this pass: 3 in §1 (`2ef39a6`, `532e125`, `cbc170b`), 16 in §2 (`1d732b0` through
  `f710490`), 5 in §3 (`8552f71` through `e762857`), 4 in §4 (`62abd54` through `0c69d93`) — 28 total,
  same conflict_ids, same section assignments, same `<!-- spire:council-folding:v1 -->` JSON block at
  end of file. No compression-pass silent drop found.
- **Layer 3's narrow-pattern scan is honestly bounded, not overclaiming, even though it is evadable.**
  The coordinator's brief asked whether `?? '—'` / `?? "—"` is "trivially evadable by the obvious
  rewrites" — yes (a ternary, `String.fromCharCode(8212)`, or reaching for a shared constant outside its
  sanctioned path would all miss a plain pattern match). But I checked what AC-17 actually cites as its
  two enforcement layers: *"`nx typecheck` (the typed literal) **and** `nx test` (the slot-scoped render
  guard)"* — Layer 2, not Layer 3. Layer 2 is a DOM-output assertion (queries rendered text), which is not
  pattern-evadable the way a source-text regex is — any mechanism that gets a literal em-dash into a
  queried slot is caught regardless of the source-code shape that produced it. Layer 3 is explicitly
  self-bounded in the spec text ("catches the one spelling of the defect it names") and isn't the layer
  AC-17 relies on for its ship-blocking guarantee. Not a finding — the design doesn't lean on the weak
  layer for its strong claim. (Layer 2's own foundational defect is the Critical above; that defect
  doesn't come from this narrower question.)
