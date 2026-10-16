// Final · Convexa v1 — the ticker desk (/ticker/:ticker, Overview tab) in its ruled state.
// Staging: SPY on the demo account, every options panel filled with the authored Oct 7 scenario in the v5
// chart forms (dashed frame + hatch = sample, P-8; gamma sign by position and text as well as hue, P-11).
// Production: NVDA with the public panels live and every options-feed panel Not live with a link to the
// same desk on the demo (P-1), plus the "On this page" legend.
// Lane 4 (2026-10-16) redrew both to the hierarchy the app now builds (tmp/build/shots/lane4/CRITIQUE.md):
// the price and the structure verdict first, then the levels that frame it, then supporting context.
import { icon, v4Notice, v4Page, STAGING_DEMO_URL } from '../../lib.mjs';
import { chartFrame, dataTable, fmt, plot, rangeBar, sparkline, stateBody, ticks } from '../../chart-kit.mjs';
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
  .tk-work { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 16px; align-items: stretch; }
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
  /* Lane 4 (2026-10-16): the hierarchy the app builds. */
  .tk-mast .who h1 { font-size: clamp(30px, 2.8vw, 36px); }
  .tk-mast .act { flex: 0 1 600px; flex-direction: column; align-items: flex-end; }
  .tk-ctl { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 10px 12px; }
  .tk-verdict-chip { display: inline-flex; align-items: center; align-self: center; min-height: 24px; padding: 0 8px; border-radius: 999px; border: 1px solid var(--steel); font-size: 12px; font-weight: 600; color: var(--phosphor); white-space: nowrap; }
  .tk-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
  .tk-zl { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); margin-bottom: -8px; }
  .tk-seg { display: inline-flex; border: 1px solid var(--line-2); border-radius: 8px; overflow: hidden; font-size: 12px; font-weight: 600; }
  .tk-seg > * { padding: 6px 10px; } .tk-seg b { background: var(--raised-2); }
  .tk-field { display: grid; grid-template-columns: minmax(0, 1fr) 300px; grid-template-areas: "field ladder" "lane ladder"; column-gap: 18px; row-gap: 12px; }
  .tk-fieldl { grid-area: field; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .tk-flegend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px 16px; font-size: 11px; color: var(--steel); }
  .tk-flegend span { display: inline-flex; align-items: center; gap: 6px; } .tk-flegend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; } .tk-flegend i.ln { height: 2px; border-radius: 1px; }
  .tk-lane { grid-area: lane; display: flex; flex-direction: column; gap: 10px; min-width: 0; padding-top: 10px; border-top: 1px solid var(--line); }
  .tk-path { display: flex; flex-direction: column; gap: 6px; }
  .tk-ladder { grid-area: ladder; display: flex; flex-direction: column; gap: 12px; min-width: 0; padding-left: 18px; border-left: 1px solid var(--line); }
  .tk-lfind { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.35; color: var(--phosphor); }
  .tk-lhead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .tk-lrows > div { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto 52px; gap: 8px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .tk-lrows > div:first-child { border-top: 0; }
  .tk-lrows i { display: inline-block; width: 14px; height: 2px; }
  .tk-lrows .mono { text-align: right; } .tk-lrows .big { font-size: 17px; font-weight: 600; }
  .tk-ladder .tk-risk .v { font-size: 14px; }
  .tk-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); }
  .tk-foot > div { background: transparent; border: 0; padding: 0; }
  .tk-watch { display: flex; flex-direction: column; gap: 2px; }
  .tk-trace { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; line-height: 1.45; color: var(--steel); }
  .tk-about { display: flex; flex-direction: column; gap: 4px; padding-top: 12px; border-top: 1px solid var(--line); }
  @media (max-width: 999px) { .tk-field { grid-template-columns: 1fr; grid-template-areas: "field" "ladder" "lane"; } .tk-ladder { padding-left: 0; border-left: 0; padding-top: 12px; border-top: 1px solid var(--line); } }
  @media (max-width: 899px) { .tk-ctx > * { grid-column: auto !important; } .tk-mast .act { align-items: stretch; max-width: none; } .tk-ctl { justify-content: flex-start; } }
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

