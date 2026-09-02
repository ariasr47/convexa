# session-day-tape-capture — spec

**Source brief:** .spire/clusters/tech/contracts/session-day-tape-capture/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-29 — GATE Z AC-32: do not distinguish “before we recorded” from “no tape that day”; ship-blocking AC-32 dropped; no store-start watermark.

## 1. Goal + scope

Persist a **replayable open-to-close research day** for a **closed watchlist** (SPY, QQQ, IWM) so a cancelled Massive subscription does not erase Tuesday’s **price tape + periodic GEX structure**. Path-A appends every already-received stocks-WS `Trade` and `Quote` on `StockStreamHub` instead of dying as latest-wins `price:{SYM}`. Path-B keeps timed options-structure snapshots from already-paid `refresh_analytics` `_vendor` (still dropped from the 48/14d ring). The buyer is the **research operator**, not the trader. This slice **stores**; it does **not** play the tape, fill session-archive holes, change live scoring, or add trader chrome.

Owner **D1** (2026-08-29): Path-A keep-set is **every** decoded `StreamKind::Trade` and **every** decoded `StreamKind::Quote` already delivered for the locked trio. Recv never awaits disk; overflow is a Path-A gap, not a quieter keep-set. 1-second last-quote sampling is out (it would make operator `{n_quote} quotes` a renamed downsample).

Owner **D2** (2026-08-29): Path-A window is Massive-covered weekday hours **04:00–20:00 ET** (`ClosedPre` + `Rth` + `AfterClose`). Overnight **20:00–04:00** is nothing to keep, not an empty tape. Weekend stays ineligible. Path-B marks remain **09:30…16:00**. Partial / through-window still judge **regular hours 09:30–16:00 only**; extended-hours ticks are extra kept data, not a completeness requirement.

Owner **D3** (2026-08-29): missing or unwritable **dedicated** tape root → process still binds; operator/CLI/logs show `session day tape not storing`; **trader UI is silent**. Capture is **on** when that root is present, writable, and non-colliding. Refuse to start **only** if the tape path would collide with session-archive index, session-archive body root, or the 48/14d ring. Unset root is honest not-storing, not a nested default path.

Owner **GATE Z — AC-32** (2026-08-29): Do **not** distinguish “before we recorded” from “no tape that day.” There is no recorded store-start fact (no baked date, no marker file, no `min(present)` / first-arm-as-start). A named past weekday with no day container is **`NoIdentity`** / `no session day tape…`. Default **today** never pretends old history is a failure (list is stored days only). Ship-blocking **AC-32** is dropped. Operator literal `session day tape not expected before storing…` is **not required**. Store derive must not emit `NotExpectedPreStore`. The Axis A type arm may remain in the exhaustive match as unused, or be deleted; if kept, it has **no required operator outcome**. Poison still forbids `SESSION_DAY_TAPE_STORE_STARTED` / watermark / first-arm-as-start. Same residual as session-archive coverage (no `since`).

<!-- spire:gate-z-resolution:v1 AC-32 folded — owner A 2026-08-29: do not distinguish before-we-recorded from no-tape-that-day; named past weekday with no day container is NoIdentity; no store-start watermark; pre-store literal not required. -->

**In scope:**

- Forward capture, ET weekdays, sibling closed watchlist **SPY, QQQ, IWM** (not an alias of `ENSURE_SYMBOLS` / `WARM_SYMBOLS` / universe).
- Path-A sidecar on the existing `StockStreamHub` (one stocks socket): append-only trades **and** quotes already received in 04:00–20:00 ET; gap records on lag / channel-full / hub close / persist fault. Recv only `try_send`s events; the writer task is the only Path-A disk waiter (coalesced gap on overflow — §2.2).
- Path-B: at most one already-paid `VendorBundle` snapshot per clock-aligned 5-minute mark **09:30, 09:35, …, 16:00 ET** from `refresh_analytics` only — **no** `spawn_capture`, **no** extra REST, **no** OPRA. Mark-gaps materialize on load for armed marks with no snapshot (§2.3).
- Sibling research day-tape store (not session archive, not 48/14d ring, not a `MarketDataPort` playback arm). Ring prune cannot delete a tape day. Session-archive bodies do not move.
- Operator list/load under `/api/_research/` (token-gated like session-books; `vendor_called: false`; Pages trader origin 404s `_research` / `_metrics`). Optional clap twin titled `session-day-tape` is not a substitute for HTTP. Combined Path-A + Path-B in one envelope; no path filter.
- Honest occupancy: ineligible-weekend · not-elapsed · not-storing · no-identity · empty-while-storing · Path-A hub/writer gap · Path-B mark gap · Path-B not-capturing · unreadable · partial · through-window (clock fact, **not** a success class) · not-in-watchlist · unauthorized. Never coverage `present` / `missing`. Never operator `complete_rth`. Pre-store is **not** a distinct operator class (GATE Z; same residual as coverage, no `since`).
- Isolation: tape write failure never fails bundle / scan / SSE / ensure; sidecar never dims or blanks live ticks; score / tier / fingerprint byte-identical; `Authorizes: nothing`.
- Tape occupants never `MarketDataSourceKind::LiveMassive` and never coverage `present`.

**Out of scope:**

- Playing the tape into the ticker page, live stream, `PriceCache`, or `MarketDataPort::Fixture` (`day-replay-mock-adapter` stays blocked-on).
- S3 / OPRA flat files (`massive-flat-file-keep`).
- Changing live scoring, tier, entry gate, fingerprint, scanner, or live ticks.
- Inserting tape / reconstructions / fixtures as live paid session books; filling coverage holes; starting ensure; moving session-archive bodies.
- Trader UI, nav, Settings, Ask-AI, Ticker/LiveTape chrome, or a `/_ops/metrics` tape widget (`NO_UI_CHANGE`).
- Expanding the watchlist; a second websocket; a new Options poller; storing the warmer’s ~25s firehose as the Path-B series.
- Backfill of days before storing started.
- A store-start watermark, baked calendar date, marker file, `min(present)` window, or `SESSION_DAY_TAPE_STORE_STARTED` (GATE Z; coverage analog, no `since`).
- Research-lab UI, hist-chain, telemetry SLOs, Kubernetes/Kafka.

**Future (deliberately deferred):**

- Day replay through the existing live contract.
- Entitled next-day S3 trades/quotes/aggregates, never as `live_massive`.
- Operator lab UI; watchlist expansion by owner decision; optional 60s Path-B grain; NYSE holiday calendar; named tape retention / cold archive; remote body store.
- Explicit `since` / store-start watermark (not v1; GATE Z accepted residual).

## 2. Architecture

This slice adds a **sibling research day-tape store** and two **off-request-path writers**. It does not become a `MarketDataPort` arm, a session-archive occupant, a 48/14d ring row, or a ticker-page clock. Cite live Rust (`cited-code-is-verified-not-assumed`); do not cite Python or briefing HTML as an oracle.

**Reused surfaces (read at source):**

- Path-A feed: `StockStreamHub` in `apps/api/src/infrastructure/massive/ws.rs` — **one** socket (`BROADCAST_CAPACITY = 4096`), `subscribe_events()` broadcast. SSE in `routes/stream.rs` latest-wins `PriceCache.set_price`. Attach the sidecar to `AppState.stock_hub.subscribe_events()`, **never** to CLI `run_price_stream` / `MassiveStockStream::connect` (that constructs a second hub).
- `StreamKind::{Trade, Quote}` and `StreamEvent` in `domain/price.rs`. Do **not** persist `LivePrice` — `display_price` already collapsed trade vs mid.
- Path-B fetch: `refresh_analytics` in `services/analytics.rs` (warmer, `WARM_INTERVAL_SECS` default **25** in `config.rs`) which **intentionally drops** `_vendor` (“warmer / refresh_analytics must not capture”). `spawn_capture` remains only ticker-cold / DTE-filter / `load_or_compute` miss / scanner slow-lane (`analytics.rs` + `chain_snapshot/capture.rs`).
- Session archive: first-wins `(symbol, et_date)` via `insert_if_absent`; `ENSURE_SYMBOLS = ["SPY","QQQ","IWM"]` in `ensure.rs`. Coverage `classify_loaded` in `coverage.rs` maps `(LiveMassive, LiveMassive)` → `present`. Tape load **never** calls it.
- `MarketPhase::classify` in `domain/market.rs`: weekday 09:30–16:00 ET inclusive is `Rth`; before 09:30 `ClosedPre`; after 16:00 `AfterClose`; weekend `ClosedPre`. There is **no** overnight arm — Path-A’s 04:00–20:00 window is an ET clock predicate, not `== Rth`.
- `MarketDataPort` is `Live` | `Fixture`; `kind()` maps to `MarketDataSourceKind::{LiveMassive, Fixture}`. `FixtureCatalog::resolve` is a frozen sample, **not** a tick clock. Do **not** add a third `MarketDataSourceKind` variant.
- Token gate: `health::metrics_token_ok` as used by `routes/research_session_books.rs`. `GET /api/_metrics` in `routes/health.rs` is **not** the tape vehicle.
- Body-root identity: `body_root_conflicts` in `config.rs` (candidate equals or nests under ring store or archive index). **Extend** it so the tape root also conflicts with session-archive **body** root.
- Spawn seam: `server.rs` after listener bind and `stock_worker.start()`, beside `warmer::spawn` and `ensure_worker::spawn`.
- Pages: `functions/api/[[path]].ts` already 404s `/api/_metrics` and the entire `/api/_research/` prefix.

**New modules:**

- One-way leaf `apps/api/src/services/day_tape/` (signals / score / gate / fingerprint / ensure / coverage do not import it).
- HTTP adapter `apps/api/src/routes/research_session_day_tape.rs` beside `research_session_books.rs`. Register `GET /api/_research/session-day-tape/{symbol}` and `.../{symbol}/day` so Axum cannot bind them as session-books `{symbol}`. OpenAPI graph churn is accepted; trader UI must not consume the operations.
- Optional clap `Commands::SessionDayTape` dispatched like `ArchiveCoverage` / `Capacity` (`ExitCode` before `run()`). Stdout title stays `session-day-tape`. Not a substitute for HTTP; `interface_conformance.mjs` does not execute it.

