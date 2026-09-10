// Scanner — the dense universe read. Table on wide screens, cards under 1000px, hover preview on desktop.
import { footer, icon, nav, seq, sparkline, structureField } from '../lib.mjs';

export const SCAN_CSS = `
  .scan-head { display: flex; align-items: flex-end; gap: 16px 24px; flex-wrap: wrap; }
  .scan-meta { margin-left: auto; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .scan-tools { display: flex; align-items: center; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .scan-tools .fill { flex: 1; min-width: 20px; }
  .scan-row, .scan-headrow { display: grid; grid-template-columns: 110px 84px 64px 110px 100px 104px 78px 70px 70px 64px 64px 104px minmax(128px, 1fr); gap: 8px; align-items: center; padding: 0 16px; }
  @media (max-width: 1299px) { .scan-row, .scan-headrow { grid-template-columns: 110px 84px 64px 110px 100px 104px 78px 70px 64px 104px minmax(128px, 1fr); } .scan-row > :nth-child(9), .scan-headrow > :nth-child(9), .scan-row > :nth-child(11), .scan-headrow > :nth-child(11) { display: none; } }
  @media (max-width: 1199px) { .scan-row, .scan-headrow { grid-template-columns: 110px 84px 64px 110px 100px 78px 64px 104px minmax(128px, 1fr); } .scan-row > :nth-child(6), .scan-headrow > :nth-child(6), .scan-row > :nth-child(8), .scan-headrow > :nth-child(8) { display: none; } }
  .scan-headrow { padding-top: 10px; padding-bottom: 10px; }
  .scan-row { height: 44px; border-top: 1px solid var(--line); }
  .scan-cards { display: none; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .scan-preview { position: absolute; right: 60px; top: 108px; width: 420px; z-index: 3; }
  .scan-notes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  @media (max-width: 1199px) { .scan-preview { display: none; } }
  @media (max-width: 999px) { .scan-table { display: none; } .scan-cards { display: grid; } .scan-notes { grid-template-columns: 1fr; } .scan-density { display: none; } }
  @media (max-width: 599px) { .scan-cards { grid-template-columns: 1fr; } }
`;

import { SCAN_LEAD as ROWS, SCAN_REST as REST } from '../data/index.mjs';
const COLS = ['Symbol', 'Price', 'Chg', 'Score', 'Tier', 'Regime', 'Flip dist', 'Call wall', 'Put wall', 'IV / HV', 'Vol / OI', 'As-of', ''];

const tierChip = (tier) => `<span class="chip ${tier === 'Prime' || tier === 'Actionable' ? 'emph' : ''}" style="${tier === 'Prime' ? 'border: 1px solid var(--amber);' : ''}">${tier}</span>`;
const staleChip = `<span class="chip warn" style="height: 18px; padding: 0 6px; font-size: 11px;">${icon('warn', 10)} Stale</span>`;

function row(r, hovered = false) {
  const [s, p, c, score, tier, reg, flip, cw, pw, ivhv, voloi, age, status, seed] = r;
  const up = c.startsWith('+');
  return `<div class="scan-row" style="${hovered ? 'background: var(--raised);' : ''} ${status === 'stale' ? 'opacity: 0.85;' : ''}">
    <span style="display: flex; align-items: center; gap: 8px; min-width: 0;"><span class="mono" style="font-size: 13px; font-weight: 600;">${s}</span>${status === 'stale' ? staleChip : ''}</span>
    <span class="mono ${hovered ? 'flash-up' : ''}" style="font-size: 13px;">${p}</span>
    <span class="mono ${up ? 'up' : 'down'}" style="font-size: 12px;">${c}</span>
    <span style="display: flex; align-items: center; gap: 8px;"><span class="mono" style="font-size: 13px; font-weight: 600; min-width: 22px;">${score}</span><span style="flex: 1; height: 5px; border-radius: 3px; background: var(--raised-2); overflow: hidden;"><span style="display: block; height: 100%; width: ${score}%; background: ${score >= 70 ? 'var(--amber)' : 'var(--steel)'};"></span></span></span>
    <span>${tierChip(tier)}</span>
    <span><span class="chip ${reg === 'positive' ? 'up' : 'down'}">${reg} γ</span></span>
    <span class="mono" style="font-size: 12.5px;">${flip}</span>
    <span class="mono" style="font-size: 12.5px;">${cw}</span>
    <span class="mono" style="font-size: 12.5px;">${pw}</span>
    <span class="mono" style="font-size: 12.5px;">${ivhv}</span>
    <span class="mono" style="font-size: 12.5px;">${voloi}</span>
    <span class="mono" style="font-size: 11.5px; color: var(--steel);">${age}</span>
    <span style="display: flex; justify-content: flex-end; align-items: center; gap: 6px;">${sparkline(seq(16, seed, 0, 1), { width: 48, height: 18, color: up ? 'var(--up)' : 'var(--down)' })}${hovered ? `<a href="#" class="btn primary sm">Open ${icon('arrow', 12)}</a>` : `<span style="color: var(--steel-2); display: inline-flex;">${icon('chevronR', 14)}</span>`}</span>
  </div>`;
}

