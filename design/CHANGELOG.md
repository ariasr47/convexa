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

