// The demo's authored reads carry a grounding block, and the AI read panel prints its card as the
// read's trace line. The contract's card rule (archived ai-rec-grounding INTERFACE_CONTRACT,
// `grounding.card`; the API's grounding.rs `card_member`) is what keeps a no-trade read from claiming
// traced figures: a demo that graded one "all traced" taught the reader a state the API never sends.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aaplSeed from './catalog/aapl.seed.json';
import msftSeed from './catalog/msft.seed.json';
import nvdaSeed from './catalog/nvda.seed.json';
import qqqSeed from './catalog/qqq.seed.json';
import spySeed from './catalog/spy.seed.json';
import tslaSeed from './catalog/tsla.seed.json';

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

const counts = (checked: number, traced: number, untraced: number, notCheckable: number) => ({
  checked,
  traced,
  untraced,
  not_checkable: notCheckable,
});

describe('groundingCard: the contract’s fixed order, first match wins', () => {
  it('is not applicable whenever the read states no trade, whatever was checked', async () => {
    const { groundingCard } = await import('./transport');
    expect(groundingCard('no_trade', counts(0, 0, 0, 0))).toBe('not_applicable');
    expect(groundingCard('no_trade', counts(1, 1, 0, 0))).toBe('not_applicable');
    expect(groundingCard('no_trade', counts(4, 3, 1, 0))).toBe('not_applicable');
    expect(groundingCard('no_trade', counts(2, 0, 2, 0), true)).toBe('not_applicable');
  });

  it('grades a trade read by its counts, local rules preempted only by an empty check', async () => {
    const { groundingCard } = await import('./transport');
    expect(groundingCard('trade', counts(0, 0, 0, 0))).toBe('not_applicable');
    expect(groundingCard('trade', counts(0, 0, 0, 0), true)).toBe('not_applicable');
    expect(groundingCard('trade', counts(2, 1, 1, 0), true)).toBe('local_rules');
    expect(groundingCard('trade', counts(2, 0, 1, 1))).toBe('none_traced');
    expect(groundingCard('trade', counts(2, 0, 0, 2))).toBe('could_not_check');
    expect(groundingCard('trade', counts(4, 3, 1, 0))).toBe('some_traced');
    expect(groundingCard('trade', counts(3, 3, 0, 0))).toBe('all_traced');
  });

  it('tallies counts as the API does: not applicable and structural gaps are not checked', async () => {
    const { groundingCounts } = await import('./transport');
    const field = (state: string, reason: string | null = null) => ({
      state,
      basis: null,
      anchor_kind: null,
      anchor_value: null,
      range_low: null,
      range_high: null,
      expiration: null,
      not_checkable_reason: reason,
    });
    expect(
      groundingCounts({
        exit_stop: field('traced'),
        exit_target: field('untraced'),
        invalidation_level: field('not_checkable', 'no_named_level'),
        max_risk: field('not_checkable', 'structurally_unchecked'),
        position_size: field('not_applicable'),
      }),
    ).toEqual(counts(3, 1, 1, 1));
  });
});

describe('every authored read obeys the card rule (all six symbols, all seven expiry sets)', () => {
  beforeEach(() => {
    // The mode is read when the transport module loads: load it fresh, in demo mode.
    vi.resetModules();
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

  it('grades each read by its own decision and counts, and states no figure on a no-trade read', async () => {
    const { demoFetch, groundingCard } = await import('./transport');
    const { DTE, loadScenario } = await import('./catalog');
    let reads = 0;
    for (const symbol of SYMBOLS) {
      const scenario = await loadScenario(symbol);
      for (const [key, variant] of Object.entries(scenario!.variants)) {
        const dtes = key.split(',').map((date) => DTE[date as keyof typeof DTE]);
        const res = await demoFetch(
          new Request(`http://localhost/api/recommendation/${symbol}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              snapshot_fingerprint: variant.fingerprint,
              dte_min: Math.min(...dtes),
              dte_max: Math.max(...dtes),
              persona_id: 'demo-careful-reader',
              dark_pool: true,
              override: false,
            }),
          }),
        );
        expect(
          res.status,
          `${symbol} ${key}: ${res.status === 200 ? '' : await res.clone().text()}`,
        ).toBe(200);
        const rec = (await res.json()) as import('../convexa').RecResponse & {
          grounding: { card: string; counts: Record<string, number> };
        };
        const decision = rec.strategy!.decision;
        const c = rec.grounding.counts;
        expect(c.traced + c.untraced + c.not_checkable).toBe(c.checked);
        expect(rec.grounding.card).toBe(
          groundingCard(decision, {
            checked: c.checked,
            traced: c.traced,
            untraced: c.untraced,
            not_checkable: c.not_checkable,
          }),
        );
        if (decision !== 'trade') {
          expect(rec.grounding.card).toBe('not_applicable');
          expect(rec.strategy!.invalidation_level ?? null).toBeNull();
        }
        // Provenance is not a reason: the Why list carries only reasons.
        expect(rec.strategy!.key_points ?? []).not.toContainEqual(
          expect.stringMatching(/No live market|fingerprint/i),
        );
        reads += 1;
      }
    }
    expect(reads).toBe(42);
  });
});
