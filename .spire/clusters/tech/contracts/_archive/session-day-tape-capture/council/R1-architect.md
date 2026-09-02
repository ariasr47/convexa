# R1 — architect position: session-day-tape-capture

## Position

This slice adds a **sibling research day-tape store** and two **off-request-path writers**. It does not become a `MarketDataPort` arm, a session-archive occupant, a 48/14d ring row, or a ticker-page clock.

Production Path A today is Massive stocks WS (`wss://{feed}/stocks`, `T.{SYM}` + `Q.{SYM}` on **one** socket) → `StockStreamHub` broadcast (`BROADCAST_CAPACITY = 4096`) → SSE tasks in `routes/stream.rs` that latest-wins `PriceCache.set_price`. `services/price_stream.rs::run_price_stream` is a **CLI** that calls `MassiveStockStream::connect`, which constructs a **second** `StockStreamHub::spawn`. Tape must attach to `AppState.stock_hub.subscribe_events()`, never to `run_price_stream` / `MassiveStockStream::connect`.

Production Path B warmer is `refresh_analytics` every `WARM_INTERVAL_SECS` default **25** (`config.rs`), which `compute_analytics`s then **intentionally drops** `_vendor` (`analytics.rs`: “warmer / refresh_analytics must not capture”). `spawn_capture` remains only ticker-cold / DTE-filter / `load_or_compute` miss / scanner slow-lane (`analytics.rs` + `chain_snapshot/capture.rs`) and still must not fire from the warmer. Session archive remains first-wins `(symbol, et_date)` via `insert_if_absent`. `ENSURE_SYMBOLS` remains `["SPY","QQQ","IWM"]`. `MarketDataPort` is `Live` | `Fixture`; `kind()` maps those to `MarketDataSourceKind::{LiveMassive, Fixture}`. `FixtureCatalog::resolve` picks a frozen `VendorBundle` (last, or nearest `as_of ≤ t`) — **not a tick clock**.

### Restated binding constraints

- **`operator-vs-trader-path-separation`**: tape writers are background; tape **read** is operator/research, token-gated like existing `_research` / `_metrics`, **zero Massive**, no `PriceCache` write, no `gex_cache` mutation, no hub subscribe. Pages trader origin continues to 404 `/api/_research`. Trader SSE (`/api/stream/{ticker}`, `/api/stream/prices`) is byte-behavior-unchanged: same hub, same `set_price`, same throttle (ticker 250 ms, multi-symbol 1000 ms). Stored ticks are **our research**, never redistributed on a trader route.
- **`best-effort-isolated-or-null`**: tape write / lag / decode / serialize failure never fails bundle, scan, SSE, ensure, or warmer `Ok(snap)`. Mechanism: fire-and-forget spawn + swallowed store errors (same shape as `spawn_capture` / `archive_session_best_effort`).
- **`additive-keeps-score-byte-identical`**: tape is not a scoring input. Mechanism: one-way leaf — `quant-engine`, `generate_signals`, gate, fingerprint do not import the tape module; warmer still `gex_cache.set(snap)` from the same `compute_analytics` result.
- **`live-vs-static-isolation`**: sidecar is an **independent** `broadcast::Receiver`. Tokio broadcast drops only for a lagged receiver; SSE receivers keep their cursor. Tape never calls `set_price`. Recv loop never awaits disk.
- **`present-is-live-paid-only`**: tape occupants are **not** session-archive identities and are **never** `insert_if_absent`’d as `LiveMassive`. Coverage `present` stays “loadable LiveMassive session book”. Fixture/tape/reconstructed occupancy stays a distinct class (`blocked occupancy` on the archive; tape has its own vocabulary).
- **`absent-is-not-none`**: no-ticks ≠ not-storing ≠ unreadable ≠ missing day ≠ out-of-window ≠ hub-gap. Closed occupancy enum on the **day identity**, independently for Path-A and Path-B.
- **`no-secrets-in-image`**: tape root / enable / watchlist come from runtime env; blobs get the same `apikey` / `api_key` debug assert as `capture.rs`. No key material in locators.
- **`cited-code-is-verified-not-assumed`**: claims above were read in `ws.rs`, `stream.rs`, `price_stream.rs`, `price_cache.rs`, `analytics.rs`, `warmer.rs`, `config.rs`, `capture.rs`, `ensure.rs`, `store.rs` (archive + ring), `coverage.rs`, `market_data/mod.rs` + `fixture.rs`, `live_capacity.rs`, `server.rs`. Briefing HTML and `archive/api-python/` are not oracles.
- **`structural-over-prose-enforcement`**: poison (build-red, non-vacuous): (1) `refresh_analytics` still does not call `spawn_capture`; (2) tape module has no `insert_if_absent` / `archive_session_best_effort` / `spawn_capture` call; (3) scoring/engine crates do not import tape; (4) no `fn` converts a tape record into `MarketDataSourceKind::LiveMassive` + session-archive body; (5) occupancy match is exhaustive so a new state cannot silently become “empty day”.
- **`local-evidence-is-not-hosted-evidence`**: unit/hermetic tape tests are local. They do not certify a hosted Tuesday.
- **`single-ticker-on-demand`**: no trader request starts capture or a vendor fetch. Writers spawn from `server.rs` after listener bind, beside `warmer::spawn` and `ensure_worker::spawn`.
- **`production-fails-closed`**: when tape is enabled, production `construct` refuses if the tape body root is missing, unwritable, or conflicts with ring / session-archive index / session-archive body root (extend `body_root_conflicts`). Do not invent a nested default path.
- **Massive license**: stocks WS + paid REST we already fetch. Not OPRA quote files, not S3 flat files.

