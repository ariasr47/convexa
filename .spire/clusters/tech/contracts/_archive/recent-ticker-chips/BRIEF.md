# recent-ticker-chips — brief
Goal:            On the Ticker page, put a small row of one-click symbol chips under (or beside)
                 the ticker input so operators can jump between recent symbols and a closed liquid
                 set (SPY / QQQ / NVDA at minimum) without retyping. Recents are durable
                 client-local (loss-free if a key/shape ever moves). Display-only navigation —
                 no scoring, no API change.
Decision impact: Multi-ticker sessions spend less time on typing and more time comparing levels
                 across the index/liquid set where the edge is documented. Observed: chips render
                 on `/ticker/*`; clicking a chip navigates to that symbol's ticker route; current
                 symbol is visually current (not a second “active” chrome language); after visiting
                 symbols A→B→C, recents include them in a stable order; first-run empty recents
                 still show the closed liquid chips (not a blank row); durable recents survive
                 reload without wiping older lists.
Feasibility:     pass — FE-only. Reuse existing route `/ticker/:symbol`, command-deck / header
                 ticker input, and `resolveDurable` for a small recents list. No endpoint, no
                 score input, empty `apps/api` expected (`NO_BACKEND_CHANGE`).
Effort:          S
Invariant watch: theme-token-discipline (chips bind theme only; no hex) ·
                 additive-keeps-score-byte-identical (nav chrome only) ·
                 loss-free-durable-migration (if a recents key/shape is introduced or renamed:
                 read-new-else-old, promote-forward, never-delete, corrupt→empty without destroy) ·
                 live-vs-static-isolation (chips are navigation chrome, not live-derived market
                 data — no live/offline obligation beyond existing route chrome) ·
                 absent-is-not-none (empty recents ≠ “no symbols”; still show closed liquid set).
Context tags:    frontend,ui,features
Source:          BACKLOG §B "Ticker UX quick wins" (next after distance-to-level-tiles SHIPPED
                 2026-08-11); owner track A after drained pipeline; standing queue X2/X3 verified
                 already present in code (see Considered).
Considered:      recent-ticker-chips (CHOSEN — best remaining value×effort Ticker win; decision
                 impact = multi-ticker rotation speed on the liquid set) ·
                 vol-normalized-gex / X2 (culled: already shipped — quant-engine vol_gex, wire
                 `vol_normalized_gex`, DealerPositioning tile, `/methodology`; residual =
                 research/score-lab coupling + roadmap honesty, not a greenfield build) ·
                 alerts / X3 (culled: already shipped — `/alerts`, TopNav, client rules,
                 evaluate-on-snap, browser Notification; webhook deferred as optional later) ·
                 split-decision-log (culled: resolved at positions v3 cutover — ghost write path
                 deleted; model/store is read-only harvest; one positions decision log) ·
                 sticky condensed header (culled: higher layout risk; defer after chips) ·
                 ticker input ergonomics (culled: lower impact; defer) ·
                 ledger checkpoint / X4 (blocked-on: N≥20 closed outcomes — habit, not this
                 pipeline turn) ·
                 market-backdrop (blocked-on: Massive plan / index data entitlement).
