// Tools from public data (v4 wave 2) — one renderer per tool, plus the generic state set every tool
// gets from its record in data/tools.mjs. Live content is research, never a buy/sell instruction.
import { fluidChart, icon } from '../lib.mjs';
import { TOOLS } from '../data/tools.mjs';
import { NVDA } from '../data/hybrid.mjs';
import { STATE_ROWS } from '../data/states.mjs';
import { dataCell, provChip, rangeBar, stateTag } from './data-states.mjs';
import { TV_CHIP, sampleBarView, tvBlocked, tvFrame, tvHead, tvNote } from './tradingview.mjs';

const T = Object.fromEntries(TOOLS.map((t) => [t.key, t]));
const claim = (c, sub) => `<div><p class="claim">${c}</p><p class="sub">${sub}</p></div>`;
const mono = (s, size = 13, extra = '') => `<span class="mono" style="font-size: ${size}px;${extra}">${s}</span>`;

function line(vals, { w = 640, h = 160, dim = false, labelEnd = '' } = {}) {
  const min = Math.min(...vals), max = Math.max(...vals), l = 8, r = labelEnd ? 96 : 8;
  const x = (i) => l + (i / (vals.length - 1)) * (w - l - r);
  const y = (v) => 10 + (1 - (v - min) / (max - min || 1)) * (h - 30);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const lx = x(vals.length - 1), ly = y(vals[vals.length - 1]);
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" style="display: block; width: 100%; height: auto;"><line x1="${l}" x2="${w - r}" y1="${h - 18}" y2="${h - 18}" stroke="var(--line-2)"></line><path d="${d}" fill="none" stroke="${dim ? 'var(--text-dim)' : 'var(--phosphor)'}" stroke-width="2" stroke-linejoin="round"></path><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" fill="${dim ? 'var(--text-dim)' : 'var(--phosphor)'}"></circle>${labelEnd ? `<text x="${(lx + 8).toFixed(1)}" y="${(ly + 4).toFixed(1)}" font-family="IBM Plex Mono" font-size="12" font-weight="600" fill="var(--phosphor)">${labelEnd}</text>` : ''}</svg>`;
}

// ---- the nine renderers: render(opts) → markup. `compact` is the card / state-cell form. ----------
const R = {
  liquidity({ compact = false, dim = false } = {}) {
    const v = T.liquidity.values;
    if (compact) return `<span class="dval${dim ? ' t-dim' : ''}" style="font-size: 22px;">${v.net}</span><span class="dline">${v.change} · Fed assets less TGA less reverse repo</span>${line(v.series.slice(-12), { w: 260, h: 48, dim })}`;
    return `${claim('Net liquidity fell $86B in four weeks as the Treasury rebuilt its cash.', 'Fed balance sheet less the Treasury General Account less reverse repo, $T, 26 weeks to Oct 9.')}
      ${fluidChart({ height: 190, pl: 44, pr: 70, prn: 58, xmin: 0, xmax: v.series.length - 1, ymin: 5.5, ymax: 5.75, aria: 'Net liquidity, 26 weeks to Oct 9: from 5.71 to 5.56 trillion dollars', yTicks: [{ v: 5.55, label: '5.55' }, { v: 5.65, label: '5.65' }, { v: 5.75, label: '5.75' }], xTicks: [{ v: 0, label: 'Apr 16' }, { v: v.series.length - 1, label: 'Oct 9' }], series: [{ points: v.series.map((n, i) => [i, n]), stroke: dim ? 'var(--text-dim)' : 'var(--phosphor)', end: { long: v.net, short: v.net } }] })}
      <div class="hd-fig" style="grid-template-columns: repeat(3, minmax(0, 1fr));"><div><span class="caps">Fed assets · H.4.1</span><span class="v">${v.fed}</span><span class="dline" style="font-size: 11px;">week to Oct 8 · weekly</span></div><div><span class="caps">Treasury cash · TGA</span><span class="v">${v.tga}</span><span class="dline" style="font-size: 11px;">Oct 9 · daily</span></div><div><span class="caps">Reverse repo · RRP</span><span class="v">${v.rrp}</span><span class="dline" style="font-size: 11px;">Oct 9 · daily</span></div></div>
      <p class="srcline">Sources: Federal Reserve H.4.1 (Data Download Program), Treasury Daily Treasury Statement (Fiscal Data API), NY Fed reverse repo (Markets API). The weekly and daily series are aligned on the H.4.1 date. Computed by Convexa.</p>`;
  },
  calendar({ compact = false, dim = false } = {}) {
    const ev = T.calendar.events;
    const rows = (list) => `<div class="hd-list">${list.map(([d, dow, what, who, at, trig]) => `<div style="grid-template-columns: 64px minmax(0, 1fr) auto;"><span class="mono${dim ? ' t-dim' : ''}" style="font-size: 12px;">${d}<br><span class="steel" style="font-size: 11px;">${dow}</span></span><span style="font-size: 13px; min-width: 0;"><span style="font-weight: 600;">${what}</span><br><span class="dline" style="font-size: 11px;">${who} · ${at}</span>${trig ? `<br><span class="stag k-solid" style="margin-top: 4px;">${icon('calendar', 12)}Review trigger · ${trig}</span>` : ''}</span><span class="mono steel" style="font-size: 11px;">${who}</span></div>`).join('')}</div>`;
    if (compact) return rows(ev.slice(0, 3));
    return `${claim('Two releases in the next three weeks touch the notes’ discount rates.', 'Scheduled US releases, next four weeks. Times are Eastern. A review trigger marks the notes a release can make stale.')}${rows(ev)}<p class="srcline">Sources: Federal Reserve FOMC calendar, BLS and BEA release schedules, Treasury auction schedule. Dates are as published; a moved release updates here and on every note it touches.</p>`;
  },
  otc({ compact = false, dim = false } = {}) {
    const wk = T.otc.weeks;
    const max = 42;
    const bars = (h) => `<div role="img" aria-label="Off-exchange share of NVDA volume by week, Jul 7 to Sep 22: between 36% and 41%, ATS about 11%" style="display: grid; grid-template-columns: repeat(${wk.length}, minmax(0, 1fr)); gap: 6px; align-items: end; height: ${h}px; border-bottom: 1px solid var(--line-2);">${wk.map(([d, ats, non], i) => `<div style="display: flex; flex-direction: column; justify-content: flex-end; height: 100%;"><span style="display: block; height: ${Math.round((non / max) * (h - 16))}px; background: ${dim ? 'var(--text-dim)' : 'var(--steel)'}; opacity: 0.55; border-radius: 3px 3px 0 0;"></span><span style="display: block; height: ${Math.round((ats / max) * (h - 16))}px; background: ${dim ? 'var(--text-dim)' : i === wk.length - 1 ? 'var(--phosphor)' : 'var(--steel)'};"></span></div>`).join('')}</div>`;
    if (compact) return `<span class="dval${dim ? ' t-dim' : ''}" style="font-size: 22px;">38%</span><span class="dline">of NVDA shares traded off-exchange, week of Sep 22 · ATS 11%</span>${bars(44)}`;
    return `${claim('About 38% of NVDA’s volume traded away from exchanges in the week of Sep 22, near its 12-week median.', 'Off-exchange share of weekly volume, %. Lower block: alternative trading systems (ATS). Upper block: other off-exchange (non-ATS).')}
      ${bars(150)}<div style="display: flex; justify-content: space-between; font: 400 11px 'IBM Plex Mono', monospace; color: var(--steel);"><span>Jul 7</span><span>Sep 22 · ATS 11% + non-ATS 27%</span></div>
      <p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">What it is not:</strong> block trades. FINRA publishes weekly totals per venue, two weeks late for Tier 1 names, four for others. It shows where volume went, not who traded or which way.</p>
      <p class="srcline">Source: FINRA OTC Transparency, ATS and non-ATS weekly data. Share of total from the same week’s consolidated volume. Display terms: open question Q-2.</p>`;
  },
  clusters({ compact = false, dim = false } = {}) {
    const dots = [['Sep 2', 'sale', 'Officer'], ['Sep 9', 'sale', 'Director'], ['Sep 18', 'sale', 'Officer'], ['Sep 29', 'sale', 'Officer'], ['Oct 3', 'sale', 'Officer'], ['Oct 8', 'sale', 'Director']];
    const strip = `<div role="img" aria-label="NVDA Form 4 trades over 90 days: six sales under 10b5-1 plans, no open-market purchases" style="position: relative; height: 44px; border-bottom: 1px solid var(--line-2);">${dots.map(([d], i) => `<span style="position: absolute; left: ${8 + i * 15}%; bottom: 8px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid ${dim ? 'var(--text-dim)' : 'var(--steel)'}; background: transparent;"></span>`).join('')}<span style="position: absolute; right: 0; bottom: 8px; font: 400 11px 'IBM Plex Mono', monospace; color: var(--steel);">ring = sale · dot = purchase</span></div>`;
    if (compact) return `<span class="dval${dim ? ' t-dim' : ''}" style="font-size: 20px;">No cluster</span><span class="dline">NVDA: 12 sales, all under 10b5-1 plans; 0 open-market purchases in 90 days.</span>${strip}`;
    const ex = `<div style="border: 1px dashed var(--steel-2); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;"><span class="caps">What a cluster looks like · illustrative</span><div style="position: relative; height: 44px; border-bottom: 1px solid var(--line-2);">${[0, 1, 2].map((i) => `<span style="position: absolute; left: ${30 + i * 6}%; bottom: 8px; width: 12px; height: 12px; border-radius: 50%; background: var(--phosphor);"></span>`).join('')}<span style="position: absolute; left: 28%; width: 16%; bottom: 0; top: 4px; border: 1px solid var(--line-2); border-radius: 6px;"></span></div><span class="dline">Three insiders (a director, the CFO, a director) buying in the open market within six days, outside any plan. Roles only; names stay in the filing.</span></div>`;
    return `${claim('No cluster: NVDA’s insiders sold 12 times in 90 days, every sale under a pre-set plan.', 'Form 4 transactions, last 90 days, by date. A cluster is three or more insiders buying in the open market within ten days.')}${strip}${ex}<p class="srcline">Source: SEC Form 4, parsed by Convexa. 10b5-1 plan sales are scheduled months ahead and never count toward a cluster.</p>`;
  },
  holders({ compact = false, dim = false } = {}) {
    const rows = T.holders.rows;
    const table = (list) => `<div class="drows">${list.map(([h, kind, sh, ch]) => `<div style="grid-template-columns: minmax(0, 1fr) 64px 64px;${dim ? ' color: var(--text-dim);' : ''}"><span style="min-width: 0;"><span style="font-weight: 600;">${h}</span> <span class="steel" style="font-size: 11px;">${kind}</span></span><span class="mono" style="text-align: right;">${sh}</span><span class="mono" style="text-align: right; font-size: 11px; padding: 2px 6px; border-radius: 6px; background: rgba(138,155,180,0.16);">${ch}</span></div>`).join('')}</div>`;
    if (compact) return `<span class="dval${dim ? ' t-dim' : ''}" style="font-size: 20px;">+0.4% net</span><span class="dline">shares held by 4,812 filers, quarter to Jun 30</span>${table(rows.slice(0, 3))}`;
    return `${claim('Funds added a net 0.4% to their NVDA holdings in Q2; two of the five largest holders cut.', 'Shares held at Jun 30 and the change from Mar 31, from 13F-HR filings. Holder names are placeholders on this board.')}
      <div style="display: grid; grid-template-columns: minmax(0, 1fr) 64px 64px; gap: 8px; font-size: 11px; color: var(--steel); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;"><span>Holder</span><span style="text-align: right;">Shares</span><span style="text-align: right;">vs Q1</span></div>${table(rows)}
      <p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">What 13F leaves out:</strong> short positions, most options detail, non-US listings, and anything bought or sold since Jun 30. It arrives up to 45 days after the quarter, by law.</p>
      <p class="srcline">Source: SEC 13F-HR information tables, read per filing. 4,812 filers report NVDA for the quarter to Jun 30.</p>`;
  },
  xbrl({ compact = false, dim = false } = {}) {
    const rows = T.xbrl.rows;
    const flag = (s) => s === 'matches' ? `<span class="stag k-solid">${icon('check', 12)}matches</span>` : s.startsWith('differs') ? `<span class="stag k-warn">${icon('warn', 12)}${s}</span>` : `<span class="stag k-quiet">${icon(s === 'computed' ? 'sigma' : 'doc', 12)}${s}</span>`;
    if (compact) return `<div class="drows">${rows.slice(1, 4).map(([f, , mine, filed, s]) => `<div style="grid-template-columns: minmax(0, 1fr) 56px auto;${dim ? ' color: var(--text-dim);' : ''}"><span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f}</span><span class="mono" style="text-align: right;">${mine}</span>${flag(s)}</div>`).join('')}</div>`;
    return `${claim('Two of six figures in the NVDA note need a look before the note publishes.', 'Each typed figure beside the value the 10-Q tags for the same period. Owner-only authoring view.')}
      <div style="overflow-x: auto;" role="region" aria-label="Figures against the filing" tabindex="0"><table class="smap" style="min-width: 680px;"><thead><tr><th>Figure</th><th>In the note</th><th>From the 10-Q</th><th>Concept</th><th>Check</th><th></th></tr></thead><tbody>${rows.map(([f, concept, mine, filed, s]) => `<tr><td class="w"><b>${f}</b></td><td class="mono" style="color: var(--phosphor);">${mine}</td><td class="mono">${filed}</td><td style="font-size: 11px;">${concept}</td><td>${flag(s)}</td><td>${s.startsWith('differs') ? '<button class="btn secondary sm" type="button">Use the filing’s 66.4%</button>' : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="srcline">Filed values: SEC XBRL company facts, 10-Q for the quarter to Jul 26, filed Aug 27. Rounding to the note’s precision counts as a match.</p>`;
  },
  peers({ compact = false, dim = false } = {}) {
    const rows = T.peers.rows;
    const dotRow = ([n, v]) => `<div style="display: grid; grid-template-columns: 64px minmax(0, 1fr) 52px; gap: 10px; align-items: center; padding: 5px 0;"><span class="mono" style="font-size: 12px;${n === 'NVDA' ? ' font-weight: 600;' : ' color: var(--steel);'}">${n}</span><span style="position: relative; height: 12px; border-bottom: 1px solid var(--line);"><span style="position: absolute; left: ${v}%; top: 0; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: ${n === 'NVDA' ? (dim ? 'var(--text-dim)' : 'var(--phosphor)') : 'transparent'}; border: 2px solid ${n === 'NVDA' ? 'transparent' : 'var(--steel)'};"></span></span><span class="mono" style="font-size: 12px; text-align: right;">${v.toFixed(1)}%</span></div>`;
    if (compact) return `<span class="dline">Gross margin, CY2026 Q2 · NVDA 2nd of 9</span>${rows.slice(0, 4).map(dotRow).join('')}`;
    return `${claim('NVDA’s gross margin ranks second of nine semiconductor filers for calendar Q2.', 'GAAP gross profit ÷ revenue, %, calendar quarter 2026 Q2, from each filer’s tagged facts. Axis 0 to 100%. Peer names are placeholders on this board.')}${rows.map(dotRow).join('')}
      <p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Read with care:</strong> fiscal quarters differ; the frames API maps each filing to the calendar quarter it mostly covers.</p><p class="srcline">Source: SEC XBRL frames API, us-gaap:GrossProfit and us-gaap:Revenues, CY2026Q2, 9 filers.</p>`;
  },
  ta({ compact = false, research = false, readingsOnly = false } = {}) {
    // A chart by TradingView (live, display-only) beside readings Convexa would compute (blocked).
    const readings = `<section class="hd-p" aria-label="Readings Convexa would compute"><div class="ph"><h3>Readings Convexa would compute</h3>${stateTag('notLive', 'Not live · price source')}</div><div class="hd-fig" style="grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));">${['RSI 14', 'ATR 14', 'Realized vol · 20d', 'Support · resistance', 'vs SPY · 3 mo', 'vs SMH · 3 mo'].map((l) => `<div><span class="caps">${l}</span><span class="dnan">—</span></div>`).join('')}</div><p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Off because</strong> Convexa has no daily prices licensed to it. TradingView’s chart is display-only: Convexa doesn’t read, store or compute anything from it.</p></section>`;
    if (readingsOnly) return readings;
    if (research) return `<p class="dline" style="margin: 0; font-size: 13px;"><strong style="color: var(--phosphor);">Would show</strong> NVDA against SPY and SMH since the note’s price date, computed by Convexa.</p><p class="dline" style="margin: 0; font-size: 13px;"><strong style="color: var(--phosphor);">Off because</strong> Convexa has no daily prices licensed to it; TradingView’s chart on the Technical tab is display-only.</p><a href="/ticker/NVDA/technical-analysis" class="t-info" style="display: inline-flex; gap: 6px; align-items: center; min-height: 24px; font-weight: 500;">Open the daily chart, by TradingView ${icon('arrow', 14)}</a>`;
    if (compact) return tvFrame({ ticker: 'NVDA', height: 150, phoneHeight: 150, mini: true });
    return `${tvHead('NVDA', { level: 'h3' })}<div class="cq">${tvFrame({ ticker: 'NVDA', height: 620, phoneHeight: 480 })}</div>${tvNote()}${readings}`;
  },
  signals({ compact = false, dim = false } = {}) {
    const rows = T.signals.rows;
    const gap = (g) => { const n = parseFloat(g.replace('−', '-')); return `<span style="position: relative; display: block; height: 10px;"><span style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--line-2);"></span><span style="position: absolute; top: 2px; height: 6px; border-radius: 3px; background: ${dim ? 'var(--text-dim)' : 'var(--steel)'}; left: ${50 + Math.min(0, n) * 12}%; width: ${Math.abs(n) * 12}%;"></span></span>`; };
    const table = (list) => `<div class="drows">${list.map(([s, n, hit, med, g]) => `<div style="grid-template-columns: minmax(0, 1fr) 36px 44px 60px 90px;${dim ? ' color: var(--text-dim);' : ''}"><span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s}</span><span class="mono" style="text-align: right;">${n}</span><span class="mono" style="text-align: right;">${hit}</span><span class="mono" style="text-align: right;">${med}</span>${gap(g)}</div>`).join('')}</div>`;
    if (compact) return `<span class="dline">Setups graded after a 0.10% round-trip cost</span>${table(rows.slice(0, 3))}`;
    return `${claim('After costs, two of four setup families held more often than not, and every family’s median outcome landed short of its level.', 'Scanner setups since Jul 1, graded 20 sessions later, net of a 0.10% round-trip cost. Gap: how far the median outcome landed from the level the setup named, in points of price.')}
      <div style="display: grid; grid-template-columns: minmax(0, 1fr) 36px 44px 60px 90px; gap: 8px; font-size: 11px; color: var(--steel); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;"><span>Setup</span><span style="text-align: right;">n</span><span style="text-align: right;">Hit</span><span style="text-align: right;">Median</span><span>Gap to level</span></div>${table(rows)}
      <p class="dline" style="margin: 0;">Hit rates are research, not a recommendation: a setup describes structure, and these grades say how often that description held. Calibration sits with the forecasts above.</p>`;
  },
};
export const renderTool = (key, opts) => R[key](opts);

