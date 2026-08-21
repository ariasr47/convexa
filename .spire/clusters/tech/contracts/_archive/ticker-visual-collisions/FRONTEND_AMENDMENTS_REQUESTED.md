# Frontend amendments requested — ticker-visual-collisions

## GATE Z — live/mid label still bypasses collision layout

**Contested item:** SPEC AC-4, AC-5, §2, and §4 require the `live` / `mid` label to avoid fixed chart
captions and remain visibly associated with its marker line.

**Why the current build cannot stand:** the structure labels now use `layoutMarkerLabels`, but the
live/mid label still takes a separate `measureText` + horizontal clamp path. Its baseline remains at
`pad.t + plotH - 10`, while the fixed `− dealer γ` caption is painted at
`pad.t + plotH - 8`. When live/mid is at the left boundary, their text boxes occupy the same row and
intersect. The focused layout fixture covers put/call/flip/spot only, so it cannot reject this defect.
If live/mid lies outside the sample domain, the current clamp can also detach the visible label from
an off-canvas marker line without an explicit edge treatment.

**Closest buildable alternative:** include live/mid in a production-used, measured layout path that
reserves the bottom fixed-caption boxes (or equivalently move the fixed bottom caption into a reserved
non-intersecting lane). Clamp the label and its visible marker treatment together at both boundaries;
do not silently show a label detached from an invisible line. Add a rejecting regression with live/mid
at the left and right edges proving: complete in-bounds text, no intersection with `− dealer γ` or axis
labels, and an unambiguous visible association with the line/edge marker. Preserve wording, values,
colors, live/static semantics, and hover behavior.

**Owner:** frontend
**Demotion check:** none — this repairs, rather than contests, the standing live/static and structural
enforcement rules.

## GATE Z — amendment pass 2: live layout entered the static clock

**Contested item:** SPEC §2 and AC-4/AC-5/AC-7 require collision-safe live placement without changing
the chart's dual-clock isolation or accepting hollow coverage.

**Why the amended build still cannot stand:**

1. `makeKey` now includes `liveMid` and `live`, and `paintStructure` includes the live label in its
   static marker boxes. Every SSE price change therefore dirties and repaints the offscreen structure
   buffer, reversing the existing “static between structure-model changes” boundary. The live tape must
   not turn a structure snapshot into a per-tick structure redraw.
2. The new edge regression calls exported `layoutTapeLabel`, but production does not call that helper;
   production calls `layoutMarkerLabels` through a separate branch and re-implements connector logic.
   The test can stay green while the shipped live path regresses, and the helper is a production API
   used only by tests — both violate the TDD oracle and `[structural-over-prose-enforcement]`.

**Closest buildable alternative:** restore the original structure key (no `liveMid` / `live`). Keep
static put/call/flip/spot boxes in the offscreen structure pass. During the dynamic tape pass, call the
production `layoutTapeLabel` helper with the static boxes plus fixed captions as reserved rectangles;
use its returned `edgeTreatment`/`anchorX` for the connector instead of duplicating that decision.
The live edge test must then exercise the same production-used helper and reserve representative static
marker boxes as well as the bottom caption. Add a regression proving a changing live mid does not enter
the static structure key/repaint boundary (source-enforced or by an extracted production key function
with a non-vacuous mutation check). Preserve the already-correct Quick separator and static marker
collision behavior.

**Owner:** frontend
**Escalation note:** this is the second GATE Z bounce on the same feature; the next execution pass must
treat dual-clock isolation and a production-used oracle as release blockers, not optional refactors.

## Resolution — accepted 2026-08-15

- The static structure-buffer key again excludes `liveMid` and `live`; a regression proves changing
  live tape values keeps the key byte-identical while changing `gammaFlip` invalidates it.
- The dynamic tape paint now calls production-used `layoutTapeLabel` with static marker boxes and
  fixed captions reserved; connector behavior uses the helper's returned edge treatment.
- Focused Quick, GEX wrapper, marker-layout, and structure-key coverage passed 14/14; dashboard
  typecheck and production build exited 0.
- Amendment status: **RESOLVED**. Independent GATE Q verification remains required.

## GATE Q — independent verification bounce 2026-08-15

Amendments bounced to Frontend.

- **AC-4 — required automation depth:** expected an automated clustered-label matrix at 320px,
  600px, and normal desktop width that also reserves both fixed chart captions. Actual:
  `markerLayout.spec.ts` exercises one 320px-wide layout bounds case without fixed-caption reserves;
  independent runtime fixtures passed all three widths, but the `Verify by: test` requirement remains
  under-protected.
- **AC-7 — required interaction automation:** expected automation for Quick keyboard/focus/touch
  behavior and the production Canvas2D hover probe. Actual: Quick selected/click semantics and global
  focus/touch rules have partial coverage, while no automated test drives the chart hover probe;
  independent browser observation passed but cannot replace the required regression test.
- **AC-8 — configured suite/invariant:** expected `npx nx test @convexa/dashboard` and the relevant
  structural theme/motion checks to exit 0. Actual: the uncached configured suite exited 1 with 5 failed
  and 1762 passed tests; the focused structural rerun reproduced the `stage3-amber.spec.ts` failure.
  Forced typecheck and production build exited 0, `apps/api` diff/status remained empty, and no Critical
  changed-code security or integrity defect was found.

The two earlier live/mid bounce mechanisms remain **RESOLVED**: independent runtime observation found
zero static-label paints after a tape-only `liveMid`/`live` update, the static key stayed byte-identical,
and the production boundary label remained visibly attached to its edge marker.

## GATE Q bounce resolution — feature scope 2026-08-15

- **AC-4 resolved:** automated 320px / 600px / 1152px clustered-marker matrix now reserves both fixed
  captions and proves all boxes are in-bounds, pairwise non-intersecting, and caption-safe through the
  production `layoutMarkerLabels` path.
- **AC-7 resolved:** Quick buttons now have keyboard/focus/native-semantics coverage, and a production
  Canvas2D pointer test proves the hover probe exposes the strike/net-GEX readout.
- Focused result: 3 files / 16 tests PASS; typecheck and production build exited 0.
- **AC-8 remains an operator scope decision:** the configured suite has exactly the five accepted,
  pre-existing red files recorded before this feature (`stage3-amber`, `grouping.integration`,
  `orders.risk`, `positions.risk`, `positions/readonly`) and no sixth failure. Repairing those files is
  unrelated baseline cleanup, not part of the two requested visual fixes.

## Operator ruling — 2026-08-15

**A accepted.** Keep the work scoped to the two requested visual defects and their feature regressions.
Do not modify the five known pre-existing baseline failures. The strict configured-suite QA condition
may therefore remain red; this feature must not be committed, archived, or shipped without the owner's
later explicit approval. Recommended planning/spec/build choices may proceed automatically until that
approval boundary.
