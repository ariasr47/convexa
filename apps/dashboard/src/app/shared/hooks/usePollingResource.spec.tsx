/**
 * usePollingResource — abort + visibility + key reset.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePollingResource } from './usePollingResource';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

beforeEach(() => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => false,
  });
});

describe('usePollingResource', () => {
  it('fetches on mount and exposes data', async () => {
    const fetcher = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return { n: 1 };
    });
    const { result } = renderHook(() => usePollingResource('SPY', fetcher, { intervalMs: 60_000 }));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts previous request when key changes', async () => {
    let resolveFirst: ((v: string) => void) | undefined;
    const fetcher = vi.fn((signal: AbortSignal) => {
      if (fetcher.mock.calls.length === 1) {
        return new Promise<string>((resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
          resolveFirst = resolve;
        });
      }
      return Promise.resolve('second');
    });

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => usePollingResource(key, fetcher, { intervalMs: 60_000 }),
      { initialProps: { key: 'A' } },
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ key: 'B' });
    await waitFor(() => expect(result.current.data).toBe('second'));
    // Resolving the aborted first must not overwrite.
    await act(async () => {
      resolveFirst?.('stale');
    });
    expect(result.current.data).toBe('second');
  });

  it('skips interval ticks while document.hidden; refreshes when visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let hidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    const fetcher = vi.fn(async () => 'ok');
    renderHook(() => usePollingResource('X', fetcher, { intervalMs: 1_000 }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    hidden = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1); // no poll while hidden

    hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('keeps last data on error when keepOnError', async () => {
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw new Error('boom');
      return 42;
    });
    const { result } = renderHook(() =>
      usePollingResource('k', fetcher, { intervalMs: 60_000, keepOnError: true }),
    );
    await waitFor(() => expect(result.current.data).toBe(42));
    fail = true;
    await act(async () => {
      result.current.refresh({ force: true });
    });
    await waitFor(() => expect(result.current.error).toMatch(/boom/));
    expect(result.current.data).toBe(42);
  });

  it('haltOn: a matching fault stops every future trigger (interval, visibility, manual refresh) for this key', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fatal = Object.assign(new Error('paused'), { code: 'market_data_paused' });
    const fetcher = vi.fn(async () => {
      throw fatal;
    });
    const { result } = renderHook(() =>
      usePollingResource('SPY', fetcher, {
        intervalMs: 1_000,
        haltOn: (e) => (e as { code?: string })?.code === 'market_data_paused',
      }),
    );
    await waitFor(() => expect(result.current.error).toBe('paused'));
    expect(result.current.errorCause).toBe(fatal);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Interval ticks: none reach the network once halted.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Visibility resume: also inert.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // A manual refresh (e.g. a leftover Retry wiring) is inert too.
    await act(async () => {
      result.current.refresh({ force: true });
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a non-matching fault does not halt — the interval keeps polling (unchanged default behavior)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetcher = vi.fn(async () => {
      throw new Error('transient');
    });
    renderHook(() =>
      usePollingResource('SPY', fetcher, {
        intervalMs: 1_000,
        haltOn: (e) => (e as { code?: string })?.code === 'market_data_paused',
      }),
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not fetch when key is null or enabled is false', async () => {
    const fetcher = vi.fn(async () => 1);
    const { rerender } = renderHook(
      ({ key, enabled }: { key: string | null; enabled: boolean }) =>
        usePollingResource(key, fetcher, { intervalMs: 1_000, enabled }),
      { initialProps: { key: null as string | null, enabled: true } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ key: 'Z', enabled: false });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
