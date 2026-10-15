import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aaplSeed from './catalog/aapl.seed.json';
import msftSeed from './catalog/msft.seed.json';
import nvdaSeed from './catalog/nvda.seed.json';
import qqqSeed from './catalog/qqq.seed.json';
import spySeed from './catalog/spy.seed.json';
import tslaSeed from './catalog/tsla.seed.json';

const { fetchSeedAssetMock } = vi.hoisted(() => ({ fetchSeedAssetMock: vi.fn() }));
vi.mock('./catalog/asset-fetch', () => ({ fetchScenarioSeedAsset: fetchSeedAssetMock }));
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

function installStorage() {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    key: (index: number) => [...values.keys()][index] ?? null,
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
}

describe('demo HTTP projections', () => {
  beforeEach(() => {
    fetchSeedAssetMock.mockImplementation(async (assetUrl: string) =>
      canonicalScenarioSeedForAsset(assetUrl),
    );
  });
  afterEach(() => {
    vi.resetModules();
    delete window.__CONVEXA_BOOT__;
  });

  it('keeps ticker, scanner, history, contracts, and recommendation projections on one authored variant', async () => {
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const [{ demoFetch }, { loadScenario }, { EXPIRIES }] = await Promise.all([
      import('./transport'),
      import('./catalog'),
      import('./catalog/shared'),
    ]);
    const all = await demoFetch(new Request('http://localhost/api/ticker/SPY'));
    expect(all.status).toBe(200);
    const full = (await all.json()) as import('../convexa').TickerBundle;
    const state = full.market_state;
    const strikes = full.strike_profile.strikes;
    expect(Number(state.net_gex)).toBeCloseTo(
      strikes.reduce((sum, row) => sum + row.net_gex, 0),
      2,
    );
    expect(Number(state.call_gex)).toBeCloseTo(
      strikes.reduce((sum, row) => sum + row.call_gex, 0),
      2,
    );
    expect(Number(state.put_gex)).toBeCloseTo(
      strikes.reduce((sum, row) => sum + row.put_gex, 0),
      2,
    );
    expect(Number(state.net_dex)).toBeCloseTo(
      strikes.reduce((sum, row) => sum + (row.net_dex ?? 0), 0),
      2,
    );
    expect(Number(state.call_dex)).toBeCloseTo(
      strikes.reduce((sum, row) => sum + (row.call_dex ?? 0), 0),
      2,
    );
    expect(Number(state.put_dex)).toBeCloseTo(
      strikes.reduce((sum, row) => sum + (row.put_dex ?? 0), 0),
      2,
    );
    const scoreDrivers = full.signals.score_drivers;
    expect(scoreDrivers).not.toBeNull();
    if (!scoreDrivers)
      throw new Error('The curated ticker scenario must include score-driver totals.');
    expect(scoreDrivers.total).toBe(full.signals.opportunity_score);
    expect(
      scoreDrivers.proximity +
        scoreDrivers.setups +
        scoreDrivers.vol +
        scoreDrivers.transition +
        scoreDrivers.dark_pool,
    ).toBe(full.signals.opportunity_score);
    expect(full.signals.distances.gamma_flip_pct).toBe(
      Number(((state.gamma_flip - state.price) / state.price).toFixed(4)),
    );

    const novemberResponse = await demoFetch(
      new Request('http://localhost/api/ticker/SPY?min_dte=44&max_dte=60'),
    );
    const november = (await novemberResponse.json()) as import('../convexa').TickerBundle;
    expect(november.market_state.call_wall).not.toBe(state.call_wall);
    expect(november.market_state.gamma_flip).not.toBe(state.gamma_flip);
    expect(november.signals.distances.gamma_flip_pct).toBe(
      Number(
        (
          (november.market_state.gamma_flip - november.market_state.price) /
          november.market_state.price
        ).toFixed(4),
      ),
    );
    expect(november.state_fingerprint).not.toBe(full.state_fingerprint);

    const scanResponse = await demoFetch(new Request('http://localhost/api/scan'));
    const scan = (await scanResponse.json()) as import('../convexa').ScanResponse;
    const spyRow = scan.rows.find((row) => row.symbol === 'SPY')!;
    expect(spyRow.status).toBe('ok');
    expect(spyRow.dist_to_flip_pct).toBe(
      Number((((spyRow.price! - spyRow.flip!) / spyRow.price!) * 100).toFixed(2)),
    );
    expect(spyRow.dist_to_flip_pct).toBeGreaterThan(0);

    const scenario = await loadScenario('SPY');
    const novemberVariant = scenario!.variants[EXPIRIES[2]];
    const request = new Request('http://localhost/api/recommendation/SPY', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        snapshot_fingerprint: novemberVariant.fingerprint,
        dte_min: 44,
        dte_max: 60,
        persona_id: 'demo-careful-reader',
        dark_pool: true,
        override: false,
      }),
    });
    const recResponse = await demoFetch(request);
    expect(recResponse.status).toBe(200);
    const rec = (await recResponse.json()) as import('../convexa').RecResponse;
    expect(rec.strategy).not.toBeNull();
    if (!rec.strategy) throw new Error('The authored recommendation must include a strategy.');
    expect(rec.pinned_fingerprint).toBe(novemberVariant.fingerprint);
    expect(rec.strategy.summary).toContain('Authored sample');
    expect(rec.strategy.rationale).toContain(novemberVariant.setup.toLowerCase());
    expect(rec.status).toBe('produced');
    const noncontiguousKey = `${EXPIRIES[0]},${EXPIRIES[2]}`;
    const noncontiguousVariant = scenario!.variants[noncontiguousKey];
    const noncontiguous = await demoFetch(
      new Request('http://localhost/api/recommendation/SPY', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          snapshot_fingerprint: noncontiguousVariant.fingerprint,
          dte_min: 2,
          dte_max: 44,
        }),
      }),
    );
    expect(noncontiguous.status).toBe(200);
    expect(
      ((await noncontiguous.json()) as import('../convexa').RecResponse).pinned_fingerprint,
    ).toBe(noncontiguousVariant.fingerprint);
    const missingFingerprint = await demoFetch(
      new Request('http://localhost/api/recommendation/SPY', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dte_min: 2, dte_max: 44 }),
      }),
    );
    expect(missingFingerprint.status).toBe(501);
    const unknownFingerprint = await demoFetch(
      new Request('http://localhost/api/recommendation/SPY', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snapshot_fingerprint: 'unknown-sample', dte_min: 2, dte_max: 44 }),
      }),
    );
    expect(unknownFingerprint.status).toBe(501);
    const stale = await demoFetch(
      new Request('http://localhost/api/recommendation/SPY', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          snapshot_fingerprint: scenario!.variants[EXPIRIES.join(',')].fingerprint,
          dte_min: 44,
          dte_max: 60,
        }),
      }),
    );
    expect(stale.status).toBe(501);

    const statusResponse = await demoFetch(
      new Request('http://localhost/api/recommendation/status/spy'),
    );
    expect(await statusResponse.json()).toMatchObject({
      availability: { in_app_enabled: false },
      gate: { state: 'available' },
      powering: { unavailable_reason: 'no_key' },
    });
    const exportResponse = await demoFetch(
      new Request('http://localhost/api/recommendation/export/spy?min_dte=44&max_dte=44'),
    );
    const exportBody = (await exportResponse.json()) as import('../convexa').RecExport;
    expect(exportBody.context.candidates.ticker).toBe('SPY');
    expect(String(exportBody.context.market_state?.['sample_analysis'])).toContain(
      scenario!.variants[EXPIRIES[2]].fingerprint,
    );
    expect(exportBody.context.market_state?.['call_wall']).toBe(
      scenario!.variants[EXPIRIES[2]].wall,
    );
    expect(exportBody.egress_categories).toHaveLength(6);
    expect(exportBody.egress_categories.every((item) => !item.sent)).toBe(true);
    expect('strategy' in exportBody).toBe(false);
    const api = await import('../convexa');
    expect(await api.fetchRecStatus('spy')).toMatchObject({
      availability: { in_app_enabled: false },
      gate: { state: 'available' },
      powering: { unavailable_reason: 'no_key' },
    });
    const projectedExport = await api.fetchRecExport('spy');
    const analysisOf = (e: import('../convexa').RecExport) =>
      String(e.context.market_state?.['sample_analysis']);
    expect(analysisOf(projectedExport)).toContain(
      scenario!.variants[EXPIRIES.join(',')].fingerprint,
    );
    const selectedExport = await api.fetchRecExport('spy', {
      sampleFingerprint: noncontiguousVariant.fingerprint,
    });
    expect(analysisOf(selectedExport)).toContain(noncontiguousVariant.fingerprint);
    expect(analysisOf(selectedExport)).not.toContain(
      scenario!.variants[EXPIRIES.join(',')].fingerprint,
    );
    const unknownExport = await demoFetch(
      new Request('http://localhost/api/recommendation/export/spy', {
        headers: { 'x-convexa-sample-fingerprint': 'unknown-sample' },
      }),
    );
    expect(unknownExport.status).toBe(501);

    const tickerProjection = await demoFetch(
      new Request('http://localhost/api/ticker/spy?expirations=2026-10-09,2026-11-20'),
    );
    const selected = (await tickerProjection.json()) as import('../convexa').TickerBundle;
    expect(selected.signals.opportunity_tier).toBe('actionable');
    expect(selected.signals.setups[0].conviction).toBe('medium');
    expect(selected.market_state.straddle_move?.session_basis).toBe('rth');

    const historyResponse = await demoFetch(
      new Request('http://localhost/api/scan/SPY/history?limit=2'),
    );
    const history = (await historyResponse.json()) as import('../convexa').StructureHistoryResponse;
    expect(history.samples).toHaveLength(2);
    expect(history.samples[1].price).toBe(scenario!.bars.at(-1)!.close);
    const contract = await demoFetch(
      new Request('http://localhost/api/contract/SPY?expiration=2026-10-16&strike=690&right=call'),
    );
    expect(contract.status).toBe(200);
    expect(((await contract.json()) as { option_quote: { mid: number } }).option_quote.mid).toBe(
      2.47,
    );
    const candidates = await demoFetch(new Request('http://localhost/api/candidates/SPY'));
    expect(await candidates.json()).toMatchObject({
      ticker: 'SPY',
      state: 'unavailable',
      contracts: [],
      sent_to_model: false,
    });

    const brokerBook = await demoFetch(new Request('http://localhost/api/broker/book'));
    const refreshedBook = await demoFetch(
      new Request('http://localhost/api/broker/book/refresh', { method: 'POST' }),
    );
    expect(refreshedBook.status).toBe(200);
    expect(await refreshedBook.json()).toEqual(await brokerBook.json());
    const brokerApi = await import('../broker');
    expect((await brokerApi.fetchBrokerBook()).basis).toBe('cache');
    expect((await brokerApi.refreshBrokerBook()).positions).toHaveLength(1);
  });

  it('populates normal widgets for all six symbols and seven selected-expiry sets', async () => {
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const [{ demoFetch }, { loadSampleResearch }, { SYMBOLS, EXPIRIES }, { computeIndicators }] =
      await Promise.all([
        import('./transport'),
        import('./views'),
        import('./catalog'),
        import('./indicators'),
      ]);
    const selectedSets = Array.from({ length: 7 }, (_, index) =>
      EXPIRIES.filter((_, bit) => (index + 1) & (1 << bit)),
    );
    const researchTitles = new Set<string>();

    for (const symbol of SYMBOLS) {
      const research = await loadSampleResearch(symbol);
      if (research.state !== 'ready')
        throw new Error(
          `${symbol} research case failed: ${research.state} ${'detail' in research ? research.detail : ''}`,
        );
      expect(research.state).toBe('ready');
      researchTitles.add(research.value.title);
      expect(research.value.symbol).toBe(symbol);
      expect(research.value.scenarioId).toBe('portfolio-2026-10-07-v1');
      expect(research.value.snapshotAsOf).toBe('2026-10-07T18:30:00Z');
      expect(research.value.evidence.filter((fact) => fact.state === 'present')).toHaveLength(2);
      const sourceIds = research.value.evidence.flatMap((fact) =>
        fact.state === 'present' ? fact.sourceIds : [],
      );
      const scenario = await (await import('./catalog')).loadScenario(symbol);
      expect(sourceIds.every((id) => scenario!.bars.some((bar) => bar.id === id))).toBe(true);
      const secondEvidence = research.value.evidence[1];
      if (secondEvidence.state !== 'present')
        throw new Error(`${symbol} research evidence should be source-linked.`);
      const latestBar = scenario!.bars.at(-1)!;
      if (symbol === 'QQQ' || symbol === 'NVDA') {
        expect(secondEvidence.text).toContain(`High ${latestBar.high.toFixed(2)} USD`);
        expect(secondEvidence.text).toContain(`low ${latestBar.low.toFixed(2)} USD`);
        expect(secondEvidence.sourceIds).toContain(latestBar.id);
      } else if (symbol === 'MSFT') {
        const ema20 = computeIndicators(scenario!.bars).ema20.at(-1);
        expect(ema20?.state).toBe('ready');
        if (ema20?.state !== 'ready') throw new Error('The 20-session sample EMA should be ready.');
        expect(secondEvidence.text).toContain(ema20.value.toFixed(4));
        expect(secondEvidence.sourceIds).toEqual(scenario!.bars.map((bar) => bar.id));
      } else {
        const priorBar = scenario!.bars.at(-2)!;
        expect(secondEvidence.text).toContain(`Close: ${priorBar.close.toFixed(2)} USD`);
        expect(secondEvidence.sourceIds).toContain(priorBar.id);
      }

      for (const expirations of selectedSets) {
        const query = new URLSearchParams({ expirations: expirations.join(',') });
        const response = await demoFetch(
          new Request(`http://localhost/api/ticker/${symbol}?${query.toString()}`),
        );
        expect(response.status).toBe(200);
        const bundle = (await response.json()) as import('../convexa').TickerBundle;
        const market = bundle.market_state;
        expect(market.iv_skew).toMatchObject({ expiration: expirations[0] });
        expect(market.iv_skew!.slope).toBeCloseTo(
          market.iv_skew!.put_iv - market.iv_skew!.call_iv,
          6,
        );
        expect(market.term_structure?.points).toHaveLength(3);
        expect(market.term_structure?.points.map((point) => point.expiration)).toEqual(EXPIRIES);
        expect(market.term_structure?.near_iv).toBe(market.term_structure?.points[0].atm_iv);
        expect(market.term_structure?.far_iv).toBe(market.term_structure?.points[2].atm_iv);
        expect(market.term_structure?.slope).toBeCloseTo(
          market.term_structure!.far_iv - market.term_structure!.near_iv,
          6,
        );
        expect(market.dealer_flow_projection?.charm).toBeTruthy();
        expect(market.dealer_flow_projection?.vanna).toBeTruthy();
        expect(market.dealer_flow_projection?.spot_basis).toBe(market.price);
        expect(Number.isFinite(market.dealer_flow_projection?.charm?.projected_delta)).toBe(true);
        expect(Number.isFinite(market.dealer_flow_projection?.vanna?.projected_delta)).toBe(true);
        const selectedVariant = scenario!.variants[expirations.join(',')];
        const charm = market.dealer_flow_projection!.charm!;
        expect(charm.opex_date).toBe('2026-10-16');
        expect(charm.horizon_days).toBe(9);
        expect(charm.per_day_base).toBe(Number((selectedVariant.score * 100).toFixed(2)));
        expect(charm.projected_delta).toBe(Number((charm.per_day_base * 9).toFixed(2)));
        const vanna = market.dealer_flow_projection!.vanna!;
        const vannaBase = Number((selectedVariant.distance * market.price! * 10).toFixed(2));
        expect(vanna.move_iv_points).toBe(1);
        expect(vanna.illustrative_move_iv_points).toBe(5);
        expect(vanna.projected_delta).toBe(vannaBase);
        expect(vanna.illustrative_projected_delta).toBe(Number((vannaBase * 5).toFixed(2)));
        expect(market.market_context?.trend_momentum).toBeTruthy();
        expect(market.market_context?.gex_profile_shape).toBeTruthy();
        expect(market.market_context?.flow_vs_positioning?.composition).toBeTruthy();
        expect(market.market_context?.flow_vs_positioning?.location).toBeTruthy();
        expect(market.market_context?.atr?.atr_14d).toBeTruthy();
        expect(market.iv_rank?.state).toBe('computed');
        const ivRank = market.iv_rank!;
        const ivObservations = scenario!.bars
          .slice(-20)
          .map((bar, index) =>
            Number((22 + ((bar.close / scenario!.base + index * 0.17) % 8)).toFixed(2)),
          );
        ivObservations[ivObservations.length - 1] = ivRank.current_iv!;
        const ivMin = Math.min(...ivObservations);
        const ivMax = Math.max(...ivObservations);
        expect(ivMax).toBeGreaterThan(ivMin);
        expect(ivRank.sample_count).toBe(20);
        expect(ivRank.rank).toBeCloseTo((100 * (ivRank.current_iv! - ivMin)) / (ivMax - ivMin), 6);
        expect(ivRank.percentile).toBeCloseTo(
          (100 * ivObservations.filter((observation) => observation < ivRank.current_iv!).length) /
            ivObservations.length,
          6,
        );
        expect(ivRank.rank).toBeGreaterThanOrEqual(0);
        expect(ivRank.rank).toBeLessThanOrEqual(100);
        expect(market.vol_normalized_gex?.vol_used).toBeGreaterThan(0);
        expect(market.straddle_move?.state).toBe('ok');
        expect(expirations).toContain(market.straddle_move?.primary_expiration);
        expect(market.straddle_move?.tenors[0]?.expiration).toBe(
          market.straddle_move?.primary_expiration,
        );
        const tenor = market.straddle_move!.tenors[0];
        const contractUrl = (right: 'call' | 'put') => {
          const params = new URLSearchParams({
            expiration: tenor.expiration,
            strike: String(tenor.strike_used),
            right,
          });
          return `http://localhost/api/contract/${symbol}?${params.toString()}`;
        };
        const [callResponse, putResponse] = await Promise.all([
          demoFetch(new Request(contractUrl('call'))),
          demoFetch(new Request(contractUrl('put'))),
        ]);
        expect(callResponse.status).toBe(200);
        expect(putResponse.status).toBe(200);
        const callQuote = (
          (await callResponse.json()) as import('../convexa').components['schemas']['ContractWire']
        ).option_quote!;
        const putQuote = (
          (await putResponse.json()) as import('../convexa').components['schemas']['ContractWire']
        ).option_quote!;
        const straddlePrice = Number((callQuote.mid + putQuote.mid).toFixed(2));
        expect(tenor.straddle_price).toBe(straddlePrice);
        expect(tenor.move_dollars).toBe(tenor.straddle_price);
        expect(tenor.move_pct).toBeCloseTo((100 * tenor.straddle_price) / market.price!, 4);
        const straddleBid = callQuote.bid + putQuote.bid;
        const straddleAsk = callQuote.ask + putQuote.ask;
        expect(tenor.quote_spread_pct_of_mid).toBeCloseTo(
          (100 * (straddleAsk - straddleBid)) / tenor.straddle_price,
          6,
        );
        expect(bundle.position_eval).toBeNull();
        expect(bundle.off_exchange?.blocks.length).toBeGreaterThanOrEqual(3);
        expect(bundle.off_exchange?.offex_shares).toBeGreaterThan(0);
        expect(bundle.off_exchange?.total_shares).toBeGreaterThan(0);
        expect(bundle.off_exchange?.ratio_pct).toBeCloseTo(
          (100 * bundle.off_exchange!.offex_shares) / bundle.off_exchange!.total_shares,
          6,
        );
        expect(bundle.off_exchange?.blocks.reduce((sum, block) => sum + block.shares, 0)).toBe(
          bundle.off_exchange?.offex_shares,
        );
        for (const block of bundle.off_exchange!.blocks) {
          expect(block.proximity_pct).toBe(
            Number(((block.price - market.price!) / market.price!).toFixed(4)),
          );
        }
        expect(bundle.off_exchange?.levels.reduce((sum, level) => sum + level.shares, 0)).toBe(
          bundle.off_exchange?.offex_shares,
        );
        for (const level of bundle.off_exchange!.levels) {
          expect(level.proximity_pct).toBe(
            Number(((level.price - market.price!) / market.price!).toFixed(4)),
          );
        }
        const unusual = bundle.strike_profile.strikes.filter(
          (strike) =>
            (strike.vol_oi_ratio ?? -Infinity) >= (market.vol_oi_unusual_threshold ?? Infinity),
        );
        expect(unusual.length).toBeGreaterThanOrEqual(3);
        for (const strike of bundle.strike_profile.strikes) {
          expect(strike.vol_oi_ratio).toBeCloseTo(strike.volume! / strike.total_oi!, 6);
        }
        expect(market.vol_normalized_gex?.call_gex).toBeCloseTo(
          Number(((market.call_gex ?? 0) / market.vol_normalized_gex!.vol_used).toFixed(2)),
          6,
        );
        expect(market.vol_normalized_gex?.put_gex).toBeCloseTo(
          Number(((market.put_gex ?? 0) / market.vol_normalized_gex!.vol_used).toFixed(2)),
          6,
        );
        expect(market.vol_normalized_gex?.net_gex).toBeCloseTo(
          Number(((market.net_gex ?? 0) / market.vol_normalized_gex!.vol_used).toFixed(2)),
          6,
        );
      }
    }
    expect(researchTitles.size).toBe(6);
  });
});
