// Final · Convexa v1 — the AI read in depth (deep group, row `ai-read`). Renderers for the full-analysis
// drawer and the export drawer over the demo desk, the phone read sheet (peek and open), the production
// Not live page and the states board. Values match the desk row's staging boards (ticker-desk.mjs: SPY on
// the Oct 7 scenario, spot 690.62, flip 683.92, call wall 704.02, put wall 652.22, ±$2.48 to Oct 9 (the demo's own levels), the
// "No trade · sit this one out" sample read, graded not applicable as the API grades a no-trade read). Copy reuses the shipped strings in
// apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts wherever the final design keeps them.
import { icon, finalPage, STAGING_DEMO_URL } from '../../lib.mjs';
import { chartFrame, stateBody } from '../../chart-kit.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { deskStagingBody } from './ticker-desk.mjs';

export const DR_CSS = `
  .dr-wrap { position: relative; width: 100%; overflow: hidden; background: var(--ink); color: var(--phosphor); }
  .dr-behind { position: absolute; inset: 0; overflow: hidden; filter: blur(2px); opacity: 0.55; pointer-events: none; }
  .dr-scrim { position: absolute; inset: 0; background: var(--scrim); }
  .dr-dw { position: absolute; top: 0; right: 0; bottom: 0; width: 560px; max-width: 100%; background: var(--panel); border-left: 1px solid var(--line); box-shadow: var(--e4); display: flex; flex-direction: column; }
  .dr-dw.narrow { width: 420px; }
  .dr-dw .dh { position: sticky; top: 0; display: flex; align-items: center; gap: 10px; padding: 16px 20px; border-bottom: 1px solid var(--line); background: var(--panel); }
  .dr-dw .dh h2 { margin: 0; font-size: 16px; font-weight: 700; flex: 1 1 auto; min-width: 0; }
  .dr-dw .db { padding: 18px 20px 24px; display: flex; flex-direction: column; gap: 18px; }
  .dr-sec { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line); }
  .dr-sec:first-child { border-top: 0; padding-top: 0; }
  .dr-sec ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.55; }
  .dr-sec p { margin: 0; font-size: 13px; line-height: 1.55; }
  .dr-lv { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .dr-lv th { text-align: left; font: 600 11px 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 4px 6px; border-bottom: 1px solid var(--line-2); }
  .dr-lv td { padding: 6px; border-bottom: 1px solid var(--line); font-family: 'IBM Plex Mono', monospace; }
  .dr-lv td:first-child { font-family: 'IBM Plex Sans', sans-serif; }
  .dr-fig { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .dr-fig > div { background: var(--ink-2); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .dr-fig .v { font: 500 16px/1.2 'IBM Plex Mono', monospace; }
  .dr-fig .v.u { font-family: 'IBM Plex Sans', sans-serif; border-bottom: 1px dotted var(--steel-2); align-self: flex-start; }
  .dr-fig .v.n { color: var(--steel); }
  .dr-note { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: var(--raised); font-size: 12px; line-height: 1.45; color: var(--steel); }
  .dr-note strong { color: var(--phosphor); font-weight: 600; }
  .dr-dw.ex { width: 520px; }
  .dr-dw.ex .dh { position: static; flex: none; gap: 8px; padding: 14px 18px; }
  .dr-dw.ex .dh h2 { line-height: 1.65; text-wrap: wrap; }
  .dr-dw.ex .dh .btn { width: 30px; padding: 0; }
  .dr-dw.ex .db { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 16px 18px; gap: 14px; }
  .dr-dw.ex .df { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--line); background: var(--panel); }
  .dr-xl { margin: 0; font-size: 12px; line-height: 1.45; color: var(--steel); }
  .dr-xs { font: 400 11px/1.65 'IBM Plex Mono', monospace; color: var(--steel); }
  .dr-dw.ex .dr-xc { gap: 0; flex: none; padding: 18px 20px; }
  .dr-xc .t { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .dr-xc .t b { font-size: 13px; font-weight: 600; line-height: 1.65; }
  .dr-xc .cp { font: 600 11px/24px 'IBM Plex Sans', sans-serif; color: var(--amber-text); background: none; border: 0; padding: 2px; border-radius: 8px; }
  .dr-xc .cap { margin: 2px 0 0; font-size: 11px; line-height: 1.4; color: var(--steel); }
  .dr-xc pre { margin: 6px 0 0; max-height: 220px; overflow: auto; border-radius: 4px; font: 11.5px/1.6 'IBM Plex Mono', monospace; color: var(--steel); white-space: pre-wrap; word-break: break-word; }
  .dr-xc pre[role="region"] { padding: 10px 12px; border-radius: 8px; background: var(--ink); border: 1px solid var(--line); }
  .dr-xc .ns { margin: 4px 0 0; font-size: 12px; line-height: 1.65; color: var(--steel); }
  @media (pointer: coarse) { .dr-xc .cp { min-width: 44px; min-height: 44px; } }
  @media (max-width: 599px) { .dr-dw.ex { border-radius: 0 !important; } .dr-dw.ex .dh .btn { flex: none; width: 44px; height: 44px; padding: 0; } .dr-dw.ex .df .btn { flex: 1 1 100%; height: 44px; } }
  .dr-peek { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; display: flex; align-items: center; gap: 12px; min-height: 72px; padding: 10px 16px; margin: 0; background: var(--panel); color: var(--phosphor); font: inherit; text-align: left; border: 0; border-top: 1px solid var(--line-2); box-shadow: var(--e4); cursor: pointer; }
  .dr-peek .col { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; flex: 1 1 auto; min-width: 0; }
  .dr-peek .w { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 17px; letter-spacing: -0.01em; white-space: nowrap; }
  .dr-sheet { position: relative; background: var(--panel); border-radius: 16px 16px 0 0; border-top: 1px solid var(--line-2); box-shadow: var(--e4); }
  .dr-sheet .grab { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0 4px; border-bottom: 1px solid var(--line); }
  .dr-sheet .grab::before { content: ''; width: 36px; height: 4px; border-radius: 2px; background: var(--line-2); }
  .dr-sheet .grab .btn { min-height: 44px; min-width: 44px; justify-content: center; }
  .dr-sheet .bd { padding: 14px 16px 28px; display: flex; flex-direction: column; gap: 14px; }
  .dr-sheet .btn { min-height: 44px; }
  .dr-ghost { border: 1px solid var(--line); border-radius: 8px; }
  .dr-nl { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  .dr-mini { display: flex; flex-direction: column; gap: 10px; }
  .dr-mini p { margin: 0; }
  .dr-mini .vd { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 22px; line-height: 1.15; letter-spacing: -0.01em; margin: 0; }
  .dr-mini .vd.amber { color: var(--amber-text); }
  .dr-mini .acts { display: flex; flex-wrap: wrap; gap: 8px; }
  .dr-steps { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--steel); }
  .dr-steps span { display: flex; align-items: center; gap: 6px; }
  .dr-reasons { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 12px; font-size: 12px; }
  .dr-reasons .mono { color: var(--steel); }
  @media (max-width: 899px) { .dr-nl { grid-template-columns: 1fr; } }
`;

