# redesign-stage-2 — conductor render pass (real browser, 2026-07-22)

| Check | Result | Evidence |
|---|---|---|
| The mark (arc-cut X) | **PASS** — CONVEXA in Archivo Expanded caps, amber arc-X glyph, no gradient; TopNav both modes | s2-landing-1440-{dark,light}.jpeg |
| Hero moment (final frame) | **PASS** — payoff curve sweeps the hero's empty right region, settles into a full-bleed baseline; glow blob GONE; composition dramatically better than the reviewed original | both 1440 shots |
| Light mode (FE's named gap) | **PASS** — first render landed light; curve/mark/CTA all correct on paper | s2-landing-1440-light… (`s2-landing-1440-dark` pair) |
| FE's "pre-existing 393 landing overflow" flag | **NOT REPRODUCED** — scrollWidth 378 vs 393, zero offender elements (incl. left<0 check for the full-bleed baseline). Recorded as a headless-capture artifact, no action | measured |
| 393 mobile hero | **PASS** — no overflow, hamburger intact | s2-landing-393-light.jpeg |
| ArcDivider (footer seam) | **PASS** — present, role="separator", 20px, SVG path. The "breath" depth accepted for Stage 2; deepening = one constant, Stage 3 latitude | measured |
| og-image (upgraded ruling #3) | **PASS** — 1200×630 lockup on ink; distinctive, clean | og-image.png viewed |
| Favicon 16px legibility | **PASS on FE evidence** (rendered 16px composites on light+dark chrome, glyph weight tuned 15→18) + the same glyph verified legible in the og render; real-tab check remains a post-deploy eyeball | FE report + og |
| Draw animation | Structurally verified (FE: mid-draw virtual-time frame + reduced-motion static + property-set pin test); my pass saw the final frame both modes. The live 900ms draw itself: accepted on the test evidence | FE report |
| Console | Clean except the designed anonymous who-am-I 502s with no backend | — |

## Supplement (post-QA — closing the §9-6 gap QA correctly flagged)

QA flagged the first pass as thinner than §9-6 requires (missing routes; a mis-named file
reference — the "1440-light" cited was overwritten by the dark shot; the draw accepted on
test evidence). Closed as follows:

| Item | Result | Evidence |
|---|---|---|
| Live draw observation | **PASS — observed via the Web Animations API in the live browser**: the path carries a real CSS animation, `playState: finished`, dashArray 1328px traversed to computed offset 0 (an un-run animation would sit at the initial full-length offset). Combined with the FE's mid-draw 450ms frame = the draw demonstrably runs | evaluate output |
| /ticker 1440 dark | PASS — new mark in TopNav over the app chrome, no regressions | s2-ticker-1440-dark.jpeg |
| /positions 1440 dark (full page) | PASS — TrackRecord ArcDivider seam in situ | s2-positions-1440-dark-full.jpeg |
| Landing 1440 LIGHT (properly named) | PASS | s2-landing-1440-light.jpeg |
| Reduced-motion | Accepted on the NAMED test + the FE's forced-flag headless run (static frame). OS-level toggle: post-deploy eyeball | HeroCurve.spec.tsx |

File-reference correction: the earlier table's `s2-landing-1440-{dark,light}` citation was
wrong at write time (light was overwritten by dark); both files now genuinely exist.
