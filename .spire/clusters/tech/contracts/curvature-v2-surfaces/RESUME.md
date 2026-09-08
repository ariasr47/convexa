# RESUME — curvature-v2-surfaces frontend lane (FE-13 → FE-14, then BE-1)

**Resume status:** ACTIVE — FE-11 and FE-12 landed clean, one commit each, in that order, on
`spire/curvature-v2-foundations`. Nothing is half-done: the working tree was clean at the stop
(aside from the untouched sibling-process directory noted below). This file is written by the lane
that just landed FE-11/12, ending the session at the 250k-token checkpoint guideline rather than
starting FE-13 on a degraded budget — FE-13 is a substantial new task (seeding, four new SB
criteria) that deserves a fresh context.

## Done (all committed on `spire/curvature-v2-foundations`; re-run before trusting)

| Task | Commit | What landed |
|---|---|---|
| FE-1 | `2cace383` | `shared/figure/{figureState,figureFace,FigureMarks,index}` + spec; `FigureCell` is a caller; N-1 needles enforcing behind a live-checked `EXEMPT` map |
| FE-2 | `be7c067b` | liveness fence widened to the four surfaces; banned `genuineIsLive` deleted from `PositionsPage.tsx` |
| FE-3 | `d905d26a` | scanner atoms consume the figure module; U-6 lookup-miss split; `EXEMPT` 14 → 12 |
| FE-4 | `356cea52` | scanner degraded price arm, flash gate, D-A copy |
| FE-5 | `bdc992d8` | positions rows on the module; every `⏸` → stroke icon; keyboard-reachable tips; `EXEMPT` 12 → 6 |
| FE-6 | `ede3ddd4` | positions header readout → `FigureCell`; `netPl.ts` five Net P/L states; `EXEMPT` 6 → 5 |
| FE-7 | `b2a8cf15` | Broker tab register conversion; `not provided` non-synonymy; pause icon; `EXEMPT` 5 → 0 |
| FE-8 | `83af0059` | Settings: risk-input register, neutral save confirmation, U-19/U-35. Two real defects fixed (`useSettings.ts` write-failure swallow; ticker draft revert). |
| FE-9 | `589bbc51` | Alerts store read-fault latch closing the loss-free durable-migration breach. |
| FE-10 | `81f77222` | Alerts page closed lookups, thresholds by type, unread off the colour edge, notify-permission honesty (a real defect fixed). |
| FE-11 | `1714f533` | Quiet band: `OffExchangeBlocks`/`FreshPositioning` MONO deleted, register through `@/shared/figure`; the absent contract-count token lifted into its own Sans span at the row's 12px; `MC_CELL_EMPTY` split into value `unavailable` + caption `this cycle`; `Setups.tsx` two-arm split (`undefined` vs `[]`); off-exchange proximity chip made keyboard-reachable. New `quiet-band.register.spec.tsx` (12 tests). Both mutation proofs (Q, R) run red, reverted green. |
| FE-12 | `727ce10b` | D-C: `AccessibleHelp` promoted `pages/ticker/widgets/ai-rec/` → `shared/ui/` (byte-for-byte), nine importers re-pointed; `Widget.tsx`'s bare info icon → the one shipped focusable-help pattern, fixing all eight `<Widget info=…>` sites; `curvature-v2.spec.ts` extended with a frame-scoped `U-32` site list (all eight `widget-{id}` roots incl. hero + tape); browser-quality manifest bumped `86 → 90` in lockstep (4 files). Mutation proof S run red against the **production build**, reverted green. |