<!-- spire:council-resolution:v1 34c34be2ed9a717b9d810d86f41567cebd16d688c1cff6b7c867a8488b1aaad9 folded -->

### 2.1 Closed watchlist, day identity, clocks

**Watchlist.** Process-start sibling closed set whose v1 members are exactly **SPY, QQQ, IWM**. Not an alias of `ENSURE_SYMBOLS` (ensure-set edits must not resize the tape), not `WARM_SYMBOLS` / `DEFAULT_LIQUID` (ten names), not `universe.json`. Not operator-editable this slice; no cap-8 expansion. Symbols uppercased. Default trio is already a subset of `DEFAULT_LIQUID`, so default hub membership does not grow.

**Day identity.** `(symbol, et_date)` with `et_date` = America/New_York calendar `YYYY-MM-DD` via the same rule as `et_date_from_as_of` / `today_et_date` (not UTC day). One day container per identity. **Not** first-wins one body. **Not** `(symbol, as_of)` ring identity.

**Path-A append window (D2).** Eligible ET **weekdays** during Massive’s stock session: **04:00 ≤ t < 20:00** America/New_York (`ClosedPre` 04:00–09:30, `Rth` 09:30–16:00, `AfterClose` 16:00–20:00). Overnight 20:00–04:00: **do not append** — not `empty_while_storing`. Weekend: **ineligible**, no expected tape. Exchange-holiday weekdays stay eligible (no holiday table); a holiday with no prints is empty-while-storing.

<!-- spire:council-resolution:v1 10068494c0c42e4a1fcf0300146dcbe7cc8a13bd87558d93f265a025eeac29ac folded -->
<!-- spire:council-resolution:v1 f4beceacb24517e096f34206ac052865c5f87eb0647d538ca38932e42ec260f9 folded -->

**Path-B marks.** Clock-aligned America/New_York grid **09:30, 09:35, …, 16:00 inclusive**. Independent of `WARM_INTERVAL_SECS`. On each already-paid `refresh_analytics` success for a locked name, assign `floor(now_et, 5min)` and persist **at most one** snapshot per mark. The **16:00** mark may be filled by the first already-paid fetch whose ET time is in **[16:00, 16:05)** (warmer has no phase gate; `MarketPhase` treats `t > 16:00:00` as `AfterClose`, so Path-B must **not** filter on `== Rth`). A silent mark (not armed then) is **partial**, not a fabricated gap grid. A mark with no snapshot while Path-B storing was on is an honest **gap** (materialized per §2.3).

<!-- spire:council-resolution:v1 cc9110527a6073f28ef58ec787035bdf0bb501381071bbc9e8dab082bd9327a4 folded -->
<!-- spire:council-resolution:v1 2b74bb893169eac2d2bd508d3f8727b8aade005424a6d910c0d748653cb9a584 folded -->

**Completeness clock (Axis C).** Partial / through-window judge **09:30–16:00 ET only**, independent of tick counts and of Path-A’s extended-hours keep. Extended-hours ticks are extra content: not required for `ThroughWindow` and not `EmptyWhileStoring`.

### 2.2 Path-A sidecar (D1)

```
Massive stocks WS (existing single socket)
  → StockStreamHub.event_tx
       → SSE (unchanged): recv → apply_event → set_price
       → tape Path-A sidecar: recv → filter watchlist + 04:00–20:00 ET weekday
            → every Trade + every Quote
            → try_send decoded StreamEvent only
            → bounded mpsc (capacity 4096) → writer task appends JSONL
            → on Full / Lagged / Closed: recv latches gap_pending (no I/O)
            → writer select: event recv | gap notify → one coalesced gap JSONL
  (lag of sidecar ≠ lag of SSE)
```

Dedicated task after listener bind: `stock_hub.subscribe(tape_symbols)` (same `HubCmd::Subscribe` as `AppState` already does for `warm_symbols`; **not** `LiveCapacity::admit_and_subscribe` — tape is not an SSE subscriber and must not bump `subscriber_count`). Then `subscribe_events()`, filter client-side.

**Capacity.** The writer event channel is a bounded mpsc of **4096** — the same numeric bound as hub `BROADCAST_CAPACITY = 4096`. That bound is this contract; do not silently retune it (AC-7 Full fixtures assume 4096). Overflow is a Path-A gap, not a quieter keep-set.

**Recv loop — never I/O.** Recv **never awaits disk and never writes the store**. It only:

1. Filters watchlist + 04:00–20:00 ET weekday.
2. `try_send`s each decoded `Trade` / `Quote` (`StreamEvent` fields as on the stream — not collapsed `LivePrice`) into the 4096 event mpsc.
3. On `try_send` **`Full`**, `RecvError::Lagged(n)`, or hub `Closed`/reconnect: increment a process-local `dropped` counter (`+1` on Full, `+n` on Lagged), set a latched `gap_pending` flag, notify the writer, and **continue**. Do **not** `try_send` a gap record into the event channel — that channel is already `Full` on the overflow path, and a second lane that `await`s disk from recv would break `[live-vs-static-isolation]`. Do not `set_price`. Do not emit SSE.

**Writer task — the only Path-A disk waiter.** The writer `select!`s on mpsc event recv **and** a `Notify`/`watch` of `gap_pending` so a quiet tape still materializes a latched gap. When `gap_pending` is set, it appends **one** Path-A gap JSONL record carrying the coalesced `dropped` count (not one record per dropped event), then clears the latch and zeros the counter. Then it appends the event if one was received. Persist fault on an event or on that gap record is the writer’s: S2 skip line; the writer may append a gap for that fault because it is already the disk task. Recv never participates.

Hub `Lagged` becomes a list/load gap the same way: recv sets the latch (no I/O); writer appends the coalesced occupant. AC-7 stays observable without recv awaiting I/O.

Keep-set is **unsampled** trades and quotes already on the stocks path (not OPRA, not a second socket). Writer overflow does **not** change the keep-set; it is a gap. Two quotes in the same second both remain.

<!-- spire:council-resolution:v1 daf849244904c57d5b0d1bb1aa0a95af1be2b52ee9f380d466a11c6fe9358ee2 folded -->
<!-- spire:council-resolution:v1 f99f570811d7a8d0b983ec9b13bba4b68e418c1f4098d1b72ecab44945aa33fd folded -->

Path-A body: one append-only JSONL file per `(symbol, et_date)`. Crash: trailing partial line skipped on read (`unreadable` last record, prior lines intact). Gap records live on that same JSONL as first-class occupants (kind distinct from `trade`/`quote`).

**Quiet-day mint.** Empty-while-storing ≠ no-identity only if the day container is created when capture **arms**, not when the first tick arrives. On first capture-on for `(symbol, et_date)`, mint the Path-A log (zero records allowed).

### 2.3 Path-B persist hook

Only inside `refresh_analytics` after a successful compute, for tape-set symbols, for a mark in 09:30…16:00. Watchlist / mark / interval predicates run **before** keeping `vendor` (do not clone a 14k-contract book every 25s to drop it). `tokio::spawn` persist; warmer `Ok(snap)` does not await it. **Poison: still no `spawn_capture`.** Cold/scanner `spawn_capture` still feeds the 48/14d ring + first-wins archive only.

If a tape name is not in `warm_symbols`, or the already-paid warm/refresh fetch is off: Path-B is `PathBNotCapturing` — **no new REST loop**. Default intersection is full (SPY/QQQ/IWM ⊂ `DEFAULT_LIQUID`). Do **not** silently union tape names into `WARM_SYMBOLS`.

Path-B body: unique-per-put files per snapshot (mint locator with as_of_ns + nonce, sibling of `mint_body_locator`), listed from the day index. Record the Path-B **capture-on interval** when Path-B storing **arms** for the identity (warm/refresh on for that locked name), not when the first snapshot succeeds. Path-B series / interval mint is that arming (quiet-day analog). First persist-hook fire may still mint a snapshot file; it is not required for the interval to exist.

**Mark-gap materialization (required read-time derive).** List/load occupancy for Path-B gaps is **not** “only if a gap file was written.” On list/load, when Axis A is `StoringReady` and Path-B is not `PathBNotCapturing`, walk every clock-aligned mark **09:30, 09:35, …, 16:00**:

- Fill window for mark `HH:MM` is `[HH:MM, HH:MM+5min)` America/New_York (16:00 uses `[16:00, 16:05)` as already locked).
- If the mark’s fill window lies **outside** the recorded Path-B capture-on interval → **silent** (contributes to Axis C `Partial`; do **not** emit `PathBMarkGap`).
- If the fill window lies **inside** the capture-on interval, that window has **closed**, and no snapshot exists for that mark → emit `PathBMarkGap` with `path-b gap: no snapshot at {HH:MM} ET for {SYMBOL} on {ET_DATE}`.
- If a snapshot exists for that mark → that mark is occupied.
- If the fill window has **not** yet closed (in-progress day) and no snapshot yet → not a gap yet.

A through-window Path-B day (capture-on covers 09:30–16:00) with every refresh missed therefore has **zero snapshots and one `PathBMarkGap` per grid mark** — operator `path-b snapshots: 0 snapshots · {g} gaps` plus per-mark gap literals. It is **not** `no path-b snapshots…` (that class is 0 snapshots **and** 0 gap-mark occupants).

Write-time mint is **optional extra** (persist hook or end-of-window sweeper may write a gap file). Read-time derive remains the occupancy source of truth so a missed mint cannot collapse through-window all-missed-refresh into `no path-b snapshots…`. No fill fetch. No interpolation.

### 2.4 Occupancy (three composing axes)

Occupancy is **not** one mutually exclusive tag and **not** coverage `IdentityStatus`. Tape types live on the tape leaf. `coverage.rs` does not import the tape module. Exhaustive match per axis so a new arm cannot silently become “empty day.” There is **no** occupancy arm `complete_rth` / “complete day.”

<!-- spire:council-resolution:v1 17adc3193c8d143e32a481f06345e41d7e5aaef9a6746e8d931ef5133bf23350 folded -->
<!-- spire:council-resolution:v1 446e10df9ce747f4c951c8888533ac9b92e970925e8aad209faea71c42d0fb0e folded -->
<!-- spire:council-resolution:v1 2551a5c7bacc3cd30aeb32d20726acee9b060c5321401128b8567d77329739bc folded -->

