# INTERFACE CONTRACT — Ghost-Trade Tracker · AI Reassessment · Opportunity Escalation

> The single source of FE↔BE integration truth. Both execution contracts bind to THIS file.
> Producer: Split Compressor (Session exit). Consumers: Backend + Frontend.
> Self-contained against `.claude/GAMMAFLOW_CONTEXT.md` + ARCHITECTURE_CONTRACT.md.
> Phase note: the ghost trade + decision history are a **client-local durable store** (the server
> stays stateless). The backend's job is to **expose the data the UI needs to mark/track/tier** and
> the **reassessment boundary** — it stores no per-user trade state.

## Endpoints touched
- `GET /api/ticker/{ticker}` (+ `/{ticker}`, slices) — bundle. **Additive** `market_state`/`signals`
  fields (below). Existing params unchanged; no new param required for tracking.
- **NEW — tracked-contract stats lookup** (filter-independent): resolve one option contract to its
  current stats regardless of the DTE/expiration display filter. Signature is Interface's to finalize
  (e.g. `GET /api/contract/{ticker}?expiration=&strike=&right=`); it MUST return, from the
  already-fetched snapshot (**no new vendor fetch**): `option_quote{bid,ask,mid}`,
  `greeks{delta,gamma,theta,vega}`, `iv`, `dte`. Absent option quote ⇒ `option_quote: null` (UI
  falls back to a theoretical mark) — **not an error**.
- **Reassessment boundary** — phase-1 is the **existing external-AI hand-off** (structured request
  out, structured verdict in); GammaFlow does **not** call an LLM. Any endpoint/transport for
  emitting the request and ingesting the verdict is Interface's to finalize; the **contract is the
  request/verdict shape** below. Round-trip synchrony is an operator-integration property, not a
  GammaFlow guarantee.
- `GET /api/stream/{ticker}` (SSE) — **UNCHANGED.** The mark/P/L are computed **client-side** from the
  existing `live.mid` + cached greeks. No per-trade state on the live session.

## Payload additions — bundle
```jsonc
"market_state": {
  // … existing …
  // (Provider-port amendment surfaces the option NBBO quote; consumed via the contract lookup above,
  //  not necessarily inlined per-strike in the bundle — Interface decides placement.)
},
"signals": {
  // … existing …
  "opportunity_tier": "dormant",     // "dormant" | "watch" | "actionable" | "prime"  (operator-config bands over opportunity_score + ai_eval)
  "prime_prompt_eligible": false     // bool — true only at Prime AND actionable (gates the guided sim-entry prompt)
},
"position_eval": {                    // object | null — present ONLY when the request carries an open-position context; null otherwise
  "changed": false,                  // bool — position-aware fingerprint changed since last distinct compute (alert dedupe)
  "fingerprint": "string"            // coarse, stable hash over {held contract vs walls/flip, P/L band, DTE band, tier}
}
```
- `opportunity_tier` / `prime_prompt_eligible` MAY instead be FE-derived from `opportunity_score`
  bands + `ai_eval.ready/changed` if Interface prefers; if so, the band config must still be
  operator-controlled. Either way the **tier vocabulary is fixed**: `dormant|watch|actionable|prime`.
- `position_eval` is the sibling of `ai_eval` (Q5): it does **not** alter the entry gate's
  semantics. How the open-position context reaches the server for `position_eval` (query/body) is
  Interface's call; absent context ⇒ `position_eval: null`.

## Tracked-contract stats (consumed shape)
```jsonc
{
  "ticker": "TSLA", "expiration": "YYYY-MM-DD", "strike": 250, "right": "call",
  "option_quote": { "bid": 0, "ask": 0, "mid": 0 },   // object | null (null ⇒ no live quote)
  "greeks": { "delta": 0, "gamma": 0, "theta": 0, "vega": 0 },  // numbers | null per greek
  "iv": 0,                                            // number | null
  "dte": 0                                            // int
}
```
- Selected from the **full snapshot** (filter-independent) — a tracked contract keeps resolving even
  when outside the current display window. **No new vendor fetch** (blocks precedent).

## Reassessment request / verdict (boundary shape)
```jsonc
// Request (assembled by GammaFlow from durable + cached lanes; an extension of the strategy hand-off)
"reassessment_request": {
  "trade": { "ticker","expiration","strike","right","side":"long","qty","entry_mark","entry_time" },
  "market_state": { /* current bundle market_state */ },
  "decision_digest": [ /* recent DecisionRecord summaries */ ]
}
// Verdict (ingested)
"recommendation": {
  "verdict": "Hold",                 // "Hold" | "Trim" | "Add" | "Exit" | "Roll"
  "replacement_contract": null,      // object | null — present only for "Roll" (expiration,strike,right); MUST be a contract in the current snapshot (Q9)
  "rationale": "string",
  "verdict_id": "string",            // stable id for dedupe + decision history
  "status": "ready"                  // "pending" | "ready" | "failed"
}
```
- **No auto-apply.** The verdict is surfaced; the FE applies a mapped change only on user **Accept**.
- **Add** carries no special field, but the FE enforces the **operator cap** on the qty increase.
- **Roll** `replacement_contract` must exist in the current snapshot; if not, the FE defers/rejects
  the Roll until a refresh prices it (Q9) — not an error.

