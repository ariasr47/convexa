/**
 * Coming up (design: Planned · Calendar, CALENDAR_SPEC): the next six weeks of macro releases and
 * the followed companies' results, in three kinds that never look alike — a release on an agency's
 * published schedule, a results date the note gives, and a window estimated from the company's
 * filing history. A note's own date always beats an estimate for the same company.
 *
 * Pure: the section (ComingUpSection.tsx) feeds it the API's answers and the notes' dates.
 */
import type { ChartStatus } from '@/shared/charts/frame/frameTitle';
import { sourceStateWord, type DataStateKey } from '@/shared/dataState/vocabulary';
import type {
  PublicCalendar,
  PublicDataState,
  PublicFilings,
  PublicRelease,
  PublicResultsWindow,
  PublicSource,
} from '@convexa/api';
import type { AgingEvent } from './types';

export type CalKind = 'macro' | 'note' | 'est';

export interface CalEvent {
  /** YYYY-MM-DD the event is placed on (an estimate: its window's start, or the first day shown). */
  date: string;
  /** An estimate's last day. */
  end: string | null;
  label: string;
  /** Who says so: "BLS · 8:30 AM ET", "From the note", "Estimated from filing history · …". */
  source: string;
  kind: CalKind;
  /** What it makes due: a ticker (its note), or every valued note for the FOMC. */
  due: string | null;
  /** The date the agency had published before it moved the release. */
  movedFrom: string | null;
  ticker: string | null;
}

export interface CalWeek {
  /** Monday. */
  start: string;
  /** Friday. */
  end: string;
  events: CalEvent[];
}

/** A results date a note gives: one day, or a range (a window, a month) from `date` to `end`. */
export interface NoteResult {
  ticker: string;
  date: string;
  /** The range's last day; absent or equal to `date` for a single day. */
  end?: string | null;
  label: string;
}

const RESULTS = /\bresults\b|\bearnings\b/i;
/** A reporting period at the start of the label: Q3, FQ1-27, 3Q26, FY2027, H1, 1H26. */
const OWN_PERIOD = /^(F?Q[1-4]|[1-4]Q\d{2}|FY\d{2,4}|H[12]|[12]H\d{2})\b/;

/**
 * Whether a note's catalyst is the note company's own results: the label names results and opens on
 * the company's reporting period ("Q3 2026 results", "FQ1-27 results", "3Q26 results and 4Q26 guide",
 * "FY2027 results and FY2028 outlook"). A label that only mentions results is something else: another
 * company's report ("Broadcom FQ4-26 results") or an event pinned to one ("Lock-up tranche after Q3
 * results"). Read as the company's own date, those draw a row it doesn't have and count it as
 * reporting when it isn't.
 */
export const isOwnResults = (label: string): boolean =>
  RESULTS.test(label) && OWN_PERIOD.test(label.trim());

/**
 * The results dates in a note's own catalysts: unresolved, with a start and an end, whatever their
 * kind. A day is a day; a window ("Oct 27–30") or a month ("Nov 2026") is a range. Keeping only days
 * dropped AMZN, CRWV, SPCX and CBRS from the calendar (W1-38).
 */
export function noteResultsOf(ticker: string, events: readonly AgingEvent[]): NoteResult[] {
  return events
    .filter(
      (e) =>
        e.kind === 'catalyst' &&
        !e.resolved &&
        !!e.when.start &&
        !!e.when.end &&
        e.when.start <= e.when.end &&
        isOwnResults(e.label),
    )
    .map((e) => ({
      ticker,
      date: e.when.start as string,
      end: e.when.end === e.when.start ? null : e.when.end,
      label: e.label,
    }));
}

const DAY_MS = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => iso(ms(day) + n * DAY_MS);
/** The Monday of `day`'s week. */
export const mondayOf = (day: string) => addDays(day, -((new Date(ms(day)).getUTCDay() + 6) % 7));

const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const shortDay = (day: string) => SHORT.format(new Date(ms(day)));

/** "08:30" → "8:30 AM". */
export function clock12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const KIND_ORDER: Record<CalKind, number> = { macro: 0, note: 1, est: 2 };

export const WEEKS = 6;

