// Shared building blocks for every Convexa artboard: tokens, responsive chrome, icons, wordmark,
// nav/footer, and deterministic chart generators. Values come from shared/theme/tokens.ts.

export const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;family=IBM+Plex+Sans:wght@400;500;600;700&amp;display=swap">';

import tokens from '../tokens/tokens.json' with { type: 'json' };
import { SPY } from './data/index.mjs';
export { tokens, SPY };
const cssName = (k) => '--' + k.replace(/([A-Z])/g, '-$1').replace(/(\d)/g, '-$1').toLowerCase();
function schemeBlock(mode) {
  const c = tokens.color[mode], e = tokens.elevation[mode];
  return Object.entries(c).map(([k, v]) => `${cssName(k)}: ${v};`).join(' ') + ` --e1: ${e.e1}; --e2: ${e.e2}; --e4: ${e.e4}; --sheen: ${tokens.sheen[mode]};`;
}
export const TOKENS_CSS = `
  :root, [data-scheme="dark"] { ${schemeBlock('dark')} }
  [data-scheme="light"] { ${schemeBlock('light')} }
  * { box-sizing: border-box; }
  html, body { background: var(--ink); }
  body { margin: 0; color: var(--phosphor); font-family: 'IBM Plex Sans', system-ui, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.5; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; overflow-x: hidden; }
  a { color: var(--signal); text-decoration: none; } a:hover { color: var(--phosphor); text-decoration: underline; }
  h1, h2, h3 { text-wrap: balance; }
  .display { font-family: 'Archivo', 'IBM Plex Sans', system-ui, sans-serif; font-stretch: 112.5%; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
  .mono { font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }
  .sans { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
  .caps { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); line-height: 1.3; }
  .steel { color: var(--steel); } .dim { color: var(--steel-2); } .amber { color: var(--amber-text); } .signal { color: var(--signal); } .up { color: var(--up); } .down { color: var(--down); } .warn { color: var(--warn); }
  .panel { background: var(--panel); background-image: var(--sheen); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--e1); min-width: 0; container-type: inline-size; }
  @container (max-width: 360px) { .cell .v { font-size: 17px; } }
  @container (max-width: 280px) { .cell .v { font-size: 15px; } .cell .s { font-size: 11px; } }
  .panel.quiet { background-image: none; box-shadow: none; }
  .well { background: var(--ink-2); border-top: 1px solid var(--line); }
  .hair { border-top: 1px solid var(--line); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 8px; font: 600 13px/1 'IBM Plex Sans', system-ui, sans-serif; border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease, border-color 160ms ease; }
  .btn.sm { height: 30px; padding: 0 10px; font-size: 12px; } .btn.lg { height: 44px; padding: 0 20px; font-size: 14px; border-radius: 10px; }
  .btn.primary { background: var(--amber); color: var(--amber-ink); }
  .btn.primary:hover { transform: translateY(-1px); box-shadow: 0 8px 22px -8px rgba(242,169,59,0.6); filter: brightness(1.04); }
  .btn.secondary { background: transparent; color: var(--phosphor); border-color: var(--line-2); }
  .btn.secondary:hover { background: var(--raised); border-color: var(--steel); }
  .btn.ghost { background: transparent; color: var(--steel); }
  .btn.ghost:hover { color: var(--phosphor); background: var(--raised); }
  .btn.link { background: none; color: var(--signal); padding: 0; height: auto; border: 0; font-weight: 500; }
  .btn.link:hover { text-decoration: underline; }
  .btn.disabled, .btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; box-shadow: none !important; filter: none !important; }
  .btn.focus { outline: 2px solid var(--amber-text); outline-offset: 2px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap; color: var(--steel); background: rgba(138,155,180,0.14); }
  .chip.up { color: var(--up); background: var(--up-tint); } .chip.down { color: var(--down); background: var(--down-tint); }
  .chip.live { color: var(--signal); background: var(--signal-tint); } .chip.warn { color: var(--warn); background: var(--warn-tint); }
  .chip.emph { color: var(--amber-text); background: var(--amber-tint); } .chip.outline { background: transparent; border: 1px solid var(--line-2); }
  .chip .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .is-live .chip.live .dot { animation: livePulse 1.6s ease-in-out infinite; }
  .sym { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--line); font: 600 12px/1 'IBM Plex Mono', monospace; letter-spacing: 0.04em; color: var(--phosphor); cursor: pointer; flex-shrink: 0; }
  .sym:hover { border-color: var(--steel); background: var(--raised); } .sym.on { border-color: var(--amber); color: var(--amber-text); background: var(--amber-tint); }
  .seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 8px; background: var(--raised); border: 1px solid var(--line); }
  .seg > span { padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; color: var(--steel); cursor: pointer; line-height: 1.2; white-space: nowrap; }
  .seg > span.on { background: var(--panel); color: var(--phosphor); box-shadow: var(--e1); }
  .field { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--ink-2); color: var(--phosphor); font-size: 13px; min-width: 0; }
  .field.focus { border-color: var(--amber); box-shadow: 0 0 0 3px var(--amber-tint); }
  .field .ph { color: var(--steel-2); }
  .cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .cell .v { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 500; line-height: 1.15; color: var(--phosphor); letter-spacing: -0.01em; }
  .cell .s { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--steel); line-height: 1.3; }
  .cell.offline { opacity: 0.5; }
  .is-live .flash-up { animation: flashUp 700ms ease-out 1; } .is-live .flash-down { animation: flashDown 700ms ease-out 1; }
  .ring { outline: 2px solid var(--amber-text); outline-offset: 2px; border-radius: 8px; }
  .kbd { display: inline-flex; align-items: center; height: 18px; padding: 0 5px; border-radius: 4px; border: 1px solid var(--line-2); font: 500 11px/1 'IBM Plex Mono', monospace; color: var(--steel); background: var(--ink-2); }
  .ico { width: 16px; height: 16px; flex-shrink: 0; }
  .tt { position: absolute; background: var(--raised-2); color: var(--phosphor); border: 1px solid var(--line-2); border-radius: 8px; padding: 8px 10px; font-size: 12px; line-height: 1.45; box-shadow: var(--e4); max-width: 260px; }
  .skel { background: linear-gradient(90deg, var(--raised) 0%, var(--raised-2) 50%, var(--raised) 100%); background-size: 200% 100%; border-radius: 6px; animation: shimmer 1.4s linear infinite; }
  .livebar { position: absolute; left: 0; top: 0; width: 2px; height: 32%; border-top-left-radius: 12px; background: linear-gradient(180deg, var(--signal), transparent); opacity: 0.75; }
  .is-live .livebar { animation: widgetLivePulse 2.8s ease-in-out infinite; }
  .particle { animation: drift 6s linear infinite; opacity: 0; }
  .is-live .particle { opacity: 1; }
  .trail { stroke-dasharray: 4 3; }
  .is-live .trail { animation: trailMove 1.2s linear infinite; }
  .is-live .beam { animation: beam 2.4s ease-in-out infinite; }
  .is-live .tick { animation: tick 1s steps(1) infinite; }
  .scroll-x { display: flex; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .scroll-x::-webkit-scrollbar { display: none; }
  .wrap { width: 100%; max-width: 1360px; margin: 0 auto; padding-left: clamp(16px, 3vw, 40px); padding-right: clamp(16px, 3vw, 40px); }
  .nav-bar { position: sticky; top: 0; z-index: 20; height: calc(56px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); background: var(--glass); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
  .nav-in { height: 56px; display: flex; align-items: center; gap: 24px; }
  .nav-links { display: flex; gap: 22px; }
  .nav-links a { position: relative; display: inline-flex; align-items: center; height: 56px; padding: 0 2px; font-size: 13.5px; font-weight: 600; text-decoration: none; color: var(--steel); }
  .nav-links a.on { color: var(--phosphor); }
  .nav-links a.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--amber); border-radius: 2px 2px 0 0; }
  .nav-burger { display: none; color: var(--steel); align-items: center; }
  .nav-search { height: 32px; width: 280px; border-radius: 999px; background: var(--ink-2); border-color: var(--line); gap: 10px; }
  .nav-search-icon { display: none; color: var(--steel); align-items: center; }
  .nav-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
  .foot-grid { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start; padding-top: 24px; padding-bottom: 40px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  @media (min-width: 1600px) { .wrap { max-width: 1560px; } }
  @media (max-width: 1299px) { .nav-search { width: 200px; } .nav-in { gap: 18px; } .nav-links { gap: 16px; } }
  @media (max-width: 1099px) { .nav-search { display: none; } .nav-search-icon { display: inline-flex; } .nav-clock .tick { display: none; } }
  @media (max-width: 899px) { .nav-links { display: none; } .nav-burger { display: inline-flex; } .nav-in { gap: 14px; } .grid-3, .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 699px) { .foot-grid { grid-template-columns: 1fr; } .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } .nav-clock { display: none; } .nav-bell { display: none; } }
  @media (pointer: coarse) { .btn { min-height: 44px; } .btn.sm { min-height: 40px; } .sym { min-height: 40px; } .seg > span { min-height: 38px; display: inline-flex; align-items: center; } }
  @media (max-width: 599px) { [role="dialog"] { width: 100% !important; border-radius: 12px !important; } [role="dialog"] .btn { flex: 1 1 100%; } }
  @keyframes livePulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.45; transform: scale(1.35);} }
  @keyframes widgetLivePulse { 0%,100% { opacity: 0.55;} 50% { opacity: 0.95;} }
  @keyframes flashUp { 0% { color: var(--up); } 100% { color: var(--phosphor); } }
  @keyframes flashDown { 0% { color: var(--down); } 100% { color: var(--phosphor); } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @keyframes drift { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 0.9; } 85% { opacity: 0.9; } 100% { transform: translateY(-46px); opacity: 0; } }
  @keyframes trailMove { to { stroke-dashoffset: -14; } }
  @keyframes beam { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
  @keyframes tick { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
  @keyframes drawIn { from { stroke-dashoffset: 1600; } to { stroke-dashoffset: 0; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;

export function shell(inner, { script = '', extraCss = '' } = {}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONT_LINK}
  <style>${TOKENS_CSS}${extraCss}</style>
</helmet>
${inner}
</x-dc>
${script}
</body>
</html>`;
}

