/**
 * Component — the leg disclosure (SPEC §4 *The leg disclosure*, Design direction ¶2/¶3; AC-36,
 * AC-80).
 *
 * Risk-based. Three things here regress silently and are invisible to a screenshot:
 *   1. EPHEMERALITY — expanding is a READ; a durable write here would put viewport state into the
 *      saved view and survive a reload (AC-36, AC-80);
 *   2. a leg that failed to price losing its own `unavailable`, or the max-loss assumption / the
 *      withheld reason disappearing from the panel;
 *   3. the disclosure gaining decorative motion.
 *
 * Copy, the left rule's look and the leg ordering are visible + intentional ⇒ review-class.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedGroup } from './derive';
import { FX_CALENDAR, FX_IRON_CONDOR, FX_MARK, FX_SHORT_VERTICAL, viewOf } from './fixtures';
import { MAX_LOSS_ASSUMPTION, MAX_LOSS_WITHHELD_META } from './labels';
import type { LegId } from './leg';
import { PositionsView, type ViewProps } from './PositionsView';
import type { PositionView } from './view';

function groupsOf(views: PositionView[]): DerivedGroup[] {
  return [{ key: '__all__', label: 'All', views, subtotal: 0, excludedCount: 0 }];
}

function props(views: PositionView[], over: Partial<ViewProps> = {}): ViewProps {
  return {
    groups: groupsOf(views),
    columns: [],
    layout: 'table',
    density: 'comfortable',
    streamOffline: false,
    totalCount: views.length,
    isHistory: false,
    trendFor: () => [],
    onOpenEntry: vi.fn(),
    onClearFilter: vi.fn(),
    onClose: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
}

function renderRows(views: PositionView[], over: Partial<ViewProps> = {}) {
  return render(
    <ThemeProvider theme={themeForPref('dark')}>
      <PositionsView {...props(views, over)} />
    </ThemeProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('the leg disclosure', () => {
  it('a leg that failed to price says so ON ITS OWN LINE while resolved legs still show their marks', async () => {
    const user = userEvent.setup();
    const [first, ...rest] = FX_IRON_CONDOR.legs;
    const marks = new Map<LegId, MarkResult | null>([
      [first.id, null],
      ...rest.map((l) => [l.id, FX_MARK] as const),
    ]);
    renderRows([viewOf(FX_IRON_CONDOR, { marks })]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));

    const legMarks = screen.getAllByTestId('leg-mark').map((n) => n.textContent);
    expect(legMarks.filter((t) => t === 'unavailable')).toHaveLength(1);
    expect(legMarks.filter((t) => t?.startsWith('$'))).toHaveLength(3);
    // …while the AGGREGATE is withheld: per-leg truth visible, position P/L not.
    expect(screen.getAllByTestId('cell-unavailable').length).toBeGreaterThan(0);
  });

  it('AC-36/AC-80 — expanding is a READ: nothing is written to storage and nothing re-fetches', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    localStorage.setItem('probe', 'sentinel');
    renderRows([viewOf(FX_SHORT_VERTICAL)]);
    const before = JSON.stringify({ ...localStorage });

    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    await user.click(screen.getByTestId('leg-disclosure-toggle'));

    expect(JSON.stringify({ ...localStorage })).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('renders the max-loss ASSUMPTION when a figure exists, and the reason`s own words when it does not', async () => {
    const user = userEvent.setup();
    renderRows([viewOf(FX_SHORT_VERTICAL)]); // a defined-risk credit spread ⇒ a figure
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    expect(screen.getByTestId('leg-max-loss-note').textContent).toBe(MAX_LOSS_ASSUMPTION);
    cleanup();

    // A calendar's legs do not expire together ⇒ withheld, with its OWN stated reason, never the
    // assumption sentence and never a bare blank.
    renderRows([viewOf(FX_CALENDAR)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    expect(screen.getByTestId('leg-max-loss-note').textContent).toBe(
      MAX_LOSS_WITHHELD_META.multi_expiration.tip,
    );
    expect(screen.getByTestId('leg-max-loss-note').textContent).not.toBe(MAX_LOSS_ASSUMPTION);
  });

  it('is INSTANT — no animation, no transition, no accordion on the panel', async () => {
    const user = userEvent.setup();
    renderRows([viewOf(FX_SHORT_VERTICAL)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    const panel = screen.getByTestId('leg-disclosure-panel');
    const cs = getComputedStyle(panel);
    expect(cs.transitionProperty === '' || cs.transitionProperty === 'all').toBe(true);
    expect(cs.animationName === '' || cs.animationName === 'none').toBe(true);
    // MUI's Collapse/Accordion would show up as a wrapper class; none exists on this path.
    expect(panel.closest('.MuiCollapse-root')).toBeNull();
    expect(panel.closest('.MuiAccordion-root')).toBeNull();
  });
});
