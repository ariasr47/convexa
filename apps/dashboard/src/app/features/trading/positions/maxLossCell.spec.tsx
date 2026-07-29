/**
 * Component — the `max_loss` TABLE cell (SPEC §4 *The risk slot*, home 3 of 3). Risk-based: the
 * cell answers with EITHER one unsigned figure OR one stated reason, never both, never a bare `—`,
 * never `0`, never the word `Unlimited` alone, and never tinted. Those are the distinctions AC-28 /
 * AC-29 / AC-78 rest on and they are exactly what a well-meaning "let's shorten this" would erase.
 *
 * Driven off the real `PositionView` projection and the shared fixture library — the same objects
 * the running app renders — so a change to the recogniser or the eligible set shows up here.
 */
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  FX_CALENDAR,
  FX_LONG_CALL,
  FX_PROTECTIVE_PUT,
  FX_RATIO_1X2,
  FX_SHORT_CALL,
  FX_SHORT_VERTICAL,
  viewOf,
} from './fixtures';
import { MAX_LOSS_WITHHELD_META } from './labels';
import type { SimPosition } from './leg';
import { cellContent, type RowContext } from './PositionRow';
import type { PositionView } from './view';

function ctxFor(view: PositionView): RowContext {
  return {
    view,
    trend: [],
    sessionDelta: null,
    streamOffline: false,
    onClose: () => undefined,
    onCancel: () => undefined,
  };
}

const renderCell = (p: SimPosition) =>
  render(
    <ThemeProvider theme={themeForPref('dark')}>
      {cellContent('max_loss', ctxFor(viewOf(p)))}
    </ThemeProvider>,
  );

describe('the max_loss table cell', () => {
  it('AC-28 — an eligible structure shows ONE unsigned figure: no +, no −, no decimals', () => {
    renderCell(FX_LONG_CALL); // 1 lot at 12.40 risks the debit paid: 12.40 x 100 = $1240
    const el = screen.getByTestId('cell-max-loss');
    expect(el.textContent).toBe('$1240');
    expect(el.textContent).not.toMatch(/[+−-]/);
  });

  it('AC-28 — a DEFINED-RISK CREDIT structure still shows a figure, not a reason', () => {
    // The short vertical's worst case is the width it cannot escape, less the credit kept.
    renderCell(FX_SHORT_VERTICAL);
    expect(screen.getByTestId('cell-max-loss').textContent).toMatch(/^\$\d+$/);
  });

  it('AC-29 — an unbounded structure shows ONE stated reason, never a figure and never `Unlimited`', () => {
    renderCell(FX_SHORT_CALL);
    expect(screen.getByText(MAX_LOSS_WITHHELD_META.unbounded.label)).toBeTruthy();
    expect(screen.getByText('unlimited risk')).toBeTruthy();
    expect(screen.queryByText('Unlimited')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText('$0')).toBeNull();
  });

  it('AC-29 — a multi-expiry structure and an unnamed shape each state their OWN reason', () => {
    renderCell(FX_CALENDAR);
    expect(screen.getByText('mixed expiries')).toBeTruthy();
    renderCell(FX_RATIO_1X2); // a 1x2 ratio is `custom` — the residue of an exact match
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
    const { container: figure } = renderCell(FX_PROTECTIVE_PUT);
    const { container: reason } = renderCell(FX_SHORT_CALL);
    for (const c of [figure, reason]) {
      expect(c.innerHTML).not.toMatch(/success|error/i);
    }
  });

  it('never renders the literal undefined, null or NaN (AC-26)', () => {
    for (const p of [FX_LONG_CALL, FX_SHORT_CALL, FX_CALENDAR, FX_RATIO_1X2, FX_PROTECTIVE_PUT]) {
      const { container } = renderCell(p);
      expect(container.textContent).not.toMatch(/undefined|null|NaN/);
    }
  });
});
