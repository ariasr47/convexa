# latency-visualizer — brief

Goal:            A **local, free** way to VISUALIZE the bundle-pipeline latency the shipped backend
                 observability already exposes — turning the snapshot stage *tables* on the operator
                 route `/_ops/metrics` into something you can watch as a **trend** (per-stage
                 p50/p95/max across the rolling window / over time) so you can see which stage
                 (`vendor_fetch` · `engine_build` · `off_exchange` · `signals` · `persist` ·
                 `serialize_wrap`) is the bottleneck while tuning the service **pre-live**. Strictly
                 local — **no external/paid APM, no hosted dashboard service**.

Decision impact: *(operator/tooling — the trading-decision cull is **N/A**; judge on operational
                 value.)* Improves the "**which stage do I optimize next**" decision — observed by
                 watching a stage's p95 line move on a local chart as you change code, at $0 cost.

Feasibility:     pass — the frontend already ships **recharts** (`gex-profile-chart.tsx`) and the
                 read-only `GET /api/_metrics`; a client-side poll accumulated into a live chart needs
                 **no new backend and no external service**. Pivotal Architect call: stay
                 **stateless / client-accumulated** vs introduce a persistence surface for
                 cross-restart history.

Effort:          S–M

Invariant watch: **`[operator-vs-trader-path-separation]`** — stays on `/_ops/metrics`, OFF the
                 trader routes, read-only + side-effect-free (only `GET /api/_metrics`; no new fetch
                 on the trader path).
                 **`[best-effort-isolated-or-null]`** — empty / cold-window / instrumentation-OFF →
                 honest `—`, never blanks or breaks.
                 **Stateless-server / ephemeral-metrics** decision (`OPEN_THREADS` §6 /
                 `GAMMAFLOW_CONTEXT` §6): default to **NO new server state**; any persistence is the
                 Architect's explicit, isolated envelope call — never on the trader/bundle path. SSE
                 stays uninstrumented.

Entry point:     architect-first — the **stateless-client vs persisted-history** boundary (does the
                 server gain a storage surface, touching the ephemeral/stateless metrics decision?)
                 is the pivotal call and directly serves the cost constraint; set the envelope before
                 product scope.

Source:          BACKLOG §D "Observability extensions" (visualization slice) + usage friction
                 (watch latency locally, free, while pre-live). Pulled by concrete need.
