# INTERFACE CONTRACT — Backend Observability (operator metrics readout)

> The single source of FE↔BE integration truth. Both execution contracts bind to THIS file.
> Producer: Split Compressor (Session exit). Consumers: Backend + Frontend.
> Self-contained against `.claude/GAMMAFLOW_CONTEXT.md` + ARCHITECTURE_CONTRACT.md.
> Audience note: operator/developer-facing. The **trader bundle's computed values, cache semantics,
> and SSE are unchanged**; the only bundle-path additions are `meta.trace_id` (always) and an
> optional `meta.timings` block (verbose only).

## Endpoints touched
- `GET /api/ticker/{ticker}` (+ `/{ticker}`, slices) — bundle. **`meta` gains `trace_id` (always)**;
  **`meta.timings` (per-stage breakdown) appears only when the request sets the verbose/debug
  switch** (a query param, default off — name finalized here by Interface, e.g. `?debug=1`). No
  change to any computed field, to `meta.cache`/`meta.freshness`, or to cache keys/TTL.
- **NEW — operator metrics readout** (read-only, side-effect-free): a dedicated endpoint returning the
  rolling `MetricsAggregate` JSON (signature Interface's call, e.g. `GET /api/_metrics` or
  `/api/admin/metrics`). **Reading it MUST NOT** trigger a vendor fetch, recompute a bundle, or mutate
  the bundle cache. Returns the readout shape below. Should be operator-gated (not linked from the
  trader UI).
- `GET /api/stream/{ticker}` (SSE) — **UNCHANGED. Not instrumented. No new field, no added latency,
  no new failure surface.**

## Response-metadata additions (`meta`)
```jsonc
"meta": {
  // … existing served_at, cache{...}, freshness{...} unchanged …
  "trace_id": "string",        // ALWAYS present when instrumentation enabled; correlation id
  "timings": {                 // present ONLY when the verbose/debug switch is set; else absent
    "total_ms": 0,
    "stages": [ { "stage": "vendor_fetch", "kind": "io_vendor", "duration_ms": 0, "status": "ok" } ],
    "vendor_calls": [ { "name": "string", "duration_ms": 0, "http_status": 0, "retries": 0,
                        "rate_limit": { "remaining": 0, "limit": 0 } } ]   // vendor-specific fields optional/nullable
  }
}
```
- When **instrumentation is disabled** (env flag off): `meta.trace_id` is absent/empty and
  `meta.timings` never appears; the bundle is byte-identical to today otherwise.
- The **trader FE must ignore** `trace_id`/`timings` (render nothing new).

## Operator readout shape (read-only)
```jsonc
{
  "instrumentation_enabled": true,
  "window": { "size_desc": "last ~500 req / ~15 min", "uptime_seconds": 0, "request_count": 0 },
  "global": {
    "latency_total": { "p50_ms": 0, "p95_ms": 0, "max_ms": 0, "count": 0 },
    "stages": [
      { "stage": "vendor_fetch", "kind": "io_vendor", "p50_ms": 0, "p95_ms": 0, "max_ms": 0,
        "count": 0, "ok": 0, "error": 0, "skipped": 0 }
      // … engine_build(cpu_engine), off_exchange(cpu_engine), signals(cpu_signals),
      //    persist(io_disk), serialize_wrap(serialize) …
    ],
    "cache": { "hits": 0, "misses": 0, "hit_ratio": 0, "current_data_age_seconds": 0 },
    "vendor": { "call_count": 0, "latency_p50_ms": 0, "latency_p95_ms": 0,
                "min_rate_limit_headroom": { "remaining": 0, "limit": 0 } }  // object | null (null ⇒ "unknown")
  },
  "per_ticker": { "TSLA": { /* same shape as global */ } },
  "recent_traces": [                                   // optional
    { "trace_id": "string", "ticker": "TSLA",
      "dims": { "min_dte": null, "max_dte": null, "expirations_present": false, "dark_pool": true },
      "cache_hit": false, "cache_age_seconds": 0, "total_ms": 0, "computed_trace_id": null }
  ]
}
```

