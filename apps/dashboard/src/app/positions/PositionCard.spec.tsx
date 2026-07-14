/**
 * Component — PositionCard (convexa-redesign · Positions, Figma `108:58`). Asserts the contract's
 * required cases ("PositionCard: renders ticker/sub/strategy/P-L/P-L%/sparkline; direction drives P/L
 * color") + the card's component states (default/offline/closed/pending) + the live-vs-static isolation
 * invariant. Renders the card directly off a derived row — no network.
 */
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/shared/theme/theme';
import { PositionCard } from './PositionCard';
import type { RowContext } from './PositionRow';
import type { DerivedRow, RowMetrics } from './derive';
import type { Position } from './types';

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

function renderCard(r: DerivedRow, over: Partial<RowContext> = {}, streamOffline = false) {
  const ctx = ctxFor(r, { ...over, streamOffline });
  return render(
    <ThemeProvider theme={theme}>
      <PositionCard row={r} ctx={ctx} streamOffline={streamOffline} onClose={ctx.onClose} />
    </ThemeProvider>,
  );
}

afterEach(() => cleanup());

describe('PositionCard — default content', () => {
  it('renders ticker, leg sub, strategy chip, P/L, P/L %, and a sparkline', () => {
    renderCard(row(pos(), { plDollar: 200, plPct: 40 }));
    const card = screen.getByTestId('position-card');
    expect(within(card).getByText('TSLA')).toBeInTheDocument(); // ticker (bold mono)
    expect(within(card).getByText(/\$250 Call/)).toBeInTheDocument(); // leg sub
    expect(within(card).getByText('Long call')).toBeInTheDocument(); // strategy chip
    const plBlock = within(card).getByTestId('card-pl');
    expect(plBlock).toHaveTextContent('+$200'); // P/L $
    expect(plBlock).toHaveTextContent('+40.0%'); // P/L %
    expect(within(card).getByTestId('trend-sparkline')).toBeInTheDocument();
  });

  it('renders the Qty/Entry/Mark footer with bold-mono values', () => {
    renderCard(row(pos({ qty: 3, entry_mark: 8.4 })));
    const card = screen.getByTestId('position-card');
    expect(within(card).getByText(/Qty/)).toBeInTheDocument();
    expect(within(card).getByText('3')).toBeInTheDocument();
    expect(within(card).getByText(/Entry/)).toBeInTheDocument();
    expect(within(card).getByText('$8.40')).toBeInTheDocument();
    const mark = within(card).getByTestId('card-mark');
    expect(mark).toHaveTextContent('$6.00');
  });
});

describe('PositionCard — direction drives P/L color', () => {
  // The theme uses CSS variables (cssVariables: true) ⇒ `success.main`/`error.main` resolve to the
  // `--mui-palette-*-main` custom property rather than the raw rgb literal.
  it('uses success.main for a positive P/L', () => {
    renderCard(row(pos(), { plDollar: 150 }));
    const value = within(screen.getByTestId('card-pl')).getByText('+$150');
    expect(value).toHaveStyle({ color: 'var(--mui-palette-success-main)' });
  });

  it('uses error.main for a negative P/L', () => {
    renderCard(row(pos(), { plDollar: -75, plPct: -15 }));
    const value = within(screen.getByTestId('card-pl')).getByText('−$75');
    expect(value).toHaveStyle({ color: 'var(--mui-palette-error-main)' });
  });
});

describe('PositionCard — degraded / isolation states', () => {
  it('dims the live P/L block + Mark on an SSE drop while static facts persist', () => {
    renderCard(row(pos({ entry_mark: 8.4 })), {}, true);
    const card = screen.getByTestId('position-card');
    expect(within(card).getByTestId('card-pl')).toHaveStyle({ opacity: '0.5' });
    expect(within(card).getByTestId('card-mark')).toHaveStyle({ opacity: '0.5' });
    // static facts keep rendering (never blank)
    expect(within(card).getByText('TSLA')).toBeInTheDocument();
    expect(within(card).getByText('$8.40')).toBeInTheDocument();
  });

  it('renders the closed realized summary for a terminal position', () => {
    const closed = pos({
      status: 'closed',
      realized_pl_dollar: 120,
      realized_pl_pct: 24,
      close_time: '2026-06-21T11:00:00Z',
    });
    renderCard(row(closed, { plDollar: null }));
    expect(screen.getByText(/Closed · realized \+\$120 \(\+24\.0%\)/)).toBeInTheDocument();
  });

  it('renders the pending limit affordance (waiting + Cancel) and the limit Mark', () => {
    const pending = pos({ status: 'pending', entry_mode: 'limit', limit_price: 4.5 });
    renderCard(row(pending, { plDollar: null }));
    expect(screen.getByTestId('pending-affordance')).toBeInTheDocument();
    expect(within(screen.getByTestId('card-mark'))).toBeTruthy();
    expect(screen.getByTestId('card-mark')).toHaveTextContent('limit $4.50');
  });
});