### Data-structure content

**Closed watchlist.** A process-start closed set, **sibling** of `ENSURE_SYMBOLS` / `warm_symbols` / `universe.json`, default members **SPY, QQQ, IWM**. Not an alias of `ENSURE_SYMBOLS` (ensure-set edits must not silently resize the tape). Not `WARM_SYMBOLS` (default ten `DEFAULT_LIQUID` names, live-cache side effect). Not the scanner universe. Hard cap **8** names at config parse; production refuse if empty or over cap. Symbols uppercased, deduped.

**Day identity.** `(symbol, et_date)` with `et_date` = America/New_York calendar `YYYY-MM-DD` via the same rule as `et_date_from_as_of` / `today_et_date` (not UTC day). One day container per identity. **Not** first-wins one body. **Not** `(symbol, as_of)` ring identity.

**Append window.** Path-A and Path-B append only while `MarketPhase::classify(now) == Rth` (09:30–16:00 ET, weekdays). Premarket / afterhours / weekend are **out of window**, not “no ticks”. Holidays are not a third calendar this slice: a weekday RTH with no prints is `empty_attempted`.

**Path-A record (content, not HTTP).** Ordered log of:

- **Trade:** every decoded `StreamKind::Trade` (`decode_event` `ev=T`: price, size, vendor `ts_ns`) for a watchlist symbol in-window.
- **Quote:** **not** every `ev=Q`. Persist the **last quote per symbol per 1-second bucket** keyed on vendor `ts_ns` when `ts_ns > 0`, else receive wall-clock with an explicit **receive-clock** basis (timestamp quality is not collapsed). Quote payload is bid/ask/bid_size/ask_size as decoded today.
- **Gap marker:** `broadcast::RecvError::Lagged(n)` (n skipped), writer-channel full drop, hub `Closed`/reconnect hole, persist fault. A gap is a first-class occupant, not a silent skip (SSE today `continue`s on lag — tape must not copy that collapse).

Do **not** persist `LivePrice` / `price:{SYM}` snapshots as the tape: that type already collapsed trade-vs-mid (`display_price` prefers last trade). Later replay needs the resolved split (NBBO mid = structure anchor; last-trade = readout only).

**Path-B record.** Timed full `VendorBundle` already fetched by `compute_analytics` (chain + best-effort daily/minutes/trades, `source` at fetch is `LiveMassive`). Persist interval **300 s** wall-clock per symbol, **independent of** `WARM_INTERVAL_SECS`. First in-window warmer success persists immediately. Inner payload may reuse `to_wire` / `serialize_capture` bytes for team familiarity. **Outer occupancy is not `MarketDataSourceKind`.** Wrapper: tape occupancy = `TapeCapture`; inner “how we fetched” may record live REST as a historical fact. No `MarketDataSourceKind::LiveMassive` on the occupancy document. Do **not** add a third `MarketDataSourceKind` variant this slice — that enum is the session-archive/ring/coverage machine (`coverage.rs` exhaustive `LiveMassive` → `present`, `Fixture` → `blocked occupancy`; `batch_backtest` `source_token`; ring BYTEA `source` column). Tape isolation is a **different type + different store**, not a new port arm.

