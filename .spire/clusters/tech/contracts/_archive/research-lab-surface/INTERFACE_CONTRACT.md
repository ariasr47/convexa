# research-lab-surface — interface contract

**Spec:** `.spire/clusters/tech/contracts/research-lab-surface/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`) — **NO_BACKEND_CHANGE**
**Frontend:** `apps/dashboard` operator page `/_ops/research` (off-shell; not a trader consumer)
**Status:** APPROVED 2026-08-31 — written at R4 alongside `SPEC.md`; S2 pass 4 clean (0 Critical)

## NO_BACKEND_CHANGE

This feature **adds no backend surface**. Empty `apps/api` product diff. No new path, handler, query parameter, occupancy class, digest adapter, seed endpoint, or OpenAPI op. Pages Function `functions/api/[[path]].ts` stays the 404 it is today for `/api/_research` and `/api/_research/*`.

The operator page **consumes existing** token-gated GETs:

- `GET /api/_research/session-books/{symbol}`
- `GET /api/_research/session-books/{symbol}/book?et_date=`
- `GET /api/_research/session-archive/coverage` (v1 sends **no** `et_date` query; server-default date D)

Authoritative field lists and closed copy for those envelopes were shipped by `session-chain-archive` and `archive-coverage-guardrails` (archived contracts). This feature does not amend them. The conformance block below is a **machine-checked non-regression re-pin** so GATE Q can verify the frontend consumes what the backend already emits — not an empty endpoint set, and not a new wire.

Human-facing framing lives in `SPEC.md` §4. This file owns **transport and bytes**.

---

## Standing rules

1. **Zero vendor I/O on research read.** List, load, and coverage never call Massive, never “refresh if missing,” never start ensure, and never write a session book. `vendor_called` is always `false` on successful handling (including miss, holes, not-due, and not-storing).
2. **Store / cell classes stay closed.** Session miss ≠ coverage `missing` ≠ not-storing ≠ unreadable ≠ origin-blocked ≠ load-miss. Coverage `present` is a loadable `LiveMassive` body only. List `source` is provenance (`live_massive` · `fixture` · `session_tape`) and is **not** a coverage cell.
3. **License + edge isolation.** Paths stay under `/api/_research/` and are Railway-direct operator surfaces. Cloudflare Pages trader origin (`*.pages.dev`) must **404** `/api/_research` and `/api/_research/*` the same way it 404s `/api/_metrics`. Coverage must not ship chain bodies (`market` / `contracts`) onto its envelope. Load bodies remain full captures on the wire; the **UI** must not dump them (SPEC AC-26) and must not export them.
4. **Auth posture unchanged.** When `METRICS_SECRET_TOKEN` is set, require the same bearer / `X-Metrics-Token` gate used by `GET /api/_metrics` (`health::metrics_token_ok`). When unset (local), endpoints are open. These are **not** session-cookie trader gates — do **not** mark `"auth": true` on the re-pin entries below. The kit `--auth-cookie` / `--auth-signup` runner is the wrong gate. GATE Q owns metrics-token 401 **and** the cookie-is-not-the-gate probe (SPEC AC-14): a **non-page**, **non-omit** HTTP request to a research GET with a trader session cookie and **without** `Authorization` / `X-Metrics-Token` must still be **401** `error: metrics_unauthorized` when a token is required. That probe is not the operator page (page fetches use `credentials: 'omit'` and never attach the cookie). Do not add a 401 row to the re-pin block (local unset-token would fail the kit run).
5. **Frontend transport.** Research GETs are `absoluteSittingBase + existing path`. Relative `/api/_research` is poison. `credentials: 'omit'`. Token never in the query string. Sitting base is a runtime operator input (SPEC §2); this file does not bake a host.
6. **v1 consume set.** Coverage is fetched with empty query (server-default date). Symbol set for books list is SPY / QQQ / IWM. Tape / snapshots / flat-files HTTP exists on the server and is **not consumed** by this page.
7. **Score posture.** Successful 200 envelopes this page reads (list, load, **and** coverage) carry `authorizes: "nothing"`. A `true` `vendor_called` or any other `authorizes` token is an **invariant-fault** in the client for **that envelope**, not a digest, not occupancy, not stale keep-last. SPEC §4 owns envelope-scoped copy (list vs load vs coverage).
8. **Symbol normalization.** Path `symbol` is upper/trim-normalized server-side (already shipped).
9. **Session identity.** `(symbol, et_date)` America/New_York `YYYY-MM-DD`. Provenance `source_as_of` is mandatory on every successful load.
10. **Classified occupancy 500s are not unclassified 5xx.** HTTP 500 JSON with `error` `session_archive_not_storing`, `session_archive_store_error`, or `session_book_unreadable` remains **that** closed class on the wire. This feature does not change those bodies. The client must classify them as not-storing / list store-error / unreadable / coverage withheld (SPEC AC-27 / AC-53 / AC-29 / AC-39), never as generic warm-5xx stale keep-last.
11. **Coverage transport fail is not keep-last.** A coverage GET that fails as transport / unclassified TypeError / unclassified 5xx is the client **coverage-unavailable** arm (SPEC AC-38), **including after a prior 200 coverage envelope this sitting**. Do not keep the last success matrix. Do not use the list-keyed stale chip for coverage. Classified occupancy 500 of coverage remains withheld (rule 10).
12. **Page-level list occupancy 500 hides concurrent load.** When the list GET is classified occupancy 500, the client must not present a concurrent load 200 digest or load-fault Alert (SPEC AC-27 / AC-53 / AC-52 list-occupancy exclusive standing), including a coverage `present` chip-follow that issued list GET + load GET in parallel.

