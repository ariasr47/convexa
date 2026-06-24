# BACKEND EXECUTION CONTRACT — Backend Observability (bundle-pipeline instrumentation)

> For the Backend Executioner. Binds to GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md +
> INTERFACE_CONTRACT.md. Server work ONLY. Implement to spec; do not redesign or re-scope.
> This feature is **almost entirely backend** — the FE only ignores the new `meta` fields and may
> optionally render the readout.

## Files / functions to modify
- **NEW `src/core/observability.py`** — owns: the **span/timer primitive** (a context manager that
  records a `StageTiming` into the current `RequestTrace`), the **RequestTrace** factory, the
  process-local **MetricsAggregate** (rolling p50/p95 + count + max per stage & total; cache hit/miss
  + ratio + age; vendor call count + latency percentiles + **min rate-limit headroom**; grouped so
  per-ticker rolls up to global; bounded memory; reset on restart), and the **structured emitter**.
  `engine.py` / `signals.py` / `darkpool.py` do **NOT** import it (Level-1).
- `main.py` (orchestration boundary — `compute_ticker` / `_build_market_state` / `_serve` / `_wrap`):
  wrap the **six stages** (`vendor_fetch` io_vendor, `engine_build` cpu_engine, `off_exchange`
  cpu_engine, `signals` cpu_signals, `persist` io_disk, `serialize_wrap` serialize) with the span
  primitive; create the `RequestTrace` at serve entry; carry it via a `contextvars.ContextVar` (or
  explicit param) into `asyncio.to_thread`; after the response is assembled, the **event loop folds**
  the finished trace into `MetricsAggregate` (single-writer, lock-free, consistent with the existing
  cache-mutation discipline). On a **cache HIT**, record only `serialize_wrap` + the hit flag.
- `main.py` (envelope): add `meta.trace_id` (always when enabled) and `meta.timings` (only when the
  verbose/debug request switch is set) per INTERFACE_CONTRACT. Add the **read-only metrics-readout
  endpoint** returning the aggregate (side-effect-free: no compute, no vendor call, no cache mutation).
- `main.py` (config): an **instrumentation env flag (default ON)** and the **verbose/debug request
  switch (default OFF)**; plus the **rolling-window size** config (sensible default).
- `src/providers/base.py` / `src/providers/massive.py` (**vendor-metrics seam — optional, additive,
  NO signature change**): the adapter surfaces rate-limit headroom / per-HTTP latency / retries via an
  **optional metrics sink** it writes to when present (duck-typed/optional attribute), emitting
  normalized `VendorCallMetric`s. Adapters without it emit nothing; logical vendor-call **count + wall
  latency** are captured at the call site regardless.

## Binding constraints
- **Computed output frozen.** No change to any GEX/greeks/flip/DEX/Vol-OI/skew/term/signals/score
  value, to `r`/`q`/`MIN_GREEK_T`, to gamma sourcing, to DTE/expiration-filter scope, to dark-pool
  semantics, or to cache TTL/keys. Instrumentation **observes, never alters**. (The filter params and
  `dark_pool` are recorded as **trace dimensions** only.)
- **`engine.py`/`signals.py`/`darkpool.py` not modified** (Level-1). Any Level-2 intra-engine sub-span
  must be an **optional timer param defaulting to a no-op** — recommend shipping Level-1 only.
- **Stateless server / no new hot-path locking.** Worker thread fills a **request-local** trace (no
  shared state); the **event loop** folds it into the aggregator after the response — single-writer,
  lock-free. The aggregate is **process-local and ephemeral** (resets on restart); **no new
  persistence**.
- **Best-effort + isolated.** Every span/metric/emit is wrapped so an instrumentation exception is
  swallowed (logged at debug); the computation/response proceeds **unchanged**. Instrumentation can
  **never** turn a 200 into a non-200, and **never** blanks/degrades a served value.
- **Hot path not meaningfully slowed.** Stage-level capture only (≤ ~6 spans + a few vendor metrics);
  no network/disk for telemetry in the hot path; aggregation/emit happen **after** the response is
  assembled or are O(1) appends.
- **SSE untouched.** The live path gets **no spans, no added latency, no new failure surface.**
- **Honest data.** `min_rate_limit_headroom` is `null` when the vendor doesn't expose it (→ readout
  shows "unknown"); a skipped stage reports `skipped`, never a fabricated 0.
- **Read-only readout.** The metrics endpoint never triggers a compute/vendor call or mutates the cache.
- **Vendor-agnostic port preserved.** No port **method-signature** change (metrics ride the optional
  sink seam only); "add a vendor = one adapter, nothing else changes" still holds.

## Must emit (from INTERFACE_CONTRACT.md)
- `meta.trace_id` (always when enabled) + `meta.timings` (verbose only) with the stage/kind/duration/
  status + vendor_calls shape.
- The readout JSON: `instrumentation_enabled`, `window`, `global` + `per_ticker[…]` (latency_total;
  stages with `kind`,p50,p95,max,count,ok/error/skipped; cache hits/misses/ratio/age; vendor
  count/latency/min headroom|null), optional `recent_traces` with `trace_id`+dims+cache_hit+
  `computed_trace_id`.
- Structured log lines carrying `trace_id` (INFO request summary; DEBUG per-stage), additive, not
  doubled.

## Verification
- [ ] After several requests, the readout shows total + per-stage p50/p95/max/count, request count,
      cache hits/misses/ratio + data age, and vendor call count/latency/min headroom (or "unknown").
- [ ] Per-ticker tables roll up to a matching global section; each stage carries its `kind`.
- [ ] A cache-HIT request's trace records only `serialize_wrap` (near-zero compute) + the hit flag;
      a MISS records all stages.
- [ ] Every served bundle has `meta.trace_id`, and that id appears in the request's structured log
      lines; the existing human-readable lines still appear and are not doubled.
- [ ] `meta.timings` appears only with the verbose switch; default responses are unchanged.
- [ ] Instrumentation flag OFF → bundle byte-identical, no `trace_id`/`timings`, no metrics recorded.
- [ ] Force an instrumentation exception → bundle still 200 with identical computed values; only the
      affected span/metric is missing.
- [ ] Hitting the readout endpoint triggers no vendor fetch and does not change `meta.cache`/age of a
      subsequent bundle; SSE shows no change and no added latency with instrumentation on.
- [ ] Restart → aggregate empty; readout presents empty/unknown gracefully (UI `—`, banner).

## Out of scope
- No UI/layout (FE renders the readout optionally). No change to computed outputs/cache/gamma/signals.
- No SSE instrumentation; no per-contract/per-tick spans; no sampling.
- No OTel/Prometheus exporter, no cross-restart persistence, no automated alerting/thresholds, no
  multi-ticker scanner (baseline only). Design must not preclude these.

## Definition of done
- [ ] Code implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed (re-read touched files; same section structure);
      `market_state_glossary.md` / operator docs updated with the stage vocabulary, I/O-vs-CPU tag,
      percentiles, headroom semantics, ephemeral-window caveat, trace-id flow, and the config flag/
      switch names + default window size (drafts in UX_BLUEPRINT.md → "Glossary / operator-doc").
- [ ] This feature's `.claude/contracts/<feature>/` folder archived once both lanes land, and
      `.claude/OPEN_THREADS.md` updated (note deferred: OTel/Prom export, alert thresholds, persisted
      baselines, scanner). Coordinate with frontend.
- [ ] Committed.
