# liquid-names-session-capture — interface contract

**Spec:** `.spire/clusters/tech/contracts/liquid-names-session-capture/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`) — off-path ensure worker + promote/force-compute leaf
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume research session books
**Status:** draft — S2 pass-1 repair

## What this feature adds to the FE↔BE HTTP interface: nothing new

Ensure is an **off-path backend behavior** (dedicated worker; presence → promote ring snapshot →
bounded force-compute with **awaited** archival). It adds **no** endpoint, **no** route, **no**
handler, **no** query parameter, and **no** field on any existing wire payload. There is **no ensure
HTTP surface** and **no trader endpoint**.

Operator observation stays on the **already-shipped** research GETs:

- `GET /api/_research/session-books/{symbol}`
- `GET /api/_research/session-books/{symbol}/book?et_date=`

Those routes, their envelopes, and their closed miss `detail` strings were shipped by
`session-chain-archive` and are **reused byte-compatible** — this feature does not mint new miss
taxonomy, hit framing, or ensure-pending fields.

**Why this file does not say `NO_BACKEND_CHANGE`.** That token would be true of the *HTTP*
interface shape and misleading about the work: `api-rust` gains the ensure leaf, worker, wake
signal, promote path, and bounded force-compute (await `capture_into` or direct
`archive_session_best_effort` — not fire-and-forget `spawn_capture`). The predictable wire-visible
mistake is reshaping session-books list/load, collapsing absence classes, or trader-exposing
`_research` while building ensure. The block below is a **machine-checked non-regression re-pin**
of those existing routes — same posture as `batch-backtest-cli` re-pinning `_research/chain-snapshots`
— so GATE Q can observe list/load shape for **SPY / QQQ / IWM**. Warm-cache hit guarantees for the
trio are **AC-1–3 tests**, not a vacuous empty-list fan-out.

Authoritative field lists and closed copy for the research envelopes live in
`.spire/clusters/tech/contracts/_archive/session-chain-archive/INTERFACE_CONTRACT.md`. This feature
does not amend them; it re-pins them.

---

## Standing rules

1. **No new HTTP surface** for ensure, ensure-progress, lab-name membership, or blob redistribution.
2. **Zero vendor I/O on research read** remains true for list/load (`vendor_called` always `false`
   on successful handling, including miss). Ensure Massive (if any) runs only inside the off-path
   worker — never as a side effect of these GETs.
3. **Store outcome classes stay closed:** `hit` · `miss` · `error`. Session miss ≠ ring miss ≠
   not-storing ≠ unreadable ≠ list store-error.
4. **License + edge isolation:** paths stay under `/api/_research/` and are Railway-direct
   operator surfaces. Cloudflare Pages trader origin (`*.pages.dev`) must **404** `/api/_research`
   and `/api/_research/*` the same way it 404s `/api/_metrics`.
5. **Auth posture unchanged:** when `METRICS_SECRET_TOKEN` is set, require the same bearer /
   `X-Metrics-Token` gate used by `GET /api/_metrics`. When unset (local), endpoints are open.
   These are **not** session-cookie trader gates — do not mark `"auth": true` on the re-pin
   entries below.
6. **Ensure write is not an HTTP API** in this contract. Conformance checks research list/load
   only.
7. **Symbol normalization:** path `symbol` is upper/trim-normalized server-side (same family as
   shipped session-books).
8. **Session identity:** `(symbol, et_date)` America/New_York `YYYY-MM-DD`; provenance
   `source_as_of` mandatory on every successful load — not the identity key.
9. **Score posture / envelopes:**
   - Successful **hit** envelopes (`store=hit`) carry `authorizes: "nothing"`.
   - **List miss** is HTTP **200** `store=miss` and still carries the shipped list envelope
     including `authorizes`, `framing`, `license`, and `provenance` (live list handler already
     emits them; conformance requires them — AC-25 must not bless omitting these keys).
   - **Load 404** miss envelopes are detail-only and are not required to repeat `authorizes`.

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

