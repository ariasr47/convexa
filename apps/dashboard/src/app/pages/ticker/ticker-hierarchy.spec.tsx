/**
 * Product spine #3 — Ticker hierarchy / less equal weight.
 *
 * Guards the board reading order so the page cannot silently regress to a flat equal-weight
 * wall of cards. DOM order is the contract (CSS grid follows source order on the two-column
 * bento). Zone labels are visual only — never headings (heading semantics stay h1 → h2 widgets).
 *
 * Mounts the real app via the route table; mocks only the network boundary.
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

function renderTicker() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/ticker/TSLA']}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Document order of elements (for hierarchy assertions). */
function docIndex(el: Element | null): number {
  if (!el) return -1;
  const all = Array.from(document.body.querySelectorAll('*'));
  return all.indexOf(el);
}

describe('Ticker · board hierarchy (product spine #3)', () => {
  it('exposes the three zone labels as non-headings', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const structure = screen.getByTestId('board-zone-structure');
    const plan = screen.getByTestId('board-zone-plan');
    const context = screen.getByTestId('board-zone-context');

    expect(structure.tagName.toLowerCase()).toBe('p');
    expect(plan.tagName.toLowerCase()).toBe('p');
    expect(context.tagName.toLowerCase()).toBe('p');
    expect(structure).toHaveTextContent(/structure/i);
    expect(plan).toHaveTextContent(/tape\s*&\s*plan/i);
    expect(context).toHaveTextContent(/supporting context/i);

    // Zone labels must never pollute the heading outline.
    for (const el of [structure, plan, context]) {
      expect(el.closest('h1,h2,h3,h4,h5,h6')).toBeNull();
      expect(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']).not.toContain(el.tagName);
    }
  });

  it('DOM order is Structure → position brief → Tape & plan → Supporting context', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const zoneStructure = screen.getByTestId('board-zone-structure');
    const brief = screen.getByTestId('position-brief');
    const zonePlan = screen.getByTestId('board-zone-plan');
    const zoneContext = screen.getByTestId('board-zone-context');
    const dealer = screen.getByTestId('dealer-positioning');
    const live = screen.getByTestId('live-tape');

    // Zones + brief ordered: structure → book → plan → context.
    expect(docIndex(zoneStructure)).toBeLessThan(docIndex(brief));
    expect(docIndex(brief)).toBeLessThan(docIndex(zonePlan));
    expect(docIndex(zonePlan)).toBeLessThan(docIndex(zoneContext));

    // Primary structure (dealer tiles) appears before live tape — not equal-weight top-of-board.
    expect(docIndex(dealer)).toBeLessThan(docIndex(live));
    expect(docIndex(zoneStructure)).toBeLessThan(docIndex(dealer));
    expect(docIndex(dealer)).toBeLessThan(docIndex(brief));
    expect(docIndex(zonePlan)).toBeLessThan(docIndex(live));
    expect(docIndex(live)).toBeLessThan(docIndex(zoneContext));
  });

  it('position brief is always present on a loaded board (empty book still shown)', async () => {
    renderTicker();
    await screen.findByText('Call wall');
    const brief = screen.getByTestId('position-brief');
    expect(brief).toHaveAttribute('data-count', '0');
    expect(screen.getByTestId('position-brief-empty')).toBeInTheDocument();
    expect(brief.textContent).toMatch(/simulated/i);
  });

  it('act → watch stays adjacent: AI-rec widget before orders, both before supporting context', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const ai = await screen.findByTestId('widget-ai-rec');
    const orders = screen.getByTestId('widget-orders');
    const zoneContext = screen.getByTestId('board-zone-context');

    expect(docIndex(ai)).toBeLessThan(docIndex(orders));
    expect(docIndex(orders)).toBeLessThan(docIndex(zoneContext));
  });
});
