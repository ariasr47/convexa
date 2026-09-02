# day-replay-mock-adapter — spec

**Source brief:** .spire/clusters/tech/contracts/day-replay-mock-adapter/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-30

## 1. Goal + scope

Play one named locked-watchlist **session day** for SPY / QQQ / IWM through the **same ticker live path** the desk already uses, so a cancelled Massive feed does not leave Tuesday as a frozen snapshot. Capture already stores Path-A trades+quotes and Path-B 5-minute structure. `MarketDataPort::Fixture` is a nearest frozen `VendorBundle` at `as_of` — **not** this clock. This slice adds an **exclusive replay construct** that emits stored Path-A ticks (and Path-B structure at stored marks) on the existing ticker SSE / price-hub contract at original stamps or a locked speed multiplier. Copy and consume occupancy never occupy live Massive. Production without an explicit replay arm still talks to Massive. The live scoring **formula** runs on replayed inputs (`Authorizes: nothing`).

The buyer is the **research operator walking `/ticker/:symbol` on a research/non-production process**, not a hosted production trader and not a second Replay app.

**In scope:**

- Operator-explicit **process-start** arm of **one** named identity `(SPY|QQQ|IWM, America/New_York YYYY-MM-DD)` that already has a stored tape.
- Clap construct titled `session-day-replay` that binds the existing HTTP/SSE graph with the player as **sole hub publisher**. Identity and pace are construct arguments. No runtime Start/Stop HTTP. No `/_ops/replay`.
- Existing ticker consume path: Path-A in stored time order; Path-B as the clock reaches stored 5-minute marks (09:30…16:00 ET that exist on that tape).
- Clock: start at the earliest stored occupant; end after the last; no loop, reverse, skip, or pause this slice. Default pace **1×**. Closed set **{1×, 4×, 10×}** chosen at arming. 60× is out.
- Consume-visible occupancy on the existing ticker SSE (`ReplayConsumeOccupancy`): basis is not paid-live; envelope `live` forced **false** while armed; identity is the armed pair; tape cursor is the stored stamp; phase `playing` | `gap` | `ended` | `drop` | `fault`. Playing keep-alive is **JSON data** (not SSE comments) on a period **< 15s**. Ended/fault **repeat** as data. Drop ≠ live-offline (unset-arm only). **Vouch occupancy before advertise:** first `playing` keep-alive is in the slot **before** the ticker stream is advertised as live-capable, so S1 loading is not S0 live chrome.
- Honest S1 standing on the **existing** ticker (same TintChip / LiveTape / last-trade slots). S0 (arm unset) copy is **byte-identical to today**.
- Empty stored Path-A **starts** (quiet walk; Path-B may still unfold). Missing / unreadable / not-storing / ineligible weekend / not-elapsed / not-in-watchlist **refuse before bind** (no walker HTTP/SSE; silent hub). Empty ≠ missing.
- Zero vendor I/O for the walked day’s ticks and structure — and **zero Massive four-fetch for any ticker name** while the process is armed. Replay never writes, promotes, or occupies a session-archive identity as a live paid book. Coverage cells stay on the coverage vehicle.
- Live formula on replayed Path-B inputs; `iv_store` is not passed. Score / tier / fingerprint **formula** unchanged.
- Isolation: replay fault does not 5xx the desk; live-derived-from-tape degrades on drop / end / fault; last structure is not blanked because the clock ended.
- Production: unset arm still Massive; **production-profile (`APP_ENV=prod`) plus arm refuses startup**; no silent Massive-down → tape fallback.
- Operator tape **read** remains `GET /api/_research/session-day-tape/*` (token-gated; Pages trader origin still 404s `_research` / `_metrics`). Arming is not a trader-session action.

<!-- spire:council-resolution:v1 f8d325a00d3e1c39b662db63510b87d7c289af5d1f005b83243c9d7a767275cd folded -->
<!-- spire:council-resolution:v1 1a021b3a4cc71cff73776a6a289af64d514f0fc6834d1272adb4f378cb58b8d2 folded -->
<!-- spire:council-resolution:v1 96e2e86fa5d0d81f02e82dc695af38946b4885d5f0da32d97c48290efa0a596a folded -->

**Out of scope:**

- A hidden research-only clock that never feeds the existing ticker.
- A **second live UI path**: lab page, ticker player (play / pause / scrub / skip / reverse / in-page date picker), Settings replay picker, nav item, **`/_ops/replay`**, `/_ops/metrics` Start control.
- HTTP Start/Stop that arms, disarms, or re-identifies the player on a running serve.
- S3 / next-day flat files (`massive-flat-file-keep`); hist-chain; any new paid vendor product.
- Changing live scoring **weights**, tier cutoffs, entry gate, or fingerprint basis.
- Using Fixture / a frozen snapshot / batch-backtest as this clock.
- Inserting tape as `LiveMassive` or coverage `present`; filling coverage holes; starting ensure.
- Auto-switching Massive-down → tape; mixing Massive ticks with tape ticks on the armed identity.
- Arming more than one identity; walking a name outside SPY / QQQ / IWM.
- Runtime live↔replay flip; mid-walk pace change; 60×.
- Redistributing replayed ticks as a live vendor feed on the hosted trader origin.
- A tape-time net-flow accumulator (4×/10× must not claim tape minutes; no second flow clock).
- Printing completeness % / `partial captured day` / full open-to-close on the ticker.
- Batch-backtest / score-lab / replay-outcome-join changes.

**Future (deliberately deferred):**

- Pause / resume, skip-to-mark, reverse, free-form speed, in-ticker date picker.
- Walking more than one locked name at once; watchlist expansion by owner decision.
- S3 flat-file keep (price/quote history, never as live paid).
- Operator lab UI to browse and pick tapes; runtime re-arm without process restart.
- NYSE/exchange-holiday calendar; optional tighter Path-B grain.

## 2. Architecture

Play a stored `(symbol, et_date)` `DayContainer` through the **existing** in-process `StockStreamHub` as a **clocked exclusive publisher**. Not a third `MarketDataPort` kind, not Fixture-at-`as_of`, not batch-backtest, not the capacity harness.

Verified at source (not assumed): `MarketDataPort::{Live, Fixture}` in `apps/api/src/services/market_data/mod.rs` — `resolve` returns one `VendorBundle`; Fixture is nearest frozen sample `as_of ≤ t`. `batch-backtest` calls `compute_analytics_from_vendor` with zero hub emit. Capacity `AppState::for_capacity_harness` sets `vendor_fixture = Some` and `StockStreamHub::harness_local()`, never `stock_worker.start()`. Ticker SSE `apps/api/src/routes/stream.rs` `stream_ticker` subscribes `stock_hub.subscribe_events()`, applies `StreamEvent` into `PriceCache`, and today sets envelope `live` from wall `tick_age < 30s`. Client `isLive = (live?.live ?? false) && !streamOffline` (`liveTapeStore.ts`) gates paid-live chrome and `evaluateOrder` fills. Watchdog `STREAM_OFFLINE_MS = 15_000` resets only on a parsed **data** payload; SSE comments (`heartbeat`, Axum `KeepAlive`) are ignored by EventSource. Shipped `connectionChip` is `streamOffline ? '⚠ Live offline — reconnecting…' : liveStatus(live)` (`TickerHeader.tsx`) — that branch is **unset-arm only** after this slice. Tape list/load: `GET /api/_research/session-day-tape/{symbol}` + `/day` (`routes/research_session_day_tape.rs`); store `services/day_tape/`. Pages `functions/api/[[path]].ts` already 404s `/api/_research` and `/api/_metrics`.

### 2.1 Exclusive construct — not a port kind, not a hot-switch

**Chosen:** sibling exclusive construct + one-way player leaf under `services/day_tape/`. `MarketDataPort` stays `{Live, Fixture}`. `StreamEvent` stays stamp-only (Trade|Quote + `ts_ns`) — no provenance member.

| Option | Verdict |
|---|---|
| **A. Exclusive construct + player** (chosen) | One identity; `harness_local` + `publish_event`; production `serve` unchanged when unset |
| B. `MarketDataPort::Replay` | `resolve()` is one snapshot — the failure the BRIEF names |
| C. Load tape into `FixtureCatalog` | Collapses a day to nearest `as_of` |
| D. Hot-switch inside production `serve` | Halt WS + warmer + Path-A sidecar at runtime; leftover-flag CDN |

Clap **`session-day-replay`** (grep-able; not `serve`, not `session-day-tape`, not `archive-coverage`) is the construct. Required `--symbol` and `--et-date`; optional `--pace` in `{1,4,10}` (omitted ⇒ 1). It binds the existing HTTP/SSE graph **only after occupancy is vouched** (§2.3). It does **not** start `stock_worker`, `path_a::spawn`, warmer, ensure, or scanner. `vendor_fixture` stays `None`. Sole publisher: player task `publish_event`. `SessionDayTape::load` is the source (zero Massive).

`Commands::Serve` does **not** grow a replay flag or env arm. Production `server.rs` after bind still starts the vendor worker + Path-A capture + warmer + ensure when this construct is **not** the process. `RuntimeMode::Prod` (`APP_ENV=prod`) **plus** this construct **refuses before bind** — it does not serve tape as the desk and does not serve Massive until started correctly without the arm. Unset production still talks to Massive. Silent Massive-down → tape is forbidden.

