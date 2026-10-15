import { formatNoteDate } from '../format';
import { useNoteContext } from '../noteContext';

/** What every chart frame in a note shares: a solid border (notes render on production only, from
 *  the owner's primary sources), the note as the source, its date as the as-of, and a test id. */
export function useNoteFrame(type?: string) {
  const { ticker, date } = useNoteContext();
  return {
    testId: type ? `note-${type}` : undefined,
    provenance: 'primary' as const,
    source: { text: `${ticker} note · figures as cited in its sources` },
    asOf: `Note of ${formatNoteDate(date)}`,
  };
}
