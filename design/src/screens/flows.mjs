// Flows.dc.html — the two journeys that matter: the product spine and the gated ask-for-a-read path.
import { icon } from '../lib.mjs';

function node(title, sub, { tone = '', w = 180 } = {}) {
  const border = tone === 'amber' ? 'var(--amber)' : tone === 'warn' ? 'var(--warn)' : tone === 'signal' ? 'var(--signal)' : 'var(--line-2)';
  const bg = tone === 'amber' ? 'var(--amber-tint)' : tone === 'warn' ? 'var(--warn-tint)' : tone === 'signal' ? 'var(--signal-tint)' : 'var(--panel)';
  return `<div style="width: ${w}px; flex-shrink: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid ${border}; background: ${bg};"><div style="font-size: 12.5px; font-weight: 600;">${title}</div><div style="font-size: 11px; color: var(--steel); margin-top: 2px; line-height: 1.4;">${sub}</div></div>`;
}
const arrow = (label = '') => `<div style="display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; width: 54px;"><span style="display: inline-flex; color: var(--steel-2);">${icon('arrow', 18)}</span>${label ? `<span style="font-size: 11px; color: var(--steel); text-align: center; line-height: 1.2;">${label}</span>` : ''}</div>`;
const branch = (label) => `<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--steel); padding-left: 8px;"><span style="width: 18px; height: 1px; background: var(--line-2);"></span>${label}</div>`;

export function flowsBody() {
  const spine = `<div style="display: flex; align-items: center;">
    ${node('Scanner', 'ranked universe · Prime → Dormant · hover preview · ↵ opens the desk', { tone: 'signal' })}${arrow('pick a name')}
    ${node('Ticker desk', 'field + levels · read strip · tape · context · sticky masthead', { tone: 'signal' })}${arrow('ask')}
    ${node('AI read', 'verdict → risk → why · pinned to a snapshot · your key', { tone: 'amber' })}${arrow('accept')}
    ${node('Review sim trade', 'pre-filled · sizing is yours · cap annotated · confirm', { tone: 'amber' })}${arrow('confirm')}
    ${node('Positions', 'live marks · honest basis · orders watch the mid', { tone: 'signal' })}${arrow('close')}
    ${node('Track record', 'by persona · tier · read · IV band · with sample counts', {})}
  </div>`;

  const ask = `<div style="display: flex; align-items: flex-start;">
    <div>${node('Signed out', 'gate replaces the action surface · export still reachable', { tone: 'warn', w: 170 })}${branch('sign in → next')}</div>${arrow('sign in')}
    <div>${node('No key', 'distinct powering reasons · CTA → Settings › AI providers', { tone: 'warn', w: 170 })}${branch('add key → next')}</div>${arrow('key saved')}
    <div>${node('Idle', 'composer: persona · model · Analyze snapshot', { w: 170 })}${branch('quiet gate · no fresh edge → “Ask anyway”')}${branch('cooldown 60 s · cap 10/day')}</div>${arrow('analyze')}
    <div>${node('Loading', '3 named steps · skeleton in the final shape · 5–15 s', { w: 150 })}${branch('unavailable → Retry · rest of desk unaffected')}</div>${arrow('read lands')}
    <div style="display: flex; flex-direction: column; gap: 8px;">${node('Trade', 'verdict · risk 2×2 · grounding · review', { tone: 'amber', w: 170 })}${node('No trade', 're-engage when · alert on level', { w: 170 })}${branch('newer snapshot → stale strip → refresh')}</div>${arrow('review')}
    <div>${node('Trade entry dialog', 'one shared sim dialog · cap check · confirm', { tone: 'amber', w: 170 })}${branch('403 at confirm → zero stored · sign-in prompt')}</div>${arrow('confirm')}
    <div>${node('Position open', 'aiRecFingerprint kept · outcome joins the ledger', { tone: 'signal', w: 160 })}</div>
  </div>`;

  return `<div style="width: 1440px; min-height: 760px; background: var(--ink); color: var(--phosphor); padding: 32px 40px 40px; display: flex; flex-direction: column; gap: 28px;">
    <div><div class="caps" style="color: var(--amber-text);">User flows</div><h1 class="display" style="margin: 6px 0 0; font-size: 26px;">Scan → Ticker → Plan → Track, and the gated path to a read</h1><p style="margin: 6px 0 0; font-size: 13px; color: var(--steel); max-width: 800px;">Every node is a state that already exists in the product; the redesign changes how each one looks and where it sits, never what it means. Amber marks the moments that need a deliberate confirmation.</p></div>
    <section style="display: flex; flex-direction: column; gap: 12px;"><span class="caps">1 · The product spine</span>${spine}</section>
    <section style="display: flex; flex-direction: column; gap: 12px;"><span class="caps">2 · Asking for a read (auth outermost, then key, then the guardrails)</span>${ask}</section>
    <section style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; font-size: 12px; color: var(--steel); line-height: 1.5;">
      ${[['Stream drops', 'Live cells dim with ⏸ and keep their last value; pulses and particles stop; the connection chip turns burnt orange with an icon. Static reads never change.'], ['Cold start', 'Skeletons take the exact final shape (masthead, field, strip, panels). The only blank screen is a cold-start failure with Retry.'], ['Ticker not in the universe', 'A muted single-name caveat under the masthead; on-demand structure at the ticker cadence, never the scanner’s. No warning chrome.'], ['Keyboard', 'Skip link → main; ⌘K palette; every control keeps the one amber focus ring; widgets are groups with h2 titles and an expand overlay.']].map(([t, b]) => `<div class="panel quiet" style="padding: 12px 14px;"><div class="caps" style="margin-bottom: 4px;">${t}</div>${b}</div>`).join('')}
    </section>
  </div>`;
}
