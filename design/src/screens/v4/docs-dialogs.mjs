// v4 · Methodology, Blog, Lab, 404 and route fallback; the dialogs (sign in, trade entry, order
// detail, what's sent, persona, view editor); the operator pages. Pages and their states boards.
import { fluidChart, icon, v4Nav, v4Notice, v4Page, wordmark } from '../../lib.mjs';
import { dataCell, gexBars, provChip, stateTag } from '../../components/data-states.mjs';
import { dlg, fld, overPage, seg, statesBoard, sw } from './kit.mjs';

export const DOCS_CSS = `
  .doc { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 48px; padding-top: 32px; align-items: start; }
  .doc nav { position: sticky; top: 80px; display: flex; flex-direction: column; gap: 2px; }
  .doc nav a { display: flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 8px; color: var(--steel); text-decoration: none; font-size: 13px; }
  .doc nav a[aria-current="true"] { color: var(--phosphor); background: var(--raised); font-weight: 600; }
  .doc article { max-width: 72ch; display: flex; flex-direction: column; gap: 18px; }
  .doc article h1 { margin: 0; font-size: clamp(32px, 3.4vw, 44px); letter-spacing: -0.02em; }
  .doc article h2 { margin: 24px 0 0; font-size: 24px; }
  .doc article p { margin: 0; font-size: 15.5px; line-height: 1.65; color: var(--steel); text-wrap: pretty; }
  .doc article p strong { color: var(--phosphor); }
  .lab-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 16px; }
  .ops-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 48px; padding: 8px 16px; border-bottom: 1px solid var(--line); background: var(--panel); }
  @media (max-width: 899px) { .doc { grid-template-columns: 1fr; gap: 16px; } .doc nav { position: static; flex-direction: row; overflow-x: auto; } .doc nav a { flex: 0 0 auto; min-height: 44px; } }
`;

// ---- Methodology ------------------------------------------------------------------------------------
const TOC = [['data', 'What’s live on this site'], ['speeds', 'Two data speeds'], ['structure', 'Dealer structure'], ['flip', 'Flip vs walls'], ['score', 'Score and tier'], ['advisory', 'Advisory reads'], ['ai', 'AI read and grounding'], ['sim', 'Simulation'], ['weak', 'Where the read is weak'], ['never', 'What Convexa never does'], ['vocab', 'Vocabulary']];
export function methodologyBody({ minHeight = 2800, scheme = 'dark' } = {}) {
  const tagRow = (k, w, txt) => `<div style="display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 12px; align-items: start; padding: 10px 0; border-top: 1px solid var(--line);">${stateTag(k, w)}<span class="dline" style="font-size: 13.5px;">${txt}</span></div>`;
  const art = `<article><h1 class="display">How Convexa works</h1><p>What the numbers mean, where they come from, and where the read is weak.</p>
    <h2 id="data" class="display">What’s live on this site</h2>
    <p>This site runs without a paid options feed. <strong>Everything built from public records is live</strong>: Treasury rates, CFTC futures positioning, FINRA short interest and short-sale volume, SEC filings, insider trades and reported figures, and the research notes. <strong>Everything built from the options chain is not live</strong>: dealer gamma and the flip, the walls, flows, implied volatility, the scanner’s scores and the AI read. Those panels say what they would show and offer a labelled sample.</p>
    <div>${tagRow('current', 'Updated', 'Current to its source, with the source’s date.')}${tagRow('delayed', 'Delayed by source', 'The source publishes late on a schedule; the tag says by how much.')}${tagRow('computed', 'Computed', 'Convexa computed it from public inputs it names.')}${tagRow('notLive', 'Not live', 'Needs the paid options feed this site doesn’t run.')}${tagRow('sample', 'Sample', 'An authored illustration. Never market data.')}${tagRow('unavailable', 'Source down', 'The source didn’t answer and nothing is cached: unknown, not empty.')}</div>
    <p>Daily prices are the one gate for technical analysis: computing them is free, but a price history licensed for public display has not been chosen yet.</p>
    <h2 id="speeds" class="display">Two data speeds</h2>
    <p>With the options feed on, prices stream while dealer structure is a snapshot refreshed about every 60 seconds. The structure is never drawn as live; only the mid moves.</p>
    <div class="hd-p is-sample">${stateTag('sample', 'Illustrative sample')}${gexBars('live', 140)}<span class="dline" style="font-size: 12px;">Net dealer gamma by strike, sample scenario of Oct 7, 2026. Not market data.</span></div>
    <h2 id="structure" class="display">Dealer structure</h2>
    <p>Net dealer gamma at each strike, summed across the expirations you choose. Positive gamma tends to damp moves; negative gamma tends to feed them. It is a model of hedging, not a forecast.</p>
    <h2 id="never" class="display">What Convexa never does</h2>
    <p>It never places, changes or cancels an order. Positions are simulated; a connected brokerage is read-only. Nothing here is investment advice.</p></article>`;
  const nav = `<nav aria-label="On this page">${TOC.map(([id, t], i) => `<a href="#${id}"${i === 0 ? ' aria-current="true"' : ''}>${t}</a>`).join('')}</nav>`;
  return v4Page({ scheme, minHeight, active: '', label: 'Methodology', main: `<div class="wrap doc">${nav}${art}</div>` });
}

