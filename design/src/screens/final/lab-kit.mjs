// Final · Convexa v1 — lab group: the instrument page every Lab instrument row draws (2026-10-14).
// One page per environment: production names the metric, says Not live and links to the same instrument on
// staging (no canvas, no request); staging draws the instrument on synthetic sample data in its dashed,
// hatched frame with the Sample tag and the Oct 7, 2026 scenario date. Frame, copy and taglines match the
// Lab index row (./shell-site-docs.mjs labIndexBoard / labDetailBoard) so the rows agree.
import { icon } from '../../lib.mjs';
import { stateTag } from '../../components/data-states.mjs';
import { chartFrame, stateBody } from '../../chart-kit.mjs';
import { SS_CSS, demoLink, sitePage } from './shell-site-kit.mjs';

export const LAB_CSS = SS_CSS + `
  .lb { padding-top: 28px; padding-bottom: 56px; display: flex; flex-direction: column; gap: 18px; }
  .lb-back { display: inline-flex; gap: 6px; align-items: center; min-height: 24px; font-size: 14px; text-decoration: none; align-self: flex-start; }
  .lb-h { display: flex; flex-direction: column; gap: 10px; max-width: 78ch; }
  .lb-h .t { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
  .lb-h h1 { margin: 0; font-size: 38px; line-height: 1.05; }
  .lb-h .tl { margin: 0; font-size: 15.5px; line-height: 1.6; color: var(--steel); text-wrap: pretty; }
  .lb-h .fit { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--steel); }
  .lb-h .fit b { color: var(--phosphor); font-weight: 600; }
  .lb-ctl { display: flex; flex-wrap: wrap; gap: 10px 20px; align-items: center; }
  .lb-ctl .grp { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .lb-ctl .grp > .caps { font-size: 11px; }
  .lb-ctl .hint { font-size: 12.5px; color: var(--steel); }
  .lb-ctl .btn .ico { width: 14px; height: 14px; }
  .lb-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
  .lb-read { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 24px 32px; }
  .lb-read section { border-top: 1px solid var(--line); padding-top: 14px; min-width: 0; }
  .lb-read h2 { margin: 0 0 8px; font-size: 15px; }
  .lb-read ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; line-height: 1.55; color: var(--steel); }
  .lb-read li b { color: var(--phosphor); font-weight: 600; }
  .lb-clocks { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 12px; color: var(--steel); }
  .lb-clocks b { color: var(--phosphor); font-weight: 600; }
  .lb-clocks .mono { font-size: 12px; color: var(--phosphor); }
  .lb-figs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: var(--line); border-radius: 10px; overflow: hidden; }
  .lb-figs > div { background: var(--ink-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .lb-figs .v { font: 500 16px/1.25 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .lb-figs .s { font-size: 12px; color: var(--steel); line-height: 1.4; }
  .lb-still { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--steel); }
  .lb-lane { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--steel); }
  /* Wall Magnet: one price scale, HTML marks in % of the track */
  .wm { position: relative; height: 176px; margin: 4px 0 0; }
  .wm .zone { position: absolute; top: 0; height: 40px; display: flex; flex-direction: column; justify-content: flex-end; gap: 1px; padding: 0 8px 4px; box-sizing: border-box; font-size: 12px; line-height: 1.3; color: var(--steel); }
  .wm .zone b { color: var(--phosphor); font-weight: 600; }
  .wm .zone.r { text-align: right; align-items: flex-end; }
  .wm .wash { position: absolute; top: 76px; height: 26px; background: var(--c-band); border-top: 1px solid var(--c-edge); border-bottom: 1px solid var(--c-edge); }
  .wm .track { position: absolute; left: 0; right: 0; top: 88px; height: 2px; background: var(--line-2); }
  .wm .lv { position: absolute; top: 66px; height: 46px; margin-left: -1px; border-left: 2px solid var(--steel-2); }
  .wm .lv.put { border-color: var(--down); } .wm .lv.call { border-color: var(--up); } .wm .lv.flip { border-left-style: dashed; }
  .wm .ll { position: absolute; top: 46px; font: 500 11px/1.2 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .wm .ll.a0 { transform: translateX(-1px); } .wm .ll.a1 { transform: translateX(calc(-100% + 1px)); } .wm .ll.c { transform: translateX(-50%); top: 116px; }
  .wm .mid { position: absolute; top: 81px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: var(--phosphor); box-shadow: 0 0 0 2px var(--panel); }
  .wm .ml { position: absolute; top: 136px; transform: translateX(-50%); font: 600 11px/1.2 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .wm .tk { position: absolute; top: 158px; transform: translateX(-50%); font: 400 11px/1 'IBM Plex Mono', monospace; color: var(--steel); }
  /* Term Heat: the ordinal ribbon under the line, one cell per tenor */
  .th-rib { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; }
  .th-rib > span { height: 30px; border-radius: 4px; border: 1px solid var(--line); }
  .th-key { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 12px; color: var(--steel); }
  .th-key .thsw { display: inline-grid; grid-template-columns: repeat(5, 14px); gap: 2px; }
  .th-key .thsw > i { height: 10px; border-radius: 2px; border: 1px solid var(--line); }
  @media (max-width: 899px) { .lb-read { grid-template-columns: minmax(0, 1fr); } .lb-h h1 { font-size: 30px; } }
  @media (max-width: 599px) {
    .lb { padding-top: 16px; gap: 16px; }
    .lb-back { min-height: 44px; }
    .lb-ctl { flex-direction: column; align-items: stretch; gap: 12px; }
    .lb-ctl .grp { flex-direction: column; align-items: stretch; gap: 6px; }
    .lb-ctl .seg4 { display: flex; }
    .lb-ctl .seg4 button { flex: 1 1 0; min-height: 44px; justify-content: center; }
    .lb-ctl .btn { min-height: 44px; justify-content: center; }
    .lb-figs { grid-template-columns: minmax(0, 1fr); }
  }
`;

