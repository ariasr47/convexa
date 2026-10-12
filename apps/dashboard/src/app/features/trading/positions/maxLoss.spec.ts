/**
 * Unit — max loss. Eligibility is MEMBERSHIP IN A CLOSED SET, never a detection heuristic, so the
 * two things worth automating are (a) the membership itself, exactly as ruled, and (b) that every
 * ineligible shape yields one stated reason instead of a confident number. AC-28, AC-29.
 */
import { describe, expect, it } from 'vitest';
import {
  FX_CALENDAR,
  FX_CALL_DEBIT_SPREAD,
  FX_COVERED_CALL,
  FX_DIAGONAL,
  FX_IRON_BUTTERFLY,
  FX_IRON_CONDOR,
  FX_LONG_CALL,
  FX_LONG_PUT,
  FX_LONG_STRADDLE,
  FX_PROTECTIVE_PUT,
  FX_PUT_CREDIT_SPREAD,
  FX_PUT_DEBIT_SPREAD,
  FX_RATIO_1X2,
  FX_SHARES_LONG,
  FX_SHARES_SHORT,
  FX_SHORT_CALL,
  FX_SHORT_PUT,
  FX_SHORT_STRANGLE,
  FX_SHORT_VERTICAL,
  FX_SIX_LEG,
  FX_ZERO_COST_COLLAR,
  mkLeg,
  mkPosition,
} from './fixtures';
import { netEntryCost } from './leg';
import { MAX_LOSS_ELIGIBLE, maxLossOf } from './maxLoss';
import type { StructureKind } from './structure';
import { STRUCTURE_KINDS, structureKindOf } from './structure';

const of = (p: Parameters<typeof maxLossOf>[0]) => maxLossOf(p, structureKindOf(p));

const FX_SHORT_STRADDLE = mkPosition([
  mkLeg({ side: 'short', right: 'call', strike: 400, entry_price: 12.4 }),
  mkLeg({ side: 'short', right: 'put', strike: 400, entry_price: 11.9 }),
]);
const FX_LONG_STRANGLE = mkPosition([
  mkLeg({ side: 'long', right: 'call', strike: 420, entry_price: 6.1 }),
  mkLeg({ side: 'long', right: 'put', strike: 380, entry_price: 5.6 }),
]);

/** One real position per member, so eligibility is exercised over a leg set the name actually fits. */
const REPRESENTATIVE: Record<StructureKind, ReturnType<typeof mkPosition>> = {
  shares_long: FX_SHARES_LONG,
  shares_short: FX_SHARES_SHORT,
  long_call: FX_LONG_CALL,
  long_put: FX_LONG_PUT,
  short_call: FX_SHORT_CALL,
  short_put: FX_SHORT_PUT,
  call_debit_spread: FX_CALL_DEBIT_SPREAD,
  call_credit_spread: FX_SHORT_VERTICAL,
  put_debit_spread: FX_PUT_DEBIT_SPREAD,
  put_credit_spread: FX_PUT_CREDIT_SPREAD,
  long_straddle: FX_LONG_STRADDLE,
  short_straddle: FX_SHORT_STRADDLE,
  long_strangle: FX_LONG_STRANGLE,
  short_strangle: FX_SHORT_STRANGLE,
  covered_call: FX_COVERED_CALL,
  protective_put: FX_PROTECTIVE_PUT,
  collar: FX_ZERO_COST_COLLAR,
  iron_condor: FX_IRON_CONDOR,
  iron_butterfly: FX_IRON_BUTTERFLY,
  calendar: FX_CALENDAR,
  diagonal: FX_DIAGONAL,
  custom: FX_RATIO_1X2,
};

