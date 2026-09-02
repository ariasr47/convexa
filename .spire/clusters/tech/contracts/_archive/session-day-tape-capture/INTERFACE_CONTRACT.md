# session-day-tape-capture — interface contract

**Spec:** `.spire/clusters/tech/contracts/session-day-tape-capture/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio)
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume these endpoints
**Status:** APPROVED 2026-08-29 — GATE Z AC-32: `NotExpectedPreStore` is not a required 200 class; list `days[].clock` has no pre-store token.

This feature **adds backend surface**. It is **not** `NO_BACKEND_CHANGE`.

It adds (1) sibling operator/research **day-tape list/load** under `/api/_research/` and (2) optional
clap `session-day-tape` on `apps/api/src/main.rs` `Commands`. Capture **write** is an off-request-path
side-effect (Path-A sidecar + Path-B persist inside `refresh_analytics`) — not a trader HTTP write
route and not a playback route. It does **not** nest tape JSON on `GET /api/_metrics`
(`routes/health.rs`). Existing session-book **list/load** stay the session-book vehicle; tape is a
different job and must not reuse `RESEARCH READ — SESSION BOOK`. Combined Path-A + Path-B in one
envelope; no path filter.

Human-facing literals live in `SPEC.md` §4. This file owns **transport and bytes**.

---

## Standing rules

1. **Zero vendor I/O on tape read.** List and load never call Massive, never “refresh if missing,”
   never start ensure, never `set_price`, never `gex_cache.set`, and never subscribe the hub.
   `vendor_called` is always `false` on successful handling (including empty, gap, weekend,
   not-elapsed, no-identity, not-in-watchlist, and not-storing error bodies).
2. **A hole is data:** empty-while-storing, no-identity, weekend, not-elapsed, and
   not-in-watchlist are HTTP **200** with honest framing/detail, never a trader 5xx. Store-level
   not-storing and identity-present unreadable are **500** with closed error codes (same family as
   session-books). `NotExpectedPreStore` is **not** a required 200 class (GATE Z). Named past
   weekday with no day container is `NoIdentity`.
3. **License + edge isolation:** paths stay under `/api/_research/` and are Railway-direct operator
   surfaces. Cloudflare Pages trader origin (`*.pages.dev`) must **404** `/api/_research` and
   `/api/_research/*` the same way `functions/api/[[path]].ts` already 404s `/api/_metrics`. Tape
   must not ship as a trader market-data feed.
4. **Auth posture (Railway-direct):** when `METRICS_SECRET_TOKEN` is set, require the same bearer /
   `X-Metrics-Token` gate used by `GET /api/_metrics` and `routes/research_session_books.rs`
   (`health::metrics_token_ok`). When unset (local), the read is open. These are **not**
   session-cookie trader gates — do **not** mark `"auth": true` on the conformance entries below.
5. **Watchlist is closed:** v1 members are exactly SPY · QQQ · IWM. Axis A evaluates
   **NotInWatchlist before NotStoring** so a foreign symbol is 200 `not in tape watchlist:` even
   when the dedicated root is unset. **IneligibleWeekend before NotElapsed**; **NotElapsed before
   NoIdentity** so a future weekday is not `no session day tape…`. Store derive must **not**
   emit `NotExpectedPreStore`.
6. **Session identity:** `(symbol, et_date)` America/New_York `YYYY-MM-DD`. Load query `et_date`
   uses `parse_et_date`; missing or unparseable ⇒ **422**.
7. **Score posture:** `authorizes` is exactly `nothing` on every 200 tape envelope.
8. **Provenance:** operator envelope and any JSON twin the operator reads must not contain
   `live_massive`, `LiveMassive`, or `MarketDataSourceKind::LiveMassive`. Path-B persist drops that
   discriminant before append. List/load never calls `classify_loaded`.
9. **List/load non-regression:** `GET /api/_research/session-books/{symbol}` and
   `.../{symbol}/book` envelopes, miss `detail` strings, and `vendor_called: false` stay as shipped
   by `session-chain-archive`. Tape framing must not overwrite them.
10. **Capture write is not an HTTP API** in this contract. Conformance checks research list/load
    (and the session-books re-pin) only. Do not invent playback endpoints.
11. **No store-start watermark.** List is stored days only. Do not consult `SESSION_DAY_TAPE_STORE_STARTED`,
    a marker file, `min(present)`, or first-arm-as-start to invent pre-store rows or a pre-store 200.

---

## Closed wire vocabularies (tape)

| Token | Members / exact strings |
| --- | --- |
| HTTP `framing` (200/500 human envelope) | `RESEARCH READ — SESSION DAY TAPE` · `RESEARCH READ — NO SESSION DAY TAPE` · `RESEARCH READ — SESSION DAY TAPE INELIGIBLE WEEKEND` · `RESEARCH READ — SESSION DAY TAPE NOT ELAPSED` · `RESEARCH READ — SESSION DAY TAPE NOT IN WATCHLIST` · `RESEARCH READ — SESSION DAY TAPE NOT STORING` · `RESEARCH READ — SESSION DAY TAPE UNREADABLE` |
| Hit / vouched-read `provenance` | `loaded from session day tape · no vendor call` |
| Miss / no-row `provenance` | `no vendor call` |
| Standing provenance | `research tape · never live_massive · never coverage present` |
| License | `Our research · not redistributed on a trader route.` |
| `authorizes` | exactly `nothing` |
| HTTP `evidence` | `this process` (never `local` on a Railway-origin GET; never `production`) |
| `command` | `session-day-tape` |
| `watchlist` | always `["SPY","QQQ","IWM"]` this slice |
| `path_b_interval` | `5-minute marks 09:30, 09:35, …, 16:00 ET` |
| Path-A event `kind` | `trade` · `quote` (never a collapsed `live_price`) |
| Not-storing `error` | `session_day_tape_not_storing` |
| Unreadable `error` | `session_day_tape_unreadable` |
| List store-fault `error` | `session_day_tape_store_error` |
| Bad date `error` | `et_date_unparseable` |
| Unauthorized `error` | `metrics_unauthorized` (shipped detail: `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`) |
| Not-storing `detail` | exactly `session day tape not storing` |
| Unreadable `detail` | `session day tape unreadable: <reason>` |
| Bad date `detail` | `et_date must be YYYY-MM-DD` |
| Not-in-watchlist `detail` | exactly `not in tape watchlist: <SYMBOL>` |
| Not-elapsed `detail` | exactly `session day tape not elapsed: <SYMBOL> on <ET_DATE>` |
| No-identity `detail` | `no session day tape for <SYMBOL> on <ET_DATE>` (named past weekday with no container uses this class) |

`RESEARCH READ — SESSION DAY TAPE NOT EXPECTED` is **not** a required 200 framing class (GATE Z).
Do not add a live or GATE Q probe that requires it.

Banned framing on this vehicle includes `RESEARCH READ — PATH-A TICKS` and
`RESEARCH READ — PATH-B STRUCTURE SNAPSHOTS` — there is no path filter; the envelope is always
combined.

Coverage cells `present` / `missing` / `not yet due` / `blocked occupancy`, withdrawn tokens
`not_due` / `empty_attempted` / `recording` / `closed` / `complete_rth`, and session-load miss
strings are **not** tape occupancy. Exact operator literals for gaps / partial / through-window
are SPEC §4; they travel in `clock` / `path_a_detail` / `path_b_detail` on `StoringReady` hits
(`detail` is `null` there), and in `detail` on Axis A gate 200s.

**Count identity:** Path-A kind counts and Path-B snapshot counts are independent. Zero is a
number, never the word `missing`. Do not mix both paths into one unnamed `n`.

---

## Endpoints

### 1. `GET /api/_research/session-day-tape/{symbol}` — **NEW** · tape list

List stored tape days for one symbol. **No Massive call.** List is **stored days only** — no
pre-store rows, no future `et_date` rows, no historical failure grid.

Register beside `research_session_books.rs` so Axum cannot bind `session-day-tape` as
`/api/_research/session-books/{symbol}`.

**Path params:** `symbol` (string, upper/trim-normalized).

**Query:**

| Param | Type | Notes |
| --- | --- | --- |
| `limit` | number \| omitted | Optional. When set, must be `>= 1` or **400** `invalid_limit` (same family as session-book list). Returns the newest `limit` rows after sorting by `et_date` ascending. |

**Response (200)** — always shaped for a **not-in-watchlist** symbol, and for a locked-watchlist
symbol when the dedicated tape root is storing (including zero days). Empty store is honest empty,
not an error:

| Path | Type | Notes |
| --- | --- | --- |
| `framing` | string | Closed framing above. Not-in-watchlist: `RESEARCH READ — SESSION DAY TAPE NOT IN WATCHLIST`. Locked-symbol list (including zero days): `RESEARCH READ — SESSION DAY TAPE`. |
| `command` | string | `session-day-tape` |
| `evidence` | string | `this process` |
| `symbol` | string | Normalized symbol |
| `watchlist` | array | Always `["SPY","QQQ","IWM"]` |
| `path_b_interval` | string | Locked interval string above |
| `vendor_called` | boolean | Always `false` |
| `provenance` | string | Hit string when `days` non-empty; `no vendor call` when empty / not-in-watchlist |
| `license` | string | Closed license above |
| `authorizes` | string | Exactly `nothing` |
| `count` | number | `days.length` |
| `days` | array | May be empty. Stored days only. |
| `days[].symbol` | string | |
| `days[].et_date` | string | ET `YYYY-MM-DD` |
| `days[].path_a_trade_count` | number | Vouched trade count (0 is a number) |
| `days[].path_a_quote_count` | number | Vouched quote count |
| `days[].path_b_snapshot_count` | number | |
| `days[].path_b_gap_count` | number | Honest mark-gaps (read-time derive, SPEC §2.3); 0 if none |
| `days[].clock` | string \| null | Short clock cell (`partial` · `through-window · not certified` · `ineligible weekend`) or `null` while still in-window with start ≤ 09:30. **`not expected before storing` is not in this closed set** (list has no pre-store rows). |
| `detail` | string \| null | Not-in-watchlist closed literal; `null` on a locked-symbol list (hit or honest empty `days`) |

There is **no** loading field. There is **no** `market` / `contracts` dump on list. There is **no**
`source: live_massive` field.

**Errors:**

- **400** when `limit` is present and `< 1`: `error: invalid_limit`, `detail: limit must be >= 1`,
  `vendor_called: false`.
- **401** when metrics/research token required and missing/wrong — body `error: metrics_unauthorized`,
  shipped detail; **no** tape days.
- **500** store disabled / unset / unwritable dedicated root **for a locked-watchlist symbol**:
  `error: session_day_tape_not_storing`, `store: error`,
  `detail: session day tape not storing`, `vendor_called: false`,
  `framing: RESEARCH READ — SESSION DAY TAPE NOT STORING` — never a missing grid, never three
  per-symbol empty days. A **not-in-watchlist** symbol still 200s (Axis A order).
- **500** other list I/O: `error: session_day_tape_store_error`, `store: error`,
  `detail: session day tape store error: <reason>`, `vendor_called: false`.

**Live 200 assumption for the NVDA probe below:** Axis A `NotInWatchlist` — does **not** require a
planted tape root. Locked-symbol list 200 requires a dedicated writable non-colliding root (GATE Q
plant); it is not a default live probe because unset root is honest not-storing. NotElapsed is a
**load** class (not a list row) and is not a default live probe: locked-symbol future dates 500
not-storing when the root is unset. There is **no** default live NotExpectedPreStore probe.

### 2. `GET /api/_research/session-day-tape/{symbol}/day` — **NEW** · tape load

Load one tape identity. **No Massive call.** Combined Path-A + Path-B in one envelope (two
sections). Do not add a playback or “play into ticker” route. Do not add a path filter.

**Path params:** `symbol` (string).

**Query:**

| Param | Type | Notes |
| --- | --- | --- |
| `et_date` | string | **Required.** ET calendar date `YYYY-MM-DD`. Missing or unparseable ⇒ **422**. |

**Response (200)** — not-in-watchlist, weekend, not-elapsed, no-identity (including named past
weekday with no container), empty-while-storing, gapped, partial, through-window, and occupied are
all 200 with honest `framing` / `detail` / path counts (SPEC §4). Occupied Path-A/Path-B payloads
ride the arrays; empty arrays are honest zeros, not omissions of the other path.
`NotExpectedPreStore` is **not** a required 200 class.

**`detail` lock (closed):**

- Axis A gate / no-row 200s (`NotInWatchlist`, `IneligibleWeekend`, `NotElapsed`,
  `NoIdentity`): `detail` is the matching closed operator literal
  (SPEC §4). `clock` is `null`. `path_a_detail` and `path_b_detail` are `""`. Arrays empty.
  Counts 0. Named past weekday with no container is `NoIdentity` (`no session day tape…`).
- `StoringReady` content 200s (occupied, empty-while-storing, gapped, partial, through-window,
  in-progress): `detail` is **`null`**. Facts live in `clock` (or `null` per SPEC AC-35),
  `path_a_detail`, `path_b_detail`, and the arrays. Do not duplicate the clock line into `detail`.
- Do **not** require a `NotExpectedPreStore` 200. Store derive must not emit that arm.

| Path | Type | Notes |
| --- | --- | --- |
| `framing` | string | Closed framing above (combined envelope only) |
| `command` | string | `session-day-tape` |
| `evidence` | string | `this process` |
| `symbol` | string | |
| `et_date` | string | Echo of requested identity |
| `watchlist` | array | Always `["SPY","QQQ","IWM"]` |
| `path_b_interval` | string | Locked interval |
| `vendor_called` | boolean | Always `false` |
| `provenance` | string | Hit provenance when a day container exists; `no vendor call` on no-identity / not-in-watchlist / weekend / not-elapsed |
| `license` | string | Closed license |
| `authorizes` | string | Exactly `nothing` |
| `detail` | string \| null | Gate / no-row closed literal, or `null` on `StoringReady` content hits (lock above) |
| `clock` | string \| null | Full partial / through-window literal when it applies; `null` during in-progress RTH with start ≤ 09:30, and on weekend / not-elapsed / not-in-watchlist / no-identity |
| `path_a_trade_count` | number | |
| `path_a_quote_count` | number | |
| `path_a_detail` | string | Path-A section literal or kind-split counts line; `""` on Axis A gate 200s |
| `path_a_ticks` | array | May be empty. Each element is a stored `StreamEvent`-shaped trade or quote — **not** `LivePrice` |
| `path_a_ticks[].kind` | string | `trade` or `quote` |
| `path_a_ticks[].ts_ns` | number | Vendor timestamp when present |
| `path_a_ticks[].price` | number \| null | Trade price; `null` when that kind does not carry it |
| `path_a_ticks[].size` | number \| null | Trade size; `null` when absent |
| `path_a_ticks[].bid` | number \| null | Quote bid; `null` when absent |
| `path_a_ticks[].ask` | number \| null | Quote ask; `null` when absent |
| `path_a_ticks[].bid_size` | number \| null | As on `StreamEvent` |
| `path_a_ticks[].ask_size` | number \| null | As on `StreamEvent` |
| `path_a_gaps` | array | May be empty. Hub/writer gap occupants (writer-flushed coalesced latch; SPEC §2.2) |
| `path_a_gaps[].dropped` | number | Coalesced count of events not appended for that occupant (wire home of ` · {n} dropped`) |
| `path_b_snapshot_count` | number | |
| `path_b_gap_count` | number | Derived mark-gaps (SPEC §2.3); through-window all-missed-refresh is **not** 0 |
| `path_b_detail` | string | Path-B section literal or `path-b snapshots: {k} snapshots · {g} gaps`; `""` on Axis A gate 200s |
| `path_b_snapshots` | array | May be empty. Timed structure snapshots **without** a `source` / `live_massive` field |
| `path_b_snapshots[].mark` | string | `HH:MM` ET on the locked grid |
| `path_b_snapshots[].as_of` | string | RFC 3339 UTC |
| `path_b_gaps` | array | May be empty. Read-time derived mark-gaps (write-time mint optional) |
| `path_b_gaps[].mark` | string | `HH:MM` ET of an honest missing mark |

Path-B snapshot **bodies** (chain/greeks) may ride a nested object for later replay research, but
that object **must not** include `source: live_massive`. Conformance of the default 200 probe does
**not** require inner `market` / `contracts` (the NVDA not-in-watchlist probe has empty arrays).
Element field paths in the conformance block are vacuous on empty arrays and **binding** when
elements exist — a kind-only Path-A stub fails AC-8.

**NotElapsed 200** (locked symbol, storing on, weekday `et_date` after today ET):
`framing: RESEARCH READ — SESSION DAY TAPE NOT ELAPSED`,
`detail: session day tape not elapsed: {SYMBOL} on {ET_DATE}`, `clock: null`,
`path_a_detail` / `path_b_detail` `""`, empty arrays, `vendor_called: false`. Not a default live
probe (unset root is not-storing for locked symbols). GATE Q / unit plants storing.

**NoIdentity 200** (locked symbol, storing on, capturable weekday including a named **past**
weekday, no day container): `framing: RESEARCH READ — NO SESSION DAY TAPE`,
`detail: no session day tape for {SYMBOL} on {ET_DATE}`, `clock: null`, empty arrays,
`vendor_called: false`. Not a distinct pre-store class.

**Errors:**

- **422** when `et_date` is missing or unparseable: `error: et_date_unparseable`,
  `detail: et_date must be YYYY-MM-DD`, `vendor_called: false`.
- **401** when token required and missing/wrong — no tape body.
- **500** not-storing (locked-watchlist symbol only): `error: session_day_tape_not_storing`,
  `store: error`, `detail: session day tape not storing`, `vendor_called: false`.
- **500** identity present but unreadable: `error: session_day_tape_unreadable`, `store: error`,
  `detail: session day tape unreadable: <reason>`, `vendor_called: false` — **no** live Massive
  recovery.

### 3. Existing session-book list/load — **unchanged** (non-regression re-pin)

| Method | Path | Purpose | Auth | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/_research/session-books/{symbol}` | Existing research list. **No Massive.** | metrics token when configured (not session) | 200 miss still shaped; 400 invalid `limit`; 401; 500 not-storing / store-error |
| GET | `/api/_research/session-books/{symbol}/book` | Existing research load. **No Massive.** | same | 404 miss; 422 bad `et_date`; 401; 500 not-storing / unreadable |

Authoritative field lists remain
`.spire/clusters/tech/contracts/_archive/session-chain-archive/INTERFACE_CONTRACT.md`.
This feature does not amend them. Tape ship must not reshape `framing`, miss `detail`, or
`vendor_called`.

---

## Operator CLI (not HTTP; not executed by `interface_conformance.mjs`)

Optional `cargo run -p api-rust -- session-day-tape` with optional `--symbol` / `--et-date`. If
shipped: stdout title `session-day-tape`; **Evidence: local**; same closed literals as HTTP;
weekend / not-elapsed / no-identity / not-in-watchlist exit 0 with
`Not a coverage miss.`; not-storing and unreadable non-zero `[ERROR]`. Must run without
`MASSIVE_API_KEY` and must not construct `MassiveRestClient` / `MarketDataPort::live`. A local
exit 0 is not production coverage. CLI is **not** a substitute for the HTTP surfaces above
(PM: not CLI-only). A distinct not-expected-before-storing CLI class is **not required**.

---

## Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Nested tape object on `GET /api/_metrics` | Wrong I/O model; latency poll must not load a day of ticks |
| Any trader bundle/SSE/scan field | `[operator-vs-trader-path-separation]` |
| Playback / “play into ticker” / fixture-clock HTTP | `day-replay-mock-adapter` is Future; this slice stores |
| Path-A-only or Path-B-only list/load | Combined envelope; no path filter |
| `POST/PUT` capture controls or fill/ensure/reconstruct | Capture is automatic off-path; coverage holes stay holes |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 |
| OPRA / S3 / hist-chain proxy | Culled / other program |
| Third `MarketDataSourceKind` or tape `source: live_massive` | `[present-is-live-paid-only]` |
| Store-start watermark / `SESSION_DAY_TAPE_STORE_STARTED` / pre-store list rows | GATE Z; same residual as coverage (no `since`) |

Do **not** mark `"auth": true`. GATE Q token behavior is unit/HTTP tests with
`METRICS_SECRET_TOKEN`; the kit session-cookie runner is the wrong gate.

---

## Conformance spec

```json
{
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

- **Tape list/load path missing / non-200 on NVDA** — sibling `_research` read not mounted, nested
  on `_metrics`, captured as session-books `{symbol}`, or collapsed into not-storing for a
  foreign symbol (Axis A order broken).
- **422 not returned for `et_date=not-a-date`** — `parse_et_date` not applied, or bad date
  collapsed into a missing / empty tape.
- **Missing envelope fields / mistyped counts** — HTTP twin drifted from the locked list/load
  shape; Path-A and Path-B may have been blended into one unnamed `n`.
- **List/load envelope drift on session-books** — tape ship reshaped session-book list/load
  (SPEC AC-56).
- **`vendor_called` mistyped or absent** — zero-vendor-on-read no longer machine-checkable on
  shape (exact `false` is unit/GATE Q).
- **`live_massive` on a tape envelope** — persist-time discriminant drop failed; coverage
  `present-is-live-paid-only` is at risk.
- **Pages proxy serving `_research`** — trader-origin redistribution.
- **Fan-out on empty `days[]` / `path_a_ticks[]` / `path_b_snapshots[]` / `path_a_gaps[]` /
  `path_b_gaps[]`** — vacuous pass is correct for not-in-watchlist; a FAIL on element shape when
  elements exist means the DTO drifted (kind-only Path-A stubs fail `path_a_ticks[].price` /
  `bid` / `ask` unions).
- **`"auth": true` added later** — kit session-cookie runner would exercise the wrong gate.
- **A required NotExpectedPreStore 200 added later** — GATE Z forbids treating pre-store as a
  required live class; named past weekday with no container is NoIdentity.