**This session's own measurements (FE-11/12):** `npm run typecheck` **exit 0** (cold, every task) ·
`npm run lint` **exit 0**, 5 pre-existing warnings, 0 new, both tasks · targeted `nx test`/`vitest`
runs **exit 0** every task (FE-11: 57 files/795 tests then 61 files/829 tests after FE-12's
re-pointing; FE-12: 36 files/607 tests on the nine importers + 5 files/56 tests on the named desk
specs) · e2e `curvature-v2.spec.ts` against the **production build**: **exit 0, 11/11** (twice — once
before, once after FE-12's own mutation-proof rebuild) · `desk-and-read.spec.ts` (a different
feature's own file, run defensively): **exit 0, 6/6** · full `--list`: **90 tests in 7 files**,
matching the corrected manifest. Full detail, itemized copy diffs, and both tasks' mutation proofs
(Q, R, S — all run red, quoted, then reverted green) are in `BUILD_REPORT.md` §FE-11/§FE-12.

## Next concrete step: **FE-13 — the browser layer**, then **FE-14 — frontend closer**, then **BE-1 — backend verification**

Dispatch **one fresh Sonnet lane** for FE-13 (its own commit), then a fresh lane (or continuation)
for FE-14. Inputs the FE-13 lane must read: this file; `PLAN.md` header (traps table, baseline) +
**FE-13 in full, verify every cited line number with `grep -n` first — they drift** (confirmed
several times across this phase; the header/body split of PLAN's own "Owns" line for FE-12 omitted
the browser-quality manifest files it actually needed — read the whole task, not just its own
"Owns" line, and grep the actual tree state before trusting any PLAN line number); `SPEC.md` §7
(testing strategy, the two execution traps + the third phase-specific one), §3 rows 21/37A/62/63/64/
65/66/7a, §8 guardrails; `council/decisions.md` as PLAN's own FE-13 section cites; `BUILD_REPORT.md`
for the format and the FE-1/FE-8/FE-11/FE-12 sections (idioms below); `INTERFACE_CONTRACT.md`
(`NO_BACKEND_CHANGE` stands, nothing touches the backend).

What binds FE-13 (restated from PLAN, not a substitute for reading it in full):
- **Extend `seed()` in `no-overflow.spec.ts` (T4 — required, not optional).** It takes
  `{ scheme, positions }` only today, so `/alerts` is walked with no rules/events and `/scanner`'s
  wide-band walk asserts only page-attachment. Add `alerts?: 'seeded'` writing a non-empty
  `convexa.alerts.v1` (two rules of different kinds incl. a price threshold, three events, one
  unread) via the same `addInitScript`, plus pre-measure count assertions on `/scanner`
  (`scan-row` > 0) and `/alerts` (`alerts-rule` > 0) — the idiom the positions cases already use.
  **Without this, criterion 62 is green on empty pages.**
- **62 — 393 in BOTH schemes, 834/900/1280 in the one scheme the standing suite runs, over the four
  surfaces, seeded.** 21: no column clipped, table scrolls in its own container, page never scrolls
  sideways.
- **63 — the executed case list.** `npx playwright test -c apps/dashboard-e2e/playwright.config.ts
  --list` from the repo root, captured into the build report, naming every width×scheme
  combination row 62 claims. **The allowlist trap**: a spec not in `playwright.config.ts:30-38`'s
  `testMatch` array never runs and reports green — if you add a new file, add it there in the same
  commit and prove it with `--list`.
- **37A (D-B).** All five Settings sections reachable at every checked width in the shipped single
  640px column, no page-body overflow. No rail, no tabs — that is phase 4.
- **7a — the rendered container step.** At 1280 vs 393 on `/positions`, read
  `getComputedStyle(...).fontSize` of `[data-testid="positions-net-pl"]`'s value inside its
  `PanelContainer`: wide = `20px`, narrow steps to `17px`. This is Playwright's job — jsdom cannot
  evaluate a container query, and no criterion claims it can.
- **66 — the 44px effective hit area, both dimensions, coarse pointer, 393px**, for every control
  this phase created or touched: the eight frame ⓘs (FE-12), the off-exchange proximity chip
  (FE-11), the three positions literal tips, the alerts write affordances, the settings controls.
  `test.use({ hasTouch: true })` + `theme.ts:132-137`'s floor — measure `boundingBox()`, never
  restyle. Anything failing outside that set: itemize `file:line` as carried debt with a phase
  attached.
- **64/65.** Light mode at 393/1280, no scheme-invariant colour on any surface this phase touches
  (the extended `hex-discipline.spec.ts` plus a token-pair assertion); no figure/chip/label below
  the 11px floor at any checked width.
- **Run:** `npm run ports:free && npx playwright install chromium && npm run build` (production,
  never dev — confirmed again this session: `BROWSER_QUALITY_PREBUILD_STATUS=pass` is the local
  invocation that actually serves `apps/dashboard/dist` via `http-server`; the bare
  `npx nx e2e dashboard-e2e` without that env var falls through to the **dev server** locally, since
  `process.env.CI` is unset outside CI — see gotcha 13 below), then
  `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache` from the repo root.
  Target: **at or above phase 2's close-out of 86/86** — now baselined at **90/90** after FE-12's
  own addition (verify the actual number the moment you start; FE-13 adds more).

## Gotchas (carried from lanes 1–12; do not rediscover)

1. **A price-merge bug in `Scanner.tsx`'s zero-state lead grouping was found and NOT fixed** (carried
   debt, `BUILD_REPORT.md` FE-4 §3) — still unfixed, still not this lane's job.
