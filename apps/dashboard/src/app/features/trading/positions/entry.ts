/**
 * Entry/fill resolver — decides `entry_mark` + `entry_basis` at open time, under the three modes
 * (ARCHITECTURE_CONTRACT §2). Pure logic over the EXISTING tracked-contract data + the existing
 * `bsPrice` theoretical mark; NO new fetch, NO new endpoint, NO real order path.
 *
 *  - manual : entry = the user's typed price, basis `user_entered`. Succeeds even with no quote/chain.
 *  - market : entry = option_quote.mid (basis `snapshot`) or the theoretical BS mark (basis
 *             `theoretical`); cannot fill when neither resolves (404 / chain unavailable / no IV).
 *  - limit  : rests `pending`; fills on a LIVE cross (mark ≤ limit) at the limit price (basis
 *             `limit_fill`). Cross is evaluated elsewhere (useResting…), never here at open time.
 */
import { bsPrice } from '@/features/trading/model/mark';
import type { OptionRight, TrackedContract } from '@convexa/api';
import type { EntryBasis } from './types';

export interface ResolvedFill {
  mark: number;
  basis: EntryBasis;
}

/**
 * Resolve the MARKET fill for a contract from its tracked stats + the spot used for the BS fallback.
 * Returns null when no live quote AND no theoretical mark can be resolved (the market entry then
 * "cannot fill" — the caller creates no position, surfaces the failure on that attempt only).
 */
export function resolveMarketFill(
  tracked: TrackedContract | null,
  spot: number,
  right: OptionRight,
  strike: number,
): ResolvedFill | null {
  if (!tracked) return null;
  const mid = tracked.option_quote?.mid;
  if (mid != null) return { mark: mid, basis: 'snapshot' };
  if (tracked.iv != null) {
    return { mark: bsPrice(right, spot, strike, tracked.dte, tracked.iv), basis: 'theoretical' };
  }
  return null;
}

/** A MANUAL fill is always the user's typed price; it never depends on a quote. */
export function resolveManualFill(price: number): ResolvedFill {
  return { mark: price, basis: 'user_entered' };
}

/**
 * Would a resting BUY limit fill against this mark? A long buy fills when the LIVE option mark is at
 * or below the limit (you buy at or below your limit). The fill price is the LIMIT price (a
 * conservative, no-look-ahead fill — never better than the limit).
 *
 * `isLiveMark` MUST be true (a non-frozen, non-`last_known` mark): a resting limit never fills off an
 * offline/closed/overnight mark (`[live-vs-static-isolation]`).
 */
export function limitWouldFill(mark: number | null, limit: number, isLiveMark: boolean): boolean {
  if (!isLiveMark || mark == null) return false;
  return mark <= limit;
}

/** The fill basis a resting limit records when it crosses. */
export const LIMIT_FILL_BASIS: EntryBasis = 'limit_fill';