## Field semantics / presence (binding)
- **Stage vocabulary is fixed:** `vendor_fetch, engine_build, off_exchange, signals, persist,
  serialize_wrap`. `kind` ∈ `io_vendor | cpu_engine | cpu_signals | io_disk | serialize` (the UI maps
  `io_*` → "I/O", the rest → "CPU"). A stage that didn't run (e.g. `off_exchange` with `dark_pool`
  off) reports `skipped` — **never a fabricated 0** presented as a real timing.
- **Percentiles:** expose `p50_ms`, `p95_ms`, plus `max_ms` and `count`, per stage and for the total,
  over the rolling window.
- **Cache:** `hits`, `misses`, `hit_ratio`, `current_data_age_seconds`. A cache-HIT trace records only
  `serialize_wrap` (near-zero compute) so hit vs miss cost is distinguishable.
- **Vendor headroom is best-effort:** `min_rate_limit_headroom` is `null` when the vendor doesn't
  expose it ⇒ the readout renders **"unknown"**, never a number, never an error.
- **Per-ticker rolls up to global** (same shape). Both are always present (may be empty).
- **Empty window:** before any request, numerics are empty/zeroed at the data layer but the **UI
  renders `—`** and the empty banner — no number is presented as a real measurement.
- **Window is ephemeral:** the aggregate resets on process restart; `window.uptime_seconds` reflects
  this. No cross-restart persistence.

## Error / isolation semantics (binding)
- **Best-effort, never an HTTP error:** any instrumentation failure (span, metric, emit) is swallowed
  — the bundle serves **unchanged (200, same computed values)** with only the affected metric/span
  **missing**. Instrumentation can never convert a 200 into a non-200.
- **Read-only readout:** the metrics endpoint is side-effect-free; if it itself errors, that is an
  **operator-tool error only** — the trader bundle and SSE are unaffected.
- **No SSE instrumentation, no hot-path slowdown:** capture is stage-level; aggregation/log emission
  happen off the response-critical path.
- **Config:** instrumentation env flag default **ON** (off ⇒ no metrics recorded, bundle identical);
  verbose per-stage `meta.timings` switch default **OFF**.
- **Structured logs:** carry `trace_id` (+ ticker/stage/duration/status); request summary at INFO,
  per-stage at DEBUG; **additive** to the existing human-readable lines, **not doubling** them.

---

## Backend resolution amendment (names finalized — binding)

> Filed by the Backend Executioner. The contract left the verbose-switch name, the readout endpoint,
> and the env flag/window names as examples ("Interface's call / operator-doc"). The backend pins
> them below; additive, so no FE assumption breaks.

- **Verbose switch:** `GET /api/ticker/{ticker}?debug=1` (bool query param, default off) → adds
  `meta.timings`. Unknown/absent ⇒ no timings.
- **Readout endpoint:** `GET /api/_metrics` (read-only, side-effect-free, operator-gated) → the
  readout JSON shape above.
- **Env config:** `OBSERVABILITY_ENABLED` (default `true`; off ⇒ no `meta.trace_id`/`timings`, no
  metrics recorded, bundle byte-identical) · `METRICS_WINDOW_SIZE` (default `500`, the rolling
  request-window size; `window.size_desc` = "last ~500 req") · `METRICS_RECENT_TRACES` (default `25`).
- **Vendor headroom:** the Massive SDK exposes no response rate-limit headers, so
  `min_rate_limit_headroom` is `null` ("unknown"); the optional `metrics_sink` seam on the provider
  port is ready for a transport that does expose them (no port signature change).
- **`meta.timings.vendor_calls[].http_status`/`rate_limit`** are emitted as `null` for Massive
  (vendor-specific, optional/nullable per this contract) — the FE type may treat them as nullable.
