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
