import { beforeEach, describe, expect, it, vi } from 'vitest';
import aaplSeed from './aapl.seed.json';
import { effectiveExpiries, loadScenario, SYMBOLS } from './index';
import msftSeed from './msft.seed.json';
import nvdaSeed from './nvda.seed.json';
import qqqSeed from './qqq.seed.json';
import { assertCuratedVariants, EXPIRIES } from './shared';
import spySeed from './spy.seed.json';
import tslaSeed from './tsla.seed.json';

const { fetchSeedAssetMock } = vi.hoisted(() => ({ fetchSeedAssetMock: vi.fn() }));
vi.mock('./asset-fetch', () => ({ fetchScenarioSeedAsset: fetchSeedAssetMock }));
const canonicalSeeds = {
  SPY: spySeed,
  QQQ: qqqSeed,
  AAPL: aaplSeed,
  MSFT: msftSeed,
  NVDA: nvdaSeed,
  TSLA: tslaSeed,
};
const canonicalScenarioSeedForAsset = (assetUrl: string) => {
  const symbol = (Object.keys(canonicalSeeds) as (keyof typeof canonicalSeeds)[]).find((item) =>
    assetUrl.toLowerCase().includes(`/${item.toLowerCase()}.seed.json`),
  );
  if (!symbol) throw new Error(`Unknown catalog asset ${assetUrl}`);
  return canonicalSeeds[symbol];
};
beforeEach(() => {
  fetchSeedAssetMock.mockImplementation(async (assetUrl: string) =>
    canonicalScenarioSeedForAsset(assetUrl),
  );
});

describe('authored scenario catalog', () => {
  it('has six lazy seed assets with 60 ordered bars and seven curated nonempty expiry sets each', async () => {
    expect(SYMBOLS).toEqual(['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA']);
    const keys = Array.from({ length: 7 }, (_, i) =>
      EXPIRIES.filter((_, bit) => (i + 1) & (1 << bit)).join(','),
    );
    const scenarios = await Promise.all(SYMBOLS.map((symbol) => loadScenario(symbol)));
    for (const scenario of scenarios) {
      expect(scenario).not.toBeNull();
      expect(scenario!.bars).toHaveLength(60);
      expect(scenario!.bars.at(-1)?.date).toBe('2026-10-07');
      expect(new Set(scenario!.bars.map((bar) => bar.id)).size).toBe(60);
      expect(Object.keys(scenario!.variants).sort()).toEqual(keys.sort());
      expect(
        scenario!.research.evidence.every(
          (fact) =>
            fact.state !== 'present' ||
            fact.sourceIds.every((id) => scenario!.bars.some((bar) => bar.id === id)),
        ),
      ).toBe(true);
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
    const poisoned = {
      ...spy.variants,
      [EXPIRIES[2]]: { ...november, fingerprint: all.fingerprint },
    };
    expect(() => assertCuratedVariants('SPY', poisoned)).toThrow(
      /seven unique curated expiry patches/,
    );
  });

  it('retries a failed seed fetch, shares in-flight work, and caches only validated success', async () => {
    vi.resetModules();
    const { loadScenario: retryLoad } = await import('./index');
    const requests: string[] = [];
    let resolveSeed: ((value: unknown) => void) | undefined;
    fetchSeedAssetMock.mockImplementation((url: string) => {
      requests.push(url);
      if (requests.length === 1) {
        return Promise.reject(new Error('temporary asset failure'));
      }
      return new Promise((resolve) => {
        resolveSeed = resolve;
      });
    });

    await expect(retryLoad('SPY')).rejects.toThrow('temporary asset failure');
    const retry = retryLoad('spy');
    const concurrent = retryLoad('SPY');
    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain('/spy.seed.json');
    expect(requests[1]).toBe(requests[0]);
    resolveSeed?.(spySeed);
    const [scenario, sameScenario] = await Promise.all([retry, concurrent]);
    expect(scenario).not.toBeNull();
    expect(sameScenario).toBe(scenario);
    expect(await retryLoad('SPY')).toBe(scenario);
    expect(requests).toHaveLength(2);

    vi.resetModules();
    const { loadScenario: invalidLoad } = await import('./index');
    fetchSeedAssetMock.mockReset();
    fetchSeedAssetMock.mockResolvedValue({ ...spySeed, symbol: 'QQQ' });
    await expect(invalidLoad('SPY')).rejects.toThrow('Invalid SPY scenario seed');
  });

  it('intersects DTE and explicit expiry bounds and rejects unsupported projections', () => {
    const minimumDte = effectiveExpiries({ minDte: 9 });
    expect(minimumDte.state).toBe('ready');
    if (minimumDte.state !== 'ready')
      throw new Error('A valid DTE projection should have curated expiries.');
    expect(minimumDte.dates).toEqual(['2026-10-16', '2026-11-20']);
    expect(
      effectiveExpiries({ expirations: ['2026-11-20', '2026-10-09', '2026-11-20'] }),
    ).toMatchObject({ state: 'ready', dates: ['2026-10-09', '2026-11-20'] });
    expect(effectiveExpiries({ minDte: 45 }).state).toBe('unsupported');
    expect(effectiveExpiries({ darkPool: false }).state).toBe('unsupported');
  });
});
