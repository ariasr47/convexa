/**
 * Pin-equality for the scanner badge NYSE full-day replica.
 * Test-only generator mirrors B.domain (`nyse_full_day.rs`); production lookup is Set.has.
 */
import { describe, expect, it } from 'vitest';
import { NYSE_FULL_DAY_HOLIDAYS, isNyseFullDayHolidayIso } from './nyseFullDayHolidays';

type Ymd = readonly [number, number, number];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso([y, m, d]: Ymd): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function weekdayUtc([y, m, d]: Ymd): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays([y, m, d]: Ymd, delta: number): Ymd {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}

function keepIfSpan(out: string[], date: Ymd): void {
  const [y] = date;
  if (y >= 2020 && y <= 2032) out.push(toIso(date));
}

function pushObserved(out: string[], y: number, m: number, day: number): void {
  const date: Ymd = [y, m, day];
  const wd = weekdayUtc(date);
  let observed = date;
  if (wd === 6) observed = addDays(date, -1);
  else if (wd === 0) observed = addDays(date, 1);
  keepIfSpan(out, observed);
}

/** `wd`: JS Sunday=0 … Saturday=6. */
function pushNthWeekday(out: string[], y: number, m: number, n: number, wd: number): void {
  let seen = 0;
  for (let d = 1; d <= 31; d++) {
    const date: Ymd = [y, m, d];
    if (new Date(Date.UTC(y, m - 1, d)).getUTCMonth() + 1 !== m) break;
    if (weekdayUtc(date) === wd) {
      seen += 1;
      if (seen === n) {
        keepIfSpan(out, date);
        return;
      }
    }
  }
  throw new Error(`nth weekday not found ${y}-${m} n=${n}`);
}

function pushLastWeekday(out: string[], y: number, m: number, wd: number): void {
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  let cur = addDays([nextY, nextM, 1], -1);
  while (weekdayUtc(cur) !== wd) cur = addDays(cur, -1);
  keepIfSpan(out, cur);
}

/** Anonymous Gregorian (Meeus/Jones/Butcher). Easter Sunday → minus 2 days. */
function pushGoodFriday(out: string[], y: number): void {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const dd = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  keepIfSpan(out, addDays([y, month, day], -2));
}

/** Test-only generator — same rules as Rust `generated_regular_nyse_full_days`. */
export function generatedRegularNyseFullDays(): string[] {
  const out: string[] = [];
  for (let y = 2019; y <= 2033; y++) {
    pushObserved(out, y, 1, 1);
    pushNthWeekday(out, y, 1, 3, 1); // MLK
    pushNthWeekday(out, y, 2, 3, 1); // Washington's Birthday
    pushGoodFriday(out, y);
    pushLastWeekday(out, y, 5, 1); // Memorial
    if (y >= 2022) pushObserved(out, y, 6, 19); // Juneteenth
    pushObserved(out, y, 7, 4); // Independence
    pushNthWeekday(out, y, 9, 1, 1); // Labor
    pushNthWeekday(out, y, 11, 4, 4); // Thanksgiving
    pushObserved(out, y, 12, 25); // Christmas
  }
  return [...new Set(out)].sort();
}

describe('nyseFullDayHolidays replica', () => {
  it('committed set equals the test-only generator (non-vacuous)', () => {
    const generated = generatedRegularNyseFullDays();
    expect(NYSE_FULL_DAY_HOLIDAYS.size).toBeGreaterThan(0);
    expect([...NYSE_FULL_DAY_HOLIDAYS].sort()).toEqual(generated);
  });

  it('in-set and out-set pins match B.domain', () => {
    expect(isNyseFullDayHolidayIso('2026-11-26')).toBe(true);
    expect(isNyseFullDayHolidayIso('2026-08-10')).toBe(false);
    expect(isNyseFullDayHolidayIso('2026-10-12')).toBe(false);
    expect(isNyseFullDayHolidayIso('2026-11-11')).toBe(false);
    expect(isNyseFullDayHolidayIso('2026-11-27')).toBe(false); // early close
    expect(isNyseFullDayHolidayIso('2022-06-20')).toBe(true);
    expect(isNyseFullDayHolidayIso('2021-06-18')).toBe(false);
    expect(isNyseFullDayHolidayIso('2020-06-19')).toBe(false);
    expect(isNyseFullDayHolidayIso('2019-11-28')).toBe(false);
  });
});
