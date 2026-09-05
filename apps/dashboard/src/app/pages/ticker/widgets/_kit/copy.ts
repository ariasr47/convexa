/**
 * Ticker section copy + formatters — extracted verbatim from the TickerDashboard monolith so the new
 * section components (LiveTape, StructureHeroPanel, ReadStrip, TermStructure, FreshPositioning,
 * OffExchangeBlocks, TickerHeader) share one source. **Behavior-preserving move only** — every string
 * + numeric format is byte-identical to the pre-refactor inline definitions (the ticker specs assert
 * this copy). (The old dealer positioning widget is deleted at curvature-v2-desk-and-read FE-8; its
 * two consumers of this file's copy are its successors above.)
 */
import type { IvSkew, TermStructure } from '@convexa/api';

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

/**
 * index-first-defaults AC-4 — the one-line single-name honesty caption (SPEC §4, copy EXACT).
 * `[model-read-carries-its-assumptions]` applied to the whole surface: advisory framing, muted
 * secondary-text token only — never warn/red semantics, never blocking, never a modal. Renders ONLY
 * for a symbol confirmed NOT in the scanner universe (AC-5: unknown ⇒ no caption — absent-is-not-none).
 */
export const SINGLE_NAME_CAVEAT =
  'Single-name read — dealer-positioning evidence is strongest on index and high-liquidity ' +
  'tickers. Treat these levels as context, not a forecast.';

export const LAST_TRADE_TOOLTIP =
  'The last actual trade printed for this ticker, live off the trade tape — use it to reconcile ' +
  "against your broker's last trade (e.g. Webull). This is a readout only: the headline price and " +
  'every level (walls, gamma flip, max pain) stay anchored to the NBBO mid, not to this print. ' +
  'Empty between trades, overnight, and before the session’s first print — it never shows a ' +
  'stale number as current. Pauses with the live stream if it drops.';

/** S1 last-trade tooltip while session_tape is present (replaces LAST_TRADE_TOOLTIP). */
export const LAST_TRADE_REPLAY_TOOLTIP =
  'The last stored trade print on this session day tape. Research readout only — not a live vendor feed. The headline follows the tape mid when session tape is playing; walls / gamma flip / max pain stay on the structure snapshot, not on this print.';

export const LAST_TRADE_NO_TAPE_PRINT = 'Last trade — no tape print at this tape time';

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
  return (
    `ATM implied vol across expirations. ${TERM_STATE_CLAUSE[t.state]} Near (${near?.dte}d) ` +
    `${t.near_iv.toFixed(1)}% vs far (${far?.dte}d) ${t.far_iv.toFixed(1)}%. Cross-tenor by ` +
    `definition (ignores the expiration filter). Single snapshot, no history.`
  );
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
    if (best && !seen.has(best.dte)) {
      seen.add(best.dte);
      out.push(best);
    }
  }
  return out.toSorted((a, b) => a.dte - b.dte);
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
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
    d.getUTCMonth()
  ];
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

// ---- Market context (ai-context-pack) — copy + display maps + formatters ----------------------
// All copy verbatim from the ai-context-pack UX_BLUEPRINT §5 (the FE specs assert it). The display
// maps are the ONLY label source — the FE never re-derives a label from a scalar; an unknown enum
// value maps to `null` (that label's unavailable state), never a raw-enum pass-through.

/**
 * humanSessionDate — the ISO session date rendered weekday+month+day (`2026-07-03` -> `Fri Jul 3`).
 * A neutral alias of the existing `humanOpex` formatter (UX_BLUEPRINT §3: reuse under a neutral
 * alias) — same UTC-calendar parse, same raw-string fallback. Display-only.
 */
export const humanSessionDate = humanOpex;