Poison: production construct source must not grow a silent tape fallback; `Serve` must not start the player.

### 2.2 Scheduler — one Δt/k sleeper, two clocks

Delay until next timeline item = `(t_next − t_prev) / k` on a Tokio clock. Emit the **stored** `ts_ns` on the `StreamEvent`. `k = 1` is original cadence. Closed integer `k ∈ {1,4,10}` is the cost governor (79 Path-B `compute_analytics_from_vendor` calls exist on a full 09:30…16:00 grid). Unnamed / out-of-set pace **refuses to start** — it does not silently become 1×.

Timeline: merge Path-A records that have `ts_ns` with Path-B marks converted onto `et_date`. Sort by time. One player task walks it. Start = earliest stored occupant (do not invent 04:00). End = after last occupant; **do not loop**. If **both** Path-A and Path-B are empty-while-storing, there is no occupant: see §2.5 (start, then end — do not hang as playing).

Two clocks, consumed separately:

| Clock | Drives | Must not drive |
|---|---|---|
| **Tape cursor** (stored stamp on `et_date`) | Chip tape time ET; `market_session` **while armed and the cursor is vouched** | Envelope wall `ts`; client `Date.now()` as market now; `market_session` when `tape_time_et` is null |
| **Wall receive** | Keep-alive period; last-print `tick_age_s`; transport drop timing | Paid-live; ended; session classifier while armed |

Do not retask existing envelope `ts` as tape time. Recency of a last **print** may exist as an age; it is not ended, drop, fault, or paid-live.

**`market_session` while armed.** Required string on every `data:` event. When `session_tape.tape_time_et` is a vouched `HH:MM:SS`, derive the existing America/New_York bucket (`premarket` \| `regular` \| `afterhours` \| `overnight` \| `closed`) from **that tape stamp**, not from wall `Utc::now()`. When `tape_time_et` is JSON `null` (first keep-alive / both-empty before ended), emit the closed token **`session_tape`** — not a wall session, not overnight/closed from the wall clock. The S1 chip **does not consume** `market_session` while `session_tape` is present (including that null-cursor payload). Shipped `liveStatus` overnight / closed / no-live-ticks branches must not run.

### 2.3 ReplayConsumeOccupancy — consume-visible, same socket

Process occupancy the page cannot read is copy theater: replay ticks **will** satisfy 30s wall recency, a Δt/k sleeper **will** go quiet longer than 15s at 1×, and comment keep-alives **will not** reset the watchdog. Honesty is **on the existing ticker SSE**.

**Chosen:** armed occupancy **JSON data** pump on the existing `LiveUpdate` path. Same socket. Not a second EventSource. Not synthetic Trade/Quote keep-alives (`apply_event` of a fake print is forbidden). Occupancy is assembled in `routes/stream.rs` from a process slot the player writes (beside `ReplayHold`, not `vendor_fixture`, not coverage).

**Vouch-before-advertise (S1 loading ≠ S0).** The construct does **not** start `stock_worker`, so an occupancy-less ticker envelope on this process has no vendor ticks: shipped `connectionChip` would paint `⚠ Live offline — reconnecting…` or `liveStatus` (`○ no live ticks` / overnight / market closed). That window is forbidden.

Consume-path mechanism:

1. On a **playable** identity, write the occupancy slot with a first **`playing` keep-alive** (`session_tape` present, `live: false`, `tape_time_et` null until a stamp exists, `feed` = `session_tape`) **before** the process binds HTTP/SSE and **before** the ticker stream is advertised as live-capable.
2. Subscribe’s first `data:` JSON already carries `session_tape`. A bound armed process **never** emits an occupancy-less ticker `data:` event.
3. Miss / unreadable / weekend / not-elapsed / not-in-watchlist / not-storing / illegal pace / production-profile+arm **refuse before bind** — no walker socket, so the operator cannot observe this process as S0 live-offline. Genuine S0 is a different unset/`serve` process.
4. Client: if `session_tape` is present, branch **before** `liveStatus` / `feed` interpolation / `streamOffline → ⚠ Live offline — reconnecting…`. Payload-gap while last vouched phase was `playing` or `gap` is **drop** copy, even if the last envelope still says `playing`. Unset-arm live-offline remains Massive-only.

Slot facts (wire keys live in `INTERFACE_CONTRACT.md`):

- **Basis** — this stream is session tape / not paid-live. Unset arm: key **omitted**; today’s Massive path.
- **Identity** — armed `(symbol, et_date)` America/New_York `YYYY-MM-DD`. Process-scoped: every **per-ticker** SSE on an armed process carries this identity, not only the armed symbol’s socket.
- **Tape cursor time** — last scheduler cursor from stored stamps (and Path-B marks on `et_date`). **Not** envelope wall `ts`. **Not** client `Date.now()`. **Not** last-print `spot_ts` during a keep-alive (cursor may be ahead of the last trade). Omit / null when not vouched (first keep-alive; both-empty before ended). Never substitute wall clock.
- **Pace** — armed `k` as 1 | 4 | 10 (ticker chip prints ` · {n}×` only for 4 and 10; CLI may name `k = 1`).
- **Phase** — closed: `playing` | `gap` | `ended` | `drop` | `fault`. Loading is **not** a sixth phase: it is first `playing` occupancy with `tape_time_et` null, vouched before advertise.
- **Paid-live classifier** — existing envelope `live`. **False on every data payload while armed**, including keep-alive, gap, ended, drop, and fault. Recency-true must not set it. **`feed` while armed is the closed token `session_tape`** (never `live_massive`). Client branches on **basis before** `live` / `feed` interpolation.

While armed, the ticker loop emits occupancy **data** on a **wall** period **strictly less than** `STREAM_OFFLINE_MS` (15s), with jitter margin (implementation may use ≤5s). Independent of `k`. Real ticks still throttle as today when `dirty`. When `!dirty`, **do not** substitute a comment. After **ended** or **fault** is first published, **repeat** that occupancy on the same data period until the process stops. One-shot ended + silence is how a lost packet becomes live-offline.

Production unset: pump off; `live` remains recency; comments remain comments.

`GET /api/stream/prices` is **not** the walk surface. The exclusive construct does not start Massive, so it cannot mix a live vendor into scanner prices. Occupancy this slice binds the per-ticker ticker path.

<!-- spire:council-resolution:v1 bfe7b9741556202e9f8cf7b0241cd88f685c62e298b3c95c00229e26e1ea2caf folded -->
<!-- spire:council-resolution:v1 c0a10b7ef5aa2279f81b7d9fa0c20a0efb429e62988778be1c8b1dcf4176c960 folded -->
<!-- spire:council-resolution:v1 096836b6fbe2090bdf2be3217c96aa77d9baaa6fc828b6a9b4d6c3135a2d9dd6 folded -->

#### Phases

| Phase | Producer | Consume standing | Distinct from |
|---|---|---|---|
| **playing** | Sleeper running **or** first keep-alive before the first occupant. Data keep-alives + real Trade/Quote at stamped occupants. Path-B `ReplayHold.replace` at stored marks (not its own phase). First keep-alive is written **before bind**. | Clock running (or starting). Numbers move on real prints; keep-alive repeats last numbers. Null cursor → starting chip, not S0. | gap record; end; drop; fault; live Massive; S0 liveStatus |
| **gap** | Cursor **visits a stored PathAGap** (no `ts_ns`; vec order between stamped neighbors). One **non-tick** gap occupancy, then sleep to the next stamped Trade/Quote. Later keep-alives are **playing**. Unreadable `DayContainer` still refuses the whole start. No interpolated ticks. No sleep **on** the ts-less record. | A vouched recorded Path-A gap landed. Inter-arrival silence with no PathAGap record is **not** gap. | watchdog silence; ended; live “feed lagging” |
| **ended** | Last stored occupant emitted — or both-empty after the first playing voucher (§2.5). Publish **ended**, then stop the sleeper; **do not loop**. Pump **repeats ended**. Last `ReplayHold` stays. No further Path-A. | End of captured day. Last tape numbers kept. Structure stays last snapshot. | live-offline; overnight / market-closed / no-live-ticks; drop; fault |
| **drop** | **(a)** Hub `RecvError::Lagged` or `Closed` while phase was playing or gap — while armed, Lagged is **not** silent `continue`. **(b)** Client payload-gap watchdog (`STREAM_OFFLINE_MS` with no `data:`) while last vouched phase was playing or gap — **even if the last envelope still says `playing`**. | Session-tape stream dropped. Clock may still be running in-process. Chip is `⚠ Session tape stream dropped`. | ended; fault; unset-arm Massive reconnect |
| **fault** | Player / tape-read / clock failure. Publish **fault** if the loop is still up. Last `ReplayHold` stays. No 5xx. No fabricated ticks. | Replay fault. | ended; drop; live-offline |
| **(unset only) live-offline** | Production/unset recency + watchdog, as today. | Massive / live path down. | anything while armed |

Client consume rule: the payload-gap watchdog may still flip a transport-offline bit. While last vouched **basis is session tape**: last phase `ended` | `fault` → **not** drop, **not** live-offline; last phase `playing` | `gap` + payload gap → **drop** (`⚠ Session tape stream dropped`), **not** live-offline — this **is** drop, not a RecvError-only standing; `live` is false so today’s `isLive` cannot become true; live-offline copy is **unset-arm only**. Do not require wire `phase: drop` before showing drop copy.

