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
