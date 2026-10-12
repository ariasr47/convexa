/**
 * `/scanner` — RISK-BASED suite (per `.claude/agents/qa-verify.md` §4 as amended 2026-07-13, and the
 * enumerated set in `UX_BLUEPRINT.md` §6). NOT one test per AC. We test only what can regress
 * SILENTLY and INVISIBLY:
 *
 *   1. the closed status/tier/regime lookups (a miss that GUESSES looks fine on screen),
 *   2. the honesty invariants — `stale` keeps a frozen price WITH its stamp, `building` fabricates
 *      no score and makes no freshness claim, `null` renders `—` and never `0`,
 *   3. per-row isolation — one `error` row never takes its neighbours with it,
 *   4. `[no-real-order-path]` — a row/card is a LINK to the ticker page and nothing else,
 *   5. the four page states + the worker-down degrade (Task 7 batch),
 *   6. structural negative space — no "live", no stream primitive (Task 7 batch, mutation-guarded).
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
import { theme } from '@/shared/theme/theme';
import type { ScanRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScanCardList } from './ScanCard';
import { ScanTable } from './ScanTable';
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
          priceOffline={() => null}
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
          <ScanCardList rows={rows} nowS={NOW} flashActive priceOffline={() => null} />
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
            priceOffline={() => null}
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
  /** no-vendor-production-posture B4/F3: `/api/scan`'s top-level mode. Defaults `'live'` (unchanged
   *  shipped behavior) — a test opts in to `'paused'` explicitly. */
  marketData?: 'live' | 'paused';
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
    market_data: opts.marketData ?? 'live',
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

  // no-vendor-production-posture AC-7.
  it('AC-7: paused replaces the cadence line with the honest paused fact; live keeps today’s line', async () => {
    const nowS = Date.now() / 1000;
    const lastSweptEpochS = Date.UTC(2026, 8, 16, 15, 0, 0) / 1000; // 2026-09-16, mid-day ET too
    installScanBackend({
      marketData: 'paused',
      sweep: { updated_at: nowS - 5, sweep_last_completed: lastSweptEpochS, universe_size: 2 },
    });
    const { unmount } = renderPage();
    const paused = await screen.findByTestId('scan-worker-down');
    expect(paused).toHaveTextContent('Market data paused · showing the last board, from Sep 16');
    expect(paused).not.toHaveTextContent('Sweep last ran');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(2); // the rows are UNCHANGED
    unmount();

    // Live, with the SAME behind heartbeat that would otherwise engage the worker-down banner,
    // keeps today's line byte-for-byte — this feature changes nothing about live mode.
    installScanBackend({
      marketData: 'live',
      sweep: { updated_at: nowS - 900, sweep_last_completed: nowS - 180, universe_size: 2 },
    });
    renderPage();
    expect(await screen.findByTestId('scan-worker-down')).toHaveTextContent(
      'Sweep last ran 3 min ago — showing the last known rows.',
    );
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
    // T5 (curvature-v2-surfaces PLAN FE-4) — this pin used to read `/Prices (live|offline)/`,
    // which stayed GREEN across the D-A header rewrite because this render legitimately hits the
    // OFFLINE arm (jsdom has no `EventSource`, so `useLivePrices` flips `offline` immediately) —
    // recorded run-before/run-after below. Strengthened to pin the offline arm's exact string, so
    // a future header change cannot silently drift it either.
    const text = page.textContent ?? '';
    expect(text, 'the offline header is byte-identical (D-A leaves it untouched)').toMatch(
      'Prices offline · showing last known · structure ~3 min',
    );
    expect(text, 'and must not let structure pass as live').toMatch(/structure ~3 min/);
    expect(screen.getAllByTestId('scan-row')).toHaveLength(4);
  });
});
