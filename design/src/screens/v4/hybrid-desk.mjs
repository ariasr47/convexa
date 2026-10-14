// v4 · the hybrid ticker desk (NVDA). Public data live; the options-feed panels either explain
// themselves (opts.sample false) or show a labelled sample (opts.sample true). One fluid body: the
// phone board is this screen at 390 (zone B folds into one list there).
import { fluidChart, icon, v4Page } from '../../lib.mjs';
import { NVDA } from '../../data/index.mjs';
import { dataCell, gexBars, provChip, rangeBar, stateTag } from '../../components/data-states.mjs';

export const HYBRID_CSS = `
  .hd { padding-top: 24px; display: flex; flex-direction: column; gap: 24px; }
  .hd-mast { display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: flex-end; }
  .hd-mast .who { flex: 999 1 520px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .hd-mast .act { flex: 1 1 300px; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
  .hd-tabs { display: flex; gap: 4px; }
  .hd-tabs a { display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 999px; color: var(--steel); text-decoration: none; font-size: 13px; font-weight: 500; }
  .hd-tabs a[aria-current="page"] { background: var(--phosphor); color: var(--ink); font-weight: 600; }
  .hd-syms { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
  .hd-syms a { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line); font: 600 12px/1 'IBM Plex Mono', monospace; color: var(--phosphor); text-decoration: none; flex: 0 0 auto; }
  .hd-syms a[aria-current="true"] { border-color: var(--phosphor); box-shadow: inset 0 0 0 1px var(--phosphor); }
  .hd-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); }
  .hd-legend .n { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .hd-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 8px; background: var(--raised); border: 1px solid var(--line); }
  .hd-seg button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--steel); font: 600 12px 'IBM Plex Sans', sans-serif; cursor: pointer; }
  .hd-seg button[aria-pressed="true"] { background: var(--panel); color: var(--phosphor); box-shadow: var(--e1); }
  .hd-zone { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; padding-top: 8px; border-top: 1px solid var(--line-2); }
  .hd-zone h2 { margin: 0; font-size: 24px; }
  .hd-row { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 16px; align-items: stretch; }
  .hd-row.even { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
  .hd-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .hd-ctx { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .hd-ladder { display: flex; flex-direction: column; }
  .hd-ladder > div { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); font-size: 12px; }
  .hd-strip { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 1px; background: var(--line); border-radius: 10px; overflow: hidden; }
  .hd-strip > div { background: var(--ink-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  @media (max-width: 1099px) { .hd-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hd-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (max-width: 899px) { .hd-row, .hd-row.even { grid-template-columns: 1fr; } .hd-ctx { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 767px) { .hd-mast .act { align-items: stretch; } .hd-mast .act .btn { width: 100%; min-height: 44px; } .hd-tabs a { min-height: 44px; } .hd-syms a { height: 44px; } .hd-cards, .hd-ctx { grid-template-columns: 1fr; } .hd-zone h2 { font-size: 20px; } .hd-seg button { min-height: 40px; } .hd-p { padding: 16px; } }
`;

const P = (inner, { sample = false, label = '', extra = '' } = {}) => `<section class="hd-p${sample ? ' is-sample' : ''}"${label ? ` aria-label="${label}"` : ''}${extra ? ` style="${extra}"` : ''}>${inner}</section>`;
const head = (title, tag, more = '') => `<div class="ph"><h3>${title}</h3>${tag}${more}</div>`;
const would = (w, off) => `<p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Would show</strong> ${w}</p><p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Off because</strong> ${off}</p>`;

