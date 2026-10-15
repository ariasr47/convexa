/**
 * Public data the API fetches and caches server-side: Treasury yields (U.S. Treasury), futures positioning
 * (CFTC), short interest and short-sale volume (FINRA), and filings, insider trades and reported figures
 * (SEC EDGAR). The browser can't call those sources itself (connect-src 'self'), and the server keeps
 * one copy for every reader.
 *
 * One read per mount. A failed read leaves `error` set and `data` null, never a fabricated empty
 * result; each answer also carries its own `state` for a source that is off, not configured or down.
 */
import {
  getPublicFilings,
  getPublicMarkets,
  getPublicTicker,
  type PublicFilings,
  type PublicMarkets,
  type PublicTicker,
} from '@convexa/api';
import { useCallback, useEffect, useState } from 'react';

export type Read<T> = { data: T | null; error: string | null; loading: boolean; retry: () => void };

function useRead<T>(load: () => Promise<T>, key: string, enabled = true): Read<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [attempt, setAttempt] = useState(0);
  // `load` changes identity every render; `key` is what makes it a different read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, [key]);
  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    run()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [run, attempt, enabled]);
  return { data, error, loading, retry: () => setAttempt((n) => n + 1) };
}

/** `enabled: false` reads nothing (the demo's credits page makes no request). */
export function usePublicMarkets(enabled = true): Read<PublicMarkets> {
  return useRead(getPublicMarkets, 'markets', enabled);
}

/** `enabled: false` reads nothing (the demo's notes index has no production tickers to check). */
export function usePublicFilings(tickers: string[], enabled = true): Read<PublicFilings> {
  const key = tickers.join(',');
  return useRead(() => getPublicFilings(tickers), key, enabled);
}

/** An empty `ticker` reads nothing (for a view that only sometimes needs it). */
export function usePublicTicker(ticker: string): Read<PublicTicker> {
  return useRead(() => getPublicTicker(ticker), ticker, ticker !== '');
}
