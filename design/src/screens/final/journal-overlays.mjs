// Final · Planned · Journal · Drawers and sheets (spec 08, BOARD BRIEF row `journal-overlays`; step 0, 2026-10-28).
//
// The journal's overlays, each over the page that opens it: the finding drawer (560, over the Oct 7 review), What's
// sent (520, over the review), Edit positions (a 760 dialog on RealPositionRows, over the composer), the account path
// (a 760 drawer, over the timeline), the phone's bottom sheets, and the overlays' states (with Delete journal's typed
// confirm).
//
// Drawn on the journal kit (./journal-kit.mjs) and the Sample journal (design/src/data/journal-sample.mjs); the row
// lanes' contract is tmp/journal-boards/KIT.md. The review page behind two drawers, and figs() (the module's own digits
// in Mono, traced or tinted, with a check that the words never drift), come from this lane's other row,
// ./journal-review.mjs, so this row's css carries its RV_CSS. Classes are `jr-ov-`. Units are px.
import { finalDemoNotice } from '../../lib.mjs';
import { JR_CSS, B, JR_NOTES, JR_RULINGS, JOURNAL_SUB, jrPage, jrHeader, jrHeaderActions, jrBtn, jrGrid, jrFrame, jrQuiet, jrTag, jrDots, jrStrip, jrQuote, jrSpan, jrPath, jrDrawer, jrDialog, jrOverlay, jrSheet, jrSheetStage, jrSurface, jrNote, jrKind, jrSym, jrEntryCard, jrDay, jrFig, jrFigs, jrSpark, jrChips, jrSeg, jrGap, jrAbove, statesBoard, icon, sw } from './journal-kit.mjs';
import { RV_CSS, reviewPage, figs, findingFacts } from './journal-review.mjs';
import { AI, DETECTOR_ROWS, ENTRY, FINDINGS, INSTRUMENTS, KIND_WORD, LATEST, Q, REVIEWS, RULE, SNAPSHOT, STRINGS, daysBetween, fmtDate, fmtDay, pct, times, usd } from '../../data/journal-sample.mjs';

const OCT7 = REVIEWS.oct7;
const det = (row) => OCT7.detectors.find((d) => d.row === row);
const F1 = FINDINGS.find((f) => f.id === 'f-row1');
const F3 = FINDINGS.find((f) => f.id === 'f-row3');
const strip = (h) => String(h).replace(/<[^>]+>/g, '');

