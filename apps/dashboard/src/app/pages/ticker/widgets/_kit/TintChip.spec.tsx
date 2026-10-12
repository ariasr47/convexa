/**
 * redesign-stage-3 §5.3 / §8-4 — `OffExchangeBlocks` proximity chips render `neutral` and carry NO
 * success/error styling — className-identity with a reference neutral chip, so the green-reservation
 * fix (green on a "no side or direction" datum) can't silently regress.
 *
 * MUI sx compiles to classes — assertions read the emotion class's injected CSS / className
 * identity, never `getAttribute('style')` (the testing gotcha).
 */
import type { OffExchange } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { theme } from '@/shared/theme/theme';
import { palette } from '@/shared/theme/tokens';
import { TintChip } from '@/shared/ui/TintChip';
import { WidgetSelectionProvider } from '@/shared/ui/Widget/WidgetSelectionContext';
import { OffExchangeBlocks } from '../off-exchange-blocks/OffExchangeBlocks';

afterEach(() => cleanup());

const wrap = (ui: React.ReactNode) =>
  render(
    <ThemeProvider theme={theme}>
      <WidgetSelectionProvider>{ui}</WidgetSelectionProvider>
    </ThemeProvider>,
  );

/** The emotion rule text a chip element's sx class injected (whitespace-stripped). */
function ruleFor(el: HTMLElement): string {
  const cls = Array.from(el.classList).find((c) => c.startsWith('css-'));
  expect(cls, 'chip should carry an emotion (sx) class').toBeTruthy();
  const css = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
    .replace(/\s+/g, '');
  return css.split(`.${cls}{`)[1]?.split('}')[0] ?? '';
}

describe('OffExchangeBlocks — proximity chips are NEUTRAL (§5.3-2, the green-reservation fix)', () => {
  const offExchange = {
    off_exchange_ratio: 0.41,
    block_min_shares: 10_000,
    levels: [],
    blocks: [
      { price: 415.2, shares: 25_000, notional: 10_380_000, proximity_pct: 0.012, age_seconds: 90 },
    ],
  } as unknown as OffExchange;

  it('the proximity chip ≡ a reference neutral chip and ≢ success/error chips (className identity)', () => {
    wrap(
      <>
        <OffExchangeBlocks offExchange={offExchange} />
        <TintChip tone="neutral" label="REF-N" />
        <TintChip tone="success" label="REF-S" />
        <TintChip tone="error" label="REF-X" />
      </>,
    );
    const widget = screen.getByTestId('widget-off-exchange-blocks');
    const chip = within(widget).getByText(/% vs spot$/);
    expect(chip.className).toBe(screen.getByText('REF-N').className);
    expect(chip.className).not.toBe(screen.getByText('REF-S').className);
    expect(chip.className).not.toBe(screen.getByText('REF-X').className);
    // Belt-and-braces: its injected rule carries neither reserved direction color.
    const rule = ruleFor(chip);
    expect(rule).not.toContain(palette.dark.success);
    expect(rule).not.toContain(palette.dark.error);
  });
});
