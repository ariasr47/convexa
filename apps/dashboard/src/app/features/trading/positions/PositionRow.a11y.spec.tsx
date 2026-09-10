import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PositionCard } from './PositionCard';

afterEach(() => cleanup());

describe('position trend help semantics', () => {
  it('uses a named non-SVG help wrapper and keeps SVG decorative', () => {
    const view = {
      position: { id: 'p', ticker: 'SPY', status: 'open', legs: [{ leg_id: 'l' }] },
      legs: [],
      structure: 'custom',
      structure_line_full: 'Custom',
      structure_line_collapsed: 'Custom',
      pl_dollar: 1,
      pl_pct: { kind: 'value', value: 1 },
      mark: { unavailable: true, net_mark: null },
      nearest_expiration: null,
      expiration_count: 0,
      net_entry_cost: 1,
      net_entry_basis: 'net_debit',
      max_loss: { kind: 'withheld', reason: 'unnamed_shape' },
    } as any;
    const ctx = {
      view,
      trend: [{ pl: 1 }, { pl: 2 }],
      sessionDelta: 0,
      streamOffline: false,
    } as any;
    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <PositionCard view={view} ctx={ctx} streamOffline={false} onClose={() => undefined} />
      </ThemeProvider>,
    );
    const help = screen.getByTestId('trend-help');
    // GATE Z — latent duplicate of the FE-5 regression (`5c07dc40`): `trend-help` must be a
    // positioned containing block, or its visually-hidden `aria-describedby` sibling (`position:
    // 'absolute'`) escapes to the initial containing block instead of staying local — invisible
    // but not clipped by `positions-table-frame`'s `overflow-x: auto` (the exact mechanism that
    // widened `document.documentElement.scrollWidth` at 900px before the original fix).
    expect(getComputedStyle(help).position).toBe('relative');
    help.focus();
    expect(help).toHaveFocus();
    expect(screen.getByTestId('trend-help').querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByTestId('trend-help').querySelector('svg')).toHaveAttribute(
      'focusable',
      'false',
    );
    fireEvent.mouseOver(help);
    const descriptionId = help.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? '')).toHaveTextContent(/trend/i);
  });
});
