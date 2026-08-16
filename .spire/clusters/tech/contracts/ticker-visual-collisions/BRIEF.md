# ticker-visual-collisions — brief
Goal:            Repair two Ticker-page rendering defects shown in the owner-supplied 2026-08-15
                 screenshot: the Quick-symbol pins/recents separator must remain a one-pixel
                 hairline instead of expanding into a grey rectangle, and the GEX strike-profile
                 marker labels must remain readable, non-overlapping, and fully inside the chart.
Decision impact: Faster symbol switching and a trustworthy structure read. Observed: a recent ticker
                 follows the pinned symbols without a full-width grey block; clustered put wall,
                 flip, spot, call wall, and live/mid markers can all be read without covering one
                 another or being cropped at either chart edge.
Feasibility:     pass — frontend-only. The Quick defect is isolated to MUI numeric sizing semantics;
                 the chart defect is isolated to fixed Canvas2D label coordinates and incomplete
                 bounds handling. No data, math, route, API, score, or persistence change.
Effort:          S
Invariant watch: theme-token-discipline (reuse existing divider/text/directional chart colors; no
                 new hex or visual dialect) · structural-over-prose-enforcement (layout behavior gets
                 rejecting regression cases) · live-vs-static-isolation (preserve live versus mid
                 wording and offline/static behavior) · single-motion-moment (no new animation) ·
                 additive-keeps-score-byte-identical (visual-only, empty backend diff).
Context tags:    frontend,ui,features
Source:          Owner screenshot `Screenshot (796).png` and request on 2026-08-15; defects traced to
                 `QuickSymbols.tsx` and `StructureFieldCanvas.tsx`.
Considered:      ticker-visual-collisions (CHOSEN — both visible defects share one small FE-only
                 verification pass) · remove the Quick separator (culled: loses the approved
                 pins-versus-recents distinction) · hide clustered chart labels (culled: removes
                 decision-critical levels) · increase chart height only (culled: does not solve
                 horizontal collisions or edge clipping).
