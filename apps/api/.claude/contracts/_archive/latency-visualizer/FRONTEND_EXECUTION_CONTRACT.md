# FRONTEND EXECUTION CONTRACT — Latency Visualizer (the real execution contract)

> For the Frontend Executioner. Binds to GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md +
> INTERFACE_CONTRACT.md + the UX_BLUEPRINT states/copy. UI work ONLY. Backend = `NO_BACKEND_CHANGE`.
> Repo: `C:\Dev\gammaflow-web`. recharts already ships; the `MetricsAggregate` type + `fetchMetrics()`
> already exist in `@org/api` — no new dependency, no API-client change required.

## Files / components to modify
- `apps/dashboard/src/app/operator-metrics.tsx` — add a **`LatencyTrend`** card as the **first** child
  of the `OperatorMetrics` body (above the existing Global/Per-ticker/Recent-traces tables). **Make the
  trend's poll loop the page's single fetcher** (the existing snapshot tables render from the latest
  poll result) so the page still issues **only** `GET /api/_metrics`, once per interval. The existing
  page-level cold-load / disabled / "Metrics readout unavailable." handling stays.
- New component(s) under `apps/dashboard/src/app/operator-metrics/` (or co-located): `LatencyTrend`
  (controls + chart + states) and a `useLatencyTrend` hook owning the poll loop + `RollingClientSeries`.
- No change to `libs/api` (types + `fetchMetrics` already sufficient).

## Client state (in-browser only, ephemeral, serializable — per ARCHITECTURE)
- `MetricSample { client_ts, scope, values{ per active line }, instrumentation_enabled, request_count,
  uptime_seconds, tag }` where `tag ∈ 'live'|'cold'|'stale_repeat'|'restart'|'headroom_unknown'`,
  derived each poll from the liveness markers (INTERFACE "Field → chart use").
- `RollingClientSeries` = a **bounded ring buffer** of MetricSamples per **(scope, metric)**, capped by
  **both** sample-count **and** age (count cap is the hard memory guarantee). Horizon {5/15/30m, default
  15} sets the visible/retained window; 30m max. Cleared on unmount/reload (ephemeral — expected).
- Keep the series **serializable** (the export + the future persisted-tier seam reuse this shape).

## Consumes (from INTERFACE_CONTRACT.md — existing `/api/_metrics`)
`instrumentation_enabled`; `window.{size_desc,uptime_seconds,request_count}`; per scope
(`global`|`per_ticker[t]`) `latency_total.{p50_ms,p95_ms,max_ms,count}`,
`stages[].{stage,kind,p50_ms,p95_ms,max_ms,count}`, `cache.hit_ratio`,
`vendor.{latency_p50_ms,latency_p95_ms,min_rate_limit_headroom}`. **Read nothing from any trader/bundle
route; issue only `GET /api/_metrics`.**

## Controls to implement (defaults bold — copy verbatim from UX_BLUEPRINT)
- **Metric**: `Stages (six lines)` **default** · Total latency · Cache hit-ratio · Vendor latency ·
  Vendor headroom.
- **Percentile**: p50 · **p95** · max — applies to Stages/Total/Vendor latency; **hidden** for
  hit-ratio & headroom; Vendor latency has p50/p95 only (`max` → gap + `vendor latency reports p50/p95 only`).
- **Scope**: **Global** · tickers present in the latest `per_ticker` (absent ticker not selectable).
- **Horizon**: 5m · **15m** · 30m. **Cadence**: 2s · **5s** · 10s · 30s + **Pause/Resume**.
  Recommended: **auto-pause when the tab is hidden** (`document.hidden`).
- **Export**: download the current `RollingClientSeries` as a local JSON file (timestamps, scope,
  metric, percentile, per-line values, tags). One-way out; **no server state**; no import.
- **Stage show/hide**: six legend chips (Metric=Stages), all on; click hides a line so a dominant
  `vendor_fetch` doesn't crush the small CPU stages.

## Component states to implement (from UX_BLUEPRINT — copy verbatim)
Live-accumulating (default) · Cold/instrumentation-off/empty (gap + `No data — instrumentation is off.`
/ `No data yet — serve a bundle to start the trend.`) · **Stale-repeat** (hollow grey dot + dashed
greyed segment + `No new traffic` chip; `…repeat the last measurement — not steady latency.`) ·
**Failed poll** (`Couldn't refresh — keeping the last trend, retrying on the next poll.`; keep series;
no retry storm; no error page) · **Restart discontinuity** (broken line + dashed vertical `Service
restarted` marker; never stitch) · **Vendor headroom unknown** (no line + `Vendor rate-limit headroom:
unknown — the current vendor (Massive) doesn't report it…`) · **Ticker dropped** (`No recent traffic
for {ticker} — it left the window. The earlier line is kept.`) · **Paused** (`Paused — polling
stopped…`; auto: `Auto-paused while the tab was hidden.`) · **Exported** (`Exported the current trend
({n} samples). Saved to your machine — no server state created.`).

