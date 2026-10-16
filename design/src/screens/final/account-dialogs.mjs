// Final · Convexa v1 — account group: the overlays. Staging versions are drawn on the demo account's seed
// (SPY at 690.62 on the Oct 7 scenario, the $25,000 / 2% risk seed, the "Careful sample reader" persona);
// sign in is production only (staging has no sign-in anywhere). Production words for each overlay's
// Not live state live on the states board. Copy reuses the shipped strings (features/trading/orders/
// copy.ts D8 disclosures, features/trading/positions/labels.ts DISCLAIMER, pages/scanner/labels.ts).
import { STAGING_DEMO_URL, icon, v4Nav, v4Notice } from '../../lib.mjs';
import { dataCell, provChip, stateTag } from '../../components/data-states.mjs';
import { dlg, fld, overPage, seg, statesBoard } from '../v4/kit.mjs';
import { signInDlg } from '../v4/docs-dialogs.mjs';

export const DLG_CSS = `
  .ac-sheets { padding: 24px 0 40px; display: flex; flex-direction: column; gap: 28px; }
  .ac-sheets > header { padding: 0 16px; display: flex; flex-direction: column; gap: 6px; }
  .ac-sheets > header h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
  .ac-sheet { display: flex; flex-direction: column; gap: 8px; }
  .ac-sheet > .cap { padding: 0 16px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
  .ac-sheet > .cap b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 16px; }
  .ac-sheet > .scr { background: var(--scrim); padding-top: 56px; display: flex; flex-direction: column; justify-content: flex-end; }
  .ac-sheet .v4dlg { width: 100%; border-radius: 16px 16px 0 0; }
  .ac-sheet .v4dlg .dh { position: relative; padding-top: 22px; }
  .ac-sheet .v4dlg .dh::before { content: ''; position: absolute; top: 8px; left: 50%; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: var(--line-2); }
  .ac-sheet .v4dlg .dh .btn { flex: 0 0 auto; }
  .ac-sheet .v4dlg .df .btn { flex: 1 1 100%; min-height: 44px; }
  .ac-sheet .ac-g4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .ac-fill { display: flex; flex-wrap: wrap; gap: 6px; }
`;

/** A staging page with an overlay: the demo bar and the demo account behind the scrim (never "Sign in"). */
export function overDemo({ scheme = 'dark', minHeight = 900, active = '', dialog, right = false }) {
  const behind = `<div class="v4-behind" aria-hidden="true">${v4Notice('demo')}${v4Nav({ active, demo: true })}<div class="wrap" style="padding-top: 28px; display: flex; flex-direction: column; gap: 16px;"><span class="skel" style="height: 44px; width: 38%;"></span><span class="skel" style="height: 300px; width: 100%;"></span><span class="skel" style="height: 120px; width: 100%;"></span><span class="skel" style="height: 220px; width: 100%;"></span></div></div>`;
  return `<div class="v4" data-scheme="${scheme}" style="position: relative; width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); overflow: hidden;">${behind}<div class="v4-over${right ? ' right' : ''}">${dialog}</div></div>`;
}

const SIM = '<span class="stag k-solid">SIMULATED</span>';
const DISCLAIMER = 'Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and assignment are not modeled.';
const D8_1 = (t) => `Simulated only — no real order is ever placed. Once confirmed, this order can trigger and fill unattended whenever a live stream for ${t} is open in this browser. Orders are stored in this browser — not synced to your account.`;

