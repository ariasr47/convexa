# BUILD_REPORT — curvature-v2-desk-and-read (frontend)

Written by the Frontend Executioner / closer lane (FE-14). Covers FE-1…FE-13, all landed and committed
on `spire/curvature-v2-foundations` before this session started (working tree was clean at FE-14's
start — verified by `git status --short`, not assumed). Evidence over assertion: every count below was
run fresh this session with `--skip-nx-cache` where the CLAUDE.md stale-cache trap applies, exit codes
checked directly, never a printed summary.

## 1. Verification track (PLAN.md's table, run in full this session)

| # | Command | Result |
|---|---|---|
| V (typecheck) | `rm -rf apps/dashboard/dist apps/dashboard/out-tsc *.tsbuildinfo` then `npx nx run-many -t typecheck -p @convexa/dashboard,@convexa/api --skip-nx-cache` | exit **0**, fresh (not cache-served) |
| V8 | `npx nx test @convexa/dashboard --skip-nx-cache` | First run: exit **1**, **1 failed / 230 passed (231 files)**, **1 failed / 2692 passed (2693 tests)** — the single failure was `app.risk.spec.tsx > "/_ops/metrics" renders WITHOUT the trader shell/nav`, a 15s timeout in a file this phase never touches. Nx's own flaky-task detector fired on the same run (the identical environmental class FE-6/FE-7/FE-9 already recorded in `RESUME.md`). **Re-ran the identical command**: exit **0**, **231 files / 2693 tests, 0 failures**. Trusting the clean re-run, per that established precedent, not the one-off. |
| V10 | `npm run lint` (then `npx nx run-many -t lint --skip-nx-cache` to confirm not cache-served) | exit **0** both times — **5 warnings total** (1 pre-existing `react-hooks/exhaustive-deps` in `useSessionArchive.ts`, 4 pre-existing `no-explicit-any` in `dashboard-e2e/playwright*.config.ts`), 0 errors, 0 new |
| V15 | `node design/src/verify-tokens.mjs` | exit **0**, **34/34** (20 shared + 14 v2 additions) |
| V16 | `git diff origin/main...HEAD -- apps/api \| wc -l` (three-dot, per this file's own top correction) | **0**. Also `git diff --name-only origin/main...HEAD -- apps/api` → **0 files**, and `git status --porcelain -- apps/api` → **0** (working tree, not just history). **Local `main` is 56 commits behind `origin/main`** in this checkout — comparing against local `main` measures the wrong baseline, which is why the two-dot / merge-base-with-local-main forms both report nonzero (107 files, all pre-dating this branch, per FE-1/FE-4/FE-8/FE-13's own repeated re-confirmation) and must not be read as this phase's diff. |
| V12 | `npm run build` | exit **0** — production, both `cargo build --release --features postgres` and the Vite dashboard bundle (pre-existing Rust `dead_code` warnings only, unrelated to this branch) |
| V13 | `npm run ports:free && npx playwright install chromium && npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` | exit **0** — **86 tests in 7 files** (`grep -c 'desk-and-read\|curvature-v2\|no-overflow'` on the list = 73 lines across those three specs); `desk-and-read.spec.ts` lists all **6** of its own cases |
| V14 | `npx nx e2e dashboard-e2e --skip-nx-cache` (production build via `http-server apps/dashboard/dist`, ports freed IPv4+IPv6 before/after, run **twice**) | Run 1: exit **0**, **86/86 passed, 0 flaky** (36.1s). Run 2 (fresh ports-free, `--skip-nx-cache` again): exit **0**, **86/86 passed, 0 flaky** (23.3s). Both against the built `dist/`, confirmed by the config's own `prebuildStatus === 'pass'` branch (`playwright.shared.config.ts:26-27`), which is a stronger production guarantee than `serve-static` — it serves the literal `npm run build` output with no rebuild step in between. |
| V17 | `curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/ticker/SPY` | `000` — unreachable. **NOT RUN** (`node .claude/tools/interface_conformance.mjs`) — no reachable backend, **NO_BACKEND_CHANGE exemption**, recorded honestly per this phase's own established precedent (every FE-4…FE-12 browser check hit the same "502s / connection refused from the API not being served" condition) |

No suite was declared green from a printed summary; every number above came from a direct `echo $?`/count
read on a fresh, uncached run this session.

## 2. `opportunity_score` / `opportunity_tier` / `state_fingerprint` (criterion 55, SB)

**Not captured as a live before/after wire diff** — no backend is reachable in this environment (V17
above), consistent with every prior FE session's own recorded browser-check condition. The claim these
three values are byte-identical rests instead on the **structural** guarantee criterion 55 itself names
as the cause: `apps/api`'s source is unchanged (§1 above, 0 lines / 0 files, three-dot, working tree
clean) and these three fields are Rust-computed and serialized before the frontend ever sees them — an
unchanged binary given the same request necessarily returns the same bytes for a deterministic
computation and a deterministic hash. No frontend file in this phase re-derives, rounds, or re-serializes
any of the three; `ReadStrip`'s `opportunity` cell and `readStripModel.ts` (`opportunityStripFigure`
equivalent) read `m.opportunity_score`/`m.opportunity_tier` and render them verbatim (confirmed by
reading `readStripModel.ts`, not assumed), and `state_fingerprint` has no UI consumer this phase touches
at all. This is the same class of honest substitution V17 already uses (NO_BACKEND_CHANGE), applied to
one more criterion rather than fabricating a capture that would require a database and market data this
sandbox does not have.

## 3. Zero-orphan ledger (FE-8, criterion "every DealerPositioning cell has a destination")

Verified against `git show HEAD` on the now-deleted `DealerPositioning.tsx` (not trusted from a citation):

