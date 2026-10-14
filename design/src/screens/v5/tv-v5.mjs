// v5 wave 3 · TradingView, framed on every screen that uses it, and where a frame would or would not
// belong. Canon: Amendments 2026-10-13 "Third-party embeds" (+ the owner's rulings: candles kept). The
// frame is TradingView's: its palette and attribution stand; Convexa adds a name (never a claim), a dotted
// chip, a fence with an inset well, a privacy line, a loading state in words and a timeout.
import { icon } from '../../lib.mjs';
import { thirdPartyFrame } from '../../components/charts.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { TV_CHIP, sampleBarView } from '../../components/tradingview.mjs';
import { sec, v5Head, v5Wrap } from './system.mjs';

export const TV5_CSS = `@media (max-width: 899px) { .tvdesk { grid-template-columns: minmax(0, 1fr) !important; } }`;
const tabs = (on = 'Technical') => `<nav aria-label="NVDA" class="hd-tabs">${['Overview', 'Technical', 'Research'].map((t) => `<a href="/ticker/NVDA${t === 'Overview' ? '' : t === 'Technical' ? '/technical-analysis' : '/research'}"${t === on ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
const facade = (h = 420) => `<section class="tpf" aria-label="NVDA daily chart by TradingView"><div class="tpf-h"><h3 class="tpf-name">NVDA daily chart</h3>${provChip(TV_CHIP, 'dotted')}</div><div class="tpf-fence"><div style="height: ${h}px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center;"><span style="display: inline-flex; color: var(--steel);">${icon('external', 20)}</span><strong style="font-size: 15px;">TradingView’s chart loads when you ask</strong><span class="dline" style="max-width: 420px;">Loading it sends TradingView your IP address and this page’s address. Convexa reads nothing from it.</span><button class="btn secondary" type="button">Load TradingView’s chart</button><label style="display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--steel); min-height: 24px;"><input type="checkbox" style="width: 16px; height: 16px; accent-color: var(--phosphor);"> Always load it on this browser</label></div></div></section>`;

const PLACES = [
  ['Technical tab', 'Yes · shipped', 'The one place a reader comes for price action. The frame is the page’s subject, named and fenced, with Convexa’s own readings marked not live beside it.', 'Keep; add the loading words, the timeout and the reset per symbol.'],
  ['Desk overview · price panel', 'Yes · as v4 drew it (TV-02)', 'Convexa holds no price of its own; the desk needs one picture of price beside the public panels. One frame, 520 tall (420 on a phone), below the masthead.', 'Keep one frame per page: a second frame doubles the requests and the privacy cost for no new answer.'],
  ['Research note', 'No', 'A note values a company from its own dated price; a live third-party chart beside a dated thesis invites reading the thesis against today’s price with no provenance tying the two.', 'A link: “Price action on the Technical tab”, and the note’s own dated price in its header.'],
  ['Scanner', 'No', 'Sixty-nine rows would mean sixty-nine frames: each loads TradingView’s script and an iframe and sends the reader’s IP. Rows compare names on Convexa’s own figures.', 'A link-out per row on focus (“Open on TradingView”); nothing embedded.'],
  ['Markets', 'No', 'Treasury and CFTC data are primary sources Convexa draws itself; a third-party chart there would blur which numbers are Convexa’s.', 'Nothing; Markets stays first-party.'],
  ['Landing', 'No', 'The landing has exactly one hero instrument (canon), Convexa’s own model.', 'Nothing.'],
  ['Alerts and the research index', 'No', 'Fired alerts and cards point somewhere; they are not the place to read price.', 'Links into the Technical tab.'],
];

export function tvFramingBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const page = `<div class="hd-p" style="gap: 16px; padding: 22px 24px;"><div style="display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: flex-end;"><div style="flex: 999 1 420px; display: flex; flex-direction: column; gap: 6px;"><span class="caps">Technical analysis · NVDA</span><span class="dline" style="font-size: 13.5px;">Exponential 20- and 50-day averages and RSI 14, drawn by TradingView from its own prices. They describe the trend; they are not calls to buy or sell.</span></div>${tabs()}</div>${thirdPartyFrame({ height: 560 })}</div>`;
  const changes = `<div class="v5g3">${[
    ['A name, never a claim', '“NVDA daily chart”. Convexa states findings about data it computed; it reads nothing from this frame, so it names it.'],
    ['A fence with an inset well', 'Dotted, 8px of well between TradingView’s palette and Convexa’s chrome. Tokens in both schemes (the design source hard-coded a dark rgba).'],
    ['Loading in words, at final size', '“Loading TradingView’s chart…” in the reserved box. The shipped box is empty until the script draws.'],
    ['A timeout', 'Blocked after a script error or 12 s without the iframe; the shipped embed waits forever on a stall. The state resets when the symbol changes.'],
    ['The privacy line names what is sent', 'Your IP address and this page’s address. The proposal below loads the frame only on request (P-14).'],
    ['Candles kept', 'The owner’s ruling: TradingView’s frame shows candles, not a line, in TradingView’s colours.'],
  ].map(([t, d]) => `<div class="v5card"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>`;
  const states = `<div class="v5g2"><div class="pitem"><div class="ph"><b>Loading</b></div>${thirdPartyFrame({ state: 'loading', height: 260 })}</div><div class="pitem"><div class="ph"><b>Blocked or timed out</b></div>${thirdPartyFrame({ state: 'blocked' })}<p class="pc">Also after 12 s without the frame; resets when the symbol changes.</p></div><div class="pitem"><div class="ph"><b>Load on request (proposal P-14)</b></div>${facade(300)}<p class="pc">Nothing is sent to TradingView until the reader asks; the choice can be remembered in this browser. A product decision for the owner: it trades one click for not loading a third party on view.</p></div><div class="pitem"><div class="ph"><b>Demo build</b>${stateTag('demo')}</div>${sampleBarView()}<p class="pc">The demo keeps its authored sample bars; no frame loads.</p></div></div>`;
  const desk = `<div class="hd-p" style="gap: 14px; padding: 20px 22px;"><div class="ph"><h3>NVDA · price</h3>${stateTag('thirdParty')}</div><div style="display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 16px; align-items: start;" class="tvdesk">${thirdPartyFrame({ height: 420, mini: true })}<div class="hd-p" style="gap: 8px;"><div class="ph"><h3>Readings Convexa would compute</h3><span class="stag k-quiet">${icon('notlive', 12)}Not live · price source</span></div><span class="dline">Trend, momentum, relative strength and realized vol need a daily price history licensed to Convexa. None of them is read from the frame beside it.</span></div></div></div>`;
  const where = `<div class="v5tw"><table class="v5tbl"><thead><tr><th>Screen</th><th>A TradingView frame?</th><th>Why</th><th>Instead</th></tr></thead><tbody>${PLACES.map(([s, y, w, i]) => `<tr><td class="p">${s}</td><td class="${y.startsWith('Yes') ? 'p' : ''}">${y}</td><td>${w}</td><td>${i}</td></tr>`).join('')}</tbody></table></div>`;
  return v5Wrap(`${v5Head('TradingView, framed', 'TradingView’s frame stays TradingView’s: its candles, its colours, its attribution. Convexa’s part is the frame around it, and the decision of where a frame belongs at all.', 'TT-01, DB-15, TV-01–TV-05, Amendments 2026-10-13 “Third-party embeds”, the owner’s ruling on candles')}
    ${sec('On the Technical tab', '', page)}
    ${sec('What changes, and why', '', changes)}
    ${sec('The frame’s states', '', states)}
    ${sec('On the desk', 'The desk’s one picture of price, with Convexa’s own readings honestly not live beside it.', desk)}
    ${sec('Where a frame belongs', '', where)}`, { scheme, minHeight });
}
