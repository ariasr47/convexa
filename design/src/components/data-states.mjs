// Data states (v4, 2026-10-13) — the provenance vocabulary and nine widget families, each drawn in
// all fourteen states from data/states.mjs. The library renders them from the registry; the state
// matrix and the hybrid desk call the same functions, so the three can never disagree.
import { icon } from '../lib.mjs';
import { COMPUTED, DATA_STATES, FAMILIES, LOCAL, STATE_ROWS, STREAM } from '../data/states.mjs';

const ROW = Object.fromEntries([...STATE_ROWS, STREAM, COMPUTED, LOCAL].map((r) => [r.key, r]));
export const STATE_BY_KEY = ROW;

/** The state tag: word + glyph + treatment. Never hue alone. */
export function stateTag(state, text = '', { lg = false } = {}) {
  const r = ROW[state];
  if (!r) return '';
  const g = r.kind === 'stream' ? '<span class="sdot" aria-hidden="true"></span>' : r.glyph ? icon(r.glyph, 12) : '';
  return `<span class="stag k-${r.kind}${lg ? ' lg' : ''}">${g}${text || r.word}</span>`;
}

/** Provenance chip (canon 2026-10-13): solid = primary source, dotted = third party, dashed = sample. */
export function provChip(text, kind = 'solid', href = '') {
  const cls = `prov${kind === 'solid' ? '' : ' ' + kind}`;
  return href ? `<a class="${cls}" href="${href}">${text}</a>` : `<span class="${cls}">${text}</span>`;
}

/** Build status, in docs/public-data/CANDIDATES.md's own words. A design annotation, never product UI. */
export const BUILD_STATUS = {
  live: { glyph: 'check', note: 'built and serving through /api/public-data/*' },
  switch: { glyph: 'sliders', note: 'built; needs one setting, no code' },
  build: { glyph: 'wrench', note: 'free source confirmed reachable; not built' },
  verify: { glyph: 'eye', note: 'free source; public-display terms unchecked' },
  blocked: { glyph: 'notlive', note: 'needs a daily price history licensed for public display' },
};
export function statusChip(status) {
  const parts = String(status).split(/\s*\/\s*/);
  return parts.map((s) => `<span class="bstat s-${s}">${icon(BUILD_STATUS[s]?.glyph || 'info', 12)}${s}</span>`).join('');
}

// ---- marks ------------------------------------------------------------------------------------
const FILINGS = [['Oct 9', '8-K', 'Item 5.02 · officer change'], ['Sep 24', '8-K', 'Item 5.07 · shareholder vote'], ['Aug 27', '10-Q', 'Quarter to Jul 27'], ['Aug 27', '8-K', 'Item 2.02 · results']];
const SCAN = [['SPY', '72', 'Actionable'], ['NVDA', '88', 'Prime'], ['QQQ', '64', 'Watch'], ['TSLA', '41', 'Quiet']];
const PRINTS = [['10:42:07', '573.12', '×200'], ['10:42:05', '573.10', '×1,400'], ['10:42:04', '573.11', '×300']];
const skel = (w, h = 10) => `<span class="skel" aria-hidden="true" style="display: block; width: ${w}; height: ${h}px;"></span>`;
const rows = (data, cols, { dim = false } = {}) => `<div class="drows">${data.map((r) => `<div style="grid-template-columns: ${cols};${dim ? ' color: var(--text-dim);' : ''}">${r.map((c, i) => `<span style="${i === 0 ? `font-family: 'IBM Plex Mono', monospace; color: ${dim ? 'var(--text-dim)' : 'var(--steel)'};` : i === 1 ? "font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600;" : 'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'}">${c}</span>`).join('')}</div>`).join('')}</div>`;

