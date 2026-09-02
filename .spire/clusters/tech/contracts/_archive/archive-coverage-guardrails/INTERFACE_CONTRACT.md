# archive-coverage-guardrails — interface contract

**Spec:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio)
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume these endpoints
**Status:** APPROVED 2026-08-29 — written at R4 alongside `SPEC.md`

This feature **adds backend surface**. It is **not** `NO_BACKEND_CHANGE`.

It adds (1) a sibling operator/research **coverage read** under `/api/_research/` and (2) clap
`archive-coverage` on `apps/api/src/main.rs` `Commands`. It does **not** nest coverage JSON on
`GET /api/_metrics` (`routes/health.rs`). Existing session-book **list/load** stay the load vehicle;
coverage is a different job and must not reuse `RESEARCH READ — SESSION BOOK`.

Human-facing literals live in `SPEC.md` §4. This file owns **transport and bytes**.

---

## Standing rules

1. **Zero vendor I/O on coverage read.** The handler never calls Massive, never “refresh if
   missing,” never starts ensure, and never writes a session book. `vendor_called` is always
   `false` on successful handling (including holes, not-due, and not-storing).
2. **Same derive as CLI and the warning emitter** (injected `DateTime<Utc>`, one ET date D,
   checkpoint 16:00 America/New_York). A hole is **data**: HTTP **200** with an honest matrix, never
   a trader 5xx.
3. **License + edge isolation:** paths stay under `/api/_research/` and are Railway-direct
   operator surfaces. Cloudflare Pages trader origin (`*.pages.dev`) must **404**
   `/api/_research` and `/api/_research/*` the same way `functions/api/[[path]].ts` already 404s
   `/api/_metrics`. Coverage must not ship chain bodies (`market` / `contracts`) onto this envelope
   or any trader route.
4. **Auth posture (Railway-direct):** when `METRICS_SECRET_TOKEN` is set, require the same bearer /
   `X-Metrics-Token` gate used by `GET /api/_metrics` and `routes/research_session_books.rs`
   (`health::metrics_token_ok`). When unset (local), the read is open. These are **not**
   session-cookie trader gates — do **not** mark `"auth": true` on the conformance entries below.
5. **Symbol set is closed:** always SPY · QQQ · IWM (`ENSURE_SYMBOLS`). Path has no `{symbol}`.
6. **Session identity:** `(symbol, et_date)` America/New_York `YYYY-MM-DD`. Optional query
   `et_date` uses `parse_et_date`; omitted ⇒ `today_et_date(now)`.
7. **Score posture:** `authorizes` is exactly `nothing` on every 200 coverage envelope.
8. **List/load non-regression:** `GET /api/_research/session-books/{symbol}` and
   `.../{symbol}/book` envelopes, miss `detail` strings, and `vendor_called: false` stay as shipped
   by `session-chain-archive`. Coverage framing must not overwrite them. Coverage HTTP has **no**
   unreadable-reason / blocked-gloss field; those strings stay CLI-only (SPEC AC-27 / AC-51).

---

## Closed wire vocabularies (coverage)

| Token | Members |
| --- | --- |
| `cell` (`rows[].cell`; due and not-yet-due rows) | `present` · `missing` · `unreadable` · `not yet due` · `blocked occupancy` |
| `holes[].class` | `missing` · `unreadable` · `blocked occupancy` |
| `verdict` (HTTP 200) | `pass` · `fail` · `not_due` |
| `framing` (classified window, including today-before-checkpoint and named future weekday) | `RESEARCH READ — SESSION ARCHIVE COVERAGE` |
| `framing` (weekend / empty expected set) | `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES` |
| `provenance` (`rows` non-empty) | `loaded from session archive · no vendor call` |
| `provenance` (`rows: []` / empty expected set) | `no vendor call` |
| License | `Our research · not redistributed on a trader route.` |
| `authorizes` | exactly `nothing` |
| HTTP `evidence` | `this process` (never `local` on a Railway-origin GET; never `production`) |
| `command` | `archive-coverage` |
| `checkpoint` | `after 16:00 America/New_York` |
| Last-readable string | `{SYMBOL} {ET_DATE}` · `none (seed fixture excluded)` · `undetermined (walk cap)` |
| Not-storing `error` | `session_archive_not_storing` |
| Store-fault `error` | `session_archive_store_error` |
| Bad date `error` | `et_date_unparseable` |
| Unauthorized `error` | `metrics_unauthorized` (shipped detail: `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`) |

