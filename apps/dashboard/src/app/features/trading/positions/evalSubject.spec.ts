/**
 * Unit — `eval_subject` selection. Risk-based (SPEC §7 test tiers): the two fixes kept under
 * suppression are exactly the silently-regressing ones — the `leg.id` final tiebreak (without it the
 * alert subject moves on reload with no user action) and the short-leg fallback (without it every
 * short put loses its subject). DETERMINISM is the property under test, not the copy.
 */
import { describe, expect, it } from 'vitest';
import { evalSubjectOf } from './evalSubject';
import {
  FX_IRON_CONDOR,
  FX_LONG_CALL,
  FX_SHARES_LONG,
  FX_SHARES_SHORT,
  FX_SHORT_PUT,
  mkLeg,
  mkPosition,
} from './fixtures';

describe('evalSubjectOf', () => {
  it('a single option leg IS the position', () => {
    expect(evalSubjectOf(FX_LONG_CALL)).toEqual({
      kind: 'whole_position',
      leg_id: FX_LONG_CALL.legs[0].id,
    });
  });

  it('a shares-only position produces `none` with an explicit reason, not an ambiguous null', () => {
    expect(evalSubjectOf(FX_SHARES_LONG)).toEqual({ kind: 'none', reason: 'no_option_leg' });
    expect(evalSubjectOf(FX_SHARES_SHORT)).toEqual({ kind: 'none', reason: 'no_option_leg' });
  });

  it('multi-leg selects a primary leg and reports of_legs', () => {
    const s = evalSubjectOf(FX_IRON_CONDOR);
    expect(s.kind).toBe('primary_leg');
    if (s.kind === 'primary_leg') expect(s.of_legs).toBe(4);
  });

  it('prefers the LONG option leg with the largest |qty x multiplier|', () => {
    const p = mkPosition([
      mkLeg({ id: 'small-long', side: 'long', qty: 1, strike: 400 }),
      mkLeg({ id: 'big-long', side: 'long', qty: 5, strike: 420 }),
      mkLeg({ id: 'huge-short', side: 'short', qty: 9, strike: 440 }),
    ]);
    const s = evalSubjectOf(p);
    expect(s.kind === 'primary_leg' && s.leg_id).toBe('big-long');
  });

  it('SHORT-LEG FALLBACK — with no long option leg it still selects, still primary_leg', () => {
    const s = evalSubjectOf(FX_SHORT_PUT);
    // one leg only, so it is the whole position
    expect(s).toEqual({ kind: 'whole_position', leg_id: FX_SHORT_PUT.legs[0].id });

    const twoShorts = mkPosition([
      mkLeg({ id: 's1', side: 'short', qty: 1, strike: 420, right: 'call' }),
      mkLeg({ id: 's2', side: 'short', qty: 4, strike: 380, right: 'put' }),
    ]);
    const t = evalSubjectOf(twoShorts);
    expect(t).toEqual({ kind: 'primary_leg', leg_id: 's2', of_legs: 2 });
  });

  it('ignores equity legs when selecting, but counts them in of_legs', () => {
    const s = evalSubjectOf(
      mkPosition([
        mkLeg({
          id: 'eq',
          kind: 'equity',
          qty: 100,
          multiplier: 1,
          strike: null,
          right: null,
          expiration: null,
        }),
        mkLeg({ id: 'opt', side: 'short', qty: 1, strike: 420 }),
      ]),
    );
    expect(s).toEqual({ kind: 'primary_leg', leg_id: 'opt', of_legs: 2 });
  });

  it('an equity leg NEVER outranks an option leg, however large its notional', () => {
    const s = evalSubjectOf(
      mkPosition([
        mkLeg({
          id: 'eq',
          kind: 'equity',
          qty: 100_000,
          multiplier: 1,
          strike: null,
          right: null,
          expiration: null,
        }),
        mkLeg({ id: 'opt', side: 'long', qty: 1, strike: 420 }),
      ]),
    );
    expect(s.kind === 'primary_leg' && s.leg_id).toBe('opt');
  });

  it('breaks ties by nearest expiration, then lowest strike, then leg.id — DETERMINISTIC', () => {
    const legs = [
      mkLeg({ id: 'zzz', qty: 2, expiration: '2026-08-21', strike: 400 }),
      mkLeg({ id: 'aaa', qty: 2, expiration: '2026-08-21', strike: 400 }),
      mkLeg({ id: 'far', qty: 2, expiration: '2026-09-18', strike: 100 }),
      mkLeg({ id: 'high', qty: 2, expiration: '2026-08-21', strike: 999 }),
    ];
    const forward = evalSubjectOf(mkPosition(legs));
    const reversed = evalSubjectOf(mkPosition([...legs].reverse()));
    expect(forward).toEqual(reversed);
    expect(forward.kind === 'primary_leg' && forward.leg_id).toBe('aaa');
  });

  it('never mutates the position it is handed — the leg order is untouched', () => {
    const legs = [mkLeg({ id: 'b', qty: 1, strike: 420 }), mkLeg({ id: 'a', qty: 3, strike: 400 })];
    const p = mkPosition(legs);
    evalSubjectOf(p);
    expect(p.legs.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('the multiplier is part of the notional — 1 contract outranks 50 shares', () => {
    const s = evalSubjectOf(
      mkPosition([
        mkLeg({ id: 'c1', qty: 1, multiplier: 100, strike: 400 }),
        mkLeg({ id: 'c2', qty: 1, multiplier: 10, strike: 380 }),
      ]),
    );
    expect(s.kind === 'primary_leg' && s.leg_id).toBe('c1');
  });
});
