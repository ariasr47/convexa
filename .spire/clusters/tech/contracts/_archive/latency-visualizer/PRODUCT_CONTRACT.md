# PRODUCT CONTRACT — Latency Visualizer (local, $0 pipeline-latency trend)

> Producer: Product Manager (Session 2, **after** the Architect). Consumer: UX/Tech-Writer (next).
> Input: GAMMAFLOW_CONTEXT.md + latency-visualizer/ARCHITECTURE_CONTRACT.md (+ BRIEF.md, OPEN_THREADS
> §6/§9). No chat history. Lane: user stories, scope, dashboard behavior, acceptance criteria — the
> product layer on the Architect's locked shape. **No UI layout, no endpoints, no code, no math.**

## Feature & user value (goal derived from the Architecture contract — not re-scoped)
The shipped operator route `/_ops/metrics` shows **snapshot tables** of the bundle pipeline's stage
latencies (a rolling-window p50/p95/max/count per stage, cache hit/miss, vendor latency) with **no
time axis**. This feature adds the **time dimension**: a **local, $0, operator-only trend** that the
frontend builds by polling the existing **read-only** `GET /api/_metrics` on an operator cadence and
appending each snapshot to a **bounded in-browser time series**, then charting it. **Stateless — no
backend change, no new dependency, no external/paid APM.**

The value is a single operator decision while tuning **pre-live**: *"which stage do I optimize
next?"* — watch a stage's p95 line move on a chart as code changes and the service is re-hit, at
$0 cost. The series is **ephemeral** (lives only while the operator view is mounted; cleared on
reload/navigate-away) — that is **expected behavior**, matching the in-session tuning use case, not a
defect.

## Who it's for
**The operator only** (the developer tuning the service). It lives entirely on `/_ops/metrics`, OFF
every trader/bundle route, is **not linked** from the trader dashboard, and its **only** network call
is the existing read-only `GET /api/_metrics`. It never touches a trader path, the bundle cache, or
SSE; it triggers no vendor fetch, recompute, or cache mutation.

## User stories
- As the operator tuning pre-live, I want to **watch each pipeline stage's latency as a line over
  time** so I can see which stage (`vendor_fetch` · `engine_build` · `off_exchange` · `signals` ·
  `persist` · `serialize_wrap`) is the bottleneck right now.
- As the operator, I want to **switch the percentile** (p50 / p95 / max) so I can chase tail latency
  (p95/max) or typical cost (p50).
- As the operator, I want to also trend **total latency**, **cache hit_ratio**, and **vendor
  latency** so I can tell whether a latency change is my code, cache behavior, or the vendor.
- As the operator, I want to **focus a specific ticker or the global aggregate** so I can see
  per-ticker cost (chain size differs) vs the overall picture.
- As the operator, I want to **set the poll cadence and pause/resume** so the chart keeps pace with
  how fast I'm iterating without me babysitting it.
- As the operator, I want a **bounded, recent time window** so a long session never grows memory
  unbounded and the chart stays readable.
- As the operator, I want **honest empty/failed/restart states** — a gap when there's no data, a soft
  notice on a failed poll, and a visible break when the service restarts — so I never misread the
  trend.
- As the operator, I want it made unmistakable that each point is **the windowed percentile as of
  that time, not a per-request latency**, so I don't over-interpret the line.
- As the operator, I want to **export the current trend** to a local file so I can compare a tuning
  run before/after without any server or paid tool.

## Scope
**In (this phase):**
- A **trend chart** on `/_ops/metrics` accumulated client-side from polled `GET /api/_metrics`
  snapshots (bounded in-browser series; ephemeral).
- **Charted metrics** (Q1): per-stage latency for all **six stages** at a **selectable percentile**
  (p50/p95/max), plus **total latency**, **cache hit_ratio**, and **vendor latency**; **vendor
  rate-limit headroom** is selectable but expected "unknown" under the current vendor.
- **Selectable scope** (Q2): **global** (default) or a specific per-ticker entry present in the
  readout.
- **Bounded, operator-selectable time horizon** (Q3) with a hard memory cap.
- **Operator-adjustable, pausable poll cadence** (Q4).
- **Local export/download** of the accumulated in-browser series (Q5) — the only persistence
  affordance.
- **Honest state handling** (Q6): cold/disabled, stale-repeat, failed-poll, restart-discontinuity,
  and the binding "windowed-snapshot, not per-request" caveat.
- **Non-alerting** visualization only.

**Out (this phase / non-goals — restated from the Architecture, do not reopen):**
- **No backend change** — no new endpoint; no change to `/api/_metrics`, the `MetricsAggregate`, the
  rolling-window size, instrumentation capture, or sampling. Pure consumer.
