# Wave 2 · lane D · site-wide QA against the Final boards (2026-10-15)

Base `244a7837` (Wave 1 merged; Wave 2 A, B and C not yet merged). Demo build on :4329, live mode on
:4339 against a local API (paused market data, public data on, SEC not set up locally). 25 routes,
both builds, 390 and 1280 px, dark and light: 200 full-page captures plus scripted checks of links,
⌘K, focus, the phone drawer and the Log in dialog.

Evidence (lane D's worktree):
`/Users/rodrigoarias/dev/convexa/.claude/worktrees/agent-ad770fe3356f742f5/tmp/qa/`
- `shots/`: screenshots
- `boards/`: board renders
- `results-{demo,live}.json`, `seams-{demo,live}.json`, `results-live-partial.json`

Findings are not yet adversarially verified. The lane re-checked 1–6, 8, 10, 12, 13 and 17 against
the screenshots itself.

## Findings, most severe first

1. **HIGH · Live note `/ticker/NVDA/research` and its slug: tables break apart.**
   - At 390 px, table cells wrap 1–2 characters per line ("T/O/T/A/L").
   - At 1280 px, words split mid-token ("$41/1.7/B") and "$108.5B" runs into the next sentence.
   - Board: final-note-phone. Shot: live-ticker_NVDA_research-390-dark.s14.png.
   - Likely: `pages/research/NoteBody.tsx:214` (`overflowWrap: 'anywhere'`), `blocks/Figures.tsx:73`.
2. **HIGH · Demo desk `/ticker/SPY` and `/ticker/NVDA`, all widths: sample data is unmarked.**
   - No Sample tag, "shaped like" chip or scenario line anywhere (P-3/P-8).
   - Live-feed cues on sample data: a live dot, "Structure as-of 15s", a "running" tape with an
     advancing clock, and a non-P-2 "⚠ no live ticks" chip.
   - Board: final-desk-staging.
   - Likely: `TickerDashboard.tsx`, `Widget.tsx`, `TickerHeader.tsx`, `LiveTape.tsx`.
3. **HIGH · Demo `/scanner`: sample data is unmarked.**
   - No sample frame or tags. The only marker is a burnt-orange ⚠ warning box; rows read
     "Structure as-of 0s".
   - The row preview and the "Your view" card are missing; internal explainer cards ship instead.
     The spec card lists the screen as shipped.
   - Board: final-scanner-staging.
   - Likely: `pages/scanner/Scanner.tsx`, `format.ts`, `ScanTable.tsx`.
4. **HIGH · Demo `/positions`: the seeded order fills on load.**
   - The Nov 20 limit 6.50 order fills because the seeded mark is 4.47.
   - The page then shows $950 at risk and −$256, against the board's $300 and −$53.
   - It also says "No simulated orders yet" beside "From sim order" links, and "recorded recorded".
   - Likely: `libs/api/src/lib/demo/workspace.ts:485-500`, `orders/copy.ts`, `outcomes/copy.ts:296`.
5. **HIGH · Demo `/research/markets`: production notes in the demo.**
   - The note-rate chart lists production's 14 real notes, scored against the sample 5.15% 10-year.
   - Board: four demo notes.
   - Likely: `MarketsPage.tsx:841-847`.
6. **HIGH · `/` on both builds at 390 px: hero curve crosses the text.**
   - The amber hero curve cuts vertically through the headline column, both CTAs and the caption.
   - Likely: `pages/landing/HeroCurve.tsx:70-85` (`preserveAspectRatio="none"`).
7. **MEDIUM · Demo AI read on `/ticker/SPY` (seen in the browser only).**
   - The verdict appears only after a click, and the trace line is missing.
   - The drawer shows "Variant fingerprint: spy-synthetic-variant-7-v1", a real-clock "7d 16h" and
     "Oct 9 (0 DTE)".
   - Likely: `widgets/ai-rec/*`.
8. **MEDIUM · Structure field (landing on both builds, demo desk): sign by hue, amber flip.**
   - Wall labels carry gamma sign by red/green only, with no ±γ (P-11; also a landing acceptance
     line).
   - The flip line and label are amber, where the board draws phosphor or a neutral dash.
   - Lines strike through labels.
   - Likely: `structure-field/levelStrokes.ts:34`, `paintStep.ts:411`.
9. **MEDIUM · Live `/research/markets`: slow, wordless loading.**
   - A cold API call takes about 8 s; until then the page is bare grey blocks with no words.
   - No frame names its metric while loading (P-10).
   - Likely: `MarketsPage.tsx:1516-1534`.
10. **MEDIUM · Live: no "sign-ups are closed" sentence.**
    - The Log in dialog and signed-out Settings never say "New sign-ups are closed…", which the
      board and acceptance require.
    - The disabled Google button looks enabled.
    - Likely: `features/auth/AuthDialog.tsx:246` (the sentence only renders in signup mode),
      `SettingsPage.tsx:311-330`.
11. **MEDIUM · Markets curve title, both builds: averages a twist into "rose".**
    - On the demo the 3-month fell 0.21 while the title says the curve rose 0.6.
    - Likely: `MarketsPage.tsx:345-357`.
12. **MEDIUM · Live `/credits`: dates and counts.**
    - The release-schedules card shows a bare "Updated" with no date.
    - Three cards read "week to Wednesday, Wednesday, Oct 7".
    - Daily sources are marked "Updated" with 8-day-old dates.
    - The summary counts 5 of 11 cards while the rest are still checking.
    - Likely: `CreditsPage.tsx:89-129, 162-185`.
13. **MEDIUM · ⌘K rows.**
    - Demo rows read "NVDA 81 as of 184h ago", a wall-clock age on sample data, with no company name
      or tier.
    - Live rows for tickers without a note show the bare symbol.
    - Likely: `CommandPalette/format.ts:54-63`.
14. **MEDIUM · State words disagree across pages.**
    - Demo Methodology says "Sample · shaped like…", where Credits and the board say "Demo · shaped
      like…".
    - Live Methodology says "Sample" instead of "Illustrative sample", lacks the "Live here" tag, and
      omits the release schedules that Credits lists as live.
    - Likely: `pages/methodology/WhatsLive.tsx`, `copy.ts`.
15. **MEDIUM · Methodology footer, both builds: wrong primary button.**
    - "Open Scanner" is the amber-filled primary, although production keeps the Scanner behind
      sign-in.
    - The board makes "Open free Ticker" the primary.
    - Likely: `MethodologyPage.tsx:318-349`.
16. **LOW / cross-cutting · Amber where the boards draw neutral.**
    - Shell: the avatar disc (`features/auth/avatar.ts`), "Reset demo data", the active nav label
      text (`TopNav.tsx:201`), the ticker sub-tabs.
    - Desk: "Open book →", two amber fills in one desk state, "Refresh sample".
    - Landing: the AI-sample button and "high" chip, the CTA band's outlined second button.
    - Other pages: Positions chips and exports, Settings outlines, 404 "Home", `/_ops/metrics` Pause
      and Export, the sign-in wall's "Open a ticker desk".
    - Many follow the 2026-10-13 theme default (outlined and text primary buttons take amber text),
      but the boards draw them neutral. **Canon conflict for the owner.**
17. **LOW · Live `/_ops/research`.**
    - Only the unlock form shows. The heading is visually hidden, and the board's archive sections
      are missing (`OperatorSessionArchive.tsx:340`).
18. **LOW · Markets parts missing from the board.**
    - The curve's 1-month line, legend and maturities; "Inverted below 0"; FOMC outcomes; the jump
      rail and section headings.
    - Coming up drops notes whose dates are ranges, so it says 9 of 14 instead of 11
      (`ComingUpSection.tsx:37-52`).
19. **LOW · Other unmarked demo samples.**
    - The Markets "Rates today" strip and the Filings frames have no tags.
    - The Markets and Filings footnotes cite real sources.
    - The Settings AI and Brokerage panels have solid frames.
    - Likely: `MarketsPage.tsx:225-230`, `FilingsPage.tsx:315`.
20. **LOW · Live `/research`.**
    - Coming up is out of date order (`tools/research-notes/freshness.mjs:96-99`).
    - Mini-chart captions don't explain the dashed and hatched bars, and several board tags are
      missing.
21. **LOW · Notes.**
    - The demo note lacks the sample chart, the section rail and the "Sample note" tag, and prints a
      raw ISO timestamp.
    - The live note says "gTC Berlin" (`pages/research/ui.tsx:203`), lacks the "Computed at build"
      tag, and cuts off "All research" at 390.
22. **LOW · Demo desk details.**
    - Market context captions are cut off with an ellipsis.
    - The masthead has no ▲/▼ change.
    - The read strip scrolls sideways at 390.
    - Four NVDA strip values equal SPY's exactly, which may be a seed shortcut.
23. **LOW · Positions, Settings, Scanner and Alerts.**
    - Positions: the "PAPER" chip is green; the 390 figure strip is narrow.
    - Settings: signed-out panels expand into full forms; "25000" instead of "$25,000"; the reset
      skips its confirm step (found by reading the code only).
    - Scanner: the walls column shows only the call wall; the demo never produces "Prime".
    - Alerts: the seeded rule shows only "Gamma flip".
24. **LOW · Research and site pages.**
    - Scorecard calibration labels overlap.
    - The research index lacks its filter chips.
    - Trust-page headings and the section index differ from the boards.
25. **LOW · Landing.**
    - FLIP DIST reads "−0.8% · mid above the flip"; the board says +0.8%.
26. **LOW · Live desk.**
    - TradingView's embed logs "Cannot listen to the event from the provided iframe" on every desk
      load.

**Counts:** 26 findings: 6 high, 9 medium, 11 low or cross-cutting. By build: 12 demo-only, 9
live-only, 5 both.

## Checked and fine
- No broken internal links (74 demo, 79 live).
- Every `/credits#…` deep link resolves to a card, and every "See it on the demo →" link goes to the
  staging site.
- ⌘K opens, closes, returns focus and offers "Open QXTR anyway". On live it never calls `/api/scan`.
- The skip link is the first tab stop, and the focus ring is visible.
- None of the 200 captures has horizontal page scroll or DOM/SVG text under 11px.
- The demo build sent zero requests to `/api` or off-site; live reaches only TradingView.

## Could not check
- Production with SEC set up, or signed in.
- `/_ops/metrics` with instrumentation on.
- Demo desk widgets below the fold: `content-visibility: auto` keeps them out of full-page captures,
  so they were checked through the DOM only.
- Text size inside the canvas charts.
- Dialogs other than sign-in and ⌘K, the phone AI read sheet, and loading, error and stale states.
- Light boards: the board pages render dark by default.
