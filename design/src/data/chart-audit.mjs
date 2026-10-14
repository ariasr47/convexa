// The v5 chart audit in summary, for the audit board. The long form, with every finding, file:line and
// lens, is design/CHARTS-2026-10-13.md; this file carries only what the board draws, so the two can't
// drift on the numbers that matter: the counts and the top ten.
export const AUDIT_COUNTS = [
  { fam: 'Research note blocks', ids: 'RN-01…13', n: 13, s1: 2, where: 'apps/dashboard/src/app/pages/research/blocks/ · ResearchIndexPage' },
  { fam: 'Markets', ids: 'RM-01…06', n: 6, s1: 1, where: 'MarketsPage.tsx · marketsMath.ts' },
  { fam: 'Scorecard and Filings', ids: 'RS-01…04', n: 4, s1: 0, where: 'ScorecardPage.tsx · FilingsPage.tsx' },
  { fam: 'Note panels', ids: 'RP-01…03', n: 3, s1: 0, where: 'NotePublicPanels.tsx' },
  { fam: 'Ticker desk', ids: 'TD-01…12', n: 12, s1: 4, where: 'shared/charts/structure-field · pages/ticker/widgets' },
  { fam: 'Technical tab', ids: 'TT-01…02', n: 2, s1: 0, where: 'pages/ticker/technical-analysis' },
  { fam: 'Scanner, landing, lab, positions, operator', ids: 'SC · LD · LB · PO · OP', n: 12, s1: 0, where: 'pages/scanner · pages/landing · pages/lab · features/trading · pages/operator-metrics' },
  { fam: 'Design-board marks', ids: 'DB-01…21', n: 21, s1: 0, where: 'design/src (lib.mjs, components, screens/v4)' },
  { fam: 'Planned tool sheets', ids: 'PT-01…09', n: 9, s1: 0, where: 'docs/public-data/CANDIDATES.md · V4Tool* boards' },
];
export const AUDIT_TOTAL = AUDIT_COUNTS.reduce((s, r) => s + r.n, 0);

export const TOP_TEN = [
  { n: 1, title: 'Draw negative values as negative', ids: 'RN-13', score: 9, why: 'The research index draws HOOD’s −90% margin and MU’s loss as 3px stubs (ResearchIndexPage.tsx:98).' },
  { n: 2, title: 'Never draw a missing value as zero', ids: 'TD-07', score: 9, why: 'The opportunity ring and cell fall back to 0 when the score is absent (TickerDashboard.tsx:1071,1075).' },
  { n: 3, title: 'Readable term structure', ids: 'TD-08', score: 9, why: 'The hottest tenor label measures 1.44:1 on its amber cell (TermStructure.tsx:48,109).' },
  { n: 4, title: 'Claims that are true', ids: 'RM-03 · RM-02', score: 6, why: 'The decomposition title can contradict its bars; the curve title averages away a twist (MarketsPage.tsx:423-428, 243-252).' },
  { n: 5, title: 'The Scorecard counts what it draws', ids: 'RS-02', score: 6, why: 'Past-due calls are in the title’s N but in no bar (ScorecardPage.tsx:46, 406-415).' },
  { n: 6, title: 'Copy that matches the mark', ids: 'TD-03 · TD-05', score: 6, why: '“Dealers dampen moves” on both sides of the flip; a “5m” trail that holds about 1.7 s.' },
  { n: 7, title: 'The inversion line on the 2s10s', ids: 'RM-04', score: 6, why: 'No zero line; the band is the line’s own envelope, so the title is true by construction.' },
  { n: 8, title: 'The bridge crosses zero', ids: 'RN-04', score: 4.5, why: '5 of the 19 shipped bridges run below zero and spill over the page (Charts.tsx:431, 480).' },
  { n: 9, title: 'The structure field stops trapping scroll', ids: 'TD-01', score: 4.5, why: 'touchAction none on a full-width canvas; the loop restarts on every mid tick.' },
  { n: 10, title: 'Uncertainty drawn where it exists', ids: 'RS-03 · RN-01 · RN-06 · RM-06', score: 4, why: 'No intervals on calibration; guidance as a midpoint; faded valuation ends; an unexplained median tick.' },
];

export const RECURRING = [
  ['Text under the 11px floor', '9–10px in research charts, the structure field and calibration; ~6.6px in the v2 design instruments at 1024'],
  ['No data alternative', 'No chart has a table twin; per-strike gamma exists only behind hover on a canvas'],
  ['No keyboard path', 'No chart is focusable; tooltips only on pointer'],
  ['Silent states', 'Decomposition, 2s10s, the hero field and switched-off panels render nothing when their data is missing'],
  ['Values drawn as something else', 'Losses as stubs, absent as 0, gaps bridged, a band true by construction'],
  ['Colour doing text’s job', 'Green/red on price change and level moves; an unexplained median tick; a legend hidden on phones'],
];
