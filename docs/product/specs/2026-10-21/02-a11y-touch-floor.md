# Accessibility floor: named overlays, 44px touch targets, readable text, one tab stop per chart, a title on every page

_Proposal, 2026-10-21. Revised 2026-10-22 after the skeptic review. Kind: ux-polish. Size: L. Depends on: none._

Code citations are against `main@8ef735c4` (2026-10-22). Two commits landed after the audits' `791ebd88`, so a few line numbers differ from the audit notes. Where they moved, this spec gives the current number.

## Why

The four UX audits ran 2026-10-22 against staging and production at 390x844 (touch) and 1440x900, in both colour schemes. This batch holds 7 of the audits' 14 high-severity defects. It also holds the only serious axe failures across the 72 shell page loads. A reviewer who opens axe or Lighthouse on the portfolio meets these first. Most fixes go into shared primitives: the theme floor, link styles, the chart frame's table twin, a scroll-region hook and one title hook. Specs 3 and 4 then build on correct floors instead of fixing them again.

What the audits measured, re-checked for this spec with `tmp/ux-audit/spec-a11y-touch-floor/probe.mjs`, `probe2.mjs` and `probe3.mjs`, and again in review with `tmp/ux-audit/review-a11y-touch-floor/probe.mjs` to `probe5.mjs` (all read-only, no sign-in):

**Overlays have no name (SLT-01, TD-02).**
- The Cmd-K palette's `role=dialog` paper has no `aria-label`. Its `aria-labelledby` is `_r_7_`, and no element has that id. Measured on staging at 1440 on 2026-10-22. Cause: `aria-label` sits on the Dialog root (`shell/CommandPalette/CommandPalette.tsx:385`), which has `role=presentation`. MUI 9.2 always generates an `aria-labelledby` for the paper (`node_modules/@mui/material/Dialog/Dialog.js:274`, `:309`).
- The phone nav drawer is a dialog with no name (`shell/TopNav.tsx:353-359`). Its `slotProps.paper` carries only `sx`.
- The simulated trade dialog has no name (`features/trading/tradeEntry/TradeEntryDialogView.tsx:505`). Its title is a plain `Typography` (`:532`).
- The 'View sample export' drawer has no name (`pages/ticker/widgets/ai-rec/StateExportDrawer.tsx:177`). It renders up to six `<pre>` blocks, one per `ExportSection` (7 call sites, `:258` to `:331`; `:271` and `:278` are alternatives). Each is drawn at `:394` with `maxHeight: 220` and `overflow: auto`, and none can take keyboard focus.
- `features/auth/AuthDialog.tsx:189-195` already documents and fixes this defect for the sign-in dialog (GATE Z I-2), with a static id, `auth-dialog-title-heading` (`:195`).
- Screenshots: `tmp/ux-audit/shell-landing-trust/shots/interact/production-desktop-palette-open.png`, `production-phone-drawer.png`, `tmp/ux-audit/ticker-desk/interact/ai_View_sample_export_dark.png`.

**Touch targets below 44px on coarse pointers (SLT-02, SLT-13, TD-04, RA-08, RA-09, SPL-03, SPL-07).** Canon rule 7 (`DESIGN_SYSTEM.md:162`) asks for ≥44px effective targets on coarse pointers. The floor in `shared/theme/theme.ts:149-154` sets `min-height: 44px` and `min-width: 44px` on `button, [role="button"], a, input` under `(pointer: coarse)`. It loses in two ways:
- An element selector has specificity (0,0,1), and every `sx` rule compiles to a class at (0,1,0). Any local `minHeight` below 44 therefore wins, and so does any local `minWidth: 0`. Main has 26 lines with a local `minHeight: 24` (`git grep "minHeight: 24"`). 27 more set a local `minHeight` between 26 and 40. Not all of those are on interactive elements, and a few already carry a coarse rule, e.g. `CommandPalette.tsx:582-588` and `AlertsPage.tsx:869-870`.
- `min-height` does nothing on a `display: inline` anchor.

Measured at 390x844 with `isMobile` and `hasTouch`, `matchMedia('(pointer: coarse)')` true:
- 'What's live' in the production notice bar: 58x24 on every production route. `shell/MarketDataNotice.tsx:34-40` sets `minHeight: 24`.
- `/credits`: 19 standalone links under 44px on both environments, e.g. 'Treasury interest-rate data ↗' at 182x24. `pages/trust/CreditsPage.tsx:319` (`'& a'` minHeight 24), `:469-474`, `:498`. The shared `linkSx` at `pages/trust/DocPage.tsx:34` sets colour only.
- `/methodology` on production: 'On the demo →' links at 89x17 (`pages/methodology/WhatsLive.tsx:164-170`). On staging, 'Open the live site →' is 115x17 (`:216`).
- '← All posts' is 70x24 (`pages/blog/BlogPostPage.tsx:203-216`).
- 'Show the numbers' is 116x24: 2 on the desk, 6 on staging research and 12 on the production NVDA note (`shared/charts/frame/ChartFrame.tsx:343`).
- '+ Open simulated trade' is 161x36 (`pages/ticker/widgets/chrome/TickerHeader.tsx:554`).
- The Expirations and Persona selects are 190x39 and 195x39. The coarse idiom already in the code does not give 44 either. `.MuiSelect-select` is content-box with 8.5px vertical padding (MUI `InputBase.js:151`, `OutlinedInput.js:154`), so `min-height: 44px` makes 'Active persona' on `/settings` 61px tall on both environments (`SettingsPage.tsx:499-503`; review `probe.json`). Applied as-is to the desk selects, it would take them from 39 to 61px (`selectIdiomSim`).
- Note jump pills are 32px tall (`pages/research/NoteView.tsx:470`). Markets 'On this page' links are 32px (`pages/research/MarketsPage.tsx:303`). Research's 'Try again' buttons are not on this list: by code reading they already reach 44 under coarse (see Input claims corrected while verifying).
- Scanner chips and density buttons are 40px tall (`pages/scanner/ScanToolbar.tsx:70`, `:100`). The comments on those lines say the theme floor lifts them to 44. It does not.
- The Positions trend trigger is 72x24 (`features/trading/positions/PositionRow.tsx:684-696`).
- The production sign-in wall's 'See it on the demo →' is 126x24 (`features/auth/RequireAuth.tsx:174-188`, minHeight 24 at `:182`). It is the wall's only demo route on screen. On a phone the nav 'Full demo ↗' is hidden below `md` (`TopNav.tsx:324`), the banner demo link is hidden below `sm` (`MarketDataNotice.tsx:64`), and the drawer's 'See the full demo ↗' (`TopNav.tsx:497-505`) sits behind the hamburger.
- On production `/scanner` (probe, 2026-10-22), the wordmark glyph's centre sits at y=56 and the menu icon's at y=69. `TopNav.tsx:167-178` is `display: inline-flex` with no `alignItems`, so the 44px floor stretches the link and the mark stays at the top. Provenance chips have the same fault: 37 one-line chips stretched to 44px across 9 phone loads (`shared/credits/CreditsLink.tsx:19`).
- Screenshots: `tmp/ux-audit/ticker-desk/interact/phone_dark_step0.png`, `tmp/ux-audit/scanner-positions-lab/shots/production_scanner_phone_dark.png`, `tmp/ux-audit/research-alerts/shots/probe_chip_390.png`, `tmp/ux-audit/shell-landing-trust/shots/verify-phone-header-prod.png`.

**Text below 4.5:1 (TD-02, TD-03, SPL-05).** The 2026-09-09 Amendments row (`DESIGN_SYSTEM.md:265`) says text is never dimmed by opacity, and that `text.disabled` means a disabled control.
- Main has 40 non-comment lines that use `text.disabled` outside `shared/theme`. 4 are borders and 36 colour text or icons. 28 of the colour uses are in `pages/ticker` and `features/trading`, and 6 are on the operator route (`pages/operator-metrics/operator-metrics.tsx:143`, `:152`, `:204`, `:287`, `:364`, `:377`).
- Measured:
  - Trade-dialog field labels: 2.44:1 dark (`#536073` on `#1b2432`, `FieldLabel.tsx:17`).
  - AI drawer section captions: 2.67:1 light (`reasoning.tsx:89`, `:140`).
  - The 'STRUCTURE' zone label: 3.65:1 light, from `opacity: 0.8` (`pages/ticker/TickerDashboard.tsx:464`).
  - Order source 'AI read · Default (no persona)': 2.53:1 dark (`features/trading/orders/OrderRow.tsx:324`).
  - The white 'Call' label on `success.main`: 2.1:1 dark and 3.45:1 light (`LegFields.tsx:217-226`).
  - Unselected Market/Limit/Put: 4.37:1 light. MUI paints unselected ToggleButtons in `palette.action.active` (`ToggleButton.js:57`). That is `rgba(0,0,0,0.54)` in light, which computes to 4.38:1 on the dialog's `panelRaised` `#ECECE7` (`TradeEntryDialogView.tsx:518`) and 4.50:1 on `paper`.
  - The green SIMULATED chip: 4.36:1 light (`TradeEntryDialogView.tsx:541-549`).