export function tradeEntryDemo({ order = false } = {}) {
  const fill = order
    ? `<div class="fld">Entry${seg(['Market on trigger', 'Limit'], 'Limit')}<span class="help">A resting order on the sample tape. It fills only when the sample mark reaches your limit.</span></div>`
    : `<div class="fld">Fill${seg(['Market', 'Limit', 'Manual price'], 'Market')}<span class="help">Market fills at the sample chain’s mid. Limit waits for the sample mark. Manual price opens at a price you type.</span></div>`;
  const body = `<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${provChip('Sample chain · shaped like an options chain', 'dashed')}<span class="dline">Oct 7 scenario · SPY 690.62</span></div>${fill}
    <div class="ac-g4" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;">${fld('Side', 'Long')}${fld('Expiration', 'Oct 16 · 9d', { mono: true })}${fld('Strike', '690', { mono: true })}${fld('Right', 'Call')}</div>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">${fld('Quantity', '1', { mono: true, focus: true })}${fld(order ? 'Limit price' : 'Sample mid', order ? '2.40' : '2.47', { mono: true, dis: !order })}</div>
    <div class="hd-fig" style="grid-template-columns: repeat(3, minmax(0, 1fr));"><div><span class="caps">Net debit</span><span class="v">${order ? '$240' : '$247'}</span></div><div><span class="caps">Max loss</span><span class="v">${order ? '$240' : '$247'}</span></div><div><span class="caps">Cap check</span><span class="v" style="font-size: 15px;">within $500</span></div></div>
    <span class="dline" style="font-size: 12px;">Your cap: $25,000 sample account × 2% = $500 per trade (Settings · Risk inputs).</span>`;
  return dlg({ title: `${order ? 'Place simulated order' : 'Open simulated position'} · SPY`, chip: SIM, wide: true, body, foot: `<span class="dline" style="flex: 1 1 300px; font-size: 12px;">${order ? D8_1('SPY') : DISCLAIMER}</span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">${order ? 'Place simulated order' : 'Open simulated position'}</button>` });
}
export function orderDetailDemo() {
  return dlg({ title: 'Simulated order · SPY 690 C · Nov 20', chip: SIM, body: `<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"><span class="stag k-solid">${icon('clock', 12)}Triggered</span>${stateTag('sample', 'Sample tape')}<span class="dline">Waits to fill when the sample mark reaches your limit.</span></div><div class="hd-fig" style="grid-template-columns: repeat(2, minmax(0, 1fr));"><div><span class="caps">Source</span><span class="v" style="font-size: 14px;">Manual</span></div><div><span class="caps">Entry</span><span class="v" style="font-size: 14px;">Limit 4.25</span></div><div><span class="caps">Sample mark</span><span class="v" style="font-size: 14px;">4.47 · 2:30 PM</span></div><div><span class="caps">Good til</span><span class="v" style="font-size: 14px;">Nov 20, 4:00 PM</span></div></div><span class="caps">Lifecycle</span><div class="drows"><div style="grid-template-columns: 110px minmax(0, 1fr);"><span class="mono steel">Oct 7 2:30 PM</span><span>Placed · 1 × SPY 690 C Nov 20</span></div><div style="grid-template-columns: 110px minmax(0, 1fr);"><span class="mono steel">Oct 7 2:30 PM</span><span>Triggered · waiting to fill at limit</span></div><div style="grid-template-columns: 110px minmax(0, 1fr);"><span class="mono steel">—</span><span class="steel">Not filled</span></div></div>`, foot: `<span class="dline" style="flex: 1 1 240px;">Stored in this browser · never sent to a broker</span><button class="btn secondary" type="button">Cancel order</button><button class="btn ghost" type="button">Close</button>` });
}
export function personaDemo() {
  const list = `<div role="listbox" aria-label="Persona" style="display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; overflow: hidden;">${['Default (no persona)', 'Income Keeper', 'Premium Hunter', 'Steady Swinger', 'Balanced Swinger', 'Momentum Rider', 'The Protector', 'Careful sample reader', 'Customize…'].map((p) => { const on = p === 'Careful sample reader'; return `<div role="option" aria-selected="${on}" style="display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; align-items: center; min-height: 36px; padding: 4px 12px; font-size: 13px; ${on ? 'font-weight: 600; background: var(--raised-2);' : ''}${p === 'Customize…' ? ' border-top: 1px solid var(--line);' : ''}">${on ? icon('check', 14) : '<span></span>'}<span>${p}</span></div>`; }).join('')}</div>`;
  const form = `${fld('Based on', 'Balanced Swinger')}<div class="fld">Risk level${seg(['Conservative', 'Moderate', 'Aggressive'], 'Conservative')}</div><div class="fld">Lean${seg(['Lean exit or trim', 'Balanced', 'More open to add'], 'Lean exit or trim')}</div>${fld('Emphasis note', 'Authored educational scenario.', { help: 'Adds framing emphasis only; it never changes the numbers.' })}${fld('Persona name', 'Careful sample reader', { focus: true })}`;
  return dlg({ title: 'Customize persona', wide: true, body: `<p class="dline" style="margin: 0;">Personas brief the AI read on your style. In the demo, reads are authored sample analyses; your persona saves in this browser.</p><div style="display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 16px; align-items: start;" class="ac-pers"><div class="fld">Picker (ticker desk toolbar)${list}</div><div style="display: flex; flex-direction: column; gap: 12px;">${form}</div></div>`, foot: `<span style="flex: 1;"></span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Save persona</button>` });
}
export function viewEditorDemo() {
  const uni = [['AAPL', true], ['MSFT', true], ['NVDA', true], ['QQQ', true], ['SPY', true], ['TSLA', false]];
  const mine = ['NVDA', 'SPY', 'QQQ', 'AAPL', 'MSFT'];
  const box = (on) => `<span style="width: 20px; height: 20px; border-radius: 5px; border: 1px solid ${on ? 'var(--phosphor)' : 'var(--line-2)'}; display: inline-flex; align-items: center; justify-content: center;" role="checkbox" aria-checked="${on}">${on ? icon('check', 14) : ''}</span>`;
  return dlg({ title: 'Edit your scan view', wide: true, body: `<p class="dline" style="margin: 0;">Pick from the tracked universe. The universe is server-curated — it cannot be added to here.</p><div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;"><div class="fld">Tracked universe · 6 in the demo<div class="drows">${uni.map(([s, on]) => `<div style="grid-template-columns: 24px minmax(0, 1fr);">${box(on)}<span class="mono">${s}</span></div>`).join('')}</div></div><div class="fld">In your view (drag order = display order)<div class="drows">${mine.map((s, i) => `<div style="grid-template-columns: 24px minmax(0, 1fr) auto;"><span class="steel">${icon('grip', 14)}</span><span class="mono">${s}</span><span style="display: inline-flex; gap: 4px;"><button class="btn ghost sm" type="button" aria-label="Move ${s} up"${i === 0 ? ' disabled' : ''}>${icon('chevronU', 14)}</button><button class="btn ghost sm" type="button" aria-label="Move ${s} down"${i === mine.length - 1 ? ' disabled' : ''}>${icon('chevron', 14)}</button></span></div>`).join('')}</div></div></div>${fld('View name (optional)', 'Indexes and megacaps')}`, foot: `<span class="dline" style="flex: 1 1 240px;">Saved in this browser’s demo workspace.</span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Save view</button>` });
}
export function whatsSentDemo() {
  const sec = (t, inner, open = false) => `<details class="hd-p is-sample" style="gap: 6px;"${open ? ' open' : ''}><summary style="cursor: pointer; font-weight: 600; min-height: 32px; display: flex; align-items: center;">${t}</summary>${inner}</details>`;
  const pre = (s) => `<pre class="mono" style="margin: 0; font-size: 11.5px; color: var(--steel); white-space: pre-wrap;">${s}</pre>`;
  return dlg({ title: 'Sample analysis export · SPY', drawer: true, chip: stateTag('sample'), body: `<p class="dline" style="margin: 0;">Exactly what a read would send, on the Oct 7 scenario. Sample analysis · authored for this scenario. Nothing here is market data and nothing leaves this browser.</p>${sec('Computed snapshot (context)', pre('ticker: SPY (sample)\nspot: 690.62 · as of 2026-10-07 18:30 UTC\nlevels: call_wall 704.02 · gamma_flip 683.92 · put_wall 652.22\nregime: positive_gamma · score 74 · tier actionable'), true)}${sec('Candidate contracts', '<span class="dline">Not sent: the sample chain hands no candidates to a read.</span>')}${sec('Your risk inputs · what the next request will send', pre('account_size: 25000\nper_trade_cap: 2% → $500'), true)}${sec('Open positions', pre('SPY 690 C 2026-10-16 · long 1 · entry 3.00'))}${sec('Persona prompt', pre('Careful sample reader · conservative · lean exit or trim'))}${sec('Field glossary', '<span class="dline">What each field above means, in plain words.</span>')}`, foot: `<button class="btn secondary" type="button">${icon('copy', 14)}Copy all</button><span class="dline">Copies the sample, labelled as one.</span>` });
}

