# R1 — architect position: day-replay-mock-adapter

## Position

Play a stored `(symbol, et_date)` session-day tape through the **existing ticker live bus**, as a **clocked exclusive publisher**, not as a third vendor port and not as a frozen sample.

Fixture, batch-backtest, and the capacity harness are **not** this replay. Verified:

- `MarketDataPort::{Live, Fixture}` in `apps/api/src/services/market_data/mod.rs` — `resolve` returns **one** `VendorBundle`. Fixture picks the nearest frozen sample with `as_of ≤ t` (`fixture.rs`); Live ignores `as_of` and fetches now. That is a snapshot resolver, not a day clock.
- `batch-backtest` calls `compute_analytics_from_vendor` on `ChainSnapshotStore` books with zero hub emit and zero SSE.
- `AppState::for_capacity_harness` (`state.rs`) sets `vendor_fixture = Some`, `StockStreamHub::harness_local()`, never `stock_worker.start()`, `day_tape` disabled. Replay must keep `vendor_fixture = None` and **read the tape**.

### Binding constraints (restated)

- **`present-is-live-paid-only` (HARD)** — a replayed tape is never a loadable `LiveMassive` session book. Mechanism: replay never calls `insert_if_absent` / ensure / `spawn_capture`. Path-B persist already strips source (`day_tape/fs.rs::prepare_path_b_body` + `body_carries_live_massive`). Rehydrate must not put `LiveMassive` back on the bundle. Occupancy stays tape axes (`AxisA` / Path-A / Path-B in `occupancy.rs`), never coverage `present`.
- **`operator-vs-trader-path-separation`** — `GET /api/_research/session-day-tape/{symbol}` and `/day` stay the operator read (token-gated, zero Massive). Replay **may** feed the existing ticker SSE (`routes/stream.rs` on `stock_hub.subscribe_events`) so the desk can walk the day. That consume path must not claim the feed is live Massive. Operator arm/start is not a trader-route side effect.
- **`live-vs-static-isolation`** — Path-A ticks are clocked, live-derived-from-tape. Path-B structure is static-at-mark. End-of-tape / player drop degrades like an SSE gap (recency ages out); last Path-B snapshot remains. Recency of ticks is **not** paid-live provenance.
- **`best-effort-isolated-or-null`** — replay fault never 5xx the desk’s live path. Missing/unreadable tape refuses the **player start** with occupancy; it does not fabricate ticks and does not take down production `serve`.
- **`additive-keeps-score-byte-identical`** — replay does not change the scoring formula. Path-B marks run existing `compute_analytics_from_vendor` (`analytics.rs`) on stored vendor bodies. `Authorizes: nothing`. `iv_store` is **not** passed (no Tuesday samples into today’s IV rank).
- **`production-fails-closed`** — production construct does not silently become replay. Unset arm ⇒ Massive hub worker starts (`server.rs` `stock_worker.start()` after listener bind) and `vendor_fixture` stays `None` (`assert_no_production_fixture`). Replay is an **explicit exclusive construct**.
- **`absent-is-not-none`** — no tape ≠ empty tape ≠ live Massive. Reuse `AxisA::{NoIdentity, NotStoring, Unreadable, StoringReady}` and Path-A `EmptyWhileStoring` vs `Occupied`. Do not collapse at the player boundary.
- **`single-ticker-on-demand`** — one armed `(symbol, et_date)` per replay process. Request path still computes the one ticker asked for. Not a three-name sweep because the watchlist has three members.
- **`structural-over-prose-enforcement`** — poison what the rule forbids and the build goes red (non-vacuous). Named poisons below.
- **`cited-code-is-verified-not-assumed`** — citations below were read at source. Unverifiable claims are marked.
- **`no-secrets-in-image`** — arm/config at runtime via env; tape Path-B already secret-asserts. No baked keys.
- **`local-evidence-is-not-hosted-evidence`** — a local replay walk is not hosted/CI evidence.
- **Massive license** — stored ticks are our research (`day_tape/literals.rs` `LICENSE`). Emitting them on the ticker bus is playback of **our tape**, never redistribution as a live vendor feed.

### Council locks — technical shape

#### 1. Replay arm, not a new `MarketDataPort` kind

