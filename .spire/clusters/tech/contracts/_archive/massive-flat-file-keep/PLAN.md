# massive-flat-file-keep — implementation plan

> **For agentic workers:** implement task-by-task, in order inside a lane. Steps use checkbox
> (`- [ ]`) syntax. Each task carries its own TDD cycle: write the failing test → run it, watch it
> fail → implement minimally → run it, watch it pass → commit. If this plan contradicts the tree,
> **report the conflict — do not resolve it silently** (`PLAN_METHOD.md`, "Plans are code").
> Do not edit `SPEC.md` or `INTERFACE_CONTRACT.md`.

**Goal:** After the Massive D+1 11:00 ET publish clock, an operator keep stores watchlist-filtered
stocks SIP **trades** and **quotes** extracts for SPY / QQQ / IWM on a dedicated research root, with
zero-vendor `_research` list/load and **no trader UI**.

**Architecture:** New one-way leaf `apps/api/src/services/flat_file_keep/` (score / gate /
fingerprint / ensure / coverage / `quant-engine` / day_tape writers / `session_chain_archive` do
not import it) plus a files client at `apps/api/src/infrastructure/flatfiles/` (not under
`infrastructure/massive/`). Keep is operator clap off the trader request path: SigV4 GET of the
universe gzip, extract locked names, discard gzip. HTTP adapter
`routes/research_flat_files.rs` sits beside `research_session_books.rs`. This is a **new vehicle**,
not tape: no `days[]`, no Path-A/Path-B, no `MarketDataSourceKind` fourth arm. Serve never
constructs the files client.

**Tech stack:** Rust 2021 · Axum/Tokio (`apps/api`, crate `api-rust`) · clap 4 · `chrono` +
`chrono_tz::America::New_York` · existing `reqwest` + `hmac` + `sha2` + `hex` (SigV4; **no**
`aws-sdk-*`) · add reqwest **`stream`**, **`flate2`**, **`csv`**. Tests:
`cargo test -p api-rust --locked` (add `-p quant-engine` in the closer; `-- --test-threads=1` only
if a coverage-env flake appears). OpenAPI graph **55 → 57** (two new GETs). Frontend: SPEC §4
`NO_UI_CHANGE` — **structural-absence tests only**; do not invent trader UI.

**Spec:** `.spire/clusters/tech/contracts/massive-flat-file-keep/SPEC.md` (APPROVED 2026-08-30)
**Interface:** `.spire/clusters/tech/contracts/massive-flat-file-keep/INTERFACE_CONTRACT.md`

---

## S2 Important residual (settled for this plan — not GATE Z)

SPEC §4 Flow 1 / §6 summary / §7 invariants / §9 still **conjoin** whole-command `files-call 0`
with the exit-0 predicate that includes a successful GET. That lagging summary is **wrong** next
to ship-blocking AC-54, SPEC §5, and INTERFACE standing rule 10.

**Implement these, not the lagging prose:**

- Skip-GET and files-call counts are **per entitled class**.
- Whole-command `Vendor I/O: 0 files GET` and the skip-GET `[OK]` exit-0 line print **only when
  both** classes have a content-hit (`kept` or `empty extract`) and neither class issued a GET.
- Keep process exit is **0** only when **every** class this invocation is skip-GET success **or** a
  successful GET that stored `kept` / `empty extract` (that path has files-call ≥1).
- A trades-only content-hit plant **still GETs quotes**. Do **not** print whole-command
  `Vendor I/O: 0`. Do **not** require keep CLI exit 0 on that plant. Quotes follow AC-1 / AC-2 /
  AC-3 / AC-14 / AC-16 independently.
- Mixed-class keep process exit is **non-zero** if any class this invocation is miss,
  download-failed, unreadable, not-storing, or refuse-to-mix.

**No ghost keep `unauthorized` class.** Occupancy maps HTTP unauthorized to the research token
gate (`metrics_unauthorized`, AC-47). Keep credential refuses are pre-GET
`missing-files-credentials` / `wrong-credential-class`. Files 401/403 after GET are
`download failed`. Do not aggregate a keep verdict named `unauthorized`.

---

**Cited live Rust (read at source — do not cite Python or briefing HTML):**

- `apps/api/src/infrastructure/massive/` is REST + WS + `market_phase` only. **No files client.**
  `MassiveRestClient::new` (`rest.rs`) copies `cfg.massive_api_key` and `cfg.rest_base`
  (`MASSIVE_REST_BASE`, default `https://api.massive.com`), 120s whole-request timeout, query
  `apiKey`. `fetch_recent_trades` is `GET /v3/trades/{ticker}` lookback REST, **not** a daily S3
  file. Do not extend this client for files.massive.com.
- `safe_vendor_url` in `rest.rs` strips `apikey` / `api_key` / `token` / `access_token` query
  keys. Files sanitizer is a **sibling** that strips `Authorization` / `X-Amz-*` and never prints
  the files secret.
- `MarketDataSourceKind` in `services/market_data/mod.rs` is exactly
  `{LiveMassive, Fixture, SessionTape}`. Coverage `present` is loadable `LiveMassive` only
  (`classify_loaded` in `session_chain_archive/coverage.rs`). **Do not** add a fourth variant.
  These bytes never become a `VendorBundle` and never reach `insert_if_absent`
  (`session_chain_archive/store.rs`).
- Tape root `SESSION_DAY_TAPE_BODY_ROOT` + `tape_root_conflicts` in `config.rs` (ring, archive
  index, archive body; bidirectional nest via `path_equals_or_nests`). This store uses a **new**
  optional root `MASSIVE_FLAT_FILES_BODY_ROOT` and a **new** `keep_root_conflicts` that also
  includes the tape root. **Do not** add this root as a peer inside `tape_root_conflicts` /
  `body_root_conflicts` (that `Err` path already refuses `serve` bind for tape).
- Tape collision on serve is `AppError::Config` (`state.rs` `open_session_day_tape`). **This**
  vehicle: serve opener is `Ok(NotStoring)` / `Ok(RefuseToMix)` / `Ok(Open)` — **never**
  `AppError::Config`. AppState construction succeeds. REST/WS/workers start.
- Watchlists `TAPE_WATCHLIST` (`day_tape/watchlist.rs`) and `ENSURE_SYMBOLS` (`ensure.rs`) are
  both `["SPY","QQQ","IWM"]` and are **not aliases**. This leaf pins the same three names with
  its own table and poisons `ENSURE_SYMBOLS` by source scan.
- Pages Function `functions/api/[[path]].ts` already 404s `/api/_metrics` and the entire
  `/api/_research/` prefix. New paths stay under that prefix so Pages needs **no** edit.
- `apps/api/Cargo.toml` has `reqwest` (json + rustls-tls, **no** `stream` yet), `hmac` 0.13,
  `sha2` 0.11, `hex`. Session HMAC stays in `services/auth/cookies.rs`
  (`hmac::{Hmac, KeyInit, Mac}`). Files SigV4 does not use the cookie ring. **No** `aws-sdk-*`
  in the tree.
- `parse_et_date` in `session_chain_archive/et_date.rs` (strict `YYYY-MM-DD`). HTTP adapter may
  call it the same way session-books does. The keep leaf may duplicate the tiny clock helper so
  it does not import `ensure.rs` / `coverage.rs`.
- Token: `health::metrics_token_ok` as used by `routes/research_session_books.rs` `token_gate`.
  `GET /api/_metrics` is **not** this vehicle. Do **not** nest corpus JSON on `_metrics`.
- CLI: `Commands` in `apps/api/src/main.rs`; `Capacity` / `ArchiveCoverage` / `SessionDayTape`
  return `ExitCode` **before** `run()`. Flat-files CLI does the same. `cmd_session_day_tape`
  empty `massive_api_key: String::new()` stub — must run without `MASSIVE_API_KEY` as a
  requirement and must not construct `MassiveRestClient` / `MarketDataPort::live`. Do **not**
  `env::remove` `MASSIVE_API_KEY`. Classify reads the env the operator left.
- OpenAPI live pin: **55** operations (`api_contract_parity.rs` `operation_count`,
  `api_contract_router.rs` `add!(` count − 1, `validateRegistrationPairs` default 55,
  `precutover-operation-baseline.json` `operation_count` 55). Adding two GETs → **57**. Frozen
  compile-probe `openapi-router-integration-all-52` / `registration_count: 52` stays
  **historical** — do **not** retarget `validateCompileProbeReceipt`.
- OperatorMetrics `STAGES` in `apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.ts`
  is the six latency stages. This feature adds none.
- Production `ViolationCategory` in `runtime_guardrails/config.rs`: archive body remains the
  only production body-root prerequisite. **No** new category. Missing files pair does not
  refuse `serve` bind.

---

## Track map

| Track | Tasks | Notes |
|---|---|---|
| **Backend** (`apps/api`) | **B1 → B8** (B8 is the lane closer) | Product surface |
| **Frontend** (`apps/dashboard`) | **F1** (structural-absence only; F1 is the lane closer) | SPEC §4 `NO_UI_CHANGE`. No trader UI. F1 is tests that must stay red if chrome appears. |
| **Verification** | **V1 → V8**, after B8 + F1 | Exact commands + expected output. GATE Q is V7+V8. Plan AC-54 / INTERFACE rule 10, not lagging Flow 1 prose. |

**Sequencing.** B1 (leaf types + Memory store + crate deps) is foundation. B2 (config + Json/FS +
AppState open) depends on B1. After B2, **B3 SigV4 client** and **B4 extract/keep** are
independent (`Independent: yes`, disjoint write paths). B6 CLI is also `yes` but **Depends on
B3 + B4** (keep dispatch + files adapter) — `k=2` runs B3∥B4 then queues B6. B5 HTTP+OpenAPI is
`no` (touches `routes/mod.rs`, `tools/`, generated `libs/api`). B7 isolation waits on B3–B6.
B8 closer waits on every backend task and writes only the lane receipt.

Frontend F1 is independently executable in parallel with backend (no shared write paths).

---

## Global Constraints

Every task's requirements implicitly include this section.

### Standing project constraints (each has bitten this repo)

- **Check EXIT CODES, not printed summaries.** PowerShell: `$LASTEXITCODE` after every gate command.
- **A green `nx test` does not mean TS types are sound.** Run `npx nx typecheck @convexa/dashboard`
  before any frontend green claim. Vitest transpiles without typechecking.
