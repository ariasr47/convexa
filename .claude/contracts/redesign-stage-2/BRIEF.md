# redesign-stage-2 — brief
Goal:            Land THE SIGNATURE (Stage 2 of the Q4(a) program) — the convex arc, spent in
                 exactly three places and nowhere else (a 4th use is a violation): (1) **the
                 mark** — CONVEXA in Archivo Expanded caps (the Stage-1 `displayScale` tokens +
                 real wdth axis are in), the X cut from two convex arcs — geometric, ownable,
                 NO gradient (`brandGradient` may die if unused after this); rebuild the TopNav
                 wordmark + favicon + landing usage; (2) **the one orchestrated moment** — the
                 landing hero's payoff curve DRAWS ITSELF on load and settles into the baseline,
                 replacing the generic radial glow blob; static curve under `prefers-reduced-
                 motion`; this becomes THE motion identity (full five-family consolidation is
                 Stage 3 — this stage only ADDS the moment + removes the blob); (3) **arc
                 dividers** — shallow convex arcs replace straight rules at section boundaries
                 app-wide (a single shared token-bound component; count-of-importers enforceable).
                 Plus the landing finish: `<main>` landmark (deferred from Stage 0 §10.2), the
                 heading-hierarchy fix on landing, and the remove-one-accessory pass (proposal
                 §5 Stage 2) — cut, don't add.
Decision impact: N/A (identity/brand — Q4(a) owner decision; the stage that makes Convexa
                 visually unmistakable: "a visual identity that could not be mistaken for anyone
                 else's").
Feasibility:     pass — display tokens + palette shipped (Stage 1); the arc is SVG + CSS
                 stroke-dash draw (transform/opacity-class animation, reduced-motion static);
                 the mark is an SVG lockup (no new fonts needed). Named risks: the arc-X
                 legibility at favicon sizes (test 16/32px); the hero curve must not shift
                 layout (draw-in is paint-only); SEO-prerender RE-DERIVES AFTER this stage
                 (§6a-5) — keep router changes to zero.
Effort:          M
Invariant watch: theme-token-discipline (arc/mark token-bound, zero new hex) ·
                 additive-keeps-score-byte-identical (FE-only, empty apps/api diff) · the
                 ONE-motion rule (convexa-design skill §5: the curve-draw becomes THE moment;
                 `useReducedMotion` via the shared hook; animate transform/opacity only) ·
                 no-real-order-path (landing copy stays honest — Stage 0's hero copy is LOCKED,
                 this stage touches visuals not claims) · arc-in-exactly-3-places (add the
                 importer-count test — the skill's enforcement table names it for this stage) ·
                 vertical-GEX-chart lock (chart frame untouched — the cut 4th idea stays cut).
Context tags:    frontend,ui,decisions
Entry point:     GATE V fast-path (UX → Frontend). Rule-of-record: convexa-design skill +
                 proposal §3 (type/palette) + §5 Stage 2. Reference runs:
                 `_archive/redesign-stage-0/` + `_archive/redesign-stage-1/`.
Source:          Q4(a) owner decision 2026-07-22; proposal §5 Stage 2 + §6a rulings 1/5;
                 OPEN_THREADS §7u (Stage 2 next); Stage 0 §10.2 deferral (Landing <main>).
