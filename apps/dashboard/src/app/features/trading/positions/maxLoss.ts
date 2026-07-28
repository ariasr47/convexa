/**
 * Max loss — a CLOSED ELIGIBLE SET, not a detection heuristic (SPEC §2.4, owner ruling #1-6-11).
 *
 * Eligibility is membership in a set of 15, so an under-detected naked short cannot produce a
 * confident finite number: an unrecognised shape is INELIGIBLE BY CONSTRUCTION. There is no
 * generic max-loss function over an arbitrary leg set, and there must never be one.
 *
 * The figure is STATIC — it is not live-derived, so it never dims and never degrades on an SSE
 * drop — and it renders UNSIGNED. Breakeven and max gain are Future (zero migration cost to add).
 */
import type { Leg, SimPosition } from './leg';
import { netEntryCost } from './leg';
import type { StructureKind } from './structure';

export type MaxLossWithheldReason = 'unbounded' | 'multi_expiration' | 'unnamed_shape';

export type MaxLossResult =
  | { kind: 'figure'; dollars: number }
  | { kind: 'withheld'; reason: MaxLossWithheldReason };

/** The 15. Adding a member later costs ZERO schema and ZERO migration. */
export const MAX_LOSS_ELIGIBLE: ReadonlySet<StructureKind> = new Set([
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
] as const);

/** The three ineligible classes, in the order the reason is chosen. */
const UNBOUNDED: ReadonlySet<StructureKind> = new Set([
  'short_call',
  'short_straddle',
  'short_strangle',
  'shares_short',
] as const);
const MULTI_EXPIRATION: ReadonlySet<StructureKind> = new Set(['calendar', 'diagonal'] as const);

/** Every member whose worst case is simply the debit paid — positive by construction for each. */
const NET_DEBIT_MEMBERS: ReadonlySet<StructureKind> = new Set([
  'long_call',
  'long_put',
  'long_straddle',
  'long_strangle',
  'call_debit_spread',
  'put_debit_spread',
  'shares_long',
  'covered_call',
] as const);

const WITHHELD_UNNAMED: MaxLossResult = { kind: 'withheld', reason: 'unnamed_shape' };

const optionsOf = (p: SimPosition) => p.legs.filter((l) => l.kind === 'option');
const rightsOf = (p: SimPosition, right: 'call' | 'put') =>
  optionsOf(p).filter((l) => l.right === right);
const contractDollars = (l: Leg, strike: number) => strike * l.multiplier * l.qty;

export function maxLossOf(p: SimPosition, kind: StructureKind): MaxLossResult {
  if (!MAX_LOSS_ELIGIBLE.has(kind)) {
    if (UNBOUNDED.has(kind)) return { kind: 'withheld', reason: 'unbounded' };
    if (MULTI_EXPIRATION.has(kind)) return { kind: 'withheld', reason: 'multi_expiration' };
    return WITHHELD_UNNAMED;
  }
  const net = netEntryCost(p); // > 0 debit, < 0 credit
  const dollars = figureFor(p, kind, net);
  // A leg set that cannot supply the arithmetic its name promises withholds rather than printing a
  // NaN: the caller passed a `kind` this position is not, which is a bug, not a risk statement.
  if (dollars == null || !Number.isFinite(dollars)) return WITHHELD_UNNAMED;
  // A negative worst case would mean the structure cannot lose; the eligible set contains no such
  // shape, so a negative here is an arithmetic bug and clamping it to 0 is strictly safer than
  // printing a negative under a `Max loss` header.
  return { kind: 'figure', dollars: Math.max(0, dollars) };
}

/** Per member, one line of arithmetic on the leg set — never a judgement. `null` = cannot compute. */
function figureFor(p: SimPosition, kind: StructureKind, net: number): number | null {
  if (NET_DEBIT_MEMBERS.has(kind)) return net;

  switch (kind) {
    // A cash-settled worst case: the strike is put to you, less the credit you kept.
    case 'short_put': {
      const [put] = rightsOf(p, 'put');
      if (!put || put.strike == null) return null;
      return contractDollars(put, put.strike) - Math.abs(net);
    }

    // The width you cannot escape, less the credit you kept.
    case 'call_credit_spread':
    case 'put_credit_spread': {
      const os = optionsOf(p);
      if (os.length !== 2 || os.some((l) => l.strike == null)) return null;
      const width = Math.abs((os[0].strike as number) - (os[1].strike as number));
      return width * os[0].multiplier * os[0].qty - Math.abs(net);
    }

    // The WIDER wing is the one that can be lost, less the credit kept.
    case 'iron_condor':
    case 'iron_butterfly': {
      const calls = rightsOf(p, 'call');
      const puts = rightsOf(p, 'put');
      if (calls.length !== 2 || puts.length !== 2) return null;
      if ([...calls, ...puts].some((l) => l.strike == null)) return null;
      const callWing = Math.abs((calls[0].strike as number) - (calls[1].strike as number));
      const putWing = Math.abs((puts[0].strike as number) - (puts[1].strike as number));
      return Math.max(callWing, putWing) * calls[0].multiplier * calls[0].qty - Math.abs(net);
    }

    // The shares can fall no further than the strike the long put guarantees back.
    case 'protective_put':
    case 'collar': {
      const [put] = rightsOf(p, 'put');
      if (!put || put.strike == null) return null;
      return net - contractDollars(put, put.strike);
    }

    default:
      return null;
  }
}
