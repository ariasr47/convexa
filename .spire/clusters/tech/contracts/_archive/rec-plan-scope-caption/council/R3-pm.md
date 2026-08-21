# rec-plan-scope-caption — R3 pm resolution (D3 only)

One open conflict. D1 and D2 stay folded. Not rewriting R1 wholesale.

---

## D3 — AC-7 co-location vs single instance

**Conflict id:** `bcfff029…` (ux vs pm, technical)

**Quote under challenge (pm R1 AC-7):**
> When plan-field values are visible to the trader, the caption is present on that same surface/section (a reader does not have to open a second surface solely to learn the plan fields are unchecked).

**UX proposal:**
> Bind AC-7 to the primary act surface: the pinned plan row on DecisionCard carries the one caption so a reader never opens analysis solely for the scope fact. Analysis may re-state plan fields without a second `plan-fields-not-checked` instance.

### Ruling: **ACCEPT with tighter product wording**

UX is right that the main clause, read literally, over-specifies. The product intent of AC-7 was never “caption on every surface that happens to echo a plan label.” The ship-blocking product rule is the parenthetical: **a reader must not open a second surface solely to learn the plan fields are unchecked** — i.e. **anti drawer-only**, protecting the primary act path.

That intent is fully served by one caption on the pinned plan row of the DecisionCard. Analysis may re-state plan labels without a second plan-scope caption. Dual attachment would violate the single-instance rule (AC-3) and re-open the line-budget cut that killed this caption last time. Drawer-only fails US-4 and the BRIEF observed-by (act affordances live on the card).

**Withdrawn reading of AC-7:** any requirement that analysis must also carry `plan-fields-not-checked` whenever it re-states plan fields.

**Product-locked AC-7 (replace the R1 sentence for R4):**

> On a produced trade that shows the plan-scope caption, that caption is present on the **primary act surface** — the pinned plan row of the DecisionCard — so a reader never has to open analysis solely to learn the plan fields are unchecked. The analysis surface may re-state plan-field labels without a second plan-scope caption instance. Drawer-only placement of the only instance fails this criterion.

**Still ship-blocking product constraints (unchanged):**

| Constraint | Product meaning |
|---|---|
| Primary act co-location | Caption sits with the plan row the trader acts from (DecisionCard), not only inside an unopened analysis region |
| Exactly one instance (AC-3) | Zero simultaneous card+drawer duplicates; no per-row repeats |
| Scope, not diagnosis | Section-level caption only; no per-field markers |

**Verify by:** `review` (placement / co-location judgment). Pair with AC-3 `test` for single-instance / no second analysis instance.

**Settled.** No further exchange. No human priority call — this is a technical tightening of an over-broad main clause to the product rule already intended.

---

## Residual answer — `grounding.card === 'not_applicable'` (D4)

**`grounding.card === 'not_applicable'` (local-only body, checked==0 preempts `local_rules`) is an accept-show residual under `NO_BACKEND_CHANGE`; AC-2 must not hide there** — the closed exclusion set remains affirmative `card === 'local_rules'` only; R4 names the residual so GATE Q does not treat show-on-`not_applicable` as a miss.

---

## What R4 must carry from this exchange

1. **AC-7** uses the tighter wording above (primary act surface / pinned plan row; analysis may restate plan labels without a second instance; drawer-only fails).
2. **AC-3** remains the single-instance hard gate (including analysis open → still one caption, on the card).
3. **D1 / D2** remain as already folded in `decisions.md`.
4. **D4 residual** is product-confirmed: accept-show when `card === 'not_applicable'`; do not add a second hide token under this feature’s backend freeze.
)
