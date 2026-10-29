/**
 * FE-owned, honest mark + P/L for the ghost trade, plus the operator-config rate and copy.
 *
 * Mark basis ladder (UX_BLUEPRINT "Mark-basis labels"):
 *  - snapshot     : option NBBO mid from the last chain snapshot (exact/anchor).
 *  - modeled (≈)  : between snapshots — re-price from the live underlying move × cached greeks,
 *                   re-anchored to the snapshot mid.
 *  - theoretical  : no vendor quote — Black-Scholes from the cached IV.
 *  - last_known   : stream offline — last computed mark, frozen + ⏸ (never framed as live).
 * Overnight/closed: freeze the anchor; no fake ticks.
 */
import type { OptionRight, TrackedContract } from '@convexa/api';
import type { MarkBasis } from './types';

// Operator-config (tunable) — kept in code in v1; documented as an operator knob.
export const RISK_FREE_RATE = 0.045;

// ---- Black-Scholes (theoretical mark when no NBBO quote) -------------------------------------
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/**
 * `sigma` is the implied volatility as a FRACTION: 0.52 for 52%, 1.5 for 150%. That is the unit
 * `ContractWire.iv` carries: the API's contract route passes the options feed's decimal through, and
 * the demo serves 0.27. It is never a percent. An IV above 100% is common on short-dated and far
 * out-of-the-money contracts, so a value above 1 must not be read as a percent.
 */
