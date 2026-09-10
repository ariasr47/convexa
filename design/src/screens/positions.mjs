// Positions — the simulated book: live P/L up top, honest marks, the track record below. Table → cards under 1000px.
import { footer, icon, nav, seq, sparkline } from '../lib.mjs';

export const POS_CSS = `
  .pos-head { display: flex; align-items: flex-end; gap: 16px 24px; flex-wrap: wrap; }
  .pos-stats { margin-left: auto; display: flex; gap: 28px; align-items: flex-end; flex-wrap: wrap; }
  .pos-tools { display: flex; align-items: center; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .pos-tools .fill { flex: 1; min-width: 20px; }
  .pos-row, .pos-headrow { display: grid; grid-template-columns: 1.6fr 110px 50px 80px 90px 90px 70px 80px 90px 90px 90px 96px; gap: 8px; align-items: center; padding: 0 16px; }
  .pos-headrow { padding-top: 10px; padding-bottom: 10px; }
  .pos-row { height: 52px; border-top: 1px solid var(--line); }
  .pos-cards { display: none; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .tr-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap: 14px; }
  @media (max-width: 1199px) { .pos-row, .pos-headrow { grid-template-columns: 1.6fr 110px 50px 80px 90px 90px 70px 80px 90px 90px 96px; } .pos-row > :nth-child(10), .pos-headrow > :nth-child(10) { display: none; } .tr-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 999px) { .pos-table { display: none; } .pos-cards { display: grid; } .pos-density { display: none; } }
  @media (max-width: 599px) { .pos-cards { grid-template-columns: 1fr; } .tr-grid { grid-template-columns: 1fr; } .pos-stats { margin-left: 0; width: 100%; justify-content: space-between; } }
`;

import { POSITIONS as ROWS } from '../data/index.mjs';

const basisChip = (b) => b === 'live' ? '<span class="chip live" style="height: 18px; font-size: 11px;"><span class="dot"></span>live mid</span>' : b === 'modeled' ? '<span class="chip outline" style="height: 18px; font-size: 11px;">≈ modeled</span>' : b === 'watching' ? '<span class="chip live" style="height: 18px; font-size: 11px;"><span class="dot"></span>watching</span>' : '<span class="chip outline" style="height: 18px; font-size: 11px;">closed</span>';
const action = (st) => st === 'open' ? '<button class="btn ghost sm">Close</button>' : st === 'pending' ? '<button class="btn ghost sm">Cancel</button>' : '<button class="btn ghost sm">Detail</button>';

function row(r) {
  const up = r.pl.startsWith('+');
  const plc = r.pl === '—' ? 'var(--steel)' : up ? 'var(--up)' : 'var(--down)';
  const dim = r.basis === 'modeled' ? 'opacity: 0.85;' : r.st === 'closed' ? 'opacity: 0.7;' : '';
  return `<div class="pos-row" style="${dim}">
    <span style="display: flex; flex-direction: column; min-width: 0;"><span class="mono" style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.c}</span><span style="font-size: 11px; color: var(--steel);">${r.s}</span></span>
    <span>${basisChip(r.basis)}</span>
    <span class="mono" style="font-size: 12.5px;">${r.q}</span>
    <span class="mono" style="font-size: 12.5px;">${r.e}</span>
    <span class="mono ${r.basis === 'live' ? 'flash-up' : ''}" style="font-size: 12.5px;">${r.m}</span>
    <span class="mono" style="font-size: 14px; font-weight: 600; color: ${plc};">${r.pl}</span>
    <span class="mono" style="font-size: 12px; color: ${plc};">${r.pct}</span>
    <span class="mono" style="font-size: 12px; color: var(--steel);">${r.d}</span>
    <span>${r.st === 'closed' ? '<span style="font-size: 11px; color: var(--steel);">—</span>' : sparkline(seq(18, r.seed, 0, 1), { width: 70, height: 20, color: up ? 'var(--up)' : 'var(--down)' })}</span>
    <span class="mono" style="font-size: 12px;">${r.ml}</span>
    <span class="mono" style="font-size: 12px; color: var(--steel);">${r.x}</span>
    <span style="display: flex; justify-content: flex-end; gap: 4px;">${action(r.st)}</span>
  </div>`;
}