If the envelope cannot name fault (hub already dead), the ticker may only see **drop**. CLI/process occupancy can still be fault. Fault must not reuse live-offline.

<!-- spire:council-resolution:v1 7fbd4808e4c9e04617f051cb06bd652c5dc5c5793f32924a365443a5c3fc0440 folded -->
<!-- spire:council-resolution:v1 098b970f1c395e125147a5b002473f6c46fab77c0c4b1bc8798ff0be88481ef9 folded -->
<!-- spire:council-resolution:v1 cc3e3ef5c3b74de59d5c2bac39561e895475e1e4604ef887afaeb116bf5c811a folded -->
<!-- spire:council-resolution:v1 4a47e321e827429c2d6de19ffbe8b33b3c315e16fa38edd5dd7f14c46665e427 folded -->

**Not-the-armed-day:** occupancy identity is always the armed pair. A ticker SSE whose **route** symbol ≠ armed symbol still carries session-tape basis, `live: false`, `feed: session_tape`, and that identity — no Massive (including no REST four-fetch for that name), no second tape, no fabricated prints for the unarmed name. Display-active (headline / tape tiles / flash) is true only when **route symbol = armed symbol** and phase is `playing` or `gap`. Keep-alive does not flash (no print).

**Net-flow** stays the existing wall 300s window inside `apply_event`. At 4×/10× that compresses tape-time flow. This slice does **not** add a tape-time flow accumulator. Copy at those speeds must not claim tape minutes (§4).

### 2.4 Path-B — ReplayHold, not Fixture, not warmer

At each stored 5-minute mark: tape-owned decode of that mark’s body → `VendorBundle` → `compute_analytics_from_vendor` (`iv_store = None`) → process **`ReplayHold`**. Not `FixtureCatalog.resolve`. Not interpolation between marks. Not `refresh_analytics` (that Massive-fetches and `maybe_spawn_persist`s).

`ReplayHold`: at most one `(symbol, et_date, snapshot, cursor)`. `load_or_compute` and the SSE flip peek consult `ReplayHold` **before** TTL-gated `gex_cache`. Empty slot before the first mark is **absent** (ticks may already flow; structure is not fabricated). Between marks the same snapshot holds.

Path-B persist already strips `source`. Replay decode **must not** default source to `LiveMassive` or `Fixture`. `MarketDataSourceKind` gains a **third discriminant** on the bundle (not a third `MarketDataPort` variant) so archive/coverage cannot count the occupant as `present`. Wire token is `session_tape`. `insert_if_absent` / ensure / `spawn_capture` remain unreachable from the player (poison).

### 2.5 Start occupancy — empty walks; misses refuse before bind

Replay start matches existing tape derive (`occupancy.rs`). Watchlist is `TAPE_WATCHLIST` (SPY, QQQ, IWM) — not `ENSURE_SYMBOLS`.

| Derive | Player |
|---|---|
| `NotInWatchlist` / `IneligibleWeekend` / `NotElapsed` / `NotStoring` / `NoIdentity` / `Unreadable` | **Refuse before bind.** No HTTP/SSE socket, no ticks, no structure, no archive write. Hub silent (nothing to subscribe). Process/CLI prints the capture literal. This process is **not** a ticker the operator can open. “Ticker stays S0” means genuine S0 exists only on a **different** unset/`serve` process — not a bound no-Massive walker presenting live-offline / no-live-ticks. |
| `StoringReady` + Path-A `EmptyWhileStoring` + Path-B Occupied | **Start.** Zero Path-A Trade/Quote `apply_event`. Earliest occupant is the first Path-B mark (do not invent 04:00). Keep-alives **playing**. Path-B marks fire as reached. Empty ≠ missing. CLI may print `no path-a ticks for {SYMBOL} on {ET_DATE}` as empty standing, **not** a miss refuse. |
| `StoringReady` + Path-A `Occupied` | Play stored trades/quotes in time order; gap records pulse gap occupancy then sleep to the next stamp. Path-B empty / not-capturing: Path-A walk proceeds; CLI warns `no path-b snapshots…`; no fabricated structure. |
| Both sides empty-while-storing | **Start** (still not a missing-tape refuse). Vouch first `playing` keep-alive (`tape_time_et` null) so consume is S1, not S0. There is no occupant: immediately publish **ended** and stop. No fabricated prints. No invented 04:00. Do not hang keep-alives as playing forever. |

Unreadable: do not partial-play lines that happened to parse. Refuse the day (before bind).

<!-- spire:council-resolution:v1 7a23ee55163d4c0d1a96e06d08be80aee5e5030abb3129017b204561d7eb468c folded -->
<!-- spire:council-resolution:v1 51e6698d1f2c548698659b0a6b80cfc400ffa749ea4fa8e76cdfd296d7562ef4 folded -->
<!-- spire:council-resolution:v1 b211f952b20a79551f71232c26db88c6826891a360f3ad6ed1751ffb6e1a4651 folded -->

### 2.6 Data flow + modules

```
session-day-replay construct (not AppState::new / new_production / for_capacity_harness)
    → SessionDayTape::load(symbol, et_date)     // existing, zero Massive
    → derive_axis_a / derive_path_a / derive_path_b
    → refuse BEFORE BIND (occupancy + CLI literal, no HTTP/SSE) | DayContainer
    → occupancy slot first playing keep-alive (session_tape present, live false)
    → THEN bind existing HTTP/SSE graph
    → player task (new one-way leaf under services/day_tape/)
         Path-A Trade/Quote → StreamEvent → hub.publish_event
         Path-A Gap         → gap occupancy (non-tick), then sleep to next stamp
         Path-B mark        → tape decode → compute_analytics_from_vendor
                            → ReplayHold.replace (iv_store = None)
    → occupancy slot (basis, identity, cursor, phase, pace)
existing ticker SSE (routes/stream.rs)
    → subscribe_events → apply_event only for real Trade/Quote
    → first data: already includes session_tape; occupancy pump (live forced false; JSON data <15s)
    → peek ReplayHold (then gex_cache) for flip
existing ticker REST
    → load_or_compute: ReplayHold hit first; never compute_analytics Massive four-fetch
      while the process is armed — any ticker name, not only the armed symbol
_research list/load
    → unchanged operator read; not the clock
quant-engine / signals
    → untouched; only compute_analytics_from_vendor
dashboard ticker chrome
    → branch on session-tape basis before liveStatus / feed interpolation / live-offline
    → payload-gap while last phase playing/gap → drop chip, not live-offline
    → display-active may move numbers; isLive stays false
```

Touched / created (indicative; planner owns the file list):

- **New:** `apps/api/src/services/day_tape/` player + occupancy slot + replay AppState constructor; clap `session-day-replay` in `apps/api/src/main.rs`.
- **Existing:** `apps/api/src/routes/stream.rs` (occupancy pump, `live` override, tape-cursor `market_session`, Lagged≠continue while armed); analytics `load_or_compute` / flip peek (`ReplayHold` before `gex_cache`); `MarketDataSourceKind` third discriminant; OpenAPI `LiveUpdateBody`.
- **Dashboard:** ticker connection chip, LiveTape widget, last-trade readout, gamma-flip label, net-flow label/ⓘ, `liveTapeStore` `isLive` split, order/mark live arm. **No** second ticker route. **No** `/_ops/replay` page.
- **Shared client:** generated `LiveUpdateBody` occupancy object (omitted when unset).

`quant-engine` does not import the player. Score/tier/fingerprint modules do not import the player.

### 2.7 Failure modes + isolation

| Failure | Observable result |
|---|---|
| Occupancy not playable | **Refuse before bind**; no walker HTTP/SSE; no fabricated day; production `serve` (separate process) untouched |
| Path-B body unreadable at one mark | Skip that mark (gap already representable); do not stop Path-A; do not Massive-fill |
| Player panic / hub closed | Existing RecvError handling; last `ReplayHold` stays; no 5xx minted by the player; consume standing drop or fault — **not** live-offline |
| End of timeline | Ended occupancy, then stop; no loop; last structure remains |
| REST cache miss during replay | `ReplayHold` or absent structure — **never** `compute_analytics` Massive join, including for a route symbol ≠ armed identity |
| `gex_cache` TTL expiry | Irrelevant while `ReplayHold` is the structure source |
| Path-A capture / persist accidentally spawned | Poison — compile/test red; would corrupt today’s tape |
| Operator opens a different locked name | Not-the-armed-day standing; no Massive for that name; no second tape |
| Secrets in the environment | Walk output / ticker payloads contain none of them |

**Desk wins under replay fault** (`best-effort-isolated-or-null`). Bundle / scan / unrelated trader paths still succeed.

### 2.8 Structural poisons (non-vacuous)

