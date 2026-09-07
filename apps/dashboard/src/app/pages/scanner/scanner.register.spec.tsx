/**
 * `/scanner` — the register/state conversion (curvature-v2-surfaces FE-3/FE-4). NOT one test per
 * criterion — this covers what regresses SILENTLY once the atoms route through `shared/figure`:
 *
 *   FE-3 — 9 (table/card render one datum identically, register + state), 10/11A (no live mark
 *   anywhere on scanner, enforced at the compiler), 17/U-6 (the closed-nine literal never renders
 *   inside the mono run, and a lookup MISS is `unavailable` while a genuine absence is `—`),
 *   18/19/20 (the four honest page states — the skeleton and the signed-in empty-view are already
 *   pinned in `scanner.risk.spec.tsx`; this file adds the two NOT yet covered there: the
 *   filter-matches-nothing message and the signed-out sign-in wall), 22 (the card carries every
 *   datum the table carries, same register, same words, still one anchor).
 *
 *   FE-4 extends this file (Owns list, PLAN) rather than starting a second one.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { figureStateOf } from '@/shared/figure';
import { theme } from '@/shared/theme/theme';
import type { ScanRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScanCardList } from './ScanCard';
import { ScanTable } from './ScanTable';
import { Scanner } from './Scanner';
import { makeRow } from './scanner.risk.spec';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NOW = 1_800_000;

function renderBoth(row: ScanRow) {
  const table = render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ScanTable
          rows={[row]}
          sort={{ key: 'score', dir: 'desc' }}
          density="compact"
          nowS={NOW}
          flashActive
          onSort={() => undefined}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
  const tableRow = screen.getByTestId('scan-row');
  const card = render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ScanCardList rows={[row]} nowS={NOW} flashActive />
      </MemoryRouter>
    </ThemeProvider>,
  );
  const cardEl = screen.getByTestId('scan-card');
  return { tableRow, cardEl, unmount: () => (table.unmount(), card.unmount()) };
}

/** Read text + the two DOM markers at a testid, from whichever layout. `data-figure-state` is not
 *  guaranteed co-located with `data-figure-register` (§2.1) — this reads both independently. */
function readCell(root: HTMLElement, testid: string) {
  const el = within(root).getByTestId(testid);
  return {
    text: el.textContent,
    register: el.getAttribute('data-figure-register'),
    state: el.getAttribute('data-figure-state'),
  };
}

describe('criterion 9 (SB) — the table and the card render one datum identically', () => {
  it('a fully-populated row: every figure carries the same text + register + state in both layouts', () => {
    const row = makeRow({ symbol: 'SPY' });
    const { tableRow, cardEl, unmount } = renderBoth(row);
    for (const id of [
      'cell-price',
      'cell-chg',
      'cell-score',
      'cell-regime',
      'cell-vol',
      'cell-dist-flip',
      'cell-dist-flip-level',
      'cell-dist-wall',
      'cell-dist-wall-level',
      'cell-updated',
    ]) {
      expect(readCell(tableRow, id), `${id} table vs card`).toEqual(readCell(cardEl, id));
    }
    unmount();
  });

  it('an absent/miss row: the closed-nine members and their states agree across both layouts too', () => {
    const row = makeRow({
      symbol: 'NUL',
      price: null,
      chg_pct: null,
      score: null,
      tier: 'legendary', // a lookup MISS, not a genuine absence
      regime: null,
      vol_regime: null,
      flip: null,
      dist_to_flip_pct: null,
      call_wall: null,
      put_wall: null,
      dist_to_wall_pct: null,
    });
    const { tableRow, cardEl, unmount } = renderBoth(row);
    for (const id of [
      'cell-price',
      'cell-chg',
      'cell-score',
      'cell-tier',
      'cell-regime',
      'cell-vol',
      'cell-dist-flip',
      'cell-dist-wall',
    ]) {
      expect(readCell(tableRow, id), `${id} table vs card`).toEqual(readCell(cardEl, id));
    }
    // MISS renders `unavailable`, never the raw `legendary` enum, never `—` (U-6).
    expect(within(tableRow).getByTestId('cell-tier')).toHaveTextContent('unavailable');
    unmount();
  });
});

describe('criteria 10 + 11A (SB) — no scanner figure carries a live mark, in any state', () => {
  it('the table and the card never render the live-dot mark', () => {
    const { tableRow, cardEl, unmount } = renderBoth(makeRow());
    expect(within(tableRow).queryAllByTestId('figure-live-dot')).toHaveLength(0);
    expect(within(cardEl).queryAllByTestId('figure-live-dot')).toHaveLength(0);
    unmount();
  });

  it('COMPILE-TIME: a raw boolean can never satisfy the branded `live` claim figureStateOf takes', () => {
    // @ts-expect-error — `LiveClaim` is a nominal brand (shared/liveness/liveClaim.ts); a plain
    // `true` is not assignable, so no scanner atom can smuggle a live mark onto a structure or
    // price figure by accident. If this ever stopped erroring, `npm run typecheck` would flag the
    // line above as an unused `@ts-expect-error` (TS2578) — the proof is non-vacuous by construction.
    figureStateOf({ value: '1', register: 'traced', live: true });
  });
});