function priceChart() {
  const c = NVDA.closes;
  const avg = (n, off) => c.map((_, i) => { const s = c.slice(Math.max(0, i - n + 1), i + 1); return s.reduce((a, v) => a + v, 0) / s.length - off; });
  const s20 = avg(20, 1.5), s50 = avg(50, 7), last = c.length - 1;
  const pts = (vals) => vals.map((v, i) => [i, v]);
  return fluidChart({
    height: 240, pl: 40, pr: 118, prn: 64, xmin: 0, xmax: last, ymin: 200, ymax: 246,
    aria: 'NVDA daily closes from Sep 15 to Oct 12, with the 20- and 50-day averages; support near 211 and resistance at the 52-week high, 243.37',
    yTicks: [{ v: 210, label: '210' }, { v: 220, label: '220', minor: true }, { v: 230, label: '230' }, { v: 240, label: '240' }],
    xTicks: [{ v: 0, label: 'Sep 15' }, { v: last, label: 'Oct 12' }],
    hlines: [{ v: 211, label: { long: 'support 211.00', short: 'support' } }, { v: 243.37, label: { long: '52-wk high 243.37', short: 'high' } }],
    series: [
      { points: pts(s50), stroke: 'var(--steel)', width: 1.5, dash: '6 4', end: { long: '50-day avg', short: '50d' }, endColor: 'var(--steel)', endY: s50[last] - 1.2 },
      { points: pts(s20), stroke: 'var(--steel)', width: 1.5, end: { long: '20-day avg', short: '20d' }, endColor: 'var(--steel)', endY: s20[last] - 1.2 },
      { points: pts(c), stroke: 'var(--phosphor)', width: 2.25, end: { long: '226.32 close', short: '226.32' }, endY: c[last] + 1.2 },
    ],
    pointLabels: [],
  });
}

function liveZone() {
  const t = NVDA.ta;
  const ta = P(`${head('Price and trend', stateTag('computed', 'Computed · end of day'))}
    <div><p class="claim">NVDA has closed above its 20- and 50-day averages for 14 sessions.</p><p class="sub">Daily closes, $, Sep 15 to Oct 12. Averages and levels computed by Convexa from end-of-day bars.</p></div>
    ${priceChart()}
    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${provChip('[EOD PRICE SOURCE] · close Oct 12', 'solid')}<span class="dline" style="font-size: 11px;">Price source and its display licence: open question (REVIEW Q-1).</span></div>`, { label: 'Price and trend' });
  const readings = P(`${head('Readings', stateTag('computed', 'Computed'))}
    <div class="hd-fig">
      <div><span class="caps">RSI 14</span><span class="v">${t.rsi}</span><span class="dline" style="font-size: 11px;">between 30 and 70</span></div>
      <div><span class="caps">ATR 14</span><span class="v">${t.atr}</span><span class="dline" style="font-size: 11px;">${t.atrPct} of the close</span></div>
      <div><span class="caps">Realized vol · 20d</span><span class="v">${t.hv20}</span><span class="dline" style="font-size: 11px;">60-day ${t.hv60}</span></div>
      <div><span class="caps">Support · resistance</span><span class="v" style="font-size: 15px;">${t.support} · ${t.resistance}</span><span class="dline" style="font-size: 11px;">from the daily range</span></div>
      <div><span class="caps">vs SPY · 3 months</span><span class="v">${t.rsSpy}</span><span class="dline" style="font-size: 11px;">relative strength</span></div>
      <div><span class="caps">vs SMH · 3 months</span><span class="v">${t.rsSector}</span><span class="dline" style="font-size: 11px;">against its sector ETF</span></div>
    </div>
    <span class="dline" style="font-size: 11px;">Implied volatility needs the options chain and stays not live. Readings describe; they are not signals.</span>`, { label: 'Technical readings' });
  const cards = [
    dataCell({ fam: 'pos', state: 'delayed', w: '100%', h: 'auto' }),
    dataCell({ fam: 'pos', state: 'current', w: '100%', h: 'auto' }),
    P(`${head('Insider trades · 90 days', stateTag('current', 'Updated Oct 12'))}<span class="dval" style="font-size: 22px;">12 sales · 0 buys</span><span class="dline">All 12 under pre-set 10b5-1 plans, which schedule sales months ahead. No cluster of buying.</span><div style="margin-top: auto;">${provChip('SEC Form 4 · latest Oct 8', 'solid')}</div>`, { label: 'Insider trades' }),
    P(`${head('Off-exchange volume · weekly', stateTag('delayed', 'Delayed · 2 weeks'))}<span class="dval" style="font-size: 22px;">38%<span class="steel" style="font-size: 13px; font-family: 'IBM Plex Sans';"> of shares traded</span></span><span class="dline">ATS 11% · non-ATS 27%, week of Sep 22. The free stand-in for the live block-trade panel below.</span><div style="margin-top: auto;">${provChip('FINRA OTC Transparency · wk Sep 22', 'solid')}</div>`, { label: 'Off-exchange volume' }),
  ].join('');
  const filings = P(`${head('Recent filings', stateTag('current', 'Checked 14:00 UTC'))}<div class="hd-list">${[['Oct 9', '8-K', 'Item 5.02 · officer change', 'new since the note'], ['Aug 27', '10-Q', 'Quarter to Jul 27 · revenue $46.7B', 'in note'], ['Aug 27', '8-K', 'Item 2.02 · Q2 FY2027 results', 'in note']].map(([d, f, w, s]) => `<div><span style="font-size: 13px;"><span class="mono steel" style="margin-right: 10px;">${d}</span><span class="mono" style="font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 5px; background: rgba(138,155,180,0.16); margin-right: 10px;">${f}</span>${w}</span><span class="dline" style="font-size: 11px;${s === 'new since the note' ? ' color: var(--phosphor); font-weight: 600;' : ''}">${s}</span></div>`).join('')}</div><div>${provChip('SEC EDGAR · submissions', 'solid')}</div>`, { label: 'Recent filings' });
  const note = P(`${head('Research note', stateTag('current', 'Review due'))}<p style="margin: 0; font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 600; font-size: 17px; line-height: 1.3; text-wrap: balance;">A 70% growth guide on a $412B year. What comes after FY2028 is the whole question.</p><span class="dline">Written Oct 13. The Oct 9 8-K landed after the price date, so the note asks for a review. Stance: your call.</span><a href="/ticker/NVDA/research" class="t-info" style="display: inline-flex; gap: 6px; align-items: center; min-height: 24px; margin-top: auto; font-weight: 500;">Open the note ${icon('arrow', 14)}</a>`, { label: 'Research note' });
  return `<div class="hd-zone"><h2 class="display">Live from public data</h2><span class="dline" style="font-size: 13px;">Each panel names its source and how late that source reports.</span></div>
    <div class="hd-row">${ta}${readings}</div>
    <div class="hd-cards">${cards}</div>
    <div class="hd-row even">${filings}${note}</div>`;
}