function card(r) {
  const up = r.pl.startsWith('+');
  const plc = r.pl === '—' ? 'var(--steel)' : up ? 'var(--up)' : 'var(--down)';
  return `<div class="panel" style="padding: 14px; display: flex; flex-direction: column; gap: 10px; ${r.st === 'closed' ? 'opacity: 0.8;' : ''}">
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><span class="mono" style="font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 160px;">${r.c}</span><span class="chip outline" style="font-size: 11px;">${r.s}</span></div>
    <div style="display: flex; align-items: flex-end; gap: 12px;"><div><div class="mono" style="font-size: 24px; font-weight: 600; color: ${plc};">${r.pl}</div><div class="mono" style="font-size: 12px; color: ${plc};">${r.pct || '&nbsp;'}</div></div><span style="flex: 1;"></span>${r.st === 'closed' ? '' : sparkline(seq(18, r.seed, 0, 1), { width: 90, height: 28, color: up ? 'var(--up)' : 'var(--down)' })}</div>
    <div style="display: flex; align-items: center; gap: 8px;">${basisChip(r.basis)}<span style="font-size: 11px; color: var(--steel);">mark <span class="mono" style="color: var(--phosphor);">${r.m}</span></span></div>
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding-top: 8px; border-top: 1px solid var(--line);">${[['Qty', r.q], ['Entry', r.e], ['Max loss', r.ml], ['Expiry', r.x]].map(([l, v]) => `<div class="cell"><span class="caps" style="font-size: 11px;">${l}</span><span class="mono" style="font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${v}</span></div>`).join('')}</div>
    <div style="display: flex; justify-content: flex-end;">${action(r.st).replace('btn ghost sm', 'btn secondary sm')}</div>
  </div>`;
}

export function positionsBody({ minHeight = 1220 } = {}) {
  return `<div class="is-live" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${nav({ active: 'positions' })}
    <section class="wrap" style="padding-top: 26px;">
      <div class="pos-head">
        <div><h1 class="display" style="margin: 0; font-size: clamp(26px, 2.6vw, 34px); letter-spacing: -0.02em;">Positions</h1><p style="margin: 6px 0 0; font-size: 13.5px; color: var(--steel); max-width: 600px;">Your simulated book — paper only, saved to your account. Marks come from the live mid and degrade honestly; records never drop.</p></div>
        <div class="pos-stats">
          <div class="cell" style="text-align: right;"><span class="caps">Capital at risk</span><span class="v" style="font-size: 20px;">$1,060</span><span class="s">2 open · 4.2% of account</span></div>
          <div class="cell" style="text-align: right;"><span class="caps">Net P/L · open</span><span class="v up flash-up" style="font-size: 32px; font-weight: 600;">+$97</span><span class="s"><span class="chip live" style="height: 16px; font-size: 11px; padding: 0 6px;"><span class="dot"></span>live</span> marks from the tape</span></div>
          <button class="btn primary">${icon('plus', 15)} Open simulated trade</button>
        </div>
      </div>
      <div class="pos-tools">
        <span class="seg"><span class="on">Simulated</span><span style="display: inline-flex; align-items: center; gap: 6px;">${icon('lock', 12)} Live · read-only</span></span>
        <span style="width: 1px; height: 20px; background: var(--line-2); margin: 0 4px;"></span>
        <span class="seg"><span class="on">Open · 2</span><span>Pending · 1</span><span>History · 20</span></span>
        <span class="fill"></span>
        <span style="font-size: 12px; color: var(--steel);">Group by <a href="#">ticker</a> · <a href="#">structure</a></span>
        <span class="seg pos-density"><span class="on">Compact</span><span>Comfortable</span></span>
      </div>
    </section>
    <section class="wrap" style="padding-top: 14px;">
      <div class="panel pos-table" style="overflow: hidden;">
        <div class="caps pos-headrow">${['Contract', 'Mark basis', 'Qty', 'Entry', 'Mark', 'P/L', 'P/L %', 'Δ entry', 'Trend', 'Max loss', 'Expiry', ''].map((c) => `<span>${c}</span>`).join('')}</div>
        ${ROWS.map(row).join('')}
        <div style="display: flex; align-items: center; gap: 14px; padding: 10px 16px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--steel); flex-wrap: wrap;"><span>The sim has no slippage, no partial fills and no assignment — nothing here is sent to a broker.</span><span class="chip outline" style="height: 18px; font-size: 11px;">≈ modeled</span><span>= no fresh contract mark; modeled from the underlying and last IV.</span><span style="margin-left: auto;">Stream: <span class="signal">●</span> live · 10:42:07 ET</span></div>
      </div>
      <div class="pos-cards">${ROWS.map(card).join('')}<p style="grid-column: 1 / -1; margin: 0; font-size: 11.5px; color: var(--steel);">No slippage, no partial fills, no assignment — nothing here is sent to a broker. ≈ modeled = no fresh contract mark.</p></div>
    </section>
    <section class="wrap" style="padding-top: 22px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap;"><span class="caps" style="color: var(--phosphor);">Track record</span><span style="font-size: 12px; color: var(--steel);">Static historical read · closed sim trades · does not dim with the stream</span><span style="flex: 1; height: 1px; background: var(--line); min-width: 30px;"></span></div>
      <div class="tr-grid">
        <div class="panel quiet" style="padding: 14px 16px;"><span class="caps">By persona</span>${[['Balanced Swinger', '7 / 11', '64%', '+$612'], ['Premium Hunter', '3 / 6', '50%', '−$88'], ['Default', '2 / 3', '67%', '+$140']].map(([p, n, r, pl]) => `<div style="display: grid; grid-template-columns: 1fr 60px 50px 70px; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); font-size: 12.5px;"><span style="font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p}</span><span class="mono" style="color: var(--steel);">${n}</span><span class="mono">${r}</span><span class="mono" style="text-align: right; color: ${pl.startsWith('+') ? 'var(--up)' : 'var(--down)'};">${pl}</span></div>`).join('')}<p style="margin: 8px 0 0; font-size: 11px; color: var(--steel-2);">Hit rates stay phosphor — green/red is reserved for signed P/L only.</p></div>
        ${[['By tier at entry', [['Prime', '4 / 5', '80%'], ['Actionable', '6 / 10', '60%'], ['Watch', '2 / 5', '40%']]], ['By AI read', [['Accepted read', '8 / 12', '67%'], ['Own idea', '4 / 8', '50%']]], ['By IV-rank band', [['IV cheap', '7 / 10', '70%'], ['Neutral', '3 / 6', '50%'], ['IV rich', '2 / 4', '50%']]]].map(([t, rows]) => `<div class="panel quiet" style="padding: 14px 16px;"><span class="caps">${t}</span>${rows.map(([a, b, c]) => `<div style="display: grid; grid-template-columns: 1fr 60px 50px; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); font-size: 12.5px;"><span style="font-weight: 600;">${a}</span><span class="mono" style="color: var(--steel);">${b}</span><span class="mono">${c}</span></div>`).join('')}<p style="margin: 8px 0 0; font-size: 11px; color: var(--steel-2);">Sample counts shown · small samples are small.</p></div>`).join('')}
      </div>
    </section>
    ${footer()}
  </div>`;
}
