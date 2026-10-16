// Final · Ticker desk · before → after, for the owner's approval (2026-10-16).
//
// The build round's lane 4 reworked the desk's visual hierarchy (critique and change list:
// tmp/build/shots/lane4/CRITIQUE.md and AFTER.md, gitignored). This board puts the real captures side
// by side, before and after, so the owner approves the running screen, not only the redrawn boards.
// The images are JPEG copies of those captures in design/review/2026-10-16-desk/, embedded at build
// time. Retire the board (delete it from ticker.mjs's desk row) once the owner rules on it.
import { readFileSync, existsSync } from 'node:fs';

const DIR = new URL('../../../review/2026-10-16-desk/', import.meta.url);
const img = (name) => {
  const url = new URL(`${name}.jpg`, DIR);
  return existsSync(url) ? `data:image/jpeg;base64,${readFileSync(url).toString('base64')}` : '';
};

export const DR_CSS = `
  .dr { padding: 40px 44px 56px; display: flex; flex-direction: column; gap: 32px; font-size: 13.5px; line-height: 1.5; }
  .dr .eyebrow { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--steel); }
  .dr h1 { margin: 6px 0 0; font-size: 38px; line-height: 1.05; letter-spacing: -0.02em; }
  .dr h2 { margin: 0; font-size: 20px; letter-spacing: -0.01em; }
  .dr .lead { margin: 10px 0 0; max-width: 96ch; color: var(--steel); font-size: 14px; }
  .dr ol.read { margin: 12px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .dr table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
  .dr th, .dr td { text-align: left; padding: 7px 18px 7px 0; border-bottom: 1px solid var(--line-2); }
  .dr th { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); }
  .dr td.n { font-family: 'IBM Plex Mono', monospace; }
  .dr ul.ch { margin: 10px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; max-width: 120ch; }
  .dr ul.ch b { color: var(--phosphor); }
  .dr .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 640px)); gap: 24px; align-items: start; }
  .dr .phones { display: grid; grid-template-columns: repeat(4, minmax(0, 320px)); gap: 24px; align-items: start; }
  .dr figure { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .dr figcaption { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); }
  .dr figcaption b { color: var(--phosphor); }
  .dr figure img { display: block; width: 100%; height: auto; border: 1px solid var(--line-2); border-radius: 10px; }
  .dr .note { color: var(--steel); font-size: 12.5px; max-width: 120ch; }
`;

const fig = (name, label, sub) =>
  `<figure><figcaption><b>${label}</b> · ${sub}</figcaption><img alt="${label}: ${sub}" src="${img(name)}"></figure>`;

export function deskReviewBody({ scheme = 'dark', minHeight = 0 } = {}) {
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><article class="dr" aria-label="Ticker desk before and after">
    <header>
      <span class="eyebrow">Ticker desk · for your approval · 2026-10-16 · not shipped</span>
      <h1>Before → after: the desk's visual hierarchy</h1>
      <p class="lead">Real captures of the running desk on both builds, before and after the build round's hierarchy pass. The boards in this row are redrawn to match the after. Approve it, or say what to change; nothing ships until you do.</p>
      <ol class="read">
        <li><b>First read:</b> the price and the structure verdict (staging), or the ticker and TradingView's chart (production).</li>
        <li><b>Second:</b> the levels that frame it: the field with the flip and walls, the ladder's distances, the move options price.</li>
        <li><b>Third:</b> supporting context: the read strip, the AI read, the tape and the book, then a quieter context band.</li>
      </ol>
    </header>

    <section>
      <h2>Where the first read lands</h2>
      <p class="note">Top of each element in CSS pixels on the staging desk (SPY). Before read off the captures; after measured in the browser.</p>
      <table>
        <thead><tr><th></th><th>1280 before</th><th>1280 after</th><th>390 before</th><th>390 after</th></tr></thead>
        <tbody>
          <tr><td>Price</td><td class="n">≈410</td><td class="n">214</td><td class="n">≈605</td><td class="n">276</td></tr>
          <tr><td>Structure field</td><td class="n">≈700</td><td class="n">545</td><td class="n">≈1270</td><td class="n">1087</td></tr>
          <tr><td>Level ladder</td><td class="n">≈710</td><td class="n">572</td><td class="n">≈1860</td><td class="n">1509</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Staging desk · 1280 · dark</h2>
      <ul class="ch">
        <li><b>Price first.</b> The tabs move into the masthead and the sample-basis box moves under the desk as “About this sample”. The price carries its day change (▼ −0.13 from the scenario's prior close), and a neutral chip “+γ long gamma above 683.92” replaces the green “positive gamma” chip, so the sign never rides on hue alone.</li>
        <li><b>The main chart states its finding</b> (“Dealers are long gamma (+γ): spot 690.62 sits 1.0% above the 683.92 flip”). Its legend draws the flip as the chart does, not amber, and Regime and Implied move fill the empty space beside the ladder.</li>
        <li><b>A one-line read strip:</b> each value is the figure alone; its qualifier leads the caption.</li>
        <li><b>The AI read earns its column</b> (7/5 split). The sample read sets a watch level, checked against the snapshot, so it shows the trace line; the “Variant fingerprint” line is gone.</li>
        <li><b>A quieter context band that points back at the levels:</b> the straddle leads, titled by its finding, as a range bar against both walls. The disabled filter and the “+ Add widget” ghost are removed; neither did anything.</li>
        <li><b>Per-symbol sample values:</b> Net DEX, Vol/OI, IV skew and off-exchange share now differ by symbol, derived from each symbol's own sample data.</li>
      </ul>
    </section>
    <div class="pair">${fig('demo-ticker-SPY-1280-dark-before', 'Before', 'staging · SPY · 1280')}${fig('demo-ticker-SPY-1280-dark-after', 'After', 'staging · SPY · 1280')}</div>

    <section>
      <h2>Production desk · 1280 · dark</h2>
      <ul class="ch">
        <li><b>Present before absent.</b> The SEC panels move up beside TradingView's chart; FINRA's two Off cards fold into one Off card after them, with your reason.</li>
        <li><b>The feed zone states its cause once</b> (“Off because …”) instead of on every panel; each panel keeps its Not live tag, what it would show and “See it on the demo →”, in full rows. The page is 2,687 px tall at 1280, down from 3,221.</li>
      </ul>
      <p class="note">These captures ran on a local API without the SEC agent, so their SEC cards read Not set up; production has SEC set, as the Production board draws.</p>
    </section>
    <div class="pair">${fig('live-ticker-NVDA-1280-dark-before', 'Before', 'production · NVDA · 1280')}${fig('live-ticker-NVDA-1280-dark-after', 'After', 'production · NVDA · 1280')}</div>

    <section>
      <h2>Phones · 390 · dark · the first 2,600 px</h2>
      <p class="note">On staging the price moves up from y≈605 to 276 and the levels from ≈1860 to 1509; the price no longer prints twice at the top.</p>
    </section>
    <div class="phones">${fig('demo-ticker-SPY-390-dark-before', 'Before', 'staging · 390')}${fig('demo-ticker-SPY-390-dark-after', 'After', 'staging · 390')}${fig('live-ticker-NVDA-390-dark-before', 'Before', 'production · 390')}${fig('live-ticker-NVDA-390-dark-after', 'After', 'production · 390')}</div>
  </article></div>`;
}
