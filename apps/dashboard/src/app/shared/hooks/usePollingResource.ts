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
  /**
   * When supplied and it returns true for a caught fault, this resource stops fetching for the
   * rest of this `key`'s lifetime: no further interval tick, no visibility-triggered refresh, and
   * `refresh()` itself becomes inert. Only a `key` change resumes it. For a FATAL, non-retryable
   * fault (e.g. `market_data_paused`, no-vendor-production-posture F2b) where nothing about
   * retrying — automatic or user-triggered — could ever change the answer.
   */
  haltOn?: (error: unknown) => boolean;
  /**
   * The identity whose change clears `data` (default: `key`). Pass a coarser identity than `key`
   * (e.g. ticker + filters, without a sub-query) and a `key` change that keeps the same
   * `resetKey` refetches WITHOUT blanking: the last data stays up, and `dataKey` still names the
   * key it was fetched for, until the new answer lands. A `resetKey` change clears as before.
   */
  resetKey?: string | null;
}

export interface PollingResource<T> {
  data: T | null;
  /** The `key` that produced `data`. Differs from the current `key` only while a `resetKey`-kept
   *  answer is still on screen; callers strip whatever in it depends on the part that changed. */
  dataKey: string | null;
  error: string | null;
  /** The fault behind `error` (undefined once `error` is null). `error` itself is a display
   *  string; a caller that needs to classify WHY (e.g. a typed `code`) reads this instead —
   *  `usePollingResource` stays fault-shape-agnostic. */
  errorCause?: unknown;
  /** True while a request is in flight and we have no data yet for this key. */
  loading: boolean;
  /** Force a fetch even when the tab is hidden (Retry). A no-op once `haltOn` has matched. */
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
 *   clears data, unless `resetKey` is supplied and unchanged. Pass `null` to disable.
 */
export function usePollingResource<T>(
  key: string | null,
  fetcher: PollingFetcher<T>,
  { intervalMs, keepOnError = true, enabled = true, haltOn, resetKey }: UsePollingResourceOptions,
): PollingResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [dataKey, setDataKey] = useState<string | null>(null);
  // The `resetKey` of the answer currently held (null when nothing is held).
  const heldResetRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCause, setErrorCause] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keepRef = useRef(keepOnError);
  keepRef.current = keepOnError;
  const haltOnRef = useRef(haltOn);
  haltOnRef.current = haltOn;

  // Imperative handle so interval + visibility always call the latest run without
  // re-subscribing on every data change.
  const runRef = useRef<(force: boolean) => void>(() => undefined);

  useEffect(() => {
    if (key == null || !enabled) {
      setData(null);
      setDataKey(null);
      heldResetRef.current = null;
      setError(null);
      setErrorCause(undefined);
      setLoading(false);
      runRef.current = () => undefined;
      return;
    }

    let ac = new AbortController();
    let hasData = false;
    // F2b: once a haltOn match fires for this key, every trigger (interval / visibility /
    // manual refresh) short-circuits below — permanently, until the key itself changes.
    let halted = false;

    const run = (force: boolean) => {
      if (halted) return;
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
          setDataKey(key);
          heldResetRef.current = resetKey ?? null;
          setError(null);
          setErrorCause(undefined);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (signal.aborted || isAbort(e)) return;
          const msg =
            typeof e === 'object' && e !== null && 'message' in e
              ? String((e as { message?: string }).message)
              : 'Request failed';
          setError(msg);
          setErrorCause(e);
          if (!keepRef.current) {
            hasData = false;
            setData(null);
            setDataKey(null);
            heldResetRef.current = null;
          }
          if (haltOnRef.current?.(e)) halted = true;
          setLoading(false);
        });
    };

    runRef.current = run;
    // Fresh key: clear previous resource before first paint of new data, unless the caller's
    // `resetKey` says this key is the same resource re-queried (then keep it up until replaced).
    const keep = resetKey != null && heldResetRef.current === resetKey;
    if (keep) {
      hasData = true;
    } else {
      setData(null);
      setDataKey(null);
      heldResetRef.current = null;
      hasData = false;
    }
    setError(null);
    setErrorCause(undefined);
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
      runRef.current = () => undefined;
    };
  }, [key, enabled, intervalMs, resetKey]);

  const refresh = useCallback((opts?: { force?: boolean }) => {
    runRef.current(opts?.force !== false);
  }, []);

  return { data, dataKey, error, errorCause, loading, refresh };
}
