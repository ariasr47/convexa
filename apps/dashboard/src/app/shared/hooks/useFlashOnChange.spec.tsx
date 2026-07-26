/**
 * useFlashOnChange — RISK-BASED unit tests (qa-verify.md §4, 2026-07-13). Pure hook edge semantics,
 * where a silent regression is invisible in review: a flash on an EQUAL value (visual noise), a flash
 * while inactive (violates `[live-vs-static-isolation]` — a "live" pulse on frozen data), a flash under
 * prefers-reduced-motion, or a flash that never clears.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlashOnChange } from './useFlashOnChange';

/** Force `useReducedMotion` on/off by stubbing matchMedia before mount. */
function setReducedMotion(on: boolean) {
  (window as unknown as { matchMedia?: unknown }).matchMedia = on
    ? vi.fn().mockReturnValue({
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

  it('does NOT flash on mount, on an equal value, or on a transition to null', () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 as number | null },
    });
    expect(result.current).toBeNull(); // mount
    act(() => rerender({ v: 100 }));
    expect(result.current).toBeNull(); // equal value
    act(() => rerender({ v: null }));
    expect(result.current).toBeNull(); // value went away — no flash on a disappearance
  });

  it('flashes with the direction tone on a genuine change', () => {
    const up = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 },
    });
    act(() => up.rerender({ v: 101 }));
    expect(up.result.current?.tone).toBe('up');

    const down = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 },
    });
    act(() => down.rerender({ v: 99 }));
    expect(down.result.current?.tone).toBe('down');
  });

  it('clears after the duration (never a stuck flash)', () => {
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

  it('is inert when inactive (not live / SSE offline) — no stale "live" pulse', () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: false }), {
      initialProps: { v: 100 },
    });
    act(() => rerender({ v: 200 }));
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
