// The Ticker desk (SPY) — one fluid body rendered at every frame width. Interactive: AI-read state,
// liveness, scheme, sheet peek (phone), Field/Magnet hero toggle.
import { SPY, footer, icon, labelInfo, magnetView, nav, ring, seq, sparkline, structureField, termRibbon, widgetHead } from '../lib.mjs';
import { figureCell as cell } from '../components/figure-cell.mjs';
import { LADDER_CSS, ladderRow } from '../components/ladder.mjs';
import { riskField } from '../components/risk-field.mjs';

export const DESK_CSS = `${LADDER_CSS}
  .desk { width: 100%; background: var(--ink); color: var(--phosphor); }
  .mast { padding-top: 20px; padding-bottom: 12px; }
  .mast-row { display: flex; align-items: flex-start; gap: 16px 28px; flex-wrap: wrap; }
  .mast-title { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .mast-sym, .mast-price { font-size: clamp(30px, 3vw, 42px); letter-spacing: -0.02em; }
  .mast-meta { display: flex; align-items: center; gap: 10px 12px; margin-top: 6px; font-size: 12.5px; color: var(--steel); flex-wrap: wrap; }
  .mast-controls { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-wrap: wrap; }
  .quick { display: flex; align-items: center; gap: 8px; margin-top: 14px; overflow-x: auto; scrollbar-width: none; }
  .quick::-webkit-scrollbar { display: none; }
  .quick-note { margin-left: auto; white-space: nowrap; font-size: 11.5px; color: var(--steel-2); }
  .field-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; }
  .field-main { min-width: 0; padding: 10px 6px 0; }
  .ladder { border-left: 1px solid var(--line); padding: 12px 18px 14px; display: flex; flex-direction: column; }
  .ladder-rows { margin-top: 6px; }
  .ladder-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .tape-row { display: flex; align-items: center; gap: 14px; padding: 8px 14px 12px; border-top: 1px solid var(--line); margin-top: 6px; }
  .path-row { display: flex; align-items: center; gap: 12px 18px; padding: 8px 14px 12px; border-top: 1px solid var(--line); flex-wrap: wrap; }
  .path-row .pr { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .path-row .pr-note { margin-left: auto; white-space: nowrap; font-size: 11px; color: var(--steel-2); }
  .sf-narrow { display: none; }
  .strip { display: grid; grid-template-columns: 1.35fr repeat(7, minmax(0, 1fr)); }
  .strip > * { border-right: 1px solid var(--line); min-width: 0; }
  .strip > *:last-child { border-right: 0; }
  .work { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 14px; align-items: stretch; }
  .side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .ai { position: relative; display: flex; flex-direction: column; min-height: 100%; }
  .ai-head { display: flex; align-items: center; gap: 10px; padding: 14px 20px 12px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .ai-cols { display: grid; grid-template-columns: 1.05fr 1fr; gap: 28px; padding: 16px 20px 6px; }
  .ai-peek { display: none; }
  .ai-foot { margin-top: auto; display: flex; align-items: center; gap: 12px; padding: 10px 20px 12px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--steel); flex-wrap: wrap; }
  .ai-foot .note { margin-left: auto; }
  .ai-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
  .ctx-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
  .ctx-head .rule { flex: 1; height: 1px; background: var(--line); min-width: 40px; }
  .ctx-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .ctx-span2 { grid-column: span 2; }
  .tape-grid { display: grid; grid-template-columns: 1fr 1fr; }
  .ctx-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .strip-dots { display: none; justify-content: center; gap: 4px; margin-top: 6px; }
  .ai-scrim { display: none; }
  .ai-mbar { display: none; }
  @media (min-width: 1600px) { .ctx-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } .field-grid { grid-template-columns: minmax(0, 1fr) 340px; } }
  @media (max-width: 1199px) { .work { grid-template-columns: 1fr; } .side { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 1099px) { .strip { display: flex; overflow-x: auto; scrollbar-width: none; } .strip::-webkit-scrollbar { display: none; } .strip > * { flex: 0 0 170px; } .strip > *:first-child { flex-basis: 250px; } .strip > *:last-child { border-right: 1px solid var(--line); } .strip-dots { display: flex; } }
  @media (max-width: 999px) { .field-grid { grid-template-columns: 1fr; } .ladder { border-left: 0; border-top: 1px solid var(--line); padding: 12px 14px; } .ladder-rows { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; } .lrow, .lrow.big { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; border-top: 0; padding: 8px 10px; border-radius: 8px; background: var(--ink-2); } .lrow .dist { min-width: 0; text-align: left; } .ladder-foot { margin-top: 12px; } .ctx-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 899px) { .ai-cols { grid-template-columns: 1fr; gap: 18px; } .side { grid-template-columns: 1fr; } }
  @media (max-width: 767px) {
    .desk { padding-bottom: calc(76px + env(safe-area-inset-bottom)); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
    .tape-row { flex-wrap: wrap; } .tape-row > div { flex: 1 1 100%; order: 3; }
    .path-row .pr-note { margin-left: 0; white-space: normal; }
    .ai-scrim { position: fixed; inset: 0; z-index: 29; background: var(--scrim); }
    .desk.is-peek .ai-scrim { display: none; } .desk:not(.is-peek) .ai-scrim { display: block; }
    .ai-mbar { display: flex; align-items: center; gap: 8px; padding: 10px 16px 0; flex-wrap: wrap; font-size: 11.5px; color: var(--steel); }
    .mast-controls { width: 100%; margin-left: 0; }
    .mast-controls .field { flex: 1 1 140px; }
    .mast-controls .btn { flex: 1 1 100%; height: 44px; }
    .quick-note { display: none; }
    .sf-wide { display: none; } .sf-narrow { display: block; }
    .ladder-rows { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ctx-grid { grid-template-columns: 1fr; } .ctx-span2 { grid-column: span 1; } .ctx-head .seg { margin-left: 0; width: 100%; overflow-x: auto; scrollbar-width: none; }
    .tape-row { padding-left: 10px; padding-right: 10px; }
    .ai { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; border-radius: 18px 18px 0 0; max-height: 82vh; overflow: auto; box-shadow: 0 -14px 36px rgba(0,0,0,0.42), var(--e4); min-height: 0; padding-bottom: env(safe-area-inset-bottom); }
    .ai-head { display: none; } .ai-foot { display: none; }
    .ai-peek { display: flex; align-items: center; gap: 8px; padding: 8px 16px 10px; cursor: pointer; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
    .ai-cols { padding: 12px 16px 16px; gap: 14px; }
    .is-peek .ai-body { display: none; }
    .ai-actions .btn { flex: 1 1 100%; height: 44px; }
    .work { gap: 12px; }
  }
`;