// ---- icons: stroke-based, 24-grid, currentColor ------------------------------------------------
const P = {
  search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"></path>',
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
  chevron: '<path d="M6 9l6 6 6-6"></path>',
  chevronR: '<path d="M9 6l6 6-6 6"></path>',
  chevronU: '<path d="M6 15l6-6 6 6"></path>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>',
  close: '<path d="M6 6l12 12M18 6L6 18"></path>',
  check: '<path d="M5 12l5 5L20 7"></path>',
  warn: '<path d="M12 3l10 18H2L12 3z"></path><path d="M12 10v4M12 17.5h.01"></path>',
  pause: '<path d="M8 5v14M16 5v14"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"></path>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  refresh: '<path d="M21 12a9 9 0 11-2.6-6.4"></path><path d="M21 4v5h-5"></path>',
  dots: '<circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"></path>',
  grip: '<circle cx="9" cy="6" r="1.4"></circle><circle cx="15" cy="6" r="1.4"></circle><circle cx="9" cy="12" r="1.4"></circle><circle cx="15" cy="12" r="1.4"></circle><circle cx="9" cy="18" r="1.4"></circle><circle cx="15" cy="18" r="1.4"></circle>',
  key: '<circle cx="8" cy="15" r="4"></circle><path d="M11 12l9-9M17 6l3 3M14 9l2 2"></path>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"></path>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"></path>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"></path><path d="M3 13l9 5 9-5"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>',
  moon: '<path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"></path>',
  external: '<path d="M14 4h6v6M20 4l-9 9"></path><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"></path>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a1 1 0 011-1h10"></path>',
  target: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4"></circle><path d="M12 3v3M12 18v3M3 12h3M18 12h3"></path>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"></path>',
  user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0116 0"></path>',
  bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2z"></path><path d="M10 20a2 2 0 004 0"></path>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M16 12h5M3 10h18"></path>',
  radar: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><path d="M12 12l6-6"></path>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 018 0v4"></path>',
  sort: '<path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3"></path>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"></path>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"></path>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"></path>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"></path><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"></path>',
  minus: '<path d="M5 12h14"></path>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z"></path><path d="M4 19a2 2 0 012-2h13"></path>',
  flask: '<path d="M9 3h6M10 3v6L4 20h16l-6-11V3"></path>',
  google: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v4h5"></path>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"></path>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"></path>',
};
export function icon(name, size = 16, extra = '') {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ''}</svg>`;
}

// ---- brand: CONVE[X]A lockup (arc-X geometry from shared/ui/arc.ts) ----------------------------
export function wordmark(size = 18) {
  const xw = (0.74 * size).toFixed(1);
  const xh = (0.72 * size).toFixed(1);
  return `<span role="img" aria-label="Convexa" style="display: inline-flex; align-items: baseline; font-family: 'Archivo', 'IBM Plex Sans', sans-serif; font-stretch: 125%; font-weight: 700; letter-spacing: 0.03em; line-height: 1; font-size: ${size}px; color: var(--phosphor); white-space: nowrap;"><span aria-hidden="true">CONVE</span><svg aria-hidden="true" viewBox="0 0 100 100" style="width: ${xw}px; height: ${xh}px; margin: 0 ${(0.045 * size).toFixed(1)}px; overflow: visible; color: var(--amber);" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round"><path d="M 12 91 Q 58 62 88 9"></path><path d="M 12 9 Q 42 62 88 91"></path></svg><span aria-hidden="true">A</span></span>`;
}