`IneligibleWeekend`, `RejectedSource`, `Fixture`, `live_massive`, `store: hit|miss` as a coverage
cell, and session-load miss strings are **not** coverage cell literals. `blocked occupancy` **is** a
`cell` peer (not hole-list-only).

**Count identity:** `expected_due = present + missing + unreadable + blocked_occupancy`.
`not_yet_due` is **not** in that sum. Four-class present/missing/unreadable/not-yet-due totals do
not absorb `blocked_occupancy`.

---

## Endpoints

### 1. `GET /api/_research/session-archive/coverage` — **NEW** · coverage read

Read-only expected-identity matrix for one ET date D. **No Massive call. No session-book body.**

Register this **static** path beside `research_session_books.rs` so Axum cannot bind it as
`/api/_research/session-books/{symbol}` with `symbol=coverage`.

**Path params:** none.

**Query:**

| Param | Type | Notes |
| --- | --- | --- |
| `et_date` | string \| omitted | Optional. When set, must parse via `parse_et_date` (`YYYY-MM-DD`) or **422**. Omitted ⇒ `today_et_date(now)`. |

**Response (200)** — archive **storing**; weekend, not-yet-due (today before checkpoint **or**
named future weekday), holes, and all-present are all 200:

| Path | Type | Notes |
| --- | --- | --- |
| `framing` | string | Closed framing above |
| `command` | string | `archive-coverage` |
| `evidence` | string | `this process` |
| `symbols` | array | Always `["SPY","QQQ","IWM"]` (standing set; not “rows that classified”) |
| `et_date` | string | Evaluated D |
| `checkpoint` | string | `after 16:00 America/New_York` |
| `vendor_called` | boolean | Always `false` |
| `provenance` | string | Hit string when `rows` non-empty; `no vendor call` when `rows: []` |
| `license` | string | Closed license above |
| `authorizes` | string | Exactly `nothing` |
| `verdict` | string | `pass` iff ≥1 due and all due `present`; `fail` iff any due missing/unreadable/blocked occupancy; `not_due` iff zero due identities (weekend, **or** today before checkpoint, **or** named future ET weekday) |
| `expected_due` | number | `present + missing + unreadable + blocked_occupancy` |
| `present` | number | Due cells classified `present` |
| `missing` | number | Due cells classified `missing` |
| `unreadable` | number | Due cells classified `unreadable` |
| `not_yet_due` | number | Classified but not due; **not** in `expected_due` |
| `blocked_occupancy` | number | Due cells classified `blocked occupancy`; in `expected_due` |
| `rows` | array | Empty on weekend. Else one object per expected identity (SPY, QQQ, IWM minus seed), same order |
| `rows[].symbol` | string | |
| `rows[].et_date` | string | |
| `rows[].cell` | string | Closed `cell` literals (includes `blocked occupancy`) |
| `rows[].last_readable` | string | Closed last-readable strings |
| `holes` | array | Empty when none; never includes not-yet-due or matrix-level errors |
| `holes[].symbol` | string | |
| `holes[].et_date` | string | |
| `holes[].class` | string | Closed hole classes. No `detail` / `message` field |

There is **no** loading field. There is **no** `market` / `contracts` / `daily_bars` / `minutes` /
`trades` payload. There is **no** unreadable-reason field on this envelope.

Weekend: `rows: []`, `holes: []`, `verdict: "not_due"`, `expected_due: 0`,
`provenance: "no vendor call"`, framing `… NO EXPECTED IDENTITIES`.

Weekday before 16:00 ET with D=today, **or** named future ET weekday: `not yet due` rows
(seed date may drop SPY), `holes: []`, `verdict: "not_due"`, `expected_due: 0`, framing
**without** `NO EXPECTED IDENTITIES`, hit provenance (rows non-empty).

**Errors:**

- **401** when metrics/research token required and missing/wrong — body `error: metrics_unauthorized`,
  shipped detail; **no matrix**.
