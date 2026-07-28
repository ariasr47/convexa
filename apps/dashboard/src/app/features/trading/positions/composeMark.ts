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

/**
 * The composite of `limitWouldFill` (positions/entry.ts): today it requires a live, non-frozen,
 * non-`last_known` mark; the composite version requires that of EVERY leg, so a structure with one
 * stale leg never fills.
 */
export function compositeLimitWouldFill(
  legMarks: ReadonlyMap<LegId, MarkResult | null>,
  p: SimPosition,
  limit: number,
): boolean {
  for (const l of p.legs) {
    const res = legMarks.get(l.id) ?? null;
    if (res == null || res.mark == null) return false;
    if (res.frozen || res.basis === 'last_known') return false;
  }
  const composed = composePositionMark(legMarks, p);
  return composed.net_mark != null && composed.net_mark <= limit;
}
