// Alerts — structure rules (score gate · tier change · level touch) on snapshots, evaluated while a desk is open.
import { footer, icon, nav } from '../lib.mjs';
import { ALERT_RULES } from '../data/index.mjs';

export const ALERTS_CSS = `
  .al-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 16px; align-items: start; }
  .al-rule { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--line); }
  .al-kind { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  @media (max-width: 899px) { .al-grid { grid-template-columns: 1fr; } }
  @media (max-width: 599px) { .al-rule { grid-template-columns: 56px minmax(0, 1fr); } .al-rule .al-meta { grid-column: 2; } .al-rule .al-act { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; } .al-rule .al-chev { display: none; } }
`;

const label = (t) => `<span class="caps" style="display: block; margin-bottom: 6px;">${t}</span>`;
const toggle = (on) => `<span role="switch" aria-checked="${on}" style="display: inline-flex; align-items: center; width: 38px; height: 22px; padding: 2px; border-radius: 999px; background: ${on ? 'var(--amber)' : 'var(--raised-2)'}; justify-content: ${on ? 'flex-end' : 'flex-start'};"><span style="width: 18px; height: 18px; border-radius: 50%; background: ${on ? 'var(--amber-ink)' : 'var(--steel)'};"></span></span>`;

export function alertsBody({ minHeight = 1100 } = {}) {
  const rules = ALERT_RULES;
  const composer = `<section class="panel">
    <div style="padding: 16px 18px 12px; border-bottom: 1px solid var(--line);"><h2 style="margin: 0; font-size: 15px; font-weight: 700;">New rule</h2><p style="margin: 3px 0 0; font-size: 12px; color: var(--steel);">Rules evaluate against structure snapshots while a ticker desk is open — not a background stream.</p></div>
    <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;">
      <div>${label('Symbol')}<div class="field mono focus">SPY<span style="width: 1px; height: 16px; background: var(--amber);"></span><span style="flex: 1;"></span><span class="chip outline" style="font-size: 11px;">universe member</span></div></div>
      <div>${label('Kind')}<div class="al-kind">${[['Score gate', true], ['Tier change', false], ['Level touch', false]].map(([k, on]) => `<div style="display: flex; align-items: center; justify-content: center; height: 40px; border-radius: 8px; border: 1px solid ${on ? 'var(--amber)' : 'var(--line-2)'}; background: ${on ? 'var(--amber-tint)' : 'transparent'}; color: ${on ? 'var(--amber-text)' : 'var(--steel)'}; font-size: 12.5px; font-weight: 600; text-align: center;">${k}</div>`).join('')}</div></div>
      <div>${label('Score ≥')}<div style="display: flex; gap: 8px; align-items: center;"><div class="field mono" style="width: 110px;">70</div><span class="seg"><span>50</span><span class="on">70</span><span>85</span></span><span style="font-size: 11.5px; color: var(--steel);">Prime starts around 80</span></div></div>
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: var(--ink-2); border: 1px solid var(--line); font-size: 12px; color: var(--steel); flex-wrap: wrap;">${icon('bell', 14)}<span style="flex: 1 1 200px;">Browser notifications <span class="chip outline" style="height: 18px; font-size: 11px;">not allowed</span> — you will see fired alerts here and on the desk.</span><button class="btn secondary sm">Allow notifications</button></div>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"><button class="btn primary">${icon('plus', 14)} Add rule</button><span style="font-size: 11.5px; color: var(--steel-2);">Stored in this browser · 4 rules</span></div>
    </div>
  </section>`;

  const list = `<section class="panel" style="overflow: hidden;">
    <div style="display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; flex-wrap: wrap;"><h2 style="margin: 0; font-size: 15px; font-weight: 700;">Rules</h2><span class="chip">4</span><span style="flex: 1;"></span><span class="seg"><span class="on">All</span><span>Armed</span><span>Paused</span></span></div>
    ${rules.map(([s, k, c, m, on, live]) => `<div class="al-rule">
      <span class="mono" style="font-size: 13px; font-weight: 600;">${s}</span>
      <span class="al-meta" style="min-width: 0;"><span style="font-size: 12.5px; font-weight: 600;">${k} <span class="mono steel" style="font-weight: 500;">· ${c}</span></span><span style="display: block; font-size: 11px; color: var(--steel); margin-top: 2px;">${live ? '<span class="chip live" style="height: 16px; font-size: 11px; padding: 0 6px;"><span class="dot"></span>desk open</span> ' : ''}${m}</span></span>
      <span class="al-act">${toggle(on)}<span style="display: inline-flex; color: var(--steel-2);">${icon('trash', 15)}</span></span>
      <span class="al-chev" style="display: inline-flex; color: var(--steel-2);">${icon('chevronR', 14)}</span>
    </div>`).join('')}
    <div style="padding: 10px 16px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--steel);">A rule needs its ticker desk open to evaluate. Nothing runs in the background, and a missed move is never back-filled.</div>
  </section>
  <section class="panel quiet" style="overflow: hidden; margin-top: 16px;">
    <div style="display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px;"><h2 style="margin: 0; font-size: 15px; font-weight: 700;">Fired</h2><span class="chip">today · 2</span></div>
    ${[['10:12 ET', 'SPY', 'Score gate ≥ 70 fired at 72 · Actionable', 'Open SPY desk'], ['09:48 ET', 'NVDA', 'Gamma flip 133.20 touched · mid 133.18', 'Open NVDA desk']].map(([t, s, d, a]) => `<div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--line); flex-wrap: wrap;"><span class="mono" style="font-size: 11px; color: var(--steel); min-width: 62px;">${t}</span><span class="mono" style="font-size: 13px; font-weight: 600; min-width: 48px;">${s}</span><span style="font-size: 12.5px; flex: 1 1 200px;">${d}</span><a href="#" class="btn link" style="font-size: 12px;">${a} ${icon('arrow', 12)}</a></div>`).join('')}
  </section>`;

  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${nav({ active: 'alerts' })}
    <section class="wrap" style="padding-top: 26px;">
      <h1 class="display" style="margin: 0; font-size: clamp(26px, 2.6vw, 34px); letter-spacing: -0.02em;">Alerts</h1>
      <p style="margin: 6px 0 0; font-size: 13.5px; color: var(--steel); max-width: 640px;">Level-touch, tier-change and score-gate rules on structure snapshots — not a live stream. Open a ticker so rules can evaluate; optional browser notifications after you allow them. <a href="#">Two-speed structure vs tape</a>.</p>
      <div class="al-grid" style="margin-top: 18px;">${composer}<div>${list}</div></div>
    </section>
    ${footer()}
  </div>`;
}
