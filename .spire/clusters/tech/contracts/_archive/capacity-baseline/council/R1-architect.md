# R1 — architect position: capacity-baseline

## Position

### What this is (technical shape)

A **named, off-request-path load/soak driver** on `api-rust` that boots a **hermetic** process-local server (production router, non-production constructor), drives concurrent ticker-bundle HTTP and SSE against **mocked vendor I/O**, checks locked latency / unexpected-error / live-capacity-refusal thresholds, writes a receipt whose standing cannot be read as a production measurement, and exits non-zero when a threshold is crossed.

It is a **test driver**, not a runtime service, not a research score lab, and not a second Path-B. The trading/serve request path still computes exactly the one ticker asked for. The harness is the client that asks, repeatedly.

Verified starting seams (read at source, not assumed):

- Live Path B HTTP still calls `state.massive.fetch_options_market_state` / `fetch_daily_bars` / `fetch_intraday_bars` / `fetch_recent_trades` inside `compute_analytics` (`apps/api/src/services/analytics.rs`). `MarketDataPort` is **not** on that path.
- `MarketDataPort::Live` (`services/market_data/live.rs`) is **not** a behavior-identical stand-in for that join: it always fetches trades with a hardcoded 3600s lookback, while live compute respects `include_dark_pool` and `darkpool_lookback_secs`. Switching production HTTP onto today's Live port would change optional off-exchange I/O. I do not do that in this slice.
- `MassiveRestClient` (`infrastructure/massive/rest.rs`) is a concrete reqwest client; `request_count()` is already the outbound-attempt counter (also used by production-runtime-guardrail tests).
- `StockStreamHub::dormant` builds the broadcast bus without a network task; `server::serve` is what calls `stock_worker.start()`, then warmer / ensure / scanner. `admit_and_subscribe` still `hub.subscribe`s (symbol set + `HubCmd`) before SSE.
- Live ceilings: `LiveCapacity` (`MAX_LIVE_SESSIONS` default 50, `MAX_LIVE_SUBSCRIBERS` default 500, `0` = off); over either → **503 + `Retry-After: 30`**, not 429 (`live_capacity.rs`, `routes/stream.rs` `capacity_unavailable`). Unit tests already pin the env defaults and the 503-not-429 source shape.
- `PUBLIC_RATE_LIMIT_PER_MIN` default 120, **`0` disables** — already documented in `config.rs` as the load-test dial. Production default stays 120.
- Hermetic constructors already exist (`AppState::for_tests`, `for_runtime_guardrail_tests`) but they still construct `MassiveRestClient` against `rest_base: "https://api.massive.com"` with a dummy key, set `LiveCapacity::new(0, 0)` (ceilings **off**), and do not seed a vendor fixture. They are the wrong constructor for this feature as-is.
- `compute_analytics_from_vendor` is the no-network Path-B once a `VendorBundle` exists. `GexFlight` coalesces concurrent misses for one ticker.
- Golden `libs/quant-engine/tests/fixtures/gex_SPY.json` records `meta.contract_count: 14218`. Repo `apps/api/data/chain_snapshots/SPY.json` and `tests/fixtures/market/syn_mini.json` are **tiny** books and must not silently become the capacity corpus.
- No repository load/soak command, checked thresholds, or mocked-vendor soak receipt exists. Research CLIs (`batch-backtest`, `score-lab`, …) measure score quality and already say **Authorizes: nothing**; this harness must not become a sibling scoring path.
- Nx `api` targets today: `serve`, `build`, `test`, `api-contract-check`. CI backend job: `cargo test -p api-rust -p quant-engine --locked` plus postgres-gated suites. No capacity step.

### Component boundaries

| Piece | Lives | Does not |
| --- | --- | --- |
| Capacity harness leaf | new `apps/api/src/services/capacity_harness/` (one-way; not imported by `quant-engine`, `signals`, routes, or production `server::serve`) | Not a background worker, not an HTTP resource |
| Command | new `api-rust` clap subcommand + `cmd_*` body, sibling of research commands, **distinct entry** | Does not fold into `serve`, `batch-backtest`, or `score-lab` |
| Nx / CI | new uncached `api` target + named backend CI step invoking the **ci** profile only | Soak is not a default CI step |
| Isolation tests | `apps/api/tests/capacity_baseline_isolation.rs` (+ clap/exit tests in the existing `*_cli.rs` style) | Not a substitute for the named command |
| Production router | reused `routes::router` / `contract_router` graph (52 operations, unchanged) | No new operation, no `/_ops` or `/_research` capacity route |
| Production `serve` | untouched bootstrap order (preflight → bind → `stock_worker.start()` → warmer/ensure/scanner) | Harness never calls `server::serve` |
| Quant engine | empty feature diff | No math, score, gate, or fingerprint change |

