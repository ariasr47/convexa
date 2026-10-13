// v4 · Data states — the spec sheets: the widget source map and the state matrix (desktop, phone).
import { icon } from '../../lib.mjs';
import { SOURCE_MAP, STATE_ROWS, FAMILIES, COMPUTED, LOCAL, STREAM } from '../../data/index.mjs';
import { dataCell, provChip, stateTag, statusChip, BUILD_STATUS } from '../../components/data-states.mjs';

export const SHEET_CSS = `
  .sheet { padding: 48px 64px 64px; display: flex; flex-direction: column; gap: 32px; box-sizing: border-box; }
  .sheet h1 { margin: 0; font-size: 40px; letter-spacing: -0.02em; }
  .sheet .lead { margin: 8px 0 0; max-width: 92ch; font-size: 15px; color: var(--steel); line-height: 1.6; text-wrap: pretty; }
  .sheet .trace { margin: 10px 0 0; font: 400 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .legend { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px 24px; }
  .legend > div { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); }
  .smap { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .smap th { position: sticky; top: 0; background: var(--ink); text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 10px 10px; border-bottom: 1px solid var(--line-2); }
  .smap td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; line-height: 1.45; color: var(--steel); }
  .smap td.w { color: var(--phosphor); }
  .smap td.w b { display: block; font-weight: 600; }
  .smap tr.grp td { padding: 22px 10px 8px; border-bottom: 1px solid var(--line-2); color: var(--phosphor); font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 17px; }
  .smap td .stagwrap { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .tally { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; }
  .tally > span { display: inline-flex; align-items: center; gap: 8px; font: 500 13px 'IBM Plex Mono', monospace; }
  .mx-grid { display: grid; gap: 16px; align-items: start; }
  .mx-colhead { display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; border-bottom: 2px solid var(--phosphor); }
  .mx-colhead b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 17px; }
  .mx-rowhead { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
  .mx-rowhead b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 17px; }
  .mx-rowhead span.r { font-size: 12px; color: var(--steel); line-height: 1.45; }
`;

export function sheetHead(title, lead, trace = '') {
  return `<header><h1 class="display">${title}</h1><p class="lead">${lead}</p>${trace ? `<p class="trace">Resolves ${trace}</p>` : ''}</header>`;
}

const LEGEND_EXTRA = [COMPUTED, LOCAL, STREAM];
export function stateLegend() {
  return `<div class="legend">${[...STATE_ROWS, ...LEGEND_EXTRA].map((r) => `<div>${stateTag(r.key, r.key === 'current' ? 'Updated Oct 9' : '', { lg: true })}<span style="font-size: 13px; font-weight: 600;">${r.name}</span><span style="font-size: 12px; color: var(--steel); line-height: 1.45;">${r.rule}</span></div>`).join('')}</div>`;
}

