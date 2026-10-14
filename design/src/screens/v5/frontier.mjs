// v5 wave 4 · the frontier: three working prototypes in design/site, each drawn first as its designed
// fallback (what the canvas board, a no-JS reader and a no-WebGL browser get), then enhanced by a site-only
// script (src/frontier/*.js). Every piece states its performance budget and the measured result
// (data/frontier-perf.mjs, written by main tree tmp/canvas-v5/tools/perf.mjs), its reduced-motion and
// fallback behaviour, its honest data state, and the canon amendment it needs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chartFrame, dataTable, fmt, legend, plot, smallMultiples, ticks } from '../../chart-kit.mjs';
import { CALIB, CURVES, DAYS, EVENTS, GEX_STRIKES, GEX_TENORS, MONTHS, TENORS, dLong, dayIndex, gexAt, rng, wilson } from '../../data/charts.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { PERF } from '../../data/frontier-perf.mjs';
import { sec, v5Head, v5Wrap } from './system.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const client = (f) => readFileSync(join(here, '..', '..', 'frontier', f), 'utf8');
const vh = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;';

export const FRONTIER_CSS = `
  .f1-stage { position: relative; width: 100%; aspect-ratio: 1000 / 520; border-radius: 10px; background: var(--ink-2); touch-action: pan-y; overflow: hidden; }
  .f1-stage:focus-visible, .f2-plot:focus-visible, .f3-plot:focus-visible { outline: 2px solid var(--amber-text); outline-offset: 4px; }
  .f1-poster, .f1-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .f1-canvas { cursor: grab; touch-action: pan-y; }
  .f1[data-mode="webgl"] .f1-poster { visibility: hidden; }
  .f1[data-mode="fallback"] .f1-canvas, .f1[data-mode="poster"] .f1-canvas { display: none; }
  .f1-labels { position: absolute; inset: 0; pointer-events: none; }
  .f1-labels span { position: absolute; transform: translate(-50%, -50%); font: 500 11px/1 'IBM Plex Mono', monospace; color: var(--steel); white-space: nowrap; }
  .f1-labels .lv { font: 600 11px/1.2 'IBM Plex Sans', sans-serif; color: var(--phosphor); background: var(--ink-2); padding: 2px 5px; border-radius: 4px; }
  .f1-labels .ax { font: 600 11px/1 'IBM Plex Sans', sans-serif; color: var(--steel); }
  .f1-labels .f1-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--phosphor); box-shadow: 0 0 0 2px var(--ink-2); }
  .f1-readout, .f2-date { font: 500 12.5px/1.4 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .fhelp { font-size: 12px; color: var(--steel); line-height: 1.5; }
  .fhelp .kbd { margin: 0 2px; }
  @container (max-width: 520px) { .f1-labels .minor { display: none; } }
  .f2-track { position: relative; height: 34px; margin: 2px 0 0; }
  .f2-ev { position: absolute; top: 0; transform: translateX(-50%); height: 22px; min-width: 24px; padding: 0 6px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--panel); font: 600 11px/1 'IBM Plex Sans', sans-serif; color: var(--steel); cursor: pointer; }
  .f2-ev.on { color: var(--phosphor); border-color: var(--phosphor); }
  .f2-ev:disabled { cursor: default; }
  .f2-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
  .f2-range { -webkit-appearance: none; appearance: none; flex: none; width: 100%; min-width: 0; height: 32px; background: transparent; cursor: pointer; }
  .f2-range:disabled { cursor: default; }
  .f2-range::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--line-2); }
  .f2-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; margin-top: -8px; border-radius: 50%; background: var(--phosphor); border: 2px solid var(--panel); }
  .f2-range::-moz-range-track { height: 4px; border-radius: 2px; background: var(--line-2); }
  .f2-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--phosphor); border: 2px solid var(--panel); }
  .f2-range:focus-visible { outline: 2px solid var(--amber-text); outline-offset: 4px; border-radius: 6px; }
  .f2-readout { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12.5px; color: var(--steel); }
  .f2-readout b { font: 600 13px 'IBM Plex Mono', monospace; color: var(--phosphor); margin-right: 4px; }
  .f2-readout .ev-now b { font-family: 'IBM Plex Sans', sans-serif; }
  .f3-controls { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; font-size: 12.5px; color: var(--steel); }
  .f3-rug { position: absolute; left: 0; right: 0; bottom: -2px; height: 10px; pointer-events: none; }
  .f3-rug .rug { position: absolute; bottom: 0; width: 1px; height: 5px; background: var(--steel); }
  .f3-rug .rug.y { height: 10px; background: var(--phosphor); }
  .f3-ul { margin: 6px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; line-height: 1.45; }
  .ftbl td.m { font-family: 'IBM Plex Mono', monospace; }
  .fcards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: start; }
  @media (max-width: 1099px) { .fcards { grid-template-columns: 1fr; } }
`;

