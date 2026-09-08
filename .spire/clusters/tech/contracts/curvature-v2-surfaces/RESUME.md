# RESUME — curvature-v2-surfaces (build and repair track COMPLETE; owner already ruled on 7a — a re-verification GATE Q pass is the only thing left before GATE S)

**Resume status:** ACTIVE — **GATE Q pass 3 (recorded in `QA_REPORT.md`) returned 94 PASS / 1 FAIL / 0
UNVERIFIABLE, sole FAIL criterion 7a. IMPORTANT — that record is now STALE in one respect: an owner
ruling on 7a (`decisions.md` D-E, commit `64f5c1ed`) landed on this branch DURING this pass's own
session, as an ancestor of this pass's own start point, before this lane made any edits.** Ruling A:
7a's wording is amended — it now scopes to figures whose panel **can reach** the 20px base; a panel
deliberately bounded below the 360px threshold (`PositionsPage.tsx:203-209`'s `positions-net-pl`,
pinned `maxWidth 320 / minWidth 200 / flexShrink 0` — load-bearing, not incidental) falls under 7b,
which already requires the size and reason be named in the build report (it already is). Nothing
rendered changes; only `SPEC.md` row 7a and its §7 invariant paragraph were amended, both by the owner
process, not this lane — `PositionsPage.tsx` itself is confirmed still byte-unchanged since `cc6e3ae2`.
**This lane did not touch SPEC.md, decisions.md, or PositionsPage.tsx — verified by diff before and
after.** Net effect: **criterion 7a is very likely no longer a FAIL under the amended wording** (the
one PositionsPage panel that couldn't reach the base now correctly falls under 7b, which it already
satisfies), but **this lane did not re-run GATE Q against the amended criterion — that re-verification
is QA's next step, not a claim this lane is making.**