function aiComposer({ compact = false } = {}) {
  return `<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0;">
    <div class="field" style="height: 34px; gap: 8px; padding: 0 10px 0 12px;"><span class="caps" style="font-size: 11px;">Persona</span><span style="font-weight: 600; white-space: nowrap;">Balanced Swinger</span>${icon('chevron', 14)}</div>
    <div class="field mono" style="height: 34px; gap: 8px; padding: 0 10px 0 12px; font-size: 12px;"><span class="caps sans" style="font-size: 11px;">Model</span>claude-sonnet-5${icon('chevron', 14)}</div>
    ${compact ? '' : `<button class="btn primary" onClick="{{ask}}" style="margin-left: auto;">Analyze current snapshot ${icon('arrow', 15)}</button>`}
  </div>`;
}

function aiRead() {
  const provenance = `<div class="mono" style="display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--steel); flex-wrap: wrap;"><span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: var(--amber);"></span>read pinned</span><span>as of 10:41:52 ET · 48s ago</span><span>·</span><span>snapshot 9f2c…</span></div>`;

  const tradeBrief = `
    <div class="ai-cols">
      <div style="min-width: 0;">
        ${provenance}
        <div class="display" style="font-size: clamp(26px, 2.4vw, 32px); margin-top: 10px; letter-spacing: -0.015em;"><span class="amber">Trade</span><span class="dim" style="font-weight: 500;"> · </span>Bullish</div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 13px; color: var(--phosphor); flex-wrap: wrap;"><span style="font-weight: 600;">Bull call spread</span><span class="dim">·</span><span class="mono">575 / 580</span><span class="dim">·</span><span>Sep 18 <span class="steel">(15 DTE)</span></span><span class="dim">·</span><span class="chip emph">high confidence</span></div>
        <div style="margin-top: 16px;">
          <div class="caps" style="margin-bottom: 6px;">Why</div>
          <ul style="margin: 0; padding-left: 16px; font-size: 13px; line-height: 1.55; color: var(--phosphor); display: flex; flex-direction: column; gap: 4px;">
            <li>Mid sits <span class="mono">+0.81%</span> above the gamma flip, so dealer hedging dampens dips into <span class="mono">568.50</span>.</li>
            <li>The <span class="mono">580</span> call wall caps the upside — a defined-risk spread pays for the pin, not for a breakout.</li>
            <li>IV/HV at <span class="mono">0.82</span> reads cheap: buying the debit is favoured over selling premium.</li>
          </ul>
        </div>
        <div style="margin-top: 14px;">
          <div class="caps" style="margin-bottom: 6px;">Manage the trade</div>
          <p style="margin: 0; font-size: 13px; line-height: 1.55;">Take half at the call wall; trail the rest above VWAP. Exit on a close below the flip.</p>
        </div>
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--steel); display: flex; flex-direction: column; gap: 2px;">
          <span>What the numbers said · candidates tight, median spread <span class="mono">$0.02</span> · candidate set live-session, as of 10:41 ET</span>
          <span><span class="mono">±$8.40 (1.5%)</span> straddle-implied move for Sep 18</span>
        </div>
      </div>
      <div style="min-width: 0; display: flex; flex-direction: column; gap: 10px;">
        <div class="ctx-2">
          ${riskField({ label: 'Max risk', value: '$420', sub: 'debit paid · 1.7% of account' })}
          ${riskField({ label: 'Invalidation', value: '568.50', sub: 'traces to the gamma flip' })}
          ${riskField({ label: 'Entry', value: 'near 573', sub: 'on a pullback to VWAP 571.88' })}
          ${riskField({ label: 'Target', value: '579.50', sub: 'AI-stated · untraced', traced: false, mono: false })}
        </div>
        <div style="display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--raised); font-size: 12px; line-height: 1.45; color: var(--steel);"><span style="display: inline-flex; color: var(--steel); margin-top: 1px;">${icon('shield', 14)}</span><span><strong style="color: var(--phosphor); font-weight: 600;">3 of 4 checked figures trace to Convexa.</strong> The target is the model’s own number and renders in body type. Within your per-trade cap (<span class="mono">$500</span> · 2% of <span class="mono">$25,000</span>).</span></div>
        <div class="ai-actions">
          <button class="btn primary">Review simulated trade</button>
          <button class="btn secondary">Create sim order</button>
          <a href="#" class="btn link" style="margin-left: 4px;">Full analysis &amp; data ${icon('arrow', 14)}</a>
        </div>
        <p style="margin: 0; font-size: 11.5px; color: var(--steel-2);">Nothing is saved until you review the pre-filled trade and confirm. A read, not an order.</p>
      </div>
    </div>`;

  const noTrade = `
    <div class="ai-cols">
      <div style="min-width: 0;">
        ${provenance}
        <div class="display" style="font-size: clamp(26px, 2.4vw, 32px); margin-top: 10px; letter-spacing: -0.015em;">No trade<span class="dim" style="font-weight: 500;"> · </span><span class="steel" style="font-weight: 600; font-size: 0.7em;">sit this one out</span></div>
        <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.55; max-width: 520px;">Mid is pinned between the flip and the call wall with cheap vol but no directional flow. A “no trade” read is a complete, correct answer — the persona sees no edge worth the debit.</p>
        <div style="margin-top: 16px;">
          <div class="caps" style="margin-bottom: 6px;">Re-engage when</div>
          <ul style="margin: 0; padding-left: 16px; font-size: 13px; line-height: 1.55; display: flex; flex-direction: column; gap: 4px;">
            <li>Mid reclaims <span class="mono">575</span> with net flow positive for 15 minutes.</li>
            <li>Or the flip migrates above <span class="mono">570</span> on the next structure refresh.</li>
          </ul>
        </div>
        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--steel);">What the numbers said · candidates tight, median spread <span class="mono">$0.02</span> · <span class="mono">±$8.40 (1.5%)</span> implied move for Sep 18</div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; min-width: 0;">
        <div style="padding: 14px; border-radius: 10px; background: var(--ink-2); border: 1px solid var(--line);">
          <div class="caps">What would change the read</div>
          <div class="ctx-2" style="margin-top: 10px; gap: 12px;">
            <div><div class="mono" style="font-size: 18px;">575.00</div><div style="font-size: 11px; color: var(--steel);">reclaim level</div></div>
            <div><div class="mono" style="font-size: 18px;">+15m</div><div style="font-size: 11px; color: var(--steel);">positive net flow</div></div>
            <div><div class="mono" style="font-size: 18px;">&gt; 570</div><div style="font-size: 11px; color: var(--steel);">flip migration</div></div>
            <div><div class="mono" style="font-size: 18px;">~60s</div><div style="font-size: 11px; color: var(--steel);">next structure refresh</div></div>
          </div>
        </div>
        <div class="ai-actions">
          <button class="btn secondary">${icon('bell', 14)} Alert me at 575</button>
          <button class="btn ghost" onClick="{{ask}}">${icon('refresh', 14)} Refresh analysis</button>
          <a href="#" class="btn link" style="margin-left: 4px;">Full analysis &amp; data ${icon('arrow', 14)}</a>
        </div>
        <p style="margin: 0; font-size: 11.5px; color: var(--steel-2);">No simulated entry — nothing to review. Set an alert on the reclaim level instead.</p>
      </div>
    </div>`;

  const loading = `
    <div style="padding: 18px 20px 10px;">
      <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--amber); animation: livePulse 1.2s ease-in-out infinite;"></span>Thinking…</div>
        <div style="display: flex; align-items: center; gap: 14px; font-size: 12px; color: var(--steel); flex-wrap: wrap;">
          <span style="display: inline-flex; align-items: center; gap: 5px;"><span class="steel" style="display: inline-flex;">${icon('check', 12)}</span>Snapshot pinned 10:41:52</span>
          <span style="display: inline-flex; align-items: center; gap: 5px;"><span class="steel" style="display: inline-flex;">${icon('check', 12)}</span>Persona applied</span>
          <span style="display: inline-flex; align-items: center; gap: 5px; color: var(--phosphor);"><span class="mono">claude-sonnet-5</span> reading · usually 5–15 s</span>
        </div>
      </div>
      <div class="ai-cols" style="padding: 16px 0 0;">
        <div style="display: flex; flex-direction: column; gap: 10px;"><div class="skel" style="height: 30px; width: 46%;"></div><div class="skel" style="height: 14px; width: 68%;"></div><div class="skel" style="height: 12px; width: 92%; margin-top: 10px;"></div><div class="skel" style="height: 12px; width: 84%;"></div><div class="skel" style="height: 12px; width: 76%;"></div></div>
        <div class="ctx-2"><div class="skel" style="height: 74px;"></div><div class="skel" style="height: 74px;"></div><div class="skel" style="height: 74px;"></div><div class="skel" style="height: 74px;"></div></div>
      </div>
      <p style="margin: 14px 0 0; font-size: 11.5px; color: var(--steel-2);">Asking your own key · counts as 1 of 10 reads today · the rest of the desk keeps updating.</p>
    </div>`;

  const idle = `
    <div class="ai-cols" style="align-items: center; padding-top: 18px;">
      <div>
        <div class="display" style="font-size: 22px;">Ready to read this snapshot.</div>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--steel); line-height: 1.55;">A risk-first entry read on SPY, framed by your persona and grounded in the structure above. Advisory — you confirm every paper trade.</p>
        <div style="display: flex; gap: 14px; margin-top: 12px; font-size: 11.5px; color: var(--steel); flex-wrap: wrap;"><span>Snapshot as of <span class="mono">10:41:52 ET</span></span><span>·</span><span>your own key</span><span>·</span><span><span class="mono">3</span> of <span class="mono">10</span> reads left today</span></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; align-items: stretch;">${aiComposer()}</div>
    </div>`;

  const signedOut = `
    <div class="ai-cols" style="align-items: center; padding: 22px 20px 14px;">
      <div>
        <div class="display" style="font-size: 22px;">Sign in to ask for a read.</div>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--steel); line-height: 1.55;">The structure, tape and context on this desk stay free without an account. The AI read runs on your own key and needs a sign-in so the key stays yours.</p>
      </div>
      <div class="ai-actions" style="justify-content: flex-end;"><button class="btn secondary">What’s sent to the AI</button><button class="btn primary">Sign in to ask</button></div>
    </div>`;

  const noKey = `
    <div class="ai-cols" style="align-items: center; padding: 22px 20px 14px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; color: var(--steel);">${icon('key', 16)}<span class="caps">Add an API key to power reads</span></div>
        <div class="display" style="font-size: 22px; margin-top: 6px;">Your key, your cost.</div>
        <p style="margin: 6px 0 0; font-size: 13px; color: var(--steel); line-height: 1.55;">Add a key for Anthropic, OpenAI, Gemini or Grok in Settings. The manual export always works without one.</p>
      </div>
      <div class="ai-actions" style="justify-content: flex-end;"><a href="#" class="btn link">View what’s sent ${icon('arrow', 14)}</a><button class="btn primary">Open AI providers in Settings</button></div>
    </div>`;

  const staleStrip = `
    <div style="margin: 14px 20px 0; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: var(--warn-tint); border: 1px solid var(--warn); color: var(--warn); font-size: 12.5px; flex-wrap: wrap;">
      ${icon('warn', 16)}<span style="flex: 1 1 240px; color: var(--phosphor);"><strong style="font-weight: 600;">A newer snapshot has arrived.</strong> This read is pinned to 10:41:52 ET; levels may have moved.</span><button class="btn secondary sm" onClick="{{ask}}">${icon('refresh', 13)} Refresh analysis</button>
    </div>`;

  return `<div class="ai-scrim" onClick="{{toggleSheet}}"></div><section class="panel ai">
    <div class="ai-peek" onClick="{{toggleSheet}}">
      <div style="width: 100%; display: flex; justify-content: center; margin-bottom: 2px;"><span style="width: 36px; height: 4px; border-radius: 2px; background: var(--line-2);"></span></div>
      <span class="amber" style="display: inline-flex;">${icon('sparkle', 15)}</span><span style="font-size: 13px; font-weight: 600;">AI read</span><span class="dim">·</span><span class="display" style="font-size: 15px;">{{peekVerdict}}</span><span style="flex: 1;"></span><span class="mono" style="font-size: 11px; color: var(--steel);">as of 10:41</span><span style="display: inline-flex; color: var(--steel); transform: {{peekChevron}};">${icon('chevron', 16)}</span>
    </div>
    <div class="ai-head">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: var(--amber-tint); color: var(--amber-text);">${icon('sparkle', 15)}</div>
      <h2 style="margin: 0; font-size: 14px; font-weight: 600;">AI read · SPY</h2>
      <span class="chip outline">SIMULATED / advisory</span>
      <sc-if value="{{hasRead}}" hint-placeholder-val="{{true}}"><span class="chip outline mono" style="font-size: 11px;">Persona · Balanced Swinger</span><span class="chip outline mono" style="font-size: 11px;">claude-sonnet-5 · your key</span></sc-if>
      <div style="flex: 1;"></div>
      <a href="#" class="btn link" style="font-size: 12px;">What’s sent ${icon('arrow', 13)}</a>
      <sc-if value="{{hasRead}}" hint-placeholder-val="{{true}}"><button class="btn ghost sm" onClick="{{dismiss}}" aria-label="Dismiss read" title="Dismiss">${icon('close', 14)}</button></sc-if>
      <span style="display: inline-flex; color: var(--steel-2);">${icon('dots', 16)}</span>
    </div>
    <div class="ai-body" style="display: flex; flex-direction: column; flex: 1;">
      <div class="ai-mbar"><span class="chip outline">SIMULATED / advisory</span><sc-if value="{{hasRead}}" hint-placeholder-val="{{true}}"><span class="chip outline mono" style="font-size: 11px;">Balanced Swinger · claude-sonnet-5</span></sc-if><a href="#" class="btn link" style="font-size: 12px;">What’s sent ${icon('arrow', 12)}</a><span style="flex: 1;"></span><sc-if value="{{hasRead}}" hint-placeholder-val="{{true}}"><button class="{{refreshClass}}" onClick="{{ask}}" style="height: 30px; font-size: 12px;">${icon('refresh', 13)} {{refreshLabel}}</button></sc-if></div>
      <sc-if value="{{isStale}}" hint-placeholder-val="{{false}}">${staleStrip}</sc-if>
      <sc-if value="{{isSignedOut}}" hint-placeholder-val="{{false}}">${signedOut}</sc-if>
      <sc-if value="{{isNoKey}}" hint-placeholder-val="{{false}}">${noKey}</sc-if>
      <sc-if value="{{isIdle}}" hint-placeholder-val="{{false}}">${idle}</sc-if>
      <sc-if value="{{isLoading}}" hint-placeholder-val="{{false}}">${loading}</sc-if>
      <sc-if value="{{isTradeLike}}" hint-placeholder-val="{{true}}">${tradeBrief}</sc-if>
      <sc-if value="{{isNoTrade}}" hint-placeholder-val="{{false}}">${noTrade}</sc-if>
      <sc-if value="{{hasRead}}" hint-placeholder-val="{{true}}">
        <div class="ai-foot">
          ${aiComposer({ compact: true })}
          <button class="{{refreshClass}}" onClick="{{ask}}" style="height: 34px;">${icon('refresh', 14)} {{refreshLabel}}</button>
          <span class="note">{{footerNote}}</span>
        </div>
      </sc-if>
    </div>
  </section>`;
}

