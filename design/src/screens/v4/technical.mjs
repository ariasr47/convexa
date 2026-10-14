// v4 · the Technical tab as shipped on 2026-10-13 (TechnicalAnalysisLive.tsx): TradingView's daily
// chart, shown as TradingView's. Demo builds keep the sample-bar view.
import { icon, v4Page } from '../../lib.mjs';
import { sampleBarView, tvBlocked, tvFrame, tvHead, tvNote } from '../../components/tradingview.mjs';
import { statesBoard } from './kit.mjs';

const tabs = (ticker) => `<div style="display: flex; flex-wrap: wrap; gap: 12px 32px; align-items: flex-end; padding-top: 24px;"><div style="flex: 999 1 420px; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;"><span class="display" style="font-size: 36px; line-height: 1;">${ticker}</span><span class="steel">NVIDIA · Nasdaq</span></div><nav aria-label="${ticker}" class="hd-tabs" style="display: flex; gap: 4px;"><a href="/ticker/${ticker}">Overview</a><a href="/ticker/${ticker}/technical-analysis" aria-current="page">Technical</a><a href="/ticker/${ticker}/research">Research</a></nav></div>`;
const links = (ticker, note = true) => `<div style="display: flex; flex-wrap: wrap; gap: 4px 16px;">${note ? `<a href="/ticker/${ticker}/research" class="t-info" style="min-height: 24px; display: inline-flex; align-items: center;">Read ${ticker} research →</a>` : ''}<a href="/ticker/${ticker}" class="t-info" style="min-height: 24px; display: inline-flex; align-items: center;">Back to the overview</a></div>`;

export function technicalBody({ minHeight = 1300, scheme = 'dark' } = {}) {
  const t = 'NVDA';
  const main = `<div class="wrap" style="display: flex; flex-direction: column; gap: 20px;">${tabs(t)}<div style="display: flex; flex-direction: column; gap: 8px;"><h1 class="caps" style="margin: 0;">Technical analysis · ${t}</h1>${tvHead(t)}</div><div class="cq">${tvFrame({ ticker: t, height: 620, phoneHeight: 480 })}</div>${tvNote()}${links(t)}</div>`;
  return v4Page({ scheme, minHeight, active: 'ticker', label: `${t} technical analysis`, main });
}

export function technicalStatesBody({ minHeight = 1600, scheme = 'dark' } = {}) {
  const items = [
    { name: 'Loading', tag: null, when: 'The frame holds its final size with a 1px border; no fill, so nothing tints the attribution band, and nothing shifts when it draws.', html: `<div class="cq">${tvFrame({ height: 260, phoneHeight: 260, state: 'loading' })}</div>` },
    { name: 'Loader blocked', tag: null, id: 'TKR-05', when: 'A content blocker or the network stopped TradingView’s script. Info, not a warning: nothing on Convexa failed.', html: tvBlocked('NVDA') },
    { name: 'Demo build', tag: ['demo'], when: 'Staging keeps the authored sample-bar view; the widget loads only in live builds.', html: sampleBarView('NVDA') },
    { name: 'Ticker without a note', tag: null, when: 'The “Read research” link is left out; the overview link stays.', html: links('RKLB', false) },
    { name: 'Not embedded', tag: null, when: 'TradingView’s technical-rating gauge words its summary as buy and sell calls, so it is never embedded. Readings stay research.', html: `<div class="dna"><span class="caps">Left out on purpose</span><span class="dline">TradingView’s technical-rating gauge, which words its summary as calls to buy or sell.</span></div>` },
    { name: 'Privacy note', tag: null, when: 'Always under the frame, plain words.', html: tvNote() },
  ];
  return statesBoard({ scheme, minHeight, title: 'Technical tab · states', lead: 'TradingView’s chart on the live Technical tab: loading, a blocked loader, the demo build, a ticker without a note, what is deliberately not embedded, and the privacy note.', trace: 'TKR-05, TL-11, P-7', items });
}
