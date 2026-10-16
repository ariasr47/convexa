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

/**
 * What each scheduled decision did to the federal funds target range, copied from that day's FOMC
 * statement on federalreserve.gov (the "decided to lower / maintain / raise the target range" line),
 * each row citing its statement. Every scheduled decision from 2024-01-31 to the check date is here,
 * which covers any window the 2s10s chart can draw (a year back from the latest Treasury day). The
 * notation vote of 2025-08-22 (the Statement on Longer-Run Goals) set no rate and is not listed.
 * A decision after the check date has no row until it is copied from its statement: the chart then
 * draws its mark without an outcome, never a guessed one.
 */
export type FomcOutcome = {
  date: string;
  /** The change to the target range, in basis points: −25 a cut, 0 a hold, +25 a hike. */
  moveBp: number;
  /** The target range after the decision, percent, as the statement states it. */
  range: [number, number];
  statement: string;
};
export const FOMC_OUTCOMES_CHECKED = '2026-10-16';

const STATEMENT = (date: string) =>
  `https://www.federalreserve.gov/newsevents/pressreleases/monetary${date.replaceAll('-', '')}a.htm`;
const row = (date: string, moveBp: number, lo: number, hi: number): FomcOutcome => ({
  date,
  moveBp,
  range: [lo, hi],
  statement: STATEMENT(date),
});

export const FOMC_OUTCOMES: FomcOutcome[] = [
  row('2024-01-31', 0, 5.25, 5.5), // maintain … at 5-1/4 to 5-1/2 percent
  row('2024-03-20', 0, 5.25, 5.5), // maintain … at 5-1/4 to 5-1/2 percent
  row('2024-05-01', 0, 5.25, 5.5), // maintain … at 5-1/4 to 5-1/2 percent
  row('2024-06-12', 0, 5.25, 5.5), // maintain … at 5-1/4 to 5-1/2 percent
  row('2024-07-31', 0, 5.25, 5.5), // maintain … at 5-1/4 to 5-1/2 percent
  row('2024-09-18', -50, 4.75, 5.0), // lower … by 1/2 percentage point to 4-3/4 to 5 percent
  row('2024-11-07', -25, 4.5, 4.75), // lower … by 1/4 percentage point to 4-1/2 to 4-3/4 percent
  row('2024-12-18', -25, 4.25, 4.5), // lower … by 1/4 percentage point to 4-1/4 to 4-1/2 percent
  row('2025-01-29', 0, 4.25, 4.5), // maintain … at 4-1/4 to 4-1/2 percent
  row('2025-03-19', 0, 4.25, 4.5), // maintain … at 4-1/4 to 4-1/2 percent
  row('2025-05-07', 0, 4.25, 4.5), // maintain … at 4-1/4 to 4-1/2 percent
  row('2025-06-18', 0, 4.25, 4.5), // maintain … at 4-1/4 to 4-1/2 percent
  row('2025-07-30', 0, 4.25, 4.5), // maintain … at 4-1/4 to 4-1/2 percent
  row('2025-09-17', -25, 4.0, 4.25), // lower … by 1/4 percentage point to 4 to 4-1/4 percent
  row('2025-10-29', -25, 3.75, 4.0), // lower … by 1/4 percentage point to 3-3/4 to 4 percent
  row('2025-12-10', -25, 3.5, 3.75), // lower … by 1/4 percentage point to 3-1/2 to 3-3/4 percent
  row('2026-01-28', 0, 3.5, 3.75), // maintain … at 3-1/2 to 3-3/4 percent
  row('2026-03-18', 0, 3.5, 3.75), // maintain … at 3-1/2 to 3-3/4 percent
  row('2026-04-29', 0, 3.5, 3.75), // maintain … at 3-1/2 to 3-3/4 percent
  row('2026-06-17', 0, 3.5, 3.75), // maintain … at 3-1/2 to 3-3/4 percent
  row('2026-07-29', 0, 3.5, 3.75), // maintain … at 3-1/2 to 3-3/4 percent
  row('2026-09-16', 25, 3.75, 4.0), // raise … by 1/4 percentage point to 3-3/4 to 4 percent
];

/** The outcome copied from a decision day's statement, or null when the table has none. */
export function fomcOutcome(date: string): FomcOutcome | null {
  return FOMC_OUTCOMES.find((o) => o.date === date) ?? null;
}

/** The lane's short label: "−25", "Hold", "+25" (basis points, a true minus sign). */
export function outcomeLabel(o: FomcOutcome): string {
  if (o.moveBp === 0) return 'Hold';
  return `${o.moveBp > 0 ? '+' : '−'}${Math.abs(o.moveBp)}`;
}

/** The table twin's words: "cut 25 bp to 3.75–4.00%", "held at 3.50–3.75%". */
export function outcomeWords(o: FomcOutcome): string {
  const range = `${o.range[0].toFixed(2)}–${o.range[1].toFixed(2)}%`;
  if (o.moveBp === 0) return `held at ${range}`;
  return `${o.moveBp > 0 ? 'raised' : 'cut'} ${Math.abs(o.moveBp)} bp to ${range}`;
}

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