## Persistent copy (always visible — NOT tooltips)
- Caveat under the chart: `Each point is the windowed percentile as of that time — not a per-request
  latency. Points overlap because the server's window slides; read it as a sequence of smoothed
  snapshots.`
- Ephemerality near the title/controls: `Live, in-browser only — this trend clears when you reload or
  leave. That's expected; use Export to keep a run.`
- Non-alerting (with the caveat): `Shown factually — no thresholds, no alerts. A high line or low
  headroom is information, not a warning.`

## Chart rules (recharts; non-alerting + honest)
- **Categorical, non-semantic palette** for the six stage lines (no red-for-bad/green-for-good;
  colorblind-distinguishable); legend chip color matches its line.
- **Gaps = broken line** (`connectNulls={false}`, null y); **never** plot 0 or interpolate across a
  gap/restart; restart = null break + a dashed `ReferenceLine` at the boundary timestamp.
- **Stale-repeat** = hollow grey markers + dashed/greyed connector, distinct from solid live points.
- **No threshold lines, no red zones, no breach coloring.** Y unit per metric (ms via existing
  `fmtMs`; % for hit-ratio; calls for headroom).

## Degradation / isolation (binding)
- A failed poll degrades **only** the trend (soft notice + keep-last + self-heal) — never the page,
  the snapshot tables, or anything else. The page's sole network call stays `GET /api/_metrics`.
- Reload/navigate-away clears the in-browser series — framed as **expected** (ephemerality copy),
  never "data lost"/"saved". The only persistence is the explicit local Export.
- **Operator-only:** the view stays on `/_ops/metrics`, never linked from the trader UI; **no control**
  may trigger a vendor fetch, recompute, cache mutation, or a trader-route call.

## Verification
- [ ] On `/_ops/metrics` with traffic flowing, the chart **extends each poll**; the network tab shows
      **only `GET /api/_metrics`** (no trader/vendor/recompute calls).
- [ ] Default = six stage lines at **p95**, global; switching percentile to p50/max moves all stage
      lines; Total/Cache-ratio/Vendor-latency chart correctly; **Vendor headroom = "unknown"** (no
      fabricated number), non-alerting.
- [ ] Stage chips show/hide lines; hiding `vendor_fetch` reveals the small CPU stages.
- [ ] Scope→ticker charts it; ticker leaving the window → no-data gap with the prior line kept;
      back→Global restores. Cadence changes frequency; Pause freezes+stops, Resume appends; Horizon
      changes history and the series **never grows unbounded** (count cap holds at fast cadence).
- [ ] Instrumentation OFF / cold-empty → **gap/"no data"** (never blank/0/crash), recovers when data
      returns. No new traffic between polls → **"no new traffic"** samples visually distinct.
- [ ] Kill the backend mid-session → **failed-poll** soft notice + last series kept + self-heal on
      restart; the restart shows a **broken line + marker**, not a stitched line.
- [ ] The windowed-snapshot caveat + the ephemerality + non-alerting lines are **persistently visible**
      (not tooltip-only). Reload clears the series with no "data lost" framing.
- [ ] Export downloads the current series locally; creates **no server state**.

## Out of scope
- No backend/server internals; no `/api/_metrics` change; no new endpoint/param/dependency. No server
  persistence, no import/replay, no alerting/thresholds, no per-request reconstruction. Never link the
  view from a trader route or add a control that hits one.

## Definition of done
- [ ] UI implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` updated (the `/_ops/metrics` operator view now also trends the
      readout locally; still read-only, single `GET /api/_metrics`, ephemeral).
- [ ] This feature's `.claude/contracts/latency-visualizer/` folder archived on ship; `OPEN_THREADS.md`
      / `BACKLOG.md` updated (the §D observability "local visualization" slice is now shipped; export/
      alerting/persistence remain parked). `DECISION_LEDGER.md` row(s) captured at GATE S (e.g.
      `operator-vs-trader-path-separation`, `best-effort-isolated-or-null`).
- [ ] Committed (frontend repo).
