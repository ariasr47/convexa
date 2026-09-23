/**
 * Unit — `WIDGET_TITLE` (fidelity repair 2, N2): the side-column widget title must not exceed the
 * design's length. `Widget.tsx`'s h2 renders `{title}` verbatim (`overflow:hidden;
 * text-overflow:ellipsis; white-space:nowrap` on a `flex:1, minWidth:0` region beside the
 * non-shrinking `SIMULATED` chip + `All orders →` link) — a passthrough with no intermediate
 * transform, so pinning the STRING this pure function returns is equivalent to pinning "the
 * rendered title text" the review measured truncating to `Simulated or…` in the 379px side column
 * at both 1280 and 1440 (`crops/orders-1440.png`, `orders-1280.png`) and, unmeasured by the review,
 * the 358px phone stack — this function has no per-width branch, so the same short string is what
 * renders at every width, including the phone stack.
 */
import { describe, expect, it } from 'vitest';
import { WIDGET_TITLE } from './copy';

describe('WIDGET_TITLE — the design’s shorter side-column title (fidelity repair 2, N2)', () => {
  it('renders the design’s `Sim orders · TICKER` — not the old `Simulated orders · TICKER` the 379px side column ellipsised', () => {
    expect(WIDGET_TITLE('SPY')).toBe('Sim orders · SPY');
    expect(WIDGET_TITLE('TSLA')).toBe('Sim orders · TSLA');
  });

  it('never returns the old, longer string (the one the review’s crops show truncating)', () => {
    expect(WIDGET_TITLE('SPY')).not.toMatch(/^Simulated orders/);
  });
});
