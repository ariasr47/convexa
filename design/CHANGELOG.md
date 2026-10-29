# Design changelog

Append-only. Supersede, never rewrite: a later entry can overrule an earlier one, but the earlier one stays.

## 2026-09-03

- **Direction chosen: A** — the ticker desk as masthead → structure field hero (field + level ladder +
  tape trail + structure path) → read strip → wide two-column AI brief beside tape / position / orders →
  quiet context band. B (sticky read rail) and C (focus mode) kept as low-fi alternates on the canvas.
- **Identity kept** — Curvature Terminal tokens, faces, arc budget, one orchestrated motion moment,
  honesty rules and the type register (mono = Convexa's figure, Sans = untraced).
- **AI read** — verdict-first brief; nine states designed; the verdict word is the panel's one amber spend;
  risk before rationale; composer collapses to one row; bottom sheet under 768px.
- **Figure cell replaces the accent-bar StatTile** — state in the label row and the register, never a
  coloured edge. Needs a canon amendment (StatTile.spec, type-floor.spec).
- **Liveness** — flash, pulse, field particles, tape trail, mid beam; all gated by a genuine stream; `live`
  tweak on the canvas. Needs a motion-inventory amendment (drift, trailMove, beam, shimmer, sheet).
- **Nav** — four product links, ⌘K command palette, session chip; Lab and Blog move to the footer.
- **Responsive** — one fluid body per screen; breakpoints 1600 / 1300 / 1100 / 1000 / 768; container
  queries inside panels (360 / 280); safe-area padding; scanner and positions tables become cards under
  1000; settings rail becomes tabs under 900.
- **Second pass fixes** — cadence copy unified (~60s desk, ~3-min scanner sweep); snapshot surfaces never
  wear a "live" chip; green/red reserved strictly for direction; scanner columns drop at 1300/1200 so the
  table never clips; scrim + mobile bar on the phone sheet.
- **Contrast + type floor** — `steel-2` raised to 5.2:1 on ink (dark) and `#61708A` (light); every chip
  and label at the 11px floor.
- **Completeness** — structure-path sparklines, Prime banner, closed-market / overnight / no-ticks / replay
  states, and the connection-chip vocabulary added.
- **Architecture** — `design/` restructured as tokens (JSON source of truth) + component modules with
  states and React specs + screen modules over sample data + a canvas registry with computed layout; the
  build emits the canvas, a static site with an interactive desk, the library page, tokens.css and
  tokens.json; `verify-tokens.mjs` checks the design against the app's tokens.ts.
- **Canon re-baseline** — `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is now SET — Curvature Terminal v2
  (owner ruling 2026-09-03; synthesizer + skeptic per the repo's design-canon method; skeptic PASS WITH
  FINDINGS, no Critical). This folder is the design source the canon points to; `tokens.ts` stays the
  runtime value authority and `tokens/tokens.json` is its verified mirror. `docs/design/DESIGN_SYSTEM.md`
  (the prior catalog) is pending an owner retire-or-stub ruling.
- **Rival authority ruled A** — `docs/design/DESIGN_SYSTEM.md` stubbed to a pointer (canon · `tokens.ts` ·
  `site/library.html`); the only rule it still quotes is the positions-legs `success`/`error` scope, which
  now also lives in the canon's Banned table.

## 2026-10-13 · v4 wave 1 — data states

- **The hybrid site gets a vocabulary.** Fourteen data states (live, delayed, stale, loading, empty,
  error, unavailable, not configured, off, paused, not live, sample, demo, locked) plus Computed and the
  genuine stream, each a word and a glyph (`components/data-states.mjs`, records in
  `data/states.mjs`). Not live means the paid options feed is missing; paused keeps its meaning.
- **Nine widget families in every state** (figure cell, chart, table, feed, AI read, positioning card,
  tape, form, dialog) render from data, in the library (full on the site, summarised on the canvas
  Library board) and on two State matrix boards (desktop, phone).
- **Source map** (`data/hybrid.mjs`): every widget on every screen with what it needs, source, delay,
  build status in docs/public-data/CANDIDATES.md's words, and its hybrid-site state.
- **Hybrid desk (NVDA):** public panels first, options panels second, with both honest options drawn:
  explain (off state) and a labelled sample (dashed, hatched, dated). Page legend "On this page".
- **Shared fixes to canon** (every v2 board regenerates): `nav()` has five links (rule 19);
  `.cell.offline` dims with `textDim`, not opacity (2026-09-09 amendment); tokens.json mirrors
  `textDim`, `textInfo`, `textUp`, `textDown` and `hatch` (= `hatchAlt`), checked by verify-tokens.
- Findings and canon proposals: `design/REVIEW-2026-10-13.md`. Supersedes nothing above; v2 boards stay.

## 2026-10-13 · v4 wave 2 — tools from public data

- **Source of truth:** docs/public-data/CANDIDATES.md and its status words (live · switch · build ·
  verify · blocked). The roadmap board lists every row with source, delay, status and what it unlocks.
- **Nine priority tools designed** with desktop, phone and all fourteen states: liquidity panel, macro
  calendar (events on Markets, review triggers on notes), FINRA weekly off-exchange volume (the free
  stand-in the desk's not-live blocks panel now points to), insider clusters, 13F holdings, note
  figures filled from XBRL, peer tables, technical analysis and the signal track record. The last two
  are blocked on a price source licensed for public display; their sheets draw the design target with
  illustrative values and the honest blocked state.
- **Built tools redrawn as v4 pages:** Markets (re-sourced to the U.S. Treasury; liquidity and calendar
  added), Filings (missing tickers shown; one primary action), Scorecard (signal track record as a
  blocked panel with a labelled sample), ticker research (six public positioning sources, XBRL check).
- No buy/sell language: every signal-like output is described as research.

## 2026-10-13 · v4 wave 3 — every route

- **Page “v4 · App”:** one row per route — desktop 1440 dark, phone 390, light 1440, and a states board —
  for the shell (nav, data notice, ⌘K jump-to, footer), landing, scanner, positions (with the signed-out
  wall), alerts, settings (with signed out), methodology, blog, lab, 404 and route fallback, the six
  overlays (sign in and the wall, trade entry, order detail, what's sent, persona, scan view editor) and
  the operator pages. The ticker desk adds a light board and a states board to wave 1's.
- **Hybrid decisions drawn on every route:** “Sign in” everywhere and Settings in the footer; the
  jump-to box lists tickers and notes by name because scores aren't live; the landing labels its hero a
  sample and lists what is live; the scanner explains first, samples on request and keeps the last real
  board as a dated archive; positions name each mark's basis; alerts gain release-date and new-filing
  kinds (proposal Q-5); trade entry opens on Manual price; what's sent says nothing leaves; methodology
  gains “What's live on this site”, the notice's link target.
- **Amber spent once per view:** selected tiles, filters, toggles and the current symbol use phosphor
  borders, checks and weight; the avatar is neutral.

## 2026-10-13 · v4 wave 4 — research refresh

- **Note view with neutral directions** (page “v4 · Research”): company deltas are text on a steel tint
  with ▲/▼; the case for and against reads by glyph and filled dot vs ring; thesis status by glyph, word
  and weight; bridge steps up filled, down outlined. Supersedes the research canvas's Main board, which
  this work does not touch.
- **Research index with the tabs**, phone boards for Markets, Filings, Scorecard and ticker research,
  light boards for every research page and the state matrix, and Markets in the demo build.

## 2026-10-13 · v4 wave 5 — coverage

- **Coverage matrix** (page “v4 · Coverage”): route × width × theme × states, each cell naming its board,
  checked against the registry at build time; 168 cells, 95 covered, 14 partial, 59 gaps (named), 0
  missing references. Adds the desk at 834 and phone-light, the note view at phone-light, Markets at 834.

## 2026-10-13 · v4 render fix (supersedes nothing; corrects waves 1–4)

- **Charts render their text at true size.** `fluidChart()` draws lines in a stretched SVG with
  non-scaling strokes and puts every label, tick and dot in HTML, so text stays 11px at any width;
  under 480px of container it swaps to short labels and drops minor ticks. The landing's gamma surface
  is drawn at three sizes and picked by container width. Matches the app's rule (useWidth.ts,
  Charts.tsx): chart text ≥ 10px, 11 preferred, drawn at the real width rather than scaled.
- **No horizontal overflow at any declared width** (Markets futures rows, the operator bar, the
  calendar's review-trigger chips).
- **Frame heights are measured**, not estimated, so no board clips its content.

## 2026-10-13 · v4 — TradingView's chart adopted (REVIEW Q-1 resolved by the owner)

- **The Technical tab shows TradingView's daily chart as TradingView's** (canon Amendments row
  “Third-party embeds”): “NVDA daily chart”, a dotted chip “Chart by TradingView · US prices delayed”,
  the frame with TradingView's own palette and attribution, the privacy note. Loading holds the final
  size with a 1px border; a blocked loader shows the shipped info alert; demo keeps the sample bars;
  the technical-rating gauge is not embedded. New route boards V4Technical (+390, light, states).
- **The split stays visible:** a chart by TradingView (live, display-only) beside readings Convexa would
  compute (blocked until Convexa has a feed licensed to it), on the desk and the TA tool sheet. The
  desk shows no close of its own. The signal track record stays blocked.
- **New state tag “Live · TradingView”** (dotted, like the third-party provenance chip). Supersedes the
  `[EOD PRICE SOURCE]` placeholders and the “blocked” Technical tab of waves 1–3.

## 2026-10-13 · v5 wave 0 — the canvas moves to files

- **New editable canvas, one file per board:** https://claude.ai/artifact/3ooV24ayHwh52t3qAhFiBe, made
  from the Design artifact type. Every v2 and v4 board and every note moves across unchanged in place,
  title and page; `canvas.config.mjs` `canvasIndexV3()` writes the type's v3 index and
  `src/emit-project.mjs` lays the built boards out as `project/*.dc.html` with publish batches.
- **Why:** the v2–v4 canvas (82be651e) is one self-contained page holding every board, 13.48 MB against a
  16 MB page limit. Measured: 5.78 MB of its 10.15 MB of board source is the same token stylesheet
  repeated per board, and escaping each `<` as `\u003c` costs 0.54 MB. A cheaper escape would not have
  lasted: the viewer's own Save re-escapes every `<`. On files, the limit is 16 MB per board.
- **Kept as history, untouched:** 82be651e (v16) and the research canvas HxZArSCsbrjQCx8VBbYRw7. The v4
  single-file viewer in `canvas/` is frozen.
- **Board files:** each now names itself (`<title>`), declares `lang="en"`, and marks its logic script
  `type="text/x-dc"` so the frame never runs it as a classic script. No board's markup changed.

## 2026-10-13 · v5 wave 1 — every chart, audited

- **82 entries audited** (52 app charts, 21 board-only marks, 9 planned tools) in
  `design/CHARTS-2026-10-13.md`: each with the question it answers, its form, findings cited to the
  review standard or the dataviz method, the upgrade, effort, risk and score. Board **V5Audit**.
- **Four charts draw something false:** the bridge cannot go below zero (5 of 19 shipped bridges break),
  the research index draws losses as 3px stubs, a missing opportunity score draws as 0, and a "5m" tape
  trail holds about 1.7 s. One root cause sits under the rest (SYS-01): no shared chart layer.

## 2026-10-13 · v5 wave 2 — one chart system

- **`src/chart-kit.mjs`** succeeds `fluidChart()`: frame, plot (bars, bands, gaps, events, crosshair,
  end labels with collision leaders), range bar, sparkline, small multiples, table twin, state bodies,
  pinned `Intl` formatters. Same construction (stretched SVG strokes, HTML text at true size).
- **`src/components/charts.mjs`**: fifteen primitives, each with its variants and the seven data states
  (loading at final size, empty, error with cause, stale, not live, sample, demo) and a React mapping to
  `apps/dashboard/src/app/shared/charts/`. They join the library as the "Charts" group (full on the site
  library; the Library board shows the frame and points to the v5 page).
- **Two proposed token roles** under `tokens.json → additions.proposed`: `chartContext2` (the older
  comparison line; dark #606E82 / light #7B899D) and `chartBand` (the uncertainty wash). The dataviz
  validator passes the neutral context ramp in both schemes; `verify-tokens.mjs` now checks each
  proposed role's contrast floor and fails if tokens.ts lands a different value (mutation-tested).
- **Rules drawn from the canon** (board V5ChartSystem): a claim needs data; neutral first, no
  categorical palette on the trader path; green/red only when money moves and never alone (the pair
  measures ΔE 4.3–4.7 under deuteranopia); amber only as the focus ring and the base diamond; the
  register holds; the frame's border is its provenance. Canon proposals P-8 to P-13 in CHARTS.
- **Boards:** V5ChartSystem (+light), V5ChartStates, V5ChartPhone (390), V5ThirdParty (ours vs
  TradingView's frame: eight deliberate differences).
- **Fixes found by measuring, on existing boards:** the TradingView illustration coloured its study
  labels as text (2.82–3.57:1; now steel with line keys) and hard-coded a dark-scheme fence colour; the
  ticker sub-tabs' current tab measured 1.76:1 (a generic link rule outranked it); light warning strips
  measured 4.25:1; the Library board was 5,900px tall against 13,350px of content (now measured).

## 2026-10-13 · Owner rulings on the v4 proposals (canon Amendments row of the same name)

- **P-1, P-2, P-3, P-4, P-6 approved**; the boards already drew them. **TradingView keeps its candles.**
- **P-5 rejected:** a ticker's price change stays green/red, as text through `textUp`/`textDown`, with ▲/▼.
  Reverted: the V4Scanner change column (table and cards) is directional again; the shared `.up`/`.down`
  text classes and the direction chips move from the fill hues to the text grades, which reaches the v2
  desk masthead, the landing mini tickers, the scanner and positions text. Sparklines keep the direction
  fill hues (they are marks). Supersedes the 2026-10-13 X-05 resolution; research company facts stay neutral.
- **Q-5 designed (alerts on public data):** six kinds — results approaching, new filing, insider cluster,
  positioning extreme, short interest change, note coming due — each naming its source and delay and
  wearing a P-2 word; SEC-backed kinds save but say "Not set up" until SEC_USER_AGENT (Q-4, the owner);
  structure kinds stay "Not live". The Alerts page with the P-1 "On this page" legend, the three-step
  create-alert dialog (bottom sheets on phones), and every state. Boards V5Alerts (+390, light),
  V5AlertsFlow (+390), V5AlertsStates. Q-2 is with the owner; Q-3 deferred.

## 2026-10-13 · v5 wave 3 — every chart family, before and after

- **Eleven family boards** (page "v5 · Chart families · before and after"): note figures, valuation,
  Markets, Scorecard and Filings, note panels, the ticker desk, the smaller charts, the planned tools and
  TradingView's framing, with phone and light variants. Each row pairs the shipped shape and its defects
  (file:line) with the upgrade on the chart system. Summary per family in CHARTS-2026-10-13.md.
- **Kit additions:** whiskers, floating bars with connectors (waterfalls that cross zero), dots and
  segments, a labelled bar list with open-ended and negative bars, the before/after row; event chips
  anchor inside the plot at its edges.
- **TradingView:** placement decided screen by screen (Technical tab and the desk's price panel only);
  loading words, a 12 s timeout, a per-symbol reset; proposal P-14 (load on request).
- **Measure tool:** outlined marks are read by their border, wash-filled ranges by their edge.

## 2026-10-13 · v5 wave 4 — the frontier

- **Three prototypes in design/site**, each drawn first as its designed fallback (what the canvas boards
  show): F1, the dealer-gamma surface in WebGL2 (no dependency, render on demand, orthographic, keyboard
  probe, a runtime pixel-ratio ladder, context-loss recovery, the static projection as its fallback);
  F2, a year of the Treasury curve by hand (scrubber, FOMC decisions on the track, the claim recomputed per
  day, Play that steps a month under reduced motion); F3, calibration you can question (interval, bin
  width, the calls behind a dot).
- **Budgets measured, not assumed**: frame intervals, script time, draw calls, buffer size, idle frames,
  context loss, Event Timing, gzip payload (CHARTS-2026-10-13.md, wave 4). F1 lands just over its frame
  budget on a software rasteriser after the ladder (p95 17.0 ms) and is reported so.
- **Canon proposals P-12 and P-15**; horizon charts, a step-through bridge and a price timeline
  considered and not built, with reasons.

## 2026-10-14 · Final · Convexa v1 — every screen in its ruled state

- **New first page "Final · Convexa v1"** (owner request): 19 rows, 128 boards. Each row opens with a spec card
  (purpose, every widget's data source, production vs staging, every state in its P-2 words, phone, acceptance,
  built so far, rulings, code), then staging (the demo account), production (no mocks; Massive-dependent panels
  Not live with "See it on the demo →"), phone, light, states. Rows: foundations; shell, landing, methodology,
  blog, Lab, 404, operator; ticker desk, Technical, research note; research index, Markets, Filings, Scorecard;
  scanner, positions, alerts, settings, dialogs. Source: `src/screens/final/`; brief: `FINAL-BRIEF.md`.
- Carries P-1–P-4, P-6, P-8–P-15 (v5 rulings 2026-10-14) and the 2026-10-14 environment rulings. The earlier
  pages stay as history; their demo boards now say "Signed in as the demo account" and the signed-out nav says
  "Log in" (shared `lib.mjs`), and light chart boards take the light chart roles (shared `chart-kit.mjs` fix).
- Checked: `tmp/final-render.mjs` on all 128 boards (no overflow, no text under 11px, exit 0 per group); build and
  verify-tokens exit 0; no NUL bytes. **Published** to https://claude.ai/artifact/3ooV24ayHwh52t3qAhFiBe as
  versions 8–10 (index + 315 boards). The canvas page itself was not opened in a browser.

## 2026-10-14 · Final · Convexa v1 — the missing screens (wave 2)

- **20 new rows, 107 boards** (page now 39 rows, 235 boards), each placed beside the screen it belongs to:
  Data sources and credits, Privacy, Terms and disclaimer (after 404; new routes, copy a draft for the owner);
  the AI read in depth (after the desk: analysis drawer, export drawer, phone peek and sheet, 14 states);
  the remaining overlays (after dialogs: broker reassess, track-record archive, expanded widget, name a view,
  browser notifications, password reset as dialog and page, phone sheets); all five Lab instruments (after the
  Lab index: Not live in production, Sample on staging); and a **Planned** section at the bottom under its own
  title with the nine public-data tools (designed, not built). Placement: `after:` / `section: 'planned'` in
  `src/screens/final/index.mjs`.
- Shared fixes: the footer carries Sources and credits, Privacy and Terms (`lib.mjs` `v4Footer`); on charts
  under 480px the probe readout wraps inside the plot and range bars take a second label row (`chart-kit.mjs`).
- Consistency fixes: SPY levels on the scanner, alert and export boards now match the desk (705.00 / 686.80 /
  672.50); the desk's level chips, levels line and implied-move labels, the note's catalysts and value-range
  labels, the landing hero's axis ticks, and two planned charts no longer collide on a phone; the Lab index cards
  carry the Sample tag and scenario date (P-3).
- Gaps found (on the spec cards' "Built so far"): the demo seed's SPY levels (704.02 / 683.92 / 652.22) and the
  Lab's synthetic field (walls 500/530) differ from the design; production draws the Lab's mocks; the demo AI read
  skips the read sheet; no password reset, invitation, account deletion or trust routes exist; the API reports a
  fallback copy as live.
- Checked: `tmp/final-render.mjs` on all 235 boards (exit 0 per group; no overflow, no text under 11px) and a
  label-collision scan (none left); build and verify-tokens exit 0; no NUL bytes.
- **Published** to https://claude.ai/artifact/3ooV24ayHwh52t3qAhFiBe as versions 11–12 (index + 332 changed boards;
  the older pages changed through the shared footer and chart kit). The canvas page itself was not opened in a browser.

## 2026-10-25 · The canvas, organized: current design only, one page per product area

- **Owner ask:** organize "Convexa Desk Redesign", make things easy to find, remove what is stale and what has
  been ruled on. The canvas (https://claude.ai/artifact/3ooV24ayHwh52t3qAhFiBe) is now titled "Convexa Desk
  Redesign" and holds **206 boards on 8 pages**: Start here (the board map as the entry board `Main`, and the
  screen tracker), Ticker desk, Research, Scanner & account, Dialogs & overlays, Site & shell, Foundations (the
  four foundation boards and the three library boards) and Planned · not built (the nine tools, and the two v5
  frontier prototypes the owner has not ruled on: F2, a year of the curve, and F3, calibration you can
  question; F1 shipped as the landing hero). Each row carries a title with
  its route; Start here carries a guide note naming every page.
- **Off the canvas (182 boards, 7 pages):** the v2 pages (Ticker desk with Directions B and C, Responsive, Site,
  Dialogs & gates, the light desk and landing, the components sheet), v4 · Data states, Tools, App, Research and
  Coverage, v5 · Charts, Families and the Frontier overview, F1 and F2's phone board, and "Ruled · Alerts on
  public data (Q-5)". Every one is superseded by a final row or the library, or was ruled on;
  the record is git (`af9822f8:design/canvas/`) and this file. Their screen modules
  still build the static site; the v4 coverage sheet now checks its board names against the v4 canvas as it
  stood, not the live registry.
- **Ruled items off the boards:** the screen tracker shows only open questions and open issues; the 20 answered
  questions and the closed issues stay in `tracker-data.mjs` as the record. Two stale items fixed: ⌘K company
  names was still "Waiting on you" though the owner ruled "none" on 2026-10-16 (now Left out on purpose,
  Q-PALETTE-NAMES); the staging footer's GitHub link (spec 01 Q3) waited on the owner with no question on the
  tracker (now Q-GITHUB-HREF). Open questions: Q-FINRA-TERMS, Q-HOOD-NI, Q-GITHUB-HREF.
- The old single-page canvas (82be651e, "Convexa Desk Redesign", frozen at v4) now points to this one; its last
  full version is `canvas/convexa-desk-redesign.html`.

## 2026-10-25 · Fidelity audit, lane L14: the boards follow the shipped app

- **Source:** `docs/design/fidelity-2026-10-25/AUDIT.md` (BOARD-STALE rows and the owner's 14 answers, all as
  recommended). Every edit is in `design/src`; `design/canvas` and `design/site` are regenerated. 207 artboards
  (one added: the credits phone page in two boards), 308 site pages.
- **DESK-04:** the index's "Open the ticker desk" opens `final-desk-staging.html`; `desk.html` carries a
  "Superseded by Final · Ticker desk (2026-10-16)" banner. DESIGN_SYSTEM.md Amendments row of 2026-10-25.
- **LIGHT:** a site page renders in its artboard's scheme and declares it on `<html>`; a light board opens light
  with empty storage and ignores a stored dark choice (all 20 `-light` pages measured light).
- **Medium boards:** the staging note draws its side panels and the "Public record · NVDA" band (DESK-15); Markets
  has its On this page rail and four sections, with 2s10s and note-rate drift on full-width rows (R-13, NO-5 B);
  the Notes index draws the five sample triggers, the Next lines and the seed's last ten changes (R-15); Alerts
  staging has the seed's seven rules (ACC-18) and no board names a server schedule (ACC-19); Credits has eleven
  cards (SITE-16); the production bar drops "short data" (SITE-17).
- **Owner answers drawn:** the demo bar on the page column (NO-2 B), ticker tabs as an underline (NO-3 B), the
  production note's shipped anatomy with "Filed since this note" in the side column (NO-4 A), Positions' five
  family cards under orders and the track record (NO-6 A), the planned signal track record as the Scorecard's
  half-width card (NO-8 A), the landing's shipped field (NO-9 A), one 41px phone bar line (NO-10 A), the Scanner
  title at `clamp(30px, 3vw, 40px)` (NO-12 A), chart interaction states marked not adopted (NO-13 B), and an
  8px top hatch band in steel at 28% on every sample frame (NO-14 B, ACC-29).
- **Low boards:** AiReadNotLive and "Live · TradingView" (DESK-20, FND-18); the expand overlay reuses the desk's
  term chart (DESK-21); the read strip's score ring and 106px cells (DESK-24); demo pins first (DESK-28); one
  sample mark per planned section (R-22); research tabs and rails keep their colours (R-23); the liquidity
  chart's three shape lanes (R-25); NVDA sample bars from the seed (R-28); one mark on the scan head (ACC-26);
  the signed change after its arrow (ACC-27); a cluster is Computed (ACC-28); the canon's 44–56px landing title
  and the hero curve (SITE-19); two blog posts (SITE-20); the privacy key, contact and date (SITE-21); the five
  site cards record the fidelity round (SITE-22); "A–Z" (SITE-23); a solid demo-bar divider (SITE-24); the
  drawer's "See the full demo ↗" (SITE-25); no "None stored" (SITE-26); loading names the metric and carries no
  Loading or Nothing yet tag (FND-11); the chart system lists what exists and verify-tokens checks chartContext2,
  chartBand and both `text.secondary` pairs as mirrors (FND-12); state word, then detail (FND-13);
  "Sample · not recorded market history" (FND-19); no clock or bell in the responsive spec (FND-20).
- **Phone boards and the 8,000px frame:** the production note and Markets phone boards stop where their Planned
  rows' phone boards take over, each with a board note saying so; the credits phone page is two boards.
- **Heights:** re-measured from the built boards (natural height + 20); 106 changed, none overflows, none above
  8,000, no text under 11px. Checked: `node design/src/build.mjs` 0, `node design/src/verify-tokens.mjs` 0 (and
  1 against a copy of tokens.ts whose light `text.secondary` is MUI grey). Not published to the canvas artifact.

## 2026-10-25 · Fidelity audit, lane L14 fix-up: four review defects

Supersedes nothing above; repairs four regressions two read-only reviewers found in the L14 boards (d7155752).

- **Credits demo chip wraps (L14-REV-1):** the source card's "Demo · shaped like …" chip wraps as the app's does
  (4px 10px, 12px radius, 11px at 1.35). At 390 `final-credits-staging` is 390px wide again (was 435); the New
  York Fed chip is 324×40 on two lines (app 324×40), and 385×25 on one line at 1280 and 1920 (app 385×25).
- **Landing field labels on plates, in lanes (L14-REV-2):** put wall, flip and call wall each sit on an ink
  knock-out plate (88%, 3px radius, 14px, 600 11px mono), 9px right of the line, in 16px lanes from the plot top:
  put first, flip second, call first while the chart box is wider than 400px, else third and kept inside the
  plot's right edge, as the shipped lane solver places them. 0 label overlaps on the five landing boards at 390,
  768, 1280, 1440 and 1920 (was 15×11px at 390); a level line shows through a label in 0 of 14 rows (was 8–14,
  e.g. the flip through the put-wall label at 1440, 9 of 14). `plot()` gains an `extra` slot for a chart's own
  labels.
- **State-card heads wrap (L14-REV-3):** a tag too long to share the line drops to its own line and the title is
  never ellipsized. Title cuts on the Final state matrix, the library and the v4 matrices: 0 at 390, 1280 and
  1920 (pre-fix-up 9, 5 on the v4 phone matrix; pre-lane 2). The Final and v4 matrices keep their fixed cells and
  no card there newly outgrows its height (the v4 phone matrix's 22 bottom-sheet cards already did before the
  lane; two of them, whose tag now sits under the title, grew 22px). The v4 tool sheets' state cards now grow with their content (at least
  236px, a row's cards sharing its height): 0 of their 126 cards outgrow their frame (was 21, e.g. "Fund
  holdings (13F)" whose foot sat over its last row).
- **v4 note view tab row wraps (L14-REV-4):** "All research" takes its own line under ~440px; at 390 the page is
  390px wide again (was 416), tabs 16–312, "All research" 16–119 on one line.
- **Heights:** FCreditsStaging 6576 → 6584, FCreditsStates 2034 → 2035 (202 boards measured, 2 changed, none
  overflows; a second measurement changes 0). Checked: `node design/src/build.mjs` 0, `node
  design/src/verify-tokens.mjs` 0. Not published to the canvas artifact.

## 2026-10-25 · Fidelity round 2, lane R2-C: the boards and canon follow what round 2 shipped

Supersedes nothing above. Round 2's app lanes (`51b0ae57`..`e17906b4`) moved the app to the boards, and in six
places the board was the one behind. Each item was measured on the board and on HEAD's demo and live builds (live
`/api` faked) before and after; evidence in `tmp/fidelity/r2/R2-C-boards-canon/`.

- **⌘K selected row in light (SITE-03b):** light raised-2 under steel measured 4.20:1; the row now takes the panel
  in light (5.42:1, the app's white row since `46972f63`) and keeps raised-2 in dark (4.74:1, as the app). Set as a
  per-scheme `--pal-sel` in `v4/shell-landing.mjs`, so the Final and v4 palettes both follow.
- **⌘K Go to order (NO-11 A):** no change. Both palette boards already listed Scanner, Ticker, Research,
  Positions, Alerts, which the app ships since `51b0ae57`.
- **Export drawer (ACC-10, ACC-21):** `final-ai-read-export` is redrawn to the shipped `StateExportDrawer`
  (`a1ce2b3d`, `aa2a48b5`). It was 420 wide, with a tinted banner, an amber Copy all at the top and unframed
  sections. Now it is 520 wide (the full width under 600px), the egress line is its lead sentence, and each section
  is a dashed sample card with the top hatch band. COPY sits only on the three built sections, and the snapshot is
  the demo's own JSON in the bordered 220px scroll well. Copy all is an outlined footer action with its note. Head,
  lead, wells and all six cards measure equal to the app at 1440 and 390, coarse COPY targets included; Copy all
  is 102 wide against the app's 100, as on the what's-sent board. The board is 1220 tall, so every card shows.
- **404 and operator boards on the page column:** at 1600px and wider they started at x320 at 1920 (the
  `.wrap`'s 1360 centring); a `.wrap.ss-col-start` now follows the column's 1560 step. The h1 is at x220 at 1920,
  equal to the app, and unchanged at 1440, 1280 and 390.
- **Landing hero curve:** the curve's box ends 28px above the hero's foot, as the app's since `e17906b4`. Path
  samples striking the CTA footnote dropped to 0 at 1280, 1440 and 1920. Production went from 186, 158 and 118,
  staging from 521, 106 and 0. The baseline is 28px above the hero foot on every board, as in the app.
- **Staging footer (S1-Q3):** the author line ends "· GitHub ↗" to https://github.com/ariasr47/convexa, in a new
  tab with `rel="noopener noreferrer"`, and coarse 44px targets, as the app since `1ded978b`. Q-GITHUB-HREF is
  answered in `tracker-data.mjs`, and the shell card's item is shipped. The card also records the round's other
  shell commits.
- **Still-different items resolved in the app:**
  - The credits SEC card puts "Filed since this note" in the side column of each ticker's newest note (`9de328f8`).
  - Light tint chips take text-grade labels, as `TintChip` since `eb07b0f5`. Neutral and warn use phosphor and
    live uses text-info, through per-scheme variables. On `library.html` the lowest of those three labels went from
    4.12:1 to 6.03:1. Emph stays amber-text at 3.96:1 on the library's raised surface, unchanged, as the app's
    emphasis rule.
- **Already equal, no change:** the production note's tab row (sentence case, 13/500, 600 current, 44 tall in both),
  the demo bar on the page column (glyph x38.4/80/220/16 under the wordmark in both).
- **Canon:** `DESIGN_SYSTEM.md` Amendments rows for NO-2 B (supersedes spec 01's 1240 bar column; shipped in
  `1e30ff95`) and NO-11 A (supersedes rule 19's "Research last"; shipped in `51b0ae57`).
- **Heights:** 7 changed (FShellSpec 3415 → 3651, FLandingSpec 2936 → 3025, FAiReadSpec 2916 → 3068,
  FAiReadExport 1040 → 1240, FProgressMap 3643 → 3621, FProgressTracker 4588 → 4461, FCreditsPhone2 4669 → 4690),
  202 measured, none overflows; a second measurement changes 0. The overflow and small-text sweep of every changed
  board page at 390, 1440 and 1920 equals HEAD's. Those are 135 checks, and the 13 flags are already at HEAD: the
  760-wide spec cards at 390, `components-sheet`, and the library's 19 small labels. Checked: `node
  design/src/build.mjs` 0, `node design/src/verify-tokens.mjs` 0. Not published to the canvas artifact.

## 2026-10-25 · Fidelity round 3, lane R3-B: the boards follow the owner's answers after round 2 and what round 3 shipped

Supersedes the round 2 entry's "Emph stays amber-text at 3.96:1 on the library's raised surface"; nothing above is
edited. Each item was measured on the regenerated boards against HEAD `18379b60`'s demo and live builds (live
`/api` faked); evidence in `tmp/fidelity/r3/R3-B-boards-canon/`.

- **Footer seam (owner: keep the arc; the boards follow the app):** every Final board's footer now opens with the
  canon's 20px arc divider, the app's `ArcDivider` path (`M 0 17 Q 600 9 1200 17` in a 1200×20 box, 1px `line`
  stroke, non-scaling), in place of the v4 1px border-top (`lib.mjs` `FINAL_ARC_SEAM`, `withFinalFooter`,
  `finalFooter`). Production boards built on `finalPage` also gain the copyright line the app draws in both builds
  (they had none, so their footer was 125 tall at 1440 against the app's 170), the disclaimer's **simulated** is
  bold as in `DisclaimerCopy`, and the footer links take 44px under a coarse pointer (canon rule 7). Footer height,
  board and app equal on 7 boards and 4 app pages: staging 196 / 196 / 164 / 386 and production 170 / 170 / 138 /
  334 at 1440 / 1280 / 1920 / 390 (coarse). It was 177 / 151 / 125 at 1440. The shell states board's two footer
  cards use the same footer. The v4 boards keep the border they were drawn with.
- **Trade entry (owner: Manual default, the cap check outside the dialog, ACC-11 not adopted):**
  `final-dialogs-trade-entry` and the phone sheet are redrawn to the shipped dialog as it opens on the demo desk:
  Manual price selected, Market and Limit beside it; the leg on one row of four (two by two under 600px); Quantity
  and Manual price, then Stop and Target; "Enter a price — opens at exactly the price you type." with its
  user-entered price chip; a Net debit / Max loss / Cap per trade strip (`—`, `—`, `$500`) with no verdict; the
  cap's source line; the confirm disabled. Board 760×574.1 against the app's 760×573.9 at 1440 (was 760×540.9 with
  Market, a sample-mid field and "Cap check: within $500"); the price line, strip and cap line sit within 0.2px of
  the app's offsets, and within 1.9px at 390. The field labels draw in steel (6.19:1 dark, 5.42:1 light): the app's
  `FieldLabel` uses `text.disabled`, 2.52:1, so the board does not copy that. The states board follows: the
  not-live fill control in the app's order; "over the cap" becomes the strip with max loss beside the cap and no
  verdict, plus the read's own pinned cap check (`CapAnnotation`) as received; "cap not set" takes the app's words.
  The Overlays spec card records the shipped dialog and marks ACC-11's Market default and "within" verdict
  "Designed, not built · Left out on purpose". The state matrix's not-set dialog cell says "Cap per trade".
- **Tracker:** `Q-GITHUB-HREF`'s `why` no longer says the footer ships without the link; it records that the link
  shipped in `1ded978b`. The entry stays.
- **Chips at AA in both schemes:** light `chip.emph` measured 3.96:1 because the palette drawings on the library
  and components sheet put it on light raised-2. Their selected row now takes `--pal-sel`, which is the panel in
  light (the app's row, SITE-03b), so the chip measures 4.65:1 or more. `--pal-sel` moved from
  `v4/shell-landing.mjs` to `lib.mjs`, so every palette board shares one definition: raised-2 in dark, white in
  light on all six palette boards. Dark `chip.live` follows the app's dark info TintChip (`cac55258`): text-info,
  6.30–7.07:1 (was signal, 4.01). Library and components sheet: 0 chips under 4.5:1 in either scheme (were 6 and 4).
- **Round 3's app changes, checked on the boards:** R3-A's harness, re-pointed at these boards, finds them equal
  to the app on unselected tabs (13/500, current 600), "Full demo ↗" (89.08 wide, 10px sides; search box at 823.83
  / 942.22 / 1282.22), the landing H1's breaks at 1280, 1440, 1920 and 390, and "Copy all" (102.06×36, glyph 16).
  The production desk h1 is within 1.2px. The note's "Filed since this note" head (14/600) and the comes-due rows
  (31 tall, hairline rules) are equal. The desk Structure label sits 2.9–5.2px below the board's at 390, 768,
  1024, 1280, 1440 and 1920. R3-A found that offset on the app side, not a stale board, so no board change. The
  Copy all glyphs now ask for 16, the size the `.ico` rule already drew. The spec cards (shell, landing, operator,
  AI read, desk, note, foundations) each gain a round 3 entry with its commits.
- **Canon:** no Amendments row. No ruling this round changes `DESIGN_SYSTEM.md`: the arc seam is already one of
  the arc's three spends, info as text already binds `textInfo` (the 2026-09-09 row), and ACC-11 was never canon.
- **Heights:** 113 boards changed. +19 on 52: every staging board with a footer, the site-page production boards
  that already drew the copyright, and the tracker, whose list gains the ACC-11 row. +45 on the 50 production boards
  that gain both the seam and the copyright. The dialogs spec +409, its states +124, the phone sheets −14, seven
  other spec cards +48 to +173, the shell states +38. 202 measured, none overflows, and a second measurement
  changes 0. Measured with the app's bundled fonts; HEAD's sources measure equal to HEAD's heights.json that way.
  The overflow and small-text sweep (208 pages × 390 / 1440 / 1920) equals HEAD's cell for cell. Its 51 flags all
  predate this round: the 760-wide spec cards at 390, the 3220-wide state matrix, `components-sheet` at 1440, and
  the library's 19 small labels. Checked: `node design/src/build.mjs` 0, `node design/src/verify-tokens.mjs` 0,
  NUL bytes 0 in all changed files. Not published to the canvas artifact.
- **Left as found:** the September trade-entry page (`dialogs.mjs`) and the components sheet's mini dialog still
  draw a "within" cap line; they are v2 history that the Final boards supersede. The production boards draw the
  not-live bar's sentence from 768 to 899px. The live build drops it under 900, so the bar is 103 tall on the board
  against 41 in the app at 768. Another lane is editing `MarketDataNotice.tsx` this round, so the board waits.
  The note's "This note comes due" eyebrow measures 11/600 on the board and 11/400 in the app, at 1440 and 390;
  no lane was asked to change it.

## 2026-10-25 · Fidelity round 3, lane R3-B fix-up: trade-entry toggles at 44 under 600px

Supersedes nothing above; repairs one regression a review found in the R3-B boards (ddda3850).

- **Toggle buttons fill their row (R3-B-REV-1):** the trade-entry toggles drew their 1px outline as a border on
  the group, so each button box was 42 tall inside a 44 row under 600px (the canon's coarse floor is 44; the app's
  ToggleButtons and the board before this round were 44). The group's outline is now an inset shadow (`.te-tg`, no
  border), and the buttons take the full row: 38.8 at desktop, 44 under 600px. At 390 under a coarse pointer the
  fill toggle (Manual price, Market, Limit) is 117.3×44 and Call / Put 85.5×44 on `final-dialogs-trade-entry` and
  `final-dialogs-phone` (were 116.7×42 and 84.5×42; app 118×44 and 86×44), and 108×44 on `final-dialogs-states`
  (was 107.3×42). Sub-44 targets across the 246 board pages the round changed: 1867 → 1854, and 0 boards gain any
  against the boards before the round. The visible groups stay 38.8 and 44 tall; every other element in the three
  boards keeps its box to 0.05px at 390, 768 and 1440.
- **Heights:** 202 boards measured, 0 changed, none overflows; `heights.json` is unchanged. Checked:
  `node design/src/build.mjs` 0 (a second run is byte-identical), `node design/src/verify-tokens.mjs` 0, NUL
  bytes 0 in all changed files. Not published to the canvas artifact.

## 2026-10-26 · Fidelity round 4, lane R4-D: the boards follow rounds 3 and 4 and the owner's spec 02 answers

Supersedes nothing above except where it names the line it replaces. Measured against local builds of `7eeb7150`
(demo :4840, live :4841) and the boards (:4842), with the app's bundled fonts; scripts and shots in
`tmp/fidelity/r4/R4-D-boards-canon/`.

- **Call and Put keep their fills, with ink labels (owner S2-Q1; app `31b0011a`).** The trade-entry boards
  (`final-dialogs-trade-entry`, `-phone`, and every sheet built from `tradeEntryDemo`) drew a selected Call as phosphor
  at 16%, from ACC-12 (R3-B). They now fill a selected Call with `--up` and a selected Put with `--down`, with the app's
  ink `#0B0F17` label, white on light Put. Board = app at 1440 and 390, both schemes: 9.13 / 6.34:1 dark, 5.56 / 4.74:1
  light, and unselected 6.19 dark / 5.42 light. The fill toggle's neutral selected tint is 8% in light, as MUI's
  `action.selected` (rgb(236,237,238), 14.05:1; it drew 16%). The field labels were already `text.secondary`'s steel
  (6.19 / 5.42:1, `FieldLabel.tsx` since `673dd755`), so only their comment changes. The SIMULATED tag gains the app's
  0.04em tracking: 83.1 wide, as the app (was 79.1).
- **The walls' demo button (spec 02 (b); app `96bf67c8`).** `scannerWall` and `positionsWall` draw "See it on the demo
  →" as a neutral outlined 44px button, second in the row (Sign in, the demo, Open a ticker desk), and the closing
  sentence keeps its words without the link. Every wall button is 44px at every width (36 at desktop before); Open a
  ticker desk opens `/ticker`, as shipped. Board = app in order, height and colours at 1440 and 390 on both walls. The
  wall still sits 28px lower at 1440 and the Sign in button is 2px wider (a transparent border); both predate this round.
- **Light pills, the jump row and the SIMULATED tag (spec 02 (c); app `673dd755`).**
  - The board's quiet tag (`.stag.k-quiet`) and delta pill (`.pillN`) took dark steel at 16% in both schemes. They now
    take `--steel` at 16%, the app's `alpha(text.secondary, 0.16)`. Their labels were already phosphor. On the light
    note the research pills measure 12.37:1, as the app. Dark is unchanged.
  - **Below 900px the production note's rail becomes the app's jump row** (`NoteView.tsx` `PartChips`). The board had
    squeezed the desktop rail into a 228px block beside "On this page". The row is 32px part pills, 44px links under a
    coarse pointer, with the bar's padding at 4px. Current part filled `text.primary`; the rest on a 16% steel tint, steel
    in dark and `text.primary` in light. A 3px progress line runs under it. Board = app at 390: pills at x16 / 89.1 / 172
    at 67.1 / 76.9 / 66 wide, 32 tall; 5.42:1 dark, 12.37:1 light; the Part 1 rule 102px below the pills in both.
  - **The staging note's section strip** (`ResearchView.tsx` `SampleRail` strip) replaces the boxed rail below 900px:
    44px pills on a 10% steel tint under the head, `text.primary` in light, the current one on MUI's `action.selected`.
    Board = app: 63 / 76.9 / 55 wide, 44 tall; 9.62 and 5.98:1 dark.
  - **Positions' Simulated orders panel** shows the trade dialog's neutral SIMULATED tag beside its title, as the app.
    The board's "Sample tape" mark stays at the right (D1), so at 390 it takes a second line.
  - The quiet context-band card's 0.96 opacity was never on the boards; nothing to remove.
- **Insider trades (owner S2-Q2, S2-Q3; app `907cf98e`).** The plot is one image (`role="img"`, its summary as the
  label, no tab stop; it was a focusable `role="group"`). "Show the numbers" holds the windows table, then "NVDA Form 4
  trades by trade date", one row per trade, through `chart-kit.mjs` `dataTables`. On production the last column links
  each row to its Form 4 ("Form 4 ↗", named by the trade's sentence), and the demo has no Filing column. Link cells are
  24px, 44 under a coarse pointer (52.9×24 and 52.9×44 here; the app's are 50 wide). Shares and prices are plausible
  figures drawn for the design. The spec card's acceptance line and a new built entry say the same.
- **The production bar as shipped (`MarketDataNotice.tsx`, spec 02 step 3).** Its two links are 24px, 44px under a
  coarse pointer, and the bar drops its 8px padding there. The sentence shows from 900px and the demo link from 600px
  (both were `only-wide`, 768px). The links sit 16px apart. The production desk h1 now equals the app: 118 at 390
  coarse (was 114), 122 at 768 (was 184), 114 at 600. This closes round 3's "Still different" item 5. "What's live" and
  "See the full demo →" sit at the app's x at 768 and 1440.
- **Text at AA on every Final board.** axe `color-contrast` over 204 Final pages at 1440 and 390 went from 40 nodes to 0:
  - the filings kind pills: the current "All · 9" drew `text-info` on phosphor (1.76:1). The link rule's exclusions now
    take `:where(.rs-chipbar a, .tn-strip a)`, which adds no specificity, so the pills draw their own ink and steel
    (15.10 / 6.78:1 dark, 15.18 / 5.00:1 light, as the app);
  - the desk's not-live AI read outline lost its 0.9 opacity: light labels 3.88 → 4.78:1, and `AiReadNotLive.tsx` draws
    no opacity;
  - the stale read on the AI read states board lost its 0.75 opacity (4.05–4.28 → 6.19:1). The app does not dim a stale
    read, and text is never dimmed by opacity (the 2026-09-09 row);
  - the cooldown button carries `aria-disabled`.
- **Canon:** one Amendments row (2026-10-26): rule 7's coarse mechanics, `text.disabled` for a disabled control only,
  steel labels on a steel tint in light, and S2-Q1 closed.
- **Spec cards:** Overlays, Scanner, Positions and Planned · Insider clusters each gain a built entry with its commit.
  The scanner and positions wall descriptions and states say "button".
- **Heights:** 11 boards changed, 202 measured, 0 overflow; a second measurement changes 0.
  - FNotePhone −139 (the jump row replaces the rail);
  - FScannerPhone and FPositionsPhone +49 (the third button);
  - FScannerStates and FPositionsStates +3;
  - FPositionsStagingPhone +30;
  - FAiReadStates +19 (a longer "when");
  - FScannerSpec, FPositionsSpec and FDialogsSpec +111, and FPlannedClustersSpec +173 (the new entries).
  - HEAD's sources measure equal to HEAD's `heights.json`.
- **Other sweeps against HEAD's boards:**
  - overflow and small text equal HEAD's cell for cell on 208 pages at 390, 1440 and 1920 (51 flags, all older);
  - sub-44 tap targets at 390 coarse on 204 Final pages: 1372 → 1284, and no page gains one.
- **Checked:**
  - `node design/src/build.mjs` 0, and a second run is byte-identical;
  - `node design/src/verify-tokens.mjs` 0;
  - NUL bytes 0 in all 450 changed files.
- **Not published** to the canvas artifact.
- **Left as found:**
  - The production note board's figure strip and the positions page's toolbar still draw an older anatomy than the app.
  - The filings pills are 32 tall against the app's 36.
  - The app's wall paragraphs measure `text.primary` (rgb(233,228,214)) though `RequireAuth.tsx` asks for
    `text.secondary`; the boards keep steel. That is an app question, not a board change.

## 2026-10-28 · Spec 08, step 0: the trade journal's boards (43 boards, 8 spec cards)

- **Eight rows on Planned · not built**, after the nine public-data tools and before the two prototypes, in BOARD
  BRIEF order (`docs/product/specs/2026-10-26/08-trade-journal.md`; `src/screens/final/journal.mjs`):
  - Journal · Timeline, 7 boards: staging, production signed out, first run, illustrative, phone, light, states;
  - Journal · New entry, 7: a normal day, margin-call mode, plan a trade, phone margin call, phone plan a trade,
    light, states;
  - Journal · Entry, 5: the Sep 29 call, a recalled entry, phone, light, states;
  - Journal · Weekly review, 6: the Oct 7 review, production AI off, production mostly from memory, phone, light,
    states;
  - Journal · Rulebook, 5: the rulebook, rule R2, phone, light, states;
  - Journal · Tidy up and import, 4: Tidy, Import, phone, states;
  - Journal · Drawers and sheets, 6: the finding drawer, What's sent, Edit positions, the account path, phone
    bottom sheets, states;
  - Journal · Settings panel, 3: staging, phone (production), states.
  Each row opens with its spec card (route, job, widgets and their sources, states, phone, acceptance by criterion,
  built so far by slice, rulings, code). The board map and the screen tracker gain the eight rows.
- **The kit and the sample.** `src/screens/final/journal-kit.mjs` is the rows' shared kit: the Positions host page,
  frames, tags, walls, entry cards, figures, controls, drawers, dialogs, sheets and the account path.
  `src/data/journal-sample.mjs` is the spec's fictional Sample journal (the Oct 7, 2026 scenario), every figure
  computed from typed inputs in integer cents and rounded half away from zero for display;
  `tmp/journal-boards/check-sample.mjs` asserts the figures the spec prints (352 checks). No board carries the
  owner's own data or his request's words.
- **Marking (P-2, P-3, P-4, D1).** Staging frames are dashed with the 8px steel hatch band and one "Sample journal"
  chip. Production boards drawn on the sample trader's figures have solid frames and the board note "Figures
  illustrative; production shows only the owner's entries"; the walls and the first run draw no sample. Words the
  spec doesn't print (most entry bodies, the Sep 29 digest, Tidy's 14 details, the import paste) are left out with a
  board note or composed only from that entry's printed words and the sample's figures, and each spec card's
  staging line says which. Figures are IBM Plex Mono; signed money takes `textUp`/`textDown` with its sign (Design →
  Palette roles, criterion 9); counts are neutral steel dots or text; "above" carries the warning glyph and "within"
  is plain. Units are px.
- **Canon events drawn (Amendments, 2026-10-28):**
  - the pen glyph `edit`, on the 24 grid in `lib.mjs`'s icon table. The journal's amber "Write entry" carries it,
    and the boards that already called `icon('edit')` for the user-entered mark tag (`final/account-pages.mjs:185`,
    `v4/app-pages.mjs:81` and `:90`) now draw it where they drew an empty SVG (FPositionsStates and the v4
    positions pages; no height changes);
  - Positions' section tabs, Book · Journal · Review · Rulebook, on every journal page: the current tab underlined
    in text colour, a sideways rail on a phone;
  - one amber primary per tab: Write entry on Journal, Run or "Save this week's review" on Review, Plan a trade on
    Rulebook; on a phone the bottom bar follows its tab (amber Write entry, outlined on Review, amber Plan a trade)
    beside the outlined 44px Margin call.
  The ⌘K Write group (slice 1b) and rule 16's verdict-free scope (slice 4) are on the spec cards. No journal board
  draws amber text.
- **The owner's 2026-10-28 answers, as drawn:**
  - grafts G1 to G8: G1, the one-line reason to save a plan that goes ahead against a rule (New entry · plan a
    trade); G2, Plan a trade as the Rulebook's amber; G3, at most 7 active rules (Rulebook states); G4, "Rules you
    went ahead against", "Was going ahead worth it to you?" and This week's focus (Weekly review, the Timeline
    rail); G5, "Start with today." with "What do you think your downfalls are?" and "One rule from today" (Timeline
    first run); G6, his own label and the result against planned risk (Entry, Timeline cards); G7, a finding linked
    to gains, with no rule draft (Weekly review states); G8, computed checks (within · above · not recorded) apart
    from his answers (Entry, Rulebook);
  - open questions 17 to 19 answered under his standing instruction, each reversible before its slice; the tracker
    records Q-JOURNAL-01 to 19, all answered (`tracker-data.mjs`), and no board carries a held note;
  - deferred by question 16, so absent: the printable rulebook card, CSV column mapping and the Monday auto-run have
    no board, control or copy (the Rulebook and Import spec cards say so). The Monday offer stays in Settings ›
    Journal (slice 4).
- **Integration fixes:**
  - `jrFig({ signed: true })` now tints: `.jr-fig-v`'s phosphor came after the base `.t-down`/`.t-up` at the same
    specificity. The rows had worked around it, so no board's pixels change;
  - `.jr-more`, a standalone link, is 44px under a coarse pointer and below 600px (rule 7), as `.jr-chip` is; Weekly
    review · phone grows 20px (7828 → 7848);
  - the Weekly review's "Where the money went" twin printed "[object Object]" in its Total row's share cell
    (`{ t: '' }` falls through `chart-kit.mjs`'s twin cell); the cell is now empty. It sat in the closed "Show the
    numbers" on 7 boards.
- **Heights** (`tmp/journal-boards/heights.mjs`, the R2-C script adapted to this tree): 253 boards measured, 53
  changed: the 51 journal stems, new, and FProgressMap 3621 → 4373 and FProgressTracker 4480 → 6970. 0 overflow, 0
  text under 11px. The new stems follow FPlannedTaStates in board order; a second measurement after the rebuild
  changes 0.
- **Sweep of the 51 journal artboards as built** (`design/canvas`, each at its artboard width and frame height): 0
  horizontal overflow and 0 visible text under 11px (the sweep exits 1 on a mutant with either); no content past
  its frame; no child past its kit frame; no sentence split by a flex container; with the browser's default font at
  20px, no board changes width or height; `textUp`/`textDown` only on text with its sign.
- **Checked:**
  - `node design/src/build.mjs` 0 (258 artboards, 359 site pages), and a second run is byte-identical;
  - `node design/src/verify-tokens.mjs` 0;
  - `node tmp/journal-boards/check-sample.mjs` 0 (352 of 352);
  - NUL bytes 0 in every changed or new file under `design/`.
- **Not published** to the canvas artifact.
- **Left as found:**
  - What's sent counts 8 new entries and 26 older summaries (all 34) yet says the 2 entries he kept out are never
    sent; the boards draw it as printed;
  - 14 of the sample's 34 entries are undescribed, so no board draws them;
  - on every Final board, not only the journal's: shared chrome under 44px at 390 under a coarse pointer (the
    wordmark, the avatar, the footer's Privacy and Terms, the skip link; `lib.mjs`), and 12px corners on phone
    sheets from the base `[role="dialog"]` rule (`lib.mjs:241`) where the kits draw 16 16 0 0.
- **Review fixes** (the spec-fidelity and design-canon reviews of `13c3073d`, same day). Applied:
  - Weekly review · mostly from memory keeps his words against his numbers (the Sep 18 margin question) beside the
    Oct 1 plan's question and drops the one that leans on pattern 1's count; row 4 reads "0 of 1" (a plan is
    written at the time); the recalled high reads "$51,251 · recorded high · Aug 21 · from memory". The card says so.
  - Marking (P-3, D1): Drawers and sheets · phone gains the demo bar, the staging board note and a Sample tag in
    each sheet's peek row, as do Rulebook · phone's menu sheet and Entry · phone's docked peek; the 1440 drawers'
    and dialog's sections of sample data are dashed with the 8px band; the timeline's day groups, the week's focus,
    the phone's account peek row and Review's Past reviews sit in sample frames, and the reference cell matches.
  - Type register: the "was …" figures (Update numbers sheet, the composer behind Edit positions), the finding
    sheet's peek-row claim (traced), Entry's cap line, and the composer's typed Due by and money date-time are Mono.
  - Edit positions: excess liquidity is untinted (Palette roles) and the composer behind draws no amber, so
    "Save positions" is the board's one fill.
  - The Oct 5 plan card carries his line under "went ahead against R3" (Screens 4), in the kit's `jrEntryCard`.
  - Board notes (P-4): R2's Oct 1 answer is derived (Rulebook, Rule R2, all five Review boards); "Draft a rule from
    this" shows only where the review holds a draft (Review boards, and a state line on the card); each card's AI
    status isn't drawn (Timeline boards).
  - Settings · phone draws the bulk read offer, its egress sentence above "Read them now"; the card's slice-5 line
    and criterion 14 name it.
  - Words: "Couldn’t load" with the typographic apostrophe on every journal board (`jrTag`'s default;
    `data/states.mjs` untouched), and no Loading tag on the Rulebook and Tidy cards; the AI read's tag is Sample,
    with "Sample read · No model was called" as its first line; the failed draft's label is caps text, not a tag;
    one Delete journal confirm (the spec's and Settings', with no "Keep it"); "Looking back, …", from the parser's
    list, replaces "fast forward to today" on Tidy's Aug 21 panel.
  - Contrast and touch: action labels on a warn strip are text.primary ("Keep it" 12.95:1 in light, from 4.27:1);
    "Delete journal" sits on the neutral well (4.69:1 in light); below 600px and under a coarse pointer every
    journal button, the chart twin's summary and the ⓘ are 44px; the Filters sheet's switch rows are labels.
  - Spec cards: Timeline cites Screens 1 and 4 for the plan card and the wall and adds criteria 7 and 26; Review
    adds criterion 13; Drawers and sheets says RealPositionRows' Right is neutral under ruling #18.
- **Declined in review:**
  - signed money keeps `textUp`/`textDown` with its sign: the spec's Palette roles and criterion 9 and the canon's
    2026-10-13 rows outrank the step's "no green or red tint" line; neutral journal P/L needs an Amendments row;
  - Compose · Plan a trade keeps its inset's "Save plan": the BOARD BRIEF draws "Unanswered → answered" there and
    15 states on States;
  - the Book boards keep no tab band: FPositions* draw the shipped `/positions`, which gains it with slice 1a;
  - control borders and the pressed segment under 3:1 are kit-wide and need a canon Amendments row;
  - What's sent (34 sent, 2 kept out) and Oct 2's maintenance requirement (`not recorded`, though untouched
    fields carry over) need spec lines from the owner; the boards draw the spec as printed;
  - no draft row under the timeline's "Couldn’t load" (the spec prints no words for one), no light cell for the
    warn strip (light is a token swap; the flipped scheme was measured), and no Entry · States cell for the Oct 5
    plan's Rules panel (the brief draws 18 states).
- **Review fixes, checked:** heights 28 stems changed (27 journal boards and FProgressTracker 6970 → 6988, the
  Settings slice-5 line); Weekly review · phone's notes were shortened to keep it at 7985, under the canvas's 8000
  cap; a second measurement changes 0. Build 0 (a second run byte-identical), verify-tokens 0, check-sample 0
  (352 of 352), the sweep 0 (51 artboards: 0 overflow, 0 text under 11px), content past a frame 0, amber text 0,
  NUL bytes 0.

## 2026-10-28 · The owner-only state on the desk, Scanner and Positions boards (app `e86ab538`, `4471cb0b`)

- **Drawn:** a "Not the owner" cell on `FDeskStates`, `FScannerStates` and `FPositionsStates`, each the shipped
  `OwnerOnlyWall` (`RequireAuth.tsx`): the surface's sentence as a 24px title, "See it on the demo →" as a neutral
  outlined 44px button (on the desk, then "Read SPY research", the route's free path), and "For the site’s operator"
  folded under a rule. No tag (P-2 has no word for it, spec 08 open question 12) and no Sign in. The cells are wide,
  as the sign-in wall's cell is on Scanner and Positions, and sit after Signed out (Scanner, Positions) or after AI
  read · no key (the desk). Each says when the wall shows: only on a build with the options feed, so neither site
  today.
- **Closed only:** every operator line on the canvas is drawn folded (`planned.mjs` `nc()`, Filings, the trust
  pages), so the cells draw the closed form. The line itself is in the markup.
- **Spec cards:** Desk, Scanner and Positions list the state in States (no tag) and a shipped line citing both
  commits in Built so far; Code adds `ownerGate.ts`.
- **One drawing:** `account-pages.mjs` `ownerWall()` draws the wall, and `jrNotOwner` now draws through it, since the
  slice 1a plan shows the journal through the same `OwnerOnlyWall` (its F4). So `FJournalTimelineStates`' wall gains
  the folded operator line and wraps as the app does. `WALL_CSS` carries the walls' rules to the desk's board, whose
  row doesn't load `ACCT_CSS`; `ACCT_CSS` is byte-identical (sha256 `7f4fe025…`).
- **Against the app** (`fe-fixup` measurements and crops at 1440, fine pointer, and 390, coarse; dark and light; 16px
  root): the wall is 600 × 227.78 at 1440 and 358 × 308.17 (desk) or 254.17 at 390; the title breaks where the app's
  does; buttons are 44 tall (312 wide at 390); the summary is 24 tall (44 coarse); every text size and colour is the
  app's (summary 6.19:1 dark, 5.42:1 light). The title wraps greedily: `lib.mjs` balances every board h1, which broke
  "…private to the / account that…" where the app breaks after "that".
- **Differs on purpose:** at 1440 the buttons are 2.6 and 2.0px wider (the kit's `.btn` pads 14 + 1 a side, MUI's
  outlined button 13 + 1; every wall button on the canvas has it); the → is the app's Plex Sans glyph (its vendored
  `symbols` subset, `styles.css`) but a fallback face on the boards, whose Google Fonts Plex Sans has no U+2192 (every
  → on the canvas has it); the boards are drawn at a 16px root (px only).
- **Heights:** 7 stems changed. FDeskSpec 5684 → 5964, FDeskStates 2770 → 3255, FScannerSpec 2797 → 2999,
  FScannerStates 2696 → 3181, FPositionsSpec 2152 → 2396, FPositionsStates 2118 → 2603, FJournalTimelineStates
  2300 → 2351. A measurement of all 253 boards before writing changed only these; the second measurement changed 0.
- **Checked:** build 0 (a second run byte-identical), verify-tokens 0, the sweep of the 9 changed artboards 0
  (0 overflow, 0 text under 11px, 0 clipped, no change at a 20px default font), canvas layout 0 overlaps, NUL 0, CR 0.
- **Left as found:** the desk's own sign-in wall is not drawn. Since `e86ab538`, on a build with the feed, a signed-out
  visitor's refused bundle read (403 `auth_required`) puts up the sign-in wall with "Read SPY research" in place of
  the desk, so the desk's AI read · Sign in cell may no longer be reachable there. Not checked in a running app.

## 2026-10-28 · The canvas in 13 pages, tethered to Convexa's version

- **Owner ask:** organize the canvas more logically, use several pages, and version it, tied to Convexa's version.
  "Convexa Desk Redesign" now has **13 pages**: Start here; the app in its navigation order (Scanner, Ticker desk,
  Research, Positions & alerts, Settings & operator, Dialogs & overlays, Public site, Shell & foundations); Planned ·
  Trade journal; Planned · Public-data tools; Prototypes · not ruled; and Changelog. Rows keep their keys, so no board
  file is renamed. `PAGE_ROWS` (`src/screens/final/index.mjs`) places every row, the library and the prototypes
  included; the build fails when a row sits on no page or on two, or a planned row on a built page.
- **Version:** Convexa's one version is the root `package.json`'s (1.0.0, the first push after 2026-10-28). Each page
  carries a header note at its top left naming the page and the version; Start here adds a version card. Each built
  row's title ends "· Convexa 1.0.0", from `SHIPPED_IN` in `tracker-data.mjs` (the build fails on a missing, extra or
  non-SemVer entry); the board map and the tracker gain a Version column, Planned on the planned pages.
- **Changelog page:** one board lists every entry in this file, newest first, under the version it shipped in: the
  earliest `v*` tag holding the commit that added its heading, else the package version, marked not released yet
  (`src/screens/final/changelog.mjs`, read from git at build time).
- **Publish stamp:** `emit-project.mjs` fills the version card in the emitted index only with the release status,
  the commit and its date, and the commits not yet on origin/main, and records it in `batches.json`. It refuses
  (exit 1) while `design/` or `package.json` has uncommitted changes, unless `--allow-dirty`.
- **Why:** pages by app area follow how the app is used; a canvas that names its version and commit can be matched
  to the Convexa it shows, and building `design/` at a release tag shows that release's design.
- **Heights:** FProgressMap 4373 → 4792 and FProgressTracker 6988 → 7499 (the Version column and five more page
  groups); FChangelogEntries is new at 2371. A second measurement changed 0; so did a measurement of all 254 Final
  boards.
- **Checked:** build 0 (a second run byte-identical), verify-tokens 0, the sweep of the 3 changed boards 0 (0 overflow,
  0 text under 11px, 0 clipped, no change at a 20px default font), note geometry 0 (60 notes; none overlaps a board
  or a note, every title at least 223px above its row), NUL 0, CR 0. Each of 11 mutations of the page and version
  rules fails the build with its reason; the emitter refuses fake dirty porcelain (exit 1) and stamps with
  `--allow-dirty` (exit 0).
- **Open:** Planned · Liquidity reads Built (5 of 5 shipped, inside Markets) yet carries no version, because planned
  rows have none; moving it to Research would give it 1.0.0. `design/README.md` still describes the eight pages of
  2026-10-25; it is outside this change.

## 2026-10-28 · Review fixes: the pages, the version tether and the owner-only state

- **What two reviews of `1a6c304a` and `bd8e9962` found:** Liquidity shipped but read Planned, the publish step copied
  whatever build was committed, every spec card said "Convexa v1", and the desk drew no sign-in wall though the app
  shows one.
- **Supersedes** in the 13-pages entry above: "Each built row's title ends '· Convexa 1.0.0'" and "a Version column"
  (now "since Convexa 1.0.0" and a Since column: the value is set once, and after a bump the page header names a newer
  version); "under the version it shipped in" (now the design changes up to a version); and the app "in its navigation
  order" for all eight built pages (the top nav is Scanner, Ticker, Research, Positions, Alerts; the other four are the
  pages around it). In the owner-only entry: "only on a build with the options feed, so neither site today", and its
  "Left as found" line on the desk's sign-in wall. Nothing above is edited.
- **Liquidity is a built row:** it shipped inside Markets (`LiquiditySection.tsx`, 2026-10-15; its card: 5 of 5
  shipped), so it moves from Planned · Public-data tools to Research, after Markets, as "Research · Markets ·
  Liquidity", with `SHIPPED_IN` 1.0.0 and no planned section. Its route loses "(proposed)", its Code names the files
  that shipped (`liquidity.rs`, `LiquiditySection.tsx`, `liquidityCalendar.ts`, `fomc.ts`; the card named three `(new)`
  files that never existed), its production board is "Production" (was "as it would ship") and its board note says
  "The Liquidity section of /research/markets" (was "New section"). The key stays `planned-liquidity`, so no board file
  is renamed. The build now fails when a row on a planned page is Built (every item on its card shipped).
- **Publish renders, never copies:** `emit-project.mjs` renders every board from the committed source (`boards.mjs`,
  which `build.mjs` now uses too) instead of copying `design/canvas/`, so a source change committed without a rebuild
  still publishes, and the Changelog board groups its entries by the tags present at publish, as the stamp does. It
  lists any board whose render differs from the committed `canvas/` (`differsFromCommitted` in `batches.json`).
- **Spec cards:** the eyebrow comes from the row: "Spec · since Convexa 1.0.0", or "Spec · Planned" on the 16 planned
  cards (it read "Final · Convexa v1 · spec · Oct 14, 2026" on all 41, the journal's included).
- **Version checks:** a `SHIPPED_IN` entry with a prerelease or build suffix, or before 1.0.0, fails the build. The
  Changelog board's height is recorded beside the number of entries it was measured at (`"FChangelogEntries.entries"`
  in `heights.json`); a different count fails the build, and `design/README.md` says how to re-measure. A measured
  height over the 8,000px frame cap fails the build instead of being cut to 8,000.
- **Routes:** Privacy, Terms and Data sources and credits lose "(proposed)" (all three ship, `app.tsx`); More overlays'
  route no longer names `/account/reset` and `/account/invite`, which don't exist; its card names them as proposed.
- **Changelog lines:** an opening "Supersedes …" sentence gives way to what follows (its remainder after a semicolon,
  or the next sentence), so the five entries that open with one show what they did.
- **Notes:** the guide calls only Scanner to Positions & alerts the navigation order, then "the pages around it"; the
  Research header says the single note is on Ticker desk, as the ticker's Research tab (the nav lights Research for
  it); the journal header says seven screens under Positions' tabs, and its panel in Settings; the tools header says
  eight, and that Liquidity is on Research.
- **The desk's sign-in wall:** `FDeskStates` gains a wide "Signed out (build with the feed)" cell, before Not the
  owner: since `e86ab538` a signed-out visitor's desk reads answer 403 `auth_required`, and `OwnerGateBoundary` puts
  `SignInWall` in the desk's place: Private testing, "Sign in to open the SPY desk", "This area is limited to invited
  accounts while Convexa is in private testing.", Sign in · "See it on the demo →" · "Read SPY research", the policy
  line and "The demo account shows this screen on sample data." (the app review drew it, `fe-review` count.log line
  4). Drawn with the Scanner wall's rules: 600 × 324.16 at 1440, against the app crop's 600 × 328. The desk card's
  States and Built lines say so. AI read · Sign in, and the AI read row's Signed out (A7), are re-captioned as
  unreachable while the whole desk is owner-gated.
- **When the walls show:** where the options feed is live (the Scanner also when paused, since it keeps its board),
  or where `/api/health` can't say, since an unknown mode keeps the full surface; so on neither site today unless the
  health read fails. Caption and cards say so per surface.
- **Small:** three journal cards add "For the site's operator", folded, to Not the owner; the Scanner card cites
  `app.tsx:226-231 (ScannerRoute)` (it cited ResearchRoute's lines), and the Technical and Research tab cards cite
  235-247 and 252-261.
- **Heights:** 13 stems changed. FProgressMap 4792 → 4760, FProgressTracker 7499 → 7487, FScannerSpec 2999 → 3020,
  FDeskSpec 5964 → 6069, FDeskStates 3255 → 3836, FAiReadSpec 3116 → 3158, FPlannedLiquiditySpec 2069 → 2087,
  FPositionsSpec 2396 → 2417, FOverlaysSpec 2512 → 2535, FJournalTimelineSpec 3652 → 3673, FJournalRulebookSpec
  3330 → 3351, FJournalTidyImportSpec 3080 → 3101, FChangelogEntries 2371 → 2542 (at 27 entries). A second
  measurement of all 254 Final boards changed 0.
- **Checked:** build 0, and a second run byte-identical; verify-tokens 0; the sweep of the 53 changed boards 0 (0
  overflow, 0 text under 11px, no change at a 20px default font; its 4 "clipped" and 3 "split" reports are the same at
  HEAD: a board note above a page held at the frame's height, and the Liquidity chart's end label); note geometry 0
  (60 notes; the guide renders about 1,630px of its 2,000); 21 of 21 mutations of the page, version, entry-count and
  frame-cap rules behave as expected; the emitter refuses the dirty tree (exit 1) and, with `--allow-dirty`, renders
  all 259 boards identical to `canvas/`; NUL 0, CR 0.
- **Open, for the owner:** canon rule 16 names a signed-out state for the ticker's AI read. While the whole desk is
  owner-gated nobody signed out reaches the read; does rule 16 keep that state?
- **Left as found:** on the boards the sign-in walls' policy and foot lines are 12px (`.dline`); `RequireAuth.tsx`
  sets both at 13px (`fontSize: 13`, `wallFootSx`). Same on the Scanner, Positions and journal walls. Spec 08's state
  table (`08-trade-journal.md:808`) still gives Not the owner without the folded operator line the slice 1a plan's F4
  adds; that file is not design/'s.

## 2026-10-28 · The boards' footer shows Convexa's version, as the app's does

- **What:** every Final board's copyright line now names Convexa's version, “v1.0.0” in Mono, as the app's footer has
  since `8edf043d`; the boards drew the line without it. It reads “© 2026 Convexa v1.0.0. All rights reserved.”
  where it read “© 2026 Convexa. All rights reserved.” (the footer review of `8edf043d` found it). `FINAL_COPYRIGHT`
  (`src/lib.mjs`) takes the number from `CONVEXA_VERSION` (`src/screens/final/changelog.mjs`), the root `package.json`
  version read when the boards render, so it is never typed and a bump redraws the line.
- **Drawn as `Footer.tsx` draws it:** “v1.0.0” in IBM Plex Mono (`.mono`; canon rule 23, Convexa's own figure) at the
  line's 12px and steel. It is `aria-hidden`, and a visually hidden, unselectable “version 1.0.0” follows it (the
  app's `visuallyHidden` box plus `user-select: none`), so Chrome reads the line as “© 2026 Convexa version 1.0.0. All
  rights reserved.” and a selection copies it as drawn. The hidden part is drawn, not left out: the canon has no board
  rule against it, and the boards already carry the app's accessible structure where it has one (the demo bar's
  `aria-hidden` separators, the journal's visually hidden “Write an entry” label).
- **Which boards:** the 144 Final boards that draw the footer, on 10 pages, 146 lines (Global shell · States and
  Journal · Tidy up and import · Phone draw two each). Among them are the Shell row's three page boards and its
  States board's two footer cells; the shell's phone boards draw the drawer over a page with no footer and are
  unchanged. The Shell spec card's footer lines (the Footer widget, “the disclaimer and the copyright”, the round-3
  line) don't quote the line, so the card is unchanged.
- **Left as drawn:** the v2 `footer()` (`src/lib.mjs:385`, “© 2026 Convexa” in steel-2 beside Lab and a scheme
  switch) draws only the nine v2 pages of the static site, off the canvas since 2026-10-25, and stays as history. The
  year stays 2026 on the boards: the build never reads the clock (two builds are byte-identical), while the app
  prints the current year.
- **A version bump now redraws 144 more boards:** `node design/src/build.mjs` rewrites these board files and their
  144 site pages with the version notes, so commit the rebuild with the bump. `emit-project.mjs` renders from source,
  so a stale `canvas/` never publishes the old number; it lists those boards as stale.
- **Heights:** none of the 254 Final boards changed with the line (it stays one 18px line); FChangelogEntries 2542 →
  2631 at 28 entries. A second measurement of all 254 changed 0.
- **Checked:** build 0, a second run byte-identical; verify-tokens 0. Every footer board was rendered from source in its
  own scheme and the other, at 16px and 20px default font sizes (576 loads, 584 lines), against the footer lane's 16
  renders of the app (dark and light, 1440 and 390, 16px and 20px roots). The results: one 18px line everywhere, as
  the app keeps it; “v1.0.0” in IBM Plex Mono (Chrome's platform font for its 6 glyphs), 12px/18px, weight 400, in the
  line's colour (dark rgb(138, 155, 180) on ink, 6.78:1; light rgb(90, 107, 133), 5.00:1; the app's), 92.25px into
  the line (the app 92.28) and 43.2 × 15 (the app's). Chrome's accessibility tree reads “© 2026 Convexa version 1.0.0.
  All rights reserved.” and a selection copies “© 2026 Convexa v1.0.0. All rights reserved.”, as in the app; on the 7
  boards that draw a dialog open, the page behind it is `aria-hidden`, so the line is out of the tree there, as at
  HEAD. Every footer and line box equals HEAD's within 0.5px. Four mutations (the version in Sans, the hidden part
  selectable, the line wrapped, the version spoken) each fail that check. App and board line screenshots at 2x
  differ only in antialiasing once aligned (largest channel difference 40 of 255). The sweep of the 145 changed boards
  found 0 overflow, 0 text under 11px and no change at a 20px default font; its 49 clipped and 27 split reports are
  HEAD's, board for board. NUL 0, CR 0.

## 2026-10-28 · Spec 08's What's sent counts and Oct 2's maintenance requirement, settled

- **What:** spec 08's Corrections items 18 and 19 (`docs/product/specs/2026-10-26/08-trade-journal.md`) settle the two
  contradictions the step-0 review left on the boards (“Declined in review” under “Spec 08, step 0”), and the boards
  follow them. Both were answered under the owner's standing instruction for the trade journal: take every
  recommendation.
- **What's sent (item 18):** the 2 entries he kept out are two older entries the spec doesn't describe, so What's sent
  counts 8 new texts, “Short summaries of older entries: 24” (was 26) and the 2 kept out: 8 + 24 + 2 = 34. The sample
  marks u02 and u03 `aiExcluded`, and its new `SENT` counts each line from the entries and the review's window, so no
  board types them. Neither is among the 8 new, which hold the call, the money, both trims, both plans and four
  snapshots, so “AI figures leave out 2 entries you kept out” and every Review board are unchanged.
- **The bulk read offer** counts every entry not kept out: “32 entries haven’t been read. Read them now · ≈ $0.17” (was
  34 and ≈ $0.18), and its egress sentence sends “the full text of 32 entries”. `bulkEstimate` sums it as the spec's
  cost model does: one cold read at $0.0198 and the rest warm at $0.0106, halved at batch price. For 34 entries it
  gives the spec's ≈ $0.37, $0.18 and $0.34.
- **Oct 2's maintenance requirement (item 19):** he cleared it, because Sep 30's $34,900 was set before the Oct 2 trim.
  So it reads `not recorded`, and so does excess liquidity, as the worked example prints; Oct 6 has nothing to carry.
  Carried, it would read −$297 on Oct 2 and −$3,291 on Oct 6. No figure changes. The sample records the cleared field
  (`cleared: ['maint']` on `s-oct02`), and one P-4 board note, `STRINGS.maintCleared`, says why wherever the field is
  drawn: Compose · Staging and Light under the snapshot's fields, Entry · Light under the Maintenance requirement row,
  and Drawers and sheets · Phone under the Update numbers sheet's caption.
- **Which boards:** 20 journal boards and their 20 site pages. Content: What's sent (the drawer, the phone sheet, and
  the AI off and after-a-run states), Settings · Phone and the Settings spec card, Compose · Staging and Light, and
  Entry · Light. The other 12 compose, entry and overlays boards change only in their row's CSS (the board-note class).
- **Heights:** FJournalComposeStaging and FJournalComposeLight 1592 → 1726, FJournalEntryLight 1963 → 2089 and
  FJournalOverlaysPhone 6721 → 6851 (the rows' declared heights follow), FChangelogEntries 2631 → 2719 at 29 entries.
  A second measurement of all 254 Final boards changed 0.
- **Checked:** `node design/src/build.mjs` 0, and a second run is byte-identical (625 files); verify-tokens 0;
  `tmp/journal-boards/check-sample.mjs` 0 (371 of 371, 19 more than before: the kept-out pair, the What's sent and
  bulk counts, the cleared field and its note). Six mutants of the sample fail it: a kept-out entry moved into the
  window; none kept out; Oct 2's cleared mark dropped; a cleared mark added on Sep 30; and Oct 2 given Sep 30's value,
  with the mark or without it (the two without a mark stop at the sample's own error). The worked example, recomputed
  with exact fractions under both readings of Oct 2, differs only in Oct 2's and Oct 6's excess liquidity, and two
  mutated tables fail that script. The sweep of the 20 changed journal boards 0 (0 overflow, 0 text under 11px, no
  change at a 20px default font); its 6 "clipped" reports are HEAD's, board for board and by the same number of
  pixels: a board note above a page held at the frame's height. NUL 0, CR 0.
- **Left as found:** item 17's “Carried from {date}” on the entry page is drawn on no Entry board. Oct 2's cash, which
  step 3 carries, reads $0 with no such line: the sample records no figure's provenance but Oct 2's cleared field, and
  the spec doesn't say where the cash was last typed.

## 2026-10-28 · Review fixes: the bulk read's first offer, the cleared-field note, two counts in Mono and the page behind ⌘K

- **What a review of `1cd2e3ae`, `014b1c71` and `a50e7e20` found:** the bulk read offer sat beside the Oct 7 month, with
  nothing left to read, Oct 2's note said “that day’s trim”, two counts were in Sans, and the Shell boards' ⌘K left
  their page in the accessibility tree.
- **Supersedes** in the “Spec 08's What's sent counts …” entry: “The bulk read offer counts every entry not kept out”
  (now the entries neither kept out nor already read, 32 at its first offer). In the footer entry: “on the 7 boards
  that draw a dialog open” (now 10, with the Shell row's three ⌘K boards). Nothing above is edited.
- **The bulk read's first offer** (spec 08, Corrections, item 18, corrected in `400ffb76`): the offer counts the entries
  neither kept out nor already read, so its “32 entries haven’t been read. Read them now · ≈ $0.17” is the first offer,
  when reads are turned on. By the Oct 7 month that review had read the 8 new entries and the 24 older ones had gone
  as digests, so beside “1 review · 8 entry reads” the offer counted 40 of 34 entries. Settings · Phone now draws it
  beside the first offer's month, “This month: $0.00 of $5.00 · 0 reviews · 0 entry reads” (`AI.bulk.month`, from the
  new `monthLine`, which reproduces the printed Oct 7 line). The Settings spec card's bulk state gives the rule and
  that month. Staging and the States board keep the Oct 7 month, with no offer.
- **The cleared-field note** names its trim by the day: “Sep 30’s figure was set before the Oct 2 trim.” It read “before
  that day’s trim”, and the day named just before it, Sep 30, had its own trim, typed before its $34,900 (the 3:40 PM
  numbers). The sample now refuses to load if the cleared snapshot's entry isn't a trim. Compose · Staging and Light,
  Entry · Light and Drawers and sheets · Phone; the note keeps its line count.
- **Counts in Mono** (canon rule 23): “Sends the full text of 32 entries” on Settings · Phone and “AI figures leave out
  2 entries you kept out” on Review · Staging, Phone and Light now set the count in IBM Plex Mono, as the lines beside
  them do; both counts are computed since `a50e7e20`. The Review sentence sits in one span: without it the row's 6px
  gap widens the spaces around the 2.
- **The page behind ⌘K:** FShellStaging, FShellProduction and FShellLight wrap the page in `aria-hidden`, as the boards
  that draw a dialog open do; the app's palette is a MUI Dialog (`CommandPalette.tsx:399`), which hides the page.
  Chrome's tree no longer reads the footer line there. Their pixels are unchanged.
- **The slice 1a plan** follows items 18 and 19 in `400ffb76`: F2 seeds the 2 kept-out entries and criterion 26's
  script counts them, and F6 sends an emptied Update field as `not_recorded` (T23 gains the case).
- **Heights:** FJournalSettingsSpec 3063 → 3084 (the row's `specH` follows), FChangelogEntries 2719 → 2808 at 30
  entries. A second measurement of all 254 Final boards changed 0.
- **Checked:** build 0, and a second run byte-identical; verify-tokens 0; `tmp/journal-boards/check-sample.mjs` 0 (379
  of 379, 8 more: the note's day and its trim, the month line's formatter against the printed Oct 7 line, the first
  offer's empty month, and the counts that leave nothing to offer by the Oct 7 month); five mutants of the sample fail
  it, one at its new guard. The sweep of the 15 changed boards 0 (0 overflow, 0 text under 11px, no change at a 20px
  default font), and of all 51 journal boards 0, with HEAD's 21 clipped reports board for board. On the three Shell
  boards Chrome's accessibility tree keeps the ⌘K dialog and its options and names nothing outside it (31 nodes at
  HEAD, the footer line among them); their screenshots are byte-identical to HEAD's at 16px and 20px default fonts,
  animations stopped. On the journal boards pixels differ only on the changed lines, and on the Settings spec card
  below its longer bulk state. The two counts render in IBM Plex Mono (IBM Plex Sans at HEAD). NUL 0, CR 0.

## 2026-10-28 · The Shell spec card names the footer's version, and its seven links

- **What:** the Global shell row's spec card now says what the footer's copyright has carried since `8edf043d`. A new
  built line reads “The copyright names Convexa’s version …”, and the footer's acceptance line ends “… the disclaimer
  and the copyright, which names Convexa’s version.”
- **Seven links:** that acceptance line said the footer has “five links (Settings among them)”. It has seven:
  research, methodology, blog, Settings, credits, privacy and terms (`Footer.tsx:91-147`), as the card's own built
  line and the States board's footer cell say.
- **Supersedes** in “The boards' footer shows Convexa's version, as the app's does”: “The Shell spec card's footer
  lines … don't quote the line, so the card is unchanged.” Nothing above is edited.
- **Counts:** the board map reads 228 of 287 items shipped (was 227 of 286) and Shell & foundations 24/25; the tracker's
  In progress group reads 18/19.
- **Heights:** FShellSpec 3783 → 3893 (one more built line). FChangelogEntries 2808 → 2877 at 31 entries. A second
  measurement of all 254 Final boards changed 0.
- **Checked:** build 0, and a second run byte-identical; verify-tokens 0. The sweep of the changed boards found 0
  overflow and 0 text under 11px. NUL 0, CR 0.

## 2026-10-28 · The canvas is named Convexa Design, and its name carries the version

- **Owner ask:** add the version number to the name "Convexa Desk Redesign", and is that the most apt name?
- **What:** the canvas is now "Convexa Design v1.0.0": its name, "Convexa Design" (`CANVAS_NAME`,
  `src/screens/final/index.mjs`), then "v" and the version it shows, the root package.json's (`CANVAS_TITLE`,
  `src/canvas.config.mjs`), written as the app's footer writes it. The published index carries the title
  (`emit-project.mjs`; the committed `canvas/canvas.json` has none), so a version bump renames the canvas the next
  time it is published. The Start here guide opens with the new name. The URL is unchanged.
- **Why the name changed:** "Desk" named one of its 13 pages, and "Redesign" the September project that started it.
  Since 2026-10-25 the canvas holds only the current, ruled design of every screen, and since 2026-10-28 it is
  versioned with the app, so it is Convexa's design rather than a redesign of the desk.
- **Supersedes** the name "Convexa Desk Redesign" in the entries above, which keep it as written. The frozen v4
  viewer (`canvas/convexa-desk-redesign.html`, made by `seed.sh`) keeps its name.
- **Heights:** FChangelogEntries 2877 → 2945 at 32 entries. A second measurement changed 0.
- **Checked:** build 0, and a second run byte-identical; verify-tokens 0. NUL 0, CR 0.

## 2026-10-29 · The Privacy boards list the demo's fifth key, and the page's new date

- **What:** the Privacy page now lists the demo's fifth key of its own, `convexa.demo.alerts.seed.v`: which version
  of the sample alerts a browser was given (`DEMO_ALERTS_SEED_VERSION_KEY`, `libs/api/src/lib/demo/alerts.ts:114`,
  written by `initializeDemoWorkspace`). It says "It adds five of its own" and reads "Last updated Oct 29, 2026"
  (`PrivacyPage.tsx`). The Privacy boards follow: the staging board's sentence and key table, and the date on all
  four.
- **Why:** the key arrived on 2026-10-15 (`7cc8d4d0`), twelve minutes after the page last changed, and the page's
  list never caught up. Found while re-checking the repo atlas on 2026-10-29.
- **Heights:** FPrivacyStaging 2382 → 2467. FChangelogEntries 2945 → 3034 at 33 entries; a second measurement changed 0.
- **Checked:** build 0, and a second run byte-identical; verify-tokens 0; the five Privacy boards measured with 0
  overflow and 0 text under 11px. NUL 0, CR 0.

## 2026-10-29 · The chunk-reload key, two board texts gone stale, and spec 07's stress gauge

- **What, Privacy** (`1317ab8f`): the page and its boards list `convexa.chunk-reload.v1` (`RELOAD_FLAG`,
  `apps/dashboard/src/reloadOnce.ts`), the flag both sites set once per tab when a page's code fails to load. It is
  session storage, and the demo leaves it unprefixed (`main.tsx:8` passes `window.sessionStorage` itself), so the live
  table's "local storage" sentence names it as the exception, the demo's "each under the prefix" reads "each but one",
  and its demo row says "(no prefix)". The Privacy spec card said "the demo's four own keys": five, and its key-table
  source now names `positions.owner` and the flag.
- **What, two stale texts** (`8ce65322`): the Blog card's 2026-10-15 row said index.html's `<noscript>` links the plain
  copy's `.html` address; a dated row supersedes it with the bare address (`ab8c4a80`). The card's built rows are now
  `&lt;`-escaped: since `7144bb37` the literal `<noscript>` in one had opened a real element and hidden the rest of the
  card (four rows, Rulings, Code). The operator's three metrics boards say where the page renders since `97e58d8d`: a
  dev server or the Docker stack, while production answers `/_ops/metrics` with the site's 404; the spec card's
  production lines say the same. Row ids and board bodies are unchanged.
- **What, spec 07 step 0** (`18e48c43`): a built row, Research · Markets · Stress (since Convexa 1.0.0), with its spec
  card, staging, production, phone and states, drawn from `StressSection.tsx` and `stressRead.ts`. Production draws the
  spec's worked example on the real files of 2026-10-22 (Neutral 50), staging the authored sample (Fear 38). The rail
  gains Stress and both page feet take the shipped disclaimer; the Markets boards point to the row instead of drawing
  it, since its real dates postdate theirs. /credits gains the OFR card and the CFTC card's new lines; /methodology the
  Fear–greed gauge section and What's live as `copy.ts` has it, with Net liquidity and the release dates, which had
  never reached the board; its phone board splits in two under the 8,000px cap. chart-kit's twin takes ChartFrame's
  `{ text }` cell.
- **Spec and code differ**, and the boards follow the code: a row's score is the mirror of its half-up percentile
  (`wholeScore`), not "round(score)" (spec Copy › Rows), which is what gives the spec's own 21, 49 and 69; at 390 the
  gauge row keeps "7 of 7 inputs counted · as of Oct 19", where the phone sketch shortens it.
- **Why:** lanes B3, B6 and B7 and spec 07's frontend landed on `main` on 2026-10-29 ahead of the design source.
- **Heights:** as each commit lists them; the largest: FBlogSpec 1177 → 1774, FMethodologyPhone 7495 → 5535 plus
  FMethodologyPhone2 3808, five new FResearchStress boards. FChangelogEntries 3034 → 3123 at 34 entries; a second
  measurement changed 0.
- **Checked:** build 0, and a second run byte-identical, after each commit; verify-tokens 0; every board a build
  changed was measured, with 0 overflow and 0 text under 11px. NUL 0, CR 0.
