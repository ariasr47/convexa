import { describe, expect, it } from 'vitest';
import { effectiveExpiries, loadScenario, SYMBOLS } from './index';
import { assertCuratedVariants, EXPIRIES } from './shared';

describe('authored scenario catalog', () => {
  it('has six lazy symbol modules with 60 ordered bars and seven curated nonempty expiry sets each', async () => {
    expect(SYMBOLS).toEqual(['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA']);
    const keys = Array.from({ length: 7 }, (_, i) => EXPIRIES.filter((_, bit) => i + 1 & (1 << bit)).join(','));
    const scenarios = await Promise.all(SYMBOLS.map((symbol) => loadScenario(symbol)));
    for (const scenario of scenarios) {
      expect(scenario).not.toBeNull();
      expect(scenario!.bars).toHaveLength(60);
      expect(scenario!.bars.at(-1)?.date).toBe('2026-10-07');
      expect(new Set(scenario!.bars.map((bar) => bar.id)).size).toBe(60);
      expect(Object.keys(scenario!.variants).sort()).toEqual(keys.sort());
      expect(scenario!.research.evidence.every((fact) => fact.state !== 'present' || fact.sourceIds.every((id) => scenario!.bars.some((bar) => bar.id === id)))).toBe(true);
    }
    const spy = await loadScenario('SPY');
    expect(spy).not.toBeNull();
    if (!spy) throw new Error('SPY sample scenario is required for the curated variant oracle.');
    const all = spy.variants[EXPIRIES.join(',')];
    const november = spy.variants[EXPIRIES[2]];
    expect(november.wall).not.toBe(all.wall);
    expect(november.flip).not.toBe(all.flip);
    expect(november.distance).not.toBe(all.distance);
    expect(november.setup).not.toBe(all.setup);
    expect(november.score).not.toBe(all.score);
    expect(november.fingerprint).not.toBe(all.fingerprint);
    const poisoned = { ...spy.variants, [EXPIRIES[2]]: { ...november, fingerprint: all.fingerprint } };
    expect(() => assertCuratedVariants('SPY', poisoned)).toThrow(/seven unique curated expiry patches/);
  });

  it('intersects DTE and explicit expiry bounds and rejects unsupported projections', () => {
    const minimumDte = effectiveExpiries({ minDte: 9 });
    expect(minimumDte.state).toBe('ready');
    if (minimumDte.state !== 'ready') throw new Error('A valid DTE projection should have curated expiries.');
    expect(minimumDte.dates).toEqual(['2026-10-16', '2026-11-20']);
    expect(effectiveExpiries({ expirations: ['2026-11-20', '2026-10-09', '2026-11-20'] })).toMatchObject({ state: 'ready', dates: ['2026-10-09', '2026-11-20'] });
    expect(effectiveExpiries({ minDte: 45 }).state).toBe('unsupported');
    expect(effectiveExpiries({ darkPool: false }).state).toBe('unsupported');
  });
});
