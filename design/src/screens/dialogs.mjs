// Dialogs and gates — sign-in + the auth wall, the shared sim trade-entry dialog (both variants),
// the "what's sent" drawer, persona editor + picker, order detail, scan view editor, 404, operator pages.
import { backdrop, dialogFrame, icon, seq, wordmark } from '../lib.mjs';
import { PERSONAS } from '../data/index.mjs';

export const DIALOGS_CSS = `
  .dlg-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
  .legs { display: grid; grid-template-columns: 70px 1fr 90px 90px 90px; gap: 8px; align-items: center; font-size: 12.5px; }
  .op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .picker { display: flex; flex-direction: column; }
  @media (max-width: 999px) { .dlg-2, .op-grid { grid-template-columns: 1fr; } }
  @media (max-width: 599px) { .legs { grid-template-columns: 60px 1fr 70px; } .legs .opt { display: none; } }
`;

const label = (t) => `<span class="caps" style="display: block; margin-bottom: 6px;">${t}</span>`;
const frameNote = (title, note) => `<div style="display: flex; flex-direction: column; gap: 10px; min-width: 0;"><div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;"><span style="font-size: 13px; font-weight: 700;">${title}</span><span style="font-size: 11.5px; color: var(--steel);">${note}</span></div>`;

export function authBody({ minHeight = 940 } = {}) {
  const dialog = dialogFrame('Sign in', `
    <div class="seg" style="align-self: flex-start;"><span class="on">Sign in</span><span>Create your account</span></div>
    <button class="btn secondary lg" style="width: 100%; justify-content: center;">${icon('google', 16)} Continue with Google</button>
    <div style="display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--steel-2);"><span style="flex: 1; height: 1px; background: var(--line);"></span>or<span style="flex: 1; height: 1px; background: var(--line);"></span></div>
    <div>${label('Email')}<div class="field focus"><span class="mono">rodrigo@</span><span style="width: 1px; height: 16px; background: var(--amber);"></span></div></div>
    <div>${label('Password')}<div class="field"><span class="ph">••••••••</span><span style="flex: 1;"></span><span style="display: inline-flex; color: var(--steel);">${icon('eye', 15)}</span></div></div>
    <button class="btn primary lg" style="width: 100%;">Continue</button>
    <p style="margin: 0; font-size: 11.5px; color: var(--steel); line-height: 1.5; text-align: center;">Ticker analysis stays free — open any symbol without an account. Signing in unlocks the Scanner, a persisted sim book and AI reads on your own key.</p>
  `, { width: 440 });

  const wall = `<div style="width: 100%; min-height: 560px; background: var(--ink); border: 1px solid var(--line-2); border-radius: 14px; overflow: hidden;">
    <div class="nav-bar" style="position: static;"><div class="wrap nav-in">${wordmark(17)}<span style="flex: 1;"></span><a href="#" class="btn ghost sm">Log in</a><a href="#" class="btn primary sm" style="border-radius: 999px;">Sign up</a></div></div>
    <div class="wrap" style="padding: 48px 0 40px; display: flex; justify-content: center;">
      <div class="panel" style="width: min(560px, 100%); padding: 28px; display: flex; flex-direction: column; gap: 14px; text-align: center; align-items: center;">
        <span style="display: inline-flex; width: 44px; height: 44px; border-radius: 12px; background: var(--raised); color: var(--amber-text); align-items: center; justify-content: center;">${icon('radar', 20)}</span>
        <span class="chip outline">Private testing</span>
        <h1 class="display" style="margin: 0; font-size: 26px;">The Scanner needs a sign-in.</h1>
        <p style="margin: 0; font-size: 13.5px; color: var(--steel); line-height: 1.55; max-width: 440px;">See ranked dealer-gamma setups across the universe, then jump into any name for walls, flip, and flow.</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;"><button class="btn primary">Sign in</button><button class="btn secondary">Create your account</button></div>
        <p style="margin: 0; font-size: 12px; color: var(--steel-2);">Ticker analysis stays free — <a href="#">open any symbol without an account</a>.</p>
      </div>
    </div>
  </div>`;

  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 32px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 22px;">
    <div><div class="caps" style="color: var(--amber-text);">Auth</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(22px, 2.4vw, 28px);">Sign in, and the wall it stands behind</h1></div>
    <div class="dlg-2">
      ${frameNote('Sign-in dialog', 'opens from any gated action · Google first, email second')}${backdrop(dialog, { minHeight: 560 }).replace('min-height: 560px; background: var(--ink); color: var(--phosphor); overflow: hidden;', 'min-height: 560px; background: var(--ink); color: var(--phosphor); overflow: hidden; border: 1px solid var(--line-2); border-radius: 14px;')}<p style="margin: 0; font-size: 11.5px; color: var(--steel); line-height: 1.5;">The dialog never blocks reading: it opens over the desk, the desk keeps updating behind it, and closing it leaves you where you were. Errors are inline under the field, never a toast.</p></div>
      ${frameNote('Auth wall · Scanner and Positions', 'private testing · UX only, the server refuses signed-out callers too')}${wall}<p style="margin: 0; font-size: 11.5px; color: var(--steel); line-height: 1.5;">Copy is the product’s own gate text. The free path is always offered beside the sign-in so nobody hits a dead end.</p></div>
    </div>
  </div>`;
}

export function tradeEntryBody({ minHeight = 1100 } = {}) {
  const legRow = (side, contract, price, mid, qty) => `<div class="legs" style="padding: 8px 0; border-top: 1px solid var(--line);"><span class="chip outline" style="justify-content: center;">${side}</span><span class="mono" style="font-size: 12.5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${contract}</span><div class="field mono opt" style="height: 30px; font-size: 12px; padding: 0 8px;">${price}</div><span class="mono opt" style="font-size: 11.5px; color: var(--steel);">mid ${mid}</span><div class="field mono" style="height: 30px; font-size: 12px; padding: 0 8px;">${qty}</div></div>`;

  const position = dialogFrame('Review simulated trade', `
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; background: var(--amber-tint); font-size: 12px; flex-wrap: wrap;"><span class="amber" style="display: inline-flex;">${icon('sparkle', 13)}</span><span>Pre-filled from the AI read · Balanced Swinger · as of 10:41:52 ET · <span class="mono">9f2c…</span></span><span style="margin-left: auto; color: var(--steel);">sizing is your call</span></div>
    <div class="grid-2" style="gap: 12px;"><div>${label('Structure')}<div class="field"><span>Bull call spread</span><span style="flex: 1;"></span>${icon('chevron', 14)}</div></div><div>${label('Fill mode')}<span class="seg" style="width: 100%;"><span class="on" style="flex: 1; text-align: center;">Market · mid</span><span style="flex: 1; text-align: center;">Manual price</span></span></div></div>
    <div><div class="legs caps" style="padding-bottom: 4px;"><span>Side</span><span>Contract</span><span class="opt">Price</span><span class="opt">Basis</span><span>Qty</span></div>${legRow('Buy', 'SPY 575C · Sep 18', '2.46', '2.46', '2')}${legRow('Sell', 'SPY 580C · Sep 18', '0.36', '0.36', '2')}</div>
    <div class="grid-2" style="gap: 12px;"><div>${label('Stop (optional)')}<div class="field mono">568.50<span style="flex: 1;"></span><span class="chip outline" style="height: 18px; font-size: 11px;">the flip</span></div></div><div>${label('Target (optional)')}<div class="field mono">579.50<span style="flex: 1;"></span><span class="chip outline" style="height: 18px; font-size: 11px;">AI-stated</span></div></div></div>
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--raised);">${[['Net debit', '$420', '2.10 × 2'], ['Max loss', '$420', 'defined risk'], ['Cap check', 'within', '$500 · 2% of account']].map(([l, v, s]) => `<div class="cell"><span class="caps">${l}</span><span class="v" style="font-size: 18px;">${v}</span><span class="s">${s}</span></div>`).join('')}</div>
    <p style="margin: 0; font-size: 11.5px; color: var(--steel); line-height: 1.5;">Fills are modeled at the mid — no slippage, no partial fills, no assignment. Stop and target are carried onto the position as plan data; exits stay manual.</p>
  `, { width: 640, chip: '<span class="chip outline">SIMULATED</span>', footer: `<span style="font-size: 11.5px; color: var(--steel-2); flex: 1 1 200px;">Nothing is saved until you confirm.</span><button class="btn ghost">Cancel</button><button class="btn primary">Confirm paper trade</button>` });

  const order = dialogFrame('Simulated order — act on this rec', `
    <div style="font-size: 12px; color: var(--steel);">From AI read · Balanced Swinger · as of 10:41:52 ET</div>
    <div>${label('Entry trigger')}<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"><div class="field mono" style="flex: 1 1 160px;">SPY mid ≥ 573.00</div><span class="chip emph">Derived from the rec</span></div><div style="margin-top: 8px; padding: 10px 12px; border-radius: 8px; background: var(--ink-2); border: 1px solid var(--line);"><span class="caps" style="font-size: 11px;">The rec’s own words</span><p style="margin: 4px 0 0; font-size: 12.5px; line-height: 1.5;">“Enter near 573 on a pullback to VWAP; the flip below is the invalidation.”</p></div></div>
    <div>${label('Entry price')}<span class="seg" style="width: 100%;"><span class="on" style="flex: 1; text-align: center;">Limit</span><span style="flex: 1; text-align: center;">Market on trigger</span></span><div style="display: flex; gap: 8px; margin-top: 8px; align-items: center; flex-wrap: wrap;"><div class="field mono" style="width: 120px;">2.40</div><span style="font-size: 11.5px; color: var(--steel); flex: 1 1 200px;">After the trigger, rests at your limit and fills only on a live cross at that price. Fill price = the limit.</span></div></div>
    <div class="grid-2" style="gap: 12px;"><div>${label('Stop')}<div class="field mono">568.50</div></div><div>${label('Target')}<div class="field mono">579.50</div></div></div>
    <p style="margin: -6px 0 0; font-size: 11.5px; color: var(--steel);">Carried onto the position as plan data. Exits stay manual — nothing sells automatically.</p>
    <div>${label('Good-til')}<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"><div class="field mono" style="width: 170px;">${icon('calendar', 14)} Sep 10 · 7 days</div><span style="font-size: 11.5px; color: var(--steel); flex: 1 1 200px;">Every order needs a bound. Defaults to 7 days, capped at the contract’s expiration; the order expires then if it hasn’t filled.</span></div></div>
    <div style="display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--signal-tint); border: 1px solid var(--signal); font-size: 12px; line-height: 1.45;"><span class="signal" style="display: inline-flex; margin-top: 1px;">${icon('info', 14)}</span><span>Condition already met — SPY is already above 573.00 on live data. This order will trigger on the first live update after you place it.</span></div>
    <div style="display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line-2); font-size: 12px; line-height: 1.45; color: var(--steel);"><span style="display: inline-flex; margin-top: 1px;">${icon('shield', 14)}</span><span>Simulated only — no real order is ever placed. Once confirmed, this order can trigger and fill unattended whenever a live stream for SPY is open in this browser. Orders are stored in this browser — not synced to your account.</span></div>
  `, { width: 640, chip: '<span class="chip outline">SIMULATED</span>', footer: `<span style="flex: 1;"></span><button class="btn ghost">Cancel</button><button class="btn primary">Place simulated order</button>` });

  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 32px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 22px;">
    <div><div class="caps" style="color: var(--amber-text);">The one shared sim entry dialog</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(22px, 2.4vw, 28px);">Two variants, one component, no real-order path</h1><p style="margin: 8px 0 0; max-width: 780px; font-size: 13px; color: var(--steel); line-height: 1.55;">Every simulated entry — the desk CTA, accepting a read, acting on a read — is this dialog. The order variant adds a trigger, entry price and good-til; the six binding disclosures ship verbatim. A real-money entry, if it ever exists, is a separate component by rule.</p></div>
    <div class="dlg-2">
      ${frameNote('Position variant', 'Review simulated trade · pre-filled from the read')}${position}</div>
      ${frameNote('Order variant', 'act on the rec · watches the live mid unattended')}${order}</div>
    </div>
  </div>`;
}

export function whatsSentBody({ minHeight = 960 } = {}) {
  const section = (t, body, copy = true) => `<div style="border-top: 1px solid var(--line); padding: 12px 0;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"><span style="font-size: 13px; font-weight: 600;">${t}</span><span style="flex: 1;"></span>${copy ? `<button class="btn ghost sm">${icon('copy', 13)} Copy</button>` : ''}</div>${body}</div>`;
  const code = (lines) => `<pre class="mono" style="margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--ink-2); border: 1px solid var(--line); font-size: 11px; line-height: 1.55; color: var(--steel); white-space: pre-wrap; word-break: break-word;">${lines.join('\n')}</pre>`;
  const drawer = `<aside class="panel" style="width: min(520px, 100%); min-height: 100%; border-radius: 0; border-top: 0; border-bottom: 0; border-right: 0; box-shadow: var(--e4); display: flex; flex-direction: column;">
    <div style="display: flex; align-items: center; gap: 10px; padding: 16px 20px; border-bottom: 1px solid var(--line);"><h2 style="margin: 0; font-size: 15px; font-weight: 700;">What’s sent to the AI · SPY</h2><span style="flex: 1;"></span><button class="btn primary sm">${icon('copy', 13)} Copy all</button><span style="display: inline-flex; color: var(--steel);">${icon('close', 16)}</span></div>
    <div style="padding: 14px 20px; overflow: auto; flex: 1;">
      <p style="margin: 0 0 12px; font-size: 12.5px; line-height: 1.55; color: var(--phosphor);">This is the complete, reviewable list of what leaves the machine for SPY, on demand: the computed snapshot, your persona’s prompt, and the field glossary. No other ticker, no account or identity, no broker/order data, and no API key ever leave.</p>
      ${section('Computed snapshot (context)', code(['ticker: SPY · as_of: 2026-09-03T14:41:52Z · gex_spot: 573.05', 'call_wall: 580 · put_wall: 560 · gamma_flip: 568.50 · max_pain: 570', 'net_gex: 1.94e9 (vol-norm) · raw 1.62e9 · net_dex: -4.12e8', 'iv_hv_ratio: 0.82 · iv_rank: 34 · chain_vol_oi: 0.61 · regime: positive_gamma', 'setups: [pin_into_call_wall (high), flip_reclaim (medium)]']))}
      ${section('Candidate contracts', code(['SPY 250918C00575000 · bid 2.38 / ask 2.42 · OI 41,200 · vol 12,100', 'SPY 250918C00580000 · bid 0.34 / ask 0.38 · OI 58,900 · vol 18,400', 'set: live-session · as of 14:41 ET · median spread 0.02']))}
      ${section('Risk inputs · as sent', code(['state: set · account_size: 25000 · per_trade_cap: 2 percent', 'effective_dollar_cap: 500 (derived) · storage_available: true']))}
      ${section('Open positions', code(['this_underlying: long · legs 2 · nearest_expiry 15 DTE · max_loss 420', 'portfolio: open_count 2 · capital_at_risk 1060']))}
      ${section('Persona prompt', code(['Balanced Swinger · directional_swing · moderate risk · DTE 14–45', 'Frame balanced directional swings; risk first; pass readily when the edge is thin.']))}
      ${section('Field glossary', `<p style="margin: 0; font-size: 12px; color: var(--steel); line-height: 1.5;">Definitions for every field above, so the model reads gamma_flip as the analytic zero-crossing and never as “the wall’s midpoint”. <a href="#">Show 22 terms</a></p>`, false)}
    </div>
    <div style="padding: 10px 20px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--steel);"><span class="chip" style="height: 20px;">${icon('check', 11)} Export copied.</span><span>Manual hand-off works without a key and costs nothing.</span></div>
  </aside>`;
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 32px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 22px;">
    <div><div class="caps" style="color: var(--amber-text);">Egress honesty</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(22px, 2.4vw, 28px);">“What’s sent” drawer</h1><p style="margin: 8px 0 0; max-width: 780px; font-size: 13px; color: var(--steel); line-height: 1.55;">Reachable from every AI-read state, signed in or not. Sections that would not be sent in the current state render as “not sent” rather than disappearing.</p></div>
    <div style="border: 1px solid var(--line-2); border-radius: 14px; overflow: hidden;">${backdrop(drawer, { align: 'right', minHeight: 760 })}</div>
  </div>`;
}