function card(r) {
  const [s, p, c, score, tier, reg, flip, cw, pw, ivhv, , age, status, seed] = r;
  const up = c.startsWith('+');
  return `<a href="#" class="panel" style="padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; text-decoration: none; color: inherit; ${status === 'stale' ? 'opacity: 0.85;' : ''}">
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><span class="mono" style="font-size: 15px; font-weight: 600;">${s}</span>${tierChip(tier)}${status === 'stale' ? staleChip : ''}<span style="flex: 1;"></span><span style="display: inline-flex; color: var(--steel-2);">${icon('chevronR', 16)}</span></div>
    <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;"><span class="mono" style="font-size: 22px; font-weight: 500;">${p}</span><span class="mono ${up ? 'up' : 'down'}" style="font-size: 12.5px;">${c}</span><span class="chip ${reg === 'positive' ? 'up' : 'down'}" style="margin-left: auto;">${reg} γ</span></div>
    <div style="display: flex; align-items: center; gap: 8px;"><span class="caps">Score</span><span class="mono" style="font-size: 13px; font-weight: 600;">${score}</span><span style="flex: 1; height: 5px; border-radius: 3px; background: var(--raised-2); overflow: hidden;"><span style="display: block; height: 100%; width: ${score}%; background: ${score >= 70 ? 'var(--amber)' : 'var(--steel)'};"></span></span></div>
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px;">${[['Flip', flip], ['Call', cw], ['Put', pw], ['IV/HV', ivhv]].map(([l, v]) => `<div class="cell"><span class="caps" style="font-size: 11px;">${l}</span><span class="mono" style="font-size: 13px;">${v}</span></div>`).join('')}</div>
    <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--steel);"><span>Structure as-of <span class="mono">${age}</span></span><span style="flex: 1;"></span>${sparkline(seq(16, seed, 0, 1), { width: 64, height: 18, color: up ? 'var(--up)' : 'var(--down)' })}</div>
  </a>`;
}