export function deskBody({ minHeight = 2300 } = {}) {
  const trail = seq(48, 7, 573.0, 0.35);
  const flowTrail = seq(30, 3, 0, 1);

  const masthead = `
  <section class="wrap mast">
    <div class="mast-row">
      <div style="min-width: 0; flex: 1 1 420px;">
        <div class="mast-title">
          <h1 class="display mast-sym" style="margin: 0;">SPY</h1>
          <span class="mono flash-up mast-price" style="font-weight: 500;">573.12</span>
          <span class="mono up" style="font-size: 15px; font-weight: 500;">+1.84 · +0.32%</span>
        </div>
        <div class="mast-meta">
          <span class="chip up">positive gamma</span>
          <span class="chip live"><span class="dot"></span>live · open · <span class="mono">${SPY.symbol}</span> tape</span>
          <span>SPDR S&amp;P 500 ETF</span><span class="dim">·</span>
          <span><span class="signal">●</span> Last trade <span class="mono">573.10</span></span><span class="dim">·</span>
          <span>Levels @ <span class="mono">573.05</span></span><span class="dim">·</span>
          <span>Structure as-of <span class="mono">42s</span> · refreshes ~60s</span><span class="dim">·</span>
          <span>All expirations</span>
        </div>
      </div>
      <div class="mast-controls">
        <div class="field" style="height: 36px; gap: 8px;"><span class="caps" style="font-size: 11px;">Expirations</span><span style="font-weight: 600;">All</span><span class="mono steel" style="font-size: 11px;">7–45 DTE</span>${icon('chevron', 14)}</div>
        <div class="field" style="height: 36px; gap: 8px;"><span class="caps" style="font-size: 11px;">Persona</span><span style="font-weight: 600;">Balanced Swinger</span>${icon('chevron', 14)}</div>
        <button class="btn primary">${icon('plus', 15)} Open simulated trade</button>
      </div>
    </div>
    <div class="quick">
      <span class="caps" style="margin-right: 4px; flex-shrink: 0;">Quick</span>
      <span class="sym on">SPY</span><span class="sym">QQQ</span><span class="sym">IWM</span><span class="sym">NVDA</span><span class="sym">TSLA</span>
      <span style="width: 1px; height: 16px; background: var(--line-2); margin: 0 4px; flex-shrink: 0;"></span>
      <span class="sym">AAPL</span><span class="sym">AMD</span><span class="sym">META</span>
      <span class="quick-note">Universe member · 69 tracked names</span>
    </div>
  </section>`;

  const fieldPanel = `
  <section class="wrap">
    <div class="panel" style="position: relative; overflow: hidden;">
      <span class="livebar"></span>
      ${widgetHead('Structure field', {
        subtitle: 'Net dealer gamma by strike · all expirations · levels are REST structure (as-of 42s) · the mid is tape',
        live: 'mid · tape',
        actions: `<div style="display: flex; align-items: center; gap: 14px; margin-right: 8px; font-size: 11px; color: var(--steel); flex-wrap: wrap;"><span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 3px; background: var(--up);"></span>call-dominated</span><span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 3px; background: var(--down);"></span>put-dominated</span><span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 2px; background: var(--amber);"></span>flip</span></div><span class="seg"><span class="{{fieldSegClass}}" onClick="{{showField}}">Field</span><span class="{{magnetSegClass}}" onClick="{{showMagnet}}">Magnet</span></span>`,
      })}
      <div class="well field-grid">
        <div class="field-main">
          <sc-if value="{{viewField}}" hint-placeholder-val="{{true}}"><div class="sf-wide">${structureField({ width: 1000, height: 300, id: 'main' })}</div><div class="sf-narrow">${structureField({ width: 420, height: 230, id: 'mainn', showLabels: false })}</div></sc-if>
          <sc-if value="{{viewMagnet}}" hint-placeholder-val="{{false}}"><div class="sf-wide">${magnetView({ width: 1000, height: 300 })}</div><div class="sf-narrow">${magnetView({ width: 420, height: 220, compact: true })}</div></sc-if>
          <div class="tape-row">
            <span class="caps" style="white-space: nowrap;">Tape · 5m mid trail</span>
            <div style="flex: 1; min-width: 0;">${sparkline(trail, { width: 640, height: 30, color: 'var(--signal)', dot: true, cls: 'trail', fluid: true })}</div>
            <span class="mono" style="font-size: 11px; color: var(--steel); white-space: nowrap;">last <span style="color: var(--phosphor);">573.10</span> · <span class="up">▲</span> 4 · <span class="down">▼</span> 2</span>
          </div>
          <div class="path-row">
            <span class="caps" style="white-space: nowrap;">Structure path · slow lane</span>
            <div class="pr"><span class="mono" style="font-size: 11px; color: var(--steel); white-space: nowrap;">score</span>${sparkline(seq(14, 21, 66, 8), { width: 120, height: 22, color: 'var(--amber)' })}<span class="mono" style="font-size: 11px; white-space: nowrap;">72 <span class="steel">· +6 today</span></span></div>
            <div class="pr"><span class="mono" style="font-size: 11px; color: var(--steel); white-space: nowrap;">dist to flip</span>${sparkline(seq(14, 5, -1.4, 0.6), { width: 120, height: 22, color: 'var(--steel)' })}<span class="mono" style="font-size: 11px; white-space: nowrap;">−0.81% <span class="steel">· from −1.9%</span></span></div>
            <span class="mono pr-note">session path · 14 samples · not live ticks</span>
          </div>
        </div>
        <div class="ladder">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;"><span class="caps">Levels</span><span class="mono" style="font-size: 11px; color: var(--steel);">distance from mid</span></div>
          <div class="ladder-rows">
            ${ladderRow({ label: 'Call wall', value: '580.00', dist: '+1.20%', color: 'var(--up)' })}
            ${ladderRow({ label: 'Mid', value: '573.12', dist: '—', color: 'var(--signal)', live: true, big: true })}
            ${ladderRow({ label: 'Max pain', value: '570.00', dist: '−0.54%', color: 'var(--steel)', style: 'dashed' })}
            ${ladderRow({ label: 'Gamma flip', value: '568.50', dist: '−0.81%', color: 'var(--amber)' })}
            ${ladderRow({ label: 'Put wall', value: '560.00', dist: '−2.29%', color: 'var(--down)' })}
          </div>
          <div class="ladder-foot">
            <div class="cell">${labelInfo('Vol-norm GEX')}<span class="v up" style="font-size: 18px;">+$1.94B</span><span class="s">primary magnitude</span></div>
            <div class="cell">${labelInfo('Raw · 1% shock')}<span class="v" style="font-size: 18px;">+$1.62B</span><span class="s">secondary</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const readStrip = `
  <section class="wrap" style="padding-top: 16px;">
    <div class="panel strip">
      <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px;">
        ${ring(72, { size: 48 })}
        <div class="cell">${labelInfo('Opportunity')}<span class="v" style="font-size: 18px;"><span class="amber">Actionable</span></span><span class="s">near wall · IV cheap · 2 setups</span></div>
      </div>
      ${cell({ label: 'Net DEX', value: '−$412M', sub: 'delta hedging pressure', dir: 'down' })}
      ${cell({ label: 'IV / HV', value: '0.82', sub: 'options look cheap' })}
      ${cell({ label: 'IV rank', value: '34', sub: '2nd quartile · 41st pct' })}
      ${cell({ label: 'Vol / OI', value: '0.61×', sub: '3 unusual strikes' })}
      ${cell({ label: 'IV skew', value: '−2.4 pts', sub: 'fear · puts bid' })}
      ${cell({ label: 'Term', value: 'Contango', sub: '7d 14.2 → 90d 18.0' })}
      ${cell({ label: 'Off-exchange', value: '41%', sub: 'context only · no side' })}
    </div>
    <div class="strip-dots" aria-hidden="true"><span style="width: 14px; height: 3px; border-radius: 2px; background: var(--steel);"></span><span style="width: 6px; height: 3px; border-radius: 2px; background: var(--line-2);"></span><span style="width: 6px; height: 3px; border-radius: 2px; background: var(--line-2);"></span></div>
  </section>`;

  const tape = `
    <section class="panel" style="position: relative; overflow: hidden;">
      <span class="livebar"></span>
      ${widgetHead('Live tape', { subtitle: 'Trade tape + quote stream · pauses on a drop, levels stay', live: true })}
      <div class="well tape-grid">
        <div style="border-right: 1px solid var(--line); border-bottom: 1px solid var(--line);">${cell({ label: 'Net flow · 5m', value: '+12,480', sub: 'buyers lifting the ask', dir: 'up', tone: 'up', live: true, flash: 'flash-up' })}</div>
        <div style="border-bottom: 1px solid var(--line);">${cell({ label: 'Spread', value: '$0.01', sub: 'tight · liquid', live: true })}</div>
        <div style="border-right: 1px solid var(--line);">${cell({ label: 'VWAP', value: '571.88', sub: 'mid +0.22% above' })}</div>
        <div>${cell({ label: 'Gamma flip · live', value: '568.50', sub: 'live recompute · levels flip 568.50', live: true })}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--line);">
        <span class="caps">Flow</span>
        <div style="flex: 1; min-width: 0;">${sparkline(flowTrail, { width: 220, height: 26, color: 'var(--up)', fill: 'var(--up-tint)', cls: 'trail', fluid: true })}</div>
        <span class="mono" style="font-size: 11px; color: var(--steel); white-space: nowrap;">${SPY.symbol} · 30 × 10s</span>
      </div>
    </section>`;

  const position = `
    <section class="panel">
      ${widgetHead('Your position · SPY', { subtitle: 'Simulated · marks from the live mid', actions: '<a href="#" class="btn link" style="font-size: 12px;">Open book →</a>' })}
      <div style="padding: 4px 18px 14px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
        <div style="flex: 1 1 160px; min-width: 0;">
          <div style="font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Bull call spread <span class="mono steel" style="font-weight: 500;">575 / 580 · Sep 18</span></div>
          <div style="font-size: 11.5px; color: var(--steel); margin-top: 2px;">2 × · opened today 09:52 · stop <span class="mono">568.50</span></div>
        </div>
        <div style="text-align: right;"><div class="mono up flash-up" style="font-size: 20px; font-weight: 600;">+$142</div><div class="mono up" style="font-size: 12px;">+18.4%</div></div>
        ${sparkline(seq(24, 11, 0, 1), { width: 72, height: 26, color: 'var(--up)' })}
      </div>
    </section>`;

  const orders = `
    <section class="panel" style="position: relative; overflow: hidden;">
      <span class="livebar"></span>
      ${widgetHead('Sim orders · SPY', { subtitle: '1 watching · triggers on the live mid', live: true, actions: '<span class="chip outline">SIMULATED</span>' })}
      <div style="padding: 2px 18px 14px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: var(--ink-2); border: 1px solid var(--line); flex-wrap: wrap;">
          <span class="chip live"><span class="dot"></span>watching</span>
          <span style="font-size: 12.5px; flex: 1 1 160px;">Buy 1 <span class="mono">SPY 575C</span> Sep 18 · limit <span class="mono">2.40</span></span>
          <span class="mono" style="font-size: 11px; color: var(--steel);">mark 2.46</span>
          <span style="display: inline-flex; color: var(--steel-2);">${icon('chevronR', 14)}</span>
        </div>
        <p style="margin: 0; font-size: 11.5px; color: var(--steel-2);">Fills are modeled at the mid — no slippage, no partials. Never sent to a broker.</p>
      </div>
    </section>`;

  const contextCard = (title, subtitle, body, span = 1) => `
    <section class="panel quiet ${span === 2 ? 'ctx-span2' : ''}" style="display: flex; flex-direction: column;">
      ${widgetHead(title, { subtitle, quiet: true })}
      <div style="padding: 4px 16px 14px; flex: 1;">${body}</div>
    </section>`;

  const flowLimb = (label, value, dir, note) => `<div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); flex-wrap: wrap;"><div style="flex: 1 1 150px; min-width: 0;"><div style="font-size: 12px; font-weight: 600;">${label}</div><div style="font-size: 11px; color: var(--steel);">${note}</div></div><div style="width: 120px; height: 6px; border-radius: 3px; background: var(--raised); position: relative; overflow: hidden;"><span style="position: absolute; top: 0; bottom: 0; ${dir === 'up' ? 'left: 50%; width: 38%; background: var(--up);' : 'right: 50%; width: 26%; background: var(--down);'}"></span><span style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--steel-2);"></span></div><span class="mono" style="font-size: 13px; min-width: 64px; text-align: right;">${value}</span></div>`;

  const context = `
  <section class="wrap" style="padding-top: 22px;">
    <div class="ctx-head">
      <span class="caps" style="color: var(--phosphor);">Context</span>
      <span style="font-size: 12px; color: var(--steel);">Advisory reads that never feed the score · snapshot, never live · refreshes with the data load</span>
      <span class="rule"></span>
      <span class="seg"><span class="on">All</span><span>Flow</span><span>Vol</span><span>Positioning</span></span>
    </div>
    <div class="ctx-grid">
      ${contextCard('Projected dealer flow', 'Charm and vanna · snapshot, never live', `${flowLimb('Charm · drift into OPEX', '+$38M/day', 'up', 'supportive drift into Sep 19 OPEX')}${flowLimb('Vanna · per vol move', '−$12M / +1 vol', 'down', 'a vol pop sells delta')}<p style="margin: 8px 0 0; font-size: 11px; color: var(--steel-2);">Directional only as a hedging metaphor — not a forecast.</p>`)}
      ${contextCard('Market context', 'Trend, shape, flow vs positioning, ATR', `<div class="ctx-2" style="gap: 10px 16px;">${[['Trend', 'Up · strong', 'momentum positive'], ['Profile shape', 'Concentrated', 'balance tilts calls'], ['Flow vs positioning', 'Aligned', 'flow with the wall'], ['ATR 14d', '$6.20 · 1.1%', '5d 5.4 · 30d 6.8']].map(([l, v, s]) => `<div class="cell" style="padding: 8px 0; border-top: 1px solid var(--line);"><span class="caps">${l}</span><span class="v" style="font-size: 15px;">${v}</span><span class="s">${s}</span></div>`).join('')}</div>`)}
      ${contextCard('Term structure', 'ATM IV by tenor · sampled 7/14/30/60/90 DTE', `${termRibbon({ width: 380, height: 54 })}<div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11.5px; color: var(--steel); flex-wrap: wrap; gap: 6px;"><span><span class="chip">contango</span> · near-dated vol cheapest</span><span class="mono">slope +3.8</span></div>`)}
      ${contextCard('Straddle-implied move', 'From the ATM straddle · the market’s own range', `<div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;"><span class="mono" style="font-size: 26px; font-weight: 500;">±$8.40</span><span class="mono steel" style="font-size: 13px;">±1.5%</span><span class="chip outline">Sep 18</span></div><div style="position: relative; height: 26px; margin-top: 10px; border-radius: 6px; background: var(--raised);"><span style="position: absolute; left: 34%; right: 34%; top: 0; bottom: 0; background: var(--amber-tint-2); border-radius: 6px;"></span><span style="position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: var(--signal);"></span><span class="mono" style="position: absolute; left: 34%; transform: translateX(-100%); top: 5px; font-size: 11px; color: var(--steel); padding-right: 6px;">564.7</span><span class="mono" style="position: absolute; left: 66%; top: 5px; font-size: 11px; color: var(--steel); padding-left: 6px;">581.5</span></div><p style="margin: 8px 0 0; font-size: 11px; color: var(--steel-2);">Sep 25 ±$11.10 · Oct 17 ±$16.80 · a price of vol, not a forecast.</p>`)}
      ${contextCard('Fresh positioning · Vol/OI', 'Strikes trading over 1.0× open interest today', `${[['580 C', '2.4×', 'call wall · 18,400 vol'], ['575 C', '1.6×', '12,100 vol'], ['560 P', '1.2×', 'put wall · 9,800 vol']].map(([k, r, n]) => `<div style="display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--line);"><span class="mono" style="font-size: 13px; font-weight: 600; min-width: 52px;">${k}</span><span class="chip emph mono">${r}</span><span style="font-size: 11.5px; color: var(--steel);">${n}</span></div>`).join('')}<p style="margin: 8px 0 0; font-size: 11px; color: var(--steel-2);">Activity, not direction — no side implied.</p>`)}
      ${contextCard('Off-exchange blocks', '41% printed off-lit · dark pools + internalized', `${[['573.00', '31%'], ['570.50', '22%'], ['575.00', '14%']].map(([p, s]) => `<div style="display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--line);"><span class="mono" style="font-size: 13px; font-weight: 600; min-width: 56px;">${p}</span><div style="flex: 1; height: 6px; border-radius: 3px; background: var(--raised); overflow: hidden;"><span style="display: block; height: 100%; width: ${parseInt(s) * 2.6}%; background: var(--steel);"></span></div><span class="mono" style="font-size: 11px; color: var(--steel); min-width: 32px; text-align: right;">${s}</span></div>`).join('')}<p style="margin: 8px 0 0; font-size: 11px; color: var(--steel-2);">Side and intent unknown — context only, not a directional signal.</p>`)}
      ${contextCard('Setups', 'Rule-based reads of the current structure · as-of 42s', `<div class="ctx-2">${[['Pin into the call wall', 'high', 'Positive gamma, mid within 1.2% of the 580 wall, cheap vol. Fade extremes; size for the pin.'], ['Flip reclaim', 'medium', 'Mid held above the 568.50 flip for two structure cycles. Dips into the flip have been bought.']].map(([n, c, r]) => `<div style="padding: 12px 14px; border-radius: 10px; background: var(--ink-2); border: 1px solid var(--line);"><div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><span style="font-size: 13px; font-weight: 600;">${n}</span><span class="chip ${c === 'high' ? 'emph' : ''}">${c.toUpperCase()}</span></div><p style="margin: 6px 0 0; font-size: 12px; color: var(--steel); line-height: 1.5;">${r}</p></div>`).join('')}</div>`, 2)}
      <section class="panel quiet" style="display: flex; align-items: center; justify-content: center; gap: 8px; border-style: dashed; color: var(--steel-2); min-height: 120px; font-size: 12.5px; font-weight: 500;">${icon('plus', 14)} Add a widget <span class="chip outline" style="font-size: 11px;">coming soon</span></section>
    </div>
  </section>`;

  const work = `
  <section class="wrap" style="padding-top: 16px;">
    <div class="work">
      ${aiRead()}
      <div class="side">${tape}${position}${orders}</div>
    </div>
  </section>`;

  return `<div data-scheme="{{scheme}}" class="desk {{liveClass}} {{sheetClass}}" style="min-height: ${minHeight}px;">
    ${nav({ active: 'ticker', signedIn: true, live: true })}
    ${masthead}
    ${fieldPanel}
    ${readStrip}
    ${work}
    ${context}
    ${footer()}
  </div>`;
}

export function deskProps({ width = 1440, height = 2300, scheme = 'dark', sheet = 'open' } = {}) {
  return {
    readState: { editor: 'enum', default: 'trade', options: ['idle', 'loading', 'trade', 'no_trade', 'stale', 'cooldown', 'signed_out', 'no_key'], section: 'AI read' },
    live: { editor: 'boolean', default: true, section: 'Liveness' },
    scheme: { editor: 'enum', default: scheme, options: ['dark', 'light'], section: 'Theme' },
    sheet: { editor: 'enum', default: sheet, options: ['open', 'peek'], section: 'Phone (< 768px)' },
    $preview: { width, height },
  };
}

export const deskScript = `class Component extends DCLogic {
  state = { phase: null, view: 'field', sheet: null };
  componentDidUpdate(prev) {
    if (prev.readState !== this.props.readState && this.state.phase !== null) this.setState({ phase: null });
    if (prev.sheet !== this.props.sheet && this.state.sheet !== null) this.setState({ sheet: null });
  }
  componentWillUnmount() { clearTimeout(this._t); }
  renderVals() {
    const phase = this.state.phase || this.props.readState || 'trade';
    const tradeLike = phase === 'trade' || phase === 'stale' || phase === 'cooldown';
    const hasRead = tradeLike || phase === 'no_trade';
    const sheetOpen = this.state.sheet === null ? (this.props.sheet || 'open') === 'open' : this.state.sheet;
    const ask = () => {
      clearTimeout(this._t);
      this.setState({ phase: 'loading', sheet: true });
      this._t = setTimeout(() => this.setState({ phase: 'trade' }), 1900);
    };
    return {
      scheme: this.props.scheme || 'dark',
      liveClass: this.props.live === false ? '' : 'is-live',
      sheetClass: sheetOpen ? '' : 'is-peek',
      peekVerdict: tradeLike ? 'Trade · Bullish' : phase === 'no_trade' ? 'No trade' : phase === 'loading' ? 'Thinking…' : phase === 'signed_out' ? 'Sign in to ask' : phase === 'no_key' ? 'Add a key' : 'Ready to read',
      peekChevron: sheetOpen ? 'rotate(0deg)' : 'rotate(180deg)',
      toggleSheet: () => this.setState({ sheet: !sheetOpen }),
      isIdle: phase === 'idle',
      isLoading: phase === 'loading',
      isTradeLike: tradeLike,
      isNoTrade: phase === 'no_trade',
      isStale: phase === 'stale',
      isSignedOut: phase === 'signed_out',
      isNoKey: phase === 'no_key',
      hasRead,
      refreshClass: phase === 'cooldown' ? 'btn ghost disabled' : 'btn ghost',
      refreshLabel: phase === 'cooldown' ? 'Cooling down · 42s' : 'Refresh analysis',
      footerNote: phase === 'cooldown' ? 'A fresh read rarely changes inside a minute · 3 of 10 reads left today' : 'Reads pin to a snapshot and never refresh themselves · 3 of 10 reads left today',
      ask,
      dismiss: () => { clearTimeout(this._t); this.setState({ phase: 'idle' }); },
      viewField: this.state.view === 'field',
      viewMagnet: this.state.view === 'magnet',
      fieldSegClass: this.state.view === 'field' ? 'on' : '',
      magnetSegClass: this.state.view === 'magnet' ? 'on' : '',
      showField: () => this.setState({ view: 'field' }),
      showMagnet: () => this.setState({ view: 'magnet' }),
    };
  }
}`;
