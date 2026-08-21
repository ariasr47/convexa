# R1 — ux position: rec-plan-scope-caption

## Position

### Intended user, job, information structure

**User.** The Curvature Terminal operator / swing trader — distrusts UIs that overclaim; treats degraded and scope-limited states as styled truth, not footnotes.

**Primary job at this moment.** Decide whether a *stated* plan field (structure, strike, expiration, trigger, horizon, confidence) is **vouched by Convexa** before sizing or entering off a produced trade rec. Today a reader who sees grounding clauses on stop / target / invalidation can infer *"no clause means checked"* onto bare plan fields — a wrong-trade class of error.

**Information structure (verified on current surfaces).** `DecisionCard.tsx` mounts, in order: provenance → degraded strips → verdict → **plan row (`DecisionMetadata` / `data-testid="decision-metadata"`)** → thesis lead → conditional not-actionable line → **risk grid** (Max risk / Invalidation / Entry / Target, with figure clauses on invalidation + target) → `GroundingNote` + cap → actions. Long-form reasoning, `REASONING_PROSE_NOT_CHECKED`, cited-contract line, and full stop/target/invalidation detail live in `AnalysisSurface.tsx` (drawer), opened only from the card.

**User vocabulary already shipped.** Plan labels via `PLAN_FIELD_LABEL` (`Structure`, `Strike(s)`, `Expiration`, `Entry trigger`, `Time horizon`, `Confidence`). Absence literals (`not given` / `unavailable` / `unrecognized` / `—`). Grounding card line members. Prose-scope caption `REASONING_PROSE_NOT_CHECKED`. This feature adds **one** new closed string in the same idiom — not a new absence word, not a per-field marker, not a second design system.

### What ships (one caption, one placement)

**Exactly one section-level caption** under the pinned plan row on `DecisionCard`, patterned on the shipped `REASONING_PROSE_NOT_CHECKED` block in `reasoning.tsx` (caption typography, `text.secondary`, block display, `data-testid`, no icon, no tint, no animation).

**Placement (GATE-V proposal):** immediately **under** `DecisionMetadata` (after the six plan fields), **before** the thesis lead. Not inside any `RiskField`. Not merged into `GroundingNote`. Not only in the analysis drawer.

**Why the card, not the drawer.** Act affordances (`Review simulated trade` / `Create sim order`) sit on the card. A trader can enter without opening `AnalysisSurface`. Drawer-only placement leaves the primary act path unprotected and fails the BRIEF's observed-by (wrong trade on a stated unchecked plan field). `REASONING_PROSE_NOT_CHECKED` lives with long-form reasoning, which is drawer-only after `ai-rec-decision-card`; plan fields live primarily on the card — the caption co-locates with the fields it scopes.

**Why not also in the drawer.** BRIEF requires **one** section-level caption. Duplicating into `AnalysisSurface` spends a second "aren't checked" line beside the already-shipped prose caption and re-opens the line-budget failure that cut this work. Analysis opens from a card that already carried the plan caption.

