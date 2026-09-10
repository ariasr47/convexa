# Repair task — structure hero fidelity on `/ticker` (owner-directed, 2026-09-07)

**Owner:** *"Just fix the ticker screen for now."* Route chosen: direct repair lane, off the council pipeline.
The design source is the spec; `STRUCTURE_HERO_REVIEW.md` (this folder) is the findings list. Scope is the
structure hero on `/ticker/:ticker` only — the masthead, read strip, AI read and context band are **not** in
scope; the other surfaces (scanner, positions, alerts, settings) are **not** in scope.

## Target

`design/src/screens/desk.mjs` `fieldPanel` (`:289-333`) and `DESK_CSS` (`:19-25, 50, 53, 67`),
`design/src/components/ladder.mjs`, `design/src/lib.mjs` `structureField` (`:249-318`), `magnetView`
(`:320-341`), `widgetHead` (`:439-448`). Rendered oracle: `design/site/desk.html` (serve `design/site/`
statically and open it beside the app).

## Must not change (semantics phases 1–3 paid for)

- The single store read in `StructureHeroPanel`; the branded `LiveClaim`; `useStreamLatch`; the ladder's
  five-tuple (`buildLadder`) and its offline / replay arms; `Mid` unconditional; the pause mark + dim +
  `offline · last known` on a genuine drop; `NOT_LIVE` on the foot cells; the closed not-a-number vocabulary;
  `figureStateOf` / `faceFor` as the state and face authority; the palette / surfaces handed down **by
  identity** to canvas, ladder and tape row.
- `paintStep.ts`'s three live gates (criterion 20) and the reduced-motion static frame (22).
- Canon 11 (the field's diverging form), 13 (type register), 14 (ladder), 18 (one connection chip), 24.
- `apps/api` diff stays **0**. `OrderRow.tsx:172` untouched. No literal NUL bytes. LF only.

## Changes (S1 first)

1. **Composition** — `StructureHeroPanel` body becomes the design's grid: `minmax(0,1fr) 300px` (340 when the
   panel container ≥ 1600), the ladder column with a left hairline and `padding: 12px 18px 14px`, the foot
   pinned to the column's bottom (`margin-top: auto`, top hairline). Use `theme.containerQueries('panel')`
   (the Widget body **is** the `panel` container) — below 1000 the grid is one column and the ladder rows
   become a 5-cell row; below 768 a 2-column grid. Field-main `padding: 10px 6px 0`.
2. **Ladder rows** — one line each: tick (14 px, the level's own stroke, dashed for max pain) · label 12 px
   steel · value Mono 14 px 500 · distance Mono 11 px steel right-aligned (`min-width: 52px`); 7 px vertical
   padding, hairline between rows; the **mid** row 18 px 600 with the `tape` chip when the claim is live.
   Keep the state machinery: add a compact **row layout** to `FigureCell` (or a sibling that reuses
   `figureStateOf` / `FigureMarks`) rather than hand-rolling states; the offline caption takes the distance
   slot on the mid row (its distance is `—` by construction). Header line: `Levels` caps left,
   `distance from levels @ {anchor}` Mono 11 right — the anchor stays stated **once**.
3. **Field window** — replace `windowedStrikes`'s `spot ± 10 %` with: lo/hi = walls ± max(1.5 % of spot,
   25 % of the wall span), then widened only as far as needed so `gammaFlip` and `maxPain` are inside, then
   clamped to the available strikes. Keep the export shape; update `chart.spec`/callers.
4. **Field axis + labels** — strike ticks at a round step (choose from 1 / 2.5 / 5 / 10 / 25 so 5–8 ticks
   fit) along the bottom, `±$<max>M` and `0` on the left, both Mono 10 steel; level labels **above** the
   plot in Mono 10 600 in the level's colour — `put wall 760`, `call wall 780`, `flip 771.10`,
   `max pain 751` — using the existing `layoutMarkerLabels` lane logic for collisions; the `spot $…` label
   is **removed** (the spot line stays, thin steel, unlabelled — it is the ladder anchor, not a second
   price); the tape label becomes **one pill on the zero line**: `● mid 770.19` when live, `○ mid 770.19`
   when retained/offline (same `m.live` branch the label already has), panel fill with a signal stroke.
5. **Max pain in the field** — add `maxPain: number | null` to `StructureFieldModel`, draw it dashed
   (`[3,3]`) in `palette.maxPain`, 1 px, in `paintStructureStep`, gated like the other level strokes so
   `paintStep.spec.ts`'s stroke census still holds (extend the census if it counts).
6. **Header** — title `Structure field`; subtitle `Net dealer gamma by strike · {expirations label} · levels
   are REST structure (as-of {age}) · the mid is tape`; a legend in `actions` (`■ call-dominated`,
   `■ put-dominated`, `— flip`, 11 px steel, hidden below 768 container); toggle text `Field | Magnet`
   (testids `dealer-view-levels` / `dealer-view-magnet` stay). Keep the `info` prop.
7. **Tape row** — `TapePulseStrip` loses the card chrome (no border, radius or own background); it is a flat
   row with a top hairline: caps `Tape · 5m mid trail` left, the fluid canvas 30 px tall, then the existing
   `Mid` readout (with its pause mark) and `Structure` readout right, Mono 11. Keep every testid.
8. **Path row** — `StructurePathStrip` loses its own background and bottom border; flat row with a top
   hairline: caps `Structure path · slow lane`, then `score` spark + delta, `dist to flip` spark + delta,
   the `n samples · window` note right in steel-2. Keep testids and the empty / error / loading arms.
9. **Foot** — the two cells at Mono 18 500 with sub-lines `primary magnitude` / `secondary` (11 px steel);
   compact, no card chrome, `NOT_LIVE` kept.
10. **Magnet** — `WallMagnetView` takes `palette` + `surfaces` props (delete the module hex literals and its
    `hex-discipline.spec.ts:64` exemption), height 300 to match the field, band 68 px, the reading line
    `{±x.xx}% {above|below} the flip · dealers dampen moves here` in Sans 11 steel, footnote
    `Magnet view · structure levels · a display metaphor, not a forecast`.

## Verification the lane owes (exit codes, not printed summaries)

- `npx nx typecheck @convexa/dashboard --skip-nx-cache` → 0
- `npx nx test @convexa/dashboard --skip-nx-cache` → 0 (delete `node_modules/.vite` first if a phantom
  `_mutation_poison_*` failure appears). Assertion edits are allowed **only** where an assertion pinned
  layout or copy this task changes; list each one with the reason.
- `npm run lint` → 0 · `npm run format:check` scoped to the files touched → 0
- `git diff --stat origin/main...HEAD -- apps/api` → empty
- Playwright screenshots of `[data-testid="widget-structure-hero"]` at 1280, 1000 and 393 (dark) and 1280
  light, saved outside the repo, paths reported; hero height at 1280 reported (target ≈ 490–560 px).
- e2e: `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e -- --grep "desk|curvature|overflow"`
  against the production build after `npm run ports:free`; report pass/fail counts and exit code.

## Rules

Never `git stash` (another process holds 27 untracked files under `docs/research/`); never a bare
`nx format:write`; write large files with the Write tool; conventional commits with scope on this branch
(`fix(dashboard): …`), no push. Verify every anchor above with `grep -n` before acting on it — several
drifted during phase 3.