- **Never run a bare `nx format:write`.** Scope it: `npx nx format:write --files path/a,path/b`.
  Rust is `cargo fmt -p api-rust` only.
- **Never write a literal NUL byte.** Verify receipts with
  `python -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"` → `0`.
- **Never `git stash`** while other sessions may hold uncommitted work.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, `libs/quant-engine/**` (must stay empty
  product diff), `DESIGN_SYSTEM.md`, or other feature folders. Dashboard **product** sources stay
  empty-diff (F1 may **add** one `*.structural.spec.ts` only).
- **Serve / conformance:** do **not** use `npx nx serve api` (`.worktrees/*` can duplicate Nx
  names). Verification serve is
  `cargo run -p api-rust --features postgres -- serve`.
- **Cite live Rust** listed above. Python under `archive/api-python/` is not the store.

### Feature hard rules (settled — do not re-open)

- Watchlist v1 is exactly `["SPY","QQQ","IWM"]` — sibling closed set, **not** `ENSURE_SYMBOLS` /
  `TAPE_WATCHLIST` / `WARM_SYMBOLS` / `DEFAULT_LIQUID` / `universe.json`. Upper/trim-normalize.
- Entitled classes this slice: stocks SIP **trades** + **quotes** only (`trades_v1` / `quotes_v1`
  vendor objects). **No aggregates** field, column, class token, or `0 aggregates`.
- Extract grain `(symbol, et_date, class)` America/New_York `YYYY-MM-DD`. Corpus grain
  `(et_date, class)` is universe-per-day. Durable occupant is the **extract**, not the gzip.
- Content-hit = occupancy `kept` (≥1 rows) **or** `empty extract` (0 rows, AC-18). Both skip
  later GET **for that class**. Unreadable is **not** a content-hit (GET may retry) but **is** a
  locked extract that **blocks miss persist**.
- Skip GET **per entitled class** when **any** locked name already has a content-hit for
  `(D, class)`. Completing missing names is Future. AC-1/AC-2 do **not** apply on that class’s
  skip path. The other class with no content-hit still GETs.
- Never persist `miss` for `(D, class)` if any locked extract exists (kept / empty extract /
  unreadable promoted pointer). A later 404 in that situation is **download-failed /
  not-confirmed**, not miss. Same `(D, class)` never lists `miss` for QQQ while SPY is `kept`.
- Whole-command files-call is 0 **only when both** classes skip. Mixed-class keep exit: see S2
  residual above. **No** keep occupancy named `unauthorized`.
- First-wins on successful stored extracts (`kept` / `empty extract`). Miss / download-failed
  may retry. Crash temps are not occupants. Classify ignores leftover `tmp/keep-*`.
- Enablement = dedicated env `MASSIVE_FLAT_FILES_BODY_ROOT` (no nested default under `data/`).
  Unset / empty / unwritable → **not-storing**. Collision with ring / archive index / archive
  body / **tape root** → **refuse-to-mix** (keep-only predicate). `serve` still binds. Operator
  line is **not** `flat files not storing`. `[production-fails-closed]` does **not** gain a
  keep-root prerequisite.
- Files pair `MASSIVE_FILES_ACCESS_KEY` + `MASSIVE_FILES_SECRET`. Never `MASSIVE_API_KEY` as
  SigV4 material. Empty allowed at `Config::from_env`. Required only when keep is armed.
  Pre-GET classify: missing pair vs live REST key in a files slot vs ready.
- `authorizes` is exactly `nothing`. `vendor_called` is always `false` on successful handling.
  Evidence HTTP `this process`; CLI `local`. Success occupancy word is **`kept`**, never
  `present`, never `Stored`.
- Combined trades+quotes load envelope; load-envelope precedence in SPEC §4 (unreadable
  store-fault **before** miss envelope; content-hit ⇒ envelope `detail` **null**).
- Keep write is not an HTTP API. No playback. No `_metrics` nest. Pages 404 `_research`.
- Do **not** mark `"auth": true` on conformance entries.
- Do **not** run `npm run api:contract:baseline:accept`. Direct-edit
  `precutover-operation-baseline.json` operations + `operation_count`, then
  `npm run api:contract:generate`.

### Locked operator literals (copy; do not paraphrase)

HTTP framing — exact closed set in INTERFACE / SPEC §4. Command `flat-files`. Evidence HTTP
`this process`. Watchlist always `["SPY","QQQ","IWM"]`. Hit provenance
`loaded from Massive flat files · no REST/WS call` only when ≥1 content hit. Miss / empty-list /
gate provenance `no vendor call`. Standing
`reconstructed flat file · never live_massive · never coverage present · never session day tape`.
License `Our research · not redistributed as a live vendor feed.`

| Class | Exact string |
|---|---|
| Not in watchlist | `not in flat-files watchlist: {SYMBOL}` |
| Not storing | `flat files not storing` |
| Refuse to mix | `flat files refuse to mix` |
| Weekend | `flat files ineligible weekend: {ET_DATE}` |
| Not elapsed | `flat files not elapsed: vendor file for {ET_DATE} not yet published` |
| Miss | `flat files miss: vendor file for {ET_DATE} due and absent` |
| No stored extract | `flat files no stored extract: {ET_DATE}` |
| Empty extract | `flat files empty extract: {SYMBOL} on {ET_DATE}` |
| Unreadable | `flat files unreadable: {reason}` |
| Download failed | `flat files download failed: vendor file for {ET_DATE} not confirmed` |
| Missing files pair | `flat files missing credentials` |
| Wrong credential class | `flat files wrong credential class · REST apiKey is not the files secret` |
| Kept | `kept from Massive flat files` |
| Unauthorized detail | `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` |
| Bad date | `et_date must be YYYY-MM-DD` |
| Invalid limit | `limit must be >= 1` |

Poison on this vehicle: `Unattempted`, `present`, `Stored`, `missing`, `not yet due`,
`blocked occupancy`, `live`, `LIVE`, `live_massive`, `Live tape`, `live-tape`,
`live-paid-present`, Path-A/Path-B literals, a completeness `%`, “full open-to-close session”,
**miss occupancy or miss literal beside a sibling `kept` / `empty extract` / unreadable for the
same `(D, class)`**.

### Interface contract (verbatim)

The block below is copied **verbatim** from `INTERFACE_CONTRACT.md` `## Conformance spec` so both
lanes inherit the same binding shape (GATE PLAN law).

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

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/Cargo.toml` | reqwest `stream`; add `flate2`, `csv`. **Forbidden:** `aws-sdk-*` |
| `apps/api/src/services/flat_file_keep/mod.rs` | **Create** — leaf exports; declare later modules |
| `apps/api/src/services/flat_file_keep/watchlist.rs` | **Create** — `FLAT_FILES_WATCHLIST` |
| `apps/api/src/services/flat_file_keep/clocks.rs` | **Create** — ET date, due clock |
| `apps/api/src/services/flat_file_keep/literals.rs` | **Create** — closed strings |
| `apps/api/src/services/flat_file_keep/occupancy.rs` | **Create** — type-level enum + envelope projection |
| `apps/api/src/services/flat_file_keep/store.rs` | **Create** — NotStoring / RefuseToMix / Memory / Failing / Json |
| `apps/api/src/services/flat_file_keep/fs.rs` | **Create (B2)** — Json+FS under dedicated root |
| `apps/api/src/services/flat_file_keep/extract.rs` | **Create (B4)** — gzip/csv filter |
| `apps/api/src/services/flat_file_keep/keep.rs` | **Create (B4)** — per-class keep loop |
| `apps/api/src/services/flat_file_keep/cli.rs` | **Create (B6)** — clap render |
| `apps/api/src/services/mod.rs` | `pub mod flat_file_keep;` |
| `apps/api/src/infrastructure/flatfiles/mod.rs` | **Create (B3)** |
| `apps/api/src/infrastructure/flatfiles/credentials.rs` | **Create (B3)** |
| `apps/api/src/infrastructure/flatfiles/sigv4.rs` | **Create (B3)** |
| `apps/api/src/infrastructure/flatfiles/client.rs` | **Create (B3)** |
| `apps/api/src/infrastructure/mod.rs` | `pub mod flatfiles;` |
| `apps/api/src/config.rs` | files pair + keep root + `keep_root_conflicts` |
| `apps/api/src/state.rs` | `flat_files: FlatFilesStore`; open never `Err` |
| `apps/api/src/routes/research_flat_files.rs` | **Create** — list/load |
| `apps/api/src/routes/mod.rs` | `mod` + `add!` + conversion registry + operator security |
| `apps/api/src/main.rs` | `Commands::FlatFiles` ExitCode before `run()` |
| `apps/api/.env.example` | document optional files pair + body root (no secrets) |
| `apps/api/openapi/precutover-operation-baseline.json` | two GETs; `operation_count` 57 |
| `apps/api/tests/api_contract_parity.rs` | 55 → 57; NVDA + `/extract` query |
| `apps/api/tests/api_contract_router.rs` | `add!(` 55→57; disposable 55/56 → 57/58 |
| `tools/api-contract.mjs` / `tools/api-contract.spec.mjs` | pairing 57; **flat-files before session** |
| generated OpenAPI / schema / parity / manifest / evidence | `npm run api:contract:generate` |
| `apps/api/tests/massive_flat_file_keep.rs` | hermetic occupancy + keep + HTTP twins |
| `apps/api/tests/massive_flat_file_isolation.rs` | poison scans, Pages, chrome, score |
| `apps/dashboard/src/app/massive-flat-file-keep.structural.spec.ts` | **Create** — F1 |
| `.spire/clusters/tech/contracts/massive-flat-file-keep/conformance-receipt.json` | B8 closer only |
| `functions/api/[[path]].ts` | **Verify only** — already 404s `/api/_research/*` |
| `apps/api/src/routes/research_session_books.rs` | **Do not change** framing / miss / `vendor_called` |
| `apps/api/src/routes/research_session_day_tape.rs` | **Do not change** tape framing / `path_b_interval` / `days[]` |
| `apps/api/src/routes/health.rs` | **Do not nest** flat-files on `_metrics` |

**Do not touch:** `libs/quant-engine`, `generate_signals` / `compute_opportunity_tier`,
`DESIGN_SYSTEM.md`, OperatorMetrics `STAGES` product source, frozen compile-probe receipt,
`ENSURE_SYMBOLS` membership, `WARM_SYMBOLS` default, `tape_root_conflicts` peer list,
`MarketDataSourceKind` variants.

B1 creates **empty stubs** `fs.rs` / `extract.rs` / `keep.rs` / `cli.rs` (`//! Attached by a later
task.`) so Independent-yes tasks do not edit `mod.rs`. B2/B4/B6 overwrite their stub files.

---

# Backend track

## B1 — Leaf: watchlist, clocks, occupancy, Memory/NotStoring/Failing store + crate deps

**Files:**

- `apps/api/Cargo.toml`
- `apps/api/src/services/flat_file_keep/mod.rs` (**create**)
- `apps/api/src/services/flat_file_keep/watchlist.rs` (**create**)
- `apps/api/src/services/flat_file_keep/clocks.rs` (**create**)
- `apps/api/src/services/flat_file_keep/literals.rs` (**create**)
- `apps/api/src/services/flat_file_keep/occupancy.rs` (**create**)
- `apps/api/src/services/flat_file_keep/store.rs` (**create**)
- `apps/api/src/services/flat_file_keep/fs.rs` (**create stub**)
- `apps/api/src/services/flat_file_keep/extract.rs` (**create stub**)
- `apps/api/src/services/flat_file_keep/keep.rs` (**create stub**)
- `apps/api/src/services/flat_file_keep/cli.rs` (**create stub**)
- `apps/api/src/services/mod.rs`

**Depends on:** — **Independent:** no (foundation).

### Tests first

Create the modules with `#[cfg(test)]`. Frozen dates (weekday = `num_days_from_monday() < 5`):

- Monday D = `2026-08-10`
- Saturday = `2026-08-08`
- Sunday = `2026-08-09`
- Future weekday vs today Monday = `2026-08-11`
- Friday D = `2026-08-14` (due Saturday `2026-08-15` 11:00 ET, not Monday)
- 10:59 / 11:00 ET on D+1 via `chrono_tz::America::New_York` (August = EDT)

```rust
fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
    New_York
        .with_ymd_and_hms(y, m, d, h, min, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc)
}
```

Write these tests (names are the filter):

```rust
#[test]
fn flat_files_watchlist_is_exactly_spy_qqq_iwm_not_ensure_alias() { /* AC-5 */ }

