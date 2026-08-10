/**
 * `/scanner` — RISK-BASED suite (per `.claude/agents/qa-verify.md` §4 as amended 2026-07-13, and the
 * enumerated set in `UX_BLUEPRINT.md` §6). NOT one test per AC. We test only what can regress
 * SILENTLY and INVISIBLY:
 *
 *   1. the closed status/tier/regime lookups (a miss that GUESSES looks fine on screen),
 *   2. the honesty invariants — `stale` keeps a frozen price WITH its stamp, `building` fabricates
 *      no score and makes no freshness claim, `null` renders `—` and never `0`,
 *   3. the direction-colour boundary — className identity proves score/distance/wall/regime cells are
 *      untinted (the proximity-chip regression class),
 *   4. per-row isolation — one `error` row never takes its neighbours with it,
 *   5. `[no-real-order-path]` — a row/card is a LINK to the ticker page and nothing else,
 *   6. the four page states + the worker-down degrade (Task 7 batch),
 *   7. structural negative space — no "live", no stream primitive (Task 7 batch, mutation-guarded).
 *
 * NOT asserted here (visible + intentional ⇒ review): exact header wording, column labels, chip
 * styling, toolbar control presence. Pure transports live in `format.spec.ts`; the fetch/gate
 * lifecycle lives in `useScan.spec.tsx`.
 *
 * Mocks ONLY the network boundary (`fetch` + `EventSource`). MUI `sx` compiles to CLASSES — we assert
 * className identity, never `getAttribute('style')`.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import type { GateApi } from '@/features/auth/useGate';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { ScanRow } from '@convexa/api';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScanCardList } from './ScanCard';
import { ScanTable } from './ScanTable';
import { ScanToolbar } from './ScanToolbar';
import { Scanner } from './Scanner';
import { ViewEditorDialog } from './ViewEditorDialog';
import { SCAN_COLUMNS, SORTABLE_COLUMNS } from './labels';

const NOW = 1_800_000;

export function makeRow(over: Partial<ScanRow> = {}): ScanRow {
  return {
    symbol: 'SPY',
    price: 500,
    chg_pct: 1.24,
    score: 82,
    tier: 'prime',
    regime: 'positive_gamma',
    vol_regime: 'iv_rich',
    flip: 495,
    dist_to_flip_pct: 1.01,
    call_wall: 510,
    put_wall: 490,
    dist_to_wall_pct: 2.0,
    as_of: NOW - 42,
    status: 'ok',
    ...over,
  };
}

/** A minimal GateApi double — the toolbar only reads `allowed`/`promptText` and calls `signIn`. */
export function fakeGate(over: Partial<GateApi> = {}): GateApi {
  return {
    allowed: false,
    promptText: null,
    prompt: () => undefined,
    signIn: () => undefined,
    clear: () => undefined,
    guard: async () => undefined,
    simTradeGate: async () => ({ authorized: true as const }),
    ...over,
  };
}

