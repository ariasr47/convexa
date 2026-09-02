# session-day-tape-capture — implementation plan

> **For agentic workers:** implement task-by-task, in order inside a lane. Steps use checkbox
> (`- [ ]`) syntax. Each task carries its own TDD cycle: write the failing test → run it, watch it
> fail → implement minimally → run it, watch it pass → commit. If this plan contradicts the tree,
> **report the conflict — do not resolve it silently** (`PLAN_METHOD.md`, "Plans are code").
> Do not edit `SPEC.md` or `INTERFACE_CONTRACT.md`.

**Goal:** Persist a replayable open-to-close **research** day (Path-A unsampled stocks-WS trades
and quotes + Path-B 5-minute already-paid structure snapshots) for the locked watchlist
SPY · QQQ · IWM, with operator list/load under `/api/_research/session-day-tape/…`, zero vendor I/O
on read, and **no trader UI**.

**Architecture:** One-way leaf `apps/api/src/services/day_tape/` (score / gate / fingerprint /
ensure / coverage / `quant-engine` do not import it). Path-A sidecar attaches to
`AppState.stock_hub.subscribe_events()` after listener bind (recv `try_send` only; writer is the
only Path-A disk waiter). Path-B persist is a fire-and-forget hook **inside** `refresh_analytics`
after a successful compute — still **no** `spawn_capture`. HTTP adapter
`routes/research_session_day_tape.rs` sits beside `research_session_books.rs`. Capture write is
off-request-path. Combined Path-A + Path-B envelope; no path filter; no playback.

**Tech stack:** Rust 2021 · Axum/Tokio (`apps/api`, crate `api-rust`) · clap 4 · `chrono` +
`chrono_tz::America::New_York` · `tracing`. Tests: `cargo test -p api-rust -p quant-engine --locked`.
OpenAPI graph **53 → 55** (two new GETs). Frontend: SPEC §4 `NO_UI_CHANGE` — **structural-absence
tests only**; do not invent trader UI.

**Spec:** `.spire/clusters/tech/contracts/session-day-tape-capture/SPEC.md` (APPROVED 2026-08-29 —
GATE Z AC-32 residual folded)
**Interface:** `.spire/clusters/tech/contracts/session-day-tape-capture/INTERFACE_CONTRACT.md`

---

## GATE Z residual — AC-32 (owner `A` 2026-08-29, **settled**)

Do **not** distinguish “before we recorded” from “no tape that day.” There is no recorded
store-start fact. This is the accepted residual (same as session-archive coverage, no `since`).

**Derive never emits `NotExpectedPreStore`.** A named past weekday with no day container is
**`NoIdentity`** / `no session day tape…`. List is **stored days only** — no pre-store rows,
no invented history grid. Operator literal `session day tape not expected before storing…` is
**not required**. Framing `RESEARCH READ — SESSION DAY TAPE NOT EXPECTED` is **not** a required
200 class. The Axis A type arm may remain unused in an exhaustive `match`, or be deleted; if
kept, it has **no required operator outcome**.

**Do not implement** any of: env `SESSION_DAY_TAPE_STORE_STARTED*` / `SESSION_DAY_TAPE_STARTED*`;
marker file (`store-started`, `watermark`, `storing_since`); `min(present)` / first-arm-as-start
as a process window.

**Do not** invent a test that greens a pre-store class. Mapping of an unused type arm is
**optional**. GATE Q must **not** claim the old ship-blocking AC-32. Poison 10 (B7) still
forbids `store_started` / `storing_since` / `watermark` / `SESSION_DAY_TAPE_STORE_STARTED` /
`SESSION_DAY_TAPE_STARTED`.

AC-32 is **not ship-blocking**. Ship-blocking set is AC-1–AC-31, AC-33–AC-58, and AC-66.

---

**Cited live Rust (read at source — do not cite Python or briefing HTML):**

- Path-A feed: `StockStreamHub` in `apps/api/src/infrastructure/massive/ws.rs` —
  `BROADCAST_CAPACITY = 4096`, `subscribe(&[String])` enqueues `HubCmd::Subscribe` (not
  `LiveCapacity::admit_and_subscribe`), `subscribe_events() -> broadcast::Receiver<StreamEvent>`,
  harness `harness_local()` + `publish_event`. Attach the sidecar to
  `AppState.stock_hub.subscribe_events()`. Never CLI `run_price_stream` /
  `MassiveStockStream::connect`.
- `StreamKind::{Trade, Quote}` and `StreamEvent` in `apps/api/src/domain/price.rs`
  (`kind`, `ts_ns`, `price`/`size`, `bid`/`ask`/`bid_size`/`ask_size`). Do **not** persist
  `LivePrice` — `display_price` already collapsed trade vs mid.
- SSE: `apps/api/src/routes/stream.rs` latest-wins `PriceCache.set_price`. Independent
  `broadcast::Receiver` from the sidecar.
- Path-B fetch: `refresh_analytics` in `apps/api/src/services/analytics.rs` currently
  `let (snap, _vendor) = compute_analytics(...)?;` then **drops** `_vendor`
  (`// Intentionally drop _vendor — warmer / refresh_analytics must not capture.`).
  `compute_analytics` returns `(AnalyticsSnapshot, VendorBundle)`. `spawn_capture` is only
  ticker-cold / DTE-filter / `load_or_compute` miss (`analytics.rs` lines that call
  `chain_snapshot::spawn_capture`) plus scanner slow-lane. Poison: `refresh_analytics` still
  has **no** `spawn_capture`.
- `WARM_INTERVAL_SECS` default **25** (`config.rs`); `DEFAULT_LIQUID` is ten names; tape
  watchlist is **not** an alias of `ENSURE_SYMBOLS` (`ensure.rs` `["SPY","QQQ","IWM"]`) or
  `WARM_SYMBOLS`.
- Session archive: `insert_if_absent` first-wins `(symbol, et_date)` in
  `services/session_chain_archive/store.rs`. Coverage `classify_loaded` in `coverage.rs` maps
  `(LiveMassive, LiveMassive)` → `present`. Tape load **never** calls it. Tape persist never
  `insert_if_absent` / `archive_session_best_effort`.
- `MarketPhase::classify` in `domain/market.rs`: weekday 09:30–16:00 inclusive is `Rth`; after
  16:00:00 `AfterClose`; weekend `ClosedPre`. Path-A’s 04:00–20:00 window is an ET clock
  predicate, **not** `== Rth`. Path-B 16:00 fill is `[16:00, 16:05)` and must **not** filter
  `== Rth`.
- `MarketDataSourceKind::{LiveMassive, Fixture}` in `services/market_data/mod.rs` — two arms,
  exhaustive `match`. No third variant. `ChainSnapshotWire.source` in `chain_snapshot/wire.rs`.
- Token: `health::metrics_token_ok` as used by `routes/research_session_books.rs` `token_gate`.
  `GET /api/_metrics` is **not** the tape vehicle.
- `parse_et_date` in `session_chain_archive/et_date.rs`; `today_et_date` in `ensure.rs`. Tape
  **leaf** duplicates the tiny clock helpers (do not import `ensure.rs` / `coverage.rs` from
  `day_tape/`). HTTP adapter may call `session_chain_archive::parse_et_date` the same way
  session-books does.
- `mint_body_locator` in `session_chain_archive/body_store.rs` — Path-B unique-per-put is a
  **sibling** locator under the tape root (as_of_ns + nonce), not that function imported into
  the leaf if it would pull archive types. Copy the nonce pattern locally.
- `body_root_conflicts(body_root, ring, index)` in `config.rs` (equals or nests under ring
  store or archive **index**). Tape collision also includes session-archive **body** root —
  add `tape_root_conflicts` (do not silently change the 3-arg archive callers’ fail-open
  behavior).
- Spawn seam: `server.rs` after `TcpListener::bind` and `stock_worker.start()`, beside
  `warmer::spawn` and `ensure_worker::spawn`.
- CLI: `Commands` in `apps/api/src/main.rs`; `Capacity` / `ArchiveCoverage` return `ExitCode`
  **before** `run()`. Tape CLI does the same. `cmd_score_lab` empty `massive_api_key` pattern
  — must run without `MASSIVE_API_KEY` and must not construct `MassiveRestClient` /
  `MarketDataPort::live`.
- Pages: `functions/api/[[path]].ts` already 404s `/api/_metrics` and the entire
  `/api/_research/` prefix.