/** One catalog entry per instrument (titles and taglines as on the Lab index; `fit` from labCatalog.ts). */
export const INSTR = {
  'structure-field': { t: 'Structure Field', tl: 'Net dealer gamma by strike as a field: walls, the flip, the mid and a probe.', st: 'On the ticker desk', fit: 'the ticker desk’s dealer-gamma field, where it already lives', metric: 'Net dealer gamma by strike', unit: '$M per 1% move', would: 'net dealer gamma by strike, with the walls, the flip and the mid you can probe.' },
  'tape-pulse': { t: 'Tape Pulse', tl: 'The mid’s recent trail and the last prints, on a strip with two clocks.', st: 'Candidate', fit: 'the desk’s tape and the mid on the structure field', metric: 'SPY mid and last prints', unit: 'price, one point a second · last 5 minutes', would: 'the mid’s trail and the last prints as they arrive.' },
  'wall-magnet': { t: 'Wall Magnet', tl: 'The mid between the put and call walls, with the flip as the polarity line.', st: 'Candidate', fit: 'the desk’s dealer levels (walls and flip)', metric: 'Where the mid sits between the walls', unit: 'SPY levels on one price scale', would: 'where the mid sits between the walls, and which way hedging pulls it.' },
  'term-heat': { t: 'Term Heat', tl: 'Implied volatility across tenors as a single ordinal ribbon.', st: 'Candidate', fit: 'the desk’s term-structure card', metric: 'At-the-money implied vol by tenor', unit: 'percent, 7 to 90 days', would: 'implied volatility by tenor, and whether the curve is in contango.' },
  'flow-ribbons': { t: 'Flow Ribbons', tl: 'Charm and vanna flow projected to the next expiry.', st: 'Candidate', fit: 'the desk’s dealer flow projection card', metric: 'Projected dealer delta flow to the next expiry', unit: '$M, cumulative', would: 'the dealer flow charm and vanna imply into the next expiry.' },
};