**No storing-window / no `since` (GATE Z).** List/load return stored days and named-identity loads, not a tape-enabled-at watermark. Do not infer a store start from `min(present day container)` (that is the first **stored** day and would invent a window). Do not bake a calendar start. Do not write `SESSION_DAY_TAPE_STORE_STARTED`, a marker file, or treat first-arm as start. Default list is **stored days only**, so old history is not a default failure grid. On the **named-date** path, a locked-watchlist capturable weekday with no day container is **`NoIdentity`** — not a distinct not-expected-because-not-yet-storing class. That collapse of “before we recorded” into “no tape that day” is the **accepted residual** (same as session-archive coverage). Explicit `since` is Future-dated.

**Axis A — gate** (one of, day identity, before content). Evaluation order is binding:

1. `NotInWatchlist` before `NotStoring` (a foreign symbol is never a not-storing grid).
2. `NotStoring` before weekend / not-elapsed / content (unset root is store-level).
3. `IneligibleWeekend` before `NotElapsed` (a future Saturday/Sunday is weekend, not not-elapsed).
4. `NotElapsed` before `NoIdentity` (a locked-watchlist **weekday** `et_date` **strictly after** today ET is not a missing row).
5. `NotExpectedPreStore` is **not** a store-derive result (GATE Z). The type arm may remain unused in the exhaustive match, or be deleted; derive must **not** return it. If the arm is kept, it has no required operator outcome.
6. `NoIdentity` before `Unreadable` / `StoringReady`. A named past weekday with no day container is `NoIdentity`.

Unauthorized is the HTTP token miss (401), not a stored occupancy arm.

| Type | When | Distinct from |
| --- | --- | --- |
| `NotInWatchlist` | symbol outside locked trio | attempted-empty |
| `NotStoring` | store disabled / unset / unavailable | a grid of empty days |
| `Unauthorized` | read-path token miss (not stored occupancy) | empty tape |
| `IneligibleWeekend` | ET Saturday/Sunday | empty-while-storing, coverage not-yet-due, NotElapsed |
| `NotElapsed` | locked-watchlist weekday `et_date` after today ET | NoIdentity, IneligibleWeekend, coverage not-yet-due |
| `NotExpectedPreStore` | **Unused (GATE Z).** Never derived from the store. No watermark exists to decide “before this environment was storing.” No required operator outcome. | not an operator class this slice; do not split NoIdentity |
| `NoIdentity` | storing, eligible, capturable date, no day container — including a named **past** weekday with no row | quiet attempted day, NotElapsed, weekend |
| `Unreadable` | identity exists; body not loadable | empty, not-storing |
| `StoringReady` | gate passed; path axes below apply | — |

**Axis B — per-path content** (Path-A and Path-B independent):

| Type | When |
| --- | --- |
| `EmptyWhileStoring` | that path armed; stored record count of that path is 0 |
| `Occupied` | that path has ≥1 stored record (not a success badge) |
| `PathAHubGap` | `Lagged(n)`, writer-channel full, hub Closed/reconnect, persist fault. Coexists with empty or occupied ticks. Occupant is the writer’s coalesced gap record (§2.2), never a recv-loop disk write. |
| `PathBMarkGap` | clock-aligned mark in 09:30…16:00 with no snapshot while Path-B storing was on, **after that mark’s fill window closed**. Stays a gap. No fill fetch, no interpolation. Emitted by the §2.3 read-time derive (write-time mint optional). |
| `PathBNotCapturing` | already-paid warm/refresh off, or tape name not in the warm set — **no** fabricated mark-gap grid |
| `Recording` | that path is armed and the ET day is still in progress (not a day verdict; **not** printed as operator `recording`) |

`PathAHubGap` is not `PathBMarkGap`. `PathBNotCapturing` is not `PathBMarkGap` and not `EmptyWhileStoring`. Kind-split Path-A counts and Path-B snapshot counts remain the honesty surface; occupancy does not encode them as a percent. Path-B `EmptyWhileStoring` (`no path-b snapshots…`) is 0 snapshots **and** 0 derived gap-mark occupants — it cannot describe a through-window all-missed-refresh day.

**Axis C — per-path capture span** (only when Axis A is `StoringReady` and that path was armed). Independent of tick/snapshot counts. One clock: RTH 09:30–16:00 America/New_York.

| Type | Derivation |
| --- | --- |
| `Partial` | recorded capture-on interval does not cover [09:30, 16:00] ET |
| `ThroughWindow` | recorded capture-on interval covers [09:30, 16:00] ET |

Path-A: sidecar records capture-on from the instant it is recv-looping with store enabled for that identity, through disable/stop/end of window. `ThroughWindow` iff armed-from ≤ 09:30 ET and armed-until ≥ 16:00 ET. Hub-gap records count as capture-on evidence, not as ticks.

Path-B: each mark 09:30…16:00 is snapshot **or** `PathBMarkGap` **or** silent. Silent ⇒ `Partial`. `ThroughWindow` iff no silent marks. All-gaps is still `ThroughWindow` on this axis — and is **not** a complete day (Axis B carries the derived gaps).

`ThroughWindow` cannot be known until capture has run through 16:00. `Partial` can be known earlier. While still armed before 16:00 with start ≤ 09:30, Axis C is not yet `ThroughWindow` and is **not printed**.

Compositions that must remain representable: `ThroughWindow` × Path-A empty; `ThroughWindow` × Path-B all gaps; `Partial` × empty; `Partial` × occupied; Path-A `ThroughWindow` × Path-B `PathBNotCapturing`; occupied on one path × empty on the other.

Operator strings are §4. Internal type names are **not** copy. List/load must not emit coverage `present`, `missing`, `not yet due`, `blocked occupancy`, or withdrawn tokens `not_due` / `empty_attempted` / `recording` / `closed` / `complete_rth`. List/load must **not** require a distinct pre-store operator class.

### 2.5 Store + enablement (D3)

Adapters: Disabled / Memory / Json+FS / Failing / (postgres feature) Postgres **index** + filesystem **bodies**. Ring Postgres BYTEA is the wrong place for a day of ticks + many full chains. **No prune API** this slice.

Enablement is the **dedicated tape root**, env `SESSION_DAY_TAPE_BODY_ROOT` (no nested default under `data/`):

| Root | Serve | Capture | Operator |
| --- | --- | --- | --- |
| Unset | listener binds | off | `session day tape not storing` |
| Set, missing or unwritable | listener binds | off | same not-storing; no fake stored success |
| Set, collides with session-archive index, session-archive body root, or 48/14d ring | **refuse construct** (extend `body_root_conflicts`) | — | start error; desk must not share those roots |
| Set, present, writable, non-colliding | binds | **on** | keep what we pay for |

Enablement is that root **only**. There is **no** store-start watermark beside it: no baked date, no marker file, no `min(present)`, no first-arm-as-start, no `SESSION_DAY_TAPE_STORE_STARTED`. Capture-on intervals in Axis C are per-identity arming while storing, not a process-lifetime “storing since.”

Runtime write failure still swallows (`best-effort-isolated-or-null`): bundle / scan / SSE / ensure stay up; that event/mark is not on the tape; S2 skip line fires. `[production-fails-closed]` does **not** gain a tape-root prerequisite; collision is the only tape start refusal.

<!-- spire:council-resolution:v1 53b87f1e6c36dc26cff82a944dc8cc11f0d4e2c5c5f78368c7288e1392bd56b8 folded -->
<!-- spire:council-resolution:v1 dd04f6735701c4e71afbb01821b00c6b5d2d2755f491348a06be9048237005cf folded -->

Index + Path-A JSONL + Path-B unique-per-put files live **under** that dedicated root. Do not default a path when the env is unset.

### 2.6 Provenance — never `LiveMassive`

Outer occupancy is the Axis A/B/C product (`TapeCapture` wrapper). No conversion function into `MarketDataSourceKind`. No `LiveMassive` / `Present` / `Missing` arm on tape occupancy.

If Path-B structure reuses `to_wire` / `serialize_capture` for chain/greeks bytes, the tape writer **drops** the `MarketDataSourceKind` discriminant **before** append. Stored Path-B bytes after persist cannot classify as `LiveMassive`. Inner historical fact, if shown, is tape-local “already-paid REST as history” — not `MarketDataSourceKind::LiveMassive`, not coverage `present`. Do not restamp inner bytes as `Fixture` (that would read as `blocked occupancy` if leaked into coverage).

List/load provenance is computed from the wrapper only. Tape persist functions live in the tape leaf. Tape never joins `capture_into` → `archive_session_best_effort`. A reconstructed / S3 / `LiveMassive`-stamped artifact offered as this tape is not a tape hit.

<!-- spire:council-resolution:v1 7da8e8369c6d39ead11394e8ed48583873c56d5e3fcd4d07bcdc69f7cdcea38d folded -->

### 2.7 Read path

Operator research list/load under `/api/_research/session-day-tape/…` only. Store only. `vendor_called = false`. `Authorizes: nothing`. Never call `stock_hub.subscribe`, `massive.*`, `prices.set_price`, or `gex_cache.set`. Do **not** nest tape JSON on `GET /api/_metrics`. Do **not** add playback endpoints. Combined Path-A + Path-B in one envelope; **no** path query filter.

List returns **stored days only**. It does not invent pre-store rows, future `et_date` rows, or a historical failure grid. Not-elapsed is a **load** class. A named past weekday with no container is load `NoIdentity`, not a list clock cell.

Auth: `metrics_token_ok` when `METRICS_SECRET_TOKEN` is set; open when unset (local). **Not** a trader session cookie — do not mark `"auth": true` on conformance entries.

### 2.8 Isolation + structural poison

