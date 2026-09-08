/**
 * `capitalAtRiskStateOf` — the mast's "Capital at risk" figure cell (surfaces fidelity repair,
 * `design/src/screens/positions.mjs:63`). Sibling to `netPl.ts`, same fixtures, same honesty
 * shape: never a computed-looking number for a book with nothing to sum, never a zero standing in
 * for an unmarked/empty set.
 *
 * UNLIKE Net P/L, this figure is STATIC (`maxLoss.ts`'s own header: "not live-derived, so it never
 * dims and never degrades on an SSE drop") — there is no offline arm here, by construction.
 */
import {
  FX_LONG_CALL,
  FX_SHORT_CALL,
  mkPosition,
  viewOf,
} from '@/features/trading/positions/fixtures';
import type { PositionView } from '@/features/trading/positions/view';
import { describe, expect, it } from 'vitest';
import { capitalAtRiskStateOf, formatCapitalAtRisk } from './capitalAtRisk';

/** `FX_LONG_CALL` is `long_call` — a NET_DEBIT_MEMBER, always max-loss ELIGIBLE. */
function eligibleOpen(): PositionView {
  return viewOf(FX_LONG_CALL);
}

/** `FX_SHORT_CALL` is `short_call` — UNBOUNDED, always max-loss WITHHELD. */
function withheldOpen(): PositionView {
  return viewOf(FX_SHORT_CALL);
}

function closedRow(): PositionView {
  return viewOf(mkPosition(FX_LONG_CALL.legs, { status: 'closed' }));
}

describe('capitalAtRiskStateOf (surfaces fidelity repair, positions mast)', () => {
  it('no open rows at all → `—`, traced register, no caption — never a computed-looking $0', () => {
    const state = capitalAtRiskStateOf({ views: [closedRow()] });
    expect(state.value).toBe('—');
    expect(state.register).toBe('traced');
    expect(state.caption).toBeNull();
  });

  it('an EMPTY book also renders `—`', () => {
    const state = capitalAtRiskStateOf({ views: [] });
    expect(state.value).toBe('—');
  });

  it('open rows exist, none has a computed max-loss figure → `unavailable`, never a zero', () => {
    const state = capitalAtRiskStateOf({ views: [withheldOpen(), withheldOpen()] });
    expect(state.value).toBe('unavailable');
    expect(state.caption).toBe('0 of 2 open have a max-loss figure');
  });

  it('some open rows have a figure → the computable sum, mandatory coverage caption', () => {
    const state = capitalAtRiskStateOf({ views: [eligibleOpen(), withheldOpen()] });
    expect(state.value).toMatch(/^\$/);
    expect(state.caption).toBe('1 of 2 open have a max-loss figure');
  });

  it('every open row has a figure → the total, caption names the count with no coverage caveat', () => {
    const state = capitalAtRiskStateOf({ views: [eligibleOpen(), eligibleOpen()] });
    expect(state.value).toMatch(/^\$/);
    expect(state.caption).toBe('2 open');
  });

  it('the sum is UNSIGNED — max loss carries no direction', () => {
    const state = capitalAtRiskStateOf({ views: [eligibleOpen()] });
    expect(state.value).not.toMatch(/^[+−-]/);
  });

  it('formatCapitalAtRisk: bare dollar sign, rounded, grouped — never signed', () => {
    expect(formatCapitalAtRisk(1234.6)).toBe('$1,235');
    expect(formatCapitalAtRisk(0)).toBe('$0');
  });
});
