/**
 * Unit — leg arithmetic. Risk-based (spec §7 invariant 4): byte-identity for a pre-existing
 * single-leg position, the 100-share $1 move, the credit-structure sign, and the near-zero
 * denominator. These regress silently and are invisible to review.
 */
import { pl as shippedPl } from '@/features/trading/model/mark';
import { describe, expect, it } from 'vitest';
import type { Leg, SimPosition } from './leg';
import {
  NET_BASIS_EPS,
  legCost,
  legPl,
  legValue,
  netEntryCost,
  plPctStateOf,
  positionPl,
  sideSign,
} from './leg';

function optLeg(over: Partial<Leg> = {}): Leg {
  return {
    id: 'l-1',
    kind: 'option',
    ticker: 'TSLA',
    side: 'long',
    qty: 1,
    multiplier: 100,
    entry_price: 12.4,
    entry_basis: 'snapshot',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    ...over,
  };
}

function pos(legs: Leg[], over: Partial<SimPosition> = {}): SimPosition {
  return {
    id: 'p-1',
    legs,
    opened_time: '2026-07-01T14:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 3,
    ...over,
  };
}

describe('leg arithmetic', () => {
  it('AC-25 — a long single option is the exact (mark - entry) * 100 * qty special case', () => {
    const l = optLeg({ entry_price: 5, qty: 2 });
    expect(legPl(l, 7)).toBe((7 - 5) * 100 * 2);
    expect(legCost(l)).toBe(5 * 100 * 2);
  });

  it('AC-24 — 100 shares up $1 is $100, not $10,000', () => {
    const shares = optLeg({
      kind: 'equity',
      qty: 100,
      multiplier: 1,
      entry_price: 250,
      expiration: null,
      strike: null,
      right: null,
    });
    expect(legPl(shares, 251)).toBe(100);
  });

  it('a short leg inverts both cost and P/L', () => {
    const short = optLeg({ side: 'short', entry_price: 6.1 });
    expect(legCost(short)).toBe(-610);
    expect(legPl(short, 4.1)).toBe(200); // sold at 6.10, now worth 4.10 → +$200
  });

  it('sideSign and legValue are the signed primitives the composer builds on', () => {
    expect(sideSign(optLeg())).toBe(1);
    expect(sideSign(optLeg({ side: 'short' }))).toBe(-1);
    expect(legValue(optLeg({ qty: 3 }), 14)).toBe(14 * 100 * 3);
    expect(legValue(optLeg({ side: 'short', qty: 3 }), 14)).toBe(-14 * 100 * 3);
  });

  it('netEntryCost is positive for a debit and negative for a credit', () => {
    const debit = pos([
      optLeg({ id: 'a', strike: 400, entry_price: 12.4 }),
      optLeg({ id: 'b', side: 'short', strike: 420, entry_price: 6.1 }),
    ]);
    expect(netEntryCost(debit)).toBeCloseTo(630, 6);
    const credit = pos([
      optLeg({ id: 'a', side: 'short', strike: 400, entry_price: 12.4 }),
      optLeg({ id: 'b', strike: 420, entry_price: 6.1 }),
    ]);
    expect(netEntryCost(credit)).toBeCloseTo(-630, 6);
  });

  it('ALL-OR-NOTHING — one null leg mark withholds the whole position P/L, never a partial sum', () => {
    const p = pos([
      optLeg({ id: 'a' }),
      optLeg({ id: 'b', side: 'short', strike: 420, entry_price: 6.1 }),
    ]);
    const partial = new Map<string, number | null>([
      ['a', 14],
      ['b', null],
    ]);
    expect(positionPl(p, partial)).toBeNull();
    const full = new Map<string, number | null>([
      ['a', 14],
      ['b', 7],
    ]);
    expect(positionPl(p, full)).toBeCloseTo((14 - 12.4) * 100 - (7 - 6.1) * 100, 6);
  });

  it('a leg absent from the mark map counts as unresolved, not as zero', () => {
    const p = pos([optLeg({ id: 'a' }), optLeg({ id: 'b', strike: 420 })]);
    expect(positionPl(p, new Map([['a', 14]]))).toBeNull();
  });

  it('AC-26 — a winning credit structure reports a POSITIVE percentage', () => {
    const st = plPctStateOf({
      plDollar: 200,
      netEntryCost: -630,
      status: 'open',
      anyLegUnresolved: false,
    });
    expect(st).toEqual({
      kind: 'value',
      value: expect.closeTo((200 / 630) * 100, 6),
      basis: 'net_credit',
    });
  });

  it('AC-26 — a near-zero net cost yields no_basis, never Infinity/0/blank', () => {
    const st = plPctStateOf({
      plDollar: 40,
      netEntryCost: 0,
      status: 'open',
      anyLegUnresolved: false,
    });
    expect(st).toEqual({ kind: 'no_basis' });
    expect(NET_BASIS_EPS).toBeGreaterThan(0);
  });

  it('an unresolved leg beats no_basis: unavailable wins', () => {
    expect(
      plPctStateOf({
        plDollar: null,
        netEntryCost: 0,
        status: 'open',
        anyLegUnresolved: true,
      }),
    ).toEqual({ kind: 'unavailable' });
  });

  it('a pending limit is not_applicable, not unavailable and not no_basis', () => {
    expect(
      plPctStateOf({
        plDollar: null,
        netEntryCost: 630,
        status: 'pending',
        anyLegUnresolved: false,
      }),
    ).toEqual({ kind: 'not_applicable' });
  });
});

/**
 * AC-25 in its strong form. The plan asks for this identity to be checked by hand once; encoding it
 * as an assertion against the SHIPPED `model/mark.ts:pl` is strictly better — a later "simplification"
 * of either side breaks a test instead of quietly moving every existing user's numbers.
 */
describe('AC-25 — byte-identity with the shipped single-leg formula', () => {
  it.each([
    [5, 7, 1],
    [12.4, 14.05, 2],
    [3.2, 0.01, 7],
    [9.1, 9.1, 1],
    [0.05, 41.3, 10],
  ])('entry %s, mark %s, qty %s reproduces model/mark.ts exactly', (entry, mark, qty) => {
    const l = optLeg({ entry_price: entry, qty, side: 'long', multiplier: 100 });
    const shipped = shippedPl(mark, entry, qty);
    const p = pos([l]);
    const dollar = positionPl(p, new Map([[l.id, mark]]));

    expect(dollar).toBe(shipped.dollar);

    const st = plPctStateOf({
      plDollar: dollar,
      netEntryCost: netEntryCost(p),
      status: 'open',
      anyLegUnresolved: false,
    });
    expect(st.kind).toBe('value');
    if (st.kind === 'value') {
      expect(st.value).toBeCloseTo(shipped.pct as number, 10);
      expect(st.basis).toBe('net_debit'); // a long option is always a debit
    }
  });
});
