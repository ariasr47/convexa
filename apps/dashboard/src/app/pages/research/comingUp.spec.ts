import type { PublicFilings, PublicRelease, PublicResultsWindow, PublicSource } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  buildComingUp,
  clock12,
  comingUpState,
  isOwnResults,
  mondayOf,
  noteResultsOf,
  secEstimates,
} from './comingUp';

// What the calendar gets wrong silently: an estimate drawn over a note's announced date, an event
// in the wrong week, a claim whose count doesn't match the grid, a release outside the six weeks.
const release = (date: string, name: string, agency = 'BLS', time = '08:30'): PublicRelease => ({
  date,
  time,
  name,
  agency,
  source: agency.toLowerCase(),
  moved_from: null,
});
const window = (ticker: string, start: string, end: string): PublicResultsWindow => ({
  ticker,
  start,
  end,
  basis: ['2026-07-30', '2026-05-01', '2026-02-05', '2025-10-30'],
  basis_kind: 'results_filings',
});

describe('buildComingUp', () => {
  const today = '2026-10-15'; // a Thursday
  const base = {
    today,
    releases: [
      release('2026-10-14', 'CPI'),
      release('2026-10-28', 'FOMC statement', 'Fed', '14:00'),
      release('2026-11-06', 'Jobs report'),
      release('2026-12-10', 'CPI'), // after the six weeks
      release('2026-10-09', 'PPI'), // the week before
    ],
    noteResults: [
      { ticker: 'NVDA', date: '2026-11-17', label: 'Q3 FY2027 results' },
      { ticker: 'OLD', date: '2026-10-20', label: 'Q3 results' }, // not followed
    ],
    windows: [
      window('NVDA', '2026-11-26', '2026-11-26'), // the note's date wins
      window('AMZN', '2026-10-29', '2026-11-05'),
      window('MU', '2026-10-08', '2026-10-16'), // started before the first week: placed on its Monday
      window('INTC', '2026-12-20', '2026-12-22'), // after the six weeks
    ],
    followed: ['NVDA', 'AMZN', 'MU', 'INTC'],
  };

  it('covers six weeks from this Monday and places each event in its own week', () => {
    const c = buildComingUp(base);
    expect(c.from).toBe('2026-10-12');
    expect(c.to).toBe('2026-11-22');
    expect(c.weeks.map((w) => w.start)).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ]);
    const where = (label: string) =>
      c.weeks.findIndex((w) => w.events.some((e) => e.label === label));
    expect(where('CPI')).toBe(0);
    expect(where('FOMC statement')).toBe(2);
    expect(where('Jobs report')).toBe(3);
    expect(where('NVDA Q3 FY2027 results')).toBe(5);
    expect(c.weeks.flatMap((w) => w.events).some((e) => e.label === 'PPI')).toBe(false);
  });

  it('never draws an estimate over a note’s own date, and marks estimates as estimates', () => {
    const c = buildComingUp(base);
    const all = c.weeks.flatMap((w) => w.events);
    const nvda = all.filter((e) => e.ticker === 'NVDA');
    expect(nvda).toHaveLength(1);
    expect(nvda[0]).toMatchObject({ kind: 'note', source: 'From the note', due: 'NVDA' });
    const amzn = all.find((e) => e.ticker === 'AMZN');
    expect(amzn).toMatchObject({ kind: 'est', date: '2026-10-29', end: '2026-11-05', due: 'AMZN' });
    expect(amzn?.source).toBe(
      'Estimated from filing history · last 4: Jul 30, May 1, Feb 5, Oct 30',
    );
    expect(all.find((e) => e.ticker === 'MU')?.date).toBe('2026-10-12');
    expect(all.some((e) => e.ticker === 'INTC' || e.ticker === 'OLD')).toBe(false);
  });

  it('counts the companies the grid shows and names the next FOMC', () => {
    const c = buildComingUp(base);
    const shown = new Set(
      c.weeks.flatMap((w) => w.events).flatMap((e) => (e.ticker ? [e.ticker] : [])),
    );
    expect(c.reporting).toEqual([...shown].sort());
    expect(c.reporting).toEqual(['AMZN', 'MU', 'NVDA']);
    expect(c.fomc).toBe('2026-10-28');
    const fomc = c.weeks[2].events.find((e) => e.label === 'FOMC statement');
    expect(fomc).toMatchObject({ due: 'every valued note', source: 'Fed · 2:00 PM ET' });
  });

  it('leaves a company that reported earlier this week out of the count (W1-36)', () => {
    // Fri Oct 16: TSM reported Thursday. Its row stays in this week's column; the claim drops it.
    const c = buildComingUp({
      ...base,
      today: '2026-10-16',
      noteResults: [
        ...base.noteResults,
        { ticker: 'TSM', date: '2026-10-15', label: '3Q26 results' },
      ],
      followed: [...base.followed, 'TSM'],
    });
    expect(c.weeks[0].events.some((e) => e.ticker === 'TSM')).toBe(true);
    expect(c.reporting).not.toContain('TSM');
    expect(c.reporting).toEqual(['AMZN', 'MU', 'NVDA']);
  });

  it('draws a note’s ranged results date, and lets any note date ahead beat an estimate (W1-38)', () => {
    const c = buildComingUp({
      ...base,
      noteResults: [
        { ticker: 'AMZN', date: '2026-10-27', end: '2026-10-30', label: 'Q3 2026 results' },
        { ticker: 'CBRS', date: '2026-11-01', end: '2026-11-30', label: 'Q3 2026 results' },
        // MU's note gives Dec 15–23, after the six weeks: its estimate inside them is not drawn.
        { ticker: 'MU', date: '2026-12-15', end: '2026-12-23', label: 'FQ1-27 results' },
      ],
      followed: [...base.followed, 'CBRS'],
    });
    const all = c.weeks.flatMap((w) => w.events);
    expect(all.filter((e) => e.ticker === 'AMZN')).toEqual([
      expect.objectContaining({
        kind: 'note',
        date: '2026-10-27',
        end: '2026-10-30',
        source: 'From the note',
        due: 'AMZN',
      }),
    ]);
    // A month drawn as a range from its first day; it overlaps the six weeks, so it counts.
    expect(all.find((e) => e.ticker === 'CBRS')).toMatchObject({
      date: '2026-11-01',
      end: '2026-11-30',
    });
    // Nov 1 is a Sunday: it sits in the week of Nov 2, not the column that ended Oct 30.
    expect(c.weeks.find((w) => w.events.some((e) => e.ticker === 'CBRS'))?.start).toBe(
      '2026-11-02',
    );
    expect(all.some((e) => e.ticker === 'MU')).toBe(false);
    expect(c.reporting).toEqual(['AMZN', 'CBRS']);
  });

  it('says sample on the demo', () => {
    const c = buildComingUp({ ...base, demo: true });
    const all = c.weeks.flatMap((w) => w.events);
    expect(new Set(all.map((e) => e.source))).toEqual(
      new Set(['Sample schedule', 'Sample date', 'Sample window']),
    );
    expect(all.find((e) => e.label === 'FOMC statement')?.due).toBe('every sample note');
  });
});

