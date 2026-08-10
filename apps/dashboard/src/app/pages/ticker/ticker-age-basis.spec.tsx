/**
 * Product spine #4 — always label age and basis.
 *
 * Guards that structure-bound surfaces name STRUCTURE age (not a bare "Updated") and that
 * live tape names the stream basis separately (`[live-vs-static-isolation]`). Model-read
 * widgets that already self-describe (IV rank, market context, DFP) are not re-asserted here.
 *
 * Mounts the real app via the route table; mocks only the network boundary.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';

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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.includes('/api/auth/session'))
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      if (url.includes('/api/ticker/')) return json(makeBundle());
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
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Ticker · age + basis labels (product spine #4)', () => {
  it('deck freshness names Structure as-of (never bare Updated as live age)', async () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/ticker/TSLA']}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await screen.findByText('Call wall');

    const line = screen.getByTestId('freshness-line');
    expect(line.textContent).toMatch(/Structure as-of/i);
    expect(line.textContent).not.toMatch(/^Updated /);
  });

  it('structure widgets carry age/basis in their chrome; live tape names the stream', async () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/ticker/TSLA']}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await screen.findByText('Call wall');

    const dealer = screen.getByTestId('widget-dealer-positioning');
    expect(dealer.textContent).toMatch(/Structure as-of|structure snapshot/i);
    expect(dealer.textContent).toMatch(/Snapshot, never live/i);

    const live = screen.getByTestId('widget-live-tape');
    // Live path names stream vs structure — either live or offline subtitle.
    expect(live.textContent).toMatch(/Live stream|Stream offline/i);
    expect(live.textContent).toMatch(/structure/i);

    const gex = screen.queryByTestId('widget-gex-strike-profile');
    if (gex) {
      expect(gex.textContent).toMatch(/GEX spot/i);
      expect(gex.textContent).toMatch(/Structure as-of|structure snapshot|not live/i);
    }

    const setups = screen.getByTestId('widget-setups');
    expect(setups.textContent).toMatch(/Structure as-of|structure snapshot|Rule-based/i);

    // Isolation: structure widgets must not claim to be a live stream.
    expect(within(dealer).queryByText(/live stream/i)).toBeNull();
  });
});
