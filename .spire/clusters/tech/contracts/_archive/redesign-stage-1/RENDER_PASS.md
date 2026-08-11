# redesign-stage-1 — conductor render pass (real browser, 2026-07-22)

> Playwright MCP against the served branch. Conductor evidence for the §8 review rows /
> §9 render items. Screenshots in `render-pass/`.

| Check | Result | Evidence |
|---|---|---|
| Identity applied (dark) | **PASS** — ink `#0B0F17` canvas, phosphor `#E9E4D6` text, IBM Plex Sans body + Plex Mono data (computed), amber CTA `#F2A93B` w/ ink contrastText, theme-color `#0B0F17` | `s1-ticker-1440-dark.jpeg` + computed values |
| Amber spent, not sprinkled | **PASS** — amber = Sign up, primary CTA, active-nav, tier accents; links/info hold signal blue; P/L green/red untouched on wall tiles | same |
| GEX chart rebind | **PASS** — reference lines: flip `#F2A93B` (the ONE amber line), spot steel `#8A9BB4`, live-flip signal `#5E8BC4`, zero-line neutral; 33 bars, vertical orientation intact | computed strokes |
| Light parity | **PASS** — paper `#F6F6F3`, theme-color follows, CTA renders the BOUNCED `#C57F19` (measurement beat the proposal value, live) | `s1-ticker-1440-light.jpeg` |
| 393px floor held | **PASS** — scrollWidth 378 on the new theme, incl. while degraded | measured |
| Offline-degrade on new palette | **PASS** (LIGHT mode — complements Stage 0's dark walk): "⚠ Live offline — reconnecting…" in the new light-warning `#A65526`, ⏸ markers legible, static chart + reads persist, no layout shift | measured after a true backend kill |
| Blog index (in-app) | **PASS** — inherits the theme cleanly both modes | `s1-blog-1440.jpeg` |
| Blog static article | **PASS with a named residual** — template properly ink/phosphor/same-origin fonts; **the inline SVG article ILLUSTRATIONS still carry their own cream/terracotta styling** (artwork, not template — explicitly out of Stage 1 scope, honestly flagged by the FE). Jarring on-brand-asset; ruled ACCEPTED RESIDUAL → named follow-up "regenerate blog artwork onto the system" (BACKLOG/Stage 3 adjacency) | `s1-blog-article-1440.jpeg` |

**Methodology note:** the backend survived the first kill again (uvicorn respawn/wrapper —
same gotcha as Stage 0, now twice-evidenced: kill by IMAGE, then `curl` to CONFIRM dead
before trusting any degrade observation).

**Not covered (QA scope):** the §8 test-matrix audit, battery re-run, contrast-table spot
re-check, ban-list mutation guards, empty apps/api diff.