// ---- the SPY scenario, as the demo desk renders it --------------------------------------------------
// Lane 4 (2026-10-16): every figure below was read off the running demo desk for SPY on the full expiry
// set (owner ruling 2026-10-14: where the demo and a board disagree, the board follows the demo). The
// authored series: libs/api/src/lib/demo/catalog/spy.seed.json through catalog/shared.ts makeScenario
// (last close 690.62 on Oct 7, prior close 690.75 on Oct 6); flow figures from demo/flowSeed.ts.
const SPOT = 690.62, PRIOR = 690.75, FLIP = 683.92, PUTW = 652.22, CALLW = 704.02, PAIN = 690.62, MOVE = 2.48, MID = 690.63;
const MOVE_EXPIRY = 'Oct 9';
const STRIKES = Array.from({ length: 33 }, (_, i) => 640 + i * 2.5);
const gex = (k) => +((Math.exp(-(((k - CALLW) / 12) ** 2)) * 1.104 - Math.exp(-(((k - PUTW) / 18) ** 2)) * 1.5411 + Math.exp(-(((k - SPOT) / 4) ** 2)) * 0.0424) * 1.8).toFixed(2);
const SAMPLE = { source: 'Sample · shaped like SPY options structure', sourceKind: 'dashed', asof: 'Scenario · Oct 7, 2026 · 2:30 PM ET', kind: 'sample' };
const pctFrom = (v) => fmt.signed(((v - SPOT) / SPOT) * 100, 1, '%');

/** The masthead: the symbol, then the price with its day change and the structure verdict, then the
 *  provenance chips; the tabs head the right column with the controls and the one amber action. */
function stagingMast(t) {
  const chg = SPOT - PRIOR, pct = (chg / PRIOR) * 100;
  const dir = chg >= 0 ? 'up' : 'down';
  return `<div class="tk-mast">
    <div class="who">
      <h1 class="display">${t}</h1>
      <div class="tk-px"><span class="p">$${fmt.num(SPOT, 2)}</span><span class="c t-${dir}">${chg >= 0 ? '▲ +' : '▼ −'}${fmt.num(Math.abs(chg), 2)} (${chg >= 0 ? '+' : '−'}${fmt.num(Math.abs(pct), 2)}%)</span><span class="tk-verdict-chip">+γ long gamma above ${fmt.num(FLIP, 2)}</span></div>
      <div class="tk-chips">${stateTag('demo')}${provChip('Shaped like a delayed SPY quote · Oct 7, 2:30 PM ET', 'dashed')}<span class="dline">Sample last trade $${fmt.num(MID, 2)}</span></div>
      <span class="dline">Levels @ $${fmt.num(SPOT, 2)} · Scenario · Oct 7, 2026 · 2:30 PM ET · All expirations</span>
    </div>
    <div class="act">${tabsNav(t)}<div class="tk-ctl"><span class="tk-sel"><span class="caps">Expirations</span><strong style="font-weight: 600;">All</strong>${icon('chevron', 14)}</span><span class="tk-sel"><span class="caps">Persona</span><strong style="font-weight: 600;">Careful sample reader</strong>${icon('chevron', 14)}</span><button class="btn primary" type="button">+ Open simulated trade</button></div></div>
  </div>${quick(DEMO_SYMS, t)}`;
}

function fieldPlot({ height = 300 } = {}) {
  const pts = STRIKES.map((k) => [k, gex(k)]);
  const max = Math.max(...pts.map(([, v]) => Math.abs(v)));
  return plot({
    height, pt: 58, pl: 58, pr: 24, prn: 12,
    x: { min: STRIKES[0] - 1.5, max: STRIKES[STRIKES.length - 1] + 1.5, ticks: ticks(640, 720, 20, (v) => String(v)).map((t, i) => ({ ...t, minor: i % 2 === 1 })) },
    y: { min: -max * 1.15, max: max * 1.15, ticks: [{ v: -2, label: '−$2M' }, { v: 0, label: '0' }, { v: 2, label: '+$2M' }] },
    hlines: [{ v: 0, kind: 'zero', label: '+γ above · −γ below' }],
    bars: pts.map(([k, v]) => ({ x: k, v, role: v >= 0 ? 'up' : 'down' })), barW: 12,
    events: [{ x: PUTW, label: { long: `Put wall ${fmt.num(PUTW, 2)}`, short: 'Put' }, title: `Put wall ${fmt.num(PUTW, 2)}`, keep: true }, { x: FLIP, label: { long: `Flip ${fmt.num(FLIP, 2)}`, short: 'Flip' }, title: `Flip ${fmt.num(FLIP, 2)}`, keep: true }, { x: SPOT, label: `Mid ${fmt.num(MID, 2)}`, lane: 2 }, { x: CALLW, label: { long: `Call wall ${CALLW} · +γ`, short: 'Call' }, title: `Call wall ${CALLW}`, keep: true }], eventLane: { long: 'Levels', short: '' },
    aria: `SPY net dealer gamma by strike, ${STRIKES[0]} to ${STRIKES[STRIKES.length - 1]}; flip ${FLIP}, put wall ${PUTW}, call wall ${CALLW}, mid ${MID}`,
  });
}

