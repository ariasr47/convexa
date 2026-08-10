/**
 * useStructureHistory — durable slow-lane structure samples for the ticker Structure zone.
 *
 * Independent of the REST bundle poll and the live SSE stream
 * (`[live-vs-static-isolation]`). Abort + visibility via `usePollingResource`.
 */
import { usePollingResource } from '@/shared/hooks/usePollingResource';
import { getStructureHistory, type StructureSample } from '@org/api';
import { useCallback } from 'react';

/** History is thinned ≥5m server-side; poll slower than the bundle. */
export const STRUCTURE_HISTORY_POLL_MS = 120_000;

export interface StructureHistoryApi {
  samples: StructureSample[] | null;
  basis: string | null;
  loading: boolean;
  error: string | null;
  refresh: (opts?: { force?: boolean }) => void;
}

export function useStructureHistory(ticker: string): StructureHistoryApi {
  const key = ticker.trim() ? ticker.toUpperCase() : null;

  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      const r = await getStructureHistory(ticker, 48, { signal });
      return { samples: r.samples, basis: r.basis ?? null };
    },
    [ticker],
  );

  const { data, error, loading, refresh } = usePollingResource(key, fetcher, {
    intervalMs: STRUCTURE_HISTORY_POLL_MS,
    keepOnError: true,
  });

  return {
    samples: data?.samples ?? null,
    basis: data?.basis ?? null,
    loading,
    error,
    refresh,
  };
}