#[test]
fn due_line_is_calendar_d_plus_1_at_1100_et() { /* AC-10, AC-12 */ }

#[test]
fn friday_is_due_saturday_1100_not_monday() { /* AC-12 */ }

#[test]
fn clock_1059_d_plus_1_is_not_elapsed_1100_is_due() { /* AC-10 */ }

#[test]
fn future_weekday_is_not_elapsed_not_no_stored_extract() { /* AC-11 */ }

#[test]
fn weekend_is_ineligible_before_not_elapsed() { /* AC-23 */ }

#[test]
fn nvda_is_not_in_watchlist_before_not_storing() { /* AC-5, Axis A */ }

#[test]
fn not_storing_is_not_a_grid_of_misses() { /* AC-20 */ }

#[test]
fn refuse_to_mix_is_distinct_from_not_storing() { /* AC-34 */ }

#[test]
fn occupancy_match_is_exhaustive_no_present_arm() { /* poison present/Stored */ }

#[test]
fn operator_print_never_emits_type_names() { /* AC-25 */ }

#[test]
fn content_hit_is_kept_or_empty_extract_not_unreadable() { /* AC-18, AC-54 */ }

#[tokio::test]
async fn memory_kept_and_empty_extract_are_distinct_at_zero_rows() { /* AC-18, AC-25 */ }

#[tokio::test]
async fn list_empty_store_is_empty_extracts_not_no_stored_extract() { /* AC-15 undated */ }

#[tokio::test]
async fn dated_empty_due_is_no_stored_extract_not_miss() { /* AC-15 */ }

#[tokio::test]
async fn miss_sidecar_refused_when_sibling_kept_same_class() { /* AC-54 persist ban */ }

#[tokio::test]
async fn leftover_temp_is_ignored_dated_inspect_no_stored_extract() { /* AC-19 carve */ }

#[tokio::test]
async fn mixed_class_trades_kept_quotes_miss_envelope_detail_null() { /* AC-4 projection */ }
```

Run:

```
cargo test -p api-rust --lib services::flat_file_keep -- --nocapture
```

Expect FAIL (modules missing). `$LASTEXITCODE` non-zero.

### Implement

`Cargo.toml` — enable stream; add crates; **do not** add `aws-sdk-*`:

```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls", "stream"] }
flate2 = "1"
csv = "1"
```

Keep existing `hmac`, `sha2`, `hex`. Run `cargo check -p api-rust --locked` after the lockfile
updates (`cargo update -p flate2 -p csv` only if needed so `--locked` still works; commit
`Cargo.lock`).

`watchlist.rs`:

```rust
pub const FLAT_FILES_WATCHLIST: &[&str] = &["SPY", "QQQ", "IWM"];

pub fn normalize_symbol(raw: &str) -> String {
    raw.trim().to_ascii_uppercase()
}

pub fn in_flat_files_watchlist(symbol: &str) -> bool {
    let u = normalize_symbol(symbol);
    FLAT_FILES_WATCHLIST.iter().any(|s| *s == u.as_str())
}
```

Do **not** `use` `ENSURE_SYMBOLS` or `TAPE_WATCHLIST`.

`clocks.rs` — local copy of `parse_et_date` (same rules as
`session_chain_archive/et_date.rs`). `today_et_date(now)`. Due predicate:

```rust
pub fn due_instant(et_date: &str) -> Option<DateTime<Utc>> {
    let d = chrono::NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok()?;
    let next = d.succ_opt()?;
    New_York
        .with_ymd_and_hms(next.year(), next.month(), next.day(), 11, 0, 0)
        .single()
        .map(|t| t.with_timezone(&Utc))
}

pub fn is_due(et_date: &str, now: DateTime<Utc>) -> bool {
    due_instant(et_date).is_some_and(|t| now >= t)
}

pub fn is_et_weekend(et_date: &str) -> bool {
    chrono::NaiveDate::parse_from_str(et_date, "%Y-%m-%d")
        .ok()
        .is_some_and(|d| d.weekday().num_days_from_monday() >= 5)
}
```

Keep **does not sleep**. `is_due` is a boolean, not a wait.

`literals.rs` — exact strings from Global Constraints + SPEC §4 standing block, license,
framing constants, `COMMAND = "flat-files"`, hit/miss provenance, closing lines. Split poison
tokens in source if a later scan would false-positive (`live` + `_massive` concatenation only
inside tests that assert absence).

`occupancy.rs` — closed type-level enum, exhaustive `match`, **no** `Present` / `Stored` /
`Unattempted` / `LiveMassive` / `Missing` arms. Type names **do not print**.

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Occupancy {
    NotElapsed,
    IneligibleWeekend,
    NotStoring,
    RefuseToMix,
    MissingFilesCredentials, // keep-only
    WrongCredentialClass,    // keep-only
    NotInWatchlist,
    NoStoredExtract,
    DownloadFailed,          // keep-only when GET ran
    Miss,
    Unreadable { reason: String },
    Kept { row_count: usize },
    EmptyExtract,
}

pub fn is_content_hit(o: &Occupancy) -> bool {
    matches!(o, Occupancy::Kept { .. } | Occupancy::EmptyExtract)
}

pub fn is_locked_extract(o: &Occupancy) -> bool {
    is_content_hit(o) || matches!(o, Occupancy::Unreadable { .. })
}
```

Operator print maps through `literals`. Axis A evaluation order **binding** (load / dated
inspect):

1. `NotInWatchlist`
2. `NotStoring` / `RefuseToMix` (store-level; locked symbols only for HTTP 500)
3. `IneligibleWeekend`
4. `NotElapsed` (`et_date > today` **or** due clock not passed)
5. occupant / miss sidecar / `NoStoredExtract`

List of a foreign symbol is Axis A 200 even when the root is unset. List of a locked symbol on
an empty store is hit framing + empty `extracts[]`, **not** `no stored extract`.

Load-envelope projection (AC-4 / AC-55) lives here as a pure function
`load_envelope(trades: Occupancy, quotes: Occupancy) -> EnvelopeDecision` implementing SPEC §4
precedence. Content hit ⇒ HTTP 200 hit framing, `detail: None`. Neither content hit + any
unreadable ⇒ HTTP 500. Else any miss ⇒ 200 miss envelope. Else both no-stored-extract ⇒ 200
no-stored-extract envelope.

`store.rs` — enum:

```rust
pub enum FlatFilesStore {
    NotStoring,
    RefuseToMix,
    Memory(MemoryInner),
    Failing,
    Json(JsonInner), // filled in B2; B1 may leave a non-functional arm
}
```

Memory methods: `put_extract` (first-wins on content-hit occupant), `put_unreadable_pointer`,
`put_miss` (**Err/no-op** if `any_locked_extract(D, class)`), `ignore_temp`, `list(symbol)`,
`load(symbol, et_date, class)`, `any_content_hit(D, class)`, `any_locked_extract(D, class)`.
Miss sidecar identity is `(et_date, class)` — one day-file fact inherited by SPY/QQQ/IWM
(AC-53). List miss rows only when that pair has **zero** locked extracts.

`Failing` writes always `Err`. `NotStoring` / `RefuseToMix` list/load for a **locked** symbol
surface those store-level classes; NVDA still `NotInWatchlist` first.

`mod.rs` re-exports. Declare `pub mod fs; pub mod extract; pub mod keep; pub mod cli;` against
the stubs. `services/mod.rs`: `pub mod flat_file_keep;`.

Poison in this task’s tests: occupancy source has no `LiveMassive` / `present` as a member /
`complete_rth`; `flat_file_keep` files do not contain `insert_if_absent`,
`archive_session_best_effort`, `spawn_capture`, `ENSURE_SYMBOLS`, `classify_loaded`,
`MarketDataPort`, `compute_analytics_from_vendor`.

Re-run the lib filter. Expect PASS. `$LASTEXITCODE` 0.

Commit: `test(api): massive flat files occupancy + memory store`