export function blogBody({ minHeight = 1200, scheme = 'dark' } = {}) {
  const main = `<div class="wrap" style="padding-top: 32px; display: flex; flex-direction: column; gap: 20px;"><div><h1 class="display" style="margin: 0; font-size: clamp(32px, 3.4vw, 44px);">Blog</h1><p class="steel" style="margin: 8px 0 0; max-width: 60ch; font-size: 16px;">How we read structure, written down.</p></div>
    <a href="/blog/how-we-read-dealer-structure.html" class="hd-p" style="text-decoration: none; color: inherit; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: center;"><div style="display: flex; flex-direction: column; gap: 10px;"><span class="stag k-solid">Methodology</span><span class="display" style="font-size: 28px; line-height: 1.15;">How We Read Dealer Structure</span><span class="dline" style="font-size: 14px;">Walls, the flip and the magnet, and why each is a model of hedging rather than a prediction.</span><span class="t-info" style="display: inline-flex; gap: 6px; align-items: center; font-weight: 600;">Read the article ${icon('arrow', 14)}</span></div><div class="is-sample hd-p" style="padding: 12px;">${stateTag('sample', 'Illustrative')}${gexBars('live', 140)}</div></a>
    <p class="dline" style="margin: 0;">One article so far. New posts appear here; drafts are never listed.</p></div>`;
  return v4Page({ scheme, minHeight, active: '', label: 'Blog', main });
}

export function labBody({ minHeight = 1500, scheme = 'dark' } = {}) {
  const demos = [['Structure Field', 'On the ticker desk', 'The diverging field of net dealer gamma, the hero of every desk.'], ['Tape Pulse', 'Candidate', 'The mid’s recent path as a pulse strip.'], ['Wall Magnet', 'Candidate', 'Where the mid sits between the walls, as a magnet.'], ['Term Heat', 'Candidate', 'Implied volatility by tenor as a heat ribbon.'], ['Flow Ribbons', 'Candidate', 'Dealer flow projected to the next expiry.']];
  const main = `<div class="wrap" style="padding-top: 32px; display: flex; flex-direction: column; gap: 20px;"><div><h1 class="display" style="margin: 0; font-size: clamp(32px, 3.4vw, 44px);">Instrument lab</h1><p class="steel" style="margin: 8px 0 0; max-width: 64ch; font-size: 16px;">Instrument candidates running on synthetic data, so you can judge the drawing before it lands on a desk.</p></div>
    <div class="lab-grid">${demos.map(([n, st, d], i) => `<a href="/lab/${n.toLowerCase().replace(' ', '-')}" class="hd-p is-sample" style="text-decoration: none; color: inherit;"><div class="ph"><h3>${n}</h3>${stateTag('sample', 'Synthetic')}</div>${gexBars(i % 2 ? 'outline' : 'live', 90)}<span class="dline">${d}</span><span class="stag k-solid">${st}</span></a>`).join('')}</div>
    <section class="hd-p"><div class="ph"><h3>Structure Field · real SPY structure</h3>${stateTag('notLive')}</div><span class="dline">The button that loads SPY’s real structure needs the options feed, which isn’t live on this site. The synthetic field above shows the same drawing.</span><button class="btn secondary" type="button" disabled style="align-self: flex-start;">Use live SPY structure</button></section></div>`;
  return v4Page({ scheme, minHeight, active: '', label: 'Lab', main });
}

