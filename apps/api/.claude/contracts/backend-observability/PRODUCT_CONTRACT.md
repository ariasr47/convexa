# PRODUCT CONTRACT — Backend Observability (operator performance baseline)

> Producer: Product Manager (Session 2, **Architect-first flow** — runs second; input is
> `ARCHITECTURE_CONTRACT.md`). Consumer: UX/Tech-Writer (next), then Interface/Backend/Frontend.
> Reader has only `.claude/GAMMAFLOW_CONTEXT.md` + `ARCHITECTURE_CONTRACT.md` + this file.
> Lane: user value, scope, observable behavior, acceptance criteria, and **resolving the Architect's
> "open questions for the PM."** No code, math, UI layout, endpoints, or payload shapes.

> **Goal (derived from the ARCHITECTURE_CONTRACT, not separately set):** make the single-ticker
> bundle pipeline's performance observable to the **operator/developer** — a latency/cache/vendor
> baseline that surfaces bottlenecks and the safe fan-out headroom for the upcoming multi-ticker
> scanner (the dropped watchlist scan, Key decision #1) — **with no change to the trader experience
> and no change to any computed value.** The Architect set *what* is built (per-stage timing, a
> per-request trace, a rolling in-memory aggregate, structured correlatable logs, an optional vendor-
> metrics seam); this contract sets *what it must do for the operator* and how it behaves.

## Feature & user value
GammaFlow serves a rich single-ticker bundle but is a **black box on performance**: when a refresh
feels slow, nobody can say whether the time went to the vendor, the engine, the off-exchange pass, or
serialization — and nobody knows how close we run to the vendor's rate limit. This feature gives the
**operator** (the person running/scaling GammaFlow) a **read-only performance baseline**: per-stage
and total latency (p50/p95), cache hit/miss + data age, vendor call count + latency + remaining
rate-limit headroom, and a correlation id tying one request's logs, timings, and metrics together.
It is **operator/developer-facing only** — the trader dashboard is unchanged.

Net value: we can answer *where the time goes* and *how much fan-out headroom exists* **before**
building the multi-ticker scanner — turning that decision from a guess into a measured one — without
risking the trader-facing product.

## User stories
- As an **operator**, I want **total and per-stage latency (p50/p95)** for the bundle pipeline so I
  have a baseline and can see which stage dominates.
- As an **operator**, I want the **cache hit/miss ratio and data age** so I know how much load
  actually reaches the vendor versus is served warm.
- As an **operator**, I want **vendor call count, vendor latency, and remaining rate-limit headroom**
  so I know how close I run to throttling — and how much concurrency a future scanner can safely use.
- As an **operator**, I want each stage tagged **I/O-bound vs CPU-bound** so I can tell what's
  parallelizable/cacheable at fan-out versus what needs more compute.
- As a **developer debugging one odd/slow request**, I want a **correlation id (trace id)** that ties
  that request's structured logs, stage timings, and metrics together so I can trace it end-to-end.
- As an **operator**, I want metrics **per-ticker and rolled up globally**, so a future multi-ticker
  run aggregates cleanly.
- As an **operator**, I want to **enable/disable** instrumentation and the verbose per-stage detail
  via config, so I control overhead and response size.
- As the **product owner**, I want all of this **invisible and harmless to the trader**: never
  slowing the dashboard, never turning a good bundle into an error, never touching the live stream.

## Scope
**In (this phase):**
- Per-request **timing capture** across the six pipeline stages the Architect defined (vendor fetch,
  engine build, off-exchange, signals, persist, serialize/wrap), each carrying an **I/O- vs CPU-bound
  tag** and an ok/error/skipped status.
- A per-request **trace** with a **correlation id**, the request's filter dimensions, cache hit/age,
  total latency, the stage timings, and the vendor-call metrics.
- A **rolling, in-memory metrics aggregate**: per-stage + total **p50/p95** (plus count and max),
  **cache hit/miss counts + ratio**, **vendor call count + latency + minimum rate-limit headroom
  observed** — available **globally and broken down per ticker**.
- A **read-only operator metrics readout** exposing that aggregate.
- **Structured, correlatable logs** carrying the trace id, additive to the existing human-readable
  logs (request-level summary plus optional per-stage detail).
- **Config controls**: an on/off switch for instrumentation (default **on**) and a request-level
  **verbose/debug** switch for the per-stage breakdown in a response's metadata (default **off**).

**Out (this phase):**
- **Any trader-facing dashboard change** beyond an optional, default-off correlation id / timing
  block in response metadata. No latency/headroom numbers in the trader view.
- **Automated alerting or latency/headroom thresholds** (read-for-humans only this phase).
- **External metrics backends/exporters** (OpenTelemetry, Prometheus, etc.).
- **Cross-restart persistence / historical baselines** — the aggregate is ephemeral (resets on
  restart).
- **SSE / live-path instrumentation** of any kind.
- **Per-contract or per-tick** granularity; **request sampling**.
- **The multi-ticker scanner itself** (this only produces the baseline it will need).
- Data structures, math, endpoints, payload/field names, UI layout (Architect/Interface/UX/Eng own
  these).

**Future-dated (named, explicitly deferred — design must not preclude):**
- **OpenTelemetry / Prometheus export** of the same traces/metrics.
- **Automated latency + rate-limit-headroom alerts** with operator-set thresholds.
- **Persisted historical baselines** for trend/regression tracking across deploys.
- **The multi-ticker scanner** consuming this baseline (per-stage roll-up, headroom-bounded fan-out).
- **Sampling** under high request volume.

## Product decisions made here (resolving the Architect's open questions)
Answered in the Architect's order:
1. **trace id + per-stage timing in the response metadata** → **trace id: yes, always present**
   (cheap, enables correlation). **Per-stage timing breakdown: present only when the request sets the
   verbose/debug switch** (default off), so normal responses stay lean and the trader FE sees no
   internals. Exact placement/shape is Interface's call.
2. **A metrics-readout surface** → **Yes — a dedicated read-only operator readout** of the rolling
   aggregate. It must be **read-only and side-effect-free**: reading it **never triggers a vendor
   fetch, never mutates the bundle cache, never affects the bundle path.** Endpoint design is
   downstream.
3. **Window / percentiles / per-ticker vs global** → Rolling window is **operator-configurable with a
   sensible default** (a recent window, e.g. last ~15 min or ~500 requests — exact default is config,
   not set here). Expose **p50 and p95** (plus **count** and **max**). Provide **both per-ticker and a
   global roll-up** (per-ticker is required for the scanner).
4. **Sampling / env flag** → **No sampling in v1** (single-ticker, low volume; overhead is
   negligible). Instrumentation sits behind an **env flag defaulting ON**, disableable. The verbose
   per-stage response detail is a **separate request switch, default OFF**.
5. **Log sink / format / verbosity / OTel** → Structured logs go to the **existing stdout logger** as
   machine-parseable lines **carrying the trace id**, **additive** to (not replacing or doubling) the
   current human-readable lines. **Request-level summary at INFO; per-stage detail at DEBUG.**
   External OTel/Prometheus is **future**, not this phase.
6. **Latency/headroom alert thresholds** → **No automated alerting/thresholds in v1.** Metrics are
   surfaced for human reading; thresholds + alerts are **future-dated**.
7. **Surface normalized rate-limit headroom to operators** → **Yes**, surface the **minimum
   rate-limit headroom observed** in the readout (load-bearing for safe scanner fan-out). It is
   **best-effort**: vendors that don't expose it report **unknown/null**, never an error.

## Amendments bounced to Architect
**None.** The technical shape supports every product outcome in this contract (operator baseline,
per-ticker roll-up, vendor headroom, end-to-end correlation, config gating, best-effort isolation).
No acceptance criterion here requires reopening the Architect's constraint envelope or non-goals.

## Dashboard / operator-view behavior
- The metrics readout is **operator-facing and read-only**; the **trader dashboard is unchanged**.
- It presents **null/"unknown" gracefully** when no requests have been served yet, or when a value
  (e.g. rate-limit headroom) isn't available from the vendor — never a fake or zeroed number
  presented as real (honest-data invariant).
- It reflects the **current rolling window** and **resets on process restart** (ephemeral baseline).
- A **cache-hit** request is visibly distinguishable from a **cache-miss** (hit flag + near-zero
  compute), so warm vs cold cost is never conflated.

## Behavior rules
- **Best-effort + isolated:** any instrumentation failure is swallowed — the bundle serves normally
  with the affected metric/span simply **missing**; an instrumentation error **never** turns a 200
  into an error and **never** blanks or degrades any served value.
- **Hot path not meaningfully slowed:** with instrumentation on vs off, the trader sees **no
  meaningful latency difference**; capture is stage-level only, and aggregation/log emission happen
  off the response-critical path.
- **SSE untouched:** the live stream gets **no instrumentation, no added latency, no new failure
  surface.**
- **Computed outputs frozen:** no change to any GEX/greeks/flip/DEX/Vol-OI/skew/term/signals/score
  value, to cache TTL/keys, or to dark-pool semantics.
- **Correlation:** one request → one trace id, appearing in its structured logs and (when verbose)
  its response metadata and the readout, so a single request is traceable end-to-end.
- **Config honored:** when instrumentation is **disabled**, the bundle serves identically and **no
  metrics are recorded**; the verbose per-stage response detail appears **only** when its switch is on.

## Binding constraints from GAMMAFLOW_CONTEXT + Architect (next role must not violate)
- **Operator/developer audience only.** Do **not** surface latency percentiles, vendor headroom, or
  internal stage timings in the **trader** dashboard — keep the trader view focused (the same
  anti-noise discipline behind the over-trading guard). Trader-facing exposure is limited to an
  optional, default-off trace id / timing block in response metadata.
- **Best-effort, isolated, never an HTTP error, never slows the hot path, never touches SSE.**
- **No change to computed outputs, cache semantics, gamma sourcing, rates/DTE scope, signals/score,
  or dark-pool-is-context.**
- **Stateless server / ephemeral metrics.** No new persistence; the aggregate is process-local and
  resets on restart.
- **Vendor-agnostic + honest data.** Rate-limit headroom (and any vendor-only metric) is best-effort;
  when a vendor doesn't expose it, present **unknown/null**, never a fabricated value and never an
  error.
- **Read-only readout.** The metrics surface must never trigger a compute/vendor call or mutate the
  bundle cache.

## Acceptance criteria (each observable without reading code)
**Metrics baseline**
- [ ] After serving several bundle requests with instrumentation on, the operator readout shows
      **total and per-stage latency p50/p95** (plus count and max) and the **request count**.
- [ ] The readout shows **cache hit count, miss count, and hit ratio**, and the current **data age**.
- [ ] The readout shows **vendor call count, vendor call latency, and the minimum rate-limit headroom
      observed** (or **unknown** when the vendor doesn't expose it).
- [ ] Metrics are available **both per-ticker and as a global roll-up**.
- [ ] Each stage is labeled **I/O-bound or CPU-bound** in the per-request trace / readout.
- [ ] A **cache-hit** request is distinguishable from a **cache-miss** (hit flag + near-zero compute
      stages).

**Correlation & logs**
- [ ] Every served bundle has a **correlation trace id**, and that id appears in the **structured log
      lines** for that request's stages.
- [ ] The structured logs are **additive** — the existing human-readable log lines still appear and
      are **not doubled**.

**Config & isolation**
- [ ] With instrumentation **disabled** via config, the bundle serves **identically** and **no
      metrics are recorded**.
- [ ] The **per-stage timing breakdown appears in a response's metadata only when the verbose/debug
      switch is set**; otherwise the response is unchanged.
- [ ] Forcing an **instrumentation failure** leaves the bundle response **unchanged (still 200, same
      computed values)** — only the affected metric/span is missing.
- [ ] With instrumentation **on**, the **SSE live stream shows no change and no added latency**.
- [ ] Serving a bundle with instrumentation **on vs off** shows **no meaningful latency difference**
      to the trader.

**Readout safety**
- [ ] Reading the metrics surface **does not trigger a vendor fetch and does not alter the bundle
      cache** (read-only, side-effect-free).
- [ ] The metrics aggregate **resets after a process restart** and presents **unknown/empty
      gracefully** before any requests are served.

## Open questions for downstream (UX / Interface / Tech-Writer)
- **Interface:** the metrics-readout endpoint signature; the response-metadata shape for the trace id
  and (verbose) per-stage timings; the readout's JSON shape; the request switch for verbose detail.
- **UX:** how the operator views the readout (no layout decided here) and how **unknown/empty** and
  **low-headroom** states are presented honestly.
- **Tech-Writer:** glossary/operator-doc entries for the stage vocabulary, the I/O- vs CPU-bound tag,
  the percentiles, rate-limit headroom semantics, the ephemeral-window caveat, and the trace-id
  correlation flow.
- **Config policy (operator docs):** default rolling-window size and the env-flag/verbose-switch
  names and defaults.
