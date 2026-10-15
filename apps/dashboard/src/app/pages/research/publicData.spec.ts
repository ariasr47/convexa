// The ticker desk, the note and the filings detail stay mounted while their ticker changes. If the
// read kept the previous ticker's answer, NVDA's filings, insiders and short interest would show
// under AAPL with no loading state, and a note's freshness would count NVDA's 10-Q. Silent and
// wrong-ticker, so the key contract is pinned here.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRead } from './publicData';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useRead', () => {
  it('shows no data while the new key loads, and drops the old key’s late answer', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<string>>>();
    const load = (key: string) => () => {
      const d = deferred<string>();
      pending.set(key, d);
      return d.promise;
    };
    const { result, rerender } = renderHook(({ k }) => useRead(load(k), k), {
      initialProps: { k: 'NVDA' },
    });
    await act(async () => pending.get('NVDA')?.resolve('nvda data'));
    expect(result.current.data).toBe('nvda data');
    expect(result.current.loading).toBe(false);

    // A first read for AAPL that is still in flight when the visitor moves to MSFT.
    rerender({ k: 'AAPL' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    rerender({ k: 'MSFT' });
    await act(async () => pending.get('AAPL')?.resolve('aapl data'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => pending.get('MSFT')?.resolve('msft data'));
    expect(result.current.data).toBe('msft data');
    expect(result.current.loading).toBe(false);
  });

  it('never shows the old key’s data after the new key fails', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<string>>>();
    const load = (key: string) => () => {
      const d = deferred<string>();
      pending.set(key, d);
      return d.promise;
    };
    const { result, rerender } = renderHook(({ k }) => useRead(load(k), k), {
      initialProps: { k: 'NVDA' },
    });
    await act(async () => pending.get('NVDA')?.resolve('nvda data'));
    rerender({ k: 'AAPL' });
    await act(async () => pending.get('AAPL')?.reject(new Error('down')));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('down');
  });

  it('keeps the same key’s data through a retry', async () => {
    let n = 0;
    const answers = [deferred<string>(), deferred<string>()];
    const { result } = renderHook(() => useRead(() => answers[n++].promise, 'NVDA'));
    await act(async () => answers[0].resolve('first'));
    act(() => result.current.retry());
    expect(result.current.data).toBe('first');
    expect(result.current.loading).toBe(true);
    await act(async () => answers[1].resolve('second'));
    expect(result.current.data).toBe('second');
  });
});
