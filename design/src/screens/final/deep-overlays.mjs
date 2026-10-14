// Final · Convexa v1 — the remaining overlays (deep group, row `overlays`): the broker reassessment
// request, the track-record archive import, the expanded widget view, the positions view dialogs, the
// browser-notification ask for alerts, and account recovery for invited accounts (designed, not built).
// Copy reuses shipped strings: features/trading/broker/reassess.tsx, features/trading/outcomes/copy.ts,
// shared/ui/Widget/Widget.tsx, features/trading/positions/{CustomizationToolbar.tsx,labels.ts},
// pages/alerts/AlertsPage.tsx (notifyExplain), features/auth/copy.ts.
import { icon, v4Nav, v4Notice, v4Page } from '../../lib.mjs';
import { chartFrame, plot, ticks } from '../../chart-kit.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { dlg, fld, overPage, statesBoard } from '../v4/kit.mjs';

export const OV_CSS = `
  .ov-pre { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--ink); border: 1px solid var(--line); font: 11.5px/1.6 'IBM Plex Mono', monospace; color: var(--steel); white-space: pre-wrap; word-break: break-word; }
  .ov-basis { font: 500 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); }
  .ov-call { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: var(--raised); font-size: 12.5px; line-height: 1.45; color: var(--steel); }
  .ov-call strong { color: var(--phosphor); font-weight: 600; }
  .ov-exp { width: min(1200px, 100%); height: 720px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--e4); display: flex; flex-direction: column; overflow: hidden; }
  .ov-exp .eh { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
  .ov-exp .eh h2 { margin: 0; font-size: 16px; font-weight: 700; flex: 1 1 auto; min-width: 0; }
  .ov-exp .eb { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 18px; }
  .ov-toast { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; background: var(--raised); border: 1px solid var(--line-2); box-shadow: var(--e2); max-width: 380px; }
  .ov-toast b { font-size: 13px; }
  .ov-prompt { border: 1px solid var(--line-2); border-radius: 10px; background: var(--ink-2); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; max-width: 360px; font-size: 13px; }
  .ov-prompt .btns { display: flex; gap: 8px; justify-content: flex-end; }
  .ov-prompt .btns span { border: 1px solid var(--line-2); border-radius: 6px; padding: 4px 12px; font-size: 12.5px; }
  .ov-auth { max-width: 460px; margin: 56px auto 0; }
  .ov-sheets { padding: 24px 0 40px; display: flex; flex-direction: column; gap: 28px; }
  .ov-sheets > header { padding: 0 16px; display: flex; flex-direction: column; gap: 6px; }
  .ov-sheets > header h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
  .ov-sheet { display: flex; flex-direction: column; gap: 8px; }
  .ov-sheet > .cap { padding: 0 16px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
  .ov-sheet > .cap b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 16px; }
  .ov-sheet > .scr { background: var(--scrim); padding-top: 56px; display: flex; flex-direction: column; justify-content: flex-end; }
  .ov-sheet .v4dlg, .ov-sheet .ov-exp { width: 100%; border-radius: 16px 16px 0 0; height: auto; }
  .ov-sheet .v4dlg .dh, .ov-sheet .ov-exp .eh { position: relative; padding-top: 22px; }
  .ov-sheet .v4dlg .dh::before, .ov-sheet .ov-exp .eh::before { content: ''; position: absolute; top: 8px; left: 50%; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: var(--line-2); }
  .ov-sheet .v4dlg .df .btn { flex: 1 1 100%; min-height: 44px; }
  .ov-sheet .btn { min-height: 44px; }
  .ov-sheet .v4dlg .dh .btn, .ov-sheet .ov-exp .eh .btn { flex: 0 0 auto; }
  .ov-sheet .v4dlg .dh h2, .ov-sheet .ov-exp .eh h2 { flex: 1 1 0; }
  .ov-sheet .ov-g2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
`;