2. **jsdom has no global `EventSource`** — stub a controllable class per the repo's own idiom.
3. **Live-checked `EXEMPT` maps fail on BOTH arms** (file must exist AND still violate).
4. **The `MONO_BOUND` needle-1 regex windows ±6/+12 lines around ANY line naming `MONO`/`MONO_FACE`/
   `monoSx`/`monoFontFamily` — including inside a comment.** Reword the comment or name the string as
   a constant; never restyle a render to dodge a heuristic. (N-1's scan is scoped to
   `features/trading/`, `pages/positions/`, `pages/scanner/` ONLY — `pages/ticker/widgets/**` is
   OUTSIDE this scan; a claim that a ticker-widget task "touches N-1's scanned trees" does not hold
   against the shipped glob — confirmed at source this session, see gotcha 12.)
5. **Scripted `sed`/heredoc edits risk silently no-op'ing on CRLF files.** Use the Edit tool;
   grep-verify after any scripted replace. (`git add` prints a harmless `LF will be replaced by CRLF`
   warning on this Windows box every commit — expected, not a defect.)
6. **`npm run ports:free`** at the start and the end of any app-verification pass (both IPv4 and
   `[::1]`).
7. **Seeding a populated `/positions` in a fresh `npm run dev` is a two-step trap** (sign up a
   throwaway account; `localStorage.removeItem('convexa.positions.v3')` in the SAME `page.evaluate`
   that seeds `convexa.positions.v2`, before the reload).
8. **Forcing a live SSE drop — or any specific data shape — against the real dev backend is
   unreliable in lane time.** This session hit it twice more: no currently-tracked symbol (`SPY`,
   `IWM`, `TSLA`, `AAPL`, `NVDA`, `MSFT`, `DIA`, `AMZN`, `META`) carried a non-empty
   `off_exchange.blocks` array or a null ATR sub-read during FE-11's browser pass; a cold
   `/api/ticker/SPY` options-chain fetch simply times out (>180s) against the real vendor while
   already-warm symbols (`IWM`) answer in ~2s (or ~0.01s once cached). **Use an already-warm symbol
   for ad hoc browser checks, and never assume a specific market-data shape is reachable live** — the
   `EventSource`-stub / fixture-driven jsdom tests are the reliable coverage; the browser pass is for
   reachable states only, and "not reachable this session" is a legitimate, honestly-reported
   outcome, not a gap to fake.
9. **Scratch files: never at the repo root as a PERMANENT artifact.** The sandbox write-guard blocks
   the OS temp dir directly for some tools, and even where a script CAN write to the OS temp dir
   (`node`/`playwright` scripts ran fine writing to it this session, just not always where you'd
   expect — see gotcha 14), a throwaway browser-driver script may still need to land at the repo
   root temporarily; delete it and its screenshots before the commit (confirmed via
   `git status --porcelain` showing no `_tmp_*` file each time this session).
