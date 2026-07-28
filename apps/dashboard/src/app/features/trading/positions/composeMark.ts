/**
 * The mark ladder for a STRUCTURE. `computeMark` (model/mark.ts) stays exactly as it is —
 * per-contract, untouched, NOT generalized to be leg-aware (SPEC §2.5). This composer sits above it.
 *
 * ALL-OR-NOTHING is the hardest rule here: if ANY leg's mark is null, `net_mark` and P/L are null.
 * NEVER a partial sum. The reason is not incompleteness, it is SIGN INVERSION — drop the short leg
 * from a credit spread and a losing position renders as a winner. At the leg level, zeroing a
 * missing member does not shrink the number, it INVERTS it. All three council voices converged on
 * this independently; the pressure to relax it into "a partial sum with an asterisk" must be
 * refused. The mitigation is the leg disclosure: per-leg truth is fully visible; only the
 * AGGREGATE is withheld.
 *
 * Offline and partial-unavailable cannot collapse into one state STRUCTURALLY, not by convention:
 * an SSE drop resolves EVERY leg to `last_known` (a resolved but weak basis — a dimmed number still
 * exists), while a failed leg lookup yields `null` (so the aggregate is withheld).
 *
 * Pure module: no store access, no React, no fetch.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import type { MarkBasis } from '@/features/trading/model/types';
import { legValue, type Leg, type LegId, type SimPosition } from './leg';

export interface PositionMark {
  /** SUM s * mark * multiplier * qty — a DOLLAR net, not a per-unit price. */
  net_mark: number | null;
  /** The WEAKEST leg basis. */
  basis: MarkBasis;
  /** OR across legs. */
  frozen: boolean;
  /** OR across legs — true when at least one leg is unresolved. */
  unavailable: boolean;
  resolved_legs: number;
  total_legs: number;
}

/** snapshot > modeled > theoretical > last_known. `manual` sits at the end: a user-typed price is
 *  not a market read at all, so it can never be the strongest basis in a mixed structure. */
export const BASIS_WEAKNESS: Record<MarkBasis, number> = {
  snapshot: 0,
  modeled: 1,
  theoretical: 2,
  last_known: 3,
  manual: 4,
};

export function composePositionMark(
  legMarks: ReadonlyMap<LegId, MarkResult | null>,
  p: SimPosition,
): PositionMark {
  let net = 0;
  let resolved = 0;
  let frozen = false;
  let weakest: MarkBasis = 'snapshot';
  let anyUnresolved = false;

  for (const l of p.legs) {
    const res = legMarks.get(l.id) ?? null;
    if (res == null || res.mark == null) {
      anyUnresolved = true;
      continue;
    }
    resolved += 1;
    net += legValue(l, res.mark);
    frozen = frozen || res.frozen;
    if (BASIS_WEAKNESS[res.basis] > BASIS_WEAKNESS[weakest]) weakest = res.basis;
  }

  return {
    net_mark: anyUnresolved ? null : net,
    basis: weakest,
    frozen,
    unavailable: anyUnresolved,
    resolved_legs: resolved,
    total_legs: p.legs.length,
  };
}

/**
 * The de-duplication key for the resolver fan-out: distinct `(ticker, expiration, strike, right)`
 * across the WHOLE portfolio, so a condor plus a covered call on the same underlying does not issue
 * duplicate lookups. `null` for an equity leg — an equity leg bypasses the ladder entirely and
 * never issues a contract lookup — and `null` for an option leg whose contract facts were never
 * recorded, which can never be looked up in any cycle.
 */
export function legContractKey(l: Leg): string | null {
  if (l.kind !== 'option') return null;
  if (l.expiration == null || l.strike == null || l.right == null) return null;
  return `${l.ticker.toUpperCase()}|${l.expiration}|${l.strike}|${l.right}`;
}

