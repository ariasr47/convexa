// The H.4.1 schedule decides a state word: a frame that says "Delayed by source" when the Fed is on
// time (or "Computed · weekly" when it moved the release) misleads silently. Pinned against the real
// holidays: Thanksgiving, a Thursday Christmas and New Year's Day, a Thursday Juneteenth, and a
// Wednesday Veterans Day (which moves nothing: only a Thursday holiday moves the release).
import { describe, expect, it } from 'vitest';
import {
  easternClock,
  federalHolidays,
  h41Release,
  h41Status,
  liquidityMarks,
} from './liquidityCalendar';

describe('federal holidays', () => {
  it('follows the statutory dates and the weekend observance', () => {
    const h2026 = federalHolidays(2026);
    expect(h2026.get('2026-11-26')).toBe('Thanksgiving');
    expect(h2026.get('2026-07-03')).toBe('Independence Day'); // Jul 4 is a Saturday
    expect(h2026.get('2026-05-25')).toBe('Memorial Day');
    expect(h2026.get('2026-01-19')).toBe('Martin Luther King Jr. Day');
    expect(federalHolidays(2027).get('2027-07-05')).toBe('Independence Day'); // a Sunday
    expect(federalHolidays(2027).get('2027-12-24')).toBe('Christmas Day'); // a Saturday
  });
});

describe('when the H.4.1 is published', () => {
  it('is the Thursday after the Wednesday in an ordinary week', () => {
    expect(h41Release('2026-10-07')).toEqual({ date: '2026-10-08', movedFor: null });
    // Veterans Day on a Wednesday moves nothing.
    expect(h41Release('2026-11-11')).toEqual({ date: '2026-11-12', movedFor: null });
  });

  it('moves to the next business day when the Thursday is a federal holiday', () => {
    expect(h41Release('2026-11-25')).toEqual({ date: '2026-11-27', movedFor: 'Thanksgiving' });
    expect(h41Release('2025-12-24')).toEqual({ date: '2025-12-26', movedFor: 'Christmas Day' });
    expect(h41Release('2025-12-31')).toEqual({ date: '2026-01-02', movedFor: 'New Year’s Day' });
    expect(h41Release('2025-06-18')).toEqual({ date: '2025-06-20', movedFor: 'Juneteenth' });
  });
});

describe('Delayed by source', () => {
  // Thanksgiving week 2026: the week to Nov 25 would be out Thu Nov 26, 4:30 PM ET; it lands Fri Nov 27.
  const asOf = '2026-11-18';

  it('holds from the usual Thursday 4:30 PM ET until the moved release', () => {
    expect(h41Status(asOf, new Date('2026-11-26T21:31:00Z'))).toEqual({
      state: 'delayed',
      week: '2026-11-25',
      releases: '2026-11-27',
      holiday: 'Thanksgiving',
    }); // 4:31 PM EST
    expect(h41Status(asOf, new Date('2026-11-27T21:00:00Z')).state).toBe('delayed'); // 4:00 PM Fri
  });

  it('is not delayed before the usual time, after the moved release, or in an ordinary week', () => {
    expect(h41Status(asOf, new Date('2026-11-26T21:29:00Z')).state).toBe('onTime'); // 4:29 PM Thu
    expect(h41Status(asOf, new Date('2026-11-27T21:30:00Z')).state).toBe('onTime'); // 4:30 PM Fri
    expect(h41Status('2026-10-07', new Date('2026-10-15T22:00:00Z')).state).toBe('onTime');
  });

  it('reads the clock in New York, across daylight saving', () => {
    expect(easternClock(new Date('2026-07-02T20:30:00Z'))).toBe('2026-07-02 16:30'); // EDT
    expect(easternClock(new Date('2026-12-03T21:30:00Z'))).toBe('2026-12-03 16:30'); // EST
  });
});

describe('the marks on the net line', () => {
  it('puts each event on the first H.4.1 Wednesday on or after it', () => {
    const weeks = ['2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30', '2026-10-07'];
    expect(liquidityMarks(weeks).map((m) => [m.kind, m.date, m.index])).toEqual([
      ['tax', '2026-09-15', 1],
      ['fomc', '2026-09-16', 1],
      ['quarter', '2026-09-30', 3],
    ]);
  });

  it('keeps an event in the days before the first Wednesday, and nothing after the last', () => {
    expect(liquidityMarks(['2026-04-01', '2026-04-08']).map((m) => [m.date, m.index])).toEqual([
      ['2026-03-31', 0],
    ]);
    expect(liquidityMarks(['2026-04-22', '2026-04-28'])).toEqual([]);
  });
});