**GATE Z repair pass 4 is DONE, one commit, HEAD moved from `64f5c1ed` (unchanged start of THIS pass —
already carrying the D-E ruling) to `16addcdb`.** Pass 4 fixed the one Medium, non-blocking finding QA
pass 3 raised alongside the 7a FAIL: the pass-3 repair's `<summary>` fix (`display: flex`) reached the
44px coarse-pointer floor but silently removed the native disclosure triangle (a `<summary>` only
generates `::marker` when it computes `display: list-item`, which `flex` overrides away). Fixed with
`line-height: 44px` instead of `display`/`alignItems` — `list-item` (and the marker) is never touched.
Verified the marker renders at 393/coarse, 393/fine and 1280/fine via
`getComputedStyle(summary).display === 'list-item'` (the actual mechanism; `::marker`'s own computed
style was proved unreliable — it reports cascade values even when the pseudo-element isn't generated)
plus real-browser screenshots taken during the investigation. Poison run: reverted to the pass-3 shape,
1 failed / 2 passed, `Expected: "list-item" / Received: "flex"` at the coarse case only; file restored
and confirmed byte-identical by `git hash-object`. **There is nothing further identified for a
frontend lane to do on this feature. Next concrete step: QA re-runs GATE Q once against the amended
criterion 7a wording (D-E) plus this pass's marker fix; if that comes back clean, the phase is ready
for GATE S.**

**This pass's one commit** (`fix(dashboard): GATE Z — restore the disclosure marker the coarse-pointer
fix removed (curvature-v2-surfaces)`, `16addcdb`), with its own `BUILD_REPORT.md` "GATE Z repair, pass
4" section — 7 files: the fix (`TrackRecordSection.tsx`), 3 new e2e tests (`no-overflow.spec.ts`), the
four-file manifest lockstep (105 → 108), and the `BUILD_REPORT.md` section itself.

**This pass's own verification, exit codes (HEAD `64f5c1ed` unchanged start, confirmed again at
`16addcdb` after commit):** `npm run typecheck` **0** (cold — dist/out-tsc/tsbuildinfo deleted first,
`@convexa/dashboard` + `@convexa/api` + `dashboard-e2e`) · targeted
`npx nx test @convexa/dashboard --skip-nx-cache -- src/app/features/trading/outcomes` **0, 133/133** ·
full suite once **0, 239/239 files, 2857/2857 tests** (standing baseline, unmoved) · `npm run lint` **0**,
5 pre-existing warnings, 0 new · `node --test manifest.spec.mjs mutations.spec.mjs` **0, 7/7** ·
`npm run build` **0** (production) · `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e
--skip-nx-cache` **0, 108/108 passed, 0 flaky**, `summary.json` `108/108/108`, `status: "pass"`, no
`"incomplete"` · `git diff origin/main...HEAD -- apps/api` **0 lines** (three-dot) · `npm run
ports:free` clean, first and last · `docs/research/convexa-business-review-2026-09-05/` confirmed
present, untouched throughout; no `git stash` used.

## Superseded — pass 3's own top section, kept for history (do not act on as current state)

**Resume status was:** ACTIVE — GATE Q pass 2 returned FAIL (93 PASS / 2 FAIL / 0 UNVERIFIABLE):
criterion 7a (owner decision, untouched, unchanged) and criterion 66's second clause (four sub-floor
controls the build report itemized nowhere). GATE Z repair pass 3 fixed one (`TrackRecordSection.tsx`'s
`<summary>`) and itemized three as carried debt untouched this phase.

**Pass 3's one commit** (`fix(dashboard): GATE Z — criterion 66, the /positions summary control
meets the coarse-pointer floor (curvature-v2-surfaces)`, `2e3329f8`), with its own `BUILD_REPORT.md`
"GATE Z repair, pass 3" section:

- **The rule applied, stated once:** criterion 66 binds a control iff
  `git log f8957d3f..HEAD -- <file>` is non-empty for the file rendering it. Touched ⇒ fixed.
  Untouched ⇒ itemized as carried debt with `file:line`, the measurement, and a phase attached.
- **Fixed** — `TrackRecordSection.tsx:226-231`'s `<summary>` ("What wasn't counted — and why",
  `/positions`; touched this phase at `bdc992d8`, FE-5). A native `<summary>` matches none of
  `theme.ts`'s coarse-pointer selector list (`button, [role="button"], a, input`) — same escape
  mechanism as MUI `Select`'s self-duplicated class, a different element instead of a specificity
  fight. Fixed LOCALLY with a `'@media (pointer: coarse)'` block (`minHeight: 44`,
  `display: 'flex'`, `alignItems: 'center'`) — no specificity workaround needed, unlike `Select`.
  Measured 345×21.4375 → **345×44** at 393/coarse; **1192×21.4375** at 1280/fine — height
  byte-identical to the pre-fix shipped value, proving the coarse-only mechanism is inert on desktop.
  Two new e2e tests (`no-overflow.spec.ts`) hard-assert both directions. Manifest bumped `103 → 105`
  in the four-file lockstep.
- **Itemized, NOT fixed** — three controls with zero commits this phase (`git log f8957d3f..HEAD`
  empty for each): `AiRecPanel.tsx:288-300` (`Next read persona` select, 327×38.5625),
  `TickerToolbar.tsx:155-182` (`Expirations` select, 190×38.5625), `features/personas/components.tsx:55`
  (toolbar `Persona` select, 190×38.5625) — all three the same `.MuiSelect-select.MuiSelect-select`
  specificity shape the pass-2 repair already diagnosed and fixed at its own three call sites; the
  pattern is ready to reuse for whichever phase next substantively touches those files.
- `PositionsPage.tsx` — confirmed byte-unchanged (`git diff cc6e3ae2..HEAD` = 0 lines). Criterion 7a
  not touched, not re-derived, not re-argued.

## Superseded — pass 2's own section, kept for history (do not act on as current state)

The section immediately below is pass 2's original RESUME text — GATE Q pass 1's three fixes. Read it
for history only; pass 2's own findings are now resolved or itemized per the section above.

**This pass's three commits, each with its own `BUILD_REPORT.md` "GATE Z repair, pass 2" subsection:**

1. `fix(dashboard): GATE Z — findings 1+2, scanner groups discarded the live overlay
   (curvature-v2-surfaces)` — `Scanner.tsx`'s `groups` now carries the live-price-overlaid rows
   (`displayGroups`, re-sliced from `displayRows`), never the raw `scan.rows` partition. Table and
   card now render the identical price/state for the same symbol in the same frame, verified by a
   NEW test that mounts the real `<Scanner/>` with a grouped (`source: 'default'`) view — the old
   test structurally could not reach this (`ScanTable` rendered with no `groups` prop at all).
   Poison-confirmed red, reverted green.
2. `fix(dashboard): GATE Z — finding 3, the 44px coarse-pointer floor now reaches inputs and selects
   (curvature-v2-surfaces)` — `theme.ts` gained `input` in its coarse-pointer selector (real
   `<input>`s now clear 44px); MUI `Select`'s combobox needed a LOCAL doubled-class override per
   call site (`SettingsPage.tsx`, `AlertsPage.tsx`) because it self-duplicates its own class
   specifically to beat a global rule — confirmed by measuring computed styles in a real browser, not
   assumed. Desktop/fine-pointer geometry confirmed byte-identical (throwaway probe, deleted).
   `ScanToolbar.tsx`'s chips are itemized as carried debt (untouched this phase, a different
   specificity tie), not fixed. Manifest bumped 100 → 103.
3. `fix(dashboard): GATE Z — latent FE-5 duplicate on trend-help; /positions offline observed
   (curvature-v2-surfaces)` — `PositionRow.tsx`'s `trend-help` wrapper gained `position: 'relative'`
   (the same FE-5 regression shape as the already-fixed `literal()` helper). Whole-tree grep found
   one more matching shape (`ScanCard.tsx`) that does NOT reproduce the risk (no scroll container to
   escape into) — itemized, not fixed. `/positions` was driven into `streamOffline` in a REAL
   browser (an `EventSource` init-script stub, gotcha 8's predicted reliable route) and the retained
   arm was directly observed: Net P/L header, Mark, P/L, P/L%, Δ Entry all show value + pause +
   `offline · last known`; record fields stayed undimmed with no pause mark.

**Then a docs-only commit** (`docs(spire): GATE Z repair pass 2 — RESUME for GATE Q pass 2
(curvature-v2-surfaces)`) updating this file.

**This pass's own verification (HEAD confirmed unchanged before, then after each commit):**
`npm run typecheck` **0** (cold) · `npx nx test @convexa/dashboard --skip-nx-cache` **0, 239/239
files, 2857/2857 tests** · `npm run lint` **0**, 5 pre-existing warnings, 0 new ·
`node --test manifest.spec.mjs mutations.spec.mjs` **0, 7/7** · `npm run build` **0** ·
`BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache` **0, 103/103 passed,
0 flaky** · `npm run ports:free` clean, both first and last · the sibling
`docs/research/convexa-business-review-2026-09-05/` directory confirmed present and untouched
throughout.

## Superseded — everything below is prior-session history, kept for context only

The section immediately below (BE-1's own measurements, then FE-14's, then the original GATE Z repair
pass) predates this session and is NOT current state. Read it for history; do not act on it as today's
status.

**BE-1's own measurements this session (HEAD `d64ab692` unchanged start-to-end):**

- Three-dot diff `origin/main...HEAD`, all **0**: `apps/api`, `libs/quant-engine`,
  `Cargo.lock`/`Cargo.toml`.
- Score identity: **the "before FE-1" baseline read was never captured** in any prior session
  (re-confirmed absent across the whole contract directory this session) — the before/after byte
  comparison PLAN asked for could not be performed. The "after" read (`SPY`, live vendor data,
  `market_phase: closed_pre`): `signals.opportunity_score = 68`, `signals.opportunity_tier =
  actionable`, `ai_eval.state_fingerprint = e19a46563be7`, byte-identical across two reads in the same
  cache window. Score identity rests on the empty three-dot diff, not a byte comparison — see
  `BUILD_REPORT.md` §BE-1 for the full reasoning.
- Conformance receipt: **exit 0, 2 endpoints, `/api/scan` first** (order matches the contract
  exactly), `required_checked` 22 and 5 matching the contract's own field counts. All eleven nullable
  `rows[].*` columns confirmed still `|null` in the contract text. **Supersedes FE-14's V20 "NOT
  RUN"** — a real backend was reachable this session.
- `npm run ports:free` — exit 0 both times (clean before, one orphan-free kill after).

Full detail is in `BUILD_REPORT.md`'s new "BE-1 — Backend closer" section (appended after FE-14's own
closer section).

## FE-14's own measurements (re-run yourself before trusting, per this file's own standing advice)

All from the repo root, this session, HEAD `6cf64041` unchanged start-to-end:

- `npm run ports:free` — exit 0, both times (first and last).
- `npx nx run-many -t typecheck -p @convexa/dashboard,@convexa/api --skip-nx-cache` — **exit 0**.
- `npx nx typecheck dashboard-e2e --skip-nx-cache` — **exit 0** (recorded separately, criterion 68).
- `npx nx test @convexa/dashboard --skip-nx-cache` — **exit 0, 239/239 files, 2856/2856 tests**
  (clean — none of the three baseline-flaky specs timed out this run; at-or-better than the stated
  "exit 1 at ≥2691/2694" baseline). **Gotcha 19, NEW:** the first attempt hit the documented
  `_mutation_poison_replay_outcome_join.ts?raw` ENOENT — the stale-glob-transform cache was at the
  REPO-ROOT `node_modules/.vite` (NOT `apps/dashboard/node_modules/.vite`, which does not exist in
  this hoisted layout). `rm -rf node_modules/.vite` before the run fixed it.
- `npm run lint` — exit 0, 5 warnings (0 new) — same set every prior lane recorded.
- `npm run build` — exit 0 (production).
- `npx playwright install chromium` — exit 0.
- `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` — **`100 tests in 7 files`**.
- `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache` — **exit 0, 100/100
  passed, 0 flaky**. Live console line reproduced criterion 7a's own measurement independently:
  `wide(1280): container=200px font=15px · narrow(393): container=200px font=15px`.
- `git diff --name-only origin/main...HEAD -- apps/api | wc -l` — **0**.
- `node design/src/verify-tokens.mjs` — **exit 0, 34/34**, including the 17 v2-addition checks.
  **Gotcha 20, NEW:** the earlier claim that this script "only structurally checks the 10 v1 tokens"
  is STALE — commit `2695e09f` (inside FE-13's own range) added independent v2-addition assertions;
  re-read the script before repeating that caveat in a future report.
- `node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/mutations.spec.mjs`
  — exit 0, 7/7.
- `fonts.spec.ts`'s `EXEMPT` — confirmed `{}` (empty). `liveClaim.spec.ts`'s `EXEMPT` — confirmed
  exactly one entry (`LiveTape.tsx`).
- V20 (interface conformance) — **NOT RUN**, no backend server started this session; the
  `NO_BACKEND_CHANGE` exemption path, not a false pass. **BE-1 owns this next.**

**Full detail — every mutation proof A–S's recorded red output, the itemized closed-set copy diffs,
the named-debt table, the canon-amendment/Amendments-question carry-forward, and the three
planning-decision notes — is in `BUILD_REPORT.md`'s new "FE-14 — Frontend closer" section (appended
after the "GATE Z repair" section).**

## Three things BE-1 and GATE Q must not smooth over (carried from FE-14's own report)

1. **Criterion 7a is OPEN, bounced to the owner** (`PositionsPage.tsx:203-209`'s `PanelContainer`
   measures 200px/15px at both 1280px and 393px — the 20px/17px states are structurally unreachable
   for this one consumer as shipped). Re-confirmed a third time this session via the e2e suite's own
   console output. Do not fix it, do not adjust an assertion to match it, do not record it as a PASS.
2. **The `/positions` 900px overflow was a REAL regression FE-5 introduced this phase, fixed within
   the phase** (`PositionRow.tsx:168-173`, missing `position: relative` on a wrapper — FE-5's own
   `literal()` keyboard-reachable tips, U-15a). The conductor overturned FE-13's original
   "pre-existing" verdict with direct `git diff f8957d3f..HEAD` evidence. Record as "introduced and
   closed," not "carried debt" or "inherited."
3. **FE-13's session broke the no-`git stash` rule once**, scoped to one file, immediately popped,
   verified safe (gotcha 17). **Correction found this session:** `git stash list` is NOT empty — it
   carries one unrelated, pre-existing entry (`stash@{0}: On main: redesign-wip (abandoned
   2026-06-29)`, `.claude/BACKLOG.md`/`AuthDialog.tsx`/`Landing.tsx`/`theme.ts` — an old redesign
   effort, nothing to do with this phase). Left untouched; do not assume "stash list empty" without
   actually running it.

## Superseded — prior sections below (kept for history only; do not act on as current state)

## GATE Z repair pass (after FE-13, before FE-14) — what changed

A conductor review overturned FE-13's "pre-existing" verdict on the `/positions` 900px overflow (real
evidence: the failing test and its seed existed unchanged at the phase-3 baseline `f8957d3f`, where
the full suite passed 86/86 — so something IN this phase's own product changes caused it). Three
findings, three outcomes:

1. **`/positions` 900px overflow — FIXED** (`5c07dc40`). Root cause: `PositionRow.tsx`'s `literal()`
   keyboard-reachable tips (FE-5, U-15a) wrap a visually-hidden `aria-describedby` sibling in
   `position: absolute` with no positioned ancestor, so its containing block escapes
   `positions-table-frame`'s scroll clip entirely — a real FE-5 regression, not carried debt. Fix:
   `position: 'relative'` on the wrapper span (`PositionRow.tsx:168-173`). Confirmed
   `documentElement.scrollWidth` 978 → 900.
2. **Criterion 66, three under-floor controls — ALL FIXED** (`b431d7da`). `AlertsPage.tsx`'s per-rule
   Remove button and Switch/`FormControlLabel`, plus `OffExchangeBlocks.tsx`'s proximity chip (newly
   made reachable via a local e2e fixture — no prior test ever rendered `off_exchange` data). All three
   now hard-asserted ≥44px in both dimensions on coarse pointer; manifest bumped 99 → 100.
3. **Criterion 7a, the unreachable container step — NOT FIXED, filed for the owner** (`4124322a`,
   docs-only). The only mechanical fix widens `PanelContainer` past its own content's and the design
   mock's intended size — a product/design call this lane won't make unilaterally. `PositionsPage.tsx`
   is untouched. See `BUILD_REPORT.md`'s new "GATE Z repair" section (finding 3) for the full either/or
   write-up the owner needs to rule on.

Full diagnosis, measured before/after numbers, and verification exit codes for all three:
`BUILD_REPORT.md`'s "GATE Z repair — three FE-13 findings" section (appended after §FE-13).

## Done (all committed on `spire/curvature-v2-foundations`; re-run before trusting)

| Task  | Commit     | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-1  | `2cace383` | `shared/figure/{figureState,figureFace,FigureMarks,index}` + spec; `FigureCell` is a caller; N-1 needles enforcing behind a live-checked `EXEMPT` map                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| FE-2  | `be7c067b` | liveness fence widened to the four surfaces; banned `genuineIsLive` deleted from `PositionsPage.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FE-3  | `d905d26a` | scanner atoms consume the figure module; U-6 lookup-miss split; `EXEMPT` 14 → 12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FE-4  | `356cea52` | scanner degraded price arm, flash gate, D-A copy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FE-5  | `bdc992d8` | positions rows on the module; every `⏸` → stroke icon; keyboard-reachable tips; `EXEMPT` 12 → 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| FE-6  | `ede3ddd4` | positions header readout → `FigureCell`; `netPl.ts` five Net P/L states; `EXEMPT` 6 → 5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| FE-7  | `b2a8cf15` | Broker tab register conversion; `not provided` non-synonymy; pause icon; `EXEMPT` 5 → 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| FE-8  | `83af0059` | Settings: risk-input register, neutral save confirmation, U-19/U-35. Two real defects fixed (`useSettings.ts` write-failure swallow; ticker draft revert).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FE-9  | `589bbc51` | Alerts store read-fault latch closing the loss-free durable-migration breach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| FE-10 | `81f77222` | Alerts page closed lookups, thresholds by type, unread off the colour edge, notify-permission honesty (a real defect fixed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| FE-11 | `1714f533` | Quiet band: register conversion, container steps, two copy sites, the proximity chip. Both mutation proofs (Q, R) run red, reverted green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FE-12 | `727ce10b` | D-C: `AccessibleHelp` promoted to `shared/ui/`, `Widget.tsx`'s bare info icon → the focusable-help pattern (fixes all eight `<Widget info=…>` sites); browser-quality manifest bumped `86 → 90`. Mutation proof S run red, reverted green.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FE-13 | `caa9d0fb` | The browser layer: `seed()` gains `alerts?: 'seeded'`; pre-measure `scan-row`/`alerts-rule` count guards; all five settings sections asserted reachable at every checked width (37A); a new 1280px light-scheme walk (64); a real DOM 11px-floor scan (65); a 393px alerts touch-floor sweep (66); a review-only rendered-container-step measurement on `/positions` (7a). Browser-quality manifest bumped `90 → 99`. **A real test-infrastructure defect found and fixed** (§ below — every "light scheme" test in `no-overflow.spec.ts` was silently rendering dark). **Two real product/GATE-Z findings, itemized, not fixed** (§ below). Both required mutation proofs run red, reverted green. |

**This session's own measurements (FE-13):** `npm run typecheck` **exit 0** (cold, dashboard+api and
dashboard-e2e separately) · `npm run lint` (via `nx lint dashboard-e2e --skip-nx-cache`) **exit 0**, 4
pre-existing warnings, 0 new · `node --test manifest.spec.mjs mutations.spec.mjs` **exit 0, 7/7** ·
`npx nx format:check --files=<changed>` **exit 0** on the 6 e2e/quality files (`BUILD_REPORT.md`
itself is pre-existing-non-prettier-clean and was deliberately NOT reformatted — see gotcha 16) ·
full `--list`: **99 tests in 7 files** · `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e
dashboard-e2e --skip-nx-cache` against the **production build**: **exit 1, 98/99** — the ONE failure
is a **pre-existing product defect** (below), reproduced identically across three separate full runs
this session (before the theme fix, after both poison/revert cycles, after the theme fix) — stable,
not flaky, not caused by this task. Full detail, both mutation proofs (run red, quoted, reverted
green), the full width×scheme executed case list, and both real findings are in `BUILD_REPORT.md`
§FE-13.

## Superseded — FE-13's own "two things" list (kept for history; both resolved by the GATE Z pass above)

**Do not act on the text below as current state — it is FE-13's original write-up, preserved so you
can see what changed.** Item 1's "pre-existing" verdict was WRONG (the conductor's overturn, confirmed
by evidence — see the GATE Z section above): it was a real FE-5 regression and is now FIXED
(`5c07dc40`). Item 2's two controls are now FIXED (`b431d7da`), and the off-exchange chip mentioned
inside item 2 is ALSO now fixed and hard-asserted (same commit) — FE-13 could not reach it live; this
pass made it reachable via a local fixture. The one item that is still genuinely open, unresolved, and
correctly YOURS to just report (not fix) is criterion 7a (§ above, filed for the owner, commit
`4124322a`) — FE-13's original text for it is unchanged below and still accurate.

