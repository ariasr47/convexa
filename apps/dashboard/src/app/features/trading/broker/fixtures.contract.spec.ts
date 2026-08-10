/**
 * FIXTURE CONTRACT — each constructed fixture asserts the property it exists to provide.
 * SPEC §1: the captured book exercises NONE of the withholding / credit / zero-net / mixed-cause /
 * doubly-broken / two-legs-in-one-position / future-feed / provenance-false cases. Those are the
 * `[CF]` criteria in SPEC §3, and a `[CF]` row reported green off the captured arm is a GATE Q
 * failure. Asserted here over the RAW WIRE SHAPE, independent of any implementation.
 */
import type { BrokerBook, BrokerLeg, BrokerPosition } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  BOOK_CAPTURED_COMPLETE,
  BOOK_CF_CREDIT,
  BOOK_CF_DOUBLY_BROKEN,
  BOOK_CF_FUTURE_FEED,
  BOOK_CF_MIXED_CAUSE,
  BOOK_CF_NO_COST,
  BOOK_CF_NO_RECON_NOTE,
  BOOK_CF_NO_SIZE,
  BOOK_CF_TWO_LEG_MEMBER,
  BOOK_CF_UNPARSEABLE,
  BOOK_CF_ZERO_NET,
  NOTE_MULTIPLIER_RECONSTRUCTED,
  SINGLE_LEG_CASCADE_ARMS,
} from './fixtures';

/** The figure Convexa renders for one leg: per-unit cost × contract size × SIGNED quantity. */
const composed = (l: BrokerLeg): number =>
  (l.cost_basis.state === 'supplied' ? Math.abs(l.cost_basis.value ?? 0) : Number.NaN) *
  (l.multiplier ?? Number.NaN) *
  l.quantity;

const optionPositions = (b: BrokerBook): BrokerPosition[] =>
  b.positions.filter((p) => p.legs.length > 0 && p.legs.every((l) => l.kind === 'option'));
const optionLegs = (b: BrokerBook): BrokerLeg[] => optionPositions(b).flatMap((p) => p.legs);
const byTicker = (b: BrokerBook): Map<string, BrokerLeg[]> => {
  const m = new Map<string, BrokerLeg[]>();
  for (const l of optionLegs(b)) m.set(l.underlying, [...(m.get(l.underlying) ?? []), l]);
  return m;
};

describe('the CAPTURED book is complete and reproduces SPEC §1 exactly', () => {
  it('14 holdings = 5 equity + 9 option legs, split TSLA 3 · AAPL 2 · META 2 · NVDA 1 · PLTR 1', () => {
    const book = BOOK_CAPTURED_COMPLETE;
    expect(book.positions).toHaveLength(14);
    const equity = book.positions.filter((p) => p.legs.some((l) => l.kind === 'equity'));
    expect(equity).toHaveLength(5);
    expect(equity.some((p) => p.legs[0].underlying === 'AAPL')).toBe(true); // AC-22's live instance
    const t = byTicker(book);
    expect([...t.keys()].sort()).toEqual(['AAPL', 'META', 'NVDA', 'PLTR', 'TSLA']);
    expect(
      [t.get('TSLA'), t.get('AAPL'), t.get('META'), t.get('NVDA'), t.get('PLTR')].map(
        (x) => x?.length,
      ),
    ).toEqual([3, 2, 2, 1, 1]);
  });

  it('the five ticker nets are SPEC §1 left-hand column, to the cent', () => {
    const t = byTicker(BOOK_CAPTURED_COMPLETE);
    const net = (k: string) =>
      Math.round((t.get(k) ?? []).reduce((a, l) => a + composed(l), 0) * 100) / 100;
    expect([net('AAPL'), net('META'), net('TSLA'), net('NVDA'), net('PLTR')]).toEqual([
      3850, 3805, 13760, 7890, 4990,
    ]);
  });

  it('exercises NONE of the [CF] cases (this is what makes a false [CF] claim impossible)', () => {
    const legs = BOOK_CAPTURED_COMPLETE.positions.flatMap((p) => p.legs);
    expect(legs.filter((l) => l.cost_basis.state === 'not_supplied')).toHaveLength(0);
    expect(legs.filter((l) => l.cost_basis.state === 'unparseable')).toHaveLength(0);
    expect(legs.filter((l) => l.multiplier == null)).toHaveLength(0);
    for (const p of optionPositions(BOOK_CAPTURED_COMPLETE)) {
      expect(p.fidelity_notes ?? []).toContain(NOTE_MULTIPLIER_RECONSTRUCTED); // false branch unreachable
      expect(p.legs).toHaveLength(1); // 1:1 — a leg-counting bug passes here by COINCIDENCE
    }
    for (const [, ls] of byTicker(BOOK_CAPTURED_COMPLETE)) {
      expect(ls.reduce((a, l) => a + composed(l), 0)).toBeGreaterThan(0); // every net a DEBIT
    }
  });
});

