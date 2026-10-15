// Final · Convexa v1 — the Lab's five instruments, one row each, placed after the Lab index row (2026-10-14).
// Production: every instrument is Not live — it draws dealer structure or the tape, which needs the Massive
// options feed — and links to the same instrument on staging (owner ruling 2026-10-14). Staging: the
// instrument on synthetic sample data in a dashed, hatched frame with the Sample tag and the Oct 7, 2026
// scenario date. Chart rulings: P-9, P-11 (sign never by hue alone), P-12 (tweens ≤ 600 ms), P-13 (11px).
// Page parts: ./lab-kit.mjs; drawings: ./lab-draw.mjs. See ./index.mjs for the row shape.
import { icon } from '../../lib.mjs';
import { chartFrame } from '../../chart-kit.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { INSTR, LAB_CSS, failedFrame, instrumentPage, loadingFrame, notLiveFrame, sampleProps, segGroup, stillNote } from './lab-kit.mjs';
import { flowFrame, magnetFrame, sfFrame, sfPlot, tapeFrame, termFrame } from './lab-draw.mjs';

const APP = 'apps/dashboard/src/app/';
const LAB = `${APP}pages/lab/`;
const STG = 'https://staging.convexa.pages.dev';
const light = { scheme: 'light' };
const hint = (t) => `<span class="hint">${t}</span>`;
const prodAccept = (id) => `Production /lab/${id}: the frame names “${INSTR[id].metric}”, shows Not live with “Would show” and “It’s off because”, and links “See it on the demo →” to ${STG}/lab/${id}; the page has no &lt;canvas&gt; and makes no request; “On this page” reads Not live · 1.`;
const ENV_PROD = (id) => `Not live. The frame names the metric (${INSTR[id].metric.toLowerCase()}), says what it would show and why it is off, and links “See it on the demo →” to /lab/${id} on staging. No canvas is created and no request is made; the controls are absent. An “On this page” line counts it.`;

/** A states board for one instrument. */
const states = (id, lead, items) => ({ minHeight = 0, scheme = 'dark' } = {}) => statesBoard({ scheme, minHeight, title: `${INSTR[id].t} · states`, lead, trace: 'P-1, P-2, P-3, P-11, P-12, P-13, Env 2026-10-14', items });
const nlItem = (id) => ({ name: 'Production', tag: ['notLive'], when: 'Every visit on the portfolio site: the frame keeps its size, names the metric and links to the same instrument on the demo.', html: notLiveFrame(id, { height: 200 }) });
const loadItem = (id, h, when) => ({ name: 'Loading', tag: ['loading'], when, html: loadingFrame(id, h) });

// ================================================================================================
// Structure Field
// ================================================================================================
const SF = 'structure-field';
const sfRead = [
  ['How to read it', ['<b>Bars</b> are net dealer gamma at each strike: above the zero line dealers are long gamma (+γ), below it short (−γ).', 'The <b>walls</b> are the largest positive (call) and negative (put) strikes; the <b>flip</b> (dashed) is where the sum crosses zero; the solid line is the <b>mid</b>.', '<b>Two clocks</b>: the structure is a snapshot; the mid moves on its own path. The field never passes a snapshot off as a gamma tick.']],
  ['Two renderers, one model', ['<b>Canvas2D</b> rebuilds the structure buffer only when the field changes; the mid and the particles paint each frame.', '<b>WebGL2</b> draws the heat and the particles on the GPU; its labels stay in the same HTML layer, at 11px or more.', '<b>Keys</b>: ← → move the probe one strike, Home and End jump to the ends, Esc clears it. Changes tween in at most 600 ms; with reduced motion they snap and nothing drifts.']],
];
const sfCtl = (dis = []) => `${segGroup('Source', ['Synthetic field', 'Demo SPY chain'], 'Synthetic field', { dis })}${segGroup('Renderer', ['Canvas2D', 'WebGL2'], 'Canvas2D')}${hint('Probe with ← → or hover')}`;
const sfPage = (env, phone = false) => (o = {}) => instrumentPage(SF, { ...o, env, controls: sfCtl(), frame: sfFrame({ phone }), read: env === 'staging' ? sfRead : sfRead.slice(0, 1), nlHeight: phone ? 300 : 300 });
const sfStates = states(SF, 'Production shows the field as Not live with the way to the demo. On the demo it draws the synthetic field, and has the states a canvas or WebGL instrument can meet: no WebGL2, no canvas at all, and a demo chain too thin to draw.', [
  loadItem(SF, 260, 'The route’s code, or the Demo SPY chain, is on its way: a skeleton at the field’s final height. Never a spinner.'),
  nlItem(SF),
  { name: 'Staging', tag: ['sample'], when: 'The synthetic field in its dashed, hatched frame: Sample tag, scenario date, “Demo · synthetic” chip, the table one click away.', html: sfFrame({ focus: false, height: 260 }) },
  { name: 'Reduced motion', tag: ['sample'], when: 'prefers-reduced-motion: the mid stops drifting, the particles and the flip’s breathing stop. The probe still moves by keyboard and hover.', html: `${stillNote()}${sfFrame({ still: true, focus: false, height: 260 })}` },
  { name: 'WebGL2 couldn’t start', tag: ['error', 'Couldn’t load'], when: 'The reader picked WebGL2 in a browser without it: the field keeps its size and draws with Canvas2D; the WebGL2 option shows disabled with the reason.', html: `<div class="lb-ctl">${segGroup('Renderer', ['Canvas2D', 'WebGL2'], 'Canvas2D', { dis: ['WebGL2'] })}</div><div class="dwarn" role="status">${icon('warn', 14)}<div><strong style="font-size: 13px;">WebGL2 couldn’t start in this browser.</strong><span class="dline" style="display: block; font-size: 12.5px;">The field is drawn with Canvas2D instead; nothing else changes.</span></div></div>` },
  { name: 'No canvas at all', tag: ['error', 'Couldn’t load'], when: 'Canvas2D failed too (blocked or out of memory): the frame keeps its size and offers the static drawing.', html: failedFrame(SF, 200, 'its canvas') },
  { name: 'Static drawing', tag: ['sample'], when: 'After “Show the static drawing”: the same bars, levels and table in SVG and HTML. No heat, particles or drift.', html: chartFrame({ claim: 'Dealers are long gamma above the 568.5 flip, most at the 580 call wall', sub: 'Static drawing · synthetic net dealer gamma by strike, $M per 1% move', body: sfPlot({ focus: false, height: 240 }), ...sampleProps('SPY gamma') }) },
  { name: 'Demo SPY chain too thin', tag: ['unavailable'], when: 'Staging: the demo’s SPY chain came back with fewer than 8 strikes (the shipped guard). The synthetic field stays, and the switch says why.', html: `<div class="lb-ctl">${segGroup('Source', ['Synthetic field', 'Demo SPY chain'], 'Synthetic field', { dis: ['Demo SPY chain'] })}</div><span class="dline">The demo’s SPY chain is too thin to draw a field — staying on the synthetic field.</span>` },
]);

