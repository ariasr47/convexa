// Chart kit (v5, 2026-10-13) — one chart system for every Convexa chart, successor of lib.mjs
// fluidChart(). Same construction, extended: lines, bands, gridlines and hairlines live in a stretched
// SVG with non-scaling strokes; every label, tick, bar, dot, event chip and readout is HTML placed in %
// of the plot area, so text is drawn at its true px size at any width and never under 11px. Under 480px
// of container the chart re-lays itself out (short labels, fewer ticks, narrower gutter); it is never
// scaled down.
//
// Method: the dataviz skill (form → colour job → validator → mark specs → hover layer → access pass),
// with Convexa's tokens in place of its placeholder palette, and the canon on top:
//   • neutral first: the claim's series is phosphor (emphasis), context is steel then chartContext2
//     (an ordinal neutral ramp, validator PASS in both schemes; tmp/canvas-v5/tools/validator-wave2.log);
//   • green/red only where money moves (P&L, flow, gamma sign) — and then never alone: position and a
//     signed label carry the sign (the pair fails CVD separation, ΔE 4.3–4.7 deutan);
//   • amber is spent: the focus ring and the base diamond only, never a series;
//   • mono = a figure Convexa traced (its computation or a primary source); Sans + dotted rule = untraced.
//   • frame border = provenance, like the chip: solid ours/primary, dotted third party, dashed sample.
import { icon, tokens } from './lib.mjs';
import { provChip, stateTag } from './components/data-states.mjs';

// ---- proposed chart roles (tokens.json additions.proposed; verify-tokens checks them) ------------
const P = tokens.additions.proposed || {};
const role = (k, mode) => (P[k] ? P[k][mode] : '');