- **422** when `et_date` is present and unparseable: `error: et_date_unparseable`,
  `detail: et_date must be YYYY-MM-DD`, `vendor_called: false`.
- **500** store disabled: `error: session_archive_not_storing`, `store: error`,
  `detail: session archive not storing`, `vendor_called: false` — never a missing grid, never three
  per-symbol coverage warnings.
- **500** other list/load I/O that is not per-identity unreadable: `error: session_archive_store_error`,
  `store: error`, `detail: session archive store error: <reason>`, `vendor_called: false`.

### 2. Existing session-book list/load — **unchanged** (non-regression re-pin)

| Method | Path | Purpose | Auth | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/_research/session-books/{symbol}` | Existing research list. **No Massive.** | metrics token when configured (not session) | 200 miss still shaped; 400 invalid `limit`; 401; 500 not-storing / store-error |
| GET | `/api/_research/session-books/{symbol}/book` | Existing research load. **No Massive.** | same | 404 miss; 422 bad `et_date`; 401; 500 not-storing / unreadable |

Authoritative field lists remain
`.spire/clusters/tech/contracts/_archive/session-chain-archive/INTERFACE_CONTRACT.md`.
This feature does not amend them.

---

## Operator CLI (not HTTP; not executed by `interface_conformance.mjs`)

`cargo run -p api-rust -- archive-coverage` with optional `--et-date YYYY-MM-DD`. Dispatch like
`Capacity` in `main.rs` (`ExitCode` before `run()`). Same derive as the HTTP adapter. Does not
sleep until 16:00. Exit 0 only when every due identity is `present`, or when none are due
(`[NOT DUE]`), including a named future weekday. Non-zero on due missing / unreadable / blocked
occupancy (`[FAIL]`) and on StoreDisabled / derive / vendor-path / unparseable-date (`[ERROR]`).
Stdout title `archive-coverage`. **Evidence: local.** A local exit 0 is not production coverage.
Must run without `MASSIVE_API_KEY` and must not construct `MassiveRestClient` /
`MarketDataPort::live`.

CLI may print blocked-hole gloss and unreadable reason; those are not HTTP fields.

---

## Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Nested coverage object on `GET /api/_metrics` | Wrong I/O model; latency poll must not `load` session bodies |
| Any trader bundle/SSE/scan field | `[operator-vs-trader-path-separation]` |
| `POST/PUT` fill / ensure / reconstruct | Coverage is read-only |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 |
| Coverage body dump (`market` / `contracts`) | Massive license; not a trader feed |
| `since` / storing-window query | Owner D2; named-date residual; Future-dated |
| Coverage `holes[].detail` / unreadable-reason | CLI-only gloss; list/load keeps `session book unreadable: <reason>` |

**Live 200 assumption:** session archive **enabled** (same as list 200). Disabled store is 500
not-storing — do not treat as miss. Sample mode still validates required shape.

Do **not** mark `"auth": true`. GATE Q token behavior is unit/HTTP tests with
`METRICS_SECRET_TOKEN`; the kit session-cookie runner is the wrong gate.

---

## Conformance spec

```json
{
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
      "query": { "et_date": "2020-01-02" },
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

- **Coverage path missing / non-200 on a storing archive** — sibling `_research` read not mounted,
  nested on `_metrics`, captured as `{symbol}=coverage`, or failing closed because a book is missing.
- **422 not returned for `et_date=not-a-date`** — parse_et_date not applied, or bad date collapsed
  into a missing grid / 200.
- **Missing envelope fields / mistyped counts** — HTTP twin drifted from the locked matrix;
  `expected_due` may not equal `present + missing + unreadable + blocked_occupancy`.
- **List/load envelope drift** — coverage ship reshaped session-book list/load (SPEC AC-51).
- **`vendor_called` mistyped or absent** — zero-vendor-on-read no longer machine-checkable on shape
  (exact `false` is unit/GATE Q).
- **Pages proxy serving `_research`** — trader-origin redistribution.
- **Fan-out on empty `rows[]` / `holes[]`** — vacuous pass is correct for weekend / no-hole runs;
  a FAIL on element shape when elements exist means the matrix row/hole DTO drifted.
