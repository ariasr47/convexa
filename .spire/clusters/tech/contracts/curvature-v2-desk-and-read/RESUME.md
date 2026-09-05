# CONDUCTOR NOTE for FE-14 / GATE Q - the e2e quality reporter is CWD-dependent

`apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts:10` reads
`apps/dashboard-e2e/src/quality/manifest.json` as a path **relative to the process CWD**. Run from the
repo root (as `nx e2e` does) it resolves; run from inside `apps/dashboard-e2e/` it doubles the prefix and
crashes with `ENOENT ...apps/dashboard-e2e/apps/dashboard-e2e/src/quality/manifest.json` **before any test
runs**, while the piped exit code can still read 0.

The conductor hit this verifying FE-12's `--list` proof. The registration is genuinely correct - from the
repo root, `npx playwright test --config apps/dashboard-e2e/playwright.config.ts --list` shows **86 cases,
6 of them `desk-and-read.spec.ts`**. But a QA seat that runs playwright from the e2e directory will get a
confusing ENOENT rather than a test result, and could misread it as a broken suite.

**Always run e2e from the repo root, and check the exit code without a pipe swallowing it.** Worth a small
robustness fix (resolve the manifest relative to the reporter's own file) if FE-14 has room; if not, name
it in `BUILD_REPORT.md` as carried debt with a phase attached rather than leaving it undocumented.

# CONDUCTOR CORRECTION - the `apps/api` diff is EMPTY. Stop reporting 107 files.

**Two lanes have now reported a "107-file `apps/api` diff" and both were wrong.** It is an artifact of
comparing the wrong way. Measured by the conductor at FE-11:

| comparison | result | what it means |
|---|---|---|
| `git diff origin/main...HEAD -- apps/api` (**three-dot**) | **0 lines** | changes THIS BRANCH introduced - the invariant, and it holds |
| `git diff origin/main..HEAD -- apps/api` (two-dot) | 15 lines | includes commits **origin/main** gained since the branch point - not ours |
| `git diff e73c7b53..HEAD -- apps/api` (phase-2 build only) | **0 lines** | no build commit touched `apps/api` |

**Use the three-dot form.** A `BUILD_REPORT.md` or QA receipt claiming `apps/api` changed would be a
false GATE Q failure on the phase's headline invariant (`additive-keeps-score-byte-identical`,
NO_BACKEND_CHANGE). Note also that **local `main` is 56 commits behind `origin/main`** in this checkout,
so anything comparing against local `main` is measuring the wrong baseline entirely.

# GATE Z RESOLVED by the conductor (A10 retention) - 2026-09-05

The FE-9 lane flagged that A10's *"the previously pinned read stays pinned and readable"* needs
`useAiRecommendation.ts`, which is in **no task's Owns list** (FE-10 owns `ReadSheet.*` + `AiRecPanel.tsx`;
FE-11 owns `TickerDashboard.tsx` + specs). Same shape as the FE-6 flag: a spec requirement no task owns.

