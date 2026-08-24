# chain-snapshot-local-store — interface contract

**Spec:** `.spire/clusters/tech/contracts/chain-snapshot-local-store/SPEC.md`
**Backend:** `apps/api` — explicit filesystem selection for the existing `ChainSnapshotStore`
**Frontend:** `NO_UI_CHANGE`

## Interface impact

No HTTP endpoint, method, query parameter, field, status, auth rule, or streaming behavior changes.
This contract re-pins the existing operator research snapshot list/load surface across the physical
storage cutover. `CHAIN_SNAPSHOT_BACKEND=filesystem|disabled` and
`CHAIN_SNAPSHOT_STORE_PATH=/data/chain_snapshots` are backend runtime dials
and never appear on the wire.

## Standing rules

- Research list/load performs zero Massive calls on hit, miss, unreadable, or store error.
- Physical storage location is not returned to clients.
- The existing hit/miss/error envelope taxonomy and exact replay body remain authoritative.
- Routes remain operator/research-only and are not linked from or redistributed through the trader
  origin.
- Backend choice does not authorize deletion or mutation of legacy Postgres rows.

## Endpoints

| Method | Path | Purpose | Auth | Errors | Streaming |
|---|---|---|---|---|---|
| GET | `/api/_research/chain-snapshots/{symbol}` | List retained snapshot metadata for one symbol without loading bodies or calling Massive. | Existing metrics/research token when configured | Existing shaped miss/store errors | none |
| GET | `/api/_research/chain-snapshots/{symbol}/snapshot?as_of=...` | Load one retained full replay body without calling Massive. | same | Existing 404 miss, validation, and store errors | none |

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "snapshots": "array",
        "snapshots[].symbol": "string",
        "snapshots[].as_of": "string",
        "snapshots[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "snapshots": "array",
        "store": "string",
        "detail": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}/snapshot",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": { "as_of": "2000-01-01T00:00:00.000000000Z" },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}/snapshot",
      "path_params": { "symbol": "SPY" },
      "query": { "as_of": "1970-01-01T00:00:00.000000001Z" },
      "expect_status": 200,
      "required": {
        "symbol": "string",
        "as_of": "string",
        "source": "string",
        "store": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "market": "object",
        "market.ticker": "string",
        "market.synchronized_spot": "number",
        "market.current_spot": "number",
        "market.timestamp": "number",
        "market.atm_iv": "number",
        "market.atm_iv_expiration": "string|null",
        "market.atm_iv_dte": "number|null",
        "market.market_phase": "string",
        "market.contracts": "array",
        "daily_bars": "array",
        "minutes": "array",
        "trades": "array"
      }
    }
  ]
}
```

## What a failure means

- A missing/reshaped field means storage placement leaked into the API contract.
- A read that calls Massive violates the zero-vendor research boundary.
- A hit that cannot replay the full typed body means the filesystem adapter is not behaviorally
  equivalent.
- A trader-origin route or storage-location field violates operator/trader separation.
