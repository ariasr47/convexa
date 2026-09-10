# Repair task — the rest of `/ticker` to the design source (owner-directed, 2026-09-08)

**Owner:** on the 2026-09-08 fidelity audit's recommendation — *"proceed with your recommendations"*:
extend the structure-hero fidelity pass to the **rest of `/ticker`** before phase 4. Route: a direct
repair lane on the same rules as `STRUCTURE_HERO_REPAIR_TASK.md` (this folder), off the council
pipeline — the design source is the spec. Findings list: `fidelity-audit-2026-09-08/FIDELITY_AUDIT.md`
(F1–F4 and F9; F10's residuals if they fall out of the work). **Scope:** `/ticker/:ticker` only — the
masthead, the read strip, the tape-and-plan work grid, the context band, and the term-structure chart's
scheme/colour defect. The structure hero (just repaired), the scanner, positions, alerts and settings
are **not** in scope.

## Target (read these before touching anything; verify every anchor with `grep -n`)

`design/src/screens/desk.mjs`: masthead `:255-288` (`.mast` — bare on the ink; display `SPY 573.12
+1.84 · +0.32%`; chips row; the second line `Levels @ · Structure as-of · refreshes · All expirations`;
quick row of eight + `Universe member · 69 tracked names`; compact inline `EXPIRATIONS` / `PERSONA`
fields; one amber CTA) · read strip `:332-350` on `DESK_CSS :29` (`1.35fr repeat(7, minmax(0,1fr))`,
title-less strip, hairline-split cells, the opportunity **ring**, sub-captions) · the work grid
`DESK_CSS :32` (`minmax(0,8fr) minmax(0,4fr)`) with `aiRead()` `:216-254` on the left and the `.side`
column `:351-393` (Live tape 2×2 figures + flow spark · Your position · Sim orders) · the context band
`:395-421` (`ctx-head` with `All · Flow · Vol · Positioning`; `ctx-grid` on `DESK_CSS :43`
`repeat(3, minmax(0,1fr))`; `contextCard()` quiet cards; Market context as **one** 2×2 card; Term
structure as `termRibbon` tenor chips + slope; Setups as two cards in a 2-col span). Rendered oracle:
`design/site/desk.html` served from `design/site/` — open it beside the app at 1440 / 1280 / 834 / 390.
The library page `design/site/library.html` has every component state.

Widths and bands: canon Tokens row *Breakpoints / container queries*, and
`design/src/screens/responsive-spec.mjs`. The phone docks the AI read as a bottom sheet (already
shipped — keep it).

## Must not change (semantics phases 1–3 paid for — the audit found them faithful)

- The single liveness predicate (`isDeliveringLive`), the branded `LiveClaim`, `useStreamLatch`, the
  connection chip's six states and its copy (`connection/`), the stream-fed dots only on tape figures.
- `figureStateOf` / `faceFor` as the state and face authority; the closed not-a-number vocabulary
  (canon 24, nine members); Mono = traced, Sans = asserted-untraced (canon 13/23).
- The AI read's **content** in every state — verdict first, the risk fields, provenance, the A1c annex,
  the amber-text closed list (canon 16), cooldown / cap / signed-out / no-key arms, the bottom sheet at
  phone width. This task re-houses the read in the design's wide panel; it does not rewrite a state.
- The structure hero as repaired (`StructureHeroPanel`, ladder, tape row, path row, foot).
- Canon 11 (field form), 14, 18, 22 (liveness gated), 21 (quiet panels never lift).
- `apps/api` diff stays **0**. `OrderRow.tsx:172` untouched (Z-1). No literal NUL bytes. LF only.
- The audit harness and its evidence folder (`fidelity-audit-2026-09-08/`) are the **baseline** — never
  write captures into it.

## Changes (most severe first)

1. **Tape & plan (F1)** — `TickerDashboard.tsx` bento (`:535`, spans at `:660`): the work row becomes
   the design's `minmax(0,8fr) minmax(0,4fr)` grid at ≥ 1000 px container — `widget-ai-rec` in the wide
   column; `widget-live-tape`, the position brief (`position-brief`) and `widget-orders` stacked in the
   side column at the design's proportions (tape ≈ 295 px with a 2×2 figure grid — `LiveTape.tsx:45`'s
   auto-fill becomes two columns in that width — and the flow spark; position ≈ 138; orders ≈ 208). The
   "Your book" full-width bar is absorbed into the side column's position card. Below 1000 the column
   stacks under the read (design order: read → tape → position → orders).
