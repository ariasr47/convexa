/**
 * Review triggers from the calendar (design: Planned · Calendar, CALENDAR_SPEC): the dates on
 * /research/markets#coming-up that make a note due, laid onto each note's own dates so /research and
 * the note page count them the way the calendar marks them.
 *
 * - The FOMC makes every note with a valuation due: the decision moves the discount rate the
 *   valuation starts from. Each decision after the note's date counts from the day after it, as a
 *   catalyst window does. A decision on the note's own date is taken as read.
 * - A company's estimated results window (from its EDGAR filing history) is an upcoming trigger when
 *   the note gives no results date of its own still ahead; a note's date always beats an estimate,
 *   as on the calendar. It never makes the note due by passing: the API drops a window once it is
 *   over, and the results filing landing is what makes the note due (filings.ts filedSince).
 *
 * Pure: the pages feed it the API's answers and the notes' dates.
 */
import type { PublicCalendar, PublicResultsWindow } from '@convexa/api';
import { isOwnResults } from './comingUp';
import { FOMC_DECISIONS } from './fomc';
import { formatShortDate } from './format';
import type { Aging, AgingEvent } from './types';

export const FOMC_TRIGGER = 'FOMC decision';
export const ESTIMATE_TRIGGER = 'Results, estimated from filing history';

/**
 * FOMC decision days, oldest first: the Fed's published schedule (fomc.ts, which reaches back past
 * any note), with the calendar's own reading of the same Fed page laid over it. A meeting the Fed
 * moved takes its new date (the calendar says where it moved from); a day the table doesn't list yet
 * is added. Without the calendar (loading, failed, PUBLIC_DATA=off) the table alone decides.
 */
export function fomcDays(calendar: PublicCalendar | null | undefined): string[] {
  const days = new Set(FOMC_DECISIONS.map((m) => m.date));
  for (const r of calendar?.releases ?? []) {
    if (r.name !== 'FOMC statement') continue;
    if (r.moved_from) days.delete(r.moved_from);
    days.add(r.date);
  }
  return [...days].sort();
}

const day = (date: string, label: string, end = date): AgingEvent['when'] => ({
  text: label,
  kind: date === end ? 'day' : 'window',
  start: date,
  end,
  approx: date !== end,
  label,
});

/** What the calendar contributes, once per page: fomcDays() and the API's results windows. */
export type CalendarInputs = { fomc: readonly string[]; windows: readonly PublicResultsWindow[] };

/**
 * The calendar's triggers for one note, as aging events (kind `catalyst`, so freshness() counts
 * them and upcoming() lists them beside the note's own catalysts).
 */
export function calendarTriggers({
  note,
  today,
  fomc,
  windows,
}: {
  note: { ticker: string; date: string; valued: boolean; aging: Aging };
  today: string;
  /** fomcDays(). */
  fomc: readonly string[];
  /** The API's expected results windows (PublicFilings.results); other tickers are ignored. */
  windows: readonly PublicResultsWindow[];
}): AgingEvent[] {
  const out: AgingEvent[] = [];
  if (note.valued) {
    const after = fomc.filter((d) => d > note.date);
    // Every decision since the note (each one moved the rate), and the next one ahead.
    const passed = after.filter((d) => d < today);
    const next = after.find((d) => d >= today);
    for (const d of next ? [...passed, next] : passed)
      out.push({
        kind: 'catalyst',
        label: FOMC_TRIGGER,
        when: day(d, formatShortDate(d)),
        resolved: false,
      });
  }
  const datedResults = note.aging.events.some(
    (e) =>
      e.kind === 'catalyst' &&
      !e.resolved &&
      isOwnResults(e.label) &&
      e.when.end !== null &&
      e.when.end >= today,
  );
  if (!datedResults) {
    const w = windows.find((x) => x.ticker === note.ticker && x.end >= today);
    if (w) {
      const end = formatShortDate(w.end);
      const span =
        w.start === w.end
          ? end
          : w.start.slice(0, 7) === w.end.slice(0, 7)
            ? `${formatShortDate(w.start)}–${end.split(' ')[1]}`
            : `${formatShortDate(w.start)}–${end}`;
      out.push({
        kind: 'catalyst',
        label: ESTIMATE_TRIGGER,
        when: day(w.start, span, w.end),
        resolved: false,
      });
    }
  }
  return out;
}

/** The note's aging with the calendar's triggers added. */
export function withCalendar(aging: Aging, triggers: readonly AgingEvent[]): Aging {
  return triggers.length ? { ...aging, events: [...aging.events, ...triggers] } : aging;
}

/**
 * Staging's sample notes with their review triggers (owner ruling 7, 2026-10-15: staging /research
 * Coming up follows the Calendar board). The demo has no note files, so each sample note is dated on
 * the scenario day and carries the sample results date the scenario gives it (DEMO_NOTE_RESULTS);
 * the scenario's calendar then lays on its FOMC decision (every sample note, as the Calendar board
 * says) and its estimated results windows, through the same rules as production's notes. Only the
 * scenario's own calendar is read: the Fed's real schedule (fomc.ts) stays out of the sample.
 */
export function sampleNoteAging({
  followed,
  noteResults,
  calendar,
  windows,
  today,
}: {
  followed: readonly string[];
  noteResults: readonly { ticker: string; date: string; label: string }[];
  calendar: PublicCalendar;
  windows: readonly PublicResultsWindow[];
  /** The scenario day; each sample note is dated on it. */
  today: string;
}): { ticker: string; aging: Aging }[] {
  const fomc = calendar.releases
    .filter((r) => r.name === 'FOMC statement')
    .map((r) => r.date)
    .sort();
  return followed.map((ticker) => {
    const own: Aging = {
      priceAsOf: null,
      events: noteResults
        .filter((n) => n.ticker === ticker)
        .map((n) => ({
          kind: 'catalyst' as const,
          label: n.label,
          when: day(n.date, formatShortDate(n.date)),
          resolved: false,
        })),
    };
    const triggers = calendarTriggers({
      note: { ticker, date: today, valued: true, aging: own },
      today,
      fomc,
      windows,
    });
    return { ticker, aging: withCalendar(own, triggers) };
  });
}