| # | shipped cell (old `file:line`) | destination |
|---|---|---|
| 1 | Call wall `:112` | `level-ladder/LevelLadder.tsx` (FE-5, mounted inside `StructureHeroPanel`) |
| 2 | Put wall `:120` | `level-ladder/LevelLadder.tsx` |
| 3 | Vol-norm GEX `:128` | `level-ladder/LadderFoot.tsx` (FE-5, mounted by FE-8 after being found unmounted — see §11) |
| 4 | Raw GEX (1% shock) `:143` | `level-ladder/LadderFoot.tsx` |
| 5 | Net DEX `:150` | `read-strip/ReadStrip.tsx` (FE-7) |
| 6 | Max pain `:160` | `level-ladder/LevelLadder.tsx` |
| 7 | IV/HV `:168` | `read-strip/ReadStrip.tsx` |
| 8 | Vol/OI `:175` | `read-strip/ReadStrip.tsx` |
| 9 | IV skew `:184` | `read-strip/ReadStrip.tsx` |
| 10 | Term structure `:195` | `read-strip/ReadStrip.tsx` |
| 11 | Off-exchange % `:213` | `read-strip/ReadStrip.tsx` |
| 12 | Opportunity `:226` | `read-strip/ReadStrip.tsx` |
| — | Field/Magnet toggle + `WallMagnetView` | `structure-hero/StructureHeroPanel.tsx` (FE-6; the old widget's own copy was a dead duplicate, deleted) |

Twelve cells, zero orphans. `rg 'DealerPositioning' apps --glob '!sourcemaps-private/**'` returns **zero**
matches (source only; `dist`/`out-tsc` are gitignored build output, not source). Historical comments
name it as "the old dealer positioning widget" (lowercase) to avoid tripping the same-shaped
case-sensitive scan `liveClaim.spec.ts`'s EXEMPT-list fix already established a convention for.

## 4. Mutation proofs, with anti-vacuity evidence (criterion 57, SB)

Every proof below was **actually run** (poison → confirm red, with the real failure text captured →
revert → confirm green again) during FE-1 through FE-13; none is a narrated `expect(true).toBe(true)`.
Full failure text for each lives in `RESUME.md`'s per-task sections; this table is the index PLAN's own
Step 8 asks for, not a re-derivation:

| Proof | Poison | Red result (captured) | Anti-vacuity |
|---|---|---|---|
| Invariant 1 (`LiveClaim`) | widen brand back to `boolean` | `npm run typecheck` → **TS2578** on the `@ts-expect-error` directives; `nx test` stayed green | proves the compile-time gate is load-bearing, not merely present |
| Criterion 14 (gamma-flip retention) | restore `?? m.gamma_flip` | retention test red, naming the bundle number | — |
| Criterion 13 (`retained` boolean) | key `retained` on the rendered value again | empty-latch caption test red on `offline · last known` | — |
| Criterion 20 (three live gates) | delete `&& m.live` from sweep / particle / drift (3 separate poisons) | `paintStep.spec.ts`'s `live: false` case red on `gradientFills` / `arcs` / drift respectively | the SAME suite's `live: true` case stayed green each time — proves the gate is binary, not a broken always-off |
| Criterion 26 (off-exchange) | render `'unavailable'` in the empty slot | 4 tests red, each naming the received `'unavailable'` where `'not provided'` was expected | — |
| Criterion 8 (live-dot census) | pass a live claim to a read-strip cell | model-level test AND `ReadStrip.spec.tsx`'s DOM census both red, naming 1 dot found where 0 expected | two independent layers agreed, not one accidental assertion |
| Criterion 58 (A1c mapping) | collapse `(no_edge, fresh_trade)` to `{body:'A1a', annexes:[]}` | BOTH the pure unit test AND the full-app `readLayout.render.spec.tsx` row-58 test red (3 failures) | proves `AiRecPanel.tsx` genuinely **consults** `readLayoutFor` rather than gating on a parallel duplicate condition — the first draft (gated on the same condition the mapping also encodes) passed this poison vacuously; fixed and re-poisoned until the real host broke too |
| Criterion 59 (A1c stance line) | restore the Mono `no_trade` line inside the annex | row 58/59 test red on `queryByTestId('ai-rec-quiet-gate-stance')` no longer null | — |
| Criterion 33 (A1b/A1c ambiguity) | identify A1b by the shared gate-note string alone | a dedicated test renders both arms and shows the naive identifier cannot distinguish them, then shows the real discriminator (stance-line presence) can | this test is **shipped permanently**, not a one-off session poison — it documents why every other assertion in the file uses conjunction |
| Invariant 5 (`readLayoutFor` exhaustiveness) | delete the `incomplete_trade` case, **keep** the `default` arm | `npm run typecheck` red, naming the exact member (`TS2345`) | **load-bearing finding**: deleting the catch-all alone does NOT go red (the switch was already exhaustive over the 6 real members) — the real proof removes a covered case while keeping `default`, not the reverse; recorded so a later lane doesn't waste a cycle on the false start |
| Invariant 4 (ladder exhaustiveness) | add a sixth `LadderRowId` | `npm run typecheck` red at the exhaustive switch's `never` arm | — |
| Criterion 7 (palette identity) | give the ladder a freshly-resolved palette object instead of the shared one | identity test (`toBe`, not `toEqual`) red, naming the mismatch | — |
| §7 inv. 8 (token parity) | change `steel2`'s light value in `tokens.json` by one hex digit | `node design/src/verify-tokens.mjs` exits **1**, naming `steel2` specifically (not a generic failure) | re-verified this session (§1, V15): reverted state is 34/34 clean |
| Criterion 53 (hex discipline) | (implicit in the exempt-list mechanics) — any hardcoded hex in a surface this phase creates trips `hex-discipline.spec.ts`; confirmed by the EXEMPT list's own live-checked shrink (FE-6 removed `TapePulseStrip.tsx`/`GexStrikeProfile.tsx`, FE-11 removed the file whole) | `hex-discipline.spec.ts` red if an entry stops matching real source | list is enforced, not just written |
| T1 (e2e registration) | remove `desk-and-read.spec.ts` from `testMatch` | `--list \| grep -c desk-and-read` → **0** | proves the suite would otherwise "pass" by never running the new spec at all |
| Criterion 52 (light-mode ink) | flip `expect(lightInk).not.toBe(darkInk)` to `.toBe(darkInk)` | both the 393px and 1280px cases red, naming the real measured pixels (`"11,15,23"` vs `"246,246,243"`) | proves the check reads real canvas pixel data, not a vacuous truth |
| Owner ruling 4 (spacing burn-down) | revert `TapePulseStrip.tsx`'s `px: 1.5` to `1.25` with its EXEMPT entry still removed | `spacing-ladder.spec.ts` red, naming the exact file/value | confirms the live-checked exemption list, not merely the count |
| GATE Z A10 retention | revert the functional-update guard to unconditional `setRec({...unavailable})` | retention test red naming the mismatch (`"produced"` expected, `"unavailable"` received); the **contrast** test (first failure, nothing pinned) stayed green | proves the fix does not swallow the base case it must still satisfy |
| Criterion 45 (SB, one verdict node) | render the sheet's `children` alongside the peek row simultaneously | 4 of 6 (then 6/7) tests red on Testing Library's "multiple elements found," naming both nodes | — |
| GATE Z item 1 (16b, replay ≠ offline) | poison `midOffline` to `!claim ? {...} : null` (the literal `!isLive`-shaped contradiction) | the 16b replay test red, naming `offline-retained` where `replay` was expected | proves the mechanism is genuinely branch-on-standing, not a disguised `!isLive` |

## 5. Executed e2e case list (criterion 51)

`npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` → exit 0, **86 tests in 7 files**.
The five `/ticker` overflow row×scheme combinations (naming 393 dark, 393 light, 834, 900, 1280 — five
rows, not eight):

```
no-overflow.spec.ts › 393px no-overflow · dark scheme › /ticker/TSLA fits the viewport
no-overflow.spec.ts › 393px no-overflow · light scheme › /ticker/TSLA fits the viewport
no-overflow.spec.ts › tablet 834 no-overflow · dark scheme › /ticker/TSLA fits 834px
no-overflow.spec.ts › md 900 no-overflow · dark scheme › /ticker/TSLA fits 900px
no-overflow.spec.ts › lg 1280 no-overflow · dark scheme › /ticker/TSLA fits 1280px
```

`desk-and-read.spec.ts`'s own six cases (all listed, all executed): two for criterion 45 (SB, 393px
alone, and a resize-persistence case 393→1280), two for the criteria 20/22 evidence pair (stream-drop
attach + reduced-motion attach), two for criterion 52 (light/dark ink at 393 and 1280). Both e2e runs
this session (§1, V14) executed all 86, 0 skipped, 0 flaky.

