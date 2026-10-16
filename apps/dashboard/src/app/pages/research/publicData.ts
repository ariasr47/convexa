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

/** What the last settled request answered, and for which key. */
type Answer<T> = { key: string; data: T | null; error: string | null };

/**
 * The answer belongs to its key. A view that stays mounted while its key changes (a ticker desk, a
 * filing list moving j/k) must never show the previous key's data as the new one's: until the new
 * key's request settles, `data` is null and `loading` is true, so the view shows its loading state.
 * A late answer for an old key is dropped. A retry of the same key keeps its data while it reloads.
 */
export function useRead<T>(load: () => Promise<T>, key: string, enabled = true): Read<T> {
  const [answer, setAnswer] = useState<Answer<T> | null>(null);
  const [busy, setBusy] = useState<string | null>(enabled ? key : null);
  const [attempt, setAttempt] = useState(0);
  // `load` changes identity every render; `key` is what makes it a different read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, [key]);
  useEffect(() => {
    if (!enabled) {
      setBusy(null);
      return;
    }
    let alive = true;
    setBusy(key);
    setAnswer((a) => (a && a.key === key ? { ...a, error: null } : a));
    run()
      .then((d) => {
        if (alive) setAnswer({ key, data: d, error: null });
      })
      .catch((e: unknown) => {
        const error = e instanceof Error ? e.message : String(e);
        if (alive) setAnswer((a) => ({ key, data: a && a.key === key ? a.data : null, error }));
      })
      .finally(() => {
        if (alive) setBusy(null);
      });
    return () => {
      alive = false;
    };
  }, [run, key, attempt, enabled]);
  const mine = enabled && answer?.key === key ? answer : null;
  return {
    data: mine?.data ?? null,
    error: mine?.error ?? null,
    loading: enabled && (busy === key || !mine),
    retry: () => setAttempt((n) => n + 1),
  };
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