// ---- top nav (responsive: links → burger < 900, search → icon < 1100, clock hides < 700) --------
export function nav({ active = 'ticker', signedIn = true, live = true } = {}) {
  const items = [['scanner', 'Scanner'], ['ticker', 'Ticker'], ['positions', 'Positions'], ['alerts', 'Alerts']];
  const links = items.map(([k, l]) => `<a href="#" class="${k === active ? 'on' : ''}">${l}</a>`).join('');
  return `<header class="nav-bar">
    <div class="wrap nav-in">
      <a href="#" class="nav-burger" aria-label="Open navigation menu">${icon('menu', 20)}</a>
      <a href="#" style="display: inline-flex; text-decoration: none;">${wordmark(17)}</a>
      <nav aria-label="primary" class="nav-links">${links}</nav>
      <div class="nav-right">
        <div class="field nav-search">${icon('search', 15)}<span class="ph" style="flex: 1;">Jump to a ticker…</span><span class="kbd">⌘K</span></div>
        <a href="#" class="nav-search-icon" aria-label="Search tickers">${icon('search', 20)}</a>
        <div class="chip ${live ? 'live' : ''} nav-clock" style="height: 26px;"><span class="dot"></span>${live ? 'Open' : 'Closed'} <span class="mono tick" style="color: var(--steel);">10:42:07 ET</span></div>
        <a href="#" class="nav-bell" aria-label="Alerts" style="display: inline-flex; color: var(--steel);">${icon('bell', 18)}</a>
        ${signedIn
          ? '<a href="#" aria-label="Account settings" style="display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; background: var(--amber); color: var(--amber-ink); font: 700 12px/1 \'IBM Plex Sans\', sans-serif; text-decoration: none; flex-shrink: 0;">R</a>'
          : '<a href="#" class="btn ghost sm">Log in</a><a href="#" class="btn primary sm" style="border-radius: 999px;">Sign up</a>'}
      </div>
    </div>
  </header>`;
}