/** 2dp fixed — close/EMA/HHI/balance/shift/PCR/tilt (display-only; never touches values). */
export const fmt2 = (v: number): string => v.toFixed(2);
/** 1dp fixed — ADX/RSI display (wire carries 2dp; FE displays 1dp) + ATR pct_of_close. */
export const fmt1 = (v: number): string => v.toFixed(1);
/** Explicit sign (`+` / U+2212 `−`) + 2dp — the balance scalar. `0` reads `+0.00`. */
export const fmtSigned2 = (v: number): string => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}`;
/** ATR dollars: 2dp, locale-grouped (`$4.12`, `$1,234.56`). */
export const fmtAtrUsd = (v: number): string =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Center of mass: the wire FRACTION rendered as a signed percent, 1dp (`0.012` -> `+1.2% vs spot`). */
export const mcComLine = (fraction: number): string =>
  `${fraction < 0 ? '−' : '+'}${Math.abs(fraction * 100).toFixed(1)}% vs spot`;

// The 1:1 enum → display maps (UX_BLUEPRINT §5.2, BINDING — one display string per enum value;
// never softened/re-bucketed/replaced by numbers; no other label text exists).
export const MC_DIRECTION_DISPLAY: Record<string, string> = {
  uptrend: 'Uptrend',
  downtrend: 'Downtrend',
  mixed: 'Mixed',
};
export const MC_STRENGTH_DISPLAY: Record<string, string> = {
  weak: 'Weak',
  moderate: 'Moderate',
  strong: 'Strong',
};
export const MC_MOMENTUM_DISPLAY: Record<string, string> = {
  overbought: 'Overbought',
  bullish: 'Bullish',
  neutral: 'Neutral',
  bearish: 'Bearish',
  oversold: 'Oversold',
};
export const MC_CONCENTRATION_DISPLAY: Record<string, string> = {
  concentrated: 'Concentrated',
  mixed: 'Mixed',
  dispersed: 'Dispersed',
};
export const MC_BALANCE_DISPLAY: Record<string, string> = {
  above_skewed: 'Skewed above spot',
  balanced: 'Balanced',
  below_skewed: 'Skewed below spot',
};
export const MC_LOCATION_DISPLAY: Record<string, string> = {
  aligned: 'Aligned',
  rotating: 'Rotating',
  divergent: 'Divergent',
};
export const MC_COMPOSITION_DISPLAY: Record<string, string> = {
  flow_put_tilted: 'Flow put-tilted',
  consistent: 'Consistent',
  flow_call_tilted: 'Flow call-tilted',
};

/** Closed-lookup a wire enum → its pinned display string; unknown/unmapped ⇒ null (that label's
 *  unavailable state — NEVER the raw enum, never invented text). */
export const mcDisplay = (map: Record<string, string>, label: string): string | null =>
  Object.prototype.hasOwnProperty.call(map, label) ? map[label] : null;

// Widget chrome (§5.1).
export const MC_TITLE = 'Market context';
export const MC_SUBTITLE =
  'Context the AI also reads · snapshot, never live — refreshes with the data load, not the stream.';
export const MC_INFO =
  'A pre-digested market-context read, fed to the in-app AI automatically: trend & momentum regime ' +
  "from daily bars, how the dealer-gamma profile is shaped, whether today's option flow sits where " +
  'standing positioning sits, and typical daily range (ATR). Built entirely from data already loaded ' +
  '— labels with their windows and thresholds, never raw series. Advisory context only: it never ' +
  'feeds the opportunity score, tier, gate, or fingerprint, and it is not a forecast or a guarantee. ' +
  'Snapshot from the last data load; never live.';
export const MC_ADVISORY =
  'Advisory context for you and the AI — not a scored signal, not a forecast, not a guarantee.';
export const MC_WHOLE_EMPTY = 'Market context unavailable this cycle.';

// Sub-card titles + row labels (§5.3).
export const MC_TI_TITLE = 'Trend & momentum';
export const MC_SHAPE_TITLE = 'Gamma profile shape';
export const MC_FLOW_TITLE = 'Flow vs positioning · today';
export const MC_ATR_TITLE = 'Average true range';
export const MC_ROW_TREND = 'Trend';
export const MC_ROW_STRENGTH = 'Strength';
export const MC_ROW_MOMENTUM = 'Momentum';
export const MC_ROW_CONCENTRATION = 'Concentration';
export const MC_ROW_BALANCE = 'Balance';
export const MC_ROW_COM = 'Center of mass';
export const MC_ROW_LOCATION = 'Location';
export const MC_ROW_COMPOSITION = 'Composition';
export const MC_ROW_ATR_5D = '5-day';
export const MC_ROW_ATR_14D = '14-day';
export const MC_ROW_ATR_30D = '30-day';

// Scalar-line builders (mono, text.secondary — §5.3). Display-only; never threshold math.
export const mcTrendLine = (d: { close: number; ema20: number; ema50: number }): string =>
  `close ${fmt2(d.close)} · EMA20 ${fmt2(d.ema20)} · EMA50 ${fmt2(d.ema50)}`;
export const mcStrengthLine = (s: { adx: number }): string => `ADX(14) ${fmt1(s.adx)}`;
export const mcMomentumLine = (m: { rsi: number }): string => `RSI(14) ${fmt1(m.rsi)}`;
export const mcConcentrationLine = (hhi: number): string => `HHI ${fmt2(hhi)}`;
export const mcBalanceLine = fmtSigned2;
export const mcLocationLine = (l: { distribution_shift: number }): string =>
  `shift ${fmt2(l.distribution_shift)}`;
export const mcCompositionLine = (c: {
  volume_pcr: number;
  oi_pcr: number;
  tilt_ratio: number;
}): string =>
  `vol PCR ${fmt2(c.volume_pcr)} · OI PCR ${fmt2(c.oi_pcr)} · tilt ${fmt2(c.tilt_ratio)}`;
export const mcAtrLine = (h: { value: number; pct_of_close: number }): string =>
  `${fmtAtrUsd(h.value)} · ${fmt1(h.pct_of_close)}%`;

// Basis lines (visible, no interaction — the AC-4 surface).
export const mcTiBasis = (isoSession: string): string =>
  `As of session ${humanSessionDate(isoSession)} · daily bars · EMA 20/50 · ADX(14) · RSI(14)`;
export const mcShapeBasis = (spotBasis: number, eligibleStrikes: number): string =>
  `At spot $${fmt2(spotBasis)} · ${eligibleStrikes} strikes in the selected window`;
export const MC_FLOW_BASIS =
  "Today's session cumulative option volume, unsigned (no buy/sell side) · vs standing open " +
  'interest · full chain · captured at the last data load';
export const mcAtrBasis = (isoSession: string, closeBasis: number): string =>
  `As of session ${humanSessionDate(isoSession)} · vs close $${fmt2(closeBasis)} · 5/14/30 trading bars`;

// Degraded-state wording (§5.4 — exact strings, the null-copy family; rendered `text.disabled`).
export const MC_TI_EMPTY = 'Trend & momentum unavailable this cycle.';
export const MC_SHAPE_EMPTY = 'Gamma profile shape unavailable this cycle.';
export const MC_FLOW_EMPTY = 'Flow vs positioning unavailable this cycle.';
export const MC_ATR_EMPTY = 'Average true range unavailable this cycle.';
export const MC_TREND_ROW_EMPTY = 'Trend unavailable this cycle.';
export const MC_STRENGTH_ROW_EMPTY = 'Strength unavailable this cycle.';
export const MC_MOMENTUM_ROW_EMPTY = 'Momentum unavailable this cycle.';
export const MC_LOCATION_ROW_EMPTY = 'Location unavailable this cycle.';
export const MC_COMPOSITION_ROW_EMPTY = 'Composition unavailable this cycle.';
export const MC_CELL_EMPTY = 'unavailable this cycle';

// Row-level tooltips (§5.5 — each reveals its window + the exact pinned v1 thresholds).
export const MC_TIP_TREND =
  'Trend direction from daily closes: Uptrend = close above EMA20 above EMA50 (strictly); Downtrend ' +
  '= close below EMA20 below EMA50 (strictly); anything else — including ties — reads Mixed. Needs ' +
  'about 100 daily bars of history; shows unavailable rather than guessing. Context only, not a ' +
  'trade call.';
export const MC_TIP_STRENGTH =
  'Trend strength from Wilder ADX(14) on daily bars: ADX below 20 = Weak, 20–25 = Moderate, 25 and ' +
  'above = Strong. ADX measures how strongly price is trending, not which way — read it with the ' +
  'Trend row. Needs about 43 bars with valid highs/lows; unavailable otherwise.';
export const MC_TIP_MOMENTUM =
  'Momentum state from Wilder RSI(14) on daily closes: 70 and above Overbought, 55–70 Bullish, ' +
  '45–55 Neutral, 30–45 Bearish, 30 and below Oversold. A stretched reading is context about pace, ' +
  'not a reversal signal or an instruction. Needs about 42 bars; unavailable otherwise.';
export const MC_TIP_CONCENTRATION =
  'How concentrated the net-GEX profile is across the strikes in your selected expiration window — ' +
  'normalized HHI from 0 (evenly spread) to 1 (one strike): 0.35 and above Concentrated, 0.15–0.35 ' +
  'Mixed, below 0.15 Dispersed. Needs at least 5 strikes with non-zero net GEX. Same window as the ' +
  'GEX chart.';
export const MC_TIP_BALANCE =
  'Where the gamma weight sits versus spot: the share of |net GEX| strictly above the spot basis ' +
  'minus the share strictly below, from −1 to +1. At +0.20 and above it reads Skewed above spot; at ' +
  '−0.20 and below, Skewed below spot; between, Balanced. Anchored at the same spot basis as the ' +
  'GEX levels.';
export const MC_TIP_COM =
  'The |net GEX|-weighted average strike, shown as its signed distance from the spot basis (+ = ' +
  'above spot, − = below). A single locational scalar — no label, no threshold.';
export const MC_TIP_LOCATION =
  "Where today's option volume sits versus where standing open interest sits, strike by strike — a " +
  'share-vs-share distribution shift from 0 (identical) to 1 (entirely elsewhere): below 0.35 ' +
  'Aligned, 0.35–0.60 Rotating, 0.60 and above Divergent. Volume is unsigned — no buy/sell side, no ' +
  '"smart money" read; location only.';
export const MC_TIP_COMPOSITION =
  "Which right today's volume favors versus the standing book: today's put/call VOLUME ratio " +
  'against the standing put/call OI ratio (tilt = volume PCR ÷ OI PCR). At 1.25 and above, Flow ' +
  'put-tilted; at 0.80 and below, Flow call-tilted; between, Consistent. Put/call composition only ' +
  '— unsigned volume, never a buy/sell claim.';

// Card-level tooltips (§5.5).
export const MC_TIP_ATR_CARD =
  'Average daily true range over the last 5 / 14 / 30 trading bars — a simple mean of true range, ' +
  "where true range spans the day's high–low plus any gap from the prior close. Shown in dollars " +
  'and as a percent of the last close. Typical-range context to sanity-check whether a move is ' +
  'realistic — never a stop, a target, or a distance calculator. A horizon without enough valid ' +
  'bars shows unavailable.';
export const MC_TIP_TI_CARD =
  'A digested read of whether the tape is trending or chopping, from daily bars: direction (close ' +
  'vs EMA20 vs EMA50), strength (ADX 14), and momentum (RSI 14). May include the in-progress ' +
  "session's partial bar — the as-of session date is shown. Each row degrades to unavailable on " +
  'thin history; values change only when new data loads.';
export const MC_TIP_SHAPE_CARD =
  'A shape read over the same net-GEX-by-strike profile the chart shows, in your selected ' +
  'expiration window: how concentrated it is, whether the weight sits above or below spot, and ' +
  'where its center of mass lies. Digest only — the profile chart remains the detail view.';
export const MC_TIP_FLOW_CARD =
  "Whether TODAY's option activity sits where the STANDING positioning sits — by strike (Location) " +
  "and by put/call mix (Composition). Built from today's session cumulative option volume, which " +
  'is unsigned: no buy/sell side, no aggressor, no "smart money" story. Rotation is ' +
  'composition/location information only.';

// ---- IV rank (iv-rank) — copy + closed display maps + basis builders ----------------------------
// All copy verbatim from the iv-rank UX_BLUEPRINT §4/§6 (the FE specs assert it). The FE renders these
// pinned strings, NEVER the wire `window_descriptor`/`basis_descriptor`/`advisory_note` (those exist
// only so the AI export is self-describing; a sentinel test guards non-render). The band + basis are
// displayed via CLOSED lookups — the FE never re-derives the band from `rank`.

// Widget chrome (§4).
export const IVR_TITLE = 'IV rank';
export const IVR_SUBTITLE =
  "Where today's IV sits in this ticker's own recent history — is option premium rich or cheap? " +
  'Context the AI also reads · snapshot, never live.';
export const IVR_INFO =
  "IV rank places today's implied volatility inside this ticker's own accumulated recent history — " +
  "0 = the window's lowest IV, 100 = its highest. High = option premium is relatively rich; low = " +
  'relatively cheap. Advisory context only; never a scored signal.';

// Computed-state labels (§4).
export const IVR_RANK_LABEL = 'IV rank';
export const IVR_PCT_LABEL = 'IV percentile';

/** Headline descriptor (pinned, plain-language, AC-4). `{rank}`/`{window}` substituted at render. */
export const ivrRankDescriptor = (rank: number, windowCap: number): string =>
  `Today's IV sits at the ${rank}th position of its ${windowCap}-session low-to-high range.`;
