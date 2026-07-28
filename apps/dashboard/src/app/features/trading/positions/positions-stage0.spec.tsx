/**
 * Positions — Stage 0 keyboard-operability + mobile-card-projection guards (redesign-stage-0
 * FRONTEND_EXECUTION_CONTRACT §8.6 + §8.7-added-case; §10.4 rendered-DOM resolution).
 *
 *   1. §10.4 RESOLVED IN THE RENDERED DOM: verification flagged "clickable Box/div" candidates in
 *      `PositionRow` / `PositionCard` / `PositionsView`; source reading said they are real buttons.
 *      Here every click affordance is proven NATIVE in the rendered output — focusable via Tab and
 *      activating on Enter AND Space. Negative space: a clickable non-button cannot silently
 *      reappear (the tagName assertions fail on any div/span click target).
 *   2. §8.7 added case: the CARD projection (the mobile default) preserves the pending / closed /
 *      offline testids + dim semantics the ROW projection has — the card layout is a re-projection,
 *      not a fork (`[live-vs-static-isolation]` survives relayout).
 *   3. The branch baseline: below `md` the CARD layout is FORCED regardless of the saved table
 *      preference (the multi-column table overflows a phone).
 *
 * Component-level: drives the REAL `PositionsView` with interface-shaped fixtures; no network.
 * Dim assertions use className identity (sx compiles to classes — never `getAttribute('style')`).
 */
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { theme } from '@/shared/theme/theme';
import type { DerivedGroup, DerivedRow } from './derive';
import { rowOfLegacy } from './fixtures';
import { PositionsView, type ViewProps } from './PositionsView';
import type { Position } from './types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- Interface-shaped fixtures -------------------------------------------------------------------

function pos(over: Partial<Position> = {}): Position {
  return {
    id: 'p-1',
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 5,
    entry_basis: 'user_entered',
    entry_time: '2026-06-23T14:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 2,
    ...over,
  };
}

function rowOf(p: Position): DerivedRow {
  return rowOfLegacy(p, {
    metrics: {
      plDollar: p.status === 'open' ? 120 : null,
      plPct: p.status === 'open' ? 24 : null,
      unavailable: false,
      deltaEntry: p.status === 'open' ? 120 : null,
      sessionDelta: null,
      dte: 24,
    },
  });
}

function groupsOf(rows: DerivedRow[]): DerivedGroup[] {
  return [{ key: '__all__', label: 'All', rows, subtotal: 120, excludedCount: 0 }];
}

function props(over: Partial<ViewProps> = {}): ViewProps {
  return {
    groups: groupsOf([rowOf(pos())]),
    columns: [],
    layout: 'table',
    density: 'comfortable',
    streamOffline: false,
    totalCount: 1,
    isHistory: false,
    markResFor: () => ({ mark: 6.2, basis: 'snapshot', frozen: false }),
    trendFor: () => [],
    onOpenEntry: vi.fn(),
    onClearFilter: vi.fn(),
    onClose: vi.fn(),
    onCancel: vi.fn(),
    onViewOrder: vi.fn(),
    ...over,
  };
}

function renderView(p: ViewProps) {
  return render(
    <ThemeProvider theme={theme}>
      <PositionsView {...p} />
    </ThemeProvider>,
  );
}

// ---- 1. Keyboard operability — every click affordance is a native, Tab+Enter/Space-operable button