// ================================================================================================
// Tape Pulse
// ================================================================================================
const TP = 'tape-pulse';
const tpRead = [
  ['How to read it', ['The <b>line</b> is the mid, one point a second over the last five minutes; the <b>dashed line</b> is the structure mid from the last structure snapshot.', '<b>Prints</b> sit in the lane below: above its line when printed above the mid (▲), under it when printed below (▼). Taller bars are larger prints.', 'Two clocks on one strip, so a fast tape never makes the structure look fresher than its snapshot.']],
  ['Keys and motion', ['<b>Pause replay</b> holds the strip; <b>Play</b> resumes it. On the demo nothing is a live print: it replays a synthetic tape and says so.', 'New prints fade in over 300 ms; with reduced motion the strip stops scrolling and redraws in place every 5 s.', 'The table lists the last eight prints for keyboards and screen readers.']],
];
const tpCtl = (paused = false) => `<button class="btn secondary sm" type="button" aria-pressed="${paused}">${paused ? `${icon('arrow', 14)}Play replay` : `${icon('pause', 14)}Pause replay`}</button>${hint('Replaying a synthetic tape · nothing here is a live print')}`;
const tpPage = (env, phone = false) => (o = {}) => instrumentPage(TP, { ...o, env, controls: tpCtl(), frame: tapeFrame({ phone }), read: env === 'staging' ? tpRead : tpRead.slice(0, 1), nlHeight: 260 });
const tpStates = states(TP, 'Production shows the strip as Not live with the way to the demo. On the demo it replays a synthetic tape: never a live dot, a flash or a clock time (P-2, Sample). The strip is a canvas, so it has a static fallback.', [
  loadItem(TP, 300, 'The route’s code is on its way: a skeleton at the strip’s final height.'),
  nlItem(TP),
  { name: 'A quiet stretch', tag: ['sample'], when: 'No prints for a while: the lane shows the gap, hatched and named, instead of an empty stretch that reads as missing data.', html: tapeFrame({ gap: true }) },
  { name: 'Reduced motion', tag: ['sample'], when: 'prefers-reduced-motion: the strip stops scrolling and redraws in place every 5 s; new prints appear without a fade.', html: `${stillNote()}${tapeFrame({ still: true })}` },
  { name: 'Replay paused', tag: null, when: 'The reader paused the replay: the strip holds its last frame and the button reads Play replay. Not the Paused data state; nothing upstream stopped.', html: `<div class="lb-ctl">${tpCtl(true)}</div><span class="dline">Replay held at minute 5 of 30.</span>` },
  { name: 'The canvas couldn’t start', tag: ['error', 'Couldn’t load'], when: 'getContext("2d") returned nothing: the frame keeps its size and offers the static drawing (today the strip stays blank).', html: failedFrame(TP, 220, 'its canvas') },
]);

