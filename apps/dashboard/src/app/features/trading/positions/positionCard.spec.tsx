/**
 * Component — the mobile card at 393px (SPEC §4 *The mobile card at 393px*, *Component states*;
 * AC-30, AC-33, AC-34, AC-79).
 *
 * Risk-based. What regresses silently here:
 *   1. the footer growing a SIXTH item, or the risk slot carrying a figure AND a reason — the card
 *      stops being a scan surface and nobody notices until a real portfolio is on a real phone;
 *   2. leg count leaking into the COLLAPSED card (AC-30's whole point);
 *   3. the structure line losing `minWidth: 0`, or the chip losing `flexShrink: 0` — the classic
 *      393px overflow, invisible on a desktop screenshot;
 *   4. `Cost` coming back, or the debit/credit qualifier stopping being derived from the SIGN.
 *
 * A COLLAPSED-HEIGHT assertion is not possible in jsdom (every box measures 0), so AC-30 is asserted
 * STRUCTURALLY here — same slots, same footer arity, no leg content in the collapsed DOM — and the
 * real-pixel guarantee is carried by the 393px no-overflow e2e (V3) in a real browser.
 */
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DerivedGroup, DerivedRow } from './derive';
import {
  FX_CALENDAR,
  FX_IRON_CONDOR,
  FX_LONG_CALL,
  FX_PROTECTIVE_PUT,
  FX_SHARES_LONG,
  FX_SHORT_CALL,
  FX_SHORT_VERTICAL,
  rowOfSim,
} from './fixtures';
import { MAX_LOSS_WITHHELD_META } from './labels';
import { PositionsView, type ViewProps } from './PositionsView';

function groupsOf(rows: DerivedRow[]): DerivedGroup[] {
  return [{ key: '__all__', label: 'All', rows, subtotal: 0, excludedCount: 0 }];
}

function renderCards(rows: DerivedRow[], over: Partial<ViewProps> = {}) {
  return render(
    <ThemeProvider theme={themeForPref('dark')}>
      <PositionsView
        groups={groupsOf(rows)}
        columns={[]}
        layout="card"
        density="comfortable"
        streamOffline={false}
        totalCount={rows.length}
        isHistory={false}
        trendFor={() => []}
        onOpenEntry={vi.fn()}
        onClearFilter={vi.fn()}
        onClose={vi.fn()}
        onCancel={vi.fn()}
        {...over}
      />
    </ThemeProvider>,
  );
}

/** The footer's direct children ARE its items — five, always. */
const footerItems = (card: HTMLElement) =>
  Array.from(within(card).getByTestId('card-footer').children) as HTMLElement[];

afterEach(() => cleanup());