function curve(dim = false, h = 64) {
  return `<svg aria-hidden="true" viewBox="0 0 240 ${h}" preserveAspectRatio="none" style="width: 100%; height: ${h}px; display: block;"><line x1="0" x2="240" y1="${h - 2}" y2="${h - 2}" stroke="var(--line-2)"></line><polyline points="4,${h - 18} 50,${h - 30} 96,${h - 36} 150,${h - 42} 236,${h - 52}" fill="none" stroke="var(--steel)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></polyline><polyline points="4,${h - 26} 50,${h - 40} 96,${h - 46} 150,${h - 50} 236,${h - 58}" fill="none" stroke="${dim ? 'var(--text-dim)' : 'var(--phosphor)'}" stroke-width="2" vector-effect="non-scaling-stroke"></polyline></svg>`;
}
/** Gamma by strike in four registers: live (gamma sign may be green/red), dim, outline (not live), sample. */
export function gexBars(mode = 'live', h = 64) {
  const vals = [-6, -10, -14, -8, -3, 4, 9, 15, 11, 6, 3, 1];
  const mid = h / 2;
  const bars = vals.map((v, i) => {
    const x = 6 + i * 19.5, bh = (Math.abs(v) * (h / 2 - 6)) / 15, y = v > 0 ? mid - bh : mid;
    if (mode === 'outline') return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="13" height="${bh.toFixed(1)}" rx="2" fill="none" stroke="var(--line-2)" stroke-dasharray="3 3"></rect>`;
    const fill = mode === 'dim' ? 'var(--text-dim)' : v > 0 ? 'var(--up)' : 'var(--down)';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="13" height="${bh.toFixed(1)}" rx="2" fill="${fill}" fill-opacity="${mode === 'dim' ? 0.55 : 0.8}"></rect>`;
  }).join('');
  return `<svg aria-hidden="true" viewBox="0 0 240 ${h}" preserveAspectRatio="none" style="width: 100%; height: ${h}px; display: block;"><line x1="0" x2="240" y1="${mid}" y2="${mid}" stroke="var(--line-2)"></line>${bars}</svg>`;
}
export function rangeBar(pos, { median = 52, lo = '3-yr low', md = 'median', hi = '3-yr high', aria = '' } = {}) {
  return `<div role="img" aria-label="${aria || `At ${pos}% of its range`}" style="display: flex; flex-direction: column; gap: 4px; min-width: 0;"><div style="position: relative; height: 22px;"><span style="position: absolute; left: 0; right: 0; top: 7px; height: 8px; border-radius: 4px; background: rgba(138,155,180,0.18);"></span><span style="position: absolute; left: ${median}%; top: 5px; width: 2px; height: 12px; background: var(--steel-2);"></span><span style="position: absolute; left: ${pos}%; top: 2px; width: 4px; height: 18px; margin-left: -2px; border-radius: 2px; background: var(--phosphor);"></span></div><div style="display: flex; justify-content: space-between; font: 400 11px 'IBM Plex Mono', monospace; color: var(--steel);"><span>${lo}</span><span>${md}</span><span>${hi}</span></div></div>`;
}
function bars12(dim = false) {
  return `<div aria-hidden="true" style="display: flex; align-items: flex-end; gap: 3px; height: 28px;">${[1.0, 1.1, 1.0, 0.9, 0.95, 1.0, 1.05, 0.9, 0.85, 0.9, 1.0, 0.9].map((v, i, a) => `<span style="flex: 1; height: ${Math.round((v / 1.2) * 28)}px; border-radius: 2px; background: ${i === a.length - 1 ? (dim ? 'var(--text-dim)' : 'var(--phosphor)') : 'var(--steel-2)'}; opacity: ${i === a.length - 1 ? 1 : 0.55};"></span>`).join('')}</div>`;
}
const MARKS = {
  curve: (o) => curve(o.dim),
  gex: (o) => gexBars(o.mode || 'live', o.h || 64),
  range: (o) => rangeBar(o.pos ?? 50, { aria: 'Asset managers net long at 88% of their 3-year range' }),
  filings: (o) => rows(FILINGS.slice(0, o.n || 4), '50px 40px minmax(0, 1fr)', o),
  shortTable: () => rows([['NVDA', '0.9%', 'of float · 1.1 days to cover'], ['TSLA', '2.6%', 'of float · 1.4 days'], ['MSFT', '0.6%', 'of float · 1.9 days']], '50px 44px minmax(0, 1fr)'),
  scan: (o) => rows(SCAN, '50px 32px minmax(0, 1fr)', o),
  blocks: (o) => rows([['10:41', '$31M', 'SPY · 54,100 sh · ATS'], ['10:38', '$18M', 'SPY · 31,400 sh · ATS'], ['10:31', '$12M', 'SPY · 20,900 sh · ATS']], '42px 46px minmax(0, 1fr)', o),
  insiders: () => rows([['Oct 8', 'F4', 'Director · sale · 10b5-1 plan'], ['Oct 3', 'F4', 'Officer · sale · 10b5-1 plan'], ['Sep 29', 'F4', 'Officer · sale · 10b5-1 plan']], '50px 30px minmax(0, 1fr)'),
  prints: (o) => rows(PRINTS, '64px minmax(0, 1fr) auto', o),
  bars: (o) => bars12(o.dim),
  risk: (o) => `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px;">${[['Max risk', '$420'], ['Invalidation', '568.50']].map(([a, b]) => `<div style="background: var(--ink-2); border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column;"><span class="caps">${a}</span><span class="mono${o.dim ? ' t-dim' : ''}" style="font-size: 14px;">${b}</span></div>`).join('')}</div>`,
  legs: (o) => `<div style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; font-size: 12px;${o.dim ? ' color: var(--text-dim);' : ''}"><span>Buy 1 SPY Oct 31 575 call</span><span class="mono">2.10</span><span class="steel">Max loss</span><span class="mono">$210</span></div>`,
  emptyAxis: () => `<div style="height: 44px; border-bottom: 1px dashed var(--line-2);"></div>`,
  skelKpi: () => `<div aria-busy="true" style="display: flex; flex-direction: column; gap: 8px;">${skel('42%', 26)}${skel('88%')}${skel('70%')}</div>`,
  skelChart: () => `<div aria-busy="true" style="display: flex; flex-direction: column; gap: 8px;">${skel('84%', 14)}${skel('60%')}<div style="height: 60px; border-bottom: 1px solid var(--line-2);"></div></div>`,
  skelRows: (o) => `<div aria-busy="true" style="display: flex; flex-direction: column; gap: 10px; padding-top: 4px;">${Array.from({ length: o.n || 4 }, (_, i) => o.plain ? skel('100%') : `<div style="display: grid; grid-template-columns: 50px 36px minmax(0, 1fr); gap: 8px;">${skel('100%')}${skel('100%')}${skel(['80%', '64%', '72%', '56%'][i % 4])}</div>`).join('')}</div>`,
  skelPos: () => `<div aria-busy="true" style="display: flex; flex-direction: column; gap: 8px;">${skel('36%', 24)}${skel('100%', 28)}${skel('64%')}</div>`,
  skelAi: () => `<div style="display: flex; flex-direction: column; gap: 6px;">${skel('70%', 20)}${skel('100%', 34)}</div>`,
  skelForm: () => `<div aria-busy="true" style="display: flex; flex-direction: column; gap: 10px;">${skel('30%')}${skel('100%', 34)}${skel('30%')}${skel('100%', 34)}</div>`,
  skelDialog: () => `<div aria-busy="true" style="display: flex; flex-direction: column; gap: 8px;">${skel('80%', 12)}${skel('60%', 12)}${skel('100%', 30)}</div>`,
};

