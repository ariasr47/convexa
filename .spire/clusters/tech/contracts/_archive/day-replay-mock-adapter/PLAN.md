# day-replay-mock-adapter — implementation plan

> **For agentic workers:** implement task-by-task, in order inside a lane. Steps use checkbox
> (`- [ ]`) syntax. Each task carries its own TDD cycle: write the failing test → run it, watch it
> fail → implement minimally → run it, watch it pass → commit. If this plan contradicts the tree,
> **report the conflict — do not resolve it silently** (`PLAN_METHOD.md`, "Plans are code").
> Do not edit `SPEC.md` or `INTERFACE_CONTRACT.md`.

**Goal:** Play one named locked-watchlist session day `(SPY|QQQ|IWM, America/New_York YYYY-MM-DD)`
through the **existing ticker live path** so a cancelled Massive feed does not leave Tuesday as a
frozen snapshot — consume-visible occupancy on the same SSE, never a second live UI path.

**Architecture:** Exclusive clap construct `session-day-replay` (not `serve`, not a third
`MarketDataPort` kind, not `Fixture` at `as_of`, not batch-backtest). One-way player leaf under
`apps/api/src/services/day_tape/` publishes stored Path-A `StreamEvent`s onto the existing
`StockStreamHub` (`harness_local` + `publish_event`) and Path-B marks into process `ReplayHold`.
Ticker SSE `routes/stream.rs` is the consume path: occupancy JSON **data** on `LiveUpdate`,
`live` forced false, `feed` = `session_tape`, vouched **before** HTTP bind. Dashboard branches on
`session_tape` **before** `liveStatus` / live-offline. Production unset `serve` is byte-identical.

**Tech stack:** Rust 2021 · Axum/Tokio (`apps/api`, crate `api-rust`) · clap 4 · `chrono` +
`chrono_tz::America::New_York`. Frontend: React 19 + Vite + MUI (`apps/dashboard`), Vitest jsdom.
Shared client: generated `LiveUpdateBody` via `npm run api:contract:generate` (no new HTTP
operation). Tests: `cargo test -p api-rust -p quant-engine --locked` ·
`npx nx test @convexa/dashboard` · `npx nx typecheck @convexa/dashboard`.

**Spec:** `.spire/clusters/tech/contracts/day-replay-mock-adapter/SPEC.md` (APPROVED 2026-08-30)
**Interface:** `.spire/clusters/tech/contracts/day-replay-mock-adapter/INTERFACE_CONTRACT.md`

---

## S2 pass-2 Important residuals (do not invent product)

S2 left three **Important** (not Critical) holes. This plan does **not** paper them with new
chrome. Apply only mechanisms the SPEC already names:

1. **Empty-column chip vs starting.** §4 copy table + loading column win: `playing` +
   `tape_time_et` JSON `null` → chip text `session tape · starting…` (never S0 `liveStatus`).
   Empty Path-A with a **vouched** stamp (a Path-B mark can vouch `tape_time_et`) uses the
   playing identity chip. Do **not** invent a third string such as
   `session tape · {SYM} · {humanSessionDate}` without tape time.
2. **`tape_time_et` across PathAGap.** §2.3 enumerates null only as “first keep-alive; both-empty
   before ended.” Hold the last vouched stamp across a gap pulse. Do **not** clear the cursor
   on a ts-less visit (that would re-enter starting mid-walk).
3. **LiveTape skeleton-first.** Honesty begins at the first `session_tape` payload (widget
   table: title `Session tape` from that payload, including starting). Do **not** add a new
   SSE-wait placeholder the SPEC never names. Existing REST cold-load skeleton
   (`TickerDashboard` `data-testid="cold-load"`) stays. A residual `Live tape` title after REST
   lands and before the first SSE `data:` is the accepted S2 leftover — not a new product.

AC-32 embeds `○` in the ended string; §4 keeps `dot` separate. Implement **§4** (TintChip `dot`
is `○`; chip `text` has no leading bullet).

---

**Cited live Rust / TS (read at source — do not cite Python, Fixture-as-clock, or briefing HTML):**

- `MarketDataPort::{Live, Fixture}` and `MarketDataSourceKind::{LiveMassive, Fixture}` in
  `apps/api/src/services/market_data/mod.rs`. `resolve` returns one `VendorBundle`. Fixture is
  nearest frozen sample `as_of ≤ t` — **not** this clock. Port stays two arms. Source kind
  gains a **third discriminant** `SessionTape` (serde `session_tape`) on the bundle only.
- `StreamEvent` in `apps/api/src/domain/price.rs` — `kind`, `ts_ns`, quote/trade fields. **No**
  provenance member.
- `StockStreamHub::harness_local` + `publish_event` + `subscribe_events` in
  `apps/api/src/infrastructure/massive/ws.rs`. `RecvError::Lagged` today is silent `continue`
  in `routes/stream.rs` (lines 415 and 554) — while armed that is **drop**, not continue.
- Ticker SSE `apps/api/src/routes/stream.rs` `stream_ticker_http`: `json!` payload; `live` from
  wall `tick_age < 30s` (`LIVE_TICK_MAX_AGE_S`); `market_session()` from `Utc::now()`; `feed`
  from `config.data_feed`; `KeepAlive` 15s **comments**; `!dirty` → comment `heartbeat`.
  Client EventSource ignores comments (`STREAM_OFFLINE_MS = 15_000` in
  `apps/dashboard/src/app/pages/ticker/useTickerStream.ts`).
- Tape store: `apps/api/src/services/day_tape/` — `SessionDayTape::load`, `DayContainer`,
  `PathAKind::{Trade, Quote, PathAGap}` (`PathAGap` has `ts_ns: None`), `derive_axis_a` /
  `derive_path_a` / `derive_path_b` in `occupancy.rs` (capture axes — **not** consume occupancy).
  Watchlist `TAPE_WATCHLIST` = `["SPY","QQQ","IWM"]` — not `ENSURE_SYMBOLS`.
- Path-B persist already strips `source` (`fs.rs` `prepare_path_b_body`). Replay decode is
  **tape-owned**; must not default source to `LiveMassive` or `Fixture`.
  `compute_analytics_from_vendor(..., iv_store = None)` in `analytics.rs`.
- `AppState::new` / `new_production` / `for_capacity_harness` in `state.rs`. Capacity sets
  `vendor_fixture = Some` and never `stock_worker.start()`. Replay: `vendor_fixture` stays
  `None`; **new** constructor, not those three.
- `server.rs` `serve`: after bind starts `stock_worker`, `day_tape::path_a::spawn`,
  `warmer::spawn`, `ensure_worker::spawn`, optional scanner. `Commands::Serve` grows **no**
  replay flag. Replay construct must not take this worker-start path.
- Clap `Commands` in `apps/api/src/main.rs` — `Capacity` / `ArchiveCoverage` / `SessionDayTape`
  return `ExitCode` **before** `run()`. Same shape for `session-day-replay`.
- Coverage `classify_loaded` in `session_chain_archive/coverage.rs` is exhaustive on
  `MarketDataSourceKind` — third discriminant must map to **RejectedSource**, never `present`.
- Dashboard: `liveTapeStore.ts` `isLive = (live?.live ?? false) && !streamOffline`;
  `TickerHeader.tsx` `liveStatus` / `connectionChip` (`streamOffline` →
  `⚠ Live offline — reconnecting…`); `LiveTape.tsx` title `Live tape` +
  `LIVE_TAPE_SUBTITLE_*`; `orders/engine.ts` `tickFromLive` uses `live?.live`;
  `TickerDashboard.tsx` passes `isLive` into deck, portfolio, `useOrderEngine`.
- Pages `functions/api/[[path]].ts` already 404s `/api/_research` and `/api/_metrics`.
- OpenAPI live pin: **55** operations. This ship adds **no** HTTP path. `LiveUpdateBody`
  grows an **optional** `session_tape` object (omitted when unset).

---

## Track map

| Track | Tasks | Notes |
|---|---|---|
| **Backend** (`apps/api`) | **B1 → B8** (B8 is the lane closer) | Exclusive construct + SSE occupancy + ReplayHold |
| **Frontend** (`apps/dashboard`) | **F1 → F4** (F4 is the lane closer) | Existing ticker consume only. SPEC §4 names components, **not files** → all `Independent: no` |
| **Verification** | **V1 → V8**, after B8 + F4 | Exact commands + expected output. GATE Q is V7+V8 |

**Sequencing.** B1 (types + source discriminant) is foundation. After B1, **B2** (player loop)
and **B3** (construct + AppState + clap + bind) are independent (`Independent: yes`, disjoint
write paths). After B3, **B4** (stream occupancy pump) and **B5** (`load_analytics` / ReplayHold
/ Massive ban) are independent. B6 OpenAPI waits on B4 (`libs/api` is outside both lane dirs →
`Independent: no`). B7 isolation waits on B2–B6. B8 closer waits on every backend task and
writes only the lane receipt.

Frontend is independently executable in parallel with backend (no shared write paths). F1→F4
are sequential inside the lane.

Do **not** treat `MarketDataPort::Fixture`, `batch-backtest`, or `replay-outcome-join` as this
clock.

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
  product diff), `DESIGN_SYSTEM.md`, or other feature folders.
- **Serve / conformance:** do **not** use `npx nx serve api` (`.worktrees/*` can duplicate Nx
  names). Verification serve is
  `cargo run -p api-rust --features postgres -- serve`.
- **Cite live Rust** listed above. Python under `archive/api-python/` is not the store.
  Existing `day_tape/occupancy.rs` is **capture** Axis A/B/C — consume occupancy is a new slot.

### Feature hard rules (settled — do not re-open)

- Exclusive construct titled **`session-day-replay`**. Required `--symbol` and `--et-date`;
  optional `--pace` in `{1,4,10}` (omitted ⇒ 1). Unnamed / out-of-set pace **refuses before
  bind** — not silent 1×. 60× is out.
- `Commands::Serve` does **not** grow a replay flag or env arm. Leftover env on `serve` must
  not start the player. `AppState::new` / `new_production` / `for_capacity_harness` still start
  (or, for harness, do not start) as today and **do not** start the player.
- `APP_ENV=prod` **plus** this construct **refuses before bind**. Unset production still talks
  to Massive. Silent Massive-down → tape is forbidden.
- Vouch-before-advertise: on a playable identity, write first `playing` keep-alive
  (`session_tape` present, `live: false`, `tape_time_et` null until a stamp exists,
  `feed` = `session_tape`) **before** `TcpListener::bind`. A bound armed process **never**
  emits occupancy-less ticker `data:`.
- Miss / unreadable / not-storing / weekend / not-elapsed / not-in-watchlist / illegal pace /
  production-profile+arm → **refuse before bind** (no walker HTTP/SSE; hub silent). Empty ≠
  missing. Empty Path-A + occupied Path-B **starts**. Both-empty **starts then ended**.