// ---- footer ----------------------------------------------------------------------------------
export function footer() {
  return `<footer style="margin-top: 48px;">
    <svg viewBox="0 0 1200 40" preserveAspectRatio="none" style="display: block; width: 100%; height: 40px;" aria-hidden="true"><path d="M 0 36 Q 600 -12 1200 36" fill="none" stroke="var(--steel)" stroke-opacity="0.35" stroke-width="1" vector-effect="non-scaling-stroke"></path></svg>
    <div class="wrap foot-grid">
      <div style="display: flex; flex-direction: column; gap: 10px; min-width: 0;">
        ${wordmark(15)}
        <div style="display: flex; gap: 18px; font-size: 12px; flex-wrap: wrap;"><a href="#" style="color: var(--steel);">How Convexa works</a><a href="#" style="color: var(--steel);">Blog — how we read structure</a><a href="#" style="color: var(--steel);">Lab</a></div>
        <p style="margin: 0; max-width: 720px; font-size: 12px; color: var(--steel);">Convexa is an analysis tool. Positions in the sim book are <strong>simulated</strong> (paper); a connected brokerage is read-only — Convexa never places, changes, or cancels an order. Not investment advice.</p>
        <p style="margin: 0; font-size: 12px; color: var(--steel-2);">© 2026 Convexa. All rights reserved.</p>
      </div>
      <div style="display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--steel);">${icon('moon', 14)}<span class="seg" style="padding: 2px;"><span class="on">Dark</span><span>Light</span><span>System</span></span></div>
    </div>
  </footer>`;
}

// ---- data: SPY sample structure lives in data/index.mjs (re-exported above) ----
export function gexProfile() {
  return SPY.strikes.map((k) => {
    const d = k - SPY.flip;
    const call = 420 * Math.exp(-((k - SPY.callWall) ** 2) / 32) + 140 * Math.exp(-((k - 575) ** 2) / 20);
    const put = -(380 * Math.exp(-((k - SPY.putWall) ** 2) / 40) + 120 * Math.exp(-((k - 565) ** 2) / 14));
    const base = d >= 0 ? call * (0.35 + 0.65 * Math.min(1, d / 8)) + 40 : put * (0.35 + 0.65 * Math.min(1, -d / 8)) - 30;
    return { k, v: Math.round(base) };
  });
}

