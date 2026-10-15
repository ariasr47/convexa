/**
 * The dates the liquidity section reads by: when the Fed publishes each week's H.4.1, and the dated
 * events marked on the net line (quarter ends, FOMC decisions, corporate estimated-tax days).
 *
 * The H.4.1 schedule. The Fed releases the H.4.1 "each Thursday, generally at 4:30 p.m." (Eastern)
 * for the week ending the Wednesday before, and moves it to the next business day when that Thursday
 * is a federal holiday (https://www.federalreserve.gov/releases/h41/, checked Oct 15, 2026). The
 * federal holidays are worked out here from their statutory rules (5 U.S.C. 6103, with the Saturday →
 * Friday and Sunday → Monday observance), so the schedule needs no fetch.
 *
 * Getting this wrong is silent: it decides whether the liquidity frame says "Computed · weekly" or
 * "Delayed by source", so liquidityCalendar.spec.ts pins it against the real holidays.
 */
import { FOMC_DECISIONS } from './fomc';

const DAY = 86_400_000;
const at = (date: string) => Date.parse(`${date}T12:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => iso(at(date) + n * DAY);
const weekday = (date: string) => new Date(at(date)).getUTCDay();

/** The n-th (1-based) `dow` (0 = Sunday) of a month, or the last one when n is -1. */
function nthWeekday(year: number, month: number, dow: number, n: number): string {
  if (n > 0) {
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    return addDays(first, ((dow - weekday(first) + 7) % 7) + (n - 1) * 7);
  }
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = addDays(next, -1);
  return addDays(last, -((weekday(last) - dow + 7) % 7));
}

/** A fixed-date holiday as observed: Saturday moves to Friday, Sunday to Monday. */
function observed(date: string): string {
  const d = weekday(date);
  return d === 6 ? addDays(date, -1) : d === 0 ? addDays(date, 1) : date;
}

/** The federal holidays observed in `year`, by date. */
export function federalHolidays(year: number): Map<string, string> {
  const fixed = (m: number, d: number) =>
    observed(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  return new Map([
    [fixed(1, 1), 'New Year’s Day'],
    [nthWeekday(year, 1, 1, 3), 'Martin Luther King Jr. Day'],
    [nthWeekday(year, 2, 1, 3), 'Washington’s Birthday'],
    [nthWeekday(year, 5, 1, -1), 'Memorial Day'],
    [fixed(6, 19), 'Juneteenth'],
    [fixed(7, 4), 'Independence Day'],
    [nthWeekday(year, 9, 1, 1), 'Labor Day'],
    [nthWeekday(year, 10, 1, 2), 'Columbus Day'],
    [fixed(11, 11), 'Veterans Day'],
    [nthWeekday(year, 11, 4, 4), 'Thanksgiving'],
    [fixed(12, 25), 'Christmas Day'],
  ]);
}

function holiday(date: string): string | null {
  const year = Number(date.slice(0, 4));
  // Next year's New Year's Day can be observed on Dec 31 of this one.
  return federalHolidays(year).get(date) ?? federalHolidays(year + 1).get(date) ?? null;
}

/** When the H.4.1 for the week ending `wednesday` is published: the Thursday after, or the next
 *  business day when that Thursday is a federal holiday (`movedFor` names it). */
export function h41Release(wednesday: string): { date: string; movedFor: string | null } {
  const thursday = addDays(wednesday, 1);
  const movedFor = holiday(thursday);
  let date = thursday;
  while (holiday(date) || weekday(date) === 0 || weekday(date) === 6) date = addDays(date, 1);
  return { date, movedFor };
}

/** `now` as a wall-clock "YYYY-MM-DD HH:MM" in New York, where the Fed's 4:30 PM is set. */
export function easternClock(now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export type H41Status =
  | { state: 'onTime' }
  /** The next week's H.4.1 would normally be out by now, but the Fed moved it for a holiday. */
  | { state: 'delayed'; week: string; releases: string; holiday: string };

/**
 * Whether the frame, showing the week to `asOf`, is behind because the Fed moved the next release.
 * Only the source's own move counts: past the moved release with no new week, the delay is ours, and
 * the API's own staleness note says so instead.
 */
export function h41Status(asOf: string, now: Date): H41Status {
  const week = addDays(asOf, 7);
  const usual = addDays(week, 1);
  const release = h41Release(week);
  const clock = easternClock(now);
  if (release.movedFor && clock >= `${usual} 16:30` && clock < `${release.date} 16:30`)
    return { state: 'delayed', week, releases: release.date, holiday: release.movedFor };
  return { state: 'onTime' };
}

/**
 * Days the Treasury's cash account typically jumps: corporate estimated income tax is due on the
 * 15th of the 4th, 6th, 9th and 12th months (IRS Publication 509, Tax Calendars, and the Form 1120-W
 * instructions), moved to the next business day when the 15th is a weekend or holiday (26 U.S.C.
 * 7503). A dated table like fomc.ts: checked Oct 15, 2026.
 */
export const TAX_DATES: string[] = [
  '2025-04-15',
  '2025-06-16',
  '2025-09-15',
  '2025-12-15',
  '2026-04-15',
  '2026-06-15',
  '2026-09-15',
  '2026-12-15',
  '2027-04-15',
  '2027-06-15',
  '2027-09-15',
  '2027-12-15',
];
export const TAX_SOURCE = 'https://www.irs.gov/publications/p509';

export type LiquidityMark = {
  kind: 'quarter' | 'fomc' | 'tax';
  /** The event's own date. */
  date: string;
  /** The week (index into the series) whose H.4.1 Wednesday is the first on or after it. */
  index: number;
  label: string;
};

const QUARTER_ENDS = ['03-31', '06-30', '09-30', '12-31'];

/** The quarter ends, FOMC decisions and tax dates inside a weekly series of H.4.1 Wednesdays (oldest
 *  first), each on the first week whose figures include it. */
export function liquidityMarks(weeks: string[]): LiquidityMark[] {
  if (weeks.length === 0) return [];
  const first = addDays(weeks[0], -6);
  const last = weeks[weeks.length - 1];
  const place = (date: string) => weeks.findIndex((w) => w >= date);
  const years = Array.from(
    { length: Number(last.slice(0, 4)) - Number(first.slice(0, 4)) + 1 },
    (_, i) => Number(first.slice(0, 4)) + i,
  );
  const events: Omit<LiquidityMark, 'index'>[] = [
    ...years.flatMap((y) =>
      QUARTER_ENDS.map((md) => ({
        kind: 'quarter' as const,
        date: `${y}-${md}`,
        label: 'Quarter end',
      })),
    ),
    ...FOMC_DECISIONS.map((m) => ({
      kind: 'fomc' as const,
      date: m.date,
      label: m.sep ? 'FOMC decision · projections' : 'FOMC decision',
    })),
    ...TAX_DATES.map((date) => ({ kind: 'tax' as const, date, label: 'Corporate tax date' })),
  ];
  return events
    .filter((e) => e.date >= first && e.date <= last)
    .map((e) => ({ ...e, index: place(e.date) }))
    .filter((e) => e.index >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