- Occupancy key `session_tape` **omitted** when unset (do not emit `session_tape: null`).
  While armed: every per-ticker SSE JSON `data:` carries it; `live` JSON `false`; `feed` =
  `session_tape`; `market_session` = tape-stamp bucket when cursor vouched, else closed token
  `session_tape` (not wall `Utc::now()`).
- Keep-alive is JSON **data** on a wall period **< 15s** (implementation ≤5s), independent of
  `k`. Not SSE comments, not Axum KeepAlive, not synthetic Trade/Quote `apply_event`.
  Ended/fault **repeat** as data. `!dirty` while armed must **not** substitute a comment.
- Clock: start at earliest stored occupant (do not invent 04:00); end after last; no loop,
  reverse, skip, or pause. Delay `(t_next − t_prev) / k`. Emit **stored** `ts_ns` on
  `StreamEvent`. Hold last vouched `tape_time_et` across PathAGap.
- Path-B: at stored 5-minute marks, tape-owned decode → `VendorBundle` with
  `MarketDataSourceKind::SessionTape` → `compute_analytics_from_vendor` (`iv_store = None`) →
  `ReplayHold.replace`. Not `FixtureCatalog.resolve`. Not `refresh_analytics`. Skip one
  unreadable mark; do not stop Path-A; do not Massive-fill.
- While armed, `compute_analytics` Massive four-fetch is unreachable for **any** ticker REST
  name (armed or not). `ReplayHold` before `gex_cache`. `vendor_fixture.is_none()`.
- Isolation: replay fault does not 5xx the desk; last `ReplayHold` stays; end ≠ drop ≠ fault ≠
  live-offline. Client payload-gap (`STREAM_OFFLINE_MS`, no `data:`) while last vouched phase
  was `playing` or `gap` is **drop copy**, even if the last envelope still says `playing`.
  Do not require wire `phase: drop` before drop copy.
- Net-flow stays the existing wall 300s window inside `apply_event`. No tape-time flow
  accumulator. 4×/10× copy must not claim tape minutes.
- `GET /api/stream/prices` is **not** amended. No `/_ops/replay`, no playback REST, no HTTP
  Start/Stop that arms the player. Operator tape **read** stays
  `GET /api/_research/session-day-tape/*`. Pages still 404 `_research` / `_metrics`.
- `authorizes` is exactly `nothing` on the score formula. Score / tier / fingerprint byte-
  identical on the same Path-B body.
- Do **not** mark `"auth": true` on conformance entries.
- Do **not** run `npm run api:contract:baseline:accept`. Operation count stays **55**.
  Direct-generate after `LiveUpdateBody` grows the optional object.
- Poison §2.8 is non-vacuous (B7). Player / construct sources contain none of
  `insert_if_absent`, `archive_session_best_effort`, `spawn_capture`, `path_a::spawn`,
  `warmer::spawn`.

### Locked operator literals (copy; do not paraphrase)

Human-facing strings are SPEC §4. CLI title is grep-able `session-day-replay`. Capture miss
literals are **reused**, never synonymized (`not in tape watchlist: {SYMBOL}`,
`session day tape not storing`, `session day tape unreadable: {reason}`,
`session day tape ineligible weekend: {SYMBOL} on {ET_DATE}`,
`session day tape not elapsed: {SYMBOL} on {ET_DATE}`,
`no session day tape for {SYMBOL} on {ET_DATE}`,
`no path-a ticks for {SYMBOL} on {ET_DATE}` as empty standing,
`no path-b snapshots for {SYMBOL} on {ET_DATE}` as warn + walk allowed).

Banned on S1 (test, not review): `● live ·`, `Streaming live ${feed} ticks.`, `Live tape`,
`Gamma flip (live)`, `⚠ Live offline — reconnecting…`, `OFFLINE_CHIP_TOOLTIP`,
`○ overnight — no live data`, `○ market closed`, `○ no live ticks`, `LIVE_TAPE_SUBTITLE_*`,
`⏸ offline` / `⏸ Last trade`, `liveDotPulse` / `widgetLivePulse` while session tape,
`evaluateOrder` fills, `live_massive` / `LIVE` as a feed badge, completeness % /
`partial captured day`.

### Interface contract (verbatim)

The block below is copied **verbatim** from `INTERFACE_CONTRACT.md` `## Conformance spec` so both
lanes inherit the same binding shape (GATE PLAN law).

## Conformance spec

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

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/services/day_tape/replay_occupancy.rs` | **Create** — consume occupancy slot + phase/pace |
| `apps/api/src/services/day_tape/replay_timeline.rs` | **Create** — merge Path-A + Path-B marks; Path-B decode |
| `apps/api/src/services/day_tape/player.rs` | **Create** — sleeper + hub publish + ReplayHold.replace |
| `apps/api/src/services/day_tape/construct.rs` | **Create** — refuse-before-bind, vouch, standing, bind |
| `apps/api/src/services/day_tape/mod.rs` | export new modules; extend poison `include_str` list |
| `apps/api/src/services/day_tape/clocks.rs` | `et_hms_to_ts_ns` + `ts_ns_to_tape_time_et` |
| `apps/api/src/services/market_data/mod.rs` | `MarketDataSourceKind::SessionTape`; port stays two arms |
| `apps/api/src/services/session_chain_archive/coverage.rs` | exhaustive match: SessionTape → RejectedSource |
| `apps/api/src/routes/research_session_books.rs` | `source_token` third arm `session_tape` |
| `apps/api/src/routes/research_session_day_tape.rs` | **Do not change** list/load (re-pin only) |
| `apps/api/src/routes/research_chain_snapshots.rs` | `source_token` third arm |
| `apps/api/src/db/pg_session_chain_archive.rs` | enum ↔ string `session_tape` |
| `apps/api/src/db/pg_chain_snapshot.rs` | enum ↔ string `session_tape` |
| `apps/api/src/state.rs` | `ReplayHold` + occupancy fields; `for_session_day_replay` |
| `apps/api/src/server.rs` | extract HTTP bind without workers; `serve` workers unchanged |
| `apps/api/src/main.rs` | `Commands::SessionDayReplay` ExitCode before `run()` |
| `apps/api/src/routes/stream.rs` | occupancy pump, `live` false, tape `market_session`, Lagged=drop |
| `apps/api/src/services/analytics.rs` | ReplayHold first; Massive four-fetch unreachable while armed |
| `apps/api/openapi/*` + `libs/api/src/generated/schema.ts` | optional `session_tape` on `LiveUpdateBody`; ops still 55 |
| `apps/api/tests/session_day_replay.rs` | hermetic planted walk + refuse-before-bind |
| `apps/api/tests/session_day_replay_isolation.rs` | §2.8 poisons, Pages, score identity |
| `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts` | **Create** — isLive / display-active / chip copy |
| `apps/dashboard/src/app/pages/ticker/liveTapeStore.ts` | genuine `isLive` split + last vouched phase |
| `apps/dashboard/src/app/pages/ticker/useTickerStream.ts` | payload-gap while playing/gap is drop standing |
| `apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx` | S1 chip + last-trade; S0 path unchanged |
| `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx` | headline mid from display-active |
| `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx` | S1 title/subtitle/net-flow/gamma |
| `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts` | S1 tooltips / last-trade replay tooltip |
| `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx` | thread display-active; fills stay on genuine isLive |
| `apps/dashboard/src/app/features/trading/orders/engine.ts` | `tickFromLive` uses genuine isLive |
| `apps/dashboard/src/app/pages/positions/PositionsPage.tsx` | same isLive split (fills off) |
| `apps/dashboard/src/app/day-replay-mock-adapter.spec.tsx` | **Create** — one S1 fixture pass + S0 regression |
| `apps/dashboard/src/app/day-replay-mock-adapter.structural.spec.ts` | **Create** — no `/_ops/replay`, no player chrome |
| `.spire/clusters/tech/contracts/day-replay-mock-adapter/conformance-receipt.json` | B8 closer only |
| `functions/api/[[path]].ts` | **Verify only** |
| `apps/api/src/services/day_tape/occupancy.rs` | **Do not repurpose** (capture axes stay) |
| `libs/quant-engine/**` | **Empty product diff** |

**Do not touch:** `generate_signals` / `compute_opportunity_tier` product logic, OperatorMetrics
`STAGES`, `ENSURE_SYMBOLS` membership, frozen compile-probe `openapi-router-integration-all-52`,
`GET /api/stream/prices` handler, DESIGN_SYSTEM token table.

---

# Backend track

## B1 — Consume occupancy types, timeline, source discriminant

**Files:**

- `apps/api/src/services/day_tape/replay_occupancy.rs` (**create**)
- `apps/api/src/services/day_tape/replay_timeline.rs` (**create**)
- `apps/api/src/services/day_tape/player.rs` (**create** — sleeper trait + re-export timeline; loop is B2)
- `apps/api/src/services/day_tape/construct.rs` (**create** — `parse_pace` + prod-profile predicate only)
- `apps/api/src/services/day_tape/clocks.rs`
- `apps/api/src/services/day_tape/mod.rs`
- `apps/api/src/services/market_data/mod.rs`
- `apps/api/src/services/session_chain_archive/coverage.rs`
- `apps/api/src/routes/research_session_books.rs`
- `apps/api/src/routes/research_chain_snapshots.rs`
- `apps/api/src/db/pg_session_chain_archive.rs`
- `apps/api/src/db/pg_chain_snapshot.rs`

**Depends on:** — **Independent:** no (foundation; `mod.rs` + discriminant compile-fix).

### Tests first

Add `#[cfg(test)]` in the new modules. Frozen weekday `2026-08-10` (Monday), weekend
`2026-08-08`. Path-B marks via existing `path_b_marks()`.

```rust
#[test]
fn market_data_port_remains_two_arms() { /* poison 4 */ }

#[test]
fn market_data_source_kind_has_session_tape_and_serde_token() { /* AC-20 */ }

#[test]
fn classify_loaded_session_tape_is_rejected_source_not_present() { /* AC-20 */ }

#[test]
fn parse_pace_accepts_1_4_10_and_omitted_is_1() { /* AC-3, AC-4 */ }

#[test]
fn parse_pace_rejects_2_60_and_zero_before_bind() { /* AC-4 */ }

#[test]
fn timeline_starts_at_earliest_occupant_and_does_not_invent_0400() { /* AC-5 */ }

#[test]
fn timeline_merges_path_b_marks_onto_et_date_and_sorts_stamped() { /* AC-7 */ }

#[test]
fn path_a_gap_stays_in_vec_order_between_stamped_neighbors() { /* AC-14 */ }

#[test]
fn both_empty_timeline_has_no_occupant() { /* AC-46 */ }

#[test]
fn decode_path_b_body_sets_session_tape_never_live_massive_or_fixture() { /* AC-8, AC-20 */ }

#[test]
fn occupancy_first_playing_has_null_tape_time() { /* AC-10, AC-47 */ }