// ---- shared: budget, fallback, data and canon blocks -------------------------------------------
const budgetTable = (key, rows) => {
  const m = PERF[key] || {};
  return `<div class="v5tw"><table class="v5tbl ftbl"><thead><tr><th>Budget</th><th>Target</th><th>Measured</th></tr></thead><tbody>${rows.map(([label, target, mk]) => `<tr><td class="p">${label}</td><td>${target}</td><td class="m">${m[mk] ?? '<span class="steel">not measured</span>'}</td></tr>`).join('')}</tbody></table></div><p class="cf-note">${m.env ?? 'Measured with main tree tmp/canvas-v5/tools/perf.mjs.'}</p>`;
};
const ladder = (rows) => `<div class="v5tw"><table class="v5tbl"><thead><tr><th>When</th><th>What the reader gets</th></tr></thead><tbody>${rows.map(([a, b]) => `<tr><td class="p">${a}</td><td>${b}</td></tr>`).join('')}</tbody></table></div>`;

// =================================================================================================
// F1 · the dealer-gamma surface
// =================================================================================================
const F1S = GEX_STRIKES, F1T = GEX_TENORS;
const F1V = F1T.map((d) => F1S.map((k) => +(gexAt(k, d) * 1.8).toFixed(3)));
const F1MAX = Math.max(...F1V.flat().map(Math.abs));
const LEVELS = { put: 555, flip: 571, call: 590 };
function rot(yaw, pitch) { const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch); return [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy]; }
function f1Poster() {
  const W = 1000, Hh = 520, H = 0.45 / F1MAX, yaw = -0.55, pitch = 0.52;
  let mu = 0, mv = 0;
  for (let a = 0; a <= 8; a++) for (let b = 0; b <= 4; b++) { const R = rot(-0.62 + (1.24 * a) / 8, 0.25 + (0.55 * b) / 4); for (const x of [-1, 1]) for (const y of [-F1MAX * H, F1MAX * H]) for (const z of [-0.7, 0.7]) { mu = Math.max(mu, Math.abs(R[0] * x + R[1] * y + R[2] * z)); mv = Math.max(mv, Math.abs(R[3] * x + R[4] * y + R[5] * z)); } }
  const k = Math.min((W / 2) * 0.94 / mu, (Hh / 2) * 0.9 / mv); const R = rot(yaw, pitch);
  const P = (x, y, z) => [W / 2 + k * (R[0] * x + R[1] * y + R[2] * z), Hh / 2 - k * (R[3] * x + R[4] * y + R[5] * z) + 0.04 * Hh];
  const depth = (x, y, z) => R[6] * x + R[7] * y + R[8] * z;
  const sq = F1T.map(Math.sqrt), XS = (s) => -1 + (2 * (s - F1S[0])) / (F1S[F1S.length - 1] - F1S[0]), ZT = (t) => 0.7 - (1.4 * (Math.sqrt(t) - sq[0])) / (sq[sq.length - 1] - sq[0]);
  const quads = [];
  for (let j = 0; j < F1T.length - 1; j++) for (let i = 0; i < F1S.length - 1; i++) {
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [XS(F1S[a]), F1V[b][a] * H, ZT(F1T[b])]);
    const v = (F1V[j][i] + F1V[j][i + 1] + F1V[j + 1][i] + F1V[j + 1][i + 1]) / 4;
    quads.push({ pts: c.map((p) => P(...p)), d: c.reduce((s, p) => s + depth(...p), 0) / 4, v });
  }
  quads.sort((a, b) => a.d - b.d);
  const poly = quads.map((q) => { const t = Math.min(1, Math.abs(q.v) / F1MAX); const near = Math.abs(q.v) < 0.04 * F1MAX; return `<polygon points="${q.pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="${near ? 'var(--raised-2)' : q.v > 0 ? 'var(--up)' : 'var(--down)'}" fill-opacity="${near ? 1 : (0.3 + 0.62 * t).toFixed(2)}" stroke="var(--line-2)" stroke-width="0.6"></polygon>`; }).join('');
  const plane = [[-1, 0, 0.7], [1, 0, 0.7], [1, 0, -0.7], [-1, 0, -0.7]].map((p) => P(...p));
  const contour = [];
  for (let j = 0; j < F1T.length - 1; j++) { const cross = (jj) => { for (let i = 0; i < F1S.length - 1; i++) { const a = F1V[jj][i], b = F1V[jj][i + 1]; if ((a < 0) !== (b < 0) && F1S[i] > 560 && F1S[i] < 585) { const t = a / (a - b); return XS(F1S[i]) + t * (XS(F1S[i + 1]) - XS(F1S[i])); } } return null; }; const x0 = cross(j), x1 = cross(j + 1); if (x0 != null && x1 != null) contour.push([P(x0, 0.004, ZT(F1T[j])), P(x1, 0.004, ZT(F1T[j + 1]))]); }
  const svg = `<svg class="f1-poster" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true"><polygon points="${plane.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--steel)" stroke-width="1" vector-effect="non-scaling-stroke"></polygon>${poly}${contour.map(([a, b]) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="var(--phosphor)" stroke-width="2" vector-effect="non-scaling-stroke" data-mark="essential"></line>`).join('')}</svg>`;
  const lab = (x, y, z, text, cls = '') => { const [px, py] = P(x, y, z); const pl = `${((px / W) * 100).toFixed(2)}%`, pt = `${((py / Hh) * 100).toFixed(2)}%`; return `<span class="${cls}" data-x="${x.toFixed(3)}" data-y="${y.toFixed(3)}" data-z="${z.toFixed(3)}" data-pl="${pl}" data-pt="${pt}" style="left: ${pl}; top: ${pt};">${text}</span>`; };
  const j7 = F1T.indexOf(7);
  const iC = F1S.indexOf(LEVELS.call), iP = F1S.indexOf(LEVELS.put);
  const labels = [
    ...[540, 560, 580, 600, 620].map((s, n) => lab(XS(s), 0, 0.8, String(s), n % 2 ? 'minor' : '')),
    ...[1, 7, 30, 90].map((t) => lab(1.1, 0, ZT(t), `${t}d`)),
    lab(0.35, 0, 1.0, 'Strike', 'ax'), lab(1.08, 0, -0.98, 'Days to expiry', 'ax minor'),
    lab(XS(LEVELS.call), F1V[j7][iC] * H + 0.1, ZT(7), `Call wall ${LEVELS.call} · +γ`, 'lv'),
    lab(XS(LEVELS.put), F1V[j7][iP] * H - 0.1, ZT(7), `Put wall ${LEVELS.put} · −γ`, 'lv'),
    lab(XS(LEVELS.flip), 0.02, 0.86, `Flip ${LEVELS.flip}`, 'lv'),
  ].join('');
  const [dx, dy] = P(XS(LEVELS.call), F1V[2][iC] * H, ZT(F1T[2]));
  return `${svg}<div class="f1-labels">${labels}<span class="f1-dot" style="left: ${((dx / W) * 100).toFixed(2)}%; top: ${((dy / Hh) * 100).toFixed(2)}%;"></span></div>`;
}
export function f1Body({ scheme = 'dark', minHeight = 0 } = {}) {
  const v7 = F1V[2][F1S.indexOf(LEVELS.call)];
  const fig = `<figure id="f1" class="cf k-sample f1" data-mode="poster" style="margin: 0;"><figcaption class="cf-h"><div class="cf-top"><h3 class="cf-claim">Dealers are long gamma above the ${LEVELS.flip} flip at every expiry, most at the ${LEVELS.call} call wall a week out</h3>${stateTag('sample', 'Sample')}</div><p class="cf-sub">SPY net dealer gamma by strike and days to expiry · $M per 1% move · height and colour both carry the sign: above the zero plane, green, dealers long gamma; below it, red, short gamma · the phosphor line is the flip · expiries spaced by √days · orthographic, so heights compare</p></figcaption><div class="f1-stage" tabindex="0" role="group" aria-roledescription="3D chart" aria-label="Dealer gamma surface across strike and expiry. Arrow keys move the probe; Shift and arrows turn the surface." aria-describedby="f1-ro">${f1Poster()}</div><div class="f1-readout" id="f1-ro">Strike ${fmt.num(LEVELS.call, 1)} · 7 days · +$${fmt.num(v7, 2)}M per 1% · dealers long gamma (moves tend to be damped)</div><span class="f1-live" aria-live="polite" style="${vh}"></span><p class="fhelp">Drag to turn it (sideways on a phone, so the page still scrolls) · <span class="kbd">←</span><span class="kbd">→</span> strikes · <span class="kbd">↑</span><span class="kbd">↓</span> expiries · <span class="kbd">⇧</span>+arrows turn · <span class="kbd">Home</span> resets · hover reads a point</p><div class="cf-foot">${provChip('Sample · shaped like SPY dealer gamma', 'dashed')}<span class="cf-asof">Scenario · Oct 7, 2026 · in production the options feed isn’t live, so this is the model’s shape, not a read</span></div>${dataTable({ caption: 'Net dealer gamma ($M per 1%) at the levels, by expiry', cols: ['Expiry', `Put wall ${LEVELS.put}`, `Flip ${LEVELS.flip}`, `Call wall ${LEVELS.call}`], rows: F1T.map((t, j) => [`${t} day${t > 1 ? 's' : ''}`, fmt.signed(F1V[j][F1S.indexOf(LEVELS.put)], 2), fmt.signed(F1V[j][F1S.indexOf(LEVELS.flip)], 2), fmt.signed(F1V[j][F1S.indexOf(LEVELS.call)], 2)]) })}</figure>`;
  return v5Wrap(`${v5Head('F1 · The dealer-gamma surface, in WebGL', 'The landing’s one hero instrument, Convexa’s own model, drawn in depth and turned by hand: strike across, expiry deep, dealer gamma up and down. The static projection is not a loading screen; it is the designed fallback, complete with labels and a table.', 'LD-01, DB-17 · frontier F1')}
    ${fig}
    ${sec('Budget, and what was measured', 'A mid laptop at 60 Hz: 16.7 ms per frame, about 10 ms of it ours. Measured in headless Chromium on this machine (WebGL through SwiftShader, a software rasteriser: a pessimistic stand-in for a GPU).', budgetTable('f1', [['Frame time while turning', 'p95 ≤ 16.7 ms between frames', 'drag'], ['Our work per frame', '≤ 4 ms of script per render', 'cpu'], ['Idle and hidden', '0 frames (render on demand)', 'idle'], ['Draw calls · triangles', '≤ 10 calls · ≤ 10k triangles', 'calls'], ['Drawing buffer', '≤ 2× CSS pixels (1.5× coarse pointers) · ≤ 5.2 MP', 'buffer'], ['Payload', '≤ 12 kB gzip script + data, no library', 'payload'], ['Context loss', 'falls back to the poster, recovers on restore', 'loss']]))}
    ${sec('Fallbacks', '', ladder([['WebGL2 available', 'The live surface, drag to turn, the probe by keyboard or hover, labels in HTML at 11px.'], ['No WebGL, a blocked script, or a lost context', 'The poster: the same surface projected statically, the same labels, the readout and the table. The context comes back on restore.'], ['Reduced motion', 'Nothing differs: nothing moves unless the reader moves it. No auto-rotate, no intro, no inertia.'], ['Phone', 'A sideways drag turns it; a vertical swipe scrolls the page (touch-action pan-y). Pixel ratio capped at 1.5.'], ['Hidden tab, off-screen, idle', 'No frames at all: a frame is drawn only after input, a resize or a scheme change.'], ['Screen reader', 'One labelled group; arrows move the probe and the readout is announced; the table carries every level by expiry.']]))}
    ${sec('Honest data state', '', `<div class="v5g2"><div class="v5card"><h3>Production</h3><p>The options feed isn’t live, so the hero is the model’s shape: “Illustrative sample · not a live read and not a recorded session” (the shipped caption), the dashed chip, no clock time, no dot.</p></div><div class="v5card"><h3>Demo</h3><p>The demo’s authored scenario, Oct 7, 2026, with “Demo · sample data” in place of the connection chip (canon demo exception).</p></div></div>`)}
    ${sec('Canon it needs', '', `<div class="v5card"><h3>P-15 · A runtime landing hero (owner ruling needed)</h3><p>The canon rules the landing hero a static isometric SVG and says a runtime scene needs a fresh owner ruling (Amendments 2026-09-10, D-B (A)). F1 asks for it: WebGL2 with the static projection as its designed fallback, no dependency, render on demand, no autoplay motion (so the hero curve stays the one orchestrated moment). The flip line is phosphor, not amber: amber stays spent.</p></div>`)}`, { scheme, minHeight });
}
export const f1Script = () => `window.__F1 = ${JSON.stringify({ strikes: F1S, tenors: F1T, v: F1V, vmax: F1MAX, levels: LEVELS })};\n${client('f1-gamma.js')}`;

// =================================================================================================
// F2 · a year of the curve
// =================================================================================================
const N = CURVES.length;
const evIdx = EVENTS.map((e) => ({ i: dayIndex(e.t), label: e.label, title: e.title.replace(' (illustrative)', '') }));
const F2Y = { ymin: 3, ymax: 5, yticks: [3, 3.5, 4, 4.5, 5] };
function f2Plot(i) {
  const tx = (tau) => Math.sqrt(tau); const now = CURVES[i], mo = CURVES[Math.max(0, i - 21)], st = CURVES[0];
  const pts = (c) => TENORS.map(([, tau], k) => [tx(tau), c.ys[k]]);
  return plot({ height: 300, pr: 120, prn: 64, x: { min: tx(1 / 12), max: tx(30), ticks: TENORS.filter(([n]) => ['3M', '2Y', '5Y', '10Y', '30Y'].includes(n)).map(([n, tau]) => ({ v: tx(tau), label: n })) }, y: { min: F2Y.ymin, max: F2Y.ymax, ticks: F2Y.yticks.map((v, k) => ({ v, label: k === F2Y.yticks.length - 1 ? `${fmt.num(v, 1)} %` : fmt.num(v, 1) })) }, series: [{ points: pts(st), role: 'ctx2', end: { long: 'Oct 13, 2025', short: 'Start' }, endValue: fmt.pct(st.ys[10]) }, { points: pts(mo), role: 'ctx', end: { long: 'a month before', short: '−1M' }, endValue: fmt.pct(mo.ys[10]) }, { points: pts(now), role: 'emph', width: 2.5, dots: true, end: { long: dLong(DAYS[i]).replace(/, \d{4}$/, ''), short: 'Day' }, endValue: fmt.pct(now.ys[10]) }], aria: `Treasury par yield curve on ${dLong(DAYS[i])}, a month before, and on Oct 13, 2025`, keyboard: false });
}
export function f2Body({ scheme = 'dark', minHeight = 0 } = {}) {
  const i = N - 1, now = CURVES[i], st = CURVES[0];
  const i2 = 4, i10 = 8, i3 = 1, i30 = 10;
  const claim = `By ${dLong(DAYS[i])} the front end had moved ${fmt.signed(now.ys[i3] - st.ys[i3])} points and the 30-year ${fmt.signed(now.ys[i30] - st.ys[i30])}; 2s10s ${fmt.signed(now.ys[i10] - now.ys[i2])}`;
  const months = [];
  DAYS.forEach((t, k) => { const d = new Date(t); if (k === 0 || new Date(DAYS[k - 1]).getUTCMonth() !== d.getUTCMonth()) months.push({ k, m: MONTHS[d.getUTCMonth()] }); });
  const track = `<div class="f2-track" aria-label="FOMC decisions in the year">${evIdx.map((e) => `<button type="button" class="f2-ev${Math.abs(e.i - i) <= 1 ? ' on' : ''}" data-i="${e.i}" style="left: calc(10px + (100% - 20px) * ${(e.i / (N - 1)).toFixed(4)});" disabled aria-label="${e.title}, ${dLong(DAYS[e.i])}">${e.label}</button>`).join('')}</div>`;
  const q = [N - 1 - 189, N - 1 - 126, N - 1 - 63, N - 1].map((k) => Math.max(0, k));
  const four = smallMultiples(q.map((k) => ({ title: dLong(DAYS[k]), value: `2s10s ${fmt.signed(CURVES[k].ys[i10] - CURVES[k].ys[i2])}`, body: plot({ height: 110, pt: 8, pb: 22, pl: 40, pr: 10, prn: 10, ends: false, keyboard: false, x: { min: 0.29, max: 5.48, ticks: [{ v: Math.sqrt(2), label: '2Y' }, { v: Math.sqrt(10), label: '10Y' }, { v: Math.sqrt(30), label: '30Y', align: 1 }] }, y: { min: 3, max: 5, ticks: [{ v: 3.5, label: '3.5' }, { v: 4.5, label: '4.5' }] }, series: [{ points: TENORS.map(([, tau], n) => [Math.sqrt(tau), st.ys[n]]), role: 'ctx2', width: 1.5 }, { points: TENORS.map(([, tau], n) => [Math.sqrt(tau), CURVES[k].ys[n]]), role: 'emph', width: 2 }], aria: `Curve on ${dLong(DAYS[k])}` }) })), { cols: 4 });
  const fig = `<figure id="f2" class="cf k-sample f2" data-mode="poster" style="margin: 0;"><figcaption class="cf-h"><div class="cf-top"><h3 class="cf-claim f2-claim">${claim}</h3>${stateTag('sample', 'Sample')}</div><p class="cf-sub">U.S. Treasury par yields by maturity · percent · the chosen day (phosphor), a month before it, and the first day of the year · maturities spaced by √years · FOMC decisions on the track</p></figcaption>${legend([{ name: 'Chosen day', role: 'emph' }, { name: 'A month before it', role: 'ctx' }, { name: 'Oct 13, 2025', role: 'ctx2' }])}<span class="f2-date">${dLong(DAYS[i])}</span><div class="f2-plot">${f2Plot(i)}</div><div class="f2-row"><div style="flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column;">${track}<input class="f2-range" type="range" min="0" max="${N - 1}" value="${i}" step="1" aria-label="Day of the year" aria-valuetext="${dLong(DAYS[i])}" disabled style="width: 100%;"></div><button type="button" class="btn secondary sm f2-play" aria-pressed="false" disabled>Play the year</button></div><div class="f2-readout"><span><b>${fmt.pct(now.ys[i2])}</b> 2-year</span><span><b>${fmt.pct(now.ys[i10])}</b> 10-year</span><span><b>${fmt.signed(now.ys[i10] - now.ys[i2])}</b> 2s10s (pp)</span><span><b>${fmt.pct(now.ys[i30])}</b> 30-year</span></div><span class="f2-live" aria-live="polite" style="${vh}"></span><p class="fhelp">Drag the handle or use <span class="kbd">←</span><span class="kbd">→</span> a day · <span class="kbd">PgUp</span><span class="kbd">PgDn</span> ten days · <span class="kbd">Home</span><span class="kbd">End</span> · a decision chip jumps to its day · Play runs the year at 15 days a second</p><div class="cf-foot">${provChip('Sample · shaped like the Treasury’s daily curve', 'dashed')}<span class="cf-asof">Scenario · in production this reads the Treasury’s own daily file, which is live</span></div>${dataTable({ caption: 'Par yields at each month start, percent', cols: ['Date', '3M', '2Y', '10Y', '30Y'], rows: months.map(({ k }) => [dLong(DAYS[k]), fmt.num(CURVES[k].ys[i3]), fmt.num(CURVES[k].ys[i2]), fmt.num(CURVES[k].ys[i10]), fmt.num(CURVES[k].ys[i30])]) })}</figure>`;
  return v5Wrap(`${v5Head('F2 · A year of the curve, by hand', 'Markets shows the curve today against a year ago. This lets a reader move through every business day between them, see where the Fed decided, and watch the front end come down while the long end stays: the shape of a year, not two snapshots.', 'RM-02 · frontier F2')}
    ${fig}
    ${chartFrame({ claim: 'The year in four curves: the front end eased each quarter; the long end barely moved', sub: 'The no-script fallback, and a useful summary in any case · quarter ends · Oct 13, 2025 in the background', body: four, source: 'Sample · shaped like the Treasury’s daily curve', sourceKind: 'dashed', asof: 'Scenario', kind: 'sample' })}
    ${sec('Budget, and what was measured', 'Each step rebuilds about forty elements; the year plays through 250 days in about 17 s.', budgetTable('f2', [['Frame time while playing', 'p95 ≤ 16.7 ms between frames', 'play'], ['Our work per step', '≤ 3 ms of script per render', 'cpu'], ['Idle', '0 frames when not playing; play stops when the tab is hidden', 'idle'], ['Payload', '≤ 8 kB gzip script + the year’s data', 'payload'], ['Reduced motion', 'Play becomes “Next month”: one step per press, no loop', 'reduced']]))}
    ${sec('Fallbacks', '', ladder([['Script runs', 'The scrubber, Play, the decision chips, the claim recomputed for the chosen day, the readout announced.'], ['No script', 'Today’s curve against a month and a year before, the four quarter curves, the month-start table. The range input stays disabled rather than pretending.'], ['Reduced motion', 'No animation: Play steps a month per press; dragging and the keyboard work as always.'], ['Phone', 'The same chart re-laid out (short end labels, fewer ticks); the handle is a 20px thumb on a 32px track.']]))}
    ${sec('Honest data state', '', `<div class="v5g2"><div class="v5card"><h3>Production</h3><p>Live: the Treasury’s daily par yield curve, which Markets already reads. A missing day is a gap in the scrubber’s track and says “not published”, never an interpolated curve.</p></div><div class="v5card"><h3>This prototype</h3><p>Sample, dashed and labelled: a generated year shaped like the Treasury’s, with illustrative FOMC dates.</p></div></div>`)}
    ${sec('Canon it needs', '', `<div class="v5card"><h3>P-12 · Chart motion between related states is not a motion moment</h3><p>Play is a data-driven sequence with no keyframe and no tween; it runs only when asked, stops when hidden, and is replaced by a step under reduced motion. Proposed so it can’t be read as a second orchestrated moment.</p></div>`)}`, { scheme, minHeight });
}
export const f2Script = () => `window.__F2 = ${JSON.stringify({ days: DAYS, tenors: TENORS, ys: CURVES.map((c) => c.ys), events: evIdx, ...F2Y })};\n${client('f2-curve.js')}`;

// =================================================================================================
// F3 · calibration, explorable
// =================================================================================================
const r3 = rng(91);
const TICKERS = ['NVDA', 'AMD', 'INTC', 'META', 'AMZN', 'MU', 'HOOD', 'AVGO'];
const TEMPL = [(t) => `${t} reports quarterly revenue above its guidance midpoint`, (t) => `${t} gross margin next quarter at or above this quarter’s`, () => '10-year yield below 4.00% on Dec 31', () => 'The FOMC cuts at its next meeting', (t) => `${t} files its 10-Q before the deadline`, () => 'CPI year over year below 3.0% in the next release', (t) => `${t} raises full-year guidance at results`, () => '2s10s above zero at month end'];
const CALLS = CALIB.flatMap((b) => Array.from({ length: b.n }, (_, k) => ({ p: Math.min(0.99, Math.max(0.01, +(b.p + (r3() - 0.5) * 0.09).toFixed(2))), y: k < b.k ? 1 : 0, t: TEMPL[Math.floor(r3() * TEMPL.length)](TICKERS[Math.floor(r3() * TICKERS.length)]) })));
export function f3Body({ scheme = 'dark', minHeight = 0 } = {}) {
  const B = CALIB;
  const body = plot({ height: 340, pl: 74, pr: 40, prn: 20, pt: 18, pb: 34, ends: false, keyboard: false, x: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1].map((v, i) => ({ v, label: v === 1 ? '100% said' : `${v * 100}%`, align: i === 0 ? 0 : i === 4 ? 1 : undefined })) }, y: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ v, label: v === 1 ? '100% true' : `${v * 100}%` })) }, segs: [{ x0: 0, y0: 0, x1: 1, y1: 1, role: 'edge', width: 1, dash: '5 5', essential: false }], whiskers: B.map((b) => ({ x: b.p, lo: b.ci[0], hi: b.ci[1] })), dots: B.map((b) => ({ x: b.p, y: b.hit, role: 'emph', size: 10 })), pointLabels: B.map((b) => ({ x: b.p, y: b.ci[1], text: `n ${b.n}` })), aria: 'Calibration by bin with 95% intervals' });
  const ctl = `<div class="f3-controls"><span>Interval</span><span class="seg4" role="group" aria-label="Interval">${[80, 90, 95].map((l) => `<button type="button" data-level="${l}" aria-pressed="${l === 95}" disabled>${l}%</button>`).join('')}</span><span>Bins</span><span class="seg4" role="group" aria-label="Bin width">${[['Tenths', 0.1], ['Fifths', 0.2]].map(([n, w]) => `<button type="button" data-width="${w}" aria-pressed="${w === 0.1}" disabled>${n}</button>`).join('')}</span></div>`;
  const fig = `<figure id="f3" class="cf k-sample f3" data-mode="poster" style="margin: 0;"><figcaption class="cf-h"><div class="cf-top"><h3 class="cf-claim f3-claim">At 95% confidence the 90–100% bin is the least certain: ${B[9].n} calls, anywhere from ${Math.round(B[9].ci[0] * 100)}% to 100% true</h3>${stateTag('sample', 'Sample')}</div><p class="cf-sub f3-sub">Share of forecasts that came true, by stated probability · ${CALLS.length} sample calls · dot = hit rate, bar = 95% interval (Wilson), n above each, dashed line = perfectly calibrated</p></figcaption>${ctl}<div class="f3-plot" tabindex="0" role="group" aria-roledescription="chart" aria-label="Calibration by bin. Left and right arrows choose a bin; its calls are listed below.">${body}</div><div class="f3-calls"><p class="cf-note">Choose a bin (arrow keys on the chart, or click a dot) to read its calls.</p></div><span class="f3-live" aria-live="polite" style="${vh}"></span><div class="cf-foot">${provChip('Sample · shaped like a year of graded calls', 'dashed')}<span class="cf-asof">Scenario · production has fewer than 20 graded calls and shows its empty state</span></div>${dataTable({ caption: 'Calibration by bin, 95% Wilson interval', cols: ['Stated', 'Calls', 'Came true', 'Rate', '95% interval'], rows: B.map((b) => [`${Math.round(b.p * 100 - 5)}–${Math.round(b.p * 100 + 5)}%`, String(b.n), String(b.k), `${Math.round(b.hit * 100)}%`, `${Math.round(b.ci[0] * 100)}–${Math.round(b.ci[1] * 100)}%`]) })}</figure>`;
  return v5Wrap(`${v5Head('F3 · How sure is the scorecard?', 'Convexa grades its own calls. This shows how much a bin of calls can say: change the interval and watch the bars, merge bins and watch them narrow, read the calls behind any dot. The point is the honesty of the record, not the record itself.', 'RS-03 · frontier F3')}
    ${fig}
    ${sec('Budget, and what was measured', '', budgetTable('f3', [['Our work per change', '≤ 3 ms of script per redraw', 'cpu'], ['Response', 'next frame after a press', 'response'], ['Idle', '0 frames: nothing animates', 'idle'], ['Payload', '≤ 10 kB gzip script + the calls', 'payload']]))}
    ${sec('Fallbacks', '', ladder([['Script runs', 'Interval and bin controls, keyboard over bins, the calls behind a dot, the claim recomputed.'], ['No script', 'The 95% chart with every bin, its n and its interval, and the table. The controls stay disabled rather than pretending.'], ['Reduced motion', 'Nothing differs: every change is an instant redraw.'], ['Phone', 'Re-laid out by the chart system; the controls wrap; the n labels shorten.']]))}
    ${sec('Honest data state', '', `<div class="v5g2"><div class="v5card"><h3>Production</h3><p>The Scorecard has fewer than 20 graded calls, so it shows the empty state that teaches (“N of 20 resolved”). This explorer appears once there are enough calls to say something.</p></div><div class="v5card"><h3>This prototype</h3><p>Sample calls, dashed and labelled, shaped like a year of graded forecasts. No call is real; none is advice.</p></div></div>`)}
    ${sec('Canon it needs', '', '<div class="v5card"><h3>None</h3><p>It uses the chart system, neutral roles, the focus ring and no motion.</p></div>')}`, { scheme, minHeight });
}
export const f3Script = () => `window.__F3 = ${JSON.stringify({ calls: CALLS })};\n${client('f3-calibration.js')}`;

// =================================================================================================
// The overview board
// =================================================================================================
export function frontierBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const card = (k, title, what, path, amend) => { const m = PERF[k] || {}; return `<div class="v5card" style="gap: 10px;"><h3>${title}</h3><p>${what}</p><dl style="margin: 0; display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 6px 10px; font-size: 12.5px;"><dt class="steel">Prototype</dt><dd style="margin: 0;" class="mono">${path}</dd><dt class="steel">Measured</dt><dd style="margin: 0;">${m.summary ?? 'not measured'}</dd><dt class="steel">Canon</dt><dd style="margin: 0;">${amend}</dd></dl></div>`; };
  const cards = `<div class="fcards">${card('f1', 'F1 · The dealer-gamma surface, in WebGL', 'The landing hero in depth, turned by hand, with the static projection as its designed fallback. Not live in production; labelled as the model’s shape.', 'design/site/v5-frontier-gamma.html', 'P-15 (owner ruling needed: a runtime landing scene)')}${card('f2', 'F2 · A year of the curve, by hand', 'Every business day of the Treasury curve, FOMC decisions on the track, the claim recomputed per day. Live data in production.', 'design/site/v5-frontier-curve.html', 'P-12 (chart motion between related states)')}${card('f3', 'F3 · How sure is the scorecard?', 'Calibration with intervals you can change, bins you can merge and the calls behind every dot.', 'design/site/v5-frontier-calibration.html', 'none')}</div>`;
  const not = `<div class="v5tw"><table class="v5tbl"><thead><tr><th>Candidate</th><th>Decision</th><th>Why</th></tr></thead><tbody>${[
    ['CFTC positioning as horizon charts', 'Not built', 'Horizon charts buy density at the cost of reading: they fold the sign into hue, which this palette spends only on money moving. Four groups across a handful of contracts fit small multiples on one scale (drawn on the Markets family board).'],
    ['A note’s valuation bridge you can step through', 'Not built (next)', 'Worth doing after the bridge can cross zero (RN-04, a shipped defect); stepping is polish on a chart that first has to be right.'],
    ['An event timeline joining filings, FOMC and results to price', 'Blocked', 'Convexa holds no price licensed for display; TradingView’s frame is display-only. The event lane already joins filings, FOMC and results to rates, positioning and company figures.'],
  ].map(([a, b, c]) => `<tr><td class="p">${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table></div>`;
  const posters = `<div class="v5g2"><div class="pitem"><span class="caps">F1 poster (no WebGL)</span><div class="f1" data-mode="poster"><div class="f1-stage">${f1Poster()}</div></div></div><div class="pitem"><span class="caps">F2 fallback (no script)</span>${f2Plot(N - 1)}</div></div>`;
  return v5Wrap(`${v5Head('The frontier: three pieces, chosen by value', 'Each works in design/site, each draws its designed fallback first (shown below, as this board shows them), and each carries a measured budget, a reduced-motion answer, an honest data state and the canon it would need.', 'the v5 brief, wave 4')}${cards}${sec('The fallbacks, as drawn', '', posters)}${sec('Considered, and not built', '', not)}`, { scheme, minHeight });
}