**Reviewer probes:** Axis A order (NVDA unset-root still not-in-watchlist; future Saturday is
weekend not not-elapsed). `FLAT_FILES_WATCHLIST` is not a pointer at `ENSURE_SYMBOLS`.
`put_miss` cannot sit beside a sibling keep. Type names never print. `Cargo.toml` has no
`aws-sdk`.

---

## B2 — Dedicated root, collision refuse-to-mix (serve still binds), Json+FS, AppState

**Files:**

- `apps/api/src/config.rs`
- `apps/api/src/state.rs`
- `apps/api/src/services/flat_file_keep/fs.rs` (**overwrite stub**)
- `apps/api/.env.example`

**Depends on:** B1. **Independent:** no.

### Tests first

In `config.rs` tests:

```rust
#[test]
fn flat_files_body_root_unset_is_none_not_invented_path() { /* AC-20 */ }

#[test]
fn keep_root_conflicts_with_ring_archive_index_archive_body_and_tape() { /* AC-34 */ }

#[test]
fn keep_root_is_not_a_peer_inside_tape_root_conflicts() {
    // tape_root_conflicts source still has 4 params (tape, ring, archive_index, archive_body)
    // and does not mention MASSIVE_FLAT_FILES_BODY_ROOT.
}
```

In `fs.rs` / `state.rs` tests:

```rust
#[tokio::test]
async fn unset_root_constructs_not_storing_listener_would_bind() { /* AC-20, AC-32 */ }

#[tokio::test]
async fn colliding_root_is_refuse_to_mix_not_config_err() { /* AC-34 — unlike tape */ }

#[tokio::test]
async fn unwritable_root_is_not_storing_not_a_start_refusal() { /* AC-20 */ }

#[tokio::test]
async fn json_fs_round_trip_extract_and_miss_sidecar() { /* AC-1 family */ }

#[tokio::test]
async fn leftover_keep_temp_not_listed() { /* crash-temp */ }
```

`cargo test -p api-rust --lib config::tests::keep_ --lib config::tests::flat_files_ --lib services::flat_file_keep -- --nocapture`
plus `cargo check -p api-rust --features postgres`. Expect FAIL.

### Implement

`Config` fields:

```rust
/// Dedicated flat-files extract root. `None` = unset → not storing (no nested default).
pub massive_flat_files_body_root: Option<PathBuf>,
/// Files Access Key (empty allowed at from_env; required only when keep is armed).
pub massive_files_access_key: String,
/// Files Secret (empty allowed at from_env; required only when keep is armed).
pub massive_files_secret: String,
```

`from_env`:

```rust
let massive_flat_files_body_root = parse_optional_path_env("MASSIVE_FLAT_FILES_BODY_ROOT");
let massive_files_access_key = env::var("MASSIVE_FILES_ACCESS_KEY")
    .unwrap_or_default()
    .trim()
    .to_string();
let massive_files_secret = env::var("MASSIVE_FILES_SECRET")
    .unwrap_or_default()
    .trim()
    .to_string();
```

**Never** `data/massive_flat_files` default. **Never** treat files pair missing as
`AppError::Config`. Serve still requires `MASSIVE_API_KEY` as today.

Add **new** helper; do **not** change `tape_root_conflicts` signature or callers:

```rust
pub fn keep_root_conflicts(
    keep: &Path,
    ring: &Path,
    archive_index: &Path,
    archive_body: Option<&Path>,
    tape: Option<&Path>,
) -> bool {
    let vs = |a: &Path, b: &Path| path_equals_or_nests(a, b) || path_equals_or_nests(b, a);
    vs(keep, ring)
        || vs(keep, archive_index)
        || archive_body.is_some_and(|b| vs(keep, b))
        || tape.is_some_and(|t| vs(keep, t))
}
```

Json+FS layout **under that root only**:

```
{root}/extracts/{SYM}/{et_date}/{class}.csv
{root}/miss/{et_date}/{class}.json
{root}/tmp/keep-{et_date}-{class}-{nonce}.csv.gz
```

`class` file token is `trades` | `quotes` only. Miss JSON: `{et_date, class, status, observed_at}`
— **no gzip body**. Atomic rename of extracts (`fsync` temp extract, then rename). Classify
**ignores** `tmp/keep-*` (not unreadable, not download-failed list rows).

`root_is_writable` — copy the probe pattern from `day_tape/fs.rs` with a distinct probe name
`.massive_flat_files_write_probe`.

`AppState` gains `pub flat_files: FlatFilesStore`. Open rules (`open_flat_files_store` in
`state.rs`):

| Root | Result |
|---|---|
| Unset / empty | `NotStoring` — construct **Ok** |
| Set, `keep_root_conflicts` | `RefuseToMix` — construct **Ok** (desk up) |
| Set, missing or unwritable | `NotStoring` — construct **Ok** |
| Set, writable, disjoint | `Json` — storing **on** |

**Never** `AppError::Config` on keep-root collision. **Never** construct `MassiveFilesClient` on
serve. Production construct gains **no** keep-root prerequisite and **no** new
`ViolationCategory`. When root unset, serve log
`flat files not fetching — production unset`.

Fix every `Config {` struct literal the compiler names (`state.rs` `test_stub_config`,
`main.rs` CLI stubs, `batch_backtest.rs`, `tests/batch_backtest_cli.rs`, …): add
`massive_flat_files_body_root: None`, `massive_files_access_key: String::new()`,
`massive_files_secret: String::new()`.

Hermetic `for_tests*` constructors: `flat_files: FlatFilesStore::memory()` (or `NotStoring` when
the test is about unset). Do not open a files HTTP client.

`.env.example` — comment-only: optional `MASSIVE_FLAT_FILES_BODY_ROOT`,
`MASSIVE_FILES_ACCESS_KEY`, `MASSIVE_FILES_SECRET`. State they are **not** `MASSIVE_API_KEY`.
No secret values.

Re-run tests + `cargo check -p api-rust --features postgres`. Expect PASS.

Commit: `feat(api): massive flat files dedicated root and json store`

**Reviewer probes:** no invented default path. Collision is `RefuseToMix` Ok, not tape-style
`Err`. `tape_root_conflicts` unchanged. Files client not built in `AppState::construct`.

---

## B3 — SigV4 files client + credentials pre-GET classify

**Files:**

- `apps/api/src/infrastructure/flatfiles/mod.rs` (**create**)
- `apps/api/src/infrastructure/flatfiles/credentials.rs` (**create**)
- `apps/api/src/infrastructure/flatfiles/sigv4.rs` (**create**)
- `apps/api/src/infrastructure/flatfiles/client.rs` (**create**)
- `apps/api/src/infrastructure/mod.rs`

**Depends on:** B1. **Independent:** yes.

### Tests first

```rust
#[test]
fn files_credentials_struct_has_no_api_key_field() { /* source scan */ }

#[test]
fn missing_pair_is_missing_files_credentials_zero_get() { /* AC-21 */ }

#[test]
fn rest_key_as_access_key_is_wrong_credential_class_zero_get() { /* AC-22 */ }

#[test]
fn rest_key_as_secret_is_wrong_credential_class_zero_get() { /* AC-22 */ }

#[test]
fn unset_rest_env_skips_equality_and_is_not_wrong_class() { /* SPEC 2.3 */ }

#[test]
fn object_key_trades_quotes_only_no_aggregates() { /* AC-40, AC-51 */ }

#[test]
fn safe_files_url_strips_authorization_and_x_amz() { /* AC-49 */ }

#[test]
fn empty_body_sha256_is_canonical_empty() { /* SPEC 2.3 */ }

#[tokio::test]
async fn get_increments_per_class_counter_only_on_send() { /* files-call */ }

#[tokio::test]
async fn get_streams_chunks_never_bytes_whole_body() { /* poison Response::bytes */ }

#[tokio::test]
async fn local_404_is_status_404_not_miss_classification() { /* client is HTTP */ }
```

`cargo test -p api-rust --lib infrastructure::flatfiles -- --nocapture` — expect FAIL.

### Implement

This leaf **cannot** be built from `Config.massive_api_key`. **No** `api_key` field.

`credentials.rs`:

```rust
pub struct FilesCredentials {
    pub access_key: String,
    pub secret: String,
}

pub enum CredentialClass {
    Ready(FilesCredentials),
    MissingFilesCredentials,
    WrongCredentialClass,
}

/// `rest_key` = `MASSIVE_API_KEY` env **before** empty-key blanking.
/// Unset/empty REST env → skip equality (paste unprovable this run).
pub fn classify_files_credentials(
    access_key: &str,
    secret: &str,
    rest_key: Option<&str>,
) -> CredentialClass {
    let access = access_key.trim();
    let secret = secret.trim();
    if access.is_empty() || secret.is_empty() {
        return CredentialClass::MissingFilesCredentials;
    }
    if let Some(rest) = rest_key.map(str::trim).filter(|s| !s.is_empty()) {
        if rest == access || rest == secret {
            return CredentialClass::WrongCredentialClass;
        }
    }
    CredentialClass::Ready(FilesCredentials {
        access_key: access.to_string(),
        secret: secret.to_string(),
    })
}

pub fn rest_key_from_env() -> Option<String> {
    std::env::var("MASSIVE_API_KEY")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}
```

`sigv4.rs` — AWS4-HMAC-SHA256 for `GET`; signed headers `host`, `x-amz-content-sha256`,
`x-amz-date` (alphabetical in `SignedHeaders`); payload hash = SHA-256 of the **empty body**
(`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`). Region default
`us-east-1`. Service `s3`. Use `hmac::{Hmac, KeyInit, Mac}` + `sha2::{Digest, Sha256}` + `hex`
— same crates as `cookies.rs`, **not** the cookie key ring. **Not** `UNSIGNED-PAYLOAD`.

Path-style URL: `{endpoint}/{bucket}/{key}` with defaults
`endpoint = https://files.massive.com`, `bucket = flatfiles`,
`key = us_stocks_sip/{trades_v1|quotes_v1}/YYYY/MM/YYYY-MM-DD.csv.gz`.

