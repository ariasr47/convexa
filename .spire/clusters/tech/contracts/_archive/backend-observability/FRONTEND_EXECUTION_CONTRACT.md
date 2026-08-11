# FRONTEND EXECUTION CONTRACT — Backend Observability (operator metrics readout)

> For the Frontend Executioner. Binds to GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md +
> INTERFACE_CONTRACT.md + the UX_BLUEPRINT component states. UI work ONLY.
> **Scope is deliberately small.** This is a backend feature: the **trader dashboard is unchanged.**
> The FE has exactly two obligations — (1) tolerate the new `meta` fields without surfacing them to
> the trader, and (2) **optionally** render the operator readout. The readout is operator/developer-
> facing and **must not** be linked from or shown in the trader view.

## Obligation 1 — trader dashboard: ignore the new meta (required)
- `libs/api/src/lib/gammaflow.ts`: extend the `Meta` type with **optional** `trace_id?: string` and
  `timings?: {...}` so responses parse cleanly. **Do not render either in the trader dashboard** —
  no latency, percentile, headroom, stage-timing, or trace-id UI in the trader view (binding
  "operator-only / no trader change").
- Verify the existing dashboard (`apps/dashboard/src/app/app.tsx`) is **visually and behaviorally
  unchanged** with the new `meta` present.

## Obligation 2 — operator metrics readout (optional this phase; if built, to this spec)
A **read-only** operator view of the metrics-readout JSON (INTERFACE_CONTRACT). Keep it **off the
trader routes** (e.g. a separate operator route/page), reading the readout endpoint only. It is
**side-effect-free** — it must never trigger a bundle fetch or any compute; it only GETs the readout.

**Consumes (from INTERFACE_CONTRACT.md):** the readout shape — `instrumentation_enabled`, `window`,
`global` + `per_ticker[…]` (latency_total; stages with `stage`/`kind`/p50/p95/max/count/ok/error/
skipped; cache hits/misses/ratio/age; vendor count/latency/`min_rate_limit_headroom|null`), optional
`recent_traces` (trace_id, dims, cache_hit, total_ms, computed_trace_id).

**Component states to implement (from UX_BLUEPRINT.md — copy verbatim):**
- **Empty / cold:** `No requests recorded yet — serve a bundle to populate the baseline.`; numerics `—`.
- **Populated:** global roll-up + per-ticker stage tables (stage · **I/O|CPU tag from `kind`** · p50 ·
  p95 · max · count · ok/err/skip), total latency row, cache line, vendor line.
- **Unknown (vendor):** `min_rate_limit_headroom == null` → render **`unknown`** + caption `this
  vendor doesn't report rate-limit headroom` (never a number).
- **Disabled:** `instrumentation_enabled == false` → single notice `Instrumentation disabled — no
  metrics are being recorded. Enable it via the observability flag to populate this readout.`
- **Reset (post-restart):** Empty/cold + window caption `Rolling window: last {size} · uptime
  {uptime} · resets on restart (ephemeral baseline).`
- **Readout unavailable:** endpoint errors → `Metrics readout unavailable.` (operator-tool only — note
  the trader bundle/SSE are unaffected).
- **Loading:** lightweight spinner / `Loading metrics…`.
- **Trace inspect:** a row → expand one `RequestTrace`; label **warm** `cache hit · near-zero compute`
  vs **cold** `cache miss · full compute`; show dims, cache age, total, stage timings, vendor calls.

**Honest-presentation rules (binding):**
- **No fabricated/zeroed numbers as real** — empty window renders `—`, not 0; a `skipped` stage shows
  `skipped`, not a 0 timing.
- **Low headroom is NON-alerting:** present `min_rate_limit_headroom` factually as `{remaining} of
  {limit} remaining (minimum observed this window) · bounds safe scanner fan-out`. **No threshold,
  pass/fail, or alert styling** (alerting is future-dated) — a low number is just a low number.
- **I/O vs CPU tag:** map `kind` `io_*` → `I/O`, the rest → `CPU`; keep the precise `kind` on hover.

**Stage/glossary tooltips:** use the UX_BLUEPRINT "Glossary / operator-doc" strings (stage vocabulary,
I/O vs CPU, p50/p95, cache hit/miss + age, rate-limit headroom best-effort, ephemeral-window caveat,
trace-id correlation flow).

## Degradation / isolation (binding)
- The readout is a **separate operator surface**: if it fails to load, show `Metrics readout
  unavailable.` — **never** let it affect the trader dashboard, the bundle, or SSE.
- The standard **trader** degraded-state copy (`⚠ Live offline — reconnecting…`, `Couldn't refresh —
  showing data from {age} ago.`, cold-start error) is **unchanged** — this feature adds no trader-
  facing failure surface.

## Verification
- [ ] Trader dashboard renders identically with `meta.trace_id` (and, when verbose, `meta.timings`)
      present — nothing new shown to the trader, no console errors.
- [ ] (If built) the operator readout renders global + per-ticker stage tables with I/O/CPU tags,
      total/cache/vendor lines, from the readout endpoint only — no bundle fetch triggered.
- [ ] Empty window → `—` + the cold banner; vendor without headroom → `unknown`; instrumentation off
      → the disabled notice; readout endpoint down → `Metrics readout unavailable.` with the trader
      view unaffected.
- [ ] A cache-hit trace reads `cache hit · near-zero compute`; a miss reads `cache miss · full
      compute`.

## Out of scope
- No backend/server internals. No trader-facing metrics, ever. No data-shape changes (bind to the
  interface contract). No alerting/threshold UI (future). No OTel/Prom UI. Do not link the readout
  from the trader app.

## Definition of done
- [ ] Obligation 1 implemented + verified (trader view unchanged, meta tolerated). Obligation 2
      implemented to spec **if** built this phase; otherwise explicitly deferred in the handoff.
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed if the UI changed any described behavior/state.
- [ ] This feature's `.claude/contracts/<feature>/` folder archived once both lanes land, and
      `.claude/OPEN_THREADS.md` updated. Coordinate with backend so the folder is archived once both
      land.
- [ ] Committed.
