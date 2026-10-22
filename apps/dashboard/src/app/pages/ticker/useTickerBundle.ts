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
import { getTicker, isMarketDataPaused, type OptionRight, type TickerBundle } from '@convexa/api';
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
  positionQuery?: PositionQueryLeg | null;
  /** One-shot DTE prefill — read once per forced fetch when present. */
  takeDtePrefill?: () => { min: number; max: number } | null;
}

export interface TickerBundleApi {
  data: TickerBundle | null;
  loading: boolean;
  error: string | null;
  /** True once the desk has learned `market_data_paused` for the CURRENT ticker (F2/F2b). Sticky
   *  for this ticker: polling has already halted, so this cannot flip back to false except by
   *  changing `ticker`, which mounts a fresh resource. */
  paused: boolean;
  refresh: (opts?: { force?: boolean }) => void;
}

export function useTickerBundle({
  ticker,
  selected,
  positionQuery = null,
  takeDtePrefill,
}: UseTickerBundleArgs): TickerBundleApi {
  const takePrefillRef = useRef(takeDtePrefill);
  takePrefillRef.current = takeDtePrefill;

  // Fetch disabled when the user explicitly cleared all expirations.
  const enabled = selected === null || selected.length > 0;

  // Key must change when anything affecting the request changes. `resetKey` is the same minus the
  // position leg: a new position on this ticker re-queries the bundle (for `position_eval`) but is
  // still this ticker's structure, so the desk keeps it up instead of falling back to the cold-load
  // skeleton. A ticker or filter change still clears.
  const resetKey = useMemo(() => {
    if (!enabled) return null;
    const exp = selected === null ? 'all' : selected.join(',');
    return `${ticker.toUpperCase()}|exp=${exp}`;
  }, [ticker, selected, enabled]);
  const key = useMemo(() => {
    if (resetKey == null) return null;
    const pos = positionQuery
      ? `${positionQuery.expiration}:${positionQuery.strike}:${positionQuery.right}`
      : '';
    return `${resetKey}|pos=${pos}`;
  }, [resetKey, positionQuery]);

  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      const dte = takePrefillRef.current?.() ?? null;
      return getTicker(
        ticker,
        {
          expirations: selected ?? undefined,
          // Off-exchange context is always on (the desk's toggle was removed to match the Figma).
          darkPool: true,
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
    [ticker, selected, positionQuery],
  );

  const { data, dataKey, error, errorCause, loading, refresh } = usePollingResource(key, fetcher, {
    intervalMs: TICKER_BUNDLE_POLL_MS,
    keepOnError: true,
    enabled,
    // F2b: once paused is known, no further request to this B2 route for this ticker — changing
    // the ticker (a new `key`) is the only thing that fetches again.
    haltOn: isMarketDataPaused,
    resetKey,
  });

  // While a kept answer is still up, its `position_eval` belongs to the PREVIOUS position query.
  // Never attribute it to the new one (decision records copy its fingerprint): absent until the
  // re-query lands.
  const current = useMemo(
    () => (data && dataKey !== key && data.position_eval ? { ...data, position_eval: null } : data),
    [data, dataKey, key],
  );

  return { data: current, loading, error, paused: isMarketDataPaused(errorCause), refresh };
}