- 'Simulated orders' is an `h6` straight under the page `h1` (`OrdersPanel.tsx:90`), and the Track record cell titles are `h6` under an `h2` (`TrackRecordSection.tsx:175`, `:377`). axe reports heading-order.
- Screenshots: `tmp/ux-audit/ticker-desk/interact/trade_dialog_light.png`, `ai_drawer_light.png`.

**Keyboard (TD-05, RA-03, RA-12, SLT-05, SLT-10, SLT-11).**
- On the production NVDA note at 390 (probe, 2026-10-22), the page has 282 tab stops. 194 of them are 9x9 `<a>` dots in the insider chart (`pages/research/InsiderClusters.tsx:480-505`). The audit counted 1,397 overlapping dot pairs. Month labels overprint ('Nov ’25' and 'Jan ’26'), and role names are cut at 15 characters (`:448`). The page is 39,798px tall. Screenshot: `tmp/ux-audit/ticker-desk/interact/insider_production_phone.png`.
- axe scrollable-region-focusable fires 2 times on NVDA (`#s8`, `#s14`) and 3 times on MSFT (`#s5`, `#s7`, `#s12`). All five are the markdown table block in `pages/research/NoteBody.tsx:103-115`. NVDA has 6 such blocks (`#s7`, `#s8`, `#s9`, `#s10`, `#s13`, `#s14`) and only the 2 named overflow at 390. MSFT has 5, and 3 overflow (review `probe2.json`).
- After the sign-in dialog opened from the phone drawer closes, focus lands on `<body>`.
- On a phone, the palette has no visible close control and shows keyboard-only hints.
- The production palette footnote says tickers 'list by name', but rows are bare symbols in A–Z order. 7 of the first 9 rows say 'no note'.

**Titles (SLT-12, RA-07).** Only 6 files set `document.title`: NotFound, BlogPage, BlogPostPage, MethodologyPage, DocPage and OperatorSessionArchive, each with its own save/set/restore effect. On 2026-10-22, 12 of the 15 routes probed on staging read 'Convexa — See the dealer positioning behind the price.' (`apps/dashboard/index.html:9`). These include the desk, Technical, the note, Scanner, Positions, Research, Markets, Filings, Scorecard, Alerts and Settings.

### Input claims corrected while verifying

- **Adding `summary` to the theme floor does not fix 'Show the numbers' by itself.** The table twin's summary sets `minHeight: 24` at class specificity (`ChartFrame.tsx:343`). With the rule `@media (pointer: coarse) { summary { min-height: 44px } }` injected on the live NVDA note, the summary still measured 24px (`probe.json`, `nvdaSummaryAfterThemeOnly`). Six more summaries carry the same local 24: `InsiderClusters.tsx:300`, `FiledFigures.tsx:206`, `FundHoldings.tsx:402`, `Peers.tsx:105`, `CreditsPage.tsx:277`, `alertsUi.tsx:274`. Each needs its own coarse rule.
- **`blocks/Valuation.tsx:1064` already has the focusable wrapper.** `:1061-1063` sets `role="region"`, an `aria-label` and `tabIndex={0}`. The gap is `:1202`, the model-inputs table: a 420px-min table in a 324px scroller, inside a closed `<details>` (`:1174`). axe does not flag it, but a keyboard user who opens it still cannot scroll it.
- **The masthead selects are not in TickerHeader.** Expirations is `pages/ticker/widgets/chrome/TickerToolbar.tsx:189`. Persona is `PersonaPicker` in `features/personas/components.tsx:55`.
- **The zone label should take `textTertiary`, not `textDim`.** `textDim` names a temporary state, a stale or paused value (`shared/theme/tokens.ts:167-185`). A standing caption is a third-level label, which is `textTertiary`. It measures 5.18:1 dark on `ink` and 4.97:1 light on `paper`.
- **`textTertiary` fails on dialog surfaces in dark.** `rgba(138,155,180,0.85)` on `panelRaised` computes to 4.40:1, so text in dialogs and drawers takes `text.secondary` instead (5.52:1 dark, 5.45:1 light).
- **Counts.** The '26 sites' figure includes one comment (`PositionRow.tsx:138`). Code has 25 literal `color: 'text.disabled'` plus 3 ternaries, so 28 colour uses in `pages/ticker` and `features/trading`. App-wide it is 40 code lines (36 colour uses and 4 borders), not 39. The list is in `tmp/ux-audit/spec-a11y-touch-floor/text-disabled-sites.txt`.
- **The trade dialog and the export drawer only mount in `TickerDashboard`.** That is staging, or production with a live feed. Production runs `PublicDesk` while the feed is not live (`app.tsx:169-187`), so these two overlays can only be checked on staging today.
- **The sign-in dialog already supports a return target.** `features/auth/AuthDialogProvider.tsx:26` (`returnFocus`, used at `:46-50`) does it, and `RequireAuth.tsx:127` already passes one. Only the drawer's call site (`TopNav.tsx:488`) lacks it.
- **On production ticker routes, the remaining color-contrast nodes are TradingView's own attribution.** `.blue-text` measures 3.82:1 dark and 4.32:1 light, and `.trademark` measures 1.80:1, built in `pages/ticker/technical-analysis/TradingViewEmbed.tsx:63-77`. The attribution link is also a sub-44 target: 'SPY stock chart' is 96x16 on `/ticker/SPY` and `/ticker/SPY/technical-analysis`, and 'QQQ stock chart' is 102x16 on `/ticker/QQQ`; its parent is the `div.tradingview-widget-copyright` (review `probe.json`, `probe2.json`, `probe5.json`). The image-alt (critical) and scrollable-region hits are inside TradingView's iframe. The canon keeps the party's attribution untouched (`DESIGN_SYSTEM.md:274`), so every check below, axe and tap scan alike, excludes both.
- **'Canon rule 5' is the warning pattern** (`DESIGN_SYSTEM.md:160`), not a contrast rule. The binding text rules are the 2026-09-09 row and rule 13.
- **The audits found four more sub-44 targets that the input did not list.** The 'zero' target needs them fixed too:
  - the desk verdict chip, 181x24 (`TickerHeader.tsx:391-405`, `tabIndex={0}`, minHeight 24 at `:400`);
  - 7 alert switches, 38x38 (`pages/alerts/AlertsPage.tsx:845`);
  - the Alerts 'See it on the demo →' (`:704`);
  - the feed links such as 'Open Markets →' (`:932`, `:940`).
- **Research's 'Try again' buttons already meet the floor.** This spec once listed the Research Retry as 36px on a phone, from `publicUi.tsx:202` (`minHeight: 36`). That missed `:213`, which adds `'@media (pointer: coarse)': { minHeight: 44 }`, so the button is 36px only at a fine pointer. The Filings figures frame's button does the same (`FilingsPage.tsx:998`, `:1008`). Coming up's (`ComingUpSection.tsx:154`, MUI `size="small"`) and the note's (`NotesView.tsx:224`) are MUI Buttons with no local `minHeight`, and MUI's Button sets none, so the theme floor reaches them. All four read 'Try again'. This is a code reading at `main@8ef735c4`; none was measured on a phone. This spec does not change them. Spec 4 replaces them with its `RetryButton`, 44px at every pointer (spec 4, Behaviour › `/research/markets` (failure states only); Build plan, A1). Criterion 23 measures them.

## Who and when

- **The owner on production, on a phone, reading a note in the evening.** They tap 'Show the numbers' under a chart and miss it, because it is 24px tall. Tab-and-read on a laptop runs through 194 invisible dots before reaching the valuation. Afterwards the browser history shows a dozen tabs, all named 'Convexa — See the dealer positioning…'.
- **A recruiter or engineering reviewer on staging.** They open the demo in Chrome, run Lighthouse or axe, and Tab through the desk. Today the first results are 'Dialogs must have an accessible name' on the palette and 'Elements must meet minimum color contrast' in the trade dialog. After this change, the scan is clean apart from TradingView's documented frame. Every tab in their history then names its page.

