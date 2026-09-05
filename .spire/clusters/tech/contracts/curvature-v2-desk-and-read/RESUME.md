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

Working tree is clean at the time of writing (post-FE-5 commit). `npm run typecheck` **0**, `npx nx
test @convexa/dashboard` **0** @ **224 files / 2460 tests** (up from the 221/2424 baseline after
FE-4: +3 files, +36 tests), `npm run lint` **0** (no new warnings, same one pre-existing
`react-hooks/exhaustive-deps` warning in `useSessionArchive.ts`, unrelated to this branch). e2e not
touched yet (that's FE-12).

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

## Next: FE-6 (not started)

**FE-6 — the structure-field hero: one `Widget`, four presentational children, one store read.**
Owns: new `pages/ticker/widgets/structure-hero/{StructureHeroPanel.tsx,StructureHeroPanel.spec.tsx,
TapeTrailRow.tsx,index.ts}` · `pages/ticker/widgets/chrome/{TapePulseStrip.tsx,
TapePulseStrip.spec.tsx,index.ts}` · `pages/ticker/widgets/gex-profile-chart/{GexStrikeProfile.tsx,
chart.tsx}` · `pages/ticker/widgets/dealer-positioning/WallMagnetView.tsx` (moved into
`structure-hero/`) · `shared/charts/structure-field/StructureFieldCanvas.tsx` (a11y wrapper only).
Depends on FE-2 (done), FE-4 (done), FE-5 (done).

Read PLAN.md's FE-6 section fresh (around line 1163 in the copy read this session — **re-check the
line number, it drifts**) before starting, AND re-read `LevelLadder.tsx`'s own module doc — its
props are `rows: LadderRows`, `anchorText: string | NotANumber`, `palette: LevelPalette`, ALL
pre-computed. Key traps:
- **`StructureHeroPanel` is the ONE component calling `useLiveTape()`** in the whole hero (SPEC §2.1)
  — it derives the branded claim once and hands `rows`/`anchorText`/`palette`/`mid`/`claim` down as
  props to four presentational children (`StructureFieldCanvas`, `LevelLadder`, `TapeTrailRow`,
  `StructurePathStrip`). Building `rows` means calling `buildLadder({ callWall: m.call_wall, putWall:
  m.put_wall, maxPain: m.max_pain, gammaFlip: m.gamma_flip, mid: <tape mid>, midLive: andPresent(claim,
  mid), anchor: levelSpot(m) })` from `level-ladder`'s barrel, and `anchorText` via
  `formatAnchorText(levelSpot(m))` — both exported from `@/pages/ticker/widgets/level-ladder`.
- **`palette` must be the SAME object** `StructureFieldCanvas` receives (`resolveLevelPalette(theme)`,
  computed once, passed to both) — criterion 7's identity check depends on this literally, not just
  visually.
- **INNER BOUNDARY**: the `ErrorBoundary` wraps ONLY the canvas region, not the whole hero — a canvas
  fault must not blank the REST-only ladder.
- **The `Live`/`Mid` word is DELETED** from `TapePulseStrip.tsx:199`, not demoted — becomes `Mid`
  unconditionally, beside the existing `Structure ${structureMid}` readout, unchanged.
- **`TapePulseStrip.tsx:33`'s `isLive`** must gain the `andPresent(claim, mid)` requirement (currently
  can print "Live" over a REST structure mid when the stream is up but carries no mid — criterion 10,
  SB).
- **`TapePulseStrip.tsx:71,73`'s paint-loop fallback** (`displayMid = liveMid ?? structureMid`, pushed
  every rAF frame unconditionally) must gate on the claim + latched mid, using FE-2's latch.
- **Criterion 24 (P1, DELEGATED):** the canvas needs `role="img"` + `aria-label` +
  `aria-describedby` pointing at a visually-hidden summary `<p>`, per `design/src/lib.mjs:296`
  (correcting `decisions.md`'s `:293` citation).
- **`hex-discipline.spec.ts`'s exemption list** currently carries `structureFieldShared.ts`,
  `labTokens.ts`, and `chrome/TapePulseStrip.tsx` (three entries) — this task fixes
  `TapePulseStrip.tsx` (P5, same edit as the `Live`/`Mid` fix) and MUST remove its entry in the same
  commit, dropping the list to two.
- **`liveClaim.spec.ts`'s EXEMPT list** (FE-1 note, still live) currently carries THREE entries —
  `live-tape/LiveTape.tsx`, `chrome/TapePulseStrip.tsx`, `gex-profile-chart/GexStrikeProfile.tsx`.
  This task must remove all three in the same commit that fixes those files (re-point the LiveTape
  entry to `structure-hero/StructureHeroPanel.tsx`, delete the other two).

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
