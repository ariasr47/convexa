// Settings — section rail + content column; credentials separated from trader inputs. Rail → tabs under 900px.
import { footer, icon, nav } from '../lib.mjs';

export const SETTINGS_CSS = `
  .set-grid { display: grid; grid-template-columns: 220px minmax(0, 760px); gap: 40px; align-items: start; margin-top: 20px; }
  .rail { position: sticky; top: 76px; display: flex; flex-direction: column; gap: 2px; }
  .rail a { display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--steel); text-decoration: none; white-space: nowrap; }
  .rail a.on { color: var(--phosphor); background: var(--raised); }
  .rail a.on .dot { margin-left: auto; width: 6px; height: 6px; border-radius: 50%; background: var(--amber); }
  .set-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .set-2b { grid-template-columns: 1fr 1.3fr; align-items: start; }
  .set-2c { grid-template-columns: 1.4fr 1fr; align-items: end; }
  .theme-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cap-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; background: var(--raised); flex-wrap: wrap; }
  @media (max-width: 899px) { .set-grid { grid-template-columns: 1fr; gap: 16px; } .rail { position: static; flex-direction: row; overflow-x: auto; scrollbar-width: none; } .rail::-webkit-scrollbar { display: none; } .rail p { display: none; } .rail a.on .dot { display: none; } }
  @media (max-width: 639px) { .set-2, .set-2b, .set-2c { grid-template-columns: 1fr; } .theme-3 { grid-template-columns: 1fr; } }
`;

function panel(id, title, sub, body, extra = '') {
  return `<section id="${id}" class="panel" style="overflow: hidden;">
    <div style="display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px 12px; flex-wrap: wrap;"><div style="flex: 1 1 240px;"><h2 style="margin: 0; font-size: 16px; font-weight: 700;">${title}</h2><p style="margin: 3px 0 0; font-size: 12.5px; color: var(--steel);">${sub}</p></div>${extra}</div>
    <div style="padding: 4px 22px 20px; display: flex; flex-direction: column; gap: 16px;">${body}</div>
  </section>`;
}
const label = (t) => `<span class="caps" style="display: block; margin-bottom: 6px;">${t}</span>`;

