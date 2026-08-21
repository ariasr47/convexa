# chain-archive-object-store — interface contract

**Spec:** `.spire/clusters/tech/contracts/chain-archive-object-store/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`) — session-archive body/index split + FS body store under
`SESSION_CHAIN_ARCHIVE_BODY_ROOT` + unique-per-put locators + migrator clear/drop behind existing
`SessionChainArchive` facade
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume research session books
**Status:** draft — S2 pass-1 repair

## What this feature adds to the FE↔BE HTTP interface: nothing new

This ship relocates **session-archive bodies** off app OLTP BYTEA / unbounded `body_b64` into an
env-configured filesystem body store rooted at **`SESSION_CHAIN_ARCHIVE_BODY_ROOT`** (Railway volume
/ local path) behind the existing `SessionChainArchive` facade. Body storage keys are **unique per
put** (include `source_as_of` and/or a nonce — never identity-only). It adds **no** endpoint,
**no** route, **no** handler, **no** query parameter, and **no** storage-location field on any
existing wire payload.

Operator observation stays on the **already-shipped** research GETs:

- `GET /api/_research/session-books/{symbol}`
- `GET /api/_research/session-books/{symbol}/book?et_date=`

Those routes, their envelopes, and their closed miss / unreadable / not-storing `detail` strings
were shipped by `session-chain-archive` and are **reused byte-compatible**. Missing object behind a
present identity/pointer maps onto existing **`session book unreadable: <reason>`** — not a fifth
miss enum member and not a storage-branded rename.

**Why this file does not say `NO_BACKEND_CHANGE`.** That token would be true of the *HTTP* interface
shape and misleading about the work: `api-rust` gains the body-store leaf under
`SESSION_CHAIN_ARCHIVE_BODY_ROOT`, unique-per-put locators, index locator column, write/load split,
and migrator clear/drop of inline BYTEA / `body_b64`. The predictable wire-visible mistake is
reshaping session-books list/load, collapsing absence classes, inventing a storage-location field,
or trader-exposing `_research` while moving bodies. The block below is a **machine-checked
non-regression re-pin** of those existing routes so GATE Q can observe list/load shape after the
store split.

Authoritative field lists and closed copy for the research envelopes live in
`.spire/clusters/tech/contracts/_archive/session-chain-archive/INTERFACE_CONTRACT.md`. This feature
does not amend them; it re-pins them. Bodies-off-OLTP (AC-1/2), unique-per-put first-wins (AC-9),
and `BODY_ROOT` not-configured → not-storing (AC-8) are asserted by store/migration tests, not by
this shape block.

---

## Standing rules

1. **No new HTTP surface** for body-store browse, migration status, storage health, or blob
   redistribution.
2. **Zero vendor I/O on research read.** List and load never call Massive fetch methods, never
   “refresh if missing,” and never warm trader caches as a side effect — including when the body
   object is missing or corrupt.
3. **Store outcome classes stay closed:** `hit` · `miss` · `error`. Session miss ≠ ring miss ≠
   not-storing ≠ unreadable ≠ list store-error. No fifth “S3” / “volume” / “BYTEA” class.
4. **`vendor_called` is always `false`** on successful handling of these endpoints (including miss).
   A `true` value is a defect — asserted by unit / GATE Q (conformance JSON checks presence/type).
5. **License + edge isolation:** paths stay under `/api/_research/` and are Railway-direct operator
   surfaces. Cloudflare Pages trader origin (`*.pages.dev`) must **404** `/api/_research` and
   `/api/_research/*` the same way it 404s `/api/_metrics`.
6. **Auth posture unchanged:** when `METRICS_SECRET_TOKEN` is set, require the same bearer /
   `X-Metrics-Token` gate used by `GET /api/_metrics`. When unset (local), endpoints are open.
   These are **not** session-cookie trader gates — do not mark `"auth": true` on the re-pin
   entries below.
7. **Archive / body write is not an HTTP API** in this contract. Conformance checks research
   list/load only.
8. **Symbol normalization:** path `symbol` is upper/trim-normalized server-side (same family as
   shipped session-books).
9. **Session identity:** `(symbol, et_date)` America/New_York `YYYY-MM-DD`; provenance
   `source_as_of` mandatory on every successful load — not the identity key.
10. **Score posture / envelopes:**
    - Successful **hit** envelopes (`store=hit`) carry `authorizes: "nothing"`.
    - **List miss** is HTTP **200** `store=miss` and still carries the shipped list envelope
      including `authorizes`, `framing`, `license`, and `provenance`.
    - **Load 404** miss envelopes are detail-only and are not required to repeat `authorizes`.
11. **No storage-location wire field.** Physical body locus (`SESSION_CHAIN_ARCHIVE_BODY_ROOT` /
    volume / future S3) is not an envelope member the UI or operator product vocabulary consumes.
12. **Backend body-root dial (not on the wire):** when archive is enabled and the FS body store is
    in use, **`SESSION_CHAIN_ARCHIVE_BODY_ROOT`** must be set to a usable path that does **not**
    equal or nest under `CHAIN_SNAPSHOT_STORE_PATH`. Unset / empty / missing / unusable /
    path-conflict → open fail-open so research list/load return exact
    **`session archive not storing`** (same closed detail as Disabled). Do not invent a default
    root or `create_dir_all` a silent path. This is AC-8 / open-time behavior — not a new endpoint.
