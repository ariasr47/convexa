// A results or periodic filing made after a note, and not cited by it, turns the note "review due".
// Getting this wrong is silent: a stale note shown current, or a current one nagging. Each rule pinned.
import { describe, expect, it } from 'vitest';
import { figureChange, filedSince, standing, type FilingLike } from './filings';

const note = { date: '2026-10-13', accessions: ['0000723125-26-000018'] };
const f = (
  accession: string,
  form: string,
  kind: FilingLike['kind'],
  filed: string,
): FilingLike => ({
  accession,
  form,
  kind,
  filed,
});

describe('filings against a note', () => {
  it('reads cited, new and unused from the accession and the date', () => {
    expect(standing(f('0000723125-26-000018', '8-K', 'results', '2026-09-30'), note)).toBe('cited');
    expect(standing(f('0000723125-26-000099', '10-Q', 'periodic', '2026-10-14'), note)).toBe('new');
    expect(standing(f('0000723125-26-000050', '8-K', 'other', '2026-10-01'), note)).toBe('unused');
  });

  it('makes the note due only for new results and periodic filings, oldest first', () => {
    const filings = [
      f('a', '10-Q', 'periodic', '2026-10-20'),
      f('b', '8-K', 'results', '2026-10-15'),
      f('c', '8-K', 'financing', '2026-10-16'), // a deal is news, but not new figures
      f('d', '8-K', 'results', '2026-10-13'), // same day as the note: assumed read
      f('0000723125-26-000018', '8-K', 'results', '2026-10-20'), // cited: already in the note
    ];
    expect(filedSince(filings, note)).toEqual([
      { date: '2026-10-15', label: '8-K results filed' },
      { date: '2026-10-20', label: '10-Q filed' },
    ]);
  });
});

describe('a reported figure against its prior period', () => {
  // The change column is a number a reader acts on; a wrong sign or a division by zero is silent.
  it('gives the change on the prior’s size, with the arrow carrying the sign', () => {
    expect(figureChange(46_743, 96_221)).toBe('▲ 106%'); // NVDA revenue, more than doubled
    expect(figureChange(100, 88)).toBe('▼ 12%');
    expect(figureChange(2.0, 2.1)).toBe('▲ 5.0%'); // under 10%: one decimal
  });

  it('reads a narrowing loss as a rise, and a deepening one as a fall', () => {
    expect(figureChange(-200, -100)).toBe('▲ 50%');
    expect(figureChange(-100, -150)).toBe('▼ 50%');
  });

  it('gives nothing to divide by as no change at all, and flat as ± 0%', () => {
    expect(figureChange(null, 10)).toBeNull();
    expect(figureChange(undefined, 10)).toBeNull();
    expect(figureChange(0, 10)).toBeNull();
    expect(figureChange(1_000_000, 1_000_100)).toBe('± 0%');
  });
});
