/**
 * App shell / route table — RISK-BASED test suite (per the amended QA rule,
 * `.claude/agents/qa-verify.md` §4, 2026-07-13). Supersedes the per-AC `app.spec.tsx` (42-AC mirror).
 * We test ONLY the invariants where a silent regression is plausible AND invisible:
 *
 *   1. The ROUTE TABLE contract — one parameterized walk proving every route resolves to its page
 *      inside the shell (`/` is never a ticker redirect; bare `/ticker` falls back to SPY when no
 *      preference is set — index-first-defaults AC-1; `/ticker/:symbol` deep-links). Preference
 *      precedence (AC-2: server-wins signed in, client-local anonymous) rides its own describe. Folded into the same walk: `operator-vs-trader-path-separation`
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
import type { TickerBundle } from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetLocalPrefs, saveLocalDefaultTicker } from '@/features/auth/localPrefs';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import App from './app';

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

/** URL-only match — `fetch` may also pass `{ signal }` / credentials (AbortController on ticker). */
function expectFetchUrlContaining(substr: string) {
  const hit = fetchMock.mock.calls.some((c) => String(c[0]).includes(substr));
  expect(hit, `expected a fetch URL containing ${substr}`).toBe(true);
}
function expectNoFetchUrlContaining(substr: string) {
  const hit = fetchMock.mock.calls.some((c) => String(c[0]).includes(substr));
  expect(hit, `expected no fetch URL containing ${substr}`).toBe(false);
}
/** Per-test who-am-I body (default anonymous). Set BEFORE render to walk the signed-in path. */
let sessionBody: unknown;

/** Owner lockdown (2026-08-06): `/positions` and `/scanner` sit behind `RequireAuth`, so any walk
 *  that expects those PAGES must be signed in. Call BEFORE `renderAt`. */
function signedIn() {
  sessionBody = {
    authenticated: true,
    user: { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
    google_available: false,
    settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
  };
}

beforeEach(() => {
  sessionBody = { authenticated: false, user: null, google_available: false, settings: null };
  localStorage.clear();
  __resetLocalPrefs(); // the uiprefs store caches in module memory — clearing storage isn't enough
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
    // user-accounts: the app reads who-am-I once on mount (non-blocking; anonymous by default).
    if (url.includes('/api/auth/session')) return json(sessionBody);
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
    /** Owner lockdown: the route is behind `RequireAuth`, so walk it signed in. */
    authed?: boolean;
  }> = [
    { path: '/', ready: () => screen.findByTestId('landing') },
    {
      path: '/ticker', // bare → unset-fallback SPY redirect (index-first-defaults AC-1)
      ready: () => screen.findByText('Call wall'),
      expectFetch: '/api/ticker/SPY',
    },
    {
      path: '/ticker/NVDA', // URL-addressable symbol deep-link
      ready: () => screen.findByText('Call wall'),
      expectFetch: '/api/ticker/NVDA',
    },
    // Gated by the owner lockdown — walked SIGNED IN, since the page is what this test is about.
    // The signed-out arm is its own test below.
    { path: '/positions', ready: () => screen.findByTestId('portfolio-panel'), authed: true },
    { path: '/scanner', ready: () => screen.findByTestId('scanner-page'), authed: true },
    { path: '/blog', ready: () => screen.findByTestId('blog-page') },
    { path: '/methodology', ready: () => screen.findByTestId('methodology-page') },
    {
      path: '/lab/structure-field',
      ready: () => screen.findByTestId('structure-field-lab'),
    },
    { path: '/settings', ready: () => screen.findByTestId('settings-page') },
  ];

  it.each(walk)('$path resolves to its page inside the shell, with no /_ops link', async (c) => {
    if (c.authed) signedIn();
    renderAt(c.path);
    await c.ready();
    // Every walked route renders INSIDE the persistent shell.
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    if (c.expectFetch) {
      expectFetchUrlContaining(c.expectFetch);
    }
    // `/` is never a ticker redirect: no ticker input on the landing.
    if (c.path === '/') expect(screen.queryByLabelText('Ticker')).toBeNull();
    // Promoted invariant, enforced on EVERY shell surface: the operator route is unlinked.
    expectNoOpsLink();
  });

  // Owner lockdown (2026-08-06) — the negative space of the two walked-signed-in routes above.
  it.each([
    { path: '/positions', page: 'portfolio-panel' },
    { path: '/scanner', page: 'scanner-page' },
  ])('signed out, $path shows the sign-in wall and NOT the page', async (c) => {
    renderAt(c.path); // sessionBody stays anonymous
    expect(await screen.findByTestId('require-auth-wall')).toBeInTheDocument();
    expect(screen.queryByTestId(c.page)).toBeNull();
    // Refused VISIBLY, inside the shell — never a silent bounce that leaves no explanation.
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('require-auth-signin')).toBeInTheDocument();
  });

  it('signed out, the PUBLIC routes are untouched by the lockdown', async () => {
    renderAt('/ticker/SPY');
    await screen.findByText('Call wall');
    expect(screen.queryByTestId('require-auth-wall')).toBeNull();
  });

  it('an unknown route resolves to NO page (never silently mounts the wrong surface)', () => {
    expect(() => renderAt('/definitely/not/a/route')).not.toThrow();
    expect(screen.queryByTestId('landing')).toBeNull();
    expect(screen.queryByText('Call wall')).toBeNull();
  });
});

