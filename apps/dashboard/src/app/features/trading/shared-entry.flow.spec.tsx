/**
 * Flow-integration — the sim-entry-unification contract's two NAMED tests, driven through the REAL
 * pages (the full <App/> route table, the real PortfolioPanel/usePortfolio/TickerDashboard subtrees),
 * mocking ONLY the network boundary (`fetch` via the @convexa/api client + the SSE `EventSource`). Never
 * a live backend.
 *
 *  1. The Positions page and the Ticker page mount the SAME shared dialog component — both paths
 *     surface the `data-testid="trade-entry-dialog"` that exists ONLY in `trading/TradeEntryDialog`.
 *  2. A Positions-launched limit entry still produces a `pending` position that fills only on a LIVE
 *     cross, at the limit price, via the EXISTING entry-resolver lifecycle (`positions/entry.ts` +
 *     `usePortfolio`) — `[live-vs-static-isolation]`: never off a frozen/offline mark.
 */
import type { LiveUpdate, StrikeRow, TickerBundle, TrackedContract } from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { __resetMemory, allPositions } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';

// ---- INTERFACE-shaped factories (mirrors positions-portfolio.flow.spec) ------------------------
function strike(s: number): StrikeRow {
  return {
    strike: s,
    net_gex: 0,
    call_gex: 0,
    put_gex: 0,
    call_oi: 10,
    put_oi: 10,
    total_oi: 20,
    net_dex: 0,
    call_dex: 0,
    put_dex: 0,
    volume: 5,
    vol_oi_ratio: 0.25,
  };
}
function makeBundle(): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA',
      price: 250,
      gex_spot: 250,
      timestamp: 1,
      timestamp_iso: '2026-06-23T14:00:00Z',
      call_wall: 260,
      put_wall: 240,
      peak_gex_strike: 255,
      gamma_flip: 248,
      max_pain: 250,
      max_pain_expiration: '2026-06-26',
      net_gex: 1,
      call_gex: 1,
      put_gex: -1,
      total_gex: 1,
      net_dex: 1,
      call_dex: 1,
      put_dex: -1,
      net_vanna: null,
      net_charm: null,
      net_volga: null,
      vwap: 249,
      vwap_upper_2: null,
      vwap_upper_3: null,
      vwap_lower_2: null,
      vwap_lower_3: null,
      dte_min: 7,
      dte_max: 45,
      atm_iv: 45,
      hv_30d: 40,
      iv_hv_ratio: 1.1,
      net_flow: null,
      put_call_ratio: 0.8,
      chain_vol_oi_ratio: 0.5,
      total_volume: 100000,
      vol_oi_unusual_threshold: 1,
      iv_skew: null,
      term_structure: null,
      dealer_flow_projection: null,
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
    strike_profile: { ticker: 'TSLA', spot: 250, strikes: [strike(245), strike(250), strike(255)] },
    expirations: [
      { date: '2026-07-17', dte: 24 },
      { date: '2026-08-21', dte: 59 },
    ],
    ai_eval: {
      ready: true,
      reasons: [],
      changed: true,
      state_fingerprint: 'fp-A',
      score_threshold: 50,
    },
    meta: {
      served_at: '2026-06-23T14:00:00Z',
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: {
        snapshot_iso: '2026-06-23T14:00:00Z',
        data_age_seconds: 10,
        stale: false,
        stale_after_seconds: 600,
      },
    },
    position_eval: null,
  };
}

const QUOTE: TrackedContract = {
  ticker: 'TSLA',
  expiration: '2026-07-17',
  strike: 250,
  right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
  greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45,
  dte: 24,
};

// ---- Controllable mock backend (the network boundary) ------------------------------------------
const esInstances: { onmessage: ((e: MessageEvent) => void) | null }[] = [];