- OpenAPI live pin: **53** operations (`api_contract_parity.rs` `operation_count`,
  `api_contract_router.rs` `add!(` count − 1, `validateRegistrationPairs` default 53,
  `precutover-operation-baseline.json` `operation_count` 53). Adding two GETs → **55**. Frozen
  compile-probe `openapi-router-integration-all-52` / `registration_count: 52` stays
  **historical** — do **not** retarget `validateCompileProbeReceipt`.
- OperatorMetrics `STAGES` in `apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.ts`
  is the six latency stages. Tape adds none.
- `debug_assert_no_secrets` in `chain_snapshot/capture.rs` (`apikey` / `api_key`). Tape Path-B
  blobs get the same asserts.

---

## Track map

| Track | Tasks | Notes |
|---|---|---|
| **Backend** (`apps/api`) | **B1 → B8** (B8 is the lane closer) | Product surface |
| **Frontend** (`apps/dashboard`) | **F1** (structural-absence only; F1 is the lane closer) | SPEC §4 `NO_UI_CHANGE`. No trader UI. F1 is tests that must stay red if chrome appears. |
| **Verification** | **V1 → V8**, after B8 + F1 | Exact commands + expected output. GATE Q is V7+V8. Do **not** claim a pre-store 200 (GATE Z residual). |

**Sequencing.** B1 (leaf types + Memory store) is foundation. B2 (config + Json/FS + AppState
open + postgres index) depends on B1. After B2, **B3 Path-A** and **B4 Path-B** are independent
(`Independent: yes`, disjoint write paths). B6 CLI is also `yes` after B2 (disjoint from B3/B4;
k=2 will queue the third). B5 HTTP+OpenAPI is `no` (touches `routes/mod.rs`, `tools/`, generated
`libs/api`). B7 isolation waits on B3–B6. B8 closer waits on every backend task and writes only
the lane receipt.

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
  `WARM_SYMBOLS` / `DEFAULT_LIQUID` / `universe.json`. Upper/trim-normalize. Do not silently
  union tape names into `WARM_SYMBOLS`.
- Day identity `(symbol, et_date)` America/New_York `YYYY-MM-DD`. Not first-wins one body. Not
  ring `(symbol, as_of)`.
- Path-A keep-set = every decoded `StreamKind::Trade` and every decoded `StreamKind::Quote`
  already on `StockStreamHub` for the locked trio (D1). Unsampled. Two quotes in one second both
  remain. Not OPRA. Not `LivePrice`.
- Path-A window = ET weekdays **04:00 ≤ t < 20:00** (D2). Overnight 20:00–04:00: do not append;
  those events must not classify the identity empty-while-storing. Weekend ineligible. No NYSE
  holiday table — a holiday weekday with no prints is empty-while-storing.
- Completeness clock (Axis C) judges **09:30–16:00 ET only**.
- Recv loop **never awaits disk** (poison 9). Capacity of the writer event mpsc is **4096**
  (same number as hub `BROADCAST_CAPACITY`; do not retune). Overflow / `Lagged(n)` / hub
  Closed → latch `gap_pending` + increment `dropped`; writer `select!` flushes **one** coalesced
  Path-A gap JSONL. Do not `try_send` a gap into the already-`Full` event channel.
- Path-B = at most one already-paid snapshot per clock-aligned mark **09:30, 09:35, …, 16:00**
  inclusive from `refresh_analytics` only. 16:00 fill window `[16:00, 16:05)`. No extra REST.
  No `spawn_capture`. Mark-gaps **derive on load** (SPEC §2.3). Write-time gap mint optional.
- Enablement = dedicated env `SESSION_DAY_TAPE_BODY_ROOT` (no nested default under `data/`).
  Unset / missing / unwritable → listener **binds**, capture off, operator
  `session day tape not storing`. Collision with ring, archive index, or archive body root →
  **refuse construct** (the only tape start refusal). `[production-fails-closed]` does **not**
  gain a tape-root prerequisite. No store-start watermark beside the root.
- Occupancy is three composing axes. No `complete_rth` / coverage `present`/`missing`/`not yet
  due`/`blocked occupancy`. Tape never `MarketDataSourceKind::LiveMassive`. Pre-store is **not**
  a distinct operator class.
- `authorizes` is exactly `nothing`. `vendor_called` is always `false` on successful handling.
  Evidence HTTP `this process`; CLI `local`. License:
  `Our research · not redistributed on a trader route.`
- Combined envelope only. Banned framing: `RESEARCH READ — PATH-A TICKS`,
  `RESEARCH READ — PATH-B STRUCTURE SNAPSHOTS`, session-book / coverage / ring / replay tokens
  on this vehicle. `RESEARCH READ — SESSION DAY TAPE NOT EXPECTED` is not a required 200 class.
- Load `detail` is the Axis A gate literal on gate/no-row 200s (`NotInWatchlist`,
  `IneligibleWeekend`, `NotElapsed`, `NoIdentity`); **`null`** on `StoringReady` content hits
  (facts live in `clock` / `path_a_detail` / `path_b_detail` / arrays).
- Capture write is not an HTTP API. No playback. No `_metrics` nest. Pages 404 `_research`.
- Do **not** mark `"auth": true` on conformance entries.
- Do **not** run `npm run api:contract:baseline:accept`. Direct-edit
  `precutover-operation-baseline.json` operations + `operation_count`, then
  `npm run api:contract:generate`.
- **AC-32 residual (owner A 2026-08-29, not ship-blocking):** derive never emits
  `NotExpectedPreStore`; named past weekday with no container = `NoIdentity` /
  `no session day tape…`; list = stored days only; no watermark. GATE Q must **not** claim the
  old SB AC-32 or a pre-store 200.
- **AC-7 persist-fault:** list/load shows a Path-A gap occupant when the writer **successfully
  appends** the coalesced gap record after an event persist fail (test with fail-once). When
  the disk is dead and the gap append also fails, AC-38 skip line is the observable; do **not**
  invent a non-disk occupant. SPEC §2.2/§5 “may” covers dual-fail. Full / Lagged / Closed are
  hard (latch, no disk required to set the latch; writer flushes when disk works).

### Locked operator literals (copy; do not paraphrase)

HTTP framing — exact table in SPEC §4. Command `session-day-tape`. Evidence HTTP `this process`.
Watchlist always `["SPY","QQQ","IWM"]`. `path_b_interval` always
`5-minute marks 09:30, 09:35, …, 16:00 ET`. Hit provenance
`loaded from session day tape · no vendor call`. Miss provenance `no vendor call`. Standing
`research tape · never live_massive · never coverage present`.

| Class | Exact string |
|---|---|
| Not in watchlist | `not in tape watchlist: {SYMBOL}` |
| Not storing | `session day tape not storing` |
| Weekend | `session day tape ineligible weekend: {SYMBOL} on {ET_DATE}` |
| Not elapsed | `session day tape not elapsed: {SYMBOL} on {ET_DATE}` |
| No identity | `no session day tape for {SYMBOL} on {ET_DATE}` (named **past** weekday with no container uses this class) |
| Path-A empty | `no path-a ticks for {SYMBOL} on {ET_DATE}` |
| Path-B empty (0 snap **and** 0 gaps) | `no path-b snapshots for {SYMBOL} on {ET_DATE}` |
| Path-A gap | `path-a gap: hub or writer for {SYMBOL} on {ET_DATE}` optional ` · {n} dropped` |
| Path-B mark gap | `path-b gap: no snapshot at {HH:MM} ET for {SYMBOL} on {ET_DATE}` |
| Path-B not capturing | `path-b not capturing: already-paid fetch off for {SYMBOL} on {ET_DATE}` |
| Unreadable | `session day tape unreadable: {reason}` |
| Partial | `session day tape partial: capture not through 09:30–16:00 ET for {SYMBOL} on {ET_DATE}` optional ` · capture-on {HH:MM}–{HH:MM} ET` |
| Through-window | `session day tape through-window 09:30–16:00 ET for {SYMBOL} on {ET_DATE} · does not certify open-to-close` |
| Path-A counts | `path-a ticks: {n_trade} trades · {n_quote} quotes` |
| Path-B counts | `path-b snapshots: {k} snapshots · {g} gaps` |
| S2 Path-A skip | `session day tape write skipped — path-a · trader path unchanged` |
| S2 Path-B skip | `session day tape write skipped — path-b · trader path unchanged` |
| Unauthorized detail | `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` |
| Bad date | `et_date must be YYYY-MM-DD` |

`session day tape not expected before storing: {SYMBOL} on {ET_DATE}` is **not required**.
Do not ship it as a required HTTP/CLI outcome.