10. **A task's targeted run must include every spec file whose `EXEMPT` map — or a coincidental
    `grep -rln "FE-<n>"` hit — names that task**, but **read each citation before acting on it**:
    this session's own FE-11 and FE-12 greps each returned files that were a **different feature's**
    own task numbering (`curvature-v2-desk-and-read`'s FE-11/FE-12), confirmed by opening each
    citation, not by the grep count alone. The whole `pages/ticker` suite (and, for FE-12, the other
    feature's own `desk-and-read.spec.ts` e2e file) was run anyway as a defensive superset.
11. **NEW (FE-8, still true): a criterion phrased "on settings"/"on the page" can be broader than the
    file list PLAN's own task illustration names.** Grep the WHOLE feature directory for the pattern
    the criterion actually describes, not just the files a task's "Owns" line enumerates.
12. **NEW (FE-9/10, still true): `writeServer`-shaped catch blocks that swallow an error without
    re-throwing hide a caller-observable defect that only a write-then-assert test catches.**
13. **NEW (FE-11/12): PLAN's own line numbers, importer counts and even a launch-dispatch's "verified
    anchors" can drift or be flatly wrong — grep-verify EVERYTHING before acting, not just line
    numbers.** Concretely this session: (a) the launch dispatch claimed FE-11 "touches N-1's scanned
    trees" — false, per gotcha 4 above, confirmed against the shipped `fonts.spec.ts` glob AND
    PLAN's own Independence table; (b) the launch dispatch claimed AccessibleHelp had "ten consumer
    files" including `PositionsPage.tsx` — false, that file only *mentions* `AccessibleHelp` in a
    comment, never imports it; the real count is nine, matching PLAN's own "Owns" line; (c) PLAN's
    own mutation-proof-Q text expected `fonts.spec.ts` needle 1 to go red alongside the new register
    test — it does not (see gotcha 4), because the quiet band is outside N-1's scan scope; the new
    `quiet-band.register.spec.tsx` IS the enforcement for criterion 54 there, not N-1. None of these
    were reasons to skip the underlying work — each was verified, recorded, and worked around
    correctly, but a lane that trusted any of the three at face value would have shipped either a
    missing conversion or a false "both went red" claim.
14. **NEW (FE-12): local e2e runs against the production build need
    `BROWSER_QUALITY_PREBUILD_STATUS=pass` explicitly exported** — `playwright.shared.config.ts`'s
    own `webServer.command` falls through to `npx nx run @convexa/dashboard:serve` (the **dev
    server**) whenever `prebuildStatus !== 'pass'` AND `process.env.CI` is unset, which is always
    true on a local box unless you set it. `npm run build` alone (without the env var on the
    Playwright invocation) does NOT make the e2e run serve that build locally. Confirmed by grepping
    prior QA_REPORT.md files in `curvature-v2-desk-and-read`, which record the exact same
    `BROWSER_QUALITY_PREBUILD_STATUS=pass nx run dashboard-e2e:e2e` invocation.
15. **NEW (FE-12): the browser-quality `manifest.json` is a FROZEN, closed inventory — adding a
    Chromium test to any e2e file the manifest already tracks (`curvature-v2.spec.ts`,
    `no-overflow.spec.ts`, `broker-grouping.spec.ts`, `desk-and-read.spec.ts`) requires updating FOUR
    files in lockstep, or the run reports green on Playwright's own summary while the custom
    `QualityReporter` throws per new test and the run's own `summary.json` records
    `"status": "incomplete"` with a nonzero `not_run`:**
    - `apps/dashboard-e2e/src/quality/manifest.json` — add one `{test_id, file, title_path, project}`
      entry per new test (`test_id` = any 64-hex-char string, e.g.
      `crypto.randomBytes(32).toString('hex')`); bump `full_chromium.inventory_id`.
    - `apps/dashboard-e2e/tools/lib/manifest.mjs` — the `validateManifest` frozen-count check
      (`inventory_id` string literal + `tests.length` literal).
    - `apps/dashboard-e2e/tools/manifest.spec.mjs` — a second, independent assertion of the same
      count (`node --test` this file + `mutations.spec.mjs` to confirm — this session found the
      manifest.json fix alone left this second file's own hardcoded count stale and failing).
    - `apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts` — `gateCounts.chromium`, a third
      hardcoded count, plus its own itemized-delta comment (follow the `52→75→86→90` convention).
    FE-13 is very likely to add MORE tests to `no-overflow.spec.ts` (criterion 62's seeded-page rows)
    — budget for this four-file update as part of that work, not as a surprise at verification time.

## `EXEMPT` maps (both live-checked on both arms, both empty)

- `shared/theme/fonts.spec.ts` (N-1, two needles): **0 entries**. Neither FE-11 nor FE-12 touched
  this file (out of N-1's scan scope for both — see gotcha 4/13a). FE-14 asserts it empty.
- `features/trading/positions/pauseGlyph.spec.ts` (criterion 29): **0 entries**.

## ⚠️ Still true — another process shares this working tree

`docs/research/convexa-business-review-2026-09-05/` remains untracked and was left alone all session
(confirmed present, unchanged, at both the start and the end of this lane's work). Verify HEAD is on
`spire/curvature-v2-foundations` before and after any work; stop and report if it moves. HEAD at the
end of this session: `727ce10b` (`feat(dashboard): FE-12 …`).

## Remaining arc (unchanged from PLAN, for orientation)

FE-13 (browser/e2e layer; seed extension, criteria 21/37A/62/63/64/65/66/7a; Playwright `testMatch`
allowlist extension if a new file is added — a spec not listed there never runs) → FE-14 (frontend
closer: whole-phase verification, both `EXEMPT` maps asserted empty, full suite + e2e against the
production build, the reviewer-only rows 7b/15/43/47c/56/60/63/69/U-15/U-19/U-24/U-27/U-37) → BE-1
(backend verification only: three-dot `apps/api` diff 0, score/tier/fingerprint byte-identical) →
GATE Q.