- `[operator-vs-trader-path-separation]`: writers background; read operator/research; Pages 404 `_research` / `_metrics`; stored ticks never redistributed on a trader route.
- `[best-effort-isolated-or-null]`: fire-and-forget spawn + swallowed store errors (same shape as `spawn_capture` / `archive_session_best_effort`).
- `[additive-keeps-score-byte-identical]`: one-way leaf — `quant-engine`, `generate_signals`, gate, fingerprint do not import the tape module; warmer still `gex_cache.set(snap)` from the same `compute_analytics` result. `Authorizes: nothing`.
- `[live-vs-static-isolation]`: independent `broadcast::Receiver`; Tokio broadcast drops only a lagged sidecar; SSE cursors stay independent; tape never `set_price`; Path-A recv never awaits disk (Full/Lagged/Closed latch only).
- `[present-is-live-paid-only]`: tape never `insert_if_absent` as `LiveMassive`; coverage `present` stays “loadable LiveMassive session book.”
- `[absent-is-not-none]`: the Axis A/B/C product; operator strings in §4. Pre-store is not a distinct operator absence (GATE Z residual).
- `[single-ticker-on-demand]`: no trader request starts capture or a vendor fetch.
- `[no-secrets-in-image]`: tape root from runtime env; blobs get the same `apikey` / `api_key` debug assert as `capture.rs`.
- `[local-evidence-is-not-hosted-evidence]`: hermetic tape tests are local; CLI **Evidence: local** is not production coverage.
- Massive license: stocks WS + paid REST we already fetch. Not OPRA quote files, not S3.

Poison (build-red, non-vacuous):

1. `refresh_analytics` still does not call `spawn_capture`.
2. Tape module has no `insert_if_absent` / `archive_session_best_effort` / `spawn_capture` call.
3. Scoring/engine crates do not import tape.
4. No `fn` converts a tape record into `MarketDataSourceKind::LiveMassive` + session-archive body; occupancy type has no `LiveMassive` / `Present` / `Missing` arm.
5. Occupancy match is exhaustive per axis; a quiet through-window fixture cannot classify as `NoIdentity` or as a complete-day tag (there is no such tag).
6. A planted Path-B body whose inner codec still carries `LiveMassive` is `Unreadable` or blocked-reconstructed, never tape-hit framing and never a coverage `present` flip.
7. Two quotes in one second both remain on Path-A (1s last-quote must not silently return).
8. Weekend is not empty-while-storing; not-storing is not a grid of empty days; not-elapsed is not `no session day tape…`.
9. Path-A recv loop does not call JSONL append / store persist (only `try_send` + latch/notify). The writer task is the only persist caller for Path-A events and Path-A gap records.
10. `day_tape` sources contain none of `SESSION_DAY_TAPE_STORE_STARTED`, `SESSION_DAY_TAPE_STARTED`, `store_started`, `storing_since`, or a watermark / first-arm-as-start used as a store-start fact. Store derive never returns `NotExpectedPreStore`.

**Not buildable / rejected:** second stocks websocket; Path-B new REST / `spawn_capture`; elapsed 300 s wall-clock as the Path-B series; 1s last-quote keep-set; RTH-only Path-A that throws ClosedPre/AfterClose ticks; aliasing `ENSURE_SYMBOLS` / cap-8 editable watchlist; default-on nested tape path that takes the desk down when missing; nesting tape on `_metrics`; `MarketDataPort::Fixture` as this tape; trader chrome / playback HTTP; coverage cells on this vehicle; operator `complete_rth` success class; recv-loop `await` of disk to save a gap; Path-A/Path-B-only HTTP filters; store-start watermark / baked date / marker file / `min(present)` / first-arm-as-start to split NoIdentity into a pre-store class.

## 3. Acceptance criteria (with user stories)