const NOT_LIVE = [
  ['Dealer flow projection', 'how charm and vanna push dealer hedging into Friday’s expiry.', '−$412M delta drift to Oct 16', 'charm · vanna'],
  ['Term structure', 'implied volatility by tenor, and whether it slopes up or down.', 'Contango · 7d 41.2 → 90d 44.8', 'ATM IV by tenor'],
  ['Straddle-implied move', 'the move the nearest at-the-money straddle prices in.', '± $9.85 (4.4%) to Oct 16', 'ATM straddle'],
  ['Fresh positioning · Vol/OI', 'strikes where today’s volume outruns open interest.', '230C 2.4× · 240C 1.9×', 'volume ÷ open interest'],
  ['Off-exchange blocks', 'large prints away from the exchanges, as they happen.', '$31M · 137,200 sh · ATS', 'block prints'],
  ['Setups', 'the scanner’s named setups on this ticker.', 'Near call wall · IV cheap', 'setup rules'],
];

function notLiveZone(sample) {
  const ladderRows = [['Call wall', sample ? '240.00' : '—', sample ? '+6.0%' : ''], ['Max pain', sample ? '225.00' : '—', ''], ['Gamma flip', sample ? '221.50' : '—', sample ? '−2.1%' : ''], ['Put wall', sample ? '210.00' : '—', sample ? '−7.2%' : '']];
  const ladder = `<div class="hd-ladder" aria-label="Levels">${ladderRows.map(([n, v, d]) => `<div><span aria-hidden="true" style="width: 14px; border-top: 2px ${sample ? 'solid' : 'dashed'} var(--steel-2);"></span><span class="steel">${n}</span><span class="${sample ? 'mono' : 'dnan'}" style="font-size: ${sample ? 13 : 13}px;">${v}${d ? ` <span class="steel" style="font-size: 11px;">${d}</span>` : ''}</span></div>`).join('')}</div>`;
  const field = sample
    ? P(`${head('Structure field', stateTag('sample'), provChip('Sample · not market data', 'dashed'))}<div><p class="claim">In the sample, dealers are long gamma above 221.50.</p><p class="sub">Net dealer gamma by strike, authored scenario of Oct 7, 2026. Not market data.</p></div><div style="display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 20px; align-items: center;">${gexBars('live', 160)}${ladder}</div>`, { sample: true, label: 'Structure field, sample' })
    : P(`${head('Structure field', stateTag('notLive'))}<div style="display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 20px; align-items: center;"><div>${gexBars('outline', 140)}</div>${ladder}</div>${would('net dealer gamma at each strike, the walls, the gamma flip and max pain, and where the mid sits between them.', 'every level is computed from the options chain, a paid feed this site doesn’t run.')}<div style="display: flex; gap: 10px; flex-wrap: wrap;"><a href="?sample=1" class="btn secondary">Show it with sample data</a><a href="/methodology#data" class="btn ghost">What the paid feed adds</a></div>`, { label: 'Structure field, not live' });
  const stripCells = [['Opportunity', '72 · Actionable'], ['Net DEX', '−$412M'], ['IV / HV', '1.08'], ['IV rank', '34'], ['Vol / OI', '0.61×'], ['IV skew', '+2.4 pts'], ['Term', 'Contango'], ['Off-exch. %', '41%']];
  const strip = sample
    ? P(`${head('Read strip', stateTag('sample'))}<div class="hd-strip">${stripCells.map(([l, v]) => `<div><span class="caps">${l}</span><span class="mono" style="font-size: 16px;">${v}</span></div>`).join('')}</div>`, { sample: true, label: 'Read strip, sample' })
    : P(`${head('Read strip', stateTag('notLive'))}<p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Would show</strong> eight figures from the chain: opportunity, net DEX, IV/HV, IV rank, Vol/OI, IV skew, term structure and the off-exchange share. <strong style="color: var(--phosphor);">Off because</strong> each one reads the options chain or the intraday tape.</p>`, { label: 'Read strip, not live' });
  const ai = dataCell({ fam: 'ai', state: sample ? 'sample' : 'notLive', w: '100%', h: 'auto' });
  const tape = dataCell({ fam: 'tape', state: sample ? 'sample' : 'notLive', w: '100%', h: 'auto' });
  const ctx = NOT_LIVE.map(([n, w, sv, basis]) => sample
    ? P(`${head(n, stateTag('sample'))}<span class="mono" style="font-size: 15px;">${sv}</span><span class="dline" style="font-size: 11px;">${basis} · sample, Oct 7</span>`, { sample: true })
    : P(`${head(n, stateTag('notLive'))}<p class="dline" style="margin: 0;"><strong style="color: var(--phosphor);">Would show</strong> ${w}</p>${n === 'Off-exchange blocks' ? `<a href="#otc" class="t-info" style="font-size: 12px; font-weight: 500; display: inline-flex; gap: 4px; align-items: center; min-height: 24px;">Weekly off-exchange volume is live above ${icon('arrow', 12)}</a>` : ''}`)).join('');
  const phoneList = `<section class="hd-p only-phone" aria-label="Panels that need the options feed">${head('9 panels need the options feed', stateTag(sample ? 'sample' : 'notLive'))}<div class="hd-list">${['Structure field and levels', 'Read strip', 'AI read', 'Live tape', ...NOT_LIVE.map((n) => n[0])].map((n) => `<div><span style="font-size: 13px;">${n}</span><span class="dline" style="font-size: 11px;">${sample ? 'sample' : 'not live'}</span></div>`).join('')}</div><a href="?sample=1" class="btn secondary" style="min-height: 44px;">${sample ? 'Hide the sample' : 'Show them with sample data'}</a></section>`;
  return `<div class="hd-zone" id="not-live"><h2 class="display">Needs the options feed</h2><span class="dline" style="font-size: 13px;">${sample ? 'Showing an authored sample scenario (Oct 7, 2026) in hatched, dashed panels. Not market data.' : 'These panels read the options chain or the intraday tape, a paid feed this site doesn’t run. Each says what it would show.'}</span></div>
    ${phoneList}
    <div class="only-wide" style="display: flex; flex-direction: column; gap: 16px;">${field}${strip}<div class="hd-row even">${ai}${tape}</div><div class="hd-ctx">${ctx}</div></div>`;
}