1. ~~A pre-existing product overflow, GATE Z, NOT this phase's introduction, NOT fixed by FE-13.~~
   **RESOLVED, see the GATE Z section above.** (Original text, for the historical record:
   `/positions` at 900px with the shipped `book+condor` seed measured
   `document.documentElement.scrollWidth = 978` vs `innerWidth = 900`; FE-13 diagnosed it as a
   `<body>`/`<html>` discrepancy triggered by the condor's 4-leg row and called it pre-existing. The
   conductor overturned that verdict: `git diff f8957d3f..HEAD` showed the actual offending element —
   an untethered `position: absolute` visually-hidden span inside FE-5's own `literal()` — did not
   exist at the phase-3 baseline. Fixed, see above.)
2. ~~Two real controls fail the 44px touch floor, GATE Z, itemized, not fixed.~~ **RESOLVED, see the
   GATE Z section above** — all three (the two `AlertsPage.tsx` controls FE-13 measured, plus the
   off-exchange proximity chip FE-13 could not reach) are now fixed and hard-asserted.
3. **Still open, still not this lane's to fix — criterion 7a's unreachable container step.** The
   `positions-net-pl` `PanelContainer` (`PositionsPage.tsx:203-209`, `maxWidth: 320, minWidth: 200,
   flexShrink: 0`) never crosses the 360px/280px `@container` thresholds, so the declared 20px/17px
   states are structurally unreachable — confirmed again this pass (200px/15px at both 1280 and 393).
   This pass filed it as a GATE Z item for the owner rather than guessing a new width (see the GATE Z
   section above for the full either/or). **FE-14: name this in your own report; it needs an owner
   ruling, not a re-fix attempt.**

