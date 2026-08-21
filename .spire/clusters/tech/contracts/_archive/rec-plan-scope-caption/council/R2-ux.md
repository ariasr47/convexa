```json
{
  "role": "ux",
  "agree": [
    "Using key_source as the local-rules exclusion is a **false mechanism**.",
    "**Architect preference on technical grounds:** attach to the **pinned plan row** so the scope fact sits where the unchecked stated fields and the checked risk clauses are visible together — that is where the false inference forms.",
    "Content heuristics either miss LLM omissions or fire as **standing chrome** on the local-rules path — the exact failure the BRIEF forbids.",
    "This is a **scope statement**, not a diagnosis.",
    "Exactly **one** instance is visible for a given rec view (no duplicate on card *and* drawer, no per-row repeats).",
    "Closing half two is the only remaining condition."
  ],
  "conflicts": [
    {
      "quote": "On an **LLM-produced trade** recommendation that shows at least one **stated** plan field among the six and at least one grounding clause on stop / target / invalidation, the plan section shows **exactly one** section-level caption stating that the plan fields are not checked.",
      "source": "pm",
      "why": "This AC encodes two content heuristics as the show condition: ≥1 stated plan field and ≥1 risk/exit grounding clause. A scope boundary that vanishes when every plan field is `not given`, or when risk clauses are absent this cycle, teaches the wrong lesson (no caption ≠ full check coverage) and reopens the residual on fully-stated unchecked plans without clauses. Architect Option A and UX default/show matrix gate only on produced trade + plan section mounted + not `grounding.card === 'local_rules'`.",
      "proposal": "Keep the stated-field + clause case as the primary ship-blocking *fixture* for presence tests; drop both content clauses from the visibility predicate so the caption is unconditional on every non-local_rules produced trade whose plan section mounts.",
      "kind": "technical"
    },
    {
      "quote": "It must **not** become standing chrome on the **local-rules / keyless** path — that path still emits a trade with stated structure / trigger / confidence whenever a setup exists, so an always-on banner there is permanent noise and was the exact condition that cut this caption on line-budget last time.",
      "source": "pm",
      "why": "Equating local-rules with keyless points implementers at `key_source` (own_key / shared_admin / none). Architect verified live local-rules envelopes can carry a real key_source (e.g. `grounding.card: \"local_rules\"` with `key_source: \"shared_admin\"`). Gating on keyless either leaves standing chrome on rules trades with a key or hides the caption on legitimate model-path trades.",
      "proposal": "Name the exclusion only as the closed affirmative token `grounding.card === 'local_rules'` (and rewrite AC-2 the same way). Do not treat `key_source === 'none'` as a synonym or alternate gate.",
      "kind": "technical"
    },
    {
      "quote": "When plan-field values are visible to the trader, the caption is present on that same surface/section (a reader does not have to open a second surface solely to learn the plan fields are unchecked).",
      "source": "pm",
      "why": "Read literally, the main clause requires a caption on every surface that shows plan fields. AnalysisSurface already re-states a subset of plan labels; card-only placement (UX + architect preference) then fails the clause whenever the drawer is open, while dual attachment collides with PM's single-instance rule and re-opens the line-budget cut. The parenthetical is the real product rule (anti drawer-only); the absolute main clause over-specifies.",
      "proposal": "Bind AC-7 to the primary act surface: the pinned plan row on DecisionCard carries the one caption so a reader never opens analysis solely for the scope fact. Analysis may re-state plan fields without a second `plan-fields-not-checked` instance.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: Confirm AC-1's 'stated plan field' and 'grounding clause' language is fixture/setup for the ship-blocking observation, not part of the show/hide predicate.",
    "PM: Confirm AC-2 will pin absence solely on `grounding.card === 'local_rules'` and drop 'keyless' as a path synonym.",
    "Architect: For a trade plan row where `grounding.card === 'not_applicable'` (local-only producer, checked==0 preempts local_rules), is accept-show under Option A the locked residual under NO_BACKEND_CHANGE?"
  ]
}
```
