# massive-flat-file-keep — interface contract

**Spec:** `.spire/clusters/tech/contracts/massive-flat-file-keep/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio)
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume these endpoints
**Status:** APPROVED 2026-08-30 — written at R4 alongside `SPEC.md`

This feature **adds backend surface**. It is **not** `NO_BACKEND_CHANGE`.

It adds (1) sibling operator/research **flat-files list/load** under `/api/_research/` and (2) optional
clap `flat-files` on `apps/api/src/main.rs` `Commands`. Keep **write** is an operator CLI side-effect
(SigV4 GET of entitled stocks SIP universe objects, watchlist extract, discard gzip) — not a trader
HTTP write route and not a playback route. Keep **skips GET per entitled class** when any locked name
already has a content-hit occupant (`kept` or `empty extract`) for `(D, class)` (SPEC AC-54; AC-1/AC-2
do not apply on that class’s skip path). Quotes with no content-hit still GET. Whole-command files-call
is 0 and keep CLI is the skip-GET `[OK]` exit 0 story **only when both** classes have a content-hit.
It does **not** nest corpus JSON on `GET /api/_metrics` (`routes/health.rs`). Existing session-book
**list/load** stay the session-book vehicle; existing session-day-tape **list/load** stay the tape
vehicle. This is a **new vehicle**, not tape: do not reuse tape `days[]`, Path-A/Path-B fields, or
`RESEARCH READ — SESSION DAY TAPE` framing.

Human-facing literals live in `SPEC.md` §4. This file owns **transport and bytes**.

---

## Standing rules

1. **Zero vendor I/O on flat-files read.** List and load never call Massive REST/WS, never call
   files.massive.com, never “refresh if missing,” never start ensure, never `set_price`, never
   `gex_cache.set`, and never subscribe the hub. `vendor_called` is always `false` on successful
   handling (including empty list, no stored extract on dated load, miss-from-sidecar, weekend,
   not-elapsed, not-in-watchlist, and not-storing / refuse-to-mix / unreadable error bodies).
2. **A hole is data:** not-in-watchlist, weekend, not-elapsed, no stored extract (dated load),
   proved miss (persisted 404 record with **zero** locked extracts for that class/day), empty
   extract, occupied, and mixed-**class** 200s are HTTP **200** with honest framing/detail per
   SPEC §4 precedence, never a trader 5xx. Store-level not-storing and refuse-to-mix are **500**.
   Unreadable is **500** when **neither** class is a content hit (`kept` / `empty extract`) —
   including sibling **miss**, **no stored extract**, **or both classes unreadable**. Content-hit
   + sibling unreadable stays **200**. Do **not** call S3 to confirm an inspect miss.
3. **License + edge isolation:** paths stay under `/api/_research/` and are Railway-direct operator
   surfaces. Cloudflare Pages trader origin (`*.pages.dev`) must **404** `/api/_research` and
   `/api/_research/*` the same way `functions/api/[[path]].ts` already 404s `/api/_metrics`. Extracts
   must not ship as a trader market-data feed.
4. **Auth posture (Railway-direct):** when `METRICS_SECRET_TOKEN` is set, require the same bearer /
   `X-Metrics-Token` gate used by `GET /api/_metrics` and `routes/research_session_books.rs`
   (`health::metrics_token_ok`). When unset (local), the read is open. These are **not**
   session-cookie trader gates — do **not** mark `"auth": true` on the conformance entries below.
   GATE Q token behavior is unit/HTTP tests with `METRICS_SECRET_TOKEN`; the kit session-cookie
   runner is the wrong gate.
5. **Watchlist is closed:** v1 members are exactly SPY · QQQ · IWM. Axis A evaluates
   **NotInWatchlist before NotStoring / RefuseToMix** so a foreign symbol is 200
   `not in flat-files watchlist:` even when the dedicated root is unset. On **load**:
   **IneligibleWeekend before NotElapsed**; **NotElapsed before no-stored-extract** so a future
   weekday is not `flat files no stored extract…`. List has no `et_date`; empty locked-symbol list
   is hit framing + empty `extracts[]`, not `no stored extract`.
6. **Session identity:** extract grain `(symbol, et_date, class)` America/New_York `YYYY-MM-DD`
   with `class` ∈ {`trades`, `quotes`} only. Load query `et_date` uses `parse_et_date`; missing or
   unparseable ⇒ **422**. Combined trades+quotes envelope on load (two independent class sections,
   **one** round-trip). Envelope `framing` / `detail` follow SPEC §4 load-envelope precedence
   (unreadable store-fault **before** miss envelope). **No aggregates field, column, or class
   token** this slice — omit it; do not print `0 aggregates`.
7. **Score posture:** `authorizes` is exactly `nothing` on every 200 flat-files envelope.
8. **Provenance:** operator envelope and any JSON twin the operator reads must not contain
   `live_massive`, `LiveMassive`, `MarketDataSourceKind::LiveMassive`, `present` as this occupancy,
   `Stored`, `Unattempted`, `live-tape`, or `live-paid-present`. Load never calls `classify_loaded`.
   Research load returns **extract CSV only**, never a universe gzip body. Hit provenance
   (`loaded from Massive flat files · no REST/WS call`) only when at least one class (load) or at
   least one `extracts[]` row (list) is `kept` or `empty extract`. Miss-only, unreadable-only,
   empty list, and no-stored-extract load use `no vendor call`.
9. **List/load non-regression:** `GET /api/_research/session-books/{symbol}` and
   `.../{symbol}/book` envelopes, miss `detail` strings, `source` / coverage-adjacent `present`
   meaning, and `vendor_called: false` stay as shipped by `session-chain-archive`.
   `GET /api/_research/session-day-tape/{symbol}` list envelope (`path_b_interval`, `days[]`, tape
   framing) stays as shipped by `session-day-tape-capture`. This vehicle must not overwrite either.
10. **Keep write is not an HTTP API** in this contract. Conformance checks research list/load
    (and the session-books + tape re-pins) only. Do not invent playback, keep-POST, or “play into
    ticker” endpoints. Keep **skips GET per entitled class** when any locked name already has `kept`
    or `empty extract` for `(D, class)`. That class skip is not a keep failure: never persist a miss
    sidecar for `(D, class)` if any locked extract exists for that pair. Completing missing names
    after skip-GET is Future. Whole-command files-call is 0 and keep CLI is the skip-GET `[OK]`
    exit 0 story **only when both** classes have a content-hit. A trades-only content-hit plant
    still GETs quotes (SPEC AC-54). Mixed-class keep process exit is **non-zero** if any class this
    invocation is miss, download-failed, unreadable, unauthorized, not-storing, or refuse-to-mix;
    **0** only when every class is skip-GET success or a successful GET that stored `kept` /
    `empty extract`. AC-1/AC-2 occupancy on a successful GET is `kept` or `empty extract`.
11. **List is stored occupants only** (kept / empty extract / unreadable pointers / persisted miss
    records). Miss rows only for a `(D, class)` with **zero** locked extracts. No future `et_date`
    rows, no historical download-failed grid, no missing-files-credentials / wrong-credential-class
    rows, no `no stored extract` rows, no aggregates rows. Leftover keep temps are not occupants.
    Do not list QQQ `miss` for trades while SPY trades is `kept`.
12. **Crash-temp is not stored.** Classify discards or ignores leftover temp from a crashed keep.
    Dated load of that D with no promoted extract and no proved-absence record is `no stored extract`,
    not unreadable, not a download-failed grid. Partial-trio: promoted extract remains; missing
    names stay `no stored extract`; later keep skips GET **for that class**; the other class with
    no content-hit still GETs.

---

## Closed wire vocabularies (this vehicle)

| Token | Members / exact strings |
| --- | --- |
| HTTP `framing` (200/500 human envelope) | `RESEARCH READ — MASSIVE FLAT FILES` · `RESEARCH READ — NO MASSIVE FLAT FILES` · `RESEARCH READ — MASSIVE FLAT FILES NOT ELAPSED` · `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE WEEKEND` · `RESEARCH READ — MASSIVE FLAT FILES NOT IN WATCHLIST` · `RESEARCH READ — MASSIVE FLAT FILES NOT STORING` · `RESEARCH READ — MASSIVE FLAT FILES UNREADABLE` · `RESEARCH READ — MASSIVE FLAT FILES REFUSE TO MIX` |
| Hit / vouched-read `provenance` | `loaded from Massive flat files · no REST/WS call` (only when ≥1 content hit: `kept` or `empty extract`) |
| Miss / no-row / gate / empty-list `provenance` | `no vendor call` |
| Standing provenance | `reconstructed flat file · never live_massive · never coverage present · never session day tape` |
| License | `Our research · not redistributed as a live vendor feed.` |
| `authorizes` | exactly `nothing` |
| HTTP `evidence` | `this process` (never `local` on a Railway-origin GET; never `production`) |
| `command` | `flat-files` |
| `watchlist` | always `["SPY","QQQ","IWM"]` this slice |
| Extract `class` | `trades` · `quotes` only (never `aggregates`, never `trades_v1` as the operator token) |
| List 200 `extracts[].occupancy` | `kept` · `empty extract` · `miss` · `unreadable` |
| Load 200 `trades_occupancy` / `quotes_occupancy` | `kept` · `empty extract` · `miss` · `no stored extract` · `not-elapsed` · `ineligible weekend` · `not-in-watchlist` · `unreadable` (sibling of a content hit only) |
| Keep-only (CLI keep; **never** list/load DTO occupancy) | `download failed` · `missing-files-credentials` · `wrong-credential-class` |
| Keep skip-GET (CLI keep; **not** a list/load occupancy) | per-class sibling content-hit; named missing symbol durable state is `no stored extract` only; whole-command `[OK]` exit 0 + `Vendor I/O: 0` **only when both** classes have a content-hit |
| Not-storing `error` | `massive_flat_files_not_storing` |
| Refuse-to-mix `error` | `massive_flat_files_refuse_to_mix` |
| Unreadable `error` | `massive_flat_files_unreadable` |
| List store-fault `error` | `massive_flat_files_store_error` |
| Bad date `error` | `et_date_unparseable` |
| Unauthorized `error` | `metrics_unauthorized` (shipped detail: `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`) |
| Not-storing `detail` | exactly `flat files not storing` |
| Refuse-to-mix `detail` | exactly `flat files refuse to mix` |
| Unreadable `detail` | `flat files unreadable: <reason>` |
| Bad date `detail` | `et_date must be YYYY-MM-DD` |
| Not-in-watchlist `detail` | exactly `not in flat-files watchlist: <SYMBOL>` |
| Not-elapsed `detail` | exactly `flat files not elapsed: vendor file for <ET_DATE> not yet published` |
| Ineligible weekend `detail` | exactly `flat files ineligible weekend: <ET_DATE>` |
| No stored extract `detail` | exactly `flat files no stored extract: <ET_DATE>` |
| Miss `detail` (envelope, only when neither class is a content hit, neither is unreadable, and ≥1 class is miss) | exactly `flat files miss: vendor file for <ET_DATE> due and absent` |

Banned framing on this vehicle includes `RESEARCH READ — SESSION DAY TAPE`, `RESEARCH READ — SESSION BOOK`, `RESEARCH READ — SESSION ARCHIVE COVERAGE`, `RESEARCH REPLAY — NOT LIVE`, `RESEARCH READ — PATH-A TICKS`, and any aggregates kind.

Coverage cells `present` / `missing` / `not yet due` / `blocked occupancy`, type names `Stored` /
`Unattempted` / `ExtractEmpty`, and poison tokens `live` / `LIVE` / `live_massive` / `Live tape` /
`live-tape` / `live-paid-present` are **not** this occupancy. Exact operator literals live in SPEC §4.

**Count identity:** trades row counts and quotes row counts are independent. Zero on a present file
is empty extract **with occupancy token `empty extract`**, never the word `miss` and never a bare
`0` on CLI list. Do not mix both classes into one unnamed `n`. Do not emit an aggregates count.
Same `(D, class)` never lists `miss` for one locked name while another is `kept` / `empty extract`.

---

## Endpoints

### 1. `GET /api/_research/flat-files/{symbol}` — **NEW** · extract list

List stored extract identities (and persisted miss records) for one symbol. **No Massive call.
No files S3 call.** List is **stored occupants only**. No `et_date` query.

Register beside `research_session_books.rs` so Axum cannot bind `flat-files` as
`/api/_research/session-books/{symbol}`.

**Path params:** `symbol` (string, upper/trim-normalized).

**Query:**

| Param | Type | Notes |
| --- | --- | --- |
| `limit` | number \| omitted | Optional. When set, must be `>= 1` or **400** `invalid_limit` (same family as session-book list). **Two steps:** (1) sort stored extracts by `et_date` ascending, then `class` (`trades` before `quotes`); (2) keep the **newest** `limit` rows of that sequence (the last `limit` after the sort) and **emit that window still ascending** (`et_date` then class). Do not truncate the ascending list from the front (that would return the oldest). |

**Response (200)** — always shaped for a **not-in-watchlist** symbol, and for a locked-watchlist
symbol when the dedicated root is storing (including zero extracts). Empty store is honest empty,
not an error, not `no stored extract`, not miss:

| Path | Type | Notes |
| --- | --- | --- |
| `framing` | string | Closed framing above. Not-in-watchlist: `RESEARCH READ — MASSIVE FLAT FILES NOT IN WATCHLIST`. Locked-symbol list (including zero extracts): `RESEARCH READ — MASSIVE FLAT FILES`. |
| `command` | string | `flat-files` |
| `evidence` | string | `this process` |
| `symbol` | string | Normalized symbol |
| `watchlist` | array | Always `["SPY","QQQ","IWM"]` |
| `vendor_called` | boolean | Always `false` |
| `provenance` | string | Hit string **only** when at least one `extracts[]` row is `kept` or `empty extract`. Empty list, miss-only list, and unreadable-only list: `no vendor call`. |
| `license` | string | Closed license above |
| `authorizes` | string | Exactly `nothing` |
| `count` | number | `extracts.length` |
| `extracts` | array | May be empty. Stored occupants only. **No aggregates elements.** Miss rows only when that `(et_date, class)` has zero locked extracts. |
| `extracts[].symbol` | string | |
| `extracts[].et_date` | string | ET `YYYY-MM-DD` |
| `extracts[].class` | string | `trades` or `quotes` only |
| `extracts[].occupancy` | string | List 200 set only: `kept` · `empty extract` · `miss` · `unreadable` |
| `extracts[].row_count` | number | Vouched extract rows (0 is a number on empty extract / miss record — occupancy tells them apart) |
| `detail` | string \| null | Not-in-watchlist closed literal; `null` on a locked-symbol list (hit or honest empty `extracts`) |

There is **no** loading field. There is **no** universe gzip body. There is **no** `source: live_massive`
field. There is **no** `aggregates` field. There is **no** `download failed` /
`missing-files-credentials` / `wrong-credential-class` / `no stored extract` occupancy on list.

**Errors:**

- **400** when `limit` is present and `< 1`: `error: invalid_limit`, `detail: limit must be >= 1`,
  `vendor_called: false`.
- **401** when metrics/research token required and missing/wrong — body `error: metrics_unauthorized`,
  shipped detail; **no** extracts.
- **500** store disabled / unset / unwritable dedicated root **for a locked-watchlist symbol**:
  `error: massive_flat_files_not_storing`, `store: error`,
  `detail: flat files not storing`, `vendor_called: false`,
  `framing: RESEARCH READ — MASSIVE FLAT FILES NOT STORING` — never a missing grid. A
  **not-in-watchlist** symbol still 200s (Axis A order).
- **500** keep-root collision **for a locked-watchlist symbol**:
  `error: massive_flat_files_refuse_to_mix`, `store: error`,
  `detail: flat files refuse to mix`, `vendor_called: false`,
  `framing: RESEARCH READ — MASSIVE FLAT FILES REFUSE TO MIX`. Desk `serve` still bound.
- **500** other list I/O: `error: massive_flat_files_store_error`, `store: error`,
  `detail: massive flat files store error: <reason>`, `vendor_called: false`.

**Live 200 assumption for the NVDA probe below:** Axis A `NotInWatchlist` — does **not** require a
planted keep root. Locked-symbol list 200 requires a dedicated writable non-colliding root (GATE Q
plant); it is not a default live probe because unset root is honest not-storing.

### 2. `GET /api/_research/flat-files/{symbol}/extract` — **NEW** · extract load

Load one `(symbol, et_date)` identity’s trades and quotes extracts. **No Massive call. No files S3
call.** Combined trades + quotes in one envelope (two independent class sections, **one**
round-trip). Do not add a playback or “play into ticker” route. Do not add a class filter this
slice. Do not return a universe gzip body.

**Path params:** `symbol` (string).

**Query:**

| Param | Type | Notes |
| --- | --- | --- |
| `et_date` | string | **Required.** ET calendar date `YYYY-MM-DD`. Missing or unparseable ⇒ **422**. |

**Response (200)** — not-in-watchlist, weekend, not-elapsed, no stored extract, proved miss
(zero locked extracts for that class), empty extract, occupied, and **mixed-class** identities
are all 200 with honest `framing` / `detail` / per-class occupancy per the lock below. Occupied
extract CSV rides `trades_extract` / `quotes_extract`; empty strings are honest zeros on Axis A
gates, miss, no stored extract, **and unreadable siblings**.

**Load envelope lock (closed; GATE Q twins).** Content hit = `kept` or `empty extract`. Evaluate
Axis A first (both classes inherit). Then **unreadable store-fault before miss envelope**:

1. If **either** class is a content hit → `framing: RESEARCH READ — MASSIVE FLAT FILES`;
   envelope `detail` is **`null`** (never the miss literal). Per-class occupancy stays on
   `trades_occupancy` / `quotes_occupancy`. A miss sibling (other **class**, zero locked extracts
   for that class) is occupancy `miss` on **that class field**, not envelope `detail`. An
   unreadable sibling is occupancy `unreadable` on that class field; that class’s extract body is
   `""` (occupancy carries the class; do not dump a partial).
2. Else if **neither** class is a content hit and **at least one** class is unreadable (durable
   pointer) — sibling miss, no stored extract, **or also unreadable** → HTTP **500**
   `massive_flat_files_unreadable`, `detail: flat files unreadable: <reason>`. **Not** a 200 miss
   envelope. Both classes unreadable is this 500.
3. Else if **neither** class is a content hit, neither is unreadable, and **at least one** is
   proved `miss` → `framing: RESEARCH READ — NO MASSIVE FLAT FILES`; envelope `detail` is
   `flat files miss: vendor file for {ET_DATE} due and absent`. Sibling occupancy may be `miss`
   or `no stored extract`.
4. Else both classes `no stored extract` (due, no occupant, no proved 404, leftover temp ignored,
   or missing name after skip-GET) → `framing: RESEARCH READ — NO MASSIVE FLAT FILES`; envelope
   `detail` is `flat files no stored extract: {ET_DATE}`.
5. Axis A not-in-watchlist / weekend / not-elapsed: framing and `detail` are the matching closed
   literals (SPEC §4); both occupancies match the gate; extract strings `""`; counts 0.

**Required mixed twins** (reverse classes equally):

| Plant | status | `framing` / error | envelope `detail` | `trades_occupancy` | `quotes_occupancy` |
| --- | --- | --- | --- | --- | --- |
| trades kept, quotes miss (quotes: zero locked extracts) | 200 | `RESEARCH READ — MASSIVE FLAT FILES` | `null` | `kept` | `miss` |
| trades empty extract, quotes miss | 200 | `RESEARCH READ — MASSIVE FLAT FILES` | `null` | `empty extract` | `miss` |
| trades kept, quotes no stored extract | 200 | `RESEARCH READ — MASSIVE FLAT FILES` | `null` | `kept` | `no stored extract` |
| trades kept, quotes unreadable | 200 | `RESEARCH READ — MASSIVE FLAT FILES` | `null` | `kept` | `unreadable` (`quotes_extract` `""`) |
| trades unreadable, quotes miss | **500** | `massive_flat_files_unreadable` | `flat files unreadable: <reason>` | (error body) | |
| trades unreadable, quotes no stored extract | **500** | `massive_flat_files_unreadable` | `flat files unreadable: <reason>` | | |
| both classes unreadable | **500** | `massive_flat_files_unreadable` | `flat files unreadable: <reason>` | (error body) | |
| trades miss, quotes miss | 200 | `RESEARCH READ — NO MASSIVE FLAT FILES` | miss literal | `miss` | `miss` |
| trades miss, quotes no stored extract | 200 | `RESEARCH READ — NO MASSIVE FLAT FILES` | miss literal | `miss` | `no stored extract` |
| both no stored extract | 200 | `RESEARCH READ — NO MASSIVE FLAT FILES` | no stored extract literal | `no stored extract` | `no stored extract` |

| Path | Type | Notes |
| --- | --- | --- |
| `framing` | string | Closed framing; mixed-class uses the lock above |
| `command` | string | `flat-files` |
| `evidence` | string | `this process` |
| `symbol` | string | |
| `et_date` | string | Echo of requested identity |
| `watchlist` | array | Always `["SPY","QQQ","IWM"]` |
| `vendor_called` | boolean | Always `false` |
| `provenance` | string | Hit provenance when **at least one** of trades/quotes occupancy is `kept` or `empty extract`; `no vendor call` on no stored extract / not-in-watchlist / weekend / not-elapsed / miss-only (neither content hit) |
| `license` | string | Closed license |
| `authorizes` | string | Exactly `nothing` |
| `detail` | string \| null | Per the lock above — **null** whenever either class is a content hit |
| `trades_occupancy` | string | Load 200 occupancy set |
| `trades_row_count` | number | 0 on gates / empty extract / miss / no stored extract / unreadable sibling |
| `trades_extract` | string | Watchlist-filtered CSV text for trades; `""` on Axis A gates, miss, no stored extract, **and unreadable sibling**. **Never** universe CSV. Occupancy carries unreadable; do not dump a partial. |
| `quotes_occupancy` | string | Load 200 occupancy set |
| `quotes_row_count` | number | |
| `quotes_extract` | string | Same rules as `trades_extract`. |

There is **no** `aggregates_*` path. There is **no** `path_a_*` / `path_b_*` / `clock` tape field.
There is **no** `download failed` / `missing-files-credentials` / `wrong-credential-class` on
these occupancy fields.

**NotElapsed 200** (locked symbol, storing on, weekday `et_date` after today ET):
`framing: RESEARCH READ — MASSIVE FLAT FILES NOT ELAPSED`,
`detail: flat files not elapsed: vendor file for {ET_DATE} not yet published`,
both occupancies `not-elapsed`, counts 0, extract strings `""`, `vendor_called: false`. Not a
default live probe (unset root is not-storing for locked symbols). GATE Q / unit plants storing.

**No stored extract 200** (locked symbol, storing on, due weekday, no promoted extract, no
proved-absence record, leftover temp ignored, or missing name after skip-GET):
`framing: RESEARCH READ — NO MASSIVE FLAT FILES`,
`detail: flat files no stored extract: {ET_DATE}`, occupancies `no stored extract`,
`vendor_called: false`. Not miss. Not the undated list.

**Errors:**

- **422** when `et_date` is missing or unparseable: `error: et_date_unparseable`,
  `detail: et_date must be YYYY-MM-DD`, `vendor_called: false`.
- **401** when token required and missing/wrong — no extract body.
- **500** not-storing (locked-watchlist symbol only): `error: massive_flat_files_not_storing`,
  `store: error`, `detail: flat files not storing`, `vendor_called: false`.
- **500** refuse-to-mix (locked-watchlist symbol only): `error: massive_flat_files_refuse_to_mix`,
  `store: error`, `detail: flat files refuse to mix`, `vendor_called: false`.
- **500** unreadable when **neither** class is a content hit and a promoted pointer exists
  (**including** sibling miss, no stored extract, **or both classes unreadable**):
  `error: massive_flat_files_unreadable`, `store: error`,
  `detail: flat files unreadable: <reason>`, `vendor_called: false` — **no** live Massive
  recovery. Content-hit + sibling unreadable is **200**, not this 500.

### 3. Existing session-book list/load — **unchanged** (non-regression re-pin)

| Method | Path | Purpose | Auth | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/_research/session-books/{symbol}` | Existing research list. **No Massive.** | metrics token when configured (not session) | 200 miss still shaped; 400 invalid `limit`; 401; 500 not-storing / store-error |
| GET | `/api/_research/session-books/{symbol}/book` | Existing research load. **No Massive.** | same | 404 miss; 422 bad `et_date`; 401; 500 not-storing / unreadable |

Authoritative field lists remain
`.spire/clusters/tech/contracts/_archive/session-chain-archive/INTERFACE_CONTRACT.md`.
This feature does not amend them. Flat-files ship must not reshape `framing`, miss `detail`,
`source`, or `vendor_called`. Coverage `present` remains a loadable `LiveMassive` book on **that**
vehicle — never a flat-files occupancy.

### 4. Existing session-day-tape list — **unchanged** (non-regression re-pin)

| Method | Path | Purpose | Auth | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/_research/session-day-tape/{symbol}` | Existing tape list. **No Massive.** | metrics token when configured (not session) | 200 not-in-watchlist still shaped; 400 invalid `limit`; 401; 500 not-storing |

Authoritative field lists remain
`.spire/clusters/tech/contracts/_archive/session-day-tape-capture/INTERFACE_CONTRACT.md`.
This feature does not amend them. Required fields on the NVDA tape-list probe **must match** that
shipped contract (`path_b_interval`, `days`, tape framing). Flat-files ship must not overwrite
tape identity with extract occupancy.

---

## Operator CLI (not HTTP; not executed by `interface_conformance.mjs`)

Optional `cargo run -p api-rust -- flat-files` with an explicit **keep** action as the only
files-product GET, and a read-only inspect/list invocation. Optional `--symbol` / `--et-date`.
Stdout title `flat-files`; **Evidence: local**; same closed literals as HTTP (SPEC §4). Weekend /
not-elapsed / both-classes no stored extract / not-in-watchlist / empty-extract inspect exit 0 with
`Not a miss.` where SPEC §4 requires it. Keep miss / download failed / not-storing / unreadable /
refuse-to-mix / credential refuses / unauthorized are non-zero `[ERROR]`. Keep **skip-GET of a
class** (sibling content-hit for that class) is **not** that `[ERROR]` family for that class.
Must run without `MASSIVE_API_KEY` as a requirement and must not use that value as SigV4 material.
A local exit 0 is not production coverage. CLI is **not** a substitute for the HTTP surfaces above
(not CLI-only). Keep is **not** an HTTP path in this contract.

Keep **skips GET per entitled class** when any locked name already has `kept` or `empty extract`
for `(D, class)`. That class skip is a **successful skip for that class**, not a keep failure:
print sibling `kept from Massive flat files` or `empty extract`; named missing symbol
`no stored extract`; files-call 0 **for that class**; **Not a miss** (that class). Never
`[ERROR] download failed` for a class that issued no GET. Durable missing-name state is
**`no stored extract` only** — never miss, never download-failed occupancy on list/load.
Completing missing names is Future.

**Whole-command skip-GET `[OK]`** — **only when both** classes have a content-hit: print
`[OK] flat-files — {SIBLING} kept from Massive flat files · {NAMED} no stored extract · Vendor I/O: 0 files GET`,
**Not a miss.**, **exit 0**. Never `[ERROR] download failed`.

**Mixed-class keep** (one class skips, the other GETs — SPEC AC-54 plant: SPY kept for
`(D, trades)` only): **trades** files-call 0; quotes still GET. Do **not** print whole-command
`Vendor I/O: 0 files GET`. Do **not** require keep CLI exit 0 on that plant. Quotes follow
AC-1 / AC-2 / AC-3 / AC-14 / AC-16 independently. Never print trades miss beside SPY keep.

**Mixed-class keep process exit.** Process exit is **non-zero** if **any** class this invocation
is miss, download-failed, unreadable, unauthorized, not-storing, or refuse-to-mix. Process exit
is **0** only when **every** class this invocation is either skip-GET success or a successful GET
that stored `kept` / `empty extract`. A trades skip does not force exit 0 while quotes miss or
download-failed. Both-classes content-hit is the skip-GET `[OK]` exit 0 story.

**CLI list** prints a per-class occupancy token from the list 200 deck (`kept` · `empty extract` ·
`miss` · `unreadable`) next to row count. A miss sidecar is occupancy `miss` and 0 rows **only**
for a `(D, class)` with zero locked extracts; an empty extract is occupancy `empty extract` and 0
rows. Do not print a bare `0` without occupancy. Dated inspect (`--et-date`) is the home of
`no stored extract`; undated list is not.

**CLI dated inspect mixed-class** — same precedence as HTTP load (SPEC §4 table). Per-class
occupancy lines. Exit **0** only when at least one class is `kept` or `empty extract` and neither
is `unreadable`, **or** both classes are `no stored extract` / Axis A weekend / not-elapsed /
not-in-watchlist. Either class `unreadable` (including both unreadable) → non-zero. Miss-only
(both miss, or miss + no stored extract, no content hit) → non-zero. Inspect exit is not keep
process exit.

---

## Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Nested corpus object on `GET /api/_metrics` | Wrong I/O model; latency poll must not load a day of ticks |
| Any trader bundle/SSE/scan field | `[operator-vs-trader-path-separation]` |
| Playback / “play into ticker” / fixture-clock HTTP | Replay walks day_tape; this slice stores extracts |
| Keep POST / fill / ensure / reconstruct | Keep is operator clap; coverage holes stay holes |
| A second load round-trip per class | Combined envelope; mixed occupancy uses class fields |
| Aggregates list/load field or class | Human ruling Out this slice; omit, do not print `0` |
| Universe gzip body on list/load | Durable occupant is the extract; gzip discarded |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 |
| OPRA / hist-chain / indices / crypto proxy | Culled / other program |
| Fourth `MarketDataSourceKind` or extract `source: live_massive` | `[present-is-live-paid-only]` |
| Tape `days[]` / `path_a_*` / `path_b_*` on this envelope | Different vehicle |

Do **not** mark `"auth": true`. GATE Q token behavior is unit/HTTP tests with
`METRICS_SECRET_TOKEN`; the kit session-cookie runner is the wrong gate.

---

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/flat-files/{symbol}",
      "path_params": { "symbol": "NVDA" },
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "count": "number",
        "extracts": "array",
        "extracts[].symbol": "string",
        "extracts[].et_date": "string",
        "extracts[].class": "string",
        "extracts[].occupancy": "string",
        "extracts[].row_count": "number",
        "detail": "string|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/flat-files/{symbol}/extract",
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
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "detail": "string|null",
        "trades_occupancy": "string",
        "trades_row_count": "number",
        "trades_extract": "string",
        "quotes_occupancy": "string",
        "quotes_row_count": "number",
        "quotes_extract": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/flat-files/{symbol}/extract",
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
    },
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
    }
  ]
}
```

## What a FAIL here means

- **Flat-files list/load path missing / non-200 on NVDA** — sibling `_research` read not mounted,
  nested on `_metrics`, captured as session-books `{symbol}`, captured as session-day-tape
  `{symbol}`, or collapsed into not-storing for a foreign symbol (Axis A order broken).
- **422 not returned for `et_date=not-a-date`** — `parse_et_date` not applied, or bad date
  collapsed into a missing / empty extract / miss.
- **Missing envelope fields / mistyped counts** — HTTP twin drifted from the locked list/load
  shape; trades and quotes may have been blended into one unnamed `n`, or an `aggregates` field
  appeared.
- **Mixed-class load uses miss envelope `detail` while a sibling is `kept` / `empty extract`** —
  SPEC AC-4 / §4 precedence broken; implementer invented a single-situation envelope.
- **Unreadable + miss (or no stored extract, or both unreadable) returns 200 miss envelope** —
  SPEC AC-55; store fault must be 500.
- **List/load envelope drift on session-books** — flat-files ship reshaped session-book list/load
  (SPEC AC-35–37). Coverage `present` meaning is at risk.
- **Tape list envelope drift** — flat-files ship overwrote tape framing / `path_b_interval` /
  `days[]` (SPEC AC-38).
- **`vendor_called` mistyped or absent** — zero-vendor-on-read no longer machine-checkable on
  shape (exact `false` is unit/GATE Q).
- **`live_massive` / `present` / `Stored` / `Unattempted` on a flat-files envelope** — occupancy
  print or persist-time discriminant failed; `present-is-live-paid-only` is at risk.
- **Universe gzip body on load** — extract-only ruling broken.
- **Pages proxy serving `_research`** — trader-origin redistribution.
- **Fan-out on empty `extracts[]`** — vacuous pass is correct for not-in-watchlist; a FAIL on
  element shape when elements exist means the DTO drifted (an aggregates-only stub would fail
  `extracts[].class` closed membership at GATE Q).
- **`"auth": true` added later** — kit session-cookie runner would exercise the wrong gate.
- **Keep-only occupancy (`download failed` / credential refuses) on list/load DTO** — keep vs
  read split broken.
- **Miss occupancy for QQQ trades while SPY trades is kept** — skip-GET / no-miss-beside-keep
  (SPEC AC-54) broken. AC-1/AC-2 do not require storing QQQ on that path.
- **Whole-command `Vendor I/O: 0` / keep exit 0 on a trades-only content-hit plant** — AC-54
  per-class I/O lock broken; quotes must still GET; mixed-class keep exit applies.
