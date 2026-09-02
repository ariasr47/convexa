# capacity-baseline — spec

**Source brief:** .spire/clusters/tech/contracts/capacity-baseline/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-28

## 1. Goal + scope

Give Convexa maintainers a named, repeatable **load** and **soak** harness that drives on-demand ticker-analysis HTTP and live SSE against **mocked vendors**, fails a local or CI command when a locked harness p95 / unexpected-error / stream-hold / refusal-probe threshold is crossed, and writes a receipt that cannot be quoted as a production measurement, a paid-feed test, an SLO, or permission to change score, tier, fingerprint, trader copy, or production runtime defaults. The buyer is a maintainer or quality-gate operator at a terminal or CI log — not the trader.

Owner ruling **D1** (2026-08-28): the four harness p95 fail-lines are warm HTTP **150 ms**, cold HTTP **4000 ms**, SSE time-to-first-byte **200 ms**, SSE emit after inject **500 ms**. They are regression gates for this mocked path, not production SLOs. Prices SSE, when driven (ship-required), **shares** the 200/500 ms TTFB/emit locks under **named prices bases** (not mixed into per-ticker percentiles). Retune only as a numbered amendment after a real CI calibration; never silent auto-tune inside the driver. Unexpected-error **= 0** and unexpected stream-hold drops **= 0** still fail the command.

Owner ruling **D2** (2026-08-28): load LiveCapacity max subscribers is **9**, not 8, so **8 per-ticker SSE + 1 prices SSE** can hold concurrently. `try_admit` refuses when `*n >= max`, so **9 admits succeed at the ceiling**; a 10th on that hold instance would 503 and is **not** the overflow probe. Load HTTP concurrency stays **16** warm. Soak stays **8 HTTP + 32 SSE** under production **500/50**. Overflow remains a dedicated nested `LiveCapacity::new` on a **separate** probe AppState — not 501 connections, not mutating the 32-holder.

Owner ruling **D3** (2026-08-28): the harness drives production HTTP stream routes (`GET /api/stream/{ticker}`, `GET /api/stream/prices`) on loopback. The throwaway process injects a **harness-only hub** whose `subscribe` updates the symbol set for session-ceiling accounting and **does not enqueue `HubCmd`**. Production `StockStreamHub::subscribe` / `admit_and_subscribe` on the live server stay **unchanged**. Structural poison: worker off + many admits ⇒ vendor-subscribe queue does not grow. Not an in-process shortcut that skips HTTP.

**In scope:**
- Two independently invocable operator commands, **`load`** and **`soak`**, that are not aliases of each other or of `serve`.
- A second axis **evidence class** `local` | `ci`. Merge CI invokes **load only**. Soak is **10 minutes local + GATE Q**, absent from the default backend CI job. `Evidence: ci` is merge-job detection via `GITHUB_ACTIONS` (or a workflow-only env the capacity CI step sets) — **not** ambient `CI=true`.
- CI load: **16** warm HTTP + **8** per-ticker SSE + **1** prices SSE; hold max subscribers **9** (at ceiling); wall **20 s** HTTP + **5 s** SSE hold + refusal probe; total **< 60 s**. Soak: **8** HTTP + **32** SSE for **600 s** under production 500/50.
- Closed driven surfaces on a throwaway loopback process: ticker-bundle HTTP, per-ticker SSE, prices SSE (closed 1–2 symbols already on the hub). Stream clients are **HTTP** clients of the production routes.
- Mocked vendor I/O that **never leaves the process**; `MassiveRestClient.request_count() == 0`; paid Options feed never used.
- Checked per-scenario harness p95 (D1), unexpected-error = 0, unexpected stream-hold drops = 0, client timeout = 0, and a **two-check** capacity-refusal probe (not a refusal rate).
- A capacity receipt (file + stdout twin) whose standing cannot be mistaken for `/api/_metrics` p95, a research CLI, or production certification.
- Discoverable names on the Nx `api` project and root npm scripts a maintainer already uses for quality gates (`capacity:load` / `capacity:soak`).
- Score / tier / fingerprint **identity** after a successful load and a successful soak (isolation predicate, skip = fail): Path-B oracle **before** driven work; post-work warm HTTP **triple** **and** a second in-process Path-B, each matching that oracle (not full-envelope HTTP equality).

**Out of scope:**
- Any trader-facing UI, route, nav, Settings, Ask-AI, Ticker, Scanner, Positions, Landing, or `/_ops/metrics` series. **`NO_UI_CHANGE`.**
- Any change to opportunity score, tier, entry gate, fingerprint, weights, or quantitative outputs.
- Any change to **production** defaults: `MAX_LIVE_SUBSCRIBERS=500`, `MAX_LIVE_SESSIONS=50`, Retry-After **30** s, `PUBLIC_RATE_LIMIT_PER_MIN=120`.
- Pointing the harness at Railway / production host, or any recipe that burns the paid Options feed.
- Treating a green hermetic receipt as a production SLO, live-user certification, or score-change authorization (`telemetry-slos` is a later program item).
- Load-testing scanner, AI rec, auth, broker, research CLIs, operator-metrics, or the full public API catalog.
- An in-request market sweep. Concurrency is many clients each asking for **one** ticker.
- Certifying 500 subscribers / 50 sessions as a CI proof. Probes use reduced ceilings on a **dedicated** nested `LiveCapacity` / probe AppState — never 501 connections on the hold instance, never a 10th client on the load 9-holder as the overflow probe.
- A required low-cap public-limiter **429** probe (withdrawn). Harness process may set limiter **0**; production 120 stays.
- New HTTP operations, payload fields, or OpenAPI operations.
- k6 / vegeta / wrk / locust / cloud load, Kubernetes, Kafka, service mesh, multi-replica rate-limit stories.
- 24-hour soak, hosted soak on merge CI, or a second scoring / research-measurement path.
- Reusing `RESEARCH READ` / `RESEARCH REPLAY` as the receipt title.
- Changing production `StockStreamHub::subscribe` / `admit_and_subscribe` (they still enqueue `HubCmd` on the live server).
- Driving streams only via an in-process shortcut that skips HTTP.

