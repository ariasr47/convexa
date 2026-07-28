/**
 * Component — the `max_loss` TABLE cell (SPEC §4 *The risk slot*, home 3 of 3). Risk-based: the
 * cell answers with EITHER one unsigned figure OR one stated reason, never both, never a bare `—`,
 * never `0`, never the word `Unlimited` alone, and never tinted. Those are the distinctions AC-28 /
 * AC-29 / AC-78 rest on and they are exactly what a well-meaning "let's shorten this" would erase.
 *
 * The cell is currently INERT — `max_loss` is deliberately absent from `FIGMA_COLUMNS` pending F11's
 * fit checkpoint (see the note there) — so this is the only thing exercising it. It must not rot.
 */
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DerivedRow } from './derive';
import { rowOfLegacy } from './fixtures';
import { MAX_LOSS_WITHHELD_META } from './labels';
import { cellContent, type RowContext } from './PositionRow';
import type { Position } from './types';

function pos(over: Partial<Position> = {}): Position {
  return {
    id: 'p-1',
    ticker: 'TSLA',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    side: 'long',
    qty: 2,
    entry_mark: 12.4,
    entry_basis: 'snapshot',
    entry_time: '2026-06-12T15:32:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 2,
    ...over,
  };
}

function ctxFor(row: DerivedRow): RowContext {
  return {
    row,
    markRes: null,
    trend: [],
    streamOffline: false,
    onClose: () => undefined,
    onCancel: () => undefined,
  };
}

const rowFor = (p: Position, structure: DerivedRow['structure']): DerivedRow => ({
  // The projection comes from a VALID lift; `position`/`structure` are overridden per case so the
  // transitional bridge (`maxLossOfLegacy`) can still be driven through its reason branches.
  view: rowOfLegacy(pos()).view,
  position: p,
  structure,
  metrics: {
    id: p.id,
    plDollar: null,
    plPct: null,
    unavailable: true,
    deltaEntry: null,
    sessionDelta: null,
    dte: null,
  },
});

const renderCell = (row: DerivedRow) =>
  render(
    <ThemeProvider theme={themeForPref('dark')}>
      {cellContent('max_loss', ctxFor(row))}
    </ThemeProvider>,
  );

describe('the max_loss table cell', () => {
  it('AC-28 — an eligible structure shows ONE unsigned figure: no +, no −, no decimals', () => {
    renderCell(rowFor(pos({ qty: 2, entry_mark: 12.4 }), 'long_call'));
    // A 2-lot long call at 12.40 risks the debit paid: 12.40 x 100 x 2 = $2480.
    const el = screen.getByText('$2480');
    expect(el).toBeTruthy();
    expect(el.textContent).not.toMatch(/[+−-]/);
  });

  it('AC-29 — an unbounded structure shows ONE stated reason, never a figure and never `Unlimited`', () => {
    renderCell(rowFor(pos(), 'short_call'));
    expect(screen.getByText(MAX_LOSS_WITHHELD_META.unbounded.label)).toBeTruthy();
    expect(screen.getByText('unlimited risk')).toBeTruthy();
    expect(screen.queryByText('Unlimited')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText('$0')).toBeNull();
  });

  it('AC-29 — a multi-expiry structure and an unnamed shape each state their OWN reason', () => {
    renderCell(rowFor(pos(), 'calendar'));
    expect(screen.getByText('mixed expiries')).toBeTruthy();
    renderCell(rowFor(pos(), 'custom'));
    expect(screen.getByText('unnamed shape')).toBeTruthy();
  });

  it('the three withheld labels stay DISTINCT — none is a prefix of another', () => {
    const labels = Object.values(MAX_LOSS_WITHHELD_META).map((m) => m.label);
    expect(new Set(labels).size).toBe(3);
    for (const a of labels) {
      for (const b of labels) {
        if (a !== b) expect(a.startsWith(b)).toBe(false);
      }
    }
  });

  it('AC-78 — the risk slot carries NO tint: neither the figure nor the reason is success/error', () => {
    const { container: figure } = renderCell(rowFor(pos(), 'long_call'));
    const { container: reason } = renderCell(rowFor(pos(), 'short_call'));
    for (const c of [figure, reason]) {
      expect(c.innerHTML).not.toMatch(/success|error/i);
    }
  });

  it('never renders the literal undefined, null or NaN (AC-26)', () => {
    for (const kind of ['long_call', 'short_call', 'calendar', 'custom'] as const) {
      const { container } = renderCell(rowFor(pos(), kind));
      expect(container.textContent).not.toMatch(/undefined|null|NaN/);
    }
  });

  it('a record too damaged to lift withholds rather than printing a number', () => {
    const broken = rowFor({ ...pos(), id: '' } as Position, 'custom');
    const { container } = renderCell(broken);
    expect(container.textContent).toBe(MAX_LOSS_WITHHELD_META.unnamed_shape.label);
  });
});