export const CHART_CSS = `
  :root, [data-scheme="dark"] { --c-emph: var(--phosphor); --c-ctx: var(--steel); --c-ctx2: ${role('chartContext2', 'dark')}; --c-band: ${role('chartBand', 'dark')}; --c-grid: var(--line); --c-axis: var(--line-2); --c-edge: var(--steel-2); }
  /* Re-declared here so var(--phosphor) etc. resolve against the light scheme on light boards, not the :root dark values. */
  [data-scheme="light"] { --c-emph: var(--phosphor); --c-ctx: var(--steel); --c-ctx2: ${role('chartContext2', 'light')}; --c-band: ${role('chartBand', 'light')}; --c-grid: var(--line); --c-axis: var(--line-2); --c-edge: var(--steel-2); }
  .cf { position: relative; display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 18px 20px 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; container-type: inline-size; }
  .cf.k-third { border: 1px dotted var(--steel-2); }
  .cf.k-sample { border: 1px dashed var(--steel-2); }
  .cf.k-sample::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8px; border-radius: 11px 11px 0 0; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--steel) 28%, transparent) 6px 12px); pointer-events: none; }
  .cf-h { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .cf-top { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 6px 10px; }
  .cf-claim { margin: 0; flex: 1 1 260px; min-width: 0; font: 600 15px/1.35 'IBM Plex Sans', sans-serif; color: var(--phosphor); text-wrap: balance; }
  .cf-sub { margin: 0; font-size: 12px; line-height: 1.45; color: var(--steel); text-wrap: pretty; }
  .cf-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: 12px; color: var(--steel); }
  .cf-asof { font: 400 11px/1.3 'IBM Plex Mono', monospace; color: var(--steel); }
  .cf-tab > summary { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text-info); list-style: none; }
  .cf-tab > summary::-webkit-details-marker { display: none; }
  .cf-tab > summary::before { content: '▸'; font-size: 11px; color: var(--steel); }
  .cf-tab[open] > summary::before { content: '▾'; }
  .cf-tw { margin-top: 8px; max-width: 100%; overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
  .cf-tw:focus-visible { outline: 2px solid var(--amber-text); outline-offset: 2px; }
  .cf-tw table { border-collapse: collapse; width: 100%; font-size: 12px; }
  .cf-tw caption { text-align: left; padding: 8px 10px; font-size: 12px; color: var(--steel); }
  .cf-tw th, .cf-tw td { padding: 6px 10px; text-align: right; border-top: 1px solid var(--line); white-space: nowrap; }
  .cf-tw th:first-child, .cf-tw td:first-child { text-align: left; }
  .cf-tw thead th { font-weight: 600; color: var(--steel); background: var(--ink-2); position: sticky; top: 0; }
  .cf-tw td { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
  .cf-tw td.t { font-family: 'IBM Plex Sans', sans-serif; }
  /* A link cell in a twin (the insider trades' Form 4, ChartFrame TableTwinLink with standaloneLinkSx): 24px, 44 under a
     coarse pointer, so a row's link is a full target on a phone (spec 02 step 5a: 50x44 coarse, 50x24 fine). */
  .cf-tw td a { display: inline-flex; align-items: center; min-height: 24px; } @media (pointer: coarse) { .cf-tw td a { min-height: 44px; } }
  .cf-note { font-size: 12px; color: var(--steel); line-height: 1.45; margin: 0; text-wrap: pretty; }
  .cf-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--steel); }
  .cf-legend .k { display: inline-flex; align-items: center; gap: 6px; }
  .cf-legend .k i { display: inline-block; width: 16px; height: 2px; border-radius: 1px; background: currentColor; }
  .cf-legend .k i.band { height: 10px; width: 14px; border-radius: 2px; background: var(--c-band); border-top: 1px solid var(--c-edge); border-bottom: 1px solid var(--c-edge); }

  .cx { position: relative; width: 100%; container-type: inline-size; }
  .cx[tabindex]:focus-visible { outline: 2px solid var(--amber-text); outline-offset: 6px; border-radius: 4px; }
  .cx .pa { position: absolute; left: var(--pl); right: var(--pr); top: var(--pt); bottom: var(--pb); }
  .cx svg.ln { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .cx .yl { position: absolute; right: calc(100% + 8px); transform: translateY(-50%); font: 400 11px/1 'IBM Plex Mono', monospace; color: var(--steel); white-space: nowrap; }
  .cx .yl.u { transform: translateY(-50%); }
  .cx .xl { position: absolute; top: calc(100% + 8px); transform: translateX(-50%); font: 400 11px/1 'IBM Plex Mono', monospace; color: var(--steel); white-space: nowrap; }
  .cx .xl.a0 { transform: none; } .cx .xl.a1 { transform: translateX(-100%); }
  .cx .el { position: absolute; left: calc(100% + 10px); transform: translateY(-50%); display: flex; flex-direction: column; gap: 1px; font: 600 12px/1.15 'IBM Plex Sans', sans-serif; color: var(--phosphor); white-space: nowrap; }
  .cx .el .v { font: 500 11px/1.1 'IBM Plex Mono', monospace; color: var(--steel); }
  .cx .el.ctx { font-weight: 500; color: var(--steel); }
  .cx .ldr { position: absolute; left: calc(100% + 2px); width: 6px; border-left: 1px solid var(--c-axis); border-top: 1px solid var(--c-axis); border-bottom: 1px solid var(--c-axis); pointer-events: none; }
  .cx .pl { position: absolute; transform: translate(-50%, calc(-100% - 8px)); font: 500 11px/1 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .cx .pl.b { transform: translate(-50%, 8px); }
  .cx .pl.pl-l { transform: translate(calc(-100% - 8px), -50%); }
  .cx .pl.pl-r { transform: translate(8px, -50%); }
  .cx .dot { position: absolute; width: 8px; height: 8px; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 2px var(--panel); }
  .cx .dot.ring { background: var(--panel); border: 2px solid var(--c-emph); }
  .cx .bar { position: absolute; transform: translateX(-50%); border-radius: 4px 4px 0 0; min-height: 1px; }
  .cx .bar.neg { border-radius: 0 0 4px 4px; }
  .cx .bar.hb { transform: translateY(-50%); border-radius: 0 4px 4px 0; }
  .cx .bar.hb.neg { border-radius: 4px 0 0 4px; }
  .cx .bar.out { background: transparent !important; border: 1.5px dashed var(--c-edge); box-sizing: border-box; }
  .cx .bv { position: absolute; transform: translate(-50%, calc(-100% - 4px)); font: 500 11px/1 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .cx .bv.neg { transform: translate(-50%, 4px); }
  .cx .evlane { position: absolute; right: calc(100% + 8px); top: calc(-1 * var(--pt) + 6px); font: 600 11px/1 'IBM Plex Sans', sans-serif; color: var(--steel); white-space: nowrap; }
  .cx .ev { position: absolute; top: calc(-1 * var(--pt) + 2px); transform: translateX(-50%); display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border: 1px solid var(--line-2); border-radius: 999px; background: var(--panel); font: 600 11px/1 'IBM Plex Sans', sans-serif; color: var(--phosphor); white-space: nowrap; }
  .cx .ev.lane2 { top: calc(-1 * var(--pt) + 26px); }
  .cx .ev.e0 { transform: translateX(-12px); } .cx .ev.e1 { transform: translateX(calc(-100% + 12px)); }
  .cx .rg { position: absolute; top: 0; bottom: 0; background: var(--c-band); border-left: 1px solid var(--c-edge); border-right: 1px solid var(--c-edge); }
  .cx .rgl { position: absolute; top: 4px; transform: translateX(-50%); font: 500 11px/1.2 'IBM Plex Sans', sans-serif; color: var(--steel); white-space: nowrap; }
  .cx .gap { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, transparent 0 5px, var(--line) 5px 6px); }
  .cx .gapl { position: absolute; bottom: 6px; transform: translateX(-50%); font: 400 11px/1.2 'IBM Plex Sans', sans-serif; color: var(--steel); white-space: nowrap; background: var(--panel); padding: 0 4px; }
  .cx .wk { position: absolute; width: 0; border-left: 2px solid var(--c-edge); transform: translateX(-1px); }
  .cx .wk::before, .cx .wk::after { content: ''; position: absolute; left: -6px; width: 10px; border-top: 2px solid var(--c-edge); }
  .cx .wk::before { top: 0; } .cx .wk::after { bottom: 0; }
  .cx .fb { position: absolute; transform: translateX(-50%); border-radius: 3px; box-sizing: border-box; min-height: 2px; }
  .cx .fb.o { background: transparent !important; border: 1.5px solid var(--c-ctx); }
  .cx .fbv { position: absolute; transform: translate(-50%, calc(-100% - 4px)); font: 500 11px/1 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .cx .fbv.b { transform: translate(-50%, 4px); }
  .cx .dt { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 2px var(--panel); }
  .cx .dt.o { background: var(--panel) !important; border: 2px solid var(--c-ctx); }
  .cx .xh { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px solid var(--steel); pointer-events: none; }
  .cx .ro { position: absolute; top: 0; min-width: 150px; padding: 8px 10px; border-radius: 8px; background: var(--raised); border: 1px solid var(--line-2); box-shadow: var(--e2); display: flex; flex-direction: column; gap: 4px; z-index: 2; pointer-events: none; }
  .cx .ro .rh { font: 600 11px/1.2 'IBM Plex Sans', sans-serif; color: var(--steel); }
  .cx .ro .rr { display: grid; grid-template-columns: 14px auto 1fr; align-items: center; gap: 6px; font-size: 12px; color: var(--steel); white-space: nowrap; }
  .cx .ro .rr b { font: 600 13px/1.2 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .cx .ro .rr i { display: block; height: 2px; width: 12px; border-radius: 1px; }
  .cx .fring { position: absolute; width: 14px; height: 14px; border-radius: 50%; transform: translate(-50%, -50%); border: 2px solid var(--amber-text); pointer-events: none; }
  .cx .s { display: none; }
  .cx .zl { position: absolute; left: 0; font: 500 11px/1 'IBM Plex Sans', sans-serif; color: var(--steel); transform: translateY(calc(-100% - 3px)); white-space: nowrap; }
  @container (max-width: 480px) { .cx .pa { right: var(--prn); } .cx .l { display: none; } .cx .s { display: inline; } .cx .minor { display: none; } .cx .ev:not(.keep) { display: none; } .cx .ev.keep { top: calc(-1 * var(--pt) + 2px); } .cx .ro { min-width: 0; max-width: 42%; } .cx .ro .rr { white-space: normal; } }
  @container (max-width: 480px) { .cf { padding: 14px 14px 12px; } .cf-claim { font-size: 14px; } }

  .rbar { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .rbar .tr { position: relative; height: 26px; }
  .rbar .tk { position: absolute; left: 0; right: 0; top: 11px; height: 4px; border-radius: 2px; background: var(--line); }
  .rbar .rn { position: absolute; top: 7px; height: 12px; border-radius: 6px; background: var(--c-band); border: 1px solid var(--c-edge); box-sizing: border-box; }
  .rbar .md { position: absolute; top: 5px; width: 2px; height: 16px; margin-left: -1px; background: var(--c-ctx); }
  .rbar .nw { position: absolute; top: 2px; width: 4px; height: 22px; margin-left: -2px; border-radius: 2px; background: var(--c-emph); box-shadow: 0 0 0 2px var(--panel); }
  .rbar .dm { position: absolute; top: 6px; width: 14px; height: 14px; margin-left: -7px; transform: rotate(45deg); background: var(--amber); box-shadow: 0 0 0 2px var(--panel); }
  .rbar .lb { position: relative; height: 14px; font: 400 11px/14px 'IBM Plex Mono', monospace; color: var(--steel); }
  .rbar .lb span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
  .rbar .lb span.a0 { transform: none; } .rbar .lb span.a1 { transform: translateX(-100%); } .rbar .lb span.r2 { top: 16px; }

  .spk { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .spk svg { display: block; overflow: visible; }
  .spk .v { font: 500 12px/1 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .spk .sc { font-size: 11px; color: var(--steel); }

  .smx { display: grid; grid-template-columns: repeat(var(--smc, 3), minmax(0, 1fr)); gap: 16px 20px; }
  .smx .sm { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .smx .sm h4 { margin: 0; font: 600 12px/1.3 'IBM Plex Sans', sans-serif; color: var(--phosphor); }
  .smx .sm .smv { font: 500 11px/1.2 'IBM Plex Mono', monospace; color: var(--steel); }
  @container (max-width: 720px) { .smx { --smc: 2; } }
  @container (max-width: 480px) { .smx { --smc: 1; } }

  .cskel { position: absolute; inset: 0; border-radius: 6px; background: repeating-linear-gradient(0deg, transparent 0 calc(25% - 1px), var(--line) calc(25% - 1px) 25%); }
  .cskel::after { content: ''; position: absolute; inset: 0; border-radius: 6px; background: linear-gradient(90deg, transparent, rgba(138,155,180,0.07), transparent); }
  .cstate { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 8px; padding: 0 8px; }
  .cstate .msg { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 480px; padding: 12px 14px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); }
  .cstate.warn .msg { border-left: 2px solid var(--warn); }
  .cstate p { margin: 0; max-width: 460px; font-size: 13px; line-height: 1.5; color: var(--phosphor); text-wrap: pretty; }
  .cstate .q { color: var(--steel); font-size: 12px; }
  .cghost { position: absolute; inset: 0; }
  .cghost svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  @media (prefers-reduced-motion: reduce) { .cx *, .cf * { transition: none !important; animation: none !important; } }
`;