/** Secondary descriptor (pinned, AC-5). */
export const ivrPctDescriptor = (pct: number): string =>
  `${pct}% of sessions in the window had lower IV than today.`;

/** The digested band token (D2) → its pinned display string. Closed lookup; unknown ⇒ null (no band
 *  renders — never a raw-enum pass-through, never FE-re-derived from the rank). */
export const IVR_BAND_DISPLAY: Record<string, string> = {
  premium_rich: 'premium rich',
  neutral: 'neutral',
  premium_cheap: 'premium cheap',
};
export const ivrBandDisplay = (band: string): string | null =>
  Object.prototype.hasOwnProperty.call(IVR_BAND_DISPLAY, band) ? IVR_BAND_DISPLAY[band] : null;

/** The self-describing basis/envelope line (AC-7 / AC-19), keyed off `iv_basis` via a CLOSED branch.
 *  Clean CM30 vs the honest nearest-tenor fallback wording; an UNKNOWN basis degrades to the clean
 *  wording WITHOUT a fabricated DTE claim (fail-honest). Always visible with the numbers. */
export const ivrBasisLine = (
  sessions: number,
  windowCap: number,
  count: number,
  ivBasis: string,
  basisDte: number,
): string => {
  const head = `Over ${sessions} of the last ${windowCap} sessions · ${count} samples · `;
  if (ivBasis === 'nearest_tenor') {
    return `${head}nearest-tenor IV (~${basisDte}d) — clean 30-day basis unavailable this day.`;
  }
  // 'interpolated_30d' AND any unknown basis → the clean CM30 wording, no fabricated DTE.
  return `${head}~30-day constant-maturity IV.`;
};

