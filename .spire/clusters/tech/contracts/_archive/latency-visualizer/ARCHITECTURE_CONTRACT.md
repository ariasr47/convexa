# ARCHITECTURE CONTRACT — Latency Visualizer (local, $0 pipeline-latency trend)

> Producer: Architect (this session, Architect-first). Consumer: PM (next session).
> Reader has only `.claude/GAMMAFLOW_CONTEXT.md` + `BRIEF.md` + this file. No chat history.
> Lane: data-structure *content*, data-flow, component boundaries, isolation/error rules, non-goals.
> **No UI/layout, no endpoint signatures, no payload/JSON field names, no copy.**

## Goal
Turn the snapshot stage *tables* the shipped backend observability exposes (`GET /api/_metrics`,
surfaced on the operator route `/_ops/metrics`) into a **trend the operator can watch live while
tuning the service pre-live** — per-stage p50/p95/max across `vendor_fetch` · `engine_build` ·
`off_exchange` · `signals` · `persist` · `serialize_wrap`, plus cache hit/miss and vendor latency.
**Strictly local, $0:** no external/paid APM, no hosted dashboard, no new dependency.

## Pivotal decision — STATELESS / CLIENT-ACCUMULATED (chosen) vs server-side persistence
**Decision: stateless / client-accumulated. The server gains NO storage surface.**

The shipped `/api/_metrics` readout is a **rolling-window snapshot with no time axis** — it reports
the *current* windowed p50/p95/max/count per stage, cache hit/miss/ratio/age, and vendor
latency/headroom (`global` + `per_ticker`, plus `recent_traces`), and resets on restart. A **trend**
is therefore precisely *a sequence of these snapshots stamped over wall-clock* — which a client
poller accumulates natively. The FE polls the existing read-only endpoint on an operator cadence and
appends each snapshot to a **bounded in-browser time series**; the chart renders that series.

**Why stateless wins (and directly serves the $0 pre-live constraint):**
- **Zero new backend, zero new dependency, zero external service** — `/api/_metrics` already exists
  and is read-only/side-effect-free; the FE already ships a charting lib. Cost stays $0.
- **Honors the build invariants by construction** — no new server state (stateless-server /
  ephemeral-metrics, OPEN_THREADS §6 / GAMMAFLOW_CONTEXT §6), no new endpoint, no trader-path or SSE
  touch. The only network call is the existing operator metrics read.
- **Fits the actual use case** — "watch a stage's p95 line move as I change code" is a *live,
  in-session* observation while iterating, not a cross-day historical audit. The capability stateless
  gives up (cross-restart / cross-session history) is not required by the stated goal.

**The rejected alternative (server-side persistence for cross-restart history):** real but
**future**. It would add a store, a write path, retention/rotation policy, and a new failure surface
— violating the default-stateless envelope and adding complexity/cost for a capability pre-live
tuning doesn't need. Deferred as an isolated future seam (below), not built now.

## Binding constraints restated (must not be violated)
- **[operator-vs-trader-path-separation]** — the visualizer lives entirely on the operator surface
  (`/_ops/metrics`), **OFF every trader/bundle route**. Its sole network call is the existing
  **read-only, side-effect-free** `GET /api/_metrics`. It triggers **no** vendor fetch, recompute, or
  cache mutation, and adds **no** call to any trader route.
- **[best-effort-isolated-or-null]** — cold window / instrumentation OFF / empty section / failed
  poll → an honest **"—"/gap**, never a blank, never a crash, never a torn-down trend.
- **stateless-server / ephemeral-metrics** (OPEN_THREADS §6, GAMMAFLOW_CONTEXT §6) — this feature
  adds **no server state**. Any persistence is an explicit, isolated future decision, never on the
  trader/bundle path.
- **Metrics readout consumed as-is** — the visualizer does **not** change `/api/_metrics`, the
  `MetricsAggregate`, the rolling-window size, instrumentation capture, or sampling (all shipped,
  server-config). It is a pure consumer.
- **SSE stays uninstrumented / untouched.** The visualizer shares nothing with the live stream.
- **Computed values frozen.** The visualizer reads metrics only — no analytics/scoring/gate/
  fingerprint involvement.
- **Strictly local / $0** — no external/paid APM, no hosted dashboard, no new runtime dependency.

## Data structures (content only — names/JSON are downstream)
Consumed unchanged: the **existing `/api/_metrics` readout** (`instrumentation_enabled`; `window`
{size_desc, uptime_seconds, request_count}; `global` + `per_ticker` sections of {latency_total
p50/p95/max/count, per-stage rows in the fixed vocabulary, cache hits/misses/ratio/age, vendor
call_count/latency/min_rate_limit_headroom}; `recent_traces`). **This contract does not reshape it.**