export function bsPrice(
  right: OptionRight,
  S: number,
  K: number,
  dte: number,
  sigma: number,
): number {
  const T = Math.max(dte, 1) / 365;
  if (S <= 0 || K <= 0 || sigma <= 0) return 0;
  const d1 =
    (Math.log(S / K) + (RISK_FREE_RATE + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const disc = Math.exp(-RISK_FREE_RATE * T);
  return right === 'call'
    ? S * normCdf(d1) - K * disc * normCdf(d2)
    : K * disc * normCdf(-d2) - S * normCdf(-d1);
}

/**
 * The theoretical mark from a contract's cached IV, or null when Black-Scholes cannot price the
 * contract here. This is the one place that rule lives. The snapshot anchor, the live step and the
 * market-entry fill (positions/entry.ts) all price through here, so a contract it refuses falls
 * through to its next rung: a withheld null mark, or no market fill.
 *  - An IV that is null, not finite, zero or negative is no IV: bsPrice would return 0 for a zero IV
 *    and NaN for a NaN one, a number nobody quoted.
 *  - A spot or strike that is not a positive finite number is unknown, for the same reason: bsPrice
 *    would return 0 for one of 0 or below and NaN for a NaN one. The trade dialog's spot is 0 until
 *    the ticker's bundle loads (`spot={m?.price ?? 0}`), and its strike is `Number(strike)`.
 *  - A contract in its last day (dte below 1) gets no model price. The route counts dte in whole UTC
 *    days, so it is 0 from the evening before expiry. bsPrice floors T at one day, but the feed
 *    solves a same-day IV from the hours actually left, and that IV over a whole day prices far
 *    above the market: in the owner's captures, nearly every same-day contract with no bid priced
 *    above its own ask, by up to $18,200 a contract. This module has no clock to count the hours.
 * Known limit: the mark is not capped at the ask, because the route sends no one-sided quote. With a
 * day or more left, the feed's IV can still price a far out-of-the-money contract with no bid above
 * its ask, by a median under $1 a contract in the same captures.
 */
export function theoreticalMark(
  right: OptionRight,
  S: number,
  K: number,
  dte: number,
  iv: number | null | undefined,
): number | null {
  if (iv == null || !Number.isFinite(iv) || iv <= 0) return null;
  if (!Number.isFinite(S) || S <= 0 || !Number.isFinite(K) || K <= 0) return null;
  if (!Number.isFinite(dte) || dte < 1) return null;
  return bsPrice(right, S, K, dte, iv);
}

export interface MarkResult {
  mark: number | null;
  basis: MarkBasis;
  frozen: boolean; // overnight/closed — display a "market closed" indicator, P/L frozen
}

export interface MarkInputs {
  tracked: TrackedContract; // resolved contract stats (caller handles the null/unavailable case)
  strike: number;
  right: OptionRight;
  anchorSpot: number; // underlying spot at the snapshot the quote/greeks came from
  liveUnderlying: number | null; // current live underlying mid
  isLive: boolean; // a real tick arrived recently
  marketSession: string | null; // premarket|regular|afterhours|overnight|closed
  streamOffline: boolean;
  lastMark: number | null; // last computed mark (for last_known when offline)
}

/** The anchor mark from the snapshot: NBBO mid if present, else theoretical from cached IV (null
 *  when theoreticalMark cannot price the contract). */
function anchorMark(i: MarkInputs): { mark: number | null; basis: MarkBasis } {
  const q = i.tracked.option_quote?.mid;
  if (q != null) return { mark: q, basis: 'snapshot' };
  return {
    mark: theoreticalMark(i.right, i.anchorSpot, i.strike, i.tracked.dte, i.tracked.iv),
    basis: 'theoretical',
  };
}

export function computeMark(i: MarkInputs): MarkResult {
  // 1) Stream offline → keep the last computed mark, frozen + flagged.
  if (i.streamOffline && i.lastMark != null) {
    return { mark: i.lastMark, basis: 'last_known', frozen: false };
  }
  const anchor = anchorMark(i);
  // 2) Overnight / closed (feed not ticking) → freeze the anchor; no modeling, no fake ticks.
  const closed = i.marketSession === 'overnight' || i.marketSession === 'closed';
  if (closed && !i.isLive) return { mark: anchor.mark, basis: anchor.basis, frozen: true };

  // 3) Live → model between snapshots from the underlying move × cached greeks. The model needs
  //    BOTH delta and gamma: a greek the feed did not quote is null, and reading it as 0 would
  //    give a delta-only number labeled modeled. A quote with a missing greek keeps the quote (the
  //    snapshot anchor in step 4). Black-Scholes runs only when there is no quote, which is what
  //    its label says; a market entry fills at the mid, so a model price would move P/L at entry.
  if (i.isLive && i.liveUnderlying != null) {
    const q = i.tracked.option_quote?.mid;
    const { delta, gamma } = i.tracked.greeks;
    if (q != null && delta != null && gamma != null) {
      const dS = i.liveUnderlying - i.anchorSpot;
      const modeled = q + delta * dS + 0.5 * gamma * dS * dS;
      return { mark: modeled, basis: dS !== 0 ? 'modeled' : 'snapshot', frozen: false };
    }
    if (q == null) {
      const theo = theoreticalMark(
        i.right,
        i.liveUnderlying,
        i.strike,
        i.tracked.dte,
        i.tracked.iv,
      );
      if (theo != null) return { mark: theo, basis: 'theoretical', frozen: false };
    }
  }
  // 4) Not live (cold/loading/quiet-but-open feed), or live with a quote but a missing greek →
  //    the snapshot anchor. Live with no quote, when theoreticalMark cannot price off the live
  //    underlying, lands here too: the anchor's price off the snapshot's spot, or a null mark,
  //    withheld.
  return { mark: anchor.mark, basis: anchor.basis, frozen: false };
}

export function pl(
  mark: number | null,
  entryMark: number,
  qty: number,
): { dollar: number | null; pct: number | null } {
  if (mark == null) return { dollar: null, pct: null };
  const dollar = (mark - entryMark) * 100 * qty;
  const pct = entryMark !== 0 ? ((mark - entryMark) / entryMark) * 100 : null;
  return { dollar, pct };
}

// ---- Mark-basis display copy (exact, UX_BLUEPRINT) -------------------------------------------
export const MARK_BASIS_META: Record<MarkBasis, { label: string; tip: string }> = {
  snapshot: {
    label: 'snapshot mid',
    tip: "The option's quoted mid from the last chain snapshot (~every 2 min). Exact at the snapshot.",
  },
  modeled: {
    label: 'modeled',
    tip: "Between snapshots we estimate the option price from the live underlying and the contract's greeks — not a real traded price. It re-anchors to the quoted mid at each snapshot.",
  },
  theoretical: {
    label: 'theoretical',
    tip: 'No live option quote — this is a Black-Scholes estimate from the cached IV. Treat as approximate.',
  },
  last_known: {
    label: 'last known',
    tip: 'Live feed offline — last known mark, not current. Resumes automatically when the feed returns.',
  },
  manual: {
    label: 'user-entered',
    tip: 'The entry price you typed (manual/limit fill mode) — not a market quote.',
  },
};