List clock cells (INTERFACE closed set; **stored rows only**): `partial` ·
`through-window · not certified` · `ineligible weekend`. **`not expected before storing` is not
in this closed set** (list has no pre-store rows). `null` while still in-window with start ≤
09:30. Not-elapsed is load-only. List does not invent future `et_date` rows.

`path_a_detail` is a **single** string. Composition when `StoringReady`:

- 0 trades, 0 quotes, 0 Path-A gap records → `no path-a ticks for {SYMBOL} on {ET_DATE}`
- otherwise the counts line; if `path_a_gaps` non-empty, append
  ` · path-a gap: hub or writer for {SYMBOL} on {ET_DATE}` (vouched ` · {n} dropped` lives on
  the occupant / optional suffix, with `path_a_gaps[].dropped` as the number)
- Axis A gate 200s → `""`

`path_b_detail`:

- `PathBNotCapturing` → not-capturing literal
- 0 snapshots and 0 derived gaps → `no path-b snapshots for {SYMBOL} on {ET_DATE}`
- otherwise `path-b snapshots: {k} snapshots · {g} gaps` (through-window all-missed is this
  line **plus** per-mark gap literals in `path_b_gaps[]`, never the empty literal)
- Axis A gate 200s → `""`

### Interface contract (verbatim)

The block below is copied **verbatim** from `INTERFACE_CONTRACT.md` `## Conformance spec` so both
lanes inherit the same binding shape (GATE PLAN law).

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

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/services/day_tape/mod.rs` | **Create** — leaf exports; no `ensure`/`coverage`/`signals` imports |
| `apps/api/src/services/day_tape/watchlist.rs` | **Create** — `TAPE_WATCHLIST` |
| `apps/api/src/services/day_tape/clocks.rs` | **Create** — ET date, Path-A window, Path-B marks, Axis C |
| `apps/api/src/services/day_tape/literals.rs` | **Create** — closed strings |
| `apps/api/src/services/day_tape/occupancy.rs` | **Create** — Axis A/B/C + envelope projection |
| `apps/api/src/services/day_tape/store.rs` | **Create** — Disabled / Memory / Failing / fail-once |
| `apps/api/src/services/day_tape/fs.rs` | **Create** — Json+FS under dedicated root |
| `apps/api/src/services/day_tape/path_a.rs` | **Create** — recv + writer sidecar |
| `apps/api/src/services/day_tape/path_b.rs` | **Create** — persist hook + mark-gap derive |
| `apps/api/src/services/day_tape/cli.rs` | **Create** — optional clap render |
| `apps/api/src/services/mod.rs` | `pub mod day_tape;` |
| `apps/api/src/config.rs` | `SESSION_DAY_TAPE_BODY_ROOT` + `tape_root_conflicts` |
| `apps/api/src/state.rs` | `day_tape: SessionDayTape` field; open; **Err** on collision |
| `apps/api/src/server.rs` | spawn sidecar after `stock_worker.start()` |
| `apps/api/src/services/analytics.rs` | Path-B hook inside `refresh_analytics` only |
| `apps/api/src/routes/research_session_day_tape.rs` | **Create** — list/load |
| `apps/api/src/routes/mod.rs` | `mod` + `add!` + conversion registry + operator security |
| `apps/api/src/main.rs` | `Commands::SessionDayTape` ExitCode before `run()` |
| `apps/api/src/db/migrations.rs` | v13 `session_day_tape` index (no BYTEA) |
| `apps/api/src/db/pg_session_day_tape.rs` | **Create** — postgres feature |
| `apps/api/src/db/mod.rs` | `pub mod pg_session_day_tape` |
| `apps/api/src/db/schema_verifier.rs` | probe `SELECT … FROM session_day_tape LIMIT 0` |
| `apps/api/openapi/precutover-operation-baseline.json` | two GETs; `operation_count` 55 |
| `apps/api/tests/api_contract_parity.rs` | 53 → 55; `/day` query `et_date` |
| `apps/api/tests/api_contract_router.rs` | `add!(` 53→55; disposable 55/56 |
| `tools/api-contract.mjs` / `tools/api-contract.spec.mjs` | pairing 55; **session-day-tape before session** |
| generated OpenAPI / schema / parity / manifest / evidence | `npm run api:contract:generate` |
| `apps/api/tests/session_day_tape_capture.rs` | hermetic Path-A/B + HTTP |
| `apps/api/tests/session_day_tape_isolation.rs` | poison scans, Pages, chrome, score |
| `apps/dashboard/src/app/session-day-tape-capture.structural.spec.ts` | **Create** — F1 |
| `.spire/clusters/tech/contracts/session-day-tape-capture/conformance-receipt.json` | B8 closer only |
| `functions/api/[[path]].ts` | **Verify only** — already 404s `/api/_research/*` |
| `apps/api/src/routes/research_session_books.rs` | **Do not change** framing / miss / `vendor_called` |
| `apps/api/src/routes/health.rs` | **Do not nest** tape on `_metrics` |

**Do not touch:** `libs/quant-engine`, `generate_signals` / `compute_opportunity_tier`,
`DESIGN_SYSTEM.md`, OperatorMetrics `STAGES` product source, frozen compile-probe receipt,
`ENSURE_SYMBOLS` membership, `WARM_SYMBOLS` default.

---

# Backend track

## B1 — Leaf: watchlist, clocks, occupancy, Memory/Disabled/Failing store

**Files:**

- `apps/api/src/services/day_tape/mod.rs` (**create**)
- `apps/api/src/services/day_tape/watchlist.rs` (**create**)
- `apps/api/src/services/day_tape/clocks.rs` (**create**)
- `apps/api/src/services/day_tape/literals.rs` (**create**)
- `apps/api/src/services/day_tape/occupancy.rs` (**create**)
- `apps/api/src/services/day_tape/store.rs` (**create**)
- `apps/api/src/services/mod.rs`

**Depends on:** — **Independent:** no (foundation).

### Tests first

Create the modules with `#[cfg(test)]`. Frozen dates (weekday = `num_days_from_monday() < 5`):

- Monday D = `2026-08-10`
- Saturday = `2026-08-08`
- Future weekday vs D = `2026-08-11`
- Named **past** weekday vs D = `2026-08-07` (Friday)
- 04:00 / 09:29 / 09:30 / 16:00 / 16:04 / 16:05 / 19:59 / 20:00 ET via
  `chrono_tz::America::New_York` (August = EDT)

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
fn tape_watchlist_is_exactly_spy_qqq_iwm_not_ensure_alias() { /* AC-6 */ }

#[test]
fn path_a_window_keeps_0459_to_1959_drops_2000_and_0359() { /* AC-9, AC-10 */ }

#[test]
fn path_b_grid_is_79_marks_0930_through_1600_inclusive_step_5() { /* AC-11, AC-12 */ }

#[test]
fn path_b_1600_fill_window_includes_1604_excludes_1605() { /* AC-14 */ }

#[test]
fn weekend_is_ineligible_before_not_elapsed() { /* AC-31, AC-66 order */ }

#[test]
fn future_weekday_is_not_elapsed_not_no_identity() { /* AC-66 */ }

#[test]
fn nvda_is_not_in_watchlist_before_not_storing() { /* AC-6 */ }

#[test]
fn not_storing_is_not_a_grid_of_empty_days() { /* AC-28 */ }

#[test]
fn no_identity_vs_empty_while_storing_vs_unreadable_are_distinct() { /* AC-27, AC-29, AC-37 */ }

#[test]
fn named_past_weekday_no_container_is_no_identity() {
    /* AC-32 residual: NoIdentity / no session day tape… — not a pre-store class */
}

#[test]
fn derive_never_returns_not_expected_pre_store() { /* poison 10 */ }

#[test]
fn list_clock_closed_set_has_no_not_expected_before_storing() { /* INTERFACE days[].clock */ }

#[test]
fn through_window_empty_path_a_still_prints_no_path_a_ticks() { /* AC-27, AC-34 */ }

#[test]
fn through_window_path_b_all_missed_is_mark_gaps_not_no_path_b_snapshots() { /* AC-16 */ }

#[test]
fn path_b_not_capturing_is_not_empty_and_not_a_gap_grid() { /* AC-17 */ }

#[test]
fn in_progress_rth_start_le_0930_omits_partial_and_through_window() { /* AC-35 */ }

#[test]
fn occupancy_match_is_exhaustive_per_axis_no_complete_rth_arm() { /* poison 5 */ }