export function notFoundBody({ minHeight = 900, scheme = 'dark' } = {}) {
  const main = `<div class="wrap" style="padding: 96px 0 64px; display: flex; flex-direction: column; gap: 16px; max-width: 640px;"><span class="mono steel" style="font-size: 16px;">404</span><h1 class="display" style="margin: 0; font-size: clamp(32px, 4vw, 48px);">Nothing at this address.</h1><p class="steel" style="margin: 0; font-size: 16px; line-height: 1.6;">The address may be old or mistyped. Ticker desks need no account; research, rates and filings are open to everyone.</p><div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;"><a href="/ticker/NVDA" class="btn primary">Open a ticker desk</a><a href="/research" class="btn secondary">Go to Research</a><span class="steel" style="font-size: 13px;">or press <span class="kbd">⌘K</span> to jump</span></div></div>`;
  return v4Page({ scheme, minHeight, active: '', label: 'Not found', main });
}

export function docsStatesBody({ minHeight = 1900, scheme = 'dark' } = {}) {
  const items = [
    { name: 'Route loading', tag: null, id: 'DOC-05', when: 'A lazy route waits under the real nav with a page-shaped skeleton; no centered spinner.', html: `${v4Nav({ active: 'research' })}<div style="display: flex; flex-direction: column; gap: 12px; padding: 16px 0;"><span class="skel" style="height: 40px; width: 40%;"></span><span class="skel" style="height: 16px; width: 70%;"></span><span class="skel" style="height: 220px;"></span></div>` },
    { name: 'Page could not load', tag: ['error'], when: 'The route boundary names the cause and offers Retry and a public page.', html: `<div class="hd-p"><div class="ph"><h3>This page could not load</h3>${stateTag('error')}</div><span class="dline">Its code didn’t arrive (the network dropped mid-load). Retry, or go to Research, which loads on its own.</span><div style="display: flex; gap: 10px;"><button class="btn secondary" type="button">${icon('refresh', 14)}Retry</button><a href="/research" class="btn ghost">Go to Research</a></div></div>` },
    { name: 'Methodology · deep link', tag: null, id: 'DOC-01', when: '/methodology#data lands on “What’s live on this site” with the TOC entry current; the notice links here.', html: `<nav style="display: flex; flex-direction: column; gap: 2px;">${TOC.slice(0, 4).map(([id, t], i) => `<a href="#${id}" style="display: flex; min-height: 36px; align-items: center; padding: 0 12px; border-radius: 8px; color: ${i === 0 ? 'var(--phosphor)' : 'var(--steel)'}; background: ${i === 0 ? 'var(--raised)' : 'transparent'}; text-decoration: none; font-weight: ${i === 0 ? 600 : 400};">${t}</a>`).join('')}</nav>` },
    { name: 'Lab · live button off', tag: ['notLive'], id: 'DOC-03', when: 'Disabled with its reason as text, not a silent failure.', html: `<span class="dline">The button that loads SPY’s real structure needs the options feed, which isn’t live on this site.</span><button class="btn secondary" type="button" disabled style="align-self: flex-start;">Use live SPY structure</button>` },
    { name: 'Blog · no articles', tag: ['empty'], when: 'If the index is ever empty, it says what will appear.', html: `<div class="hd-p" style="border-style: dashed;"><strong>No articles yet.</strong><span class="dline">Posts on how Convexa reads structure appear here.</span></div>` },
    { name: 'Demo build', tag: ['demo'], when: 'Static pages wear the demo bar and nothing else changes.', html: v4Notice('demo') },
  ];
  return statesBoard({ scheme, minHeight, title: 'Methodology, Blog, Lab, 404 · states', lead: 'Static pages have few states: the route’s loading and failure, the methodology deep link the notice uses, the Lab’s not-live control, and the demo bar.', trace: 'DOC-01–DOC-05', items });
}