// ---- formatting (Intl, en-US, pinned in the build so boards are deterministic) ------------------
const NF = (o) => new Intl.NumberFormat('en-US', o);
export const fmt = {
  num: (v, dp = 2) => NF({ minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v),
  pct: (v, dp = 2) => `${NF({ minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v)}%`,
  signed: (v, dp = 2, unit = '') => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${NF({ minimumFractionDigits: dp, maximumFractionDigits: dp }).format(Math.abs(v))}${unit}`,
  bp: (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.round(Math.abs(v))} bp`,
  compact: (v, dp = 1) => NF({ notation: 'compact', maximumFractionDigits: dp }).format(v),
  signedCompact: (v, dp = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${NF({ notation: 'compact', maximumFractionDigits: dp }).format(Math.abs(v))}`,
  usd: (v) => NF({ style: 'currency', currency: 'USD', notation: Math.abs(v) >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(v) >= 1e6 ? 1 : 2 }).format(v),
};
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const lab = (l) => (l == null ? '' : typeof l === 'string' ? l : `<span class="l">${l.long}</span><span class="s">${l.short}</span>`);
const plain = (l) => (l == null ? '' : typeof l === 'string' ? l.replace(/<[^>]+>/g, '') : l.long);
const ROLE = { emph: 'var(--c-emph)', ctx: 'var(--c-ctx)', ctx2: 'var(--c-ctx2)', up: 'var(--up)', down: 'var(--down)', edge: 'var(--c-edge)', axis: 'var(--c-axis)', amber: 'var(--amber)' };
const col = (r) => ROLE[r] || r || ROLE.emph;

/**
 * plot() — the one plotting surface. Everything optional except the domains.
 *  x: { min, max, ticks: [{ v, label, minor, align }] }     y: { min, max, ticks: [{ v, label }], unitTop }
 *  series: [{ id, name, points: [[x, y|null]], role, width, end, endValue, dots, dash, step }]
 *          null y breaks the line (no interpolation across a gap) and draws the gap as hatched + named.
 *  bands:  [{ points: [[x, lo, hi]] }]    regions: [{ x0, x1, label }]   hlines: [{ v, label, kind: 'zero'|'ref' }]
 *  bars:   [{ x, v, role, label, out }]   (vertical, from the zero baseline, ≤ 24px thick, 4px data end)
 *  hbars:  [{ y, v, role, label }]        (horizontal: categories down the side)
 *  events: [{ x, label, short, minor, lane }]   an event lane above the plot + a hairline
 *  pointLabels: [{ x, y, text, pos }]     selective direct labels (an extreme, the latest, the one that matters)
 *  focus:  { x, title, rows: [{ role, value, name }] }   the scrub state, drawn (crosshair + readout + focus ring)
 *  gaps:   [{ x0, x1, label }]            explicit no-data stretches
 *  extra:  html appended inside the plot area last (above every mark), for a chart's own labels
 */
export function plot({ height = 220, pl = 46, pr = 120, prn = 64, pt = 18, pb = 28, x, y, series = [], bands = [], regions = [], hlines = [], bars = [], hbars = [], events = [], pointLabels = [], focus = null, gaps = [], aria = '', id = '', keyboard = true, barW = 24, hbarH = 14, ends = true, eventLane = '', whiskers = [], fbars = [], connect = false, dots = [], segs = [], extra = '' } = {}) {
  const X = (v) => ((v - x.min) / (x.max - x.min)) * 100;
  const Y = (v) => (1 - (v - y.min) / (y.max - y.min)) * 100;
  const f2 = (n) => n.toFixed(2);
  const svg = [];
  // gridlines: solid hairlines, recessive; the zero line one step stronger
  for (const t of y.ticks || []) svg.push(`<line x1="0" x2="1000" y1="${f2(Y(t.v) * 10)}" y2="${f2(Y(t.v) * 10)}" stroke="var(--c-grid)" vector-effect="non-scaling-stroke"></line>`);
  for (const h of hlines) svg.push(`<line x1="0" x2="1000" y1="${f2(Y(h.v) * 10)}" y2="${f2(Y(h.v) * 10)}" stroke="${h.kind === 'zero' ? 'var(--c-axis)' : 'var(--c-edge)'}" ${h.kind === 'ref' ? 'stroke-dasharray="4 4"' : ''} vector-effect="non-scaling-stroke"></line>`);
  for (const e of events) svg.push(`<line x1="${f2(X(e.x) * 10)}" x2="${f2(X(e.x) * 10)}" y1="0" y2="1000" stroke="var(--c-axis)" vector-effect="non-scaling-stroke"${e.minor ? ' class="minor"' : ''}></line>`);
  for (const b of bands) {
    const top = b.points.map(([px, , hi]) => `${f2(X(px) * 10)},${f2(Y(hi) * 10)}`);
    const bot = b.points.slice().reverse().map(([px, lo]) => `${f2(X(px) * 10)},${f2(Y(lo) * 10)}`);
    svg.push(`<polygon points="${[...top, ...bot].join(' ')}" fill="var(--c-band)" stroke="none"></polygon>`);
    svg.push(`<polyline points="${top.join(' ')}" fill="none" stroke="var(--c-edge)" stroke-width="1" vector-effect="non-scaling-stroke"></polyline><polyline points="${bot.slice().reverse().join(' ')}" fill="none" stroke="var(--c-edge)" stroke-width="1" vector-effect="non-scaling-stroke"></polyline>`);
  }
  for (const g of segs) svg.push(`<line x1="${f2(X(g.x0) * 10)}" x2="${f2(X(g.x1) * 10)}" y1="${f2(Y(g.y0) * 10)}" y2="${f2(Y(g.y1) * 10)}" stroke="${col(g.role || 'ctx')}" stroke-width="${g.width || 2}" ${g.dash ? `stroke-dasharray="${g.dash}"` : ''} stroke-linecap="round" vector-effect="non-scaling-stroke"${g.essential === false ? '' : ' data-mark="essential"'}></line>`);
  if (connect) for (let i = 0; i < fbars.length - 1; i++) { const a = fbars[i], b = fbars[i + 1]; svg.push(`<line x1="${f2(X(a.x) * 10)}" x2="${f2(X(b.x) * 10)}" y1="${f2(Y(a.y1) * 10)}" y2="${f2(Y(a.y1) * 10)}" stroke="var(--c-axis)" stroke-width="1" vector-effect="non-scaling-stroke"></line>`); }
  for (const s of series) {
    // split at nulls: no interpolation across gaps
    const segs = []; let cur = [];
    for (const [px, py] of s.points) { if (py == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([px, py]); }
    if (cur.length) segs.push(cur);
    for (const sg of segs) {
      let pts = sg.map(([px, py]) => [X(px) * 10, Y(py) * 10]);
      if (s.step) pts = pts.flatMap((p, i) => (i ? [[p[0], pts[i - 1][1]], p] : [p]));
      svg.push(`<polyline data-mark="essential" points="${pts.map((p) => `${f2(p[0])},${f2(p[1])}`).join(' ')}" fill="none" stroke="${col(s.role)}" stroke-width="${s.width || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>`);
    }
  }
  const html = [];
  for (const r of regions) html.push(`<span class="rg" style="left: ${f2(X(r.x0))}%; width: ${f2(X(r.x1) - X(r.x0))}%;"></span>${r.label ? `<span class="rgl" style="left: ${f2((X(r.x0) + X(r.x1)) / 2)}%;">${lab(r.label)}</span>` : ''}`);
  for (const g of gaps) html.push(`<span class="gap" style="left: ${f2(X(g.x0))}%; width: ${f2(X(g.x1) - X(g.x0))}%;"></span><span class="gapl" style="left: ${f2((X(g.x0) + X(g.x1)) / 2)}%;">${lab(g.label || 'No data')}</span>`);
  // bars: a single baseline at 0, ≤ barW px thick, 4px rounded data end, square at the baseline
  const zero = Y(Math.max(y.min, Math.min(y.max, 0)));
  const slot = bars.length ? 100 / Math.max(1, bars.length) : 0;
  for (const b of bars) {
    const top = Y(Math.max(b.v, 0)), bot = Y(Math.min(b.v, 0));
    const neg = b.v < 0;
    html.push(`<span class="bar${neg ? ' neg' : ''}${b.out ? ' out' : ''}" data-mark="essential" style="left: ${f2(X(b.x))}%; top: ${f2(top)}%; height: ${f2(Math.max(0.4, bot - top))}%; width: min(${barW}px, ${f2(slot * 0.62)}%); background: ${col(b.role)};"></span>`);
    if (b.label) html.push(`<span class="bv${neg ? ' neg' : ''}${b.minor ? ' minor' : ''}" style="left: ${f2(X(b.x))}%; top: ${f2(neg ? bot : top)}%;">${lab(b.label)}</span>`);
  }
  const xz = X(Math.max(x.min, Math.min(x.max, 0)));
  for (const b of hbars) {
    const l = X(Math.min(b.v, 0)), r = X(Math.max(b.v, 0)); const neg = b.v < 0;
    html.push(`<span class="bar hb${neg ? ' neg' : ''}" data-mark="essential" style="top: ${f2(Y(b.y))}%; left: ${f2(l)}%; width: ${f2(Math.max(0.3, r - l))}%; height: ${hbarH}px; background: ${col(b.role)};"></span>`);
    if (b.label) html.push(`<span class="pl ${neg ? 'pl-l' : 'pl-r'}" style="left: ${f2(neg ? l : r)}%; top: ${f2(Y(b.y))}%;">${lab(b.label)}</span>`);
  }
  void xz;
  for (const w of whiskers) html.push(`<span class="wk" data-mark="essential" style="left: ${f2(X(w.x))}%; top: ${f2(Y(w.hi))}%; height: ${f2(Y(w.lo) - Y(w.hi))}%;${w.role ? ` border-color: ${col(w.role)};` : ''}"></span>`);
  const fslot = fbars.length ? 100 / Math.max(1, new Set(fbars.map((b) => b.x)).size) : 0; // stacked segments share an x
  for (const b of fbars) {
    const top = Y(Math.max(b.y0, b.y1)), bot = Y(Math.min(b.y0, b.y1));
    html.push(`<span class="fb${b.outline ? ' o' : ''}" data-mark="essential" style="left: ${f2(X(b.x))}%; top: ${f2(top)}%; height: ${f2(Math.max(0.5, bot - top))}%; width: min(${barW + 8}px, ${f2(fslot * 0.6)}%); background: ${col(b.role)};"></span>`);
    if (b.label) { const below = b.labelPos === 'below'; html.push(`<span class="fbv${below ? ' b' : ''}${b.minor ? ' minor' : ''}" style="left: ${f2(X(b.x))}%; top: ${f2(below ? bot : top)}%;">${lab(b.label)}</span>`); }
  }
  for (const d of dots) html.push(`<span class="dt${d.open ? ' o' : ''}" data-mark="essential" style="left: ${f2(X(d.x))}%; top: ${f2(Y(d.y))}%; width: ${d.size || 8}px; height: ${d.size || 8}px; background: ${col(d.role)};${d.open && d.role ? ` border-color: ${col(d.role)};` : ''}"></span>`);
  // dots (≥ 8px, 2px surface ring)
  for (const s of series) if (s.dots) for (const [px, py] of s.points) if (py != null) html.push(`<span class="dot" data-mark="essential" style="left: ${f2(X(px))}%; top: ${f2(Y(py))}%; background: ${col(s.role)};"></span>`);
  // axes
  for (const t of y.ticks || []) html.push(`<span class="yl${t.minor ? ' minor' : ''}" style="top: ${f2(Y(t.v))}%;">${lab(t.label)}</span>`);
  for (const t of x.ticks || []) html.push(`<span class="xl${t.minor ? ' minor' : ''}${t.align === 0 ? ' a0' : t.align === 1 ? ' a1' : ''}" style="left: ${f2(X(t.v))}%;">${lab(t.label)}</span>`);
  for (const h of hlines) if (h.label) html.push(`<span class="zl" style="top: ${f2(Y(h.v))}%;">${lab(h.label)}</span>`);
  // events: lane chips; a chip within 9% of the previous one drops to the second lane
  // chips are clamped inside the plot (never past its edges); a chip within 9% of the previous chip on
  // lane 1 drops to lane 2; minor chips (e.g. a hold) leave first when the container is under 480px
  let lastX = -100;
  if (events.length && eventLane) html.push(`<span class="evlane">${lab(eventLane)}</span>`);
  for (const e of events.slice().sort((a, b) => a.x - b.x)) {
    const ex = X(e.x); const lane2 = e.lane === 2 || ex - lastX < 9; if (!lane2) lastX = ex;
    html.push(`<span class="ev${lane2 ? ' lane2' : ''}${e.minor ? ' minor' : ''}${e.keep ? ' keep' : ''}${ex < 12 ? ' e0' : ex > 88 ? ' e1' : ''}" style="left: ${f2(ex)}%;" title="${esc(plain(e.title || e.label))}">${lab(e.label)}</span>`);
  }
  for (const p of pointLabels) html.push(`<span class="pl${p.pos ? ' ' + p.pos : ''}${p.minor ? ' minor' : ''}" style="left: ${f2(X(p.x))}%; top: ${f2(Y(p.y))}%;${p.color ? ` color: ${p.color};` : ''}">${p.text}</span>`);
  // end labels with collision handling: sorted by y, ≥ 30px apart (two-line labels), leader when moved
  if (ends) {
    const plotH = height - pt - pb;
    const items = series.filter((s) => s.end).map((s) => { const last = [...s.points].reverse().find((p) => p[1] != null); return { s, yPct: Y(last[1]) }; }).sort((a, b) => a.yPct - b.yPct);
    const minGap = (30 / plotH) * 100;
    for (let i = 1; i < items.length; i++) { const prev = items[i - 1].moved ?? items[i - 1].yPct; if (items[i].yPct - prev < minGap) items[i].moved = prev + minGap; }
    for (const it of items) {
      const want = it.moved ?? it.yPct; const s = it.s;
      if (it.moved != null) html.push(`<span class="ldr" style="top: ${f2(Math.min(it.yPct, want))}%; height: ${f2(Math.abs(want - it.yPct))}%;"></span>`);
      html.push(`<span class="el${s.role && s.role !== 'emph' ? ' ctx' : ''}" style="top: ${f2(want)}%;">${lab(s.end)}${s.endValue ? `<span class="v">${s.endValue}</span>` : ''}</span>`);
    }
  }
  // the scrub state, drawn: crosshair, ringed points, focus ring on the emphasised one, readout card
  if (focus) {
    const fx = X(focus.x);
    html.push(`<span class="xh" style="left: ${f2(fx)}%;"></span>`);
    for (const s of series) { const p = s.points.find((q) => q[0] === focus.x); if (p && p[1] != null) html.push(`<span class="dot" style="left: ${f2(fx)}%; top: ${f2(Y(p[1]))}%; background: ${col(s.role)};"></span>`); }
    const fe = series[0] && series[0].points.find((q) => q[0] === focus.x);
    if (fe && fe[1] != null && focus.ring !== false) html.push(`<span class="fring" style="left: ${f2(fx)}%; top: ${f2(Y(fe[1]))}%;"></span>`);
    const side = fx > 58 ? `right: calc(${f2(100 - fx)}% + 12px);` : `left: calc(${f2(fx)}% + 12px);`;
    html.push(`<div class="ro" style="${side}" aria-hidden="true"><span class="rh">${focus.title}</span>${(focus.rows || []).map((r) => `<span class="rr"><i style="background: ${col(r.role)};"></i><b>${r.value}</b><span>${r.name}</span></span>`).join('')}</div>`);
  }
  const kb = keyboard ? ` tabindex="0" role="group" aria-roledescription="chart" aria-label="${esc(aria)}"` : ` role="img" aria-label="${esc(aria)}"`;
  return `<div class="cx"${id ? ` id="${id}"` : ''}${kb} style="height: ${height}px; --pl: ${pl}px; --pr: ${pr}px; --prn: ${prn}px; --pt: ${pt}px; --pb: ${pb}px;"><div class="pa"><svg class="ln" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${svg.join('')}</svg>${html.join('')}${extra}</div></div>`;
}

