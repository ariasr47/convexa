# ticker-load-experience — brief

Goal:            Make the individual ticker page (`/ticker/:symbol`) load fast and feel instant, with
                 a price the trader fully trusts. Three additive moves on one cohesive surface: (1)
                 **Skeleton-first load** — replace the single full-page `<CircularProgress/>` (today the
                 whole dashboard is gated on the bundle: `TickerDashboard.tsx:497,512`) with a skeleton
                 layout so the page chrome + every data component (stat tiles, GEX chart, term-structure
                 card, fresh-positioning, off-exchange, setups) render their own structure immediately
                 and fill independently as their data arrives (price via SSE, bundle via REST, AI-rec on
                 its own async — already independent). (2) **Cut real load time** — the cold-miss serve
                 path makes 3 (4 with dark-pool) **sequential** vendor calls (`main.py:261-267` +
                 `off_exchange`); parallelize them (vendor I/O is the dominant cost) and trim the
                 on-serve-path `persist` disk writes; confirm the bottleneck against `/_ops/metrics`
                 p50/p95 before/after. (3) **Live last-trade readout** — surface the already-tracked
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
