# scanner — brief
Goal:            Build the real Scanner page (replacing the coming-soon stub): the user curates a
                 durable WATCHLIST of tickers; the scanner shows a simplified per-ticker read (price,
                 opportunity score + tier, regime, distance-to-key-level — final set is the PM/UX
                 call) in one scannable surface; multiple named views (e.g. compact table vs cards,
                 sort by score) if they earn their keep; each row links to `/ticker/:symbol`; AI is
                 wired in twice — (1) AI can BUILD/SEED a watchlist for you, (2) the user can run the
                 AI recommendation across ALL tickers in the watchlist or a selected subset, results
                 landing per-row (respecting the existing gating/cooldown/cap/key-resolution — never a
                 firehose).
Decision impact: Restores the multi-ticker view the product dropped for perf: the trader picks WHICH
                 ticker deserves the deep-dive from a live-scored shortlist instead of guessing.
                 Observed via: watchlist persists, rows show real scores, row-click lands on the
                 ticker page, batch-rec produces per-row verdicts.
Feasibility:     pass WITH a perf re-justification (see invariant watch) — the pieces exist: the
                 bundle already computes score/tier per ticker on demand; ticker-load-experience added
                 the shared chain store + request-coalescing + concurrent fetches (cold 1.2s on an
                 active session); the 60s cache makes an N-ticker sweep N cache entries. The architect
                 MUST design the fetch strategy (sequential-throttled sweep vs small concurrency pool;
                 refresh cadence; vendor rate-limit headroom off /api/_metrics; a possible slim
                 "scan slice" endpoint so the scanner doesn't pull full bundles) and the batch-rec cost
                 model (per-ticker recs ride the existing cooldown/cap — batch = queued sequential,
                 never parallel LLM calls).
Effort:          L
Invariant watch: **Revisits the locked "single-ticker, on-demand" decision (PROJECT_CONTEXT §5)** —
                 the watchlist scan was dropped for being too slow; the architect must re-justify with
                 the post-ticker-load-experience machinery and keep the scan bounded (explicit
                 watchlist, not a market sweep). additive-keeps-score-byte-identical (the scanner
                 CONSUMES scores; never an input); best-effort-isolated-or-null (a failed ticker
                 degrades its row alone); live-vs-static-isolation (scanner rows are snapshot reads —
                 declare live vs static explicitly; no per-row SSE fan-out without the architect
                 sizing it); server-side-gate-enforcement (batch-rec + any watchlist server persistence
                 are gated); no-real-order-path (display + links only).
Context tags:    architecture,features,decisions,ai,data
Entry point:     architect-first — the fetch/perf strategy and the single-ticker-decision
                 re-justification bound the whole feature; PM/UX follow on that skeleton.
Source:          Owner directive 2026-07-01 item 5; promotes the queued Track-A `scanner` item
                 (BACKLOG §A, deferred since 2026-06-25) with expanded owner scope (watchlist,
                 AI-seeding, batch recs, views).
