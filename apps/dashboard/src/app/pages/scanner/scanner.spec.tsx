/**
 * Scanner (`/scanner`) — RISK-BASED test suite (per the amended QA rule,
 * `.claude/agents/qa-verify.md` §4, 2026-07-16 migration). The surface is a STATIC coming-soon
 * placeholder; the only invariants where a silent regression is plausible AND invisible:
 *
 *   1. ZERO network on mount (no fetch, no SSE, no loading affordance) — the page must never imply
 *      it is scanning.
 *   2. The ONE allowed affordance: exactly one link on the page, and it points at `/ticker` —
 *      enforced by construction (any second link, e.g. a broker/scan path, fails the count).
 *
 * NOT asserted here (visible + intentional → review/QA): the heading, the verbatim roadmap copy /
 * bolded "Ticker", the amber badge styling.
 */
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { theme } from '@/shared/theme/theme';
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

describe('Scanner (static coming-soon)', () => {
  it('issues ZERO network on mount (no fetch, no SSE, no loading affordance)', () => {
    renderScanner();
    expect(screen.getByTestId('scanner-placeholder')).toBeInTheDocument(); // it did mount
    expect(fetchMock).not.toHaveBeenCalled();
    expect(openedEventSources).toBe(0);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('carries EXACTLY one affordance, and it points at /ticker', () => {
    const { container } = renderScanner();
    const anchors = container.querySelectorAll('a');
    expect(anchors).toHaveLength(1); // by construction: no second path off this page
    expect(anchors[0]).toHaveAttribute('href', '/ticker');
    expect(anchors[0]).toBe(screen.getByTestId('scanner-ticker-link'));
    // And no button pretending to scan.
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
