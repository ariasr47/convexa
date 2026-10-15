import type { IndicatorPoint } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { sampleTaFinding, sessionsAbove } from './sampleTa';

const ready = (value: number): IndicatorPoint => ({
  state: 'ready',
  value,
  sourceBarId: 'x',
  method: 'ema',
  window: 20,
  basis: 'close',
  unit: 'USD',
});
const warm: IndicatorPoint = {
  state: 'warmup',
  value: null,
  reason: 'insufficient_history',
  requiredBars: 20,
  observedBars: 1,
};

describe('sessionsAbove', () => {
  it('counts back from the last bar and stops at the first close not above the average', () => {
    const closes = [10, 9, 12, 13, 14];
    const ema = [warm, ready(10), ready(11), ready(12), ready(13)];
    expect(sessionsAbove(closes, ema)).toBe(3);
  });
  it('is 0 when the last close equals or sits below the average', () => {
    expect(sessionsAbove([10, 11], [ready(9), ready(11)])).toBe(0);
  });
  it('stops at a warming-up average instead of counting through it', () => {
    expect(sessionsAbove([10, 11, 12], [warm, ready(10), ready(11)])).toBe(2);
  });
});

describe('sampleTaFinding', () => {
  it('states the run above the 20-day and the distance to the 50-day', () => {
    const closes = [100, 101, 102];
    const e20 = [ready(99), ready(100), ready(101)];
    const e50 = [warm, warm, ready(100)];
    expect(sampleTaFinding('SPY', closes, e20, e50, 'Oct 7')).toBe(
      'In the sample, SPY has closed above its 20-day average for 3 sessions and sits 2.0% above the 50-day',
    );
  });
  it('says below, with a signed distance, when the last close is not above the 20-day', () => {
    const e20 = [ready(100), ready(100)];
    const e50 = [ready(100), ready(100)];
    expect(sampleTaFinding('SPY', [101, 98], e20, e50, 'Oct 7')).toBe(
      'In the sample, SPY closed at or below its 20-day average on Oct 7, −2.0% against the 50-day',
    );
  });
});