#[tokio::test]
async fn memory_append_two_quotes_same_second_both_remain() { /* AC-2, AC-4 */ }

#[tokio::test]
async fn jsonl_trailing_partial_line_skipped_prior_intact() { /* §2.2 crash */ }

#[tokio::test]
async fn failing_store_list_load_are_not_storing_or_store_error() { /* AC-29 family */ }
```

Do **not** add `constructed_not_expected_pre_store_maps_closed_literal` as a required test
(unused-arm mapping is optional). Do **not** plant a store-start date to green a pre-store class.

Run:

```
cargo test -p api-rust --lib services::day_tape -- --nocapture
```

Expect FAIL (modules missing). `$LASTEXITCODE` non-zero.

### Implement

`watchlist.rs`:

```rust
pub const TAPE_WATCHLIST: &[&str] = &["SPY", "QQQ", "IWM"];

pub fn normalize_symbol(raw: &str) -> String {
    raw.trim().to_ascii_uppercase()
}

pub fn in_tape_watchlist(symbol: &str) -> bool {
    let u = normalize_symbol(symbol);
    TAPE_WATCHLIST.iter().any(|s| *s == u.as_str())
}
```

Do **not** `use` `ENSURE_SYMBOLS`. A later poison test greps the leaf for it.

`clocks.rs` — local copies of `parse_et_date` / `today_et_date` (same rules as
`session_chain_archive/et_date.rs` and `ensure.rs`). Path-A predicate:

```rust
pub fn in_path_a_append_window(now: DateTime<Utc>) -> bool {
    let et = now.with_timezone(&New_York);
    if et.weekday().num_days_from_monday() >= 5 {
        return false;
    }
    let t = et.time();
    let start = NaiveTime::from_hms_opt(4, 0, 0).unwrap();
    let end = NaiveTime::from_hms_opt(20, 0, 0).unwrap();
    t >= start && t < end
}
```

Path-B: `path_b_marks() -> Vec<(u32, u32)>` 09:30 … 16:00 step 5 (79 entries).
`path_b_mark_for(now) -> Option<(u32,u32)>` uses `floor(now_et, 5min)` and accepts 16:00 only
when `09:30 ≤ t < 16:05` with the 16:00 mark covering `[16:00, 16:05)`. Do not call
`MarketPhase::classify` to keep/drop a mark.

`occupancy.rs` — three enums, exhaustive `match`, **no** `LiveMassive` / `Present` / `Missing` /
`complete_rth` arms. Axis A evaluation order **binding**:

1. `NotInWatchlist`
2. `NotStoring`
3. `IneligibleWeekend`
4. `NotElapsed` (`et_date > today_et_date(now)` on a locked weekday)
5. `NoIdentity` / `Unreadable` / `StoringReady`

`NotExpectedPreStore` is **not** a store-derive result. The type arm may remain unused in the
exhaustive match, or be deleted. Derive must **not** return it. A locked-watchlist capturable
weekday (including a **named past** weekday) with no day container is `NoIdentity`.

List `days[].clock` closed set is exactly `partial` · `through-window · not certified` ·
`ineligible weekend` (or `null`). Never emit `not expected before storing`.

Axis B Path-A `EmptyWhileStoring` = trade count 0 **and** quote count 0 **and** zero Path-A gap
records (AC-27). Gap records coexist with occupied ticks (`PathAHubGap`). Path-B
`EmptyWhileStoring` = 0 snapshots **and** 0 derived gap marks. Through-window all-missed-refresh
is `Occupied` gaps, not empty.

Axis C: `Partial` if capture-on does not cover `[09:30, 16:00]`; `ThroughWindow` iff armed-from
≤ 09:30 and armed-until ≥ 16:00. While still armed before 16:00 with start ≤ 09:30, **do not
print** Axis C (`clock: null`).

`store.rs` — enum `SessionDayTape { Disabled, Memory(...), Failing, FailOnce { ... }, Json(...)
/* B2 */, Postgres(...) /* B2 */ }`.

Quiet-day mint: `arm_path_a(symbol, et_date, now)` creates the day container (zero JSONL
records allowed) when capture first arms for that identity **inside** 04:00–20:00 ET weekday —
not when the first tick arrives, and **not** because overnight events arrived (AC-10). Path-B
arm records the capture-on interval when warm/refresh is on for that locked name, not when the
first snapshot succeeds. Capture-on intervals are per-identity arming while storing, **not** a
process-lifetime “storing since.”

JSONL kinds: `trade` | `quote` | `path_a_gap` (distinct). Trailing partial line skipped on
read; if the last **complete** record is unreadable, `Unreadable` with prior lines intact.

`Disabled` list/load for a locked symbol → not-storing error text `session day tape not storing`.
`Failing` writes always `Err`. `FailOnce` fails the next persist then succeeds (AC-7 persist-fault
arm).

`mod.rs` re-exports. `services/mod.rs`: `pub mod day_tape;`.

Poison in this task’s tests: occupancy source has no `LiveMassive` / `Present` / `complete_rth`;
`day_tape` files do not contain `insert_if_absent`, `archive_session_best_effort`,
`spawn_capture`, `ENSURE_SYMBOLS`, `classify_loaded`, `store_started`, `storing_since`,
`watermark`, `SESSION_DAY_TAPE_STORE_STARTED`, `SESSION_DAY_TAPE_STARTED`.

Re-run the lib filter. Expect PASS. `$LASTEXITCODE` 0.

Commit: `test(api): session day tape occupancy + memory store`

**Reviewer probes:** Axis A order tests (NVDA not-storing still not-in-watchlist; future Saturday
is weekend not not-elapsed; named past weekday with no container is NoIdentity). No watermark
env. `TAPE_WATCHLIST` is not a pointer at `ENSURE_SYMBOLS`. Path-B grid length 79. List clock
never `not expected before storing`.

---

## B2 — Dedicated root, collision refuse, Json+FS, AppState, postgres index

**Files:**

- `apps/api/src/config.rs`
- `apps/api/src/state.rs`
- `apps/api/src/services/day_tape/fs.rs` (**create**)
- `apps/api/src/db/migrations.rs`
- `apps/api/src/db/pg_session_day_tape.rs` (**create**, `cfg(feature = "postgres")`)
- `apps/api/src/db/mod.rs`
- `apps/api/src/db/schema_verifier.rs`

**Depends on:** B1. **Independent:** no.

### Tests first

In `config.rs` tests:

```rust
#[test]
fn tape_body_root_unset_is_none_not_invented_path() { /* AC-39 */ }

#[test]
fn tape_root_conflicts_with_ring_archive_index_and_archive_body() { /* AC-40 */ }
```

In `day_tape/fs.rs` / `state.rs` tests:

```rust
#[tokio::test]
async fn unset_root_constructs_disabled_listener_would_bind() { /* AC-39 */ }

#[tokio::test]
async fn colliding_root_refuses_construct() { /* AC-40 */ }

#[tokio::test]
async fn unwritable_root_is_not_storing_not_a_start_refusal() { /* AC-39 */ }