/** The production reason, the same sentence the Lab index uses. */
export const WHY = 'its live form reads the options chain, a paid feed this site doesn’t run, and its synthetic version is a mock, which this site doesn’t show.';

/** Sample frame props (P-3, P-8): dashed + hatch, the Sample tag, the scenario date, a dashed chip. */
export const sampleProps = (shape) => ({ kind: 'sample', state: 'sample', source: `Demo · synthetic · shaped like ${shape}`, sourceKind: 'dashed', asof: 'Scenario · Oct 7, 2026 · synthetic, no market data' });

/** The production frame: names the metric, Not live, and the way to the same instrument on staging. */
export function notLiveFrame(id, { height = 220 } = {}) {
  const d = INSTR[id];
  return chartFrame({ claim: d.metric, sub: `${d.t} · ${d.unit}`, state: 'notLive', body: stateBody('notLive', { height, text: `Not live on this site. ${d.t} would show ${d.would}`, cause: `It’s off because ${WHY}`, action: demoLink(`/lab/${id}`) }) });
}

/** A loading frame at the instrument's final height (no layout shift). */
export const loadingFrame = (id, height = 220) => { const d = INSTR[id]; return chartFrame({ claim: d.metric, sub: `${d.t} · ${d.unit}`, state: 'loading', body: stateBody('loading', { height }) }); };

/** The canvas couldn't start: the frame keeps its size and offers the static drawing. */
export function failedFrame(id, height = 220, what = 'its canvas') {
  const d = INSTR[id];
  return chartFrame({ claim: d.metric, sub: `${d.t} · ${d.unit}`, state: 'error', kind: 'sample', source: `Demo · synthetic`, sourceKind: 'dashed', body: stateBody('error', { height, text: `Couldn’t start the instrument: this browser blocked ${what}.`, cause: 'The static drawing shows the same data, without motion.', action: '<button class="btn secondary sm" type="button">Show the static drawing</button>' }) });
}

/** A labelled switch group. */
export const segGroup = (label, opts, on, { dis = [] } = {}) => `<span class="grp"><span class="caps">${label}</span><span class="seg4" role="group" aria-label="${label}">${opts.map((o) => `<button type="button" aria-pressed="${o === on}"${dis.includes(o) ? ' disabled' : ''}>${o}</button>`).join('')}</span></span>`;

/**
 * The instrument page. env: production | staging. frame: the instrument (staging) — production always draws
 * the Not live frame. controls: staging only. read: [[heading, [li...]], ...] static copy, both environments.
 */
export function instrumentPage(id, { env = 'staging', scheme = 'dark', minHeight = 0, controls = '', frame = '', read = [], nlHeight = 260 } = {}) {
  const d = INSTR[id];
  const prod = env !== 'staging';
  const head = `<a href="/lab" class="lb-back">← All demos</a><header class="lb-h"><div class="t"><h1 class="display">${d.t}</h1><span class="stag k-solid">${d.st}</span></div><p class="tl">${d.tl}</p><p class="fit"><b>Could land on:</b> ${d.fit}.</p></header>`;
  const legend = prod ? `<div class="lb-legend" role="note" aria-label="Data on this page"><span class="caps" style="color: var(--phosphor);">On this page</span>${stateTag('notLive', 'Not live · 1')}</div>` : '';
  const ctl = !prod && controls ? `<div class="lb-ctl">${controls}</div>` : '';
  const body = prod ? notLiveFrame(id, { height: nlHeight }) : frame;
  const rd = prod ? read.map(([h, i]) => [h === 'How to read it' ? 'What it draws, on the demo' : h, i]) : read;
  const readHtml = rd.length ? `<div class="lb-read">${rd.map(([h, items]) => `<section><h2>${h}</h2><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`).join('')}</div>` : '';
  return sitePage({ env, scheme, minHeight, label: `${d.t} · Lab`, main: `<div class="wrap lb">${head}${legend}${ctl}${body}${readHtml}</div>` });
}

export const stillNote = (text = 'Reduced motion: a still frame') => `<span class="lb-still">${icon('pause', 13)}${text}</span>`;
