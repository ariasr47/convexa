import { useCallback, useEffect, useRef, useState } from 'react';
import { researchUrl } from 'virtual:convexa-research';
import type { ResearchNote } from './types';

export type NotesState =
  | { phase: 'loading' }
  | { phase: 'none' }
  | { phase: 'error'; detail: string }
  | { phase: 'ready'; notes: ResearchNote[] };

/** Every published note for `ticker`, newest first. Notes ship as a static JSON asset per ticker. */
export function useTickerNotes(ticker: string) {
  const [state, setState] = useState<NotesState>({ phase: 'loading' });
  const requestRef = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    const url = researchUrl(ticker);
    if (!url) {
      setState({ phase: 'none' });
      return;
    }
    setState({ phase: 'loading' });
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const notes = (await response.json()) as unknown;
      if (requestId !== requestRef.current) return;
      if (!Array.isArray(notes)) throw new Error('unexpected response');
      setState(
        notes.length ? { phase: 'ready', notes: notes as ResearchNote[] } : { phase: 'none' },
      );
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState({
        phase: 'error',
        detail: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }, [ticker]);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, retry: load };
}