1. Player / replay-construct sources contain `insert_if_absent`, `archive_session_best_effort`, `spawn_capture` — build red.
2. `AppState::new` / `new_production` / `Serve` worker-start path still starts `stock_worker` and does **not** start the player when this construct is unset.
3. Replay construct: `vendor_fixture.is_none()`; rehydrated Path-B bodies do not carry `LiveMassive`; `body_carries_live_massive` false.
4. `MarketDataPort` enum remains two arms (`Live`, `Fixture`) — adding `Replay` fails a pin test.
5. While the replay construct is armed, `compute_analytics` Massive four-fetch is unreachable for **any** ticker REST name on that process (unit: client not called) — including a route symbol ≠ armed identity.
6. Replay construct does not call `path_a::spawn` / `warmer::spawn`.
7. Armed envelope with `live: true` **and** session-tape basis still drives paid-live chrome / fills / pulse — suite red.
8. Occupancy implemented only as SSE comments or Axum KeepAlive — counts as no occupancy.
9. Keep-alive implemented as synthetic Trade/Quote `apply_event`.
10. Envelope wall `ts` or client `Date.now()` presented as tape time.
11. End classified by recency age-out or by watchdog silence.
12. Drop or fault mapped to unset-arm live-offline. Client payload-gap during playing/gap mapped to live-offline.
13. Stored PathAGap skipped with no vouched gap pulse.
14. Production unset path changes `live` derivation or starts the occupancy pump.
15. `StreamEvent` grows a provenance member.
16. Bound armed process emits ticker SSE `data:` without `session_tape`.
17. S1 loading / pre-stamp chip uses shipped `liveStatus` or `⚠ Live offline — reconnecting…`.

**Not buildable / rejected approaches:** Fixture-as-clock; `MarketDataPort::Replay`; second hub / second SSE; dump-at-start; comment keep-alive as honesty; copy-only “don’t treat recency as live”; `/_ops/replay` Start page; production leftover env on `serve`; interpolating Path-A or Path-B gaps; looping the day; inserting tape as coverage `present`; binding HTTP before occupancy is vouched; treating S1 loading as S0 live chrome.

## 3. Acceptance criteria (with user stories)

Actors: research operator (arm + walk the existing ticker); desk owner (production still Massive). Observable from the existing ticker SSE/structure updates, process start vs refuse, vendor-call count, coverage class, score identity on the same inputs, and operator-visible standing. Field lists live in `INTERFACE_CONTRACT.md` — this table does not restate them.

`test` = silent-regression risk (honesty, fills, clock, refuse splits). `review` = exact standing English / presence / canon. Not one-test-per-AC. Dashboard Vitest (jsdom) + Playwright are already in the seam; hollow “renders without throw” does not satisfy banned-interpolation rows. No new DOM harness.

**(SB)** = ship-blocking.

<!-- spire:council-resolution:v1 e40af2a9d855ba4cd5c7fb17e13f5986d705539c8a9f26ace7078c3f23f4f815 folded -->

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 (SB) | As the operator, I want a named stored Path-A day to walk the existing ticker in stored order so Tuesday is a clock, not a file | Given research construct armed for locked S on ET weekday D with stored Path-A, the existing ticker live contract for S receives those Path-A events in stored time order | test |
| 2 (SB) | As the operator, I want waits honored at 1× so the walk is not a dump | Given two successive stored Path-A events with a positive timestamp gap, at 1× the second is not emitted before that gap has elapsed | test |
| 3 (SB) | As the operator, I want 4×/10× to finish a long tape without reordering | A 4× arm compresses waits by 4; a 10× arm compresses waits by 10; event order matches the tape in both cases | test |
| 4 (SB) | As the operator, I want an illegal pace to refuse rather than silently run 1× | An arm with pace outside {1,4,10} refuses to start **before bind** and does not run 1× as a silent success | test |
| 5 (SB) | As the operator, I want the clock to start at the first kept occupant | The walk starts at the earliest stored occupant for `(S, D)` and does not invent ticks before that occupant | test |
| 6 (SB) | As the operator, I want the day to end and stay ended | After the last stored occupant, no further Path-A events arrive; the clock does not loop | test |
| 7 (SB) | As the operator, I want Tuesday’s structure to unfold as the clock reaches stored marks | As the clock passes each stored Path-B 5-minute mark, that mark’s structure becomes the ticker’s structure for S; later marks are not applied early | test |
| 8 (SB) | As the operator, I want structure to be that day’s tape, not Wednesday’s chain | During an armed walk, structure for S is that day’s stored Path-B (or honest structure-unavailable when Path-B is empty/not-capturing) — not a live or cached chain from another moment | test |
| 9 (SB) | As the desk owner, I want zero vendor I/O on the walk | Path-A emission and Path-B read/rehydrate on the walk perform zero vendor fetches | test |
| 10 (SB) | As the operator, I want consume occupancy to make captured-research-day ≠ live Massive | While armed, every ticker SSE data payload for that process has paid-live classifier false and session-tape basis present — **including the first data payload the client can receive** (occupancy vouched before the ticker stream is advertised). A bound armed process never emits occupancy-less data. Ticker standing is a captured research day — not live, not live Massive | test |
| 11 (SB) | As the operator, I want sleeper waits not to look like Massive down | While the sleeper is running (including 1× waits > 15s), JSON **data** occupancy continues on a period < 15s; no fabricated Trade/Quote; the ticker does not show live-offline reconnect | test |
| 12 (SB) | As the operator, I want end-of-tape to be ended, not vendor-down | After the last occupant, standing is end of captured day; ended occupancy is published and repeated as data; that standing is not live-offline / overnight-no-live-data / market-closed / no-live-ticks | test |
| 13 (SB) | As the operator, I want drop ≠ ended ≠ fault ≠ live-offline | Hub RecvError/lag **or** client payload-gap (`STREAM_OFFLINE_MS` with no `data:`) while last vouched phase was playing/gap is session-tape stream dropped — **including when the last envelope still says `playing`**. Clock/tape-read fault is replay-fault. Unset-arm vendor down remains today’s live-offline. The three (plus ended) are distinguishable without reading source | test |
| 14 (SB) | As the operator, I want a recorded Path-A gap vouched, not interpolated | When the cursor visits a stored Path-A gap, a non-tick gap occupancy is published, then the clock sleeps to the next stamped trade/quote. No interpolated ticks. Inter-arrival keep-alive is not gap | test |
| 15 (SB) | As the operator, I want misses to refuse rather than fabricate a day | No stored tape / unreadable / not-storing / ET weekend / not-elapsed / not-in-watchlist: replay **refuses before bind** (no HTTP/SSE socket), no Path-A events are emitted, the operator cannot open this process as a live-offline ticker, and the classes stay distinct from each other and from empty | test |
| 16 (SB) | As the operator, I want a quiet stored day to still walk | Given a stored identity with Path-A count 0 and Path-B occupied, the clock starts; zero Path-A prints; no fabricated prints; Path-B marks still fire; outcome is empty-tape — not missing, not unreadable, not a miss refuse | test |
| 17 (SB) | As the desk owner, I want production without the arm to look and talk like today | Given any profile with the replay construct **unset**, the ticker live path talks to Massive, does not emit tape ticks, does not carry session-tape occupancy, and S0 chip / Live tape / last-trade / live-offline copy are byte-identical to today | test |
| 18 (SB) | As the desk owner, I want Massive-down not to become Tuesday | Given Massive is down and the replay construct is unset, the live path is honest vendor-down / live-offline and does not auto-start a tape walk | test |
| 19 (SB) | As the desk owner, I want production-profile to refuse the arm | Given `APP_ENV=prod` (production-profile) **with** the replay construct, the process refuses to start as a walker **before bind** and does not serve tape on the ticker live contract | test |
| 20 (SB) | As the desk owner, I want tape never to launder a live paid book | Walking or loading tape does not insert a session-archive identity and does not classify that identity as coverage `present`. A missing coverage cell for `(S, D)` stays missing | test |
| 21 (SB) | As the desk owner, I want no mixed feed | An armed identity does not mix Massive ticks with tape ticks on its live contract | test |
| 22 (SB) | As the desk owner, I want a clock fault not to take down the desk | If the clock or tape read faults mid-walk, bundle / scan / unrelated trader paths still succeed (no 5xx caused by the replay fault), and standing is replay-fault — not end-of-tape, not live-offline | test |
| 23 (SB) | As a reviewer, I want the formula unchanged | For the same market inputs, opportunity score, tier, and state fingerprint are byte-identical when those inputs are applied through the live formula via replay vs via the live compute path; this feature does not change weights (`Authorizes: nothing`) | test |
| 24 (SB) | As a reviewer, I want unset live behavior unchanged | Enabling this feature with the construct unset leaves live score / tier / fingerprint byte-identical to pre-feature live behavior on live inputs | test |
| 25 (SB) | As the operator, I want a transport drop not to blank structure | A ticker live-contract drop during a walk degrades live-derived-from-tape fields without blanking already-shown structure | test |
| 26 (SB) | As the desk owner, I want tape read still operator-gated | When an operator token is required, a tape read without it is refused and returns no tape body. Arming is not granted by a trader session cookie | test |
| 27 (SB) | As the desk owner, I want Pages not to become a replay CDN | Pages trader origin still 404s `/api/_research` and `/api/_metrics` (and subpaths). No playback REST is added | test |
| 28 (SB) | As a reviewer, I want one ticker on the request path | Requesting the walk still computes one ticker — the armed name — not a universe sweep | test |
| 29 (SB) | As the operator, I want a different symbol on an armed process to be not-the-armed-day | Opening a ticker whose route symbol ≠ armed identity does not start Massive for **that symbol or any other** on the armed process (four-fetch unreachable while armed), does not start a second tape, does not apply the armed name’s prints as that symbol’s tape, and does not occupy live-session standing | test |
| 30 (SB) | As the desk owner, I want no secrets on the wire | Canary secret values present in the environment do not appear in walk output or ticker live-contract payloads | test |
| 31 (SB) | As the operator, I want live-session meaning off while walking | While armed — including the first keep-alive before any stamp, and playing / gap / ended / drop / fault: S1 does not occupy live-session standing — no `● live ·`, no `Streaming live ${feed} ticks.`, no `Live tape`, no `Gamma flip (live)`, no `liveDotPulse` / `widgetLivePulse`, no `evaluateOrder` fills / live-cross / mark live arm. `isLive` remains false. Closed negations (“not a live vendor feed”) are allowed. Poison: session-tape basis with `live: true` that still paints any of the above fails. A grep that reds those negations is a bad oracle | test |
| 32 (SB) | As the operator, I want ended copy not to promise Massive reconnect | End-of-tape shows session-tape-ended standing (chip `○ session tape ended · {SYM} · {humanSessionDate}`) and does not show `⚠ Live offline — reconnecting…` or `OFFLINE_CHIP_TOOLTIP`. Last tape values are kept, not blanked | test |
| 33 (SB) | As the operator, I want a drop during the walk not to reuse live-offline | Hub RecvError/lag **or** client payload-gap (`STREAM_OFFLINE_MS` with no `data:`) **during** the walk, while last vouched phase was playing or gap, shows `⚠ Session tape stream dropped` (warning + icon) and does not show live-offline copy — even if the last envelope still says `playing`. SSE drop **with the construct unset** still shows today’s live-offline copy | test |
| 34 (SB) | As the operator, I want speed named only when compressed | Playing chip is hollow `○` + `session tape · {SYM} · {humanSessionDate} · tape {HH:MM:SS} ET`; suffix ` · {n}×` only when armed k ∈ {4,10} (omit at 1×). `pulse` is false. Tone is not success/error direction green/red | test |
| 35 (SB) | As the operator, I want 4×/10× net-flow not to lie about tape minutes | At 1×, net-flow may be described as a last-few-minutes read of stored Path-A trades. At 4× and 10×, S1 Net-flow label/ⓘ do not claim tape minutes: no `Net flow (5m)` (or any `(Nm)`), no “last few minutes”, no invented k×5 tape window | test |
| 36 (SB) | As the operator, I want to walk what was kept without a completeness score | A stored day that did not cover a full regular session walks the occupants that were kept. The existing ticker does not claim a full open-to-close session and does not print `partial captured day`, `complete open-to-close`, or a completeness % | test |
| 37 (SB) | As a reviewer, I want no second live path and no operator Start page | No ticker player chrome (play / pause / scrub / skip / reverse / in-page date picker), no new trader nav / Settings replay control, no `/_ops/replay`, no HTTP Start/Stop that arms the player, no `/_ops/metrics` replay Start | review |
| 38 (SB) | As a reviewer, I want approved standing prose on the ticker and CLI | Standing block, chip/tooltip strings (including starting / drop / not-this-ticker), widget title swap, last-trade replay states, glossary, and CLI `session-day-replay` lines match §4. This row does **not** certify absence of live interpolations, pulses, or fills | review |
| 39 | As a reviewer, I want the SET canon, not a Replay visual system | SPEC §4 adheres to DESIGN_SYSTEM (SET); no second token table; no silent amendment; no scrubber; no new keyframe family; warning phases use warning + icon; 393px chip drops tape-time first, then speed, never `session tape` or the date | review |
| 40 (SB) | As the operator, I want a gap chip only when the envelope vouches a gap | S1 `session tape gap` appears only when gap occupancy is vouched. A recorded Path-A gap never uses live lag / reconnect / “feed may be lagging” copy | test |
| 41 (SB) | As the operator, I want numbers to move without inheriting live meaning | While session tape is playing and the route symbol is the armed symbol, headline/tape tiles may follow tape mid (display-active). Keep-alive occupancy does not flash. Fills and live pulses stay off | test |
| 42 (SB) | As a reviewer, I want absence classes distinguishable | Missing, empty, unreadable, end-of-tape, replay-fault, drop, ineligible-weekend, not-elapsed, not-in-watchlist, unauthorized, not-the-armed-day, and production-unset-still-live are distinguishable without reading source. Missing/unreadable/ineligible refuse **before bind** (CLI literal, no walker ticker). Production-unset-still-live is S0 Massive on an unset serve. They are not both “live-offline on a bound ticker” | test |
| 43 (SB) | As a reviewer, I want this ship not to absorb the next harvest cluster | This ship does not download or ingest S3 flat files, does not add hist-chain, and does not expand the watchlist beyond SPY, QQQ, IWM | review |
| 44 (SB) | As the operator, I want tape time to be the stored stamp | Captured timestamps remain the walked session time on the consume path (vouched tape time ET). Envelope wall `ts` and client `Date.now()` are not presented as session now | test |
| 45 (SB) | As the operator, I want CLI/startup to carry miss/end/fault when there is no walker ticker | Miss / ineligible / unreadable / not-storing literals bind on CLI/startup; that process **does not bind** HTTP/SSE. End / drop / fault bind on S1 ticker **and** CLI. Stdout title is `session-day-replay` | test |
| 46 (SB) | As the operator, I want a both-empty stored day to end without fabricating a clock | Given stored identity with Path-A empty-while-storing **and** Path-B empty-while-storing, the clock starts (not a miss refuse); zero Path-A prints and zero Path-B marks; first occupancy is playing (`tape_time_et` null); then standing becomes ended; no fabricated prints; no invented 04:00; keep-alives do not hang as playing forever | test |
| 47 (SB) | As the operator, I want S1 start not to look like Massive down | Given a playable arm, the ticker stream is not advertised until a playing occupancy keep-alive is in the slot. Before and after that first payload, the connection chip does not show `⚠ Live offline — reconnecting…`, `○ no live ticks`, `○ overnight — no live data`, `○ market closed`, or `● live ·`. Loading standing is `session tape · starting…` (or the playing identity chip once tape time is vouched) — never S0 `liveStatus` | test |

