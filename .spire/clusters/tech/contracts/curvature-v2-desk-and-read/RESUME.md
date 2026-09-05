# curvature-v2-desk-and-read — frontend build RESUME

**Resume status:** ACTIVE

**Branch:** `spire/curvature-v2-foundations` (do not push). Commits landed so far on top of
`e73c7b53`:

- `6d7116e1` — FE-1 (the branded liveness claim)
- `047eddef` — FE-2 (the stream retention latch)
- `84651e8d` — FE-3 (the shared stroke table, the canvas's theme input) — landed by the conductor
  from a lane's uncommitted work after a rate-limit kill; verified cold by the conductor.
- `b5251aa1` — FE-4 (the extracted pure paint step, the three live gates)
- `2fbfd6c2` — FE-5 (the level ladder) — see "Done (FE-5)" below.
- `95078372` — FE-6 (the structure-field hero) — see "Done (FE-6)" below.

Working tree is clean at the time of writing (post-FE-6 commit). `npm run typecheck` **0**, `npx nx
test @convexa/dashboard` **0** @ **226 files / 2474 tests** (up from the 224/2460 baseline after
FE-5: +2 files, +14 tests), `npm run lint` **0** (no new warnings, same one pre-existing
`react-hooks/exhaustive-deps` warning in `useSessionArchive.ts`, unrelated to this branch). e2e not
touched yet (that's FE-12). **Nx's own `test` target flaked once mid-session** (printed "1 error"
alongside "225 passed" — the exact `printed passed but exits non-zero` trap this repo's CLAUDE.md
warns about) and Nx auto-retried to a clean 226/2474; a direct `npx vitest run` from
`apps/dashboard/` (bypassing Nx's cache/retry layer) reproduced the clean 226/2474 deterministically
twice more — the flake was environmental (Nx orchestration), not this session's code. If you see a
similar one-off red with an otherwise-green summary, re-run via plain `vitest run` before treating it
as a real regression.

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

## Done (FE-5) — do not re-do

**FE-5 — the level ladder: five rows, closed union, the anchor, and D-14's literal.** Owns: new
`pages/ticker/widgets/level-ladder/{ladderModel.ts,ladderModel.spec.ts,LevelLadder.tsx,
LevelLadder.spec.tsx,LadderFoot.tsx,LadderFoot.spec.tsx,index.ts}`.

**What shipped, near-verbatim to PLAN's illustrative Step-1 code** (`ladderModel.ts`): `ABSENT_LEVEL`
/`ABSENT_DISTANCE` both `'—'` (D-14), `LadderRow`/`LadderInput` types, `buildLadder()` returning the
closed five-tuple, sorted by computed price with null-priced rows sinking to the bottom in
declaration order. One addition beyond the plan's fenced code: `formatAnchorText(anchor)` — a small
exported helper (reuses the same `price()` formatting rule) so the header states the anchor once
without duplicating the `$<n>`-or-`ABSENT_LEVEL` logic; no test depends on it existing as a separate
export, it's just where the header's format call now lives.

`LevelLadder.tsx` — renders the five rows through `FigureCell` (`register="traced"`), each with a
tick (`LadderTick`) reading `palette[row.stroke]` via an exhaustive `tickColor()` switch (`never`
default arm) — the SECOND compile-time exhaustiveness gate PLAN asked for, alongside `buildLadder`'s
`LadderRows` return type. **`LevelLadder` is PRESENTATIONAL, not a `LadderInput` consumer** — its
props are `rows: LadderRows`, `anchorText: string | NotANumber`, `palette: LevelPalette`, all
pre-computed by the caller. This was a mid-task correction: the FIRST version had `LevelLadder` take
`input: LadderInput` and call `buildLadder`/`formatAnchorText` internally, which typechecked and
passed its own tests fine — but PLAN's own FE-6 section (`## FE-6`, "Step 1 — the panel host") shows
the intended host call site verbatim: `<LevelLadder rows={rows} anchorText={anchorText} />`, and
explains WHY: `StructureHeroPanel` is "ONE component … SINGLE STORE READ … derives the branded claim
once and passes it and the mid DOWN AS PROPS. That is the structural reason the four regions are
presentational children." A `LevelLadder` that re-derives rows from raw input would have been the
one non-presentational child, forcing FE-6 to either edit a file it doesn't own (`level-ladder/**`
belongs to FE-5) or hand it awkward pass-through props. Caught and fixed BEFORE commit by reading
FE-6's section fully, not left for FE-6 to discover. `palette: LevelPalette` is still a required
prop, never computed internally — the caller (FE-6's `StructureHeroPanel`) passes the SAME
`resolveLevelPalette(theme)` object the canvas receives, which is what makes criterion 7's identity
check meaningful. Header renders `` `distance from levels @ ${anchorText}` `` once, above the rows,
from the `anchorText` prop (built by the caller via `formatAnchorText(anchor)`).

`LadderFoot.tsx` — Vol-norm GEX + Raw GEX (1% shock), tooltip copy copied byte-for-byte from
`DealerPositioning.tsx:122-143` (confirmed by direct string comparison in `LadderFoot.spec.tsx`,
including the `unavailable`/input-dependency arm).

**NOT wired into any page yet — this is deliberate, not a gap.** FE-5's PLAN.md Independence row
owns only `level-ladder/**`; `TickerDashboard.tsx`/`DealerPositioning.tsx`/`widgets/index.ts` are
untouched (the last of those is FE-8's path, since deleting `DealerPositioning` is when the barrel
gets re-pointed). Mounting the ladder into the real desk is FE-6's job
(`StructureHeroPanel`, which composes field + ladder + tape trail).

**Deviation from PLAN's enumerated `Owns` file list (additive, in-lane):** added
`LadderFoot.spec.tsx`, which PLAN's file list for FE-5 does not name (criterion 6 is `review`-only,
so PLAN's authors reasonably didn't mandate a spec for it). Added anyway as cheap regression
insurance on a byte-for-byte tooltip copy from a file FE-8 deletes whole — 5 tests, all passing,
asserting the exact tooltip strings via the `title` attribute MUI's `Tooltip` sets natively (see
below for why not a full open/close interaction test).

**One honest testing finding, not a gap:** `LadderFoot.spec.tsx` originally drove full Tooltip
open/close cycles (`help.focus()` + `Enter`, mirroring `FigureCell.spec.tsx`'s own pattern) for the
byte-for-byte copy checks. Two of the three cases went reliably red when run as part of the full
file (each passed in isolation) — a real MUI Popper/Transition timing interaction across a fast
`cleanup()`/remount boundary in jsdom, not a flaky assertion. `FigureCell.spec.tsx` already proves
the ⓘ control's open-on-tap/Enter/Space mechanics once, for every call site, so re-driving that same
mechanism per LadderFoot case wasn't buying new coverage — switched to asserting MUI's native
`title` fallback attribute (present on the child regardless of open state) instead, which is both
more reliable and a more direct check of copy fidelity.

**Mutation proofs actually run (poison → confirm red → revert), both against a clean baseline of 18
green `ladderModel.spec.ts` tests:**
1. Replaced the mid row's `distance: ABSENT_DISTANCE` with `distance: dist(input.mid, input.anchor)`
   — the "mid row distance is always the not-applicable member" test went red naming the actual
   computed string (`'at spot'` for the coincident anchor/mid fixture used), not merely "not '—'".
   Reverted; 18/18 green again.
2. Replaced `rows.sort((a, b) => numeric(b) - numeric(a))` with a no-op (fixed declaration order) —
   BOTH the crossing-case test (put wall priced above mid) AND the null-sinks-to-bottom test went red
   (`callWall` at index 0 instead of `putWall`; `mid` at the tail instead of `callWall`). Reverted;
   18/18 green again.

**Browser check, actually done (not skipped as "not wired yet").** LevelLadder has no page consumer
until FE-6, so the running desk can't show it — but rather than settle for DOM-test evidence alone,
mounted it TEMPORARILY into the existing `/lab/structure-field` lab page (which already resolves
`resolveLevelPalette(theme)` for the canvas, so it was a ~20-line addition), served the dashboard,
screenshotted dark (1280×1400), light (1280×1400) and a 393px-narrow dark viewport via a throwaway
Playwright script (not committed, run from repo root as `_tmp_shot.mjs`/`_tmp_shot2.mjs`, deleted
after). Confirmed in all three: five rows present, sorted by price (Call wall → Mid → Gamma flip →
Put wall → Max pain, with the null Max pain sinking to the bottom showing `—`/`—`), ticks colour-
matched to the field's own wall/flip lines, exactly one live dot (on Mid), anchor line rendered once
above the rows, mid row's own distance line reads `—`, no horizontal overflow at 393px, zero new
console errors (only the pre-existing 502s from the API not being served). Reverted the temporary
`StructureFieldLab.tsx` edit, confirmed via `git status --short` it was byte-identical to its
committed state, killed the dev server, ran `npm run ports:free`. **Re-did this whole cycle a second
time** after the presentational-props correction above (fresh temp mount using the
`rows`/`anchorText` shape, fresh typecheck, fresh serve, fresh screenshot at 1280×1000 dark) —
pixel-identical render, zero console errors, reverted and ports freed again, confirmed clean a second
time. Two full serve/screenshot/revert cycles this session, both left the tree clean.

**One cosmetic, non-defect observation from the browser check:** the demo model's live mid renders
as a raw unrounded float (`$512.801474784933`) in the ladder's Mid row. This is the demo fixture
feeding an unrounded float into `price()`, which formats via bare template interpolation — the same
formatting rule DealerPositioning's shipped call/put/max-pain cells already use (no `.toFixed()`
anywhere in the precedent either). Not a defect introduced by this task; real market-state numbers
are whole-dollar strikes in practice (per `distanceToLevel.ts`'s own module doc). Not fixed — fixing
it would mean changing `price()`'s formatting rule beyond what PLAN's Step 1 code specifies, which is
out of this task's delegated scope.

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
4. FE-5 added `LadderFoot.spec.tsx`, one file beyond PLAN's enumerated FE-5 `Owns` list (which names
   `ladderModel.ts`/`.spec.ts`, `LevelLadder.tsx`/`.spec.tsx`, `LadderFoot.tsx`, `index.ts` but no
   `LadderFoot.spec.tsx` — criterion 6 is `review`-only). Added as cheap regression insurance on a
   byte-for-byte tooltip copy from a file FE-8 deletes whole. Still entirely inside `level-ladder/**`.
5. FE-5 added `formatAnchorText()` as a small named export in `ladderModel.ts`, beyond PLAN's fenced
   Step-1 code block (which computed the header's anchor text inline at the call site). No test
   depends on it being a separate export; it just centralizes the same `$<n>`-or-`ABSENT_LEVEL` rule
   `price()` already encodes, so the header doesn't duplicate that logic.

## Also worth flagging, not caused by this session

`git diff --name-only $(git merge-base main HEAD)..HEAD -- apps/api` still returns **107 files**
(unchanged from the FE-1/FE-2 checkpoint) — all pre-date this branch's frontend work. Confirmed again
after FE-4: `git status --short -- apps/api` on this session's own working tree returns nothing. This
is BE-1's check to run and report, not something a frontend lane caused or can fix.

---

## Done (FE-6) — do not re-do

**FE-6 — the structure-field hero: one `Widget`, four presentational children, one store read.**
Owns (as landed): new `pages/ticker/widgets/structure-hero/{StructureHeroPanel.tsx,
StructureHeroPanel.spec.tsx,TapeTrailRow.tsx,TapeTrailRow.spec.tsx,index.ts}` ·
`pages/ticker/widgets/chrome/TapePulseStrip.tsx` + `.spec.tsx` (rewritten, not `index.ts` — see
deviation below) · `pages/ticker/widgets/gex-profile-chart/{GexStrikeProfile.tsx,chart.tsx}` ·
`pages/ticker/widgets/structure-hero/WallMagnetView.tsx` (moved, `git mv`, from
`dealer-positioning/`) · `shared/charts/structure-field/StructureFieldCanvas.{tsx,spec.tsx}` (a11y
wrapper + its own new test) · `shared/liveness/liveClaim.spec.ts` (EXEMPT list) ·
`shared/theme/hex-discipline.spec.ts` (EXEMPT list).

**What shipped, and where it deviated from PLAN's illustrative snippet (all deliberate, reasoned in
each file's own module doc — read those before re-deriving):**

1. **`StructureHeroPanel` renders `StructureFieldCanvas` DIRECTLY, never through
   `gex-profile-chart/GexProfileChart`.** `GexProfileChart` resolves its OWN `palette`/`surfaces` via
   its own `useTheme()` call (needed so its still-live standalone call site keeps working) — routing
   the hero's canvas through it would give the ladder a DIFFERENT palette object than the canvas,
   breaking criterion 7's identity requirement. Instead `StructureHeroPanel` builds the
   `StructureFieldModel` itself, reusing `chart.tsx`'s exported pure `windowedStrikes`/
   `rowsToSamples` helpers (the latter promoted from private to exported, additive) so the model
   shape never drifts from the standalone widget's own.
2. **`GexStrikeProfile.tsx` keeps its own `useLiveTape()` read** (fixed to compose via
   `isDeliveringLive`/`andPresent` instead of `tape.isLive`) rather than becoming prop-driven — it is
   a STANDALONE widget outside `structure-hero/`, not one of the hero's four children, so SPEC
   §2.1's single-store-read invariant (scoped to `structure-hero/` by the reviewer probe's own
   wording) does not apply to it. Its unused `liveSpot` override prop was ALSO dropped (dead code —
   no call site anywhere ever passed it).
3. **`TapePulseStrip.tsx` became FULLY presentational** — no store read at all, not even an optional
   fallback. Required props: `claim: LiveClaim`, `mid: number | null` (already latch-resolved by the
   caller), `lastTrade?`, `palette: LevelPalette`, `surfaces: StructureFieldSurfaces`. This broke the
   OLD standalone mount in `TickerDashboard.tsx:504` (not touched by FE-11 yet) — fixed by computing
   the same claim/mid/palette/surfaces INLINE there via the canon composers (mirrors FE-1's
   `DealerPositioning.tsx` precedent: a breaking prop-shape change forces every existing consumer to
   satisfy it immediately). `chrome/index.ts` did NOT need editing — it still just re-exports the
   file, which kept its name and location.
4. **The `liveClaim.spec.ts` EXEMPT list ended at TWO entries, not one** (GoogleButton-style
   permanent entries aside) — `TapePulseStrip.tsx` and `GexStrikeProfile.tsx` entries were removed
   (both fixed), but the `live-tape/LiveTape.tsx` entry was **investigated and deliberately kept**,
   not re-pointed to `StructureHeroPanel.tsx` as PLAN's own prose suggested. Measured against the
   ACTUAL shipped `LiveTape.tsx` (FE-2): its `numbersActive` derivation genuinely needs the store's
   raw `isLive` flag for a documented, real reason (blind to `market_session`, true during
   session-tape playback — see that file's own `:77-90` comment) that is NOT the same question
   `isDeliveringLive` answers. Re-pointing away from it would have meant either changing FE-2's
   already-verified behaviour, or renaming a variable purely to dodge the mutation-guarded regex —
   gaming the guard the test exists to prevent. `StructureHeroPanel.tsx` needs NO entry: written
   using only `isDeliveringLive`/`andPresent`, it never trips the BANNED patterns. **One real trap
   hit and cleared while writing this fix: the doc comments EXPLAINING the old `tape.isLive`/`isLive
   &&` bugs themselves matched the mutation-guarded regex** (it scans raw file text, comments
   included) — three files' module docs had to be reworded (never spelling the literal
   `tape.isLive`/`isLive &&` substring) before the suite went green.
5. **The ladder's mid row does NOT get offline/pause-mark treatment in this task — a named, honest
   gap, not a silent drop.** SPEC §4.1's "Level ladder" row states "only the mid row dims, with the
   pause mark" on a drop, but FE-6's own assigned criteria (9, 10, 11, 19, 20, 21, 22, 23, 24, 52)
   never test this, PLAN's own FE-6 Step 6 text only asserts it for the FOUR STRUCTURE rows, and
   `LevelLadder.tsx`/`ladderModel.ts` (FE-5's owned files, not in FE-6's Independence-table Owns row)
   have no `offline` concept on any row today. Building it correctly would require replicating
   `LiveTape.tsx`'s full session-tape/replay-aware `tileOffline` machinery inside a file this task
   doesn't own, with real risk of getting the replay case wrong (criterion 16b forbids a pause mark
   there). Flagging for the next lane / GATE Z rather than inventing it half-scoped.
