import { describe, expect, it } from 'vitest';
import spy from './catalog/spy';
import { closeToClosePct } from './transport';

// The demo scan's Chg % is the scenario's own close-to-close move, never a constant.
describe('closeToClosePct', () => {
  it('is the last close against the one before it, in percent to two places', () => {
    expect(closeToClosePct([{ close: 100 }, { close: 101 }])).toBe(1);
    expect(closeToClosePct([{ close: 200 }, { close: 100 }, { close: 99.5 }])).toBe(-0.5);
  });

  it('reads SPY from its authored bars (690.75 → 690.62)', () => {
    const [prior, last] = spy.bars.slice(-2).map((b) => b.close);
    expect([prior, last]).toEqual([690.75, 690.62]);
    expect(closeToClosePct(spy.bars)).toBe(-0.02);
  });

  it('claims nothing without a usable prior close', () => {
    expect(closeToClosePct([])).toBeNull();
    expect(closeToClosePct([{ close: 690.62 }])).toBeNull();
    expect(closeToClosePct([{ close: 0 }, { close: 1 }])).toBeNull();
  });
});
