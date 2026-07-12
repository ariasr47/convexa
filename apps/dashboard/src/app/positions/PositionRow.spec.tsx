/**
 * Component — PositionRow (convexa-redesign · Positions, Figma `106:52`). Asserts the contract's
 * required case ("PositionRow: column set + mono/Inter typography + direction color") + the row's
 * states (default/offline/closed/pending). Renders the row inside a <table> so the <tr>/<td>s are
 * valid; drives off a derived row — no network.
 */
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../theme';
import { typographyTokens } from '../tokens';
import type { RowContext } from './PositionRow';
import { PositionRow } from './PositionRow';
import type { DerivedRow, RowMetrics } from './derive';
import type { ColumnKey, Position } from './types';

const FIGMA_COLUMNS: ColumnKey[] = [
  'contract',
  'strategy',
  'qty',
  'entry',
  'mark',
  'pl',
  'pl_pct',
  'delta_entry',
  'trend',
  'expiry',
];

function pos(over: Partial<Position> = {}): Position {
  return {
    id: 'p',
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 2,
    entry_mark: 5,
    entry_basis: 'snapshot',
    entry_time: '2026-06-20T10:00:00Z',
    status: 'open',
    entry_mode: 'market',
    schema_version: 2,
    ...over,
  };
}
function row(p: Position, m: Partial<RowMetrics> = {}): DerivedRow {
  const metrics: RowMetrics = {
    id: p.id,
    plDollar: 100,
    plPct: 20,
    unavailable: false,
    deltaEntry: 100,
    sessionDelta: 40,
    dte: 10,
    ...m,
  };
  return { position: p, metrics, strategy: p.right === 'call' ? 'long_call' : 'long_put' };
}
function ctxFor(r: DerivedRow, over: Partial<RowContext> = {}): RowContext {
  return {
    row: r,
    markRes: { mark: 6, basis: 'snapshot', frozen: false },
    trend: [
      { t: 1, pl: 10 },
      { t: 2, pl: 20 },
    ],
    streamOffline: false,
    onClose: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
}

function renderRow(r: DerivedRow, over: Partial<RowContext> = {}, streamOffline = false) {
  const ctx = ctxFor(r, { ...over, streamOffline });
  return render(
    <ThemeProvider theme={theme}>
      <table>
        <tbody>
          <PositionRow ctx={ctx} columns={FIGMA_COLUMNS} tdPad="12px" onClose={ctx.onClose} />
        </tbody>
      </table>
    </ThemeProvider>,
  );
}

afterEach(() => cleanup());

describe('PositionRow — column set + typography', () => {
  it('renders one td per column + a trailing actions td', () => {
    renderRow(row(pos()));
    const r = screen.getByTestId('position-row');
    // 10 Figma columns + the trailing actions cell.
    expect(within(r).getAllByRole('cell')).toHaveLength(FIGMA_COLUMNS.length + 1);
  });

  it('renders the slim Ticker cell (bold mono symbol + leg) and the split P/L cells', () => {
    renderRow(row(pos(), { plDollar: 200, plPct: 40 }));
    const r = screen.getByTestId('position-row');
    const contract = within(r).getByTestId('cell-contract');
    expect(within(contract).getByText('TSLA')).toBeInTheDocument();
    expect(within(contract).getByText(/\$250 Call/)).toBeInTheDocument();
    expect(within(r).getByTestId('cell-pl')).toHaveTextContent('+$200');
    expect(within(r).getByTestId('cell-pl-pct')).toHaveTextContent('+40.0%');
  });

  it('numeric cells use the mono font family', () => {
    renderRow(row(pos()));
    const entry = within(screen.getByTestId('position-row')).getByTestId('cell-entry');
    expect(entry).toHaveStyle({ fontFamily: typographyTokens.monoFontFamily });
  });
});

describe('PositionRow — direction color', () => {
  // cssVariables: true ⇒ palette colors resolve to the `--mui-palette-*-main` custom property.
  it('colors a positive P/L success.main and a negative P/L error.main', () => {
    const { unmount } = renderRow(row(pos(), { plDollar: 120 }));
    expect(within(screen.getByTestId('cell-pl')).getByText('+$120')).toHaveStyle({
      color: 'var(--mui-palette-success-main)',
    });
    unmount();
    renderRow(row(pos(), { plDollar: -60 }));
    expect(within(screen.getByTestId('cell-pl')).getByText('−$60')).toHaveStyle({
      color: 'var(--mui-palette-error-main)',
    });
  });
});

describe('PositionRow — states + actions', () => {
  it('dims live cells + shows ⏸ offline + last-known mark while static cells persist (offline)', () => {
    renderRow(row(pos()), {}, true);
    const r = screen.getByTestId('position-row');
    expect(within(r).getAllByText(/⏸ offline/).length).toBeGreaterThan(0);
    expect(within(r).getByText(/\$6\.00/)).toBeInTheDocument(); // last-known mark, not blank
    expect(within(within(r).getByTestId('cell-contract')).getByText('TSLA')).toBeInTheDocument();
  });

  it('renders the Close action on an open row and calls onClose', async () => {
    const onClose = vi.fn();
    renderRow(row(pos({ id: 'x' })), { onClose });
    const btn = within(screen.getByTestId('position-row')).getByRole('button', { name: 'Close' });
    btn.click();
    expect(onClose).toHaveBeenCalledWith('x');
  });

  it('renders the pending affordance for a resting limit and the closed summary for a terminal row', () => {
    const { unmount } = renderRow(
      row(pos({ status: 'pending', entry_mode: 'limit', limit_price: 4.5 }), { plDollar: null }),
    );
    expect(screen.getByTestId('pending-affordance')).toBeInTheDocument();
    unmount();
    renderRow(
      row(
        pos({
          status: 'closed',
          realized_pl_dollar: 90,
          realized_pl_pct: 18,
          close_time: '2026-06-21T11:00:00Z',
        }),
        { plDollar: null },
      ),
    );
    expect(screen.getByText(/Closed · realized \+\$90/)).toBeInTheDocument();
  });
});