**Method notes.** Prefer **one** hermetic planted-walk pass: plant `(SPY, D)` two Path-A events + two Path-B marks → arm research 1× → **first SSE `data:` already has `session_tape` and `live: false`** → events in order with gap honored, marks applied only when reached, vendor counter 0 **including REST for a second symbol**, `feed` is `session_tape`, keep-alive data during the gap, banned interpolations absent → 4× compresses the same gap and net-flow copy does not claim tape minutes → last event then ended standing ≠ live-offline → **payload-gap during playing shows drop copy, not live-offline** → missing identity refuses before bind and emits nothing → empty Path-A + occupied Path-B starts with zero prints and is not missing → **both-empty starts then ends** → unreadable refuses before bind → weekend/future/NVDA refuse before bind → unset arm still vendor, Massive-down does not auto-walk → production-profile plus arm refuses start → coverage missing stays missing → same inputs score triple identical → write/clock fault does not 5xx the desk → poison `live: true` + session-tape basis still refuses live chrome. GATE Q must show **both** a rejecting path and an accepting planted walk. A suite that only dumps a tape onto a hub has not proved a clock.

Exact standing English is `review` (rows 38–39). Banned live interpolations, `isLive`/fills/pulse, end ≠ live-offline, drop ≠ live-offline (including client payload-gap), S1 loading ≠ S0 live chrome, completeness negative, 1× omit / 4× print, and 4×/10× net-flow window absence are `test` (rows 31–36, 40, 47). Do not move those to review.

## 4. UI + interaction

This is **not** `NO_UI_CHANGE`. Capture was store-only. Playback is the reason this slice exists. The trader-visible change is **honest not-live copy/states on the existing ticker** while the construct is armed. There is **no** second Replay app, no `/_ops/replay`, no trader play button.

**Surfaces**

| # | Surface | Who | This slice |
|---|---|---|---|
| S0 | Production / unset ticker `/ticker/:symbol` | every trader | **byte-identical to today** |
| S1 | Same ticker while armed | operator walking the armed name; anyone on that process’s ticker | session-tape chip / widget / last-trade / fills split |
| CLI | `session-day-replay` stdout + standing block | operator | arm, miss, end, fault; capture literals |
| S3 | Landing, Scanner, Settings, Ask-AI, shell nav, `/_ops/metrics`, coverage/session-book vehicles, Positions “Live” tab | everyone else | no Replay chrome; no coverage cells; no metrics stage named replay |

**Flows**

1. Operator starts `session-day-replay --symbol SPY --et-date {D} [--pace 4|10]` on a non-production process. Standing block prints first. On a playable identity the process **vouches a `playing` keep-alive, then binds**; ticker `/ticker/SPY` enters S1 on the first `data:` (already `session_tape`). On a refuse class, CLI prints the capture literal, **the process does not bind**, hub stays silent.
2. Operator watches Path-A tiles/headline move at tape time (display-active). Structure widgets stay snapshot language; Path-B marks refresh them as the clock reaches stored marks.
3. Last occupant → ended chip; last numbers kept; Stop the process to leave (no in-ticker Stop this slice). Unset production ticker is S0.