export function personaBody({ minHeight = 900 } = {}) {
  const presets = PERSONAS;
  const form = dialogFrame('Customize persona', `
    <div class="grid-2" style="gap: 12px;"><div>${label('Persona name')}<div class="field focus"><span>My pin trader</span><span style="width: 1px; height: 16px; background: var(--amber);"></span></div></div><div>${label('Based on')}<div class="field"><span>Balanced Swinger</span><span style="flex: 1;"></span>${icon('chevron', 14)}</div></div></div>
    <div class="grid-2" style="gap: 12px;"><div>${label('Objective')}<span class="seg" style="width: 100%;"><span style="flex: 1; text-align: center;">Income</span><span class="on" style="flex: 1; text-align: center;">Directional</span><span style="flex: 1; text-align: center;">Hedging</span></span></div><div>${label('Risk')}<span class="seg" style="width: 100%;"><span style="flex: 1; text-align: center;">Conservative</span><span class="on" style="flex: 1; text-align: center;">Moderate</span><span style="flex: 1; text-align: center;">Aggressive</span></span></div></div>
    <div>${label('DTE window')}<div style="display: flex; gap: 8px; align-items: center;"><div class="field mono" style="width: 90px;">14</div><span class="steel">to</span><div class="field mono" style="width: 90px;">35</div><span style="font-size: 11.5px; color: var(--steel);">pre-fills the desk’s expiration filter</span></div></div>
    <div>${label('Emphasis note')}<div class="field" style="height: auto; min-height: 76px; align-items: flex-start; padding: 10px 12px; line-height: 1.5;">Prefer pins into the call wall in positive gamma; pass on breakouts unless net flow confirms for 15 minutes.</div><div style="font-size: 11.5px; color: var(--steel); margin-top: 5px;">Appended to the persona prompt verbatim — you can review it in “What’s sent”.</div></div>
  `, { width: 600, footer: `<span style="font-size: 11.5px; color: var(--steel-2); flex: 1 1 200px;">Personas frame the read; they never touch the score.</span><button class="btn ghost">Cancel</button><button class="btn primary">Save persona</button>` });
  const picker = `<div class="panel picker" style="width: min(360px, 100%); box-shadow: var(--e4); background: var(--raised); overflow: hidden;">
    <div style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--line);"><span class="caps">Persona</span><span style="flex: 1;"></span><a href="#" style="font-size: 12px;">Customize…</a></div>
    ${presets.map(([n, s, dte, risk], i) => `<div style="display: flex; align-items: flex-start; gap: 10px; padding: 9px 14px; ${i === 4 ? 'background: var(--raised-2);' : ''}"><span style="width: 16px; display: inline-flex; color: var(--amber-text); margin-top: 2px;">${i === 4 ? icon('check', 14) : ''}</span><div style="flex: 1; min-width: 0;"><div style="font-size: 13px; font-weight: 600;">${n}</div><div style="font-size: 11.5px; color: var(--steel);">${s}</div></div><div style="text-align: right; flex-shrink: 0;"><div class="mono" style="font-size: 11px;">${dte}</div><div style="font-size: 11px; color: var(--steel-2);">${risk}</div></div></div>`).join('')}
    <div style="padding: 8px 14px; border-top: 1px solid var(--line); font-size: 11px; color: var(--steel-2);">Your customs appear below the presets.</div>
  </div>`;
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 32px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 22px;">
    <div><div class="caps" style="color: var(--amber-text);">Personas</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(22px, 2.4vw, 28px);">Picker and customize form</h1></div>
    <div class="dlg-2">${frameNote('Customize form', 'a custom persona starts from a preset')}${form}</div>${frameNote('Picker popover', 'opens from the desk masthead and the AI read composer')}${picker}</div></div>
  </div>`;
}

export function orderDetailBody({ minHeight = 760 } = {}) {
  const dialog = (evaluated) => dialogFrame('Simulated order · SPY 575C', `
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">${evaluated ? '<span class="chip live"><span class="dot"></span>watching</span>' : '<span class="chip warn">' + icon('warn', 11) + ' Waiting for live data — not currently evaluated</span>'}<span class="mono" style="font-size: 11px; color: var(--steel);">ord_7f31 · created 10:02 ET</span></div>
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;">${[['Trigger', 'mid ≥ 573.00', 'derived from the rec'], ['Entry', 'limit 2.40', 'fills on a live cross'], ['Stop · Target', '568.50 · 579.50', 'plan data'], ['Good-til', 'Sep 10', '7 days · exp Sep 18']].map(([l, v, s]) => `<div class="cell" style="padding: 10px 12px; border-radius: 10px; background: var(--ink-2); border: 1px solid var(--line);"><span class="caps">${l}</span><span class="mono" style="font-size: 14px; font-weight: 500;">${v}</span><span class="s">${s}</span></div>`).join('')}</div>
    <div>${label('Timeline')}<div style="display: flex; flex-direction: column; gap: 0;">${[['10:02 ET', 'Placed from AI read · Balanced Swinger', true], ['10:02 ET', 'Condition already met at placement — arms on first live update', true], [evaluated ? '10:42 ET' : '—', evaluated ? 'Watching · mid 573.12 · mark 2.46 above limit 2.40' : 'No live stream for SPY open in this tab · will not catch up on missed moves', evaluated], ['—', 'Fill · pending', false]].map(([t, d, done]) => `<div style="display: grid; grid-template-columns: 70px 16px 1fr; gap: 10px; align-items: start; padding: 6px 0;"><span class="mono" style="font-size: 11px; color: var(--steel);">${t}</span><span style="width: 10px; height: 10px; border-radius: 50%; margin-top: 3px; background: ${done ? 'var(--signal)' : 'var(--line-2)'};"></span><span style="font-size: 12.5px; color: ${done ? 'var(--phosphor)' : 'var(--steel)'};">${d}</span></div>`).join('')}</div></div>
    ${evaluated ? '' : `<p style="margin: 0; font-size: 11.5px; color: var(--steel); line-height: 1.5;">Open SPY’s ticker page during live hours to watch it. It can still expire on the clock, and you can still cancel it.</p>`}
  `, { width: 560, chip: '<span class="chip outline">SIMULATED</span>', footer: `<span style="font-size: 11.5px; color: var(--steel-2); flex: 1 1 200px;">Stored in this browser · never sent to a broker</span><button class="btn secondary">Cancel order</button><button class="btn ghost">Close</button>` });
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 32px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 22px;">
    <div><div class="caps" style="color: var(--amber-text);">Sim orders</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(22px, 2.4vw, 28px);">Order detail · watching vs not evaluated</h1></div>
    <div class="dlg-2">${frameNote('Watching', 'a live SPY stream is open in this tab')}${dialog(true)}</div>${frameNote('Not evaluated', 'the honest coverage state · never hidden on a non-terminal order')}${dialog(false)}</div></div>
  </div>`;
}