**Future (deliberately deferred):**
- Production SLOs, dashboards, and alert runbooks (`telemetry-slos`, program #7).
- Soak on the merge CI path, or a soak longer than 10 minutes, after flake/cost are measured.
- Tightening D1 p95 numbers after observed CI receipts — a **numbered amendment**, never driver auto-tune.
- Exercising production-default 500/50 with real connection counts in a dedicated lab.
- Replica-safe live-stream fan-out (`replica-safe-workers`).
- Remote archive body store and the rest of the production-maturity sequence after this item.

## 2. Architecture

### What this is

A **named, off-request-path load/soak driver** on crate `api-rust`. It boots a **hermetic** process-local server (production **router**, non-production **constructor**), drives concurrent ticker-bundle HTTP and SSE against **in-process mocked vendor I/O**, checks the locked thresholds, writes a capacity receipt, and exits non-zero when a threshold is crossed or the run is vacuous / blocked / incomplete / a start error.

It is a **test driver**, not a runtime service, not a research score lab, and not a second Path-B. The trading/serve request path still computes exactly the one ticker asked for (`[single-ticker-on-demand]` narrowed form). The harness is the HTTP client that asks, repeatedly.

Verified starting seams (read at source, not assumed):

- Live Path B HTTP still calls `state.massive.fetch_options_market_state` / `fetch_daily_bars` / `fetch_intraday_bars` / `fetch_recent_trades` inside `compute_analytics` (`apps/api/src/services/analytics.rs`). `MarketDataPort` is **not** on that path.
- `MarketDataPort::Live` is **not** a behavior-identical stand-in (hardcoded 3600 s trade lookback vs live `include_dark_pool` / `darkpool_lookback_secs`). This slice does **not** rewire production HTTP onto that port.
- `MassiveRestClient::request_count()` (`apps/api/src/infrastructure/massive/rest.rs`) is the outbound-attempt counter.
- `StockStreamHub::dormant` builds the broadcast bus without a network task; `server::serve` is what calls `stock_worker.start()`. The harness **never** calls `server::serve` and **never** starts that worker. Production `StockStreamHub::subscribe` always enqueues `HubCmd::Subscribe` after updating the symbol set — **unchanged on the live server**. The harness process injects a **harness-only hub** whose `subscribe` updates the symbol set and does **not** enqueue `HubCmd`. Harness admits still go through production HTTP stream routes (those handlers still call `admit_and_subscribe` → `hub.subscribe` on the injected hub).
- `LiveCapacity` (`apps/api/src/services/live_capacity.rs`): defaults `MAX_LIVE_SESSIONS=50` / `MAX_LIVE_SUBSCRIBERS=500` (`config.rs`); over either → **503 + `Retry-After: 30`**, not 429; trader detail `Live streaming is at capacity. Try again shortly.` (`CAPACITY_DETAIL`, `routes/stream.rs` `capacity_unavailable`). Ceilings are set only in `LiveCapacity::new` — **no setter**. Overflow therefore cannot lower ceilings on a live holder instance. `try_admit` refuses when `*n >= max_subscribers` (N concurrent admits succeed at max N; N+1 on that instance is refuse).
- `PUBLIC_RATE_LIMIT_PER_MIN` default **120**, **`0` disables** — already documented in `config.rs` as the load-test dial. 429 body is `error: rate_limited` + `Too many requests. Limit is {n} per minute per IP on data endpoints.`
- `AppState::for_tests` / `for_runtime_guardrail_tests` still construct `MassiveRestClient` against `rest_base: "https://api.massive.com"`, set `LiveCapacity::new(0, 0)`, and do not seed a vendor fixture. They are the **wrong** constructor here.
- `compute_analytics_from_vendor` is the no-network Path-B once a `VendorBundle` exists. `GexFlight` coalesces concurrent misses for one ticker.
- Golden `libs/quant-engine/tests/fixtures/gex_SPY.json` records `meta.contract_count: 14218`. `apps/api/data/chain_snapshots/SPY.json` and `tests/fixtures/market/syn_mini.json` are **tiny** books and must not become the capacity corpus.
- Nx `api` targets today: `serve`, `build`, `test`, `api-contract-check`. CI backend job: `cargo test -p api-rust -p quant-engine --locked` plus postgres-gated suites. No capacity step yet.

### Commands, evidence, profiles

Closed **command** vocabulary: `load` | `soak`. Closed **evidence** vocabulary: `local` | `ci`. These are different axes. A local pre-push of the short job is **not** CI evidence. A CI load is **not** soak evidence.

| | **load** | **soak** |
| --- | --- | --- |
| Operator invocation | `cargo run -p api-rust -- capacity load` · `npm run capacity:load` · uncached Nx `api:capacity-load` | `cargo run -p api-rust -- capacity soak` · `npm run capacity:soak` · uncached Nx `api:capacity-soak` |
| Where | Local and merge CI | Local and GATE Q; **absent** from the default backend CI job |
| Evidence class | `ci` only when merge-job evidence is detected: `GITHUB_ACTIONS` is truthy, **or** a workflow-only env the **capacity CI step** sets is present. Ambient `CI=true` is **not** `Evidence: ci`. `CI=true npm run capacity:load` on a laptop prints `Evidence: local`. Not a clap flag that can relabel a local run as `ci`. | `local` (GATE Q soak is not merge-CI evidence) |
| Wall | **20 s** warm HTTP + **5 s** SSE hold + refusal probe; total **< 60 s** | **600 s** hold |
| Warm HTTP concurrency | **16** | **8** sustained |
| Per-ticker SSE hold | **8** | **32** |
| Prices SSE | **1** client held **concurrently** with the 8 per-ticker clients (9th subscriber slot) on a **closed 1–2 symbol list** already on the hub. Non-zero. Not a second 8/32 fan-out. Shares D1 200/500 ms TTFB/emit under **prices** basis strings. | Same rule (non-zero, not a second 32 fan-out); 32 per-ticker + prices still **under** production 500 |
| LiveCapacity during hold | Main instance **9** subscribers / **4** sessions. Concurrent hold is **8 per-ticker SSE + 1 prices SSE = 9** admitted streams **at** the subscriber ceiling (`>= max` refuse; 9 admits succeed). Not “under.” | Main instance production defaults **500** / **50** with **32** SSE held (**under**; never mutate — no setter) |
| Overflow probe | Dedicated nested `LiveCapacity::new` at **reduced** probe ceilings on a **dedicated probe AppState** (same process), exposed by a **second loopback bind** of `routes::router(probe state)` on `127.0.0.1:0`. Overflow clients are HTTP clients of that probe listener. Not the hold instance. Not a 10th client on the 9-holder. Not 501 connections. Not tower oneshot. | Same dedicated-probe mechanism (second loopback bind). **Forbidden:** a second admit wave against the 500/50 32-holder; opening 501 connections; lowering ceilings on the holder |
| Rate limit this process | **0** (existing load-test disable) | **0** |
| Fixture | `gex_SPY.json`, refuse if `contracts.len() < 1000` | same |

Receipt records the duration and concurrency **actually used**. A load receipt cannot print `Command: soak` or claim 32-connection / 10-minute evidence. A soak receipt cannot print `Command: load`. Incomplete copy is elapsed < locked span (load: the designed sequence; soak: 600 s) → `[INCOMPLETE]`, never PASS.

<!-- spire:council-resolution:v1 6d444002fcda5337f634dbb4436a59067239307e3eb6c47bb1bffbfbf30d4445 folded -->
<!-- spire:council-resolution:v1 ea8b01f5b4f37738f6c50181c484c85b0bbf6d27a8ab218a9221092ac60a3190 folded -->
<!-- spire:council-resolution:v1 2254ef1650e279cbdc3fd66fc5420eca3f38a8c95cb0ae1090ffaca45533b5f7 folded -->
<!-- spire:council-resolution:v1 c75ddfcdec20e408be25c6b4d9a0873306ab48f7297bdf48bc97034c64fed785 folded -->
<!-- spire:council-resolution:v1 91aac0ccf4041f9a19b3308fd939f2fed9b9b2197c3d17cd919af3ac5968f95b folded -->

### Component boundaries

| Piece | Lives | Does not |
| --- | --- | --- |
| Capacity harness leaf | new `apps/api/src/services/capacity_harness/` (one-way; not imported by `quant-engine`, `signals`, routes, or production `server::serve`) | Not a background worker, not an HTTP resource |
| Command | new clap nested `capacity {load\|soak}` + `cmd_*` body, sibling of research commands, **distinct entry** | Does not fold into `serve`, `batch-backtest`, or `score-lab`; no clap flag that relabels `Evidence` |
| Nx / CI | new **uncached** `api` targets `capacity-load` / `capacity-soak`; backend CI step invokes **load only** | Soak is not a default CI step |
| Isolation tests | `apps/api/tests/capacity_baseline_isolation.rs` (+ clap/exit tests in the existing `*_cli.rs` style) | Not a substitute for the named command |
| Production router | reused `routes::router` / `contract_router` graph (52 operations, unchanged) | No new operation, no `/_ops` or `/_research` capacity route |
| Production `serve` | untouched bootstrap order | Harness never calls `server::serve` |
| Hold listener | `routes::router(hold state)` bound `127.0.0.1:0` | Never `0.0.0.0`; never `localhost` (IPv6 `[::1]` trap) |
| Dedicated probe AppState | same process; `LiveCapacity::new` at **reduced** probe ceilings; own harness-only hub; **second loopback bind** of `routes::router(probe state)` on `127.0.0.1:0` | Not the soak 32-holder; no ceiling setter; overflow clients never hit the hold listener; not in-process oneshot |
| Harness-only hub | installed by `for_capacity_harness` (and the probe constructor) on the throwaway process; `subscribe` updates the symbol set and **does not enqueue** `HubCmd` | Production `StockStreamHub::subscribe` / `admit_and_subscribe` on the live server **unchanged** (they still enqueue `HubCmd`) |
| Quant engine | empty feature diff | No math, score, gate, or fingerprint change |
| Dashboard | empty feature diff | `NO_UI_CHANGE` |

### Mock / stub boundary (load-bearing)

Vendor I/O must never leave the process. Mechanism, stacked (any layer failing the run is a non-zero exit — fail closed for the *harness*):

1. **Harness constructor only** (`AppState::for_capacity_harness`). It does **not** call `Config::from_env` (that requires `MASSIVE_API_KEY` and would pick up a developer `.env` paid key). Dedicated stub config: dummy key, `rest_base` aimed at a **non-accepting loopback** (leaked fetch fails fast), `warm_enabled=false`, `scan_enabled=false`, `chain_snapshot` **Disabled**, session archive Disabled, `public_rate_limit_per_min=0`, `APP_ENV` not `prod`, in-memory price cache (`PriceCache::connect(None)`).
2. **Additive `vendor_fixture` on `AppState`**, `None` in production `construct`. When `Some`, `compute_analytics` and `fetch_quick_live_price` resolve from the `FixtureCatalog` / golden book and **do not** call `MassiveRestClient` fetch methods. When `None`, today's four-fetch join is byte-identical. Production `construct` never reads a fixture path and **refuses to start if the fixture is Some while `APP_ENV=prod`**.
3. Do **not** rewire HTTP onto `MarketDataPort::Live`. `MarketDataPort::fixture` remains the catalog type reused for the Some arm.
4. **SSE hub is local-loopback.** Dormant hub, network worker not started. The throwaway process injects a **harness-only hub** whose `subscribe` updates the symbol set (needed for session ceiling `symbol_count` / `missing_count`) and **does not enqueue** a vendor `HubCmd`. Harness clients drive production HTTP stream routes on the hold listener (and overflow on the probe listener) — **not** an in-process shortcut that skips HTTP. Production `StockStreamHub::subscribe` and `LiveCapacity::admit_and_subscribe` on the live server stay **unchanged**. Injected `StreamEvent`s publish on the existing `event_tx` broadcast. No `tokio-tungstenite` connect.
5. **Outbound proof is a pass predicate:** `massive.request_count() == 0` at end of run. Isolation source scan forbids harness/`cmd_*` from calling `stock_worker.start()`, `Config::from_env`, `MassiveRestClient` fetch methods, `MarketDataPort::live`, or `connect_async`. A poison test that performs one fake increment/fetch must make the command fail.
6. **Workers the harness does not spawn:** stock WS supervisor, GEX warmer, scanner sweep, liquid-name ensure. Capture is Disabled.

dotenv in `main.rs` may still load a real `MASSIVE_API_KEY` into the process environment for every subcommand. The harness **must not read it**. Dummy key + unroutable base + `request_count==0` is the containment.

### Surfaces under test (closed)

The driver exercises **existing trader-path** surfaces only, one ticker per HTTP request, as an **HTTP client** of the throwaway listeners:

1. **Ticker bundle HTTP** — production `load_analytics` (cache hit and coalesced miss). Concurrent clients all request the **same** fixture symbol so `GexFlight` coalescing is real production behavior, not an in-request universe sweep. Route: existing `GET /api/ticker/{ticker}` on the **hold** listener.
2. **Per-ticker SSE** — admit + hold + tick fan-out. Route: existing `GET /api/stream/{ticker}` on the **hold** listener.
3. **Prices SSE** — admit + hold on a **closed 1–2 symbol list** already on the hub, **concurrent** with the per-ticker hold (load: 1 prices client as the 9th subscriber). Route: existing `GET /api/stream/prices` on the **hold** listener. Not a 120-symbol harvest. Ship-required; TTFB/emit share D1 **200/500 ms** under prices basis strings.

**Deliberate capacity-refusal probe** (same process, **dedicated nested LiveCapacity / dedicated probe AppState**, **second loopback bind** of `routes::router(probe state)` on `127.0.0.1:0`): construct a separate `LiveCapacity` with `new` at probe ceilings **below** client count (reduced; never production 500/50 for this wave). Open `max_subscribers+1` (and independently `max_sessions+1` new symbols) **as HTTP clients of that probe listener**. Expect **HTTP 503 + Retry-After 30**. Those 503s are **expected refusals**, not unexpected errors. A probe that records **zero** such refusals is **vacuous**, not a green low rate.

Do **not** mutate ceilings on the hold instance (`LiveCapacity` has no setter). Do **not** open 501 connections. Do **not** run a second admit wave against the soak 500/50 instance that is holding 32 SSE. Do **not** use a 10th client on the load 9-holder as the overflow probe. Do **not** admit overflow via tower oneshot or any in-process shortcut that skips HTTP. Load hold stays **9 subscribers / 4 sessions** on its main instance (**at** subscriber ceiling: 9 admits succeed); soak hold stays 500/50 with 32 SSE on its main instance (**under**); overflow is always the dedicated probe on the second bind.

**Positive controls (required, not optional):**
- Live clients at the **hold** ceilings: **admitted** (hold instance; load: all 9 stream slots).
- Many live clients on **one** ticker, under the **probe** subscriber ceiling: **admitted** even if their count exceeds the probe session ceiling (dedicated probe AppState / second bind; AC-22 uses session ceiling 1).
- After a successful **soak**, one follow-up ticker-analysis request against the **same** harness-controlled process (the hold instance, not the probe) is served successfully **before** teardown (process not left unable to serve). Then shutdown; `subscriber_count` returns to **0**.

**Out of the harness as surfaces:** recommendation/LLM, broker, auth writes, scan board, candidates, contract lookup, `_research`, `_metrics`, demo HTML. Optional health ping before load is allowed; health is not a driven capacity surface.

No new HTTP operations. OpenAPI / generated client bytes stay identical.

### Vendor corpus

The compute book is the checked-in golden `gex_SPY.json` (14 218 contracts), adapted **inside the harness leaf** into one `VendorBundle` (spot + contracts; daily/minutes/trades empty → HV/VWAP/off-exchange omit under existing `[best-effort-isolated-or-null]`). The command **refuses to run** if `contracts.len() < 1000` (or the golden's own `meta.contract_count` if present and below floor). **No fallback to `syn_mini`.** Missing file is a hard error, not a skip-as-pass.

That book is **CPU-representative of Path B**, not of Massive RTT. The receipt standing must say so.

Warm path: one coalesced miss fills `gex_cache` + price cache; subsequent HTTP is cache-hit. Cold wave is measured once at the start (or after a deliberate cache flush) so a coalescing/cache regression still shows up. The cold wave is a **counted scenario**, not a silent warmup. If any additional warmup window exists, the receipt **names** it; a run that then performs zero counted work is a configuration failure, not a pass.

### Data-flow

```
clap command (load | soak)
  → Path-B oracle on the golden book (before driven work)
  → for_capacity_harness(stub config, fixture catalog, hold ceilings on the main LiveCapacity, harness-only hub)
  → dedicated probe AppState with LiveCapacity::new(reduced probe ceilings) and its own harness-only hub
  → routes::router(hold state)  [production graph]
  → bind 127.0.0.1:0   [hold listener; never 0.0.0.0; never APP_ENV=prod; never `localhost` — this host's IPv6 [::1] trap]
  → routes::router(probe state)  [same production graph, dedicated probe AppState]
  → bind 127.0.0.1:0   [second loopback listener; overflow HTTP only]
  → do not start WS worker / warmer / scanner / ensure
  → harness HTTP clients hit production ticker + stream routes on the hold listener
  → injected hub.subscribe updates the symbol set and does not enqueue HubCmd; inject loopback StreamEvents on the hub bus
  → closed scenario set with concurrent HTTP + SSE clients (hold instance; load: 8 per-ticker + 1 prices at subscriber ceiling 9)
  → overflow HTTP clients against the second loopback bind of routes::router(probe state) only
  → sample wall-clock latencies + status classes
  → post-work: warm HTTP score/tier/fingerprint triple + second in-process Path-B vs oracle
  → evaluate locked thresholds + identity proof
  → write receipt (standing first)
  → soak only: one follow-up ticker-analysis request must be served (hold instance)
  → shutdown; subscriber_count must return to 0
  → exit 0 or non-zero
```

### Closed scenario set

| Scenario | What it measures | Isolation |
| --- | --- | --- |
| Cold coalesced bundle | Concurrent first-miss HTTP on one symbol; one compute, N−1 waiters | Fixture vendor; flight map |
| Warm bundle | Locked warm HTTP concurrency, cache-hit | Cache already filled; still one ticker |
| SSE hold | Locked per-ticker subscribers; ticks injected at 1 Hz; **non-comment injected events > 0** or the scenario **fails**, not skip | Local hub; worker off; harness-only hub; HTTP on hold listener |
| Prices SSE | Admit + hold **concurrent** with per-ticker, closed 1–2 symbols already on the hub; TTFB/emit share 200/500 ms with **prices** bases | Same hub; load uses the 9th subscriber slot |
| Capacity refusal | Subscriber overflow and a new-symbol session overflow, with the positive controls above; refuse observed as **HTTP 503** | Dedicated probe AppState / `LiveCapacity::new` at reduced ceilings — **second loopback bind** of `routes::router(probe state)` — **not** the hold instance, **not** production 50/500 as the overflow target, **not** oneshot |
| Disconnect release | After client drop, `subscriber_count==0` | Guard Drop already in `LiveCapacity` |

The harness does **not** open 500 real SSE connections in CI. Soak overflow does **not** open 501 connections on the 500/50 holder. Load overflow does **not** open a 10th client on the 9-holder.

### Checked thresholds (command fails non-zero if any trip)

p95 is computed only from **successful** samples of **that named scenario**. Mixing cold and warm into one percentile is forbidden. Do not emit one blended “ticker-analysis p95.” Do not mix prices SSE samples into per-ticker SSE percentiles.

| Scenario | Printed basis (exact) | Fail-line |
| --- | --- | --- |
| Warm HTTP | `warm cache-hit bundle GET wall` | p95 **≤ 150 ms** |
| Cold HTTP | `cold coalesced bundle GET wall` | p95 **≤ 4000 ms** |
| SSE TTFB | `per-ticker SSE time-to-first-byte` | p95 **≤ 200 ms** |
| SSE emit | `per-ticker SSE emit after inject` | p95 **≤ 500 ms** |
| Prices SSE TTFB | `prices SSE time-to-first-byte` | p95 **≤ 200 ms** |
| Prices SSE emit | `prices SSE emit after inject` | p95 **≤ 500 ms** |

Owner D1: these are **harness regression gates**, not production SLOs. Retune only as a numbered amendment after a real CI calibration; never inside the driver. Prices SSE reuses the SSE 200/500 ms numbers under **distinct bases**.

Also fail the command:

- **Unexpected** 4xx/5xx count **= 0** (limiter is off; fixture book must exist). Expected probe 503s are **excluded**.
- **`unexpected stream-hold drops` = 0**.
- **`client timeout` count = 0** (harness gave up waiting). Timeouts are a distinct class, not parked off the error lock, and not filed as unexpected error. This lock is on the standing Thresholds list and on the `[PASS]` line.
- Refusal **two checks** (not a rate): (1) **hold phase** → subscriber-ceiling count **0** and session-ceiling count **0** on the **hold** instance (load: 9 concurrent streams **at** ceiling 9, all admitted; soak: 32 SSE **under** 500/50); (2) overflow on the **dedicated probe AppState** via the **second loopback bind** → **every** overflow attempt is **HTTP 503 + Retry-After 30** (all-admit is vacuous fail).
- `request_count == 0`.
- Post-shutdown `subscriber_count == 0`.
- After a successful load **and** after a successful soak: identity proof (isolation predicate, **skip = fail**). **Oracle first:** before any driven work, same-process Path-B `compute_analytics_from_vendor` on the golden book yields `opportunity_score` / `opportunity_tier` / `state_fingerprint`. **Then after the closed scenario set, still the same process:** (1) a warm ticker-analysis HTTP GET for that fixture symbol through the production router; the **score / tier / fingerprint triple** taken from that response — **not** the full route envelope — must be byte-identical to that oracle; (2) a second in-process Path-B call on the same book must be byte-identical to **that same oracle**. Skipping the GET, skipping either equality, or comparing Path-B only to itself is vacuous and is **not** a pass. A capacity FAIL cannot be turned into PASS by a matching triple. Empty `quant-engine` diff is **necessary and not sufficient**. Score/tier/fingerprint are **not** p95/error locks.

A 429 while this process limiter is **0** is **blocked / harness error**, not a pass. Rate-limit refusal remains a named class with count **0** when the limiter is off — never a blank empty. There is **no** required low-cap 429 probe in this slice.

<!-- spire:council-resolution:v1 45dd7edff075f3f96d6c4c7ae9fee286ce0b7d648591df4f41c78a5ee2101464 folded -->
<!-- spire:council-resolution:v1 c2a867d4e2f0624f93cf48c09c926fd7f64dbd1f9ade7af92416be639f7b6f10 folded -->
<!-- spire:council-resolution:v1 16b124f28cce629912993b21ae0f63b509e9e8ef8fc9f41188113676fdaa5884 folded -->
<!-- spire:council-resolution:v1 c40411fb0d6dff11a5cd9ab5172d94ced29ecc945adb7f7527439380b939fb84 folded -->
<!-- spire:council-resolution:v1 58d5355addd3c915e11f6c147a9abfaa7144737e21c74a8e7233493e220f1d82 folded -->

### Receipt (artifact, not a wire)

One artifact per run under a **capacity** directory (not `data/research/`, so it cannot be mistaken for a score-lab diary). Default path family: `data/capacity/capacity_{load|soak}_{stamp}.json`. Semantic content on **pass** and **threshold-fail**:

- Closed **standing** first (copy in §4)
- Command `load` | `soak` and evidence `local` | `ci`
- Surfaces **actually driven this run** (never “the API”; never a hardcoded three-surface list when a surface did not execute)
- Scenario inventory actually executed vs configured-not-run
- Duration, concurrency, fixture identity + **contract count**
- Process-local ceilings actually used (hold vs probe), framed as **this process, not production defaults**, and naming the dedicated probe AppState vs the hold instance
- Hold loopback bind vs dedicated probe loopback bind (two `127.0.0.1:0` listeners; overflow samples name the probe bind)
- Per-scenario harness p95 (ms + basis) beside the D1 lock, including prices SSE bases when that surface ran
- Counts by closed outcome class (§4) — including `client timeout` and `unexpected stream-hold drops`
- Vendor-I/O proof (`request_count`, worker-not-started, rest_base family)
- Pass/fail per threshold and per refusal check
- Identity proof fields: `identity_oracle` (Path-B triple **before** driven work), `identity_http` (post-work warm HTTP **score/tier/fingerprint triple**, not the full route envelope), `identity_path_b` (post-work in-process Path-B triple). Omitting any of the three, or equalizing Path-B only to itself, cannot PASS.
- Per-request ticker inventory `ticker_analysis_request_tickers` (list, one symbol per issued ticker-analysis request; an equivalently named per-request ticker list is allowed). Required on pass/threshold-fail so AC-36 is observable without reading source.
- Host identity (os) so a local Windows soak is not a CI measurement
- Soak success: follow-up ticker-analysis liveness recorded as served

**Vacuous / blocked / incomplete / start-error** runs emit a **short non-measurement record** (standing + verdict + `No pass recorded`) with **no** observed-p95 table and no executed-concurrency measurement block.

Empty corpus / missing golden / contract-count floor fail **before** writing a passing receipt.

### Isolation / error rules

- Harness failure (bind fail, missing fixture, leaked vendor I/O, threshold trip) = **process non-zero**. It does not change trader HTTP error policy.
- `[best-effort-isolated-or-null]` still governs optional bundle fields inside Path B.
- Capacity 503 remains the live-hub refuse class; rate-limit 429 is **out of this feature’s default profiles** (limiter off). Production 120/min is not retuned.
- Production `APP_ENV=prod` bootstrap, CORS, cookies, Postgres preflight, archive-root probe: **untouched**.
- `[no-secrets-in-image]`: dummy key only; receipts/logs scanned so they cannot contain `MASSIVE_API_KEY` values or `apikey=` query fragments.
- First hosted wall times of the new command stay `[lane-check]` until the first real CI run; the workflow must still be wired so “not run” cannot be reported as pass. D1 numbers remain the v1 locks until a numbered amendment.

### Structural enforcement (poison → red)

- Source scan: harness leaf + `cmd_capacity_*` contain no `MassiveRestClient` fetch, no `stock_worker.start()`, no `Config::from_env`, no `MarketDataPort::live`. The scan **allows** equality-to-oracle on `opportunity_score` / tier / `state_fingerprint` and **forbids** using that triple as a capacity threshold (no fail-if-score-below-N). Anti-vacuity: scan also asserts the command body *does* construct `for_capacity_harness` / bind loopback / evaluate thresholds, **and** that identity equality actually runs — Path-B oracle call site **before** driven work; post-work warm-HTTP **triple** match **and** second in-process Path-B match to **that oracle**. Comparing Path-B only to itself is a scan fail. Nested isolation tests may poison the equality; they do not replace the command-path proof.
- Fixture floor: a test that points the loader at `syn_mini.json` must refuse.
- Receipt standing: a fixture receipt with standing omitted fails the parser test.
- `request_count` predicate: a unit double that increments the counter fails the run.
- Production `construct` with fixture Some + `APP_ENV=prod` refuses.
- CI workflow grep: backend job contains the named **load** command; **soak** command is absent from the default job.
- OpenAPI / generated artifacts: no delta. `quant-engine` diff empty. Dashboard source diff empty.
- HubCmd: harness-only hub `subscribe` does not enqueue; worker off + many HTTP admits must not grow a vendor-subscribe command queue. Production `StockStreamHub::subscribe` / `admit_and_subscribe` on the live server stay unchanged.
- Evidence classifier: `CI=true` with `GITHUB_ACTIONS` unset (and no capacity-step-only env) classifies `local`. A clap flag that sets evidence is a scan/CLI fail.
- Overflow path: isolation asserts a second `127.0.0.1:0` bind of `routes::router(probe state)` and that overflow samples are HTTP 503 from that listener, not oneshot and not the hold bind.

**Failure modes + isolation:** A crossed lock fails the command and names that lock; it does not become a trader 5xx. A mock leak or unverifiable vendor-I/O claim is `[BLOCKED]`, never a PASS with the vendor line omitted, and never a `MOCKED VENDORS` title on that leak. A 0-request run is `[FAIL]` vacuous, never a clean baseline. A run that executed only a subset of surfaces is `[FAIL]` naming the missing surface — **not** “0 requests selected.” An incomplete soak cannot be quoted as 10-minute evidence. Harness errors stay on the operator command (`[best-effort-isolated-or-null]` applied to this tool: they do not become a new trader-visible error on ordinary bundle/SSE). Partial application of fixture Some onto production `APP_ENV=prod` is refused.

**Not buildable / rejected approaches:**
- External k6 / vegeta / wrk / locust against `npx nx serve api` (cannot see `request_count`, tempts a live paid feed).
- tower `oneshot` only (cannot prove SSE subscriber slots, TCP hold, or disconnect-release). Overflow in particular is **not** oneshot against probe state — it is HTTP on the second loopback bind.
- Rewiring production HTTP onto `MarketDataPort::Live`.
- Reusing `AppState::for_tests` (ceilings off, `rest_base` to api.massive.com).
- Tiny-book fallback to `syn_mini` / one-contract conformance SPY.
- Blending cold and warm into one ticker-analysis p95.
- Operator-facing command named `ci` (collides with evidence class).
- 500 real SSE connections or a 10-minute hold in GitHub Actions.
- Opening 501 connections, mutating hold-instance ceilings, a second admit wave against the soak 500/50 32-holder, or a 10th client on the load 9-holder as the overflow probe.
- New public JSON/HTTP capacity API.
- Dashboard chrome, `/_ops` visualization, or Ask-AI footnote.
- Silent auto-tune of D1 fail-lines.
- Required low-cap 429 probe.
- Optional score-identity check (skip = fail).
- Comparing Path-B only to itself as the identity proof.
- Treating post-work HTTP identity as full route-envelope equality (it is the score/tier/fingerprint triple).
- Detecting `Evidence: ci` from ambient `CI=true`, or a clap flag that relabels evidence.
- Changing production `StockStreamHub::subscribe` so it stops enqueueing `HubCmd`.
- Driving streams only via an in-process shortcut that skips HTTP.
- `RESEARCH READ` / `RESEARCH REPLAY` standing title.
- Hardcoding `MOCKED VENDORS` on a `[BLOCKED]` vendor-leak standing title.

## 3. Acceptance criteria (with user stories)

Each AC is observable from command listing, exit code, stdout/receipt text, vendor-I/O isolation, OpenAPI/generated bytes, dashboard/copy-table scan, or a served bundle’s score triple — without reading implementation source. All rows are ship-blocking. `test` vs `review` follows risk-based verify: silent/negative-space invariants are `test`; visible intentional naming/cadence is `review`.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | As a maintainer, I want a named load command so that a capacity regression fails before I push. | Root npm scripts and the Nx `api` project list a load command whose name reads as load (not soak, not `serve`, not a generic “test”), invocable independently. | review |
| 2 | As a maintainer, I want a named soak command so that a leak a short load would miss fails a longer run. | The same listings expose a soak command that is not an alias of load or of `serve` and is invocable independently. | review |
| 3 | As a maintainer, I want load to pass when the mocked process stays within locks. | Given mocked vendors and a process that does not exceed the load hold ceilings (9 subscribers / 4 sessions), `capacity load` exits 0 and writes a load receipt. | test |
| 4 | As a maintainer, I want soak to pass the same way for the long hold. | Given the same mocked-vendor setup under production 500/50, `capacity soak` exits 0 and writes a soak receipt. | test |
| 5 | As a maintainer, I want a successful load identity that matches the driver. | A successful load receipt records Command `load`, 16 warm ticker-analysis clients, and **8 per-ticker SSE clients plus 1 prices SSE client held concurrently** (9 admitted streams at this-process subscriber ceiling 9; hold-phase subscriber-ceiling refusals 0), 20 s warm HTTP + 5 s SSE hold + refusal probe, and total wall **< 60 s**. Standing `Surfaces:` lists those actually driven surfaces (not a hardcoded list the run did not execute). | test |
| 6 | As a maintainer, I want soak evidence that cannot be confused with load. | A successful soak receipt records Command `soak`, 8 HTTP + 32 per-ticker SSE, **600 s** of sustained work, prices SSE non-zero, and cannot be labeled load. Standing `Surfaces:` lists those actually driven this run. | test |
| 7 | As a maintainer, I want per-scenario latency gates, not a blended p95. | On a successful load, the receipt’s harness p95 values from successful samples only are ≤ 150 ms warm cache-hit bundle GET wall, ≤ 4000 ms cold coalesced bundle GET wall, ≤ 200 ms per-ticker SSE time-to-first-byte, ≤ 500 ms per-ticker SSE emit after inject, ≤ 200 ms prices SSE time-to-first-byte, and ≤ 500 ms prices SSE emit after inject. No single blended ticker-analysis p95 is emitted, and prices SSE samples are not mixed into per-ticker SSE percentiles. | test |
| 8 | As a maintainer, I want the same latency gates on soak. | A successful soak receipt satisfies the same six per-scenario p95 fail-lines (four D1 HTTP/per-ticker bases plus prices SSE TTFB/emit at 200/500 ms). | test |
| 9 | As a maintainer, I want unexpected failures to fail the command. | On a successful load, unexpected-error count is 0, `unexpected stream-hold drops` count is 0, and `client timeout` count is 0. | test |
| 10 | As a maintainer, I want the same unexpected-failure locks on soak. | A successful soak receipt shows unexpected-error 0, `unexpected stream-hold drops` 0, and `client timeout` 0. | test |
| 11 | As a maintainer, I want soak not to wedge the process. | After a successful soak, one follow-up ticker-analysis request against the same harness-controlled process is served successfully before teardown. | test |
| 12 | As a maintainer, I want a crossed warm p95 to fail load. | When warm HTTP latency is forced above 150 ms p95, load exits non-zero and the receipt names the **warm cache-hit bundle GET wall** lock as failed. | test |
| 13 | As a maintainer, I want unexpected errors to fail load by name. | When unexpected errors are forced above 0, load exits non-zero and the receipt names the **unexpected-error** lock as failed. | test |
| 14 | As a maintainer, I want stream-hold drops to fail load by name. | When unexpected live-stream drops are forced during the hold, load exits non-zero and the receipt names the **`unexpected stream-hold drops`** lock as failed. | test |
| 15 | As a maintainer, I want capacity evidence never to burn the paid Options feed. | A full successful load and a full successful soak each complete with **zero outbound vendor I/O** (`request_count == 0`) and print the vouched in-process mock line. | test |
| 16 | As a maintainer, I want a missing mock to refuse rather than fill in live. | When the mock/fixture is absent or unusable, the invoked command exits non-zero as a configuration / blocked failure, performs zero outbound vendor I/O, and writes no success receipt. | test |
| 17 | As a maintainer, I want a live-vendor or production-host target refused before work. | When configuration would use a live vendor, `MASSIVE_API_KEY` as the fetch key, or a production host, the command refuses **before** issuing work, exits non-zero, writes no success receipt, and does not print the key. | test |
| 18 | As a reviewer, I want zero work never to look like a pass. | A run that executes zero ticker-analysis requests **and** zero live-stream clients exits non-zero, is labeled `[FAIL]` vacuous (`0 requests selected; no pass recorded.`), and writes **no** quoteable measurement p95 table. | test |
| 19 | As a reviewer, I want a failed start not to look like a threshold pass. | Failure to start the harness-controlled process exits non-zero as `[ERROR]` with a closed reason, not as a passed threshold check and not as a configuration-empty pass. | test |
| 20 | As a reviewer, I want an interrupted run not to leave a success receipt. | An interrupted / crashed run exits non-zero and leaves no success receipt that could later be quoted as a pass. | test |
| 21 | As an operator, I want the subscriber ceiling exercised without opening 501 production connections. | Overflow runs as **HTTP clients** of a **second loopback bind** of `routes::router(probe state)` on `127.0.0.1:0`, against a dedicated nested `LiveCapacity` constructed with `new` at harness-local subscriber ceiling N (reduced; never 500 for this probe; never the hold listener). The first N live clients on that probe are admitted and the next is refused **HTTP 503** with **Retry-After: 30**. Load hold remains 9 concurrent streams on the main instance at ceiling 9 (9 admits succeed; a 10th on that instance is not the overflow probe). Soak hold remains 32 SSE on the main instance at 500/50; that instance is not ceiling-mutated and is not the overflow target (no 501st connection, no second admit wave against 500/50). Overflow is not tower oneshot and does not skip HTTP. | test |
| 22 | As an operator, I want session ceiling ≠ subscriber ceiling. | On the dedicated probe AppState (second loopback bind) with harness-local session ceiling 1, multiple live clients on **one** ticker are admitted while under the subscriber ceiling, and a client that would add a **second** live ticker is refused **HTTP 503** with **Retry-After: 30**. This is not a second admit wave against the soak 500/50 holder and not an in-process shortcut that skips HTTP. | test |
| 23 | As an operator, I want an all-admit overflow probe to fail as vacuous. | If the overflow probe records zero subscriber-ceiling and zero session-ceiling refusals, the command exits non-zero and does not PASS. | test |
| 24 | As an operator, I want hold-phase refusals not to count probe 503s as errors. | During the hold phase, subscriber-ceiling and session-ceiling refusal counts are 0 (load: 9 concurrent streams **at** subscriber ceiling 9, all admitted; soak: 32 SSE **under** 500/50); probe HTTP 503s are excluded from unexpected-error; `[FAIL]` names which lock **or** which probe check tripped. | test |
| 25 | As an operator, I want refusal families textually distinct. | Finished measurement receipts count `ok`, `subscriber-ceiling refusal`, `session-ceiling refusal`, `rate-limit refusal`, `unexpected error`, `unexpected stream-hold drops`, and `client timeout` as **separate** named classes. 503 is never filed as `unexpected error` or `rate-limit refusal`. With limiter 0, rate-limit refusal is printed as count **0** (class named), never blank / `n/a`. | test |
| 26 | As the desk owner, I want production ceilings unchanged. | After this feature ships, production defaults remain live-subscriber ceiling 500, live-session ceiling 50, retry guidance 30 seconds, and public request budget 120 per minute. | test |
| 27 | As a maintainer, I want the harness not eaten by the production request budget. | Load and soak complete their in-threshold runs without being failed by production-default 120/min (harness-local limiter 0 is allowed and printed as this process). | test |
| 28 | As a maintainer, I want a 429 while the limiter is off treated as a harness error. | If a 429 appears while this process `PUBLIC_RATE_LIMIT_PER_MIN` is 0, the command exits non-zero as blocked/harness error and is not a PASS. | test |
| 29 | As a reviewer, I want every finished run framed as a harness, not production. | Every finished receipt starts with `CAPACITY HARNESS` and **NOT A PRODUCTION MEASUREMENT**. Success and threshold-fail receipts (mock vouched) also state `MOCKED VENDORS` and the in-process mock line. A `[BLOCKED]` vendor-leak / unverifiable-I/O / paid-feed record **must not** claim `MOCKED VENDORS` or print the vouched mock line. Deleting surrounding prose cannot remove standing. Standing is the **first** block of stdout (default mode) and of the receipt file. | test |
| 30 | As a reviewer, I want a green run unable to launder into an SLO or score change. | Receipt and stdout contain no language that would read as a production SLO, production p95, live paid-feed measurement, “production ready,” “verified,” “certified,” “can handle,” or permission to change live score / tier / fingerprint / weights / production ceilings. Enforced by a scan over the run’s own emitted strings. | test |
| 31 | As a release owner, I want CI load not reported as soak or as a local `CI=true` run. | The merge CI backend job invokes the load command and does **not** invoke the soak command. A merge-job load (`GITHUB_ACTIONS` truthy, or a workflow-only env the capacity CI step sets) prints `Evidence: ci` and `Command: load`. A local load prints `Evidence: local`, **including** when ambient `CI=true` is set and `GITHUB_ACTIONS` is unset. A clap flag cannot relabel evidence. | test |
| 32 | As a reviewer, I want pass and threshold-fail receipts to carry figures. | Pass and threshold-fail receipts both record per-scenario observed p95, unexpected-error count, `unexpected stream-hold drops` count, `client timeout` count, refusal-class counts, duration, concurrency, ceilings in force, fixture identity + contract count — a pass is not an empty “ok.” | test |
| 33 | As the desk owner, I want score/tier/fingerprint identity after the runs. | After a successful load and after a successful soak, the receipt records named fields `identity_oracle` (same-process Path-B `compute_analytics_from_vendor` triple taken **before** driven work on the golden book), `identity_http` (post-work warm HTTP **score / tier / fingerprint triple**, not the full route envelope), and `identity_path_b` (second post-work in-process Path-B triple). `identity_http` and `identity_path_b` are each **byte-identical** to `identity_oracle`. Skipping any of the three observations, or comparing Path-B only to itself, fails the command. The triple is not a p95 or unexpected-error lock. | test |
| 34 | As the desk owner, I want no trader surface from this feature. | No trader-facing route, nav item, Settings, Ask-AI, Ticker, Scanner, Positions, Landing, or `/_ops/metrics` affordance is added or changed. Dashboard source for this feature is empty. Dashboard copy tables gain no capacity/load/soak literals. | test |
| 35 | As the desk owner, I want trader 503/429 copy byte-unchanged. | Production trader 503 detail remains exactly `Live streaming is at capacity. Try again shortly.` and the 429 `Too many requests. Limit is {n} per minute per IP on data endpoints.` message is unchanged. | test |
| 36 | As the desk owner, I want concurrency generated as many single-ticker clients. | Every ticker-analysis request issued by the harness names exactly one ticker. On pass and threshold-fail, the receipt field `ticker_analysis_request_tickers` (a list, one symbol per issued ticker-analysis request; equivalent per-request ticker inventory name allowed) is present and contains only single-ticker entries. A universe-sweep shaped request is not how the harness generates concurrency. Omitting that inventory fails this check. | test |
| 37 | As a security-conscious reviewer, I want no secrets in output. | Canary secret values present in the environment (including `MASSIVE_API_KEY`) do not appear in command output or receipts. | test |
| 38 | As a reviewer, I want failure families distinguishable without reading source. | Threshold failure (`[FAIL]` + named lock/probe), configuration/vacuous zero-work (`[FAIL]` 0 requests selected), partial-surface (`[FAIL]` 0 {missing surface} executed — **not** `0 requests selected`), blocked vendor/paid-feed (`[BLOCKED]`), incomplete (`[INCOMPLETE]`), and infrastructure start error (`[ERROR]`) are distinguishable from the command result. Exit 0 occurs only in pass (a load command may exit 0 with soak `[NOT RUN]` only if load independently passed). Verdict line and exit agree. | test |
| 39 | As a reviewer, I want vacuous/blocked/incomplete/start-error not to emit a fake measurement. | Those runs write a short non-measurement record (standing + verdict + `No pass recorded`) with **no** observed-p95 table. | test |
| 40 | As a reviewer, I want harness p95 not collapsible into `/_ops/metrics` p95. | Each printed latency is labeled **harness p95**, unit **ms**, with one of the locked basis strings (`warm cache-hit bundle GET wall`, `cold coalesced bundle GET wall`, `per-ticker SSE time-to-first-byte`, `per-ticker SSE emit after inject`, `prices SSE time-to-first-byte`, `prices SSE emit after inject`); it is never labeled as `/api/_metrics` p95 or “Massive p95.” | test |
| 41 | As a reviewer, I want process ceilings not readable as production defaults. | The receipt prints process-local `MAX_LIVE_SESSIONS`, `MAX_LIVE_SUBSCRIBERS`, and `PUBLIC_RATE_LIMIT_PER_MIN` actually used (hold instance and dedicated probe), framed as **this process, not production defaults**. A successful load prints hold `MAX_LIVE_SUBSCRIBERS=9`. | test |
| 42 | As a reviewer, I want skipped soak honest on a load command. | A load command that does not run soak prints `[NOT RUN] soak — not part of this command. {ci\|local} load evidence is not soak evidence.` and does not treat skipped soak as a zero-refusal pass. | review |
| 43 | As a reviewer, I want standing cadence and “not SLOs / this process” framing intact. | Standing-block field order and the phrases `harness locks — not production SLOs` and `this process (not production defaults)` match §4 on pass and threshold-fail, including the Thresholds lines `client timeout = 0` and `unexpected stream-hold drops = 0`. | review |
| 44 | As a reviewer, I want running output not titled as a finished receipt. | While in flight, stdout/stderr progress says `[RUNNING] {load\|soak} — {elapsed} / {locked_span} — no verdict yet` and is not titled as the final receipt. | review |
| 45 | As a reviewer, I want injected SSE ticks actually observed. | Each SSE hold (per-ticker **and** prices) records count > 0 of non-comment injected events; a hold that only saw comments/heartbeats fails the scenario rather than skipping it. | test |
| 46 | As a reviewer, I want a tiny book refused. | Pointing the loader at a book with fewer than 1000 contracts (including `syn_mini`) refuses the run, exits non-zero, and writes no passing measurement receipt. | test |
| 47 | As a contract owner, I want no new HTTP operations. | OpenAPI and generated `@convexa/api` client bytes are unchanged by this feature. | test |
| 48 | As a maintainer, I want GATE Q to prove soak exists even though merge CI does not run it. | GATE Q invokes the soak command once as evidence; that invocation checks the same threshold families as load (per-scenario p95 including prices bases, unexpected-error 0, `unexpected stream-hold drops` 0, `client timeout` 0, two refusal checks, vendor I/O 0, identity). | review |
| 49 | As a reviewer, I want a partial surface not labeled as zero work. | A run that executed at least one ticker-analysis request or live-stream client but not all three ship-required surfaces (ticker-analysis HTTP, per-ticker SSE, prices SSE) exits non-zero and the verdict names the missing surface (`0 {missing surface} executed; no pass recorded.`). It does **not** print `0 requests selected`. | test |

`test` = automated (invariants, negative space, silently-regressing behavior).
`review` = verified by inspection (command names on the listing, standing cadence, NOT RUN / RUNNING wording, GATE Q soak invocation).

<!-- spire:council-resolution:v1 2a81d3401662ed3e75f4d6bff7dec4eda119e9171475b693a637b4328c189f98 folded -->
<!-- spire:council-resolution:v1 0cf0d9c205728909476ec6b5b61f8bd91e740810283061fea258db1c66930100 folded -->

**Method notes (risk-based, not one-test-per-AC).** Prefer **one** hermetic integration pass: start mocked process → Path-B oracle → load → assert exit 0 + receipt figures + zero vendor I/O + identity (`identity_oracle` / `identity_http` / `identity_path_b`) → force p95/error/drop/timeout over-threshold → assert non-zero → overflow as HTTP on the second loopback bind of `routes::router(probe state)` with reduced `LiveCapacity::new` ceilings → absent-mock / live-target / zero-work / partial-surface refusals → `CI=true` without `GITHUB_ACTIONS` prints `Evidence: local` → soak once at GATE Q (review that GATE Q invoked it; test the soak families when it runs). Isolation source scans and OpenAPI/dashboard empty-diff cover structural negative space. No DOM harness. Observability is command / receipt / vendor-I/O isolation / score identity.

## 4. UI + interaction

**`NO_UI_CHANGE`.** This feature consumes **no** dashboard route, component, token, motion, chip, or copy table. There is no trader screen and no `/_ops/metrics` change. Anyone proposing a Ticker “capacity” widget, a Settings toggle, an Ask-AI footnote, or a `/_ops` capacity dashboard is re-scoping.

The operator-facing surface is three coupled artifacts plus hard negative space:

| # | Surface | Who reads it |
|---|---------|--------------|
| S1 | CLI stdout (and stderr progress) while a named load or soak command runs | maintainer / CI log |
| S2 | Run receipt (durable artifact + stdout twin) | maintainer later; any later council quoting the run |
| S3 | Negative space — trader product + operator-metrics UI + research-lab chrome | every trader; anyone reading `/_ops/metrics` or a score-lab report |

This is **not** a research replay. Standing title is **CAPACITY HARNESS**, never `RESEARCH READ` / `RESEARCH REPLAY`. This is **not** `GET /api/_metrics`. A harness p95 is a different datum from process-telemetry p95.

**Flows:**

| Operator intent | Invocation | Behavior |
|---|---|---|
| CI / pre-push gate | `npm run capacity:load` | Drive ticker-analysis HTTP + per-ticker SSE + prices SSE on the hermetic process (8+1 streams at subscriber ceiling 9); evaluate D1 locks + refusal probe on the second loopback bind; write a **load** receipt; exit 0 or non-zero. Soak is `[NOT RUN]`. Local invocation prints `Evidence: local` even if `CI=true`. |
| Local / GATE Q soak | `npm run capacity:soak` | 600 s hold at soak concurrency on the 500/50 instance; nested dedicated-probe overflow on the second loopback bind; follow-up ticker-analysis; **soak** receipt. |
| Merge CI | backend job step | Invokes **load only**. `GITHUB_ACTIONS` (or the capacity-step-only env) → `Evidence: ci`. |

Information structure on every **finished** pass / threshold-fail (always this order):

1. Standing / framing block **first**.
2. Identity: Command, Evidence, Surfaces actually driven, process-local ceilings, vendor-I/O standing.
3. Counts by **closed outcome class**.
4. Observed harness figures next to **this run’s** locked thresholds, each with unit and basis.
5. One terminal verdict line that agrees with the process exit code.
6. Closing reminder.

Default mode: standing is first on **stdout** and in the **receipt file**. stderr is progress (`[RUNNING] … — no verdict yet`) unless stdout is JSON (`--json`: stdout = receipt JSON including `standing`; standing prose + progress on stderr).

**Component states** — dashboard default/loading/empty/error/offline/stale are **N/A** (`NO_UI_CHANGE`). Operator-visible **run** states (`[absent-is-not-none]`; progress is not a verdict):

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Trader UI (Ticker / Settings / Ask-AI / Scanner / Positions / `/_ops/metrics`) | unchanged | N/A | N/A | N/A | N/A — do not invent `⏸ offline` / Live chip on the receipt |
| Capacity command + receipt | pass: standing → identity → class counts → observed vs locks → `[PASS]` → closing; exit 0 | `[RUNNING] {load\|soak} — {elapsed} / {locked_span} — no verdict yet`; no final p95 | zero-work vacuous: `[FAIL] … 0 requests selected; no pass recorded.`; partial-surface: `[FAIL] … 0 {missing surface} executed; no pass recorded.` (not “0 requests selected”); exit non-zero; **no** measurement p95 table | `[FAIL]` named lock/probe · `[BLOCKED]` vendor/paid-feed (title **without** `MOCKED VENDORS`) · `[INCOMPLETE]` early end · `[ERROR]` start; all non-zero; standing still first | N/A as trader SSE; skipped soak is `[NOT RUN] soak`, not a zero-refusal pass |

**Copy** — closed vocabulary and exact lines.

Approved terms: **capacity harness**, **load**, **soak**, **this harness process**, **mocked-vendor process**, **in-process mock**, **0 outbound vendor calls**, **harness p95** + **ms** + **basis**, **unexpected error**, **subscriber-ceiling refusal**, **session-ceiling refusal**, **rate-limit refusal**, **unexpected stream-hold drops**, **client timeout**, **harness thresholds** / **locks**, **local** / **ci**, **capacity receipt**, **Authorizes: nothing**.

Banned: “production test,” “live load test,” “Massive soak,” “SLO,” “SLA,” “benchmark of production,” “production,” “Railway,” “the live site,” “our capacity,” “Massive latency,” “paid feed,” “live Options,” “vendor p95,” bare “p95” as if it were `/api/_metrics` `p95_ms`, blending 503/429 into “errors,” “rate limited” for a 503, “outage,” reprinting trader 503 copy as the harness verdict, “production ceiling,” “certified limit,” a local pass labeled as CI, a CI load labeled as soak, “hosted production evidence,” “results dashboard,” “metrics snapshot,” “research read,” “production report,” “production ready,” “raise MAX_LIVE_SUBSCRIBERS,” “ship this p95,” “verified,” “can handle N subscribers,” `RESEARCH READ`, `RESEARCH REPLAY`, `● Live`, “WCAG,” “pixel perfect,” `MOCKED VENDORS` on a `[BLOCKED]` vendor-leak title, “0 requests selected” when a surface actually executed.

Standing block (first on stdout in default mode and in the receipt, **including FAIL / BLOCKED / INCOMPLETE / ERROR**). The `MOCKED VENDORS` title fragment and the Vendor I/O line `in-process mock · 0 outbound vendor calls` are printed **only when vouched**. A `[BLOCKED]` vendor-leak / unverifiable-I/O / paid-feed run uses the blocked title below — never PASS with the claim omitted, and never a mocked-vendors title on a leak. `Surfaces:` is the list **actually driven this run** (join with ` · `); omit a surface that did not execute.

Vouched (pass / threshold-fail / FAIL-with-mock-still-held):

```
CAPACITY HARNESS — MOCKED VENDORS · NOT A PRODUCTION MEASUREMENT
  Command:     {load|soak}
  Evidence:    {local|ci}
  Surfaces:    {surfaces actually driven this run}
  Vendor I/O:  in-process mock · 0 outbound vendor calls
  This process (not production defaults):
               MAX_LIVE_SESSIONS={hold} · MAX_LIVE_SUBSCRIBERS={hold} · PUBLIC_RATE_LIMIT_PER_MIN=0
               probe MAX_LIVE_SESSIONS={probe} · MAX_LIVE_SUBSCRIBERS={probe} (dedicated LiveCapacity::new)
  Thresholds:  harness p95 cold coalesced bundle GET wall ≤ 4000 ms
               harness p95 warm cache-hit bundle GET wall ≤ 150 ms
               harness p95 per-ticker SSE time-to-first-byte ≤ 200 ms
               harness p95 per-ticker SSE emit after inject ≤ 500 ms
               harness p95 prices SSE time-to-first-byte ≤ 200 ms
               harness p95 prices SSE emit after inject ≤ 500 ms
               unexpected errors = 0
               unexpected stream-hold drops = 0
               client timeout = 0
               hold phase: subscriber-ceiling refusals = 0 · session-ceiling refusals = 0
               overflow probe: every overflow attempt 503 + Retry-After 30
               (harness locks — not production SLOs)
  Authorizes:  nothing. No trader-visible change, no score/tier/gate/fingerprint change,
               no production runtime default change.
```

Blocked (vendor leak / unverifiable / paid-feed) — **no** `MOCKED VENDORS`, **no** vouched mock line:

```
CAPACITY HARNESS — NOT A PRODUCTION MEASUREMENT
  Command:     {load|soak}
  Evidence:    {local|ci}
  Surfaces:    {surfaces actually driven this run, or (none)}
  Vendor I/O:  unverifiable / left the process / paid Options feed would be used
  Authorizes:  nothing.
```

Do **not** print expected probe 503s as a rate the run stayed under. Do **not** print `capacity-refusal rate ≤ {refusal_lock}`.

Closing line (stdout bottom and receipt):

`CAPACITY HARNESS — NOT A PRODUCTION MEASUREMENT · Authorizes: nothing`

Exact verdict lines:

| Verdict | Exit | Exact operator-facing line |
|---|---|---|
| Running | pending | `[RUNNING] {load\|soak} — {elapsed} / {locked_span} — no verdict yet` |
| Pass | 0 | `[PASS] {load\|soak} — harness p95 within locks · unexpected errors 0 · unexpected stream-hold drops 0 · client timeout 0 · overflow probe 503 + Retry-After 30 · vendor I/O stayed in-process · not a production measurement` |
| Threshold / probe fail | non-zero | `[FAIL] {load\|soak} — crossed {named lock or probe check}: observed {obs} lock {lock}{unit}. Not a production measurement.` |
| Vacuous zero-work | non-zero | `[FAIL] {load\|soak} — 0 requests selected; no pass recorded.` |
| Partial surface | non-zero | `[FAIL] {load\|soak} — 0 {missing surface} executed; no pass recorded.` |
| Vendor blocked | non-zero | `[BLOCKED] {load\|soak} — vendor I/O left the process or is unverifiable. No pass recorded.` |
| Paid-feed blocked | non-zero | `[BLOCKED] {load\|soak} — paid Options feed would be used. Harness must not burn the paid Options feed. No pass recorded.` |
| Incomplete | non-zero | `[INCOMPLETE] {load\|soak} — run ended at {elapsed} before locked {locked_span}. No pass recorded.` |
| Soak not in this command | 0 only if **load** independently passed | `[NOT RUN] soak — not part of this command. {ci\|local} load evidence is not soak evidence.` |
| Harness error | non-zero | `[ERROR] {load\|soak} — {closed reason}. No pass recorded.` |
| Identity skip / Path-B-only / mismatch | non-zero | `[FAIL] {load\|soak} — identity check {oracle-missing\|http-skip\|path-b-only\|mismatch}. Not a production measurement.` |

`{locked_span}` for load is `20s warm HTTP + 5s SSE hold + refusal probe`; for soak is `600s`. Color may supplement severity; **plain text must carry the whole meaning** (CI logs strip ANSI). Human summary, machine receipt, and **exit code must agree**.

Closed outcome class names (exact literals on finished **measurement** receipts). The stream-hold class, the standing lock, and the `[FAIL]` / `[PASS]` token are the **same** literal:

| Literal | Means | Must not be filed under |
|---|---|---|
| `ok` | 2xx, or an admitted SSE the harness treats as success | — |
| `subscriber-ceiling refusal` | 503 from LiveCapacity subscriber ceiling | `unexpected error`, `rate-limit refusal`, `session-ceiling refusal` |
| `session-ceiling refusal` | 503 from LiveCapacity session ceiling | `unexpected error`, `rate-limit refusal`, `subscriber-ceiling refusal` |
| `rate-limit refusal` | 429 from `PUBLIC_RATE_LIMIT_PER_MIN` | either capacity class, `unexpected error` |
| `unexpected error` | Other 5xx / transport failures that are not the refusal classes | either refusal class; `ok`; `unexpected stream-hold drops`; `client timeout` |
| `unexpected stream-hold drops` | Unexpected live-stream drop/error during the hold | `unexpected error` as the only name on `[FAIL]` |
| `client timeout` | Harness aborted waiting | `unexpected error`, capacity refusal |

Banned competing empties on this CLI: `n/a`, blank, trader `—`, `unavailable this cycle`, `unknown` (`/_ops/metrics` headroom copy), research `no stored snapshot`.

**What must never appear on Ticker / Settings / Ask-AI / `/_ops/metrics`:** no harness widget, control, chip, Settings panel, Ask-AI disclosure, Scanner column, Positions cell, Landing CTA, new `/_ops/metrics` series for harness p95, no change to trader 503/429 strings, no change to production LiveCapacity / rate-limit defaults as a side-effect of shipping or running the harness.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The Curvature Terminal). Backend / CLI-only: **`NO_UI_CHANGE`** in this SPEC body. No amendment to the design canon is requested.

**Design direction:** Honesty rules from the canon bind the **words** on the command/receipt (simulated and mocked reads carry framing **in-body**, not as a footnote; a number with no vouched source does not ship; a label must not rename what the value is; `[model-read-carries-its-assumptions]` on every harness p95 basis; `[absent-is-not-none]` on skipped soak / 0 requests / limiter-off 429s / partial surfaces / `Evidence: ci`). No dashboard components, tokens, or motion apply. Do not restate the token table.

<!-- spire:council-resolution:v1 b4adaac883604fc82c275002a4d1ecd598f10430dada79b8662b43506e843d7e folded -->
<!-- spire:council-resolution:v1 c404b05a30dceaa15331cf39ff66806c4ea1f52dd9050c6ebf2c2606449982bb folded -->
<!-- spire:council-resolution:v1 23e408e6547153d223bb0be1fc1c55a7993eacfc843c7a009463a6d08f90e7ee folded -->
<!-- spire:council-resolution:v1 ecb3ec94042c232d5f5285ab85f2a441e9e46f18dca0f7885ee5541dde375b60 folded -->
<!-- spire:council-resolution:v1 f983ceea07dcf63ad8c50a1b932cc661b5a5f32aa4aa97b1609d8f03ef8b0ab3 folded -->

## 5. Error handling

Harness failures stay on the operator command. They do not change trader HTTP error policy and do not become a new desk error on bundle or SSE for ordinary users.

| Failure class | Operator sees | Receipt | Vendor I/O | Exit |
| --- | --- | --- | --- | --- |
| All D1 p95 / unexpected-error / `unexpected stream-hold drops` / `client timeout` locks held; both refusal checks held; identity held | Standing → figures → `[PASS]` → closing | Full measurement | 0, vouched | 0 |
| Crossed named lock or probe check | Standing remains; `[FAIL]` names **which** lock or probe check, observed vs lock, unit/basis | Full measurement | 0 | non-zero |
| 0 requests **and** 0 streams | `[FAIL] … 0 requests selected`; no pass recorded | Short non-measurement; **no** p95 table | 0 | non-zero |
| Only one surface executed (or any ship-required surface at 0 while another ran) | `[FAIL] … 0 {missing surface} executed; no pass recorded.` — **not** `0 requests selected` | Short non-measurement; **no** p95 table | 0 | non-zero |
| Overflow probe all-admit (zero expected 503s) | `[FAIL]` names the overflow-probe check; vacuous, not a green low rate | Full measurement of the vacuous probe (counts show 0 overflow refusals) **or** short record if no work ran; never PASS | 0 | non-zero |
| Identity skip, Path-B-only comparison, or triple mismatch | `[FAIL]` names the identity check; not a p95 lock; matching triple cannot turn a capacity FAIL into PASS | Full measurement if work ran | 0 | non-zero |
| Mock / fixture absent, golden missing, `<1000` contracts, `syn_mini` | `[BLOCKED]` / `[ERROR]` closed reason; no pass recorded; standing **without** `MOCKED VENDORS` if mock is not vouched | Short non-measurement | 0; no live fill-in | non-zero |
| Outbound vendor I/O detected or unverifiable | `[BLOCKED] … vendor I/O left the process or is unverifiable. No pass recorded.` Standing title **without** `MOCKED VENDORS` | Short non-measurement | must not continue | non-zero |
| Would use paid Options feed / live Massive | `[BLOCKED] … paid Options feed would be used. …` Secrets not printed; standing **without** `MOCKED VENDORS` | Short non-measurement | none issued | non-zero |
| 429 while this process limiter is 0 | `[BLOCKED]` / `[ERROR]` harness error; not a capacity result | Short non-measurement | 0 | non-zero |
| Live vendor or production host configured | Refused **before work starts** | No success receipt | none issued | non-zero |
| Bind / start failure | `[ERROR] {command} — {closed reason}. No pass recorded.` | Short non-measurement | none | non-zero |
| Interrupted / crashed / elapsed < locked span | `[INCOMPLETE] … No pass recorded.` | Short non-measurement; no success receipt left behind | 0 | non-zero |
| Soak not part of invoked load | `[NOT RUN] soak — not part of this command. {ci\|local} load evidence is not soak evidence.` | Load receipt (if load finished) must not claim soak | n/a | 0 only if load passed |
| `client timeout` (harness gave up waiting) | Counted as `client timeout`; command fails; `[FAIL]` names `client timeout` — not a PASS with timeouts parked off the error lock | Full measurement if the run otherwise completed enough to sample; else short record | 0 | non-zero |

No retries against Massive. No trader-facing 5xx invented by the harness. Progress lines must never present a partial file as the final receipt. Identity skip = fail (not a silent omit on PASS). Ambient `CI=true` never prints `Evidence: ci`.

<!-- spire:council-resolution:v1 32fe2b7f530099f63547624e34dd4c674ffe83e0234087d7bd1493020adc7b18 folded -->

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/capacity-baseline/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This feature adds **no new HTTP endpoints**, query parameters, or payload fields. Production ticker-bundle and SSE routes stay unchanged and are **HTTP clients of the harness** on throwaway loopback binds (hold listener + second probe listener) — not a new FE↔BE surface. The interface file is marked **`NO_BACKEND_CHANGE`** with a machine-checkable empty `endpoints` array. Authoritative field lists for existing public ticker/SSE envelopes remain in the standing public-surface contracts; this spec does not restate them.

## 7. Testing strategy

**Automate (`test`):** command exit vs D1 locks and refusal two-checks; both HTTP and SSE surfaces actually executed (including prices SSE non-zero and prices TTFB/emit bases); load 8 per-ticker + 1 prices held concurrently at subscriber ceiling 9; per-scenario p95 with named basis; unexpected-error 0 / `unexpected stream-hold drops` 0 / `client timeout` 0; post-soak follow-up ticker-analysis; zero outbound vendor I/O and no live fallback; vacuous / partial-surface / blocked / incomplete / start-error honesty (short non-measurement, no p95 table; partial-surface ≠ `0 requests selected`); subscriber vs session vs rate-limit class names; 429-while-limiter-0 blocked; production defaults unchanged; limiter 0 this process does not fail in-threshold runs; receipt standing tokens and anti-SLO/anti-score scan; `[BLOCKED]` standing title without `MOCKED VENDORS`; load≠soak labeling and CI path (load present, soak absent from default backend job); `Evidence: ci` only with `GITHUB_ACTIONS` (or capacity-step-only env); `CI=true` laptop load prints `local`; non-empty figures on pass/threshold-fail including `client timeout` count; score/tier/fingerprint identity (`identity_oracle` before work, `identity_http` triple + `identity_path_b` after; skip or Path-B-only = fail; HTTP equality is the triple not the envelope); `ticker_analysis_request_tickers` inventory; secret-egress; OpenAPI/generated client identity; dashboard empty-diff / copy-table scan; trader 503/429 byte-identity; fixture floor (`syn_mini` refuse); injected SSE tick count > 0 on per-ticker **and** prices; HubCmd queue does not grow with worker off (harness-only hub; HTTP admits still issued); overflow HTTP 503 on second loopback bind of `routes::router(probe state)`, not the 32-holder and not a 10th on the 9-holder; `request_count` poison; prod+fixture refuse; source scan anti-vacuity (equality call sites exist; score-as-threshold forbidden).

**Review:** command discoverability on npm/Nx listings (AC-1/2); exact standing-block cadence (“harness locks — not production SLOs”, “this process (not production defaults)”, `client timeout = 0`, `unexpected stream-hold drops = 0`); `[NOT RUN] soak` wording; `[RUNNING] … no verdict yet`; GATE Q soak invocation (AC-48).

**Invariants that must never silently regress:** mocked vendor I/O never leaves the process; vacuous green is impossible; load evidence is not soak evidence; ambient `CI` is not `Evidence: ci`; D1 p95 are per-scenario not blended; prices SSE has named 200/500 bases and holds concurrently with per-ticker SSE (load at ceiling 9); refusal is two checks not a rate; overflow is dedicated nested `LiveCapacity::new` on a second loopback bind; score/tier/fingerprint identity after successful load and soak (oracle before, HTTP triple + Path-B after); production 500/50/30/120 untouched; production `subscribe` / `admit_and_subscribe` unchanged; harness-only hub does not enqueue `HubCmd`; streams are HTTP not an in-process skip; `NO_UI_CHANGE`; no new HTTP operations; standing present on FAIL/BLOCKED; `MOCKED VENDORS` absent on vendor-leak `[BLOCKED]`; `[PASS]` and standing name `client timeout = 0`.

No DOM harness. Prefer one hermetic integration pass plus structural poison scans over a named micro-harness per AC. GATE Q runs **soak once** (review); subsequent CI evidence is load.

## 8. Guardrails this feature must not break

- **`[additive-keeps-score-byte-identical]`** — fixture arm is `None` in production; harness verdict does not read score/tier/fingerprint as p95/error locks; identity proof is isolation (oracle before work; warm HTTP **triple** **and** second Path-B vs that oracle — not full-envelope HTTP equality), not a lab adoption. Empty `quant-engine` diff is necessary and not sufficient. Source scan allows equality-to-oracle and forbids score-as-threshold.
- **`[score-change-is-deliberate-and-measured]`** — a capacity receipt **Authorizes: nothing** on live score / gate / fingerprint / weights.
- **`[operator-vs-trader-path-separation]`** — CLI / Nx / CI only. No operator HTTP route, no trader-route call from an ops page, no `/_ops` capacity series. The driver *is* an HTTP client of trader routes **in a throwaway process**, which is the opposite of mounting capacity on `/_metrics`.
- **`[best-effort-isolated-or-null]`** — optional Path-B fields unchanged; harness failure stays on the operator command.
- **`[production-fails-closed]`** — production startup path not edited; missing mock does not fall through to the paid feed; fixture-backed production is refused.
- **`[no-secrets-in-image]`** — no paid key in image, fixtures, or receipts; runtime dummy only; canary values do not egress.
- **`[cited-code-is-verified-not-assumed]`** — live Path B still uses `state.massive` directly; Live port is not identity-preserving; gex_SPY is 14 218 contracts; LiveCapacity 503+Retry-After 30; rate-limit 0 already exists; `LiveCapacity` has no ceiling setter; `try_admit` uses `>= max`; production `subscribe` enqueues `HubCmd` on the live server; the harness injects a hub that does not.
- **`[structural-over-prose-enforcement]`** — scans, floor, `request_count`, standing-required, CI grep, prod+fixture refuse, identity skip=fail, equality call-site anti-vacuity, Evidence classifier, HubCmd queue poison, second-bind overflow poison. Poison the forbidden thing and the build/command goes red.
- **`[single-ticker-on-demand]`** (narrowed form) — each request computes one ticker; multi-ticker work stays off this driver (scanner unspawned). Concurrent same-symbol clients are coalesced misses/hits, not a market sweep. Receipt inventory makes this observable.
- **`[live-vs-static-isolation]`** — SSE vs bundle remain separate paths; the harness measures both and does not feed last-trade into GEX (inject quotes/trades onto the existing bus only).
- **`[absent-is-not-none]`** — `load` ≠ `soak` ≠ `local` ≠ `ci`; missing golden ≠ pass; configured-not-executed scenarios stay not-run; 0 requests ≠ green; one surface executed ≠ `0 requests selected`; limiter-off 429s are not `n/a`; ambient `CI` is not merge-job evidence; `MOCKED VENDORS` is not claimed on a leak; load at ceiling 9 is not called “under.”
- Domain math — vendor gamma for profile/walls, analytic BS flip, `r=4.5%`, `MIN_GREEK_T`, ±20% / 100-pt flip grid, GEX/DEX formulae, NBBO mid as structure anchor, last-trade readout-only: untouched. Enforcement = empty quant-engine diff.

## 9. Open questions

None. Owner D1 locked the four p95 fail-lines as v1 harness gates (not SLOs); prices SSE shares the 200/500 ms TTFB/emit locks under named prices bases; owner D2 locked load max subscribers **9** so 8 per-ticker SSE + 1 prices SSE hold concurrently (**at** ceiling: 9 admits succeed; the overflow probe is not a 10th on that instance); load HTTP concurrency stays 16 warm; soak stays 8 HTTP + 32 SSE under production 500/50; overflow remains dedicated nested `LiveCapacity::new` on a separate probe AppState, bound as a **second loopback** of `routes::router(probe state)` so HTTP 503 is observed (not 501 connections, not mutating the 32-holder, not oneshot); owner D3 locked production HTTP stream routes on loopback plus a harness-only hub whose `subscribe` updates the symbol set and does not enqueue `HubCmd` (production `subscribe` / `admit_and_subscribe` unchanged; poison: worker off + many admits ⇒ vendor-subscribe queue does not grow; not an HTTP-skipping shortcut); standing Thresholds and `[PASS]` include **`client timeout = 0`**; post-work HTTP identity is the **score/tier/fingerprint triple**, not the full route envelope; FAIL / standing / class table share the one literal **`unexpected stream-hold drops`**; commands are `load` | `soak` with evidence `local` | `ci` (`ci` only via `GITHUB_ACTIONS` or a workflow-only env the capacity CI step sets; ambient `CI=true` prints `local`; no clap relabel); merge CI = load only; soak = 10 min local + GATE Q; CI load 16 warm HTTP + 8 per-ticker SSE + 1 prices SSE with 20 s HTTP + 5 s SSE hold + refusal probe totaling < 60 s; refusal is two checks not a rate; identity after successful load and soak is required (oracle before work; post-work warm HTTP triple **and** second Path-B vs that oracle; skip or Path-B-only comparison = fail); source scan allows equality-to-oracle and asserts those call sites; vacuous/blocked/incomplete/start-error write a short non-measurement record; partial-surface fail is not “0 requests selected”; low-cap 429 probe is withdrawn; `NO_UI_CHANGE`; no new HTTP operations. First hosted wall-clock observation remains `[lane-check]` until a real CI run exists; retune of D1 is a numbered amendment, not an open number in this spec.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"6d444002fcda5337f634dbb4436a59067239307e3eb6c47bb1bffbfbf30d4445","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"45dd7edff075f3f96d6c4c7ae9fee286ce0b7d648591df4f41c78a5ee2101464","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"b4adaac883604fc82c275002a4d1ecd598f10430dada79b8662b43506e843d7e","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":3,"conflict_id":"2254ef1650e279cbdc3fd66fc5420eca3f38a8c95cb0ae1090ffaca45533b5f7","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"c2a867d4e2f0624f93cf48c09c926fd7f64dbd1f9ade7af92416be639f7b6f10","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"ea8b01f5b4f37738f6c50181c484c85b0bbf6d27a8ab218a9221092ac60a3190","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"16b124f28cce629912993b21ae0f63b509e9e8ef8fc9f41188113676fdaa5884","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"c75ddfcdec20e408be25c6b4d9a0873306ab48f7297bdf48bc97034c64fed785","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":4,"conflict_id":"c40411fb0d6dff11a5cd9ab5172d94ced29ecc945adb7f7527439380b939fb84","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":5,"conflict_id":"2a81d3401662ed3e75f4d6bff7dec4eda119e9171475b693a637b4328c189f98","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":6,"conflict_id":"58d5355addd3c915e11f6c147a9abfaa7144737e21c74a8e7233493e220f1d82","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"c404b05a30dceaa15331cf39ff66806c4ea1f52dd9050c6ebf2c2606449982bb","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"91aac0ccf4041f9a19b3308fd939f2fed9b9b2197c3d17cd919af3ac5968f95b","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"23e408e6547153d223bb0be1fc1c55a7993eacfc843c7a009463a6d08f90e7ee","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":3,"conflict_id":"32fe2b7f530099f63547624e34dd4c674ffe83e0234087d7bd1493020adc7b18","disposition":"folded","section":"§5"},{"source":"R2-ux.md","index":4,"conflict_id":"0cf0d9c205728909476ec6b5b61f8bd91e740810283061fea258db1c66930100","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":5,"conflict_id":"ecb3ec94042c232d5f5285ab85f2a441e9e46f18dca0f7885ee5541dde375b60","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"f983ceea07dcf63ad8c50a1b932cc661b5a5f32aa4aa97b1609d8f03ef8b0ab3","disposition":"folded","section":"§4"}]}
-->
