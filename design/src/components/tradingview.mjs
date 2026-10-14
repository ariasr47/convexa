// TradingView's advanced-chart widget as the live Technical tab ships it (adopted 2026-10-13; canon
// Amendments row "Third-party embeds"; apps/dashboard/src/app/pages/ticker/technical-analysis/
// TechnicalAnalysisLive.tsx). A third party's frame drawn as that party's: a dotted provenance chip,
// TradingView's own attribution line untouched, a plain privacy note. Inside the fence TradingView's
// palette stands, green/red candles included (the one exception to direction-hue discipline). The
// candles below are an illustration of the widget for the board, not Convexa data; no text sits in a
// scaled SVG.
import { icon, STAGING_DEMO_URL } from '../lib.mjs';
import { provChip } from './data-states.mjs';

export const TV_CHIP = 'Chart by TradingView · US prices delayed';
// TradingView's default candle and study colours, kept as the widget draws them (third-party palette).
const TV = { up: '#26a69a', down: '#ef5350', ema20: '#2962ff', ema50: '#ff6d00', rsi: '#7e57c2' };
const CLOSES = [205, 207, 204, 209, 212, 210, 214, 213, 216, 211, 209, 213, 217, 219, 218, 221, 220, 223, 219, 222, 225, 224, 222, 226, 228, 225, 227, 226];

export function tvHead(ticker = 'NVDA', { level = 'h2' } = {}) {
  return `<div style="display: flex; flex-direction: column; gap: 8px;"><${level} class="display" style="margin: 0; font-size: 24px; font-weight: 600;">${ticker} daily chart</${level}><p class="dline" style="margin: 0; max-width: 640px; font-size: 13.5px;">Exponential 20- and 50-day averages and RSI 14, the readings the demo computes, drawn here by TradingView from its own prices. They describe the trend; they are not calls to buy or sell.</p><div style="display: flex; flex-wrap: wrap; gap: 8px;">${provChip(TV_CHIP, 'dotted')}</div></div>`;
}
export const tvNote = () => `<p class="dline" style="margin: 0; max-width: 640px; font-size: 12px;">This chart loads from TradingView, which receives your IP address and this page’s address. Convexa doesn’t read, store or compute anything from the prices in it.</p>`;

function candles(n = CLOSES.length) {
  const c = CLOSES.slice(-n), min = 198, max = 234;
  const y = (v) => (1 - (v - min) / (max - min)) * 1000;
  const w = 1000 / c.length;
  let prev = c[0] - 1.5;
  const bars = c.map((cl, i) => { const op = prev; prev = cl; const hi = Math.max(op, cl) + 1.6, lo = Math.min(op, cl) - 1.4; const up = cl >= op; const x = i * w + w * 0.2; return `<line x1="${(x + w * 0.3).toFixed(1)}" x2="${(x + w * 0.3).toFixed(1)}" y1="${y(hi).toFixed(1)}" y2="${y(lo).toFixed(1)}" stroke="${up ? TV.up : TV.down}" vector-effect="non-scaling-stroke"></line><rect x="${x.toFixed(1)}" y="${y(Math.max(op, cl)).toFixed(1)}" width="${(w * 0.6).toFixed(1)}" height="${Math.max(6, Math.abs(y(op) - y(cl))).toFixed(1)}" fill="${up ? TV.up : TV.down}"></rect>`; }).join('');
  const ema = (k, off) => { let e = c[0] - off; return c.map((v, i) => { e = i ? e + (2 / (k + 1)) * (v - off - e) : e; return `${(i * w + w * 0.5).toFixed(1)},${y(e).toFixed(1)}`; }).join(' '); };
  return `${bars}<polyline points="${ema(20, 1.5)}" fill="none" stroke="${TV.ema20}" stroke-width="1.5" vector-effect="non-scaling-stroke"></polyline><polyline points="${ema(50, 6)}" fill="none" stroke="${TV.ema50}" stroke-width="1.5" vector-effect="non-scaling-stroke"></polyline>`;
}
function rsiPane() {
  const r = [48, 52, 46, 55, 60, 56, 62, 60, 64, 52, 48, 55, 62, 66, 63, 68, 65, 70, 58, 63, 68, 66, 60, 66, 70, 62, 64, 61];
  const pts = r.map((v, i) => `${((i + 0.5) * (1000 / r.length)).toFixed(1)},${((1 - v / 100) * 1000).toFixed(1)}`).join(' ');
  return `<rect x="0" y="300" width="1000" height="400" fill="${TV.rsi}" fill-opacity="0.08"></rect><line x1="0" x2="1000" y1="300" y2="300" stroke="${TV.rsi}" stroke-opacity="0.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></line><line x1="0" x2="1000" y1="700" y2="700" stroke="${TV.rsi}" stroke-opacity="0.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></line><polyline points="${pts}" fill="none" stroke="${TV.rsi}" stroke-width="1.5" vector-effect="non-scaling-stroke"></polyline>`;
}