// =========================================================================================================
// CSS (jr-ov-)
// =========================================================================================================
const OV_CSS = `
  /* ---- drawer bodies: section heads, evidence rows, the other way, the three corrections ----------------- */
  .jr-ov-h { margin: 4px 0 0; font-size: 14px; font-weight: 600; line-height: 1.35; color: var(--phosphor); }
  .jr-ov-p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .jr-ov-p.dim { font-size: 13px; color: var(--text-dim); }
  .jr-ov-p .mono { color: var(--phosphor); }
  .jr-ov-sec { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; border-top: 1px solid var(--line); }
  .jr-db > .jr-ov-sec:first-child { padding-top: 0; border-top: 0; }
  /* On staging each section of sample data is a dashed frame with the 8px steel hatch band (P-3, P-8) and no chip of
     its own: the overlay's head names the sample once (D1), as the Final What's sent drawer draws its sections. */
  .jr-ov-sec.is-sample, .jr-db > .jr-ov-sec.is-sample:first-child { position: relative; padding: 20px 12px 12px; border: 1px dashed var(--steel-2); border-radius: 10px; }
  .jr-ov-pos.is-sample { position: relative; padding-top: 20px; border: 1px dashed var(--steel-2); }
  .jr-ov-sec.is-sample::before, .jr-ov-pos.is-sample::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8px; border-radius: 9px 9px 0 0; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--steel) 28%, transparent) 6px 12px); pointer-events: none; }
  /* the account path's twin in the 760 drawer: headers and words wrap so all eight columns show */
  .jr-ov-pathd .cf-tw th, .jr-ov-pathd .cf-tw td { padding: 6px 8px; }
  .jr-ov-pathd .cf-tw thead th { white-space: normal; vertical-align: bottom; }
  .jr-ov-pathd .cf-tw td.t { white-space: normal; }
  .jr-ov-ev { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .jr-ov-ev:last-child { border-bottom: 0; padding-bottom: 0; }
  .jr-ov-evh { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
  .jr-ov-d { font-size: 13px; font-weight: 600; color: var(--phosphor); }
  .jr-ov-tomb { font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .jr-ov-tw { max-width: 100%; overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
  .jr-ov-tw table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .jr-ov-tw th, .jr-ov-tw td { padding: 7px 10px; text-align: right; white-space: nowrap; border-top: 1px solid var(--line); }
  .jr-ov-tw thead th { border-top: 0; font-weight: 600; color: var(--steel); background: var(--ink-2); }
  .jr-ov-tw th:first-child, .jr-ov-tw td:first-child { text-align: left; }
  .jr-ov-tw td { font-family: 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .jr-ov-tw td.t { font-family: 'IBM Plex Sans', sans-serif; }
  .jr-ov-choices { display: flex; flex-direction: column; gap: 8px; }
  .jr-ov-choices .btn { justify-content: flex-start; width: 100%; height: 44px; }
  .jr-ov-past { margin: 0; display: flex; align-items: flex-start; gap: 6px; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .jr-ov-past .ico { flex: none; margin-top: 2px; color: var(--steel); }
  .jr-ov-side { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border: 1px solid var(--line-2); border-radius: 999px; font: 600 12px/1 'IBM Plex Sans', sans-serif; color: var(--phosphor); white-space: nowrap; }

  /* ---- What's sent ------------------------------------------------------------------------------------------------- */
  .jr-ov-cats { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .jr-ov-cats li { padding: 8px 0; border-top: 1px solid var(--line); font-size: 14px; line-height: 1.5; color: var(--phosphor); }
  .jr-ov-cats li:first-child { border-top: 0; padding-top: 0; }
  .jr-ov-never { margin: 0; padding: 10px 12px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--ink-2); font-size: 13px; line-height: 1.55; color: var(--phosphor); }
  .jr-ov-est { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.45; color: var(--text-dim); }
  .jr-ov-est .mono { color: var(--phosphor); }
  .jr-ov-pkg { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 13px; color: var(--text-dim); }
  .jr-ov-pkg .mono { color: var(--phosphor); }
  @media (pointer: coarse) { .jr-ov-pkg .btn { min-height: 44px; } }

  /* ---- Edit positions: RealPositionRows, a copy of the LegFields grid (neutral Right: no fills on a journal route) - */
  .jr-ov-pos { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--ink-2); }
  .jr-ov-posh { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
  .jr-ov-posh .n { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 600; color: var(--phosphor); }
  .jr-ov-posh .n .mono { margin-right: 6px; }
  .jr-ov-g4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: start; }
  .jr-ov-l { display: block; margin: 0 0 4px; font: 700 11px/1.65 'IBM Plex Sans', sans-serif; letter-spacing: 0.07em; text-transform: uppercase; color: var(--steel); }
  .jr-ov-in { box-sizing: border-box; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--ink); font: 500 13px/1 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .jr-ov-in.sans { font-family: 'IBM Plex Sans', sans-serif; }
  .jr-ov-in.ro { border-style: dashed; background: transparent; }
  .jr-ov-in .jr-gap { font-size: 13px; }
  .jr-ov-in .car { margin-left: auto; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid var(--steel); }
  .jr-ov-hint { display: block; margin-top: 4px; font-size: 12px; line-height: 1.4; color: var(--steel); }
  .jr-ov-hint .mono { color: var(--phosphor); }
  .jr-ov-tg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); box-shadow: inset 0 0 0 1px var(--line-2); border-radius: 8px; overflow: hidden; }
  .jr-ov-tg > button { min-height: 36px; padding: 0 8px; border: 0; border-left: 1px solid var(--line-2); background: transparent; color: var(--steel); font: 600 13px/1 'IBM Plex Sans', sans-serif; }
  .jr-ov-tg > button:first-child { border-left: 0; }
  .jr-ov-tg > button[aria-pressed="true"] { background: color-mix(in srgb, var(--phosphor) 16%, transparent); color: var(--phosphor); box-shadow: inset 0 0 0 1px var(--phosphor); }
  .jr-ov-res { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .jr-ov-res .mono { color: var(--phosphor); }
  .jr-ov-res .mono.t-down { color: var(--text-down); } .jr-ov-res .mono.t-up { color: var(--text-up); }
  .jr-ov-row { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 6px 12px; border: 1px solid var(--line); border-radius: 10px; background: transparent; font: 400 13px/1.45 'IBM Plex Sans', sans-serif; color: var(--phosphor); text-align: left; }
  button.jr-ov-row, label.jr-ov-row { cursor: pointer; }
  .jr-ov-row > span:first-child { flex: 1 1 auto; min-width: 0; }
  .jr-ov-row .mono { color: var(--phosphor); }
  .jr-ov-row .ico { flex: none; color: var(--steel); }
  /* The base sheet rule ([role="dialog"] .btn, under 600px) stretches every button; these stay their own size. */
  .jr-ov-pkg .btn, .jr-ov-posh .btn { flex: 0 0 auto; }
  @media (max-width: 599px) {
    .jr-ov-g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .jr-ov-in, .jr-ov-tg > button { height: 44px; min-height: 44px; }
    .jr-ov-posh .btn { width: 44px; height: 44px; padding: 0; }
    .jr-ov-posh .jr-seg { order: 3; flex: 1 1 100%; }
  }

  /* ---- the composer and the timeline behind ------------------------------------------------------------------------ */
  .jr-ov-cmp { display: grid; grid-template-columns: minmax(0, 720px) 400px; justify-content: center; gap: 32px; align-items: start; }
  .jr-ov-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .jr-ov-ed { min-height: 320px; }
  .jr-ov-ph { margin: 0; font-size: 17px; line-height: 1.6; color: var(--steel); }
  .jr-ov-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
  .jr-ov-meta { margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 14px; color: var(--text-dim); }
  .jr-ov-plines { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.45; color: var(--text-dim); }
  .jr-ov-plines .mono { color: var(--phosphor); }

  /* ---- the phone's sheets board -------------------------------------------------------------------------------------- */
  .jr-ov-shh { padding: 24px 16px 0; display: flex; flex-direction: column; gap: 6px; }
  .jr-ov-shh h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
  .jr-ov-shh p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--steel); }
  .jr-ov-ss { display: flex; flex-direction: column; gap: 8px; }
  .jr-ov-cap { padding: 0 16px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
  .jr-ov-cap b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 16px; }
  .jr-ov-cap span { font-size: 12px; color: var(--steel); }
  /* A board note under a sheet's caption (P-4: board only, never product UI), as the Entry row draws one in a panel. */
  .jr-ov-bn { display: flex; align-items: flex-start; gap: 6px; margin: 0 16px; padding: 6px 10px; border: 1px dashed var(--line-2); border-radius: 8px; background: var(--ink-2); font: 500 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); }
  .jr-ov-bn .ico { flex: none; margin-top: 2px; }
  .jr-ov-bn b { font-weight: 600; color: var(--phosphor); }
  .jr-ov-clamp .jr-peek .t { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .jr-ov-sheet .jr-sheet-b { gap: 14px; }

  /* ---- states: a drawer or dialog drawn flat inside its state frame ---------------------------------------------------- */
  .jr-ov-st .jr-drawer, .jr-ov-st .jr-dlg { width: 100%; border: 1px solid var(--line-2); border-radius: 16px; box-shadow: none; overflow: visible; }
  /* Delete journal's typed confirm, drawn as Settings › Journal draws it (one version): a neutral well, the warning
     glyph by its words, the burnt-orange "Delete journal" with its glyph. */
  .jr-ov-del { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--ink-2); }
  .jr-ov-del .acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .jr-ov-del .jr-ov-in { max-width: 320px; font-family: 'IBM Plex Sans', sans-serif; }
  .jr-ov-delh { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.45; color: var(--phosphor); }
  .jr-ov-delh .ico { flex: none; margin-top: 2px; color: var(--warn); }
`;

// =========================================================================================================
// Shared parts
// =========================================================================================================
/** A board that shows one viewport of the page behind an overlay: the page clipped to `h` px. */
const clip = (html, h) => `<div style="height: ${h}px; overflow: hidden;">${html}</div>`;
/** A small table: words (cells given as { t }) align left with their header, figures right in Mono. */
function table(cols, rows, caption) {
  const left = cols.map((_, i) => i === 0 || typeof rows[0][i] === 'object');
  const al = (i) => (left[i] ? ' style="text-align: left;"' : '');
  const head = `<thead><tr>${cols.map((c, i) => `<th scope="col"${al(i)}>${c}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row" class="t" style="font-weight: 500; color: var(--phosphor); text-align: left;">${c}</th>` : typeof c === 'object' ? `<td class="t"${al(i)}>${c.t}</td>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="jr-ov-tw" tabindex="0" role="region" aria-label="${caption}"><table>${head}${body}</table></div>`;
}
const side = (f) => `<span class="jr-ov-side">${findingFacts(f).side}</span>`;

