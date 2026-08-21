# chain-snapshot-capture — interface contract

**Spec:** `.spire/clusters/tech/contracts/chain-snapshot-capture/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio)
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume these endpoints
**Status:** draft — written at R4 alongside `SPEC.md`; S2 pass-1 repair

This feature **adds backend surface**. It is **not** `NO_BACKEND_CHANGE`.

Capture **write** is an off-path side-effect of in-scope fresh-vendor scan/serve cycles — not a
trader HTTP write route. Research **list** and **load** are new operator/research GET surfaces
under `/api/_research/...`. Do **not** invent Massive hist-chain / point-in-time vendor endpoints.
Do **not** mount capture browse or blob redistribution on trader routes (`/api/ticker`, `/api/scan`
desk payloads, SSE, recommendation, etc.).

Human-facing framing and closed vocabulary live in `SPEC.md` §4. This file owns **transport and
bytes** (T3).

---

## Standing rules

1. **Zero vendor I/O on research read.** List and load never call `MassiveRestClient` fetch methods,
   never “refresh if missing,” and never warm trader caches as a side effect.
2. **Store outcome classes are closed:** `hit` · `miss` · `error`. Miss ≠ empty options book.
3. **`vendor_called` is always `false`** on successful handling of these endpoints (including miss).
   A `true` value is a defect.
4. **License + edge isolation:** responses are research corpus — not a trader market-data product.
   Paths stay under `/api/_research/` and are **Railway-direct operator** surfaces. The Cloudflare
   Pages trader origin (`*.pages.dev`) must **404** `/api/_research` and `/api/_research/*` the
   same way `functions/api/[[path]].ts` already 404s `/api/_metrics` — token gate alone is not the
   `_metrics` posture.
5. **Auth posture (Railway-direct):** when `METRICS_SECRET_TOKEN` is set, require the same bearer /
   `X-Metrics-Token` gate used by `GET /api/_metrics`. When unset (local), endpoints are open.
   These are **not** session-cookie trader gates — do not mark `"auth": true` (that means signup
   session).
6. **Capture write is not an HTTP API** in this contract. Conformance checks research list/load only.
7. **Symbol normalization:** path `symbol` is upper/trim-normalized server-side (same family as
   structure history).
8. **`as_of` wire form:** ISO-8601 UTC string (RFC 3339) **with fractional seconds** preserved from
   `VendorBundle.as_of` (`DateTime<Utc>`) — not whole-second truncation, and not the digested
   structure-history `f64` clock. Two distinct paid fetches in one UTC second must serialize as two
   distinct `as_of` strings.
9. **Lineage vs live-market claim:** wire field `source` is the closed enum `live_massive` ·
   `fixture` (serde of `MarketDataSourceKind`). That token is required provenance. It is **not** a
   Live badge and must not fail honesty scans that ban live-as-market-feed presentation
   (SPEC §4 / AC-25 / §7).

---

## Closed wire vocabularies

| Token | Members |
| --- | --- |
| `store` | `hit` · `miss` · `error` |
| `source` | `live_massive` · `fixture` |
| Miss `error` code | `no_stored_snapshot` |
| Store-fault `error` code | `stored_snapshot_unreadable` |
| Miss `detail` | exactly `no stored snapshot for <SYMBOL>` (optional ` at <as_of>` on dated load miss) |
| Store-fault `detail` | `stored snapshot unreadable: <reason>` |
| Storage-unconfigured `detail` | `capture not storing` (may also appear as the `<reason>` suffix above) |

Operator-visible miss **detail** binds to closed copy on **both** list miss and load 404. Do not
ship a competing “none for this ticker” string. CLI wrappers (if shipped) read the same store /
same semantics; they are not a second conformance surface and are not a substitute for list
`detail`.

---

## Endpoints

### 1. `GET /api/_research/chain-snapshots/{symbol}` — **NEW** · research list

List dated stored chain snapshots for one symbol. **No Massive call.**

**Path params:** `symbol` (string).

**Query:** none required. Optional `limit` (number) may clamp the returned array; default returns
all rows still inside the active retention policy for that symbol (capped by store implementation
at the per-symbol retention max). When `limit` is omitted, `count` equals the in-policy store
count AC-1 uses; when `limit` is set, `count` is the returned-page length (`snapshots.length`).

**Response (200)** — always shaped; empty store is honest empty, not an error:

| Path | Type | Notes |
| --- | --- | --- |
| `symbol` | string | Normalized symbol |
| `count` | number | `snapshots.length` (page length; equals store count when `limit` omitted) |
| `snapshots` | array | May be empty |
| `snapshots[].symbol` | string | |
| `snapshots[].as_of` | string | RFC 3339 UTC with fractional seconds |
| `snapshots[].source` | string | Closed `source` enum (`live_massive` · `fixture`) |
| `store` | string | `hit` when `count > 0`; `miss` when `count === 0` |
| `detail` | string \| null | **Required on miss:** exactly `no stored snapshot for <SYMBOL>`. On hit: `null` |
| `vendor_called` | boolean | Always `false` |
| `framing` | string | Hit: `RESEARCH READ — STORED CHAIN SNAPSHOT`. Miss: `RESEARCH READ — NO STORED SNAPSHOT` (never claim STORED when `count === 0`) |
| `provenance` | string | Constant `loaded from store · no vendor call` family (miss: still no-vendor; does not imply a row exists) |
| `license` | string | Research-not-trader-redistribution one-liner |

**Errors:**

- `401` when metrics/research token required and missing/wrong (same shape family as `_metrics`).
- Store fault may return `500` with `error: stored_snapshot_unreadable`, `store: error`,
  `detail: stored snapshot unreadable: <reason>` (or `capture not storing` when storage is not
  configured), `vendor_called: false` — never a vendor fetch.

---

### 2. `GET /api/_research/chain-snapshots/{symbol}/snapshot` — **NEW** · research load

Load one stored chain snapshot by identity. **No Massive call.**

**Path params:** `symbol` (string).

**Query:**

| Param | Type | Notes |
| --- | --- | --- |
| `as_of` | string | **Required.** RFC 3339 UTC identity (fractional seconds significant) |

**Response (200)** — store hit (typed fixture-symmetric body; enough to replay GEX via
`compute_analytics_from_vendor`):

| Path | Type | Notes |
| --- | --- | --- |
| `symbol` | string | |
| `as_of` | string | RFC 3339 UTC with fractional seconds (capture clock) |
| `source` | string | Closed `source` enum |
| `store` | string | Always `hit` on 200 |
| `vendor_called` | boolean | Always `false` |
| `framing` | string | `RESEARCH READ — STORED CHAIN SNAPSHOT` |
| `provenance` | string | `loaded from store · no vendor call` family |
| `license` | string | Research license one-liner |
| `market` | object | Full `OptionsMarketState` domain on the wire |
| `market.ticker` | string | |
| `market.synchronized_spot` | number | |
| `market.current_spot` | number | |
| `market.timestamp` | number | Vendor snapshot timestamp (ns when provided) |
| `market.atm_iv` | number | Decimal IV (not wire percent) |
| `market.atm_iv_expiration` | string \| null | |
| `market.atm_iv_dte` | number \| null | |
| `market.market_phase` | string | Closed phase token (`rth` · `after_close` · `closed_pre`) |
| `market.contracts` | array | Full stored book; may be empty only if that was the stored book — never fabricated |
| `daily_bars` | array | `DailyBarWire[]`; best-effort; may be empty |
| `daily_bars[].close` | number \| null | |
| `daily_bars[].high` | number \| null | |
| `daily_bars[].low` | number \| null | |
| `daily_bars[].session` | string \| null | |
| `minutes` | array | `IntradayBarWire[]`; best-effort; may be empty |
| `minutes[].session` | string | ET `YYYY-MM-DD` |
| `minutes[].hour` | number | |
| `minutes[].minute` | number | |
| `minutes[].vw` | number | |
| `minutes[].v` | number | |
| `trades` | array | `TradePrintWire[]`; best-effort; may be empty |
| `trades[].price` | number | |
| `trades[].size` | number | |
| `trades[].timestamp_ns` | number | |
| `trades[].off_exchange` | boolean | |

**Response (404)** — miss (never captured or pruned; single miss family):

| Path | Type | Notes |
| --- | --- | --- |
| `error` | string | `no_stored_snapshot` |
| `detail` | string | `no stored snapshot for <SYMBOL>` (may include ` at <as_of>`) |
| `symbol` | string | |
| `store` | string | `miss` |
| `vendor_called` | boolean | Always `false` |

**Other errors:**

- `400` / `422` when `as_of` missing or unparseable — no vendor fetch.
- `401` when token required and missing/wrong.
- `500` store unreadable / storage not configured: `error: stored_snapshot_unreadable`,
  `store: error`, `detail: stored snapshot unreadable: <reason>` or `detail: capture not storing`,
  `vendor_called: false` — **no** live Massive recovery.

---

## Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Any Massive `/v3/...` hist-chain / PIT proxy | Out of BRIEF; different product line |
| `POST/PUT` trader capture controls | Capture is automatic off-path write-through |
| Trader bundle/SSE fields advertising capture | `[operator-vs-trader-path-separation]` |
| Overload of `GET /api/scan/{symbol}/history` as raw-chain history | That route is digested structure diary |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must 404 like `_metrics`; Railway-direct only |

CLI wrappers (if shipped) must read the same store / same semantics; they are not a second
conformance surface and do not satisfy AC-9 without HTTP list `detail`.

**Hit-probe seeding:** the load-200 conformance entry below assumes a harness-planted fixture-source
snapshot at identity `(SPY, 1970-01-01T00:00:00.000000001Z)` before a live run. GATE Q plants that
row (or marks the probe UNVERIFIABLE if the seed step cannot run). Sample-mode still validates the
required shape.

---

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

## What a FAIL here means

- **List non-200 / missing envelope** — research list route missing, mounted under a trader path, or
  reshaped without updating this contract.
- **List miss without closed `detail`** — AC-9 has no home; empty ticker cannot be verified.
- **Miss path not 404 / wrong body** — silent vendor fill-in, substitution of another date, or
  collapse of miss into an empty chain book shape.
- **Hit 200 missing GEX-replay fields** — slim DTO that cannot feed `compute_analytics_from_vendor`.
- **`vendor_called` mistyped or absent** — the zero-vendor-on-read invariant is no longer
  machine-checkable on the wire.
- **Fan-out on empty `snapshots[]`** — vacuous pass is correct for a fresh store; a FAIL on element
  shape when elements exist means list metadata drifted from append identity.
- **Pages proxy serving `_research`** — trader-origin redistribution; `_metrics` posture incomplete.
