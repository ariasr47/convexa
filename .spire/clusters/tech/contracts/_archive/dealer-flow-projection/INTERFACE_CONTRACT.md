# INTERFACE CONTRACT — Dealer-Flow Projection

> The single source of FE↔BE integration truth. Both execution contracts bind to THIS file.
> Producer: Split Compressor (UX session exit). Consumers: Backend + Frontend + QA.
> Self-contained against `.claude/PROJECT_CONTEXT.md` + this feature's UX_BLUEPRINT / ARCHITECTURE /
> PRODUCT contracts. No chat history.

## Endpoints touched
- `GET /api/ticker/{ticker}` (+ alias `GET /{ticker}`) and the slice `GET /api/market-data` — the
  cached REST bundle. **One additive nested field only** (`market_state.dealer_flow_projection`,
  below). **No new endpoint, no new query param, no toggle, no request flag** — the read is always-on
  and rides the existing cached bundle's `market_state`.
- `GET /api/stream/{ticker}` (SSE) — **UNCHANGED.** The projection NEVER enters the live payload.
  **Binding rule:** no field the projection uses, and none it emits, may come from the SSE stream.
- `GET /api/recommendation/export/{ticker}` + the in-app rec state export — carry the new field
  automatically because they serialize `market_state` **wholesale** (no serializer change; see §4).

## Payload addition — `market_state.dealer_flow_projection`
A single nested, **independently-nullable** object mirroring `iv_skew` / `term_structure`. Additive:
every existing `market_state` field is unchanged. The two limbs (`charm`, `vanna`) are **independently
nullable**; the whole object is `null` only when BOTH limbs are unavailable OR the computation raised.

```jsonc
"market_state": {
  // … all existing fields unchanged …

  "dealer_flow_projection": {        // object | null  — null only when BOTH limbs null OR compute raised
    "spot_basis": 178.40,            // number  synchronized_spot / gex_spot the flow was computed at
                                     //         (close-anchored, NOT live). null only when the whole object is null.

    "charm": {                       // object | null  — null if net_charm unavailable OR horizon undeterminable
      "projected_delta": 4200000.0,  // number  signed $-delta drift to horizon (= net_charm · horizon_days), 2dp
      "per_day_base": 380000.0,      // number  signed $-delta per +1 calendar day (= net_charm), 2dp
      "horizon_days": 11,            // int     calendar days to next monthly OPEX, >= 1
      "opex_date": "2026-07-17"      // string  ISO YYYY-MM-DD the drift is projected to (next monthly OPEX)
    },

    "vanna": {                       // object | null  — null if net_vanna unavailable
      "projected_delta": 1850000.0,  // number  signed $-delta at the base move (= net_vanna · move_iv_points), 2dp
      "move_iv_points": 1.0,         // number  base assumed vol move, IV points (fixed 1.0)
      "illustrative_move_iv_points": 5.0,      // number  illustrative shock, IV points (fixed 5.0)
      "illustrative_projected_delta": 9250000.0, // number  PRE-SCALED $-delta at the illustrative move (= net_vanna · 5), 2dp
      "reference_direction": "increase"        // string  the direction the quote assumes; value is "increase"
    }
  }
}
```

## Presence / semantics (binding)
- **Naming is fixed by UX (the deferred interface-split item):** object key `dealer_flow_projection`;
  limbs `charm` / `vanna`; spot basis `spot_basis`. Do not rename.
- **Charm limb (`charm`):** window-scoped (built over the SELECTED DTE/expiration window, same filtered
  contracts as `net_gex`/`net_dex`/`net_charm` — NOT full-chain). `projected_delta = net_charm ·
  horizon_days`, **linear/first-order** (no path re-integration). `horizon_days` = calendar days to the
  next monthly OPEX (3rd-Friday expiration), clamped `>= 1`. `opex_date` = that OPEX date (ISO).
  **Window-excludes-OPEX case:** if the selected window does NOT reach the OPEX date, the limb STILL
  targets that OPEX and STILL emits `horizon_days` + `opex_date` (mismatch legible, never retargeted or
  hidden). `null` iff `net_charm` is unavailable OR no future monthly OPEX exists in the chain.
- **Vanna limb (`vanna`):** window-scoped like charm. Base `projected_delta = net_vanna ·
  move_iv_points` with `move_iv_points = 1.0` ⇒ equals `net_vanna`. `illustrative_projected_delta =
  net_vanna · illustrative_move_iv_points` with `illustrative_move_iv_points = 5.0` — **pre-scaled on
  the wire** (the FE renders it directly, never multiplies). `reference_direction = "increase"` (a vol
  increase; a vol decrease is the exact negation — the FE states this, no second figure emitted).
  `null` iff `net_vanna` is unavailable.