// ---- Dialogs -----------------------------------------------------------------------------------------
export function signInDlg() {
  return dlg({ title: 'Welcome back', body: `<p class="dline" style="margin: 0; font-size: 13.5px;">Sign in to sync your settings and AI key. New sign-ups are closed while Convexa is in private testing.</p>${fld('Email', '<span class="steel">you@email.com</span>', { help: 'autocomplete="email" · paste and password managers work' })}${fld('Password', '••••••••••', { focus: true })}<button class="btn primary lg" type="button" style="width: 100%;">Sign in</button><div style="display: flex; align-items: center; gap: 10px; color: var(--steel); font-size: 12px;"><span style="flex: 1; height: 1px; background: var(--line);"></span>or<span style="flex: 1; height: 1px; background: var(--line);"></span></div><button class="btn secondary lg" type="button" disabled style="width: 100%;">Continue with Google</button><span class="dline">Google sign-in isn’t available yet — use your email and password.</span>` });
}
export function tradeEntryDlg() {
  return dlg({ title: 'Open simulated position · NVDA', chip: '<span class="stag k-solid">SIMULATED</span>', wide: true, body: `<div class="fld">Fill${seg([['Manual price', false], ['Market', true], ['Limit', true]], 'Manual price')}<span class="help">Market and Limit fill at a live quote, which needs the options feed. Manual price opens at your price: user-entered, not a market quote.</span></div>
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;">${fld('Side', 'Buy')}${fld('Expiration', 'Nov 21', { mono: true })}${fld('Strike', '240', { mono: true })}${fld('Right', 'Call')}</div>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">${fld('Quantity', '1', { mono: true })}${fld('Price per contract', '6.80', { mono: true, focus: true })}</div>
    <div class="hd-fig" style="grid-template-columns: repeat(3, minmax(0, 1fr));"><div><span class="caps">Net debit</span><span class="v">$680</span></div><div><span class="caps">Max loss</span><span class="v">$680</span></div><div><span class="caps">Cap check</span><span class="v" style="font-size: 15px;">over $500</span></div></div>
    <div class="dwarn">${icon('warn', 14)}<span class="dline" style="font-size: 12.5px; color: var(--phosphor);">Max loss $680 is above your $500 per-trade cap. You can still open it; the book will flag it.</span></div>`, foot: `<span class="dline" style="flex: 1 1 260px;">Paper trade — no broker, no real money. Nothing is saved until you confirm.</span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Open simulated position</button>` });
}
export function orderDetailDlg() {
  return dlg({ title: 'Simulated order · NVDA 240C', chip: '<span class="stag k-solid">SIMULATED</span>', body: `<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">${stateTag('notLive', 'Not evaluated')}<span class="dline">Triggers need the live tape, which isn’t on this site. The plan below stays as placed.</span></div><div class="hd-fig" style="grid-template-columns: repeat(2, minmax(0, 1fr));"><div><span class="caps">Source</span><span class="v" style="font-size: 14px;">AI read · Balanced Swinger</span></div><div><span class="caps">Trigger</span><span class="v" style="font-size: 14px;">NVDA above 230.00</span></div><div><span class="caps">Entry</span><span class="v" style="font-size: 14px;">Limit 6.80</span></div><div><span class="caps">Stop · target</span><span class="v" style="font-size: 14px;">3.40 · 13.60</span></div></div><span class="caps">The read’s own words</span><p class="dline" style="margin: 0; font-style: italic;">“Wait for a hold above 230 before adding exposure; size to the cap.”</p><span class="caps">Lifecycle</span><div class="drows"><div style="grid-template-columns: 90px minmax(0, 1fr);"><span class="mono steel">Oct 8 15:52</span><span>Placed · good til Nov 21</span></div><div style="grid-template-columns: 90px minmax(0, 1fr);"><span class="mono steel">—</span><span class="steel">Not triggered</span></div></div>`, foot: `<span class="dline" style="flex: 1 1 240px;">Stored in this browser · never sent to a broker</span><button class="btn secondary" type="button">Cancel order</button><button class="btn ghost" type="button">Close</button>` });
}
export function whatsSentDlg({ sample = false } = {}) {
  return dlg({ title: 'What’s sent to the AI · NVDA', drawer: true, chip: sample ? stateTag('sample', 'Sample export') : '', body: sample
    ? `<p class="dline" style="margin: 0;">A sample of exactly what a read sends, from the Oct 7 scenario. Nothing here is market data and nothing was sent.</p>${['Computed snapshot', 'Candidate contracts', 'Your risk inputs · what the next request will send', 'Open positions', 'Persona prompt'].map((s, i) => `<details class="hd-p is-sample" style="gap: 6px;"${i === 0 ? ' open' : ''}><summary style="cursor: pointer; font-weight: 600; min-height: 32px; display: flex; align-items: center;">${s}</summary>${i === 0 ? '<pre class="mono" style="margin: 0; font-size: 11.5px; color: var(--steel); white-space: pre-wrap;">ticker: NVDA (sample)\nlevels: call_wall 240.00 · gamma_flip 221.50 · put_wall 210.00\nnet_gex: +$1.94B · iv_hv: 1.08 · term: contango</pre>' : ''}</details>`).join('')}`
    : `<div class="hd-p" style="gap: 8px;"><div class="ph"><h3>Nothing is sent right now</h3>${stateTag('notLive')}</div><span class="dline" style="font-size: 13px;">A read sends the computed snapshot, candidate contracts, your risk inputs, open positions and your persona. The snapshot needs the options feed, which isn’t live on this site, so no read runs and nothing leaves.</span><button class="btn secondary" type="button" style="align-self: flex-start;">Show a sample export</button></div><span class="caps">What would be sent from your side</span><div class="drows">${[['Risk inputs', '$25,000 · 2% cap'], ['Open positions', '3 · SPY, NVDA, QQQ'], ['Persona', 'Balanced Swinger']].map(([a, b]) => `<div style="grid-template-columns: minmax(0, 1fr) auto;"><span class="steel">${a}</span><span class="mono">${b}</span></div>`).join('')}</div>`, foot: `<button class="btn secondary" type="button"${sample ? '' : ' disabled'}>${icon('copy', 14)}Copy all</button><span class="dline">${sample ? 'Copies the sample, labelled as one.' : 'Copy is off: there is nothing to copy.'}</span>` });
}
export function personaDlg() {
  return dlg({ title: 'Customize persona', body: `<p class="dline" style="margin: 0;">Personas brief the AI read on your style. Reads need the options feed, which isn’t live on this site; your persona saves and waits.</p>${fld('Based on', 'Balanced Swinger')}<div class="fld">Risk level${seg(['Conservative', 'Moderate', 'Aggressive'], 'Moderate')}</div><div class="fld">Lean${seg(['Lean exit or trim', 'Balanced', 'More open to add'], 'Balanced')}</div>${fld('Emphasis note', 'Prefer defined-risk spreads around results.', { help: 'Adds framing emphasis only; it never changes the numbers.' })}${fld('Persona name', 'Results-week swinger', { focus: true })}`, foot: `<span style="flex: 1;"></span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Save persona</button>` });
}
export function viewEditorDlg() {
  const uni = ['AAPL', 'AMD', 'AMZN', 'AVGO', 'COIN', 'GOOGL', 'META', 'MSFT'];
  const mine = ['NVDA', 'SPY', 'QQQ', 'TSLA'];
  return dlg({ title: 'Edit your scan view', wide: true, body: `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;"><div class="fld">Tracked universe · 69<div class="drows">${uni.map((s, i) => `<div style="grid-template-columns: 24px minmax(0, 1fr) auto;"><span class="sw${i === 1 ? ' on' : ''}" style="width: 20px; height: 20px; border-radius: 5px; padding: 0; justify-content: center;" role="checkbox" aria-checked="${i === 1}">${i === 1 ? icon('check', 14) : ''}</span><span class="mono">${s}</span><span class="steel" style="font-size: 11px;">${i === 1 ? 'added' : ''}</span></div>`).join('')}</div></div><div class="fld">In your view · display order<div class="drows">${mine.map((s, i) => `<div style="grid-template-columns: 24px minmax(0, 1fr) auto;"><span class="steel">${icon('grip', 14)}</span><span class="mono">${s}</span><span style="display: inline-flex; gap: 4px;"><button class="btn ghost sm" type="button" aria-label="Move ${s} up"${i === 0 ? ' disabled' : ''}>${icon('chevronU', 14)}</button><button class="btn ghost sm" type="button" aria-label="Move ${s} down"${i === mine.length - 1 ? ' disabled' : ''}>${icon('chevron', 14)}</button></span></div>`).join('')}</div></div></div>${fld('View name (optional)', 'Results week')}`, foot: `<span class="dline" style="flex: 1 1 240px;">Saved views need a sign-in.</span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Save view</button>` });
}
export const DIALOGS = {
  'sign-in': { make: signInDlg, active: 'positions', title: 'Sign in' },
  'trade-entry': { make: tradeEntryDlg, active: 'ticker', title: 'Trade entry' },
  'order-detail': { make: orderDetailDlg, active: 'positions', title: 'Order detail' },
  'whats-sent': { make: whatsSentDlg, active: 'ticker', title: 'What’s sent drawer', right: true },
  persona: { make: personaDlg, active: 'ticker', title: 'Persona' },
  'view-editor': { make: viewEditorDlg, active: 'scanner', title: 'Scan view editor' },
};
export const dialogBody = (key) => ({ minHeight = 1000, scheme = 'dark' } = {}) => overPage({ scheme, minHeight, active: DIALOGS[key].active, right: DIALOGS[key].right, dialog: DIALOGS[key].make() });