**Chosen: sibling exclusive construct + one-way player leaf. `MarketDataPort` stays `{Live, Fixture}`.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| **A. Exclusive construct + player** (chosen) | Low–med | New construct beside capacity harness | One identity | **High** (`harness_local` / `publish_event` / tape `load`) |
| B. `MarketDataPort::Replay` | Wrong shape | `resolve()` is one snapshot | Invites silent production swap | Low |
| C. Load tape into `FixtureCatalog` | Lie | Collapses a day to nearest `as_of` | — | High but false |
| D. Hot-switch inside production `serve` | High | Halt WS + warmer + Path-A sidecar at runtime | Mix live+tape | Low |

Decisive axes: **`production-fails-closed` + team familiarity**, then complexity under effort M.

`MarketDataPort::resolve` cannot play a day. Fixture already *is* “frozen `VendorBundle` at `as_of`”. Putting replay there would make “walk Tuesday” a nearest-sample lookup — the failure the BRIEF names.

Replay construct (named so it cannot be mistaken for production `AppState::new` / `new_production` or `for_capacity_harness`):

- `StockStreamHub::harness_local()`; **never** `stock_worker.start()`.
- `vendor_fixture = None` (same production fence; tape is not a fixture catalog).
- `SessionDayTape` enabled so `load` works; **do not** `path_a::spawn`, **do not** `warmer::spawn`, **do not** ensure-worker Massive fetch for the armed name, **do not** scanner.
- Sole publisher: player task calling `publish_event`.

Production `server.rs` after bind still does `stock_worker.start()` + `path_a::spawn` + warmer + ensure when the replay arm is **unset**. That is the fails-closed default.

#### 2. Original timestamps and speed multiplier are one scheduler

**Chosen: one inter-arrival sleeper.** Delay until next timeline item = `(t_next − t_prev) / k` on a Tokio clock. Emit the **stored** `ts_ns` on the `StreamEvent`. `k = 1` **is** original cadence. Faster play is the same mechanism with a **closed integer** `k ≥ 1`, not a second clock.

| Option | Complexity | Cost | Familiarity | Verdict |
| --- | --- | --- | --- | --- |
| **A. Δt/k sleeper, stored stamps on the event** | Low | One task | High | **Chosen** |
| B. Burst all ticks now, original `ts_ns` only on payload | None | Not a clock | — | Reject |
| C. Separate “real-time” and “speed” subsystems | Extra states | — | — | Reject |

`k` is a product dial (see assumptions). Unbounded `k` would dump 79 Path-B `compute_analytics_from_vendor` calls in a tight loop (marks are 09:30…16:00 ET step 5 min — 79 entries, `clocks.rs::path_b_marks`). Closed `k` is the cost governor.

Two clocks, not one:

- **Tape cursor** — schedules Path-A emits and Path-B mark fires; drives session-phase classification (see isolation).
- **Wall receive** — `apply_event` in `routes/stream.rs` already stamps `last_tick_wall = Utc::now()`. Keep that. Recency (`LIVE_TICK_MAX_AGE_S = 30`) and end-of-tape degrade stay **operator wall time**.

Do not sleep on Path-A gap records (`PathAKind::PathAGap` has no `ts_ns`). Skip emit; occupancy already recorded the gap. Do not invent ticks to fill it.

#### 3. Production construct remains Live Massive when replay unset

Verified production path:

- `AppState` construct sets `vendor_fixture: None` and `assert_no_production_fixture`.
- `compute_analytics` (`analytics.rs`) Massive four-fetch join when `vendor_fixture` is `None`; hardcodes `source: LiveMassive`.
- `server.rs` starts the vendor hub worker.

Unset replay arm ⇒ that path unchanged. Replay construct is a **different constructor**. Poison: production construct source must not grow a silent tape fallback when Massive is down.

#### 4. Missing-tape occupancy

Replay start is a **match on existing derive**, not a new coverage cell.

| `AxisA` / Path-A content (verified `occupancy.rs`) | Player |
| --- | --- |
| `NotInWatchlist` / `IneligibleWeekend` / `NotElapsed` / `NotStoring` / `NoIdentity` / `Unreadable` | **Refuse start.** No ticks, no structure, no archive write. |
| `StoringReady` + Path-A `EmptyWhileStoring` (quiet day with a container) | Start. Emit **zero** Path-A ticks. Emit Path-B only if Path-B `Occupied`. Honest empty ≠ missing. |
| `StoringReady` + `Occupied` | Play stored trades/quotes in time order; skip gap records. |

