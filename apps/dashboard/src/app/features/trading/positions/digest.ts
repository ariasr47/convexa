/**
 * digest — the simulated open-positions digest sent with a rec request (tradeable-rec-inputs
 * SPEC §2.4(b), PLAN F10). CLIENT-supplied, bounded, NEVER persisted server-side. Pure derivation
 * from the durable positions store — `[digested-labels-not-raw-dump]` applies to the book as hard as
 * to the chain: a direction label, leg count, nearest-expiry DTE and a defined max loss (or the
 * stated ineligibility reason the FE already computes) — never the book, never per-leg fills, never
 * P/L history.
 *
 * The reconciled three-state vocabulary (SPEC §2.4): `none_open` (checked, empty) · `not_sent`
 * (old client / disabled / faulted-to-absent) · `unavailable` (the store faulted THIS cycle). A
 * faulted store can NEVER produce `none_open` — that would silently tell a trader they have no
 * exposure when the truth is "we couldn't read the book".
 */
import type {
  OpenPositionsDigest,
  OpenPositionsMaxLoss,
  OpenPositionsThisUnderlying,
} from '@convexa/api';
import type { SimPosition } from './leg';
import { maxLossOf } from './maxLoss';
import { structureKindOf, type StructureKind } from './structure';

const BULLISH: ReadonlySet<StructureKind> = new Set([
  'long_call',
  'short_put',
  'call_debit_spread',
  'put_credit_spread',
  'shares_long',
  'covered_call',
]);
const BEARISH: ReadonlySet<StructureKind> = new Set([
  'long_put',
  'short_call',
  'put_debit_spread',
  'call_credit_spread',
  'shares_short',
]);

function directionOf(kind: StructureKind): string {
  if (BULLISH.has(kind)) return 'bullish';
  if (BEARISH.has(kind)) return 'bearish';
  return 'neutral';
}

/** Whole-days-remaining DTE off the NEAREST option leg's expiration, floored at 0. `null` when the
 *  position carries no option leg (a pure equity position). */
function nearestExpiryDte(p: SimPosition, now: Date): number | null {
  const dates = p.legs
    .map((l) => l.expiration)
    .filter((e): e is string => !!e)
    .map((e) => new Date(`${e}T00:00:00Z`).getTime())
    .filter((t) => Number.isFinite(t));
  if (dates.length === 0) return null;
  const nearest = Math.min(...dates);
  const days = Math.floor((nearest - now.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

function maxLossFor(p: SimPosition, kind: StructureKind): OpenPositionsMaxLoss {
  const result = maxLossOf(p, kind);
  if (result.kind === 'figure') return { state: 'known', value: result.dollars, reason: null };
  return { state: 'ineligible', value: null, reason: result.reason };
}

function thisUnderlyingFor(
  ticker: string,
  positions: SimPosition[],
  now: Date,
): OpenPositionsThisUnderlying | null {
  const matches = positions.filter((p) => p.legs[0]?.ticker.toUpperCase() === ticker.toUpperCase());
  if (matches.length === 0) return null;
  // The single-position case reads cleanest; with several open on the same underlying, the nearest-
  // expiry one is the most decision-relevant to a fresh rec (a same-day roll candidate, e.g.).
  const primary = [...matches].sort((a, b) => {
    const da = nearestExpiryDte(a, now) ?? Infinity;
    const db = nearestExpiryDte(b, now) ?? Infinity;
    return da - db;
  })[0];
  const kind = structureKindOf(primary);
  return {
    direction: directionOf(kind),
    leg_count: primary.legs.length,
    nearest_expiry_dte: nearestExpiryDte(primary, now) ?? 0,
    max_loss: maxLossFor(primary, kind),
  };
}

export interface DigestInput {
  ticker: string;
  /** All OPEN positions across the whole book (any status other than `open` is excluded — a pending
   *  limit or a closed position carries no CURRENT exposure). */
  positions: SimPosition[];
  /** The store's own faulted flag — a faulted read can never resolve to `none_open`. */
  faulted: boolean;
  now?: Date;
}

/**
 * Build the digest. Total: reads only what's already in hand (the store snapshot) — no fetch, no
 * recompute against a live quote.
 *
 * `state` is the CLOSED THREE-MEMBER wire vocabulary (INTERFACE_CONTRACT §5) — there is no fourth
 * "positions open, checked" token. `none_open` is the ONE "the check succeeded" state; whether the
 * portfolio actually holds positions is carried by `portfolio.open_count` / `this_underlying` being
 * populated, never by a separate state member. `not_sent` is a HOST decision (an old client, or the
 * caller deliberately omitting the digest) — this function never returns it; the caller that chooses
 * not to call this at all is what produces `not_sent`.
 */
export function buildOpenPositionsDigest(input: DigestInput): OpenPositionsDigest {
  const now = input.now ?? new Date();
  if (input.faulted) {
    return { source: 'simulated', state: 'unavailable', this_underlying: null, portfolio: null };
  }
  const open = input.positions.filter((p) => p.status === 'open');
  const capitalAtRisk = open.reduce((sum, p) => {
    const kind = structureKindOf(p);
    const result = maxLossOf(p, kind);
    return sum + (result.kind === 'figure' ? result.dollars : 0);
  }, 0);
  return {
    source: 'simulated',
    state: 'none_open',
    this_underlying: thisUnderlyingFor(input.ticker, open, now),
    portfolio: { open_count: open.length, capital_at_risk: open.length > 0 ? capitalAtRisk : null },
  };
}
