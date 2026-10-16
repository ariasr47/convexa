// Final · Convexa v1 — shell-site group: the shared parts its rows compose (2026-10-14).
// One page wrapper per environment (production: the "Options data isn't live" bar and a signed-out nav
// with "Log in"; staging: the demo bar and the "Demo account" control), the Not live card with its
// "See it on the demo →" link, the ⌘K palette and mobile drawer per environment, the landing hero's
// static projection of the F1 dealer-gamma surface (P-15), and the landing's three illustrations.
import { STAGING_DEMO_URL, icon, finalPage, wordmark } from '../../lib.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { fmt, plot } from '../../chart-kit.mjs';
import { GEX_STRIKES, GEX_TENORS, gexAt } from '../../data/charts.mjs';

export { STAGING_DEMO_URL };

export const SS_CSS = `
  .ss-nl { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .ss-nl .w { font-size: 13px; line-height: 1.5; color: var(--phosphor); margin: 0; text-wrap: pretty; }
  .ss-nl .w b, .ss-nl .o b { font-weight: 600; color: var(--steel); }
  .ss-nl .o { font-size: 12.5px; line-height: 1.5; color: var(--steel); margin: 0; text-wrap: pretty; }
  .ss-nl .dash { font: 500 22px/1 'IBM Plex Mono', monospace; color: var(--steel); }
  .ss-demo { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; font-size: 13px; font-weight: 600; text-decoration: none; }
  .ss-hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 48px; align-items: center; padding: 72px 0 56px; }
  .ss-hero h1 { margin: 0; font-size: clamp(38px, 4.2vw, 58px); line-height: 1.06; letter-spacing: -0.02em; text-wrap: balance; }
  .ss-hero .sub { margin: 0; font-size: 16.5px; line-height: 1.6; color: var(--steel); max-width: 56ch; text-wrap: pretty; }
  .ss-chip { display: inline-flex; align-items: center; min-height: 26px; padding: 0 12px; border-radius: 999px; background: var(--amber-tint); color: var(--amber-text); font-size: 12.5px; font-weight: 600; align-self: flex-start; }
  .ss-spine { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--steel); }
  .ss-ctas { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .ss-eyebrow { font: 600 11.5px/1.4 'IBM Plex Sans', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--amber-text); }
  .ss-feat { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 56px; align-items: center; padding: 64px 0; border-top: 1px solid var(--line); }
  .ss-feat.flip > .vis { order: -1; }
  .ss-feat h2 { margin: 8px 0 0; font-size: clamp(26px, 2.6vw, 34px); line-height: 1.12; text-wrap: balance; }
  .ss-feat p { margin: 14px 0 0; font-size: 15.5px; line-height: 1.6; color: var(--steel); max-width: 52ch; text-wrap: pretty; }
  .ss-feat ul { margin: 16px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.5; }
  .ss-feat li { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; }
  .ss-feat li .ico { color: var(--steel); margin-top: 3px; }
  .ss-ill { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .ss-ill .cap { font-size: 12px; color: var(--steel); line-height: 1.45; margin: 0; }
  .ss-score { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--ink-2); }
  .ss-score > div { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; min-width: 0; border-left: 1px solid var(--line); }
  .ss-score > div:first-child { border-left: 0; }
  .ss-score .v { font: 500 26px/1.1 'IBM Plex Mono', monospace; }
  .ss-tiers { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; font-size: 12.5px; color: var(--steel); }
  .ss-tier { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--steel); font-weight: 500; }
  .ss-tier.on { border-color: var(--phosphor); box-shadow: inset 0 0 0 1px var(--phosphor); color: var(--phosphor); font-weight: 700; }
  .ss-read { display: flex; flex-direction: column; gap: 12px; }
  .ss-read .verdict { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 12px; }
  .ss-read .verdict b { font: 700 26px/1.1 'Archivo', sans-serif; font-stretch: 112.5%; }
  .ss-cells { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--line); border-radius: 10px; overflow: hidden; }
  .ss-cells > div { background: var(--ink-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ss-cells .v { font: 500 17px/1.25 'IBM Plex Mono', monospace; }
  .ss-cells .v.body { font: 500 16px/1.25 'IBM Plex Sans', sans-serif; }
  .ss-trust { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 48px; padding: 64px 0; border-top: 1px solid var(--line); align-items: start; }
  .ss-trust .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .ss-trust .card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
  .ss-trust .card h3 { margin: 0; font-size: 15px; }
  .ss-trust .card p { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--steel); }
  .ss-cta { margin: 24px 0 8px; display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 40px; align-items: center; padding: 40px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line); }
  .ss-cta h2 { margin: 0; font-size: clamp(24px, 2.4vw, 32px); line-height: 1.15; }
  .ss-cta p { margin: 12px 0 0; font-size: 15px; line-height: 1.6; color: var(--steel); max-width: 56ch; }
  .ss-cta .acts { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
  .ss-cta .acts .note { font-size: 12.5px; color: var(--steel); text-align: center; line-height: 1.45; }
  .ss-hp { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .ss-hp .f1-stage { aspect-ratio: 1000 / 560; }
  .ss-hp .lab { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
  .ss-drawer { position: absolute; z-index: 31; top: 0; right: 0; bottom: 0; width: min(320px, 84%); background: var(--panel); border-left: 1px solid var(--line); box-shadow: var(--e4); padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; }
  .ss-drawer a { display: flex; align-items: center; min-height: 48px; padding: 0 10px; border-radius: 8px; color: var(--phosphor) !important; text-decoration: none; font-size: 16px; font-weight: 600; }
  .ss-drawer a[aria-current="page"] { background: var(--raised); box-shadow: inset 3px 0 0 var(--amber); }
  .ss-drawer a.q { font-size: 14px; font-weight: 500; color: var(--steel) !important; }
  .ss-drawer .acct { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 10px; font-size: 14px; color: var(--steel); }
  .ss-av { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: var(--raised-2); color: var(--phosphor); font: 600 12px/1 'IBM Plex Sans', sans-serif; flex: 0 0 auto; }
  .ss-pal .opt .sc { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; color: var(--steel); }
  .ss-pal .opt .sc b { font: 600 13px 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .ss-anat { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .ss-anat > div { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: var(--panel); display: flex; flex-direction: column; gap: 6px; }
  .ss-anat h3 { margin: 0; font-size: 14px; }
  .ss-anat p { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--steel); }
  .ss-live { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .ss-live > div { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .ss-live h3 { margin: 0; font-size: 15px; display: flex; align-items: center; gap: 8px; }
  .ss-live table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ss-live th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 6px 8px 6px 0; border-bottom: 1px solid var(--line-2); }
  .ss-live td { padding: 8px 8px 8px 0; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--steel); line-height: 1.45; }
  .ss-live td:first-child { color: var(--phosphor); font-weight: 600; }
  .ss-tagrow { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 12px; align-items: start; padding: 10px 0; border-top: 1px solid var(--line); }
  .ss-tagrow > .stag { justify-self: start; }
  .ss-tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .ss-tbl th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 8px 10px 8px 0; border-bottom: 1px solid var(--line-2); }
  .ss-tbl td { padding: 9px 10px 9px 0; border-bottom: 1px solid var(--line); color: var(--steel); vertical-align: top; line-height: 1.5; }
  .ss-tbl td:first-child { color: var(--phosphor); }
  .ss-tbl td.m { font-family: 'IBM Plex Mono', monospace; }
  .ss-ops { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 52px; padding: 8px 24px; border-bottom: 1px solid var(--line); background: var(--panel); }
  .ss-stages { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ss-stages th { text-align: right; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 8px 10px; border-bottom: 1px solid var(--line-2); }
  .ss-stages th:first-child, .ss-stages td:first-child { text-align: left; }
  .ss-stages td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: right; font-family: 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .ss-stages td:first-child { font-family: 'IBM Plex Sans', sans-serif; }
  .ss-stages td.na { color: var(--steel); }
  .ss-post { max-width: 72ch; display: flex; flex-direction: column; gap: 18px; padding: 40px 0 24px; }
  .ss-post h1 { margin: 0; font-size: clamp(32px, 3.6vw, 46px); line-height: 1.08; letter-spacing: -0.02em; }
  .ss-post h2 { margin: 18px 0 0; font-size: 24px; line-height: 1.2; }
  .ss-post p, .ss-post li { margin: 0; font-size: 16px; line-height: 1.7; color: var(--steel); text-wrap: pretty; }
  .ss-post p strong, .ss-post li strong { color: var(--phosphor); }
  .ss-post ol { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; }
  .ss-post blockquote { margin: 0; padding: 12px 16px; border-left: 2px solid var(--line-2); background: var(--panel); border-radius: 0 8px 8px 0; font-size: 14.5px; color: var(--phosphor); line-height: 1.6; }
  .ss-post .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 13px; color: var(--steel); }
  .ss-schem { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); padding: 16px 18px 12px; display: flex; flex-direction: column; gap: 10px; margin: 0; }
  .ss-schem figcaption { font-size: 12.5px; color: var(--steel); line-height: 1.5; }
  .ss-ph { display: flex; flex-direction: column; gap: 16px; }
  @media (max-width: 1099px) { .ss-hero, .ss-feat, .ss-trust { grid-template-columns: minmax(0, 1fr); gap: 32px; } .ss-feat.flip > .vis { order: 0; } .ss-anat { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 899px) { .ss-cta { grid-template-columns: minmax(0, 1fr); padding: 24px; gap: 20px; } .ss-tagrow { grid-template-columns: minmax(0, 1fr); gap: 6px; } }
  @media (max-width: 699px) { .ss-trust .cards { grid-template-columns: minmax(0, 1fr); } .ss-ctas { flex-direction: column; align-items: stretch; } .ss-ctas .btn { width: 100%; } .ss-score, .ss-cells { grid-template-columns: repeat(2, minmax(0, 1fr)); } .ss-score > div:nth-child(3) { border-left: 0; } .ss-score > div:nth-child(n+3) { border-top: 1px solid var(--line); } .ss-hero { padding: 40px 0 32px; } .ss-feat, .ss-trust { padding: 44px 0; } }
  @media (max-width: 599px) { .ss-ops { padding: 8px 16px; } .ss-stages th:nth-child(4), .ss-stages td:nth-child(4), .ss-stages th:nth-child(5), .ss-stages td:nth-child(5) { display: none; } }
`;