**Why section-level, not card-level.** Prior council ruling (rec-absence-literals-hole decisions.md §C #17/#23): at most **two card-level** statements (grounding line + conditional not-actionable line), never merged. This caption binds under the plan row it scopes — same structural claim as `REASONING_PROSE_NOT_CHECKED` under reasoning — and does **not** spend that card-level budget.

### Copy (verbatim proposal)

New constant in `copy.ts`, sibling to `REASONING_PROSE_NOT_CHECKED`:

```text
PLAN_FIELDS_NOT_CHECKED =
  "Structure, Strike(s), Expiration, Entry trigger, Time horizon and Confidence aren't checked — only the stop, target and invalidation level are."
```

**Integrity checks (every clause traces):**

| Clause | Vouched by |
| --- | --- |
| Names the six plan labels | `PLAN_FIELD_LABEL` in `copy.ts` (closed, already rendered) |
| "aren't checked" | Permanent scope: none of the six enters figure-grounding clauses / `counts.checked` (BRIEF + `ai-asserted-numbers-are-traceable` omission half; `digested-labels-not-raw-dump` forbids inventing per-field markers) |
| "only the stop, target and invalidation level are" | Shipped `groundingDefinitionTip` allowlist + per-figure clauses on those three only (`FigureClause` on DecisionCard risk grid + AnalysisSurface `GroundingDetail`) |
| No spatial "above/below" | DecisionCard order is plan row **then** risk grid; AnalysisSurface order differs. Spatial claims drift (the shipped prose caption's "above" already sits awkwardly relative to drawer layout). Name the allowlist, not the y-axis. |
| No banned halo words | Avoids verified / confirmed / validated / approved / safe / trusted / grounding / hallucinated / suspect / invalid (same scan family as AC-33 for `REASONING_PROSE_NOT_CHECKED`) |
| Scope boundary, not diagnosis | Does **not** say why a field is bare; does **not** name a producer; does **not** claim this rec omitted something |

**Withdrawn prior wording** from rec-absence-literals-hole R1-ux §3 ("…only the contract named, on the line below"): **withdrawn**. On current `DecisionCard.tsx` there is no cited-contract line under the plan row — `CitedContractLine` lives only in `AnalysisSurface.tsx`. Reusing that sentence would assert a layout that does not exist (defining failure mode: copy inventing meaning the surface does not support).

**Not a tooltip.** Scope must be visible caption text (touch + screenshot), matching how AC-33 fixed prose halo after a tooltip-only proposal failed.

**Chrome.** `Typography variant="caption"`, `sx={{ color: 'text.secondary', display: 'block' }}`, `data-testid="plan-fields-not-checked"`. No `WarningAmberIcon`, no `warning.*` (this is permanent quiet scope, not an unhappy grounding member). No new keyframes (`single-motion-moment`). Tokens only via MUI palette / `extrasFor` if any mode-aware value is needed (`theme-token-discipline`). Chip/label floor ≥11px — caption inherits shipped type scale; no new type token.

### When the caption shows / hides

Gate is structural and closed — not a per-rec content heuristic:

| Condition | Caption |
| --- | --- |
| `status === 'produced'` ∧ `strategy.decision === 'trade'` ∧ plan row mounted ∧ **not** local-rules path | **Show exactly once** under `DecisionMetadata` |
| Local-rules path (`rec.grounding?.card === 'local_rules'`) | **Absent** — must not become standing chrome (BRIEF; base-rate 1.0 whenever a setup exists) |
| `decision === 'no_trade'` | **Absent** — plan row does not mount |
| Loading / empty / error / gated / signed-out / BYO CTA | **Absent** — `DecisionCard` not mounted |
| Stale / stale-born / superseded | **Still show** if model-path trade — scope is permanent; existing strips own freshness |
| Incomplete trade (not-actionable line present) | **Still show** — different fact (conditional missing names vs permanent scope); never merge the two strings |
| Grounding block absent | **Still show** — exemption requires an **affirmative** local-rules declaration (`card === 'local_rules'`); missing information is never an exemption (same spirit as shipped AC-10c) |
| SSE drop (offline) | **Unchanged** — rec is a static pinned read under `[live-vs-static-isolation]`; no dim / `⏸` / blank on this caption |

**Field the UI consumes for exclusion:** `rec.grounding.card` (closed token already rendered by `GroundingNote` / `cardGroundingLine`). BRIEF also names `key_source`; that field is key-resolution provenance (`own_key` \| `shared_admin` \| `none`), not the local-rules producer path. I do **not** gate on `key_source` alone — that would either over-hide model recs or under-hide local-rules. No new wire field; `NO_BACKEND_CHANGE`.

### What I deliberately do not do

- **No per-field marker, tint, type-register change, or clause on the six** — BRIEF + `digested-labels-not-raw-dump` + carry-forward of ai-rec-grounding "stated values stay bare of grounding chrome."
- **No merge** with `incompleteAction` / `notActionableLine`, `GROUNDING_CARD.*`, `REASONING_PROSE_NOT_CHECKED`, or `GROUNDING_BLOCK_ABSENT` — each owns a different fact; merging invents a causal link none of them holds.
- **No second system in SPEC §4** — DESIGN_SYSTEM Status SET; no new tokens, no new motion, no new warning pattern. Caption reuses the shipped quiet-caption pattern.
- **No server internals, math, or payload design** beyond naming consumed fields: `strategy.decision`, `grounding.card`, existing plan field values (unchanged render).
- **No re-open of DTE `?` / containment caption** — already closed in `dteWindowCaption` (BRIEF).
- **No change to `—` reservation** on the no-entry risk path (BRIEF observed-by).

### Component state matrix

| State | What the user sees for this caption | What must not happen |
| --- | --- | --- |
| **default** (model-path produced trade) | One quiet caption under the six plan fields | Zero or many instances; placement inside a risk field or grounding note |
| **local_rules trade** | No caption | Permanent banner under plan row |
| **no_trade** | No caption (no plan row) | Caption or plan-row ghost |
| **loading** | No caption | Skeleton / placeholder caption |
| **empty** (no rec yet) | No caption | Premature scope claim |
| **error / unavailable / gated / no-key / BYO** | No caption | Caption outside DecisionCard body |
| **stale / stale-born / superseded** | Caption still present on model-path trade; existing Alert strips unchanged | Caption rewriting freshness; strips absorbing scope copy |
| **incomplete_trade** | Caption + conditional not-actionable line (two distinct strings) | Merged single line that blames missing fields for the scope boundary |
| **offline (SSE drop)** | Caption byte-identical | Dim / offline chrome on static plan scope |
| **success / act** | Caption remains on card while dialogs open; does not follow into TradeEntryDialog | New dialog chrome restating plan scope |

### Acceptance criteria → state(s) → Verify by

`test` = invariant / negative space / silently-regressing. `review` = visible intentional copy, presence, ordering. Marks land in SPEC §3 `Verify by` — no separate test matrix.

| ID | Acceptance criterion | Component state(s) | Verify by |
| --- | --- | --- | --- |
| UX-1 **(SB)** | On a produced **model-path** trade rec (`decision: trade`, `grounding.card` not `local_rules`), exactly one element with `data-testid="plan-fields-not-checked"` renders, and its text is exactly `PLAN_FIELDS_NOT_CHECKED`. | default | test |
| UX-2 **(SB)** | On a produced **local_rules** trade rec (`grounding.card === 'local_rules'`), `plan-fields-not-checked` is **absent** — no permanent banner — while `GROUNDING_CARD.local_rules` still renders when applicable. | local_rules | test |
| UX-3 **(SB)** | On `no_trade`, loading, empty, error, gated, signed-out, and BYO CTA states, `plan-fields-not-checked` is absent (negative space — no skeleton, ghost, or deferred mount). | no_trade / loading / empty / error / gated | test |
| UX-4 | Caption sits under `decision-metadata` (plan row) and is **not** inside a `clause-*` node, not inside `grounding-card-line`, not inside `rec-not-actionable`. | default | test |
| UX-5 | Copy is verbatim `PLAN_FIELDS_NOT_CHECKED`; names the six `PLAN_FIELD_LABEL` strings and the stop/target/invalidation allowlist; contains none of the banned halo word set used for `REASONING_PROSE_NOT_CHECKED`. | default | review |
| UX-6 | Caption is **disjoint** from `REASONING_PROSE_NOT_CHECKED`, every `GROUNDING_CARD.*` member, `GROUNDING_BLOCK_ABSENT`, and `incompleteAction(…)` — string inequality + no shared testid. | default + analysis open | test |
| UX-7 | When the conditional not-actionable line also fires (incomplete model-path trade), both lines render as two statements; neither string is a substring composition of the other. | incomplete_trade | test |
| UX-8 | Grounding block absent + model-path trade still shows the caption (exemption is affirmative local-rules only). | default (block_absent) | test |
| UX-9 | Stale / stale-born / superseded strips do not remove, rewrite, or absorb the caption. | stale | test |
| UX-10 | SSE drop leaves the caption byte-identical — no dim, no `⏸`, no blank. | offline | test |
| UX-11 | None of the six plan fields gains a figure clause, grounding state style, per-field "not checked" chip, or type-register change. | default | test |
| UX-12 | No new animation family; caption is static text (`single-motion-moment` inventory unchanged). | default | test |
| UX-13 | Caption uses theme/MUI text tokens only — zero hardcoded hex; quiet `text.secondary`, not `warning.*` alone without icon (and not warning at all). | default | review |
| UX-14 | Analysis drawer does **not** gain a second `plan-fields-not-checked` instance; `REASONING_PROSE_NOT_CHECKED` remains the only prose-scope caption there. | default + analysis open | test |
| UX-15 | Reserved no-entry `—` behavior is unchanged on risk fields; caption introduces no new use of `—`. | default / no_trade | test |

### Design-system adherence (SET — The Curvature Terminal)

- Reuse quiet honesty caption pattern already shipped for prose scope — no new component family.
- Amber / warning chrome **not** spent (not an alarm; permanent scope). Green/red untouched.
- No fourth convex arc; no new motion moment; no Inter; no hardcoded hex.
- No DESIGN_SYSTEM amendment required unless synthesizer later records the constant name only — not a new token or pattern class.

## Risks I see

1. **Line-budget relapse.** Card already carries provenance chips, optional degraded Alert, verdict, plan row, optional not-actionable Alert, risk grid, grounding line, cap line, actions. A third "aren't checked" voice (prose caption in drawer + this + grounding line) can train skip-reading. Mitigation: one instance, quiet caption under its section, never warning chrome, never merged into card-level budget.
2. **Local-rules gate wrong field.** Gating on `key_source` (BRIEF feasibility gloss) instead of `grounding.card === 'local_rules'` either leaves standing chrome on rules path or hides the caption on legitimate model recs. My position pins the card token; R2 must not silently swap to key-resolution.
3. **Spatial copy drift.** Any "above/below" wording will lie after the next layout move — DecisionCard already inverted plan-vs-risk order relative to older AiRecPanel mental models. Allowlist naming only.
4. **False diagnosis.** If implementers conditionalize the caption on "at least one plan field is bare" or "at least one risk clause present," it becomes a per-rec diagnosis and re-opens the residual on fully-stated unchecked plans — the exact failure mode. Caption is unconditional on model-path trade.
5. **Drawer-only counter-proposal.** Architect/PM may prefer analysis-only for density. I will not soften: act path is on the card; drawer-only fails decision impact.
6. **Copy length on 393px.** Naming all six labels is honest and long; wrapping is expected. Truncation or "plan fields" shorthand that drops labels would weaken the closed vocabulary link — prefer wrap over rename.

## Assumptions I'm making about the other two lanes

- **Architect** will treat this as pure FE presentation over existing `RecResponse` fields (`strategy.decision`, `grounding.card`, existing plan values) with `NO_BACKEND_CHANGE` and empty `apps/api` diff — no new endpoint, no new grounding member, no plan-field entry into `counts.checked`.
- **Architect** will accept `grounding.card === 'local_rules'` as the sole affirmative local-rules exclusion signal already on the wire, and will not require a new producer flag for the caption gate.
- **PM** will keep scope to **one** section-level caption closing §9.5 half two — not a new per-field grounding treatment, not a redesign of DecisionCard hierarchy, not bundling degradation-visibility or other culled items.
- **PM** will price the caption as ship-blocking for §9.5 closure (BRIEF: do not record §9.5 closed before this ships) and will not re-cut it solely for line budget without re-booking the residual.
- **PM** will accept that the conditional not-actionable line and this unconditional scope caption are two coexisting statements on incomplete model-path trades, never merged into one string.
- **Architect / PM** will not relocate the only instance exclusively into `AnalysisSurface` without an explicit product decision that accepting the unprotected card act path is acceptable — my position rejects that relocation.
- **Neither lane** will invent per-field "not checked" markers or extend `FigureClause` / `registerSx` to the six plan fields as a substitute for the section caption.
- **Neither lane** will require a DESIGN_SYSTEM re-baseline; quiet caption + existing tokens suffice, and any constant is an amendment-log note at most, not a second system in SPEC §4.
