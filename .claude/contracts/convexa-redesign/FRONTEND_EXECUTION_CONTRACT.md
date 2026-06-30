# convexa-redesign — FRONTEND_EXECUTION_CONTRACT (GATE V Ticker visual fixes, 2026-06-30)

> **Scope:** two owner-reported visual fixes on the **Ticker** screen. FE-only,
> **NO_BACKEND_CHANGE / NO_INTERFACE_CHANGE** — presentation only, no math/score/bundle path touched.
> Bound to `PROJECT_CONTEXT.md`. Supersedes the prior cleanup-pass contract (that shipped: commit
> `82f63ee`).
>
> **Presentation-only.** Do not change any value, computation, data flow, or live/stale/offline
> behavior. Keep `npx nx test dashboard` green (was 412/412; update a test only if it asserts the exact
> DOM *position* of the moved caption — the text/copy must stay byte-identical either way).

## Invariants (HARD — restate, do not touch)
- **`NO_BACKEND_CHANGE`** — do not edit anything under `apps/api/`.
- **`[additive-keeps-score-byte-identical]`** — no scoring/bundle path touched.
- **`[live-vs-static-isolation]`** — the Dealer Positioning grid stays static (un-dimmed on SSE drop);
  the caption copy that states this ("Snapshot, never live …") must remain, just relocated.
- **Token discipline** — no hardcoded hex; use theme/`tokens.ts` (existing usage in both files already
  complies — keep it that way).

## Fix 1 — relocate the "Snapshot, never live" caption beside the section header
File: `apps/dashboard/src/app/ticker/sections/DealerPositioning.tsx`.

Today the caption renders as a trailing block **below** the tile grid (currently lines ~72–74):
`"Snapshot, never live — these stay current on a stream drop and refresh with the data load."`
The owner wants it **on the same row as the `DEALER POSITIONING` section header** (currently the
`Typography variant="overline"` at lines ~33–35), reading as a header + inline annotation.

- Put the header title and the caption in one horizontal row: keep `DEALER POSITIONING` as the
  `overline` (same color/letter-spacing), and place the caption immediately to its right.
- Baseline-align them and give a small gap so the caption reads as a secondary annotation, not a second
  title. Keep the caption's muted styling (`color: 'text.disabled'`, caption-sized). A reasonable
  implementation: wrap both in a `Stack direction="row"` with `alignItems: 'baseline'`, `columnGap`,
  `flexWrap: 'wrap'` (so it wraps gracefully on a narrow viewport), replacing the standalone `mb: 1`
  overline; then **delete** the trailing caption block at the bottom of the component.
- **Copy is byte-identical** — do not reword the caption or the header.
- Do not change the grid, the tiles, or any tile value.

## Fix 2 — stop the GEX chart reference-line labels from overlapping
File: `apps/dashboard/src/app/gex-profile-chart.tsx`.

There are three `ReferenceLine`s — `spot` (primary, dashed), `flip` (warning, dashed), `live` (info,
solid, width 2) — each labelled via the shared `refLabel(...)` helper (line ~71) with
`position: 'top'`. Because `spot` and `live` each snap to the nearest plotted strike (`nearest(...)`),
when the live price and the spot/levels price are close (e.g. live $417.24 vs levels $420.60 → adjacent
strikes) the two **top-anchored labels render at the same height and overlap into an unreadable string**
(observed: `lispot $421`). The vertical lines themselves also crowd together.

**Goal:** every reference-line label stays individually legible no matter how close the lines are.

- **De-collide the labels.** Give the labels distinct vertical slots (and/or horizontal text-anchor) so
  they never sit on top of each other — e.g. stagger them into separate rows above the plot (one label
  per row), or offset each label's `dy`/`dx` + set `textAnchor` so adjacent labels read cleanly. Pick the
  approach that's robust when two lines snap to the **same or adjacent** strike (don't just shift by a
  fixed px that still overlaps at exact coincidence). A small per-line vertical offset (slot index) is
  the simplest reliable fix; a collision-aware offset (only nudge when the snapped strikes are within N
  categories) is also acceptable if cleaner.
- Keep each label's existing **color** (spot=primary, flip=warning, live=info) and the mono font so the
  label still maps to its line by color.
- Keep the lines themselves (dash patterns, the live line's `strokeWidth={2}`, colors) — those already
  differentiate them; only the **labels** must stop overlapping. If trivial, also ensure the chart's top
  `margin` leaves room for a staggered label row so nothing clips (currently `margin.top: 18`).
- Do not change `nearest(...)`, the data window, the bars, the tooltip, or any value. Labels/positioning
  only.

## Verification (the lane runs this)
- `npx nx test dashboard` green (≈412). If `DealerPositioning.spec.tsx` asserts the caption's DOM
  position (not just its presence), update that assertion to the new location — do NOT drop the
  text-presence check.
- **Render-verify via the preview MCP** (`preview_start dashboard` → :4300). For Fix 1, snapshot/inspect
  the Dealer Positioning header row and confirm the caption sits beside the title. For Fix 2, the
  reference-line labels are the whole point — load a ticker where spot and live are close (TSLA in the
  owner's screenshot: levels @ $420.60, live ~$417.24) and confirm `spot`, `flip`, `live` are each
  readable and non-overlapping. **Ticker full-page screenshots can hang** (SSE + charts) — if a
  screenshot times out, use `preview_snapshot`/`preview_inspect`, or stop+start the preview server; you
  may also scope a screenshot to the chart card if supported. Report what you observed.

## Definition of done
- Caption sits beside the `DEALER POSITIONING` header; trailing caption block removed; copy unchanged.
- The three GEX reference-line labels never overlap (verified at close spot/live); colors preserved.
- `npx nx test dashboard` green; lint clean; no `apps/api` file touched (`git diff --stat -- apps/api`
  empty).
- Hand back: files changed, the test count, and a concrete note on the render-verification of BOTH fixes
  (especially that the chart labels are now legible at close spot/live).
- **Do not commit** — the conductor verifies and commits on the branch.