// ---- structure field SVG (scales with its container; no distortion) --------------------------
export function structureField({ width = 1000, height = 300, live = true, showLabels = true, id = 'sf', fixedHeight = false } = {}) {
  const data = gexProfile();
  const pad = { l: showLabels ? 44 : 10, r: showLabels ? 20 : 10, t: 22, b: showLabels ? 30 : 12 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const minK = 549, maxK = 601;
  const xOf = (k) => pad.l + ((k - minK) / (maxK - minK)) * plotW;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.v)));
  const zeroY = pad.t + plotH * 0.5;
  const yOf = (v) => zeroY - (v / maxAbs) * (plotH * 0.46);
  const bw = (plotW / data.length) * 0.62;
  let bars = '';
  for (const d of data) {
    const x = xOf(d.k) - bw / 2;
    const y = d.v >= 0 ? yOf(d.v) : zeroY;
    const h = Math.max(2, Math.abs(yOf(d.v) - zeroY));
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${d.v >= 0 ? 'var(--up)' : 'var(--down)'}" fill-opacity="0.78"></rect>`;
  }
  const pts = data.map((d) => [xOf(d.k), yOf(d.v)]);
  let curve = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    curve += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  const area = `${curve} L ${pts[pts.length - 1][0].toFixed(1)} ${zeroY} L ${pts[0][0].toFixed(1)} ${zeroY} Z`;
  const fs = showLabels ? 10 : 9;
  const level = (k, color, label, weight = 1, dash = '', glow = false) => {
    const x = xOf(k).toFixed(1);
    return `${glow ? `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${pad.t + plotH}" stroke="${color}" stroke-width="6" stroke-opacity="0.18" class="beam"></line>` : ''}<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${pad.t + plotH}" stroke="${color}" stroke-width="${weight}" ${dash ? `stroke-dasharray="${dash}"` : ''}></line>${showLabels ? `<text x="${x}" y="${pad.t - 8}" text-anchor="middle" font-family="IBM Plex Mono" font-size="${fs}" font-weight="600" fill="${color}">${label}</text>` : ''}`;
  };
  const spotX = xOf(SPY.spot).toFixed(1);
  const ticks = showLabels
    ? [550, 560, 570, 580, 590, 600].map((k) => `<text x="${xOf(k).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="var(--steel)">${k}</text>`).join('')
    : '';
  const yTicks = showLabels
    ? [[maxAbs, `+$${maxAbs.toFixed(0)}M`], [0, '0'], [-maxAbs, `−$${maxAbs.toFixed(0)}M`]].map(([v, l]) => `<text x="${pad.l - 6}" y="${(yOf(v) + 3.5).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono" font-size="10" fill="var(--steel)">${l}</text>`).join('')
    : '';
  let particles = '';
  for (let i = 0; i < 14; i++) {
    const k = SPY.flip - 9 + (i * 18) / 13 + ((i * 7) % 5) * 0.4;
    particles += `<circle class="particle" cx="${xOf(k).toFixed(1)}" cy="${(zeroY + plotH * 0.14 + ((i * 13) % 30)).toFixed(1)}" r="${(1.2 + (i % 3) * 0.5).toFixed(1)}" fill="${k >= SPY.flip ? 'var(--up)' : 'var(--down)'}" style="animation-delay: ${(-((i * 0.43) % 6)).toFixed(2)}s; animation-duration: ${(4.5 + (i % 4) * 0.7).toFixed(1)}s;"></circle>`;
  }
  const sizing = fixedHeight
    ? `width="100%" height="${height}" preserveAspectRatio="none" style="display: block;"`
    : `preserveAspectRatio="xMidYMid meet" style="display: block; width: 100%; height: auto;"`;
  return `<svg viewBox="0 0 ${width} ${height}" ${sizing} role="img" aria-label="Net dealer gamma by strike">
    <defs>
      <linearGradient id="${id}-heat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--down)" stop-opacity="0.16"></stop><stop offset="${((xOf(SPY.flip) - pad.l) / plotW).toFixed(3)}" stop-color="var(--amber)" stop-opacity="0.05"></stop><stop offset="1" stop-color="var(--up)" stop-opacity="0.16"></stop></linearGradient>
      <linearGradient id="${id}-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--up)" stop-opacity="0.22"></stop><stop offset="0.5" stop-color="var(--phosphor)" stop-opacity="0.02"></stop><stop offset="1" stop-color="var(--down)" stop-opacity="0.22"></stop></linearGradient>
      <clipPath id="${id}-clip"><rect x="${pad.l}" y="${pad.t}" width="${plotW}" height="${plotH}"></rect></clipPath>
    </defs>
    <rect x="${pad.l}" y="${pad.t}" width="${plotW}" height="${plotH}" fill="url(#${id}-heat)"></rect>
    <line x1="${pad.l}" y1="${zeroY}" x2="${pad.l + plotW}" y2="${zeroY}" stroke="var(--steel)" stroke-opacity="0.35"></line>
    <g clip-path="url(#${id}-clip)"><path d="${area}" fill="url(#${id}-area)"></path>${bars}<path d="${curve}" fill="none" stroke="var(--phosphor)" stroke-opacity="0.55" stroke-width="1.25"></path>${particles}</g>
    ${yTicks}${ticks}
    ${level(SPY.putWall, 'var(--down)', 'put wall 560', 1.25)}
    ${level(SPY.callWall, 'var(--up)', 'call wall 580', 1.25)}
    ${level(SPY.flip, 'var(--amber)', 'flip 568.50', 1.75, '', true)}
    ${level(SPY.maxPain, 'var(--steel)', 'max pain 570', 1, '3 3')}
    <g>
      <line x1="${spotX}" y1="${pad.t}" x2="${spotX}" y2="${pad.t + plotH}" stroke="var(--signal)" stroke-width="1.5" stroke-dasharray="2 3"></line>
      <circle cx="${spotX}" cy="${zeroY}" r="9" fill="var(--signal)" fill-opacity="0.18" class="beam"></circle>
      <circle cx="${spotX}" cy="${zeroY}" r="4" fill="var(--signal)"></circle>
      ${showLabels ? `<rect x="${(+spotX + 8).toFixed(1)}" y="${zeroY - 21}" width="86" height="18" rx="4" fill="var(--panel)" stroke="var(--signal)" stroke-opacity="0.6"></rect><text x="${(+spotX + 14).toFixed(1)}" y="${zeroY - 8}" font-family="IBM Plex Mono" font-size="10.5" font-weight="600" fill="var(--signal)">${live ? '● mid' : '○ spot'} 573.12</text>` : ''}
    </g>
  </svg>`;
}

