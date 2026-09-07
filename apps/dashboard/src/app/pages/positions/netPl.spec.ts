/**
 * `netPlStateOf` — the Net P/L (open) header readout's five arms (curvature-v2-surfaces SPEC §4.3;
 * PLAN FE-6). Criteria 35a (SB), 35b (SB), 35c, 35d, 35e (SB).
 *
 * Fixtures route through the SAME `viewOf` builder the row/card specs use (`features/trading/
 * positions/fixtures.ts`), so a test here can never construct a `PositionView` the application
 * itself could not produce.
 */
import {
  FX_LONG_CALL,
  FX_SHORT_CALL,
  mkPosition,
  viewOf,
} from '@/features/trading/positions/fixtures';
import type { PositionView } from '@/features/trading/positions/view';
import { describe, expect, it } from 'vitest';
import { formatNetPl, netPlStateOf } from './netPl';

/** A marked OPEN row with a GAIN: `FX_LONG_CALL` entered at 12.40, marked above entry. */
function gainingOpen(): PositionView {
  return viewOf(FX_LONG_CALL, { mark: { mark: 20, basis: 'snapshot', frozen: false } });
}

/** A marked OPEN row with a LOSS: `FX_LONG_CALL` entered at 12.40, marked below entry. */
function losingOpen(): PositionView {
  return viewOf(FX_LONG_CALL, { mark: { mark: 5, basis: 'snapshot', frozen: false } });
}

/** An unmarked OPEN row: an explicit `mark: null` withholds the whole aggregate (SPEC §2.5) —
 *  `pl_dollar` comes back `null`, never a zero. */
function unmarkedOpen(): PositionView {
  return viewOf(FX_SHORT_CALL, { mark: null });
}

function closedRow(): PositionView {
  return viewOf(mkPosition(FX_SHORT_CALL.legs, { status: 'closed' }));
}

describe('netPlStateOf — five arms (SPEC §4.3)', () => {
  it('35a (SB): no open rows at all → `—`, Sans (traced/ignored), no tint, not offline', () => {
    const state = netPlStateOf({ views: [closedRow()], streamOffline: false, retainedTotal: null });
    expect(state.value).toBe('—');
    expect(state.tint).toBeNull();
    expect(state.offline).toBeNull();
    expect(state.caption).toBeNull();
  });

  it('35a (SB): an EMPTY book also renders `—`, never a computed-looking `+$0`', () => {
    // The shipped defect this arm closes: a fully-empty views array used to sum to a green `+$0`.
    const state = netPlStateOf({ views: [], streamOffline: false, retainedTotal: null });
    expect(state.value).toBe('—');
    expect(state.tint).toBeNull();
  });

  it('35b (SB): open rows, none marked → `unavailable`, never a number, never a zero, never a tint', () => {
    const state = netPlStateOf({
      views: [unmarkedOpen(), unmarkedOpen()],
      streamOffline: false,
      retainedTotal: null,
    });
    expect(state.value).toBe('unavailable');
    expect(state.tint).toBeNull();
    expect(state.caption).toBe('0 of 2 open marked');
  });

  it('35c: some open rows marked → the computable sum, mandatory coverage caption, positive tint', () => {
    const state = netPlStateOf({
      views: [gainingOpen(), unmarkedOpen()],
      streamOffline: false,
      retainedTotal: null,
    });
    expect(state.value).toMatch(/^\+\$/);
    expect(state.caption).toBe('1 of 2 open marked');
    expect(state.tint).toBe('positive');
  });

  it('35c: a NEGATIVE computable sum tints negative, not just "any tint present"', () => {
    const state = netPlStateOf({
      views: [losingOpen(), unmarkedOpen()],
      streamOffline: false,
      retainedTotal: null,
    });
    expect(state.value).toMatch(/^−\$/);
    expect(state.tint).toBe('negative');
  });

  it('35d: every open row marked → the total, no coverage caption, tint by sign', () => {
    const state = netPlStateOf({
      views: [gainingOpen(), gainingOpen()],
      streamOffline: false,
      retainedTotal: null,
    });
    expect(state.value).toMatch(/^\+\$/);
    expect(state.caption).toBeNull();
    expect(state.tint).toBe('positive');
  });

  it('35e (SB): stream drop, retained → the retained total, F4 offline shape, never a tint', () => {
    const state = netPlStateOf({ views: [], streamOffline: true, retainedTotal: 200 });
    expect(state.value).toBe(formatNetPl(200));
    expect(state.offline).toEqual({ retained: true });
    expect(state.tint).toBeNull();
  });

  it('35e (SB): stream drop, nothing retained → `unavailable`, F5 offline shape, never a tint', () => {
    const state = netPlStateOf({ views: [], streamOffline: true, retainedTotal: null });
    expect(state.value).toBe('unavailable');
    expect(state.offline).toEqual({ retained: false });
    expect(state.tint).toBeNull();
  });

  it('35e (SB): the offline arm wins even when `views` would otherwise earn the mandatory coverage caption — MUTATION PROOF K plants here', () => {
    // `views` below is EXACTLY the 35c shape (some marked, some not) that earns the mandatory
    // `{n} of {m} open marked` caption online. `caption: null` here is the honest signal that this
    // function defers to `figureStateOf`'s own shipped offline-caption precedence
    // (`FigureCell.tsx:253,262,271`) rather than racing it — the coverage caption must never even be
    // computed while `streamOffline` is true, let alone win.
    const state = netPlStateOf({
      views: [gainingOpen(), unmarkedOpen()],
      streamOffline: true,
      retainedTotal: 200,
    });
    expect(state.caption).toBeNull();
    expect(state.caption).not.toBe('1 of 2 open marked');
    expect(state.offline).toEqual({ retained: true });
  });

  it('formatNetPl carries the shipped sign convention (`+$`/`−$`, real minus, rounded, grouped)', () => {
    expect(formatNetPl(1234.6)).toBe('+$1,235');
    expect(formatNetPl(-1234.6)).toBe('−$1,235');
    expect(formatNetPl(0)).toBe('+$0');
  });
});
