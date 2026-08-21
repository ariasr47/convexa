# rec-plan-scope-caption — R3 decisions

Source: `council/conflicts.json` (7 conflicts, 7/7 quotes verified, 2 self-revisions).
Conductor folds retractions and settled technical items here. Do not re-open.

## Folded — self-revisions (no exchange)

### D1 — AC-1 is a fixture, not the show predicate
- **Conflict ids:** `bbcc2d10…` (pm self-revision, tagged product) · `17f09d16…` (architect vs pm, technical) · `caaf0950…` (ux vs pm, technical)
- **Quote (pm R1):** "On an **LLM-produced trade** recommendation that shows at least one **stated** plan field among the six and at least one grounding clause on stop / target / invalidation, the plan section shows **exactly one** section-level caption stating that the plan fields are not checked."
- **Ruling:** PM withdraws the content-heuristic as the presence rule. Ship-blocking **presence** is structural only: produced trade, plan section mounted, and `grounding.card !== 'local_rules'`. The stated-field + risk-clause case remains the **primary review fixture** for the wrong-trade story, not a gate condition.
- **Settled by:** PM self-revision; architect and UX proposals match. No human call.

### D2 — Exclusion is `grounding.card === 'local_rules'`, not "keyless"
- **Conflict ids:** `98da1224…` (pm self-revision, technical) · `7bfc6efd…` (architect vs pm, technical) · `00e603ca…` (ux vs pm, technical)
- **Quotes (pm R1):** AC-2 "local-rules / keyless trade" · "It must **not** become standing chrome on the **local-rules / keyless** path…"
- **Ruling:** Drop **keyless** / `key_source` as a synonym for the producer path. Absence when `grounding.card === 'local_rules'` (including a non-`none` `key_source`, e.g. `shared_admin`). Explicit fixture: local_rules card + real key_source → zero caption.
- **Settled by:** PM self-revision; architect and UX proposals match. No human call.

## Settled — one technical exchange

### D3 — AC-7 binds to the pinned DecisionCard plan row
- **Conflict id:** `bcfff029…` (ux vs pm, technical)
- **Quote (pm R1):** "When plan-field values are visible to the trader, the caption is present on that same surface/section (a reader does not have to open a second surface solely to learn the plan fields are unchecked)."
- **Ruling:** CONVERGED. The parenthetical is the product rule (anti drawer-only). **One** caption on the pinned plan row of `DecisionCard`. Analysis may re-state plan labels without a second `plan-fields-not-checked` instance. Drawer-only of the only instance fails. Dual attachment fails (collides with single-instance + line-budget).
- **Settled by:** R3 exchange, pm ACCEPT with tighter wording + ux HOLD of card-only. No human call.

### D4 — `grounding.card === 'not_applicable'` is accept-show
- **Ruling:** Under `NO_BACKEND_CHANGE`, the closed hide set is affirmative `card === 'local_rules'` only. `not_applicable` (local-only, checked==0 preempts `local_rules`) is an **accept-show residual**, not a second hide token. R4 must name this so GATE Q does not treat it as a miss.
- **Settled by:** PM R3 one-sentence lock, matching architect Option A. No human call.

## Human product calls
None. All seven conflicts folded (2 self-revisions + 4 matching technical + 1 exchanged).

## Gate-check
`contract_lint` required `R2-ux.md` to be a lone ` ```json ` fence (a title line broke the receipt parser). Heading stripped; UX conflict_ids remapped in SPEC receipt. Quotes unchanged. `council_conflicts` 7/7 re-verified.
