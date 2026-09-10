// Desk states — cold load, cold-start failure, stream offline, empty selection + non-universe caveat.
import { icon, ring, structureField } from '../lib.mjs';
import { figureCell } from '../components/figure-cell.mjs';

export const STATES_CSS = `
  .states-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
  .mini { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .mini-frame { border: 1px solid var(--line-2); border-radius: 14px; overflow: hidden; background: var(--ink); }
  .mini-mast { display: flex; align-items: center; gap: 12px; padding: 14px 16px 10px; flex-wrap: wrap; }
  .mini-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .mini-strip > * { border-right: 1px solid var(--line); } .mini-strip > *:last-child { border-right: 0; }
  @media (max-width: 899px) { .states-grid { grid-template-columns: 1fr; } }
`;

const cell = (label, value, sub, extra = '', cls = '') => figureCell({ label, value, sub, offline: cls === 'offline', size: 18, padding: '10px 14px' }) + (extra ? '' : '');

export function deskStatesBody({ minHeight = 1500 } = {}) {
  const wrap = (title, when, frame, note) => `<div class="mini">
    <div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;"><span style="font-size: 13px; font-weight: 700;">${title}</span><span style="font-size: 11.5px; color: var(--steel);">${when}</span></div>
    <div class="mini-frame">${frame}</div>
    <p style="margin: 0; font-size: 11.5px; line-height: 1.5; color: var(--steel);">${note}</p>
  </div>`;

  const coldLoad = wrap('Cold load', 'first paint · before the first bundle', `
    <div class="mini-mast"><div class="skel" style="width: 90px; height: 34px;"></div><div class="skel" style="width: 130px; height: 34px;"></div><div class="skel" style="width: 80px; height: 20px;"></div><span style="flex: 1;"></span><div class="skel" style="width: 150px; height: 34px;"></div><div class="skel" style="width: 180px; height: 34px;"></div></div>
    <div style="padding: 0 16px 10px; display: flex; gap: 8px;">${[1, 2, 3, 4].map(() => '<div class="skel" style="width: 56px; height: 24px; border-radius: 999px;"></div>').join('')}</div>
    <div class="panel" style="margin: 0 16px; overflow: hidden;"><div style="padding: 12px 16px; display: flex; gap: 10px;"><div class="skel" style="width: 120px; height: 14px;"></div><div class="skel" style="width: 260px; height: 12px;"></div></div><div class="well" style="display: grid; grid-template-columns: 1fr 200px;"><div style="padding: 12px;"><div class="skel" style="height: 170px; border-radius: 8px;"></div></div><div style="border-left: 1px solid var(--line); padding: 12px; display: flex; flex-direction: column; gap: 10px;">${[1, 2, 3, 4, 5].map(() => '<div class="skel" style="height: 14px;"></div>').join('')}</div></div></div>
    <div class="panel mini-strip" style="margin: 12px 16px 16px;">${[1, 2, 3, 4].map(() => '<div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;"><div class="skel" style="width: 50%; height: 10px;"></div><div class="skel" style="width: 65%; height: 20px;"></div><div class="skel" style="width: 40%; height: 9px;"></div></div>').join('')}</div>`,
    'Skeletons take the exact final shape — masthead, field with ladder, strip — so the first bundle lands without a jump. The skeleton class never appears after load: loading ≠ empty ≠ offline.');

  const failure = wrap('Cold-start failure', 'the only blank desk · bundle never arrived', `
    <div class="mini-mast"><span class="display" style="font-size: 30px;">SPY</span><span class="mono" style="font-size: 30px; color: var(--steel-2);">—</span><span style="flex: 1;"></span><div class="field" style="height: 34px;"><span class="caps" style="font-size: 11px;">Expirations</span><span style="font-weight: 600;">All</span>${icon('chevron', 14)}</div></div>
    <div style="margin: 4px 16px 16px; padding: 14px 16px; border-radius: 10px; background: var(--warn-tint); border: 1px solid var(--warn); display: flex; align-items: center; gap: 12px; flex-wrap: wrap;"><span class="warn" style="display: inline-flex;">${icon('warn', 18)}</span><div style="flex: 1 1 240px;"><div style="font-size: 13.5px; font-weight: 600;">Couldn’t load SPY.</div><div style="font-size: 12px; color: var(--steel); margin-top: 2px;">The structure request failed before any snapshot arrived. Nothing is cached for this desk yet.</div></div><button class="btn secondary sm">${icon('refresh', 13)} Retry</button></div>
    <div style="margin: 0 16px 16px; padding: 12px 14px; border-radius: 10px; border: 1px dashed var(--line-2); font-size: 12px; color: var(--steel);">The toolbar stays usable — change the ticker or expirations without leaving. A poll failure <em>after</em> a first success is different: the desk keeps the last bundle behind a soft “Couldn’t refresh — showing data from 3 min ago. Retrying automatically.”</div>`,
    'A true warning: burnt orange plus the icon, with Retry beside the message. This is the only state that shows a blank desk, and it says exactly why.');

  const offline = wrap('Stream offline', 'payload gap > 15 s · structure keeps rendering', `
    <div class="mini-mast"><span class="display" style="font-size: 30px;">SPY</span><span class="mono" style="font-size: 30px; font-weight: 500; opacity: 0.5;">573.12</span><span class="chip warn">${icon('warn', 11)} Live offline — reconnecting…</span><span class="chip up">positive gamma</span></div>
    <div style="padding: 0 16px 12px; font-size: 12px; color: var(--steel);"><span style="opacity: 0.5;">⏸ Last trade 573.10</span> · Levels @ 573.05 · Structure as-of <span class="mono">42s</span></div>
    <div class="panel mini-strip" style="margin: 0 16px;">${cell('Net flow · 5m', '+12,480', '⏸ offline · last known', '', 'offline')}${cell('Spread', '$0.01', '⏸ offline · last known', '', 'offline')}${cell('Gamma flip', '568.50', '−0.81% from mid')}${cell('Call wall', '580.00', '+1.20% from mid')}</div>
    <div style="margin: 12px 16px 16px; padding: 10px 12px; border-radius: 8px; background: var(--ink-2); border: 1px solid var(--line); font-size: 11.5px; color: var(--steel);">Live-derived cells dim to 50% and keep their last value with ⏸; pulses, particles and the tape trail stop. Structure cells, the field and every context read stay at full strength — they were never live.</div>`,
    'Live-vs-static isolation made visible: the drop is styled truth, not a blank. Only one connection chip exists on the page, and it turns burnt orange with an icon.');

  const empty = wrap('No expirations · non-universe name', 'user-driven empties', `
    <div class="mini-mast"><span class="display" style="font-size: 30px;">RKLB</span><span class="mono" style="font-size: 30px; font-weight: 500;">24.61</span><span class="mono up" style="font-size: 13px;">+2.1%</span><span style="flex: 1;"></span><div class="field" style="height: 34px; border-color: var(--amber);"><span class="caps" style="font-size: 11px;">Expirations</span><span style="font-weight: 600;">None selected</span>${icon('chevron', 14)}</div></div>
    <div style="padding: 0 16px 10px; font-size: 12px; color: var(--steel);">Not in the tracked universe — structure computes on demand at the ticker cadence; thin names can show noise. <a href="#">Why</a></div>
    <div style="margin: 0 16px 16px; padding: 14px 16px; border-radius: 10px; background: var(--signal-tint); border: 1px solid var(--signal); display: flex; align-items: center; gap: 12px; flex-wrap: wrap;"><span class="signal" style="display: inline-flex;">${icon('info', 18)}</span><div style="flex: 1 1 240px; font-size: 13px;">No expirations selected — pick one or more above, or use <strong style="font-weight: 600;">All</strong>.</div><button class="btn secondary sm">Select all</button></div>
    <div class="panel" style="margin: 0 16px 16px; overflow: hidden; opacity: 0.55;"><div class="well" style="padding: 6px 4px 0;">${structureField({ width: 720, height: 160, id: 'em', showLabels: false, live: false })}</div></div>`,
    'Empty by choice is information, not a warning: signal blue, an info glyph, and the fix beside it. The single-name caveat is a muted line under the masthead — never red, never blocking.');

  const prime = wrap('Prime tier', 'score ≥ 80 · the only tier that prompts', `
    <div class="mini-mast"><span class="display" style="font-size: 30px;">NVDA</span><span class="mono" style="font-size: 30px; font-weight: 500;">138.40</span><span class="mono up" style="font-size: 13px;">+1.9%</span><span class="chip up">positive gamma</span><span class="chip live"><span class="dot"></span>live · open</span></div>
    <div style="margin: 0 16px 12px; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; background: var(--amber-tint); border: 1px solid var(--amber); flex-wrap: wrap;"><span class="amber" style="display: inline-flex;">${icon('bolt', 18)}</span><div style="flex: 1 1 240px;"><div style="font-size: 13.5px; font-weight: 600; color: var(--amber-text);">Prime setup — the strongest edge Convexa sees right now.</div><div style="font-size: 12px; color: var(--steel); margin-top: 2px;">Score 88 · near wall +38 · IV stretch +22 · 2 setups · flip transition. Not a trade signal.</div></div><button class="btn secondary sm" style="border-color: var(--amber); color: var(--amber-text);">Simulate this trade ${icon('arrow', 12)}</button><span style="display: inline-flex; color: var(--steel);">${icon('close', 14)}</span></div>
    <div class="panel mini-strip" style="margin: 0 16px 12px;"><div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px;">${ring(88, { size: 40 })}<div class="cell"><span class="caps">Opportunity</span><span class="v" style="font-size: 16px;"><span class="amber">Prime</span></span></div></div>${cell('Call wall', '140.00', '+1.16% from mid')}${cell('Gamma flip', '133.20', '−3.8% from mid')}${cell('IV / HV', '1.31', 'options look rich')}</div>
    <div style="margin: 0 16px 16px; padding: 10px 12px; border-radius: 8px; border: 1px dashed var(--line-2); font-size: 11.5px; color: var(--steel);">Signed out, the banner stays and the button becomes the standard refusal: “Sign in to open a paper position. No real order is ever sent.”</div>`,
    'Prime is the only tier that prompts. The banner is brand amber — an active state, not a warning — with the bolt as its glyph. It dismisses per ticker and never opens the dialog on its own.');

  const closed = wrap('Market closed · session replay', 'weekend, holiday, overnight, or a quiet feed', `
    <div class="mini-mast"><span class="display" style="font-size: 30px;">SPY</span><span class="mono" style="font-size: 30px; font-weight: 500;">573.12</span><span class="chip">○ market closed · mid 573.12</span><span class="chip up">positive gamma</span></div>
    <div style="padding: 0 16px 12px; font-size: 12px; color: var(--steel);"><span class="dim">○</span> Last trade <span class="mono">573.10</span> · replay · Levels @ <span class="mono">573.05</span> · Structure as-of <span class="mono">Wed close</span></div>
    <div class="panel" style="margin: 0 16px 12px; overflow: hidden;"><div style="display: flex; align-items: center; gap: 8px; padding: 10px 14px 6px; flex-wrap: wrap;"><h2 style="margin: 0; font-size: 13.5px; font-weight: 600;">Session tape</h2><span class="chip outline">replaying Wed Sep 2 · SPY · 1×</span><span style="flex: 1;"></span><span style="font-size: 11px; color: var(--steel);">the last completed session, never framed as live</span></div><div class="well mini-strip">${cell('Net flow', '+8,120', 'session replay')}${cell('Spread', '$0.01', 'session replay')}${cell('Gamma flip', '568.50', '−0.81% from mid')}${cell('VWAP', '571.88', 'session')}</div></div>
    <div style="margin: 0 16px 16px; display: flex; flex-direction: column; gap: 6px;"><span class="caps">The one connection chip · every state</span><div style="display: flex; gap: 8px; flex-wrap: wrap;"><span class="chip live"><span class="dot"></span>live · open · 573.12</span><span class="chip">○ market closed · mid 573.12</span><span class="chip warn">${icon('warn', 11)} overnight — no live data</span><span class="chip warn">${icon('warn', 11)} no live ticks · mid 573.12</span><span class="chip warn">${icon('warn', 11)} Live offline — reconnecting…</span><span class="chip outline">○ replay · Wed Sep 2</span></div></div>`,
    'Closed is neutral, not a warning; overnight and no-ticks are true warnings with the icon; replay is an outline chip that names the session. The tape widget is retitled so nothing reads as live, and only one connection chip ever exists on the page.');

  return `<div class="is-live" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 36px clamp(16px, 3vw, 40px) 40px;">
    <div style="margin-bottom: 22px;"><div class="caps" style="color: var(--amber-text);">Ticker desk · degraded, empty and special states</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(24px, 2.4vw, 30px);">Loading ≠ empty ≠ offline ≠ failed ≠ closed</h1><p style="margin: 8px 0 0; max-width: 760px; font-size: 13.5px; color: var(--steel); line-height: 1.55;">States the canon already distinguishes, drawn in the new language, plus the Prime tier prompt. Each is recognisable at a glance and says what to do next.</p></div>
    <div class="states-grid">${coldLoad}${failure}${offline}${empty}${prime}${closed}</div>
  </div>`;
}
