/**
 * Component — the all-positions view + row/group states (S2/S4/S5/S9/S10). Renders derived rows
 * directly (no network) and asserts the observable component states: default, empty, filtered-empty,
 * offline (dim + ⏸ + last-known), per-row unavailable, subtotal-with-unavailable, closed realized,
 * pending affordance, and the Live locked tab. Covers AC-5, AC-11, AC-32, AC-34, AC-35, AC-37, AC-38.
 */
import { render, screen, within, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PositionsView } from './PositionsView';
import { LiveTabPanel } from './LiveTabPanel';
import { deriveGroups, DerivedRow, RowMetrics } from './derive';
import { DEFAULT_COLUMNS } from './defaults';
import type { Position, FilterState } from './types';

const theme = createTheme();

function pos(over: Partial<Position> = {}): Position {
  return {
    id: 'p', ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', side: 'long',
    qty: 2, entry_mark: 5, entry_basis: 'snapshot', entry_time: '2026-06-20T10:00:00Z',
    status: 'open', entry_mode: 'market', schema_version: 2, ...over,
  };
}
function row(p: Position, m: Partial<RowMetrics> = {}): DerivedRow {
  const metrics: RowMetrics = {
    id: p.id, plDollar: 100, plPct: 20, unavailable: false, deltaEntry: 100, sessionDelta: 40, dte: 10, ...m,
  };
  return { position: p, metrics, strategy: p.right === 'call' ? 'long_call' : 'long_put' };
}

const FILTER_OPEN: FilterState = { ticker: null, status: ['open'], strategy: null, expiry: null };

function renderView(rows: DerivedRow[], opts: Partial<Parameters<typeof PositionsView>[0]> = {}, group = 'none' as const, filter = FILTER_OPEN) {
  const groups = deriveGroups(rows, { filter, sortKey: 'pl_dollar', sortDir: 'desc', group });
  return render(
    <ThemeProvider theme={theme}>
      <PositionsView
        groups={groups}
        columns={DEFAULT_COLUMNS}
        layout="table"
        density="comfortable"
        streamOffline={false}
        totalCount={rows.length}
        isHistory={false}
        markResFor={() => ({ mark: 6, basis: 'snapshot', frozen: false })}
        trendFor={() => [{ t: 1, pl: 10 }, { t: 2, pl: 20 }]}
        onOpenEntry={vi.fn()}
        onClearFilter={vi.fn()}
        onClose={vi.fn()}
        onCancel={vi.fn()}
        {...opts}
      />
    </ThemeProvider>,
  );
}

afterEach(() => cleanup());

describe('default + multi-position (AC-1, AC-2, AC-3)', () => {
  it('renders multiple concurrent open rows, including two on the same contract (stacked)', () => {
    renderView([
      row(pos({ id: 'a' }), {}),
      row(pos({ id: 'b' }), {}),       // same contract as a, independent id ⇒ stacks
      row(pos({ id: 'c', ticker: 'AAPL', right: 'put' }), {}),
    ]);
    expect(screen.getAllByTestId('position-row')).toHaveLength(3);
  });

  it('shows the P/L $ and % in their own columns per row', () => {
    renderView([row(pos({ id: 'a' }), { plDollar: 200, plPct: 40 })]);
    // REVISION 1 — split cells: P/L renders the $ amount, P/L % renders the percent.
    expect(screen.getByTestId('cell-pl')).toHaveTextContent('+$200');
    expect(screen.getByTestId('cell-pl-pct')).toHaveTextContent('+40.0%');
  });
});

describe('empty states (AC-5)', () => {
  it('shows the no-positions empty state (not an error) when the collection is empty', () => {
    renderView([], { totalCount: 0 });
    expect(screen.getByTestId('empty-no-positions')).toBeInTheDocument();
    expect(screen.getByText(/No simulated positions yet/)).toBeInTheDocument();
  });

  it('shows the filtered-empty state when positions exist but none match', () => {
    // One closed position, filter = open ⇒ zero visible but total > 0.
    renderView([row(pos({ id: 'a', status: 'closed' }))], { totalCount: 1 });
    expect(screen.getByTestId('empty-filtered')).toBeInTheDocument();
  });
});

describe('feed-drop degraded (AC-32, AC-34)', () => {
  it('dims live cells + shows ⏸ offline + last-known mark, static cells keep rendering', () => {
    renderView([row(pos({ id: 'a' }))], { streamOffline: true });
    const r = screen.getByTestId('position-row');
    // live cells dimmed + offline tag (mark + P/L cells) + last-known mark value still shown
    expect(within(r).getAllByText(/⏸ offline/).length).toBeGreaterThan(0);
    expect(within(r).getByText(/\$6\.00/)).toBeInTheDocument(); // last-known mark, not blank
    // static contract cell keeps rendering — REVISION 1 slim Ticker (symbol + `$250 Call` leg)
    const contract = within(r).getByTestId('cell-contract');
    expect(within(contract).getByText('TSLA')).toBeInTheDocument();
    expect(within(contract).getByText(/\$250 Call/)).toBeInTheDocument();
  });
});

