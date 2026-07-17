/**
 * App shell / route table — RISK-BASED test suite (per the amended QA rule,
 * `.claude/agents/qa-verify.md` §4, 2026-07-13). Supersedes the per-AC `app.spec.tsx` (42-AC mirror).
 * We test ONLY the invariants where a silent regression is plausible AND invisible:
 *
 *   1. The ROUTE TABLE contract — one parameterized walk proving every route resolves to its page
 *      inside the shell (`/` is never a ticker redirect; bare `/ticker` defaults to TSLA;
 *      `/ticker/:symbol` deep-links). Folded into the same walk: `operator-vs-trader-path-separation`
 *      (promoted) — NO anchor to `/_ops` exists on ANY rendered shell surface, enforced by
 *      construction on every case.
 *   2. `/_ops/metrics` renders OFF the shell (own chrome, no trader nav).
 *   3. Unknown routes resolve to NO page (never silently mount the wrong surface, never crash).
 *   4. The shell node persists across in-shell navigation (a remount regression is invisible in
 *      per-page tests but churns page-scoped feeds and flashes chrome).
 *
 * NOT asserted here (visible + intentional → review/QA; brittle to automate): wordmark/copy,
 * landing value-prop text, nav presence/active styling, CTA copy. The Landing funnel + inertness
 * live in `pages/landing/landing.spec.tsx`; the SSE lifecycle dance lives in
 * `shell/shell-live-lifecycle.flow.spec.tsx`.
 *
 * Mocks ONLY the network boundary (`fetch` + `EventSource`), never a live backend. The strict fetch
 * mock THROWS on any unexpected call.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { TickerBundle } from '@org/api';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';

/** The shared fixture pinned to the requested symbol (the walk deep-links non-TSLA tickers). */
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
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const tk = (url.match(/\/api\/ticker\/([A-Z]+)/) ?? [])[1] ?? 'TSLA';
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
    // user-accounts: the app reads who-am-I once on mount (non-blocking; anonymous here).
    if (url.includes('/api/auth/session'))
      return json({ authenticated: false, user: null, google_available: false, settings: null });
    if (url.includes('/api/auth/ai-key'))
      return json({ error: 'auth_required', message: 'sign in' }, 403);
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

/** `operator-vs-trader-path-separation` (promoted): no rendered surface may link to `/_ops`. */
function expectNoOpsLink() {
  const links = screen.queryAllByRole('link');
  expect(links.some((a) => (a.getAttribute('href') ?? '').includes('_ops'))).toBe(false);
}

// =================================================================================================
// 1. The route table — one parameterized walk; the ops-unlinked invariant rides every case
// =================================================================================================
describe('route table', () => {
  const walk: Array<{
    path: string;
    /** Resolves once the destination page has actually rendered. */
    ready: () => Promise<unknown>;
    /** A bundle fetch the route MUST have issued (the redirect/deep-link proof), if any. */
    expectFetch?: string;
  }> = [
    { path: '/', ready: () => screen.findByTestId('landing') },
    {
      path: '/ticker', // bare → default-TSLA redirect
      ready: () => screen.findByText('Call wall'),
      expectFetch: '/api/ticker/TSLA',
    },
    {
      path: '/ticker/NVDA', // URL-addressable symbol deep-link
      ready: () => screen.findByText('Call wall'),
      expectFetch: '/api/ticker/NVDA',
    },
    { path: '/positions', ready: () => screen.findByTestId('portfolio-panel') },
    { path: '/scanner', ready: () => screen.findByTestId('scanner-placeholder') },
    { path: '/blog', ready: () => screen.findByTestId('blog-page') },
    { path: '/settings', ready: () => screen.findByTestId('settings-page') },
  ];

  it.each(walk)('$path resolves to its page inside the shell, with no /_ops link', async (c) => {
    renderAt(c.path);
    await c.ready();
    // Every walked route renders INSIDE the persistent shell.
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    if (c.expectFetch) {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(c.expectFetch));
    }
    // `/` is never a ticker redirect: no ticker input on the landing.
    if (c.path === '/') expect(screen.queryByLabelText('Ticker')).toBeNull();
    // Promoted invariant, enforced on EVERY shell surface: the operator route is unlinked.
    expectNoOpsLink();
  });

  it('an unknown route resolves to NO page (never silently mounts the wrong surface)', () => {
    expect(() => renderAt('/definitely/not/a/route')).not.toThrow();
    expect(screen.queryByTestId('landing')).toBeNull();
    expect(screen.queryByText('Call wall')).toBeNull();
  });
});

// =================================================================================================
// 2. Operator separation — `/_ops/metrics` stays OFF the shell
// =================================================================================================
describe('operator-vs-trader path separation', () => {
  it('"/_ops/metrics" renders WITHOUT the trader shell/nav (own chrome)', async () => {
    renderAt('/_ops/metrics');
    expect(await screen.findByText(/Operator Metrics/)).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).toBeNull();
    expect(screen.queryByTestId('nav-ticker')).toBeNull();
  });
});

// =================================================================================================
// 3. The shell persists across in-shell navigation (no remount → no feed churn / chrome flash)
// =================================================================================================
describe('shell persistence', () => {
  it('the SAME shell DOM node survives every in-shell navigation', async () => {
    const user = userEvent.setup();
    renderAt('/scanner');
    const shell = screen.getByTestId('app-shell');

    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('portfolio-panel');
    await user.click(screen.getByTestId('nav-ticker'));
    await screen.findByText('Call wall');
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-placeholder');

    expect(screen.getByTestId('app-shell')).toBe(shell);
  });
});
