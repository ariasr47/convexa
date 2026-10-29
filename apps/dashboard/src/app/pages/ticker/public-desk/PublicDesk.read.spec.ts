// The public desk's read can now start in the route, before the desk's chunk (app.tsx, site audit
// 2026-10-25 PERF-05), and an answer it already holds is drawn at the first render. That adds a way
// for the desk to draw an answer that isn't its ticker's: the desk stays mounted while QuickSymbols
// moves it to another ticker, and the head start belongs to the first one. SPY's filings and insiders
// under QQQ would be silent and wrong-ticker, the contract publicData.spec.ts pins for useRead, so
// it is pinned here for the head start too, with the retry that must not replay a failed head start.
import type { PublicTicker } from '@convexa/api';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeskRead, type PublicDeskHeadStart } from './PublicDesk';

const getPublicTicker = vi.hoisted(() => vi.fn<(ticker: string) => Promise<PublicTicker>>());
vi.mock('@convexa/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convexa/api')>()),
  getPublicTicker,
}));

const answer = (ticker: string) => ({ ticker }) as unknown as PublicTicker;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A head start that has already answered, as app.tsx leaves it once its promise resolves. */
function answered(ticker: string): PublicDeskHeadStart {
  const data = answer(ticker);
  return { ticker, promise: Promise.resolve(data), data };
}

beforeEach(() => {
  getPublicTicker.mockReset();
});

describe('useDeskRead', () => {
  it('draws a head start that has already answered at the first render, and reads nothing more', async () => {
    const head = answered('SPY');
    const { result } = renderHook(() => useDeskRead('SPY', head));
    expect(result.current.data).toBe(head.data);
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(result.current.data).toBe(head.data));
    expect(getPublicTicker).not.toHaveBeenCalled();
  });

  it('never shows the head start’s answer under another ticker, nor again under its own', async () => {
    const head = answered('SPY');
    const reads = new Map<string, ReturnType<typeof deferred<PublicTicker>>>();
    getPublicTicker.mockImplementation((t) => {
      const d = deferred<PublicTicker>();
      reads.set(t, d);
      return d.promise;
    });
    const { result, rerender } = renderHook(({ t }) => useDeskRead(t, head), {
      initialProps: { t: 'SPY' },
    });
    await waitFor(() => expect(result.current.data).toBe(head.data));

    rerender({ t: 'QQQ' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => reads.get('QQQ')?.resolve(answer('QQQ')));
    expect(result.current.data).toEqual(answer('QQQ'));

    // Back to SPY: a fresh read, shown loading, never the head start's earlier answer.
    rerender({ t: 'SPY' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(getPublicTicker).toHaveBeenLastCalledWith('SPY');
  });

  it('reads afresh on a retry after the head start failed', async () => {
    const failed = deferred<PublicTicker>();
    const head: PublicDeskHeadStart = { ticker: 'SPY', promise: failed.promise };
    getPublicTicker.mockResolvedValue(answer('SPY'));
    const { result } = renderHook(() => useDeskRead('SPY', head));
    expect(result.current.loading).toBe(true);
    await act(async () => failed.reject(new Error('down')));
    await waitFor(() => expect(result.current.error).toBe('down'));
    expect(getPublicTicker).not.toHaveBeenCalled();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toEqual(answer('SPY')));
    expect(getPublicTicker).toHaveBeenCalledWith('SPY');
  });
});
