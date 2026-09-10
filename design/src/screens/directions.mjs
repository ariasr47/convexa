// DirectionB / DirectionC — low-fi layout alternates for the Ticker desk, beside the built one.
const box = (label, style = '', inner = '') => `<div style="border: 1.5px dashed var(--line-2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--steel); text-align: center; padding: 6px; ${style}">${inner || label}</div>`;

function frame(title, tag, sketch, motivation, tradeoff) {
  return `<div style="width: 760px; min-height: 640px; background: var(--ink); color: var(--phosphor); padding: 24px 28px; display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; align-items: baseline; gap: 10px;"><span class="caps" style="color: var(--amber-text);">${tag}</span><h1 style="margin: 0; font-size: 20px; font-weight: 700;">${title}</h1><span style="margin-left: auto; font-size: 11px; color: var(--steel-2);">low-fi · structure only</span></div>
    <div style="background: var(--ink-2); border: 1px solid var(--line); border-radius: 10px; padding: 14px; height: 400px;">${sketch}</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12.5px; line-height: 1.5;"><div><span class="caps">Why it could win</span><p style="margin: 4px 0 0; color: var(--steel);">${motivation}</p></div><div><span class="caps">The tradeoff</span><p style="margin: 4px 0 0; color: var(--steel);">${tradeoff}</p></div></div>
  </div>`;
}

export function directionBBody() {
  const sketch = `<div style="display: grid; grid-template-columns: 1fr; gap: 8px; height: 100%;">
    ${box('nav · wordmark · Scanner Ticker Positions · ⌘K · account', 'height: 26px;')}
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; flex: 1; min-height: 0;">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${box('masthead · SPY 573.12 · chips · expirations · persona · CTA', 'height: 48px;')}
        ${box('structure field · full width of the column · ladder folded into an overlay', 'flex: 1.4;')}
        ${box('read strip · 8 figure cells', 'height: 44px;')}
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; flex: 1;">${box('live tape')}${box('context')}${box('context')}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; flex: 1;">${box('context')}${box('setups')}${box('position · orders')}</div>
      </div>
      <div style="border: 1.5px solid var(--amber); border-radius: 8px; display: flex; flex-direction: column; gap: 6px; padding: 8px; background: var(--amber-tint);">
        <div style="font-size: 11px; font-weight: 700; color: var(--amber-text);">AI READ · sticky rail</div>
        ${box('verdict · Trade · Bullish', 'height: 40px; border-color: var(--amber-text);')}
        ${box('risk 2×2', 'height: 70px;')}
        ${box('why · manage', 'flex: 1;')}
        ${box('actions · review sim trade', 'height: 34px;')}
        <div style="font-size: 11px; color: var(--steel); text-align: center;">stays in view while the column scrolls</div>
      </div>
    </div>
  </div>`;
  return frame('Sticky read rail', 'Direction B', sketch, 'The read is always on screen: scroll through context with the verdict, risk and the “review” action pinned at the right. It mirrors the co-pilot side-panel pattern people already know, and on a wide monitor the desk becomes a two-pane instrument.', 'The rail steals ~30% of width from the field at 1440 and forces the read into a tall narrow column, so the two-column brief (why beside risk) is lost. Below 1200px the rail has to collapse to a sheet anyway. The built direction keeps this rail as the phone/narrow form instead.');
}

export function directionCBody() {
  const sketch = `<div style="position: relative; height: 100%; border: 1.5px dashed var(--line-2); border-radius: 8px; overflow: hidden;">
    <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--steel);">structure field · full bleed · WebGL2 heat field + particles · the whole viewport</div>
    ${box('nav · glass', 'position: absolute; left: 10px; right: 10px; top: 10px; height: 26px; background: var(--panel);')}
    ${box('SPY 573.12 · chips · exp · persona', 'position: absolute; left: 10px; top: 46px; width: 300px; height: 40px; background: var(--panel);')}
    ${box('levels ladder · floating glass', 'position: absolute; left: 10px; top: 96px; width: 170px; height: 150px; background: var(--panel);')}
    ${box('read strip · floating', 'position: absolute; left: 10px; right: 250px; bottom: 60px; height: 40px; background: var(--panel);')}
    ${box('tape trail', 'position: absolute; left: 10px; right: 250px; bottom: 10px; height: 40px; background: var(--panel);')}
    <div style="position: absolute; right: 10px; top: 46px; bottom: 10px; width: 230px; border: 1.5px solid var(--amber); border-radius: 8px; background: var(--amber-tint); padding: 8px; display: flex; flex-direction: column; gap: 6px;"><div style="font-size: 11px; font-weight: 700; color: var(--amber-text);">AI READ · slide-over drawer</div>${box('verdict', 'height: 36px;')}${box('risk 2×2', 'height: 64px;')}${box('why', 'flex: 1;')}${box('review sim trade', 'height: 30px;')}<div style="font-size: 11px; color: var(--steel); text-align: center;">context lives behind a “More” drawer</div></div>
  </div>`;
  return frame('Focus mode · full-bleed field', 'Direction C', sketch, 'Maximum atmosphere: the field is the whole screen, everything else floats as glass. It is the most cinematic take, the natural home for the WebGL2 twin and the three.js surface, and it makes “liveness” the first thing you feel.', 'Density suffers: the seven context reads and setups move behind drawers, and a trader scanning for numbers has to hunt. Floating glass over a moving field also strains legibility and reduced-motion honesty. Better as an optional “Focus” toggle on the built desk than as the default.');
}