---

## Closed wire vocabularies (reused — do not mint)

| Token | Members |
| --- | --- |
| List/load `store` | `hit` · `miss` · `error` |
| List/load `source` | `live_massive` · `fixture` · `session_tape` (unknown wire → client **unavailable** arm; print verbatim; never coerce to `present` or `live_massive`) |
| Load miss `error` | `no_session_book` |
| Not-storing `error` | `session_archive_not_storing` |
| Unreadable `error` (load only) | `session_book_unreadable` |
| List store-fault `error` | `session_archive_store_error` |
| Unauthorized `error` | `metrics_unauthorized` (detail: `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`) |
| List miss `detail` | exactly `no session book for <SYMBOL>` |
| Load miss `detail` | exactly `no session book for <SYMBOL> on <ET_DATE>` |
| Not-storing `detail` | exactly `session archive not storing` |
| Unreadable `detail` (load) | `session book unreadable: <reason>` |
| List store-fault `detail` | `session archive store error: <reason>` |
| Hit `framing` | `RESEARCH READ — SESSION BOOK` |
| List miss `framing` | `RESEARCH READ — NO SESSION BOOK` |
| Hit `provenance` | `loaded from session archive · no vendor call` |
| Miss provenance | `no vendor call` |
| License | `Our research · not redistributed on a trader route.` |
| `authorizes` (200 list/load/coverage) | exactly `nothing` |
| Coverage `cell` / hole `class` | `present` · `missing` · `unreadable` · `not yet due` · `blocked occupancy` (`holes[].class` omits `not yet due` and `present`) |
| Coverage `verdict` | `pass` · `fail` · `not_due` |
| Coverage framing | `RESEARCH READ — SESSION ARCHIVE COVERAGE` · weekend `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES` |
| Coverage `evidence` | `this process` |
| Coverage `command` | `archive-coverage` |
| Coverage `checkpoint` | `after 16:00 America/New_York` |

**Banned this ship:** new keys; unified `status`; coverage cells minted from list `source`; `kept` on session-book envelopes; CLI `[PASS]` / `Evidence: local` on the HTTP coverage card; `holes[].detail`; Pages-proxied `_research`; a new product seed endpoint.

---

## Endpoints (existing — unchanged; non-regression re-pin)

