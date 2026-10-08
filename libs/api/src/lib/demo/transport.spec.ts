import { afterEach, describe, expect, it, vi } from 'vitest';

function installStorage() {
  const values = new Map<string, string>();
  const storage = { get length() { return values.size; }, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }, key: (index: number) => [...values.keys()][index] ?? null };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
}

describe('demo HTTP projections', () => {
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
    expect(full.signals.score_drivers.total).toBe(full.signals.opportunity_score);
    expect(full.signals.score_drivers.proximity + full.signals.score_drivers.setups + full.signals.score_drivers.vol + full.signals.score_drivers.transition + full.signals.score_drivers.dark_pool).toBe(full.signals.opportunity_score);
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
    expect(spyRow.dist_to_flip_pct).toBe(Number(((spyRow.price! - spyRow.flip!) / spyRow.price! * 100).toFixed(2)));
    expect(spyRow.dist_to_flip_pct).toBeGreaterThan(0);

    const scenario = await loadScenario('SPY');
    const novemberVariant = scenario!.variants[EXPIRIES[2]];
    const request = new Request('http://localhost/api/recommendation/SPY', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot_fingerprint: novemberVariant.fingerprint, dte_min: 44, dte_max: 60, persona_id: 'demo-careful-reader', dark_pool: true, override: false }) });
    const recResponse = await demoFetch(request);
    expect(recResponse.status).toBe(200);
    const rec = await recResponse.json() as { pinned_fingerprint: string; strategy: { summary: string; rationale: string } };
    expect(rec.pinned_fingerprint).toBe(novemberVariant.fingerprint);
    expect(rec.strategy.summary).toContain('Authored sample');
    expect(rec.strategy.rationale).toContain(novemberVariant.setup.toLowerCase());
    const stale = await demoFetch(new Request('http://localhost/api/recommendation/SPY', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot_fingerprint: scenario!.variants[EXPIRIES.join(',')].fingerprint, dte_min: 44, dte_max: 60 }) }));
    expect(stale.status).toBe(501);

    const historyResponse = await demoFetch(new Request('http://localhost/api/scan/SPY/history?limit=2'));
    const history = await historyResponse.json() as import('../convexa').StructureHistoryResponse;
    expect(history.samples).toHaveLength(2);
    expect(history.samples[1].price).toBe(scenario!.bars.at(-1)!.close);
    const contract = await demoFetch(new Request('http://localhost/api/contract/SPY?expiration=2026-10-16&strike=690&right=call'));
    expect(contract.status).toBe(200);
    expect((await contract.json() as { option_quote: { mid: number } }).option_quote.mid).toBe(2.47);
    const candidates = await demoFetch(new Request('http://localhost/api/candidates/SPY'));
    expect(await candidates.json()).toMatchObject({ ticker: 'SPY', state: 'unavailable', contracts: [], sent_to_model: false });
  });
});