Watchlist is `TAPE_WATCHLIST = SPY, QQQ, IWM` (`watchlist.rs`) — not `ENSURE_SYMBOLS`.

Unreadable: do not partial-play Path-A lines that happened to parse (`DayContainer.unreadable_reason`). Refuse the day.

#### 5. Same hub, not a second socket

**Chosen: the existing in-process `StockStreamHub` broadcast.** Ticker SSE already does `state.stock_hub.subscribe_events()` (`routes/stream.rs` `stream_ticker` / `stream_prices`). Capacity harness already proves `harness_local` + `publish_event` reaches that bus (`ws.rs` `harness_publish_reaches_subscribers`).

A second Massive WebSocket is forbidden (license, no vendor fetch, second live path). A second in-process hub that the ticker page must also subscribe is a second live UI path — reject.

**Exclusive publisher is load-bearing.** `path_a::spawn` is a sidecar on the **same** hub (`recv_loop` → JSONL). If replay `publish_event`s onto a production hub that still has capture + Massive `connection_loop`, Tuesday’s ticks are re-appended as **today’s** tape and mixed with live prints. Mechanism that prevents it: replay construct does not start the vendor worker and does not spawn Path-A capture / Path-B persist (`maybe_spawn_persist` rides `refresh_analytics`). One producer.

`LiveCapacity::admit_and_subscribe` still admits SSE clients onto the hub. `harness_local` subscribe updates the symbol set and does **not** enqueue vendor `HubCmd` (`emit_hub_cmd: false`). Keep that.

#### 6. Path-B structure emit, not a frozen Fixture snapshot

**Chosen: at each stored 5-minute mark, decode that mark’s body → `VendorBundle` → `compute_analytics_from_vendor` → process `ReplayHold`.**

Not `FixtureCatalog.resolve(symbol, Some(cursor))` — nearest frozen sample, one book, not 79 marks.

Not interpolation between marks — that invents structure; `Authorizes: nothing`.

Not `refresh_analytics` — that Massive-fetches and `maybe_spawn_persist`s.

Ticker consume already peeks `gex_cache` for live flip (`stream.rs`) and REST `load_or_compute` returns cache hits without vendor I/O. **Problem (verified):** `GexCache` TTL is ~10–20s (`state.rs`); Path-B marks are 5 minutes apart; live relies on the warmer to re-fetch. Replay has no warmer. Mechanism: **`ReplayHold`** — a process slot for the armed symbol’s current `AnalyticsSnapshot`. `load_or_compute` and the SSE flip peek consult `ReplayHold` **before** TTL-gated `gex_cache`. Player replaces the slot at stored marks. Empty slot before 09:30 is **absent** (ticks may already be flowing; structure is not fabricated). Between marks the same snapshot holds — that matches “static at mark”.

Path-B decode cannot be naive `deserialize_capture`: `prepare_path_b_body` **removes** `source`, and `ChainSnapshotWire.source` is a **required** `MarketDataSourceKind` (`chain_snapshot/wire.rs`). Replay uses a **tape-owned decode** that rebuilds market/bars/trades/`as_of` for `compute_analytics_from_vendor` and **does not default source to `LiveMassive` or `Fixture`**.

`MarketDataSourceKind` today is only `LiveMassive | Fixture`. Rehydrate needs a **third source-kind arm on the bundle** (a discriminant, **not** a third `MarketDataPort` variant) so archive/coverage cannot count the occupant as `present`. Session-archive `insert_if_absent` is still unreachable from the player (poison).

### Data-structure content

Playback unit = existing `DayContainer` (`store.rs`): `path_a: Vec<PathARecord>`, `path_b: Vec<PathBSnapshot>`, arm intervals, optional `unreadable_reason`. Identity = locked watchlist symbol + ET `YYYY-MM-DD`.

Path-A record kinds: `Trade` | `Quote` | `PathAGap`. Inverse of `path_a.rs::record_from_event` (no inverse exists today — player adds it). Output is existing `StreamEvent` (`domain/price.rs`: symbol, kind, `ts_ns`, price/size, bid/ask/sizes). `StreamEvent` has **no** provenance field; do not invent one in this lane. Provenance is process occupancy + honest consume (PM/UX).