describe('the eligible set is CLOSED, not detected', () => {
  /**
   * Transcribed from SPEC §2.4's code block (the owner ruling of 2026-07-28), not from the
   * implementation. If the two ever diverge this fails, which is the point: the set is a product
   * decision, and a well-meaning "just add one more" is exactly the drift worth catching.
   */
  it('is EXACTLY the 15 the owner ruled — name for name', () => {
    const RULED: readonly StructureKind[] = [
      'long_call',
      'long_put',
      'short_put',
      'shares_long',
      'long_straddle',
      'long_strangle',
      'call_debit_spread',
      'call_credit_spread',
      'put_debit_spread',
      'put_credit_spread',
      'covered_call',
      'protective_put',
      'collar',
      'iron_condor',
      'iron_butterfly',
    ];
    expect(RULED).toHaveLength(15);
    expect([...MAX_LOSS_ELIGIBLE].sort()).toEqual([...RULED].sort());
  });

  /**
   * The eligible 15 plus the three withheld classes must PARTITION all 22 members — that is what
   * makes the reason set exhaustive (§2.4) and what makes an unrecognised shape ineligible BY
   * CONSTRUCTION rather than by a check someone can forget to add.
   */
  it('each member has a representative position the recogniser actually names that way', () => {
    for (const k of STRUCTURE_KINDS) expect(structureKindOf(REPRESENTATIVE[k])).toBe(k);
  });

  it('the 15 and the three withheld reasons partition all 22 members', () => {
    const byReason: Record<string, StructureKind[]> = {};
    const eligible: StructureKind[] = [];
    for (const k of STRUCTURE_KINDS) {
      const r = maxLossOf(REPRESENTATIVE[k], k);
      if (r.kind === 'figure') eligible.push(k);
      else (byReason[r.reason] ??= []).push(k);
    }
    expect(eligible.sort()).toEqual([...MAX_LOSS_ELIGIBLE].sort());
    expect(byReason.unbounded.sort()).toEqual(
      ['shares_short', 'short_call', 'short_straddle', 'short_strangle'].sort(),
    );
    expect(byReason.multi_expiration.sort()).toEqual(['calendar', 'diagonal'].sort());
    expect(byReason.unnamed_shape).toEqual(['custom']);
    expect(eligible.length + Object.values(byReason).flat().length).toBe(22);
    expect(Object.keys(byReason).sort()).toEqual([
      'multi_expiration',
      'unbounded',
      'unnamed_shape',
    ]);
  });
});

