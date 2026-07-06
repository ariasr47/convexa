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

/**
 * Compact big-dollar formatter — sign-FIRST (figure minus U+2212), `$` after the sign, magnitude
 * scaled B/M/K (1 decimal) or a bare integer below 1e3. `−$12.3M`, `$793.2M`, `$36.6B`, `$420`.
 * Display-only; never touches values. `null → '—'`.
 */
export const fmtUsdCompact = (v: number | null): string => {
  if (v == null) return '—';
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a)}`;
};
export const fmtDexM = (v: number | null) => fmtUsdCompact(v);
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

// ---- Projected dealer flow (dealer-flow-projection) — copy + a human-OPEX date helper ----------
// All copy verbatim from UX_BLUEPRINT §5 (the FE specs assert it). fmtUsdCompact is reused for every
// dollar figure; humanOpex is the only new formatter (weekday+month+day beside the ISO date).

/**
 * humanOpex — render an ISO `YYYY-MM-DD` OPEX date as a short weekday+month+day label, e.g.
 * `2026-07-17` -> `Fri Jul 17`. Parsed as a UTC calendar date (no time-zone drift on the date itself);
 * a malformed/empty string falls back to the raw input so the read is never blank. Display-only.
 */
export function humanOpex(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return iso;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${wd} ${mo} ${d.getUTCDate()}`;
}

/** Singular/plural the calendar-day count for the charm horizon line (`1 day` vs `11 days`). */
export const dayCount = (n: number): string => `${n} day${n === 1 ? '' : 's'}`;

/**
 * Explicitly-signed compact dollars for the projection figures — the UX_BLUEPRINT §3 sign-first
 * `+$` / `−$` form (`+$4.2M`, `−$1.9M`). Delegates to the shared `fmtUsdCompact` for the magnitude +
 * the negative `−` (never forks it), and prepends a `+` for a positive value so the dealer-hedging
 * direction is legible at a glance. `0` reads `+$0` (a real computed zero, not a fabricated null); a
 * null stays `—` (fmtUsdCompact's own null handling), never signed. Display-only.
 */
export const fmtSignedUsdCompact = (v: number | null): string => {
  if (v == null) return '—';
  const base = fmtUsdCompact(v);
  return v > 0 ? `+${base}` : base; // negatives already carry `−` from fmtUsdCompact; 0 stays unsigned
};

export const DFP_TITLE = 'Projected dealer flow';
export const DFP_SUBTITLE = 'Snapshot, never live — refreshes with the data load, not the stream.';
export const DFP_INFO =
  'The delta dealers are projected to hedge as time passes (charm) and if implied vol moves (vanna), ' +
  'built from the option structure in your selected expiration window. Charm is a linear, first-order ' +
  'projection to the next monthly OPEX, holding spot & vol; vanna is quoted for a +1 IV-point vol ' +
  'increase (a vol drop flips the sign). Dealer-flow context — the "when/why dealers push," distinct ' +
  'from where the GEX levels pull price. Not a price forecast, not a scored signal, not a guarantee. ' +
  'Snapshot from the last chain load; moves with the expiration window, like GEX/DEX.';

export const CHARM_LABEL = 'Charm · drift into OPEX';
export const CHARM_EMPTY = 'Charm unavailable this cycle.';
export const CHARM_INFO =
  'Expected cumulative delta dealers must hedge from time-decay alone by the next monthly OPEX, holding ' +
  'spot & vol constant — the per-day charm base × the days to OPEX. Linear, first-order (not ' +
  'path-integrated). Window-scoped (moves with your expiration filter). If your window doesn’t reach ' +
  'the OPEX date, it still targets that OPEX — the horizon shows the gap. Dealer-flow context, not a ' +
  'price call.';
/** ISO opex date kept in the charm tooltip for auditability (per §5.2). */
export const charmInfo = (isoOpexDate: string): string => `${CHARM_INFO} (OPEX ${isoOpexDate}.)`;

export const VANNA_LABEL = 'Vanna · per vol move';
export const VANNA_EMPTY = 'Vanna unavailable this cycle.';
export const VANNA_NEGATION = '+ = vol up · a vol drop flips the sign';
export const VANNA_INFO =
  'Expected delta change dealers must hedge if implied vol moves. Quoted for a vol INCREASE: +1 IV ' +
  'point (the base unit) and a +5 IV-point illustrative shock. A vol DECREASE is the exact negation — ' +
  'same magnitude, opposite sign. Instantaneous (no time horizon). Window-scoped, like charm. ' +
  'Dealer-flow context, not a price call.';

/** Footer clause 1 — the linear/first-order framing + the spot basis. */
export const dfpFooterAssumptions = (spotBasis: number): string =>
  `Linear first-order projection at spot $${spotBasis}, holding spot & vol.`;
/** Footer clause 2 — the binding honesty frame (rendered verbatim; the specs assert it). */
export const DFP_HONESTY_FRAME =
  'Dealer-flow context — not a price forecast, not a scored signal, not a guarantee.';
export const DFP_WHOLE_EMPTY = 'Projected dealer flow unavailable this cycle.';

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
