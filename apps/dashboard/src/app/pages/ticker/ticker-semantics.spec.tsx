/**
 * Ticker page — HEADING-SEMANTICS guard (redesign-stage-0 FRONTEND_EXECUTION_CONTRACT §8.3;
 * convexa-design skill rule 6 "stat values are NOT headings" — the 29-<h6> ticker page is the
 * documented failure).
 *
 * Guards, against silent regression by ANY new tile/widget:
 *   1. Exactly ONE `<h1>` — the `TICKER · $price` anchor.
 *   2. NO heading element (h1–h6) whose text content is a DATA VALUE (leading signed/currency figure,
 *      or a pure %/$ figure) — data renders as styled spans/paragraphs, never headings.
 *   3. Widget titles are `<h2>` and the outline has no skipped levels: every heading on the page is
 *      h1 or h2 (h1 → h2, nothing deeper renders as a heading element today).
 *
 * Mounts the REAL app subtree via the route table, mocking ONLY the network boundary.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
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
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A DATA VALUE for the guard's purpose (contract §8.3): leading signed/currency figure, or a pure
 *  figure with %/$/unit suffixes. Headings that NAME things ("Live tape") don't match. */
const DATA_VALUE = /^[+−$-]?[\d,.]+/;
/** redesign-stage-3 §8-10 extension: the `TICKER · $price` form IS a data value too (the
 *  CommandDeck condensed bar mounted it as an <h6> until §5.6). The page's SINGLE h1 anchor is
 *  the one permitted carrier of this form — every other heading level matching it is a
 *  regression, not just the one fixed site. */
const TICKER_PRICE = /^[A-Z]{1,6}\s*·\s*\$/;

function allHeadings(): HTMLElement[] {
  return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
}

describe('Ticker · heading semantics (h1 → h2, data values are never headings)', () => {
  it('exactly one h1 (the ticker anchor); widget titles are h2; no deeper heading levels', async () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/ticker/TSLA']}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await screen.findByText('Call wall');

    const h1s = document.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toMatch(/TSLA · \$/);

    // Widget titles render as h2 (styling variant unchanged) — spot the board's widgets.
    expect(screen.getByRole('heading', { level: 2, name: /live tape/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /dealer positioning/i }),
    ).toBeInTheDocument();

    // No skipped levels: every heading element on /ticker is h1 or h2.
    const levels = new Set(allHeadings().map((h) => h.tagName.toLowerCase()));
    expect([...levels].sort()).toEqual(['h1', 'h2']);
  });

  it('NO heading element carries a data value as its text (the 29-<h6> regression can’t return)', async () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/ticker/TSLA']}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await screen.findByText('Call wall');

    const offenders = allHeadings()
      .map((h) => ({ tag: h.tagName.toLowerCase(), text: (h.textContent ?? '').trim() }))
      .filter(
        ({ tag, text }) =>
          DATA_VALUE.test(text) ||
          /^[\d,.]+\s*[%$]/.test(text) ||
          // §8-10: `TICKER · $…` counts as a data value on every heading EXCEPT the one h1 anchor.
          (tag !== 'h1' && TICKER_PRICE.test(text)),
      )
      .map(({ tag, text }) => `<${tag}> ${text}`);
    expect(
      offenders,
      `data values must render as styled spans/paragraphs, never headings:\n${offenders.join('\n')}`,
    ).toEqual([]);

    // And the fix actually landed where the failure lived: stat figures exist on the page as
    // NON-heading elements (e.g. the Call wall tile's $ figure).
    const callWallTile = screen.getByText('Call wall').closest('.MuiCard-root');
    expect(callWallTile?.querySelector('p')?.textContent).toMatch(/\$/);
    expect(callWallTile?.querySelector('h6')).toBeNull();
  });
});