/** The data table twin of a chart: native <details>, a labelled focusable scroll box, header cells. A cell is a
 *  figure (a string or number, Mono), `{ t }` (HTML in the body Sans), or ChartFrame's text cell `{ text }`
 *  (TableTwinText, spec 07): a word or a not-a-number member ("—", "unavailable") in Sans, never a figure. */
const twinCell = (c) => (typeof c === 'object' && c && c.t ? `<td class="t">${c.t}</td>` : typeof c === 'object' && c && typeof c.text === 'string' && !c.href ? `<td class="t">${c.text}</td>` : `<td>${c}</td>`);
const twinRegion = ({ caption, cols, rows }) => {
  const head = `<thead><tr>${cols.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row" class="t" style="font-weight: 500; color: var(--phosphor);">${c}</th>` : twinCell(c))).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="cf-tw" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${caption}</caption>${head}${body}</table></div>`;
};
export function dataTable({ caption, cols, rows, summary = 'Show the numbers', open = false }) {
  return `<details class="cf-tab"${open ? ' open' : ''}><summary>${summary}</summary>${twinRegion({ caption, cols, rows })}</details>`;
}
/** Several twins under one disclosure, in order (ChartFrame's `table` as a list, spec 02 step 5a, 907cf98e). */
export function dataTables(tables, { summary = 'Show the numbers', open = false } = {}) {
  return `<details class="cf-tab"${open ? ' open' : ''}><summary>${summary}</summary><div style="display: flex; flex-direction: column; gap: 12px;">${tables.map(twinRegion).join('')}</div></details>`;
}

/** Legend for ≥ 2 series (dv: a legend is always present past one series; direct labels supplement). */
export function legend(items) {
  return `<div class="cf-legend" aria-hidden="true">${items.map((it) => `<span class="k" style="color: ${col(it.role)};">${it.band ? '<i class="band"></i>' : `<i${it.dash ? ` style="background: repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 7px);"` : ''}></i>`}<span style="color: var(--steel);">${it.name}</span></span>`).join('')}</div>`;
}

/**
 * The chart frame: claim title (a finding, not a metric name), subtitle (metric · unit · period), the
 * body, then source and as-of, then the table twin. kind = border = provenance: 'primary' solid,
 * 'third' dotted, 'sample' dashed + hatch stripe. state: a data-state key from data/states.mjs; the
 * frame keeps its final size in every state.
 */
export function chartFrame({ claim, sub = '', body = '', source = '', sourceKind = 'solid', sourceHref = '', asof = '', kind = 'primary', state = '', stateText = '', table = '', note = '', legendHtml = '', level = 'h3', extraTop = '', id = '', style = '' }) {
  const cls = `cf${kind === 'third' ? ' k-third' : kind === 'sample' ? ' k-sample' : ''}`;
  const tag = state ? stateTag(state, stateText) : '';
  return `<figure class="${cls}"${id ? ` id="${id}"` : ''} style="margin: 0;${style}"><figcaption class="cf-h"><div class="cf-top"><${level} class="cf-claim">${claim}</${level}>${tag}${extraTop}</div>${sub ? `<p class="cf-sub">${sub}</p>` : ''}</figcaption>${legendHtml}${body}${note ? `<p class="cf-note">${note}</p>` : ''}<div class="cf-foot">${source ? provChip(source, sourceKind, sourceHref) : ''}${asof ? `<span class="cf-asof">${asof}</span>` : ''}</div>${table}</figure>`;
}

/** The body for a non-ready state, at the chart's final height (no layout shift, CLS 0). */
export function stateBody(state, { height = 220, text = '', cause = '', next = '', action = '', ghost = true } = {}) {
  const ghostSvg = ghost ? `<div class="cghost" aria-hidden="true"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none"><line x1="0" x2="1000" y1="250" y2="250" stroke="var(--line)" vector-effect="non-scaling-stroke"></line><line x1="0" x2="1000" y1="500" y2="500" stroke="var(--line)" vector-effect="non-scaling-stroke"></line><line x1="0" x2="1000" y1="750" y2="750" stroke="var(--line)" vector-effect="non-scaling-stroke"></line><line x1="0" x2="1000" y1="999" y2="999" stroke="var(--line-2)" vector-effect="non-scaling-stroke"></line></svg></div>` : '';
  if (state === 'loading') return `<div class="cx" role="img" aria-label="Loading chart" aria-busy="true" style="height: ${height}px;"><div class="cskel" aria-hidden="true"></div></div>`;
  const warn = ['error', 'unavailable', 'stale'].includes(state);
  return `<div class="cx" style="height: ${height}px;">${ghostSvg}<div class="cstate${warn ? ' warn' : ''}" role="${warn ? 'alert' : 'status'}"><div class="msg"><p>${text}</p>${cause ? `<p class="q">${cause}</p>` : ''}${next ? `<p class="q">${next}</p>` : ''}${action}</div></div></div>`;
}

