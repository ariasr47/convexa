// Level ladder — the structure levels sorted by price, each marked with its line style from the field.
export const spec = {
  id: 'ladder',
  name: 'Level ladder',
  react: 'LevelLadder (new)',
  path: 'pages/ticker/widgets/dealer-positioning/LevelLadder.tsx',
  change: 'Replaces the twelve-tile grid. Rows: call wall, mid (the only live row), max pain (dashed), gamma flip (amber), put wall; distance from the mid in the last column. Under 1000px the rows become a 5-cell row; under 768 a 2×2 grid.',
  notes: 'The tick on the left uses the same stroke as the level line in the structure field, so the two read as one object.',
};

export function ladderRow({ label, value, dist, color, style = 'solid', live = false, big = false }) {
  return `<div class="lrow ${big ? 'big' : ''}">
    <span class="tick" style="border-top: ${style === 'dashed' ? '1px dashed' : '2px solid'} ${color};"></span>
    <span class="lbl" style="${live ? 'color: var(--signal); font-weight: 600;' : ''}">${label}${live ? ' <span class="chip live" style="height: 16px; padding: 0 6px; font-size: 11px; margin-left: 4px;"><span class="dot"></span>tape</span>' : ''}</span>
    <span class="val ${live ? 'flash-up' : ''}">${value}</span>
    <span class="dist">${dist}</span>
  </div>`;
}

export const LADDER_CSS = `
  .lrow { display: grid; grid-template-columns: 18px 1fr auto auto; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--line); }
  .lrow.big { padding: 10px 0; }
  .lrow .tick { width: 14px; height: 0; display: inline-block; flex-shrink: 0; }
  .lrow .lbl { font-size: 12px; color: var(--steel); font-weight: 500; white-space: nowrap; }
  .lrow .val { font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-weight: 500; }
  .lrow.big .val { font-size: 18px; font-weight: 600; }
  .lrow .dist { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--steel); min-width: 52px; text-align: right; }
`;

export const SPY_LEVELS = [
  { label: 'Call wall', value: '580.00', dist: '+1.20%', color: 'var(--up)' },
  { label: 'Mid', value: '573.12', dist: '—', color: 'var(--signal)', live: true, big: true },
  { label: 'Max pain', value: '570.00', dist: '−0.54%', color: 'var(--steel)', style: 'dashed' },
  { label: 'Gamma flip', value: '568.50', dist: '−0.81%', color: 'var(--amber)' },
  { label: 'Put wall', value: '560.00', dist: '−2.29%', color: 'var(--down)' },
];
export const ladder = (rows = SPY_LEVELS) => rows.map(ladderRow).join('');

export const states = [
  { label: 'Structure level', props: SPY_LEVELS[0] },
  { label: 'Live mid', props: SPY_LEVELS[1] },
  { label: 'Dashed (max pain)', props: SPY_LEVELS[2] },
  { label: 'Flip', props: SPY_LEVELS[3] },
];
export const render = ladderRow;
