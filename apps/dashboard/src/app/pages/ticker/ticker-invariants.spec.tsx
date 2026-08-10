/**
 * Ticker page — page-level invariant KEEPERS (risk-based suite, `.claude/agents/qa-verify.md` §4,
 * 2026-07-13). The stream-isolation walk, null matrix, skeleton-first load, wire-label authority and
 * last-trade contract live in `ticker.risk.spec.tsx`; this file holds the two invariants that don't
 * belong to that flow:
 *   1. Cold-start failure is the ONLY blank screen (error + Retry), page-isolated (the shell nav
 *      survives), and Retry actually recovers.
 *   2. Scoring untouched — the Opportunity readout reflects exactly the bundle's signals (the FE
 *      feeds nothing into score/tier).
 *
 * Mounts the REAL app subtree via the route table, mocking ONLY the network boundary (`fetch` + a
 * silent `EventSource`). The strict fetch mock THROWS on any unexpected call.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';

let tickerOk = true;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  tickerOk = true;

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
    const json = (b: unknown) =>
      new Response(JSON.stringify(b), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/api/auth/session'))
      return json({ authenticated: false, user: null, google_available: false, settings: null });
    if (url.includes('/api/ticker/')) {
      if (!tickerOk) return new Response('error', { status: 500 });
      return json(makeBundle());
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
    if (url.includes('/history'))
      return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
    throw new Error(`Unexpected fetch from Ticker page: ${url}`);
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

describe('Ticker · page-level invariants', () => {
  it('cold-start failure = the only blank screen; page-isolated; Retry recovers', async () => {
    tickerOk = false;
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');

    // The error Alert + Retry render; the shell nav is NOT blanked (page isolation).
    expect(await screen.findByText('Retry')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('nav-ticker')).toBeInTheDocument();
    expect(screen.queryByText('Call wall')).toBeNull();

    // Recover: Retry re-fetches and the board renders.
    tickerOk = true;
    await user.click(screen.getByText('Retry'));
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
  });

  it('scoring untouched — the Opportunity readout reflects exactly the bundle signals', async () => {
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    // Shared fixture: opportunity_score 42 — rendered verbatim, nothing FE-side feeds it.
    expect(within(screen.getByTestId('dealer-positioning')).getByText(/42 ·/)).toBeInTheDocument();
  });
});
