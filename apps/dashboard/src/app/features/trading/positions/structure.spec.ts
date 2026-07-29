/**
 * Unit — the recogniser. It is a TOTAL EXACT-MATCH function with no confidence measure: any leg
 * set that is not an exact match for a v1 named structure is `custom`, with no judgement involved.
 * That property is what makes a recogniser bug cosmetic by construction, so the residue cases below
 * are as load-bearing as the positive ones.
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
import { STRUCTURE_KINDS, STRUCTURE_LABELS, STRUCTURE_ORDINAL, structureKindOf } from './structure';

/** The two members with no shared fixture (nothing else in the plan needs them). */
const FX_SHORT_STRADDLE = mkPosition([
  mkLeg({ side: 'short', right: 'call', strike: 400, entry_price: 12.4 }),
  mkLeg({ side: 'short', right: 'put', strike: 400, entry_price: 11.9 }),
]);
const FX_LONG_STRANGLE = mkPosition([
  mkLeg({ side: 'long', right: 'call', strike: 420, entry_price: 6.1 }),
  mkLeg({ side: 'long', right: 'put', strike: 380, entry_price: 5.6 }),
]);

describe('structureKindOf — the named set', () => {
  it.each([
    ['shares_long', FX_SHARES_LONG],
    ['shares_short', FX_SHARES_SHORT],
    ['long_call', FX_LONG_CALL],
    ['long_put', FX_LONG_PUT],
    ['short_call', FX_SHORT_CALL],
    ['short_put', FX_SHORT_PUT],
    ['call_debit_spread', FX_CALL_DEBIT_SPREAD],
    ['call_credit_spread', FX_SHORT_VERTICAL],
    ['put_debit_spread', FX_PUT_DEBIT_SPREAD],
    ['put_credit_spread', FX_PUT_CREDIT_SPREAD],
    ['covered_call', FX_COVERED_CALL],
    ['protective_put', FX_PROTECTIVE_PUT],
    ['collar', FX_ZERO_COST_COLLAR],
    ['long_straddle', FX_LONG_STRADDLE],
    ['short_straddle', FX_SHORT_STRADDLE],
    ['long_strangle', FX_LONG_STRANGLE],
    ['short_strangle', FX_SHORT_STRANGLE],
    ['iron_condor', FX_IRON_CONDOR],
    ['iron_butterfly', FX_IRON_BUTTERFLY],
    ['calendar', FX_CALENDAR],
    ['diagonal', FX_DIAGONAL],
  ])('recognises %s', (kind, p) => {
    expect(structureKindOf(p)).toBe(kind);
  });

  it('covers all 21 named members — the recogniser has no unreachable name', () => {
    const named = STRUCTURE_KINDS.filter((k) => k !== 'custom');
    expect(named).toHaveLength(21);
  });
});

describe('the residue rule — `custom` is the residue of an exact match, never a judgement', () => {
  it.each([
    ['a 1x2 ratio', FX_RATIO_1X2],
    ['a >4-leg exotic', FX_SIX_LEG],
  ])('renders custom for %s', (_name, p) => {
    expect(structureKindOf(p)).toBe('custom');
  });

  it('AC-21 — a non-iron butterfly is custom in v1', () => {
    const p = mkPosition([
      mkLeg({ strike: 380, entry_price: 22 }),
      mkLeg({ strike: 400, side: 'short', qty: 2, entry_price: 12 }),
      mkLeg({ strike: 420, entry_price: 6 }),
    ]);
    expect(structureKindOf(p)).toBe('custom');
  });

  it('AC-21 — a non-iron condor is custom in v1', () => {
    const p = mkPosition([
      mkLeg({ strike: 380, entry_price: 22 }),
      mkLeg({ strike: 400, side: 'short', entry_price: 12 }),
      mkLeg({ strike: 440, side: 'short', entry_price: 6 }),
      mkLeg({ strike: 460, entry_price: 2 }),
    ]);
    expect(structureKindOf(p)).toBe('custom');
  });

  it('a malformed record with null strike/right is custom, not a crash', () => {
    const p = mkPosition([mkLeg({ strike: null, right: null })]);
    expect(structureKindOf(p)).toBe('custom');
  });

  it('an option leg with a null expiration is custom, not a nameable single leg', () => {
    expect(structureKindOf(mkPosition([mkLeg({ expiration: null })]))).toBe('custom');
  });

  it('a multi-underlying leg set is custom (rejected at construction, still nameable here)', () => {
    const p = mkPosition([
      mkLeg({ ticker: 'TSLA', strike: 400 }),
      mkLeg({ ticker: 'NVDA', strike: 420, side: 'short' }),
    ]);
    expect(structureKindOf(p)).toBe('custom');
  });

  it('an empty leg set is custom rather than a throw (never throws into the page)', () => {
    expect(structureKindOf(mkPosition([]))).toBe('custom');
  });

  it('an unequal-qty vertical is custom, and a same-side pair is not a vertical', () => {
    const ratio = mkPosition([
      mkLeg({ strike: 400, qty: 1 }),
      mkLeg({ strike: 420, side: 'short', qty: 3 }),
    ]);
    expect(structureKindOf(ratio)).toBe('custom');
    const sameSide = mkPosition([mkLeg({ strike: 400 }), mkLeg({ strike: 420 })]);
    expect(structureKindOf(sameSide)).toBe('custom');
  });

  it('shares at the wrong ratio are NOT a covered call', () => {
    const p = mkPosition([
      mkLeg({
        kind: 'equity',
        qty: 50,
        multiplier: 1,
        entry_price: 250,
        expiration: null,
        strike: null,
        right: null,
      }),
      mkLeg({ side: 'short', right: 'call', strike: 420, entry_price: 6.1 }),
    ]);
    expect(structureKindOf(p)).toBe('custom');
  });
});

