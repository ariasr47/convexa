// Final · Convexa v1 — lab group: the five instruments drawn in their ruled form on synthetic sample data
// (2026-10-14). Each returns a chart frame (chart-kit): staging's dashed, hatched Sample frame with the
// scenario date. Rulings: P-9 neutral and ordinal (phosphor for the claim, steel then chartContext2 for
// context, chartBand wash for ranges); P-11 sign by position and text as well as hue (gamma included);
// P-13 every label at 11px or more, in an HTML layer; P-12 tweens of at most 600 ms, none under reduced motion.
// The Structure Field values match the Lab index row's instrument board (shell-site-docs.mjs labDetailBoard).
import { chartFrame, dataTable, fmt, legend, plot, ticks } from '../../chart-kit.mjs';
import { INSTR, sampleProps } from './lab-kit.mjs';

// ---- shared synthetic levels (SPY-shaped, the Lab row's field) ------------------------------------
export const LV = { put: 560, flip: 568.5, call: 580, mid: 573.12 };

// ================================================================================================
// Structure Field
// ================================================================================================
export const SF_FIELD = [[550, -61], [552.5, -123], [555, -233], [557.5, -357], [560, -430], [562.5, -367], [565, -235], [567.5, -103], [570, 68], [572.5, 158], [575, 332], [577.5, 488], [580, 500], [582.5, 394], [585, 233], [587.5, 112], [590, 58], [592.5, 43], [595, 40], [597.5, 40], [600, 40]];

export function sfPlot({ phone = false, focus = true, height } = {}) {
  const h = height || (phone ? 300 : 380);
  return plot({
    height: h, pl: phone ? 48 : 56, pr: 24, prn: 12, pt: phone ? 16 : 34, pb: 34, ends: false, keyboard: true,
    x: { min: 548.75, max: 601.25, ticks: [550, 555, 560, 565, 570, 575, 580, 585, 590, 595, 600].map((v, i) => ({ v, label: String(v), minor: i % 2 === 1 })) },
    y: { min: -520, max: 580, ticks: [{ v: -400, label: '−400' }, { v: -200, label: '−200' }, { v: 0, label: '0' }, { v: 200, label: '+200' }, { v: 400, label: '+400' }] },
    hlines: [{ v: 0, kind: 'zero' }],
    bars: SF_FIELD.map(([k, v]) => ({ x: k, v, role: v > 0 ? 'up' : 'down' })), barW: phone ? 10 : 18,
    segs: [{ x0: LV.flip, y0: -520, x1: LV.flip, y1: 580, role: 'emph', width: 1.5, dash: '4 4' }, { x0: LV.mid, y0: -520, x1: LV.mid, y1: 580, role: 'ctx', width: 1.5 }],
    pointLabels: phone ? [] : [{ x: 580, y: 500, text: 'Call wall 580 · +γ' }, { x: 560, y: 60, text: 'Put wall 560 · −γ' }, { x: LV.flip, y: 580, text: `Flip ${LV.flip}` }, { x: 576, y: -440, text: `Mid ${LV.mid}`, minor: true }],
    focus: focus && !phone ? { x: 552.5, title: 'Strike 552.5 · 2 of 21', rows: [{ role: 'down', value: '−$123M', name: 'per 1% · dealers short gamma (−γ)' }] } : null,
    aria: `Synthetic net dealer gamma by strike: call wall 580, put wall 560, flip ${LV.flip}, mid ${LV.mid}. Arrow keys move the probe.`,
  });
}
export function sfFrame({ phone = false, renderer = 'Canvas2D', focus = true, still = false, height } = {}) {
  const clocks = `<div class="lb-clocks"><span><b>Structure</b> synthetic snapshot, fixed</span><span><b>Mid</b> ${still ? 'still (reduced motion)' : 'drifts on a synthetic path · not a tape'}</span><span><b>Renderer</b> ${renderer}</span></div>`;
  return chartFrame({
    claim: `Dealers are long gamma above the ${LV.flip} flip, most at the 580 call wall`,
    sub: 'Synthetic SPY-shaped field · net dealer gamma by strike, $M per 1% move · above the zero line long (+γ), below short (−γ) · dashed line the flip, solid the mid',
    body: clocks + (phone ? `<div class="lb-clocks" aria-hidden="true"><span class="mono">Put wall 560 · −γ</span><span class="mono">Flip ${LV.flip} (dashed)</span><span class="mono">Call wall 580 · +γ</span><span class="mono">Mid ${LV.mid} (solid)</span></div>` : '') + sfPlot({ phone, focus, height }),
    ...sampleProps('SPY gamma'),
    table: dataTable({ caption: 'Net dealer gamma by strike, $M per 1% move (synthetic)', cols: ['Strike', 'Net gamma ($M)', 'Sign'], rows: SF_FIELD.filter((_, i) => i % 2 === 0).map(([k, v]) => [fmt.num(k, 1), fmt.signed(v, 0), { t: v >= 0 ? 'long (+γ)' : 'short (−γ)' }]) }),
  });
}

