/**
 * Routes / Nav / Landing / Scanner — component + routing coverage for the Convexa multi-page shell.
 *
 * Mocks ONLY the network boundary (`fetch` + `EventSource`), never a live backend, per PROJECT_CONTEXT
 * §7. Routing is driven with `MemoryRouter` / `initialEntries`. This file covers the static + routing
 * ACs; the live-feed lifecycle centerpiece + the store-persistence flow are in their own colocated
 * specs (`shell-live-lifecycle.flow.spec.tsx`, `positions-page.spec.tsx`).
 *
 * AC coverage in this file: Route 1–7, Nav 1–5, Land 1–6, Scan 1, Inv 7, Inv 8.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { TickerBundle } from '@org/api';

import App from './app';
import { theme } from './theme';
import { __resetMemory } from './positions/store';

// ---- A minimal-but-complete bundle so the relocated Ticker viewer renders without throwing -------
function makeBundle(ticker = 'TSLA'): TickerBundle {
  return {
    market_state: {
      ticker, price: 250.5, gex_spot: 250, timestamp: 1_700_000_000, timestamp_iso: '2026-06-23T14:30:00Z',
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
    strike_profile: { ticker, spot: 250.5, strikes: [] },
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
let openedEventSources = 0;

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  openedEventSources = 0;
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() { openedEventSources += 1; }
    close() { /* no-op */ }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const tk = (url.match(/\/api\/ticker\/([A-Z]+)/) ?? [])[1] ?? 'TSLA';
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
    // user-accounts: the app reads who-am-I once on mount (non-blocking; never the trader path).
    if (url.includes('/api/auth/session')) return json({ authenticated: false, user: null, google_available: false, settings: null });
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Did the app issue any NON-AUTH fetch? The who-am-I session read fires on mount everywhere (a
 *  contract-mandated, non-blocking auth concern), so "the page makes no network call" means no
 *  trader/bundle/etc. fetch — the session read is excluded. */
function calledNonAuth(): boolean {
  return fetchMock.mock.calls.some((c) => !String(c[0]).includes('/api/auth/'));
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

// =================================================================================================
// routes
// =================================================================================================
describe('routes', () => {
  it('"/" renders Landing INSIDE the shell, not a ticker redirect', async () => {
    renderAt('/');
    // Landing brand + hook + a value prop + the primary CTA are present.
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(screen.getByText('See the AI read on your real positioning.')).toBeInTheDocument();
    expect(screen.getByTestId('vp-ticker')).toBeInTheDocument();
    expect(screen.getByTestId('cta-primary')).toBeInTheDocument();
    // OWNER DECISION (convexa-redesign): the persistent top nav now shows on `/` too — the shell is
    // present and the Ticker/Positions/Scanner nav links render on Landing.
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('nav-ticker')).toBeInTheDocument();
    expect(screen.getByTestId('nav-positions')).toBeInTheDocument();
    expect(screen.getByTestId('nav-scanner')).toBeInTheDocument();
    // It did NOT redirect into the ticker VIEWER: no ticker input field / no bundle fetch.
    expect(screen.queryByLabelText('Ticker')).toBeNull();
    expect(calledNonAuth()).toBe(false); // no trader/bundle fetch (the who-am-I read is excluded)
  });

  it('"/ticker/TSLA" renders Ticker viewer in shell', async () => {
    renderAt('/ticker/TSLA');
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/ticker/TSLA'));
  });

  it('bare "/ticker" defaults to TSLA', async () => {
    renderAt('/ticker');
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/ticker/TSLA'));
  });

  it('"/ticker/AAPL" deep-links AAPL', async () => {
    renderAt('/ticker/AAPL');
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/ticker/AAPL'));
    const input = screen.getByLabelText('Ticker') as HTMLInputElement;
    expect(input).toHaveValue('AAPL');
  });

  it('"/positions" renders Positions in shell', async () => {
    renderAt('/positions');
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('portfolio-panel')).toBeInTheDocument();
  });

  it('"/scanner" renders static coming-soon in shell', () => {
    renderAt('/scanner');
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('scanner-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Scanner — coming soon')).toBeInTheDocument();
  });

  it('"/_ops/metrics" renders operator surface off the shell', async () => {
    renderAt('/_ops/metrics');
    // Operator surface has its OWN AppBar (the "Operator Metrics" wordmark) and is NOT in the shell.
    expect(await screen.findByText(/Operator Metrics/)).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).toBeNull();
    // The product nav (Ticker/Positions/Scanner) is not present on the operator surface.
    expect(screen.queryByTestId('nav-ticker')).toBeNull();
  });
});