// =================================================================================================
// 1b. Bare `/ticker` preference precedence (index-first-defaults AC-2) — the stored
//     `default_ticker` ALWAYS beats the new SPY fallback; only the UNSET case changed (AC-1,
//     asserted in the walk above). Silently regressable: a fallback-order bug still renders a
//     perfectly healthy ticker page — just the wrong one.
// =================================================================================================
describe('bare /ticker — default_ticker preference wins over the SPY fallback', () => {
  it('anonymous: the CLIENT-LOCAL pref routes to its ticker (not SPY)', async () => {
    saveLocalDefaultTicker('MSFT');
    renderAt('/ticker');
    await screen.findByText('Call wall');
    expectFetchUrlContaining('/api/ticker/MSFT');
    expectNoFetchUrlContaining('/api/ticker/SPY');
  });

  it('signed-in: the SERVER pref wins — even over a conflicting leftover local pref', async () => {
    saveLocalDefaultTicker('MSFT'); // leftover anonymous pref; must NOT be applied signed-in
    sessionBody = {
      authenticated: true,
      user: { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
      google_available: false,
      settings: { active_persona_id: null, default_ticker: 'NVDA', theme: 'dark' },
    };
    renderAt('/ticker');
    await screen.findByText('Call wall');
    expectFetchUrlContaining('/api/ticker/NVDA');
    expectNoFetchUrlContaining('/api/ticker/MSFT');
    expectNoFetchUrlContaining('/api/ticker/SPY');
  });

  it('signed-in with NO server pref: the unset fallback (SPY) applies — no migration, no rewrite', async () => {
    sessionBody = {
      authenticated: true,
      user: { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
      google_available: false,
      settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
    };
    renderAt('/ticker');
    await screen.findByText('Call wall');
    expectFetchUrlContaining('/api/ticker/SPY');
    // `[loss-free-durable-migration]` untouched: resolving the fallback never WRITES a preference.
    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('/api/auth/settings'))).toBe(false);
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
// 2b. Mobile nav drawer safety (redesign-stage-0 §8.8 — invariant-bearing, not visual). Re-expresses
//     the responsive-branch test intent under the risk rule: the temporary drawer's stateful
//     open/navigate/close behavior + the promoted `operator-vs-trader-path-separation` invariant
//     extended to the drawer. (The hamburger is display:none at md+ in a real browser; the stateful
//     behavior is the regression-prone part guarded here.)
// =================================================================================================
describe('mobile nav drawer', () => {
  // Spine + lab: Scanner → Ticker → Positions → Alerts → Lab → Blog
  const DRAWER_ENTRIES = [
    'scanner',
    'ticker',
    'positions',
    'alerts',
    'lab',
    'blog',
  ] as const;

  it('carries EXACTLY the trader NAV entries, no /_ops link, aria-current on the active entry', async () => {
    const user = userEvent.setup();
    signedIn(); // gated by the owner lockdown
    renderAt('/positions');
    await screen.findByTestId('portfolio-panel');

    // Temporary drawer — its links are NOT mounted at rest (never duplicating the inline nav-*).
    expect(screen.queryByTestId('nav-drawer-ticker')).toBeNull();

    await user.click(screen.getByTestId('nav-menu-button'));
    const drawer = await screen.findByTestId('nav-drawer');

    // Exactly the trader entries — nothing more (an operator entry can never sneak in).
    for (const e of DRAWER_ENTRIES) {
      expect(within(drawer).getByTestId(`nav-drawer-${e}`)).toBeInTheDocument();
    }
    const links = within(drawer).queryAllByRole('link');
    expect(links.length).toBe(DRAWER_ENTRIES.length);
    expect(links.some((a) => (a.getAttribute('href') ?? '').includes('_ops'))).toBe(false);

    // Active-route highlight rules match the inline nav: aria-current rides the active entry only.
    expect(within(drawer).getByTestId('nav-drawer-positions')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(drawer).getByTestId('nav-drawer-ticker')).not.toHaveAttribute('aria-current');
  });

  it('a drawer link navigates AND closes the drawer (the branch behavior, re-expressed)', async () => {
    const user = userEvent.setup();
    signedIn(); // gated by the owner lockdown
    renderAt('/scanner');
    await screen.findByTestId('scanner-page');

    await user.click(screen.getByTestId('nav-menu-button'));
    await user.click(await screen.findByTestId('nav-drawer-positions'));

    expect(await screen.findByTestId('portfolio-panel')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('nav-drawer-ticker')).toBeNull());
  });
});

// =================================================================================================
// 3. The shell persists across in-shell navigation (no remount → no feed churn / chrome flash)
// =================================================================================================
describe('shell persistence', () => {
  it('the SAME shell DOM node survives every in-shell navigation', async () => {
    const user = userEvent.setup();
    signedIn(); // gated by the owner lockdown
    renderAt('/scanner');
    const shell = screen.getByTestId('app-shell');

    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('portfolio-panel');
    await user.click(screen.getByTestId('nav-ticker'));
    await screen.findByText('Call wall');
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-page');

    expect(screen.getByTestId('app-shell')).toBe(shell);
  });
});