// ---- the finding drawer ---------------------------------------------------------------------------------------------------
const CHOICE_WORD = { missing_context: 'missing context', misread: 'misread', not_a_pattern: 'not a pattern' };
const pastLine = () => REVIEWS.sep28.feedback.map((x) => `<p class="jr-ov-past">${icon('clock', 14)}<span>You marked this “${CHOICE_WORD[x.choice]}” on ${fmtDate(x.on)}.</span></p>`).join('');
/** One evidence row per counted case: date and kind, his quoted span where the spec prints one, and the cited
 *  figures, traced (row 1 counts the add's price against the average cost just before it). */
function evidenceRow(c) {
  const e = ENTRY[c.entry];
  const span = e.spans.find((s) => /^added /.test(s));
  const figure = figs(`Price ${usd(c.price, { dp: 2 })} · average cost just before it ${usd(c.avg, { dp: 2 })} · ${pct(c.below, 1)} below`, { trace: true });
  return `<div class="jr-ov-ev"><div class="jr-ov-evh"><span class="jr-ov-d">${fmtDay(c.date)}</span>${jrKind(e.kind)}${e.tickers.map(jrSym).join('')}</div>${span ? jrQuote(`…${jrSpan(span)}…`) : ''}<p class="jr-ov-p">${figure}</p></div>`;
}
function otherWay(cases) {
  const rows = cases.map((c) => [fmtDate(c.date), { t: `${KIND_WORD[ENTRY[c.entry].kind]} · ${INSTRUMENTS[c.inst].short}` }, usd(c.price, { dp: 2 }), usd(c.avg, { dp: 2 }), pct(c.below, 1)]);
  return table(['Date', 'Entry', 'Price', 'Average cost before', 'Below'], rows, 'Cut the other way');
}
const choices = () => `<div class="jr-ov-choices">${['It misread what I wrote', 'It’s missing context', 'Not a pattern to me'].map((c) => jrBtn(c)).join('')}</div>`;
/** The drawer's body for row 1's finding: the claim, evidence, how it was counted, the other way, what it doesn't use,
 *  and "That's not right" with his past correction. */
/** On a phone the other way is one line, in the user flow's own form: "1 (NVDA, Aug 28, 8.6% below your average
 *  cost)" (User flows → An insight becomes a rule). */
const cutLine = (d) => figs(`${d.uncounted.length} (${d.uncounted.map((c) => `${INSTRUMENTS[c.inst].short}, ${fmtDate(c.date)}, ${pct(c.below, 1)} below your average cost`).join('; ')})`, { ints: true });
/** `sample`: staging, so the sections that hold the sample's cases are dashed frames with the hatch band. */
const secCls = (sample) => `jr-ov-sec${sample ? ' is-sample' : ''}`;
function findingBody({ sheet = false, sample = false } = {}) {
  const x = findingFacts(F1);
  const d = det(1);
  const parts = [
    `<p class="jr-rv-claim">${x.claim}</p><p class="jr-rv-ev">${x.evidence}</p>`,
    `<section class="${secCls(sample)}" aria-label="Evidence"><h3 class="jr-ov-h">Evidence</h3><div>${d.cases.map(evidenceRow).join('')}</div></section>`,
    `<section class="${secCls(sample)}" aria-label="How it was counted"><h3 class="jr-ov-h">How it was counted</h3>${jrDots(d.k, d.n)}<p class="jr-ov-p dim">counted: ${DETECTOR_ROWS.find((r) => r.row === 1).over}</p></section>`,
    `<section class="${secCls(sample)}" aria-label="Cut the other way"><h3 class="jr-ov-h">Cut the other way</h3>${sheet ? `<p class="jr-ov-p">${cutLine(d)}</p>` : otherWay(d.uncounted)}</section>`,
    `<section class="jr-ov-sec" aria-label="What it doesn’t use"><h3 class="jr-ov-h">What it doesn’t use</h3><p class="jr-ov-p dim">Entries written from memory or imported aren’t used for what you decided.</p></section>`,
    sheet ? `<section class="jr-ov-sec" aria-label="Past corrections">${pastLine()}</section>` : `<section class="jr-ov-sec" aria-label="That’s not right"><h3 class="jr-ov-h">That’s not right</h3>${choices()}${pastLine()}</section>`,
  ];
  return parts.join('');
}
const findingDrawer = () => jrDrawer({ w: 560, title: findingFacts(F1).label, chip: `${side(F1)}${jrTag('sample')}`, body: findingBody({ sample: true }), label: `Finding: ${strip(findingFacts(F1).claim)}` });

// ---- What's sent ----------------------------------------------------------------------------------------------------------------
const nw = (s) => `<span class="jr-rv-nw">${s}</span>`;
const WS_TITLE = `What’s sent to Anthropic · ${nw(AI.models.entry)} and ${nw(AI.models.review)} on your key`;
const NEVER_ADDS = 'Convexa never adds your email, name, broker credentials or AI key to what’s sent. Text you write is sent as written.';
const NEVER_SENT = `Never sent: the simulated book, drafts, deleted entries, and the ${AI.keptOut} entries you kept out, with their numbers, money in or out, details, notes and rule answers. Computed figures sent to the AI leave those ${AI.keptOut} entries out, so they can differ from the ones on your pages.`;
const cats = () => `<ul class="jr-ov-cats">${AI.whatsSent.map((l) => `<li>${figs(l, { ints: true })}</li>`).join('')}</ul>`;
/** Before a run: each pass's estimate (the cost model's figures, as How this ran later stores them), then the
 *  estimate and its worst case. */
const estimate = () => `<ul class="jr-ov-est">${AI.howThisRan.slice(0, 2).map((l) => `<li>${figs(l.replace(/(\$\d+\.\d+|\d{1,3}(?:,\d{3})+ (?:in|out))/g, '≈ $1'), { ints: true })}</li>`).join('')}<li>${figs(AI.estimate)}</li></ul>`;
const pkg = () => `<div class="jr-ov-pkg"><span>Package</span><span class="mono">${AI.packageId}</span>${jrBtn('Copy', { kind: 'text', ic: 'copy', size: 'sm', attrs: 'aria-label="Copy the package id"' })}</div>`;
/** state: 'ready' (before a run) · 'off' (AI reads off: what would be sent) · 'after' (the package actually sent,
 *  with its stored usage) · 'copied'. `env` 'staging' adds the demo's line. */
