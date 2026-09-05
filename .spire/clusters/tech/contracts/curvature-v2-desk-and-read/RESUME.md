# curvature-v2-desk-and-read — frontend build RESUME

**Resume status:** ACTIVE

**Branch:** `spire/curvature-v2-foundations` (do not push). Two commits landed this session on top
of `e73c7b53`:

- `6d7116e1` — FE-1 (the branded liveness claim)
- `047eddef` — FE-2 (the stream retention latch)

Working tree is clean at the time of writing. `npm run typecheck` **0**, `npx nx test
@convexa/dashboard` **0** @ **218 files / 2403 tests** (up from the 215/2376 baseline), `npm run
lint` **0**. e2e not touched yet (that's FE-12).

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
- `liveClaim.spec.ts` carries the mutation-guarded source scan (the `arc.spec.ts` idiom) forbidding
  a second liveness expression (`genuineIsLive`, `tape.isLive`, `isLive &&`) in
  `pages/ticker/widgets/**`. **EXEMPT currently has THREE entries, not the one PLAN.md's snippet
  shows** — `live-tape/LiveTape.tsx` (the plan's own seed), plus **`chrome/TapePulseStrip.tsx`** and
  **`gex-profile-chart/GexStrikeProfile.tsx`**, both of which already violate the fence today
  (measured, not assumed — see the comment in `liveClaim.spec.ts` right above `EXEMPT`).
  **FE-6 must remove all three entries in the same commit that fixes those two files** (re-point the
  LiveTape entry to `structure-hero/StructureHeroPanel.tsx` per the plan; just delete the other two).
  If FE-6 removes fewer than three or more than three, the scan's own liveness assertion (`every
  EXEMPT entry still exists`) or its "no non-exempt file" assertion will tell you which.
- `liveClaim.typeproof.spec.ts` — the `@ts-expect-error`/TS2578 compile-time proof. Mutation-proven
  (widened `LiveClaim` to `boolean`, confirmed TS2578 on both directives via `npx tsc --build
  tsconfig.spec.json --emitDeclarationOnly` from `apps/dashboard/`, reverted).

**FE-2 — the retention latch.**
- `useStreamLatch.ts` (new) + spec — holds last non-null STREAM value, `retained` boolean, one reset
  token (`` `${symbol}|${replay?'replay':'live'}` ``).
- `copy.ts` — new `LIVE_TAPE_SUBTITLE_OFFLINE_EMPTY` constant + pin test.
- `LiveTape.tsx` — net flow, spread AND gamma flip each own a latch now (the plan explicitly wants
  all three, not just gamma flip, "so criterion 12 covers them too" — this is a real behaviour
  change from phase 1: net flow/spread used to hard-code `retained: false` on every drop). Gamma
  flip's value/boolean come **only** from the latch, never `?? m.gamma_flip` (criterion 14). Label
  is now `Gamma flip · live` / `Gamma flip · session tape` (criterion 18), never the old `Gamma flip
  (live)` / bare `Gamma flip` ternary.
- Row **16 is BLOCKED — GATE Z**, per PLAN.md's own STOP block. **Do not build a pause mark for a
  symbol change or a replay arm** — 16a/16b (bare member no pause mark; F6 no pause mark
  respectively) are the only provable substance, and `useStreamLatch.spec.ts` already covers the
  reset-token half of both. Record row 16 `BLOCKED — GATE Z` in the eventual `BUILD_REPORT.md`; do
  not merge it into one green row.
- Mutation proof strengthened beyond the plan's own suggestion: `ticker.risk.spec.tsx`'s drop test
  originally pushed `gamma_flip: 248` on the stream while the bundle fixture's `gamma_flip` is
  **also** 248 — restoring the old `?? m.gamma_flip` fallback would render the same number by
  coincidence and the mutation proof would falsely pass. Changed the pushed stream value to **253**
  (distinct from the bundle's 248) and added an explicit `$253`/not-`$248` assertion. This is the
  kind of vacuity trap criterion 57 exists to catch — re-check any other page-level fixture that
  reuses the same numeric literal on both the bundle and the stream before trusting its mutation
  proof.
- `LiveTape.spec.tsx` gained a dedicated block for criteria 12/13/15/15b/17/18 (component-level,
  using `rerender` across props rather than the SSE mock). Criterion 17's "does not re-flash" check
  had to be done on the emotion **class name** (`className` before/after equality, with a
  same-mechanism anti-vacuity check that a genuine value change DOES change the class) — **jsdom
  does not resolve `animation-name` from an injected emotion stylesheet via `getComputedStyle`**, so
  an animation-name-based assertion is silently vacuous (I hit this, caught it via the anti-vacuity
  half, and switched approaches — do not reintroduce a `getComputedStyle(...).animationName` check
  for flash state anywhere else in this phase).

## Known deviation to carry into the build report (FE-14)

`apps/dashboard/src/app/pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx` is edited by
FE-1 (the `NOT_LIVE` mechanical fix) even though PLAN.md's Independence table does not list it under
FE-1's paths — it is FE-8's file. This was necessary because FE-1's brand change is a breaking API
change to `FigureCell`/`Widget` that every existing consumer must satisfy immediately for the tree to
typecheck (`npm run typecheck` is NOT deferred — constraint 3), and `DealerPositioning.tsx` passes
thirteen literal `live={false}`s. The fix is mechanical (identical runtime value) and the file is
deleted whole at FE-8, so there is no lasting footprint. Note this in `BUILD_REPORT.md`'s deviations
section.

## GATE Z item already flagged by PLAN.md (not new)

Criterion 16 split into 16a/16b — see PLAN.md's STOP block at the top and SPEC §9 item 1's sibling
discussion. FE-2 (done) implements only the provable 16a/16b substance via the reset token. No further
action needed from a later lane on this specific item beyond recording it in the build report.

## Also worth flagging, not caused by this session

`git diff --name-only $(git merge-base main HEAD)..HEAD -- apps/api` currently returns **107 files**,
not zero — but every one of those changes predates this session (they are prior commits on this
branch, `abf38d35` and earlier, i.e. curvature-v2-foundations phase-1 and older work that has not
been merged/rebased onto `main`). `git status --short` confirms my own working tree touches nothing
under `apps/api`. This is **BE-1's** check to run and report, not something the frontend lane caused
or can fix — flag it to the conductor rather than assuming it is this session's fault.

---

## Next: FE-3 (not started)

**FE-3 — the shared stroke table, the canvas's theme input, and the coupled exemption removal.**
Owns: new `shared/charts/structure-field/levelStrokes.ts` (+spec),
`StructureFieldCanvas.tsx`, `structureFieldShared.ts`, `types.ts`,
`gex-profile-chart/chart.tsx`, `shared/theme/hex-discipline.spec.ts`. Depends on FE-1 (done).

Read PLAN.md lines ~754–877 again fresh (do not trust memory of it) before starting — it is dense:
token-key stroke table (never raw colours), `resolveLevelPalette(theme)`, the canvas gains
`palette`/`surfaces` props (replacing ten module-level hex literals `INK`/`PANEL`/`RAISED`/
`PHOSPHOR`/`STEEL`/`RED`/`GREEN`/`AMBER`/`SIGNAL`), and the **coupled** `hex-discipline.spec.ts`
exemption removal (delete only the entries whose files stop carrying hex — run the spec **before**
and **after** the deletion and record both outputs, since a stale entry FAILs the same test a
missing one does, in the other direction).

**Trap already flagged in PLAN.md's own U-6**: `hex-discipline.spec.ts` exempts **three** files this
phase de-hexes, not one — `StructureFieldCanvas.tsx`, `structureFieldShared.ts` AND
`chrome/TapePulseStrip.tsx` (the last is FE-6's, not FE-3's — do not touch its exemption entry in
FE-3; FE-6 removes it when it fixes that file). `labTokens.ts`'s exemption entry stays regardless
(out of this phase's scope) — do not remove it.

After FE-3: FE-4 (paint step extraction, depends on FE-3) is the next big one — PLAN.md calls it
"the phase's largest single mechanical cost" (a ~460-line rAF closure to extract). Budget accordingly
in the next session; it is not a quick follow-on to FE-3.

## Process notes for whoever continues

- Read PLAN.md/SPEC.md/INTERFACE_CONTRACT.md/council/decisions.md fresh — do not trust a prior
  session's paraphrase of them (including this file's).
- Delete `apps/dashboard/dist`, `apps/dashboard/out-tsc`, `*.tsbuildinfo` and rebuild
  `tsconfig.app.json` **before** `tsconfig.spec.json` any time typecheck output looks phantom
  (TS2353/TS6305) — hit this once this session, documented in CLAUDE.md as a known trap.
  `apps/dashboard-e2e/out-tsc` too, if you touch e2e.
- Every mutation proof: actually run the poisoned variant, actually see it go red, actually revert.
  I found two of my own draft proofs were vacuous before running them for real (the criterion-14 page
  fixture reusing 248 on both sides; the criterion-17 `animationName` check) — trust the run, not the
  plan text's phrasing of what "should" happen.
- `npx nx format:write --files <comma-separated-list>` only — never bare.
- Node/npx: prepend `C:\nvm4w\nodejs` to PATH in this shell if missing.
