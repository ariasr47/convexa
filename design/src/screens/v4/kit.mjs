// v4 route kit: the states-board layout, the dialog / drawer / sheet frame, and small shared parts.
import { icon, v4Notice, v4Nav, wordmark } from '../../lib.mjs';
import { stateTag } from '../../components/data-states.mjs';

export const KIT_CSS = `
  .sb { padding: 48px 64px 64px; display: flex; flex-direction: column; gap: 28px; box-sizing: border-box; }
  .sb h1 { margin: 0; font-size: 36px; letter-spacing: -0.02em; }
  .sb .lead { margin: 6px 0 0; max-width: 96ch; font-size: 15px; color: var(--steel); line-height: 1.6; }
  .sb .trace { margin: 8px 0 0; font: 400 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .sb-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 24px; align-items: start; }
  .sb-item { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .sb-cap { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
  .sb-cap b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 17px; }
  .sb-when { font-size: 12.5px; color: var(--steel); line-height: 1.5; margin: 0; }
  .sb-frame { border: 1px solid var(--line); border-radius: 14px; background: var(--ink); padding: 16px; overflow: hidden; display: flex; flex-direction: column; gap: 12px; }
  .sb-frame.wide { grid-column: 1 / -1; }
  .v4dlg { width: min(560px, 100%); background: var(--panel); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--e4); display: flex; flex-direction: column; overflow: hidden; color: var(--phosphor); }
  .v4dlg.wide { width: min(760px, 100%); }
  .v4dlg .dh { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
  .v4dlg .dh h2 { margin: 0; font-size: 16px; font-weight: 700; flex: 1 1 auto; min-width: 0; }
  .v4dlg .db { padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
  .v4dlg .df { display: flex; align-items: center; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--line); flex-wrap: wrap; }
  .v4dlg.drawer { width: min(520px, 100%); border-radius: 16px 0 0 16px; align-self: stretch; }
  .v4-over { position: absolute; inset: 0; background: var(--scrim); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .v4-over.right { justify-content: flex-end; align-items: stretch; padding: 0; }
  .v4-behind { filter: blur(2px); opacity: 0.6; pointer-events: none; }
  .fld { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; }
  .fld .in { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--ink-2); font: 500 14px 'IBM Plex Sans', sans-serif; color: var(--phosphor); }
  .fld .in.mono { font-family: 'IBM Plex Mono', monospace; }
  .fld .in.focus { border-color: var(--amber-text); box-shadow: 0 0 0 3px var(--amber-tint); }
  .fld .in.dis { border-style: dashed; color: var(--steel); background: transparent; }
  .fld .help { font-size: 12px; font-weight: 400; color: var(--steel); line-height: 1.45; }
  .fld .err { font-size: 12px; font-weight: 400; display: flex; gap: 6px; align-items: flex-start; }
  .fld .err .ico { color: var(--warn); }
  .seg4 { display: inline-flex; padding: 3px; gap: 2px; border-radius: 8px; background: var(--raised); border: 1px solid var(--line); flex-wrap: wrap; }
  .seg4 button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--steel); font: 600 12.5px 'IBM Plex Sans', sans-serif; display: inline-flex; align-items: center; gap: 6px; }
  .seg4 button[aria-pressed="true"] { background: var(--panel); color: var(--phosphor); box-shadow: var(--e1); }
  .seg4 button:disabled { color: var(--steel); opacity: 1; text-decoration: line-through; text-decoration-color: var(--steel-2); }
  .sw { display: inline-flex; align-items: center; width: 40px; height: 24px; padding: 2px; border-radius: 999px; background: var(--raised-2); border: 1px solid var(--line-2); flex: 0 0 auto; }
  .sw.on { justify-content: flex-end; background: rgba(233,228,214,0.18); }
  .sw > span { width: 18px; height: 18px; border-radius: 50%; background: var(--steel); }
  .sw.on > span { background: var(--phosphor); }
  .pill-on { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--phosphor); background: var(--phosphor); color: var(--ink); font: 600 12.5px 'IBM Plex Sans', sans-serif; }
  .pill { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); color: var(--steel); font: 500 12.5px 'IBM Plex Sans', sans-serif; background: transparent; }
  @media (max-width: 899px) { .sb { padding: 24px 16px 40px; } .sb-grid { grid-template-columns: 1fr; } }
  @media (max-width: 599px) { .v4-over { align-items: flex-end; padding: 0; } .v4-over.right { align-items: flex-end; } .v4dlg, .v4dlg.wide, .v4dlg.drawer { width: 100%; border-radius: 16px 16px 0 0; max-height: 92%; overflow: auto; } .v4dlg .df .btn { flex: 1 1 100%; min-height: 44px; } .seg4 button, .pill, .pill-on { min-height: 44px; } }
`;