function whatsSentBody({ env = 'staging', state = 'ready' } = {}) {
  const sample = env === 'staging';
  const demo = sample ? jrStrip('info', '<span>No model is called on the demo</span>') : '';
  const usage = state === 'after' ? `<section class="jr-ov-sec" aria-label="How this ran"><h3 class="jr-ov-h">How this ran</h3><ul class="jr-ov-est">${AI.howThisRan.map((l) => `<li>${figs(l, { ints: true })}</li>`).join('')}</ul></section>` : '';
  const est = state === 'ready' || state === 'copied' ? `<section class="${secCls(sample)}" aria-label="Estimate"><h3 class="jr-ov-h">Estimate</h3>${estimate()}</section>` : '';
  const categories = sample ? `<section class="${secCls(true)}" aria-label="Categories">${cats()}</section>` : cats();
  return `${demo}${usage}${categories}<p class="jr-ov-p dim">${NEVER_ADDS}</p><p class="jr-ov-never">${figs(NEVER_SENT, { ints: true })}</p>${est}${state === 'off' ? '' : pkg()}`;
}
const copyAll = (copied = false) => (copied ? jrBtn('Copied', { ic: 'check' }) : jrBtn('Copy all', { ic: 'copy' }));
const whatsSentDrawer = ({ env = 'staging', state = 'ready' } = {}) => jrDrawer({
  w: 520,
  title: state === 'off' ? 'Nothing is sent while AI reads are off' : WS_TITLE,
  chip: state === 'off' ? jrTag('off') : env === 'staging' ? jrTag('sample') : '',
  body: whatsSentBody({ env, state }),
  foot: state === 'off' ? '' : copyAll(state === 'copied'),
  label: WS_TITLE,
});

// ---- Edit positions: RealPositionRows ------------------------------------------------------------------------------------------
const S29 = SNAPSHOT['s-sep29'];
const fld = (label, value, { mono = true, ro = false, caret = false, hint = '' } = {}) => `<div><span class="jr-ov-l">${label}</span><span class="jr-ov-in${mono ? '' : ' sans'}${ro ? ' ro' : ''}">${value}${caret ? '<span class="car" aria-hidden="true"></span>' : ''}</span>${hint ? `<span class="jr-ov-hint">${hint}</span>` : ''}</div>`;
const tg = (opts, on, label) => `<div><span class="jr-ov-l">${label}</span><div class="jr-ov-tg" role="group" aria-label="${label}">${opts.map((o) => `<button type="button" aria-pressed="${o === on}">${o}</button>`).join('')}</div></div>`;
const plOf = (p) => Q.of(p.mark).sub(p.avg).mul(p.qty * INSTRUMENTS[p.inst].mult);
/** The composer's position line: "NVDA · 220 sh · avg $208.95 · mark $199.20", "QQQ · 4 × Dec 18 ’26 600 P · …". */
const posLine = (p) => { const I = INSTRUMENTS[p.inst]; return `${I.symbol} · <span class="mono">${p.qty}</span> ${I.kind === 'option' ? `× ${I.name.slice(I.symbol.length + 1)}` : 'sh'} · avg <span class="mono">${usd(p.avg, { dp: 2 })}</span> · mark <span class="mono">${usd(p.mark, { dp: 2 })}</span>`; };
function posCard(p, { sample = false } = {}) {
  const I = INSTRUMENTS[p.inst];
  const opt = I.kind === 'option';
  const markLabel = `Mark · ${fmtDate(S29.asOf)}`;
  const grid = opt
    ? `<div class="jr-ov-g4">${tg(['Long', 'Short'], 'Long', 'Side')}${fld('Expiration', '2026-12-18', { caret: true })}${fld('Strike', `$${I.strike}`, { caret: true })}${tg(['Call', 'Put'], I.right === 'put' ? 'Put' : 'Call', 'Right')}</div><div class="jr-ov-g4">${fld('Quantity', String(p.qty), { hint: 'contracts' })}${fld('Average cost', usd(p.avg, { dp: 2 }))}${fld(markLabel, usd(p.mark, { dp: 2 }))}${fld('Multiplier', String(I.mult), { ro: true })}</div>`
    : `<div class="jr-ov-g4">${tg(['Long', 'Short'], 'Long', 'Side')}${fld('Quantity', String(p.qty), { hint: 'shares' })}${fld('Average cost', usd(p.avg, { dp: 2 }))}${fld(markLabel, usd(p.mark, { dp: 2 }))}</div>`;
  const res = `<p class="jr-ov-res">${jrTag('computed')} Value <span class="mono">${usd(p.value, { dp: 2 })}</span> · P/L against average cost <span class="mono ${plOf(p).sign() < 0 ? 't-down' : 't-up'}">${usd(plOf(p), { dp: 2, sign: true })}</span></p>`;
  return `<section class="jr-ov-pos${sample ? ' is-sample' : ''}" aria-label="${I.name}"><div class="jr-ov-posh"><span class="n"><span class="mono">${I.symbol}</span>${opt ? I.name.slice(I.symbol.length + 1) : ''}</span>${jrSeg(['Stock', 'Option'], opt ? 'Option' : 'Stock', { size: 32, label: 'Instrument' })}<button class="btn ghost sm" type="button" aria-label="Remove ${I.name}">${icon('trash', 16)}</button></div>${grid}${res}</section>`;
}
const SNAP_FOOT = 'These are the numbers you type. Convexa can’t read balances or margin from your broker, and never places, changes or cancels an order.';
const posStrip = () => jrFigs([
  jrFig({ label: 'Position value', value: usd(S29.positionValue, { dp: 2 }), tag: jrTag('computed') }),
  jrFig({ label: 'Leverage', value: times(S29.leverage), tag: jrTag('computed') }),
  jrFig({ label: 'Loan to position value', value: pct(S29.loanToPositionValue, 1), tag: jrTag('computed') }),
]);
/** `collapse`: on a phone, positions after the first `collapse` sit as one-line rows (the composer's own lines). */
function positionsBody({ collapse = 0, sample = false } = {}) {
  const ps = S29.positions;
  const open = collapse ? ps.filter((p) => p.inst === 'NVDA' || p.inst === 'TSLA_P440') : ps;
  const rows = collapse ? ps.filter((p) => !open.includes(p)).map((p) => `<button type="button" class="jr-ov-row"><span>${posLine(p)}</span>${icon('chevronR', 16)}</button>`).join('') : '';
  return `<p class="jr-ov-p dim">${SNAP_FOOT}</p>${open.map((p) => posCard(p, { sample })).join('')}${rows}<div>${jrBtn('Add a position', { kind: 'text', ic: 'plus' })}</div>${posStrip()}`;
}
const positionsDialog = () => jrDialog({ w: 760, title: 'Edit positions', chip: jrTag('sample'), body: positionsBody({ sample: true }), foot: `<span style="flex: 1 1 auto;"></span>${jrBtn('Cancel', { kind: 'text' })}${jrBtn('Save positions', { kind: 'primary' })}` });