Actors: research operator (list/load / logs / optional CLI); trader (silence). Every criterion is observable without reading source. **(SB)** = ship-blocking. Hollow “renders without throw” does not satisfy a `test` mark. GATE Q must show a **rejecting** path (write-fail isolation, unauthorized refuse, tape does not mint a live paid present book, weekend is not empty-complete, two quotes in one second both remain, writer-channel full still yields a Path-A gap occupant, through-window all-missed Path-B is mark-gaps not `no path-b snapshots`, future ET date is not-elapsed) **and** an accepting planted through-window fixture. Prefer **one** hermetic injected-clock pass over one-test-per-AC. No DOM harness; trader silence is structural (empty-diff / copy-table scan, Pages 404, OperatorMetrics closed stage set). GATE Z: do **not** plant a store-start watermark to invent a pre-store class; named past weekday with no container is NoIdentity.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 **(SB)** | S1 | Given storing is on and the live stocks path delivers events for SPY, QQQ, and IWM on an ET weekday D, each of those three names has a Path-A tape for D that contains those events. | test |
| 2 **(SB)** | S1 | Given two successive stock-path events for locked name S on D, both remain loadable on the Path-A tape afterward (the later event does not replace the earlier one). | test |
| 3 **(SB)** | S1 | A loaded Path-A tape for a locked name includes last-trade prints **and** every decoded quote already delivered on that same stocks path that day — not last-trades only, not last-quote-per-1-second. | test |
| 4 **(SB)** | S1 | Given two quotes for S in the same one-second bucket, both remain loadable (a 1-second last-quote sample must not silently land). | test |
| 5 **(SB)** | S1 | Path-A for a locked name does **not** include options-quote / OPRA events. | test |
| 6 **(SB)** | S1 | A name that is not SPY, QQQ, or IWM receives **no** Path-A tape and **no** Path-B series (not an empty-while-storing day that implies we tried). Operator outcome is `not in tape watchlist: {SYMBOL}`. | test |
| 7 **(SB)** | S1 | Given hub lag, writer-channel full (event mpsc at 4096), hub close/reconnect, or persist fault on Path-A, list/load shows `path-a gap: hub or writer for {SYMBOL} on {ET_DATE}` (one coalesced occupant for a burst of drops; optional vouched suffix ` · {n} dropped`) and does not rewrite the day into `no path-a ticks…`. Ticks may exist **and** a gap. | test |
| 8 **(SB)** | S1 | Loaded Path-A events are `trade` or `quote` records with `kind`, `ts_ns`, and the stream fields `price`/`size` and/or `bid`/`ask` (and `bid_size`/`ask_size`) as on `StreamEvent`. The tape is not a sequence of collapsed `LivePrice` / `price:{SYM}` snapshots, and not a kind-only stub array. | test |
| 9 **(SB)** | S1 | Given already-received stocks-path events in weekday 04:00–09:30 ET or 16:00–20:00 ET while storing is on, those events are on the Path-A tape. | test |
| 10 **(SB)** | S1 | Given stocks-path events in 20:00–04:00 ET, they are **not** stored and the identity is not classified empty-while-storing because of them. | test |
| 11 **(SB)** | S2 | Given already-paid options structure is being fetched through an ET weekday while Path-B storing is on, each locked name has at most one kept Path-B snapshot per clock-aligned 5-minute mark from 09:30 through 16:00 America/New_York inclusive. | test |
| 12 **(SB)** | S2 | On a complete-capture RTH fixture where an already-paid fetch existed at every 5-minute mark, successive kept snapshots are 5 minutes apart on that grid — not ~25s, not elapsed-from-first 300 s, not 15 minutes, not 60s. | test |
| 13 **(SB)** | S2 | Path-B persistence performs **no additional vendor fetch** beyond the already-paid fetch the live warm/refresh work already made. | test |
| 14 **(SB)** | S2 | The 16:00 ET mark may be filled by the first already-paid fetch whose America/New_York time is in [16:00, 16:05); it is not required to be as-of exactly 16:00:00 and is not left a gap solely because `MarketPhase` is `AfterClose` after 16:00:00. | test |
| 15 **(SB)** | S2 | A kept Path-B snapshot is labeled research tape, **not** a live paid session book, and operator list/load / JSON twin never contain `live_massive`, `LiveMassive`, or `MarketDataSourceKind::LiveMassive`. | test |
| 16 **(SB)** | S2 | Given Path-B storing is on and a 5-minute mark’s fill window has closed with no persisted snapshot, that mark is `path-b gap: no snapshot at {HH:MM} ET for {SYMBOL} on {ET_DATE}` and is not filled by a new vendor fetch or by interpolating neighbors. A through-window day with no Path-B snapshots still lists those mark-gap occupants — **not** `no path-b snapshots…`. | test |
| 17 **(SB)** | S2 | Given the already-paid structure fetch is off (or the locked name is not on that fetch), Path-B is `path-b not capturing: already-paid fetch off for {SYMBOL} on {ET_DATE}`, Path-A may still append, and **no** new vendor poller starts. That literal is not `no path-b snapshots…` and not a mark-gap grid. | test |
| 18 **(SB)** | S2 | Path-B persist does not append a 48/14d ring row and does not `insert_if_absent` a session-archive identity. | test |
| 19 **(SB)** | S3 | Listing stored tape days completes with **zero vendor calls** (`vendor_called` is false). | test |
| 20 **(SB)** | S3 | Loading a stored `(symbol, ET date)` Path-A tape and Path-B series completes with **zero vendor calls**, including on empty, gap, unreadable, not-found, weekend, not-elapsed, no-identity, and not-in-watchlist paths. | test |
| 21 **(SB)** | S3 | After a stored Tuesday exists, a subsequent vendor-unavailable / cancelled condition still lets the operator list and load that Tuesday with zero vendor calls. | test |
| 22 **(SB)** | S3 | A load of `(symbol, et_date)` prints **separate** Path-A and Path-B sections (or independently addressable fields) with distinct literals; one path’s empty does not hide or rename the other. Combined envelope only — no Path-A-only / Path-B-only framing. | test |
| 23 **(SB)** | S3 | When the store vouches Path-A `trade` and `quote` counts, they print as **two** numbers with those words (`path-a ticks: {n_trade} trades · {n_quote} quotes`); a quote is never labeled a trade. | test |
| 24 **(SB)** | S3 | Counts print as Path-A kind counts and Path-B snapshot counts (and vouched gap counts), never a bare percent completeness score (`78% of Tuesday`, `{n}% of the day`, `0%` / `100%` as health). | test |
| 25 **(SB)** | S3 | Successful tape-read framing includes **session day tape** and, when the read vouches it, **loaded from session day tape · no vendor call**, and includes **no** `LIVE` badge, playback label, session-book framing, coverage framing, or ring framing. | test |
| 26 **(SB)** | S3 | Canary secret values present in the environment do not appear in tape bodies or list/load output. | test |
| 27 **(SB)** | S4 | Given storing was on for a full eligible RTH and **no** stock events arrived for S and no Path-A gap records exist, Path-A is `no path-a ticks for {SYMBOL} on {ET_DATE}` — not not-storing, not unreadable, not ineligible, not a coverage `[FAIL]`. | test |
| 28 **(SB)** | S4 | When the tape store is not storing, the operator outcome is `session day tape not storing` — not a grid of empty complete days, not `no path-a ticks…`, not an all-present pass. Desk still serves. | test |
| 29 **(SB)** | S4 | Given an identity whose stored tape cannot be loaded, the outcome is `session day tape unreadable: {reason}` and is not classified empty-while-storing and is not classified not-storing. | test |
| 30 **(SB)** | S4 | Path-A empty and Path-B empty/gapped/not-capturing are independently observable; a present Path-B series does not imply a present Path-A tape, and the reverse. | test |
| 31 **(SB)** | S4 | An ET Saturday or Sunday for SPY, QQQ, or IWM is `session day tape ineligible weekend: {SYMBOL} on {ET_DATE}`: not empty-while-storing, not `no session day tape…`, not a failed complete-day claim, not coverage `not yet due`. | test |
| 32 | S4 | **Not ship-blocking (GATE Z 2026-08-29).** Given storing is on and S is SPY, QQQ, or IWM, a load of a named past ET weekday with no day container is HTTP 200 with `no session day tape for {SYMBOL} on {ET_DATE}` — the same `NoIdentity` class as any other capturable weekday without a row. It is not a distinct “before we recorded” outcome. List returns stored days only and does not invent pre-store rows. Operator literal `session day tape not expected before storing…` is **not required**. No store-start watermark is consulted. | test |
| 33 **(SB)** | S4 | Given capture for D starts after 09:30 ET or ends before 16:00 ET, that identity is `session day tape partial: capture not through 09:30–16:00 ET for {SYMBOL} on {ET_DATE}` and is not claimed complete RTH / through-window. | test |
| 34 **(SB)** | S4 | Given capture-on covered 09:30–16:00 ET, the clock line is `session day tape through-window 09:30–16:00 ET for {SYMBOL} on {ET_DATE} · does not certify open-to-close`. It is not a success badge. Path-A empty or Path-B all gaps still print their Axis B literals beside it. Operator copy never prints `complete RTH`, `complete_rth`, `verified complete`, or `complete day`. | test |
| 35 **(SB)** | S4 | While D=today is still inside 09:30–16:00 ET and capture started at or before 09:30 and has not stopped, list/load omits partial and through-window (no operator `recording` / `closed`). | test |
| 36 **(SB)** | S4 | A holiday weekday with no prints is empty-while-storing (eligible), not ineligible weekend. | test |
| 37 **(SB)** | S4 | Empty-while-storing, not-storing, unreadable, Path-A hub/writer gap, Path-B mark gap, Path-B not-capturing, Path-B empty (0 snapshots and 0 gaps), partial, through-window, ineligible-weekend, not-elapsed, no-identity, not-in-watchlist, and unauthorized outcomes are distinguishable in operator list/load results without reading source. Coverage `present` / `missing` / `not yet due` / `blocked occupancy` never appear as tape occupancy. A distinct pre-store / “not expected before storing” operator class is **not** required (GATE Z). | test |
| 38 **(SB)** | S5 | If a Path-A or Path-B write fails after the live path already had the event or the already-paid snapshot, bundle / scan / live stream / session-ensure still succeed, the tape does not gain that event/mark, and the matching skip line logs (`session day tape write skipped — path-a · trader path unchanged` or `… — path-b · …`). | test |
| 39 **(SB)** | S5 | If the dedicated tape root is unset, missing, or unwritable, the trader desk remains available; capture does not report a false stored success; operator outcome is not-storing. | test |
| 40 **(SB)** | S5 | If the configured tape path would collide with session-archive index, session-archive body root, or the 48/14d ring, the process **refuses to start**. | test |
| 41 **(SB)** | S5 | Enabling tape capture does not fail or delay the trader request path: capture remains off-request, best-effort relative to the desk. | test |
| 42 **(SB)** | S5 | While the sidecar is capturing or skipping, live ticks for the desk continue to arrive; they are not blanked, and live-derived trader UI is not dimmed **because capture is running**. | test |
| 43 **(SB)** | S5 | For the same market inputs, opportunity score, tier, and state fingerprint are byte-identical with capture on vs off and with capture succeeding vs failing. | test |
| 44 **(SB)** | S0 | `apps/dashboard` trader surfaces gain **no** new route, nav item, Settings copy, Ask-AI line, Ticker/LiveTape/Scanner/Positions/Landing affordance, tooltip, or toast mentioning session day tape, Path-A ticks, Path-B snapshots, “saved Tuesday”, or playback. | test |
| 45 **(SB)** | S0 | Trader empty / error / offline / `unavailable this cycle` / `—` / LiveTape copy is **byte-unchanged** by tape persist success, persist skip, list, load, not-storing, or unreadable. | test |
| 46 **(SB)** | S0 | Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (and subpaths), including any tape sibling under those prefixes. Tape is not proxied to the trader origin. | test |
| 47 **(SB)** | S0 | `/_ops/metrics` gains **no** tape matrix, tape chip, Path-A/B counts, or stage named from this feature. Unknown JSON stays unrendered (not p50/p95/headroom/`—`). | test |
| 48 **(SB)** | S0 | Trader-consumed `@convexa/api` / dashboard code does **not** grow a tape list/load operation used by Landing/Ticker/Positions/Scanner/Settings/Ask-AI. | test |
| 49 **(SB)** | S6 | A trader origin cannot obtain a tape list or tape body (refused the same way existing operator/research diagnostics are refused on that origin). | test |
| 50 **(SB)** | S6 | When an operator token is required, a tape read without it is 401 `metrics_unauthorized` with shipped `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` detail and returns no tape body. Trader session cookie is not the gate. | test |
| 51 **(SB)** | S6 | No trader-facing product path redistributes stored ticks or structure snapshots as a market-data feed. | test |
| 52 **(SB)** | S8 | This ship does not play a stored day into the ticker page or the live stream. | test |
| 53 **(SB)** | S7 | Writing or loading a tape does not insert a session-archive identity and does not classify that identity as a live paid **present** book. | test |
| 54 **(SB)** | S7 | Given session-archive coverage for `(S, D)` is missing, capturing or loading tape for `(S, D)` leaves that coverage cell missing. | test |
| 55 **(SB)** | S7 | A tape-derived or reconstructed occupant is never accepted as a live paid session book; coverage/audit of session books does not exit as all-present on the strength of tape. | test |
| 56 **(SB)** | S7 | Existing session-book / ring / coverage closed strings remain on **those** vehicles (`RESEARCH READ — SESSION BOOK`, `RESEARCH READ — STORED CHAIN SNAPSHOT`, `RESEARCH READ — SESSION ARCHIVE COVERAGE`) and are not overwritten by tape framing. | test |
| 57 **(SB)** | S6 | No new named trader dashboard route or screen was chosen this slice. SPEC §4 carries `NO_UI_CHANGE`; no `DESIGN_SYSTEM.md` amendment. **This row does not certify** trader-chrome absence, Pages 404, or `/_ops/metrics` non-render. | review |
| 58 **(SB)** | S8 | This ship does not download or ingest S3 flat files. | review |
| 59 | S8 | This ship does not add a trader/operator lab UI, move session-archive bodies, or expand the watchlist beyond SPY, QQQ, IWM. | review |
| 60 | S6 | Standing-block wording, is/is-not block, glossary sentences, and banned-term table in §4 are the approved copy. | review |
| 61 | S3 | Operator can list/load tape **without** the trader UI (Railway-direct operator GET; CLI twin if present). | review |
| 62 | S4 | Skip and empty copy do not assert dollar loss, prune timing, Massive recoverability, open-to-close completeness, or S3 reconstruct. | review |
| 63 | S3 | License one-liner present on research read: `Our research · not redistributed on a trader route.` | review |
| 64 | S3 | Loading copy (CLI, if present) names a **session-day-tape read**, never “fetching/refreshing from Massive”, “loading 48-ring”, or “loading session book”. | review |
| 65 | S3 | If a CLI exists: standing includes **Evidence: local** and closing **local audit is not production coverage**; weekend / not-elapsed / no-identity / not-in-watchlist remain exit 0 with `Not a coverage miss.`; not-storing and unreadable remain non-zero `[ERROR]`. A distinct not-expected-before-storing CLI class is not required. | review |
| 66 **(SB)** | S4 | Given storing is on and S is SPY, QQQ, or IWM, a load of a weekday `et_date` strictly after today America/New_York is HTTP 200 with `session day tape not elapsed: {SYMBOL} on {ET_DATE}` — not `no session day tape…`, not empty-while-storing, not coverage `not yet due`. | test |

<!-- spire:council-resolution:v1 5380f8da4ad619b65438d35cd37a10c5f6865b5f28304c948c138c741a4a0bb7 folded -->

**Method notes (risk-based).**

