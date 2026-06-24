# BACKEND EXECUTION CONTRACT — Latency Visualizer

> NO_BACKEND_CHANGE — frontend-only feature.

This feature adds **no server work**. It is a pure consumer of the **existing, unchanged**
read-only `GET /api/_metrics` readout (the shipped backend-observability `MetricsAggregate`).

**Do not modify** any of: `/api/_metrics`, `src/core/observability.py`, the `MetricsAggregate`,
the rolling-window size (`METRICS_WINDOW_SIZE`), `METRICS_RECENT_TRACES`, instrumentation capture,
sampling, `OBSERVABILITY_ENABLED`, the trader/bundle path, or SSE.

- **Binding:** `stateless-server / ephemeral-metrics` and `[best-effort-isolated-or-null]` are
  already satisfied by the shipped readout; the visualizer adds no server state and no new failure
  surface. The persistence option (cross-restart history) remains the **future seam** — not built.
- **Verification:** none required server-side. Confirm only that `GET /api/_metrics` still returns
  the documented shape; the FE binds to it via `INTERFACE_CONTRACT.md`.

The real execution contract for this feature is **`FRONTEND_EXECUTION_CONTRACT.md`**.