## Scope and non-goals

In scope, five parts:

- (a) a name for every `role=dialog`;
- (b) the coarse-pointer touch floor;
- (c) text contrast and heading order;
- (d) keyboard paths through charts, note tables, the palette and the sign-in dialog;
- (e) a distinct document title on every audited route.

**Separable.** Three items go past an accessibility floor. Each is its own build step and criterion, so it can move to spec 4 without touching the rest:
- the palette footnote and note-marker copy (d; build step 7b; criterion 21);
- the insider chart's month-label thinning (P-13 readability, d; step 5b; criterion 17);
- the insider chart's two-line role labels (d; step 5b; criterion 17).

The dot removal, the per-trade twin with its link cells, and rows built on open stay in. Rule 20 (`DESIGN_SYSTEM.md:177`) requires the per-trade path once the dots stop being links. Without rows built on open, the closed note would carry roughly 1,750 more element nodes (194 rows × 9 cells), which breaks the DOM budget.

Non-goals:
- **TradingView's frame and attribution.** They stay as TradingView ships them (canon 2026-10-13, `DESIGN_SYSTEM.md:274`). Every check excludes `iframe` and `.tradingview-widget-copyright` subtrees: axe runs and the tap scans in criteria 4 and 5.
- **The other SIMULATED chips.** The order detail's green chip (`OrderDetailDialog.tsx:113-122`) is spec 3's, which reuses the neutral chip there (TD-15). The landing's chip (`pages/landing/AiReadSample.tsx:76-81`) is already the neutral outlined chip, so neither spec changes it. This spec only changes the trade dialog's chip. If this spec lands first, spec 3's `SimulatedChip` reuses that chip.
- **Operator routes' titles and desktop density** (`/_ops/*`). Their contrast and coarse fixes are in scope. The six `text.disabled` colour uses in `operator-metrics.tsx` are part of the sweep, and `LatencyTrend.tsx`'s select takes the select floor. Criterion 14 counts them. The operator routes are not in the audited routes.
- **Desktop density.** Every size change to an existing control applies only under `(pointer: coarse)`. At 1440 with a mouse, nothing gets taller.
- **No new state words, no copy outside the strings below, no layout changes beyond those listed under Design, and no new tests.**
- **No CI.** GitHub Actions is off. Every check runs locally.

## Behaviour

### (a) Named overlays

- **Palette:** `aria-labelledby` points at a real id. A visually hidden heading inside the dialog, 'Jump to a ticker or note', carries a `useId()` id, passed as the Dialog's `aria-labelledby`. (`AuthDialog.tsx:189-195` fixes the same defect with a static id, `auth-dialog-title-heading`.) The `aria-label` on the root (`CommandPalette.tsx:385`) is removed. Why not `slotProps.paper` `aria-label`: MUI still emits its generated `aria-labelledby` on the paper. An `aria-label` beside a dangling IDREF passes axe but fails other checkers. A real id removes the dangling reference.
- **Phone nav drawer:** `slotProps.paper` gets `aria-label: 'Navigation menu'`. The hamburger keeps its label 'Open navigation menu'.
- **Trade dialog:** the title `Typography` (`TradeEntryDialogView.tsx:532`) gets an id from `useId()`, passed as the Dialog's `aria-labelledby`. Its name is the title text, e.g. 'Open simulated position · SPY'.
- **Export drawer:** the title (`StateExportDrawer.tsx:194`) gets an id. `slotProps.paper` carries `aria-labelledby`, because MUI's Drawer does not forward it to the paper. The name reads 'Sample analysis export · SPY' on staging.
- **Export `<pre>` blocks:** each uses `useScrollRegion` (defined under Note tables, below). While its text overflows the 220px box, it has `tabIndex={0}`, `role="region"`, the standard focus ring, and an `aria-label` built from its section title, `` `${title} export text` ``, e.g. 'Persona prompt export text'. The section titles are distinct (`:259`, `:272`, `:300`, `:312`, `:322`, `:331`), so the region names are too. A `<pre>` whose text fits adds no stop.

### (b) Touch floor

The rule this spec adds to rule 7: **a local `minHeight` below 44 on an interactive element carries its own `'@media (pointer: coarse)': { minHeight: 44 }`**, because the theme floor cannot beat a class. The same goes for a local `minWidth` below 44. Three shared helpers carry it, in a new `shared/ui/touch.ts`:

- `coarseFloor` is the object `{ '@media (pointer: coarse)': { minHeight: 44 } }`, spread into any `sx` that sets a smaller `minHeight`.
- `selectCoarseFloorSx` moves here from `pages/alerts/alertsUi.tsx:293-297`, and its one importer (`NewAlertDialog.tsx:59`) switches to the new path. It keeps the proven doubled-class selector, `.MuiSelect-select.MuiSelect-select` at (0,3,0), and changes its body to `{ minHeight: 44, boxSizing: 'border-box' }`. Content-box with 8.5px padding gives 61px. Border-box makes a small select 44px in total. It is applied to every `Select`: TickerToolbar Expirations (`:189`), PersonaPicker (`features/personas/components.tsx:55`, `:138`), LegFields (`:169`, `:188`), TradeEntryDialogView (`:741`), AiRecPanel (`:453`, `:503`), AiRecPanelBlocks (`:401`), AiKeySection and LatencyTrend. SettingsPage's inline copy (`:499-503`) is replaced by the import. A medium-size `Select` is already 56px, so the floor does not change it.
- `standaloneLinkSx` is `textInfo` colour plus `display: inline-flex`, `alignItems: center`, `minHeight: 24`, and `minHeight: 44` under coarse. `proseLinkSx` is colour only, for links inside a sentence. These two replace the four local `linkSx` copies: `DocPage.tsx:34`, `MarketDataNotice.tsx:34-40`, `WhatsLive.tsx:90` and `BlogPostPage.tsx:27`.

Theme (`shared/theme/theme.ts:149-154`):
- Add `summary` to the coarse selector. This covers summaries that set no local minHeight.
- `MuiSwitch` under coarse gets a 44px switch base and root height, with the track and thumb unchanged. This fixes the alerts switches, measured 38x38.

What changes where, all coarse-only:

| Where | Today at 390 | After |
|---|---|---|
| Notice bar 'What's live' and demo link (`MarketDataNotice.tsx`) | 58x24, bar 41px | link 44px. The bar drops its 8px vertical padding under coarse, so it is 45px, not 61 |
| `/credits` source-card links (`CreditsPage.tsx:319`, `:344-356`), 'The live site's sources and credits ↗' (`:469-474`), 'SIL OFL 1.1' (`:498`) | 24px, 18px | 44px |
| `/methodology` 'On the demo →' (`WhatsLive.tsx:164-170`), 'Open the live site →' (`:216`) | 17px | 44px |
| '← All posts' (`BlogPostPage.tsx:203-216`) | 24px | 44px |
| Every 'Show the numbers' (`ChartFrame.tsx:343`) and the six local-24 summaries listed above | 24px | 44px |
| '+ Open simulated trade' (`TickerHeader.tsx:554`) | 36px | 44px. Desktop keeps 36 |
| Desk verdict chip (`TickerHeader.tsx:391-405`) | 24px | 44px hit area from a pseudo-element. The chip and its row keep their size (mechanism below) |
| Expirations and Persona selects; trade-dialog and AI-panel selects | 39px | 44px (44 to 46 by criterion 4) |
| Settings 'Active persona' (`SettingsPage.tsx:499-503`), Alerts composer selects (`NewAlertDialog.tsx:904`, `:1058`) | 61px | 44px. These shrink, because the helper becomes border-box |
| Note jump pills (`NoteView.tsx:470`) | 32px | 44px outer link, 32px visible pill. The jump bar's padding shrinks to match, so the bar does not grow (mechanism below) |
| Markets 'On this page' links (`MarketsPage.tsx:303`) | 32px | 44px. These links have no fill, so nothing visible changes |
| Research 'Try again' buttons: `SourceProblem`'s (`publicUi.tsx:202`), the note's (`NotesView.tsx:224`), Coming up's (`ComingUpSection.tsx:154`) and the Filings figures frame's (`FilingsPage.tsx:998`) | 44px already (code reading) | No change here. Two carry their own coarse 44 (`publicUi.tsx:213`, `FilingsPage.tsx:1008`), and the theme floor reaches the other two. Spec 4 replaces all four with its `RetryButton` (spec 4, Build plan, A1). Criterion 23 measures them |
| Scanner chips and density buttons (`ScanToolbar.tsx:70`, `:100`) | 40px | 44px. The two misleading comments are corrected |
| Positions trend trigger (`PositionRow.tsx:684-696`) | 72x24 | 44px tall, `alignItems: center` |
| Alerts switches (`AlertsPage.tsx:845`, `NewAlertDialog.tsx:984`) | 38x38 | 44x44 |
| Alerts 'See it on the demo →' (`:704`), feed links (`:932`, `:940`) | 24px | 44px |
| Wordmark (`TopNav.tsx:167-178`), `CreditsLink` (`CreditsLink.tsx:19`), ChartFrame's external source `Link` (`ChartFrame.tsx:319-327`) | stretched, content top-aligned | `alignItems: 'center'` (and `display: inline-flex` on the ChartFrame link). The hit area stays 44px and the content is centred |
| Production sign-in wall (`RequireAuth.tsx`) | 'See it on the demo →' is an inline link, 126x24 | an outlined, neutral 44px button in the button row (sketch under Design). 'Sign in' stays the wall's single amber action (owner ruling A, 2026-10-15). The closing sentence keeps 'The demo account shows this screen on sample data.' without the link |