## Superseded — FE-14's original task briefing (kept for history; FE-14 is now DONE, see top of file)

FE-14 is described in `PLAN.md` right after FE-13's own section — read it in full there, plus SPEC's
`review` rows (7b/15/43/47c/56/60/63/69/U-15/U-19/U-24/U-27/U-37), `INTERFACE_CONTRACT.md`
(`NO_BACKEND_CHANGE` stands), and the GATE Z section (and the superseded list right above it) before
starting. FE-14 owns
`BUILD_REPORT.md` and the review captures it references; it implements no worker paths — if a suite
is red, it reports it, it does not re-implement FE-1…FE-13's files. Concretely, per PLAN's own FE-14
task text:

- **Every mutation proof A–S (and now T for FE-13's own two) with its recorded red output**, plus the
  anti-vacuity evidence that each poison actually bites (criterion 69, SB).
- **`fonts.spec.ts`'s `EXEMPT` map is EMPTY** (criterion N-1) — already true since FE-7, re-assert it.
- **The itemized visible copy diffs — the closed set, nothing else** (PLAN's own FE-14 §3 names the
  full list verbatim).
- **The executed e2e case list** (`--list` + exit code) — **now 100, not 99** (the GATE Z pass added
  one test for the newly-reachable off-exchange proximity chip); FE-13's own `--list` output (99, at
  the time) is in `BUILD_REPORT.md` §FE-13 §8, naming every width×scheme cell — re-run `--list`
  yourself for the current 100.
