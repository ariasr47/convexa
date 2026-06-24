# trader-personas — brief

Goal:            A trader **persona** (investment goal + risk/reward profile + customizations)
                 selects and parametrizes the `strategy_prompt` — and, where relevant, the
                 `reassessment_prompt` — handed to the external downstream AI, so its risk-first
                 trade calls are tailored to the trader's actual objective and risk tolerance
                 (e.g. premium-selling/income vs directional swing; conservative vs aggressive)
                 instead of a single one-size-fits-all framing. The persona is a **prompt +
                 presentation-layer** concern only: GammaFlow's entry gate, `opportunity_score`,
                 and `state_fingerprint` stay byte-identical, and the AI stays **external**
                 (GammaFlow defines the hand-off contract + gate, it never calls an LLM — §8).

Decision impact: Improves the **entry (and re-entry) trade-call decision**. The same
                 `market_state` produces an AI verdict aligned to the active persona's
                 objective/risk tolerance, so a conservative income trader and an aggressive
                 swing trader don't receive the same framing of an identical setup. Observed by:
                 switching the active persona on one unchanged bundle yields a materially
                 different, persona-appropriate hand-off prompt (and downstream call), while the
                 gate / `opportunity_score` / `state_fingerprint` readouts are visibly unchanged.

Feasibility:     pass — prompt + presentation layer only; needs no new data/vendor coverage and
                 no new math. (No grooming-time Architect consult required; well-understood.)

Effort:          M

Invariant watch: The entry **gate**, `opportunity_score`, and `state_fingerprint` stay
                 **byte-identical** (the over-trading guard is untouched — persona never reopens
                 when the AI is escalated, only how the prompt reads once escalated). The **AI
                 stays external** (§8): no LLM call is added. Persona touches only the hand-off
                 prompt + its presentation. Does NOT touch gamma sourcing, rates, the DTE-filter
                 scope, or dark-pool-is-context.

Entry point:     architect-first — the pivotal call is the **boundary** between the
                 persona-parametrized prompt and the locked gate/score/fingerprint engine. Keeping
                 the persona layer cleanly isolated from the scoring engine (and from any LLM call)
                 is an architecture/invariant decision, not a product one, so the constraint
                 envelope must be set before product scope is written.

Source:          BACKLOG §A (queued / in-mind) ← "downstream-AI quality" harvest source
                 (`strategy_prompt` / `reassessment_prompt` hand-off fit).