**Occupancy vocabulary (type, both paths, per day identity).** At least: `not_due` (weekend / future / before RTH), `not_storing` (store disabled), `missing` (due weekday, no identity), `empty_attempted` (window open, zero records), `gap` (lag/disconnect/drop recorded), `unreadable` (index without loadable body), `recording` (RTH open), `closed` (post-16:00 ET with whatever was written). Path-A and Path-B statuses are **independent**. `empty_attempted` is not `missing`. A gap does not rewrite the day into `empty_attempted`.

**Store adapters.** Same family as session archive, **new type**: Disabled / Memory / Json+FS / Failing / (postgres feature) Postgres **index** + filesystem **bodies**. Ring Postgres BYTEA (`chain_snapshots.body`) is the wrong place for a day of ticks + many full chains. Path-A body = one append-only line file per `(symbol, et_date)` (identity locator is correct here; it is a log, not a first-wins replace). Path-B body = unique-per-put files per snapshot (mint locator with as_of_ns + nonce, sibling of `mint_body_locator`), listed from the day index. **No prune API** this slice (session-archive posture, not 48/14d). Crash: JSONL trailing partial line skipped on read (`unreadable` last record, prior lines intact).

**Not a clock port.** `MarketDataPort::Fixture` stays a frozen sample. This slice does not implement `day-replay-mock-adapter`. Tape bytes are the corpus that adapter will later emit; they are not `LiveMassive` and not a session book.

### Data-flow and component boundaries

New one-way leaf `services/day_tape/` (signals/score/gate/ensure/coverage do not import it). Spawn from `server.rs` **after** listener bind and `stock_worker.start()`, beside warmer/ensure.

```
Massive stocks WS (existing single socket)
  → StockStreamHub.event_tx
       → SSE (unchanged): recv → apply_event → set_price
       → tape Path-A sidecar: recv → filter watchlist+RTH → all trades + 1s last quote
            → try_send bounded mpsc → writer task appends log
  (lag of sidecar ≠ lag of SSE)

Warmer refresh_analytics (existing REST)
  → compute_analytics → gex_cache.set(snap) → drop vendor
       + if symbol ∈ tape set ∧ RTH ∧ 300s elapsed:
            spawn tape Path-B persist(vendor)   // NOT spawn_capture
```

**Path-A sidecar mechanism.** Dedicated task: `stock_hub.subscribe(tape_symbols)` at spawn (same `HubCmd::Subscribe` as `AppState` already does for `warm_symbols`; **not** `LiveCapacity::admit_and_subscribe` — tape is not an SSE subscriber and must not bump `subscriber_count`). Then `subscribe_events()`, filter client-side (hub already documents this). Recv loop: never `await` store I/O; `try_send` to a bounded writer channel; on `Full` or `Lagged(n)` write a gap and continue. Do not `set_price`. Do not emit SSE. Default three names are already a subset of `DEFAULT_LIQUID` / default `WARM_SYMBOLS`, so default hub membership does not grow. An operator-expanded tape set **does** occupy hub symbol slots and therefore counts toward `max_sessions` for later SSE admits — accepted capacity interaction, not a second socket.

**Path-B mechanism.** Only inside `refresh_analytics` after a successful compute, for tape-set symbols, in-window, interval elapsed. Clone/move `VendorBundle` **only** when persisting (do not clone every 25 s to drop). `tokio::spawn` persist; warmer `Ok(snap)` does not await it. **Poison: still no `spawn_capture`.** Cold/scanner `spawn_capture` still feeds the 48/14d ring + first-wins archive only. If a tape name is not in `warm_symbols`, Path-B for that name is `not_attempted` that interval — **no new REST loop** to fill it.

**Read path.** Operator research list/load in the existing `_research` family: store only, `vendor_called = false`, `Authorizes: nothing`. I do not specify routes or payload names. Read must not call `stock_hub.subscribe`, `massive.*`, `prices.set_price`, or `gex_cache.set`.

**Isolation from archive/ring.** Tape persist functions live in the tape leaf. `capture_into` continues to `archive_session_best_effort` after ring append; tape never joins that call chain.

### Council locks (technical shape)