**Compact controls: two named mechanisms.** A 44px element in the flow grows its row. The review measured this on staging `/ticker/SPY` at 390: forcing `deck-verdict` to 44px grew its wrapped flex row from 62 to 82px and the page from 6,915 to 6,935px (review `probe3.json`). So the spec does not use a 44px outer wrapper on the desk.
- **Pseudo-element hit area (the verdict chip).** Under coarse, the chip gets `position: relative` and a `::before` with `content: ''`, `position: absolute`, `top: -10px`, `bottom: -10px`, `left: 0` and `right: 0`. A pseudo-element takes no space, so the chip stays 24px and its row stays 62px. Taps within 10px above or below the chip reach it. `getBoundingClientRect` cannot see a pseudo-element, so criterion 4 checks this chip by hit test, and also checks that the extended area covers no neighbouring control.
- **Padding trade (the note jump pills).** The pseudo-element cannot work here: the pills sit in an `overflowX: auto` row (`NoteView.tsx:460`), which clips anything outside its box. Instead, the outer `<a>` is 44px tall and transparent, and an inner span carries the 32px fill. The sticky jump bar's vertical padding drops from 10px (`py: 1.25`, `:452`) to 4px under coarse. The bar's height and each pill's visible position stay as they are.

Sweep: once the listed sites are done, run the tap probe on every audited route and open state. Any remaining non-inline element under 44px gets `coarseFloor`, and so does any `inline-flex` link with stretched content. The probe is the arbiter, not grep. One candidate is known but was not measured, because the review could not open the export drawer: its COPY buttons set `minWidth: 0` (`StateExportDrawer.tsx:381`), which beats the theme's `minWidth: 44`. Criterion 5 measures them.

Rejected alternative: raise the theme floor's specificity (`a[class], button[class], summary[class]` reaches (0,1,1)). One rule would then fix every site, but it would also pull local floors above 44 down to 44. The drawer rows at 48px (`TopNav.tsx` `quietRowSx`) would shrink.

### (c) Readable text

The mapping rule for each `text.disabled` colour use:
- A value that went stale, paused or offline, and is shown with a pause mark or `streamOffline`, takes `extrasFor(theme).textDim` (rule 13). Examples: `PositionCard.tsx:201`, `:211`, `:224`, `:287`, `:301`, `PositionsView.tsx:371`.
- Everything else takes `text.secondary`: captions, labels, source lines, empty-state lines, info icons and decorative separators. This includes the six operator-metrics uses.
- `textTertiary` is not used for text on `panelRaised`, because it is 4.40:1 in dark.

Two uses stay `text.disabled`, because they mark a disabled control:
- the disabled option in the alert composer (`NewAlertDialog.tsx:591`);
- the 'Rearrange (coming soon)' grip (`shared/ui/Widget/Widget.tsx:272`), until spec 3 deletes it (criterion 14).

The four border uses are not text and stay as they are.

Specific sites:
- `FieldLabel.tsx:17` takes `text.secondary`.
- The zone label (`TickerDashboard.tsx:463-464`) loses `opacity` and takes `textTertiary` when `first`, otherwise `text.secondary`.
- Order source (`OrderRow.tsx:324`) takes `text.secondary`.
- `OrdersPanel.tsx:90` gets `component="h2"`, and `TrackRecordSection.tsx:175` gets `component="h3"`.
- Trade dialog chip (`TradeEntryDialogView.tsx:541-549`): `<Chip size="small" variant="outlined" label="SIMULATED" />`, the chip `OrdersPanel.tsx:94` already draws. It keeps its `title`.

ToggleButtons. One change is unconditional, because it is the contrast floor:
- The unselected label is `text.secondary`, theme-wide (`theme.ts:233`). That is 5.45:1 light and 5.52:1 dark on `panelRaised`, against 4.38:1 light today.

The selected state depends on open question 1:
- **If no (recommended):** MUI's neutral selected tint stays on every ToggleButton. Call and Put keep their `success.main` and `error.main` fills, as the 2026-10-13 `textUp`/`textDown` row left them ('the call/put toggle fill', `DESIGN_SYSTEM.md:271`). Only the label changes, which closes that row's one open item, the white label. In `LegFields.tsx:216-226`:
  - The selected label is `ink` (`#0B0F17`) on every fill except light Put, which keeps white. Computed by script (WCAG 2), 2026-10-22: dark Call 9.13:1, dark Put 6.34:1, light Call 5.56:1, light Put in white 4.74:1. Ink on light Put would be 4.05:1.
  - The `success.dark` and `error.dark` hover fills go, and a selected button keeps its fill on hover. One label colour then serves both states. On the darker hover fills, ink would drop to 3.75:1 on light Call and 2.84:1 on light Put. A selected button in this exclusive group does nothing when clicked again (`onChange` ignores `null`), so it needs no hover change.
- **If yes:** the selected state becomes P-6 theme-wide: label `text.primary`, weight 700, and a 1px `text.primary` border plus a 1px inset outline, as `pages/ticker/widgets/chrome/QuickSymbols.tsx:151-160` draws it. MUI's neutral selected tint stays underneath. `LegFields.tsx:207-226` drops its call-green and put-red overrides, so a selected Call and a selected Put look the same. This reaches all 24 `<ToggleButton>`s in 8 files listed in open question 1, the desk's Field / Magnet among them.

No source scan is added. The sweep is proved once by criterion 14's grep. The rule carries forward through the Amendments row: text never takes `text.disabled`, which marks a disabled control only. Why no scan: the repository's test rule (`CLAUDE.md`, Tests and CI) rules out tests of styling, and a contrast regression does not cost money or touch auth, data writes, parsers or contracts.

### (d) Keyboard and focus

**Insider chart (`InsiderClusters.tsx`):**
- The svg (`:403-409`) becomes `role="img"` and keeps its summary `aria-label`, e.g. '194 sales and 0 purchases by 12 insiders; 0 buying clusters'.
- The dots (`:480-505`) lose their `<a>`. Each circle is `aria-hidden`, not focusable, and keeps its hover `<title>`. Because the svg has `role="img"`, its children are presentational.
- The chart's keyboard path is its frame's controls: the source chip and 'Show the numbers'. The plot itself adds no tab stop. See open question 3.

**The twin carries the per-trade detail:**
- `ChartFrame`'s `table` prop accepts one twin or a list. `TableTwinData` rows accept a link cell, `{ text, href, label }`, rendered with `standaloneLinkSx`, which is 44px under coarse. The renderer treats an object cell as a link only when it has an `href`, because spec 7 later adds a text cell, `{ text }`, with no `href`, to the same row type (spec 7, Copy › Table twin, 'Cell register').
- With windows present, the insider twin shows the windows table, then a trades table titled `${ticker} Form 4 trades by trade date` (the existing caption at `:265`). The trades table has one row per trade.
- On production the trades table gains a last column, 'Filing', whose cell is a link 'Form 4 ↗' to the trade's `url` on sec.gov. Its accessible name is 'Form 4: ' followed by the existing per-dot sentence (`:478`).
- On staging the Filing column is absent. Sample trades link to the company's real EDGAR page (`libs/api/src/lib/demo/public-data.ts:375-376`, `:528`), so a 'Form 4' link would point a reviewer at a real page for an invented trade. Today's 9 staging dot links have the same fault and go with the dots.
- `TableTwin` renders its table only once the disclosure has been opened, via local state on `toggle`. The closed page then carries no twin rows, which keeps the NVDA note's DOM under today's size.