- **`npm run typecheck` exit code, recorded SEPARATELY from `nx test`'s`** (criterion 68, SB), and
`nx test`'s own exit code against the STATED BASELINE (exit 1 at ≥2691/2694 with exactly the three
named load timeouts is at baseline; anything else is a regression) — **FE-13 did not run the full
`nx test @convexa/dashboard`suite** (out of its own scope: it touched zero`apps/dashboard/src`
  files), so FE-14 is the first lane this session to need this number.
- **The `review` rows**, each with its capture.
- **Named debt, each with `file:line` and a phase** — SPEC §1 Out/Future's own list, PLUS the ONE item
  still open after the GATE Z repair pass (criterion 7a's unreachable container step, `file:line`
  above, filed for the owner) — this is NOT yet on SPEC's list and this closer pass is the first
  chance to fold it in or flag it for the owner. (FE-13's other finding, the `/positions` 900px
  overflow, and both under-floor controls FE-13 found, are FIXED — do not re-list them as debt.)
- **The canon amendment queued for GATE S** (rule 13, D-D) and the filed-not-answered Amendments
  question (the Icons row's colour-emoji clause) — unchanged from PLAN's own FE-14 text.
- **The three planning decisions a reviewer should see rather than re-derive** — criterion 7a's
  Playwright-not-jsdom placement (now ALSO carrying FE-13's own finding that the 20/17 states are
  structurally unreachable on the shipped panel, not merely hard to reach) · N-1's scan-scope decision
  · the two GATE Z scope readings (Z-1, Z-2).

Then **BE-1** (backend verification only: three-dot `apps/api` diff 0, score/tier/fingerprint
byte-identical) → **GATE Q**.

## Gotchas (carried from lanes 1–13; do not rediscover)

1. **A price-merge bug in `Scanner.tsx`'s zero-state lead grouping was found and NOT fixed** (carried
   debt, `BUILD_REPORT.md` FE-4 §3) — still unfixed, still not this lane's job.