/** Advisory footer (verbatim, AC-8) — rendered with Computed + Building; the specs assert it. */
export const IVR_ADVISORY =
  'Advisory context for you and the AI — not a forecast, not a scored signal, not a guarantee.';

// Degenerate-flat + Building + Unavailable wording (§6 — exact strings; the null-copy family).
export const IVR_FLAT_NOTE = 'Rank not meaningful yet — IV has been flat across the window.';
export const ivrBuildingMessage = (n: number, nMin: number): string =>
  `Building history — ${n} of ${nMin} sessions. IV rank appears once enough daily samples accumulate.`;
export const IVR_WHOLE_EMPTY = 'IV rank unavailable this cycle.';

// Tooltips / glossary (§4 — the ⓘ affordances).
export const IVR_TIP_RANK =
  "IV rank = today's IV positioned between the window's lowest and highest IV (0–100). Sensitive to " +
  'a single extreme day.';
export const IVR_TIP_PCT =
  'IV percentile = the share of sessions in the window with lower IV than today (0–100). More robust ' +
  'to a single outlier day than the rank.';
export const IVR_TIP_BAND =
  'Rich (rank ≥ 70) leans toward selling premium / defined-risk credit; cheap (rank < 30) leans ' +
  'toward buying premium / long options; 30–70 is neutral. A descriptive read of the number, not a ' +
  'signal.';
