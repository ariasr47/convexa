// A foreign filer's figures arrive in its own currency (TSMC tags IFRS revenue in TWD). Printing them
// with '$' is silent and wrong by the exchange rate (about 30x for NT$), so the currency word is
// pinned here, with the axis step that has to stay readable at NT$ trillions.
import { describe, expect, it } from 'vitest';
import { formatBillions, formatFiled, inOneUnit, niceTicks } from './money';

describe('money from the wire unit', () => {
  it('labels TWD as TWD, never as dollars', () => {
    expect(formatBillions(2.8943e12, 'TWD')).toBe('TWD 2,894.3B');
    expect(formatFiled(2.894e12, 'TWD')).not.toContain('$');
    expect(formatFiled(12.55, 'TWD/shares')).toBe('TWD 12.55');
  });

  it('keeps US dollars as $', () => {
    expect(formatBillions(96.2e9, 'USD')).toBe('$96.2B');
    expect(formatFiled(96.24e9, 'USD')).toBe('$96.24B');
    expect(formatFiled(885.4e6, 'USD')).toBe('$885.4M');
    expect(formatFiled(2.31, 'USD/shares')).toBe('$2.31');
    expect(formatFiled(-1.2, 'USD/shares')).toBe('−$1.20');
  });

  it('puts no currency on a unit that is not money', () => {
    expect(formatFiled(5e9, 'shares')).toBe('5B');
  });

  it('keeps one unit per series, the one most years use, USD on a tie, whatever the order', () => {
    const y = (unit: string, fy: number) => ({ unit, fy });
    expect(inOneUnit([y('TWD', 1), y('TWD', 2), y('USD', 3)]).map((r) => r.fy)).toEqual([1, 2]);
    expect(inOneUnit([y('TWD', 1), y('USD', 2)]).map((r) => r.unit)).toEqual(['USD']);
    expect(inOneUnit([y('USD', 1), y('TWD', 2)]).map((r) => r.unit)).toEqual(['USD']);
    expect(inOneUnit([y('USD', 1), y('USD', 2)])).toHaveLength(2);
  });
});

describe('niceTicks', () => {
  it('draws a readable axis at NT$ trillions (maxB 3809)', () => {
    const ticks = niceTicks(3809);
    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(3809);
    expect(ticks).toEqual([0, 1000, 2000, 3000, 4000]);
  });

  it('steps 1, 2 or 5 × 10ⁿ at any magnitude, at most six ticks', () => {
    for (const max of [0.4, 3, 17, 40, 96.2, 130, 391, 999, 1000, 25_000]) {
      const ticks = niceTicks(max);
      const step = ticks[1] - ticks[0];
      const lead = Number((step / 10 ** Math.floor(Math.log10(step))).toPrecision(6));
      expect([1, 2, 5]).toContain(lead);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
      expect(ticks[ticks.length - 2]).toBeLessThan(max);
    }
  });
});