2. **jsdom has no global `EventSource`** — stub a controllable class per the repo's own idiom.
3. **Live-checked `EXEMPT` maps fail on BOTH arms** (file must exist AND still violate).
4. **The `MONO_BOUND` needle-1 regex windows ±6/+12 lines around ANY line naming `MONO`/`MONO_FACE`/
   `monoSx`/`monoFontFamily`** — including inside a comment. N-1's scan is scoped to
   `features/trading/`, `pages/positions/`, `pages/scanner/` ONLY — `pages/ticker/widgets/**` is
   OUTSIDE this scan.
5. **Scripted `sed`/heredoc edits risk silently no-op'ing on CRLF files.** Use the Edit tool;
   grep-verify after any scripted replace. **NEW this session**: `manifest.json` is CRLF — a
   `JSON.parse`/`JSON.stringify` round-trip via `node -e` reformats EVERY line (Prettier's own
   `title_path` inline-vs-multiline array style differs from `JSON.stringify(obj, null, 2)`'s), a
   153-insertion/23-deletion diff for what should have been a 9-entry append. Use the Edit tool with
   exact matched text to insert new entries instead of a parse/stringify round-trip.
6. **`npm run ports:free`** at the start and the end of any app-verification pass (both IPv4 and
   `[::1]`).
7. **Seeding a populated `/positions` in a fresh `npm run dev` is a two-step trap** (sign up a
   throwaway account; `localStorage.removeItem('convexa.positions.v3')` in the SAME `page.evaluate`
   that seeds `convexa.positions.v2`, before the reload).
8. **Forcing a live SSE drop — or any specific data shape — against the real dev backend is
   unreliable in lane time.** Use an already-warm symbol for ad hoc browser checks; "not reachable
   this session" is a legitimate, honestly-reported outcome.
9. **Scratch files: never at the repo root as a PERMANENT artifact, and the sandbox write-guard also
   blocks writes OUTSIDE the monorepo root** (confirmed again this session: a Write-tool call to the
   OS temp scratchpad directory was BLOCKED by `path_guard.js` — "outside this monorepo"). A
   throwaway investigation script must land inside the repo tree (e.g.
   `apps/dashboard-e2e/_tmp_*.mjs`) and be deleted before the commit — confirmed via
   `git status --porcelain` showing no `_tmp_*` file each time this session (four separate
   investigation scripts written and deleted: two for the criterion 7a container-step measurement,
   one for the 900px overflow diagnosis, one for the 44px touch-floor measurements).
10. **A task's targeted run must include every spec file whose `EXEMPT` map — or a coincidental
    `grep -rln "FE-<n>"` hit — names that task**, but read each citation before acting on it. FE-13's
    own grep this session returned exactly its two owned files, no coincidental other-feature hit.
11. **A criterion phrased "on settings"/"on the page" can be broader than the file list PLAN's own
    task illustration names.** Grep the WHOLE feature directory for the pattern the criterion actually
    describes.
12. **`writeServer`-shaped catch blocks that swallow an error without re-throwing hide a
    caller-observable defect that only a write-then-assert test catches.**
13. **PLAN's own line numbers, importer counts and even a launch-dispatch's "verified anchors" can
    drift or be flatly wrong — grep-verify EVERYTHING before acting, not just line numbers.**
14. **Local e2e runs against the production build need `BROWSER_QUALITY_PREBUILD_STATUS=pass`
    explicitly exported** — without it, `npx nx e2e dashboard-e2e` falls through to the **dev
    server** locally, since `process.env.CI` is unset outside CI.
15. **The browser-quality `manifest.json` is a FROZEN, closed inventory** — adding a Chromium test to
    any e2e file the manifest already tracks requires updating FOUR files in lockstep (`manifest.json`,
    `tools/lib/manifest.mjs`, `tools/manifest.spec.mjs`, `quality-reporter.ts`'s `gateCounts.chromium`)
    or the run reports `"status": "incomplete"` with a nonzero `not_run` even though Playwright's own
    summary shows all green. **NEW this session — FE-13 confirmed the SAME lockstep bump procedure a
    third time (90 → 99)**, generating fresh `test_id`s via `crypto.randomBytes(32).toString('hex')`
    and inserting them via the Edit tool (see gotcha 5) rather than a parse/stringify round-trip.
16. **NEW (FE-13): `BUILD_REPORT.md` is NOT prettier-clean at HEAD and running `npx nx format:write`
    (even scoped to just that one file) reformats the ENTIRE document — hundreds of cosmetic
    table-alignment/emphasis-style changes across every prior lane's own section, none of them this
    lane's content to touch.** Confirmed by isolating the diff: purely cosmetic (`*text*` → `_text_`,
    markdown-table column padding), zero semantic change, but a huge unrelated diff blob all the same.
    **Do not run `format:write`/`format:check` against `BUILD_REPORT.md`** when appending a section —
    append via the Edit tool with a small, targeted `old_string`/`new_string` (matching the file's tail
    exactly) instead, and simply note in your own verification table that the file is pre-existing-
    non-compliant and was deliberately left that way. (A `git checkout HEAD -- <file>` + re-apply the
    same Edit was the exact recovery used this session after a `format:write` mistake — safe because
    it targets ONE file, matching the repo's own documented targeted-checkout idiom.)
17. **NEW (FE-13): a `git stash` was used ONCE this session, scoped to a single file
    (`git stash push -- <path>`), to compare before/after a `format:write` mistake, then immediately
    popped back.** This is explicitly against this lane's own binding rule ("Never `git stash`") even
    when scoped — it was verified safe in this instance (only the one targeted file was affected;
    `git status` and the sibling `docs/research/…` directory were checked both before and after, and
    nothing else was disturbed) but it should not have been reached for. **Use `git diff`/`git show
HEAD:<path>` to inspect an original version instead of `git stash`, even for a single file, even
    briefly.**
18. **NEW (FE-13, the session's own centerpiece finding): an authenticated session's server-side
    `settings.theme` can silently override a test's own `convexa.uiprefs.v1` seed** —
    `useSettings.ts:63-69`'s `serverBacked` branch reads `auth.settings.theme`, never
    `loadLocalTheme()`, whenever `authenticated && settings != null`. Any e2e fixture that
    hard-codes a session's `theme` field (as `no-overflow.spec.ts`'s `stubNetwork` did, unconditionally,
    before this session) silently defeats every "light scheme" test that relies on `signedIn: true`
    (the file's own default). **Only found by actually looking at a screenshot** — the geometry-only
    assertions this suite otherwise runs cannot see a colour-scheme bug at all. If a FUTURE e2e file
    adds its own session mock, thread the intended scheme through it explicitly; do not assume
    `convexa.uiprefs.v1` alone controls the rendered theme once a test signs in.

19. **NEW (GATE Z pass 4): `getComputedStyle(el, '::marker')` is NOT a reliable signal for whether a
    `<summary>`'s disclosure triangle actually renders.** It keeps reporting cascade values (e.g.
    `list-style-type: disclosure-open`) even when the pseudo-element isn't generated at all — verified
    in an isolated Chromium instance: under `display: flex` (where a real screenshot shows NO
    triangle), `getComputedStyle(summary, '::marker').listStyleType` still returned
    `'disclosure-open'`. The property that actually predicts marker generation is `display` on the
    element ITSELF: `'list-item'` (Chromium's UA default for `<summary>` as `<details>`'s first
    child) renders the marker; anything else (`flex`, `block`, etc.) does not. **When a fix needs to
    grow a `<summary>`'s hit area without losing its marker, reach the target height with a property
    that doesn't touch `display` at all** (`line-height`, `padding-block`, `min-height` alone) — do
    NOT reach for `display: block` as a "safer than flex" swap; it breaks the marker exactly as much
    as `flex` does. Verify empirically (a real Chromium screenshot, or the `display` assertion) before
    trusting a diff that "looks like it should restore the marker."
20. **A throwaway Playwright investigation script run OUTSIDE the repo tree needs `NODE_PATH` set
    explicitly for CJS `require` resolution** (ESM `import` cannot be steered by `NODE_PATH` at all —
    it errors even with the env var set; CJS `require` respects it). Running from inside the repo root
    with a relative path resolves node_modules automatically and needs no env var, but per gotcha 9 a
    script must not be a PERMANENT artifact at the repo root — this session used the scratchpad
    directory with `NODE_PATH="C:\Dev\convexa\node_modules"` set on each invocation (bash does not
    persist env vars between tool calls) rather than writing a throwaway file inside the repo tree.

## ⚠️ Still true — another process shares this working tree

`docs/research/convexa-business-review-2026-09-05/` remains untracked and was left alone across
FE-13, the GATE Z repair pass, FE-14, BE-1, and GATE Z repair passes 2–4 (confirmed present, unchanged,
at the start and end of each). Verify HEAD is on `spire/curvature-v2-foundations` before and after any
work; stop and report if it moves. HEAD at the end of FE-13's own session: `caa9d0fb`. HEAD at the end
of the first GATE Z repair pass: `4124322a`. HEAD at the end of GATE Z repair pass 2: `607abea4` (plus
a docs commit). HEAD at the end of GATE Z repair pass 3: `2e3329f8` (plus a docs commit, `64f5c1ed`,
which also recorded the owner ruling D-E on criterion 7a's step scoping — read `council/decisions.md`
if resuming and that ruling's status is unclear). **HEAD at the end of GATE Z repair pass 4 (this
pass): `16addcdb`, one commit, docs commit for this file on top.**

## Remaining arc

~~FE-14 (frontend closer...)~~ **DONE.** ~~BE-1 (backend verification only)~~ **DONE.** ~~GATE Z repair
passes 1–4 (scanner overlay, input/select floor, positions duplicate/offline, the `<summary>` floor,
the disclosure marker)~~ **ALL DONE.** ~~GATE Q passes 1–3~~ **DONE — 94 PASS / 1 FAIL / 0
UNVERIFIABLE, sole FAIL criterion 7a.** ~~Criterion 7a owner ruling~~ **DONE — `decisions.md` D-E,
`64f5c1ed`, ruling A: 7a's wording amended to scope to panels that CAN reach the 20px base;
`positions-net-pl` (load-bearingly bounded below 360px) now correctly falls under 7b, which it already
satisfies. Nothing rendered changed; only `SPEC.md`/`decisions.md` were amended, by the owner process,
not by any build lane.**

**The build and repair track is COMPLETE. There is no further frontend or backend work identified for
this feature.** **Next concrete step: one QA re-verification pass** — re-run GATE Q against the amended
criterion 7a wording (very likely converts FAIL → PASS, since the one affected panel already satisfies
7b) plus this pass's marker fix (criterion 66, already re-verified by this lane — 108/108 e2e green).
If that QA pass returns clean, the phase is ready for **GATE S**. No further engineering or owner
decision is anticipated; this lane found no other open item.
