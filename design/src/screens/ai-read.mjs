// AiRead.dc.html — the AI read panel in its narrow (rail / phone) form, every state side by side.
import { icon } from '../lib.mjs';
import { riskField } from '../components/risk-field.mjs';
const riskMini = (p) => riskField({ ...p, compact: true });


const head = (extra = '') => `<div style="display: flex; align-items: center; gap: 8px; padding: 12px 16px 10px; border-bottom: 1px solid var(--line);">
  <div style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; background: var(--amber-tint); color: var(--amber-text);">${icon('sparkle', 14)}</div>
  <h2 style="margin: 0; font-size: 13.5px; font-weight: 600;">AI read · SPY</h2>
  <span class="chip outline" style="font-size: 11px;">SIMULATED</span>
  <span style="flex: 1;"></span>${extra}
  <a href="#" class="btn link" style="font-size: 11.5px;">What’s sent ${icon('arrow', 12)}</a>
</div>`;

const provenance = `<div class="mono" style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--steel); flex-wrap: wrap;"><span style="display: inline-flex; align-items: center; gap: 5px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: var(--amber);"></span>read pinned</span><span>as of 10:41:52 ET · 48s ago</span></div>`;

const composer = `<div style="display: flex; flex-direction: column; gap: 8px;">
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
    <div class="field" style="height: 34px; gap: 6px; padding: 0 8px 0 10px; font-size: 12px;"><span class="caps" style="font-size: 11px;">Persona</span><span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Balanced Swinger</span>${icon('chevron', 13)}</div>
    <div class="field mono" style="height: 34px; gap: 6px; padding: 0 8px 0 10px; font-size: 11.5px;"><span class="caps sans" style="font-size: 11px;">Model</span>claude-sonnet-5${icon('chevron', 13)}</div>
  </div>
</div>`;

function card(title, when, body, note) {
  return `<div style="display: flex; flex-direction: column; gap: 10px; min-width: 0;">
    <div style="display: flex; align-items: baseline; gap: 10px;"><span style="font-size: 13px; font-weight: 700;">${title}</span><span style="font-size: 11.5px; color: var(--steel);">${when}</span></div>
    <section class="panel" style="display: flex; flex-direction: column; min-height: 400px; overflow: hidden;">${body}</section>
    <p style="margin: 0; font-size: 11.5px; line-height: 1.5; color: var(--steel);">${note}</p>
  </div>`;
}

const actionsTrade = `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: auto;"><button class="btn primary" style="width: 100%;">Review simulated trade</button><div style="display: flex; gap: 8px;"><button class="btn secondary" style="flex: 1;">Create sim order</button><button class="btn ghost" style="flex: 1;">Full analysis ${icon('arrow', 13)}</button></div><p style="margin: 0; font-size: 11px; color: var(--steel-2); text-align: center;">Nothing is saved until you review and confirm.</p></div>`;

const tradeBody = (stale = false) => `${head('<span class="chip outline mono" style="font-size: 11px;">Persona · Balanced Swinger</span>')}
  ${stale ? `<div style="margin: 12px 16px 0; display: flex; align-items: flex-start; gap: 8px; padding: 9px 10px; border-radius: 8px; background: var(--warn-tint); border: 1px solid var(--warn); color: var(--warn); font-size: 12px;">${icon('warn', 15)}<span style="flex: 1; color: var(--phosphor); line-height: 1.4;"><strong style="font-weight: 600;">Newer snapshot available.</strong> This read is pinned to 10:41:52 ET.</span><button class="btn secondary sm">Refresh</button></div>` : ''}
  <div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; flex: 1;">
    ${provenance}
    <div>
      <div class="display" style="font-size: 26px; letter-spacing: -0.015em;"><span class="amber">Trade</span><span class="dim" style="font-weight: 500;"> · </span>Bullish</div>
      <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12.5px; flex-wrap: wrap;"><span style="font-weight: 600;">Bull call spread</span><span class="dim">·</span><span class="mono">575 / 580</span><span class="dim">·</span><span>Sep 18</span><span class="chip emph" style="height: 20px;">high</span></div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      ${riskMini({ label: 'Max risk', value: '$420', sub: '1.7% of account' })}
      ${riskMini({ label: 'Invalidation', value: '568.50', sub: 'the gamma flip' })}
      ${riskMini({ label: 'Entry', value: 'near 573', sub: 'pullback to VWAP' })}
      ${riskMini({ label: 'Target', value: '579.50', sub: 'AI-stated · untraced', traced: false, mono: false })}
    </div>
    <div style="display: flex; gap: 8px; align-items: flex-start; font-size: 11.5px; color: var(--steel); line-height: 1.45;"><span style="display: inline-flex; margin-top: 1px;">${icon('shield', 13)}</span><span><strong style="color: var(--phosphor); font-weight: 600;">3 of 4 figures trace to Convexa.</strong> Within your per-trade cap ($500).</span></div>
    <details style="font-size: 12.5px;"><summary style="cursor: pointer; color: var(--steel); font-weight: 600; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; list-style: none; display: flex; align-items: center; gap: 6px;">Why ${icon('chevron', 12)}</summary><ul style="margin: 6px 0 0; padding-left: 16px; line-height: 1.5; display: flex; flex-direction: column; gap: 3px;"><li>Mid +0.81% above the flip; dealers dampen dips.</li><li>580 call wall caps upside — pay for the pin.</li><li>IV/HV 0.82 reads cheap; buy the debit.</li></ul></details>
    ${actionsTrade}
  </div>`;