## Durable store (client-owned; named here for the export/back-test seam)
The FE owns and persists `GhostTrade` + append-only `DecisionRecord[]`, **versioned + exportable**.
The server does not store them in v1. The export format is the FE's, but each `DecisionRecord` MUST
capture (Q13): `event_type`, `clock_time` (supplied "now"), full contract identity + `qty`,
`mark_price` + `mark_basis` (`snapshot|modeled|theoretical|last_known`), `underlying_spot`,
`pl_dollar`, `pl_pct`, `ai_verdict?`, `verdict_id?`, `user_choice?`, `tier`, `position_fingerprint`,
`schema_version`.

## Error / isolation semantics (binding)
- **Best-effort, isolated:** the tracked-contract lookup, `position_eval`, tiering, and the
  reassessment boundary are all non-critical. Any failure yields a `null`/"unavailable" for that area
  only; `market_state` + `strike_profile` (the GEX chart arrays) + the rest of the bundle stay intact.
  **None may turn a 200 bundle into an HTTP error.** Cold-start (no bundle ever) is the only blank.
- **No new SSE field, no per-trade SSE state** — isolation by construction (Q2). The mark/P/L are
  client-side; on a live-stream drop they degrade with the existing `live`/`market_session` semantics
  and the durable trade record never blanks.
- **No real-order path exists anywhere in the API** this phase (sim-only).
- **Provider-port amendment:** add an **optional option NBBO quote** (bid/ask → mid) to the
  per-contract option in the provider port; the Massive adapter maps `last_quote` (no new request);
  every adapter honors it; absent ⇒ theoretical-mark fallback, never an error.

---

## Backend resolution amendment (transports finalized — unblocks the FE lane)

> Filed by the Backend Executioner. The three "Interface's to finalize" transports + the tier
> source were left open (see `INTERFACE_AMENDMENTS_REQUESTED.md`). The backend implementation pins
> them to concrete, contract-compliant choices below; these are now **binding**. Additive only — no
> previously-specified shape changes, so nothing the FE had already assumed is broken.

**1. Tracked-contract stats endpoint — FINAL.**
`GET /api/contract/{ticker}?expiration={YYYY-MM-DD}&strike={number}&right={call|put}` (`c`/`p` also
accepted; `right` lower-cased). Returns the **bare object** of the §"Tracked-contract stats" shape
(same envelope style as `/api/market-data`, `/api/strike-profile` — not wrapped). Presence:
- Contract **not in the snapshot** → **HTTP 404** (FE → "tracking unavailable").
- Contract **present, no NBBO** → **200** with `option_quote: null` (FE → theoretical mark; not an
  error). `mid = round((bid+ask)/2, 4)` and is present only when **both** sides exist.
- Unpriced contract (no greeks) → `greeks.*: null`, `iv: null`; still 200.
- Bad `right` → 422. Resolved from the **full snapshot** (filter-independent); no new vendor fetch.

**2. Reassessment transport — FINAL = option (a), operator-mediated artifact.** No endpoint
round-trip. The request/verdict **shapes are unchanged**; the hand-off spec is
`prompts/reassessment_prompt.md` (sibling of `strategy_prompt.md`). The FE assembles the copyable
`reassessment_request` from data it already holds (durable trade + bundle `market_state` + decision
digest), the operator runs the AI externally, and the FE ingests a pasted `recommendation`.
`recommendation.status ∈ {pending|ready|failed}` stays in the shape for the operator integration; in
phase-1 the FE treats a pasted verdict as `ready`. (A future endpoint/webhook can implement the same
boundary without changing these shapes.)

**3. `opportunity_tier` / `prime_prompt_eligible` — FINAL = backend-emitted.** The bundle emits
`signals.opportunity_tier` + `signals.prime_prompt_eligible`; the FE **consumes** them (no FE-side
band math, no band-config field needed). Bands are **operator env config on the backend**:
`TIER_WATCH_SCORE` (25), `TIER_ACTIONABLE_SCORE` (= `GATE_SCORE`, 50), `TIER_PRIME_SCORE` (75); Prime
additionally requires `ai_eval.ready`. Computed at **serve time** so Prime is forced off on stale
data. `prime_prompt_eligible == (opportunity_tier == "prime")`.

**4. `position_eval` delivery — FINAL = query params on the bundle route.**
`GET /api/ticker/{ticker}?pos_expiration={YYYY-MM-DD}&pos_strike={number}&pos_right={call|put}&pos_pl_pct={number}`.
All of expiration/strike/right present ⇒ `position_eval` is computed (P/L% optional, only sharpens
the band); any missing ⇒ `position_eval: null`. `changed` is the **raw** de-dupe (mirrors
`ai_eval.changed`: flips once when the position fingerprint moves); **stale/overnight alert
suppression is the FE's job** (UX §E), not gated server-side. The FE MAY instead de-dupe on its own
client fingerprint and ignore `position_eval` — both are supported.