13. **Backend write keying (not on the wire):** body locators are **unique per put**; put then
    `insert_if_absent`. Index first-wins retains the **first** body; a losing put is an orphan
    blob. Identity-only shared keys are forbidden (would last-win the body).

---

## Closed wire vocabularies (reused — do not mint)

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
| `authorizes` (hit **and** list-miss 200) | exactly `nothing` |

**Banned this ship:** “stored in S3,” “object store miss,” “volume unavailable,” “BYTEA migrated,”
“off Postgres,” inventing `empty 48-ring for <SYMBOL>`, or any synonym that renames miss /
unreadable / not-storing into infrastructure marketing. Opaque `<reason>` on unreadable may carry a
live store I/O fault string — not a second closed product taxonomy.

**Ring vehicle (unchanged — cite only):** empty/pruned ring list miss `detail` remains live
`no stored snapshot for <SYMBOL>`. Session-book endpoints emit session miss strings only. This ship
does **not** move ring bodies and does **not** rewrite ring research routes.

---

## Endpoints (existing — unchanged; non-regression re-pin)

| Method | Path | Purpose | Auth | Errors | Streaming |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/_research/session-books/{symbol}` | Existing research list of session identities for one symbol. **No Massive call.** List remains **index-only** (no body I/O). | metrics/research token when configured (not session auth) | Always shaped 200 on miss (empty `books`, closed `detail`, envelope still includes `authorizes`); 400 invalid `limit`; 401 when token required and wrong; 500 not-storing (`session archive not storing` — includes unset/`BODY_ROOT` misconfig at open) / list store-error (`session archive store error: <reason>`) with `vendor_called: false` | none |
| GET | `/api/_research/session-books/{symbol}/book` | Existing research load of one session book by `et_date`. **No Massive call.** Assembles index meta + body-store bytes via unique locator. | same | 404 miss with closed `detail`; 422 bad/missing `et_date`; 401 token; 500 not-storing / unreadable (`session book unreadable: <reason>` — covers missing/corrupt object behind pointer) — never live Massive recovery | none |

Notes that bind the build:

- Body put/get **must not** be triggered as a side effect that calls Massive from these GETs.
  List/load read stored bytes only.
- This feature **must not** change response envelopes, closed miss/fault `detail` strings,
  `vendor_called` semantics, or `authorizes: "nothing"` on hits **and** list-miss 200s.
- Hit-probe seeding for load-200 remains a GATE Q / harness concern: plant archive identity
  `(SPY, 2020-01-02)` with `source_as_of = 2020-01-02T17:00:00.000000001Z` (same dedicated seed as
  `session-chain-archive` / `plant_conformance_seed`) before a live run — or mark UNVERIFIABLE if
  the seed step cannot run. Seed must use the split put+index path under
  `SESSION_CHAIN_ARCHIVE_BODY_ROOT`. Do **not** plant via ring `CONFORMANCE_SEED_AS_OF`.
- Fan-out on empty `books[]` is a vacuous pass (correct for a fresh store).
- Bodies-off-OLTP, migrator clear/drop, unique-per-put first-wins, and `BODY_ROOT` not-configured
  are **AC tests**, not additional conformance endpoints.

### Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Any `/api/_research/session-books/*/storage` (or similar) | Storage locus is adapter fact; no HTTP chrome |
| Any trader archive browse / blob download / historical-chain route | `[operator-vs-trader-path-separation]`; `NO_UI_CHANGE` |
| Any Massive hist-chain / PIT proxy | Out of BRIEF |
| Overload of `GET /api/_research/chain-snapshots/...` as session identity | Ring identity ≠ session identity — sibling routes unchanged; ring bodies Non-move |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 like `_metrics` |
| Path-B / batch-backtest / replay-outcome-join CLI rewrite | Open-the-same-facade only; no new HTTP |
| S3 / volume / BYTEA status endpoint | Banned storage-backend chrome |

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

- **List/load non-200 / missing envelope** — someone reshaped session-books research routes while
  moving bodies, or mounted them under a trader path.
- **List miss without closed `detail` or without `authorizes`** — empty ticker / list-miss
  envelope drifted; AC-24 / GATE Q shape broken.
- **Miss path not 404 / wrong body** — silent vendor fill-in on research read, date substitution,
  or collapse of miss into an empty-book shape.
- **Hit 200 missing `source_as_of`** — provenance dropped during body/index split.
- **Hit 200 missing GEX-replay fields** — slim DTO that cannot feed `compute_analytics_from_vendor`.
- **`vendor_called` mistyped or absent** — zero-vendor-on-read invariant no longer machine-checkable
  on the wire shape (exact `false` is a unit/GATE Q assert).
- **Disabled / unset-`BODY_ROOT` store returned as miss** — `session archive not storing` collapsed
  into `no session book`.
- **Missing object returned as miss or not-storing** — four-outcome honesty broken; must be
  unreadable.
- **List I/O returned as `session_book_unreadable`** — list store-error aliased into load-only class.
- **New storage-location field required by consumers** — adapter fact leaked onto the wire.
- **Pages proxy serving `_research`** — trader-origin redistribution.
- **Seeded load using ring `CONFORMANCE_SEED_AS_OF` → `et_date=1970-01-01`** — wrong plant; use
  dedicated `(SPY, 2020-01-02)` seed.
