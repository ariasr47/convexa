# BUILD_REPORT — curvature-v2-foundations (frontend)

Written by the Frontend Executioner / closer lane. Covers FE-1…FE-11. Evidence over assertion:
every count below was run this session, exit codes checked directly (not printed summaries).

## 1. Verification track (PLAN.md's table, run in full)

| # | Command | Result |
|---|---|---|
| V1 | `npx vitest run src/app/shared/theme` | exit **0** — **15 files / 98 tests** (≥14 files, >75 tests required) |
| V2 | `npx vitest run src/app/shared/ui/arc.spec.ts` | exit **0** — **1 file / 9 tests**; `git diff --quiet -- .../arc.spec.ts` exit **0** (file unamended) |
| V3 | `npx vitest run src/app/pages/ticker/widgets/_kit` | exit **0** — **6 files / 57 tests** (≥5/≥30 required); `StatTile.spec.tsx` gone, `FigureCell.spec.tsx` present |
| V4 | `npx vitest run src/app/features/trading/positions/tint.spec.tsx` | exit **0** — **1 file / 13 tests**, exact match |
| V5 | `npx vitest run src/app/pages/ticker/connection` | exit **0** — **3 files / 32 tests** |
| V6 | `npx vitest run src/app/shell` | exit **0** — **7 files / 53 tests** |
| V7 | `npx nx test @convexa/dashboard` | exit **0** — **213 files / 2347 tests**, at/above the 127/17 2026-09-03 baseline |
| V8 | `npm run typecheck` | exit **0**, clean across every TS project (dashboard, dashboard-e2e, api's contract check) |
| V9 | `npm run ports:free && npx playwright install chromium && npx nx e2e dashboard-e2e` | exit **0** — **75/75 passed, 0 flaky** (re-run twice for stability; both green) |
| V10 | `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list \| grep -c curvature-v2` | **7** (≥1 required) |
| V11 | `git diff --name-only $(git merge-base main HEAD)..HEAD -- apps/api \| wc -l` | **0**; also `git status --porcelain -- apps/api` → **0** (working tree, not just history) |
| V12 | `node .claude/tools/interface_conformance.mjs ...` | **NOT RUN — no reachable backend** (`curl localhost:8000` → unreachable), NO_BACKEND_CHANGE exemption, recorded honestly rather than started |
| V13 | `npm run lint` / scoped `npm run format:check -- --files <changed>` | exit **0** both (see §5 — 4 real lint errors found and fixed along the way, not silently left) |

No suite was silently declared green from a printed summary; every number above came from a direct
`echo $?`/count read on this run.

## 2. Radius per-site list (ruling 4 / AC-45b) — all 38 sites from the pre-FE-3 baseline grep

`shape.borderRadius` moved **10 → 12** (`tokens.ts:87`). MUI's `sx` prop treats a **bare number** as
a multiplier of this token (`createUnaryUnit`); a **string** (`'12px'`) or a native `style=` prop is
a literal, untouched by the token. Four roles are declared: **PANEL** = `shape.borderRadius` (12),
**CONTROL** = 8 (`MuiButton`/inputs/`MuiToggleButton` overrides), **DIALOG** = 16
(`MuiDialog.styleOverrides.paper`), **PILL** = 999 (visually saturates regardless of the exact
multiplier). "Rendered radius changed" means a real visual difference a screenshot would show.

| # | file:line | before → after | role / mechanism | rendered radius changed? |
|---|---|---|---|---|
| 1 | `tokens.ts:87` | 10 → 12 | PANEL token definition (the source) | yes — every unscaled PANEL consumer |
| 2 | `_kit/FigureCell.tsx` (was `StatTile.tsx:47`) | 12 → 12 | `CellCard = styled(Card,...)`, `borderRadius: theme.shape.borderRadius` (direct literal, not sx-multiplied) | no — reads the token directly, tracks it by construction |
| 3 | `Widget/Widget.tsx` (card + selected ring) | `'12px'`/`'16px'` literals → `borderRadius: 1` (sx, PANEL role) | sx numeric multiplier | **yes**, 12→12 (1×12=12, coincidentally unchanged in px but now token-derived, not a hardcoded string) |
| 4 | `Widget/Widget.tsx` (Dialog paper) | `'16px'` literal → deleted, inherits `MuiDialog` override | DIALOG role | no (16→16, now single-sourced) |
| 5 | `AuthDialog.tsx:190` | 2.5 (25px) → deleted, inherits `MuiDialog` override | DIALOG role | **yes**, 25px → 16px |
| 6 | `CommandPalette.tsx` (palette paper) | new dialog, no local override | DIALOG role (inherits 16) | n/a (new surface) — **and a real, separate defect found and fixed here**: an earlier `borderRadius: 2` local override would have WON over the theme role via `sx` precedence (24px, not 16px); removed, see §6 |
| 7 | `TopNav.tsx` control-role sites (search field/pill, kbd chip) | control radius now via `MuiButton`/input overrides (8) | CONTROL role | yes where previously ad hoc |
| 8–9 | `FlowRibbonsLab.tsx:167`, `TapePulseLab.tsx:186`, `WallMagnetLab.tsx:178`, `TermHeatLab.tsx:162` (4 sites) | bare `12` → literal `'12px'` | native `style=` prop, never sx-multiplied | **no** — converted to string form only to close `radius-scale.spec.ts`'s static-scan blind spot; the render was always a literal 12px |
| 10–13 | `StructureFieldWebGL.tsx:985,998,1012` (3× `12`) | bare `12` → literal `'12px'` | native `style=`/canvas overlay | no, same reason |
| 14 | `StructureFieldWebGL.tsx:1029` | bare `8` → literal `'8px'` | native tooltip-overlay style object | no |
| 15 | `StructureFieldCanvas.tsx:874` | bare `8` → literal `'8px'` | native tooltip-overlay style object | no |
| 16 | `WallMagnetView.tsx:148` (canvas) | bare `8` → literal `'8px'` | native `style=` on `<canvas>` | no |
| 17 | `Landing.tsx:74` | `999` unchanged | sx, PILL | no (999×10 and 999×12 both saturate) |
| 18 | `AlertsPage.tsx:174` | `1` unchanged literal, sx | sx multiplier | **yes**, 10px → 12px |
| 19 | `ErrorBoundary.tsx:69` | `1` | sx multiplier | **yes**, 10 → 12px |
| 20 | `ValueCard.tsx:110` | `1.5` | sx multiplier | **yes**, 15 → 18px |
| 21 | `Refused.tsx:45` | `1` | sx multiplier | **yes**, 10 → 12px |
| 22 | `Setups.tsx:35` | `3` (Card sx) | sx multiplier | **yes**, 30 → 36px |
| 23 | `ComingSoonBox.tsx:34` | `2` | sx multiplier | **yes**, 20 → 24px |
| 24 | `gex-profile-chart/chart.tsx:62` | `0.5` (Box sx) | sx multiplier | **yes**, 5 → 6px |
| 25 | `ai-rec/reasoning.tsx:136` | `2` | sx multiplier | **yes**, 20 → 24px |
| 26 | `FreshPositioning.tsx:54` | `1.5` (Box sx) | sx multiplier | **yes**, 15 → 18px |
| 27 | `CustomizationToolbar.tsx:333` | `999` (pill factory fn, consumed via sx) | sx multiplier, PILL | no (saturates) |
| 28 | `OrdersWidget.tsx:42` | `2` (Box sx) | sx multiplier | **yes**, 20 → 24px |
| 29 | `OffExchangeBlocks.tsx:68` | `1.5` | sx multiplier | **yes**, 15 → 18px |
| 30 | `ComingSoonCard.tsx:25` | `999` (Chip sx) | sx multiplier, PILL | no |
| 31 | `ComingSoonCard.tsx:39` | `1.5` | sx multiplier | **yes**, 15 → 18px |
| 32 | `TickerToolbar.tsx:115` | `0` | sx multiplier | no (0 × anything = 0) |
| 33 | `SettingsPage.tsx:67` | `2.5` (Card sx) | sx multiplier | **yes**, 25 → 30px |
| 34 | `AiRecPanelBlocks.tsx:96` | `3` | sx multiplier | **yes**, 30 → 36px |
| 35 | `AiRecPanelBlocks.tsx:369` | `3` (Box sx) | sx multiplier | **yes**, 30 → 36px |
| 36 | `DecisionCard.tsx:341` | `2` (Box sx) | sx multiplier | **yes**, 20 → 24px |
| 37–38 | `RiskInputsSection.tsx:161,205` | `1` (×2, input sx) | sx multiplier | **yes** ×2, 10 → 12px |
| 39 | `AccountControl.tsx:60` | `999` (Button sx) | sx multiplier, PILL | no |
| 40–41 | `AiKeySection.tsx:423,552` | `2.5` (×2) | sx multiplier | **yes** ×2, 25 → 30px |

(The list runs 1–41 because the panel-token definition and FigureCell's own site are additive
call-outs beside the original 38-line grep; the 38 original grep hits are rows 3, 5, 8–41 excluding
the two additive rows — every original line is accounted for above with an explicit before/after.)

**Net effect**: the PANEL-role numeric-multiplier sites (roughly two dozen of the 38) got a real,
visible 20% larger corner (their previous literal was `N × 10`; it is now `N × 12`); the DIALOG and
CONTROL roles collapsed onto their own single theme declarations (several literal overrides deleted,
one new defect caught and fixed at the palette — see §6); the WebGL/canvas `style=` sites were never
theme-driven and are unchanged in render, only converted to string literals so the structural test
can see them.

## 3. Spacing occurrence count (AC-45c)

Measured 2026-09-04 by running the banned-literal scan with the exemption list empty: **49
off-ladder spacing occurrences across 26 files** (`spacing-ladder.spec.ts:26-28`). The architect's
number (SPEC §2.2 / PLAN FE-3) was **86 occurrences across 35 files** — recorded there explicitly as
**the architect's figure, never independently verified**; this measured 49/26 is the number beside it
per PLAN FE-3 Step 5, not a replacement of it. Named burn-down phase: **not yet scheduled** — the
`EXEMPT` list in `spacing-ladder.spec.ts` is live-checked (a stale entry that stops matching fails the
test), so it cannot silently rot, but no phase has been assigned to zero it out.

## 4. The 44px carried debt (AC-34b) — itemized, file:line, phase attached

Ruling 5 narrowed AC-34 to controls this phase creates or touches: the palette dialog + rows, the
burger drawer, the nav links, the connection chip (if interactive), `FigureCell`'s ⓘ. Two real gaps
were found and **fixed in this build** (not carried as debt):

- `CommandPalette.tsx`'s `PaletteRow` (`role="option"`, not `button`/`[role="button"]`/`a`) was
  structurally invisible to the theme's `@media (pointer: coarse)` floor — fixed with an explicit
  local `minHeight: 44` under the same media query.
- The signed-out 393px TopNav (search icon + `AccountControl`'s "Log in"/"Sign up" pair + hamburger,
  simultaneously) measured a real horizontal overflow (410px vs 393px) — fixed via a tighter `xs` gap
  and `size="small"` on the search/hamburger icon buttons; the coarse-pointer floor still guarantees
  their real touch target regardless of the `size` prop (confirmed: the floor targets the bare
  `button` element, independent of MUI's `size`).

**Carried debt (outside the narrowed set, named with a phase, not fixed here):**

| Control | file:line | Why it's outside the floor | Phase |
|---|---|---|---|
| Inline primary nav links (`nav-scanner`/`nav-ticker`/`nav-positions`/`nav-alerts`) at `md`–`laptop` widths (900–1099px) | `TopNav.tsx:159-184` (the `Box component={NavLink}` row) | Rendered as `<a>` with the browser's default `display: inline` — `min-height`/`min-width` do not apply to non-replaced inline boxes (CSS spec), so the coarse-pointer floor is a documented no-op here even though the selector matches. A touch tablet in the 900–1099px band (e.g. a portrait iPad-class device) hits this band. | Not assigned — this phase's own new touch coverage (AC-34) is scoped to 393px only, matching the ruling's literal text; a wider phase should re-test 900–1099px on a real touch device before assigning a fix. |
| The look-alike widgets' own body content (everything **other than** the AccessibleHelp ⓘ this phase added) | `IvRank.tsx`, `MarketContext.tsx`, `StraddleMove.tsx`, `DealerFlowProjection.tsx` | Ruling 6 fixed the six ⓘ sites only; the widgets' remaining structural gaps (no register enforcement, no container steps, any other non-`button`/`a` interactive-looking element) were explicitly left out of phase 1 by that ruling. | Named in ruling 6 as belonging to "the phase that rebuilds them" — not this one. |

**GATE Q bounce (2026-09-04) — the row above is a CATEGORY, not the itemization AC-34b requires; QA
correctly failed it ("no line numbers and no measurement... which control fails is undetermined").
Corrected below by actually reading all four files, not superseding the row above (append, not
rewrite) — the corrected finding is that the category resolves to zero undetermined controls:**

A structural scan of all four files for every shape an interactive control can take in this codebase
— `onClick`/`onPointerDown`/`onMouseDown`/`onKeyDown`, `role="button"`, `IconButton`, `ToggleButton`,
`<Tabs>`, `<Select>`, native `<input>`/`<label>`/`<select>`, `tabIndex`, `cursor: pointer`, `href` —
returns **zero matches** in all four files **outside** the six `AccessibleHelp` ⓘ sites ruling 6
already converted (each file is a single self-contained component with no sibling files besides its
own `.spec.tsx`/`copy.ts`/`index.ts` — confirmed by directory listing, not assumed). Two candidates
were read in full to rule them out by hand, since a regex alone can't tell "control" from "decoration":

| Candidate | file:line | Verdict |
|---|---|---|
| A `Tooltip` wrapping the IV-rank band label (`ivr-band`) | `IvRank.tsx:171-179` | **Not a control.** Wraps a plain `<Typography data-testid="ivr-band">` — no `onClick`, no `role`, no `tabIndex`. The band value itself is always visible; the tooltip only adds supplementary explanation on hover (unlike the six ⓘ sites, where the icon is the ONLY way to see the text at all). Not one of ruling 6's six named sites, and not a 44px question — there is nothing here to tap. |
| A static `Chip` marking wide quotes | `StraddleMove.tsx:98-104` | **Not a control.** No `onClick`/`onDelete`/`clickable` — MUI renders a non-interactive `Chip` as a plain label, not a `<button>`/`role="button"`. Decorative status marker only. |

**Itemized conclusion (AC-34b's own bar): there is no undetermined or failing interactive control in
these four widgets outside the six already-fixed ⓘ sites.** The six ⓘ sites are real `<button>`
elements (the shared `AccessibleHelp`/`IconButton` primitive already used by `FigureCell`), so they
match the theme's `button, [role="button"], a` coarse-pointer selector (`shared/theme/theme.ts:80-102`)
by construction and are not carried debt. The prior row overstated undetermined risk as accepted debt;
this scan closes it rather than widening the itemization.

## 5. `steel2` contrast, both schemes (AC-42) — measured, not asserted for light

**BEFORE — the state this section originally recorded, kept verbatim (superseded below by owner ruling 7):**

`steel2` = `extras.textTertiary` (dark: `rgba(138,155,180,0.85)`, light: `#61708A`). Measured via the
standard WCAG relative-luminance formula against the real surface colors in `tokens.ts` (dark alpha
values composited onto the surface first):

| Scheme | Surface | Contrast |
|---|---|---|
| Dark | `ink` `#0B0F17` | **5.18:1** |
| Dark | `panel` `#131A24` (widget/paper background) | **4.83:1** |
| Dark | `well` `#0D121B` (inset body background) | **5.10:1** |
| Light | `white` `#ffffff` | **5.01:1** |
| Light | `paper` `#F6F6F3` (page background) | **4.63:1** |
| Light | `panelRaised` `#ECECE7` (widget card background) | **4.23:1** |

The **dark floor is asserted** by canon ("≥4.8:1 panel/5.2:1 ink") and both measurements land right
at/above it (4.83, 5.18). **The light floor is not stated in the canon** (SPEC §9 D-1) and this
build does not invent one — but the light measurement on the widget card surface itself
(`panelRaised`, 4.23:1) is **below** the WCAG AA 4.5:1 normal-text minimum, which is worth an owner
ruling given `panelRaised` is where a real `textTertiary` label (e.g. a caption or figure sub-label)
would actually sit in light mode. Recorded, not gated — no test asserts a light floor.

**AFTER — owner ruling 7 (2026-09-03, `council/decisions.md`): darkened, and now GATED, not just narrated.**

Ruling 7 required the value to clear WCAG AA 4.5:1 "on every light surface where `textTertiary` can
actually appear," determined from the code, not assumed. A full source grep (`extrasFor(theme).*` /
`extras\.` / `extrasLight\.`, every match outside `shared/theme/`) found the real consumers:

| Extras key | Light hex | Real consumers found |
|---|---|---|
| `panelRaised` | `#ECECE7` | Dialogs (`AuthDialog.tsx`, `TradeEntryDialogView.tsx`, `OrderDetailDialog.tsx`), toolbars (`CustomizationToolbar.tsx`, `ScanToolbar.tsx`), table row hover (`ScanTable.tsx`), positions view, **and inside a real ticker widget** — `PositionBrief.tsx:292`'s basis-label chip, `color: 'text.secondary'` painted directly on it. The **darkest** surface with a real consumer — the binding floor. |
| `well` (`ink2`) | `#F1F1EC` | The **inset body of 7 real ticker widgets** (`MarketContext`, `StraddleMove`, `LiveTape`, `DealerFlowProjection`, `DealerPositioning`, `StructureHistory`, `IvRank` — all `bodyVariant="inset"`) plus `TopNav.tsx`'s search-trigger button (`text.secondary` painted directly on `extrasFor(t).well`). Not measured in the BEFORE table above — an omission this ruling's evidence pass caught: **the original value (`#61708A`) also fails here, 4.42:1.** |
| `background.default` / "paper" | `#F6F6F3` | The page canvas. |
| `background.paper` | `#ffffff` (white) | `Widget.tsx`'s own card root (both inline and the expanded overlay) and `FigureCell.tsx`'s `CellCard` — i.e. the actual home of a figure sub-label once one is wired to this token. |
| `panelRaised2` (`raised2`) | `#E3E3DD` | **Zero real consumers anywhere in the app.** Defined in `tokens.ts` only; touched only by `token-parity.spec.ts` (AC-41 key-set/value parity) and `banned-literals.spec.ts` (AC-44 literal ban) — neither renders it. `Widget.tsx` (read in full, including its "selected" ring and hover states) never uses it either. **Deliberately excluded from the floor** on this evidence; guarded live (see the spec below) so the exclusion cannot go stale silently. |

**Value chosen: `#5D6B84`** (same hue/saturation family as the original, stepped one notch darker — the
conductor's "candidate 1"). Measured:

| Scheme | Surface | Contrast | vs BEFORE (`#61708A` / dark unchanged) |
|---|---|---|---|
| Dark | `ink` `#0B0F17` | **5.18:1** (unchanged — dark value not touched) | — |
| Dark | `panel` `#131A24` | **4.83:1** (unchanged) | — |
| Dark | `well` `#0D121B` | **5.10:1** (unchanged) | — |
| Light | `panelRaised` `#ECECE7` | **4.54:1** ✓ (was 4.23 ✗) | +0.31 |
| Light | `well` `#F1F1EC` | **4.75:1** ✓ (was 4.42 ✗ — newly discovered failure) | +0.33 |
| Light | `paper` `#F6F6F3` | **4.97:1** ✓ (was 4.63) | +0.34 |
| Light | `white` `#ffffff` | **5.38:1** ✓ (was 5.01) | +0.37 |
| Light | `panelRaised2` `#E3E3DD` (excluded, recorded not gated) | 4.18:1 ✗ | +0.29, still short |

**Why `#5D6B84` and not the conductor's second candidate (`#58657D`, which also clears `raised2` at
4.56:1):** `raised2` has zero real consumers (above), so clearing it is un-evidenced — and it is not
free. Computed the same way: `#58657D` measures **5.88:1 on white**, which would exceed
`text.secondary`'s own composited contrast there (`rgba(0,0,0,0.6)` on white = 5.74:1) — i.e. tertiary
text would read with *more* contrast than secondary text, inverting the token family's own
quieter-than-secondary hierarchy on that surface. `#5D6B84` stays under it on every surface (max
5.38 vs secondary's 5.74). Re-evaluate against `#58657D` if `panelRaised2` ever gets a real consumer.

**Now gated, not just narrated:** `apps/dashboard/src/app/shared/theme/steel2-contrast.spec.ts` (new)
asserts the dark floor (previously canon-only prose, never a red-buildable check — `grep textTertiary`
outside `tokens.ts` hit only `token-parity.spec.ts`/AC-41 and `banned-literals.spec.ts`/AC-44, neither
of which computes contrast) AND the new light floor, plus a **liveness guard** that red-builds the
day any component starts consuming `panelRaised2` — the exact trigger to redo this exclusion.

**Mirror + verifier:** `design/tokens/tokens.json` (`color.light.steel2` and the `additions.steel2`
annotation) updated to `#5D6B84` and re-generated into `design/site/` via `node design/src/build.mjs`
(38 canvas artboards + `site/library.html` + `site/tokens.css` + `site/tokens.json`, each a
single-line `--steel-2` substitution — diffed and confirmed to carry no unrelated change).
`node design/src/verify-tokens.mjs` exits 0. **Gap found, not fixed (out of this task's scope):** the
verifier's structured `checks` array covers only the original 10 v1-era keys × 2 schemes (20 checks,
matching the canon's "20/20" note) — it does not check `steel2` or any of the other six v2 additions
(`ink2`/`well`, `raised2`/`panelRaised2`, `line`, `line2`/`lineStrong`, `scrim`, `glass`) at all, so
its exit-0 does not itself machine-prove the `steel2` mirror match (confirmed by hand-diffing
`design/tokens/tokens.json` against `tokens.ts` instead). A future drift in any of the seven v2
mirror values would go undetected by this tool today.

## 6. AC-20a status and the real defects this build's own verification work found and fixed

**AC-20a: green.** The declaration-only container-step reader (`type-floor.spec.tsx`) was hardened
this phase to see `@container` at-rules (its old form was structurally blind to them); it now checks
the full squashed style text for the exact wrapped pattern
`@containerpanel(max-width:359.95px){.${cls}{font-size:17px;}}` — the 359.95px boundary (not a naive
360px) was verified empirically against `theme.containerQueries('panel').down(360)`'s real output
before being hardcoded into the assertion. Never marked green by any other route.

Beyond AC-20a, the real-browser layer (FE-10) surfaced four genuine defects that a jsdom-only
component suite structurally cannot see (no real layout, no real click/tap event timing) — all four
reproduced live, root-caused, fixed, and re-verified:

1. **The condensed sticky connection chip never actually rendered, ever** (`CommandDeck.tsx`).
   `position: sticky` lived on the INNER bar, whose direct parent (`deck-sticky-reveal`) was
   `overflow: hidden` with `maxHeight` capped at 64px and sat, un-stuck, right above the (much
   taller) deck — so by the time a real scroll had gone far enough for the hand-off sentinel to
   reveal the bar, that ~64px-tall containing block had already scrolled fully out of view, leaving
   the "sticky" child with no box left to render inside. Confirmed via a live geometry probe (the
   bar rendered at `top: -373px`, not `0`) and fixed by moving `position: sticky; top: 0` to the
   OUTER wrapper, whose real containing block is the full-page-length `<Box>` `TickerDashboard.tsx`
   renders it inside. Re-verified: the bar now pins at `top: 0` and stays pinned after a further
   1500px of scroll.
2. **Signed-out 393px TopNav overflow** — see §4.
3. **`AccessibleHelp`'s Tooltip silently failed to open on the FIRST real click/tap into an
   unselected widget** (`AccessibleHelp.tsx`). `Widget.tsx` wires both `onClick={onSelect}` and
   `onFocus={onSelect}` on the card root; selecting a widget grows its header (drag-grip + Expand +
   Configure controls), reshuffling content below it — a mouse click or touch tap is a
   down-then-up pair at fixed coordinates, and the `down` half focuses the ⓘ and (via bubbling)
   selects the widget mid-gesture, the header grows, everything shifts, and the `up` half lands on
   stale coordinates. Confirmed live (hover alone opens it every time; a raw `.focus()` call opens
   it; a real click/tap into an unselected widget fails every time; a second click, once selected,
   succeeds). Fixed with `stopPropagation` on both `onClick` and `onFocus`, matching the pattern
   `Widget.tsx` already uses for its own header controls (Expand/Close).
4. **`AccessibleHelp` was a 700ms long-press on touch, not a tap** (`AccessibleHelp.tsx`). MUI
   `Tooltip` defaults `enterTouchDelay` to 700ms; confirmed live that a genuine quick tap
   (`touchstart` immediately followed by `touchend`) never opens it, while holding past 700ms does.
   "Reachable by tap" (ruling 6) means an ordinary tap. Fixed with `enterTouchDelay={0}`. The e2e
   AC-35 test itself was also corrected to dispatch a realistic touch gesture (a real ~40ms hold)
   rather than Playwright's `.tap()` convenience method, which fires `touchstart`/`touchend` with no
   gap at all — faster than any human finger, and fast enough to race even a 0ms-configured delay.

All four are shipped fixes, re-verified: full `nx test` still 213/2347 green, full `nx e2e
dashboard-e2e` 75/75 green (run twice for stability), `npm run lint` and `typecheck` both exit 0.

### AC-20b — the sanctioned `review` fallback's own record (added at the GATE Q bounce, 2026-09-04)

QA correctly found this row missing: the fallback SPEC §3 sanctions ("drop to `review` with both
measured sizes written into the build report") was taken by `curvature-v2.spec.ts`'s AC-20b test, but
the measurement itself was never copied here. `LiveTape` and `DealerPositioning` are both `span={2}`
(`LiveTape.tsx:133`, `DealerPositioning.tsx:71`), so every shipped screen renders them at the SAME
panel width at every breakpoint — there is no wide/narrow pair to compare without re-laying out a
surface, which this phase's non-goals forbid. Recorded UNVERIFIABLE, not softened into a pass.

Measured live (`npx nx e2e dashboard-e2e`, 393px viewport, single-column bento, real Chromium):

```
[AC-20b evidence] 393px viewport, single-column bento (both widgets span=2, so both panels
are the SAME width by construction): live-tape=17px dealer-positioning=17px
```

Both values are the 360px-step size (20px base → 17px under 360px), confirming the traced figures
render and the declaration (AC-20a, green) is reaching the DOM — the two widgets simply never differ,
by construction, so the row stays `UNVERIFIABLE` rather than `PASS`.

## 7. Banned-literals near-miss (from FE-1)

Three sites carry `rgba(138,155,180,0.3)` as a **numeric** literal (`0.3`, not the exact string
`0.30` the banned-literal scan's exact-string mechanism matches) inside native canvas/WebGL tooltip
style objects, not MUI `sx`:

- `StructureFieldCanvas.tsx:873`
- `StructureFieldWebGL.tsx:1028`
- `FlowRibbonsLab.tsx:73`

These render identically to the banned `rgba(138,155,180,0.30)` (JS numeric literals don't carry
trailing zeros) but are invisible to a scan keyed on the literal source text `0.30`. Not fixed in
this build (out of the narrowed radius/spacing scope); named here so the scan's blind spot is a
known, recorded gap rather than a silent one.

## 8. Review-only ACs (no visual-diff gate exists for this feature)

These are named `review`, not asserted by an automated test, per PLAN's own scope for this phase.
**This build did not perform a screenshot/visual review pass for them** — no browser preview tool
was available in this lane's toolset this session (Read/Edit/Write/Bash only); the e2e layer's own
Playwright screenshots (captured incidentally during live-repro debugging in §6) are structural
evidence of real rendering, not a systematic per-scheme visual audit. Flagging honestly rather than
claiming a review that did not happen:

- **AC-13b** — the Opportunity cell in both schemes.
  **GATE Q bounce (2026-09-04): reviewed, and the criterion is unsatisfiable as written, not merely
  unreviewed.** The Opportunity cell renders `42 · Watch` as one string in Plex Mono at
  `color: 'text.primary'`, identical in both schemes — `FigureCell`'s `ValueGlyph` hardcodes
  `text.primary` and exposes no per-word/value colour, so no amber word is reachable in ANY tier. The
  criterion's premise was already false before this phase: the deleted `StatTile` also defaulted
  `valueColor` to `text.primary`, and `DealerPositioning` never passed a different one — the tier's
  amber lived only in `accentColor={tierColor}`, which AC-13a requires this phase to delete. The "no
  replacement colour, never directional" half of AC-13b **holds** (verified: no colour differs by
  tier or direction anywhere in the cell). The other half — "the single amber word already inside the
  value string" — cannot be satisfied without adding a colour the same row forbids, so there is no
  code fix available; this routes to a **spec amendment** (align AC-13b with the shipped reality: tier
  emphasis survives as the tier **word**, in type, no colour), not a build defect. Not fixed in code
  per instruction — reported for the amendment queue instead of inventing a colour to pass the row.
- **AC-13c** — a greyscale capture of the dealer-positioning strip.
- **AC-14**, **AC-43**, **AC-45**, **AC-49**, **AC-50** — five greyscale captures on one surface.
- **AC-22a** — ticker × two schemes.
- **AC-22b** — five screens × two schemes, each named.
- **AC-12c** — the six announcement sentences quoted as rendered.

**Recommendation**: a dedicated visual-review pass (with a real browser preview tool, or a
`spire-tech-design-review`-style pass with screenshot capture) should close these before GATE Q, or
GATE Q should perform it directly.

## 9. Canon Amendments owed (filed at close, none blocking)

1. **Rule 24** (closed not-a-number vocabulary) lists 6 members
   (`.spire/clusters/tech/context/DESIGN_SYSTEM.md:179`); ruling 3 extended the shipped vocabulary to
   **9** (adding `not recorded` · `no basis` · `not provided`). The rule's own text calls a 7th
   member an "Amendments event" — this build's 9-member vocabulary (`shared/copy/notANumber.ts`) is
   that event, ruled, not silently done; the rule text needs updating to list all nine.
2. **Rule 13** ("Offline keeps the last known value... and says so") does not state that the
   `· last known` caption clause is **conditional on a retained value existing** — `FigureCell.tsx`
   only appends it on the `offline.retained` branch (F4), never on the bare-offline/no-retention
   branch (F5). One-line clarification owed.
3. **Rule 18** ("One connection chip per page... A second liveness claim anywhere on the same page is
   the failure this rule exists to stop") should record that it is **chip-scoped**: a conforming
   `FigureCell`'s own per-figure live dot (rule 13's label-row liveness marker) is a different,
   narrower claim ("this one number is live-derived") and is not "a second liveness claim" in rule
   18's sense (the page-level connection state). Recorded so a future reviewer does not read the two
   rules as contradicting each other.

## 10. Files touched (frontend only; `apps/api` diff is empty — confirmed §1 V11)

See the session's final response for the full path list (absolute paths). Summary by area: theme
tokens/enforcement specs (`shared/theme/*`), the new `FigureCell` primitive replacing `StatTile`
(`_kit/*`), the connection-chip resolver/renderer (`pages/ticker/connection/*`, new), `CommandDeck`/
`TickerHeader`/`TapePulseStrip` (chip wiring + the sticky-bar fix), `TopNav`/`Footer`/`AppShell`/the
new `CommandPalette` (nav trim, ⌘K palette), `AccessibleHelp` (the two real defects in §6), six widget
files converted to the shared help pattern, and the e2e layer (`no-overflow.spec.ts` amended, new
`curvature-v2.spec.ts`, `playwright.config.ts`'s `testMatch`, and — not named in PLAN's own FE-10 file
list, added because V9 could not otherwise pass — the Chromium test-inventory manifest
(`quality/manifest.json`, `tools/lib/manifest.mjs`, `tools/lib/summary.mjs`, `quality-reporter.ts`,
and their own tool-level tests), bumped from the frozen `pre-feature-52-v1`/52 baseline to
`curvature-v2-foundations-75-v1`/75 to match the 23 real Chromium tests this phase added.

## 11. GATE Q bounce (2026-09-04) — cause-level fixes, before/after evidence

QA_REPORT.md returned 72 PASS / 8 FAIL / 1 UNVERIFIABLE, GATE Q: FAIL. Four findings needed a code
fix; three needed this report corrected (§4, §8, and the new AC-20b entry in §6 above); one
(AC-13b) needed neither, per instruction. `apps/api` diff stays empty throughout (confirmed again at
the end of this section). Nothing here weakens a test to make it pass.

### Finding 1 — the live dot and the widget pulse outlived the live state (AC-1b, AC-16, AC-11)

**Cause (one, not three symptoms).** Two predicates answered "is this live?" for the SAME page: the
chip resolver (`connection/connectionState.ts`) checked `market_session` before `live.live`, but
`LiveTape.tsx`'s `numbersActive = st ? displayActive : isLive && !streamOffline` never looked at
`market_session` at all, and during session-tape replay `numbersActive` tracks `displayActive`
(true while the tape plays back real numbers) — neither is "is this the delivering live stream". The
three `FigureCell`s' `live` prop, and the `Widget`'s own `live` prop (which gates `widgetLivePulse`),
were both wired off `numbersActive`/`netFlow != null`, not off the chip's own concept of live.
`LiveTape` also never passed `replay` to `FigureCell`, so F6 (SPEC §4.1: replay figures get "no live
dot, no pause mark") was unreachable on the shipped page even though `FigureCell` already implements
that branch.

**Fix.** One predicate, one place: `isDeliveringLive(live, streamOffline)`, added to
`sessionTapeStanding.ts` (the module already imported by both consumers, so `connectionState.ts`'s
pinned two-importer set is untouched). `resolveConnectionState`'s `'live'` branch now calls it instead
of re-deriving the same boolean inline; `LiveTape.tsx` computes `isDeliveringLiveNow` from the SAME
raw `live`/`streamOffline` and uses it for the three figures' `live` prop, the `Widget`'s `live` prop,
and (AC-11) `flashActive` — plus `replay={Boolean(st)}` on all three live-derived cells, making the
dot unreachable BY CONSTRUCTION during any replay standing, not merely false by data. VWAP is
untouched (always static, `live={false}`, no `replay`) — it is a REST bundle field, not a replay
artifact. `numbersActive` itself is unchanged (still governs whether values move at all — F6's "full
strength" replay numbers still render).

- `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts` — new `isDeliveringLive` export.
- `apps/dashboard/src/app/pages/ticker/connection/connectionState.ts` — `resolveConnectionState`'s
  `'live'` arm calls it; doc comment corrected (previously named `genuineIsLive`, which is the wrong
  predicate for exactly this reason).
- `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx` — `widgetLive`, `flashActive`,
  and the three `live=` props switched from `numbersActive`-derived booleans to `isDeliveringLiveNow`;
  `replay={Boolean(st)}` added to Net flow / Spread / Gamma flip.

**Before/after (the DOM-observable dot)** — see finding 2's census test, which is the evidence for
this finding (both fail-red and pass-green states recorded there).

**AC-11's "widget bar"/"tick flash" halves — a harness limit found and worked around, not skipped.**
`widgetLive`/`flashActive` both reduce to `isDeliveringLive(live, streamOffline)` — the identical
function the dot and the chip's `'live'` kind use — so proving the predicate correct proves all three
motions share one, now-correct gate; `grep` confirms `LiveTape.tsx` calls no other "is this live"
function. A DIRECT jsdom render assertion of the WIDGET's own CSS pulse was attempted and rejected
after empirical proof, not assumption: a throwaway prototype rendering `<Widget live={true}>` then
`<Widget live={false}>` in the same file found `animation:widgetLivePulse` present in the joined
`<style>` text in BOTH cases — emotion's injected stylesheet is cumulative across renders in a test
file (unmounting does not retract an already-inserted CSS rule), so a text-scrape cannot tell "this
render's" pulse state from "some earlier render in this file also used it once." This is the same
class of jsdom limit SPEC §2.5 already documents for AC-20a/AC-20b (no real layout, no real CSS
cascade) — recorded here rather than shipping a test that would pass for the wrong reason. Closed
instead with a new, fast, DOM-free unit test suite directly on `isDeliveringLive` itself
(`sessionTapeStanding.spec.ts`, 5 new tests: genuinely-live true; closed-with-a-live:true-glitch
false, with `genuineIsLive` on the SAME input shown to disagree — proving it's the wrong predicate,
not just an untested one; every replay standing false; offline and no-payload false; venue-not-
ticking false) — exhaustive over finding 1's exact scenarios, and the mechanism both the dot and the
widget pulse depend on.

| Run | Command | Result |
|---|---|---|
| `isDeliveringLive` unit coverage | `npx vitest run src/app/pages/ticker/sessionTapeStanding.spec.ts` | exit **0** — **13/13 passed** (8 pre-existing + 5 new) |

### Finding 2 — the required dot-census test did not exist (AC-1c)

**Cause.** `LiveTape.spec.tsx` and `DealerPositioning.spec.tsx` never rendered together and never
counted `figure-live-dot`; `ConnectionChip.spec.tsx`'s "five non-live arms" test only asserts the
chip's OWN dot. No test could have caught finding 1.

**Fix.** New `apps/dashboard/src/app/pages/ticker/live-dot-census.spec.tsx` — mounts `LiveTape` +
`DealerPositioning` together, publishing into the REAL `liveTapeStore` (never a hand-derived
`isLive`/`displayActive` override) so it reads exactly what `TickerDashboard` feeds both widgets in
production. 13 tests: the live case (exactly 3 dots; VWAP + all 12 dealer-positioning cells dotless,
enumerated — `toHaveLength(4)` / `toHaveLength(12)`), the five non-live chip kinds including the
closed-with-a-`live:true`-glitch case, and all seven replay standings (`starting`/`playing`/`gap`/
`ended`/`fault`/`not-this-ticker`/`drop`) — the replay cases also assert `data-figure-state="replay"`
with a REAL rendered value, proving F6 is reachable, not merely dotless by an absent value.

**Evidence, run against this session's own uncommitted edits (exit codes read directly, not printed
summaries):**

| Run | Command | Result |
|---|---|---|
| BEFORE (pre-fix `LiveTape.tsx`) | `npx vitest run src/app/pages/ticker/live-dot-census.spec.tsx` | exit **1** — **7 of 13 failed**: the closed+glitch arm (`expected 3 to be 0`) and six of seven replay standings (`playing`/`gap`/`starting`: `expected 3 to be 0`; `ended`/`fault`/`not-this-ticker`: `expected 'empty' to be 'replay'`, proving F6 was unreachable) |
| AFTER (post-fix) | `npx vitest run src/app/pages/ticker/live-dot-census.spec.tsx` | exit **0** — **13/13 passed** |

### Finding 3 — the data-signal class predicate was never tested (AC-54)

**Cause.** `single-motion-moment.spec.ts` asserted keyframe INVENTORY (the right three names, one
home each) but never asserted the GATE — whether each name's `animation:` invocation actually sits
behind a live condition and a reduced-motion condition. Inventory equality is necessary but not
sufficient: it stayed green while `widgetLivePulse` ran on `closed` (finding 1), because nothing
checked the gate, only the name. The header framed the three as "exempt BY DECISION" (an enumerated
allowlist), not the tested class canon rule 22 requires ("A pulse ... may only run while a genuine
stream is delivering; when it drops they stop").

**Fix.** Added `isLiveAndReducedMotionGated(src, keyframeName, liveGatePattern,
reducedMotionGatePattern?)` to `single-motion-moment.spec.ts` — true only when the keyframe's
`animation:` invocation is present AND both an explicit live-gate pattern and a reduced-motion-gate
pattern (default: the CSS `@media (prefers-reduced-motion: no-preference)` wrapper; override for
`liveDotPulse`, whose reduced-motion gate is JS-level in a different file, `copy.ts`) match. Four new
tests: a fixture-based MUTATION GUARD (matches the file's own established idiom), a real-source
assertion for all three homes (`Widget.tsx`, `ConnectionChip.tsx`+`copy.ts`, `OrderRow.tsx`), and two
PREDICATE VIOLATION mutation proofs that string-transform the REAL `Widget.tsx` source (never a
hand-authored fixture that could drift from the real file) to strip the live gate and the
reduced-motion gate respectively, proving the predicate rejects both.

**A deliberate precision fix inside the same change, recorded because it nearly shipped wrong:** an
early version of the reduced-motion check fell back to a whole-file `/!reduced\b/` scan when no
override was given. `Widget.tsx` uses `!reduced` twice for its UNRELATED View-Transition logic
(`useExpand`, lines 92/447) — the naive scan made the predicate vacuously pass on ANY file mentioning
`!reduced` anywhere, not necessarily gating the keyframe in question. Caught by the real-source test
failing for the wrong reason during authoring; fixed by making the reduced-motion pattern an explicit,
overridable parameter with a documented default, never an unscoped file-wide fallback.

**Evidence — a REAL file mutation, not only the in-memory string-transform mutation proofs shipped in
the suite:**

| Run | What | Result |
|---|---|---|
| Poisoned | `sed` replaced `...(live &&` with `...(true &&` in the real `Widget.tsx` (backed up first) | `npx vitest run src/app/shared/theme/single-motion-moment.spec.ts` → exit **1**, 2 of 12 failed (the real-source assertion and the live-gate mutation-proof test, exactly the two that read `widgetLivePulse`'s gate) |
| Reverted | `diff` against the pre-mutation backup → byte-identical | `npx vitest run src/app/shared/theme/single-motion-moment.spec.ts` → exit **0**, 12/12 passed |

### Finding 4 — the palette fabricated a freshness figure on the `error` arm (AC-29)

**Cause.** `shell/CommandPalette/format.ts`'s `relAge(epochS, nowS)` treated any finite number as a
real timestamp, including the wire's epoch sentinel `as_of: 0`
(`apps/api/src/services/scanner/projection.rs`: `project_error` clones `project_building`, which sets
`as_of: 0.0`, and only flips `status`). `format.spec.ts` only exercised the `error` arm with a
plausible `as_of` (1990 against `NOW_S = 2000`); the sentinel was never tested.

**Fix.** `relAge` now returns `null` for `epochS <= 0`, not only for `null`/`undefined`/non-finite —
one change at the shared helper (not a `case 'error'`-only patch), so `stale`'s and `ok`'s `asOf`
fallbacks get the same protection against the same sentinel, consistent with `[absent-is-not-none]`
being a closed-vocabulary rule, not a per-status one.

**Evidence:**

| Run | Command | Result |
|---|---|---|
| BEFORE (pre-fix `format.ts`) | `npx vitest run src/app/shell/CommandPalette/format.spec.ts` | exit **1** — 2 of 14 failed: `expected 'as of 33m ago' to be null` (fixture `NOW_S=2000`) and, at a REAL wall-clock `now`, `expected 'as of 496825h ago' to be null` — reproducing QA's exact observed shape (`496824h`, off by the one second of wall-clock drift between the two runs) |
| AFTER (post-fix) | `npx vitest run src/app/shell/CommandPalette/format.spec.ts` | exit **0** — **14/14 passed** |

### Full re-verification (exit codes read directly)

| Check | Command | Result |
|---|---|---|
| Dashboard suite | `npx nx test @convexa/dashboard --skip-nx-cache` | exit **0** — **215 files / 2377 tests** (baseline 214/2353 + 24 new tests in 1 new file — `live-dot-census.spec.tsx` ×13, `format.spec.ts` ×2, `single-motion-moment.spec.ts` ×4, `sessionTapeStanding.spec.ts` ×5) |
| Typecheck | `npm run typecheck` | exit **0** |
| Lint | `npm run lint` | exit **0** (one new `@typescript-eslint/no-inferrable-types` error caught and fixed in `single-motion-moment.spec.ts` before this row went green; remaining warnings are pre-existing and untouched by this bounce — confirmed via `git status --porcelain` on `useSessionArchive.ts`) |
| e2e | `npm run ports:free && npx nx e2e dashboard-e2e` | exit **0** — **75/75 passed, 0 flaky**, first run (the `broker-grouping.spec.ts` flake QA saw once did not recur) |
| Design tokens mirror | `node design/src/verify-tokens.mjs` | exit **0** |
| `apps/api` diff | `git diff --name-only -- apps/api \| wc -l` and `git status --porcelain -- apps/api \| wc -l` | **0** and **0** |

No suite was declared green from a printed summary; every number above came from a direct exit-code
read or count on this run, same discipline as §1.
