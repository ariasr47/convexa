/**
 * Landing (`/`) — component + flow tests for the convexa-redesign re-skin.
 *
 * Authority: FRONTEND_EXECUTION_CONTRACT (Landing) + README §2. Mocks ONLY the network boundary
 * (`fetch` + `EventSource`) — never a live backend — to prove the surface is STATIC (zero calls).
 * Asserts the HARD invariants: no-real-order-path (inert coming-soon, non-navigating "Notify me"),
 * fixed CTA destinations, verbatim honesty copy, and zero network.
 *
 * Routing is exercised through the real `App` router so CTA destinations are asserted end-to-end
 * (a click lands on the in-shell route), matching the contract's "each CTA navigates to its route".
 */
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import App from '../app';
import { Landing } from './Landing';
import { theme } from '../theme';
import { __resetMemory } from '../positions/store';

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
    const json = (b: unknown) =>
      new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
    // The who-am-I session read is allowed everywhere (non-blocking auth concern); the trader/bundle
    // paths must NOT be hit from Landing. Anything else is an unexpected call.
    if (url.includes('/api/auth/session')) {
      return json({ authenticated: false, user: null, google_available: false, settings: null });
    }
    throw new Error(`Unexpected fetch from Landing: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Any NON-AUTH fetch? The who-am-I session read fires on mount app-wide and is excluded. */
function calledNonAuth(): boolean {
  return fetchMock.mock.calls.some((c) => !String(c[0]).includes('/api/auth/'));
}

/** Probe that surfaces the current router path so tests can assert (non-)navigation by URL. */
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location" data-pathname={loc.pathname} />;
}

/** Render Landing in isolation (component-level), with router + theme + a URL probe. */
function renderLanding() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/']}>
        <Landing />
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Render the full app at a path (for end-to-end CTA navigation assertions). */
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

// =================================================================================================
// Hero
// =================================================================================================
describe('Landing · hero', () => {
  it('renders the convexity motif (shared decorative SVG)', () => {
    renderLanding();
    expect(screen.getByTestId('convexity-motif-svg')).toBeInTheDocument();
  });

  it('shows the eyebrow pill and the exact H1', () => {
    renderLanding();
    expect(screen.getByText('Dealer-gamma analytics')).toBeInTheDocument();
    expect(screen.getByText('See the AI read on your real positioning.')).toBeInTheDocument();
  });

  it('both hero CTAs link to /ticker (contained + outlined)', () => {
    renderLanding();
    const primary = screen.getByTestId('cta-primary');
    const secondary = screen.getByTestId('cta-secondary');
    expect(primary).toHaveTextContent('Open the Ticker viewer →');
    expect(primary).toHaveAttribute('href', '/ticker');
    expect(secondary).toHaveTextContent('See a live example');
    expect(secondary).toHaveAttribute('href', '/ticker');
  });

  it('the sub-line carries the dotted "dealer gamma" jargon tooltip', () => {
    renderLanding();
    expect(screen.getByText('dealer gamma')).toBeInTheDocument();
  });
});

// =================================================================================================
// Value cards — what works today
// =================================================================================================
describe('Landing · value cards', () => {
  it('renders the 3 cards with their titles', () => {
    renderLanding();
    expect(within(screen.getByTestId('vp-ticker')).getByText('Ticker / GEX analysis')).toBeInTheDocument();
    expect(within(screen.getByTestId('vp-positions')).getByText('Simulated positions portfolio')).toBeInTheDocument();
    expect(within(screen.getByTestId('vp-airec')).getByText('AI recommendations')).toBeInTheDocument();
  });

  it('each card CTA points at its route (/ticker, /positions, /ticker)', () => {
    renderLanding();
    expect(screen.getByTestId('vp-ticker-cta')).toHaveAttribute('href', '/ticker');
    expect(screen.getByTestId('vp-positions-cta')).toHaveAttribute('href', '/positions');
    expect(screen.getByTestId('vp-airec-cta')).toHaveAttribute('href', '/ticker');
  });

  it('carries the jargon tooltips on the card bodies (dealer gamma / SIMULATED)', () => {
    renderLanding();
    expect(within(screen.getByTestId('vp-ticker')).getByText('Dealer gamma')).toBeInTheDocument();
    expect(within(screen.getByTestId('vp-positions')).getByText('SIMULATED')).toBeInTheDocument();
  });
});

// =================================================================================================
// Coming-soon band — no-real-order-path (HARD invariant)
// =================================================================================================
describe('Landing · coming-soon band (no-real-order-path)', () => {
  it('renders both boxes as hatched/inert with amber "coming soon" badges', () => {
    renderLanding();
    const brokerage = screen.getByTestId('brokerage-block');
    const scanner = screen.getByTestId('scanner-block');
    expect(within(brokerage).getByText('coming soon')).toBeInTheDocument();
    expect(within(scanner).getByText('coming soon')).toBeInTheDocument();
    // The boxes themselves are the inert ComingSoonBox primitive (hatch + dashed border).
    expect(brokerage).toHaveStyle({ borderStyle: 'dashed' });
    expect(scanner).toHaveStyle({ borderStyle: 'dashed' });
  });

  it('"Notify me" shows a toast and DOES NOT navigate (no broker flow)', async () => {
    const user = userEvent.setup();
    renderLanding();
    // No acknowledgement before clicking; we start on `/`.
    expect(screen.queryByTestId('waitlist-ack')).toBeNull();
    expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/');

    await user.click(screen.getByTestId('waitlist-button'));

    // Toast acknowledgement appears, verbatim, and never implies a broker connection.
    const ack = await screen.findByTestId('waitlist-ack');
    expect(ack).toHaveTextContent("Thanks — we'll let you know");
    // Non-navigation asserted by the URL staying on `/` (Landing now renders INSIDE the shell, so
    // shell-presence is no longer the navigation signal). No network call fired either.
    expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/');
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(calledNonAuth()).toBe(false);

    // The "Notify me" button is not a link / broker affordance.
    const btn = screen.getByTestId('waitlist-button');
    expect(btn.tagName.toLowerCase()).toBe('button');
    expect(btn).not.toHaveAttribute('href');
  });

  it('"Preview the scanner →" links to /scanner', () => {
    renderLanding();
    const cta = within(screen.getByTestId('scanner-block')).getByTestId('scanner-cta');
    expect(cta).toHaveTextContent('Preview the scanner →');
    expect(cta).toHaveAttribute('href', '/scanner');
  });

  it('the brokerage block contains NO link/anchor (inert — only the Notify button)', () => {
    renderLanding();
    const block = screen.getByTestId('brokerage-block');
    expect(block.querySelector('a')).toBeNull();
  });
});

// =================================================================================================
// Honesty copy — verbatim
// =================================================================================================
describe('Landing · honesty copy', () => {
  it('the footer disclaimer is present verbatim', () => {
    renderLanding();
    const disclaimer = screen.getByTestId('footer-disclaimer');
    expect(disclaimer).toHaveTextContent(
      'Convexa is an analysis tool. All positions and trades shown are simulated (paper). ' +
        'Not investment advice. No brokerage connection.',
    );
  });
});

// =================================================================================================
// Static — zero network (HARD invariant)
// =================================================================================================
describe('Landing · static (zero network)', () => {
  it('issues no trader/bundle fetch and opens no EventSource', () => {
    renderLanding();
    expect(calledNonAuth()).toBe(false);
    expect(openedEventSources).toBe(0);
  });
});

// =================================================================================================
// CTA navigation end-to-end (through the real router)
// =================================================================================================
describe('Landing · CTA navigation (end-to-end)', () => {
  it('primary CTA enters the Ticker viewer in-shell', async () => {
    const user = userEvent.setup();
    // The full app needs the trader bundle once we navigate INTO the ticker; widen the mock here.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/session')) {
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      }
      if (url.includes('/api/personas')) return json([{ id: 'default', name: 'Default (no persona)' }]);
      // A minimal-but-complete bundle so the Ticker viewer renders without throwing.
      if (url.includes('/api/ticker/')) {
        return json({
          market_state: {
            ticker: 'TSLA', price: 250.5, gex_spot: 250, timestamp: 1_700_000_000,
            timestamp_iso: '2026-06-23T14:30:00Z', call_wall: 260, put_wall: 240, peak_gex_strike: 255,
            gamma_flip: 248, max_pain: 250, max_pain_expiration: '2026-06-26', net_gex: 1.2e9,
            call_gex: 2.0e9, put_gex: -0.8e9, total_gex: 1.2e9, net_dex: 5.0e8, call_dex: 6.0e8,
            put_dex: -1.0e8, net_vanna: null, net_charm: null, net_volga: null, vwap: 249,
            vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null,
            dte_min: null, dte_max: null, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.12, net_flow: null,
            put_call_ratio: 0.8, chain_vol_oi_ratio: 0.5, total_volume: 100_000, vol_oi_unusual_threshold: 1,
            iv_skew: null, term_structure: null,
          },
          signals: {
            ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral',
            distances: {}, setups: [], opportunity_score: 42, opportunity_tier: 'watch',
            prime_prompt_eligible: false,
          },
          strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [] },
          expirations: [{ date: '2026-06-26', dte: 3 }],
          ai_eval: { ready: false, reasons: [], changed: false, state_fingerprint: 'x', score_threshold: 60 },
          meta: {
            served_at: '2026-06-23T14:30:00Z', cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
            freshness: { snapshot_iso: '2026-06-23T14:30:00Z', data_age_seconds: 30, stale: false, stale_after_seconds: 600 },
          },
          off_exchange: { ratio_pct: 38, offex_shares: 38_000, total_shares: 100_000, levels: [], blocks: [], block_min_shares: 5000, note: '' },
          position_eval: null,
        });
      }
      if (url.includes('/api/recommendation/status/')) {
        return json({
          availability: { in_app_enabled: true },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
        });
      }
      if (url.includes('/api/contract/')) return json(null);
      return json(null);
    });

    renderApp('/');
    // The shell is now present on `/` already (owner decision); navigation is proven by the Ticker
    // VIEWER loading (its bundle-driven "Call wall" tile), not by shell presence.
    await user.click(screen.getByTestId('cta-primary'));
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
  });

  it('positions value-card CTA enters /positions in-shell', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await user.click(screen.getByTestId('vp-positions-cta'));
    expect(await screen.findByTestId('portfolio-panel')).toBeInTheDocument();
  });
});