export function aiReadBody() {
  const cards = [
    card('Idle', 'signed in · key set · no read yet', `${head()}
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1;">
        <div class="display" style="font-size: 20px;">Ready to read this snapshot.</div>
        <p style="margin: 0; font-size: 12.5px; color: var(--steel); line-height: 1.5;">Risk-first entry read on SPY, framed by your persona, grounded in the structure above. Advisory — you confirm every paper trade.</p>
        ${composer}
        <button class="btn primary" style="width: 100%;">Analyze current snapshot ${icon('arrow', 14)}</button>
        <div style="font-size: 11px; color: var(--steel); display: flex; flex-direction: column; gap: 2px;"><span>Snapshot as of <span class="mono">10:41:52 ET</span></span><span>Your own key · <span class="mono">3</span> of <span class="mono">10</span> reads left today</span></div>
        <div style="margin-top: auto; padding: 10px 12px; border-radius: 8px; background: var(--ink-2); border: 1px solid var(--line); font-size: 11.5px; color: var(--steel);"><span class="mono" style="color: var(--steel-2);">no_trade</span> · The guardrails see no fresh edge right now. You can still ask — it counts against your cooldown. <a href="#">Ask anyway</a></div>
      </div>`, 'The composer is one row, not a form. The quiet-gate hint (no fresh edge) lives inside the panel as a footnote with “Ask anyway”, never as a wall.'),

    card('Loading', 'request in flight · 5–15 s', `${head()}
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--amber); animation: livePulse 1.2s ease-in-out infinite;"></span>Thinking…</div>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--steel);">
          <span style="display: flex; align-items: center; gap: 6px;"><span class="steel" style="display: inline-flex;">${icon('check', 12)}</span>Snapshot pinned · 10:41:52 ET</span>
          <span style="display: flex; align-items: center; gap: 6px;"><span class="steel" style="display: inline-flex;">${icon('check', 12)}</span>Persona applied · Balanced Swinger</span>
          <span style="display: flex; align-items: center; gap: 6px; color: var(--phosphor);"><span style="width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--amber); animation: spin 0.9s linear infinite;"></span><span class="mono">claude-sonnet-5</span> reading the snapshot</span>
        </div>
        <div class="skel" style="height: 28px; width: 55%;"></div>
        <div class="skel" style="height: 12px; width: 80%;"></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"><div class="skel" style="height: 66px;"></div><div class="skel" style="height: 66px;"></div><div class="skel" style="height: 66px;"></div><div class="skel" style="height: 66px;"></div></div>
        <p style="margin: auto 0 0; font-size: 11px; color: var(--steel-2);">Counts as 1 of 10 reads today · the rest of the desk keeps updating.</p>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>`, 'Honest progress: three named steps, the model, and a realistic duration. Skeletons take the exact shape of the result so nothing jumps when the read lands.'),

    card('Produced · trade', 'the primary state', tradeBody(), 'Verdict first, in Archivo, with the single amber spend of the panel. Risk before rationale; the rationale folds. The untraced target renders in Plex Sans with a dotted rule — the type register carries authorship, colour does not.'),

    card('Produced · no trade', 'a complete, correct answer', `${head('<span class="chip outline mono" style="font-size: 11px;">Persona · Balanced Swinger</span>')}
      <div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; flex: 1;">
        ${provenance}
        <div><div class="display" style="font-size: 26px; letter-spacing: -0.015em;">No trade</div><div style="font-size: 12.5px; color: var(--steel); margin-top: 2px;">Sit this one out — no edge worth the debit.</div></div>
        <p style="margin: 0; font-size: 12.5px; line-height: 1.5;">Mid is pinned between the flip and the call wall with cheap vol but no directional flow.</p>
        <div style="padding: 12px; border-radius: 10px; background: var(--ink-2); border: 1px solid var(--line);"><span class="caps">Re-engage when</span><ul style="margin: 6px 0 0; padding-left: 16px; font-size: 12.5px; line-height: 1.5; display: flex; flex-direction: column; gap: 3px;"><li>Mid reclaims <span class="mono">575</span> with positive flow for 15 min.</li><li>The flip migrates above <span class="mono">570</span>.</li></ul></div>
        <div style="font-size: 11.5px; color: var(--steel);">Numbers said · <span class="mono">±$8.40 (1.5%)</span> implied move for Sep 18 · spreads tight.</div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: auto;"><button class="btn secondary" style="width: 100%;">${icon('bell', 14)} Alert me at 575</button><div style="display: flex; gap: 8px;"><button class="btn ghost" style="flex: 1;">${icon('refresh', 13)} Refresh</button><button class="btn ghost" style="flex: 1;">Full analysis ${icon('arrow', 13)}</button></div></div>
      </div>`, 'No trade is not an error and not red: same typographic weight as a trade, the primary action becomes an alert on the re-engage level so the read still ends in something useful.'),

    card('Stale · newer snapshot', 'structure refreshed after the read', tradeBody(true), 'A true warning: burnt orange plus an icon, never brand amber. The read stays legible underneath — it is still the last honest answer — and Refresh is right in the strip.'),

    card('Cooldown / daily cap', 'rate-limited · calm, not punitive', `${head()}
      <div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; flex: 1;">
        ${provenance}
        <div><div class="display" style="font-size: 26px;"><span class="amber">Trade</span><span class="dim" style="font-weight: 500;"> · </span>Bullish</div><div style="font-size: 12.5px; color: var(--steel); margin-top: 2px;">Bull call spread · 575 / 580 · Sep 18</div></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">${riskMini({ label: 'Max risk', value: '$420', sub: '1.7% of account' })}${riskMini({ label: 'Invalidation', value: '568.50', sub: 'the gamma flip' })}</div>
        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px;">
          <button class="btn secondary disabled" style="width: 100%;">${icon('clock', 14)} Cooling down · 42s</button>
          <p style="margin: 0; font-size: 11px; color: var(--steel); line-height: 1.45; text-align: center;">A fresh entry read rarely changes inside a minute; the data refreshes about every 60 s.</p>
          <div style="padding: 9px 10px; border-radius: 8px; border: 1px dashed var(--line-2); font-size: 11px; color: var(--steel);"><strong style="color: var(--phosphor); font-weight: 600;">Daily limit reached</strong> · resets 12:00 AM ET. The manual export still works and costs nothing.</div>
        </div>
      </div>`, 'The last read stays pinned and readable. The disabled control names the wait in mono; the cap message is a footnote, not an alert.'),

    card('Signed out', 'anonymous visitor', `${head()}
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; justify-content: center; text-align: center;">
        <div style="display: inline-flex; align-self: center; width: 44px; height: 44px; border-radius: 12px; background: var(--raised); color: var(--steel); align-items: center; justify-content: center;">${icon('user', 20)}</div>
        <div class="display" style="font-size: 20px;">Sign in to ask for a read.</div>
        <p style="margin: 0; font-size: 12.5px; color: var(--steel); line-height: 1.5;">Structure, tape and context stay free without an account. The read runs on your own key, so it needs a sign-in.</p>
        <button class="btn primary" style="width: 100%;">Sign in to ask</button>
        <a href="#" style="font-size: 12px;">See what would be sent →</a>
      </div>`, 'The gate replaces the whole action surface — no persona picker, no snapshot hint — but the export floor stays reachable for anyone.'),

    card('Add a key', 'signed in · no provider configured', `${head()}
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; justify-content: center;">
        <div style="display: flex; align-items: center; gap: 8px; color: var(--steel);">${icon('key', 16)}<span class="caps">Add an API key to power reads</span></div>
        <div class="display" style="font-size: 20px;">Your key, your cost.</div>
        <p style="margin: 0; font-size: 12.5px; color: var(--steel); line-height: 1.5;">Anthropic, OpenAI, Gemini or Grok. Keys are encrypted at rest and never leave with a read. The manual export always works without one.</p>
        <button class="btn primary" style="width: 100%;">Open AI providers in Settings</button>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">${['Anthropic', 'OpenAI', 'Gemini', 'Grok'].map((p) => `<span class="chip outline" style="justify-content: center;">${p}</span>`).join('')}</div>
      </div>`, 'Eight distinct powering reasons (missing key, unusable, rejected, model unset…) share this frame and swap only the sentence and the CTA label — reasons never collapse.'),

    card('Full analysis drawer', 'opens from any produced read', `<div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line);"><span style="display: inline-flex; color: var(--steel);">${icon('back', 16)}</span><h2 style="margin: 0; font-size: 13.5px; font-weight: 600;">Full analysis &amp; data · SPY</h2><span style="flex: 1;"></span><span style="display: inline-flex; color: var(--steel);">${icon('close', 16)}</span></div>
      <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; font-size: 12.5px; overflow: hidden;">
        <div><span class="caps">Read summary</span><div style="margin-top: 4px; font-weight: 600;">Trade · bullish · Bull call spread · Sep 18 · 3–7 sessions</div></div>
        <div><span class="caps">Analyst read</span><p style="margin: 4px 0 0; color: var(--steel); line-height: 1.5;">With spot +0.8% above the flip and dealers long gamma, intraday dips into 570 should be absorbed. The 580 wall has held for three sessions…</p></div>
        <div><span class="caps">Cited contract &amp; grounding</span><div class="mono" style="margin-top: 4px; font-size: 12px;">SPY 250918C00575000 · bid 2.38 / ask 2.42 · OI 41,200</div><div style="margin-top: 6px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">${[['Stop', '568.50', true], ['Target', '579.50', false], ['Invalidation', '568.50', true]].map(([l, v, t]) => `<div style="padding: 8px; border-radius: 8px; background: var(--ink-2); border: 1px solid var(--line);"><span class="caps" style="font-size: 11px;">${l}</span><div class="${t ? 'mono' : 'sans'}" style="font-size: 14px; margin-top: 2px;">${v}</div><div style="font-size: 11px; color: var(--steel);">${t ? 'traced' : 'untraced'}</div></div>`).join('')}</div><div style="margin-top: 6px; font-size: 11px; color: var(--steel);">Checked 4 · traced 3 · untraced 1 · not checkable 0</div></div>
        <div><span class="caps">As-sent risk inputs</span><div class="mono" style="margin-top: 4px; font-size: 11px; color: var(--steel); line-height: 1.6;">account 25,000 · cap 2% → $500 effective · open positions 1 (this underlying) · storage available</div></div>
      </div>`, 'Depth on demand: the drawer is where prose, grounding counts, the cited contract and the as-sent inputs live. The panel itself never grows to hold them.'),
  ];

  return `<div style="width: 1440px; min-height: 1720px; background: var(--ink); color: var(--phosphor); padding: 36px 40px 40px;">
    <div style="display: flex; align-items: flex-end; gap: 24px; margin-bottom: 22px;">
      <div>
        <div class="caps" style="color: var(--amber-text);">AI read · component states</div>
        <h1 class="display" style="margin: 6px 0 0; font-size: 30px;">One panel, nine honest states</h1>
        <p style="margin: 8px 0 0; max-width: 760px; font-size: 13.5px; color: var(--steel); line-height: 1.55;">The narrow form used in the right rail, the phone bottom sheet and any cell under 560px. The wide brief on the Ticker desk is the same anatomy laid out in two columns. Rules carried from the canon: verdict before rationale, risk before prose, no-trade first-class, stale is a warning not a footnote, mono means “this figure is Convexa’s”.</p>
      </div>
      <div style="margin-left: auto; display: flex; gap: 8px;"><span class="chip outline">Archivo verdict</span><span class="chip outline">Plex Mono figures</span><span class="chip outline">Plex Sans = untraced</span><span class="chip outline">amber spent once</span></div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px 22px;">${cards.join('')}</div>
  </div>`;
}