/** The structure hero: ONE panel (StructureHeroPanel), the field and its levels side by side. Title:
 *  the finding (P-10); the legend over the field; the slow lane under it; the ladder column carries
 *  its own finding line, the five levels, the figures that frame the price, and the ladder foot. */
function heroPanel() {
  const rows = [['Call wall', CALLW, 'up', '+γ'], ['Mid', MID, 'emph', ''], ['Max pain', PAIN, 'ctx', ''], ['Gamma flip', FLIP, 'edge', '±'], ['Put wall', PUTW, 'down', '−γ']];
  const sw = (r) => (r === 'up' ? 'var(--up)' : r === 'down' ? 'var(--down)' : r === 'edge' ? 'var(--phosphor)' : r === 'emph' ? 'var(--signal)' : 'var(--steel)');
  const legendHtml = `<div class="tk-flegend"><span><i style="background: var(--up);"></i>+γ call-dominated</span><span><i style="background: var(--down);"></i>−γ put-dominated</span><span><i class="ln" style="background: var(--phosphor);"></i>flip</span></div>`;
  const ladder = `<div class="tk-ladder">
      <p class="tk-lfind">The flip is 1.0% below; the walls sit 1.9% above and 5.6% below</p>
      <div class="tk-lhead"><span class="caps">Levels</span><span class="mono steel" style="font-size: 11px;">distance from levels @ $${fmt.num(SPOT, 2)}</span></div>
      <div class="tk-lrows">${rows.map(([l, v, r, s]) => `<div><i style="background: ${sw(r)};${r === 'ctx' ? ' background: repeating-linear-gradient(90deg, var(--steel) 0 4px, transparent 4px 6px);' : ''}"></i><span>${l}${s ? ` <span class="mono steel" style="font-size: 11px;">${s}</span>` : ''}</span><span class="mono${r === 'emph' ? ' big' : ''}">$${fmt.num(v, 2)}</span><span class="mono steel" style="font-size: 11px;">${r === 'emph' ? '—' : v === SPOT ? 'at spot' : pctFrom(v)}</span></div>`).join('')}</div>
      <div class="tk-risk"><div><span class="caps">Regime</span><span class="v" style="font-size: 15px;">+γ long gamma</span><span class="dline" style="font-size: 11px;">above the flip by 1.0%</span></div><div><span class="caps">Implied move</span><span class="v" style="font-size: 15px;">±$${fmt.num(MOVE, 2)}</span><span class="dline" style="font-size: 11px;">ATM straddle · 2 DTE</span></div></div>
      <div class="tk-risk tk-foot"><div><span class="caps">Vol-norm GEX</span><span class="v">$517.2M</span><span class="dline" style="font-size: 11px;">primary magnitude</span></div><div><span class="caps">Raw GEX (1% shock)</span><span class="v">$93.1M</span><span class="dline" style="font-size: 11px;">secondary</span></div></div>
    </div>`;
  const lane = `<div class="tk-lane"><span class="dline"><span class="steel">Sample tape · Mid</span> <span class="mono" style="color: var(--phosphor);">$${fmt.num(MID, 2)}</span> Replays the Oct 7, 2026 scenario from 2:30 PM ET · 1m window</span>
      <div class="tk-path"><span class="caps">Structure path · slow lane</span><div style="display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: center;">${sparkline([58, 60, 61, 63, 62, 64, 66, 65, 67, 69, 71, 74], { width: 120, height: 24, value: '74', scale: 'score · this session', aria: 'Score from 58 to 74' })}${sparkline([-1.9, -1.7, -1.6, -1.2, -1.0, -0.8, -0.9, -0.6, -0.5, -0.4, -0.35, -0.38], { width: 120, height: 24, value: '↑', scale: 'distance to the flip', aria: 'Distance to the flip narrowing' })}</div><span class="dline" style="font-size: 11px;">Authored synthetic daily scenario snapshots; not live or stored history.</span></div>
    </div>`;
  return chartFrame({
    claim: `Dealers are long gamma (+γ): spot ${fmt.num(SPOT, 2)} sits 1.0% above the ${fmt.num(FLIP, 2)} flip`,
    sub: 'Net dealer gamma by strike · all expirations · Scenario · Oct 7, 2026 · 2:30 PM ET',
    extraTop: `<span class="tk-seg" role="group" aria-label="Dealer positioning view"><b>Field</b><span>Magnet</span></span>`,
    body: `<div class="tk-field"><div class="tk-fieldl">${legendHtml}${fieldPlot()}<span class="dline">Point at the field, or focus it and use ← →, to read a strike.</span></div>${ladder}${lane}</div>`,
    ...SAMPLE, state: 'sample',
    table: dataTable({ caption: 'SPY net dealer gamma by strike, $M per 1% move', cols: ['Strike', 'Net gamma ($M)', 'Sign'], rows: STRIKES.map((k) => [k, gex(k)]).filter((_, i) => i % 2 === 0).map(([k, v]) => [fmt.num(k, 1), fmt.signed(v, 2), { t: v >= 0 ? '+γ long' : '−γ short' }]) }),
  });
}