describe('comingUpState: unknowns never read as facts (W1-37, W1-39)', () => {
  const row = (id: string, state: PublicSource['state']): PublicSource => ({
    id,
    name: id,
    state,
    as_of: null,
    checked_at: '2026-10-15T08:10:00Z',
    failed_at: null,
    detail: null,
  });
  const schedules = ['fed-fomc', 'bls', 'bea', 'treasury-qr'].map((id) => row(id, 'updated'));
  const filings = (o: Partial<PublicFilings>): PublicFilings => ({
    state: 'live',
    detail: null,
    checked_at: null,
    filings: [],
    missing: [],
    results: [],
    sources: [row('sec', 'updated')],
    ...o,
  });
  const fine = secEstimates({ demo: false, loading: false, error: null, data: filings({}) });
  const calendar = { from: '2026-10-12', to: '2026-11-22', releases: [] };
  const state = (o: Partial<Parameters<typeof comingUpState>[0]>) =>
    comingUpState({
      demo: false,
      loading: false,
      markets: { state: 'live', calendar },
      schedules,
      sec: fine,
      count: 3,
      ...o,
    });

  it('reads the estimates as missing when EDGAR or our request fails, or an old API omits them', () => {
    const down = filings({ state: 'unavailable', sources: [row('sec', 'source_down')] });
    expect(secEstimates({ demo: false, loading: false, error: null, data: down })).toEqual({
      word: 'sourceDown',
      missing: true,
      notSet: false,
    });
    expect(secEstimates({ demo: false, loading: false, error: 'HTTP 502', data: null })).toEqual({
      word: 'couldntLoad',
      missing: true,
      notSet: false,
    });
    const old = filings({ results: undefined, sources: undefined });
    expect(secEstimates({ demo: false, loading: false, error: null, data: old }).missing).toBe(
      true,
    );
    expect(fine).toEqual({ word: null, missing: false, notSet: false });
    const kept = filings({ sources: [row('sec', 'last_good')] });
    expect(secEstimates({ demo: false, loading: false, error: null, data: kept })).toEqual({
      word: 'lastGood',
      missing: false,
      notSet: false,
    });
  });

  it('says the dates are unknown when every schedule failed and nothing is in the grid', () => {
    const s = state({ markets: { state: 'live', calendar: null }, count: 0 });
    expect(s.status).toMatchObject({
      kind: 'message',
      tone: 'warn',
      text: 'The agencies’ schedules didn’t answer; dates are unknown.',
    });
    expect(s.tag).toEqual({ state: 'sourceDown', detail: 'schedules' });
  });

  it('tags an EDGAR outage and makes the count a floor', () => {
    const sec = secEstimates({
      demo: false,
      loading: false,
      error: null,
      data: filings({ state: 'unavailable', sources: [row('sec', 'source_down')] }),
    });
    const s = state({ sec });
    expect(s.status).toEqual({ kind: 'ready' });
    expect(s.tag).toEqual({ state: 'sourceDown', detail: 'SEC EDGAR' });
    expect(s.atLeast).toBe(true);
    expect(state({ sec, count: 0 }).status).toMatchObject({
      text: 'No dates known for the next six weeks.',
    });
    expect(state({}).atLeast).toBe(false);
    expect(state({}).tag).toEqual({ state: 'updated', detail: 'read Oct 15' });
  });

  it('says Off, not Source down, when public data is switched off', () => {
    const s = state({ markets: { state: 'off', calendar: null }, count: 0 });
    expect(s.tag).toEqual({ state: 'off' });
    expect(s.status).toMatchObject({ text: 'Public data is switched off on this server.' });
  });
});