**Banned this ship:** “not a lab name”, ensure-pending / ensure-failed copy, warm-cache excuse
phrasing, holiday/coverage excuse copy, inventing `empty 48-ring for <SYMBOL>` on either vehicle.

**Ring vehicle (unchanged — cite only):** empty/pruned ring list miss `detail` remains live
`no stored snapshot for <SYMBOL>`. Session-book endpoints emit session miss strings only.

---

## Endpoints (existing — unchanged; non-regression re-pin)

| Method | Path | Purpose | Auth | Errors | Streaming |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/_research/session-books/{symbol}` | Existing research list of session identities for one symbol. **No Massive call.** | metrics/research token when configured (not session auth) | Always shaped 200 on miss (empty `books`, closed `detail`, envelope still includes `authorizes`); 400 invalid `limit`; 401 when token required and wrong; 500 not-storing / store-error with `vendor_called: false` | none |
| GET | `/api/_research/session-books/{symbol}/book` | Existing research load of one session book by `et_date`. **No Massive call.** | same | 404 miss with closed `detail`; 422 bad/missing `et_date`; 401 token; 500 not-storing / unreadable — never live Massive recovery | none |

Notes that bind the build:

- Ensure **must not** be triggered by these GETs. List/load read stored bytes only.
- This feature **must not** change response envelopes, closed miss/fault `detail` strings,
  `vendor_called` semantics, or `authorizes: "nothing"` on hits **and** list-miss 200s.
- Hit-probe seeding for load-200 remains a GATE Q / harness concern: plant archive identity
  `(SPY, 2020-01-02)` with `source_as_of = 2020-01-02T17:00:00.000000001Z` (same seed as
  `session-chain-archive`) before a live run — or mark UNVERIFIABLE if the seed step cannot run.
  After an ET ensure **weekday**, GATE Q observes real `(SPY|QQQ|IWM, D)` hits via **AC-1–3
  tests**. The QQQ/IWM **list** conformance entries below may vacuously pass on empty `books[]`;
  that is **not** evidence of the warm-cache guarantee.
- Fan-out on empty `books[]` is a vacuous pass (correct for a fresh store).

### Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Any `/api/_research/session-books/*/ensure` (or similar) | Ensure is off-path worker only; no HTTP write |
| Any trader ensure / session-archive browse / blob download route | `[operator-vs-trader-path-separation]`; `NO_UI_CHANGE` |
| Any Massive hist-chain / PIT proxy | Out of BRIEF |
| Overload of `GET /api/_research/chain-snapshots/...` as session identity | Ring identity ≠ session identity — sibling routes unchanged |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 like `_metrics` |
| Path-B / batch-backtest / replay-outcome-join CLI rewrite | Out of this ship |

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
    }
  ]
}
```

## What a FAIL here means

- **List/load non-200 / missing envelope** — someone reshaped session-books research routes while
  adding ensure, or mounted them under a trader path.
- **List miss without closed `detail` or without `authorizes`** — empty ticker / list-miss
  envelope drifted; AC-25 / GATE Q shape broken.
- **Miss path not 404 / wrong body** — silent vendor fill-in on research read, date substitution,
  or collapse of miss into an empty-book shape.
- **Hit 200 missing `source_as_of` or `authorizes`** — provenance / score-posture contract broken.
- **`vendor_called` mistyped or true** — zero-vendor-on-research-read invariant no longer
  machine-checkable.
- **Disabled store returned as miss** — `session archive not storing` collapsed into
  `no session book` (AC-10/AC-13 disjointness broken).
- **Unreadable returned as miss or not-storing** — four-outcome honesty broken.
- **New ensure HTTP route appearing in live inventory** — scope breach; this contract pins only
  the existing session-books GETs.
- **Pages proxy serving `_research`** — trader-origin redistribution.
