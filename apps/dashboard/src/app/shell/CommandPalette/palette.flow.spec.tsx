/**
 * `palette.flow` — the ⌘K keyboard END-TO-END walk (SPEC §2.6/§4.4), mocking ONLY the network
 * boundary (`fetch` + `EventSource`), never a live backend. Mirrors `app.risk.spec.tsx`'s proven
 * harness (mount the whole `App`, strict fetch mock) rather than re-deriving one.
 *
 * AC-24 (⌘K opens from anywhere, all four surfaces reachable without a mouse). AC-25 (Escape
 * closes + returns focus) is covered by `modalFocusHandoff.spec.tsx`; AC-28 (signed-out gated
 * surface → the visible sign-in wall) by `app.risk.spec.tsx`'s signed-out lockdown cases.
 *
 * AC-33 (unsaved field text survives open/dismiss) WAS pinned here against the ticker desk's bare
 * `#ticker-input` — removed by the ticker fidelity repair (F3: "the design has no bare ticker input
 * on the desk", `TickerToolbar.tsx`'s own module doc) since the palette's own "open anyway" item
 * (`CommandPalette.tsx`) now does that job. The mechanism this AC actually guards
 * (`shared/a11y/modalFocusHandoff.ts` never clobbering an unrelated focused/typed field elsewhere on
 * the page) keeps its OWN direct coverage in `modalFocusHandoff.spec.tsx` ("Dialog with an
 * autoFocus field: no violation on the CLOSE path either") — this file drops only the one
 * ticker-page vehicle that no longer exists, not the guarantee.
 */
import type { TickerBundle } from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetLocalPrefs } from '@/features/auth/localPrefs';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { installModalFocusHandoff } from '@/shared/a11y/modalFocusHandoff';
import { theme } from '@/shared/theme/theme';
import App from '../../app';

/**
 * `main.tsx` installs this ONCE before the real app renders — tests import components directly
 * and never execute `main.tsx`, so without this the palette's Escape/backdrop-close would restore
 * focus to nothing (MUI's OWN restore is disabled at the theme layer;
 * `shared/a11y/modalFocusHandoff.ts` is what replaces it). Mirrors
 * `modalFocusHandoff.spec.tsx`'s own install/uninstall-per-test pattern.
 */
let uninstallFocusHandoff: () => void;

function bundleFor(ticker: string): TickerBundle {
  const b = makeBundle();
  return {
    ...b,
    market_state: { ...b.market_state, ticker },
    signals: { ...b.signals, ticker },
    strike_profile: { ...b.strike_profile, ticker },
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let sessionBody: unknown;

function signedIn() {
  sessionBody = {
    authenticated: true,
    user: { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
    google_available: false,
    settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
  };
}

beforeEach(() => {
  uninstallFocusHandoff = installModalFocusHandoff();
  sessionBody = { authenticated: false, user: null, google_available: false, settings: null };
  localStorage.clear();
  __resetLocalPrefs();
  __resetMemory();

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
    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
    const tk = (url.match(/\/api\/ticker\/([A-Z]+)/) ?? [])[1] ?? 'SPY';
    if (url.includes('/api/ticker/')) return json(bundleFor(tk));
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
    if (url.includes('/api/scan/universe')) return json({ symbols: ['SPY'], universe_size: 1 });
    if (url.includes('/history'))
      return json({ symbol: 'SPY', samples: [], basis: 'test structure history' });
    if (url.includes('/api/scan')) {
      return json({
        view: {
          source: 'default',
          authenticated: false,
          name: null,
          symbols: ['SPY'],
          sort: { key: 'score', dir: 'desc' },
          density: 'compact',
        },
        rows: [
          {
            symbol: 'SPY',
            price: 500,
            chg_pct: 1,
            score: 82,
            tier: 'prime',
            regime: 'positive_gamma',
            vol_regime: 'iv_rich',
            flip: 495,
            dist_to_flip_pct: 1,
            call_wall: 510,
            put_wall: 490,
            dist_to_wall_pct: 2,
            as_of: Date.now() / 1000,
            status: 'ok',
          },
        ],
        sweep: {
          updated_at: Date.now() / 1000,
          sweep_last_completed: Date.now() / 1000,
          universe_size: 1,
        },
      });
    }
    if (url.includes('/api/auth/session')) return json(sessionBody);
    if (url.includes('/api/auth/ai-key'))
      return json({ error: 'auth_required', message: 'sign in' }, 403);
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  uninstallFocusHandoff();
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

async function openWithKeyboard(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('{Meta>}k{/Meta}');
  await screen.findByTestId('command-palette');
}

/**
 * The palette is a roving `aria-activedescendant` combobox (SPEC §2.6): DOM focus stays on the
 * INPUT throughout, never moves to an `<li role="option">` (those are not natively focusable — the
 * PALETTE_COMMANDS order is Scanner(0)·Ticker(1)·Positions(2)·Alerts(3), so reaching one is N
 * ArrowDown presses from the default index 0, then Enter — never `.focus()` on the row itself).
 */
async function selectCommandByArrows(
  user: ReturnType<typeof userEvent.setup>,
  downPresses: number,
) {
  for (let i = 0; i < downPresses; i++) await user.keyboard('{ArrowDown}');
  await user.keyboard('{Enter}');
}

describe('AC-24 — ⌘K opens the palette from anywhere in the shell; all four surfaces reachable without a mouse', () => {
  it('opens on ⌘K from the ticker page and reaches Scanner, Ticker, Positions, Alerts via the keyboard only', async () => {
    // Signed in — Scanner and Positions are both behind `RequireAuth`, and the signed-out wall has
    // its own coverage in `app.risk.spec.tsx`; this test's job is proving PALETTE navigation
    // reaches every surface, so it renders each surface's real content.
    signedIn();
    const user = userEvent.setup();
    renderAt('/ticker/SPY');
    // The desk's lazy chunk is the first thing this file compiles; under a parallel run it can take
    // longer than findBy's default 1s.
    await screen.findByTestId('command-deck', undefined, { timeout: 5000 });

    // Scanner — index 0, no arrow presses.
    await openWithKeyboard(user);
    await screen.findByTestId('palette-command-surface-scanner');
    await selectCommandByArrows(user, 0);
    await waitFor(() => expect(screen.queryByTestId('command-palette')).toBeNull());
    await screen.findByTestId('scanner-page');

    // Ticker — index 1, one ArrowDown.
    await openWithKeyboard(user);
    await screen.findByTestId('palette-command-surface-ticker');
    await selectCommandByArrows(user, 1);
    await waitFor(() => expect(screen.queryByTestId('command-palette')).toBeNull());
    await screen.findByTestId('command-deck');

    // Positions — index 2, two ArrowDowns.
    await openWithKeyboard(user);
    await screen.findByTestId('palette-command-surface-positions');
    await selectCommandByArrows(user, 2);
    await waitFor(() => expect(screen.queryByTestId('command-palette')).toBeNull());
    await screen.findByTestId('portfolio-panel');

    // Alerts — index 3, three ArrowDowns.
    await openWithKeyboard(user);
    await screen.findByTestId('palette-command-surface-alerts');
    await selectCommandByArrows(user, 3);
    await waitFor(() => expect(screen.queryByTestId('command-palette')).toBeNull());
    await screen.findByTestId('alerts-page');
  });
});
