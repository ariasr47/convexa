/**
 * Unit — the structure mark. Risk-based (SPEC §7 invariant 3): all-or-nothing on a null leg,
 * weakest-link basis, the frozen OR, and the offline-vs-partial-unavailable distinction that must
 * NOT collapse. Each of these regresses silently and is invisible to review.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import { describe, expect, it } from 'vitest';
import {
  BASIS_WEAKNESS,
  composePositionMark,
  compositeLimitWouldFill,
  legContractKey,
  netLimitDollarsFor,
  type NetLimitDollars,
} from './composeMark';
import {
  FX_CALL_DEBIT_SPREAD,
  FX_COVERED_CALL,
  FX_SHARES_LONG,
  mkLeg,
  mkPosition,
} from './fixtures';

const mr = (
  mark: number | null,
  basis: MarkResult['basis'] = 'snapshot',
  frozen = false,
): MarkResult => ({ mark, basis, frozen });

describe('composePositionMark', () => {
  it('nets a DOLLAR figure across legs, not a per-unit price', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(
      new Map([
        [a.id, mr(14)],
        [b.id, mr(7)],
      ]),
      FX_CALL_DEBIT_SPREAD,
    );
    expect(r.net_mark).toBeCloseTo(14 * 100 - 7 * 100, 6);
    expect(r.unavailable).toBe(false);
    expect(r.resolved_legs).toBe(2);
    expect(r.total_legs).toBe(2);
  });

  it('ALL-OR-NOTHING — one null leg withholds net_mark entirely, never a partial sum', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(
      new Map([
        [a.id, mr(14)],
        [b.id, null],
      ]),
      FX_CALL_DEBIT_SPREAD,
    );
    expect(r.net_mark).toBeNull();
    expect(r.unavailable).toBe(true);
    expect(r.resolved_legs).toBe(1);
    expect(r.total_legs).toBe(2);
  });

  it('a missing map entry counts as unresolved, not as zero', () => {
    const [a] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(new Map([[a.id, mr(14)]]), FX_CALL_DEBIT_SPREAD);
    expect(r.net_mark).toBeNull();
    expect(r.unavailable).toBe(true);
  });

  it('a resolved ENTRY whose mark is null is unresolved too, not a zero mark', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(
      new Map([
        [a.id, mr(14)],
        [b.id, mr(null)],
      ]),
      FX_CALL_DEBIT_SPREAD,
    );
    expect(r.net_mark).toBeNull();
    expect(r.unavailable).toBe(true);
    expect(r.resolved_legs).toBe(1);
  });

  it('basis is the WEAKEST link — a structure containing a theoretical leg is theoretical', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(
      new Map([
        [a.id, mr(14, 'snapshot')],
        [b.id, mr(7, 'theoretical')],
      ]),
      FX_CALL_DEBIT_SPREAD,
    );
    expect(r.basis).toBe('theoretical');
  });

  it('frozen is an OR across legs — one frozen leg freezes the structure', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(
      new Map([
        [a.id, mr(14, 'snapshot', false)],
        [b.id, mr(7, 'snapshot', true)],
      ]),
      FX_CALL_DEBIT_SPREAD,
    );
    expect(r.frozen).toBe(true);
  });

  it('offline and partial-unavailable do NOT collapse: all-last_known still yields a number', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const offline = composePositionMark(
      new Map([
        [a.id, mr(14, 'last_known')],
        [b.id, mr(7, 'last_known')],
      ]),
      FX_CALL_DEBIT_SPREAD,
    );
    expect(offline.net_mark).not.toBeNull();
    expect(offline.unavailable).toBe(false);
    expect(offline.basis).toBe('last_known');
  });

  it('the weakness ladder is snapshot > modeled > theoretical > last_known', () => {
    expect(BASIS_WEAKNESS.snapshot).toBeLessThan(BASIS_WEAKNESS.modeled);
    expect(BASIS_WEAKNESS.modeled).toBeLessThan(BASIS_WEAKNESS.theoretical);
    expect(BASIS_WEAKNESS.theoretical).toBeLessThan(BASIS_WEAKNESS.last_known);
  });

  it('a SHORT leg subtracts from the net — the sign inversion the all-or-nothing rule protects', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    expect(b.side).toBe('short');
    const full = composePositionMark(
      new Map([
        [a.id, mr(2)],
        [b.id, mr(9)],
      ]),
      FX_CALL_DEBIT_SPREAD,
    );
    // Dropping the short leg would report +$200 instead of −$700: an INVERSION, not a shortfall.
    expect(full.net_mark).toBeCloseTo(-700, 6);
  });
});

describe('legContractKey — resolver de-duplication', () => {
  it('is null for an equity leg (it never issues a contract lookup)', () => {
    expect(legContractKey(FX_SHARES_LONG.legs[0])).toBeNull();
  });

  it('is identical for the same (ticker, expiration, strike, right) across different positions', () => {
    const a = mkLeg({
      id: 'x',
      ticker: 'TSLA',
      expiration: '2026-08-21',
      strike: 440,
      right: 'call',
    });
    const b = mkLeg({
      id: 'y',
      ticker: 'TSLA',
      expiration: '2026-08-21',
      strike: 440,
      right: 'call',
      side: 'short',
      qty: 3,
    });
    expect(legContractKey(a)).toBe(legContractKey(b));
  });

  it('distinguishes right and expiration', () => {
    const call = mkLeg({ right: 'call' });
    const put = mkLeg({ right: 'put' });
    expect(legContractKey(call)).not.toBe(legContractKey(put));
    expect(legContractKey(mkLeg({ expiration: '2026-08-21' }))).not.toBe(
      legContractKey(mkLeg({ expiration: '2026-09-18' })),
    );
  });

  it('is null for an option leg missing a contract fact — an unpriceable record issues no lookup', () => {
    expect(legContractKey(mkLeg({ strike: null }))).toBeNull();
    expect(legContractKey(mkLeg({ right: null }))).toBeNull();
    expect(legContractKey(mkLeg({ expiration: null }))).toBeNull();
  });

  it('a covered call issues exactly ONE contract lookup key', () => {
    const keys = FX_COVERED_CALL.legs.map(legContractKey).filter((k): k is string => k != null);
    expect(keys).toHaveLength(1);
  });
});

describe('AC-44 — a composite limit never fills off a stale leg', () => {
  const p = mkPosition(
    [
      mkLeg({ id: 'a', entry_price: 10 }),
      mkLeg({ id: 'b', side: 'short', strike: 420, entry_price: 4 }),
    ],
    { status: 'pending', limit_price: 600 },
  );
  // The freshness rule is what these cases exercise; the limit itself is held constant at a dollar
  // net the position comfortably crosses. `as NetLimitDollars` appears ONLY here, in the spec, and
  // is exactly why the production type is branded — see the units cases below.
  const NET_600 = 600 as NetLimitDollars;

  it('fills when EVERY leg is live, non-frozen and non-last_known and the net crosses', () => {
    const marks = new Map([
      ['a', mr(9, 'snapshot')],
      ['b', mr(3, 'modeled')],
    ]);
    expect(compositeLimitWouldFill(marks, p, NET_600)).toBe(true);
  });

  it('refuses when ANY leg is last_known', () => {
    const marks = new Map([
      ['a', mr(9, 'snapshot')],
      ['b', mr(3, 'last_known')],
    ]);
    expect(compositeLimitWouldFill(marks, p, NET_600)).toBe(false);
  });

  it('refuses when ANY leg is frozen', () => {
    const marks = new Map([
      ['a', mr(9, 'snapshot', true)],
      ['b', mr(3, 'modeled')],
    ]);
    expect(compositeLimitWouldFill(marks, p, NET_600)).toBe(false);
  });

  it('refuses when ANY leg is unresolved', () => {
    const marks = new Map<string, MarkResult | null>([
      ['a', mr(9, 'snapshot')],
      ['b', null],
    ]);
    expect(compositeLimitWouldFill(marks, p, NET_600)).toBe(false);
  });

  it('refuses when the net has not crossed the limit', () => {
    const marks = new Map([
      ['a', mr(11, 'snapshot')],
      ['b', mr(3, 'modeled')],
    ]);
    expect(compositeLimitWouldFill(marks, p, NET_600)).toBe(false);
  });
});

/**
 * F15 Step 3b — the UNITS DEFECT, closed by construction.
 *
 * The shipped function compared a DOLLAR net against a PER-UNIT limit. Left alone it silently stops
 * every resting limit from ever filling: no error, no throw, nothing red. These cases pin both the
 * conversion and the boundary it is defined on.
 */