// ---- What a limit price MEANS for a structure (RULED HERE, F15 Step 3b) -------------------------
//
// The question had never been answered, and the unanswered question was showing up as a UNITS BUG:
// `compositeLimitWouldFill` compared `net_mark` (DOLLARS) against a `limit` every caller supplied
// as a PER-UNIT price. $840 of mark against an $8.40 limit — every resting limit silently stops
// filling. No error, no throw, nothing red.
//
// The three readings are NOT interchangeable:
//
//   (a) a PER-UNIT price on some designated leg — meaningless for a condor, and the naive
//       "apply the same per-unit price to every leg" conversion nets to ZERO on a balanced
//       four-leg structure regardless of the number the trader typed. Actively wrong.
//   (b) a NET DEBIT/CREDIT for the whole structure, in dollars — what a broker's combo order
//       actually takes, and what SPEC §4's `Net debit $840` copy already shows the trader.
//   (c) PER-LEG limits — a different feature entirely.
//
// **THE RULING: (b) is the correct product answer, and v1 does not adopt it durably.** Reading (b)
// would re-interpret the SHIPPED durable `limit_price`, which is per-unit (SPEC §4: `Fills at your
// limit $8.40 · Net debit $840`), on records that already exist. Every existing pending record would
// be read 100x wrong — precisely the class of silent corruption `loss-free-durable-migration` exists
// to prevent, and it would need a migration this release has no budget for. SPEC §1 also puts
// multi-leg simulated ORDERS out of scope, so nothing in v1 needs (b) durably.
//
// **SO, IN v1:** the durable `limit_price` STAYS PER-UNIT and stays SINGLE-LEG-ONLY. `netLimitDollars`
// is defined ONLY for a one-leg position, where per-unit -> dollars is exact. A multi-leg position
// has no interpretable limit and therefore NEVER fills off one — refusing to fill on a number whose
// meaning is undefined is the only honest behaviour, and it is strictly safer than the alternative.
// The entry dialog enforces the same boundary at the input end: Limit (and Market) are single-leg
// modes, stated to the trader rather than silently dropped.
//
// **AND THE UNITS BUG IS MADE UNREPRESENTABLE, NOT MERELY FIXED:** the parameter is a BRANDED type
// that no numeric literal and no per-unit price can inhabit. The only way to obtain one is
// `netLimitDollarsFor`, which owns the conversion. `compositeLimitWouldFill(marks, p, 8.4)` does not
// compile.

declare const NET_LIMIT_DOLLARS_BRAND: unique symbol;

/**
 * A limit expressed as a DOLLAR NET for the whole position — the same units as
 * `PositionMark.net_mark`. Nominal on purpose: a per-unit price is a `number` and a `number` is not
 * assignable here, so the two can never be mixed again.
 */
export type NetLimitDollars = number & { readonly [NET_LIMIT_DOLLARS_BRAND]: 'dollar net' };

/**
 * THE ONE CONVERSION from a durable per-unit `limit_price` to a dollar net.
 *
 * Returns `null` — never a number — when the position's limit is not interpretable:
 *   · no `limit_price` recorded, or
 *   · MORE THAN ONE LEG, where a per-unit price has no defined structure-level meaning (above).
 *
 * For the shipped single-leg long option this is exactly `sign x limit x multiplier x qty`, so
 * `net_mark <= netLimitDollars` reduces to the shipped `mark <= limit`, byte-identically.
 */
export function netLimitDollarsFor(p: SimPosition): NetLimitDollars | null {
  if (p.limit_price == null || !Number.isFinite(p.limit_price)) return null;
  if (p.legs.length !== 1) return null;
  return legValue(p.legs[0], p.limit_price) as NetLimitDollars;
}

/**
 * The composite of `limitWouldFill` (positions/entry.ts): today it requires a live, non-frozen,
 * non-`last_known` mark; the composite version requires that of EVERY leg, so a structure with one
 * stale leg never fills (AC-44).
 *
 * The limit arrives as DOLLARS — see the block above. Both sides of the comparison are now the same
 * unit by TYPE, not by convention.
 */
export function compositeLimitWouldFill(
  legMarks: ReadonlyMap<LegId, MarkResult | null>,
  p: SimPosition,
  netLimitDollars: NetLimitDollars,
): boolean {
  for (const l of p.legs) {
    const res = legMarks.get(l.id) ?? null;
    if (res == null || res.mark == null) return false;
    if (res.frozen || res.basis === 'last_known') return false;
  }
  const composed = composePositionMark(legMarks, p);
  return composed.net_mark != null && composed.net_mark <= netLimitDollars;
}
