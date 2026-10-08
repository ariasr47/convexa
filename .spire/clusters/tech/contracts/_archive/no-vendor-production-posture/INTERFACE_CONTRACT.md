# no-vendor-production-posture — INTERFACE_CONTRACT

This restates SPEC §2 B2–B5 in machine-checkable form. SPEC is the prose source, and this file adds no
field.

- **Live mode (`MARKET_DATA_MODE` unset or `live`):** every route keeps its existing contract. The only
  additions are `market_data: "live"` on `/api/health` and on `/api/scan`, and the optional
  `AppErrorBody.code`, which live mode never sets.
- **Paused mode:** the block below.

## Paused-mode wire facts

- **The paused reply:** HTTP **503**, body exactly `{"detail":"Market data is paused.","code":"market_data_paused"}`.
  - It goes out with no outbound vendor attempt, on every B2 route.
  - The two SSE routes also carry their pre-existing `Retry-After: 30` header. Clients must not honour it
    for this code (SPEC F2b).
- **`POST /api/recommendation/{ticker}`** gives the same paused reply for signed-in callers (SPEC GATE Z
  amendment 1). It needs a session and a body, so the integration test covers it instead of the
  anonymous block below.
- **`GET /api/health`** carries `market_data: "paused"`, `warm.enabled: false` and `scanner.enabled: false`.
- **`GET /api/scan`** carries the persisted rows and `market_data: "paused"`. Scan history is served as
  before.

## Conformance spec

Run against a PAUSED backend only. It is not in the nightly production set: `conformance.yml` names its
specs explicitly.

```json
{
  "endpoints": [
    {"method": "GET", "path": "/api/health", "expect_status": 200,
     "required": {"status": "string", "market_data": "string", "warm.enabled": "boolean", "scanner.enabled": "boolean"}},
    {"method": "GET", "path": "/api/scan", "expect_status": 200,
     "required": {"market_data": "string", "rows": "array", "view": "object", "sweep": "object|null"}},
    {"method": "GET", "path": "/api/scan/{symbol}/history", "path_params": {"symbol": "SPY"}, "query": {"limit": 3}, "expect_status": 200,
     "required": {"samples": "array", "basis": "string"}},
    {"method": "GET", "path": "/api/ticker/{ticker}", "path_params": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/ticker/{ticker}/progressive", "path_params": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/market-data", "query": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/signals", "query": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/strike-profile", "query": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/candidates/{ticker}", "path_params": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/contract/{ticker}", "path_params": {"ticker": "SPY"}, "query": {"expiration": "2026-10-16", "strike": 500, "right": "call"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/stream/{ticker}", "path_params": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/stream/prices", "query": {"symbols": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/recommendation/export/{ticker}", "path_params": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}},
    {"method": "GET", "path": "/api/recommendation/status/{ticker}", "path_params": {"ticker": "SPY"}, "expect_status": 503,
     "required": {"detail": "string", "code": "string"}}
  ]
}
```