**Phone axes (separable, step 5b):**
- A month label is drawn only when its left edge clears the previous drawn label's right edge by 8px. Label width is estimated at 6.6px per character, 11px IBM Plex Mono at 0.6em. This is P-13's 'narrow axes drop ticks instead of shrinking them' (`DESIGN_SYSTEM.md:277`). The first drawn label in each year keeps its year.
- Role labels wrap to at most two lines inside the label column. Two 11px lines fit the 30px row (`:370`). Only text beyond two lines ends in '…'. The twin's Insider column has every full role.

**Note tables and code blocks:**
- One rule: a scroller is a tab stop only while it scrolls. A new hook, `shared/ui/useScrollRegion.ts`, takes a label. It returns `{ tabIndex: 0, role: 'region', 'aria-label': label }` while the element's `scrollWidth > clientWidth` or `scrollHeight > clientHeight`, and `{}` otherwise. A `ResizeObserver` on the element and its first child re-checks this at every width and after fonts load. The element carries the standard `textAmber` focus ring from the twin's wrapper (`ChartFrame.tsx:355-366`).
- Why conditional: the NVDA note has 6 table blocks, and only 2 overflow at 390. An unconditional `tabIndex` would add 4 stops on NVDA that scroll nothing. That is the same 'stop with no action' that open question 3 rejects for the plot.
- Applied to:
  - the markdown table block (`NoteBody.tsx:103-115`), moved into a small `TableBlock` component so that it can call the hook;
  - the `codeblock` `<pre>` (`:87-99`);
  - the model-inputs table (`blocks/Valuation.tsx:1202`), which sits inside a closed `<details>` and becomes a stop only once that is opened;
  - the export drawer's `<pre>` blocks (a).
- Each note region takes its `aria-label` from the table's caption, or from the section heading when it has none. None of the 6 NVDA tables has a caption today (review `probe.json`, `tablesWithCaption: 0`).
- ChartFrame's own twin wrapper keeps its unconditional stop. It is reached only after 'Show the numbers' is opened, and no criterion needs it changed.

**Sign-in from the drawer:** `DrawerAccountRows` (`TopNav.tsx:434`) receives a ref to the hamburger and calls `openAuth({ mode: 'login', returnFocus: menuButtonRef.current })`. The provider stores it because it is connected (`AuthDialogProvider.tsx:46-50`). `AuthDialog.tsx:181`'s `disableRestoreFocus` stays, since the provider restores focus.

**Palette on a phone**, one pass over `CommandPalette.tsx`:
- **Cancel:** below 600px, the input row becomes a flex row: the input, then a neutral text Button 'Cancel', 44px tall, that calls `onClose`. At 600px and up it is not rendered.
- **Kbd hints:** under `(pointer: coarse)`, none of these is displayed, at any width:
  - the footer's '↑↓ move' and '↵ open' (`:499-504`);
  - the '? all shortcuts' button (`:505-520`), which today is gated by width only and so shows on coarse tablets of 600px and up;
  - each row's `g` + key chips (`:217`);
  - in the landing hero's help line (`pages/landing/GammaSurfaceHero.tsx:465-467`), the whole trailing fragment ' · ← → strikes · ↑ ↓ expiries · Home resets'. It is wrapped in one span, so no '·' fragments are left behind. The line then reads exactly `LANDING_COPY.hero.helpTurn`, 'Drag to turn it (sideways on a phone, so the page still scrolls)' (`pages/landing/copy.ts:59`).
- **Footnote (separable, step 7b):** the production footnote (`:375`) changes to the string under Copy. The demo string stays.
- **Note marker (separable, step 7b):** a ticker row shows 'note' only when `ticker.hasNote`; otherwise the cell is empty. 'no note' is gone (`:327`).

### (e) Document titles

`shared/hooks/useDocumentTitle.ts` exports `useDocumentTitle(title: string)`. It sets the title on mount and when the title changes, and restores the previous title on unmount. It replaces the six local effects: `NotFound.tsx:64-70`, `BlogPage.tsx:136-142`, `BlogPostPage.tsx:186-193`, `MethodologyPage.tsx:144-150`, `DocPage.tsx:58-64` and `OperatorSessionArchive.tsx:336-342`.

Each route calls it once, in the component that knows the most. Never nest two calls on one route: React runs child effects before parent effects, so a parent's call would overwrite the child's.
- Desk and Technical: the route wrappers (`app.tsx:169`, `:198`).
- Notes: `NotesView` on production, `ResearchView` on staging. Spec 4 step C2 deletes `ResearchView` and sends both builds through `NotesView`. After C2, the call in `NotesView` covers both builds, and criterion 22 is re-run on staging.
- Scanner and Positions: `RequireAuth`, through a new `docTitle` prop, called before the demo early return (`RequireAuth.tsx:77`). The wall and the page then share one title.
- Research index, Markets, Filings, Scorecard, Alerts and Settings: their page components.

One separator everywhere: ' — Convexa'. Six of today's seven custom titles already use it. ' · ' joins facts inside a title, as the product already does in 'Open simulated position · SPY'.

### Per state

- **Loading:**
  - Titles are set before data arrives, because each comes from the route.
  - A note shows `NVDA research — Convexa` until the note loads, then its own title.
  - The palette's skeleton rows are unchanged.
- **Empty:** a ticker with no Form 4 trades keeps today's message frame. There is no twin, so no Filing column.
- **Error:**
  - Research's 'Try again' buttons (`publicUi.tsx:202`, `NotesView.tsx:224`, `ComingUpSection.tsx:154`, `FilingsPage.tsx:998`) are already 44px under coarse. This spec does not change them.
  - The wall's degraded-session 'Try again' (`RequireAuth.tsx:133-142`, `AUTH_COPY.gate.retry`, shown only when `subsystemDegraded`) sits directly after 'Sign in' and is 44px.
  - The palette's 'Couldn’t search tickers right now.' copy is unchanged. The open palette in that state meets the floor.
  - Criterion 23 forces each of these states.
- **Sample (staging):**
  - The trade dialog, export drawer, call/put state and SIMULATED chip changes are visible here only.
  - The insider twin has no Filing column.
  - The palette footnote stays 'Scores come from the demo’s sample scan.'
- **Not live (production):**
  - The palette footnote changes (separable).
  - `PublicDesk` gets its title from the route.
  - The notice bar's links meet the floor.
- **Signed out (production):** the wall gains the demo button. The drawer's Log in returns focus to the hamburger.
- **Phone width:** Cancel in the palette and no kbd hints under coarse. Thinned month labels and two-line role labels come with step 5b (separable).

## Copy

Exact strings. Every one is plain sentence case. None is a state word, so the closed list in `shared/dataState/vocabulary.ts` is unchanged.

