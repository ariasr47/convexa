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
      screen.getByText('The address may be old or mistyped. The desk is one symbol away.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('site-footer')).toBeInTheDocument();
  });

  it('AC-N5 — a retired address renders the 404, never a redirect', async () => {
    renderAt('/dashboard');
    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
  });
});