/** The read strip: the figure alone in each value, the qualifier in the caption (lane 4). */
function readStrip() {
  const cells = [['Opportunity', '74', 'Actionable · 1 setup'], ['Net DEX', '+$1.1B', 'delta hedging pressure'], ['IV / HV', '1.10', 'options look expensive'], ['IV rank', '75', 'premium rich · 3rd quartile · 70th pct'], ['Vol / OI', '0.51×', '3 unusual strikes'], ['IV skew', '+1.8 pts', 'downside hedging is bid (fear)'], ['Term', 'contango', '2d 26.8 → 44d 27.6'], ['Off-exch. %', '32%', 'context only, no side']];
  return P(`<div class="ph">${stateTag('sample')}${provChip('Sample · shaped like the options chain', 'dashed')}</div><div class="tk-strip">${cells.map(([l, v, s]) => `<div><span class="caps">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('')}</div>`, { sample: true, label: 'Read strip, sample' });
}

/** The read: verdict first, the watch level with its clause, Why and Re-engage, the unchecked-prose
 *  caption and the trace line (D-07), then the actions. */
function aiBrief() {
  const why = [`Spot ${fmt.num(SPOT, 2)} is 1.0% above the flip at ${fmt.num(FLIP, 2)}: +γ, dealer hedging tends to damp moves here.`, `The ${fmt.num(CALLW, 2)} call wall sits outside the ±$${fmt.num(MOVE, 2)} move the ${MOVE_EXPIRY} straddle prices.`, 'No live market, broker, or AI provider was used.'];
  const re = [`Spot closes below the flip at ${fmt.num(FLIP, 2)}, where hedging turns −γ.`, 'Or the call wall moves inside the implied move on the next structure refresh.', 'Review when the selected authored expiry set changes.'];
  return P(`<div class="ph"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: var(--raised-2); color: var(--phosphor);">${icon('sparkle', 15)}</span><h3>Sample analysis · SPY</h3>${stateTag('sample', 'Sample read')}<a href="#whats-sent" class="t-info" style="font-size: 12px; font-weight: 500; min-height: 24px; display: inline-flex; align-items: center;">View sample export →</a></div>
    <span class="dline">Sample analysis · authored for this scenario. This is an authored example. No model was called.</span>
    <p class="tk-verdict">No trade · sit this one out</p>
    <div class="tk-watch"><span class="caps">Watch level</span><span class="mono" style="font-size: 16px;">${fmt.num(FLIP, 2)}</span><span class="dline" style="font-size: 11px;">traces to Convexa’s gamma flip (${fmt.num(FLIP, 2)})</span></div>
    <p class="dline" style="margin: 0;">Authored sample: SPY shows balanced structure with authored score 74. Not a model recommendation.</p>
    <div><span class="caps">Why</span><ul style="margin: 6px 0 0;">${why.map((w) => `<li>${w}</li>`).join('')}</ul></div>
    <div><span class="caps">Re-engage when</span><ul style="margin: 6px 0 0; list-style: '→  ';">${re.map((w) => `<li>${w}</li>`).join('')}</ul></div>
    <span class="dline" style="font-size: 11px;">Numbers written out in this reasoning aren’t checked; only the stop, target and invalidation level above are.</span>
    <div class="tk-trace">${icon('shield', 14)}<span>Every checked figure traces to a Convexa number.</span></div>
    <div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1px solid var(--line);"><button class="btn ghost" type="button">Full analysis &amp; data</button><button class="btn ghost" type="button">Dismiss</button></div>`, { sample: true, label: 'Sample analysis' });
}

