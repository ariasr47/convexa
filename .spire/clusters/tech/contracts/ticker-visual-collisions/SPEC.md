# ticker-visual-collisions — spec

**Source brief:** `.spire/clusters/tech/contracts/ticker-visual-collisions/BRIEF.md`
**Route:** GATE V visual fast-path (frontend only)
**Status:** APPROVED 2026-08-15 (owner requested “FIX BOTH”)

## 1. Goal + scope

Make the Quick-symbol row and GEX strike-profile marker labels render cleanly across ticker data and
viewport widths without changing their meaning or the product's visual language.

**In scope:**
- Correct the pins/recents separator so it is a vertical hairline, never a percentage-width block.
- Keep Quick chips whole, ordered, and naturally wrapping at narrow widths.
- Place put wall, call wall, flip, spot, and live/mid chart labels without intersections.
- Keep every marker label fully inside the Canvas2D viewport, including at either domain boundary.

**Out of scope:**
- Ticker recents data/order/persistence changes.
- GEX math, strike window semantics, chart series, marker values, API payloads, or live-tape behavior.
- Chart restyling, new colors, new motion, responsive page redesign, or a backend change.

**Future (deliberately deferred):** none.

## 2. Architecture

- `widgets/chrome/QuickSymbols.tsx`: express the separator's physical width with an explicit CSS
  length so MUI's fractional sizing transform cannot reinterpret it. Preserve the existing conditional
  render: no separator when no recent symbols exist.
- `shared/charts/structure-field/StructureFieldCanvas.tsx` and, if useful, a sibling pure layout
  helper: measure each marker label with the active canvas font, clamp the resulting label box on both
  horizontal edges, and assign deterministic vertical lanes when label boxes would intersect.
- Structure marker values and x coordinates continue to come from the existing model. Repositioning a
  label must not change its line, value, color, wording, or live/static meaning.
- The chart's fixed captions and marker labels must share an explicit reserved-space/collision policy;
  no label may cover another label merely because levels converge.

**Failure modes + isolation:** if a label cannot fit its preferred lane, place it in the next free
lane while retaining its marker line association. Layout failure must not throw, resize the page, or
alter market data. Empty/corrupt recents continue to degrade to pinned symbols only.

**Not buildable / rejected approaches:** deleting labels, abbreviating values until they become
ambiguous, increasing chart height without collision logic, or changing GEX/level math to spread lines.

## 3. Acceptance criteria (with user stories)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As a trader with recent tickers, I want the Quick row to stay compact so that recents remain easy to scan. | With at least one recent ticker, the pins/recents separator renders as a 1px vertical hairline; no full-width grey rectangle appears, and the recent chip follows the pins on the same line whenever the available width can contain them. | test |
| AC-2 | As a first-time or recovered user, I want the pinned shortcuts to remain stable. | With no usable recents, `SPY`, `QQQ`, and `NVDA` render in their existing order and no orphan separator is visible. | test |
| AC-3 | As a narrow-screen user, I want shortcuts to remain usable without page overflow. | At 393px, Quick chips wrap only between whole chips, the separator never becomes a horizontal bar, and the Ticker page gains no horizontal overflow. | test |
| AC-4 | As a trader reading clustered levels, I want every structure label to remain legible. | At 320px, 600px, and the normal desktop chart width, fixtures with clustered put wall, flip, spot, and call wall values render marker-label boxes that do not intersect one another or the fixed chart captions. | test |
| AC-5 | As a trader reading levels near the chart boundary, I want the full value visible. | Put/call wall, flip, spot, and live/mid labels at the left or right domain boundary remain fully inside the canvas; three-, four-, and five-digit fixture values are not cropped. | test |
| AC-6 | As a trader distinguishing tape from structure, I want the repair to preserve meaning. | Existing marker text (`put`, `call`, `flip`, `spot`, and `live` or `mid`), values, directional colors, line positions, and offline/static wording remain unchanged apart from collision-safe placement. | review |
| AC-7 | As a keyboard and pointer user, I want the existing interactions preserved. | Quick chips retain their button semantics, selected state, click behavior, focus treatment, and touch behavior; the chart hover probe remains usable. | test |
| AC-8 | As the product owner, I want a contained visual repair. | The dashboard uses existing theme/chart tokens with no new animation or hardcoded component color, and `apps/api` has no feature diff. | test |

## 4. UI + interaction

**Flows:**
1. Pinned-only Quick row: `QUICK` → `SPY` → `QQQ` → `NVDA`.
2. Quick row with recents: pins → one vertical divider hairline → de-duplicated recent chips.
3. Dense GEX profile: every structural/tape marker keeps its line while labels occupy distinct lanes.
4. Edge GEX profile: measured label boxes remain inside the chart at both boundaries.

**Component states:**

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Quick symbols | Pins plus optional recents; one vertical hairline between groups | No separate loading state | Pins only; no divider | Corrupt recents degrade to pins only | Not live-derived; unchanged |
| GEX marker labels | Existing words/colors with collision-safe placement | Existing widget loading behavior unchanged | Existing widget omission when no in-window strikes | Existing widget behavior unchanged; layout never throws | Preserve `live` versus `mid` wording and current static/offline treatment |

**Copy:** unchanged: `QUICK`, ticker symbols, `put $…`, `call $…`, `flip`, `spot $…`, and
`live $…` / `mid $…`.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET`).

**Design direction:** apply the existing Curvature Terminal density, mono figures, divider hairline,
directional chart colors, and honesty labeling. Add no new surface, palette role, motion, or legend.

## 5. Error handling

- Missing or corrupt recents remain a pins-only Quick row with no separator.
- Canvas label layout accepts finite marker values only as today; it must not throw on a narrow canvas
  or clustered values.
- No new user-facing error copy, retries, logging path, or error boundary is introduced.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/ticker-visual-collisions/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** `NO_BACKEND_CHANGE`. Existing ticker and live-tape data are
consumed unchanged; this feature only repairs frontend placement.

## 7. Testing strategy

- RED/GREEN component regression for the Quick separator with recents present and absent. Use a real
  computed-style/browser assertion rather than an inline-style assertion because MUI `sx` compiles to
  classes.
- RED/GREEN pure layout tests for clustered labels and left/right boundary clamping at representative
  widths. Tests must prove non-intersection and complete in-bounds boxes, not merely that helpers return.
- Existing Quick interaction tests and GEX widget/windowing tests remain green.
- Real-browser inspection at desktop screenshot width and 393px confirms paint, wrapping, no clipping,
  and no horizontal overflow. AC-6 is recorded as review because wording/color preservation is visible.
- Run dashboard typecheck, focused tests, relevant suite, and production build on final bytes. Cached
  output alone is not evidence; record exit codes.

## 8. Guardrails this feature must not break

- `[theme-token-discipline]`: existing tokens only; dark/light parity; no new component hex.
- `[structural-over-prose-enforcement]`: separator sizing and label bounds/collisions have rejecting tests.
- `[live-vs-static-isolation]`: preserve `live` versus `mid` semantics and stream-degraded behavior.
- `[single-motion-moment]`: add no animation or keyframe family.
- `[additive-keeps-score-byte-identical]`: visual-only; no backend, score, tier, gate, or fingerprint path.

## 9. Open questions

None.
