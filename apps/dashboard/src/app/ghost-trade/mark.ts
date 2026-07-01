/**
 * FE-owned, honest mark + P/L for the ghost trade, plus operator-config thresholds and copy.
 *
 * Mark basis ladder (UX_BLUEPRINT "Mark-basis labels"):
 *  - snapshot     : option NBBO mid from the last chain snapshot (exact/anchor).
 *  - modeled (≈)  : between snapshots — re-price from the live underlying move × cached greeks,
 *                   re-anchored to the snapshot mid.
 *  - theoretical  : no vendor quote — Black-Scholes from the cached IV.
 *  - last_known   : stream offline — last computed mark, frozen + ⏸ (never framed as live).
 * Overnight/closed: freeze the anchor; no fake ticks.
 */
import type { OptionRight, TrackedContract } from '@org/api';
import type { MarkBasis } from './types';

// Operator-config (tunable) — kept in code in v1; documented as operator knobs.
export const PL_TARGET_PCT = 25;    // P/L target alert
export const PL_STOP_PCT = -25;     // P/L stop alert
export const DTE_ALERT_THRESHOLD = 7;
export const ADD_QTY_MAX = 10;      // operator cap on total qty after an "Add"
export const RISK_FREE_RATE = 0.045;

// ---- Black-Scholes (theoretical mark when no NBBO quote) -------------------------------------
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** ivInput may be a percent (52) or a fraction (0.52); both accepted. */
export function bsPrice(right: OptionRight, S: number, K: number, dte: number, ivInput: number): number {
  const T = Math.max(dte, 1) / 365;
  const sigma = ivInput > 1 ? ivInput / 100 : ivInput;
  if (S <= 0 || K <= 0 || sigma <= 0) return 0;
  const d1 = (Math.log(S / K) + (RISK_FREE_RATE + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const disc = Math.exp(-RISK_FREE_RATE * T);
  return right === 'call'
    ? S * normCdf(d1) - K * disc * normCdf(d2)
    : K * disc * normCdf(-d2) - S * normCdf(-d1);
}

export interface MarkResult {
  mark: number | null;
  basis: MarkBasis;
  frozen: boolean; // overnight/closed — display a "market closed" indicator, P/L frozen
}

export interface MarkInputs {
  tracked: TrackedContract;     // resolved contract stats (caller handles the null/unavailable case)
  strike: number;
  right: OptionRight;
  anchorSpot: number;           // underlying spot at the snapshot the quote/greeks came from
  liveUnderlying: number | null; // current live underlying mid
  isLive: boolean;              // a real tick arrived recently
  marketSession: string | null; // premarket|regular|afterhours|overnight|closed
  streamOffline: boolean;
  lastMark: number | null;      // last computed mark (for last_known when offline)
}

/** The anchor mark from the snapshot: NBBO mid if present, else theoretical from cached IV. */
function anchorMark(i: MarkInputs): { mark: number | null; basis: MarkBasis } {
  const q = i.tracked.option_quote?.mid;
  if (q != null) return { mark: q, basis: 'snapshot' };
  if (i.tracked.iv != null) {
    return { mark: bsPrice(i.right, i.anchorSpot, i.strike, i.tracked.dte, i.tracked.iv), basis: 'theoretical' };
  }
  return { mark: null, basis: 'theoretical' };
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

  // 3) Live → model between snapshots from the underlying move × cached greeks.
  if (i.isLive && i.liveUnderlying != null) {
    const q = i.tracked.option_quote?.mid;
    const delta = i.tracked.greeks.delta;
    if (q != null && delta != null) {
      const dS = i.liveUnderlying - i.anchorSpot;
      const gamma = i.tracked.greeks.gamma ?? 0;
      const modeled = q + delta * dS + 0.5 * gamma * dS * dS;
      return { mark: modeled, basis: dS !== 0 ? 'modeled' : 'snapshot', frozen: false };
    }
    if (i.tracked.iv != null) {
      return { mark: bsPrice(i.right, i.liveUnderlying, i.strike, i.tracked.dte, i.tracked.iv), basis: 'theoretical', frozen: false };
    }
  }
  // 4) Not live (cold/loading/quiet-but-open feed) → the snapshot anchor.
  return { mark: anchor.mark, basis: anchor.basis, frozen: false };
}

export function pl(mark: number | null, entryMark: number, qty: number): { dollar: number | null; pct: number | null } {
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
