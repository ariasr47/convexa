/**
 * Landing (`/`) — RISK-BASED test suite (per the amended QA rule, `.claude/agents/qa-verify.md` §4,
 * 2026-07-13). We test ONLY the invariants where a silent regression is plausible AND invisible to a
 * human reviewer:
 *   1. `no-real-order-path` — the coming-soon brokerage surface is STRUCTURALLY inert (no link; "Notify
 *      me" shows a toast but never navigates or touches a trader/broker endpoint).
 *   2. Static — the landing issues ZERO trader/bundle fetch and opens no SSE on mount.
 *   3. The funnel — every CTA routes to its correct in-shell destination (href contract + one real-router
 *      proof that the route actually resolves).
 *
 * NOT asserted here (visible + intentional → verified by review/QA; brittle to automate): exact copy /
 * H1, disclaimer wording, tooltip/element presence, per-widget styling.
 *
 * The strict `fetch` mock below THROWS on any non-auth call, so "static" is enforced by construction —
 * an accidental trader fetch added to the landing fails every test in this file.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import { Landing } from './Landing';

let fetchMock: ReturnType<typeof vi.fn>;
let openedEventSources = 0;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  openedEventSources = 0;
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() {
      openedEventSources += 1;
    }
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);

  // STRICT mock: only the app-wide who-am-I read is allowed; ANY trader/bundle call throws, so the
  // "static landing" invariant is enforced by construction.
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
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

/** Any NON-AUTH fetch? The who-am-I read fires app-wide on mount and is excluded. */
function calledNonAuth(): boolean {
  return fetchMock.mock.calls.some((c) => !String(c[0]).includes('/api/auth/'));
}

/** Surfaces the router path so (non-)navigation can be asserted by URL. */
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location" data-pathname={loc.pathname} />;
}

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
// 1. no-real-order-path — the coming-soon brokerage surface is structurally inert (HARD invariant)
// =================================================================================================
describe('Landing · no-real-order-path (inert coming-soon)', () => {
  it('brokerage block has no link, and "Notify me" toasts WITHOUT navigating or hitting the network', async () => {
    const user = userEvent.setup();
    renderLanding();

    // Structurally inert: the brokerage block carries no anchor — it can never link into a broker flow.
    expect(screen.getByTestId('brokerage-block').querySelector('a')).toBeNull();
    expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/');

    await user.click(screen.getByTestId('waitlist-button'));

    // A toast acknowledges in place — and NOTHING else happens: no route change, no trader/broker call.
    expect(await screen.findByTestId('waitlist-ack')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/');
    expect(calledNonAuth()).toBe(false);

    // The control is a button, not a link/broker affordance.
    const btn = screen.getByTestId('waitlist-button');
    expect(btn.tagName.toLowerCase()).toBe('button');
    expect(btn).not.toHaveAttribute('href');
  });
});

// =================================================================================================
// 2. Static — zero trader network (HARD invariant)
// =================================================================================================
describe('Landing · static (zero network)', () => {
  it('issues no trader/bundle fetch and opens no SSE on mount', () => {
    renderLanding();
    expect(calledNonAuth()).toBe(false);
    expect(openedEventSources).toBe(0);
  });
});

// =================================================================================================
// 3. The funnel — CTAs route to the correct in-shell destinations
// =================================================================================================
describe('Landing · CTA routing', () => {
  it('every CTA points at its destination route', () => {
    renderLanding();
    const routes: Array<[testId: string, href: string]> = [
      ['cta-primary', '/ticker'],
      ['cta-secondary', '/ticker'],
      ['vp-ticker-cta', '/ticker'],
      ['vp-positions-cta', '/positions'],
      ['vp-airec-cta', '/ticker'],
    ];
    for (const [testId, href] of routes) {
      expect(screen.getByTestId(testId)).toHaveAttribute('href', href);
    }
    // The scanner CTA lives inside the coming-soon band.
    expect(within(screen.getByTestId('scanner-block')).getByTestId('scanner-cta')).toHaveAttribute(
      'href',
      '/scanner',
    );
  });

  it('the primary CTA actually resolves into the Ticker viewer (real router, end-to-end)', async () => {
    const user = userEvent.setup();
    // Entering the ticker route legitimately fetches the bundle — widen the mock (shared makeBundle
    // fixture) for the destination page so the real router can render it.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      }
      if (url.includes('/api/personas'))
        return json([{ id: 'default', name: 'Default (no persona)' }]);
      if (url.includes('/api/ticker/')) return json(makeBundle());
      if (url.includes('/api/recommendation/status/')) {
        return json({
          availability: { in_app_enabled: true },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
        });
      }
      return json(null); // /api/contract and any other incidental reads
    });

    renderApp('/');
    await user.click(screen.getByTestId('cta-primary'));
    // Navigation is proven by the Ticker VIEWER loading its bundle-driven "Call wall" tile.
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
  });
});