```rust
pub enum FilesClass {
    Trades,
    Quotes,
}

impl FilesClass {
    pub fn vendor_prefix(self) -> &'static str {
        match self {
            Self::Trades => "trades_v1",
            Self::Quotes => "quotes_v1",
        }
    }
}

pub fn object_key(class: FilesClass, et_date: &str) -> String {
    let (y, m, _) = (/* parse YYYY, MM from et_date */);
    format!(
        "us_stocks_sip/{}/{}/{:02}/{}.csv.gz",
        class.vendor_prefix(),
        y,
        m,
        et_date
    )
}
```

No aggregates key helper.

`client.rs`:

```rust
pub struct MassiveFilesClient {
    http: reqwest::Client,
    creds: FilesCredentials,
    endpoint: String,
    bucket: String,
    region: String,
    trades_gets: Arc<AtomicU64>,
    quotes_gets: Arc<AtomicU64>,
}

pub enum FilesHttpOutcome {
    Status { code: u16, bytes_written: u64 },
    Transport { sanitized: String },
}
```

Builder: **no** `apiKey` query, **no** 120s whole-request timeout (that timeout is the REST
client). Inject `endpoint` for hermetic tests (local axum listener). `get_object(class, et_date,
dest: &Path)`:

1. Increment **that class** counter **only when `Client::execute` / `send` is invoked**.
2. Stream `bytes_stream()` / `chunk()` to `dest`. `fsync`. Never `Response::bytes()`.
3. Return HTTP status (including 404/401/403/5xx). Transport/timeout/reset → `Transport`.

`safe_files_url`: strip `Authorization` and any `X-Amz-*` query/header material; never include
the secret. Use it in error strings.

Source scan on this leaf: finding `MASSIVE_API_KEY` / `massive_api_key` / `api_key` as a field
**fails** (allow the credential-classify parameter name `rest_key` and the string
`"REST apiKey is not the files secret"` only in tests outside this leaf, or split the poison
token). Finding `aws-sdk` fails.

`infrastructure/mod.rs`: `pub mod flatfiles;`.

Hermetic mock: bind `tokio::net::TcpListener` + axum `Router` that records the
`Authorization` / `x-amz-date` headers and returns 404 or a small gzip. Do **not** add
`wiremock` / `aws-sdk`.

Re-run. Expect PASS.

Commit: `feat(api): massive files SigV4 client and credential classify`

**Reviewer probes:** counter stays 0 on missing/wrong-class (classify is pre-send). REST key
equality uses env, not `Config.massive_api_key`. No `api_key` field. Empty-body hash, not
UNSIGNED-PAYLOAD.

---

## B4 — Extract/filter SPY/QQQ/IWM, discard gzip, first-wins, skip-GET per class

**Files:**

- `apps/api/src/services/flat_file_keep/extract.rs` (**overwrite stub**)
- `apps/api/src/services/flat_file_keep/keep.rs` (**overwrite stub**)

**Depends on:** B1. **Independent:** yes.

Do **not** import `infrastructure::flatfiles` here. Keep talks to a local `UniverseGet` trait so
B3 can land in parallel. B6 adapts `MassiveFilesClient`.

### Tests first

Plant gzip with `flate2::write::GzEncoder` + CSV `ticker,price` (and a `symbol` header twin).

```rust
#[test]
fn extract_filters_locked_names_discards_nvda() { /* AC-5, AC-52 */ }

#[test]
fn unrecognized_header_is_unreadable_not_empty_extract() { /* SPEC 2 */ }

#[test]
fn zero_rows_for_iwm_is_empty_extract_content_hit() { /* AC-18 */ }

#[test]
fn gzip_temp_is_not_returned_as_extract_body() { /* AC-52 */ }

#[tokio::test]
async fn successful_get_stores_trio_for_that_class() { /* AC-1, AC-2, AC-3 */ }

#[tokio::test]
async fn trades_kept_does_not_classify_quotes_kept() { /* AC-4 */ }

#[tokio::test]
async fn skip_get_when_spy_trades_kept_qqq_trades_no_stored_extract() { /* AC-54 */ }

#[tokio::test]
async fn skip_get_does_not_print_download_failed_or_miss_for_that_class() { /* AC-54 */ }

#[tokio::test]
async fn quotes_still_get_when_only_trades_content_hit() { /* AC-54 mixed */ }

#[tokio::test]
async fn both_classes_content_hit_whole_command_files_call_0() { /* AC-26, AC-54 */ }

#[tokio::test]
async fn get_404_zero_locked_extracts_persists_miss_process_nonzero() { /* AC-14 */ }

#[tokio::test]
async fn get_404_with_sibling_extract_is_download_failed_no_miss_sidecar() { /* AC-16, AC-54 */ }

#[tokio::test]
async fn transport_401_403_is_download_failed_not_miss() { /* AC-16 */ }

#[tokio::test]
async fn first_wins_kept_not_overwritten_by_empty_or_unreadable() { /* AC-27 */ }

#[tokio::test]
async fn partial_trio_spy_promoted_skips_later_get_qqq_no_stored_extract() { /* SPEC 2.4 */ }

#[tokio::test]
async fn keep_does_not_sleep_on_not_elapsed() { /* AC-13 */ }

#[tokio::test]
async fn nvda_named_keep_files_call_0() { /* AC-5 */ }

#[tokio::test]
async fn holiday_weekday_zero_rows_is_empty_extract_not_weekend() { /* AC-24 */ }

#[tokio::test]
async fn mixed_exit_trades_skip_quotes_miss_is_nonzero() { /* AC-54 exit */ }

#[tokio::test]
async fn mixed_exit_trades_skip_quotes_kept_is_zero() { /* AC-54 exit */ }

#[tokio::test]
async fn keep_exit_has_no_unauthorized_arm() { /* S2 residual */ }
```

`cargo test -p api-rust --lib services::flat_file_keep::extract --lib services::flat_file_keep::keep -- --nocapture`
— expect FAIL.

### Implement

`extract.rs` — `flate2::read::GzDecoder` + `csv::Reader`. Header-driven ticker/symbol column
(case-insensitive names `ticker` or `symbol`). Unrecognized header → `Unreadable`, not empty
extract. Filter rows whose ticker ∈ `{SPY,QQQ,IWM}`. Return per-symbol CSV **text** (header +
rows). Zero data rows for a locked name → empty extract (content-hit). **Never** return the
universe gzip body. Dialect 403 is the **client’s** download-failed (GET already ran); this
module does not classify HTTP.

`keep.rs`:

```rust
use futures_util::future::BoxFuture;

pub trait UniverseGet: Send + Sync {
    fn get_to_temp(
        &self,
        class: ExtractClass,
        et_date: &str,
        dest: &Path,
    ) -> BoxFuture<'_, GetOutcome>;
    fn send_count(&self, class: ExtractClass) -> u64;
}

pub enum GetOutcome {
    Status { code: u16 },
    Transport { sanitized: String },
}

#[derive(Clone, Copy)]
pub enum ExtractClass {
    Trades,
    Quotes,
}

pub struct KeepReport {
    pub trades: ClassVerdict,
    pub quotes: ClassVerdict,
}

pub enum ClassVerdict {
    SkipGet { sibling: Occupancy, named: Occupancy },
    Stored(Occupancy), // Kept or EmptyExtract
    Miss,
    DownloadFailed,
    Unreadable { reason: String },
    Gate(Occupancy), // NotElapsed / Ineligible / NotInWatchlist / NotStoring / RefuseToMix / MissingFilesCredentials / WrongCredentialClass
}
```

Do **not** add `Unauthorized` to `ClassVerdict`.

Pre-GET whole-command refuses (files-call 0, no miss): NotElapsed / IneligibleWeekend /
NotInWatchlist / NotStoring / RefuseToMix / MissingFilesCredentials / WrongCredentialClass.
Keep does **not** sleep.

Else, **per class** `{Trades, Quotes}` for named D:

1. If `store.any_content_hit(D, class)` → skip GET this class; missing names
   `NoStoredExtract`; never miss; never download-failed; `send_count` for this class stays
   unchanged (test stub must not be called).
2. Else `get_to_temp` → stream already on disk.
   - 404 / NoSuchKey: if `any_locked_extract` → `DownloadFailed`, **do not** persist miss;
     else persist miss sidecar → `Miss`.
   - 401 / 403 / 5xx / timeout / reset / no-rename → `DownloadFailed`; discard temp; not miss.
   - 2xx: extract; atomic rename per locked name; **discard** gzip temp. First-wins on existing
     content-hit occupants. csv/header fault → `Unreadable` for that name (promoted pointer).

Process exit **after both classes**:

```rust
pub fn keep_process_exit(report: &KeepReport) -> ExitCode {
    let bad = |v: &ClassVerdict| {
        matches!(
            v,
            ClassVerdict::Miss
                | ClassVerdict::DownloadFailed
                | ClassVerdict::Unreadable { .. }
                | ClassVerdict::Gate(Occupancy::NotStoring)
                | ClassVerdict::Gate(Occupancy::RefuseToMix)
                | ClassVerdict::Gate(Occupancy::MissingFilesCredentials)
                | ClassVerdict::Gate(Occupancy::WrongCredentialClass)
        )
    };
    if bad(&report.trades) || bad(&report.quotes) {
        ExitCode::from(1)
    } else {
        ExitCode::SUCCESS
    }
}
```

Whole-command `files_call_total == 0` **iff** both classes are `SkipGet` (or pre-GET refuse).
Do **not** treat “exit 0 after a successful quotes GET” as whole-command zero I/O.

A keep that names one locked symbol still fills sibling locked names from that same GET
**when the GET runs**. After skip-GET, it does not invent QQQ.

Stub `UniverseGet` in tests: `NotFound`, `Gzip(Vec<u8>)`, `Status(u16)`, `Transport`,
`AssertNotCalled`.

Re-run. Expect PASS.

Commit: `feat(api): massive flat files extract and per-class keep`

**Reviewer probes:** AC-54 plant (SPY trades kept, keep names QQQ) → trades send_count 0, QQQ
trades `no stored extract`, never trades miss, quotes still GET. Exit 0 only if quotes stored
kept/empty extract. No `unauthorized` match arm.

---

## B5 — HTTP `_research/flat-files` + OpenAPI generate + books/tape re-pin

**Files:**

