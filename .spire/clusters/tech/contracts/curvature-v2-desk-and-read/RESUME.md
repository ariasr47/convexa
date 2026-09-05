# curvature-v2-desk-and-read — frontend build RESUME

**Resume status:** ACTIVE

**Branch:** `spire/curvature-v2-foundations` (do not push). Commits landed so far on top of
`e73c7b53`:

- `6d7116e1` — FE-1 (the branded liveness claim)
- `047eddef` — FE-2 (the stream retention latch)
- `84651e8d` — FE-3 (the shared stroke table, the canvas's theme input) — landed by the conductor
  from a lane's uncommitted work after a rate-limit kill; verified cold by the conductor.
- `b5251aa1` — FE-4 (the extracted pure paint step, the three live gates)

Working tree is clean at the time of writing. `npm run typecheck` **0**, `npx nx test
@convexa/dashboard` **0** @ **221 files / 2424 tests** (up from the 220/2417 baseline after FE-3),
`npm run lint` **0** (no new warnings). e2e not touched yet (that's FE-12).

---

## Done (FE-1, FE-2) — do not re-do

**FE-1 — the one liveness claim predicate.**
- `apps/dashboard/src/app/shared/liveness/liveClaim.ts` (new) — `LiveClaim` brand, `NOT_LIVE`,
  `isDeliveringLive`, `andPresent`. Byte-identical behaviour to the old
  `sessionTapeStanding.isDeliveringLive`.
- `sessionTapeStanding.ts` re-exports from `liveClaim.ts` (PLAN U-2: `shared/` cannot import
  `pages/`).
- `FigureCell.tsx` / `Widget.tsx`: `live?: boolean` → `live?: LiveClaim`. `Widget` also gained a
  separate `watch?: boolean` prop (OrdersWidget's open-orders fact, NOT a liveness claim) driving
  the SAME `widgetLivePulse` declaration via a **local** `const live = Boolean(liveClaim) ||
  watch;` — kept this way (not `...((live||watch) && ...)`) because
  `single-motion-moment.spec.ts`'s structural mutation proof matches the literal substring
  `...(live && !quiet && {` in the real source; do not change that shape without re-checking that
  spec.
- `OrdersWidget.tsx:144` — `live={watchingAny}` → `watch={watchingAny}`.
- `DealerPositioning.tsx` — all thirteen `live={false}` → `live={NOT_LIVE}` (mechanical, the file is
  deleted whole at FE-8; do not spend more effort on it).
- `liveClaim.spec.ts` carries the mutation-guarded source scan forbidding a second liveness
  expression in `pages/ticker/widgets/**`. **EXEMPT currently has THREE entries, not one** —
  `live-tape/LiveTape.tsx`, `chrome/TapePulseStrip.tsx` and `gex-profile-chart/GexStrikeProfile.tsx`.
  **FE-6 must remove all three entries in the same commit that fixes those two files** (re-point the
  LiveTape entry to `structure-hero/StructureHeroPanel.tsx`; delete the other two).
- `liveClaim.typeproof.spec.ts` — the `@ts-expect-error`/TS2578 compile-time proof.

**FE-2 — the retention latch.**
- `useStreamLatch.ts` (new) + spec — holds last non-null STREAM value, `retained` boolean, one reset
  token (`` `${symbol}|${replay?'replay':'live'}` ``).
- `copy.ts` — new `LIVE_TAPE_SUBTITLE_OFFLINE_EMPTY` constant + pin test.
- `LiveTape.tsx` — net flow, spread AND gamma flip each own a latch. Gamma flip's value/boolean
  come **only** from the latch, never `?? m.gamma_flip`. Label is `Gamma flip · live` / `Gamma flip
  · session tape`, never the old ternary.
- Row **16 is BLOCKED — GATE Z** per PLAN's own STOP block, **but that block is now LIFTED** — the
  launch brief for this session says criterion 16 was split at GATE Z into **16a**/**16b** and
  PLAN.md's row-16 block no longer applies. FE-2's substance (the reset-token half) already covers
  16a/16b; no further action needed on this specific item beyond recording it in the eventual
  `BUILD_REPORT.md`.
- `LiveTape.spec.tsx` carries the criteria 12/13/15/15b/17/18 block.

## Done (FE-3) — do not re-do

New `shared/charts/structure-field/levelStrokes.ts` (the shared stroke table, token keys not
colours — `resolveLevelPalette(theme)`). `StructureFieldCanvas.tsx` gained `palette`/`surfaces`
props (replacing ten module-level hex literals). `hex-discipline.spec.ts`'s exemption list now
carries `structureFieldShared.ts` (lab-only), `labTokens.ts` (out of scope) and
`chrome/TapePulseStrip.tsx` (FE-6's, not yet fixed) — **three entries, not four**; `StructureField
Canvas.tsx` itself is no longer exempt (it now paints from props).

## Done (FE-4) — do not re-do

**FE-4 — the extracted pure paint step, the live gates, and the motion mechanism that actually
bites.** Owns: new `shared/charts/structure-field/paintStep.ts` (+spec), new
`shared/charts/structure-field/recordingContext.ts`, `StructureFieldCanvas.tsx`,
`shared/theme/single-motion-moment.spec.ts`, `shared/hooks/useFlashOnChange.spec.tsx`.

**State found at start of this task (read carefully if you doubt this later):** FE-4 was
**entirely unstarted** — no `paintStep.ts`/`recordingContext.ts` existed. The RESUME note claiming
"`StructureFieldCanvas.tsx` already shows `m.live` gating around the trail and mid pulse (`:601`,
`:621`, `:626`)" was accurate but incomplete: those three lines were the ONLY `m.live` gates in the
file. Sweep, particles and drift had none — verified by reading the tree fresh, not by trusting the
plan's line numbers (which had shifted).

**What shipped:**
- `paintStep.ts` — `paintStructureStep(m, ctx, geom, palette, surfaces)` (returns `MarkerLayoutBox[]`,
  a deviation from the plan's illustrative `void` return — needed so the frame step's tape label can
  avoid the same collisions the structure step already solved) and `paintFrameStep(m, ctx, geom,
  frame, now, reduced, palette, surfaces, hover?)`. `Geometry`/`FrameState`/`Pad` types,
  `computeGeometry`/`emptyFrameState`, and the moved-verbatim helpers (`fmtM`/`relAge`/`probeLabel`/
  `strokeSmooth`/`roundRect`/`gexAt`) plus a NEW `driftAmplitude(li, now, reduced, calm)` pure
  function (see below for why it had to be its own export).
- **The three live gates, resolved against a real tension between SPEC rows 20 and 22** (read
  `paintStep.ts`'s module doc before touching any of this again):
  - **sweep + the flip-well breath** — folded into ONE gate, `!reduced && m.live` (both are gradient
    fills; SPEC row 20's recorder groups them as one "sweep gradient fills" bucket; neither has a
    row-22 static-frame requirement, so fully binary is correct).
  - **particles** — `!reduced && m.live`, unchanged shape from before, live gate added.
  - **drift (warped field lines)** — `if (m.live) { amp = driftAmplitude(...) }`, where
    `driftAmplitude` returns a FIXED constant when `reduced` (a genuine static frame — same value at
    every `now`) and a time-varying value otherwise. This is the ONE motion that must satisfy BOTH
    "stops on a drop" (row 20) AND "renders as a static frame under reduce" (row 22, review) —
    they'd contradict on a bare `!reduced` gate. Pulled into its own exported function because the
    recording context's `strokeStyle` bucket for drift does NOT depend on `amp` (only the path shape
    does), so proving "static" needed a direct unit test on the pure amplitude function, not the
    recorder.
  - **Deliberately NOT gated further:** the tape bead/ring/beam/dashed-line/label. They're the
    persistent last-known-mid marker (F6, "full strength, no dot, no pause mark" for session-tape/
    replay) — not an ambient liveness animation — and criterion 20's actual machine check (SPEC row
    20's own "against a recording 2D context" clause) names only trail points, particle `arc()`
    calls, sweep gradient fills, and non-zero level strokes. The `pulse` variable already collapses to
    a fixed 0.35 whenever `!m.live || reduced`, which is what gives the beam its row-22 reading
    without a dedicated gate.
- `recordingContext.ts` — buckets `trailPoints` (arc radius exactly `2.2`, the trail dot's one
  hardcoded value), `arcs` (everything else — safe because the criterion-20 test fixtures leave
  `liveMid: null`, so the tape bead/hover never run and the only other arc source is particles),
  `gradientFills` (every `createLinearGradient`/`createRadialGradient` — reset to 0 by the TEST right
  after the structure step, since that step's own vignette/blooms/heat-columns/area-fill are
  `m.live`-independent and would otherwise pollute the "did the frame step draw a gradient" question),
  `strokes` (exact `strokeStyle` per `stroke()` call — level lines use raw palette colours, everything
  else wraps in `withAlpha`, so exact-equality filtering is a real bucket), and `lineToCalls` (added
  DURING this task, past what the plan's illustrative `Recording` interface named — needed to prove
  drift's own `if (m.live)` gate, since SPEC row 20 names drift as something that stops but gives it
  no dedicated machine metric in its own text).
- `single-motion-moment.spec.ts` — doc comment extended (no logic change) naming both motion blind
  spots (Canvas2D rAF loops declare no `@keyframes`; `useFlashOnChange`'s dynamic name is
  deliberately exempt) and pointing at `paintStep.spec.ts`/`useFlashOnChange.spec.tsx` as the real
  enforcement.
- `useFlashOnChange.spec.tsx` — two new tests for the mid-flash-clear behaviour
  (`useFlashOnChange.ts:57-59`): clears when `active` flips false mid-flash, clears when reduced
  motion turns on mid-flash (needed a `reducedMotionController` helper — the existing
  `setReducedMotion` stub can't flip AFTER mount because `useReducedMotion`'s effect only reads
  `matchMedia()` once).

**Mutation proofs actually run (poison → confirm red → revert), exact numbers in `paintStep.spec.ts`
and `useFlashOnChange.spec.tsx`'s own doc comments** — do not re-derive, just re-read those comments
if you need the captured output. **One honest finding, not a gap:** the PLAN's suggested proof for
`useFlashOnChange.ts:45` (remove `!active` from the FIRST effect alone) does **not** produce a red
build — the SECOND effect's own independent `!active` check catches it first. This is a real
interlock, not a vacuous test; the mutation that actually isolates the new behaviour is poisoning the
second effect directly, which IS proven red.

**Lint note:** the refactor initially introduced a NEW `react-hooks/exhaustive-deps` warning
(`StructureFieldCanvas.tsx`'s effect now hands the whole `pad` object to `computeGeometry`, so the
rule wants `pad` itself in the deps array, but `pad` was a fresh object literal every render). Fixed
by wrapping `pad` in `useMemo(..., [embedded])` — `pad`'s value is purely a function of `embedded`
anyway. Lint is back to the pre-existing warning count (0 new).

**Browser check, honestly scoped:** served the dashboard, screenshotted `/lab/structure-field`
(dark, light, reduced-motion) via a throwaway Playwright script (not committed). The default demo
model (`live: true`) renders correctly in all three settings — walls, flip, live mid beam/trail,
TAPE LIVE pill, no new console errors (only the expected 502s from the API not being served). Did
**not** verify the `live: false` state in-browser — the lab page's "Use live SPY structure" button
needs a running Rust API to reach it, and criterion 20's `test` mark is already fully covered by the
mutation-proven `paintStep.spec.ts`; criterion 22 is `review`-only. If a later lane wants full
browser coverage of the drop state, start `npx nx serve api` alongside the dashboard first.

## GATE Z item already flagged (not new)

Criterion 16 split into 16a/16b — FE-2 (done) implements only the provable substance via the reset
token. The launch brief for THIS session states the split is now settled (16a = symbol change /
16b = replay arm) and PLAN.md's own row-16 block predates that split. Record it in the eventual
`BUILD_REPORT.md`; no further action needed from a later lane on this specific item.

## Known deviations to carry into the build report (FE-14)

1. `DealerPositioning.tsx` was edited by FE-1 (the `NOT_LIVE` mechanical fix) even though PLAN.md's
   Independence table does not list it under FE-1's paths — necessary because FE-1's brand change is
   a breaking API change every existing consumer must satisfy immediately. The file is deleted whole
   at FE-8.
2. `paintStructureStep` returns `MarkerLayoutBox[]` where PLAN's illustrative code block showed
   `void` — needed so the frame step's tape label can reuse the structure step's marker-collision
   layout without a second global ref. No test depends on the literal `void` return type.
3. `recordingContext.ts`'s `Recording` interface has a `lineToCalls` field the plan's illustrative
   interface didn't name — added because SPEC row 20 names drift as something that stops on a drop,
   but the plan's own suggested metrics (trail points / particle arcs / sweep gradient fills) give it
   no automated proof; `lineToCalls` closes that gap.

## Also worth flagging, not caused by this session

`git diff --name-only $(git merge-base main HEAD)..HEAD -- apps/api` still returns **107 files**
(unchanged from the FE-1/FE-2 checkpoint) — all pre-date this branch's frontend work. Confirmed again
after FE-4: `git status --short -- apps/api` on this session's own working tree returns nothing. This
is BE-1's check to run and report, not something a frontend lane caused or can fix.

---

## Next: FE-5 (not started)

**FE-5 — the level ladder: five rows, closed union, the anchor, and D-14's literal.** Owns: new
`pages/ticker/widgets/level-ladder/{ladderModel.ts,ladderModel.spec.ts,LevelLadder.tsx,
LevelLadder.spec.tsx,LadderFoot.tsx,index.ts}`. Depends on FE-1 (done), FE-3 (done).

Read PLAN.md's FE-5 section fresh (around line 1007 in the copy read this session — **re-check the
line number, it drifts**) before starting. Key traps already named there:
- **The distance anchor is the LEVELS SPOT (`gex_spot ?? price`), never the mid** — anchoring on the
  mid would silently change every distance the trader has read for months.
- **D-14 (DELEGATED):** the absent-level literal is `—` (`ABSENT_LEVEL`), one constant — reversal is
  one line if the owner reverses D-14.
- **The mid row's distance is ALWAYS `—`** (`ABSENT_DISTANCE`), never a computed zero — a computed
  mid distance would be "anchor drift wearing the column's label", not a real zero.
- **Exactly five rows, closed union, sorted by computed price** — a null level never removes a row;
  rows with no price sink to the bottom in declaration order.
- **`resolveLevelPalette(theme)` (FE-3, done) is the stroke source** — the ladder's row ticks must
  read from the SAME resolved object the canvas receives, by identity, not a second table.
- **Criterion 2's exact words** (`Call wall`, `Put wall`) are the e2e readiness anchor
  (`no-overflow.spec.ts:398`) — FE-12 re-anchors it later, but FE-5 must keep the words exact now.

## Process notes for whoever continues

- Read PLAN.md/SPEC.md/INTERFACE_CONTRACT.md/council/decisions.md fresh — do not trust a prior
  session's paraphrase of them (including this file's). This session found the RESUME's own claim
  about FE-4's starting state was accurate but incomplete — always verify against the tree.
- Delete `apps/dashboard/dist`, `apps/dashboard/out-tsc`, `*.tsbuildinfo` and rebuild
  `tsconfig.app.json` **before** `tsconfig.spec.json` any time typecheck output looks phantom.
- Every mutation proof: actually run the poisoned variant, actually see it go red, actually revert.
  This session found one of the PLAN's own suggested proofs (useFlashOnChange.ts:45 alone) does not
  actually produce a red build due to a second independent guard — reported honestly rather than
  claimed as passing; do not assume a plan's phrasing of "should fail here" is itself evidence.
- `npx nx format:write --files <comma-separated-list>` only — never bare.
- Node/npx: prepend `C:\nvm4w\nodejs` to PATH in this shell if missing.
- `npm run ports:free` sweeps IPv4 and IPv6 before/after any serve; this session served the dashboard
  alone (no backend) for a browser check — killed it cleanly afterward.