/** The fenced frame. state: 'live' | 'loading' | 'blocked'. Heights match the shipped embed (620 desktop, 480 phone). */
export function tvFrame({ ticker = 'NVDA', height = 620, state = 'live', phoneHeight = 480, mini = false } = {}) {
  if (state === 'blocked') return tvBlocked(ticker);
  const fence = `border: 1px solid rgba(138,155,180,0.18); border-radius: 10px; overflow: hidden; width: 100%; min-width: 0; box-sizing: border-box;`;
  if (state === 'loading') return `<div class="tvf" role="img" aria-label="TradingView chart loading" aria-busy="true" style="${fence} --tvh: ${height}px; --tvph: ${phoneHeight}px;"></div>`;
  const ax = [230, 220, 210].map((v) => `<span style="position: absolute; right: 6px; top: ${((1 - (v - 198) / 36) * 100).toFixed(1)}%; transform: translateY(-50%); font: 400 11px/1 'IBM Plex Mono', monospace; color: var(--steel);">${v}.00</span>`).join('');
  return `<div class="tvf" role="img" aria-label="${ticker} daily price chart with 20- and 50-day EMAs and RSI 14, by TradingView (illustration of the embedded widget)" style="${fence} --tvh: ${height}px; --tvph: ${phoneHeight}px; display: flex; flex-direction: column; background: var(--panel);">
    ${mini ? '' : `<div style="display: flex; align-items: center; gap: 12px; min-height: 36px; padding: 0 10px; border-bottom: 1px solid rgba(138,155,180,0.14); font: 500 12px 'IBM Plex Sans', sans-serif; color: var(--steel);"><span style="color: var(--phosphor); font-weight: 600;">${ticker}</span><span>1D</span><span class="tv-ranges">1D · 5D · 1M · 3M · 6M · YTD · 1Y · 5Y · All</span></div>`}
    <div style="position: relative; flex: 3 1 0; min-height: 0;"><div style="position: absolute; left: 10px; top: 8px; display: flex; flex-direction: column; gap: 4px; font: 400 11px/1.2 'IBM Plex Sans', sans-serif; z-index: 1;"><span style="color: ${TV.ema20};">EMA 20</span><span style="color: ${TV.ema50};">EMA 50</span></div><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: 0; right: 56px; top: 0; bottom: 0; width: calc(100% - 56px); height: 100%;">${candles()}</svg>${ax}</div>
    ${mini ? '' : `<div style="position: relative; flex: 1 1 0; min-height: 0; border-top: 1px solid rgba(138,155,180,0.14);"><span style="position: absolute; left: 10px; top: 6px; font: 400 11px/1 'IBM Plex Sans', sans-serif; color: ${TV.rsi}; z-index: 1;">RSI 14</span><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: 0; top: 0; width: calc(100% - 56px); height: 100%;">${rsiPane()}</svg><span style="position: absolute; right: 6px; top: 30%; transform: translateY(-50%); font: 400 11px/1 'IBM Plex Mono', monospace; color: var(--steel);">70</span><span style="position: absolute; right: 6px; top: 70%; transform: translateY(-50%); font: 400 11px/1 'IBM Plex Mono', monospace; color: var(--steel);">30</span></div>`}
    <div class="tradingview-widget-copyright" style="min-height: 32px; display: flex; align-items: center; padding: 0 10px; border-top: 1px solid rgba(138,155,180,0.14); font: 400 12px 'IBM Plex Sans', sans-serif; color: var(--steel);"><a href="https://www.tradingview.com/symbols/NASDAQ-${ticker}/" rel="noopener noreferrer" style="color: var(--text-info);">${ticker} stock chart</a>&nbsp;by TradingView</div>
  </div>`;
}

export function tvBlocked(ticker = 'NVDA') {
  return `<div role="status" style="display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 8px; background: var(--signal-tint); border: 1px solid var(--signal);">${icon('info', 16, 'style="color: var(--text-info); margin-top: 2px;"')}<div style="display: flex; flex-direction: column; gap: 4px;"><strong style="font-size: 14px;">TradingView’s chart didn’t load.</strong><span class="dline" style="font-size: 13px; color: var(--phosphor);">Its script was blocked or unreachable: a content blocker or the network can stop it. Nothing else on Convexa depends on it.</span><span style="display: flex; flex-wrap: wrap; gap: 4px 16px;"><a href="https://www.tradingview.com/symbols/NASDAQ-${ticker}/" class="t-info" style="min-height: 24px; display: inline-flex; align-items: center;">Open ${ticker} on TradingView →</a><a href="${STAGING_DEMO_URL}" class="t-info" style="min-height: 24px; display: inline-flex; align-items: center;">Try the full demo →</a></span></div></div>`;
}

/** The demo build keeps the authored sample-bar view (TechnicalAnalysisView.tsx). */
export function sampleBarView(ticker = 'NVDA') {
  return `<div class="hd-p is-sample" style="gap: 10px;"><div class="ph"><h3>Technical analysis · ${ticker}</h3><span class="stag k-dashed">Sample series · not recorded market history</span></div><span class="dline" style="font-size: 12px;">1d · USD · 60 synthetic daily bars</span><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr)); gap: 1px; background: var(--line); border-radius: 10px; overflow: hidden;">${[['EMA 20', '219.40'], ['EMA 50', '212.85'], ['RSI 14', '61.2'], ['ADX 14', '24.0'], ['ATR 14', '6.85']].map(([l, v]) => `<div style="background: var(--ink-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px;"><span class="caps">${l}</span><span class="mono" style="font-size: 16px;">${v}</span></div>`).join('')}</div><span class="dline" style="font-size: 11.5px;">Authored scenario · October 7, 2026 · no market feed connected</span></div>`;
}
