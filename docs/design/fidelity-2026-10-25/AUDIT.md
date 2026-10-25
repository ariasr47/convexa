# Design fidelity audit · 2026-10-25

The Final boards (`design/site/final-*.html`) compared with the shipped app, screen by screen, and a fix plan.
Five family audits did the rendering and measuring (desk, research, account, site, foundations). This
document is the design lead's merge of them: duplicates folded, classes checked against the canon, one
recommendation per open choice, and a fix plan in lanes that never share a file.

## The answer

1. **Compared:** 153 board variants against the matching app routes on demo and live builds of `f0fcc9ac`, at
   1440×900, 1280×800, 1920×1080 and 390×844, dark and light. 128 were reachable: 11 match, 40 are mixed,
   68 drift and 9 are board-stale. The other 25 need sign-in, an options feed or fault injection.
2. **Why the widgets don't fill the space:** the app's page column. Every board uses one column: 1280px of
   content at 1440 (x80–1360) and 1480px from 1600px up (`design/src/lib.mjs:193`, `:208`). The app uses
   five: 1192 (nav, Research, Scanner, Positions, Alerts), 1152 (desk, landing, footer), 1112 (Technical,
   the ticker Research tab), 1192 again for the production note, and 552 for Settings. At 1920 the desk
   is 1152 of 1480 (78%). One shared column fixes every page in one move.
3. **Inside the column, six layouts leave holes the boards don't:**
   - **Desk context band:** a 4-up track at 1600px and up leaves whole cells empty. The cards also render
     full bodies, so the band is 21.8% empty against the board's 7%.
   - **Desk AI read:** the card stops 135px short of its row.
   - **Markets, Scorecard and Filings:** 70/30 flex rows replace the board's 7fr/5fr. One result is a 378px
     blank inside Scorecard's By month chart.
   - **Settings:** MUI `Container sm` caps it at 552px against the board's 760.
   - **Research:** note cards are 43% taller and filing rows 66% taller than the board's.
4. **Next layer:**
   - Every Dialog and Drawer paints MUI's dark-mode white wash at 0.145–0.165.
   - In light mode, secondary text is MUI grey instead of steel `#5A6B85`.
   - Tabs and toggles render in UPPERCASE.
   - State tags, controls and widget titles each run one size step off the library.
5. **Boards and owner choices:** the boards are stale in 33 places, and 14 choices need the owner. Among the
   stale boards:
   - The design index's "Open the ticker desk" still opens the September `desk.html`.
   - Every `-light` site page renders dark.
   - The Markets board predates its sections.
   - Credits draws 7 of the 11 sources.
   - Alerts claims server schedules the owner ruled out.

   The biggest owner choices are context-card density on the desk (NO-1) and the Positions structure (NO-6).

## What was compared, and how

- **Builds:** each audit exported a commit with `git archive` into `tmp/fidelity/<family>/src` and built it
  twice. The demo build (`VITE_DATA_MODE=demo`) stands for staging. The live build has its `/api` GETs
  proxied to `convexa.pages.dev` and stands for production; nobody signed in. Account and foundations ran
  on `f0fcc9ac`; the account audit read Scanner line numbers at `af9822f8`. `HEAD` is now `7ee6e4a1`.
  `af9822f8` changed the Scanner header (see the note below). `7ee6e4a1` reorganized the canvas and already
  closed two items of SITE-22.
- **Boards:** `design/site/` served statically. Each `-light` page was forced light through its scheme
  toggle, because those pages render dark as built (BOARD-STALE `LIGHT`).
- **Measured:** bounding boxes, grid tracks (`gridTemplateColumns`), gaps, empty area per row, type
  (size, weight, line height, tracking), colours from `getComputedStyle`, and section order. Each audit's
  JSON sits beside its screenshots.
- **Evidence:** scratch and gitignored. Each family has its own folder:
  - `tmp/fidelity/desk/`: 118 png, 87 json.
  - `tmp/fidelity/research/`: 136 png, 104 json.
  - `tmp/fidelity/account/`: 142 png, 197 json.
  - `tmp/fidelity/site/`: 195 png, 74 json.
  - `tmp/fidelity/foundations/`: 80 png, 101 json.

  Screenshots are named `<screen>-<variant>-board.png` and `-app.png`.
- **Re-checked by the design lead at `HEAD` `7ee6e4a1`:**
  - The column sites: `PageColumn.tsx:10` 1160; `TopNav.tsx:151`, `MarketDataNotice.tsx:99`,
    `AppShell.tsx:191` and `NotesView.tsx:38` 1240; `Scanner.tsx:279`, `ScannerNotLive.tsx:263`,
    `PositionsPage.tsx:217` and `AlertsPage.tsx:464` 1240; `Container lg` at `TickerDashboard.tsx:786`,
    `PublicDesk.tsx:76`, `DemoSymbolMissing.tsx:18` and `Footer.tsx:29`; `DocPage.tsx:123` 1120;
    `NotFound.tsx:75` 640; and `SettingsPage.tsx:337` `Container maxWidth="sm"` with `sx maxWidth: 760`.
  - Grids and widgets: `.tk-ctx` is `align-items: start` and `.tk-work` is `stretch`
    (`ticker-desk.mjs:32`, `:34`); the desk's 4-up `wide` track; the AI read wrapper and the Widget root
    (`AiRecPanel.tsx:292`, `Widget.tsx:426`). `ReadSheet` renders a fragment on desktop, so the child
    selector in DESK-03 reaches the Widget.
  - Markets and Scorecard flex rows (`MarketsPage.tsx:473-488`, `ScorecardPage.tsx:160`, `:187`).
  - Theme and tokens: `theme.ts:58` `button` has no `textTransform` and `theme.ts:282` styles the
    MuiDialog paper radius only. Light `text.secondary` is `rgba(0,0,0,0.6)` at `tokens.ts:80` and `:228`,
    while `lightSecondary` `#5A6B85` sits at `:56`.
  - Design site: `build.mjs:126` drops the scheme, and `build.mjs:142` links the index to `desk.html`.
  - The D1 Amendments row (`DESIGN_SYSTEM.md:288`) and spec 01's demo bar column (`01-demo-first-screen.md:170`, `:294`).

  The design lead also looked at four screenshots: desk context band (app and board) and Markets rates
  (app and board).

## Per-screen verdicts

Boards are under `design/site/`. "Not reachable" means the state needs a sign-in on production, an options
feed, a token or fault injection.

### Ticker desk, Technical tab, research note, AI read, desk overlays

| Screen | Board | App route | Verdict |
| --- | --- | --- | --- |
| Ticker desk · staging (1440, 1280) | final-desk-staging | demo /ticker/SPY | drift |
| Ticker desk · production (1440, 1280) | final-desk-production | live /ticker/NVDA | mixed |
| Ticker desk · phone (390) | final-desk-phone | live /ticker/NVDA | mixed |
| Ticker desk · light (1440) | final-desk-light | live /ticker/NVDA, light | mixed |
| Ticker desk · states | final-desk-states | demo /ticker/RKLB (others not reachable) | matches |
| Ticker desk · review captures | final-desk-review | n/a (embeds app captures at 1280) | matches |
| Ticker desk · spec card | final-desk-spec | demo SPY + live NVDA | mixed |
| September interactive desk | desk.html | demo /ticker/SPY | board-stale |
| Technical · staging (1440, 1280) | final-technical-staging | demo /ticker/SPY/technical-analysis | drift |
| Technical · production (1440) | final-technical-production | live /ticker/NVDA/technical-analysis | drift |
| Technical · phone (390) | final-technical-phone | live, 390 | matches |
| Technical · light | final-technical-light | live, light | mixed |
| Technical · states | final-technical-states | demo /ticker/RKLB/technical-analysis | matches |
| Research note · staging (1440, 1280) | final-note-staging | demo /ticker/NVDA/research | mixed |
| Research note · production (1440, 1280) | final-note-production | live /ticker/NVDA/research | board-stale |
| Research note · phone (390) | final-note-phone | live, 390 | board-stale |
| Research note · light | final-note-light | live, light | board-stale |
| Research note · states | final-note-states | live /ticker/RKLB/research | matches |
| AI read · Full analysis drawer | final-ai-read-staging | demo SPY → Full analysis & data | drift |
| AI read · sample export drawer | final-ai-read-export | demo SPY → View sample export | mixed |
| AI read · phone peek row | final-ai-read-peek | demo SPY, 390 touch | mixed |
| AI read · phone sheet open | final-ai-read-sheet | demo SPY, 390 → tap peek | mixed |
| AI read · production Not live | final-ai-read-production | live NVDA panel + "What a read sends" | matches |
| AI read · states | final-ai-read-states | needs a feed build or a key | not reachable |
| Overlays · expanded widget | final-overlays-expand | demo SPY → Term structure ⤢ | drift |
| Overlays · reassessment request | final-overlays-reassess | demo /positions → Broker → Build reassessment | drift |
| Overlays · browser notifications | final-overlays-notify | live /alerts signed out (control absent) | not reachable |

### Research: Notes, Markets, Filings, Scorecard and the planned tools

| Screen | Board | App route | Verdict |
| --- | --- | --- | --- |
| Notes · staging (1440, 1280) | final-research-index-staging | demo /research | mixed |
| Notes · production (1440, 1280) | final-research-index-production | live /research | drift |
| Notes · light | final-research-index-light | live /research, light | drift |
| Notes · phone | final-research-index-phone | live /research, 390 | drift |
| Notes · states | final-research-index-states | cannot be forced on a build | not reachable |
| Markets · staging | final-research-markets-staging | demo /research/markets | mixed |
| Markets · production | final-research-markets-production | live /research/markets | mixed |
| Markets · light | final-research-markets-light | live, light | mixed |
| Markets · phone | final-research-markets-phone | live, 390 | mixed |
| Markets · states | final-research-markets-states | needs fault injection | not reachable |
| Filings · staging | final-research-filings-staging | demo /research/filings | drift |
| Filings · production | final-research-filings-production | live /research/filings | drift |
| Filings · production, Not set up | final-research-filings-production-setup | live API is set up | not reachable |
| Filings · light | final-research-filings-light | live, light | drift |
| Filings · phone | final-research-filings-phone | live, 390 | drift |
| Filings · states | final-research-filings-states | needs fault injection | not reachable |
| Scorecard · staging | final-research-scorecard-staging | demo /research/scorecard | drift |
| Scorecard · production | final-research-scorecard-production | live /research/scorecard | drift |
| Scorecard · light | final-research-scorecard-light | live, light | drift |
| Scorecard · phone | final-research-scorecard-phone | live, 390 | drift |
| Scorecard · states | final-research-scorecard-states | build-time states only | not reachable |
| Planned · Calendar · staging (built) | final-planned-calendar-staging | demo /research/markets#coming-up | board-stale |
| Planned · Calendar · production | final-planned-calendar-production | live /research/markets#coming-up | matches |
| Planned · Calendar · phone | final-planned-calendar-phone | live, 390 | matches |
| Planned · Liquidity · staging (built) | final-planned-liquidity-staging | demo /research/markets#liquidity | mixed |
| Planned · Liquidity · production + phone | final-planned-liquidity-production, -phone | live: source did not answer at capture | not reachable |
| Planned · Insider clusters (built, partial) | final-planned-clusters-staging, -production | /ticker/NVDA/research public band | drift |
| Planned · Fund holdings 13F (built, partial) | final-planned-holders-staging, -production | /ticker/NVDA/research "Who holds it" | drift |
| Planned · Peers (built, partial) | final-planned-peers-staging, -production | /ticker/NVDA/research "Against its peers" | drift |
| Planned · Figures vs filing (built, partial) | final-planned-xbrl-staging, -production | /ticker/NVDA/research "Checked against the filing" | drift |
| Planned · Signal track record · staging | final-planned-signals-staging | demo /research/scorecard | mixed |
| Planned · Signal track record · production | final-planned-signals-production | blocked on licensed prices | not reachable |
| Planned · Technical readings · staging | final-planned-ta-staging | demo /ticker/NVDA/technical-analysis | drift |
| Planned · Technical readings · production | final-planned-ta-production | blocked on licensed prices | not reachable |
| Planned · Off-exchange volume | final-planned-otc-staging, -production | waits on FINRA terms (Q-2) | not reachable |