/** Range bar: where a value sits in a range, with the median, optional interval and the base diamond. */
// labels: [{ v, text, align?: 0|1, row?: 2 }] — row 2 sits under row 1 for labels that would collide
export function rangeBar({ lo = 0, hi = 100, now, median = null, band = null, base = null, labels = [], aria = '', height = 26 } = {}) {
  const P = (v) => (((v - lo) / (hi - lo)) * 100).toFixed(2);
  return `<div class="rbar" role="img" aria-label="${esc(aria)}"><div class="tr" style="height: ${height}px;"><span class="tk"></span>${band ? `<span class="rn" style="left: ${P(band[0])}%; width: ${(P(band[1]) - P(band[0])).toFixed(2)}%;"></span>` : ''}${median != null ? `<span class="md" style="left: ${P(median)}%;"></span>` : ''}${base != null ? `<span class="dm" style="left: ${P(base)}%;"></span>` : ''}${now != null ? `<span class="nw" data-mark="essential" style="left: ${P(now)}%;"></span>` : ''}</div>${labels.length ? `<div class="lb"${labels.some((l) => l.row === 2) ? ' style="height: 30px;"' : ''}>${labels.map((l) => `<span class="${l.align === 0 ? 'a0' : l.align === 1 ? 'a1' : ''}${l.row === 2 ? ' r2' : ''}" style="left: ${P(l.v)}%;">${l.text}</span>`).join('')}</div>` : ''}</div>`;
}

