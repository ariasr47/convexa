import { describe, expect, it } from 'vitest';
import { plSparkGeometry, plSparkText } from './PlSparkline';

const S = (pls: (number | null)[]) => pls.map((pl, t) => ({ t, pl }));

// The sparkline's colour is the SIGN of P/L run by run (P-11). A wrong split paints a loss green.
describe('plSparkGeometry', () => {
  it('splits a run at the interpolated zero crossing, each side taking its own sign', () => {
    // width 30, height 22, pad 1 → x = 1 + i * 28; y range [-100, 100] → zero at y = 11.
    const g = plSparkGeometry(S([100, -100]), 30, 22, 1)!;
    expect(g.zeroY).toBe(11);
    expect(g.segments.map((s) => s.sign)).toEqual([1, -1]);
    expect(g.segments[0].d).toBe('M1.00 1.00 L15.00 11.00');
    expect(g.segments[1].d).toBe('M15.00 11.00 L29.00 21.00');
    expect(g.last).toEqual({ x: 29, y: 21, sign: -1 });
  });

  it('keeps zero inside the range, so an all-positive line sits above the zero line', () => {
    const g = plSparkGeometry(S([40, 80]), 30, 22, 1)!;
    expect(g.zeroY).toBe(21);
    expect(g.segments).toHaveLength(1);
    expect(g.segments[0].sign).toBe(1);
  });

  it('a null is a break, never a zero; a lone point draws nothing', () => {
    const g = plSparkGeometry(S([10, 20, null, 30]), 30, 22, 1)!;
    expect(g.segments).toHaveLength(1);
    expect(plSparkGeometry(S([10, null]))).toBeNull();
  });

  it('says where it is now, its low and high, and its sample count', () => {
    expect(plSparkText(S([40, -80, 412]))).toBe(
      'P/L this session: Up $412 now; low −$80, high $412; 3 samples.',
    );
  });
});