// =================================================================================================
// nav
// =================================================================================================
describe('nav', () => {
  it('persistent nav present on ticker/positions/scanner', async () => {
    for (const path of ['/ticker/TSLA', '/positions', '/scanner']) {
      const { unmount } = renderAt(path);
      expect(screen.getByTestId('shell-brand')).toBeInTheDocument();
      expect(screen.getByTestId('nav-ticker')).toBeInTheDocument();
      expect(screen.getByTestId('nav-positions')).toBeInTheDocument();
      expect(screen.getByTestId('nav-scanner')).toBeInTheDocument();
      // The Convexa wordmark (not "GammaFlow") is shown.
      expect(within(screen.getByTestId('shell-brand')).getByText('Convexa')).toBeInTheDocument();
      unmount();
    }
  });

  it('entries navigate between pages', async () => {
    const user = userEvent.setup();
    renderAt('/scanner');
    expect(screen.getByTestId('scanner-placeholder')).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-positions'));
    expect(await screen.findByTestId('portfolio-panel')).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-ticker'));
    expect(await screen.findByText('Call wall')).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-scanner'));
    expect(await screen.findByTestId('scanner-placeholder')).toBeInTheDocument();
  });

  it('active-route indicator on current entry', () => {
    renderAt('/positions');
    expect(screen.getByTestId('nav-positions')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-ticker')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('nav-scanner')).not.toHaveAttribute('aria-current');
  });

  it('shell does not remount across in-shell pages', async () => {
    const user = userEvent.setup();
    renderAt('/scanner');
    const shell = screen.getByTestId('app-shell');

    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('portfolio-panel');
    await user.click(screen.getByTestId('nav-ticker'));
    await screen.findByText('Call wall');
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-placeholder');

    // The SAME shell DOM node persisted through every in-shell navigation (no remount/flash).
    expect(screen.getByTestId('app-shell')).toBe(shell);
  });

  it('landing renders INSIDE the trader nav shell (owner decision)', () => {
    renderAt('/');
    // The persistent top nav shows on Landing too (matches the prototype): shell + nav links present.
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('nav-ticker')).toBeInTheDocument();
    expect(screen.getByTestId('nav-positions')).toBeInTheDocument();
    expect(screen.getByTestId('nav-scanner')).toBeInTheDocument();
    // Still NOT a ticker viewer (Landing content renders, no ticker input field).
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ticker')).toBeNull();
  });
});

// =================================================================================================
// landing
// =================================================================================================
describe('landing', () => {
  it('shows Convexa wordmark + lead hook', () => {
    renderAt('/');
    // Wordmark appears (hero + footer); the lead hook is the hero headline.
    expect(screen.getAllByText('Convexa').length).toBeGreaterThan(0);
    expect(screen.getByText('See the AI read on your real positioning.')).toBeInTheDocument();
  });

  it('shows today-working value props', () => {
    renderAt('/');
    expect(within(screen.getByTestId('vp-ticker')).getByText('Ticker / GEX analysis')).toBeInTheDocument();
    expect(within(screen.getByTestId('vp-positions')).getByText('Simulated positions portfolio')).toBeInTheDocument();
    expect(within(screen.getByTestId('vp-airec')).getByText('AI recommendations')).toBeInTheDocument();
  });

  it('primary CTA enters the app at /ticker', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByTestId('cta-primary'));
    // Now inside the shell on the Ticker viewer (default TSLA).
    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
  });

  it('secondary CTAs navigate to in-shell routes (no dead-end)', async () => {
    const user = userEvent.setup();
    // Positions value-prop CTA → /positions.
    const { unmount } = renderAt('/');
    await user.click(screen.getByTestId('vp-positions-cta'));
    expect(await screen.findByTestId('portfolio-panel')).toBeInTheDocument();
    unmount();

    // Ticker value-prop CTA → /ticker.
    renderAt('/');
    await user.click(screen.getByTestId('vp-ticker-cta'));
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
  });

  it('brokerage connect is coming-soon, not a working button', async () => {
    const user = userEvent.setup();
    renderAt('/');
    // Resting state: a non-navigating waitlist affordance + a coming-soon chip; no broker flow.
    const block = screen.getByTestId('brokerage-block');
    expect(within(block).getByText('coming soon')).toBeInTheDocument();
    const btn = screen.getByTestId('waitlist-button');
    await user.click(btn);
    // Acknowledged state in place — still on the landing, no navigation, no network call.
    expect(screen.getByTestId('waitlist-ack')).toBeInTheDocument();
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(calledNonAuth()).toBe(false); // no broker flow / trader fetch (who-am-I excluded)
  });

  it('Scanner presented as coming-soon', () => {
    renderAt('/');
    const block = screen.getByTestId('scanner-block');
    expect(within(block).getByText('coming soon')).toBeInTheDocument();
    expect(within(block).getByTestId('scanner-cta')).toBeInTheDocument();
  });
});

// =================================================================================================
// scanner
// =================================================================================================
describe('scanner', () => {
  it('static coming-soon, no network', () => {
    renderAt('/scanner');
    expect(screen.getByTestId('scanner-placeholder')).toBeInTheDocument();
    // The AC-Scan-1 requirement: the PAGE issues NO fetch and opens NO EventSource. (The app-level
    // who-am-I read is an auth concern, not the Scanner page — excluded.)
    expect(calledNonAuth()).toBe(false);
    expect(openedEventSources).toBe(0);
    // No spinner/skeleton/loading affordance.
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

// =================================================================================================
// invariants — operator separation + single router/theme
// =================================================================================================
describe('invariants', () => {
  it('operator path separation preserved', async () => {
    // Nav never reaches the operator route — no link with that href anywhere in the shell.
    renderAt('/scanner');
    const links = screen.getAllByRole('link');
    expect(links.some((a) => (a.getAttribute('href') ?? '').includes('_ops'))).toBe(false);

    // Landing footer/links never reach it either.
    const { unmount } = renderAt('/');
    const landingLinks = screen.getAllByRole('link');
    expect(landingLinks.some((a) => (a.getAttribute('href') ?? '').includes('_ops'))).toBe(false);
    unmount();
  });

  it('single router + single theme provider', async () => {
    // App mounts under exactly the one MemoryRouter + one ThemeProvider this harness supplies; the app
    // code nests neither. Deep-links + nav + theming work with no duplicate-router/theme error.
    const user = userEvent.setup();
    renderAt('/ticker/AAPL');
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
    await user.click(screen.getByTestId('nav-positions'));
    expect(await screen.findByTestId('portfolio-panel')).toBeInTheDocument();
  });
});