### Scanner, Positions, Alerts, Settings and the account dialogs

| Screen | Board | App route | Verdict |
| --- | --- | --- | --- |
| Scanner · staging (1440, 1280, 1920) | final-scanner-staging | demo /scanner | drift |
| Scanner · staging phone | final-scanner-staging-phone | demo /scanner, 390 coarse | drift |
| Scanner · production wall (1440, 1280) | final-scanner-production | live /scanner signed out | drift |
| Scanner · phone wall | final-scanner-phone | live /scanner, 390 | drift |
| Scanner · production signed in | final-scanner-production-signed-in | signed-in production | not reachable |
| Scanner · light | final-scanner-light | signed-in production, light | not reachable |
| Scanner · states | final-scanner-states | demo /scanner?vol=iv_cheap (Filtered out only) | mixed |
| Positions · staging (1440, 1280, 1920) | final-positions-staging | demo /positions | drift |
| Positions · staging phone | final-positions-staging-phone | demo /positions, 390 coarse | drift |
| Positions · production wall | final-positions-production | live /positions signed out | drift |
| Positions · phone wall | final-positions-phone | live, 390 | drift |
| Positions · light wall | final-positions-light | live, light | drift |
| Positions · states | final-positions-states | empty book, store errors, signed-in marks | not reachable |
| Alerts · staging | final-alerts-staging | demo /alerts | mixed |
| Alerts · production | final-alerts-production | live /alerts (fresh visitor) | mixed |
| Alerts · phone | final-alerts-phone | live, 390 | matches |
| Alerts · light | final-alerts-light | live, light | mixed |
| Alerts · states | final-alerts-states | live: empty + Blocked here reached | mixed |
| Settings · staging | final-settings-staging | demo /settings | drift |
| Settings · production | final-settings-production | live /settings signed out | drift |
| Settings · phone | final-settings-phone | live, 390 | mixed |
| Settings · light | final-settings-light | live, light | drift |
| Settings · states | final-settings-states | validation, save failure, store down | not reachable |
| Dialog · sign in | final-dialogs-sign-in | live /scanner wall → Sign in | drift |
| Dialog · trade entry | final-dialogs-trade-entry | demo /ticker/SPY → + Open simulated trade | drift |
| Dialog · order detail | final-dialogs-order-detail | demo /positions → Simulated orders → Details | drift |
| Dialog · persona | final-dialogs-persona | demo /ticker/SPY → Persona → Customize… | drift |
| Dialog · scan view editor | final-dialogs-view-editor | demo /scanner → Edit view | drift |
| Drawer · what's sent | final-dialogs-whats-sent | demo /ticker/SPY → View sample export | drift |
| Dialog · new alert, three steps | final-dialogs-alert-flow | live /alerts → New alert (step 1) | mixed |
| Dialogs · phone bottom sheets | final-dialogs-phone | same triggers, 390 coarse | drift |
| Dialogs · states | final-dialogs-states | need a form submit on production | not reachable |

### Shell, landing, blog, methodology, trust pages, 404, operator, board maps

| Screen | Board | App route | Verdict |
| --- | --- | --- | --- |
| Shell · staging (bar, nav, ⌘K, footer) | final-shell-staging | demo /research, /methodology | drift |
| Shell · production | final-shell-production | live /research, /methodology | mixed |
| Shell · light | final-shell-light | live /research, light | drift |
| Shell · phone, drawer open | final-shell-phone | live /research, 390 | mixed |
| Shell · staging phone, drawer open | final-shell-staging-phone | demo /research, 390 | drift |
| Shell · states | final-shell-states | live health 503 forced locally, ⌘K empty/no match, ? sheet; demo Reset | mixed |
| Landing · staging | final-landing-staging | demo / | drift |
| Landing · production | final-landing-production | live / (1440, 1280, 1920) | drift |
| Landing · light | final-landing-light | live /, light | drift |
| Landing · phone | final-landing-phone | live /, 390 | mixed |
| Landing · states | final-landing-states | signed-in CTA, WebGL off | not reachable |
| Blog · index | final-blog-index | live /blog | mixed |
| Blog · post | final-blog-post | live /blog/how-we-read-dealer-structure | drift |
| Blog · light | final-blog-light | live post, light | drift |
| Blog · phone | final-blog-phone | live post, 390 | drift |
| Blog · states | final-blog-states | two posts published | not reachable |
| Methodology · staging | final-methodology-staging | demo /methodology | drift |
| Methodology · production | final-methodology-production | live /methodology | drift |
| Methodology · light | final-methodology-light | live, light | drift |
| Methodology · phone | final-methodology-phone | live, 390 | drift |
| Methodology · states | final-methodology-states | needs fault injection | not reachable |
| Credits · staging | final-credits-staging | demo /credits | mixed |
| Credits · production | final-credits-production | live /credits | mixed |
| Credits · light | final-credits-light | live, light | mixed |
| Credits · phone | final-credits-phone | live, 390 | board-stale |
| Credits · states | final-credits-states | needs API faults | not reachable |
| Privacy · staging | final-privacy-staging | demo /privacy | mixed |
| Privacy · production | final-privacy-production | live /privacy | mixed |
| Privacy · light | final-privacy-light | live, light | mixed |
| Privacy · phone | final-privacy-phone | live, 390 | mixed |
| Terms · staging | final-terms-staging | demo /terms | drift |
| Terms · production | final-terms-production | live /terms | drift |
| Terms · light | final-terms-light | live, light | drift |
| Terms · phone | final-terms-phone | live, 390 | matches |
| 404 · both builds | final-not-found-both | /no-such-page, both builds | drift |
| 404 · light | final-not-found-light | live, light | drift |
| 404 · phone | final-not-found-phone | live, 390 | drift |
| 404 · states | final-not-found-states | needs fault injection | not reachable |
| Operator · staging | final-operator-staging | demo /_ops/metrics | drift |
| Operator · production metrics | final-operator-production | needs the metrics token | not reachable |
| Operator · archive, locked | final-operator-archive | live /_ops/research | drift |
| Operator · light | final-operator-light | needs the metrics token | not reachable |
| Operator · phone | final-operator-phone | needs the metrics token | not reachable |
| Operator · states | final-operator-states | live "Readout unavailable" only | mixed |
| Overlay · import archive | final-overlays-archive | demo /positions, confirm dialog (cancelled) | drift |
| Overlay · name this view | final-overlays-views | demo /positions, view picker → save as new | drift |
| Overlay · reset password | final-overlays-reset, -reset-page | parked by owner 2026-10-14 | not reachable |
| Board map · what's built | final-progress-map | none (generated) | board-stale |
| Board map · screen tracker | final-progress-tracker | none (generated) | board-stale |

### Foundations

| Screen | Board | App route | Verdict |
| --- | --- | --- | --- |
| Foundations · spec | final-foundations-spec | 18 demo + 13 live routes, acceptance probes | board-stale |
| Every chart, every state | final-foundations-chart-states | /research/markets ready/hung/failed; scorecard; note | mixed |
| Chart system | final-foundations-chart-system | /research/markets SVGs, `roles.ts` | mixed |
| Ours and theirs | final-foundations-third-party | live /ticker/NVDA/technical-analysis, loaded + blocked | mixed |
| State vocabulary × families | final-foundations-state-matrix | live NVDA, filings; demo markets, SPY | mixed |
| Component library | library.html | /alerts, /settings, /positions, /ticker/SPY, / | drift |
| Components sheet | components-sheet.html | `theme.ts` / `tokens.ts` sampled | drift |
| Tokens mirror | tokens.css + tokens/tokens.json | `verify-tokens.mjs` exit 0 | matches |
| Responsive spec | responsive-spec.html | 7 routes at 1920, 1440, 1280, 1024, 390 | drift |
| Type floor and touch floor | final-foundations-spec phone line | 25 routes at 390 coarse and 1440 | drift |

## Rulings made in this merge

These are design-lead calls on how the five audits fit together. None changes a canon rule.

- **One page column, the board's `.wrap`.** All five audits measured it, under five IDs (DESK-01, R-04,
  ACC-01, SITE-01, FND-01). It is filed once as `COL`: `maxWidth` 1360 (1560 from 1600px), with
  `px: clamp(16px, 3vw, 40px)`. The production market-data bar joins it, because the board's `v4Notice`
  sits on `.wrap`. The staging demo bar keeps spec 01's 1240 column unless the owner answers NO-2.
- **Row alignment follows the boards; density is the real cause of ragged rows.** The boards align chart
  frames and quiet cards to the start: `.tk-ctx` is `align-items: start` (`ticker-desk.mjs:34`), and the
  research grids align to the start too. Only the desk work grid (`ticker-desk.mjs:32`) and the production
  public zone stretch. The boards' rows look even because their cards are compact, not because the rows
  stretch. Stretching only moves the hole inside the card: on production Markets, the stretched 2s10s
  frame carries a 241px blank band (FND-04). DESK-02's stretch proposal is therefore not adopted. The 4-up
  track goes, and the band's evenness is NO-1. Under NO-1's option B the band does stretch, on board and
  app together.
- **The overlay surface is fixed once, in the theme.** DESK-07, ACC-06 and the surface half of SITE-03 are
  filed as `OVL`. Dialogs and drawers get the panel colour, no wash, a 1px line border and radius 16. The
  ⌘K palette alone keeps the board's raised surface (`.ss-pal`: panelRaised, lineStrong, radius 14),
  styled locally.
- **Settings without its rail.** ACC-02 and FND-02 are filed as `SET`. The 760px column is fixed, and the
  rail stays out under owner ruling D-B (ACC-31). FND-02's rail grid is not adopted.
- **Reclassified:**
  - ACC-25 (D1 marks on Scanner and Positions) moves to INTENTIONAL: the D1 row lists them as not yet
    built, under spec 03 commit (d) (`DESIGN_SYSTEM.md:288`).
  - FND-06 is split. The desk Research tab is INTENTIONAL (spec 04 C2, named in the same row). The
    Scorecard is APP-DRIFT: no spec covers it (spec 01 `:294` predates D1, and spec 04's Scorecard section
    leaves its tags alone), and its sibling pages already opt out through `FrameDemoTagProvider`.
