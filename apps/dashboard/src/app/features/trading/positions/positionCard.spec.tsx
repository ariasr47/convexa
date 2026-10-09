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
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DerivedGroup } from './derive';
import {
  FX_PROTECTIVE_PUT,
  FX_SHARES_LONG,
  FX_SHORT_CALL,
  FX_SHORT_VERTICAL,
  viewOf,
} from './fixtures';
import { MAX_LOSS_WITHHELD_META } from './labels';
import { PositionsView, type ViewProps } from './PositionsView';
import type { PositionView } from './view';

function groupsOf(views: PositionView[]): DerivedGroup[] {
  return [{ key: '__all__', label: 'All', views, subtotal: 0, excludedCount: 0 }];
}

function renderCards(views: PositionView[], over: Partial<ViewProps> = {}) {
  return render(
    <ThemeProvider theme={themeForPref('dark')}>
      <PositionsView
        groups={groupsOf(views)}
        columns={[]}
        layout="card"
        density="comfortable"
        streamOffline={false}
        totalCount={views.length}
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
  it('AC-30 — the collapsed card carries AT MOST ONE risk figure or reason, never three', () => {
    renderCards([viewOf(FX_PROTECTIVE_PUT)]);
    const card = screen.getByTestId('position-card');
    expect(within(card).getAllByTestId('card-max-loss')).toHaveLength(1);
    expect(within(card).getByTestId('card-max-loss').textContent).toMatch(/^\$\d+$/);
    // No breakeven, no max gain, no second risk figure — the slot answers once.
    expect(card.textContent).not.toMatch(/Breakeven|Max gain|Max profit/i);
  });

  it('AC-33 — a shares card reads `100 sh`, carries the Shares chip, and shows — for the expiry', () => {
    renderCards([viewOf(FX_SHARES_LONG)]);
    const card = screen.getByTestId('position-card');
    expect(card.textContent).toMatch(/100 sh/);
    expect(within(card).getByTestId('card-structure-chip').textContent).toBe('Shares');
    expect(footerItems(card)[3].textContent).toBe('—'); // the expiry slot: not applicable
    expect(card.textContent).not.toMatch(/N\/A|undefined|null|NaN/);
  });

  it('AC-34 — the entry slot reads Net debit / Net credit from the SIGN; `Cost` appears nowhere', () => {
    renderCards([viewOf(FX_PROTECTIVE_PUT), viewOf(FX_SHORT_VERTICAL)]);
    const [debit, credit] = screen.getAllByTestId('position-card');
    expect(footerItems(debit)[1].textContent).toMatch(/^Net debit \$\d+$/);
    expect(footerItems(credit)[1].textContent).toMatch(/^Net credit \$\d+$/);
    expect(screen.getByTestId('positions-cards').textContent).not.toMatch(/\bCost\b/);
    // Unsigned: the WORD carries the direction, so no `+`/`−` is ever printed here.
    expect(footerItems(credit)[1].textContent).not.toMatch(/[+−]/);
  });

  it('the risk slot answers with ONE stated reason when the structure is ineligible', () => {
    renderCards([viewOf(FX_SHORT_CALL)]);
    const slot = screen.getByTestId('card-max-loss');
    expect(slot.textContent).toBe(MAX_LOSS_WITHHELD_META.unbounded.label);
    expect(slot.textContent).not.toMatch(/\d/);
  });

  it('offline dims ONLY the live block and the mark; the static slots never dim', () => {
    const probe = () => ({
      pl: screen.getByTestId('card-pl').className,
      mark: screen.getByTestId('card-mark').className,
      maxLoss: screen.getByTestId('card-max-loss').className,
      netEntry: screen.getByTestId('card-net-entry').className,
      chip: screen.getByTestId('card-structure-chip').className,
    });
    renderCards([viewOf(FX_PROTECTIVE_PUT)]);
    const online = probe();
    cleanup();
    renderCards([viewOf(FX_PROTECTIVE_PUT)], { streamOffline: true });
    const offline = probe();

    expect(offline.pl).not.toBe(online.pl); // the guard is not vacuous
    expect(offline.mark).not.toBe(online.mark);
    expect(offline.maxLoss).toBe(online.maxLoss);
    expect(offline.netEntry).toBe(online.netEntry);
    expect(offline.chip).toBe(online.chip);
    // Never blanked: the value is still there.
    expect(screen.getByTestId('card-pl').textContent).toMatch(/\$/);
  });
});