6. **The tape-trail-row's decorative print-flash feature (buy/sell colour bars on a trade tick) was
   preserved**, not dropped, by adding an optional `lastTrade` prop threaded the same way as
   `mid` — a REST fallback would have silently changed shipped visual behaviour for no reason tied to
   this task's criteria.
7. **The trail-paused caption (§4.6, "tape paused · trail frozen" / "tape paused")** is new,
   deliberately narrow: gated on `tileOffline` (the SAME `st ? false : streamOffline` discipline
   `LiveTape.tsx` already established, reusing `sessionTapeOf` — a legitimate existing import, not a
   new liveness expression) so it never fires during session-tape replay. It does NOT attempt F6's
   full "session replay" caption/no-dim treatment for the tape row or the ladder mid row — same
   reasoning and same named gap as item 5.

**Mutation proofs actually run (poison → confirm red → revert), all this session, each output
captured above in the session transcript, not re-derived from memory:**
- Criterion 7 (palette identity): gave the ladder a freshly-`resolveLevelPalette`'d object instead of
  the shared one — `StructureHeroPanel.spec.tsx`'s identity test (`toBe`, not `toEqual`) went red
  naming the exact mismatch; reverted.
- Criterion 10 (the `Mid`/`Live` word): reinstated `activeClaim ? 'Live' : 'Mid'` in
  `TapePulseStrip.tsx` — BOTH `TapePulseStrip.spec.tsx` (unit) and `StructureHeroPanel.spec.tsx`
  (integration) went red on the same case; reverted.