New, **in-browser only** (no server, no persistence):
- **MetricSample** — one poll result reduced to what the trend needs: a **client-captured timestamp**
  (FE wall-clock at fetch), the `scope` it came from (`global` or a specific ticker), the extracted
  scalar(s) for the charted metric(s) (e.g. a stage's p50/p95/max, total latency, cache hit_ratio,
  vendor latency/headroom), and the **liveness/identity markers** `instrumentation_enabled`,
  `window.request_count`, `window.uptime_seconds`. The last three let a sample be tagged
  **cold/disabled**, **stale-repeat** (request_count unchanged ⇒ window didn't advance ⇒ same
  aggregate re-observed), or **post-restart** (uptime/request_count reset ⇒ window restarted).
- **RollingClientSeries** — a **bounded, append-only ring buffer** of MetricSamples per
  (scope, metric), capped by count and/or age (a client retention bound so a long operator session
  cannot grow memory unbounded). This *is* the trend the chart renders. Ephemeral: it lives only for
  the mounted operator view (cleared on navigate-away / reload — stateless on the client too).

**Correctness boundary (must be honored, flagged for downstream copy):** each sample is *"the
windowed percentile as of time T,"* not a per-request latency. Consecutive samples overlap because
the server window slides. The series is therefore a **sequence of smoothed windowed snapshots**; the
client must **not** attempt to reconstruct per-request/per-event latencies from it.

## Data-flow & component boundaries
- **One-way:** FE (operator view) **polls** `GET /api/_metrics` on an operator cadence → **reduces**
  each readout to MetricSample(s) → **appends** to the RollingClientSeries → **renders**. No
  write-back, no new endpoint, no server state.
- **Accumulation lifecycle:** runs only while the operator metrics view is active; unmount / reload
  clears the in-browser series. This ephemerality is **expected behavior**, not a defect.
- **Restart/advance awareness:** on a detected window restart (uptime/request_count reset) the series
  marks a **discontinuity** rather than stitching a fresh window onto the old line (honest trend); on
  an unchanged `request_count` the sample is tagged a stale-repeat (no new traffic), not a new datum.
- **Isolation:** the only dependency is the existing operator metrics read; nothing on the trader
  path, the bundle cache, or SSE is read or written.

## Isolation & error-handling rules ([best-effort-isolated-or-null])
- **Cold / disabled / empty** (`instrumentation_enabled=false` or empty section) → record a **no-data
  point**; the chart shows a gap/placeholder; never blank or crash.
- **Failed / timed-out poll** → skip that interval, **keep the prior series**, surface a soft
  "couldn't refresh" indicator; self-heal on the next successful poll. **No retry-storm** — wait for
  the next scheduled interval.
- **Window restart mid-session** → discontinuity marker (above), never a dishonest stitched line.
- **Memory-bounded** — the ring buffer cap guarantees a long session cannot grow unbounded.
- The visualizer can **never** turn the operator page into an error or affect any other surface.

## Non-goals (out of scope)
- No UI/layout, endpoint signatures, payload/JSON field names, or copy.
- **No new backend endpoint; no change to `/api/_metrics`, the `MetricsAggregate`, the rolling-window
  size, instrumentation capture, or sampling.**
- **No server-side persistence / cross-restart / cross-deploy history** (future seam below).
- No external/paid APM, hosted dashboard, or new runtime dependency.
- No reconstruction of per-request raw latencies (source is windowed percentiles only).
- No alerting/thresholds (already future-dated in the observability line).
- No trader-path or SSE involvement; no recompute trigger; no change to computed values.

## Future-dated seam (persistence — explicitly deferred, design must not preclude)
If cross-restart/cross-deploy historical baselines are later wanted, add a **separate, opt-in,
isolated** surface that **must**: stay off the trader/bundle path, leave the live ephemeral readout
unchanged, and **reuse the MetricSample shape** so the stateless client series becomes the in-memory
tier over a persisted tier (no rework of the trend logic). A **client-side local export/download** of
the accumulated series is a plausible $0 stop-gap that needs no server state — but whether to offer it
is a PM/UX call (flagged below), not built here. Designing MetricSample/RollingClientSeries to be
serializable now is the seam; persistence itself is not in scope.

## Open questions for the PM (downstream)
- **Which stages/metrics to chart** — all six stages? p50 vs p95 vs max? total latency? cache
  hit_ratio? vendor latency / rate-limit headroom?
- **Scope** — global, per-ticker, or selectable (the readout offers both).
- **Time horizon / retention** — how many samples (and/or how long) the in-browser series keeps.
- **Live-poll cadence** — value, and whether operator-adjustable / pausable.
- **Persistence in scope at all?** Default **no**; if any, a **local export/download** of the
  accumulated series is the $0 option — confirm in/out.
- **State presentation** — how cold/disabled, stale-repeat, failed-poll, and restart-discontinuity
  states are surfaced (copy/visual), including the "windowed-snapshot, not per-request" caveat.