- **No server-side persistence / cross-restart / cross-deploy / cross-session history** (future seam).
- **No import/replay** of an exported file back into the chart (export is one-way out, this phase).
- **No external/paid APM, hosted dashboard, or new runtime dependency** (recharts already ships).
- **No alerting/thresholds** on latency or headroom (future-dated in the observability line).
- **No per-request raw-latency reconstruction** (source is windowed percentiles only).
- **No trader-path/SSE involvement**, no recompute trigger, no change to any computed value.
- UI layout, component naming, endpoint/field names, and copy (UX/Interface own those).

**Future-dated (named, deferred — design must not preclude):**
- Server-side persisted/cross-restart latency baselines (the Architect's isolated persistence seam;
  reuse the MetricSample shape so the client series becomes the in-memory tier).
- Import/replay of an exported series for before/after comparison.
- Latency/headroom alert thresholds; OTel/Prometheus export; the multi-ticker scanner.

## Product decisions made here (resolving the Architect's open questions, in order)

### Q1 — Which stages/metrics to chart
- **Primary view: per-stage latency over time for all six stages** (`vendor_fetch`, `engine_build`,
  `off_exchange`, `signals`, `persist`, `serialize_wrap`) as comparable lines, at **one selectable
  percentile** — **default p95** (bottleneck/tail hunting), switchable to **p50** (typical) or
  **max** (worst case). One percentile is shown across all stages at a time so the lines compare.
- **Additional selectable metrics:** **total latency** (`latency_total`, same percentile control),
  **cache hit_ratio**, and **vendor latency**. These give the "my code vs cache vs vendor" read.
- **Vendor rate-limit headroom:** **selectable but expected "unknown"** with the current vendor
  (Massive surfaces no headroom → `min_rate_limit_headroom: null`, per §6). It is charted honestly as
  "unknown," never fabricated, and stays useful for a future vendor that reports it.
- Stage visibility is **operator-togglable** (show/hide individual stage lines) so a dominant
  `vendor_fetch` line doesn't crush the smaller stages — but **what** is togglable is product intent;
  the exact control is UX's.

### Q2 — Scope (global / per-ticker / selectable)
- **Selectable, default global.** The operator can switch to any **ticker currently present in the
  readout's per_ticker section**. One scope is active at a time (the series is per (scope, metric)).
- If the selected ticker **drops out of the window** (no recent traffic so it leaves `per_ticker`),
  treat it as a **no-data/stale** state for new samples (Q6), not an error; the prior line is kept.

### Q3 — Time horizon / retention
- The in-browser series is a **bounded ring buffer**, capped by **both age and sample count** so a
  long session cannot grow memory unbounded (the count cap is the hard guarantee regardless of
  cadence).
- **Operator-selectable horizon: {5, 15, 30 minutes}, default 15 minutes.** 30 minutes is the
  maximum retained.
- The series is **ephemeral**: cleared on navigate-away / reload. This is **expected** and must be
  communicated as such (not framed as data loss). Export (Q5) is the way to keep a run.

### Q4 — Live-poll cadence
- **Operator-adjustable: {2s, 5s, 10s, 30s}, default 5s**, and **pausable** (pause freezes the series
  and stops polling; resume continues appending).
- **Cadence is responsiveness, not data density:** polling faster than the server window advances just
  re-observes the same window — those samples are tagged **stale-repeat** (Q6), not plotted as new
  movement. Recommended (not mandated): **auto-pause when the operator tab is hidden** to avoid
  pointless polling.

### Q5 — Persistence in scope?
- **No server persistence.** The **only** persistence affordance is a **manual local export/download**
  of the **current accumulated in-browser series** to a file (the $0 stop-gap the Architecture's
  MetricSample shape was designed to allow). It creates **no server state** and is operator-initiated.
- **Import/replay of an exported file is OUT** this phase (future-dated). Export is one-way out.

### Q6 — State presentation (behavior; copy/visual is UX's) + the binding caveat
- **Cold / instrumentation-disabled / empty section** (`instrumentation_enabled=false` or empty) →
  record a **no-data point**; the chart shows a **gap/placeholder** with a clear "no data /
  instrumentation off" indication. **Never blank, never crash.** Recovers when data appears.
- **Stale-repeat** (`window.request_count` unchanged since the last poll ⇒ no new traffic) → the
  sample is **marked "no new traffic,"** visually distinct from a genuine measurement, so a flat line
  reads as *"nothing was served,"* not *"latency held steady."*
- **Failed / timed-out poll** → **skip that interval, keep the prior series**, surface a soft
  "couldn't refresh" indicator, **self-heal on the next scheduled poll. No retry-storm** (wait for the
  next interval).
- **Window restart mid-session** (`uptime_seconds`/`request_count` reset ⇒ backend restarted) → a
  **discontinuity marker** that **breaks the line** rather than stitching a fresh window onto the old
  one (honest trend).