2. **Context band (F2)** — one `Context` header with the `All · Flow · Vol · Positioning` filter
   (filter is presentational until the band carries categories — render it, wire `All` only, no invented
   state), then a `repeat(3, minmax(0,1fr))` grid of **quiet** cards at the design's density:
   Projected dealer flow (two limbs + one note, ≈ 267 px); **Market context as one card with a 2×2 of
   values** (`MarketContext.tsx:477` — the four sub-cards' bodies collapse to label / value / one-line
   basis; the full detail moves behind the card's expand `⤢`, which `Widget` already has); Term structure
   as tenor chips + `contango · near-dated vol cheapest` + `slope` (the ribbon), **not** a 230 px canvas
   over 240 px of air; Straddle-implied move as headline + range bar; Fresh positioning at three rows
   (the rest behind expand); Off-exchange three bars; Setups as cards in a 2-col span; Add widget last.
   Every card keeps its basis and as-of line (canon: the band carries its own basis). Target ≈ 700 px
   for the band at 1280.
3. **Masthead (F3)** — `widgets/chrome/CommandDeck.tsx:267`: drop the raised panel — the masthead is
   bare on the ink; display symbol + mid. **The bundle carries no prior close, signed change or instrument name**
   (checked against the saved real bundle: `market_state` has `price` / `gex_spot` only) — so the
   design's `+1.84 · +0.32%` and `SPDR S&P 500 ETF` are **omitted**, not faked and not rendered as
   `—`; file them as an API follow-up in this folder's `RESUME.md` (`apps/api` stays untouched here).
   The chip row (regime · connection chip · `● Last trade`); the second line; the quick row of eight from the universe with
   `Universe member · N tracked names` (the universe reader is apps/dashboard/src/app/pages/ticker/useUniverseMembership.ts, apps/dashboard/src/app/pages/scanner/ViewEditorDialog.tsx, apps/dashboard/src/app/pages/scanner/labels.ts; the shipped quick row lives in apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.tsx); `EXPIRATIONS` / `PERSONA` as compact inline fields (the shipped
   selects re-skinned, same ids and testids); the `TICKER` input moves into the ⌘K palette's job — keep
   it reachable (the design has no bare ticker input on the desk; the palette opens with ⌘K / Ctrl+K,
   `shell/AppShell.tsx:31` — there is no `/` shortcut, do not invent one).
   Keep `data-testid="command-deck"` and every testid the e2e uses (`grep -rn` the e2e dir first).
4. **Read strip (F4)** — `widgets/read-strip/ReadStrip.tsx`: no Widget title/subtitle (the strip is
   the frame); cells on `1.35fr repeat(7, minmax(0,1fr))` split by hairlines, so eight fit at 1280
   with **no clip**; the opportunity cell carries the score ring; every cell gets its sub-caption from
   the model where the bundle supports one (`readStripModel.ts`), `—` otherwise; ⓘ moves to the cell
   label row per canon 13. Below ~1000 px container the strip may scroll as a rail (canon 15/17) —
   never clip.
5. **Term structure (F9)** — `widgets/term-structure/TermHeatChart.tsx:7-13, :62-77`: delete the
   module hex literals; take `palette` / `surfaces` by identity from `extrasFor(theme)` like
   `WallMagnetView` does after the hero repair; the IV line is `signal` or phosphor, never `#2ecc71`;
   the heat uses the theme's direction pair only where the value is signed. Remove the exemption at
   `shared/theme/hex-discipline.spec.ts:70-71` — the file's own liveness check requires it. Light scheme
   must render the card on the light panel.
6. **Hero residuals (F10, only if cheap)** — the Gamma-flip row wrap (shorten the distance to the
   percentage, dollar delta in the row's title) and the `● mid · tape` header chip.

## Verification the lane owes (exit codes, not printed summaries)

- `npx nx typecheck @convexa/dashboard --skip-nx-cache` → 0 · `npx nx test @convexa/dashboard
  --skipNxCache` → 0 (delete `node_modules/.vite` first if a phantom `_mutation_poison_*` appears).
  Assertion edits only where an assertion pinned layout or copy this task changes; list each with the
  reason. · `npm run lint` → 0 · `npm run format:check` → 0.
- `git diff --stat origin/main...HEAD -- apps/api` → empty. NUL scan of every touched file → 0.
- **The composition gate — the audit harness, against a fresh production build:**
  `npx nx build @convexa/dashboard --configuration=production`, then
  `AUDIT_OUT=<repo>/.spire/clusters/tech/state/spire-curvature-v2-foundations/ticker-repair-after
  npx playwright test --config apps/dashboard-e2e/playwright.audit.config.ts --grep "desk-real"`
  (copy `fidelity-audit-2026-09-08/_tools/` and its `.gitignore` into the new folder first; the
  `desk-real` plans read `_tools/spy-bundle-2026-09-08T1059Z.json`). Report, from the JSON census,
  at 1280 dark: masthead ≤ 200 px · read strip ≤ 130 px, eight cells, none clipped · the AI read wider
  than the side column and the side column ≤ 420 px · context band ≤ 800 px · page ≤ 3,000 px
  (design 2,570). At 1440: page ≤ 2,950. At 834 and 390: `overflowX` false, page within +25 % of the
  design (3,336 / 4,379). At 1280 light: no dark-filled canvas in the band. Quote the numbers.
- e2e: `npm run ports:free`, then `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --
  --grep "desk|curvature|overflow"` against the production build; report counts and exit code.
- Screenshots of `command-deck`, `widget-read-strip`, `widget-ai-rec`, `widget-live-tape` and the band
  at 1280 (dark and light) saved **outside the repo** or in the `ticker-repair-after/` folder (PNGs
  are gitignored there); paths reported.

## Rules

Build lane on Sonnet. Never `git stash`; never a bare `nx format:write` (scope with `--files`);
conventional commits with scope on this branch (`fix(dashboard): …`), one commit per numbered change,
**no push**. Verify every anchor above with `grep -n` before acting — anchors drift. If a change would
require touching a must-not-change item, stop and write the question into this folder's `RESUME.md`
under a `GATE Z` heading instead of working around it.

## Pass 2 — owner: "Do all four" (2026-09-08, after the conductor's cold verification)

The owner took all four recommendations in the conductor's re-verification (`TICKER_FIDELITY_REPAIR_REPORT.md`,
last section). Three are this lane's; the fourth (the Live tape flow sparkline) is a **backend** item and is
filed in `context/BACKLOG.md` ("Harvest — 2026-09-08") — do not build it here, `apps/api` stays untouched.
Everything in "Must not change" above still binds, with ONE owner-granted exception: change 7 may edit the
structure hero's **header** (and the shared `Widget` header) for the phone wrap — nothing else in the hero.

7. **Hero header collapses at 390 (owner leave granted for the header only).** Evidence:
   `ticker-repair-verify/crops/app-hero-real-390-dark-top.png` vs `design-hero-real-390-dark-top.png` — the
   title truncates to `S…` and the subtitle wraps one word per line into a ~70 px column. Cause: in
   `shared/ui/Widget/Widget.tsx:205-285` the header row is `flexWrap: { xs: 'wrap', sm: 'nowrap' }`, but the
   title region (`Box sx={{ minWidth: 0, flex: 1 }}`, `:240`) shrinks to nothing before the actions region
   (`flexShrink: 0`, `:266-275`) ever wraps. Below `sm` the title region must keep the row (e.g.
   `flexBasis: { xs: '100%', sm: 'auto' }` — the design's phone `widgetHead` is title + `● mid · tape` chip on
   one row, actions on the next, `design/src/screens/desk.mjs:289-296` + `lib.mjs` `widgetHead`). The
   `● mid · tape` chip stays beside the title; the `FIELD | MAGNET` toggle takes the second row; the legend
   is already hidden below the 1000 container (`StructureHeroPanel.tsx:362`). This is a shared-header change:
   check every desk widget's header at 390 in the harness capture, not just the hero. **Threshold:**
   `widget-structure-hero` ≤ 950 px at 390 (design 905); page at 390 ≤ 5,520 (design 4,416 + 25 %).
8. **Remove the `IvRank` card from the context band (owner ruling, recorded in
   `context/DECISION_LEDGER.md`).** It is not in the design's `ctx-grid` list (`desk.mjs:395-421`) and it
   repeats the read strip's IV-rank cell. Unmount it at `TickerDashboard.tsx:794-801`; keep the component
   and its unit spec (the quiet-band register spec scans source files, `quiet-band.register.spec.tsx:42` —
   unchanged). Two e2e lists name it and must drop it with the ruling as the reason:
   `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts:521` (`HOVER_INFO_WIDGETS`) and `:629`
   (`FRAME_INFO_SITES`) — check whether AC-35's "eight frame roots" count is asserted anywhere else
   (`grep -rn "eight\|FRAME_INFO_SITES.length" apps/dashboard-e2e/src`). Check `TickerDashboard.tsx`'s
   own comment at `:794` and any widget-order spec (`ticker-hierarchy.spec.tsx`). **Threshold:** report
   the band span at 1280 (expected ≈ 970 after the removal; the ≤ 800 density target stays an open owner
   item — do not cut fields to reach it).
9. **Masthead: the controls join the headline row at laptop width and up.** `CommandDeck.tsx:291` stacks
   `TickerHeader` (tier 1) above `TickerToolbar` (tier 2) above `QuickSymbols`; the design's `.mast`
   (`desk.mjs:255-288`) puts `EXPIRATIONS` / `PERSONA` / the amber CTA on the **headline's right** (one
   row), then the chip row, then the second line, then the quick row. At ≥ 1100 viewport
   (`theme.breakpoints`, the same authority `TickerHeader.tsx:289-290` already uses for its
   `xs: column / sm: row`), render the toolbar's two fields and the CTA in the headline row's right region;
   below 1100 keep today's stacked order. Same ids, testids and `aria-label`s (`grep -rn` the e2e dir for
   `ticker-toolbar`, `command-deck`, `quick-`). **Threshold:** `command-deck` ≤ 200 px at 1280 and 1440
   (design 186); no overflow at 834 / 390.

Verification, gates and rules as in the sections above; the harness run goes into `ticker-repair-after/`
(`--grep desk-real`) after a fresh production build; append a `## Pass 2` section to
`TICKER_FIDELITY_REPAIR_REPORT.md` with the same tables (before = the conductor's verified numbers:
page 2,818 / 2,818 / 3,848 / 5,566; `command-deck` 243; hero at 390 1,137; band 1,052). One commit per
change, no push.