// ================================================================================================
// Wall Magnet
// ================================================================================================
const WM = 'wall-magnet';
const wmRead = [
  ['How to read it', ['One <b>price scale</b>: the put wall (−γ), the flip (dashed) and the call wall (+γ) from the structure snapshot; the dot is the mid.', 'Right of the flip, in the shaded zone, dealers are <b>long gamma</b>: their hedging tends to damp moves. Left of it they are <b>short gamma</b>: hedging tends to amplify them.', 'The three figures give the signed distance from the mid to each level.']],
  ['Motion', ['The mid moves only when the data does, in a tween of at most 600 ms. Nothing drifts on simulated forces: the walls describe positioning, not a path.', 'With reduced motion the dot snaps to its new place.', 'Drawn with the chart system in HTML, so a blocked canvas changes nothing.']],
];
const wmCtl = (on = 'Above the flip') => `${segGroup('Sample mid', ['Above the flip', 'Below the flip'], on)}${hint('Two synthetic positions, to compare how each side reads')}`;
const wmPage = (env, phone = false) => (o = {}) => instrumentPage(WM, { ...o, env, controls: wmCtl(), frame: magnetFrame({ phone }), read: env === 'staging' ? wmRead : wmRead.slice(0, 1), nlHeight: 220 });
const wmStates = states(WM, 'Production shows the levels as Not live with the way to the demo. On the demo the mid sits on one price scale with the walls and the flip; the copy follows the side of the flip, and the sign is written, not only coloured.', [
  loadItem(WM, 240, 'The route’s code is on its way: a skeleton at the scale’s final height.'),
  nlItem(WM),
  { name: 'Mid above the flip', tag: ['sample'], when: 'Long-gamma side: the shaded zone holds the dot; the note says hedging tends to damp moves.', html: magnetFrame() },
  { name: 'Mid below the flip', tag: ['sample'], when: 'Short-gamma side: the dot leaves the shaded zone and the note says hedging tends to amplify moves. Position and words carry it, not a colour.', html: magnetFrame({ mid: 566.4 }) },
  { name: 'Reduced motion', tag: ['sample'], when: 'prefers-reduced-motion: when the mid changes the dot snaps instead of tweening. Nothing else moves at any time.', html: `${stillNote('Reduced motion: the dot snaps')}${magnetFrame()}` },
]);

// ================================================================================================
// Term Heat
// ================================================================================================
const TH = 'term-heat';
const thRead = [
  ['How to read it', ['The <b>line</b> is at-the-money implied vol at each tenor, on a fixed 10–26% axis.', 'The <b>ribbon</b> under it repeats the levels as one ordinal ramp: brighter is higher, on a fixed 10–30% scale, so two tickers read alike.', '<b>Contango</b> (longer tenors higher) or <b>backwardation</b> (shorter tenors higher) is written out with the signed gap; colour never carries it.']],
  ['Keys and motion', ['A new snapshot tweens the line and the ribbon in at most 600 ms; with reduced motion they snap. Between snapshots nothing moves.', '<b>Shape</b> switches the synthetic sample between a calm and a stressed curve, to compare how each reads.', '← → move between tenors; the readout names the tenor and its implied vol.']],
];
const thCtl = (on = 'Contango') => `${segGroup('Shape', ['Contango', 'Backwardation'], on)}${hint('Two synthetic curves, calm and stressed')}`;
const thPage = (env, phone = false) => (o = {}) => instrumentPage(TH, { ...o, env, controls: thCtl(), frame: termFrame({ phone }), read: env === 'staging' ? thRead : thRead.slice(0, 1), nlHeight: 240 });
const thStates = states(TH, 'Production shows the term structure as Not live with the way to the demo. On the demo the curve is a line on a fixed axis over one ordinal phosphor ribbon; contango and backwardation are words and a signed gap, never green and red.', [
  loadItem(TH, 300, 'The route’s code is on its way: a skeleton at the frame’s final height.'),
  nlItem(TH),
  { name: 'Contango', tag: ['sample'], when: 'Longer tenors above shorter: the line slopes up, the shape reads Contango, the gap is +3.8 pts.', html: termFrame() },
  { name: 'Backwardation', tag: ['sample'], when: 'Shorter tenors above longer: the line slopes down and the gap turns negative. The ribbon stays the same phosphor ramp: no red.', html: termFrame({ shape: 'backwardation' }) },
  { name: 'Reduced motion', tag: ['sample'], when: 'prefers-reduced-motion: a new snapshot or a Shape change snaps into place. The shipped canvas also oscillates the curve on its own; the final curve never moves between snapshots.', html: `${stillNote('Reduced motion: changes snap')}${termFrame()}` },
]);