**1. Closed watchlist vs `WARM_SYMBOLS` / universe — sibling closed set, default SPY/QQQ/IWM.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| Alias `WARM_SYMBOLS` / `DEFAULT_LIQUID` (10) | low | extra WS + Path-B volume | 10 full chains / 5 min | high |
| Scanner `universe.json` (50–100) | low | paid REST + quote firehose | fails BRIEF load | high |
| Same constant as `ENSURE_SYMBOLS` | lowest | right size | right size | high, **wrong identity** |
| Sibling closed set, default SPY/QQQ/IWM, cap 8 | low | bounded | bounded | high (same three names, different key) |

**Chosen: sibling set.** Decisive axis: **BRIEF constraint + cost/scalability bound**. Members match the coverage/ensure liquid names whose first-wins midnight books had **0 trades** (QQQ/IWM 24–26 Aug) — that is the insurance target — without coupling tape cardinality to ensure or warmer.

**2. Path-A sidecar vs second socket — sidecar on the existing hub.**

`ws.rs` line 1–4: vendor meters **connections**, not symbols; personal-tier limit is respected by **one** socket. `MassiveStockStream::connect` is the second-socket footgun. SSE already consumes `subscribe_events()`. **Chosen: sidecar.** Decisive axis: **cost** (connection meter) and **`live-vs-static-isolation`** (a second reconnect loop can desync from the live hub). Complexity and familiarity also win: no new supervisor.

**3. Path-B downsample vs new REST — downsample warmer `_vendor` at 300 s.**

New REST would double paid options-chain fetches for names the warmer already pulls, fight `WARM_CONCURRENCY`, and still must not `spawn_capture`. **Chosen: persist hook on `refresh_analytics` only, 300 s.** Decisive axis: **cost** (Massive options REST). 25 s persist is rejected on disk/CPU: a full SPY book is `contract_count` on the order of the live compute path (capacity pin cited 14218); RTH at 25 s × 3 names is thousands of full chains/day. 300 s is ~78 snapshots/name/RTH. First in-window snapshot is immediate so open is not “wait five minutes”.

**4. Trades vs quotes volume — every trade; last quote per 1 s.**

All quotes on SPY-class names can be 10²–10³/s; 4096 broadcast slots wrap if the consumer stalls. All-quotes JSONL for three names is OPRA-adjacent volume this license is **not**. Trades-only drops the NBBO mid (OPEN_THREADS §9: live anchor = mid; last-trade is readout). **Chosen: all in-window trades + 1 s last quote.** Decisive axis: **scalability**, with enough fidelity that mid vs last-trade remain reconstructible. 1 s matches `PRICE_THROTTLE_MS = 1000` on the multi-symbol SSE; ticker emit is 250 ms — denser quotes are a later cost trade, not v1.

**5. Tape-store identity — new day-tape store, not archive, not ring.**

Session archive = first-wins one paid book / ET day (the midnight empty-trade failure). Ring = prune 14d / 48 per symbol; warmer is forbidden to write it. **Chosen: sibling store, append-only day container, FS bodies, no prune.** Decisive axis: **BRIEF identity** + familiarity with `SessionChainArchive` + `FsBodyStore` **without** reusing `insert_if_absent` or `prune_symbol`.

**6. Provenance — distinct tape occupancy type; never `LiveMassive`; do not extend `MarketDataSourceKind` this slice.**

Extending `MarketDataSourceKind` would force `coverage.rs`, ring BYTEA, batch_backtest `source_token`, and session-book research loaders to classify a kind that must never be `present`. **Chosen: `TapeCapture` occupancy on a wrapper type; no conversion into session-archive insert; inner capture bytes are payload, not occupancy.** Decisive axis: **`present-is-live-paid-only` + `structural-over-prose-enforcement`**. Defense in depth is module poison + exhaustive occupancy, not a third port kind. `MarketDataPort::Fixture` remains a frozen sample, not this tape.

### Explicit non-goals

- Play the tape into the ticker page, SSE, or `PriceCache`.
- `day-replay-mock-adapter` / turning `MarketDataPort::Fixture` into a clock.
- S3 flat files, OPRA quote files, `massive-flat-file-keep`.
- Changing live scoring, `state_fingerprint`, ensure, or scanner.
- `insert_if_absent` of tape/reconstructed bodies as `LiveMassive`.
- Trader UI / research-lab chrome.
- Moving session-archive bodies or changing `SESSION_CHAIN_ARCHIVE_BODY_ROOT` layout.
- Filling session-archive coverage holes (`present`/`missing`/`unreadable` stay archive-only).
- Second websocket; new Path-B REST; Kafka/mesh/GraphQL.
- Auto-backfill of gaps; holiday calendar; premarket/afterhours tape.
- Redistributing stored ticks on a trader route.
- Claiming local tests as hosted Tuesday evidence.

