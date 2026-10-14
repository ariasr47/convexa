// v5 · Charts — the audit board (wave 1) and the chart system boards (wave 2): principles and validated
// colour roles, every primitive, the seven data states, phone re-layout, and the deliberate line between
// a Convexa chart and a third party's frame.
import { icon, tokens } from '../../lib.mjs';
import { CHART_CSS, chartFrame, dataTable, fmt, legend, plot, rangeBar, smallMultiples, ticks } from '../../chart-kit.mjs';
import { chartEntries, curveFrame, inState, DATA_STATE_KEYS, SHARED, spreadPlot, spreadTable, SP_CLAIM, SP_SUB, SP_SRC, thirdPartyFrame, TPF_CSS } from '../../components/charts.mjs';
import { AUDIT_COUNTS, AUDIT_TOTAL, RECURRING, TOP_TEN } from '../../data/chart-audit.mjs';
import { CFTC, CFTC_CATS, NOTE, rangeStats } from '../../data/charts.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';

export const V5_CSS = `${CHART_CSS}${TPF_CSS}
  .v5s { padding: 48px 64px 64px; display: flex; flex-direction: column; gap: 36px; box-sizing: border-box; }
  .v5s h1 { margin: 0; font-size: 40px; letter-spacing: -0.02em; text-wrap: balance; }
  .v5s .lead { margin: 8px 0 0; max-width: 92ch; font-size: 15px; color: var(--steel); line-height: 1.6; text-wrap: pretty; }
  .v5s .trace { margin: 10px 0 0; font: 400 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .v5sec { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .v5sec > h2 { margin: 0; font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 24px; letter-spacing: -0.01em; }
  .v5sec > p.sl { margin: -8px 0 0; max-width: 92ch; font-size: 13.5px; color: var(--steel); line-height: 1.55; }
  .v5g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
  .v5g3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
  .v5card { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); min-width: 0; }
  .v5card h3 { margin: 0; font-size: 15px; font-weight: 600; }
  .v5card p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--steel); text-wrap: pretty; }
  .v5card .k { font: 500 11px/1.4 'IBM Plex Mono', monospace; color: var(--steel); }
  .v5tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .v5tbl th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 8px 10px; border-bottom: 1px solid var(--line-2); vertical-align: bottom; }
  .v5tbl td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; line-height: 1.45; color: var(--steel); }
  .v5tbl td.p { color: var(--phosphor); font-weight: 600; }
  .v5tbl td.m { font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
  .v5tw { max-width: 100%; overflow-x: auto; }
  .sw2 { display: inline-flex; align-items: center; gap: 8px; }
  .sw2 i { display: inline-block; width: 28px; height: 16px; border-radius: 4px; border: 1px solid var(--line-2); }
  .pitem { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .pitem .ph { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
  .pitem .ph b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 17px; }
  .pitem .ph .chip { font-size: 11px; }
  .pitem .pc { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--steel); text-wrap: pretty; }
  .pitem .stage { padding: 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--ink); display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .ba { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: 20px; align-items: start; }
  .ba > .b { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--ink-2); min-width: 0; }
  .ba > .a { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .ba .b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; line-height: 1.5; color: var(--steel); }
  .ba .b ul li::marker { color: var(--steel-2); }
  .ba .b code, .v5card code, .pc code { font: 400 11.5px 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .famrow { display: flex; flex-direction: column; gap: 12px; padding-top: 24px; border-top: 1px solid var(--line); }
  .famrow > header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
  .famrow > header h3 { margin: 0; font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 19px; }
  .famrow > header .ids { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .vs { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
  .vs .note { display: flex; flex-direction: column; gap: 6px; }
  .diffs { display: grid; grid-template-columns: 180px minmax(0, 1fr) minmax(0, 1fr); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .diffs > div { padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 12.5px; line-height: 1.45; color: var(--steel); }
  .diffs > div.h { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; background: var(--ink-2); }
  .diffs > div.r { color: var(--phosphor); font-weight: 600; }
  @media (max-width: 1099px) { .v5g3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 899px) { .v5s { padding: 28px 16px 40px; gap: 28px; } .v5s h1 { font-size: 28px; } .v5g2, .v5g3, .ba, .vs { grid-template-columns: minmax(0, 1fr); } .diffs { grid-template-columns: minmax(0, 1fr); } .diffs > div.h { display: none; } .diffs > div.r { border-bottom: none; padding-bottom: 2px; } }
`;

