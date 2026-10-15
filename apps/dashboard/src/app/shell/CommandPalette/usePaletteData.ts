/**
 * `usePaletteData` — what the ⌘K palette lists besides its go-to commands, read once per OPEN
 * (the dialog is not `keepMounted`; a fresh open reads again, and nothing polls).
 *
 * - Production (live build): tickers BY NAME — the owner-curated universe (GET /api/scan/universe,
 *   a static config read that needs no feed) plus every ticker with a research note — and the
 *   research notes from the build's index. It never calls GET /api/scan: scores need the options
 *   feed, which this site doesn't run (shell-site.mjs, “Production ⌘K … never calls the scan”).
 * - Staging (demo build): tickers RANKED by the demo's sample scan (the demo transport answers
 *   getScan(); nothing leaves the browser) and the six authored sample notes.
 *
 * `tickers.phase` is `loading` only until the first answer and never re-entered; a failed read
 * becomes `failed` (the palette says “Couldn’t search tickers right now.” and keeps the go-to
 * commands and notes). The notes come from a lazy chunk so the research index stays out of the
 * shell's own bundle.
 */
import { STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import {
  dataMode,
  getScan,
  getScanUniverse,
  type ScanRow,
  type SweepHeartbeat,
} from '@convexa/api';
import { useEffect, useState } from 'react';

export interface PaletteTicker {
  symbol: string;
  /** Company name, when a research note names it. */
  name: string | null;
  hasNote: boolean;
  /** Staging only: the sample scan's row, for its score and freshness. */
  row: ScanRow | null;
}

export interface PaletteNote {
  ticker: string;
  title: string;
  /** YYYY-MM-DD, or null for the demo's sample notes. */
  date: string | null;
  to: string;
}

type Phase<T> = { phase: 'loading' } | { phase: 'ready'; items: T[] } | { phase: 'failed' };

export interface PaletteData {
  tickers: Phase<PaletteTicker>;
  notes: Phase<PaletteNote>;
  sweep: SweepHeartbeat | null;
  /** Whether tickers are ranked by a (sample) scan or listed by name. */
  ranked: boolean;
}

const DEMO_NOTES: PaletteNote[] = STAGING_DEMO_SYMBOLS.map((ticker) => ({
  ticker,
  title: 'Sample research note',
  date: null,
  to: `/ticker/${ticker}/research`,
}));

const LOADING: PaletteData = {
  tickers: { phase: 'loading' },
  notes: { phase: 'loading' },
  sweep: null,
  ranked: dataMode === 'demo',
};

type IndexRow = {
  ticker: string;
  latest: { title: string; company: string | null; date: string; updated: string | null };
};

/** Universe symbols plus noted tickers, one row each, A→Z. */
export function tickersByName(
  universe: readonly string[],
  notes: readonly IndexRow[],
): PaletteTicker[] {
  const byTicker = new Map<string, PaletteTicker>();
  for (const symbol of universe) {
    const s = symbol.trim().toUpperCase();
    if (s) byTicker.set(s, { symbol: s, name: null, hasNote: false, row: null });
  }
  for (const n of notes) {
    const s = n.ticker.toUpperCase();
    byTicker.set(s, { symbol: s, name: n.latest.company, hasNote: true, row: null });
  }
  return [...byTicker.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** Highest score first; rows with no score keep their order at the end. */
export function byScore(rows: readonly ScanRow[]): ScanRow[] {
  return [...rows].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
}

export function usePaletteData(active: boolean): PaletteData {
  const [data, setData] = useState<PaletteData>(LOADING);

  useEffect(() => {
    if (!active) {
      setData(LOADING);
      return;
    }
    let cancelled = false;
    const set = (patch: Partial<PaletteData>) => {
      if (!cancelled) setData((prev) => ({ ...prev, ...patch }));
    };

    if (dataMode === 'demo') {
      set({ notes: { phase: 'ready', items: DEMO_NOTES } });
      getScan()
        .then((res) =>
          set({
            sweep: res.sweep,
            tickers: {
              phase: 'ready',
              items: byScore(res.rows).map((row) => ({
                symbol: row.symbol,
                name: null,
                hasNote: true,
                row,
              })),
            },
          }),
        )
        .catch(() => set({ tickers: { phase: 'failed' } }));
      return () => {
        cancelled = true;
      };
    }

    // Production: the research index (bundled, lazy) and the universe (one static read), in parallel.
    const index = import('virtual:convexa-research').then((m) => m.researchIndex as IndexRow[]);
    index
      .then((rows) =>
        set({
          notes: {
            phase: 'ready',
            items: rows.map((r) => ({
              ticker: r.ticker,
              title: r.latest.title,
              date: r.latest.updated ?? r.latest.date,
              to: `/ticker/${r.ticker}/research`,
            })),
          },
        }),
      )
      .catch(() => set({ notes: { phase: 'failed' } }));
    Promise.all([getScanUniverse(), index.catch(() => [] as IndexRow[])])
      .then(([universe, rows]) =>
        set({ tickers: { phase: 'ready', items: tickersByName(universe.symbols, rows) } }),
      )
      .catch(() => set({ tickers: { phase: 'failed' } }));
    return () => {
      cancelled = true;
    };
  }, [active]);

  return data;
}