**Gates (S1)**

| Gate | True when | Drives |
|---|---|---|
| **Display-active** | session-tape basis, route symbol = armed symbol, phase `playing` or `gap`, SSE delivering | headline may use tape `mid`; LiveTape numbers; flash-on-change of **real Path-A prints** (existing `useFlashOnChange`; keep-alive does not flash) |
| **`isLive` (genuine)** | construct **unset** · envelope `live` · not `streamOffline` | `● live` chip, `Live tape` title, `Gamma flip (live)`, `liveDotPulse`, `widgetLivePulse`, `LAST_TRADE_TOOLTIP`, **order fills**, mark-ladder live arm |

Replay ⇒ display-active **may** be true; `isLive` **is false**. Branch on session-tape basis **before** `liveStatus` / `connectionChip` live-offline / `Streaming live ${feed}`. While `session_tape` is present — including the first keep-alive with `tape_time_et` null — **must not** call shipped `liveStatus` and **must not** take `streamOffline` → `⚠ Live offline — reconnecting…`. While last vouched phase was `playing` or `gap`, `streamOffline` (client payload-gap) → drop chip `⚠ Session tape stream dropped`. S1 loading is **not** S0.

### Component states

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Ticker connection chip (S0 unset) | today’s `liveStatus` / `● live · {session}` | n/a (chip follows SSE) | today’s no-ticks / overnight / closed | n/a | today’s `⚠ Live offline — reconnecting…` |
| Ticker connection chip (S1 armed) | playing: `○` + `session tape · {SYM} · {humanSessionDate} · tape {HH:MM:SS} ET` + ` · {n}×` only for 4×/10×; pulse false; tone `neutral` | **not S0.** First vouched `playing` occupancy (`tape_time_et` null): `○ session tape · starting…`; pulse false; tone `neutral`. Never `liveStatus`, never `⚠ Live offline — reconnecting…`, never `○ no live ticks` / overnight / market-closed | empty Path-A (Path-B may still walk): playing identity chip; omit tape-time until a stamp exists; last-trade no-print literal | fault: `⚠ Session tape playback fault` (warning + icon) | drop: `⚠ Session tape stream dropped` (hub RecvError/lag **or** client payload-gap while last phase was playing/gap); vouched gap: `session tape gap · {SYM} · {humanSessionDate}` (warning + icon); ended: `session tape ended · {SYM} · {humanSessionDate}` (warning + icon) |
| LiveTape widget | S0: title `Live tape`. S1: title `Session tape` from the first `session_tape` payload (including starting); subtitle `Session day tape · {SYM} · {humanSessionDate} · not a live feed` | existing skeleton-first **until** first `data:`; then S1 title/subtitle — **not** `Live tape`, **not** `LIVE_TAPE_SUBTITLE_OFFLINE` | tiles keep last numbers or `—`; no fabricated `$0` | fault does not 5xx; no capacity copy as a tape miss | ended subtitle `Session tape ended · last tape ticks · structure levels stay snapshot`; drop may dim tape numbers — **not** `⏸ offline` |
| Last trade | S0 four-state shipped. S1 + print: `○ Last trade ${X}` (hollow; not `info.main` `●`) | S0 skeleton only while no `data:` yet (that window cannot reach the 15s watchdog on a playable bind). After first occupancy: S1 no-print literal if no trade — **not** `⏸ Last trade` | S1 no print: `Last trade — no tape print at this tape time` | not a tape stacktrace | ended keeps last print or the no-print literal — **not** `⏸ Last trade`; drop uses the chip for warning |
| Net-flow tile | S0 shipped `Net flow ({n}m)` + live-tape ⓘ | n/a | number may be 0 | n/a | S1 1×: keep `(Nm)` + last-few-minutes ⓘ. S1 4×/10×: label `Net flow` with **no** `(Nm)`; ⓘ does not claim tape minutes |
| Structure widgets + FreshnessLine | snapshot language; `Structure as-of …` | existing | honest structure-unavailable when Path-B empty | REST poll fail: existing `Couldn't refresh` | last snapshot remains behind ended / drop / fault; never retitled live; never Massive-filled |
| Orders / marks on ticker | S0 fills only when genuinely live | n/a | n/a | n/a | S1: no limit fill, no live-cross, no live pulse. Do not reuse `⚠ Live marks paused — …` for starting/ended/keep-alive/gap/drop/fault |
| CLI `session-day-replay` | standing block first, then `[RUNNING] … not a live feed` | `Starting session tape…` is **not** HTTP; startup is process start **before** bind | capture miss literals; process **does not bind**; no walker ticker | unreadable / not-storing `[ERROR]` before bind; unauthorized not a trader 401 on SSE | ended `[OK] session tape ended`; drop/fault named; not live Massive |
| `/_ops/metrics` · shell nav · Settings · Scanner · Landing | unchanged | unchanged | unchanged | unchanged | no replay Start, no tape matrix, no coverage cells |

Ended is a first-class S1 state (not a footnote on offline): last numbers kept, no pulse, fills still impossible, no live-offline copy.

**Not-the-armed-day** (route symbol ≠ armed identity; occupancy already present on every per-ticker SSE — no S0 loading):

| Slot | Standing |
|---|---|
| Chip | `session tape · {ARMED_SYM} · {humanSessionDate} · not this ticker`. Tooltip: `This process is playing session day tape for {ARMED_SYM} on {ET_DATE}. This ticker is not that identity. Not a live vendor feed.` Display-active false. `pulse` false. |
| LiveTape | Title `Session tape`. Subtitle names the **armed** identity and that this ticker is not that day — not `Live tape`, not this symbol’s live session. Tiles `—` / last numbers; no armed-name prints applied as this symbol. |
| Last trade | `Last trade — no tape print at this tape time` (or keep a prior print from a previous unset visit — do not paint the armed name’s prints as this symbol). Not `⏸ Last trade`. |
| Net-flow | Do not claim tape minutes for this symbol. 4×/10×: label `Net flow` with no `(Nm)` as on the armed ticker. |
| Structure / FreshnessLine | Snapshot language or honest structure-unavailable. **No Massive four-fetch** for this name. Never retitled live. |
| Orders / marks | No fills, no live-cross, no live pulse. |
| Drop / fault / ended | Same session-tape drop/fault/ended copy as the armed ticker — **not** live-offline. |

No Massive. No fabricated prints. No second tape.

### Copy

**CLI / process standing block (first, including miss / error):**

```
SESSION TAPE — RESEARCH PLAYBACK · NOT A LIVE VENDOR FEED
  Identity:    {SYMBOL} · {ET_DATE} America/New_York
  Source:      session day tape · Path-A ticks · Path-B 5-minute structure when present
  Provenance:  research tape · never live_massive · never coverage present
  Clock:       tape time ET{ · {n}× if 4× or 10×}
  Vendor I/O:  0 Massive calls on this playback
  Authorizes:  nothing on the score formula. Not a live paid session book.
               Not coverage present. Not redistributed as a live vendor feed.
```

CLI may name `k = 1` as a process fact. The ticker chip does not print ` · 1×`.

**S1 chip + tooltips (exact)**

| Phase | Chip `text` (no leading bullet; `dot` separate) | Tooltip |
|---|---|---|
| loading / starting (`playing` + `tape_time_et` null; **not S0**) | `session tape · starting…` | `Session day tape is starting. Research playback — not a live vendor feed, not reconnecting to Massive.` |
| playing (including keep-alive with vouched tape time) | `session tape · {SYM} · {humanSessionDate} · tape {HH:MM:SS} ET` + ` · {n}×` only for 4×/10× | `Session day tape for {SYM} on {ET_DATE}. Research playback — not a live vendor feed, not live Massive. Headline and tape tiles follow stored Path-A ticks at tape time when present. Structure below is the snapshot path, not this tape’s live claim.` |
| gap (vouched Path-A gap occupancy only) | `session tape gap · {SYM} · {humanSessionDate}` | `A gap is recorded on this session day tape. This is not a live feed lag, and it is not reconnecting to Massive.` |
| ended | `session tape ended · {SYM} · {humanSessionDate}` | `This session day tape has no further Path-A ticks. Not live. Not reconnecting.` |
| drop (hub RecvError/lag **or** client payload-gap while last vouched phase was playing/gap) | `⚠ Session tape stream dropped` | `The ticker stream dropped while session tape was playing. Structure levels stay as of the last snapshot. This is not live Massive reconnecting.` |
| fault | `⚠ Session tape playback fault` | `Session tape playback faulted. Last tape numbers may remain. This is not live Massive reconnecting.` |
| S0 arm unset | today’s `liveStatus` / `⚠ Live offline — reconnecting…` | today’s `Streaming live ${feed} ticks.` / `OFFLINE_CHIP_TOOLTIP` |

`{SYM}` is the ticker-route symbol when it matches the armed name; not-the-armed-day uses `{ARMED_SYM}` as above. `{humanSessionDate}` is existing `humanSessionDate(et_date)` (`Fri Jul 3` for `2026-07-03`). `{HH:MM:SS}` is vouched tape time. If the chip would overflow at 393px, **drop tape-time first**, then speed, never the words `session tape` or the date. Omit tape-time when it is not vouched (use the starting chip, not wall clock). Never substitute wall clock. `dot` is `○`. `pulse` is **false**. Tone `neutral` while playing / starting; `warning` + icon for gap / ended / drop / fault. Never success/error direction green/red. Never `●`.