| Method | Path | Purpose | Auth | Errors | Streaming |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/_research/session-books/{symbol}` | Existing research list of session identities for one symbol. **No Massive.** v1 calls SPY (default), QQQ, IWM. | metrics/research token when configured (not session auth) | 200 on miss (empty `books`, closed `detail`, envelope still includes `authorizes`); 400 invalid `limit`; 401 when token required and wrong; 500 not-storing / store-error with `vendor_called: false` | none |
| GET | `/api/_research/session-books/{symbol}/book` | Existing research load of one session book by `et_date`. **No Massive.** Full capture on the wire; UI digests counts only. | same | 404 miss with closed `detail` (`error: no_session_book`); 422 bad/missing `et_date`; 401 token; 500 not-storing / unreadable — never live Massive recovery | none |
| GET | `/api/_research/session-archive/coverage` | Existing coverage matrix. **No Massive. No session-book body.** v1 omits `et_date` (server `today_et_date`). | same | 200 for weekend / not-due / holes / all-present; 401 token; 422 bad `et_date` (not sent by v1 UI); 500 not-storing / store-error — never a missing grid for those 500s | none |

Notes that bind the build:

- This feature **must not** change response envelopes, closed miss/fault `detail` strings, `vendor_called` semantics, or `authorizes: "nothing"` on 200s.
- These GETs **must not** trigger ensure, Massive, cache mutation, or trader compute.
- Fan-out on empty `books[]` / `rows[]` / `holes[]` is a vacuous pass (correct for a fresh store or weekend).
- List empty is **200**. Load miss is **404 JSON** `no_session_book`. Pages Function 404 is **404 plaintext** `Not Found`. The client must not collapse those three.
- HTTP 500 with closed `error` `session_archive_not_storing` / `session_archive_store_error` / `session_book_unreadable` is **that occupancy class**, not an unclassified 5xx. The client must not collapse those into warm stale keep-last.
- Coverage transport / unclassified TypeError / unclassified 5xx is client coverage-unavailable (SPEC AC-38), never keep-last of a prior success matrix.
- A list occupancy 500 must not be paired in the UI with a concurrent load 200 digest.

### GATE Q plants (honest — three identities, no new backend seed)

Do **not** invent a product seed API. GATE Q may use existing archive `insert_if_absent` / already-kept bodies. These three must not be collapsed:

1. **Fixture conformance seed (load-200 shape pin only).** `SessionChainArchive::plant_conformance_seed()` plants identity **`(SPY, 2020-01-02)`** with `source_as_of = 2020-01-02T17:00:00.000000001Z` via `fixture_probe_bundle`: `source: Fixture`, **one** contract, **empty** `daily_bars` / `minutes` / `trades`. Live `interface_conformance.mjs` uses this (or marks UNVERIFIABLE if the seed step cannot run). Empty arrays still satisfy the re-pin’s `array` types. This seed **cannot** prove SPEC AC-26 (dump-absence needs populated arrays). Coverage **excludes** this seed from expected / `present` (`last_readable` may print `none (seed fixture excluded)`). It is **not** a coverage `present` identity.

2. **Dump-capable book (SPEC AC-26).** GATE Q plants or finds a stored book whose load JSON has **populated** (non-empty) `market.contracts` / `daily_bars` / `minutes` / `trades`. That is a harness/store plant against existing APIs, **not** `plant_conformance_seed()` alone. If GATE Q cannot obtain such a body without a product backend change, AC-26 is **UNVERIFIABLE** — do not treat empty fixture arrays as dump-capable.

3. **Coverage `present` identity (SPEC AC-35 / AC-51 / preferred present-click pass).** A cell is `present` only when the existing coverage GET (no `et_date` query) reports `rows[].cell === "present"` for a loadable **`LiveMassive`** body — not Fixture, not the conformance seed, not a list `source` mint. GATE Q uses a store state that already yields that cell, or marks the present-click arm **UNVERIFIABLE** (weekend / not-yet-due / no LiveMassive for server-default D are honest misses of that arm). Do not send `et_date` from this page to force a date.

### Explicit non-endpoints (not added, not consumed by this page)

| Not added / not consumed | Why |
| --- | --- |
| Any new `/api/_research/...` digest, bulk-list, occupancy adapter, or seed endpoint | `NO_BACKEND_CHANGE`; occupancy stays on existing closed decks |
| `GET /api/_research/session-day-tape/*` | Tape vehicle out of v1 chrome |
| `GET /api/_research/chain-snapshots/*` | Snapshot ring out of v1 chrome |
| `GET /api/_research/flat-files/*` | Extract `kept` vehicle out of v1 chrome |
| Nested coverage on `GET /api/_metrics` | Wrong I/O model; metrics is not this page |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 like `_metrics` |
| Score-lab HTTP, `/_ops/replay`, trader bundle/SSE fields | Out of BRIEF |
| Session-cookie `"auth": true` on these GETs | Wrong gate |

---

## What the frontend must send (existing headers, existing paths)

- URL = sitting research base (scheme + host + optional non-default port, no path) + existing path tail.
- Headers, when the sitting token is non-empty: `Authorization: Bearer <token>` and/or `X-Metrics-Token: <token>` (one is enough server-side). Empty token → omit both; still illegal to GET without a usable base.
- `credentials: 'omit'`.
- Coverage: **no** `et_date` query this slice.
- Load: required `et_date=YYYY-MM-DD` of the selected identity (from a list row or a coverage `present` cell). Do not substitute another date.
- Never put the token or origin in the query string.

401 body (existing, when token required): `{ "error": "metrics_unauthorized", "detail": "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token" }`.

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
      "path_params": { "symbol": "QQQ" },
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
      "path_params": { "symbol": "IWM" },
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
    },
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
    }
  ]
}
```

## What a FAIL here means

- **List/load/coverage non-200 / missing envelope** — someone reshaped research routes while building the operator page, mounted them under a trader path, or the live store is disabled (500 not-storing is not this 200 pin).
- **List miss without closed `detail` or without `authorizes`** — empty-ticker envelope drifted; empty vs origin-blocked has no vouched home.
- **Load 404 missing `error` / `detail`** — miss collapsed into empty-book shape or origin-blocked; silent vendor fill-in.
- **Hit 200 missing `source_as_of`, `authorizes`, or capture array fields** — digest has no identity/counts. Dump-absence (AC-26) is **not** this pin: the fixture seed’s empty `daily_bars` / `minutes` / `trades` still satisfy array shape.
- **Coverage missing cell/count/evidence fields** — HTTP twin drifted; `present` no longer a loadable-LiveMassive count on this envelope. A fixture-only store that yields zero `present` cells is not a FAIL of this pin.
- **`vendor_called` mistyped or absent** — zero-vendor-on-research-read no longer machine-checkable on shape (exact `false` is unit/GATE Q).
- **New research path appearing as a product requirement of this page** — scope breach; this contract pins only the three existing GETs.
- **Pages proxy serving `_research`** — trader-origin redistribution.
- **Fan-out on empty `books[]` / `rows[]`** — vacuous pass is correct for a fresh store or weekend; a FAIL on element shape when elements exist means the DTO drifted.