- `apps/api/src/routes/research_flat_files.rs` (**create**)
- `apps/api/src/routes/mod.rs`
- `apps/api/openapi/precutover-operation-baseline.json`
- `apps/api/tests/api_contract_parity.rs`
- `apps/api/tests/api_contract_router.rs`
- `apps/api/tests/api_contract_runtime_auth_research.rs`
- `tools/api-contract.mjs`
- `tools/api-contract.spec.mjs`
- `apps/api/openapi/convexa.openapi.json`
- `apps/api/openapi/parity-coverage.json`
- `apps/api/openapi/generated-artifacts.manifest.json`
- `apps/api/tests/fixtures/api_contract/boundary-evidence.json`
- `libs/api/src/generated/schema.ts`

**Depends on:** B1, B2. **Independent:** no.

### Tests first

HTTP handler tests in `research_flat_files.rs` `#[cfg(test)]` (axum oneshot, Memory store,
injected clock):

- NVDA list 200 `RESEARCH READ — MASSIVE FLAT FILES NOT IN WATCHLIST` without a planted root
  (Axis A). `vendor_called: false`. `authorizes: "nothing"`.
- SPY `et_date=not-a-date` 422 `et_date_unparseable` / `et_date must be YYYY-MM-DD`.
- Token set + missing/wrong → 401 `metrics_unauthorized`, **no** extract body (AC-47).
- Locked-symbol empty store 200 hit framing, `extracts: []`, `detail: null`, provenance
  `no vendor call` (not `no stored extract`).
- Mixed twins from INTERFACE table (reverse classes equally), including AC-55 500
  unreadable+miss / both-unreadable, and content-hit + unreadable sibling 200 with `""` body.
- `limit < 1` → 400 `invalid_limit`.
- List sort: `et_date` asc then `trades` before `quotes`; `limit` keeps the **newest** window
  still emitted ascending.
- 500 not-storing / refuse-to-mix **for locked symbols only**.
- Envelope has **no** `aggregates_*`, `path_a_*`, `live_massive`, occupancy `present`,
  keep-only tokens (`download failed`, credential refuses).
- `vendor_called` stays false (handler-local atomic, sibling of `TAPE_READ_VENDOR_CALLS`).

Contract pins: `operation_count` 55 will fail until generate. Expect FAIL then PASS.

### Implement

Mirror `research_session_day_tape.rs` (token_gate, `RouteResponse`, IntoResponses, NVDA
representative conversion). Paths:

- `GET /api/_research/flat-files/{symbol}`
- `GET /api/_research/flat-files/{symbol}/extract`

Register in `routes/mod.rs` **beside** session-books, **before** the session-books `add!` pair
so Axum cannot bind `flat-files` as `session-books/{symbol}`:

```rust
mod research_flat_files;
add!(
    research_flat_files::list_flat_files_contract,
    research_flat_files::__path_list_flat_files_contract
);
add!(
    research_flat_files::load_flat_files_contract,
    research_flat_files::__path_load_flat_files_contract
);
```

Wire `response_conversion_registry` + `response_conversion_registry_source_target` +
`RESPONSE_CONVERSION_SOURCES` (list 200/400/401/500, load 200/401/422/500 — eight rows, same
shape as tape) + `register_route_schemas` + operator security matrix (`operator()` GET, **not**
session cookie). Representative 200 = NVDA not-in-watchlist (no planted root).

`tools/api-contract.mjs` — map `/api/_research/flat-files` **before**
`/api/_research/session-day-tape` **before** `/api/_research/session-archive` **before**
`/api/_research/session` (prefix rule; do not let `session` steal anything, and do not let
`flat-files` fall through to `routes/mod.rs`). Response types:
`ListFlatFilesResponse` / `LoadFlatFilesResponse`.

Direct-edit `precutover-operation-baseline.json`: insert the two GET paths (lexicographic
neighbors of the other `_research` ops) and set `capture.operation_count` **57**. **Do not**
run `api:contract:baseline:accept`.

`api_contract_parity.rs`: `operation_count` 55 → 57. In the direct-HTTP loop, add a
`flat-files` branch sibling of the tape NVDA branch:

```rust
} else if /* operator access */ && path.contains("flat-files") {
    request_path = request_path.replace("SPY", "NVDA");
    if path.ends_with("/extract") {
        request_path.push_str("?et_date=2020-01-02");
    }
}
```

Re-pin `observed == 55` to the **new catalog length** after generate (do not assume 57; count
exercised outcomes). `api_contract_router.rs`: `add!(` 55→57; disposable 55/56 → 57/58.
`tools/api-contract.spec.mjs` + `validateRegistrationPairs` default 55 → 57.

Then:

```
npm run api:contract:generate
npm run api:contract:check
```

Expect `API contract check passed: generated artifacts match the Rust API contract.`

`libs/api/src/lib/convexa.ts` / `client.ts` must **not** grow a flat-files list/load helper.
Generated `schema.ts` **will** contain the new paths — accepted OpenAPI churn; trader UI must
not consume the operations (F1).

Oneshots in `api_contract_runtime_auth_research.rs`: NVDA list 200, extract 422, 401 when
token set. **Re-pin** session-books list/load and tape list (AC-35–38) in the same test —
framing / `path_b_interval` / `days[]` / coverage `present` meaning unchanged.

Canary: plant `METRICS_SECRET_TOKEN=canary-secret-value-do-not-print`; list/load bodies must
not contain it (AC-49). Files secrets neither.

Do **not** change `research_session_books.rs`, `research_session_day_tape.rs`, or nest on
`health.rs`.

Frozen compile-probe stays 52.

Re-run contract tests + handler tests. Expect PASS.

Commit: `feat(api): research flat-files list/load`

**Reviewer probes:** NVDA 200 without a keep root. `"auth": true` absent. Session-book and tape
framing untouched. `_metrics` handler unchanged. Mixed-class load never uses miss envelope
`detail` while a sibling class is kept. Unreadable+miss is 500.

---

## B6 — Optional clap `flat-files`

**Files:**

- `apps/api/src/main.rs`
- `apps/api/src/services/flat_file_keep/cli.rs` (**overwrite stub**)

**Depends on:** B1, B2, B3, B4. **Independent:** yes.

`k=2` runs B3∥B4 first; this task queues after both (needs `UniverseGet` adapter + `run_keep`).

### Tests first

In `main.rs` `#[cfg(test)]` (mirror `session_day_tape_wiring`):

```rust
#[test]
fn flat_files_parses_and_is_listed() { /* clap name flat-files; keep subcommand */ }

#[test]
fn cmd_flat_files_does_not_open_live_or_massive() { /* AC-32 CLI twin */ }
```

CLI render tests in `cli.rs`:

- Standing block first; `Evidence: local`; closing `local audit is not production coverage`;
  stdout title `flat-files`; payload names trades and quotes only (no `· aggregates`).
- Weekend / not-elapsed / both-classes no stored extract / not-in-watchlist / empty-extract
  inspect exit 0 with `Not a miss.` where SPEC §4 requires it.
- Keep miss / download failed / not-storing / unreadable / refuse-to-mix / missing-files-credentials /
  wrong-credential-class are non-zero `[ERROR]`. **No** REST-apiKey clause on missing pair.
  Wrong-class prints `REST apiKey is not the files secret`.
- CLI list occupancy column: `miss` vs `empty extract` both with 0 rows (AC-25). Bare `0`
  without occupancy is forbidden. No QQQ trades `miss` beside SPY trades `kept`.
- Dated inspect mixed table (AC-56) — per-class lines; exit 0 only per SPEC §4 inspect table
  (inspect exit ≠ keep process exit).
- Both-classes skip-GET `[OK]` line + `Vendor I/O: 0 files GET` + `Not a miss.` + exit 0.
- Mixed-class keep (SPY trades kept only): trades files-call 0; **do not** print whole-command
  `Vendor I/O: 0 files GET`; process exit follows B4 `keep_process_exit`.
- Secrets / canary REST key absent from stdout/stderr (AC-49).

Run `cargo test -p api-rust --bin api-rust flat_files_wiring -- --nocapture` plus
`cargo test -p api-rust --lib services::flat_file_keep::cli -- --nocapture` — expect FAIL.

### Implement

```rust
    /// Research corpus of Massive stocks SIP trades+quotes extracts (operator; not a live book).
    FlatFiles {
        #[command(subcommand)]
        action: Option<FlatFilesAction>,
        #[arg(long)]
        symbol: Option<String>,
        #[arg(long = "et-date")]
        et_date: Option<String>,
    },

#[derive(Subcommand, Debug)]
enum FlatFilesAction {
    /// The only files.massive.com GET. Off the trader request path.
    Keep,
}
```

Dispatch **before** `run()`, beside `SessionDayTape`. Opener copies the empty
`massive_api_key: String::new()` stub; must not construct `MassiveRestClient` /
`MarketDataPort::live`. Do **not** `env::remove` `MASSIVE_API_KEY`. Classify files credentials
via `flatfiles::classify_files_credentials(access, secret, rest_key_from_env().as_deref())`.

Adapter in `cli.rs` (not in B4):

```rust
struct ClientAdapter<'a>(&'a MassiveFilesClient);
impl UniverseGet for ClientAdapter<'_> {
    fn get_to_temp(...) -> BoxFuture<'_, GetOutcome> { /* get_object → get_to_temp */ }
    fn send_count(...) -> u64 { /* client send_count */ }
}
```

HTTP Evidence `this process` is **not** used on CLI. `[RUNNING] flat-files — no verdict yet`
is not a verdict.

Keep skip-GET print (per class / both-classes) — exact SPEC §4 lines. Mixed-class keep prints
per-class occupancy/verdict lines.

CLI is not a substitute for HTTP (conformance runner does not execute it).

Re-run. Expect PASS.

Commit: `feat(api): flat-files research CLI`

**Reviewer probes:** ExitCode before `run()`. No Massive REST in `cmd_flat_files` body. Keep
runs without `MASSIVE_API_KEY`. Whole-command `Vendor I/O: 0` only on both-classes skip.

---

## B7 — Isolation, poison, occupancy matrix (AC-54), score identity, non-regression

**Files:**

- `apps/api/tests/massive_flat_file_keep.rs` (**create**)
- `apps/api/tests/massive_flat_file_isolation.rs` (**create**)
- `apps/api/tests/api_contract_runtime_auth_research.rs` (extend oneshots if B5 left gaps)

**Depends on:** B3, B4, B5, B6. **Independent:** no.

### Tests first / implement together (the tests **are** the deliverable)

