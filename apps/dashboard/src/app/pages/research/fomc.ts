/**
 * Scheduled FOMC meetings, by the day the decision is announced (each meeting's second day). The
 * Federal Reserve publishes these a year or more ahead, so they are a dated table here rather
 * than a fetch: copied from the Fed's calendar page and checked on the date below. `sep` marks the
 * meetings that also publish the Summary of Economic Projections. Notation votes and unscheduled
 * meetings are not listed.
 */
export const FOMC_SOURCE = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
export const FOMC_CHECKED = '2026-10-14';

export const FOMC_DECISIONS: { date: string; sep: boolean }[] = [
  { date: '2024-01-31', sep: false },
  { date: '2024-03-20', sep: true },
  { date: '2024-05-01', sep: false },
  { date: '2024-06-12', sep: true },
  { date: '2024-07-31', sep: false },
  { date: '2024-09-18', sep: true },
  { date: '2024-11-07', sep: false },
  { date: '2024-12-18', sep: true },
  { date: '2025-01-29', sep: false },
  { date: '2025-03-19', sep: true },
  { date: '2025-05-07', sep: false },
  { date: '2025-06-18', sep: true },
  { date: '2025-07-30', sep: false },
  { date: '2025-09-17', sep: true },
  { date: '2025-10-29', sep: false },
  { date: '2025-12-10', sep: true },
  { date: '2026-01-28', sep: false },
  { date: '2026-03-18', sep: true },
  { date: '2026-04-29', sep: false },
  { date: '2026-06-17', sep: true },
  { date: '2026-07-29', sep: false },
  { date: '2026-09-16', sep: true },
  { date: '2026-10-28', sep: false },
  { date: '2026-12-09', sep: true },
  { date: '2027-01-27', sep: false },
  { date: '2027-03-17', sep: true },
  { date: '2027-04-28', sep: false },
  { date: '2027-06-09', sep: true },
  { date: '2027-07-28', sep: false },
  { date: '2027-09-15', sep: true },
  { date: '2027-10-27', sep: false },
  { date: '2027-12-08', sep: true },
];

/** The decisions inside a daily series (oldest first), each placed on the first day the series has
 *  on or after it (a decision lands after the close on a trading day, or before the next one). */
export function fomcInSeries(dates: string[]): { date: string; index: number; sep: boolean }[] {
  if (dates.length === 0) return [];
  const last = dates[dates.length - 1];
  return FOMC_DECISIONS.filter((m) => m.date >= dates[0] && m.date <= last).flatMap((m) => {
    const index = dates.findIndex((d) => d >= m.date);
    return index < 0 ? [] : [{ ...m, index }];
  });
}