export function viewEditorBody({ minHeight = 900 } = {}) {
  const universe = ['SPY', 'QQQ', 'IWM', 'DIA', 'SMH', 'XLF', 'XLE', 'XLK', 'GLD', 'TLT', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AVGO', 'AMD', 'NFLX'];
  const selected = ['NVDA', 'SPY', 'AAPL', 'QQQ', 'MSFT', 'IWM', 'TSLA', 'AMD'];
  const dialog = dialogFrame('Edit your scan view', `
    <div class="grid-2" style="gap: 16px; align-items: start;">
      <div style="min-width: 0;">${label('Tracked universe · 69')}<div class="field" style="margin-bottom: 8px;">${icon('search', 14)}<span class="ph">Filter the universe…</span></div><div style="border: 1px solid var(--line); border-radius: 10px; max-height: 320px; overflow: auto;">${universe.map((s) => { const on = selected.includes(s); return `<label style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-top: 1px solid var(--line); font-size: 12.5px; cursor: pointer;"><span style="width: 16px; height: 16px; border-radius: 4px; border: 1px solid ${on ? 'var(--amber)' : 'var(--line-2)'}; background: ${on ? 'var(--amber)' : 'transparent'}; color: var(--amber-ink); display: inline-flex; align-items: center; justify-content: center;">${on ? icon('check', 12) : ''}</span><span class="mono" style="font-weight: 600;">${s}</span><span style="flex: 1;"></span><span style="font-size: 11px; color: var(--steel-2);">${['SPY', 'QQQ', 'IWM', 'DIA'].includes(s) ? 'index' : ['SMH', 'XLF', 'XLE', 'XLK', 'GLD', 'TLT'].includes(s) ? 'sector' : 'megacap'}</span></label>`; }).join('')}</div><p style="margin: 8px 0 0; font-size: 11.5px; color: var(--steel);">Pick from the tracked universe. The universe is server-curated — it cannot be added to here.</p></div>
      <div style="min-width: 0;">${label('In your view (drag order = display order)')}<div style="border: 1px solid var(--line); border-radius: 10px;">${selected.map((s, i) => `<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; ${i ? 'border-top: 1px solid var(--line);' : ''} font-size: 12.5px;"><span style="display: inline-flex; color: var(--steel-2); cursor: grab;">${icon('grip', 14)}</span><span class="mono" style="font-weight: 600;">${s}</span><span style="flex: 1;"></span><span style="display: inline-flex; gap: 2px;"><span style="display: inline-flex; color: var(--steel);">${icon('up', 14)}</span><span style="display: inline-flex; color: var(--steel);">${icon('down', 14)}</span><span style="display: inline-flex; color: var(--steel-2); margin-left: 6px;">${icon('close', 14)}</span></span></div>`).join('')}</div><div style="margin-top: 12px;">${label('View name (optional)')}<div class="field"><span class="ph">Morning desk</span></div></div></div>
    </div>
  `, { width: 780, footer: `<span style="font-size: 11.5px; color: var(--steel-2); flex: 1 1 200px;">Saved views need a sign-in — never claimed for anonymous visitors.</span><button class="btn ghost">Cancel</button><button class="btn primary">Save view</button>` });
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 32px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 22px;">
    <div><div class="caps" style="color: var(--amber-text);">Scanner</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(22px, 2.4vw, 28px);">View editor</h1></div>
    <div style="display: flex; justify-content: center;">${dialog}</div>
  </div>`;
}

export function notFoundBody({ minHeight = 640 } = {}) {
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 32px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 22px;">
    <div><div class="caps" style="color: var(--amber-text);">Shell</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(22px, 2.4vw, 28px);">Route fallback and not found</h1></div>
    <div class="dlg-2">
      ${frameNote('Loading a route', 'lazy chunk in flight · under 300ms it never shows')}<div style="border: 1px solid var(--line-2); border-radius: 14px; background: var(--ink); overflow: hidden; min-height: 360px;"><div class="nav-bar" style="position: static;"><div class="wrap nav-in">${wordmark(17)}<span style="flex: 1;"></span><span class="skel" style="width: 30px; height: 30px; border-radius: 50%;"></span></div></div><div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 90px 20px; color: var(--steel);"><span style="width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--amber); animation: spin 0.9s linear infinite;"></span><span style="font-size: 12.5px;">Loading the Scanner…</span></div></div></div>
      ${frameNote('Nothing at this address', '404 · the shell stays')}<div style="border: 1px solid var(--line-2); border-radius: 14px; background: var(--ink); overflow: hidden; min-height: 360px;"><div class="nav-bar" style="position: static;"><div class="wrap nav-in">${wordmark(17)}<span style="flex: 1;"></span><span style="width: 30px; height: 30px; border-radius: 50%; background: var(--amber); color: var(--amber-ink); display: inline-flex; align-items: center; justify-content: center; font: 700 12px/1 'IBM Plex Sans', sans-serif;">R</span></div></div><div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; text-align: center;"><span class="mono" style="font-size: 12px; color: var(--steel-2);">404</span><h2 class="display" style="margin: 0; font-size: 26px;">Nothing at this address.</h2><p style="margin: 0; font-size: 13px; color: var(--steel); max-width: 380px;">The desk is one symbol away. Ticker analysis is free; the rest is behind a sign-in.</p><div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;"><a href="#" class="btn primary">Open the Ticker ${icon('arrow', 14)}</a><a href="#" class="btn secondary">Home</a></div></div></div></div>
    </div>
  </div>`;
}

export function operatorBody({ minHeight = 1080 } = {}) {
  const stages = [['vendor_fetch', '#4e79a7', 12], ['engine_build', '#f28e2b', 5], ['off_exchange', '#59a14f', 8], ['signals', '#b07aa1', 3], ['persist', '#76b7b2', 9], ['serialize_wrap', '#edc949', 2]];
  const chart = `<svg viewBox="0 0 720 200" preserveAspectRatio="none" style="display: block; width: 100%; height: 200px;" aria-label="Latency by stage">${[40, 80, 120, 160].map((y) => `<line x1="0" y1="${y}" x2="720" y2="${y}" stroke="var(--line)"></line>`).join('')}${stages.map(([, c, seed]) => { const v = seq(40, seed, 0, 1); const min = Math.min(...v), max = Math.max(...v); const d = v.map((x, i) => `${i ? 'L' : 'M'} ${(i / 39 * 720).toFixed(1)} ${(180 - ((x - min) / (max - min || 1)) * 120 - (seed % 4) * 8).toFixed(1)}`).join(' '); return `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>`; }).join('')}<circle cx="540" cy="70" r="3" fill="#9e9e9e"></circle><circle cx="612" cy="82" r="3" fill="#9e9e9e"></circle></svg>`;
  const bar = `<div style="height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 clamp(16px, 3vw, 40px); border-bottom: 1px solid var(--line); background: var(--panel);">${wordmark(15)}<span class="chip outline">operator</span><span class="mono" style="font-size: 12px; color: var(--steel);">/_ops/metrics</span><span style="flex: 1;"></span><span style="font-size: 11.5px; color: var(--steel-2);">off the trader shell · URL-only · token-gated in production</span></div>`;
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${bar}
    <div style="padding: 24px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 22px;">
      <div><div class="caps" style="color: var(--amber-text);">Operator surfaces</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(22px, 2.4vw, 28px);">Metrics and the research archive</h1><p style="margin: 8px 0 0; max-width: 780px; font-size: 13px; color: var(--steel); line-height: 1.55;">Same tokens and type, denser and drier. Diagnostic series colours are the mode-invariant categorical palette — deliberately outside the brand palette.</p></div>
      <div class="op-grid">
        <section class="panel" style="overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 10px; padding: 14px 16px 8px; flex-wrap: wrap;"><h2 style="margin: 0; font-size: 14px; font-weight: 600;">Latency by stage</h2><span style="font-size: 11.5px; color: var(--steel);">last 40 bundles · ms</span><span style="flex: 1;"></span><span class="seg"><span class="on">SPY</span><span>QQQ</span><span>all</span></span></div>
          <div class="well" style="padding: 10px 8px 4px;">${chart}</div>
          <div style="display: flex; gap: 12px; padding: 8px 16px 12px; flex-wrap: wrap; font-size: 11px; color: var(--steel);">${stages.map(([n, c]) => `<span style="display: inline-flex; align-items: center; gap: 5px;"><span style="width: 10px; height: 2px; background: ${c};"></span>${n}</span>`).join('')}<span style="display: inline-flex; align-items: center; gap: 5px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #9e9e9e;"></span>stale repeat</span></div>
          <div style="border-top: 1px solid var(--line);"><div class="caps" style="display: grid; grid-template-columns: 1.2fr 70px 90px 70px 90px 70px; gap: 8px; padding: 8px 16px;"><span>trace_id</span><span>ticker</span><span>kind</span><span>total</span><span>ok/err/skip</span><span>cache</span></div>${[['tr_9f2c11', 'SPY', 'ensure', '412', '6/0/0', 'miss'], ['tr_9f2c0e', 'SPY', 'warm', '38', '1/0/5', 'hit'], ['tr_9f2bf7', 'NVDA', 'scan', '388', '6/0/0', 'miss'], ['tr_9f2bd0', 'QQQ', 'ensure', '451', '5/1/0', 'miss']].map((r) => `<div class="mono" style="display: grid; grid-template-columns: 1.2fr 70px 90px 70px 90px 70px; gap: 8px; padding: 7px 16px; border-top: 1px solid var(--line); font-size: 11.5px;">${r.map((c, i) => `<span style="${i === 4 && c.includes('/1/') ? 'color: var(--warn); display: inline-flex; align-items: center; gap: 4px;' : ''}">${i === 4 && c.includes('/1/') ? icon('warn', 11) : ''}${c}</span>`).join('')}</div>`).join('')}</div>
        </section>
        <section class="panel" style="overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 10px; padding: 14px 16px 8px; flex-wrap: wrap;"><h2 style="margin: 0; font-size: 14px; font-weight: 600;">Session archive · /_ops/research</h2><span style="font-size: 11.5px; color: var(--steel);">(symbol, et_date) books · bodies on the archive root</span></div>
          <div style="display: flex; gap: 8px; padding: 4px 16px 10px; flex-wrap: wrap;"><div class="field mono" style="height: 32px; font-size: 12px; width: 120px;">SPY</div><div class="field mono" style="height: 32px; font-size: 12px; width: 150px;">${icon('calendar', 13)} 2026-09</div><span class="chip outline" style="height: 32px;">48 / 14d ring · 3 symbols ensured</span></div>
          <div style="border-top: 1px solid var(--line);"><div class="caps" style="display: grid; grid-template-columns: 80px 110px 90px 1fr 80px; gap: 8px; padding: 8px 16px;"><span>symbol</span><span>et_date</span><span>source</span><span>source_as_of</span><span></span></div>${[['SPY', '2026-09-03', 'live', '14:41:52Z · 412 snapshots · open'], ['SPY', '2026-09-02', 'live', '20:00:04Z · 780 snapshots · complete'], ['QQQ', '2026-09-03', 'live', '14:41:50Z · 410 snapshots · open'], ['IWM', '2026-09-02', 'fixture', '20:00:01Z · replay']].map((r) => `<div class="mono" style="display: grid; grid-template-columns: 80px 110px 90px 1fr 80px; gap: 8px; padding: 7px 16px; border-top: 1px solid var(--line); font-size: 11.5px; align-items: center;">${r.map((c) => `<span>${c}</span>`).join('')}<a href="#" style="font-size: 11.5px;">inspect</a></div>`).join('')}</div>
          <p style="margin: 0; padding: 10px 16px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--steel);">Zero vendor calls. Research CLIs authorize nothing on the live score; the trader origin 404s this path.</p>
        </section>
      </div>
    </div>
  </div>`;
}