function installBackend() {
  esInstances.length = 0;
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() {
      esInstances.push(this);
    }
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  const json = (b: unknown, status = 200) =>
    new Response(b === null ? 'null' : JSON.stringify(b), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Signed-in session (the FE gate check) — the write gate itself stays server-enforced below.
      if (url.includes('/api/auth/session'))
        return json({
          authenticated: true,
          user: {
            id: 'u-test',
            email: 'test@user.com',
            display_name: null,
            auth_methods: ['password'],
          },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        });
      // AC-E7: the Positions sim-trade WRITE awaits the SERVER gate first; signed-in ⇒ authorize.
      if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
      if (url.includes('/api/ticker/')) return json(makeBundle());
      if (url.includes('/api/recommendation/status/')) {
        return json({
          availability: { in_app_enabled: true },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
        });
      }
      if (url.includes('/api/personas'))
        return json([{ id: 'default', name: 'Default (no persona)' }]);
      if (url.includes('/api/contract/')) {
        const u = new URL(url, 'http://x');
        const s = Number(u.searchParams.get('strike'));
        const right = u.searchParams.get('right') ?? 'call';
        return json({ ...QUOTE, strike: s, right });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

/** Push an SSE payload to all live EventSources. */
function pushLive(over: Partial<LiveUpdate> = {}) {
  const u: LiveUpdate = {
    ticker: 'TSLA',
    mid: 250,
    bid: null,
    ask: null,
    spread: null,
    net_flow: 0,
    buy_vol: 0,
    sell_vol: 0,
    flow_window_s: 300,
    spot_ts: 1,
    live: true,
    tick_age_s: 1,
    market_session: 'regular',
    feed: 'realtime',
    ts: Date.now(),
    gamma_flip: 248,
    last_trade: 250,
    ...over,
  };
  act(() => {
    esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(u) } as MessageEvent));
  });
}

function renderAt(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  vi.restoreAllMocks();
  installBackend();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('sim-entry-unification — one shared dialog across both launch sites', () => {
  it('positions_and_ticker_pages_render_the_same_trade_entry_dialog', async () => {
    const user = userEvent.setup();

    // --- Ticker page: the "+ Open simulated trade" CTA mounts trading/TradeEntryDialog ---
    const ticker = renderAt('/ticker/TSLA');
    await user.click(await screen.findByTestId('open-sim-trade'));
    const tickerDlg = await screen.findByTestId('trade-entry-dialog');
    expect(within(tickerDlg).getByText('SIMULATED')).toBeInTheDocument();
    expect(within(tickerDlg).getByRole('button', { name: 'Market' })).toBeInTheDocument();
    ticker.unmount();

    // --- Positions page: the toolbar "+ Open simulated position" CTA mounts the SAME component ---
    renderAt('/positions');
    await screen.findByTestId('account-avatar'); // who-am-I settled (the FE gate check passes)
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    const positionsDlg = await screen.findByTestId('trade-entry-dialog');
    expect(within(positionsDlg).getByText('SIMULATED')).toBeInTheDocument();
    // The testid exists ONLY in app/trading/TradeEntryDialog.tsx — both paths mounted that one file.
  }, 20000);

  it('positions_launched_limit_entry_rests_pending_and_fills_only_on_a_live_cross', async () => {
    const user = userEvent.setup();
    renderAt('/positions');
    await screen.findByTestId('account-avatar');
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());

    // Place a resting limit at $4 (live option mid resolves to 5 ⇒ rests, does not fill).
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByTestId('trade-entry-dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '4');
    await user.click(within(dlg).getByRole('button', { name: 'Place limit order' }));
    await waitFor(() => expect(allPositions().some((p) => p.status === 'pending')).toBe(true));

    // A live tick with the mark still ABOVE the limit must NOT fill it (wrong side).
    pushLive({ mid: 250 });
    expect(allPositions().find((p) => p.limit_price === 4)?.status).toBe('pending');

    // The LIVE cross (underlying pushed down drives the modeled option mark ≤ 4) fills it AT the
    // limit price with the resolver's `limit_fill` basis — the existing lifecycle, untouched.
    pushLive({ mid: 235 });
    await waitFor(() => {
      const p = allPositions().find((x) => x.limit_price === 4);
      expect(p?.status).toBe('open');
      expect(p?.legs[0].entry_price).toBe(4);
      expect(p?.legs[0].entry_basis).toBe('limit_fill');
    });
  }, 20000);
});