#[tokio::test]
async fn json_fs_round_trip_path_a_jsonl_and_path_b_unique_put() { /* AC-1 family */ }
```

`cargo test -p api-rust --lib config::tests::tape_ --lib services::day_tape -- --nocapture`
plus `cargo check -p api-rust --features postgres`. Expect FAIL.

### Implement

`Config` field:

```rust
/// Dedicated tape body root. `None` = unset → not storing (no nested default).
pub session_day_tape_body_root: Option<PathBuf>,
```

`from_env`: `parse_optional_path_env("SESSION_DAY_TAPE_BODY_ROOT")` — same helper as archive
body root. **Never** `data/session_day_tape` default. **Never** a store-start env beside it.

Keep existing `body_root_conflicts(candidate, ring, index)`. Add:

```rust
pub fn tape_root_conflicts(
    tape: &Path,
    ring: &Path,
    archive_index: &Path,
    archive_body: Option<&Path>,
) -> bool {
    body_root_conflicts(tape, ring, archive_index)
        || archive_body.is_some_and(|b| {
            path_equals_or_nests(tape, b) || path_equals_or_nests(b, tape)
        })
}
```

Json+FS layout **under that root only** (no second env):

```
{root}/index.json
{root}/{SYM}/{et_date}/meta.json
{root}/{SYM}/{et_date}/path_a.jsonl
{root}/{SYM}/{et_date}/path_b/{as_of_ns}-{nonce}.json
```

`meta.json` holds Path-A / Path-B capture-on instants and Path-B capturing boolean. Path-B
snapshot JSON **must not** contain `source`, `live_massive`, or `LiveMassive`. If
`to_wire`/`serialize_capture` is reused, **drop** the `MarketDataSourceKind` discriminant
before append. On load, a planted body that still carries `LiveMassive` is `Unreadable`
(poison 6) — never tape-hit framing, never coverage `present`.

`AppState` gains `pub day_tape: SessionDayTape`. Open rules:

| Root | Result |
|---|---|
| Unset / empty | `Disabled` — construct **Ok** |
| Set, collides | `Err(AppError::Config(...))` — refuse start (AC-40) |
| Set, missing or unwritable | `Disabled` — construct **Ok**, operator not-storing |
| Set, writable, non-colliding | Json (or Postgres index + FS bodies) — capture **on** |

Do **not** add a production tape-root prerequisite in `validate_production_profile`.

Postgres: new migration **v13** `session_day_tape` — identity + locators + capture-on columns,
**no BYTEA**. `PRIMARY KEY (symbol, et_date)`. `schema_verifier.rs` adds
`SELECT symbol, et_date FROM session_day_tape LIMIT 0`. `db/mod.rs` `pub mod pg_session_day_tape`.
Bodies remain files under the dedicated root.

Fix every `Config {` struct literal the compiler names; add
`session_day_tape_body_root: None`.

Secrets: Path-B persist calls the same `apikey` / `api_key` debug assert as `capture.rs`.

Re-run tests + `cargo check -p api-rust --features postgres`. Expect PASS.

Commit: `feat(api): session day tape dedicated root and json store`

**Reviewer probes:** no `data/session_day_tape` invent when env unset. Collision is Err, not
Disabled. Unwritable is Disabled. Ring BYTEA unused. No `SESSION_DAY_TAPE_STORE_STARTED`.

---

## B3 — Path-A sidecar (recv latch + writer JSONL)

**Files:**

- `apps/api/src/services/day_tape/path_a.rs` (**create**)
- `apps/api/src/server.rs`

**Depends on:** B2. **Independent:** yes.

### Tests first

Use `StockStreamHub::harness_local()` + `publish_event`. Inject clock. Memory or temp Json store.

```rust
const PATH_A_WRITER_CAPACITY: usize = 4096;

#[tokio::test]
async fn locked_trio_events_append_nvda_does_not() { /* AC-1, AC-6 */ }

#[tokio::test]
async fn two_successive_events_both_remain_not_latest_wins() { /* AC-2 */ }

#[tokio::test]
async fn trades_and_quotes_both_kept_not_live_price() { /* AC-3, AC-8 */ }

#[tokio::test]
async fn two_quotes_same_second_both_remain() { /* AC-4 */ }

#[tokio::test]
async fn extended_hours_0459_and_1959_kept() { /* AC-9 */ }

#[tokio::test]
async fn overnight_2000_to_0400_not_stored_not_empty_because_of_them() { /* AC-10 */ }

#[tokio::test]
async fn writer_channel_full_at_4096_yields_one_coalesced_gap_sse_still_flows() { /* AC-7 */ }

#[tokio::test]
async fn hub_lagged_and_closed_latch_one_gap() { /* AC-7 */ }

#[tokio::test]
async fn persist_fail_once_appends_gap_and_logs_skip() { /* AC-7 persist-fault, AC-38 */ }

#[tokio::test]
async fn persist_fail_always_skip_line_no_occupant_desk_ok() { /* AC-38; dual-fail */ }

#[test]
fn recv_loop_source_does_not_persist() { /* poison 9 */ }
```

SSE still-flows: a **second** `subscribe_events()` receiver must still get `publish_event`
while the tape writer channel is held full (do not `set_price` from the sidecar).

Recv-loop source scan: the recv function body contains `try_send` and `gap_pending` and does
**not** contain `append`, `write_all`, `tokio::fs`, `OpenOptions`, `JsonL`.

Writer-full fixture: do not start the writer until 4096 `try_send`s succeed and the 4097th is
`Full`; then start writer; load shows **one** `path_a_gaps[]` occupant with `dropped >= 1`, not
`no path-a ticks…`. Capacity constant is 4096; test also asserts
`include_str!("../../../infrastructure/massive/ws.rs")` still contains
`const BROADCAST_CAPACITY: usize = 4096`.

Skip line: capture `tracing` or a test hook that records the exact S2 string
`session day tape write skipped — path-a · trader path unchanged`. Do not fire skip for NVDA.

Run:

```
cargo test -p api-rust --lib services::day_tape::path_a -- --nocapture
```

Expect FAIL.

### Implement

After listener bind, **not** on the request path:

```rust
// server.rs, after worker_state.stock_worker.start();
crate::services::day_tape::path_a::spawn(worker_state.clone());
warmer::spawn(worker_state.clone());
```

`spawn`:

1. If store Disabled, return (no task).
2. `stock_hub.subscribe` of `TAPE_WATCHLIST` as `Vec<String>` — **not**
   `live_capacity.admit_and_subscribe` (must not bump `subscriber_count`).
3. `let rx = stock_hub.subscribe_events();`
4. Bounded `mpsc::channel::<StreamEvent>(4096)` + `Notify`/`watch` for `gap_pending`.
5. Recv task: filter watchlist + Path-A window; `try_send`; on `Full` increment dropped by 1
   and latch; on `RecvError::Lagged(n)` increment by n and latch; on Closed/reconnect latch;
   **continue**. Never persist.
6. Writer task: `select!` event recv **or** gap notify. If latch set, append **one** gap JSONL
   with coalesced `dropped`, clear latch, zero counter; then append the event if any. Persist
   Err → S2 skip line; `FailOnce` then appends the gap (AC-7). Quiet-day mint on first arm for
   `(symbol, today_et)` inside the append window.

Do not call `prices.set_price`. Do not emit SSE.

Re-run. Expect PASS.

Commit: `feat(api): path-a day tape sidecar on stock hub`

**Reviewer probes:** recv has no await-on-store. 4096 not retuned. `LiveCapacity` unused. NVDA
never mints a container.

---

## B4 — Path-B persist hook inside `refresh_analytics`

**Files:**

- `apps/api/src/services/day_tape/path_b.rs` (**create**)
- `apps/api/src/services/analytics.rs`

**Depends on:** B2. **Independent:** yes.

### Tests first

```rust
#[tokio::test]
async fn at_most_one_snapshot_per_5min_mark_not_25s() { /* AC-11, AC-12 */ }

#[tokio::test]
async fn persist_does_not_increment_vendor_counter() { /* AC-13 */ }

#[tokio::test]
async fn mark_1600_filled_from_1604_not_left_gap_because_afterclose() { /* AC-14 */ }

#[tokio::test]
async fn dropped_source_discriminant_never_live_massive_on_bytes() { /* AC-15 */ }

#[tokio::test]
async fn through_window_zero_snapshots_derives_one_gap_per_mark() { /* AC-16 */ }

#[tokio::test]
async fn warm_off_is_path_b_not_capturing_no_new_poller() { /* AC-17 */ }

#[tokio::test]
async fn persist_does_not_insert_if_absent_or_ring_append() { /* AC-18 */ }

#[tokio::test]
async fn persist_fail_skip_line_trader_compute_ok() { /* AC-38 */ }

#[test]
fn refresh_analytics_still_has_no_spawn_capture() { /* poison 1 */ }
```

Vendor counter: `state.massive.request_count()` (or a test Atomic on the persist function)
must not increase **because of** the tape hook. Use `vendor_fixture` / Memory store so
`compute_analytics` does not fetch; the hook must not call Massive.

`refresh_analytics` source scan (existing test in `analytics.rs` already slices that fn):
still contains `gex_cache.set`, still contains `quick_live_price`, still **lacks**
`spawn_capture`. New: may contain `day_tape::path_b`.

Run:

```
cargo test -p api-rust --lib services::day_tape::path_b --lib services::analytics -- --nocapture
```

Expect FAIL.

### Implement

`path_b::should_keep(state, sym, now) -> Keep | Skip` runs **before** moving `vendor`:

- store not storing → Skip
- symbol not in tape watchlist → Skip (no S2 skip line)
- mark not in 09:30…16:00 fill windows → Skip
- tape name not in `state.config.warm_symbols` **or** warm/refresh off → arm identity as
  `PathBNotCapturing`, Skip (no REST loop, do not union into `WARM_SYMBOLS`)
- else Keep (at most one snapshot per mark — if mark already occupied, Skip)

`refresh_analytics`:

```rust
let (snap, vendor) = compute_analytics(state, sym, None, None).await?;
crate::services::day_tape::path_b::maybe_spawn_persist(state, &vendor);
state.gex_cache.set(snap.clone()).await;
```

`maybe_spawn_persist` clones vendor **only** on Keep, then `tokio::spawn` persist. Warmer
`Ok(snap)` does not await it. Persist drops `source` before write; `debug_assert_no_secrets`.
On persist Err: S2
`session day tape write skipped — path-b · trader path unchanged`. Never
`spawn_capture` / `capture_into` / `insert_if_absent`.

Read-time derive (used by list/load in B5; implement here so B4 tests can load):

For each mark 09:30…16:00 when Axis A is `StoringReady` and Path-B is not `PathBNotCapturing`:

- fill window outside recorded Path-B capture-on → silent (Axis C Partial; no `PathBMarkGap`)
- window inside capture-on, window **closed**, no snapshot → `PathBMarkGap`
- snapshot exists → occupied
- window not yet closed → not a gap yet

Through-window + 0 snapshots ⇒ 79 gaps, **not** `no path-b snapshots…`.

Re-run. Expect PASS. Existing `vendor_fixture_none_still_calls_the_four_fetch_join` still PASS.

Commit: `feat(api): path-b day tape persist from refresh_analytics`

**Reviewer probes:** no `spawn_capture` in `refresh_analytics`. No `WARM_SYMBOLS` mutation.
Inner bytes grep `live_massive` is 0.

---

## B5 — HTTP list/load + OpenAPI 53 → 55

**Files:**

- `apps/api/src/routes/research_session_day_tape.rs` (**create**)
- `apps/api/src/routes/mod.rs`
- `apps/api/openapi/precutover-operation-baseline.json`
- `apps/api/tests/api_contract_parity.rs`
- `apps/api/tests/api_contract_router.rs`
- `apps/api/tests/api_contract_runtime_auth_research.rs`
- `tools/api-contract.mjs`
- `tools/api-contract.spec.mjs`
- generated: `apps/api/openapi/convexa.openapi.json`,
  `apps/api/openapi/parity-coverage.json`,
  `apps/api/openapi/generated-artifacts.manifest.json`,
  `apps/api/tests/fixtures/api_contract/boundary-evidence.json`,
  `libs/api/src/generated/schema.ts`

**Depends on:** B1, B2, B3, B4. **Independent:** no (`libs/api` generated + `tools/` + `routes/mod.rs`).

### Tests first

Colocated handler tests + `apps/api/tests/session_day_tape_capture.rs`:

- NVDA list 200 `RESEARCH READ — SESSION DAY TAPE NOT IN WATCHLIST`,
  `detail: not in tape watchlist: NVDA`, `vendor_called: false`, `authorizes: "nothing"`,
  empty `days`, **does not** require a tape root (AC-6, AC-19)
- Locked list with storing root, zero days: framing `RESEARCH READ — SESSION DAY TAPE`,
  `detail: null`, `count: 0` (honest empty; stored days only — no pre-store rows)
- Locked list, root unset: 500 `session_day_tape_not_storing` (AC-28)
- `limit=0` → 400 `invalid_limit`
- Load missing `et_date` / `not-a-date` → 422 `et_date_unparseable` (AC-20)
- Token required + missing → 401 `metrics_unauthorized`, **no** tape body (AC-50)
- Weekend SPY 200 ineligible (AC-31)
- Future weekday SPY storing 200 not-elapsed (AC-66)
- No container weekday storing 200 `NO SESSION DAY TAPE` / `no session day tape…` (AC-37
  `NoIdentity`) — **including a named past weekday** (AC-32 residual, not a pre-store class)
- List `days[].clock` never equals `not expected before storing`
- Empty-while-storing planted container 200 `no path-a ticks…` (AC-27)
- Unreadable 500 `session_day_tape_unreadable` (AC-29)
- Occupied Path-A+Path-B: separate counts, `detail: null`, hit provenance, no `live_massive`
  (AC-8, AC-15, AC-22, AC-23, AC-25)
- Through-window Path-B 0 snaps: `path_b_gap_count` = 79, not empty literal (AC-16)
- Session-books list/load envelopes **byte-same** framing / miss detail / `vendor_called`
  (AC-56)

`TAPE_READ_VENDOR_CALLS` AtomicU64 stays 0 (never incremented). Do **not** require a
`NotExpectedPreStore` 200 probe.

Run handler tests — expect FAIL. OpenAPI pins still 53 until `add!` lands.

### Implement

Mirror `research_session_books.rs` token_gate / `strip_config_prefix`. Register **both** tape
routes immediately **before** the session-books pair so Axum cannot bind
`session-day-tape` as `{symbol}`:

```rust
    add!(
        research_session_day_tape::list_session_day_tape_contract,
        research_session_day_tape::__path_list_session_day_tape_contract
    );
    add!(
        research_session_day_tape::load_session_day_tape_contract,
        research_session_day_tape::__path_load_session_day_tape_contract
    );
```

Paths: `GET /api/_research/session-day-tape/{symbol}` and
`GET /api/_research/session-day-tape/{symbol}/day`.

`tools/api-contract.mjs` — **order matters** (tape before session-archive before session):

```javascript
  if (path.startsWith('/api/_research/session-day-tape'))
    return 'apps/api/src/routes/research_session_day_tape.rs';
  if (path.startsWith('/api/_research/session-archive'))
    return 'apps/api/src/routes/research_session_coverage.rs';
  if (path.startsWith('/api/_research/session'))
    return 'apps/api/src/routes/research_session_books.rs';
```

Same split for `routeResponseType` / `sourceRegistryTarget`.

`apply_route_security` operator() list: add both tape paths. `RESPONSE_CONVERSION_SOURCES`
(operator-token, application/json):

- list 200 / 400 / 401 / 500
- load 200 / 401 / 422 / 500

Representative 200 list: NVDA not-in-watchlist shape (all required fields). Representative 200
load: NVDA + `et_date` 2020-01-02, empty arrays, required tick/gap element paths are vacuous.

`api_contract_parity.rs`: `operation_count` **55**. For `/day` operator evidence, append
`?et_date=2020-01-02` (same pattern as session-books `/book`). After generate, re-pin
`observed == …` in the direct-HTTP catalog test to the **generated** exercised-outcome count
(do not guess; first fail prints it).

`api_contract_router.rs`: `add!(` count − 1 == **55**; disposable baseline **55** / mutated
**56**. Do **not** change probe_id `openapi-router-integration-all-52` or its
`registration_count: 52`.

`precutover-operation-baseline.json`: insert the two GET paths; `capture.operation_count` 55.

`tools/api-contract.mjs`: `validateRegistrationPairs(source, expectedCount = 55)`.
`tools/api-contract.spec.mjs`: pairing length 55; inventory `exactly 55`.

Generate from repo root:

```
npm run api:contract:generate
```

Expect exit 0. Then `npm run api:contract:check` →
`API contract check passed: generated artifacts match the Rust API contract.`

`libs/api/src/lib/convexa.ts` / `client.ts` must **not** grow a tape list/load helper.
Generated `schema.ts` **will** contain the new paths — that is accepted OpenAPI churn; trader
UI must not consume the operations (F1).

Canary: plant `METRICS_SECRET_TOKEN=canary-secret-value-do-not-print`; list/load bodies and
tape files must not contain it (AC-26).

Re-run contract tests + tape HTTP tests. Expect PASS.

Commit: `feat(api): research session-day-tape list/load`

**Reviewer probes:** NVDA 200 without a tape root. `"auth": true` absent. Session-book framing
untouched. `_metrics` handler unchanged. No path-filter query. No pre-store 200.

---

## B6 — Optional clap `session-day-tape`

**Files:**

- `apps/api/src/main.rs`
- `apps/api/src/services/day_tape/cli.rs` (**create**)

**Depends on:** B2. **Independent:** yes.

### Tests first

In `main.rs` `#[cfg(test)]` (mirror `archive_coverage_wiring`):

```rust
#[test]
fn session_day_tape_parses_and_is_listed() { /* clap name session-day-tape */ }

#[test]
fn cmd_session_day_tape_does_not_open_live_or_massive() { /* AC-20 CLI twin */ }
```

CLI render tests in `cli.rs`: weekend / not-elapsed / no-identity / not-in-watchlist exit 0
with `Not a coverage miss.`; not-storing and unreadable non-zero `[ERROR]`; Evidence: `local`;
closing `local audit is not production coverage`; stdout title `session-day-tape`; standing
block from SPEC §4. Named past weekday with no container uses the no-identity `[OK]` line
(`Not a coverage miss.`), **not** a pre-store literal.

Run `cargo test -p api-rust --bin api-rust session_day_tape_wiring -- --nocapture` — expect FAIL.

### Implement

```rust
    /// Research list/load of the session day tape (read-only; not a coverage pass).
    SessionDayTape {
        #[arg(long)]
        symbol: Option<String>,
        #[arg(long = "et-date")]
        et_date: Option<String>,
    },
```

Dispatch **before** `run()`, beside `ArchiveCoverage`. Opener copies
`cmd_archive_coverage` / `cmd_score_lab` empty `massive_api_key` stub; must not construct
`MassiveRestClient` / `MarketDataPort::live`. Same closed literals as HTTP. HTTP Evidence
`this process` is **not** used on CLI.

CLI is not a substitute for HTTP (conformance runner does not execute it).

Re-run. Expect PASS.

Commit: `feat(api): session-day-tape research CLI`

**Reviewer probes:** ExitCode before `run()`. No Massive in `cmd_session_day_tape` body.

---

## B7 — Isolation, poison, score identity, session-book non-regression

**Files:**

- `apps/api/tests/session_day_tape_isolation.rs` (**create**)
- `apps/api/tests/session_day_tape_capture.rs` (extend)
- `apps/api/tests/api_contract_runtime_auth_research.rs` (oneshots)

**Depends on:** B3, B4, B5, B6. **Independent:** no.

### Tests first / implement together (the tests **are** the deliverable)

One hermetic pass (SPEC §3 method notes) in `session_day_tape_capture.rs` with injected Monday
clock:

1. Plant two Path-A trades and two same-second quotes for each of SPY/QQQ/IWM → both quotes
   loadable (AC-1–4, AC-8)
2. NVDA `not in tape watchlist` (AC-6)
3. Plant already-paid structure at 5-minute marks including `[16:00, 16:05)` → locked grid
   (AC-11–14)
4. Vendor-call counter stays at already-paid fetches only (AC-13)
5. Load with vendor stub down → still loads (AC-21)
6. Write failure → desk/live stream still succeed, skip line, tape lacks that mark (AC-38, AC-41)
7. Writer-channel Full (burst past 4096) → one coalesced Path-A gap; live SSE still flows
   (AC-7, AC-42)
8. Through-window Path-B with no snapshots → per-mark `path-b gap…`, not
   `no path-b snapshots…` (AC-16)
9. Empty / not-storing / unreadable / weekend / not-elapsed / no-identity (including named
   past weekday with no container) / partial / through-window / unauthorized / Path-A gap /
   Path-B gap / Path-B not-capturing each distinct (AC-37). A distinct pre-store class is
   **not** required.
10. Coverage missing stays missing (AC-53–55): capturing/loading tape does not
    `insert_if_absent` and does not flip `classify_loaded`
11. Score/tier/fingerprint byte-identical capture on vs off and succeed vs fail (AC-43) —
    `generate_signals` over the same vendor fixture

`session_day_tape_isolation.rs` source scans (mutation-tested; anti-vacuity: a needle that
cannot fire fails the test):

- `refresh_analytics` has no `spawn_capture`
- `day_tape` has no `insert_if_absent` / `archive_session_best_effort` / `spawn_capture` /
  `ENSURE_SYMBOLS` / `classify_loaded` / `LiveMassive` occupancy arm
- `quant-engine` / `generate_signals` / `compute_opportunity_tier` do not import `day_tape`
- Path-A recv loop does not persist
- Poison 10: `day_tape` sources contain none of `store_started`, `storing_since`, `watermark`,
  `SESSION_DAY_TAPE_STORE_STARTED`, `SESSION_DAY_TAPE_STARTED`; store derive never returns
  `NotExpectedPreStore`
- `functions/api/[[path]].ts` still 404s `/api/_research` and `/api/_metrics` prefixes
  (AC-46, AC-49) — read-only
- OperatorMetrics `STAGES` file still the six names (AC-47)
- Dashboard product sources (exclude `*.spec.*`) have no `session-day-tape` /
  `session day tape` / `Path-A` / `Path-B snapshots` / `saved Tuesday` (AC-44, AC-45, AC-48,
  AC-51, AC-52) — **do not** ban `LiveTape`
- `libs/api/src/lib/convexa.ts` has no `/api/_research/session-day-tape` helper
- Session-book / coverage / ring framing strings still present on **those** vehicles (AC-56)
- `health.rs` has no `session-day-tape` nest

Runtime: bundle / scan / SSE / ensure still `Ok` when tape is `Failing` or `Disabled`
(AC-38, AC-39, AC-41, AC-42).

Oneshots in `api_contract_runtime_auth_research.rs`: tape 200 NVDA, 422 bad date, 401 when
token set.

Run:

```
cargo test -p api-rust --test session_day_tape_capture --test session_day_tape_isolation --locked -- --nocapture
cargo test -p api-rust --test api_contract_runtime_auth_research operator_research -- --nocapture
```

Expect FAIL then PASS.

Commit: `test(api): session day tape isolation and hermetic gate`

**Reviewer probes:** Do not green a pre-store class or watermark plant. Named past weekday with
no container is NoIdentity. LiveTape still allowed. Pages bytes unchanged. Score pin file
diff empty.

---

## B8 — Closer: serve + conformance receipt

**Files:** `.spire/clusters/tech/contracts/session-day-tape-capture/conformance-receipt.json`

**Depends on:** B1, B2, B3, B4, B5, B6, B7. **Independent:** no.

B8 does **not** re-implement worker paths. It proves the graph serves and writes the lane receipt.

### Steps

1. `cargo fmt -p api-rust` then `cargo fmt -p api-rust -- --check` (exit 0).
2. `cargo check -p api-rust --features postgres` (exit 0).
3. `cargo test -p api-rust -p quant-engine --locked` (exit 0). Check `$LASTEXITCODE`.
4. `npm run api:contract:check` →
   `API contract check passed: generated artifacts match the Rust API contract.`
5. Free ports and serve (**not** `npx nx serve api`):

```
npm run ports:free
cargo run -p api-rust --features postgres -- serve
```

   Listener `:8000`. Default live 200 **does not** need a tape root (NVDA NotInWatchlist).
   Unset root is honest not-storing for locked symbols — that is **not** the NVDA probe.

6. Receipt — do **not** hand-edit JSON:

```
node .grok/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/session-day-tape-capture/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/session-day-tape-capture/conformance-receipt.json
```

   Expect tool-written `verdict: PASS` (shape/types). Exact `vendor_called === false` and
   closed literals are unit/GATE Q. `et_date=not-a-date` must be 422. NVDA list/load must
   **not** 404 / not be captured as session-books `{symbol}`. Session-books re-pins must pass.

   If serve cannot boot, `--sample` so the receipt records `UNVERIFIABLE` — honest, not a fake
   PASS.

7. NUL scan the receipt → `0`.
8. `git diff --name-only -- apps/dashboard libs/quant-engine` must be empty except F1’s
   `*.structural.spec.ts`. Generated `libs/api/src/generated/schema.ts` may change.

Commit: `test(api): session-day-tape-capture conformance receipt`

**Reviewer probes:** closer diff is the receipt (+ fmt if any). No re-touch of `day_tape`
logic. Receipt `endpoints` includes the five interface entries.

---

# Frontend track

SPEC §4 is `NO_UI_CHANGE` and **names no dashboard files**. This track is **structural-absence
tests only**. Do not invent a trader route, Settings copy, Ask-AI line, Ticker/LiveTape chip,
`/_ops/metrics` tape matrix, or `@convexa/api` list/load helper. Do not amend
`DESIGN_SYSTEM.md`.

## F1 — Structural absence (Pages 404, trader chrome, OperatorMetrics, client)

**Files:** `apps/dashboard/src/app/session-day-tape-capture.structural.spec.ts` (**create**)

**Depends on:** — **Independent:** no (SPEC §4 names no files; this is the frontend closer).

F1 is the **only** frontend closer. It does not implement worker UI paths because there are
none.

### Tests first

Copy the mutation-tested shape of `apps/dashboard/src/app/session-chain-archive.structural.spec.ts`
and `chain-snapshot-capture.structural.spec.ts`. Needles must **not** include `LiveTape` or
bare `tape`.

```ts
const TRADER_FORBIDDEN = [
  '/api/_research/session-day-tape',
  'session-day-tape',
  'session day tape',
  'session_day_tape',
  'Path-A ticks',
  'Path-B snapshots',
  'saved Tuesday',
  'RESEARCH READ — SESSION DAY TAPE',
] as const;

const CLIENT_FORBIDDEN = ['/api/_research/session-day-tape', 'session-day-tape'] as const;
```

Cases:

- Anti-vacuity: Pages catch-all exists and 404s `_metrics` (AC-46)
- Same 404 branch covers `/api/_research` and `/api/_research/session-day-tape/SPY/day` (AC-46, AC-49)
- Trader dashboard product sources (`import.meta.glob` excluding specs) hit **zero**
  `TRADER_FORBIDDEN` (AC-44, AC-45, AC-51, AC-52)
- `libs/api/src/lib/convexa.ts` hits zero `CLIENT_FORBIDDEN` (AC-48) — generated `schema.ts`
  is **excluded** (OpenAPI churn)
- `useLatencyTrend.ts` `STAGES` set-equality remains
  `vendor_fetch`, `engine_build`, `off_exchange`, `signals`, `persist`, `serialize_wrap`
  (AC-47)
- Mutation: if the scan cannot prove it bites (empty dashboard glob), fail

Run:

```
npx nx test @convexa/dashboard --testFile=session-day-tape-capture.structural.spec.ts
npx nx typecheck @convexa/dashboard
```

Expect FAIL (file missing) then PASS. `$LASTEXITCODE` 0. Do **not** run bare
`nx format:write`. Scope Prettier to the new spec if needed:
`npx nx format:write --files apps/dashboard/src/app/session-day-tape-capture.structural.spec.ts`.

Commit: `test(dashboard): session-day-tape-capture structural absence`

**Reviewer probes:** no product `.tsx` diff. LiveTape copy untouched. Pages function bytes
unchanged.

---

## Independence

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B1 | backend | `apps/api/src/services/day_tape/mod.rs`; `apps/api/src/services/day_tape/watchlist.rs`; `apps/api/src/services/day_tape/clocks.rs`; `apps/api/src/services/day_tape/literals.rs`; `apps/api/src/services/day_tape/occupancy.rs`; `apps/api/src/services/day_tape/store.rs`; `apps/api/src/services/mod.rs` | — | no |
| B2 | backend | `apps/api/src/config.rs`; `apps/api/src/state.rs`; `apps/api/src/services/day_tape/fs.rs`; `apps/api/src/db/migrations.rs`; `apps/api/src/db/pg_session_day_tape.rs`; `apps/api/src/db/mod.rs`; `apps/api/src/db/schema_verifier.rs` | B1 | no |
| B3 | backend | `apps/api/src/services/day_tape/path_a.rs`; `apps/api/src/server.rs` | B2 | yes |
| B4 | backend | `apps/api/src/services/day_tape/path_b.rs`; `apps/api/src/services/analytics.rs` | B2 | yes |
| B5 | backend | `apps/api/src/routes/research_session_day_tape.rs`; `apps/api/src/routes/mod.rs`; `apps/api/openapi/precutover-operation-baseline.json`; `apps/api/tests/api_contract_parity.rs`; `apps/api/tests/api_contract_router.rs`; `apps/api/tests/api_contract_runtime_auth_research.rs`; `tools/api-contract.mjs`; `tools/api-contract.spec.mjs`; `apps/api/openapi/convexa.openapi.json`; `apps/api/openapi/parity-coverage.json`; `apps/api/openapi/generated-artifacts.manifest.json`; `apps/api/tests/fixtures/api_contract/boundary-evidence.json`; `libs/api/src/generated/schema.ts` | B1, B2, B3, B4 | no |
| B6 | backend | `apps/api/src/main.rs`; `apps/api/src/services/day_tape/cli.rs` | B2 | yes |
| B7 | backend | `apps/api/tests/session_day_tape_isolation.rs`; `apps/api/tests/session_day_tape_capture.rs` | B3, B4, B5, B6 | no |
| B8 | backend | `.spire/clusters/tech/contracts/session-day-tape-capture/conformance-receipt.json` | B1, B2, B3, B4, B5, B6, B7 | no |
| F1 | frontend | `apps/dashboard/src/app/session-day-tape-capture.structural.spec.ts` | — | no |

B8 is the **only** backend closer. F1 is the **only** frontend closer. Closers do not
re-implement worker paths.

Independent-yes path check (backend): B3 `path_a.rs` + `server.rs`, B4 `path_b.rs` +
`analytics.rs`, B6 `main.rs` + `cli.rs` share no equal/prefix write path. Frontend has no
`Independent: yes` row (SPEC §4 names no files).

---

# Verification track

Run after B8 + F1. Check `$LASTEXITCODE` after **every** command.

### V1 — Unit / integration suite

```
cargo test -p api-rust -p quant-engine --locked
```

**Expect:** exit 0. New filters green: `services::day_tape`, `session_day_tape_wiring`,
`--test session_day_tape_capture`, `--test session_day_tape_isolation`. Existing
`session_chain_archive`, `archive_coverage`, `api_contract_*`, score-identity tests still pass.

### V2 — Postgres compile

```
cargo check -p api-rust --features postgres
```

**Expect:** exit 0 (v13 `session_day_tape` + `pg_session_day_tape` compile).

### V3 — Named CLI (local evidence)

```
cargo run -p api-rust --locked -- session-day-tape --help
```

**Expect:** exit 0. Help lists `session-day-tape`. Optional `--symbol` / `--et-date`.

```
cargo run -p api-rust --locked -- session-day-tape --symbol NVDA --et-date 2020-01-02
```

**Expect:** exit 0. Stdout contains `not in tape watchlist: NVDA` and `Not a coverage miss.`
Evidence: `local`. Must succeed without `MASSIVE_API_KEY`.

### V4 — OpenAPI / generated client

```
npm run api:contract:check
```

**Expect:** `API contract check passed: generated artifacts match the Rust API contract.`
Operation count 55. `libs/api/src/lib/convexa.ts` still has no tape helper.

### V5 — Frontend structural absence + typecheck

```
npx nx test @convexa/dashboard --testFile=session-day-tape-capture.structural.spec.ts
npx nx typecheck @convexa/dashboard
```

**Expect:** both exit 0. No product dashboard diff besides the spec file.

### V6 — Isolation poison (rejecting paths)

Re-run `--test session_day_tape_isolation`. **Expect:** exit 0. Confirm the suite includes a
**rejecting** path (write-fail isolation, 401, tape does not mint a live paid present book,
weekend is not empty-complete, two quotes in one second both remain, writer-channel full
yields a Path-A gap, through-window all-missed Path-B is mark-gaps, future ET date is
not-elapsed, poison 10 watermark / `SESSION_DAY_TAPE_STORE_STARTED`) **and** an accepting
planted through-window fixture. GATE Q must **not** claim a required pre-store 200.

### V7 — GATE Q live conformance

```
npm run ports:free
cargo run -p api-rust --features postgres -- serve
```

Then:

```
node .grok/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/session-day-tape-capture/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/session-day-tape-capture/conformance-receipt.json
```

**Expect:** tool `verdict: PASS` on the five interface entries. NVDA list 200 (not-in-watchlist).
NVDA load 200. SPY `et_date=not-a-date` 422. Session-books list 200 + miss load 404. Receipt
NUL count 0.

### V8 — Review ACs (not a DOM harness)

Walk AC-57–65 as **review** (no named dashboard route; no S3 ingest; no lab UI / body-move /
watchlist expansion; standing-block / glossary / banned-term copy; license; CLI evidence class).
AC-32 residual is **settled** (NoIdentity; not ship-blocking). Do not certify a pre-store 200
from V7.

---

## Reviewer probe (plan-authored defects)

- OpenAPI live pin is **53 not 52** (archive-coverage already shipped). Tape adds **two** GETs
  → 55. Direct-HTTP `observed == 53` in `api_contract_parity.rs` is a **catalog outcome** pin
  — re-pin after generate; do not assume it stays 53 or becomes 55.
- `tools/api-contract.mjs` must map `session-day-tape` **before** `session-archive` **before**
  `session` or tape operations will be attributed to `research_session_books.rs`.
- Do not cite Python. Do not treat `npx nx serve api` as the serve command.
- Do not ban `LiveTape` in F1 needles.
- Do not invent `SESSION_DAY_TAPE_STORE_STARTED`. Named past weekday with no container is
  `NoIdentity`. GATE Q must not claim the old ship-blocking AC-32.
