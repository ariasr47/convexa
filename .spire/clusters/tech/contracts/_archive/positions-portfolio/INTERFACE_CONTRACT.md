# INTERFACE CONTRACT — Positions Portfolio (FE↔BE truth)

> Produced by compressor #3 (Split Context). Reader has ONLY `PROJECT_CONTEXT.md` + this file.
> Binding integration truth for both lanes.

## Posture: `NO_BACKEND_CHANGE`

This feature is **frontend-only**. It introduces **no new endpoint** and **no new payload field**.
The Simulated portfolio is built entirely on **existing, already-conformant** backend surface:

1. **`GET /api/contract/{ticker}`** — the filter-independent tracked-contract lookup (client
   `fetchTrackedContract`). Consumed per position-row for the running mark, entry-fill resolution
   (market/limit/manual contract-stats), and the resting-limit cross.
2. **SSE `GET /api/stream/{ticker}`** — the live payload (client `streamTicker` → `LiveUpdate`).
   Consumed for the live underlying `mid`, the live/closed session classification, and the
   transport-drop watchdog.

Because **no new backend field is introduced**, no new `## Conformance spec` is required here — the
FE consumes an existing surface that `interface_conformance.py` already verifies against the
ghost-trade interface. The spec block below is provided **for reference only**, restating the exact
existing field paths the portfolio FE binds to (system-1 may treat it as the existing endpoints'
spec; it adds no new required field).

## Fields the FE consumes (existing — names, types, presence)

### `GET /api/contract/{ticker}?expiration=&strike=&right=` → `TrackedContract | null`
- `ticker: string`, `expiration: string` (YYYY-MM-DD), `strike: number`, `right: 'call'|'put'`
- `option_quote: { bid: number; ask: number; mid: number } | null` — **null ⇒ no NBBO** ⇒ FE uses a
  theoretical (Black-Scholes) mark, **not** an error.
- `greeks: { delta: number|null; gamma: number|null; theta: number|null; vega: number|null }`
- `iv: number | null`, `dte: number`
- **404** ⇒ contract not in snapshot ⇒ FE renders that row **"unavailable"** (per-row isolation), the
  client returns `null`. Other non-2xx ⇒ throw ⇒ same per-row "unavailable" treatment.

### SSE `GET /api/stream/{ticker}` → `LiveUpdate` (per payload)
- `mid: number|null`, `bid: number|null`, `ask: number|null`, `spread: number|null`
- `live: boolean` — true only if a real tick arrived recently (the cross / modeled-mark gate)
- `market_session: string` — `premarket|regular|afterhours|overnight|closed`
- `gamma_flip: number|null`, `net_flow: number`, `flow_window_s: number`, `ts: number`, `feed: string`
- **Transport drop** = no payload for > `STREAM_OFFLINE_MS` (15s) after first payload ⇒ FE flips
  `streamOffline` (live cells degrade; resting limits stop evaluating). The next payload clears it.

### Existing bundle context (unchanged)
- `getTicker(...).position` (the `pos_*` query → `position_eval`) stays **single-position**, describing
  at most the **focused ticker's** position (Q-G). It is a dedupe/changed convenience, **never** a
  scoring input. The portfolio adds **no** new position params and feeds nothing to scoring.

## Conformance spec (reference only — existing endpoints; no new required field)
```json
{
  "GET /api/contract/{ticker}": {
    "_note": "NO_BACKEND_CHANGE — existing endpoint; FE consumes these existing paths. 404 => null.",
    "ticker": "string",
    "expiration": "string",
    "strike": "number",
    "right": "string",
    "option_quote": "object|null",
    "option_quote.bid": "number?",
    "option_quote.ask": "number?",
    "option_quote.mid": "number?",
    "greeks.delta": "number|null",
    "greeks.gamma": "number|null",
    "greeks.theta": "number|null",
    "greeks.vega": "number|null",
    "iv": "number|null",
    "dte": "number"
  },
  "SSE /api/stream/{ticker}": {
    "_note": "NO_BACKEND_CHANGE — existing SSE payload; FE consumes these existing paths.",
    "mid": "number|null",
    "live": "boolean",
    "market_session": "string",
    "gamma_flip": "number|null",
    "spread": "number|null",
    "net_flow": "number",
    "ts": "number"
  }
}
```

## Persistence (FE-local, NOT a backend surface)
Positions, decision history, customization, and saved views persist in the **client-local durable
store** (`localStorage`, versioned; v1→v2 migration). This is **not** a server contract — no
server-side or cross-device persistence is introduced.

## Binding constraints
`[no-real-order-path]` · `[additive-keeps-score-byte-identical]` · `[best-effort-isolated-or-null]` ·
`[live-vs-static-isolation]` — see PRODUCT_CONTRACT / ARCHITECTURE_CONTRACT §6. No code path places a
real order; positions never feed signals/score/tier/fingerprint.
</content>