function tapePanel() {
  const cells = [['Net flow (1m)', '+383', ''], ['Spread', '$0.04', ''], ['Gamma flip · sample', `$${fmt.num(FLIP, 2)}`, '−$6.7 · 1.0% below'], ['VWAP', '$689.37', '']];
  return P(`${head('Sample tape', stateTag('sample'))}<span class="dline">Replays the Oct 7, 2026 scenario from 2:30 PM ET · 1m window</span><div class="tk-risk">${cells.map(([l, v, s]) => `<div><span class="caps">${l}</span><span class="v">${v}</span>${s ? `<span class="dline" style="font-size: 11px;">${s}</span>` : ''}</div>`).join('')}</div>`, { sample: true, label: 'Sample tape' });
}

function positionPanel() {
  return P(`${head('Your book · simulated', stateTag('sample'))}
    <div class="tk-pos" style="border-top: 0; padding-top: 0;"><span class="mono" style="font-weight: 600;">$690 Call · long call × 1</span><span class="mono t-down">▼ −$53 (−17.7%)</span><span class="dline">snapshot mid · simulated</span><a class="t-info" href="/positions" style="font-size: 13px;">Open book →</a></div>
    <span class="dline" style="font-size: 11px;">Simulated (paper) on the demo account. Sign is carried by ▲/▼ and +/−, not colour alone.</span>`, { sample: true, label: 'Paper positions, sample' });
}
function ordersPanel() {
  return P(`${head('Sim orders · SPY', stateTag('sample'), '<span class="stag k-solid">Simulated</span>')}
    <div class="tk-pos" style="border-top: 0; padding-top: 0;"><span class="mono" style="font-weight: 600;">SPY 690C · 2026-11-20 × 1</span><span class="stag k-solid">Triggered · working entry</span><span class="dline">limit $4.25 · stop — · target — · good-til 2026-11-20</span><button class="btn ghost sm" type="button">Cancel order</button></div>
    <span class="dline" style="font-size: 11px;">Paper orders on the demo account. Convexa never sends a real order.</span>`, { sample: true, label: 'Sim orders, sample' });
}

function termChart() {
  const T = [[2, 26.8], [9, 26.1], [44, 27.6]];
  return chartFrame({ claim: '44-day implied vol at 27.6% sits 0.8 points above 2-day', sub: 'SPY at-the-money implied volatility by days to expiry · % · contango', body: plot({ height: 170, pr: 70, prn: 50, pl: 40, x: { min: 0, max: 46, ticks: T.map(([d]) => ({ v: d, label: `${d}d` })) }, y: { min: 24, max: 30, ticks: ticks(24, 30, 2, (v) => (v === 30 ? '30%' : String(v))) }, series: [{ points: T, role: 'emph', dots: true, end: 'Contango', endValue: '+0.8 pts' }], keyboard: false, aria: T.map(([d, v]) => `${d} days ${v}%`).join(', ') }), ...SAMPLE, state: 'sample' });
}
/** The straddle's move against the walls (StraddleMove, lane 4): the finding as the title, the move at
 *  card scale, and the band, the spot and both walls on one price scale. */