export function buildComingUp({
  today,
  releases,
  noteResults,
  windows,
  followed,
  demo = false,
}: {
  today: string;
  releases: readonly PublicRelease[];
  noteResults: readonly NoteResult[];
  windows: readonly PublicResultsWindow[];
  followed: readonly string[];
  demo?: boolean;
}): { weeks: CalWeek[]; from: string; to: string; reporting: string[]; fomc: string | null } {
  const from = mondayOf(today);
  const to = addDays(from, WEEKS * 7 - 1);
  const inRange = (d: string) => d >= from && d <= to;
  const follows = new Set(followed);
  const events: CalEvent[] = [];

  for (const r of releases) {
    if (!inRange(r.date)) continue;
    const fomc = r.name === 'FOMC statement';
    events.push({
      date: r.date,
      end: null,
      label: r.name,
      source: demo ? 'Sample schedule' : `${r.agency}${r.time ? ` · ${clock12(r.time)} ET` : ''}`,
      kind: 'macro',
      due: fomc ? (demo ? 'every sample note' : 'every valued note') : null,
      movedFrom: r.moved_from ?? null,
      ticker: null,
    });
  }

  // A note's date for a company wins over any estimate for it: any results date of its own still
  // ahead, inside the six weeks or after them (an estimate must never contradict the note).
  const dated = new Set<string>();
  for (const n of noteResults) {
    if (!follows.has(n.ticker)) continue;
    const end = n.end ?? n.date;
    if (end >= today) dated.add(n.ticker);
    // Drawn when any part of it falls in the six weeks; a range that opened earlier sits on Monday.
    if (end < from || n.date > to) continue;
    events.push({
      date: n.date < from ? from : n.date,
      end: end === n.date ? null : end,
      label: `${n.ticker} ${n.label}`,
      source: demo ? 'Sample date' : 'From the note',
      kind: 'note',
      due: n.ticker,
      movedFrom: null,
      ticker: n.ticker,
    });
  }

  for (const w of windows) {
    if (!follows.has(w.ticker) || dated.has(w.ticker)) continue;
    if (w.end < from || w.start > to || w.end < today) continue;
    const basis = (w.basis ?? []).map(shortDay);
    const why =
      w.basis_kind === 'periodic_reports'
        ? `from its 10-Q and 10-K dates · last ${basis.length}: ${basis.join(', ')}`
        : `last ${basis.length}: ${basis.join(', ')}`;
    events.push({
      date: w.start < from ? from : w.start,
      end: w.end,
      label: `${w.ticker} results`,
      source: demo ? 'Sample window' : `Estimated from filing history · ${why}`,
      kind: 'est',
      due: w.ticker,
      movedFrom: null,
      ticker: w.ticker,
    });
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.label.localeCompare(b.label),
  );
  // The columns are Monday to Friday: a range that opens on a weekend (CBRS's "Nov 2026" from Sun
  // Nov 1) belongs to the week after, never the column that ended the Friday before. The last
  // weekend stays in the last column.
  const last = addDays(from, (WEEKS - 1) * 7);
  const columnOf = (day: string) => {
    const weekday = new Date(ms(day)).getUTCDay();
    const monday = weekday === 0 || weekday === 6 ? addDays(mondayOf(day), 7) : mondayOf(day);
    return monday > last ? last : monday;
  };
  const weeks: CalWeek[] = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(from, i * 7);
    return {
      start,
      end: addDays(start, 4),
      events: events.filter((e) => columnOf(e.date) === start),
    };
  });
  // The claim counts companies still to report: a results date earlier this week stays in its
  // column (it may still make a note due) but has already happened (W1-36).
  const reporting = [
    ...new Set(
      events
        .filter((e) => e.ticker !== null && (e.end ?? e.date) >= today)
        .map((e) => e.ticker as string),
    ),
  ].sort();
  const fomc = events.find((e) => e.label === 'FOMC statement' && e.date >= today)?.date ?? null;
  return { weeks, from, to, reporting, fomc };
}

/** Where the estimated results windows stand this cycle (PublicFilings, through usePublicFilings). */
export interface SecEstimates {
  /** The SEC part's state word for the frame's tag, or null when it has nothing to add. */
  word: DataStateKey | null;
  /** The estimates are missing: our request failed, EDGAR didn't answer, or an API from before
   *  the windows sent none. Unknown, not empty. */
  missing: boolean;
  /** SEC isn't set up on this server: the notes' dates are all there is, by design. */
  notSet: boolean;
}