describe('criterion 17 + U-6 — the closed-nine literal never renders inside the mono run', () => {
  it('a null price/chg/score/distance renders Sans, state "empty" — never the mono em-dash', () => {
    const row = makeRow({
      symbol: 'NUL',
      price: null,
      chg_pct: null,
      score: null,
      flip: null,
      dist_to_flip_pct: null,
      call_wall: null,
      put_wall: null,
      dist_to_wall_pct: null,
    });
    const { tableRow, unmount } = renderBoth(row);
    for (const id of ['cell-price', 'cell-chg', 'cell-score', 'cell-dist-flip', 'cell-dist-wall']) {
      const cell = readCell(tableRow, id);
      expect(cell.text).toBe('—');
      expect(cell.register, `${id} must be sans, never mono, on the literal em-dash`).toBe('sans');
      expect(cell.state).toBe('empty');
    }
    unmount();
  });

  it('a lookup MISS on tier/regime/vol renders `unavailable` (state "unavailable"); a genuine absence renders `—` (state "empty")', () => {
    const missRow = makeRow({ tier: 'legendary', regime: 'sideways', vol_regime: 'chaotic' });
    const { tableRow: missTable, unmount: u1 } = renderBoth(missRow);
    for (const id of ['cell-tier', 'cell-regime', 'cell-vol']) {
      const cell = readCell(missTable, id);
      expect(cell.text, id).toBe('unavailable');
      expect(cell.state, id).toBe('unavailable');
      expect(cell.register, id).toBe('sans');
    }
    u1();

    const absentRow = makeRow({ tier: null, regime: null, vol_regime: null });
    const { tableRow: absentTable, unmount: u2 } = renderBoth(absentRow);
    for (const id of ['cell-tier', 'cell-regime', 'cell-vol']) {
      const cell = readCell(absentTable, id);
      expect(cell.text, id).toBe('—');
      expect(cell.state, id).toBe('empty');
    }
    u2();
  });
});

describe('criterion 22 (SB) — the card is one anchor and carries every datum the table carries', () => {
  it('the card stays a single anchor with no focusable control nested inside it', () => {
    const row = makeRow({ symbol: 'SPY' });
    const { cardEl, unmount } = renderBoth(row);
    expect(cardEl.tagName.toLowerCase()).toBe('a');
    expect(cardEl.getAttribute('href')).toBe('/ticker/SPY');
    expect(cardEl.querySelectorAll('button')).toHaveLength(0);
    unmount();
  });
});

// =================================================================================================
// 18/19/20 — the two page states NOT already pinned by `scanner.risk.spec.tsx` (the cold skeleton
// and the signed-in empty-saved-view are covered there).
// =================================================================================================

function installFilterBackend() {
  const nowS = Date.now() / 1000;
  const rows: ScanRow[] = [
    makeRow({ symbol: 'AAA', tier: 'prime', score: 90 }),
    makeRow({ symbol: 'BBB', tier: 'watch', score: 10 }),
  ];
  const body = {
    view: {
      source: 'default',
      authenticated: false,
      name: null,
      symbols: rows.map((r) => r.symbol),
      sort: { key: 'score', dir: 'desc' },
      density: 'compact',
    },
    rows,
    sweep: { updated_at: nowS, sweep_last_completed: nowS, universe_size: rows.length },
  };
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
        return json({
          authenticated: false,
          user: null,
          google_available: false,
          settings: null,
        });
      if (url.includes('/api/scan/universe'))
        return json({ symbols: rows.map((r) => r.symbol), universe_size: rows.length });
      if (url.includes('/api/scan')) return json(body);
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
}

function renderScannerRoute(authenticated: boolean) {
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
        return json({
          authenticated,
          user: authenticated
            ? { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] }
            : null,
          google_available: false,
          settings: authenticated
            ? { active_persona_id: null, default_ticker: null, theme: 'dark' }
            : null,
        });
      if (url.includes('/api/scan/universe')) return json({ symbols: [], universe_size: 0 });
      if (url.includes('/api/scan'))
        return json({
          view: {
            source: 'default',
            authenticated,
            name: null,
            symbols: [],
            sort: { key: 'score', dir: 'desc' },
            density: 'compact',
          },
          rows: [],
          sweep: null,
        });
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/scanner']}>
        <AuthProvider>
          <AuthDialogProvider>
            <Routes>
              <Route
                path="/scanner"
                element={
                  <RequireAuth surface="the scanner">
                    <Scanner />
                  </RequireAuth>
                }
              />
            </Routes>
          </AuthDialogProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('criterion 19 — filter-matches-nothing is its own message, distinct from the empty saved view', () => {
  it('a filter that matches no row renders scan-empty-filter with its own recovery control, never an error', async () => {
    const user = userEvent.setup();
    installFilterBackend();
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <AuthProvider>
            <AuthDialogProvider>
              <Scanner />
            </AuthDialogProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );
    await screen.findByTestId('scan-table');
    // Neither seeded row is `dormant` — a single-click filter that matches zero rows.
    await user.click(screen.getByTestId('scan-filter-tier-dormant'));
    const empty = await screen.findByTestId('scan-empty-filter');
    expect(empty).toHaveTextContent('No names match these filters.');
    expect(screen.getByTestId('scan-empty-filter-clear')).toBeInTheDocument();
    expect(screen.queryByTestId('scan-empty-view')).toBeNull(); // NOT the same message
    expect(within(empty).queryByRole('alert')).toBeNull(); // never rendered as an error
  });
});

describe('criterion 20 (SB) — signed out, the scanner renders the sign-in wall naming the surface', () => {
  it('an unauthenticated visitor sees `require-auth-wall`, never an empty or converted table', async () => {
    renderScannerRoute(false);
    const wall = await screen.findByTestId('require-auth-wall');
    expect(wall).toHaveTextContent('Sign in to open the scanner');
    expect(screen.queryByTestId('scan-table')).toBeNull();
    expect(screen.queryByTestId('scan-empty-view')).toBeNull();
    expect(screen.queryByTestId('scanner-page')).toBeNull();
  });

  it('an authenticated visitor is NOT walled — the scanner page renders', async () => {
    renderScannerRoute(true);
    await screen.findByTestId('scanner-page');
    expect(screen.queryByTestId('require-auth-wall')).toBeNull();
  });
});