#[test]
fn tape_time_et_null_cases_are_only_first_keepalive_and_both_empty() { /* S2 Important 2 */ }
```

`market_data_port_remains_two_arms` (in `market_data/mod.rs` tests):

```rust
#[test]
fn market_data_port_remains_two_arms() {
    let src = include_str!("mod.rs");
    let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
    assert!(prod.contains("Live(LiveMarketData)"));
    assert!(prod.contains("Fixture(Arc<FixtureCatalog>)"));
    assert!(
        !prod.contains("Replay("),
        "MarketDataPort must not grow a Replay arm"
    );
    let enum_block = prod
        .split("pub enum MarketDataPort")
        .nth(1)
        .expect("port enum");
    let body = enum_block.split('}').next().unwrap();
    assert_eq!(
        body.matches('(').count(),
        2,
        "MarketDataPort must have exactly two tuple arms"
    );
}
```

Run:

```
cargo test -p api-rust --lib services::day_tape --lib services::market_data --locked -- --nocapture
```

Expect FAIL (modules missing / enum still two source arms). `$LASTEXITCODE` non-zero.

### Implement

`clocks.rs` — add:

```rust
pub fn et_hms_to_ts_ns(et_date: &str, h: u32, m: u32, s: u32) -> Option<i64> {
    let nd = NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok()?;
    let nt = NaiveTime::from_hms_opt(h, m, s)?;
    let dt = New_York.from_local_datetime(&nd.and_time(nt)).single()?;
    dt.timestamp_nanos_opt()
}

pub fn ts_ns_to_tape_time_et(ts_ns: i64) -> Option<String> {
    let secs = ts_ns.div_euclid(1_000_000_000);
    let nsecs = ts_ns.rem_euclid(1_000_000_000) as u32;
    let dt = DateTime::<Utc>::from_timestamp(secs, nsecs)?.with_timezone(&New_York);
    Some(format!(
        "{:02}:{:02}:{:02}",
        dt.hour(),
        dt.minute(),
        dt.second()
    ))
}
```

`market_data/mod.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketDataSourceKind {
    LiveMassive,
    Fixture,
    SessionTape,
}
```

Do **not** add `MarketDataPort::Replay`. `kind()` match stays two arms.

Exhaustive compile-fix (RejectedSource / `session_tape` token — never `present`, never
wildcard-to-`LiveMassive`):

```rust
// coverage.rs classify_loaded source join — add:
(MarketDataSourceKind::SessionTape, _) | (_, MarketDataSourceKind::SessionTape) => {
    MarketDataSourceKind::SessionTape
}
// then:
MarketDataSourceKind::LiveMassive => (IdentityStatus::Present, None),
MarketDataSourceKind::Fixture | MarketDataSourceKind::SessionTape => {
    (IdentityStatus::RejectedSource, None)
}

// research_session_books.rs + research_chain_snapshots.rs source_token:
MarketDataSourceKind::SessionTape => "session_tape",