// ---- page wrapper per environment --------------------------------------------------------------
const COPYRIGHT = '<p style="margin: 0; flex: 1 1 100%; font-size: 12px; color: var(--steel);">© 2026 Convexa. All rights reserved.</p>';
/** A page in one environment. production: the not-live bar, signed out ("Log in", sign-ups closed so no
 *  "Sign up"). staging: the demo bar and the demo account. The footer gains the shipped copyright line. */
export function sitePage({ env = 'production', scheme = 'dark', minHeight = 0, active = '', label = '', main = '', tabs = '', footer = true }) {
  let html = finalPage({ scheme, minHeight, demo: env === 'staging', notice: 'hybrid', active, label, main, tabs, footer });
  if (env !== 'staging') html = html.replace('class="v4n-signin">Sign in</a>', 'class="v4n-signin">Log in</a>');
  return html.replace('Not investment advice.</p></div></footer>', `Not investment advice.</p>${COPYRIGHT}</div></footer>`);
}
export const demoUrl = (path = '') => `${STAGING_DEMO_URL}${path}`;
export const demoLink = (path = '', text = 'See it on the demo') => `<a class="ss-demo t-info" href="${demoUrl(path)}">${text} ${icon('arrow', 14)}</a>`;

/** The Not live card body (P-1): what it would show, why it is off, the link to the same screen on the demo. */
export function notLiveBody({ would, why = 'it needs the paid options feed, which this site doesn’t run.', path = '', dash = false, link = 'See it on the demo' }) {
  return `<div class="ss-nl">${dash ? '<span class="dash" aria-label="No value">—</span>' : ''}<p class="w"><b>Would show:</b> ${would}</p><p class="o"><b>Why it’s off:</b> ${why}</p>${demoLink(path, link)}</div>`;
}