// ---- magnet view -----------------------------------------------------------------------------
export function magnetView({ width = 1000, height = 300, compact = false } = {}) {
  const pad = { l: compact ? 24 : 60, r: compact ? 24 : 40 };
  const minK = 552, maxK = 588;
  const xOf = (k) => pad.l + ((k - minK) / (maxK - minK)) * (width - pad.l - pad.r);
  const midY = height / 2;
  const lvl = (k, color, label, glow = false) =>
    `${glow ? `<line x1="${xOf(k)}" y1="40" x2="${xOf(k)}" y2="${height - 40}" stroke="${color}" stroke-width="8" stroke-opacity="0.16" class="beam"></line>` : ''}<line x1="${xOf(k)}" y1="40" x2="${xOf(k)}" y2="${height - 40}" stroke="${color}" stroke-width="${glow ? 2 : 1.5}"></line><text x="${xOf(k)}" y="28" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="${color}">${label}</text>`;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="display: block; width: 100%; height: auto;" role="img" aria-label="Magnet view: spot between the put wall, flip and call wall">
    <defs><linearGradient id="mg-${width}" x1="0" x2="1"><stop offset="0" stop-color="var(--down)" stop-opacity="0.22"></stop><stop offset="0.5" stop-color="var(--amber)" stop-opacity="0.08"></stop><stop offset="1" stop-color="var(--up)" stop-opacity="0.22"></stop></linearGradient></defs>
    <rect x="${xOf(SPY.putWall)}" y="${midY - 34}" width="${xOf(SPY.callWall) - xOf(SPY.putWall)}" height="68" rx="8" fill="url(#mg-${width})"></rect>
    <rect x="${xOf(SPY.putWall)}" y="${midY - 34}" width="${xOf(SPY.callWall) - xOf(SPY.putWall)}" height="68" rx="8" fill="none" stroke="var(--line-2)"></rect>
    ${lvl(SPY.putWall, 'var(--down)', compact ? 'put 560' : 'put wall 560')}
    ${lvl(SPY.callWall, 'var(--up)', compact ? 'call 580' : 'call wall 580')}
    ${lvl(SPY.flip, 'var(--amber)', 'flip 568.50', true)}
    <line x1="${xOf(SPY.flip)}" y1="${midY}" x2="${xOf(SPY.spot)}" y2="${midY}" stroke="var(--signal)" stroke-width="1.5" stroke-dasharray="3 4" class="trail"></line>
    <circle cx="${xOf(SPY.spot)}" cy="${midY}" r="16" fill="var(--signal)" fill-opacity="0.16" class="beam"></circle>
    <circle cx="${xOf(SPY.spot)}" cy="${midY}" r="7" fill="var(--signal)"></circle>
    <text x="${xOf(SPY.spot) + 14}" y="${midY - 14}" font-family="IBM Plex Mono" font-size="12" font-weight="600" fill="var(--phosphor)">mid 573.12</text>
    ${compact ? '' : `<text x="${xOf(SPY.spot) + 14}" y="${midY + 24}" font-family="IBM Plex Sans" font-size="11" fill="var(--steel)">+0.81% above the flip · dealers dampen moves here</text><text x="${pad.l}" y="${height - 14}" font-family="IBM Plex Sans" font-size="11" fill="var(--steel-2)">Magnet view · structure levels · a display metaphor, not a forecast</text>`}
  </svg>`;
}

// ---- sparkline / trail ----------------------------------------------------------------------
export function sparkline(values, { width = 120, height = 28, color = 'var(--steel)', fill = null, dot = false, cls = '', fluid = false } = {}) {
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / (max - min || 1)) * (height - 4)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const sizing = fluid ? `width="100%" height="${height}" preserveAspectRatio="none" style="display: block; overflow: visible;"` : `width="${width}" height="${height}" style="display: block; overflow: visible; max-width: 100%;"`;
  return `<svg viewBox="0 0 ${width} ${height}" ${sizing} aria-hidden="true">${fill ? `<path d="${d} L ${width} ${height} L 0 ${height} Z" fill="${fill}"></path>` : ''}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" class="${cls}"></path>${dot ? `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${color}"></circle><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="7" fill="${color}" fill-opacity="0.2" class="beam"></circle>` : ''}</svg>`;
}
export function seq(n, seed = 1, base = 0, amp = 1) {
  const out = [];
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280 - 0.5;
    out.push(base + amp * (Math.sin(i / 3 + seed) * 0.6 + r * 0.8) + (i / n) * amp * 0.5);
  }
  return out;
}

