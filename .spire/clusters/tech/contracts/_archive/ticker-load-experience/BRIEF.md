# ticker-load-experience — brief

Goal:            Make the individual ticker page (`/ticker/:symbol`) load fast and feel instant, with
                 a price the trader fully trusts. Three additive moves on one cohesive surface: (1)
                 **Skeleton-first load** — replace the single full-page `<CircularProgress/>` (today the
                 whole dashboard is gated on the bundle: `TickerDashboard.tsx:497,512`) with a skeleton
                 layout so the page chrome + every data component (stat tiles, GEX chart, term-structure
                 card, fresh-positioning, off-exchange, setups) render their own structure immediately
                 and fill independently as their data arrives (price via SSE, bundle via REST, AI-rec on
                 its own async — already independent). (2) **Cut real load time** — see the MEASURED
                 LATENCY block below: a warm cache hit is ~7ms but a **cold miss is 3–10s**, ~87% of it
                 the `vendor_fetch` stage and **~75% the single options-chain call** (`fetch_options_
                 market_state`). The headline lever is the **chain fetch**, NOT the 3-way parallelization
                 (which only overlaps away daily+intraday ≈ 12%): (a) the live SSE session already
                 re-fetches the same chain every 120s (`CHAIN_REFRESH_SECONDS`, `live.py:107`) — feed/
                 pre-warm the REST bundle cache from it so users hit the ~7ms warm path, not a 3.5s cold
                 compute; (b) check whether `massive.py` paginates the chain serially and whether the
                 vendor fetch can be scoped (mind: max-pain/PCR/term-structure are FULL-chain per §3 —
                 cannot naively narrow); (c) parallelize the 3 fetches as the cheap ~12% win; (d)
                 `engine_build` ~10% (per-contract Python loop over up to ~13k contracts) is a secondary
                 CPU lever. `persist`/`signals`/`serialize` are negligible (<11ms) — do NOT optimize there. (3) **Live last-trade readout** — surface the already-tracked
                 `last_trade_price` (`live.py:160`, never broadcast today) as a truly-live, print-driven
                 "● last $X" display ALONGSIDE the mid, plus reflect the **real-time options tier** in
                 freshness/cache config (`STALE_AFTER_SECONDS`/`DATA_FEED`, env doc says drop to ~120 on
                 real-time).

Decision impact: Improves the SPEED and TRUST of every read of the primary trading surface — the
                 trader sees structure instantly instead of an idle spinner, gets a faster fresh bundle,
                 and sees a last-trade that reconciles with their broker (Webull). Observed via:
                 time-to-first-meaningful-paint (skeletons paint before any data), a measured drop in the
                 `vendor_fetch` stage p50/p95 on `/_ops/metrics` before vs after parallelization, and a
                 visible live last-trade matching the broker during covered sessions. (UX/trust + latency
                 value on the core surface; not a new edge signal — judged on the page-quality bar.)

Feasibility:    pass — Skeletons = MUI `<Skeleton>` over the existing component tree (no new data shape).
                 Parallelize = `asyncio.gather` over the existing `to_thread` vendor calls (structurally
                 sound regardless of exact numbers; the chain/bars/trades fetches are independent). Last-
                 trade = surface one existing field on the SSE payload (+ `@org/api` type). Config = env.
                 NOTE: confirming the *magnitude* of the latency win needs the backend booted with a real
                 `MASSIVE_API_KEY` (advanced/real-time tier — owner has it) to read `/_ops/metrics`; the
                 architecture of the win does not depend on the measurement.

Effort:          M