One hermetic pass (SPEC §3 method notes) in `massive_flat_file_keep.rs` with injected Monday
clock + stub `UniverseGet` + Memory/Json store:

1. Due keep, no sibling content-hit → trades **and** quotes stored as `kept` or `empty extract`
   for SPY/QQQ/IWM (AC-1–3).
2. Mixed trades-kept + quotes-miss load twin (quotes class zero locked extracts) — AC-4.
3. AC-54 plant: SPY trades kept, keep names QQQ → skip GET **for trades**, QQQ trades
   `no stored extract`, SPY trades kept, trades files-call 0, never trades miss, never
   download-failed **for trades**; quotes still GET (do **not** assert whole-command files-call
   0 or keep CLI exit 0 on this plant).
4. Both-classes content-hit → whole-command files-call 0, skip-GET `[OK]` exit 0.
5. Trades skip + quotes miss/download-failed → process **non-zero**.
6. Trades skip + quotes GET stored kept/empty extract → process **0**.
7. Planted 404 after GET ran while sibling extract exists → download-failed CLI, no miss
   sidecar, missing name still `no stored extract`.
8. NVDA not-in-watchlist files-call 0 (AC-5).
9. 10:59 not-elapsed no GET; 11:00 due; Friday→Saturday; keep does not sleep (AC-10–13).
10. Keep 404 with zero locked extracts → miss + sidecar + process non-zero (AC-14).
11. Dated inspect empty due store → no stored extract, 0 S3, not the miss literal; undated
    empty list → empty `extracts[]` + hit framing (AC-15).
12. Inspect persisted miss → miss, 0 S3 (AC-17). CLI list `miss` vs `empty extract` at 0 rows
    (AC-25). CLI dated inspect mixed table (AC-56).
13. Transport/401/403 → download failed on keep CLI, not on list/load DTO (AC-16).
14. Leftover crash temp → dated inspect `no stored extract` (AC-19 carve).
15. Partial-trio → SPY kept for that class, QQQ `no stored extract`, skip GET for that class,
    other class still GETs.
16. Unreadable trades + quotes miss → HTTP 500 (AC-55); both unreadable → 500; content-hit +
    unreadable sibling → 200, `""` body.
17. Already-kept not overwritten (AC-27). Live REST key in files slot refuses with 0 GET and
    REST clause (AC-22); missing pair distinct, no REST clause (AC-21).
18. Unset root not-storing, desk up (AC-20, AC-32). Collision refuse-to-mix, serve would still
    bind, not not-storing (AC-34).
19. Coverage missing stays missing (AC-35–37): keep/load does not `insert_if_absent` and does
    not flip `classify_loaded`. Tape occupancy unchanged (AC-38).
20. Load with vendor stub down still loads extracts (AC-8, AC-9). Gzip discarded — load body is
    extract CSV only (AC-52). No aggregates column / `0 aggregates` (AC-51).
21. Score/tier/fingerprint byte-identical construct on vs off and succeed vs fail (AC-31) —
    `generate_signals` over the same vendor fixture.
22. Hub/SSE still emit during keep success and keep fault (AC-30): second
    `StockStreamHub::harness_local()` subscriber still receives `publish_event` while keep
    runs/fails. Keep fault never 5xxs bundle / scan / SSE / ensure (AC-28).
23. Canary secrets absent (AC-49). Evidence: local (AC-50). Poison tokens absent including
    miss-beside-keep (AC-25).
24. Keep process-exit match has **no** `unauthorized` arm; HTTP 401 is `metrics_unauthorized`
    only.

`massive_flat_file_isolation.rs` source scans (mutation-tested; anti-vacuity: a needle that
cannot fire fails the test):

- `infrastructure/flatfiles` has no `MASSIVE_API_KEY` / `massive_api_key` field / `api_key`
  field; no `Response::bytes()`
- `flat_file_keep` has no `insert_if_absent` / `LiveMassive` / `spawn_capture` /
  `MarketDataPort` / `compute_analytics_from_vendor` / `ENSURE_SYMBOLS` / `classify_loaded`
- `quant-engine` / `generate_signals` / `compute_opportunity_tier` do not import
  `flat_file_keep` or `flatfiles`
- Request-path modules (`routes/market.rs`, `routes/stream.rs`, `routes/ticker.rs`,
  `routes/scan.rs`) have no files-client type
- `Cargo.toml` / `Cargo.lock` have no `aws-sdk`
- `MarketDataSourceKind` still three arms in `market_data/mod.rs`
- `server.rs` has no keep poller / interval fetch
- `tape_root_conflicts` still 4 params; keep root is not a peer
- `functions/api/[[path]].ts` still 404s `/api/_research` and `/api/_metrics` prefixes
  (AC-44, AC-46) — read-only
- OperatorMetrics `STAGES` file still the six names (AC-45)
- Dashboard product sources (exclude `*.spec.*`) have no `flat-files keep` /
  `MASSIVE FLAT FILES` / `files.massive.com` / `/api/_research/flat-files` /
  `next-day CSV` — **do not** ban `LiveTape`
- `libs/api/src/lib/convexa.ts` has no `/api/_research/flat-files` helper
- Session-book / coverage / tape framing strings still present on **those** vehicles
  (AC-35–38)
- `health.rs` has no `flat-files` nest
- Scoring path / `generate_signals` empty product diff vs this leaf

Runtime: bundle / scan / SSE / ensure still `Ok` when store is `Failing`, `NotStoring`, or
`RefuseToMix` (AC-28, AC-32, AC-33, AC-34). Production unset does not fetch files and still
talks to Massive REST/WS (AC-32) — structural: `AppState::construct` never builds
`MassiveFilesClient`.

Run:

```
cargo test -p api-rust --test massive_flat_file_keep --test massive_flat_file_isolation --locked -- --nocapture
cargo test -p api-rust --test api_contract_runtime_auth_research operator_research -- --nocapture
```

If a coverage-env flake appears (not the default), retry with `-- --test-threads=1`. Check
`$LASTEXITCODE`.

Expect FAIL then PASS.

Commit: `test(api): massive flat files isolation and hermetic gate`

**Reviewer probes:** Do not green whole-command `Vendor I/O: 0` on the trades-only plant. Do not
green keep exit 0 while quotes miss. Do not persist QQQ trades miss beside SPY trades keep.
LiveTape still allowed. Pages bytes unchanged. Score pin empty.

---

## B8 — Closer: serve + conformance receipt

**Files:** `.spire/clusters/tech/contracts/massive-flat-file-keep/conformance-receipt.json`

**Depends on:** B1, B2, B3, B4, B5, B6, B7. **Independent:** no.

B8 does **not** re-implement worker paths. It proves the graph serves and writes the lane receipt.

### Steps

1. `cargo fmt -p api-rust` then `cargo fmt -p api-rust -- --check` (exit 0).
2. `cargo check -p api-rust --features postgres` (exit 0).
3. `cargo test -p api-rust -p quant-engine --locked` (exit 0). Check `$LASTEXITCODE`. If a
   coverage-env flake appears, retry `cargo test -p api-rust --locked -- --test-threads=1`.
4. `npm run api:contract:check` →
   `API contract check passed: generated artifacts match the Rust API contract.`
5. Free ports and serve (**not** `npx nx serve api`):

```
npm run ports:free
cargo run -p api-rust --features postgres -- serve
```

   Listener `:8000`. Default live 200 **does not** need a keep root (NVDA NotInWatchlist).
   Unset root is honest not-storing for locked symbols — that is **not** the NVDA probe.

6. Receipt — do **not** hand-edit JSON:

```
node .grok/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/massive-flat-file-keep/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/massive-flat-file-keep/conformance-receipt.json
```

   Expect tool-written `verdict: PASS` (shape/types). Exact `vendor_called === false` and
   closed literals are unit/GATE Q. `et_date=not-a-date` must be 422. NVDA list/load must
   **not** 404 / not be captured as session-books `{symbol}` / not be captured as
   session-day-tape `{symbol}`. Session-books + tape re-pins must pass.

   If serve cannot boot, `--sample` so the receipt records `UNVERIFIABLE` — honest, not a fake
   PASS.

7. NUL scan the receipt → `0`.
8. `git diff --name-only -- apps/dashboard libs/quant-engine` must be empty except F1’s
   `*.structural.spec.ts`. Generated `libs/api/src/generated/schema.ts` may change.

Commit: `test(api): massive-flat-file-keep conformance receipt`

**Reviewer probes:** closer diff is the receipt (+ fmt if any). No re-touch of `flat_file_keep`
logic. Receipt `endpoints` includes the six interface entries.

---

# Frontend track

SPEC §4 is `NO_UI_CHANGE` and **names no dashboard files**. This track is **structural-absence
tests only**. Do not invent a trader route, Settings copy, Ask-AI line, Ticker/LiveTape chip,
`/_ops/metrics` keep matrix, or `@convexa/api` list/load helper. Do not amend
`DESIGN_SYSTEM.md`. Live tape remains the genuine-stream widget’s title; this corpus does not
occupy it.

## F1 — Structural absence (Pages 404, trader chrome, OperatorMetrics, client)

**Files:** `apps/dashboard/src/app/massive-flat-file-keep.structural.spec.ts` (**create**)

**Depends on:** — **Independent:** no (SPEC §4 names no files; this is the frontend closer).

F1 is the **only** frontend closer. It does not implement worker UI paths because there are
none.

### Tests first

Copy the mutation-tested shape of
`apps/dashboard/src/app/session-day-tape-capture.structural.spec.ts`. Needles must **not**
include `LiveTape` or bare `tape`.

```ts
const TRADER_FORBIDDEN = [
  '/api/_research/flat-files',
  'flat-files keep',
  'MASSIVE FLAT FILES',
  'files.massive.com',
  'next-day CSV',
  'massive_flat_files',
  'MASSIVE_FLAT_FILES',
  'flat files keep',
] as const;

const CLIENT_FORBIDDEN = ['/api/_research/flat-files', 'flat-files keep'] as const;
```

Cases:

- Anti-vacuity: Pages catch-all exists and 404s `_metrics` (AC-44)
- Same 404 branch covers `/api/_research` and `/api/_research/flat-files/SPY/extract`
  (AC-44, AC-46)