// ================================================================================================
// Tape Pulse — 300 seconds of a synthetic mid at one point a second, and its prints
// ================================================================================================
const N = 300;
const STRUCT_MID = 573.05;
export const TAPE = Array.from({ length: N }, (_, i) => +(573.02 + Math.sin(i / 23) * 0.16 + Math.sin(i / 7) * 0.05 + Math.sin(i / 61) * 0.09 + i * 0.0005).toFixed(3));
export const PRINTS = Array.from({ length: 38 }, (_, j) => { const x = Math.round(4 + j * 7.7 + Math.sin(j * 2.1) * 3); const side = Math.sin(j * 1.9 + 0.6) + Math.sin(j / 5) * 0.6 > -0.15 ? 1 : -1; const size = 0.35 + 0.6 * Math.abs(Math.sin(j * 0.77)); return { x: Math.min(N - 1, x), side, size }; });
const tapeMax = Math.max(...TAPE.map((v) => Math.abs(v - STRUCT_MID)));

export function tapeFrame({ phone = false, gap = false, still = false } = {}) {
  const prints = gap ? PRINTS.filter((p) => p.x < 180 || p.x > 222) : PRINTS;
  const up = prints.filter((p) => p.side > 0).length;
  const xt = { min: 0, max: N - 1, ticks: [{ v: 0, label: '−5 min', align: 0 }, { v: 60, label: '−4', minor: true }, { v: 120, label: '−3' }, { v: 180, label: '−2', minor: true }, { v: 240, label: '−1', minor: true }, { v: N - 1, label: 'latest', align: 1 }] };
  const mid = plot({ height: phone ? 170 : 200, pl: 56, pr: phone ? 64 : 104, prn: 64, pt: 18, pb: 8, keyboard: false, x: { ...xt, ticks: [] },
    y: { min: 572.75, max: 573.45, ticks: [{ v: 572.8, label: '572.80' }, { v: 573.0, label: '573.00' }, { v: 573.2, label: '573.20' }, { v: 573.4, label: '573.40' }] },
    series: [{ points: TAPE.map((v, i) => [i, v]), role: 'emph', width: 1.5, end: 'Mid', endValue: fmt.num(TAPE[N - 1], 2) }, { points: [[0, STRUCT_MID], [N - 1, STRUCT_MID]], role: 'ctx', width: 1, dash: '4 4', end: { long: 'Structure mid', short: 'Struct.' }, endValue: fmt.num(STRUCT_MID, 2) }],
    aria: `Synthetic mid over the last five minutes of the replay, within ${fmt.num(tapeMax, 2)} of the structure mid ${STRUCT_MID}` });
  const lane = plot({ height: 84, pl: 56, pr: phone ? 64 : 104, prn: 64, pt: 8, pb: 28, keyboard: false, x: xt,
    y: { min: -1.1, max: 1.1, ticks: [{ v: 0.6, label: '▲ above' }, { v: -0.6, label: '▼ below' }] },
    hlines: [{ v: 0, kind: 'zero' }],
    bars: prints.map((p) => ({ x: p.x, v: p.side * p.size, role: p.side > 0 ? 'up' : 'down' })), barW: 4,
    gaps: gap ? [{ x0: 180, x1: 222, label: { long: 'No prints · 42 s', short: 'None · 42 s' } }] : [],
    aria: `${prints.length} synthetic prints: ${up} above the mid, ${prints.length - up} below` });
  const clocks = `<div class="lb-clocks"><span><b>Structure</b> snapshot <span class="mono">1 min 37 s</span> old</span><span><b>Tape</b> ${still ? 'replay, redrawn in place every 5 s' : 'replay, one point a second'} · minute <span class="mono">5</span> of <span class="mono">30</span></span></div>`;
  const laneHead = `<div class="lb-lane"><span>Prints · bar height = size · above the line: printed above the mid (▲) · below: under it (▼)</span></div>`;
  return chartFrame({
    claim: gap ? 'The tape went quiet for 42 seconds; the mid held within 40 cents of the structure mid' : `The mid held within ${Math.round(tapeMax * 100)} cents of the structure mid for five minutes; ${up} of ${prints.length} prints came above it`,
    sub: 'Synthetic SPY-shaped tape, replayed · mid, one point a second, last 5 minutes · dashed line: the structure mid, on the slow clock',
    body: clocks + mid + laneHead + lane,
    ...sampleProps('SPY’s tape'),
    table: dataTable({ caption: 'Last 8 prints (synthetic replay)', cols: ['When', 'Side', 'Size'], rows: prints.slice(-8).reverse().map((p) => [`−${fmt.num((N - 1 - p.x) / 60, 1)} min`, { t: p.side > 0 ? '▲ above the mid' : '▼ below the mid' }, `${Math.round(p.size * 400)} sh`]) }),
  });
}

