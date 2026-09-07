import { describe, expect, it } from 'vitest';
import { evaluateRule } from './evaluate';
import { LEVEL_LABEL } from './labels';
import type { AlertRule } from './types';

const baseRule = (over: Partial<AlertRule>): AlertRule => ({
  id: 'r1',
  kind: 'score_gate',
  symbol: 'SPY',
  enabled: true,
  createdAt: 1,
  ...over,
});

describe('evaluateRule', () => {
  it('fires score_gate on cross above threshold', () => {
    const rule = baseRule({ kind: 'score_gate', scoreMin: 70 });
    const first = evaluateRule(rule, { symbol: 'SPY', score: 60 }, {});
    expect(first.event).toBeNull();
    const second = evaluateRule(rule, { symbol: 'SPY', score: 75 }, first.memory);
    expect(second.event?.message).toMatch(/score ≥ 70/);
  });

  it('fires tier_change when tier differs from last', () => {
    const rule = baseRule({ kind: 'tier_change' });
    const a = evaluateRule(rule, { symbol: 'SPY', tier: 'watch' }, {});
    expect(a.event).toBeNull();
    const b = evaluateRule(rule, { symbol: 'SPY', tier: 'actionable' }, a.memory);
    expect(b.event?.message).toMatch(/watch → actionable/);
  });

  it('fires level_touch when price crosses flip', () => {
    const rule = baseRule({ kind: 'level_touch', level: 'gamma_flip' });
    const a = evaluateRule(
      rule,
      { symbol: 'SPY', price: 100, gamma_flip: 105 },
      { lastPrice: 100 },
    );
    expect(a.event).toBeNull();
    const b = evaluateRule(rule, { symbol: 'SPY', price: 106, gamma_flip: 105 }, a.memory);
    expect(b.event?.message).toMatch(/touched gamma flip/i);
  });

  // curvature-v2-surfaces U-23a (FE-10): the firing's label now comes from the SAME closed
  // `LEVELS` lookup `AlertsPage.tsx`'s rule row reads — a new firing and its rule read the same
  // words, byte-for-byte, never a raw `level.replace('_', ' ')` transform of the wire token.
  it('the level_touch firing label is the closed LEVELS lookup label, byte-for-byte — not a raw transform of the wire token', () => {
    const rule = baseRule({ kind: 'level_touch', level: 'call_wall' });
    const a = evaluateRule(rule, { symbol: 'SPY', price: 100, call_wall: 105 }, { lastPrice: 100 });
    const b = evaluateRule(rule, { symbol: 'SPY', price: 106, call_wall: 105 }, a.memory);
    expect(b.event?.message).toBe(`SPY touched ${LEVEL_LABEL.call_wall}`);
    expect(b.event?.message).toBe('SPY touched Call wall');
  });

  it('a price-threshold level_touch firing still renders the raw `$` value, never the "Price threshold" label', () => {
    const rule = baseRule({ kind: 'level_touch', level: 'price', priceThreshold: 500 });
    const a = evaluateRule(rule, { symbol: 'SPY', price: 495 }, {});
    expect(a.event).toBeNull();
    const b = evaluateRule(rule, { symbol: 'SPY', price: 502 }, a.memory);
    expect(b.event?.message).toBe('SPY touched $500');
  });
});