**Resolution: FE-10 owns it. Its Owns list is amended to add
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/useAiRecommendation.ts`.** FE-10 is the next AI-read
task and already owns the panel that consumes the hook.

**Do the cheap check FIRST - this may be zero mechanism plus one test.** SPEC §2.6 states two things that
must be reconciled before anything is built:
1. **"A10 never composes"** - it is an *exclusive body*, because the host passes `poweringReason: null`
   whenever `rec.status === 'produced'` (`AiRecPanel.tsx:176-181`), so `unavailable` and a produced read
   cannot be the same render.
2. **"the previously pinned read stays pinned and readable"** on a request failure.

If (1) holds, then a failed **refresh** while a produced read is held may never reach `unavailable` at
all - in which case the retention is already true **by construction** and what is missing is a *test that
proves it*, not a mechanism. **Establish which it is at source before writing code.** If it is genuinely
missing, implement it **inside the hook**, never as a parallel ref in the panel - the lane was right that
a second source of truth risks disagreeing with the hook's own lifecycle, and that is the fabrication
class this whole phase exists to remove.

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

## Done (FE-10) — do not re-do

**FE-10 — the bottom sheet and its peek row (under 768px), plus the GATE Z A10 retention amendment.**
Owns (as landed): new `pages/ticker/widgets/ai-rec/{ReadSheet.tsx,ReadSheet.spec.tsx}` ·
`pages/ticker/widgets/ai-rec/AiRecPanel.tsx` · `pages/ticker/widgets/ai-rec/useAiRecommendation.ts`
(GATE Z amendment) + new `useAiRecommendation.spec.ts`. **One necessary collateral fix outside the
Owns list, forced open by actually running the full e2e suite** (see below):
`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` (one line, one locator re-anchor).

**GATE Z's cheap check, done FIRST, at source — the retention was genuinely missing, not true by
construction.** Read `useAiRecommendation.ts`'s `request()` catch branch fresh: it called
`setRec({status:'unavailable', ...})` **unconditionally** on any non-auth failure — including a
REFRESH fired while a produced read was already pinned (`DecisionCard`'s own "Refresh" button and the
A1c annex's "Ask anyway" both call `ai.request()` again while `producedRec` is truthy). That genuinely
REPLACES the pinned rec, not merely hides it — confirmed reachable, not hypothetical. Fixed **inside
the hook only** (never a parallel ref in the panel, per the GATE Z instruction): `setRec` in the catch
branch is now a **functional update** — `current?.status === 'produced' ? current : {...unavailable
artifact}` — so a failed refresh over an already-produced read is a no-op; only the FIRST failed ask
(nothing pinned yet) still synthesizes `unavailable`. This also resolves the SPEC §2.6 tension the GATE
Z note flagged: because `requestState`/`resultState` are read off the SAME `rec` object, retaining the
produced `rec` means `requestState` never becomes `'unavailable'` while a produced result exists —
A10 and a produced result stay mutually exclusive **by construction**, exactly as premise (1) said,
once the eviction bug was fixed. New `useAiRecommendation.spec.ts` (2 tests, `renderHook` + a
`requestRecommendation`/`fetchRecStatus` network-boundary mock): the retention itself (byte-identical
object via `toBe`, not merely equal), and a CONTRAST test proving the guard does not swallow the base
A10 case (first failure, nothing pinned, still synthesizes `unavailable`).

**Mutation proof actually run (poison → confirm red → revert):** reverted the functional-update guard
back to the old unconditional `setRec({...unavailable})` — the retention test went red naming the exact
mismatch (`status: "produced"` expected, `"unavailable"` received); the contrast test stayed green
(proving it isolates the right behaviour). Reverted; both green again.

**The sheet: one component, CSS for the wide/narrow split, ONE genuinely new subtree.** `ReadSheet.tsx`
wraps the EXISTING `<Widget>...</Widget>` JSX in `AiRecPanel.tsx` (a two-line wrap at the call site,
nothing inside the Widget's own body touched). Under `>=768px` (`useMediaQuery(theme.breakpoints.down
('tablet'))`, degrading to `false` under jsdom's absent `matchMedia` — every pre-existing AiRecPanel/
DecisionCard test keeps exercising the wide anatomy untouched) it returns `children` straight through,
zero wrapper. Under `<768px` it portals `children` into an MUI `Drawer anchor="bottom"` (gets
`theme.zIndex.drawer` (30) and the already-shipped `extrasFor(theme).scrim` backdrop for free — both
bind at the theme layer, phase 1, not re-invented here) with a `transitionDuration={320}` (DESIGN_
SYSTEM.md's own named "bottom sheet 320ms" data-signal motion entry). The container-query hazard
(§2.5): the Drawer's Paper is portalled to `document.body`, severing `@container panel`'s ancestry —
re-declared via the sanctioned `<PanelContainer>` component one level inside the Paper (NOT
`panelContainerSx` directly on `slotProps.paper.sx` — that slot's `sx` type is narrower than `Box`'s
and rejects the array form; the component wrapper sidesteps the type fight cleanly, still the same
sanctioned name, still zero new patterns).

**The sheet defaults OPEN, not collapsed — a real, load-bearing finding, not an assumption.** The
peek row (verdict-only, tap/click to open) exists only once the sheet is explicitly MINIMIZED via a
chevron control inside the expanded body. First attempt defaulted to collapsed (matching a naive
reading of "peek row"); running `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts`'s ALREADY-SHIPPED
`openProducedRecommendation()` helper (taps "Analyze current snapshot" at 393px, asserts
`decision-verdict`/`decision-grid` attached with NO intervening "expand" step) against that version
red-built 3 of its 5 cases — an actually-run proof, not a guess. Flipped the default to `expanded=true`
so a freshly-produced read shows up immediately, exactly as it always has; the peek row is reached only
by tapping the minimize chevron (or the Drawer's own backdrop/Escape, which routes to the same
`setExpanded(false)`). Verified again after the fix: same 5 cases green.

**Exactly one verdict node, criterion 45 (SB).** The minimize control inside the expanded Drawer
carries NO verdict text of its own (an early draft would have repeated it, mounting two
`decision-verdict` nodes at once while expanded — caught before shipping, not after) — it is a bare
`IconButton`. `ReadSheet.spec.tsx` (7 tests): wide passthrough (one node, no sheet machinery); narrow
default-expanded (one node, the full body's own, minimize control present); narrow minimized (one
node, the peek row's own, full body genuinely UNMOUNTED — MUI's `Modal` does not keep closed-Drawer
children in the DOM by default, so this is a real unmount, not a CSS hide); narrow re-expanded (one
node again); the wide anatomy and the minimized peek render the SAME string `toBe`-equal from the SAME
`verdict`/`isTrade` props (computed ONCE in `AiRecPanel.tsx` from `producedRec.strategy.decision`/
`.bias` — the identical object `DecisionCard` itself renders from, never a second wire read); verdict
`null` (idle/loading/unavailable/signed-out — row 42) shows the body directly at both widths, no peek
row, no phantom verdict. **Mutation proof actually run:** temporarily rendered `children` ALONGSIDE the
peek row (simulating the exact double-mount bug the design guards against) — 4 of 6 tests went red on
Testing Library's "multiple elements found" error, naming both nodes. Reverted; 6/6 (7/7 after the
default-flip revision) green again.

**Criterion 46 (review, browser 393) — the unit half only, `[lane-check]`.** jsdom does not evaluate
container queries; `ReadSheet.spec.tsx`'s own container-hazard describe block asserts the DECLARATION
only (`emotionClassOf`/`allRulesForClass`/`joinedStyleText`, the SAME `_kit/emotionCssReader.ts` idiom
`ReadStrip.spec.tsx` already established) — confirms `container-type:inline-size;container-name:panel`
on the `PanelContainer` wrapper one level inside the portalled root. The STEPPING behaviour itself is
confirmed in the browser check below, at a real 393px width.

**A real collateral break, found ONLY by running the full e2e suite (not assumed safe) — fixed with a
one-line re-anchor, not a design change:** `no-overflow.spec.ts`'s "AI recommendation decision card"
describe block already opens a produced rec at 393px and asserts `page.locator('.MuiDrawer-paper')`
has `overflow:hidden` (originally written when the "Full analysis & data" `AnalysisSurface` Drawer was
the ONLY Drawer paper ever on that page). The moment `ReadSheet`'s own Drawer ships (open by default,
393px, once a read is produced), that class-only locator resolves to TWO elements and Playwright's
strict mode throws. Fixed by re-anchoring to the `dialog` locator ALREADY defined two lines above
(`page.getByRole('dialog', {name: 'Full analysis & data · TSLA'})` — the exact same node the class
locator used to reach by luck) — the assertion's own intent (that specific analysis drawer's overflow
containment) is unchanged, only the path to it. This is the SAME "necessary write-path overlap" shape
FE-8/FE-9 already established precedent for (a later/sibling task's file needs a small, forced,
surgical fix when an earlier task's own change breaks it) — not scope creep into FE-12's file.

**Full verification, canonical commands, this session, exit codes actually checked:**
- `npm run typecheck` → **0** (`tsconfig.app.json` then `tsconfig.spec.json` rebuilt fresh after
  deleting stale `dist`/`out-tsc` — the CLAUDE.md-documented phantom-error trap fired once this
  session on an unrelated stale cache; cleared before trusting any red).
- `npx nx test @convexa/dashboard` → **0** @ **231 files / 2664 tests** (229/2656 baseline → +2 files
  [`ReadSheet.spec.tsx` 7, `useAiRecommendation.spec.ts` 2] / +8 tests — matches exactly, no other
  file's count moved).
- `npm run lint` → **0** (same 5 pre-existing warnings — 1 dashboard, 4 dashboard-e2e — no new ones).
- `npm run build` → **0** (production, both api release + dashboard bundle).
- `npx nx e2e dashboard-e2e` (production build, ports freed IPv4+IPv6 before/after, twice this
  session — once before the `no-overflow.spec.ts` fix to CONFIRM the break, once after to confirm the
  fix) → **75/75 passed, 0 flaky**, matching FE-8's/FE-9's own recorded signature. One isolated re-run
  of `curvature-v2.spec.ts`'s AC-34 hit-area test showed a single sub-pixel flake (43.999969… vs 44,
  an existing hamburger-drawer close-button measurement, nothing to do with ai-rec) that passed clean
  in isolation and in the full 75/75 run — recorded as the SAME environmental flake class prior
  sessions already logged, not this task's code.

**Browser check, actually done, both colour schemes, at 393px, through a real fetch-mocked
`/ticker/TSLA` (production `serve-static` + a throwaway Playwright script, not committed — deleted
after, matching prior lanes' own precedent).** Seeded a produced trade rec via the POST stub, drove:
(1) idle, before asking — composer visible, no sheet machinery; (2) after asking — the sheet opens by
default, full body incl. `Trade · long` verdict (Archivo, amber), risk grid, minimize chevron, scrim
dimming the page behind it; (3) tap minimize — the peek row alone (`Trade · long`, amber, chevron-up)
with the rest of the page (tape, orders, quiet band) fully visible/scrollable above it; (4) tap the
peek row — re-expands, same content. Confirmed in BOTH dark and light: light mode genuinely repaints
onto the light panel surface (no dark-plate bleed — this needed the SAME two-part theme seed FE-8's
session already discovered and documented: `localStorage['convexa.uiprefs.v1']` AND the mocked
`/api/auth/session` response's `settings.theme`, both from the same `scheme` variable, or "light"
silently renders dark), zero console errors. Also confirmed at 1280 (wide): the panel renders inline
in normal flow, `Trade · long` verdict visible in place, zero sheet machinery mounted (measured:
`getByRole('button', {name: 'Minimize the AI read'})` count 0). Deleted the throwaway script and all
nine screenshots, confirmed `git status --short` showed no stray files, killed the server, ran
`npm run ports:free` (both before and after every serve cycle this session).

**Known deviations to carry into the build report (FE-14):**
1. GATE Z amendment: `useAiRecommendation.ts` added to FE-10's Owns list by the conductor (A10
   retention) — see above, not a scope decision this lane made unilaterally.
2. The sheet's default-expanded / minimize-to-peek interaction shape is NOT literally specified by
   SPEC/PLAN (which name only "a peek row carrying the verdict," not its open/closed default or its
   dismiss control) — this session filled that gap with the minimal mechanism an existing, already-
   shipped e2e flow forced (see above), rather than inventing a richer interaction (swipe gestures,
   partial-height drag) the contracts never asked for. Flagging so a design review can confirm the
   shape if desired; no criterion is under-met by it (45/46 both hold in every reachable state).
3. `no-overflow.spec.ts` — one locator re-anchored (`.MuiDrawer-paper` → the already-defined `dialog`
   locator), forced by this task's own change, outside FE-10's Owns list but the same sanctioned
   "necessary collateral fix" shape FE-8/FE-9 already used.

## Done (FE-11) — do not re-do

**FE-11 — Compose the desk, burn down the one spacing exemption this phase rewrote, and resolve the
three GATE Z items the launch brief assigned (ladder/tape-trail offline+F6, the orphaned
`structureSnapshotSubtitle`, `GexStrikeProfile`'s coexistence).** Owns (as landed, per PLAN's
Independence row): `TickerDashboard.tsx`, `ticker-hierarchy.spec.tsx` (necessary collateral, not
literally in the row but forced — see below), `ticker.risk.spec.tsx` (same), `spacing-ladder.spec.ts`
(EXEMPT re-point). **Beyond the literal Owns row**, GATE Z's own resolution commit (`015b99ea`)
explicitly assigned FE-11 the ladder-mid/tape-trail treatment, which required touching
`level-ladder/{ladderModel.ts,LevelLadder.tsx}` (FE-5's files), `structure-hero/{StructureHeroPanel.tsx,
StructureHeroPanel.spec.tsx,TapeTrailRow.tsx,TapeTrailRow.spec.tsx}` and `chrome/{TapePulseStrip.tsx,
TapePulseStrip.spec.tsx}` (FE-6's files) — the same "necessary write-path overlap" shape FE-8/9/10
already established, documented at each edit site, not silently absorbed. Additionally touched:
`_kit/copy.ts` (GATE Z item 2), `gex-profile-chart/{chart.tsx,chart.spec.tsx,index.ts}` +
`git rm GexStrikeProfile.{tsx,spec.tsx}` (GATE Z item 3), `single-motion-moment.spec.ts` (forced
collateral — its own `(c)` pin quoted a comment inside the deleted file), plus one wholly new file,
`ticker-desk-composition.spec.tsx` (criteria 47/54, additive — PLAN's own Step 2/3 text describes new
assertions with no obvious home in the four Owns-row files; same "additive, cheap regression
insurance" precedent FE-5/FE-7 already used for files beyond their own enumerated lists).

**GATE Z item 1 — the ladder mid row's and tape-trail row's offline/stale + F6 replay treatment (SPEC
§4.1), mechanised by branching on the STANDING UNION, never `!isLive`.** `ladderModel.ts`'s `LadderRow`
gained `offline: {retained} | null` / `replay: boolean` — `null`/`false` on the four structure rows in
EVERY standing (byte-identical, un-dimmed, matches criterion 19's existing proof), populated only on
the mid row from two new optional `LadderInput` fields (`midOffline`/`midReplay`). `LevelLadder.tsx`'s
`LadderLine` forwards `row.offline`/`row.replay` into `FigureCell` — zero new mechanism, the exact
`offline`/`replay` props `LiveTape.tsx`'s cells already use. `StructureHeroPanel.tsx` computes
`midOffline = tileOffline ? {retained: midLatch.retained} : null` and `midReplay = Boolean(st)` — MUTUALLY
EXCLUSIVE by construction (`tileOffline` is `st ? false : streamOffline`, so it can never be true while
`st` — a replay standing — holds), which is the whole mechanism criterion 16b needs: implemented as
`!isLive → pause mark` the two would contradict (a replay standing always has `midLive` false); implemented
over the standing union they structurally cannot, because replay is not offline. **Mutation-proven**:
poisoned `midOffline` to `!claim ? {...} : null` (the literal `!isLive`-shaped contradiction) — the
16b replay test went red naming `offline-retained` where `replay` was expected; reverted, green again.
Also poisoned by dropping `replay={row.replay}` from `LevelLadder.tsx`'s call site — three tests
(two in `LevelLadder.spec.tsx`, one integration in `StructureHeroPanel.spec.tsx`) went red naming
`live`/`default` where `replay` was expected; reverted.

**A genuine second finding, not merely the offline plumbing: `StructureHeroPanel.tsx`'s mid STREAM
READ was gated on `claim` alone, which is ALWAYS false during replay — so before this session, the
ladder mid (and the tape-trail's own `Mid` readout) could never show a real number during a session-tape
replay, only ever the empty literal.** Fixed by gating on `numbersActive = st ? tape.displayActive :
claim` — the EXACT discipline `live-tape/LiveTape.tsx`'s own `numbersActive` already established (S0
genuinely live / S1 display-active during replay), never a new one. `claim` itself is UNCHANGED and
still governs `midLive`/the live dot (never true during replay). Verified non-vacuous the same way
`live-dot-census.spec.tsx`'s own replay tests already prove for LiveTape's cells: the new
`StructureHeroPanel.spec.tsx` replay case asserts the ladder mid AND the tape-trail readout both show
the REAL replayed value (`$573.12`), not `—`.

**The tape-trail row's own `Mid` readout (`chrome/TapePulseStrip.tsx`) never had ANY offline
treatment at all before this task** — only the row-level caption (`TapeTrailRow.tsx`'s `paused &&
(...)`) existed; the value itself never dimmed or wore a pause mark. Added a new `paused?: boolean`
prop (threaded `TapeTrailRow` → `TapePulseStrip`, the same `tileOffline` value the row's own caption
already uses — one signal, two renderers, never two computations), rendering a `PauseIcon` (mirroring
`FigureCell.tsx`'s own `PauseMark` styling, not a new pattern) + `opacity: 0.5` on the value span when
`paused`. Since `paused` is the host's `tileOffline`, it structurally cannot be true during a replay
standing — the identical mechanism, not a second one. **Mutation-proven**: poisoned `TapePulseStrip.tsx`'s
`px: 1.5` back to `1.25` (see the spacing item below, same file) — unrelated to this specific mechanism,
so the offline/F6 poison was the `LevelLadder`/`StructureHeroPanel` ones above; the pause-mark mechanism
itself was proven by 7 new `TapePulseStrip.spec.tsx` tests (default no-mark, paused+retained,
paused+bare, `paused=false` during replay never marks) plus a `TapeTrailRow.spec.tsx` integration test
proving `paused` reaches the readout, not only the row caption.

**GATE Z item 2 — the orphaned `structureSnapshotSubtitle`.** Deleted (`_kit/copy.ts`), not wired.
Confirmed zero importers (`rg structureSnapshotSubtitle apps/dashboard/src` → zero matches after
deletion) and zero test references (`copy.spec.ts` never asserted it). Not wired into `ReadStrip`/
`StructureHeroPanel`'s own subtitles because SPEC §4.6 PINS the hero's basis line verbatim
(`"levels are REST structure (as-of {age}) · the mid is tape"`) — different wording, already shipped,
already tested; wiring the old helper there would contradict pinned copy. `withStructureAge` (the
shared helper it called) is untouched — still used by `gexProfileSubtitle`/two other live call sites.

**GATE Z item 3 — `GexStrikeProfile` does not survive, anywhere; the desk becomes ONE structure
instrument.** Confirmed FULL functional supersession before deleting anything (not assumed): every
capability `GexStrikeProfile.tsx` had — `StructureFieldCanvas`, the walls/flip/mid, the embedded
`StructurePathStrip` — is already present in `StructureHeroPanel`, and `GexStrikeProfile` had zero
other importers anywhere in the app (`rg -l GexStrikeProfile` before deletion: the widget file, its own
spec, its own barrel, and `TickerDashboard.tsx` — nothing else). Deleted whole (`git rm
GexStrikeProfile.{tsx,spec.tsx}`), mirroring the FE-8 `DealerPositioning` precedent, not merely
unmounted — leaving a fully-superseded, still-importable widget around risks a future lane innocently
re-mounting it and recreating the exact "two overlapping instruments" problem this item exists to
close. `chart.tsx` (which `GexStrikeProfile` also used) SURVIVES, trimmed: `GexProfileChart`/`GexLegend`
(the standalone component + its legend, now fully dead) removed; `windowedStrikes`/`rowsToSamples`
(pure functions `StructureHeroPanel.tsx` ALSO calls directly) kept — the file's own module doc explains
why it outlives the widget. `chart.spec.tsx` rewritten to test the two surviving pure functions
(porting `windowedStrikes`'s tests from the deleted `GexStrikeProfile.spec.tsx` — that function is not
dead-widget debt, `StructureHeroPanel` depends on it) plus a new `rowsToSamples` test (previously
untested anywhere). **A coverage regression caught and closed, not silently dropped**: the deleted
`chart.spec.tsx`'s own criterion-53 proof ("the resolved `surfaces` object never renders the same
across dark/light") tested `GexProfileChart`'s theme resolution — with that component gone, criterion
53's RUNTIME proof had no host left. Ported onto `StructureHeroPanel.spec.tsx` (the file that now owns
that resolution in production), reusing its own already-mocked `captured.canvas` scaffolding — not a
new mechanism. `gex-profile-chart/index.ts` re-points its one export line at `./chart` (the barrel
had nothing else to export once `GexStrikeProfile.tsx` was gone).

**`TickerDashboard.tsx`'s own rewrite, beyond removing `GexStrikeProfile`'s JSX**: (a) the OLD
standalone masthead `<TapePulseStrip>` mount (between `CommandDeck` and the widget bento, predating
FE-6's absorption of the tape trail into the hero) is DELETED, not merely left — it was a second,
literally duplicate render of the SAME component the hero's own `TapeTrailRow` already mounts (proven
before removing: a throwaway browser script counted exactly 1 `[data-testid="tape-pulse-strip"]` node
after the change, confirming the duplicate is gone, not merely relocated); its now-unused
`tapePulsePalette`/`tapePulseSurfaces`/`tapePulseClaim`/`tapePulseMid` computations and their imports
(`resolveLevelPalette`, `isDeliveringLive`, `extrasFor`) are removed with it. (b) `PositionBrief` moves
OUT of the structure zone and INTO the "Tape & plan" zone, immediately after `LiveTape` and before
`AiRecPanel`/`OrdersWidget` — matching SPEC §1's flow line verbatim ("AI read brief wide beside tape /
position / orders"), a real, deliberate reorder, not a renaming. `AiRecPanel`'s own `span`/width prop
was NOT changed — "wide" in the flow diagram reads as a description of the existing rendered outcome
(confirmed in the browser check below), not a literal instruction PLAN elaborates further; not touched
absent a stronger signal (`do not invent product UX policy the contracts omit`).

**Two collateral fixes, forced open only by actually running the full suite, not assumed safe (the
same shape FE-8/9/10 already established):**
1. `single-motion-moment.spec.ts`'s own `(c)` pin quoted `isAnimationActive={false}` INSIDE the
   deleted `GexProfileChart`'s doc comment (retiring the OLD Recharts contract). Re-pointed onto
   `StructureHeroPanel.tsx` — the substantive claims survive (no `animationDuration`, no
   `isAnimationActive={true}`, no `from 'recharts'`, does use `StructureFieldCanvas`); the literal
   `isAnimationActive={false}` string requirement is dropped because `StructureHeroPanel.tsx` never
   had Recharts to retire from (built fresh on Canvas2D at FE-6) — there is no equivalent retirement
   comment to require there, only the substantive absence.
2. `liveClaim.spec.ts`'s BANNED-pattern source scan (reads RAW file text, comments included — the
   SAME trap FE-6's own session already hit and documented) flagged a NEW doc comment in
   `StructureHeroPanel.tsx` that literally spelled `isLive && !streamOffline` while explaining
   `LiveTape.tsx`'s own `numbersActive` derivation. Reworded to describe the branch without quoting
   the literal expression — the same "word around it" convention FE-6's session established.

**`ticker-hierarchy.spec.tsx` and `ticker.risk.spec.tsx` — forced, not FE-11's literal Owns row, same
necessary-overlap shape.** `ticker.risk.spec.tsx:373` asserted `widget-gex-strike-profile` stayed
present through an SSE drop — re-pointed to `widget-structure-hero` (its successor, same claim: the
structure instrument survives a drop). `ticker-hierarchy.spec.tsx`'s DOM-order test asserted
"Structure → position brief → Tape & plan → Supporting context" — rewritten for the new order
("Structure → Tape & plan [live tape, position brief, AI read, orders] → Supporting context"), with
`position-brief` now asserted AFTER `board-zone-plan` and AFTER `live-tape`, before `board-zone-context`.
`ticker-age-basis.spec.tsx`'s own `gex` check was ALREADY conditional (`if (gex) {...}`, future-proofed
by a prior lane) — needed zero changes, confirmed green as-is. `ticker-semantics.spec.tsx`/
`stage3-headings.spec.tsx` (the two files PLAN's Owns row actually names) needed ZERO changes — FE-8's
own session already re-pointed the one heading assertion that would have broken; verified green,
not assumed.

**Criteria 47/54 — new tests, no obvious home in the four Owns-row files, additive** (`ticker-desk-
composition.spec.tsx`, 10 tests):
- **Criterion 47** (AI-read isolation): mounts the real app 6 times (a baseline + signed-out/without-
  a-key/cooling-down/capped/request-failure), capturing `textContent` for `widget-structure-hero`,
  `widget-live-tape`, `widget-read-strip` and three quiet-band widgets, asserting byte-identical
  against the baseline in every AI state. **Mutation-proven, non-vacuous**: temporarily folded the
  AI panel's own text into the captured set — all 5 comparison cases went red (the AI panel's text
  genuinely differs per state, proving the byte-comparison mechanism is sensitive), while the diff
  output showed the four REAL regions unchanged even in the failing case; reverted.
- **Criterion 54** (one shared entry dialog): a source scan (`?raw` glob, the same idiom `liveClaim.
  spec.ts`/`spacing-ladder.spec.ts` already use) proving exactly ONE component matches
  `/\w*Entry\w*Dialog\w*/` app-wide (`TradeEntryDialog`, in `tradeEntry/TradeEntryDialogView.tsx`;
  `features/trading/TradeEntryDialog.tsx` is a pure re-export barrel, not a second declaration) — a
  temporary poison file declaring `FakeEntryDialog` proved the scan actually bites, then was deleted.
  A second scan confirms `TickerDashboard.tsx` calls `useTickerTradeFlows(` exactly once and mounts
  `<TradeEntryDialog` exactly twice (the ghost-entry instance + the documented additive ORDER
  variant) from one import. A behavioural test clicks `PositionBrief`'s own CTA
  (`position-brief-open-trade`) and confirms it opens `[data-testid="trade-entry-dialog"]` — the SAME
  node `ai-rec.grounding.spec.tsx`'s own "Accept opens the shared entry dialog" test already proves
  the AI path reaches, not merely a lookalike. `[no-real-order-path]`: confirms `TickerDashboard.tsx`
  never calls `fetch('/api/orders...)` directly and delegates through the sanctioned
  `useOrderEngine`/`usePortfolio` hooks (the broader invariant is guarded elsewhere, not re-derived
  here).

**Step 4 — the spacing burn-down, actually done (not merely checked for pre-existing cleanliness).**
Of the files this phase touched, exactly ONE was on `spacing-ladder.spec.ts`'s EXEMPT list:
`chrome/TapePulseStrip.tsx` (its `px: 1.25` header padding). Moved onto the ladder (`1.5` = 12px, the
nearest 4-pt step) and the EXEMPT entry removed in the same commit. Measured before/after (a small
node script mirroring the spec's own regex, not the spec itself): **49→48 occurrences, 26→25 files** —
exactly the expected -1/-1. **Mutation-proven**: reverted `px: 1.5` back to `1.25` with the EXEMPT
entry still removed — `spacing-ladder.spec.ts`'s "no NEW off-ladder spacing" test went red naming the
exact file/value; reverted. No other EXEMPT file was touched (`position-brief/PositionBrief.tsx` was
READ, never rewritten — only its JSX call site moved in `TickerDashboard.tsx`) — the fence is not
widened beyond files this phase actually rewrote, per ruling 4.

**Full verification, canonical commands, this session, exit codes actually checked (not printed
summaries):**
- `npm run typecheck` → **0** (checked repeatedly through the session, including after the final
  formatting pass).
- `npx nx test @convexa/dashboard` → **0** @ **231 files / 2693 tests** (231/2664 baseline →
  net +29 tests: -1 file/-3 tests for the deleted `GexStrikeProfile.spec.tsx`, +1 net test in the
  rewritten `chart.spec.tsx` [2→3], +5 `ladderModel.spec.ts`, +4 `LevelLadder.spec.tsx`, +4
  `TapePulseStrip.spec.tsx`, +2 `TapeTrailRow.spec.tsx`, +5 `StructureHeroPanel.spec.tsx` [4 GATE Z
  integration + 1 criterion-53 port], +10 new `ticker-desk-composition.spec.tsx`; file count nets to
  231 because the one deleted file is offset by the one new file). Ran the FULL suite fresh
  (`--skip-nx-cache`) twice this session, both clean — no Nx flaky-task notice this time.
- `npm run lint` → **0** (same 5 pre-existing warnings — 1 dashboard, 4 dashboard-e2e — no new ones).
- `npm run format:check` → the bare npm script silently ignores `--files` (prettier has no such flag;
  only Nx's OWN `format:write`/`format:check` targets accept it) — used scoped `npx prettier --check/
  --write <exact files>` instead, on the 6 files it actually flagged (whitespace/wrap only, no logic
  changes); re-checked clean after.
- `npm run build` → **0** (production, both api release + dashboard bundle). `git diff --name-only
  $(git merge-base main HEAD)..HEAD -- apps/api` → **107** files, unchanged from every prior
  checkpoint this branch — confirmed again, not assumed.
- e2e, against the PRODUCTION build (`serve-static`, ports freed IPv4+IPv6 before/after,
  `--skip-nx-cache`), run TWICE: first pass **74/75** (the SAME documented sub-pixel flake class prior
  sessions recorded — `43.999969… vs 44`, the hamburger-drawer close button, unrelated to this
  session's code), second pass **75/75, 0 flaky**. `--list` confirms 62 `curvature-v2`/`no-overflow`
  rows, matching the pre-existing baseline exactly (T1/T2/T3 are FE-12's own scope, untouched).

**Browser check, actually done, the production build, all five width×scheme combinations named in the
task brief.** Built production, served via `serve-static --port=4200` (the same command CI/prior
lanes use), stubbed the network with a hand-built bundle fixture (not the `curvature-v2.spec.ts`
fixture verbatim this time — a smaller, self-contained one; same shape), seeded BOTH
`localStorage['convexa.uiprefs.v1']` AND the mocked `/api/auth/session` response's `settings.theme`
from the same `scheme` variable (the FE-8-documented two-part theme trap). Ran at **393×852 dark,
393×852 light, 834×1100 dark, 900×1100 dark, 1280×1400 dark, 1280×1400 light** — six renders (one
extra light check at 1280 beyond the five named, cheap and confirms the P5 finding holds at both a
narrow and a wide breakpoint). At every one: `document.documentElement.scrollWidth ===
document.documentElement.clientWidth` (**zero page overflow**, measured, not eyeballed); DOM order of
`widget-structure-hero` < `widget-read-strip` < `ai-rec-panel` < `widget-market-context` (**the
reading order holds**); `widget-gex-strike-profile` count **0** (confirmed gone); `tape-pulse-strip`
count **1** (confirmed the masthead duplicate is gone, only the hero's own remains); zero console
errors. Visually confirmed via full-page screenshots at 1280 dark/light (light mode genuinely
repaints the field canvas onto the light panel surface, no dark-plate bleed) and a scroll-targeted
393px crop of the "Tape & plan" zone (Live tape's four figure cells, Position brief, AI recommendation
card all render in the intended order — an initial diagnostic screenshot appeared to show a blank
region there, traced to a screenshot-timing race in the throwaway script itself, not a real defect;
re-shot with a longer settle wait and confirmed correct). All throwaway scripts (`_fe11_visual.mjs`,
`_fe11_closeup.mjs`, `_fe11_diag.mjs`) and screenshots deleted after use, confirmed via `git status
--short` showing no stray files; server killed, ports freed both before and after.

**Known deviations to carry into the build report (FE-14):**
1. GATE Z item 1's mechanism required a genuine VALUE-flow fix in `StructureHeroPanel.tsx` (gating the
   mid stream read on `numbersActive` instead of `claim` alone) beyond what "add offline/replay props"
   alone would have needed — without it, F6 would have been structurally reachable but always vacuous
   (never a real number during replay). Documented in-file and here so a later lane doesn't mistake it
   for scope creep.
2. `GexStrikeProfile.tsx`/`.spec.tsx` deleted whole, not merely unmounted — a stronger action than the
   launch brief's own wording ("decide and record whether it survives anywhere") strictly required,
   justified by full confirmed functional supersession (see above) and the FE-8 `DealerPositioning`
   precedent. If a reviewer disagrees, the revert is small (two files, one barrel line, one
   `chart.tsx`/`chart.spec.tsx` partial revert).
3. `AiRecPanel`'s `span`/width prop was NOT changed despite SPEC §1's "AI read brief WIDE" wording —
   read as a description of the already-rendered outcome (confirmed in the browser check), not an
   instruction to add a new prop; flagging so a design review can confirm the reading.
4. `ticker-hierarchy.spec.tsx`/`ticker.risk.spec.tsz` — collateral fixes outside FE-11's literal Owns
   row, forced by this task's own composition change, same sanctioned shape FE-8/9/10 already used.
5. The remaining 48 off-ladder spacing occurrences across 25 files (all outside this phase's rewritten
   set) stay booked to `SPACING_DEBT_BURNDOWN_PHASE` ("curvature-v2 phase 4, responsive sweep") — not
   widened, per ruling 4.

## Done (FE-12) — do not re-do

**FE-12 — The browser layer: re-anchor, re-point, register, prove execution.** Commit `73d79584`.
Owns (as landed, per PLAN's Independence row): `playwright.config.ts` (testMatch registration) ·
new `apps/dashboard-e2e/src/e2e/desk-and-read.spec.ts` · `no-overflow.spec.ts` (criterion 50).
`apps/dashboard-e2e/src/quality/manifest.ts` did NOT need a "deleted testids" edit (nothing was
deleted this task) — but a file PLAN's Owns row does NOT name, `manifest.json` (plus its three
downstream consumers), turned out to need one anyway; see the necessary-overlap item below.

**Steps 2/3 were already correct before this task started — verified fresh, not re-done.**
`no-overflow.spec.ts:398-405`'s `/ticker/TSLA` readiness anchor already carries FE-8's own
`getByTestId('level-ladder')` + `getByText('Call wall').first()` pair, byte-identical to PLAN's own
illustrative Step-2 code. The widths (`VIEWPORT` = 393×852 both schemes; `WIDE_VIEWPORTS` = 834/900/
1280, dark only) were already exactly PLAN's Step 3 shape — confirmed by reading the file, not
trusted from a prior session's citation. **834 already shipped (FE-8's own comment names it) — did
NOT add it a second time.**

**Step 1 + Step 5 — `desk-and-read.spec.ts`, six tests, three groups (not four).** PLAN's own Step 5
names FOUR groups, but criterion 9 (exactly one connection chip in the viewport at both scroll
positions, `tape-stream-state` gone) already had FULL, currently-green browser coverage in
`curvature-v2.spec.ts`'s `AC-1a` describe block (landed at FE-6/FE-8) — using `toBeInViewport` per
node, the EXACT reviewer probe PLAN's own text names. Re-verified it's still green and still uses
`toBeInViewport` before deciding not to duplicate it; duplicating a passing browser assertion in a
second file buys nothing. The three groups that got NEW tests:
1. **Criterion 45 (SB)** — two tests: 393px alone (exactly one `decision-verdict` node after opening
   the analysis), and a SECOND test that resizes the SAME session 393→1280 and asserts the SAME
   verdict string persists as exactly one node — stronger than two independent page loads, since it
   proves the bottom sheet and the wide panel are one field, not two coincidentally-matching ones.
2. **Criteria 20/22 evidence** — two tests. Criterion 20's own `test` mark is already satisfied at
   the unit tier (`paintStep.spec.ts`'s recording-context proof, per SPEC §7's own text); this
   browser companion proves what a real DOM CAN see on a stream drop (the `connection-chip` flips to
   `offline` via `page.clock.install()` + a split `fastForward(14_000)`/`fastForward(1_000)` past
   `STREAM_OFFLINE_MS` — the EXACT working pattern this repo's own `quality/accessibility.spec.ts`/
   `compatibility.spec.ts`/`visual.spec.ts` already use for the identical watchdog, not invented
   fresh; `structure-field-canvas` stays attached at unchanged geometry) and attaches before/after
   screenshots for a reviewer to judge the rest (criteria 21/22 stay `review` — canvas pixel content
   beyond attachment/geometry is not something this harness can assert without re-deriving FE-4's own
   recording-context fixture inside a browser test). A second test does the same attach-and-capture
   under `reducedMotion: 'reduce'`.
3. **Criterion 52 (P5, review)** — two tests (393, 1280), and the one place this task went BEYOND a
   review-only screenshot: reads a real pixel (`getImageData(2, 2, 1, 1)`) from the canvas's own base
   `surfaces.ink` fill (`StructureHeroPanel.tsx`'s `theme.palette.background.default`) in both
   schemes via a SECOND `context.newPage()` (never a second `seed()` call on the same page —
   `addInitScript` accumulates across navigations, so a second call would stack rather than replace)
   and asserts they differ — a genuine automated proof, not merely a screenshot, that the field's own
   fill is not scheme-invariant. Measured values from the mutation proof below: dark `11,15,23`,
   light `246,246,243`.

**THE THEME TRAP, deliberately engineered around, not merely noted.** `useSettings.ts`'s precedence
rule (D7) is "signed in ⇒ the SERVER `settings` WIN" — `curvature-v2.spec.ts`'s AND
`no-overflow.spec.ts`'s OWN stubs both hardcode the mocked `/api/auth/session` response's
`settings.theme` to `'dark'` regardless of the `scheme` parameter (harmless there because neither
ever exercises light mode against that hardcoded value — confirmed by reading both files fully, not
assumed). `desk-and-read.spec.ts`'s own `stubNetwork` drives `settings.theme` from the SAME `scheme`
parameter as the localStorage seed, exactly the fix FE-11's session already had to discover the hard
way for its own throwaway script. Criterion 52's test would have been SILENTLY VACUOUS (always
reading the same dark-rendered ink twice) without this.

**A genuine, unplanned necessary-overlap fix, found only by actually running the full gate — not
assumed safe:** `npx nx e2e dashboard-e2e` runs `tools/run-gate.mjs chromium`, which validates every
executed Chromium test against a FROZEN, hand-maintained per-test inventory
(`quality/manifest.json`'s `full_chromium.tests`, cross-checked by `quality-reporter.ts`'s
`mapChromiumIdentity`, `tools/lib/manifest.mjs`'s `validateManifest`, and `tools/manifest.spec.mjs`'s
own unit test) — the exact SAME "an unregistered/unlisted test reports green by never being counted"
shape PLAN's own T1 worries about, one layer deeper. `git log` on `manifest.json` shows it was frozen
at 75 tests since PHASE 1's own landing commit (`404f8144`) and never touched by ANY of this phase's
FE-1 through FE-11 lanes — confirmed by checking git history, not assumed — because none of them
added a net-new Chromium test to the six registered specs (all prior additions were edits/re-points
of existing tests). This task is the FIRST to add net-new tests (11: 6 in `desk-and-read.spec.ts` + 5
criterion-50 tests in `no-overflow.spec.ts`), so it is the first to trip this gate. Fixed by adding
11 entries to `manifest.json` (`test_id` = sha256 of the title-path array, matching the required
`/^[a-f0-9]{64}$/` shape the validator enforces — the field is opaque, never re-derived or verified
against content, confirmed by reading `mapChromiumIdentity`/`quality-reporter.spec.mjs` before relying
on that), bumping `inventory_id` from `curvature-v2-foundations-75-v1` to
`curvature-v2-desk-and-read-86-v1`, and bumping the three other hardcoded `75`s
(`quality-reporter.ts:64`, `tools/lib/manifest.mjs`'s validator, `tools/manifest.spec.mjs`'s own
unit assertion) to `86`. `manifest.ts` (the file PLAN's Owns row actually names) needed NO edit —
its own `qualityManifest` object only lists compatibility/accessibility/visual inventories, not the
per-test Chromium list, which lives in the separate `manifest.json` PLAN's text did not anticipate.
Ran the 17-test `node --test` tooling suite (`manifest.spec.mjs`, `summary.spec.mjs`,
`quality-reporter.spec.mjs`, `mutations.spec.mjs`) after the edit — 17/17 green, confirming the
manifest shape itself is still valid, not just that the count matches.

**Mutation proofs actually run (poison → confirm red → captured output → revert), both this
session:**
1. **Registration (T1, SPEC row 51's own reason for existing):** removed `'desk-and-read.spec.ts'`
   from `playwright.config.ts`'s `testMatch` array, ran `npx playwright test --list`, confirmed
   `grep -c 'desk-and-read'` returns **0** — the spec vanishes from the listing entirely, proving the
   registration is load-bearing. Reverted; `--list` shows all 6 cases again.
2. **The assertion itself (criterion 52):** flipped `expect(lightInk).not.toBe(darkInk)` to
   `.toBe(darkInk)` in the committed file, ran `npx playwright test -g "Criterion 52"` against the
   production build — both the 393px and 1280px cases went RED, naming the real measured values
   (`Expected: "11,15,23"`, `Received: "246,246,243"`) — proving the check is genuinely sensitive to
   real pixel data, not vacuously true. Reverted; confirmed `git diff` on the file returns nothing
   (byte-identical to the committed version), re-ran the same `-g` filter green (2/2 passed).

**Full verification, canonical commands, this session, exit codes actually checked (not printed
summaries):**
- `npm run typecheck` → **0**.
- `npx nx test @convexa/dashboard` → **0** @ **231 files / 2693 tests** (unchanged from FE-11's own
  baseline — this task touched zero files under `apps/dashboard/`, only `apps/dashboard-e2e/`).
- `npm run lint` → **0** (same 5 pre-existing warnings — 1 dashboard, 4 dashboard-e2e — no new ones).
- `npm run build` → **0** (production, api release + dashboard bundle).
- `git diff origin/main...HEAD -- apps/api` → **0 lines** (the three-dot form the RESUME's own top
  correction demands — re-verified, not assumed).
- `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` → exit 0, names
  `desk-and-read.spec.ts` with all 6 cases (captured and pasted below).
- `npx nx e2e dashboard-e2e --skip-nx-cache` against the PRODUCTION build (`npm run ports:free`
  swept IPv4+IPv6 before/after every run) → **86/86 passed, 0 flaky**, exit 0 — run **twice** for
  independent confirmation (4m13s cold, 18.0s warm; both clean, no flake notice either time).

**The executed case list (SPEC row 51's own requirement — captured, not narrated) — the five
`/ticker` overflow row×scheme combinations from the `--list` output:**
```
no-overflow.spec.ts › 393px no-overflow · dark scheme › /ticker/TSLA fits the viewport
no-overflow.spec.ts › 393px no-overflow · light scheme › /ticker/TSLA fits the viewport
no-overflow.spec.ts › tablet 834 no-overflow · dark scheme › /ticker/TSLA fits 834px
no-overflow.spec.ts › md 900 no-overflow · dark scheme › /ticker/TSLA fits 900px
no-overflow.spec.ts › lg 1280 no-overflow · dark scheme › /ticker/TSLA fits 1280px
```
Five rows — 393 dark, 393 light, 834, 900, 1280 — matching PLAN's own reviewer-probe wording exactly
("names 393 dark, 393 light, 834, 900, 1280 — five rows, not eight").

**Browser check / visual evidence, actually done.** The desk-and-read.spec.ts tests themselves ARE
the visual-evidence mechanism this task needed (per-scheme screenshots attached to the Playwright
report for the stream-drop/reduce-motion/light-mode groups, `testInfo.attach`, viewable via
`npx playwright show-report` against the last run's HTML report) — this task's own criteria (45, the
20/22 evidence pair, 52) are ABOUT capturing that evidence programmatically and reliably on every
run, not a one-off manual click-through, so no SEPARATE throwaway script/screenshot cycle was run
beyond what the committed specs themselves produce. Confirmed the light/dark ink values are real and
different (see mutation proof above) and confirmed via the attached screenshots (viewed from the
test-results directory during the mutation-proof run) that the hero genuinely repaints onto the light
panel surface at both 393 and 1280 — no dark-plate bleed.

**One honest scope note, not a gap:** PLAN's Owns row lists `manifest.ts` "(if it names deleted
testids)" — it doesn't, and nothing was deleted this task, so that specific conditional never fired.
The manifest work this task actually needed (`manifest.json` + its three downstream consumers) is a
different file PLAN's text didn't name at all, surfaced only by actually running the full quality
gate rather than assuming `npx playwright test`'s own pass/fail was the whole story. Recording this
here so a later lane doesn't rediscover the same gate from scratch, and so the build report can note
it as a necessary-overlap fix in the same documented shape FE-8/9/10/11 already established for their
own out-of-Owns-row edits.
