# Convexa → Strategy AI hand-off contract

Convexa does **not** call an LLM itself. It produces the analytics, a cheap rule-layer
gate, and a dedupe fingerprint; an **external** orchestrator decides when to invoke the
strategy AI and with what prompt. This file is that contract: when to call, what to send,
and what the AI must return.

## When to invoke (gate + dedupe)

Pull a ticker from the bundle route (`GET /{ticker}` or `/api/ticker/{ticker}`, optionally
`?min_dte=7&max_dte=45`). Invoke the AI **only** when:

```
ai_eval.ready == true            # rule layer says it's actionable
AND ai_eval.changed == true      # distinct from the last picture (server-side dedupe)
AND meta.freshness.stale == false
AND ai_eval.state_fingerprint not in <fingerprints you've already evaluated>
```

`ai_eval.ready` is already forced to `false` when the snapshot is stale, so the freshness
check is belt-and-suspenders. Record each `state_fingerprint` you act on and skip repeats —
that is the second, consumer-side dedupe and the authoritative one (the server's `changed`
flag only compares against the immediately preceding distinct compute).

Do not poll faster than the data changes: ~60s with the delayed feed (the cache TTL),
faster only on a real-time tier.

## What to send

- The full bundle from the route: `market_state`, `signals`, `strike_profile`, `meta`.
- `market_state_glossary.md` as the field reference (definitions, reliability order).
- The requested DTE window (`market_state.dte_min` / `dte_max`) so the AI sizes the trade
  to the horizon the levels were computed for.

## System prompt (risk-first)

> You are a disciplined options strategist. The user trades **longer-dated** options
> (typically 7–45 DTE) and is prone to greed and poor risk management — your job is to
> impose discipline, not to find a reason to trade.
>
> Read the bundle using the glossary's reliability order (gamma structure first, then
> IV/HV and VWAP, then max pain, then higher-order greeks directionally). Anchor levels to
> `gex_spot`, not `price`. Respect the regime: in `positive_gamma` favor mean-reversion /
> selling premium; in `negative_gamma` favor momentum / buying premium and do NOT fade.
>
> You must lead with risk. Return **`no_trade`** when `signals.setups` is empty,
> `meta.freshness.stale` is true, or there is no clean edge — saying "no trade" is a
> correct and common answer. When you do propose a trade, every risk field below is
> mandatory; do not omit them.
>
> Respond with **JSON only**, matching this schema.

## Required output schema

```json
{
  "decision": "trade | no_trade",
  "bias": "long | short | neutral | volatility",
  "structure": "e.g. call debit spread, put credit spread, long calls",
  "strikes": [/* concrete strike(s) */],
  "expiration": "YYYY-MM-DD within the requested DTE window",
  "entry_trigger": "the condition/level that confirms entry",
  "invalidation_level": 0.0,
  "max_risk": "max $ or % of account at risk",
  "position_size": "concrete size consistent with max_risk",
  "exit_plan": { "target": 0.0, "stop": 0.0 },
  "time_horizon": "expected holding period",
  "confidence": "low | medium | high",
  "rationale": "why, citing the specific Convexa levels (walls, flip, magnet, IV/HV)"
}
```

When `decision` is `no_trade`, set the trade fields to `null` and explain why in
`rationale`.

<!--PERSONA_DECOMP_START-->
## Persona decomposition (FIXED vs PERSONA — annotation only; not part of the prompt sent)

The prompt **body above is the byte-identical Default render** (today's prompt, unchanged). For the
Trader Personas feature (A1 RESOLVED·ACCEPTED), this hand-off is decomposed into FIXED vs
PERSONA-VARIABLE sections. The machine-readable template + the 7 built-in `PersonaDefinition`s are in
`src/core/personas.py` and served read-only at `GET /api/personas`. **The FE assembles** the
persona-parametrized prompt client-side from that template; the server adds **no** `meta.handoff` and
accepts **no** `?persona=` param. Persona never changes `opportunity_score`, `opportunity_tier`,
`ai_eval` (`ready`/`changed`/`state_fingerprint`), the gate, or any analytics — those are
byte-identical across personas — and switching it triggers **no recompute**. Convexa still never calls an LLM.

- **FIXED (persona-invariant):** *When to invoke* (gate + dedupe); *What to send* (full bundle +
  `market_state_glossary.md` + DTE window — no field dropped); the **required output schema**; and the
  **universal risk-first floor** (lead with risk; `no_trade` is valid; JSON-only; anchor `gex_spot`;
  reliability order; respect regime). **The floor carries NO characterization of who the trader is.**
- **PERSONA-VARIABLE slots:** the inline **trader-disposition** clause in the floor sentence (A1 —
  relocated OUT of the fixed floor), plus an optional **objective-framing** line, **risk-calibration**
  line, **emphasis note**, and **DTE-preference** line (injected as a "Persona framing" block; empty
  for Default).
- **A1 disposition map** (fills the inline disposition slot; the harsh `prone to greed and poor risk
  management` register appears **only** under **Default** (verbatim) and the **conservative** register —
  never moderate/aggressive, never universal):
  - Default: `is prone to greed and poor risk management`
  - conservative: `is prone to greed and poor risk management — risk-averse; values capital preservation; benefits from imposed discipline (guard against over-trading)`
  - moderate: `is disciplined; balanced risk`
  - aggressive: `accepts higher variance for higher reward`
- **Dark-pool stays neutral context** under every persona (it lives in the FIXED "what to send" set).
- **Best-effort:** any persona/assembly failure falls back to this Default prompt; never an error.