export function sourceMapBody({ minHeight = 4600, scheme = 'dark' } = {}) {
  const all = SOURCE_MAP.flatMap((g) => g.rows);
  const byState = {};
  const byStatus = {};
  for (const r of all) {
    byState[r[6]] = (byState[r[6]] || 0) + 1;
    for (const s of String(r[5]).split(/\s*\/\s*/)) byStatus[s] = (byStatus[s] || 0) + 1;
  }
  const stateOrder = ['current', 'delayed', 'computed', 'local', 'notLive', 'paused', 'sample', 'demo'];
  const tally = `<div class="tally">${stateOrder.filter((k) => byState[k]).map((k) => `<span>${stateTag(k, '', { lg: true })}${byState[k]}</span>`).join('')}</div>`;
  const statusTally = `<div class="tally">${['live', 'switch', 'build', 'verify', 'blocked', 'not live', '—'].filter((k) => byStatus[k]).map((k) => `<span>${BUILD_STATUS[k] ? statusChip(k) : `<span class="bstat">${k === 'not live' ? icon('notlive', 12) : ''}${k === '—' ? 'no data source' : k}</span>`}${byStatus[k]}</span>`).join('')}</div>`;
  const table = `<table class="smap"><thead><tr><th style="width: 19%;">Widget · what it shows</th><th style="width: 15%;">Needs</th><th style="width: 12%;">Source</th><th style="width: 11%;">Delay</th><th style="width: 9%;">Build status</th><th style="width: 13%;">Hybrid site</th><th style="width: 11%;">Labelled with</th><th>Today, if different</th></tr></thead><tbody>${SOURCE_MAP.map((g) => `<tr class="grp"><td colspan="8">${g.screen}</td></tr>${g.rows.map(([w, shows, needs, src, delay, status, state, tagText, chipText, today]) => `<tr><td class="w"><b>${w}</b>${shows}</td><td>${needs}</td><td>${src}</td><td>${delay}</td><td><span style="display: flex; flex-wrap: wrap; gap: 4px;">${status === '—' ? '<span class="steel">—</span>' : status === 'not live' ? `<span class="bstat">${icon('notlive', 12)}not live</span>` : statusChip(status)}</span></td><td><span class="stagwrap">${stateTag(state, tagText && state !== 'local' ? tagText : '')}</span></td><td>${chipText ? provChip(chipText, /Sample|sample/.test(chipText) ? 'dashed' : 'solid') : tagText && state === 'local' ? `<span class="steel">${tagText}</span>` : '<span class="steel">—</span>'}</td><td>${today || ''}</td></tr>`).join('')}`).join('')}</tbody></table>`;
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="sheet">
    ${sheetHead('Where every number comes from', 'Every widget on every screen: what it shows, what it needs, where that comes from, how late it arrives, and what the hybrid site shows once SEC_USER_AGENT is set. Live where free public data reaches; honestly not live where the paid options feed is needed. Build status uses docs/public-data/CANDIDATES.md’s words. “[EOD PRICE SOURCE]” is an open question, not a fact: no daily price source licensed for public display has been chosen.', 'X-01 · X-02 · X-03 · X-08 · DS-01 · DS-02 · DS-03 · DS-04')}
    <section aria-label="Totals" style="display: flex; flex-direction: column; gap: 14px;"><span class="caps">${all.length} widgets · by state in the hybrid site</span>${tally}<span class="caps" style="margin-top: 8px;">by build status</span>${statusTally}</section>
    <section aria-label="State vocabulary" style="display: flex; flex-direction: column; gap: 12px;"><span class="caps">The vocabulary: a word and a glyph for each state, never hue alone</span>${stateLegend()}</section>
    <section aria-label="Source map">${table}</section>
    <p style="margin: 0; font-size: 12px; color: var(--steel);">Figures and dates on this board are illustrative design values, not market data. Sources and delays: docs/public-data/CANDIDATES.md and apps/api/src/services/public_data.</p>
  </div></div>`;
}

export function stateMatrixBody({ minHeight = 4100, scheme = 'dark', phone = false } = {}) {
  const W = phone ? 358 : 300, H = phone ? 268 : 236, RH = 236;
  const cols = `grid-template-columns: ${RH}px repeat(${FAMILIES.length}, ${W}px);`;
  const colHead = `<div class="mx-grid" style="${cols}"><span></span>${FAMILIES.map((f) => `<div class="mx-colhead"><b>${f.name}</b><span style="font-size: 12px; color: var(--steel);">${f.desc}</span></div>`).join('')}</div>`;
  const rows = STATE_ROWS.map((r) => `<div class="mx-grid" style="${cols}"><div class="mx-rowhead">${stateTag(r.key, r.key === 'current' ? 'Updated · Live' : '', { lg: true })}<b>${r.name}</b><span class="r">${r.rule}</span></div>${FAMILIES.map((f) => dataCell({ fam: f.key, state: r.key, phone, w: W, h: H })).join('')}</div>`).join('');
  const title = phone ? 'Every widget, every state · phone' : 'Every widget, every state';
  const lead = phone
    ? 'The same records at phone width (358px of a 390 screen, 16px gutters). The AI read and the dialog become bottom sheets with a handle; every control rises to 44px; tables keep three columns and truncate the third.'
    : 'Nine widget families down the top, fourteen data states down the side. A state that cannot happen to a family says so (“Does not apply”) instead of being drawn anyway. Sample wears a dashed frame and a hatch; failures wear burnt orange and the warning glyph; the stream dot appears only in the two cells a paid stream could drive.';
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="sheet" style="gap: 24px;">
    ${sheetHead(title, lead, 'X-01 · X-02 · X-09 · X-10 · DS-05 · DS-06 · DS-07 · DS-08')}
    ${colHead}
    ${rows}
    <p style="margin: 0; font-size: 12px; color: var(--steel);">Copy reuses shipped strings where they exist (AI read, paused desk, public-data panels). Figures are illustrative design values. Source records: design/src/data/states.mjs; renderer: design/src/components/data-states.mjs.</p>
  </div></div>`;
}