**Decisive comparison (harness shape).** Three options: (1) in-repo Rust driver on an ephemeral loopback listener using the production router; (2) external k6/vegeta/wrk against `npx nx serve api`; (3) tower `oneshot` only, as contract tests do.

| Axis | (1) in-repo loopback driver | (2) external k6/wrk | (3) oneshot-only |
| --- | --- | --- | --- |
| Complexity | one clap command + leaf | new toolchain + mock HTTP/WS server | already familiar, but no real SSE sockets |
| Cost | no new dependency | install, scripts, CI image, vendor-mock surface | cheapest |
| Scalability | enough for BRIEF (tens of clients CI, tens-to-low-hundreds local) | higher fan-out, unused here | cannot soak connections |
| Familiarity | clap + axum + isolation tests already in-tree | none in this repo | high |

**(1) wins** on familiarity + mock-boundary control. External load tools cannot see `request_count`, cannot inject hub ticks without a second protocol mock, and would tempt a live `serve` (paid feed). oneshot cannot prove SSE subscriber slots, TCP hold, or disconnect-release. We do **not** add k6, vegeta, locust, wrk, cloud load, Kubernetes, or a second mock HTTP server that speaks Massive's paginated REST.

### Mock / stub boundary (load-bearing)

**Vendor I/O must never leave the process.** Mechanism, stacked (any layer failing the run is a non-zero exit — fail closed for the *harness*, not a change to production fail-closed):

1. **Harness constructor only** (`AppState::for_capacity_harness`, name illustrative). It does **not** call `Config::from_env` (that *requires* `MASSIVE_API_KEY` and would pick up a developer `.env` paid key). It uses a dedicated stub config: dummy key, `rest_base` aimed at a **non-accepting loopback** (so a leaked fetch fails fast), `warm_enabled=false`, `scan_enabled=false`, `chain_snapshot` **Disabled**, session archive Disabled, `public_rate_limit_per_min=0`, `APP_ENV` not `prod`, in-memory price cache (`PriceCache::connect(None)`).
2. **Additive `vendor_fixture` on `AppState`**, `None` in production `construct`. When `Some`, `compute_analytics` and `fetch_quick_live_price` resolve from the `FixtureCatalog` / golden book and **do not** call `MassiveRestClient` fetch methods. When `None`, today's four-fetch join is byte-identical. Production `construct` never reads a fixture path and **refuses to start if the fixture is Some while `APP_ENV=prod`** (cannot accidentally ship a fixture-backed production process).
3. **Why not rewire HTTP onto `MarketDataPort::Live`:** it is not identity-preserving for dark-pool I/O (see verified seams). Complexity/identity dominated that choice. `MarketDataPort::fixture` remains the catalog type we *reuse* for the Some arm; we do not replace the None arm.
4. **SSE hub is local-loopback.** Harness uses dormant hub with **network worker not started**. `HubCmd` must not pile up on an unconsumed channel when `admit_and_subscribe` → `subscribe` runs: local mode updates the symbol set (needed for the session ceiling) and **does not enqueue a vendor subscribe**. Injected `StreamEvent`s publish on the existing `event_tx` broadcast (same bus SSE already reads). No `tokio-tungstenite` connect.
5. **Outbound proof is a pass predicate, not prose:** `massive.request_count() == 0` at end of run; isolation source scan forbids harness/`cmd_*` from calling `stock_worker.start()`, `Config::from_env`, `MassiveRestClient` fetch methods, `MarketDataPort::live`, or `connect_async`. A poison test that performs one fake increment/fetch must make the command fail — `[structural-over-prose-enforcement]`.
6. **Workers the harness does not spawn:** stock WS supervisor, GEX warmer, scanner sweep, liquid-name ensure. Cache-hit `maybe_wake` is Notify-only; with no ensure task it is a no-op. Capture is Disabled so `spawn_capture` cannot persist a book.

