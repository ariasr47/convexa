/**
 * Component — the leg disclosure (SPEC §4 *The leg disclosure*, Design direction ¶2/¶3; AC-12,
 * AC-35, AC-36, AC-37, AC-79, AC-80).
 *
 * Risk-based. Five things here regress silently and are invisible to a screenshot:
 *   1. the disclosure APPEARING for a single-leg position (it must not exist at all);
 *   2. an ACTION creeping into a leg line — Close/Cancel per leg is exactly the model this feature
 *      rejects, and a stray button would look harmless in review;
 *   3. a per-leg P/L column returning — it invites the partial-sum reading the all-or-nothing rule
 *      bans (the accessory cut, SPEC §4.5);
 *   4. EPHEMERALITY — expanding is a READ; a durable write here would put viewport state into the
 *      saved view and survive a reload (AC-36, AC-80);
 *   5. the `aria-expanded`/`aria-controls` pair rotting into a dangling reference.
 *
 * Copy, the left rule's look and the leg ordering are visible + intentional ⇒ review-class.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedGroup, DerivedRow } from './derive';
import {
  FX_CALENDAR,
  FX_IRON_CONDOR,
  FX_LONG_CALL,
  FX_MARK,
  FX_SHORT_CALL,
  FX_SHORT_VERTICAL,
  rowOfSim,
} from './fixtures';
import { MAX_LOSS_ASSUMPTION, MAX_LOSS_WITHHELD_META } from './labels';
import type { LegId } from './leg';
import { PositionsView, type ViewProps } from './PositionsView';

function groupsOf(rows: DerivedRow[]): DerivedGroup[] {
  return [{ key: '__all__', label: 'All', rows, subtotal: 0, excludedCount: 0 }];
}

function props(rows: DerivedRow[], over: Partial<ViewProps> = {}): ViewProps {
  return {
    groups: groupsOf(rows),
    columns: [],
    layout: 'table',
    density: 'comfortable',
    streamOffline: false,
    totalCount: rows.length,
    isHistory: false,
    trendFor: () => [],
    onOpenEntry: vi.fn(),
    onClearFilter: vi.fn(),
    onClose: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
}

function renderRows(rows: DerivedRow[], over: Partial<ViewProps> = {}) {
  return render(
    <ThemeProvider theme={themeForPref('dark')}>
      <PositionsView {...props(rows, over)} />
    </ThemeProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('the leg disclosure', () => {
  it('AC-35 — appears ONLY when a position has more than one leg', () => {
    renderRows([rowOfSim(FX_LONG_CALL), rowOfSim(FX_SHORT_CALL)]);
    expect(screen.queryByTestId('leg-disclosure-toggle')).toBeNull();
    expect(screen.queryByTestId('leg-disclosure-panel')).toBeNull();
    cleanup();

    renderRows([rowOfSim(FX_SHORT_VERTICAL)]);
    expect(screen.getByTestId('leg-disclosure-toggle')).toBeInTheDocument();
  });

  it('AC-35 — one line per leg, with side as a WORD, size, instrument, expiry and that leg`s own mark', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_IRON_CONDOR)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));

    const lines = screen.getAllByTestId('leg-line');
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(['Long', 'Short']).toContain(within(line).getByTestId('leg-side').textContent);
      expect(within(line).getByTestId('leg-size').textContent).toMatch(/^\d+ (×|sh)$/);
      expect(within(line).getByTestId('leg-instrument').textContent).toBeTruthy();
      expect(within(line).getByTestId('leg-mark').textContent).toMatch(/^\$\d/);
      // NEVER `+`/`−` for side — a sign here reads as a P/L direction.
      expect(within(line).getByTestId('leg-side').textContent).not.toMatch(/[+−]/);
    }
  });

  it('AC-12 — legs carry NO actions: no button, no link, no per-leg Close or Cancel', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_IRON_CONDOR)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    for (const line of screen.getAllByTestId('leg-line')) {
      expect(within(line).queryByRole('button')).toBeNull();
      expect(within(line).queryByRole('link')).toBeNull();
      expect(line.querySelector('button, a, input')).toBeNull();
    }
    expect(within(screen.getByTestId('leg-list')).queryByText(/Close|Cancel/)).toBeNull();
  });

  it('carries NO per-leg P/L — it would invite the partial-sum reading the all-or-nothing rule bans', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_IRON_CONDOR)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    const list = screen.getByTestId('leg-list');
    // A per-leg P/L would necessarily render a SIGNED dollar figure. None exists.
    expect(list.textContent).not.toMatch(/[+−]\$/);
    expect(list.textContent).not.toMatch(/P\/L/);
    // …and no leg attribute is tinted (a short leg is not a loss).
    expect(list.innerHTML).not.toMatch(/success|error/i);
  });

  it('a leg that failed to price says so ON ITS OWN LINE while resolved legs still show their marks', async () => {
    const user = userEvent.setup();
    const [first, ...rest] = FX_IRON_CONDOR.legs;
    const marks = new Map<LegId, MarkResult | null>([
      [first.id, null],
      ...rest.map((l) => [l.id, FX_MARK] as const),
    ]);
    renderRows([rowOfSim(FX_IRON_CONDOR, { marks })]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));

    const legMarks = screen.getAllByTestId('leg-mark').map((n) => n.textContent);
    expect(legMarks.filter((t) => t === 'unavailable')).toHaveLength(1);
    expect(legMarks.filter((t) => t?.startsWith('$'))).toHaveLength(3);
    // …while the AGGREGATE is withheld: per-leg truth visible, position P/L not.
    expect(screen.getAllByTestId('cell-unavailable').length).toBeGreaterThan(0);
  });

  it('AC-79 — the control is a real <button> with aria-expanded and a RESOLVING aria-controls', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_SHORT_VERTICAL)]);
    const btn = screen.getByTestId('leg-disclosure-toggle');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    const panelId = btn.getAttribute('aria-controls') as string;
    expect(panelId).toBeTruthy();
    // The reference RESOLVES even while collapsed — a dangling id is how this pair quietly rots.
    expect(document.getElementById(panelId)).not.toBeNull();
    expect(screen.getByTestId('leg-disclosure-panel')).not.toBeVisible();

    await user.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('leg-disclosure-panel')).toBeVisible();
  });

  it('AC-79 — keyboard-operable: Enter AND Space both toggle it, and it takes focus', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_SHORT_VERTICAL)]);
    const btn = screen.getByTestId('leg-disclosure-toggle');
    btn.focus();
    expect(document.activeElement).toBe(btn);
    // A native <button> is what makes both keys work AND what lets the app's ONE authored
    // `*:focus-visible` ring (theme layer) apply — no bespoke per-component ring.
    await user.keyboard('{Enter}');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard(' ');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('style') ?? '').not.toMatch(/outline:\s*none/);
  });

  it('AC-36/AC-80 — expanding is a READ: nothing is written to storage and nothing re-fetches', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    localStorage.setItem('probe', 'sentinel');
    renderRows([rowOfSim(FX_SHORT_VERTICAL)]);
    const before = JSON.stringify({ ...localStorage });

    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    await user.click(screen.getByTestId('leg-disclosure-toggle'));

    expect(JSON.stringify({ ...localStorage })).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('AC-36 — the state is EPHEMERAL: a re-mount comes back collapsed', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_SHORT_VERTICAL)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    expect(screen.getByTestId('leg-disclosure-toggle').getAttribute('aria-expanded')).toBe('true');
    cleanup();

    renderRows([rowOfSim(FX_SHORT_VERTICAL)]); // "reload"
    expect(screen.getByTestId('leg-disclosure-toggle').getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the max-loss ASSUMPTION when a figure exists, and the reason`s own words when it does not', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_SHORT_VERTICAL)]); // a defined-risk credit spread ⇒ a figure
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    expect(screen.getByTestId('leg-max-loss-note').textContent).toBe(MAX_LOSS_ASSUMPTION);
    cleanup();

    // A calendar's legs do not expire together ⇒ withheld, with its OWN stated reason, never the
    // assumption sentence and never a bare blank.
    renderRows([rowOfSim(FX_CALENDAR)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    expect(screen.getByTestId('leg-max-loss-note').textContent).toBe(
      MAX_LOSS_WITHHELD_META.multi_expiration.tip,
    );
    expect(screen.getByTestId('leg-max-loss-note').textContent).not.toBe(MAX_LOSS_ASSUMPTION);
  });

  it('is INSTANT — no animation, no transition, no accordion on the panel', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_SHORT_VERTICAL)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    const panel = screen.getByTestId('leg-disclosure-panel');
    const cs = getComputedStyle(panel);
    expect(cs.transitionProperty === '' || cs.transitionProperty === 'all').toBe(true);
    expect(cs.animationName === '' || cs.animationName === 'none').toBe(true);
    // MUI's Collapse/Accordion would show up as a wrapper class; none exists on this path.
    expect(panel.closest('.MuiCollapse-root')).toBeNull();
    expect(panel.closest('.MuiAccordion-root')).toBeNull();
  });

  it('the table expansion is a REAL sibling <tr> spanning every column (a real table structure)', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_SHORT_VERTICAL)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    const panelRow = screen.getByTestId('leg-disclosure-row');
    expect(panelRow.tagName).toBe('TR');
    expect(panelRow.previousElementSibling).toBe(screen.getByTestId('position-row'));
    const td = panelRow.querySelector('td') as HTMLTableCellElement;
    const headerCells = screen.getByTestId('positions-table').querySelectorAll('thead th');
    expect(Number(td.getAttribute('colspan'))).toBe(headerCells.length);
  });

  it('leg text sits above the 11px floor (AC-79)', async () => {
    const user = userEvent.setup();
    renderRows([rowOfSim(FX_SHORT_VERTICAL)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    // jsdom does NOT resolve rem, so the declared unit is converted here against the 16px root the
    // theme uses. A bare `parseFloat` would read `0.8rem` as 0.8 and pass this test vacuously.
    const toPx = (v: string) =>
      v.endsWith('rem')
        ? parseFloat(v) * 16
        : v.endsWith('em')
          ? parseFloat(v) * 16
          : parseFloat(v);
    const lines = screen.getAllByTestId('leg-line');
    expect(lines.length).toBeGreaterThan(0); // vacuity guard
    for (const line of lines) {
      expect(toPx(getComputedStyle(line).fontSize)).toBeGreaterThanOrEqual(11);
    }
    expect(
      toPx(getComputedStyle(screen.getByTestId('leg-max-loss-note')).fontSize),
    ).toBeGreaterThanOrEqual(11);
  });
});