function renderTable(rows: ScanRow[]) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ScanTable
          rows={rows}
          sort={{ key: 'score', dir: 'desc' }}
          density="compact"
          nowS={NOW}
          flashActive
          onSort={() => undefined}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function rowFor(symbol: string) {
  return screen
    .getAllByTestId('scan-row')
    .find((r) => r.getAttribute('data-symbol') === symbol) as HTMLElement;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// =================================================================================================
// 1. The locked column set + honestly-missing rendering
// =================================================================================================
describe('the dense table renders the locked columns and never fabricates a value', () => {
  it('every locked column has a header, in order, and an ok row fills them', () => {
    renderTable([makeRow()]);
    const headers = screen.getAllByRole('columnheader').map((th) => th.getAttribute('data-testid'));
    expect(headers).toEqual(SCAN_COLUMNS.map((c) => `scan-th-${c}`));
    const row = rowFor('SPY');
    expect(within(row).getByTestId('cell-price')).toHaveTextContent('500.00');
    expect(within(row).getByTestId('cell-chg')).toHaveTextContent('+1.24%');
    expect(within(row).getByTestId('cell-score')).toHaveTextContent('82');
    expect(within(row).getByText('Prime')).toBeInTheDocument(); //   closed tier lookup
    expect(within(row).getByTestId('cell-regime')).toHaveTextContent('Pos γ');
    expect(within(row).getByTestId('cell-vol')).toHaveTextContent('IV rich');
    expect(within(row).getByTestId('cell-updated')).toHaveTextContent('Structure as-of 42s');
  });

  it('null numerics render the em-dash — never 0, never a fabricated value', () => {
    renderTable([
      makeRow({
        symbol: 'NUL',
        price: null,
        chg_pct: null,
        score: null,
        flip: null,
        dist_to_flip_pct: null,
        call_wall: null,
        put_wall: null,
        dist_to_wall_pct: null,
      }),
    ]);
    const row = rowFor('NUL');
    for (const id of ['cell-price', 'cell-chg', 'cell-score', 'cell-dist-flip', 'cell-dist-wall']) {
      expect(within(row).getByTestId(id)).toHaveTextContent('—');
      expect(within(row).getByTestId(id).textContent).not.toMatch(/\b0\b/);
    }
  });
});

// =================================================================================================
// 2. Green/red is PRICE DIRECTION only — className identity (sx compiles to classes)
// =================================================================================================
describe('direction colour never leaks onto a rate or a proximity', () => {
  it('chg_pct differs by sign while score / distances / regime stay className-identical', () => {
    renderTable([
      makeRow({ symbol: 'UPP', chg_pct: 2.5, score: 90, dist_to_flip_pct: 3, dist_to_wall_pct: 4 }),
      makeRow({
        symbol: 'DWN',
        chg_pct: -2.5,
        score: -90,
        dist_to_flip_pct: -3,
        dist_to_wall_pct: -4,
      }),
    ]);
    const up = rowFor('UPP');
    const down = rowFor('DWN');
    // The ONE sanctioned direction colour: the class MUST differ.
    expect(within(up).getByTestId('cell-chg').className).not.toBe(
      within(down).getByTestId('cell-chg').className,
    );
    // Everything else is a rate / a no-side datum: identical classes ⇒ provably untinted.
    for (const id of [
      'cell-score',
      'cell-dist-flip',
      'cell-dist-wall',
      'cell-regime',
      'cell-vol',
    ]) {
      expect(
        within(up).getByTestId(id).className,
        `${id} must be className-identical across a positive and a negative row`,
      ).toBe(within(down).getByTestId(id).className);
    }
  });
});

// =================================================================================================
// 3. The per-row honest states
// =================================================================================================
describe('per-row honesty', () => {
  it('a stale row keeps its FROZEN price with its as-of stamp and a ⚠ Stale chip', () => {
    renderTable([makeRow({ symbol: 'STL', price: 55.5, as_of: NOW - 600, status: 'stale' })]);
    const row = rowFor('STL');
    expect(within(row).getByTestId('cell-price')).toHaveTextContent('55.50'); // frozen, not blanked
    expect(within(row).getByTestId('cell-updated')).toHaveTextContent('Structure as-of 10m');
    expect(within(row).getByTestId('cell-status')).toHaveTextContent('⚠ Stale');
    expect(within(row).getByTestId('cell-status')).toHaveAttribute('data-tone', 'warning');
  });

  it('a building row fabricates NO score and makes NO freshness claim (the as_of trap)', () => {
    // A synthesized building row can carry a fresh non-null as_of — it is NOT a freshness claim.
    renderTable([
      makeRow({
        symbol: 'BLD',
        price: null,
        chg_pct: null,
        score: null,
        tier: null,
        as_of: NOW - 3,
        status: 'building',
      }),
    ]);
    const row = rowFor('BLD');
    expect(within(row).getByTestId('cell-score')).toHaveTextContent('—');
    expect(within(row).getByTestId('cell-status')).toHaveTextContent('Building');
    expect(within(row).getByTestId('cell-updated')).toHaveTextContent('—');
    expect(row.textContent).not.toMatch(/Updated/); // no fabricated freshness anywhere on the row
  });

  it('one error row degrades ALONE — its neighbours keep rendering their numbers', () => {
    renderTable([
      makeRow({ symbol: 'GOOD', score: 71 }),
      makeRow({ symbol: 'BAD', price: null, score: null, status: 'error' }),
      makeRow({ symbol: 'ALSO', score: 64 }),
    ]);
    expect(within(rowFor('BAD')).getByTestId('cell-status')).toHaveTextContent('⚠ Error');
    expect(within(rowFor('GOOD')).getByTestId('cell-score')).toHaveTextContent('71');
    expect(within(rowFor('ALSO')).getByTestId('cell-score')).toHaveTextContent('64');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(3); // nobody was dropped
  });

  it('an UNKNOWN status is fail-honest (Unavailable), never guessed into a known state', () => {
    renderTable([makeRow({ symbol: 'WAT', status: 'teleporting' as ScanRow['status'] })]);
    const row = rowFor('WAT');
    expect(within(row).getByTestId('cell-status')).toHaveTextContent('Unavailable');
    expect(within(row).getByTestId('cell-status').textContent).not.toMatch(/Stale|Error|Building/);
    expect(within(row).getByTestId('cell-price')).toHaveTextContent('500.00'); // row still renders
  });
});

// =================================================================================================
// 4. `[no-real-order-path]` — a row/card is a LINK to the ticker page and nothing else
// =================================================================================================
describe('navigation only', () => {
  it('table rows and mobile cards expose a real /ticker/{SYMBOL} link and no action control', () => {
    const rows = [makeRow({ symbol: 'SPY' }), makeRow({ symbol: 'QQQ' })];
    const { container, unmount } = renderTable(rows);
    expect(screen.getAllByTestId('scan-row-link').map((a) => a.getAttribute('href'))).toEqual([
      '/ticker/SPY',
      '/ticker/QQQ',
    ]);
    // The only buttons on the table are the column-sort controls — no order/trade affordance.
    for (const button of Array.from(container.querySelectorAll('button'))) {
      expect(button.getAttribute('data-testid') ?? '').toMatch(/^scan-sort-/);
    }
    unmount();

    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanCardList rows={rows} nowS={NOW} flashActive />
        </MemoryRouter>
      </ThemeProvider>,
    );
    const cards = screen.getAllByTestId('scan-card');
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/ticker/SPY', '/ticker/QQQ']);
    expect(screen.getByTestId('scan-cards').querySelectorAll('button')).toHaveLength(0);
  });
});