const SAMPLE_ASOF = 'Oct 7, 2026 · 2:30 PM ET';

/** A staging page with an overlay: the demo bar and the demo account behind the scrim (never "Sign in"). */
export function overDemo({ scheme = 'dark', minHeight = 900, active = '', dialog, right = false }) {
  const behind = `<div class="v4-behind" aria-hidden="true">${v4Notice('demo')}${v4Nav({ active, demo: true })}<div class="wrap" style="padding-top: 28px; display: flex; flex-direction: column; gap: 16px;"><span class="skel" style="height: 44px; width: 38%;"></span><span class="skel" style="height: 300px; width: 100%;"></span><span class="skel" style="height: 120px; width: 100%;"></span><span class="skel" style="height: 220px; width: 100%;"></span></div></div>`;
  return `<div class="v4" data-scheme="${scheme}" style="position: relative; width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); overflow: hidden;">${behind}<div class="v4-over${right ? ' right' : ''}">${dialog}</div></div>`;
}

// ---- 1 · Broker reassessment request (staging: the demo's one authored holding) -----------------
const REQ = `{
  "source": "demo_sample",
  "ticker": "AAPL",
  "as_of_basis": "on the demo book as of ${SAMPLE_ASOF} · synthetic · a snapshot, never live",
  "as_of": "2026-10-07T18:30:00Z",
  "structure": "Shares",
  "structure_line": "AAPL · 25 shares",
  "qty": "25 sh",
  "position": null,
  "modeled_pl_dollar": 625,
  "modeled_pl_basis": "Convexa-modeled"
}`;
export function reassessDlg() {
  const body = `<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${provChip('Sample · shaped like a read-only Webull holding', 'dashed')}</div>
    <span class="ov-basis">On the demo book as of ${SAMPLE_ASOF} · synthetic · a snapshot, never live.</span>
    <div class="hd-fig" style="grid-template-columns: repeat(4, minmax(0, 1fr));"><div><span class="caps">Holding</span><span class="v" style="font-size: 15px;">AAPL · 25 sh</span></div><div><span class="caps">Cost basis</span><span class="v" style="font-size: 15px;">240.00</span></div><div><span class="caps">Mark</span><span class="v" style="font-size: 15px;">265.00</span></div><div><span class="caps">Unrealized</span><span class="v t-up" style="font-size: 15px;">▲ +$625</span></div></div>
    <div class="fld">The request<pre class="ov-pre" aria-label="Reassessment request">${REQ}</pre><span class="help">Exactly the position-context shape a read takes for a simulated holding, plus the as-of basis: a real holding never travels without its age.</span></div>
    <div class="ov-call">${icon('shield', 14)}<span><strong>Advisory only.</strong> Copy it into a read of your own. Nothing here places, changes or cancels an order, and nothing is added to your book. On the demo nothing is sent.</span></div>`;
  return dlg({ title: 'Reassessment request · AAPL', chip: stateTag('sample'), wide: true, body, foot: `<span class="dline" style="flex: 1 1 260px;">Read-only brokerage: Convexa never writes to it.</span><button class="btn ghost" type="button">Close</button><button class="btn secondary" type="button">${icon('copy', 14)}Copy request</button>` });
}
export const reassessBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 980), active: 'positions', dialog: reassessDlg() });

// ---- 2 · Track-record archive import (staging) ---------------------------------------------------
const IMPORT_BODY = 'Importing only adds. It never deletes, never overwrites and never replaces anything you already have. If a record in the file is already here, it’s skipped. If it collides with a different record, your existing record wins. Importing the same file twice changes nothing.';
export function archiveDlg() {
  return dlg({ title: 'Import archive?', body: `<p style="margin: 0; font-size: 14px; line-height: 1.55;">${IMPORT_BODY}</p><span class="mono steel" style="font-size: 12px;">File: convexa-archive-2026-10-07.json</span><div class="ov-call">${icon('info', 14)}<span>Nothing is read into your history until you press Import. Your history lives in this browser only; the archive is its one backup.</span></div>`, foot: `<span style="flex: 1 1 auto;"></span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Import</button>` });
}
export const archiveBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 900), active: 'positions', dialog: archiveDlg() });