- **`test`** owns silent honesty / money / desk failures: append vs latest-wins, unsampled trades+quotes (including two quotes in one second), no OPRA, closed watchlist, 5-minute grain and no extra fetch, provenance not live paid, zero vendor on list/load, absence splits (including not-elapsed vs no-identity; named past weekday with no container is no-identity, not a distinct pre-store class), writer-full coalesced Path-A gap, through-window Path-B all-missed-refresh as mark-gaps, write-fail isolation, live ticks not blanked, score identity, token/Pages/`/_ops` silence, no playback, coverage holes unchanged, no store-start watermark. These can die under a “helpful” fetch, a 25s dump labeled as 5-minute research, a 1s quote sample labeled as every quote, a fixture counted as a live book, a sidecar that starves the live path, a Full path that either blocks recv on disk or drops the gap, or a planted watermark that splits NoIdentity.
- **`review`** owns the AC-27 remainder (no named dashboard route — does **not** replace AC-44–48), no S3 ingest, non-absorption of lab UI / body-move / watchlist expansion, standing-block / glossary / banned-term copy, SPEC §4 `NO_UI_CHANGE`, license presence, loading phrasing, optional CLI evidence class.
- Prefer **one** hermetic pass: inject an ET weekday clock → plant two Path-A trades and two same-second quotes for each of SPY/QQQ/IWM → both quotes loadable, NVDA `not in tape watchlist` → plant already-paid structure at 5-minute marks including a [16:00, 16:05) fill → series is the locked grid, vendor-call counter stays at the already-paid fetches only → load with vendor stub down → still loads → plant write failure → desk/live stream still succeed, skip line fires, tape lacks that mark → plant writer-channel Full (burst past 4096) → one coalesced Path-A gap occupant, live SSE still flows → plant through-window Path-B with no snapshots → per-mark `path-b gap…`, not `no path-b snapshots…` → empty / not-storing / unreadable / weekend / not-elapsed / no-identity / partial / through-window / unauthorized / Path-A gap / Path-B gap / Path-B not-capturing each distinct → named past weekday with no container is `no session day tape…` (not a distinct pre-store class) → coverage missing stays missing → score triple identical.
- GATE Q is one structural scan plus Pages 404 plus closed-stage assertion — not one-test-per-AC. A suite that only ever lists a happy tape has not proved the gate. GATE Q must **not** claim a required pre-store 200 class and must **not** green a watermark plant. Poison 10 is the rejecting path for store-start invention. AC-32 is **not** ship-blocking.
- No DOM harness. Observability is operator list/load, vendor-call count, desk + live ticks + score identity, coverage class unchanged, dashboard empty-diff / copy-table.
- AC-41 keeps “does not fail” as the hard oracle on the trader request path. No p95 budget is locked this slice; “does not delay” is the off-request / best-effort isolation already named, not a latency SLO.

**Ship-blocking set:** AC-1–AC-31, AC-33–AC-58, and AC-66. AC-32 is **not** ship-blocking (GATE Z). AC-59–65 are required scope-honesty / copy checks (`review`).

## 4. UI + interaction

**NO_UI_CHANGE.** This feature consumes no dashboard route, component, token, motion, chip, LiveTape mode, or copy table. No `DESIGN_SYSTEM.md` amendment. Anyone proposing a Ticker “replay Tuesday” / “tape saved” chip, a Settings research toggle, an Ask-AI “we kept Tuesday’s tape” line, a Scanner badge, a Landing lab teaser, or a `/_ops` tape panel is re-scoping.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (Status: SET — The Curvature Terminal).

**Design direction:** trader surfaces are untouched. Operator meaning is **plain text** (CLI stdout, structured logs, curl JSON). Green/red stay reserved for signed direction — ANSI on CLI is optional and must not be the only signal. Do not invent tokens. `/_ops/metrics` stays latency / cache / vendor-headroom chrome; tape is different data and must not render as p50/p95, “Instrumentation: ON”, a success chip, or a coverage `present` cell.

**Flows:**

1. Dedicated writable non-colliding tape root present → serve binds → Path-A sidecar and Path-B persist hook arm for SPY/QQQ/IWM.
2. Operator GETs sibling `_research` list/load with metrics token when configured → 200 honest envelope or 401/422/500.
3. Optional `cargo run -p api-rust -- session-day-tape` prints the same literals; **Evidence: local**.
4. Trader never sees it. LiveTape / SSE unchanged.

**Component states:**

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Trader UI (Landing/Ticker/Positions/Scanner/Settings/Ask-AI/shell) | unchanged | N/A | N/A | N/A | N/A |
| `/_ops/metrics` | existing latency tables | existing `Loading metrics…` | N/A | existing `Metrics readout unavailable.` | N/A — tape adds no state |
| session-day-tape HTTP | 200 honest envelope | N/A (request/response) | 200 + closed empty / gate literals (including not-elapsed, not-in-watchlist, weekend, no-identity) | 401 token / 422 bad `et_date` / 500 not-storing or unreadable | client failure, not a tape class |
| session-day-tape CLI (if present) | standing + Path-A + Path-B + close | `[RUNNING] session-day-tape — no verdict yet` | `[OK]… Not a coverage miss.` | `[ERROR]… No load recorded.` | N/A (local process) |

**Copy — standing block first** (CLI; HTTP twin uses `Evidence: this process` and omits the local-audit closing clause):

```
SESSION DAY TAPE — RESEARCH STORE · NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK
  Command:     session-day-tape
  Evidence:    local
  Watchlist:   SPY, QQQ, IWM
  Identity:    (symbol, et_date) America/New_York
  Path-A:      append-only stock ticks · stocks WS · not OPRA
  Path-B:      timed options-structure snapshots · interval 5-minute marks 09:30, 09:35, …, 16:00 ET
  Provenance:  research tape · never live_massive · never coverage present
  Vendor I/O:  0 Massive calls on this read
  Authorizes:  nothing. No live score/tier/gate/fingerprint change, no trader UI,
               no ticker playback, no session-archive fill, no 48-ring spawn_capture.
```

Print `0 Massive calls` only when the **read** can vouch it; otherwise ERROR / BLOCKED, never a dump that looks complete. Capture-time Massive is not a read-path vendor call.

CLI closing: `SESSION DAY TAPE — NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK · Authorizes: nothing · local audit is not production coverage`

HTTP closing: `SESSION DAY TAPE — NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK · Authorizes: nothing`

<!-- spire:council-resolution:v1 1dea254527814f9b62a0bff798bc1dc07d163a8c8c40b0feaf618835690f416e folded -->
<!-- spire:council-resolution:v1 0d046c3224a528fdca22ff18d9269b013ba93b4dca465d544a00ae8ef56c5e74 folded -->
<!-- spire:council-resolution:v1 60d2ff541074ed7b70270b60e6a95f4063a4d638fce77947dcdd3a005d08710b folded -->
<!-- spire:council-resolution:v1 e855c3b9f5934422420f8cae3b1cc38d8d164d927491561c1d9f1c262b18c68d folded -->

**HTTP framing** (exact; never session-book / coverage / ring / replay). Combined Path-A + Path-B envelope only — there is **no** path filter and **no** Path-A-only / Path-B-only framing token:

| Situation | Framing line |
|---|---|
| Combined identity loads (either path has data, or both empty-but-storing / gapped) | `RESEARCH READ — SESSION DAY TAPE` |
| Locked-symbol list (including zero stored days) | `RESEARCH READ — SESSION DAY TAPE` |
| No tape identity (weekday, storing, in watchlist, capturable date — including a named past weekday with no container) | `RESEARCH READ — NO SESSION DAY TAPE` |
| Weekend | `RESEARCH READ — SESSION DAY TAPE INELIGIBLE WEEKEND` |
| Not elapsed (weekday `et_date` after today ET) | `RESEARCH READ — SESSION DAY TAPE NOT ELAPSED` |
| Not in watchlist | `RESEARCH READ — SESSION DAY TAPE NOT IN WATCHLIST` |
| Store not storing | `RESEARCH READ — SESSION DAY TAPE NOT STORING` |
| Unreadable | `RESEARCH READ — SESSION DAY TAPE UNREADABLE` |

`RESEARCH READ — SESSION DAY TAPE NOT EXPECTED` is **not** a required 200 class (GATE Z). If the unused `NotExpectedPreStore` type arm is kept for exhaustive match, it must not have a required operator outcome — do not ship a distinct pre-store HTTP class.

Banned framing on this vehicle: `RESEARCH READ — SESSION BOOK` · `RESEARCH READ — SESSION ARCHIVE COVERAGE` · `RESEARCH READ — STORED CHAIN SNAPSHOT` · `RESEARCH REPLAY — NOT LIVE` · `RESEARCH READ — PATH-A TICKS` · `RESEARCH READ — PATH-B STRUCTURE SNAPSHOTS`.

**Load order:** standing block first, then scope (watchlist SPY, QQQ, IWM · identity · evidence · vendor I/O · clock line when it applies), then **Path-A section**, then **Path-B section**, then is/is-not, license, close. Do not omit an empty path. Do not lead with through-window as a verdict. Axis A gate literals travel in `detail`. On `StoringReady` content hits, `detail` is omitted-as-null; clock / `path_a_detail` / `path_b_detail` carry the facts (interface file).

**Is / is not** on every successful or empty-but-storing read:

- **Is:** research tape for a locked watchlist ET day: Path-A append-only stock ticks from the stocks WS (every already-received trade **and** quote in 04:00–20:00 ET weekdays); Path-B timed options-structure snapshots at 5-minute marks 09:30…16:00 ET.
- **Is not:** a live paid session book; not coverage `present`; not the 48/14d ring; not OPRA options-quote flat files; not S3 hist-chain; not ticker playback; not a scoring input; not a Massive product we newly bought.

**Closed operator literals** (exact; list/load and CLI twin; never synonyms):

| Literal | Means |
|---|---|
| `session day tape ineligible weekend: {SYMBOL} on {ET_DATE}` | ET Saturday/Sunday. No expected tape. |
| `session day tape not elapsed: {SYMBOL} on {ET_DATE}` | Locked-watchlist weekday `et_date` strictly after today ET. Not a missing row, not coverage `not yet due`. |
| `session day tape not storing` | Store disabled / unset / unavailable. Store-level. Desk still serves. |
| `no session day tape for {SYMBOL} on {ET_DATE}` | Store on; symbol in locked watchlist; capturable weekday; no tape row. Includes a named **past** weekday with no container (GATE Z). Not weekend, not not-elapsed. |
| `no path-a ticks for {SYMBOL} on {ET_DATE}` | Store on; Path-A event count 0; no hub/writer gap records required to explain the zero. Quiet tape. Holiday weekday with no prints uses this. |
| `no path-b snapshots for {SYMBOL} on {ET_DATE}` | Store on; Path-B capturing; snapshot count 0 **and** gap-mark count 0 (including derived gaps). |
| `path-a gap: hub or writer for {SYMBOL} on {ET_DATE}` | First-class list/load occupant: hub `Lagged`, writer-channel full, hub Closed/reconnect, or persist fault. Optional vouched suffix ` · {n} dropped` from the coalesced `dropped` count. |
| `path-b gap: no snapshot at {HH:MM} ET for {SYMBOL} on {ET_DATE}` | Path-B storing on; that clock-aligned mark’s fill window closed with no snapshot. `{HH:MM}` is 09:30 … 16:00. |
| `path-b not capturing: already-paid fetch off for {SYMBOL} on {ET_DATE}` | Already-paid warm/refresh fetch is off, or this locked name is not on that fetch. |
| `session day tape unreadable: {reason}` | Identity/pointer exists; body not loadable. |
| `session day tape partial: capture not through 09:30–16:00 ET for {SYMBOL} on {ET_DATE}` | Capture-on started after 09:30 ET or stopped before 16:00 ET. Optional vouched suffix ` · capture-on {HH:MM}–{HH:MM} ET`. |
| `session day tape through-window 09:30–16:00 ET for {SYMBOL} on {ET_DATE} · does not certify open-to-close` | Capture-on covered 09:30–16:00 ET. Clock only. Hedge is unconditional. |
| `not in tape watchlist: {SYMBOL}` | Symbol outside SPY, QQQ, IWM. |
| `loaded from session day tape · no vendor call` | Read vouches 0 Massive calls. |
| `research tape · never live_massive · never coverage present` | Standing / hit provenance. |
| `already-paid REST as history · not live_massive` | Inner fetch fact, if shown at all. |

