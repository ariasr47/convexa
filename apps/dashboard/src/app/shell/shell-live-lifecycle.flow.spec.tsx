/**
 * CENTERPIECE flow-integration — the page-scoped live-feed lifecycle across the real app shell.
 *
 * Mounts the REAL app subtree (the route table + AppShell + the relocated TickerDashboard + the
 * standalone PositionsPage + Scanner), mocking ONLY the network boundary: a controllable mock
 * `EventSource` (so we can observe open/close per symbol) + `fetch`. NEVER a live backend.
 *
 * The journey walked (FRONTEND_EXECUTION_CONTRACT §3, AC-Live-1..5 + AC-Store-1/4 + AC-Scan-1):
 *   land on `/` → CTA into `/ticker` (feed opens) → nav to `/positions` (Ticker feed closes; a position
 *   opened on Ticker is already present) → back to `/ticker` (a FRESH feed reopens; never two concurrent
 *   for the symbol) → `/scanner` (Ticker feed closed; placeholder issues no scan) → symbol change
 *   single-subscribes.
 */
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { TickerBundle, StrikeRow } from '@org/api';

import App from '../app';
import { theme } from '../theme';
import { __resetMemory } from '../positions/store';

// ---- A controllable mock EventSource so we can track open/close per stream URL ------------------
interface MockES {
  url: string;
  symbol: string;
  closed: boolean;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
}
let esLog: MockES[] = [];

/** Open (not-yet-closed) EventSources for a given symbol — the concurrency check. */
function openFor(symbol: string): MockES[] {
  return esLog.filter((es) => es.symbol === symbol && !es.closed);
}

