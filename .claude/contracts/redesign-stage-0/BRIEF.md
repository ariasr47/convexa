# redesign-stage-0 — brief
Goal:            Repair the verified quality floor of the deployed app — correctness, not taste
                 (Stage 0 of the approved Q4(a) Curvature Terminal program; do this first, the
                 identity stages build on it). Scope: (1) mobile — kill the 393px horizontal
                 overflow (measured scrollWidth 580 vs 393 on /ticker; offenders: header toolbar
                 stack + trade-button row + widget headers) and add a real mobile nav by FOLDING IN
                 the parked `feat/responsive-layout` branch (has the hamburger/drawer + card
                 layouts; ~13+ commits behind — REBASE first); (2) authored `:focus-visible` rings
                 app-wide (today: 1 file, everything else UA-default); (3) semantic repair on
                 /ticker (~29 stat values rendered as <h6> → styled spans, `<main>` landmark,
                 heading order); (4) floors: touch targets ≥44px, chip/label type ≥11px (kills the
                 measured 9px "vs spot" deltas); (5) copy fixes (false "Saved to your account." for
                 anonymous, the "last last" typo, hero reframed honestly — it sells the unbuilt
                 brokerage connect); (6) `<meta name="theme-color">` follows the active mode.
Decision impact: N/A (quality-floor/correctness class — judged on product trust: the deployed
                 product is unusable at phone width and keyboard-inaccessible; every finding is
                 verified eyes-on, not asserted).
Feasibility:     pass — all findings verified against the running app (real-browser pass,
                 docs/design/verification-2026-07-22/); the responsive branch already contains the
                 mobile machinery; rebase risk is the one named unknown (13+ commits of drift incl.
                 the test-migration baseline change).
Effort:          M
Invariant watch: theme-token-discipline (fixes land token-only) · additive-keeps-score-byte-identical
                 (FE-only, empty apps/api diff) · live-vs-static-isolation (the 3 distinct degraded
                 states survive relayout) · no-real-order-path (hero copy stays honest about the
                 unbuilt brokerage) · single-shared-sim-entry-dialog (responsive work restyles THE
                 dialog, never forks) · vertical-GEX-chart lock (relayout must NOT change chart
                 orientation) · loss-free-durable-migration (saved-view/prefs shapes untouched or
                 migrated). Process riders (proposal §6a): tsc -b + nx build at GATE Q; real-browser
                 render pass at 1440 AND 393, both schemes (Playwright).
Context tags:    frontend,ui,features,decisions
Entry point:     GATE V fast-path (UX → Frontend; no math, no backend). Rule-of-record: the
                 convexa-design skill + DESIGN_RULES loop; lanes also load web-design-guidelines,
                 vercel-react-best-practices, composition-patterns, webapp-testing.
Source:          Q4(a) owner decision 2026-07-22 (DECISION_QUEUE.md); DESIGN_REVIEW_2026-07-22 §
                 hard-floor + verification-2026-07-22 (eyes-on confirmation); BRAND_TOKENS_PROPOSAL
                 §5 Stage 0.
