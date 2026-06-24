# UX BLUEPRINT — Latency Visualizer (local $0 pipeline-latency trend)

> Producer: UX/Tech-Writer (this session). Consumers: Backend & Frontend Executioners (via the
> Split Compressor → INTERFACE + BACKEND + FRONTEND). No production code.
> Grounded against `.claude/GAMMAFLOW_CONTEXT.md`, the latency-visualizer PRODUCT_CONTRACT +
> ARCHITECTURE_CONTRACT, the existing operator view `apps/dashboard/src/app/operator-metrics.tsx`
> (route `/_ops/metrics`, `OperatorMetrics`), and the existing `MetricsAggregate` type +
> `fetchMetrics()` client in `libs/api/src/lib/gammaflow.ts`. Copy + states only — no server
> internals, no math, no payload-schema decisions beyond naming the fields consumed from the
> **existing, unchanged** `GET /api/_metrics`.

## Binding design principles (from both contracts)
- **Operator-only, off every trader route.** Lives on `/_ops/metrics`; never linked from the trader
  UI; the **only** network call is the existing read-only `GET /api/_metrics`. No control may trigger
  a vendor fetch, recompute, cache mutation, or any trader-route call.
- **Frontend-only, $0, stateless.** No backend change; recharts already ships; the series is an
  in-browser bounded ring buffer. No new dependency, no server state.
- **Honest over precise (mandatory):** empty → a **gap / "no data"** (never blank, never 0, never a
  crash); stale-repeat is **visually distinct** from a real measurement; a failed poll **keeps the
  last series** behind a soft notice (no error page, no retry storm); a restart **breaks the line**
  (never stitched); vendor headroom is **"unknown"** under the current vendor (never fabricated).
- **The "windowed snapshot, not per-request" caveat is visible & persistent** — not tooltip-only.
- **Ephemerality is expected**, never framed as data loss or a false "saved" state. The only save is
  the explicit local Export.
- **Non-alerting throughout** — high latency / low headroom shown factually; no thresholds, no
  breach/alert framing, no semantic red-for-bad.

## Layout — where it sits and where each datum surfaces
The trend is a **new card at the TOP of the existing `OperatorMetrics` view** (the live,
watch-while-tuning surface); the existing snapshot tables stay **below** as the point-in-time detail.
**One poll loop feeds both** — the trend's cadence is the page's single fetcher; the snapshot tables
render from the latest poll (keeps "only `GET /api/_metrics`," no double-fetch).

```
/_ops/metrics  (operator AppBar · read-only · Instrumentation: ON/OFF)
┌── Latency trend ─────────────────────────────────────────────── ⓘ ──┐
│ [Metric ▾ Stages] [Pctl ▾ p95] [Scope ▾ Global] [Horizon ▾ 15m]      │
│ [Cadence ▾ 5s] [⏸ Pause] [⤓ Export]        live ● · 142 samples       │
│ legend (Stages only): ● vendor_fetch ● engine_build ● off_exchange    │
│                       ● signals ● persist ● serialize_wrap  (click=hide)│
│ ┌───────────────────────────────── chart ──────────────────────────┐ │
│ │  y = ms (latency) | % (hit-ratio) | calls (headroom)             │ │
│ │  x = wall-clock; broken line at restarts; gaps at no-data         │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ ⚠ caveat (persistent): windowed percentile as of each time, NOT per-  │
│   request. · Live in-browser only — clears on reload; Export to keep.  │
│   · Shown factually — no thresholds or alerts.                        │
└───────────────────────────────────────────────────────────────────────┘
── Global roll-up (existing snapshot table) ──
── Per-ticker (existing) ── Recent traces (existing) ──
```