dotenv in `main.rs` may still load a real `MASSIVE_API_KEY` into the process environment for every subcommand. That is existing behavior. The harness **must not read it**. Dummy key + unroutable base + `request_count==0` is the containment.

### Surfaces under test (closed)

The driver exercises **existing trader-path** surfaces only, one ticker per request:

1. **Ticker bundle HTTP** — the production `load_analytics` path (cache hit and coalesced miss). Concurrent clients all request the **same** fixture symbol so `GexFlight` coalescing is the real production behavior, not an in-request universe sweep.
2. **Per-ticker SSE** — admit + hold + tick fan-out (`/api/stream/{ticker}` as already registered).
3. **Prices SSE** — admit + hold on a **closed 1–2 symbol list** already on the hub (`/api/stream/prices`). Not a 120-symbol harvest (`MAX_SYMBOLS` stays a production cap we do not approach).

**Deliberate capacity-refusal probe** (same process, dedicated state or a second admit wave): set probe ceilings **below** client count, open `max_subscribers+1` (and independently `max_sessions+1` new symbols), expect 503 + Retry-After 30. Those 503s are **expected refusals**, not error-budget failures.

**Out of the harness (non-goals as surfaces):** recommendation/LLM, broker, auth writes, scan board, candidates, contract lookup, `_research`, `_metrics`, health (except optional liveness before load), demo HTML. Scanning them would either spend, fork a second compute path, or violate operator/trader separation by turning diagnostics into a load target.

No new HTTP operations. OpenAPI/generated client bytes stay identical. Dashboard/runtime FE stays out (`NO_UI_CHANGE`).

### Vendor corpus (so p95 is not a lie)

`syn_mini` / conformance seed SPY (one contract) would make a "capacity" p95 a fabricated claim — `[absent-is-not-none]` applied to measurement.

