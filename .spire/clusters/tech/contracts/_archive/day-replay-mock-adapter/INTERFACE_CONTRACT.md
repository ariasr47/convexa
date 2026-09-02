# day-replay-mock-adapter — interface contract

**Spec:** `.spire/clusters/tech/contracts/day-replay-mock-adapter/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio)
**Frontend:** `apps/dashboard` — existing ticker SSE consumer (not `NO_UI_CHANGE`); no second live path
**Status:** APPROVED 2026-08-30 — written at R4 alongside `SPEC.md`

This feature **changes backend + ticker consume surface**. It is **not** `NO_BACKEND_CHANGE`. It is **not** `NO_UI_CHANGE`.

It **does not** add playback REST, `/_ops/replay`, a second EventSource, or a Start/Stop HTTP that arms the player. Arming is clap **`session-day-replay`** (process-start exclusive construct). Operator tape **read** stays the shipped `GET /api/_research/session-day-tape/*` vehicle (token-gated; Pages 404). Coverage HTTP stays the coverage vehicle.

Human-facing literals live in `SPEC.md` §4. This file owns **transport and bytes**.

---

## Standing rules

1. **Same ticker SSE.** Path-A walks `GET /api/stream/{ticker}` (`LiveUpdate` / `LiveUpdateBody`). No second socket. No second hub the page must also subscribe.
2. **Occupancy is consume-visible.** While the construct is armed, every per-ticker SSE **JSON data** event on that process carries session-tape occupancy and **`live: false`**. Recency-true must not set `live`. Comment heartbeats and Axum KeepAlive are **not** occupancy.
3. **Vouch-before-advertise.** On a playable identity, the first `playing` keep-alive is in the occupancy slot **before** HTTP/SSE bind. Subscribe’s first `data:` already includes `session_tape`. A bound armed process never emits occupancy-less `data:`.
4. **Omitted when unset.** Occupancy object key is **absent** on production/unset payloads so S0 does not grow a permanent replay field. Do not emit `session_tape: null` as a live-looking discriminator.
5. **Zero vendor I/O on the walk.** Player reads `SessionDayTape::load` only. Tape list/load remain `vendor_called: false`. While armed, ticker REST never takes the Massive four-fetch join for **any** ticker name on that process.
6. **No playback REST.** Do not add `/api/replay`, `/api/_ops/replay`, `/api/_research/replay`, or query flags that arm, disarm, or re-identify the player.
7. **License + edge isolation.** Cloudflare Pages trader origin (`*.pages.dev`) must **404** `/api/_research` and `/api/_research/*` the same way `functions/api/[[path]].ts` already 404s `/api/_metrics`. Replayed ticks are research playback on a research/non-production process, never a hosted live vendor feed.
8. **Auth posture.** Ticker SSE and ticker REST stay **anonymous-open** (capacity 503 unchanged). Tape list/load use the metrics/research token (`health::metrics_token_ok`) when `METRICS_SECRET_TOKEN` is set — **not** a session-cookie trader gate. Do **not** mark `"auth": true` on any entry below. Operator token is not that.
9. **Score posture.** `Authorizes: nothing` on the formula. Ticker REST score/tier/fingerprint shape is a non-regression floor, not a new field list. Live G1 does not fetch ticker REST (vendor-dependent); GATE Q hermetic owns formula identity.
10. **Coverage / session-book envelopes unchanged.** Walking tape must not reshape `GET /api/_research/session-archive/coverage` or `GET /api/_research/session-books/*`, must not insert a live paid book, and must not print coverage cells on ticker SSE.
11. **`interface_conformance.mjs` live fetch cannot subscribe SSE.** Live G1 checks the HTTP endpoints in `## Conformance spec`. Occupancy field presence is GATE Q hermetic + `--sample` of one SSE `data:` JSON object against the `sse_data_event` map in that same block. The live typespec for armed `live` is `boolean`; GATE Q asserts the value is JSON `false`.

---

## Closed wire vocabularies

| Token | Members / exact strings |
|---|---|
| Occupancy object key | `session_tape` — **present** only while armed; **omitted** when unset |
| `session_tape.phase` | `playing` · `gap` · `ended` · `drop` · `fault` |
| `session_tape.pace` | number `1` · `4` · `10` only |
| `session_tape.et_date` | America/New_York `YYYY-MM-DD` |
| `session_tape.tape_time_et` | `HH:MM:SS` when vouched; JSON `null` when not vouched |
| Envelope `live` while armed | JSON `false` on every data payload (keep-alive, tick, gap, ended, drop, fault) |
| Envelope `live` when unset | today’s recency bit (`tick_age < 30s` wall) |
| Envelope `feed` while armed | closed token **`session_tape`** — never `live_massive` |
| Envelope `feed` when unset | today’s config `data_feed` |
| Envelope `market_session` while armed, cursor vouched | America/New_York bucket of **tape** stamp (`premarket` \| `regular` \| `afterhours` \| `overnight` \| `closed`) |
| Envelope `market_session` while armed, `tape_time_et` null | closed token **`session_tape`** — not wall `Utc::now()` |
| Envelope `market_session` when unset | wall `Utc::now()` America/New_York (same buckets) |
| Path-B bundle source discriminant (rehydrate) | `session_tape` — never `live_massive`, never `fixture` |
| Unauthorized tape read | `metrics_unauthorized` (shipped detail: `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`) |
| SSE capacity refuse (unchanged) | HTTP **503**, `Retry-After: 30`, trader detail `Live streaming is at capacity. Try again shortly.` — **not** a tape miss |

Banned on occupancy / ticker SSE while armed: `live_massive`, `LiveMassive`, `feed` interpolated into `Streaming live ${feed} ticks.`, coverage cells, completeness percent.

---

## Endpoints

### 1. `GET /api/stream/{ticker}` — **CHANGED** · existing ticker SSE

Per-ticker `LiveUpdate`-shaped SSE. **Anonymous.** This is the walk consume path.

**Path params:** `ticker` (string, upper/trim-normalized). Empty after trim ⇒ **404** JSON `detail` (unchanged).

**Query:** existing `min_dte` / `max_dte` / `expirations` ignored for occupancy (unchanged; not a replay arm).

**Auth:** none (not `"auth": true`).

**Streaming:** `text/event-stream`. Client EventSource parses **`data:`** JSON. SSE **comments** (`connected`, `heartbeat`) and Axum `KeepAlive` (15s comments) do **not** reset the 15s payload watchdog and are **not** occupancy.

**Errors (JSON, unchanged classes):** 404 empty ticker · 422 invalid · 500 · 502 · 503 capacity with `Retry-After: 30`. Capacity copy must not be reused as tape miss / ended.

#### Always-on `data:` JSON (`LiveUpdateBody` today)

| Path | Type | Notes |
|---|---|---|
| `ticker` | string | Route symbol |
| `mid` | number \| null | NBBO mid; display-only last-trade is sibling |
| `bid` | number \| null | |
| `ask` | number \| null | |
| `spread` | number \| null | |
| `net_flow` | number | Wall 300s window inside `apply_event` |
| `buy_vol` | number | |
| `sell_vol` | number | |
| `flow_window_s` | number | `300` today; **not** a vouched tape-minute window at 4×/10× |
| `spot_ts` | number | Last-print stamp when a Trade/Quote applied; not tape cursor during keep-alive |
| `live` | boolean | **Forced false while armed.** Unset: recency |
| `tick_age_s` | number \| null | Wall age of last **print**; not provenance, not ended |
| `market_session` | string | **While armed + cursor vouched:** tape-stamp bucket. **While armed + `tape_time_et` null:** `session_tape`. Unset: wall `Utc::now()` America/New_York (`premarket` \| `regular` \| `afterhours` \| `overnight` \| `closed`) |
| `feed` | string | **While armed:** `session_tape`. Unset: today’s `data_feed`. Client must not interpolate `Streaming live ${feed}` when `session_tape` is present |
| `ts` | number | Wall receive ms — **not** tape time |
| `gamma_flip` | number \| null | Peek `ReplayHold` then `gex_cache` while armed |
| `last_trade` | number \| null | Last applied trade print; keep-alive repeats last value; null if none |

Keep-alive and phase pulses are **not** `apply_event` of a synthetic print: no fabricated last-trade, no buy/sell bump, no `PriceCache` write from occupancy-only events. Last known tape numbers are repeated on the payload.

#### Additive occupancy — **present only while armed**

Object key **`session_tape`**. Omit the key entirely when unset.

| Path | Type | Notes |
|---|---|---|
| `session_tape.symbol` | string | **Armed** identity, not necessarily `ticker` |
| `session_tape.et_date` | string | Armed America/New_York `YYYY-MM-DD` |
| `session_tape.tape_time_et` | string \| null | Vouched cursor `HH:MM:SS`; `null` before any stamp (first keep-alive; both-empty before ended). Never wall clock |
| `session_tape.phase` | string | Closed phase set above |
| `session_tape.pace` | number | `1` \| `4` \| `10` |

Client branch (binding): if `session_tape` is present, treat basis as session tape **before** `live` / `feed` / `liveStatus` / `streamOffline → ⚠ Live offline — reconnecting…`. Display-active only when `ticker === session_tape.symbol` and phase is `playing` or `gap`. Genuine `isLive` stays false (including poison `live: true` with this object present).

**Drop on the consume path:** hub `RecvError::Lagged` / `Closed` while phase was `playing` or `gap` **or** client payload-gap watchdog (`STREAM_OFFLINE_MS` with no `data:`) while last vouched phase was `playing` or `gap`. Both are session-tape drop standing (`⚠ Session tape stream dropped`). Do not require wire `phase: drop` before the chip. Unset-arm live-offline remains Massive-only.

Keep-alive: while phase is `playing` (sleeper running **or** first voucher before bind) emit this object on JSON **data** with period **< 15s** wall, independent of `k`. After first `ended` or `fault`, **repeat** that phase on the same period until the process stops.

`GET /api/stream/prices` is **not** amended this slice (not the walk surface; exclusive construct still does not start Massive).

### 2. `GET /api/ticker/{ticker}` — **existing** · structure REST (ReplayHold while armed)

Anonymous ticker bundle. While the process is armed, `load_or_compute` consults `ReplayHold` **before** TTL-gated `gex_cache` and **never** takes the Massive four-fetch join **for any ticker name on that process** (armed symbol or not — opening QQQ on an SPY-armed walker must not vendor-fetch). Bundle field list is **not** restated; occupancy does **not** ride this envelope (structure stays snapshot language). Score / tier / fingerprint keys remain the additive-identity floor (GATE Q hermetic, not live G1).

### 3. `GET /api/_research/session-day-tape/{symbol}` and `.../{symbol}/day` — **unchanged** · operator tape read

Not the clock. Zero Massive. Metrics/research token when configured — **not** `"auth": true`. Pages 404. Authoritative field lists remain `.spire/clusters/tech/contracts/_archive/session-day-tape-capture/INTERFACE_CONTRACT.md`. This feature does not amend them. Live conformance **re-pins** the NVDA / 422 / session-books probes so a walker ship cannot reshape list/load.

### 4. `GET /api/_research/session-books/{symbol}` and `.../{symbol}/book` — **unchanged** · non-regression

Authoritative field lists remain `.spire/clusters/tech/contracts/_archive/session-chain-archive/INTERFACE_CONTRACT.md`. Replay must not insert a book or flip coverage `present`.

---

## Operator CLI (not HTTP; not executed by `interface_conformance.mjs`)

`cargo run -p api-rust -- session-day-replay --symbol SPY --et-date YYYY-MM-DD [--pace 1|4|10]`

| Rule | Binding |
|---|---|
| Title | stdout grep-able `session-day-replay` |
| Pace | omitted ⇒ 1; values other than 1/4/10 refuse start **before bind** (not silent 1×) |
| Bind | existing HTTP/SSE graph **only after** first `playing` occupancy is in the slot; player is sole hub publisher |
| Production | `APP_ENV=prod` plus this construct **refuses before bind** |
| `serve` | does **not** grow a replay flag/env; leftover env on `serve` must not start the player |
| Miss refuse | no identity / unreadable / not-storing / weekend / not-elapsed / not-in-watchlist → **refuse before bind**; no walker HTTP/SSE; capture literals |
| Empty Path-A | **starts**; `no path-a ticks…` is empty standing |
| Both-empty | **starts** then **ended**; no fabricated prints |
| Standing | SPEC §4 block first; `Authorizes: nothing`; never `live_massive`; never coverage `present` |

This is **not** an HTTP body.

---

## Explicit non-endpoints

| Not added | Why |
|---|---|
| `GET/POST /api/_ops/replay`, `/api/replay`, `/api/_research/replay` | Process-start only; runtime arming rejected |
| Nested occupancy on `GET /api/_metrics` | Wrong I/O model |
| Occupancy on ticker REST bundle | Structure stays snapshot language; consume path is SSE |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 |
| Second EventSource / second hub | BRIEF forbids a second live UI path |
| Trader-session cookie as the arm/read gate | Operator token / process-start only |

Do **not** mark `"auth": true`. GATE Q token behavior for tape read is unit/HTTP tests with `METRICS_SECRET_TOKEN`; the kit session-cookie runner is the wrong gate.

---

## Conformance spec

Live `interface_conformance.mjs --url` runs `endpoints` only (HTTP JSON). `sse_data_event` is the machine-checkable ticker SSE `data:` shape the client branches on; live fetch of `GET /api/stream/{ticker}` 200 is event-stream and must **not** be hung as a 200 JSON probe. GATE Q validates an armed `data:` object (and an unset object **without** `session_tape`) in sample mode / hermetic tests.

```json
{
  "sse_data_event": {
    "method": "GET",
    "path": "/api/stream/{ticker}",
    "note": "SSE data JSON; not live-fetched by interface_conformance.mjs",
    "required_always": {
      "ticker": "string",
      "mid": "number|null",
      "bid": "number|null",
      "ask": "number|null",
      "spread": "number|null",
      "net_flow": "number",
      "buy_vol": "number",
      "sell_vol": "number",
      "flow_window_s": "number",
      "spot_ts": "number",
      "live": "boolean",
      "tick_age_s": "number|null",
      "market_session": "string",
      "feed": "string",
      "ts": "number",
      "gamma_flip": "number|null",
      "last_trade": "number|null"
    },
    "required_when_armed": {
      "live": "boolean",
      "feed": "string",
      "market_session": "string",
      "session_tape": "object",
      "session_tape.symbol": "string",
      "session_tape.et_date": "string",
      "session_tape.tape_time_et": "string|null",
      "session_tape.phase": "string",
      "session_tape.pace": "number"
    }
  },
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}",
      "path_params": { "symbol": "NVDA" },
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "path_b_interval": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "count": "number",
        "days": "array",
        "detail": "string|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}/day",
      "path_params": { "symbol": "NVDA" },
      "query": { "et_date": "2020-01-02" },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "et_date": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "path_b_interval": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "detail": "string|null",
        "clock": "string|null",
        "path_a_trade_count": "number",
        "path_a_quote_count": "number",
        "path_a_detail": "string",
        "path_a_ticks": "array",
        "path_a_ticks[].kind": "string",
        "path_a_ticks[].ts_ns": "number",
        "path_a_ticks[].price": "number|null",
        "path_a_ticks[].size": "number|null",
        "path_a_ticks[].bid": "number|null",
        "path_a_ticks[].ask": "number|null",
        "path_a_ticks[].bid_size": "number|null",
        "path_a_ticks[].ask_size": "number|null",
        "path_a_gaps": "array",
        "path_a_gaps[].dropped": "number",
        "path_b_snapshot_count": "number",
        "path_b_gap_count": "number",
        "path_b_detail": "string",
        "path_b_snapshots": "array",
        "path_b_gaps": "array",
        "path_b_gaps[].mark": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}/day",
      "path_params": { "symbol": "SPY" },
      "query": { "et_date": "not-a-date" },
      "expect_status": 422,
      "required": {
        "error": "string",
        "detail": "string",
        "vendor_called": "boolean"
      }
    },
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
    }
  ]
}
```

## What a FAIL here means

- **Tape list/load path missing / non-200 on NVDA** — walker ship nested tape on `_metrics`, captured it as session-books `{symbol}`, or collapsed Axis A for a foreign symbol.
- **422 not returned for `et_date=not-a-date`** — parse not applied, or bad date collapsed into a missing / empty tape.
- **Session-books envelope drift** — replay ship reshaped list/load (must not insert a live paid book).
- **`vendor_called` mistyped or absent** — zero-vendor-on-read no longer machine-checkable on shape.
- **Pages proxy serving `_research`** — trader-origin redistribution.
- **`"auth": true` added later** — kit session-cookie runner would exercise the wrong gate (operator token is not that).
- **A playback REST path appearing in live inventory** — scope breach; process-start only.
- **Armed SSE `data:` missing `session_tape` or with `live: true`** — consume occupancy failed; paid-live chrome will fire (GATE Q / sample, not live G1 hang). GATE Q must reject `live: true` even though the live typespec is `boolean`.
- **Armed SSE `data:` with `feed` = `live_massive`** — paid-live interpolation foot-gun.
- **Armed SSE `data:` with wall-derived `market_session` while `tape_time_et` is null** — overnight/closed/no-live-ticks foot-gun.
- **Unset SSE `data:` carrying `session_tape`** — production look drifted.
- **Fan-out on empty `days[]` / `path_a_ticks[]`** — vacuous pass is correct for not-in-watchlist; a FAIL on element shape when elements exist means the DTO drifted.