// ---- block + foot grammar (see data/states.mjs) ----------------------------------------------
function block(b) {
  const [k, a, c, d] = b;
  switch (k) {
    case 'value': return `<span class="dval${c && c.dim ? ' t-dim' : ''}" style="font-size: ${(c && c.size) || 26}px;">${a}</span>`;
    case 'nan': return `<span class="dnan">${a}</span>`;
    case 'line': return `<span class="dline">${a}</span>`;
    case 'strong': return `<span class="dstrong">${a}</span>`;
    case 'would': return `<span class="dline"><strong style="color: var(--phosphor); font-weight: 600;">${c || 'Would show'}</strong> ${a}</span>`;
    case 'off': return `<span class="dline"><strong style="color: var(--phosphor); font-weight: 600;">Off because</strong> ${a}</span>`;
    case 'claim': return `<span style="font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 600; font-size: 14px; line-height: 1.3; text-wrap: balance;">${a}</span><span class="dline" style="font-size: 11px;">${c}</span>`;
    case 'mark': return MARKS[a](c || {});
    case 'warn': return `<div class="dwarn">${icon('warn', 14)}<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;"><span style="font-size: 12.5px; font-weight: 600;">${a}</span>${c ? `<span class="dline" style="font-size: 11.5px;">${c}</span>` : ''}</div></div>`;
    case 'field': { const o = d || {}; return `<label class="dfield${o.err ? ' err' : ''}${o.disabled ? ' dis' : ''}">${a}<span class="in">${c}</span>${o.help ? `<span class="help">${o.err ? icon('warn', 12) : ''}${o.help}</span>` : ''}</label>`; }
    case 'verdict': return `<span style="font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 20px; line-height: 1.15; color: ${c && c.dim ? 'var(--text-dim)' : 'var(--amber-text)'};">${a}</span>`;
    case 'na': return `<div class="dna"><span class="caps">Does not apply</span><span class="dline">${a}</span></div>`;
    case 'pause': return `<span style="display: inline-flex; gap: 6px; align-items: center;">${icon('pause', 12)}<span class="dline">${a}</span></span>`;
    case 'progress': return `<span aria-hidden="true" style="display: block; height: 3px; width: 46%; border-radius: 2px; background: var(--amber);"></span><span class="dline" role="status">${a}</span>`;
    case 'kv': return `<div style="display: flex; justify-content: space-between; font-size: 12px;"><span class="steel">${a}</span><span class="steel">${c}</span></div>`;
    default: return '';
  }
}
function foot(f, phone) {
  const [k, a, c] = f;
  const h = phone ? 44 : 32;
  switch (k) {
    case 'prov': return provChip(a, c || 'solid');
    case 'retry': return `<button class="btn secondary sm" type="button" style="min-height: ${h}px;">${icon('refresh', 14)}Try again</button>`;
    case 'link': return `<a href="${c}" class="t-info" style="display: inline-flex; align-items: center; gap: 4px; min-height: 24px; font-size: 12px; font-weight: 500;">${a}${icon('arrow', 12)}</a>`;
    case 'op': return `<details class="dop"><summary>For the operator</summary><span class="mono" style="font-size: 11px; color: var(--steel);">${a}</span></details>`;
    case 'next': return `<span class="dline" style="font-size: 11px; display: inline-flex; gap: 6px; align-items: center;">${icon('clock', 12)}${a}</span>`;
    case 'src': return `<span class="dline" style="font-size: 11px;">${a}</span>`;
    case 'skel': return skel(a, 18);
    case 'btn': return `<button class="btn secondary sm" type="button"${c && c.disabled ? ' disabled' : ''} style="min-height: ${h}px;">${c && c.icon ? icon(c.icon, 14) : ''}${a}</button>`;
    case 'primary': return `<button class="btn primary sm" type="button" style="min-height: ${h}px;">${a}</button>`;
    default: return '';
  }
}