- Trader dashboard product sources (`import.meta.glob` excluding specs) hit **zero**
  `TRADER_FORBIDDEN` (AC-42, AC-43)
- `libs/api/src/lib/convexa.ts` hits zero `CLIENT_FORBIDDEN` (AC-48) — generated `schema.ts`
  is **excluded** (OpenAPI churn)
- `useLatencyTrend.ts` `STAGES` set-equality remains
  `vendor_fetch`, `engine_build`, `off_exchange`, `signals`, `persist`, `serialize_wrap`
  (AC-45) — no keep matrix / keep chip / stage named from this feature
- Operator-metrics product sources contain none of `flat-files keep` / `keep matrix`
- Mutation: if the scan cannot prove it bites (empty dashboard glob), fail
- Mutation: omitting `_research` from the Pages 404 if makes the guard fail

Run:

```
npx nx test @convexa/dashboard --testFile=massive-flat-file-keep.structural.spec.ts
npx nx typecheck @convexa/dashboard
```

Expect FAIL (file missing) then PASS. `$LASTEXITCODE` 0. Do **not** run bare
`nx format:write`. Scope Prettier to the new spec if needed:
`npx nx format:write --files apps/dashboard/src/app/massive-flat-file-keep.structural.spec.ts`.

Commit: `test(dashboard): massive-flat-file-keep structural absence`

**Reviewer probes:** no product `.tsx` diff. LiveTape copy untouched. Pages function bytes
unchanged. No `/_ops` keep chrome.

---

## Independence

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B1 | backend | `apps/api/Cargo.toml`; `apps/api/src/services/flat_file_keep/mod.rs`; `apps/api/src/services/flat_file_keep/watchlist.rs`; `apps/api/src/services/flat_file_keep/clocks.rs`; `apps/api/src/services/flat_file_keep/literals.rs`; `apps/api/src/services/flat_file_keep/occupancy.rs`; `apps/api/src/services/flat_file_keep/store.rs`; `apps/api/src/services/flat_file_keep/fs.rs`; `apps/api/src/services/flat_file_keep/extract.rs`; `apps/api/src/services/flat_file_keep/keep.rs`; `apps/api/src/services/flat_file_keep/cli.rs`; `apps/api/src/services/mod.rs` | — | no |
| B2 | backend | `apps/api/src/config.rs`; `apps/api/src/state.rs`; `apps/api/src/services/flat_file_keep/fs.rs`; `apps/api/.env.example` | B1 | no |
| B3 | backend | `apps/api/src/infrastructure/flatfiles/mod.rs`; `apps/api/src/infrastructure/flatfiles/credentials.rs`; `apps/api/src/infrastructure/flatfiles/sigv4.rs`; `apps/api/src/infrastructure/flatfiles/client.rs`; `apps/api/src/infrastructure/mod.rs` | B1 | yes |
| B4 | backend | `apps/api/src/services/flat_file_keep/extract.rs`; `apps/api/src/services/flat_file_keep/keep.rs` | B1 | yes |
| B5 | backend | `apps/api/src/routes/research_flat_files.rs`; `apps/api/src/routes/mod.rs`; `apps/api/openapi/precutover-operation-baseline.json`; `apps/api/tests/api_contract_parity.rs`; `apps/api/tests/api_contract_router.rs`; `apps/api/tests/api_contract_runtime_auth_research.rs`; `tools/api-contract.mjs`; `tools/api-contract.spec.mjs`; `apps/api/openapi/convexa.openapi.json`; `apps/api/openapi/parity-coverage.json`; `apps/api/openapi/generated-artifacts.manifest.json`; `apps/api/tests/fixtures/api_contract/boundary-evidence.json`; `libs/api/src/generated/schema.ts` | B1, B2 | no |
| B6 | backend | `apps/api/src/main.rs`; `apps/api/src/services/flat_file_keep/cli.rs` | B1, B2, B3, B4 | yes |
| B7 | backend | `apps/api/tests/massive_flat_file_keep.rs`; `apps/api/tests/massive_flat_file_isolation.rs` | B3, B4, B5, B6 | no |
| B8 | backend | `.spire/clusters/tech/contracts/massive-flat-file-keep/conformance-receipt.json` | B1, B2, B3, B4, B5, B6, B7 | no |
| F1 | frontend | `apps/dashboard/src/app/massive-flat-file-keep.structural.spec.ts` | — | no |

B8 is the **only** backend closer. F1 is the **only** frontend closer. Closers do not
re-implement worker paths.

Independent-yes path check (backend): B3 `infrastructure/flatfiles/*` + `infrastructure/mod.rs`,
B4 `extract.rs` + `keep.rs`, B6 `main.rs` + `cli.rs` share no equal/prefix write path. B1
stubs `extract.rs`/`keep.rs`/`cli.rs` before the yes workers overwrite them (B1 is `no`).
Frontend has no `Independent: yes` row (SPEC §4 names no files).

---

# Verification track

Run after B8 + F1. Check `$LASTEXITCODE` after **every** command.

### V1 — Unit / integration suite

```
cargo test -p api-rust -p quant-engine --locked
```

**Expect:** exit 0. New filters green: `services::flat_file_keep`, `infrastructure::flatfiles`,
`flat_files_wiring`, `--test massive_flat_file_keep`, `--test massive_flat_file_isolation`.
Existing `session_chain_archive`, `archive_coverage`, `session_day_tape_*`, `api_contract_*`,
score-identity tests still pass.

If a coverage-env flake appears:

```
cargo test -p api-rust --locked -- --test-threads=1
```

**Expect:** exit 0. Do not treat a printed `passed` summary as green without the exit code.

### V2 — Postgres compile

```
cargo check -p api-rust --features postgres
```

**Expect:** exit 0. **No** new migration / `ViolationCategory`. Keep root is not a production
serve prerequisite.

### V3 — Named CLI (local evidence)

```
cargo run -p api-rust --locked -- flat-files --help
```

**Expect:** exit 0. Help lists `flat-files` and `keep`. Optional `--symbol` / `--et-date`.

```
cargo run -p api-rust --locked -- flat-files --symbol NVDA --et-date 2020-01-02
```

**Expect:** exit 0. Stdout contains `not in flat-files watchlist: NVDA` and `Not a miss.`
Evidence: `local`. Must succeed without `MASSIVE_API_KEY`.

### V4 — OpenAPI / generated client

```
npm run api:contract:check
```

**Expect:** `API contract check passed: generated artifacts match the Rust API contract.`
Operation count 57. `libs/api/src/lib/convexa.ts` still has no flat-files helper.

### V5 — Frontend structural absence + typecheck

```
npx nx test @convexa/dashboard --testFile=massive-flat-file-keep.structural.spec.ts
npx nx typecheck @convexa/dashboard
```

**Expect:** both exit 0. No product dashboard diff besides the spec file.

### V6 — Isolation poison (rejecting paths)

Re-run `--test massive_flat_file_isolation` and the AC-54 subset of
`--test massive_flat_file_keep`. **Expect:** exit 0. Confirm the suite includes a **rejecting**
path (not-elapsed no fetch, wrong-credential refuse, dated inspect no stored extract ≠ miss,
extract does not mint live paid present, tape occupancy unchanged, weekend is not miss, OPRA
not stored, aggregates column absent, miss envelope not used when sibling **class** is kept,
miss occupancy not used when sibling **name** is kept for the same class, unreadable+miss and
both-unreadable are 500, whole-command `Vendor I/O: 0` / keep exit 0 **not** asserted on a
trades-only content-hit plant, keep exit 0 **not** asserted when quotes miss after trades skip)
**and** an accepting planted due keep of trades **and** quotes for the trio **when no sibling
content-hit exists**. GATE Q twin: SPY already kept for `(D, trades)` + keep names QQQ → QQQ
**trades** `no stored extract`, SPY trades kept, **trades** files-call 0, never trades miss;
quotes independent. GATE Q twin (both-classes content-hit): whole-command files-call 0,
skip-GET `[OK]` exit 0.

### V7 — GATE Q live conformance

```
npm run ports:free
cargo run -p api-rust --features postgres -- serve
```

Then:

```
node .grok/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/massive-flat-file-keep/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/massive-flat-file-keep/conformance-receipt.json
```

**Expect:** tool `verdict: PASS` on the six interface entries. NVDA list 200 (not-in-watchlist).
NVDA load 200. SPY `et_date=not-a-date` 422. Session-books list 200 + miss load 404. Tape list
200 with `path_b_interval` / `days`. Receipt NUL count 0.

### V8 — Review ACs (not a DOM harness)

Walk AC-57–61 as **review** (no named dashboard route; no lab UI / gzip-keep / watchlist
expansion / OPRA; standing-block / glossary / banned-term copy; license; CLI evidence class).
Do not certify hosted “we kept every Tuesday.” Do not treat lagging SPEC §4 Flow 1
files-call-0∧exit-0 prose as the GATE Q bar — AC-54 + INTERFACE standing rule 10 are the bar.

---

## Reviewer probe (plan-authored defects)

- OpenAPI live pin is **55 not 52**. This ship adds **two** GETs → 57. Direct-HTTP `observed ==
  55` in `api_contract_parity.rs` is a **catalog outcome** pin — re-pin after generate; do not
  assume it stays 55 or becomes 57.
- `tools/api-contract.mjs` must map `flat-files` **before** `session-day-tape` **before**
  `session-archive` **before** `session`.
- Serve collision is `Ok(RefuseToMix)`, **unlike** tape’s `AppError::Config`. Do not copy tape
  B2 Err-on-collision.
- Do not add this root as a peer inside `tape_root_conflicts`.
- Do not cite Python. Do not treat `npx nx serve api` as the serve command.
- Do not ban `LiveTape` in F1 needles.
- Do not implement lagging SPEC §4 Flow 1 / §6 / §7 / §9 files-call-0∧exit-0 conjunction.
  AC-54 + INTERFACE standing rule 10 + SPEC §5 mixed-class keep exit are binding.
- Do not invent a keep occupancy named `unauthorized`.
- Do not add `MarketDataSourceKind::FlatFile`. Do not use `MASSIVE_API_KEY` as SigV4 material.
- Do not add `aws-sdk-*`. Do not `Response::bytes()` a universe object. Do not retain gzip as
  the occupant.
- Do not print `0 aggregates`. Do not persist miss beside a sibling keep of the same class.