## 6. `npm run typecheck` exit code, recorded separately (criterion 56, SB)

**0**, fresh (`--skip-nx-cache`, dist/out-tsc/tsbuildinfo deleted first per the CLAUDE.md phantom-error
trap), recorded here distinctly from `nx test`'s own exit code because Vitest transpiles without
typechecking — it is the only thing in this build that sees the `LiveClaim` brand's `@ts-expect-error`/
TS2578 proof and `readLayoutFor`'s two `never`-arm exhaustiveness guards.

## 7. Review rows, each with its capture

| Row | What it claims | Capture |
|---|---|---|
| 4 | The anchor is named once in the ladder header | `LevelLadder.tsx`'s header renders `` `distance from levels @ ${anchorText}` `` once, above the five rows (FE-5's browser check, `RESUME.md` "Done (FE-5)"); confirmed still true in this session's own screenshot of the composed `/ticker/TSLA` page (§10 below), header reads "distance from levels @ $250" |
| 6 | The two GEX tooltips are byte-for-byte from the deleted widget | `LadderFoot.spec.tsx` asserts the exact tooltip strings via the native `title` attribute, compared byte-for-byte against `DealerPositioning.tsx:122-143` before its deletion (FE-5) |
| 11 | The basis line | `StructureHeroPanel.tsx`'s inline `"levels are REST structure (as-of Xs) · the mid is tape"` — confirmed rendering verbatim in this session's own screenshot (§10), "levels are REST structure (as-of 10s) · the mid is tape" |
| 21 | The field container stays un-dimmed on a drop, browser, both stream states | `desk-and-read.spec.ts`'s criteria-20/22 evidence group: `structure-field-canvas` stays attached at unchanged geometry through a simulated stream drop (`page.clock` fast-forward past `STREAM_OFFLINE_MS`), attaching before/after screenshots to the Playwright report (FE-12) |
| 22 | Reduce-motion renders static frames at every width, browser, both settings | Same group, a second test under `reducedMotion: 'reduce'`; `paintStep.spec.ts`'s `driftAmplitude` unit proof for the fixed-vs-time-varying value (FE-4) covers the mechanism, the e2e test covers what a real DOM sees |
| 40 | The `Re-engage when {conditions}` line carries the level as a condition, never a control label | `AiRecPanelBlocks.tsx`'s A1b/A1c gate-note text (unchanged this phase; carried over from the pre-existing shipped copy — read, not modified) |
| 46 | Figures inside the sheet step with their container, browser, 393 | `ReadSheet.spec.tsx`'s container-hazard block asserts the DECLARATION (`_kit/emotionCssReader.ts`); the STEPPING behaviour is `[lane-check]` review-only — jsdom cannot evaluate container queries. This session confirmed the declaration is intact (`PanelContainer` one level inside the portalled Drawer Paper) by reading `ReadSheet.tsx:185-188` fresh |
| 51 | The executed e2e case list | §5 above |
| 52 | Light mode, browser, 393 and 1280 | `desk-and-read.spec.ts`'s own automated pixel-read proof (dark `11,15,23` vs light `246,246,243`, FE-12) **plus** this session's own fresh screenshots (§10): `dark-1280.png`/`light-1280.png`/`light-393.png` — the field canvas genuinely repaints onto the light panel surface, no dark-plate bleed, at both widths |
| 57 | Mutation-proof completeness | §4 above |