- **Already done at HEAD:** `7ee6e4a1` closed two items of SITE-22. Company names (Q-PALETTE-NAMES) are
  decided, and the GitHub link has its own question, Q-GITHUB-HREF. What remains is the progress map
  calling drifted screens "Nothing open".
- **Counts after merging:** 74 APP-DRIFT, 33 BOARD-STALE, 11 INTENTIONAL and 14 NEEDS-OWNER, 132 in all,
  down from 139 raw findings.

## Findings by class

Severity: **high** means visible at a glance (widgets not filling space, misaligned grids, wrong
hierarchy). **Medium** means visible on inspection. **Low** means detail. The lane IDs refer to the fix
plan below. App paths are relative to `apps/dashboard/src/app/` unless shown otherwise.

### APP-DRIFT: the app changes to match the board (74)

**High (13)**

| ID | Screen | Measured (board vs app) | Fix | Lane |
| --- | --- | --- | --- | --- |
| COL (DESK-01, R-04, ACC-01, SITE-01, FND-01) | every page | Content 1280 at x80 vs 1192 at x124 (nav, Research, Scanner, Positions, Alerts), 1152 at x144 (desk, landing, footer), 1112 at x164 (Technical, the ticker Research tab). At 1920: 1480 at x220 vs 1192/1152 (78–80%). Phone gutter 16 vs 24 on Scanner/Positions. Nav logo x80 vs x124. The desk content edge (x144) sits 20px off the nav edge (x124). | `pageColumnSx` exported from `shared/ui/PageColumn.tsx`, applied to every column (list in L1 and each lane's first step) | L1 then every lane |
| DESK-02 | desk context band | Board: 3 columns at every width from 900. App at 1680: 4×276 columns; row 2 holds 3 of 4 cells, and row 3 holds Setups alone (568 of 1152 used). | Delete `wide: 'repeat(4, minmax(0, 1fr))'` (`pages/ticker/TickerDashboard.tsx:1233`). Rows even out through NO-1. | L3 |
| DESK-03 | desk work grid | The work row is 766px tall. `ai-rec-panel` is 766 and `widget-ai-rec` 631: 135×664px empty. Board: 0 empty (`.tk-work` stretch). | `'& > [data-widget-id="ai-rec"]': { flex: 1 }` on the panel sx at `AiRecPanel.tsx:292` and `:418` | L3 |
| R-01 | Research Notes cards | Card 302–323 vs 425–469px tall (+43%). Ticker mono 16/600 inline vs Archivo 32/800 on its own line. Page 2577 vs 3325 (1440), 6397 vs 8240 (390). | `pages/research/ResearchIndexPage.tsx` TickerCard `:439-542`, SampleNoteCard `:187-282`: inline 16px mono ticker plus a 13px company, a 12px meta line in place of the boxed Next, 16.5px title, footer of freshness · Written · Open note | L6 |
| R-02 (+FND-04) | Markets rates rows | Board 7fr/5fr, 737/527 (1440), 693/495 (1280), align start. App flex 836/340 (70%/28%). The production 2s10s frame stretched to 721px with a 241–260px blank inside. | `MarketsPage.tsx:473-488` (and MarketsLoading `:1978-1995`): grid `minmax(0,7fr) minmax(0,5fr)`, gap 2, `alignItems: 'start'`. Row 2 follows NO-5. | L6 |
| R-03 | Scorecard | By month: board 527×364 (41%), app 360×825 (30%) with a 378px blank inside (46%). The Calibration/Signal row stretched: signal card 588×584 with 222px blank. | `ScorecardPage.tsx:160` → 7fr/5fr grid, align start. `:187` → `repeat(2, minmax(0,1fr))`, align start. | L6 |
| R-05 | Filings feed | Row 41px vs 67–68px (+66%). Production page 1527 vs 9138px. Board one line "description · kind". | `FilingsPage.tsx:520` padding `10px 16px`. `:553-572`: one ellipsized line with ` · {kind}` at 12px secondary. | L6 |
| SET (ACC-02, FND-02) | Settings | Board panels 760 wide. App 552 (`Container sm` computes max-width 600, which beats sx 760). Fields 353 vs 153/115. Page 1805 vs 2081 (staging). | `features/auth/SettingsPage.tsx:337` → Box with `pageColumnSx`; panel Stack `maxWidth: 760`, left-aligned; risk fields fullWidth in `repeat(auto-fit, minmax(min(220px,100%),1fr))`. No rail (D-B). | L11 |
| ACC-04 | Scanner table | Board: 8 data columns, numerics right-aligned, rows 51px, tier as plain text. App: 11 columns (As-of 246px = 21% of the table and repeats the header; Status empty on all 6 rows; extra Vol), all left-aligned, rows 57px, a 37px group row, tier pills. | `pages/scanner/labels.ts:197-209` drop vol_regime/updated/status. Right-align `ScanTable.tsx:76-80`, `:258`. Plain-text TierCell `ScanCells.tsx:255-262`. Skip the single group row `ScanTable.tsx:412-417`. Show age/status only when stale. | L8 |
| ACC-05 | Scanner phone | Card 358×111 vs 320×294 (2.6×). Page 2077 vs 3149. Cards nested 10px inside the frame. | `ScanCard.tsx:68-160`: three lines (symbol/price; score bar · score · tier · regime; Flip · walls), footer only when stale. `Scanner.tsx:532-536`: head box plus dashed cards, not inset. | L8 |
| OVL (DESK-07, ACC-06, SITE-03 surface) | every Dialog and Drawer | Board: panel `rgb(19,26,36)` flat, 1px `rgba(138,155,180,0.16)`, radius 16. App: elevation-16 wash `rgba(255,255,255,0.145)` on drawers, 0.165 on dialogs, renders about `rgb(58,64,72)`, border 0. The expand dialog already has none. | `shared/theme/theme.ts:282` MuiDialog paper `{ borderRadius: 16, backgroundImage: 'none', backgroundColor: background.paper, border: 1px solid divider }`; MuiDrawer paper `backgroundImage: 'none'` plus a 1px divider on the open edge. Then drop the per-dialog panelRaised/14px overrides (L10, L11). | L2 |
| SITE-02 | Methodology | Board `.doc` 240 rail + article 562; H1 44px Archivo inside the article (rail top-aligned at y130); H2 24px Archivo 700; body 15.5/25.6 steel; What's live in bordered panels. App: pre-Final 220/760 grid; H1 34px above the grid; H2 16px Plex; body 13px primary; no panels. Page 5504 vs 4546. | `pages/methodology/MethodologyPage.tsx:216-345` adopt DocPage's layout (`trust/DocPage.tsx:121-215`); `WhatsLive.tsx` panels (radius 12, padding `16px 18px`) | L12 |
| SITE-04 | Name this view dialog | Board 560×291 with label, two helper lines, close and dividers. App 243×171 (no `fullWidth`, shrink-wraps). | `features/trading/positions/CustomizationToolbar.tsx:594` (and Rename `:629`, Delete `:657`): `fullWidth maxWidth={false}` with paper maxWidth 560, label, helpers, `DialogContent dividers`, close button | L9 |

**Medium (43)**

| ID | Screen | Measured | Fix | Lane |
| --- | --- | --- | --- | --- |
| DESK-05 | desk masthead controls | Board `.tk-ctl` one 36px row (Expirations 153, Persona 245, CTA 171). App selects 306+288 at 47px; the CTA wraps to a third line; masthead 243 vs 191. | `widgets/chrome/TickerToolbar.tsx:183-222` → `.tk-sel` chips (36px, caps label inside, value, chevron), drop `minWidth: 190` (`:186`), value "All". `TickerHeader.tsx:510-520`. | L3 |
| DESK-06 | desk phone first screen | CTA 358×44 vs 161×36. Quick symbols one scrolling row vs wrapping to two. Structure at y637 vs y770. | `TickerHeader.tsx:554` (`minHeight {xs:44}`, full width) and `:527-532`; `QuickSymbols.tsx:67` nowrap + `overflowX: auto` | L3 |
| DESK-08 | Full analysis drawer | Board verdict 28px Archivo 700, caps READ SUMMARY, 4-up figure grid with Confidence "Low", Sample read tag, levels table. App verdict 16px Plex, a 2×2 grid with Confidence "—", no tag, chips. | `widgets/ai-rec/AnalysisSurface.tsx:35-80`, `~:336`; `reasoning.tsx` LevelsStrip as a table | L4 |
| DESK-09 | expanded Term structure | The dialog is 1200×720 in both. Chart: board plot about 375px vs app 1166×152 (about 400px empty). | `widgets/term-structure/TermStructure.tsx:85-86`: measure the parent with ResizeObserver; `PH = max(110, h − PT − 22)` | L3 |
| DESK-10 | desk structure field | Board 33 strikes 640–720 with the put wall 652.22 labelled. App 11 strikes 665–715; the put wall named in the finding is off the field. | `libs/api/src/lib/demo/transport.ts:788-789`: 2.5-point strikes spanning both walls ±12. Board figures re-read in L14. | L3 |
| DESK-11 | production desk type | h1 36px (30 phone) vs 44 (36); zone h2 22/700 (20) vs 26/600 | `public-desk/PublicDesk.tsx:97` `clamp(30px, 2.8vw, 36px)`; `:271` `{xs:20, sm:22}`, 700 | L3 |
| DESK-17 | reassessment dialog | Board about 760 wide with holding strip, "The request", explanation, footer and ×. App 600×499 without them. | `features/trading/broker/reassess.tsx:162` width 760 plus the missing parts (`deep-overlays.mjs` reassessBody) | L10 |
| R-06 | Notes · Coming up | Board: one panel list, rows `64px 1fr auto` at 13px. App: an auto-fill tile grid of 6×190 tracks; staging fills 5, leaving 190px (16%) empty; phone 610 vs 330px. | `ResearchIndexPage.tsx:544-650` Panel plus `<ol>` rows | L6 |
| R-07 | Filings split and header | Board feed/detail 737/527. App 776/400. The EDGAR chip wraps to two lines in a right column (x1056, h40) vs one row under the lead. | `FilingsPage.tsx:349` 7fr/5fr grid, align start, sticky detail; `:206-260` header as a column | L6 |
| R-08 | Filings phone | The standing word (in note / new since the note) is hidden at xs; the board keeps it on line 2 | `FilingsPage.tsx:580` `display: 'inline'`, `gridColumn {xs:'2'}` | L6 |
| R-09 | Scorecard, Filings panel titles | Board: every panel title 14–15px/600 Plex, tag at the right. App: 20px Archivo display beside 15px Plex in one row. | `ScorecardPage.tsx:344-350`, `:805-807`; `FilingsPage.tsx:637-645` | L6 |
| R-10 | Scorecard, Notes · production | Missing the "On this page" legend (Computed 3 · Nothing yet 1 · Not live 1) and the build chips | `ScorecardPage.tsx:124-131` chip on production plus legend (pattern `PublicDesk.tsx:221`); `ResearchIndexPage.tsx:822-830` chip | L6 |
| LTXT (R-11, SITE-07) | every page, light | Secondary text and chart context: board `rgb(90,107,133)` (`tokens.json` light steel `#5A6B85`) vs app `rgba(0,0,0,0.6)` | `shared/theme/tokens.ts:80` `secondary: lightSecondary`; `:228` `textSecondary: lightSecondary`. `lightSecondary` is 5.00:1 on paper (`tokens.ts:56`). | L2 |
| R-12 | Research tabs | Board: a full-bleed band at y118 directly under the bar. App: inside the column at y154 with a column-width hairline. | `ResearchTabs.tsx:44-52` full-width nav, inner Box on `pageColumnSx`; render above the column in the four pages | L6 |
| R-16 | public-record band (ticker Research tab) | Frames 1112 (staging, PageColumn) and 1192 (production) vs 1280; section h2 22 vs 24 | Width: solved by COL (both columns become the page column). h2 24px in `pages/research/SecRecordSections.tsx`. | L7 |
| SITE-03b | ⌘K palette | Board `.ss-pal` 620 wide at y132, panelRaised, lineStrong border, radius 14, search glyph, esc chip, row icons, selected row `rgb(34,48,65)` radius 8 with an inset ring. App 600 at y115, selected row full-bleed 0.16 white, no glyph, esc or icons. | `shell/CommandPalette/CommandPalette.tsx:403-410`, `:630` and a local paper sx | L1 |
| ACC-07 | Scanner toolbar | Density segment ends 213px short of the column edge. Chip order differs. "Default view" vs "Your view". | `pages/scanner/ScanToolbar.tsx:169` spacer `flex: 1`; move vol chips after flip (`:196-213` → after `:232-249`); `viewLabel` `:103-107` | L8 |
| ACC-08 | Scanner note cards | Board radius 12, panel bg, padding `18px 20px`, 14px/600 titles. App radius 18, transparent, 11px caps eyebrows. | `Scanner.tsx:136-176` | L8 |
| ACC-09 | Positions table | Board "SPY 690 C · Oct 16", entry 3.00, mark 2.47, right-aligned numerics, 60px rows, dashed frame with head chip. App "SPY $690 Call", "$300 debit", "$247" plus a wrapping 163px chip, 85px rows, solid frame. | `features/trading/positions/PositionRow.tsx` `~:700-720`; `PositionsView.tsx:260-286` | L9 |
| ACC-10 | dialog widths | Board 760 (trade entry, persona, view editor), 560 (sign in, order detail), drawer 520. App 444/600/420. | Trade entry `TradeEntryDialogView.tsx:512`, persona `personas/components.tsx:132`, view editor `ViewEditorDialog.tsx:130`, order detail `OrderDetailDialog.tsx:86`, sign in `AuthDialog.tsx:179`, export drawer `StateExportDrawer.tsx:189` | L10, L11, L8, L4 |
| ACC-11 | trade entry | Board: Market selected, 4-column leg grid, Net debit / Max loss / Cap check strip, cap line. App: Manual price with a disabled primary, 8 stacked fields, no cap check. | `TradeEntryDialogView.tsx:177`, `:230` default market; `LegFields.tsx` 4-column grid from 600px; figure strip | L10 |
| ACC-12 | trade entry, order detail | SIMULATED chip success-green and CALL fills green (canon bans green/red on status chips; ruling #18 never call-vs-put) | `TradeEntryDialogView.tsx:550-559`, `OrderDetailDialog.tsx:114-123` neutral outlined chip; `LegFields.tsx:216-226` neutral selected segment | L10 |
| ACC-13 | order detail | No footer actions, status chips or figure grid. Times in the viewer's zone (11:30 AM PDT for 2:30 PM ET). | `OrderDetailDialog.tsx:100-200`; ET formatter shared with `OrderRow.tsx:66-80` | L10 |
| ACC-14 | persona customize | "Based on" blank (value `demo-careful-reader` matches no option); 600px single column; uppercase toggles | `features/personas/components.tsx` base preset, 760 two-column body (`:132`); `libs/api/src/lib/demo/workspace.ts` seed base | L11 |
| ACC-15 | phone overlays | Board: every overlay a full-width sheet with a grab handle and stacked 44px actions. App: only New alert is a sheet; order detail and view editor are centred 326px; trade entry and sign-in are full-screen. | Hoist the sheet sx from `pages/alerts/NewAlertDialog.tsx:184-195` into `shared/ui/bottomSheet.ts` (L2); apply in L8, L10, L11 | L2, L8, L10, L11 |
| ACC-16 | page titles | Board Archivo `clamp(30px,3vw,40px)` (40 at 1440), walls 28. Positions Plex 27.2; walls Plex 28/46 (24 phone); Settings 30.4. Alerts already matches. | `pages/positions/PositionsPage.tsx:229`, `features/auth/SettingsPage.tsx:339` (AlertsPage `:474-483` sx); `features/auth/RequireAuth.tsx:110-111` | L9, L11 |
| ACC-17 | touch floor, Scanner + Positions | Coarse pointer: Scanner chips 40, segments 40; Positions controls 23–39px; board 44 | `ScanToolbar.tsx:70`, `:100` coarse `minHeight: 44`; `CustomizationToolbar.tsx`, `PortfolioPanel.tsx:111`, `:138`, `orders/OrdersPanel.tsx` via `shared/ui/touch.ts` coarseFloor | L8, L9 |
| SITE-05 | landing feature rows | Copy fills its 569px track, H2 2 lines (76px), row rule plus 64px padding. App copy capped at 480: H2 3 lines (117px), no rule, 80px padding. Page 3030 vs 3312. | `pages/landing/Landing.tsx:134` drop `maxWidth: 480`; `:119` py; rule at `:122-133`; `:79` `-0.01em` | L12 |
| SITE-06 | landing AI read sample | Verdict Archivo 26/700 neutral vs Plex 26/600 amber (canon `DESIGN_SYSTEM.md:100`; ruling A) | `pages/landing/AiReadSample.tsx:66-69` (+ joined strip and explanation line `:160-195`, low) | L12 |
| SITE-08 | footer | Board 177px, wordmark inline with links at x80, disclaimer max 560. App 212px, wordmark on its own row, disclaimer about 1020 wide. | `shell/Footer.tsx:29-32`, `:106-112` | L1 |
| SITE-09 | top nav | Board 57px, links 13.5px, gap 4, search 260×34, wordmark 112×17. App 65px, links 15.2px, gap 16, search 234×36, wordmark 122×18. Link weights are ruling A, unchanged. | `shell/TopNav.tsx:154`, `:183`, `:188-190`, `:205-216`, `:246-247` | L1 |
| SITE-10 | 404 | Board left-aligned at x80, max 720, "404" mono 16, H1 `clamp(34px,4vw,52px)` (52, 2 lines), lead 17px. App centred 640 at x424, caps overline, H1 34 on 1 line, lead 15. | `pages/not-found/NotFound.tsx:75-92` | L12 |
| SITE-11 | blog post | Board measure 562, H1 46/2 lines, body 16/27.2 steel, callout on the panel. App 688, H1 38/1 line, body primary, callout inverted. | `pages/blog/BlogPostPage.tsx:85`, `:103`, `:110`, `:121-131`, `:201`, `:230` | L13 |
| SITE-12 | blog index | H1 44 Archivo vs 34; card title Archivo 28 vs Plex 24; schematic mono 11 in an inner panel vs sans 12 | `pages/blog/BlogPage.tsx:45-53`, `:93-96`; `Schematics.tsx` | L13 |
| SITE-13 | Credits, Privacy, Terms | Board rail 240 at x80, article 608 at x368, body 15.5. App rail 200 at x184, article 702 at x432, body 15. | `pages/trust/DocPage.tsx:123` (COL), `:128`, `:186`, `:265` | L12 |
| SITE-14 | operator pages | H1 Archivo 32/35.2 vs Plex 32/52.8; staging centred at x364 vs x80; archive inputs 560 vs about 778; Unlock amber vs neutral outlined | `operator-metrics.tsx:413`, `OperatorSessionArchive.tsx:79`, `:126`, `:369`, `DemoOperatorUnavailable.tsx:18-34` | L13 |
| SITE-15 | import archive dialog | Board 560×343 with callout, mono file line, close and dividers. App 600×208 without them. | `features/trading/outcomes/ArchiveBlock.tsx:194-209`, `copy.ts` | L9 |
| FND-03 | tabs and toggles | Board sentence case. App `text-transform: uppercase` on `.MuiTab-root` and `.MuiToggleButton-root` (OVERVIEW, FIELD/MAGNET, OPEN/HISTORY). | `shared/theme/theme.ts:58` `button: { fontWeight: 600, textTransform: 'none' }` | L2 |
| FND-05 | DataStateTag | Board 22px, 11/600, quiet = steel-tint fill with phosphor text, warn = warn-tint fill with solid border. App 24px, 12/500, quiet outlined steel, warn orange text on no fill. | `shared/dataState/DataStateTag.tsx:63-94` | L2 |
| FND-06a | Scorecard demo frames | D1: a sample frame names the sample once. Scorecard frames carry 2 marks on 3 of 3 (forced tag plus "Demo · …" chip). Markets 1 of 1. | Wrap ScorecardPage in `<FrameDemoTagProvider value={false}>`, as `MarketsPage.tsx:88`, `FilingsPage.tsx:89`, `ResearchIndexPage.tsx:697` do. Do not change ChartFrame's default: the desk Research tab keeps its tag until spec 04 C2. | L6 |
| FND-07 | control scale | Board `.btn` 36 (13/600), `.sm` 30 (12), `.lg` 44 (14, r10), `.chip` 22 (11/500), `.field` 36 (13). App large CTA 42 (15), small 31 (13), chips 24 (13/400), inputs 39 (15). | `theme.ts:183` MuiButton size variants; `:217` MuiChip small; `:238-240` inputs 13px/36px; then drop duplicate local chip fonts | L2 |
| FND-08 | widget titles | Board heads 14/600 (15 for claim titles), title at x+21. App h6 16/600, title at x+41 (icon slot). | `shared/ui/Widget/Widget.tsx:302` sx `fontSize: 14, lineHeight: 1.5`; remove the leading icon offset | L2 |
| FND-09 | "Show the numbers" on touch | 116×24 on a coarse pointer (floor 44; spec 02 `:141` plans it) | `shared/charts/frame/ChartFrame.tsx:353-366` `sx={[coarseFloor, …]}` | L2 |

**Low (18)**

| ID | Screen | Measured | Fix | Lane |
| --- | --- | --- | --- | --- |
| DESK-18 | note tracks | Board rail/body/side 220/530/450, gap 40. App staging 180/548/320, gap 32; production rail 200, side 260. | `pages/ticker/research/ResearchView.tsx:307`; `pages/research/NoteView.tsx:752-756` | L7 |
| DESK-19 | production public zone | The TradingView column ends 91px above the side column (align start, fixed 520 height) | `PublicDesk.tsx:336` stretch; chart height fills the row (`:341`) | L3 |
| DESK-22 | production public cards | 11px caps overlines vs 14/600 sentence-case h3 | `PublicDesk.tsx` `:405`, `:435`, `:508` | L3 |
| DESK-23 | Technical masthead | Missing the listing line ("SPDR S&P 500 ETF · NYSE Arca", "NVIDIA · Nasdaq") | `technical-analysis/TechnicalAnalysisView.tsx`, `TechnicalAnalysisLive.tsx` | L3 |
| R-18 | Filings primary action | "Open the filing" outlined where the board makes it the one amber primary; demo descriptions lack qualifiers | `FilingsPage.tsx:694-711`; `libs/api/src/lib/demo/public-data.ts:380-396` | L6 |
| R-19 | research H1, strip figures | H1 48/700/−0.02em, `clamp(32px,3.4vw,48px)` vs 48/800 fixed; strip value 24 vs 26 | Four page H1s; `publicUi.tsx:114`, `ScorecardPage.tsx:259` | L6 |
| R-20 | sample note cards | Tag "Sample note" vs "Sample" | `ResearchIndexPage.tsx:235` `word="Sample note"` | L6 |
| R-21 | research footnotes | "Not investment advice" plus the price-date sentence vs "Not financial advice" | `NoteView.tsx:40` (L7); `ResearchIndexPage.tsx:1029`, Markets, Filings, Scorecard disclaimers (L6) | L6, L7 |
| R-26 | Liquidity strip | Board: ruled strip above the frame. App: loose 4×279 figures inside it. | `pages/research/LiquiditySection.tsx` | L6 |
| ACC-20 | view editor | Board two columns (checkbox universe, 43px order rows with handles), close button, footer note. App one column of chips, 26px arrows. | `pages/scanner/ViewEditorDialog.tsx:130+` | L8 |
| ACC-21 | what's sent drawer | Board: dashed sample cards per section, outlined Copy all in the footer. App: unframed sections, amber Copy all at the top. | `widgets/ai-rec/StateExportDrawer.tsx:181-350` | L4 |
| ACC-22 | Settings forms | Labels 13px sentence case vs 11px caps; field order; cap as a 2-cell strip; "Save risk inputs"; demo AI copy | `SettingsPage.tsx:229-245`, `:467+`; `RiskInputsSection.tsx`; `AiKeySection.tsx` | L11 |
| ACC-23 | Scanner filtered-out state | Board dashed panel 610×136 with a secondary button. App bare text with an amber primary. | `Scanner.tsx:515`, `:189-200` | L8 |
| ACC-24 | panel radii | 10px and 9px vs panel 12 and control 8 | `OrdersPanel.tsx:76`, `PositionsView.tsx:286`, `PositionCard.tsx:127`, `PortfolioPanel.tsx:138` (L9); `Scanner.tsx:57` (L8) | L8, L9 |
| SITE-29 | phone drawer | Board `min(320px, 84%)`, inset rows radius 8, 16/600. App 300px, full-bleed rows at 15px. | `TopNav.tsx:364`, `:399-410` | L1 |
| FND-15 | ChartFrame loading | Solid skeleton; foot and twin dropped, so frames jump (+126px on the curve) | `ChartFrame.tsx:202-260` ghost grid; keep the foot | L2 |
| FND-16 | source chip | Weight 500 vs 400; dotted chip steel vs phosphor; border 0.85 vs 0.55 | `ChartFrame.tsx:314-322` | L2 |
| FND-17 | gridlines | Solid line token (0.16) vs dashed 3 4 at 0.14 | `shared/charts/frame/roles.ts:41` (L2); `MarketsPage.tsx:678`, `:1101` (L6); `NotePublicPanels.tsx:494` (L7) | L2, L6, L7 |

### BOARD-STALE: the board changes (33)

All of these are edits in `design/src/`, followed by `node design/src/build.mjs`. Never edit `design/site` or
`design/canvas` by hand.

| ID | Sev | Board | Contradicts | Fix |
| --- | --- | --- | --- | --- |
| DESK-04 | high | desk.html (September) | The 2026-10-16 "approved as built" desk hierarchy (`DESIGN_SYSTEM.md:286`). The site index's main button, "Open the ticker desk" (`design/src/build.mjs:142`), still opens it, and `DESIGN_SYSTEM.md:57` calls it "the rendered intent". It draws no tabs, an amber quick symbol (P-6), "Structure field" as the title (P-10), an 8fr/4fr work grid and a context filter. | Point the index button at `final-desk-staging.html`. Draw a "Superseded by Final · Ticker desk (2026-10-16)" banner in `design/src/screens/desk.mjs`. Append an Amendments row superseding the `:57` pointer, without rewriting it. |
| DESK-15 | medium | final-note-staging | Shipped work its own spec card lists: the "Public record · NVDA" band (shipped 2026-10-15), Assumptions in the rail, the v5 short-interest bars, Filings. App page 5034 vs board 1965. | `design/src/screens/final/ticker-note.mjs:119-136`, or defer to spec 04 C2, which redraws it |
| LIGHT (DESK-16, R-24) | medium | every `-light` site page | Each opens `data-scheme="dark"`; `final-desk-light.html` equals `-production` apart from its title | `design/src/build.mjs:126`: pass the screen's artboard `opts.scheme` into the site body and emit `data-scheme` from it; `schemeScript` (`:52-59`) falls back to that, not to 'dark' |
| R-13 | medium | final-research-markets-* | MARKETS_SPEC fix round 2026-10-15 (D-18): an On this page rail and the Rates, Positioning, Liquidity and Coming up sections. The board has the old lead and a state legend. App 4643 vs 2823px. | `final/research.mjs:157-171`: marketsHost lead plus `jump()`, sections, `liqSection` and `calSection` (`planned.mjs:27`, `:48`). Layout per NO-5. |
| R-15 | medium | final-research-index-staging | Q-COMING-UP answered 2026-10-15; the board still draws Coming up empty, and the `55e9473f` message says so. Ruling 2026-10-14 (3): bar values follow the seed. | `final/research.mjs:111-139`: the five sample triggers, the Next meta lines, the seed's last ten changes |
| ACC-18 | medium | final-alerts-staging | Seed has 7 rules (`libs/api/src/lib/demo/alerts.ts:19-94`) vs 5 drawn; firing wording; ruling 2026-10-14 (3) | `final/account-pages.mjs` DEMO_RULES and the Fired title |
| ACC-19 | medium | final-alerts-production, -light, -phone, alert-flow | Owner answer 5 (2026-10-15): no server-side checks. The board draws "Hourly", "Daily, 6:00 AM ET" and "Last checked 6:00 AM". | `design/src/data/alerts.mjs:8-13`, `:22-28`; `account-pages.mjs` alertsProduction |
| SITE-16 | medium | final-credits-* | 11 sources shipped (four added 2026-10-15) vs 7 drawn | `final/trust-pages.mjs:94+`; `trust.mjs` acceptance text |
| SITE-17 | medium | final-shell-production bar | Claims "short data" is live; FINRA is Off (`shared/dataState/marketData.ts:15-17`) | `design/src/lib.mjs:598` drop "short data, " |
| DESK-20 | low | final-desk-production | AiReadNotLive (shipped 2026-10-15) and the "Live · TradingView" chip | `final/ticker-desk.mjs:270`, `:277` |
| DESK-21 | low | final-overlays-expand | Draws the September term structure (7d–90d, 14.2→18.0%) vs the desk's 2d/9d/44d | `final/deep-overlays.mjs` expandBody reuses `ticker-desk.mjs` termChart (`:208-211`) |
| DESK-24 | low | final-desk-staging read strip | The score ring shipped (`ticker.mjs:74`); app cells 120 vs board 90 | `final/ticker-desk.mjs:171-174` |
| R-22 | low | planned calendar/liquidity staging, note-hosted section heads | D1: 2–3 sample marks per section | `final/planned.mjs:27`, `:48`, `:90`, `:111`, `:132`, `:152`; `planned-kit.mjs:113` |
| R-23 | low | every research board | Tabs render link blue: `lib.mjs:36` (0,4,2) beats the tab rules `:78-79` | `lib.mjs:36` add `:not(.v4-tabs a)` |
| R-25 | low | final-planned-liquidity-* | LIQUIDITY_SPEC built: three shape lanes under the line, not pills | `final/planned-charts.mjs` liquidityChart |
| ACC-26 | low | final-scanner-staging frame head | D1: a tag plus a "Sample ·" chip is two marks; the app shows one | `account-pages.mjs` demoScanTable head |
| ACC-27 | low | final-scanner-staging change column | Built entry `account.mjs:43`: ▲/▼ before the signed figure; the board strips the sign | `account-pages.mjs` `dirChg` |
| ACC-28 | low | final-alerts-production, alert-flow | `dee35570`: cluster says Computed (`pages/alerts/alertsUi.tsx:79`, `:162`) | `design/src/data/alerts.mjs:10`, `:24` |
| ACC-29 | low | every sample frame on the boards | The approved-as-built desk and the app draw an 8px top hatch band (`ChartFrame.tsx:136-146`, `Widget.tsx:440-444`); the boards hatch the whole frame (visible in `tmp/fidelity/desk/crops/ctx-board-1440.png`) | `lib.mjs:38`, `:89`, `account-pages.mjs` `.ac-strip.is-sample` → an 8px `::before` band. Colour per NO-14. |
| SITE-19 | low | landing boards | Canon landing scale 44–56px (`DESIGN_SYSTEM.md:100`) vs `clamp(38px,4.2vw,58px)`; the shipped hero curve is not drawn | `final/shell-site-kit.mjs:21`; `shell-site-front.mjs` |
| SITE-20 | low | final-blog-index | Two posts published; the board shows one and "One post so far" | `final/shell-site-docs.mjs:~60-74` |
| SITE-21 | low | final-privacy-* | `convexa.positions.owner` key, PRIVACY_CONTACT link, Oct 15 date | `final/trust-pages.mjs:244`, `:283-284` |
| SITE-22 | low | progress map | `7ee6e4a1` fixed Q-PALETTE-NAMES and Q-GITHUB-HREF. The map still calls Landing, Methodology, Blog, 404 and Operator "Built · Nothing open". | `final/shell-site.mjs`: todo items naming this audit's fidelity gaps |
| SITE-23 | low | shell states ⌘K footnote | `dcb11b06` says "A–Z" | `shell-site-kit.mjs:147`, `shell-site.mjs:49` |
| SITE-24 | low | staging bar boards | Spec 01: 1px divider, solid; the board draws dashed steel | `lib.mjs:632` FD_CSS bottom border |
| SITE-25 | low | final-shell-phone drawer | "See the full demo ↗" row shipped 2026-10-16 | `shell-site-kit.mjs:156` |
| SITE-26 | low | final-operator-archive | D-17 replaced the "None stored" tag | `shell-site-docs.mjs:140` |
| FND-11 | low | final-foundations-chart-states | P-10 (loading names the metric); P-2 closed vocabulary (no "Loading" or "Nothing yet" tags); D1 (one mark) | `design/src/components/charts.mjs:70-75`; `data/states.mjs:12-13`; `v5/system.mjs:152` |
| FND-12 | low | final-foundations-chart-system | The 2026-10-18 row: chartContext2 and chartBand are in `tokens.ts`. 14 named modules don't exist. | `v5/system.mjs:85-86`, `:111-126`, `:143`; `tokens/tokens.json`; `verify-tokens.mjs:113` |
| FND-13 | low | final-foundations-state-matrix | P-2: tag word, then detail ("Checked 14:00 UTC" → "Updated · 14:00 UTC") | `design/src/data/states.mjs:93`, `:109`, `:173` and siblings |
| FND-18 | low | final-foundations-third-party | P-2 names "Live · TradingView" for third-party frames; the app shows it | `components/charts.mjs:216` |
| FND-19 | low | final-foundations-spec | Staging daily chart tag is "Sample series · not recorded market history" (`ticker-tech.mjs:103`, `:134`) | `final/foundations.mjs:25`; `planned-spec.mjs:322` |
| FND-20 | low | responsive-spec | Nav has no clock or bell on any Final board or route | `design/src/screens/responsive-spec.mjs:19`; one search width set in `TopNav.tsx` (L1) |

### INTENTIONAL: no change, with the ruling that makes it so (11)

| ID | Difference | Why it stays |
| --- | --- | --- |
| DESK-25 | Desk masthead "Demo · sample data" tag and two Sample marks per frame, on board and app | D1 row (`DESIGN_SYSTEM.md:288`): the desk is "Not yet built (spec 3 commit (d))". Board and app change together. |
| DESK-26 | Amber selection ring, drag grip, "View sample analysis" | Spec 03 removes them ("Widget selection is removed", `03-trader-surfaces-demo.md:89-96`). Not built yet. |
| DESK-27 | No "Add a widget" tile, no context filter | Lane 4 removed both as affordance-only (`ticker.mjs:84`). Spec 03 non-goal. |
| DESK-28 | 3 quick symbols on production, pins first on the demo | Pins plus recents (`ticker.mjs:20`). The board's order is optional (L14, low). |
| DESK-29 | Phone read opens on its peek row | `434c7834`, site check D-07; final-ai-read-peek draws it |
| DESK-30 | "Review due · since Oct 22" vs "Current" | Freshness is worked out in the reader's browser from today's date (`ticker.mjs:151`, `:159-160`) |
| R-28 | Technical readings and production signals blocked; OTC waits | TA_SPEC and SIGNALS_SPEC need a licensed price history; OTC_SPEC waits on Q-2. The board's RSI/EMA numbers follow the seed (ruling 2026-10-14 (3)), fixed in L14. |
| ACC-25 | Scanner/Positions legend and per-row Sample tags | D1 row: "Not yet built: the desk, Scanner and Positions (spec 3 commit (d))" |
| ACC-31 | No Settings section rail | Owner D-B: the rail is phase 4 (`curvature-v2-surfaces/SPEC.md:753`; `account.mjs:249` parked) |
| ACC-32 | SPY 690.63 vs 690.62 | The demo's sample tape moves prices after load; the board is a still frame at 2:30 PM |
| FND-06b | Desk Research-tab frames carry the forced demo tag plus a chip | D1 row: "the desk's Research tab, whose frames keep the forced demo tag until spec 4 C2" |

### NEEDS-OWNER: a real choice, with one recommendation each (14)

| ID | Question | Options | Recommended |
| --- | --- | --- | --- |
| NO-1 (DESK-12) | Desk context cards: compact summaries or full bodies? | **A:** the board's summary (finding as title, one figure, one line, source chip) in the quiet band, with the full body in the existing 1200×720 expand overlay. **B:** redraw the board with the app's full bodies, and stretch the band's rows on both board and app. | **A.** Measured, the board's band is 710px with rows within 53px; the app's is 1188px with 21.8% empty (298k px²). The canon calls it the "quiet context band", and the overlay already exists. |
| NO-2 (FND-01, board part) | Staging demo bar column: spec 01's 1240, or the page column? | **A:** keep 1240 (spec 01 `:170`; the staging boards). The bar then sits 20px inside the page edge at 1440 and 120px at 1920. **B:** follow the page column, as the production bar does on the board (`v4Notice` on `.wrap`). | **B.** Spec 01 took "MarketDataNotice's column", which COL moves to the page column. Bar, nav and page then share one edge. The 6px/0 gaps stay. |
| NO-3 (DESK-13) | Ticker tabs: board pills or the shipped underline? | **A:** the app adopts phosphor pills. **B:** the board adopts a text-colour underline. | **B.** It matches the 2026-10-13 section-tab pattern and the 2026-10-16 approved captures. Sentence case comes from FND-03 either way. Board: `design/src/screens/v4/hybrid-desk.mjs:17`, `:21`. |
| NO-4 (DESK-14) | Production note anatomy: the board's three columns with live panels in the side, or the shipped five-part note? | **A:** redraw `final/ticker-note.mjs:93-118` to the shipped anatomy and move only "Filed since this note" into the side column. **B:** move all four positioning panels back to the side. | **A.** Spec 04 cites the shipped order. "Filed since" is the one freshness input the board keeps beside the note; today it sits about 20,000px down. |
| NO-5 (R-14, FND-04) | Markets Rates rows: what sits beside 2s10s? | **A:** [2s10s 7fr \| drift 5fr]. **B:** 2s10s full width, then note-rate drift full width. Curve and decomposition stay 7fr/5fr either way. | **B.** Drift's height follows the note count (4 rows on the demo, 14 on production), so no fixed pair balances in both builds. Today the pair leaves a 52px blank on staging and 241–260px on production. At full width, 2s10s's year of FOMC marks gets the 1280px the board gives it. |
| NO-6 (ACC-03) | Positions structure: Final board or spec 03 wireframe? | **A (board):** a full-width 3-cell strip, toolbar, book, then orders \| track record. **B (spec 03 `:394-407`):** header figures, full toolbar, book first, full-width orders. | **A,** with book first (both agree) and the shipped five-family Track record kept as a full-width row below. The strip spans 1280 vs 360px, and the orders panel stops being 40% empty. Board track-record panel redrawn (`account-pages.mjs:137-141`). |
| NO-7 (R-17) | Filings default selection | **A:** the newest 10-Q/10-K, else the newest filing. **B:** the newest filing (today: an 8-K vote with no figures, which leaves 478px of empty detail). | **A** |
| NO-8 (R-27) | Signal track record placement | **A:** keep the Scorecard board's half-width layout (as built) and redraw `planned-kit.mjs:155-158`. **B:** build a Scorecard jump rail and a full-width section. | **A** |
| NO-9 (SITE-18) | Landing "drawn as a field" illustration | **A:** redraw the board as the shipped field (`shell-site-kit.mjs:226-231`), keeping its one-line encoding subtitle, which the app adds in `StructureFieldSample.tsx`. **B:** rebuild the app as the bar chart. | **A.** The headline says "field", the desk field is approved as built, and D-08's plates live on it. |
| NO-10 (SITE-27) | Phone production bar: keep "Public data is."? | **A:** match the app (one 41px line). **B:** add it to `MarketDataNotice.tsx` at xs (+22px). | **A** (`lib.mjs:598`, `shell-site.mjs:44`) |
| NO-11 (SITE-28) | ⌘K Go to order | **A:** nav order (Research third). **B:** keep Research last (`commandTable.ts:20-26`). | **A.** Each row shows its g-key, and the sheet already lists g s · t · r · p · a. |
| NO-12 (ACC-30) | One page-title size for the account pages | **A:** every page at `clamp(30px,3vw,40px)`. **B:** 28px everywhere. | **A.** Three of four boards and the shipped Alerts use it. The Scanner side belongs to the header workflow (see the note below). |
| NO-13 (FND-10) | Chart scrub and keyboard-focus states | **A:** build a shared crosshair and chart keyboard path. **B:** mark the board's interaction states "not adopted" (spec 02: the table twin is the keyboard path). | **B** (`v5/system.mjs:162-166`). Revisit if scrubbing becomes a goal. |
| NO-14 (FND-14) | Sample hatch colour | **A:** the app takes the board's `--hatch`. **B:** the boards take the app's steel at 28%. | **B.** Measured contrast against the panel: 1.04:1 for the board's (effectively invisible) vs 1.62:1 for the app's. P-3's hatch exists to be seen. |

## FIX PLAN

Fourteen lanes. No two lanes share a file. Sizes: **S** is one or two files and a few lines; **M** is several
files in one family; **L** reworks a family's layout.

Rules for every lane:

- **Order:** L1 step 1 lands first, because every lane's column step imports `pageColumnSx`. Run L2 early,
  because its theme changes move measurements in every other lane. L8 (Scanner) starts only after the
  Scanner header workflow has committed. L14 (boards) starts only after the other workflow's `design/`
  edits are committed. Fixes tied to an owner question wait for its answer.
- **Verification:**
  - App lanes: `npm run typecheck`, `npm exec nx test @convexa/dashboard` and `npm run verify`, checking
    each exit code.
  - The board-vs-app acceptance below, re-measured at the same viewport, with the measurement JSON saved
    under `tmp/fidelity/`.
  - L14: `node design/src/build.mjs`, then `node design/src/verify-tokens.mjs`, both exit 0, and a NUL-byte
    scan of every edited source.
- **Order inside each lane:** high-severity APP-DRIFT first, then BOARD-STALE, then medium and low.

### L1 · Page column and shell (M)
Files: `shared/ui/PageColumn.tsx`, `shell/TopNav.tsx`, `shell/MarketDataNotice.tsx`, `shell/AppShell.tsx`,
`shared/ui/RouteFallback.tsx`, `shell/Footer.tsx`, `shell/CommandPalette/CommandPalette.tsx`,
`shell/CommandPalette/commandTable.ts`.

1. **COL, shared column (high).** Export
   `pageColumnSx = { width: '100%', maxWidth: { xs: 1360, wide: 1560 }, mx: 'auto', px: 'clamp(16px, 3vw, 40px)', boxSizing: 'border-box' }`
   from `PageColumn.tsx`, replacing `maxWidth: 1160` at `:10` and keeping its py. The `wide` breakpoint is
   `theme.ts:97`. *Acceptance:* the Technical tab's content runs x80–1360 (1280) at 1440, x220–1700 (1480)
   at 1920, 1203 at 1280, and 358 at 390. Board `.wrap` gives the same numbers.
2. **COL, nav and production bar (high).** `TopNav.tsx:149-153` and `MarketDataNotice.tsx:99` use the
   column; so does `RouteFallback.tsx:22`. *Acceptance:* the wordmark is at x80 at 1440 and x220 at 1920
   (board), and the production bar text starts at x80.
3. **COL plus SITE-08, footer (high/medium).** `Footer.tsx:29` uses the column. Wordmark and links share
   one row; the disclaimer has max 560 and 12px. *Acceptance:* footer 177px at 1440, wordmark at x80 on
   the links row.
4. **SITE-09, nav geometry (medium).** Height 56, links 13.5px with px 1.25 and gap 0.5, search 260×34,
   wordmark 17. *Acceptance:* header 57 with its border, links 13.5px, search 260×34.
5. **SITE-03b, ⌘K palette (medium).** Local paper: panelRaised, lineStrong border, radius 14, width 620.
   Selected row `panelRaised2`, radius 8, inset ring. Leading search glyph and an "esc" key.
   *Acceptance:* 620 wide at y132; the selected row is `rgb(34,48,65)`.
6. **SITE-29, phone drawer (low).** Width `min(84vw, 320px)`, inset rows with radius 8, 16px text.
   *Acceptance:* drawer 320 wide at 390; rows inset 16px.
7. **NO-11 (if A).** Move `surface-research` to third in `commandTable.ts:21-25`.
8. **NO-2 (if B).** `AppShell.tsx:191`: the demo bar takes `pageColumnSx`. *Acceptance:* the bar's text
   starts at x80 at 1440, the same as the nav.

### L2 · Theme and shared primitives (M)
Files: `shared/theme/theme.ts`, `shared/theme/tokens.ts`, `shared/dataState/DataStateTag.tsx`,
`shared/charts/frame/ChartFrame.tsx`, `shared/charts/frame/roles.ts`, `shared/ui/Widget/Widget.tsx`,
`shared/ui/bottomSheet.ts` (new).

1. **OVL, overlay surface (high).** `theme.ts:282`: MuiDialog paper gets `backgroundImage: 'none'`, the
   paper colour, a 1px divider border and radius 16. MuiDrawer paper gets `backgroundImage: 'none'` and a
   1px divider on its open edge. *Acceptance:* computed `background-image: none` and bg `rgb(19,26,36)` on
   the Full analysis drawer, export drawer, read sheet, view editor, persona, new alert, reassess, archive
   and name-view dialogs. Border `1px rgba(138,155,180,0.16)` (board).
2. **FND-03, sentence case (medium).** `theme.ts:58` `button: { fontWeight: 600, textTransform: 'none' }`.
   *Acceptance:* `text-transform: none` on `.MuiTab-root` (/ticker/SPY) and `.MuiToggleButton-root`
   (/positions).
3. **LTXT, light secondary (medium).** `tokens.ts:80` and `:228` use `lightSecondary`.
   *Acceptance:* in light mode, the /research lead and nav links are `rgb(90,107,133)`; re-run the
   token-contrast check.
4. **FND-05, DataStateTag (medium).** 22px, 11/600; quiet = steel-tint fill with phosphor text; warn =
   warn-tint fill with a solid warn border. *Acceptance:* the "Off" tag on live /ticker/NVDA is 22px tall
   with bg `rgba(138,155,180,0.16)`, no border and phosphor text.
5. **FND-08, widget title (medium).** `Widget.tsx:302` 14px with line height 1.5; no leading icon offset.
   *Acceptance:* "Sample tape" is 14/21 with its title at x+21.
6. **FND-09, FND-16, FND-15, chart frame (medium/low).** `ChartFrame.tsx:353-366` takes coarseFloor;
   `:314-322` chip weight 500 with a steel colour and border for third-party and sample; `:202-260` ghost
   grid while loading, with the foot kept. *Acceptance:* "Show the numbers" is 44px tall on a coarse
   pointer; the chip is 11px/500.
7. **FND-17, grid colour (low).** `roles.ts:41` `grid: palette.divider`.
8. **ACC-15 shared piece (medium).** Create `shared/ui/bottomSheet.ts` from the sheet sx and grab handle at
   `pages/alerts/NewAlertDialog.tsx:184-195`, with stacked 44px actions below 600px.
9. **FND-07, control scale (medium; last, because it moves every page).** MuiButton small 30/12, medium
   36/13, large 44/14 with radius 10; MuiChip small 22/11/500; inputs 13px at 36px. *Acceptance:* matches
   `library.html` `.btn`, `.chip` and `.field` (36, 30, 44, 22, 36).

### L3 · Ticker desk layout (L)
Files: `pages/ticker/TickerDashboard.tsx`, `pages/ticker/public-desk/PublicDesk.tsx`,
`pages/ticker/DemoSymbolMissing.tsx`, `pages/ticker/widgets/ai-rec/AiRecPanel.tsx`,
`pages/ticker/widgets/chrome/TickerToolbar.tsx`, `pages/ticker/widgets/chrome/TickerHeader.tsx`,
`pages/ticker/widgets/chrome/QuickSymbols.tsx`, `pages/ticker/widgets/term-structure/TermStructure.tsx`,
`pages/ticker/TickerTabs.tsx`, `pages/ticker/technical-analysis/TechnicalAnalysisView.tsx`,
`pages/ticker/technical-analysis/TechnicalAnalysisLive.tsx`, `libs/api/src/lib/demo/transport.ts`.

1. **COL (high).** `TickerDashboard.tsx:786`, `PublicDesk.tsx:76` and `DemoSymbolMissing.tsx:18`: replace
   `Container lg` with a Box on `pageColumnSx`. *Acceptance:* desk content x80–1360 at 1440; the work grid
   is 737/527 (board 7fr/5fr); context tracks are 416px.
2. **DESK-02 (high).** Delete the `wide` 4-up track at `TickerDashboard.tsx:1233`; alignment stays
   `start`, as `ticker-desk.mjs:34`. *Acceptance:* at 1680 and 1920 `.tk-ctx` has 3 tracks and no empty
   cell.
3. **DESK-03 (high).** `AiRecPanel.tsx:292` and `:418` get `'& > [data-widget-id="ai-rec"]': { flex: 1 }`.
   *Acceptance:* `widget-ai-rec` height equals `ai-rec-panel` height, so the gap goes from 135 to 0 at 1440
   and 1280.
4. **DESK-05 (medium).** Masthead controls become `.tk-sel` chips with the CTA on the same row.
   *Acceptance:* one 36px control row; masthead about 191px (board 161 + 30).
5. **DESK-06 (medium).** Phone CTA full width at 44px; quick symbols scroll sideways. *Acceptance:* CTA
   358×44; Structure at y≈637 at 390.
6. **DESK-09 (medium).** Term structure fills the overlay. *Acceptance:* in the 1200×720 dialog the plot
   is ≥ 370px tall (board ≈375).
7. **DESK-10 (medium).** Demo strikes span both walls. *Acceptance:* the field's axis shows 652.22 (put
   wall) and 704.02 (call wall) labels; about 33 strikes.
8. **DESK-11, DESK-19, DESK-22 (medium/low).** Production h1 `clamp(30px,2.8vw,36px)`; zone h2 22/700;
   public zone stretch; card titles as 14/600 h3. *Acceptance:* h1 36 at 1440 and 30 at 390; chart column
   ends level with the side column.
9. **DESK-13 app side (per NO-3).** `TickerTabs.tsx:31`: tabs 13px with min width 96 and min height 44.
10. **DESK-23 (low).** Listing line in both Technical mastheads. *Acceptance:* "SPY SPDR S&P 500 ETF · NYSE
    Arca" and "NVDA NVIDIA · Nasdaq".

### L4 · AI read drawers (M)
Files: `pages/ticker/widgets/ai-rec/AnalysisSurface.tsx`, `pages/ticker/widgets/ai-rec/reasoning.tsx`,
`pages/ticker/widgets/ai-rec/StateExportDrawer.tsx`.

1. **DESK-08 (medium).** Caps READ SUMMARY, an Archivo 700 verdict at 26–28px, a 4-up figure grid
   including Confidence, a "Sample read" tag in the head, and levels as a Level/Price/From spot/Side table.
   *Acceptance:* the verdict is 28px Archivo, and the plan row has 4 cells in one row at 560.
2. **ACC-10 drawer width (medium).** `StateExportDrawer.tsx:189` `width { sm: 520 }`. *Acceptance:* 520
   (board).
3. **ACC-21 (low).** Dashed sample cards per section; an outlined Copy all in the footer with its note.

### L5 · Desk context cards (L; waits for NO-1)
Files: `pages/ticker/widgets/dealer-flow-projection/`, `market-context/`, `fresh-positioning/`,
`off-exchange-blocks/`, `setups/`.

1. **NO-1 A.** The quiet band shows the board's summary: finding as the title, one 18px mono figure, one
   line, the source chip. The full body renders `inOverlay`. *Acceptance:* the band is ≈710px at 1440
   (board) and no row's height spread is above 60px (board 53).

### L6 · Research pages (L)
Files: `pages/research/NotesView.tsx`, `ResearchIndexPage.tsx`, `MarketsPage.tsx`, `ScorecardPage.tsx`,
`FilingsPage.tsx`, `ResearchTabs.tsx`, `publicUi.tsx`, `LiquiditySection.tsx`,
`libs/api/src/lib/demo/public-data.ts`.

1. **COL (high).** `NotesView.tsx:38` ResearchColumn takes `pageColumnSx` and keeps its pt/pb.
   *Acceptance:* /research content x80–1360 at 1440; cards 416 wide (board).
2. **R-02 (high).** Markets row 1 becomes a 7fr/5fr grid aligned to the start; row 2 follows NO-5 (B:
   2s10s full width, drift full width). Do the same in MarketsLoading. *Acceptance:* curve/decomposition
   737/527 at 1440 and 693/495 at 1280; no frame has an inner blank above 24px.
3. **R-03 (high).** Scorecard grids as above. *Acceptance:* list/By month 737/527 at 1440; By month at its
   natural ≈364px, no inner blank.
4. **R-05 (high).** One-line filing rows. *Acceptance:* row height 41px at 1440 (board).
5. **R-01 (high).** Note card anatomy. *Acceptance:* cards 302–323px tall at 1440; production page ≈2577px.
6. **R-07, R-08 (medium).** Filings 7fr/5fr split and header row; standing word on phones.
   *Acceptance:* feed/detail 737/527; EDGAR chip 24px tall under the lead.
7. **R-06 (medium).** Coming up as one panel list. *Acceptance:* rows `64px 1fr auto` at 13px; the phone
   list ≈330px.
8. **R-12 (medium).** Full-bleed Research tabs under the bar. *Acceptance:* nav at x0 y118, width 1440.
9. **R-09, R-10, FND-06a (medium).** Panel titles 14–15/600 Plex; production chips and the legend;
   `FrameDemoTagProvider value={false}` around ScorecardPage. *Acceptance:* each Scorecard demo frame
   shows 1 mark.
10. **R-19, R-20, R-21, R-18, R-26, FND-17 (low).** H1 700/−0.02em with clamp; strip figures 24px;
    "Sample note"; "Not investment advice" in the four page footnotes; amber "Open the filing" when it is
    the only action; demo descriptions; ruled Liquidity strip; solid grid at `MarketsPage.tsx:678`,
    `:1101`.
11. **NO-7 (if A).** Default the filing selection to the newest periodic filing.

### L7 · Note and ticker Research tab (M)
Files: `pages/research/NoteView.tsx`, `pages/research/NotePublicPanels.tsx`,
`pages/research/SecRecordSections.tsx`, `pages/ticker/research/ResearchView.tsx`.

1. **DESK-18 (low, after COL).** Tracks 220 / 530 / 450 with a 40px gap (staging), and 220 / 1fr / 450
   (production). *Acceptance:* rail/side at 220/450 at 1440.
2. **R-16 (medium).** Section h2 24px. Width comes from COL. *Acceptance:* public-record frames 1280 wide
   at 1440 on both builds.
3. **NO-4 (if A).** Move "Filed since this note" into the side column under "This note comes due".
4. **R-21 (low).** `NoteView.tsx:40` disclaimer text.
5. **FND-17 (low).** `NotePublicPanels.tsx:494` solid grid.

### L8 · Scanner (L; starts after the Scanner header workflow commits)
Files: `pages/scanner/Scanner.tsx`, `ScannerNotLive.tsx`, `ScanTable.tsx`, `ScanCells.tsx`, `labels.ts`,
`ScanToolbar.tsx`, `ScanCard.tsx`, `ViewEditorDialog.tsx`. Re-read line numbers on the new `HEAD` first.

1. **COL (high).** `Scanner.tsx:279` and `ScannerNotLive.tsx:263`. *Acceptance:* table 1280 wide at 1440,
   16px phone gutter.
2. **ACC-04 (high).** 8 data columns, right-aligned numerics, plain-text tiers, no single group row.
   *Acceptance:* column set and order match the board; rows 51px.
3. **ACC-05 (high).** Three-line phone cards. *Acceptance:* card 358×111; page ≈2077 at 390.
4. **ACC-07, ACC-08, ACC-17 (medium).** Toolbar spacer and chip order; note cards; coarse 44px.
   *Acceptance:* the density segment ends at the column edge; chips are 44px on a coarse pointer.
5. **ACC-10, ACC-15, ACC-20 (medium/low).** View editor 760 wide with two columns, a close button and a
   footer, and a bottom sheet on phones.
6. **ACC-23, ACC-24 (low).** Dashed filtered-out panel with a secondary button; skeleton radius 12.

### L9 · Positions page (L)
Files: `pages/positions/PositionsPage.tsx`, `features/trading/positions/PositionsPanel.tsx`,
`PositionRow.tsx`, `PositionsView.tsx`, `PositionCard.tsx`, `PortfolioPanel.tsx`,
`CustomizationToolbar.tsx`, `markFeed.tsx`, `features/trading/orders/OrdersPanel.tsx`,
`features/trading/outcomes/TrackRecordSection.tsx`, `ArchiveBlock.tsx`, `copy.ts`.

1. **COL (high).** `PositionsPage.tsx:217`. *Acceptance:* panels 1280 wide at 1440.
2. **SITE-04 (high).** Name/rename/delete view dialogs. *Acceptance:* 560×≈291 at 1440 with label,
   helpers, close and dividers.
3. **NO-6 A (high, waits).** Full-width 3-cell strip; book, then orders \| track record summary; the
   five-family Track record full width below. *Acceptance:* strip 1280×106 with 425px cells.
4. **ACC-09, ACC-16 (medium).** Contract wording, per-share entry and mark, right-aligned numerics, dashed
   frame head; Archivo h1. *Acceptance:* row reads "SPY 690 C · Oct 16", 3.00 and 2.47; rows 60px; h1 40px
   at 1440.
5. **ACC-17, ACC-24 (medium/low).** Coarse floors; radii 12 and 8.
6. **SITE-15 (medium).** Import dialog. *Acceptance:* 560 wide with callout, mono file line and dividers.

### L10 · Trading dialogs (M)
Files: `features/trading/tradeEntry/TradeEntryDialogView.tsx`, `LegFields.tsx`,
`features/trading/orders/OrderDetailDialog.tsx`, `OrderRow.tsx`, `features/trading/broker/reassess.tsx`.

1. **OVL cleanup (high, after L2).** Delete the per-dialog paper overrides (`TradeEntryDialogView.tsx:515-523`,
   `OrderDetailDialog.tsx:89-97`). *Acceptance:* both on the panel colour with radius 16.
2. **ACC-10 (medium).** Trade entry 760; order detail 560.
3. **ACC-11 (medium).** Market by default, a 4-column leg grid, the figure strip with cap check.
   *Acceptance:* the primary is enabled on open; three strip cells.
4. **ACC-12 (medium).** Neutral SIMULATED chip and Right segment.
5. **ACC-13 (medium).** Status row, 2×2 figures, a footer with Cancel order and Close, ET times.
   *Acceptance:* "Oct 7 2:30 PM ET" in a PDT browser.
6. **ACC-15 (medium).** Bottom sheet below 600px.
7. **DESK-17 (medium).** Reassessment dialog at 760 with the holding strip, label, explanation, footer
   and ×. *Acceptance:* ≈760 wide (board x340–1100).

### L11 · Settings, auth, personas, alerts (M)
Files: `features/auth/SettingsPage.tsx`, `RiskInputsSection.tsx`, `AiKeySection.tsx`, `RequireAuth.tsx`,
`AuthDialog.tsx`, `features/personas/components.tsx`, `libs/api/src/lib/demo/workspace.ts`,
`pages/alerts/AlertsPage.tsx`, `pages/alerts/NewAlertDialog.tsx`.

1. **COL (high).** `AlertsPage.tsx:464-466`. *Acceptance:* Alerts columns 737/527 at 1440 (board).
2. **SET (high).** Settings column. *Acceptance:* panels 760 wide at 1280, 1440 and 1920; risk fields
   ≥ 353px.
3. **ACC-16 (medium).** Settings h1 and wall titles in Archivo (40 at 1440; walls 28).
4. **OVL cleanup, ACC-10, ACC-15 (medium).** AuthDialog: drop its paper sx, 560 wide, sheet on phones.
5. **ACC-14 (medium).** Persona "Based on" shows the base preset; 760 two-column body; sentence-case
   segments. *Acceptance:* "Based on: Balanced Swinger".
6. **ACC-15 (medium).** NewAlertDialog imports the shared sheet; no visual change.
7. **ACC-22 (low).** Settings forms.

### L12 · Landing, methodology, trust pages, 404 (L)
Files: `pages/landing/Landing.tsx`, `AiReadSample.tsx`, `StructureFieldSample.tsx`,
`pages/methodology/MethodologyPage.tsx`, `WhatsLive.tsx`, `pages/trust/DocPage.tsx`,
`pages/not-found/NotFound.tsx`.

1. **COL (high).** Landing `:121`, `:210`, `:449`, `:528`; `DocPage.tsx:123`; `NotFound.tsx:75`.
   *Acceptance:* landing hero panel 601 at 1440 and 699 at 1920; staging CTA H2 on one line.
2. **SITE-02 (high).** Methodology on the doc layout. *Acceptance:* the numbers in the APP-DRIFT table.
3. **SITE-05, SITE-06, SITE-13, SITE-10 (medium).** Feature rows; verdict; doc tracks; 404.
   *Acceptance:* H2 on 2 lines at 1440; verdict Archivo 26/700 phosphor; rail 240 at x80 with the article
   at x368; 404 H1 52px at x80.
4. **NO-9 (if A).** Add the board's encoding subtitle to `StructureFieldSample.tsx`.

### L13 · Blog and operator (M)
Files: `pages/blog/BlogPostPage.tsx`, `BlogPage.tsx`, `Schematics.tsx`,
`pages/operator-metrics/operator-metrics.tsx`, `DemoOperatorUnavailable.tsx`,
`pages/operator-session-archive/OperatorSessionArchive.tsx`.

1. **COL (high).** `operator-metrics.tsx:411`, `OperatorSessionArchive.tsx:366`, `DemoOperatorUnavailable.tsx:18-19`.
2. **SITE-11, SITE-12 (medium).** Post measure 562, H1 46, steel body, panel callout; index H1 44 and card
   titles Archivo 28. *Acceptance:* post H1 on 2 lines at 1440.
3. **SITE-14 (medium).** Archivo H1s, full-width fields, neutral Unlock.

### L14 · Boards and canon (L; starts after the other workflow's design/ commits)
Files: `design/src/**` (build.mjs, lib.mjs, chart-kit.mjs, verify-tokens.mjs, components/charts.mjs,
data/alerts.mjs, data/states.mjs, screens/desk.mjs, screens/responsive-spec.mjs,
screens/v4/hybrid-desk.mjs, screens/v5/system.mjs, screens/final/*.mjs), `design/tokens/tokens.json`,
`.spire/clusters/tech/context/DESIGN_SYSTEM.md` (append only).

1. **DESK-04 (high).** Index button, superseded banner, and an Amendments row naming
   `final-desk-{staging,production,phone,light,states}.html` as the desk's rendered intent, superseding
   `:57`. *Acceptance:* the index's "Open the ticker desk" opens `final-desk-staging.html`.
2. **LIGHT (medium).** Site `-light` pages render light. *Acceptance:* `final-desk-light.html` opens with
   `data-scheme="light"` and an empty localStorage.
3. **Medium boards.** DESK-15, R-13 (with NO-5's layout), R-15, ACC-18, ACC-19, SITE-16, SITE-17.
4. **Low boards.**
   - Desk and research: DESK-20, DESK-21, DESK-24, DESK-28 (optional pin order); R-22, R-23, R-25, and
     R-28's seed values.
   - Account: ACC-26, ACC-27, ACC-28, and ACC-29 (with NO-14 B's colour in `chart-kit.mjs:31`).
   - Site: SITE-19 through SITE-26.
   - Foundations: FND-11, FND-12 (plus the light `text.secondary` pair in `verify-tokens.mjs`, after L2),
     FND-13, FND-18, FND-19, FND-20.
5. **Owner-gated boards.**
   - NO-1 B: `ticker-desk.mjs:34` stretch and full bodies.
   - NO-2 B: `lib.mjs:632` bar on `.wrap`.
   - NO-3 B: `hybrid-desk.mjs:17`, `:21`.
   - NO-4 A: `ticker-note.mjs:93-118`.
   - NO-6 A: `account-pages.mjs:137-141`.
   - NO-8 A: `planned-kit.mjs:155-158`.
   - NO-9 A: `shell-site-kit.mjs:226-231`.
   - NO-10 A: `lib.mjs:598`, `shell-site.mjs:44`.
   - NO-13 B: `v5/system.mjs:162-166`.
6. **Regenerate and check.** `node design/src/build.mjs` and `node design/src/verify-tokens.mjs`, both
   exit 0; NUL-byte scan of every edited file. *Acceptance:* each regenerated board's re-measured numbers
   equal the app's after its lane.

## Note: Scanner header, in progress elsewhere

`af9822f8` committed the Scanner header during this audit: title on the left, session and structure age
on the right, ages in days. A separate workflow owns it, and it is not audited here. The account audit's
build predates it (`f0fcc9ac`), so the header measurements in ACC-30 describe the superseded layout.

One cross-page point goes to that workflow as NO-12. `af9822f8` sets the Scanner h1 to 28px Archivo and
changes only the Scanner board (`design/src/screens/final/account-pages.mjs:14`). The Positions, Alerts
and Settings boards, and the shipped Alerts h1, use `clamp(30px, 3vw, 40px)`, which is 40px at 1440. L8
does not touch the header; it starts after that workflow commits.

## Limits

- The design lead did not re-render the screens. The measurements are the five family audits', and
  their JSON is under `tmp/fidelity/<family>/`. The column, grid, alignment, theme, token, build and canon
  citations listed under "What was compared" were re-read at `HEAD` `7ee6e4a1`, and four screenshots were
  looked at.
- None of the fix plan has been run. No acceptance check above has passed yet.
- 25 variants were not reachable signed out or without faults, and their fidelity is unknown: production
  signed-in Scanner and Positions, every operator page with data, the AI read states, and most error and
  loading states.
- `tmp/fidelity/` is scratch: gitignored (`.gitignore:5`), and gone on a clean.