describe('every [CF] fixture exercises the case it exists for', () => {
  it('CREDIT — signed net strictly NEGATIVE, nothing withheld (AC-9b)', () => {
    expect(optionPositions(BOOK_CF_CREDIT).length).toBeGreaterThanOrEqual(2);
    expect(optionLegs(BOOK_CF_CREDIT).reduce((a, l) => a + composed(l), 0)).toBeLessThan(0);
    expect(
      optionLegs(BOOK_CF_CREDIT).every(
        (l) => l.cost_basis.state === 'supplied' && l.multiplier != null,
      ),
    ).toBe(true);
  });

  it('ZERO NET — the legs cancel EXACTLY, reconstruction note present (AC-9c, P3)', () => {
    expect(optionLegs(BOOK_CF_ZERO_NET).reduce((a, l) => a + composed(l), 0)).toBe(0);
    for (const p of optionPositions(BOOK_CF_ZERO_NET)) {
      expect(p.fidelity_notes ?? []).toContain(NOTE_MULTIPLIER_RECONSTRUCTED);
    }
  });

  it('NO COST — exactly one leg `not_supplied`, every multiplier present (AC-12)', () => {
    const legs = optionLegs(BOOK_CF_NO_COST);
    expect(legs.filter((l) => l.cost_basis.state === 'not_supplied')).toHaveLength(1);
    expect(legs.filter((l) => l.multiplier == null)).toHaveLength(0);
    expect(legs.length).toBeGreaterThanOrEqual(2);
  });

  it('NO SIZE — exactly one leg with `multiplier` ABSENT (not null-padded), every cost supplied', () => {
    const legs = optionLegs(BOOK_CF_NO_SIZE);
    expect(legs.filter((l) => l.multiplier == null)).toHaveLength(1);
    expect(legs.every((l) => l.cost_basis.state === 'supplied')).toBe(true);
    const broken = legs.find((l) => l.multiplier == null) as BrokerLeg;
    expect(Object.prototype.hasOwnProperty.call(broken, 'multiplier')).toBe(false);
  });

  it('UNPARSEABLE — one transient leg and NOTHING permanent (AC-14)', () => {
    const legs = optionLegs(BOOK_CF_UNPARSEABLE);
    expect(legs.filter((l) => l.cost_basis.state === 'unparseable')).toHaveLength(1);
    expect(
      legs.filter((l) => l.cost_basis.state === 'not_supplied' || l.multiplier == null),
    ).toHaveLength(0);
  });

  it('MIXED CAUSE — one permanent and one transient, on DIFFERENT legs (AC-15)', () => {
    const legs = optionLegs(BOOK_CF_MIXED_CAUSE);
    const perm = legs.filter((l) => l.cost_basis.state === 'not_supplied' || l.multiplier == null);
    const tran = legs.filter((l) => l.cost_basis.state === 'unparseable' && l.multiplier != null);
    expect(perm).toHaveLength(1);
    expect(tran).toHaveLength(1);
    expect(perm[0]).not.toBe(tran[0]);
  });

  it('DOUBLY BROKEN — ONE leg missing BOTH facts beside one healthy leg (AC-17b: "1 of 2")', () => {
    const legs = optionLegs(BOOK_CF_DOUBLY_BROKEN);
    expect(legs).toHaveLength(2);
    expect(
      legs.filter((l) => l.cost_basis.state === 'not_supplied' && l.multiplier == null),
    ).toHaveLength(1);
    // The naive SUM of cause counts is 2 — which is why the union cardinality is load-bearing.
    expect(
      legs.filter((l) => l.cost_basis.state === 'not_supplied').length +
        legs.filter((l) => l.multiplier == null).length,
    ).toBe(2);
  });

  it('TWO-LEG MEMBER — one POSITION carries two option legs, so leg_count ≠ position_count (AC-6, 6c)', () => {
    const ps = optionPositions(BOOK_CF_TWO_LEG_MEMBER);
    expect(ps.some((p) => p.legs.length === 2)).toBe(true);
    expect(ps.reduce((a, p) => a + p.legs.length, 0)).not.toBe(ps.length);
  });

  it('FUTURE FEED — two legs WITH strike/expiry/right, on a ticker that is not a B2 term', () => {
    const legs = optionLegs(BOOK_CF_FUTURE_FEED);
    expect(legs).toHaveLength(2);
    for (const l of legs) {
      expect(typeof l.strike).toBe('number');
      expect(typeof l.expiry).toBe('string');
      expect(l.right === 'call' || l.right === 'put').toBe(true);
      expect(l.underlying).toBe('TSLA'); // SPEC §2.3 / §9 item 5
    }
  });

  it('NO RECONSTRUCTION NOTE — the provenance FALSE branch is reachable, with a real figure (P1)', () => {
    for (const p of optionPositions(BOOK_CF_NO_RECON_NOTE)) {
      expect(p.fidelity_notes ?? []).not.toContain(NOTE_MULTIPLIER_RECONSTRUCTED);
      expect(p.legs.every((l) => l.multiplier != null && l.cost_basis.state === 'supplied')).toBe(
        true,
      );
    }
  });

  it('SINGLE-LEG CASCADE ARMS cover all three N=1 outcomes (AC-15b)', () => {
    expect(SINGLE_LEG_CASCADE_ARMS.length).toBeGreaterThanOrEqual(6);
    for (const [label, pos, expected] of SINGLE_LEG_CASCADE_ARMS) {
      expect(pos.legs.length, label).toBeLessThanOrEqual(1);
      expect(['not provided', 'unavailable', 'FIGURE']).toContain(expected);
    }
    expect(new Set(SINGLE_LEG_CASCADE_ARMS.map(([, , e]) => e)).size).toBe(3);
  });
});