/** A states board: title, lead, trace, then a two-column grid of captioned state frames. */
export function statesBoard({ scheme = 'dark', minHeight = 2000, title, lead, trace = '', items = [] }) {
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="sb">
    <header><h1 class="display">${title}</h1><p class="lead">${lead}</p>${trace ? `<p class="trace">Resolves ${trace}</p>` : ''}</header>
    <div class="sb-grid">${items.map((it) => `<section class="sb-item${it.wide ? ' sb-frame-wide' : ''}"${it.wide ? ' style="grid-column: 1 / -1;"' : ''} aria-label="${it.name.replace(/<[^>]+>/g, '')}"><div class="sb-cap"><b>${it.name}</b>${it.tag ? stateTag(it.tag[0], it.tag[1] || '') : ''}${it.id ? `<span class="mono steel" style="font-size: 11px;">${it.id}</span>` : ''}</div>${it.when ? `<p class="sb-when">${it.when}</p>` : ''}<div class="sb-frame">${it.html}</div></section>`).join('')}</div>
    <p style="margin: 0; font-size: 12px; color: var(--steel);">Copy reuses shipped strings where they exist. Figures are illustrative design values. Research and tools, not investment advice.</p>
  </div></div>`;
}

/** Dialog frame (sheet under 600px). */
export function dlg({ title, chip = '', body, foot = '', wide = false, drawer = false, label = '' }) {
  return `<div class="v4dlg${wide ? ' wide' : ''}${drawer ? ' drawer' : ''}" role="dialog" aria-modal="true" aria-label="${label || title.replace(/<[^>]+>/g, '')}"><div class="dh"><h2>${title}</h2>${chip}<button class="btn ghost sm" type="button" aria-label="Close">${icon('close', 16)}</button></div><div class="db">${body}</div>${foot ? `<div class="df">${foot}</div>` : ''}</div>`;
}

/** A page with a dialog over it: the page behind is blurred and inert. */
export function overPage({ scheme = 'dark', minHeight = 900, active = '', dialog, right = false, notice = 'hybrid' }) {
  const behind = `<div class="v4-behind" aria-hidden="true">${v4Notice(notice)}${v4Nav({ active })}<div class="wrap" style="padding-top: 28px; display: flex; flex-direction: column; gap: 16px;"><span class="skel" style="height: 44px; width: 38%;"></span><span class="skel" style="height: 300px; width: 100%;"></span><span class="skel" style="height: 120px; width: 100%;"></span><span class="skel" style="height: 220px; width: 100%;"></span></div></div>`;
  return `<div class="v4" data-scheme="${scheme}" style="position: relative; width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); overflow: hidden;">${behind}<div class="v4-over${right ? ' right' : ''}">${dialog}</div></div>`;
}

export const fld = (label, value, { mono = false, focus = false, dis = false, help = '', err = '', type = '' } = {}) =>
  `<label class="fld">${label}<span class="in${mono ? ' mono' : ''}${focus ? ' focus' : ''}${dis ? ' dis' : ''}"${type ? ` data-type="${type}"` : ''}>${value}</span>${err ? `<span class="err">${icon('warn', 13)}${err}</span>` : ''}${help ? `<span class="help">${help}</span>` : ''}</label>`;
export const seg = (opts, on) => `<span class="seg4" role="group">${opts.map((o) => { const [label, dis] = Array.isArray(o) ? o : [o, false]; return `<button type="button" aria-pressed="${label === on}"${dis ? ' disabled' : ''}>${label}</button>`; }).join('')}</span>`;
export const sw = (on, label) => `<span style="display: inline-flex; align-items: center; gap: 10px;"><span class="sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-label="${label}"><span></span></span></span>`;
export { wordmark };
