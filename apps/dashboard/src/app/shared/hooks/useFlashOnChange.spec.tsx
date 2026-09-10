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

/**
 * Like `setReducedMotion`, but keeps the `change` listener `useReducedMotion` registers so the test
 * can flip the preference AFTER mount and have the hook actually observe it — a plain reassignment of
 * `window.matchMedia` does nothing post-mount, because `useReducedMotion`'s effect only calls
 * `matchMedia()` once (empty dep array) and holds onto that one `MediaQueryList`.
 */
function reducedMotionController(initial: boolean) {
  let matches = initial;
  const listeners: Array<() => void> = [];
  const mql = {
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, cb: () => void) => {
      listeners.push(cb);
    },
    removeEventListener: vi.fn(),
    addListener: (cb: () => void) => {
      listeners.push(cb);
    },
    removeListener: vi.fn(),
  };
  (window as unknown as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mql);
  return {
    flip(next: boolean) {
      matches = next;
      for (const cb of listeners) cb();
    },
  };
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

  // PLAN FE-4 step 4 — the second half of the motion-mechanism enforcement (`single-motion-moment.
  // spec.ts`'s doc comment points here): `useFlashOnChange.ts:57-59` clears an IN-FLIGHT flash the
  // moment either gate flips, rather than letting it run to its natural timeout while no longer live
  // / while the user now prefers reduced motion.

  it('clears an in-flight flash when `active` flips to false mid-flash', () => {
    const { result, rerender } = renderHook(
      ({ v, active }: { v: number; active: boolean }) => useFlashOnChange(v, { active }),
      { initialProps: { v: 100, active: true } },
    );
    act(() => rerender({ v: 101, active: true }));
    expect(result.current).not.toBeNull(); // a flash is in flight
    act(() => rerender({ v: 101, active: false })); // stream drops mid-flash
    expect(result.current).toBeNull(); // cleared immediately, not left to time out
  });

  it('clears an in-flight flash when reduced motion turns on mid-flash', () => {
    // `useReducedMotion`'s own effect reads `matchMedia()` once per mount, so mutating a static mock
    // AFTER mount does nothing — this controller keeps the registered `change` listener so the flip
    // is actually observed, the way a real OS-level preference change would be.
    const controller = reducedMotionController(false);
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v, { active: true }), {
      initialProps: { v: 100 },
    });
    act(() => rerender({ v: 101 }));
    expect(result.current).not.toBeNull(); // a flash is in flight
    act(() => controller.flip(true));
    expect(result.current).toBeNull(); // cleared immediately, not left to time out
  });

  /**
   * MUTATION PROOF (criterion 57), actually run: replaced `useFlashOnChange.ts:58`'s
   * `if ((!active || reduced) && flash) setFlash(null);` with `if (false && flash) setFlash(null);`
   * (the clear-effect never fires). Both tests above failed —
   * `AssertionError: expected { tone: 'up', id: 1 } to be null` (the mount-effect's own flash survived
   * with nothing to clear it) — while the other five tests in this file stayed green (they never put
   * a flash in flight and flip a gate afterward, so they cannot see this class of regression).
   * Reverted.
   *
   * A NOTED FINDING, not a gap in these two tests: PLAN FE-4 also suggested proving the ORIGINAL
   * "is inert when inactive" test by removing `!active` from the FIRST effect's guard
   * (`useFlashOnChange.ts:45`) alone. Tried that first — it did NOT go red. The two effects
   * independently gate the same condition: the mount-effect's poisoned guard lets a flash through,
   * but the (unpoisoned) clear-effect immediately clears it in the same `act()` flush, because its own
   * `!active` check is untouched. That is a real interlock (removing either guard alone is still
   * caught by the other), not a vacuous proof of THIS suite — the mutation above, which poisons the
   * clear-effect itself, is the one that actually isolates `useFlashOnChange.ts:57-59`'s behaviour.
   */
});
