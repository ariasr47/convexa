// Final · Convexa v1 — the ticker desk (/ticker/:ticker, Overview tab) in its ruled state.
// Staging: SPY on the demo account, every options panel filled with the authored Oct 7 scenario in the v5
// chart forms (dashed frame + hatch = sample, P-8; gamma sign by position and text as well as hue, P-11).
// Production: NVDA with the public panels live and every options-feed panel Not live with a link to the
// same desk on the demo (P-1), plus the "On this page" legend. The v5 "after" forms are not exported from
// screens/v5/families-desk.mjs, so they are adapted here (same data, same marks).
import { icon, v4Notice, v4Page, STAGING_DEMO_URL } from '../../lib.mjs';
import { chartFrame, dataTable, fmt, plot, rangeBar, sparkline, stateBody, ticks } from '../../chart-kit.mjs';
import { SI, SI_GAP } from '../../data/charts.mjs';
import { dataCell, gexBars, provChip, stateTag } from '../../components/data-states.mjs';
import { thirdPartyFrame } from '../../components/charts.mjs';
import { statesBoard } from '../v4/kit.mjs';

export const TK_CSS = `
  /* chart-kit declares the chart roles on :root and [data-scheme="dark"] only, so inside a light board they keep
     the dark values (custom properties resolve where declared). Re-declared here until CHART_CSS does it. */
  [data-scheme="light"] { --c-emph: var(--phosphor); --c-ctx: var(--steel); --c-grid: var(--line); --c-axis: var(--line-2); --c-edge: var(--steel-2); }
  .tkd { padding-top: 24px; display: flex; flex-direction: column; gap: 20px; }
  .tk-mast { display: flex; flex-wrap: wrap; gap: 14px 32px; align-items: flex-end; }
  .tk-mast .who { flex: 999 1 520px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .tk-mast .act { flex: 1 1 300px; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 10px 12px; }
  .tk-mast h1 { margin: 0; font-size: clamp(32px, 3vw, 44px); letter-spacing: -0.02em; line-height: 1; }
  .tk-px { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
  .tk-px .p { font: 500 clamp(26px, 2.6vw, 36px)/1 'IBM Plex Mono', monospace; letter-spacing: -0.01em; }
  .tk-px .c { font: 500 14px 'IBM Plex Mono', monospace; }
  .tkd .hd-syms a { font-weight: 500; color: var(--steel); }
  .tkd .hd-syms a[aria-current="true"] { font-weight: 700; color: var(--phosphor); }
  .tk-sel { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 10px 0 12px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--ink-2); font-size: 13px; }
  .tk-sel .caps { font-size: 11px; }
  .tk-hero { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 16px; align-items: stretch; }
  .tk-row { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 16px; align-items: stretch; }
  .tk-work { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 16px; align-items: stretch; }
  .tk-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .tk-ctx { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
  .tk-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; align-items: stretch; }
  .tk-zone { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; padding-top: 10px; border-top: 1px solid var(--line-2); }
  .tk-zone h2 { margin: 0; font-size: 22px; }
  .tk-strip { display: grid; grid-template-columns: 1.4fr repeat(7, minmax(0, 1fr)); gap: 1px; background: var(--line); border-radius: 10px; overflow: hidden; }
  .tk-strip > div { background: var(--ink-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .tk-strip .v { font: 500 17px/1.2 'IBM Plex Mono', monospace; }
  .tk-strip .s { font-size: 11px; color: var(--steel); line-height: 1.35; }
  .tk-ai { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 24px; }
  .tk-ai ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.55; }
  .tk-risk { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .tk-risk > div { background: var(--ink-2); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .tk-risk .v { font: 500 16px/1.2 'IBM Plex Mono', monospace; }
  .tk-risk .v.u { font-family: 'IBM Plex Sans', sans-serif; border-bottom: 1px dotted var(--steel-2); align-self: flex-start; }
  .tk-verdict { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 28px; line-height: 1.1; letter-spacing: -0.01em; margin: 0; }
  .tk-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); }
  .tk-legend .n { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .tk-legend .i { display: inline-flex; gap: 6px; align-items: center; }
  .tk-nl { display: flex; flex-direction: column; gap: 10px; }
  .tk-nl p { margin: 0; }
  .tk-pos { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: baseline; padding: 10px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .tk-ghost { position: relative; height: 120px; border-radius: 8px; border: 1px dashed var(--line-2); overflow: hidden; }
  .tk-skel { display: block; border-radius: 8px; }
  @media (max-width: 1099px) { .tk-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tk-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); } .tk-work { grid-template-columns: 1fr; } .tk-side { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 899px) { .tk-hero, .tk-row { grid-template-columns: 1fr; } .tk-ctx { grid-template-columns: 1fr; } .tk-ai { grid-template-columns: 1fr; gap: 16px; } }
  @media (max-width: 767px) { .tkd { gap: 16px; padding-top: 16px; } .tk-mast .act { justify-content: flex-start; } .tk-mast .act .btn { width: 100%; min-height: 44px; } .tkd .hd-tabs a { min-height: 44px; } .tkd .hd-syms a { height: 44px; } .tk-cards, .tk-side { grid-template-columns: 1fr; } .tk-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tk-zone h2 { font-size: 20px; } .tkd .hd-p { padding: 16px; } .tkd .btn { min-height: 44px; } .tk-sel { min-height: 44px; flex: 1 1 100%; } .tk-verdict { font-size: 24px; } }
`;