**Mechanism:** the compute book is the checked-in golden `gex_SPY.json` (14 218 contracts), adapted **inside the harness leaf** into one `VendorBundle` (spot + contracts; daily/minutes/trades empty → HV/VWAP/off-exchange omit under existing `[best-effort-isolated-or-null]`). The command **refuses to run** if `contracts.len() < 1000` (or the golden's own `meta.contract_count` if present and below floor). No fallback to mini. Missing file is a hard error, not a skip-as-pass.

That book is **CPU-representative of Path B**, not of Massive RTT. The receipt standing must say so. We are not claiming production end-to-end vendor latency; we are claiming a mocked-vendor regression gate on *our* HTTP/SSE/compute/admit path.

Warm path: one coalesced miss fills `gex_cache` + price cache; subsequent HTTP is cache-hit (production `load_analytics` / `resolve_price_fast` cache branches). Cold wave is measured once at the start (or after a deliberate cache flush) so a coalescing/cache regression still shows up.

### Data-flow

```
clap profile (ci | soak)
  → for_capacity_harness(stub config, fixture catalog, probe ceilings)
  → routes::router(state)  [production graph]
  → bind 127.0.0.1:0   [never 0.0.0.0; never APP_ENV=prod]
  → do not start WS worker / warmer / scanner / ensure
  → inject loopback StreamEvents on the hub bus
  → closed scenario set (below) with concurrent HTTP + SSE clients
  → sample wall-clock latencies + status classes
  → evaluate locked thresholds
  → write receipt (standing + profile + vendor-I/O proof + pass/fail)
  → shutdown; subscriber_count must return to 0
  → exit 0 or non-zero
```

Bind family is **IPv4 loopback** (`127.0.0.1`), not `localhost` (this host's IPv6 `[::1]` trap). Ephemeral port, process-local, no Docker/Railway.

### Closed scenario set

| Scenario | What it measures | Isolation |
| --- | --- | --- |
| Cold coalesced bundle | N concurrent first-miss HTTP on one symbol; one compute, N-1 waiters | Fixture vendor; flight map |
| Warm bundle | M concurrent cache-hit HTTP | Cache already filled; still one ticker |
| SSE hold | K subscribers on the fixture symbol, ticks injected at 1 Hz | Local hub; worker off |
| Capacity refusal | K+1st subscriber (and a new-symbol session overflow) | Probe ceilings, not production 50/500 |
| Disconnect release | After client drop, `subscriber_count==0` | Guard Drop already in `LiveCapacity` |

The harness does **not** open 500 real SSE connections in CI. Production defaults 50/500 remain env defaults and stay pinned by the existing isolation test on `config.rs`. The refusal *mechanism* is proven with probe ceilings. A local soak may use production-default ceilings while staying **under** them (hold, not overflow), plus the same probe-ceiling refusal scenario.

### Profiles, duration, numeric thresholds (locked here so R2 can attack the numbers)

Two profiles, closed vocabulary — a CI run is **not** a soak (`[absent-is-not-none]` on evidence class):

| | **ci** (named CI / default command) | **soak** (named local; not default CI) |
| --- | --- | --- |
| Wall duration | 20 s load + 5 s SSE hold + refusal probe; total **< 60 s** | **600 s** hold |
| Warm HTTP concurrency | 16 | 8 sustained |
| SSE hold | 8 | 32 |
| LiveCapacity during hold | probe 8 / 4 (subscribers/sessions) so overflow is cheap | production defaults 500 / 50 for the hold; refusal still uses a nested probe state |
| Rate limit | 0 (existing load-test disable) | 0 |
| Fixture | gex_SPY ≥1000 contracts | same |

**Checked thresholds (command fails non-zero if any trip):**

- Warm bundle HTTP **p95 ≤ 150 ms**
- Cold coalesced bundle HTTP **p95 ≤ 4000 ms** (one wave; 14k-contract CPU + serialize on a GH-class box)
- SSE time-to-first-byte (connected comment or first event) **p95 ≤ 200 ms**
- After inject, per-ticker SSE emit **p95 ≤ 500 ms** (production ticker throttle is 250 ms; slack for CI)
- **Unexpected** 4xx/5xx rate **= 0** (limiter is off; fixture book must exist)
- Refusal scenario: every overflow attempt is **503** with Retry-After 30; those counts are **excluded** from the unexpected-error budget
- `request_count == 0`
- Post-shutdown `subscriber_count == 0`

I do **not** have a checked-in bench number for `process_gex_profile` on this 14k book in CI. The 150 ms / 4000 ms figures are **regression gates for this mocked path**, not production SLOs (telemetry-slos is a later program item). If first implementation calibration shows they are impossible or vacuous on ubuntu-24.04, retune is a numbered threshold change — not a silent raise inside the driver.

p95 is computed from **successful** samples of that scenario only (closed sample class). Mixing cold and warm into one percentile is forbidden — that would hide a cache-miss regression inside hit noise.

### Receipt (content, not wire names)

One artifact per run, under a **capacity** directory (not `data/research/`, so it cannot be mistaken for a score-lab diary). Semantic content:

- Closed **standing**: not live, not a production measurement, **authorizes nothing** on score / gate / fingerprint / production runtime defaults
- Closed **profile** (`ci` | `soak`) and **scenario** inventory actually executed vs configured-not-run
- Duration, concurrency, fixture identity + **contract count**
- p95 and error counts **per scenario**
- Vendor-I/O proof (`request_count`, worker-not-started, rest_base family)
- Pass/fail per threshold
- Host identity (os / profile) so a local Windows soak is not a CI measurement

Empty corpus / missing golden / contract-count floor fail **before** writing a passing receipt (batch-backtest empty-corpus precedent: no measurement artifact that looks like success).

Stderr framing is operator copy — UX owns wording; architect constraint is: standing is **mandatory in the artifact**, and a receipt without standing is a failed run.

### Isolation / error rules

- Harness failure (bind fail, missing fixture, leaked vendor I/O, threshold trip) = **process non-zero**. It does not change trader HTTP error policy.
- `[best-effort-isolated-or-null]` still governs optional bundle fields inside Path B; the harness does not turn HV/VWAP/dark-pool absence into HTTP errors.
- Capacity 503 remains the live-hub refuse class; rate-limit 429 is **out of this feature's default profiles** (limiter off). We do not retune production 120/min.
- Production `APP_ENV=prod` bootstrap, CORS, cookies, Postgres preflight, archive-root probe: **untouched**. Harness never enters that arm (`[production-fails-closed]` is not weakened; we also do not run production fail-closed inside the harness).
- Score/tier/fingerprint: empty `libs/quant-engine` diff; harness pass/fail must not read `opportunity_score` / `opportunity_tier` / `state_fingerprint` as thresholds. Optional **byte-identity check** that a warm HTTP bundle's score triple equals the snapshot produced by `compute_analytics_from_vendor` on the same book is a **no-fork proof**, not a lab verdict.
- `[no-secrets-in-image]`: dummy key only; receipts/logs scanned so they cannot contain `MASSIVE_API_KEY` values or `apikey=` query fragments (capture path already has a similar debug assert).
- `[cited-code-is-verified-not-assumed]`: claims above are sourced. Unverified GH-hosted wall times of the new command stay `[lane-check]` until the first real CI run; the workflow must still be wired so "not run" cannot be reported as pass.

### Structural enforcement (poison → red)

- Source scan: harness leaf + `cmd_capacity_*` contain no `MassiveRestClient` fetch, no `stock_worker.start()`, no `Config::from_env`, no `MarketDataPort::live`, no `opportunity_score` as a predicate. Anti-vacuity: scan also asserts the command body *does* construct `for_capacity_harness` / bind loopback / evaluate thresholds.
- Fixture floor: a test that points the loader at `syn_mini.json` must refuse.
- Receipt standing: a fixture receipt with standing omitted fails the parser test.
- `request_count` predicate: a unit double that increments the counter fails the run.
- Production `construct` with fixture Some + `APP_ENV=prod` refuses.
- CI workflow grep: backend job contains the named ci command; soak command is absent from the default job.
- OpenAPI/generated artifacts: no delta. `quant-engine` diff empty. Dashboard source diff empty.

### Restated binding constraints

- **`[additive-keeps-score-byte-identical]`** — additive fixture arm is `None` in production; quant-engine / `generate_signals` / gate / fingerprint are not inputs to the harness verdict. Optional warm-path triple equality is identity vs the same production function, not a new formula.
- **`[score-change-is-deliberate-and-measured]`** — this feature does not change the score; the receipt authorizes nothing.
- **`[operator-vs-trader-path-separation]`** — CLI/Nx/CI only. No operator HTTP route, no trader-route call from an ops page, no vendor fetch on a diagnostic URL. The driver *is* a client of trader routes, in a throwaway process, which is the opposite of mounting capacity on `/_metrics`.
- **`[best-effort-isolated-or-null]`** — unchanged for optional Path-B fields.
- **`[production-fails-closed]`** — production startup path not edited; harness is a non-prod constructor. Fixture-backed production is refused.
- **`[no-secrets-in-image]`** — no paid key in image, fixtures, or receipts; runtime dummy only.
- **`[cited-code-is-verified-not-assumed]`** — live Path B still uses `state.massive` directly; Live port is not identity-preserving; gex_SPY is 14 218 contracts; LiveCapacity 503+Retry-After 30; rate-limit 0 already exists.
- **`[structural-over-prose-enforcement]`** — scans, floor, `request_count`, standing-required, CI grep, prod+fixture refuse.
- **`[single-ticker-on-demand]`** (narrowed form) — each request computes one ticker; multi-ticker work stays off this driver (scanner remains unspawned). Concurrent same-symbol clients are coalesced misses/hits, not a market sweep.
- **`[live-vs-static-isolation]`** — SSE vs bundle remain separate paths; the harness measures both and does not feed last-trade into GEX (inject quotes/trades onto the existing bus only).
- **`[absent-is-not-none]`** — `ci` ≠ `soak` ≠ hosted-not-run; missing golden ≠ pass; configured-not-executed scenarios stay not-run.
- **Domain math** — vendor gamma for profile/walls, analytic BS flip, `r=4.5%`, `MIN_GREEK_T`, ±20% / 100-pt flip grid, GEX/DEX formulae, NBBO mid as structure anchor, last-trade readout-only: untouched. Enforcement = empty quant-engine diff.

### Explicit non-goals

- No trader-visible behavior, copy, layout, or dashboard surface.
- No new HTTP endpoints, payload fields, or OpenAPI operations.
- No change to production defaults: `MAX_LIVE_SESSIONS=50`, `MAX_LIVE_SUBSCRIBERS=500`, `PUBLIC_RATE_LIMIT_PER_MIN=120`, cache TTLs, `APP_ENV=prod` rules.
- No paid Massive/Options/WS calls; no pointing the harness at Railway.
- No second scoring path, no weight/gate/fingerprint adoption from p95.
- No scanner/universe sweep, no LLM rec load, no broker load, no Postgres requirement for the ci profile.
- No k6/cloud load, service mesh, Kafka, or multi-replica rate-limit story (in-process limiter already documents replica multiplication; out of scope).
- No production SLO dashboard (that is telemetry-slos).
- No claim that mocked p95 equals production vendor RTT.

## Risks I see

- **Fixture vs live port identity.** The additive `Some(fixture)` branch in `compute_analytics` is a production-file edit. A mistake in the `None` arm changes live Path B. Mitigation: `None` arm remains the current join; score-identity / existing analytics tests must stay green; prod+fixture is refused.
- **HubCmd leak.** If local mode still `send`s subscribe commands with no worker, an unbounded channel grows under admit. Local mode must skip the vendor command. A test that admits many times with worker off must not grow a cmd queue (observable via a test-only drain or by using a mode that never sends).
- **Threshold vacuity / tightness.** 150 ms warm / 4000 ms cold are uncalibrated on ubuntu-24.04. Too tight → flaky CI; too loose → a real regression still exits 0. First hosted run is `[lane-check]` until measured; retune is explicit.
- **Tiny-book substitution.** Any "helpful" fallback to `syn_mini` would certify nothing. The ≥1000 floor is load-bearing.
- **dotenv paid key still in process env.** Containment is "do not read it", not "it is absent". A future `from_env` in the command body would load it; the isolation scan is the guard.
- **SSE inject vs production throttle.** Measuring emit p95 without injecting events would record heartbeats and pass vacuously. Each SSE hold must prove it received injected ticks (count > 0 of non-comment events) or the scenario is fail, not skip.
- **Coalescing hides N-wide compute.** That is production-correct, but a bug that disables `GexFlight` would blow cold p95/CPU — which is a feature of the cold scenario, provided we actually issue concurrent misses before the cache fills.
- **Soak-not-in-CI gap.** CI will not prove 10 min hold or 32-connection stability. Receipt class must not imply it did. Local soak remains operator-run.
- **Windows vs Ubuntu p95.** Local soak on Windows is not the CI gate. Profile + os on the receipt keep them distinct.
- **`for_tests` leftover `rest_base` to api.massive.com.** If someone reuses that constructor instead of the harness constructor, a miss would burn the feed. The command body must call only the harness constructor (scan).

## Assumptions I'm making about the other two lanes

- I assume PM will accept **two closed profiles** (`ci` merge gate, `soak` local-only) and will **not** require 500 real SSE connections or a 10-minute hold in GitHub Actions; if false, CI time, runner RAM, and flake risk become the feature.
- I assume PM will accept the **surface set** {ticker bundle HTTP, per-ticker SSE, prices SSE} plus a probe-ceiling 503 scenario, and will **not** add LLM, scan, broker, or `_metrics` to v1 load; if false, mock boundary and non-goals collapse.
- I assume PM will treat the numeric thresholds above as the locked v1 gates (or replace the numbers in R2/R4 **without** changing the check mechanism: p95 per scenario, unexpected-error = 0, expected 503 excluded, `request_count==0`); if they instead want production vendor-RTT SLOs, this mocked harness cannot honestly provide them.
- I assume PM will accept a CI receipt as **not** a production capacity certification and a missing hosted run as **not-run**, not pass; if false, evidence vocabulary would overclaim.
- I assume PM will agree the harness **authorizes nothing** on score/tier/fingerprint/runtime defaults and is not a substitute for telemetry-slos; if false, we would be smuggling a second scoring path.
- I assume UX will own **standing/framing copy** on stderr and the receipt so a green run cannot be screenshot as a live-desk measurement, without adding trader UI or an operator web console; if false, either the product grows a forbidden surface or the receipt is easy to misread.
- I assume UX will not require dashboard chrome, toast, or `/_ops` visualization for these numbers in this slice; if false, that violates operator/trader separation as I have drawn it.
- I assume UX will accept **machine-first receipt content** (closed profile/standing/scenario states) with human prose as a wrapper, not the reverse; if false, `[absent-is-not-none]` has to be restated in copy instead of in types.
- I assume neither lane will require a new public JSON API for the harness; the command's artifact is a file + exit code. If PM wants an HTTP capacity endpoint, that is a different feature and I withdraw the "no new operations" claim rather than hide it inside this driver.
