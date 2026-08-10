import { describe, expect, it } from 'vitest';
import { sparklinePathD } from './PlSparkline';
import type { PlSample } from './useTrends';

const s = (pl: number | null, t = 1): PlSample => ({ t, pl });

describe('sparklinePathD', () => {
  it('returns empty when fewer than two finite points', () => {
    expect(sparklinePathD([])).toEqual([]);
    expect(sparklinePathD([s(1)])).toEqual([]);
    expect(sparklinePathD([s(1), s(null)])).toEqual([]);
  });

  it('draws one continuous path for dense series', () => {
    const paths = sparklinePathD([s(0), s(1), s(2)]);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^M[\d.]+ /);
    expect(paths[0]).toContain(' L');
  });

  it('breaks the line on null samples (no interpolation across gaps)', () => {
    const paths = sparklinePathD([s(0), s(1), s(null), s(2), s(3)]);
    expect(paths.length).toBe(2);
    // No single path may jump the gap as one continuous L-chain over the null index.
    for (const p of paths) {
      expect(p.startsWith('M')).toBe(true);
    }
  });
});
