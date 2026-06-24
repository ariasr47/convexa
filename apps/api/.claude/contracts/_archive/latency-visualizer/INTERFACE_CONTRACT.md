# INTERFACE CONTRACT — Latency Visualizer

> The FE↔BE integration truth. Producer: Split Compressor (Session exit). Consumers: Backend +
> Frontend. Self-contained against `.claude/GAMMAFLOW_CONTEXT.md`.
>
> **This feature consumes the existing `GET /api/_metrics` UNCHANGED. There is no backend work** —
> see `BACKEND_EXECUTION_CONTRACT.md` (`NO_BACKEND_CHANGE`). The real execution contract is the
> **frontend** one. This file exists only to pin the exact fields the FE reads and the integration
> invariants it must honor.

## Endpoints touched
- `GET /api/_metrics` — **read-only, side-effect-free, UNCHANGED.** No new endpoint, no new query
  param, no shape change to the readout, the `MetricsAggregate`, the rolling-window size,
  instrumentation capture, or sampling. The FE polls it on an operator cadence; that is the **only**
  network call the visualizer makes.
- **No trader/bundle route, no SSE, no vendor call, no recompute, no cache mutation** — ever, from
  this view.

## Consumed shape (existing `MetricsAggregate`, as already typed in `@org/api`)
```jsonc
{
  "instrumentation_enabled": true,                  // false ⇒ cold/disabled state
  "window": { "size_desc": "…", "uptime_seconds": 0, "request_count": 0 },  // liveness/identity markers
  "global": <MetricsScope>,
  "per_ticker": { "TSLA": <MetricsScope> },         // scope options for the selector
  "recent_traces": [ … ]                            // (existing tables; not charted)
}
// MetricsScope:
{
  "latency_total": { "p50_ms": 0, "p95_ms": 0, "max_ms": 0, "count": 0 },
  "stages": [ { "stage": "vendor_fetch", "kind": "io_vendor", "p50_ms": 0, "p95_ms": 0, "max_ms": 0,
                "count": 0, "ok": 0, "error": 0, "skipped": 0 } ],   // fixed 6-stage vocabulary
  "cache":  { "hits": 0, "misses": 0, "hit_ratio": 0, "current_data_age_seconds": 0 },
  "vendor": { "call_count": 0, "latency_p50_ms": 0, "latency_p95_ms": 0,
              "min_rate_limit_headroom": { "remaining": 0, "limit": 0 } }  // null ⇒ "unknown"
}
```

## Field → chart use (FE reduces each poll; nothing reshaped)
- **Percentile** {p50,p95,max} → `p50_ms | p95_ms | max_ms` on `stages[*]` and `latency_total`.
  **Vendor latency** has only `latency_p50_ms` / `latency_p95_ms` (no max).
- **Cache hit-ratio** → `cache.hit_ratio` (×100 if ≤ 1). **Vendor headroom** →
  `vendor.min_rate_limit_headroom.remaining`; `null` ⇒ render **"unknown"** (never fabricated).
- **No-data** when the relevant `count === 0` or the value is null (→ a gap, never 0).
- **Liveness tags** derived from the markers (not plotted): `instrumentation_enabled` (cold),
  `window.request_count` unchanged vs last poll (stale-repeat), `uptime_seconds`/`request_count`
  reset (restart-discontinuity).

## Error / isolation semantics (binding)
- `fetchMetrics()` already throws on non-2xx → the FE treats it as a **failed poll**: keep the prior
  series, show a soft "couldn't refresh," self-heal next interval, **no retry storm**. Never an error
  page (a prior series exists) — the existing page-level "Metrics readout unavailable." cold-load
  fallback is unchanged.
- The visualizer can **never** turn the operator page into an error or affect any other surface; it
  reads metrics only and writes **no** server state (Export writes only to the operator's machine).

## Out of scope (restated)
- No backend endpoint/shape change; no server persistence; no import/replay; no alerting/thresholds;
  no external/paid APM or new runtime dependency; no per-request raw-latency reconstruction.
