import type { PublicCalendar, PublicResultsWindow } from '@convexa/api';
import { freshness, upcoming } from 'virtual:convexa-research';
import { describe, expect, it } from 'vitest';
import {
  calendarTriggers,
  ESTIMATE_TRIGGER,
  FOMC_TRIGGER,
  fomcDays,
  sampleNoteAging,
  withCalendar,
} from './reviewTriggers';
import type { Aging } from './types';

// What goes wrong silently: a valued note that never comes due after the Fed moves the rate, an
// unvalued one that does, a decision on the note's own day counted as news, a moved meeting kept
// on its old date, an estimate drawn over the note's own results date.
const cal = (releases: PublicCalendar['releases']): PublicCalendar => ({
  from: '2026-10-08',
  to: '2026-12-24',
  releases,
});
const fomc = (date: string, moved_from: string | null = null) => ({
  date,
  time: '14:00',
  name: 'FOMC statement',
  agency: 'Fed',
  source: 'fed-fomc',
  moved_from,
});
const results = (end: string, resolved = false): Aging['events'][number] => ({
  kind: 'catalyst',
  label: 'Q3 FY2027 results',
  when: { text: end, kind: 'day', start: end, end, approx: false, label: end },
  resolved,
});
const win = (ticker: string, start: string, end: string): PublicResultsWindow => ({
  ticker,
  start,
  end,
  basis: ['2026-07-30', '2026-05-01'],
  basis_kind: 'results_filings',
});
const aging = (events: Aging['events'] = []): Aging => ({ priceAsOf: null, events });

describe('fomcDays', () => {
  it('is the Fed schedule without a calendar', () => {
    const days = fomcDays(null);
    expect(days).toContain('2026-10-28');
    expect(days).toContain('2026-09-16');
  });
  it('moves a meeting the calendar says moved, and adds a day the table lacks', () => {
    const days = fomcDays(cal([fomc('2026-10-29', '2026-10-28'), fomc('2028-01-26')]));
    expect(days).not.toContain('2026-10-28');
    expect(days).toContain('2026-10-29');
    expect(days).toContain('2028-01-26');
    expect([...days].sort()).toEqual(days);
  });
  it('ignores other releases', () => {
    const cpi = { ...fomc('2026-10-27', '2026-10-28'), name: 'CPI' };
    expect(fomcDays(cal([cpi]))).toContain('2026-10-28');
  });
});

describe('calendarTriggers', () => {
  const days = fomcDays(null);
  const note = (o: Partial<{ ticker: string; date: string; valued: boolean; aging: Aging }>) => ({
    ticker: 'NVDA',
    date: '2026-10-13',
    valued: true,
    aging: aging(),
    ...o,
  });

  it('makes a valued note due the day after the next decision, not on it', () => {
    const n = note({});
    const before = withCalendar(
      n.aging,
      calendarTriggers({ note: n, today: '2026-10-28', fomc: days, windows: [] }),
    );
    expect(freshness(before, { today: '2026-10-28' }).state).toBe('current');
    expect(upcoming(before.events, '2026-10-28', 70)[0]).toMatchObject({
      label: FOMC_TRIGGER,
      date: '2026-10-28',
    });
    const after = withCalendar(
      n.aging,
      calendarTriggers({ note: n, today: '2026-10-29', fomc: days, windows: [] }),
    );
    const f = freshness(after, { today: '2026-10-29' });
    expect(f.state).toBe('due');
    expect(f.passed.map((e) => [e.label, e.date])).toEqual([[FOMC_TRIGGER, '2026-10-28']]);
    expect(f.next?.date).toBe('2026-12-09');
  });

  it('never touches a note without a valuation', () => {
    const n = note({ valued: false });
    expect(calendarTriggers({ note: n, today: '2026-11-30', fomc: days, windows: [] })).toEqual([]);
  });

  it('takes a decision on the note’s own day as read', () => {
    const n = note({ date: '2026-10-28' });
    const t = calendarTriggers({ note: n, today: '2026-11-02', fomc: days, windows: [] });
    expect(t.map((e) => e.when.end)).toEqual(['2026-12-09']);
  });

  it('lists every decision since an older note', () => {
    const n = note({ date: '2026-07-01' });
    const t = calendarTriggers({ note: n, today: '2026-10-29', fomc: days, windows: [] });
    expect(t.map((e) => e.when.end)).toEqual([
      '2026-07-29',
      '2026-09-16',
      '2026-10-28',
      '2026-12-09',
    ]);
  });

  it('adds the estimated window only when the note has no results date ahead', () => {
    const w = [win('NVDA', '2026-11-18', '2026-11-20'), win('AMZN', '2026-10-27', '2026-10-30')];
    const dated = note({ valued: false, aging: aging([results('2026-11-17')]) });
    expect(calendarTriggers({ note: dated, today: '2026-10-15', fomc: days, windows: w })).toEqual(
      [],
    );
    // A results date already behind the note doesn't count as one ahead.
    const old = note({ valued: false, aging: aging([results('2026-08-27')]) });
    const [est] = calendarTriggers({ note: old, today: '2026-10-15', fomc: days, windows: w });
    expect(est.label).toBe('Results, estimated from filing history');
    expect(est.when).toMatchObject({ start: '2026-11-18', end: '2026-11-20', label: 'Nov 18–20' });
    // It is ahead, never passed: freshness doesn't turn the note due on an estimate.
    const merged = withCalendar(old.aging, [est]);
    expect(freshness(merged, { today: '2026-10-15' }).state).toBe('due'); // the Aug 27 date passed
    expect(freshness(withCalendar(aging(), [est]), { today: '2026-10-15' }).state).toBe('current');
  });

  it('estimates this quarter when the note only dates a later quarter’s results', () => {
    const w = [win('NVDA', '2026-11-18', '2026-11-20')];
    const later = note({ valued: false, aging: aging([results('2027-02-25')]) });
    const [est] = calendarTriggers({ note: later, today: '2026-10-15', fomc: days, windows: w });
    expect(est?.label).toBe(ESTIMATE_TRIGGER);
  });

  it('estimates past another company’s results the note tracks', () => {
    // NVDA's note tracks Broadcom's December report; after NVDA's own Nov 17 date it still needs
    // the estimate, and the lock-up pinned to SPCX's report is not a results date either.
    const w = [win('NVDA', '2027-02-18', '2027-02-26')];
    const other = (label: string): Aging['events'][number] => ({
      kind: 'catalyst',
      label,
      when: {
        text: label,
        kind: 'month',
        start: '2026-12-01',
        end: '2026-12-31',
        approx: true,
        label,
      },
      resolved: false,
    });
    for (const label of ['Broadcom FQ4-26 results', 'Lock-up tranche after Q3 results']) {
      const n = note({ valued: false, aging: aging([results('2026-11-17'), other(label)]) });
      const [est] = calendarTriggers({ note: n, today: '2026-11-18', fomc: days, windows: w });
      expect(est?.label).toBe(ESTIMATE_TRIGGER);
    }
  });

  it('spans months in the window label and skips a window that is over', () => {
    const n = note({ ticker: 'CRWV', valued: false });
    const [est] = calendarTriggers({
      note: n,
      today: '2026-10-15',
      fomc: days,
      windows: [win('CRWV', '2026-10-29', '2026-11-05')],
    });
    expect(est.when.label).toBe('Oct 29–Nov 5');
    expect(
      calendarTriggers({
        note: n,
        today: '2026-11-06',
        fomc: days,
        windows: [win('CRWV', '2026-10-29', '2026-11-05')],
      }),
    ).toEqual([]);
  });
});

