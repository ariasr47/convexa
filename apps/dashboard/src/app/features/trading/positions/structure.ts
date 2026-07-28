/**
 * StructureKind — DERIVED, TOTAL, NEVER STORED (SPEC §2.3, [digested-labels-not-raw-dump]).
 *
 * The recogniser is a total EXACT-MATCH function with no confidence measure, and must never
 * acquire one. Any leg set that is not an exact match for a structure in the v1 named set renders
 * `custom`, with its leg count. `custom` is the RESIDUE of an exact match, never a judgement — a
 * certainty framing invites a heuristic scorer, which makes the label non-deterministic across
 * renders and destroys the property that carries the whole design: that a recogniser bug is
 * COSMETIC BY CONSTRUCTION, because the label never feeds P/L, fills, persistence or any fetch.
 *
 * `structureKindOf` NEVER reads `entry_price`. The name is a property of what the trader holds,
 * not of what they paid. Debit vs credit comes from STRIKE GEOMETRY.
 *
 * Zero durable bytes: the kind is computed on every render and never written, which is why adding
 * a name later needs no migration.
 */
import type { Leg, SimPosition } from './leg';

export type StructureKind =
  | 'shares_long'
  | 'shares_short'
  | 'long_call'
  | 'long_put'
  | 'short_call'
  | 'short_put'
  | 'call_debit_spread'
  | 'call_credit_spread'
  | 'put_debit_spread'
  | 'put_credit_spread'
  | 'covered_call'
  | 'protective_put'
  | 'collar'
  | 'long_straddle'
  | 'short_straddle'
  | 'long_strangle'
  | 'short_strangle'
  | 'iron_condor'
  | 'iron_butterfly'
  | 'calendar'
  | 'diagonal'
  | 'custom';

/**
 * The DECLARED COMPLEXITY ORDER (SPEC §4 Flows 5): shares -> single leg -> vertical ->
 * straddle/strangle -> covered/protective/collar -> iron condor/butterfly -> calendar/diagonal ->
 * custom. Sort-by-structure follows THIS, never alphabetical and never declaration accident.
 */
export const STRUCTURE_KINDS = [
  'shares_long',
  'shares_short',
  'long_call',
  'long_put',
  'short_call',
  'short_put',
  'call_debit_spread',
  'call_credit_spread',
  'put_debit_spread',
  'put_credit_spread',
  'long_straddle',
  'short_straddle',
  'long_strangle',
  'short_strangle',
  'covered_call',
  'protective_put',
  'collar',
  'iron_condor',
  'iron_butterfly',
  'calendar',
  'diagonal',
  'custom',
] as const satisfies readonly StructureKind[];

/** CLOSED, EXHAUSTIVE, COMPILE-TIME-CHECKED. A new member fails the build until it has a label. */
export const STRUCTURE_LABELS: Record<StructureKind, string> = {
  shares_long: 'Shares',
  shares_short: 'Short shares',
  long_call: 'Long call',
  long_put: 'Long put',
  short_call: 'Short call',
  short_put: 'Short put',
  call_debit_spread: 'Call debit spread',
  call_credit_spread: 'Call credit spread',
  put_debit_spread: 'Put debit spread',
  put_credit_spread: 'Put credit spread',
  long_straddle: 'Long straddle',
  short_straddle: 'Short straddle',
  long_strangle: 'Long strangle',
  short_strangle: 'Short strangle',
  covered_call: 'Covered call',
  protective_put: 'Protective put',
  collar: 'Collar',
  iron_condor: 'Iron condor',
  iron_butterfly: 'Iron butterfly',
  calendar: 'Calendar',
  diagonal: 'Diagonal',
  custom: 'Custom',
};

export const STRUCTURE_ORDINAL: Record<StructureKind, number> = Object.fromEntries(
  STRUCTURE_KINDS.map((k, i) => [k, i]),
) as Record<StructureKind, number>;

// ---- The canonical leg signature ----------------------------------------------------------------

/**
 * Legs sorted by `kind`, `expiration`, `strike`, `right`, `side` — so the recogniser is insensitive
 * to the order legs happen to sit in the record (AC-17). Sorts a COPY: the position handed in is
 * never mutated.
 */
function canonical(legs: readonly Leg[]): Leg[] {
  return [...legs].sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      String(a.expiration ?? '').localeCompare(String(b.expiration ?? '')) ||
      (a.strike ?? 0) - (b.strike ?? 0) ||
      String(a.right ?? '').localeCompare(String(b.right ?? '')) ||
      a.side.localeCompare(b.side),
  );
}

/** An option leg with every option fact present — the only shape any named matcher may consider. */
type OptionLeg = Leg & { expiration: string; strike: number; right: 'call' | 'put' };

const isLong = (l: Leg) => l.side === 'long';
const isShort = (l: Leg) => l.side === 'short';
const distinct = <T>(xs: readonly T[]) => new Set(xs).size;
const sameQty = (ls: readonly Leg[]) => distinct(ls.map((l) => l.qty)) === 1;
const oneOfEachSide = (ls: readonly Leg[]) =>
  ls.filter(isLong).length === 1 && ls.filter(isShort).length === 1;

// `butterfly` and non-iron `condor` are NOT members in v1 — they fall to `custom`, as do ratios,
// backspreads, boxes and jade lizards. Those are ILLUSTRATIVE CONSEQUENCES OF THE RESIDUE RULE,
// not a second list to maintain. Do not add a `cash_secured_put` member: a cash-secured put and a
// naked short put have byte-identical leg sets, and the distinguishing fact is collateral — which
// is not a leg. If the thing that makes a name true is a leg, it can be named; if it is a fact
// about the account, it cannot.

/**
 * Total over every leg set: exactly one name, or `custom`. Never throws, never reads `entry_price`,
 * never consults the store, the marks or the clock.
 */
