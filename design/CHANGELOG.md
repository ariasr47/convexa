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