// ---- ⌘K palette ----------------------------------------------------------------------------------
const opt = (glyph, main, right, sel = false) => `<div class="opt" role="option" aria-selected="${sel}"><span style="display: inline-flex; color: var(--steel);">${icon(glyph, 16)}</span><span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${main}</span><span class="steel" style="font-size: 12px;">${right}</span></div>`;
const sym = (s, n) => `<span class="mono" style="font-weight: 600;">${s}</span> · ${n}`;
/** env: production lists tickers by name (no scan call: scores need the options feed); staging ranks
 *  them by the sample scan. state: results | empty | loading | nomatch | failed. */
export function paletteF({ env = 'production', state = 'results' } = {}) {
  const stg = env === 'staging';
  const score = (n, t) => `<span class="sc"><b>${n}</b>${t}</span>`;
  let body = '';
  if (state === 'results') body = stg
    ? `<div class="grp" role="group" aria-label="Tickers"><span class="caps">Tickers · ranked by the sample scan</span>${opt('activity', sym('NVDA', 'NVIDIA'), score(88, 'Prime'), true)}${opt('activity', sym('NVO', 'Novo Nordisk'), score(41, 'Dormant'))}</div><div class="grp" role="group" aria-label="Research notes"><span class="caps">Research notes</span>${opt('book', 'NVDA · Sample note: the networking half of the year', 'Oct 6')}</div>`
    : `<div class="grp" role="group" aria-label="Tickers"><span class="caps">Tickers</span>${opt('activity', sym('NVDA', 'NVIDIA'), 'note · review due', true)}${opt('activity', sym('NVO', 'Novo Nordisk'), 'no note')}</div><div class="grp" role="group" aria-label="Research notes"><span class="caps">Research notes</span>${opt('book', 'NVDA · A 70% growth guide on a $412B year…', 'Oct 13')}${opt('book', 'NVDA · Initiation: the networking half nobody prices', 'Jun 4 · superseded')}</div>`;
  if (state === 'empty') body = `<div class="grp" role="group" aria-label="Go to"><span class="caps">Go to</span>${opt('radar', 'Scanner', '<span class="kbd">g</span> <span class="kbd">s</span>')}${opt('activity', 'Ticker', '<span class="kbd">g</span> <span class="kbd">t</span>', true)}${opt('book', 'Research', '<span class="kbd">g</span> <span class="kbd">r</span>')}${opt('wallet', 'Positions', '<span class="kbd">g</span> <span class="kbd">p</span>')}${opt('bell', 'Alerts', '<span class="kbd">g</span> <span class="kbd">a</span>')}</div><div class="grp" role="group" aria-label="Recent"><span class="caps">Recent</span>${opt('activity', sym('NVDA', 'NVIDIA'), 'Overview')}${opt('book', 'Markets', 'Research')}</div>`;
  if (state === 'loading') body = `<div class="grp" aria-busy="true">${[70, 54, 62, 48].map((w) => `<div class="opt"><span class="skel" style="width: 16px; height: 16px;"></span><span class="skel" style="height: 12px; width: ${w}%;"></span><span></span></div>`).join('')}</div>`;
  if (state === 'nomatch') body = `<div class="grp"><p class="dline" style="margin: 6px 8px 10px; font-size: 13px;">No ticker or note matches “qxtr”.</p>${opt('arrow', `Open <span class="mono" style="font-weight: 600;">QXTR</span> anyway`, '↵', true)}</div>`;
  if (state === 'failed') body = `<div class="grp"><div class="dwarn" style="margin: 4px 8px 8px;">${icon('warn', 14)}<div><strong style="font-size: 12.5px;">Couldn’t search tickers right now.</strong><span class="dline" style="display: block; font-size: 12px;">Go-to commands and notes still work; the ticker list comes back on the next open.</span></div></div>${opt('book', 'Research', '<span class="kbd">g</span> <span class="kbd">r</span>', true)}</div>`;
  const query = state === 'nomatch' ? 'qxtr' : state === 'empty' ? '' : 'nv';
  const foot = stg ? 'Scores come from the demo’s sample scan.' : 'Scores aren’t live on this site, so tickers list by name.';
  return `<div class="pal ss-pal" role="dialog" aria-modal="true" aria-label="Jump to a ticker or note"><div class="pin">${icon('search', 16)}<span class="mono" style="font-size: 15px; flex: 1;">${query || '<span class="steel" style="font-family: IBM Plex Sans;">Jump to a ticker or note</span>'}<span aria-hidden="true" style="display: inline-block; width: 1px; height: 18px; vertical-align: middle; background: var(--amber-text); margin-left: 2px;"></span></span><span class="kbd">esc</span></div><div role="listbox">${body}</div><div class="pf"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">?</span> all shortcuts</span><span style="flex: 1;"></span><span>${foot}</span></div></div>`;
}

