/**
 * Landing (`/`) — RISK-BASED test suite (SPEC §7 items 1 and 4; PLAN F7 step 3). We test ONLY the
 * invariants where a silent regression is plausible AND invisible to a human reviewer:
 *   1. Static — the landing issues ZERO trader/bundle fetch and opens no SSE on mount (AC-L17).
 *   2. AC-L6/AC-L15/AC-L16 — the funnel: the primary action resolves into the public Ticker
 *      (never a wall).
 *
 * NOT asserted here (visible + intentional → verified by review; brittle to automate): the
 * section inventory, CTA naming and closure copy, exact body copy beyond the strings a test
 * already needs, disclaimer wording, per-widget styling. Copy
 * PROVENANCE (byte-fidelity to the design source, the cut phrases) is F13's own structural spec —
 * not duplicated here.
 *
 * The strict `fetch` mock below THROWS on any non-auth call, so "static" is enforced by
 * construction — an accidental trader fetch added to the landing fails every test in this file.
 * VERBATIM (SPEC §7 item 4 — do not rewrite): the `fetchMock` assignment in `beforeEach` and the
 * "Landing · static (zero network)" describe block are the mechanism behind AC-L17.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import App, { preloadRoutes } from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { theme } from '@/shared/theme/theme';
import { Landing } from './Landing';

let fetchMock: ReturnType<typeof vi.fn>;
let openedEventSources = 0;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

// The lazy pages this file opens through <App/> load here, at the hook timeout, not inside a
// 5 s `findBy` wait (docs/testing/2026-10-22/TEST_PLAN.md section 6.1, batch 3).
beforeAll(() => preloadRoutes(['TickerDashboard']));
beforeEach(() => {
  localStorage.clear();
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

function renderLanding() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/']}>
        <Landing />
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
// 1. Static — zero trader network (HARD invariant) — VERBATIM (SPEC §7 item 4)
// =================================================================================================
describe('Landing · static (zero network)', () => {
  it('issues no trader/bundle fetch and opens no SSE on mount', () => {
    renderLanding();
    expect(calledNonAuth()).toBe(false);
    expect(openedEventSources).toBe(0);
  });
});

// =================================================================================================
// AC-L6/AC-L15/AC-L16 — the one big action works without an account
// =================================================================================================
describe('AC-L6/AC-L15/AC-L16 — the one big action works without an account', () => {
  it('the primary CTA resolves into the public Ticker viewer, not a wall (real router)', async () => {
    /* widen the fetch mock exactly as the CTA-routing suite used to, then: */
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
    // Production's hero primary is the demo (owner, 2026-10-16); the free Ticker is the band's link.
    await userEvent.setup().click(screen.getByTestId('cta-band-secondary'));
    // Free path: Ticker VIEWER loads its bundle-driven "Call wall" tile without sign-in.
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
    expect(screen.queryByTestId('require-auth-wall')).toBeNull();
  });
});
