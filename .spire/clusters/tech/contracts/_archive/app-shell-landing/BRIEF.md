# app-shell-landing — brief

Goal:            Restructure the single-page dashboard into the new **multi-page** product shell and add a
                 **landing/splash page**. Introduce client-side routing (react-router is already a
                 dependency) + a persistent nav/app-layout. Add a **landing page** at `/` carrying the new
                 positioning — brand, visuals, and attractive hooks (connect your positions → AI
                 recommendations built on the GEX profile + heuristics). Relocate the existing GEX
                 dashboard to a **`/ticker`** (Ticker viewer) route and the shipped positions portfolio to
                 a **`/positions`** route, **behavior unchanged**. Add a **`/scanner`** nav entry routing to
                 a placeholder ("coming soon") page (built later as the `scanner` feature). This is an
                 **FE-only restructure + one new page** — no backend change, and NO change to the
                 GEX/positions feature internals (they move, they don't change).

Decision impact: Establishes the product's new shape: users land on a page that communicates the value and
                 navigate to Ticker / Positions / Scanner. Observable: the app serves a landing page at
                 `/` with persistent nav; the existing GEX viewer works unchanged at `/ticker` and the
                 positions portfolio unchanged at `/positions`; `/scanner` shows a placeholder.

Feasibility:     pass — FE-only. react-router is already in the dashboard's deps (console shows it active);
                 relocating existing components into routes is a refactor; the landing page is new static
                 UI. NO backend change, no new endpoint.

Effort:          M

Invariant watch: `additive-keeps-score-byte-identical` (pure restructure — `opportunity_score`/tier/
                 `state_fingerprint` untouched) · `best-effort-isolated-or-null` (relocated features keep
                 their isolation) · `live-vs-static-isolation` (**the one real risk**: the live-SSE
                 lifecycle of the relocated Ticker viewer must survive navigation — the live session must
                 mount/teardown correctly across route changes, not leak or double-subscribe). Does NOT
                 touch `no-real-order-path` (no broker; everything stays simulated).

Context tags:    architecture,frontend,features,conventions

Entry point:     architect-first — the pivotal calls are the routing/layout architecture and **how to
                 relocate the existing live-SSE dashboard + the positions durable store into routes
                 without regressing their state/lifecycle** (where shared providers live; where the live
                 session and the portfolio store mount; what survives navigation). Landing-page brand /
                 copy / visuals are product+UX, left as open questions for the PM/UX.

Source:          Owner pivot (2026-06-24) — multi-page, positions-centric repositioning. Track A, feature 1
                 of the program (see BACKLOG "Last GATE I — OWNER PIVOT").
