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
import { ThemeProvider } from '@mui/material/styles';
import type { ScanRow } from '@org/api';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GateApi } from '@/features/auth/useGate';
import { theme } from '@/shared/theme/theme';
import { ScanCardList } from './ScanCard';
import { ScanTable } from './ScanTable';
import { ScanToolbar } from './ScanToolbar';
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

afterEach(() => cleanup());

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
    expect(within(row).getByTestId('cell-updated')).toHaveTextContent('Updated 42s ago');
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
    for (const id of ['cell-score', 'cell-dist-flip', 'cell-dist-wall', 'cell-regime', 'cell-vol']) {
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
    expect(within(row).getByTestId('cell-updated')).toHaveTextContent('Updated 10m ago');
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
    const onSave = vi.fn(async () => true);
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
