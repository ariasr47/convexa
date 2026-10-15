import type { PublicCalendar, PublicResultsWindow } from '../convexa';

/**
 * The demo's release calendar around the Oct 7, 2026 scenario. Every date here is authored sample
 * data, shaped like the agencies' published schedules and EDGAR filing history; none was read
 * from the Fed, BLS, BEA, Treasury or SEC, and the page marks all of it as sample. Nothing in this
 * module makes a request.
 */

/** The scenario's today: the calendar's six weeks start on this week's Monday. */
export const DEMO_CALENDAR_TODAY = '2026-10-07';

/** Sample macro schedule, answered as `PublicMarkets.calendar` by the demo transport. */
export const DEMO_CALENDAR: PublicCalendar = {
  from: '2026-09-30',
  to: '2026-12-16',
  releases: [
    {
      date: '2026-10-09',
      time: '08:30',
      name: 'PPI',
      agency: 'BLS',
      source: 'bls',
      moved_from: null,
    },
    {
      date: '2026-10-14',
      time: '08:30',
      name: 'CPI',
      agency: 'BLS',
      source: 'bls',
      moved_from: null,
    },
    {
      date: '2026-10-28',
      time: '14:00',
      name: 'FOMC statement',
      agency: 'Fed',
      source: 'fed-fomc',
      moved_from: null,
    },
    {
      date: '2026-10-29',
      time: '08:30',
      name: 'GDP',
      agency: 'BEA',
      source: 'bea',
      moved_from: null,
    },
    {
      date: '2026-10-30',
      time: '08:30',
      name: 'PCE prices',
      agency: 'BEA',
      source: 'bea',
      moved_from: null,
    },
    {
      date: '2026-11-04',
      time: '08:30',
      name: 'Quarterly refunding',
      agency: 'Treasury',
      source: 'treasury-qr',
      moved_from: null,
    },
    {
      date: '2026-11-06',
      time: '08:30',
      name: 'Jobs report',
      agency: 'BLS',
      source: 'bls',
      moved_from: null,
    },
    {
      date: '2026-11-12',
      time: '08:30',
      name: 'CPI',
      agency: 'BLS',
      source: 'bls',
      moved_from: null,
    },
  ],
};

/** Sample results windows, answered as `PublicFilings.results` for the names asked about. */
export const DEMO_RESULTS_WINDOWS: PublicResultsWindow[] = [
  {
    ticker: 'AAPL',
    start: '2026-10-29',
    end: '2026-11-02',
    basis: ['2026-07-30', '2026-05-01', '2026-01-29', '2025-10-30'],
    basis_kind: 'results_filings',
  },
  {
    ticker: 'NVDA',
    start: '2026-11-18',
    end: '2026-11-20',
    basis: ['2026-08-27', '2026-05-28', '2026-02-25', '2025-11-19'],
    basis_kind: 'results_filings',
  },
];

/** Sample results dates standing in for the dates a research note gives on the live site (the demo
 *  has no notes). */
export const DEMO_NOTE_RESULTS: { ticker: string; date: string; label: string }[] = [
  { ticker: 'TSLA', date: '2026-10-22', label: 'Q3 results' },
  { ticker: 'MSFT', date: '2026-10-29', label: 'Q1 FY27 results' },
];

/** The demo's followed names: the six symbols the scenario authors. */
export const DEMO_FOLLOWED = ['AAPL', 'MSFT', 'NVDA', 'QQQ', 'SPY', 'TSLA'];