// ================================================================================================
// Flow Ribbons
// ================================================================================================
const FR = 'flow-ribbons';
const frRead = [
  ['How to read it', ['The heavy <b>net</b> line is charm plus vanna: the cumulative delta dealers would need to hedge by the next expiry, if spot held still.', '<b>Charm</b> is the drift from time passing; <b>vanna</b> (dashed) the drift from implied vol easing. The band is the net if implied vol moves a point either way.', 'Above zero adds delta (+), below removes it (−); every end label carries its sign.']],
  ['Keys and motion', ['The lines draw in once, in at most 600 ms; with reduced motion they appear whole. Nothing streams: the projection changes only with a new structure snapshot.', '← → move between sessions; the readout lists net, charm and vanna for that session.', 'Three series at most; a fourth would split into small multiples.']],
];
const frCtl = () => `${segGroup('Show', ['Net and parts', 'Net only'], 'Net and parts')}${hint('A projection from a synthetic structure snapshot')}`;
const frPage = (env, phone = false) => (o = {}) => instrumentPage(FR, { ...o, env, controls: frCtl(), frame: flowFrame({ phone }), read: env === 'staging' ? frRead : frRead.slice(0, 1), nlHeight: 260 });
const frStates = states(FR, 'Production shows the projection as Not live with the way to the demo. On the demo three neutral lines (net, charm, vanna) and one band replace the shipped decorative waves; the sign rides on the zero line and the signed end labels.', [
  loadItem(FR, 340, 'The route’s code is on its way: a skeleton at the frame’s final height.'),
  nlItem(FR),
  { name: 'Both pull the same way', tag: ['sample'], when: 'The default sample: charm and vanna both remove delta; the net sits below zero and its end label says −.', html: flowFrame() },
  { name: 'The net crosses zero', tag: ['sample'], when: 'Charm and vanna pull opposite ways: the net line crosses the labelled zero line, and its end label turns +. Position and sign, not colour.', html: flowFrame({ flip: true }) },
  { name: 'Reduced motion', tag: ['sample'], when: 'prefers-reduced-motion: the lines appear whole instead of drawing in. The shipped particles and scrolling waves are gone in every mode.', html: `${stillNote('Reduced motion: no draw-in')}${flowFrame()}` },
]);

// ================================================================================================
// Rows
// ================================================================================================
const RULINGS = ['P-1', 'P-2', 'P-3', 'P-8', 'P-9', 'P-11', 'P-12', 'P-13', 'Env 2026-10-14'];