export function structureKindOf(p: SimPosition): StructureKind {
  const legs = canonical(p.legs);
  if (legs.length === 0) return 'custom';

  // 1. Guards. A migrated record missing an option fact can never be matched (the lift is forbidden
  //    from fabricating one), and a multi-underlying set is not nameable in v1.
  if (distinct(legs.map((l) => l.ticker)) !== 1) return 'custom';
  const equities = legs.filter((l) => l.kind === 'equity');
  const options: OptionLeg[] = [];
  for (const l of legs) {
    if (l.kind !== 'option') continue;
    if (l.expiration == null || l.strike == null || l.right == null) return 'custom';
    options.push(l as OptionLeg);
  }

  // 2. Equity only, one leg.
  if (options.length === 0) {
    if (equities.length !== 1) return 'custom';
    return isLong(equities[0]) ? 'shares_long' : 'shares_short';
  }

  // 3. Option only, one leg.
  if (equities.length === 0 && options.length === 1) {
    const [o] = options;
    if (o.right === 'call') return isLong(o) ? 'long_call' : 'short_call';
    return isLong(o) ? 'long_put' : 'short_put';
  }

  if (equities.length === 0 && options.length === 2) {
    return twoOptionLegs(options);
  }

  if (equities.length === 1 && options.length >= 1 && options.length <= 2) {
    const withEquity = equityPlusOptions(equities[0], options);
    if (withEquity) return withEquity;
  }

  if (equities.length === 0 && options.length === 4) {
    const iron = ironFourLeg(options);
    if (iron) return iron;
  }

  return 'custom';
}

/** Verticals · straddle/strangle · calendar/diagonal — every two-option-leg member. */
function twoOptionLegs(os: readonly OptionLeg[]): StructureKind {
  const [a, b] = os;
  if (!sameQty(os)) return 'custom'; // a ratio is not a vertical (AC-21)

  const sameExpiration = a.expiration === b.expiration;
  const sameRight = a.right === b.right;
  const opposedSides = oneOfEachSide(os);
  const long = os.find(isLong);
  const short = os.find(isShort);

  // 4. Verticals — same expiration, same right, one long one short, distinct strikes. Debit vs
  //    credit is STRIKE GEOMETRY, never a price comparison.
  if (sameExpiration && sameRight && opposedSides && long && short && long.strike !== short.strike) {
    if (a.right === 'call') {
      return long.strike < short.strike ? 'call_debit_spread' : 'call_credit_spread';
    }
    return long.strike > short.strike ? 'put_debit_spread' : 'put_credit_spread';
  }

  // 5. Straddle / strangle — same expiration, one call one put, SAME side.
  if (sameExpiration && !sameRight && a.side === b.side) {
    const equalStrikes = a.strike === b.strike;
    if (isLong(a)) return equalStrikes ? 'long_straddle' : 'long_strangle';
    return equalStrikes ? 'short_straddle' : 'short_strangle';
  }

  // 6. Calendar / diagonal — same right, one long one short, DISTINCT expirations.
  if (!sameExpiration && sameRight && opposedSides && long && short) {
    return long.strike === short.strike ? 'calendar' : 'diagonal';
  }

  return 'custom';
}

/**
 * 7. Covered call · protective put · collar — the three members whose distinguishing element IS a
 *    leg. The share ratio is expressed against the option's STORED multiplier rather than a literal
 *    100, for the same reason the multiplier is stored at all: an adjusted contract is real, and a
 *    hardcoded 100 here would be the very hardcode §2.1 exists to kill.
 */
function equityPlusOptions(equity: Leg, os: readonly OptionLeg[]): StructureKind | null {
  if (!isLong(equity)) return null; // no named member pairs SHORT stock with options in v1
  if (!sameQty(os)) return null;
  const n = os[0].qty;
  if (equity.qty !== os[0].multiplier * n) return null;

  if (os.length === 1) {
    const [o] = os;
    if (o.right === 'call' && isShort(o)) return 'covered_call';
    if (o.right === 'put' && isLong(o)) return 'protective_put';
    return null;
  }

  const put = os.find((o) => o.right === 'put');
  const call = os.find((o) => o.right === 'call');
  if (put && call && isLong(put) && isShort(call)) return 'collar';
  return null;
}

/**
 * 8. Iron condor / iron butterfly — four option legs, one expiration, two calls and two puts, equal
 *    qty across all four, each right pair one long one short with the LONG strike further from the
 *    middle. Equal short strikes ⇒ butterfly; distinct ⇒ condor. A four-leg set that is all calls,
 *    or whose wings sit inside the body, is `custom` — the non-iron condor of AC-21.
 */
function ironFourLeg(os: readonly OptionLeg[]): StructureKind | null {
  if (distinct(os.map((o) => o.expiration)) !== 1) return null;
  if (!sameQty(os)) return null;

  const calls = os.filter((o) => o.right === 'call');
  const puts = os.filter((o) => o.right === 'put');
  if (calls.length !== 2 || puts.length !== 2) return null;
  if (!oneOfEachSide(calls) || !oneOfEachSide(puts)) return null;

  const longCall = calls.find(isLong) as OptionLeg;
  const shortCall = calls.find(isShort) as OptionLeg;
  const longPut = puts.find(isLong) as OptionLeg;
  const shortPut = puts.find(isShort) as OptionLeg;

  // The bought wings are OUTSIDE the sold body — otherwise the risk profile is not an iron shape.
  if (longCall.strike <= shortCall.strike) return null;
  if (longPut.strike >= shortPut.strike) return null;
  if (shortPut.strike > shortCall.strike) return null;

  return shortPut.strike === shortCall.strike ? 'iron_butterfly' : 'iron_condor';
}
