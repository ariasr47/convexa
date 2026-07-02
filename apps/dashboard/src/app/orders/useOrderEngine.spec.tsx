/**
 * Component/unit — the evaluation hook's ISOLATION guarantees (arch §9, FRONTEND contract §2):
 *  - an evaluation-tick throw is caught PER ORDER per tick (one bad order never kills the engine,
 *    the other orders' evaluation, or the stream consumer);
 *  - a single order's contract-lookup failure degrades ONLY that order's fill leg (per-row
 *    isolation) — the healthy order still fills off the same live payload.
 * Mocks ONLY the network boundary (fetch) + spies the module seam the hook calls through.
 */
import { render, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { LiveUpdate, TickerBundle } from '@org/api';

// Pass-through spy on the hook's apply seam so a throw can be injected for ONE tick.
vi.mock('./useOrders', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./useOrders')>();
  return { ...mod, evaluateAndApply: vi.fn(mod.evaluateAndApply) };
});

import { useOrderEngine } from './useOrderEngine';
import { evaluateAndApply } from './useOrders';
import { putOrder, getOrder, __resetOrdersMemory, __notifyOrdersChanged } from './store';
import { __resetMemory as __resetPositionsMemory, allPositions } from '../positions/store';
import type { SimOrder } from './types';

const FUTURE_ISO = new Date(Date.now() + 5 * 86_400_000).toISOString();

function makeBundle(): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA', price: 250, gex_spot: 250, timestamp: 1, timestamp_iso: null, call_wall: 260,
      put_wall: 240, peak_gex_strike: null, gamma_flip: 248, max_pain: null, max_pain_expiration: null,
      net_gex: 1, call_gex: null, put_gex: null, total_gex: null, net_dex: null, call_dex: null,
      put_dex: null, net_vanna: null, net_charm: null, net_volga: null, vwap: null, vwap_upper_2: null,
      vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null, dte_min: null, dte_max: null,
      atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.1, net_flow: null, put_call_ratio: 0.8,
      chain_vol_oi_ratio: null, total_volume: null, vol_oi_unusual_threshold: 1, iv_skew: null, term_structure: null,
    },
    signals: {
      ticker: 'TSLA', regime: null, regime_note: null, vol_regime: 'neutral', distances: {},
      setups: [], opportunity_score: 0, opportunity_tier: 'dormant', prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250, strikes: [] },
    expirations: [],
    ai_eval: { ready: true, reasons: [], changed: false, state_fingerprint: 'fp', score_threshold: 50 },
    meta: { served_at: 'now', cache: { hit: false, age_seconds: 0, ttl_seconds: 60 }, freshness: { snapshot_iso: null, data_age_seconds: null, stale: false, stale_after_seconds: 600 } },
    position_eval: null,
  };
}

function liveAt(mid: number): LiveUpdate {
  return {
    ticker: 'TSLA', mid, bid: null, ask: null, spread: null, net_flow: 0, buy_vol: 0, sell_vol: 0,
    flow_window_s: 300, spot_ts: 1, live: true, tick_age_s: 1, market_session: 'regular',
    feed: 'realtime', ts: Date.now(), gamma_flip: 248, last_trade: mid,
  };
}

let n = 0;
function seed(over: Partial<SimOrder>): SimOrder {
  const o: SimOrder = {
    id: `eo-${++n}`, created_time: new Date().toISOString(), schema_version: 1,
    ticker: 'TSLA', expiration: '2099-12-19', strike: 250, right: 'call', side: 'long', qty: 1,
    trigger: null, limit_price: null, stop: null, target: null, expires_at: FUTURE_ISO,
    provenance: { source: 'ai_rec' }, status: 'triggered', triggered_time: new Date().toISOString(),
    ...over,
  };
  putOrder(o);
  __notifyOrdersChanged();
  return o;
}

function Host({ live }: { live: LiveUpdate | null }) {
  useOrderEngine({
    ticker: 'TSLA', bundle: makeBundle(), live,
    isLive: live?.live ?? false, streamOffline: false,
  });
  return null;
}

const QUOTE = {
  ticker: 'TSLA', expiration: '2099-12-19', strike: 250, right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 }, greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45, dte: 24,
};

beforeEach(() => {
  localStorage.clear();
  __resetOrdersMemory();
  __resetPositionsMemory();
  (evaluateAndApply as Mock).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('useOrderEngine — per-tick + per-order isolation (arch §9)', () => {
  it('a per-tick throw is caught and isolated to that order — the next order still evaluates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(QUOTE), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    seed({ id: 'boom' });
    seed({ id: 'fine' });
    const view = render(<Host live={null} />);
    (evaluateAndApply as Mock).mockClear();
    (evaluateAndApply as Mock).mockImplementationOnce(() => { throw new Error('tick boom'); });
    // A live payload drives the tick — the first order's throw must not kill the loop or throw
    // into React (the stream consumer keeps working).
    expect(() => {
      act(() => view.rerender(<Host live={liveAt(253)} />));
    }).not.toThrow();
    expect((evaluateAndApply as Mock).mock.calls.length).toBe(2); // BOTH orders were evaluated
  });

  it("a single order's contract-lookup failure degrades ONLY that order's fill leg", async () => {
    // strike 250 resolves; strike 255's lookup faults (transport error) — per-row isolation.
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const u = new URL(String(input), 'http://x');
      if (u.searchParams.get('strike') === '255') return new Response('boom', { status: 500 });
      return new Response(JSON.stringify(QUOTE), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    const healthy = seed({ strike: 250 });
    const degraded = seed({ strike: 255 });
    const view = render(<Host live={null} />);
    // Let the per-order lookups settle (one resolved, one faulted).
    await waitFor(() => expect((fetch as unknown as Mock).mock.calls.length).toBeGreaterThanOrEqual(2));
    // The same live payload: the healthy order fills at the first live-resolvable mark; the
    // degraded one cannot resolve a mark and stays working — but is NOT dropped or errored.
    await waitFor(() => {
      act(() => view.rerender(<Host live={liveAt(253)} />));
      expect(getOrder(healthy.id)?.status).toBe('filled');
    });
    expect(getOrder(degraded.id)?.status).toBe('triggered');
    expect(allPositions()).toHaveLength(1); // exactly the healthy order's fill
  });
});
