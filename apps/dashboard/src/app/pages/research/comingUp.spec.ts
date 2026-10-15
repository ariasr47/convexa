import type { PublicRelease, PublicResultsWindow } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { buildComingUp, clock12, mondayOf } from './comingUp';

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

  it('says sample on the demo', () => {
    const c = buildComingUp({ ...base, demo: true });
    const all = c.weeks.flatMap((w) => w.events);
    expect(new Set(all.map((e) => e.source))).toEqual(
      new Set(['Sample schedule', 'Sample date', 'Sample window']),
    );
    expect(all.find((e) => e.label === 'FOMC statement')?.due).toBe('every sample note');
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
