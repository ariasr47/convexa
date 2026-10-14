// Builds everything from the registries:
//   ../canvas/<Name>.dc.html + canvas.json  — artboards for the Claude Design canvas (then: seed.sh)
//   ../site/*.html + tokens.css + tokens.json — the static site, one page per screen, the library
// Run: node design/src/build.mjs
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_LINK, TOKENS_CSS, shell, tokens } from './lib.mjs';
import { screens } from './screens/index.mjs';
import { artboards, canvasJson, CANVAS_URL } from './canvas.config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CANVAS = join(here, '..', 'canvas');
const SITE = join(here, '..', 'site');
mkdirSync(CANVAS, { recursive: true });
mkdirSync(SITE, { recursive: true });

const STATIC = 'class Component extends DCLogic {}';
const propsAttr = (props) => JSON.stringify(props).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
// type="text/x-dc": the canvas runtime reads the logic by `script[data-dc-script]` textContent; the type keeps the
// browser from also executing it as a classic script inside the artboard frame (DCLogic is not a global there).
const scriptTag = (props, code) => `<script type="text/x-dc" data-dc-script data-props='${propsAttr(props || {})}'>\n${code || STATIC}\n</script>`;

// ---- 1. canvas ------------------------------------------------------------------------------
const keep = new Set(artboards.map((a) => `${a.name}.dc.html`));
for (const f of readdirSync(CANVAS)) if (f.endsWith('.dc.html') && !keep.has(f)) unlinkSync(join(CANVAS, f));
for (const a of artboards) {
  const scr = screens[a.screen];
  if (!scr) throw new Error(`artboard ${a.name}: unknown screen ${a.screen}`);
  const opts = { minHeight: a.h, ...(a.opts || {}) };
  const inner = scr.body(opts);
  const props = scr.interactive ? scr.interactive.props({ width: a.w, height: a.h, ...(a.opts || {}) }) : { $preview: { width: a.w, height: a.h } };
  const code = scr.interactive ? scr.interactive.script : STATIC;
  if (!scr.interactive && /\{\{/.test(inner)) throw new Error(`${a.name}: static screen contains template holes`);
  const html = shell(inner, { script: scriptTag(props, code), extraCss: scr.css || '', title: a.title });
  if (Buffer.from(html).includes(0)) throw new Error(`${a.name}: NUL byte`);
  writeFileSync(join(CANVAS, `${a.name}.dc.html`), html);
}
writeFileSync(join(CANVAS, 'canvas.json'), JSON.stringify(canvasJson(), null, 2) + '\n');
console.log(`canvas: ${artboards.length} artboards + canvas.json → design/canvas/`);

// ---- 2. site --------------------------------------------------------------------------------
const SITE_CSS = `
  [hidden] { display: none !important; }
  .site-bar { position: fixed; right: 16px; bottom: 16px; z-index: 100; display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 999px; background: var(--raised); border: 1px solid var(--line-2); box-shadow: var(--e4); font-size: 12px; color: var(--steel); flex-wrap: wrap; max-width: calc(100vw - 32px); }
  .site-bar a, .site-bar button, .site-bar select { height: 28px; border-radius: 999px; border: 1px solid transparent; background: transparent; color: var(--phosphor); font: 600 12px/1 'IBM Plex Sans', system-ui, sans-serif; padding: 0 10px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
  .site-bar a:hover, .site-bar button:hover { background: var(--raised-2); }
  .site-bar select { background: var(--ink-2); border-color: var(--line-2); padding: 0 8px; }
  .site-bar .lbl { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding-left: 6px; }
  @media (max-width: 767px) { .site-bar { bottom: auto; top: 64px; right: 8px; left: 8px; max-width: none; } }
`;
const schemeScript = `<script>
(function () {
  var KEY = 'convexa-design-scheme';
  function current() { try { return localStorage.getItem(KEY) || 'dark'; } catch (e) { return 'dark'; } }
  function apply(s) { document.documentElement.setAttribute('data-scheme', s); if (window.deskSetProps) window.deskSetProps({ scheme: s }); var b = document.getElementById('scheme-btn'); if (b) b.textContent = s === 'dark' ? 'Light scheme' : 'Dark scheme'; }
  window.toggleScheme = function () { var n = current() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(KEY, n); } catch (e) {} apply(n); };
  apply(current());
})();
</script>`;
const siteBar = (title, extra = '') => `<div class="site-bar" role="toolbar" aria-label="Design site controls"><a href="index.html">← All screens</a><span class="lbl">${title}</span>${extra}<button id="scheme-btn" type="button" onclick="toggleScheme()">Light scheme</button></div>`;
const page = ({ title, inner, css = '', script = '', desc = '', bar = '' }) => `<!doctype html>
<html lang="en" data-scheme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} · Convexa design</title>
<meta name="description" content="${desc.replace(/"/g, '&quot;')}">
<meta name="robots" content="noindex">
${FONT_LINK}
<link rel="stylesheet" href="tokens.css">
<style>${css}${SITE_CSS}</style>
</head>
<body>
${inner}
${bar}
${schemeScript}
${script}
</body>
</html>`;

// The canvas template becomes data-attributes; the same DCLogic class drives them from a tiny runtime.
function staticize(inner, vals) {
  let html = inner;
  html = html.replace(/<sc-if value="\{\{\s*(\w+)\s*\}\}"[^>]*>/g, (_, k) => `<div data-if="${k}" style="display: contents;">`).replace(/<\/sc-if>/g, '</div>');
  html = html.replace(/onClick="\{\{\s*(\w+)\s*\}\}"/g, (_, k) => `data-on="${k}"`);
  // The `data-tpl-*` copy keeps the raw template for the runtime, but it must not keep literal
  // `{{…}}` — the hole pass below would rewrite those into `<span data-hole>` INSIDE the attribute
  // value, the inner quotes would end the attribute early, and the tail leaked as page text
  // (`" data-on="showField">Field` in the desk's seg control; 7 sites in desk.html, found by the
  // 2026-09-08 fidelity audit). Entity-encode the braces: the browser decodes them back to `{{…}}`
  // in `a.value`, which is exactly what the runtime's re-substitution regex expects.
  const tplSafe = (v) => v.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;');
  html = html.replace(/\s([a-zA-Z-]+)="([^"]*\{\{[^"]*)"/g, (_, attr, val) => ` ${attr}="${val.replace(/\{\{\s*(\w+)\s*\}\}/g, (__, k) => String(vals[k] ?? ''))}" data-tpl-${attr}="${tplSafe(val)}"`);
  html = html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => `<span data-hole="${k}">${String(vals[k] ?? '')}</span>`);
  return html;
}
const runtime = (script) => `<script>
class DCLogic { constructor(props) { this.props = props; } setState(patch) { Object.assign(this.state, patch); window.deskRender && window.deskRender(); } }
${script}
(function () {
  var props = { readState: 'trade', live: true, scheme: document.documentElement.getAttribute('data-scheme') || 'dark', sheet: 'open' };
  var comp = new Component(props);
  var all = Array.prototype.slice.call(document.querySelectorAll('*'));
  var tplEls = all.filter(function (el) { return Array.prototype.some.call(el.attributes, function (a) { return a.name.indexOf('data-tpl-') === 0; }); });
  var ifEls = Array.prototype.slice.call(document.querySelectorAll('[data-if]'));
  var holeEls = Array.prototype.slice.call(document.querySelectorAll('[data-hole]'));
  function render() {
    var v = comp.renderVals();
    ifEls.forEach(function (el) { el.hidden = !v[el.getAttribute('data-if')]; });
    holeEls.forEach(function (el) { var k = el.getAttribute('data-hole'); el.textContent = v[k] == null ? '' : String(v[k]); });
    tplEls.forEach(function (el) { Array.prototype.forEach.call(el.attributes, function (a) { if (a.name.indexOf('data-tpl-') === 0) el.setAttribute(a.name.slice(9), a.value.replace(/\\{\\{\\s*(\\w+)\\s*\\}\\}/g, function (_, k) { return v[k] == null ? '' : String(v[k]); })); }); });
    var sel = document.getElementById('desk-read'); if (sel && sel.value !== props.readState) sel.value = props.readState;
  }
  window.deskRender = render;
  window.deskSetProps = function (patch) { var prev = Object.assign({}, comp.props); Object.assign(comp.props, patch); if (comp.componentDidUpdate) comp.componentDidUpdate(prev); render(); };
  document.addEventListener('click', function (e) { var t = e.target.closest('[data-on]'); if (!t) return; var v = comp.renderVals(); var fn = v[t.getAttribute('data-on')]; if (typeof fn === 'function') { e.preventDefault(); fn(); } });
  render();
})();
</script>`;
const deskBar = siteBar('Ticker desk', `<span class="lbl">Read</span><select id="desk-read" onchange="deskSetProps({ readState: this.value })">${['trade', 'no_trade', 'idle', 'loading', 'stale', 'cooldown', 'signed_out', 'no_key'].map((s) => `<option value="${s}">${s.replace('_', ' ')}</option>`).join('')}</select><button type="button" onclick="window.__live = window.__live === false ? true : false; deskSetProps({ live: window.__live })">Live on/off</button><button type="button" onclick="window.__sheet = window.__sheet === 'peek' ? 'open' : 'peek'; deskSetProps({ sheet: window.__sheet })">Phone sheet</button>`);
const deskVals = { scheme: 'dark', liveClass: 'is-live', sheetClass: '', peekVerdict: 'Trade · Bullish', peekChevron: 'rotate(0deg)', fieldSegClass: 'on', magnetSegClass: '', refreshClass: 'btn ghost', refreshLabel: 'Refresh analysis', footerNote: 'Reads pin to a snapshot and never refresh themselves · 3 of 10 reads left today' };

const pages = [];
for (const [slug, scr] of Object.entries(screens)) {
  let inner = scr.body({ minHeight: 0, standalone: true }).replace(/ data-scheme="dark"/g, '');
  let script = '', bar = siteBar(scr.title);
  if (scr.interactive) { inner = staticize(inner, deskVals); script = runtime(scr.interactive.script); bar = deskBar; }
  else if (/\{\{/.test(inner)) throw new Error(`static page ${slug} still contains template holes`);
  writeFileSync(join(SITE, `${slug}.html`), page({ title: scr.title, inner, css: scr.css, desc: scr.desc, script, bar }));
  pages.push([slug, scr.title, scr.group, scr.desc]);
}

const groups = [...new Set(pages.map((p) => p[2]))];
const indexInner = `<div style="min-height: 100vh; padding: 40px clamp(16px, 4vw, 56px) 80px; max-width: 1200px; margin: 0 auto;">
  <div class="caps" style="color: var(--amber-text);">Convexa · design</div>
  <h1 class="display" style="margin: 8px 0 0; font-size: clamp(28px, 3vw, 40px); letter-spacing: -0.02em;">Curvature Terminal v2</h1>
  <p style="margin: 10px 0 0; max-width: 720px; font-size: 14.5px; color: var(--steel); line-height: 1.6;">Static renders of every screen in the redesign, generated from <span class="mono">design/src</span>. Each page is fluid — resize the window — and the corner toggle flips the scheme. The editable canvas lives in Claude Design, one file per board; the v4 single-file viewer is kept beside this site as history.</p>
  <div style="display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap;"><a href="library.html" class="btn primary">Tokens, components &amp; library</a><a href="desk.html" class="btn secondary">Open the ticker desk</a><a href="${CANVAS_URL}" class="btn ghost">Editable canvas ↗</a><a href="../canvas/convexa-desk-redesign.html" class="btn ghost">v4 canvas file (frozen)</a></div>
  ${groups.map((g) => `<section style="margin-top: 36px;"><div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;"><span class="caps" style="color: var(--phosphor);">${g}</span><span style="flex: 1; height: 1px; background: var(--line);"></span></div><div class="grid-3">${pages.filter((p) => p[2] === g).map(([slug, title, , desc]) => `<a href="${slug}.html" class="panel" style="display: flex; flex-direction: column; gap: 6px; padding: 16px; text-decoration: none; color: inherit;"><span style="font-size: 14px; font-weight: 700;">${title}</span><span style="font-size: 12px; color: var(--steel); line-height: 1.5;">${desc}</span><span style="margin-top: auto; font-size: 12px; color: var(--signal); font-weight: 600;">Open →</span></a>`).join('')}</div></section>`).join('')}
  <p style="margin: 40px 0 0; font-size: 12px; color: var(--steel-2);">Sample values throughout. Regenerate with <span class="mono">node design/src/build.mjs</span>; verify tokens against the app with <span class="mono">node design/src/verify-tokens.mjs</span>.</p>
</div>`;
writeFileSync(join(SITE, 'index.html'), page({ title: 'All screens', inner: indexInner, desc: 'Convexa redesign — every screen as a static page.', bar: `<div class="site-bar"><span class="lbl">Convexa design</span><button id="scheme-btn" type="button" onclick="toggleScheme()">Light scheme</button></div>` }));

writeFileSync(join(SITE, 'tokens.css'), `/* Convexa design tokens + primitives (Curvature Terminal v2). Generated from design/tokens/tokens.json by design/src/build.mjs — do not edit. */\n${TOKENS_CSS}\n[hidden] { display: none !important; }\n`);
const { $comment, ...rest } = tokens;
writeFileSync(join(SITE, 'tokens.json'), JSON.stringify(rest, null, 2) + '\n');
console.log(`site: ${pages.length + 1} pages + tokens.css + tokens.json → design/site/`);