describe('AC-19 — the name never moves on an entry price', () => {
  it('debit vs credit comes from strike geometry, never from entry_price', () => {
    const before = structureKindOf(FX_CALL_DEBIT_SPREAD);
    const corrupted = {
      ...FX_CALL_DEBIT_SPREAD,
      legs: FX_CALL_DEBIT_SPREAD.legs.map((l) => ({ ...l, entry_price: 999 })),
    };
    expect(structureKindOf(corrupted)).toBe(before);
    expect(before).toBe('call_debit_spread');
  });

  it('holds for the credit vertical too — a zeroed price does not flip the name', () => {
    const zeroed = {
      ...FX_SHORT_VERTICAL,
      legs: FX_SHORT_VERTICAL.legs.map((l) => ({ ...l, entry_price: 0 })),
    };
    expect(structureKindOf(zeroed)).toBe('call_credit_spread');
  });
});

describe('AC-17 — determinism', () => {
  it('is insensitive to leg array order', () => {
    const reversed = { ...FX_IRON_CONDOR, legs: [...FX_IRON_CONDOR.legs].reverse() };
    expect(structureKindOf(reversed)).toBe(structureKindOf(FX_IRON_CONDOR));
  });

  it('never mutates the position it is given (the leg order it was handed survives)', () => {
    const order = FX_IRON_CONDOR.legs.map((l) => l.id);
    structureKindOf(FX_IRON_CONDOR);
    expect(FX_IRON_CONDOR.legs.map((l) => l.id)).toEqual(order);
  });

  it('is stable across repeated calls', () => {
    for (const p of [FX_IRON_CONDOR, FX_COVERED_CALL, FX_CALENDAR, FX_SIX_LEG]) {
      expect(structureKindOf(p)).toBe(structureKindOf(p));
    }
  });
});

describe('AC-20 — the map is total and 1:1', () => {
  it('has exactly 22 members', () => {
    expect(STRUCTURE_KINDS).toHaveLength(22);
    expect(new Set(STRUCTURE_KINDS).size).toBe(22);
  });

  it('labels every member exactly once, with no label reused', () => {
    const labels = STRUCTURE_KINDS.map((k) => STRUCTURE_LABELS[k]);
    expect(labels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(22);
  });

  it('orders every member with a distinct declared ordinal — never alphabetical', () => {
    const ords = STRUCTURE_KINDS.map((k) => STRUCTURE_ORDINAL[k]);
    expect(new Set(ords).size).toBe(22);
    const byOrdinal = [...STRUCTURE_KINDS].sort(
      (a, b) => STRUCTURE_ORDINAL[a] - STRUCTURE_ORDINAL[b],
    );
    const byLabel = [...STRUCTURE_KINDS].sort((a, b) =>
      STRUCTURE_LABELS[a].localeCompare(STRUCTURE_LABELS[b]),
    );
    expect(byOrdinal).not.toEqual(byLabel);
    expect(STRUCTURE_ORDINAL.custom).toBe(Math.max(...ords));
  });

  it('AC-16 — no label implies collateral, cash set aside or buying power', () => {
    const forbidden = /collateral|cash|secured|buying power|margin/i;
    for (const k of STRUCTURE_KINDS) expect(STRUCTURE_LABELS[k]).not.toMatch(forbidden);
    expect(STRUCTURE_KINDS).not.toContain('cash_secured_put');
  });

  it('every recognised kind is a declared member (the function cannot invent a name)', () => {
    const kinds = new Set(STRUCTURE_KINDS as readonly string[]);
    for (const p of [
      FX_SHARES_LONG,
      FX_LONG_CALL,
      FX_COVERED_CALL,
      FX_IRON_CONDOR,
      FX_SIX_LEG,
      FX_CALENDAR,
    ]) {
      expect(kinds.has(structureKindOf(p))).toBe(true);
    }
  });
});