// =========================================================================================================
// The pages behind
// =========================================================================================================
const KINDS = ['entered', 'added', 'trimmed', 'closed', 'margin_call', 'money', 'plan', 'thinking'].map((k) => KIND_WORD[k]);
/** "was $36,146 on Sep 25" under a field: the previous value, its figure in Mono (the composer's own field helper). */
const wasHint = (v, date) => `was <span class="mono">${usd(v, { dp: v % 100 ? 2 : 0 })}</span> on ${fmtDate(date)}`;
/** The composer on Tue Sep 29 (Screens → 2's own example): Update numbers open, the positions and the Computed box.
 *  Behind the Edit positions dialog its footer (Discard draft · the amber Save entry) isn't drawn: the open dialog's
 *  "Save positions" is the screen's one amber fill, as on the Final dialog boards. Only the signed change is tinted;
 *  excess liquidity isn't change, P/L or where the money went (Design → Palette roles). */
function composerPage({ scheme = 'dark' } = {}) {
  const prev = SNAPSHOT['s-sep25'];
  const days = daysBetween(prev.asOf, S29.asOf);
  const fields = `${fld('Account value', usd(S29.accountValue), { hint: wasHint(prev.accountValue, prev.asOf) })}${fld('Margin loan', usd(S29.marginLoan, { dp: 2 }), { hint: wasHint(prev.marginLoan, prev.asOf) })}${fld('Maintenance requirement', usd(S29.maint))}`;
  const computed = `<div class="jr-q">${jrTag('computed')}<p class="jr-ov-res">Margin used <span class="mono">${pct(S29.marginUsed, 0)}</span> · Excess liquidity <span class="mono">${usd(S29.excessLiquidity, { sign: true })}</span> · Since ${fmtDate(prev.asOf)} <span class="mono t-down">${usd(S29.change.usd, { sign: true })} (${pct(S29.change.pct, 1, { sign: true })})</span></p></div>`;
  const snap = jrFrame({ env: 'staging', title: 'Account snapshot', tag: jrTag('stored'), chipAt: 'foot', body: `<p class="jr-ov-p dim">Carried from ${fmtDate(prev.asOf)} · ${days} days old</p><div>${jrSeg(['Unchanged', 'Update numbers'], 'Update numbers', { size: 32 })}</div>${fields}<ul class="jr-ov-plines">${S29.positions.map((p) => `<li>${posLine(p)}</li>`).join('')}</ul><div>${jrBtn('Edit positions', { size: 'sm' })}</div>${computed}<p class="jr-ov-p dim">${SNAP_FOOT}</p>` });
  const left = `<div class="jr-ov-col"><header><h1 class="display" style="margin: 0; font-size: clamp(30px, 3vw, 40px);">New entry</h1><p class="jr-ov-meta"><span>Written when you save · ${fmtDay(S29.asOf)}</span><span>About: Today ▾</span></p></header>${jrChips(KINDS, null)}${jrQuiet('<p class="jr-ov-ph">What happened, and what are you thinking right now?</p>', { cls: 'jr-ov-ed', label: 'Entry' })}</div>`;
  return jrPage({ scheme, env: 'staging', tab: 'journal', label: 'New entry', main: `<div class="jr-ov-cmp">${left}<div class="jr-ov-col">${snap}</div></div>` });
}
/** The Journal timeline, where the rail's account frame opens the path. */
function timelinePage({ scheme = 'dark' } = {}) {
  const env = 'staging';
  const quick = jrQuiet(`<p class="jr-ov-ph" style="font-size: 16px;">What happened, and what are you thinking?</p>${jrChips(KINDS, null)}<p class="jr-ov-p dim">${STRINGS.quickNumbers}</p><div class="jr-ov-foot" style="justify-content: flex-start;">${jrBtn('Save')}${jrBtn('Open full editor', { kind: 'link' })}</div>`, { label: 'Quick capture' });
  const days = `${jrDay('2026-10-05')}${jrEntryCard('e-oct05-plan')}${jrDay('2026-10-02', { snapshot: 's-oct02' })}${jrEntryCard('e-oct02')}${jrDay('2026-09-30', { snapshot: 's-sep30' })}${jrEntryCard('e-sep30-trim')}${jrDay('2026-09-29', { snapshot: 's-sep29' })}${jrEntryCard('e-sep29')}`;
  const account = jrFrame({ env, title: STRINGS.railFinding, level: 'h3', chipAt: 'foot', body: `${jrSpark()}${jrFigs([
    jrFig({ label: 'Account value', value: usd(LATEST.accountValue), tag: jrTag('stored'), sub: fmtDate(LATEST.asOf) }),
    jrFig({ label: 'Margin used', value: pct(LATEST.marginUsed, 0), tag: jrTag('computed') }),
    jrFig({ label: 'Leverage', value: times(LATEST.leverage), tag: jrTag('computed') }),
    jrFig({ label: `Since ${fmtDate(SNAPSHOT['s-oct02'].asOf)}`, value: `${usd(LATEST.change.usd, { sign: true })} (${pct(LATEST.change.pct, 1, { sign: true })})`, signed: true }),
    jrFig({ label: 'Below the recorded high', value: STRINGS.belowEnd, tag: jrTag('computed') }),
  ])}<a href="#path" class="jr-more">Open the account path</a>` });
  const rail = `${jrQuiet(`<p class="jr-ov-p">${STRINGS.focus}</p>`, { label: 'This week’s focus' })}${account}`;
  return jrPage({ scheme, env, tab: 'journal', bar: 'journal', label: 'Journal', main: `${jrHeader({ title: 'Journal', sub: JOURNAL_SUB, actions: jrHeaderActions('journal') })}${jrGrid(`${quick}${days}`, rail)}` });
}

