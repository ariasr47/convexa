/**
 * How a filing relates to a note: already cited, new since the note was written, or simply not used.
 * A results or periodic filing that is new since the note makes it due (freshness `filed`): new figures
 * exist that the note hasn't read.
 */

/** The fields of a `FilingWire` this needs. */
export type FilingLike = {
  accession: string;
  form: string;
  kind: 'results' | 'periodic' | 'financing' | 'ownership' | 'other';
  filed: string;
};

export type FilingStanding = 'cited' | 'new' | 'unused';

export function standing(
  filing: FilingLike,
  note: { date: string; accessions: string[] },
): FilingStanding {
  if (note.accessions.includes(filing.accession)) return 'cited';
  return filing.filed > note.date ? 'new' : 'unused';
}

/** The filings that make a note due, as freshness events: results and periodic reports filed after
 *  the note's date that it doesn't cite. A same-day filing is assumed already read. */
export function filedSince(
  filings: FilingLike[],
  note: { date: string; accessions: string[] },
): { date: string; label: string }[] {
  return filings
    .filter((f) => (f.kind === 'results' || f.kind === 'periodic') && standing(f, note) === 'new')
    .map((f) => ({
      date: f.filed,
      label: f.kind === 'results' ? `${f.form} results filed` : `${f.form} filed`,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * A reported figure against its prior period, as the filing detail shows it: "▲ 106%", "▼ 12%". The
 * change is measured against the prior's size, so a loss that narrows reads as a rise; with no prior,
 * or a prior of zero, there is no percentage to give. Neutral: the arrow carries the sign (P-11).
 */
export function figureChange(prior: number | null | undefined, value: number): string | null {
  if (prior == null || prior === 0 || !Number.isFinite(prior) || !Number.isFinite(value))
    return null;
  const change = ((value - prior) / Math.abs(prior)) * 100;
  const size = Math.abs(change);
  const shown = size < 10 ? size.toFixed(1) : String(Math.round(size));
  if (Number(shown) === 0) return '± 0%';
  return `${change > 0 ? '▲' : '▼'} ${shown}%`;
}