// =================================================================================================
// 5. The controls emit only CLOSED wire vocabulary (a bad key silently breaks view persistence)
// =================================================================================================
describe('sort + density controls speak only the closed wire vocabulary', () => {
  it('a header click emits a closed sort key and toggles direction; aria-sort tracks the active column', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const closedKeys = new Set(Object.values(SORTABLE_COLUMNS));
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanTable
            rows={[makeRow()]}
            sort={{ key: 'score', dir: 'desc' }}
            density="compact"
            nowS={NOW}
            flashActive
            onSort={onSort}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    // The active column advertises its direction; a non-sortable column advertises nothing.
    expect(screen.getByTestId('scan-th-score')).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByTestId('scan-th-tier')).toHaveAttribute('aria-sort', 'none');
    expect(screen.queryByTestId('scan-sort-tier')).toBeNull(); // tier is not sortable

    await user.click(screen.getByTestId('scan-sort-score')); // active + desc ⇒ flip to asc
    await user.click(screen.getByTestId('scan-sort-symbol')); // a new column starts at desc
    for (const [{ key, dir }] of onSort.mock.calls) {
      expect(closedKeys.has(key)).toBe(true);
      expect(['asc', 'desc']).toContain(dir);
    }
    expect(onSort.mock.calls[0][0]).toEqual({ key: 'score', dir: 'asc' });
    expect(onSort.mock.calls[1][0]).toEqual({ key: 'symbol', dir: 'desc' });
  });

  it('the density control emits only the closed values and the table carries the rendered density', async () => {
    const user = userEvent.setup();
    const onDensity = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanToolbar
            view={null}
            density="compact"
            onDensity={onDensity}
            onEditView={() => undefined}
            gate={fakeGate({ allowed: true })}
            session={{ phase: 'rth', label: 'RTH' }}
            structureAsOf="42s"
            filters={{ tier: null, volRegime: null, minScore: null, maxAbsDistFlip: null }}
            onFilters={() => undefined}
            filteredCount={1}
            totalCount={1}
          />
          <ScanTable
            rows={[makeRow()]}
            sort={{ key: 'score', dir: 'desc' }}
            density="comfortable"
            nowS={NOW}
            flashActive
            onSort={() => undefined}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await user.click(screen.getByTestId('scan-density-comfortable'));
    expect(onDensity).toHaveBeenCalledWith('comfortable');
    for (const [value] of onDensity.mock.calls) expect(['compact', 'comfortable']).toContain(value);
    expect(screen.getByTestId('scan-table')).toHaveAttribute('data-density', 'comfortable');
  });
});

