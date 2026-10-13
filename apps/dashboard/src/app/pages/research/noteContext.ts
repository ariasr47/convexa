import { createContext, useContext } from 'react';
import type { NoteSource } from './provenance';
import type { Freshness, ValuationBlock } from './types';

/** What a block needs from the note around it: today's date (the reader's), the note's freshness, its
 *  valuation (the `implied` block and the price-vs-value strip draw from it), and its sources (a figure
 *  shows the first one it cites as a provenance chip). */
export type NoteCtx = {
  today: string;
  freshness: Freshness;
  valuation: ValuationBlock | null;
  sources: NoteSource[];
};

export const NoteContext = createContext<NoteCtx | null>(null);

export function useNoteContext(): NoteCtx {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error('A research block rendered outside its note.');
  return ctx;
}
