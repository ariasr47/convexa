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
