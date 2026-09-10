/**
 * `useStreamLatch` — behavioural spec (SPEC §2.2, criteria 12, 13, 16a, 16b).
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStreamLatch } from './useStreamLatch';

describe('useStreamLatch', () => {
  it('criterion 12 — a first stream value is held, and a later drop keeps it retained', () => {
    const { result, rerender } = renderHook(
      ({ value, token }: { value: number | null; token: string }) => useStreamLatch(value, token),
      { initialProps: { value: 248 as number | null, token: 'SPY|live' } },
    );
    expect(result.current).toEqual({ value: 248, retained: true });

    rerender({ value: null, token: 'SPY|live' });
    expect(result.current).toEqual({ value: 248, retained: true });
  });

  it('criterion 13 — never held any value, then a drop → empty latch', () => {
    const { result, rerender } = renderHook(
      ({ value, token }: { value: number | null; token: string }) => useStreamLatch(value, token),
      { initialProps: { value: null as number | null, token: 'SPY|live' } },
    );
    expect(result.current).toEqual({ value: null, retained: false });

    rerender({ value: null, token: 'SPY|live' });
    expect(result.current).toEqual({ value: null, retained: false });
  });

  it('criterion 16a — a resetToken change on a symbol change empties the latch', () => {
    const { result, rerender } = renderHook(
      ({ value, token }: { value: number | null; token: string }) => useStreamLatch(value, token),
      { initialProps: { value: 248 as number | null, token: 'SPY|live' } },
    );
    expect(result.current.retained).toBe(true);

    rerender({ value: null, token: 'TSLA|live' });
    expect(result.current).toEqual({ value: null, retained: false });
  });

  it('criterion 16b — a resetToken change to replay-armed empties the latch', () => {
    const { result, rerender } = renderHook(
      ({ value, token }: { value: number | null; token: string }) => useStreamLatch(value, token),
      { initialProps: { value: 248 as number | null, token: 'SPY|live' } },
    );
    expect(result.current.retained).toBe(true);

    rerender({ value: null, token: 'SPY|replay' });
    expect(result.current).toEqual({ value: null, retained: false });
  });

  it('NaN / Infinity are ignored — the latch is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ value, token }: { value: number | null; token: string }) => useStreamLatch(value, token),
      { initialProps: { value: 248 as number | null, token: 'SPY|live' } },
    );
    rerender({ value: Number.NaN, token: 'SPY|live' });
    expect(result.current).toEqual({ value: 248, retained: true });

    rerender({ value: Number.POSITIVE_INFINITY, token: 'SPY|live' });
    expect(result.current).toEqual({ value: 248, retained: true });
  });

  it('a second, different stream value replaces the latched one', () => {
    const { result, rerender } = renderHook(
      ({ value, token }: { value: number | null; token: string }) => useStreamLatch(value, token),
      { initialProps: { value: 248 as number | null, token: 'SPY|live' } },
    );
    rerender({ value: 250, token: 'SPY|live' });
    expect(result.current).toEqual({ value: 250, retained: true });
  });
});
