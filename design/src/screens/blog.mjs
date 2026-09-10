// Blog index and the instrument Lab — two small public surfaces that must wear the same identity.
import { footer, icon, magnetView, nav, seq, sparkline, structureField, termRibbon } from '../lib.mjs';

export const BLOG_CSS = `
  .blog-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 14px; align-items: stretch; }
  .lab-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  @media (max-width: 999px) { .blog-grid { grid-template-columns: 1fr 1fr; } .blog-grid > *:first-child { grid-column: 1 / -1; } .lab-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 599px) { .blog-grid, .lab-grid { grid-template-columns: 1fr; } }
`;

export function blogBody({ minHeight = 900 } = {}) {
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${nav({ active: '' })}
    <section class="wrap" style="padding-top: 32px;">
      <span class="caps" style="color: var(--amber-text);">Blog</span>
      <h1 class="display" style="margin: 8px 0 0; font-size: clamp(28px, 3vw, 40px); letter-spacing: -0.02em;">How we read structure</h1>
      <p style="margin: 10px 0 0; font-size: 15px; color: var(--steel); max-width: 680px; line-height: 1.6;">Dealer structure, score honesty, and the two clocks on the desk. The longer form of the in-app Methodology page. Articles render in the app theme — ink, Plex, one amber — never a separate template.</p>
      <div class="blog-grid" style="margin-top: 24px;">
        <a href="#" class="panel" style="display: flex; flex-direction: column; gap: 12px; padding: 22px; text-decoration: none; color: inherit; overflow: hidden;">
          <div class="well" style="border: 1px solid var(--line); border-radius: 10px; padding: 6px 4px 0; margin: -4px -4px 4px;">${structureField({ width: 720, height: 200, id: 'bg', showLabels: false })}</div>
          <span class="chip outline" style="align-self: flex-start;">Methodology</span>
          <h2 class="display" style="margin: 0; font-size: clamp(20px, 2vw, 26px);">How We Read Dealer Structure</h2>
          <p style="margin: 0; font-size: 13.5px; color: var(--steel); line-height: 1.55;">Walls, the gamma flip, GEX, score, and two data speeds — what Convexa actually computes, on what basis, and where the read is weak.</p>
          <span style="margin-top: auto; font-size: 12.5px; font-weight: 600; color: var(--signal);">Read the post →</span>
        </a>
        ${[['Draft · not yet published', 'Why a no-trade read is a complete answer', 'A working title for the next post — the slot shows how the index grows.'], ['Draft · not yet published', 'Two clocks: tape, structure, and what “live” means', 'A working title for a later post — same card, same theme.']].map(([tag, t, d]) => `<div class="panel quiet" style="display: flex; flex-direction: column; gap: 10px; padding: 20px; border-style: dashed;"><span class="chip outline" style="align-self: flex-start;">${tag}</span><h2 style="margin: 0; font-size: 17px; font-weight: 700; line-height: 1.3;">${t}</h2><p style="margin: 0; font-size: 12.5px; color: var(--steel-2);">${d}</p></div>`).join('')}
      </div>
      <div class="panel quiet" style="margin-top: 16px; padding: 14px 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 12.5px; color: var(--steel);">${icon('book', 16)}<span style="flex: 1 1 320px;">The static article template adopts the tokens: ink canvas, Plex body, Archivo display, amber links only for actions. The cream page and system font found in the July review are retired.</span><a href="#" class="btn secondary sm">Read the methodology</a></div>
    </section>
    ${footer()}
  </div>`;
}

export function labBody({ minHeight = 900 } = {}) {
  const ribbons = `<svg viewBox="0 0 320 90" preserveAspectRatio="none" style="display: block; width: 100%; height: 90px;" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<path d="M 0 ${30 + i * 12} C 60 ${10 + i * 12}, 100 ${50 + i * 12}, 160 ${30 + i * 12} S 260 ${10 + i * 12}, 320 ${34 + i * 12}" fill="none" stroke="${i % 2 ? 'var(--signal)' : 'var(--amber)'}" stroke-opacity="${(0.9 - i * 0.18).toFixed(2)}" stroke-width="2" class="trail"></path>`).join('')}</svg>`;
  const demos = [
    ['Structure Field', 'Dual-clock dealer net-GEX field — walls, flip, tape mid, probe.', 'GEX strike profile', 'shipped', `<div class="well" style="padding: 4px 2px 0;">${structureField({ width: 420, height: 150, id: 'lab1', showLabels: false })}</div>`],
    ['Tape Pulse', 'Mid trail + last-print flashes on a dual-clock tape strip.', 'Live tape · masthead mid', 'lab', `<div style="padding: 14px 12px;">${sparkline(seq(40, 7, 573, 0.3), { width: 320, height: 60, color: 'var(--signal)', dot: true, cls: 'trail', fluid: true })}</div>`],
    ['Wall Magnet', 'Spot pulled between put/call walls with the flip as the polarity line.', 'Dealer positioning levels', 'lab', `<div class="well" style="padding: 4px 0 0;">${magnetView({ width: 420, height: 150, compact: true })}</div>`],
    ['Term Heat', 'Cross-tenor vol as a glowing heat ribbon (contango / back).', 'Term structure card', 'lab', `<div style="padding: 18px 14px 10px;">${termRibbon({ width: 320, height: 54 })}</div>`],
    ['Flow Ribbons', 'Charm + vanna projected flow as layered streaming ribbons.', 'Projected dealer flow', 'lab', `<div style="padding: 10px 8px 4px;">${ribbons}</div>`],
  ];
  return `<div class="is-live" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${nav({ active: '' })}
    <section class="wrap" style="padding-top: 32px;">
      <span class="chip emph" style="height: 24px;">${icon('flask', 13)} Lab</span>
      <h1 class="display" style="margin: 10px 0 0; font-size: clamp(28px, 3vw, 40px); letter-spacing: -0.02em;">Instrument lab</h1>
      <p style="margin: 10px 0 0; font-size: 15px; color: var(--steel); max-width: 720px; line-height: 1.6;">Canvas and WebGL experiments for the ticker desk. Each demo is a candidate surface — dual-clock honesty, brand tokens, reduced motion. Synthetic data by default so you can feel the instrument without a live chain.</p>
      <div class="lab-grid" style="margin-top: 24px;">
        ${demos.map(([t, tag, cand, st, vis]) => `<a href="#" class="panel" style="display: flex; flex-direction: column; text-decoration: none; color: inherit; overflow: hidden;">
          <div style="border-bottom: 1px solid var(--line);">${vis}</div>
          <div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><h2 style="margin: 0; font-size: 15px; font-weight: 700;">${t}</h2><span class="chip ${st === 'shipped' ? 'emph' : 'outline'}">${st}</span></div>
            <p style="margin: 0; font-size: 12.5px; color: var(--steel); line-height: 1.5;">${tag}</p>
            <span style="margin-top: auto; font-size: 11px; color: var(--steel-2);">Candidate for · ${cand}</span>
          </div>
        </a>`).join('')}
        <div class="panel quiet" style="display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 20px; border-style: dashed;"><span class="caps">Honesty</span><p style="margin: 0; font-size: 12.5px; color: var(--steel); line-height: 1.5;">Demos never claim live gamma. Every instrument keeps the structure clock and the tape clock visibly separate, and stops moving under reduced motion.</p></div>
      </div>
    </section>
    ${footer()}
  </div>`;
}
