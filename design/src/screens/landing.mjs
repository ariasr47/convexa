// Landing — the front door. One offer, one action, the product as the hero visual. Fluid.
import { footer, gammaSurface, icon, labelInfo, nav, ring, seq, sparkline, structureField } from '../lib.mjs';

export const LANDING_CSS = `
  .hero { position: relative; overflow: hidden; }
  .hero-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 48px; align-items: center; padding-top: 72px; padding-bottom: 56px; }
  .hero h1 { font-size: clamp(34px, 4.6vw, 56px); letter-spacing: -0.025em; line-height: 1.04; margin: 0; }
  .hero-ctas { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .desk-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
  .feature { display: grid; grid-template-columns: 1fr 1.25fr; gap: 56px; align-items: center; padding-top: 72px; }
  .feature.flip { grid-template-columns: 1.25fr 1fr; }
  .feature.flip .visual { order: -1; }
  .feature h2 { font-size: clamp(26px, 2.6vw, 34px); letter-spacing: -0.02em; margin: 0; }
  .honesty { display: grid; grid-template-columns: 1fr 2fr; gap: 48px; align-items: start; padding-top: 80px; }
  .honesty h2 { font-size: clamp(26px, 2.6vw, 34px); letter-spacing: -0.02em; margin: 12px 0 0; }
  .honesty-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .cta-band { display: grid; grid-template-columns: 1.4fr 1fr; gap: 32px; align-items: center; padding: 40px 44px; }
  .edge-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; }
  .tier-row { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--steel); flex-wrap: wrap; }
  @media (max-width: 1099px) { .hero-grid { grid-template-columns: 1fr; gap: 32px; padding-top: 48px; padding-bottom: 40px; } .feature, .feature.flip { grid-template-columns: 1fr; gap: 24px; padding-top: 56px; } .feature.flip .visual { order: 0; } .honesty { grid-template-columns: 1fr; gap: 24px; padding-top: 56px; } }
  @media (max-width: 899px) { .desk-strip { display: flex; overflow-x: auto; scrollbar-width: none; } .desk-strip::-webkit-scrollbar { display: none; } .desk-strip > * { flex: 0 0 210px; } .cta-band { grid-template-columns: 1fr; padding: 28px 24px; } .edge-grid { grid-template-columns: 1fr 1fr; } .edge-grid > *:nth-child(2) { border-right: 0 !important; } .edge-grid > *:nth-child(3), .edge-grid > *:nth-child(4) { border-top: 1px solid var(--line); } }
  @media (max-width: 699px) { .honesty-cards { grid-template-columns: 1fr; } .hero-ctas .btn { flex: 1 1 100%; } .cta-band .btn { width: 100%; } }
`;

function miniTicker(sym, price, chg, tier, flip, seed) {
  const up = chg.startsWith('+');
  return `<div class="panel" style="padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; min-width: 0;">
    <div style="display: flex; align-items: center; gap: 8px;"><span class="mono" style="font-size: 14px; font-weight: 600;">${sym}</span><span class="chip ${tier === 'Prime' || tier === 'Actionable' ? 'emph' : ''}" style="${tier === 'Actionable' ? 'opacity: 0.85;' : ''}">${tier}</span><span style="flex: 1;"></span><span class="chip live" style="height: 18px; padding: 0 6px;"><span class="dot"></span></span></div>
    <div style="display: flex; align-items: baseline; gap: 8px;"><span class="mono" style="font-size: 20px; font-weight: 500;">${price}</span><span class="mono ${up ? 'up' : 'down'}" style="font-size: 12px;">${chg}</span></div>
    <div style="display: flex; align-items: center; gap: 8px;">${sparkline(seq(20, seed, 0, 1), { width: 90, height: 22, color: up ? 'var(--up)' : 'var(--down)' })}<span class="mono" style="font-size: 11px; color: var(--steel); margin-left: auto;">flip ${flip}</span></div>
  </div>`;
}