// =================================================================================================
// 6. Anonymous copy never overclaims
// =================================================================================================
describe('the toolbar never overclaims persistence', () => {
  it('an anonymous visitor gets the standing sign-in prompt and a "Default view" label — no saved/your claim', () => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanToolbar
            view={{
              source: 'default',
              authenticated: false,
              name: null,
              symbols: ['SPY'],
              sort: { key: 'score', dir: 'desc' },
              density: 'compact',
            }}
            density="compact"
            onDensity={() => undefined}
            onEditView={() => undefined}
            gate={fakeGate({ allowed: false })}
            session={{ phase: 'closed', label: 'Closed' }}
            structureAsOf="3m"
            filters={{ tier: null, volRegime: null, minScore: null, maxAbsDistFlip: null }}
            onFilters={() => undefined}
            filteredCount={1}
            totalCount={1}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('scan-signin-prompt')).toHaveTextContent(
      'Sign in to customize your view.',
    );
    expect(screen.getByTestId('scan-view-label')).toHaveTextContent('Default view');
    expect(screen.getByTestId('scan-toolbar').textContent).not.toMatch(
      /saved|Saved to your account/i,
    );
  });
});

// =================================================================================================
// 7. The editor is universe-constrained (AC-13) and saves the exact draft
// =================================================================================================
describe('the view editor', () => {
  const universe = { symbols: ['SPY', 'QQQ', 'NVDA'], universe_size: 3 };

  function renderEditor(onSave: (d: unknown) => Promise<boolean>) {
    return render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ViewEditorDialog
            open
            onClose={() => undefined}
            view={{
              source: 'account',
              authenticated: true,
              name: null,
              symbols: ['SPY', 'QQQ'],
              sort: { key: 'score', dir: 'desc' },
              density: 'compact',
            }}
            sort={{ key: 'score', dir: 'desc' }}
            density="compact"
            saveError={null}
            onSave={onSave as never}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
  }

  it('offers ONLY universe symbols — no free-text entry, no path to an off-universe symbol', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(universe), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    renderEditor(async () => true);
    await screen.findByTestId('scan-universe-SPY');
    // Every choice control corresponds to a symbol the SERVER listed.
    const offered = within(screen.getByTestId('scan-universe-list'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(offered).toEqual(universe.symbols);
    expect(screen.queryByTestId('scan-universe-ZZZZ')).toBeNull();
    // The ONLY text input is the optional view NAME — there is no symbol text field to type into.
    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveAttribute('data-testid', 'scan-view-name');
  });

  it('saves the exact draft: reordered symbols in display order + name + the live sort/density', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(universe), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    // Declare the signature on `vi.fn` (not a bare `async () => true`): otherwise `mock.calls`
    // infers the EMPTY tuple and the draft assertion below cannot be type-checked at all.
    const onSave = vi.fn<(draft: unknown) => Promise<boolean>>(async () => true);
    renderEditor(onSave);
    await screen.findByTestId('scan-universe-NVDA');

    await user.click(screen.getByTestId('scan-universe-NVDA')); // append
    await user.click(screen.getByTestId('scan-move-up-NVDA')); // reorder: order IS the ordering
    await user.type(screen.getByTestId('scan-view-name'), 'Morning');
    await user.click(screen.getByTestId('scan-view-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toEqual({
      symbols: ['SPY', 'NVDA', 'QQQ'],
      name: 'Morning',
      sort: { key: 'score', dir: 'desc' },
      density: 'compact',
    });
  });
});