// ---- the generic state set: every tool, every state, honest about what cannot happen --------------
function taRecord(state) {
  const t = T.ta;
  const na = (why) => ({ title: t.name, tag: null, blocks: [['na', why]], foot: [] });
  const tv = ['prov', TV_CHIP, 'dotted'];
  switch (state) {
    case 'current': return { title: 'Daily chart · NVDA', tag: ['thirdParty'], blocks: [['html', tvFrame({ height: 132, phoneHeight: 132, mini: true })]], foot: [tv] };
    case 'delayed': return { title: 'Daily chart · NVDA', tag: ['delayed', 'Delayed · Cboe One'], blocks: [['html', tvFrame({ height: 104, phoneHeight: 104, mini: true })], ['line', t.delayedNote + '.']], foot: [tv] };
    case 'stale': return na('Convexa keeps no copy of TradingView’s chart, so there is no last good copy; a failed load shows Error.');
    case 'loading': return { title: 'Daily chart · NVDA', tag: null, blocks: [['html', tvFrame({ height: 140, phoneHeight: 140, state: 'loading' })], ['line', 'The frame holds its final size with a 1px border; nothing shifts.']], foot: [] };
    case 'empty': return { title: 'Daily chart · XYZ', tag: null, blocks: [['strong', t.empty[0]], ['line', t.empty[1]]], foot: [] };
    case 'error': return { title: 'Daily chart · NVDA', tag: null, blocks: [['html', tvBlocked('NVDA')]], foot: [] };
    case 'unavailable': return na('One failure state: if TradingView doesn’t answer, the frame shows the same notice as a blocked loader (Error).');
    case 'notConfigured': return na('TradingView’s free widget needs no key or account.');
    case 'off': return na('Live builds always load it; the CSP allows exactly TradingView’s hosts.');
    case 'paused': return na('It doesn’t depend on Convexa’s market-data mode.');
    case 'notLive': return { title: 'Readings Convexa would compute', tag: ['notLive', 'Not live · price source'], blocks: [['would', 'RSI, ATR, realized vol, relative strength vs SPY and SMH, support and resistance, computed by Convexa.'], ['off', 'Convexa has no daily prices licensed to it; TradingView’s chart is display-only.']], foot: [] };
    case 'sample': return { title: 'Technical analysis · sample', tag: ['sample', 'Sample bars'], blocks: [['line', 'The demo’s sample-bar view: 60 synthetic daily bars with EMA 20 and 50, RSI 14, ADX 14 and ATR 14.']], foot: [['prov', 'Sample · not recorded market history', 'dashed']], frame: 'sample' };
    case 'demo': return { title: 'Technical analysis · NVDA', tag: null, blocks: [['line', 'Demo builds keep the sample-bar view; TradingView’s widget appears only in live builds.']], foot: [['prov', 'Demo · sample data', 'dashed']] };
    case 'locked': return na('Public on every ticker; nothing sits behind a sign-in.');
    default: return na('');
  }
}