// ---- 3 · Expanded widget (staging: Term structure, the example Widget.tsx names) -----------------
function termBig(height = 420) {
  const T = [[7, 14.2], [14, 15.1], [30, 16.4], [60, 17.3], [90, 18.0]];
  return chartFrame({ claim: 'Contango: 90-day implied vol at 18.0% sits 3.8 points above 7-day', sub: 'SPY at-the-money implied volatility by days to expiry · %', body: plot({ height, pr: 90, prn: 50, pl: 44, x: { min: 0, max: 95, ticks: T.map(([d]) => ({ v: d, label: `${d}d` })) }, y: { min: 12, max: 20, ticks: ticks(12, 20, 2, (v) => (v === 20 ? '20%' : String(v))) }, series: [{ points: T, role: 'emph', dots: true, end: 'Contango', endValue: '+3.8 pts' }], keyboard: false, aria: T.map(([d, v]) => `${d} days ${v}%`).join(', ') }), source: 'Sample · shaped like SPY options structure', sourceKind: 'dashed', asof: `Scenario · ${SAMPLE_ASOF}`, kind: 'sample', state: 'sample' });
}
export function expandDlg({ height = 420 } = {}) {
  return `<div class="ov-exp" role="dialog" aria-modal="true" aria-label="Term structure, expanded"><div class="eh"><h2>Term structure</h2>${stateTag('sample')}<button class="btn ghost sm" type="button" aria-label="Close expanded widget">${icon('close', 16)}</button></div><div class="eb">${termBig(height)}<p class="dline" style="margin: 12px 0 0;">The same widget, larger: one body, two frames. It morphs from its card where the browser supports view transitions and fades otherwise; with reduced motion it opens instantly. Escape or the close button returns focus to the expand control.</p></div></div>`;
}
export const expandBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 860), active: 'ticker', dialog: expandDlg() });

// ---- 4 · Positions view dialogs (staging) --------------------------------------------------------
export function viewNameDlg() {
  return dlg({ title: 'Name this view', body: `${fld('View name', 'Tech swings', { focus: true, help: 'A named snapshot of your columns, sort, filter, grouping, layout, and density. Switch, rename, or delete views; the active one survives a reload.' })}<span class="dline">Saved in this browser with the rest of the demo account’s data; Reset demo data clears it.</span>`, foot: `<span style="flex: 1 1 auto;"></span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Save view</button>` });
}
export const viewsBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overDemo({ scheme, minHeight: Math.max(minHeight, 900), active: 'positions', dialog: viewNameDlg() });

// ---- 5 · Browser notifications: the ask (production, alerts on public data) -----------------------
export function notifyDlg() {
  return dlg({ title: 'Show alerts as browser notifications?', body: `<p style="margin: 0; font-size: 14px; line-height: 1.55;">Fired alerts always list on the Alerts page. With notifications on, your browser also shows one when an alert fires while a Convexa tab is open. Convexa sends nothing anywhere: alerts are checked in this browser.</p>
    <div class="ov-toast" aria-label="Example notification"><span style="display: inline-flex; color: var(--steel);">${icon('bell', 16)}</span><span style="display: flex; flex-direction: column; gap: 2px;"><b>Convexa · NVDA</b><span class="dline" style="font-size: 12.5px;">Filed an 8-K: Item 5.02, officer change · SEC EDGAR, Oct 9</span></span></div>
    <span class="dline">Next, your browser asks for permission. You can change it later in the browser’s site settings.</span>`, foot: `<span style="flex: 1 1 auto;"></span><button class="btn ghost" type="button">Not now</button><button class="btn primary" type="button">Continue</button>` });
}
export const notifyBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overPage({ scheme, minHeight: Math.max(minHeight, 900), active: 'alerts', dialog: notifyDlg() });

