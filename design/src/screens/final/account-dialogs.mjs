// Final · Convexa v1 — account group: the overlays. Staging versions are drawn on the demo account's seed
// (SPY at 690.62 on the Oct 7 scenario, the $25,000 / 2% risk seed, the "Careful sample reader" persona);
// sign in is production only (staging has no sign-in anywhere). Production words for each overlay's
// Not live state live on the states board. Copy reuses the shipped strings (features/trading/orders/
// copy.ts D8 disclosures, features/trading/positions/labels.ts DISCLAIMER, pages/scanner/labels.ts).
import { STAGING_DEMO_URL, icon, v4Nav, finalDemoNotice } from '../../lib.mjs';
import { dataCell, stateTag } from '../../components/data-states.mjs';
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
  .ac-fill { display: flex; flex-wrap: wrap; gap: 6px; }
  /* Trade entry as shipped (TradeEntryDialogView.tsx; owner, 2026-10-25, after fidelity round 2): caps field labels
     (FieldLabel: 11/700, 0.07em, text.secondary since spec 02 step 4, 673dd755: steel, 6.19:1 dark and 5.42:1 light on
     the dialog), 36px fields on the page ink, full-width toggle groups, the leg on one row of four (two by two under
     600px, LegFields.tsx), 44px controls under 600px. The toggle group's outline is an inset shadow, not a border, so
     each button box is the full row height, as the app's ToggleButtons are (44 under 600px, not 42 inside a 1px border).
     A selected toggle takes MUI's neutral selected tint: phosphor 16% in dark, 8% in light (the app's action.selected). */
  .v4dlg.te .dh h2 { line-height: 1.4; text-wrap: wrap; }
  .te-l { display: block; margin: 0 0 4px; font: 700 11px/1.65 'IBM Plex Sans', sans-serif; letter-spacing: 0.07em; text-transform: uppercase; color: var(--steel); }
  .te-in { box-sizing: border-box; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--ink); font: 400 13px 'IBM Plex Sans', sans-serif; color: var(--phosphor); }
  .te-in.ro { border-style: dashed; background: transparent; color: var(--steel); }
  .te-in > span:first-child { flex: 1 1 auto; min-width: 0; }
  .te-caret { flex: 0 0 auto; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid var(--steel); }
  .te-tg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); border: 0; box-shadow: inset 0 0 0 1px var(--line); border-radius: 8px; overflow: hidden; }
  .te-tg > button { min-height: 38.8px; padding: 0 8px; border: 0; border-left: 1px solid var(--line); background: transparent; color: var(--steel); font: 600 13px/1.75 'IBM Plex Sans', sans-serif; }
  .te-tg > button:first-child { border-left: 0; }
  .te-tg > button[aria-pressed="true"] { background: color-mix(in srgb, var(--phosphor) 16%, transparent); color: var(--phosphor); }
  [data-scheme="light"] .te-tg > button[aria-pressed="true"] { background: color-mix(in srgb, var(--phosphor) 8%, transparent); }
  /* Call and Put keep their fills, with ink labels (owner S2-Q1, 2026-10-25; spec 02 (c) "no"; LegFields.tsx
     rightSelectedSx, 31b0011a): a selected Call is success.main (--up), a selected Put error.main (--down). The label is
     the app's ink #0B0F17 on every fill except light Put, which keeps white: 9.13:1 dark Call, 6.34:1 dark Put, 5.56:1
     light Call, 4.74:1 light Put in white. Hover keeps the fill (no success.dark / error.dark). This closes the 2026-10-13
     row's white-label item; the board drew a neutral phosphor tint here from fidelity ACC-12 (R3-B), which S2-Q1 reverses. */
  .te-tg.te-right > button[aria-pressed="true"][data-right="call"] { background: var(--up); color: #0B0F17; }
  .te-tg.te-right > button[aria-pressed="true"][data-right="put"] { background: var(--down); color: #0B0F17; }
  [data-scheme="light"] .te-tg.te-right > button[aria-pressed="true"][data-right="put"] { color: #FFFFFF; }
  .te-g4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: start; }
  .te-g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .te-g2.wide { gap: 16px; }
  .te-net { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .te-net .stag { font-weight: 500; }
  .te .hd-fig .v.nan { font-family: 'IBM Plex Sans', sans-serif; }
  .btn.te-off { background: color-mix(in srgb, var(--phosphor) 12%, transparent); color: color-mix(in srgb, var(--phosphor) 30%, transparent); cursor: not-allowed; }
  @media (max-width: 599px) { .te-g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .te-in { height: 44px; } .te-tg > button { min-height: 44px; } .te .hd-fig .v { font-size: 16px; } }
`;

/** A staging page with an overlay: the demo bar and the demo account behind the scrim (never "Sign in"). */
export function overDemo({ scheme = 'dark', minHeight = 900, active = '', dialog, right = false }) {
  const behind = `<div class="v4-behind" aria-hidden="true">${finalDemoNotice()}${v4Nav({ active, demo: true })}<div class="wrap" style="padding-top: 28px; display: flex; flex-direction: column; gap: 16px;"><span class="skel" style="height: 44px; width: 38%;"></span><span class="skel" style="height: 300px; width: 100%;"></span><span class="skel" style="height: 120px; width: 100%;"></span><span class="skel" style="height: 220px; width: 100%;"></span></div></div>`;
  return `<div class="v4" data-scheme="${scheme}" style="position: relative; width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); overflow: hidden;">${behind}<div class="v4-over${right ? ' right' : ''}">${dialog}</div></div>`;
}

/** The neutral SIMULATED tag, as the trade dialog and the Positions "Simulated orders" panel draw it (fidelity
 *  ACC-12; 673dd755, spec 02 criterion 11): text.primary 600 on a lineStrong outline, 0.04em tracking. */
export const SIM = '<span class="stag k-solid" style="letter-spacing: 0.04em;">SIMULATED</span>';
const DISCLAIMER = 'Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and assignment are not modeled.';
const D8_1 = (t) => `Simulated only — no real order is ever placed. Once confirmed, this order can trigger and fill unattended whenever a live stream for ${t} is open in this browser. Orders are stored in this browser — not synced to your account.`;

/** Trade entry as shipped (TradeEntryDialogView.tsx), the way it opens from the desk on staging: Manual price selected
 *  (the specs and tests pin it), Market and Limit beside it; the leg on one row of four, Quantity and the price below,
 *  then Stop and Target; the price line with its basis chip; the Net debit / Max loss / Cap per trade strip, with the cap
 *  as received and no verdict: the dialog computes no cap check (tradeable-rec-inputs AC-63). Owner, 2026-10-25, after
 *  fidelity round 2: ACC-11's Market default and its “within” cap verdict are not adopted; this board follows the app.
 *  The confirm stays disabled until a price is typed. */
const teField = (label, value, { ro = false, caret = false } = {}) => `<div><span class="te-l">${label}</span><span class="te-in${ro ? ' ro' : ''}"><span>${value}</span>${caret ? '<span class="te-caret" aria-hidden="true"></span>' : ''}</span></div>`;
export const teToggle = (opts, on, label) => { const right = label === 'Right'; return `<div class="te-tg${right ? ' te-right' : ''}" role="group" aria-label="${label}">${opts.map((o) => { const [t, off] = Array.isArray(o) ? o : [o, false]; return `<button type="button" aria-pressed="${t === on}"${right ? ` data-right="${t.toLowerCase()}"` : ''}${off ? ' aria-disabled="true"' : ''}>${t}</button>`; }).join('')}</div>`; };
export const teStrip = (net, loss, cap) => `<div class="hd-fig" style="grid-template-columns: repeat(3, minmax(0, 1fr));">${[['Net debit', net], ['Max loss', loss], ['Cap per trade', cap]].map(([l, v]) => `<div><span class="caps">${l}</span><span class="v${/^[$\d]/.test(v) ? '' : ' nan'}">${v}</span></div>`).join('')}</div>`;
const CAP_LINE = '<span class="dline" style="font-size: 12px;">Your cap: $25,000 sample account × 2% = $500 per trade (<a href="/settings" style="text-decoration: underline;">Settings · Risk inputs</a>).</span>';
export function tradeEntryDemo() {
  const body = `${teToggle(['Manual price', 'Market', 'Limit'], 'Manual price', 'fill mode')}
    <div class="te-g4">${teField('Side', 'Long', { ro: true })}${teField('Expiration', '2026-10-09', { caret: true })}${teField('Strike', '$690', { caret: true })}<div><span class="te-l">Right</span>${teToggle(['Call', 'Put'], 'Call', 'Right')}</div></div>
    <div class="te-g2">${teField('Quantity', '1')}${teField('Manual price', '')}</div>
    <div class="te-g2 wide">${teField('Stop (optional)', '')}${teField('Target (optional)', '')}</div>
    <div class="te-net"><span class="dline" style="font-size: 13px;">Enter a price — opens at exactly the price you type.</span><span class="stag k-solid">user-entered price</span></div>
    ${teStrip('—', '—', '$500')}
    ${CAP_LINE}`;
  return dlg({ title: 'Open simulated position · SPY', chip: SIM, wide: true, body, foot: `<span class="dline" style="flex: 1 1 300px; font-size: 12px;">${DISCLAIMER}</span><button class="btn ghost" type="button">Cancel</button><button class="btn te-off" type="button" aria-disabled="true">Open simulated position</button>` }).replace('class="v4dlg wide"', 'class="v4dlg wide te"');
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
  return dlg({ title: 'Sample analysis export · SPY', drawer: true, chip: stateTag('sample'), body: `<p class="dline" style="margin: 0;">Exactly what a read would send, on the Oct 7 scenario. Sample analysis · authored for this scenario. Nothing here is market data and nothing leaves this browser.</p>${sec('Computed snapshot (context)', pre('ticker: SPY (sample)\nspot: 690.62 · as of 2026-10-07 18:30 UTC\nlevels: call_wall 704.02 · gamma_flip 683.92 · put_wall 652.22\nregime: positive_gamma · score 74 · tier actionable'), true)}${sec('Candidate contracts', '<span class="dline">Not sent: the sample chain hands no candidates to a read.</span>')}${sec('Your risk inputs · what the next request will send', pre('account_size: 25000\nper_trade_cap: 2% → $500'), true)}${sec('Open positions', pre('SPY 690 C 2026-10-16 · long 1 · entry 3.00'))}${sec('Persona prompt', pre('Careful sample reader · conservative · lean exit or trim'))}${sec('Field glossary', '<span class="dline">What each field above means, in plain words.</span>')}`, foot: `<button class="btn secondary" type="button">${icon('copy', 16)}Copy all</button><span class="dline">Copies the sample, labelled as one.</span>` });
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
    { name: 'Trade entry · fills not live', tag: ['notLive'], id: 'DLG-01', when: 'Production, signed in: Market and Limit need a live quote, so only Manual price fills; the two stay in the control, refused with the reason under it (FillModeToggle.tsx).', html: `<div class="te-net" style="align-items: stretch;">${teToggle(['Manual price', ['Market', true], ['Limit', true]], 'Manual price', 'fill mode')}<span class="dline" style="font-size: 12px;">Market and Limit fill at a live quote, which needs the options feed. Manual price opens at your price: user-entered, not a market quote. On the demo, all three fill modes work against the sample chain. <a href="${STAGING_DEMO_URL}/ticker/SPY" style="font-weight: 600; text-decoration: underline;">See it on the demo →</a></span></div>` },
    { name: 'Trade entry · order variant', tag: ['demo'], when: 'Placing an order from an AI read (staging): the D8-1 disclosure always sits above the confirm.', html: `<span class="dline" style="font-size: 12.5px;">${D8_1('SPY')}</span><button class="btn primary" type="button" style="align-self: flex-start;">Place simulated order</button>` },
    { name: 'Trade entry · max loss over the cap', tag: ['computed', 'Cap per trade'], when: 'The strip puts the entry’s max loss beside your per-trade cap, as received, and states no verdict: the dialog computes no cap check (tradeable-rec-inputs AC-63). You compare; the position still opens.', html: `<div class="te">${teStrip('$680', '$680', '$500')}</div>${CAP_LINE}` },
    { name: 'Trade entry · from an AI read', tag: ['computed', 'The read’s cap check'], when: 'Opened from a read’s Accept, the read’s own cap check, computed once on the server and pinned to the read, shows under the strip as received: within or above, both with the warning glyph, never green (AC-60, AC-63; CapAnnotation.tsx).', html: `<div style="display: flex; align-items: flex-start; gap: 4px; color: var(--warn);">${icon('warn', 16)}<span style="font-size: 12px; line-height: 1.66;">$680 is above your cap of $500.</span></div>` },
    { name: 'Trade entry · cap not set', tag: ['notConfigured', 'Not set'], when: 'No risk inputs saved: Cap per trade reads “not set” and the line under the strip links to Settings.', html: `<div class="te">${teStrip('$247', '$247', 'not set')}</div><span class="dline" style="font-size: 12px;">Set an account size and a per-trade cap to see your cap here. <a href="/settings" style="text-decoration: underline;">Set risk inputs →</a></span>` },
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