// =================================================================================================
// 8. The page-level states + the structural negative space
// =================================================================================================
type PageOpts = {
  symbols?: string[];
  rows?: ScanRow[];
  sweep?: { updated_at: number; sweep_last_completed: number | null; universe_size: number } | null;
  authenticated?: boolean;
  hold?: boolean; // keep the first read in flight so the skeleton stays visible
};

function installScanBackend(opts: PageOpts = {}) {
  const nowS = Date.now() / 1000;
  const symbols = opts.symbols ?? ['SPY', 'QQQ'];
  const body = {
    view: {
      source: opts.authenticated ? 'account' : 'default',
      authenticated: !!opts.authenticated,
      name: null,
      symbols,
      sort: { key: 'score', dir: 'desc' },
      density: 'compact',
    },
    rows: opts.rows ?? symbols.map((symbol, i) => makeRow({ symbol, score: 90 - i })),
    sweep:
      opts.sweep === undefined
        ? { updated_at: nowS, sweep_last_completed: nowS, universe_size: symbols.length }
        : opts.sweep,
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
          authenticated: !!opts.authenticated,
          user: opts.authenticated
            ? { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] }
            : null,
          google_available: false,
          settings: opts.authenticated
            ? { active_persona_id: null, default_ticker: null, theme: 'dark' }
            : null,
        });
      if (url.includes('/api/scan/universe'))
        return json({ symbols, universe_size: symbols.length });
      if (url.includes('/api/scan')) {
        if (opts.hold) return new Promise<Response>(() => undefined); // never resolves
        return json(body);
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
}