| Where | String |
|---|---|
| Palette dialog name (visually hidden heading) | Jump to a ticker or note |
| Palette close, below 600px | Cancel |
| Palette footnote, production (separable) | Scores aren’t live on this site, so tickers list A–Z. |
| Palette ticker row with a note (separable) | note (unchanged). Rows without a note show nothing |
| Nav drawer name | Navigation menu |
| Export drawer `<pre>` region, while it scrolls | `${section title} export text`, e.g. Persona prompt export text |
| Wall button (owner's string, 2026-10-14 decision-queue row, `DESIGN_SYSTEM.md:278`) | See it on the demo → |
| Wall closing sentence | The demo account shows this screen on sample data. (unchanged, link removed) |
| Insider twin, trades caption | `${TICKER} Form 4 trades by trade date` (unchanged) |
| Insider twin, link column header (production) | Filing |
| Insider twin, link text / accessible name | Form 4 ↗ / Form 4: `<existing per-trade sentence>` |

Titles:

| Route | Title |
|---|---|
| `/` | Convexa — See the dealer positioning behind the price. (unchanged) |
| `/ticker/SPY` | SPY — Convexa |
| `/ticker/SPY/technical-analysis` | SPY technical — Convexa |
| `/ticker/NVDA/research`, loading or no note | NVDA research — Convexa |
| `/ticker/NVDA/research[/:slug]`, note loaded | NVDA · `<note title>` — Convexa |
| `/research` | Research — Convexa |
| `/research/markets` | Markets — Convexa |
| `/research/filings` | Filings — Convexa |
| `/research/scorecard` | Scorecard — Convexa |
| `/alerts` | Alerts — Convexa |
| `/scanner` (wall or page) | Scanner — Convexa |
| `/positions` (wall or page) | Positions — Convexa |
| `/settings` | Settings — Convexa |
| `/methodology`, `/credits`, `/privacy`, `/terms`, `/blog`, `/blog/:post`, 404 | unchanged |

_Status, 2026-10-29: `/methodology` did not stay unchanged. Its title is now 'Methodology — Convexa', where it was 'How Convexa works — methodology': the page sets it since `86af63fb` (site audit 2026-10-25, SEO-3, batch B3), and its served head carries it since `e73eafb8` (batch B5). Neither commit was released on this date. The row's other routes keep their titles._

## Design

Tokens and components come from `DESIGN_SYSTEM.md` and `shared/ui`. Nothing on the Banned list is used. The SIMULATED chip stops being a green status chip. Every hover `<title>` on the insider dots keeps a tap and keyboard path through the twin (rule 20, `DESIGN_SYSTEM.md:177`), and chip text stays ≥11px.

- Text: `text.secondary`, `extrasFor(theme).textDim` (stale values only) and `textTertiary` (the zone label on the canvas only).
- Focus ring: `textAmber` 2px, offset 2.
- Amber: the wall keeps exactly one contained amber button. The new demo button and the palette's Cancel are neutral (ruling A, `DESIGN_SYSTEM.md:284`).

**Layout changes, all of them.** Nothing else moves.
- Coarse only:
  - Every control in the table under (b) grows to 44px where it was smaller, and its row grows with it.
  - The desk masthead grows by the selects' 5px. Rows holding '+ Open simulated trade' grow by 8px.
  - The NVDA note grows by about 240px from its 12 sub-44 summaries. The review injected the floor and measured +239px.
  - The notice bar goes from 41 to 45px.
  - Settings 'Active persona' and the Alerts composer selects shrink from 61 to 44px.
- Coarse only, unchanged by design: the verdict chip and its row (pseudo-element hit area), and the note's jump bar (padding trade).
- At every width:
  - The wall's button row gains the demo button, and its closing sentence loses the link.
  - The insider twin gains a second table when it is opened.
  - The landing hero's help line drops its key hints under coarse.
- Below 600px: the palette's input row gains Cancel.
- If open question 1 is yes, the selected look of every ToggleButton changes, including the desk's Field / Magnet.

The production wall at 390. At 600px and up, the three buttons sit in one row in the same order:

```
┌──────────────────────────────────┐
│ ◌ Private testing                │
│ Sign in to open the scanner      │
│ This area is limited to invited… │
│ ┌──────────────────────────────┐ │
│ │ Sign in              (amber) │ │ 44
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ See it on the demo →         │ │ 44, outlined, neutral
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Open a ticker desk           │ │ 44, outlined, neutral
│ └──────────────────────────────┘ │
│ Invited accounts only; new sign… │
│ The demo account shows this      │
│ screen on sample data.           │
└──────────────────────────────────┘
```

The demo button comes second, because for every visitor except the owner it is the wall's real next step. The degraded-session 'Try again', when shown, stays directly after 'Sign in'.

The palette input row below 600px:

```
┌────────────────────────────────────┐
│ Jump to a ticker or note    Cancel │  ← text button, 44px tall
├────────────────────────────────────┤
│ GO TO …                            │
```

The insider chart's twin on production, opened:

```
▾ Show the numbers
┌ Windows with 3 or more insiders trading the same way ──────┐
│ From │ To │ Kind │ Insiders │ Trades │ Under a plan         │
└────────────────────────────────────────────────────────────┘
┌ NVDA Form 4 trades by trade date ───────────────────────────────────────┐
│ Trade date │ Insider │ Kind │ Shares │ Price │ Under a plan │ Filed │ Filing │
│ Jun 3, 2026│ Pres…   │ Sale │ 120,000│ …     │ yes          │ Jun 5 │ Form 4 ↗│  44px on touch
└──────────────────────────────────────────────────────────────────────────┘
```

## Data and licence

No new data or source. The per-trade 'Form 4 ↗' links point at the same sec.gov URLs the dots link to today. SEC filing content is reuse-permitted with credit requested (`docs/product/ai-analyst/SOURCES.md:88`), and the frame's source chip already credits SEC EDGAR. Staging shows no Form 4 link for sample trades.

## Acceptance criteria

Unless a criterion says otherwise:
- 'Phone' means 390x844 with `isMobile` and `hasTouch`, with `matchMedia('(pointer: coarse)')` confirmed true.
- 'Desktop' means 1440x900.
- 'Both schemes' means dark and light. A fresh browser context is dark. Emulating `prefers-color-scheme` does not switch the app, because it follows the OS only when the stored preference is `system` (`theme.ts:349-354`). For light, open `/settings` in the same context and click `[data-testid="settings-theme-light"]`. Signed out, this saves only in that browser (`saveLocalTheme`, `features/auth/useSettings.ts:124-131`), and later navigations in the context stay light. Before measuring, confirm `getComputedStyle(document.body).backgroundColor` is `rgb(246, 246, 243)` (light `paper`), or `rgb(11, 15, 23)` (`ink`) for dark.
- Every axe run and every tap scan excludes `iframe` and `.tradingview-widget-copyright` subtrees (non-goal 1).
- Each check is a Playwright script under `tmp/ux-audit/`.

1. **Palette named.** On staging and production, at phone and desktop, after the palette opens:
   - `page.getByRole('dialog', { name: 'Jump to a ticker or note' })` resolves.
   - The dialog's `aria-labelledby` resolves to an element in the document.
   - axe `aria-dialog-name` reports 0 nodes.
2. **Drawer named.** On both environments at phone, after the hamburger is tapped, `getByRole('dialog', { name: 'Navigation menu' })` resolves and axe `aria-dialog-name` reports 0.
3. **Trade dialog and export drawer named (staging, both viewports, both schemes).**
   - `getByRole('dialog', { name: 'Open simulated position · SPY' })` and `getByRole('dialog', { name: 'Sample analysis export · SPY' })` resolve.
   - In the drawer, Tab reaches every export `<pre>` whose `scrollHeight > clientHeight` or `scrollWidth > clientWidth`. No `<pre>` that fits is a tab stop.
   - The export regions' accessible names are pairwise distinct, each ending ' export text'.
   - axe `aria-dialog-name` and `scrollable-region-focusable` report 0 in both.
4. **Touch floor, measured.** On every audited route, on both environments, in both schemes, at phone, the audits' selector finds 0 elements with width or height under 44px.
   - The selector is `a[href], button, [role="button"], [role="tab"], [role="link"], input, select, textarea, [role="switch"], [role="checkbox"], summary, [tabindex="0"]`. It leaves out hidden, zero-size and `aria-hidden` subtrees. It also leaves out `iframe` and `.tradingview-widget-copyright` subtrees (non-goal 1). Today's 'SPY stock chart' (96x16) and 'QQQ stock chart' (102x16) sit there.
   - The only box exemption is an `A` with computed `display: inline` whose parent is `P`, `LI` or `SPAN`.
   - **Hit test for the verdict chip.** `[data-testid="deck-verdict"]` is measured by hit test instead of by box. After `scrollIntoView({ block: 'center' })`, `document.elementFromPoint` returns the chip or a descendant at its centre, and at its centre shifted 21px up and 21px down. Its own box stays 24px tall.
   - **No hit area covers a neighbour.** For every element the selector finds, after `scrollIntoView({ block: 'center' })`, `elementFromPoint` at its own centre returns that element or a descendant.
   - **Selects are 44 to 46px.** Every `[role="combobox"]` under `selectCoarseFloorSx` has a border-box height from 44 to 46px. A 61px content-box result fails. A medium-size `Select` keeps MUI's 56px and is listed by name in the run.
   - Measure before any `fullPage` screenshot, because a full-page capture under mobile emulation drops `pointer: coarse` (SPL-07 method note).
   - Audited routes: `/`, `/settings`, `/methodology`, `/credits`, `/privacy`, `/terms`, `/blog`, `/blog/how-we-read-dealer-structure`, a 404, `/ticker/SPY`, `/ticker/QQQ`, `/ticker/NVDA`, `/ticker/SPY/technical-analysis`, `/ticker/NVDA/research`, `/ticker/MSFT/research`, `/research`, `/research/markets`, `/research/filings`, `/research/scorecard`, `/alerts`, `/scanner`, `/positions`.
5. **Touch floor in open states.** The same check, with the same exclusions, hit test and select range, passes with each of these open:
   - the palette and the nav drawer (both environments);
   - the trade dialog and the export drawer, including its COPY buttons (staging);
   - the NVDA note's insider 'Show the numbers' (production).
6. **Desktop unchanged.** At desktop with a mouse, today's heights hold: '+ Open simulated trade' 36px, scanner chips 40px, 'What's live' 24px, 'Show the numbers' 24px, note jump pills 32px, verdict chip 24px, Expirations and Persona selects 39px.
7. **Centred content.** At phone, for `[data-testid="shell-brand"]` and every provenance chip link, the visible child's vertical centre is within 1px of the link's centre. On production `/scanner` today the glyph centre is y=56 and the menu icon's is y=69.
8. **Wall.** On production `/scanner` and `/positions`, signed out, at phone:
   - 'See it on the demo →' is a button-row element at least 44px tall, linking to the staging host plus `/scanner` or `/positions`.
   - The wall has exactly one contained (amber) button, 'Sign in'.
   - The demo button's computed text colour equals `text.primary`.
   - The notice bar is at most 45px tall, and its 'What's live' is at least 44px.
9. **Contrast.** axe `color-contrast` reports 0 in both schemes, at both viewports, in these places:
   - staging `/ticker/SPY` with the desk alone;
   - the same page with the trade dialog open, then the 'Full analysis' drawer open, then the export drawer open;
   - staging `/positions`;
   - production `/ticker/SPY`.
10. **Toggle contrast.** In the staging trade dialog, in light, unselected Market, Limit and Put labels measure at least 4.5:1. They are computed against light `extrasFor(theme).panelRaised`, `#ECECE7`, the surface the dialog paints (`TradeEntryDialogView.tsx:518`), and axe also reports 0. The rest depends on the answer to open question 1:
    - **No:** the selected Call and Put keep the `success.main` and `error.main` fills. Each selected label measures at least 4.5:1 against its own fill, in both schemes, at rest and while hovered, and the hovered fill equals the resting fill.
    - **Yes:** the selected Call and the selected Put have identical computed `color`, `background-color` and `box-shadow`, and the selected label weight is 700.
11. **SIMULATED chip.** The trade dialog's chip has the same computed colour, border and background as the 'Simulated orders' chip on staging `/positions`.
12. **Headings.** axe `heading-order` reports 0 on staging `/positions`, in both schemes.
13. **No new tests.**
    - `npm exec nx test @convexa/dashboard` exits 0 on the finished tree.
    - `git diff --name-only --diff-filter=A main -- '*.spec.*'` lists nothing.
    - An existing assertion that pins a string this spec changes is updated, not deleted, and listed in the PR body. Today that is `shell/CommandPalette/CommandPalette.spec.tsx:57-58`, the production footnote, which comes with separable step 7b.
14. **Sweep complete.** Comment-stripped grep finds the colour uses of `text.disabled` outside `shared/theme`. If this spec lands before spec 3, it finds exactly 2: NewAlertDialog's disabled option and Widget's grip. If it lands after spec 3, it finds exactly 1, the disabled option, because spec 3 deletes the Widget grip (spec 3, Behaviour › (a) Every click lands; `Widget.tsx:260-282`). Both counts are stated here, so neither spec edits this criterion when the other lands. Today it finds 36, including the six in `operator-metrics.tsx`.
15. **Insider chart, keyboard.** On production `/ticker/NVDA/research` at phone:
    - The probe's tab-stop count is ≤ 90. Today it is 282. The arithmetic: 282, minus the 194 dot links, plus the 2 note tables that overflow at 390 (`#s8`, `#s14`), is 90. The note has no code block, and the model-inputs table sits inside a closed `<details>`.
    - There are 0 focusable elements inside the insider svg.
    - The svg has `role="img"` and its summary label.
    - On staging NVDA and MSFT notes, the svg contains no `<a>`.
16. **Insider twin.** On production, opening the insider 'Show the numbers' shows a trades table with one row per trade.
    - Its row count equals the trade count in the svg's label (194 sales on 2026-10-22).
    - Each row has a 'Form 4 ↗' link to `sec.gov`, 44px tall at phone.
    - On staging the trades table has no Filing column.
    - Before the disclosure opens, the page contains no twin rows.
17. **Phone axis (separable, step 5b).** At phone, no two drawn month labels in the insider chart have intersecting bounding boxes. No role label of 30 characters or fewer ends in '…'.
18. **Note tables.** On production `/ticker/NVDA/research` and `/ticker/MSFT/research`, in both schemes:
    - axe `scrollable-region-focusable` reports 0 at phone and at desktop. Today at phone it reports 2 and 3.
    - At each width, a note table wrapper or code block has `tabindex="0"`, `role="region"` and a non-empty `aria-label` exactly when its `scrollWidth > clientWidth`. At phone today that is `#s8` and `#s14` on NVDA, and `#s5`, `#s7` and `#s12` on MSFT. The other table blocks carry none of the three attributes.
    - After resizing from 390 to 1440 and back without a reload, the attributes follow the new overflow.
19. **Focus return.** On production at phone: tap the hamburger, then 'Log in', then press Escape. `document.activeElement` is `[data-testid="nav-menu-button"]`. Today it is `<body>`.
20. **Palette and hero on touch.**
    - At phone, a 'Cancel' button at least 44px tall is visible in the input row, and tapping it closes the palette.
    - At phone, and on a coarse tablet (768x1024 with `hasTouch`), no `<kbd>` is visible in the palette, and '? all shortcuts' is not displayed.
    - At phone, with the hero in WebGL mode, the landing hero help line's `innerText`, trimmed, equals exactly 'Drag to turn it (sideways on a phone, so the page still scrolls)'. Nothing else is left, and no '·'. In the static projection the line is `helpStatic`, unchanged.
    - At desktop with a mouse, the kbd hints, '? all shortcuts' and the hero's full key line show, and Cancel is absent.
21. **Palette copy (separable, step 7b).** On production, `[data-testid="palette-footnote"]` reads exactly 'Scores aren’t live on this site, so tickers list A–Z.' The text 'no note' appears nowhere in the palette. Only rows whose ticker has a note show 'note'.
22. **Titles.**
    - On both environments, every route in the Titles table has exactly that `document.title`, and the titles are pairwise distinct.
    - A client-side visit from `/research` to `/alerts` and back to `/` shows 'Research — Convexa', then 'Alerts — Convexa', then the landing title.
    - `git grep -n "document.title" -- 'apps/dashboard/src/app/**/*.ts' 'apps/dashboard/src/app/**/*.tsx' ':!*.spec.*'` matches exactly one file, `apps/dashboard/src/app/shared/hooks/useDocumentTitle.ts`. Today it matches 6 files. Without the spec exclusion it would also match `OperatorSessionArchive.spec.tsx:21` and `:59`.
    - Re-run on staging after spec 4 step C2, which deletes `ResearchView`. The staging note's title then comes from the call in `NotesView`.
23. **Forced error states (production, read-only, phone).** Staging cannot be used: its demo transport answers in the browser, so a network abort cannot fail its reads. On production, `page.route` aborts requests inside the test browser only. Nothing is signed in, submitted or sent.
    - With `**/api/public-data/**` aborted, every 'Try again' button on `/research/markets` and on `/ticker/NVDA/research` is visible and at least 44px tall.
    - With `**/api/auth/session` aborted, `/scanner` shows `[data-testid="require-auth-retry"]`, which reads 'Try again'. The button row's order is 'Sign in', then 'Try again', then 'See it on the demo →', then 'Open a ticker desk', and each is at least 44px tall.
    - With `**/api/scan/universe` aborted, the open palette shows 'Couldn’t search tickers right now.', and criterion 4's scan of the open palette finds 0 sub-44 targets.
    - Each sub-check runs in both schemes, using the light method in the preamble.

## Verification

Risk rule (`CLAUDE.md`, Tests and CI): this is UI work, and the rule rules out tests of UI, copy and styling. No test is added. The `text.disabled` sweep is proved once by criterion 14's grep and carried forward by the Amendments row, not by a source scan. Existing assertions change only where they pin a string this spec changes (criterion 13). No CI job is added; Actions is off.

Observable checks, in order:

1. `npm run typecheck` and `npm exec nx test @convexa/dashboard`. Check `echo $?` for each, not the printed summary.
2. `npm run verify`. It runs gitleaks over new commits, so `brew install gitleaks` must have been done. Check the exit code.
3. `npm run ports:free`, then serve staging and production builds locally, or wait for deploys. Re-run the four audits' axe and tap scripts under `tmp/ux-audit/*` at phone (`hasTouch`) and desktop, dark and light (the preamble's method), on both environments, plus the criterion scripts above. Measure taps before any `fullPage` screenshot.
4. Criterion 23's forced error states, on production, read-only.