const ASOF = 'Oct 7, 2026 · 2:30 PM ET';
const SAMPLE_NOTE = 'This is an authored example. No model was called and nothing is sent. A read, not an order.';
const demoDesk = (t = 'NVDA') => `${STAGING_DEMO_URL}/ticker/${t}`;
const caps = (t) => `<span class="caps">${t}</span>`;
const closeBtn = (label) => `<button class="btn ghost sm" type="button" aria-label="${label}">${icon('close', 16)}</button>`;

/** The demo desk behind an overlay, blurred and inert, clipped to the board. */
const behindDesk = (scheme, w = '') => `<div class="dr-behind" aria-hidden="true"${w ? ` style="width: ${w};"` : ''}>${deskStagingBody({ scheme })}</div><div class="dr-scrim" aria-hidden="true"></div>`;

const WHY = ['Spot is <span class="mono">+1.0%</span> above the flip at <span class="mono">683.92</span>: <span class="mono">+γ</span>, dealer hedging tends to damp moves here.', 'The <span class="mono">704.02</span> call wall sits outside the <span class="mono">±$2.48</span> implied move.', 'Flow over the last hour nets to about zero.'];
const REENGAGE = ['Spot closes below the flip at <span class="mono">683.92</span>, where hedging turns <span class="mono">−γ</span>.', 'Or the call wall moves inside the implied move on the next structure refresh.'];
const ul = (xs) => `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`;
// A no-trade read states no entry, so the API grades its grounding not_applicable (grounding.rs:351):
// no trace line on the panel, dashes in the drawer (2026-10-16, build round lane 4 review).
const UNCHECKED = `<p class="dline" style="margin: 0; font-size: 12px;">Numbers written out in this reasoning aren’t checked — only the stop, target and invalidation level above are.</p>`;
const NA_FIGS = `<div class="dr-fig"><div>${caps('Stop')}<span class="v">—</span></div><div>${caps('Target')}<span class="v">—</span></div><div>${caps('Invalidation')}<span class="v">—</span></div></div>`;