## Controls (spec + copy)
| Control | Options (default) | Behavior / copy |
|---|---|---|
| **Metric** | `Stages (six lines)` (default) · `Total latency` · `Cache hit-ratio` · `Vendor latency` · `Vendor headroom` | Picks the charted family. Stages = six comparable lines; the rest = one line. |
| **Percentile** | `p50` · **`p95`** · `max` | Applies to **latency** metrics (Stages, Total, Vendor latency). **Hidden/disabled** for Cache hit-ratio and Vendor headroom. **Vendor latency** has only p50/p95 → `max` shows a gap + note `vendor latency reports p50/p95 only`. |
| **Scope** | **`Global`** · `<ticker>` (those present in `per_ticker`) | One scope active; series is per (scope, metric). A ticker absent from the latest poll isn't selectable. |
| **Horizon** | `5m` · **`15m`** · `30m` | Visible/retained window. Series is a ring buffer capped by **age AND sample-count** (count cap is the hard memory guarantee); 30m is the max retained. |
| **Cadence** | `2s` · **`5s`** · `10s` · `30s` | Poll frequency. **Faster ≠ more data** — polling faster than the server window advances re-observes the same window (those samples tag stale-repeat). Recommended: **auto-pause when the tab is hidden**. |
| **Pause / Resume** | — | Pause **freezes the series and stops polling**; Resume continues appending. |
| **Export** | — | Downloads the **current accumulated series** locally (JSON). One-way out; **no server state**; no import this phase. |
| **Stage show/hide** | six chips, all on | Only when Metric = Stages. Click a stage chip to hide its line so a dominant `vendor_fetch` doesn't crush the small CPU stages. |

## Metric → consumed-field mapping (from each `MetricsAggregate` poll; nothing reshaped)
`scope` = `global` or `per_ticker[ticker]`. `pctlField` = {p50→`p50_ms`, p95→`p95_ms`, max→`max_ms`}.
| Metric | Per poll, plots | Unit | No-data when |
|---|---|---|---|
| Stages (six) | `scope.stages[stage][pctlField]`, one line per `stage` | ms | that stage's `count === 0` |
| Total latency | `scope.latency_total[pctlField]` | ms | `latency_total.count === 0` |
| Cache hit-ratio | `scope.cache.hit_ratio` (×100 if ≤1) | % | scope absent |
| Vendor latency | `scope.vendor.latency_p50_ms` / `latency_p95_ms` (no max) | ms | value null |
| Vendor headroom | `scope.vendor.min_rate_limit_headroom.remaining` | calls | `min_rate_limit_headroom === null` ⇒ **unknown** |

**Liveness/identity markers read every poll** (drive the tags, not plotted): `instrumentation_enabled`,
`window.request_count`, `window.uptime_seconds`.

## Component states (each → trigger → appearance → exact copy)
Per-sample tag is derived each poll; chart-level states layer on top. **All copy verbatim.**

| State | Trigger | Appearance | Copy |
|---|---|---|---|
| **Live-accumulating** (default) | instrumentation on, `request_count` advanced, not a restart | A new solid point extends each visible line; `live ●` chip + sample count. | `live ●` · `Last {horizon} · {n} samples · in memory` (append `· oldest drop at the cap` once capped) |
| **Cold / instrumentation-off / empty** | `instrumentation_enabled === false`, or scope/metric `count === 0` | Chart keeps axes/grid (never blank); the line shows a **gap** (null break) for the no-data span; centered placeholder. Recovers automatically. | off: `No data — instrumentation is off.` · empty: `No data yet — serve a bundle to start the trend.` |
| **Stale-repeat (no new traffic)** | `window.request_count` unchanged vs the previous poll | The sample renders as a **hollow grey dot**; a run of them is a **dashed/greyed flat segment**; a chip shows while the latest sample is stale. | chip: `No new traffic` · caption: `The window hasn't advanced, so these points repeat the last measurement — not steady latency.` |
| **Failed / timed-out poll** | `fetchMetrics()` rejects | **Keep the prior series** unchanged; a soft chip (not an alert/error, no red page). Self-heals next interval; **no retry storm** (wait for the next poll). | `Couldn't refresh — keeping the last trend, retrying on the next poll.` |
| **Restart discontinuity** | `uptime_seconds`/`request_count` **reset (decrease)** vs previous | The line **breaks** (null) at the boundary; a **dashed vertical marker** at that timestamp. Never stitch the new window onto the old. | marker: `Service restarted` · hover: `The server window reset — the trend breaks here rather than stitching a new window onto the old.` |
| **Vendor headroom unknown** | Metric = Vendor headroom and `min_rate_limit_headroom === null` | No line; a persistent banner in the chart area (gap, never a number). | `Vendor rate-limit headroom: unknown — the current vendor (Massive) doesn't report it. This chart populates for a vendor that does.` |
| **Ticker dropped from window** | selected scope ticker absent from latest `per_ticker` | New samples = no-data **gap**; the earlier line is **kept**; a chip. Switching to Global restores immediately. | `No recent traffic for {ticker} — it left the window. The earlier line is kept.` |
| **Paused** | operator Pause (or tab-hidden auto-pause) | Series frozen, polling stopped; `Paused` chip; on resume, appends continue. | `Paused — polling stopped; the trend is frozen. Resume to continue.` · auto: `Auto-paused while the tab was hidden.` |
| **Exported** | operator Export | Local file downloads; brief inline confirmation. No server state. | `Exported the current trend ({n} samples). Saved to your machine — no server state created.` |