Performance budget, NVDA production note at phone, baseline measured 2026-10-22 by `probe3.mjs` (3 runs):
- DOM nodes with all disclosures closed: ≤ 3,527, today's count. The 194 `<a>` go, and each dot keeps its `<circle>` and `<title>`. Twin rows are built only when opened. The PR records the measured count.
- Median time to the first `h1`: within 10% of today's 1,063 ms.
- Page height at 390, all disclosures closed: ≤ 39,798px plus the growth of each in-flow closed control lifted to 44px (44 minus its height today).
  - The note has 12 sub-44 summaries at 24px (review `probe3.json`, `summaries24`), so the budget is 39,798 + 12 × 20 = 40,038px.
  - The review injected the floor on summaries and in-page anchors and measured 40,037px.
  - Any other in-flow lift the tap probe forces adds its own growth, and the PR lists it.
  - The jump bar's padding trade adds nothing.

## Build plan

Each step lands as its own commit, and each is reversible.

1. **Shared primitives (M).**
   - Add `shared/hooks/useDocumentTitle.ts`.
   - Add `shared/ui/touch.ts`: `coarseFloor`; `selectCoarseFloorSx`, moved from `pages/alerts/alertsUi.tsx` and changed to border-box; `standaloneLinkSx`; `proseLinkSx`.
   - Add `shared/ui/useScrollRegion.ts`.
   - In `shared/theme/theme.ts`, three changes are unconditional: add `summary` to the floor, give ToggleButton an unselected `text.secondary` label, and give `MuiSwitch` its coarse hit area.
   - Only if open question 1 is yes: the P-6 selected state in `theme.ts`.
   - Append one Amendments row to `DESIGN_SYSTEM.md` for the rule-7 mechanics (local floors, the border-box select, the two compact-control mechanisms) and the `text.disabled` rule. If open question 1 is yes, the same row extends P-6 to ToggleButton. If it is no, the row closes the 2026-10-13 call/put label item with the measured label colours.