- **Signs:** both `projected_delta` values inherit the existing signed dealer-book convention (calls +,
  puts −, put contributions already negated in-engine). **No new sign math.**
- **Rounding:** dollar quantities rounded to **2dp**, applied AFTER the deterministic reduction (§4).
- **`spot_basis`** = `synchronized_spot` / `gex_spot` (close-anchored), never the live/display spot.
- **No `side`/`direction`/`bias`/`score`/`tier` field** anywhere on the object. **No scoring:**
  `opportunity_score`, `opportunity_tier`, `ai_eval`/`state_fingerprint`, the gate, and every `signals`
  field are **byte-identical** with vs without this object (the module boundary is the enforcement —
  `signals` reads none of it).

## Error / isolation semantics
- **Best-effort, independently nullable.** A limb failing yields `null` for that limb only; the object
  failing yields `dealer_flow_projection: null`. The rest of `market_state` (gamma/greek fields),
  `strike_profile`, and the SSE path stay intact. **The projection can NEVER turn a 200 bundle into an
  HTTP error** (`[best-effort-isolated-or-null]`).
- **A `null` is a legitimate result, NOT a conformance failure** (see §Conformance-spec note). A
  missing value is `null`, never a fabricated `0` and never a fabricated date/horizon.
- Existing bundle error modes unchanged: **404** (no chain) → FE cold-start error+retry; a refresh
  failure after a prior success → FE keeps the last bundle behind `Couldn't refresh…`.
- **SSE unchanged / static isolation:** on a live-stream drop the FE keeps the read visible from the
  last bundle and must **NOT** mark it offline/stale/dimmed — it is a static bundle field
  (`[live-vs-static-isolation]`).

## Conformance spec

```json
{
  "feature": "dealer-flow-projection",
  "spec_file": ".claude/tools/conformance/dealer-flow-projection.json",
  "convention": "standalone (mirrors byo-ai-key / ai-rec-backtest-orders); NOT folded into ticker-load-experience.json",
  "machine_assertable": [
    "GET /api/ticker/{ticker} still returns the score/tier/gate/fingerprint FLOOR unchanged (the additive field must not perturb any scored output) — the [additive-keeps-score-byte-identical] wire face",
    "market_state is present and object-typed (the projection rides it; it must remain the same envelope shape)"
  ],
  "NOT_machine_assertable_here": [
    "market_state.dealer_flow_projection is OPTIONAL/NULLABLE: present-and-typed when the chain yields charm/vanna, but legitimately null (whole object) or with a null limb when an aggregate is unavailable or no monthly OPEX exists. The static HTTP harness MUST NOT require it non-null (a null is a valid best-effort result), so its subfields are NOT listed as required paths — asserting them would FAIL on a legitimately-null cycle.",
    "The null-FAMILY states (charm-only, vanna-only, whole-read-null) — verified by BE runtime null-path proofs + the FE component tests.",
    "Byte-identity of score/tier/gate/fingerprint with-vs-without the object AND before-vs-after the determinism fix (AC-11/AC-12) — verified by the BE byte-identity runtime proofs (a static field-presence check cannot prove equality across two computes).",
    "The horizon derivation (horizon_days = days to next monthly OPEX, >= 1; window-excludes-OPEX legibility) — verified by BE runtime proofs + FE tests (AC-8).",
    "The window-scoping (moves with the DTE window) and the linear/pre-scaled arithmetic — BE runtime proofs + FE tests (AC-7)."
  ],
  "runnable_endpoints": [
    {
      "id": "bundle_score_floor_unchanged",
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": {"ticker": "SPY"},
      "query": {"min_dte": "7", "max_dte": "45", "dark_pool": "true"},
      "required": {
        "market_state": "object",
        "signals": "object",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "signals.prime_prompt_eligible": "boolean",
        "ai_eval": "object",
        "ai_eval.ready": "boolean",
        "ai_eval.state_fingerprint": "string"
      }
    }
  ]
}
```

> **Standalone spec file to author:** `.claude/tools/conformance/dealer-flow-projection.json` in the
> flat schema `interface_conformance.py` executes (`{method,path,path_params,query,body,required}`),
> projecting the single `runnable_endpoints` entry above. It asserts ONLY the score/tier/gate/
> fingerprint FLOOR + `market_state` presence — the additive field is optional/nullable and is NOT a
> required path (a null cycle must PASS). Everything else (null-family, byte-identity, horizon, window
> scoping) is verified by the BE runtime proofs + the FE test matrix, exactly like the byo-ai-key /
> ai-rec-backtest-orders precedent.
```
