# ai-rec-decision-card — brief

Goal:            Replace the AI recommendation's report-like wall of text with a decision-first
                 card and a separate analysis surface. A trader should identify the verdict,
                 structure, risk, invalidation, and safe next action before reading the long-form
                 rationale.
Decision impact: Faster, safer interpretation of an AI read. Observed: a fresh complete trade read
                 presents its verdict and risk summary first, offers an unambiguous route into the
                 existing simulated-trade flows, and moves detailed reasoning/data into an optional
                 drawer or mobile sheet. Degraded reads never retain an action that their state no
                 longer supports.
Feasibility:     pass — frontend-only. Existing `RecResponse`, bundle, grounding, cap, provenance,
                 export, persona, scenario, and action handlers contain the required information.
                 No endpoint, AI prompt, model output, recommendation math, persistence, or order
                 implementation change is required.
Effort:          M
Invariant watch: theme-token-discipline (existing Curvature Terminal tokens, light/dark parity) ·
                 live-vs-static-isolation (fresh/stale/offline remain distinct) ·
                 single-motion-moment (no new orchestrated motion) ·
                 single-shared-sim-entry-dialog (both paths keep the shared confirmation boundary) ·
                 no-real-order-path (simulated only) · ai-asserted-numbers-are-traceable (no invented
                 evidence or client-recomputed counts) · absent-is-not-none (missing, unavailable,
                 unrecognized, and not-applicable remain distinct) · additive-keeps-score-byte-identical
                 (empty backend/score diff) · structural-over-prose-enforcement (state/action policy
                 receives rejecting tests).
Context tags:    frontend,ui,ai,personas,invariants
Source:          Owner-supplied AI recommendation screenshots and design critique on 2026-08-15;
                 owner approved proceeding with the decision-card concept on 2026-08-15. Approved
                 visual references: `docs/design/ai-rec-redesign-wireframe.png`,
                 `docs/design/ai-rec-redesign-analysis-drawer.png`, and
                 `docs/design/ai-rec-redesign-mobile-stale.png`.
Considered:      decision card + analysis drawer (CHOSEN — fastest verdict scan with detail on demand) ·
                 inline accordion (culled: expanded content restores the original vertical wall) ·
                 dedicated analysis page (culled: adds navigation cost between the read and ticker
                 context).
