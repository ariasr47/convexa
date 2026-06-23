import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TickerBundle } from '@org/api';

import App from './app';

// Flow-integration smoke test — the TEMPLATE every per-feature test follows (GAMMAFLOW_CONTEXT §7).
//
// We mock at the MODULE BOUNDARY (`fetch` + `EventSource`), not by stubbing @org/api, so the real
// client code (URL building, status handling, JSON parsing) is exercised. NEVER hits a live backend.
//
// The default flow: App mounts at "/" → redirects to "/TSLA" → getTicker() fetches the bundle →
// the headline + GEX stat grid render. The live SSE stream is stubbed to a silent EventSource, so
// the dashboard stays in its non-live state (no ticks) — deterministic and offline.

/** A minimal-but-complete bundle. Only fields the default render reads need realistic values; the
 *  rest are valid-shaped placeholders so the component never throws on a missing key. */
function makeBundle(): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA',
      price: 250.5,
      gex_spot: 250,
      timestamp: 1_700_000_000,
      timestamp_iso: '2026-06-23T14:30:00Z',
      call_wall: 260,
      put_wall: 240,
      peak_gex_strike: 255,
      gamma_flip: 248,
      max_pain: 250,
      max_pain_expiration: '2026-06-26',
      net_gex: 1.2e9,
      call_gex: 2.0e9,
      put_gex: -0.8e9,
      total_gex: 1.2e9,
      net_dex: 5.0e8,
      call_dex: 6.0e8,
      put_dex: -1.0e8,
      net_vanna: null,
      net_charm: null,
      net_volga: null,
      vwap: 249,
      vwap_upper_2: null,
      vwap_upper_3: null,
      vwap_lower_2: null,
      vwap_lower_3: null,
      dte_min: null,
      dte_max: null,
      atm_iv: 45,
      hv_30d: 40,
      iv_hv_ratio: 1.12,
      net_flow: null,
      put_call_ratio: 0.8,
      chain_vol_oi_ratio: 0.5,
      total_volume: 100_000,
      vol_oi_unusual_threshold: 1,
      iv_skew: null,
      term_structure: null,
    },
    signals: {
      ticker: 'TSLA',
      regime: 'positive_gamma',
      regime_note: null,
      vol_regime: 'neutral',
      distances: {},
      setups: [],
      opportunity_score: 42,
      opportunity_tier: 'watch',
      prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [] },
    expirations: [{ date: '2026-06-26', dte: 3 }],
    ai_eval: { ready: false, reasons: [], changed: false, state_fingerprint: 'x', score_threshold: 60 },
    meta: {
      served_at: '2026-06-23T14:30:00Z',
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: { snapshot_iso: '2026-06-23T14:30:00Z', data_age_seconds: 30, stale: false, stale_after_seconds: 600 },
    },
    off_exchange: {
      ratio_pct: 38,
      offex_shares: 38_000,
      total_shares: 100_000,
      levels: [],
      blocks: [],
      block_min_shares: 5000,
      note: '',
    },
    position_eval: null,
  };
}

beforeEach(() => {
  // Silent SSE: the dashboard subscribes on mount; we hand back an EventSource that never emits, so
  // the view stays non-live (deterministic) and unsubscribe (es.close) has something to call.
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/ticker/')) return json(makeBundle());
      // The AI-rec surface reads gate/cap/availability + the canonical persona list on mount. Benign
      // defaults keep the panel in its idle/available state without touching the rest of the page.
      if (url.includes('/api/recommendation/status/')) {
        return json({
          availability: { in_app_enabled: true },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
        });
      }
      if (url.includes('/api/personas')) return json([{ id: 'default', name: 'Default (no persona)' }]);
      // Any other endpoint isn't expected in the default flow — fail loudly if one slips in.
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('App (dashboard flow)', () => {
  it('shows the app shell immediately', async () => {
    render(
      <MemoryRouter initialEntries={['/TSLA']}>
        <App />
      </MemoryRouter>,
    );
    // The GammaFlow AppBar renders synchronously, before any data loads.
    expect(screen.getByText('GammaFlow')).toBeInTheDocument();
    // Flush the in-flight getTicker() so its state update lands inside the test (no act warning).
    await screen.findByText('Call wall');
  });

  it('loads the ticker bundle and renders the GEX headline + walls', async () => {
    render(
      <MemoryRouter initialEntries={['/TSLA']}>
        <App />
      </MemoryRouter>,
    );

    // findByText polls until getTicker() resolves and the bundle-derived grid mounts, replacing
    // the cold-start spinner. The wall stat tiles + their values come straight from the bundle.
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
    expect(screen.getByText('$260')).toBeInTheDocument();
    expect(screen.getByText('Put wall')).toBeInTheDocument();
    expect(screen.getByText('$240')).toBeInTheDocument();

    // The client requested the bundle for the redirected default ticker (TSLA).
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/ticker/TSLA'));
  });

  it('lets the user type a new ticker symbol (user-event)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/TSLA']}>
        <App />
      </MemoryRouter>,
    );
    // Wait for the bundle to land so the view is settled before interacting.
    await screen.findByText('Call wall');

    const input = screen.getByLabelText('Ticker') as HTMLInputElement;
    expect(input).toHaveValue('TSLA');
    await user.clear(input);
    await user.type(input, 'AAPL');
    expect(input).toHaveValue('AAPL');
  });
});
