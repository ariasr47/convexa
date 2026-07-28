/**
 * Guard on the fixture library itself. A fixture that silently stops being what its name says
 * turns every suite built on it into a green lie — so the SHAPE facts each fixture exists to carry
 * are asserted here, once, in the cheapest possible place.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_FIXTURES,
  COLLIDING_ID_PAIR,
  FX_CALENDAR,
  FX_COVERED_CALL,
  FX_IRON_CONDOR,
  FX_SHARES_LONG,
  FX_SHORT_VERTICAL,
  FX_SIX_LEG,
  FX_ZERO_COST_COLLAR,
  MALFORMED_LEGACY_RECORD,
  UNPARSEABLE_BLOB,
} from './fixtures';
import { NET_BASIS_EPS, netEntryCost } from './leg';

describe('fixture library', () => {
  it('the short vertical is a two-leg credit', () => {
    expect(FX_SHORT_VERTICAL.legs).toHaveLength(2);
    expect(netEntryCost(FX_SHORT_VERTICAL)).toBeLessThan(0);
  });

  it('the covered call is 100 shares + 1 short call', () => {
    const equity = FX_COVERED_CALL.legs.filter((l) => l.kind === 'equity');
    const options = FX_COVERED_CALL.legs.filter((l) => l.kind === 'option');
    expect(equity).toHaveLength(1);
    expect(equity[0].qty).toBe(100);
    expect(equity[0].multiplier).toBe(1);
    expect(options).toHaveLength(1);
    expect(options[0].side).toBe('short');
    expect(options[0].right).toBe('call');
  });

  it('the shares fixture has no option facts at all', () => {
    const l = FX_SHARES_LONG.legs[0];
    expect(l.kind).toBe('equity');
    expect(l.strike).toBeNull();
    expect(l.right).toBeNull();
    expect(l.expiration).toBeNull();
  });

  it('the calendar really has two distinct expirations', () => {
    const exps = new Set(FX_CALENDAR.legs.map((l) => l.expiration));
    expect(exps.size).toBe(2);
  });

  it('the zero-cost collar nets under the no-basis epsilon', () => {
    expect(Math.abs(netEntryCost(FX_ZERO_COST_COLLAR))).toBeLessThan(NET_BASIS_EPS);
  });

  it('the iron condor has four legs on one expiration', () => {
    expect(FX_IRON_CONDOR.legs).toHaveLength(4);
    expect(new Set(FX_IRON_CONDOR.legs.map((l) => l.expiration)).size).toBe(1);
  });

  it('the six-leg fixture exercises the no-leg-cap rule (AC-13)', () => {
    expect(FX_SIX_LEG.legs).toHaveLength(6);
  });

  it('the colliding pair carries the SAME id under both source keys', () => {
    expect(COLLIDING_ID_PAIR.v2Record.id).toBe(COLLIDING_ID_PAIR.v1Record.id);
  });

  it('the malformed legacy record is missing `right` and the unparseable blob does not parse', () => {
    expect(MALFORMED_LEGACY_RECORD.right).toBeUndefined();
    expect(() => JSON.parse(UNPARSEABLE_BLOB)).toThrow();
  });

  /**
   * Every fixture is a WELL-FORMED SimPosition unless its name says otherwise. Without this, a typo
   * in one fixture's leg (a signed qty, a missing multiplier, a negative entry price) would surface
   * as a confusing failure in whichever later suite happens to consume it first.
   */
  it('every position fixture honours the three hard stands and has a unique leg id set', () => {
    for (const [name, p] of Object.entries(ALL_FIXTURES)) {
      expect(p.legs.length, name).toBeGreaterThanOrEqual(1);
      expect(new Set(p.legs.map((l) => l.id)).size, name).toBe(p.legs.length);
      expect(new Set(p.legs.map((l) => l.ticker)).size, name).toBe(1);
      for (const l of p.legs) {
        expect(l.qty, `${name} qty unsigned`).toBeGreaterThan(0);
        expect(l.entry_price, `${name} entry_price positive`).toBeGreaterThanOrEqual(0);
        expect(l.multiplier, `${name} multiplier stored`).toBeGreaterThan(0);
        if (l.kind === 'equity') {
          expect(l.multiplier, `${name} equity multiplier`).toBe(1);
          expect(l.strike, `${name} equity strike`).toBeNull();
        } else {
          expect(l.multiplier, `${name} option multiplier`).toBe(100);
          expect(l.strike, `${name} option strike`).not.toBeNull();
          expect(l.right, `${name} option right`).not.toBeNull();
          expect(l.expiration, `${name} option expiration`).not.toBeNull();
        }
      }
    }
  });
});
