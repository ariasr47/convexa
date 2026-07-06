# dealer-flow-projection — brief
Goal:            Surface the PROJECTED dealer hedging flow implied by the options structure — the
                 delta dealers must buy/sell as time passes (charm) and as implied vol moves (vanna)
                 — as an additive, advisory CONTEXT read that feeds the downstream AI's state export
                 and is displayed to the trader. We already compute net charm + net vanna at current
                 spot in `engine.process_gex_profile` but discard them as display-only; this turns
                 them into a forward-looking, assumption-explicit "expected dealer flow into the next
                 OPEX / on a vol move" read that enriches the AI's TIMING + conviction — without
                 touching the score. It is a projection under STATED assumptions (charm accrues
                 holding spot/vol; vanna flow triggers on a vol move), surfaced with those assumptions
                 VISIBLE, exactly as the analytic gamma flip is.
Decision impact: Improves entry/exit TIMING and conviction around dealer-flow catalysts (OPEX charm
                 bleed, vanna-on-vol-move) — the "when/why dealers push," distinct from the static GEX
                 levels (the "where price is pulled"). Observed: the AI's rec rationale cites a
                 projected-flow read (e.g. "charm flow supports upward drift into Friday's OPEX"); the
                 trader sees a projected-dealer-flow read on the ticker page that was not there before.
Feasibility:     pass — net charm/vanna already computed analytically in-house (CONTEXT §3); the work
                 is the projection model + aggregation + a state-export field + display + glossary. No
                 new vendor dependency. KNOWN: the ~9th-sig-digit float-ordering jitter in
                 net_charm/net_vanna/net_volga (BACKLOG §B "Engine higher-order-greek determinism") is
                 sub-visible + does NOT affect score; elevating these to a feature is the concrete pull
                 to apply a deterministic reduction (fold in, or explicitly note as tolerated).
Effort:          M
Invariant watch: `additive-keeps-score-byte-identical` (HARD — the projection is AI-context/display
                 ONLY; never an input to signals/opportunity_score/opportunity_tier/gate/
                 state_fingerprint; the scoring modules import none of it — the same one-way-leaf
                 boundary the four positioning metrics honor). `best-effort-isolated-or-null` (any
                 projection failure → null/omitted field; market_state/strike_profile + SSE intact).
                 `live-vs-static-isolation` (DECLARE live-derived vs static: if the projection is a
                 static bundle read like the four positioning metrics, exclude it from the live-offline
                 treatment; if it folds in live vol/spot, mark it live-derived and degrade it on an SSE
                 drop). `gamma-sourcing-split` NOT reopened (a NEW derived read over the analytic
                 greeks we already run; it does not touch the walls/flip vendor-vs-analytic gamma
                 sourcing). Honesty: model-dependent + forward-looking ⇒ assumptions visible, never a
                 guarantee (treated like the analytic flip's "immaterial divergence" posture).
Context tags:    math,gamma,greeks,engine,ai,architecture,backend,frontend,observability
Entry point:     architect-first — the projection model (horizon, assumptions, charm-per-day vs
                 vanna-per-vol-point), the aggregation over the chain, the isolation-from-scoring
                 boundary, the live-vs-static classification, the state-export/interface field shape,
                 and the float-determinism decision are all feasibility/math-dominated; the product +
                 UX layer (how it reads, the copy) is a lighter pass on top.
Source:          Owner discovery conversation 2026-07-02 ("what other derived data can we calculate
                 using Massive to help the AI make better recommendations?"). Harvest source =
                 downstream-AI quality. Reuses net charm/vanna already computed display-only (CONTEXT
                 §3). Culled first out of the AI input-enrichment pool (BACKLOG "Last GATE I —
                 2026-07-02"); iv-rank + market-backdrop queued behind it.
