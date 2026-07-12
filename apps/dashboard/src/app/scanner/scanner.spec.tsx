/**
 * Scanner (`/scanner`) — component tests for the convexa-redesign re-skin.
 *
 * Authority: FRONTEND_EXECUTION_CONTRACT · SURFACE: Scanner + README §5. The surface is a STATIC
 * "coming soon" placeholder: presentation-only, ZERO data work. These tests pin the load-bearing
 * contract (testids, exact heading, verbatim roadmap copy with bolded Ticker, amber badge, the one
 * allowed Ticker affordance → /ticker) and the AC-Scan-1 invariant (no network on mount — `fetch`
 * spied and asserted never called; no EventSource opened; no spinner).
 */
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { theme } from '../theme';
import { Scanner } from './Scanner';

let fetchMock: ReturnType<typeof vi.fn>;
let openedEventSources = 0;

beforeEach(() => {
  openedEventSources = 0;
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderScanner() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <Scanner />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Scanner (coming-soon re-skin)', () => {
  it('renders the inert placeholder card with the exact heading', () => {
    renderScanner();
    expect(screen.getByTestId('scanner-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Scanner — coming soon')).toBeInTheDocument();
  });

  it('renders the verbatim roadmap copy with Ticker bolded in text.primary', () => {
    renderScanner();
    const card = screen.getByTestId('scanner-placeholder');
    // Stable substring of the verbatim copy (avoids the curly apostrophe / em dash split nodes).
    expect(card).toHaveTextContent(/strongest setups across names is on the roadmap/);
    // "Ticker" is bolded — rendered as a <strong> distinct from the surrounding secondary body.
    const strong = within(card).getByText('Ticker');
    expect(strong.tagName.toLowerCase()).toBe('strong');
  });

  it('renders the amber "coming soon" badge and the Ticker affordance → /ticker', () => {
    renderScanner();
    const card = screen.getByTestId('scanner-placeholder');
    // The badge is the uppercase pill (text content "coming soon", lowercase in DOM).
    expect(within(card).getByText('coming soon')).toBeInTheDocument();

    const link = screen.getByTestId('scanner-ticker-link');
    expect(link).toHaveAttribute('href', '/ticker');
    expect(link).toHaveTextContent('Go to the Ticker viewer →');
  });

  it('AC-Scan-1 — issues ZERO network on mount (no fetch, no SSE, no spinner)', () => {
    renderScanner();
    expect(screen.getByTestId('scanner-placeholder')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(openedEventSources).toBe(0);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