export function secEstimates({
  demo,
  loading,
  error,
  data,
}: {
  demo: boolean;
  loading: boolean;
  error: string | null;
  data: PublicFilings | null;
}): SecEstimates {
  if (demo) return { word: null, missing: false, notSet: false };
  const row = data?.sources?.find((r) => r.id === 'sec');
  const notSet = data?.state === 'not_configured' || row?.state === 'not_set_up';
  const word: DataStateKey | null = error
    ? 'couldntLoad'
    : data?.state === 'unavailable' || row?.state === 'source_down'
      ? 'sourceDown'
      : notSet
        ? 'notSetUp'
        : row?.state === 'last_good'
          ? 'lastGood'
          : null;
  const missing =
    !loading &&
    !notSet &&
    (word === 'couldntLoad' ||
      word === 'sourceDown' ||
      (data?.state === 'live' && data.results === undefined));
  return { word, missing, notSet };
}

/**
 * The frame's title state, tag and whether its count is a floor. Unknowns are never stated as
 * facts (W1-37): every schedule down with nothing in the grid says the dates are unknown, not
 * "Nothing scheduled"; an EDGAR outage tags the frame and makes the claim "at least". Off is
 * checked before the missing calendar, since PUBLIC_DATA=off also sends calendar:null (W1-39).
 */
export function comingUpState({
  demo,
  loading,
  markets,
  schedules,
  sec,
  count,
}: {
  demo: boolean;
  loading: boolean;
  /** null: Convexa's server didn't answer. */
  markets: { state: PublicDataState; calendar: PublicCalendar | null } | null;
  /** The four schedule rows of PublicMarkets.sources. */
  schedules: readonly PublicSource[];
  sec: SecEstimates;
  /** Events in the grid. */
  count: number;
}): {
  status: ChartStatus;
  tag: { state: DataStateKey; detail?: string } | undefined;
  atLeast: boolean;
} {
  const off = markets?.state === 'off';
  const schedulesDown = !demo && !!markets && !off && markets.calendar === null;
  const status: ChartStatus = loading
    ? { kind: 'loading' }
    : !markets
      ? {
          kind: 'message',
          tone: 'warn',
          text: 'The calendar didn’t load.',
          cause: 'Convexa’s server didn’t answer. Each note still lists its own dates.',
        }
      : off
        ? {
            kind: 'message',
            tone: 'quiet',
            text: 'Public data is switched off on this server.',
            cause:
              'The agencies’ schedules come through Convexa’s API, which has them turned off. Each note still lists its own dates.',
          }
        : count === 0 && schedulesDown
          ? {
              kind: 'message',
              tone: 'warn',
              text: 'The agencies’ schedules didn’t answer; dates are unknown.',
              cause: sec.missing
                ? 'Results estimates from SEC filings are missing this cycle too. Each note still lists its own dates.'
                : 'No note gives a results date in the next six weeks. Each note still lists its own dates.',
            }
          : count === 0 && (sec.missing || sec.notSet)
            ? {
                kind: 'message',
                tone: sec.missing ? 'warn' : 'quiet',
                text: 'No dates known for the next six weeks.',
                cause: sec.missing
                  ? 'Results estimates from SEC filings are missing this cycle, so a company’s results could still fall here. No note gives a date in these weeks.'
                  : 'Results estimates need SEC filings, which aren’t set up on this site yet. No note gives a date in these weeks.',
              }
            : count === 0
              ? {
                  kind: 'message',
                  tone: 'quiet',
                  text: 'Nothing scheduled in the next six weeks.',
                  cause:
                    'Fed, BLS, BEA and Treasury releases and the followed companies’ results appear here as their dates are set.',
                }
              : { kind: 'ready' };
  const tag = demo
    ? ({ state: 'demo' } as const)
    : off
      ? ({ state: 'off' } as const)
      : schedulesDown
        ? ({ state: 'sourceDown', detail: 'schedules' } as const)
        : schedules.length
          ? scheduleTag(schedules, sec.word)
          : undefined;
  return { status, tag, atLeast: !demo && (sec.missing || sec.notSet) };
}

/** The worst of the four schedule rows and of the SEC part the estimated windows come from. */
function scheduleTag(
  rows: readonly PublicSource[],
  sec: DataStateKey | null,
): { state: DataStateKey; detail?: string } {
  const words = rows.map((r) => sourceStateWord(r.state));
  if (sec === 'couldntLoad') return { state: 'couldntLoad', detail: 'filings' };
  for (const worst of ['sourceDown', 'lastGood', 'notSetUp', 'off'] as const) {
    if (words.includes(worst)) return { state: worst };
    if (sec === worst) return { state: worst, detail: 'SEC EDGAR' };
  }
  const read = rows
    .map((r) => r.checked_at)
    .filter((t): t is string => !!t)
    .sort()[0];
  return { state: 'updated', detail: read ? `read ${shortDay(read)}` : undefined };
}