## Persistent copy (always visible — not tooltips)
- **Binding caveat (under the chart, persistent):**
  `Each point is the windowed percentile as of that time — not a per-request latency. Points overlap
  because the server's window slides; read it as a sequence of smoothed snapshots.`
- **Ephemerality (near the title/controls, persistent):**
  `Live, in-browser only — this trend clears when you reload or leave. That's expected; use Export to
  keep a run.`
- **Non-alerting (with the caveat, persistent):**
  `Shown factually — no thresholds, no alerts. A high line or low headroom is information, not a
  warning.`
- **Title ⓘ tooltip (supplementary):** `Polls the read-only /api/_metrics on your cadence and trends
  each windowed snapshot locally. Read-only and side-effect-free — it never triggers a fetch,
  recompute, or cache change.`

## Visual rules (non-alerting + honest)
- Stage lines use a **categorical, non-semantic palette** (no red-for-bad, no green-for-good);
  colorblind-distinguishable; the legend chip color matches the line.
- **Gaps** = broken line (null y); **never** plot 0 or interpolate across a gap/restart.
- **Stale-repeat** = hollow grey markers + dashed/greyed connector, distinct from solid live points.
- **No threshold lines, no red zones, no "breach" coloring** anywhere.
- Y-axis unit follows the metric (ms via the existing `fmtMs`; % for hit-ratio; "calls" for headroom).

## Consumed-field naming (UI reads from the existing `/api/_metrics`; nothing new)
- Top: `instrumentation_enabled`; `window.{size_desc, uptime_seconds, request_count}`.
- Scope (`global` | `per_ticker[ticker]`): `latency_total.{p50_ms,p95_ms,max_ms,count}`;
  `stages[].{stage,kind,p50_ms,p95_ms,max_ms,count}`; `cache.{hit_ratio}` (+ existing hits/misses/age
  for the tables); `vendor.{latency_p50_ms,latency_p95_ms,min_rate_limit_headroom}`.
- **Client-only (FE-owned, ephemeral, serializable — per ARCHITECTURE):**
  `MetricSample { client_ts, scope, values{…per line…}, instrumentation_enabled, request_count,
  uptime_seconds, tag: 'live'|'cold'|'stale_repeat'|'restart'|'headroom_unknown' }`;
  `RollingClientSeries` = bounded ring buffer of MetricSamples per (scope, metric), capped by count+age.
- The UI reads **nothing** from any trader/bundle route; it issues **only** `GET /api/_metrics`.

## Acceptance-criteria → state map
| PRODUCT_CONTRACT acceptance criterion | Satisfied by |
|---|---|
| Trend extends over time as it polls; reachable only on the operator route | Layout (on `/_ops/metrics`) + Live-accumulating |
| Default = per-stage p95, six stages, global; switching pctl to p50/max changes all stage lines | Controls (Metric=Stages default, Pctl=p95 default) + Metric→field mapping |
| Can chart total latency, cache hit-ratio, vendor latency; headroom shows "unknown", non-alerting | Metric selector + Vendor-headroom-unknown + Non-alerting copy |
| Stage lines show/hide so a dominant stage doesn't crush others | Stage show/hide control |
| Scope→ticker charts that ticker; back→global; ticker leaving window → no-data, prior line kept | Scope control + Ticker-dropped-from-window |
| Cadence changes frequency; Pause freezes+stops; Resume appends | Cadence + Pause/Resume |
| Horizon changes visible history; series never grows unbounded | Horizon control (ring buffer count+age cap) |
| Instrumentation OFF / cold-empty → gap/"no data" (not blank/0/crash), recovers | Cold/instrumentation-off/empty |
| No new requests between polls → samples marked "no new traffic", visually distinct | Stale-repeat |
| Failed poll → soft "couldn't refresh", keep series, self-heal, no error page / no retry storm | Failed/timed-out poll |
| Backend restart → discontinuity (broken line), not stitched | Restart discontinuity |
| Persistent visible caveat: windowed percentiles, not per-request | Persistent caveat copy |
| Reload/navigate-away clears the series, communicated as expected (not data loss) | Ephemerality copy + Paused/Exported framing |
| Export downloads current series, no server state; page issues only GET /api/_metrics | Export + Consumed-field naming (single endpoint) |