function renderPage() {
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

describe('the four honest page states', () => {
  it('the first-load SKELETON is its own state — no figures, and it is gone after the read', async () => {
    installScanBackend({ hold: true });
    const { unmount } = renderPage();
    const skeleton = await screen.findByTestId('scan-skeleton');
    expect(skeleton.textContent).toBe('Loading scan…'); // shimmer only — never a number
    expect(screen.queryByTestId('scan-table')).toBeNull();
    expect(screen.queryByTestId('scan-worker-down')).toBeNull(); // loading ≠ degraded
    expect(screen.queryByText('Building')).toBeNull(); //           loading ≠ building
    unmount();

    installScanBackend();
    renderPage();
    await screen.findByTestId('scan-table');
    expect(screen.queryByTestId('scan-skeleton')).toBeNull(); // never reappears post-load
  });

  it('the anonymous default view is POPULATED — no empty block, no error, no persistence claim', async () => {
    installScanBackend({ authenticated: false, symbols: ['SPY', 'QQQ', 'NVDA'] });
    renderPage();
    await screen.findByTestId('scan-table');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(3);
    expect(screen.queryByTestId('scan-empty-view')).toBeNull(); // anonymous NEVER reaches it (D2)
    expect(await screen.findByTestId('scan-signin-prompt')).toHaveTextContent(
      'Sign in to customize your view.',
    );
    expect(screen.getByTestId('scanner-page').textContent).not.toMatch(/Saved to your account/i);
  });

  it('a signed-in EMPTY saved view gets the pick-tickers affordance instead of a dead screen', async () => {
    installScanBackend({ authenticated: true, symbols: [], rows: [] });
    renderPage();
    const empty = await screen.findByTestId('scan-empty-view');
    expect(empty).toHaveTextContent('No tickers in your view.');
    expect(empty).toHaveTextContent('Pick tickers to build your scan.');
    expect(screen.getByTestId('scan-empty-cta')).toBeInTheDocument();
    expect(screen.queryByTestId('scan-table')).toBeNull();
  });

  it('a behind or absent sweep raises the banner OVER intact rows — never a blank or an error page', async () => {
    const nowS = Date.now() / 1000;
    installScanBackend({
      sweep: { updated_at: nowS - 900, sweep_last_completed: nowS - 180, universe_size: 2 },
    });
    const { unmount } = renderPage();
    const banner = await screen.findByTestId('scan-worker-down');
    expect(banner).toHaveTextContent('Sweep last ran 3 min ago — showing the last known rows.');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(2); // the rows SURVIVE the banner
    expect(within(rowFor('SPY')).getByTestId('cell-score')).toHaveTextContent('90');
    unmount();

    installScanBackend({ sweep: null });
    renderPage();
    expect(await screen.findByTestId('scan-worker-down')).toHaveTextContent(
      "Sweep hasn't reported yet — showing the last known rows.",
    );
    expect(screen.getAllByTestId('scan-row')).toHaveLength(2);
  });
});

// =================================================================================================
// 8b. index-first-defaults AC-3 — the zero-state lead group vs the saved-view no-regroup guarantee
// =================================================================================================
describe('zero-state lead group (index-first-defaults AC-3)', () => {
  /** Mixed-membership fixture: wire order deliberately interleaves lead/non-lead, scores desc. */
  const MIXED = ['GME', 'SPY', 'COIN', 'QQQ'];

  const rowOrder = () =>
    screen.getAllByTestId('scan-row').map((r) => r.getAttribute('data-symbol'));

  it('a DEFAULT (no saved) view leads with "Indexes & megacaps", each group internally score-desc', async () => {
    installScanBackend({ authenticated: false, symbols: MIXED });
    renderPage();
    await screen.findByTestId('scan-table');

    // Exactly ONE labeled group header, reusing the table's own header treatment.
    const headers = screen.getAllByTestId('scan-group-header');
    expect(headers).toHaveLength(1);
    expect(headers[0]).toHaveTextContent('Indexes & megacaps');

    // Lead members first (score-desc among themselves), then the rest (score-desc among themselves)
    // — scores are 90,89,88,87 in wire order, so within-group order proves the sort survived.
    expect(rowOrder()).toEqual(['SPY', 'QQQ', 'GME', 'COIN']);
  });

  it('a SAVED view is NEVER regrouped — no header, order exactly as today (score-desc)', async () => {
    installScanBackend({ authenticated: true, symbols: MIXED });
    renderPage();
    await screen.findByTestId('scan-table');
    expect(screen.queryByTestId('scan-group-header')).toBeNull();
    expect(rowOrder()).toEqual(['GME', 'SPY', 'COIN', 'QQQ']);
  });

  it('a default view with NO lead member degrades to the flat table (no orphan header)', async () => {
    installScanBackend({ authenticated: false, symbols: ['GME', 'COIN'] });
    renderPage();
    await screen.findByTestId('scan-table');
    expect(screen.queryByTestId('scan-group-header')).toBeNull();
    expect(rowOrder()).toEqual(['GME', 'COIN']);
  });
});

// =================================================================================================
// 8c-url. Shareable desk URL seeds filters from the address bar
// =================================================================================================
describe('scanner desk URL params', () => {
  it('seeds tier filter from ?tier=prime and shows the chip pressed', async () => {
    installScanBackend({
      symbols: ['AAA', 'BBB'],
      rows: [
        makeRow({ symbol: 'AAA', tier: 'prime', score: 90 }),
        makeRow({ symbol: 'BBB', tier: 'watch', score: 40 }),
      ],
    });
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/scanner?tier=prime']}>
          <AuthProvider>
            <AuthDialogProvider>
              <Scanner />
            </AuthDialogProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );
    await screen.findByTestId('scan-table');
    expect(screen.getByTestId('scan-filter-tier-prime')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(1);
    expect(rowFor('AAA')).toBeTruthy();
  });
});

// =================================================================================================
// 8c-kb. Product spine #6 — keyboard / hit-area polish on the scan desk
// =================================================================================================
describe('scanner keyboard & hit targets (spine #6)', () => {
  it('sort headers are real buttons and row links are keyboard-reachable anchors', () => {
    renderTable([makeRow({ symbol: 'SPY' }), makeRow({ symbol: 'QQQ' })]);
    const sortScore = screen.getByTestId('scan-sort-score');
    expect(sortScore.tagName.toLowerCase()).toBe('button');
    expect(sortScore).toHaveAttribute('type', 'button');
    // Real control, not a dead span — keyboard Enter activates buttons natively.
    expect(sortScore.getAttribute('tabindex')).not.toBe('-1');

    const links = screen.getAllByTestId('scan-row-link');
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a.tagName.toLowerCase()).toBe('a');
      expect(a.getAttribute('href')).toMatch(/^\/ticker\//);
    }
  });

  it('score cell is keyboard-focusable so the why-this-row tip is not hover-only', () => {
    renderTable([makeRow()]);
    const score = within(rowFor('SPY')).getByTestId('cell-score');
    expect(score).toHaveAttribute('tabindex', '0');
    expect(score).toHaveAttribute('aria-label', 'Why this score');
  });
});