// =================================================================================================
// Staging · the full analysis drawer (AnalysisSurface) over the demo desk
// =================================================================================================
function analysisDrawer() {
  const lv = [['Call wall', '704.02', '+1.9%', '+γ'], ['Spot · levels anchor', '690.62', '—', ''], ['Gamma flip', '683.92', '−1.0%', '±'], ['Put wall', '652.22', '−5.6%', '−γ']];
  return `<aside class="dr-dw" role="dialog" aria-modal="true" aria-labelledby="dr-an-t"><div class="dh"><h2 id="dr-an-t">Full analysis &amp; data · SPY</h2>${stateTag('sample', 'Sample read')}${closeBtn('Close analysis')}</div>
    <div class="db">
      <section class="dr-sec" aria-label="Read summary">${caps('Read summary')}
        <p class="tk-verdict" style="font-size: 26px;">No trade · sit this one out</p>
        <span class="dline">Persona · Careful sample reader · As of ${ASOF}</span>
        <div class="hd-fig" style="grid-template-columns: repeat(4, minmax(0, 1fr));"><div>${caps('Structure')}<span class="v" style="font-size: 15px;">—</span></div><div>${caps('Expiration')}<span class="v" style="font-size: 15px;">—</span></div><div>${caps('Time horizon')}<span class="v" style="font-size: 15px;">—</span></div><div>${caps('Confidence')}<span class="v" style="font-size: 15px; font-family: 'IBM Plex Sans';">Low</span></div></div>
        <span class="dline">No entry, so there is nothing to size: a dash here is the answer, not missing data.</span>
      </section>
      <section class="dr-sec" aria-label="Analyst read">${caps('Analyst read')}
        <p>Spot sits between the flip and the call wall with no directional flow. “No trade” is a complete answer: nothing in this snapshot is worth the risk of a position.</p>
        <span class="caps" style="margin-top: 4px;">Why</span>${ul(WHY)}
        <span class="caps" style="margin-top: 4px;">Re-engage when</span>${ul(REENGAGE)}
      </section>
      <section class="dr-sec" aria-label="Levels in play">${caps('Levels in play')}
        <table class="dr-lv"><thead><tr><th scope="col">Level</th><th scope="col">Price</th><th scope="col">From spot</th><th scope="col">Side</th></tr></thead><tbody>${lv.map(([l, p, d, s]) => `<tr><td>${l}</td><td>${p}</td><td>${d}</td><td>${s || '—'}</td></tr>`).join('')}</tbody></table>
      </section>
      <section class="dr-sec" aria-label="What the numbers said">${caps('What the numbers said')}
        <p class="mono" style="font-size: 12.5px;">±$2.48 (±0.4%) implied move to Oct 9 · ATM straddle</p>
        <span class="dline">Candidate contracts: shaped like the scenario’s chain; none are sent anywhere.</span>
      </section>
      <section class="dr-sec" aria-label="Cited contract and grounding">${caps('Cited contract and grounding')}
        <span class="dline">No contract cited: a no-trade read names none. Stop, target and invalidation read “—”, and the grounding check does not apply: the API checks a read’s figures only when it states an entry.</span>
        ${NA_FIGS}
        <span class="mono steel" style="font-size: 11px;">Checked 0 · traced 0 · untraced 0 · not checkable 0</span>
      </section>
      <section class="dr-sec" aria-label="Cap check and inputs">${caps('Cap check and as-sent inputs')}
        <p class="dline" style="font-size: 12.5px;">Cap check: not applicable, no entry. Your sample risk inputs ($25,000 · 2% → $500 per trade) and the seeded paper book stay in this browser: the demo calls no model, so nothing was sent.</p>
      </section>
      <section class="dr-sec" style="gap: 10px;">
        <div style="display: flex; flex-wrap: wrap; gap: 8px;"><button class="btn secondary" type="button">View sample export ${icon('arrow', 14)}</button><button class="btn ghost" type="button">${icon('bell', 14)}Alert me at the flip</button></div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${provChip('Sample · shaped like an AI read', 'dashed')}<span class="cf-asof">Scenario · ${ASOF}</span></div>
        <p class="dline">${SAMPLE_NOTE}</p>
      </section>
    </div></aside>`;
}
export const analysisBody = ({ minHeight = 0, scheme = 'dark' } = {}) =>
  `<div class="v4 dr-wrap" data-scheme="${scheme}" style="height: ${Math.max(minHeight, 1500)}px;">${behindDesk(scheme)}${analysisDrawer()}</div>`;