Path-B snapshot: `(mark: (u32,u32), as_of, body: Vec<u8>)`. Body is capture-wire bytes with source stripped. Decode → `VendorBundle` with tape source-kind → engine.

`ReplayHold`: at most one `(symbol, et_date, snapshot, cursor)`. Not a catalog. Not `vendor_fixture`.

Timeline: merge Path-A records that have `ts_ns` with Path-B marks converted to that mark’s ET timestamp on `et_date`. Sort by time. One player task walks it.

### Data-flow + component boundaries

```
operator explicit replay construct (not production AppState::new)
    → SessionDayTape::load(symbol, et_date)     // existing, zero Massive
    → derive_axis_a / derive_path_a / derive_path_b
    → refuse (occupancy) | DayContainer
    → player task (new one-way leaf under day_tape/)
         Path-A Trade/Quote → StreamEvent → hub.publish_event
         Path-A Gap         → skip emit
         Path-B mark        → tape decode → compute_analytics_from_vendor
                            → ReplayHold.replace (iv_store = None)
existing ticker SSE (routes/stream.rs)
    → subscribe_events → apply_event → PriceCache.set_price
    → peek ReplayHold (then gex_cache) for flip
existing ticker REST
    → load_or_compute: ReplayHold hit first; never compute_analytics Massive four-fetch
_research list/load
    → unchanged operator read; not the clock
quant-engine / signals
    → untouched; only compute_analytics_from_vendor
```

`quant-engine` does not import the player. Score/tier/fingerprint modules do not import the player. Player may call `compute_analytics_from_vendor` (already the live **and** research Path-B entry).

### Isolation / error rules

| Failure | Observable result |
| --- | --- |
| Occupancy not playable | Player never starts; hub silent; no fabricated day; production `serve` (if running separately) untouched |
| Path-B body unreadable at one mark | Skip that mark (gap already representable as missing snapshot); do not stop Path-A; do not Massive-fill |
| Player task panic / hub closed | SSE existing `RecvError::Closed` / lagged handling; `ReplayHold` last snapshot stays; no 5xx minted by the player |
| End of timeline | Stop publish; do not loop; wall recency ages past 30s → existing not-live-recency; structure remains |
| Cache miss on ticker REST during replay | `ReplayHold` or absent structure — **never** `compute_analytics` Massive join |
| `gex_cache` TTL expiry | Irrelevant while `ReplayHold` is the structure source |
| Path-A capture / persist accidentally spawned | Poison — must be compile/test red; would corrupt today’s tape |

**Session classifier (load-bearing):** `routes/stream.rs::market_session` reads **`Utc::now()`** America/New_York, not `ev.ts_ns`. Replay of a weekday on a weekend wall clock classifies `closed`. Mechanism: inject the tape cursor into that classifier for the replay construct (default remains wall clock on production serve). Recency (`last_tick_wall`) stays wall clock so end-of-tape still degrades in 30s of operator time.

**Net-flow window** is wall 300s inside `apply_event`. At `k > 1` it compresses tape time. v1 does **not** add a tape-time flow accumulator (complexity). `k = 1` preserves it; faster `k` is a known compression.

**Recency ≠ paid-live:** `live` on the existing SSE envelope is `tick_age < 30s` wall. Replay ticks **will** satisfy recency. That boolean cannot carry `present-is-live-paid-only`. Architect does not add a wire field; PM/UX must not treat recency-true as Massive-live.

### Structural poisons (non-vacuous)

1. Player / replay-construct production sources contain `insert_if_absent`, `archive_session_best_effort`, `spawn_capture` — build red (same token-split style as `day_tape/mod.rs` poison tests).
2. `AppState::new` / `new_production` / `server.rs` worker-start path still starts `stock_worker` and does **not** start the player when arm unset — source assertion.
3. Replay construct: `vendor_fixture.is_none()`; `body_carries_live_massive` false on every rehydrated Path-B body.
4. `MarketDataPort` enum remains two arms (`Live`, `Fixture`) — adding `Replay` fails a pin test.
5. While `ReplayHold` is armed, `compute_analytics` Massive four-fetch is unreachable (unit: client not called).
6. Replay construct does not call `path_a::spawn` / `warmer::spawn`.