**LiveTape widget (S1 vs S0)**

| Slot | S0 unset | S1 armed |
|---|---|---|
| title | `Live tape` | `Session tape` |
| subtitle (playing / keep-alive / gap / starting) | `Live stream · not the structure snapshot below` | `Session day tape · {SYM} · {humanSessionDate} · not a live feed` |
| subtitle (ended) | n/a | `Session tape ended · last tape ticks · structure levels stay snapshot` |
| ⓘ | shipped live-derived sentence | `Reads off the stored session day tape (Path-A trades and quotes). Not a live vendor feed. Structure tiles below stay snapshot reads; they are not this tape claiming live greeks.` |
| Gamma flip label | `Gamma flip (live)` when `isLive` | `Gamma flip` — **never** `(live)` |
| VWAP | unchanged static | unchanged static |
| S0 offline subtitle | `Stream offline · last known ticks · structure levels stay current` | **must not fire** for starting, end-of-tape, drop, or fault |

**Net-flow (S1 tile only; S0 byte-identical)**

| Arm | Label | ⓘ |
|---|---|---|
| S0 unset | shipped `Net flow (${round(flow_window_s / 60)}m)` | shipped live-tape sentence |
| S1 **1×** | same window interpolation as S0 (`Net flow (5m)` when `flow_window_s` is 300) | `Aggressive buys minus sells over the tape’s last few minutes, from stored Path-A trades. Not a live vendor feed. Positive = buyers lifting the ask; negative = sellers hitting the bid.` |
| S1 **4× / 10×** | `Net flow` — **no** `(Nm)` suffix; do **not** interpolate `flow_window_s` as tape minutes; do **not** print k×5 | `Aggressive buys minus sells from stored Path-A trades. Not a live vendor feed. This number does not name a tape-time window. Positive = buyers lifting the ask; negative = sellers hitting the bid.` |

<!-- spire:council-resolution:v1 4a0228873a3e58ae08f0e0f14eb9120394f24c5a0d2e8d73db30af5150916ff9 folded -->

**Last-trade tooltip during replay** (replaces `LAST_TRADE_TOOLTIP`):

`The last stored trade print on this session day tape. Research readout only — not a live vendor feed. The headline follows the tape mid when session tape is playing; walls / gamma flip / max pain stay on the structure snapshot, not on this print.`

**CLI miss / status — reuse capture literals; never synonyms**

| Situation | Exact line |
|---|---|
| Playing | `[RUNNING] session-day-replay — {SYMBOL} {ET_DATE} · session day tape · not a live feed` |
| Ended | `[OK] session-day-replay — session tape ended · {SYMBOL} on {ET_DATE}` |
| Stopped / process exit after a walk | `[OK] session-day-replay — stopped · not live Massive` |
| No identity | `no session day tape for {SYMBOL} on {ET_DATE}` |
| Path-A empty (walk **starts**) | `no path-a ticks for {SYMBOL} on {ET_DATE}` as empty standing, not a refuse |
| Path-B empty, Path-A present | `no path-b snapshots for {SYMBOL} on {ET_DATE}` · walk allowed |
| Not storing | `session day tape not storing` |
| Unreadable | `session day tape unreadable: {reason}` |
| Not in watchlist | `not in tape watchlist: {SYMBOL}` |
| Weekend | `session day tape ineligible weekend: {SYMBOL} on {ET_DATE}` |
| Not elapsed | `session day tape not elapsed: {SYMBOL} on {ET_DATE}` |
| Unauthorized (tape HTTP) | shipped `metrics_unauthorized` |
| Banned | `[PASS] n/n present`, `LIVE` as a feed badge, `live_massive`, “verified live”, “Massive replay”, `partial captured day`, completeness % |

**Banned live interpolations (S1 — `test`, not exact-English review)**

While armed — including starting / first keep-alive before any stamp — visible ticker copy, tooltips, titles, labels, captions, pulses, and fill gates **must not** occupy:

- `● live · ${session}` / `● live ·`
- `Streaming live ${feed} ticks.`
- `Live tape`
- `Gamma flip (live)`
- `⚠ Live offline — reconnecting…`
- `OFFLINE_CHIP_TOOLTIP` (“Reconnecting automatically”)
- `○ overnight — no live data`
- `○ market closed` (as this arm’s standing)
- `○ no live ticks` / “the feed may be lagging”
- `LIVE_TAPE_SUBTITLE_LIVE` / `LIVE_TAPE_SUBTITLE_OFFLINE`
- `⏸ offline` / `⏸ Last trade`
- `liveDotPulse` / `widgetLivePulse`
- `evaluateOrder` fills / live-cross / mark live arm (`isLive` true)
- `this quote is live`
- `live_massive` / `LiveMassive` / `LIVE` as a feed badge
- `Live streaming is at capacity. Try again shortly.` as a tape miss or ended standing
- coverage cells `present` \| `missing` \| `unreadable` \| `not yet due` \| `blocked occupancy`
- `partial captured day` / `complete open-to-close` / completeness %

<!-- spire:council-resolution:v1 49ddf5b3f425c761d55123d9a70581feb7e6281b8a12a63e3e0fa2e40c65bf9a folded -->
<!-- spire:council-resolution:v1 c9ae3bca3f5ebf47cd0db71b1258f60c55c53f0f189cd5e30975f508017665a4 folded -->

**Allowed as closed negation / definition only** (`review`): `not a live vendor feed` · `not live Massive` · `never live_massive` · `Not live.` · `not a live feed` · `This is not a live feed lag, and it is not reconnecting to Massive.` · `This is not live Massive reconnecting.` · `not reconnecting to Massive` · standing-block `NOT A LIVE VENDOR FEED` · glossary “Live is the genuine Massive stream when replay is unset.”

**Glossary (S1 tooltips / ⓘ only while armed)**

