import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('useReducedMotion', () => {
  afterEach(() => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    vi.restoreAllMocks();
  });

  it('returns false when matchMedia is unavailable (jsdom default)', () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when the reduce query matches', () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});