## 8. Named debt (SPEC §1 Future), each with `file:line` and a phase

| Debt | Where | Phase |
|---|---|---|
| The curve's point-by-point text equivalent | `shared/charts/structure-field/StructureFieldCanvas.tsx` (the canvas gained an accessible name + summary this phase — `role="img"` `:233`, `aria-label` `:234`, `aria-describedby` `:235` — but not a per-strike textual rendering of the curve itself) | **Phase 4** — DELEGATED, P1 part 3 |
| The wire-level attempted-vs-failed discriminator, two gaps one cause | The off-exchange object (`read-strip/readStripModel.ts`, `offExchange?.ratio_pct != null ? ... : NOT_PROVIDED`) and the five levels (`level-ladder/ladderModel.ts:1052`, `ABSENT_LEVEL`) — both wires carry no reason field, so neither can say "not attempted" vs "failed"; one entry because the cause is identical (`apps/api` diff stays empty, this phase cannot add the discriminator without touching the backend) | Not yet assigned |
| The eight context widgets rebuilt as first-class quiet panels | `IvRank.tsx`, `MarketContext.tsx`, `StraddleMove.tsx`, `DealerFlowProjection.tsx`, and four siblings — unchanged structurally this phase beyond phase-1's own six ⓘ-affordance fixes | **Phase 3** |
| An alert-on-level entry point from the desk | No file yet — `AlertsPage.tsx` exists (phase 1) but nothing in `level-ladder/**`/`structure-hero/**` opens it | **Phase 3, with alerts** |
| The remaining spacing exemptions | `shared/theme/spacing-ladder.spec.ts:43-71` — **25 EXEMPT files, 48 off-ladder occurrences** remain after this phase's one-file burn-down (§9 below); booked to `SPACING_DEBT_BURNDOWN_PHASE` | **Phase 4** |
| `Widget.watch`'s pre-existing rule-22 question | `shared/ui/Widget/Widget.tsx` (the `watch?: boolean` prop, FE-1 step 6) — does a watch pulse (orders watching for a live cross) need a genuinely delivering stream? Unchanged by this phase, both by design (nothing renders differently — `watch` and `live` drive the same `widgetLivePulse` declaration) and by explicit non-goal | Not yet assigned — pre-existing question, not created by this phase |
| The CWD-dependent e2e quality reporter | `apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts:10` — `path.resolve(process.cwd())` resolves the manifest path relative to the invoking shell's CWD, not the reporter's own file location; correct when run from the repo root (as `nx e2e` always does — confirmed working in every run this session, §1), silently doubles the prefix into an `ENOENT` if invoked from inside `apps/dashboard-e2e/`. **Not fixed this session** — a safe fix (resolve relative to `import.meta.url`/`__dirname` instead) touches the one file three other scripts depend on for an identity check (`tools/lib/manifest.mjs`, `tools/manifest.spec.mjs`, `mapChromiumIdentity`'s own callers), and this session could not fully verify Playwright's TS-transform module semantics (CJS vs ESM `__dirname`/`import.meta.dirname` availability) without a live test of the change — better to name it precisely (as the RESUME instructs) than ship an unverified guess into a file three tools trust | Small robustness fix, unassigned — flagged again for whoever next touches that reporter |

## 9. Owner ruling 4 — the radius sweep (every site whose rendered radius changes)

**Ruling 4's own mechanism** (set at phase 1, unchanged this phase): MUI's `sx` prop resolves a **numeric**
`borderRadius: n` through `createUnaryUnit(theme, 'shape.borderRadius', ...)` — i.e. `n × shape.borderRadius`
(12 today) — while a **string** (`'12px'`) or a native `style=` value is a literal, untouched by the token.

**This phase does not touch `shape.borderRadius` itself** (unchanged since phase 1's 10→12 migration;
confirmed: `git diff e73c7b53..HEAD -- apps/dashboard/src/app/shared/theme/tokens.ts` on the `shape`
region returns nothing). A full grep of every `borderRadius` occurrence across the 42 files this phase
created or touched (`git diff --name-status e73c7b53..HEAD -- apps/dashboard apps/dashboard-e2e`,
production sources only, specs excluded) was then diffed line-by-line against the pre-branch
(`e73c7b53`) version of each file to separate "touched" from "byte-identical, only shifted":

| # | file:line | before → after | role | rendered radius changed? |
|---|---|---|---|---|
| 1 | `level-ladder/LevelLadder.tsx:65` (new file) | n/a → `borderRadius: 999` | PILL role (the ladder tick's coloured bar) | **no** — PILL saturates at any multiplier; this is a net-new site, not a changed one |
| 2 | `gex-profile-chart/chart.tsx` (deleted with `GexProfileChart`) | `borderRadius: 0.5` (the legend `Dot`) → **removed** (component deleted whole, FE-11) | sx multiplier | n/a — the site no longer exists, not "changed" |
| 3 | `gex-profile-chart/GexStrikeProfile.tsx` (deleted) | `borderRadius: '0 0 11px 11px'` → **removed** (file deleted whole, FE-11) | native literal | n/a — same reason |

**Every other `borderRadius` occurrence found in a touched file is byte-identical to its `e73c7b53`
value** (confirmed line-by-line, not merely by file-level diff absence): `FigureCell.tsx:80`
(`theme.shape.borderRadius`, direct token reference — pre-existing, phase-1's own re-point from
`StatTile.tsx`), `FigureCell.tsx:139` (`'50%'`), `AiRecPanelBlocks.tsx:96,421` (`borderRadius: 3`),
`DecisionCard.tsx:366` (`borderRadius: 2`, inside a hunk whose surrounding `Typography` was rewritten but
this exact line is an unchanged context line), `TapePulseStrip.tsx:223`, `DealerFlowProjection.tsx:92`,
`MarketContext.tsx:165`, `TickerDashboard.tsx:660` (all four `'12px'` literals), `StructureFieldCanvas.tsx:240,282`
(`embedded ? 0 : 12` and `'8px'`, both native canvas-overlay `style=` values, confirmed identical at
`e73c7b53`), `OrdersWidget.tsx:42` (`borderRadius: 2`), and `Widget.tsx:355,404,435` (the phase-1 PANEL-role
`borderRadius: 1` / `borderTopLeftRadius: theme.shape.borderRadius` sites — only line numbers shifted).

**Conclusion: this phase introduces exactly one net-new radius site (a PILL, saturates, no visible
change), removes two sites along with the two components they lived in (not "changed," gone), and
changes the rendered radius of zero pre-existing sites.** Nothing here needs a `MuiDialog`/`MuiButton`/
input override decision — those roles were declared and closed at phase 1.

## 10. Owner ruling 5 — the 44px touch-target audit (controls this phase creates or touches)

Ruling 5 narrows the floor to controls this phase creates or touches, itemized with `file:line`, not a
sentence acknowledging debt exists. A structural scan of every file this phase created or substantively
changed (`onClick`/`onPointerDown`/`onMouseDown`/`onKeyDown`, `role="button"`, `IconButton`,
`ToggleButton`, `<Select>`, native `<input>`/`<label>`/`<select>`, `tabIndex`, `cursor: pointer`, `href`)
found the following controls, each checked against the theme floor's actual selector
(`shared/theme/theme.ts:80-102`, `button, [role="button"], a`):

| Control | file:line | Element shape | Verdict |
|---|---|---|---|
| The bottom-sheet peek row (tap to re-expand) | `ai-rec/ReadSheet.tsx:86-88` | `<Box component="button" type="button">` | **In the floor** — a real native `<button>`, inherits `theme.ts`'s coarse-pointer `min-height: 44` automatically; no local override contradicts it |
| The sheet's minimize chevron | `ai-rec/ReadSheet.tsx:177-183` | `<IconButton>` (renders `<button>`) | **In the floor** |
| Field/Magnet toggle (two buttons) | `structure-hero/StructureHeroPanel.tsx:220-236` | `<ToggleButton>` (MUI, renders `<button>`) | **In the floor** |
| The ladder's ⓘ affordances (`LadderFoot`), the strip's ⓘ affordances (`ReadStrip`), the hero's ⓘ (`StructureHeroPanel`) | `level-ladder/LadderFoot.tsx:29,40`, `read-strip/ReadStrip.tsx:64`, `structure-hero/StructureHeroPanel.tsx:216` — all via `info=` into `FigureCell` | `FigureCell.tsx:307` renders the shipped `ai-rec/AccessibleHelp` control (phase 1's own ruling-6 fix, reused verbatim — a real focusable button) | **In the floor** — reuses the already-audited, already-fixed control; this phase adds new **call sites**, not a new control shape |
| The ladder ticks (`LadderTick`) | `level-ladder/LevelLadder.tsx:57-70` | `<Box aria-hidden>`, no `onClick`/`role`/`tabIndex` | **Not a control** — decorative, `aria-hidden`, nothing to tap |
| The canvas's own accessible name (P1 part 2) | `shared/charts/structure-field/StructureFieldCanvas.tsx:233-235` | `role="img"`, `aria-label`, `aria-describedby` — no `onClick`/`tabIndex` | **Not a control** — a label and a description, not a focusable element; not a 44px question |
| `<Select>` (persona picker, model picker) inside `AiRecPanel.tsx` | `ai-rec/AiRecPanel.tsx:290,340,380` (approx., re-indented by this phase's `ReadSheet` wrap) | MUI `Select`, renders `role="combobox"` on a `<div>`, not `button`/`[role="button"]`/`a` | **Pre-existing, unchanged in substance** — diffed line-by-line against `e73c7b53`: identical code, only re-indented one level to sit inside `<ReadSheet>`. This phase did not create this control and did not change its element shape; it is the same escape (if any) that existed before this phase and is out of ruling 5's "creates or touches" scope in substance, named here only for completeness so it is not mistaken for an undetermined case |
| Every `<Button>`/`<IconButton>` this phase added or moved (`OrdersWidget.tsx`, `AiRecPanelBlocks.tsx`, `DecisionCard.tsx`, `ReadSheet.tsx`, lab toggles) | multiple | All are MUI `Button`/`IconButton`/`ToggleButton`, which render native `<button>` | **In the floor by construction** — MUI's `size` prop does not remove the theme's coarse-pointer floor (confirmed at phase 1, unchanged mechanism) |

**Itemized conclusion: zero undetermined or failing interactive controls among what this phase creates
or touches.** The one candidate worth naming plainly (the two `<Select>` combobox controls) is a
**pre-existing** condition this phase did not create, did not newly touch in substance, and did not make
worse — carried forward, not booked as new debt from this build, and not a `button`/`[role=button]`/`a`
escape this phase is responsible for closing.

## 11. Four real defects this build found in previously-shipped code

Found and **fixed**, not merely observed — the strongest evidence this phase was worth running:

1. **The gamma-flip `offline · last known` fabrication** (`live-tape/LiveTape.tsx`, pre-FE-2). Post-latch,
   `FigureCell.tsx:267-275`'s arm B renders whatever `value` the caller passes — fixing only the
   `retained` boolean would have left the bundle flip rendering as a 15px Sans pseudo-literal under an
   `offline` caption. Both the value AND the boolean now come from the same latch (FE-2).
2. **A second, independently-discovered fabrication site**: `chrome/TapePulseStrip.tsx:31-34` (pre-FE-6).
   `isLive` did not require `live.mid != null`, but `liveMid` did — so a live stream with no mid printed
   `Live $<structureMid>` (a basis fallback silently dressed as a live number) at the old `:199,:204`, and
   the same fallback fed the trail buffer unconditionally at the old `:71,:73`. Fixed by making
   `TapePulseStrip` fully presentational, with the same latch-resolved `mid`/`claim` discipline (FE-6).
3. **`useAiRecommendation.ts`'s catch branch destroyed a pinned AI read on any failed refresh** — it
   called `setRec({status:'unavailable',...})` unconditionally on any non-auth failure, including a
   refresh fired while a produced read was already pinned (`DecisionCard`'s "Refresh" and the A1c
   annex's "Ask anyway" both re-call `ai.request()`). This genuinely **replaced** the pinned rec, not
   merely hid it. Fixed inside the hook (never a parallel ref) with a functional `setRec` update:
   `current?.status === 'produced' ? current : {...unavailable}` (FE-10, `useAiRecommendation.ts:186-187`).
4. **The hero's mid stream read was gated on `claim` alone**, which is always `false` during a
   session-tape replay — so before this phase's own FE-11 fix, the ladder mid and the tape-trail's `Mid`
   readout could never show a real replayed number, only ever the empty literal. Fixed by gating on
   `numbersActive = st ? tape.displayActive : claim` (`structure-hero/StructureHeroPanel.tsx:119`) — the
   exact discipline `LiveTape.tsx`'s own `numbersActive` already established, never a new one.

**Plus a DOM colour census finding**: four buttons defaulted to MUI's unthemed brand amber TEXT in every
produced state including *No trade* (where SPEC row 30 requires zero amber) — `DecisionCard.tsx`'s
"Set your risk inputs" (`:96`), "Create sim order" (`:503`), "Full analysis & data" i.e. `analysis`
(`:508`), and "Refresh" (`:512`) all rendered `color="primary"` by MUI's own unthemed default for an
`outlined`/`text` variant with no explicit `color` prop — invisible to any test until FE-9 built a real
DOM colour census rather than trusting the source to say what it renders. Fixed: `:96,:508` → `color="info"`
(link-class, matching the panel's existing "View what's sent" precedent); `:503,:512` → `color="inherit"`
(neutral secondary, matching "Dismiss"/"Retry" precedent). The one `variant="contained"` CTA
(`reviewTrade`) is correctly exempt — its text is `primary.contrastText` on an amber fill, the fill-grade
spend rule 16 does not scope.

## 12. Row 16 — `BLOCKED — GATE Z` status (do not report row 16 green)

PLAN.md's own row 16 carries a `BLOCKED — GATE Z` STOP block. That block is **lifted** for this build: the
launch brief for this session recorded that criterion 16 was split at GATE Z into **16a** (symbol change)
and **16b** (replay arm), and PLAN.md's row-16 text predates that split. FE-2 (the reset-token half)
already covers 16a/16b's provable substance; FE-11 additionally proved 16b explicitly (replay ⇒ no pause
mark, mechanised by branching on the standing union rather than `!isLive` — §4 above, GATE Z item 1
mutation proof). **Row 16 itself is not reported green as a single criterion** — it is superseded by 16a
and 16b, both of which are green, and that supersession is what this report records rather than a bare
pass/fail on a row number the spec itself split.

## 13. The seven DELEGATED calls (P1–P5, D-14, D-15) — provenance kept, not silently absorbed

All seven were taken by the conductor under the owner's written overnight delegation, not by the owner
directly, and are restated in `state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md`. Tagged here
so the provenance survives into GATE Q and the ledger, each with where it actually landed in the shipped
build:

| Call | What it decided | Where it shipped |
|---|---|---|
| **P1** | The canvas text equivalent, split three ways: levels already have a text equivalent (the ladder) — assert it; the canvas gets an accessible name + summary (cheap, not optional); the curve's point-by-point text equivalent is named debt, phase 4 | `StructureFieldCanvas.tsx:233-235` (name+summary); §8 above (debt) |
| **P2** | Rule 16's amber scope: the verdict word is the only amber-rendered TEXT in the panel, in every state; amber that is not text is limited to the focus ring and the in-flight progress indicator, mutually exclusive with the verdict word | `DecisionCard.tsx`'s verdict styling (FE-9); the four-button colour census fix (§11 above) |
| **P3** | Canon rule 14 amended: distance is from the levels anchor (`gex_spot ?? price`), not the mid; "the mid is the only live row" and the shared-stroke clause kept verbatim | `level-ladder/ladderModel.ts` (FE-5); the amendment text itself is §14 below |
| **P4** | The AI read's failure state: add `request failure` as a named state in rule 16; record that *stale* and the full-analysis drawer compose over a produced read; give `no_edge`/`superseded_inputs`/`incomplete_trade` an explicit disposition each | `readLayout.ts`'s 15×7 grid (FE-9); the amendment text is §14 below |
| **P5** | The hero's light-mode scope: **In** — the field must not render as a scheme-invariant dark plate now that it is the desk's primary instrument | `StructureFieldCanvas.tsx`'s theme-derived `palette`/`surfaces` props (FE-3/FE-6); proven by `desk-and-read.spec.ts`'s criterion-52 pixel read (FE-12, §7 above) |
| **D-14** | The level-absence literal: one member for all five level absences, `—` (not `not provided`) | `level-ladder/ladderModel.ts:1052`, `ABSENT_LEVEL` |
| **D-15** | `cooldown`/`daily_cap` over a pinned read render **unchanged** this phase — a budget claim does not qualify what the pinned read asserts | Unchanged by construction; no file touches this (FE-9's own RESUME section confirms `AiRecPanel.tsx:423`'s `!producedRec` gate is untouched) |

## 14. The four canon amendments assigned to FE-14 — drafted, not filed

**Following phase 1's own precedent** (the conductor files canon at close): these are **drafted precisely
below**, not written into `.spire/clusters/tech/context/DESIGN_SYSTEM.md` by this lane. The conductor
should review and file at GATE S.

**One correction to the launch brief for this session, found before drafting, not after**: the brief
named **four** amendments including "the `tooltip` z-rung at 45." Both `PLAN.md` (§"FE-14", the paragraph
immediately following its own four-row amendment table) and `SPEC.md` §9 item 4 state, in matching
language, that **the tooltip z-rung is explicitly NOT amended in this phase** — MUI's `Tooltip` defaults
to 1500, above every declared v2 rung, and this phase's own `AccessibleHelp` tooltips sit inside a sheet
at rung 30 and a dialog at rung 40, where 1500 renders correctly above both, so the gap is named as
"benign here" and explicitly "not this phase's blocker." Reading `theme.ts:82` fresh, `zIndex.tooltip`
already holds a **working value of 60** (a phase-1 decision, unrelated to and not superseded by
anything in this phase), not 45 — no source in this build ever names 45. **Following PLAN.md/SPEC.md
(the locked, governing artifacts) over the launch brief's paraphrase**: this build ships **three**
amendments, not four, and the tooltip z-rung stays a named, non-blocking gap exactly as SPEC §9 item 4
already records it. Flagging this discrepancy explicitly rather than silently fabricating a fourth
amendment the governing contracts themselves disclaim.

**Amendment to rule 11** (`DESIGN_SYSTEM.md` row 11, "Locked intentional deviations"):
> Current text names "the GEX chart" (originally the Recharts-based `GexProfileChart`) as the
> vertical-diverging lock. That component is deleted this phase (FE-11) — its functional successor is
> `StructureFieldCanvas.tsx`, a from-scratch Canvas2D instrument with no Recharts ancestry to retire
> from. **Update**: replace the stale chart reference with the current one (`StructureFieldCanvas.tsx`),
> keeping the vertical-diverging lock's substance. **Keep the second clause VERBATIM**: *"do not collapse
> mid + last-trade into a single price without an amendment"* — the masthead redraw this phase performed
> is precisely the kind of change where that collapse gets proposed for space, and amending rule 11 is
> exactly the moment it could be lost by accident. No product behaviour changes; documentation only.

**Amendment to rule 14** (`DESIGN_SYSTEM.md` row 14, "Level ladder") — DELEGATED, P3:
> Current text: *"distance from mid in the last column."* The shipped anchor is `gex_spot ?? price`
> (`level-ladder/ladderModel.ts`, `_kit/distanceToLevel.ts:11-14`), not the mid — all four non-mid rows
> compute distance from that anchor, and the mid row itself carries `ABSENT_DISTANCE` (D-14's literal),
> never a distance from itself. **Update**: *"…with distance from the levels anchor (`gex_spot ?? price`),
> stated once in the ladder header"* replaces the "distance from mid" clause. **Keep verbatim**: *"the mid
> is the only live row"* and the shared-stroke clause (*"each row's tick uses the same stroke as its line
> in the structure field so ladder and field read as one object"*). No product behaviour changes — this
> corrects stale prose against code that already ships this way (FE-5).

**Amendment to rule 16** (`DESIGN_SYSTEM.md` row 16, "AI read brief") — DELEGATED, P2 + P4:
> 1. **Amber scope (P2)**: replace *"the verdict word is the panel's single amber spend… nothing else in
>    the panel spends amber"* with: *"the verdict word is the only amber-rendered TEXT in the panel, in
>    every state. Amber that is not text is limited to exactly two things: the authored `:focus-visible`
>    ring (rule 6, a system-wide affordance) and the in-flight progress indicator while a request is
>    actually running — driven by a real request, stopping when it resolves, disabled under reduced
>    motion, and mutually exclusive with the verdict word."*
> 2. **Add `request failure` as a named state (P4)**: the nine named states become **ten**: *idle ·
>    loading · produced (trade) · produced (no trade) · stale · cooldown/daily cap · signed out · add a
>    key · request failure · full-analysis drawer.* `request failure` renders its own named line
>    (`ai-rec/copy.ts:51-52`, "AI unavailable — try again") and never renders as idle or as a no-trade
>    verdict.
> 3. **Composition clarification (P4)**: *stale* and the *full-analysis drawer* **compose over** a
>    produced read rather than being exclusive peers with it — the same clarification shape rule 18 took
>    when the per-figure dot and the page chip were found to contradict read literally. **Extend this
>    clarification to include the quiet gate**: A1c (the quiet-gate annex) also composes over a produced
>    read (`resultState ≠ null` with `requestState: 'no_edge'`) — the gate note and its `Ask anyway`
>    control render beneath the read, which stays present and readable; the panel is never rendered as an
>    ordinary fresh read while the annex shows.
> 4. **Explicit dispositions for the three previously-homeless shipped states**: `no_edge` → the quiet-gate
>    annex, A1c (composes, does not replace); `superseded_inputs` / `stale_at_generation` /
>    `stale_newer_snapshot` → the *stale* state (composes over the produced read, in-body warning strip);
>    `incomplete_trade` → maps onto `produced (no trade)`'s body shape (the pure `readLayoutFor` mapping
>    cannot itself distinguish a stale trade from a stale no-trade without a third fact outside its 2-axis
>    input; the production render path, `DecisionCard.tsx`'s `isTrade`, does not have this limitation and
>    renders correctly — see `readLayout.ts`'s own doc comment).
>
> Behavioural: criteria 30, 32–36, 41–43, 58, 59 (already implemented and green this session, §1/§4).

**Rule 17** (`DESIGN_SYSTEM.md` row 17, "Six breakpoints…") — **tense only, no product behaviour, no
values change**: current text reads *"834 is added at build"* (future tense) — 834 was added at **phase
1** (`no-overflow.spec.ts:51`, `{label: 'tablet 834', width: 834, height: 1112}`), confirmed still present
and green this session (§1, V13/V14). **Update**: *"834 was added at build, phase 1"* (past tense). The
overflow widths themselves (393/900/1280 as declared, 834 added) are **already correct** — do not change
them, per this session's own explicit instruction.

**The `tooltip` z-rung**: **not amended** — see the correction above. Recorded here as a named,
non-blocking gap exactly as `SPEC.md` §9 item 4 already states it, not as a fourth amendment.

## 15. Spacing exemption burn-down (partial by design, ruling 4)

**Fully accounted for, not silently left partial.** Ruling 4's fence: burn down the spacing exemptions
**only in the files this phase rewrites**. Of the 26 EXEMPT files at the phase-1 baseline (49 off-ladder
occurrences), exactly **one** — `chrome/TapePulseStrip.tsx` — was a file this phase actually rewrote (its
`Mid` readout gained the offline pause-mark treatment, GATE Z item 1, FE-11). Its one off-ladder value
(`px: 1.25`) moved onto the 4-pt ladder (`1.5`) and its EXEMPT entry was removed in the same commit,
mutation-proven (§4 above). Measured directly from `spacing-ladder.spec.ts`'s own live-checked scan
(confirmed fresh this session by reading the file, not re-running a separate script — the count is
asserted by the suite itself and the suite is green, §1 V8): **25 EXEMPT files, 48 off-ladder
occurrences** remain, all in files this phase did not rewrite (`position-brief/PositionBrief.tsx` was
read, not rewritten — only its JSX call site moved in `TickerDashboard.tsx`). No other EXEMPT entry was
touched. The remainder carries to **phase 4** ("the responsive sweep") with its occurrence count named,
per §8 above — not an open-ended grandfather; the list itself is live-checked so a stale entry that stops
matching real source fails the test, closing the "silent rot" failure mode this mechanism exists to
prevent.

## 16. Browser check, this session — the composed desk, end to end

Every FE task from FE-4 through FE-12 already ran its own browser check against either a temporary lab
mount or (from FE-8 onward) the real `/ticker/TSLA` route on the production build, documented in
`RESUME.md`. This session ran one additional, independent consolidated check against the **actual
assembled desk** (production build, `http-server apps/dashboard/dist`, network-mocked via a fixture
extracted verbatim from `curvature-v2.spec.ts`'s own `bundle`/`scan`/`LIVE_SSE_FRAME`, not hand-retyped),
covering dark/light at 393 and 1280, plus a reduced-motion 1280 pass:

- **Zero page overflow** at every width×scheme combination (`document.documentElement.scrollWidth ===
  clientWidth`, measured, not eyeballed): 393 dark, 393 light, 1280 dark, 1280 light, 1280
  dark-reduced-motion.
- **Exactly one** `widget-structure-hero`, **exactly one** `widget-read-strip`, **exactly one**
  `tape-pulse-strip` (confirming the old masthead duplicate stays gone), **zero**
  `widget-gex-strike-profile` (confirming the FE-11 deletion holds) — at every combination.
- The canvas's accessible name resolves via `getByRole('img', {name: /Net dealer gamma by strike/i})` —
  **1** match at every combination (P1 part 2, confirmed live, not just by source reading).
- **Zero console errors or page errors** at any combination.
- Visual confirmation (full-page screenshots, reviewed): the reading order holds (masthead → structure
  hero [field + ladder + foot] → read strip → tape & plan [live tape, position brief, AI recommendation,
  simulated orders] → supporting context); light mode genuinely repaints the field canvas and every panel
  onto the light surface (no dark-plate bleed) at both 393 and 1280; the read strip's rail visibly clips
  after two cells at 393 (the deliberate horizontal rail) with the page itself never overflowing; no
  stray amber text anywhere in the idle/composer state (the two visible amber elements are the
  `variant="contained"` "Open simulated trade" and "Analyze current snapshot" CTAs — fill-grade spend,
  correctly exempt from rule 16's text-only scope).
- One false alarm caught and resolved by direct debugging, not assumed: an early full-page screenshot
  appeared to show the AI-recommendation panel rendering as a blank box. Isolated with a targeted
  element-only screenshot and an `outerHTML` read — the panel renders full, correct content (header,
  body copy, persona selector, "Analyze current snapshot" CTA); the blank appearance was a full-page
  screenshot paint-timing artifact in the throwaway harness, not a product defect. Recorded here per
  `spire-tech-debugging` — read the root cause before reporting a finding, not the first symptom.
- Cleanup: throwaway script (`_fe14_closer_visual.mjs`), its fixture-extraction helper
  (`fixture-pieces.mjs`), and all screenshots were deleted after use; `git status --short` confirmed a
  clean tree; the server was killed and `npm run ports:free` swept both address families before and
  after.

## 17. Summary

Typecheck 0, full unit suite 231 files / 2693 tests (0 failures on the trusted re-run, one documented
environmental flake on an unrelated pre-existing file), lint 0 (5 pre-existing warnings, 0 new), 34/34
design tokens, `apps/api` diff 0 lines / 0 files (three-dot), production build 0, e2e 86/86 twice against
the production build, 0 flaky both times. Zero orphaned `DealerPositioning` cells. Every mutation proof
this phase claims is proven non-vacuous. The radius sweep found one net-new saturated PILL site and two
removed sites, zero changed pre-existing sites. The 44px audit found zero undetermined or failing
controls among what this phase creates or touches. Three canon amendments are drafted (rules 11, 14, 16)
plus a tense-only update to rule 17; a fourth amendment named in this session's own launch brief (the
tooltip z-rung) is not made, because the governing `PLAN.md`/`SPEC.md` explicitly disclaim it — recorded
as a discrepancy, not silently followed. Four real defects in previously-shipped code were found and
fixed. Named debt is booked with `file:line` and a phase for every item this phase knowingly
under-built, including the CWD-dependent e2e quality reporter, left unfixed this session by deliberate
choice rather than risk an unverified module-resolution change in a file three tooling scripts trust.
