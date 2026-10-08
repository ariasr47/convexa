import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aaplSeed from './catalog/aapl.seed.json';
import msftSeed from './catalog/msft.seed.json';
import nvdaSeed from './catalog/nvda.seed.json';
import qqqSeed from './catalog/qqq.seed.json';
import spySeed from './catalog/spy.seed.json';
import tslaSeed from './catalog/tsla.seed.json';

const { fetchSeedAssetMock } = vi.hoisted(() => ({ fetchSeedAssetMock: vi.fn() }));
vi.mock('./catalog/asset-fetch', () => ({ fetchScenarioSeedAsset: fetchSeedAssetMock }));
const canonicalSeeds = { SPY: spySeed, QQQ: qqqSeed, AAPL: aaplSeed, MSFT: msftSeed, NVDA: nvdaSeed, TSLA: tslaSeed };
const canonicalScenarioSeedForAsset = (assetUrl: string) => {
  const symbol = (Object.keys(canonicalSeeds) as (keyof typeof canonicalSeeds)[]).find((item) => assetUrl.toLowerCase().includes(`/${item.toLowerCase()}.seed.json`));
  if (!symbol) throw new Error(`Unknown catalog asset ${assetUrl}`);
  return canonicalSeeds[symbol];
};

function installStorage() {
  const values = new Map<string, string>();
  const storage = { get length() { return values.size; }, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }, key: (index: number) => [...values.keys()][index] ?? null };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
}