- **Binding honesty caveat (must be visible, persistent):** each sample is **"the windowed percentile
  as of time T, NOT a per-request latency."** Consecutive samples overlap because the server window
  slides; the chart is a **sequence of smoothed windowed snapshots**. The view must **not** suggest
  per-request/per-event latencies can be read off it.

## Behavior rules
- The trend **accumulates live** while the operator view is mounted: with traffic flowing, each
  successful poll extends the chosen lines by one point.
- **Read-only, side-effect-free:** the view's only call is `GET /api/_metrics`. Nothing on the view
  may trigger a vendor fetch, a recompute, a cache change, or any call to a trader route. There is no
  "refresh ticker" affordance that hits the trader path.
- **Honest over precise:** empty → "—"/gap (never 0), headroom null → "unknown" (never a fabricated
  number), stale-repeat ≠ measurement, restart = break (never a stitched line).
- **Non-alerting:** low headroom or high latency is shown **factually**, never as an alert/threshold
  breach.
- **$0 / local / stateless:** no server state is created by anything on this view (export writes only
  to the operator's machine).

## Binding constraints the next role (UX/Tech-Writer) must not violate
- **Operator-only, off trader routes.** Keep it on `/_ops/metrics`; **never** link or surface it in
  any trader/bundle view; never add a control that calls a trader route or triggers a fetch/recompute.
- **The "windowed snapshot, not per-request" caveat must be visible and unmissable** — not buried in a
  tooltip-only afterthought.
- **Honest states are mandatory:** gap (not blank/0) for cold/empty; stale-repeat visually distinct
  from real measurements; failed-poll = keep-last + soft notice (no error page); restart = broken line
  (no stitching); headroom = "unknown" under the current vendor.
- **Ephemerality is expected, not an error** — copy must set that expectation (series clears on
  reload/navigate-away); do not present it as data loss or offer a false "saved" impression. The only
  save is the explicit local export.
- **Non-alerting** — no threshold/alert framing for latency or headroom.
- **No new dependency / external service** — chart with what already ships.

## Amendments bounced to Architect
**None.** Every product outcome above is supported by the locked technical shape: selectable
stage/percentile/metric/scope, the bounded horizon, the adjustable/pausable cadence, the
stale-repeat/restart/failed-poll states, and the local export are all **client-side reductions of the
existing read-only readout** — the Architecture explicitly anticipated the serializable MetricSample
and the local export as the $0 persistence option. No technical-shape change is required.

## Acceptance criteria (each observable without reading code)
- [ ] On `/_ops/metrics`, with traffic flowing, a **trend chart extends over time** as it polls — each
      successful poll adds a point; the view is reachable only on the operator route, never from a
      trader view.
- [ ] The default view shows **per-stage p95 latency for all six stages (global scope)**; switching
      the percentile to **p50** or **max** changes all stage lines accordingly.
- [ ] The operator can also chart **total latency, cache hit_ratio, and vendor latency**; selecting
      **vendor rate-limit headroom** shows **"unknown"** under the current vendor (not a fabricated
      value) and is **non-alerting**.
- [ ] Individual **stage lines can be shown/hidden** so a dominant stage doesn't crush the others.
- [ ] Switching **scope to a specific per-ticker entry** charts that ticker's series; switching back
      restores **global**. If the selected ticker leaves the window, new samples show a **no-data/
      stale** state while the prior line is kept (no error).
- [ ] Changing **cadence** (2s/5s/10s/30s) changes poll frequency; **pause** freezes the series and
      stops polling; **resume** continues appending.
- [ ] Changing the **time horizon** (5/15/30 min) changes how much history is visible; the series
      **never grows unbounded** (old samples drop at the cap) regardless of cadence or session length.
- [ ] With **instrumentation OFF or a cold/empty window**, the chart shows a **gap / "no data"** state
      (not a blank, not 0, no crash) and **recovers** when data appears.
- [ ] When **no new requests occur between polls**, the new samples are marked **"no new traffic"**
      (stale-repeat) and are **visually distinct** from genuine measurements.
- [ ] A **failed poll** shows a soft **"couldn't refresh"** notice, **keeps the existing series**, and
      **self-heals** on the next successful poll — no error page, no retry storm.
- [ ] When the **backend restarts mid-session** (uptime/request_count reset), the chart shows a
      **discontinuity (broken line)**, not a stitched continuous line.
- [ ] A **persistent, visible caveat** states the chart shows **windowed percentiles as of each
      timestamp, not per-request latencies**.
- [ ] **Navigating away / reloading clears** the in-browser series, and this is communicated as
      expected behavior (not an error / not "data lost").
- [ ] **Export** downloads the **current accumulated series** to a local file; it creates **no server
      state**; across all of the above the page issues **only `GET /api/_metrics`** (no trader-route,
      vendor, recompute, or cache calls).
