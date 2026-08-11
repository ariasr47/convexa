# distance-to-level-tiles — brief
Goal:            On the Ticker page, Call wall / Put wall / Max pain / Gamma flip tiles show a
                 secondary line with signed $ gap · % · above/below (or `at spot`) so operators see
                 how far price is from each level without mental arithmetic. Display-only FE work.
Decision impact: Reading key levels becomes one glance instead of subtract-and-percent math on every
                 poll. Observed: secondary caption present when spot anchors exist; omitted when both
                 `gex_spot` and `price` are null; never recolored as bullish/bearish.
Feasibility:     pass — FE-only pure projection + StatTile secondary caption. Empty `apps/api` diff.
Effort:          S
Invariant watch: theme-token-discipline (secondary uses theme `text.secondary` + mono only; no hex;
                 no success/error tint) · additive-keeps-score-byte-identical (display-only;
                 NO_BACKEND_CHANGE) · absent-is-not-none (missing spot → omit secondary, never
                 fabricate "at spot" or a gap) · model-read-carries-its-assumptions (distance is
                 arithmetic from existing levels/spot, not a forecast).
Context tags:    frontend,ui,features
Source:          BACKLOG §B "Ticker UX quick wins" (highest-value deferred item); OPEN_THREADS
                 deferred seams naming distance-to-level tiles.
Considered:      distance-to-level-tiles (CHOSEN — highest-value deferred Ticker UX win) ·
                 recent-ticker chips (culled: lower decision impact for this pass) ·
                 sticky condensed header (culled: larger layout risk, deferred) ·
                 ticker input ergonomics (culled: still deferred).
