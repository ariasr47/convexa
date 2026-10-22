/**
 * index-first-defaults — the single-name honesty caveat (SPEC AC-4/AC-5), risk-based:
 *
 *   - AC-4 render + exact copy: for a symbol NOT in the scanner universe the muted caption renders
 *     on the deck's freshness/context area — advisory tone, no warn glyph, no alert role.
 *   - member ⇒ absent: SPY/QQQ never carry it.
 *   - AC-5 `[absent-is-not-none]` (the silently-regressable one): a FAILED, GARBLED, or EMPTY
 *     universe read must NOT produce the caption — "we don't know" is never rendered as "thin".
 *     The read is silent best-effort: no error surface appears for it.
 *   - No loading state: the caption may appear once the read resolves (SPEC §4) — walked with a
 *     deferred universe response.
 *
 * Mounts the REAL app subtree at `/ticker/:symbol`, mocking ONLY the network boundary (`fetch` +
 * a silent `EventSource`) — never a live backend. The strict mock THROWS on any unexpected call.
 */
import type { TickerBundle } from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import App, { preloadRoutes } from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import { SINGLE_NAME_CAVEAT } from './widgets/_kit/copy';

/** The universe fixture: SPY/QQQ are members; anything else is a confirmed nonmember. */
const UNIVERSE = { symbols: ['SPY', 'QQQ'], universe_size: 2 };

function bundleFor(ticker: string): TickerBundle {
  const b = makeBundle();
  return {
    ...b,
    market_state: { ...b.market_state, ticker },
    signals: { ...b.signals, ticker },
    strike_profile: { ...b.strike_profile, ticker },
  };
}

type UniverseMode =
  | { kind: 'ok' }
  | { kind: 'http-500' }
  | { kind: 'garbled' } // resolves 200 with an empty/shapeless list — still NOT membership evidence
  | { kind: 'deferred' };

let universeMode: UniverseMode = { kind: 'ok' };
let resolveUniverse: (() => void) | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

// The lazy pages this file opens through <App/> load here, at the hook timeout, not inside a
// 5 s `findBy` wait (docs/testing/2026-10-22/TEST_PLAN.md section 6.1, batch 3).
beforeAll(() => preloadRoutes(['TickerDashboard']));
beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  universeMode = { kind: 'ok' };
  resolveUniverse = null;

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
    if (url.includes('/api/auth/session'))
      return json({ authenticated: false, user: null, google_available: false, settings: null });
    if (url.includes('/api/ticker/')) {
      const tk = (url.match(/\/api\/ticker\/([A-Z]+)/) ?? [])[1] ?? 'SPY';
      return json(bundleFor(tk));
    }
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
    if (url.includes('/api/scan/universe')) {
      switch (universeMode.kind) {
        case 'ok':
          return json(UNIVERSE);
        case 'http-500':
          return new Response('boom', { status: 500 });
        case 'garbled':
          return json({ symbols: [], universe_size: 0 });
        case 'deferred':
          return new Promise<Response>((res) => {
            resolveUniverse = () => res(json(UNIVERSE));
          });
      }
    }
    if (url.includes('/history'))
      return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
    throw new Error(`Unexpected fetch in single-name-caveat spec: ${url}`);
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

/** The universe read resolved (or failed) — the assertion window for "absent" cases is honest. */
async function universeRead() {
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/scan/universe'))).toBe(
      true,
    ),
  );
}

describe('single-name caveat (index-first-defaults AC-4/AC-5)', () => {
  it('AC-4: a confirmed NON-universe symbol renders the caption — exact copy, advisory-only chrome', async () => {
    renderAt('/ticker/GME');
    await screen.findByText('Call wall');
    const caveat = await screen.findByTestId('single-name-caveat');
    expect(caveat).toHaveTextContent(SINGLE_NAME_CAVEAT);
    expect(SINGLE_NAME_CAVEAT).toBe(
      'Single-name read — dealer-positioning evidence is strongest on index and high-liquidity ' +
        'tickers. Treat these levels as context, not a forecast.',
    );
    // Advisory, never a warning: no glyph, no alert role on the caption line.
    expect(caveat.textContent).not.toContain('⚠');
    expect(caveat).not.toHaveAttribute('role', 'alert');
  });

  // ---------------------------------------------------------------------------------------------
  // Ticker fidelity repair, change 3 (F3) — the masthead's `Universe member · N tracked names` note
  // (`design/src/screens/desk.mjs:285`), the reciprocal of the caption above: the SAME universe
  // read this file already exercises now ALSO drives the quick row's trailing note. `universe_size`
  // (2, `UNIVERSE`'s own field) is the wire's own count, not `symbols.length` re-derived FE-side.
  // ---------------------------------------------------------------------------------------------
  it('F3: a universe MEMBER carries "Universe member · N tracked names" on the quick row, the wire’s own count', async () => {
    renderAt('/ticker/SPY');
    await screen.findByText('Call wall');
    await universeRead();
    await waitFor(() =>
      expect(screen.getByTestId('quick-symbols-note')).toHaveTextContent(
        'Universe member · 2 tracked names',
      ),
    );
    // Isolation: a universe member never carries the nonmember caption.
    expect(screen.queryByTestId('single-name-caveat')).toBeNull();
  });

  it('F3: a confirmed NONMEMBER carries NO "Universe member" note (the caption above is what renders instead)', async () => {
    renderAt('/ticker/GME');
    await screen.findByText('Call wall');
    await universeRead();
    await waitFor(() => expect(screen.getByTestId('single-name-caveat')).toBeInTheDocument());
    expect(screen.queryByTestId('quick-symbols-note')).toBeNull();
  });

  it('AC-5: a FAILED universe read renders NO caption, NO fabricated "Universe member" count and NO error surface (silent best-effort)', async () => {
    universeMode = { kind: 'http-500' };
    renderAt('/ticker/GME');
    await screen.findByText('Call wall');
    await universeRead();
    // The page is fully healthy; the caption simply never appears — absence IS the degraded state.
    await waitFor(() => expect(screen.queryByTestId('single-name-caveat')).toBeNull());
    // F3: the quick row's "Universe member · N tracked names" note fabricates no count either.
    expect(screen.queryByTestId('quick-symbols-note')).toBeNull();
    expect(screen.queryByText(/universe/i)).toBeNull(); // no leaked error copy about the read
  });

  it('AC-5 edge: an EMPTY/garbled universe payload is "unknown", not "everything is thin"', async () => {
    universeMode = { kind: 'garbled' };
    renderAt('/ticker/GME');
    await screen.findByText('Call wall');
    await universeRead();
    await waitFor(() => expect(screen.queryByTestId('single-name-caveat')).toBeNull());
  });

  it('no loading state: absent while the read is pending, appears once it resolves nonmember', async () => {
    universeMode = { kind: 'deferred' };
    renderAt('/ticker/GME');
    await screen.findByText('Call wall');
    expect(screen.queryByTestId('single-name-caveat')).toBeNull(); // pending ⇒ unknown ⇒ nothing
    await waitFor(() => expect(resolveUniverse).not.toBeNull());
    resolveUniverse?.();
    expect(await screen.findByTestId('single-name-caveat')).toHaveTextContent(SINGLE_NAME_CAVEAT);
  });
});