// ================================================================================================
// Wall Magnet — one price scale; the mid moves only when the data does
// ================================================================================================
export function magnetFrame({ phone = false, mid = LV.mid } = {}) {
  const lo = 555, hi = 585, P = (v) => (((v - lo) / (hi - lo)) * 100).toFixed(2);
  const aboveFlip = mid >= LV.flip;
  const pct = (lvl) => ((lvl - mid) / mid) * 100;
  const tk = (phone ? [560, 570, 580] : [555, 560, 565, 570, 575, 580, 585]).map((v) => `<span class="tk" style="left: ${P(v)}%;">${v}</span>`).join('');
  const zones = `<div class="zone" style="left: 0; width: ${P(LV.flip)}%;"><b>Short gamma (−γ)</b><span>${phone ? 'hedging amplifies' : 'hedging tends to amplify moves'}</span></div><div class="zone r" style="left: ${P(LV.flip)}%; width: ${(100 - P(LV.flip)).toFixed(2)}%;"><b>Long gamma (+γ)</b><span>${phone ? 'hedging damps' : 'hedging tends to damp moves'}</span></div>`;
  const marks = `<span class="wash" style="left: ${P(LV.flip)}%; right: 0;"></span><span class="track"></span>`
    + `<span class="lv put" data-mark="essential" style="left: ${P(LV.put)}%;"></span><span class="ll a0" style="left: ${P(LV.put)}%;">${phone ? 'Put' : 'Put wall'} ${LV.put} · −γ</span>`
    + `<span class="lv flip" data-mark="essential" style="left: ${P(LV.flip)}%;"></span><span class="ll c" style="left: ${P(LV.flip)}%;">Flip ${LV.flip}</span>`
    + `<span class="lv call" data-mark="essential" style="left: ${P(LV.call)}%;"></span><span class="ll a1" style="left: ${P(LV.call)}%;">${phone ? 'Call' : 'Call wall'} ${LV.call} · +γ</span>`
    + `<span class="mid" data-mark="essential" style="left: ${P(mid)}%;"></span><span class="ml" style="left: ${P(mid)}%;">Mid ${fmt.num(mid, 2)}</span>`;
  const body = `<div class="wm" role="img" aria-label="Synthetic SPY levels on one price scale: put wall ${LV.put}, flip ${LV.flip}, call wall ${LV.call}; mid ${fmt.num(mid, 2)}, ${aboveFlip ? 'above' : 'below'} the flip.">${zones}${marks}${tk}</div>`;
  const figs = `<div class="lb-figs">${[['To the put wall', LV.put], ['To the flip', LV.flip], ['To the call wall', LV.call]].map(([l, v]) => `<div><span class="caps">${l}</span><span class="v">${fmt.signed(pct(v), 1, '%')}</span><span class="s">${fmt.signed(v - mid, 2)} · at ${v}</span></div>`).join('')}</div>`;
  const claim = aboveFlip
    ? `The mid ${fmt.num(mid, 2)} sits ${fmt.num(-pct(LV.flip), 1)}% above the ${LV.flip} flip: in the long-gamma zone, ${fmt.num(pct(LV.call), 1)}% below the call wall`
    : `The mid ${fmt.num(mid, 2)} sits ${fmt.num(pct(LV.flip), 1)}% below the ${LV.flip} flip: in the short-gamma zone, ${fmt.num(-pct(LV.put), 1)}% above the put wall`;
  const note = aboveFlip
    ? `Above the ${LV.flip} flip dealers are long gamma: their hedging tends to damp moves. A display of where dealers are positioned, not a forecast of the path.`
    : `Below the ${LV.flip} flip dealers are short gamma: their hedging tends to amplify moves. A display of where dealers are positioned, not a forecast of the path.`;
  return chartFrame({
    claim, sub: 'Synthetic SPY-shaped levels on one price scale · walls and flip from the structure snapshot · the dot is the mid',
    body: body + figs, note,
    ...sampleProps('SPY levels'),
    table: dataTable({ caption: 'Levels and the mid (synthetic)', cols: ['Level', 'Price', 'From the mid'], rows: [['Call wall (+γ)', fmt.num(LV.call, 2), fmt.signed(LV.call - mid, 2)], ['Mid', fmt.num(mid, 2), '—'], ['Flip', fmt.num(LV.flip, 2), fmt.signed(LV.flip - mid, 2)], ['Put wall (−γ)', fmt.num(LV.put, 2), fmt.signed(LV.put - mid, 2)]] }),
  });
}