describe('the position card at 393px', () => {
  it('the footer has EXACTLY five items for both a 1-leg and a 4-leg position', () => {
    renderCards([rowOfSim(FX_LONG_CALL), rowOfSim(FX_IRON_CONDOR)]);
    const [oneLeg, fourLeg] = screen.getAllByTestId('position-card');
    expect(footerItems(oneLeg)).toHaveLength(5);
    expect(footerItems(fourLeg)).toHaveLength(5);
    // …and they are the SAME five, in the same order: leg count relabels nothing here.
    const shape = (c: HTMLElement) => footerItems(c).map((n) => n.textContent?.split(/\s/)[0]);
    expect(shape(fourLeg)).toEqual(shape(oneLeg));
  });

  it('AC-30 — the collapsed card carries AT MOST ONE risk figure or reason, never three', () => {
    renderCards([rowOfSim(FX_PROTECTIVE_PUT)]);
    const card = screen.getByTestId('position-card');
    expect(within(card).getAllByTestId('card-max-loss')).toHaveLength(1);
    expect(within(card).getByTestId('card-max-loss').textContent).toMatch(/^\$\d+$/);
    // No breakeven, no max gain, no second risk figure — the slot answers once.
    expect(card.textContent).not.toMatch(/Breakeven|Max gain|Max profit/i);
  });

  it('AC-30 — leg count changes ONE label and nothing else in the COLLAPSED card', () => {
    renderCards([rowOfSim(FX_LONG_CALL), rowOfSim(FX_IRON_CONDOR)]);
    const [oneLeg, fourLeg] = screen.getAllByTestId('position-card');
    // No leg content is visible in either collapsed card.
    for (const card of [oneLeg, fourLeg]) {
      for (const line of within(card).queryAllByTestId('leg-line')) {
        expect(line).not.toBeVisible();
      }
    }
    // The ONLY structural difference is the single disclosure control.
    expect(within(oneLeg).queryByTestId('leg-disclosure-toggle')).toBeNull();
    expect(within(fourLeg).getByTestId('leg-disclosure-toggle').textContent).toMatch(/^4 legs/);
    // The header, live block and footer slots are present on both, identically.
    for (const id of ['card-structure-line', 'card-structure-chip', 'card-pl', 'card-footer']) {
      expect(within(oneLeg).getByTestId(id)).toBeInTheDocument();
      expect(within(fourLeg).getByTestId(id)).toBeInTheDocument();
    }
  });

  it('AC-33 — a shares card reads `100 sh`, carries the Shares chip, and shows — for the expiry', () => {
    renderCards([rowOfSim(FX_SHARES_LONG)]);
    const card = screen.getByTestId('position-card');
    expect(card.textContent).toMatch(/100 sh/);
    expect(within(card).getByTestId('card-structure-chip').textContent).toBe('Shares');
    expect(footerItems(card)[3].textContent).toBe('—'); // the expiry slot: not applicable
    expect(card.textContent).not.toMatch(/N\/A|undefined|null|NaN/);
  });

  it('AC-34 — the entry slot reads Net debit / Net credit from the SIGN; `Cost` appears nowhere', () => {
    renderCards([rowOfSim(FX_PROTECTIVE_PUT), rowOfSim(FX_SHORT_VERTICAL)]);
    const [debit, credit] = screen.getAllByTestId('position-card');
    expect(footerItems(debit)[1].textContent).toMatch(/^Net debit \$\d+$/);
    expect(footerItems(credit)[1].textContent).toMatch(/^Net credit \$\d+$/);
    expect(screen.getByTestId('positions-cards').textContent).not.toMatch(/\bCost\b/);
    // Unsigned: the WORD carries the direction, so no `+`/`−` is ever printed here.
    expect(footerItems(credit)[1].textContent).not.toMatch(/[+−]/);
  });

  it('the structure line gets minWidth 0 + ellipsis while the chip never shrinks', () => {
    renderCards([rowOfSim(FX_IRON_CONDOR)]);
    const line = getComputedStyle(screen.getByTestId('card-structure-line'));
    const chip = getComputedStyle(screen.getByTestId('card-structure-chip'));
    expect(parseFloat(line.minWidth)).toBe(0);
    expect(line.textOverflow).toBe('ellipsis');
    expect(line.overflow).toBe('hidden');
    expect(chip.flexShrink).toBe('0');
  });

  it('multi-expiry shows the NEAREST expiry with a `+1 more` suffix — never two dates in one slot', () => {
    renderCards([rowOfSim(FX_CALENDAR)]);
    const slot = footerItems(screen.getByTestId('position-card'))[3].textContent as string;
    expect(slot).toMatch(/\+1 more$/);
    // Exactly ONE date in the slot.
    expect(slot.match(/[A-Z][a-z]{2} \d+/g)).toHaveLength(1);
  });

  it('the risk slot answers with ONE stated reason when the structure is ineligible', () => {
    renderCards([rowOfSim(FX_SHORT_CALL)]);
    const slot = screen.getByTestId('card-max-loss');
    expect(slot.textContent).toBe(MAX_LOSS_WITHHELD_META.unbounded.label);
    expect(slot.textContent).not.toMatch(/\d/);
  });

  it('AC-79 — the disclosure button is ≥44px tall and its expansion stacks one line per leg', async () => {
    const user = userEvent.setup();
    renderCards([rowOfSim(FX_IRON_CONDOR)]);
    const btn = screen.getByTestId('leg-disclosure-toggle');
    expect(btn.tagName).toBe('BUTTON');
    expect(parseFloat(getComputedStyle(btn).minHeight)).toBeGreaterThanOrEqual(44);
    expect(getComputedStyle(btn).width).toBe('100%');

    await user.click(btn);
    const lines = screen.getAllByTestId('leg-line');
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(line).toBeVisible();
    // STACKED, never a horizontal mini-table: the list is a grid of rows, and each line wraps.
    expect(getComputedStyle(screen.getByTestId('leg-list')).display).toBe('grid');
    expect(getComputedStyle(lines[0]).flexWrap).toBe('wrap');
    // A real list, semantically.
    expect(screen.getByTestId('leg-list').tagName).toBe('UL');
    expect(lines[0].tagName).toBe('LI');
  });

  it('offline dims ONLY the live block and the mark; the static slots never dim', () => {
    const probe = () => ({
      pl: screen.getByTestId('card-pl').className,
      mark: screen.getByTestId('card-mark').className,
      maxLoss: screen.getByTestId('card-max-loss').className,
      netEntry: screen.getByTestId('card-net-entry').className,
      chip: screen.getByTestId('card-structure-chip').className,
    });
    renderCards([rowOfSim(FX_PROTECTIVE_PUT)]);
    const online = probe();
    cleanup();
    renderCards([rowOfSim(FX_PROTECTIVE_PUT)], { streamOffline: true });
    const offline = probe();

    expect(offline.pl).not.toBe(online.pl); // the guard is not vacuous
    expect(offline.mark).not.toBe(online.mark);
    expect(offline.maxLoss).toBe(online.maxLoss);
    expect(offline.netEntry).toBe(online.netEntry);
    expect(offline.chip).toBe(online.chip);
    // Never blanked: the value is still there.
    expect(screen.getByTestId('card-pl').textContent).toMatch(/\$/);
  });

  it('stat values are never headings (the 29-<h6> regression cannot return)', () => {
    renderCards([rowOfSim(FX_PROTECTIVE_PUT), rowOfSim(FX_IRON_CONDOR)]);
    expect(
      screen.getByTestId('positions-cards').querySelectorAll('h1,h2,h3,h4,h5,h6'),
    ).toHaveLength(0);
  });
});
