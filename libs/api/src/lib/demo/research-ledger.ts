/**
 * The demo's forecast ledger: the six sample notes' calls on the Oct 7, 2026 scenario, with an
 * authored scored history so the Scorecard can show what it looks like once calls resolve. Every
 * row is sample data written for the demo; none is a real forecast, and the page marks it so.
 *
 * Loaded on demand (views.ts `loadSampleLedger`), so the live build never fetches it.
 */
import { AS_OF } from './catalog/shared';

export interface SampleForecast {
  ticker: string;
  claim: string;
  /** The row as it would sit in a note's forecasts block. */
  row: string;
  p: number | null;
  resolveBy: { label: string; end: string | null };
  outcome: 'yes' | 'no' | 'void' | null;
}

export interface SampleSignalGrade {
  setup: string;
  /** Share of setups that reached their named level within 5 sessions after costs, 0–1. */
  hitRate: number;
  n: number;
}

export interface SampleLedger {
  /** The scenario day the ledger is read on: "today" for the demo's Scorecard. */
  today: string;
  forecasts: SampleForecast[];
  signals: SampleSignalGrade[];
}

const row = (claim: string, p: number | null, by: string, source: string, outcome = '') =>
  [claim, p === null ? '___' : `${Math.round(p * 100)}%`, by, source, outcome]
    .filter((c, i) => i < 4 || c)
    .join(' | ');

const open = (by: string, ticker: string, claim: string, p: number | null): SampleForecast => ({
  ticker,
  claim,
  row: row(claim, p, by, 'Sample bars'),
  p,
  resolveBy: { label: by, end: by.length === 7 ? endOfMonth(by) : by },
  outcome: null,
});

function endOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** The 34 open calls: three past their dates, four inside the next two weeks, the rest later. */
const OPEN: SampleForecast[] = [
  open(
    '2026-10-02',
    'QQQ',
    'The authored path keeps its higher-close sequence through Oct 2.',
    0.7,
  ),
  open('2026-10-05', 'SPY', 'Closes keep alternating around the gradual rise through Oct 5.', 0.6),
  open('2026-10-06', 'TSLA', 'The oscillating path makes a new 10-session low by Oct 6.', 0.3),
  open(
    '2026-10-08',
    'NVDA',
    'The authored daily range stays above $4.00 for the next three sample sessions.',
    0.64,
  ),
  open(
    '2026-10-09',
    'TSLA',
    'A later authored close sits outside the current 10-session range.',
    0.35,
  ),
  open(
    '2026-10-13',
    'MSFT',
    'The authored close holds above its 20-session average through Oct 13.',
    0.72,
  ),
  open(
    '2026-10-14',
    'AAPL',
    'The next authored close lands inside the latest high–low range.',
    0.8,
  ),
  open('2026-10-23', 'SPY', 'The sample path closes October above its September close.', 0.55),
  open('2026-10-27', 'QQQ', 'The daily range widens past its 20-session average by Oct 27.', 0.6),
  open('2026-10-30', 'MSFT', 'The steady-trend path ends October within 2% of its high.', 0.65),
  open('2026-11-03', 'AAPL', 'The range case closes above its current range by Nov 3.', 0.5),
  open('2026-11-06', 'NVDA', 'A sample session moves more than 4% before Nov 6.', 0.45),
  open('2026-11-13', 'SPY', 'The breadth path keeps alternating closes through Nov 13.', 0.6),
  open('2026-11-18', 'TSLA', 'The reversal case retakes its 10-session high by Nov 18.', 0.4),
  open(
    '2026-11-20',
    'QQQ',
    'The growth-duration path holds above its 20-session average on Nov 20.',
    0.55,
  ),
  open('2026-11-27', 'MSFT', 'The steady trend holds through November without a 3% drawdown.', 0.7),
  open('2026-12-04', 'AAPL', 'The authored close stays inside a 5% band through Dec 4.', 0.6),
  open('2026-12-11', 'NVDA', 'The higher-variation case narrows its daily range by Dec 11.', null),
  open(
    '2026-12-15',
    'TSLA',
    'The oscillating path closes December below its November close.',
    0.35,
  ),
  open('2026-12-18', 'SPY', 'The gradual rise reaches a new sample high by Dec 18.', 0.65),
  open('2026-12-31', 'QQQ', 'The sample path ends the year above its October close.', 0.5),
  open('2027-01-08', 'MSFT', 'The steady trend survives the first sample week of January.', 0.6),
  open('2027-01-15', 'AAPL', 'The range case breaks its three-month range by Jan 15.', 0.55),
  open('2027-01-22', 'NVDA', 'The rising close path holds its 20-session average on Jan 22.', 0.5),
  open('2027-01-29', 'TSLA', 'The reversal case makes a new sample low in January.', 0.3),
  open('2027-02-12', 'SPY', 'Alternating closes give way to five rising sessions by Feb 12.', null),
  open(
    '2027-02-26',
    'QQQ',
    'The growth-duration path ends February above its January close.',
    0.55,
  ),
  open('2027-03-05', 'MSFT', 'The steady trend ends its third sample month higher.', 0.6),
  open('2027-03-12', 'NVDA', 'A sample session moves more than 6% before Mar 12.', 0.45),
  open('2027-03-19', 'TSLA', 'The oscillating path closes the quarter below where it began.', 0.35),
  open('2027-04-16', 'AAPL', 'The range case closes April inside its January range.', 0.6),
  open('2027-06-11', 'SPY', 'The breadth path keeps its gradual rise through June 11.', 0.6),
  open('2027-06-25', 'QQQ', 'The growth-duration path holds its year’s gains on Jun 25.', 0.55),
  open(
    '2027-09',
    'MSFT',
    'The steady-trend case is still trending at the end of the sample year.',
    null,
  ),
];

