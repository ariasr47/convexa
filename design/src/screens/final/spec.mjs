// Final · the spec card that opens every row (2026-10-14).
// One card per screen: what it is for, where each widget's data comes from, what production and staging
// show, every state in its exact words, the phone layout, the rulings it carries, the code it maps to,
// how much of it is built, and the checks that prove it. Content lives in each row's `spec` object. The eyebrow
// comes from the row (index.mjs, 2026-10-28): "Spec · since Convexa <the release it first shipped in>" or
// "Spec · Planned"; it read "Final · Convexa v1 · spec · Oct 14, 2026" on every card, planned ones included.
import { icon } from '../../lib.mjs';
import { stateTag } from '../../components/data-states.mjs';
import { WAITS } from './tracker-data.mjs';

export const SPEC_CSS = `
  .fs { padding: 40px 40px 48px; display: flex; flex-direction: column; gap: 26px; font-size: 13.5px; line-height: 1.55; }
  .fs .eyebrow { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--steel); }
  .fs h1 { margin: 6px 0 0; font-size: 34px; line-height: 1.05; letter-spacing: -0.02em; }
  .fs .route { font: 500 13px 'IBM Plex Mono', monospace; color: var(--phosphor); background: var(--raised); border: 1px solid var(--line-2); border-radius: 6px; padding: 2px 8px; display: inline-block; margin-top: 10px; }
  .fs .job { margin: 10px 0 0; font-size: 15px; color: var(--phosphor); max-width: 62ch; }
  .fs h2 { margin: 0 0 10px; font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--steel); }
  .fs table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .fs th { text-align: left; font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 6px 8px; border-bottom: 1px solid var(--line-2); vertical-align: bottom; }
  .fs td { padding: 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .fs td:first-child { font-weight: 600; color: var(--phosphor); }
  .fs .env { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .fs .env > div { border: 1px solid var(--line-2); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; background: var(--panel); }
  .fs .env > div.stg { border-style: dashed; }
  .fs .env strong { font-size: 12.5px; display: inline-flex; gap: 6px; align-items: center; }
  .fs .states { display: grid; grid-template-columns: max-content 1fr; gap: 8px 14px; align-items: baseline; }
  .fs .states .w { display: flex; gap: 6px; flex-wrap: wrap; }
  .fs ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
  .fs .ac li { list-style: none; margin-left: -18px; display: grid; grid-template-columns: 18px 1fr; gap: 6px; }
  .fs .ac li::before { content: ''; width: 12px; height: 12px; border: 1.5px solid var(--steel); border-radius: 3px; margin-top: 4px; }
  .fs .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .fs .rule { font: 500 11.5px 'IBM Plex Mono', monospace; border: 1px solid var(--line-2); border-radius: 10px; padding: 1px 8px; color: var(--phosphor); }
  .fs .code { font: 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); word-break: break-word; }
  .fs .built { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; align-items: baseline; }
  .fs .bs { justify-self: start; font: 600 11px 'IBM Plex Mono', monospace; padding: 1px 8px; border-radius: 10px; border: 1px solid var(--line-2); white-space: nowrap; }
  .fs .bs.shipped { color: var(--phosphor); }
  .fs .bs.partial { color: var(--phosphor); border-style: dashed; }
  .fs .bs.todo { color: var(--steel); border-style: dotted; }
  .fs .built .why { display: inline-block; margin-left: 6px; font: 600 11px 'IBM Plex Mono', monospace; color: var(--steel); white-space: nowrap; }
`;

const BUILT = { shipped: 'Shipped', partial: 'Partly built', todo: 'Designed, not built' };

/** A card's strings are text, never markup (2026-10-29). The card writes them into the page as HTML, so a placeholder
 *  such as research/<TICKER>/*.md or /credits#<source> was parsed as an element and vanished, and the Blog card's
 *  <noscript> hid the rest of that card until c8a7fcb7 escaped it in the source. A `<` that would open a tag (before
 *  a letter, `/`, `!` or `?`) is escaped here; any other `<`, and every `&`, pass as written, so an entity (&amp;, the
 *  Blog card's &lt;slug&gt;) still reads as one, and escaping twice changes nothing. progress.mjs shows the same
 *  strings on the board map and the tracker through this function. */