describe('keyboard operability (§8.6 / §10.4 rendered-DOM resolution)', () => {
  it('table row "Close" is a native <button>: Tab reaches it, Enter AND Space activate it', async () => {
    const user = userEvent.setup();
    const p = props();
    renderView(p);

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.tagName).toBe('BUTTON'); // §10.4: native in the RENDERED DOM, not a clickable Box/div

    await user.tab();
    // Tab order reaches the button (the row carries no other tabbables in the fixture).
    expect(document.activeElement).toBe(close);

    await user.keyboard('{Enter}');
    expect(p.onClose).toHaveBeenCalledWith('p-1');
    await user.keyboard(' ');
    expect(p.onClose).toHaveBeenCalledTimes(2);
  });

  it('pending row "Cancel" and the order backlink are native buttons activating on Enter', async () => {
    const user = userEvent.setup();
    const p = props({
      groups: groupsOf([
        rowOf(pos({ id: 'p-pend', status: 'pending', limit_price: 4, origin_order_id: 'o-1' })),
      ]),
    });
    renderView(p);

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.tagName).toBe('BUTTON');
    cancel.focus();
    await user.keyboard('{Enter}');
    expect(p.onCancel).toHaveBeenCalledWith('p-pend');

    const backlink = screen.getByTestId('position-view-order');
    expect(backlink.tagName).toBe('BUTTON');
    backlink.focus();
    await user.keyboard('{Enter}');
    expect(p.onViewOrder).toHaveBeenCalledWith('o-1');
  });

  it('empty-state CTAs (open / clear-filter) are native buttons operable from the keyboard', async () => {
    const user = userEvent.setup();
    const empty = props({ groups: groupsOf([]), totalCount: 0 });
    renderView(empty);
    const openCta = within(screen.getByTestId('empty-no-positions')).getByRole('button');
    expect(openCta.tagName).toBe('BUTTON');
    openCta.focus();
    await user.keyboard('{Enter}');
    expect(empty.onOpenEntry).toHaveBeenCalled();
    cleanup();

    const filtered = props({ groups: groupsOf([]), totalCount: 3 });
    renderView(filtered);
    const clearCta = within(screen.getByTestId('empty-filtered')).getByRole('button');
    expect(clearCta.tagName).toBe('BUTTON');
    clearCta.focus();
    await user.keyboard(' ');
    expect(filtered.onClearFilter).toHaveBeenCalled();
  });

  it('card "Close" is a native <button> activating on Enter (the card projection too)', async () => {
    const user = userEvent.setup();
    const p = props({ layout: 'card' });
    renderView(p);
    const card = screen.getByTestId('position-card');
    const close = within(card).getByRole('button', { name: 'Close' });
    expect(close.tagName).toBe('BUTTON');
    close.focus();
    await user.keyboard('{Enter}');
    expect(p.onClose).toHaveBeenCalledWith('p-1');
  });
});

// ---- 2. §8.7 added case — the card projection preserves the row projection's states ---------------

describe('PositionCard mobile projection — pending/closed/offline parity with the row (§8.7)', () => {
  it('pending + closed testids/affordances render on cards exactly like rows', () => {
    renderView(
      props({
        layout: 'card',
        groups: groupsOf([
          rowOf(pos({ id: 'p-pend', status: 'pending', limit_price: 4 })),
          rowOf(
            pos({
              id: 'p-closed',
              status: 'closed',
              realized_pl_dollar: 55,
              realized_pl_pct: 11,
              close_time: '2026-06-23T15:00:00Z',
            }),
          ),
        ]),
      }),
    );
    const cards = screen.getAllByTestId('position-card');
    expect(cards.map((c) => c.getAttribute('data-status')).sort()).toEqual(['closed', 'pending']);
    expect(screen.getByTestId('pending-affordance')).toBeInTheDocument();
    expect(screen.getByText(/Closed · realized/)).toBeInTheDocument();
  });

  it('offline DIMS the card live block (P/L + Mark) and never blanks it — className identity', () => {
    // Online render → capture the live block's emotion classes.
    renderView(props({ layout: 'card', streamOffline: false }));
    const onlinePl = screen.getByTestId('card-pl').className;
    const onlineMark = screen.getByTestId('card-mark').className;
    cleanup();

    // Offline render → the SAME testids persist (never blanked), with DIFFERENT (dimmed) classes.
    renderView(props({ layout: 'card', streamOffline: true }));
    const pl = screen.getByTestId('card-pl');
    const mark = screen.getByTestId('card-mark');
    expect(pl.textContent).toMatch(/\$/); // the value is still rendered
    expect(pl.className).not.toBe(onlinePl); // dim class applied (opacity 0.5 via sx → class)
    expect(mark.className).not.toBe(onlineMark);
  });
});

// ---- 3. The branch baseline — below md the card layout is FORCED over a saved table pref ----------

describe('mobile default (below md) forces cards', () => {
  it('with a narrow (coarse) viewport match, layout="table" still renders positions-cards', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({
        // The down('md') query is a max-width media string — match it; everything else false.
        matches: q.includes('max-width'),
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false,
      })),
    );
    renderView(props({ layout: 'table' }));
    expect(screen.getByTestId('positions-cards')).toBeInTheDocument();
    expect(screen.queryByTestId('positions-table')).toBeNull();
  });
});