/** The sample history: calls already scored, by stated probability (centre of each tenth), how many
 *  were made and how many came true. Same table as the design's staging board
 *  (design/src/data/charts.mjs CALIB): 264 calls. */
const HISTORY: [p: number, n: number, k: number][] = [
  [0.05, 14, 1],
  [0.15, 22, 4],
  [0.25, 31, 7],
  [0.35, 38, 12],
  [0.45, 44, 21],
  [0.55, 41, 24],
  [0.65, 33, 22],
  [0.75, 24, 17],
  [0.85, 12, 11],
  [0.95, 5, 5],
];
const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'QQQ', 'SPY', 'TSLA'];
const START = Date.parse('2025-10-08T00:00:00Z');
const SPAN_DAYS = 360;

function history(): SampleForecast[] {
  const rows: SampleForecast[] = [];
  let i = 0;
  for (const [p, n, k] of HISTORY) {
    for (let j = 0; j < n; j += 1) {
      const by = new Date(START + Math.floor(((i * 97) % 264) * (SPAN_DAYS / 264)) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const outcome = j < k ? 'yes' : 'no';
      const claim = `Sample call ${i + 1}, scored in the sample history.`;
      rows.push({
        ticker: TICKERS[i % TICKERS.length],
        claim,
        row: row(claim, p, by, 'Sample bars', outcome),
        p,
        resolveBy: { label: by, end: by },
        outcome,
      });
      i += 1;
    }
  }
  return rows;
}

export function sampleLedger(): SampleLedger {
  return {
    today: AS_OF.slice(0, 10),
    forecasts: [...OPEN, ...history()],
    signals: [
      { setup: 'Wall hold', hitRate: 0.58, n: 41 },
      { setup: 'Flip reclaim', hitRate: 0.52, n: 33 },
      { setup: 'Gamma squeeze', hitRate: 0.44, n: 19 },
      { setup: 'Range fade', hitRate: 0.49, n: 27 },
    ],
  };
}
