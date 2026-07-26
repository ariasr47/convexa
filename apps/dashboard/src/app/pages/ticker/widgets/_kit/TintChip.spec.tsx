/**
 * redesign-stage-3 §5.3 / §8-4 — the TintChip tone map after the emphasis rework:
 *
 *   1. NEW `emphasis` tone renders TEXT-GRADE brand amber (`extrasFor(t).textAmber`) on a
 *      `primary`-alpha tint — conviction/emphasis is a BRAND spend, structurally distinct from
 *      `warning` (burnt orange stays reserved for true warnings + icon; unchanged here).
 *   2. `Setups` maps `high → emphasis` — and NOT `warning` (the negative half: the mechanical
 *      burnt-orange inheritance the flag named cannot silently return).
 *   3. `OffExchangeBlocks` proximity chips render `neutral` and carry NO success/error styling —
 *      className-identity with a reference neutral chip, so the green-reservation fix
 *      (green on a "no side or direction" datum) can't silently regress.
 *
 * MUI sx compiles to classes — assertions read the emotion class's injected CSS / className
 * identity, never `getAttribute('style')` (the testing gotcha).
 */
import { ThemeProvider } from '@mui/material/styles';
import type { OffExchange, Setup } from '@org/api';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { theme } from '@/shared/theme/theme';
import { extras, palette } from '@/shared/theme/tokens';
import { WidgetSelectionProvider } from '@/shared/ui/Widget/WidgetSelectionContext';
import { OffExchangeBlocks } from '../off-exchange-blocks/OffExchangeBlocks';
import { Setups } from '../setups/Setups';
import { TintChip } from '@/shared/ui/TintChip';

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

/** #RRGGBB → the `rgba(r,g,b,a)` MUI's alpha() emits (whitespace already stripped in ruleFor). */
const rgba = (hex: string, a: number) => {
  const [r, g, b] = (hex.replace('#', '').match(/../g) ?? []).map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${a})`;
};

describe('TintChip — the emphasis tone (§5.3)', () => {
  it('emphasis renders textAmber text on a primary-alpha 0.16 tint (dark)', () => {
    wrap(<TintChip tone="emphasis" label="HIGH" />);
    const rule = ruleFor(screen.getByText('HIGH'));
    expect(rule).toContain(`color:${extras.textAmber}`); // dark textAmber === gammaAmber
    expect(rule).toContain(`background-color:${rgba(palette.dark.primary.main, 0.16)}`);
  });

  it('warning renders the warning slot UNCHANGED (burnt orange stays reserved)', () => {
    wrap(<TintChip tone="warning" label="⚠ stale" />);
    const rule = ruleFor(screen.getByText('⚠ stale'));
    expect(rule).toContain(`color:${palette.dark.warning}`);
    expect(rule).toContain(`background-color:${rgba(palette.dark.warning, 0.16)}`);
  });

  it('emphasis ≠ warning — the two tones compile to different classes', () => {
    wrap(
      <>
        <TintChip tone="emphasis" label="A1" />
        <TintChip tone="warning" label="B1" />
      </>,
    );
    expect(screen.getByText('A1').className).not.toBe(screen.getByText('B1').className);
  });
});

describe('Setups — high conviction maps to emphasis, NOT warning (§5.3-1)', () => {
  const setups: Setup[] = [
    { name: 'Wall magnet', conviction: 'high', rationale: 'r1' } as Setup,
    { name: 'Fade extreme', conviction: 'medium', rationale: 'r2' } as Setup,
  ];

  it('the HIGH chip wears the emphasis styling (textAmber + primary tint), not burnt orange', () => {
    wrap(<Setups setups={setups} />);
    const high = screen.getByText('HIGH');
    const rule = ruleFor(high);
    expect(rule).toContain(`color:${extras.textAmber}`);
    expect(rule).toContain(`background-color:${rgba(palette.dark.primary.main, 0.16)}`);
    // The negative half: nothing about the HIGH chip binds the warning slot.
    expect(rule).not.toContain(palette.dark.warning);
  });

  it('className identity: the HIGH chip ≡ a reference emphasis chip; ≢ a reference warning chip', () => {
    wrap(
      <>
        <Setups setups={setups} />
        <TintChip tone="emphasis" label="REF-E" />
        <TintChip tone="warning" label="REF-W" />
      </>,
    );
    expect(screen.getByText('HIGH').className).toBe(screen.getByText('REF-E').className);
    expect(screen.getByText('HIGH').className).not.toBe(screen.getByText('REF-W').className);
  });
});

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
