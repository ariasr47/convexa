/**
 * Coming up (design: Planned · Calendar, CALENDAR_SPEC): the next six weeks of macro releases and
 * the followed companies' results, in three kinds that never look alike — a release on an agency's
 * published schedule, a results date the note gives, and a window estimated from the company's
 * filing history. A note's own date always beats an estimate for the same company.
 *
 * Pure: the section (ComingUpSection.tsx) feeds it the API's answers and the notes' dates.
 */
import type { PublicRelease, PublicResultsWindow } from '@convexa/api';

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

export interface NoteResult {
  ticker: string;
  date: string;
  label: string;
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

  // A note's date for a company wins over any estimate for it.
  const dated = new Set<string>();
  for (const n of noteResults) {
    if (!follows.has(n.ticker) || !inRange(n.date)) continue;
    dated.add(n.ticker);
    events.push({
      date: n.date,
      end: null,
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
  const weeks: CalWeek[] = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(from, i * 7);
    const next = addDays(start, 7);
    return {
      start,
      end: addDays(start, 4),
      events: events.filter((e) => e.date >= start && e.date < next),
    };
  });
  const reporting = [
    ...new Set(events.filter((e) => e.ticker !== null).map((e) => e.ticker as string)),
  ].sort();
  const fomc = events.find((e) => e.label === 'FOMC statement' && e.date >= today)?.date ?? null;
  return { weeks, from, to, reporting, fomc };
}
