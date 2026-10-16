// Final · Ticker desk · before → after, for the owner's approval (2026-10-16).
//
// The build round's lane 4 reworked the desk's visual hierarchy (critique and change list:
// tmp/build/shots/lane4/CRITIQUE.md and AFTER.md, gitignored). The owner could not tell the full-page
// thumbnails apart, so this board shows what matters at real size: the FIRST SCREEN, before and after,
// with numbered outlines on each change. Before = the deployed sites at the time (still the old desk);
// after = this commit's builds, the live one reading production's own API (tmp/review-shots.mjs). The
// JPEGs are in design/review/2026-10-16-desk/, embedded at build time. Retire the board (delete it from
// ticker.mjs's desk row) once the owner rules on it (Q-DESK-HIERARCHY).
import { readFileSync, existsSync } from 'node:fs';

const DIR = new URL('../../../review/2026-10-16-desk/', import.meta.url);
const img = (name) => {
  const url = new URL(`${name}.jpg`, DIR);
  return existsSync(url) ? `data:image/jpeg;base64,${readFileSync(url).toString('base64')}` : '';
};

export const DR_CSS = `
  .dr { padding: 40px 44px 56px; display: flex; flex-direction: column; gap: 28px; font-size: 14px; line-height: 1.5; }
  .dr .eyebrow { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--steel); }
  .dr h1 { margin: 6px 0 0; font-size: 38px; line-height: 1.05; letter-spacing: -0.02em; }
  .dr h2 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
  .dr .lead { margin: 10px 0 0; max-width: 100ch; color: var(--steel); font-size: 14.5px; }
  .dr .verdict { border: 1px solid var(--line-2); border-radius: 12px; padding: 16px 18px; background: var(--panel); display: flex; flex-direction: column; gap: 8px; max-width: 1280px; }
  .dr .verdict b { color: var(--phosphor); }
  .dr .shot { display: flex; flex-direction: column; gap: 10px; }
  .dr .tag { font: 700 12px/1 'IBM Plex Mono', monospace; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 10px; border-radius: 6px; align-self: flex-start; border: 1px solid var(--line-2); }
  .dr .tag.after { background: var(--phosphor); color: var(--ink); border-color: var(--phosphor); }
  .dr figure { margin: 0; }
  .dr figure img { display: block; max-width: 100%; height: auto; border: 1px solid var(--line-2); border-radius: 10px; }
  .dr .legend { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 28px; max-width: 1280px; }
  .dr .legend li { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; align-items: start; }
  .dr .n { width: 26px; height: 26px; border-radius: 13px; background: #ff4fd8; color: #000; font: 700 14px/26px system-ui, sans-serif; text-align: center; }
  .dr .phones { display: grid; grid-template-columns: repeat(2, 390px); gap: 32px; align-items: start; }
  .dr .note { color: var(--steel); font-size: 12.5px; max-width: 120ch; margin: 0; }
  .dr hr { border: 0; border-top: 1px solid var(--line-2); margin: 8px 0; width: 100%; }
`;

const shot = (name, after, label) =>
  `<div class="shot"><span class="tag${after ? ' after' : ''}">${after ? 'After' : 'Before'} · ${label}</span><figure><img alt="${after ? 'After' : 'Before'}: ${label}" src="${img(name)}"></figure></div>`;
const legend = (items) =>
  `<ul class="legend">${items.map(([n, t]) => `<li><span class="n">${n}</span><span>${t}</span></li>`).join('')}</ul>`;

export function deskReviewBody({ scheme = 'dark', minHeight = 0 } = {}) {
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><article class="dr" aria-label="Ticker desk before and after">
    <header>
      <span class="eyebrow">Ticker desk · for your approval · 2026-10-16 · not shipped</span>
      <h1>Before → after: what you see before scrolling</h1>
      <p class="lead">Each pair is the first screen at real size, the part of the desk you see without scrolling. Before is the site as deployed now; after is the new build (production’s after reads the real production API). The pink numbers mark the same element in both, so compare 1 with 1, 2 with 2.</p>
    </header>
    <div class="verdict">
      <span><b>The one-line difference:</b> before, the first screen spends its top third on a tab row and a five-line sample note, and the chart is cut off at its title. After, the price, its change and the dealer verdict come first, and the whole chart with every level fits on the first screen.</span>
    </div>

    <h2>Staging desk · 1280 px</h2>
    ${legend([
      ['1', '<b>The price.</b> Before: at y≈410, below the tabs and the sample note, with no change on the day. After: the first thing under the nav (y≈214), with ▼ −0.13 (−0.02%).'],
      ['2', '<b>The verdict.</b> Before: a small green “positive gamma” chip, so the meaning rides on the color. After: “+γ long gamma above 683.92”, neutral, with the sign and the level in words.'],
      ['3', '<b>The chart’s title.</b> Before: “Structure field”, the name of the chart. After: what it shows: dealers are long gamma, spot 1.0% above the 683.92 flip.'],
      ['4', '<b>The levels.</b> New: a one-line reading of the levels (“the flip is 1.0% below; the walls sit 1.9% above and 5.6% below”), and the whole ladder is now on the first screen.'],
      ['5', '<b>The tabs.</b> Before: a full row above everything. After: in the masthead’s right column, where they take no height.'],
      ['6', '<b>The sample note.</b> Before: five lines of sample detail above the price. After: moved under the desk as “About this sample”; the “Demo · sample data” tags still mark every figure.'],
    ])}
    ${shot('fs-staging-1280-before', false, 'staging · SPY · 1280 × 900')}
    ${shot('fs-staging-1280-after', true, 'staging · SPY · 1280 × 900')}

    <hr>
    <h2>Production desk · 1280 px</h2>
    <p class="note">The production desk’s top is unchanged (it has no price of its own: the chart is TradingView’s). The change is beside and below the chart.</p>
    ${legend([
      ['A', '<b>Beside the chart.</b> Before: an Off card (FINRA short-sale volume) took the slot next to the chart, and the real SEC filings sat below the fold. After: the SEC panels that have live data (Recent filings, Insider trades) sit beside the chart.'],
      ['B', '<b>FINRA.</b> Before: two separate Off cards. After: one Off card for both FINRA datasets, after the live panels, with one reason.'],
    ])}
    ${shot('fs-production-1280-before', false, 'production · NVDA · 1280 × 1300')}
    ${shot('fs-production-1280-after', true, 'production · NVDA · 1280 × 1300')}

    <hr>
    <h2>Phone · staging · 390 px</h2>
    ${legend([
      ['1', '<b>The price.</b> Before: a condensed “SPY · $690.62” bar under a five-line note, then the price again further down. After: the price once, at the top, with its change.'],
      ['2', '<b>The verdict.</b> After: “+γ long gamma above 683.92” right under the price.'],
      ['6', '<b>The sample note.</b> Before: above the price. After: under the desk.'],
    ])}
    <div class="phones">${shot('fs-staging-390-before', false, 'phone · 390 × 844')}${shot('fs-staging-390-after', true, 'phone · 390 × 844')}</div>
    <p class="note">Full-page captures at every width, and the written critique and change list, are in tmp/build/shots/lane4/ in the repo.</p>
  </article></div>`;
}