/** One family in one state. `phone` turns the AI read and the dialog into bottom sheets and lifts
 *  every control to 44px; width and height are fixed so a matrix row lines up. */
export function dataCell({ fam, state, phone = false, w = 300, h = 236, record = null }) {
  const r = record || DATA_STATES[fam][state];
  const sheet = phone && (fam === 'ai' || fam === 'dialog') && !(r.blocks[0] && r.blocks[0][0] === 'na');
  const tag = r.tag ? stateTag(r.tag[0], r.tag[1] || '') : '';
  return `<div class="dcell${r.frame === 'sample' ? ' is-sample' : ''}${sheet ? ' sheet' : ''}${phone ? ' ph' : ''}" style="width: ${typeof w === 'number' ? w + 'px' : w}; ${typeof h === 'number' ? `height: ${h}px;` : `min-height: 236px; height: ${h};`}" aria-label="${r.title.replace(/<[^>]+>/g, '')}: ${ROW[state] ? ROW[state].name : state}">${sheet ? '<span class="handle" aria-hidden="true"></span>' : ''}<div class="dhead"><span class="dtitle">${r.title}</span>${tag}</div><div class="dbody">${r.blocks.map(block).join('')}</div>${r.foot.length ? `<div class="dfoot">${r.foot.map((f) => foot(f, phone)).join('')}</div>` : ''}</div>`;
}

// ---- registry entries --------------------------------------------------------------------------
export const tagSpec = {
  id: 'state-tag',
  name: 'State tag · provenance chip · build status',
  react: 'DataStateTag (new) · ProvenanceChip (research/publicUi.tsx) · design-only status',
  path: 'shared/ui/DataStateTag.tsx (new) · pages/research/publicUi.tsx ProvenanceChip',
  change: 'One tag per widget head naming its data state in a word and a glyph: Updated, Delayed by source, Last good copy, Source down, Not set up, Off, Paused, Not live, Sample, Sign in. Solid for current public data, dashed for sample, burnt orange plus the icon for failures, a quiet tint for switched-off states. The stream dot appears only on a genuine stream.',
  notes: 'Build status (live · switch · build · verify · blocked) uses docs/public-data/CANDIDATES.md’s words and lives on design boards only, never in product UI.',
};
export const tagStates = [
  ...STATE_ROWS.filter((r) => r.kind !== 'none').map((r) => ({ label: r.name, props: { state: r.key } })),
  { label: 'Computed live', props: { state: 'computed' } },
  { label: 'Live stream (paid feed only)', props: { state: 'live' } },
  { label: 'Provenance · primary', props: { prov: ['U.S. Treasury · par yield curve', 'solid'] } },
  { label: 'Provenance · third party', props: { prov: ['StockAnalysis · untraced', 'dotted'] } },
  { label: 'Provenance · sample', props: { prov: ['Sample · not market data', 'dashed'] } },
  { label: 'Build status', props: { status: 'live / switch / build / verify / blocked' } },
];
export const renderTag = (p) => (p.prov ? provChip(p.prov[0], p.prov[1]) : p.status ? `<span style="display: inline-flex; gap: 6px; flex-wrap: wrap;">${statusChip(p.status)}</span>` : stateTag(p.state, '', { lg: true }));

export const familyEntries = FAMILIES.map((f) => ({
  spec: { id: `ds-${f.key}`, name: `${f.name} · data states`, react: f.react, path: f.react, change: `${f.desc}. Drawn in all ${STATE_ROWS.length} data states; a state that cannot happen to this family says so instead of being faked.`, notes: '' },
  states: STATE_ROWS.map((r) => ({ label: r.name, props: { fam: f.key, state: r.key } })),
  render: (p) => dataCell(p),
}));

export { STATE_ROWS, FAMILIES, DATA_STATES, STREAM, COMPUTED, LOCAL };