export const IVR_TIP_BASIS =
  'The IV sampled is a constant-maturity ~30-day read interpolated from the term structure. On days ' +
  "the clean 30-day basis isn't available, the nearest tenor is used and shown here honestly.";
/** Building tooltip carries the N_min floor (§4). */
export const ivrTipBuilding = (nMin: number): string =>
  `This ticker builds one IV sample per day it's viewed. Until ${nMin} accumulate, there isn't ` +
  'enough history for a trustworthy rank.';

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

// ---- Product spine #4 — age + basis always visible on structure-bound surfaces ---------------
// Structure = REST bundle / chain snapshot (never the SSE tape). Live tape is labelled separately.

/** "Structure as-of 42s" — the shared phrase for deck freshness + widget subtitles. */
export function structureAsOfPhrase(ageSeconds: number | null | undefined): string {
  if (ageSeconds == null || !Number.isFinite(ageSeconds)) return 'Structure as-of unknown age';
  return `Structure as-of ${humanAge(ageSeconds)}`;
}

/**
 * Append structure age to a widget's basis subtitle. Does not invent age when missing — falls
 * back to an honest "structure snapshot" tag so the surface still names its basis.
 */
export function withStructureAge(basis: string, ageSeconds: number | null | undefined): string {
  if (ageSeconds == null || !Number.isFinite(ageSeconds)) {
    return `${basis} · structure snapshot`;
  }
  return `${basis} · ${structureAsOfPhrase(ageSeconds)}`;
}