// ================================================================================================
// Term Heat — a line on an absolute scale over one ordinal phosphor ribbon
// ================================================================================================
export const TERM = { contango: [14.2, 15.1, 16.4, 17.3, 18.0], backwardation: [24.6, 22.9, 21.0, 19.8, 19.1] };
const TENORS = [7, 14, 30, 60, 90];
const heat = (iv) => Math.round(6 + Math.max(0, Math.min(1, (iv - 10) / 20)) * 88); // fixed 10–30% IV scale → 6–94% phosphor
export function termFrame({ phone = false, shape = 'contango' } = {}) {
  const iv = TERM[shape];
  const slope = iv[4] - iv[0];
  const regime = slope > 0.15 ? 'Contango' : slope < -0.15 ? 'Backwardation' : 'Flat';
  const pl = 46, pr = 24;
  const line = plot({ height: phone ? 170 : 200, pl, pr, prn: pr, pt: 26, pb: 30, keyboard: true, ends: false,
    x: { min: -0.5, max: 4.5, ticks: TENORS.map((d, i) => ({ v: i, label: `${d}d` })) },
    y: { min: 10, max: 26, ticks: ticks(10, 26, 4, (v) => (v === 26 ? '26%' : String(v))) },
    series: [{ points: iv.map((v, i) => [i, v]), role: 'emph', dots: true }],
    pointLabels: iv.map((v, i) => ({ x: i, y: v, text: `${fmt.num(v, 1)}%` })),
    aria: `Synthetic at-the-money implied vol by tenor: ${iv.map((v, i) => `${TENORS[i]} days ${v}%`).join(', ')}. ${regime}.` });
  const ribbon = `<div style="margin: 0 ${pr}px 0 ${pl}px; display: flex; flex-direction: column; gap: 8px;"><div class="th-rib" aria-hidden="true">${iv.map((v) => `<span style="background: color-mix(in srgb, var(--phosphor) ${heat(v)}%, var(--panel));"></span>`).join('')}</div><div class="th-key"><span>Ribbon: one cell per tenor, brighter = higher implied vol on a fixed scale</span><span style="display: inline-flex; align-items: center; gap: 6px;"><span class="mono">10%</span><span class="thsw">${[10, 15, 20, 25, 30].map((v) => `<i style="background: color-mix(in srgb, var(--phosphor) ${heat(v)}%, var(--panel));"></i>`).join('')}</span><span class="mono">30%</span></span></div></div>`;
  const figs = `<div class="lb-figs"><div><span class="caps">Shape</span><span class="v" style="font-family: 'IBM Plex Sans', sans-serif; font-weight: 600;">${regime}</span><span class="s">${slope > 0 ? 'longer tenors above shorter' : 'shorter tenors above longer'}</span></div><div><span class="caps">90d minus 7d</span><span class="v">${fmt.signed(slope, 1)} pts</span><span class="s">${slope > 0 ? 'the curve slopes up' : 'the curve slopes down'}</span></div><div><span class="caps">7d · 90d</span><span class="v">${fmt.num(iv[0], 1)}% · ${fmt.num(iv[4], 1)}%</span><span class="s">at the money</span></div></div>`;
  const claim = slope > 0
    ? `Contango: 90-day implied vol at ${fmt.num(iv[4], 1)}% sits ${fmt.num(slope, 1)} points above 7-day`
    : `Backwardation: 7-day implied vol at ${fmt.num(iv[0], 1)}% sits ${fmt.num(-slope, 1)} points above 90-day`;
  return chartFrame({
    claim, sub: 'Synthetic SPY-shaped term structure · at-the-money implied vol by days to expiry, percent · tenors evenly spaced, not to scale',
    body: figs + line + ribbon,
    ...sampleProps('SPY implied vol'),
    table: dataTable({ caption: 'At-the-money implied vol by tenor (synthetic)', cols: ['Tenor', 'Implied vol'], rows: iv.map((v, i) => [`${TENORS[i]} days`, `${fmt.num(v, 1)}%`]) }),
  });
}

