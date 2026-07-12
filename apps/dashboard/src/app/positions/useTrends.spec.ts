/**
 * Unit — the ephemeral per-position trend ring buffer + session anchor (AC-8, AC-9, AC-33).
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePlTrends } from './useTrends';

describe('usePlTrends', () => {
  it('grows the series as P/L samples arrive (AC-9)', () => {
    const { result } = renderHook(() => usePlTrends());
    act(() => {
      result.current.record('p1', 10);
    });
    act(() => {
      result.current.record('p1', 20);
    });
    act(() => {
      result.current.record('p1', 30);
    });
    expect(result.current.series('p1')).toHaveLength(3);
    expect(result.current.series('p1').map((s) => s.pl)).toEqual([10, 20, 30]);
  });

  it('anchors the session delta to the first observed P/L (AC-8)', () => {
    const { result } = renderHook(() => usePlTrends());
    act(() => {
      result.current.record('p1', 15);
    });
    act(() => {
      result.current.record('p1', 40);
    });
    expect(result.current.sessionAnchor('p1')).toBe(15); // anchor stays at first observation
  });

  it('inserts a break (null) on a feed drop and never stitches it (AC-33)', () => {
    const { result } = renderHook(() => usePlTrends());
    act(() => {
      result.current.record('p1', 10);
    });
    act(() => {
      result.current.recordBreak('p1');
    });
    act(() => {
      result.current.record('p1', 12);
    });
    const series = result.current.series('p1');
    expect(series.map((s) => s.pl)).toEqual([10, null, 12]);
  });

  it('collapses consecutive breaks into one gap marker', () => {
    const { result } = renderHook(() => usePlTrends());
    act(() => {
      result.current.record('p1', 10);
    });
    act(() => {
      result.current.recordBreak('p1');
    });
    act(() => {
      result.current.recordBreak('p1');
    });
    expect(result.current.series('p1').filter((s) => s.pl == null)).toHaveLength(1);
  });

  it('keeps per-position series isolated', () => {
    const { result } = renderHook(() => usePlTrends());
    act(() => {
      result.current.record('a', 1);
    });
    act(() => {
      result.current.record('b', 2);
    });
    expect(result.current.series('a').map((s) => s.pl)).toEqual([1]);
    expect(result.current.series('b').map((s) => s.pl)).toEqual([2]);
  });

  it('starts empty each mount (ephemeral — clears on reload)', () => {
    const { result } = renderHook(() => usePlTrends());
    expect(result.current.series('p1')).toEqual([]);
    expect(result.current.sessionAnchor('p1')).toBeNull();
  });
});