### Explicit non-goals

- Fetch Massive, download S3, or any new vendor product.
- Change opportunity score / tier / fingerprint / gate (`Authorizes: nothing`).
- Insert tape as `LiveMassive` or occupy coverage `present`.
- A second live UI path, second SSE, or second Massive socket.
- Treating `MarketDataPort::Fixture`, batch-backtest, or capacity harness as this clock.
- Interpolating Path-B between 5-minute marks.
- Fabricating ticks for missing / unreadable / empty-while-storing.
- Looping the day.
- Multi-symbol simultaneous replay in one process.
- Hot-swap live+replay publishers on production `serve` (unless PM falsifies exclusive-construct).
- Writing IV-rank samples, ring snapshots, or session books from playback.
- Redistributing tape as a live vendor feed.

## Risks I see

1. **Capture sidecar on the same hub.** If anyone “simplifies” by arming replay inside production `serve` without parking `path_a::spawn` and the vendor worker, Tuesday is mixed into today’s tape. Exclusive construct is the fence; runtime hot-switch is the expensive version of the same fence.
2. **`gex_cache` TTL vs 5-minute marks.** Without `ReplayHold`, REST/`peek` miss after ~20s and `compute_analytics` Massive-fetches, overwriting Tuesday structure. The hold is not optional.
3. **Stripped Path-B `source` vs `deserialize_capture`.** Convenience default to `Fixture` or `LiveMassive` would violate `present-is-live-paid-only` / live-vs-static in one line. Tape-owned decode is mandatory.
4. **Wall-clock `market_session`.** Unfixed, weekend-wall replay of RTH prints `closed`. Clock injection is the mechanism; leaving it is a known false classifier.
5. **Recency bit reads as live.** Existing SSE recency will be true while ticks flow. If PM/UX do not separate provenance from recency, the desk is shown a paid-live lie.
6. **`k > 1` flow compression** and Path-B compute burst. Closed `k` is the governor; 1x is the honest walk.
7. **Quiet-day vs missing-day collapse** at a UI or API boundary — occupancy types already distinguish; a consumer that branches on “zero ticks” only will fabricate “no Tuesday”.

## Assumptions I'm making about the other two lanes

- **PM** accepts a **sibling exclusive construct** (not a hot-switch on production `serve`). If they require the Railway production process to flip Massive→tape without restart, exclusive-publisher interlocks (stop vendor worker, park Path-A capture, park warmer, fence `compute_analytics`) become in-scope and my “production constructor unchanged” claim is false.
- **PM** locks **one** `(symbol, et_date)` per replay process from `TAPE_WATCHLIST`. Walking QQQ after SPY is a second arm, not an in-request three-name sweep.
- **PM** treats original cadence and speed as **one** scheduler with closed integer `k` including `1`. I assume the set `{1, 5, 10, 60}` unless they lock `1` only; if they want a free-float multiplier, Path-B burst has no governor.
- **PM** accepts occupancy refusal for `NoIdentity` / `Unreadable` / `NotStoring` and zero-tick playback for `EmptyWhileStoring` — they will not require a synthesized day.
- **PM** will not treat SSE recency-true as live Massive; they will require a closed provenance vocabulary **distinct from recency** (their contract, not a `StreamEvent` field I invent). If they refuse that, `present-is-live-paid-only` is copy-only and will fail.
- **PM** does not require Path-B structure between stored 5-minute marks, and does not require looping at end-of-tape.
- **PM** keeps score/tier/fingerprint on the live formula over stored Path-B inputs (`Authorizes: nothing`).
- **UX** owns all copy; internal names (`AxisA`, `ReplayHold`, `LiveMassive`, `Fixture`) never appear as trader chrome.
- **UX** will not add a second live socket or ticker path; the existing ticker SSE is the consume surface.
- **UX** will map missing / unreadable / empty-while-storing / recording / end-of-tape to **distinct** non-fabricating presentations (`absent-is-not-none`), and will never label replay `live` / `live_massive`.
- **UX** accepts tape-cursor session phase (so Tuesday RTH does not render as weekend-closed). If they reject clock injection, I withdraw the “honest session classifier under replay” claim.
- **UX** will not ask Path-A trades to refresh Path-B structure; structure moves only at stored marks.