// =================================================================================================
// 8c. Product spine #2 — Scanner as desk (session strip · filters · why-this-row)
// =================================================================================================
describe('scanner as desk', () => {
  it('surfaces a session badge + structure as-of strip (never claims structure is live)', async () => {
    installScanBackend({ symbols: ['SPY'] });
    renderPage();
    await screen.findByTestId('scan-table');
    const badge = screen.getByTestId('scan-session-badge');
    expect(badge).toHaveAttribute('data-phase');
    expect(['RTH', 'Pre-market', 'After-hours', 'Closed']).toContain(badge.textContent);
    expect(screen.getByTestId('scan-structure-asof').textContent).toMatch(/Structure as-of/);
    expect(screen.getByTestId('scan-session-strip').textContent).not.toMatch(
      /structure is live|live structure/i,
    );
  });

  it('client filters narrow the table without a refetch and clear restores all rows', async () => {
    const user = userEvent.setup();
    installScanBackend({
      symbols: ['AAA', 'BBB'],
      rows: [
        makeRow({ symbol: 'AAA', tier: 'prime', score: 90, dist_to_flip_pct: 0.5 }),
        makeRow({ symbol: 'BBB', tier: 'watch', score: 40, dist_to_flip_pct: 4 }),
      ],
    });
    renderPage();
    await screen.findByTestId('scan-table');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(2);

    await user.click(screen.getByTestId('scan-filter-tier-prime'));
    expect(screen.getAllByTestId('scan-row')).toHaveLength(1);
    expect(rowFor('AAA')).toBeTruthy();
    expect(screen.queryByTestId('scan-row') && rowFor('BBB')).toBeFalsy();
    expect(screen.getByTestId('scan-filter-count')).toHaveTextContent('Showing 1 of 2');

    await user.click(screen.getByTestId('scan-filter-clear'));
    expect(screen.getAllByTestId('scan-row')).toHaveLength(2);
  });

  it('score cell exposes a why-this-row tip built from closed fields (no live claim)', async () => {
    const user = userEvent.setup();
    installScanBackend({
      symbols: ['SPY'],
      rows: [
        makeRow({
          symbol: 'SPY',
          tier: 'prime',
          dist_to_flip_pct: 0.8,
          regime: 'negative_gamma',
          vol_regime: 'iv_rich',
        }),
      ],
    });
    renderPage();
    await screen.findByTestId('scan-table');
    const score = within(rowFor('SPY')).getByTestId('cell-score');
    expect(score).toHaveAttribute('aria-label', 'Why this score');
    await user.hover(score);
    // MUI Tooltip portals the title; wait for the tip role.
    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toMatch(/Prime tier/);
    expect(tip.textContent).not.toMatch(/\blive\b/i);
  });
});

