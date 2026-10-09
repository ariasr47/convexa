import App from '@/app';
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const json = (b: unknown) =>
  new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'EventSource',
    class {
      close() {
        /* no-op */
      }
    } as unknown as typeof EventSource,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (i: RequestInfo | URL) => {
      if (String(i).includes('/api/auth/session'))
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      return json(null);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// GATE Z m-10 — AC-F1 names ten pages ("landing, ticker, scanner, positions, alerts, settings,
// blog, methodology, lab and the 404"). The footer is mounted once by the shell, not per page, so
// four representative routes prove it: the landing page, a ticker desk, a sign-in-walled page
// (`/scanner` renders the wall signed-out — the stub below is anonymous) and the 404.
const ROUTES = ['/', '/ticker/SPY', '/scanner', '/nope'] as const;

describe('AC-F1/F2/F3/F4 — one footer, one main, on every in-shell page', () => {
  for (const path of ROUTES) {
    it(`${path} renders exactly one footer and exactly one main`, async () => {
      const { container } = render(
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </ThemeProvider>,
      );
      const footer = await screen.findByTestId('site-footer');
      expect(container.querySelectorAll('footer')).toHaveLength(1);
      expect(container.querySelectorAll('main')).toHaveLength(1);
      // The footer is chrome: OUTSIDE the main landmark, below the instrument.
      expect(container.querySelector('main')!.contains(footer)).toBe(false);
      expect(screen.getByTestId('footer-methodology-link')).toHaveAttribute('href', '/methodology');
      expect(screen.getByTestId('footer-blog-link')).toHaveAttribute('href', '/blog');
      expect(screen.getByTestId('footer-lab-link')).toHaveAttribute('href', '/lab');
      expect(screen.getByTestId('footer-disclaimer')).toHaveTextContent(/read-only/);
      expect(screen.getByTestId('footer-disclaimer')).toHaveTextContent(/Not investment advice/);
    });
  }
});