// =================================================================================================
// Staging · the sample export drawer (StateExportDrawer) over the demo desk, as shipped (fidelity ACC-10 and
// ACC-21, a1ce2b3d and aa2a48b5): 520 wide (the full width under 600px), a fixed head with the Sample tag, a
// body that scrolls, and a footer with the outlined Copy all and its note. The body leads with the egress
// sentence (no tinted banner) and the scenario line; each category is a sample card (dashed steel2 border,
// radius 12, 18px 20px, the 8px top hatch band in steel at 28%, NO-14 B). A card whose text was built has
// its COPY; the three the demo leaves unsent say why and carry none. Text that fits sits unboxed in its card;
// text over the 220px cap (the computed snapshot) is the bordered, focusable scroll well. Copy reuses the
// shipped strings (copy.ts, StateExportDrawer.tsx) and the demo's own export (libs/api demo transport).
// =================================================================================================
/** The demo's computed snapshot (the export's `context`), serialized as the drawer shows it. */
const EXPORT_CONTEXT = {
  market_state: {
    ticker: 'SPY', spot: 690.62, as_of: '2026-10-07T18:30:00Z', call_wall: 704.02, put_wall: 652.22, gamma_flip: 683.92, max_pain: 690.62, setup: 'Balanced structure', score: 74,
    sample_analysis: 'Sample analysis · authored for this scenario. SPY shows balanced structure with authored score 74. Fingerprint spy-synthetic-variant-7-v1; source bar portfolio-2026-10-07-v1:SPY:2026-10-07. This is educational scenario copy, not a forecast, provider-generated response, or executable instruction. No market, broker, or AI provider was used.',
  },
  candidates: {
    ticker: 'SPY', state: 'unavailable', as_of: '2026-10-07T18:30:00Z', anchor_basis: 'gex_spot', anchor_spot: 690.62, session_basis: 'rth', snapshot_age_seconds: 0, quote_age: 'not_available', band_pct: 10, budget: 'handoff',
    caps: { max_bytes: 0, max_records: 0, rights: 2, strikes_per_tenor_right: 0, tenors: 3 },
    contracts: [],
    included: { contracts: 0, expiration_count: 0, expirations: [] },
    omitted: { total: 0, expirations_omitted_by_cap: 0, by_reason: { expiration_cap: 0, no_interest: 0, outside_band: 0, outside_window: 0, strike_cap: 0 } },
    liquidity: { atm_relative_spread_band: 'unknown', no_two_sided_quote: 0, quoted: 0, wide_quote_threshold_pct: 15, wide_quotes: false },
    sent_to_model: false,
  },
  risk_inputs: { state: 'not_set', account_size: null, per_trade_cap: null, effective_dollar_cap: { state: 'not_set', value: null, not_derivable_reason: null, derived_from: { account_size: null, cap_value: null, cap_unit: null } }, storage_available: true, updated_at: null },
  open_positions: { source: 'simulated', state: 'not_sent', this_underlying: null, portfolio: null },
};
const EXPORT_GLOSSARY = ['spot: the underlying’s close at the scenario snapshot', 'call_wall / put_wall: the strikes with the largest call and put dealer gamma', 'gamma_flip: where net dealer gamma changes sign', 'max_pain: the strike where open options would expire worth the least', 'score: the scanner’s 0–100 score for the setup'].join('\n');
function exportDrawer() {
  const card = (title, inner) => `<section class="hd-p is-sample dr-xc" aria-label="${title}">${inner}</section>`;
  const sent = (title, text, { caption = '', well = false } = {}) => card(title, `<div class="t"><b>${title}</b><button class="cp" type="button" aria-label="Copy ${title}">COPY</button></div>${caption ? `<p class="cap">${caption}</p>` : ''}<pre${well ? ` role="region" tabindex="0" aria-label="${title} export text"` : ''}>${text}</pre>`);
  const notSent = (title) => card(title, `<div class="t"><b>${title}</b></div><p class="ns">Not sent: the demo calls no model, so nothing leaves this browser.</p>`);
  return `<aside class="dr-dw ex" role="dialog" aria-modal="true" aria-labelledby="dr-ex-t"><div class="dh"><h2 id="dr-ex-t">Sample analysis export · SPY</h2>${stateTag('sample')}${closeBtn('Close export')}</div>
    <div class="db">
      <p class="dr-xl" role="status">No content was sent to a model or external provider. This export contains authored sample context only.</p>
      <span class="dr-xs">Scenario · ${ASOF} · Sample analysis · authored for this scenario</span>
      ${sent('Computed snapshot (context)', JSON.stringify(EXPORT_CONTEXT, null, 2), { caption: 'A serialization of what Convexa already computed — no recompute, no new fetch. Null stays null.', well: true })}
      ${notSent('Candidate contracts')}
      ${notSent('Your risk inputs (as sent with this recommendation)')}
      ${notSent('Open positions')}
      ${sent('Persona prompt', '—', { caption: 'The demo builds no persona prompt; the sample read is authored.' })}
      ${sent('Field glossary', EXPORT_GLOSSARY)}
    </div>
    <div class="df"><button class="btn secondary" type="button">${icon('copy', 16)}Copy all</button><span class="dr-xl">Copies the sample, labelled as one.</span></div></aside>`;
}
export const exportBody = ({ minHeight = 0, scheme = 'dark' } = {}) =>
  `<div class="v4 dr-wrap" data-scheme="${scheme}" style="height: ${Math.max(minHeight, 1220)}px;">${behindDesk(scheme)}${exportDrawer()}</div>`;

