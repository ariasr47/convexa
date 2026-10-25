// Responsive spec — the real breakpoints and reflow rules every surface on the canvas follows.
import { icon } from '../lib.mjs';

export const RESPSPEC_CSS = `
  .bp-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 900px; }
  .bp-table th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 10px 12px; border-bottom: 1px solid var(--line-2); vertical-align: bottom; }
  .bp-table td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--steel); line-height: 1.45; }
  .bp-table td:first-child { color: var(--phosphor); font-weight: 600; white-space: nowrap; }
  .devices { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
  .rules { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  @media (max-width: 999px) { .rules { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 599px) { .rules { grid-template-columns: 1fr; } }
`;

export function respSpecBody({ minHeight = 1300 } = {}) {
  const bps = [['≥ 1600', 'wide'], ['1300–1599', 'desktop'], ['1100–1299', 'laptop'], ['1000–1099', 'small laptop'], ['768–999', 'tablet'], ['< 768', 'phone']];
  const rows = [
    ['Content column', '1560 max · 40px gutters', '1360 max · 40px gutters', 'fluid · 3vw gutters', 'fluid · 3vw gutters', 'fluid · 3vw gutters', 'fluid · 16px gutters'],
    // As shipped (fidelity FND-20, 2026-10-25): no clock and no bell on any Final board or route, one 260 × 34 search.
    ['Nav', 'links · 260px search · Full demo ↗ (production) · account', 'same', 'same', 'search → 44px icon', 'links → menu button under 900px', 'menu button · wordmark · search icon · account'],
    ['Desk masthead', 'title, meta and controls on one row', 'same', 'controls wrap under the title when needed', 'same', 'controls take their own row', 'controls full width; CTA full width at 44px'],
    ['Structure field', 'field + 340px ladder', 'field + 300px ladder', 'same', 'ladder becomes a 5-cell row under the field', 'same; field scales with width', 'compact field (no axis labels); ladder as 2×2 cells; tape row wraps'],
    ['Read strip', '8 figure cells in one row', 'same', 'same', 'horizontal scroll · 170px cells · dots hint', 'same', 'same'],
    ['Work row', 'AI brief 8/12 · side column 4/12', 'same', 'AI brief full width; tape · position · orders as a 3-column row', 'same', 'AI brief single column; side cards stack', 'AI read docks as a bottom sheet with a peek row and a scrim when open; side cards stack in flow'],
    ['Context band', '3 columns (the 4-up track went: fidelity DESK-02)', '3 columns', '3 columns', '2 columns', '2 columns', '1 column; the filter control scrolls instead of hiding'],
    ['Scanner', 'table + hover preview', 'table + hover preview', 'table drops Put wall and Vol/OI; preview hidden', 'table also drops Regime and Call wall', 'cards 2-up; chips wrap; density hidden', 'cards 1-up'],
    ['Positions', 'table', 'table', 'table drops Max loss', 'same', 'cards 2-up', 'cards 1-up; net P/L stays at the top'],
    ['Settings', 'rail 220px + 760px column', 'same', 'same', 'same', 'rail → horizontal tabs', 'tabs; two-column field rows collapse under 640'],
    ['Landing', 'hero 2-col; features alternate sides', 'same', 'same', 'hero stacks; features stack, text first', 'desk strip scrolls; CTA band stacks', 'single column; CTAs full width'],
    ['Dialogs', 'centred 440–780px', 'same', 'same', 'same', 'centred with 24px margins', 'full width under 600; footer actions stack'],
  ];
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); padding: 36px clamp(16px, 3vw, 40px) 40px; display: flex; flex-direction: column; gap: 26px;">
    <div><div class="caps" style="color: var(--amber-text);">Responsive spec</div><h1 class="display" style="margin: 6px 0 0; font-size: clamp(24px, 2.4vw, 30px);">Six breakpoints, one layout language</h1><p style="margin: 8px 0 0; max-width: 820px; font-size: 13.5px; color: var(--steel); line-height: 1.55;">Every artboard on the Responsive page is the same source rendered at a different frame width — the CSS is fluid, not five drawings. Expand the main Ticker desk and resize your window to see it reflow live. Breakpoints are viewport widths; panels also compact their figures through container queries regardless of viewport.</p></div>
    <div class="devices">${[['Phone', 390, 60], ['Tablet', 834, 100], ['Small laptop', 1024, 120], ['Laptop', 1280, 140], ['Desktop', 1440, 156], ['Wide', 1920, 190]].map(([n, w, px]) => `<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><div style="width: ${px}px; height: ${Math.round(px * 0.62)}px; border: 1.5px solid var(--line-2); border-radius: ${px < 80 ? 10 : 6}px; background: var(--panel); display: flex; align-items: center; justify-content: center;"><span class="mono" style="font-size: 11px; color: var(--steel);">${w}</span></div><span style="font-size: 11.5px; color: var(--steel);">${n}</span></div>`).join('')}<span style="font-size: 11.5px; color: var(--steel-2); align-self: center; margin-left: 8px;">frames on the Responsive page use exactly these widths</span></div>
    <div class="panel quiet" style="overflow: auto;">
      <table class="bp-table"><thead><tr><th>Surface</th>${bps.map(([r, n]) => `<th><span class="mono" style="color: var(--phosphor);">${r}</span><br>${n}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </div>
    <div class="rules">
      ${[
        ['target', 'Touch and hit areas', 'Every control is ≥ 44px on coarse pointers via one theme rule; desktop density stays 36px. Symbol chips and segmented options grow with it.'],
        ['layers', 'No horizontal overflow', 'Grids use minmax(0, 1fr); long strings ellipsize or wrap; only deliberate rails (read strip, quick symbols, desk strip, the settings tabs) scroll sideways, with hidden scrollbars and a dots hint on the strip.'],
        ['activity', 'Type and figures', 'Display sizes use clamp(); figures never drop below 14px mono; labels stay at the 11px floor; tabular numerals everywhere.'],
        ['cube', 'Container queries', 'Every panel is a container: figure cells drop from 20px to 17px mono under 360px of panel width and to 15px under 280px, whatever the viewport, so a widget reads right in any cell or rail.'],
        ['shield', 'Safe areas', 'The nav pads for the notch; the phone desk pads left and right insets and keeps 76px plus the home-indicator inset free under the docked sheet.'],
        ['clock', 'Reduced motion', 'All liveness is behind prefers-reduced-motion: flashes become a colour hold, sheets snap, the field particles vanish. The hero curve renders drawn.'],
        ['sun', 'Both schemes at every size', 'Dark and light are the same layout — only the tokens change. The desk’s scheme tweak and the light renders on the System page prove it.'],
        ['eye', 'Hover has a fallback', 'Every hover-revealed control (expand, tooltips, the scanner preview) has a tap or focus path; the preview simply hides under 1200px where there is no hover.'],
      ].map(([ic, t, b]) => `<div class="panel quiet" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;"><span style="display: inline-flex; width: 30px; height: 30px; border-radius: 8px; background: var(--raised); color: var(--amber-text); align-items: center; justify-content: center;">${icon(ic, 15)}</span><div style="font-size: 13px; font-weight: 700;">${t}</div><p style="margin: 0; font-size: 12px; color: var(--steel); line-height: 1.5;">${b}</p></div>`).join('')}
    </div>
  </div>`;
}
