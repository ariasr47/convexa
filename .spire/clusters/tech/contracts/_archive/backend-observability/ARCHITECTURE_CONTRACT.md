# ARCHITECTURE CONTRACT — Backend Observability (bundle-pipeline instrumentation)

> Producer: Architect (this session). Consumer: PM (next session).
> Reader has only `.claude/GAMMAFLOW_CONTEXT.md` + this file. No chat history.
> Lane: data-structure *content*, data-flow, component boundaries, isolation/error rules,
> non-goals. **No UI/layout, no endpoint signatures, no payload/JSON field names, no copy.**

## Goal
Instrument the existing **single-ticker REST bundle pipeline** end-to-end so we can see where time
and vendor calls go, set a performance **baseline**, and surface bottlenecks — **without changing
any computed output, cache semantics, or behavior.** Three legs: (1) per-stage + total **timing/
traces**, (2) **metrics** (latency p50/p95 per stage & total, cache hit/miss + age, vendor call
count + latency + rate-limit headroom), (3) **structured, correlatable logs**. Best-effort and
isolated: never meaningfully slows the hot path, never turns a 200 into an error, never touches SSE.
The per-ticker breakdown must **aggregate cleanly across tickers** so the next feature (a multi-
ticker scanner reversing the dropped watchlist scan, Key decision #1) can see which stages dominate
and which are cacheable/parallelizable at fan-out.

## Binding constraints restated (must not be violated)
- **Computed output is frozen.** Gamma sourcing (vendor gamma for profile/walls; analytic BS gamma
  only for the flip ±20% grid), **r = 4.5%**, dividend yield q, `MIN_GREEK_T = 1/365`, GEX/greeks/
  flip/DEX/Vol-OI/skew/term/signals/score — instrumentation **observes, never alters** any value.
- **DTE/expiration-filter scope unchanged.** The filter still shapes gamma structure only; max pain
  & PCR stay full-chain. The trace **records** the filter params as dimensions (they drive cost) but
  must not change filtering.
- **Dark-pool stays context-only, capped, toggleable, best-effort isolated.** Timing the off-
  exchange stage must preserve its `off_exchange = None`-on-failure semantics; `dark_pool` on/off is
  a trace dimension, not a new behavior.
- **Stateless server / no new hot-path locking.** State today is mutated **only from the event loop
  after the worker thread returns** (the `_cache`/fingerprint discipline). Telemetry must keep this:
  the worker thread fills a **per-request, request-local** trace object (no shared state); the
  **event loop** folds it into the process-local aggregator (single-writer, lock-free), after the
  response is assembled.
- **Live-vs-cached isolation / SSE untouched.** This feature instruments the **REST bundle path
  only**. The live path (`LiveSession`/`LiveHub`/`_broadcast_loop`/SSE) gets **no spans, no new
  failure surface, no per-tick overhead**. Out of scope here.
- **60s cache model preserved.** Cache hit/miss/age is **recorded as observation** (it already rides
  `meta.cache`); a cache-HIT trace records near-zero compute (wrap/serialize only) so the baseline
  cleanly separates hit vs miss cost. Instrumentation never perturbs TTL or keys.
- **Vendor-agnostic port preserved.** "Add a vendor = one adapter, nothing else changes." No port
  **method signature** changes (see vendor-metrics seam below — it is optional/additive).
- **External-AI contract / over-trading guard** — untouched (no scoring/gate change).

## Stage model (the boundaries to time — Level 1)
Time at the **orchestration boundary** (`compute_ticker` / `_build_market_state` / `_serve` /
`_wrap`), wrapping calls to the pure modules so **`engine.py`/`signals.py`/`darkpool.py` are not
modified** (output/behavior frozen). Stages:
1. `vendor_fetch` — `fetch_options_market_state` + `fetch_daily_bars` + `fetch_intraday_bars`
   (+ `fetch_recent_trades` when dark_pool). **I/O-bound.** Sub-timed per logical call.
2. `engine_build` — `process_gex_profile` (GEX/greeks/walls/flip/DEX/Vol-OI/skew/term) + HV + VWAP.
   **CPU-bound.**
3. `off_exchange` — `analyze_off_exchange` (+ its fetch counted under `vendor_fetch`). **CPU-bound.**
4. `signals` — `generate_signals` + `evaluate_gate`. **CPU-bound.**
5. `persist` — `_write_ticker_files` (disk). **I/O-bound** (a real, often-overlooked latency source).
6. `serialize_wrap` — `_wrap` envelope + tiering + `position_eval` + Pydantic/FastAPI serialization.
- **Level-2 intra-engine sub-spans** (e.g. GEX vs flip vs skew) are **optional** and, if added, MUST
  be via an **optional timer param that defaults to a no-op**, so the module's output and standalone
  usability are unchanged. Recommend shipping Level-1 first.
- **No per-contract / per-tick spans** (too hot; would violate the overhead rule).

## Data structures (content only — names/JSON are downstream)
- **StageTiming**: stage id (fixed vocabulary above), `kind` (`io_vendor`|`cpu_engine`|`cpu_signals`
  |`io_disk`|`serialize`), duration, status (`ok`|`error`|`skipped`), optional count/attrs
  (e.g. contract count, filtered count). The `kind` classifier is **load-bearing** for the scanner:
  it labels each stage I/O-bound (parallelizable/cacheable at fan-out) vs CPU-bound (needs worker
  parallelism).
- **VendorCallMetric** (normalized, all vendor-specific fields optional): logical call name,
  duration, optional http_status, optional retries, optional **rate-limit remaining/limit**
  (headroom), optional payload size.
- **RequestTrace** (one per compute, request-local): `trace_id` (correlation id), ticker, filter
  dimensions (min_dte, max_dte, expirations-present, dark_pool), cache_hit + cache_age,
  total_duration, `list[StageTiming]`, `list[VendorCallMetric]`, computed_at, served_at, and on a
  cache hit an optional `computed_trace_id` lineage pointer to the miss-trace that produced the
  served bundle.
- **MetricsAggregate** (process-local, ephemeral): rolling per-stage and total latency percentiles
  (p50/p95) over a bounded window, cache hit/miss counts + ratio, vendor call count + latency
  percentiles + **min rate-limit headroom seen**, grouped so **per-ticker rolls up to global**.
  Bounded memory (ring buffer / streaming-percentile); reset on process restart (a baseline tool,
  not a durable store).
- **Structured log record** (the third leg): each stage close + the request emit a key=value/JSON
  line carrying `trace_id`, ticker, stage, duration, status — so logs **correlate** with traces and
  metrics. Additive to the existing human-readable logger; it must not break or double current lines.

## Data-flow & component boundaries
- A **new module** (e.g. `src/core/observability.py`) owns: the **span/timer primitive** (a context
  manager that records a `StageTiming` into the current `RequestTrace`), the **RequestTrace**
  factory, the **MetricsAggregate**, and the **structured emitter**. `engine.py`/`signals.py`/
  `darkpool.py` do **not** import it (Level-1).
- **Trace propagation:** a `RequestTrace` is created at **serve entry** and carried via a
  `contextvars.ContextVar` (asyncio copies context into `asyncio.to_thread`, so the same mutable
  trace object is visible in the worker thread; appends from the thread are visible to the loop).
  Alternative (explicit param threading) is acceptable; either way the trace is **per-request, never
  global/thread-local-leaking**.
- **Timing source:** monotonic clock reads (`perf_counter`/`monotonic_ns`), O(1), negligible.
- **Vendor metrics seam (optional, additive — no signature change):** rate-limit headroom / per-HTTP
  latency / retries live **inside the adapter** (only it sees response headers). Surface them via an
  **optional metrics sink** the adapter writes to when present (discovered by optional attribute /
  duck-typing), emitting normalized `VendorCallMetric`s. Adapters that don't implement it emit
  nothing — the port contract is unchanged and a new vendor still needs only its adapter. Logical
  vendor-call **count + wall latency** are captured at the call site regardless (no seam needed).
- **Aggregation step:** after `to_thread` returns and the envelope is built, the event loop folds
  the finished `RequestTrace` into `MetricsAggregate` (single-writer, lock-free, consistent with the
  existing cache-mutation discipline). Structured logs may emit from either side (stateless).
- **Cache interaction:** on a HIT, `_serve` short-circuits compute; the trace records only
  `serialize_wrap` + the hit flag, so hit vs miss cost is distinguishable in the baseline.

## Isolation & error-handling rules
- **Best-effort everywhere:** every span/metric/emit is wrapped so an instrumentation exception is
  swallowed (logged at debug) and the computation/response proceeds unchanged. A failed timer →
  missing span, never a raised error.
- **Never an HTTP error:** instrumentation can never convert a 200 bundle into a non-200.
- **Bounded overhead:** stage-level only (≤ ~6 spans + a handful of vendor metrics per request); no
  network/disk in the hot path for telemetry; aggregation/emit happen **after** the response is
  assembled or are O(1) appends — never blocking serialization.
- **No new shared mutable state on the hot path** beyond the single-writer aggregator on the loop.
- **SSE path:** explicitly not instrumented; zero added overhead or failure surface there.
- **Dark-pool/off-exchange:** timing wraps the existing try/except; the `None`-on-failure semantics
  and best-effort isolation are preserved.

## Multi-ticker fan-out readiness (forward-looking, design-data only — do NOT build the scanner)
- Each compute emits one `RequestTrace` tagged with ticker + filter dims, so a future scanner that
  fans out N computes yields N traces that **roll up by stage** in `MetricsAggregate`.
- The `kind` classifier + per-stage percentiles reveal which stages dominate **and** their nature:
  `io_vendor`/`io_disk` (I/O-bound → parallelizable and/or cacheable at fan-out) vs
  `cpu_engine`/`cpu_signals` (CPU-bound → needs worker/process parallelism). This is exactly the
  baseline the scanner decision needs.
- **Vendor rate-limit headroom** captured per request → the aggregate's **min headroom** bounds safe
  fan-out concurrency before throttling.
- Cache hit-ratio per ticker/stage shows what a warm scanner can serve from memory vs must recompute.

## Non-goals (out of scope)
- No UI/layout, dashboards, endpoint signatures, payload/JSON field names, or copy.
- No change to any computed output, cache TTL/keys, gamma/flip/walls, signals/score, or dark-pool
  semantics.
- No SSE/live-path instrumentation.
- No per-contract / per-tick spans.
- No external metrics backend / exporter wiring (Prometheus/OTel) in this phase; no cross-restart
  persistence of metrics (ephemeral baseline only). Design should not *preclude* a later OTel/Prom
  mapping, but it is not built here.
- No port **method-signature** change (vendor metrics ride the optional sink seam only).
- **Not** building the multi-ticker scanner — only ensuring the baseline data supports it.

## Open questions for the PM (downstream — Interface/UX/config)
- Whether/where to surface `trace_id` and per-stage timings in the response `meta` (payload shape).
- A metrics-readout surface (e.g. a debug/metrics endpoint) — endpoint design is downstream.
- Rolling-window size / retention for `MetricsAggregate`; which percentiles to expose; per-ticker
  breakdown vs global only.
- Sampling policy under load (always-on vs sampled) and whether instrumentation sits behind an env
  flag (default on/off).
- Structured-log sink + format (stdout JSON vs file vs external) and verbosity; future OTel/Prom
  adoption.
- Latency/headroom alert thresholds (product decision, not architect).
- How/whether to surface normalized rate-limit headroom to operators.