// ---- 6 · Account recovery (production only; designed, not built) ---------------------------------
export function resetDlg() {
  return dlg({ title: 'Reset your password', body: `<p style="margin: 0; font-size: 14px; line-height: 1.55;">Enter the email your invitation went to. If it has an account, we’ll send a link to set a new password. The link works once, for 30 minutes.</p>${fld('Email', 'owner@example.com', { focus: true, help: 'autocomplete="email"' })}<button class="btn primary lg" type="button" style="width: 100%;">Send reset link</button><a href="#sign-in" style="font-size: 13px; align-self: center; min-height: 24px; display: inline-flex; align-items: center;">Back to sign in</a><span class="dline" style="text-align: center;">New sign-ups are closed while Convexa is in private testing.</span>`, foot: '' });
}
export const resetBody = ({ minHeight = 0, scheme = 'dark' } = {}) => overPage({ scheme, minHeight: Math.max(minHeight, 900), active: 'positions', dialog: resetDlg() });

export function resetPageBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const card = `<section class="hd-p ov-auth" aria-labelledby="ov-np" style="padding: 28px; gap: 16px;"><h1 id="ov-np" class="display" style="margin: 0; font-size: 28px;">Set a new password</h1><p class="dline" style="margin: 0; font-size: 14px;">For the account at <span class="mono">o•••@example.com</span>. This link works once and expires at 3:12 PM.</p>
    ${fld('New password', '••••••••••••', { focus: true, help: 'At least 8 characters. A passphrase is fine; password managers work.' })}${fld('Confirm new password', '••••••••••••')}
    <button class="btn primary lg" type="button" style="width: 100%;">Set password and sign in</button>
    <p class="dline" style="margin: 0;">Setting it signs out every other session on this account. Your simulated positions stay in the browser they were made in.</p></section>`;
  return v4Page({ scheme, minHeight, active: '', label: 'Set a new password', main: `<div class="wrap" style="padding-bottom: 56px;">${card}</div>` });
}