function straddleChart() {
  const lo = 649, hi = 707;
  return chartFrame({ claim: `Options price a ±$${fmt.num(MOVE, 2)} move (±${fmt.num((MOVE / SPOT) * 100, 1)}%) to ${MOVE_EXPIRY}; both walls sit outside it`, sub: 'Straddle-implied move · ATM straddle · mid quotes', body: `<span class="mono" style="font-size: 22px; font-weight: 600;">± $${fmt.num(MOVE, 2)} (± ${fmt.num((MOVE / SPOT) * 100, 1)}%)</span><div style="padding: 14px 0 4px;">${rangeBar({ lo, hi, band: [SPOT - MOVE, SPOT + MOVE], now: SPOT, labels: [{ v: PUTW, text: `Put wall ${PUTW}`, align: 0 }, { v: SPOT, text: `${fmt.num(SPOT - MOVE, 2)} – ${fmt.num(SPOT + MOVE, 2)}`, row: 2 }, { v: CALLW, text: `Call wall ${CALLW}`, align: 1 }], aria: `Implied move ±${MOVE} around ${SPOT}; put wall ${PUTW}; call wall ${CALLW}` })}</div><span class="dline">From the 2026-10-09 ATM straddle · 2 DTE · mid quotes. What options are priced for, not a forecast.</span>`, ...SAMPLE, state: 'sample', style: ' grid-column: span 2;' });
}
const sampleCard = (title, value, line, chip, sans = false) => P(`${head(title, stateTag('sample'))}<span class="${sans ? '' : 'mono'}" style="font-size: ${sans ? 16 : 18}px;${sans ? ' font-weight: 600;' : ''}">${value}</span><span class="dline">${line}</span><div style="margin-top: auto;">${provChip(chip, 'dashed')}</div>`, { sample: true });

// =================================================================================================
// Staging · the demo account (SPY)
// =================================================================================================
export function deskStagingBody({ minHeight = 0, scheme = 'dark', t = 'SPY' } = {}) {
  const hero = `<span class="tk-zl">Structure</span>${heroPanel()}`;
  const work = `<span class="tk-zl">Read &amp; plan</span><div class="tk-work">${aiBrief()}<div class="tk-side">${tapePanel()}${positionPanel()}${ordersPanel()}</div></div>`;
  const ctx = `<div class="tk-zone"><h2 class="display">Context</h2><span class="dline" style="font-size: 13px;">Slower reads around the structure. Snapshots, never live; they never feed the score.</span></div>
    <div class="tk-ctx">${straddleChart()}${termChart()}
      ${sampleCard('Projected dealer flow', '+$66.6K delta drift', 'to Fri Oct 16 (9 days) from charm · vanna −$67 on +1 IV pt', 'Sample · shaped like dealer flow')}
      ${sampleCard('Market context', 'Uptrend · Dispersed', 'flow vs positioning divergent · ATR 14d $12.94 (1.9%)', 'Sample · shaped like market context', true)}
      ${sampleCard('Fresh positioning (Vol/OI)', '$715 · 1.68×', 'the top of three strikes where today’s volume outruns open interest ($710 1.56×, $705 1.44×)', 'Sample · shaped like the chain')}
      ${sampleCard('Off-exchange blocks', '1,371,000 sh @ $687.86', 'largest print, 2:28 PM ET in the scenario · −0.4% vs spot', 'Sample · shaped like block prints')}
      ${P(`${head('Setups', stateTag('sample'))}<span style="font-size: 16px; font-weight: 600;">Balanced structure · medium</span><span class="dline">Rule-based · the same structure snapshot · authored scenario variant</span><div style="margin-top: auto;">${provChip('Sample · shaped like scanner setups', 'dashed')}</div>`, { sample: true, style: 'grid-column: span 2;' })}</div>`;
  const about = `<section class="tk-about" aria-label="About this sample"><span class="caps">About this sample</span><strong style="font-size: 13px;">Demo · sample data · Authored scenario · October 7, 2026 · no market feed connected</strong><span class="dline">Structure and related signals use the selected expiry set: 2026-10-09, 2026-10-16, 2026-11-20. Full-chain context keeps its labeled full-chain basis. Sample analysis is authored for this scenario.</span></section>`;
  return v4Page({ scheme, minHeight, demo: true, active: 'ticker', label: `${t} desk`, main: `<div class="wrap tkd">${stagingMast(t)}${hero}${readStrip()}${work}${ctx}${about}${DISCLAIM}</div>` });
}