// =========================================================================================================
// Boards
// =========================================================================================================
/** Heights of the one viewport each overlay board shows (the drawer or dialog fits inside, measured). */
const VIEW = { finding: 1160, whatsSent: 960, positions: 1410, path: 1440 };
const findingBoard = (o) => jrOverlay({ ...o, minHeight: Math.max(o.minHeight || 0, VIEW.finding), behind: clip(reviewPage('staging', { scheme: o.scheme, note: false }), VIEW.finding), panel: findingDrawer() });
const whatsSentBoard = (o) => jrOverlay({ ...o, minHeight: Math.max(o.minHeight || 0, VIEW.whatsSent), behind: clip(reviewPage('staging', { scheme: o.scheme, note: false }), VIEW.whatsSent), panel: whatsSentDrawer() });
const positionsBoard = (o) => jrOverlay({ ...o, minHeight: Math.max(o.minHeight || 0, VIEW.positions), center: true, behind: clip(composerPage({ scheme: o.scheme }), VIEW.positions), panel: positionsDialog() });
const pathBoard = (o) => jrOverlay({ ...o, minHeight: Math.max(o.minHeight || 0, VIEW.path), behind: clip(timelinePage({ scheme: o.scheme }), VIEW.path), panel: jrDrawer({ w: 760, title: 'The account path', body: `<div class="jr-ov-pathd">${jrPath('staging', { open: true })}</div>` }) });

// ---- the phone's bottom sheets ---------------------------------------------------------------------------------------------------
const touch = (label, o = {}) => jrBtn(label, { size: 'touch', ...o });
/** The phone's sheets, each over a staging page: the demo bar heads the board, the board note states the scenario,
 *  and each sheet names the sample once, with the Sample tag in its peek row (D1, as the 1440 drawers carry it in
 *  their heads); its sections of sample data are dashed frames with the hatch band, as on the drawers (P-3). */
function sheetsBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const x = findingFacts(F1);
  const r3 = RULE.R3;
  const s30 = SNAPSHOT['s-sep30'], s02 = SNAPSHOT['s-oct02'];
  const u = (v) => usd(v, { dp: v % 100 ? 2 : 0 });
  const numField = (label, value, prevValue) => fld(label, value == null ? jrGap('not recorded') : u(value), { hint: prevValue == null ? '' : wasHint(prevValue, s30.asOf) });
  const tag = jrTag('sample');
  const sheets = [
    ['Finding', 'Review › a finding · the peek row shows the claim',
      `<div class="jr-ov-clamp jr-ov-sheet">${jrSheet({ title: x.claim, sub: `${x.label} · ${x.side}`, tag, body: findingBody({ sheet: true, sample: true }), actions: ['It misread what I wrote', 'It’s missing context', 'Not a pattern to me'].map((c) => touch(c)), label: 'Finding' })}</div>`],
    ['What’s sent', 'Review, Entry and Settings › View what’s sent',
      `<div class="jr-ov-sheet">${jrSheet({ title: 'What’s sent to Anthropic', sub: `${AI.models.entry} and ${AI.models.review} on your key`, tag, body: whatsSentBody({ env: 'staging', state: 'ready' }), actions: [touch('Copy all', { ic: 'copy' }), touch('Close', { kind: 'text' })] })}</div>`],
    ['Edit positions', 'The composer’s snapshot › Edit positions',
      `<div class="jr-ov-sheet">${jrSheet({ title: 'Edit positions', tag, body: positionsBody({ collapse: 2, sample: true }), actions: [touch('Save positions', { kind: 'primary' }), touch('Cancel', { kind: 'text' })] })}</div>`],
    ['Rule menu', 'Rulebook › a rule’s row menu',
      `<div class="jr-ov-clamp jr-ov-sheet">${jrSheet({ title: `${r3.id} · ${r3.versions[0].wording}`, sub: `v${r3.versions[0].v} · since ${fmtDate(r3.versions[0].from)}`, tag, body: `<p class="jr-ov-p">${STRINGS.rulebookR3.replace(/(\d+%)/g, '<span class="mono">$1</span>')} · ${jrAbove()}</p>`, actions: ['Edit', 'Pause', 'Retire'].map((c) => touch(c)) })}</div>`],
    ['Filters', 'Journal › Filters',
      `<div class="jr-ov-sheet">${jrSheet({ title: 'Filters', tag, body: `${fld('Search', '<span class="jr-gap" style="font-weight: 400;">Search your entries</span>', { mono: false })}<div><span class="jr-ov-l">Kind</span>${jrChips(KINDS, null)}</div><div><span class="jr-ov-l">Ticker</span>${jrChips(['NVDA', 'MSFT', 'TSLA', 'QQQ', 'SPY'], null, { label: 'Ticker' })}</div>${['Written from memory', 'Kept out of AI reads', 'Has later notes'].map((t) => `<label class="jr-ov-row"><span>${t}</span>${sw(false, t)}</label>`).join('')}`, actions: [touch('Done')] })}</div>`],
    ['Update numbers', 'New entry › Numbers: carried · Update',
      `<div class="jr-ov-sheet">${jrSheet({ title: 'Update numbers', sub: `Carried from ${fmtDate(s30.asOf)} · ${daysBetween(s30.asOf, s02.asOf)} days old`, tag, body: `<div>${jrSeg(['Broker screen', 'Statement', 'Memory'], 'Broker screen', { size: 32, label: 'Source' })}</div>${numField('Account value', s02.accountValue, s30.accountValue)}${numField('Cash', s02.cash, s30.cash)}${numField('Margin loan', s02.marginLoan, s30.marginLoan)}${numField('Maintenance requirement', s02.maint, s30.maint)}${numField('Buying power', null, null)}<div>${jrBtn('+ Margin call', { kind: 'link' })}</div>`, actions: [touch('Done')] })}</div>`,
      // Oct 2's maintenance requirement reads `not recorded` under "was … on Sep 30" because he cleared it (spec 08,
      // Corrections, item 19); the board note under the caption says so.
      s02.cleared?.includes('maint') ? STRINGS.maintCleared : ''],
  ];
  const note = (html) => (html ? `<p class="jr-ov-bn" role="note">${icon('info', 12)}<span><b>Board</b> ${html}</span></p>` : '');
  const html = `${finalDemoNotice({ phone: true })}<header class="jr-ov-shh"><h1 class="display">Bottom sheets</h1><p>Below 600px every journal overlay is a bottom sheet: a grab handle, a peek row, the body, and its actions stacked at 44px. It opens in 320 ms; Escape closes it and returns focus to its opener.</p></header>${sheets.map(([t, from, sheet, bn]) => `<section class="jr-ov-ss" aria-label="${t}"><div class="jr-ov-cap"><b>${t}</b><span>${from}</span></div>${note(bn)}${jrSheetStage(sheet)}</section>`).join('')}`;
  return jrNote(scheme, JR_NOTES.staging) + jrSurface({ scheme, minHeight, gap: 28, html });
}

