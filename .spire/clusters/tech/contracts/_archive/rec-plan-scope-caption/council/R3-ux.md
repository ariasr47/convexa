# R3 — ux resolution: rec-plan-scope-caption

One technical exchange. Open item only: **D3** (AC-7 co-location vs single instance). D1 and D2 are folded — not re-opened.

---

## D3 — AC-7 co-location vs single instance · **CONVERGED**

**Hold, refined:** the one `plan-fields-not-checked` instance attaches to the **pinned plan row on `DecisionCard`** (under `DecisionMetadata`). Analysis may re-state plan labels without a second instance.

**Card-only attachment meets both of PM's product constraints in one sentence:** the single visible instance lives on the primary act surface where the six plan fields and the act affordances already sit, so a reader never opens analysis solely to learn the scope fact (anti-drawer-only), and opening the drawer never produces a second `plan-fields-not-checked` (single-instance).

### Why the absolute main clause was the problem, not the product rule

PM R1 AC-7:

> "When plan-field values are visible to the trader, the caption is present on that same surface/section (a reader does not have to open a second surface solely to learn the plan fields are unchecked)."

- **Parenthetical** = the real product rule (US-4 / anti drawer-only). **Met** by card attachment: act path is unprotected only if the caption is drawer-only; card-only fixes that.
- **Main clause read absolutely** = caption on *every* surface that shows plan values. `AnalysisSurface` already re-states a subset of plan labels (`analysis-plan-fields`). That reading forces either (a) dual chrome when the drawer is open — collides with AC-3 / PM's "exactly one instance" — or (b) card-only that "fails" the absolute clause while still satisfying the parenthetical. Over-specification, not a second product need.

PM R1 already delegated placement under co-location + single-instance ("pinned plan row, the analysis drawer/sheet, or both-with-a-single-visible-instance is UX's call"). PM R2 agreed the architect/UX preference to attach to the **pinned plan row** and that drawer-only fails the BRIEF observed-by. No PM R2 conflict re-asserted the absolute co-location reading. Convergence is available without a product escalation.

### Binding AC-7 for R4 (product intent unchanged; wording tightened)

| Piece | Settled text |
| --- | --- |
| **Show surface** | Pinned plan section on `DecisionCard` only — one `data-testid="plan-fields-not-checked"` under the six plan fields. |
| **Anti-drawer-only** | A reader of a model-path trade never has to open analysis solely to learn plan fields are unchecked. |
| **Single instance** | Zero second `plan-fields-not-checked` when analysis is open; analysis may re-state plan field values without carrying this caption. |
| **Not required** | Caption co-located with every re-statement of plan labels on secondary surfaces. |

Suggested AC-7 rewrite (review, not a new predicate): *On a produced non-`local_rules` trade whose plan section mounts, the plan-scope caption is present on the pinned DecisionCard plan section — a reader does not open analysis solely to learn the plan fields are unchecked — and analysis re-statement of plan fields does not add a second instance.*

### Unchanged from my R1 (not re-litigated)

- Placement: under `DecisionMetadata`, before thesis lead; not inside risk fields or grounding note.
- UX-14 stands: analysis drawer gains no second `plan-fields-not-checked`; `REASONING_PROSE_NOT_CHECKED` remains the only prose-scope caption there.
- Verify by remains **`review`** for co-location judgment; single-instance absence of a second testid stays **`test`** (AC-3 / UX-14).

**Status for conductor:** D3 technical conflict **resolved** — card-only attachment; no owner call required.
