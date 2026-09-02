# exchange-holiday-calendar — interface contract

**Spec:** `.spire/clusters/tech/contracts/exchange-holiday-calendar/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio) — occupancy / session clocks **change**; no new path
**Frontend:** `apps/dashboard` — existing ticker SSE consume + scanner `marketSessionPhase` replica; `/_ops/research` coverage card consume. Not `NO_UI_CHANGE`. No new route.
**Status:** APPROVED 2026-08-31 — written at R4 alongside `SPEC.md`; S2 Critical 0

This feature **changes backend occupancy and session clocks**. It is **not** `NO_BACKEND_CHANGE`. It is **not** `NO_UI_CHANGE`.

It does **not** add `GET /api/holidays`, a bundle calendar field, a coverage `weekend` HTTP field, a sixth coverage cell, or a third coverage `framing` literal. Holiday weekday D **reuses** the existing coverage no-expected `framing` string. Tape/keep grow **sibling** occupancy literals on existing research envelopes and CLIs. Ticker honesty rides the existing SSE `market_session` field.

Human-facing literals live in `SPEC.md` §4. This file owns **transport and bytes**.

---

## Standing rules

1. **Zero vendor I/O to classify a date.** Coverage, tape inspect, keep inspect, ensure-skip, session standing, scanner idle, and ticker/bundle paths never call Massive (or any MIC) to decide holiday membership. `vendor_called` stays `false` on successful research handling. `COVERAGE_VENDOR_CALLS` stays 0.
2. **No new HTTP family.** Do not add `/api/holidays`, `/api/_research/holidays`, a calendar query flag, or a bundle/SSE `holiday` field. Membership is in-process (`fn(NaiveDate) -> bool`).
3. **Coverage `framing` already exists** — consume it. Live adapter: `apps/api/src/routes/research_session_coverage.rs` (`FRAMING` vs `FRAMING_WEEKEND`). Holiday D uses the **no-expected** literal already shipped for weekends: `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`. Key that literal off **not a session day**, **not** by setting internal `CoverageMatrix.weekend = true` on a Thursday. `CoverageMatrix.weekend` stays Sat/Sun only and is **not** on the HTTP envelope (`CoverageOkBody` has no `weekend` field — cited live).
4. **Ticker SSE `market_session` already exists** — consume it. Live: `apps/api/src/routes/stream.rs` `LiveUpdateBody.market_session` from `market_session_at`. On a full-day holiday civil date (unset arm, wall clock) the value is `"closed"` for **every clock hour** that ET date. Calendar does **not** write `live: false` (`live` remains tick-age). Armed replay occupancy is unchanged: `live: false` / `feed: session_tape` stay the replay construct, not this calendar.
5. **Auth posture unchanged.** `_research` uses the metrics/research token (`health::metrics_token_ok` / `Authorization: Bearer` / `X-Metrics-Token`) when `METRICS_SECRET_TOKEN` is set. These are **not** session-cookie trader gates — do **not** mark `"auth": true` on the conformance entries below. Ticker SSE stays **anonymous-open**. GATE Q token 401 is unit/HTTP tests with `METRICS_SECRET_TOKEN`; the kit `--auth-cookie` / `--auth-signup` runner is the wrong gate.
6. **License + edge isolation.** Cloudflare Pages trader origin (`*.pages.dev`) must **404** `/api/_research` and `/api/_research/*` the same way `functions/api/[[path]].ts` already 404s `/api/_metrics`. Coverage must not ship chain bodies onto this envelope.
7. **Score posture.** `authorizes` is exactly `nothing` on every 200 coverage (and tape/keep) envelope this slice still emits. Empty `libs/quant-engine` diff.
8. **List/load non-regression.** `GET /api/_research/session-books/{symbol}` and `.../{symbol}/book` envelopes stay as shipped by `session-chain-archive`. Coverage framing must not overwrite them.
9. **`interface_conformance.mjs` live fetch cannot subscribe SSE.** Live G1 checks the HTTP endpoints in `## Conformance spec`. `sse_data_event` is the machine-checkable ticker SSE `data:` shape; live fetch of `GET /api/stream/{ticker}` 200 is event-stream and must **not** be hung as a 200 JSON probe.

---

## Closed wire vocabularies

### Coverage (existing fields; holiday reuses empty-expected)

Cited live: `CoverageOkBody` in `apps/api/src/routes/research_session_coverage.rs`.

| Token | Members / exact strings |
|---|---|
| `cell` (`rows[].cell`) | `present` · `missing` · `unreadable` · `not yet due` · `blocked occupancy` — **no** member `holiday` |
| `holes[].class` | `missing` · `unreadable` · `blocked occupancy` |
| `verdict` (HTTP 200) | `pass` · `fail` · `not_due` |
| `framing` (session weekday, including today-before-checkpoint and named future **session** weekday) | `RESEARCH READ — SESSION ARCHIVE COVERAGE` |
| `framing` (empty expected set: Sat/Sun **or** NYSE full-day holiday weekday) | `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES` |
| `provenance` (`rows` non-empty) | `loaded from session archive · no vendor call` |
| `provenance` (`rows: []` / empty expected set) | `no vendor call` |
| License | `Our research · not redistributed on a trader route.` |
| `authorizes` | exactly `nothing` |
| HTTP `evidence` | `this process` |
| `command` | `archive-coverage` |
| `checkpoint` | `after 16:00 America/New_York` |
| Unauthorized `error` | `metrics_unauthorized` |
| Bad date `error` | `et_date_unparseable` |
| Not-storing `error` | `session_archive_not_storing` |

Holiday D (in-set weekday): `rows: []`, `holes: []`, `verdict: "not_due"`, `expected_due: 0`, all counts `0`, `provenance: "no vendor call"`, no-expected `framing`. Same HTTP shape as weekend. The envelope does **not** grow a holiday reason field.

### Tape (existing vehicle; sibling occupancy)

Cited live: `apps/api/src/routes/research_session_day_tape.rs` (`FRAMING_WEEKEND` today) + `day_tape/literals.rs` `LIST_CLOCK_INELIGIBLE_WEEKEND`.

| Token | Members / exact strings |
|---|---|
| HTTP `framing` (200 Axis A weekend) | `RESEARCH READ — SESSION DAY TAPE INELIGIBLE WEEKEND` — **Sat/Sun only** |
| HTTP `framing` (200 Axis A holiday weekday) | `RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY` — **new sibling** |
| Weekend `detail` | `session day tape ineligible weekend: {SYMBOL} on {ET_DATE}` |
| Holiday `detail` | `session day tape ineligible holiday: {SYMBOL} on {ET_DATE}` |
| List `days[].clock` weekend | `ineligible weekend` |
| List `days[].clock` holiday | `ineligible holiday` |
| `authorizes` | exactly `nothing` |

Do **not** print `ineligible weekend` for a full-day holiday weekday. Do **not** print `ineligible holiday` for Saturday or Sunday. Holiday load is HTTP **200** (hole-as-data), same family as weekend, never a trader 5xx.

### Keep (existing vehicle; sibling occupancy)

Cited live: `flat_file_keep/literals.rs` `FRAMING_WEEKEND` / `ineligible_weekend` + `occupancy_token` `ineligible weekend`.

| Token | Members / exact strings |
|---|---|
| HTTP/CLI `framing` weekend | `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE WEEKEND` |
| HTTP/CLI `framing` holiday weekday | `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE HOLIDAY` — **new sibling** |
| Weekend `detail` | `flat files ineligible weekend: {ET_DATE}` |
| Holiday `detail` | `flat files ineligible holiday: {ET_DATE}` |
| Occupancy token weekend | `ineligible weekend` |
| Occupancy token holiday | `ineligible holiday` |
| `authorizes` | exactly `nothing` |

Holiday weekday gates **before GET**. Not `miss`, not `empty extract`, not `kept`, not `present`.

### Ticker SSE (existing `LiveUpdateBody`)

Cited live: `apps/api/src/routes/stream.rs` `LiveUpdateBody` / `market_session_at`. Generated TS: `libs/api/src/generated/schema.ts` `LiveUpdateBody.market_session: string`.

| Token | Members / exact strings |
|---|---|
| `market_session` (unset arm, wall clock) | `premarket` · `regular` · `afterhours` · `overnight` · `closed` |
| `market_session` on a full-day holiday civil date | **`closed`** (any clock hour that ET date) |
| `market_session` while armed + cursor vouched | tape-stamp bucket (unchanged replay rule) |
| `market_session` while armed + `tape_time_et` null | `session_tape` (unchanged replay rule) |
| `live` (unset arm) | tick-age boolean — **not** written by the calendar |
| `live` while armed | JSON `false` (replay construct, not this slice) |

Scanner badge is **not** this field. It is client `marketSessionPhase(nowMs)` consuming the generated/pin-tested replica (`closed` · `pre` · `rth` · `after`). No scanner HTTP change.

---

## Endpoints

### 1. `GET /api/_research/session-archive/coverage` — **CHANGED consume** · existing coverage read

Cited live: `apps/api/src/routes/research_session_coverage.rs`. Path already registered. **No Massive. No session-book body. No new query param.**

**Path params:** none.

**Query:**

| Param | Type | Notes |
|---|---|---|
| `et_date` | string \| omitted | Optional. When set, must parse via `parse_et_date` (`YYYY-MM-DD`) or **422**. Omitted ⇒ `today_et_date(now)`. |

**Auth:** metrics token when configured — **not** `"auth": true`.

**Response (200)** — archive **storing**; weekend, holiday weekday, not-yet-due (today before checkpoint **or** named future **session** weekday), holes, and all-present are all 200:

Same field list as shipped (`framing`, `command`, `evidence`, `symbols`, `et_date`, `checkpoint`, `vendor_called`, `provenance`, `license`, `authorizes`, `verdict`, counts, `rows[]`, `holes[]`). Holiday does **not** add keys.

Weekend **or** in-set full-day holiday weekday: empty-expected envelope (no-expected `framing`, `verdict: "not_due"`, `expected_due: 0`, empty `rows`/`holes`).

Named future **session** weekday (not in the full-day set): `not yet due` rows, ordinary `framing` **without** `NO EXPECTED IDENTITIES`, `verdict: "not_due"`, `expected_due: 0`. Do not collapse this into holiday chrome.

**Errors (unchanged classes):**

- **401** when metrics/research token required and missing/wrong — `error: metrics_unauthorized`; **no matrix**.
- **422** when `et_date` is present and unparseable: `error: et_date_unparseable`, `detail: et_date must be YYYY-MM-DD`, `vendor_called: false`. **Not** empty-expected holiday.
- **500** store disabled: `error: session_archive_not_storing` — never a missing grid, never three per-symbol coverage warnings, never fabricated holiday empty-expected.

### 2. `GET /api/stream/{ticker}` — **CHANGED value** · existing ticker SSE

Cited live: `apps/api/src/routes/stream.rs`. **Anonymous.** Per-ticker `LiveUpdate`-shaped SSE.

**Auth:** none (not `"auth": true`).

**Streaming:** `text/event-stream`. Client EventSource parses **`data:`** JSON.

On the unset (production) arm, `market_session` is `market_session_at(Utc::now())`. After this slice, a full-day holiday civil date returns `"closed"` before premarket/regular/afterhours. `live` stays tick-age. Do **not** live-fetch this path in `interface_conformance.mjs` (would hang on the stream). Shape pin: `sse_data_event` below. Exact `"closed"` on a planted holiday instant is GATE Q hermetic.

`GET /api/stream/prices` is **not** the ticker-chip consume path this slice amends. `[lane-check]` if a later consumer starts branching multi-symbol `market_session` on holidays.

### 3. Tape / keep research HTTP — **CHANGED occupancy tokens** · existing vehicles

Not new paths. Authoritative field **lists** remain:

- `.spire/clusters/tech/contracts/_archive/session-day-tape-capture/INTERFACE_CONTRACT.md`
- `.spire/clusters/tech/contracts/_archive/massive-flat-file-keep/INTERFACE_CONTRACT.md`

This slice **amends occupancy vocabulary only** (sibling `ineligible holiday` framing / detail / clock / token). Metrics token when configured — **not** `"auth": true`. Pages 404. Zero Massive on read. Holiday weekday load/inspect is 200 ineligible-holiday, files-call 0 on keep. Live G1 does **not** fetch these (local tape/keep roots may 500 not-storing). GATE Q hermetic owns the new literals.

### 4. Session-books list — **unchanged** · non-regression re-pin

`GET /api/_research/session-books/{symbol}` stays as shipped. Coverage work must not reshape it.

---

## Operator CLI (not HTTP; not executed by `interface_conformance.mjs`)

`archive-coverage` / `session-day-tape` / `flat-files keep` consume the same domain predicates. Holiday weekday CLI standing is `[NOT DUE]` / ineligible-holiday, never `[PASS] n/n`, never empty-extract success. Evidence: **local**.

---

## Explicit non-endpoints

| Not added | Why |
|---|---|
| `GET /api/holidays` or any holiday calendar HTTP | Closed in-process set; scanner badge uses a generated/pin-tested replica |
| Bundle / SSE field `holiday` | Ticker binds existing `market_session === 'closed'` |
| Coverage HTTP field `weekend` | Internal `CoverageMatrix.weekend` stays Sat/Sun only and is not on the wire |
| Third coverage `framing` literal | Human ruling: reuse `… NO EXPECTED IDENTITIES` |
| Nested coverage on `GET /api/_metrics` | Wrong I/O model |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 |
| Session-cookie `"auth": true` on research GETs | Wrong gate |
| Occupancy on ticker REST bundle | Session standing consume path is SSE `market_session` |

**Live 200 assumption:** session archive **enabled** (same as prior coverage pins). Disabled store is 500 not-storing — do not treat as miss. Sample mode still validates required shape.

Do **not** mark `"auth": true`.

---

## Conformance spec

Live `interface_conformance.mjs --url` runs `endpoints` only (HTTP JSON). `sse_data_event` is the machine-checkable ticker SSE `data:` shape the client branches on; live fetch of `GET /api/stream/{ticker}` 200 is event-stream and must **not** be hung as a 200 JSON probe. GATE Q validates `market_session` on a planted holiday instant in sample mode / hermetic tests. Exact `verdict` / `framing` **values** on `et_date=2026-11-26` are GATE Q (today that date is a future session weekday on an unshipped calendar; after ship it is empty-expected). Live G1 checks **types and presence**.

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
    }
  },
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbols": "array",
        "symbols[]": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].et_date": "string",
        "rows[].cell": "string",
        "rows[].last_readable": "string",
        "holes": "array",
        "holes[].symbol": "string",
        "holes[].et_date": "string",
        "holes[].class": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": { "et_date": "2026-08-08" },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "authorizes": "string",
        "license": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "holes": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": { "et_date": "2026-11-26" },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "authorizes": "string",
        "license": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "holes": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
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
    }
  ]
}
```

## What a FAIL here means

- **Coverage path missing / non-200 on a storing archive** — `_research` read not mounted, nested on `_metrics`, or failing closed because a book is missing.
- **422 not returned for `et_date=not-a-date`** — parse_et_date not applied, or bad date collapsed into a missing grid / 200 / empty-expected holiday.
- **Missing envelope fields / mistyped counts** — HTTP twin drifted from the locked matrix.
- **List envelope drift** — holiday ship reshaped session-book list.
- **`vendor_called` mistyped or absent** — zero-vendor-on-read no longer machine-checkable on shape (exact `false` is unit/GATE Q).
- **Pages proxy serving `_research`** — trader-origin redistribution.
- **Fan-out on empty `rows[]` / `holes[]`** — vacuous pass is correct for weekend / holiday empty-expected / no-hole runs; a FAIL on element shape when elements exist means the matrix row/hole DTO drifted.
- **New `/api/holidays` appearing as a product requirement** — scope breach; membership is in-process.
- **Hanging live GET `/api/stream/{ticker}` as a JSON 200 probe** — wrong consume of `sse_data_event`.