// =================================================================================================
// Production · the portfolio site (NVDA): public data live, options panels Not live
// =================================================================================================
const nlFrame = (claim, sub, would, t = 'NVDA', h = 150) => chartFrame({ claim, sub, state: 'notLive', body: stateBody('notLive', { height: h, text: `<strong>Would show</strong> ${would}`, cause: 'Off because it reads the options chain, a paid feed this site doesn’t run. Public data on this page is live.', action: demoLink(t) }) });
/** A Not live panel (PublicDesk FeedPanel): what it would show and the same desk on the demo. The cause
 *  is stated once, in the zone head (lane 4). */
const nlPanel = (title, would, t = 'NVDA', extra = '') => P(`${head(title, stateTag('notLive'))}<div class="tk-nl"><p class="dline"><strong style="color: var(--phosphor);">Would show</strong> ${would}</p>${extra}<div style="margin-top: auto;">${demoLink(t)}</div></div>`, { label: `${title}, not live` });

function legend() {
  const it = (k, w, n) => `<span class="i">${stateTag(k, w)}<span class="n">${n}</span></span>`;
  return `<section class="tk-legend" aria-label="Data on this page"><span class="caps" style="color: var(--phosphor);">On this page</span>${it('current', 'Updated', 2)}${it('off', 'Off', 1)}${it('notLive', 'Not live', 12)}${it('thirdParty', 'Live · TradingView', 1)}<span style="flex: 1 1 auto;"></span>${demoLink('NVDA', 'See the whole desk on the demo')}</section>`;
}

/** FINRA is Off on production (owner answer 4, 2026-10-15; shared/dataState/finraSwitch.ts): one card,
 *  the owner's reason, after the live SEC panels. */
const FINRA_OFF_REASON = 'Off on this site until FINRA’s terms for showing its data here are confirmed. The demo shows sample data shaped like it.';

