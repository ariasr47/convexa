/**
 * useStructureHistory — durable slow-lane structure samples for the ticker Structure zone.
 *
 * Independent of the REST bundle poll and the live SSE stream
 * (`[live-vs-static-isolation]`). Abort + visibility via `usePollingResource`.
 *
 * The history is behind the owner gate (each sample carries the flip, the walls and net GEX): a
 * 403 `auth_required` / `owner_only` is kept for the session (`ownerGate.ts`), and no request runs
 * while it stands; a sign-in or sign-out resumes the poll.
 */
import { ownerOnlyRead, useOwnerGate } from '@/features/auth/ownerGate';
import { usePollingResource } from '@/shared/hooks/usePollingResource';
import { getStructureHistory, type StructureSample } from '@convexa/api';
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
      const r = await ownerOnlyRead(() => getStructureHistory(ticker, 48, { signal }));
      return { samples: r.samples, basis: r.basis ?? null };
    },
    [ticker],
  );

  const refused = useOwnerGate() != null;
  const { data, error, loading, refresh } = usePollingResource(key, fetcher, {
    intervalMs: STRUCTURE_HISTORY_POLL_MS,
    keepOnError: true,
    enabled: !refused,
  });

  return {
    samples: data?.samples ?? null,
    basis: data?.basis ?? null,
    loading,
    error,
    refresh,
  };
}
