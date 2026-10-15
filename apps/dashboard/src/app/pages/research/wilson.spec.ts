// The calibration chart draws each bin's 95% interval: a wrong interval tells a reader a 5-call bin is
// as settled as a 40-call one. Values worked by hand from the formula (z = 1.96, z² = 3.8416).
import { describe, expect, it } from 'vitest';
import { wilson } from './wilson';

describe('wilson', () => {
  it('matches the hand-worked interval for 5 of 10', () => {
    // p̂ 0.5; 1 + z²/n = 1.38416; centre 0.69208; half-width 1.96·√0.034604 = 0.364602.
    const [lo, hi] = wilson(5, 10);
    expect(lo).toBeCloseTo(0.23659, 5);
    expect(hi).toBeCloseTo(0.76341, 5);
  });

  it('stays off the walls when none or all of the calls came true (p = 0 and p = 1)', () => {
    // 0 of 10: centre 0.19208 = half-width, so the low end is 0 and the high end 0.38416 / 1.38416.
    expect(wilson(0, 10)[0]).toBe(0);
    expect(wilson(0, 10)[1]).toBeCloseTo(0.27754, 5);
    expect(wilson(10, 10)[0]).toBeCloseTo(0.72246, 5);
    expect(wilson(10, 10)[1]).toBe(1);
    // One call that came true: 1.0 / 4.8416 to 1.
    expect(wilson(1, 1)[0]).toBeCloseTo(0.20654, 5);
    expect(wilson(1, 1)[1]).toBe(1);
  });

  it('is the whole range for an empty bin, and narrows as a bin fills', () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
    const width = (k: number, n: number) => wilson(k, n)[1] - wilson(k, n)[0];
    expect(width(20, 40)).toBeLessThan(width(5, 10));
  });
});
