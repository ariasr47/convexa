/**
 * Ticker section copy + formatters — extracted verbatim from the TickerDashboard monolith so the new
 * section components (LiveTape, DealerPositioning, TermStructure, FreshPositioning, OffExchangeBlocks,
 * TickerHeader) share one source. **Behavior-preserving move only** — every string + numeric format is
 * byte-identical to the pre-refactor inline definitions (the ticker specs assert this copy).
 */
import type { IvSkew, TermStructure } from '@org/api';

// Fallback for the blocks empty-state copy when a (pre-amendment) bundle omits the threshold.
export const BLOCK_MIN_SHARES_DISPLAY = 5000;

export const BLOCKS_TOOLTIP =
  'Individual large off-exchange ("dark pool") prints from the recent window, ranked by ' +
  'notional (size × price), largest first. Off-exchange volume includes internalized retail ' +
  'and the prints carry no reliable side, so this is positioning context only — never a ' +
  'buy/sell signal. Updates only when new chain data loads, not from the live stream.';
export const PROXIMITY_TOOLTIP =
  'How far this print is from current spot. Above spot is +, below is −. Lets you see at a ' +
  'glance whether it overlaps a wall or the gamma flip.';
export const OFFLINE_CHIP_TOOLTIP =
  'The live stream dropped. The positioning levels and the GEX chart below are still current ' +
  'as of the last data load — only live price, the last trade, spread, net flow and the live ' +
  'gamma flip are paused. Reconnecting automatically; no refresh needed.';

export const LAST_TRADE_TOOLTIP =
  'The last actual trade printed for this ticker, live off the trade tape — use it to reconcile ' +
  "against your broker's last trade (e.g. Webull). This is a readout only: the headline price and " +
  'every level (walls, gamma flip, max pain) stay anchored to the NBBO mid, not to this print. ' +
  'Empty between trades, overnight, and before the session’s first print — it never shows a ' +
  'stale number as current. Pauses with the live stream if it drops.';

export const fmtDexM = (v: number | null) => (v == null ? '—' : `$${(v / 1e6).toFixed(1)}M`);
export const fmtThresh = (t: number) => (Number.isInteger(t) ? t.toFixed(1) : String(t)); // 1 -> "1.0"
export const TERM_BUCKETS = [7, 14, 30, 60, 90]; // nominal display tenors, each mapped to nearest point

const SKEW_BAND = 0.5; // IV points
export function skewState(slope: number): 'fear' | 'greed' | 'balanced' {
  if (slope > SKEW_BAND) return 'fear';
  if (slope < -SKEW_BAND) return 'greed';
  return 'balanced';
}
const SKEW_PHRASE: Record<'fear' | 'greed' | 'balanced', string> = {
  fear: 'downside hedging is bid (fear)',
  greed: 'upside is bid (greed/complacency)',
  balanced: 'balanced',
};
const TERM_STATE_CLAUSE: Record<'contango' | 'backwardation' | 'flat', string> = {
  contango: 'Upward = contango: near-term vol calm vs longer tenors — "normal."',
  backwardation: 'Downward = backwardation: near-term vol elevated — near-term stress / event.',
  flat: 'Flat.',
};

export const netDexTip = (callDex: number | null, putDex: number | null) =>
  `Net dealer delta exposure — the delta analogue of GEX. Shows which way dealer hedging ` +
  `pressure leans across the selected expirations (call ${fmtDexM(callDex)}, put ${fmtDexM(putDex)}). ` +
  `Positioning context only: the hedging implication is indirect — this is not a buy/sell signal ` +
  `and does not mean "dealers are bullish, go long." Moves with the expiration window, like GEX. ` +
  `Snapshot from the last chain load.`;
export const volOiTip = (threshold: number, n: number) =>
  `Chain-wide option volume ÷ open interest — turnover intensity: how much of today's trading is ` +
  `fresh vs standing positions. Activity only — no side, no direction; never bullish/bearish or ` +
  `"smart money." Uses the full chain (ignores the expiration filter). ${n} strike(s) show ` +
  `unusual activity (Vol/OI ≥ ${fmtThresh(threshold)}×) — see Fresh positioning below.`;
export const freshCaption = (threshold: number) =>
  `Strikes trading heavily versus standing open interest (Vol/OI ≥ ${fmtThresh(threshold)}×). ` +
  `Activity, not direction — no side implied.`;
export const skewTip = (s: IvSkew) =>
  `IV skew at the ${s.dte}-DTE tenor (${s.expiration}): downside IV ${s.put_iv.toFixed(1)}% vs ` +
  `upside IV ${s.call_iv.toFixed(1)}% (±25-delta${s.reference === 'moneyness' ? ', fixed-moneyness fallback' : ''}). ` +
  `A read of what volatility is paying for — ${SKEW_PHRASE[skewState(s.slope)]} — not a ` +
  `price-direction call. Single snapshot, no history.`;
export const termTip = (t: TermStructure) => {
  const near = t.points[0];
  const far = t.points[t.points.length - 1];
  return `ATM implied vol across expirations. ${TERM_STATE_CLAUSE[t.state]} Near (${near?.dte}d) ` +
    `${t.near_iv.toFixed(1)}% vs far (${far?.dte}d) ${t.far_iv.toFixed(1)}%. Cross-tenor by ` +
    `definition (ignores the expiration filter). Single snapshot, no history.`;
};

/** Sample the nominal display tenors to the nearest available point; dedupe, plot real dte/atm_iv. */
export function sampleTermPoints(points: TermStructure['points']): TermStructure['points'] {
  const seen = new Set<number>();
  const out: TermStructure['points'] = [];
  for (const b of TERM_BUCKETS) {
    let best: TermStructure['points'][number] | null = null;
    for (const p of points) {
      if (best == null || Math.abs(p.dte - b) < Math.abs(best.dte - b)) best = p;
    }
    if (best && !seen.has(best.dte)) { seen.add(best.dte); out.push(best); }
  }
  return out.sort((a, b) => a.dte - b.dte);
}

/** Conventional DTE label: 0 = expires today (0DTE), 1 = tomorrow, else N days. */
export function dteLabel(dte: number | null): string | undefined {
  if (dte == null) return undefined;
  if (dte <= 0) return 'expires today · 0DTE';
  if (dte === 1) return '1 day to expiry';
  return `${dte} days to expiry`;
}

/** Compact, human-readable age from seconds, e.g. 242779 -> "2d 19h". */
export function humanAge(seconds: number | null): string {
  if (seconds == null) return 'unknown age';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