`session day tape not expected before storing: {SYMBOL} on {ET_DATE}` is **not required** (GATE Z). Do not distinguish “before we recorded” from `no session day tape…`. Weekend remains distinct from no-identity; not-elapsed remains distinct from no-identity.

<!-- spire:council-resolution:v1 677662fc45cae5ae4dcab60266632a7ec8b1ecc5c9d983cd14fbe302a2a9a832 folded -->
<!-- spire:council-resolution:v1 948460c9b238ccf9240b699bf73d652840b70fbdceb5c053005c9c8b75b6566c folded -->
<!-- spire:council-resolution:v1 8c345e936c41c2ea4ce9b1a9409dcb5f1ea1c2f8ce76abce4f76132e78ba227e folded -->
<!-- spire:council-resolution:v1 3548cc1b1ac4b7c056e71359b84450eacd755ab151cd8946f831a11c4d689882 folded -->

**List clock cell** (short; still not coverage cells): `partial` · `through-window · not certified` · `ineligible weekend`. Zero is a **number**, never the word `missing`. List is **stored days only** — no pre-store rows, no future `et_date` rows. `not expected before storing` is **not** in this closed set. Not-elapsed is a **load** class.

**List layout** — watchlist order SPY → QQQ → IWM; two count columns, never one:

```
  Symbol  ET date     Path-A ticks              Path-B snapshots
  {SYM}   {YYYY-MM-DD}  {n_trade} trades · {n_quote} quotes   {k} snapshots
```

Path-B section counts when the store vouches both: `path-b snapshots: {k} snapshots · {g} gaps`. `{g}` is a count of honest mark-gaps (derived on load per §2.3), not a percent. Through-window Path-B all mark-gaps prints that line plus per-mark gap literals — **not** `no path-b snapshots…`.

**S2 — write skip** (operator log only):

| Class | Exact line |
|---|---|
| Path-A persist failed | `session day tape write skipped — path-a · trader path unchanged` |
| Path-B persist failed | `session day tape write skipped — path-b · trader path unchanged` |

Independent lines. Do not fail bundle / scan / SSE / ensure. Do not put filesystem paths in the closed line. Do not fire a skip when the symbol is not in the locked watchlist. Persist-fault may emit **both** S2 and the list/load Path-A gap occupant. Hub `Lagged` / channel-full / Closed without a disk attempt on **recv** still occupies list/load as the gap literal once the writer flushes the latch.

**S3 — CLI lines** (only if clap exists; stdout title remains `session-day-tape`):

| Verdict | Exit | Exact line |
|---|---|---|
| Running | pending | `[RUNNING] session-day-tape — no verdict yet` |
| Load/list ok | 0 | `[OK] session-day-tape — loaded from session day tape · 0 Massive calls · not a live paid session book · local audit is not production coverage` |
| Empty identity | 0 | `[OK] session-day-tape — no session day tape for {SYMBOL} on {ET_DATE}. Not a coverage miss.` |
| Weekend / not-elapsed | 0 | `[OK]` line carrying the matching literal plus `Not a coverage miss.` |
| Not storing | non-zero | `[ERROR] session-day-tape — session day tape not storing. No load recorded.` |
| Unreadable | non-zero | `[ERROR] session-day-tape — session day tape unreadable. No load recorded.` |
| Massive on read | non-zero | `[ERROR] session-day-tape — tape read must not call Massive. No load recorded.` |
| Missing lock | non-zero | `[ERROR] session-day-tape — watchlist or Path-B interval not locked. No load recorded.` |
| Not in watchlist | 0 | `[OK] session-day-tape — not in tape watchlist: {SYMBOL}` |

A distinct not-expected-before-storing CLI verdict is **not required**. Named past weekday with no container uses the empty-identity / `no session day tape…` line.

Do **not** use `[PASS] n/n present`, `[NOT DUE]`, “SLO miss”, “verified”, “certified”, “healthy”, “Live”, “hist-chain”, or “Massive p95”. Empty identity is **not** a coverage `[FAIL]`. HTTP has no process exit; empty paths are still a successful **read**.

**License (every human print):** `Our research · not redistributed on a trader route.`

**Unauthorized HTTP:** reuse shipped `metrics_unauthorized` / `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`.

**Banned on this vehicle:** `present` · `missing` · `not yet due` · `blocked occupancy` · `not_due` · `empty_attempted` · `recording` · `closed` · `complete RTH` · `complete_rth` · `verified complete` · `{n}% of the day captured` · `live_massive` · `LiveMassive` · `LIVE` as a feed/occupancy badge · `no session book…` · `no stored snapshot…` · `empty 48-ring…` · trader `—` · `unavailable this cycle` · `every 25s` as the Path-B lock · fabricated `0 quotes` for a kind the store does not keep.

**Glossary (operator only; no trader glossary):**

| Term | Glossary sentence |
|---|---|
| session day tape | Research store for one locked-watchlist symbol on one America/New_York calendar date. Not a live paid session book. Not ticker playback. |
| Path-A ticks | Append-only stock-stream events (stocks WebSocket, not OPRA) that otherwise latest-wins into `price:{SYM}` and die. Every already-received trade and quote in 04:00–20:00 ET weekdays. |
| trade | A Path-A event whose kind is `trade`. Not a quote. |
| quote | A Path-A event whose kind is `quote`. Not a trade. Not a 1-second sample. |
| Path-B structure snapshots | Timed options-structure snapshots persisted from the warmer’s already-fetched vendor bundle at 5-minute marks 09:30…16:00 ET. Not a 48-ring capture. Not a session book. |
| ineligible weekend | ET Saturday or Sunday. No tape is expected. Not empty-while-storing and not a coverage miss. |
| not elapsed | A locked-watchlist weekday date after today ET. Not a missing tape row and not coverage `not yet due`. |
| no session day tape | Store on; locked symbol; capturable weekday; no day container. Includes a named past weekday with no row. Not a distinct “before we recorded” class. |
| no path-a ticks | The tape is storing and this identity has zero Path-A events. Distinct from not-storing, unreadable, hub/writer gap, and coverage-missing. |
| path-a gap: hub or writer | Path-A dropped on hub lag, writer overflow, reconnect hole, or persist fault. Distinct from a quiet zero-tick tape. |
| no path-b snapshots | Path-B capturing was on and this identity has zero snapshots and zero mark-gap records. |
| path-b gap | A clock-aligned 5-minute mark with no snapshot while Path-B storing was on. Not a new fetch. |
| path-b not capturing | Already-paid structure fetch was off for this name. Not a mark gap and not a quiet zero. |
| partial | Capture-on did not run through 09:30–16:00 ET. Not through-window. |
| through-window | Capture-on covered 09:30–16:00 ET. Clock only. Does not certify open-to-close. Counts and gaps remain the honesty surface. |
| present | **Not a tape word.** On coverage, a loadable live paid session book. |
| live_massive | **Not a tape provenance token.** Session-book paid-live source only. |
| local | This CLI classified **this process’s** tape. It is not production/hosted coverage. |
| not expected before storing | **Not a required operator class (GATE Z).** Named past weekday with no container is `no session day tape…`. Same residual as coverage (no `since`). |

## 5. Error handling

| Failure class | Operator sees | Logs | Desk |
|---|---|---|---|
| Path-A persist fail | tape lacks that event; list/load may show Path-A gap | `session day tape write skipped — path-a · trader path unchanged` | unchanged |
| Path-B persist fail | that mark is a gap (if Path-B was capturing; derived on load) | `session day tape write skipped — path-b · trader path unchanged` | unchanged |
| Hub lag / channel-full / Closed | `path-a gap: hub or writer…` on list/load (writer flushes coalesced latch; recv does not await disk) | gap occupant; S2 skip only if a disk attempt failed | SSE cursors independent |
| Unset / missing / unwritable dedicated root | `session day tape not storing`; HTTP 500 `session_day_tape_not_storing`; CLI `[ERROR]` if present | not-storing; no fake stored success | still serves |
| Tape path collides with archive/ring | process does not start | construct error | N/A (refused) |
| Unreadable body | `session day tape unreadable: {reason}`; HTTP 500 `session_day_tape_unreadable` | store error | unchanged |
| Weekend | ineligible-weekend literal; HTTP 200; CLI exit 0 `Not a coverage miss.` | none as capture outage | unchanged |
| Not elapsed (future weekday ET date) | `session day tape not elapsed: {SYMBOL} on {ET_DATE}`; HTTP 200; CLI exit 0 `Not a coverage miss.` | none as capture outage | unchanged |
| Named past weekday, no day container | `no session day tape…` (`NoIdentity`); HTTP 200; CLI exit 0 `Not a coverage miss.` Not a distinct pre-store class. | none | unchanged |
| Quiet Path-A | `no path-a ticks…`; HTTP 200 | none as `[FAIL]` | unchanged |
| Path-B fetch off | `path-b not capturing…`; no extra REST | none as surprise bill | unchanged |
| Token missing/wrong when required | HTTP 401 `metrics_unauthorized`; no tape body | none as skip | unchanged |
| Unparseable `et_date` | HTTP 422 `et_date_unparseable` | none as skip | unchanged |
| Vendor call on tape **read** | `[ERROR] session-day-tape — tape read must not call Massive. No load recorded.` | error; no complete-looking dump | unchanged |
| Not in watchlist | `not in tape watchlist: {SYMBOL}`; HTTP 200; no fabricated counts | no skip line | unchanged |
| Coverage hole for `(S, D)` | stays missing on the coverage vehicle | none as tape present | unchanged |
| Sidecar fault | live ticks still flow; no trader toast | skip / gap | unchanged |

