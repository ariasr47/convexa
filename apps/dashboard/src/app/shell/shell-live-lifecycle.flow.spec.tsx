/**
 * CENTERPIECE flow-integration — the page-scoped live-feed lifecycle across the real app shell.
 * (Risk-migrated 2026-07-16: the former per-AC subset tests — open-once / close-on-leave /
 * reopen-on-return / round-trip — were strict subsets of the journey below and were folded into it.
 * The dance itself is the KEEPER: the double-subscribe leak is the invisible regression, caught by
 * counting the stub EventSource's constructions across the nav sequence.)
 *
 * Mounts the REAL app subtree (the route table + AppShell + TickerDashboard + PositionsPage +
 * Scanner), mocking ONLY the network boundary: a controllable mock `EventSource` (so we can observe
 * open/close per symbol) + `fetch`. NEVER a live backend.
 *
 * The journey walked (FRONTEND_EXECUTION_CONTRACT §3):
 *   land on `/` (no stream) → free-path CTA into `/ticker` (feed opens, exactly one) → nav to
 *   `/positions` (Ticker feed CLOSES) → back to `/ticker` (fresh feed) → `/scanner` (feed closed;
 *   no per-row ticker stream) → symbol change single-subscribes.
 */
import type { TickerBundle } from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';

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

/** The shared fixture pinned to the requested symbol (the walk changes symbols mid-flow). */
function bundleFor(ticker: string): TickerBundle {
  const b = makeBundle();
  return {
    ...b,
    market_state: { ...b.market_state, ticker },
    signals: { ...b.signals, ticker },
    strike_profile: { ...b.strike_profile, ticker },
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
    close() {
      this.closed = true;
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown) =>
      new Response(JSON.stringify(b), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const tk = (url.match(/\/api\/ticker\/([A-Z]+)/) ?? [])[1] ?? 'SPY';
    // user-accounts: who-am-I read on mount (signed-in path; gating covered in the auth suite).
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
    // user-accounts (AC-E7): the Positions sim-trade WRITE awaits the SERVER gate first; signed-in ⇒ authorize.
    if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
    if (url.includes('/api/ticker/')) return json(bundleFor(tk));
    if (url.includes('/api/recommendation/status/')) {
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
      });
    }
    if (url.includes('/api/personas'))
      return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) return json(null);
    // scanner: the /scanner route polls the scan read on mount (poll-based, no SSE).
    if (url.includes('/api/scan/universe')) return json({ symbols: ['SPY'], universe_size: 1 });
    if (url.includes('/history'))
      return json({ symbol: 'SPY', samples: [], basis: 'test structure history' });
    if (url.includes('/api/scan'))
      return json({
        view: {
          source: 'default',
          authenticated: false,
          name: null,
          symbols: ['SPY'],
          sort: { key: 'score', dir: 'desc' },
          density: 'compact',
        },
        rows: [
          {
            symbol: 'SPY',
            price: 500,
            chg_pct: 1,
            score: 82,
            tier: 'prime',
            regime: 'positive_gamma',
            vol_regime: 'iv_rich',
            flip: 495,
            dist_to_flip_pct: 1,
            call_wall: 510,
            put_wall: 490,
            dist_to_wall_pct: 2,
            as_of: Date.now() / 1000,
            status: 'ok',
          },
        ],
        sweep: {
          updated_at: Date.now() / 1000,
          sweep_last_completed: Date.now() / 1000,
          universe_size: 1,
        },
      });
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

    // --- Free-path CTA into /ticker (the primary CTA; secondary → /methodology) ---
    await user.click(screen.getByTestId('cta-primary'));
    await screen.findByText('Call wall');
    expect(openFor('SPY').length).toBe(1); // exactly one, open

    // --- nav to /positions → the Ticker feed CLOSES (no leak) ---
    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('portfolio-panel');
    // The SPY stream the Ticker page opened was closed on unmount. (The Positions page may open its
    // own single SPY stream, but the Ticker-page instance must be closed — and there is never more
    // than one open at a time for the symbol.)
    expect(openFor('SPY').length).toBeLessThanOrEqual(1);
    const firstTickerEs = esLog.find((es) => es.symbol === 'SPY');
    if (!firstTickerEs) throw new Error('expected a SPY EventSource to have been opened');
    expect(firstTickerEs.closed).toBe(true);

    // --- back to /ticker → a FRESH feed reopens (cold-start path) ---
    const beforeReturn = esLog.length;
    await user.click(screen.getByTestId('nav-ticker'));
    await screen.findByText('Call wall');
    expect(esLog.length).toBeGreaterThan(beforeReturn); // a new EventSource was constructed
    expect(openFor('SPY').length).toBe(1); // exactly one open for the symbol

    // --- /scanner → the Ticker feed closes again; the scan surface opens NO ticker feed ---
    const fetchBeforeScanner = fetchMock.mock.calls.length;
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-page');
    expect(openFor('SPY').length).toBeLessThanOrEqual(1);
    // The Scanner polls its OWN read (`/api/scan`) and nothing else: it is poll-based and never
    // subscribes per row (`[live-vs-static-isolation]`). Assert no NEW ticker-bundle fetch — the
    // real page must not resurrect the ticker feed it just left.
    const newCalls = fetchMock.mock.calls.slice(fetchBeforeScanner).map((c) => String(c[0]));
    expect(newCalls.some((u) => u.includes('/api/ticker/'))).toBe(false);
  }, 20000);

  it('symbol change single-subscribes (old feed closed, exactly one for the new symbol)', async () => {
    const user = userEvent.setup();
    renderApp('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(openFor('TSLA').length).toBe(1);

    // Ticker fidelity repair, change 3 (F3) — the populated desk carries no bare ticker input
    // (`TickerToolbar.tsx`'s own module doc); the palette (⌘K) is the ticker-entry job now, via its
    // "open anyway" item (`CommandPalette.tsx`) for a plausible symbol the scan fixture doesn't
    // carry a row for. Same navigate-on-activate path the old bare input used.
    await user.keyboard('{Meta>}k{/Meta}');
    await screen.findByTestId('command-palette');
    await user.type(screen.getByTestId('palette-input'), 'AAPL');
    await act(async () => {
      await user.click(await screen.findByTestId('palette-open-anyway'));
    });

    await screen.findByText('Call wall');
    // Prior symbol's feed closed; exactly one open for the new symbol.
    expect(openFor('TSLA').length).toBe(0);
    expect(openFor('AAPL').length).toBe(1);
  }, 20000);
});
