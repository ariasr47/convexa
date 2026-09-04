// Figure cell — replaces the accent-bar StatTile. State lives in the label row and the type register,
// never in a coloured edge.
import { icon, labelInfo } from '../lib.mjs';

export const spec = {
  id: 'figure-cell',
  name: 'Figure cell',
  react: 'FigureCell',
  path: 'pages/ticker/widgets/_kit/StatTile.tsx → FigureCell.tsx',
  change: 'No accent bar. Label row: caps label, ⓘ, live dot only when the value comes from the stream. Value in Plex Mono; a figure the model asserted but could not trace renders in Plex Sans with a dotted rule. Offline keeps the last value at 50% with ⏸. The closed not-a-number vocabulary renders as 15px Sans.',
  notes: 'StatTile.spec, type-floor.spec and the live-tape specs follow the new anatomy. Container queries drop the figure to 17px under 360px of panel width and 15px under 280px.',
};

const LITERALS = new Set(['—', 'unavailable', 'not given', 'not set', 'size not suggested', 'unrecognized']);

export function figureCell({ label, value, sub = '', tone = '', dir = '', live = false, offline = false, flash = '', register = 'mono', size = 20, padding = '12px 16px', info = true }) {
  const arrow = dir === 'up' ? '<span class="up" style="font-size: 12px;">▲</span>' : dir === 'down' ? '<span class="down" style="font-size: 12px;">▼</span>' : '';
  const literal = LITERALS.has(value);
  const valueEl = literal
    ? `<span style="font-size: 15px; font-weight: 500; color: var(--steel);">${value}</span>`
    : register === 'sans'
      ? `<span class="sans" style="font-size: ${size}px; font-weight: 500; line-height: 1.2; border-bottom: 1px dotted var(--steel-2); display: inline-block;">${value}</span>`
      : `<span class="v ${flash}" style="font-size: ${size}px; ${tone ? `color: var(--${tone});` : ''}">${value}</span>`;
  const labelRow = info ? labelInfo(label, live ? '<span class="chip live" style="height: 16px; padding: 0 6px; font-size: 11px; margin-left: 2px;"><span class="dot"></span></span>' : '') : `<span class="caps">${label}</span>`;
  return `<div class="cell ${offline ? 'offline' : ''}" style="padding: ${padding}; position: relative; min-width: 0;">
    ${labelRow}
    <div style="display: flex; align-items: baseline; gap: 6px;">${valueEl}${arrow}</div>
    ${offline ? '<span class="s" style="color: var(--steel-2);">⏸ offline · last known</span>' : sub ? `<span class="s">${sub}</span>` : ''}
  </div>`;
}

export function skeletonCell({ padding = '12px 16px' } = {}) {
  return `<div class="cell" style="padding: ${padding};"><div class="skel" style="height: 11px; width: 50%;"></div><div class="skel" style="height: 22px; width: 62%; margin-top: 6px;"></div><div class="skel" style="height: 10px; width: 40%; margin-top: 6px;"></div></div>`;
}

export const states = [
  { label: 'Default', props: { label: 'Call wall', value: '580.00', sub: '+1.20% from mid' } },
  { label: 'Live · direction', props: { label: 'Net flow · 5m', value: '+12,480', sub: 'buyers lifting the ask', tone: 'up', dir: 'up', live: true, flash: 'flash-up' } },
  { label: 'Offline', props: { label: 'Spread', value: '$0.01', offline: true } },
  { label: 'Unavailable', props: { label: 'Net DEX', value: 'unavailable', sub: 'this cycle · never a fake zero' } },
  { label: 'Not set', props: { label: 'Per-trade cap', value: 'not set', sub: '<a href="#">Set your risk inputs →</a>' } },
  { label: 'Size not suggested', props: { label: 'Suggested size', value: 'size not suggested', sub: 'the model returned no size' } },
  { label: 'Untraced (Sans register)', props: { label: 'Target', value: '579.50', sub: 'AI-stated · untraced', register: 'sans' } },
  { label: 'Word value', props: { label: 'Term', value: 'Contango', sub: '7d 14.2 → 90d 18.0' } },
];
export const render = figureCell;
export { icon };