// ---- term-structure heat ribbon ------------------------------------------------------------
export function termRibbon({ width = 360, height = 54 } = {}) {
  const tenors = [['7d', 14.2], ['14d', 15.1], ['30d', 16.4], ['60d', 17.3], ['90d', 18.0]];
  const cellW = width / tenors.length;
  const min = 14, max = 18.2;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" aria-label="ATM IV by tenor" style="display: block;">${tenors
    .map(([t, iv], i) => {
      const a = 0.18 + ((iv - min) / (max - min)) * 0.62;
      return `<rect x="${(i * cellW + 2).toFixed(1)}" y="4" width="${(cellW - 4).toFixed(1)}" height="28" rx="5" fill="var(--amber)" fill-opacity="${a.toFixed(2)}"></rect><text x="${(i * cellW + cellW / 2).toFixed(1)}" y="23" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="var(--phosphor)">${iv.toFixed(1)}</text><text x="${(i * cellW + cellW / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="var(--steel)">${t}</text>`;
    })
    .join('')}</svg>`;
}

// ---- opportunity ring gauge ----------------------------------------------------------------
export function ring(score, { size = 44, stroke = 4, color = 'var(--amber)' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="flex-shrink: 0;"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="${stroke}"></circle><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - score / 100)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"></circle><text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="IBM Plex Mono" font-size="${Math.round(size * 0.32)}" font-weight="600" fill="var(--phosphor)">${score}</text></svg>`;
}