// ================================================================================================
// Flow Ribbons — cumulative projected dealer delta flow, session by session, to the next expiry
// ================================================================================================
const SESS = ['Oct 7', 'Oct 8', 'Oct 9', 'Oct 10', 'Oct 13', 'Oct 14', 'Oct 15', 'Oct 16'];
const flowAt = (t, sign = -1) => { const u = t / 7; const charm = sign * 298 * u ** 1.6, vanna = sign * 114 * u ** 1.1; return { charm, vanna, net: charm + vanna, band: 18 + 52 * u }; };
export function flowFrame({ phone = false, flip = false } = {}) {
  // flip: a sample where charm and vanna pull opposite ways and the net crosses zero
  const F = SESS.map((_, t) => { if (!flip) return flowAt(t); const u = t / 7; const charm = 210 * u ** 1.5, vanna = -150 * u ** 0.8; return { charm, vanna, net: charm + vanna, band: 18 + 40 * u }; });
  const last = F[F.length - 1];
  const ymin = flip ? -200 : -500, ymax = flip ? 260 : 80;
  const lbl = (v) => `${fmt.signed(v, 0).replace(/^([+−±])/, '$1$$')}M`;
  const body = plot({ height: phone ? 230 : 280, pl: 58, pr: 128, prn: 76, pt: 22, pb: 30, keyboard: true,
    x: { min: -0.2, max: 7.2, ticks: SESS.map((s, i) => ({ v: i, label: i === 7 ? { long: 'Oct 16 · expiry', short: '16 exp' } : { long: s, short: s.split(' ')[1] }, minor: i % 2 === 1 && i !== 7 })) },
    y: { min: ymin, max: ymax, ticks: flip ? [{ v: -150, label: '−$150M' }, { v: 0, label: '0' }, { v: 150, label: '+$150M' }] : [{ v: -400, label: '−$400M' }, { v: -200, label: '−$200M' }, { v: 0, label: '0' }] },
    hlines: [{ v: 0, kind: 'zero' }],
    bands: [{ points: F.map((f, i) => [i, f.net - f.band, f.net + f.band]) }],
    series: [
      { points: F.map((f, i) => [i, f.net]), role: 'emph', width: 2.5, dots: true, end: 'Net', endValue: lbl(last.net) },
      { points: F.map((f, i) => [i, f.charm]), role: 'ctx', width: 1.5, end: 'Charm', endValue: lbl(last.charm) },
      { points: F.map((f, i) => [i, f.vanna]), role: 'ctx2', width: 1.5, dash: '5 4', end: 'Vanna', endValue: lbl(last.vanna) },
    ],
    focus: phone ? null : { x: 4, title: `${SESS[4]} · session 5 of 8`, rows: [{ role: 'emph', value: lbl(F[4].net), name: 'net' }, { role: 'ctx', value: lbl(F[4].charm), name: 'charm' }, { role: 'ctx2', value: lbl(F[4].vanna), name: 'vanna' }] },
    aria: `Synthetic projected dealer delta flow to the Oct 16 expiry: net ${lbl(last.net)}, charm ${lbl(last.charm)}, vanna ${lbl(last.vanna)}.` });
  const share = Math.round(((last.net - F[4].net) / last.net) * 100);
  const claim = flip
    ? `Charm and vanna pull opposite ways: the net crosses zero by ${SESS[3]} and ends at ${lbl(last.net)} by the expiry`
    : `Charm and vanna project ${lbl(last.net)} of dealer delta by the Oct 16 expiry, ${share}% of it in the last three sessions`;
  const leg = legend([{ role: 'emph', name: 'Net: charm + vanna' }, { role: 'ctx', name: 'Charm: delta drift as time passes' }, { role: 'ctx2', name: 'Vanna: delta drift as implied vol eases', dash: true }, { band: true, name: 'Net if implied vol moves ±1 pt' }]);
  return chartFrame({
    claim, sub: 'Synthetic SPY-shaped projection · cumulative dealer delta to hedge, $M, by session to the Oct 16 expiry · assumes spot unchanged and implied vol easing 0.3 pts a session',
    legendHtml: leg, body,
    note: 'Above zero the projection adds delta dealers must hedge (+); below it removes it (−). A projection from the structure snapshot, not a tape of hedging prints.',
    ...sampleProps('SPY dealer flow'),
    table: dataTable({ caption: 'Projected dealer delta by session, $M (synthetic)', cols: ['Session', 'Charm', 'Vanna', 'Net'], rows: F.map((f, i) => [SESS[i], lbl(f.charm), lbl(f.vanna), lbl(f.net)]) }),
  });
}

export { INSTR };