export function hybridDeskBody({ minHeight = 3200, scheme = 'dark', sample = false } = {}) {
  const legend = `<section class="hd-legend" aria-label="Data on this page"><span class="caps" style="color: var(--phosphor);">On this page</span>
    <span style="display: inline-flex; gap: 6px; align-items: center;">${stateTag('current', 'Updated')}<span class="n">3</span></span>
    <span style="display: inline-flex; gap: 6px; align-items: center;">${stateTag('delayed', 'Delayed by source')}<span class="n">3</span></span>
    <span style="display: inline-flex; gap: 6px; align-items: center;">${stateTag('computed', 'Computed')}<span class="n">2</span></span>
    <span style="display: inline-flex; gap: 6px; align-items: center;">${stateTag(sample ? 'sample' : 'notLive', sample ? 'Sample' : 'Not live')}<span class="n">9</span></span>
    <span style="flex: 1 1 auto;"></span>
    <span style="display: inline-flex; gap: 8px; align-items: center; font-size: 12px; color: var(--steel);">Options panels<span class="hd-seg" role="group" aria-label="Options panels"><button type="button" aria-pressed="${!sample}">Explain</button><button type="button" aria-pressed="${sample}">Show sample</button></span></span></section>`;
  const mast = `<div class="hd-mast">
    <div class="who">
      <div style="display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;"><h1 class="display" style="margin: 0; font-size: clamp(32px, 3vw, 44px); letter-spacing: -0.02em;">${NVDA.symbol}</h1><span class="steel" style="font-size: 14px;">${NVDA.name} · ${NVDA.venue} · ${NVDA.sector}</span></div>
      <div style="display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap;"><span class="mono" style="font-size: 22px; font-weight: 500;">${NVDA.close}</span>${stateTag('delayed', `Close · ${NVDA.closeDate}`)}<span class="mono" style="font-size: 13px;">${NVDA.change}</span><span class="steel" style="font-size: 12px;">on the day</span></div>
      <div style="max-width: 360px;">${rangeBar(NVDA.pos52, { median: 58, lo: '$164.27', md: '52 weeks', hi: '$243.37', aria: 'Close at 75% of its 52-week range, 164.27 to 243.37' })}</div>
    </div>
    <div class="act"><nav aria-label="NVDA" class="hd-tabs"><a href="/ticker/NVDA" aria-current="page">Overview</a><a href="/ticker/NVDA/technical-analysis">Technical</a><a href="/ticker/NVDA/research">Research</a></nav><a href="/ticker/NVDA/research" class="btn primary lg">Read the NVDA note</a></div>
  </div>
  <nav aria-label="Quick symbols" class="hd-syms">${['SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMD'].map((s) => `<a href="/ticker/${s}"${s === 'NVDA' ? ' aria-current="true"' : ''}>${s}</a>`).join('')}</nav>`;
  return v4Page({ scheme, minHeight, active: 'ticker', label: 'NVDA desk', main: `<div class="wrap hd">${mast}${legend}${liveZone()}${notLiveZone(sample)}<p class="dline" style="margin: 0;">Research and tools, not investment advice. Figures on this board are illustrative design values.</p></div>` });
}
