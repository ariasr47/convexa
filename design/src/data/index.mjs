// Sample data — change numbers here, not in screens. Everything is illustrative.
export const SPY = {
  symbol: 'SPY', name: 'SPDR S&P 500 ETF', spot: 573.12, prev: 571.28, gexSpot: 573.05,
  callWall: 580, putWall: 560, flip: 568.5, maxPain: 570, vwap: 571.88, lastTrade: 573.1,
  score: 72, tier: 'Actionable', regime: 'positive gamma',
  strikes: Array.from({ length: 21 }, (_, i) => 550 + i * 2.5),
  asOf: '10:41:52 ET', structureAge: '42s', clock: '10:42:07 ET',
};

export const READ = {
  verdict: 'Trade', bias: 'Bullish', structure: 'Bull call spread', strikes: '575 / 580', expiry: 'Sep 18', dte: 15, confidence: 'high',
  persona: 'Balanced Swinger', model: 'claude-sonnet-5', readsLeft: 3, readsPerDay: 10,
  why: [
    'Mid sits <span class="mono">+0.81%</span> above the gamma flip, so dealer hedging dampens dips into <span class="mono">568.50</span>.',
    'The <span class="mono">580</span> call wall caps the upside — a defined-risk spread pays for the pin, not for a breakout.',
    'IV/HV at <span class="mono">0.82</span> reads cheap: buying the debit is favoured over selling premium.',
  ],
  manage: 'Take half at the call wall; trail the rest above VWAP. Exit on a close below the flip.',
  numbers: ['What the numbers said · candidates tight, median spread <span class="mono">$0.02</span> · candidate set live-session, as of 10:41 ET', '<span class="mono">±$8.40 (1.5%)</span> straddle-implied move for Sep 18'],
  grounding: '3 of 4 checked figures trace to Convexa.',
  cap: 'Within your per-trade cap (<span class="mono">$500</span> · 2% of <span class="mono">$25,000</span>).',
};

// [symbol, price, chg, score, tier, regime, flipDist, callWall, putWall, ivHv, volOi, asOf, status, seed]
export const SCAN_LEAD = [
  ['NVDA', '138.40', '+1.9%', 88, 'Prime', 'positive', '+0.4%', '140', '130', '1.31', '1.8×', '48s', 'ok', 3],
  ['SPY', '573.12', '+0.32%', 72, 'Actionable', 'positive', '−0.8%', '580', '560', '0.82', '0.61×', '42s', 'ok', 7],
  ['AAPL', '228.90', '+0.6%', 66, 'Actionable', 'positive', '+1.1%', '230', '220', '0.94', '0.72×', '1m 05s', 'ok', 5],
  ['QQQ', '486.55', '+0.41%', 54, 'Watch', 'positive', '−1.6%', '490', '475', '0.88', '0.55×', '51s', 'ok', 9],
  ['MSFT', '414.20', '−0.2%', 41, 'Watch', 'positive', '−2.4%', '420', '400', '1.02', '0.40×', '1m 40s', 'ok', 2],
  ['IWM', '221.06', '−0.3%', 22, 'Dormant', 'negative', '−3.1%', '225', '215', '1.12', '0.38×', '2m 10s', 'ok', 11],
];
export const SCAN_REST = [
  ['TSLA', '242.10', '−1.2%', 58, 'Watch', 'negative', '+2.3%', '250', '230', '0.76', '1.1×', '39s', 'ok', 13],
  ['AMD', '158.75', '+2.4%', 63, 'Actionable', 'positive', '+0.9%', '160', '150', '0.91', '0.98×', '55s', 'ok', 4],
  ['META', '512.30', '+0.1%', 37, 'Watch', 'positive', '−1.9%', '520', '500', '1.08', '0.44×', '3m 30s', 'stale', 6],
  ['SMH', '244.60', '+1.1%', 49, 'Watch', 'positive', '−0.6%', '250', '235', '0.97', '0.52×', '1m 12s', 'ok', 8],
  ['XLF', '46.12', '−0.4%', 18, 'Dormant', 'positive', '−4.2%', '47', '45', '1.15', '0.31×', '2m 44s', 'ok', 10],
  ['TLT', '92.40', '+0.7%', 29, 'Dormant', 'negative', '+1.4%', '94', '90', '1.20', '0.36×', '1m 58s', 'ok', 12],
];

export const POSITIONS = [
  { c: 'SPY 575/580 C · Sep 18', s: 'Bull call spread', q: '2', e: '2.10', m: '2.46', pl: '+$142', pct: '+18.4%', d: '+0.36', ml: '$420', x: 'Sep 18', st: 'open', seed: 4, basis: 'live' },
  { c: 'NVDA 140 C · Sep 26', s: 'Long call', q: '1', e: 'limit 3.80', m: 'mark 3.92', pl: '—', pct: '', d: '', ml: '$380', x: 'Sep 26', st: 'pending', seed: 6, basis: 'watching' },
  { c: 'QQQ 480 P · Oct 17', s: 'Long put', q: '1', e: '6.40', m: '≈ 5.95', pl: '−$45', pct: '−7.0%', d: '−0.45', ml: '$640', x: 'Oct 17', st: 'open', seed: 8, basis: 'modeled' },
  { c: 'TSLA 240/230 P · Sep 12', s: 'Bear put spread', q: '1', e: '3.10', m: '4.60', pl: '+$150', pct: '+48.4%', d: '', ml: '$310', x: 'closed Sep 2', st: 'closed', seed: 10, basis: 'closed' },
];

// Built-in persona presets (names, summaries and DTE windows from features/personas/presets.ts).
export const PERSONAS = [
  ['Default (no persona)', 'Today’s standard one-size briefing.', '—', 'moderate'],
  ['Income Keeper', 'Defined-risk premium selling; protect capital.', '20–45', 'conservative'],
  ['Premium Hunter', 'Sells closer/larger premium within defined risk.', '7–30', 'aggressive'],
  ['Steady Swinger', 'High-confidence directional only, small size.', '14–45', 'conservative'],
  ['Balanced Swinger', 'Balanced directional (closest to today’s framing).', '7–45', 'moderate'],
  ['Momentum Rider', 'Momentum in negative gamma, higher conviction.', '7–30', 'aggressive'],
  ['The Protector', 'Downside protection; defined-cost hedges.', '30–45', 'conservative'],
];

export const ALERT_RULES = [
  ['SPY', 'Score gate', 'score ≥ 70', 'armed · evaluated 42s ago on the SPY desk', true, 'live'],
  ['NVDA', 'Level touch', 'gamma flip · 133.20', 'armed · last evaluated 6 min ago', true, ''],
  ['QQQ', 'Level touch', 'price ≥ 490.00', 'armed · needs an open QQQ desk to evaluate', true, ''],
  ['TSLA', 'Tier change', 'any change', 'paused', false, ''],
];

// v4 (2026-10-13): data states, the hybrid source map, the public-data roadmap and the NVDA desk.
export * from './states.mjs';
export * from './hybrid.mjs';