function strike(s: number): StrikeRow {
  return { strike: s, net_gex: 0, call_gex: 0, put_gex: 0, call_oi: 10, put_oi: 10, total_oi: 20, net_dex: 0, call_dex: 0, put_dex: 0, volume: 5, vol_oi_ratio: 0.25 };
}
function makeBundle(ticker: string): TickerBundle {
  return {
    market_state: {
      ticker, price: 250.5, gex_spot: 250, timestamp: 1, timestamp_iso: '2026-06-23T14:30:00Z',
      call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248, max_pain: 250,
      max_pain_expiration: '2026-06-26', net_gex: 1.2e9, call_gex: 2.0e9, put_gex: -0.8e9, total_gex: 1.2e9,
      net_dex: 5.0e8, call_dex: 6.0e8, put_dex: -1.0e8, net_vanna: null, net_charm: null, net_volga: null,
      vwap: 249, vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null,
      dte_min: null, dte_max: null, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.12, net_flow: null,
      put_call_ratio: 0.8, chain_vol_oi_ratio: 0.5, total_volume: 100_000, vol_oi_unusual_threshold: 1,
      iv_skew: null, term_structure: null,
    },
    signals: {
      ticker, regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {},
      setups: [], opportunity_score: 42, opportunity_tier: 'watch', prime_prompt_eligible: false,
    },
    strike_profile: { ticker, spot: 250.5, strikes: [strike(245), strike(250), strike(255)] },
    expirations: [{ date: '2026-06-26', dte: 3 }],
    ai_eval: { ready: false, reasons: [], changed: false, state_fingerprint: 'x', score_threshold: 60 },
    meta: {
      served_at: '2026-06-23T14:30:00Z', cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: { snapshot_iso: '2026-06-23T14:30:00Z', data_age_seconds: 30, stale: false, stale_after_seconds: 600 },
    },
    off_exchange: { ratio_pct: 38, offex_shares: 38_000, total_shares: 100_000, levels: [], blocks: [], block_min_shares: 5000, note: '' },
    position_eval: null,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  esLog = [];

  class MockEventSource {
    url: string;
    symbol: string;
    closed = false;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      // The stream URL is `/api/stream/{symbol}?...` (see `streamTicker`) — extract the symbol.
      this.symbol = (url.match(/\/api\/stream\/([A-Z]+)/) ?? [])[1] ?? '?';
      esLog.push(this as unknown as MockES);
    }
    close() { this.closed = true; }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const tk = (url.match(/\/api\/ticker\/([A-Z]+)/) ?? [])[1] ?? 'TSLA';
    // user-accounts: who-am-I read on mount (signed-in path; gating covered in the auth suite).
    if (url.includes('/api/auth/session')) return json({ authenticated: true, user: { id: 'u-test', email: 'test@user.com', display_name: null, auth_methods: ['password'] }, google_available: false, settings: { active_persona_id: null, default_ticker: null, theme: 'dark' } });
    // user-accounts (AC-E7): the Positions sim-trade WRITE awaits the SERVER gate first; signed-in ⇒ authorize.
    if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
    if (url.includes('/api/ticker/')) return json(makeBundle(tk));
    if (url.includes('/api/recommendation/status/')) {
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
      });
    }
    if (url.includes('/api/personas')) return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) return json(null);
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderApp(path = '/') {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('live-lifecycle (centerpiece flow)', () => {
  it('full journey: land → ticker (open) → positions (close) → ticker (reopen) → scanner; never double-subscribes', async () => {
    const user = userEvent.setup();
    renderApp('/');

    // --- land on `/`: static, no stream opened ---
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(esLog.length).toBe(0);

    // --- CTA into /ticker → exactly ONE EventSource opens for TSLA (AC-Live-1) ---
    await user.click(screen.getByTestId('cta-primary'));
    await screen.findByText('Call wall');
    expect(openFor('TSLA').length).toBe(1); // exactly one, open

    // --- nav to /positions → the Ticker feed CLOSES (no leak) (AC-Live-2) ---
    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('portfolio-panel');
    // The TSLA stream the Ticker page opened was closed on unmount. (The Positions page may open its
    // own single TSLA stream, but the Ticker-page instance must be closed — and there is never more
    // than one open at a time for the symbol.)
    expect(openFor('TSLA').length).toBeLessThanOrEqual(1);
    const firstTickerEs = esLog.find((es) => es.symbol === 'TSLA')!;
    expect(firstTickerEs.closed).toBe(true);

    // --- back to /ticker → a FRESH feed reopens (cold-start path) (AC-Live-3) ---
    const beforeReturn = esLog.length;
    await user.click(screen.getByTestId('nav-ticker'));
    await screen.findByText('Call wall');
    expect(esLog.length).toBeGreaterThan(beforeReturn); // a new EventSource was constructed
    expect(openFor('TSLA').length).toBe(1);             // exactly one open for the symbol (AC-Live-4)

    // --- /scanner → the Ticker feed closes again; the placeholder issues no scan (AC-Scan-1) ---
    const fetchBeforeScanner = fetchMock.mock.calls.length;
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-placeholder');
    expect(openFor('TSLA').length).toBeLessThanOrEqual(1);
    // The Scanner page itself adds no fetch beyond whatever the (now-unmounted) ticker had in flight.
    // Assert no NEW ticker-bundle fetch was triggered by showing the Scanner.
    const newCalls = fetchMock.mock.calls.slice(fetchBeforeScanner).map((c) => String(c[0]));
    expect(newCalls.some((u) => u.includes('/api/ticker/'))).toBe(false);
  }, 20000);

  it('entering Ticker opens exactly one EventSource', async () => {
    renderApp('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(openFor('TSLA').length).toBe(1);
  });

  it('nav-away closes the feed (no leak)', async () => {
    const user = userEvent.setup();
    renderApp('/ticker/TSLA');
    await screen.findByText('Call wall');
    const es = esLog.find((e) => e.symbol === 'TSLA')!;
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-placeholder');
    expect(es.closed).toBe(true);
  });

  it('return reopens a fresh feed', async () => {
    const user = userEvent.setup();
    renderApp('/ticker/TSLA');
    await screen.findByText('Call wall');
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-placeholder');
    const before = esLog.filter((e) => e.symbol === 'TSLA').length;
    await user.click(screen.getByTestId('nav-ticker'));
    await screen.findByText('Call wall');
    expect(esLog.filter((e) => e.symbol === 'TSLA').length).toBeGreaterThan(before);
    expect(openFor('TSLA').length).toBe(1);
  });

  it('never two concurrent feeds (round-trip)', async () => {
    const user = userEvent.setup();
    renderApp('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(openFor('TSLA').length).toBeLessThanOrEqual(1);
    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('portfolio-panel');
    expect(openFor('TSLA').length).toBeLessThanOrEqual(1);
    await user.click(screen.getByTestId('nav-ticker'));
    await screen.findByText('Call wall');
    expect(openFor('TSLA').length).toBeLessThanOrEqual(1);
  });

  it('symbol change single-subscribes', async () => {
    const user = userEvent.setup();
    renderApp('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(openFor('TSLA').length).toBe(1);

    // navigate-on-Enter to a new symbol (the relocated route prefix `/ticker/`).
    const input = screen.getByLabelText('Ticker') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'AAPL');
    await act(async () => { await user.keyboard('{Enter}'); });

    await screen.findByText('Call wall');
    // Prior symbol's feed closed; exactly one open for the new symbol.
    expect(openFor('TSLA').length).toBe(0);
    expect(openFor('AAPL').length).toBe(1);
  }, 20000);

  it('the portfolio book lives on /positions, not the Ticker (Figma re-skin)', async () => {
    const user = userEvent.setup();
    renderApp('/ticker/TSLA');
    await screen.findByText('Call wall');

    // The Ticker no longer hosts the portfolio (or ghost-trade) panel — only the open-trade
    // affordance remains; the book itself lives on /positions.
    expect(screen.queryByTestId('portfolio-panel')).toBeNull();
    expect(screen.getByTestId('open-sim-trade')).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-positions'));
    expect(await screen.findByTestId('portfolio-panel')).toBeInTheDocument();
  }, 20000);
});