export function scannerBody({ minHeight = 1300 } = {}) {
  const chip = (l, on = false) => `<span class="chip outline" style="height: 28px; padding: 0 12px; font-size: 12px; cursor: pointer; ${on ? 'border-color: var(--amber); color: var(--amber-text); background: var(--amber-tint);' : ''}">${l}</span>`;
  return `<div class="is-live" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${nav({ active: 'scanner' })}
    <section class="wrap" style="padding-top: 26px;">
      <div class="scan-head">
        <div><h1 class="display" style="margin: 0; font-size: clamp(26px, 2.6vw, 34px); letter-spacing: -0.02em;">Scanner</h1><p style="margin: 6px 0 0; font-size: 13.5px; color: var(--steel); max-width: 640px;">One dense read of the tracked universe — which name deserves the deep-dive right now. Structure is a snapshot; <a href="#">see how it is computed</a>.</p></div>
        <div class="scan-meta">
          <span class="chip outline" style="height: 28px; font-weight: 700; letter-spacing: 0.04em;">RTH</span>
          <span style="font-size: 12px; color: var(--steel);">Prices <span class="signal">●</span> live · structure ~3 min · hot names sooner</span>
          <span class="mono" style="font-size: 12px; color: var(--steel);">Structure as-of <span style="color: var(--phosphor);">1m 12s</span></span>
        </div>
      </div>
      <div class="scan-tools">
        <span style="font-size: 13px; font-weight: 600;">Your view</span><span class="mono" style="font-size: 12px; color: var(--steel);">24 names</span>
        <button class="btn secondary sm">${icon('gear', 13)} Edit view</button>
        <span style="width: 1px; height: 20px; background: var(--line-2); margin: 0 4px;"></span>
        ${chip('Prime')}${chip('Actionable', true)}${chip('Watch')}${chip('Score ≥ 70')}${chip('|Flip| ≤ 1%')}${chip('IV cheap', true)}${chip('IV rich')}
        <span style="font-size: 12px; color: var(--steel); margin-left: 4px;">Showing <span class="mono">12</span> of <span class="mono">24</span> · <a href="#">clear</a></span>
        <span class="fill"></span>
        <span class="seg scan-density"><span class="on">Compact</span><span>Comfortable</span></span>
      </div>
    </section>
    <section class="wrap" style="padding-top: 14px; position: relative;">
      <div class="panel scan-table" style="overflow: hidden;">
        <div class="caps scan-headrow">${COLS.map((c, i) => `<span style="display: flex; align-items: center; gap: 4px; ${i === 3 ? 'color: var(--phosphor);' : ''}">${c}${i === 3 ? icon('chevron', 12) : ''}</span>`).join('')}</div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 16px; background: var(--ink-2); border-top: 1px solid var(--line);" class="caps"><span>Indexes &amp; megacaps</span><span style="font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--steel-2);">the zero-state lead group</span></div>
        ${ROWS.map((r, i) => row(r, i === 1)).join('')}
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 16px; background: var(--ink-2); border-top: 1px solid var(--line);" class="caps"><span>Rest of your view</span></div>
        ${REST.map((r) => row(r)).join('')}
        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--steel); flex-wrap: wrap;"><span>Per-row age is the structure snapshot, never the price.</span>${staleChip}<span>= the sweep last touched this name more than 3 minutes ago; rows never blank.</span><span style="margin-left: auto;">Sweep ran <span class="mono">38s</span> ago</span></div>
      </div>
      <div class="scan-cards">
        <div style="grid-column: 1 / -1; display: flex; align-items: center; gap: 8px;" class="caps"><span>Indexes &amp; megacaps</span><span style="flex: 1; height: 1px; background: var(--line);"></span></div>
        ${ROWS.map(card).join('')}
        <div style="grid-column: 1 / -1; display: flex; align-items: center; gap: 8px;" class="caps"><span>Rest of your view</span><span style="flex: 1; height: 1px; background: var(--line);"></span></div>
        ${REST.map(card).join('')}
        <p style="grid-column: 1 / -1; margin: 0; font-size: 11.5px; color: var(--steel);">Per-card age is the structure snapshot, never the price. ${staleChip} = the sweep last touched this name more than 3 minutes ago.</p>
      </div>
      <div class="panel scan-preview" style="box-shadow: var(--e4); background: var(--raised); overflow: hidden;">
        <div style="display: flex; align-items: center; gap: 8px; padding: 10px 14px 6px; flex-wrap: wrap;"><span class="mono" style="font-size: 13px; font-weight: 600;">SPY</span><span class="chip up">positive γ</span><span class="chip emph">Actionable · 72</span><span style="flex: 1;"></span><span style="font-size: 11px; color: var(--steel);">hover preview · as-of 42s</span></div>
        <div style="padding: 0 4px;">${structureField({ width: 420, height: 150, id: 'scan', showLabels: false })}</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px 14px 12px; border-top: 1px solid var(--line);">${[['Call wall', '580', 'var(--up)'], ['Flip', '568.50', 'var(--amber)'], ['Put wall', '560', 'var(--down)'], ['Score why', 'near wall +28', 'var(--steel)']].map(([l, v, c]) => `<div class="cell"><span class="caps" style="font-size: 11px;">${l}</span><span class="mono" style="font-size: 13px; color: ${c};">${v}</span></div>`).join('')}</div>
        <div style="display: flex; gap: 8px; padding: 0 14px 12px;"><a href="#" class="btn primary sm" style="flex: 1;">Open SPY desk ${icon('arrow', 12)}</a><button class="btn secondary sm">${icon('bell', 12)} Alert</button></div>
      </div>
    </section>
    <section class="wrap scan-notes" style="padding-top: 16px;">
      ${[['Why this score · SPY 72', 'near wall / flip <span class="mono">+28</span> · IV vs HV stretch <span class="mono">+18</span> · active setups <span class="mono">+14</span> · flip transition <span class="mono">+8</span> · dark-pool confluence <span class="mono">+4</span>'], ['Zero-state lead group', 'Anonymous or empty views open on <strong style="font-weight: 600; color: var(--phosphor);">Indexes &amp; megacaps</strong> so the first read is always a real one. Saved views need a sign-in and are never claimed for anonymous visitors.'], ['Price stream drops', 'Prices dim and the cadence header says <em>Prices offline · showing last known</em>. Structure keeps rendering — a dropped stream never blanks a row.']].map(([t, b]) => `<div class="panel quiet" style="padding: 12px 14px;"><div class="caps" style="margin-bottom: 4px;">${t}</div><p style="margin: 0; font-size: 12px; color: var(--steel); line-height: 1.55;">${b}</p></div>`).join('')}
    </section>
    ${footer()}
  </div>`;
}