describe('AC-28 — the figure, for the single-leg members too', () => {
  it('a long call loses at most the debit paid', () => {
    expect(of(FX_LONG_CALL)).toEqual({ kind: 'figure', dollars: netEntryCost(FX_LONG_CALL) });
  });

  it('a long put and a long straddle lose at most the debit paid', () => {
    expect(of(FX_LONG_PUT)).toEqual({ kind: 'figure', dollars: netEntryCost(FX_LONG_PUT) });
    expect(of(FX_LONG_STRADDLE)).toEqual({
      kind: 'figure',
      dollars: netEntryCost(FX_LONG_STRADDLE),
    });
  });

  it('100 long shares lose at most entry x qty', () => {
    expect(of(FX_SHARES_LONG)).toEqual({ kind: 'figure', dollars: 25000 });
  });

  it('a short put loses at most (strike - credit) x multiplier x qty', () => {
    // strike 380, 1 contract, credit 9.10 -> 38000 - 910
    expect(of(FX_SHORT_PUT)).toEqual({ kind: 'figure', dollars: 38000 - 910 });
  });

  it('a debit vertical loses at most the net debit', () => {
    expect(of(FX_CALL_DEBIT_SPREAD)).toEqual({ kind: 'figure', dollars: 630 });
    expect(of(FX_PUT_DEBIT_SPREAD)).toEqual({
      kind: 'figure',
      dollars: netEntryCost(FX_PUT_DEBIT_SPREAD),
    });
  });

  it('a credit vertical loses at most width x multiplier x qty minus the credit', () => {
    // $400/$420 call credit spread, credit 630 -> 2000 - 630
    expect(of(FX_SHORT_VERTICAL)).toEqual({ kind: 'figure', dollars: 2000 - 630 });
    expect(of(FX_PUT_CREDIT_SPREAD)).toEqual({ kind: 'figure', dollars: 2000 - 490 });
  });

  it('the wider wing is the one that counts — an asymmetric condor uses it, not the narrow one', () => {
    // put wing 380/400 = 20 wide; call wing 440/500 = 60 wide. Credit = 4.60+4.40-2.10-1.90 = 5.00.
    const asym = mkPosition([
      mkLeg({ side: 'long', right: 'put', strike: 380, entry_price: 2.1 }),
      mkLeg({ side: 'short', right: 'put', strike: 400, entry_price: 4.6 }),
      mkLeg({ side: 'short', right: 'call', strike: 440, entry_price: 4.4 }),
      mkLeg({ side: 'long', right: 'call', strike: 500, entry_price: 1.9 }),
    ]);
    expect(structureKindOf(asym)).toBe('iron_condor');
    expect(of(asym)).toEqual({ kind: 'figure', dollars: 60 * 100 - 500 });
  });

  it('an iron butterfly uses the same wing arithmetic', () => {
    // 380/420/420/460: wings 40 wide; credit = 9.00+8.60-2.10-1.90 = 13.60
    expect(of(FX_IRON_BUTTERFLY)).toEqual({ kind: 'figure', dollars: 40 * 100 - 1360 });
  });

  it('a covered call loses at most its net cost', () => {
    expect(of(FX_COVERED_CALL)).toEqual({ kind: 'figure', dollars: netEntryCost(FX_COVERED_CALL) });
  });

  it('a protective put loses at most the net cost minus what the put guarantees back', () => {
    // 100 shares @ 250 (25,000) + a $240 put @ 5.00 (500) -> worst case 25,500 - 24,000 = 1,500
    expect(of(FX_PROTECTIVE_PUT)).toEqual({ kind: 'figure', dollars: 1500 });
  });

  it('every figure is a finite non-negative number — an UNSIGNED magnitude', () => {
    for (const p of [
      FX_LONG_CALL,
      FX_SHARES_LONG,
      FX_SHORT_PUT,
      FX_CALL_DEBIT_SPREAD,
      FX_SHORT_VERTICAL,
      FX_IRON_CONDOR,
      FX_COVERED_CALL,
      FX_PROTECTIVE_PUT,
      FX_ZERO_COST_COLLAR,
      FX_LONG_STRADDLE,
    ]) {
      const r = of(p);
      expect(r.kind).toBe('figure');
      if (r.kind === 'figure') {
        expect(Number.isFinite(r.dollars)).toBe(true);
        expect(r.dollars).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('AC-29 — no figure and one stated reason, exhaustively three', () => {
  it.each([
    ['unbounded', FX_SHORT_STRANGLE],
    ['unbounded', FX_SHARES_SHORT],
    ['unbounded', FX_SHORT_CALL],
    ['multi_expiration', FX_CALENDAR],
    ['multi_expiration', FX_DIAGONAL],
    ['unnamed_shape', FX_RATIO_1X2],
    ['unnamed_shape', FX_SIX_LEG],
  ])('withholds with reason %s', (reason, p) => {
    expect(of(p)).toEqual({ kind: 'withheld', reason });
  });

  it('never returns 0, null, NaN or Infinity in place of a withheld reason', () => {
    const r = of(FX_SHORT_STRANGLE);
    expect(r).not.toHaveProperty('dollars');
    expect(r.kind).toBe('withheld');
  });

  it('withholds rather than computing when the leg set contradicts the name it was given', () => {
    // An eligible NAME over a leg set that cannot supply its arithmetic must never yield NaN.
    const r = maxLossOf(FX_SHARES_LONG, 'iron_condor');
    expect(r).toEqual({ kind: 'withheld', reason: 'unnamed_shape' });
  });

  it('is total over all 22 kinds: always a finite figure or one of exactly three reasons', () => {
    for (const k of STRUCTURE_KINDS) {
      for (const p of [REPRESENTATIVE[k], FX_IRON_CONDOR, FX_SHARES_LONG, mkPosition([])]) {
        const r = maxLossOf(p, k);
        if (r.kind === 'figure') {
          expect(Number.isFinite(r.dollars), `${k} figure finite`).toBe(true);
          expect(r.dollars, `${k} figure unsigned`).toBeGreaterThanOrEqual(0);
        } else {
          expect(['unbounded', 'multi_expiration', 'unnamed_shape']).toContain(r.reason);
        }
      }
    }
  });
});