export function deskProductionBody({ minHeight = 0, scheme = 'dark', t = 'NVDA' } = {}) {
  const mast = `<div class="tk-mast">
    <div class="who">
      <div style="display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;"><h1 class="display">${t}</h1><span class="steel" style="font-size: 14px;">NVIDIA</span></div>
      <p class="dline" style="margin: 0; max-width: 66ch; font-size: 13px;">Convexa shows no price of its own on this site: the daily chart below is TradingView’s, with US prices delayed. Panels that need the options feed say what they would show.</p>
    </div>
    <div class="act">${tabsNav(t)}<a href="/ticker/${t}/research" class="btn primary">Read the ${t} note</a></div>
  </div>${quick(PROD_SYMS, t)}`;
  const note = P(`${head('Research note', `<span style="display: inline-flex; gap: 6px; align-items: center; font-size: 12px; font-weight: 600;"><span aria-hidden="true" style="width: 9px; height: 9px; border-radius: 50%; background: var(--phosphor);"></span>Current</span>`)}<p style="margin: 0; font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 600; font-size: 17px; line-height: 1.3; text-wrap: balance;">A 70% growth guide on a $412B year. What comes after FY2028 is the whole question.</p><span class="dline">Written Oct 13, 2026 · price as of Oct 12 · review by Oct 22</span><a href="/ticker/${t}/research" class="t-info" style="display: inline-flex; gap: 6px; align-items: center; min-height: 24px; margin-top: auto; font-weight: 500;">Open the note ${icon('arrow', 14)}</a>`, { label: 'Research note' });
  // SEC is set up on production (SEC_USER_AGENT, 2026-10-15). The rows are the filings the NVDA note
  // cites from EDGAR (research/NVDA/2026-10-13-initiation.md, sources 1 and 4); the live card lists
  // EDGAR's latest four, which may be newer.
  const filings = P(`${head('Recent filings', stateTag('current', 'Updated'))}<div class="drows">${[['Aug 26', '10-Q', 'Quarter ended Jul 26, 2026'], ['Aug 26', '8-K', 'Q2 FY2027 results · Ex. 99.1']].map((r) => `<div style="grid-template-columns: 54px 40px minmax(0, 1fr) auto;"><span class="mono steel">${r[0]}</span><span class="mono" style="font-size: 11px; font-weight: 600;">${r[1]}</span><span>${r[2]}</span><span class="t-info" style="font-size: 12px;">Open</span></div>`).join('')}</div><span class="dline" style="font-size: 11px;">SEC EDGAR · checked every hour</span>`, { label: 'Recent filings' });
  const insiders = P(`${head('Insider trades · 90 days', stateTag('current', 'Updated'))}<span class="dline">Sales and buys from SEC Form 4, counted over 90 days, with the latest filing’s date. (No count is drawn on this board: none we have read.)</span><span class="dline" style="font-size: 11px;">SEC EDGAR · Form 4 · cached 30 days</span>`, { label: 'Insider trades' });
  const finra = P(`${head('Short interest · Short-sale volume', stateTag('off'))}<span class="dline">${FINRA_OFF_REASON}</span>`, { label: 'FINRA short data, off' });
  const live = `<div class="tk-zone"><h2 class="display">Live from public data</h2><span class="dline" style="font-size: 13px;">Each panel names its source and how late that source reports.</span></div>
    <div class="tk-hero">${thirdPartyFrame({ ticker: t, height: 520, phoneHeight: 420 })}<div class="tk-side" style="display: flex;">${note}${filings}${insiders}</div></div>
    ${finra}`;
  const ctxPanels = [['Read strip', 'eight figures from the chain: opportunity, net DEX, IV/HV, IV rank, Vol/OI, IV skew, term structure and the off-exchange share.'], ['Score and structure path', 'the scanner’s 0–100 score for this ticker, and how it and the distance to the flip moved this session.'], [`${t} mid · last 5 minutes`, 'the live mid, one point a second, against the mid the levels use.'], ['Dealer flow projection', 'how charm and vanna push dealer hedging into the nearest expiry.'], ['Term structure', 'implied volatility by days to expiry, and whether it slopes up or down.'], ['Straddle-implied move', 'the move the nearest at-the-money straddle prices in, against the walls.'], ['Fresh positioning · Vol/OI', 'strikes where today’s volume outruns open interest.'], ['Off-exchange blocks', 'large prints away from the exchanges, as they happen.'], ['Setups', 'the scanner’s named setups on this ticker.']];
  const notLive = `<div class="tk-zone" id="not-live"><h2 class="display">Needs the options feed</h2><span class="dline" style="font-size: 13px;">Off because these panels read the options chain or the intraday tape, a paid feed this site doesn’t run. Each panel says what it would show; the demo shows all of them on sample data.</span></div>
    <section class="hd-p only-phone" aria-label="Panels that need the options feed">${head('12 panels need the options feed')}<div class="hd-list">${['NVDA net dealer gamma by strike', 'Levels', 'Read strip', 'Score and structure path', 'AI read', 'NVDA mid · last 5 minutes', 'Dealer flow projection', 'Term structure', 'Straddle-implied move', 'Fresh positioning · Vol/OI', 'Off-exchange blocks', 'Setups'].map((n) => `<div><span style="font-size: 13px;">${n}</span>${stateTag('notLive')}</div>`).join('')}</div>${demoLink(t, 'See them on the demo')}</section>
    <div class="only-wide" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="tk-hero">${P(`${head(`${t} net dealer gamma by strike`, stateTag('notLive'))}<div aria-hidden="true">${gexBars('outline', 120)}</div><p class="dline"><strong style="color: var(--phosphor);">Would show</strong> net dealer gamma at each strike, with +γ above the zero line and −γ below, the walls, the gamma flip and max pain.</p><div>${demoLink(t)}</div>`, { label: 'Net dealer gamma, not live' })}${P(`${head('Levels', stateTag('notLive'))}<div class="hd-list">${['Call wall', 'Max pain', 'Gamma flip', 'Put wall'].map((n) => `<div><span class="steel" style="font-size: 13px;">${n}</span><span class="dnan" style="font-size: 13px;">—</span></div>`).join('')}</div><p class="dline"><strong style="color: var(--phosphor);">Would show</strong> the call wall, max pain, the gamma flip and the put wall.</p><span class="dline">No level is shown as a number: a dash is not a price.</span><div>${demoLink(t)}</div>`, { label: 'Levels, not live' })}</div>
      ${nlPanel('AI read · NVDA', 'a verdict-first read of NVDA’s dealer structure: Trade or No trade, the risk before the rationale, why, and when to look again. Every figure says whether it traces to a Convexa number.', t, '<p class="dline"><strong style="color: var(--phosphor);">Off because</strong> a read reads the options structure (walls, flip, flow, the candidate contracts). On a build with the feed, reads run on your own provider key after you sign in.</p>')}
      <div class="tk-ctx">${ctxPanels.map(([n, w]) => nlPanel(n, w, t)).join('')}</div>
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
