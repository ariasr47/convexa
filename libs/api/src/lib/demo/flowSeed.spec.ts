import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aaplSeed from './catalog/aapl.seed.json';
import msftSeed from './catalog/msft.seed.json';
import nvdaSeed from './catalog/nvda.seed.json';
import qqqSeed from './catalog/qqq.seed.json';
import { makeScenario } from './catalog/shared';
import spySeed from './catalog/spy.seed.json';
import tslaSeed from './catalog/tsla.seed.json';
import { callDelta, flowSeed, normalCdf } from './flowSeed';

const { fetchSeedAssetMock } = vi.hoisted(() => ({ fetchSeedAssetMock: vi.fn() }));
vi.mock('./catalog/asset-fetch', () => ({ fetchScenarioSeedAsset: fetchSeedAssetMock }));
const SEEDS = {
  SPY: spySeed,
  QQQ: qqqSeed,
  AAPL: aaplSeed,
  MSFT: msftSeed,
  NVDA: nvdaSeed,
  TSLA: tslaSeed,
};
type Sym = keyof typeof SEEDS;
const SYMBOLS = Object.keys(SEEDS) as Sym[];

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return values.size;
      },
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
    },
  });
}

describe('flowSeed: the pure derivation', () => {
  it('is deterministic: the same bars and IV give the same figures', () => {
    const s = makeScenario('SPY', spySeed.base, spySeed.step, spySeed.phase);
    expect(flowSeed({ bars: s.bars, atmIvPct: 25.32 })).toEqual(
      flowSeed({ bars: s.bars, atmIvPct: 25.32 }),
    );
  });

  it('steepens the put skew after a fall and flattens it after a rise', () => {
    const rising = Array.from({ length: 30 }, (_, i) => ({ close: 100 + i }));
    const falling = Array.from({ length: 30 }, (_, i) => ({ close: 130 - i }));
    const up = flowSeed({ bars: rising, atmIvPct: 25 });
    const down = flowSeed({ bars: falling, atmIvPct: 25 });
    expect(down.skewPts).toBeGreaterThan(up.skewPts);
    expect(up.skewPts).toBeGreaterThan(0);
    // A close at the top of its range reads the lowest off-exchange share, at the bottom the highest.
    expect(up.rangePosition).toBe(1);
    expect(down.rangePosition).toBe(0);
    expect(up.offExchangeShare).toBeCloseTo(0.32, 6);
    expect(down.offExchangeShare).toBeCloseTo(0.48, 6);
    // More volume against open interest the further the window moved, capped at double.
    expect(up.volumeMultiplier).toBeGreaterThan(1);
    expect(up.volumeMultiplier).toBeLessThanOrEqual(2);
  });

  it('refuses a broken seed rather than inventing figures', () => {
    expect(() => flowSeed({ bars: [{ close: 1 }], atmIvPct: 25 })).toThrow(/bars/);
    const s = makeScenario('SPY', spySeed.base, spySeed.step, spySeed.phase);
    expect(() => flowSeed({ bars: s.bars, atmIvPct: 0 })).toThrow(/IV/);
  });

  it('prices delta like Black-Scholes: N(0) is a half, deep in the money tends to one', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
    expect(callDelta(100, 100, 25, 9)).toBeGreaterThan(0.5);
    expect(callDelta(100, 100, 25, 9)).toBeLessThan(0.52);
    expect(callDelta(100, 80, 25, 9)).toBeGreaterThan(0.99);
    expect(callDelta(100, 120, 25, 9)).toBeLessThan(0.01);
  });
});

