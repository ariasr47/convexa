# ai-context-pack — brief

Goal:            Enrich the downstream AI's inputs (and the Ticker page) with a bundled **context
                 pack** of derived reads, all computed from data already in hand — no new vendor
                 dependency: **(a) a technical-indicator regime read** — EMA stack + ADX + RSI
                 **digested into a SMALL set of regime LABELS** (e.g. trend direction/strength,
                 momentum state), never raw indicator dumps; **(b) GEX-profile shape scalars** —
                 how concentrated vs dispersed / skewed the dealer-gamma structure is (from the
                 already-computed profile); **(c) a flow-vs-positioning divergence read** — when
                 recent flow disagrees with the static OI positioning; **(d) multi-horizon ATR**
                 (e.g. ~5/14/30-day realized range) for realistic stop/target sizing context.
                 All ride `market_state` as **additive nullable fields** → the AI state export
                 (CONTEXT, via the wholesale `serialize_context` forward) + display on the Ticker
                 page. NEVER a scoring input.

Decision impact: Entry/exit **confluence + sizing**. The regime labels condition whether to trust
                 mean-reversion around the GEX levels (trend vs chop, momentum state); ATR gives
                 the AI realistic stop/target distances instead of guessed ones; shape scalars +
                 flow-vs-positioning divergence sharpen conviction on the dealer-positioning read.
                 Observed: the AI rec cites regime/ATR/shape/divergence in its Why bullets; the
                 labels/tiles render on the ticker page.

Feasibility:     pass — every read derives from data already fetched: daily bars (→ EMA/ADX/RSI/
                 ATR), the computed GEX profile (→ shape scalars), the existing flow + OI reads
                 (→ divergence). ONE named constraint for the Architect: daily-bar history is
                 **~60d** (CONTEXT §4), so the EMA stack must either fit that window or the
                 daily-bars fetch must extend (a fetch-parameter decision, not a new vendor
                 dependency) — decide explicitly, don't silently emit under-warmed values.

Effort:          S–M (bundle of four S items; shared plumbing amortized — one additive
                 `market_state` surface, one FE widget/tile family, one export ride-along)

Invariant watch: `additive-keeps-score-byte-identical` (HARD — AI-context/display only; `signals.py`
                 untouched; byte-identity re-proven with/without the pack) ·
                 `best-effort-isolated-or-null` (each read INDEPENDENTLY nullable → its own
                 "unavailable this cycle"; never an HTTP error) ·
                 `live-vs-static-isolation` (declare each read live-derived vs static; the
                 bar/profile-derived reads are static-family; the divergence read must declare the
                 basis of its flow input explicitly) ·
                 `theme-token-discipline` (new FE surface token-only, `extrasFor(theme)`, dark/light
                 parity) ·
                 `model-read-carries-its-assumptions` (watch-list candidate — every label/scalar
                 carries its window/threshold/basis visibly; advisory context, never a guarantee) ·
                 **digested-labels-not-raw-dump** (the 2026-07-02 GATE I binding design rule for the
                 TI bundle: a SMALL orthogonal set, pre-digested into regime labels — not raw
                 indicator values — kept OUT of the score; signal overload degrades the AI) ·
                 `gamma-sourcing-split` NOT touched (shape scalars READ the existing computed
                 profile; no gamma recompute, no walls/flip sourcing change).

Context tags:    architecture,math,data,features

Entry point:     architect-first — feasibility/data-window + exact scalar/label vocabulary + null
                 rules dominate (which indicators fit the ~60d bar window, the divergence
                 definition, the label set, where each computation lives without touching scoring).

Source:          BACKLOG §B "AI input-enrichment pool" — the two parked scored items
                 "AI context-scalars pack" (GEX shape · flow-vs-OI divergence · multi-horizon ATR)
                 + "technical-indicator regime bundle" (EMA/ADX/RSI → digested labels), bundled by
                 owner pick 2026-07-06 (follows dealer-flow-projection, the program's item #1).