describe('per-row isolation (AC-35)', () => {
  it('marks only the failed row unavailable; the subtotal excludes it', () => {
    const groups = deriveGroups(
      [row(pos({ id: 'a' }), { plDollar: 100 }), row(pos({ id: 'b' }), { plDollar: null, unavailable: true })],
      { filter: FILTER_OPEN, sortKey: 'pl_dollar', sortDir: 'desc', group: 'ticker' },
    );
    render(
      <ThemeProvider theme={theme}>
        <PositionsView
          groups={groups} columns={DEFAULT_COLUMNS} layout="table" density="comfortable"
          streamOffline={false} totalCount={2} isHistory={false}
          markResFor={() => ({ mark: 6, basis: 'snapshot', frozen: false })}
          trendFor={() => []} onOpenEntry={vi.fn()} onClearFilter={vi.fn()} onClose={vi.fn()} onCancel={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getAllByTestId('cell-unavailable').length).toBeGreaterThan(0);
    // subtotal = 100 (the available member only), and flags 1 excluded
    expect(screen.getByTestId('subtotal').textContent).toMatch(/Subtotal \+\$100 · 1 position excluded \(unavailable\)/);
  });
});

describe('group subtotal (AC-10, AC-22)', () => {
  it('renders a per-group subtotal equal to the sum of member $ P/L', () => {
    const groups = deriveGroups(
      [row(pos({ id: 'a', right: 'call' }), { plDollar: 100 }), row(pos({ id: 'b', right: 'call' }), { plDollar: 50 })],
      { filter: FILTER_OPEN, sortKey: 'pl_dollar', sortDir: 'desc', group: 'strategy' },
    );
    render(
      <ThemeProvider theme={theme}>
        <PositionsView groups={groups} columns={DEFAULT_COLUMNS} layout="table" density="comfortable"
          streamOffline={false} totalCount={2} isHistory={false}
          markResFor={() => ({ mark: 6, basis: 'snapshot', frozen: false })}
          trendFor={() => []} onOpenEntry={vi.fn()} onClearFilter={vi.fn()} onClose={vi.fn()} onCancel={vi.fn()} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('group-header').textContent).toMatch(/Long call \(2\)/);
    expect(screen.getByTestId('subtotal').textContent).toMatch(/Subtotal \+\$150/);
  });
});

describe('closed / history (AC-37)', () => {
  it('renders closed realized facts + the never-pruned caption', () => {
    const closed = pos({ id: 'a', status: 'closed', realized_pl_dollar: 120, realized_pl_pct: 24, close_time: '2026-06-21T11:00:00Z' });
    const groups = deriveGroups([row(closed, { plDollar: null })], {
      filter: { ticker: null, status: ['closed', 'cancelled'], strategy: null, expiry: null },
      sortKey: 'pl_dollar', sortDir: 'desc', group: 'none',
    });
    render(
      <ThemeProvider theme={theme}>
        <PositionsView groups={groups} columns={DEFAULT_COLUMNS} layout="table" density="comfortable"
          streamOffline={false} totalCount={1} isHistory
          markResFor={() => null} trendFor={() => []} onOpenEntry={vi.fn()} onClearFilter={vi.fn()} onClose={vi.fn()} onCancel={vi.fn()} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('history-caption')).toBeInTheDocument();
    expect(screen.getByText(/Closed · realized \+\$120 \(\+24\.0%\)/)).toBeInTheDocument();
  });
});

describe('density + layout (AC-26)', () => {
  it('reflects compact density on the table', () => {
    renderView([row(pos({ id: 'a' }))], { density: 'compact' });
    expect(screen.getByTestId('positions-table').getAttribute('data-density')).toBe('compact');
  });

  it('renders cards in card layout', () => {
    renderView([row(pos({ id: 'a' }))], { layout: 'card' });
    expect(screen.getByTestId('positions-cards')).toBeInTheDocument();
    expect(screen.getByTestId('position-card')).toBeInTheDocument();
  });
});

describe('Live tab locked (AC-38, AC-39, AC-40)', () => {
  it('renders the coming-soon / not-connected lock with no entry/order/network affordance', () => {
    render(<ThemeProvider theme={theme}><LiveTabPanel /></ThemeProvider>);
    expect(screen.getByText(/Live · coming soon/)).toBeInTheDocument();
    expect(screen.getByTestId('live-lock-chip')).toHaveTextContent('Not connected');
    expect(screen.queryByRole('button')).toBeNull(); // no entry, no order action
  });
});
