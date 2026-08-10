import { describe, expect, it } from 'vitest';
import { evaluateRule } from './evaluate';
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
});