| Term | Sentence |
|---|---|
| session tape | Stored research day for one locked symbol on one America/New_York date, playing through this ticker’s existing stream. Not a live vendor feed. |
| tape time | The timestamp on the stored tick, America/New_York. Not wall-clock “now”. |
| live | **Not used on this chip while `session_tape` is present** (starting / playing / gap / ended / drop / fault). Live is the genuine Massive stream when replay is unset. |
| structure | The snapshot options book / GEX path. It is not this tape claiming live greeks. |
| present | **Not a ticker word.** On coverage, a loadable live paid session book. |

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` — **Status: SET** (The Curvature Terminal). No amendment requested. Do not restate the token table here.

**Design direction:** Apply the canon to **existing** ticker pieces — CommandDeck connection `TintChip`, LiveTape `StatTile`s, last-trade readout, FreshnessLine, order engine — plus CLI standing (not a new catalog piece). Bind `extrasFor` / palette slots / `elevationFor` e1–e2. No hardcoded hex. Chip text ≥11px. Warning states use **`warning.*` + icon always** — never brand amber alone. Green/red remain **direction** (net flow sign, P/L), never “replay health”. **No new keyframes.** `liveDotPulse` / `widgetLivePulse` stay genuine-live only. Flash-on-change may run while display-active (existing data signal). `useReducedMotion` still freezes pulse (already false on replay) and flash. No fourth convex arc. No gradient CTA. No scrubber. No parallel Replay chrome language.

## 5. Error handling

| Failure class | User sees | Logs | Desk / retries |
|---|---|---|---|
| No identity / weekend / not-elapsed / not-in-watchlist | CLI capture literal; **process does not bind**; no walker ticker | refuse before bind; not a coverage `[FAIL]` | no walk; change identity and restart the process |
| Not storing | `session day tape not storing`; process does not bind | `[ERROR]` | desk (unset serve) still up if it is a different process |
| Unreadable | `session day tape unreadable: {reason}`; process does not bind | `[ERROR]`; no partial walk | refuse whole day before bind |
| Empty Path-A, Path-B occupied | CLI empty standing; S1 playing; last-trade no-print; Path-B unfolds | not a miss refuse | clock runs |
| Both sides empty-while-storing | CLI empty standing; S1 starting then **ended**; no prints | not a miss refuse | no hang as playing |
| Path-B empty, Path-A present | CLI `no path-b snapshots…`; Path-A walk; structure-unavailable | warn | no fabricated marks |
| Path-A gap record | vouched gap chip; last tape values kept | occupancy | no interpolation; clock continues |
| Path-B mark gap | that mark stays a gap | skip mark | no fill fetch |
| End of tape | ended chip + ended subtitle; last numbers kept | ended occupancy repeated | no loop; stop the process |
| SSE / payload-gap drop while armed | `⚠ Session tape stream dropped` (hub RecvError/lag **or** client watchdog while last phase was playing/gap); tape tiles may dim; structure remains | drop ≠ ended | not Massive reconnect; operator restarts process if needed |
| Replay fault | `⚠ Session tape playback fault`; last numbers may remain; **no trader 5xx** | fault occupancy if the loop is up | bundle/scan still succeed |
| Unset Massive down | today’s `⚠ Live offline — reconnecting…` | today’s path | **not** auto-replay |
| Production-profile + arm | process **does not bind** | startup refuse | start without the arm, or use a non-prod construct |
| Illegal pace / missing identity args | process refuses to start **before bind** | not silent 1× | fix args |
| Not-the-armed-day | S1 not-this-ticker chip; no Massive for that name | occupancy identity is the armed pair | open the armed symbol or restart with a new arm |
| Token missing on tape **read** | HTTP 401 `metrics_unauthorized`; no tape body | none as skip | SSE walk is not this gate |
| Pages `_research` | existing **404 `Not Found`** | fence, not a miss class | Railway-direct / local for operator HTTP |
| Capacity 503 | shipped `Live streaming is at capacity. Try again shortly.` | unchanged | **must not** be reused as a tape miss or ended standing |
| Secrets | never in payloads / CLI | none | n/a |

Retries: the player does not retry Massive (it never calls it). There is no in-ticker Stop/Start this slice — stop the process. Keep-alive is not a reconnect to Massive.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/day-replay-mock-adapter/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This ship **changes** the existing ticker SSE consume path (`GET /api/stream/{ticker}` `LiveUpdate`): additive session-tape occupancy omitted when unset; `live` forced false while armed; first armed `data:` already carries occupancy. It is **not** `NO_BACKEND_CHANGE` and **not** `NO_UI_CHANGE`. It does **not** add playback REST, `/_ops/replay`, or a second EventSource. Operator tape list/load stays `GET /api/_research/session-day-tape/*` (metrics/research token, **not** `"auth": true`). Clap `session-day-replay` is not executed by `interface_conformance.mjs`. Authoritative field lists live in the interface file.

## 7. Testing strategy

**Hermetic unit (injected clock + planted `DayContainer` + `harness_local` hub):** 1× gap-honor vs dump; 4×/10× compression without reorder; invalid pace refuse before bind; start at earliest occupant; no loop; Path-B applied only when reached; zero vendor counter **including REST for a second symbol while armed**; empty-while-storing Path-A starts with zero Path-A `apply_event`; both-empty starts then ended; missing/unreadable/weekend/future/NVDA refuse **before bind** (no HTTP listen); first armed `data:` has `session_tape` and `live: false` and `feed` = `session_tape`; occupancy data period < 15s (including 1× wait > 15s); comments-only keep-alive fails the occupancy poison; ended/fault repeat; PathAGap pulse then sleep; Lagged while armed is drop not silent continue; **client payload-gap during playing/gap classifies drop, not live-offline**; ReplayHold before `gex_cache`; Massive four-fetch unreachable while armed for **any** name; `market_session` is `session_tape` when cursor is null; `MarketDataPort` still two arms; no `insert_if_absent`; Serve path does not start the player; production-profile + construct refuses; coverage `present` unchanged; score triple identity on the same Path-B body; secrets absent; single-ticker.

**Dashboard (existing Vitest jsdom; not one-test-per-AC):** one S1 fixture pass covering starting / playing / ended / drop (including `streamOffline` with last phase `playing`) / gap-when-vouched / poison `live: true` + session-tape basis — banned interpolations absent, `isLive` false, no fills, no live pulse, end ≠ live-offline, **loading ≠ S0 liveStatus / live-offline**, payload-gap ≠ live-offline, 1× omits ` · 1×`, 4× prints ` · 4×`, 4× net-flow has no `(5m)` / “last few minutes”, no completeness words. S0 fixture asserts shipped live strings still exist when occupancy is omitted. Hollow “renders without throw” does not satisfy AC-31/32/33/34/35/47.

**HTTP / Pages:** tape list/load non-regression (NVDA not-in-watchlist 200, 422 bad `et_date`, session-books re-pin) via `interface_conformance.mjs` against the interface JSON. Token 401 on tape read when configured. Pages 404 `_research` / `_metrics`. No new playback path in the OpenAPI trader graph. SSE occupancy field presence is GATE Q hermetic + sample of one `data:` JSON object (the live runner cannot subscribe event-stream). GATE Q asserts armed `live` is JSON `false` (the live typespec is `boolean` only).

**Structural scans:** trader dashboard has no `/_ops/replay` route and no play/pause/scrub on ticker; OperatorMetrics closed stage set unchanged; `liveDotPulse` / `widgetLivePulse` not passed `live` during session tape; player sources have no `insert_if_absent` / `path_a::spawn` / `warmer::spawn`.

**Not required:** hosted “we walked every Tuesday”; one named test per AC; a VERIFY_MATRIX.md; a new e2e DOM tier; live G1 against an armed walker on production-profile.

Invariants that must not silently regress: exclusive construct; occupancy vouched before advertise; `live` false while armed; keep-alive is data not comments; end ≠ drop ≠ fault ≠ live-offline; client payload-gap during playing/gap is drop; empty ≠ missing; miss refuse before bind; no LiveMassive insert; Pages 404; S0 copy when unset; fills off; formula identity.

## 8. Guardrails this feature must not break

- **`present-is-live-paid-only` (HARD)** — replayed tape is never a loadable `LiveMassive` session book and never coverage `present`.
- **`operator-vs-trader-path-separation`** — tape **read** stays `_research` (token-gated; Pages 404). Replay **may** feed the existing ticker SSE and **must not** pretend that feed is live Massive. No `/_ops/replay`. `/_ops/metrics` stays side-effect-free.
- **`live-vs-static-isolation`** — live-derived-from-tape degrades on drop / end / fault; last structure is not blanked; end-of-tape ≠ live-offline; S1 loading ≠ live-offline; client payload-gap during the walk ≠ live-offline.
- **`best-effort-isolated-or-null`** — replay fault never 5xx the desk.
- **`additive-keeps-score-byte-identical` / `score-change-is-deliberate-and-measured`** — `Authorizes: nothing` on the formula.
- **`production-fails-closed`** — production construct does not silently become replay; production-profile plus arm refuses startup.
- **`absent-is-not-none`** — missing ≠ empty ≠ unreadable ≠ end ≠ drop ≠ fault ≠ ineligible ≠ not-elapsed ≠ not-in-watchlist ≠ unauthorized ≠ still-live ≠ not-the-armed-day.
- **`single-ticker-on-demand`** — one armed name; request path still computes the one ticker asked for.
- **`structural-over-prose-enforcement`** — poison the forbiddens in §2.8 and the gate goes red; poison tests non-vacuous.
- **`cited-code-is-verified-not-assumed`** — citations in §2 were read at source (Rust ticker SSE, tape store, Fixture, hub) — not Python, not briefing HTML.
- **`no-secrets-in-image`** — arm/config at runtime; no secrets in walk output.
- **`local-evidence-is-not-hosted-evidence`** — a local planted walk is not “production walked every Tuesday.”
- **`single-motion-moment`** — no new keyframe family; live pulses stay genuine-live only.
- **`theme-token-discipline`** — existing chips/tiles; `extrasFor`; no hardcoded hex.
- Massive license: replayed ticks remain **our research**, never redistributed as a live vendor feed.

## 9. Open questions

None. S3 flat-file keep, runtime re-arm, 60×, operator lab UI, pause/scrub, and watchlist expansion remain **Future** (§1), not undecided.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"bfe7b9741556202e9f8cf7b0241cd88f685c62e298b3c95c00229e26e1ea2caf","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"7fbd4808e4c9e04617f051cb06bd652c5dc5c5793f32924a365443a5c3fc0440","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"4a47e321e827429c2d6de19ffbe8b33b3c315e16fa38edd5dd7f14c46665e427","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"7a23ee55163d4c0d1a96e06d08be80aee5e5030abb3129017b204561d7eb468c","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"f8d325a00d3e1c39b662db63510b87d7c289af5d1f005b83243c9d7a767275cd","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":0,"conflict_id":"c0a10b7ef5aa2279f81b7d9fa0c20a0efb429e62988778be1c8b1dcf4176c960","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"098b970f1c395e125147a5b002473f6c46fab77c0c4b1bc8798ff0be88481ef9","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"51e6698d1f2c548698659b0a6b80cfc400ffa749ea4fa8e76cdfd296d7562ef4","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"1a021b3a4cc71cff73776a6a289af64d514f0fc6834d1272adb4f378cb58b8d2","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":4,"conflict_id":"4a0228873a3e58ae08f0e0f14eb9120394f24c5a0d2e8d73db30af5150916ff9","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":0,"conflict_id":"096836b6fbe2090bdf2be3217c96aa77d9baaa6fc828b6a9b4d6c3135a2d9dd6","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":1,"conflict_id":"cc3e3ef5c3b74de59d5c2bac39561e895475e1e4604ef887afaeb116bf5c811a","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"b211f952b20a79551f71232c26db88c6826891a360f3ad6ed1751ffb6e1a4651","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":3,"conflict_id":"96e2e86fa5d0d81f02e82dc695af38946b4885d5f0da32d97c48290efa0a596a","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":4,"conflict_id":"e40af2a9d855ba4cd5c7fb17e13f5986d705539c8a9f26ace7078c3f23f4f815","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":5,"conflict_id":"49ddf5b3f425c761d55123d9a70581feb7e6281b8a12a63e3e0fa2e40c65bf9a","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"c9ae3bca3f5ebf47cd0db71b1258f60c55c53f0f189cd5e30975f508017665a4","disposition":"folded","section":"§4"}]}
-->
