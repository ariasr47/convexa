# positions-portfolio — brief

Goal:            Evolve the shipped ghost-trade tracker from a SINGLE open sim position into a
                 multi-position **portfolio** surface. A central "all positions" view plus a per-ticker
                 filtered view (when viewing a ticker, show just that ticker's positions). Each position
                 tracks **its own P/L and the change in that P/L** (Δ since entry + session/live change,
                 ideally a small per-position trend). Two view tabs: **Simulated** — the functional
                 paper-sim portfolio — and **Live** — a present-but-LOCKED placeholder that reflects a
                 future real-broker capability (NOT implemented now: no broker, no real positions, no
                 order path). Instruments: **options contracts** (reusing the existing greeks + option-NBBO
                 mark path). The trade simulator enters a new sim position at **any user-input price** OR
                 fills it via a **market/limit order against the live price**. Display must be modern,
                 organized, and **customizable**: column choice + sort/filter, grouping (by ticker /
                 strategy / expiry) with group P/L subtotals, table↔card layout + density, and **durable
                 saved views**.

Decision impact: Improves position-MANAGEMENT decisions (hold / trim / add / exit). Seeing every open
                 sim position's P/L and its change at a glance — globally and per-ticker — is what tells
                 the trader which positions are working and which to cut. Observable: the portfolio renders
                 N positions with per-position + grouped P/L that update on the live feed, each showing its
                 P/L change, and a configured/saved view survives reload.

Feasibility:     pass — the Simulated portfolio reuses the shipped mark ladder (`ghost-trade/mark.ts`),
                 durable store (`store.ts`), `useGhostTrade`, `TradeEntryDialog`, and `GET /api/contract`;
                 the per-position P/L trend can reuse the ephemeral ring-buffer pattern from
                 latency-visualizer. The **Live** view is an explicit locked placeholder ⇒ NO broker/
                 data-source dependency and NO order path (so it does not touch the blocked vendor decision).

Effort:          L

Invariant watch: `no-real-order-path` (HONORED, not reversed — Simulated stays paper/`SIMULATED`; the
                 Live view is a non-functional placeholder with no broker and no order/execution path) ·
                 `additive-keeps-score-byte-identical` (positions are never an input to signals / score /
                 tier / `state_fingerprint`) · `best-effort-isolated-or-null` (a per-position mark/contract-
                 lookup failure degrades only that row, never the bundle/SSE) · `live-vs-static-isolation`
                 (live marks + P/L change degrade on an SSE drop — ⏸ last-known — while the position
                 records / history / saved views persist from the durable store).

Context tags:    architecture,frontend,backend,features,ghost-trade,decisions,conventions

Entry point:     architect-first — the pivotal calls are technical: the data-model evolution (single
                 `GhostTrade` → a positions collection, keyed/grouped), the mark-and-fill engine for the
                 order types (arbitrary / market / limit), the per-position P/L-change derivation, and the
                 isolation of the locked Live placeholder. Shape/feasibility dominates the product copy.

Source:          Owner request (2026-06-24) — "a place to see all open positions, each tracking its own
                 change in P/L; modern/organized/customizable; live vs simulated views; the simulator
                 fills at a user price or via market/limit on the live price."