describe('netLimitDollarsFor — a per-unit limit becomes a dollar net, or nothing at all', () => {
  it('a per-unit limit is CONVERTED before comparison — the two units are never mixed', () => {
    const single = mkPosition([mkLeg({ id: 'a', qty: 2, multiplier: 100 })], {
      status: 'pending',
      limit_price: 8.4,
    });
    // 8.40 per unit x 100 x 2 contracts = $1680 of net, not $8.40.
    expect(netLimitDollarsFor(single)).toBeCloseTo(1680, 6);
  });

  it('a single-leg long option still fills exactly when mark <= limit — byte-identical to shipped', () => {
    const single = mkPosition([mkLeg({ id: 'a', qty: 1, multiplier: 100 })], {
      status: 'pending',
      limit_price: 8.4,
    });
    const net = netLimitDollarsFor(single) as NetLimitDollars;
    const at = new Map([['a', mr(8.4, 'snapshot')]]);
    const below = new Map([['a', mr(8.39, 'snapshot')]]);
    const above = new Map([['a', mr(8.41, 'snapshot')]]);
    expect(compositeLimitWouldFill(at, single, net)).toBe(true); // mark == limit
    expect(compositeLimitWouldFill(below, single, net)).toBe(true); // mark <  limit
    expect(compositeLimitWouldFill(above, single, net)).toBe(false); // mark >  limit
  });

  it('a SHORT single leg compares against a NEGATIVE net, and the sign is not lost', () => {
    const shortLeg = mkPosition([mkLeg({ id: 'a', side: 'short', qty: 1, multiplier: 100 })], {
      status: 'pending',
      limit_price: 6,
    });
    const net = netLimitDollarsFor(shortLeg) as NetLimitDollars;
    expect(net).toBeCloseTo(-600, 6); // sold: a CREDIT, so the net is negative
    // A short leg's net_mark rises (toward 0) as the option gets cheaper, so it crosses a -600
    // limit only while the mark is at or above 6.00. Losing that sign would invert the fill rule.
    expect(compositeLimitWouldFill(new Map([['a', mr(6.5, 'snapshot')]]), shortLeg, net)).toBe(
      true,
    );
    expect(compositeLimitWouldFill(new Map([['a', mr(5.5, 'snapshot')]]), shortLeg, net)).toBe(
      false,
    );
  });

  it('a MULTI-LEG position has no interpretable per-unit limit, so it never fills off one', () => {
    const spread = mkPosition(
      [mkLeg({ id: 'a' }), mkLeg({ id: 'b', side: 'short', strike: 420 })],
      { status: 'pending', limit_price: 8.4 },
    );
    // Not 0, not a guess — ABSENT. The naive "same per-unit price on every leg" conversion would
    // net to exactly 0 here and fill on a number the trader never meant.
    expect(netLimitDollarsFor(spread)).toBeNull();
  });

  it('an absent or non-finite limit yields null rather than a phantom zero', () => {
    const noLimit = mkPosition([mkLeg({ id: 'a' })], { status: 'pending' });
    expect(netLimitDollarsFor(noLimit)).toBeNull();
    expect(
      netLimitDollarsFor(
        mkPosition([mkLeg({ id: 'a' })], { status: 'pending', limit_price: Number.NaN }),
      ),
    ).toBeNull();
  });

  it('THE UNITS BUG IS UNREPRESENTABLE — a per-unit price cannot be passed at all', () => {
    const single = mkPosition([mkLeg({ id: 'a' })], { status: 'pending', limit_price: 8.4 });
    const marks = new Map([['a', mr(8, 'snapshot')]]);
    // @ts-expect-error a raw per-unit `number` is not a `NetLimitDollars`. If this line ever STOPS
    // erroring, the brand has been weakened and the defect is representable again — `nx typecheck`
    // fails on an unused @ts-expect-error, so this assertion cannot rot.
    compositeLimitWouldFill(marks, single, single.limit_price as number);
    // …and the sanctioned route still works.
    expect(
      compositeLimitWouldFill(marks, single, netLimitDollarsFor(single) as NetLimitDollars),
    ).toBe(true);
  });
});
