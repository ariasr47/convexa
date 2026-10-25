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
