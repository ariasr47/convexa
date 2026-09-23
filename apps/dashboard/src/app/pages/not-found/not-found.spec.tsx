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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (i: RequestInfo | URL) => {
      if (String(i).includes('/api/auth/session'))
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      throw new Error(`Unexpected fetch from the 404: ${String(i)}`);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

describe('AC-N1/AC-N2/AC-N3/AC-N5 — the 404 composition inside the shell', () => {
  it('an unmatched address renders the 404 with the nav and the footer still present', async () => {
    renderAt('/this-address-does-not-exist');
    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Nothing at this address.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The desk is one symbol away. Ticker analysis is free; the rest is behind a sign-in.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('site-footer')).toBeInTheDocument();
  });

  it('the headline is the page h1 (outline starts at level 1 — AC-G1 has zero waivers)', async () => {
    const { container } = renderAt('/nope');
    await screen.findByTestId('not-found-page');
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('Nothing at this address.');
  });

  it('both actions resolve: primary → /ticker, secondary → /', async () => {
    renderAt('/nope');
    await screen.findByTestId('not-found-page');
    expect(screen.getByTestId('not-found-primary')).toHaveAttribute('href', '/ticker');
    expect(screen.getByTestId('not-found-primary')).toHaveTextContent('Open the Ticker →');
    expect(screen.getByTestId('not-found-secondary')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('not-found-secondary')).toHaveTextContent('Home');
  });

  it('AC-N5 — a retired address renders the 404, never a redirect', async () => {
    renderAt('/dashboard');
    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
  });
});
