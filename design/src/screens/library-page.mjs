// Library — tokens (from tokens.json, with measured contrast), type, every registered component with its
// states and markup, the instruments, the chrome, and the React mapping. Adding a state or a component
// in src/components shows up here without touching this file.
import { icon, magnetView, ring, seq, sparkline, structureField, termRibbon, tokens, wordmark } from '../lib.mjs';
import { registry } from '../components/index.mjs';
import { CONNECTION, chip } from '../components/chip.mjs';
import { ladder } from '../components/ladder.mjs';
import { figureCell } from '../components/figure-cell.mjs';
import { riskField, SPY_RISK } from '../components/risk-field.mjs';

export const LIB_CSS = `
  .lib { width: 100%; background: var(--ink); color: var(--phosphor); }
  .lib-grid { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 40px; align-items: start; }
  .lib-nav { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 2px; }
  .lib-nav a { display: block; padding: 6px 12px; border-radius: 8px; font-size: 12.5px; color: var(--steel); text-decoration: none; white-space: nowrap; }
  .lib-nav a.on { color: var(--phosphor); background: var(--raised); font-weight: 600; }
  .lib h2 { font-size: clamp(20px, 1.8vw, 24px); margin: 44px 0 6px; letter-spacing: -0.015em; }
  .lib section:first-of-type h2 { margin-top: 0; }
  .lib .lead { margin: 0 0 16px; font-size: 13.5px; color: var(--steel); max-width: 760px; line-height: 1.55; }
  .demo { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-bottom: 14px; background: var(--panel); }
  .demo-head { display: flex; gap: 8px; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .demo-title { font-size: 13px; font-weight: 600; }
  .demo-stage { padding: 18px 14px; display: flex; flex-wrap: wrap; gap: 14px 12px; align-items: flex-start; background: var(--ink); }
  .demo-stage.col { flex-direction: column; align-items: stretch; }
  .demo-stage.strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; padding: 0; background: var(--panel); }
  .demo-stage.strip > * { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .demo-stage.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .demo-stage.ladder { display: block; padding: 8px 18px; }
  .demo-stage.wide > * { flex: 1 1 300px; }
  .state { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .state-label { font-size: 11px; color: var(--steel-2); }
  .demo-note { margin: 0; padding: 10px 14px; font-size: 12px; color: var(--steel); line-height: 1.5; border-top: 1px solid var(--line); }
  .demo-code summary { cursor: pointer; padding: 8px 14px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); border-top: 1px solid var(--line); list-style: none; }
  .demo-code pre { margin: 0; padding: 12px 14px; background: var(--ink-2); font-family: 'IBM Plex Mono', monospace; font-size: 11px; line-height: 1.55; color: var(--steel); overflow: auto; max-height: 260px; white-space: pre-wrap; word-break: break-word; }
  .tok { width: 100%; border-collapse: collapse; font-size: 12px; }
  .tok th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 8px 10px; border-bottom: 1px solid var(--line-2); }
  .tok td { padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  .sw { display: inline-block; width: 28px; height: 20px; border-radius: 5px; border: 1px solid var(--line-2); vertical-align: middle; }
  .map { width: 100%; border-collapse: collapse; font-size: 12px; }
  .map th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 8px 10px; border-bottom: 1px solid var(--line-2); }
  .map td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; line-height: 1.45; color: var(--steel); }
  .map td:first-child { color: var(--phosphor); font-weight: 600; white-space: nowrap; }
  @media (max-width: 899px) { .lib-grid { grid-template-columns: 1fr; gap: 16px; } .lib-nav { position: static; flex-direction: row; overflow-x: auto; scrollbar-width: none; } .tok, .map { min-width: 640px; } .tok-wrap, .map-wrap { overflow-x: auto; } .demo-stage.strip, .demo-stage.grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function demo(title, html, { note = '', react = '', snippet = null, frame = '' } = {}) {
  const code = snippet ?? html;
  return `<div class="demo"><div class="demo-head"><span class="demo-title">${title}</span>${react ? `<span class="chip outline mono" style="font-size: 11px;">${react}</span>` : ''}</div><div class="demo-stage ${frame}">${html}</div>${note ? `<p class="demo-note">${note}</p>` : ''}<details class="demo-code"><summary>Markup</summary><pre><code>${esc(code.trim().replace(/\n\s+/g, '\n'))}</code></pre></details></div>`;
}

// ---- colour maths ----------------------------------------------------------------------------
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const x = lum(a), y = lum(b); return ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(1); };
function parse(str, bg) {
  const h = str.match(/^#([0-9a-f]{6})$/i);
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16));
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return bg;
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return [r, g, b].map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
}
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

export function libraryBody({ minHeight = 5400, standalone = false, dataStates = 'full', charts = 'full' } = {}) {
  const C = tokens.color;
  const inkD = parse(C.dark.ink, [0, 0, 0]), inkL = parse(C.light.ink, [255, 255, 255]);
  const rows = [
    ['ink', 'canvas'], ['ink2', 'wells, inset bodies, fields'], ['panel', 'raised surface'], ['raised', 'one step up: menus, chips, hover'], ['raised2', 'two steps up'],
    ['phosphor', 'primary text', true], ['steel', 'secondary text, structure', true], ['steel2', 'tertiary text, decorative lines', true],
    ['amber', 'THE brand: primary actions, active states, the flip, the verdict word', true], ['amberText', 'amber as text (light: darker grade)', true],
    ['signal', 'live, links, info', true], ['warn', 'true warnings, always with an icon', true], ['up', 'direction only: +P/L, calls, positive gamma', true], ['down', 'direction only: −P/L, puts, negative gamma', true],
    ['line', 'hairlines'], ['line2', 'strong hairlines, control borders'], ['scrim', 'sheet and dialog scrim'], ['glass', 'translucent nav'],
  ];
  const tokensTable = `<div class="tok-wrap"><table class="tok"><thead><tr><th>Token</th><th>Role</th><th>Dark</th><th>Light</th><th>Contrast on canvas · dark / light</th></tr></thead><tbody>${rows.map(([k, role, text]) => {
    const d = C.dark[k], l = C.light[k];
    const dc = parse(d, inkD), lc = parse(l, inkL);
    return `<tr><td style="font-weight: 600; color: var(--phosphor);">${k}<div class="mono" style="font-size: 11px; color: var(--steel-2); font-weight: 400;">--${k.replace(/([A-Z])/g, '-$1').replace(/(\d)/g, '-$1').toLowerCase()}</div></td><td style="color: var(--steel);">${role}</td><td><span class="sw" style="background: ${d};"></span> <span class="mono">${d}</span></td><td><span class="sw" style="background: ${l};"></span> <span class="mono">${l}</span></td><td class="mono" style="color: var(--steel);">${text ? `${cr(dc, inkD)} : 1 / ${cr(lc, inkL)} : 1` : d.startsWith('rgba') ? `resolves to ${hex(dc)} / ${hex(lc)}` : '—'}</td></tr>`;
  }).join('')}</tbody></table></div>`;

  const surfaces = `<div class="grid-3">
    ${['e1', 'e2', 'e4'].map((e, i) => `<div class="panel" style="padding: 14px; box-shadow: var(--${e}); background: var(--raised);"><div style="font-size: 12.5px; font-weight: 600;">${e} · ${['resting', 'raised', 'overlay'][i]}</div><div style="font-size: 11.5px; color: var(--steel); margin-top: 2px;">${['panels, cards', 'hover lift, sticky masthead', 'menus, toasts, dialogs, sheets'][i]}</div></div>`).join('')}
    ${Object.entries(tokens.radius).map(([n, r]) => `<div style="height: 60px; border-radius: ${r}px; border: 1px dashed var(--line-2); display: flex; align-items: center; justify-content: center; font-size: 11.5px; color: var(--steel);">radius ${r} · ${n}</div>`).join('')}
    <div style="display: flex; gap: 6px; align-items: flex-end;">${tokens.spacing.map((s) => `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;"><div style="width: ${s}px; height: ${s}px; background: var(--amber-tint-2); border-radius: 2px;"></div><span class="mono" style="font-size: 11px; color: var(--steel);">${s}</span></div>`).join('')}</div>
    <div style="font-size: 12px; color: var(--steel); line-height: 1.6;"><span class="caps">Z-index</span><br>${Object.entries(tokens.zIndex).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>
    <div style="font-size: 12px; color: var(--steel); line-height: 1.6;"><span class="caps">Breakpoints</span><br>${Object.entries(tokens.breakpoints).map(([k, v]) => `${k} ≥ ${v}`).join(' · ')} · phone below ${tokens.breakpoints.tablet}<br>container: panel &lt; ${tokens.container.compactFigurePx}px → 17px figures · &lt; ${tokens.container.tinyFigurePx}px → 15px</div>
  </div>`;

  const typeRamp = `<div class="tok-wrap"><table class="tok"><thead><tr><th>Style</th><th>Face · weight</th><th>Size / line</th><th>Use</th></tr></thead><tbody>${[
    ['Display XL', 'Archivo 700 · wdth 112.5', 'clamp(34, 4.6vw, 56) / 1.04 · −0.025em', 'landing hero'],
    ['Display L', 'Archivo 700 · wdth 112.5', 'clamp(30, 3vw, 42) / 1.1 · −0.02em', 'desk symbol; the price beside it is Mono'],
    ['Display M', 'Archivo 700 · wdth 112.5', 'clamp(26, 2.6vw, 34) / 1.1', 'page titles'],
    ['Verdict', 'Archivo 700 · wdth 112.5', 'clamp(26, 2.4vw, 32) / 1.1', 'the AI read verdict; the one amber word'],
    ['Widget title', 'Plex Sans 600', '14 / 1.25', 'h2 inside panels'],
    ['Body', 'Plex Sans 400', `${tokens.type.bodyPx} / 1.5 (15 / 1.6 marketing)`, 'UI copy, rationale'],
    ['Secondary', 'Plex Sans 400', `${tokens.type.secondaryPx} / 1.5`, 'subtitles, helper text'],
    ['Label caps', 'Plex Sans 600 · +6% tracking · uppercase', `${tokens.type.labelFloorPx} / 1.3`, 'figure labels, eyebrows — the floor'],
    ['Figure', 'Plex Mono 500', `${tokens.type.figurePx.join(' · ')} / 1.15 by container width`, 'figure cells'],
    ['Figure caption', 'Plex Mono 400', '11 / 1.3', 'distance, basis, provenance'],
    ['Untraced figure', 'Plex Sans 500 · dotted rule', 'same size as the figure', 'a number the model asserted that did not trace'],
  ].map((r) => `<tr>${r.map((c, i) => `<td class="${i === 2 ? 'mono' : ''}" style="${i === 0 ? 'font-weight: 600; color: var(--phosphor);' : 'color: var(--steel);'}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  // ---- registry-driven component demos ----
  const componentDemo = (e) => {
    const stage = e.single
      ? e.render()
      : e.states.map((s) => `<div class="state"${e.frame ? '' : ''}>${e.frame ? '' : `<span class="state-label">${s.label}</span>`}${e.render(s.props)}</div>`).join('');
    const snippet = e.snippet ?? (e.single ? null : e.render(e.states[0].props));
    return demo(e.spec.name, stage, { react: e.spec.react, note: `${e.spec.change}${e.spec.notes ? ' ' + e.spec.notes : ''}`, snippet, frame: e.frame || (e.col ? 'col' : '') });
  };
  const byGroup = (g) => registry.filter((e) => e.group === g).map(componentDemo).join('');

  const instruments = demo('Instruments', `
    <div class="panel is-live" style="flex: 1 1 420px; overflow: hidden;"><div class="well" style="padding: 6px 4px 0;">${structureField({ width: 720, height: 220, id: 'lib' })}</div><div style="display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-top: 1px solid var(--line);"><span class="caps">Tape · 5m</span><div style="flex: 1;">${sparkline(seq(40, 7, 573, 0.3), { width: 400, height: 26, color: 'var(--signal)', dot: true, cls: 'trail', fluid: true })}</div></div></div>
    <div style="flex: 1 1 300px; display: flex; flex-direction: column; gap: 10px;">
      <div class="panel" style="overflow: hidden;"><div class="well" style="padding: 4px 0 0;">${magnetView({ width: 420, height: 150, compact: true })}</div></div>
      <div class="panel" style="padding: 12px 14px 8px;">${termRibbon({ width: 320, height: 54 })}</div>
      <div class="panel" style="padding: 10px 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;"><span class="caps">Structure path</span>${sparkline(seq(14, 21, 66, 8), { width: 120, height: 22, color: 'var(--amber)' })}<span class="mono" style="font-size: 11px;">72 · +6 today</span>${ring(72, { size: 36 })}</div>
    </div>`,
    { react: 'StructureFieldCanvas · WallMagnetView · TermHeatChart · StructurePathStrip · Gauge', note: 'Series colours are direction only (calls up, puts down); the flip is the amber line with a soft beam; the mid is signal with a pulse only while the stream is live; particles drift near the flip only when live. Axis text inside SVG is 10px Plex Mono.', snippet: `structureField({ width: 1000, height: 300 })   // SVG, scales with its container
magnetView({ width: 1000, height: 300 })
termRibbon({ width: 380, height: 54 })
sparkline(values, { color: 'var(--signal)', dot: true, cls: 'trail', fluid: true })
ring(72, { size: 48 })` });

  const composites = demo('Composites · ladder, strip, risk grid', `
    <div class="panel" style="width: 300px; padding: 10px 16px 12px;"><div style="display: flex; justify-content: space-between;"><span class="caps">Levels</span><span class="mono" style="font-size: 11px; color: var(--steel);">distance from mid</span></div>${ladder()}</div>
    <div style="flex: 1 1 380px; display: flex; flex-direction: column; gap: 10px;">
      <div class="panel" style="display: grid; grid-template-columns: 1.35fr 1fr 1fr;"><div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-right: 1px solid var(--line);">${ring(72, { size: 48 })}<div class="cell"><span class="caps">Opportunity</span><span class="v" style="font-size: 18px;"><span class="amber">Actionable</span></span><span class="s">near wall · IV cheap</span></div></div><div style="border-right: 1px solid var(--line);">${figureCell({ label: 'IV / HV', value: '0.82', sub: 'options look cheap' })}</div>${figureCell({ label: 'Term', value: 'Contango', sub: '7d 14.2 → 90d 18.0' })}</div>
      <div class="grid-2" style="gap: 8px;">${SPY_RISK.map((r) => riskField(r)).join('')}</div>
    </div>`,
    { react: 'LevelLadder · ReadStrip · DecisionCard risk grid', note: 'Composites are the components above in their real arrangements; the desk screen uses exactly these.', snippet: `ladder(SPY_LEVELS)
<div class="panel strip">…8 × figureCell(...)…</div>
SPY_RISK.map(riskField)` });

  const nav = demo('Navigation · masthead', `
    <div style="width: 100%; border: 1px solid var(--line); border-radius: 12px; overflow: hidden;">
      <div class="nav-bar" style="position: static;"><div class="nav-in" style="padding: 0 16px;">${wordmark(17)}<nav class="nav-links"><a href="#">Scanner</a><a href="#" class="on">Ticker</a><a href="#">Positions</a><a href="#">Alerts</a></nav><div class="nav-right"><div class="field nav-search" style="width: 220px;">${icon('search', 15)}<span class="ph" style="flex: 1;">Jump to a ticker…</span><span class="kbd">⌘K</span></div>${chip({ label: 'Open <span class="mono" style="color: var(--steel);">10:42:07 ET</span>', tone: 'live', dot: true, size: 'lg' })}<span style="width: 30px; height: 30px; border-radius: 50%; background: var(--amber); color: var(--amber-ink); display: inline-flex; align-items: center; justify-content: center; font: 700 12px/1 'IBM Plex Sans', sans-serif;">R</span></div></div></div>
      <div class="panel" style="margin: 10px; display: flex; align-items: center; gap: 12px; padding: 8px 14px; box-shadow: var(--e2); flex-wrap: wrap;"><span class="display" style="font-size: 15px;">SPY</span><span class="mono" style="font-size: 15px; font-weight: 500;">573.12</span><span class="mono up" style="font-size: 11px;">+0.32%</span>${chip({ label: 'live', tone: 'live', dot: true, size: 'sm' })}<span style="flex: 1;"></span><span style="font-size: 11px; color: var(--steel);">All expirations · as-of 42s</span><button class="btn primary sm" type="button">Open sim trade</button></div>
    </div>`,
    { react: 'TopNav (4 links, CommandPalette, session chip) · CommandDeck → Masthead + sticky condensed bar', note: 'Under 1100 the search collapses to an icon; under 900 the links move behind the burger; under 700 the clock and bell hide. The condensed masthead appears once the full masthead scrolls out.' });

  const palette = demo('Command palette', `
    <div class="panel" style="width: min(520px, 100%); box-shadow: var(--e4); background: var(--raised); overflow: hidden;">
      <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--line);">${icon('search', 16)}<span class="mono" style="font-size: 14px;">NV</span><span style="width: 1px; height: 18px; background: var(--amber);"></span><span style="flex: 1;"></span><span class="kbd">esc</span></div>
      ${[['NVDA', 'NVIDIA · Prime · 88', true], ['NVDL', 'GraniteShares 2x NVDA · not in universe', false], ['NVO', 'Novo Nordisk · Watch · 41', false]].map(([s, n, on]) => `<div style="display: flex; align-items: center; gap: 12px; padding: 9px 14px; background: ${on ? 'var(--raised-2)' : 'transparent'};"><span class="mono" style="font-size: 13px; font-weight: 600; min-width: 52px;">${s}</span><span style="flex: 1; font-size: 12px; color: var(--steel);">${n}</span>${on ? chip({ label: 'Prime', tone: 'emph' }) + '<span class="kbd">↵</span>' : ''}</div>`).join('')}
      <div style="display: flex; gap: 14px; padding: 8px 14px; border-top: 1px solid var(--line); font-size: 11px; color: var(--steel-2);"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">↵</span> open ticker</span><span><span class="kbd">⇧↵</span> add to scan</span></div>
    </div>`,
    { react: 'CommandPalette (new) · recentTickers store + universe', note: 'Opens with ⌘K anywhere in the shell. Results show tier and score inline so the palette doubles as a mini scanner.' });

  const honesty = demo('Honesty vocabulary · the one connection chip', `<div style="display: flex; gap: 8px; flex-wrap: wrap;">${Object.keys(CONNECTION).map((k) => chip(CONNECTION[k])).join('')}</div><div class="mono" style="font-size: 12px; color: var(--steel); line-height: 1.7; width: 100%;">— · unavailable · not given · not set · size not suggested · unrecognized</div>`, { note: 'One connection chip per page. Closed is neutral, overnight and no-ticks are true warnings with the icon, replay is an outline chip that names the session. The six not-a-number literals are a closed set; they render as Sans, never as figures.', snippet: `connectionChip('live' | 'closed' | 'overnight' | 'noTicks' | 'offline' | 'replay')` });

  const motionRows = [
    ['Flash on tick', `${tokens.motion.flashMs}ms ease-out · colour decays up/down → phosphor`, 'flashUp / flashDown'],
    ['Live pulse', `${tokens.motion.pulseS}s (dot) · ${tokens.motion.widgetPulseS}s (bar) ease-in-out infinite · opacity + scale`, 'livePulse / widgetLivePulse'],
    ['Field particles', `${tokens.motion.driftS[0]}–${tokens.motion.driftS[1]}s linear · opacity 0 → 0.9 → 0 · gated by live`, 'drift'],
    ['Tape trail', `${tokens.motion.trailS}s linear · dash-offset`, 'trailMove'],
    ['Beam', `${tokens.motion.beamS}s ease-in-out · opacity 0.55 → 1`, 'beam'],
    ['Hover lift', `${tokens.motion.hoverMs}–220ms · −2px + e2`, 'transition'],
    ['Bottom sheet', `${tokens.motion.sheetMs}ms spring · drag to dismiss`, 'transition'],
    ['Hero curve', `${tokens.motion.heroCurveMs}ms cubic-bezier(0.16, 1, 0.3, 1) · the one orchestrated moment`, 'drawIn'],
  ];
  const motion = `<div class="tok-wrap"><table class="tok"><thead><tr><th>Signal</th><th>Spec</th><th>Keyframes</th></tr></thead><tbody>${motionRows.map(([a, b, c]) => `<tr><td style="font-weight: 600; color: var(--phosphor);">${a}</td><td style="color: var(--steel);">${b}</td><td class="mono" style="color: var(--steel);">${c}</td></tr>`).join('')}</tbody></table></div><p class="lead" style="margin-top: 12px;">Everything is a data signal except the hero curve. Every animation sits behind <span class="mono">prefers-reduced-motion</span>; live signals stop when the stream drops. Transform and opacity only.</p>`;

  const extraMap = [
    ['Tokens', 'shared/theme/tokens.ts', `Add ${Object.keys(tokens.additions).filter((k) => k !== '$comment').join(', ')}. Elevation, fonts and the amber grades stay as measured. Run verify-tokens.mjs.`],
    ['Read strip', '— (figures spread across tiles)', 'New widgets/read-strip reading market_state: opportunity, net_dex, iv_hv_ratio, iv_rank, chain_vol_oi, iv_skew, term_structure.state, off_exchange.ratio_pct.'],
    ['Structure field hero', 'gex-profile-chart + TapePulseStrip + StructurePathStrip', 'One panel: StructureFieldCanvas, ladder column, tape row, structure-path row.'],
    ['AI read', 'widgets/ai-rec/AiRecPanel + DecisionCard + AiRecPanelBlocks', 'Two-column brief on wide, narrow form under 900, bottom sheet under 768. presentationPolicy unchanged; composer collapses to one row.'],
    ['Masthead', 'widgets/chrome/CommandDeck + TickerHeader + TickerToolbar + QuickSymbols', 'One Masthead component; sticky condensed bar kept; quick symbols scroll.'],
    ['Nav', 'shell/TopNav.tsx', 'Four product links (Lab and Blog move to the footer), CommandPalette (new, ⌘K), session chip, burger under 900.'],
    ['Scanner', 'pages/scanner ScanTable / ScanCard', 'Column drops at 1300 and 1200; cards under 1000; hover preview popover; stale chip.'],
    ['Positions', 'features/trading/positions PositionsView / PositionCard', 'Mark-basis chips; cards under 1000; track record grid 4 → 2 → 1.'],
    ['Settings', 'features/auth/SettingsPage', 'Section rail (tabs under 900); panels unchanged in content.'],
    ['Alerts', 'pages/alerts/AlertsPage', 'Composer + rules + fired log in a 5/7 grid; single column under 900.'],
    ['Motion inventory', 'single-motion-moment.spec.ts', 'Amend: drift, trailMove, beam, shimmer, the sheet transition join the data-signal exemption; the hero curve stays the one orchestrated moment.'],
    ['Fonts', 'public/fonts (self-hosted)', 'Unchanged. The canvas loads Google Fonts only because its sandbox cannot read local files.'],
  ];
  const mapping = `<div class="map-wrap"><table class="map"><thead><tr><th>Primitive</th><th>Today</th><th>Change</th></tr></thead><tbody>${registry.map((e) => `<tr><td>${e.spec.name}</td><td>${e.spec.path}</td><td>${e.spec.change}</td></tr>`).join('')}${extraMap.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  const sections = [
    ['tokens', 'Tokens', 'From tokens/tokens.json — the same file that generates tokens.css and is verified against the app’s tokens.ts. Text tokens are measured against their canvas.', tokensTable + '<div style="height: 16px;"></div>' + surfaces],
    ['type', 'Type', 'Three faces, one job each: Archivo for display and verdicts, IBM Plex Sans for UI and untraced figures, IBM Plex Mono for every figure Convexa computed.', typeRamp],
    ['controls', 'Controls', 'Registered components with every state. Add a state in src/components and it appears here.', byGroup('Controls')],
    ['data', 'Data primitives', 'Figure cells, ladder rows, risk fields, and the instruments and composites built from them.', byGroup('Data') + instruments + composites],
    ['chrome', 'Chrome', 'Panels, widget frames, navigation and the masthead.', byGroup('Chrome') + nav],
    ['overlays', 'Overlays', 'Dialogs, drawers, the sheet, strips, tooltips, toasts, empty states, the command palette.', byGroup('Overlays') + palette],
    ['patterns', 'Patterns', 'The honesty vocabulary and the connection chip states.', honesty],
    ['data-states', 'Data states', dataStates === 'full'
      ? 'v4: the state tag and nine widget families, each in all fourteen data states (live, delayed, stale, loading, empty, error, unavailable, not configured, off, paused, not live, sample, demo, locked). The same records draw the State matrix boards.'
      : 'v4: the state tag in every state. The nine widget families in all fourteen states are drawn on the State matrix boards (page “v4 · Data states”) and in full on the site library.', dataStates === 'full' ? byGroup('Data states') : registry.filter((e) => e.group === 'Data states').slice(0, 1).map(componentDemo).join('')],
    ['charts', 'Charts', charts === 'full'
      ? 'v5: one chart system. Fifteen primitives, each in its variants and in the seven data states every chart owes (loading at final size, empty, error with cause, stale, not live, sample, demo); the React module each becomes is in its note and in the mapping below.'
      : 'v5: one chart system. The chart frame is shown here ready; all fifteen primitives in every state are on the “v5 · Charts” page and in the site library.', charts === 'full' ? byGroup('Charts') : registry.filter((e) => e.group === 'Charts').slice(0, 1).map((e) => componentDemo({ ...e, states: e.states.slice(0, 1) })).join('')],
    ['motion', 'Motion', 'Kept and new signals, all gated; durations from tokens.json.', motion],
    ['react', 'React mapping', 'Where each primitive lands in apps/dashboard and what changes — the first rows come from each component’s spec.', mapping],
  ];

  return `<div class="lib" style="min-height: ${minHeight}px; padding: 36px clamp(16px, 3vw, 40px) 48px;">
    <div style="display: flex; align-items: flex-end; gap: 24px; flex-wrap: wrap; margin-bottom: 28px;">
      <div><div class="caps" style="color: var(--amber-text);">Convexa design system · Curvature Terminal v2</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(26px, 2.6vw, 34px);">Tokens, components, states and the library</h1><p class="lead" style="margin-top: 8px;">Every primitive on the canvas, isolated with its states and the markup that produces it. The classes are the ones in <span class="mono">tokens.css</span>; the React column says where each primitive lands in the app.</p></div>
      ${standalone ? '<div style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap;"><a href="index.html" class="btn secondary sm">All screens</a><a href="tokens.css" class="btn ghost sm">tokens.css</a><a href="tokens.json" class="btn ghost sm">tokens.json</a></div>' : ''}
    </div>
    <div class="lib-grid">
      <nav class="lib-nav" aria-label="Sections">${sections.map(([id, t], i) => `<a href="#${id}" class="${i === 0 ? 'on' : ''}">${t}</a>`).join('')}</nav>
      <div style="min-width: 0;">${sections.map(([id, t, lead, body]) => `<section id="${id}"><h2 class="display">${t}</h2><p class="lead">${lead}</p>${body}</section>`).join('')}</div>
    </div>
  </div>`;
}
