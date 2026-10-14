// v4 · Tools from public data — one sheet per priority tool (desktop, phone, every state) and the
// roadmap of every row in docs/public-data/CANDIDATES.md.
import { icon } from '../../lib.mjs';
import { ROADMAP, STATE_ROWS } from '../../data/index.mjs';
import { TOOLS } from '../../data/tools.mjs';
import { provChip, stateTag, statusChip, statusKeys, BUILD_STATUS } from '../../components/data-states.mjs';
import { renderTool, toolCell } from '../../components/tools.mjs';
import { sheetHead } from './data-sheets.mjs';

export const TOOLS_CSS = `
  .ts-meta { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 8px 16px; font-size: 13px; max-width: 1100px; }
  .ts-meta dt { color: var(--steel); } .ts-meta dd { margin: 0; }
  .ts-row { display: grid; grid-template-columns: minmax(0, 1fr) 390px; gap: 32px; align-items: start; }
  .ts-label { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .ts-phone { width: 390px; box-sizing: border-box; padding: 16px; border-radius: 24px; border: 1px solid var(--line-2); background: var(--ink); }
  .ts-states { display: grid; grid-template-columns: repeat(4, 300px); gap: 16px; }
  .ts-states .st { display: flex; flex-direction: column; gap: 6px; }
  .rm-table td.unl { color: var(--phosphor); }
`;

const FIND = { liquidity: 'TL-01, TL-02', calendar: 'TL-03, TL-04', otc: 'TL-05, TKR-07', clusters: 'TL-06', holders: 'TL-07', xbrl: 'TL-08, TL-09', peers: 'TL-10', ta: 'TL-11, TKR-05, DS-03', signals: 'TL-12' };