export const LIVE_TAPE_SUBTITLE_LIVE = 'Live stream · not the structure snapshot below';
export const LIVE_TAPE_SUBTITLE_OFFLINE =
  'Stream offline · last known ticks · structure levels stay current';
/**
 * (v2) The NO-TICKS-RETAINED arm. `LiveTape.tsx:110` selects on the stream flag ALONE today, so the
 * retention claim in LIVE_TAPE_SUBTITLE_OFFLINE is made unconditionally on every drop — including the
 * drop where nothing was ever retained. Same two-arm discipline owner ruling 2 sets for values.
 */
export const LIVE_TAPE_SUBTITLE_OFFLINE_EMPTY =
  'Stream offline · no ticks retained · structure levels stay current';

/** S1 LiveTape title — from first session_tape payload (including starting). */
export const SESSION_TAPE_TITLE = 'Session tape';

export const SESSION_TAPE_INFO =
  'Reads off the stored session day tape (Path-A trades and quotes). Not a live vendor feed. Structure tiles below stay snapshot reads; they are not this tape claiming live greeks.';

export const SESSION_TAPE_SUBTITLE_ENDED =
  'Session tape ended · last tape ticks · structure levels stay snapshot';

export const SESSION_TAPE_NET_FLOW_INFO_1X =
  "Aggressive buys minus sells over the tape's last few minutes, from stored Path-A trades. Not a live vendor feed. Positive = buyers lifting the ask; negative = sellers hitting the bid.";

export const SESSION_TAPE_NET_FLOW_INFO_FAST =
  'Aggressive buys minus sells from stored Path-A trades. Not a live vendor feed. This number does not name a tape-time window. Positive = buyers lifting the ask; negative = sellers hitting the bid.';

/** Playing / keep-alive / gap / starting subtitle. */
export function sessionTapeSubtitle(symbol: string, humanDate: string): string {
  return `Session day tape · ${symbol} · ${humanDate} · not a live feed`;
}

/** Not-the-armed-day LiveTape subtitle — names the armed identity. */
export function sessionTapeNotThisTickerSubtitle(armedSymbol: string, humanDate: string): string {
  return `Session day tape · ${armedSymbol} · ${humanDate} · not this ticker — not a live feed`;
}

/** GEX chart — spot basis + expiration window + age. */
export function gexProfileSubtitle(
  gexSpot: number | null | undefined,
  expLabel: string,
  ageSeconds: number | null | undefined,
): string {
  const spot =
    gexSpot != null && Number.isFinite(gexSpot) ? `GEX spot $${gexSpot.toFixed(2)}` : 'GEX spot —';
  return withStructureAge(`${spot} · ${expLabel} · snapshot (not live)`, ageSeconds);
}

/** Setups — rule-based, same structure snapshot. */
export function setupsSubtitle(ageSeconds: number | null | undefined): string {
  return withStructureAge('Rule-based · same structure snapshot', ageSeconds);
}
