```json
{
  "role": "architect",
  "agree": [
    "I do **not** gate on `key_source` alone — that would either over-hide model recs or under-hide local-rules.",
    "Caption is unconditional on model-path trade.",
    "Grounding block absent + model-path trade still shows the caption (exemption is affirmative local-rules only).",
    "This is a **scope statement**, not a diagnosis.",
    "Exactly **one** instance is visible for a given rec view (no duplicate on card *and* drawer, no per-row repeats).",
    "Frontend-only expected (`NO_BACKEND_CHANGE`).",
    "Score / tier / fingerprint stay byte-identical.",
    "after this feature ships and its ship-blocking ACs pass, gate reports / ledger rows / BACKLOG lines **may** record §9.5 closed. **Until then they must not.**",
    "Placement (GATE-V proposal): immediately **under** `DecisionMetadata` (after the six plan fields), **before** the thesis lead."
  ],
  "conflicts": [
    {
      "quote": "On an **LLM-produced trade** recommendation that shows at least one **stated** plan field among the six and at least one grounding clause on stop / target / invalidation, the plan section shows **exactly one** section-level caption stating that the plan fields are not checked.",
      "source": "pm",
      "why": "As a ship-blocking presence rule this encodes field-content heuristics (stated plan value + risk clause present). That is architect Options B and C: a scope caption that vanishes when all six plan fields are absence literals, or when no risk clause rendered, teaches the wrong lesson (absence of caption ≠ full check coverage) and couples plan chrome to figure state. The residual is structural on every non-local_rules produced trade whose plan section mounts — including fully bare plan rows and trades without a rendered clause. UX already names the same failure mode. AC-1 may describe a rich fixture for review, but it must not define the show predicate.",
      "proposal": "Ship-blocking presence is structural only: produced trade path with plan section mounted and `grounding.card !== 'local_rules'` (or equivalent affirmative local-rules exclusion). Optional richer fixtures (stated field + clause) may document the wrong-trade story for review without becoming gate conditions.",
      "kind": "technical"
    },
    {
      "quote": "On a **local-rules / keyless trade** recommendation (including one with stated structure / entry trigger / confidence and empty or absent strikes/expiration), the plan-scope caption is **absent** — zero instances on the card and on any open analysis surface.",
      "source": "pm",
      "why": "Equating the exclusion path with **keyless** is a false mechanism. Live local-rules envelopes can carry a real `key_source` (observed `grounding.card: \"local_rules\"` with `key_source: \"shared_admin\"`). Gating on keyless/`key_source` either leaves standing chrome on non-none local-rules trades or over-hides model recs. The closed FE discriminator already on the wire is `rec.grounding?.card === 'local_rules'`, not payment provenance. UX pins the same field.",
      "proposal": "Rewrite AC-2 (and path-rule language) as absence when `grounding.card === 'local_rules'`, with an explicit test fixture that pairs that card token with a non-`none` `key_source` and still expects zero caption. Drop **keyless** as a synonym for the producer path.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: Is AC-1's 'at least one stated plan field' and 'at least one grounding clause' only the narrative fixture for the wrong-trade story, or do you require those content checks in the presence predicate itself?",
    "PM: When a local-only body emits `grounding.card === 'not_applicable'` (checked==0 preempts `local_rules` in `card_member`) but still mounts a trade plan row, must AC-2 still demand zero caption under `NO_BACKEND_CHANGE`, or is affirmative `card === 'local_rules'` the closed exclusion set?",
    "UX: Confirm that a single render site under the pinned plan row (not also in `AnalysisSurface`) remains the only attachment you will accept for v1, given PM left drawer-or-card open under co-location."
  ]
}
```