// =================================================================================================
// 9. Structural negative space (mutation-guarded `?raw` scans + a DOM sweep)
// =================================================================================================
const SCANNER_SOURCES = import.meta.glob(
  ['/src/app/pages/scanner/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Strip comments while PRESERVING newlines (the house idiom) so line numbers stay true. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/^\s*\/\/.*$/gm, '');
}
// RETIRED 2026-08-06 (owner decision B). `hasLiveWord` and `hasStreamPrimitive` enforced "the scan
// surface is poll-only, and never says live". Both were premised on a constraint that no longer
// exists: streaming the scanner used to mean ONE VENDOR SOCKET PER ROW, so 69 rows was impossible.
// The shared multiplexer (providers/stock_stream_hub) made it one socket for any number of symbols
// and the prices ARE live now — a guard banning the word would force the UI to lie.
// What the guard really protected survives SERVER-side: the hazard was a row wiring itself to
// /api/stream/{ticker}, which builds a LiveSession with an option-chain refresh loop.
// apps/api tests/test_price_route_ordering pins that, and /api/stream/prices carries no chain.
const usesBareExtras = (src: string) =>
  /\bextras\./.test(stripComments(src)) || /\bextrasLight\./.test(stripComments(src));

describe('[live-vs-static-isolation] + [theme-token-discipline] on the scan surface', () => {
  it('the glob is not vacuous (the scanner sources actually loaded)', () => {
    const keys = Object.keys(SCANNER_SOURCES);
    expect(keys.length).toBeGreaterThanOrEqual(8);
    expect(keys).toContain('/src/app/pages/scanner/Scanner.tsx');
    expect(keys).toContain('/src/app/pages/scanner/useScan.ts');
  });

  it('MUTATION GUARD: every checker flags its violation fixture and passes a clean one', () => {
    expect(usesBareExtras('color: extras.textAmber')).toBe(true);
    expect(usesBareExtras('color: extrasFor(theme).panelRaised')).toBe(false);
  });

  it('no scanner source dark-locks a mode-aware value', () => {
    const bare: string[] = [];
    for (const [file, src] of Object.entries(SCANNER_SOURCES)) {
      if (usesBareExtras(src)) bare.push(file);
    }
    expect(bare, 'mode-aware values must resolve via extrasFor(theme)').toEqual([]);
  });

  it('the RENDERED page states BOTH data ages — with all four row states on screen', async () => {
    const nowS = Date.now() / 1000;
    installScanBackend({
      symbols: ['OKY', 'STL', 'ERR', 'BLD'],
      rows: [
        makeRow({ symbol: 'OKY', status: 'ok', as_of: nowS - 10 }),
        makeRow({ symbol: 'STL', status: 'stale', as_of: nowS - 900 }),
        makeRow({ symbol: 'ERR', status: 'error', price: null, score: null, as_of: nowS - 60 }),
        makeRow({
          symbol: 'BLD',
          status: 'building',
          price: null,
          score: null,
          tier: null,
          as_of: nowS,
        }),
      ],
    });
    renderPage();
    await screen.findByTestId('scan-table');
    const page = screen.getByTestId('scanner-page');
    // REPLACED 2026-08-06 (owner decision B). This used to assert the page never says "live".
    // Prices ARE live now, so that assertion would force the UI to lie. The property worth
    // keeping is the one underneath it: the page must state BOTH data ages, so nobody reads a
    // 3-minute-old score as a live one — [live-vs-static-isolation] expressed as copy rather
    // than as a ban on a word.
    const text = page.textContent ?? '';
    // Either state is correct — what must never happen is the page going quiet about which
    // one it is in. Under the test's stubbed EventSource the stream never connects, so this
    // legitimately renders the offline variant.
    expect(text, 'the page must state the PRICE state').toMatch(/Prices (live|offline)/);
    expect(text, 'and must not let structure pass as live').toMatch(/structure ~3 min/);
    expect(screen.getAllByTestId('scan-row')).toHaveLength(4);
  });
});