// ---- 3D gamma surface (isometric wireframe: strike × tenor × net GEX) -----------------------
export function gammaSurface({ width = 720, height = 440 } = {}) {
  const rows = 9, cols = 21;
  const ox = width * 0.5, oy = height * 0.6;
  const sx = width / 34, sy = width / 62, sz = 78;
  const z = (i, j) => {
    const k = 550 + (j * 50) / (cols - 1);
    const tenor = i / (rows - 1);
    const d = k - SPY.flip - tenor * 4;
    const call = Math.exp(-((k - SPY.callWall - tenor * 3) ** 2) / 34);
    const put = -Math.exp(-((k - SPY.putWall + tenor * 2) ** 2) / 44);
    return (d >= 0 ? call : put) * (1 - tenor * 0.55) + Math.sign(d) * 0.08;
  };
  const proj = (i, j) => {
    const u = j - (cols - 1) / 2;
    const v = i - (rows - 1) / 2;
    return [ox + (u - v) * sx * 0.72, oy + (u + v) * sy * 0.5 - z(i, j) * sz];
  };
  let lines = '';
  for (let i = 0; i < rows; i++) {
    let d = '';
    for (let j = 0; j < cols; j++) { const [x, y] = proj(i, j); d += `${j ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `; }
    lines += `<path d="${d}" fill="none" stroke="var(--steel)" stroke-opacity="${(0.25 + (1 - i / rows) * 0.55).toFixed(2)}" stroke-width="1"></path>`;
  }
  for (let j = 0; j < cols; j += 1) {
    let d = '';
    for (let i = 0; i < rows; i++) { const [x, y] = proj(i, j); d += `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `; }
    lines += `<path d="${d}" fill="none" stroke="var(--steel)" stroke-opacity="0.22" stroke-width="1"></path>`;
  }
  const ridge = (kTarget, color, w) => {
    let d = '';
    for (let i = 0; i < rows; i++) {
      const j = ((kTarget - 550) / 50) * (cols - 1);
      const j0 = Math.floor(j), t = j - j0;
      const [x0, y0] = proj(i, j0);
      const [x1, y1] = proj(i, Math.min(cols - 1, j0 + 1));
      d += `${i ? 'L' : 'M'} ${(x0 + (x1 - x0) * t).toFixed(1)} ${(y0 + (y1 - y0) * t).toFixed(1)} `;
    }
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" style="filter: drop-shadow(0 0 6px ${color});"></path>`;
  };
  const [fx, fy] = proj(0, ((SPY.flip - 550) / 50) * (cols - 1));
  const [spx, spy] = proj(0, ((SPY.spot - 550) / 50) * (cols - 1));
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="display: block; width: 100%; height: auto; overflow: visible;" role="img" aria-label="Dealer gamma surface across strike and tenor">
    <defs><radialGradient id="gs-glow" cx="50%" cy="60%" r="55%"><stop offset="0" stop-color="var(--amber)" stop-opacity="0.10"></stop><stop offset="1" stop-color="var(--amber)" stop-opacity="0"></stop></radialGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#gs-glow)"></rect>
    ${lines}${ridge(SPY.putWall, 'var(--down)', 1.5)}${ridge(SPY.callWall, 'var(--up)', 1.5)}${ridge(SPY.flip, 'var(--amber)', 2.25)}
    <circle cx="${spx.toFixed(1)}" cy="${spy.toFixed(1)}" r="5" fill="var(--signal)"></circle>
    <circle cx="${spx.toFixed(1)}" cy="${spy.toFixed(1)}" r="12" fill="var(--signal)" fill-opacity="0.18" class="beam"></circle>
    <text x="${(spx + 12).toFixed(1)}" y="${(spy - 8).toFixed(1)}" font-family="IBM Plex Mono" font-size="12" font-weight="600" fill="var(--signal)">mid 573.12</text>
    <text x="${(fx + 10).toFixed(1)}" y="${(fy + 22).toFixed(1)}" font-family="IBM Plex Mono" font-size="12" font-weight="600" fill="var(--amber)">gamma flip 568.50</text>
  </svg>`;
}

// ---- layout helpers ------------------------------------------------------------------------
export function labelInfo(label, extra = '') {
  return `<div style="display: flex; align-items: center; gap: 5px;"><span class="caps">${label}</span><span style="color: var(--steel-2); display: inline-flex;">${icon('info', 12)}</span>${extra}</div>`;
}
export function widgetHead(title, { subtitle = '', actions = '', live = false, quiet = false } = {}) {
  return `<div style="display: flex; align-items: flex-start; gap: 12px; padding: ${quiet ? '12px 16px 8px' : '14px 18px 10px'}; flex-wrap: wrap;">
    <div style="min-width: 0; flex: 1 1 200px;">
      <div style="display: flex; align-items: center; gap: 8px;"><h2 style="margin: 0; font-size: ${quiet ? '13px' : '14px'}; font-weight: 600; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</h2>${live ? `<span class="chip live" style="height: 18px; padding: 0 7px; font-size: 11px;"><span class="dot"></span>${typeof live === 'string' ? live : 'live'}</span>` : ''}</div>
      ${subtitle ? `<p style="margin: 2px 0 0; font-size: 12px; color: var(--steel);">${subtitle}</p>` : ''}
    </div>
    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap;">${actions}<span style="display: inline-flex; color: var(--steel-2);">${icon('expand', 14)}</span></div>
  </div>`;
}
export function dialogFrame(title, body, { width = 560, chip = '', footer = '' } = {}) {
  return `<div class="panel" role="dialog" aria-label="${title}" style="width: min(${width}px, 100%); box-shadow: var(--e4); overflow: hidden; border-radius: 16px;">
    <div style="display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--line);"><h2 style="margin: 0; font-size: 15px; font-weight: 700;">${title}</h2>${chip}<span style="flex: 1;"></span><span style="display: inline-flex; color: var(--steel);">${icon('close', 16)}</span></div>
    <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;">${body}</div>
    ${footer ? `<div style="display: flex; align-items: center; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--line); flex-wrap: wrap;">${footer}</div>` : ''}
  </div>`;
}
export function backdrop(inner, { align = 'center', minHeight = 900, scheme = 'dark' } = {}) {
  return `<div data-scheme="${scheme}" style="position: relative; width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); overflow: hidden;">
    <div aria-hidden="true" style="position: absolute; inset: 0; opacity: 0.55; filter: blur(2px);">
      <div class="nav-bar" style="position: static;"><div class="wrap nav-in">${wordmark(17)}<span style="flex: 1;"></span><span class="skel" style="width: 120px; height: 20px;"></span></div></div>
      <div class="wrap" style="padding-top: 22px; display: flex; flex-direction: column; gap: 14px;"><div class="skel" style="height: 44px; width: 40%;"></div><div class="skel" style="height: 340px; width: 100%;"></div><div class="skel" style="height: 90px; width: 100%;"></div><div class="skel" style="height: 260px; width: 100%;"></div></div>
    </div>
    <div style="position: absolute; inset: 0; background: var(--scrim);"></div>
    <div style="position: relative; min-height: ${minHeight}px; display: flex; align-items: ${align === 'right' ? 'stretch' : 'center'}; justify-content: ${align === 'right' ? 'flex-end' : 'center'}; padding: ${align === 'right' ? '0' : '24px'};">${inner}</div>
  </div>`;
}