- Criterion 24 (a11y): deleted `aria-describedby` — `StructureFieldCanvas.spec.tsx`'s new test went
  red on `expect(describedBy).toBeTruthy()`; reverted.
- The trail caption's two-arm discipline: collapsed both arms to the "trail frozen" string —
  `TapeTrailRow.spec.tsx`'s "never asserts a frozen trail that was never drawn" case went red;
  reverted.
- The inner boundary (SPEC §5): widened the `ErrorBoundary` to wrap the whole hero body instead of
  just the canvas/magnet region — `StructureHeroPanel.spec.tsx`'s inner-boundary test went red
  (`getByTestId('level-ladder')` threw, not found, once the boundary swallowed everything); reverted.

**Browser check, actually done.** Temporarily mounted `<StructureHeroPanel>` into
`/lab/structure-field` (bridging the lab's synthetic `StructureFieldModel` into a fabricated
`MarketState`/`StrikeRow[]` shape — the lab has no real bundle), served the dashboard, and because the
app resolves its OWN theme from a stored preference (`convexa.uiprefs.v1` in `localStorage`) rather
than the browser's `prefers-color-scheme` — a real trap, cost a screenshot cycle to discover, the
FIRST light-mode attempt using Playwright's `colorScheme: 'light'` context option rendered
byte-identical to dark — the throwaway script was fixed to `page.addInitScript` that key before
`page.goto`. Confirmed dark (1280×1600), light (1280×1600, criterion 52: the hero genuinely repaints
onto the light panel surface, no dark plate) and a 393px narrow dark viewport (no horizontal
overflow, ladder rows and toggle wrap correctly), plus the Field/Magnet toggle (clicked, confirmed
`wall-magnet-view` renders while the ladder/tape-row/path stay mounted underneath). Zero console
errors beyond the expected API-not-served 502s. Reverted the lab edit, confirmed
`git status --short apps/dashboard/src/app/pages/lab/StructureFieldLab.tsx` returned nothing, killed
the server, ran `npm run ports:free`.

