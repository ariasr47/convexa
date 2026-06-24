# INTERFACE CONTRACT — AI Recommendations (FE ↔ BE truth)

> Producer: UX/Tech-Writer (compressor #3, Split Context). Consumers: Backend + Frontend executioners,
> and `interface_conformance.py` (system-1). This file is the **single FE↔BE truth**: endpoints,
> payload field names/types/presence, and error/gating/cap/SSE semantics. The BACKEND_EXECUTION_CONTRACT
> references it for what it EMITS; the FRONTEND_EXECUTION_CONTRACT references it for what it CONSUMES.
> Self-contained against GAMMAFLOW_CONTEXT.md.
> **Binding:** No API key in any request or response payload (server-side only). The LLM call is a
> best-effort, isolated, gated consumer — any failure is a 200 with a `status` field, **never an HTTP
> 5xx that breaks the bundle/SSE/page.**

---

## 1. Endpoints (NEW for this feature)

### 1.1 `POST /api/recommendation/{ticker}` — request a rec (in-app LLM call)
On-demand, user-initiated. Returns the structured rec artifact wrapped with provenance + status.
Best-effort: **always HTTP 200** for produced / no_trade / unavailable / gated_off (the artifact's
`status` distinguishes them). HTTP non-200 is reserved for transport-level faults the FE treats as
`unavailable`.

**Request body** (`RecRequest`):
```json
{
  "persona_id": "default",        // string|null — the persona framing THIS read. null ⇒ Default.
                                   //   active persona by default; a per-query override is just a
                                   //   different persona_id (does NOT mutate the active selection).
  "snapshot_fingerprint": "ab12…",// string — ai_eval.state_fingerprint of the bundle on the page,
                                   //   so the server pins/validates the same snapshot it serializes.
  "dte_min": 7,                   // number|null — the DTE window already on the page (carried, not new).
  "dte_max": 45,                  // number|null
  "dark_pool": true,              // boolean — whether off-exchange context is included (mirrors page).
  "override": false               // boolean — true ⇒ user used "Ask anyway" on a no_fresh_edge gate.
}
```
> The request carries **no bundle payload and no key**. Whether the server re-reads the cached bundle
> or the FE hands it over is a BACKEND decision (ARCHITECTURE §"Context assembly"); either way the
> server serializes ALREADY-COMPUTED state (no recompute). The FE sends only identifiers + the gating
> context above.

**Response body** (`RecResponse`) — always 200:
```json
{
  "status": "produced",            // "produced" | "unavailable" | "gated_off"
  "persona": { "id": "default", "name": "Default (no persona)" },
  "as_of": "2026-06-23T14:03:11Z", // snapshot_iso the rec is pinned to (echoes the bundle's freshness)
  "pinned_fingerprint": "ab12…",   // state_fingerprint the rec was generated from (staleness key)
  "stale_born": false,             // bundle was already stale at generation time (honest-at-birth)
  "strategy": {                    // present iff status=="produced"; else null
    "decision": "trade",           // "trade" | "no_trade"
    "bias": "long",                // "long" | "short" | "neutral" | "volatility"
    "structure": "call debit spread",
    "strikes": [450, 460],         // number[] (concrete strikes); [] allowed for no_trade
    "expiration": "2026-07-18",    // "YYYY-MM-DD" within [dte_min,dte_max]; null for no_trade
    "entry_trigger": "break and hold above the 450 call wall",
    "invalidation_level": 442.0,   // number|null
    "max_risk": "1.5% of account ($300)",
    "position_size": "2 contracts",
    "exit_plan": { "target": 12.5, "stop": 6.0 },  // {target:number|null, stop:number|null}
    "time_horizon": "5–10 trading days",
    "confidence": "medium",        // "low" | "medium" | "high"
    "rationale": "magnet at 455, flip at 438; IV/HV cheap…"
  },
  "unavailable_reason": null,      // string|null — present iff status=="unavailable" (e.g. "timeout",
                                   //   "llm_error", "over_cap", "no_key"); NEVER leaks key/secret text.
  "gate": {                        // the gating snapshot AT THE TIME OF THIS RESPONSE
    "state": "available",          // "available" | "no_fresh_edge" | "cooling_down"
    "cooldown_remaining_seconds": 0, // number — >0 only when state=="cooling_down"
    "reasons": []                  // string[] — human reasons for no_fresh_edge (mirrors ai_eval.reasons)
  },
  "cap": {
    "over_limit": false,           // boolean — daily cap reached
    "remaining_today": 49,         // number — recommendations left today (informational)
    "resets_at": "2026-06-24T04:00:00Z" // ISO — when the daily cap resets ("resets {when}")
  }
}
```
> **`no_trade`:** `status=="produced"`, `strategy.decision=="no_trade"`, trade fields
> (`strikes`/`expiration`/`invalidation_level`/`exit_plan.*`/`position_size`) null or empty, `rationale`
> present. (Per `prompts/strategy_prompt.md`, unchanged.)
> **`gated_off`:** the server short-circuited because the gate was `no_fresh_edge` and `override=false`;
> `strategy` null, `gate.state=="no_fresh_edge"`. (The FE normally reads gate via §1.3 and only sends a
> query when allowed or overriding, so `gated_off` is a belt-and-suspenders state.)

### 1.2 `GET /api/recommendation/export/{ticker}` — the structured state export (the floor)
Returns the **exact** structured export that feeds BOTH the in-app call and the manual hand-off. Triggers
**no LLM call**, costs nothing, and is available even when in-app AI is unavailable (no key / over-cap /
error). Always HTTP 200 when a bundle exists for the ticker (404 if the ticker was never fetched).

**Query params:** `?persona_id={id}` (optional; defaults to active/Default — frames the persona-prompt
section to match what a read would send).

**Response body** (`RecExport`):
```json
{
  "ticker": "SPY",
  "as_of": "2026-06-23T14:03:11Z",   // snapshot identity (echoes meta.freshness.snapshot_iso)
  "context": { /* serialization of the cached bundle — ARCHITECTURE §A; null stays null, no recompute */ },
  "persona_prompt": "You are a disciplined options strategist…", // assembled persona prompt (string)
  "glossary": "…market_state_glossary.md…",                       // field-level reference (string)
  "egress_note": "Complete list of what leaves the machine for SPY: context + persona prompt + glossary. No key, no other ticker, no identity, no order data."
}
```
> **Egress invariant (system-6-adjacent, binding):** `RecExport` contains ONLY
> `{context, persona_prompt, glossary}` (+ identifiers + egress_note). It MUST NOT contain an API key,
> any other ticker, user identity, or order/broker data. `context` is a read+serialize of the cached
> bundle — if a value is null/absent in the bundle it is null/absent here (no fill/fetch/recompute).

### 1.3 `GET /api/recommendation/status/{ticker}` — gating + cap + availability (no LLM call)
How the FE learns the gating state, cap state, and in-app availability **without** requesting a rec.
Cheap, side-effect-free, always HTTP 200. The FE polls/reads this to drive the action's enabled/
de-emphasized/disabled presentation.

**Response body** (`RecStatus`):
```json
{
  "availability": { "in_app_enabled": true }, // false ⇒ no key configured / feature off → inert in-app
  "gate": {
    "state": "available",                       // "available" | "no_fresh_edge" | "cooling_down"
    "cooldown_remaining_seconds": 0,
    "reasons": []                               // string[] for no_fresh_edge
  },
  "cap": { "over_limit": false, "remaining_today": 49, "resets_at": "2026-06-24T04:00:00Z" }
}
```
> Gate derivation is the BACKEND's: `no_fresh_edge` ⇔ the existing `ai_eval` guardrails say not
> `ready`/`changed`; `cooling_down` ⇔ within the cooldown window after the last query;
> `available` otherwise. The FE renders the three states; it does not compute them.

### 1.4 `GET /api/personas` — canonical persona source (EXISTING, consumed unchanged)
Already shipped (GAMMAFLOW_CONTEXT §6/§8). This feature **single-sources personas from it** (resolves the
dual-sourcing flag): the canonical decomposed template + 7 presets. The FE embed becomes an **offline /
assembly-failure fallback only**. The persona-prompt that frames a rec (in §1.1 and §1.2) is assembled
from this canonical source. No `?persona=` param is added to the bundle route; persona stays non-scoring.

---

## 2. Semantics (binding — both lanes honor)

- **Best-effort isolation:** §1.1/§1.2/§1.3 NEVER return HTTP 5xx for an LLM/cap/key fault; they return
  200 with `status`/`over_limit`/`in_app_enabled`. A transport fault (network/server crash) surfaces to
  the FE as `unavailable`. None of these endpoints touch the bundle route or the SSE path.
- **No recompute / no new fetch:** the rec + export serialize ALREADY-COMPUTED cached state. No gamma
  source, greek repricing, or DTE-scope change. Null stays null.
- **Score byte-identical:** these endpoints are pure consumers — they never write to or influence
  `signals`/`opportunity_score`/`opportunity_tier`/`ai_eval`/`state_fingerprint`/the gate. The bundle is
  identical with/without the feature and whether or not a rec was ever requested.
- **Static artifact / pinning:** a `RecResponse` is pinned to `as_of` + `pinned_fingerprint`. The FE
  marks it **stale** when the live bundle's `meta.freshness.snapshot_iso` / `ai_eval.state_fingerprint`
  diverges from the rec's pin. An **SSE drop does NOT touch the rec** (it is not a live-derived tile).
  The server never auto-refreshes or re-runs a rec.
- **Gating + cap:** cooldown default **60s**, daily cap default **50/day**, both **operator-configurable**
  (BACKEND env). `resets_at` is the daily reset boundary. Blocked states are calm, never errors.
- **No real order path:** these endpoints never create or mutate a trade. Accept is a pure FE action
  into the shipped ghost-trade tracker. `SIMULATED` everywhere.
- **Server-side key only:** no request or response carries an API key.

---

## 3. Conformance spec

**Runnable spec (canonical — what system-1 executes):**
`.claude/tools/conformance/ai_recommendations.json` (flat schema). Run:
`interface_conformance.py --spec .claude/tools/conformance/ai_recommendations.json --url http://127.0.0.1:8000`.

The JSON below is **human + QA reference**, not the runnable source. `interface_conformance.py` validates
field **presence / type / array-fan-out** from the flat standalone spec; the richer **enums / conditional
nullability / `forbidden_fields` / egress** assertions here are verified by **QA at GATE Q** (the flat
checker does not execute them). Keep the two in sync — the standalone `.json` is the source of truth for
the automated check. (Convention: standalone-file = canonical, per BACKLOG §E system-12.)

```json
{
  "version": "1.0",
  "feature": "ai-recommendations",
  "endpoints": [
    {
      "id": "rec_request",
      "method": "POST",
      "path": "/api/recommendation/{ticker}",
      "request": {
        "required": {
          "persona_id": "string|null",
          "snapshot_fingerprint": "string",
          "dte_min": "number|null",
          "dte_max": "number|null",
          "dark_pool": "boolean",
          "override": "boolean"
        },
        "forbidden_fields": ["api_key", "anthropic_api_key", "key", "secret"]
      },
      "response": {
        "http_status": 200,
        "required": {
          "status": "string",
          "persona": "object",
          "persona.id": "string|null",
          "persona.name": "string",
          "as_of": "string|null",
          "pinned_fingerprint": "string",
          "stale_born": "boolean",
          "strategy": "object|null",
          "unavailable_reason": "string|null",
          "gate": "object",
          "gate.state": "string",
          "gate.cooldown_remaining_seconds": "number",
          "gate.reasons": "array",
          "cap": "object",
          "cap.over_limit": "boolean",
          "cap.remaining_today": "number",
          "cap.resets_at": "string"
        },
        "enums": {
          "status": ["produced", "unavailable", "gated_off"],
          "gate.state": ["available", "no_fresh_edge", "cooling_down"]
        },
        "conditional": {
          "strategy_present_when": "status == 'produced'",
          "strategy_null_when": "status != 'produced'",
          "unavailable_reason_present_when": "status == 'unavailable'"
        },
        "strategy_shape": {
          "required": {
            "decision": "string",
            "bias": "string",
            "structure": "string|null",
            "strikes": "array",
            "expiration": "string|null",
            "entry_trigger": "string|null",
            "invalidation_level": "number|null",
            "max_risk": "string|null",
            "position_size": "string|null",
            "exit_plan": "object",
            "exit_plan.target": "number|null",
            "exit_plan.stop": "number|null",
            "time_horizon": "string|null",
            "confidence": "string|null",
            "rationale": "string"
          },
          "enums": {
            "decision": ["trade", "no_trade"],
            "bias": ["long", "short", "neutral", "volatility"],
            "confidence": ["low", "medium", "high"]
          },
          "no_trade_nulls": ["strikes", "expiration", "invalidation_level", "max_risk", "position_size", "exit_plan.target", "exit_plan.stop"]
        },
        "forbidden_fields": ["api_key", "anthropic_api_key", "key", "secret"]
      }
    },
    {
      "id": "rec_export",
      "method": "GET",
      "path": "/api/recommendation/export/{ticker}",
      "query": { "optional": { "persona_id": "string" } },
      "response": {
        "http_status": 200,
        "not_found_status": 404,
        "required": {
          "ticker": "string",
          "as_of": "string|null",
          "context": "object",
          "persona_prompt": "string",
          "glossary": "string",
          "egress_note": "string"
        },
        "allowed_top_level_only": ["ticker", "as_of", "context", "persona_prompt", "glossary", "egress_note"],
        "forbidden_fields": ["api_key", "anthropic_api_key", "key", "secret", "user", "user_id", "account", "order", "broker"]
      }
    },
    {
      "id": "rec_status",
      "method": "GET",
      "path": "/api/recommendation/status/{ticker}",
      "response": {
        "http_status": 200,
        "required": {
          "availability": "object",
          "availability.in_app_enabled": "boolean",
          "gate": "object",
          "gate.state": "string",
          "gate.cooldown_remaining_seconds": "number",
          "gate.reasons": "array",
          "cap": "object",
          "cap.over_limit": "boolean",
          "cap.remaining_today": "number",
          "cap.resets_at": "string"
        },
        "enums": { "gate.state": ["available", "no_fresh_edge", "cooling_down"] },
        "forbidden_fields": ["api_key", "anthropic_api_key", "key", "secret"]
      }
    },
    {
      "id": "personas_canonical",
      "method": "GET",
      "path": "/api/personas",
      "note": "EXISTING endpoint, consumed unchanged. Canonical persona source; FE embed = offline fallback only.",
      "response": { "http_status": 200 }
    }
  ],
  "invariants": [
    "no_http_5xx_on_llm_or_cap_or_key_fault",
    "no_api_key_in_any_payload",
    "rec_and_export_serialize_already_computed_state_no_recompute",
    "rec_is_static_artifact_pinned_to_as_of_and_fingerprint",
    "sse_drop_does_not_touch_rec",
    "score_tier_gate_fingerprint_byte_identical_with_and_without_feature",
    "export_contains_only_context_persona_prompt_glossary_for_current_ticker",
    "no_real_order_path_accept_is_paper_sim_only"
  ]
}
```

---

## 4. Backend lane marker
**This is a REAL backend lane — NOT `NO_BACKEND_CHANGE`.** See BACKEND_EXECUTION_CONTRACT.md.