export function toolSheetBody({ tool, minHeight = 2200, scheme = 'dark' } = {}) {
  const t = TOOLS.find((x) => x.key === tool);
  const panel = (inner, title) => `<section class="hd-p" aria-label="${title}"><div class="ph"><h3>${title}</h3>${stateTag(t.tag[0], t.tag[1])}</div>${inner}<div>${provChip(t.chip, 'solid')}</div></section>`;
  // Technical analysis renders its own heading, dotted chip and note (TradingView's frame is shown as
  // TradingView's), so it isn't wrapped in the generic tool panel.
  const desktop = tool === 'ta' ? `<div style="display: flex; flex-direction: column; gap: 16px;">${renderTool('ta', {})}</div>` : panel(renderTool(tool, {}), t.name);
  const phone = `<div class="ts-phone">${tool === 'ta' ? `<div style="display: flex; flex-direction: column; gap: 14px;">${renderTool('ta', {})}</div>` : panel(renderTool(tool, {}), t.name)}</div>`;
  const research = tool === 'ta' ? `<div><div class="ts-label"><span class="caps">Research panel · on the note · a reading Convexa would compute</span></div><section class="hd-p"><div class="ph"><h3>Price since this note</h3>${stateTag('notLive', 'Not live · price source')}</div>${renderTool('ta', { research: true })}</section></div>` : '';
  const states = `<div class="ts-states">${STATE_ROWS.map((r) => `<div class="st"><span class="caps">${r.name}</span>${toolCell({ tool, state: r.key })}</div>`).join('')}</div>`;
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="sheet">
    ${sheetHead(t.name, t.unlocks + '.', FIND[tool] || '')}
    <dl class="ts-meta"><dt>Build status</dt><dd style="display: flex; gap: 6px; flex-wrap: wrap;">${statusChip(t.status)}<span class="steel" style="font-size: 12px;">${statusKeys(t.status).map((s) => BUILD_STATUS[s].note).join(' · ')}</span></dd><dt>Source</dt><dd>${t.source}</dd><dt>Delay</dt><dd>${t.delay}</dd><dt>Where it lives</dt><dd>${t.where}</dd></dl>
    <div class="ts-row"><div><div class="ts-label"><span class="caps">Desktop · ${t.blocked ? 'design target (blocked: illustrative values)' : tool === 'ta' ? 'TradingView’s chart, live; Convexa’s readings, blocked' : 'live'}</span></div>${desktop}</div><div><div class="ts-label"><span class="caps">Phone · 390</span></div>${phone}</div></div>
    ${research}
    <section aria-label="Every state" style="display: flex; flex-direction: column; gap: 12px;"><h2 class="display" style="margin: 0; font-size: 22px;">Every state</h2><p class="lead" style="margin: 0;">The tool’s card in all ${STATE_ROWS.length} data states. States that cannot happen to a free public source say so.</p>${states}</section>
    <p style="margin: 0; font-size: 12px; color: var(--steel);">Illustrative design values; holder, peer and insider names are placeholders. Research and tools, not investment advice.</p>
  </div></div>`;
}

export function roadmapBody({ minHeight = 3600, scheme = 'dark' } = {}) {
  const all = ROADMAP.flatMap((g) => g.rows);
  const count = {};
  for (const r of all) for (const s of statusKeys(r[3])) count[s] = (count[s] || 0) + 1;
  const designed = { 'Liquidity panel': 'V4ToolLiquidity', 'Macro calendar': 'V4ToolCalendar', 'Off-exchange volume by ticker': 'V4ToolOtc', 'Insider clusters': 'V4ToolClusters', 'Fund holdings changes': 'V4ToolHolders', 'Note figures filled from XBRL': 'V4ToolXbrl', 'Peer tables': 'V4ToolPeers', 'Technical analysis: trend, RSI, ATR, support and resistance': 'V4ToolTa', 'Signal track record after costs': 'V4ToolSignals', 'Yield curve, real 10-year, breakeven, 2s10s': 'V4Markets', 'Asset managers and leveraged funds, 3 markets': 'V4Markets', 'Each note’s discount-rate drift': 'V4Markets', 'Short interest and days to cover': 'V4TickerResearch', 'Short-sale volume': 'V4TickerResearch', 'Insider trades, 10b5-1 flag': 'V4TickerResearch', 'Filings feed, filed since this note': 'V4Filings', 'Reported figures in the filing detail': 'V4Filings', 'Forecast scorecard': 'V4Scorecard', 'Fails to deliver': 'V4TickerResearch' };
  const table = `<table class="smap rm-table"><thead><tr><th style="width: 22%;">Tool</th><th style="width: 18%;">Source</th><th style="width: 14%;">Delay</th><th style="width: 10%;">Status</th><th style="width: 20%;">What it unlocks</th><th style="width: 9%;">Where</th><th>Drawn on</th></tr></thead><tbody>${ROADMAP.map((g) => `<tr class="grp"><td colspan="7">${g.group}</td></tr>${g.rows.map(([n, src, delay, st, unl, where]) => `<tr><td class="w"><b>${n}</b></td><td>${src}</td><td>${delay}</td><td><span style="display: flex; gap: 4px; flex-wrap: wrap;">${statusChip(st)}</span></td><td class="unl">${unl}</td><td>${where}</td><td>${designed[n] ? `<span class="mono" style="font-size: 11px; color: var(--phosphor);">${designed[n]}</span>` : '<span class="steel">roadmap only</span>'}</td></tr>`).join('')}`).join('')}</tbody></table>`;
  const gate = `<section aria-label="The one gate" class="hd-p" style="gap: 10px;"><div class="ph"><h3>The one gate: daily prices licensed for public display</h3>${statusChip('live (TradingView chart)')}${statusChip('blocked (Convexa readings)')}</div><p class="dline" style="margin: 0; font-size: 13px;"><strong style="color: var(--phosphor);">Settled 2026-10-13:</strong> the owner chose TradingView’s free advanced-chart widget for the live Technical tab. It draws daily candles, EMA 20 and 50 and RSI 14 from TradingView’s own licensed, delayed prices, shown as TradingView’s (dotted chip, its attribution untouched, a privacy note).</p><p class="dline" style="margin: 0; font-size: 13px;">It is display-only: Convexa reads, stores and computes nothing from it. So every tool in this group that needs Convexa’s own computation (relative strength, realized volatility, correlation, earnings moves, the signal track record) stays blocked until Convexa has a feed licensed to it.</p></section>`;
  const notFree = `<section aria-label="Not free" class="hd-p" style="gap: 10px;"><div class="ph"><h3>Not free: stays not live on the hybrid site</h3>${stateTag('notLive')}</div><p class="dline" style="margin: 0; font-size: 13px;">Options chains and everything built on them: dealer gamma and the flip, vanna and charm flows, IV term structure and rank, the straddle-implied move, Vol/OI, max pain; the intraday tape, VWAP and real-time blocks; and the AI read built on those inputs. Each shows an honest not-live state or a labelled sample (State matrix, Hybrid desk). Free stand-ins exist for pieces only: FINRA weekly off-exchange volume for blocks, realized volatility for implied.</p></section>`;
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="sheet">
    ${sheetHead('What Convexa can build without the paid feed', `Every row of docs/public-data/CANDIDATES.md (2026-10-13), in its own status words. ${all.length} tools: ${['live', 'switch', 'build', 'verify', 'blocked'].map((s) => `${count[s] || 0} ${s}`).join(' · ')}. The priorities have their own sheets on this page; the rest are listed with what they unlock.`, 'TL-13, Q-1 (resolved), Q-2, Q-3')}
    <div class="tally">${['live', 'switch', 'build', 'verify', 'blocked'].map((s) => `<span>${statusChip(s)}<span class="mono" style="font-size: 13px;">${count[s] || 0}</span><span class="steel" style="font-size: 12px;">${BUILD_STATUS[s].note}</span></span>`).join('')}</div>
    ${table}
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">${gate}${notFree}</div>
    <p style="margin: 0; font-size: 12px; color: var(--steel);">Sources, delays and statuses are copied from docs/public-data/CANDIDATES.md; “checked” there means fetched live on 2026-10-13. Research and tools, not investment advice.</p>
  </div></div>`;
}