## GATE Z RESOLVED by the conductor 2026-09-05 - in scope, owned by FE-11

The FE-6 lane was right to flag it and right not to build it into an FE-5-owned file on its own
authority. Resolution:

**(a) It is IN SCOPE, not debt.** SPEC §4.1's per-component table names both treatments. Declaring them
under-built would be a silent scope cut, and the §4.4 curve-text-equivalent debt is not a precedent for
it: that one was *explicitly* booked by delegated ruling P1 with a phase attached, after weighing cost.
This has had no such decision, and "no task obviously owns it" is not a reason to drop a spec row.

**(b) FE-11 owns it** ("Compose the desk, and burn down the spacing exemptions in the rewritten files
only"). It is a cross-component consistency requirement spanning the ladder's mid row and the tape-trail
row, and FE-11 is the task that legitimately touches the assembled desk. FE-7 through FE-10 each own a
narrower surface, which is why none of them looked like the home.

**(c) The 16b risk the lane worried about is resolved by branching on STANDING, not on "not live".**
Criterion 16b settles that **replay renders F6 with no pause mark**. The §4.1 treatment applies to the
**offline** and **stale** standings only. Implemented as a branch over the standing union, the two
cannot contradict: replay is not offline. Implemented as `!isLive -> pause mark`, they would - which is
exactly the hasty version the lane declined to write. That distinction is the mechanism; FE-11 must
encode it explicitly and prove it with a replay-standing case that asserts the pause mark is **absent**.

## GATE Z item flagged (new, from item 5/7 above)

**The ladder's mid row and the tape-trail row's own "session replay" F6 treatment are not built.**
SPEC §4.1's per-component table names both (ladder: "only the mid row dims, with the pause mark" on
offline/stale; tape trail row: latched value + pause mark, or bare + pause mark, on offline/stale) as
if fully generic across every standing, but FE-6's own assigned criteria never test the ladder-mid
half, and neither the ladder nor a from-scratch new component (`TapeTrailRow` didn't exist before this
task) had ANY session-tape/replay awareness to build from. A future lane (or GATE Z sign-off) should
decide: (a) is this in scope for a later task (FE-7 through FE-11 don't obviously own it either), or
(b) is SPEC §4.1's table describing a debt this phase knowingly under-builds, analogous to the named
point-by-point curve text-equivalent debt in §4.4. Recommend NOT silently building it into `LevelLadder.tsx`
(an FE-5-owned file) without an explicit owner decision, given the real risk of contradicting FE-2's
already-settled criterion 16b (no pause mark during replay) if done hastily.

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
- **The app's theme (dark/light) does NOT follow the browser's `prefers-color-scheme`** — it reads a
  stored preference (`localStorage['convexa.uiprefs.v1']`, anonymous default `dark`). A Playwright
  `colorScheme` context option alone renders dark regardless of the setting; set the localStorage key
  via `page.addInitScript` before `page.goto` to actually exercise light mode.
- **`liveClaim.spec.ts`'s BANNED-pattern source scan reads RAW file text, comments included** — a doc
  comment explaining an old bug by literally spelling `tape.isLive` or `isLive &&` trips the same
  regex the code fix was supposed to clear. Word around it (e.g., "the store's own `isLive` flag off
  `tape` directly") rather than quoting the literal expression.

---

## Next: FE-7 (not started)

**FE-7 — The read strip: eight fixed slots, each cell its own container.** Owns: new
`pages/ticker/widgets/read-strip/{ReadStrip.tsx,ReadStrip.spec.tsx,readStripModel.ts,
readStripModel.spec.ts,index.ts}` · `pages/ticker/widgets/iv-rank/IvRank.tsx`. Depends on FE-1
(done). **Independent: no.**
**Spec:** §2.4, §4.1, §4.6 · **Criteria:** 8 (SB), 19 (SB), 25 (SB), 26, 27, 28, 50 (SB), 60.

Read PLAN.md's FE-7 section fresh (around line 1245 in the copy read this session — re-check, it
drifts) and SPEC §2.4/§4.1 fresh before starting. Key traps, read from this session's own reading of
both documents (not re-verified against the tree since FE-7 hasn't started — re-check line numbers
against the CURRENT `DealerPositioning.tsx`, which this session did NOT touch beyond the one-line
`WallMagnetView` import re-point):
- **Eight FIXED slots, a closed tuple type** (`READ_STRIP_SLOTS`), never 7-or-8 — the architect's own
  R2 self-revision was withdrawn at R3; a variable-cardinality slot recreates
  `[absent-is-not-none]` in the scroll axis at 393px (an absent cell and one scrolled off the rail are
  indistinguishable). No tenth member, no eighth-slot special case.
- **Values/tooltips copy byte-for-byte** from `DealerPositioning.tsx` (re-verify these line ranges
  fresh, they will have drifted from PLAN's citations by now): `netDex`, `ivHv`, `volOi`, `ivSkew`,
  `termStructure`, `offExchange`, `opportunity`. `ivRank` comes from the EXISTING `IvRank.tsx` (find
  it fresh — this session did not touch it). **This accounting is what makes FE-8's `DealerPositioning`
  deletion reviewable** — the twelve shipped cells must decompose with zero orphans: 3 to the ladder
  (FE-5, done), 2 to the ladder foot (FE-5, done), 7 here, IV rank the eighth.
- **The empty off-exchange slot renders `not provided`** (`shared/copy/notANumber.ts`), never
  `unavailable` — it collapses BOTH the disabled-source case (`INCLUDE_DARK_POOL=false`) and the
  failed-computation case into one member, because the frontend cannot distinguish them
  (`PROJECT_CONTEXT.md` §5, an empty `apps/api` diff). Criterion 27: neutral register, no
  success/error palette class, states context-only/no-side explicitly (`[dark-pool-context-only]`).
- **Term structure keeps its shipped THREE-way render** (`unavailable` / `—` / the wire's `state`
  label) — this is legitimate, NOT a second not-a-number vocabulary, because unlike off-exchange the
  two absences here ARE distinguishable (object absent vs. present-but-thin `points` array). Copy
  `DealerPositioning.tsx`'s exact three-way logic; don't collapse it to match off-exchange's one
  member.
- **THE CONTAINER-QUERY HAZARD, again** (same class of bug FE-6's own module docs discuss for the
  hero): each of the eight cells wraps in the shipped `PanelContainer` (same `containerName: 'panel'`,
  NESTED under the Widget's own) — declaring the name at the STRIP/rail level instead would make the
  nearest named ancestor the ~1280px panel body for every cell, so `FigureCell.tsx:216-217`'s
  20→17→15px step would never fire at any viewport. `[lane-check]`: jsdom cannot evaluate container
  queries — a unit test may assert the `PanelContainer` declaration only, never the stepping
  behaviour (that's `review`, browser-only, no criterion claims a jsdom proof of it).
- **The strip is a rail; the page is not** (criterion 50, SB): `overflowX: 'auto'` + `minWidth: 0` on
  the parent track. Assert the declaration in jsdom; the scrolling behaviour itself is FE-12's
  browser row.
- **All eight cells are dotless** (criterion 8, SB) — none of DealerPositioning's shipped cells is
  live-derived today, so `live={NOT_LIVE}` at every slot is mechanically enforced by FE-1's brand
  (a stray `live={someClaim}` is a compile error) but the RUNTIME census (a DOM scan finding zero
  `data-figure-state="live"` nodes and zero `figure-live-dot` testids in the strip) is this task's own
  proof to write — poison one slot with `live={andPresent(someClaim, 1)}` under a live fixture, confirm
  the census goes red, revert.
- **Mutation proof named explicitly by PLAN**: poison the off-exchange slot to render `'unavailable'`
  instead of `not provided` — criterion 26 must go red. Record it, actually run it.
- **Read `live-dot-census.spec.tsx` fresh before touching it** — FE-8 (not this task) re-points it to
  render `LiveTape + LevelLadder + ReadStrip` together, but reading it now will show you exactly what
  shape of DOM scan `ReadStrip.tsx` needs to be compatible with, so you don't have to guess and FE-8
  doesn't have to redo your cell markup.
- **Not wired into the page yet is fine and expected** — matches FE-5's and FE-6's own precedent.
  `TickerDashboard.tsx`'s reading-order rewrite is FE-11's task alone; do not mount `ReadStrip` there.
  If a component you build here forces an unavoidable compile-time fix to an EXISTING untouched call
  site (the way FE-6 had to touch `TickerDashboard.tsx:504` for `TapePulseStrip`'s new required
  props), that is an acceptable, minimal, documented deviation — but first check whether `ReadStrip`
  actually has an existing call site to break (unlike `TapePulseStrip`, it's a brand-new component
  with no precursor, so this may simply not arise).
- **Browser check**: no existing lab page mounts a bento-style read strip today. Follow FE-5's/FE-6's
  pattern — temporarily mount into `/lab/structure-field` or a new throwaway location, screenshot dark
  + light + 393px, revert. `npm run ports:free` before and after.