export function settingsBody({ minHeight = 1820 } = {}) {
  const rail = `<nav aria-label="Settings sections" class="rail">
    ${[['Account', 'user', false], ['Preferences', 'sun', true], ['Risk inputs', 'shield', false], ['AI providers', 'key', false], ['Brokerage', 'link', false]].map(([l, ic, on]) => `<a href="#" class="${on ? 'on' : ''}">${icon(ic, 15)}${l}${on ? '<span class="dot"></span>' : ''}</a>`).join('')}
    <p style="margin: 14px 12px 0; font-size: 11.5px; color: var(--steel-2); line-height: 1.5;">Saved to your account. Credentials are encrypted at rest and never leave with an AI read.</p>
  </nav>`;

  const account = panel('account', 'Account', 'Saved to your account.', `
    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;"><span style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--amber); color: var(--amber-ink); font: 700 16px/1 'IBM Plex Sans', sans-serif;">R</span><div style="flex: 1 1 200px; min-width: 0;"><div style="font-size: 14px; font-weight: 700;">Rodrigo</div><div style="font-size: 12.5px; color: var(--steel); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">rodrigo@example.com · signed in with Google</div></div><button class="btn secondary sm">Sign out</button></div>`);

  const prefs = panel('preferences', 'Preferences', 'Appearance and defaults. Presentation only — nothing here touches the score.', `
    <div class="set-2">
      <div>${label('Active persona')}<div class="field"><span>Balanced Swinger</span><span style="flex: 1;"></span>${icon('chevron', 14)}</div><div style="font-size: 11.5px; color: var(--steel); margin-top: 5px;">Frames every AI read and pre-fills the DTE window (14–45).</div></div>
      <div>${label('Default ticker')}<div class="field mono">SPY</div><div style="font-size: 11.5px; color: var(--steel); margin-top: 5px;">Where <span class="mono">/ticker</span> lands. Universe members get the scanner’s structure cadence.</div></div>
    </div>
    <div>${label('Theme')}<div class="theme-3">${[['moon', 'Dark', true], ['sun', 'Light', false], ['eye', 'System', false]].map(([ic, l, on]) => `<div style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 40px; border-radius: 8px; border: 1px solid ${on ? 'var(--amber)' : 'var(--line-2)'}; background: ${on ? 'var(--amber-tint)' : 'transparent'}; color: ${on ? 'var(--amber-text)' : 'var(--steel)'}; font-size: 13px; font-weight: 600;">${icon(ic, 14)}${l}</div>`).join('')}</div></div>`);

  const risk = panel('risk', 'Risk inputs', 'A trader input, not a credential. Sent with every AI read so the model can size to your cap.', `
    <div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--ink-2); border: 1px solid var(--line); font-size: 12.5px; color: var(--steel);">${icon('eye', 14)}<span>These two numbers, your open positions on the ticker, and the persona prompt are the only account data that leave. <a href="#">View what’s sent →</a></span></div>
    <div class="set-2 set-2b">
      <div>${label('Account size')}<div class="field mono"><span class="steel">$</span>25,000</div></div>
      <div>${label('Per-trade cap')}<div style="display: flex; gap: 8px; flex-wrap: wrap;"><div class="field mono focus" style="flex: 1 1 100px;">2</div><span class="seg" style="align-self: stretch;"><span class="on">% of account</span><span>$ per trade</span></span></div></div>
    </div>
    <div class="cap-row"><div class="cell"><span class="caps">Effective cap</span><span class="v" style="font-size: 20px;">$500</span><span class="s">2% of $25,000 · per trade</span></div><span style="width: 1px; height: 36px; background: var(--line-2);"></span><div style="flex: 1 1 240px; font-size: 12px; color: var(--steel); line-height: 1.5;">The AI read annotates its suggested size against this cap. Not set → the read says <span class="mono">not set</span> and links here; it never infers a unit.</div></div>
    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;"><button class="btn primary">Save risk inputs</button><span style="font-size: 12px; color: var(--steel);">Updated 12 Aug 2026 · stored encrypted</span></div>`);

  const ai = panel('ai', 'AI providers', 'Bring your own key. Your key, your cost; reads run on it and it is never pooled.', `
    <div class="seg" style="align-self: flex-start; max-width: 100%; overflow-x: auto;"><span class="on">Anthropic</span><span>OpenAI</span><span>Gemini</span><span>Grok</span></div>
    <div class="set-2 set-2c">
      <div style="min-width: 0;">${label('API key')}<div class="field mono"><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">sk-ant-••••••••••••••••••••••••••••7Qx2</span><span style="flex: 1;"></span><span class="chip outline" style="height: 20px; flex-shrink: 0;">${icon('check', 11)} saved · verified 2h ago</span></div></div>
      <div style="display: flex; gap: 8px;"><button class="btn secondary" style="flex: 1;">Replace key</button><button class="btn ghost">Test</button></div>
    </div>
    <div class="set-2 set-2c">
      <div>${label('Model for reads')}<div class="field mono"><span>claude-sonnet-5</span><span class="chip outline" style="height: 20px; font-size: 11px;">catalog recommended</span><span style="flex: 1;"></span>${icon('chevron', 14)}</div></div>
      <div style="font-size: 12px; color: var(--steel); line-height: 1.5;">Changing the model never recomputes a pinned read; it applies to the next request.</div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px dashed var(--line-2); font-size: 12px; color: var(--steel);">${icon('lock', 13)}<span>Grok subscription sign-in is present but unavailable until OAuth ships — use a Grok API key meanwhile.</span></div>`,
    `<span class="chip live" style="height: 24px;"><span class="dot"></span>Ready for reads</span>`);

  const broker = panel('brokerage', 'Brokerage', 'Read-only positions from your real account. Convexa never places, changes, or cancels an order.', `
    <div style="display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 10px; background: var(--ink-2); border: 1px solid var(--line); flex-wrap: wrap;"><span style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px; background: var(--raised); color: var(--steel);">${icon('link', 18)}</span><div style="flex: 1 1 220px;"><div style="font-size: 13.5px; font-weight: 600;">Webull · not connected</div><div style="font-size: 12px; color: var(--steel);">Read-only. Positions appear beside the sim book under a separate Live tab, marked from the same tape.</div></div><button class="btn secondary">Connect</button></div>
    <div style="font-size: 12px; color: var(--steel); display: flex; gap: 18px; flex-wrap: wrap;"><span>${icon('shield', 12)} no order path exists in the product</span><span>${icon('lock', 12)} credentials stored as ciphertext only</span></div>`,
    `<span class="chip outline" style="height: 24px;">coming soon</span>`);

  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${nav({ active: '' })}
    <section class="wrap" style="padding-top: 28px;">
      <h1 class="display" style="margin: 0; font-size: clamp(26px, 2.6vw, 34px); letter-spacing: -0.02em;">Settings</h1>
      <div class="set-grid">
        ${rail}
        <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0;">${account}${prefs}${risk}${ai}${broker}
          <p style="margin: 4px 0 0; font-size: 11.5px; color: var(--steel-2); line-height: 1.5;">Convexa is an analysis tool. Positions in the sim book are simulated (paper); a connected brokerage is read-only. Not investment advice.</p>
        </div>
      </div>
    </section>
    ${footer()}
  </div>`;
}
