import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlashOnChange } from './useFlashOnChange';

/** Force `useReducedMotion` on/off by stubbing matchMedia before mount. */
function setReducedMotion(on: boolean) {
  (window as unknown as { matchMedia?: unknown }).matchMedia = on
    ? vi
        .fn()
        .mockReturnValue({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })
    : undefined;
}

describe('useFlashOnChange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    setReducedMotion(false);
    vi.restoreAllMocks();
  });

  it('does not flash on the initial value', () => {
    const { result } = renderHook(() => useFlashOnChange(100, { active: true }));
    expect(result.current).toBeNull();
  });

  it('flashes "up" on an increase while active', () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 },
    });
    act(() => rerender({ v: 101 }));
    expect(result.current?.tone).toBe('up');
  });

  it('flashes "down" on a decrease', () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 },
    });
    act(() => rerender({ v: 99 }));
    expect(result.current?.tone).toBe('down');
  });

  it('uses the neutral tone when forced', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useFlashOnChange(v, { active: true, tone: 'neutral' }),
      { initialProps: { v: 100 } },
    );
    act(() => rerender({ v: 101 }));
    expect(result.current?.tone).toBe('neutral');
  });

  it('does NOT flash when inactive (not live / SSE offline)', () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: false }), {
      initialProps: { v: 100 },
    });
    act(() => rerender({ v: 200 }));
    expect(result.current).toBeNull();
  });

  it('does NOT flash on an unchanged value', () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 },
    });
    act(() => rerender({ v: 100 }));
    expect(result.current).toBeNull();
  });

  it('does NOT flash when the value becomes null', () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 as number | null },
    });
    act(() => rerender({ v: null }));
    expect(result.current).toBeNull();
  });

  it('clears the flash after the duration', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useFlashOnChange(v, { active: true, durationMs: 600 }),
      { initialProps: { v: 100 } },
    );
    act(() => rerender({ v: 101 }));
    expect(result.current).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(result.current).toBeNull();
  });

  it('is inert under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 },
    });
    act(() => rerender({ v: 200 }));
    expect(result.current).toBeNull();
  });
});
