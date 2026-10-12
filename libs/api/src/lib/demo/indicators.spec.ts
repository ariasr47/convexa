import { describe, expect, it } from 'vitest';
import { computeIndicators } from './indicators';
import type { SampleBar } from './types';

describe('local daily indicators', () => {
  it('pins warm-up boundaries and flat-market zero handling', () => {
    const flat: SampleBar[] = Array.from({ length: 60 }, (_, i) => ({
      id: `flat-${i}`,
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));
    const values = computeIndicators(flat);
    expect(values.ema20[18]).toMatchObject({ state: 'warmup', requiredBars: 20, observedBars: 19 });
    expect(values.ema20[19]).toMatchObject({
      state: 'ready',
      value: 100,
      method: 'EMA with SMA seed',
    });
    expect(values.ema50[49]).toMatchObject({ state: 'ready', value: 100 });
    expect(values.atr14[12]).toMatchObject({ state: 'warmup', requiredBars: 14 });
    expect(values.atr14[13]).toMatchObject({ state: 'ready', value: 2 });
    expect(values.rsi14[13]).toMatchObject({ state: 'warmup' });
    expect(values.rsi14[14]).toMatchObject({ state: 'ready', value: 50 });
    expect(values.adx14[26]).toMatchObject({ state: 'warmup' });
    expect(values.adx14[27]).toMatchObject({ state: 'ready', value: 0 });
  });

  it('calculates the Wilder RSI ceiling for an uninterrupted rising close series', () => {
    const up: SampleBar[] = Array.from({ length: 20 }, (_, i) => ({
      id: `up-${i}`,
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 100 + i,
      volume: 1000,
    }));
    expect(computeIndicators(up).rsi14[14]).toMatchObject({ state: 'ready', value: 100 });
  });
});