export function dialogStatesBody(key) {
  const S = {
    'sign-in': [
      { name: 'Wrong credentials', tag: ['error'], when: 'Inline, under the form, saying what to check.', html: dlg({ title: 'Welcome back', body: `${fld('Email', 'r@…', {})}${fld('Password', '••••••', { err: 'Those credentials didn’t match. Check your email and password and try again.' })}<button class="btn primary" type="button" style="width: 100%;">Sign in</button>` }) },
      { name: 'Signing in', tag: null, when: 'The button keeps its width and blocks a double submit.', html: `<button class="btn primary lg" type="button" disabled style="width: 100%; opacity: 1;"><span class="skel" style="width: 14px; height: 14px; border-radius: 50%;"></span>Signing in…</button>` },
      { name: 'Sign-in service down', tag: ['unavailable'], when: 'Says the service is down, not the password.', html: `<div class="dwarn">${icon('warn', 14)}<span class="dline" style="color: var(--phosphor);">Couldn’t reach sign-in right now. Please try again in a moment.</span></div>` },
      { name: 'Wall · scanner, signed out', tag: ['locked'], id: 'POS-03', when: 'The wall says sign-ups are closed and points to what is open.', html: dataCell({ fam: 'table', state: 'locked', w: '100%', h: 'auto' }) },
      { name: 'Demo build', tag: ['demo'], id: 'SHL-05', when: 'Sign-in connections are off in the demo, and the dialog says so instead of doing nothing.', html: `<div class="hd-p"><div class="ph"><h3>Sign in</h3>${provChip('Demo · sample data', 'dashed')}</div><span class="dline">Sign-in is unavailable in the public demo. Everything here works without it and resets with Reset Demo.</span></div>` },
    ],
    'trade-entry': [
      { name: 'Market and Limit off', tag: ['notLive'], id: 'DLG-01', when: 'The fill modes say why; Manual price is selected.', html: dataCell({ fam: 'dialog', state: 'notLive', w: '100%', h: 'auto' }) },
      { name: 'Chain didn’t load', tag: ['error'], when: 'Shipped copy.', html: dataCell({ fam: 'dialog', state: 'error', w: '100%', h: 'auto' }) },
      { name: 'Risk cap not set', tag: ['notConfigured', 'not set'], when: 'The cap check reads “not set” and links to Settings.', html: dataCell({ fam: 'dialog', state: 'notConfigured', w: '100%', h: 'auto' }) },
      { name: 'Signed out', tag: ['locked'], when: 'Shipped refusal, verbatim.', html: dataCell({ fam: 'dialog', state: 'locked', w: '100%', h: 'auto' }) },
      { name: 'Demo build', tag: ['demo'], when: 'Paper trade on the sample chain, stored in this browser.', html: dataCell({ fam: 'dialog', state: 'demo', w: '100%', h: 'auto' }) },
      { name: 'Phone sheet', tag: null, when: 'Under 600px the dialog is a bottom sheet; actions stack at 44px.', html: dataCell({ fam: 'dialog', state: 'current', phone: true, w: '100%', h: 'auto' }) },
    ],
    'order-detail': [
      { name: 'Watching (feed on)', tag: ['live', 'Watching'], when: 'Only while the tape streams.', html: `<div class="drows"><div style="grid-template-columns: 90px minmax(0, 1fr);"><span class="mono steel">10:42</span><span>Watching · NVDA mid 228.40, trigger 230.00</span></div></div>` },
      { name: 'Not evaluated', tag: ['notLive', 'Not evaluated'], id: 'DLG-02', when: 'Quiet tag, plan unchanged.', html: `<span class="dline">Triggers need the live tape, which isn’t on this site. The plan stays as placed.</span>` },
      { name: 'Filled', tag: ['local', 'Filled'], when: 'Links to the position it opened.', html: `<div class="drows"><div style="grid-template-columns: 90px minmax(0, 1fr) auto;"><span class="mono steel">Oct 6 10:02</span><span>Filled at limit 6.80</span><a href="/positions" class="t-info">View position</a></div></div>` },
      { name: 'Store unreadable', tag: ['error'], when: 'Orders unavailable; nothing deleted.', html: `<div class="dwarn">${icon('warn', 14)}<span class="dline" style="color: var(--phosphor);">Orders unavailable — Convexa couldn’t read them from this browser. Nothing was deleted; reload to try again.</span></div>` },
    ],
    'whats-sent': [
      { name: 'Nothing sent (default)', tag: ['notLive'], id: 'DLG-03', when: 'Says why nothing leaves; your side of the payload is listed.', html: whatsSentDlg().replace('class="v4dlg drawer"', 'class="v4dlg"') },
      { name: 'Sample export', tag: ['sample'], when: 'Hatched sections, labelled; Copy copies the label too.', html: whatsSentDlg({ sample: true }).replace('class="v4dlg drawer"', 'class="v4dlg"') },
      { name: 'Copied', tag: null, when: 'The button confirms for 1.5 s, announced politely.', html: `<button class="btn secondary" type="button" aria-live="polite">${icon('check', 14)}Copied</button>` },
    ],
    persona: [
      { name: 'Picker', tag: null, when: 'Presets, customs and Customize…; the current one checked by mark and weight.', html: `<div class="pal" style="width: 100%;" role="listbox" aria-label="Persona">${['Default (no persona)', 'Income Keeper', 'Steady Swinger', 'Balanced Swinger', 'Momentum Rider', 'The Protector', 'Results-week swinger', 'Customize…'].map((p, i) => `<div class="opt" role="option" aria-selected="${i === 3}" style="display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; align-items: center; min-height: 40px; padding: 6px 12px; ${i === 3 ? 'font-weight: 600; background: var(--raised-2);' : ''}">${i === 3 ? icon('check', 14) : '<span></span>'}<span>${p}</span></div>`).join('')}</div>` },
      { name: 'Save failed', tag: ['error'], when: 'Inline; the form keeps what you typed.', html: `<div class="dwarn">${icon('warn', 14)}<span class="dline" style="color: var(--phosphor);">Couldn’t save that persona. Please try again; your edits are still here.</span></div>` },
    ],
    'view-editor': [
      { name: 'Universe unavailable', tag: ['unavailable'], when: 'Shipped copy.', html: `<div class="dwarn">${icon('warn', 14)}<span class="dline" style="color: var(--phosphor);">The tracked universe is unavailable this cycle. Try again shortly.</span></div>` },
      { name: 'Save failed', tag: ['error'], when: 'Shipped copy.', html: `<div class="dwarn">${icon('warn', 14)}<span class="dline" style="color: var(--phosphor);">Could not save that view. Please try again.</span></div>` },
      { name: 'Signed out', tag: ['locked'], when: 'The view lasts for the session.', html: dataCell({ fam: 'form', state: 'locked', w: '100%', h: 'auto' }) },
    ],
  };
  const T = { 'sign-in': 'Sign in · states', 'trade-entry': 'Trade entry · states', 'order-detail': 'Order detail · states', 'whats-sent': 'What’s sent · states', persona: 'Persona · states', 'view-editor': 'Scan view editor · states' };
  const tr = { 'sign-in': 'DLG-04, POS-03, SHL-05', 'trade-entry': 'DLG-01', 'order-detail': 'DLG-02', 'whats-sent': 'DLG-03', persona: 'DLG-05', 'view-editor': 'DLG-06' };
  return ({ minHeight = 1500, scheme = 'dark' } = {}) => statesBoard({ scheme, minHeight, title: T[key], lead: 'Every state this overlay can be in, with shipped copy where it exists.', trace: tr[key], items: S[key] });
}