export const v5Wrap = (inner, { scheme = 'dark', minHeight = 0 } = {}) => `<div class="v4 v5" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="v5s">${inner}</div></div>`;
export const v5Head = (title, lead, trace = '') => `<header><div class="caps" style="color: var(--steel);">Convexa design · v5 charts · 2026-10-13 · illustrative values</div><h1 class="display" style="margin-top: 6px;">${title}</h1><p class="lead">${lead}</p>${trace ? `<p class="trace">Resolves ${trace}</p>` : ''}</header>`;
export const sec = (title, lead, body, id = '') => `<section class="v5sec"${id ? ` id="${id}"` : ''}><h2>${title}</h2>${lead ? `<p class="sl">${lead}</p>` : ''}${body}</section>`;

// ---- wave 1 · the audit --------------------------------------------------------------------------
export function auditBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const counts = `<div class="v5tw"><table class="v5tbl"><thead><tr><th>Family</th><th>IDs</th><th style="text-align: right;">Charts</th><th style="text-align: right;">S1</th><th>Where</th></tr></thead><tbody>${AUDIT_COUNTS.map((r) => `<tr><td class="p">${r.fam}</td><td class="m">${r.ids}</td><td class="m" style="text-align: right; color: var(--phosphor);">${r.n}</td><td class="m" style="text-align: right;">${r.s1 || '—'}</td><td class="m" style="font-size: 11.5px;">${r.where}</td></tr>`).join('')}<tr><td class="p">All</td><td></td><td class="m" style="text-align: right; color: var(--phosphor); font-weight: 600;">${AUDIT_TOTAL}</td><td class="m" style="text-align: right;">${AUDIT_COUNTS.reduce((s, r) => s + r.s1, 0)}</td><td>plus one root cause, SYS-01</td></tr></tbody></table></div>`;
  const maxScore = 9;
  const top = `<div class="cf" style="gap: 14px;"><div class="cf-h"><h3 class="cf-claim">Three of the top ten score 9: each draws a value as something it isn’t</h3><p class="cf-sub">Upgrade score = severity × reach ÷ effort (§8 of the review standard) · higher first</p></div>${plot({ height: TOP_TEN.length * 38 + 30, pl: 300, pr: 48, prn: 40, pt: 6, pb: 24, keyboard: true, ends: false, x: { min: 0, max: maxScore, ticks: [0, 3, 6, 9].map((v) => ({ v, label: String(v) })) }, y: { min: TOP_TEN.length + 0.5, max: 0.5, ticks: [] }, hbars: TOP_TEN.map((t) => ({ y: t.n, v: t.score, role: t.score >= 9 ? 'emph' : 'ctx', label: fmt.num(t.score, t.score % 1 ? 1 : 0) })), aria: `Top ten upgrades by score: ${TOP_TEN.map((t) => `${t.title} ${t.score}`).join('; ')}` }).replace('<div class="pa">', `<div class="pa">${TOP_TEN.map((t) => `<span style="position: absolute; right: calc(100% + 12px); top: ${(((t.n - 0.5) / TOP_TEN.length) * 100).toFixed(2)}%; transform: translateY(-50%); width: 280px; text-align: right; font-size: 12.5px; line-height: 1.25; color: var(--phosphor);"><span class="mono" style="color: var(--steel); font-size: 11px;">${t.ids}</span> ${t.title}</span>`).join('')}`)}${dataTable({ caption: 'Top ten upgrades with their evidence', cols: ['#', 'Upgrade', 'IDs', 'Score', 'Why'], rows: TOP_TEN.map((t) => [String(t.n), { t: t.title }, { t: t.ids }, fmt.num(t.score, 1), { t: t.why }]) })}<div class="cf-foot">${provChip('Audit · design/CHARTS-2026-10-13.md', 'solid')}<span class="cf-asof">Read from code · 2026-10-13</span></div></div>`;
  const rec = `<div class="v5g3">${RECURRING.map(([t, d]) => `<div class="v5card"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>`;
  return v5Wrap(`${v5Head('Every chart, audited', `Fifty-two charts in the app, twenty-one marks on the boards and nine planned tools, each with the question it answers, its form, what is wrong with it under the review standard and the dataviz method, and its upgrade. The long form, with file:line for every finding, is <span class="mono">design/CHARTS-2026-10-13.md</span>. Four charts draw something false; the rest share one root cause: there is no chart system, so every chart re-solves frame, axes, labels, states and access, and the same defects recur.`, 'the v5 brief, wave 1')}
    ${sec('Ranked', '', top)}
    ${sec('Counted', 'S1 = breaks trust or use (§8): a value drawn as something it isn’t, a false claim, a scroll trap, a canvas-only value.', counts)}
    ${sec('What recurs', 'Each of these is a symptom of SYS-01; the chart system on the next board removes all six at once.', rec)}`, { scheme, minHeight });
}

// ---- wave 2 · the chart system -----------------------------------------------------------------
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgb = (s) => { const h = /^#([0-9a-f]{6})$/i.exec(s); if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)); const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(',').map(Number); return p.slice(0, 3).concat(p[3] ?? 1); };
const over = (fg, bg) => (fg.length > 3 && fg[3] < 1 ? [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])) : fg.slice(0, 3));
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const PROP = tokens.additions.proposed;
const ROLES = [
  ['Emphasis', 'the series the claim is about', 'phosphor', 'phosphor', 'emphasis form (dv:form); not part of the ramp: hue spread 167° vs steel'],
  ['Context', 'every other series', 'steel', 'steel', 'ordinal ramp step 1 · validator PASS'],
  ['Context 2 (proposed)', 'the older comparison', PROP.chartContext2.dark, PROP.chartContext2.light, 'ordinal step 2 · validator PASS both schemes · ≥ 3:1 on panel, well, ink'],
  ['Band (proposed)', 'an interval or a range', PROP.chartBand.dark, PROP.chartBand.light, 'a wash, never the only carrier: edges are steel2, bounds labelled'],
  ['Edge', 'band edges, reference lines', 'steel2', 'steel2', '≥ 4.5:1 (canon ruling 7)'],
  ['Grid', 'gridlines', 'line', 'line', 'recessive by design; never carries a value'],
  ['Zero / axis', 'the baseline that means something', 'line2', 'line2', 'one step stronger than the grid, and named'],
  ['Gamma + / P&L +', 'money moving only', 'up', 'up', 'canon-pinned; fails CVD vs down (ΔE 4.7 dark / 4.3 light): position and +/− carry the sign'],
  ['Gamma − / P&L −', 'money moving only', 'down', 'down', 'canon-pinned; never alone'],
  ['Focus', 'the focus ring on a chart and its point', 'amberText', 'amberText', 'rule 6: the authored ring'],
  ['Base', 'the base-case diamond', 'amber', 'amber', 'rule 16: one of amber’s three spends'],
];
function swatchCell(mode, v) {
  const col = tokens.color[mode][v] ?? v;
  const panel = rgb(tokens.color[mode].panel);
  const c = rgb(col); const ratio = c ? cr(over(c, panel), panel) : null;
  return `<span class="sw2"><i style="background: ${col};"></i><span class="mono" style="font-size: 11px; color: var(--phosphor);">${col}</span></span><br><span class="mono" style="font-size: 11px;">${ratio ? `${ratio.toFixed(2)}:1 on panel` : ''}</span>`;
}

const PRINCIPLES = [
  ['A claim, not a label — when there is data', 'The title states what the chart shows (“The 2s10s stayed positive all year”); the subtitle carries metric, unit and period. Without data (loading, empty, error, not live) the title names the metric: a claim computed from nothing is false. A third party’s frame gets a name too: Convexa makes no claim about data it doesn’t read.'],
  ['Neutral first', 'One phosphor series carries the claim; context steps down through steel and chartContext2. No categorical palette on the trader path: past three series, facet into small multiples.'],
  ['Green and red only when money moves', 'P&L, flow and gamma sign — and then never alone: the pair measures ΔE 4.3–4.7 under deuteranopia, so position above or below zero and a signed label carry the sign.'],
  ['Amber is spent', 'On a chart amber appears twice at most: the focus ring and the base-case diamond. Never a series, never a heat ramp.'],
  ['The register holds', 'Mono for a figure Convexa traced (its computation or a primary source); Sans with a dotted rule for an untraced one. Tick labels, readouts and tables follow the figure they show.'],
  ['The border is the provenance', 'Solid: ours or a primary source. Dotted: a third party. Dashed with a hatch stripe: sample. The chart frame speaks the provenance chip’s grammar at the size of the whole figure.'],
];

const MODULES = [
  ['ChartFrame.tsx', 'figure, claim, subtitle, legend, body, foot (chip + as-of), table twin; the seven data states at final size', 'ChartTitle + FIGURE_SX + per-page captions (publicUi.tsx, Charts.tsx, MarketsPage.tsx)', 'none (visual)'],
  ['Plot.tsx + scales.ts', 'measured width (ResizeObserver), SVG strokes with non-scaling width, HTML text layer, bars, bands, gaps, zero line', 'hand-rolled divs and per-chart SVG in Charts.tsx, MarketsPage.tsx, ScorecardPage.tsx', 'scales.ts: tick values; gap splitting (no interpolation across null)'],
  ['format.ts', 'Intl.NumberFormat en-US: num, pct, signed (true minus), bp, compact, usd', 'fmtK, ad-hoc toFixed and `$${v}`', 'format.ts: signed and compact strings under a pinned locale (a wrong sign is silent and costs trust)'],
  ['DirectLabels.tsx + labelLayout.ts', 'end labels, selective point labels, collision → leader → legend fallback', 'thinning in ChartBlock; colliding curve date labels', 'labelLayout.ts: no two labels within 30px'],
  ['EventLane.tsx + events.ts', 'FOMC, CPI, filings and results as labelled chips on hairlines; two lanes; priority drop under 480px', 'nothing (no chart marks events today)', 'none'],
  ['RangeBand.tsx · RangeBar.tsx', 'interval wash with edges; track, band, median, now, base diamond, zero', 'PriceValueStrip band, FootballField rows, CFTC RangeRow', 'none'],
  ['SmallMultiples.tsx', 'facets on shared scales; 3 → 2 → 1 columns by container', 'nothing', 'none'],
  ['Sparkline.tsx', 'line or bars, scaling stated, end value, zero line when it crosses', 'historyMath.sparkPoints, PlSparkline, MiniChart, TapePulseStrip', 'none'],
  ['Crosshair.tsx + useScrub.ts', 'snap to nearest x, ring every series, one readout; hover state in a ref (CH7)', 'canvas probe in StructureFieldCanvas', 'none'],
  ['useChartKeyboard.ts', 'one tab stop; arrows, Shift+arrows, Home/End, PgUp/PgDn, Enter pins, Esc clears; polite live region', 'nothing', 'none'],
  ['ChartTable.tsx', '&lt;details&gt; twin: caption, th scope, words for gaps', 'aria-label lists', 'none'],
  ['ChartState.tsx', 'loading at final size, empty that teaches, error with cause, stale, not live, sample, demo', 'silent nulls; page-level skeletons', 'none'],
  ['chartTokens.ts', 'resolves chart roles for canvas charts via extrasFor (CH4: a canvas fillStyle ignores var())', 'SF / LAB literals, paintStep colour parsing per frame', 'none'],
  ['../embeds/ThirdPartyFrame.tsx', 'a third party’s frame: name, dotted chip, inset fence, attribution, privacy line, timeout → blocked', 'TradingViewEmbed host box', 'none'],
];

export function chartSystemBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const princ = `<div class="v5g3">${PRINCIPLES.map(([t, d]) => `<div class="v5card"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>`;
  const roles = `<div class="v5tw"><table class="v5tbl"><thead><tr><th>Role</th><th>Job</th><th>Dark</th><th>Light</th><th>Check</th></tr></thead><tbody>${ROLES.map(([r, job, d, l, chk]) => `<tr><td class="p">${r}</td><td>${job}</td><td>${swatchCell('dark', d)}</td><td>${swatchCell('light', l)}</td><td>${chk}</td></tr>`).join('')}</tbody></table></div><p class="cf-note">Dataviz validator (six checks, OKLab ΔE, Machado 2009 CVD at severity 1.0), run 2026-10-13: <span class="mono">--ordinal</span> [steel, chartContext2] PASS dark and light; [phosphor, steel, chartContext2] FAIL single hue (dark), so phosphor is an emphasis role; [up, down] FAIL CVD separation (deutan ΔE 4.7 / 4.3). Log: main tree <span class="mono">tmp/canvas-v5/tools/validator-wave2.log</span>. The proposed roles live in <span class="mono">tokens.json → additions.proposed</span>; <span class="mono">verify-tokens.mjs</span> checks their contrast floors.</p>`;
  const marks = `<div class="v5g3">${[
    ['Bars', '≤ 24px thick, 4px rounded data end, square at the zero baseline; one baseline only; a 2px surface gap between touching bars.'],
    ['Lines', '2px (2.5 for the claim’s series), round joins; gaps break the line and are hatched and named, never bridged.'],
    ['Points', '≥ 8px with a 2px surface ring; hit targets ≥ 24px; labels on the latest, the extremes and the one that matters.'],
    ['Bands', 'chartBand wash with steel2 edges; every band says what it is (“trailing-year 10th–90th percentile”, “95% interval, Wilson”).'],
    ['Grid and zero', 'Solid hairlines in line, ≤ 5 y ticks on clean steps, the unit once on the top tick; zero in line2 and named when it means something.'],
    ['Text', 'HTML at true size, 11px floor, mono ticks; under 480px of container short labels, fewer ticks and a narrower gutter: re-laid out, never scaled.'],
  ].map(([t, d]) => `<div class="v5card"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>`;
  const gallery = `<div class="v5g2">${chartEntries.map((e) => { const s0 = e.states[0]; return `<div class="pitem"><div class="ph"><b>${e.spec.name}</b><span class="chip outline mono">${e.spec.react}</span></div><p class="pc">${e.spec.change}</p><div class="stage">${e.render(s0.props)}</div><p class="pc"><code>${e.spec.path.replace(SHARED + '/', 'shared/charts/')}</code> · ${e.states.length} states on the states board and in the site library</p></div>`; }).join('')}</div>`;
  const mods = `<div class="v5tw"><table class="v5tbl"><thead><tr><th>Module (apps/dashboard/src/app/shared/charts/)</th><th>Does</th><th>Replaces</th><th>Test (CH8: data layer only)</th></tr></thead><tbody>${MODULES.map(([m, d, r, t]) => `<tr><td class="p mono" style="font-weight: 500;">${m}</td><td>${d}</td><td>${r}</td><td>${t}</td></tr>`).join('')}</tbody></table></div><p class="cf-note">Two spec files are owed, both on the data layer (repo rule: test only what can fail silently and cost something): <span class="mono">format.spec.ts</span> (signed, compact and percent strings under a pinned en-US locale) and <span class="mono">scales.spec.ts</span> (tick values; a null splits the line rather than joining it). No pixel snapshots. Library: none added; Recharts stays only in the operator chart (CH1).</p>`;
  return v5Wrap(`${v5Head('One chart system', 'Every Convexa chart is built from the same parts: a frame that makes a claim and says where the numbers come from, a plot whose text is drawn at true size, labels that sit on the data, a table twin, one tab stop, and the seven data states at final size. Below: the rules from the canon, the colour roles with their measured contrast and validator verdicts, the mark specs, each primitive in its ready state, and the React module each becomes.', 'SYS-01 and the 23 symptoms marked ⟵SYS in design/CHARTS-2026-10-13.md')}
    ${sec('Six rules, from the canon', '', princ)}
    ${sec('Colour roles, measured', 'Contrast is WCAG 2 against the panel each chart sits on (composited for translucent roles). Values come from tokens.json; the two proposed roles are additions, not in tokens.ts yet.', roles)}
    ${sec('Mark specs', '', marks)}
    ${sec('The primitives', 'Each shown in its ready state; every state of every primitive is on the next board and in the site library.', gallery)}
    ${sec('Where each lands in the app', '', mods)}`, { scheme, minHeight });
}

export function chartStatesBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const LABEL = { loading: 'Loading · final size', empty: 'Empty · teaches', error: 'Error · cause + retry', stale: 'Stale · last good copy', notLive: 'Not live', sample: 'Sample', demo: 'Demo' };
  const WHEN = {
    loading: 'Before the first byte. The skeleton is the chart’s final height, so nothing moves when it lands (CLS 0). The title is a skeleton too: the claim is computed from data.',
    empty: 'The source answered and has nothing yet. Say what would appear and when, never “No data”.',
    error: 'Our request failed. Name the cause and the time, offer Try again; draw nothing rather than a guess.',
    stale: 'This cycle failed; the last good copy shows with its marks in textDim and the warning tag says when it was fetched. Never 50% opacity (canon 2026-09-09).',
    notLive: 'The data needs a paid feed this site doesn’t run. No value slot, no ghost marks; one link to a labelled sample.',
    sample: 'Inside the live site: dashed frame, hatch stripe, Sample tag, scenario date, a dashed chip that says “shaped like”. Marks draw normally.',
    demo: 'The whole site is the demo: the same treatment, every chip dashed, “Demo · sample data” in place of the connection chip.',
  };
  const ready = `<div class="pitem"><div class="ph"><b>Ready</b>${stateTag('current', 'Updated Oct 9')}</div><p class="pc">The claim, the subtitle, the plot with its event lane and its gap, source and as-of, the table twin.</p>${chartFrame({ claim: SP_CLAIM, sub: SP_SUB, body: spreadPlot(), source: SP_SRC, asof: 'As of Oct 9, 2026 · 6:00 PM ET', table: spreadTable() })}</div>`;
  const states = DATA_STATE_KEYS.map((k) => `<div class="pitem"><div class="ph"><b>${LABEL[k]}</b></div><p class="pc">${WHEN[k]}</p>${inState(k, { claim: SP_CLAIM, sub: SP_SUB, source: SP_SRC, ready: (o) => ({ body: spreadPlot({ dim: o.dim }), table: spreadTable() }) })}</div>`).join('');
  const inter = `<div class="v5g2"><div class="pitem"><div class="ph"><b>Scrubbed</b></div><p class="pc">Pointer, touch-drag or keyboard: one hairline, every series ringed, one readout (value first).</p>${chartEntries.find((e) => e.spec.id === 'crosshair').render('scrub')}</div><div class="pitem"><div class="ph"><b>Keyboard focus</b></div><p class="pc">One tab stop; the authored amber ring on the chart and on the focused point.</p>${chartEntries.find((e) => e.spec.id === 'chart-keyboard').render('kbd')}</div></div>`;
  const matrix = `<div class="v5tw"><table class="v5tbl"><thead><tr><th>Primitive</th>${['Ready', ...DATA_STATE_KEYS.map((k) => LABEL[k].split(' · ')[0])].map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${chartEntries.map((e) => `<tr><td class="p">${e.spec.name}</td>${['ready', ...DATA_STATE_KEYS].map((k) => `<td class="m">${e.spec.id === 'third-party-frame' ? (k === 'ready' ? 'live' : k === 'loading' ? 'own' : k === 'error' ? 'blocked' : '—') : k === 'ready' ? e.states.length - DATA_STATE_KEYS.length + ' variants' : 'frame'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="cf-note">“frame” = the state is drawn by ChartFrame around the primitive, with the same words for every chart (the data-state vocabulary, proposal P-2: no new word). A third party’s frame has its own two states only (loading, blocked): Convexa never puts its state words inside someone else’s frame.</p>`;
  return v5Wrap(`${v5Head('Every chart, in every state', 'The frame owns the states, so no chart can forget one: a loading skeleton at final size, an empty state that teaches, an error with its cause, the last good copy, not live, sample and demo. Shown here on the 2s10s; every primitive renders through the same frame.', 'CH2 (states and catalog), DE6, X-01, X-02, X-10, the silent nulls RM-03, RM-04, TD-02, RP-03')}
    ${sec('Ready and the seven data states', '', `<div class="v5g2">${ready}${states}</div>`)}
    ${sec('Interaction states', '', inter)}
    ${sec('Primitive × state', '', matrix)}`, { scheme, minHeight });
}

export function chartPhoneBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const st = rangeStats(CFTC.series.asset);
  const multiples = chartFrame({ claim: 'Asset managers and leveraged funds hold opposite sides', sub: 'Net positions, 10-year T-note · thousands of contracts · weekly, 3 years · same scale', body: smallMultiples(CFTC_CATS.map((c) => { const s = CFTC.series[c.key]; const r = rangeStats(s); return { title: c.name, value: `${fmt.num(r.last / 1e3, 0)}K net · ${r.pct}% of range`, body: plot({ height: 84, pt: 6, pb: 18, pl: 40, pr: 10, prn: 10, ends: false, keyboard: false, x: { min: 0, max: s.length - 1, ticks: [{ v: 0, label: '’23', align: 0 }, { v: s.length - 1, label: '’26', align: 1 }] }, y: { min: -1400, max: 1400, ticks: [{ v: -1000, label: '−1,000' }, { v: 0, label: '0' }, { v: 1000, label: '+1,000' }] }, hlines: [{ v: 0, kind: 'zero' }], series: [{ points: s.map((v, i) => [i, v / 1e3]), role: 'emph', width: 1.5 }], aria: `${c.name}, 3 years` }) }; }), { cols: 1 }), source: 'CFTC · TFF', asof: 'Tue Oct 6 · out Fri Oct 9' });
  void st;
  const bridge = bridgeRows();
  return v5Wrap(`${v5Head('Charts on a phone', 'At 390px every chart re-lays itself out from its own container: short labels, fewer ticks and events, legends above, facets in one column, columns with long names turned into rows. Nothing is scaled down, so no text falls under 11px.', 'DE9, the 9–10px labels (RN-01, RN-08, RS-03, TD-01), the scaled v2 instruments (DB-01)')}
    ${chartFrame({ claim: 'The 2s10s stayed positive all year', sub: '10Y − 2Y · pp · daily, past year · FOMC marked', body: spreadPlot({ height: 200 }), source: 'U.S. Treasury', asof: 'Oct 9, 2026', table: spreadTable() })}
    ${chartFrame({ claim: 'The front end fell; the 30-year held', sub: 'Par yields by maturity · % · √ spacing', legendHtml: legend([{ name: 'Oct 9', role: 'emph' }, { name: 'Sep 10', role: 'ctx' }, { name: 'Oct ’25', role: 'ctx2' }]), body: curveFrame({ height: 220 }), source: 'U.S. Treasury', asof: 'Oct 9, 2026' })}
    ${multiples}
    ${bridge}`, { scheme, minHeight });
}

/** The bridge on a phone: one row per step, label left, bar right, a real zero line; it crosses zero. */
export function bridgeRows({ steps = [['Operating income', 1820, 'total'], ['Restructuring', -2940, 'step'], ['Impairment', -9600, 'step'], ['Tax benefit', 1210, 'step'], ['Other', -523, 'step'], ['Net loss', -10033, 'total']], claim = 'Charges turned $1.8B of operating income into a $10.0B net loss', sub = 'GAAP bridge · $ millions · fiscal 2025 · illustrative, shaped like the INTC note’s bridge', source = 'Company 10-K · filed Jan 30', asof = 'Note of Oct 13, 2026' } = {}) {
  let run = 0; const rows = steps.map(([label, v, kind]) => { const from = kind === 'total' ? 0 : run; const to = kind === 'total' ? v : run + v; run = to; return { label, v, kind, from, to }; });
  const lo0 = Math.min(0, ...rows.map((r) => Math.min(r.from, r.to))), hi0 = Math.max(0, ...rows.map((r) => Math.max(r.from, r.to)));
  // headroom for the value labels that sit beyond each bar's end (left of negatives, right of positives)
  const span = hi0 - lo0; const lo = lo0 < 0 ? lo0 - span * 0.28 : lo0, hi = hi0 + span * 0.28;
  const P = (v) => (((v - lo) / (hi - lo)) * 100).toFixed(2);
  const body = `<div role="img" aria-label="${steps.map(([l, v]) => `${l} ${v > 0 ? 'plus' : 'minus'} ${Math.abs(v)}`).join(', ')}" style="display: flex; flex-direction: column; gap: 6px;">${rows.map((r) => { const a = Math.min(r.from, r.to), b = Math.max(r.from, r.to); const isT = r.kind === 'total'; const fill = isT ? (r === rows[rows.length - 1] ? 'var(--c-emph)' : 'var(--c-ctx)') : r.v >= 0 ? 'var(--c-ctx)' : 'transparent'; return `<div style="display: grid; grid-template-columns: minmax(0, 118px) minmax(0, 1fr); gap: 10px; align-items: center;"><span style="font-size: 12px; line-height: 1.25; color: ${isT ? 'var(--phosphor)' : 'var(--steel)'}; font-weight: ${isT ? 600 : 400};">${r.label}</span><span style="position: relative; height: 22px;"><span style="position: absolute; top: -3px; bottom: -3px; left: ${P(0)}%; border-left: 1px solid var(--c-axis);"></span><span data-mark="essential" style="position: absolute; top: 5px; height: 12px; left: ${P(a)}%; width: ${Math.max(0.6, P(b) - P(a)).toFixed(2)}%; border-radius: 3px; background: ${fill}; border: ${!isT && r.v < 0 ? '1.5px solid var(--c-ctx)' : 'none'}; box-sizing: border-box;"></span><span style="position: absolute; top: 3px; ${r.v >= 0 || isT && r.v >= 0 ? `left: calc(${P(b)}% + 6px);` : `right: calc(${(100 - P(a)).toFixed(2)}% + 6px);`} font: 500 11px/16px 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap;">${isT ? fmt.signed(r.v, 0).replace('+', '') : fmt.signed(r.v, 0)}</span></span></div>`; }).join('')}<div style="display: grid; grid-template-columns: minmax(0, 118px) minmax(0, 1fr); gap: 10px;"><span></span><span style="position: relative; height: 14px; font: 400 11px 'IBM Plex Mono', monospace; color: var(--steel);"><span style="position: absolute; left: ${P(0)}%; transform: translateX(-50%);">0</span></span></div></div>`;
  return chartFrame({ claim, sub, body, source, asof, note: 'Up steps filled, down steps outlined; the sign is in the label, never the hue (canon 2026-10-13, company facts are neutral). Running totals below zero sit left of the zero line.' });
}

export function thirdPartyBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const ours = chartFrame({ claim: SP_CLAIM, sub: SP_SUB, body: spreadPlot({ height: 300 }), source: SP_SRC, sourceHref: 'https://home.treasury.gov/', asof: 'As of Oct 9, 2026 · 6:00 PM ET', table: spreadTable() });
  const theirs = thirdPartyFrame({ height: 420, mini: false });
  const D = [
    ['Title', 'A claim Convexa computed and stands behind', 'A name (“NVDA daily chart”): Convexa makes no claim about a frame it doesn’t read'],
    ['Border', 'Solid hairline panel', 'Dotted fence with an 8px well inset, so the party’s palette never touches Convexa’s chrome'],
    ['Provenance', 'Solid chip at the foot, with the as-of', 'Dotted chip at the head, before the frame loads'],
    ['Colour', 'Convexa’s roles: phosphor, steel, chartContext2; green/red only for money', 'The party’s own palette, green/red candles included (Amendments “Third-party embeds”)'],
    ['Numbers', 'Mono (traced); a table twin; a readout', 'None of ours: no readout, no table, nothing computed from it'],
    ['Interaction', 'One tab stop; arrows scrub; Enter pins', 'The party’s own; Convexa adds nothing inside'],
    ['States', 'The seven data states, in Convexa’s words', 'Two only: loading (at final size, in words) and blocked (after 12 s or a script error)'],
    ['Privacy', '—', 'One line: the party receives your IP address and this page’s address'],
  ];
  const diffs = `<div class="diffs"><div class="h">&nbsp;</div><div class="h">Convexa’s chart</div><div class="h">A third party’s frame</div>${D.map(([a, b, c]) => `<div class="r">${a}</div><div>${b}</div><div>${c}</div>`).join('')}</div>`;
  const states = `<div class="v5g2"><div class="pitem"><div class="ph"><b>Loading</b></div><p class="pc">Final height, the fence drawn, “Loading TradingView’s chart…” in words (the shipped box is empty).</p>${thirdPartyFrame({ state: 'loading', height: 240 })}</div><div class="pitem"><div class="ph"><b>Blocked</b></div><p class="pc">After a script error <em>or</em> 12 s without the frame (the shipped embed has no timeout, so a stall stays blank). Resets when the symbol changes.</p>${thirdPartyFrame({ state: 'blocked' })}</div></div>`;
  return v5Wrap(`${v5Head('Ours, and theirs', 'A Convexa chart and a third party’s frame must never be mistaken for each other. Eight things differ, on purpose, and each one is visible: the title, the border, where the provenance sits, the colour, the numbers, the interaction, the states and the privacy line.', 'TT-01, DB-15, Amendments 2026-10-13 “Third-party embeds” (P-7)')}
    <div class="vs"><div class="note"><span class="caps">Convexa’s chart</span>${ours}</div><div class="note"><span class="caps">A third party’s frame</span>${theirs}</div></div>
    ${sec('What differs, and why', '', diffs)}
    ${sec('The frame’s own two states', '', states)}`, { scheme, minHeight });
}
