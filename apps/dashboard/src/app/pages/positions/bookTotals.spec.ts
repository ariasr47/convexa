/**
 * The positions mast's two money totals, pinned to EXACT figures over a small mixed book
 * (lean-tests batch 103). `netPl.spec.ts` and `capitalAtRisk.spec.ts` prove the arms (`—`,
 * `unavailable`, captions, tint) but check the summed value only by sign/prefix regex, and
 * `digest.spec.ts` checks `capital_at_risk` with `expect.any(Number)` — so a wrong sum, a dropped
 * leg or an absolute-value slip renders a confident wrong dollar figure and every test stays green.
 *
 * Fixtures route through `mkLeg`/`mkPosition`/`viewOf` (`features/trading/positions/fixtures.ts`),
 * the builders the arm specs use, so no test here holds a projection the app could not produce.
 * Prices are binary-exact (×0.25) so the expected sums are exact, not `toBeCloseTo`.
 *
 * DELIBERATELY ABSENT: an ineligible/unbounded OPEN position in the capital-at-risk book. Whether
 * it should withhold or be excluded-and-counted in `capital_at_risk` is an open owner question
 * (BATCHES.md batch 103, UNSURE); nothing here encodes an answer.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import { buildOpenPositionsDigest } from '@/features/trading/positions/digest';
import { mkLeg, mkPosition, viewOf } from '@/features/trading/positions/fixtures';
import type { Leg } from '@/features/trading/positions/leg';
import { describe, expect, it } from 'vitest';
import { capitalAtRiskStateOf } from './capitalAtRisk';
import { netPlStateOf } from './netPl';

const mark = (m: number | null): MarkResult | null =>
  m == null ? null : { mark: m, basis: 'snapshot', frozen: false };

const call = (side: Leg['side'], strike: number, entry_price: number, over: Partial<Leg> = {}) =>
  mkLeg({ side, right: 'call', strike, entry_price, ...over });
const put = (side: Leg['side'], strike: number, entry_price: number, over: Partial<Leg> = {}) =>
  mkLeg({ side, right: 'put', strike, entry_price, ...over });

describe('Net P/L (open) — the exact NETTED sum over marked open rows', () => {
  it('nets gains against losses leg by leg: +200 − 150 − 250 = −$200; unmarked/closed add nothing', () => {
    // long 400C ×2 @12.50 → 13.50: +1 × 1.00 × 100 × 2 = +200
    const longCall = call('long', 400, 12.5, { qty: 2 });
    // put credit spread: short 380P @9.25 → 12.00 = −275; long 360P @4.25 → 5.50 = +125
    const pcsShort = put('short', 380, 9.25);
    const pcsLong = put('long', 360, 4.25);
    // short 420C @6.00 → 8.50: −1 × 2.50 × 100 = −250
    const shortCall = call('short', 420, 6);
    // a CLOSED row that is marked: +1000 if the open-only filter ever slipped
    const closed = call('long', 400, 10);

    const views = [
      viewOf(mkPosition([longCall]), { mark: mark(13.5) }),
      viewOf(mkPosition([pcsShort, pcsLong]), {
        marks: new Map([
          [pcsShort.id, mark(12)],
          [pcsLong.id, mark(5.5)],
        ]),
      }),
      viewOf(mkPosition([shortCall]), { mark: mark(8.5) }),
      viewOf(mkPosition([put('long', 380, 9)]), { mark: null }), // open, unmarked → withheld
      viewOf(mkPosition([closed], { status: 'closed' }), { mark: mark(20) }),
    ];

    const state = netPlStateOf({ views, streamOffline: false, retainedTotal: null });
    expect({ value: state.value, caption: state.caption, tint: state.tint }).toEqual({
      value: '−$200',
      caption: '3 of 4 open marked',
      tint: 'negative',
    });
  });
});

describe('Capital at risk — the exact SUMMED max loss over an all-eligible open book', () => {
  // long 400C ×2 @12.50: net debit = 12.50 × 100 × 2 = 2500 → max loss 2500
  const longCall = mkPosition([call('long', 400, 12.5, { qty: 2 })]);
  // put credit spread 380/360 @9.25/4.25: credit 500, width 20 × 100 → 2000 − 500 = 1500
  const putCreditSpread = mkPosition([put('short', 380, 9.25), put('long', 360, 4.25)]);
  // iron condor 380/400/440/460 @2.25/4.50/4.50/2.25: credit 450, wing 20 × 100 → 1550
  const ironCondor = mkPosition([
    put('long', 380, 2.25),
    put('short', 400, 4.5),
    call('short', 440, 4.5),
    call('long', 460, 2.25),
  ]);
  // Not OPEN — each would add its debit if the open-only filter slipped (+1000 / +900).
  const closed = mkPosition([call('long', 400, 10)], { status: 'closed' });
  const pending = mkPosition([put('long', 380, 9)], { status: 'pending' });
  const BOOK = [longCall, putCreditSpread, ironCondor, closed, pending];

  it('the mast sums 2500 + 1500 + 1550 = $5,550 over the 3 open rows', () => {
    const state = capitalAtRiskStateOf({ views: BOOK.map((p) => viewOf(p)) });
    expect({ value: state.value, caption: state.caption }).toEqual({
      value: '$5,550',
      caption: '3 open',
    });
  });

  it('the rec digest carries the SAME raw sum, 5550, with open_count 3', () => {
    const digest = buildOpenPositionsDigest({
      ticker: 'TSLA',
      positions: BOOK,
      faulted: false,
      now: new Date('2026-06-26T00:00:00Z'),
    });
    expect(digest.portfolio).toEqual({ open_count: 3, capital_at_risk: 5550 });
  });
});