/** The mobile drawer: the five links, then Settings, the account line and "What’s live". */
export function drawerF({ env = 'production', active = 'research' } = {}) {
  const links = [['Scanner', '/scanner', 'scanner'], ['Ticker', '/ticker', 'ticker'], ['Research', '/research', 'research'], ['Positions', '/positions', 'positions'], ['Alerts', '/alerts', 'alerts']];
  const acct = env === 'staging'
    ? `<div class="acct"><span class="ss-av">D</span><span>Demo account</span></div><a class="q" href="/settings">Settings</a><button class="btn secondary" type="button" style="margin: 4px 10px; min-height: 44px;">Reset demo data</button>`
    : `<a class="q" href="/settings">Settings</a><a class="q" href="#login">Log in</a><a class="q" href="/methodology#data">What’s live on this site</a>`;
  return `<nav class="ss-drawer" aria-label="Menu"><div style="display: flex; justify-content: space-between; align-items: center; min-height: 48px;">${wordmark(15)}<button class="btn ghost" type="button" aria-label="Close menu" style="min-height: 44px; min-width: 44px;">${icon('close', 20)}</button></div>${links.map(([n, h, k]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${n}</a>`).join('')}<div style="height: 1px; background: var(--line); margin: 8px 0;"></div>${acct}</nav>`;
}

// ---- the landing hero: F1's static projection (P-15) ---------------------------------------------
// A copy of screens/v5/frontier.mjs f1Poster (not exported there): the same surface, the same labels.
const F1S = GEX_STRIKES, F1T = GEX_TENORS;
const F1V = F1T.map((d) => F1S.map((k) => +(gexAt(k, d) * 1.8).toFixed(3)));
const F1MAX = Math.max(...F1V.flat().map(Math.abs));
const LV = { put: 555, flip: 571, call: 590 };
function rot(yaw, pitch) { const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch); return [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy]; }
export function heroPoster() {
  const W = 1000, Hh = 560, H = 0.45 / F1MAX, yaw = -0.55, pitch = 0.52;
  // A static poster needs fit only for its own angle (the WebGL view fits every angle it can turn to).
  const R = rot(yaw, pitch);
  let mu = 0, mv = 0;
  for (const x of [-1, 1]) for (const y of [-F1MAX * H, F1MAX * H]) for (const z of [-0.7, 0.7]) { mu = Math.max(mu, Math.abs(R[0] * x + R[1] * y + R[2] * z)); mv = Math.max(mv, Math.abs(R[3] * x + R[4] * y + R[5] * z)); }
  const k = Math.min((W / 2) * 0.86 / mu, (Hh / 2) * 0.84 / mv);
  const P = (x, y, z) => [W / 2 + k * (R[0] * x + R[1] * y + R[2] * z), Hh / 2 - k * (R[3] * x + R[4] * y + R[5] * z) + 0.04 * Hh];
  const depth = (x, y, z) => R[6] * x + R[7] * y + R[8] * z;
  const sq = F1T.map(Math.sqrt), XS = (s) => -1 + (2 * (s - F1S[0])) / (F1S[F1S.length - 1] - F1S[0]), ZT = (t) => 0.7 - (1.4 * (Math.sqrt(t) - sq[0])) / (sq[sq.length - 1] - sq[0]);
  const quads = [];
  for (let j = 0; j < F1T.length - 1; j++) for (let i = 0; i < F1S.length - 1; i++) {
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [XS(F1S[a]), F1V[b][a] * H, ZT(F1T[b])]);
    const v = (F1V[j][i] + F1V[j][i + 1] + F1V[j + 1][i] + F1V[j + 1][i + 1]) / 4;
    quads.push({ pts: c.map((p) => P(...p)), d: c.reduce((s, p) => s + depth(...p), 0) / 4, v });
  }
  quads.sort((a, b) => a.d - b.d);
  const poly = quads.map((q) => { const t = Math.min(1, Math.abs(q.v) / F1MAX); const near = Math.abs(q.v) < 0.04 * F1MAX; return `<polygon points="${q.pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="${near ? 'var(--raised-2)' : q.v > 0 ? 'var(--up)' : 'var(--down)'}" fill-opacity="${near ? 1 : (0.3 + 0.62 * t).toFixed(2)}" stroke="var(--line-2)" stroke-width="0.6"></polygon>`; }).join('');
  const plane = [[-1, 0, 0.7], [1, 0, 0.7], [1, 0, -0.7], [-1, 0, -0.7]].map((p) => P(...p));
  const contour = [];
  for (let j = 0; j < F1T.length - 1; j++) { const cross = (jj) => { for (let i = 0; i < F1S.length - 1; i++) { const a = F1V[jj][i], b = F1V[jj][i + 1]; if ((a < 0) !== (b < 0) && F1S[i] > 560 && F1S[i] < 585) { const t = a / (a - b); return XS(F1S[i]) + t * (XS(F1S[i + 1]) - XS(F1S[i])); } } return null; }; const x0 = cross(j), x1 = cross(j + 1); if (x0 != null && x1 != null) contour.push([P(x0, 0.004, ZT(F1T[j])), P(x1, 0.004, ZT(F1T[j + 1]))]); }
  const svg = `<svg class="f1-poster" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true"><polygon points="${plane.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--steel)" stroke-width="1" vector-effect="non-scaling-stroke"></polygon>${poly}${contour.map(([a, b]) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="var(--phosphor)" stroke-width="2" vector-effect="non-scaling-stroke"></line>`).join('')}</svg>`;
  const lab = (x, y, z, text, cls = '') => { const [px, py] = P(x, y, z); return `<span class="${cls}" style="left: ${((px / W) * 100).toFixed(2)}%; top: ${((py / Hh) * 100).toFixed(2)}%;">${text}</span>`; };
  const j7 = F1T.indexOf(7), iC = F1S.indexOf(LV.call), iP = F1S.indexOf(LV.put);
  const labels = [
    ...[540, 560, 580, 600, 620].map((s, n) => lab(XS(s), 0, 0.8, String(s), n % 2 || s === 580 ? 'minor' : '')), // under 520px only 540 and 620 stay, clear of the flip label
    ...[1, 7, 30, 90].map((t) => lab(1.1, 0, ZT(t), `${t}d`, t === 1 ? 'minor' : '')),
    lab(0.35, 0, 1.0, 'Strike', 'ax'),
    lab(XS(LV.call), F1V[j7][iC] * H + 0.1, ZT(7), `Call wall ${LV.call} · +γ`, 'lv'),
    lab(XS(LV.put) - 0.25, 0.22, ZT(30), `Put wall ${LV.put} · −γ`, 'lv'),
    lab(XS(LV.flip), 0.02, 1.12, `Flip ${LV.flip}`, 'lv'),
  ].join('');
  return `${svg}<div class="f1-labels">${labels}</div>`;
}
export const HERO_READOUT = `Strike ${LV.call} · 7 days · +$${fmt.num(F1V[2][F1S.indexOf(LV.call)], 2)}M per 1% · dealers long gamma (moves tend to be damped)`;
export const SAMPLE_MARK = 'Illustrative sample — not a live read and not a recorded session.';
export const AI_SAMPLE_MARK = 'Illustrative sample — not a real model output.';

/** The hero panel. production: "Illustrative sample" (P-15), dashed frame + hatch (P-3/P-8). staging:
 *  the demo's dashed chip and scenario date. fallback: the poster is what no-WebGL, reduced-motion and
 *  lost-context readers get; the live panel is the same drawing, turned by hand. */
export function heroPanel({ env = 'production', mode = 'webgl' } = {}) {
  const tag = env === 'staging' ? '' : stateTag('sample', 'Illustrative sample');
  const foot = env === 'staging'
    ? `${provChip('Demo · illustrative sample', 'dashed')}<span class="cap" style="font-size: 12px; color: var(--steel);">The model’s shape, not the demo scenario’s chain.</span>`
    : `<span class="cap" style="font-size: 12px; color: var(--steel);">${SAMPLE_MARK}</span>`;
  const help = mode === 'webgl'
    ? '<p class="fhelp" style="margin: 0;">Drag to turn it (sideways on a phone, so the page still scrolls) · <span class="kbd">←</span><span class="kbd">→</span> strikes · <span class="kbd">↑</span><span class="kbd">↓</span> expiries · <span class="kbd">Home</span> resets</p>'
    : '<p class="fhelp" style="margin: 0;">The static projection: the same surface, labels and readout, drawn without WebGL.</p>';
  return `<figure class="cf k-sample f1 ss-hp" data-mode="poster" style="margin: 0;" aria-label="Dealer gamma surface across strike and expiry"><div class="lab"><span class="ss-eyebrow" style="flex: 1 1 auto;">Dealer gamma surface · strike × tenor</span>${tag}</div><div class="f1-stage" tabindex="0" role="group" aria-roledescription="3D chart" aria-label="Dealer gamma surface across strike and expiry. Arrow keys move the probe.">${heroPoster()}</div><div class="f1-readout">${HERO_READOUT}</div>${help}<div class="cf-foot">${foot}</div></figure>`;
}

// ---- the landing's three illustrations (frozen values from pages/landing/samples.ts) ----------------
const FIELD = [[550, -61], [552.5, -123], [555, -233], [557.5, -357], [560, -430], [562.5, -367], [565, -235], [567.5, -103], [570, 68], [572.5, 158], [575, 332], [577.5, 488], [580, 500], [582.5, 394], [585, 233], [587.5, 112], [590, 58], [592.5, 43], [595, 40], [597.5, 40], [600, 40]];
const illFrame = (env, inner, mark = SAMPLE_MARK) => env === 'staging'
  ? `<div class="hd-p is-sample ss-ill">${inner}<div class="cf-foot">${provChip('Demo · illustrative sample', 'dashed')}</div></div>`
  : `<div class="hd-p is-sample ss-ill">${inner}<p class="cap">${mark}</p></div>`;
const illHead = (env, title) => `<div class="ph"><h3>${title}</h3>${env === 'staging' ? '' : stateTag('sample', 'Illustrative sample')}</div>`;

export function fieldIll(env = 'production') {
  const body = plot({ height: 230, pl: 48, pr: 16, prn: 12, pt: 26, pb: 30, ends: false, keyboard: false, x: { min: 548.75, max: 601.25, ticks: [550, 560, 570, 580, 590, 600].map((v, i) => ({ v, label: String(v), minor: i % 2 === 1 })) }, y: { min: -520, max: 560, ticks: [{ v: -400, label: '−400' }, { v: 400, label: '+400' }] }, hlines: [{ v: 0, kind: 'zero' }], bars: FIELD.map(([k, v]) => ({ x: k, v, role: v > 0 ? 'up' : 'down' })), barW: 14, segs: [{ x0: 568.5, y0: -520, x1: 568.5, y1: 560, role: 'emph', width: 1.5, dash: '4 4' }, { x0: 573.12, y0: -520, x1: 573.12, y1: 560, role: 'ctx', width: 1.5 }], pointLabels: [{ x: 580, y: 500, text: 'Call wall 580 · +γ' }, { x: 560, y: 60, text: 'Put wall 560 · −γ' }, { x: 568.5, y: 560, text: 'Flip 568.5', minor: true }], aria: 'Net dealer gamma by strike, SPY illustrative sample: most positive at the 580 call wall, most negative at the 560 put wall, crossing zero near 568.5; mid 573.12.' });
  return illFrame(env, `${illHead(env, 'Net dealer gamma by strike · SPY')}<p class="cf-sub" style="margin: 0;">$M per 1% move · bars above the zero line, dealers long gamma (+γ); below, short (−γ) · dashed line the flip, solid the mid 573.12</p>${body}`);
}
export function scoreIll(env = 'production') {
  const cells = [['Opportunity', '72', 'Actionable · near wall · IV cheap'], ['IV / HV', '0.82', 'options look cheap'], ['Flip dist', '+0.8%', 'mid above the flip'], ['Vol / OI', '0.61×', '3 unusual strikes']];
  return illFrame(env, `${illHead(env, 'Triage score · SPY')}<div class="ss-score">${cells.map(([l, v, c]) => `<div><span class="caps">${l}</span><span class="v">${v}</span><span class="dline">${c}</span></div>`).join('')}</div><div class="ss-tiers">${['Dormant', 'Watch', 'Actionable', 'Prime'].map((t, i) => `${i ? '<span aria-hidden="true">→</span>' : ''}<span class="ss-tier${t === 'Actionable' ? ' on' : ''}"${t === 'Actionable' ? ' aria-current="true"' : ''}>${t}</span>`).join('')}<span style="margin-left: auto;">Ranks names for a deeper look</span></div>`);
}
export function aiIll(env = 'production') {
  const cells = [['Max risk', '$420', '1.7% of account', true], ['Invalidation', '568.50', 'the gamma flip', true], ['Entry', 'near 573', 'pullback to VWAP', true], ['Target', '579.50', 'AI-stated · untraced', false]];
  return illFrame(env, `<div class="ph"><h3 style="display: inline-flex; align-items: center; gap: 8px;">${icon('sparkle', 15)}AI read · SPY</h3><span class="stag k-solid">SIMULATED</span>${env === 'staging' ? '' : stateTag('sample', 'Illustrative sample')}</div><div class="ss-read"><div class="verdict"><span class="caps">Verdict</span><b>Trade</b><span class="steel">· bullish lean · conviction high</span></div><span style="font-size: 14px;"><b style="font-weight: 600;">Bull call spread</b> <span class="mono">575 / 580</span> · Sep 18</span><div class="ss-cells">${cells.map(([l, v, c, tr]) => `<div><span class="caps">${l}</span><span class="v${tr ? '' : ' body'}">${v}</span><span class="dline" style="font-size: 11.5px;">${c}</span></div>`).join('')}</div><span class="dline">Figures in mono trace to the snapshot; the target in body type is the model’s own number.</span></div>`, AI_SAMPLE_MARK);
}
