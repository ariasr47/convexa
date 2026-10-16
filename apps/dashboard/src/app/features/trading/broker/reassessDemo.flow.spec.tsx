/**
 * The demo's Broker tab end to end through the demo transport: the reassessment request for the
 * authored AAPL holding carries a modeled P/L, priced off the sample book the row shows. Before
 * review W1-60 the marks were taken from the (null) live book, so the request said
 * `modeled_pl_dollar: null` beside a row reading +$625. A money figure, so it is pinned.
 */
import { vi } from 'vitest';

vi.hoisted(() => {
  (
    window as Window & { __CONVEXA_BOOT__?: { mode: 'demo'; key: (key: string) => string } }
  ).__CONVEXA_BOOT__ = {
    mode: 'demo',
    key: (key: string) => `convexa.demo.v1.${key}`,
  };
});

import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { getTicker, initializeDemoWorkspace } from '@convexa/api';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrokerTabPanel } from './BrokerTabPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  localStorage.clear();
  initializeDemoWorkspace();
  // The demo makes no network request: its only fetch is the bundled seed asset, which Vite serves
  // at `/@fs/<path>`. Serve it from disk; anything else is a bug in the demo build.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const at = url.indexOf('/@fs/');
      if (at < 0) throw new Error(`Unexpected fetch in the demo: ${url}`);
      const file = decodeURIComponent(url.slice(at + 4).split('?')[0]);
      return new Response(readFileSync(file, 'utf8'), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

describe('demo Broker tab · reassessment request', () => {
  it('exports the modeled P/L of the sample holding at the sample spot, never null', async () => {
    const aapl = await getTicker('AAPL');
    const spot = aapl.market_state.price;
    // The authored holding: 25 AAPL shares at a 240.00 cost (demo transport /api/broker/book).
    const expected = Math.round(25 * (spot - 240) * 100) / 100;

    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <AuthProvider>
            <AuthDialogProvider>
              <BrokerTabPanel data={null} live={null} isLive={false} streamOffline={false} />
            </AuthDialogProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );

    await userEvent.click(await screen.findByTestId('broker-reassess'));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      const req = JSON.parse(within(dialog).getByTestId('broker-reassess-json').textContent ?? '');
      expect(req.modeled_pl_dollar).toBe(expected);
    });
    const req = JSON.parse(within(dialog).getByTestId('broker-reassess-json').textContent ?? '');
    expect(req.source).toBe('demo_sample');
    expect(req.modeled_pl_basis).toBe('Convexa-modeled');
  });
});