describe('demo HTTP projections', () => {
  beforeEach(() => { fetchSeedAssetMock.mockImplementation(async (assetUrl: string) => canonicalScenarioSeedForAsset(assetUrl)); });
  afterEach(() => { vi.resetModules(); delete window.__CONVEXA_BOOT__; });

  it('keeps ticker, scanner, history, contracts, and recommendation projections on one authored variant', async () => {
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const [{ demoFetch }, { loadScenario }, { EXPIRIES }] = await Promise.all([
      import('./transport'), import('./catalog'), import('./catalog/shared'),
    ]);
    const all = await demoFetch(new Request('http://localhost/api/ticker/SPY'));
    expect(all.status).toBe(200);
    const full = await all.json() as import('../convexa').TickerBundle;
    const state = full.market_state;
    const strikes = full.strike_profile.strikes;
    expect(Number(state.net_gex)).toBeCloseTo(strikes.reduce((sum, row) => sum + row.net_gex, 0), 2);
    expect(Number(state.call_gex)).toBeCloseTo(strikes.reduce((sum, row) => sum + row.call_gex, 0), 2);
    expect(Number(state.put_gex)).toBeCloseTo(strikes.reduce((sum, row) => sum + row.put_gex, 0), 2);
    expect(Number(state.net_dex)).toBeCloseTo(strikes.reduce((sum, row) => sum + (row.net_dex ?? 0), 0), 2);
    expect(Number(state.call_dex)).toBeCloseTo(strikes.reduce((sum, row) => sum + (row.call_dex ?? 0), 0), 2);
    expect(Number(state.put_dex)).toBeCloseTo(strikes.reduce((sum, row) => sum + (row.put_dex ?? 0), 0), 2);
    const scoreDrivers = full.signals.score_drivers;
    expect(scoreDrivers).not.toBeNull();
    if (!scoreDrivers) throw new Error('The curated ticker scenario must include score-driver totals.');
    expect(scoreDrivers.total).toBe(full.signals.opportunity_score);
    expect(scoreDrivers.proximity + scoreDrivers.setups + scoreDrivers.vol + scoreDrivers.transition + scoreDrivers.dark_pool).toBe(full.signals.opportunity_score);
    expect(full.signals.distances.gamma_flip_pct).toBe(Number(((state.gamma_flip - state.price) / state.price).toFixed(4)));

    const novemberResponse = await demoFetch(new Request('http://localhost/api/ticker/SPY?min_dte=44&max_dte=60'));
    const november = await novemberResponse.json() as import('../convexa').TickerBundle;
    expect(november.market_state.call_wall).not.toBe(state.call_wall);
    expect(november.market_state.gamma_flip).not.toBe(state.gamma_flip);
    expect(november.signals.distances.gamma_flip_pct).toBe(Number(((november.market_state.gamma_flip - november.market_state.price) / november.market_state.price).toFixed(4)));
    expect(november.state_fingerprint).not.toBe(full.state_fingerprint);

    const scanResponse = await demoFetch(new Request('http://localhost/api/scan'));
    const scan = await scanResponse.json() as import('../convexa').ScanResponse;
    const spyRow = scan.rows.find((row) => row.symbol === 'SPY')!;
    expect(spyRow.status).toBe('ok');
    expect(spyRow.dist_to_flip_pct).toBe(Number(((spyRow.price! - spyRow.flip!) / spyRow.price! * 100).toFixed(2)));
    expect(spyRow.dist_to_flip_pct).toBeGreaterThan(0);

    const scenario = await loadScenario('SPY');
    const novemberVariant = scenario!.variants[EXPIRIES[2]];
    const request = new Request('http://localhost/api/recommendation/SPY', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot_fingerprint: novemberVariant.fingerprint, dte_min: 44, dte_max: 60, persona_id: 'demo-careful-reader', dark_pool: true, override: false }) });
    const recResponse = await demoFetch(request);
    expect(recResponse.status).toBe(200);
    const rec = await recResponse.json() as import('../convexa').RecResponse;
    expect(rec.strategy).not.toBeNull();
    if (!rec.strategy) throw new Error('The authored recommendation must include a strategy.');
    expect(rec.pinned_fingerprint).toBe(novemberVariant.fingerprint);
    expect(rec.strategy.summary).toContain('Authored sample');
    expect(rec.strategy.rationale).toContain(novemberVariant.setup.toLowerCase());
    expect(rec.status).toBe('produced');
    const noncontiguousKey = `${EXPIRIES[0]},${EXPIRIES[2]}`;
    const noncontiguousVariant = scenario!.variants[noncontiguousKey];
    const noncontiguous = await demoFetch(new Request('http://localhost/api/recommendation/SPY', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot_fingerprint: noncontiguousVariant.fingerprint, dte_min: 2, dte_max: 44 }) }));
    expect(noncontiguous.status).toBe(200);
    expect((await noncontiguous.json() as import('../convexa').RecResponse).pinned_fingerprint).toBe(noncontiguousVariant.fingerprint);
    const missingFingerprint = await demoFetch(new Request('http://localhost/api/recommendation/SPY', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dte_min: 2, dte_max: 44 }) }));
    expect(missingFingerprint.status).toBe(501);
    const unknownFingerprint = await demoFetch(new Request('http://localhost/api/recommendation/SPY', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot_fingerprint: 'unknown-sample', dte_min: 2, dte_max: 44 }) }));
    expect(unknownFingerprint.status).toBe(501);
    const stale = await demoFetch(new Request('http://localhost/api/recommendation/SPY', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot_fingerprint: scenario!.variants[EXPIRIES.join(',')].fingerprint, dte_min: 44, dte_max: 60 }) }));
    expect(stale.status).toBe(501);

    const statusResponse = await demoFetch(new Request('http://localhost/api/recommendation/status/spy'));
    expect(await statusResponse.json()).toMatchObject({ availability: { in_app_enabled: false }, gate: { state: 'available' }, powering: { unavailable_reason: 'no_key' } });
    const exportResponse = await demoFetch(new Request('http://localhost/api/recommendation/export/spy?min_dte=44&max_dte=44'));
    const exportBody = await exportResponse.json() as import('../convexa').RecExport;
    expect(exportBody.context.candidates.ticker).toBe('SPY');
    expect(exportBody.glossary).toContain(scenario!.variants[EXPIRIES[2]].fingerprint);
    expect(exportBody.egress_categories).toHaveLength(6);
    expect(exportBody.egress_categories.every((item) => !item.sent)).toBe(true);
    expect('strategy' in exportBody).toBe(false);
    const api = await import('../convexa');
    expect(await api.fetchRecStatus('spy')).toMatchObject({ availability: { in_app_enabled: false }, gate: { state: 'available' }, powering: { unavailable_reason: 'no_key' } });
    const projectedExport = await api.fetchRecExport('spy');
    expect(projectedExport.glossary).toContain(scenario!.variants[EXPIRIES.join(',')].fingerprint);
    const selectedExport = await api.fetchRecExport('spy', { sampleFingerprint: noncontiguousVariant.fingerprint });
    expect(selectedExport.glossary).toContain(noncontiguousVariant.fingerprint);
    expect(selectedExport.glossary).not.toContain(scenario!.variants[EXPIRIES.join(',')].fingerprint);
    const unknownExport = await demoFetch(new Request('http://localhost/api/recommendation/export/spy', { headers: { 'x-convexa-sample-fingerprint': 'unknown-sample' } }));
    expect(unknownExport.status).toBe(501);

    const tickerProjection = await demoFetch(new Request('http://localhost/api/ticker/spy?expirations=2026-10-09,2026-11-20'));
    const selected = await tickerProjection.json() as import('../convexa').TickerBundle;
    expect(selected.signals.opportunity_tier).toBe('actionable');
    expect(selected.signals.setups[0].conviction).toBe('medium');
    expect(selected.market_state.straddle_move?.session_basis).toBe('rth');

    const historyResponse = await demoFetch(new Request('http://localhost/api/scan/SPY/history?limit=2'));
    const history = await historyResponse.json() as import('../convexa').StructureHistoryResponse;
    expect(history.samples).toHaveLength(2);
    expect(history.samples[1].price).toBe(scenario!.bars.at(-1)!.close);
    const contract = await demoFetch(new Request('http://localhost/api/contract/SPY?expiration=2026-10-16&strike=690&right=call'));
    expect(contract.status).toBe(200);
    expect((await contract.json() as { option_quote: { mid: number } }).option_quote.mid).toBe(2.47);
    const candidates = await demoFetch(new Request('http://localhost/api/candidates/SPY'));
    expect(await candidates.json()).toMatchObject({ ticker: 'SPY', state: 'unavailable', contracts: [], sent_to_model: false });

    const brokerBook = await demoFetch(new Request('http://localhost/api/broker/book'));
    const refreshedBook = await demoFetch(new Request('http://localhost/api/broker/book/refresh', { method: 'POST' }));
    expect(refreshedBook.status).toBe(200);
    expect(await refreshedBook.json()).toEqual(await brokerBook.json());
    const brokerApi = await import('../broker');
    expect((await brokerApi.fetchBrokerBook()).basis).toBe('cache');
    expect((await brokerApi.refreshBrokerBook()).positions).toHaveLength(1);
  });
});