// ---- Phone · every overlay as a bottom sheet ----------------------------------------------------
export function sheetsBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const S = [
    ['Reassessment request', 'Staging · the demo holding', stateTag('demo'), reassessDlg().replace('repeat(4, minmax(0, 1fr))', 'repeat(2, minmax(0, 1fr))')],
    ['Import archive?', 'Staging', stateTag('demo'), archiveDlg()],
    ['Expanded widget', 'Staging · full-width sheet, chart re-laid out', stateTag('demo'), expandDlg({ height: 260 })],
    ['Name this view', 'Staging', stateTag('demo'), viewNameDlg()],
    ['Browser notifications', 'Production', stateTag('current', 'Public data'), notifyDlg()],
    ['Reset your password', 'Production only', stateTag('locked'), resetDlg()],
  ];
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="ov-sheets"><header><h1 class="display">Overlays on a phone</h1><p class="dline" style="margin: 0; font-size: 13.5px;">Under 600px each dialog becomes a bottom sheet: full width, a grab handle, actions stacked at 44px, the page dimmed behind. The expanded widget opens as a near-full-height sheet.</p></header>${S.map(([n, w, tag, d]) => `<section class="ov-sheet" aria-label="${n}"><div class="cap"><b>${n}</b>${tag}<span class="dline">${w}</span></div><div class="scr">${d}</div></section>`).join('')}</div></div>`;
}

// ---- States ---------------------------------------------------------------------------------------
export function statesBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const warn = (t) => `<div class="dwarn">${icon('warn', 14)}<span class="dline">${t}</span></div>`;
  const mini = (title, inner, foot = '') => dlg({ title, body: inner, foot });
  const items = [
    { name: 'Reassess · copied', tag: null, when: 'Copy request confirms in place for 1.5 s, announced politely. The dialog has no other action.', html: `<button class="btn secondary" type="button" aria-live="polite" style="align-self: flex-start;">${icon('check', 14)}Copied</button>` },
    { name: 'Reassess · production, signed in', tag: ['current', 'Snapshot'], when: 'A real Webull holding: the basis names the book’s age (“on your book as of … · Webull · read-only · read on demand”). A holding Convexa can’t recognize offers no request.', html: `<span class="ov-basis">on your book as of Oct 13, 4:05 PM ET · Webull · read-only · read on demand: a snapshot, never live.</span>` },
    { name: 'Import complete', tag: ['local'], when: 'After every import: all three lines, zeros included.', html: mini('Import complete', `<span style="font-size: 13.5px;">12 records added.</span><span style="font-size: 13.5px;">3 already here — skipped.</span><span style="font-size: 13.5px;">0 collided with a different record — your existing record was kept.</span><span class="dline">Nothing was deleted or overwritten.</span>`, '<span style="flex: 1;"></span><button class="btn primary" type="button">Done</button>') },
    { name: 'Import declined · the file', tag: ['error', 'Declined'], when: 'Unreadable, not a Convexa archive, or a newer version. One closed reason, never a parser message.', html: mini('Import declined', `<span style="font-size: 13.5px;">This isn’t a Convexa archive file. Nothing was imported. Your existing data was not changed.</span>`, '<span style="flex: 1;"></span><button class="btn primary" type="button">Done</button>') },
    { name: 'Import declined · your history', tag: null, when: 'Stored history can’t be fully read: the protection is the event. No Retry, no “Import anyway”; not styled as an error.', html: mini('Import declined — your file is fine', `<span style="font-size: 13px; line-height: 1.5;">We couldn’t read all of your stored history this time. Importing adds to that history, and we won’t write over records we can’t read, so we stopped before touching anything. Reload and try the same file again.</span>`, '<span style="flex: 1;"></span><button class="btn primary" type="button">Done</button>') },
    { name: 'Archive exported', tag: ['local'], when: 'Export always works, empty included; the toast names the file.', html: `<div class="ov-toast">${icon('check', 16)}<span class="dline" style="font-size: 12.5px; color: var(--phosphor);">Archive exported — convexa-archive-2026-10-07.json. This is your complete backup: every position, order and decision stored in this browser.</span></div>` },
    { name: 'Rename view', tag: null, when: 'From the view menu, on saved views only (built-in views can’t be renamed).', html: mini('Rename view', fld('View name', 'Tech swings · Oct', { focus: true }), '<span style="flex: 1;"></span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Rename view</button>') },
    { name: 'Delete view', tag: null, when: 'Confirms by name and says what it doesn’t touch. A destructive button is outlined burnt orange with the word, never red.', html: mini('Delete view', `<span style="font-size: 13.5px;">Delete ‘Tech swings’? Your positions are unaffected.</span>`, `<span style="flex: 1;"></span><button class="btn ghost" type="button">Cancel</button><button class="btn secondary" type="button" style="border-color: var(--warn);">${icon('trash', 14)}Delete view</button>`) },
    { name: 'View · can’t save', tag: ['error'], when: 'The positions store is faulted: Save view and Delete refuse with the reason; the working view stays.', html: warn('Your positions data couldn’t be read, so views can’t be saved right now. Reload to try again; nothing was changed.') },
    { name: 'Expanded · phone', tag: null, when: 'Under 600px the expanded view is a near-full-height sheet; the chart re-lays itself out (short labels, minor ticks drop, text ≥ 11px).', html: `<span class="dline">See the phone board: one body, the sheet frame.</span>` },
    { name: 'Notifications · the browser asks', tag: null, when: 'After Continue: the browser’s own prompt, which Convexa can’t style. Shown once per site unless reset.', html: `<div class="ov-prompt" aria-label="Browser permission prompt, illustrative"><span><strong>convexa.pages.dev</strong> wants to show notifications</span><div class="btns"><span>Block</span><span>Allow</span></div></div>` },
    { name: 'Notifications · on', tag: ['local', 'On in this browser'], when: 'Permission granted. The control reads on only while the browser’s permission says granted; “Turn off” stops them without touching the browser setting.', html: `<div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;"><span class="stag k-solid">${icon('bell', 12)}Browser notifications on</span><button class="btn ghost sm" type="button">Turn off</button></div>` },
    { name: 'Notifications · blocked', tag: ['notConfigured', 'Blocked here'], when: 'The browser denied permission. Says where to change it; firings still list on the page; no button that can’t work.', html: `<div class="hd-p" style="gap: 8px;"><div class="ph"><h3>Browser notifications are blocked for this site</h3>${stateTag('notConfigured', 'Blocked here')}</div><span class="dline">Alerts still show here, but nothing pops from the browser. To allow them, use the site settings next to the address bar, then come back.</span></div>` },
    { name: 'Notifications · unsupported', tag: null, when: 'No Notification API (some in-app browsers): says so; nothing to press.', html: `<span class="dline" style="font-size: 13px;">Browser notifications aren’t available in this browser. Alerts still show here.</span>` },
    { name: 'Reset · check your email', tag: null, when: 'After Send reset link, whatever the email: the same words for an account and no account (non-enumerating).', html: mini('Check your email', `<span style="font-size: 13.5px; line-height: 1.5;">If <span class="mono">owner@example.com</span> has a Convexa account, a reset link is on its way. It works once, for 30 minutes. Nothing arrived? Check spam, then send it again in a minute.</span>`, '<span style="flex: 1;"></span><button class="btn ghost" type="button">Send again</button><button class="btn primary" type="button">Done</button>') },
    { name: 'Reset · link expired or used', tag: ['error', 'Link expired'], when: 'The reset page with a stale token: says which, offers a fresh link; no form.', html: `<div class="hd-p" style="gap: 10px;"><strong style="font-size: 15px;">This reset link has expired.</strong><span class="dline">Links work once, for 30 minutes. Ask for a new one; your password hasn’t changed.</span><button class="btn primary" type="button" style="align-self: flex-start;">Send a new link</button></div>` },
    { name: 'Reset · too many requests', tag: null, when: 'More than 3 requests in 15 minutes from one browser or for one email: the wait in minutes, same words either way.', html: warn('Too many reset requests. Try again in 12 minutes.') },
    { name: 'Reset · service down', tag: ['unavailable'], when: 'Sign-in or email delivery is down: says so, not “wrong email”.', html: warn('Couldn’t send a reset link right now. Please try again in a moment.') },
    { name: 'Invitation · set your password', tag: ['locked'], when: 'An invited person’s first visit (/account/invite?token=…): the same page as a reset, titled for the invitation, with the email fixed.', html: `<div class="hd-p" style="gap: 10px;"><strong style="font-size: 16px;">Welcome to Convexa</strong><span class="dline">You were invited as <span class="mono">o•••@example.com</span>. Set a password to finish your account.</span>${fld('Password', '••••••••••••', { help: 'At least 8 characters.' })}<button class="btn primary" type="button" style="align-self: flex-start;">Create password and sign in</button></div>` },
    { name: 'Password set', tag: null, when: 'Signed in on this device; every other session signed out.', html: `<div class="ov-toast">${icon('check', 16)}<span class="dline" style="font-size: 12.5px; color: var(--phosphor);">Password set. You’re signed in, and other sessions were signed out.</span></div>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Remaining overlays · states', lead: 'Every state of the six overlays that their boards don’t show. Archive, views and reassessment work in this browser on both sites (production behind sign-in); notifications are the browser’s own permission; recovery is production only and designed, not built.', trace: 'TR §5.9 · broker AC-18/19 · alerts criterion 50 · P-2', items });
}