export function landingBody({ minHeight = 2960, scheme = 'dark' } = {}) {
  const hero = `
  <section class="hero">
    <svg viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none;">
      <line x1="0" y1="360" x2="1200" y2="360" stroke="var(--steel)" stroke-opacity="0.35" vector-effect="non-scaling-stroke"></line>
      <path d="M 0 360 Q 350 359.5 700 352 Q 1015 345.25 1200 25" fill="none" stroke="var(--amber)" stroke-opacity="0.9" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke" style="stroke-dasharray: 1600; stroke-dashoffset: 1600; animation: drawIn 900ms cubic-bezier(0.16, 1, 0.3, 1) 150ms forwards;"></path>
    </svg>
    <div class="wrap hero-grid" style="position: relative;">
      <div style="display: flex; flex-direction: column; gap: 22px; max-width: 600px;">
        <span class="chip emph" style="align-self: flex-start; height: auto; min-height: 26px; padding: 4px 12px; white-space: normal; line-height: 1.3;">Dealer-gamma analytics · free ticker, no account</span>
        <h1 class="display">See the dealer positioning behind the price.</h1>
        <p style="margin: 0; font-size: clamp(15px, 1.2vw, 17px); line-height: 1.6; color: var(--steel); text-wrap: pretty;">Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup. Practice the plan on a simulated book before you ever risk a dollar.</p>
        <div class="caps" style="letter-spacing: 0.08em;">Scan → Ticker → Plan → Track</div>
        <div class="hero-ctas"><a href="#" class="btn primary lg">Open the Ticker ${icon('arrow', 16)}</a><a href="#" class="btn secondary lg">How it’s built</a></div>
        <p style="margin: 0; font-size: 12px; color: var(--steel-2);">Built for 7–45 DTE swing trades with optional intraday timing. An analysis tool; every trade is simulated.</p>
      </div>
      <div style="position: relative; min-width: 0;">
        <div class="panel is-live" style="padding: 14px 16px 10px; overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;"><span class="mono" style="font-size: 13px; font-weight: 600;">SPY</span><span class="chip outline">structure as-of 42s</span><span class="chip live"><span class="dot"></span>mid</span><span style="flex: 1;"></span><span class="caps">Dealer gamma surface · strike × tenor</span></div>
          ${gammaSurface({ width: 640, height: 400 })}
          <div style="display: flex; align-items: center; gap: 14px; font-size: 11px; color: var(--steel); padding-top: 6px; border-top: 1px solid var(--line); flex-wrap: wrap;"><span style="display: inline-flex; align-items: center; gap: 5px;"><span style="width: 10px; height: 2px; background: var(--amber);"></span>gamma flip</span><span style="display: inline-flex; align-items: center; gap: 5px;"><span style="width: 10px; height: 2px; background: var(--up);"></span>call wall</span><span style="display: inline-flex; align-items: center; gap: 5px;"><span style="width: 10px; height: 2px; background: var(--down);"></span>put wall</span><span style="margin-left: auto;">7d → 90d tenors · rendered from the desk’s own bundle</span></div>
        </div>
        <div style="margin-top: 6px; text-align: right; font-size: 11px; color: var(--steel-2);">three.js surface · the desk’s own model, drawn in depth</div>
      </div>
    </div>
  </section>`;

  const deskStrip = `
  <section class="wrap" style="padding-top: 8px;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap;"><span class="caps" style="color: var(--phosphor);">The desk right now</span><span style="font-size: 12px; color: var(--steel);">Prices live · structure snapshot ~3 min · hot names sooner</span><span style="flex: 1; height: 1px; background: var(--line); min-width: 30px;"></span><a href="#" style="font-size: 12px;">Open the Scanner →</a></div>
    <div class="desk-strip">
      ${miniTicker('SPY', '573.12', '+0.32%', 'Actionable', '−0.8%', 7)}${miniTicker('NVDA', '138.40', '+1.9%', 'Prime', '+0.4%', 3)}${miniTicker('QQQ', '486.55', '+0.41%', 'Watch', '−1.6%', 5)}${miniTicker('TSLA', '242.10', '−1.2%', 'Watch', '+2.3%', 9)}${miniTicker('IWM', '221.06', '−0.3%', 'Dormant', '−3.1%', 11)}
    </div>
  </section>`;

  const feature = (eyebrow, title, body, visual, flip = false, bullets = []) => `
  <section class="wrap feature ${flip ? 'flip' : ''}">
    <div style="display: flex; flex-direction: column; gap: 14px; max-width: 480px; min-width: 0;">
      <span class="caps" style="color: var(--amber-text);">${eyebrow}</span>
      <h2 class="display">${title}</h2>
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: var(--steel); text-wrap: pretty;">${body}</p>
      ${bullets.length ? `<ul style="margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13.5px;">${bullets.map((b) => `<li style="display: flex; gap: 10px; align-items: flex-start;"><span class="amber" style="display: inline-flex; margin-top: 3px;">${icon('check', 14)}</span><span>${b}</span></li>`).join('')}</ul>` : ''}
    </div>
    <div class="visual" style="min-width: 0;">${visual}</div>
  </section>`;

  const fieldVisual = `<div class="panel is-live" style="overflow: hidden;">
    <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px 8px; flex-wrap: wrap;"><h3 style="margin: 0; font-size: 13.5px; font-weight: 600;">Structure field</h3><span class="chip live" style="height: 18px; font-size: 11px;"><span class="dot"></span>mid · tape</span><span style="flex: 1;"></span><span style="font-size: 11px; color: var(--steel);">levels as-of 42s · the mid is tape</span></div>
    <div class="well" style="padding: 8px 4px 4px;">${structureField({ width: 720, height: 240, id: 'lp' })}</div>
  </div>`;

  const edgeVisual = `<div class="panel" style="padding: 4px 0;">
    <div class="edge-grid">
      <div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-right: 1px solid var(--line);">${ring(72, { size: 52 })}<div class="cell">${labelInfo('Opportunity')}<span class="v" style="font-size: 18px;"><span class="amber">Actionable</span></span><span class="s">near wall · IV cheap</span></div></div>
      ${[['IV / HV', '0.82', 'options look cheap'], ['Flip dist', '−0.81%', 'mid above the flip'], ['Vol / OI', '0.61×', '3 unusual strikes']].map(([l, v, s], i) => `<div class="cell" style="padding: 14px 16px; ${i < 2 ? 'border-right: 1px solid var(--line);' : ''}">${labelInfo(l)}<span class="v">${v}</span><span class="s">${s}</span></div>`).join('')}
    </div>
    <div class="tier-row">${['Dormant', 'Watch', 'Actionable', 'Prime'].map((t, i) => `<span class="chip ${i === 2 ? 'emph' : ''}" style="${i === 3 ? 'border: 1px solid var(--amber); background: transparent; color: var(--amber-text);' : ''}">${t}</span>${i < 3 ? '<span class="dim">→</span>' : ''}`).join('')}<span style="margin-left: auto;">0–100 triage score · not a trade signal</span></div>
  </div>`;

  const readVisual = `<div class="panel" style="overflow: hidden;">
    <div style="display: flex; align-items: center; gap: 8px; padding: 12px 16px 10px; border-bottom: 1px solid var(--line); flex-wrap: wrap;"><div style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; background: var(--amber-tint); color: var(--amber-text);">${icon('sparkle', 14)}</div><h3 style="margin: 0; font-size: 13.5px; font-weight: 600;">AI read · SPY</h3><span class="chip outline" style="font-size: 11px;">SIMULATED</span><span style="flex: 1;"></span><span class="mono" style="font-size: 11px; color: var(--steel);">as of 10:41:52 ET</span></div>
    <div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px;">
      <div><div class="display" style="font-size: 26px;"><span class="amber">Trade</span><span class="dim" style="font-weight: 500;"> · </span>Bullish</div><div style="font-size: 12.5px; margin-top: 3px;"><strong style="font-weight: 600;">Bull call spread</strong> · <span class="mono">575 / 580</span> · Sep 18 · <span class="chip emph" style="height: 20px;">high</span></div></div>
      <div class="grid-2" style="gap: 8px;">${[['Max risk', '$420', '1.7% of account', true], ['Invalidation', '568.50', 'the gamma flip', true], ['Entry', 'near 573', 'pullback to VWAP', true], ['Target', '579.50', 'AI-stated · untraced', false]].map(([l, v, s, t]) => `<div style="padding: 10px 12px; border-radius: 10px; background: var(--ink-2); border: 1px solid var(--line);"><span class="caps">${l}</span><div class="${t ? 'mono' : 'sans'}" style="font-size: 18px; margin-top: 3px; ${t ? '' : 'border-bottom: 1px dotted var(--steel-2); display: inline-block;'}">${v}</div><div style="font-size: 11px; color: var(--steel); margin-top: 3px;">${s}</div></div>`).join('')}</div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;"><button class="btn primary" style="flex: 1 1 180px;">Review simulated trade</button><button class="btn secondary">Full analysis</button></div>
    </div>
  </div>`;

  const honesty = `
  <section class="wrap honesty">
    <div><span class="caps" style="color: var(--amber-text);">Honest by design</span><h2 class="display">Numbers say where they came from.</h2><p style="margin: 12px 0 0; font-size: 15px; color: var(--steel); line-height: 1.6;">Every surface carries its basis. If you can’t tell whether a figure is live, a snapshot, or the model’s own guess, we have failed — so the type itself tells you.</p><a href="#" class="btn secondary" style="margin-top: 18px;">Read the methodology ${icon('arrow', 14)}</a></div>
    <div class="honesty-cards">
      ${[
        ['clock', 'Snapshot, never live', 'Structure — score, tier, walls, the flip — recomputes on a stated cadence: about a minute on a ticker desk, about three minutes across the scanner. Prices and the mid stream live and are labelled as tape. The two speeds never blur.'],
        ['shield', 'Simulated, always', 'The sim book is paper: no slippage, no partial fills, nothing sent to a broker. A connected brokerage is read-only. Convexa never places an order.'],
        ['sparkle', 'Advisory, never an order', 'The AI read runs on your own key, pins to a snapshot, and cites what it used. Figures it could not trace render in body type. You confirm every paper trade.'],
      ].map(([ic, t, b]) => `<div class="panel quiet" style="padding: 18px; display: flex; flex-direction: column; gap: 10px;"><span style="display: inline-flex; width: 32px; height: 32px; border-radius: 9px; background: var(--raised); color: var(--amber-text); align-items: center; justify-content: center;">${icon(ic, 16)}</span><h3 style="margin: 0; font-size: 15px; font-weight: 600;">${t}</h3><p style="margin: 0; font-size: 13px; color: var(--steel); line-height: 1.55;">${b}</p></div>`).join('')}
    </div>
  </section>`;

  const cta = `
  <section class="wrap" style="padding-top: 80px;">
    <div class="panel cta-band" style="background-image: radial-gradient(60% 120% at 90% 10%, var(--amber-tint), transparent 60%), var(--sheen);">
      <div><h2 class="display" style="margin: 0; font-size: clamp(24px, 2.4vw, 32px); letter-spacing: -0.02em;">Open any ticker. No account, no card.</h2><p style="margin: 10px 0 0; font-size: 15px; color: var(--steel); line-height: 1.6; max-width: 560px;">The full structure desk is free. Sign up when you want the Scanner across 69 tracked names, a simulated book that persists, and AI reads on your own key.</p></div>
      <div style="display: flex; flex-direction: column; gap: 10px; align-items: stretch;"><a href="#" class="btn primary lg">Open the Ticker ${icon('arrow', 16)}</a><a href="#" class="btn secondary lg">Create an account</a><span style="font-size: 11.5px; color: var(--steel-2); text-align: center;">Brokerage connect (read-only) is coming — <a href="#">get notified</a>.</span></div>
    </div>
  </section>`;

  return `<div data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${nav({ active: '', signedIn: false, live: true })}
    ${hero}
    ${deskStrip}
    ${feature('Where is price pulled?', 'Walls, the flip, the magnet — drawn as a field, not a table.', 'Dealer hedging creates structure you can see: a call wall that caps, a put wall that catches, and a gamma flip where hedging turns from dampening to amplifying. The structure field plots net dealer gamma by strike and drops the live mid onto it, so you read where price is attracted or repelled at a glance.', fieldVisual, false, ['Levels refresh about every minute on the desk and carry their as-of', 'The mid is tape — it pulses only while the stream is genuinely live', 'Magnet view shows the same levels as a pull, for the visual thinkers'])}
    ${feature('Is there an edge right now?', 'A triage score that is honest about what it is.', 'Proximity to a wall or the flip, IV against realised vol, active setups, a flip transition and optional dark-pool confluence roll into a 0–100 score and a tier. It ranks names for a deeper look. It is not a trade signal, and it never uses the advisory reads.', edgeVisual, true, ['Dormant → Watch → Actionable → Prime', 'Every component of the score is inspectable in the Scanner', 'Context reads (flow, vol, ATR) stay advisory — never score inputs'])}
    ${feature('What would I risk?', 'A risk-first read, on your own key, grounded in the structure.', 'Ask for a read and get the verdict first — trade or no trade — then max risk, invalidation, entry and target before a single paragraph of rationale. Figures that trace to Convexa render in mono; the model’s own numbers render in body type so you always know whose number you are looking at.', readVisual, false, ['Pinned to a snapshot; a newer one is flagged, never silently swapped', 'Your persona frames the read; your risk inputs cap the size', 'Accept it into a simulated trade — nothing is saved until you confirm'])}
    ${honesty}
    ${cta}
    ${footer()}
  </div>`;
}
