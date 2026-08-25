# capacity-baseline — interface contract

This is backend/test tooling. It adds no public, trader or operator HTTP surface and changes no generated client contract. The harness exercises the existing production router in a fixture-only child process; normal production clients continue to see the same routes and wire shapes.

## Existing endpoints exercised and preserved

### `GET /api/ticker/{ticker}` — existing, anonymous, JSON

Purpose: return the existing full ticker bundle for one requested symbol. The harness uses deterministic fixture symbols and the existing query/cache path to measure cold, warm, coalesced and shared-capacity behavior.

- Auth: none.
- Success: existing `200 application/json` `MarketWire`/ticker-bundle shape.
- Existing errors remain unchanged: `404`, `422`, `500`, `502` or `503` with the existing `{ "detail": string }` application-error envelope as applicable.
- No capacity field, report field, fixture marker, test flag or harness state appears in the response.
- Scoring, tier, entry gate, fingerprint, recommendation data, gamma-source meaning and cache semantics remain unchanged.

### `GET /api/stream/{ticker}` — existing, anonymous, SSE

Purpose: return the existing `text/event-stream` live-update stream for one underlying. The harness uses a non-network event producer behind the private child assembly to measure connect, hold, configured-cap refusal, orderly close, abrupt drop and post-drain recovery through the real socket/route lifecycle.

- Auth: none.
- Accepted stream: existing `200 text/event-stream`; event shape remains `LiveUpdateBody` with required `ticker`, `net_flow`, `buy_vol`, `sell_vol`, `flow_window_s`, `spot_ts`, `live`, `market_session`, `feed`, and `ts`, plus the existing nullable price/quote/flip fields.
- Existing pre-stream errors remain unchanged. Capacity refusal is the existing `503 application/json` body `{ "detail": "Live streaming is at capacity. Try again shortly." }` with `Retry-After: 30`.
- No new SSE event type, field, heartbeat meaning, cap semantics, reconnect behavior or trader-visible stream behavior is introduced.
- The finite JSON conformance runner does not subscribe to or hold SSE. SSE content and lifecycle are therefore verified by the capacity harness and existing route-level SSE tests, while the machine-checkable block below pins the existing JSON production route the same feature exercises and preserves.

## Harness-only interfaces

- Commands: `npm run capacity:baseline` (`normal`) and `npm run capacity:baseline:extended` (`extended`).
- Externally runnable controls: `npm run capacity:baseline:self-test:connector-poison`, `npm run capacity:baseline:self-test:optional-fault`, and `npm run capacity:baseline:self-test:byte-identity`. They select private CLI self-test cases and add no HTTP query, header, route or production environment switch.
- Reports: `apps/api/data/capacity/capacity-baseline-normal.json` and `apps/api/data/capacity/capacity-baseline-extended.json`.
- Self-test receipts: `apps/api/data/capacity/self-tests/connector-poison.json`, `optional-fault.json`, and `byte-identity.json`. Each outer receipt passes only when its healthy control and expected failing control both behave exactly as contracted.
- Child control: an inherited process channel carries readiness, per-child active-request/subscriber/SSE-task and resource snapshots, forbidden-connector audit counts and graceful-shutdown acknowledgement. The fixed A/B/C/D1/D2/D3/E child identities remain alive through the shared 30-second recovery checkpoint; E is one child reused sequentially for both isolation controls. It is never bound as HTTP, SSE, WebSocket or a production listener.
- The child binds only an ephemeral `127.0.0.1` listener, accepts fixture/mock providers and temporary/local stores, and is unreachable through normal `serve` configuration.

The optional-computation target is exactly `market_state.iv_rank`. The private fault case injects a failing IV-store read adapter into the fixture child. The existing ticker route still returns HTTP 200, serializes `market_state.iv_rank` as null, and retains the normal required `ai_eval` object with `ready` and `state_fingerprint`; `ai_eval` is not the optional computation and must not be removed, nulled or weakened. The healthy control returns an IV-rank object from the committed history fixture. The fault control is unavailable to normal `serve` and is never expressed on the public wire.

The committed before/current-revision protocol lives at `apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json`, pinned to pre-feature revision `c30ed8151b82f847fd75552528dcba30bdca5ae8`. The manifest hashes the fixture inputs and `before/` oracles and owns the closed runtime-metadata exclusion list. It also pins the exact five-path API-contract artifact inventory and base SHA-256 values specified in SPEC §2.1: the pre-cutover 52-operation baseline, generated OpenAPI, parity coverage, generated-artifacts manifest and generated TypeScript schema. The self-test runs the existing `npm run api:contract:check` unchanged, records its result and every artifact's base/current digest, then recursively compares the exact descendant-entry inventory below `libs/api/src/generated/` (only `schema.ts` at baseline). Added files, directories or symlinks are listed and fail. The byte-identity self-test records the current revision/tree digest and compares current fixture bytes without updating or accepting any baseline.

## Error and isolation semantics

- Expected fixture absence and expected cap-plus-one refusal are distinct successful observation classes in the harness; they do not redefine production status codes.
- Unexpected response/transport/disconnect errors, unavailable observations and attempted forbidden connectors fail the local harness and report. They do not change the endpoint's production error model.
- A harness/setup/report failure returns a non-zero CLI exit and a `did_not_pass` report. No harness failure is returned through a trader or operator route.
- Neither profile contacts a live vendor, production service, external database/cache, broker, LLM, OAuth provider, paid service or subscription.

## Conformance spec

The block is intentionally limited to the existing finite JSON route. It probes fixture-catalog symbol `SYN`, while the immutable byte-identity oracle separately retains its external `SPY` request and maps it to fixture symbol `SYN`. This asserts the stable public bundle floor without inventing an endpoint or claiming that an HTTP JSON probe can validate a held SSE lifecycle.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": {
        "ticker": "SYN"
      },
      "query": {
        "min_dte": "7",
        "max_dte": "45"
      },
      "required": {
        "market_state": "object",
        "market_state.ticker": "string",
        "market_state.price": "number",
        "market_state.gamma_flip": "number",
        "market_state.call_wall": "number",
        "market_state.put_wall": "number",
        "market_state.iv_rank": "object|null",
        "signals": "object",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "signals.prime_prompt_eligible": "boolean",
        "ai_eval": "object",
        "ai_eval.ready": "boolean",
        "ai_eval.state_fingerprint": "string",
        "meta": "object",
        "meta.freshness": "object",
        "meta.freshness.stale": "boolean",
        "meta.freshness.stale_after_seconds": "number"
      }
    }
  ]
}
```