// ---- shared bits ----------------------------------------------------------------------------------
export const DEMO_DESK = (t = 'NVDA') => `${STAGING_DEMO_URL}/ticker/${t}`;
const demoLink = (t = 'NVDA', text = 'See it on the demo') => `<a href="${DEMO_DESK(t)}" class="t-info" style="display: inline-flex; align-items: center; gap: 4px; min-height: 24px; font-size: 13px; font-weight: 500;">${text} →</a>`;
const P = (inner, { sample = false, label = '', style = '' } = {}) => `<section class="hd-p${sample ? ' is-sample' : ''}"${label ? ` aria-label="${label}"` : ''}${style ? ` style="${style}"` : ''}>${inner}</section>`;
const head = (title, tag = '', more = '') => `<div class="ph"><h3>${title}</h3>${tag}${more}</div>`;
const tabsNav = (t, on = 'Overview') => `<nav aria-label="${t}" class="hd-tabs">${[['Overview', ''], ['Technical', '/technical-analysis'], ['Research', '/research']].map(([n, h]) => `<a href="/ticker/${t}${h}"${n === on ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;
const quick = (syms, on) => `<nav aria-label="Quick symbols" class="hd-syms">${syms.map((s) => `<a href="/ticker/${s}"${s === on ? ' aria-current="true"' : ''}>${s}</a>`).join('')}</nav>`;
export const DEMO_SYMS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'];
const PROD_SYMS = ['SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMD'];
const DISCLAIM = '<p class="dline" style="margin: 0;">Research and tools, not investment advice. Figures on this board are illustrative design values.</p>';

// ---- the SPY scenario (v5 families-desk values, the demo's Oct 7 scenario) ------------------------
// Re-based to the demo seed (libs/api/src/lib/demo/catalog/spy.seed.json: base 670, step 0.32 → last close
// about 690.62 on Oct 7) so the board, the seeded paper book (SPY Oct 16 690C) and the demo agree.
// Levels as the demo computes them for SPY on the full expiry set (owner ruling 2026-10-14: where the demo
// and a board disagree, the board follows the demo): call wall 704.02, flip 683.92, put wall 652.22, max pain
// at spot, and the ±2.48 move the Oct 9 at-the-money straddle prices. The bell widths are fitted so the bars
// cross zero once, between 682.5 and 685 (the flip), peak at 705 and bottom at 652.5.
const SPOT = 690.62, FLIP = 683.92, PUTW = 652.22, CALLW = 704.02, PAIN = 690.62, MOVE = 2.48;
const MOVE_EXPIRY = 'Oct 9';
const STRIKES = Array.from({ length: 33 }, (_, i) => 640 + i * 2.5);
const gex = (k) => +((Math.exp(-(((k - CALLW) / 12) ** 2)) * 1.104 - Math.exp(-(((k - PUTW) / 18) ** 2)) * 1.5411 + Math.exp(-(((k - SPOT) / 4) ** 2)) * 0.0424) * 1.8).toFixed(2);
const SAMPLE = { source: 'Sample · shaped like SPY options structure', sourceKind: 'dashed', asof: 'Scenario · Oct 7, 2026 · 2:30 PM ET', kind: 'sample' };

function fieldChart({ height = 300 } = {}) {
  const pts = STRIKES.map((k) => [k, gex(k)]);
  const max = Math.max(...pts.map(([, v]) => Math.abs(v)));
  const fx = 687.5, fv = pts.find(([k]) => k === fx)[1];
  return chartFrame({
    claim: `Dealers are long gamma above the ${fmt.num(FLIP, 2)} flip; the call wall at ${fmt.num(CALLW, 2)} carries the most positive gamma`,
    sub: 'SPY net dealer gamma by strike · $M per 1% move · all expirations · above zero (+γ): dealers long gamma, moves tend to be damped · below zero (−γ): short gamma, moves tend to be amplified',
    body: plot({
      height, pt: 58, pl: 58, pr: 24, prn: 12,
      x: { min: STRIKES[0] - 1.5, max: STRIKES[STRIKES.length - 1] + 1.5, ticks: ticks(640, 720, 20, (v) => String(v)).map((t, i) => ({ ...t, minor: i % 2 === 1 })) },
      y: { min: -max * 1.15, max: max * 1.15, ticks: [{ v: -2, label: '−$2M' }, { v: 0, label: '0' }, { v: 2, label: '+$2M' }] },
      hlines: [{ v: 0, kind: 'zero', label: '+γ above · −γ below' }],
      bars: pts.map(([k, v]) => ({ x: k, v, role: v >= 0 ? 'up' : 'down' })), barW: 12,
      events: [{ x: PUTW, label: { long: `Put wall ${fmt.num(PUTW, 2)}`, short: 'Put' }, title: `Put wall ${fmt.num(PUTW, 2)}`, keep: true }, { x: FLIP, label: { long: `Flip ${fmt.num(FLIP, 2)}`, short: 'Flip' }, title: `Flip ${fmt.num(FLIP, 2)}`, keep: true }, { x: SPOT, label: `Spot ${fmt.num(SPOT, 2)}`, lane: 2 }, { x: CALLW, label: { long: `Call wall ${CALLW}`, short: 'Call' }, title: `Call wall ${CALLW}`, keep: true }], eventLane: { long: 'Levels', short: '' },
      focus: { x: fx, title: `Strike ${fmt.num(fx, 1)} · point 20 of 33`, rows: [{ role: fv >= 0 ? 'up' : 'down', value: `${fmt.signed(fv, 2)}M`, name: fv >= 0 ? '+γ dealers long gamma' : '−γ dealers short gamma' }] },
      aria: `SPY net dealer gamma by strike, ${STRIKES[0]} to ${STRIKES[STRIKES.length - 1]}; flip ${FLIP}, put wall ${PUTW}, call wall ${CALLW}, spot ${SPOT}`,
    }),
    ...SAMPLE, state: 'sample',
    table: dataTable({ caption: 'SPY net dealer gamma by strike, $M per 1% move', cols: ['Strike', 'Net gamma ($M)', 'Sign'], rows: pts.filter((_, i) => i % 2 === 0).map(([k, v]) => [fmt.num(k, 1), fmt.signed(v, 2), { t: v >= 0 ? '+γ long' : '−γ short' }]) }),
  });
}

function ladderChart() {
  const rows = [['Call wall', CALLW, 'up', '+γ'], ['Max pain', PAIN, 'ctx', ''], ['Spot · levels anchor', SPOT, 'emph', ''], ['Gamma flip', FLIP, 'edge', '±'], ['Put wall', PUTW, 'down', '−γ']];
  const sw = (r) => (r === 'up' ? 'var(--up)' : r === 'down' ? 'var(--down)' : r === 'edge' ? 'var(--steel-2)' : r === 'emph' ? 'var(--phosphor)' : 'var(--steel)');
  return chartFrame({
    claim: 'The flip is 1.0% below; the walls sit 1.9% above and 5.6% below',
    sub: `SPY levels by price · distance from the levels anchor $${fmt.num(SPOT, 2)}`,
    body: `<div class="cf-tw" role="region" aria-label="Level ladder" tabindex="0"><table><thead><tr><th scope="col">Level</th><th scope="col">Price</th><th scope="col">Distance</th><th scope="col">$</th></tr></thead><tbody>${rows.map(([l, v, r, s]) => `<tr><th scope="row" class="t"><span style="display: inline-flex; align-items: center; gap: 8px;"><i style="display: inline-block; width: 14px; height: 2px; background: ${sw(r)};${r === 'ctx' ? ' background: repeating-linear-gradient(90deg, var(--steel) 0 4px, transparent 4px 6px);' : ''}"></i>${l}${s ? ` <span class="mono steel" style="font-size: 11px;">${s}</span>` : ''}</span></th><td>${fmt.num(v, 2)}</td><td>${r === 'emph' ? '—' : fmt.signed(((v - SPOT) / SPOT) * 100, 1, '%')}</td><td>${r === 'emph' ? '—' : fmt.signed(v - SPOT, 2)}</td></tr>`).join('')}</tbody></table></div>
      <div class="tk-risk" style="margin-top: 4px;"><div><span class="caps">Regime</span><span class="v" style="font-size: 14px;">+γ long gamma</span><span class="dline" style="font-size: 11px;">above the flip by 1.0%</span></div><div><span class="caps">Implied move</span><span class="v" style="font-size: 14px;">±$${fmt.num(MOVE, 2)}</span><span class="dline" style="font-size: 11px;">ATM straddle · Oct 16</span></div></div>`,
    ...SAMPLE, state: 'sample',
  });
}

function tapeChart() {
  const n = 300; const vals = Array.from({ length: n }, (_, i) => 690.5 + Math.sin(i / 23) * 0.18 + Math.sin(i / 7) * 0.05 + i * 0.0004);
  return chartFrame({
    claim: 'The mid held within 40 cents of the structure mid for five minutes',
    sub: 'SPY mid, one point a second · last 5 minutes · dashed = the structure mid the levels use',
    body: plot({ height: 130, pl: 56, pr: 80, prn: 56, x: { min: 0, max: n - 1, ticks: [{ v: 0, label: '−5 min', align: 0 }, { v: 150, label: '−2.5' }, { v: n - 1, label: 'now', align: 1 }] }, y: { min: 690.1, max: 691.1, ticks: [{ v: 690.3, label: '690.30' }, { v: 690.9, label: '690.90' }] }, hlines: [{ v: 690.55, kind: 'ref' }], series: [{ points: vals.map((v, i) => [i, v]), role: 'emph', width: 1.5, end: 'Mid', endValue: fmt.num(vals[n - 1], 2) }], keyboard: false, aria: 'SPY mid over five minutes, sample' }),
    note: 'In the demo the tape replays the scenario’s session and says so; nothing here is a live print.',
    ...SAMPLE, state: 'sample', stateText: 'Sample · replay',
  });
}

function pathPanel() {
  const s1 = [58, 60, 61, 63, 62, 64, 66, 65, 67, 69, 71, 74], s2 = [-1.9, -1.7, -1.6, -1.2, -1.0, -0.8, -0.9, -0.6, -0.5, -0.4, -0.35, -0.38];
  const ring = (score) => { const r = 20, c = 2 * Math.PI * r; return `<svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="5"></circle><circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--steel)" stroke-width="5" stroke-dasharray="${((score / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 26 26)" data-mark="essential"></circle></svg>`; };
  return P(`${head('Score and structure path', stateTag('sample'))}
    <div style="display: flex; align-items: center; gap: 14px;">${ring(74)}<div style="display: flex; flex-direction: column; gap: 2px;"><span class="caps">Opportunity</span><span class="mono" style="font-size: 22px;">74 <span class="steel" style="font-size: 13px;">of 100</span></span><span class="dline">Actionable · near the call wall, cheap vol</span></div></div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding-top: 10px; border-top: 1px solid var(--line);">${sparkline(s1, { width: 140, height: 26, value: '74', scale: 'score · 0–100 · this session', aria: 'Score from 58 to 74 this session' })}${sparkline(s2, { width: 140, height: 26, value: '−0.38%', scale: 'distance to the flip · own range', aria: 'Distance to the flip from −1.9% to −0.38%' })}</div>
    <span class="dline" style="font-size: 11px;">12 samples · 10:00–10:42 in the scenario, spaced by time</span>
    <div style="margin-top: auto;">${provChip('Sample · shaped like the scanner’s score', 'dashed')}</div>`, { sample: true, label: 'Score and structure path, sample' });
}

function readStrip() {
  const cells = [['Opportunity', '74 · Actionable', 'of 100 · near the call wall'], ['Net DEX', '−$412M', 'dealer delta · −, short'], ['IV / HV', '1.08', 'options a touch rich'], ['IV rank', '34', '1-year range'], ['Vol / OI', '0.61×', 'today vs open interest'], ['IV skew', '+2.4 pts', '25Δ put over call'], ['Term', 'Contango', '7d 14.2 → 90d 18.0'], ['Off-exch. %', '41%', 'of today’s shares']];
  return P(`${head('Read strip', stateTag('sample'), provChip('Sample · shaped like the options chain', 'dashed'))}<div class="tk-strip">${cells.map(([l, v, s]) => `<div><span class="caps">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('')}</div>`, { sample: true, label: 'Read strip, sample' });
}

function aiBrief() {
  return P(`<div class="ph"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: var(--raised-2); color: var(--phosphor);">${icon('sparkle', 15)}</span><h3>Sample analysis · SPY</h3>${stateTag('sample', 'Sample read')}<a href="#whats-sent" class="t-info" style="font-size: 12px; font-weight: 500; min-height: 24px; display: inline-flex; align-items: center;">What’s sent →</a></div>
    <div class="tk-ai">
      <div style="display: flex; flex-direction: column; gap: 12px; min-width: 0;">
        <span class="mono steel" style="font-size: 11px;">Pinned to the scenario snapshot · Oct 7, 2:30 PM ET · Careful sample reader</span>
        <p class="tk-verdict">No trade · sit this one out</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.55;">Spot sits between the flip and the call wall with no directional flow. “No trade” is a complete answer: nothing in this snapshot is worth the risk of a position.</p>
        <div><span class="caps">Why</span><ul style="margin-top: 6px;"><li>Spot is <span class="mono">+1.0%</span> above the flip at <span class="mono">683.92</span>: <span class="mono">+γ</span>, dealer hedging tends to damp moves here.</li><li>The <span class="mono">704.02</span> call wall sits outside the <span class="mono">±$2.48</span> implied move.</li><li>Flow over the last hour nets to about zero.</li></ul></div>
        <div><span class="caps">Re-engage when</span><ul style="margin-top: 6px;"><li>Spot closes below the flip at <span class="mono">683.92</span>, where hedging turns <span class="mono">−γ</span>.</li><li>Or the call wall moves inside the implied move on the next structure refresh.</li></ul></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; min-width: 0;">
        <div class="tk-risk"><div><span class="caps">Watch level</span><span class="v">683.92</span><span class="dline" style="font-size: 11px;">traces to the flip</span></div><div><span class="caps">Call wall</span><span class="v">704.02</span><span class="dline" style="font-size: 11px;">traces to the ladder</span></div><div><span class="caps">Implied move</span><span class="v">±$2.48</span><span class="dline" style="font-size: 11px;">ATM straddle · Oct 9</span></div><div><span class="caps">Flow watch</span><span class="v u">1 hour</span><span class="dline" style="font-size: 11px;">the read’s own · untraced</span></div></div>
        <div style="display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: var(--raised); font-size: 12px; line-height: 1.45; color: var(--steel);">${icon('shield', 14)}<span><strong style="color: var(--phosphor); font-weight: 600;">3 of 4 figures trace to Convexa.</strong> Mono figures come from the structure above; the dotted one is the read’s own.</span></div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;"><button class="btn secondary" type="button">${icon('bell', 14)}Alert me at the flip</button><button class="btn ghost" type="button">${icon('refresh', 14)}View sample analysis</button></div>
        <p class="dline" style="margin: 0;">This is an authored example. No model was called and nothing is sent. A read, not an order.</p>
      </div>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${provChip('Sample · shaped like an AI read', 'dashed')}<span class="cf-asof">Scenario · Oct 7, 2026</span></div>`, { sample: true, label: 'Sample analysis' });
}

function positionPanel() {
  return P(`${head('Paper positions · SPY', stateTag('sample'))}
    <div class="tk-pos" style="border-top: 0; padding-top: 0;"><span class="mono" style="font-weight: 600;">SPY Oct 16 690C × 1</span><span class="mono t-up">▲ +$185</span><span class="dline">Opened at 3.00 · now 4.85 · 9 days left</span><span class="dline">up 62%</span></div>
    <div class="tk-pos"><span class="mono steel" style="font-weight: 600;">QQQ Oct 9 630C × 1</span><span class="mono t-down">▼ −$240</span><span class="dline">Closed · opened at 2.40, expired worthless</span><span class="dline">down 100%</span></div>
    <span class="dline" style="font-size: 11px;">Simulated (paper) on the demo account. Sign is carried by ▲/▼ and +/−, not colour alone.</span>`, { sample: true, label: 'Paper positions, sample' });
}
function ordersPanel() {
  return P(`${head('Sim orders · SPY', stateTag('sample'))}
    <div class="tk-pos" style="border-top: 0; padding-top: 0;"><span class="mono" style="font-weight: 600;">Nov 20 690C · limit 4.25</span><span class="stag k-solid">Triggered</span><span class="dline">Waiting on the scenario’s next fill check</span><button class="btn ghost sm" type="button">Cancel</button></div>
    <div class="tk-pos"><span class="mono steel" style="font-weight: 600;">Oct 16 690C · 1 at 3.00</span><span class="stag k-solid">Filled</span><span class="dline">Opened the position above</span><span></span></div>
    <span class="dline" style="font-size: 11px;">Paper orders on the demo account. Convexa never sends a real order.</span>`, { sample: true, label: 'Sim orders, sample' });
}

function termChart() {
  const T = [[7, 14.2], [14, 15.1], [30, 16.4], [60, 17.3], [90, 18.0]];
  return chartFrame({ claim: 'Contango: 90-day implied vol at 18.0% sits 3.8 points above 7-day', sub: 'SPY at-the-money implied volatility by days to expiry · %', body: plot({ height: 170, pr: 70, prn: 50, pl: 40, x: { min: 0, max: 95, ticks: T.map(([d]) => ({ v: d, label: `${d}d` })) }, y: { min: 12, max: 20, ticks: ticks(12, 20, 4, (v) => (v === 20 ? '20%' : String(v))) }, series: [{ points: T, role: 'emph', dots: true, end: 'Contango', endValue: '+3.8 pts' }], keyboard: false, aria: T.map(([d, v]) => `${d} days ${v}%`).join(', ') }), ...SAMPLE, state: 'sample' });
}
function straddleChart() {
  const lo = 645, hi = 712;
  return chartFrame({ claim: `Options price a ±$${fmt.num(MOVE, 2)} move (±${fmt.num((MOVE / SPOT) * 100, 1)}%) by ${MOVE_EXPIRY}; both walls sit outside it`, sub: `SPY at-the-money straddle, ${MOVE_EXPIRY} expiry · the move it implies, on the levels’ price scale`, body: `<div style="padding: 18px 0 4px;">${rangeBar({ lo, hi, band: [SPOT - MOVE, SPOT + MOVE], now: SPOT, labels: [{ v: PUTW, text: `Put wall ${PUTW}` }, { v: SPOT - MOVE, text: fmt.num(SPOT - MOVE, 2), row: 2 }, { v: SPOT + MOVE, text: fmt.num(SPOT + MOVE, 2), row: 2 }, { v: CALLW, text: `Call wall ${CALLW}` }], aria: `Implied move ±${MOVE} around ${SPOT}` })}</div>`, ...SAMPLE, state: 'sample' });
}
function magnetChart() {
  const lo = 645, hi = 712, Pc = (v) => (((v - lo) / (hi - lo)) * 100).toFixed(2);
  return chartFrame({ claim: `Spot ${fmt.num(SPOT, 2)} sits ${fmt.num(((SPOT - FLIP) / SPOT) * 100, 1)}% above the flip, inside the +γ zone below the call wall`, sub: 'SPY levels on one price scale · where dealers are positioned, not a forecast', body: `<div style="position: relative; height: 92px; margin: 8px 0 0;"><span style="position: absolute; left: 0; right: 0; top: 40px; height: 2px; background: var(--line);"></span><span style="position: absolute; top: 30px; height: 22px; left: ${Pc(FLIP)}%; width: ${(Pc(CALLW) - Pc(FLIP)).toFixed(2)}%; background: var(--c-band); border-top: 1px solid var(--c-edge); border-bottom: 1px solid var(--c-edge);"></span>${[[PUTW, '−γ Put wall', 'down'], [FLIP, 'Flip', 'edge'], [CALLW, '+γ Call wall', 'up']].map(([v, l, r], i) => `<span data-mark="essential" style="position: absolute; top: 22px; height: 38px; left: ${Pc(v)}%; border-left: 2px solid var(--${r === 'edge' ? 'steel-2' : r});"></span><span style="position: absolute; top: ${i === 1 ? 64 : 0}px; left: ${Pc(v)}%; transform: translateX(${i === 2 ? '-100%' : i === 0 ? '0' : '-50%'}); font: 500 11px/1.3 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; text-align: ${i === 2 ? 'right' : 'left'};">${l}${i === 1 ? ' ' : '<br>'}${fmt.num(v, 2)}</span>`).join('')}<span data-mark="essential" style="position: absolute; top: 33px; left: ${Pc(SPOT)}%; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: var(--phosphor); box-shadow: 0 0 0 2px var(--panel);"></span><span style="position: absolute; top: 0; left: ${Pc(SPOT)}%; transform: translateX(-50%); font: 600 11px 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap;">Spot</span></div><p class="cf-note" style="color: var(--phosphor);">Above ${fmt.num(FLIP, 2)} dealers are long gamma (+γ): hedging tends to damp moves. Below it they are short gamma (−γ): hedging tends to amplify them.</p>`, ...SAMPLE, state: 'sample' });
}
const sampleCard = (title, value, line, chip, sans = false) => P(`${head(title, stateTag('sample'))}<span class="${sans ? '' : 'mono'}" style="font-size: ${sans ? 16 : 18}px;${sans ? ' font-weight: 600;' : ''}">${value}</span><span class="dline">${line}</span><div style="margin-top: auto;">${provChip(chip, 'dashed')}</div>`, { sample: true });

// =================================================================================================
// Staging · the demo account (SPY)
// =================================================================================================
export function deskStagingBody({ minHeight = 0, scheme = 'dark', t = 'SPY' } = {}) {
  const mast = `<div class="tk-mast">
    <div class="who">
      <div style="display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;"><h1 class="display">${t}</h1><span class="steel" style="font-size: 14px;">SPDR S&amp;P 500 ETF · NYSE Arca</span></div>
      <div class="tk-px"><span class="p">${fmt.num(SPOT, 2)}</span><span class="c t-up">▲ +2.19 (+0.32%)</span><span class="stag k-solid">+γ long gamma above ${fmt.num(FLIP, 2)}</span>${provChip('Shaped like a delayed SPY quote · Oct 7, 2:30 PM ET', 'dashed')}</div>
    </div>
    <div class="act">${tabsNav(t)}<span class="tk-sel"><span class="caps">Expirations</span><strong style="font-weight: 600;">All</strong>${icon('chevron', 14)}</span></div>
  </div>${quick(DEMO_SYMS, t)}`;
  const hero = `<div class="tk-hero">${fieldChart()}${ladderChart()}</div><div class="tk-row">${tapeChart()}${pathPanel()}</div>`;
  const work = `<div class="tk-work">${aiBrief()}<div class="tk-side">${positionPanel()}${ordersPanel()}</div></div>`;
  const ctx = `<div class="tk-zone"><h2 class="display">Context</h2><span class="dline" style="font-size: 13px;">Slower reads around the structure. Every panel runs the Oct 7 scenario.</span></div>
    <div class="tk-row">${magnetChart()}${termChart()}</div>${straddleChart()}
    <div class="tk-cards">${sampleCard('Dealer flow projection', '−$412M', 'delta drift to Oct 16 from charm and vanna', 'Sample · shaped like dealer flow')}${sampleCard('Fresh positioning · Vol/OI', '695C 2.4× · 700C 1.9×', 'strikes where today’s volume outruns open interest', 'Sample · shaped like the chain')}${sampleCard('Off-exchange blocks', '$31M · 54,100 sh', 'largest print, 10:41 in the scenario · ATS', 'Sample · shaped like block prints')}${sampleCard('Setups', 'Near call wall · IV cheap', '2 of the scanner’s named setups match', 'Sample · shaped like scanner setups', true)}</div>`;
  return v4Page({ scheme, minHeight, demo: true, active: 'ticker', label: `${t} desk`, main: `<div class="wrap tkd">${mast}${hero}${readStrip()}${work}${ctx}${DISCLAIM}</div>` });
}

// =================================================================================================
// Production · the portfolio site (NVDA): public data live, options panels Not live
// =================================================================================================
const nlFrame = (claim, sub, would, t = 'NVDA', h = 150) => chartFrame({ claim, sub, state: 'notLive', body: stateBody('notLive', { height: h, text: `<strong>Would show</strong> ${would}`, cause: 'Off because it reads the options chain, a paid feed this site doesn’t run. Public data on this page is live.', action: demoLink(t) }) });
const nlPanel = (title, would, t = 'NVDA', extra = '') => P(`${head(title, stateTag('notLive'))}<div class="tk-nl"><p class="dline"><strong style="color: var(--phosphor);">Would show</strong> ${would}</p><p class="dline"><strong style="color: var(--phosphor);">Off because</strong> it needs the options feed, which this site doesn’t run.</p>${extra}<div style="margin-top: auto;">${demoLink(t)}</div></div>`, { label: `${title}, not live` });

function siCompact({ height = 150 } = {}) {
  const k = 311 / SI[SI.length - 1].shares; const S = SI.slice(-12).map((s) => ({ ...s, shares: +(s.shares * k).toFixed(1) }));
  const gap = SI_GAP - (SI.length - 12);
  return chartFrame({
    claim: `Shares sold short rose ${Math.round((S[S.length - 1].shares / S[0].shares - 1) * 100)}% in six months, to 311M (1.3% of the float)`, sub: 'NVDA short interest at each FINRA settlement · millions of shares · last 12 settlements · 2.75 days to cover',
    state: 'delayed', stateText: 'Delayed · 9 days',
    body: plot({ height, pr: 16, prn: 8, pl: 46, pt: 22, keyboard: false, x: { min: -0.6, max: S.length - 0.4, ticks: S.filter((_, i) => i % 3 === 0).map((s, i) => ({ v: i * 3, label: { long: s.label, short: s.label.split(' ')[0] } })) }, y: { min: 0, max: 300, ticks: ticks(0, 300, 150, (v) => (v === 300 ? '300M' : String(v))) }, hlines: [{ v: 0, kind: 'zero' }], bars: S.map((s, i) => ({ x: i, v: s.shares, role: i === S.length - 1 ? 'emph' : 'ctx', label: i === S.length - 1 ? `${fmt.num(s.shares, 0)}M` : '' })).filter((_, i) => i !== gap), gaps: gap >= 0 && gap < 12 ? [{ x0: gap - 0.45, x1: gap + 0.45, label: { long: 'Not published', short: '—' } }] : [], barW: 14, aria: 'NVDA shares short by settlement, last 12' }),
    source: 'FINRA · short interest', asof: 'Settled Sep 30 · published Oct 9',
  });
}

function legend(sample = false) {
  const it = (k, w, n) => `<span class="i">${stateTag(k, w)}<span class="n">${n}</span></span>`;
  return `<section class="tk-legend" aria-label="Data on this page"><span class="caps" style="color: var(--phosphor);">On this page</span>${it('current', 'Updated', 1)}${it('delayed', 'Delayed by source', 1)}${it('notConfigured', 'Not set up', 2)}${it('thirdParty', 'Live · TradingView', 1)}${it('notLive', 'Not live', 12)}<span style="flex: 1 1 auto;"></span>${demoLink('NVDA', 'See the whole desk on the demo')}</section>`;
}

export function deskProductionBody({ minHeight = 0, scheme = 'dark', t = 'NVDA' } = {}) {
  const mast = `<div class="tk-mast">
    <div class="who">
      <div style="display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;"><h1 class="display">${t}</h1><span class="steel" style="font-size: 14px;">NVIDIA · Nasdaq · Semiconductors</span></div>
      <p class="dline" style="margin: 0; max-width: 66ch; font-size: 13px;">Convexa shows no price of its own on this site: the daily chart below is TradingView’s, with US prices delayed. Panels that need the options feed say what they would show.</p>
    </div>
    <div class="act">${tabsNav(t)}<a href="/ticker/${t}/research" class="btn primary">Read the ${t} note</a></div>
  </div>${quick(PROD_SYMS, t)}`;
  const note = P(`${head('Research note', `<span style="display: inline-flex; gap: 6px; align-items: center; font-size: 12px; font-weight: 600;"><span aria-hidden="true" style="width: 9px; height: 9px; border-radius: 50%; background: var(--phosphor);"></span>Current</span>`)}<p style="margin: 0; font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 600; font-size: 17px; line-height: 1.3; text-wrap: balance;">A 70% growth guide on a $412B year. What comes after FY2028 is the whole question.</p><span class="dline">Written Oct 13 · price as of Oct 12 · review by Oct 22 (GTC Berlin). Stance: your call.</span><a href="/ticker/${t}/research" class="t-info" style="display: inline-flex; gap: 6px; align-items: center; min-height: 24px; margin-top: auto; font-weight: 500;">Open the note ${icon('arrow', 14)}</a>`, { label: 'Research note' });
  const shortVol = P(`${head('Short-sale volume', stateTag('current', 'Updated Oct 13'))}<span class="dval" style="font-size: 24px;">41%<span class="steel" style="font-size: 13px; font-family: 'IBM Plex Sans';"> of Oct 13 volume</span></span><span class="dline">20-day average 43%. Counts market makers hedging, so a high share is normal; it is not short interest.</span><div style="margin-top: auto;">${provChip('FINRA Reg SHO daily · Oct 13', 'solid')}</div>`, { label: 'Short-sale volume' });
  const sec = (title, line) => P(`${head(title, stateTag('notConfigured'))}<strong style="font-size: 13px;">SEC filings aren’t set up on this site yet.</strong><span class="dline">${line}</span><details class="dop"><summary>For the operator</summary><span class="mono" style="font-size: 11px; color: var(--steel);">Set SEC_USER_AGENT on the API</span></details>`, { label: `${title}, not set up` });
  const live = `<div class="tk-zone"><h2 class="display">Live from public data</h2><span class="dline" style="font-size: 13px;">Each panel names its source and how late that source reports.</span></div>
    <div class="tk-hero">${thirdPartyFrame({ ticker: t, height: 520, phoneHeight: 420 })}<div class="tk-side" style="display: flex;">${note}${shortVol}</div></div>
    <div class="tk-row" style="align-items: start;">${siCompact()}<div class="tk-side" style="display: flex;">${sec('Recent filings', 'Filings come from SEC EDGAR, which asks every program that reads it for a contact address. The note still lists the filings it cites.')}${sec('Insider trades · 90 days', 'Insider trades come from SEC Form 4, through the same EDGAR setting.')}</div></div>`;
  const notLive = `<div class="tk-zone" id="not-live"><h2 class="display">Needs the options feed</h2><span class="dline" style="font-size: 13px;">These panels read the options chain or the intraday tape, a paid feed this site doesn’t run. Each says what it would show; the demo shows all of them on sample data.</span></div>
    <section class="hd-p only-phone" aria-label="Panels that need the options feed">${head('12 panels need the options feed', stateTag('notLive'))}<div class="hd-list">${['Dealer gamma by strike', 'Levels', 'Read strip', 'Score and structure path', 'AI read', 'Live tape', 'Dealer flow projection', 'Term structure', 'Straddle-implied move', 'Fresh positioning · Vol/OI', 'Off-exchange blocks', 'Setups'].map((n) => `<div><span style="font-size: 13px;">${n}</span><span class="dline" style="font-size: 11px;">Not live</span></div>`).join('')}</div>${demoLink(t, 'See them on the demo')}</section>
    <div class="only-wide" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="tk-hero">${chartFrame({ claim: `${t} net dealer gamma by strike`, sub: 'Dealer gamma at each strike, the walls, the flip and max pain · $M per 1% move', state: 'notLive', body: `<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: center;"><div aria-hidden="true">${gexBars('outline', 130)}</div><div class="tk-nl"><p class="dline"><strong style="color: var(--phosphor);">Would show</strong> net dealer gamma at each strike, with +γ above the zero line and −γ below, the walls, the gamma flip and max pain.</p><p class="dline"><strong style="color: var(--phosphor);">Off because</strong> every level is computed from the options chain, a paid feed this site doesn’t run.</p>${demoLink(t)}</div></div>` })}${P(`${head('Levels', stateTag('notLive'))}<div class="hd-list">${['Call wall', 'Max pain', 'Gamma flip', 'Put wall'].map((n) => `<div><span class="steel" style="font-size: 13px;">${n}</span><span class="dnan" style="font-size: 13px;">—</span></div>`).join('')}</div><span class="dline">No level is shown as a number: a dash is not a price.</span>`, { label: 'Levels, not live' })}</div>
      <div class="tk-row">${nlPanel('Read strip', 'eight figures from the chain: opportunity, net DEX, IV/HV, IV rank, Vol/OI, IV skew, term structure and the off-exchange share.', t)}${nlPanel('Score and structure path', 'the scanner’s 0–100 score for this ticker and how it and the distance to the flip moved this session.', t)}</div>
      <div class="tk-row">${nlPanel('AI read', 'a verdict-first brief on the dealer structure, risk before rationale, on your own provider key.', t, '<p class="dline">It reads the structure above, so it can’t run without it.</p>')}${nlFrame(`${t} mid · last 5 minutes`, 'Mid, one point a second, against the structure mid', 'the live mid, one point a second, against the mid the levels use.', t, 190)}</div>
      <div class="tk-ctx">${nlPanel('Dealer flow projection', 'how charm and vanna push dealer hedging into the nearest expiry.', t)}${nlFrame('Term structure', 'At-the-money implied vol by days to expiry', 'implied volatility by tenor and whether it slopes up or down.', t, 190)}${nlPanel('Straddle-implied move', 'the move the nearest at-the-money straddle prices in, against the walls.', t)}${nlPanel('Fresh positioning · Vol/OI', 'strikes where today’s volume outruns open interest.', t)}${nlPanel('Off-exchange blocks', 'large prints away from the exchanges, as they happen.', t)}${nlPanel('Setups', 'the scanner’s named setups on this ticker.', t)}</div>
    </div>`;
  return v4Page({ scheme, minHeight, active: 'ticker', label: `${t} desk`, main: `<div class="wrap tkd">${mast}${legend()}${live}${notLive}${DISCLAIM}</div>` });
}

// =================================================================================================
// States
// =================================================================================================
export function deskStatesBoardBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const sk = (h, w = '100%') => `<span class="skel tk-skel" style="height: ${h}px; width: ${w};"></span>`;
  const items = [
    { name: 'Loading', tag: ['loading'], when: 'Before any answer: skeletons in the desk’s final shape under the real nav and legend; never a page spinner. The TradingView frame says “Loading TradingView’s chart…” at its final size.', html: `${sk(34, '30%')}${sk(16, '55%')}${sk(48)}<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">${sk(200)}<div style="display: flex; flex-direction: column; gap: 12px;">${sk(94)}${sk(94)}</div></div>` },
    { name: 'Couldn’t load', tag: ['error'], when: 'Our request to /api/public-data failed. The cause and Try again; the TradingView frame and the note link still show.', html: dataCell({ fam: 'pos', state: 'error', w: '100%', h: 'auto' }) },
    { name: 'Source down', tag: ['unavailable'], when: 'FINRA didn’t answer and nothing is cached: unknown, not zero. The SEC and TradingView panels are unaffected.', html: dataCell({ fam: 'pos', state: 'unavailable', w: '100%', h: 'auto' }) },
    { name: 'Last good copy', tag: ['stale'], when: 'This cycle failed but an earlier copy exists: dimmed, with when it was fetched and when Convexa asks again.', html: dataCell({ fam: 'pos', state: 'stale', w: '100%', h: 'auto' }) },
    { name: 'Not live', tag: ['notLive'], when: 'Production, every options-feed panel: what it would show, why it is off, and a link to the same desk on the demo. No value slot pretends; a dash is not a price.', html: nlFrame('NVDA net dealer gamma by strike', 'Dealer gamma at each strike · $M per 1% move', 'net dealer gamma at each strike, the walls, the flip and max pain.', 'NVDA', 190) },
    { name: 'Not set up', tag: ['notConfigured'], when: 'If SEC_USER_AGENT is unset: filings and insider trades say so; the FINRA panels are unaffected.', html: dataCell({ fam: 'feed', state: 'notConfigured', w: '100%', h: 'auto' }) },
    { name: 'Off', tag: ['off'], when: 'PUBLIC_DATA=off on the API: the public zone collapses to one line; nothing retries.', html: `<div class="hd-p"><div class="ph"><h3>Live from public data</h3>${stateTag('off')}</div><span class="dline">Public data is switched off on this server. The TradingView chart and the note link stay; positioning and filings are hidden until it is on.</span></div>` },
    { name: 'TradingView blocked or timed out', tag: null, when: 'A content blocker or the network stopped TradingView’s script, or 12 s passed without the frame. Information, not a failure of ours; resets when the symbol changes.', html: thirdPartyFrame({ ticker: 'NVDA', state: 'blocked' }) },
    { name: 'AI read · Sign in', tag: ['locked'], when: 'Only on a build with the options feed (neither site today): signed out, the read says what is behind the wall and offers the one way in.', html: dataCell({ fam: 'ai', state: 'locked', w: '100%', h: 'auto' }) },
    { name: 'AI read · no key', tag: ['notConfigured', 'Add a key'], when: 'Same build, signed in without a provider key: reads run on the reader’s own key.', html: dataCell({ fam: 'ai', state: 'notConfigured', w: '100%', h: 'auto' }) },
    { name: 'Demo · sample data', tag: ['demo'], when: 'Staging, always: the demo bar is up, the account is the seed demo account, every options panel runs the Oct 7 scenario in a dashed, hatched frame, and every source chip says “shaped like”.', html: `${v4Notice('demo')}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">${P(`${head('Sample analysis · SPY', stateTag('sample', 'Sample read'))}<p class="tk-verdict" style="font-size: 20px;">No trade · sit this one out</p><span class="dline">This is an authored example. No model was called.</span><div style="margin-top: auto;">${provChip('Sample · shaped like an AI read', 'dashed')}</div>`, { sample: true })}${positionPanel()}</div>` },
    { name: 'Ticker outside the demo', tag: ['empty', 'Not in the demo'], when: 'Staging, a symbol beyond SPY, QQQ, AAPL, MSFT, NVDA and TSLA: the scenario has no data for it, so the desk says so and offers the six.', html: `<div class="hd-p"><div class="ph"><h3>RKLB isn’t in the demo scenario</h3></div><span class="dline">The demo runs on six symbols. Pick one to see the whole desk on sample data.</span>${quick(DEMO_SYMS, '')}</div>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Ticker desk · states', lead: 'Every state the desk can be in, each with its P-2 word and when it happens. A failure in one source never blanks the desk: the others keep their own state.', trace: 'P-1, P-2, P-8, P-11, P-14, DS-02, DS-05, X-02, X-09, TKR-03', items });
}