describe('the demo bundle: per-symbol flow figures (site check D-22)', () => {
  beforeEach(() => {
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    fetchSeedAssetMock.mockImplementation(async (assetUrl: string) => {
      const symbol = SYMBOLS.find((s) => assetUrl.toLowerCase().includes(`/${s.toLowerCase()}.`));
      if (!symbol) throw new Error(`Unknown catalog asset ${assetUrl}`);
      return SEEDS[symbol];
    });
  });
  afterEach(() => {
    vi.resetModules();
    delete window.__CONVEXA_BOOT__;
  });

  async function bundles() {
    const { demoFetch } = await import('./transport');
    const out = {} as Record<Sym, import('../convexa').TickerBundle>;
    for (const symbol of SYMBOLS) {
      const res = await demoFetch(new Request(`http://localhost/api/ticker/${symbol}`));
      expect(res.status).toBe(200);
      out[symbol] = (await res.json()) as import('../convexa').TickerBundle;
    }
    return out;
  }

  it('gives each of the six symbols its own Net DEX, Vol/OI, IV skew and off-exchange share', async () => {
    const all = await bundles();
    const figures = SYMBOLS.map((s) => {
      const m = all[s].market_state;
      return {
        netDex: m.net_dex,
        volOi: m.chain_vol_oi_ratio,
        skew: m.iv_skew?.slope,
        offex: all[s].off_exchange?.ratio_pct,
      };
    });
    for (const key of ['netDex', 'volOi', 'skew', 'offex'] as const) {
      const values = figures.map((f) => f[key]);
      expect(
        values.every((v) => typeof v === 'number' && Number.isFinite(v)),
        key,
      ).toBe(true);
      expect(new Set(values).size, `${key} differs per symbol: ${values.join(', ')}`).toBe(6);
    }
  });

  it('is deterministic across loads, and stays inside each figure’s sample band', async () => {
    const first = await bundles();
    vi.resetModules();
    const second = await bundles();
    for (const s of SYMBOLS) {
      const a = first[s];
      const b = second[s];
      expect(b.market_state.net_dex).toBe(a.market_state.net_dex);
      expect(b.market_state.chain_vol_oi_ratio).toBe(a.market_state.chain_vol_oi_ratio);
      expect(b.market_state.iv_skew?.slope).toBe(a.market_state.iv_skew?.slope);
      expect(b.off_exchange?.ratio_pct).toBe(a.off_exchange?.ratio_pct);
      expect(a.off_exchange!.ratio_pct!).toBeGreaterThanOrEqual(32);
      expect(a.off_exchange!.ratio_pct!).toBeLessThanOrEqual(48);
      expect(a.market_state.iv_skew!.slope).toBeGreaterThan(0);
      // Net DEX is the API's dollar delta: calls positive, puts negative, net their sum.
      expect(a.market_state.call_dex!).toBeGreaterThan(0);
      expect(a.market_state.put_dex!).toBeLessThan(0);
      // Every unusual strike stays at or over the 1× cut, so Fresh positioning keeps its rows.
      const unusual = a.strike_profile.strikes.filter((row) => (row.vol_oi_ratio ?? 0) >= 1);
      expect(unusual.length).toBe(3);
    }
  });

  it('carries the prior session’s close, and the masthead change matches the scanner’s Chg %', async () => {
    const { loadSampleQuote, dayChange } = await import('./views');
    const { closeToClosePct } = await import('./transport');
    for (const symbol of SYMBOLS) {
      const s = makeScenario(symbol, SEEDS[symbol].base, SEEDS[symbol].step, SEEDS[symbol].phase);
      expect(s.priorClose).toBe(s.bars.at(-2)!.close);
      const quote = await loadSampleQuote(symbol);
      expect(quote.state).toBe('ready');
      if (quote.state !== 'ready') continue;
      expect(quote.value.priorDate).toBe('2026-10-06');
      const change = dayChange(quote.value.last, quote.value.priorClose);
      expect(change?.pct).toBe(closeToClosePct(s.bars));
    }
  });
});

describe('dayChange', () => {
  it('carries the sign as a word and rounds to cents and hundredths of a percent', async () => {
    const { dayChange } = await import('./views');
    expect(dayChange(690.62, 688.43)).toEqual({ change: 2.19, pct: 0.32, direction: 'up' });
    expect(dayChange(100, 101)).toEqual({ change: -1, pct: -0.99, direction: 'down' });
    expect(dayChange(100, 100)).toEqual({ change: 0, pct: 0, direction: 'flat' });
  });

  it('shows nothing rather than a made-up change when either side is missing', async () => {
    const { dayChange } = await import('./views');
    expect(dayChange(null, 100)).toBeNull();
    expect(dayChange(100, undefined)).toBeNull();
    expect(dayChange(100, 0)).toBeNull();
    expect(dayChange(Number.NaN, 100)).toBeNull();
  });
});
