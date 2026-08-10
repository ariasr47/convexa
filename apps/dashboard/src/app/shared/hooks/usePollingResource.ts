/**
 * Shared poller with AbortController + document.visibility pause.
 *
 * Desk pages re-fetch on a fixed interval without TanStack Query: one interval per
 * key, abort in-flight work on key change / unmount, skip ticks while the tab is
 * hidden, force-refresh when visible again.
 *
 * Consumers supply `fetcher(signal)` only — no network inside this hook.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type PollingFetcher<T> = (signal: AbortSignal) => Promise<T>;

export interface UsePollingResourceOptions {
  /** Poll period in ms. */
  intervalMs: number;
  /**
   * When true (default), a failed poll keeps the last successful `data` and only
   * updates `error`. When false, data is cleared on error.
   */
  keepOnError?: boolean;
  /**
   * When false, no network runs. Use to gate on prerequisites
   * (e.g. empty expiration selection).
   */
  enabled?: boolean;
}

export interface PollingResource<T> {
  data: T | null;
  error: string | null;
  /** True while a request is in flight and we have no data yet for this key. */
  loading: boolean;
  /** Force a fetch even when the tab is hidden (Retry). */
  refresh: (opts?: { force?: boolean }) => void;
}

function isAbort(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'name' in e &&
    (e as { name?: string }).name === 'AbortError'
  );
}

/**
 * @param key Resource identity (e.g. ticker). Changing key aborts prior work and
 *   clears data. Pass `null` to disable.
 */
export function usePollingResource<T>(
  key: string | null,
  fetcher: PollingFetcher<T>,
  { intervalMs, keepOnError = true, enabled = true }: UsePollingResourceOptions,
): PollingResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keepRef = useRef(keepOnError);
  keepRef.current = keepOnError;

  // Imperative handle so interval + visibility always call the latest run without
  // re-subscribing on every data change.
  const runRef = useRef<(force: boolean) => void>(() => {});

  useEffect(() => {
    if (key == null || !enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      runRef.current = () => {};
      return;
    }

    let ac = new AbortController();
    let hasData = false;

    const run = (force: boolean) => {
      if (!force && typeof document !== 'undefined' && document.hidden) return;
      ac.abort();
      ac = new AbortController();
      const signal = ac.signal;
      if (!hasData) setLoading(true);

      fetcherRef
        .current(signal)
        .then((result) => {
          if (signal.aborted) return;
          hasData = true;
          setData(result);
          setError(null);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (signal.aborted || isAbort(e)) return;
          const msg =
            typeof e === 'object' && e !== null && 'message' in e
              ? String((e as { message?: string }).message)
              : 'Request failed';
          setError(msg);
          if (!keepRef.current) {
            hasData = false;
            setData(null);
          }
          setLoading(false);
        });
    };

    runRef.current = run;
    // Fresh key: clear previous resource before first paint of new data.
    setData(null);
    setError(null);
    hasData = false;
    run(true);

    const id = setInterval(() => run(false), intervalMs);
    const onVisibility = () => {
      if (!document.hidden) run(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      ac.abort();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      runRef.current = () => {};
    };
  }, [key, enabled, intervalMs]);

  const refresh = useCallback((opts?: { force?: boolean }) => {
    runRef.current(opts?.force !== false);
  }, []);

  return { data, error, loading, refresh };
}