// ---- states (6) -------------------------------------------------------------------------------------------------------------------
function statesBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const x3 = findingFacts(F3);
  const aug26 = ENTRY['e-aug26'];
  const deleted = jrDrawer({ w: 560, title: x3.label, chip: side(F3), label: 'Finding with a deleted cited entry', body: `<p class="jr-rv-claim">${x3.claim}</p>${jrStrip('warn', `<span>${figs('1 cited entry was deleted; this finding is out of date.', { ints: true })}</span>`)}<section class="jr-ov-sec" aria-label="Evidence"><h3 class="jr-ov-h">Evidence</h3><div><div class="jr-ov-ev"><div class="jr-ov-evh"><span class="jr-ov-d">${fmtDay(aug26.writtenAt)}</span>${jrKind(aug26.kind)}${aug26.tickers.map(jrSym).join('')}</div><p class="jr-ov-p">${figs(`Exit at ${usd(aug26.exit, { dp: 2 })} on the ${INSTRUMENTS.QQQ_P600.short}`, { trace: true })}</p></div><div class="jr-ov-ev"><p class="jr-ov-tomb">An entry written Sep 29 was deleted on Oct 27.</p></div></div></section>` });
  const past = `<section class="jr-ov-sec" style="border-top: 0; padding-top: 0;" aria-label="That’s not right"><h3 class="jr-ov-h">That’s not right</h3>${choices()}${pastLine()}</section>`;
  // One version of the typed confirm, the spec's and Settings › Journal's: its words, the input, what deletion
  // reaches, "Export first" and the burnt-orange "Delete journal" with the warning glyph; no "Keep it" (not in Copy).
  const del = `<div class="jr-ov-del" role="group" aria-label="Delete journal"><p class="jr-ov-delh">${icon('warn', 16)}<span>Type “delete journal” to confirm.</span></p><span class="jr-ov-in" role="textbox" aria-label="Type delete journal to confirm">delete journal</span><p class="jr-ov-p dim">What was already sent to your AI provider is under its terms.</p><div class="acts">${jrBtn('Export first', { ic: 'down' })}${jrBtn('Delete journal', { kind: 'danger', warn: true })}</div></div>`;
  const items = [
    { name: 'Finding · a cited entry was deleted', tag: null, when: 'After “Delete entry” on a cited entry (criterion 22): the finding is marked out of date and loses its quotes from that entry, whose row reads as its tombstone (the spec’s own example). Drawn on the Aug 26 exit finding, which cites the Sep 29 entry.', html: `<div class="jr-ov-st">${deleted}</div>` },
    { name: 'Finding · past corrections listed', tag: null, when: 'Each correction is an append-only feedback row, sent as an owner_feedback fact in the next package. “It’s missing context” opened a later note on the cited entry, marked “Context for the AI”; “Not a pattern to me” isn’t raised again until 5 more entries change the count.', html: past },
    { name: 'What’s sent · AI off', tag: ['off'], when: 'What would be sent, headed “Nothing is sent while AI reads are off”. No package id, no estimate, no Copy all.', html: `<div class="jr-ov-st">${whatsSentDrawer({ env: 'production', state: 'off' })}</div>` },
    { name: 'What’s sent · after a run', tag: null, when: 'The package that was actually sent, with its stored usage from journal_ai_runs and its package id.', html: `<div class="jr-ov-st">${whatsSentDrawer({ env: 'production', state: 'after' })}</div>` },
    { name: 'What’s sent · Copied', tag: null, when: '“Copy all” copies the canonical JSON and reads “Copied”. Drawn as the drawer’s last part, under the categories and the never-sent lines.', html: `<div class="jr-ov-st">${jrDrawer({ w: 520, title: WS_TITLE, body: `<section class="jr-ov-sec" aria-label="Estimate"><h3 class="jr-ov-h">Estimate</h3>${estimate()}</section>${pkg()}`, foot: copyAll(true) })}</div>` },
    { name: 'Delete journal · typed confirm', tag: null, when: 'Settings › Journal, inline, with no modal on a modal: nothing is removed until the words match. It offers “Export first”. The backup sentence is written at slice 1a from the project’s backup setting, so it isn’t drawn. The month’s AI spend survives (cost rows keep their columns).', html: del },
  ];
  return statesBoard({ scheme, minHeight, title: 'Journal · Drawers and sheets · states', lead: 'The finding drawer, What’s sent and the delete-journal confirm, apart from their ready states. Errors are inline, destructive actions confirm inline, and Escape closes every overlay.', items });
}

