# session-chain-archive — interface contract

**Spec:** `.spire/clusters/tech/contracts/session-chain-archive/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio)
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume these endpoints
**Status:** draft — written at R4 alongside `SPEC.md`; S2 pass-1 repair

This feature **adds backend surface**. It is **not** `NO_BACKEND_CHANGE`.

Archive **write** is an off-path side-effect after a successful ring append inside
`capture_into` / `spawn_capture` — not a trader HTTP write route. Research **list** and **load**
are new operator/research GET surfaces under `/api/_research/session-books/...`, extending the live
`/api/_research/chain-snapshots/...` pattern in `routes/research_chain_snapshots.rs`. Do **not**
invent Massive hist-chain / point-in-time vendor endpoints. Do **not** mount session-archive browse
or blob redistribution on trader routes. Do **not** rewrite Path-B / `batch-backtest` /
`replay-outcome-join` CLIs in this ship. Do **not** rewrite the ring research vehicle or its miss
`detail`.

Human-facing framing and closed vocabulary live in `SPEC.md` §4. This file owns **transport and
bytes**.

---

## Standing rules

1. **Zero vendor I/O on research read.** List and load never call Massive fetch methods, never
   “refresh if missing,” and never warm trader caches as a side effect.
2. **Store outcome classes are closed:** `hit` · `miss` · `error`. Session miss ≠ ring miss ≠
   not-storing ≠ unreadable ≠ list store-error.
3. **`vendor_called` is always `false`** on successful handling of these endpoints (including miss).
   A `true` value is a defect — asserted by unit / GATE Q tests (conformance JSON types check
   presence/type only).
4. **License + edge isolation:** responses are research corpus — not a trader market-data product.
   Paths stay under `/api/_research/` and are **Railway-direct operator** surfaces. The Cloudflare
   Pages trader origin (`*.pages.dev`) must **404** `/api/_research` and `/api/_research/*` the
   same way `functions/api/[[path]].ts` already 404s `/api/_metrics`.
5. **Auth posture (Railway-direct):** when `METRICS_SECRET_TOKEN` is set, require the same bearer /
   `X-Metrics-Token` gate used by `GET /api/_metrics`. When unset (local), endpoints are open.
   These are **not** session-cookie trader gates — do not mark `"auth": true`.
6. **Archive write is not an HTTP API** in this contract. Conformance checks research list/load only.
7. **Symbol normalization:** path `symbol` is upper/trim-normalized server-side (same family as
   chain-snapshot research).
8. **Session identity:** `(symbol, et_date)` where `et_date` is America/New_York `YYYY-MM-DD`
   derived from ring `as_of: DateTime<Utc>` by the same New_York calendar rule as
   `session_date_et` (applied on the `DateTime`, not via a non-positive `f64` bridge). Provenance
   field **`source_as_of`** is RFC 3339 UTC (fractional seconds preserved from the ring capture)
   and is **mandatory on every successful load** — it is not the identity key (owner ruling A).
9. **Lineage vs live-market claim:** wire field `source` is the closed enum `live_massive` ·
   `fixture`. That token is required provenance. It is **not** a Live badge.
10. **Score posture:** successful hit envelopes carry `authorizes: "nothing"`. Miss/404 envelopes
    are detail-only and are not required to repeat `authorizes`.
11. **Sibling path:** Json archive defaults to `data/session_chain_archive` via
    `SESSION_CHAIN_ARCHIVE_STORE_PATH`; must not equal or nest under `chain_snapshot_store_path`.
    Enable dial `SESSION_CHAIN_ARCHIVE_ENABLED` defaults **true**.

---

## Closed wire vocabularies

| Token | Members |
| --- | --- |
| `store` | `hit` · `miss` · `error` |
| `source` | `live_massive` · `fixture` |
| Miss `error` code (load) | `no_session_book` |
| Not-storing `error` code | `session_archive_not_storing` |
| Unreadable `error` code (load only) | `session_book_unreadable` |
| List store-fault `error` code | `session_archive_store_error` |
| List miss `detail` | exactly `no session book for <SYMBOL>` |
| Load miss `detail` | exactly `no session book for <SYMBOL> on <ET_DATE>` |
| Not-storing `detail` | exactly `session archive not storing` |
| Unreadable `detail` (load) | `session book unreadable: <reason>` |
| List store-fault `detail` | `session archive store error: <reason>` |
| Hit `framing` | `RESEARCH READ — SESSION BOOK` |
| List miss `framing` | `RESEARCH READ — NO SESSION BOOK` |
| Hit `provenance` | `loaded from session archive · no vendor call` |
| License | `Our research · not redistributed on a trader route.` |
| `authorizes` (hit) | exactly `nothing` |

**Ring vehicle (unchanged — cite only):** empty/pruned ring list miss `detail` remains the live
string from `research_chain_snapshots.rs` `miss_detail`: **`no stored snapshot for <SYMBOL>`**
(dated: `… at <as_of>`). Session-book endpoints emit session miss strings only. Do **not** invent
or require `empty 48-ring for <SYMBOL>` anywhere — that phrase is not live copy and must not
regress `chain-snapshot-capture`.

Operator-visible miss **detail** binds to closed copy on **both** session list miss and load 404.
Do not ship a competing “none for this ticker” string. Exact closed string values are asserted by
unit / GATE Q tests; the conformance JSON block below checks shape/presence.

---

## Endpoints

### 1. `GET /api/_research/session-books/{symbol}` — **NEW** · research list

List session-archive identities for one symbol. **No Massive call.**

**Path params:** `symbol` (string).

**Query:**

| Param | Type | Notes |
| --- | --- | --- |
| `limit` | number \| omitted | Optional. When set, must be `>= 1` or **400** `invalid_limit` (same family as ring list). Returns the newest `limit` rows after sorting. |

**Ordering:** `books[]` sorted by `et_date` **ascending**. When `limit` is set and the store has
more rows, keep the **last-N** (newest) after that sort — same shape as ring list’s last-N after
`as_of` ASC.

**Response (200)** — always shaped when the archive store is enabled; empty archive is honest empty,
not an error:

| Path | Type | Notes |
| --- | --- | --- |
| `symbol` | string | Normalized symbol |
| `count` | number | `books.length` (page length; equals store count when `limit` omitted) |
| `books` | array | May be empty |
| `books[].symbol` | string | |
| `books[].et_date` | string | ET `YYYY-MM-DD` session identity |
| `books[].source_as_of` | string | RFC 3339 UTC provenance of the archived capture |
| `books[].source` | string | Closed `source` enum |
| `store` | string | `hit` when `count > 0`; `miss` when `count === 0` |
| `detail` | string \| null | **Required on miss:** exactly `no session book for <SYMBOL>`. On hit: `null` |
| `vendor_called` | boolean | Always `false` |
| `framing` | string | Hit: `RESEARCH READ — SESSION BOOK`. Miss: `RESEARCH READ — NO SESSION BOOK` |
| `provenance` | string | Hit: `loaded from session archive · no vendor call`. Miss: `no vendor call` |
| `license` | string | Research-not-trader-redistribution one-liner |
| `authorizes` | string | Exactly `nothing` |

There is **no** loading field or phase line — HTTP is request/response only.

**Errors:**

- `400` when `limit` is present and `< 1`: `error: invalid_limit`, `detail: limit must be >= 1`,
  `vendor_called: false`.
- `401` when metrics/research token required and missing/wrong (same shape family as `_metrics`).
- Store disabled / unavailable: `500` with `error: session_archive_not_storing`, `store: error`,
  `detail: session archive not storing`, `vendor_called: false` — never a vendor fetch; never
  presented as miss.
- Other list metadata / I/O fault: `500` with `error: session_archive_store_error`, `store: error`,
  `detail: session archive store error: <reason>`, `vendor_called: false` — **not**
  `session_book_unreadable` (that class is load-only: identity present, body bad).

---

### 2. `GET /api/_research/session-books/{symbol}/book` — **NEW** · research load

Load one session book by identity. **No Massive call.**

**Path params:** `symbol` (string).

**Query:**

| Param | Type | Notes |
| --- | --- | --- |
| `et_date` | string | **Required.** ET calendar date `YYYY-MM-DD` (America/New_York session identity) |

**Response (200)** — store hit (typed fixture-symmetric body; enough to replay GEX via
`compute_analytics_from_vendor`):

| Path | Type | Notes |
| --- | --- | --- |
| `symbol` | string | |
| `et_date` | string | ET `YYYY-MM-DD` identity |
| `source_as_of` | string | **Mandatory.** RFC 3339 UTC capture provenance (not the identity) |
| `source` | string | Closed `source` enum |
| `store` | string | Always `hit` on 200 |
| `vendor_called` | boolean | Always `false` |
| `framing` | string | `RESEARCH READ — SESSION BOOK` |
| `provenance` | string | `loaded from session archive · no vendor call` |
| `license` | string | Research license one-liner |
| `authorizes` | string | Exactly `nothing` |
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

No is/is-not prose block and no separate payload-confirmation member on the wire — standing fields
above plus the typed body are the v1 surface.

**Response (404)** — miss (never archived for that identity):

| Path | Type | Notes |
| --- | --- | --- |
| `error` | string | `no_session_book` |
| `detail` | string | `no session book for <SYMBOL> on <ET_DATE>` |
| `symbol` | string | |
| `et_date` | string | Echo of requested identity |
| `store` | string | `miss` |
| `vendor_called` | boolean | Always `false` |

404 is detail-only — no `framing` / `license` / `authorizes` required (AC-23 applies to hit
envelopes).

**Other errors:**

- **`422`** when `et_date` missing or unparseable (same family as ring load’s required/unparseable
  `as_of` → `UNPROCESSABLE_ENTITY`) — body includes `error` / `detail` / `vendor_called: false`;
  no vendor fetch. Do **not** use 400 for this case.
- `401` when token required and missing/wrong.
- `500` store disabled: `error: session_archive_not_storing`, `store: error`,
  `detail: session archive not storing`, `vendor_called: false`.
- `500` identity present but unreadable: `error: session_book_unreadable`, `store: error`,
  `detail: session book unreadable: <reason>`, `vendor_called: false` — **no** live Massive
  recovery.

---

## Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Any Massive `/v3/...` hist-chain / PIT proxy | Out of BRIEF; different product line |
| `POST/PUT` trader archive controls | Archive is automatic off-path first-wins copy |
| Trader bundle/SSE fields advertising session archive | `[operator-vs-trader-path-separation]` |
| Overload of `GET /api/_research/chain-snapshots/...` as session identity | Ring identity is `(symbol, as_of)`; session identity is `(symbol, et_date)` — sibling routes |
| Rewrite of ring miss `detail` | Live `no stored snapshot for <SYMBOL>` stays; do not invent `empty 48-ring for <SYMBOL>` |
| Overload of `GET /api/scan/{symbol}/history` as raw-chain / session history | Digested structure diary |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must 404 like `_metrics`; Railway-direct only |
| Path-B / batch-backtest / replay-outcome-join CLI rewrite | Existence + dedicated research list/load only this ship |

**Hit-probe seeding:** the load-200 conformance entry below assumes a **dedicated archive plant**
(not ring `CONFORMANCE_SEED_AS_OF`) at identity **`(SPY, 2020-01-02)`** with
`source_as_of = 2020-01-02T17:00:00.000000001Z` before a live run. That UTC instant’s
America/New_York calendar date is `2020-01-02` under the cited New_York rule. GATE Q plants that
row (or marks the probe UNVERIFIABLE if the seed step cannot run). Sample-mode still validates the
required shape. Do **not** plant via archival of `1970-01-01T00:00:00.000000001Z` expecting
`et_date=1970-01-01`.

---

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "store": "string",
        "detail": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": { "et_date": "2000-01-01" },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "SPY" },
      "query": { "et_date": "2020-01-02" },
      "expect_status": 200,
      "required": {
        "symbol": "string",
        "et_date": "string",
        "source_as_of": "string",
        "source": "string",
        "store": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
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
- **List miss without closed `detail`** — AC-7/AC-8 have no home; empty ticker cannot be verified.
- **Miss path not 404 / wrong body** — silent vendor fill-in, substitution of another date, or
  collapse of miss into an empty chain book shape.
- **Hit 200 missing `source_as_of`** — owner ruling A broken; morning first-wins provenance invisible.
- **Hit 200 missing GEX-replay fields** — slim DTO that cannot feed `compute_analytics_from_vendor`.
- **`vendor_called` mistyped or absent** — the zero-vendor-on-read invariant is no longer
  machine-checkable on the wire shape (exact `false` is a unit/GATE Q assert).
- **Disabled store returned as miss** — `session archive not storing` collapsed into `no session book`.
- **List I/O returned as `session_book_unreadable`** — list store-error aliased into load-only class.
- **Unreadable returned as miss or not-storing** — four-outcome honesty broken.
- **Fan-out on empty `books[]`** — vacuous pass is correct for a fresh store; a FAIL on element
  shape when elements exist means list metadata drifted from archive identity.
- **Pages proxy serving `_research`** — trader-origin redistribution; `_metrics` posture incomplete.
- **Seeded load using ring `CONFORMANCE_SEED_AS_OF` → `et_date=1970-01-01`** — identity the cited
  New_York / `session_date_et` rule cannot produce from that `as_of`.
