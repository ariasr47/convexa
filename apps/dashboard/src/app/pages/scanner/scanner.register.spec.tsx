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
 *   FE-4 — 12 (the F4 retained arm, driven by a real EventSource event, never the clock), 13
 *   (offline-bare is unreachable on scanner prices, by construction), 14 (no price flash while the
 *   stream is down), 16 (worker-down keeps every figure's register, blanks no row).
 *
 *   GATE Z repair (QA_REPORT.md findings 1 + 2) — the old criterion-9 coverage above rendered
 *   `ScanTable` directly with NO `groups` prop (`renderBoth`, below) and `installLiveBackend` used
 *   `view.source: 'account'` specifically to skip the zero-state lead-group partition — so neither
 *   test could ever reach `Scanner.tsx`'s real `groups` computation, which is exactly where the
 *   defect lived (`groups` built from the un-overlaid `scan.rows`, discarding the live-price
 *   overlay whenever `groups` is defined — every non-account view). The new describe block below
 *   mounts the REAL `<Scanner/>` page with a `source: 'default'` view (so `groups` IS defined, via
 *   the closed `isIndexMegacap` lead-group set) and forces `isNarrow` via a mocked `useMediaQuery`
 *   so the SAME page, the SAME fetch stub and the SAME `EventSource` event sequence can be read
 *   back from both the table and the card — reaching the defect the old test structurally could not.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { figureStateOf } from '@/shared/figure';
import { theme } from '@/shared/theme/theme';
import type { ScanRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SCAN_COPY } from './labels';
import { ScanCardList } from './ScanCard';
import { Scanner } from './Scanner';
import { makeRow } from './scanner.risk.spec';
import { ScanTable } from './ScanTable';

// Mocked so a single test can force the SAME `<Scanner/>` tree through both layouts (jsdom has no
// `matchMedia`, so the real hook always resolves narrow=false — the gap `renderBoth` below works
// around by never mounting `<Scanner/>` at all, which is exactly why it cannot see this defect).
vi.mock('@mui/material/useMediaQuery', () => ({ default: vi.fn(() => false) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NOW = 1_800_000;

function renderBoth(
  row: ScanRow,
  priceOffline: (symbol: string) => { retained: boolean } | null = () => null,
) {
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
          priceOffline={priceOffline}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
  const tableRow = screen.getByTestId('scan-row');
  const card = render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ScanCardList rows={[row]} nowS={NOW} flashActive priceOffline={priceOffline} />
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
    // Neither seeded row is `actionable` (AAA is `prime`, BBB is `watch`) — a single-click filter
    // that matches zero rows. (Surfaces fidelity repair, change 4/F8: the `dormant` preset this
    // test used before is pruned from the toolbar's seven-chip design set — `format.ts`'s
    // `ScanFilters.tier` stays a bare `string | null`, so `dormant` is still valid FILTER STATE,
    // it simply has no dedicated button any more. `actionable` is an equally guaranteed zero-match
    // value against this test's own fixture and stays a rendered preset.)
    await user.click(screen.getByTestId('scan-filter-tier-actionable'));
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

// =================================================================================================
// FE-4 — the degraded price arm (12/13), the flash gate (14), and worker-down register (16). All
// four drive the real `<Scanner/>` tree so `Scanner.tsx:119-139`'s `priceOffline` predicate and the
// SAME `live.offline` flag the header reads are exercised exactly as shipped, never re-derived here.
// =================================================================================================

/** Captures every `EventSource` `useLivePrices` opens, so a test can drive the EVENT (never the
 *  clock, PLAN FE-4 step 4) — deliver a price, then fire `onerror`, deterministically. */
class CapturingEventSource {
  static instances: CapturingEventSource[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  constructor(public url: string) {
    CapturingEventSource.instances.push(this);
  }
  close() {
    /* no-op */
  }
}

function installLiveBackend(
  rows: ScanRow[],
  sweep:
    | { updated_at: number; sweep_last_completed: number | null; universe_size: number }
    | null
    | undefined = undefined,
) {
  const nowS = Date.now() / 1000;
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
          authenticated: true,
          user: { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        });
      if (url.includes('/api/scan/universe'))
        return json({ symbols: rows.map((r) => r.symbol), universe_size: rows.length });
      if (url.includes('/api/scan'))
        return json({
          // `source: 'account'` — a SAVED view is never regrouped (index-first-defaults AC-3), so
          // this exercises `displayRows` directly rather than the zero-state lead-group path,
          // which is orthogonal to this task (see the build report's carried-debt note).
          view: {
            source: 'account',
            authenticated: true,
            name: null,
            symbols: rows.map((r) => r.symbol),
            sort: { key: 'score', dir: 'desc' },
            density: 'compact',
          },
          rows,
          sweep:
            sweep === undefined
              ? { updated_at: nowS, sweep_last_completed: nowS, universe_size: rows.length }
              : sweep,
        });
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
}

function renderScannerPage() {
  return render(
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
}

describe('criteria 12 + 13 (SB) — the price stream drop, driven by the EVENT not the clock', () => {
  beforeEach(() => {
    CapturingEventSource.instances = [];
    vi.stubGlobal('EventSource', CapturingEventSource as unknown as typeof EventSource);
  });

  it('a symbol that HAS ticked renders F4 (offline-retained) on drop; a symbol that never ticked stays untouched', async () => {
    installLiveBackend([
      makeRow({ symbol: 'SPY', price: 500, score: 82 }),
      makeRow({ symbol: 'QQQ', price: 300, score: 55 }),
    ]);
    renderScannerPage();
    await screen.findByTestId('scan-table');
    const es = CapturingEventSource.instances[0];
    expect(
      es,
      'useLivePrices must open exactly one EventSource for the two on-screen symbols',
    ).toBeTruthy();

    // SPY ticks over the live wire; QQQ never does. Drive the message, never wall-clock waiting.
    act(() => {
      es.onmessage?.({
        data: JSON.stringify({ prices: { SPY: { price: 501, ts: 1 } } }),
      } as MessageEvent);
    });
    const rows = screen.getAllByTestId('scan-row');
    const spyRow = rows.find((r) => r.getAttribute('data-symbol') === 'SPY') as HTMLElement;
    const qqqRow = rows.find((r) => r.getAttribute('data-symbol') === 'QQQ') as HTMLElement;
    expect(within(spyRow).getByTestId('cell-price')).toHaveTextContent('501.00');
    expect(within(spyRow).getByTestId('cell-price')).toHaveAttribute(
      'data-figure-state',
      'default',
    );

    // The stream dies — the EVENT (`onerror`), never a 45s wall-clock wait.
    act(() => es.onerror?.(new Event('error')));

    // 12 — F4 on the price only: dim + stroke pause + `offline · last known`, structure untouched.
    const spyPrice = within(spyRow).getByTestId('cell-price');
    expect(spyPrice).toHaveAttribute('data-figure-state', 'offline-retained');
    expect(spyPrice).toHaveTextContent('501.00'); // the last STREAMED value, retained
    expect(within(spyRow).getByTestId('cell-price-caption')).toHaveTextContent(
      'offline · last known',
    );
    expect(spyRow.querySelector('svg[data-testid="PauseIcon"]')).toBeTruthy();
    const spyScore = within(spyRow).getByTestId('cell-score');
    expect(spyScore).toHaveTextContent('82'); // identical text
    expect(spyScore.getAttribute('data-figure-state')).not.toMatch(/offline/); // not dimmed

    // 13 — QQQ never ticked: `offline-bare` is unreachable BY CONSTRUCTION. Full strength, no
    // pause mark, no last-known wording, even though the SAME drop just fired.
    const qqqPrice = within(qqqRow).getByTestId('cell-price');
    expect(qqqPrice).toHaveTextContent('300.00'); // the swept price, unchanged
    expect(qqqPrice).toHaveAttribute('data-figure-state', 'default');
    expect(qqqRow.querySelector('svg[data-testid="PauseIcon"]')).toBeNull();
    expect(within(qqqRow).queryByTestId('cell-price-caption')).toBeNull();

    // One flag: the header and the figure read the SAME `live.offline` — they cannot disagree.
    expect(screen.getByTestId('scan-cadence-header').textContent).toMatch(/Prices offline/);
  });

  it('MUTATION PROOF F (criterion 12, SB) — dropping the provenance term plants a pause mark on a never-ticked symbol', async () => {
    // This proof is run against the REAL predicate at `Scanner.tsx:119-139` in the build report
    // (edit `live.offline && live.prices[sym] != null` → `live.offline`, observe the red below,
    // revert). Recorded here as the executable assertion the poison must fail: with the correct
    // predicate, a never-ticked symbol never shows the pause mark on a drop.
    installLiveBackend([makeRow({ symbol: 'QQQ', price: 300 })]);
    renderScannerPage();
    await screen.findByTestId('scan-table');
    const es = CapturingEventSource.instances[0];
    act(() => es.onerror?.(new Event('error')));
    const row = screen.getByTestId('scan-row');
    expect(row.querySelector('svg[data-testid="PauseIcon"]')).toBeNull();
    expect(within(row).getByTestId('cell-price')).toHaveAttribute('data-figure-state', 'default');
  });
});

describe('GATE Z findings 1 + 2 (criteria 9, 12 — SB) — the table and card must agree on a GROUPED view', () => {
  beforeEach(() => {
    CapturingEventSource.instances = [];
    vi.stubGlobal('EventSource', CapturingEventSource as unknown as typeof EventSource);
  });

  // The mock is module-scoped (persists across tests in this FILE, not just this describe block) —
  // reset it to the jsdom-accurate default (no `matchMedia` ⇒ desktop) so a later, unrelated test
  // never inherits this block's `isNarrow: true` pass.
  afterEach(() => {
    (useMediaQuery as unknown as Mock).mockReturnValue(false);
  });

  /** `source: 'default'` (NOT `'account'`) so `Scanner.tsx`'s own zero-state lead-group partition
   *  runs and `groups` is DEFINED — QA_REPORT.md finding 1's exact reproduction condition
   *  ("whenever `groups` is defined — the default non-account view, i.e. the default"). SPY is in
   *  the closed `isIndexMegacap` set (`labels.ts`), so it lands in the lead group; `AAA` is not, so
   *  it lands in `rest` — exercising BOTH groups' slice of the overlay. */
  function installGroupedLiveBackend(rows: ScanRow[]) {
    const nowS = Date.now() / 1000;
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
            authenticated: true,
            user: { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
            google_available: false,
            settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
          });
        if (url.includes('/api/scan/universe'))
          return json({ symbols: rows.map((r) => r.symbol), universe_size: rows.length });
        if (url.includes('/api/scan'))
          return json({
            view: {
              source: 'default',
              authenticated: true,
              name: null,
              symbols: rows.map((r) => r.symbol),
              sort: { key: 'score', dir: 'desc' },
              density: 'compact',
            },
            rows,
            sweep: { updated_at: nowS, sweep_last_completed: nowS, universe_size: rows.length },
          });
        throw new Error(`Unexpected fetch in test: ${url}`);
      }),
    );
  }

  function readPriceCell(root: HTMLElement) {
    const el = within(root).getByTestId('cell-price');
    return { text: el.textContent, state: el.getAttribute('data-figure-state') };
  }

  it('the table (desktop) and the card (mobile) render the identical price + state for the SAME symbol in the SAME frame — live, then on a stream drop', async () => {
    const rows = [
      makeRow({ symbol: 'SPY', price: 500, score: 82 }), // lead (megacap)
      makeRow({ symbol: 'AAA', price: 50, score: 40 }), // rest
    ];

    // ---- Desktop pass: the table ----
    (useMediaQuery as unknown as Mock).mockReturnValue(false);
    installGroupedLiveBackend(rows);
    const tablePage = render(
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
    const tableEs = CapturingEventSource.instances[0];
    act(() => {
      tableEs.onmessage?.({
        data: JSON.stringify({ prices: { SPY: { price: 511, ts: 1 } } }),
      } as MessageEvent);
    });
    const tableRows = screen.getAllByTestId('scan-row');
    const tableSpy = tableRows.find((r) => r.getAttribute('data-symbol') === 'SPY') as HTMLElement;
    const tableAaa = tableRows.find((r) => r.getAttribute('data-symbol') === 'AAA') as HTMLElement;
    const tableSpyLive = readPriceCell(tableSpy);
    const tableAaaLive = readPriceCell(tableAaa);
    // Sanity: the live tick actually landed on the TABLE (pre-fix this was the broken arm: the
    // table discarded `displayRows` whenever `groups` was defined, so this would have stayed the
    // raw swept `500.00`/`default` instead of the overlaid `511.00`).
    expect(tableSpyLive).toEqual({ text: '511.00', state: 'default' });

    act(() => tableEs.onerror?.(new Event('error')));
    const tableSpyOffline = readPriceCell(tableSpy);
    const tableAaaOffline = readPriceCell(tableAaa);
    tablePage.unmount();

    // ---- Mobile pass: the SAME data, the SAME live sequence, the card ----
    CapturingEventSource.instances = [];
    (useMediaQuery as unknown as Mock).mockReturnValue(true);
    installGroupedLiveBackend(rows);
    const cardPage = render(
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
    await screen.findByTestId('scan-cards');
    const cardEs = CapturingEventSource.instances[0];
    act(() => {
      cardEs.onmessage?.({
        data: JSON.stringify({ prices: { SPY: { price: 511, ts: 1 } } }),
      } as MessageEvent);
    });
    const cards = screen.getAllByTestId('scan-card');
    const cardSpy = cards.find((c) => c.getAttribute('data-symbol') === 'SPY') as HTMLElement;
    const cardAaa = cards.find((c) => c.getAttribute('data-symbol') === 'AAA') as HTMLElement;

    // GATE Z finding 1 — one datum, one render, in BOTH layouts.
    expect(readPriceCell(cardSpy), 'SPY live: table vs card').toEqual(tableSpyLive);
    expect(readPriceCell(cardAaa), 'AAA (never ticked) live: table vs card').toEqual(tableAaaLive);

    act(() => cardEs.onerror?.(new Event('error')));
    // GATE Z finding 2 — the retained arm never claims "last known" over nothing: it agrees with
    // the table's own offline read, which (finding 1 fixed) is now the overlaid value.
    expect(readPriceCell(cardSpy), 'SPY offline: table vs card').toEqual(tableSpyOffline);
    expect(readPriceCell(cardAaa), 'AAA offline: table vs card').toEqual(tableAaaOffline);
    expect(tableSpyOffline.state).toBe('offline-retained');
    expect(tableSpyOffline.text).not.toBe('—'); // never an "offline · last known" claim over nothing
    expect(within(cardSpy).getByTestId('cell-price-caption')).toHaveTextContent(
      'offline · last known',
    );
    cardPage.unmount();
  });
});

describe('criterion 14 (SB) — no price figure flashes on change while the stream is down', () => {
  function renderPriceAt(price: number, flashActive: boolean) {
    return render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanTable
            rows={[makeRow({ symbol: 'SPY', price })]}
            sort={{ key: 'score', dir: 'desc' }}
            density="compact"
            nowS={NOW}
            flashActive={flashActive}
            onSort={() => undefined}
            priceOffline={() => null}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
  }

  it('a price change with the flash gate OFF never applies the flash animation class', () => {
    const { rerender, unmount } = renderPriceAt(500, false);
    const before = screen.getByTestId('cell-price').className;
    rerender(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanTable
            rows={[makeRow({ symbol: 'SPY', price: 510 })]}
            sort={{ key: 'score', dir: 'desc' }}
            density="compact"
            nowS={NOW}
            flashActive={false}
            onSort={() => undefined}
            priceOffline={() => null}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('cell-price').className).toBe(before);
    unmount();
  });

  it('ANTI-VACUITY: the SAME change with the flash gate ON does apply a flash class (proves the assertion above is non-vacuous)', () => {
    const { rerender, unmount } = renderPriceAt(500, true);
    const before = screen.getByTestId('cell-price').className;
    rerender(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanTable
            rows={[makeRow({ symbol: 'SPY', price: 510 })]}
            sort={{ key: 'score', dir: 'desc' }}
            density="compact"
            nowS={NOW}
            flashActive
            onSort={() => undefined}
            priceOffline={() => null}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('cell-price').className).not.toBe(before);
    unmount();
  });

  it('the Scanner page itself gates the flash off the SAME `live.offline` flag the header reads', async () => {
    CapturingEventSource.instances = [];
    vi.stubGlobal('EventSource', CapturingEventSource as unknown as typeof EventSource);
    installLiveBackend([makeRow({ symbol: 'SPY', price: 500 })]);
    renderScannerPage();
    await screen.findByTestId('scan-table');
    // Ambient (pre-drop) render: no live tick yet, so the swept price already shows; force the
    // drop and confirm the header agrees before asserting the flash gate at the Scanner level.
    const es = CapturingEventSource.instances[0];
    act(() => es.onerror?.(new Event('error')));
    expect(screen.getByTestId('scan-cadence-header').textContent).toMatch(/Prices offline/);
  });
});

describe('criterion 16 — worker-down keeps every figure register, blanks no row', () => {
  it('a stale sweep raises the banner over intact rows; every figure keeps its stated register', async () => {
    const nowS = Date.now() / 1000;
    installLiveBackend(
      [makeRow({ symbol: 'SPY', price: 500, score: 82, regime: 'positive_gamma' })],
      { updated_at: nowS - 900, sweep_last_completed: nowS - 180, universe_size: 1 },
    );
    renderScannerPage();
    const banner = await screen.findByTestId('scan-worker-down');
    expect(banner).toHaveTextContent('Sweep last ran 3 min ago — showing the last known rows.');
    const row = screen.getByTestId('scan-row');
    // Every figure keeps its register — none is blanked, none loses its `data-figure-register`.
    for (const id of ['cell-price', 'cell-chg', 'cell-score']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-figure-register', 'mono');
    }
    expect(within(row).getByTestId('cell-regime')).toHaveAttribute('data-figure-register', 'sans');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(1); // no row blanked
  });
});

// =================================================================================================
// CF-1 (SB) — the scanner's closed copy set is EXACTLY two constants, in one object. Every other
// `SCAN_COPY` value is byte-identical to what shipped before this phase (`git show d905d26a~1`, the
// commit immediately preceding FE-3), proven against a frozen table copied verbatim from there —
// never re-derived from the current `labels.ts`, or a rename of the source and the frozen copy
// would drift together and this scan would certify nothing.
// =================================================================================================
const CF1_EXEMPT: readonly string[] = ['cadenceHeader', 'cadenceGloss'];

/** Every OTHER string-valued `SCAN_COPY` entry, copied verbatim from the pre-phase shipped source. */
const FROZEN_SCAN_COPY_STRINGS: Record<string, string> = {
  heading: 'Scanner',
  subhead:
    'One dense read of the tracked universe — which ticker deserves the deep-dive right now. ' +
    'Structure is a snapshot; see methodology for how it is built.',
  methodologyLink: 'How structure is computed',
  cadenceHeaderOffline: 'Prices offline · showing last known · structure ~3 min',
  loading: 'Loading scan…',
  emptyViewTitle: 'No tickers in your view.',
  emptyViewBody: 'Pick tickers to build your scan.',
  emptyFilterTitle: 'No names match these filters.',
  emptyFilterBody: 'Clear a chip or widen the thresholds — the full view is still loaded.',
  clearFilters: 'Clear filters',
  signInToCustomize: 'Sign in to customize your view.',
  editView: 'Edit view',
  saveView: 'Save view',
  cancel: 'Cancel',
  viewNameLabel: 'View name (optional)',
  viewEditorTitle: 'Edit your scan view',
  universeHint:
    'Pick from the tracked universe. The universe is server-curated — it cannot be added to here.',
  selectedHeading: 'In your view (drag order = display order)',
  moveUp: 'Move up',
  moveDown: 'Move down',
  saveFailed: 'Could not save that view. Please try again.',
  sweepAbsent: "Sweep hasn't reported yet — showing the last known rows.",
  structureAsOfUnknown: 'Structure as-of —',
  sessionAria: 'US equity session',
  filterAria: 'Scan desk filters',
  whyScoreAria: 'Why this score',
  leadGroup: 'Indexes & megacaps',
};

/** Every function-valued `SCAN_COPY` entry, checked by its OUTPUT on a fixed sample — the function
 *  bodies are byte-identical to the pre-phase source, and this is the form that survives a harmless
 *  parameter rename. */
const FROZEN_SCAN_COPY_FN_SAMPLES: Record<string, { args: unknown[]; expect: string }> = {
  sweepBehind: {
    args: ['3 min'],
    expect: 'Sweep last ran 3 min ago — showing the last known rows.',
  },
  updated: { args: ['42s'], expect: 'Structure as-of 42s' },
  structureAsOf: { args: ['42s'], expect: 'Structure as-of 42s' },
  filterShowing: { args: [1, 2], expect: 'Showing 1 of 2' },
  sortAria: { args: ['Score'], expect: 'Sort by Score' },
};

function cf1Offenders(copy: Record<string, unknown>): string[] {
  const offenders: string[] = [];
  for (const [key, value] of Object.entries(copy)) {
    if (CF1_EXEMPT.includes(key)) continue;
    if (typeof value === 'function') {
      const sample = FROZEN_SCAN_COPY_FN_SAMPLES[key];
      if (!sample) {
        offenders.push(`${key} — new function-valued key with no frozen sample`);
        continue;
      }
      const actual = (value as (...a: unknown[]) => string)(...sample.args);
      if (actual !== sample.expect) offenders.push(`${key}(${JSON.stringify(sample.args)})`);
      continue;
    }
    if (typeof value !== 'string') continue;
    if (!(key in FROZEN_SCAN_COPY_STRINGS)) {
      offenders.push(`${key} — new string-valued key with no frozen entry`);
      continue;
    }
    if (FROZEN_SCAN_COPY_STRINGS[key] !== value) offenders.push(key);
  }
  return offenders;
}

describe('CF-1 (SB) — the closed copy set is exactly two constants; everything else byte-identical', () => {
  it('anti-vacuity: the exemption list names exactly `cadenceHeader` and `cadenceGloss`, and no third', () => {
    expect(CF1_EXEMPT).toEqual(['cadenceHeader', 'cadenceGloss']);
    for (const key of CF1_EXEMPT) expect(key in SCAN_COPY).toBe(true);
  });

  it('every non-exempt SCAN_COPY value matches the frozen pre-phase table', () => {
    expect(cf1Offenders(SCAN_COPY), 'CF-1 violation').toEqual([]);
  });

  it('MUTATION PROOF G (CF-1, SB): changing a THIRD value by one byte goes red, naming that key', () => {
    // The real ellipsis '…' swapped for three ASCII dots — one byte class, one key, off-list.
    const mutated = { ...SCAN_COPY, loading: 'Loading scan...' };
    expect(cf1Offenders(mutated)).toEqual(['loading']);
  });
});