/** The dialog boards. Each staging board puts the overlay over the demo page it opens from. */
export const signInBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overPage({ scheme, minHeight: Math.max(minHeight, 900), active: 'positions', dialog: signInDlg() });
export const tradeEntryBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 900), active: 'ticker', dialog: tradeEntryDemo() });
export const orderDetailBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 900), active: 'positions', dialog: orderDetailDemo() });
export const personaBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 900), active: 'ticker', dialog: personaDemo() });
export const viewEditorBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 900), active: 'scanner', dialog: viewEditorDemo() });
export const whatsSentBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 900), active: 'ticker', right: true, dialog: whatsSentDemo() });

/** 390: every overlay as a bottom sheet over a scrim, stacked. */
export function sheetsBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const S = [
    ['Sign in', 'Production only', stateTag('locked'), signInDlg()],
    ['Trade entry', 'Staging · the sample chain', stateTag('demo'), tradeEntryDemo()],
    ['Order detail', 'Staging', stateTag('demo'), orderDetailDemo()],
    ['Persona', 'Staging', stateTag('demo'), personaDemo().replace('class="ac-pers"', 'class="ac-pers" data-stack').replace('grid-template-columns: minmax(0, 2fr) minmax(0, 3fr)', 'grid-template-columns: 1fr')],
    ['Scan view editor', 'Staging', stateTag('demo'), viewEditorDemo().replace('grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;', 'grid-template-columns: 1fr; gap: 16px;')],
    ['What’s sent', 'Staging', stateTag('demo'), whatsSentDemo().replace('v4dlg drawer', 'v4dlg')],
  ];
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="ac-sheets"><header><h1 class="display">Overlays on a phone</h1><p class="dline" style="margin: 0; font-size: 13.5px;">Under 600px every dialog and the drawer become bottom sheets: full width, a grab handle, actions stacked at 44px, the page behind dimmed. The new-alert steps follow the same rule (alerts row).</p></header>${S.map(([n, env, tag, d]) => `<section class="ac-sheet" aria-label="${n} sheet"><div class="cap"><b>${n}</b>${tag}<span class="dline">${env}</span></div><div class="scr">${d}</div></section>`).join('')}</div></div>`;
}

export function dialogsStates({ minHeight = 0, scheme = 'dark' } = {}) {
  const warn = (t) => `<div class="dwarn">${icon('warn', 14)}<span class="dline" style="color: var(--phosphor);">${t}</span></div>`;
  const items = [
    { name: 'Sign in · wrong credentials', tag: ['error', 'Check and retry'], id: 'DLG-04', when: 'Production. Inline under the form, saying what to check.', html: dlg({ title: 'Welcome back', body: `${fld('Email', 'owner@…', {})}${fld('Password', '••••••', { err: 'Those credentials didn’t match. Check your email and password and try again.' })}<button class="btn primary" type="button" style="width: 100%;">Sign in</button>` }) },
    { name: 'Sign in · service down', tag: ['unavailable'], when: 'Production. Says the service is down, not the password; sign-ups stay closed either way.', html: `${warn('Couldn’t reach sign-in right now. Please try again in a moment.')}<button class="btn primary lg" type="button" disabled style="width: 100%; opacity: 1;"><span class="skel" style="width: 14px; height: 14px; border-radius: 50%;"></span>Signing in…</button>` },
    { name: 'Trade entry · fills not live', tag: ['notLive'], id: 'DLG-01', when: 'Production, signed in: Market and Limit need a live quote, so only Manual price is offered, with the reason on the control.', html: `<div class="fld">Fill${seg([['Market', true], ['Limit', true], 'Manual price'], 'Manual price')}<span class="help">Market and Limit fill at a live quote, which needs the options feed. Manual price opens at your price: user-entered, not a market quote.</span></div>${demoNote()}` },
    { name: 'Trade entry · order variant', tag: ['demo'], when: 'Placing an order from an AI read (staging): the D8-1 disclosure always sits above the confirm.', html: `<span class="dline" style="font-size: 12.5px;">${D8_1('SPY')}</span><button class="btn primary" type="button" style="align-self: flex-start;">Place simulated order</button>` },
    { name: 'Trade entry · over the cap', tag: ['computed', 'Cap check'], when: 'Max loss above the per-trade cap: the dialog says so and still lets you open it; the book flags it.', html: `<div class="dwarn">${icon('warn', 14)}<span class="dline" style="font-size: 12.5px;">Max loss $680 is above your $500 per-trade cap. You can still open it; the book will flag it.</span></div>` },
    { name: 'Trade entry · cap not set', tag: ['notConfigured', 'Not set'], when: 'No risk inputs saved: the cap check reads “not set” and links to Settings.', html: `<div class="hd-fig" style="grid-template-columns: repeat(3, minmax(0, 1fr));"><div><span class="caps">Net debit</span><span class="v">$247</span></div><div><span class="caps">Max loss</span><span class="v">$247</span></div><div><span class="caps">Cap check</span><span class="v" style="font-size: 15px;">not set</span></div></div><span class="dline">Set an account size and a per-trade cap to check sizing against your cap. <a href="/settings#risk-inputs">Set risk inputs →</a></span>` },
    { name: 'Trade entry · chain didn’t load', tag: ['error'], when: 'The contract list failed; the dialog keeps your fields and offers a retry.', html: dataCell({ fam: 'dialog', state: 'error', w: '100%', h: 'auto' }) },
    { name: 'Order detail · not evaluated', tag: ['notLive', 'Not evaluated'], id: 'DLG-02', when: 'Production: no live stream, so the order can’t trigger. The plan stays as placed; it can still expire or be cancelled.', html: `<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${stateTag('notLive', 'Not evaluated')}<span class="dline">Waiting for live data — not currently evaluated</span></div>` },
    { name: 'Order detail · filled', tag: ['local', 'Filled'], when: 'Links to the position the fill opened.', html: `<div class="drows"><div style="grid-template-columns: 110px minmax(0, 1fr) auto;"><span class="mono steel">Oct 7 2:25 PM</span><span>Filled at 3.00 · trigger fill</span><a href="/positions">View position</a></div></div>` },
    { name: 'What’s sent · nothing sent', tag: ['notLive'], id: 'DLG-03', when: 'Production: no read runs without the options feed, so nothing leaves; your side of the payload is still listed.', html: `<div class="hd-p" style="gap: 8px;"><div class="ph"><h3>Nothing is sent right now</h3>${stateTag('notLive')}</div><span class="dline" style="font-size: 13px;">A read sends the computed snapshot, candidate contracts, your risk inputs, open positions and your persona. The snapshot needs the options feed, which isn’t live on this site, so no read runs and nothing leaves.</span><a href="${STAGING_DEMO_URL}/ticker/SPY" style="display: inline-flex; min-height: 24px; align-items: center; font-weight: 600;">See it on the demo →</a></div>` },
    { name: 'Persona · save failed', tag: ['error'], id: 'DLG-05', when: 'Inline; the form keeps what you typed.', html: warn('Couldn’t save that persona. Please try again; your edits are still here.') },
    { name: 'Scan view · universe unavailable', tag: ['unavailable'], id: 'DLG-06', when: 'The tracked universe didn’t load this cycle.', html: warn('The tracked universe is unavailable this cycle. Try again shortly.') },
    { name: 'Scan view · save failed', tag: ['error'], when: 'Shipped copy; the selection stays.', html: warn('Could not save that view. Please try again.') },
    { name: 'Copied', tag: null, when: 'Copy all confirms for 1.5 s, announced politely.', html: `<button class="btn secondary" type="button" aria-live="polite" style="align-self: flex-start;">${icon('check', 14)}Copied</button>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Overlays · states', lead: 'Every state the overlays reach that their boards don’t show: production’s Not live words, the sign-in failures, the cap and chain states, and the save failures. The new-alert flow’s states are on the alerts row.', trace: 'DLG-01–DLG-06 · POS-03 · P-1, P-2', items });
}
function demoNote() {
  return `<span class="dline" style="font-size: 12px;">On the demo, all three fill modes work against the sample chain. <a href="${STAGING_DEMO_URL}/ticker/SPY">See it on the demo →</a></span>`;
}