/** Sparkline with its scaling stated and its end value printed (DE12: sparklines state scaling). */
export function sparkline(values, { width = 96, height = 24, role = 'emph', value = '', scale = '', aria = '' } = {}) {
  const v = values.filter((n) => n != null); const mn = Math.min(...v), mx = Math.max(...v);
  const pts = values.map((n, i) => (n == null ? null : [(i / (values.length - 1)) * width, height - 2 - ((n - mn) / (mx - mn || 1)) * (height - 4)]));
  const segs = []; let cur = [];
  for (const p of pts) { if (!p) { if (cur.length) segs.push(cur); cur = []; } else cur.push(p); }
  if (cur.length) segs.push(cur);
  const last = pts[pts.length - 1];
  return `<span class="spk" role="img" aria-label="${esc(aria)}"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${segs.map((s) => `<polyline points="${s.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${col(role)}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" data-mark="essential"></polyline>`).join('')}${last ? `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${col(role)}" stroke="var(--panel)" stroke-width="2"></circle>` : ''}</svg>${value ? `<span class="v">${value}</span>` : ''}${scale ? `<span class="sc">${scale}</span>` : ''}</span>`;
}

/** Small multiples: one panel per facet, shared scales, one column on a phone. */
export function smallMultiples(items, { cols = 3 } = {}) {
  return `<div class="smx" style="--smc: ${cols};">${items.map((it) => `<div class="sm"><h4>${it.title}</h4>${it.value ? `<span class="smv">${it.value}</span>` : ''}${it.body}</div>`).join('')}</div>`;
}