// =========================================================================================================
// The row
// =========================================================================================================
export const ROW = {
  key: 'journal-overlays',
  label: 'Journal · Drawers and sheets',
  section: 'planned',
  css: JR_CSS + RV_CSS + OV_CSS,
  specH: 2966,
  spec: {
    title: 'Journal · Drawers and sheets',
    route: '/positions/review/:reviewId?finding=:id · What’s sent · Edit positions · the account path',
    job: 'Show exactly which entries and numbers a claim rests on, and let him correct it; show what is sent to his AI provider before and after a run; edit the positions he typed; open the full account path. Below 600px, each is a bottom sheet.',
    env: {
      production: 'The owner’s own journal, signed in; visitors meet the Positions private-testing wall. Edit positions and the account path drawer arrive with slice 1b, the finding drawer and What’s sent with slice 4, when AI reads are off by default and What’s sent reads “Nothing is sent while AI reads are off”.',
      staging: 'The Sample journal on the demo account, Oct 7, 2026: row 1’s finding from the authored Oct 7 review (his Sep 18 span quoted; the Sep 4 and Sep 11 bodies aren’t printed, so their rows show the kept detail), the sample package (“No model is called on the demo”), the Sep 29 snapshot’s four positions, and the account path. Each overlay names the sample once: its Sample tag (a drawer’s or dialog’s head, a sheet’s peek row), or its frame’s “Sample journal” chip; the sections and position cards that hold sample data are dashed with the 8px hatch band and carry no tag of their own.',
    },
    widgets: [
      { name: 'Finding drawer (560)', source: 'the review’s finding and code’s detector cases and counter-cases (services/journal/detectors.rs); his spans by entry id and offsets', production: [['computed', 'Computed'], ['off', 'Off']], staging: 'sample' },
      { name: 'What’s sent drawer (520)', source: 'one server table of categories, the build_export pattern (services/journal/package.rs); estimate, worst case and package id', production: [['off', 'Off'], ['notConfigured', 'Not set up']], staging: 'sample' },
      { name: 'Edit positions dialog (760)', source: 'RealPositionRows: his typed positions and marks (Stored here); value, leverage, loan to position value and P/L computed. It copies the LegFields grid but not its Right fills: Call · Put is a neutral segment under ruling #18 (position surfaces never tint call against put), not LegFields’ green and red rightSelectedSx', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
      { name: 'Account path drawer (760)', source: 'the Path: his snapshots and the chain-linked facts, the event rail, the table twin open', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
      { name: 'Bottom sheets (below 600px)', source: 'shared/ui/bottomSheet.ts: finding, What’s sent, Edit positions, rule menu, filters, Update numbers', production: 'every overlay', staging: 'every overlay' },
      { name: 'Delete journal confirm', source: 'Settings › Journal (features/auth/SettingsPage.tsx); removes every row but the AI runs’ cost columns', production: 'inline, typed', staging: 'writes refused with the demo’s copy' },
    ],
    states: [
      { tag: null, when: 'Loading (finding drawer and What’s sent): no words, no tag.' },
      { tag: null, when: 'Finding · produced: the claim and its label, evidence rows with spans and traced figures, How it was counted, Cut the other way, What it doesn’t use, “That’s not right” (“It misread what I wrote” · “It’s missing context” · “Not a pattern to me”).' },
      { tag: null, when: 'Finding · a cited entry was deleted: “1 cited entry was deleted; this finding is out of date.”' },
      { tag: null, when: 'Finding · past corrections: “You marked this “missing context” on Oct 6.”' },
      { tag: null, when: 'What’s sent · ready: the eight categories, “Convexa never adds …”, “Never sent: …”, the estimate and worst case, the package id with Copy, “Copy all”.' },
      { tag: 'off', when: 'What’s sent · AI off: what would be sent, headed “Nothing is sent while AI reads are off”.' },
      { tag: null, when: 'What’s sent · after a run: the package actually sent, with its stored usage. “Copy all” then “Copied”.' },
      { tag: 'sample', when: 'Staging: the finding drawer is Sample; What’s sent shows a sample package, “No model is called on the demo”. On a phone each sheet carries the Sample tag in its peek row, under the demo bar.' },
      { tag: null, when: 'Delete journal: “Type “delete journal” to confirm.” with “Export first”; nothing is removed until the words match.' },
      { tag: 'locked', when: 'Signed out (production): the Positions private-testing wall; no overlay opens.' },
    ],
    phone: 'Every overlay below 600px is a bottom sheet: a grab handle, a peek row (the claim on a finding, the rule and its version on the row menu), the body, and its actions stacked at 44px; it opens in 320 ms, and Escape closes it and returns focus to its opener. Edit positions shows its fields two by two at 44px, with the positions it isn’t editing as one-line rows.',
    acceptance: [
      '14 · The What’s sent drawer’s categories equal the package’s categories for the same run, item for item; a kept-out entry appears only in omitted, and none of its text, figures, money, details, notes, rule answers or reasons is anywhere in the package.',
      '10 and 36 · The drawer’s count reads “3 of 4” with “4 counted; rates start at 20”; its “Cut the other way” rows are code’s cases on the other side of the row; a finding linked to gains has no “Draft a rule from this”.',
      '22 · After “Delete entry”, a finding citing it reads “1 cited entry was deleted; this finding is out of date.” and holds none of its quotes.',
      '16 · After Delete journal, the month’s AI spend is unchanged.',
      '18 · On staging each overlay carries one Sample mark, and What’s sent shows “No model is called on the demo”.',
      '21 · At 390 and 393 each overlay is a bottom sheet with no horizontal overflow and no interactive element under 44px with a coarse pointer.',
      '9 · No success or error fill: RealPositionRows’ Right toggle (Call · Put) is a neutral segment under ruling #18, with none of LegFields’ green and red rightSelectedSx fills, and P/L takes textUp/textDown only with its sign.',
      'Rule 10 (Screens → 2): git grep -n tradeEntry apps/dashboard/src/app/features/journal prints nothing; the dialog shows no SIMULATED chip and no order control.',
    ],
    built: [
      { status: 'todo', waits: 'build', slice: '1a', what: 'Slice 1a: the Filters and Update numbers sheets (the timeline’s filters and the composer’s numbers on a phone).' },
      { status: 'todo', waits: 'build', slice: '1b', what: 'Slice 1b: Edit positions, a 760 dialog on RealPositionRows (a copy of the LegFields grid, importing only multiplierFor); the account path drawer with its twin; Delete journal’s typed confirm in Settings › Journal.' },
      { status: 'todo', waits: 'build', slice: '2', what: 'Slice 2: the rule row menu (Edit · Pause · Retire) as a bottom sheet.' },
      { status: 'todo', waits: 'build', slice: '4', what: 'Slice 4: the finding drawer (evidence, How it was counted, Cut the other way, What it doesn’t use, the three corrections and past corrections) and the What’s sent drawer (categories, never sent, estimate and worst case, package id, Copy all), with their sheets.' },
    ],
    rulings: JR_RULINGS,
    code: [
      'apps/dashboard/src/app/pages/positions/review/* (finding drawer, What’s sent; new)',
      'apps/dashboard/src/app/features/journal/RealPositionRows.tsx (new; a copy of the LegFields grid, importing only multiplierFor)',
      'apps/dashboard/src/app/features/trading/positions/leg.ts · features/trading/tradeEntry/LegFields.tsx (multiplierFor moves, with a re-export)',
      'apps/dashboard/src/app/pages/positions/journal/AccountPath.tsx (new)',
      'apps/dashboard/src/app/shared/ui/bottomSheet.ts · features/auth/SettingsPage.tsx (Delete journal)',
      'apps/api/src/services/journal/package.rs (new; the What’s sent table) · routes/journal.rs',
      'design/src/screens/final/journal-overlays.mjs (step 0)',
    ],
  },
  boards: [
    B('finding', 'Finding drawer · staging', 1440, VIEW.finding + 20, findingBoard),
    B('whats-sent', 'What’s sent drawer · staging', 1440, VIEW.whatsSent + 20, whatsSentBoard),
    B('edit-positions', 'Edit positions dialog · staging', 1440, VIEW.positions + 20, positionsBoard),
    B('path', 'Account path drawer · staging', 1440, VIEW.path + 20, pathBoard),
    B('phone', 'Phone · bottom sheets', 390, 6851, sheetsBody),
    B('states', 'States', 1440, 2161, statesBody),
  ],
};
