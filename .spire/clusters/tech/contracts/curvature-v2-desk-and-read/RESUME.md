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
- `6eea1c81` — FE-7 (the read strip) — see "Done (FE-7)" below.

Working tree is clean at the time of writing (post-FE-7 commit `6eea1c81`). `npm run
typecheck` **0**, `npx nx test @convexa/dashboard` **0** @ **228 files / 2512 tests** (up from the
226/2474 baseline after FE-6: +2 files, +38 tests), `npm run lint` **0** (no new warnings, same one
pre-existing `react-hooks/exhaustive-deps` warning in `useSessionArchive.ts`, unrelated to this
branch). e2e not touched yet (that's FE-12). **Nx's own `test` target flaked again this session**
(the run printed a failure-shaped summary once, then Nx's own "Nx detected a flaky task" notice fired
and a same-command re-run resolved to a clean cache hit at 228/2512, exit 0) — same environmental
class the FE-6 session already recorded, not this session's code; confirmed by re-running the exact
canonical command a second time and getting a clean cached 0.

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

## Done (FE-7) — do not re-do

**FE-7 — the read strip: eight fixed slots, each cell its own container.** Owns (as landed): new
`pages/ticker/widgets/read-strip/{readStripModel.ts,readStripModel.spec.ts,ReadStrip.tsx,
ReadStrip.spec.tsx,index.ts}` · `pages/ticker/widgets/iv-rank/IvRank.tsx` (additive export only,
`IvRank.spec.tsx` gained a companion describe block for it).

**What shipped, closely following PLAN's illustrative shape, one real judgment call on the eighth
slot:**

1. **`READ_STRIP_SLOTS`/`ReadStripSlot`** — the closed eight-member tuple, verbatim order from
   PLAN's Step 1 and `DESIGN_SYSTEM.md` rule 15 (they agree): `opportunity, netDex, ivHv, ivRank,
   volOi, ivSkew, termStructure, offExchange`.
2. **Seven cells decompose byte-for-byte from the CURRENT `DealerPositioning.tsx`** (re-read fresh
   this session, not trusted from PLAN's citations, which had drifted by a few lines as expected):
   `netDex` (`:148-154`), `ivHv` (`:166-172`), `volOi` (`:173-181`), `ivSkew` (`:182-192`),
   `termStructure` (`:193-209`), `offExchange` (`:210-223`, now unconditional), `opportunity`
   (`:224-233`). Values AND tooltips copied verbatim — `readStripModel.spec.ts` asserts several by
   exact string.
3. **The eighth slot (`ivRank`) — the one real design decision this task made, recorded here so a
   later lane doesn't have to re-derive it.** `IvRank.tsx` today is a FULL standalone widget (rank +
   percentile + band + basis line + advisory footer + a four-way building/flat/computed/unavailable
   state machine) — too rich to fit one `FigureCell`'s label+value+caption slot, and it is **not**
   deleted: FE-11's own PLAN text keeps `IvRank` mounted, untouched, as one of the eight quiet-band
   widgets. So the read strip's `ivRank` slot is a NEW small digest, not the widget's full body:
   added `ivRankStripFigure(read)` as an additive exported pure function IN `IvRank.tsx` (the file
   PLAN's Owns row names), which collapses `building` / degenerate-flat (`rank == null`) / whole-null
   / unknown-state into the ONE closed `unavailable` member and otherwise renders `` `${rank} ·
   ${band}` `` using the SAME closed `ivrBandDisplay` lookup the full widget already uses (never a
   raw wire pass-through). The full widget's own body is completely unchanged — read it fresh if this
   surprises you; nothing about its rendering was touched, only a new export was added beside it.
4. **Off-exchange (criterion 26/27)** — unconditional now (`offExchange?.ratio_pct != null ? ... :
   NOT_PROVIDED`, never `unavailable`); the "Side/intent unknown — context only, not a directional
   signal." sentence is present in BOTH the populated and empty info-text arms (criterion 27 needs it
   unconditionally, not only when there's data to append "Top levels" to).
5. **Term structure (criterion 60)** — the shipped three-way render copied as-is: absent object →
   `unavailable`; present, `points.length < 2` → `—`; otherwise → `m.term_structure.state`. Not
   collapsed to match off-exchange's single member — SPEC §2.4 is explicit these are NOT the same
   vocabulary because the two absences here ARE distinguishable.
6. **`ReadStrip.tsx`** — one `Widget id="read-strip"` (title "Read strip", an own-words subtitle, not
   spec-pinned copy — no criterion or `_kit/copy.ts` constant claims this widget's title/subtitle)
   wrapping a `Box data-testid="read-strip-rail"` (`display:flex, overflowX:'auto', minWidth:0`,
   criterion 50) containing eight `PanelContainer` (same `containerName:'panel'`, NESTED — never
   declared on the rail itself, SPEC §2.5's hazard) each wrapping one `FigureCell`. All eight cells
   pass `live={NOT_LIVE}` from the model (criterion 8) — FE-1's brand makes a stray live claim a
   compile error, and the runtime census is proven below.
7. **PRESENTATIONAL, not wired into `TickerDashboard.tsx`** — matches FE-5's/FE-6's own precedent;
   `ReadStrip` has no existing call site to break (unlike `TapePulseStrip` at FE-6), so no forced
   edit to an untouched file arose. FE-11 mounts it.

**Mutation proofs actually run (poison → confirm red → revert, both named explicitly by PLAN, both
actually executed this session with captured output, not narrated):**
1. Off-exchange (criterion 26): replaced the `NOT_PROVIDED` fallback with the literal `'unavailable'`
   in `readStripModel.ts` — 4 tests went red, each naming the actual received string (`'unavailable'`
   received where `'not provided'` was expected). Reverted; 31/31 green again.
2. Dot census (criterion 8): gave the `netDex` cell `live: andPresent(isDeliveringLive(...), 1)`
   instead of `NOT_LIVE` under a genuinely live fixture, in `readStripModel.ts` — both the model-level
   "all eight cells carry NOT_LIVE" test AND `ReadStrip.spec.tsx`'s DOM census test went red (found 1
   dot / 1 `data-figure-state="live"` node where 0 were expected). Reverted; suite green again.

**Container-query and rail-discipline proofs are DOM-level, not merely declared:** reused the
existing `_kit/emotionCssReader.ts` (`allRulesForClass`/`joinedStyleText`/`emotionClassOf` —
already shipped for `type-floor.spec.tsx`'s own container-step assertion, not a new pattern) to prove
from jsdom-visible emotion CSS text that (a) each of the eight `read-strip-cell-<slot>` wrappers
carries BOTH `container-type:inline-size` and `container-name:panel`, (b) the rail itself does NOT
carry `container-name:panel`, and (c) the rail carries `overflow-x:auto` and `min-width:0`. This is
the `[lane-check]`-compliant proof — the DECLARATION only, never the actual container-query stepping
behaviour (that stays browser-only/review, confirmed separately below).

**Browser check, actually done.** Temporarily mounted `<ReadStrip cells={buildReadStrip(fixture)} />`
into `/lab/structure-field` beneath the canvas (a ~55-line fixture block + one `<ReadStrip>` JSX
line), served the dashboard, and used the SAME `localStorage['convexa.uiprefs.v1']` theme-toggle
trick FE-6's session already had to discover (Playwright's `colorScheme` context option alone renders
dark regardless of the stored preference). Screenshotted dark (1280×1400), light (1280×1400) and both
schemes at a 393px-narrow viewport. Confirmed in all four: eight cells present, labels/values/info
icons render, the widget card chrome and info tooltips are correct in both schemes (light mode
genuinely repaints onto the light panel surface, no dark bleed), the rail visibly clips its eighth
cell inside the widget frame at both 1280 and 393 (the deliberate horizontal rail, not a bug), zero
new console errors (only the pre-existing 502s from the API not being served). Went one step further
than a visual look: ran a second throwaway script measuring `document.documentElement.scrollWidth`
vs `clientWidth` at 393 and 1280 — **the PAGE never overflows at either width** (`scrollWidth ===
clientWidth` both times) while the **rail's own** `scrollWidth` exceeds its `clientWidth` at both
widths (1204 vs 327 at 393, 1204 vs 1118 at 1280) — direct measured proof of criteria 49/50's
substance, not just a look. Reverted the lab edit, confirmed via `git status --short --
apps/dashboard/src/app/pages/lab/StructureFieldLab.tsx` it returned nothing (byte-identical to
committed state), deleted both throwaway scripts and all four screenshots, killed the dev server, ran
`npm run ports:free` (confirmed one listener on :4200, killed).

**One deviation from PLAN's enumerated FE-7 `Owns` list (additive, in-lane):** `IvRank.spec.tsx`
gained a new `describe` block (`ivRankStripFigure`) — PLAN's Owns row names `IvRank.tsx` but not a
spec change for it; added because the new export needed its own coverage and the file it lives in is
the natural home (mirrors FE-5's own precedent of adding `LadderFoot.spec.tsx` beyond the enumerated
list for the same reason — cheap regression insurance on a small named export).

**Full-suite verification, canonical command, this session:** `npm run typecheck` **0** ·
`npx nx test @convexa/dashboard` **0** @ **228 files / 2512 tests** (226/2474 → +2 files / +38 tests:
23 in `readStripModel.spec.ts`, 8 in `ReadStrip.spec.tsx`, 7 new in `IvRank.spec.tsx`) · `npm run
lint` **0** (same one pre-existing warning, no new ones). Nx's own `test` target printed a
flaky-task notice mid-session (the same environmental class the FE-6 session already recorded, not
this session's code) — a second run of the identical canonical command resolved to a clean cached
228/2512 at exit 0; trust that, not the one-off.

**Not touched, correctly:** `DealerPositioning.tsx` (this task only READ it, to copy values/tooltips
— FE-8 deletes it), `TickerDashboard.tsx` (FE-11's job), `IvRank.tsx`'s own render body (only a new
export was added beside it, nothing inside `IvRank()` itself changed), `live-dot-census.spec.tsx`
(read fresh per RESUME's own instruction, confirmed it re-points at FE-8, not this task — left
untouched).

---

## Done (FE-8) — do not re-do

**FE-8 — Delete the old dealer positioning widget, re-point every pin, prove zero orphans.** Owns (as
landed): `git rm` on `dealer-positioning/{DealerPositioning.tsx,DealerPositioning.spec.tsx,index.ts}` ·
`widgets/index.ts` · `_kit/copy.ts` (rename) · `market-context/MarketContext.tsx` (comment) ·
`dealer-flow-projection/DealerFlowProjection.tsx` (comment) · `live-dot-census.spec.tsx` (rewritten) ·
`ticker.risk.spec.tsx` · `pos-params.spec.tsx` · `ticker-invariants.spec.tsx` ·
`ticker-hierarchy.spec.tsx` · `ticker-age-basis.spec.tsx` · `single-name-caveat.spec.tsx` (read,
unchanged — see below) · `steel2-contrast.spec.ts` (comment) · `hex-discipline.spec.ts` (read,
unchanged — no exempt-list entry existed for the deleted file, nothing to remove) ·
`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` · `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` ·
`README.md` (widget-folder list).

**The zero-orphan ledger, verified against the file at deletion time** (`git show HEAD` on the
now-deleted `DealerPositioning.tsx`, not trusted from an earlier session's citation): Call wall
`:112`, Put wall `:120`, Vol-norm GEX `:128`, Raw GEX (1% shock) `:143`, Net DEX `:150`, Max pain
`:160`, IV/HV `:168`, Vol/OI `:175`, IV skew `:184`, Term structure `:195`, Off-exchange % `:213`,
Opportunity `:226`.

| shipped cell | destination |
|---|---|
| Call wall, Put wall, Max pain | `level-ladder/LevelLadder.tsx` (FE-5, mounted inside `StructureHeroPanel`) |
| Vol-norm GEX, Raw GEX (1% shock) | `level-ladder/LadderFoot.tsx` (FE-5, **was built but never mounted anywhere** — see the orphan-fix finding below) |
| Net DEX, IV/HV, Vol/OI, IV skew, Term structure, Off-exchange %, Opportunity | `read-strip/ReadStrip.tsx` (FE-7) |
| Field/Magnet toggle + `WallMagnetView` | `structure-hero/StructureHeroPanel.tsx` (FE-6, already mounted there — the OLD widget's own copy of this toggle was a dead duplicate, deleted with the rest of the file) |

Twelve cells, zero orphans. `rg 'DealerPositioning' apps --glob '!sourcemaps-private/**'` returns
**zero** lines (verified; also swept `dist/`/`out-tsc/` — gitignored build output, not source, left
alone). Note the probe is **case-sensitive**: historical comments that need to name the deleted widget
now say "the old dealer positioning widget" (lowercase, two words) — following the SAME "word around
it, don't quote the literal" convention `liveClaim.spec.ts`'s EXEMPT-list fix already established in
this build for its own banned-pattern source scan.

**A real, undiscovered orphan found and fixed, not by FE-8's own authority alone but as an unavoidable
part of proving zero orphans:** `LadderFoot.tsx` (FE-5, tested, `LadderFoot.spec.tsx` green) was
**never mounted in the production tree** — `StructureHeroPanel.tsx` (FE-6) wires
`StructureFieldCanvas`/`LevelLadder`/`TapeTrailRow`/`StructurePathStrip` but not `LadderFoot`, and no
other file imports it. Left unmounted, deleting the old widget would have turned Vol-norm GEX and Raw
GEX into silent orphans — exactly the failure this ledger exists to catch. Fixed by adding
`<LadderFoot volNormalizedGex={m.vol_normalized_gex} netGex={m.net_gex} />` to `StructureHeroPanel.tsx`
right after `<LevelLadder>`. This is a FILE outside FE-8's nominal Owns list (FE-6's), but SPEC §2.1's
own "four presentational regions" accounting groups the ladder and its foot as ONE region across two
files (SPEC §2.3's ledger literally says "2 to the ladder foot"), so this is completing FE-6's own
region, not inventing a fifth. `StructureHeroPanel.spec.tsx` carries no children-count assertion this
contradicts (checked before editing).

**The bigger judgment call this task had to make, contradicting two prior lanes' own doc comments —
read this before assuming FE-11 "owns" wiring the successors in:** `ReadStrip.tsx`'s own header
literally says "Not wired into `TickerDashboard` yet (FE-11's task, matching FE-5's and FE-6's own
precedent)". That claim does not survive contact with the tree: `screen.findByText('Call wall')` (or
the unscoped `getByText`) is used as the **page-load readiness anchor** — not a `DealerPositioning`-
specific assertion — in **17 spec files**, only 6 of which are in FE-8's own Owns list (`app.risk.
spec.tsx`, `ai-rec.*.spec.tsx` ×4, `shell-live-lifecycle.flow.spec.tsx`, `positions.integration.
spec.tsx`, `ticker-semantics.spec.tsx` (FE-11's), `landing.spec.tsx` are NOT FE-8's). `Call wall` is a
string ONLY the ladder renders (confirmed: it appears nowhere else in `apps/dashboard/src` outside
`DealerPositioning.tsx` and `ladderModel.ts`). Deleting the widget without mounting its successor
into `TickerDashboard.tsx` would have silently broken all 17 — most with no visible connection to a
"DealerPositioning" search, exactly the e2e T2 trap PLAN already named, but for the UNIT suite, which
no prior session's text flagged. **Verified against the tree, not assumed**: reverted my own
TickerDashboard mount locally as a probe, confirmed `ticker-age-basis.spec.tsx` alone hangs on
`findByText('Call wall')` with nothing else changed, then restored the mount. Given PLAN's own
Independence section already lists "`TickerDashboard.tsx` by FE-8 **and** FE-11" as one of the three
named write-path overlaps (the OTHER two — `LiveTape.tsx`/`_kit/copy.ts` FE-2+FE-8, `hex-discipline.
spec.ts` FE-3+FE-6+FE-8 — are exactly this same "later task must touch an earlier task's file" shape),
mounting the successors now, in `DealerPositioning`'s own former slot only (not FE-11's full
reading-order rewrite), is the documented, sanctioned kind of necessary overlap — not scope creep.

**What actually landed in `TickerDashboard.tsx` (minimal, surgical — NOT FE-11's job):** the old
`<DealerPositioning m sig offExchange volOiThreshold unusualCount tierWord opportunityScore
structureAgeSeconds />` block is replaced, IN THE SAME POSITION (same `BoardZoneLabel zone="structure"`
slot, before `GexStrikeProfile`/`PositionBrief`), with `<StructureHeroPanel symbol m strikes
structureAgeSeconds pathSamples pathLoading pathError pathBasis />` (reusing the exact same values
already computed for `GexStrikeProfile` and `TapePulseStrip` — no new derivation) and
`<ReadStrip cells={buildReadStrip({...})} />` (same `m`/`sig`/`offExchange`/`volOiThreshold`/
`unusualCount`/`tierWord`/`opportunityScore` DealerPositioning received, plus `ivRank: m.iv_rank ??
null`). **`GexStrikeProfile` is deliberately left mounted, unchanged, right below** — a KNOWN, NAMED,
TEMPORARY visual redundancy (two GEX/wall renderers on one page between this commit and FE-11's) — not
a silent regression. FE-11's own Step 1 diagram (masthead → structure-hero → read-strip → AI → quiet
band) never names `GexStrikeProfile` at all, confirming FE-11 is where it is meant to be removed from
the reading order, not FE-8. Comment left in `TickerDashboard.tsx` at the mount site explaining this
for whoever reads it next; a matching comment already existed there for FE-6's own `TapePulseStrip`
precedent (same shape, same reasoning, this session followed it rather than inventing a new pattern).

**`_kit/copy.ts`'s `dealerPositioningSubtitle` — renamed, not deleted, per PLAN step 4, but an honest
finding: it has NO live call site today.** Renamed to `structureSnapshotSubtitle` (identical string
output). PLAN's own text calls it "the hero/strip basis helper," but `StructureHeroPanel.tsx` computes
its OWN inline `basis` string (`"levels are REST structure (as-of Xs) · the mid is tape"`) and
`ReadStrip.tsx` has its own hardcoded subtitle — both FE-6/FE-7 files, already committed and tested,
not touched here for a style-only reason. Kept exported per the plan's explicit instruction; flagging
for whoever next touches `_kit/copy.ts` that it may be genuinely dead code now, not a gap this session
silently created.

**Collateral fix outside FE-8's Owns list, found only by running the full suite (not assumed safe):**
`ticker-semantics.spec.tsx` (FE-11's file) asserted an h2 heading named `/dealer positioning/i` — went
red the first full-suite run after the `TickerDashboard.tsx` edit. Re-pointed to `/read strip/i`
(`ReadStrip`'s fixed title; `StructureHeroPanel`'s title is the ticker symbol, not a fixed word, so
not usable as a name-based heading match). Same "necessary write-path overlap" reasoning as above —
recorded, not silently absorbed.

**e2e — both halves of the blast radius handled, without doing FE-12's registration work:**
1. `no-overflow.spec.ts:398`'s `/ticker/TSLA` readiness `ready()` callback now asserts
   `getByTestId('level-ladder')` attached **and** `getByText('Call wall').first()` attached (PLAN's own
   FE-12 step-2 illustrative code, applied here since the anchor would otherwise hang/fail the moment
   this task's deletion lands — did not wait for FE-12 to fix a break FE-8 causes). Did **not** touch
   `playwright.config.ts`, add a width, or touch any other route's `ready()` — that is FE-12's own
   Step 2/3/6 scope, untouched.
2. `curvature-v2.spec.ts`'s 10 `dealer-positioning`/`DealerPositioning` occurrences re-pointed:
   the AC-34/AC-35 FigureCell-ℹ hit-area checks now target `ladder-foot` (the nearest surviving
   FigureCell-with-`info` site — `LevelLadder.tsx`'s own rows never pass an `info` prop, so the ladder
   itself is NOT an equivalent substitute); the AC-20b review-evidence font-size comparison now
   compares `live-tape` against `level-ladder` (both inside `span={2}` widgets, both `register="traced"`
   — measured live: `live-tape=17px level-ladder=17px`). Did **not** create `desk-and-read.spec.ts`,
   touch `playwright.config.ts`'s `testMatch`, or do any of FE-12's Step 1/4/5 work.
   `--list` proves both specs still execute (`grep -c 'curvature-v2\|no-overflow'` on the list output
   = 62 lines, including all five `/ticker` overflow rows: 393 dark, 393 light, 834, 900, 1280).

**Full verification, canonical commands, this session, exit codes actually checked (not printed
summaries):**
- `npm run typecheck` → **0** (twice, after the mechanical edits and again after `format:write`).
- `npx nx test @convexa/dashboard` → **0** @ **227 files / 2507 tests** (down from FE-7's 228/2512 by
  exactly one file / five tests — `DealerPositioning.spec.tsx` had exactly 5 `it(` blocks, confirmed by
  `git show HEAD:...DealerPositioning.spec.tsx | grep -c 'it('`; no other file's count moved). At/above
  PLAN's own 2376 enforcement floor.
- `npm run lint` → **0** (same one pre-existing `react-hooks/exhaustive-deps` warning, no new ones,
  dashboard-e2e's 4 pre-existing `no-explicit-any` warnings in `playwright.*.config.ts` unchanged).
- `npm run build` → **0** (production build, both api release + dashboard bundle).
- e2e, against the PRODUCTION build (never dev), ports freed IPv4+IPv6 before and after:
  `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` → exit 0, `/ticker` rows
  present at all five width×scheme combinations named above; `npx nx e2e dashboard-e2e` → exit 0,
  **75/75 passed, 0 flaky** (the RESUME's own documented `broker-grouping.spec.ts` 75/75-on-prod
  signature confirms this ran against the production build, not Vite dev).

**Mutation proof actually run (poison → confirm red → revert):** reverted the `TickerDashboard.tsx`
mount back to a bare comment (no `StructureHeroPanel`/`ReadStrip`) with `DealerPositioning` still
deleted — `ticker-age-basis.spec.tsx`'s `findByText('Call wall')` hung/failed as predicted, confirming
the mount is load-bearing, not decorative. Restored; re-ran that one file green before re-running the
full suite.

**Browser check, actually done on the real `/ticker` route (not the lab page).** Built production
(`npm run build`, exit 0), served it via `npx nx run @convexa/dashboard:serve-static --port=4200` (the
SAME command `playwright.shared.config.ts`'s `webServer` uses for CI), and ran a throwaway Playwright
script (not committed, deleted after) that stubs the network with `curvature-v2.spec.ts`'s own bundle
fixture (extracted to JSON, not hand-retyped) and seeds `localStorage['convexa.uiprefs.v1']` (both
`theme` AND, this session's own NEW finding, the mocked `/api/auth/session` response's
`settings.theme` — the first screenshot attempt rendered dark in "light" mode because the session
settings payload hardcoded `theme: 'dark'` and the app apparently prefers the account setting over the
local seed once authenticated; fixed by driving both from the same `scheme` variable). Screenshotted
dark 1280×1600, light 1280×1600, dark 393×1400. Confirmed in all three: `StructureHeroPanel` renders
(title "TSLA", subtitle "levels are REST structure (as-of 10s) · the mid is tape", the field canvas,
LEVELS/MAGNET toggle, five ladder rows sorted by price — Call wall $260 → Max pain $250 → Gamma flip
$248 → Put wall $240 → Mid —, ladder foot's Vol-norm GEX/Raw GEX), `ReadStrip` renders below it (eight
cells, opportunity "42 · Watch" visible), `GexStrikeProfile` STILL renders further below (the disclosed
temporary coexistence), light mode genuinely repaints onto the light panel surface (no dark-plate
bleed), 393px stacks single-column with the read-strip rail visibly clipping after two cells (the
deliberate horizontal rail, matching FE-7's own already-proven behaviour). Zero console errors beyond
the one expected `EventSource` MIME-type error (the throwaway script did not stub the SSE stream route
the way `curvature-v2.spec.ts`'s full `stubNetwork` does — a live financial connection was never
expected to work under a stub, same class as the "502s from the API not being served" note every prior
lane recorded). Deleted the throwaway script, its bundle JSON, and all three screenshots; killed the
server; ran `npm run ports:free` (one listener on :4200, killed).

**`single-name-caveat.spec.tsx` and `hex-discipline.spec.ts` — read, deliberately NOT edited, and why
this is correct, not an oversight:** `single-name-caveat.spec.tsx:143`'s `SINGLE_NAME_CAVEAT` copy
string contains the literal substring "dealer-positioning evidence" — this is SPEC-pinned PRODUCT COPY
(a market-analysis term of art, lowercase-hyphenated), not a reference to the deleted component; left
byte-identical. `hex-discipline.spec.ts`'s EXEMPT list never had an entry for the deleted file (it used
only MUI `sx`/theme, no raw hex) — nothing to remove; its one `dealer-positioning` mention (the
`WallMagnetView.tsx` "moved from" note) is historical, lowercase, and was already correct before this
session (FE-6's own edit).

## GATE Z / next-lane items carried forward from FE-8 (new)

1. **`_kit/copy.ts`'s `structureSnapshotSubtitle` (renamed from `dealerPositioningSubtitle`) has no
   live call site.** Kept per PLAN's explicit "re-point, don't delete" instruction; a future lane
   should decide whether to wire it into one of the successor widgets' subtitle or accept it as
   superseded dead code and remove it then (not now — that would be a style decision this task
   wasn't asked to make).
2. **The `GexStrikeProfile` / `StructureHeroPanel` canvas coexistence is temporary, not a bug.**
   FE-11's own Step 1 reading-order rewrite (`TickerDashboard.tsx:503-669`) is where `GexStrikeProfile`
   drops out of the desk; until that commits, the real `/ticker` page shows two GEX-wall renderers.
   Confirmed by browser screenshot this session (see above) — not hidden.

## Done (FE-9) — do not re-do

**FE-9 — The AI read: one total `(request, result) → ReadLayout` mapping, and the A1c annex.** Owns
(as landed): new `ai-rec/{readLayout.ts, readLayout.spec.ts, readLayout.render.spec.tsx}` ·
`AiRecPanel.tsx` · `AiRecPanelBlocks.tsx` · `DecisionCard.tsx` · `DecisionCard.spec.tsx` (existing
DOM-order test updated for the deliberate reorder below). `copy.ts`/`fixtures.ts` were READ but not
edited — every string this task needed already shipped.

**The Critical, fixed.** `readLayout.ts` exports `readLayoutFor(requestState, resultState) →
{ body, annexes }`, exhaustive over the real 15×7 grid via `assertNeverRequestState`/
`assertNeverResultState` `never`-arm guards (exported so `readLayout.spec.ts` can exercise the SAME
guard at a widened-local-copy call site, mirroring `liveClaim.typeproof.spec.ts`'s established
`@ts-expect-error` idiom — a real `@ts-expect-error`/TS2578 compile proof, not a runtime-only check).
**Load-bearing finding, not assumed:** the naive mutation "delete the `default: return
assertNeverResultState(...)` arm" does **NOT** go red — the switch already covers all 6 real
`AiRecResultState` members, so removing the catch-all changes nothing (TS already sees it as
exhaustive). The REAL proof removes one covered `case` (`incomplete_trade`) while KEEPING the
`default` arm: `npm run typecheck` then names the exact member — `TS2345: Argument of type
"incomplete_trade" is not assignable to parameter of type 'never'` — actually run, confirmed red,
reverted. Recorded here so a later lane doesn't waste a cycle re-deriving the same false start.

**`AiRecPanel.tsx` genuinely CONSULTS `readLayoutFor`for the A1c decision — not a parallel,
disconnected description of intent.** First draft gated the annex on the SAME
`presentation.requestState === 'no_edge'` check the mapping also encodes, which technically worked but
meant a bug in `readLayoutFor` could never be *observed* through the real host — exactly the vacuous-
test shape the launch brief warns against. Found this by RUNNING mutation proof (b) against the FULL
APP test (not just the pure-function unit test): poisoning `readLayoutFor` to collapse `(no_edge,
fresh_trade)` back to `{ body: 'A1a', annexes: [] }` left the real rendered panel UNCHANGED (still
correct) while only the isolated `readLayoutFor` assertions went red — a real, caught gap, not a
hypothetical one. Fixed by computing `const readLayout = readLayoutFor(presentation.requestState,
presentation.resultState); const showQuietGateAnnex = readLayout.annexes.includes('A1c');` in
`AiRecPanel.tsx` and gating the annex on that. Re-ran the SAME poison afterward: the full-app test now
goes red too (3 failures, including the real host), confirming the mapping is actually load-bearing.
`DecisionCard.tsx`'s pre-existing A5/A9 conditionals were left AS-IS (already correct, not part of the
Critical, and rewiring already-correct working code through the new mapping was not worth the added
risk this session).

**Four mutation proofs actually run (poison → confirm red → captured output → revert), all against
`readLayout.ts`/`AiRecPanel.tsx`, not narrated:**
- (a, adjusted — see finding above) removed the `incomplete_trade` case, kept the `default` arm →
  `npm run typecheck` red, named the exact member. Reverted, `npm run typecheck` → 0.
- (b) poisoned `(no_edge, resultState≠null)` to `{ body: 'A1a', annexes: [] }` → BOTH
  `readLayout.spec.ts`'s own runtime-companion test AND `readLayout.render.spec.tsx`'s row-58 full-app
  test went red (3 failures: the pure assertion, the dedicated mutation-proof test, and the row-47
  sibling-isolation test that depends on the annex actually mounting). Reverted; 148/148 green again.
- (c) restored A1b's Mono `no_trade` line inside the A1c annex (`includeStanceLine={false}` →
  `{true}` at the `AiRecPanel.tsx` call site) → the row-58/59 full-app test went red on
  `queryByTestId('ai-rec-quiet-gate-stance')` no longer being null. Reverted.
- (d) demonstrated, not merely asserted, that identifying A1b by the shared gate-note string ALONE is
  genuinely ambiguous against A1c (both render it) — a dedicated test renders both arms and shows the
  naive identifier can't tell them apart, then shows the REAL discriminator (the Mono stance line's
  presence/absence) does. This is a shipped, permanent test (`readLayout.render.spec.tsx`), not a
  one-off session poison — it documents WHY every other test in the file uses conjunction.

**A second, undiscovered defect found ONLY by building a real DOM colour census for criterion 30 (not
by inspection) — fixed in the same commit, not deferred:** MUI's CSS-variables mode (`theme.ts:65`)
compiles `sx={{ color: 'primary.main' }}` to the literal `var(--mui-palette-primary-main)`, but an
UNTHEMED `variant="text"`/`"outlined"` `Button` (no explicit `color` prop) resolves its own text/border
color through a ONE-HOP indirection — `color:var(--variant-textColor)` with a SEPARATE
`--variant-textColor:var(--mui-palette-primary-main)` declaration in the same rule. A naive
direct-match census (`color:var(--mui-palette-primary-main)` only) misses this entirely — and it is
real: `DecisionCard.tsx`'s pre-existing, untouched-until-now "Full analysis & data" (`variant="text"`,
no color prop), "Create sim order" (`variant="outlined"`, no color prop), "Refresh" (`variant="text"`,
no color prop), and the `RiskField` `not_set` arm's inline "Set your risk inputs" link ALL defaulted to
MUI's unthemed `color="primary"` — i.e., ALL FOUR were already rendering brand amber TEXT, in EVERY
produced state including *No trade* (where row 30 requires ZERO amber). This is not something this
session introduced; it was there before FE-9 and nothing in the shipped suite had ever asserted
against it. **Fixed** by binding each an EXPLICIT non-amber color: `Full analysis & data` and `Set your
risk inputs` → `color="info"` (link-class, matching `AiRecPanel.tsx`'s own pre-existing "View what's
sent" precedent and its comment: "link-class action text binds `info`… never amber"); `Create sim
order` and `Refresh` → `color="inherit"` (matching the existing `Dismiss`/`Retry`/`Ask anyway`
precedent — neutral secondary actions, not links). `Review simulated trade` (the one `variant=
"contained"` CTA) is correctly EXEMPT: a contained button's text is `primary.contrastText` (ink on an
amber FILL), the FILL/UI-grade spend `tokens.ts` already reserves for buttons — never the TEXT-grade
spend rule 16 scopes. **The improved census, and the fix, were both proven non-vacuous**: re-poisoned
`Full analysis & data` back to no explicit color after fixing it — `readLayout.render.spec.tsx` went
red on exactly the three states that render it (A3, A4, A5-over-A3), naming `"Full analysis & data"`
as the unexpected extra amber-bearing text each time. Reverted.

**Verdict-word styling (rows 29/30/31, canon 16's "verdict-first brief" — genuinely new, not
previously built anywhere in this codebase).** `DecisionCard.tsx`'s verdict `Typography` gained
`fontFamily: typographyTokens.displayFontFamily` (Archivo), `fontStretch: '112.5%'`, `fontWeight: 700`,
`fontSize: {xs:'20px', sm:'26px'}`, and `color: isTrade ? 'primary.main' : undefined` — ONE text node
(`` `Trade · ${bias}` `` / `No trade`, byte-identical strings to before), not split into per-word spans:
an earlier attempt colouring only the word "Trade" (matching the `design/` mockup's `<span
class="amber">Trade</span>` markup exactly) broke dom-testing-library's `getByText('Trade · long')`
across dozens of pre-existing call sites (`getNodeText` only concatenates DIRECT text-node children,
ignoring nested elements — found by actually running the suite, not assumed). Kept as one node with a
conditional whole-element colour instead: `No trade` spends NO amber at all (ruling 8 / §4.5 — no_trade
is info-toned, never a directional colour), so the two-way split is preserved without touching a single
existing test.

**Row 31 — the four risk fields, grounding before prose, register never colour.**
1. **`decision-grid` (the four risk fields) now renders BEFORE `decision-thesis` (the reasoning
   prose)** — previously the reverse. `AiRecPanel.tsx`'s own header doc already declared "risk +
   invalidation FIRST"; the shipped DOM order contradicted its own stated intent. `DecisionCard.spec.
   ts`'s existing "keeps the fixed hierarchy in DOM order" test was updated to the corrected sequence
   (`decision-grid` before `decision-thesis`) — the ONLY existing test this session's product changes
   required touching.
2. **`Max risk` now carries `groundingState={rec.grounding?.fields.max_risk?.state}`** (previously
   omitted) — completing 3 of the 4 risk fields' register treatment (Invalidation and Target already
   had it). **`Entry` (`entry_trigger`) is deliberately left WITHOUT a register** — SPEC §4.5 names it
   as one of "the four risk fields," but the wire's `Grounding.fields` shape has exactly five keys
   (`exit_stop`, `exit_target`, `invalidation_level`, `max_risk`, `position_size`) and NONE of them is
   `entry_trigger`. This is the SAME shape as the corrected `no_edge` error the whole council spent its
   effort on — SPEC prose asserting something the shipped wire does not carry — recorded here rather
   than silently building a fabricated grounding state for a field that structurally can't have one.
3. **A dotted rule for "the model's own number" (untraced), added at the `RiskField` CALL SITE in
   `DecisionCard.tsx`, NOT inside `literals.ts`'s `registerSx`.** `literals.ts` is outside this task's
   Owns list, and `literals.spec.ts`'s own "registerSx — D3" describe block already pins
   `untraced`/`not_checkable`/`not_applicable` as mutually EQUAL `{fontFamily}`-only objects (a settled
   prior amendment) — adding a border there would break that suite's own exact-equality assertions.
   Layered `borderBottom: '1px dotted'` on top of `registerSx`'s return, scoped to
   `literal.kind === 'value' && groundingState === 'untraced'` only, so an absence literal (dash/not
   given/unavailable) never grows a spurious rule under it.

**Row 41 — a SECOND behaviour change SPEC §4.5 names explicitly, easy to miss on a fast read.** The
shipped `no_edge` branch of `ActionRegion` (A1b) was an EARLY RETURN — it replaced the idle composer
and primary action outright with just the gate note + Ask anyway, an "override rendered as a block"
per SPEC's own words. Fixed: A1b now renders the SAME primary control idle renders (disabled under the
closed gate, exactly as any other non-actionable idle sub-state disables it) PLUS the gate note as a
footnote beneath it — via a new shared `QuietGateNote` component (`AiRecPanelBlocks.tsx`, exported)
that BOTH A1b (`includeStanceLine`) and the new A1c annex (`includeStanceLine={false}`) render, so the
two arms can never drift apart on the note/caption/Ask-anyway text itself.

**GATE Z item flagged, not built — the A10 "previously pinned read stays pinned" retention.** §4.5's
A10 row and §5's error-handling section both state a request failure "keeps any previously pinned read
pinned and readable" — but the shipped `useAiRecommendation.ts` hook (NOT in FE-9's Owns list)
`setRec(res)`s the WHOLE `rec` object on every request, including a failure, so a produced read is
genuinely REPLACED (not merely hidden) the moment a subsequent ask fails. The literal §3 AC row 34 text
("never renders as idle or a no-trade verdict") does NOT itself require retention and IS satisfied
today (A10 already renders its own line, never idle, never no-trade) — retention is PLAN's own
Step-5-table elaboration and §4.5/§5's descriptive prose, neither of which carries its own numbered,
ship-blocking §3 criterion. Building it would mean either (a) editing `useAiRecommendation.ts`, outside
this task's Owns list, or (b) a parallel "last known produced rec" ref inside `AiRecPanel.tsx` that
risks silently disagreeing with the hook's own lifecycle (dismiss, ticker change, sign-out) — exactly
the kind of half-scoped mechanism FE-6's own RESUME entry declined to build for a structurally similar
reason. Flagging for GATE Z / a later lane rather than inventing it.

**Full verification, canonical commands, this session, exit codes actually checked:**
- `npm run typecheck` → **0**.
- `npx nx test @convexa/dashboard` → **0** @ **229 files / 2656 tests** (227/2507 baseline → +2 files
  [`readLayout.spec.ts` 113, `readLayout.render.spec.tsx` 36] / +149 tests — the pre-existing ai-rec
  suite's own 447 tests are UNCHANGED in count, all still green under the DOM reorder / colour-prop
  changes).
- `npm run lint` → **0** (same 5 pre-existing warnings total — 1 dashboard, 4 dashboard-e2e — no new
  ones).
- `npm run build` → **0** (production, both api release + dashboard bundle).
- `npx nx e2e dashboard-e2e` (against the PRODUCTION build, ports freed IPv4+IPv6 before and after) →
  **75/75 passed, 0 flaky**, matching FE-8's own already-recorded 75/75-on-prod signature — confirms
  this session's `Button color` / DOM-order changes did not disturb the registered visual/hit-area
  suite.

**Browser check, actually done, both colour schemes, through a real fetch-mocked `/ticker/TSLA` (Vite
dev + a throwaway Playwright script, not committed — deleted after, matching prior lanes' own
precedent).** Seeded a `(no_edge, fresh_trade)` scenario by making the recommendation-status AND the
recommendation POST response both report `gate.state: 'no_fresh_edge'` (the POST response's OWN gate is
what `applyGating` reads on success, which is what keeps `readinessGateState` closed AFTER a produced
read lands — the actual mechanism that makes this pair reachable in the real app, not just in a unit
fixture). Clicked "Ask anyway" from the A1b arm; confirmed in BOTH dark and light: the produced
`Trade · long` card renders (verdict amber, Archivo, `primary.main`; risk fields Mono/traced), the A1c
annex mounts BENEATH it (`No fresh edge right now — score below threshold` + caption + `Ask anyway`,
NO Mono `no_trade` line inside it), light mode genuinely repaints onto the light panel surface (no
dark-plate bleed, amber renders as the measured `amberDeep` #C57F19 there), zero console/page errors.
Also confirmed the "Full analysis & data" / "Set your risk inputs" fix visually (blue/info, not amber)
and "Create sim order" (neutral outline, not amber-bordered) in both screenshots. Killed the dev
server, ran `npm run ports:free` (confirmed one listener on :4200, killed) both before and after.

**Known deviations to carry into the build report (FE-14):**
1. `readLayoutFor`'s `bodyForResult` returns `'A3'` (not `'A3'`-or-`'A4'`) for all three degraded
   result states (`stale_newer_snapshot`/`stale_at_generation`/`superseded_inputs`) — the two-axis
   mapping cannot see `strategy.decision` (a THIRD fact outside the grid), so it cannot always pick
   between a stale TRADE and a stale NO-TRADE body. Documented in the function's own doc comment. The
   PRODUCTION render path (`DecisionCard.tsx`'s `isTrade`) does NOT consult this function and renders
   the correct verdict word regardless: this is a named limitation of the pure mapping's OWN return
   value, not a rendering bug.
2. The A10 "previously pinned read stays pinned" retention is flagged, not built (GATE Z, see above).
3. Four buttons' `color` props changed (`Full analysis & data`, `Set your risk inputs` → `info`;
   `Create sim order`, `Refresh` → `inherit`) — a real, necessary fix for criterion 30 (see above), but
   beyond PLAN's own illustrative code for this task, which never anticipated this defect existed.
4. `decision-grid`/`decision-thesis` DOM order swapped (row 31) — `DecisionCard.spec.tsx`'s existing
   order test updated accordingly; no other existing test depended on the old order.

## Next: FE-10 (not started)

**FE-10 — The bottom sheet and its peek row (under 768px).** Read PLAN.md's FE-10 section fresh before
starting. Depends on FE-9 (done, this session) for the panel body it wraps.