describe('sampleNoteAging (staging Coming up, owner ruling 7)', () => {
  // The scenario: Oct 7, with the sample calendar's FOMC on Oct 28. A sample-only decision on
  // Oct 15 (not in the Fed's real table) shows that only the scenario's calendar is read.
  const today = '2026-10-07';
  const sample = sampleNoteAging({
    followed: ['AAPL', 'MSFT', 'QQQ', 'TSLA'],
    noteResults: [
      { ticker: 'TSLA', date: '2026-10-22', label: 'Q3 results' },
      { ticker: 'MSFT', date: '2026-10-29', label: 'Q1 FY27 results' },
    ],
    calendar: cal([fomc('2026-10-28')]),
    windows: [win('AAPL', '2026-10-29', '2026-11-02'), win('MSFT', '2026-10-30', '2026-11-03')],
    today,
  });
  const next = (t: string) =>
    upcoming(sample.find((s) => s.ticker === t)?.aging.events ?? [], today, 70).map((u) => [
      u.label,
      u.start,
      u.date,
    ]);

  it('gives every sample note the scenario’s FOMC and nothing from the real schedule', () => {
    expect(next('QQQ')).toEqual([[FOMC_TRIGGER, '2026-10-28', '2026-10-28']]);
    const only = sampleNoteAging({
      followed: ['QQQ'],
      noteResults: [],
      calendar: cal([fomc('2026-10-15')]),
      windows: [],
      today,
    });
    expect(upcoming(only[0].aging.events, today, 70).map((u) => u.start)).toEqual(['2026-10-15']);
  });

  it('keeps a sample date over an estimate, and estimates the rest', () => {
    expect(next('TSLA')).toEqual([
      ['Q3 results', '2026-10-22', '2026-10-22'],
      [FOMC_TRIGGER, '2026-10-28', '2026-10-28'],
    ]);
    expect(next('MSFT')).toEqual([
      [FOMC_TRIGGER, '2026-10-28', '2026-10-28'],
      ['Q1 FY27 results', '2026-10-29', '2026-10-29'],
    ]);
    expect(next('AAPL')).toEqual([
      [FOMC_TRIGGER, '2026-10-28', '2026-10-28'],
      [ESTIMATE_TRIGGER, '2026-10-29', '2026-11-02'],
    ]);
  });

  it('leaves every sample note current on the scenario day', () => {
    for (const s of sample) expect(freshness(s.aging, { today }).state).toBe('current');
  });
});
