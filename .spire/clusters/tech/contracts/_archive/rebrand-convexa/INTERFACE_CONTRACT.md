# rebrand-convexa — INTERFACE CONTRACT (FE ↔ BE truth)

> Compressor #3 output. Inputs: UX_BLUEPRINT, PRODUCT_CONTRACT, ARCHITECTURE_CONTRACT §3. This is the
> FE↔BE seam. For rebrand-convexa that seam **does not move.**

## 1. NO INTERFACE / WIRE CHANGE

**The rebrand is cosmetic to the backend. There is NO interface change of any kind.** Explicitly,
ALL of the following are **byte-identical** before/after this feature:

- The bundle response (`GET /{ticker}`, `/api/ticker/{ticker}` + slices) — every envelope key,
  every `market_state` / `strike_profile` / `signals` field, and every `meta.*` key (`trace_id`,
  `timings`, etc.) is unchanged. No field is renamed, added, removed, or re-typed.
- `opportunity_score`, `opportunity_tier`, the entry gate, and `state_fingerprint` — byte-identical.
- The SSE payload (`mid`, `spread`, net flow, live flip, `last_trade`) — byte-identical; the live
  path opens/closes/reopens page-scoped exactly as before.
- All auxiliary endpoints (`/api/contract`, `/api/_metrics`, `/api/personas`, `/api/recommendation/*`,
  `/api/auth/*`, `/api/positions/sim-trade/gate`) — request and response shapes unchanged.
- Env var names, the persisted-data path (`DATA_DIR = "data"`), and `state_fingerprint` — unchanged.

No renamed identifier escapes into the interface. The backend touches ONLY process-internal cosmetic
labels (logger name, FastAPI app title, the observability ContextVar name) and prose
(comments/docstrings/prompt docs) — none of which is serialized into any response. See
BACKEND_EXECUTION_CONTRACT.md.

> Because the backend IS touched (cosmetic labels/prose), this is **not literally `NO_BACKEND_CHANGE`**
> — but it is **NO interface change**. The FE consumes the same fields by the same names. No `@org/api`
> consumer signature changes (the client-file rename is internal — FRONTEND_EXECUTION_CONTRACT).

## 2. Field naming reference (UI-consumed fields — UNCHANGED, for completeness)

The UI consumes the same fields it does today; this feature names none anew. No field is added or
removed. (Listed so the FE/BE confirm zero drift, not because anything changes.)

- Bundle: `market_state.*`, `strike_profile[*]`, `signals.opportunity_score`,
  `signals.opportunity_tier`, `signals.state_fingerprint`, `ai_eval.*`, `position_eval`, `meta.*`.
- SSE `LiveUpdate`: `mid`, `spread`, net-flow fields, live flip, `last_trade`.
- `/api/contract`: `option_quote{bid,ask,mid}|null`, greeks, iv, dte.

## 3. Conformance spec

**No NEW conformance spec is authored for this feature.** The rebrand changes no wire shape, so there
is nothing new to assert at the seam. The live backend must continue to satisfy the **EXISTING**
conformance specs unchanged, post-rename:

- `.claude/tools/conformance/user-accounts.json`
- `.claude/tools/conformance/ai_recommendations.json`
- `.claude/tools/conformance/api_metrics.json`
- `.claude/tools/conformance/ticker-load-experience.json`

`interface_conformance.py` MUST PASS against these post-rename (AC-C2) — proving the response shape,
envelope keys, and `meta.*` keys are unchanged and that no renamed backend identifier leaked into the
interface.

```json
{
  "feature": "rebrand-convexa",
  "interface_change": false,
  "new_conformance_spec": false,
  "existing_specs_must_still_pass": [
    ".claude/tools/conformance/user-accounts.json",
    ".claude/tools/conformance/ai_recommendations.json",
    ".claude/tools/conformance/api_metrics.json",
    ".claude/tools/conformance/ticker-load-experience.json"
  ],
  "byte_identical_invariants": [
    "opportunity_score",
    "opportunity_tier",
    "entry_gate",
    "state_fingerprint",
    "bundle_envelope_keys",
    "meta_keys",
    "sse_payload"
  ],
  "new_or_renamed_interface_fields": [],
  "renamed_endpoints": [],
  "backend_touch": "cosmetic_only_labels_and_prose_no_serialized_change",
  "verification": "interface_conformance.py PASS against the existing specs; known score + state_fingerprint reproduced identical (AC-C1/AC-C2)"
}
```