describe('noteResultsOf', () => {
  const at = (
    label: string,
    kind: 'day' | 'window' | 'month' | 'by',
    start: string | null,
    end: string | null,
    resolved = false,
  ) => ({
    kind: 'catalyst' as const,
    label,
    when: { text: label, kind, start, end, approx: kind !== 'day', label },
    resolved,
  });
  it('keeps days, windows and months that name results; skips the rest', () => {
    expect(
      noteResultsOf('AMZN', [
        at('Q3 2026 results', 'window', '2026-10-27', '2026-10-30'),
        at('Q4 2026 results', 'month', '2027-02-01', '2027-02-28'),
        at('Q2 results', 'day', '2026-07-30', '2026-07-30', true), // resolved
        at('re:Invent', 'day', '2026-12-01', '2026-12-01'), // not results
        at('Earnings', 'by', null, '2026-12-31'), // no start
        at('Q1 results', 'day', '2027-04-30', '2027-04-30'),
      ]),
    ).toEqual([
      { ticker: 'AMZN', date: '2026-10-27', end: '2026-10-30', label: 'Q3 2026 results' },
      { ticker: 'AMZN', date: '2027-02-01', end: '2027-02-28', label: 'Q4 2026 results' },
      { ticker: 'AMZN', date: '2027-04-30', end: null, label: 'Q1 results' },
    ]);
  });
  it('keeps only the company’s own reporting periods, not labels that merely mention results', () => {
    // Real notes, 2026-10-13: NVDA tracks Broadcom's report, SPCX a lock-up pinned to its own.
    expect(
      noteResultsOf('NVDA', [
        at('Q3 FY2027 results', 'day', '2026-11-17', '2026-11-17'),
        at('Broadcom FQ4-26 results', 'month', '2026-12-01', '2026-12-31'),
      ]).map((r) => r.label),
    ).toEqual(['Q3 FY2027 results']);
    expect(
      noteResultsOf('SPCX', [
        at('Q3 2026 results', 'window', '2026-11-03', '2026-11-17'),
        at('Lock-up tranche after Q3 results', 'window', '2026-11-05', '2026-11-19'),
      ]).map((r) => r.label),
    ).toEqual(['Q3 2026 results']);
    // Every own-results shape the notes use.
    for (const label of [
      'FQ1-27 results',
      '3Q26 results and 4Q26 guide',
      '4Q26 results; 2027 growth and capex guide',
      'FY2027 results and FY2028 outlook',
      'Q4 2026 deliveries, then results and the 2027 capex guide',
      'H1 2026 results',
      '1H26 earnings',
    ])
      expect(isOwnResults(label)).toBe(true);
    for (const label of ['Q3 2026 10-Q', 'October 2026 operating data', 'Earnings call'])
      expect(isOwnResults(label)).toBe(false);
  });
  it('doesn’t count a company as reporting once its own date has passed', () => {
    // Nov 18: NVDA's Nov 17 and SPCX's Nov 3–17 are behind; Broadcom's month and the lock-up are not.
    const noteResults = [
      ...noteResultsOf('NVDA', [
        at('Q3 FY2027 results', 'day', '2026-11-17', '2026-11-17'),
        at('Broadcom FQ4-26 results', 'month', '2026-12-01', '2026-12-31'),
      ]),
      ...noteResultsOf('SPCX', [
        at('Q3 2026 results', 'window', '2026-11-03', '2026-11-17'),
        at('Lock-up tranche after Q3 results', 'window', '2026-11-05', '2026-11-19'),
      ]),
    ];
    const c = buildComingUp({
      today: '2026-11-18',
      releases: [],
      noteResults,
      windows: [],
      followed: ['NVDA', 'SPCX'],
    });
    expect(c.reporting).toEqual([]);
    expect(c.weeks.flatMap((w) => w.events).map((e) => e.label)).toEqual([
      'SPCX Q3 2026 results',
      'NVDA Q3 FY2027 results',
    ]);
  });
});

describe('dates and times', () => {
  it('finds the Monday and reads the clock', () => {
    expect(mondayOf('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(clock12('08:30')).toBe('8:30 AM');
    expect(clock12('14:00')).toBe('2:00 PM');
    expect(clock12('12:00')).toBe('12:00 PM');
  });
});
