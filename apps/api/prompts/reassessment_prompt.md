# GammaFlow → Reassessment AI hand-off contract (open-position health check)

GammaFlow does **not** call an LLM itself. This is the **position-aware** sibling of
`strategy_prompt.md`: when the user holds an open (simulated) ghost trade and asks to
*Reassess*, GammaFlow assembles a structured request from the durable trade record + the
current bundle, an **external** orchestrator runs the AI, and a structured verdict is ingested.
**Phase-1 transport is operator-mediated** (a copyable request out, a pasted verdict in) — the
same family as the strategy hand-off. No endpoint round-trip, no auto-apply, no real order.

## When to reassess

Triggered by the user (the *Reassess* control) or surfaced by a once-per-event alert. Do **not**
reassess on stale/overnight/closed data:

```
meta.freshness.stale == false
AND live.market_session not in {overnight, closed}   # the FE disables Reassess otherwise
```

The over-trading discipline still applies: alerts that *suggest* reassessing are de-duped via
`position_eval.changed` (fires once per material event), but the user always decides whether to act.

## What to send — `reassessment_request`

Assembled by the app (durable lane + cached bundle); an extension of the strategy hand-off:

```jsonc
"reassessment_request": {
  "trade": {
    "ticker": "TSLA", "expiration": "YYYY-MM-DD", "strike": 250, "right": "call",
    "side": "long", "qty": 1,
    "entry_mark": 2.20,          // option mid at entry (the fill basis)
    "entry_time": "ISO-8601"
  },
  "market_state": { /* the current bundle market_state (anchor levels to gex_spot) */ },
  "decision_digest": [ /* recent DecisionRecord summaries: event_type, clock_time, verdict→choice, mark, pl_pct */ ]
}
```

- Also send `market_state_glossary.md` as the field reference (definitions + reliability order),
  and the held contract's current stats from `GET /api/contract/{ticker}` (`option_quote`, greeks,
  `iv`, `dte`) so the AI judges the *position*, not just the chain.

## System prompt (risk-first, position health)

> You are a disciplined options strategist reviewing an **open** longer-dated (7–45 DTE) option
> position for a user prone to greed and poor risk management. Your job is to protect capital and
> impose discipline — **lead with risk**, not with reasons to add.
>
> Read the bundle using the glossary's reliability order (gamma structure first, then IV/HV and
> VWAP, then max pain, then higher-order greeks directionally). Anchor levels to `gex_spot`.
> Respect the regime. Weigh the held contract vs the walls, the gamma flip, DTE remaining, and the
> current P/L. Prefer **Hold** or **Exit** over churn; **Trim** to manage risk into strength; **Add**
> only on a genuinely stronger edge (and the app caps the size); **Roll** only when a specific
> better contract clearly improves the risk profile.
>
> Respond with **JSON only**, matching this schema.

## Verdict schema — `recommendation` (ingested)

```jsonc
"recommendation": {
  "verdict": "Hold",                 // "Hold" | "Trim" | "Add" | "Exit" | "Roll"
  "replacement_contract": null,      // object | null — REQUIRED only for "Roll": {expiration, strike, right}
  "rationale": "string",             // plain-language; cite the specific GammaFlow levels
  "verdict_id": "string",            // stable id (dedupe + decision history)
  "status": "ready"                  // "pending" | "ready" | "failed"
}
```

- **No auto-apply.** GammaFlow surfaces the verdict; the user **Accepts** or **Rejects**, and every
  choice is written to the versioned, exportable decision history. Accept maps to:
  `Hold`→unchanged · `Trim`→reduce qty · `Add`→increase qty **within the operator cap** ·
  `Exit`→close + book realized P/L · `Roll`→close this + open the replacement ghost.
- **Roll constraint (Q9):** `replacement_contract` MUST be a contract **present in the current chain
  snapshot** (resolvable via `GET /api/contract/{ticker}`). If it isn't priced yet, the FE **defers
  the Roll** until the next refresh prices it — this is **not** an error.
- **`status`:** `pending` while the operator's integration is still working; `ready` when the verdict
  is final; `failed` on a boundary error (the FE shows "Couldn't reach the AI — try again"; the
  position is untouched).

GammaFlow guarantees the request assembly + accept/reject + decision-history machinery. Round-trip
synchrony is a property of the operator's AI integration behind this boundary, **not** a GammaFlow
guarantee. No real order is ever placed (simulation only).

<!--PERSONA_DECOMP_START-->
## Persona decomposition (FIXED vs PERSONA — annotation only; not part of the prompt sent)

The prompt **body above is the byte-identical Default render** (today's reassessment prompt,
unchanged). For the Trader Personas feature (A1 RESOLVED·ACCEPTED), this hand-off is decomposed into
FIXED vs PERSONA-VARIABLE sections. The machine-readable template + the 7 built-in
`PersonaDefinition`s are in `src/core/personas.py` and served read-only at `GET /api/personas`. **The
FE assembles** the persona-parametrized prompt client-side; the server adds **no** `meta.handoff` and
accepts **no** `?persona=` param. Persona never changes the bundle/score/tier/gate/fingerprint
(byte-identical) and triggers **no recompute**; GammaFlow still never calls an LLM.

- **FIXED (persona-invariant):** *When to reassess* (gate + dedupe); *What to send* (the
  `reassessment_request` + `market_state_glossary.md` + held-contract stats — no field dropped); the
  **verdict schema** `{Hold, Trim, Add, Exit, Roll}`; the **Add cap / no-auto-apply / Roll constraint /
  `status` semantics**; and the **universal risk-first floor** (lead with risk; `Hold` is valid;
  JSON-only; anchor `gex_spot`; reliability order; respect regime). **No trader characterization.**
- **PERSONA-VARIABLE slots:** the inline **trader-disposition** clause (A1 — relocated out of the
  fixed floor), plus an optional **objective-framing** line, **risk-calibration** line, a
  **reassessment-disposition lean** (within the fixed caps/schema), an optional **emphasis note**, and
  an optional **DTE-preference** line (a "Persona framing" block; empty for Default).
- **A1 disposition map** (fills the inline disposition slot; `prone to greed and poor risk management`
  appears **only** under **Default** (verbatim) and the **conservative** register):
  - Default: `prone to greed and poor risk management`
  - conservative: `prone to greed and poor risk management — risk-averse; values capital preservation; benefits from imposed discipline (guard against over-trading)`
  - moderate: `who is disciplined; balanced risk`
  - aggressive: `who accepts higher variance for higher reward`
- **Dark-pool stays neutral context** under every persona. **Best-effort:** any assembly failure
  falls back to this Default prompt; never an error.