Invariant watch: `[additive-keeps-score-byte-identical]` — skeletons, fetch-parallelization, last-trade
                 display, and the freshness config are ALL additive: `opportunity_score`/`opportunity_tier`/
                 `state_fingerprint`/the entry gate stay byte-identical; none is a scoring input.
                 `[best-effort-isolated-or-null]` — each component skeleton resolves to its own data or its
                 existing "unavailable this cycle" state; last-trade is independently nullable (null between
                 prints / overnight, never an error); parallelizing fetches must preserve the existing
                 best-effort/None-on-failure semantics per stage.
                 `[live-vs-static-isolation]` — last-trade is LIVE-derived (degrades with the SSE drop, like
                 mid/spread/net-flow); skeletons (cold-load) are a DISTINCT state from offline-degrade
                 (post-load SSE drop) and must not be conflated. Static bundle reads keep the last bundle.
                 **`live-spot=NBBO-mid` (locked, CONTEXT §5 / THREADS §9):** last-trade is ADDITIVE display
                 only — **mid stays the anchor** for the headline spot, the levels, and the live flip. This
                 is a carve-out (add a readout), NOT a reversal of the anchor; do not let it drift into
                 changing what the levels are measured against.
                 **`gamma-sourcing-split` (locked, CONTEXT §3 / THREADS §9): NOT TOUCHED here.** The own-gamma
                 unification is Track 2 (`gamma-unification`, measure-first) — out of scope for this feature.

Context tags:    architecture,backend,frontend,live,sse,observability,ui,conventions

Entry point:     architect-first — the pivotal calls are structural: skeleton-over-the-monolithic-bundle
                 vs split-the-fetch (split is a TRAP without request-coalescing — `_serve` has no in-flight
                 dedup, so 3 parallel slice-fetches on a cold cache would triple vendor load), the vendor-
                 fetch parallelization shape + preserved per-stage isolation, and keeping last-trade a
                 display-only sibling of the mid (not the levels anchor).

Source:          Owner request 2026-06-25 (redirect off `scanner`): "improve UX going to the ticker page —
                 don't stall on initial load, skeletons so components render independently; analyze FE→BE
                 latency for bottlenecks; + confirm live price is live & GEX cadence." Splits a separate
                 `gamma-unification` track (own analytic gamma → consistent flip), gated behind a
                 measure-first spike per the standing "measure the divergence before calibrating" rule.

---
## MEASURED LATENCY (2026-06-25, live Massive vendor, advanced/real-time tier, dark_pool ON)
Method: booted the real backend, 6 distinct **cold-miss** tickers + a warm re-hit, `?debug=1` per-stage
`meta.timings` + the `/api/_metrics` aggregate (n=8 reqs). Per-request stage table (ms):

| ticker | strikes | contracts | TOTAL | vendor_fetch | chain_fetch | daily | intraday | engine | offexch | persist |
|--------|--------:|----------:|------:|-------------:|------------:|------:|---------:|-------:|--------:|--------:|
| SPY    | 547     | 13354     | 9593  | 8297         | **7948**    | 93    | 257      | 1098   | 185     | 9       |
| QQQ    | 603     | 10436     | 7123  | 5949         | **5435**    | 114   | 401      | 818    | 341     | 11      |
| AMD    | 263     | 5576      | 3653  | 3130         | 2826        | 111   | 193      | 395    | 121     | 6       |
| MSFT   | 149     | 3642      | 3337  | 2922         | 2437        | 111   | 374      | 264    | 146     | 3       |
| NVDA   | 273     | 3824      | 3128  | 2367         | 1967        | 118   | 282      | 281    | 473     | 5       |
| AAPL   | 121     | 3464      | 3055  | 2694         | 2246        | 111   | 336      | 246    | 111     | 3       |

**Cold-miss medians (p50):** TOTAL **3495ms** (p95 8729, max 9593) · vendor_fetch **3026ms (~87%)** ·
**chain_fetch 2631ms (~75%) ← THE bottleneck** · daily+intraday 424ms (~12%, the only part 3-way
parallelization overlaps away) · engine_build 338ms (~10%, scales with #contracts) · off_exchange ~185ms
(the 4th fetch + analysis, dark_pool default on) · signals 0.04ms · persist 5ms · serialize 0.02ms.
**Warm cache hit: ~7ms total** — the 60s cache works; the entire cost is the cold compute, and within it
the single options-chain vendor call. Takeaways drive Goal (2) above: pre-warm/share the chain the live
session already holds > scope/parallelize the chain fetch itself > 3-way fetch parallelization (~12%) >
engine vectorization (~10%); `persist`/`serialize` are noise. Raw evidence not committed (transient).