// ---- Operator --------------------------------------------------------------------------------------
export function operatorBody({ minHeight = 1300, scheme = 'dark' } = {}) {
  const C = { vendor_fetch: '#4e79a7', engine_build: '#f28e2b', off_exchange: '#59a14f', signals: '#b07aa1' };
  const series = { vendor_fetch: [420, 410, 455, 430, 418, 440, 462, 451], engine_build: [180, 176, 190, 185, 182, 188, 195, 191], off_exchange: [90, 88, 96, 92, 89, 94, 99, 97], signals: [40, 38, 41, 40, 39, 42, 44, 43] };
  const short = { vendor_fetch: 'fetch', engine_build: 'build', off_exchange: 'off-exch', signals: 'signals' };
  const chart = fluidChart({ height: 230, pl: 40, pr: 150, prn: 92, xmin: 0, xmax: 7, ymin: 0, ymax: 500, aria: 'p95 latency by stage over the last 8 hours: vendor fetch about 450 ms, engine build 190, off-exchange 97, signals 43', yTicks: [0, 250, 500].map((v) => ({ v, label: String(v) })), xTicks: [{ v: 0, label: '−8 h' }, { v: 7, label: 'now' }], series: Object.entries(series).map(([k, v]) => ({ points: v.map((n, i) => [i, n]), stroke: C[k], end: { long: `${k} ${v[7]} ms`, short: `${short[k]} ${v[7]}` }, endColor: 'var(--phosphor)' })) });
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="ops-bar">${wordmark(14)}<span class="stag k-solid">operator</span><span class="mono steel" style="font-size: 12px;">/_ops/metrics</span><span style="flex: 1;"></span><span class="dline only-wide">Instrumentation on · read-only · off the trader shell</span></div>
    <main class="wrap" style="padding-top: 24px; display: flex; flex-direction: column; gap: 16px;"><h1 class="display" style="margin: 0; font-size: 30px;">Operator metrics</h1>
      <section class="hd-p"><div class="ph"><h3>Vendor fetch is most of the bundle’s p95 time: about 450 ms of 780.</h3>${stateTag('current', 'Rolling 8 h')}</div><p class="sub" style="margin: 0;">p95 latency by bundle stage, ms. Diagnostic series use the non-brand categorical palette (chartCategorical), labelled at the line ends.</p>${chart}</section>
      <section class="hd-p"><div class="ph"><h3>Session archive</h3><span class="mono steel" style="font-size: 12px;">/_ops/research</span></div><span class="dline">Stored session books, unlocked with the API origin and the metrics token. Renamed on screen so it never reads as the trader-facing Research section.</span><div class="drows">${[['2026-10-08', 'massive', '15:59:58 ET'], ['2026-10-07', 'massive', '15:59:57 ET'], ['2026-10-06', 'massive', '15:59:59 ET']].map(([d, s, t]) => `<div style="grid-template-columns: 120px 100px minmax(0, 1fr);"><span class="mono">${d}</span><span class="steel">${s}</span><span class="mono steel">${t}</span></div>`).join('')}</div></section></main></div>`;
}
export function operatorStatesBody({ minHeight = 1300, scheme = 'dark' } = {}) {
  const items = [
    { name: 'Locked', tag: ['locked', 'Token needed'], when: 'The archive asks for the API origin and the metrics token.', html: `${fld('API origin', 'https://api.convexa…', { mono: true })}${fld('Metrics token', '••••••••', { mono: true })}<button class="btn secondary" type="button" style="align-self: flex-start;">Unlock</button>` },
    { name: 'Instrumentation off', tag: ['off'], when: 'Says nothing is recorded, and why.', html: `<span class="dline">Instrumentation disabled — no metrics are being recorded. Turn it on in the API’s configuration to collect a baseline.</span>` },
    { name: 'Readout unavailable', tag: ['unavailable'], when: 'The trader site is unaffected, and the page says so.', html: `<div class="dwarn">${icon('warn', 14)}<span class="dline" style="color: var(--phosphor);">Metrics readout unavailable. Operator tool only — the trader bundle and stream are unaffected.</span></div>` },
    { name: 'No requests yet', tag: ['empty'], when: 'Teaches how to get a baseline.', html: `<span class="dline">No requests recorded yet — serve a bundle to populate the baseline.</span>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Operator · states', lead: 'Off the trader shell, URL-only. The states an operator can meet.', trace: 'OPS-01, OPS-02', items });
}