Retries: tape does not retry Massive on read (it never calls it). Runtime writes are best-effort once; overflow latches a coalesced gap for the writer, not a blocking retry on the recv loop.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/session-day-tape-capture/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This ship **adds** operator/research `GET /api/_research/session-day-tape/{symbol}` (list) and `GET /api/_research/session-day-tape/{symbol}/day` (load, required `et_date`). It is **not** `NO_BACKEND_CHANGE`. It does **not** nest on `GET /api/_metrics`. Existing `GET /api/_research/session-books/{symbol}` list/load envelopes are re-pinned so this ship cannot reshape them. Auth is the metrics/research token (`metrics_token_ok`), not a trader session cookie — `"auth": true` is wrong. Optional clap `session-day-tape` is not executed by the conformance runner. Field lists live in the interface file. No playback endpoints. Combined envelope only. Load `NotExpectedPreStore` is **not** a required 200 class; list `days[].clock` has no pre-store token.

## 7. Testing strategy

**Hermetic unit (injected America/New_York clock + fixture tape store + stub hub/warmer):** Path-A append vs latest-wins; two quotes in one second both remain; OPRA absent; NVDA not-in-watchlist; 04:00–20:00 keep vs overnight drop; weekend ineligible; weekday `et_date` after today ET is not-elapsed (not no-identity); named past weekday with no container is NoIdentity (not a distinct pre-store class); Path-B `floor(now_et, 5min)` grid including [16:00, 16:05) fill; no extra vendor counter increment; Path-B not-capturing when warm is off; through-window Path-B with 0 snapshots derives per-mark gaps (not `no path-b snapshots`); Axis A/B/C compositions (through-window × empty Path-A; through-window × all Path-B gaps; partial mid-session start); writer-channel Full at 4096 yields one coalesced Path-A gap on load while SSE still flows; JSONL trailing partial line; Disabled vs colliding root; write-fail isolation; zero vendor on list/load; `LiveMassive` discriminant dropped; coverage `classify_loaded` unused; derive never returns `NotExpectedPreStore`; no watermark / `SESSION_DAY_TAPE_STORE_STARTED` / first-arm-as-start.

**Structural scans:** `refresh_analytics` still has no `spawn_capture`; tape leaf has no `insert_if_absent` / `archive_session_best_effort`; scoring/engine crates do not import tape; exhaustive occupancy match per axis; Path-A recv loop does not persist; trader dashboard empty-diff / copy-table for tape chrome; OperatorMetrics closed stage set; Pages 404 prefix including the new paths; session-book / ring / coverage framing strings unchanged; `day_tape` sources contain none of `store_started`, `storing_since`, `watermark`, `SESSION_DAY_TAPE_STORE_STARTED`, `SESSION_DAY_TAPE_STARTED`.

**HTTP:** token 401; 422 bad `et_date`; 200 not-in-watchlist; 200 not-elapsed when storing; 200 no-identity (including named past weekday with no container) when storing; 200 empty-while-storing when storing; 500 not-storing; 500 unreadable; `vendor_called: false`; no `live_massive` on the envelope. Live `interface_conformance.mjs` checks the interface JSON block (shape/types). Exact `vendor_called === false` and closed literals are unit/GATE Q. **Do not** require a NotExpectedPreStore 200 probe.

**Isolation:** bundle/scan/SSE/ensure still succeed when tape writes fail or the store is Disabled; live ticks still arrive; score/tier/fingerprint byte-identical on vs off and succeed vs fail.

**Not required:** DOM harness; merge CI against production tape disks; one named test per AC; a VERIFY_MATRIX.md; hosted “we kept every Tuesday”; a store-start plant that greens a pre-store class; ship-blocking AC-32.

Invariants that must not silently regress: unsampled Path-A trades+quotes; recv never blocking the live cursor (no disk await on recv; Full is a latch); Path-B 5-minute grid from already-paid refresh only; through-window all-missed Path-B is mark-gaps; no `LiveMassive` / coverage `present` on tape; desk up when the tape disk is missing; Pages 404; local ≠ hosted; no watermark splitting NoIdentity.

## 8. Guardrails this feature must not break

- **`operator-vs-trader-path-separation` (HARD)** — tape is research; trader SSE unchanged; no extra vendor fetch on a tape **read**; Pages 404 `_research` / `_metrics`; unlinked from trader UI.
- **`best-effort-isolated-or-null`** — tape write failure never fails bundle / scan / SSE / ensure.
- **`additive-keeps-score-byte-identical`** — tape is never a scoring input. **Authorizes: nothing.**
- **`live-vs-static-isolation`** — sidecar must not dim or blank live ticks. Path-A recv never awaits disk.
- **`present-is-live-paid-only`** — tape / reconstructed occupants are never `present` `LiveMassive` session books.
- **`absent-is-not-none`** — no-ticks ≠ not-storing ≠ unreadable ≠ no-identity ≠ weekend ≠ not-elapsed ≠ Path-A gap ≠ Path-B gap ≠ Path-B not-capturing ≠ partial ≠ through-window ≠ unauthorized ≠ coverage-missing. Pre-store is **not** a distinct operator class (GATE Z; same residual as coverage, no `since`).
- **`single-ticker-on-demand`** — capture is off the trader request path.
- **`no-secrets-in-image`** — tape root / token stay runtime env; no secrets in tape output.
- **`cited-code-is-verified-not-assumed`** — cite live Rust above, not Python, not briefing HTML as an oracle.
- **`structural-over-prose-enforcement`** — poison warmer `spawn_capture`, tape `insert_if_absent` as LiveMassive, weekend-as-empty-complete, 25s Path-B dump as the operator series, 1s quote sample as every quote, recv-loop persist, store-start watermark / `SESSION_DAY_TAPE_STORE_STARTED` → build/gate goes red.
- **`local-evidence-is-not-hosted-evidence`** — a local planted-tape receipt is not production “we kept every Tuesday.”
- **`score-change-is-deliberate-and-measured`** — this feature authorizes nothing on the live score.
- Massive license: stored ticks/snapshots remain our research, never redistributed on a trader route; this is the stocks WS + paid REST we already fetch, **not** OPRA options-quote files.

## 9. Open questions

None. D1/D2/D3 and the R3 technical exchanges closed the keep-set, the Path-A window, enablement, Path-B marks, occupancy axes vs operator literals, inner `LiveMassive` drop, and the verify-by split. Path-A Full is a recv latch + writer coalesced gap (recv never writes the store). `NotElapsed` has a closed literal and HTTP 200. Path-B mark-gaps derive on load. Framing is combined-envelope only. Load `detail` is null on `StoringReady` content hits. GATE Z (owner A 2026-08-29) closed AC-32: do not distinguish “before we recorded” from “no tape that day”; named past weekday with no container is `NoIdentity`; no store-start watermark; ship-blocking AC-32 dropped; pre-store literal not required. Playback, S3 flat-file keep, watchlist expansion, and explicit `since` are **Future**, not deferred decisions.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"daf849244904c57d5b0d1bb1aa0a95af1be2b52ee9f380d466a11c6fe9358ee2","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"10068494c0c42e4a1fcf0300146dcbe7cc8a13bd87558d93f265a025eeac29ac","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"cc9110527a6073f28ef58ec787035bdf0bb501381071bbc9e8dab082bd9327a4","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"17adc3193c8d143e32a481f06345e41d7e5aaef9a6746e8d931ef5133bf23350","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"34c34be2ed9a717b9d810d86f41567cebd16d688c1cff6b7c867a8488b1aaad9","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":5,"conflict_id":"53b87f1e6c36dc26cff82a944dc8cc11f0d4e2c5c5f78368c7288e1392bd56b8","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":6,"conflict_id":"446e10df9ce747f4c951c8888533ac9b92e970925e8aad209faea71c42d0fb0e","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"f99f570811d7a8d0b983ec9b13bba4b68e418c1f4098d1b72ecab44945aa33fd","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"f4beceacb24517e096f34206ac052865c5f87eb0647d538ca38932e42ec260f9","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"2551a5c7bacc3cd30aeb32d20726acee9b060c5321401128b8567d77329739bc","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"2b74bb893169eac2d2bd508d3f8727b8aade005424a6d910c0d748653cb9a584","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":4,"conflict_id":"948460c9b238ccf9240b699bf73d652840b70fbdceb5c053005c9c8b75b6566c","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":5,"conflict_id":"dd04f6735701c4e71afbb01821b00c6b5d2d2755f491348a06be9048237005cf","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"60d2ff541074ed7b70270b60e6a95f4063a4d638fce77947dcdd3a005d08710b","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"e855c3b9f5934422420f8cae3b1cc38d8d164d927491561c1d9f1c262b18c68d","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":2,"conflict_id":"0d046c3224a528fdca22ff18d9269b013ba93b4dca465d544a00ae8ef56c5e74","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":3,"conflict_id":"677662fc45cae5ae4dcab60266632a7ec8b1ecc5c9d983cd14fbe302a2a9a832","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":4,"conflict_id":"7da8e8369c6d39ead11394e8ed48583873c56d5e3fcd4d07bcdc69f7cdcea38d","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":5,"conflict_id":"1dea254527814f9b62a0bff798bc1dc07d163a8c8c40b0feaf618835690f416e","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"3548cc1b1ac4b7c056e71359b84450eacd755ab151cd8946f831a11c4d689882","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":7,"conflict_id":"8c345e936c41c2ea4ce9b1a9409dcb5f1ea1c2f8ce76abce4f76132e78ba227e","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":8,"conflict_id":"5380f8da4ad619b65438d35cd37a10c5f6865b5f28304c948c138c741a4a0bb7","disposition":"folded","section":"§3"}]}
-->