export function toolRecord(key, state) {
  if (key === 'ta') return taRecord(state);
  const t = T[key];
  const html = (o) => ['html', R[key]({ compact: true, ...o })];
  const chip = ['prov', t.chip, 'solid'];
  const na = (why) => ({ title: t.name, tag: null, blocks: [['na', why]], foot: [] });
  const src = t.source.split(' · ')[0];
  switch (state) {
    case 'current': return { title: t.name, tag: t.tag, blocks: [html()], foot: [chip] };
    case 'delayed': return { title: t.name, tag: ['delayed', 'Later than usual'], blocks: [html(), ['line', t.delayedNote]], foot: [chip] };
    case 'stale': return { title: t.name, tag: ['stale', 'Last good copy'], blocks: [html({ dim: true }), ['line', `${src} didn’t answer at 14:05 UTC; showing the copy fetched at 08:00.`]], foot: [] };
    case 'loading': return { title: t.name, tag: null, blocks: [['mark', t.skel === 'chart' ? 'skelChart' : 'skelRows', { n: 4 }]], foot: [] };
    case 'empty': return { title: t.name, tag: null, blocks: [['strong', t.empty[0]], ['line', t.empty[1]]], foot: [] };
    case 'error': return { title: t.name, tag: ['error'], blocks: [['strong', `${t.name} didn’t load.`], ['line', 'Convexa’s server didn’t answer within 20 s. Nothing else on the page depends on it.']], foot: [['retry']] };
    case 'unavailable': return { title: t.name, tag: ['unavailable'], blocks: [['strong', `${src} didn’t answer.`], ['line', 'No earlier copy is cached, so this is unknown, not empty.']], foot: [['next', 'Convexa asks again at 14:15 UTC']] };
    case 'notConfigured': return t.config ? { title: t.name, tag: ['notConfigured'], blocks: [['strong', t.config[0]], ['line', 'The rest of the page works without it.']], foot: [['op', t.config[1]]] } : na('Needs no key or setting: the source is open.');
    case 'off': return { title: t.name, tag: ['off'], blocks: [['strong', 'Public data is switched off on this server.'], ['line', `${t.name} comes from ${src} through Convexa’s API, which has public data off.`]], foot: [['op', 'PUBLIC_DATA=off']] };
    case 'paused': return na('Public data has no pause. A stopped source shows Off, or Source down.');
    case 'notLive': return t.blocked
      ? { title: t.name, tag: ['notLive', 'Not live · price source'], blocks: [['would', t.unlocks.charAt(0).toLowerCase() + t.unlocks.slice(1) + '.'], ['off', 'no daily price history licensed for public display has been chosen yet.']], foot: [['link', 'See it on the demo’s sample prices', '#staging']] }
      : na('Free and public: it never depends on the paid options feed.');
    case 'sample': return { title: t.name, tag: ['sample'], blocks: [html(), ['line', 'Authored sample, Oct 7, 2026. Not market data.']], foot: [['prov', 'Sample · not market data', 'dashed']], frame: 'sample' };
    case 'demo': return { title: t.name, tag: null, blocks: [html()], foot: [['prov', `Demo · shaped like ${src}`, 'dashed']] };
    case 'locked': return t.locked ? { title: t.name, tag: ['locked'], blocks: [['strong', t.locked[0]], ['line', t.locked[1]]], foot: [['btn', 'Sign in']] } : na('Public records: nothing here sits behind a sign-in.');
    default: return na('');
  }
}
export const toolCell = ({ tool, state, phone = false, w = 300, h = 236 }) => dataCell({ fam: 'kpi', state, phone, w, h, record: toolRecord(tool, state) });

export const toolEntries = TOOLS.map((t) => ({
  spec: { id: `tool-${t.key}`, name: `${t.name} · ${t.status}`, react: t.where, path: t.source, change: `${t.unlocks}. Delay: ${t.delay}.`, notes: 'Status in docs/public-data/CANDIDATES.md’s words.' },
  states: STATE_ROWS.map((r) => ({ label: r.name, props: { tool: t.key, state: r.key } })),
  render: (p) => toolCell(p),
}));
export { TOOLS };