export const specText = (s) => String(s).replace(/<(?=[A-Za-z/!?])/g, '&lt;');
const one = (t) => (Array.isArray(t) ? stateTag(t[0], t[1] && specText(t[1])) : stateTag(t) || `<span>${specText(t)}</span>`);
const tags = (s) => (s == null ? '<span class="steel">—</span>' : Array.isArray(s) && Array.isArray(s[0]) ? s.map(one).join(' ') : one(s));

/**
 * spec = {
 *   title, route, job,
 *   env: { production, staging },                          // one or two sentences each
 *   widgets: [{ name, source, production, staging }],      // production/staging: a state key, [key, word], [[k,w],[k,w]] or plain text
 *   states: [{ tag: key | [key, word], when }],            // every state the screen can be in
 *   phone, rulings: ['P-1', ...], code: ['apps/...'],
 *   built: [{ status: 'shipped' | 'partial' | 'todo', what }],
 *   acceptance: ['an observable check', ...],
 * }
 * Every string is text (specText): write a placeholder as it reads, research/<TICKER>/*.md; an entity still reads as one.
 * State keys: current (Updated), delayed, stale (Last good copy), loading, empty, error (Couldn't load),
 * unavailable (Source down), notConfigured (Not set up), off, paused, notLive, sample, demo, locked
 * (Sign in), computed, thirdParty (Live · TradingView), local (Stored here).
 */
export function specBody(spec, { scheme = 'dark', minHeight = 0, eyebrow = 'Spec' } = {}) {
  const w = spec.widgets?.length
    ? `<section><h2>Widgets and their data</h2><table><thead><tr><th>Widget</th><th>Source · delay</th><th>Production</th><th>Staging</th></tr></thead><tbody>${spec.widgets.map((x) => `<tr><td>${specText(x.name)}</td><td class="steel">${specText(x.source)}</td><td>${tags(x.production)}</td><td>${tags(x.staging)}</td></tr>`).join('')}</tbody></table></section>`
    : '';
  const st = spec.states?.length
    ? `<section><h2>States</h2><div class="states">${spec.states.map((x) => `<span class="w">${tags(x.tag)}</span><span>${specText(x.when)}</span>`).join('')}</div></section>`
    : '';
  const built = spec.built?.length
    ? `<section><h2>Built so far</h2><div class="built">${spec.built.map((b) => `<span class="bs ${b.status}">${BUILT[b.status]}</span><span>${specText(b.what)}${b.status !== 'shipped' ? `<span class="why">· ${WAITS[b.waits ?? 'build'].word}${b.ask ? ` (${specText(b.ask)})` : ''}</span>` : ''}</span>`).join('')}</div></section>`
    : '';
  return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><article class="fs" aria-label="${spec.title} · spec">
    <header><div class="eyebrow">${eyebrow}</div><h1 class="display">${specText(spec.title)}</h1>${spec.route ? `<span class="route">${specText(spec.route)}</span>` : ''}<p class="job">${specText(spec.job)}</p></header>
    <section><h2>Production and staging</h2><div class="env"><div><strong>${icon('notlive', 13)}Production · convexa.pages.dev</strong><span>${specText(spec.env.production)}</span></div><div class="stg"><strong>${icon('sample', 13)}Staging · the demo account</strong><span>${specText(spec.env.staging)}</span></div></div></section>
    ${w}${st}
    ${spec.phone ? `<section><h2>Phone (390)</h2><p style="margin: 0;">${specText(spec.phone)}</p></section>` : ''}
    ${spec.acceptance?.length ? `<section><h2>Acceptance</h2><ul class="ac">${spec.acceptance.map((a) => `<li>${specText(a)}</li>`).join('')}</ul></section>` : ''}
    ${built}
    ${spec.rulings?.length ? `<section><h2>Rulings it carries</h2><div class="chips">${spec.rulings.map((r) => `<span class="rule">${specText(r)}</span>`).join('')}</div></section>` : ''}
    ${spec.code?.length ? `<section><h2>Code</h2><div class="code">${spec.code.map((c) => specText(c)).join('<br>')}</div></section>` : ''}
  </article></div>`;
}