// pg_* enum → string: SessionTape => "session_tape"
// pg_* string → enum: "session_tape" => SessionTape  (before `_ => Fixture`)
```

`replay_occupancy.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplayPhase {
    Playing,
    Gap,
    Ended,
    Drop,
    Fault,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayConsumeOccupancy {
    pub symbol: String,
    pub et_date: String,
    pub tape_time_et: Option<String>, // JSON null when not vouched; never omit the key on the object
    pub phase: ReplayPhase,
    pub pace: u32,
}

#[derive(Clone, Default)]
pub struct ReplayOccupancySlot {
    inner: std::sync::Arc<tokio::sync::RwLock<Option<ReplayConsumeOccupancy>>>,
}

impl ReplayOccupancySlot {
    pub fn unset() -> Self { Self::default() }
    pub async fn write(&self, occ: ReplayConsumeOccupancy) { *self.inner.write().await = Some(occ); }
    pub async fn snapshot(&self) -> Option<ReplayConsumeOccupancy> { self.inner.read().await.clone() }
    pub async fn is_armed(&self) -> bool { self.inner.read().await.is_some() }
}

pub fn first_playing_voucher(symbol: &str, et_date: &str, pace: u32) -> ReplayConsumeOccupancy {
    ReplayConsumeOccupancy {
        symbol: symbol.to_ascii_uppercase(),
        et_date: et_date.to_string(),
        tape_time_et: None,
        phase: ReplayPhase::Playing,
        pace,
    }
}
```

`construct.rs` (B1 slice only):

```rust
pub fn parse_pace(raw: Option<u32>) -> Result<u32, String> {
    match raw.unwrap_or(1) {
        1 | 4 | 10 => Ok(raw.unwrap_or(1)),
        other => Err(format!("illegal pace {other}")),
    }
}

pub fn production_profile_refuses(app_env: Option<&str>) -> bool {
    app_env == Some("prod")
}
```

`replay_timeline.rs` — merge rules:

- Stamped occupants = Path-A `Trade`/`Quote` with `ts_ns` **plus** Path-B marks converted with
  `et_hms_to_ts_ns(et_date, h, m, 0)`. Sort stamped by `ts_ns` (stable).
- `PathAGap` is **not** given a fake stamp. Walk Path-A **vec order**: after emitting a stamped
  Path-A record, if the next vec item is `PathAGap`, emit `Step::PulseGap` **before** sleeping
  to the next stamped Trade/Quote. Do not sleep **on** the ts-less record. Do not interpolate.
- Path-B marks interleave with stamped Path-A by `ts_ns`.
- Start = first stamped occupant (or first Path-B mark when Path-A empty). Do not invent 04:00.
- Both sides empty → `Vec::new()` occupants (construct still vouches playing, then ended — B3/B2).

```rust
#[derive(Debug, Clone)]
pub enum ReplayStep {
    EmitPathA(PathARecord),
    PulseGap { dropped: u64 },
    ApplyPathB { mark: (u32, u32), ts_ns: i64, body: Vec<u8> },
}

pub fn build_timeline(day: &DayContainer, et_date: &str) -> Vec<ReplayStep> { /* tests pin order */ }

pub fn decode_path_b_body(body: &[u8]) -> Result<crate::services::market_data::VendorBundle, String> {
    let mut v: serde_json::Value =
        serde_json::from_slice(body).map_err(|e| e.to_string())?;
    if let Some(obj) = v.as_object_mut() {
        obj.insert("source".into(), serde_json::json!("session_tape"));
    }
    let wire: crate::services::chain_snapshot::ChainSnapshotWire =
        serde_json::from_value(v).map_err(|e| e.to_string())?;
    let mut bundle = crate::services::chain_snapshot::to_vendor_bundle(wire);
    bundle.source = crate::services::market_data::MarketDataSourceKind::SessionTape;
    if crate::services::day_tape::body_carries_live_massive(body) {
        return Err("path-b body carries LiveMassive".into());
    }
    Ok(bundle)
}
```

`player.rs` (B1): `ReplaySleeper` trait + re-exports. **No** hub loop yet.

```rust
#[async_trait::async_trait]
pub trait ReplaySleeper: Send + Sync {
    async fn sleep_for(&self, delta: std::time::Duration);
}

pub struct TokioSleeper;
#[async_trait::async_trait]
impl ReplaySleeper for TokioSleeper {
    async fn sleep_for(&self, delta: std::time::Duration) {
        if !delta.is_zero() {
            tokio::time::sleep(delta).await;
        }
    }
}

pub struct RecordingSleeper {
    pub sleeps: std::sync::Mutex<Vec<std::time::Duration>>,
}
#[async_trait::async_trait]
impl ReplaySleeper for RecordingSleeper {
    async fn sleep_for(&self, delta: std::time::Duration) {
        self.sleeps.lock().unwrap().push(delta);
    }
}

pub fn wall_delay(prev_ts_ns: i64, next_ts_ns: i64, k: u32) -> std::time::Duration {
    let dt = next_ts_ns.saturating_sub(prev_ts_ns).max(0);
    std::time::Duration::from_nanos((dt as u128 / k as u128) as u64)
}
```

`mod.rs`: `pub mod replay_occupancy; pub mod replay_timeline; pub mod player; pub mod construct;`
and add the new files to the existing poison `include_str` list (still bans
`insert_if_absent` / `spawn_capture` / watermarks). Split poison tokens the same way the
existing test does (`format!("insert_if_{}", "absent")`) so the test file is not a hit.

Extend `coverage.rs` existing exhaustive-match poison (the `split("fn classify_loaded")`
test) — it must still pass after the third arm.

Run the B1 filter again. Expect PASS. `$LASTEXITCODE` 0.

```
cargo check -p api-rust --features postgres --locked
```

Expect PASS (pg source matches compile).

Commit: `feat(api): session-tape source kind and replay timeline types`

**Reviewer probes:** `MarketDataPort` still two arms; `SessionTape` never `present`; Path-B
decode cannot yield `LiveMassive`; `occupancy.rs` capture axes untouched; `mod.rs` poison list
includes the new files.

---

## B2 — Player clock: Path-A emit, gap pulse, Path-B ReplayHold

**Files:** `apps/api/src/services/day_tape/player.rs`

**Depends on:** B1. **Independent:** yes.

B3 owns `ReplayHold` on `AppState`. Until B3 lands, player takes ports (hub, occupancy slot,
hold handle). Define a small port in `player.rs` so this task does not write `state.rs`:

```rust
pub struct PlayerPorts {
    pub hub: crate::infrastructure::massive::StockStreamHub,
    pub occupancy: ReplayOccupancySlot,
    pub hold: std::sync::Arc<dyn ReplayHoldSink>,
    pub sleeper: std::sync::Arc<dyn ReplaySleeper>,
}

#[async_trait::async_trait]
pub trait ReplayHoldSink: Send + Sync {
    async fn replace(&self, symbol: &str, et_date: &str, snap: crate::state::AnalyticsSnapshot);
}
```

If `AnalyticsSnapshot` import from `state` cycles at type level, store
`Box<dyn Fn(AnalyticsSnapshot) + Send + Sync>` instead — the existing `path_a.rs` already
takes `AppState` in functions, so a function-level import is the proven pattern.

### Tests first

```rust
#[tokio::test]
async fn one_x_honors_positive_gap_and_does_not_dump() { /* AC-2 */ }

#[tokio::test]
async fn four_x_and_ten_x_compress_waits_without_reorder() { /* AC-3 */ }

#[tokio::test]
async fn emits_path_a_in_stored_order_with_stored_ts_ns() { /* AC-1 */ }

#[tokio::test]
async fn path_b_applied_only_when_reached() { /* AC-7, AC-8 */ }

#[tokio::test]
async fn path_a_gap_pulses_then_sleeps_to_next_stamp() { /* AC-14 */ }

#[tokio::test]
async fn gap_pulse_holds_last_vouched_tape_time() { /* S2 Important 2 */ }

#[tokio::test]
async fn empty_path_a_occupied_path_b_starts_with_zero_apply_event() { /* AC-16 */ }

#[tokio::test]
async fn both_empty_ends_after_first_playing_voucher() { /* AC-46 */ }

#[tokio::test]
async fn after_last_occupant_no_further_path_a_and_no_loop() { /* AC-6 */ }

#[tokio::test]
async fn unreadable_path_b_mark_is_skipped_path_a_continues() { /* §2.7 */ }

#[tokio::test]
async fn player_does_not_call_massive() { /* AC-9 */ }
```

Plant a `DayContainer` in `SessionDayTape::memory()`: two Path-A trades 1s apart + two Path-B
bodies (minimal `fixture_probe_bundle` bytes with source stripped, then decode must stamp
`SessionTape`). Hub = `StockStreamHub::harness_local()`. Subscribe **before** `run_player`.
`RecordingSleeper` records `(t_next-t_prev)/k`. Assert event order, stored `ts_ns`, sleep
durations (`1s` at 1×, `250ms` at 4×, `100ms` at 10× for a 1s stamp gap).

Run:

```
cargo test -p api-rust --lib services::day_tape::player --locked -- --nocapture
```

Expect FAIL (`run_player` missing).

### Implement

```rust
pub async fn run_player(
    symbol: &str,
    et_date: &str,
    pace: u32,
    day: DayContainer,
    ports: PlayerPorts,
) {
    let steps = build_timeline(&day, et_date);
    if steps.is_empty() {
        let mut ended = ports.occupancy.snapshot().await.unwrap_or_else(|| {
            first_playing_voucher(symbol, et_date, pace)
        });
        ended.phase = ReplayPhase::Ended;
        ports.occupancy.write(ended).await;
        return;
    }
    let mut prev_ts: Option<i64> = None;
    for step in steps {
        match step {
            ReplayStep::PulseGap { .. } => {
                if let Some(mut occ) = ports.occupancy.snapshot().await {
                    occ.phase = ReplayPhase::Gap;
                    // keep occ.tape_time_et — do not null it
                    ports.occupancy.write(occ).await;
                }
            }
            ReplayStep::EmitPathA(rec) => {
                let ts = rec.ts_ns.unwrap_or(0);
                if let Some(prev) = prev_ts {
                    ports.sleeper.sleep_for(wall_delay(prev, ts, pace)).await;
                }
                prev_ts = Some(ts);
                let ev = stream_event_from_path_a(symbol, &rec);
                ports.hub.publish_event(ev);
                if let Some(mut occ) = ports.occupancy.snapshot().await {
                    occ.phase = ReplayPhase::Playing;
                    occ.tape_time_et = ts_ns_to_tape_time_et(ts);
                    ports.occupancy.write(occ).await;
                }
            }
            ReplayStep::ApplyPathB { mark: _, ts_ns, body } => {
                if let Some(prev) = prev_ts {
                    ports.sleeper.sleep_for(wall_delay(prev, ts_ns, pace)).await;
                }
                prev_ts = Some(ts_ns);
                match decode_path_b_body(&body) {
                    Ok(vendor) => {
                        if let Ok(snap) = crate::services::analytics::compute_analytics_from_vendor(
                            &vendor,
                            &crate::services::analytics::AnalyticsComputeParams::default(),
                            None,
                        )
                        .await
                        {
                            ports.hold.replace(symbol, et_date, snap).await;
                        }
                    }
                    Err(_) => { /* skip mark */ }
                }
                if let Some(mut occ) = ports.occupancy.snapshot().await {
                    occ.phase = ReplayPhase::Playing;
                    occ.tape_time_et = ts_ns_to_tape_time_et(ts_ns);
                    ports.occupancy.write(occ).await;
                }
            }
        }
    }
    if let Some(mut occ) = ports.occupancy.snapshot().await {
        occ.phase = ReplayPhase::Ended;
        ports.occupancy.write(occ).await;
    }
}

fn stream_event_from_path_a(symbol: &str, rec: &PathARecord) -> crate::domain::StreamEvent {
    crate::domain::StreamEvent {
        symbol: symbol.to_ascii_uppercase(),
        kind: match rec.kind {
            PathAKind::Quote => crate::domain::StreamKind::Quote,
            _ => crate::domain::StreamKind::Trade,
        },
        ts_ns: rec.ts_ns.unwrap_or(0),
        price: rec.price,
        size: rec.size,
        bid: rec.bid,
        ask: rec.ask,
        bid_size: rec.bid_size,
        ask_size: rec.ask_size,
    }
}
```

On player panic / tape-read failure: write `phase: fault` if the occupancy slot is still up;
do not 5xx; do not fabricate ticks. Map that in a `catch` around decode/compute — B7 also
covers desk isolation.

Player publishes **only** the armed symbol. `PathAKind::PathAGap` never becomes a `StreamEvent`.

Run tests. Expect PASS. Commit: `feat(api): session-day replay player clock`

**Reviewer probes:** RecordingSleeper proves not-a-dump; gap does not clear `tape_time_et`;
empty Path-A is zero hub events; both-empty writes ended; `compute_analytics_from_vendor` is
the only Path-B compute (no `refresh_analytics`).

---

## B3 — Construct, AppState, clap, vouch-then-bind

**Files:**

- `apps/api/src/services/day_tape/construct.rs`
- `apps/api/src/state.rs`
- `apps/api/src/server.rs`
- `apps/api/src/main.rs`

**Depends on:** B1. **Independent:** yes (disjoint from `player.rs`).

### Tests first

In `construct.rs` / `state.rs` / `main.rs` `#[cfg(test)]`:

```rust
#[tokio::test]
async fn missing_identity_refuses_before_bind() { /* AC-15 */ }

#[tokio::test]
async fn unreadable_weekend_not_elapsed_nvda_not_storing_refuse_before_bind() { /* AC-15, AC-42 */ }

#[tokio::test]
async fn illegal_pace_refuses_before_bind() { /* AC-4 */ }

#[tokio::test]
async fn production_profile_plus_arm_refuses_before_bind() { /* AC-19 */ }

#[tokio::test]
async fn playable_vouches_playing_before_listener_bind() { /* AC-10, AC-47 */ }

#[tokio::test]
async fn replay_construct_vendor_fixture_is_none_and_stock_worker_not_started() { /* poison 3, 6 */ }

#[test]
fn serve_command_does_not_grow_replay_flag() { /* poison 2 */ }

#[test]
fn clap_name_is_session_day_replay() { /* AC-45 */ }
```

Refuse tests: call `prepare_replay(...)` and assert `Prepare::Refuse { literal }` with the
**capture** literal; assert a `did_bind: AtomicBool` stays false (pass a bind thunk that sets
it). Do **not** open a real socket in unit tests.

`serve_command_does_not_grow_replay_flag`:

```rust
const MAIN: &str = include_str!("main.rs");
const SERVER: &str = include_str!("server.rs");
#[test]
fn serve_command_does_not_grow_replay_flag() {
    let serve_arm = MAIN.split("Serve {").nth(1).unwrap().split('}').next().unwrap();
    assert!(!serve_arm.contains("replay"));
    assert!(!SERVER.contains("run_player"));
    assert!(!SERVER.contains("session-day-replay"));
}
```

Run:

```
cargo test -p api-rust --lib services::day_tape::construct --locked -- --nocapture
cargo test -p api-rust --bin api-rust clap --locked -- --nocapture
```

Expect FAIL.

### Implement

`state.rs` — add beside `gex_cache` (same pattern as `day_tape: SessionDayTape`):

```rust
pub replay_occupancy: crate::services::day_tape::ReplayOccupancySlot,
pub replay_hold: ReplayHold,

pub struct ReplayHold {
    inner: tokio::sync::RwLock<Option<ReplayHoldEntry>>,
}
struct ReplayHoldEntry {
    symbol: String,
    et_date: String,
    snapshot: AnalyticsSnapshot,
}
impl ReplayHold {
    pub fn empty() -> Self { Self { inner: tokio::sync::RwLock::new(None) } }
    pub async fn replace(&self, symbol: &str, et_date: &str, snapshot: AnalyticsSnapshot) {
        *self.inner.write().await = Some(ReplayHoldEntry {
            symbol: symbol.to_ascii_uppercase(),
            et_date: et_date.to_string(),
            snapshot,
        });
    }
    pub async fn get(&self, symbol: &str) -> Option<AnalyticsSnapshot> {
        let g = self.inner.read().await;
        g.as_ref().and_then(|e| {
            (e.symbol == symbol.to_ascii_uppercase()).then(|| e.snapshot.clone())
        })
    }
}
```

Wire `replay_occupancy: ReplayOccupancySlot::unset()` and `replay_hold: ReplayHold::empty()`
into **every** existing constructor (`construct`, `for_capacity_harness_with_env`, any test
stub). Compile will force this.

New constructor (mirror `for_capacity_harness_with_env` — no `Config::from_env` live Massive,
`vendor_fixture: None`, `StockStreamHub::harness_local()`, never `stock_worker.start()`,
`warm_enabled = false`, `scan_enabled = false`, tape store **passed in** so tests plant
Memory):

```rust
pub async fn for_session_day_replay_with_env(
    tape: SessionDayTape,
    occupancy: ReplayOccupancySlot,
    app_env: Option<&str>,
) -> AppResult<Self> {
    if crate::services::day_tape::construct::production_profile_refuses(app_env) {
        return Err(AppError::Config(
            "session-day-replay refuses APP_ENV=prod".into(),
        ));
    }
    // stub config like capacity: dummy key, rest_base http://127.0.0.1:1, no warm/scan/ensure
    // vendor_fixture: None
    // stock_hub: harness_local()
    // day_tape: tape
    // replay_occupancy: occupancy
    // Intentionally never call stock_worker.start()
}
```

`server.rs` — extract HTTP bind **without** workers:

```rust
pub async fn serve_http_only(state: AppState, bind: String) -> AppResult<()> {
    let app = router_with_cors(state, cors_layer())?;
    let addr: SocketAddr = bind.parse().map_err(|e| {
        crate::error::AppError::Config(format!("HTTP_BIND {bind}: {e}"))
    })?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!("serve: {e}")))?;
    Ok(())
}
```

`serve()` keeps worker-start **after** bind exactly as today. It must not call the player.

`construct.rs` — prepare → vouch → spawn player → `serve_http_only`:

```rust
pub enum Prepare {
    Play { state: AppState, symbol: String, et_date: String, pace: u32, day: DayContainer },
    Refuse { literal: String },
}

pub async fn prepare_replay(
    symbol: &str,
    et_date: &str,
    pace_raw: Option<u32>,
    tape: SessionDayTape,
    now: DateTime<Utc>,
    app_env: Option<&str>,
) -> Prepare {
    if production_profile_refuses(app_env) {
        return Prepare::Refuse { literal: "session-day-replay refuses APP_ENV=prod".into() };
    }
    let pace = match parse_pace(pace_raw) {
        Ok(k) => k,
        Err(e) => return Prepare::Refuse { literal: e },
    };
    let symbol = normalize_symbol(symbol);
    let Some(et) = parse_et_date(et_date) else {
        return Prepare::Refuse { literal: "et_date must be YYYY-MM-DD".into() };
    };
    // derive_axis_a / derive_path_a / derive_path_b using existing occupancy.rs
    // NotInWatchlist / NotStoring / Weekend / NotElapsed / NoIdentity / Unreadable → Refuse
    //   with capture literals (literals.rs)
    // StoringReady → load DayContainer; Unreadable container → Refuse whole day (no partial play)
    // then AppState::for_session_day_replay_with_env
    // occupancy.write(first_playing_voucher(&symbol, &et, pace)).await  // BEFORE bind
    // Prepare::Play { ... }
}

pub fn standing_block(symbol: &str, et_date: &str, pace: u32) -> String {
    let clock = if pace == 1 {
        "tape time ET".to_string()
    } else {
        format!("tape time ET · {pace}×")
    };
    format!(
        "SESSION TAPE — RESEARCH PLAYBACK · NOT A LIVE VENDOR FEED\n\
           Identity:    {symbol} · {et_date} America/New_York\n\
           Source:      session day tape · Path-A ticks · Path-B 5-minute structure when present\n\
           Provenance:  research tape · never live_massive · never coverage present\n\
           Clock:       {clock}\n\
           Vendor I/O:  0 Massive calls on this playback\n\
           Authorizes:  nothing on the score formula. Not a live paid session book.\n\
                        Not coverage present. Not redistributed as a live vendor feed.\n"
    )
}
```

CLI status lines (SPEC §4): `[RUNNING] session-day-replay — {SYMBOL} {ET_DATE} · session day tape · not a live feed`;
ended `[OK] session-day-replay — session tape ended · {SYMBOL} on {ET_DATE}`;
stopped `[OK] session-day-replay — stopped · not live Massive`;
`Starting session tape…` is process start **before bind**, not HTTP.

`main.rs`:

```rust
SessionDayReplay {
    #[arg(long)]
    symbol: String,
    #[arg(long = "et-date")]
    et_date: String,
    #[arg(long)]
    pace: Option<u32>,
},
```

Dispatch **before** `run()`, like `SessionDayTape`. `cmd_session_day_replay` prints standing
block first; on Refuse prints the literal and returns non-zero **without** bind; on Play
prints `[RUNNING]…`, spawns `run_player`, then `server::serve_http_only`. Open tape like the
tape CLI (`open_session_day_tape_for_cli` / Memory in tests) — never `MassiveRestClient` live
join, never `MarketDataPort::live`. Empty `massive_api_key` pattern.

Empty Path-A standing: print `no path-a ticks…` and **start**. Path-B empty + Path-A present:
print `no path-b snapshots…` and walk Path-A.

Run tests. Expect PASS. Commit: `feat(api): session-day-replay construct vouches then binds`

**Reviewer probes:** `Serve {` gains no replay field; production-profile refuse has no
listener; first occupancy write happens before the bind thunk; `vendor_fixture` is None.

---

## B4 — Ticker SSE occupancy pump on the existing socket

**Files:** `apps/api/src/routes/stream.rs`

**Depends on:** B3. **Independent:** yes.

### Tests first

```rust
#[test]
fn live_update_body_omits_session_tape_when_none() { /* AC-17 */ }

#[test]
fn armed_live_update_serializes_live_false_feed_session_tape() { /* AC-10 */ }

#[test]
fn armed_null_cursor_market_session_is_session_tape_not_wall() { /* AC-47, INTERFACE */ }

#[tokio::test]
async fn first_data_event_already_has_session_tape() { /* AC-10, AC-47 */ }

#[tokio::test]
async fn keepalive_is_json_data_not_comment_while_armed() { /* AC-11, poison 8 */ }

#[tokio::test]
async fn lagged_while_armed_is_drop_not_silent_continue() { /* AC-13 */ }

#[tokio::test]
async fn ended_and_fault_repeat_as_data() { /* AC-12 */ }

#[tokio::test]
async fn apply_event_not_called_for_occupancy_only() { /* poison 9 */ }

#[tokio::test]
async fn not_the_armed_symbol_still_carries_armed_identity() { /* AC-29 */ }
```

Serialize tests: build `LiveUpdateBody { session_tape: None, live: true, .. }` → JSON must
**not** contain `"session_tape"`. Armed body: `"live": false`, `"feed": "session_tape"`,
`tape_time_et` present as `null` or `"HH:MM:SS"`.

SSE tests: `AppState::for_session_day_replay_with_env` + occupancy already vouched +
`axum::http` / `oneshot` or in-process `stream_ticker_http`. Collect `Event`s. First `data:`
JSON has `session_tape`. While armed and `!dirty`, the loop must send `data:` occupancy, not
`comment("heartbeat")`. Inject `RecvError::Lagged` (publish more than `BROADCAST_CAPACITY`
events, or call a test hook) → occupancy phase `drop` and a `data:` payload with
`session_tape.phase == "drop"` **or** (if the slot is written drop) consume standing is drop;
do **not** `continue` silently.

Run:

```
cargo test -p api-rust --lib routes::stream --locked -- --nocapture
```

Expect FAIL.

### Implement

Add to `LiveUpdateBody`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SessionTapeOccupancyBody {
    pub symbol: String,
    pub et_date: String,
    pub tape_time_et: Option<String>,
    pub phase: String,
    pub pace: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct LiveUpdateBody {
    // existing fields unchanged
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_tape: Option<SessionTapeOccupancyBody>,
}
```

`tape_time_et` is `Option<String>` **without** `skip_serializing_if` so armed payloads emit
JSON `null` (INTERFACE `string|null`). The **object** is what is omitted when unset.

Switch the ticker loop from `json!` to `serde_json::to_string(&LiveUpdateBody { ... })` so omit
rules live in one place. `representative_live_update()` stays **unset** (`session_tape: None`,
today’s `live: true`) — production OpenAPI example must not grow a permanent replay field.

Armed loop changes (only when `state.replay_occupancy.is_armed()`; clone the slot into the
spawn):

1. Immediate first `data:` (after optional `connected` comment) from occupancy snapshot +
   current numbers. Never wait on `dirty` for the first occupancy payload.
2. `live` **false** on every data payload. `feed` = `"session_tape"`.
3. `market_session`: if `tape_time_et` is `None` → `"session_tape"`; else America/New_York
   bucket of **that** stamp (reuse the same minute gates as `market_session()`, but take a
   `DateTime<Utc>` argument — do not call wall `Utc::now()` for the bucket).
4. Occupancy pump: `tokio::time::interval(Duration::from_secs(5))` (strictly < 15s) that
   emits JSON data even when `!dirty`. **Do not** send `comment("heartbeat")` while armed.
5. Real ticks still `apply_event` only when `ev.symbol == route_sym` (already true). Occupancy
   identity is always the **armed** pair, including when route symbol ≠ armed symbol.
6. Gamma flip peek: `replay_hold.get(&sym)` then `gex_cache.peek`.
7. `RecvError::Lagged` / `Closed` while snapshot phase is `playing` or `gap`: write
   `phase: drop`, emit drop occupancy data, **do not** `continue` silently. `Closed` then
   break after the drop payload.
8. After occupancy phase is `ended` or `fault`, keep repeating that object on the 5s data
   period until the process stops.
9. Unset arm: today’s recency `live`, today’s comments, no `session_tape` key. Byte-identical.

`GET /api/stream/prices` loop stays as today (not the walk surface).

Run tests. Expect PASS. Commit: `feat(api): ticker SSE session-tape occupancy pump`

**Reviewer probes:** unset serialization omits the key; first armed `data:` has occupancy;
`!dirty` is data not comment; Lagged is drop; representative OpenAPI body still unset.

---

## B5 — ReplayHold before cache; Massive four-fetch unreachable while armed

**Files:** `apps/api/src/services/analytics.rs`

**Depends on:** B3. **Independent:** yes.

### Tests first

```rust
#[tokio::test]
async fn load_analytics_prefers_replay_hold_before_gex_cache() { /* AC-8 */ }

#[tokio::test]
async fn armed_rest_for_second_symbol_does_not_four_fetch() { /* AC-9, AC-29 */ }

#[tokio::test]
async fn armed_cache_miss_is_absent_structure_not_5xx() { /* AC-22, AC-25 */ }

#[tokio::test]
async fn same_path_b_body_score_triple_matches_live_compute() { /* AC-23 */ }

#[tokio::test]
async fn unset_construct_still_uses_existing_compute_analytics() { /* AC-24 */ }
```

Massive ban: plant occupancy armed, `ReplayHold` empty for `QQQ`, point `rest_base` at
`http://127.0.0.1:1`. `load_analytics(state, "QQQ", ...)` must return `Ok((None, _))` (or
equivalent absent) **without** attempting the four-fetch join. A unit that stubs
`state.massive` is ideal; if the client is not injectable, assert with a source probe that
`compute_analytics` returns before `tokio::join!` when `replay_occupancy.is_armed()`, plus an
integration test that the dummy rest_base is never contacted (timeout would fail the test if
the join runs).

Score identity: `compute_analytics_from_vendor` on a planted Path-B body vs the same body
through the live compute path (unset, fixture catalog) — `opportunity_score`,
`opportunity_tier`, `state_fingerprint` equal. `iv_store = None` on the replay call.

Run:

```
cargo test -p api-rust --lib services::analytics --locked -- --nocapture
```

Expect FAIL.

### Implement

At the top of `load_analytics` **and** `load_or_compute`:

```rust
if state.replay_occupancy.is_armed().await {
    if let Some(hit) = state.replay_hold.get(sym).await {
        return Ok((Some(hit), "session_tape".into())); // load_or_compute: return Ok(hit)
    }
    return Ok((None, "session_tape".into())); // load_or_compute: honest absent, not 5xx
}
```

For `load_or_compute` the current signature returns `Result<AnalyticsSnapshot, AppError>`.
Absent structure must **not** 5xx the desk. Change the miss-while-armed path to return
`Err` only if you can prove ticker/market routes already map that error to 200+null
analytics; **prefer** extending `load_or_compute` callers via `load_analytics` (already
`Option`) and short-circuit `load_or_compute` by returning a best-effort error that
`ticker.rs` / `market.rs` already treat as missing — **or** add:

```rust
pub async fn load_or_compute(...) -> Result<AnalyticsSnapshot, AppError> {
    if state.replay_occupancy.is_armed().await {
        if let Some(hit) = state.replay_hold.get(sym).await {
            return Ok(hit);
        }
        return Err(AppError::NotFound("structure unavailable".into())); // only if existing NotFound is 200-null
    }
    // existing
}
```

Read `ticker.rs` / `market.rs` at source before choosing. If `load_analytics` is the only
trader REST compute, gating it is sufficient; still gate `compute_analytics` itself:

```rust
async fn compute_analytics(...) {
    if state.replay_occupancy.is_armed().await {
        return Err(AppError::Config("replay construct does not four-fetch".into()));
    }
    // existing vendor_fixture / Massive join
}
```

Trader REST must not surface that as 5xx: `load_analytics` returns `Ok((None, _))` **before**
calling `compute_analytics`. `refresh_analytics` is not started by the replay construct;
still short-circuit it if armed (poison 6).

Do **not** set `vendor_fixture` to sneak around the ban.

Run tests. Expect PASS. Commit: `feat(api): ReplayHold structure path and armed Massive ban`

**Reviewer probes:** QQQ on an SPY-armed walker does not join Massive; ReplayHold hit is the
structure; unset path still four-fetches / cache-hits as today; quant-engine untouched.

---

## B6 — OpenAPI LiveUpdateBody occupancy object (ops stay 55)

**Files:**

- `apps/api/openapi/convexa.openapi.json` (generated)
- `apps/api/openapi/parity-coverage.json` (generated)
- `apps/api/openapi/generated-artifacts.manifest.json` (generated)
- `libs/api/src/generated/schema.ts` (generated)
- `apps/api/tests/api_contract_parity.rs` (only if a LiveUpdateBody field pin fails)

**Depends on:** B4. **Independent:** no (`libs/api` is outside `backend.dir` / `frontend.dir`).

### Steps

1. Confirm `LiveUpdateBody` in `stream.rs` has optional `session_tape` (B4). Operation count
   must remain **55** — do not add paths.
2. `npm run api:contract:generate`
3. `npm run api:contract:check` → `API contract check passed: generated artifacts match the Rust API contract.`
4. In generated `schema.ts`, `LiveUpdateBody` must include optional
   `session_tape?: { symbol: string; et_date: string; tape_time_et?: string | null; phase: string; pace: number }`.
5. Do **not** run `api:contract:baseline:accept`. Do **not** retarget
   `openapi-router-integration-all-52`.

If generate fails because utoipa requires an extra `schema!` for `SessionTapeOccupancyBody`,
add `schema!(stream::SessionTapeOccupancyBody)` next to `schema!(stream::LiveUpdateBody)` in
`routes/mod.rs` — that file is then in this task (still `Independent: no`).

Commit: `feat(api): LiveUpdateBody session_tape occupancy schema`

**Reviewer probes:** operation_count 55; unset example omits the key; generated TS optional.

---

## B7 — Hermetic planted walk + isolation poisons

**Files:**

- `apps/api/tests/session_day_replay.rs` (**create**)
- `apps/api/tests/session_day_replay_isolation.rs` (**create**)

**Depends on:** B2, B3, B4, B5, B6. **Independent:** no.

### Tests first (one planted-walk pass — SPEC §3 method notes)

Plant `(SPY, 2026-08-10)` two Path-A events + two Path-B marks → `prepare_replay` 1× →
**first SSE `data:` has `session_tape` and `live: false` and `feed: session_tape`** → events
in order with gap honored → marks applied only when reached → vendor counter 0 **including
REST for QQQ** → keep-alive **data** during the gap → last event then ended ≠ live-offline →
missing identity refuses before bind → empty Path-A + occupied Path-B starts with zero prints
→ **both-empty starts then ends** → unreadable refuses before bind → weekend/future/NVDA
refuse before bind → illegal pace refuses → production-profile plus arm refuses → coverage
missing stays missing → same inputs score triple identical → player fault does not 5xx
bundle/scan → secrets in env do not appear in SSE JSON.

Plus 4× compresses the same gap.

Isolation / poison (mutation-tested; anti-vacuity: a needle that cannot fire fails):

- Player / construct / replay_* sources: no `insert_if_absent`, `archive_session_best_effort`,
  `spawn_capture`, `path_a::spawn`, `warmer::spawn` (split tokens).
- `MarketDataPort` still two arms (re-pin).
- `Serve` worker-start path still starts `stock_worker` and does **not** start the player.
- Replay construct: `vendor_fixture.is_none()`; rehydrated Path-B `source != LiveMassive`;
  `body_carries_live_massive` false.
- Armed envelope builder cannot emit `live: true` with `session_tape` present (unit on
  `LiveUpdateBody` assembly).
- Occupancy is not comments-only (scan stream.rs armed branch for `comment("heartbeat")`
  while occupancy is Some — must not send it).
- `StreamEvent` has no provenance field (scan `domain/price.rs`).
- `quant-engine` / `generate_signals` / `compute_opportunity_tier` do not import `day_tape`.
- Pages `functions/api/[[path]].ts` still 404s `_research` and `_metrics` (read-only).
- OperatorMetrics `STAGES` still the six latency names.
- Dashboard product sources have no `/_ops/replay` (B7 may read FE files; it must **not**
  write them).
- `libs/api/src/lib/convexa.ts` has no `/api/_ops/replay` helper.
- Token 401 on tape **read** when `METRICS_SECRET_TOKEN` set (existing
  `api_contract_runtime_auth_research.rs` re-pin — do not mark `"auth": true`).

Run:

```
cargo test -p api-rust --test session_day_replay --test session_day_replay_isolation --locked -- --nocapture
```

Expect FAIL then PASS.

Commit: `test(api): session-day-replay planted walk and isolation`

**Reviewer probes:** GATE Q will need **both** a rejecting path and an accepting planted walk.
A suite that only dumps a tape onto a hub has not proved a clock. Coverage `present` unchanged.

---

## B8 — Closer: serve + conformance receipt

**Files:** `.spire/clusters/tech/contracts/day-replay-mock-adapter/conformance-receipt.json`

**Depends on:** B1, B2, B3, B4, B5, B6, B7. **Independent:** no.

B8 does **not** re-implement worker paths. It proves the **unset** graph still serves the
tape/session-books HTTP contract and writes the lane receipt. Live G1 does **not** subscribe
SSE and does **not** fetch ticker REST as Massive conformance.

### Steps

1. `cargo fmt -p api-rust` then `cargo fmt -p api-rust -- --check` (exit 0).
2. `cargo check -p api-rust --features postgres` (exit 0).
3. `cargo test -p api-rust -p quant-engine --locked` (exit 0). Check `$LASTEXITCODE`.
4. `npm run api:contract:check` →
   `API contract check passed: generated artifacts match the Rust API contract.`
   Operation count **55**.
5. Free ports and serve (**not** `npx nx serve api`):

```
npm run ports:free
cargo run -p api-rust --features postgres -- serve
```

   Listener `:8000`. This is the **unset** production path (Massive-capable). Occupancy must
   be **absent** on any accidental SSE sample.

6. Receipt — do **not** hand-edit JSON:

```
node .grok/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/day-replay-mock-adapter/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/day-replay-mock-adapter/conformance-receipt.json
```

   Expect tool-written `verdict: PASS` on the five HTTP `endpoints` (NVDA list/load, 422 bad
   date, session-books re-pins). SSE occupancy is **not** live-fetched; GATE Q hermetic (B7)
   owns `session_tape` presence and `live: false`.

   If serve cannot boot, `--sample` so the receipt records `UNVERIFIABLE` — honest, not a fake
   PASS.

7. NUL scan the receipt → `0`.
8. Optional CLI smoke (does not replace B7):

```
cargo run -p api-rust --locked -- session-day-replay --help
```

   Expect exit 0, help contains `session-day-replay`, `--symbol`, `--et-date`, `--pace`.

```
cargo run -p api-rust --locked -- session-day-replay --symbol NVDA --et-date 2020-01-02
```

   Expect **non-zero**, stdout/stderr contains `not in tape watchlist: NVDA`, process does
   **not** bind `:8000`. Standing block printed first.

Commit: `test(api): day-replay-mock-adapter conformance receipt`

**Reviewer probes:** closer diff is the receipt (+ fmt if any). No re-touch of `player.rs` /
`stream.rs` / `analytics.rs`. Receipt `endpoints` length 5. Serve used cargo, not Nx.

---

# Frontend track

SPEC §4 is **not** `NO_UI_CHANGE`. It names **surfaces** (TintChip, LiveTape, last-trade,
FreshnessLine, order engine) but **not file paths**. Per `PLAN_METHOD.md`, every frontend
row is `Independent: no`. One worker may run F1→F4 in order.

Do **not** add `/_ops/replay`, a ticker player, Settings replay picker, nav item, or a second
EventSource. S0 (occupancy omitted) must stay byte-identical to today.

Until B6 generated `LiveUpdate.session_tape` exists, use structural access:

```ts
export type SessionTapeOccupancy = {
  symbol: string;
  et_date: string;
  tape_time_et: string | null;
  phase: 'playing' | 'gap' | 'ended' | 'drop' | 'fault';
  pace: number;
};

export function sessionTapeOf(live: LiveUpdate | null): SessionTapeOccupancy | undefined {
  if (!live) return undefined;
  const v = (live as LiveUpdate & { session_tape?: SessionTapeOccupancy }).session_tape;
  return v;
}
```

After B6, prefer the generated field; keep the helper.

## F1 — Standing helpers + genuine isLive split

**Files:**

- `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts` (**create**)
- `apps/dashboard/src/app/pages/ticker/liveTapeStore.ts`
- `apps/dashboard/src/app/pages/ticker/useTickerStream.ts`

**Depends on:** — **Independent:** no.

### Tests first

Colocate `sessionTapeStanding.spec.ts`:

```ts
it('genuineIsLive is false when session_tape is present even if live is true', () => { /* AC-31 poison */ });
it('genuineIsLive still true for S0 live payload without session_tape', () => { /* AC-17 */ });
it('displayActive requires route symbol match and playing|gap and delivering', () => { /* AC-41, AC-29 */ });
it('starting is playing + tape_time_et null', () => { /* AC-47 */ });
it('payload gap during playing or gap is drop standing not live-offline', () => { /* AC-13, AC-33 */ });
it('ended or fault plus payload gap is not drop and not live-offline', () => { /* AC-12, AC-32 */ });
```

Run:

```
npx nx test @convexa/dashboard --testFile=sessionTapeStanding.spec.ts
```

Expect FAIL.

### Implement

```ts
export function genuineIsLive(
  live: LiveUpdate | null,
  streamOffline: boolean,
): boolean {
  if (sessionTapeOf(live)) return false;
  return (live?.live ?? false) && !streamOffline;
}

export function displayActive(opts: {
  live: LiveUpdate | null;
  routeSymbol: string;
  streamOffline: boolean;
}): boolean {
  const st = sessionTapeOf(opts.live);
  if (!st || opts.streamOffline) return false;
  if (st.phase !== 'playing' && st.phase !== 'gap') return false;
  return opts.routeSymbol.toUpperCase() === st.symbol.toUpperCase();
}

export type ConsumeStanding =
  | { kind: 's0' }
  | { kind: 'starting' }
  | { kind: 'playing' }
  | { kind: 'gap' }
  | { kind: 'ended' }
  | { kind: 'drop' }
  | { kind: 'fault' }
  | { kind: 'not-this-ticker' };

export function consumeStanding(opts: {
  live: LiveUpdate | null;
  streamOffline: boolean;
  routeSymbol: string;
  lastPhase?: SessionTapeOccupancy['phase'] | null;
}): ConsumeStanding {
  const st = sessionTapeOf(opts.live);
  if (!st) return { kind: 's0' };
  const last = opts.lastPhase ?? st.phase;
  if (opts.streamOffline && (last === 'playing' || last === 'gap')) return { kind: 'drop' };
  if (st.phase === 'ended') return { kind: 'ended' };
  if (st.phase === 'fault') return { kind: 'fault' };
  if (st.phase === 'drop') return { kind: 'drop' };
  if (opts.routeSymbol.toUpperCase() !== st.symbol.toUpperCase()) return { kind: 'not-this-ticker' };
  if (st.phase === 'gap') return { kind: 'gap' };
  if (st.phase === 'playing' && st.tape_time_et == null) return { kind: 'starting' };
  return { kind: 'playing' };
}
```

`liveTapeStore.ts`:

```ts
isLive: genuineIsLive(s.live, s.streamOffline),
displayActive: displayActive({ live: s.live, routeSymbol: s.ticker, streamOffline: s.streamOffline }),
lastSessionPhase: sessionTapeOf(s.live)?.phase ?? null,
```

Keep `lastSessionPhase` across a payload-gap: `publishLiveTape({ streamOffline: true })` must
**not** clear the last phase (do not set `live: null` on gap). `useTickerStreamConnection`
already keeps last `live` and only flips `streamOffline`.

`readLiveTape` / `useLiveTape` expose `isLive` via `genuineIsLive` so every consumer (orders,
portfolio, LiveTape default) inherits the split.

S0: occupancy omitted → behavior identical to `(live?.live ?? false) && !streamOffline`.

Run tests + existing `CommandDeck.spec.tsx` connectionChip S0 cases (must stay green).

Commit: `feat(dashboard): session-tape isLive split and consume standing`

**Reviewer probes:** poison `live: true` + `session_tape` cannot become `isLive`; S0 fixtures
unchanged; last phase survives `streamOffline`.

---

## F2 — Connection chip, last-trade, CommandDeck headline

**Files:**

- `apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx`
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx`
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts`
- `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx`

**Depends on:** F1. **Independent:** no.

### Tests first

Extend `CommandDeck.spec.tsx` (do **not** weaken existing S0 cases):

```ts
it('S1 starting chip is session tape · starting… not liveStatus', () => { /* AC-47 */ });
it('S1 playing omits · 1× and prints tape HH:MM:SS ET', () => { /* AC-34 */ });
it('S1 playing prints · 4× when pace is 4', () => { /* AC-34 */ });
it('S1 streamOffline during playing is Session tape stream dropped not live-offline', () => { /* AC-33 */ });
it('S0 streamOffline is still Live offline reconnecting', () => { /* AC-17, AC-33 unset */ });
it('poison live true + session_tape still hollow session tape not ● live', () => { /* AC-31 */ });
it('not-this-ticker chip names the armed identity', () => { /* AC-29 */ });
it('ended chip is session tape ended not live-offline', () => { /* AC-32 */ });
it('gap chip only when standing is gap', () => { /* AC-40 */ });
```

Last-trade: S1 + print → `○ Last trade $X` (hollow, not `info.main` `●`); S1 no print →
`Last trade — no tape print at this tape time`; ended keeps last or that literal — **not**
`⏸ Last trade`; drop uses the **chip** for warning (last-trade may dim, not `⏸`).

### Implement

`connectionChip` — **first** branch on `consumeStanding`. While `session_tape` is present
(including starting / null cursor) **must not** call `liveStatus` and **must not** take
`streamOffline → ⚠ Live offline — reconnecting…`.

Exact §4 text (TintChip `dot` = `○`, `pulse` = false, tone `neutral` for starting/playing,
`warning` + icon for gap/ended/drop/fault). Warning phases: keep `⚠` in drop/fault strings
**and** pass `tone: 'warning'` (existing TintChip uses `t.palette.warning.main` — no hardcoded
hex, no new keyframe). Optional leading MUI `WarningAmber` (or existing warning icon used
elsewhere) for warning tones — **icon always** on warning; never brand amber alone; never
success/error direction green/red for replay health.

Playing text:
`session tape · {SYM} · {humanSessionDate(et_date)} · tape {HH:MM:SS} ET`
+ ` · {n}×` only when `pace` is 4 or 10. `{SYM}` is route symbol when it matches; not-this-ticker
uses `{ARMED_SYM}` and text
`session tape · {ARMED_SYM} · {humanSessionDate} · not this ticker`.

Starting: `session tape · starting…` (null cursor, including empty Path-A before a stamp).

393px overflow (leftover visual may finish in F4): if the playing chip would overflow, drop
tape-time first, then speed; **never** drop `session tape` or the date. Never substitute wall
clock.

Headline / sticky price: use `displayActive` for tape `mid`, **not** `genuineIsLive`.
`TickerDashboard` today:

```
const { live, streamOffline, isLive } = useLiveTape();
```

Change to pass `isLive={genuineIsLive(...)}` into orders/portfolio and
`displayActive` into CommandDeck/TickerHeader for the `$price` slot. Flash-on-change of
headline mid: `displayActive && !streamOffline` (real prints); keep-alive occupancy does
not change last-trade/`mid` (server does not `apply_event` on occupancy-only) so flash
stays a data signal.

`LAST_TRADE_TOOLTIP` while S1: SPEC last-trade replay tooltip (replaces `LAST_TRADE_TOOLTIP`).
S0 still uses the shipped tooltip.

`liveDotPulse` only when `genuineIsLive` (already `pulse` on `●` + `info`). S1 `pulse` false.

Do **not** reuse `⚠ Live marks paused — …` for starting/ended/keep-alive/gap/drop/fault.

Run `CommandDeck.spec.tsx` + last-trade tests. Expect PASS. `$LASTEXITCODE` 0.

Commit: `feat(dashboard): session-tape ticker chip and last-trade states`

**Reviewer probes:** existing S0 `connectionChip` tests still assert `⚠ Live offline —
reconnecting…` and `● live`; S1 never calls `liveStatus`; 1× omits ` · 1×`.

---

## F3 — LiveTape widget, net-flow, gamma flip

**Files:**

- `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx`
- `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.spec.tsx`
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts`

**Depends on:** F1, F2. **Independent:** no.

### Tests first

Extend `LiveTape.spec.tsx`:

```ts
it('S1 title is Session tape from first session_tape payload including starting', () => { /* AC-31, AC-47 */ });
it('S1 does not use LIVE_TAPE_SUBTITLE_LIVE or OFFLINE', () => { /* AC-31 */ });
it('S1 gamma flip label never appends (live)', () => { /* AC-31 */ });
it('S1 1× net-flow keeps (5m) and last-few-minutes ⓘ', () => { /* AC-35 */ });
it('S1 4× net-flow is Net flow with no (Nm) and no last few minutes', () => { /* AC-35 */ });
it('S1 ended subtitle is Session tape ended · last tape ticks · structure levels stay snapshot', () => {});
it('S1 drop does not show ⏸ offline', () => { /* AC-33 */ });
it('display-active moves numbers; keep-alive does not flash', () => { /* AC-41 */ });
it('S0 title Live tape and LIVE_TAPE_SUBTITLE_* still exist when occupancy omitted', () => { /* AC-17 */ });
```

Hollow “renders without throw” does **not** satisfy AC-31/35.

### Implement

When `sessionTapeOf(live)` is present:

- `title="Session tape"` (including starting). Do **not** wait for a new SSE-wait product
  (S2 Important 3).
- Subtitle playing/keep-alive/gap/starting:
  `Session day tape · {SYM} · {humanSessionDate} · not a live feed`
  Not-the-armed-day: name the **armed** identity and that this ticker is not that day.
  Ended: `Session tape ended · last tape ticks · structure levels stay snapshot`.
- ⓘ SPEC Path-A sentence. Gamma flip label: `Gamma flip` — never `(live)`.
- Numbers: follow tape when `displayActive`; tiles keep last numbers or `—`; no fabricated `$0`.
- `offline` / `⏸ offline` / `LIVE_TAPE_SUBTITLE_OFFLINE` **must not fire** for starting, end,
  drop, or fault. Drop may dim numbers — not `⏸ offline`.
- `Widget` `live={false}` while session tape (no `widgetLivePulse`).
- Flash: `useFlashOnChange(..., { active: displayActive })` on real prints only.
- Net-flow: pace 1 → shipped `Net flow (${round(flow_window_s/60)}m)` + S1 1× ⓘ. Pace 4 or 10
  → label `Net flow` with **no** `(Nm)`; ⓘ does not claim tape minutes (SPEC §4 table).
  Not-the-armed-day at 4×/10×: same no-`(Nm)` rule.

S0 (`session_tape` omitted): existing title/subtitle/labels/ⓘ **byte-identical**.

Structure widgets + FreshnessLine stay snapshot language (`Structure as-of …`). Do not retitle
them live. Honest structure-unavailable when Path-B empty (bundle absent). Last snapshot
remains behind ended/drop/fault.

Commit: `feat(dashboard): session-tape LiveTape copy and net-flow honesty`

**Reviewer probes:** 4× fixture has no `Net flow (5m)` and no “last few minutes”; S0 spec still
asserts `Live tape`; no new keyframes (`single-motion-moment.spec.ts` still green).

---

## F4 — Closer: leftover visual/serve states

**Files:**

- `apps/dashboard/src/app/features/trading/orders/engine.ts`
- `apps/dashboard/src/app/pages/positions/PositionsPage.tsx`
- `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx` (orderPlan `liveMid` only when genuine isLive)
- `apps/dashboard/src/app/day-replay-mock-adapter.spec.tsx` (**create** — one S1 fixture pass)
- `apps/dashboard/src/app/day-replay-mock-adapter.structural.spec.ts` (**create**)
- `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts` (393px helper if not done in F2)

**Depends on:** F1, F2, F3. **Independent:** no.

F4 is the **only** frontend closer. It does **not** re-implement chip/LiveTape worker paths.
It owns leftover visual/serve states: fills/marks, 393px truncation, structural absence,
typecheck, dashboard serve smoke.

### Tests first

One S1 fixture pass covering starting / playing / ended / drop (`streamOffline` + last phase
`playing`) / gap-when-vouched / poison `live: true` + session-tape — banned interpolations
absent, `isLive` false, no fills, no live pulse, end ≠ live-offline, loading ≠ S0 liveStatus,
payload-gap ≠ live-offline, 1× omits ` · 1×`, 4× prints ` · 4×`, 4× net-flow has no `(5m)` /
“last few minutes”, no completeness words. S0 fixture asserts shipped live strings still
exist when occupancy is omitted.

`evaluateOrder` / `tickFromLive`:

```ts
it('session_tape + live true does not fill', () => {
  const t = tickFromLive({ mid: 300, live: true, session_tape: playingOcc } as LiveUpdate, false, 1);
  expect(t.isLive).toBe(false);
  expect(evaluateOrder(order(), t)).toBeNull();
});
```

Structural:

```ts
const FORBIDDEN = ['/_ops/replay', 'replay Start', 'in-page date picker'] as const;
// trader product sources (exclude *.spec.*): zero hits
// app.tsx routes: no /_ops/replay
// OperatorMetrics STAGES set-equality unchanged
// liveDotPulse / widgetLivePulse not passed live during session tape (scan S1 fixtures)
```

393px: playing chip at 393px drops tape-time before speed; always keeps `session tape` and the
date.

### Implement

`tickFromLive` must use `genuineIsLive(live as LiveUpdate, streamOffline)` (needs the occupancy
object on the pick type — extend the Pick to include optional `session_tape`).

`PositionsPage.tsx` currently `const isLive = (live?.live ?? false) && !streamOffline` — switch
to `genuineIsLive`.

`TickerDashboard` `orderPlan.liveMid`: genuine isLive only (null while S1).

393px helper: measure with 11px font (chip `fontSize: 11`). Tests can assert the string
function (`formatPlayingChipText({..., maxPx: 393 })`) rather than a visual browser.

Do **not** amend `DESIGN_SYSTEM.md`. Bind `extrasFor` / existing `warning.*` / `elevationFor`
e1–e2. `useReducedMotion` still freezes pulse (already false on replay) and flash.

Run:

```
npx nx test @convexa/dashboard --testFile=day-replay-mock-adapter.spec.tsx
npx nx test @convexa/dashboard --testFile=day-replay-mock-adapter.structural.spec.ts
npx nx test @convexa/dashboard --testFile=engine.spec.ts
npx nx test @convexa/dashboard --testFile=CommandDeck.spec.tsx
npx nx test @convexa/dashboard --testFile=LiveTape.spec.tsx
npx nx typecheck @convexa/dashboard
```

All exit 0. Check `$LASTEXITCODE`. Do **not** run bare `nx format:write`. Scope Prettier:

```
npx nx format:write --files apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts,apps/dashboard/src/app/day-replay-mock-adapter.spec.tsx,apps/dashboard/src/app/day-replay-mock-adapter.structural.spec.ts
```

Serve smoke (leftover visual/serve):

```
npm run ports:free
npx nx serve @convexa/dashboard
```

`:4200` comes up. Do **not** claim an armed walker on production-profile. S0 `/ticker/SPY`
still shows today’s live chrome against unset `serve`.

Commit: `test(dashboard): day-replay-mock-adapter S1 fixture and structural absence`

**Reviewer probes:** closer does not rewrite `connectionChip` / `LiveTape` product logic except
fill gates + 393px + structural spec. No `/_ops/replay` route. Typecheck green (Vitest is not
enough).

---

## Independence

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B1 | backend | `apps/api/src/services/day_tape/replay_occupancy.rs`; `apps/api/src/services/day_tape/replay_timeline.rs`; `apps/api/src/services/day_tape/player.rs`; `apps/api/src/services/day_tape/construct.rs`; `apps/api/src/services/day_tape/clocks.rs`; `apps/api/src/services/day_tape/mod.rs`; `apps/api/src/services/market_data/mod.rs`; `apps/api/src/services/session_chain_archive/coverage.rs`; `apps/api/src/routes/research_session_books.rs`; `apps/api/src/routes/research_chain_snapshots.rs`; `apps/api/src/db/pg_session_chain_archive.rs`; `apps/api/src/db/pg_chain_snapshot.rs` | — | no |
| B2 | backend | `apps/api/src/services/day_tape/player.rs` | B1 | yes |
| B3 | backend | `apps/api/src/services/day_tape/construct.rs`; `apps/api/src/state.rs`; `apps/api/src/server.rs`; `apps/api/src/main.rs` | B1 | yes |
| B4 | backend | `apps/api/src/routes/stream.rs` | B3 | yes |
| B5 | backend | `apps/api/src/services/analytics.rs` | B3 | yes |
| B6 | backend | `apps/api/openapi/convexa.openapi.json`; `apps/api/openapi/parity-coverage.json`; `apps/api/openapi/generated-artifacts.manifest.json`; `libs/api/src/generated/schema.ts` | B4 | no |
| B7 | backend | `apps/api/tests/session_day_replay.rs`; `apps/api/tests/session_day_replay_isolation.rs` | B2, B3, B4, B5, B6 | no |
| B8 | backend | `.spire/clusters/tech/contracts/day-replay-mock-adapter/conformance-receipt.json` | B1, B2, B3, B4, B5, B6, B7 | no |
| F1 | frontend | `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts`; `apps/dashboard/src/app/pages/ticker/liveTapeStore.ts`; `apps/dashboard/src/app/pages/ticker/useTickerStream.ts` | — | no |
| F2 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts`; `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx` | F1 | no |
| F3 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.spec.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts` | F1, F2 | no |
| F4 | frontend | `apps/dashboard/src/app/features/trading/orders/engine.ts`; `apps/dashboard/src/app/pages/positions/PositionsPage.tsx`; `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx`; `apps/dashboard/src/app/day-replay-mock-adapter.spec.tsx`; `apps/dashboard/src/app/day-replay-mock-adapter.structural.spec.ts` | F1, F2, F3 | no |

B8 is the **only** backend closer. F4 is the **only** frontend closer. Closers do not
re-implement worker paths.

Independent-yes path check (backend): B2 `player.rs`, B3 `construct.rs`+`state.rs`+`server.rs`+`main.rs`,
B4 `stream.rs`, B5 `analytics.rs` share no equal/prefix write path. B1 created `player.rs` /
`construct.rs` as type/predicate shells; B2/B3 fill them after B1 (B1 is `no`). Frontend has
no `Independent: yes` row (SPEC §4 names no files).

---

# Verification track

Run after B8 + F4. Check `$LASTEXITCODE` after **every** command.

### V1 — Unit / integration suite

```
cargo test -p api-rust -p quant-engine --locked
```

**Expect:** exit 0. New filters green: `services::day_tape::player`, `services::day_tape::construct`,
`routes::stream` occupancy tests, `--test session_day_replay`, `--test session_day_replay_isolation`.
Existing `session_day_tape_*`, `session_chain_archive`, `archive_coverage`, `api_contract_*`,
score-identity tests still pass. `quant-engine` product diff empty.

### V2 — Postgres compile

```
cargo check -p api-rust --features postgres
```

**Expect:** exit 0 (`SessionTape` pg mappings compile).

### V3 — Named CLI (local evidence, refuse-before-bind)

```
cargo run -p api-rust --locked -- session-day-replay --help
```

**Expect:** exit 0. Help lists `session-day-replay`, `--symbol`, `--et-date`, `--pace`.

```
cargo run -p api-rust --locked -- session-day-replay --symbol NVDA --et-date 2020-01-02
```

**Expect:** non-zero. Standing block first. `not in tape watchlist: NVDA`. No HTTP bind.
Must succeed without treating this process as a ticker.

```
cargo run -p api-rust --locked -- session-day-replay --symbol SPY --et-date 2026-08-10 --pace 60
```

**Expect:** non-zero, refuse before bind, does **not** run 1×.

### V4 — OpenAPI / generated client

```
npm run api:contract:check
```

**Expect:** `API contract check passed: generated artifacts match the Rust API contract.`
Operation count **55**. `LiveUpdateBody` has optional `session_tape`. `convexa.ts` has no
`/_ops/replay` helper.

### V5 — Frontend tests + typecheck

```
npx nx test @convexa/dashboard --testFile=day-replay-mock-adapter.spec.tsx
npx nx test @convexa/dashboard --testFile=day-replay-mock-adapter.structural.spec.ts
npx nx test @convexa/dashboard --testFile=sessionTapeStanding.spec.ts
npx nx test @convexa/dashboard --testFile=CommandDeck.spec.tsx
npx nx test @convexa/dashboard --testFile=LiveTape.spec.tsx
npx nx typecheck @convexa/dashboard
```

**Expect:** all exit 0. S0 live strings still asserted. S1 banned interpolations absent.
Structural: no `/_ops/replay`. Typecheck required (Vitest does not typecheck).

### V6 — Unset serve + live HTTP conformance

```
npm run ports:free
cargo run -p api-rust --features postgres -- serve
```

**Expect:** listener `:8000`. Then:

```
node .grok/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/day-replay-mock-adapter/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/day-replay-mock-adapter/conformance-receipt.json
```

**Expect:** `verdict: PASS`, `summary.total` 5, NVDA list/load 200, `et_date=not-a-date` 422,
session-books re-pins. Do **not** hang `GET /api/stream/{ticker}` as a 200 JSON probe.

Receipt NUL count 0.

### V7 — GATE Q hermetic (QA owns the report; this is the command list)

Re-run B7 planted walk + isolation + F4 S1 fixture. GATE Q must show **both** a rejecting
path and an accepting planted walk. Assert armed sample `data:` JSON: `live` is JSON
`false` (typespec is `boolean` only — value assert is hermetic). Unset sample **omits**
`session_tape`. Client payload-gap during playing classifies drop, not live-offline.

**Not required:** hosted “we walked every Tuesday”; live G1 against an armed walker on
production-profile; a new e2e DOM tier.

### V8 — Structural scans (also in B7/F4; re-pin here)

```
rg -n "/_ops/replay" apps/dashboard/src --glob '!*.spec.*'
rg -n "insert_if_absent|path_a::spawn|warmer::spawn" apps/api/src/services/day_tape/player.rs apps/api/src/services/day_tape/construct.rs
```

**Expect:** no product `/_ops/replay`; player/construct have no those tokens (split-token
tests remain the non-vacuous oracle). Pages 404 `_research` / `_metrics` unchanged.

---

## AC coverage (not one-test-per-AC)

| ACs | Where |
|---|---|
| 1–9, 14, 16, 46 clock / Path-B / empty | B2 + B7 planted walk |
| 4, 15, 19, 42, 45 refuse before bind / CLI | B3 + B7 + V3 |
| 10–13, 17, 29, 44, 47 occupancy / drop / S0 | B4 + F1/F2 + B7 |
| 8, 9, 20, 21, 23, 24, 28 Massive / coverage / score | B5 + B1 discriminant + B7 |
| 22, 25, 30 isolation / secrets | B7 |
| 26, 27 tape read / Pages | existing research tests + B7 read-only scan + V6 |
| 31–36, 40, 41, 47 S1 copy/fills (test) | F2, F3, F4 fixture |
| 37, 38, 39, 43 review | F4 structural + SPEC §4 adherence (no second token table, no scrubber, no new keyframes) |
| 18 Massive-down unset | B7: unset construct + no auto-walk (source + `serve` poison) |

---

## Out of scope (do not implement)

Pause/resume, skip, reverse, free-form speed, in-ticker date picker, 60×, runtime re-arm,
walking more than one name, watchlist expansion, S3 flat files, hist-chain, `/_ops/replay`,
HTTP Start/Stop, Fixture-as-clock, `MarketDataPort::Replay`, tape-time net-flow accumulator,
completeness % on the ticker, batch-backtest / score-lab changes, NYSE holiday calendar.
