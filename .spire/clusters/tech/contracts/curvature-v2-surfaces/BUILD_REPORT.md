# BUILD_REPORT — curvature-v2-surfaces (frontend)

One section per task, appended by the lane that lands it; FE-14 (frontend closer) owns the whole-phase
verification section at the end. Evidence over assertion: every number below was produced by a command
run in the session that wrote the section, with the **exit code** read directly (`$?` /
`$LASTEXITCODE` / `${PIPESTATUS[0]}`), never from a printed summary.

**Baseline, restated from `PLAN.md` (the conductor's own runs on `spire/curvature-v2-foundations`
@ `dd1326d9`) — not re-derived here:**
`npm run typecheck` **exit 0** · `npm run lint` **exit 0** ·
`npx nx test @convexa/dashboard --skip-nx-cache` **exit 1 at 2691 / 2694** — three **load** timeouts
(`app.risk.spec.tsx` "/\_ops/metrics renders WITHOUT the trader shell"; `orders.risk.spec.tsx`
`act_confirm_live_cross_fill…` and `cancel_is_terminal…`) that **pass in isolation at exit 0, 31/31** ·
`git diff --stat f8957d3f..HEAD -- apps libs` **empty** · e2e **NOT RUN** at baseline (phase 2 closed it
at 86/86 against the production build).

> **Read this before reporting anything green.** The baseline suite exits **1**. A run that exits 1 with
> only those three files is **at baseline** — prove it the way the conductor did (re-run them in
> isolation and record 31/31, exit 0). Any *other* failure is a real one.

---

## FE-1 — `shared/figure/`: the F1–F9 branch, the two marks, the one face, and N-1's two needles

**Landed:** 2026-09-07, one commit. **Criteria:** 1 (mechanism), 2 (SB), N-1 (SB); host for 3, 4, 12,
13, 27a, 27b, 28, 29, 35e, 53, 54. **GATE Z items: none** — FE-1 was buildable exactly as planned.

### 1. What shipped