2. **Overlays (S).** `CommandPalette.tsx` (hidden heading and `aria-labelledby`), `TopNav.tsx` (drawer label, hamburger ref, `returnFocus`), `TradeEntryDialogView.tsx`, `StateExportDrawer.tsx` (title id, and `useScrollRegion` with per-section labels on each `<pre>`).
3. **Touch sweep (M).**
   - Links and bars: `MarketDataNotice.tsx`, `DocPage.tsx`, `CreditsPage.tsx`, `WhatsLive.tsx`, `BlogPostPage.tsx`, `CreditsLink.tsx`, `TopNav.tsx`, `RequireAuth.tsx`.
   - Desk and charts: `TickerHeader.tsx` (the verdict chip's pseudo-element hit area, and the trade button), `TickerToolbar.tsx`, `features/personas/components.tsx`, `ChartFrame.tsx`, and the six local-24 summary sites (Why › Input claims corrected while verifying, first bullet): `InsiderClusters.tsx`, `FiledFigures.tsx`, `FundHoldings.tsx`, `Peers.tsx`, `CreditsPage.tsx` and `alertsUi.tsx`.
   - Research: `NoteView.tsx` (outer link and inner pill, and the jump bar's coarse padding), `MarketsPage.tsx`. The 'Try again' buttons are already 44px under coarse and are not edited.
   - Scanner, Positions and Alerts: `ScanToolbar.tsx`, `PositionRow.tsx`, `AlertsPage.tsx`, `NewAlertDialog.tsx`.
   - The remaining `Select` sites, `SettingsPage.tsx` among them, and `LatencyTrend.tsx`.
   - Then run the tap probe, including the hit test and neighbour check, and fix what it still finds. The export COPY buttons are the first known candidate.
4. **Contrast sweep (M).**
   - The 34 colour uses in `text-disabled-sites.txt`, the six in `operator-metrics.tsx` among them.
   - `FieldLabel.tsx`, `TickerDashboard.tsx`, the SIMULATED chip, `OrderRow.tsx`, `OrdersPanel.tsx` and `TrackRecordSection.tsx`.
   - `LegFields.tsx`, by the answer to open question 1. No: the ink and white labels, and the hover overrides removed. Yes: the call and put overrides removed.
5. **Insider chart and twin.**
   - 5a (M): `InsiderClusters.tsx` (svg role, dots and twin data) and `ChartFrame.tsx` (list of twins, link cells, rows on open).
   - 5b (S, separable): `InsiderClusters.tsx` axis thinning and role wrap.
6. **Note scrollers (S).** `NoteBody.tsx` (the `TableBlock` component and the code block, both through `useScrollRegion`) and `blocks/Valuation.tsx:1202`.
7. **Palette phone pass.**
   - 7a (S): `CommandPalette.tsx` (Cancel, and coarse hiding of the kbd hints and '? all shortcuts') and `GammaSurfaceHero.tsx` (one span around the trailing key fragment).
   - 7b (S, separable): the footnote and note marker in `CommandPalette.tsx`, and the footnote string in `CommandPalette.spec.tsx:57-58`.
8. **Titles (S).** Replace the six local effects. Add calls in `app.tsx` (desk, Technical), `RequireAuth.tsx` (`docTitle` prop on both walls), `NotesView.tsx`, `ResearchView.tsx` (until spec 4 C2 deletes it), `ResearchIndexPage`, `MarketsPage.tsx`, `FilingsPage.tsx`, `ScorecardPage.tsx`, `AlertsPage.tsx` and `features/auth/SettingsPage.tsx`.
9. **Verify (S).** The Verification steps, with exit codes recorded.

## Open questions for the owner

1. **Should every ToggleButton's selected state follow P-6 (outline plus weight), theme-wide, with Call and Put losing their green and red?**
   - What the canon says now:
     - P-6 (`DESIGN_SYSTEM.md:275`) was ruled for the current quick symbol only.
     - The 2026-10-13 `textUp`/`textDown` row (`:271`) deliberately left 'the call/put toggle fill' on the fill hues and opened only the white label's contrast.
     - Ruling #18 (`:69`) bans call-vs-put tint on position and P&L surfaces and keeps it on gamma surfaces.
     - `LegFields.tsx:206-208` treats Call/Put as a domain fact on an instrument control.
   - A theme-wide change reaches all 24 `<ToggleButton>`s in 8 files (git grep, spec files excluded):
     - Settings appearance Dark / Light / System (`SettingsPage.tsx:585-593`);
     - the risk-inputs pair (`RiskInputsSection.tsx:239`, `:247`);
     - the persona tolerance and level toggles (`features/personas/components.tsx:167-189`);
     - Open / History on Positions (`OrdersPanel.tsx:119`, `:122`);
     - the fill mode (`FillModeToggle.tsx:42-50`);
     - Buy / Sell, Option / Shares and Call / Put (`LegFields.tsx:104-229`);
     - Limit / Market (`TradeEntryDialogView.tsx:819-820`);
     - the desk's own Field / Magnet (`pages/ticker/widgets/structure-hero/StructureHeroPanel.tsx:400-405`), which sits in the desk hierarchy approved on 2026-10-16.
   - **Recommended: no, for this spec.** The no branch in (c) meets the contrast floor on its own and changes only labels. It leaves the approved desk and the 2026-10-13 fill decision as they are. One selected look across the app is a design proposal in its own right, not an accessibility fix.
2. **Should the insider twin show both tables, the windows and then every trade, in one 'Show the numbers'?** Today the twin shows windows when any exist, so the per-trade detail behind the dots has no keyboard or touch path. **Recommended: yes.** The trades table is collapsed by default and built only when opened, so it costs nothing until asked for.
3. **Should the insider plot itself be a tab stop?** The input proposed one focusable figure. A focusable element that does nothing on Enter adds a stop with no action. Screen readers read the `role="img"` label in reading order without one, and the frame's 'Show the numbers' is the real next step. **Recommended: no tab stop on the plot.** The chart's keyboard path is its source chip and 'Show the numbers'. The same reasoning makes a note scroller a stop only while it scrolls (d).