// =================================================================================================
// Phone (390, staging) · the read sheet: peek row, and open
// =================================================================================================
export function peekBody({ minHeight = 0, scheme = 'dark' } = {}) {
  return `<div class="v4 dr-wrap" data-scheme="${scheme}" style="height: ${Math.max(minHeight, 900)}px;">
    <div style="position: absolute; inset: 0 0 72px; overflow: hidden;">${deskStagingBody({ scheme })}</div>
    <button class="dr-peek" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="No trade · sit this one out. Open the AI read"><span class="col">${stateTag('sample', 'Sample read')}<span class="w">No trade · sit this one out</span></span><span class="steel" style="display: inline-flex;">${icon('up', 18)}</span></button>
  </div>`;
}
export function sheetBody({ minHeight = 0, scheme = 'dark' } = {}) {
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    <div class="dr-wrap" style="height: 168px;"><div style="position: absolute; inset: 0; overflow: hidden;" aria-hidden="true">${deskStagingBody({ scheme })}</div><div class="dr-scrim"></div></div>
    <section class="dr-sheet" role="dialog" aria-modal="true" aria-label="Sample analysis · SPY" style="margin-top: -16px;">
      <div class="grab"><button class="btn ghost sm" type="button" aria-label="Minimize the AI read">${icon('chevron', 18)}</button></div>
      <div class="bd">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: var(--raised-2);">${icon('sparkle', 15)}</span><h3 style="margin: 0; font-size: 15px; flex: 1 1 auto;">Sample analysis · SPY</h3>${stateTag('sample', 'Sample read')}</div>
        <a href="#whats-sent" class="t-info" style="font-size: 13px; font-weight: 500; min-height: 44px; display: inline-flex; align-items: center;">View sample export →</a>
        <span class="mono steel" style="font-size: 11px;">Pinned to the scenario snapshot · ${ASOF} · Careful sample reader</span>
        <p class="tk-verdict" style="font-size: 24px;">No trade · sit this one out</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.55;">Spot sits between the flip and the call wall with no directional flow. “No trade” is a complete answer.</p>
        <div class="dr-sec" style="border-top: 0; padding-top: 0;"><span class="caps">Why</span>${ul(WHY)}<span class="caps" style="margin-top: 4px;">Re-engage when</span>${ul(REENGAGE)}</div>
        ${UNCHECKED}
        <button class="btn secondary" type="button" style="width: 100%;">${icon('bell', 14)}Alert me at the flip</button>
        <button class="btn ghost" type="button" style="width: 100%;">Full analysis &amp; data ${icon('arrow', 14)}</button>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${provChip('Sample · shaped like an AI read', 'dashed')}<span class="cf-asof">Scenario · Oct 7, 2026</span></div>
        <p class="dline" style="margin: 0;">${SAMPLE_NOTE}</p>
      </div>
    </section>
  </div>`;
}

// =================================================================================================
// Production · the AI read is Not live (NVDA, signed out)
// =================================================================================================
const outline = (h, w = '100%') => `<span class="dr-ghost" aria-hidden="true" style="display: block; height: ${h}px; width: ${w};"></span>`;
export function productionBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const t = 'NVDA';
  const tabs = `<nav aria-label="${t}" class="hd-tabs">${[['Overview', ''], ['Technical', '/technical-analysis'], ['Research', '/research']].map(([n, h]) => `<a href="/ticker/${t}${h}"${n === 'Overview' ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;
  const anatomy = `<div class="dr-mini" aria-hidden="true" style="opacity: 0.9;">${outline(14, '46%')}${outline(30, '70%')}${outline(12, '90%')}<div class="dr-fig">${['Max risk', 'Invalidation', 'Entry', 'Target'].map((l) => `<div>${caps(l)}<span class="v n">—</span></div>`).join('')}</div>${outline(56)}</div>`;
  const panel = `<section class="hd-p" aria-label="AI read, not live"><div class="ph"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: var(--raised-2);">${icon('sparkle', 15)}</span><h3>AI read · ${t}</h3>${stateTag('notLive')}</div>
    <div class="dr-nl"><div class="dr-mini">
      <p class="dline" style="font-size: 13.5px;"><strong style="color: var(--phosphor);">Would show</strong> a verdict-first read of ${t}’s dealer structure: Trade or No trade, the risk before the rationale (max risk, invalidation, entry, target), why, and when to look again. Every figure says whether it traces to a Convexa number.</p>
      <p class="dline" style="font-size: 13.5px;"><strong style="color: var(--phosphor);">Off because</strong> a read reads the options structure (walls, flip, flow, the candidate contracts), which needs the paid options feed this site doesn’t run. Without the structure there is nothing honest to analyze.</p>
      <p class="dline" style="font-size: 13.5px;">On a build with the feed, reads run on your own provider key (Anthropic, OpenAI, Gemini or Grok) after you sign in. No read ever places an order.</p>
      <a href="${demoDesk(t)}" class="t-info" style="display: inline-flex; align-items: center; min-height: 24px; font-size: 14px; font-weight: 500;">See it on the demo →</a>
    </div>${anatomy}</div></section>`;
  const sent = `<section class="hd-p" aria-label="What a read sends"><div class="ph"><h3>What a read sends</h3>${stateTag('notLive', 'Nothing sent')}</div>
    <p class="dline" style="font-size: 13px;">Nothing leaves this site right now: no read runs without the options feed. When one does, it sends exactly this, and the export drawer shows it before you ask:</p>
    <div class="hd-list">${[['The computed snapshot', 'levels, regime, score, implied move'], ['Candidate contracts', 'the set in the read’s DTE band'], ['Your risk inputs', 'account size and per-trade cap, if set'], ['Open simulated positions', 'this ticker only, from this browser'], ['The persona’s prompt and a field glossary', '']].map(([a, b]) => `<div><span style="font-size: 13px;">${a}</span><span class="dline" style="font-size: 12px; text-align: right;">${b}</span></div>`).join('')}</div>
    <p class="dline">Never: another ticker, your name or email, broker credentials, or an API key.</p></section>`;
  const how = `<section class="hd-p" aria-label="How a read works"><div class="ph"><h3>How a read works</h3></div><ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.55;"><li>You ask; it never runs on its own, and it is pinned to the snapshot it read.</li><li>“No trade” is a complete answer, drawn with the same weight as a trade.</li><li>A newer snapshot marks the read as older; it never refreshes itself.</li><li>A read, not an order: a simulated trade needs your review and confirm.</li></ul><a href="/methodology#ai" class="t-info" style="font-size: 13px;">How Convexa works →</a></section>`;
  const main = `<div class="wrap tkd">
    <div class="tk-mast"><div class="who"><div style="display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;"><h1 class="display">${t}</h1><span class="steel" style="font-size: 14px;">NVIDIA · Nasdaq · Semiconductors</span></div></div><div class="act">${tabs}</div></div>
    <div class="tk-zone"><h2 class="display">AI read</h2><span class="dline" style="font-size: 13px;">Part of the desk’s “Needs the options feed” zone; shown alone here.</span></div>
    ${panel}<div class="tk-row" style="align-items: start;">${sent}${how}</div>
    <p class="dline" style="margin: 0;">Research and tools, not investment advice.</p></div>`;
  return finalPage({ scheme, minHeight, active: 'ticker', label: `${t} AI read`, main });
}

// =================================================================================================
// States · the nine canon states (readLayout.ts body cases A1a–A10), plus production and the demo
// =================================================================================================
const head = (extra = '') => `<div class="ph"><span aria-hidden="true" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; background: var(--raised-2);">${icon('sparkle', 14)}</span><h3>AI read · SPY</h3>${extra}<a href="#" class="t-info" style="font-size: 12px; font-weight: 500;">View what’s sent →</a></div>`;
const panel = (inner, { sample = false } = {}) => `<div class="hd-p${sample ? ' is-sample' : ''}" style="gap: 10px;">${inner}</div>`;
const pinned = '<span class="mono steel" style="font-size: 11px;">Pinned · As of 10:41 AM ET · Persona · Balanced Swinger</span>';
const field = (l, v) => `<label class="fld" style="font-size: 11px;"><span class="caps">${l}</span><span class="in" style="min-height: 36px; font-size: 13px;">${v}${icon('chevron', 14)}</span></label>`;

export function statesBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const risk = (cells) => `<div class="dr-fig">${cells.map(([l, v, s, u]) => `<div>${caps(l)}<span class="v${u ? ' u' : ''}">${v}</span><span class="dline" style="font-size: 11px;">${s}</span></div>`).join('')}</div>`;
  const tradeRead = `${pinned}<p class="vd amber">Trade · bullish</p><span class="dline" style="font-size: 12.5px;">Call spread · <span class="mono">690 / 700</span> · Oct 16 · confidence medium</span>${risk([['Max risk', '$420', 'the AI’s figure · 1.7% of account'], ['Invalidation', '683.92', 'traces to the flip'], ['Entry', 'near 690', 'traces to spot'], ['Target', '699.50', 'the read’s own · untraced', true]])}<span class="dline">3 of 4 checked figures trace to a Convexa number; each exception says so.</span>`;
  const items = [
    { name: 'Idle', when: 'Signed in, a key set, no read yet (A1a). The composer is one row; the read runs only when asked.', html: panel(`${head()}<p class="dline" style="font-size: 13px;">Risk-first read on the current snapshot, framed by your persona. Advisory: you confirm every paper trade.</p><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">${field('Next read persona', 'Balanced Swinger')}${field('Model', 'Your default')}</div><button class="btn primary" type="button">Analyze current snapshot</button><span class="dline" style="font-size: 11px;">Snapshot as of 10:41 AM ET · your own key</span>`) },
    { name: 'Idle · no fresh edge', when: 'The guardrails see no fresh edge (A1b; over a read it is the A1c note). A footnote with “Ask anyway”, never a wall.', html: panel(`${head()}<div class="dr-note">${icon('info', 14)}<span><strong>No fresh edge right now.</strong> The guardrails don’t see a fresh, actionable edge. You can still ask; it counts against your cooldown and daily limit.</span></div><button class="btn secondary" type="button" style="align-self: flex-start;">Ask anyway</button>`) },
    { name: 'Loading', tag: ['loading'], when: 'Request in flight, 5–15 s (A2). Three named steps; skeletons in the result’s shape; the rest of the desk keeps updating.', html: panel(`${head()}<strong style="font-size: 13px;">Thinking…</strong><div class="dr-steps"><span>${icon('check', 12)}Snapshot pinned · 10:41 AM ET</span><span>${icon('check', 12)}Persona applied · Balanced Swinger</span><span style="color: var(--phosphor);">${icon('clock', 12)}Your model is reading the snapshot</span></div><span class="skel" style="height: 26px; width: 55%;"></span><div class="dr-fig"><span class="skel" style="height: 58px;"></span><span class="skel" style="height: 58px;"></span></div>`) },
    { name: 'Trade', when: 'The primary state (A3). Verdict first; the verdict word is the panel’s only amber text. Risk before rationale; the untraced figure is Plex Sans with a dotted rule.', html: panel(`${head()}<div class="dr-mini">${tradeRead}<div class="acts"><button class="btn primary" type="button">Review simulated trade</button><button class="btn secondary" type="button">Create sim order</button><button class="btn ghost" type="button">Full analysis &amp; data</button></div><span class="dline" style="font-size: 11px;">A read, not an order. Nothing is saved until you review and confirm a simulated trade.</span></div>`) },
    { name: 'No trade', when: 'A complete, correct answer (A4): same weight as a trade, never red; the action becomes an alert on the re-engage level.', html: panel(`${head()}<div class="dr-mini">${pinned}<p class="vd">No trade · sit this one out</p><span class="dline">No simulated entry. A “no trade” read is a complete, correct answer.</span><span class="caps">Re-engage when</span><ul style="margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.5;"><li>Spot closes below the flip at <span class="mono">683.92</span>.</li></ul><div class="acts"><button class="btn secondary" type="button">${icon('bell', 14)}Alert me at the flip</button><button class="btn ghost" type="button">Refresh analysis</button><button class="btn ghost" type="button">Full analysis &amp; data</button></div></div>`) },
    { name: 'Stale · newer snapshot', tag: ['stale', 'Older snapshot'], when: 'The structure refreshed after the read (A5, over any produced read). Burnt orange with the icon; the read stays readable, at full contrast: text is never dimmed by opacity (2026-09-09 Amendments row), and the app’s DecisionCard draws the strip over an undimmed read; it never refreshes itself.', html: panel(`${head()}<div class="dwarn">${icon('warn', 14)}<span class="dline">A newer snapshot has arrived. This read is from 10:41 AM ET. Refresh analysis when you’re ready.</span></div><div class="dr-mini">${tradeRead}</div><button class="btn secondary" type="button" style="align-self: flex-start;">${icon('refresh', 14)}Refresh analysis</button>`) },
    { name: 'Cooldown', when: 'Rate-limited after a read (A6a). The last read stays pinned; the control names the wait.', html: panel(`${head()}<button class="btn secondary disabled" type="button" aria-disabled="true" style="align-self: flex-start;">${icon('clock', 14)}Cooling down · 42s</button><span class="dline">A fresh entry read rarely changes inside a minute, and the data refreshes about every 60 seconds. Available again in 42s.</span>`) },
    { name: 'Daily limit', when: 'Today’s reads used (A6b). Calm, not punitive; the export still works.', html: panel(`${head()}<strong style="font-size: 13.5px;">Daily AI limit reached · resets 12:00 AM</strong><span class="dline">You’ve used today’s AI reads. The export still works and costs nothing.</span>`) },
    { name: 'Signed out', tag: ['locked'], when: 'Anonymous visitor on a build with the feed (A7). The gate replaces the action surface; the export link stays.', html: panel(`${head()}<div class="dr-mini" style="align-items: flex-start;"><strong style="font-size: 15px;">Sign in to ask the AI for a read.</strong><span class="dline">Structure, tape and context stay open without an account. Reads run on your own key, so they need one.</span><button class="btn primary" type="button">Sign in to ask AI</button></div>`) },
    { name: 'Add a key', tag: ['notConfigured', 'Add a key'], when: 'Signed in, nothing to power a read (A8). Eight reasons share the frame and swap only the sentence and the button; they never collapse.', html: panel(`${head()}<strong style="font-size: 14px;">Add an API key to power reads</strong><span class="dline">Anthropic, OpenAI, Gemini or Grok. Your key, your cost. The export always works without one.</span><button class="btn primary" type="button" style="align-self: flex-start;">Open AI providers in Settings</button><div class="dr-reasons">${[['no_key', 'Add an API key to power reads'], ['key_unusable', 'Your saved key can’t be used'], ['key_rejected', 'The provider rejected your key'], ['model_not_in_catalog', 'Choose another model'], ['model_unset', 'Choose a model'], ['oauth_expired', 'Your Grok connection expired'], ['oauth_unlinked', 'Connect Grok or add your key'], ['subscription_unavailable', 'Your Grok subscription isn’t available']].map(([k, v]) => `<span class="mono">${k}</span><span>${v}</span>`).join('')}</div>`) },
    { name: 'Couldn’t get a read', tag: ['error'], when: 'The request failed (A10): the cause and Retry. A pinned earlier read is never evicted by a failed refresh.', html: panel(`${head()}<div class="dwarn">${icon('warn', 14)}<span class="dline">Couldn’t get a read: the provider didn’t answer in 30 s. This didn’t affect the rest of the desk.</span></div><button class="btn secondary" type="button" style="align-self: flex-start;">${icon('refresh', 14)}Retry</button>`) },
    { name: 'Not live', tag: ['notLive'], when: 'Production, always: the read needs the options structure. Replaces the shipped “Market data is paused.” line.', html: chartFrame({ claim: 'AI read · NVDA', sub: 'Verdict-first read of the dealer structure', state: 'notLive', body: stateBody('notLive', { height: 150, text: '<strong>Would show</strong> a verdict, the risk before the rationale, and when to look again.', cause: 'Off because it reads the options structure, a paid feed this site doesn’t run.', action: `<a href="${demoDesk('NVDA')}" class="t-info" style="font-size: 13px; font-weight: 500;">See it on the demo →</a>` }) }) },
    { name: 'Sample read', tag: ['sample'], when: 'Staging, always: the authored analysis for the scenario’s expiry set. No model, no key, no limit; dashed and hatched.', html: panel(`<div class="ph"><h3>Sample analysis · SPY</h3>${stateTag('sample', 'Sample read')}</div><p class="vd" style="margin: 0; font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 20px;">No trade · sit this one out</p><span class="dline">${SAMPLE_NOTE}</span><div>${provChip('Sample · shaped like an AI read', 'dashed')}</div>`, { sample: true }) },
    { name: 'Sample couldn’t load', tag: ['error'], when: 'Staging: the scenario file failed to load. With an earlier sample on screen it stays, under “Couldn’t update the sample view. Showing the last sample.”', html: panel(`<div class="ph"><h3>Sample analysis · SPY</h3>${stateTag('error')}</div><div class="dwarn">${icon('warn', 14)}<span class="dline">Sample data could not load. Nothing was sent anywhere.</span></div><button class="btn secondary" type="button" style="align-self: flex-start;">Retry demo</button>`, { sample: true }) },
  ];
  return statesBoard({ scheme, minHeight, title: 'AI read · states', lead: 'The nine canon states (idle, loading, trade, no trade, stale, cooldown, signed out, add a key, error) as the read’s state machine draws them, with the quiet-gate and daily-limit splits. They are reachable only on a build with the options feed: production shows Not live, staging the authored sample read. Figures are illustrative.', trace: 'canon rule 16 · readLayout.ts body cases A1a–A10 · P-1, P-2, P-3', items });
}