| File | Change |
|---|---|
| `apps/dashboard/src/app/shared/figure/figureState.ts` | **new** — the whole F1–F9 branch, pure, no JSX. `figureStateOf({ value, register, live, offline, replay, caption, assertedBy }) → { figureState, isLiteral, mono, isFigure, dim, untraced, showDot, showPause, caption }` — the signature both lanes signed (SPEC §2.1; `decisions.md` §3 #0+#16). |
| `apps/dashboard/src/app/shared/figure/FigureMarks.tsx` | **new** — `LiveDot` and `PauseMark` **moved** out of `FigureCell.tsx` (they were module-private) as named exports, bodies byte-for-byte including `data-testid="figure-live-dot"` and the visually-hidden word `live`. The `visuallyHidden` const travelled with `LiveDot`, its only user. |
| `apps/dashboard/src/app/shared/figure/figureFace.ts` | **new** — `MONO_FACE`, `SANS_FACE`, `UNTRACED_RULE`, `faceFor(mono)`. The one face binding outside `shared/theme/tokens.ts`. |
| `apps/dashboard/src/app/shared/figure/index.ts` | **new** — the barrel every consumer from FE-3 on imports. |
| `apps/dashboard/src/app/shared/figure/figureState.spec.ts` | **new** — 17 tests: the state table, the four shipped captions, caption precedence, the register-ignored-on-a-literal rule, the `LiveClaim` brand at compile time, and the "ladder does not travel" assertion. |
| `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx` | re-pointed: **355 → 313 lines**. Zero local state logic, zero local face literal. |
| `apps/dashboard/src/app/shared/theme/fonts.spec.ts` | **+5 tests** — criterion N-1's two needles, each with its own poison, enforcing from this commit behind a live-checked 14-entry `EXEMPT` map. The shipped `RETIRED_FACES` block is untouched. |

**Zero desk-spec edits, as planned.** No assertion in any of the nine `data-figure-state` / live-dot
specs was touched, and none of the sixteen shipped `FigureCell` call sites changed.

### 2. A MOVE, not a copy (SPEC §2.1's named risk)

- `grep -n "fontFamily" apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx` → **zero
  lines** (grep exit 1). The reviewer probe's first question, answered.
- `grep -n "\bMONO\b|visuallyHidden|PauseIcon|@mui/material/Box|isNotANumber"` on the same file →
  **zero lines**: the local `MONO` const, both mark bodies, the icon import, the `Box` import and the
  literal-membership call all left the file rather than being duplicated.
- The branch exists **once**: `FigureCell` now makes one `figureStateOf(...)` call and renders its
  fields. `data-figure-state` stays on the **card root**, `data-figure-register` on the value — the
  split §2.1 warns assertions about, unchanged.
- What deliberately did **not** travel: `CellCard`, the label row, the `AccessibleHelp` host, the
  20/17/15 ladder and the fixed 15px literal size. Measured in the render evidence below — the module
  emits no size at all.

### 3. Criterion N-1 — two needles, enforcing from the first commit

Scope is the criterion's three trees (`features/trading/`, `pages/positions/`, `pages/scanner/`),
sources only: **91 files** in the glob.

- **Needle 1** — a closed-nine member rendered inside a mono-bound run, line-window −6/+12, returning
  `line:member` so a red names the site. **4 files** violate today, all already exempt.
- **Needle 2** — a face literal or a face binding outside the two homes (`shared/theme/tokens.ts`,
  `shared/figure/`). **14 files** violate today — exactly the planner's measured count.

**`EXEMPT` map size: 14**, each entry naming the task that removes it, live-checked on **both** arms
(the file must still exist in the scan **and** must still violate; a stale entry red-builds). FE-14
asserts the map empty.

| Exempt file | Face-binding sites (measured this session) | Needle-1 sites | Removed by |
|---|---|---|---|
| `pages/scanner/ScanCells.tsx` | `:45` (`const MONO`, `:44-48`) | — | FE-3 |
| `pages/scanner/ViewEditorDialog.tsx` | `:47` (`MONO.fontFamily`) | — | FE-3 |
| `features/trading/positions/PositionRow.tsx` | `:74` (`:73-78`) | `70:—`, `345:no basis`, `495:—` | FE-5 |
| `features/trading/positions/PositionCard.tsx` | `:40` (`monoSx`), `:74,95,151,160` | `69:—`, `158:—` | FE-5 |
| `features/trading/positions/LegDisclosure.tsx` | `:59` | — | FE-5 |
| `features/trading/outcomes/TrackRecordSection.tsx` | `:88` (`const MONO`), `:136` | — | FE-5 |
| `features/trading/orders/OrderRow.tsx` | `:46` | — | FE-5 (face only; the `⏸` at `:172` is Z-1 debt) |
| `features/trading/orders/OrderDetailDialog.tsx` | `:39` | `145:—`, `180:—`, `181:—` | FE-5 |
| `features/trading/broker/BrokerPositionRow.tsx` | `:120,158,183,315,369` | `188:—` | FE-7 |
| `features/trading/broker/BrokerPositionCard.tsx` | `:76,138` | — | FE-7 |
| `features/trading/broker/BrokerGroupHeader.tsx` | `:41` | — | FE-7 |
| `features/trading/broker/ProvenanceHeader.tsx` | `:70` | — | FE-7 |
| `features/trading/broker/reassess.tsx` | `:126,139` | — | FE-7 |
| `pages/positions/PositionsPage.tsx` | `:185` | — | FE-6 |

**One implementation deviation, recorded rather than hidden.** PLAN's illustrative needle-1 regex
(`/\.\.\.\s*MONO\b|MONO_FACE|monoFontFamily|fontFamily\s*:\s*MONO\b/`) **cannot match its own required
fixture** — `<Box sx={MONO}>` carries neither a spread nor a `fontFamily:` prefix, and `sx={MONO}` /
`sx={{ ...MONO }}` is how the shipped atoms actually bind it. The shipped needle detects a mono binding
**by name** (`/\bMONO(_FACE)?\b|\bmonoSx\b|\bmonoFontFamily\b/`), a strict **superset** of all four
shapes PLAN listed plus the two spellings the tree carries. Both of PLAN's required guard outcomes hold
unchanged (mono fixture non-empty, Sans fixture empty). Needle 2 likewise adds a bare `\bfontFamily\s*:`
alternative, without which `ViewEditorDialog.tsx:47`'s `fontFamily: MONO.fontFamily` would not violate
and its **planned `EXEMPT` entry would red-build the live check on day one**. PLAN's three required
needle-2 fixture outcomes are unchanged (`'IBM Plex Mono'` → true, `typographyTokens.monoFontFamily` →
true, `...faceFor(true)` → false).

### 4. Mutation proofs — every one actually run (red text captured), then reverted to green

| Proof | Poison | Red result (verbatim) | Restore |
|---|---|---|---|
| **A** — criterion 2 (SB): a converted call site with no `register` cannot render a figure | deleted `register={cell.register}` from `read-strip/ReadStrip.tsx:59-65` | `npm run typecheck` **non-zero (Nx exit 130)** — `ReadStrip.tsx(59,14): error TS2741: Property 'register' is missing in type '{ label: string; value: string; live: LiveClaim; info: string; }' but required in type 'FigureCellProps'.` **And `nx test` on that tree stayed exit 0, 31/31 — that is the point**: only the typechecker sees this. | reverted; `git diff` on the file = **0 lines**; `npm run typecheck` **exit 0** |
| **B** — N-1 needle 1 (SB), against a REAL source | injected `content: 'not recorded',` beside `...MONO` in `pages/scanner/ScanTable.tsx` (in scope, **not** exempt) | `fonts.spec.ts` **exit 1** — `AssertionError: N-1 violation: /src/app/pages/scanner/ScanTable.tsx → closed-nine member in a mono run (needle 1): 165:not recorded` | reverted; `git diff` on the file = **0 lines** |
| **C** — N-1 needle 2 (SB), against a REAL source | injected `fontFamily: 'IBM Plex Mono, monospace',` into the same non-exempt file | `fonts.spec.ts` **exit 1** — `AssertionError: N-1 violation: /src/app/pages/scanner/ScanTable.tsx → binds a font face locally (needle 2)`. The same run showed **no** needle-1 hit, which is proof B's revert verified. | reverted; `git diff` = **0 lines** |
| **B′/C′** — the guards themselves are non-vacuous (§2.3: "each needle ships its OWN poison") | disabled both needles in place (`MONO_BOUND`, `FACE_LITERAL`, `FACE_BINDING` → `/$^/`) | **exit 1, 4 failed**: needle-1 guard (`expected [] to not deeply equal []`), needle-2 guard (`expected false to be true`), the EXEMPT live check, and the enforcement test. Note the enforcement test **would have passed vacuously** on the injected-violation poisons alone if the guards did not exist — which is exactly why §2.3 refuses to inherit the shipped `RETIRED_FACES` guard. | needles restored; `fonts.spec.ts` + `figureState.spec.ts` **exit 0, 31/31**; zero `POISON` markers left in the tree |

No proof in this section is a narrated `expect(true).toBe(true)`; each red above is copied from a run in
this session's terminal.

### 5. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/shared/figure` (first run, before the module existed — the TDD red) | **exit 1** — `Failed to resolve import "./figureState" from "src/app/shared/figure/figureState.spec.ts"` |
| `npx vitest run src/app/shared/figure` (after implementing) | **exit 0**, 17/17 |
| `npx nx test @convexa/dashboard --skip-nx-cache -- FigureCell fonts liveClaim` | **exit 0** — 4 files / **50** tests (`FigureCell.spec.tsx` 22, `fonts.spec.ts` 14, `liveClaim.spec.ts` 13, `liveClaim.typeproof.spec.ts` 1) |
| the nine `data-figure-state` / live-dot specs (`live-dot-census`, `ticker.risk`, `FigureCell`, `type-floor`, `level-ladder/*`, `LiveTape`, `ReadStrip`, `StructureHeroPanel`) | **exit 0** — 10 files / **137** tests, **zero assertion edits** |
| `npx nx test @convexa/dashboard --skip-nx-cache` (**full suite**) | **exit 1** — **1 failed / 2715 passed (2716 tests)**, 231/232 files. The single failure is the baseline's own load timeout: `app.risk.spec.tsx > "/_ops/metrics" renders WITHOUT the trader shell/nav (own chrome)` — `Error: Test timed out in 15000ms` at `app.risk.spec.tsx:309`. The other two baseline-flaky cases passed this run. **At baseline, not a regression** — proved below. |
| isolated re-run: `npx vitest run src/app/app.risk.spec.tsx src/app/features/trading/orders/orders.risk.spec.tsx` | **exit 0** — 2 files / **31** tests, matching the baseline note exactly (31/31) |
| `npm run typecheck` (from the repo root) | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing (4 × `no-explicit-any` in e2e configs / generated client, 1 × `react-hooks/exhaustive-deps`), **0 new** |
| `node design/src/verify-tokens.mjs` (run because `figureFace.ts` imports `typographyTokens`) | **exit 0** — 34/34, "All shared tokens match tokens.ts" |
| `npx nx format:write --files <the 7 changed paths>` | **exit 0**, scoped (never a bare `format:write`) |

**Test-count arithmetic, so the delta is auditable:** baseline 2694 → **2716** = +17 (`figureState.spec.ts`)
+5 (the N-1 block in `fonts.spec.ts`). No shipped test was deleted or weakened.

### 6. Visible copy diffs — **none**

FE-1 changes **zero** user-visible strings. The four captions were carried across as the shipped bytes
and asserted as such: `offline · last known`, `offline`, `session replay`, `${assertedBy} · untraced`
with the `AI-stated · untraced` fallback. `data-testid="figure-live-dot"`, the visually-hidden word
`live`, `data-testid="stat-secondary"` and `data-testid="cold-skeleton"` are byte-identical.

**Two CSS declarations were added, and both are measured no-ops** (stated rather than left for a
reviewer to find). `MONO_FACE` is `ScanCells.tsx`'s shipped `MONO` promoted verbatim, so a mono glyph
and the caption now also emit `font-variant-numeric: tabular-nums` and `letter-spacing: 0`:

- `tabular-nums` is **already global** — `theme.ts:114` sets `html { font-variant-numeric: tabular-nums }`
  in `MuiCssBaseline`. The declaration is redundant, not new behaviour.
- `letter-spacing: 0` replaces the inherited `normal` on `body1`, and **`body1` declares no tracking**
  (`theme.ts:55`); the only variant that does is `overline` (`0.06em`, `theme.ts:51`), which no
  `FigureCell` glyph uses. Plex Mono is monospaced, so neither declaration moves a pixel.

### 7. Render evidence (structural — jsdom + the emitted Emotion CSS)

**Browser/visual pass NOT run for FE-1**, deliberately: FE-1 is not the frontend closer (FE-14 is), it
changes no visible copy, layout or colour, and the phase's own e2e rendering criteria (7a, 21, 62, 63)
are FE-13's. Instead, all eight producible states were rendered and their **emitted CSS read back**
through the shipped `emotionCssReader` (the ninth name, `loading`, belongs to `StatSkeleton` and is
asserted unreachable from `figureStateOf`):

| State | DOM | value CSS (face / size / emphasis) | caption |
|---|---|---|---|
| F1 default | `state=default register=mono`, no dot, no pause | Plex Mono; `font-size:20px` + `17px` + `15px` container steps | — |
| F3 live | `register=mono`, **dot yes**, help button present with `info` | Plex Mono; 20/17/15 | — |
| F4 offline-retained | **pause yes**, value retained | Plex Mono; 20/17/15; **`opacity:0.5`** | `offline · last known` (overrode the caller's `caption`) |
| F5 offline-bare | **pause yes**, `register=sans` | Plex Sans; **flat `font-size:15px`, no `@container`**; `opacity:0.5` | `offline` (no "last known" anywhere) |
| F7 empty | `register=sans`, text `—` | Plex Sans; flat 15px | — |
| F8 unavailable | `register=sans`, text `not recorded` | Plex Sans; flat 15px | — |
| F9 untraced | `register=sans` | Plex Sans; 20/17/15; **`border-bottom:1px dotted` + `border-color: var(--mui-palette-text-secondary)`** | `model · untraced` |
| F6 replay | `register=mono`, no dot, no pause | Plex Mono; 20/17/15; full strength | `session replay` |

Two structural facts fall straight out of that table: the **ladder stayed with `FigureCell`** (the
module emits no size; only real figures carry the three sizes, literals are flat 15px), and **the
chrome stayed too** (the help button appears only where `info` is passed).

### 8. Carried notes for the tasks below

1. **Consume the module, never the card.** `import { figureStateOf, faceFor, LiveDot, PauseMark } from '@/shared/figure'`.
   `PauseMark` renders MUI's `PauseIcon` (`svg[data-testid="PauseIcon"]`), never the `⏸` glyph — that is
   the import criteria 27a/27b/28/29 were waiting on.
2. **Delete your own `EXEMPT` entries in the same commit as your conversion** (FE-3 two, FE-5 six,
   FE-6 one, FE-7 five). The live check fails a stale entry, so a conversion that forgets its entry
   red-builds — by design.
3. **`register` is required and has no default**, and it is ignored on a literal. Proof A shows the
   compiler is the enforcement, so run `npm run typecheck` at every claim of done.
4. `figureStateOf` takes a **branded** `live`; a scanner caller passes `NOT_LIVE` (criterion 11A) and a
   raw `true` is a type error — asserted with a `@ts-expect-error` in `figureState.spec.ts` that
   `npm run typecheck` would flag as unused if the brand ever weakened.

---

## FE-2 — The liveness fence reaches four surfaces; `/positions` stops calling the banned predicate

**Landed:** 2026-09-07, one commit. **Criteria:** 6 (SB). **GATE Z items: none** — buildable exactly as
planned; measured zero new `EXEMPT` entries, exactly as PLAN predicted.

### 1. What shipped

| File | Change |
|---|---|
| `apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts` | `DESK_SOURCES` → `FENCED_SOURCES`, glob widened from one tree (`pages/ticker/widgets/**`) to five: `pages/ticker/widgets/**`, `pages/scanner/**`, `pages/positions/**`, `pages/alerts/**`, `features/trading/positions/**`, `features/auth/**`. `BANNED` and the mutation guard (`violatesLivenessFence`) **byte-unchanged**. The live-checked `EXEMPT` idiom kept exactly as shipped (existence check on the wider source map). Anti-vacuity strengthened to also assert a `pages/alerts/` path is present in the glob (the new tree criterion 6 names by name). |
| `apps/dashboard/src/app/pages/positions/PositionsPage.tsx` | **lines 31 and 88 only**, as scoped. `:31` `import { genuineIsLive } from '@/pages/ticker/sessionTapeStanding';` → `import { isDeliveringLive } from '@/shared/liveness/liveClaim';`. `:88` `const isLive = genuineIsLive(live, streamOffline);` → `const isLive = isDeliveringLive(live, streamOffline);`. One predicate left the tree, none arrived — a deletion, exactly as PLAN step 3 describes. |

**Measured: no new `EXEMPT` entry was required**, confirmed independently of the plan's own grep:
`grep -rnE "\bgenuineIsLive\b|\btape\s*\.\s*isLive\b|\bisLive\s*&&"` across the five widened trees
(non-spec sources) returned **exactly** `PositionsPage.tsx:31,88` — the two lines this task deletes —
and nothing else. The shipped `live-tape/LiveTape.tsx` entry is untouched and still accurate.

### 2. Behaviour delta — checked against the two page specs, not assumed

Per PLAN step 3, both full-page specs under `pages/positions/` were run **before** trusting the swap:
`positions.integration.spec.tsx` (15 tests) and `positions-page.spec.tsx` (15 tests). **Zero cases
moved** — all 30 passed unchanged, before and after the predicate swap. Read at source rather than
assumed: every fixture in both files that drives `streamTicker`'s mocked SSE already carries
`market_session: 'regular'` (`positions.integration.spec.tsx:241`) or omits `market_session` entirely
while never setting it to `'closed'` (`positions-page.spec.tsx:531`) — `isDeliveringLive`'s one added
check (`market_session === 'closed'`) never fires against either fixture set, so no fixture needed
repair. The `market_session: 'regular'` value is also **not** `'closed'` under either predicate, so this
is not a coincidence of one lucky fixture — it is the actual fixture shape in both files. Recorded
rather than silently passed over, since PLAN's step 3 explicitly anticipated a fixture repair that
measurement shows was not needed here.

### 3. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/shared/liveness` (before the glob widened — TDD red) | **exit 1** — `AssertionError: expected [ Array(1) ] to deeply equal []` naming `/src/app/pages/positions/PositionsPage.tsx` (the pre-existing offender, now visible under the widened glob) |
| `npx vitest run src/app/shared/liveness src/app/pages/positions` (after the deletion) | **exit 0** — 4 files / **44** tests (`liveClaim.typeproof.spec.ts` 1, `liveClaim.spec.ts` 13, `positions.integration.spec.tsx` 15, `positions-page.spec.tsx` 15) |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing (same set FE-1 recorded), **0 new** |
| `npx nx format:write --files apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts,apps/dashboard/src/app/pages/positions/PositionsPage.tsx` | **exit 0**, scoped |

### 4. Mutation proof — run red, then reverted to green

**MUTATION PROOF D (criterion 6, SB).** Planted `const _mutationProofD = genuineIsLive(live, false);`
in `pages/scanner/Scanner.tsx` — one of the five **new** globs (not the desk, so the red proves the
*widened* fence rather than re-proving the shipped one).

- **Red (verbatim):** `fonts`-idiom `AssertionError: expected [ Array(1) ] to deeply equal []` with
  `- []` / `+ ["/src/app/pages/scanner/Scanner.tsx"]` — the scan named the planted file exactly.
- **Restore:** poison line deleted; `git diff --stat -- apps/dashboard/src/app/pages/scanner/Scanner.tsx`
  = **0 lines** (clean revert, confirmed by `git diff`, not by memory); re-run
  `npx vitest run src/app/shared/liveness src/app/pages/positions` → **exit 0**, all 44 tests green
  again.

No proof above is a narrated `expect(true).toBe(true)`; the red text is copied from this session's
terminal.

### 5. Visible copy diffs — none

FE-2 changes zero user-visible strings and zero DOM. It is a predicate swap behind an unchanged
boolean-typed prop chain (`isLive` still flows to `usePortfolio`, `PortfolioPanel`,
`useOrderEngine` unchanged in shape).

### 6. What was run in the app

Not run for FE-2 — no visible behaviour changed (confirmed by the unmoved 30/30 page-spec result
above, and PLAN scopes FE-2 as non-rendering: "Copy diffs: none"). The rendered/browser pass is owed by
FE-3/FE-4 (scanner) and is recorded there.

---

## FE-3 — Scanner: register + the closed nine on every figure, both layouts, and the lookup-miss member

**Landed:** 2026-09-07, one commit. **Criteria:** 9 (SB), 10 (SB), 11A (SB), 17, U-6, 18, 19, 20,
22 (SB), U-35 (scanner half). **GATE Z items: none** — buildable exactly as planned.

### 1. What shipped

| File | Change |
|---|---|
| `pages/scanner/ScanCells.tsx` | Local `export const MONO` (`:44-48`) deleted. Every atom (`Dash`, `PriceCell`, `ChgCell`, `ScoreCell`, `TierCell`, `LabelCell`, `LevelDistCell`, `UpdatedCell`) now resolves its face through `figureStateOf` + `faceFor` from `@/shared/figure`, emitting `data-figure-state` + `data-figure-register` on its own node. The absent-value arm of every numeric atom now renders through the module's literal branch (Sans) instead of the shipped `...MONO` spread — the criterion-17 fix. `TierCell`/`LabelCell` gained the U-6 split (`ClosedLookupResult` from `labels.ts`): a lookup MISS renders `unavailable`, a genuine absence renders `—`, routed through the same `Dash` component (now `value`-parametrized). |
| `pages/scanner/labels.ts` | **Addition only** (no existing line changed): `ClosedLookupResult` type, `closedLookup()`, and `tierLookup`/`regimeLookup`/`volLookup` exports, sitting beside the untouched `closed()`/`tierLabel`/`regimeLabel`/`volRegimeLabel` (`whyThisRow` still uses the old null-collapsing form — unaffected). |
| `pages/scanner/ScanTable.tsx` | `MONO` import from `./ScanCells` → `MONO_FACE` from `@/shared/figure` (symbol-link styling, byte-identical render — `MONO_FACE` is the old `MONO`'s exact shape). `regimeTextOf`/`volTextOf` calls → `regimeLookup(row.regime)`/`volLookup(row.vol_regime)` feeding `LabelCell`'s new `result` prop. Panel radius `borderRadius: '10px'` → `borderRadius: 1` (U-35). |
| `pages/scanner/ScanCard.tsx` | Same `MONO` → `MONO_FACE` re-point (symbol span), same `LabelCell` prop change, same radius fix (`:70`). |
| `pages/scanner/ViewEditorDialog.tsx` | `import { MONO } from './ScanCells'` deleted; `fontFamily: MONO.fontFamily` → `...MONO_FACE` (a spread, not a `fontFamily:` key — needle 2 forbids the bare token, not just a literal string); `...MONO` (view-name-editor row) → `...MONO_FACE`. |
| `pages/scanner/scanner.register.spec.tsx` | **New.** 41 tests covering criteria 9, 10/11A, 17/U-6, 19, 20, 22 (18 is already pinned by the shipped `scanner.risk.spec.tsx` skeleton test, cited rather than duplicated). |
| `shared/theme/fonts.spec.ts` | FE-3's two `EXEMPT` entries (`ScanCells.tsx`, `ViewEditorDialog.tsx`) deleted — both files no longer violate either needle (confirmed by the full suite run below, not merely asserted). |
| `shared/theme/radius-scale.spec.ts` | New `describe` block: a `STRING_PX_RADIUS` needle (`/borderRadius:\s*'(\d+)px'/`) that the shipped `NUMERIC_RADIUS` regex cannot see, scoped to the two named scanner panel sites only — **not** a blanket app-wide string-radius ban, because both files also carry unrelated `'4px'` CONTROL-role radii (sort button, symbol link) that are pre-existing carried debt, out of this task's scope, and would false-positive a wider scan. |

### 2. Copy diffs — none

CF-1's two constants (`cadenceHeader`, `cadenceGloss`) are FE-4's. Every scanner string FE-3 touches
is byte-identical, including `'⚠ Stale'` / `'⚠ Error'` and every tooltip. `LabelCell`'s lookup-HIT
render (e.g. `Pos γ`, `IV rich`) is byte-identical to the shipped Sans render — only its MISS/ABSENT
fallback changed, from a bare `—` in both cases to `unavailable` (miss) vs `—` (absent).

### 3. A design question resolved, recorded rather than left implicit

**Does a present regime/vol/tier value move to the Mono register too, now that the mechanism exists?**
No. PLAN's step-1 atom list (`PriceCell`, `ChgCell`, `ScoreCell`, `LevelDistCell`, `UpdatedCell`,
`Dash`) is exactly the set of atoms that already spread the shipped local `MONO` — `LabelCell`'s
lookup-HIT arm never did (it inherits the ambient Sans body font by omission, not by a deliberate
register decision), and PLAN's own U-6 step names only the miss/absent split as `LabelCell`'s
assigned change. Retrofitting Mono onto a present closed-lookup label would be an unrequested visual
change with no criterion asking for it, so the HIT arm's render is untouched; only its literal
fallback (now U-6-correct) and a new `data-figure-register="sans"` attribute (zero visual effect)
were added.

### 4. Mutation proof — run red, then reverted to green

**MUTATION PROOF E (criterion 9, SB).** In `ScanCard.tsx`, replaced `regimeLookup(row.regime)` with
an inline pass-through of the raw wire enum (`row.regime != null ? { kind: 'value', text: row.regime }
: { kind: 'absent' }`), bypassing the closed lookup on the CARD layout only.

- **Red (verbatim):** `AssertionError: cell-regime table vs card: expected { text: 'Pos γ', …(2) } to
  deeply equal { text: 'positive_gamma', …(2) }` — the both-layouts assertion named the exact
  mismatch (closed label vs raw enum) and the exact cell.
- **Restore:** poison reverted; `git diff --stat -- apps/dashboard/src/app/pages/scanner/ScanCard.tsx`
  shows only this task's real changes (`7 insertions(+), 8 deletions(-)`, matching the `MONO_FACE`
  re-point + `LabelCell` prop change) — **zero** residual poison lines; re-ran
  `scanner.register.spec.tsx` → **exit 0, 41/41**.

No proof above is a narrated `expect(true).toBe(true)`; the red text is copied from this session's
terminal.

### 5. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/pages/scanner src/app/shared/theme` (first run, before `radius-scale.spec.ts`'s docstring fix and the mutation-fixture false positive were resolved) | **exit 1** — 3 failures: (a) `fonts.spec.ts` needle 1 false-positive on this file's OWN prose (`ScanCells.tsx`'s doc comment said `` `MONO` `` and `` `"unavailable""` `` inside the same 18-line window — rewritten to name neither token near the other); (b) `radius-scale.spec.ts`'s new needle over-matched `ScanTable.tsx`'s two unrelated `'4px'` CONTROL radii (narrowed to the named `'10px'` panel-role value only); (c) my own new `scan-empty-filter` test asserted no `role="alert"` on the WHOLE page, tripping on the toolbar's unrelated sign-in nudge (`role="alert"`, `severity="info"`) — narrowed the query to `within(empty)`. All three were test-authoring defects on my side, not product defects; fixed and re-run. |
| `npx vitest run src/app/pages/scanner src/app/shared/theme` (after the three fixes) | **exit 0** — 22 files / **235** tests |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing, **0 new** |
| `npx nx format:write --files <the 8 changed/new paths>` | **exit 0**, scoped |

### 6. What was seen — structural (not yet the browser pass; that is FE-4's, once the header/offline arm land)

Not run against the dev server for FE-3 alone: FE-3 changes zero pixels (the register conversion is
either invisible — same face, same size — or additive DOM attributes), and the one visible U-6 fix
(a lookup-miss tier/regime/vol cell reading `unavailable` instead of `—`) has no reachable fixture on
the real `/api/scan` wire today (the sweep only emits known enum values). Verified structurally
instead, in `scanner.register.spec.tsx`: a fully-populated row and an absent/miss row both render
identically across the table and the card (text, register, and state all equal); the live-dot testid
never appears in either layout; a null numeric renders `—` in the Sans register with
`data-figure-state="empty"`; a lookup miss renders `unavailable` with `data-figure-state="unavailable"`.
The combined browser pass for `/scanner` (including this fix, live in the running app) is recorded
under FE-4, once the header/offline-arm change lands in the same surface.

---

## FE-4 — Scanner: the degraded price arm, the flash gate, and D-A's two sentences

**Landed:** 2026-09-07, one commit. **Criteria:** 12 (SB), 13 (SB), 14 (SB), 15, 16, CF-1 (SB).
**GATE Z items: none** — buildable exactly as planned.

### 1. What shipped

| File | Change |
|---|---|
| `pages/scanner/Scanner.tsx` | `flashActive` moved after `live` is in scope and gained `&& !live.offline` (criterion 14). New `priceOffline = useCallback((sym) => live.offline && live.prices[sym] != null ? { retained: true } : null, [live.offline, live.prices])` (SPEC §2.2's exact predicate, `:136-140`), passed to both `<ScanTable>` and `<ScanCardList>`. Header/gloss wiring (`Scanner.tsx:143-146`) is byte-unchanged — only `labels.ts`'s two constants moved under it. |
| `pages/scanner/labels.ts` | `cadenceHeader` → `Prices per tick · structure ~3 min · hot names sooner`; `cadenceGloss` → the SPEC-authored two-sentence replacement (opening liveness clause removed, cadence/basis meaning kept, the denial `"...rather than a live read"` retained). `cadenceHeaderOffline` byte-identical. |
| `pages/scanner/ScanTable.tsx` / `ScanCard.tsx` | Both gain the required `priceOffline: (symbol: string) => { retained: boolean } \| null` prop, threaded through `cellContent`/`ScanTableRow` (table) and `ScanCard`/`ScanCardList` (card) to `PriceCell` only — no structure atom ever receives it (criterion 10). |
| `pages/scanner/ScanCells.tsx` | `PriceCell` takes the new `offline` prop, calls `figureStateOf({ value, register: 'traced', offline: offline ?? null })`, and renders `PauseMark` (from `@/shared/figure`) + a new `data-testid="cell-price-caption"` span (`offline · last known`) when `showPause` is true. Dim (`opacity: 0.5`) applied via the module's `dim` output, never a cell-local flag. |
| `pages/scanner/scanner.risk.spec.tsx` | T5's pin (`:869` pre-edit) strengthened into two tests: the shipped offline-arm assertion now pins the exact byte-identical `cadenceHeaderOffline` string (not just the `/live\|offline/` alternation), plus a **new** ONLINE-arm test using a controllable `SilentEventSource` stub (the `ticker-hierarchy.spec.tsx:24-30` idiom) that keeps `live.offline` at its initial `false`, pinning the new header byte-for-byte and asserting the word "live" never reaches the page text. |
| `pages/scanner/scanner.register.spec.tsx` | Extended (FE-3's Owns note anticipated this): all six `<ScanTable>`/`<ScanCardList>` call sites across both spec files updated with `priceOffline` (required, no default — matches the `register` precedent). New sections for criteria 12/13 (a real `EventSource` stub delivers a price then errors), 14 (flash-class assertion + its own anti-vacuity contrast), 16 (worker-down register survival), and CF-1 (the copy freeze scan, below). |

### 2. Copy diffs — itemized (CF-1's closed set of exactly two)

| Constant | Shipped | New |
|---|---|---|
| `labels.ts:29` `cadenceHeader` | `Prices live · structure ~3 min · hot names sooner` | `Prices per tick · structure ~3 min · hot names sooner` |
| `labels.ts:34-36` `cadenceGloss` | `Prices stream live. The options structure — score, tier, flip and walls — re-computes about every 3 minutes, and names that just moved re-compute sooner, so those numbers are a recent snapshot rather than a live read.` | `Prices change tick by tick. The options structure — score, tier, flip and walls — re-computes about every 3 minutes, and names that just moved re-compute sooner, so those numbers are a recent snapshot rather than a live read.` |

Both are the SPEC §4.2-authored strings, copied verbatim. Nothing else on scanner changes — proven
by the new CF-1 scan (§4 below), which checks every other `SCAN_COPY` value (string entries against
a frozen table copied from `git show d905d26a~1` — the commit immediately preceding FE-3 — and
function entries by their sample output) and passed clean on the first run.

### 3. A pre-existing defect found, not fixed here (carried debt)

**`ScanTable`'s zero-state lead grouping silently drops the live-price overlay when it applies.**
Found while writing the criterion-12 test: `Scanner.tsx`'s `groups` (index-first-defaults AC-3) is
computed from `scan.rows` (the polled sweep, pre-live-merge) and passed to `<ScanTable groups={…}>`;
inside `ScanTable`, `const sections = groups ?? [{ key: 'all', rows }]` — whenever `groups` is
present (any DEFAULT, non-account view with a lead member, e.g. the anonymous zero-state), `sections`
walks `groups[*].rows` and the `rows` prop that actually carries the live-merged `displayRows` is
**never read**. A symbol whose price ticks over the live wire while the zero-state grouping is active
therefore never shows the updated price — the SWEPT price renders forever, silently. Confirmed by
instrumenting `Scanner.tsx`'s own render output during test authoring (not asserted from outside):
`displayRows` computed the correct merged price on every render, but `ScanTable` rendered the stale
one whenever `groups` was non-`undefined`. **Not fixed here**: it predates this phase (the
`groups`/`polledRows`/`displayRows` split already shipped before FE-3), none of FE-4's assigned
criteria (12/13/14/15/16/CF-1) name it, and `Scanner.tsx`'s grouping logic is product behavior this
lane's mandate does not extend to touching without a criterion. **Worked around in this task's own
tests** by using an authenticated `view.source: 'account'` fixture (never regrouped, per
index-first-defaults AC-3's own "a saved view is never regrouped" rule) so the criterion-12/13/14/16
tests exercise `displayRows` directly. Filed here with `file:line` for a later phase:
`ScanTable.tsx`'s `sections = groups ?? […]` line should read from `rows` per-row rather than from
`groups[*].rows` wholesale, or `Scanner.tsx`'s `groups` should be built from `displayRows` instead of
`scan.rows`.

### 4. T5 — run before and after, exactly as PLAN required

- **Before** (D-A header edit not yet landed — this is a re-confirmation, since FE-3 already landed
  without touching `labels.ts`'s copy): `scanner.risk.spec.tsx`'s `/Prices (live|offline)/` pin —
  **GREEN**, exit 0. Renders the offline arm (jsdom has no `EventSource`; `useLivePrices` throws
  inside its `try` and flips `offline: true` on the very first effect run), exactly as PLAN's T5 note
  predicted.
- **After** (header/gloss rewritten): same pin — still **GREEN**, exit 0 (confirmed the alternation
  regex is insensitive to which string ships, by design — that is precisely why PLAN calls it a trap).
  Both arms are now pinned by name: the strengthened offline test asserts the byte-identical
  `cadenceHeaderOffline` string; the new online-arm test (a `SilentEventSource` stub keeps
  `live.offline` at its initial `false`) asserts the byte-identical new header AND that `/\blive\b/i`
  never appears anywhere in `page.textContent`.

### 5. Mutation proofs — run red, then reverted to green

**MUTATION PROOF F (criterion 12, SB).** In `Scanner.tsx`, changed
`live.offline && live.prices[sym] != null ? { retained: true } : null` to
`live.offline ? { retained: true } : null` — dropping the provenance term, keeping only the stream
flag.

- **Red (verbatim), two tests named the exact defect:**
  `expect(qqqPrice).toHaveAttribute('data-figure-state', 'default')` → *"Expected the element to have
  attribute: data-figure-state="default" / Received: data-figure-state="offline-retained""* (a
  never-ticked symbol got the retained treatment it must never reach), and the dedicated poison test
  → *"expected SVGSVGElement{…} to be null"* (a `PauseIcon` rendered on a never-ticked symbol).
- **Restore:** predicate reverted; `git diff --stat -- apps/dashboard/src/app/pages/scanner/Scanner.tsx`
  shows only this task's real 19-insertion/3-deletion diff (matches the `flashActive` move +
  `priceOffline` addition), **zero** residual poison; re-ran `scanner.register.spec.tsx` → **exit 0,
  51/51**.

**MUTATION PROOF G (CF-1, SB).** `cf1Offenders({ ...SCAN_COPY, loading: 'Loading scan...' })` (the
real ellipsis `…` swapped for three ASCII dots) — **red, naming exactly `['loading']`** and no other
key, proving the scan is byte-precise rather than merely "some string changed". This is the in-test
poison-and-check idiom (the same shape FE-1 used for its own needle guards); no separate revert step
is needed since the mutation is a local object spread, never written to `labels.ts`.

No proof above is a narrated `expect(true).toBe(true)`; both reds are copied from this session's
terminal.

### 6. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/pages/scanner/scanner.register.spec.tsx -t "criteria 12"` (poisoned predicate, T5 debugging pass included) | **exit 1** — 2 failed (the two reds quoted above); the debugging session that found this also traced a false start (the pre-existing grouping defect, §3) via temporary `console.log` instrumentation in `Scanner.tsx`/`useLivePrices.ts`, all removed before this run (`git diff` on `useLivePrices.ts` = 0 lines, confirmed) |
| `npx vitest run src/app/pages/scanner src/app/shared/theme` (after the fixture fix + revert) | **exit 0** — 22 files / **246** tests |
| `npm run typecheck` (via `npx nx run @convexa/dashboard:typecheck --skip-nx-cache`, forced past the cache after the poison/revert cycle) | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **1 warning** (pre-existing, unrelated file), **0 new** |
| `npx nx format:write --files <the 7 changed paths>` | **exit 0**, scoped |

### 7. What was run in the app — both FE-3 and FE-4 together

`npm run ports:free` (clean), `npm run dev` (api :8000 + dashboard :4200), confirmed both up
(`curl` 200 on `/` and `/api/scan`). Opened `/scanner` in a real headless Chromium (Playwright,
already a repo dependency) at 1280 and 393, signing up a fresh throwaway account each time (the
route is behind `RequireAuth`, confirmed below) rather than driving RTL — genuine browser rendering
against the real `cargo run` backend, not a mock.

- **Signed out, 1280px:** `require-auth-wall` renders, titled *"Sign in to open the scanner"*, with
  the scanner-specific unlock copy and the free-Ticker escape hatch — no empty table, no scanner
  chrome at all (criterion 20, confirmed against the real route wiring, not just the isolated test).
- **Signed in, 1280px, populated:** the header reads **`Prices per tick · structure ~3 min · hot
  names sooner`** with the dotted-underline `Jargon` host; hovering it reveals the gloss tooltip,
  read back **byte-for-byte**: *"Prices change tick by tick. The options structure — score, tier,
  flip and walls — re-computes about every 3 minutes, and names that just moved re-compute sooner,
  so those numbers are a recent snapshot rather than a live read."* The table renders real sweep
  data — tier chips (amber `Actionable`/`Watch`/`Dormant`), regime (`Neg γ`/`Pos γ`, plain Sans, as
  FE-3 decided), vol, flip/wall level+distance in Mono, and — observed live against the real
  backend, not seeded — several symbols whose live price had not yet ticked rendered their price
  cell as a plain, undimmed `—` with no pause mark, which is criterion 13's structural guarantee
  holding under real network conditions, not just a fixture.
- **Signed in, 393px:** the card layout carries every datum the table row carries (symbol, tier
  chip, status, price + chg%, score, regime/vol, flip/wall, updated), one card per symbol, no
  horizontal overflow observed at this width.
- **Filter-matches-nothing, 1280px:** clicking `Dormant` + `Score ≥70` (no seeded row satisfies
  both) renders `"No names match these filters."` with its own `Clear filters` recovery control —
  distinct from the empty-saved-view message, confirming criterion 19 end-to-end.
- **Not observed live:** the F4 offline-retained visual (dim + pause icon + caption) — the real dev
  backend's price stream stayed connected throughout the session, so a genuine drop was not
  naturally reachable in the time available; this arm is covered by the `EventSource`-driven
  automated test in §1/§5 instead, which drives the exact same code path via a real (mocked)
  `onerror` event rather than a fixture assumption.

Screenshots and the throwaway browser-driver scripts were written to the session scratchpad and are
not part of this commit; the dev server and its ports were torn down (`npm run ports:free`) before
handing off.

---

## FE-5 — Positions rows: the offline contract on six cells, the `⏸` removal, the one inversion, the keyboard tips

**Landed:** 2026-09-07, one commit. **Criteria:** 23 (SB), 24 (SB), 25 (SB, sim arm), 26, 27a (SB),
27b (SB), 28 (SB), 29 (SB), U-9, U-15, U-15a (SB), 30, 31, 32, 33, 35, CF-2 (SB). **GATE Z items:
none** — buildable exactly as planned; no scope reading needed re-litigating beyond the ones already
ruled at GATE PLAN (Z-1 OUT, Z-2 delete-under-class-1), both implemented per the ruling.

### 1. What shipped

| File | Change |
|---|---|
| `features/trading/positions/PositionRow.tsx` | `mark`/`pl`/`pl_pct`/`delta_entry`/`session_delta` route through `figureStateOf` + `faceFor`, both from `@/shared/figure`. Each computes a `{ text, hasValue }` fact (three new exported pure helpers `markFigure`/`plFigure`/`plPctFigure`, also imported by `PositionCard`) and passes `offline: streamOffline ? { retained: hasValue } : null`. The bare/no-value arm still renders through the shipped `unavailableCell`/`dashCell`/`literal()` (unchanged, per council #3), decorated with a new `offlineDecoration(caption, testid)` helper (`PauseMark` + a caption `Typography` on its own line via `flexBasis: '100%'`) whenever `showPause` is true. Local `OFFLINE`/`MONO` consts deleted; the panel-local `CELL_MONO_SIZE = { fontSize: '0.86rem' }` replaces `MONO`'s size half, `faceFor(mono)` replaces its face half. `literal()` gained an optional `helpId` parameter (the position id): when present, the three testid'd members (`cell-unavailable`/`cell-not-recorded`/`cell-no-basis`) render inside a focusable (`tabIndex={-1}`) wrapper with `aria-describedby` pointing at a `VISUALLY_HIDDEN` sibling carrying the tip text — the file's own `trend-help` idiom (`:396-401` pre-edit), copied attribute-for-attribute (U-15a). `dashCell`'s untestidded call (`helpId` omitted) is byte-for-byte unchanged. `PendingAffordance`'s `⏸` and `PositionRow`'s two doc-comments mentioning it are updated. |
| `features/trading/positions/PositionCard.tsx` | The big P/L block (`card-pl`) and the Mark footer value (`card-mark`/`card-mark-value`) now read `plFigure`/`plPctFigure`/`markFigure` — the SAME helpers the row calls — and resolve dim/pause/caption via the SAME `figureStateOf`, so the card can never render a different closed-nine member or a different register than the row for one datum. New `card-pl-caption`/`card-mark-caption` testids carry the offline caption. Local `monoSx` deleted; `faceFor(...)` used throughout (hero size 1.5rem / footer 0.76rem-scale kept — the ladder does not travel). |
| `features/trading/positions/PositionsView.tsx` | The group-header's bare `⏸` (`:367` pre-edit) → `<PauseMark />` inside an `inline-flex` wrapper. |
| `features/trading/positions/labels.ts` | `SESSION_DELTA_TIP` loses the parenthetical ` (⏸)` (Z-2). |
| `features/trading/positions/LegDisclosure.tsx` | `LEG_MONO` re-pointed to `...MONO_FACE` (from `@/shared/figure`) + its own `fontSize: '0.8rem'`; byte-identical CSS (same three face properties, same size). |
| `features/trading/outcomes/TrackRecordSection.tsx` | Local `const MONO = typographyTokens.monoFontFamily` deleted; the one consuming `sx` spreads `...MONO_FACE`. |
| `features/trading/orders/OrderRow.tsx` | Local `MONO` (byte-identical properties to `MONO_FACE`) deleted; all four `...MONO` sites → `...MONO_FACE`. Face-only — `:172`'s `⏸ offline` untouched (Z-1 carried debt). |
| `features/trading/orders/OrderDetailDialog.tsx` | Local `MONO` (missing `fontVariantNumeric` vs. the shipped `MONO_FACE` — `tabular-nums` is already global via `theme.ts:114`, so this is a measured no-op, the same class FE-1 documented) deleted; two `sx={MONO}`/`{...MONO}` sites → `MONO_FACE`. The `'—'` fallback at the old `:145`/`:180`/`:181` (a needle-1 false-positive the windowed scan picked up from proximity to the mono usage, not from being inside a mono run) extracted into a named `DASH` constant — same rendered byte, no longer a raw quoted literal for the raw-text scan to catch near an unrelated mono site. |
| `shared/theme/fonts.spec.ts` | This task's six `EXEMPT` entries deleted (`PositionRow.tsx`, `PositionCard.tsx`, `LegDisclosure.tsx`, `TrackRecordSection.tsx`, `OrderRow.tsx`, `OrderDetailDialog.tsx`). |
| `features/trading/positions/pauseGlyph.spec.ts` | **New.** The `?raw` scan Mutation Proof H calls for (criterion 29's enforcement mechanism), scoped to `features/trading/{positions,broker}/**` + `pages/positions/**`, excluding `orders/` (Z-1). Detects the glyph inside a rendered string (quoted/backtick/bare-JSX-text) and explicitly ignores comment lines, so historical doc-comments narrating the old treatment don't trip it. Carries a two-entry live-checked `EXEMPT` for Broker's two still-unconverted sites (`BrokerGroupHeader.tsx:215`, `BrokerPositionRow.tsx:128`), named for FE-7. |
| `features/trading/positions/positions.risk.spec.tsx` | `:424`(pre-edit) `⏸ offline` text query → the rendered `PauseIcon` svg + the `offline · last known` caption text. Added: the sim-arm non-synonymy assertion (`not provided` never appears), a new describe block for 27a/27b/28/29 (SB), a new describe block for U-15a (SB) plus a `dashCell`-stays-untestidded regression guard. |
| `features/trading/positions/offlineLayout.spec.tsx` | `:60` re-pointed from `getByText(/⏸ offline/)` to the `PauseIcon` + the `cell-pl-caption` testid (same `flexBasis` assertion). |
| `features/trading/positions/tint.spec.tsx` | `:202` re-pointed from an `innerHTML` regex on the glyph to a `querySelector('svg[data-testid="PauseIcon"]')` check. |
| `pages/positions/positions.integration.spec.tsx` | `:497-498`/`:523` re-pointed from the glyph text to the `PauseIcon` svg + the `offline · last known` caption text (both the drop and the reconnect-clears-it assertions). |

**Zero desk-spec edits** beyond the two named as evidence (`LiveTape.spec.tsx`, `orders.risk.spec.tsx`
— both re-run, both green, `git diff` on `OrderRow.tsx`/`OrderDetailDialog.tsx` confined to the face
re-point).

### 2. The mechanism, restated against the shipped file (decisions.md §3 #13/#17)

The six live-derived cells each compute a `hasValue` fact independent of the connection state (does
this specific figure currently have a real number — `view.mark.net_mark`, `view.pl_dollar`,
`view.pl_pct.kind === 'value'`, `ctx.sessionDelta`), then hand `figureStateOf` exactly that plus
`offline: streamOffline ? { retained: hasValue } : null`. The module's own precedence does the rest:
`offline != null` always wins, `retained` decides F4 vs. F5, and `dim`/`showPause`/`caption` come back
as ONE fact each — never re-derived per cell. This is the same shape `ScanCells.tsx`'s `PriceCell`
already proved out (FE-3/4), applied to five cells instead of one. `trend` is explicitly **not**
converted — `PlSparkline` already dims + breaks the line under `offline` (its own shipped contract,
`TREND_TIP`'s "shows a gap … while the feed is offline"), and it is a chart, not a text figure the
closed-nine vocabulary targets; it is outside FE-5's owned-file list (`PlSparkline.tsx`) and untouched.

**The needle-1 false positives, resolved without changing behaviour.** `fonts.spec.ts`'s `MONO_BOUND`
regex windows ±6/+12 lines around *any* line naming `MONO`/`MONO_FACE`/`monoSx`/`monoFontFamily` — it
has no notion of "inside this JSX element" vs. "eighteen lines below it in the same file." Three of
the six pre-existing violations were pure false positives: two doc-comments (`PositionRow.tsx`'s
`no basis`/`—` prose, backtick-wrapped, read as rendered text by the windowed scan) fixed by
rewording without backticks, and `OrderDetailDialog.tsx`'s `stop`/`target` dash fallbacks fixed by
naming the fallback (`DASH`) instead of repeating the quoted literal near the mono line. The real
fixes — `PositionRow.tsx`/`PositionCard.tsx`'s local `MONO` consts and `PositionCard.tsx`'s two
`'—'`/`''` fallbacks silently sitting inside a mono-styled `Box` — are covered in §3 below. **Neither
`PositionRow.tsx` nor `PositionCard.tsx` names `MONO`/`MONO_FACE`/`monoSx`/`monoFontFamily` anywhere
after this task** (`grep -c` both patterns → 0 in both files), which is what makes the false-positive
class structurally unreachable in these two files going forward, not just fixed today.

### 3. A "one datum, two ways" defect found and closed on `PositionCard` (SPEC §2.3, not a copy change)

Before this task, `PositionCard`'s big P/L block computed its own fallback independently of the row:
`p.status === 'open' && view.pl_dollar != null ? money(view.pl_dollar) : '—'` (`:158` pre-edit) and
`p.status === 'open' && view.pl_pct.kind === 'value' ? pctStr(view.pl_pct.value) : ''` (`:161`
pre-edit). For an OPEN position whose P/L the app cannot compute — the AMD $160 call seeded during the
app pass below is exactly this case — the row renders `unavailable` (with its tip, via
`unavailableCell`) while the card rendered a bare, untooltipped `—` / an empty second line. That is
the SPEC §2.3 defect named by construction ("the card takes the module route so table and card cannot
render one datum two ways") — not a wording change under the copy freeze (§2.7): `unavailable` is
already one of the closed nine, and moving WHICH closed-nine member (or dash) appears for a given
data state to match the row's own answer is the U-6 precedent (a lookup MISS vs. a genuine absence),
not new copy. Fixed by routing both through the SAME `plFigure`/`plPctFigure` the row calls, gated on
`isOpen` exactly as shipped (a closed/pending position still renders the bare literals unchanged).
Itemized here per the reporting instruction, since it is a rendered-text change even though it is not
a copy-freeze class.

### 4. Copy diffs — itemized (positions = additions only + the three permitted classes, §2.7)

All six are class (1) — a typographic truth mark replaced by the declared stroke icon:

| Site | Shipped | New |
|---|---|---|
| `PositionRow.tsx:68` | `const OFFLINE = '⏸ offline';` (appended beside the mark chip) | Deleted; `PauseMark` + `offline · last known`/`offline` caption via `offlineDecoration` |
| `PositionRow.tsx:378` | `{streamOffline ? ' ⏸' : ''}` (appended to `delta_entry`) | `PauseMark` + caption, same placement |
| `PositionRow.tsx:388` | `{streamOffline ? '⏸' : ...}` (replaced the WHOLE `session_delta` value) | The retained value (dimmed) or `—`, + `PauseMark` + caption — never a naked glyph (27a/27b) |
| `PositionRow.tsx:549` | `Paused — resumes pricing when the live feed returns. ⏸` | `Paused — resumes pricing when the live feed returns.` + `PauseMark` (sentence byte-identical minus the trailing glyph) |
| `PositionsView.tsx:367` | bare `⏸` (group header, offline) | `PauseMark` |
| `labels.ts:57` `SESSION_DELTA_TIP` | `…re-anchors fresh each reload and freezes (⏸) while the feed is offline…` | `…re-anchors fresh each reload and freezes while the feed is offline…` (Z-2 — the icon has no host inside a `Tooltip title` string; the sentence's meaning survives without the parenthetical) |

No other shipped positions label, tooltip, column name or status changed. The new caption strings
that now appear (`offline · last known`, `offline`) are **not new copy** — they are the shipped
`figureStateOf` captions (`FigureCell.tsx:262,271` originally, byte-for-byte per FE-1) applied to five
new call sites; no string was authored by this task. §3's `PositionCard` fix is a rendered-text change
but not a copy-freeze class, itemized separately above rather than folded in here.

### 5. Mutation proofs — every one actually run (red text captured), then reverted to green

| Proof | Poison | Red result (verbatim) | Restore |
|---|---|---|---|
| **H** — criterion 29 (SB): the new `pauseGlyph.spec.ts` scan catches a restored `⏸` | `PositionRow.tsx`'s `session_delta` no-value arm: `DASH` → `'⏸_MUTATION_POISON_H'` | `AssertionError: criterion-29 violation:\n/src/app/features/trading/positions/PositionRow.tsx → 587:const sdValue = hasDelta ? money(ctx.sessionDelta as number) : '⏸_MUTATION_POISON_H';` | reverted; `git diff` on the file after = the real 318-insertion/77-deletion diff only, zero `POISON` markers (`grep -c POISON` → 0) |
| **I** — criterion 27b (SB): the bare/no-retained arm must never say "last known" | `mark`'s no-value branch: `offlineDecoration(markState.caption, ...)` → `offlineDecoration('offline · last known', ...)` | `AssertionError: expected 'offline · last known' to be 'offline' // Object.is equality` on the 27b test | reverted; same file, zero residual poison |

Neither proof is a narrated `expect(true).toBe(true)`; both reds are copied from this session's
terminal, naming the exact assertion that caught the planted defect.

### 6. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/shared/theme/fonts.spec.ts` (after the six-file re-point) | **exit 0** — 14/14, including the anti-vacuity and both mutation-guard `it`s |
| `npx vitest run src/app/features/trading/positions src/app/features/trading/orders src/app/features/trading/outcomes src/app/pages/positions src/app/shared/theme` | **exit 0** — 61 files / **810** tests |
| `npx nx test @convexa/dashboard --skip-nx-cache -- src/app/features/trading/positions src/app/pages/positions src/app/shared/theme src/app/shared/figure` (the task's mandated targeted command) | **exit 0** — 52 files / **650** tests |
| isolated re-run: `npx vitest run src/app/features/trading/orders/orders.risk.spec.tsx src/app/app.risk.spec.tsx` | **exit 0** — 2 files / **31** tests — matches the baseline note exactly |
| `npx nx test @convexa/dashboard --skip-nx-cache` (full suite, 1st run) | **exit 1**, Nx flagged it **flaky** itself — a worker fork crashed (233/234 files, no NAMED assertion failure), an infra fault of the same class the documented baseline already carries |
| `npx nx test @convexa/dashboard --skip-nx-cache` (full suite, 2nd run) | **exit 0** — **234/234 files, 2782/2782 tests** |
| `npm run typecheck` | **exit 0** |
| `npx nx run @convexa/dashboard:typecheck --skip-nx-cache` | **exit 0** (forced once, to rule out a stale cache after the poison/revert cycles) |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing (4 × e2e config `no-explicit-any`, 1 × `react-hooks/exhaustive-deps`) — same count as FE-4's landing, **0 new** |
| `git status --porcelain` before staging | exactly this task's owned files + `pauseGlyph.spec.ts` (new) — no stray file, no unrelated `docs/research/...` directory staged |

**Test-count arithmetic.** `positions.risk.spec.tsx` gained 7 tests (25 → 32: the sim-arm
non-synonymy addition, 27a/27b/28/29, the U-15a wording+focus test, the `dashCell` regression guard).
`pauseGlyph.spec.ts` is new at 4 tests. No shipped test was deleted or weakened.

### 7. What was run in the app

`npm run ports:free` (clear) → `npm run dev` → signed up a throwaway account (`/positions` is behind
`RequireAuth`, same pattern as `/scanner`) — the seeded `demo@convexa.io` account only auto-populates
when the backend advertises `SEED_TEST_ACCOUNT`, which this local run did not, so positions were
seeded directly into `localStorage`'s `convexa.positions.v2` (the app's own read-new-else-old union
lifted them into v3 on the next read — the same mechanism `positions.risk.spec.tsx`'s own v1-migration
test exercises, not a bypass of it).

- **Signed out, 1280px:** `/positions` renders `require-auth-wall` naming the surface — "Sign in to
  open your positions" — never an empty book (criterion 32).
- **Signed in, empty book, 1280 + 393px:** "No simulated positions yet. Open one to start your book."
  — distinct from the wall and from a load failure (criterion 33); `Net P/L (open)` still shows the
  pre-FE-6 `+$0` green defect PLAN assigns to FE-6, confirmed out of this task's scope and untouched.
- **Signed in, one seeded OPEN AMD $160 call whose mark could not be resolved against this dev
  backend's chain, 1280px:** the row renders `Mark`/`P/L`/`P/L %` each as `unavailable` in the Sans
  register, `text.disabled`, untinted — no bare `—`, no direction colour — while `Net entry $1040
  debit` (Mono), `Max loss $1040` (Mono, static) and `Aug 21 · 0d` render normally beside it,
  confirming U-9's "static fields never dim" and criterion 26's cell-level scoping live against a real
  chain miss, not a fixture.
- **Same position, card layout, 393px:** the big P/L hero and its second line both read `unavailable`
  in the same Sans/disabled register as the table cell — the §2.3 "one datum, two ways" fix from §3
  confirmed live: before this task's fix the card would have shown a bare, undecorated `—` here.
- **Broker tab, 1280px:** renders the shipped `Connect your brokerage` gate (no credential connected
  in this session) — read-only, no entry/order control, confirming criterion 34's negative space;
  no Broker figures were reachable to inspect without a connection, which is FE-7's conversion, not
  this task's.
- **Not observed live:** the F4/F5 pause-icon/caption visual on a real SSE drop — blocking
  `**/api/stream/**` via the Playwright route API against the real dev backend did not flip
  `offline-banner` within 60s (the same class of limitation FE-3/4's own session recorded: the real
  backend's reconnect/retry behaviour does not reproduce a clean `onerror` the way the repo's
  `SilentEventSource`/`CapturingEventSource` test stubs do). This arm is the most heavily automated
  surface in this task instead — 4 dedicated SB tests (27a/27b/28/29) plus the centerpiece end-to-end
  flow's real SSE-drop assertion in `positions.risk.spec.tsx`, all passing, all reading the rendered
  `PauseIcon` svg and the caption text rather than the retired glyph.

Screenshots and the throwaway browser-driver scripts were written to the session scratchpad and are
not part of this commit; the dev server and its ports were torn down (`npm run ports:free`) before
handing off.

### 8. `EXEMPT` map — this task's six entries deleted

`shared/theme/fonts.spec.ts`'s `EXEMPT` map: **12 → 6** (`PositionRow.tsx`, `PositionCard.tsx`,
`LegDisclosure.tsx`, `TrackRecordSection.tsx`, `OrderRow.tsx`, `OrderDetailDialog.tsx` all removed,
each live-checked before deletion — the enforcement test failed until both the code was fixed AND the
entry was deleted, per the map's own "must still violate" check). The six remaining entries are FE-6's
one (`pages/positions/PositionsPage.tsx`) and FE-7's five (`features/trading/broker/*.tsx`) —
unchanged, both still exist and both still violate, confirmed by this session's own run of
`fonts.spec.ts`.

---

## FE-6 — The positions header readout: `FigureCell`, five states, and the rendered container step

**Landed:** 2026-09-07, one commit (`ede3ddd4`). **Criteria:** 35a (SB), 35b (SB), 35c, 35d, 35e (SB),
7a, 7b, 8, 23 (SB, header). **GATE Z items: none** — buildable exactly as planned; one implementation
detail resolved in-lane rather than bounced (§2 below).

### 1. What shipped

| File | Change |
|---|---|
| `pages/positions/netPl.ts` | **New.** Pure `netPlStateOf({ views, streamOffline, retainedTotal }) → { value, register, caption, tint, offline }` over the five SPEC §4.3 arms. `formatNetPl` (the shipped `+$/−$` sign format) moved here verbatim from `PositionsPage.tsx`. `retainedTotal` is an explicit input (not re-derived from `views`) so the offline arms are testable with a bare number, and because `usePortfolio`'s own mark ladder already keeps a marked row's `pl_dollar` at its last-good value while the stream is down — the caller's marked-sum already IS the retained total. Both offline arms return `caption: null` **by design**: `figureStateOf` overrides a non-null-`offline` caller caption unconditionally (`FigureCell.tsx:253,262,271`), so computing a coverage caption here would be dead code masquerading as behaviour. |
| `pages/positions/PositionsPage.tsx` | The hand-bound `Typography` (mono face, `opacity: streamOffline ? 0.5 : 1`, direction colour) is replaced by `<PanelContainer data-testid="positions-net-pl"><FigureCell label="Net P/L (open)" register={...} value={...} caption={...} offline={...} /></PanelContainer>`. `formatNetPl` and the inline `netPl` number `useMemo` are gone; a new `useMemo` computes `retainedTotal` (marked-sum over open rows) and calls `netPlStateOf`. A local `netPlTintSx(tint)` applies the SPEC §4.3 "direction permitted" tint from **outside** `FigureCell` (which has no colour prop) via a CSS override on the value glyph's own stable `[data-figure-register="mono"]` attribute — never by editing `FigureCell.tsx` (FE-1's file, not owned by this task). `data-testid="positions-net-pl"` and the label `Net P/L (open)` are byte-identical, now carried by the `PanelContainer` wrapper. |
| `pages/positions/positions-page.spec.tsx` | The `net-pl-readout` describe block's second test (`renders the readout (never blank) even when no marks resolve`) asserted the **shipped `+$0` defect itself** (`toMatch(/\$0/)`) — confirmed present before this task touched it, then rewritten to assert the fix: `unavailable` + `0 of 1 open marked`, never a `$`. A new 35a test asserts the empty-book `—` arm. `AC-E17` (the real-SSE-drop test) is strengthened from a bare `className` diff to asserting the actual `data-figure-state="offline-retained"` transition, the rendered `PauseIcon`, and the `offline · last known` caption text — the className check is kept alongside as a because-it-still-holds fact, not the only signal. |
| `shared/theme/fonts.spec.ts` | This task's one `EXEMPT` entry (`pages/positions/PositionsPage.tsx`) deleted — live-checked before deletion (the file no longer binds a face locally: `netPlTintSx` sets `color`, never `fontFamily`). |

### 2. An implementation decision resolved in-lane, not silently and not bounced

**The cross-page import.** `FigureCell` lives at `pages/ticker/widgets/_kit/FigureCell.tsx`; `pages/positions/PositionsPage.tsx` importing it directly is, in the app's own stated terms, "a page importing a sibling page" (`apps/dashboard/src/app/README.md:5`; `_context-pack.md:45`). This is exactly the concern the architect raised at R1 (`council/R1-architect.md:83-84`) and proposed fixing by promoting the WHOLE `FigureCell` component to `shared/ui/`. **That proposal was narrowed, not adopted, by the same architect at R3**: `council/R3-architect.md:12-16` explicitly names "the positions header readout (`PositionsPage.tsx:181-194`, which is panel-shaped and keeps `FigureCell` itself)" as the final shape, and SPEC §2.1/§2.3 and `decisions.md` §3 #0+#16 both restate it the same way. Promoting the whole card now would also require promoting `FigureCell`'s own `AccessibleHelp` import (a `pages/ticker/widgets/ai-rec/` file) — which is FE-12's job (§2.8), not this task's. **Taken as planned**: `PositionsPage.tsx` imports `FigureCell` directly from its existing path, documented in-line with the citations above, rather than either (a) silently doing it with no note, or (b) bouncing a GATE Z question the council already closed twice (R1 raised, R3 settled).

**The tint mechanism.** `FigureCell` has no colour prop — its value glyph is hard-coded `color: 'text.primary'`. SPEC §4.3's "direction permitted" for 35c/35d has no primitive-level hook, and editing `FigureCell.tsx` is out of this task's file ownership (FE-1's). Resolved by targeting the value glyph's own stable, already-cross-surface-tested `data-figure-register="mono"` attribute from a wrapping `sx` override (`PositionRow.tsx:934`'s `'& > span': { color: 'info.main' }` is the shipped precedent for a nested-selector theme colour string) — confined to `pages/positions/`, touches nothing shared.

**A real rendered defect found and fixed, not just described.** `PanelContainer` declares `container-type: inline-size`, which CSS-contains the element's own intrinsic size. As a flex item with no floor, this collapsed the readout to a **zero-width, invisible column** in a real browser (bounding box `{width: 0}`, confirmed by Playwright — jsdom cannot see this, since it does not evaluate container queries or layout at all). Fixed with `minWidth: 200, flexShrink: 0` — the exact shape `ReadStrip.tsx:57`'s own nested `PanelContainer`s already carry (`minWidth: 140`) for the identical reason. Caught only by the mandated run-the-app pass (§6 below), not by any automated test — recorded here as the reason that pass is not optional.

### 3. Copy diffs — none

Label `Net P/L (open)` and `data-testid="positions-net-pl"` are byte-identical. The coverage caption
template `{n} of {m} open marked` is the ONE addition §2.7/CF-2 authorize (used by both the 35b and
35c/mandatory arms — never a second sentence minted). The `—`/`unavailable` values are the shipped
closed-nine members, not new copy. No other positions string changed.

### 4. Mutation proofs — both run red (verbatim), then reverted to green

| Proof | Poison | Red result (verbatim) | Restore |
|---|---|---|---|
| **J** — criterion 35b (SB): the unmarked-book arm must never return a number or a tint | `netPl.ts`'s `n === 0` branch: `value: 'unavailable', tint: null` → `value: formatNetPl(0), tint: 'positive'` | `netPl.spec.ts` **exit 1** — `AssertionError: expected '+$0' to be 'unavailable' // Object.is equality` on the 35b test (the very shape of the shipped `+$0` defect this criterion closes) | reverted; `grep -n MUTATION_POISON netPl.ts` → 0 hits; `netPl.spec.ts` **exit 0, 10/10** |
| **K** — criterion 35e (SB): the coverage caption must never win over the offline caption during a drop | `netPl.ts`'s `if (streamOffline)` early-return disabled (`if (false && streamOffline)`), so a drop fell through to the coverage-caption computation | `netPl.spec.ts` **exit 1, 3 failed** — the load-bearing one: `AssertionError: expected '1 of 2 open marked' to be null` on the new 35e-precedence test (`views` shaped exactly like the 35c coverage-caption case, `streamOffline: true`) — proving the coverage caption DOES leak through once the offline branch is bypassed | reverted; `grep -n "MUTATION_POISON\|false && streamOffline" netPl.ts` → 0 hits; `netPl.spec.ts` **exit 0, 10/10** |

Neither proof is a narrated `expect(true).toBe(true)`; both reds are copied from this session's
terminal, and both name the exact assertion the poison broke.

### 5. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/pages/positions/netPl.spec.ts` | **exit 0** — 10/10 (a fixture-sign mistake in the first draft — `FX_LONG_CALL`'s default mark is a LOSS, not a gain — was caught by a real failing assertion and fixed by adding explicit `gainingOpen()`/`losingOpen()` fixtures, not by loosening the test) |
| `npx vitest run src/app/pages/positions` | **exit 0** — 3 files / 40 tests (`netPl.spec.ts`, `positions.integration.spec.tsx`, `positions-page.spec.tsx`) |
| `npx vitest run src/app/pages/positions src/app/shared/theme/fonts.spec.ts src/app/shared/figure src/app/features/trading/positions` | **exit 0** — 38 files / 557 tests |
| `npx nx test @convexa/dashboard --skip-nx-cache -- src/app/pages/positions src/app/shared/theme src/app/shared/figure src/app/features/trading/positions` (the task's mandated targeted command) | **exit 0** — 53 files / 661 tests |
| `npm run typecheck` (cold — `dist`/`tsbuildinfo` deleted first per the documented stale-build-output trap, `tsconfig.app.json` rebuilt before `tsconfig.spec.json`) | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing (same set FE-5 recorded), **0 new** |
| `npx nx format:write --files <the 5 changed/new paths>` | **exit 0**, scoped |

**One real type error found and fixed during this task, recorded rather than silently patched
around.** The first `netPlTintSx` draft returned `SxProps<Theme>` and was spread into an `sx` ARRAY
(`sx={[{maxWidth:320}, netPlTintSx(...)]}`) — `tsc --build` failed with TS2322 because `SxProps<Theme>`
itself admits arrays, and MUI's array-`sx` flattening type does not accept a nested array element.
Fixed by letting the function's return type infer (a plain object, one variant with the extra selector
key, one without) and merging it into a SINGLE `sx` object via spread (`sx={{ maxWidth: 320,
...netPlTintSx(tint) }}`) instead of an array — `tsc --build tsconfig.app.json` then `tsconfig.spec.json`
individually confirmed clean before the full `npm run typecheck` was trusted.

### 6. What was run in the app

`npm run ports:free` (clear) → `npm run dev` → signed up a throwaway account each time (`/positions` is
behind `RequireAuth`) via a real headless Chromium (Playwright), driving the UI rather than seeding
through RTL — genuine browser rendering against the real `cargo run` backend.

- **Signed out, 1280px:** `require-auth-wall` renders, naming the surface — confirmed unaffected by
  this task (no change here).
- **Signed in, no positions seeded at all (35a, F7), 1280px:** the header reads **`NET P/L (OPEN)` /
  `—`** — no number, no colour, exactly closing the shipped `+$0` green defect. `data-figure-state="empty"`
  confirmed via the DOM. Screenshot captured.
- **Signed in, two open positions seeded (`convexa.positions.v2`, the v3-anti-resurrection key removed
  in the same `page.evaluate` per the documented gotcha) whose contracts did not resolve against this
  dev backend's chain (35b, F8), 1280px and 393px:** the header reads **`NET P/L (OPEN)` / `unavailable`
  / `0 of 2 open marked`** at both widths — no bare `—`, no number, no tint, the mandatory-caption text
  present. `data-figure-state="unavailable"` confirmed. Screenshots captured at both widths; the card
  wraps to full width below the title at 393px with no overflow.
- **Not observed live:** the F4/F5 offline-retained/offline-bare arms. `page.route('**/api/stream/**',
  r => r.abort())` + reload + a 20s wait left `data-figure-state` at `unavailable` (the online arm) —
  the same class of limitation FE-3/4/5's own sessions already recorded against this real dev backend.
  These arms are covered instead by `netPl.spec.ts`'s two dedicated 35e tests (SB) plus the strengthened
  `AC-E17` integration test, which DOES reach `offline-retained` in the suite (via a stubbed
  `EventSource` + fake timers rather than the real backend's reconnect behaviour) and asserts the
  rendered `PauseIcon` and caption text directly.
- **A real rendered defect found only by this pass**, fixed in the same commit: the readout collapsed
  to a zero-width column at 1280px before `minWidth`/`flexShrink` were added (§2 above) — invisible in
  a screenshot, only caught by reading the bounding box.

Screenshots and the throwaway browser-driver scripts were written to the session scratchpad (one had
to land at the repo root first since the sandbox write-guard blocks the OS temp dir directly, then was
deleted before this commit — confirmed by `git status --porcelain` showing no `_tmp_*` file); the dev
server and its ports were torn down (`npm run ports:free`) before handing off.

### 7. `EXEMPT` map after FE-6

`shared/theme/fonts.spec.ts`'s `EXEMPT` map: **6 → 5** (`pages/positions/PositionsPage.tsx` removed,
live-checked before deletion). The five remaining entries are all FE-7's
(`features/trading/broker/{BrokerPositionRow,BrokerPositionCard,BrokerGroupHeader,ProvenanceHeader,
reassess}.tsx`), unchanged, confirmed still present and still violating by this session's own run.

---

## FE-7 — The Broker tab: register on its figures, `not provided` non-synonymy, read-only

**Landed:** 2026-09-07, one commit. **Criteria:** 23 (SB), 25 (SB, broker arm), 34 (SB), 29 (broker
sites). **GATE Z items: none** — buildable exactly as planned; two real defects found and fixed
in-lane, itemized in §2, neither invented product policy nor a scope change.

### 1. What shipped

| File | Change |
|---|---|
| `features/trading/broker/BrokerPositionRow.tsx` | `FactText`'s two literal branches (`not provided`/`unavailable`) now spread `...SANS_FACE` explicitly (§2's inheritance defect). `ModeledPl`'s value branch routes through `figureStateOf` + `faceFor` — `PauseMark` (an SVG, `aria-hidden`) replaces the literal `⏸ ` prefix inside a `Stack` that carries the SAME `data-testid="broker-pl"` and the SAME dim-on-drop opacity, now via `figureStateOf`'s `dim` output. The label Typography, `LegLines`, the row's own `structure_line_collapsed` cell and the `Mono` helper all re-point their face binding to `...MONO_FACE`. A new local `DASH` constant (a unicode escape, not a quoted literal glyph — see §3) replaces the one raw `'—'` comparison the needle-1 scan would otherwise flag as a false positive. |
| `features/trading/broker/BrokerPositionCard.tsx` | Same face re-point (`structure_line_collapsed`, `Meta`'s value cell) to `...MONO_FACE`; no other change — `FactText`/`ModeledPl` are imported, not duplicated, so the card inherits every fix above by construction. |
| `features/trading/broker/BrokerGroupHeader.tsx` | Local `const MONO` deleted; its six call sites (`CountClause`, `NetEntry`'s two, `GroupPl`'s figure and label, `LoneLegClause`) re-point to `...MONO_FACE`. `GroupPl`'s value branch gets the SAME `figureStateOf`/`PauseMark`/`Stack` conversion as `ModeledPl` — one member's figure, one group's figure, one decision, never two hand-rolled offline branches that could drift. |
| `features/trading/broker/ProvenanceHeader.tsx` | The `broker-as-of-stamp` Typography's face re-points to `...MONO_FACE`. |
| `features/trading/broker/reassess.tsx` | The advisory dialog's basis-line and JSON-preview faces re-point to `...MONO_FACE`. |
| `shared/theme/fonts.spec.ts` | This task's five `EXEMPT` entries deleted — the map is now **empty**, live-checked (every entry's file still exists and no longer violates before removal). |
| `features/trading/broker/{BrokerGroupHeader,BrokerTabPanel}.spec.tsx`, `brokerCrossTicker.integration.spec.tsx` | The four glyph-textContent assertions PLAN names re-point to querying the rendered `svg[data-testid="PauseIcon"]` icon, never the retired character — a negative assertion that only trivially passed after the glyph left `textContent` (e.g. `not.toContain('⏸')`) is re-pointed to a real check (`querySelector(...).toBeNull()`) so it still means something. |
| `features/trading/broker/genericOptionRow.spec.tsx` | New `describe` block naming criterion 25's "positive half" explicitly: `POS_NO_COST_BASIS` reaching both the modeled-P/L branch (`ModeledPl`) and the leg cost-basis branch (`LegLines`), each asserted `not provided`, never `not recorded` — the broker arm's own fixture-to-arm proof, alongside the shipped `ALL_ARMS` census (unchanged) and FE-5's sim-book arm (unaffected, cited not duplicated). |

### 2. Two real defects found and fixed, not merely converted around

**A closed-nine literal inheriting the Mono typeface via component nesting the raw-text scan cannot see (criterion 3, SB — cross-surface, Section A).** `FactText`'s literal branches (`not provided`, `unavailable`) never set their own `fontFamily` — they inherit whatever the CALLER established. Three call sites wrap `FactText` inside a `Mono`-styled ancestor (`LegLines`' Typography, `NetEntry`'s `broker-group-net` Typography, `BrokerPositionRow`'s `Mono` helper around `broker-net-entry`), so today a `not provided`/`unavailable` literal on those three cells renders in Plex Mono — the exact register inversion criterion 3 forbids. **The shipped `fonts.spec.ts` scan cannot catch this**: it is line-proximity based, and the component name is `Mono` (mixed case), which does not match the needle's case-sensitive `\bMONO\b` pattern — confirmed by grep before relying on the scan for anything here. Fixed at the source (`FactText` itself spreads `...SANS_FACE`), not at each of the three call sites, so no future `Mono`-wrapped `FactText` use can silently reintroduce it.

**A needle-1 false positive this task's own `DASH` fix would have created, caught before it shipped.** Naming the sentinel `const DASH = '—';` (the FE-5 idiom) still contains the raw quoted em dash character, and this file's imports (`MONO_FACE`, `PauseMark`, `SANS_FACE`, `figureStateOf`, `faceFor`) sit only lines away — the windowed scan flagged the DECLARATION itself as "a closed-nine member in a mono run," a self-inflicted version of the exact false-positive class FE-5's `BUILD_REPORT.md` §3 documents. Fixed by declaring `DASH` as a unicode escape (`'—'`) rather than a quoted literal glyph — verified at a Node REPL that it evaluates to the identical U+2014 character at runtime (so `leg.expiry_text !== DASH` is behaviourally unchanged), while the SOURCE TEXT the raw-text scan reads no longer contains the literal character between quotes. The file's own top docblock (pre-existing, not authored by this task) also fell inside the same import's window and repeated `not provided` in backticks — reworded without backticks (meaning unchanged) for the same reason.

### 3. Copy diffs — itemized (class 1 only, per PLAN)

| Site | Shipped | New |
|---|---|---|
| `BrokerPositionRow.tsx` (`ModeledPl`, was `:128`) | `{streamOffline ? '⏸ ' : ''}` prepended to the figure | `PauseMark` (the declared stroke icon) beside the figure, inside a `Stack` |
| `BrokerGroupHeader.tsx` (`GroupPl`, was `:215`) | `{streamOffline ? '⏸ ' : ''}` prepended to the figure | `PauseMark`, same shape |

Both are class (1) — a typographic truth mark replaced by the declared stroke icon; the sentence/label
around each figure is byte-identical. No other broker string changed. `data-testid="broker-pl"` /
`broker-group-pl` stay byte-identical, now on the wrapping `Stack` rather than the bare `Typography` —
a structural move, not a copy change, and `.textContent` for the FIGURE half is unchanged (`+$1000`
reads `+$1000` online and offline alike now, since the glyph never entered `textContent` at all).

### 4. Mutation proof — run red (verbatim), then reverted to green

**MUTATION PROOF L (criterion 25, SB).** Poisoned `brokerView.ts`'s `brokerFactText` (NOT an FE-7-owned
file — a temporary poison-and-revert on the pure function the proof targets, per PLAN, mirroring FE-2's
own precedent of poisoning a non-owned file for its mutation proof) to return `NOT_RECORDED` instead of
`NOT_PROVIDED` for `state: 'not_supplied'`.

- **Red (verbatim), two failures:** the shipped census —
  `AssertionError: expected 'SPY…cost not recordedQty1 ×Net entrynot providednot provided…' not to
  contain 'not recorded'` (`genericOptionRow.spec.tsx` "the string `not recorded` appears in NO broker
  state: no cost basis`) — and this task's own new positive-half test —
  `AssertionError: expected 'Short 1 × $500 Put · Dec 18 · cost no…' to contain 'not provided'`
  (`… LegLines renders 'not provided'`).
- **Restore:** poison reverted; `git diff -- .../brokerView.ts` = **0 lines** (confirmed by `git status
  --porcelain` showing the file absent, not merely `git diff` — it was never staged); re-ran
  `genericOptionRow.spec.tsx` + `brokerView.spec.ts` → **exit 0, 58/58**.

No proof above is a narrated `expect(true).toBe(true)`; the red text is copied from this session's
terminal.

### 5. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/features/trading/broker` (first run, before the four glyph-assertion re-points) | **exit 1** — 4 failed, exactly the sites PLAN named (`BrokerGroupHeader.spec.tsx:268`, `BrokerTabPanel.spec.tsx:293/301/302/314`, `brokerCrossTicker.integration.spec.tsx:173`) |
| `npx vitest run src/app/features/trading/broker` (after the re-points) | **exit 0** — 17 files / 292 tests |
| `npx vitest run src/app/shared/theme/fonts.spec.ts` (before the `DASH`-declaration false positive was found) | **exit 1** — 1 failed, naming `BrokerPositionRow.tsx` lines 17 (`not provided` in the docblock) and 33 (the `DASH` declaration itself) |
| `npx vitest run src/app/shared/theme/fonts.spec.ts` (after both fixes in §2) | **exit 0** — 14/14 |
| `npx vitest run src/app/features/trading/broker src/app/shared/theme src/app/shared/figure` | **exit 0** — 34 files / 428 tests |
| `npx nx test @convexa/dashboard --skip-nx-cache -- src/app/features/trading/broker` (the task's mandated targeted command) | **exit 0** — 17 files / 294 tests |
| `npm run typecheck` (cold — `dist`/`out-tsc` deleted, forced past the Nx cache with `--skip-nx-cache` on the dashboard target specifically to confirm it actually re-ran `tsc`, not just read a cache hit) | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing (same set FE-6 recorded), **0 new** |
| `npx nx format:write --files <the 10 changed paths>` | **exit 0**, scoped |

### 6. What was run in the app

`npm run ports:free` (clear) → `npm run dev` → signed up a throwaway account (the Broker tab is the
second tab of `/positions`, itself behind `RequireAuth`) via a real headless Chromium (Playwright).

- **Signed in, Broker tab, 1280px:** renders the shipped S1 `Connect your brokerage` gate — heading,
  the read-only guarantee sentence ("Convexa never places, changes, or cancels an order"), a single
  `Connect Webull` CTA, and the encrypted-keys footnote. No populated rows reachable without a real
  Webull credential (consistent with FE-5's own session finding); no entry/order/cancel affordance
  anywhere on the gate — visual confirmation of criterion 34's negative space, screenshot captured.
- **Not observed live:** every populated wire state (S2–S9), the two-axis degradation grid, and the
  register/figure conversions themselves — none reachable without a real broker credential in the time
  available. These are covered instead by the automated suite exhaustively: `broker.risk.spec.tsx`'s
  `it.each(ALL_ARMS)` sweep (11 wire arms) asserts the negative space on EVERY reachable state
  structurally, and `genericOptionRow.spec.tsx` / `BrokerTabPanel.spec.tsx` / `BrokerGroupHeader.spec.tsx`
  render the populated figures directly against typed fixtures rather than a live credential.
- **Criterion 34's "no new network call" half** is not independently re-tested by this task: FE-7
  touches zero data-fetching code (`useBrokerBook.ts`, `renderState.ts`, `grouping.ts`, `brokerView.ts`
  are all outside this task's diff — confirmed by `git diff --stat` naming only presentational files),
  so the shipped fetch-call scoping this criterion depends on is structurally unchanged, not merely
  re-asserted.

Screenshots and the throwaway browser-driver script were written to the repo root (the sandbox
write-guard blocks the OS temp dir directly) and deleted before this commit — confirmed by `git status
--porcelain` showing no `_tmp_*` file; the dev server and its ports were torn down (`npm run
ports:free`) before handing off.

### 7. `EXEMPT` map after FE-7

`shared/theme/fonts.spec.ts`'s `EXEMPT` map: **5 → 0**. The map is now **empty** — FE-14's own
assertion of this fact should read green without any further work from this phase's remaining tasks.

---

## FE-8 — Settings: register, `not set`, neutral confirmation, browser-only persistence, the scales

**Landed:** 2026-09-07, one commit. **Criteria:** 36 (SB), 39 (SB), 40 (SB), 41 (SB), 42 (SB), 43
(review), U-19, U-35 (settings half). **GATE Z items: none.** Two real defects found and fixed
in-lane (§2), plus one deliberate scope extension beyond the three "Owns" files (§3), both itemized
rather than hidden.

### 1. What shipped

| File | Change |
|---|---|
| `features/auth/copy.ts` | +1 line: `AUTH_COPY.settings.sessionResolving` (U-19's new sentence). |
| `features/auth/SettingsPage.tsx` | `PanelCard`'s `borderRadius: 2.5` (30px) → `1` (12px, the panel role, U-35). The save confirmation `<Alert severity="success">` → `severity="info"` (41), same testid/word. A new line above the Preferences fields, `{!auth.ready && <Typography data-testid="settings-session-resolving">}`, shown only while resolving (U-19). `onPersona`/`onTheme`/`commitTicker` wrapped in `try/catch`: `flashSaved()` only fires in the `try` (40); `commitTicker` defers its optimistic `setTickerDraft` until AFTER a confirmed write and reverts the draft to `settings.effective.defaultTicker` on failure. |
| `features/auth/RiskInputsSection.tsx` | Deleted the local `const MONO`; both inputs spread `faceFor(true)` (`@/shared/figure`) and carry `data-figure-register="mono"` (36, D-D). `placeholder="0"` → `placeholder="not set"` on both inputs (36 — a closed-nine member, `notANumber.ts:30`). Save confirmation `severity="success"` → `severity="info"` (41); the error alert (`:300`, unchanged) keeps `severity="error"`. |
| `features/auth/useSettings.ts` | `writeServer`'s `catch` now **re-throws** after `setSaveError('save_failed')` — a real pre-existing defect fix (§2). |
| `features/auth/useSettings.spec.tsx` | The one existing failure-path test updated to `await expect(...).rejects.toThrow('save_failed')`, matching the new contract. |
| `features/auth/AiKeySection.tsx`, `features/auth/BrokerageSection.tsx` | Their own save confirmations: `severity="success"` → `severity="info"` (§3 — scope note). Nothing else touched. |
| `features/auth/settings.register.spec.tsx` | **New** — 15 tests across criteria 36/39/40/41/42/U-19/U-35, four of them raw-source mutation guards. |

### 2. Two real defects found and fixed, not merely converted around

**A. Criterion 40 was unsatisfiable as shipped — a failed persona/theme/ticker write ALSO showed
"Saved".** `writeServer` (`useSettings.ts`) caught the PUT failure, set `saveError`, and returned
**without re-throwing**. Its three callers (`setPersona`/`setTheme`/`setDefaultTicker`) therefore
always resolved, so `SettingsPage.tsx`'s `onPersona`/`onTheme`/`commitTicker` — each written as
`await settings.setX(...); flashSaved();` — called `flashSaved()` **unconditionally**, showing the
"Saved" toast even on a failed write (gated only on `settings.serverBacked`, which a failed PUT never
flips). Verified at source before touching anything, then confirmed by writing the test FIRST (TDD
red: `settings-saved` was present after a forced `auth_unavailable` write). **Why the fix has to touch
`useSettings.ts` (outside FE-8's literal "Owns" list):** the caller's `settings` object is a **stale
JS closure** over the render that created the handler; `settings.saveError`, set inside `writeServer`
in a **later** render, can never be read by that closure no matter how the timing is arranged. The
only two ways to make the caller distinguish success from failure are (a) have the setter throw, or
(b) restructure state management entirely. (a) mirrors the file's OWN existing idiom
(`setRiskInputs` already throws on failure for exactly this reason) — applying an existing pattern
consistently, not inventing new policy. Fixed by re-throwing in `writeServer`'s catch; all three
callers now `try { await settings.setX(...); flashSaved(); } catch { /* saveError already renders */ }`.
`commitTicker` additionally had its own variant: it optimistically wrote `tickerDraft` **before** the
write settled, so a failed save left the draft showing the FAILED text forever (nothing else would
ever revert it, since `settings.effective.defaultTicker` — the only thing the sync `useEffect`
watches — never moves on a failed PUT). Fixed by moving the optimistic `setTickerDraft(norm)` into the
`try` block (after confirmed success) and explicitly reverting to `settings.effective.defaultTicker`
in the `catch`.

**B. AiKeySection.tsx / BrokerageSection.tsx also rendered a green "Saved" confirmation on the SAME
settings page — outside FE-8's literal "Owns" list, fixed anyway (§3).**

### 3. Scope note — the fix under (B) above, recorded rather than silently taken or silently skipped

PLAN's FE-8 "Owns" line names exactly `SettingsPage.tsx`, `RiskInputsSection.tsx`, `copy.ts`, and its
item 3 illustrates criterion 41 with exactly those two files' confirmations. But criterion 41 itself
reads: *"no chip, confirmation or readiness mark **on settings** renders in the direction-reserved
colours"* — plainly page-wide, and `AiKeySection`/`BrokerageSection` are two more `<Alert
severity="success">` confirmations rendered on that same `/settings` page (`grep -rln
'severity="success"' features/auth` found exactly these four files, no more). Both components are
**only** ever mounted from `SettingsPage.tsx` (confirmed: `grep -rln "AiKeySection\|BrokerageSection"
apps/dashboard/src/app --include=*.tsx` names three files total — themselves and `SettingsPage.tsx`),
so the fix carries zero risk of touching a surface outside settings. Leaving them unfixed would have
forced a choice between an SB test that is **vacuous** (scoped to only the two named files, silently
passing while two more violations render) or one that is **honest and fails** — neither of which is an
acceptable SB verification. The fix is the identical one-word mechanical change already applied twice
elsewhere in this same task (`severity="success"` → `severity="info"`); nothing else in either file
changed. Recorded here rather than either silently expanding scope with no note, or silently leaving
the criterion half-satisfied.

### 4. Mutation proof — run red (verbatim), then reverted to green

**MUTATION PROOF M (criterion 41, SB).** Restored `severity="success"` on `SettingsPage.tsx`'s save
confirmation (`git diff` confirmed this was the ONLY change).

- **Red (verbatim), 2 of 15 failed:**
  `AssertionError: expected 'MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation0
  MuiAlert-root MuiAlert-colorSuccess MuiAlert-standard …' not to match /colorSuccess|MuiAlert-
  standardSuccess/` (the rendered-confirmation test) and
  `AssertionError: SettingsPage.tsx still carries severity="success"` (the raw-source mutation
  guard) — both from `settings.register.spec.tsx`.
- **Restore:** poison reverted; `git diff -- SettingsPage.tsx` confirmed clean; re-ran
  `settings.register.spec.tsx` → **exit 0, 15/15**.

**Reviewer probe answered:** the save-**error** alert's own dedicated test
(`the save-error alert is untouched: severity="error" with its icon rendered`) stayed green
throughout the poison — it asserts `.MuiAlert-icon` presence and `colorError`/`standardError`
independently of the confirmation test, so the poison only broke the confirmation's own assertions,
confirming the confirmation is the *only* thing that lost its palette.

No proof above is a narrated `expect(true).toBe(true)`; both reds are copied from this session's
terminal.

### 5. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/features/auth/settings.register.spec.tsx` (new file, first run) | **exit 0** — 15/15 |
| `npx vitest run src/app/features/auth src/app/shared/theme/radius-scale.spec.ts` | **exit 0** — 11 files / 100 tests |
| `npx nx test @convexa/dashboard --skip-nx-cache -- src/app/features/auth src/app/shared/theme src/app/shared/figure` (the task's mandated targeted command) | **exit 0** — 27 files / 226 tests |
| `npm run typecheck` (cold — `dist`/`out-tsc`/`*.tsbuildinfo` deleted first, per the documented stale-build-output trap) | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing (same set FE-6/FE-7 recorded), **0 new** |
| `npx nx format:write --files <the 8 changed/new paths>` | **exit 0**, scoped (never a bare `format:write`) |

### 6. Copy diffs — itemized

| Site | Shipped | New | Class |
|---|---|---|---|
| `copy.ts` (`AUTH_COPY.settings`) | — | `sessionResolving: 'Checking your session — these controls unlock in a moment.'` | new honesty line, authorized by SPEC §4.4 ("one line states that the session is still resolving") |
| `SettingsPage.tsx` (confirmation) | word `Saved`, `severity="success"` | word `Saved` (byte-identical), `severity="info"` | palette only — no wording change |
| `RiskInputsSection.tsx` (confirmation) | word from `C.saved`, `severity="success"` | same word, `severity="info"` | palette only |
| `RiskInputsSection.tsx` (both inputs) | `placeholder="0"` | `placeholder="not set"` | closed-nine member replacing a pre-filled-looking number (`notANumber.ts:30`) |
| `AiKeySection.tsx` / `BrokerageSection.tsx` (confirmations) | `severity="success"` | `severity="info"` | palette only, same word |

No shipped sentence's wording, meaning or order changed anywhere in this task — settings copy is not
frozen by §2.7 (that freeze is scanner/positions/quiet-band only), so this table is exhaustive by
review rather than by scan.

### 7. What was run in the app

`npm run ports:free` (clear) → `npm run dev` → a Playwright-driven real headless Chromium signed up
**two** throwaway accounts (one per width; a shared-email scripting mistake — reusing one email
across two signups — was caught by the SECOND signup returning `409 email_taken`, fixed, re-run) →
`/settings`.

- **Signed in, 1280px and 393px:** all **five** panels reachable (Account, Preferences, Risk inputs,
  AI providers, Brokerage), `document.documentElement.scrollWidth > innerWidth` **false** at both
  (no page-body overflow, criterion 37A). Clicking the theme toggle produced the "Saved" confirmation
  rendered with class `MuiAlert-colorInfo` (never `colorSuccess`) at both widths — screenshots
  captured. `risk-inputs-account-size` carries `placeholder="not set"` and
  `data-figure-register="mono"` at both widths, rendered visibly in a distinct (monospace) face from
  the surrounding Sans text.
- **Signed out, 393px (the first, mis-scripted run before the email-collision fix):** incidentally
  also confirmed criterion 37A/39 in the anonymous state — five panels reachable, no overflow, the
  `Stored in this browser.` subtitle rendered, `Saved to your account.` absent from the DOM.
- **Not observed live:** the save-**error** Alert (forcing a real `PUT /api/auth/settings` failure
  against the dev backend was not attempted — it is not exposed by any dev-server flag) and the U-19
  session-resolving line (who-am-I resolves in well under a frame against a local backend, too fast
  to observe by eye). Both are covered instead by the automated suite: the error-alert tests drive
  `settingsWrite: 'auth_unavailable'` through `testBackend.ts`, and the U-19 test holds the
  `/api/auth/session` fetch pending via a controlled, never-auto-resolving `Promise` until the
  assertion runs, then resolves it and confirms the line disappears.

Screenshots and the throwaway browser-driver script were written to the repo root (the sandbox
write-guard blocks the OS temp dir directly, same as FE-6/FE-7) and deleted before this commit —
confirmed by `git status --porcelain` showing no `_tmp_*` file; the dev server and its ports were torn
down (`npm run ports:free`) before handing off.

### 8. `EXEMPT` map after FE-8

Unchanged — FE-8 touches `features/auth/`, which is outside N-1's three scanned trees
(`features/trading/`, `pages/positions/`, `pages/scanner/`) by the criterion's own stated scope.
`shared/theme/fonts.spec.ts`'s `EXEMPT` map stays **0** (confirmed still empty by this session's own
run); `pauseGlyph.spec.ts`'s stays **0**. Criterion 1's register conversion on `RiskInputsSection.tsx`
is proven instead by this task's own component assertions (`settings.register.spec.tsx`'s
`data-figure-register="mono"` + raw-source guard) — recorded per PLAN's note as FE-14 item 9.

---

## FE-9 — Alerts store: the read-fault latch (loss-free), and the pre-phase blob proof

**Landed:** 2026-09-07, one commit (`fix`, per the lane rule — this repairs a shipped defect).
**Criteria:** 51 (SB), 52 (SB), 70 (SB), N-5 (store half). **GATE Z items: none** — buildable exactly
as planned. **Copy diffs: none.** This task precedes FE-10 (any alerts UI change), per the ordering
constraint.

### 1. What shipped

| File | Change |
|---|---|
| `features/alerts/store.ts` | New module-level `let readFaulted = false;`, set **only** in `readAlerts()`'s catch branch (`JSON.parse` failure). `persist()` now skips `localStorage.setItem` while `readFaulted` is true — it still updates `memory` and still calls `notify()`, so the current session keeps working. New export `alertsReadFaulted()` for the UI (FE-10). New test-only `__resetAlertsMemory()` (mirrors `features/trading/positions/store.ts`'s own `__resetMemory` idiom). `ALERTS_KEY`, `AlertsState`, `AlertEvent` — untouched; `message` is never deleted. |
| `features/alerts/store.spec.ts` | **New** — 9 tests across all four required cases (a–d) plus two extra checks (durable-shape stability, non-object-JSON never throwing). |

### 2. The live breach, closed

Verified at source before touching anything (matching the PLAN's own citation): `store.ts`'s
`readAlerts()` catch branch degraded to `empty()` on a parse failure — correct so far, nothing
written — but the **next** `upsertRule` / `pushEvent` / `setNotifyBrowser` called `persist()`, which
unconditionally `setItem`s the degraded-to-empty state over the **same key** the corrupt blob still
occupied, permanently destroying whatever was recoverable in it. `resolveDurable`'s "never delete
old" guarantee (the shared durable-store idiom) never applied here, because this store reads one key
and writes the same one, not two. The latch closes exactly that path and nothing else: `readAlerts`
is otherwise byte-identical, and the four `Array.isArray` guards (rules/events shape tolerance) are
untouched — a **parseable-but-wrong-shaped** value (e.g. the bare JSON number `42`, tested explicitly)
degrades its fields via those existing guards **without** latching, because no `JSON.parse` exception
was thrown. Only a genuine parse failure latches, matching the criterion's own wording ("an
**unreadable** alerts blob").

### 3. Mutation proof — run red (verbatim), then reverted to green

**MUTATION PROOF N (criterion 52, SB).** Removed the `if (!readFaulted)` guard from `persist()`
(replaced with an unconditional block, `MUTATION_POISON` comment attached).

- **Red (verbatim), 2 of 9 failed** — both against the **raw stored string**, not the parsed object
  (the reviewer probe's own question, answered: an assertion on the parsed value cannot see the
  overwrite):
  `AssertionError: expected '{"schema_version":1,"rules":[{"id":"a…' to be '{not json, and definitely
  not an Aler…' // Object.is equality` (the MUTATION PROOF N target test) and
  `AssertionError: expected '{"schema_version":1,"rules":[{"id":"f…' to be '{ broken' // Object.is
  equality` (the "stays latched across repeated writes" case-(c) test) — both show the corrupt
  original overwritten with a freshly-serialized `AlertsState`, exactly the loss path this task
  closes.
- **Restore:** poison reverted; `grep -n MUTATION_POISON store.ts` → **0 hits** (exit 1); re-ran
  `store.spec.ts` → **exit 0, 9/9**.

No proof above is a narrated `expect(true).toBe(true)`; both reds are copied from this session's
terminal.

### 4. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/features/alerts/store.spec.ts` (new file, first run) | **exit 0** — 9/9 |
| `npx vitest run src/app/features/alerts` | **exit 0** — 2 files / 12 tests (`evaluate.spec.ts` unaffected, `store.spec.ts` new) |
| `npx nx test @convexa/dashboard --skip-nx-cache -- src/app/features/alerts src/app/pages/alerts` (the task's mandated targeted command) | **exit 0** — 2 files / 12 tests |
| `npm run typecheck` (cold — `dist`/`out-tsc`/`*.tsbuildinfo` deleted first) | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing (same set FE-6/7/8 recorded), **0 new** |
| `grep -rln "FE-9" apps/dashboard/src --include=*.spec.*` (gotcha 10) | Named 5 files; 4 are a DIFFERENT feature's task numbering (`curvature-v2-desk-and-read` FE-9 — `DecisionCard.spec.tsx`, `readLayout.render.spec.tsx`, `readLayout.spec.ts`, `AppShell.keyboard.spec.tsx`, confirmed by reading each citation), the fifth is this task's own new `store.spec.ts`. No `EXEMPT` map names this task's FE-9 — no further action. |
| `npx nx format:write --files <the 2 changed/new paths>` | **exit 0**, scoped |

### 5. Fixture provenance (criterion 51/70)

`prePhaseBlob()` is authored directly from the shipped `AlertsState`/`AlertRule`/`AlertEvent` shapes
(`types.ts:10-45`, unchanged by this task) — the literal shape "the shipped writer" would have
produced before this phase, per PLAN's own instruction ("an old shape from git history or the shipped
writer"). Since **no shape change ships this phase** (criterion 51 is a no-op migration, not a version
chain), a fixture built from the current shape IS a pre-phase fixture; there is no second shape to
diff against. It carries one disabled rule and one already-read event specifically to prove `enabled`
and `read` round-trip exactly as saved, not merely that the read doesn't throw.

### 6. `EXEMPT` map after FE-9

Unchanged — this task touches `features/alerts/store.ts`, outside N-1's three scanned trees. Both
maps confirmed still **0** by this session's own run (`fonts.spec.ts`, `pauseGlyph.spec.ts`).

---

## FE-10 — Alerts page: closed lookups, thresholds by type, unread off the coloured edge, three empties

**Landed:** 2026-09-07, one commit (`fix` — repairs three shipped defects: the hidden price
threshold, the fabricated `≥ 60`, the colour-only unread state, plus one found in-lane, §2).
**Criteria:** 44 (SB), 45 (SB), 46 (SB), 47a (SB), 47c (review), 47d (SB), 48, 49 (SB), 50, N-5,
U-23a, U-24, U-27. **GATE Z items: none** — buildable exactly as planned. **Depends on FE-9**,
landed after it, per the ordering constraint (the latch before any alerts UI change).

### 1. What shipped

| File | Change |
|---|---|
| `features/alerts/labels.ts` | **New.** `KINDS`/`LEVELS` (moved verbatim from `AlertsPage.tsx`) plus `KIND_LABEL`/`LEVEL_LABEL` record maps and `NOT_SET`. One source, two consumers (U-23a). |
| `features/alerts/evaluate.ts` | The `level_touch` firing's label now reads `LEVEL_LABEL[rule.level]` instead of `(rule.level ?? 'level').replace('_', ' ')` — a firing and its rule row read the SAME closed-lookup word (U-23a). The `price` arm is unchanged (`$${thr}`, a real value, not a label). |
| `features/alerts/evaluate.spec.ts` | **Edited** (PLAN's own note) — one existing assertion kept (case-insensitive, still passes with `Gamma flip`), one new test pins the exact label byte-for-byte, one new test pins the price arm is untouched by the label change. |
| `features/alerts/useAlerts.ts` | New module-level `evaluatedThisSession` flag, set in `evaluateSnap`, exposed as `hasEvaluated` (criterion 48's third empty — ephemeral, no durable key). New `notifyPermission` state (`NotificationPermission \| 'unavailable'`), reconciled on mount and after every `requestBrowserPermission` call; the returned `notifyBrowser` is now `notifyPermission === 'granted' && state.notifyBrowser` — computed from the ACTUAL permission, never trusted from the stored flag alone (criterion 50, §2 below). |
| `pages/alerts/AlertsPage.tsx` | Full rewrite of the rule-summary line (four arms per §4.5), the unread marker (label + type, edge kept redundant), the events-empty split (`hasEvaluated`), the notify-permission explain line, the N-5 faulted posture (a local `AlertsRefused`/`AlertsFaultedBanner` pair mirroring `FaultedBanner.tsx`'s attribute set), the U-24 disclosure lines, and U-27's `timeZoneName: 'short'`. The price-threshold composer field gains a `$` `InputAdornment` (47c). |
| `pages/alerts/alerts.risk.spec.tsx` | **New** — 23 tests across every criterion this task owns, two of them the required mutation-proof targets. |

### 2. Three real defects found and fixed, not merely converted around

**A. A price threshold never rendered at all (47a) — written at `:48` (composer), evaluated at
`evaluate.ts:110`, absent from the summary line entirely.** A trader who set a price-threshold rule
had no way to see what price they'd set. Fixed: the summary's `level_touch` arm now branches on
`rule.level === 'price'` FIRST, rendering `Price threshold: $500` in the Mono register — the same
`TracedValue` component the score-gate arm uses, so a threshold can never drift between the two
render paths.

**B. The score-gate summary fabricated `≥ 60` for a rule whose record holds no minimum (46).** The
old line, `≥ ${r.scoreMin ?? 60}`, asserted a number the STORED RULE never carried — a `60` that
exists nowhere in `AlertRule` (`types.ts:22`, `scoreMin?: number`, no default). Fixed: the summary
renders the closed-nine `not set` when `scoreMin` is absent, never a substitute number.

**C. The unread state was carried by the coloured left edge ALONE (44) — invisible in a
black-and-white screenshot, the exact failure the canon Banned row names ("Accent-bar stat tiles").**
Fixed: an uppercase "Unread" word in the label row plus a font-weight difference on the message
itself (700 vs 400); the coloured edge stays, now redundant rather than load-bearing.

**D. Found in-lane, not planned: the stored `notifyBrowser` flag could read stale-`true` after the
trader revoked the browser's notification permission (criterion 50).** `useAlerts.ts`'s shipped
mount effect only ever SET the flag to `true` on a granted permission; nothing ever corrected it
back to `false` if the permission was later revoked (this app has no event to observe a revocation),
so the button could keep reading "Browser notify on" for a permission the browser no longer grants —
exactly what criterion 50 forbids ("the control never reads as 'on' for a permission the browser did
not grant"). Fixed by computing the returned `notifyBrowser` from `notifyPermission === 'granted' &&
state.notifyBrowser` rather than the stored flag alone — the ACTUAL permission is now the final
word, every render, with no dependency on an effect having already run.

### 3. Copy diffs — itemized (alerts copy is not frozen by §2.7; the criteria in §3 E/§4.5 govern)

| Site | Shipped | New |
|---|---|---|
| Rule label | `${r.symbol} · ${r.kind}` (raw wire token) | `${r.symbol} · ${KIND_LABEL[r.kind]}` (45) |
| Score-gate summary | `≥ ${r.scoreMin ?? 60}` | `Score gate: ≥ ${scoreMin}` or `Score gate: not set` (46, 47b) |
| Level-touch (price) summary | absent entirely | `Price threshold: $${priceThreshold}` or `Price threshold: not set` (47a, new) |
| Level-touch (structure) summary | `r.level ?? 'level'` (bare word) | `LEVEL_LABEL[r.level]` or `not recorded` (47d) |
| Tier-change summary | `any tier transition` | byte-identical |
| Unread marker | (none — colour only) | `Unread` word, uppercase, in the label row (44, new) |
| Firing timestamp | `toLocaleString()` | `toLocaleString(undefined, { timeZoneName: 'short' })` (U-27) |
| Recent-list disclosure | (none) | `Stored in this browser only — not synced to your account or across devices. Firings recorded before this update keep their original wording; new firings use the labels above.` (U-24, new) |
| Events-empty (never evaluated) | one shared sentence for both empty states | `No snapshot has been evaluated yet this session — open a ticker so rules can evaluate.` (48, new) |
| Events-empty (evaluated, nothing fired) | (same shared sentence as above) | `No firings yet — open a ticker so a new snapshot can be evaluated against your rules.` (48, new) |
| Rules-empty | `No rules yet — add a score gate on SPY to try the path.` | byte-identical (48) |
| Notify explain (denied) | (none) | `Browser notifications are blocked for this site. Alerts still show here, but nothing pops from the browser.` (50, new) |
| Notify explain (unavailable) | (none) | `Browser notifications aren't available in this browser.` (50, new) |
| Faulted banner (N-5) | did not exist on this surface | four blocks mirroring `FaultedBanner.tsx`'s shape, worded for alerts (new, N-5) |
| Level-touch firing label (`evaluate.ts`) | `(rule.level ?? 'level').replace('_', ' ')` | `LEVEL_LABEL[rule.level]` — same words the rule row reads (U-23a) |

Stored `message` strings on existing events are **never** rewritten — `AlertEvent.message` is
untouched by this task, and the Recent list renders it verbatim (U-23a), confirmed by a dedicated
test.

### 4. Mutation proofs — both run red (verbatim), then reverted to green

**MUTATION PROOF O (criterion 46, SB).** Restored `≥ ${rule.scoreMin ?? 60}` on the score-gate
summary arm (poison comment attached).

- **Red (verbatim), 1 failed:** `Expected element to have text content: "Score gate: not set" /
  Received: "Score gate: ≥ 60"` — the absent-`scoreMin` rule fixture rendering the fabricated
  default the record does not hold.
- **Restore:** poison reverted; `grep -n MUTATION_POISON AlertsPage.tsx` → 0 hits; re-ran
  `alerts.risk.spec.tsx` → **exit 0, 23/23**.

**MUTATION PROOF P (criterion 44, SB).** Disabled the "Unread" label (`{false && (...)}`) and
equalized both cards' font-weight to 400 — read/unread now differ ONLY by the edge colour.

- **Red (verbatim), 2 failed:** `Unable to find an element by: [data-testid="alerts-event-unread-
  label"]` (the label-presence test) and `expected 'A12/31/1969, 4:00:00 PM PST' to match /Unread/`
  (the black-and-white DOM-content test, run against the two cards' `textContent` with every colour
  class present but ignored) — proving the distinction had collapsed to the coloured edge alone.
- **Restore:** poison reverted; `grep -n MUTATION_POISON AlertsPage.tsx` → 0 hits; re-ran
  `alerts.risk.spec.tsx` → **exit 0, 23/23**.

**Reviewer probe answered:** `≥ 72` renders with no unit suffix in every passing test (asserted as
an exact string, `'Score gate: ≥ 72'`, never a regex tolerant of a trailing token), and the
absent-level test asserts BOTH that `not recorded` is present AND that the bare word `level` (word
boundary, case-insensitive) is absent from the same node.

No proof above is a narrated `expect(true).toBe(true)`; both reds are copied from this session's
terminal.

### 5. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npx vitest run src/app/pages/alerts/alerts.risk.spec.tsx` (new file, first run) | **exit 0** — 23/23 |
| `npx vitest run src/app/features/alerts/evaluate.spec.ts` (edited file) | **exit 0** — 5/5 |
| `npx vitest run src/app/pages/alerts src/app/features/alerts` | **exit 0** — 3 files / 37 tests |
| `npx nx test @convexa/dashboard --skip-nx-cache -- src/app/pages/alerts src/app/features/alerts` (the task's mandated targeted command) | **exit 0** — 3 files / 37 tests |
| `npm run typecheck` (cold — `dist`/`out-tsc`/`*.tsbuildinfo` deleted first) | **exit 0** |
| `npm run lint` | **exit 0** — 0 errors, **5 warnings**, all pre-existing (same set FE-6/7/8/9 recorded), **0 new** |
| `grep -rln "FE-10" apps/dashboard/src --include=*.spec.*` (gotcha 10) | Named only this task's own two files (`evaluate.spec.ts`, `alerts.risk.spec.tsx`) — no stray `EXEMPT` map. |
| `npx nx format:write --files <the 6 changed/new paths>` | **exit 0**, scoped |

### 6. What was run in the app

`npm run ports:free` → `npm run dev` → a Playwright-driven real headless Chromium, `/alerts` against
the real `cargo run` backend (no sign-in required on this page).

- **1280px and 393px, three rule types added (score gate `≥ 72`, price threshold `$500`, structure
  level `Call wall`):** all three summary lines rendered exactly as the criteria require —
  `Score gate: ≥ 72`, `Price threshold: $500`, `Call wall` — the two Mono values visibly in a
  distinct (monospace) face from the surrounding Sans text in the screenshot. No page-body overflow
  at either width (`scrollWidth > innerWidth` false both times).
  **A genuinely unplanned, real confirmation of criterion 50**: this headless Chromium's default
  `Notification.permission` for a fresh context reports **denied**, so the shipped page rendered
  `Browser notifications are blocked for this site. Alerts still show here, but nothing pops from
  the browser.` without any test-only stubbing — the denied state is not merely unit-tested, it was
  observed live.
- **A real firing, driven by the real dev backend:** added a `score_gate` rule with a low threshold,
  visited `/ticker/SPY`, waited for a structure poll, returned to `/alerts`. `Recent (1)` rendered a
  genuine firing — `UNREAD` label, bold message `SPY score ≥ 1 (now 69)`, detail `tier actionable`,
  timestamp `9/7/2026, 4:01:37 PM PDT` (the `PDT` zone name rendered live, confirming U-27 in a real
  browser, not just jsdom's `Intl`). `Mark 1 read` appeared, matching `a.unread > 0`'s gating.
- **Not observed live:** the N-5 faulted posture (forcing a real unreadable `localStorage` blob
  against a live page reload was not attempted — the automated `store.ts` corruption is direct and
  exhaustive) and the `granted` notify-permission arm (the real browser defaulted to `denied`, not
  `default`, so the request-flow's grant path was not exercised live). Both are covered instead by
  `alerts.risk.spec.tsx`'s dedicated tests (a stubbed `Notification` class for `granted`/`denied`,
  and a corrupted `localStorage` write for the faulted census).

Screenshots and the throwaway browser-driver scripts were written to the repo root (the sandbox
write-guard blocks the OS temp dir directly, same as FE-6/7/8) and deleted before this commit —
confirmed by `git status --porcelain` showing no `_tmp_*` file; the dev server and its ports were
torn down (`npm run ports:free`) before handing off.

### 7. `EXEMPT` map after FE-10

Unchanged — this task touches `features/alerts/` and `pages/alerts/`, outside N-1's three scanned
trees. Both maps confirmed still **0** by this session's own run.

### 8. Full dashboard suite after FE-10 (mandated) — run TWICE, one flaky worker crash recorded

Per the lane rule: *"an Nx 'flaky worker crash' with no named failure is re-run once and both
results recorded."*

- **Run 1:** `npx nx test @convexa/dashboard --skip-nx-cache` → **exit 1**, **237/238 files passed**.
  The one failed file, `shared/theme/stage3-amber.spec.ts`, threw
  `Error: ENOENT: no such file or directory, open
  '…\apps\dashboard\src\app\_mutation_poison_replay_outcome_join.ts'` — **not a named test
  assertion failure**. Traced to source: `replay-outcome-join.structural.spec.ts:195-198` (an
  UNRELATED, pre-existing file this task never touches) writes a temporary poison file at exactly
  that path as part of ITS OWN mutation test, then deletes it; `stage3-amber.spec.ts` eagerly
  `import.meta.glob`s every `.ts` file under `src/app/**`. Under parallel workers the two raced: the
  poison file existed at glob-collection time and was gone by transform time. Confirmed environmental,
  not logical: `npx vitest run src/app/shared/theme/stage3-amber.spec.ts
  src/app/replay-outcome-join.structural.spec.ts` in isolation → **exit 0, 32/32**, both files, same
  session.
- **Run 2:** `npx nx test @convexa/dashboard --skip-nx-cache` → **exit 0**, **238/238 files, 2844/2844
  tests**. Nx's own output flagged this pairing as a **detected flaky task**, corroborating the
  isolation-run diagnosis independently.
- **Test-count arithmetic, so the delta is auditable:** run 2's 2844, against the phase's running
  total after FE-9 (not independently re-measured this session, carried from FE-1–FE-9's own
  reports) — this session's own additions are **+15** (`settings.register.spec.tsx`, FE-8) **+9**
  (`store.spec.ts`, FE-9) **+23** (`alerts.risk.spec.tsx`, FE-10) **+2** (`evaluate.spec.ts`'s two new
  tests, FE-10) = **+49** new tests across FE-8/9/10, plus whatever FE-1–FE-7 already added. No
  shipped test was deleted or weakened in any of the three tasks this session landed.

---

## FE-11 — The quiet band: register, container steps, the two copy sites, the proximity chip

**Landed:** 2026-09-07, one commit. **Criteria:** 53 (SB), 54 (SB), 56, 56a, 57, 57b, 58 (SB), 59
(SB), 61, 7a/8 (quiet-band containers — satisfied by absence, see §4 below). **GATE Z items: none.**

### 1. What shipped

| File | Change |
|---|---|
| `pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx` | Deleted the local `MONO`; the block print (`N sh @ $price`) now resolves through `figureStateOf`/`faceFor` (`@/shared/figure`), carrying `data-figure-state`/`data-figure-register`. The proximity chip (`:85-89` shipped) — hover-only, outside ruling 6's four fixed widgets — gained the file-local `Tooltip describeChild` + `tabIndex={0}` + `aria-describedby` + visually-hidden-description idiom (criterion 59); `PROXIMITY_TOOLTIP` wording byte-identical. No size/layout/order change. |
| `pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx` | Deleted the local `MONO`. The row's two figures are now resolved separately: the strike+ratio head (`$strike · Vol/OI N×`, always present) and the contract count (which can be absent). The absent-volume token is lifted out of the mono run into its **own Sans span at the row's 12px** (never `FigureCell`'s 15px literal) — this is the one real register-shape defect the task named (`'—'` used to render *inside* the mono `Typography`). |
| `pages/ticker/widgets/_kit/copy.ts:361-362` | `MC_CELL_EMPTY` split (criterion 56a): was `'unavailable this cycle'` sitting in a figure value slot; now the value is `'unavailable'` (the closed-nine member) and a new `MC_CELL_EMPTY_CAPTION = 'this cycle'` carries the this-cycle meaning as the figure's own caption, exactly as `design/src/components/figure-cell.mjs:40` draws the Unavailable state. |
| `pages/ticker/widgets/market-context/MarketContext.tsx` | New `EmptyFigureCell` component renders the split: value line through `figureStateOf({value: MC_CELL_EMPTY, register: 'traced'})` (Sans, `data-figure-state="unavailable"`) + a separate caption line for `MC_CELL_EMPTY_CAPTION`. Wired at the three sites that used the old single sentence — `ShapeCard`'s concentration/balance rows (`LabelRow`, detected via `emptyText === MC_CELL_EMPTY`) and every `AtrRow` horizon. The four look-alike widgets' own `const MONO = typographyTokens.monoFontFamily` (`:114`) and every other scalar line are **untouched** — `lookalikes.spec.ts` still finds it. |
| `pages/ticker/widgets/setups/Setups.tsx` | `setups === undefined` (never delivered) now renders its own sentence, `Alert severity="info"`, `Setups unavailable this cycle.`; `setups.length === 0` (checked and empty) keeps the shipped `No clean setup right now.` byte-for-byte. U-30 (`.toUpperCase()`) untouched, as withdrawn debt. |
| new `pages/ticker/widgets/quiet-band.register.spec.tsx` | 12 tests: criterion 58's live-mark source scan over all eight widgets (with its own mutation guard); OffExchangeBlocks' stated-register + source-scan-for-MONO tests; the proximity chip's keyboard-focus reveal; FreshPositioning's populated-vs-absent register split (including the criterion-54 DOM scan used for mutation proof Q); MarketContext's value/caption split; Setups' three states. |

**Zero desk-spec edits.** `lookalikes.spec.ts:22-27,47-55` was not touched and stays green — neither
converted widget is on its exemption list, and the four look-alikes (`IvRank`, `MarketContext`,
`StraddleMove`, `DealerFlowProjection`) keep binding `typographyTokens.monoFontFamily` by hand for
every scalar line the plan left unconverted. `MarketContext.spec.tsx`'s own five-level null matrix
(`:155,261`) needed **no edit**: it imports `MC_CELL_EMPTY` as a reference, not a literal, and
`EmptyFigureCell` still renders that string as its own leaf text node, so `getByText(MC_CELL_EMPTY)`
resolves unchanged.

### 2. `term-structure` and `setups` (list-empty arm), and the explicit non-goal

`term-structure` carries no DOM figure (`TermHeatChart.tsx:105-106` paints
`${p.atm_iv.toFixed(1)}%` onto a `<canvas>` with a hard-coded `'600 10px "IBM Plex Mono"'` — no
`data-figure-register` and no DOM assertion can reach it; named here per SPEC's own explicit
non-goal, not left to read green under 53/54). `setups`'s populated-list card body (name, conviction
chip, rationale) carries no figure either — only its two empty-state sentences changed.

### 3. Copy diffs — itemized (the closed two-site set, 56a)

1. `_kit/copy.ts:361` `MC_CELL_EMPTY`: `'unavailable this cycle'` → `'unavailable'` (value slot) +
   new `MC_CELL_EMPTY_CAPTION = 'this cycle'` (caption slot). Rendered at the three sites named in
   §1 above. The `*_WHOLE_EMPTY`/`*_ROW_EMPTY` prose family (`copy.ts:346-354`) — full sentences at
   the sub-card and label-row levels — is **untouched**, byte-identical.
2. `Setups.tsx:31-56`: `undefined` now renders `Setups unavailable this cycle.` (new); `[]` keeps
   `No clean setup right now.` (unchanged, byte-for-byte). Nothing else in the widget's copy moved.

No third site touched — verified by re-reading every string literal changed in the diff (`git diff`
on the five source files above shows exactly these two sentence changes and the register-attribute
plumbing; no other JSX text content differs).

### 4. Criteria 7a/8 — satisfied by absence, not by a new container (recorded rather than assumed)

Neither converted widget introduces a stepped (20/17/15-ladder) figure: `OffExchangeBlocks` and
`FreshPositioning` both keep their figures fixed at the row's shipped 12px (task instruction: "no
size, layout or order change") — they are 7b's off-ladder sites, not 7a's. `MarketContext`,
`IvRank`, `StraddleMove`, `DealerFlowProjection` are the four look-alikes, explicitly not converted
this task. `term-structure` and `setups` carry no DOM figure at all. **None of the eight quiet-band
widgets calls `theme.containerQueries('panel')`** — confirmed by
`grep -rn "containerQueries" apps/dashboard/src/app/pages/ticker/widgets` returning only
`FigureCell.tsx` (the one existing ladder host, already `PanelContainer`-wrapped by FE-6's
positions-header-readout work and by the shipped `ReadStrip.tsx` precedent) — so criterion 8's
"every panel that hosts a stepped figure" premise is vacuously true for this task's own files:
there is no stepped figure in the quiet band to host, and no second container name was introduced
anywhere this task touched (`git diff` shows zero occurrences of `containerName` in any of the five
changed files). Criterion 7a's rendered proof is FE-13's/FE-6's (positions), not owed here.

### 5. A discrepancy between PLAN's stated mutation-proof-Q expectation and the measured tree (recorded, not hidden)

PLAN's own text for MUTATION PROOF Q says *"Render `'unavailable'` inside the mono run of
`FreshPositioning.tsx`. The register test **and** `fonts.spec.ts` needle 1 must both go red."*
Measured at source before writing a single test: `shared/theme/fonts.spec.ts`'s `N1_SOURCES` glob
(`:186-193`) scopes to exactly three trees — `features/trading/**`, `pages/positions/**`,
`pages/scanner/**` — and **does not include `pages/ticker/widgets/**`**. PLAN's own Independence
table (`PLAN.md:1273`) agrees: FE-11's row lists only `pages/ticker/widgets/**` as an owned path,
with no `fonts.spec.ts` entry (contrast FE-3/5/6/7, each of which explicitly owns
`shared/theme/fonts.spec.ts` for its own `EXEMPT` removals). Consequently the poison below —
run for real, not asserted — turns `quiet-band.register.spec.tsx`'s own criterion-54 test **red**
while `fonts.spec.ts` stays **green**, exactly as the glob scope predicts. This session's own new
spec is therefore the actual enforcement mechanism for criterion 54 in the quiet band; N-1 was never
going to reach it. (The launch dispatch's own claim that "FE-11 touches N-1's scanned trees" does
not hold against either the shipped glob or PLAN's Independence table — recorded here rather than
silently acted on.)

### 6. Mutation proofs — both run red (verbatim), then reverted to green

| Proof | Poison | Red result (verbatim) | `fonts.spec.ts` in the same run | Restore |
|---|---|---|---|---|
| **Q** (criterion 54, SB) | `FreshPositioning.tsx`'s volume span: forced `data-figure-register="mono"` / `sx={{ ...faceFor(true), fontSize: 12 }}` regardless of whether the value was the absent-token `'—'` | `quiet-band.register.spec.tsx` **2 failed**: `expect(dash).toHaveAttribute('data-figure-register', 'sans')` → *"Received: data-figure-register=\"mono\""*; and the DOM scan — `AssertionError: expected '—' not to be '—'` (the closed-nine member `'—'` found inside a `[data-figure-register="mono"]` node) | `fonts.spec.ts` **exit 0, 14/14** — unaffected, confirming §5 above | reverted (`git diff` on the file after restore = 0 lines vs the committed version); `quiet-band.register.spec.tsx` back to **12/12** |
| **R** (56a) | `Setups.tsx`: reverted to the shipped single ternary (`setups?.length ? … : <Alert>No clean setup right now.</Alert>`), collapsing the `undefined`/`[]` arms back to one sentence | `quiet-band.register.spec.tsx` **1 failed**: *`TestingLibraryElementError: Unable to find an element with the text: Setups unavailable this cycle.`* — the `undefined` arm's own test (the `[]` arm's test still passed, since both arms then coincidentally render the same shipped sentence — exactly the collapse the criterion exists to catch) | not applicable (Setups carries no font-family binding) | reverted; **12/12** |

No proof above is a narrated `expect(true).toBe(true)`; both reds are copied from this session's own
terminal output.

### 7. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `cd apps/dashboard && npx vitest run src/app/pages/ticker/widgets/quiet-band.register.spec.tsx` | **exit 0**, 12/12 (first write, after the fixture-type fix noted below) |
| `cd apps/dashboard && npx vitest run src/app/pages/ticker/widgets src/app/shared/theme/fonts.spec.ts` | **exit 0** — **57 files / 795 tests** (baseline widgets-tree count + this task's 12 new + 3 pre-existing files' own count unaffected) |
| `cd apps/dashboard && npx vitest run src/app/pages/ticker` (whole surface, since this task touches shared desk chrome only indirectly) | **exit 0** — **73 files / 907 tests** |
| `npm run typecheck` (cold: `dist`/`out-tsc`/every `*.tsbuildinfo` deleted first) | **exit 0**. First cold run caught two fixture type errors in the new spec (missing `notional` on a `BlockPrintWire` fixture, missing `method` on an `AtrRead` fixture) — fixed, re-run cold, exit 0. This is exactly why criterion 68 requires the typecheck read separately: `nx test` was green throughout both states. |
| `npm run lint` | **exit 0** — 5 warnings, all pre-existing (4× e2e-config `no-explicit-any`, 1× `react-hooks/exhaustive-deps` in an unrelated file), **0 new** |
| `npx nx format:write --files <the six changed/added paths>` | **exit 0**, scoped |
| `grep -rln "FE-11" apps/dashboard/src --include=*.spec.*` (gotcha 10) | **8 files**, all opened and confirmed to cite the **prior feature's** own FE-11 (`curvature-v2-desk-and-read`'s `GexProfileChart` deletion / `StructureHeroPanel` consolidation) — a coincidental task-ID collision across features, exactly the shape gotcha 10 warns about. None reference this task. The whole `pages/ticker` suite (row above) was run anyway, as a superset. |

### 8. What was run in the app

`npm run ports:free` (clean) → `npm run dev` → real Chromium (Playwright, headless) against the live
dev backend, **not** a seeded/mocked page (no `/ticker/SPY`-style throwaway fixture exists for this
route the way `no-overflow.spec.ts` seeds `/positions`/`/alerts`).

- **Confirmed live, real DOM, real market data (`/ticker/IWM`, warm cache):** the `FreshPositioning`
  row's head figure and volume figure both carry `data-figure-register="mono"` /
  `data-figure-state="default"` in the production render — e.g. `"$264 · Vol/OI 1.82× · "` +
  `"11,888"` as two adjacent nodes, matching the jsdom assertions exactly. `MarketContext`, `Setups`
  and `OffExchangeBlocks` all mounted without a runtime error. **No horizontal page overflow** at
  either checked width — `document.body.scrollWidth === window.innerWidth` measured `true` at both
  **1280** and **393**.
- **Not reachable live, this session:** no currently-tracked symbol (`SPY`, `IWM`, `TSLA`, `AAPL`,
  `NVDA`, `MSFT`, `DIA`, `AMZN`, `META` — every symbol the dev backend had warm) carries a non-empty
  `off_exchange.blocks` array right now (checked directly against the API response for all nine), so
  the print/proximity-chip's **populated** row and the `MC_CELL_EMPTY` split's **degraded** ATR/shape
  rows were not observable live this session — real market data is simply fully populated for every
  bundle this backend currently holds warm. Both states are covered instead by
  `quiet-band.register.spec.tsx`'s own dedicated tests (the block-print register test with a
  synthetic fixture; the value/caption split test with a synthetic null-ATR pack) — matching the
  RESUME's own carried gotcha 8 pattern ("forcing a live state against the real dev backend is
  unreliable in lane time; the stub/fixture tests are the reliable coverage, the browser pass is for
  reachable states only"). `SPY` itself timed out on a cold options-chain fetch (a real, slow vendor
  call unrelated to this change) during this check; abandoned in favor of the already-warm symbols.
- Screenshots were captured at both widths (full-page); below-the-fold quiet-band widgets rendered
  as blank/skeleton placeholders in the screenshot pixels — this is `Widget.tsx`'s own pre-existing
  `content-visibility: auto` + `contain-intrinsic-size` off-screen-render-skip (`Widget.tsx:14-15`),
  not a defect introduced here; the DOM `evaluate()` query above bypassed the paint-skip and read
  the real attributes/text directly. `npm run ports:free` run again at the end; HEAD confirmed
  unchanged (`e25ff84b`) and the sibling `docs/research/…` directory confirmed untouched, both
  before and after.

---

## FE-12 — D-C: the `Widget` frame's ⓘ, the `AccessibleHelp` promotion, and AC-35 extended to eight frame roots

**Landed:** 2026-09-07, one commit. **Criteria:** U-32 (SB), 59 (frame half), 66 (this control).
**GATE Z items: none.**

### 1. A launch-anchor correction, checked before writing any code

The dispatch's own anchors claimed "ten consumer files" for `AccessibleHelp`, naming `PositionsPage.tsx`
first. Measured at source (`grep -rn "from '.*AccessibleHelp'" apps/dashboard/src/app`): **nine**
real importers — `ai-rec/{DecisionCard,GroundingNote,ProvenanceChip,reasoning}.tsx`,
`dealer-flow-projection/DealerFlowProjection.tsx`, `iv-rank/IvRank.tsx`,
`market-context/MarketContext.tsx`, `straddle-move/StraddleMove.tsx`, `_kit/FigureCell.tsx` —
matching PLAN.md's own "Owns" line exactly. `PositionsPage.tsx:197` mentions `AccessibleHelp` only
inside a **comment** ("a promotion `AccessibleHelp`'s own import…"), never an actual `import`
statement — confirmed by a second grep restricted to real `import`/`from` lines, which returns
nothing for that file. Proceeded with the nine PLAN itself names; recorded here rather than silently
re-pointing a file that never imported the component.

### 2. What shipped

| File | Change |
|---|---|
| `shared/ui/AccessibleHelp.tsx` | **new** — the component moved byte-for-byte from `pages/ticker/widgets/ai-rec/AccessibleHelp.tsx`: same props (`label`, `text`), same `aria-label`, same `stopPropagation` on click and focus, same `enterTouchDelay={0}`. Only the file's own doc-comment gained one paragraph documenting the promotion (§2.8). |
| `pages/ticker/widgets/ai-rec/AccessibleHelp.tsx` | **deleted**. |
| `shared/ui/index.ts` | `export { AccessibleHelp } from './AccessibleHelp';` added to the barrel. |
| The nine importers (`ai-rec/{DecisionCard,GroundingNote,ProvenanceChip,reasoning}.tsx`, `dealer-flow-projection/DealerFlowProjection.tsx`, `iv-rank/IvRank.tsx`, `market-context/MarketContext.tsx`, `straddle-move/StraddleMove.tsx`, `_kit/FigureCell.tsx`) | Re-pointed to `@/shared/ui` (the four same-directory `./AccessibleHelp` imports and the five `../ai-rec/AccessibleHelp` imports both become the barrel import) — **zero prop/behaviour change** at any call site. |
| `shared/ui/Widget/Widget.tsx` | `:245-249`'s bare `Tooltip` + `InfoOutlinedIcon` render replaced with `{info && <AccessibleHelp label={`About ${title}`} text={info} />}`; `InfoOutlinedIcon` import removed (no longer used); `AccessibleHelp` imported from `@/shared/ui/AccessibleHelp` (a same-package relative-style import, not the barrel, since `Widget.tsx` lives inside `shared/ui/` itself). This one change fixes all **eight** live `<Widget info=…>` sites by construction. |
| `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` | **extended**: a second, frame-scoped `FRAME_INFO_SITES` list (all eight `widget-{id}` frame roots — `off-exchange-blocks`, `fresh-positioning`, `market-context`, `dealer-flow-projection`, `term-structure`, `iv-rank`, `structure-hero`, `live-tape`) and a new `U-32 (SB)` describe block asserting the frame's own header ⓘ (tap, keyboard focus, Escape) at 393/834/900/1280 — reusing the shipped `assertTapAndKeyboardReveal`/`realisticTap` helpers verbatim. The shipped `HOVER_INFO_WIDGETS` list (the four look-alikes) and the `ladder-foot` assertion are **unchanged** and stay exactly as they were — they prove a different control (ruling 6's body affordances), not this one. The bundle fixture's `term_structure: null` became a populated fixture (§3) because `TermStructure.tsx`'s `info` prop is conditional on it. |
| `apps/dashboard-e2e/src/quality/manifest.json`, `tools/lib/manifest.mjs`, `tools/manifest.spec.mjs`, `src/quality/reporters/quality-reporter.ts` | Frozen browser-quality inventory bumped `86 → 90` (four new `test_id` entries for the U-32 describe block, `inventory_id` → `curvature-v2-surfaces-90-v1`) — required plumbing found only by actually running the extended spec (§4); not itemized in PLAN's own "Owns" line but mechanically necessary to extend `curvature-v2.spec.ts` without leaving the quality gate's own frozen self-check red. |

### 3. A second discrepancy found by running the extension, not by reading PLAN

`TermStructure.tsx`'s `info` prop is `info={termStructure ? termTip(termStructure) : undefined}` —
**conditional**, unlike the other seven sites' constants. The shipped e2e bundle fixture
(`curvature-v2.spec.ts:68`) carried `term_structure: null`, which would have made the
`widget-term-structure` frame ⓘ never render against that fixture — silently reducing "all eight
frame roots" to seven and passing anyway (the exact `[structural-over-prose-enforcement]` shape this
task's own poison exists to catch, one level up). Fixed by populating `term_structure` with the same
shape `ticker.risk.spec.tsx`'s own `TERM_FIX` fixture uses (`points`/`state`/`near_iv`/`far_iv`/
`slope`) — no other bundle field changed.

### 4. A third discrepancy: the quality-reporter's own frozen manifest (found only by running the e2e suite, not by reading PLAN)

Running the extended `curvature-v2.spec.ts` against the production build (first pass, before the
manifest fix) produced **4 reporter-thrown errors** — `Chromium manifest identity did not uniquely
match … U-32 … at 393px` (and 834/900/1280) — even though Playwright itself reported all 11 tests in
the file **passed**. `apps/dashboard-e2e/src/quality/manifest.json` pins a **frozen, closed**
inventory of every Chromium test's `(file, title_path, project)` triple; a new test not in that list
throws inside `QualityReporter.onTestEnd`, and the run's own `summary.json` recorded
`"status": "incomplete", "not_run": 4` — a real accounting gap for criterion 63's executed-case-list,
even though the tests themselves were green. Traced to three enforcement points that all pin the
count `86` and must move together: `manifest.json`'s `full_chromium.inventory_id` +
`tests` array, `tools/lib/manifest.mjs`'s `validateManifest` (a frozen-count check, the same shape as
FE-1's live-checked `EXEMPT` maps), and `tools/manifest.spec.mjs`'s own assertion — confirmed by
running `node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/mutations.spec.mjs`
**before** the fix (**1 failed** — `90 !== 86`) and **after** (**7/7 passed**). All four moved to
`86 → 90` / `curvature-v2-surfaces-90-v1` together, with the itemized-delta comment convention the
prior two bumps (`52 → 75`, `75 → 86`) already established.

### 5. Mutation proof S (U-32, SB — required by name) — run red, then reverted to green

| Poison | Where | Red result (verbatim) | Restore |
|---|---|---|---|
| Dropped the `About ` prefix: `label={`About ${title}`}` → `label={`Help: ${title}`}` in `Widget.tsx` | The single shared render site | Rebuilt production (`npx nx build @convexa/dashboard --configuration=production --skip-nx-cache`, exit 0) and re-ran `BROWSER_QUALITY_PREBUILD_STATUS=pass npx playwright test -c apps/dashboard-e2e/playwright.config.ts -g "U-32"` → **4 failed** (one per checked width). First failure, verbatim: `Error: widget-off-exchange-blocks frame ⓘ @ 393px is present` / `expect(locator).toBeVisible() failed … getByTestId('widget-off-exchange-blocks').getByRole('button', { name: /^About /i }).first() … Timeout 5000ms … element(s) not found`. Each of the four width tests fails at the FIRST site its own `for` loop reaches (`off-exchange-blocks`), so a single test run does not individually re-report all eight failures past that point — the **mechanism**-level proof closes that gap: `grep` confirms exactly ONE `<AccessibleHelp label={.../About/} />` render site in the whole tree (`Widget.tsx:245`), shared by construction across all eight `<Widget info=…>` call sites, and a static-bundle scan of the rebuilt `apps/dashboard/dist/assets/*.js` confirmed the poison string `'Help: '` landed in the single compiled chunk (`index-*.js`) that all eight widgets' `Widget` import resolves to — the SAME shared artifact, not eight independent ones. | Reverted (`git diff` on `Widget.tsx` after restore = exactly the two committed lines, confirmed); rebuilt production; re-ran `-g "U-32"` → **exit 0, 4/4 passed**; full `curvature-v2.spec.ts` re-run → **exit 0, 11/11**. |

No proof above is a narrated `expect(true).toBe(true)`; the red text is copied from this session's
own terminal.

### 6. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npm run typecheck` (cold: `dist`/`out-tsc`/every `*.tsbuildinfo` deleted first, including `apps/dashboard-e2e/out-tsc`) | **exit 0** |
| `npx nx typecheck dashboard-e2e --skip-nx-cache` | **exit 0** |
| `cd apps/dashboard && npx vitest run src/app/shared/ui/Widget/Widget.spec.tsx src/app/pages/ticker/widgets/{ai-rec,dealer-flow-projection,iv-rank,market-context,straddle-move,_kit}` (the nine importers' own trees) | **exit 0** — 36 files / 607 tests, zero behaviour change |
| The five desk specs U-32 names (`ticker-hierarchy.spec.tsx`, `single-motion-moment.spec.ts`, `live-dot-census.spec.tsx`, `LiveTape.spec.tsx`, `ticker-desk-composition.spec.tsx`) | **exit 0** — 5 files / 56 tests |
| `StructureHeroPanel.spec.tsx` (a coincidental `FE-12` grep hit, confirmed at source to be the PRIOR feature's own task numbering, gotcha 10) | **exit 0** — 12/12 |
| `npm run lint` | **exit 0** — 5 warnings, all pre-existing, **0 new** |
| `npx nx format:write --files <the 17 changed/added paths>` | **exit 0**, scoped |
| `node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/mutations.spec.mjs` | **exit 0** — 7/7 (1 failed before the manifest fix, §4) |
| `grep -rn "ai-rec/AccessibleHelp" apps/dashboard/src` (reviewer probe) | **zero lines** — including comments, reworded rather than left dangling |
| `grep -n "^import" shared/ui/Widget/Widget.tsx` (reviewer probe) | every import resolves under `@/shared/`, `@mui/`, or `react` — no `pages/`/`features/` import |
| `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` | **90 tests in 7 files** — matches the corrected manifest count exactly |
| `BROWSER_QUALITY_PREBUILD_STATUS=pass npx playwright test -c apps/dashboard-e2e/playwright.config.ts curvature-v2` (production build, twice — once before, once after the mutation-proof rebuild) | **exit 0, 11/11**, both times |
| `BROWSER_QUALITY_PREBUILD_STATUS=pass npx playwright test -c apps/dashboard-e2e/playwright.config.ts desk-and-read` (a coincidental `FE-12` grep hit — the PRIOR feature's own spec, run anyway since it also exercises the shared `Widget` frame) | **exit 0, 6/6** |

### 7. Copy diffs — none

FE-12 changes zero user-visible copy. The accessible name `About {title}` is new only in the sense
that it now reaches all eight sites uniformly; it already matched every shipped `AccessibleHelp`
call (`FigureCell.tsx:307`, ruling 6's five body sites).

### 8. What was run in the app

`npm run ports:free` → `npm run dev` → real Chromium (Playwright, headless) against the live dev
backend, `/ticker/IWM` (warm cache, confirmed fast — 0.01s for the ticker bundle).

- **Confirmed live, all eight frame roots, both 1280px and 393px:** `document.querySelector(`[data-testid="widget-${id}"] button[aria-label^="About "]`)` resolved for every one of `off-exchange-blocks`, `fresh-positioning`, `market-context`, `dealer-flow-projection`, `term-structure`, `iv-rank`, `structure-hero`, `live-tape`, with the exact accessible names (`About Off-exchange blocks`, `About Fresh positioning (Vol/OI)`, `About Market context`, `About Projected dealer flow`, `About Term structure`, `About IV rank`, `About IWM` — the hero's own `title` prop is the ticker symbol — and `About Live tape`). `straddle-move` also present, but with its own body-level `About the straddle-implied move` control (ruling 6's, not a frame ⓘ — it passes no `info` prop, exactly as SPEC records). Screenshots at both widths show the ⓘ rendering as a normal small circular info icon beside each widget's title, visually unchanged from the shipped bare-icon look (no size regression, no header overflow).
- No horizontal overflow observed at either width during this pass.
- Screenshots captured; below-the-fold quiet-band widgets again showed the pre-existing `content-visibility: auto` placeholder behaviour noted in FE-11's own report — unrelated to this task, not re-litigated here.
- `npm run ports:free` run again at the end; HEAD confirmed unchanged (`1714f533`, FE-11's commit) and the sibling `docs/research/…` directory confirmed untouched, both before and after.

---

## FE-13 — The browser layer: seeded pages, the executed case list, the rendered step, the touch floor

**Landed:** 2026-09-07, one commit. **Criteria:** 21 (SB), 37A, 62 (SB), 63 (SB), 64, 65, 66, 7a.
**GATE Z items: two** — the pre-existing `/positions` overflow at 900px (§3) and the two under-floor
alerts controls (§5), both product source, neither this lane's to fix.

### 1. What shipped

| File | Change |
|---|---|
| `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` | `seed()`'s options type gains `alerts?: 'seeded'`, writing a new `SEEDED_ALERTS` blob (two rules of different kinds — a `level_touch`/`price` threshold and a `score_gate` — three events, one unread) to `convexa.alerts.v1` via the same `addInitScript`. Both `ROUTES` loops (393px and the wide bands) now seed `/alerts` and pre-measure `alerts-rule` count === 2 before measuring overflow; the wide-band loop also pre-measures `scan-row` count === 3 for `/scanner` (T4). `/settings`'s `ROUTES` entry now asserts all five section testids (`settings-{account,preferences,risk-inputs,ai-key,brokerage}-panel`) attached before measuring, at every width that entry runs under (37A). A new `lg 1280 no-overflow · light scheme (criterion 64)` describe block walks the four seeded surfaces in light mode at 1280 (the one width×scheme cell no other block reached). A new `assertNoTypeBelowFloor` helper (a real DOM walk, not a fixed testid list) is called after every overflow assertion in both `ROUTES` loops (criterion 65). A new `criterion 7a` describe block measures the rendered container step on `/positions` at 1280 vs 393 with a real resolved mark (own isolated `/api/contract/**` override, not the shared `stubNetwork`'s 404). |
| `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` | A new `criterion 66 (FE-13)` describe block: hard-asserts (`expectFloor`) the alerts composer's `alerts-add`/`alerts-notify` buttons meet the 44px floor at 393px/coarse pointer; a second test MEASURES (does not assert) the per-rule Remove button and enable/disable Switch, logging the evidence verbatim (§5). |
| `apps/dashboard-e2e/src/quality/manifest.json`, `tools/lib/manifest.mjs`, `tools/manifest.spec.mjs`, `src/quality/reporters/quality-reporter.ts` | Frozen browser-quality inventory bumped `90 → 99` in lockstep (9 new `test_id` entries; `inventory_id` → `curvature-v2-surfaces-99-v1`), following the FE-12-established four-file convention. |

### 2. A real test-infrastructure defect found and fixed (not product source — `no-overflow.spec.ts` is this lane's own file)

**Every "light scheme" test in this file was silently rendering dark.** `useSettings.ts:63-69`
(`serverBacked = auth.authenticated && auth.settings != null`) makes an authenticated session's
`settings.theme` win over `convexa.uiprefs.v1` entirely — `loadLocalTheme()` is read only on the
anonymous branch. `stubNetwork`'s `/api/auth/session` mock hard-coded `theme: 'dark'` regardless of
the caller's own `scheme`, and every call site in this file defaults `signedIn: true`. So the shipped
`393px no-overflow · light scheme` block, the AI-recommendation card's `light` arm, and (before this
fix) my own new `lg 1280 … light scheme (criterion 64)` block were all measuring **dark-mode
geometry** under a "light" label — passing only because box geometry does not depend on colour
scheme, exactly the vacuity shape criterion 62 exists to close, one level deeper, and it would have
made criterion 64 (this task's own light-mode requirement) provably vacuous.

**Found by the mandated visual pass, not by reading code.** A screenshot of `/alerts` seeded, 393px,
`scheme: 'light'` rendered pixel-identical to the `dark` capture (dark navy background, light text)
before this fix; identical seed/route, only `theme` changed, confirmed at source
(`useSettings.ts:63-69`) before touching anything.

**Fixed** by adding `theme?: 'dark' | 'light'` to `stubNetwork`'s options (default `'dark'`, so every
untouched call site is behaviourally unchanged) and threading the caller's own `scheme` through at
every site where a `scheme` variable is actually in scope: both `AI recommendation decision card`
loops, the `393px no-overflow` block's `beforeEach` and its `AC-40` cold-start-banner test, the
already-fixed `AC-40 palette` test, and the new `lg 1280 … light scheme` block (now `theme: 'light'`
explicitly). Left untouched, correctly: the `keyboard focus …` test (fixed `scheme: 'dark'`), the wide
dark-only band (`dark scheme` fixed, matches the default), the `AC-40` sign-in-wall test
(`signedIn: false` → `settings: null` → the ANONYMOUS branch, which already reads `loadLocalTheme()`
correctly — confirmed by re-reading `useSettings.ts` rather than assumed), and the criterion-7a test
(dark only by design, testing container geometry, not colour). **Re-screenshotted after the fix**:
`/alerts` at 393px light now renders a light cream background with dark text, matching the shipped
light palette (§9). This is squarely test-fixture code inside this lane's own owned file — no product
source touched.

### 3. A pre-existing product defect found, NOT fixed (GATE Z — out of lane)

**`/positions` overflows `document.documentElement.scrollWidth` at 900px with the shipped
`book+condor` seed — `978px` vs the `900px` viewport — independent of this task's own changes.**
Confirmed BEFORE touching anything relevant: a standalone reproduction script (bypassing this spec
file entirely, replicating only the shipped `SEEDED_POSITIONS`/`CONDOR` fixtures and `stubNetwork`
idiom) reproduces the identical `978` figure against the current `apps/dashboard/src` tree, and this
task's own e2e edits do not touch `PositionsPage.tsx`/`PositionsView.tsx`/`view.ts` at all — the
`/positions` wide-band test's own seeding (`positions: 'book+condor'`) and assertion were byte-for-
byte unchanged by this task except for line-number drift. No prior lane (FE-6 through FE-12) appears
to have run the FULL `no-overflow.spec.ts` suite end-to-end against a production build with this exact
seed — each ran only its own targeted `curvature-v2.spec.ts`/`desk-and-read.spec.ts` subsets — so this
looks like a **latent regression that predates FE-13**, first surfaced by this task's own mandated full
run.

**Diagnosed, not just observed** (measure `boundingBox()`, never restyle — this lane may not edit
`apps/dashboard/src`): `document.body.scrollWidth` measures a CORRECT `900` at the same moment
`document.documentElement.scrollWidth` measures `978` — the discrepancy is between `<body>` and
`<html>`, not a real page-level scrollbar. `positions-table-frame`
(`features/trading/positions/PositionsView.tsx:280-289`, `overflowX: 'auto'`/`overflowY: 'hidden'`)
itself measures a properly-contained `852px` box (`right: 876` inside the `900px` viewport) — its own
clip is correct. A full-page `getBoundingClientRect()` scan for any element with `right > viewport`
OUTSIDE that frame's subtree returns **zero** matches. Setting the frame to `display: none` restores
`documentElement.scrollWidth` to `900`; without the condor (`book` only, no `book+condor`) the SAME
900px viewport measures a correct `900` throughout (`positions-table-frame` right=`876`,
`docScrollWidth=900`). The condor's own four-leg row is therefore the trigger — plausibly the SAME
class of "the widest row's min-content width" issue `view.ts`'s own file-header comment already
documents for a DIFFERENT width/host pair ("with a real 4-leg condor row the `contract` cell grew
+123px and min-content at 1280 went 17px over the 1190 host") — a mitigation that was tuned against
one width and not swept against 900px. **Itemized, not fixed**:
`apps/dashboard/src/app/features/trading/positions/PositionsView.tsx:280-289` (the frame) and
`apps/dashboard/src/app/features/trading/positions/view.ts` (the condor structure-line width
discussion) — carried debt, phase unassigned (found in phase 3, likely belongs with phase 4's own
"positions laptop column drop" debt line already on SPEC's Out/Future list).

**This is the suite's one failure.** `98/99` pass; `md 900 no-overflow · dark scheme › /positions fits
900px` is the sole red, reproduced identically across three separate runs (before my theme fix, after
the two mutation-proof poison/revert cycles, and after the theme fix) — stable, not flaky.

### 4. Mutation proof (criterion 21/62, SB) — both poisons run red, then reverted to green

| Poison | Where | Red result (verbatim) | Restore |
|---|---|---|---|
| `SEEDED_ALERTS.rules` sliced to `[]` | `no-overflow.spec.ts` (temporary) | `md 900 … /alerts`, `lg 1280 light … /alerts`: `Error: expect(locator).toHaveCount(expected) failed — Locator: getByTestId('alerts-rule') — Expected: 2 — Received: 0` | reverted; `git diff` on the file after restore shows no `MUTATION POISON`/`slice(0, 0)` text; re-run green (below) |
| `scan.rows` sliced to `[]` before `.map(...)` | `no-overflow.spec.ts` (temporary, the shared fixture) | `md 900 … /scanner`, `lg 1280 light … /scanner`: `Error: expect(locator).toHaveCount(expected) failed — Locator: getByTestId('scan-row') — Expected: 3 — Received: 0` | reverted; same confirmation |

Both poisons run TOGETHER in one targeted pass (`-g "fits 900px (scrollWidth|criterion 66|fits
1280px in light mode"`): **5 failed** (the two guards above, ×2 widths, plus the pre-existing
`/positions` 900px overflow from §3 — unaffected by either poison, confirmed present in the SAME red
run), **7 passed** (unaffected tests, including the criterion-66 `curvature-v2.spec.ts` block, which
uses its own local fixture and was correctly untouched by either poison). Restored: same targeted
pass → **11 passed, 1 failed** (only §3's pre-existing defect remains). No proof above is a narrated
`expect(true).toBe(true)`; both reds are copied from this session's own terminal.

### 5. Criterion 66 — measured, itemized where it fails (never restyled)

At 393px, coarse pointer (`hasTouch: true`), on the alerts write affordances SPEC §3 names:

| Control | `file:line` | Measured | Floor met? |
|---|---|---|---|
| `alerts-add` ("Add rule") | `AlertsPage.tsx:341-347` | 44×44+ (hard-asserted, `expectFloor`) | **yes** |
| `alerts-notify` ("Enable browser notify") | `AlertsPage.tsx:349-357` | 44×174 (hard-asserted) | **yes** |
| per-rule "Remove" button | `AlertsPage.tsx:429` | `{width: 64, height: 40}` | **no — GATE Z.** `minHeight: 40` is an explicit inline `sx` override; an MUI `sx` compiles to a class (specificity 0,1,0), which beats `theme.ts:132-137`'s plain-element `@media (pointer: coarse) { button, … }` floor rule (specificity 0,0,1) regardless of the media query — confirmed by this exact measurement, not inferred. |
| per-rule enable/disable `Switch` | `AlertsPage.tsx:399-402` | its `FormControlLabel` (the actual clickable region, not just the switch graphic) = `{width: 163.3, height: 24.75}` | **no — GATE Z**, same mechanism (a `Switch`/`FormControlLabel` render as `<span>`/`<label>`, neither matches `button, [role="button"], a`, so the global floor never applies, and MUI ships no size floor of its own here). |

Both failing controls are measured and logged verbatim by a dedicated, non-asserting test (`criterion
66 (FE-13) … MEASURED, not asserted (GATE Z)`) rather than hard-failing the suite over a defect this
lane may not fix (`AlertsPage.tsx` is product source). Settings' own controls (`settings-signout`,
`settings-theme-{dark,light,system}`) were separately measured during this task's own investigation
and all meet 44×44 (they render as real `<button>`/MUI `ToggleButton` elements, which the global floor
already covers) — not itemized as debt. **The three positions "literal" tips** (`cell-unavailable`/
`cell-not-recorded`/`cell-no-basis`, `PositionRow.tsx:145-190`) are **structurally unreachable at
393px**: that DOM pattern exists only in `PositionRow.tsx` (the desktop TABLE row), and `PositionCard.tsx`
(the sole renderer below the `sm` breakpoint, confirmed by `grep` finding zero occurrences of
`literal(`/the three testids in that file) never reuses it — a 393px coarse-pointer measurement of a
control that does not exist in the DOM at that width is not a pass or a fail, it is inapplicable by
construction; recorded here rather than silently skipped. The off-exchange proximity chip
(`OffExchangeBlocks.tsx:113-123`) was inspected at source rather than live-measured (no reachable
off-exchange bundle this session, gotcha 8) — `TintChip.tsx:24`'s `py: '2px'` and the wrapping `<span
tabIndex={0}>` carry no floor of their own and are not a `button`/`role="button"`/`a`, the SAME
mechanism as the two confirmed failures above; flagged as a likely third instance of the same class,
not claimed as independently measured.

### 6. Criterion 7a — the rendered container step (review-only evidence, per this task's own instruction)

`getComputedStyle(...).fontSize` of the value glyph inside `[data-testid="positions-net-pl"]`
(`PositionsPage.tsx:203-209`), with a REAL resolved mark (own `/api/contract/**` override so the
figure is `traced`, never the fixed-15px `unavailable` literal — vacuity-guarded by asserting the
glyph's own text is not `unavailable` before measuring):

- **1280px:** container `boundingBox().width = 200px`, font-size = **`15px`**.
- **393px:** container `boundingBox().width = 200px`, font-size = **`15px`**.

**Both widths measure identically — the 20px/17px states SPEC §7 invariant 5 describes are
structurally unreachable for this readout as shipped, not merely untested.** Per this task's own
explicit instruction ("if the measured values differ from 20/17, that is a finding, not a number to
adjust the assertion to"), the assertion is NOT hardcoded to `20`/`17`; the test asserts only that
both are real, valid computed sizes (the traced figure genuinely rendered, not a blank/faulted page —
the same `review-only evidence` idiom `curvature-v2.spec.ts`'s own pre-existing `AC-20b` test already
established for the identical shape of finding). **Cause, measured not assumed:**
`PositionsPage.tsx:203`'s `PanelContainer` carries `minWidth: 200, flexShrink: 0` (added by FE-6 to
fix a real zero-width collapse, per FE-6's own `BUILD_REPORT.md` §2) with no `flexGrow` — the flex
item is sized by CONTENT, floored at 200, and never grows to fill available space regardless of
viewport. 200px sits under both `@container` breakpoints (360 and 280), so the readout renders at the
smallest, 15px "literal size" step at every viewport, confirmed even with an artificially large P/L
figure (`+$52,000`, still 200px/15px) during this task's own investigation. **GATE Z, carried debt**:
`PositionsPage.tsx:203` (this lane's file-ownership boundary; FE-6/positions' file, not FE-13's to
edit) — the fix, if pursued, is a product/design decision (does this readout WANT to step, or was 7a's
premise written against a different panel's geometry?), not a mechanical one.

### 7. Verification — exit codes, read directly

| Command | Result |
|---|---|
| `npm run ports:free && npx playwright install chromium && npm run build` | exit **0** each; production build |
| `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache` (three runs: before the theme fix, immediately after both poison/revert cycles, and the final canonical run after the theme fix) | **exit 1 all three times** — `98/99` passed, the SAME single pre-existing `/positions` 900px failure (§3) every time, stable across runs; `summary.json`: `"selected": 99, "executed": 99, "not_run": 0, "status": "fail"` — the manifest lockstep is exact (no `"incomplete"`), the failure is a real, reproduced test result |
| `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` (repo root) | **`99 tests in 7 files`** — see §8 for the full width×scheme case list |
| `node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/mutations.spec.mjs` | **exit 0, 7/7** |
| `npx nx run-many -t typecheck -p @convexa/dashboard,@convexa/api --skip-nx-cache` (cold: `dist`/`out-tsc`/`*.tsbuildinfo` deleted first) | **exit 0** |
| `npx nx typecheck dashboard-e2e --skip-nx-cache` (cold: `out-tsc` deleted first) | **exit 0** |
| `npx nx lint dashboard-e2e --skip-nx-cache` | **exit 0** — 4 warnings, all pre-existing (`no-explicit-any` in four Playwright config files), **0 new** — two `no-console` unused-eslint-disable warnings from this task's own first draft were found and fixed (the repo's `no-console` rule doesn't apply to this glob, so the disables were dead comments) |
| `npx nx format:check --files=<the 6 changed e2e paths>` | **exit 0** — `BUILD_REPORT.md` itself is NOT prettier-clean at HEAD (pre-existing, confirmed by checking it in isolation before this task touched it) and is intentionally left as-is here — this task appends one section without reformatting content it did not author, rather than folding an unrelated repo-wide-document reformat into an FE-13-scoped commit |
| `grep -rln "FE-13" apps/dashboard/src apps/dashboard-e2e/src --include=*.spec.*` (gotcha 10) | **exactly the two files this task owns** — no coincidental other-feature hit this session |

### 8. The executed case list (criterion 63, SB) — `--list`, 99 tests in 7 files

Width × scheme combinations criterion 62 claims, all present and executed (none claimed-but-not-run):

- **393px, dark scheme** — `/`, `/ticker/TSLA`, `/positions` (+ seeded-book dedicated test), `/scanner`
  (+ seeded-cards dedicated test), `/settings` (+ five-section guard), `/alerts` (seeded, **new**), plus
  AC-40's three degraded surfaces, the 4-leg-expanded case, the nav-collapse case, criterion 50's rail.
- **393px, light scheme** — the identical set (now genuinely rendering light, §2).
- **834px (tablet), dark scheme** — all six `ROUTES` + criterion 50.
- **900px (md), dark scheme** — all six `ROUTES` (**one pre-existing failure, §3**) + criterion 50.
- **1280px (lg), dark scheme** — all six `ROUTES` + criterion 50.
- **1280px (lg), light scheme (criterion 64, NEW)** — all six `ROUTES`, seeded identically to the dark
  1280 band.
- Plus the AI-recommendation-card block (393/1440 × dark/light, unaffected in count by this task) and
  the standalone criterion 66 / criterion 7a tests.

`playwright.config.ts:30-38`'s allowlist is unchanged (no new spec file was needed — both new
describe blocks live inside the two files this task already owns) — verified by the exact `99` count
above matching the four-file manifest bump with no `"not_run"`.

### 9. What was run in the app

`npm run ports:free` → served the production build directly with `http-server` (the SAME command
`playwright.shared.config.ts`'s own `BROWSER_QUALITY_PREBUILD_STATUS=pass` branch uses) → real
headless Chromium driving the UI with the SAME network-stub/seed idiom as the e2e suite (never the
dev server, per this task's own instruction).

- **Confirmed live: the seeded `/alerts` page renders correctly**, both schemes, 393px — two rules
  (`TSLA · Level touch`, `Price threshold: $260`; `SPY · Score gate`, `Score gate: ≥ 70`), two events
  (one read, one `UNREAD`-labelled), no horizontal overflow, screenshots captured before AND after the
  theme-precedence fix (§2) — the before/after pair is the direct evidence for that discovery, not an
  inference.
- **Confirmed live: `/settings` renders all five section panels** in a single scrollable column at
  393px, both schemes, no page-body overflow.
- **Confirmed live, via a dedicated investigation script (not the shipped suite): the `/positions`
  900px overflow (§3)** — reproduced independently of the spec file, isolated to the condor row,
  diagnosed to the `<body>` vs `<html>` `scrollWidth` discrepancy described there.
- **Confirmed live: the alerts Remove button and rule Switch's small effective tap areas (§5)** —
  screenshotted and measured directly, not inferred from source alone.
- `npm run ports:free` run again at the end; HEAD confirmed unchanged (`2110f2b8`) and the sibling
  `docs/research/…` directory confirmed untouched, both before and after this session's work.

---

## GATE Z repair — three FE-13 findings, the conductor's overturn on finding 1

**Landed:** 2026-09-07/08, on top of FE-13 (`3d31a082`, unchanged HEAD at start). **Scope: exactly the
three findings the launch dispatch named** — no other file touched, `FE-14`/`BE-1` not started. Each
finding lands as its own commit below; this section grows with each one.

### Finding 1 — `/positions` overflows at 900px: a REAL FE-5 regression, not pre-existing

**Diagnosis (measured, not guessed).** A standalone reproduction (production build, `http-server`
with the shipped SPA fallback, real Chromium, the exact `book+condor` seed) walked every element on
the page comparing `getBoundingClientRect()` against the 900px viewport. `document.body.scrollWidth`
read a correct `900`; `document.documentElement.scrollWidth` read `978`. The 78px gap traced to **four**
`position: absolute; width: 1px; height: 1px` visually-hidden description spans (`PositionRow.tsx`'s
`literal()`, the `VISUALLY_HIDDEN` sibling behind the three keyboard-reachable member tips
`cell-unavailable`/`cell-not-recorded`/`cell-no-basis`) — one per condor-row literal cell that carried
both a `testid` and a `helpId`. Their immediate wrapper (`PositionRow.tsx:168-173`, the
`tabIndex={-1}` `Box component="span"`) declared `display: 'inline-block'` but **no `position`**, so
it never became a containing block for its absolutely-positioned child. With no positioned ancestor
between it and `<html>`, the hidden span's containing block escalated all the way to the initial
containing block — **outside** `positions-table-frame`'s `overflow-x: auto` scroll boundary — so its
static-position layout (computed as if it were `position: static`, landing wherever it fell inside the
horizontally-scrolled row, here `left: 977`) was **never clipped** by that scroll container, silently
widening the page's own layout overflow independent of the frame's own (correctly-clipped) `852px`
box. **This is FE-5's own code** (`bdc992d8`, U-15a's keyboard-reachable literal tips): `git diff
f8957d3f..HEAD -- PositionRow.tsx` shows the `VISUALLY_HIDDEN`/wrapper/`aria-describedby` block did
not exist at the phase-3 baseline — the pre-U-15a `literal()` had no absolutely-positioned children at
all, so the hazard could not have pre-existed. FE-13's "pre-existing" verdict measured the same
symptom correctly but did not walk far enough up the containing-block chain to find the missing
`position: relative`; the conductor's overturn is confirmed.

**Fix (`PositionRow.tsx:168-173`):** added `position: 'relative'` to the wrapper `Box`'s `sx`, making
it the containing block for its own hidden description child. Zero visual change (the wrapper's own
box is unaffected by an offset-less `position: relative`); the hidden span is now clipped by
`positions-table-frame` exactly like every other row cell.

**Measured before/after** (standalone script, 900px, dark, `book+condor`, identical fixture both
times): `documentElement.scrollWidth` **978 → 900** (== `innerWidth`); `body.scrollWidth` unchanged at
`900` both times (confirming the fix closed the `<html>`/`<body>` discrepancy, not a coincidence).

**Re-run of the criterion this touches:** `md 900 no-overflow · dark scheme › /positions fits 900px` —
**red before the fix** (reproduced independently, matching the launch dispatch's own report), **green
after**, part of the 100/100 full-suite pass at the end of this section. `npx vitest run
src/app/features/trading/positions src/app/pages/positions` (the two trees `PositionRow.tsx` sits in /
is imported by) — **exit 0, 527/527 tests**, no regression from the one-line containing-block fix.

**Commit:** `5c07dc40` — `fix(dashboard): GATE Z — /positions 900px overflow, FE-5's untethered
absolute description span (curvature-v2-surfaces)`.

### Finding 2 — criterion 66: three under-floor controls, all fixed; one instance newly reachable

Three controls measured under the floor at 393px/coarse; all three share the same mechanism (a
plain element or a non-`button`/`role="button"`/`a` node the theme's coarse-pointer selector cannot
reach) and the same fix idiom (a `'@media (pointer: coarse)'` rule nested in the same `sx` object as
any conflicting override, so it wins the cascade only when the media condition matches — desktop/
fine-pointer sizing is byte-identical to shipped).

| Control | `file:line` | Before | After | Mechanism |
|---|---|---|---|---|
| Alerts per-rule "Remove" button | `AlertsPage.tsx:429` | `{width: 64, height: 40}` | `{width: 58.4, height: 44}` | inline `sx={{ minHeight: 40 }}` compiles to a class (0,1,0) that beats the plain-element floor selector (0,0,1) regardless of `@media` nesting |
| Alerts per-rule enable/disable `Switch`'s `FormControlLabel` | `AlertsPage.tsx:399-402` | `{width: 163.3, height: 24.75}` | `{width: 163.3, height: 44}` | `<label>`/`<span>` matches neither `button`, `[role="button"]` nor `a`, so the floor never applied |
| Off-exchange proximity chip (quiet band) | `OffExchangeBlocks.tsx:113-123` | `{width: 86.6, height: 24.75}` (newly measured this pass — FE-13 could not reach a rendered instance) | `{width: 86.6, height: 44}` | same as above: a `tabIndex={0}` `<span>` wrapper, not a `button`/`role="button"`/`a` |

**Reachability, closed for this pass's own measurement need.** FE-13 flagged the off-exchange chip as
"the same mechanism, unmeasured" because neither e2e file's shared `bundle` fixture ever carried an
`off_exchange` payload — the widget rendered its "Off-exchange data unavailable this cycle." empty
copy in every existing test, so the chip was never in the DOM to measure. A new, file-local
`page.route('**/api/ticker/**', …)` override (registered after `stubNetwork`, matching the same
override idiom `no-overflow.spec.ts`'s own criterion-7a block already uses for `/api/contract/**`) in
a new `curvature-v2.spec.ts` describe block supplies one real `off_exchange.blocks[0]` entry, making
the chip reachable for the first time this phase — the shared `bundle` used by every other test in
both files is untouched, so no other test's fixture changed.

**Both alerts controls now hard-asserted** (the existing "MEASURED, not asserted (GATE Z)" test in
`curvature-v2.spec.ts` renamed to "GATE Z REPAIR — … now meet the floor" and converted to
`expectFloor(...)` calls); the off-exchange chip gets its own new hard-asserted test in the same file.
`npx vitest run src/app/pages/alerts src/app/features/alerts src/app/pages/ticker/widgets` — **exit 0,
818/818 tests**, no regression.

**Manifest lockstep** (gotcha 15): `manifest.json` `inventory_id` `curvature-v2-surfaces-99-v1` →
`-100-v1` (1 new `test_id` for the off-exchange chip test, generated via `crypto.randomBytes(32)`; the
Remove/Switch test's `title_path` updated in place, same `test_id`, since it is still the same test
position just renamed); `tools/lib/manifest.mjs`'s `tests.length !== 99` → `!== 100`;
`tools/manifest.spec.mjs`'s same assertion; `quality-reporter.ts`'s `gateCounts.chromium: 99` → `100`.
`node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/mutations.spec.mjs` —
**exit 0, 7/7**.

**Commit:** `b431d7da` — `fix(dashboard): GATE Z — three under-floor controls meet the 44px
coarse-pointer target (curvature-v2-surfaces)`.

### Finding 3 — criterion 7a: NOT fixed, bounced to the owner (GATE Z, per this task's own explicit fork)

**Decision: the honest-conclusion branch, not the mechanical-fix branch.** `PositionsPage.tsx` is
**untouched** by this pass; `data-figure-state`/`data-figure-register` behaviour is therefore trivially
unchanged (nothing was edited).

**Why not the mechanical fix.** The only way to make this specific readout's container cross the
360px (or even 280px) `@container` threshold is to raise `PanelContainer`'s `maxWidth: 320` past 360
and give it room to grow (e.g. `flexGrow`) — i.e. make the box **physically wider** than its own
content wants to be. That is a visual/product decision, not a mechanical one, and this lane is bound
not to invent product UX policy the contracts omit. Checked before deciding, not assumed:

- **The design canvas itself never specifies a width for this box.** `design/src/screens/
  positions.mjs`'s `.pos-stats` row (the mock this readout implements) lays its stat cells out with
  `display: flex; gap: 28px; align-items: flex-end` and `margin-left: auto` — every cell is
  **content-sized**, no explicit px width anywhere in the mock, for this or the sibling "Capital at
  risk" cell. There is no design source depicting this readout at 360px+.
- **The shipped 200–320px range is FE-6's own ad hoc compromise for an unrelated bug**, not a
  design-derived figure: FE-6's own `BUILD_REPORT.md §2` records `minWidth`/`flexShrink: 0` were added
  to stop `container-type: inline-size` collapsing the box to **zero** width as a flex item with no
  floor — a collapse-prevention floor, not a target width.
- **The content itself (a short label + one currency figure, e.g. `+$97`) does not naturally reach
  360px** — confirmed by FE-13's own investigation, which found the box measures identically at
  `200px`/`15px` even with an artificially inflated `+$52,000` figure.

**Measured, unchanged from FE-13 (re-verified this pass, same fixture, same idiom — own isolated
`/api/contract/**` override, real resolved mark):** container width `200px` at **both** 1280px and
393px; font-size `15px` at both. The 20px/17px states remain structurally unreachable for this
specific consumer as shipped.

**GATE Z item filed for the owner:** either (a) the owner rules this readout should in fact be wider
than 320px on desktop — a design decision, with its own visual tradeoff against the "Capital at risk"
sibling cell and the header row's `space-between` layout — and a future phase implements that width
and re-proves the step renders at two viewports, or (b) the owner rules a 200–320px content-sized stat
cell legitimately sits at the 15px literal-size step always, and criterion 7a's specific 20/17
expectation for *this one consumer* is retired (the criterion's general "every figure that renders at
20px base steps against its own panel" requirement is otherwise satisfied structurally — the
`PanelContainer` ancestor exists, named correctly, single instance — it is only THIS panel's
un-design-specified width that keeps the upper two rungs of the ladder out of reach). This lane makes
neither ruling; `SPEC.md`/`decisions.md` are unedited. **No commit for this finding beyond this
write-up** (no source or test file changed).

### Verification — exit codes, read directly (whole GATE Z pass, after all three findings)

| Command | Result |
|---|---|
| `npm run typecheck` (cold: `apps/dashboard/dist`, `out-tsc`, `*.tsbuildinfo` deleted first) | **exit 0** |
| `npx nx typecheck dashboard-e2e --skip-nx-cache` (cold: `out-tsc` deleted first) | **exit 0** |
| `npm run lint` | **exit 0** — 4 pre-existing warnings (Playwright config `no-explicit-any`), 1 pre-existing dashboard warning (`useSessionArchive.ts`), **0 new** |
| `npx vitest run src/app/features/trading/positions src/app/pages/positions` | **exit 0, 527/527** |
| `npx vitest run src/app/pages/alerts src/app/features/alerts src/app/pages/ticker/widgets` | **exit 0, 818/818** |
| `node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/mutations.spec.mjs` | **exit 0, 7/7** |
| `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` | **100 tests in 7 files** (99 → 100: the new off-exchange chip test) |
| `npm run ports:free && npm run build && BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache` | **first run: exit 1, 99/100** — one `Page crashed` (`page.goto` navigation crash under this run's 16-worker parallel load) on `lg 1280 no-overflow · dark scheme › / fits 1280px` — re-run of that exact test in isolation (2 workers, no other load) passed cleanly, confirming infra flakiness under this pass's own parallelism, not a regression from either fix. **Second full run, same build, same command: exit 0, 100/100 passed, 0 flaky** (quoted below) |
| `npm run ports:free` (first and last) | **exit 0**, "Nothing listening" both times |

**Full second run tail (verbatim):**
```
100 passed (10.9s)
[PASS] chromium — 100/100 passed — 0 flaky
NX   Successfully ran target e2e for project dashboard-e2e
```

HEAD confirmed unchanged at `3d31a082` before this pass began; the sibling
`docs/research/convexa-business-review-2026-09-05/` directory confirmed untouched (present, unmodified,
still untracked) throughout. No `git stash` used. No scratch files left in the repo (a diagnostic
Playwright/Node script for finding 1's DOM walk and an `http-server` log, both under
`apps/dashboard-e2e/_tmp_*`, deleted before any commit; confirmed via `git status --porcelain`).

---

## FE-14 — Frontend closer: whole-phase verification, both `EXEMPT` maps, the review captures, criterion 7a's owner decision

**Landed:** 2026-09-08, one commit, docs-only. **Owns:** this section and the verification run below.
**Implements no worker paths** — no `apps/dashboard/src`, `apps/dashboard-e2e/src`, `apps/api`,
`SPEC.md`, `PLAN.md`, `INTERFACE_CONTRACT.md`, `decisions.md` or `design/` file was touched by this
task. HEAD at start and end: `6cf64041` (unchanged — verified before and after); the sibling
`docs/research/convexa-business-review-2026-09-05/` directory confirmed present, untracked and
untouched at both checkpoints. No `git stash` used.

### 1. Every mutation proof A–S — recorded red output, and which are non-vacuous (criterion 69, SB)

All nineteen letters A–S carry a recorded red result in an existing §FE-n section; **none is a
narrated `expect(true).toBe(true)`** — collated here, not re-run (re-running a poison is FE-1…FE-13's
job, not the closer's; the closer's own job is to confirm every letter's red output was actually
captured, per PLAN item 1).

| Proof | Owning task | Red output recorded? | Anti-vacuity evidence |
|---|---|---|---|
| A | FE-1 §4 | **yes** — `npm run typecheck` non-zero, `ReadStrip.tsx(59,14): error TS2741…`; `nx test` stayed green on the same tree (the point of the proof) | the same table's revert line: `git diff` = 0 lines, typecheck exit 0 after |
| B | FE-1 §4 | **yes** — `fonts.spec.ts` exit 1, `AssertionError: N-1 violation: … ScanTable.tsx → … needle 1): 165:not recorded` | B′/C′ row: both needles disabled → 4 separate failures (needle 1, needle 2, EXEMPT live check, enforcement test) — proves the enforcement test would pass vacuously without the needles, which is why §2.3 refused the shipped `RETIRED_FACES` guard |
| C | FE-1 §4 | **yes** — `fonts.spec.ts` exit 1, `AssertionError: N-1 violation: … ScanTable.tsx → binds a font face locally (needle 2)`, same run showing needle 1 unaffected | same B′/C′ row |
| D | FE-2 §4 | **yes** — `MUTATION PROOF D`, planted `genuineIsLive(...)` in `Scanner.tsx`, the widened fence goes red naming that file | FE-2 §4 states the guard is a NEW glob (a source the fence did not previously scan), the direct test of the widening itself |
| E | FE-3 §4 | **yes** — `MUTATION PROOF E`, `ScanCard.tsx`'s `regimeLookup` replaced with the raw enum, both-layouts test red | FE-3 §4 |
| F | FE-4 §5 | **yes** — `MUTATION PROOF F`, criterion 12, red on the never-ticked symbol getting the retained treatment | FE-4 §5 — the dedicated poison test named alongside |
| G | FE-4 §5 | **yes** — `MUTATION PROOF G`, CF-1's `cf1Offenders` poison-and-check idiom, red naming the changed key | FE-4 §5 |
| H | FE-5 §5 | **yes** — `PositionRow.tsx`'s `session_delta` no-value arm poisoned to `'⏸_MUTATION_POISON_H'`; `pauseGlyph.spec.ts` red naming file + line | FE-5 §5 — revert shows the real diff only, zero `POISON` markers (`grep -c POISON` → 0) |
| I | FE-5 §5 | **yes** — `AssertionError: expected 'offline · last known' to be 'offline'` on the 27b test | FE-5 §5 |
| J | FE-6 §4 | **yes** — `netPl.spec.ts` exit 1, `AssertionError: expected '+$0' to be 'unavailable'` — the shape of the shipped `+$0` defect the criterion closes | FE-6 §4 |
| K | FE-6 §4 | **yes** — `netPl.spec.ts` exit 1, 3 failed, load-bearing one: `expected '1 of 2 open marked' to be null` — proves the coverage caption leaks through once the offline early-return is bypassed | FE-6 §4 |
| L | FE-7 §4 | **yes** — `MUTATION PROOF L`, `brokerView.ts`'s `brokerFactText` poisoned to return `NOT_RECORDED`, the broker no-`not recorded` census goes red | FE-7 §4 — poisoned a non-owned pure function per PLAN, mirroring FE-2's own precedent |
| M | FE-8 §4 | **yes** — `MUTATION PROOF M`, restored `severity="success"`, the neutral-chrome test red | FE-8 §4 — the icon/colorError assertions independently unaffected, isolating exactly what the poison broke |
| N | FE-9 §3 | **yes** — `MUTATION PROOF N`, removed the `readFaulted` guard, red on the raw stored string being overwritten | FE-9 §3 — `grep -n MUTATION_POISON store.ts` → 0 hits on revert |
| O | FE-10 §4 | **yes** — `MUTATION PROOF O`, restored `?? 60` on the score-gate line, the fabricated-threshold test red | FE-10 §4 |
| P | FE-10 §4 | **yes** — `MUTATION PROOF P`, disabled the "Unread" label, the black-and-white test red | FE-10 §4 |
| Q | FE-11 §6 | **yes** — `quiet-band.register.spec.tsx` 2 failed: `data-figure-register` mono on an absent value, AND the DOM scan finding `'—'` inside a mono node | FE-11 §6 — `fonts.spec.ts` run in the SAME pass, exit 0/14-14, confirming Q is isolated to the register scan and not a needle hit |
| R | FE-11 §6 | **yes** — `Setups.tsx` collapsed back to one ternary; 1 failed: `Unable to find … "Setups unavailable this cycle."` — the `[]` arm's own test stayed passing (both arms coincidentally render the same sentence), exactly the collapse 56a exists to catch | FE-11 §6 |
| S | FE-12 §5 | **yes** — dropped the `About ` prefix in `Widget.tsx`; rebuilt production; 4 failed (one per width), first failure quoted verbatim (`getByRole('button', {name: /^About /i})` timeout) | FE-12 §5 — the single shared render site is confirmed via `grep` (exactly one `<AccessibleHelp>` call site) and a static-bundle scan confirming the poison string landed in the single compiled chunk all eight widgets' import resolves to — the mechanism-level proof, since the per-test loop stops at the first widget it reaches |

**Conclusion: 19/19 letters (A–S) carry recorded red output; zero are narrated
`expect(true).toBe(true)` bodies.** This closer did not re-run any of the nineteen poisons itself
(that is FE-1…FE-13's own verification, already committed); its own contribution to criterion 69 is
confirming every letter's red text actually exists in the record, per PLAN's own instruction that "a
proof without its red output is not a proof."

### 2. `EXEMPT` maps — both re-confirmed this session

- **`fonts.spec.ts`'s `EXEMPT` is `{}`** (`apps/dashboard/src/app/shared/theme/fonts.spec.ts:265`) —
  **empty**, criterion N-1 satisfied in its final state. (FE-1 shipped it at 14 entries; each owning
  task deleted its own entry per the carried-notes discipline in FE-1 §8 item 2; the map reached zero
  sometime at or before FE-7, per RESUME's own note, and is still zero at this HEAD.)
- **`liveClaim.spec.ts`'s `EXEMPT` carries exactly its one live-checked desk entry**
  (`apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts:119-124`,
  `'pages/ticker/widgets/live-tape/LiveTape.tsx'`, reasoned: `numbersActive`'s derivation genuinely
  differs from `isDeliveringLive`). Both maps are live-checked on both arms (file must exist AND still
  violate/still be a fenced source) by their own `it` blocks, confirmed present and unchanged by
  reading the source directly this session.

### 3. Itemized visible copy diffs — the closed set (PLAN item 3, nothing beyond it)

| # | Site | Diff | Owning §FE-n |
|---|---|---|---|
| 1 | `labels.ts:29` `cadenceHeader` | `Prices live · structure ~3 min · hot names sooner` → `Prices per tick · structure ~3 min · hot names sooner` | FE-4 §2 |
| 2 | `labels.ts:34-36` `cadenceGloss` | opens `Prices stream live.` → opens `Prices change tick by tick.` (rest byte-identical) | FE-4 §2 |
| 3 | `_kit/copy.ts:361` `MC_CELL_EMPTY` | `'unavailable this cycle'` (value slot) → `'unavailable'` (value) + new `MC_CELL_EMPTY_CAPTION = 'this cycle'` (caption slot) | FE-11 §3 |
| 4 | `Setups.tsx:31-56` (`undefined` arm) | new sentence `Setups unavailable this cycle.`; the `[]` arm keeps `No clean setup right now.` byte-for-byte | FE-11 §3 |
| 5 | `PositionRow.tsx:68` | `const OFFLINE = '⏸ offline'` deleted; `PauseMark` + `offlineDecoration` caption | FE-5 §4 |
| 6 | `PositionRow.tsx:378` | `{streamOffline ? ' ⏸' : ''}` → `PauseMark` + caption, same placement | FE-5 §4 |
| 7 | `PositionRow.tsx:388` | bare `⏸` value → retained value (dimmed) or `—`, + `PauseMark` + caption, never a naked glyph | FE-5 §4 |
| 8 | `PositionRow.tsx:549` | `Paused — resumes pricing when the live feed returns. ⏸` → same sentence minus the trailing glyph, + `PauseMark` | FE-5 §4 |
| 9 | `PositionsView.tsx:367` | bare `⏸` (group header, offline) → `PauseMark` | FE-5 §4 |
| 10 | `labels.ts:57` `SESSION_DELTA_TIP` | `…freezes (⏸) while the feed is offline…` → `…freezes while the feed is offline…` (Z-2 — no glyph host inside a tooltip string) | FE-5 §4 |
| 11 | Positions `{n} of {m} open marked` coverage caption | **addition only** — the one new sentence §2.7/CF-2 authorize, used by 35b (`0 of {m}`)/35c (mandatory) | FE-6 §3, §5 |
| 12 | `BrokerPositionRow.tsx` (`ModeledPl`, was `:128`) | `{streamOffline ? '⏸ ' : ''}` prepended → `PauseMark` beside the figure | FE-7 §3 |
| 13 | `BrokerGroupHeader.tsx` (`GroupPl`, was `:215`) | `{streamOffline ? '⏸ ' : ''}` prepended → `PauseMark`, same shape | FE-7 §3 |
| 14–20 | Alerts: rule label, score-gate summary, level-touch (price/structure) summary, unread marker, firing timestamp zone, Recent-list disclosure, both events-empty sentences, notify-explain (denied/unavailable), N-5 faulted banner, level-touch firing label | full itemized table, §3 D/E per PLAN | FE-10 §3 (verbatim table) |
| 21–25 | Settings: `sessionResolving` honesty line (new), `Saved` confirmations → `severity="info"` (word unchanged), risk-input `placeholder="0"` → `placeholder="not set"` | full itemized table | FE-8 §6 (verbatim table) |

**No R2-class conflict found.** Every §FE-n copy-diff section this closer read explicitly states "no
other string changed" (FE-4 §2, FE-5 §4, FE-7 §3, FE-11 §3) or is closed by review rather than by scan
(FE-8 §6, FE-10 §3) — this closer's own re-read of those sections found nothing beyond PLAN item 3's
own enumeration.

### 4. The executed e2e case list (criterion 63, SB)

`npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` (repo root) this session:
**`Total: 100 tests in 7 files`**. Width × scheme rows named, all present:

- **393px, dark** — `/`, `/ticker/TSLA`, `/positions` (+ seeded-book), `/scanner` (+ seeded-cards),
  `/settings` (+ five-section guard), `/alerts` (seeded), the three AC-40 degraded surfaces, the 4-leg
  expanded case, the nav-collapse case, criterion 50's read strip.
- **393px, light** — the identical set, genuinely rendering light (FE-13's own theme-precedence fix).
- **834px (tablet), dark** — all six `ROUTES` + criterion 50.
- **900px (md), dark** — all six `ROUTES` (including `/positions`, now passing post-GATE-Z-fix) +
  criterion 50.
- **1280px (lg), dark** — all six `ROUTES` + criterion 50.
- **1280px (lg), light (criterion 64)** — all six `ROUTES`, seeded identically to the dark 1280 band.
- Plus the AI-recommendation-card block (393/1440 × dark/light), U-32's eight-frame walk at all four
  widths, AC-34/AC-35's coarse-pointer sweeps, criterion 66's alerts floor + the GATE-Z off-exchange
  chip, and the standalone criterion 7a test.

No claimed-but-not-executed combination — `--list`'s own count matches the 100-entry manifest with
zero `"not_run"` (confirmed independently below, §6).

### 5. Verification track — exit codes, this session's own run, from the repo root

| Command | Result |
|---|---|
| `npm run ports:free` (first) | exit **0** — "Nothing listening on :8000 :4200 :4300 — all clear" |
| `git rev-parse HEAD` / `git branch --show-current` (before) | `6cf64041` / `spire/curvature-v2-foundations` |
| `npx nx run-many -t typecheck -p @convexa/dashboard,@convexa/api --skip-nx-cache` | exit **0** |
| `npx nx typecheck dashboard-e2e --skip-nx-cache` | exit **0** (recorded SEPARATELY from `nx test`, criterion 68) |
| `rm -rf node_modules/.vite` (root — NOT `apps/dashboard/node_modules/.vite`, which does not exist in this hoisted layout) | cleared the stale glob-transform cache before the full suite (the exact ENOENT trap the launch dispatch named) |
| `npx nx test @convexa/dashboard --skip-nx-cache` | exit **0** — **239/239 files, 2856/2856 tests**. First attempt (before the `.vite` clear) hit the documented `_mutation_poison_replay_outcome_join.ts?raw` ENOENT on one file; after clearing `node_modules/.vite`, the identical command ran clean with no failures — **at or better than the stated baseline** (V12 accepts exit 0 outright; the "exit 1 at ≥2691/2694 with the three named load timeouts" branch did not fire this run, i.e. none of the three baseline-flaky specs timed out this time) |
| `npm run lint` | exit **0** — **5 warnings, 0 new** (`useSessionArchive.ts:110` `react-hooks/exhaustive-deps`, four `no-explicit-any` in `apps/dashboard-e2e/playwright.{a11y,compat,config,visual}.ts`) — matches the pre-existing count recorded by every prior lane this phase |
| `npm run build` | exit **0** — production build (dashboard `vite build --mode production`, api `cargo build --release`) |
| `npx playwright install chromium` | exit **0** |
| `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` | **`Total: 100 tests in 7 files`** — full case list §4 above |
| `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache` | exit **0** — **100 passed (16.3s)**, `[PASS] chromium — 100/100 passed — 0 flaky`. Live console output during this run: `[criterion 7a evidence] wide(1280): container=200px font=15px · narrow(393): container=200px font=15px` — this closer's own direct reproduction of the FE-13/GATE-Z measurement, not a re-quote |
| `git diff --name-only origin/main...HEAD -- apps/api \| wc -l` | **0** |
| `node design/src/verify-tokens.mjs` | exit **0** — **34 checks, all passed**, including the 17 "v2 additions (now structurally checked, not merely printed)" (`ink2`, `raised2`, `line`, `line2`, `steel2`, `scrim`, `glass` × dark/light) |
| `node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/mutations.spec.mjs` | exit **0**, 7/7 |
| `node .claude/tools/interface_conformance.mjs …` (V20) | **NOT RUN** — no backend server started this session (`curl localhost:8000/api/scan` unreachable); recorded honestly as the `NO_BACKEND_CHANGE` exemption path V20 itself allows, not attempted as a false pass |
| `npm run ports:free` (last) | exit **0** — "Nothing listening…", both times |
| `git rev-parse HEAD` / `git status --porcelain` (after) | `6cf64041` unchanged; only the untracked sibling `docs/research/…` directory shown |

**One correction to the launch dispatch's own assumption, found by running the command rather than
trusting the brief:** the dispatch states `verify-tokens.mjs`'s "structured checks cover only the 10
v1 tokens, not the v2 additions." That was true when the dispatch was written but is **no longer true
at this HEAD** — commit `2695e09f` ("`feat(design): structurally check the seven v2 token additions
(FE-13)`", landed inside FE-13's own commit range, before this closer started) added a second,
independently-asserting block that fails (`process.exit(1)`) on any v1-vs-tokens.ts **or**
v2-addition mismatch — confirmed by reading `design/src/verify-tokens.mjs:2,36,64-91` directly, not by
re-trusting either claim. Exit 0 on this HEAD **is** evidence the mirror matches for `steel2` et al.,
contrary to what the dispatch said to expect.

### 6. The `review` rows, each with its capture

| Row | Capture |
|---|---|
| 7a | **OPEN, bounced to the owner** — see §7 below. Not a PASS. |
| 7b | The two named off-ladder shapes both exist and are both accounted for: the **12px list row** is `FreshPositioning.tsx:71,79,83` and `OffExchangeBlocks.tsx:104` (FE-11's own quiet-band figures, kept at the row's shipped 12px per the task's "no size/layout/order change" instruction, FE-11 §4); the **table cell at `fontSize: 'inherit'`** is `ScanCells.tsx:63,105,143,180,235,270` and `Scanner.tsx:167` (FE-3/FE-4's scanner table cells, which inherit the row's font-size rather than stepping their own ladder). `figureFace.ts:14`'s own doc comment names this exact pattern (mono/sans face constants; "a 12px list row keeps 12px and a table cell keeps `fontSize: 'inherit'`"). No third off-ladder shape found by this closer's own grep. |
| 15 | Verbatim per FE-4 §2: `cadenceHeader` → `Prices per tick · structure ~3 min · hot names sooner` (no `live`); `cadenceGloss` opens `Prices change tick by tick.` (cadence + basis only, no live claim); `cadenceHeaderOffline` (`labels.ts:39`) confirmed byte-identical: `'Prices offline · showing last known · structure ~3 min'`, read directly from source this session. |
| 43 | `AiKeySection.tsx`'s masked-hint behaviour is covered by three of this session's own passing full-suite tests, seen live in the `nx test` run: `"add: the raw key rides ONLY the PUT body; the DOM shows the masked hint and never the key"`, `"replace then remove: the hint swaps to the NEW last-4, then clears — no raw key ever echoes"`, `"a save transport fault surfaces an error WITHOUT echoing the key"` — all three green in this session's 2856/2856 run. |
| 47c | `RiskInputsSection.tsx`'s risk inputs (dollar figures) and the alerts `Price threshold: $${priceThreshold}` control (FE-10 §3, row 47a) both state their unit as part of the rendered control text, not merely the label; `47b`'s bare-index case (`≥ 72`, no invented unit) is the contrasting negative case FE-10 already asserts. No numeric control found in either surface's source with an implied-only unit. |
| 56 | FE-11 §3's own statement stands: "No third site touched — verified by re-reading every string literal changed in the diff… no other JSX text content differs" — this closer re-confirms via the itemized copy-diff table in §3 above, which is the closed set. |
| 60 | Each of the eight quiet-band widgets renders its own basis/as-of line unchanged from the pre-phase shipped copy (FE-11 touched exactly two sentences, §3 above); none of the eight is a scoring input per SPEC §1's own framing (none of `market_session`/`live` reaches these widgets, and FE-2's liveness fence — re-confirmed in §2 above — has zero exemption for any of them beside the one named `LiveTape.tsx` reason). |
| 63 | §4 above — `--list` captured before this write-up, 100 tests / 7 files, all five width×scheme cells named. |
| 69 | §1 above — 19/19 letters A–S carry recorded red output. |
| U-15 | FE-5's three literal tips (`cell-unavailable`/`cell-not-recorded`/`cell-no-basis`, `PositionRow.tsx:145-190`) each kept their own distinct wording per FE-5 §1/§4; the U-15a wording+focus test is part of `positions.risk.spec.tsx`'s 32-test file, confirmed green in this session's full run. |
| U-19 | `AUTH_COPY.settings.sessionResolving` (FE-8 §6): `'Checking your session — these controls unlock in a moment.'` — one line, removed the moment `auth.authenticated`/`settings` resolve (FE-8's own §4 confirms via the dedicated test, unchanged this session). |
| U-24 | Alerts Recent-list disclosure (FE-10 §3, row "Recent-list disclosure"): `'Stored in this browser only — not synced to your account or across devices. Firings recorded before this update keep their original wording; new firings use the labels above.'` — both the back-fill honesty clause and the durable-storage clause are in the one sentence. |
| U-27 | FE-10 §3: firing timestamp `toLocaleString()` → `toLocaleString(undefined, { timeZoneName: 'short' })` — every firing now names its zone. |
| U-37 | Every degraded-copy surface names its own degrade: scanner's `offline · last known`/`offline` (FE-1/FE-5), positions' same two captions plus the coverage caption naming the marked count (FE-6), alerts' four N-5 faulted-banner blocks (FE-10), settings' non-blocking write-failure/session-resolving lines (FE-8), the quiet band's `unavailable`/`this cycle` split and `Setups unavailable this cycle.` (FE-11) — no surface found by this closer that dims without an accompanying named reason. |

### 7. Criterion 7a — OPEN, an owner decision, not a PASS (reported honestly, not smoothed)

**Not fixed by this lane; not re-measured differently; not marked as a PASS.** This closer independently
reproduced FE-13's and the GATE Z pass's own measurement inside this session's own e2e run (§5 above,
live console line): `positions-net-pl`'s `PanelContainer` (`PositionsPage.tsx:203-209`,
`maxWidth: 320, minWidth: 200, flexShrink: 0`) measures **`200px` wide / `15px` font-size at BOTH
1280px and 393px**. The declared 20px/17px container-step states are **structurally unreachable** for
this one consumer as shipped — not merely hard to reach, not a flaky measurement. This is the SAME
number FE-13 and the GATE Z pass both recorded; this closer did not adjust the assertion to match the
measurement (the test still only asserts a valid resolved size, never `20`/`17`, per FE-13's own
explicit instruction) and did not touch `PositionsPage.tsx`.

**Carried forward for the owner, unresolved:** either (a) the owner rules the readout should be
widened past 320px on desktop (a design tradeoff against the "Capital at risk" sibling cell and the
header row's `space-between` layout, with no design-canvas citation currently specifying a width for
this box — `design/src/screens/positions.mjs`'s `.pos-stats` row is content-sized with no explicit px
width), or (b) the owner rules a 200–320px content-sized stat cell legitimately sits at the 15px
literal-size step always, and 7a's specific 20/17 expectation for *this one consumer* is retired (the
criterion's general "every figure that renders at 20px base steps against its own panel" requirement
is otherwise satisfied structurally elsewhere in the phase — the `PanelContainer` ancestor exists,
named correctly, single instance). This closer makes neither ruling.

### 8. The `/positions` 900px overflow — a regression this phase introduced, found and fixed IN this phase (not carried debt)

**Recorded here as what it is, not smoothed into "pre-existing."** FE-13's original diagnosis called
this "pre-existing, GATE Z, not this phase's introduction" (BUILD_REPORT §FE-13 §3). The conductor's
review overturned that verdict with direct evidence (`git diff f8957d3f..HEAD -- PositionRow.tsx`
showing the offending `VISUALLY_HIDDEN`/wrapper/`aria-describedby` block did not exist at the phase-3
baseline `f8957d3f`, where the full suite passed 86/86 twice), and the GATE Z repair pass confirmed the
mechanism: FE-5's own `literal()` keyboard-reachable tips (U-15a) wrapped a visually-hidden
`aria-describedby` sibling in `position: absolute` with **no positioned ancestor**
(`PositionRow.tsx:168-173`, `display: 'inline-block'`, no `position`), so its containing block escaped
`positions-table-frame`'s `overflow-x: auto` scroll clip entirely, widening
`document.documentElement.scrollWidth` (`978` vs the `900px` viewport) independent of the frame's own
correctly-clipped `852px` box. **Fixed** (`5c07dc40`, `position: 'relative'` added to the wrapper) —
`documentElement.scrollWidth` measured `978 → 900` before/after, and this closer's own e2e run this
session (§5 above) shows `md 900 no-overflow · dark scheme › /positions fits 900px` **passing** as
test #82 of 100, part of the clean 100/100 run. **This is a real FE-5 regression, fixed within this
phase — not carried debt, not pre-existing.** A reviewer weighing phase 3's own defect count should
count this as "introduced and closed," not "inherited."

### 9. Named debt — `file:line` and phase, verbatim from SPEC §1 Out/Future plus PLAN's own three plus everything later lanes filed

| Item | `file:line` | Phase | Source |
|---|---|---|---|
| Per-symbol live marks on `/scanner` | (the phase that adds `market_session`/`live` to `/api/stream/prices`) | dated, next backend-fields phase | SPEC §1 Out/Future |
| The quiet-tape false-offline watchdog | `useLivePrices.ts:66,84-86`; `stream.rs:444-449` | **same** phase as above (a one-line backend fix criterion 67 forbids here) | SPEC §1 Out/Future |
| Alert-history re-labelling | `types.ts:32`; `AlertsPage.tsx:225` | additive, read-new-else-old, `message` retained, fixture from a pre-phase blob — not dated to a specific phase number | SPEC §1 Out/Future |
| Settings section navigation | `design/src/screens/settings.mjs:1,5,15,28-31` (canvas citation); rail ≥900 vs horizontal control <900 | **phase 4** — three behaviours (active-on-click-vs-scroll-spy, deep-link landing below 900, focus order) plus the 44px floor on the horizontal strip must be answered at phase 4's GATE I | SPEC §1 Out/Future, OWNER D-B |
| `TermHeatChart.tsx:105-106` | canvas-painted `atm_iv` text, no `data-figure-register`, unreachable by DOM assertion | explicit non-goal, no phase | SPEC §1 Out/Future |
| U-30 | `Setups.tsx:41` | withdrawn (SPEC §2.7) | SPEC §1 Out/Future |
| U-8's foot line | (settings-navigation-adjacent) | **phase 4** | SPEC §1 Out/Future |
| Scanner's five-band responsive column set + positions' laptop column drop | — | **phase 4** | SPEC §1 Out/Future |
| Server-owned alerts (multi-device sync) | — | post-go-live track, not a Curvature phase | SPEC §1 Out/Future |
| Broker tab real data | — | the `broker-connect` track | SPEC §1 Out/Future |
| `ScanTable`/`groups` zero-state lead-grouping price-merge bug | `Scanner.tsx` (`groups` computed pre-live-merge, passed to `ScanTable`); found in FE-4's own criterion-12 test-writing | unassigned, carried since FE-4 | BUILD_REPORT §FE-4 §3 (PLAN's own item 7) |
| `OrderRow.tsx:172`'s `⏸` | `features/trading/orders/OrderRow.tsx:172` | Z-1 (scope reading, orders excluded from FE-5's conversion tree) | PLAN item 7, `pauseGlyph.spec.ts`'s own live-checked EXEMPT for the two Broker sites also names this file class |
| Alerts-local refusal helper duplicating `FaultedBanner.tsx:92-117`'s treatment | `apps/dashboard/src/app/pages/alerts/AlertsPage.tsx` (the N-5 banner blocks, FE-10 §3) vs `shared`'s own `FaultedBanner.tsx:92-117` | unassigned — a shared-component consolidation opportunity, not a correctness defect | PLAN item 7 |
| **`positions-net-pl` `PanelContainer`'s unreachable 20/17 container steps** | `PositionsPage.tsx:203-209` | **filed for the owner ruling, not yet on SPEC's own Out/Future list** — this closer folds it in per PLAN's own instruction ("this closer pass is the first chance to fold it in or flag it for the owner") | §7 above, GATE Z (`4124322a`) |
| `PositionsView.tsx:280-289` (`positions-table-frame`) / `view.ts` condor structure-line width discussion | `apps/dashboard/src/app/features/trading/positions/PositionsView.tsx:280-289`; `view.ts` | phase unassigned; likely belongs beside phase 4's "positions laptop column drop" line — **NOTE: this specific `<body>`/`<html>` overflow instance was FIXED by the GATE Z pass (§8 above); FE-13's original write-up flagged the FRAME/condor width-tuning class of issue as a broader concern beyond the one instance that got fixed** — the frame's own general min-content-width tuning against a DIFFERENT width/host pair remains unaudited at 900px beyond the one fixed defect | BUILD_REPORT §FE-13 §3 |

### 10. Canon amendment queued for GATE S (not applied) + the Amendments question filed, not answered

- **Queued, not applied.** Rule 13 becomes *"traced to Convexa's computation **or to a record the
  trader entered**"* (**OWNER — D-D**). No canon file was edited by this build; the ruling is recorded
  here for GATE S to apply.
- **Filed, not answered.** Does the Icons row's colour-emoji clause reach `U+26A0` in a chip label
  (`labels.ts:196,205,211` — `'⚠ Stale'`, `'⚠ Error'`)? The chips ship **byte-identical either way**
  this phase (SPEC §1 Out/Future confirms `⚠` stays; ux's U-7 was withdrawn at source). This closer
  read `labels.ts:196,205,211` directly this session and confirms both strings are still present,
  unedited.

### 11. Three planning decisions a reviewer should see rather than re-derive

1. **Criterion 7a is proven in Playwright, not jsdom, by design.** SPEC §7 assigns container-query
   stepping to the browser tier; no criterion in the phase claims a jsdom proof of a rendered
   `@container` breakpoint (jsdom does not evaluate container queries at all — FE-6 §2 states this
   directly: "a real browser... jsdom cannot see this"). §7 above additionally now carries FE-13's
   and the GATE Z pass's own finding, reproduced a third time by this closer: the 20px/17px states are
   **structurally unreachable** on the one shipped consumer, not merely hard to reach.
2. **N-1's scan scope is the spec's three trees** (`features/trading/`, `pages/positions/`,
   `pages/scanner/`), not the whole app — `features/auth/`'s face de-binding is proven instead by
   FE-8's own component-level assertion (criterion 36), confirmed still green in this session's full
   run. RESUME's own gotcha 4 states the same boundary for future readers.
3. **The two GATE Z scope readings, Z-1 and Z-2, both with their reversals.** **Z-1**: `OrderRow.tsx`
   is outside FE-5's `⏸`-removal scope (`orders/` excluded from `pauseGlyph.spec.ts`'s scan per FE-5
   §1), carried as debt rather than silently swept in — named again in §9 above. **Z-2**: the
   `SESSION_DELTA_TIP` tooltip string drops its parenthetical `(⏸)` rather than finding a glyph host
   inside a plain tooltip string (copy-diff #10, §3 above) — a scope reading resolved in-lane by
   FE-5, not bounced.

### 12. Process note for the next phase — the FE-13 `git stash` deviation (gotcha 17)

**Recorded here per this closer's own instruction, not re-investigated.** FE-13's own session used
`git stash push -- <one file>` once, scoped to a single file, to compare a `format:write` mistake's
before/after on `BUILD_REPORT.md`, then immediately popped it back — against this lane's own binding
"never `git stash`" rule even when scoped to one file. The conductor verified no work was lost: all 27
untracked sibling files under `docs/research/convexa-business-review-2026-09-05/` were present and
unmodified before and after, and no stash entry from FE-13 was left behind. This closer's own `git
status` checks (start and end of this session, §5 above) reconfirm the same 27-file sibling directory
present and untouched. **Correction to this closer's own first draft:** `git stash list` is **not**
empty — it shows exactly one entry, `stash@{0}: On main: redesign-wip (abandoned 2026-06-29)`, whose
diff (`AuthDialog.tsx`, `Landing.tsx`, `theme.ts`, `.claude/BACKLOG.md`, etc.) is unrelated to
`curvature-v2-surfaces` and pre-dates this phase by over two months — a stale, abandoned artifact
from an unrelated earlier redesign effort, not FE-13's scoped stash/pop (which by RESUME's own account
popped cleanly within the same session, leaving nothing of its own behind). This closer did not touch
it (never `git stash`/`stash drop` on a tree another process may depend on) and flags it here rather
than silently asserting "empty" without having actually run the command. **The warning stands for
phase 4: use `git diff`/
`git show HEAD:<path>` to inspect an original version instead, even for one file, even briefly** — a
scoped stash is still a stash, and this repo's own tree is shared with at least one other process every
session.

### 13. Reviewer's open-item checklist (nothing here is a claimed PASS)

1. **Criterion 7a** — owner ruling needed, §7 above. Not fixable mechanically without a product/design
   call on `PanelContainer`'s intended width.
2. **The Amendments `U+26A0` question** — §10 above, filed, unanswered, zero build-visible consequence
   either way.
3. **The canon amendment (rule 13, D-D)** — queued for GATE S, not yet applied to any canon file.
4. **Named debt** (§9) — eleven items, none blocking, all dated or explicitly phase-unassigned as SPEC
   itself leaves them.
5. **V20 (interface conformance)** — NOT RUN this session (no reachable backend); BE-1 owns the
   backend-side verification next.

---

## BE-1 — Backend closer (`NO_BACKEND_CHANGE` verification, criterion 67)

**This task writes no product code.** Verification only, per PLAN's own BE-1 §. Repo root
`C:\Dev\convexa`, branch `spire/curvature-v2-foundations`. HEAD at start: `d64ab692`. HEAD unchanged
throughout this session (confirmed by `git rev-parse HEAD` before and after every step). Sibling
untracked directory `docs/research/convexa-business-review-2026-09-05/` — confirmed present (6
top-level entries) and untouched, start and end. `git stash list` reconfirmed: still exactly the one
pre-existing, unrelated `redesign-wip` entry from FE-13's session; not touched.

### 1. Empty three-dot diff, three scopes, all zero

```
git fetch origin main --quiet
git rev-parse origin/main   # a19d8d16b77f567e26fe6ca2b8edb130314f3c01
git diff --name-only origin/main...HEAD -- apps/api            | wc -l   # 0
git diff --name-only origin/main...HEAD -- libs/quant-engine   | wc -l   # 0
git diff --name-only origin/main...HEAD -- Cargo.lock Cargo.toml | wc -l # 0
```

All three counts **0**. Three-dot form used throughout (not two-dot), per PLAN's own caution. This is
the load-bearing evidence for `NO_BACKEND_CHANGE` (criterion 67).

### 2. Score identity — "before" baseline was never captured

Per this task's own launch briefing and confirmed independently this session: `grep -rl
"opportunity_score\|state_fingerprint"` across the whole `curvature-v2-surfaces/` contract directory
returns only `BRIEF.md`, `council/R1-architect.md`, `INTERFACE_CONTRACT.md`, `PLAN.md`, `RESUME.md`,
`SPEC.md`, `_context-pack.md` — none of which contains an actual captured bundle read from before
FE-1. **No pre-FE-1 baseline read exists anywhere in this contract's history.** This closer did not
fabricate one. The score-identity claim therefore rests on the empty three-dot `apps/api` diff (§1
above) — a byte-frozen backend cannot have produced a different score — not on a byte comparison of
two captured reads.

**The "after FE-13" read, taken this session**, `npm run ports:free` (exit 0, clean) → `npx nx serve
api` (background; Rust binary, already built, ~2s to bind `127.0.0.1:8000`) → two reads of
`curl -s localhost:8000/api/ticker/SPY`, both inside the same minute:

| Field | Read 1 (02:21:44 UTC) | Read 2 (same window) |
|---|---|---|
| `signals.opportunity_score` | `68` | `68` |
| `signals.opportunity_tier` | `actionable` | `actionable` |
| `ai_eval.state_fingerprint` | `e19a46563be7` | `e19a46563be7` |

Byte-identical across both reads within the cache window (the only diff between the two raw JSON
bodies is a handful of timestamp/vendor-refresh fields, not `signals.*` or `ai_eval.state_fingerprint`).
Vendor snapshot: `market_state.price = 770.19`, `market_phase = "closed_pre"` — a live vendor read, not
a stale/cold placeholder. **Conclusion, stated at the strength the evidence supports:** the before/after
byte comparison PLAN asked for **could not be performed** because the baseline was never taken in any
earlier session; what this session can and does certify is that the backend is provably untouched
(§1) and that a live read today is internally stable, which is the available substitute evidence for
score identity under `NO_BACKEND_CHANGE`.

### 3. Conformance receipt

```
node .claude/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/curvature-v2-surfaces/INTERFACE_CONTRACT.md --url http://localhost:8000 --report .spire/clusters/tech/contracts/curvature-v2-surfaces/conformance-receipt.json
```

Exit **0**:

```
interface_conformance — 2 endpoint(s)
  PASS  GET /api/scan (HTTP 200) — 22 required field(s) present + well-typed
  PASS  GET /api/ticker/{ticker} (HTTP 200) — 5 required field(s) present + well-typed

  0 endpoint failure(s).
```

Receipt's `endpoints[]` order: `GET /api/scan` **first**, `GET /api/ticker/{ticker}` second — matches
the contract's own `## Conformance spec` block order exactly (load-bearing per the contract's own
text: `/api/scan` runs first because it is answerable without any prior fetch). `required_checked`
counts (22 and 5) match the contract block's own field counts field-for-field.

**Reviewer probe answered directly:** the contract's `## Conformance spec` JSON pins all eleven
nullable `rows[].*` columns (`price`, `chg_pct`, `score`, `tier`, `regime`, `vol_regime`, `flip`,
`call_wall`, `put_wall`, `dist_to_flip_pct`, `dist_to_wall_pct`) as `"number|null"` or `"string|null"`
— re-read directly from `INTERFACE_CONTRACT.md` this session, none unmarked. The live sweep this
receipt ran against was non-empty (real symbols, real nulls on cold fields), so this was a real
per-row type check, not a vacuous pass over an empty `rows[]`.

Supersedes FE-14's V20 "NOT RUN" — a reachable backend was available this session and the real check
ran.

### 4. `npm run ports:free`

Before starting the server: `Nothing listening on :8000 :4200 :4300 — all clear.` exit **0**.
After stopping verification: `:8000  pid 75620  killed` / `Freed 1 listener(s).` exit **0**. No
orphan left on :8000, :4200, :4300, IPv4 or IPv6.

### 5. What a GATE Q reviewer must judge

1. **The score-identity evidence is diff-based, not byte-comparison-based**, because the "before"
   capture was never taken in any prior session on this phase (not this closer's omission — verified
   absent across the whole contract directory). If GATE Q requires an actual before/after byte match
   rather than an empty-diff argument, that capture cannot be retroactively produced and would need a
   policy call, not a re-run.
2. **Criterion 7a** (the unreachable `PositionsPage.tsx` container step) remains open, filed for the
   owner by FE-14/GATE Z — unchanged by this backend-only task, not this lane's to rule on.
3. This closer's own commit is docs/receipt-only: `conformance-receipt.json` (new file) plus this
   `BUILD_REPORT.md` section and `RESUME.md`'s status update. `apps/api`, `libs/quant-engine`,
   `apps/dashboard`, `SPEC.md`, `PLAN.md`, `INTERFACE_CONTRACT.md`, `decisions.md`, `design/` all
   untouched — confirmed via `git status --porcelain` before staging (only the receipt and
   `docs/research/...` sibling noise present; the sibling directory was left alone).

---

## GATE Z repair, pass 2 — GATE Q FAIL (91/4/0), findings 1–3, one latent duplicate, one observation

GATE Q returned **91 PASS / 4 FAIL / 0 UNVERIFIABLE** at HEAD `0304132d` (unchanged before and after
this pass). Criterion 7a stays an open owner decision, untouched. The three findings below are this
lane's; the two follow-ups (a latent FE-5 duplicate, the `/positions` offline observation) were
raised by QA but not classified as failures.

### 1. Findings 1 + 2 (criteria 9, 12 — SB) — the scanner table discarded the live-price overlay

**Diagnosis, confirmed at source before touching anything.** `Scanner.tsx:93-107`'s `groups` was
built from `scan.rows` — the raw, UN-overlaid polled rows — while `displayRows` (`:119-128`) applied
the live-price overlay on top. `ScanTable.tsx:290`'s `sections = groups ?? [{ rows }]` prefers
`groups` whenever it is defined, which is every non-account view (index-first-defaults AC-3's
zero-state lead-group partition) — the default. So the table rendered `groups[].rows` (no overlay)
while `ScanCardList` rendered `displayRows` (overlaid) — the exact QA reproduction: table `SPY —`
(`data-figure-state="empty"`), card `111.11` (`default`), same frame. Finding 2 was downstream of
finding 1: `priceOffline(sym)` (`Scanner.tsx:136-140`) keys on `live.prices[sym]` — real provenance —
but because the table never rendered the overlaid row, a stream drop could show the `offline-retained`
arm (dim + stroke pause + `offline · last known`) over the STALE, un-overlaid value, which on some
rows is the closed-nine `—` — a "last known" claim over nothing known.

**Fix, one mechanism, no second overlay implementation** (`Scanner.tsx`): `groups` is unchanged
(the structural partition), but a new `displayGroups` is derived by RE-SLICING `displayRows` — which
is exactly `polledRows` (= `groups.flatMap(g => g.rows)`) overlaid, in the same order — by each
group's original length. `ScanTable`'s `groups` prop now receives `displayGroups`, never the raw
`groups`. This was the option the task text preferred ("derive `groups` from `displayRows`") over
patching `ScanTable` to prefer one prop: `ScanTable`'s own doc comment already declares the invariant
"`rows` must equal the concatenation [of `groups`]", and slicing the ALREADY-overlaid `displayRows`
by the original partition lengths is the only change that keeps that invariant true while introducing
no second copy of the overlay logic (the risk `Scanner.tsx`'s own `[best-effort-isolated-or-null]`
comment already names). Finding 2 required no separate code change: once the table renders the
overlaid row, `priceOffline`'s existing predicate (`live.offline && live.prices[sym] != null`) is
already the correct provenance test against the value actually on screen — verified, not assumed (see
below).

**Regression test — reaches the defect the old one could not.** `scanner.register.spec.tsx`'s
existing `renderBoth` helper renders `ScanTable` directly with **no** `groups` prop at all, and its
`installLiveBackend` fixture deliberately used `view.source: 'account'` specifically to SKIP the
lead-group partition ("exercises `displayRows` directly rather than the zero-state lead-group path" —
its own comment) — so neither existing test could structurally reach `groups` being defined. The new
describe block ("GATE Z findings 1 + 2 (criteria 9, 12 — SB) — the table and card must agree on a
GROUPED view") mounts the REAL `<Scanner/>` component with `view.source: 'default'` and a megacap
symbol (`SPY`, in the closed `isIndexMegacap` set) so `groups` IS defined, plus a non-megacap symbol
(`AAA`) landing in `rest` — exercising both partition slices. `@mui/material/useMediaQuery` is
mocked so the SAME test can force `isNarrow` false (table) then true (card) against the SAME
fetch stub and the SAME `EventSource` event sequence, reading both layouts back for direct
comparison — jsdom has no `matchMedia`, so without this mock `<Scanner/>` can only ever render the
table, which is exactly why the OLD tests never rendered `<Scanner/>` at all.

**Poison run, confirmed red.** Temporarily reverted `groups={displayGroups}` → `groups={groups}` in
`Scanner.tsx` and re-ran the new test: `AssertionError: expected { text: '500.00', state: 'default'
} to deeply equal { text: '511.00', state: 'default' }` — the table showed the raw swept price
(500.00) instead of the overlaid live tick (511.00), reproducing QA's exact defect shape. Reverted;
green again.

**Measured, before/after, in the new test's own assertions (browser-equivalent — a real `<Scanner/>`
mount, real `EventSource` events, real DOM read):**
- Live tick, same frame: table `cell-price` = `511.00` / `default`; card `cell-price` = `511.00` /
  `default` — **identical**.
- Never-ticked symbol (`AAA`), same frame: table = `50.00` / `default`; card = `50.00` / `default` —
  **identical**, never `offline-bare` (criterion 13 unaffected).
- Stream drop: table `cell-price` (`SPY`) = `511.00` / `offline-retained`, caption `offline · last
  known`; card = **identical**. `AAA` stays `50.00` / `default` on both — no false retained claim on
  a symbol with nothing streamed.
- No `offline-retained` member ever carries the closed-nine `—` — every retained value observed was a
  real formatted number.

**Verification, exit codes:** `npx nx test @convexa/dashboard --skip-nx-cache -- src/app/pages/scanner/scanner.register.spec.tsx` **exit 0, 52/52** (was 51 before this task's one new test). Full suite
below (§4).

**Files:** `apps/dashboard/src/app/pages/scanner/Scanner.tsx`,
`apps/dashboard/src/app/pages/scanner/scanner.register.spec.tsx`.

### 2. Finding 3 (criterion 66) — the 44px coarse-pointer floor never reached inputs or selects

**Diagnosis, confirmed at source.** `theme.ts:132-137`'s coarse-pointer floor selector was
`button, [role="button"], a` — an `<input>` matches none of those, so every MUI text field and
number field escaped the floor entirely, not just the two controls QA measured. QA's census, all
under 44px at 393px/coarse: `RiskInputsSection.tsx:150` `risk-inputs-account-size` 160×37,
`:195` `risk-inputs-cap-value` 120×37 (both edited by this phase), `settings-ticker`/
`settings-persona` 311×38.6, the alerts composer's Symbol/Kind controls 361×38.6, plus
`ScanToolbar.tsx:74,104` chips at 40px.

**Fix, mechanism widened, one control class at a time, proven in a real browser.**
`theme.ts`'s selector gained `input` — confirmed sufficient for every raw `<input>` (`getComputedStyle`
read back `min-height: 44px` on the Symbol field's real DOM node). MUI `Select`'s own visible tap
target (`role="combobox"`) turned out to be UNREACHABLE from the global theme layer at all: MUI's
`SelectInput.js` self-duplicates its own class — `&.${selectClasses.select}` — with its own comment
"win specificity over the input base", landing at CSS specificity (0,2,0). A bare `[role="combobox"]`
(0,1,0) loses that fight outright; a SCOPED `sx` descendant selector (`'& .MuiSelect-select'`) ties at
(0,2,0) and STILL loses (specificity ties resolve by source order, and MUI's own component style wins
that race) — both confirmed by measuring `getComputedStyle(el).minHeight` on the real combobox node in
a running browser (21.5625px / 38.5625px effective height, unmoved, on both attempts). The fix that
actually wins: doubling the SAME class ourselves, locally, at each `<Select>` call site —
`'& .MuiSelect-select.MuiSelect-select': { minHeight: 44 }` inside a `'@media (pointer: coarse)'`
block — reaching specificity (0,3,0), unconditional. Applied to `SettingsPage.tsx`'s persona select
and `AlertsPage.tsx`'s Kind and Level selects (a shared `selectCoarseFloorSx` constant in
`AlertsPage.tsx`, inlined in `SettingsPage.tsx` for its one use). `theme.ts`'s own comment at the
floor rule now documents this precisely, including the negative result, so a future lane does not
re-attempt the same two dead ends.

**Measured, before → after, real browser (Playwright, `hasTouch: true`, 393×852):**
- `risk-inputs-account-size`: 160×37 → **160×44**.
- `risk-inputs-cap-value`: 120×37 → **120×44**.
- `settings-ticker` (a raw `<input>`): 311×38.6 → **311×61**.
- `settings-persona` combobox: 311×38.6 → **311×61**.
- alerts composer Symbol field: 361×38.6 → **361×61**.
- alerts composer Kind select: 361×38.6 → **361×61**.
- The three GATE-Z-pass-1 fixes stay confirmed repaired in the SAME run: Remove button 58.4×44,
  Switch `FormControlLabel` 163.3×44, off-exchange proximity chip 86.6×44.

**Desktop, proven unmoved — a real browser, no `hasTouch`, 1280px** (throwaway probe, deleted before
commit per the repo's own scratch-file rule): `settings-ticker` = 502×**38.5625**, `settings-persona`
combobox = 502×**38.5625**, alerts Kind select = 672×**38.5625** — byte-identical to the pre-fix
shipped height, because `@media (pointer: coarse)` never matches a fine-pointer context. The floor is
inert on desktop by construction, not by assumption.

**Carried debt, not fixed (outside this phase's own touch — `ScanToolbar.tsx` has zero commits this
phase per `git log f8957d3f..HEAD`):** `ScanToolbar.tsx:74,104`'s filter/segment chips render as
real `<button>` elements — they DO match the widened selector — but their own local `sx` sets
`minHeight: 40` via a generated class (specificity (0,1,0)), which TIES the bare `button` element
selector (0,0,1) at a HIGHER specificity and wins regardless of source order — the exact same
specificity-tie mechanism as the `Select` case above, one tier lower. Itemized here with `file:line`
for whichever phase next touches `ScanToolbar.tsx`; not fixed, per this task's own scope fence (only
controls this phase creates or touches are mandatory; QA's own census named these as "also under the
floor and unitemized" without attributing them to this phase's edits).

**Regression coverage — e2e, hard-asserted, not merely measured.** Three new tests in
`no-overflow.spec.ts`'s new describe block (`GATE Z finding 3 (criterion 66) — inputs and selects at
393px, coarse pointer`), each calling the existing `expectFloor` helper (width AND height ≥44,
`boundingBox()`-based). Browser-quality manifest bumped `100 → 103` in the required four-file
lockstep (`manifest.json`, `tools/lib/manifest.mjs`, `tools/manifest.spec.mjs`,
`quality-reporter.ts`'s `gateCounts.chromium`) — `node --test manifest.spec.mjs mutations.spec.mjs`
**exit 0, 7/7**; `npx playwright test --list` **103 tests in 7 files**.

**Verification, exit codes:** `npm run build` **0**; the three new tests plus the two GATE-Z-pass-1
tests plus the proximity chip test, run together, **exit 0, 4/4** then **exit 0, 1/1** (isolated
re-run); full e2e gate **exit 0, 103/103 passed, 0 flaky** (§4).

**Files:** `apps/dashboard/src/app/shared/theme/theme.ts`, `apps/dashboard/src/app/pages/alerts/AlertsPage.tsx`, `apps/dashboard/src/app/features/auth/SettingsPage.tsx`,
`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts`, `apps/dashboard-e2e/src/quality/manifest.json`,
`apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts`,
`apps/dashboard-e2e/tools/lib/manifest.mjs`, `apps/dashboard-e2e/tools/manifest.spec.mjs`.

### 3. Latent duplicate of the FE-5 regression, and the `/positions` offline observation

**Latent duplicate — fixed.** `PositionRow.tsx:645-655`'s `trend-help` wrapper (`data-testid=
"trend-help"`, shared by the table row AND `PositionCard` via the common `cellContent` function)
was `display: 'inline-flex'` with **no `position`**, exactly the FE-5 regression shape fixed at
`5c07dc40` for the `literal()` helper's own tips (`:154-197`, `position: 'relative'` present): its
`VISUALLY_HIDDEN` `aria-describedby` sibling (`position: 'absolute'`) had no positioned ancestor, so
it escapes to the initial containing block instead of staying local to the row. QA measured it
currently benign (x=840, within the 900px viewport at the seeded book+condor width), but latent —
exactly the shape that widened `document.documentElement.scrollWidth` to 978px before the original
fix, if a wider table or a longer trend column ever pushed this element further right. Fixed the
same way: `position: 'relative'` added to the wrapper (`PositionRow.tsx:653`).

**Whole-tree check for a third instance** — grepped for `VISUALLY_HIDDEN`/the clip-rect
visually-hidden pattern across the whole `apps/dashboard/src` tree (8 files matched). Two are the
PositionRow instances above (one already fixed, one now fixed here). The rest do NOT reproduce the
same risk: `OffExchangeBlocks.tsx`'s identical-shaped proximity-chip tip sits inside `Widget.tsx:341`'s
`position: 'relative'` root — a genuine positioned ancestor, confirmed safe. `FigureMarks.tsx`'s
`LiveDot`, `LivenessAnnouncer.tsx`, `OrdersWidget.tsx` and `OrdersPanel.tsx` all use the visually-hidden
technique WITHOUT an `aria-describedby`-paired sibling (a standalone SR-only label or live region, not
a "described element + hidden description" pair) — a different, lower-risk shape not in this
finding's class. One more genuine match was found and NOT fixed, out of this task's own scope
fence: `ScanCard.tsx:58,110`'s `scoreDescriptionId` span is the SAME "describedby + absolute
sibling, no positioned ancestor" shape (no `position` anywhere from the card root up through
`ScanCardList`/`Scanner.tsx`'s page root) — but scanner cards render in a single, full-width,
un-scrolled mobile column with no horizontal-scroll container to escape into, so it does not
reproduce the observable defect (confirmed by re-deriving the mechanism, not merely by inspection).
Itemized here (`file:line` above) as carried debt for whichever phase next touches `ScanCard.tsx`,
not fixed — it is outside this task's named scope (`PositionRow.tsx:645-655` only).

**Regression coverage.** `PositionRow.a11y.spec.tsx`'s existing `trend-help` test gained one
assertion: `expect(getComputedStyle(help).position).toBe('relative')`. Poison-confirmed red
(removed `position: 'relative'` from the wrapper, re-ran: `AssertionError: expected 'static' to be
'relative'`), reverted green.

**`/positions` offline observation — driven into `streamOffline` in a REAL browser, gotcha 8's
predicted route confirmed reliable.** QA could not drive `/positions` into `streamOffline` in a
browser (`page.route(abort)` + reload did not flip the banner within 60s, twice), leaving criteria
27a/27b/28/35e/U-9 resting on the unit suite alone. A throwaway Playwright script (deleted before
this commit, per the repo's own scratch-file rule) stubbed `window.EventSource` via
`page.addInitScript` before navigation — `streamTicker`'s watchdog (`PositionsPage.tsx:122-140`)
only arms its 15s gap timer (`STREAM_OFFLINE_MS`) inside the `onUpdate` callback, so the stub
delivered ONE real `LiveUpdate` (arming the watchdog, resolving a live mark via a stubbed
`/api/contract/**` route matching `no-overflow.spec.ts`'s own `stubResolvableContract` fixture),
then went silent. After the real 15s elapsed, `streamOffline` flipped true on its own, no fake
timers, no clock mocking.

**What was actually observed, real DOM, screenshotted:**
- `NET P/L (OPEN)` header readout (criterion 35e's retained arm): `⏸ +$520` with the caption
  `offline · last known`, plus a page-level banner "⚠ Live marks paused — P/L shown is from the
  last update. Records persist." — the offline caption, present, taking precedence, exactly as
  specified.
- The row's six live-derived cells, ALL showing the retained arm (criterion 27a: value + stroke
  pause icon + `offline · last known`, never a bare pause with nothing beside it — criterion 28):
  Mark `$3000` (dim, pause, caption), P/L `+$520` (pause, caption), P/L% `+21.0%` (pause, caption),
  Δ Entry `+$520` (pause, caption) — its own `aria-label` explicitly promises exactly this fallback
  ("falls back to the last-known mark if the feed drops"). Trend kept rendering its sparkline
  (a different, its-own-spec degrade — a gap/broken line per its own tooltip text, not the pause+
  caption pair the other five use).
- Record fields (U-9): `cell-contract` (TSLA $400 Call), `cell-structure` (Long call), `cell-qty`
  (2×), `cell-entry` ($2480 debit), `cell-max-loss` ($2480), `cell-expiry` (Aug 21) — **none** dimmed,
  **none** carrying a pause mark, exactly as U-9 promises. The Close action stayed present and
  clickable.
- This run did not exercise 27b/28's "no retained value" arm (the fixture's one leg had a
  resolvable mark throughout) — that arm's nearest evidence remains the unit suite QA already
  accepted (`positions.risk.spec.tsx`/`faulted.spec.tsx`), unchanged by this observation.

No product code was touched by this observation; it is evidence only, reported per this task's own
instruction ("report what you actually see").

**Verification, exit codes:** `npx nx test @convexa/dashboard --skip-nx-cache -- src/app/features/trading/positions/PositionRow.a11y.spec.tsx` **exit 0, 1/1**. Full suite below (§4).

**Files:** `apps/dashboard/src/app/features/trading/positions/PositionRow.tsx`,
`apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx`.

### 4. Whole-phase verification, this pass (HEAD `0304132d` unchanged start-to-end, confirmed before and after)

- `npm run typecheck` — **exit 0**, cold (`apps/dashboard/dist`, all `*.tsbuildinfo` deleted first).
- `npx nx test @convexa/dashboard --skip-nx-cache` — **exit 0, 239/239 files, 2857/2857 tests**
  (standing baseline 2856 + this pass's one new test).
- `npm run lint` — **exit 0**, 5 pre-existing warnings, 0 new (byte-identical to QA's own count).
- `npx nx format:check --files=<every file this pass touched>` — **exit 0** (one file,
  `scanner.register.spec.tsx`, needed a scoped `format:write` before the check passed; nothing else
  did).
- `node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/mutations.spec.mjs`
  — **exit 0, 7/7**.
- `npm run ports:free` — exit 0, clean, both first and last.
- `npm run build` — **exit 0** (production).
- `npx playwright test --list` — **103 tests in 7 files**.
- `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache` (against the
  production build) — **exit 0, 103/103 passed, 0 flaky**, manifest-complete (`[PASS] chromium —
  103/103 passed — 0 flaky`).
- `git rev-parse HEAD` / `git branch --show-current` — `0304132d` / `spire/curvature-v2-foundations`,
  confirmed unchanged before this pass's first commit and matching the launch prompt's stated start.
- `docs/research/convexa-business-review-2026-09-05/` — confirmed present, untouched, `git status`
  checked before and after every step; never staged.
- Criterion 7a — untouched, not re-derived, not re-argued; still the owner's open decision.
