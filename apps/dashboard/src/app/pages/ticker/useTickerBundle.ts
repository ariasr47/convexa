/**
 * useTickerBundle — REST ticker poll for the Ticker page (structure / score / chain).
 *
 * Owns: loading, error, data, refresh for the current ticker + filter key.
 * Does NOT own: SSE live stream, portfolio, AI rec, expiration UI state
 * (parent passes `selected` so reset-on-ticker stays colocated with navigation).
 *
 * Poll cadence matches backend GEX cache TTL (~60s). Abort + visibility via
 * `usePollingResource` (perf §3.1–3.3).
 */
import { usePollingResource } from '@/shared/hooks/usePollingResource';
import { getTicker, type OptionRight, type TickerBundle } from '@org/api';
import { useCallback, useMemo, useRef } from 'react';

export const TICKER_BUNDLE_POLL_MS = 60_000;

export type PositionQueryLeg = {
  expiration: string;
  strike: number;
  right: OptionRight;
  plPct?: number;
};

export interface UseTickerBundleArgs {
  ticker: string;
  /** null = all expirations; [] = none selected (fetch disabled); string[] = filter. */
  selected: string[] | null;
  darkPool?: boolean;
  positionQuery?: PositionQueryLeg | null;
  /** One-shot DTE prefill — read once per forced fetch when present. */
  takeDtePrefill?: () => { min: number; max: number } | null;
}

export interface TickerBundleApi {
  data: TickerBundle | null;
  loading: boolean;
  error: string | null;
  refresh: (opts?: { force?: boolean }) => void;
}

export function useTickerBundle({
  ticker,
  selected,
  darkPool = true,
  positionQuery = null,
  takeDtePrefill,
}: UseTickerBundleArgs): TickerBundleApi {
  const takePrefillRef = useRef(takeDtePrefill);
  takePrefillRef.current = takeDtePrefill;

  // Fetch disabled when the user explicitly cleared all expirations.
  const enabled = selected === null || selected.length > 0;

  // Key must change when anything affecting the request changes.
  const key = useMemo(() => {
    if (!enabled) return null;
    const pos = positionQuery
      ? `${positionQuery.expiration}:${positionQuery.strike}:${positionQuery.right}`
      : '';
    const exp = selected === null ? 'all' : selected.join(',');
    return `${ticker.toUpperCase()}|dp=${darkPool}|exp=${exp}|pos=${pos}`;
  }, [ticker, selected, darkPool, positionQuery, enabled]);

  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      const dte = takePrefillRef.current?.() ?? null;
      return getTicker(
        ticker,
        {
          expirations: selected ?? undefined,
          darkPool,
          position: positionQuery
            ? {
                expiration: positionQuery.expiration,
                strike: positionQuery.strike,
                right: positionQuery.right,
                plPct: positionQuery.plPct,
              }
            : undefined,
          minDte: dte?.min,
          maxDte: dte?.max,
        },
        { signal },
      );
    },
    [ticker, selected, darkPool, positionQuery],
  );

  const { data, error, loading, refresh } = usePollingResource(key, fetcher, {
    intervalMs: TICKER_BUNDLE_POLL_MS,
    keepOnError: true,
    enabled,
  });

  return { data, loading, error, refresh };
}