/** Ticks helper: evenly spaced values with a formatter. */
export function ticks(min, max, step, f = (v) => String(v), { minorEvery = 0 } = {}) {
  const out = []; let i = 0;
  for (let v = min; v <= max + 1e-9; v += step, i++) out.push({ v: +v.toFixed(6), label: f(+v.toFixed(6)), minor: minorEvery ? i % minorEvery !== 0 : false });
  return out;
}

/** A small note in the board's own voice: "Before" / "After" ribbons for the before–after boards. */
export const ribbon = (text, kind = 'after') => `<span class="caps" style="display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 999px; ${kind === 'before' ? 'border: 1px solid var(--line-2); color: var(--steel);' : 'background: rgba(138,155,180,0.16); color: var(--phosphor);'}">${kind === 'before' ? icon('clock', 12) : icon('check', 12)}${text}</span>`;

/**
 * A labelled category bar list: names at the left (wrapping, never truncated), bars from a shared zero,
 * value labels at the bar end, optional open-ended bars ("45%+") and negatives left of zero. Ticks are
 * optional (when every value is printed the axis may go, dv:marks). rows: [{ name, v, label, role, open }]
 */
export function barList({ rows, min = 0, max, ticks: tk = [], labelW = 220, rowH = 34, aria = '', pr = 96, prn = 72, keyboard = true }) {
  const n = rows.length; const height = n * rowH + (tk.length ? 30 : 8);
  const body = plot({ height, pl: labelW, pr, prn, pt: 4, pb: tk.length ? 26 : 4, keyboard, ends: false, x: { min, max, ticks: tk }, y: { min: n + 0.5, max: 0.5, ticks: [] }, hbars: rows.map((r, i) => ({ y: i + 1, v: r.v, role: r.role || 'ctx', label: r.label })), hbarH: 14, aria });
  const names = rows.map((r, i) => `<span style="position: absolute; right: calc(100% + 12px); top: ${(((i + 0.5) / n) * 100).toFixed(2)}%; transform: translateY(-50%); width: ${labelW - 16}px; text-align: right; font-size: 12.5px; line-height: 1.25; color: ${r.role === 'emph' ? 'var(--phosphor)' : 'var(--steel)'}; font-weight: ${r.role === 'emph' ? 600 : 400};">${r.name}</span>${r.open ? `<span aria-hidden="true" style="position: absolute; left: calc(${(((r.v - min) / (max - min)) * 100).toFixed(2)}% - 1px); top: ${(((i + 0.5) / n) * 100).toFixed(2)}%; transform: translateY(-50%); width: 0; height: 0; border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-left: 10px solid ${r.role === 'emph' ? 'var(--c-emph)' : 'var(--c-ctx)'};"></span>` : ''}`).join('');
  const zero = min < 0 ? `<span style="position: absolute; top: -4px; bottom: -4px; left: ${(((0 - min) / (max - min)) * 100).toFixed(2)}%; border-left: 1px solid var(--c-axis);"></span>` : '';
  return body.replace('<div class="pa">', `<div class="pa">${zero}${names}`);
}

/** Before/after row for the family boards: the shipped form (a shape sketch + defects with file:line),
 *  then the upgrade. Sketches carry no text, so nothing on a board renders under the 11px floor. */
export function baRow({ title, ids, before, defects = [], after, file = '' }) {
  return `<section class="famrow"><header><h3>${title}</h3><span class="ids">${ids}</span></header><div class="ba"><div class="b"><span class="caps">Before · as shipped${file ? ` · <span class="mono" style="text-transform: none; letter-spacing: 0;">${file}</span>` : ''}</span>${before ? `<div aria-hidden="true" style="border-radius: 8px; background: var(--panel); border: 1px solid var(--line); padding: 10px 12px;">${before}</div>` : ''}<ul>${defects.map((d) => `<li>${d}</li>`).join('')}</ul></div><div class="a"><span class="caps">After</span>${after}</div></div></section>`;
}