## Risks I see

- **Broadcast lag under quote load.** Mechanism if it bites: recv never awaits I/O; 1 s quote downsample + bounded `try_send`; `Lagged(n)` becomes a gap. Residual: a stalled process-wide runtime can still wrap 4096 for **all** receivers — that is an existing SSE risk (`stream.rs` already `continue`s); tape must not add awaits on that path.
- **Path-B hole when tape ⊄ warm set.** I am not unioning tape names into the warm pass (that would extra-fetch and keep extra `gex_cache` entries hot — a live-path side effect). Default intersection is full (SPY/QQQ/IWM ⊂ `DEFAULT_LIQUID`). Operator-shrunk `WARM_SYMBOLS` yields typed `not_attempted` Path-B. If PM later requires Path-B completeness independent of warmer, that is a **new REST** decision I am rejecting now.
- **Hub `max_sessions` coupling.** Process-start `subscribe` of an expanded tape set increases `hub.symbol_count()` and can 503 later SSE admits. Default three names do not.
- **Disk growth with no prune.** Three names × all trades × 1 s quotes × ~78 full chains is the insurance bill. No 48/14d safety valve. Production fail-closed on a dedicated root; operators can disable the store (then Tuesday is not captured — honest `not_storing`).
- **Accidental `LiveMassive` stamp if someone reuses `to_wire` as the outer document.** Mitigation is the wrapper type + poison against `insert_if_absent`. I am **not** restamping `MarketDataSourceKind` because there is no safe third variant without coverage blast radius.
- **`refresh_analytics` clone cost** if the interval check is done after cloning 14k contracts every 25 s. Mechanism: interval/watchlist/phase predicates **before** keeping `vendor`.
- **Holiday RTH classified as weekday.** Empty or thin day is `empty_attempted`, not a fabricated “market closed”. No holiday table this slice.
- **CLI `price_stream.rs` confusion.** An implementer following the BRIEF name only could spawn a second hub. The serve attachment point is `AppState.stock_hub`.

## Assumptions I'm making about the other two lanes

- PM will lock the v1 watchlist **members** as SPY, QQQ, IWM (operator process config, not a trader-authored list and not “whatever `WARM_SYMBOLS` is today”); if they require universe or a personal watchlist, my cap-8 store and Path-B downsample are the wrong shape.
- PM will accept **RTH-only** (09:30–16:00 ET weekdays) as “open-to-close”; if they require premarket/afterhours, Path-A volume and window predicates change.
- PM will accept Path-B at **300 s** with first-in-window immediate persist, and will treat a warmer miss as a typed hole rather than authorizing a new options REST loop.
- PM will accept **every trade + 1-second last quote**, not every quote and not trades-only; if they require tick-perfect NBBO they are asking for OPRA-file volume this BRIEF culled.
- PM will accept **no prune** and **no backfill**; insurance is “what we appended that day,” including gaps.
- PM will **not** require Path-B for tape names absent from the warm set this slice, and will **not** require silently unioning tape names into `WARM_SYMBOLS`.
- PM will require operator list/load with `Authorizes: nothing` and zero vendor I/O, and will **not** require ticker playback, score input, or session-archive hole-fill as acceptance.
- PM will **not** treat `MarketDataPort::Fixture` as this tape, and will keep `day-replay-mock-adapter` blocked-on.
- PM will accept production **fail-closed** on a dedicated tape body root when tape is enabled (default on), including conflict with ring and session-archive roots.
- UX will add **no trader chrome, no ticker tape player, no linked nav**; the only surface is operator/research, unlinked, same family as session-books / chain-snapshots.
- UX will carry **distinct literals** through the UI for `not_due` / `not_storing` / `missing` / `empty_attempted` / `gap` / `unreadable` / `recording` / `closed`, independently for price tape vs structure snapshots, and will not render a tape occupant as a “present live session book.”
- UX will keep Pages trader origin **404** on `/api/_research` and will not invent trader-route copy that redistributes ticks.
- UX owns layout and copy; they will consume a **list-of-day-identities + load-day** research shape, not a live stream widget.
- Neither PM nor UX will require a second websocket, a new Path-B REST product, or extending `MarketDataSourceKind` so coverage can see tape rows.