export const ROWS = [
  // ---------------------------------------------------------------------------------------------
  {
    key: 'lab-structure-field', after: 'lab', label: 'Lab · Structure Field', css: LAB_CSS, specH: 2179,
    spec: {
      title: 'Lab · Structure Field',
      route: '/lab/structure-field',
      job: 'The instrument the ticker desk’s dealer-gamma field came from: net dealer gamma by strike with the walls, the flip, the mid and a probe, drawn by two renderers so their feel and cost can be compared.',
      env: {
        production: ENV_PROD(SF),
        staging: 'The synthetic field in a dashed, hatched frame with the Sample tag, “Scenario · Oct 7, 2026” and a “Demo · synthetic” chip. Two switches: Source (Synthetic field · Demo SPY chain, which the demo transport builds from the scenario’s SPY strikes) and Renderer (Canvas2D · WebGL2).',
      },
      widgets: [
        { name: 'Field · Canvas2D', source: 'buildDemoField() in structureFieldDemo.ts, in the browser, no request · structure fixed, mid on a synthetic path', production: 'notLive', staging: 'sample' },
        { name: 'Field · WebGL2 twin', source: 'the same model on the GPU (StructureFieldWebGL.tsx) · labels in the shared HTML layer', production: 'notLive', staging: 'sample' },
        { name: 'Source: Demo SPY chain', source: 'getTicker("SPY") → demo transport strike_profile (libs/api/src/lib/demo/transport.ts:933) · staging only', production: 'Absent', staging: 'sample' },
        { name: 'Clocks line', source: 'the model: structure snapshot vs the mid’s own path', production: 'Absent', staging: 'sample' },
        { name: 'Probe readout · table', source: 'the field model: strike, net gamma, sign', production: 'Absent', staging: 'sample' },
      ],
      states: [
        { tag: 'notLive', when: 'Production, every visit, including a direct link.' },
        { tag: 'sample', when: 'Staging: the synthetic field (or the demo’s SPY chain) in the sample frame.' },
        { tag: 'loading', when: 'The route’s code or the Demo SPY chain is on its way: skeleton at the field’s final height.' },
        { tag: 'Reduced motion', when: 'No drift, particles or flip breathing; the probe still works by keyboard.' },
        { tag: ['error', 'Couldn’t load'], when: 'WebGL2 couldn’t start: Canvas2D draws instead and the WebGL2 option shows disabled with the reason. If Canvas2D fails too, the frame offers the static drawing.' },
        { tag: 'unavailable', when: 'Staging: the demo’s SPY chain has fewer than 8 strikes; the synthetic field stays and says why.' },
      ],
      phone: 'Header, then the two switches stacked full width with 44px targets, then the field at 300px with every other strike labelled; the mid label hides first. The probe follows a horizontal drag (touch-action: pan-y, so the page still scrolls). The renderer notes fold under the field.',
      acceptance: [
        prodAccept(SF),
        'Staging: the frame is dashed with a hatch stripe, carries the Sample tag and “Scenario · Oct 7, 2026”, and its chip reads “Demo · synthetic · shaped like SPY gamma”. No live dot, no “TAPE LIVE” pill.',
        'Every label on the field — levels, axis ticks, the clocks line, the readout — renders at 11px or more (the shipped canvas paints 10px: paintStep.ts:451, 500, 509, 840; StructureFieldWebGL.tsx:855, 864).',
        'Gamma sign is readable in greyscale: bars sit above or below the labelled zero line, the wall labels say +γ / −γ and the readout says “dealers long/short gamma”.',
        'Choosing WebGL2 where it is missing: the frame keeps its size, says WebGL2 couldn’t start, and draws Canvas2D.',
        'Reduced motion: the mid does not drift and nothing moves; ← → still move the probe one strike.',
        '“Demo SPY chain” draws the scenario’s SPY strikes on staging; with fewer than 8 strikes the field stays synthetic and says why.',
      ],
      built: [
        { status: 'shipped', what: 'Canvas2D field on buildDemoField(), the WebGL2 twin and its renderer toggle, reduced motion, and a WebGL2 error panel (StructureFieldLab.tsx, StructureFieldWebGL.tsx).' },
        { status: 'shipped', what: 'The design’s field in code: put wall 560, flip 568.5, call wall 580, spot 573.12 and SF_FIELD’s 21 strikes (structureFieldDemo.ts DEMO_LEVELS, 2026-10-14); the old field crossed zero at 512.9 against a 508.2 flip label.' },
        { status: 'shipped', what: 'Production Not live: LabInstrumentNotLive with “Would show”, “Off because” and “See it on the demo →”; no canvas, no request (pages/lab/LabNotLive.tsx, 62336421).' },
        { status: 'partial', what: '“Use live SPY structure” already reaches the demo transport on staging; designed: rename it “Demo SPY chain” and show it on staging only.' },
        { status: 'todo', what: 'The sample frame, Sample tag and scenario date (today: MUI chips “Lab”, “Synthetic field”, “Canvas2D”); labels in an HTML layer at 11px; the table twin; the static drawing when no canvas starts.' },
        { status: 'partial', what: 'The synthetic model paints a signal-blue “TAPE LIVE” pill (demo model live: true) — designed: no live mark on sample data. The board draws the Lab row’s field (walls 560/580, flip 568.5, mid 573.12); buildDemoField centres on 512.4 (walls 500/530, flip 508.2) — either works if the copy follows the data.' },
      ],
      rulings: RULINGS,
      code: [`${LAB}StructureFieldLab.tsx`, `${LAB}StructureFieldWebGL.tsx`, `${LAB}structureFieldDemo.ts`, `${APP}shared/charts/structure-field/ (paintStep.ts, StructureFieldCanvas.tsx)`, 'libs/api/src/lib/demo/transport.ts'],
    },
    boards: [
      { id: 'staging', title: 'Staging · demo account', w: 1440, h: 1394, body: sfPage('staging') },
      { id: 'production', title: 'Production · Not live', w: 1440, h: 1179, body: sfPage('production') },
      { id: 'phone', title: 'Phone · staging', w: 390, h: 2188, body: sfPage('staging', true) },
      { id: 'states', title: 'States', w: 1440, h: 2447, body: sfStates },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    key: 'lab-tape-pulse', after: 'lab', label: 'Lab · Tape Pulse', css: LAB_CSS, specH: 1969,
    spec: {
      title: 'Lab · Tape Pulse',
      route: '/lab/tape-pulse',
      job: 'A candidate for the desk’s tape: the mid’s last five minutes against the structure mid, with each print marked above or below it — two clocks on one strip, so a fast tape never passes for fresh structure.',
      env: {
        production: ENV_PROD(TP),
        staging: 'Replays a synthetic, SPY-shaped tape in the sample frame (dashed, hatch, Sample tag, “Scenario · Oct 7, 2026”). As P-2 asks of sample data: no live dot, no flash, no clock time — the axis counts minutes back from the latest replayed second, and the strip says it is a replay.',
      },
      widgets: [
        { name: 'Mid strip', source: 'synthetic mid generated in the browser · one point a second, 5-minute buffer · canvas', production: 'notLive', staging: 'sample' },
        { name: 'Structure mid line', source: 'the synthetic structure snapshot (slow clock)', production: 'notLive', staging: 'sample' },
        { name: 'Print lane', source: 'synthetic prints · side against the mid, size as bar height', production: 'notLive', staging: 'sample' },
        { name: 'Clocks line', source: 'structure snapshot age · replay position', production: 'Absent', staging: 'sample' },
        { name: 'Replay control · table', source: 'local: pause or play · the last eight prints', production: 'Absent', staging: 'local' },
      ],
      states: [
        { tag: 'notLive', when: 'Production, every visit.' },
        { tag: 'sample', when: 'Staging: the replay; a quiet stretch shows as a hatched, named gap in the print lane.' },
        { tag: 'loading', when: 'The route’s code is on its way: skeleton at the strip’s final height.' },
        { tag: 'Reduced motion', when: 'The strip stops scrolling and redraws in place every 5 s; prints appear without a fade.' },
        { tag: 'Replay paused', when: 'The reader paused it: the strip holds and the button reads Play replay. Not the Paused data state.' },
        { tag: ['error', 'Couldn’t load'], when: 'The canvas couldn’t start: the frame keeps its size and offers the static drawing.' },
      ],
      phone: 'The strip keeps its full 5 minutes at 358px: the y gutter stays 56px, the minute ticks drop to −5, −3 and “latest”, and the end label shortens to the value. Pause replay goes full width at 44px above the frame.',
      acceptance: [
        prodAccept(TP),
        'Staging: no pulsing bead, no flashing bar, no clock time anywhere on the strip; the frame says replay and carries the Sample tag and scenario date.',
        'Each print’s side is readable without colour: bars rise above the lane’s line for prints above the mid and hang below it for prints under, and the lane is labelled ▲ above / ▼ below (the shipped flashes are green/red bars across the plot: TapePulseLab.tsx:136-147).',
        'The trail’s x axis is time — five minutes at one point a second — not frames (shipped: up to 120 frames or 4 s, TapePulseLab.tsx:62-63).',
        'The mid is phosphor; signal blue stays reserved for a genuine stream (shipped: LAB.signal with a glow).',
        'New prints fade in within 300 ms (P-12); with reduced motion they appear and the strip redraws every 5 s.',
        'If getContext("2d") fails the frame keeps its size and offers the static drawing (today the effect returns and the canvas stays blank).',
      ],
      built: [
        { status: 'shipped', what: 'A Canvas2D strip with a synthetic mid, a dashed structure baseline, print flashes and reduced motion (no flashes or glow) (demos/TapePulseLab.tsx).' },
        { status: 'shipped', what: 'Production Not live: LabInstrumentNotLive with “Would show”, “Off because” and “See it on the demo →”; no canvas, no request (pages/lab/LabNotLive.tsx, 62336421).' },
        { status: 'todo', what: 'The print lane (sign by position and ▲/▼), the time-based 5-minute buffer, the replay control, the clocks line, the table, the sample frame.' },
        { status: 'partial', what: 'Canvas colours are hard-coded dark literals (demos/labTokens.ts), so the light theme shows a dark block; designed: tokens (see the light board). The canvas has no role or label and no fallback.' },
      ],
      rulings: RULINGS,
      code: [`${LAB}demos/TapePulseLab.tsx`, `${LAB}demos/labTokens.ts`, `${LAB}LabShell.tsx`, `${APP}shared/hooks/useReducedMotion.ts`],
    },
    boards: [
      { id: 'staging', title: 'Staging · demo account', w: 1440, h: 1309, body: tpPage('staging') },
      { id: 'production', title: 'Production · Not live', w: 1440, h: 1139, body: tpPage('production') },
      { id: 'phone', title: 'Phone · staging', w: 390, h: 1972, body: tpPage('staging', true) },
      { id: 'light', title: 'Light · staging', w: 1440, h: 1309, body: tpPage('staging'), opts: light },
      { id: 'states', title: 'States', w: 1440, h: 2042, body: tpStates },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    key: 'lab-wall-magnet', after: 'lab', label: 'Lab · Wall Magnet', css: LAB_CSS, specH: 1817,
    spec: {
      title: 'Lab · Wall Magnet',
      route: '/lab/wall-magnet',
      job: 'A candidate for the desk’s dealer levels: where the mid sits between the put and call walls on one price scale, which side of the flip it is on, and what dealers’ hedging tends to do there.',
      env: {
        production: ENV_PROD(WM),
        staging: 'Synthetic SPY-shaped levels (put wall 560, flip 568.5, call wall 580, mid 573.12) in the sample frame. A “Sample mid” switch moves the dot to the other side of the flip so both readings can be compared.',
      },
      widgets: [
        { name: 'Price scale', source: 'synthetic structure snapshot · walls and flip · HTML marks, no canvas', production: 'notLive', staging: 'sample' },
        { name: 'Mid', source: 'synthetic mid · moves only when the data does', production: 'notLive', staging: 'sample' },
        { name: 'Distances', source: 'computed from the levels and the mid · signed % and $', production: 'notLive', staging: 'sample' },
        { name: 'Side note', source: 'copy chosen by the side of the flip', production: 'Absent', staging: 'sample' },
      ],
      states: [
        { tag: 'notLive', when: 'Production, every visit.' },
        { tag: 'sample', when: 'Staging: the mid above the flip (long gamma) or below it (short gamma); the note follows the side.' },
        { tag: 'loading', when: 'The route’s code is on its way: skeleton at the scale’s final height.' },
        { tag: 'Reduced motion', when: 'The dot snaps to a new position instead of tweening.' },
      ],
      phone: 'The scale keeps one row at 358px: ticks every 10 (560, 570, 580), the zone notes shorten to “hedging amplifies / damps”, the flip label drops below the track so it never meets a wall label. The three distances stack.',
      acceptance: [
        prodAccept(WM),
        'The walls carry their sign in text (“Put wall 560 · −γ”, “Call wall 580 · +γ”) and the zones are labelled long/short gamma; in greyscale every reading survives (shipped: red and green walls over a red-to-green gradient, WallMagnetLab.tsx:84-105).',
        'The flip is a dashed steel line; amber is not used (shipped: amber with a 14px glow, WallMagnetLab.tsx:106-110).',
        'The mid moves only when its value changes, within 600 ms; no simulated forces (shipped: spring and noise physics every frame, WallMagnetLab.tsx:54-64).',
        'Below the flip the note reads “hedging tends to amplify moves”; above it “tends to damp moves”.',
        'Staging: dashed, hatched frame with the Sample tag and scenario date; the dot is phosphor, not signal blue.',
      ],
      built: [
        { status: 'shipped', what: 'A Canvas2D pin-range view with put, call and flip lines, a drifting spot and force arrows (demos/WallMagnetLab.tsx).' },
        { status: 'shipped', what: 'Production Not live: LabInstrumentNotLive with “Would show”, “Off because” and “See it on the demo →”; no canvas, no request (pages/lab/LabNotLive.tsx, 62336421).' },
        { status: 'todo', what: 'The ruled form: one HTML price scale, zones by text and position, the side-aware note, signed distances, the table and the sample frame; the physics drift and force arrows go.' },
        { status: 'partial', what: 'Hard-coded dark literals (labTokens.ts): the light theme draws a dark block. The final form uses tokens (light board).' },
      ],
      rulings: RULINGS,
      code: [`${LAB}demos/WallMagnetLab.tsx`, `${LAB}demos/labTokens.ts`, `${APP}pages/ticker/widgets/structure-hero/WallMagnetView.tsx (the desk’s view)`],
    },
    boards: [
      { id: 'staging', title: 'Staging · demo account', w: 1440, h: 1260, body: wmPage('staging') },
      { id: 'production', title: 'Production · Not live', w: 1440, h: 1099, body: wmPage('production') },
      { id: 'phone', title: 'Phone · staging', w: 390, h: 2059, body: wmPage('staging', true) },
      { id: 'light', title: 'Light · staging', w: 1440, h: 1260, body: wmPage('staging'), opts: light },
      { id: 'states', title: 'States', w: 1440, h: 2145, body: wmStates },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    key: 'lab-term-heat', after: 'lab', label: 'Lab · Term Heat', css: LAB_CSS, specH: 1802,
    spec: {
      title: 'Lab · Term Heat',
      route: '/lab/term-heat',
      job: 'A candidate for the desk’s term-structure card: implied vol across tenors as a line on a fixed axis over one ordinal ribbon, with contango or backwardation written out — never carried by green and red.',
      env: {
        production: ENV_PROD(TH),
        staging: 'A synthetic SPY-shaped curve (7d 14.2% to 90d 18.0%) in the sample frame, with a “Shape” switch to a stressed, backwardated curve (7d 24.6% to 90d 19.1%).',
      },
      widgets: [
        { name: 'Curve', source: 'synthetic at-the-money IV at 7, 14, 30, 60 and 90 days · fixed 10–26% axis', production: 'notLive', staging: 'sample' },
        { name: 'Ribbon', source: 'the same five values · one phosphor ramp on a fixed 10–30% scale', production: 'notLive', staging: 'sample' },
        { name: 'Shape figures', source: 'computed: shape word, 90d − 7d signed, 7d and 90d', production: 'notLive', staging: 'sample' },
        { name: 'Shape switch', source: 'local: Contango · Backwardation', production: 'Absent', staging: 'local' },
      ],
      states: [
        { tag: 'notLive', when: 'Production, every visit.' },
        { tag: 'sample', when: 'Staging: contango (calm) or backwardation (stressed); the ribbon is the same ramp in both.' },
        { tag: 'loading', when: 'The route’s code is on its way: skeleton at the frame’s final height.' },
        { tag: 'Reduced motion', when: 'A new snapshot or a Shape change snaps into place.' },
      ],
      phone: 'Figures stack, then the line at 170px with all five tenors labelled and the ribbon aligned under it; the Shape switch goes full width at 44px.',
      acceptance: [
        prodAccept(TH),
        'Contango and backwardation are words with a signed gap (“+3.8 pts”, “−5.5 pts”) and a slope; neither colours anything green or red (shipped: ribbon, fill and regime word green/red, TermHeatLab.tsx:80-101, 125-128).',
        'The ribbon is one ordinal phosphor ramp on a fixed 10–30% scale with its key; the same IV gives the same brightness on any ticker.',
        'The curve moves only when the snapshot changes (≤ 600 ms); the shipped tilt oscillation (sin(t·0.15)·0.35, TermHeatLab.tsx:51-56) — which swings IV by up to about 28 points and flips the regime by itself — is gone.',
        'All text 11px or more; the IV values sit outside the cells, never on a fill.',
        'Staging: the sample frame with the Sample tag and scenario date.',
      ],
      built: [
        { status: 'shipped', what: 'A Canvas2D heat ribbon over five tenors with a regime word, reduced motion (no wave, no glow) (demos/TermHeatLab.tsx).' },
        { status: 'shipped', what: 'Production Not live: LabInstrumentNotLive with “Would show”, “Off because” and “See it on the demo →”; no canvas, no request (pages/lab/LabNotLive.tsx, 62336421).' },
        { status: 'partial', what: 'Green and red carry the regime today; designed: one phosphor ramp, words and a signed gap (P-9, P-11).' },
        { status: 'todo', what: 'Fixed axis and scale, the Shape switch, keyboard readout, table, sample frame; tokens in place of the dark literals (light board).' },
      ],
      rulings: RULINGS,
      code: [`${LAB}demos/TermHeatLab.tsx`, `${LAB}demos/labTokens.ts`, `${APP}pages/ticker/widgets/term-structure/TermStructure.tsx (the desk’s card)`],
    },
    boards: [
      { id: 'staging', title: 'Staging · demo account', w: 1440, h: 1319, body: thPage('staging') },
      { id: 'production', title: 'Production · Not live', w: 1440, h: 1119, body: thPage('production') },
      { id: 'phone', title: 'Phone · staging', w: 390, h: 2114, body: thPage('staging', true) },
      { id: 'light', title: 'Light · staging', w: 1440, h: 1319, body: thPage('staging'), opts: light },
      { id: 'states', title: 'States', w: 1440, h: 2317, body: thStates },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    key: 'lab-flow-ribbons', after: 'lab', label: 'Lab · Flow Ribbons', css: LAB_CSS, specH: 1751,
    spec: {
      title: 'Lab · Flow Ribbons',
      route: '/lab/flow-ribbons',
      job: 'A candidate for the desk’s dealer flow projection: how much delta charm and vanna would ask dealers to hedge, session by session, into the next expiry — net, its two parts, and a band for an implied-vol move.',
      env: {
        production: ENV_PROD(FR),
        staging: 'A synthetic SPY-shaped projection to the Oct 16 expiry in the sample frame: net (phosphor) with a ±1 pt implied-vol band, charm (steel) and vanna (chartContext2, dashed), all signed against a labelled zero line.',
      },
      widgets: [
        { name: 'Net line and band', source: 'synthetic charm + vanna from a structure snapshot · cumulative by session', production: 'notLive', staging: 'sample' },
        { name: 'Charm · vanna lines', source: 'the two parts of the same projection', production: 'notLive', staging: 'sample' },
        { name: 'Readout · table', source: 'per session: net, charm, vanna', production: 'Absent', staging: 'sample' },
        { name: 'Show switch', source: 'local: Net and parts · Net only', production: 'Absent', staging: 'local' },
      ],
      states: [
        { tag: 'notLive', when: 'Production, every visit.' },
        { tag: 'sample', when: 'Staging: both parts pulling the same way, or opposite ways with the net crossing zero.' },
        { tag: 'loading', when: 'The route’s code is on its way: skeleton at the frame’s final height.' },
        { tag: 'Reduced motion', when: 'The lines appear whole instead of drawing in.' },
      ],
      phone: 'The plot keeps all eight sessions with short day labels (7 … 16 exp); end labels shorten to the signed value; the legend wraps to two lines above the plot; the readout moves under the plot as text on tap.',
      acceptance: [
        prodAccept(FR),
        'The lines are data: each point is a session’s cumulative projected delta, listed in the table (shipped: three decorative sine waves, FlowRibbonsLab.tsx:53-57, 82-123).',
        'Sign rides on the zero line and on signed end labels (“Net −$412M”); a line crossing zero is visible in greyscale.',
        'Neutral and ordinal (P-9): net phosphor, charm steel, vanna chartContext2 dashed, the band chartBand; no signal blue, amber or green series (shipped: signal, amber, green).',
        'No streaming or particles; one draw-in of at most 600 ms, none with reduced motion.',
        'Staging: the sample frame with the Sample tag and scenario date.',
      ],
      built: [
        { status: 'shipped', what: 'A Canvas2D view of three scrolling waves labelled charm, vanna and net flow, with particles; reduced motion slows and flattens them (demos/FlowRibbonsLab.tsx).' },
        { status: 'shipped', what: 'Production Not live: LabInstrumentNotLive with “Would show”, “Off because” and “See it on the demo →”; no canvas, no request (pages/lab/LabNotLive.tsx, 62336421).' },
        { status: 'todo', what: 'The ruled form: a session-by-session projection with a band, signed end labels, legend, readout, table and the sample frame; the synthetic projection model itself (the shipped waves carry no values).' },
        { status: 'partial', what: 'Hard-coded dark literals (labTokens.ts); tokens in the final form (light board).' },
      ],
      rulings: RULINGS,
      code: [`${LAB}demos/FlowRibbonsLab.tsx`, `${LAB}demos/labTokens.ts`],
    },
    boards: [
      { id: 'staging', title: 'Staging · demo account', w: 1440, h: 1303, body: frPage('staging') },
      { id: 'production', title: 'Production · Not live', w: 1440, h: 1139, body: frPage('production') },
      { id: 'phone', title: 'Phone · staging', w: 390, h: 1979, body: frPage('staging', true) },
      { id: 'light', title: 'Light · staging', w: 1440, h: 1303, body: frPage('staging'), opts: light },
      { id: 'states', title: 'States', w: 1440, h: 2375, body: frStates },
    ],
  },
];

