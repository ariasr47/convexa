// Final · Planned · Journal · Weekly review (spec 08, BOARD BRIEF row `journal-review`; step 0, 2026-10-28).
//
// The Review tab (/positions/review): the week in numbers, the account path, the one event, where the money went,
// the fixed detector table, findings and questions (slice 4), the rules this review, the rules he went ahead against
// and this week's focus (G4), with the rail (How this ran, suspicions, past reviews, Tidy). Six boards: the staging Oct 7
// review, production with AI reads off, production mostly from memory, phone, light, and the 16 states.
//
// Drawn on the journal kit (./journal-kit.mjs) and the Sample journal (design/src/data/journal-sample.mjs); the row
// lanes' contract is tmp/journal-boards/KIT.md. Every figure is the sample module's: printed strings go through
// figs(), which only wraps the module's own digits (Mono, traced, or tinted when signed money) and throws if the
// words it returns differ from the words it was given. Classes are `jr-rv-`. Units are px.
//
// Exports beyond ROW (for the overlays row, the same lane's other file): RV_CSS, reviewPage, figs, findingFacts.
import { JR_CSS, B, LIGHT, JR_NOTES, JR_SUBLINE, JR_RULINGS, jrPage, jrHeader, jrHeaderActions, jrBtn, jrGrid, jrFrame, jrQuiet, jrChartFrame, jrTag, jrDots, jrRate, jrStrip, jrSeg, jrSigned, jrPath, jrPeek, statesBoard, icon } from './journal-kit.mjs';
import { dataTable } from '../../chart-kit.mjs';
import { AI, DETECTOR_ROWS, EVENT_TEXT, FINDINGS, ILLUSTRATIVE_RATE, INSTRUMENTS, LATEST, MONEY_WENT, PATH, QUESTIONS, REVIEWS, RULE, RULE_COUNTS, SOURCE_WORD, STRINGS, SUSPICIONS, TIDY, asksLine, fmtDate, pct, usd, wilson } from '../../data/journal-sample.mjs';

const OCT7 = REVIEWS.oct7;
const DET = OCT7.detectors;
const det = (row) => DET.find((d) => d.row === row);
const MEMORY = DET.find((d) => d.key === 'from_memory');

// =========================================================================================================
// Words: figures inside printed sentences. figs() never types a digit; it wraps the module's own.
// =========================================================================================================
const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
/** Spans that hold digits but are not figures: his quoted words, dates, times, model names, rule and pattern
 *  numbers, an option's strike, the package id. */
const SKIP = new RegExp(`“[^”]*”|(?:${MONTHS}) \\d{1,2}(?:, \\d{4})?(?: ’\\d{2})?|\\d{1,2}:\\d{2}(?: [AP]M)?|(?:Sonnet|Opus) \\d+(?:\\.\\d+)?|sha256:\\S+|\\bR\\d+\\b|\\bv\\d+\\b|\\b(?:pattern|row) \\d+\\b|\\b\\d+ [PC]\\b`, 'g');
/** A figure: "3 of the 4" (one count), money, a percent, a grouped number, a decimal (with ×), and, with `ints`,
 *  a bare count. */
const NUM = /(\d+) of (the )?(\d+)|[−+]?\$\d+(?:,\d{3})*(?:\.\d+)?|[−+]?\d+(?:\.\d+)?%|[−+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[−+]?\d+\.\d+×?/g;
const DATE = new RegExp(`^(?:${MONTHS}) \\d|^\\d{1,2}:\\d{2}`);
const NUM_INTS = new RegExp(`${NUM.source}|\\b\\d+\\b`, 'g');
const strip = (h) => String(h).replace(/<[^>]+>/g, '');
const norm = (s) => strip(s).replace(/\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim();
/** Fails the build if a composed line's words drift from the module's (a board never retypes a sentence). */
function same(html, text, where) {
  if (norm(html) !== norm(text)) throw new Error(`journal-review: ${where} drifted from the sample module:\n  got  ${norm(html)}\n  want ${norm(text)}`);
  return html;
}
const factLink = (inner) => `<a class="jr-rv-fact" href="#">${icon('check', 12)}${inner}</a>`;
/**
 * Wrap the figures in a printed sentence. `trace`: an AI-stated figure, Mono with the check glyph, linked to its
 * fact (never tinted). `tint`: computed signed money takes textUp/textDown with its sign. `ints`: bare counts too.
 */
export function figs(text, { trace = false, tint = false, ints = false } = {}) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(SKIP)) {
    parts.push([text.slice(last, m.index), false], [m[0], true]);
    last = m.index + m[0].length;
  }
  parts.push([text.slice(last), false]);
  const re = ints ? NUM_INTS : NUM;
  const one = (tok, k, the, n) => {
    if (k) {
      const inner = `<span class="mono">${k}</span> of ${the || ''}<span class="mono">${n}</span>`;
      return trace ? factLink(inner) : `<span class="jr-rv-nw">${inner}</span>`;
    }
    if (trace) return factLink(`<span class="mono">${tok}</span>`);
    return `<span class="jr-rv-nw">${tint && /^[−+]/.test(tok) ? jrSigned(tok) : `<span class="mono">${tok}</span>`}</span>`;
  };
  // A date or a time never breaks across a line ("Oct 6", "7:02 AM"), nor an opening bracket from its traced figure.
  const keep = (s) => (DATE.test(s) ? `<span class="jr-rv-nw">${s}</span>` : s);
  const html = parts.map(([s, skip]) => (skip ? keep(s) : s.replace(re, one))).join('');
  return same(trace ? html.replace(/\((<a class="jr-rv-fact"[^]*?<\/a>)/g, '<span class="jr-rv-nw">($1</span>') : html, text, 'figs');
}
const sep = '<span class="jr-sep" aria-hidden="true">·</span>';

// =========================================================================================================
// CSS (jr-rv-)
// =========================================================================================================
export const RV_CSS = `
  /* ---- Review: the egress band (above Run, never a tooltip), the head, the from-memory strip ---------------- */
  .jr-rv-egress { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; padding: 14px 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
  .jr-rv-egress > p { margin: 0; flex: 1 1 560px; min-width: 0; font-size: 14px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .jr-rv-run { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .jr-rv-est { font-size: 13px; line-height: 1.4; color: var(--text-dim); }
  .jr-rv-est .mono, .jr-rv-head .mono { color: var(--phosphor); }
  @media (max-width: 599px) { .jr-rv-run { width: 100%; } .jr-rv-run .btn { width: 100%; height: 44px; } }
  .jr-rv-head { display: flex; flex-direction: column; gap: 4px; }
  .jr-rv-head p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); text-wrap: pretty; }
  .jr-rv-head .ico { display: inline-block; margin-right: 6px; vertical-align: -2px; color: var(--steel); }
  .jr-rv-nw { white-space: nowrap; }

  /* ---- sections: an Archivo title over its frame ---------------------------------------------------------- */
  .jr-rv-sec { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .jr-rv-sec > p.jr-rv-lead { margin: -4px 0 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .jr-rv-main { display: flex; flex-direction: column; gap: 32px; min-width: 0; }
  @media (max-width: 767px) { .jr-rv-main { gap: 24px; } .jr-rv-sec > .jr-sec-t { font-size: 20px; } }

  /* ---- 1. the week in numbers: four computed lines, two across in a narrow frame ------------------------ */
  .jr-rv-week { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .jr-rv-week > p { margin: 0; padding: 12px 14px; box-shadow: 1px 0 0 var(--line), 0 1px 0 var(--line); font-size: 14px; line-height: 1.5; color: var(--text-dim); text-wrap: pretty; }
  .jr-rv-week .mono { font-size: 16px; font-weight: 500; color: var(--phosphor); }
  .jr-rv-week .mono.t-down { color: var(--text-down); } .jr-rv-week .mono.t-up { color: var(--text-up); }
  @container (max-width: 700px) { .jr-rv-week { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

  /* ---- 3. the event, a computed sentence --------------------------------------------------------------- */
  .jr-rv-event { margin: 0; font-size: 16px; line-height: 1.6; color: var(--phosphor); text-wrap: pretty; }

  /* ---- 4. where the money went: neutral bars from a zero line, signed text ------------------------------- */
  .jr-rv-bars { display: flex; flex-direction: column; gap: 0; }
  .jr-rv-bh, .jr-rv-br { display: grid; grid-template-columns: 112px minmax(0, 1fr) 104px 104px; gap: 6px 14px; align-items: center; }
  .jr-rv-bh { padding: 0 0 6px; font: 600 11px/1.3 'IBM Plex Sans', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); border-bottom: 1px solid var(--line); }
  .jr-rv-bh .n, .jr-rv-br .v, .jr-rv-br .s { text-align: right; }
  .jr-rv-br { min-height: 40px; padding: 6px 0; border-bottom: 1px solid var(--line); }
  .jr-rv-br .p { font-size: 14px; font-weight: 600; color: var(--phosphor); }
  .jr-rv-br .v { font: 500 14px/1.3 'IBM Plex Mono', monospace; }
  .jr-rv-br .s { font: 500 13px/1.3 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .jr-rv-br .s.jr-gap { font: 500 13px/1.3 'IBM Plex Sans', sans-serif; color: var(--steel); }
  .jr-rv-tr { position: relative; height: 14px; }
  .jr-rv-tr .z { position: absolute; top: -6px; bottom: -6px; width: 0; border-left: 1px solid var(--line-2); }
  .jr-rv-tr .b { position: absolute; top: 0; bottom: 0; background: var(--steel); }
  .jr-rv-tr .b.l { border-radius: 4px 0 0 4px; } .jr-rv-tr .b.r { border-radius: 0 4px 4px 0; }
  .jr-rv-rest { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  @container (max-width: 520px) {
    .jr-rv-bh { display: none; }
    .jr-rv-br { grid-template-columns: minmax(0, 1fr) auto auto; padding: 10px 0; }
    .jr-rv-br .jr-rv-tr { grid-column: 1 / -1; grid-row: 2; }
  }

  /* ---- 5. the fixed detector table: rows from 600px, cards in a narrow frame ------------------------------ */
  .jr-rv-det { display: flex; flex-direction: column; }
  .jr-rv-dh, .jr-rv-dr { display: grid; grid-template-columns: minmax(0, 1fr) 96px 236px; gap: 6px 18px; align-items: start; }
  .jr-rv-dh { padding: 0 0 8px; border-bottom: 1px solid var(--line); font: 600 11px/1.3 'IBM Plex Sans', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); }
  .jr-rv-dr { padding: 12px 0; border-bottom: 1px solid var(--line); }
  .jr-rv-dr.mem { border-bottom: 0; border-top: 1px solid var(--line-2); margin-top: 6px; }
  .jr-rv-dr .t { display: block; font-size: 14px; font-weight: 600; line-height: 1.45; color: var(--phosphor); }
  .jr-rv-dr .t .no { margin-right: 6px; font: 500 12px/1 'IBM Plex Mono', monospace; color: var(--steel); }
  .jr-rv-dr .t .jr-rv-named { margin-left: 8px; vertical-align: 1px; }
  .jr-rv-dr .w { display: block; margin-top: 2px; font-size: 12px; line-height: 1.45; color: var(--steel); }
  .jr-rv-dr .a { font-size: 13px; line-height: 1.4; color: var(--text-dim); }
  .jr-rv-dr .c { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .jr-rv-dr .c .ct { font: 500 13px/1.3 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .jr-rv-dr .c .cw { font-size: 13px; line-height: 1.4; color: var(--steel); }
  .jr-rv-dr .c .cb { font-size: 12px; line-height: 1.4; color: var(--steel); }
  .jr-rv-named { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border: 1px solid var(--line-2); border-radius: 999px; font: 600 11px/1 'IBM Plex Sans', sans-serif; color: var(--phosphor); white-space: nowrap; }
  .jr-rv-cap { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  @container (max-width: 600px) {
    .jr-rv-det { gap: 8px; }
    .jr-rv-dh { display: none; }
    .jr-rv-dr { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; }
    .jr-rv-dr > :first-child { grid-column: 1 / -1; }
    .jr-rv-dr > .a { grid-column: 2; grid-row: 2; text-align: right; }
    .jr-rv-dr > :last-child { grid-column: 1; grid-row: 2; }
    .jr-rv-dr.mem { margin-top: 0; border-color: var(--line-2); border-style: dashed; }
  }

  /* ---- 6. findings: label, side, the claim (Sans 17), traced figures, evidence, the other way ------------ */
  .jr-rv-fl { display: flex; flex-direction: column; gap: 12px; }
  .jr-rv-fc { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 16px 18px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
  .jr-rv-fh { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
  .jr-rv-lab { font: 600 11px/1.3 'IBM Plex Sans', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); }
  .jr-rv-side { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border: 1px solid var(--line-2); border-radius: 999px; font: 600 12px/1 'IBM Plex Sans', sans-serif; color: var(--phosphor); white-space: nowrap; }
  .jr-rv-claim { margin: 0; font-size: 17px; line-height: 1.55; color: var(--phosphor); overflow-wrap: anywhere; text-wrap: pretty; }
  .jr-rv-fact { color: var(--phosphor) !important; text-decoration: underline; text-decoration-color: var(--line-2); text-decoration-thickness: 1px; text-underline-offset: 3px; white-space: nowrap; }
  .jr-rv-fact .ico { display: inline-block; width: 12px; height: 12px; margin-right: 2px; vertical-align: -1px; color: var(--steel); }
  .jr-rv-fact .mono { font-weight: 500; }
  .jr-rv-ev { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .jr-rv-ev .mono { color: var(--phosphor); }
  .jr-rv-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding-top: 2px; }
  @media (max-width: 599px) { .jr-rv-acts { gap: 4px 8px; } .jr-rv-acts .btn, .jr-rv-q .btn { min-height: 44px; } .jr-rv-acts .btn.link { padding: 0 4px 0 0; } }
  .jr-rv-kept { margin: -4px 0 0; display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-dim); }
  .jr-rv-kept .ico { color: var(--steel); }
  .jr-rv-slot { display: inline-flex; align-items: center; height: 22px; padding: 0 6px; border: 1px dashed var(--steel-2); border-radius: 6px; font: italic 500 14px/1 'IBM Plex Sans', sans-serif; color: var(--steel); vertical-align: 1px; }

  /* ---- 7. questions back -------------------------------------------------------------------------------- */
  .jr-rv-q { display: flex; flex-direction: column; gap: 10px; padding: 14px 0; border-bottom: 1px solid var(--line); }
  .jr-rv-q:first-child { padding-top: 0; } .jr-rv-q:last-child { padding-bottom: 0; border-bottom: 0; }
  .jr-rv-q p { margin: 0; font-size: 16px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .jr-rv-q .btn { align-self: flex-start; }

  /* ---- 8. rules this review: his answers, and the computed checks apart --------------------------------- */
  .jr-rv-rule { display: flex; flex-direction: column; gap: 8px; padding: 14px 0; border-bottom: 1px solid var(--line); }
  .jr-rv-rule:first-child { padding-top: 0; } .jr-rv-rule:last-child { padding-bottom: 0; border-bottom: 0; }
  .jr-rv-rh { display: flex; align-items: baseline; gap: 10px; }
  .jr-rv-rn { flex: none; font: 600 13px/1.4 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .jr-rv-rw { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.45; color: var(--phosphor); text-wrap: pretty; }
  .jr-rv-kind { font: 600 11px/1.3 'IBM Plex Sans', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); }
  .jr-rv-asks { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 4px; font-size: 13px; line-height: 1.4; color: var(--text-dim); }
  .jr-rv-ak { display: inline-flex; align-items: center; gap: 6px; }
  .jr-rv-asks .mono { color: var(--phosphor); }
  .jr-rv-cl { margin: 0; font-size: 13px; line-height: 1.4; color: var(--text-dim); }

  /* ---- 9 and 10. the rules he went ahead against, and this week's focus ------------------------------------ */
  .jr-rv-wl { margin: 0; font-size: 15px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .jr-rv-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 10px; }
  .jr-rv-fld { display: flex; flex-direction: column; gap: 6px; flex: 1 1 280px; min-width: 0; font-size: 13px; font-weight: 600; color: var(--phosphor); }
  .jr-rv-in { display: flex; align-items: center; min-height: 40px; padding: 0 12px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font: 400 14px/1.4 'IBM Plex Sans', sans-serif; color: var(--phosphor); }
  .jr-rv-in.empty { color: var(--steel); }
  @media (max-width: 599px) { .jr-rv-in { min-height: 44px; } .jr-rv-form .btn { width: 100%; height: 44px; } }

  /* ---- rail: How this ran, suspicions, past reviews and Tidy ---------------------------------------------- */
  .jr-rv-lines { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.45; color: var(--phosphor); }
  .jr-rv-lines .mono { font-size: 12.5px; }
  .jr-rv-pkg { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 12px; color: var(--steel); }
  .jr-rv-pkg .mono { color: var(--phosphor); }
  @media (pointer: coarse) { .jr-rv-pkg .btn { min-height: 44px; } }
  .jr-rv-ran > summary { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; list-style: none; font-size: 15px; font-weight: 600; color: var(--phosphor); }
  .jr-rv-ran > summary::-webkit-details-marker { display: none; }
  .jr-rv-ran > summary::after { content: ''; margin-left: auto; width: 8px; height: 8px; border-right: 2px solid var(--steel); border-bottom: 2px solid var(--steel); transform: rotate(45deg); }
  .jr-rv-folds { display: flex; flex-direction: column; }
  .jr-rv-folds > .jr-rv-ran { border-bottom: 1px solid var(--line); }
  .jr-rv-folds > .jr-rv-ran[open] { padding-bottom: 12px; }
  .jr-rv-links { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
  .jr-rv-links a { display: inline-flex; align-items: center; min-height: 32px; }
  @media (pointer: coarse) { .jr-rv-links a { min-height: 44px; } }

  /* ---- states-board parts ------------------------------------------------------------------------------- */
  .jr-rv-mh { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
  .jr-rv-mh > b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
  .jr-rv-msg { margin: 0; font-size: 15px; line-height: 1.55; color: var(--phosphor); }
  .jr-rv-steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.4; color: var(--text-dim); }
  .jr-rv-steps li { display: flex; align-items: center; gap: 8px; }
  .jr-rv-steps li.done .ico { color: var(--steel); }
  .jr-rv-steps li.now { color: var(--phosphor); font-weight: 600; }
  .jr-rv-steps li.next::before { content: ''; flex: none; width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--line-2); box-sizing: border-box; }
  .jr-rv-spin { flex: none; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--amber); box-sizing: border-box; }
  .jr-rv-sk { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
  .jr-rv-secs { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .jr-rv-secs li { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-size: 14px; font-weight: 600; }
  .jr-rv-fail > summary { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 32px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-info); }
`;

// =========================================================================================================
// Parts of the page
// =========================================================================================================
const sec = (title, body, { lead = '' } = {}) => `<section class="jr-rv-sec" aria-label="${strip(title)}"><h2 class="jr-sec-t">${title}</h2>${lead ? `<p class="jr-rv-lead">${lead}</p>` : ''}${body}</section>`;

/** The egress sentence, in the same view as the action and never in a tooltip (Data and privacy → Egress). */
export const EGRESS = `Running a review sends the text of entries written since the last review, short summaries of older ones, your snapshots, computed figures, rules, your plan answers and reasons, and corrections to Anthropic (${AI.models.entry} and ${AI.models.review}) on your key. Drafts and entries you kept out are never sent.`;
/** The band: the egress sentence with "View what’s sent", then the amber Run with its estimate. `action` swaps
 *  Run for another control (Retry, Set up in Settings). */
function egressBand({ action = null, est = true } = {}) {
  const act = action ?? jrBtn('Run this week’s review', { kind: 'primary' });
  return `<div class="jr-rv-egress" role="group" aria-label="Run this week’s review"><p>${EGRESS} <a href="#whats-sent">View what’s sent</a></p><div class="jr-rv-run">${act}${est ? `<span class="jr-rv-est">${figs(AI.estimate)}</span>` : ''}</div></div>`;
}
const SAMPLE_RUN = 'Sample review · No model was called. Entries you write here aren’t read.';
/** The head: the window, the cutoff and the counts, then who wrote the AI parts (or, on staging, that no model did). */
function head({ env, ai, total = null }) {
  const line = total == null ? STRINGS.reviewHead : STRINGS.reviewHead.replace(/\((\d+) in all\)/, `(${total} in all)`);
  const second = !ai ? '' : env === 'staging' ? `<p>${icon('sample', 13)}${SAMPLE_RUN}</p>` : `<p>AI · ${AI.models.review} on your key</p>`;
  // a dot-joined meta line breaks only at its dots
  return `<div class="jr-rv-head"><p>${line.split(' · ').map((part) => `<span class="jr-rv-nw">${figs(part, { ints: true })}</span>`).join(' · ')}</p>${second}</div>`;
}

// ---- 1. This week in numbers ------------------------------------------------------------------------------------------
const WEEK = [STRINGS.weekValue, STRINGS.weekNet, STRINGS.weekPct, STRINGS.weekCounts];
const week = (env) => jrFrame({ env, tag: jrTag('computed'), label: 'This week in numbers', body: `<div class="jr-rv-week">${WEEK.map((s, i) => `<p>${figs(s, { tint: i === 1 || i === 2, ints: i === 3 })}</p>`).join('')}</div>` });

// ---- 2. The account path (the kit's one implementation) ---------------------------------------------------------------
/** The from-memory board's Path: the sample's snapshots drawn as his likely first weeks would show them, every point
 *  but the last written later. The kit's jrPath reads PATH's `hollow` and `source` when it draws, so the mask is set
 *  for the one call and restored in `finally` (a kit request: a `hollow` option on jrPath). */
function withRecalled(mask, draw) {
  const saved = PATH.map((p) => [p.hollow, p.source]);
  try {
    for (const p of PATH) if (mask(p)) { p.hollow = true; if (p.source === SOURCE_WORD.broker) p.source = SOURCE_WORD.memory; }
    return draw();
  } finally {
    PATH.forEach((p, i) => { [p.hollow, p.source] = saved[i]; });
  }
}
const pathFull = (env, { memory = false } = {}) => (memory ? withRecalled((p) => p.date < LATEST.asOf, () => jrPath(env)) : jrPath(env));
/** On a phone the Path sits behind a peek row that opens it, with its twin, in a bottom sheet. */
const pathPeek = (env) => jrFrame({ env, chipAt: 'foot', label: 'The account path', body: jrPeek({ title: STRINGS.pathTitle, open: false }) });

// ---- 3. One event, not a pattern --------------------------------------------------------------------------------------
const eventFrame = (env) => jrFrame({ env, tag: jrTag('computed'), label: 'One event, not a pattern', body: `<p class="jr-rv-event">${figs(EVENT_TEXT, { tint: true })}</p>` });

// ---- 4. Where the money went since the high ----------------------------------------------------------------------------
function moneyBars() {
  const rows = MONEY_WENT.rows;
  const lossMax = Math.max(...rows.map((r) => -r.usd.value), 0);
  const gainMax = Math.max(...rows.map((r) => r.usd.value), 0);
  const span = lossMax + gainMax;
  const z = (lossMax / span) * 100;
  const bar = (v) => {
    const w = (Math.abs(v) / span) * 100;
    return v < 0 ? `<span class="b l" style="left: ${(z - w).toFixed(2)}%; width: ${w.toFixed(2)}%;"></span>` : `<span class="b r" style="left: ${z.toFixed(2)}%; width: ${Math.max(w, 0.4).toFixed(2)}%;"></span>`;
  };
  const head = '<div class="jr-rv-bh" aria-hidden="true"><span>Position</span><span></span><span class="n">Since the high</span><span class="n">Share of the fall</span></div>';
  const body = rows.map((r) => `<div class="jr-rv-br"><span class="p">${r.label}</span><span class="jr-rv-tr" aria-hidden="true"><span class="z" style="left: ${z.toFixed(2)}%;"></span>${bar(r.usd.value)}</span><span class="v">${jrSigned(usd(r.usd, { sign: true }))}</span>${r.share ? `<span class="s">${pct(r.share, 1)}</span>` : '<span class="s jr-gap">—</span>'}</div>`).join('');
  const aria = rows.map((r) => `${r.label} ${usd(r.usd, { sign: true })}`).join(', ');
  return `<div class="jr-rv-bars" role="img" aria-label="Since the ${fmtDate(MONEY_WENT.since)} high: ${aria}">${head}${body}</div><p class="jr-rv-rest">${figs(STRINGS.moneyWentRest, { tint: true })}</p>`;
}
function moneyTwin() {
  const rem = MONEY_WENT.remainder;
  const rows = [
    ...MONEY_WENT.rows.map((r) => [INSTRUMENTS[r.inst].name, usd(r.usd, { sign: true }), r.share ? pct(r.share, 1) : { t: '— (a gain)' }]),
    [rem.label, usd(rem.usd, { sign: true }), rem.share ? pct(rem.share, 1) : { t: '—' }],
    ['Total', usd(MONEY_WENT.total, { sign: true }), ''], // an empty cell: the twin renders { t: '' } as "[object Object]"
  ];
  return dataTable({ caption: `Where the money went since the ${fmtDate(MONEY_WENT.since)} high, by position; shares are of the ${usd(MONEY_WENT.lost)} lost`, cols: ['Position', 'Since the high', 'Share of the fall'], rows });
}
const moneyFrame = (env) => jrChartFrame(env, { claim: STRINGS.moneyWentCaption, sub: `Each position since the ${fmtDate(MONEY_WENT.since)} high: value now + proceeds of sales − cost of buys − value at the high`, tag: ['computed'], body: moneyBars(), table: moneyTwin() });

// ---- 5. Patterns checked every review ----------------------------------------------------------------------------------
const SUSP = new Map(SUSPICIONS.map((s) => [s.row, s.text]));
const ABOUT = { decided: 'Decided', happened: 'Happened' };
const ZERO_LINE = 'counts start with entries written at the time';
/** A detector row's count: dots below 20, the row's own words for rows 6 and 10, plain text for the memory row. In
 *  the mostly-from-memory state every decided row reads "0 of 0 · counts start with entries written at the time". */
function detCount(d, { memory = null } = {}) {
  if (d.key === 'from_memory') {
    const t = memory ? `${memory.recalled} of ${memory.entries}` : d.text;
    return `<div class="c"><span class="ct">${t}</span></div>`;
  }
  if (memory && d.about === 'decided') {
    if (d.row === 10) return `<div class="c"><span class="cw"><span class="mono">0</span> resolved</span><span class="cb">0 resolved; a score starts at 20</span></div>`;
    return `<div class="c"><span class="cw"><span class="ct">0 of 0</span> · ${ZERO_LINE}</span></div>`;
  }
  if (d.row === 6) return `<div class="c"><span class="cw">${d.text}</span></div>`;
  if (d.row === 10) return `<div class="c"><span class="cw"><span class="mono">${d.k}</span> resolved</span><span class="cb">${d.building}</span></div>`;
  return `<div class="c">${jrDots(d.k, d.n, { label: `${d.title}: ${d.text}` })}</div>`;
}
function detRow(d, { memory = null } = {}) {
  const named = SUSP.has(d.row) ? '<span class="jr-rv-named">You named this</span>' : '';
  const note = d.row === 3 ? '<span class="w">Seen at your snapshots only</span>' : '';
  const no = d.row ? `<span class="no">${d.row}</span>` : '';
  return `<div class="jr-rv-dr${d.key === 'from_memory' ? ' mem' : ''}" role="row"><div role="cell"><span class="t">${no}${d.title}${named}</span>${note}</div><span class="a" role="cell">${d.about ? ABOUT[d.about] : '—'}</span><div role="cell">${detCount(d, { memory })}</div></div>`;
}
/** Suspicions first ("You named this"), then the other rows in their fixed order, then written from memory. */
const DET_ORDER = [...DETECTOR_ROWS.filter((d) => SUSP.has(d.row)), ...DETECTOR_ROWS.filter((d) => !SUSP.has(d.row))].map((d) => det(d.row));
/** The twin: one row per pattern with the count as the row shows it and the line under it. */
function detTwin({ memory = null } = {}) {
  const rows = [...DET_ORDER, MEMORY].map((d) => {
    const zero = memory && d.about === 'decided';
    const count = d.key === 'from_memory' ? (memory ? `${memory.recalled} of ${memory.entries}` : d.text) : zero ? (d.row === 10 ? '0 resolved' : '0 of 0') : d.text;
    const under = d.key === 'from_memory' ? '' : zero ? (d.row === 10 ? '0 resolved; a score starts at 20' : ZERO_LINE) : d.building ?? '';
    const note = [SUSP.has(d.row) ? 'You named this' : '', d.row === 3 ? 'Seen at your snapshots only' : '', under].filter(Boolean).join(' · ');
    return [d.row ?? '—', { t: d.title }, { t: d.about ?? '—' }, /^\d/.test(count) ? count : { t: count }, { t: note || '—' }];
  });
  return dataTable({ caption: `Patterns checked every review, as counted at the ${fmtDate(OCT7.at)} review`, cols: ['#', 'Pattern', 'About', 'Count', 'Note'], rows });
}
const detFrame = (env, { memory = null } = {}) => jrFrame({
  env, tag: jrTag('computed'), label: 'Patterns checked every review',
  body: `<div class="jr-rv-det" role="table" aria-label="Patterns checked every review"><div class="jr-rv-dh" role="row"><span role="columnheader">Pattern</span><span role="columnheader">About</span><span role="columnheader">Count</span></div>${DET_ORDER.map((d) => detRow(d, { memory })).join('')}${detRow(MEMORY, { memory })}</div><p class="jr-rv-cap">10 patterns are checked every review. With this many, one can look notable by chance.</p>${detTwin({ memory })}`,
});

// ---- 6. Findings ---------------------------------------------------------------------------------------------------------
const LABEL = { decided: 'About what you decided', happened: 'About what happened' };
const SIDE = { losses: 'Linked to losses', gains: 'Linked to gains' };
/** A finding's card parts, shared with the overlays row's drawer and sheet. */
export const findingFacts = (f) => ({ label: LABEL[f.about], side: SIDE[f.side], claim: figs(f.claim, { trace: true }), evidence: figs(f.evidence, { ints: true }), count: figs(f.count, { ints: true }), cut: figs(f.cut, { ints: true }) });
/** "Draft a rule from this" shows that review's draft for the finding (at most 3 a review): drawn where the Oct 7
 *  review holds one (rows 2 and 7). A finding linked to gains never has it (G7). */
const hasDraft = (f) => f.side === 'losses' && typeof f.draft === 'string' && f.draft.startsWith('d-');
function findingCard(f, { actions = true } = {}) {
  const x = findingFacts(f);
  const acts = actions ? `<div class="jr-rv-acts">${jrBtn('Show entries', { kind: 'link' })}${hasDraft(f) ? jrBtn('Draft a rule from this', { kind: 'outline' }) : ''}${jrBtn('That’s not right', { kind: 'text' })}</div>` : '';
  return `<article class="jr-rv-fc" aria-label="${x.label} · ${x.side}"><div class="jr-rv-fh"><span class="jr-rv-lab">${x.label}</span><span class="jr-rv-side">${x.side}</span></div><p class="jr-rv-claim">${x.claim}</p><p class="jr-rv-ev">${x.evidence}${sep}${x.count}</p><p class="jr-rv-ev">${x.cut}</p>${acts}</article>`;
}
const keptOut = () => `<p class="jr-rv-kept">${icon('info', 14)}AI figures leave out ${AI.keptOut} entries you kept out</p>`;
const findingsFrame = (env, list) => jrFrame({ env, chipAt: 'foot', label: 'Findings', body: `<div class="jr-rv-fl">${list.map((f) => findingCard(f)).join('')}</div>` });

// ---- 7. Questions your entries raise ---------------------------------------------------------------------------------------
const questionsFrame = (env, list) => jrFrame({ env, chipAt: 'foot', label: 'Questions your entries raise', body: `<div>${list.map((q) => `<div class="jr-rv-q"><p>${figs(q.text, { trace: true })}</p>${jrBtn('Answer in a new entry', { ic: 'edit' })}</div>`).join('')}</div>` });

// ---- 8. Rules this review -----------------------------------------------------------------------------------------------------
const askDots = (k, n) => `<span class="jr-dots" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i${i < k ? ' class="k"' : ''}></i>`).join('')}</span>`;
function ruleBlock(id) {
  const r = RULE[id];
  const v = r.versions[r.versions.length - 1];
  const c = RULE_COUNTS[id];
  const kinds = [['Yes', c.yes], ['No', c.no], ['Doesn’t apply', c.doesnt_apply], ['Not answered', c.not_answered]];
  const asks = same(`<span>asked <span class="mono">${c.asked}</span></span>${kinds.map(([w, k]) => `${sep}<span class="jr-rv-ak">${w} ${askDots(k, c.asked)}<span class="mono">${k}</span></span>`).join('')}`, asksLine(id, { short: true }), `asks ${id}`);
  return `<div class="jr-rv-rule"><div class="jr-rv-rh"><span class="jr-rv-rn">${r.id}</span><p class="jr-rv-rw">${v.wording}</p></div><span class="jr-rv-kind">answered by you</span><div class="jr-rv-asks">${asks}</div><span class="jr-rv-kind">computed</span><p class="jr-rv-cl">${STRINGS.computedNone}</p></div>`;
}
const rulesFrame = (env) => jrFrame({ env, chipAt: 'foot', label: 'Rules this review', body: `<div>${OCT7.rulesThisReview.map((r) => ruleBlock(r.rule)).join('')}</div>` });

// ---- 9. Rules you went ahead against (G4) --------------------------------------------------------------------------------
function wentFrame(env, { phone = false } = {}) {
  const items = OCT7.wentAheadAgainst.map((w) => {
    const line = same(`<span class="mono">${w.rule}</span> · <a href="#">${fmtDate(w.date)} plan (${w.what})</a> · “${w.reason}”`, STRINGS.wentAhead, 'went ahead');
    return `<p class="jr-rv-wl">${line}</p><div class="jr-rv-form"><label class="jr-rv-fld">Was going ahead worth it to you?<span class="jr-rv-in empty" role="textbox" aria-label="Was going ahead worth it to you?"></span></label>${jrBtn('Save', { size: phone ? 'touch' : 'md' })}</div>`;
  }).join('');
  return jrFrame({ env, chipAt: 'foot', label: 'Rules you went ahead against', body: items || '<p class="jr-rv-wl">No rule answered No this week.</p>' });
}

// ---- 10. This week's focus (G4) ------------------------------------------------------------------------------------------
const focusFrame = (env, { phone = false } = {}) => jrFrame({
  env, chipAt: 'foot', label: 'This week’s focus',
  body: `<div>${jrSeg(['Write your own', 'Pick a rule'], 'Write your own', { size: 32, label: 'This week’s focus' })}</div><div class="jr-rv-form"><label class="jr-rv-fld">This week’s focus<span class="jr-rv-in" role="textbox" aria-label="This week’s focus">${OCT7.focus.text}</span></label>${jrBtn('Save focus', { size: phone ? 'touch' : 'md' })}</div>`,
});

// ---- the rail ---------------------------------------------------------------------------------------------------------------
const ranLines = () => `<ul class="jr-rv-lines">${AI.howThisRan.map((l) => `<li>${figs(l, { ints: true })}</li>`).join('')}</ul><div class="jr-rv-pkg"><span>Package</span><span class="mono">${AI.packageId}</span>${jrBtn('Copy', { kind: 'text', ic: 'copy', size: 'sm', attrs: 'aria-label="Copy the package id"' })}</div>`;
const ranFrame = (env, { collapsed = false } = {}) => (collapsed
  ? jrFrame({ env, chipAt: 'foot', label: 'How this ran', body: `<details class="jr-rv-ran"><summary>How this ran</summary>${ranLines()}</details>` })
  : jrFrame({ env, title: 'How this ran', level: 'h3', chipAt: 'foot', body: ranLines() }));
function suspicionsFrame(env, { memory = null } = {}) {
  const count = (row) => { const d = det(row); return memory && d.about === 'decided' ? '0 of 0' : d.text; };
  const items = SUSPICIONS.map((s) => `<li>${s.text} · row ${s.row} · <span class="mono">${count(s.row)}</span></li>`).join('');
  return jrFrame({ env, title: 'Your suspicions', level: 'h3', chipAt: 'foot', body: `<ul class="jr-rv-lines">${items}</ul><a href="/settings#journal" class="jr-more">Edit</a>` });
}
const pastLinks = () => `<ul class="jr-rv-links">${[REVIEWS.sep28, REVIEWS.sep21].map((r) => `<li><a href="/positions/review/${r.id}">${fmtDate(r.at)}</a></li>`).join('')}</ul>`;
const tidyLink = () => `<a href="/positions/journal/tidy" class="jr-more">Tidy up · ${TIDY.details} details waiting</a>`;
const pastPanel = () => jrQuiet(`<h3 style="margin: 0; font-size: 15px; font-weight: 600;">Past reviews</h3>${pastLinks()}${tidyLink()}`, { label: 'Past reviews' });
/** On a phone the rail folds into one frame of collapsed rows: How this ran (collapsed, as the spec draws it), the
 *  suspicions and the past reviews, then Tidy. */
const fold = (title, inner) => `<details class="jr-rv-ran"><summary>${title}</summary>${inner}</details>`;
const phoneRail = (env) => jrFrame({ env, chipAt: 'foot', label: 'How this ran, your suspicions and past reviews', body: `<div class="jr-rv-folds">${fold('How this ran', ranLines())}${fold('Your suspicions', `<ul class="jr-rv-lines">${SUSPICIONS.map((s) => `<li>${s.text} · row ${s.row} · <span class="mono">${det(s.row).text}</span></li>`).join('')}</ul><a href="/settings#journal" class="jr-more">Edit</a>`)}${fold('Past reviews', pastLinks())}</div>${tidyLink()}` });

// =========================================================================================================
// The page
// =========================================================================================================
/** The mostly-from-memory state's counts are the spec's own (Screens → 7, States; Copy → Review states:
 *  "(9 of 11)"), not the sample's: the sample has 34 entries, 8 of them recalled or imported. */
const FIRST_WEEKS = { recalled: 9, entries: 11 };
const MEMORY_STRIP = `Most of your entries so far are written from memory (${FIRST_WEEKS.recalled} of ${FIRST_WEEKS.entries}). Patterns about what you decided use only entries written at the time, so they start as you write them. What happened is below.`;
const OFF_LINE = 'AI reads are off. The counts above need no AI. Turn reads on in Settings › Journal.';

/**
 * The Review page. mode: 'staging' (the authored Oct 7 review on the demo, AI parts as the seed holds them, Sample)
 * · 'off' (production, AI reads off: the computed sections, sections 8–10 and the amber "Save this week’s review")
 * · 'memory' (production, mostly from memory, AI reads on). `phone` reorders for 390: the egress and Run first, the
 * Path behind a peek row, "How this ran" collapsed, and sections 9 and 10 closing the page.
 */
export function reviewPage(mode = 'staging', { scheme = 'dark', minHeight = 0, phone = false } = {}) {
  const env = mode === 'staging' ? 'staging' : 'production';
  const ai = mode !== 'off';
  const memory = mode === 'memory' ? FIRST_WEEKS : null;
  const actions = ai ? jrBtn('Write entry', { kind: 'outline', ic: 'edit' }) : jrHeaderActions('review', { review: 'save' });
  const top = [
    jrHeader({ title: 'Weekly review', sub: JR_SUBLINE, actions }),
    memory ? jrStrip('info', `<span>${figs(MEMORY_STRIP)}</span>`) : '',
    ai ? egressBand() : '',
    head({ env, ai, total: memory ? FIRST_WEEKS.entries : null }),
  ].join('');
  const findings = memory ? FINDINGS.filter((f) => f.about === 'happened') : FINDINGS;
  const questions = memory ? QUESTIONS.filter((q) => q.id === 'q-plan') : QUESTIONS;
  const s = {
    week: sec('This week in numbers', week(env)),
    path: sec('The account path', phone ? pathPeek(env) : pathFull(env, { memory: !!memory })),
    event: sec('One event, not a pattern', eventFrame(env)),
    money: sec('Where the money went since the high', moneyFrame(env)),
    det: sec('Patterns checked every review', detFrame(env, { memory })),
    ai: ai
      ? sec('Findings', `${env === 'staging' ? keptOut() : ''}${findingsFrame(env, findings)}`) + sec('Questions your entries raise', questionsFrame(env, questions))
      : sec('Findings', jrFrame({ env, tag: jrTag('off'), label: 'Findings, questions and drafts', body: `<p class="jr-rv-msg">${OFF_LINE.replace('Settings › Journal', '<a href="/settings#journal">Settings › Journal</a>')}</p>` })),
    rules: sec('Rules this review', rulesFrame(env)),
    went: sec('Rules you went ahead against', wentFrame(env, { phone })),
    focus: sec('This week’s focus', focusFrame(env, { phone })),
  };
  const rail = [ai && !memory ? ranFrame(env, { collapsed: phone }) : '', suspicionsFrame(env, { memory }), memory ? '' : pastPanel()].join('');
  const body = phone
    ? `<div class="jr-rv-main">${[s.week, s.path, s.event, s.money, s.det, s.ai, s.rules].join('')}${phoneRail(env)}${s.went}${s.focus}</div>`
    : jrGrid(`<div class="jr-rv-main">${[s.week, s.path, s.event, s.money, s.det, s.ai, s.rules, s.went, s.focus].join('')}</div>`, rail, { rail: 320 });
  return jrPage({ scheme, minHeight, env, tab: 'review', bar: 'review', label: 'Weekly review', main: top + body, note: env === 'production' ? JR_NOTES.illustrative : '' });
}

// =========================================================================================================
// The states board (16)
// =========================================================================================================
const miniHead = (actions) => `<div class="jr-rv-mh"><b>Weekly review</b><div class="jr-acts">${actions}</div></div>`;
const SAVE_ACTS = jrHeaderActions('review', { review: 'save' });
const STEPS = ['Reading 8 new entries', 'Counting 10 patterns', 'Checking 31 figures against your snapshots', 'Writing findings'];
same(STEPS.join(' · '), 'Reading 8 new entries · Counting 10 patterns · Checking 31 figures against your snapshots · Writing findings', 'running steps');
const steps = (now) => `<ol class="jr-rv-steps" aria-label="Running this week’s review">${STEPS.map((t, i) => { const w = `<span>${figs(t, { ints: true })}</span>`; return i < now ? `<li class="done">${icon('check', 12)}${w}</li>` : i === now ? `<li class="now"><span class="jr-rv-spin" role="progressbar" aria-label="In flight"></span>${w}</li>` : `<li class="next">${w}</li>`; }).join('')}</ol>`;
const skelCard = () => `<div class="jr-rv-sk" aria-hidden="true"><span class="skel" style="height: 12px; width: 34%;"></span><span class="skel" style="height: 18px; width: 100%;"></span><span class="skel" style="height: 18px; width: 82%;"></span><span class="skel" style="height: 12px; width: 46%;"></span></div>`;
const pinned = () => findingCard(FINDINGS[0], { actions: false });
const sectionsList = (names) => `<ul class="jr-rv-secs">${names.map((n) => `<li>${n}</li>`).join('')}</ul>`;
const COMPUTED_SECS = ['This week in numbers', 'The account path', 'One event, not a pattern', 'Where the money went since the high', 'Patterns checked every review', 'Rules this review', 'Rules you went ahead against', 'This week’s focus'];

/** The gains finding on illustrative entries (G7): the tone guide's example, its symbol and date left as the slots the
 *  spec leaves them. The sample has none: its one uncounted add (NVDA, Aug 28) is on a position below its average cost. */
const slot = (w) => `<span class="jr-rv-slot">${w}</span>`;
function gainsCard() {
  const claim = 'Linked to gains, one case: the {symbol} add on {date} was 6.0% below your average cost, the one add pattern 1 didn’t count, and {symbol} is +$410.00 against its average cost. One case isn’t a pattern.';
  const cut = 'Cut the other way: 3 (the TSLA put adds, −$22,140.00 against average cost)';
  const html = figs(claim, { trace: true }).replace(/\{(symbol|date)\}/g, (_, w) => slot(w));
  return `<article class="jr-rv-fc" aria-label="About what you decided · Linked to gains"><div class="jr-rv-fh"><span class="jr-rv-lab">About what you decided</span><span class="jr-rv-side">Linked to gains</span></div><p class="jr-rv-claim">${html}</p><p class="jr-rv-ev">${figs('In 1 of 4 “Added” entries · cites 4', { ints: true })}${sep}${figs('4 counted; rates start at 20.', { ints: true })}</p><p class="jr-rv-ev">${figs(cut, { ints: true })}</p><div class="jr-rv-acts">${jrBtn('Show entries', { kind: 'link' })}${jrBtn('That’s not right', { kind: 'text' })}</div></article>`;
}
function rateRow() {
  const w = wilson(ILLUSTRATIVE_RATE.k, ILLUSTRATIVE_RATE.n);
  const d = det(1);
  const twin = dataTable({ caption: 'One pattern at n ≥ 20 (illustrative)', cols: ['Pattern', 'Found', 'Counted', 'Rate', 'Wilson 95%'], rows: [[d.title, String(ILLUSTRATIVE_RATE.k), String(ILLUSTRATIVE_RATE.n), `${Math.round(w.p * 100)}%`, `${Math.round(w.lo * 100)}–${Math.round(w.hi * 100)}%`]] });
  return `<div class="jr-rv-det" style="container-type: inline-size;"><div class="jr-rv-dr" style="border-bottom: 0; grid-template-columns: minmax(0, 1fr) 96px 236px;"><div><span class="t"><span class="no">1</span>${d.title}<span class="jr-rv-named">You named this</span></span></div><span class="a">${ABOUT.decided}</span><div class="c">${jrRate(w.p, w.lo, w.hi, ILLUSTRATIVE_RATE.n)}</div></div></div>${twin}`;
}

function statesBody({ scheme = 'dark', minHeight = 0 } = {}) {
  const items = [
    { name: 'Too little written', tag: null, when: 'Fewer than 3 saved entries: no review yet, so neither Run nor Save is drawn and “Write entry” stays outlined.', html: `${miniHead(jrBtn('Write entry', { ic: 'edit' }))}<p class="jr-rv-msg">Reviews start once there are 3 saved entries. You have 2.</p>` },
    { name: 'Computed only · slice 3', tag: null, when: 'Sections 1–5 and 8–10 render, with the amber “Save this week’s review” (it stores the computed parts). No AI section, no Run, and no link to a setting that doesn’t exist yet.', html: `${miniHead(SAVE_ACTS)}${sectionsList(COMPUTED_SECS)}` },
    { name: 'No key', tag: ['notConfigured'], when: 'From slice 4, with no Anthropic key (or no model chosen): Run is replaced by “Set up in Settings”, and the amber is “Save this week’s review”. Nothing is requested.', html: `${miniHead(SAVE_ACTS)}<div class="jr-rv-egress"><p>Add an Anthropic key in Settings to turn on AI reads. Writing, numbers and the rulebook work without one.</p><div class="jr-rv-run">${jrBtn('Set up in Settings', { href: '/settings#journal' })}</div></div>` },
    { name: 'Ready', tag: null, when: 'AI reads on, new entries since the last review. The computed sections are already on the page; the egress sentence sits above Run.', html: `<p class="jr-rv-msg">${figs(AI.ready, { ints: true })}</p>${egressBand()}` },
    { name: 'Running', tag: null, wide: true, when: 'Named steps with result-shaped skeletons and the in-flight indicator (amber, rule 16’s list). The computed sections stay on the page.', html: `<div style="display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 16px 24px; align-items: start;">${steps(2)}<div style="display: flex; flex-direction: column; gap: 12px;">${skelCard()}${skelCard()}</div></div>` },
    { name: 'Stale · over a pinned review', tag: null, when: 'Entries written since the review: a burnt-orange strip with its icon. The pinned review stays.', html: `${jrStrip('warn', `<span>${figs('3 entries since this review. Its findings don’t include them.', { ints: true })} · <a href="#">Run again</a></span>`)}${pinned()}` },
    { name: 'Didn’t pass the check', tag: null, when: 'One failed figure fails the read: it is stored as failed, never shown as findings. The failed draft stays collapsed and labelled; the computed sections still show.', html: `${jrStrip('warn', `<span>${figs('This review didn’t pass the number check: 2 figures didn’t match your snapshots. It isn’t shown as findings.', { ints: true })}</span>`)}<details class="jr-rv-fail"><summary>See the failed draft <span class="stag k-solid">Failed draft · not findings</span></summary></details>` },
    { name: 'Request failure · pinned stays', tag: null, when: 'A provider error or timeout: its own line and Retry, under the review sentence. The previous review is never evicted. The second line shows only when the output was cut off (max_tokens).', html: `<p class="jr-rv-wl" style="font-size: 13px; color: var(--text-dim);">${EGRESS}</p>${jrStrip('warn', '<span>AI unavailable · Anthropic returned an error. Your entries are unchanged.</span><span>The answer was cut off.</span>')}<div>${jrBtn('Retry')}</div>${pinned()}` },
    { name: 'Refused', tag: null, when: 'stop_reason “refusal”: nothing from the run is shown, with no automatic retry.', html: jrStrip('warn', '<span>Anthropic declined this review. Nothing from it is shown; the counts above still stand.</span>') },
    { name: 'Already running', tag: null, when: 'A second run while one runs (409 run_in_progress).', html: `<div class="jr-rv-run"><span class="jr-rv-spin" role="progressbar" aria-label="In flight"></span><span class="jr-rv-msg" style="font-size: 14px;">A review is already running.</span></div>` },
    { name: 'Daily limit', tag: null, when: '3 reviews and 60 entry reads a day, counted from journal_ai_runs. No request is sent.', html: jrStrip('info', `<span>${figs('3 reviews today is the limit. The next can run tomorrow.', { ints: true })}</span>`) },
    { name: 'Monthly cap', tag: null, when: '$5.00 a month by default, summed from the stored runs (worst case for one in flight). No request is sent.', html: jrStrip('info', `<span>${figs('This month’s journal AI cap of $5.00 is reached. Change it in Settings.').replace('Settings.', '<a href="/settings#journal">Settings</a>.')}</span>`) },
    { name: 'Over the per-run limit', tag: null, when: 'The check uses the worst case (estimated input plus max_tokens of output), so the $1.00 cap is hard. The run isn’t started.', html: jrStrip('info', `<span>${figs('This review could cost up to $1.12, over the $1.00 limit per run. Keep some entries out, or raise the limit in Settings.')}</span>`) },
    { name: 'A pattern at n ≥ 20', tag: null, wide: true, when: 'Illustrative (every sample row is under 20): a 0–100% track, a phosphor fill to the rate and a steel whisker for the Wilson 95% interval, k = 15 of n = 24. It has a twin.', html: rateRow() },
    { name: 'Sample run', tag: ['sample'], when: 'Staging: Run plays the named steps and returns the authored Oct 7 review. No model is called.', html: `${steps(4)}<p class="jr-rv-msg" style="display: flex; gap: 8px; align-items: center;">${icon('sample', 14)}${SAMPLE_RUN}</p>` },
    { name: 'A finding linked to gains', tag: null, wide: true, when: 'On illustrative entries (G7): the sample has none, its NVDA add being on a position −$2,140.80 against its average cost at Oct 6. Same evidence rules as losses, the counter-cases with their dollars, and no “Draft a rule from this”: a few wins never become a rule. Symbol and date stay the tone guide’s slots.', html: gainsCard() },
  ];
  return statesBoard({ scheme, minHeight, title: 'Journal · Weekly review · states', lead: 'Rule 16’s states with no verdict (canon 2026-10-28): request failure is its own line, a pinned review is never evicted, stale is a warning strip, and a journal read renders no amber text. Loading and empty carry no tag.', items });
}

// =========================================================================================================
// The row
// =========================================================================================================
const rulings = JR_RULINGS.filter((r) => r !== 'rule 10');

export const ROW = {
  key: 'journal-review',
  label: 'Journal · Weekly review',
  section: 'planned',
  css: JR_CSS + RV_CSS,
  specH: 3537,
  spec: {
    title: 'Journal · Weekly review',
    route: '/positions/review · /positions/review/:reviewId',
    job: 'Once a week: what the entries show, counted and cited, and where rules might come from. The computed parts need no model.',
    env: {
      production: 'The owner’s own journal, signed in; visitors meet the Positions private-testing wall (“Sign in to open your journal”). From slice 3 the computed sections with the amber “Save this week’s review”; from slice 4, with AI reads on and his own Anthropic key, the egress sentence, Run and the AI sections. The production boards draw the sample trader’s figures in solid frames, with the board note “Figures illustrative; production shows only the owner’s entries”.',
      staging: 'The Sample journal on the demo account, Oct 7, 2026: the authored Oct 7 review. Run plays the named steps and returns it, “Sample review · No model was called. Entries you write here aren’t read.” Dashed frames with the 8px steel hatch band, one “Sample journal” chip each. Findings 3 and 4 (rows 2 and 3) are composed from facts the spec states, as it prints no wording for them.',
    },
    widgets: [
      { name: 'Egress sentence · Run', source: 'the package builder’s category table (services/journal/package.rs); estimate and worst case from the cost model', production: [['off', 'Off'], ['notConfigured', 'Not set up']], staging: 'sample' },
      { name: 'This week in numbers', source: 'snapshots and money in or out (services/journal/review.rs, facts.rs)', production: 'computed', staging: 'sample' },
      { name: 'The account path', source: 'his snapshots (Stored here) and the chain-linked facts; table twin', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
      { name: 'One event, not a pattern', source: 'the margin call, the snapshots either side, money in', production: 'computed', staging: 'sample' },
      { name: 'Where the money went since the high', source: 'positions, marks and kept trade details; remainder unexplained', production: 'computed', staging: 'sample' },
      { name: 'Patterns checked every review', source: 'services/journal/detectors.rs over kept details and snapshots; the model never counts', production: 'computed', staging: 'sample' },
      { name: 'Findings · questions back', source: 'J2 on Opus 5.5, his key; gated by the number check and the tone scan', production: [['off', 'Off'], ['notConfigured', 'Not set up']], staging: 'sample' },
      { name: 'Rules this review', source: 'his plan answers (answered by you) and computed checks at kept entries, apart', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
      { name: 'Rules you went ahead against · focus', source: 'No answers in the window, read live by rule_check_id; journal_focus; later notes', production: 'local', staging: 'sample' },
      { name: 'Rail: How this ran · suspicions · past reviews · Tidy', source: 'journal_ai_runs usage and package id; journal_suspicions; reviews; kept details waiting', production: 'local', staging: 'sample' },
    ],
    states: [
      { tag: null, when: 'Too little written: “Reviews start once there are 3 saved entries. You have 2.”' },
      { tag: null, when: 'Mostly from memory: “Most of your entries so far are written from memory (9 of 11). Patterns about what you decided use only entries written at the time, so they start as you write them. What happened is below.” Decided rows “0 of 0 · counts start with entries written at the time”; happened rows counted; findings “About what happened” only.' },
      { tag: null, when: 'Computed only, slice 3: sections 1–5 and 8–10 with the amber “Save this week’s review”; no AI section, no Run.' },
      { tag: 'off', when: 'Computed only (AI off), from slice 4: “AI reads are off. The counts above need no AI. Turn reads on in Settings › Journal.”' },
      { tag: 'notConfigured', when: 'No key or model unset: Run is replaced by “Set up in Settings”.' },
      { tag: null, when: 'Ready: “8 new entries since Sep 28 · ≈ $0.31”.' },
      { tag: null, when: 'Running: “Reading 8 new entries · Counting 10 patterns · Checking 31 figures against your snapshots · Writing findings”, with result-shaped skeletons and the in-flight indicator.' },
      { tag: null, when: 'Produced: as the staging board.' },
      { tag: null, when: 'Stale: “3 entries since this review. Its findings don’t include them. · Run again” (burnt orange, with its icon); the pinned review stays.' },
      { tag: null, when: 'Didn’t pass the check: “This review didn’t pass the number check: 2 figures didn’t match your snapshots. It isn’t shown as findings.” + “See the failed draft”, labelled “Failed draft · not findings”.' },
      { tag: null, when: 'Request failure: “AI unavailable · Anthropic returned an error. Your entries are unchanged.” + “Retry”; “The answer was cut off.” on truncated output.' },
      { tag: null, when: 'Refused: “Anthropic declined this review. Nothing from it is shown; the counts above still stand.”' },
      { tag: null, when: 'Already running: “A review is already running.” · Daily limit: “3 reviews today is the limit. The next can run tomorrow.”' },
      { tag: null, when: 'Monthly cap: “This month’s journal AI cap of $5.00 is reached. Change it in Settings.” · Over the per-run limit: “This review could cost up to $1.12, over the $1.00 limit per run. Keep some entries out, or raise the limit in Settings.”' },
      { tag: 'sample', when: 'Staging: “Sample review · No model was called. Entries you write here aren’t read.”' },
      { tag: 'locked', when: 'Signed out (production): the Positions private-testing wall.' },
    ],
    phone: 'One column: the egress sentence and Run first (Run full width, 44px), then the week strip as a 2-column grid, the Path behind a peek row (it opens the Path and its twin in a bottom sheet), the detector table as cards with its twin, findings full width, “How this ran” collapsed, and sections 9 and 10 closing the page with full-width outlined 44px “Save” and “Save focus”. The sticky bottom bar carries an outlined “Write entry” and the outlined “Margin call”; the finding drawer is a bottom sheet with a peek row.',
    acceptance: [
      '6 · On the sample seed the detector column reads 3 of 4 · 4 of 5 · 1 of 1 · 0 of 1 · 0 of 2 · no winning closes · 7 of 11 · 12 of 12 · 1 of 3 · 1 resolved · written from memory 8 of 34, and where the money went −$19,980 · −$2,800 · +$867 · +$195 · remainder −$424.',
      '10 · Every row or finding with n < 20 shows “{k} of {n}” with “{n} counted; rates start at 20”, and its payload has the building shape with no rate or interval field.',
      '11 · All 10 detector rows in the fixed order, zeros included, with the caption “10 patterns are checked every review. With this many, one can look notable by chance.”',
      '12 · A failed number check shows the failed state and no findings.',
      '14 · The egress sentence sits above Run in the same view; the What’s sent drawer equals the package’s categories item for item.',
      '15 · With a key saved and reads off, 0 provider requests while the computed parts render.',
      '16 · With $0.10 of the monthly cap left, a run whose worst case is $0.76 isn’t started and the page shows the cap line.',
      '17 · With a review pinned, a refresh answered 500 leaves it on the page with “AI unavailable · Anthropic returned an error. Your entries are unchanged.”',
      '18 · On staging “Demo · sample data” appears once, in the bar; each frame has one Sample mark; a run shows “No model was called”.',
      '29 · A journal of 1 entry at the time and 10 recalled shows the “Mostly from memory” strip, decided rows at “0 of 0”, happened rows counted, and no “About what you decided” finding.',
      '31 · Exactly one amber fill at 1440 and 390: Run, or “Save this week’s review” where there is no Run.',
      '33 · A week with a No answer lists it under “Rules you went ahead against”; “Was going ahead worth it to you?” adds a later note keyed to that No; “Save focus” stores the focus; no count, rate, score or streak of either appears.',
      '36 · A correct finding linked to gains renders with “Linked to gains”, its counter-cases and no “Draft a rule from this”.',
      '9 and 21 · No success or error fill; textUp/textDown only on signed money; no horizontal overflow at 390 and 393, and no interactive element under 44px with a coarse pointer.',
    ],
    built: [
      { status: 'todo', waits: 'build', slice: '1b', what: 'Slice 1b: the account path (three small multiples, the event rail and its table twin), reused here.' },
      { status: 'todo', waits: 'build', slice: '3', what: 'Slice 3: the Review tab and page with no model: the week in numbers, the event, where the money went, the 10-row detector table with suspicions first, Rules this review with computed checks apart (G8), Rules you went ahead against and “Was going ahead worth it to you?”, This week’s focus with “Save focus” (G4), the amber “Save this week’s review”, the Mostly from memory state, and the rail’s suspicions, past reviews and Tidy.' },
      { status: 'todo', waits: 'build', slice: '4', what: 'Slice 4: the egress sentence and What’s sent, the amber Run with its estimate, findings linked to losses or gains (G7), questions back and drafts, How this ran, and the Running, stale, failed-check, request-failure, refused and cap states.' },
    ],
    rulings,
    code: [
      'apps/dashboard/src/app/pages/positions/review/* (new)',
      'apps/dashboard/src/app/pages/positions/journal/AccountPath.tsx (new, slice 1b)',
      'apps/dashboard/src/app/features/auth/SettingsPage.tsx (suspicions; the AI toggle, models and caps)',
      'apps/api/src/services/journal/{parser,detectors,review,stats,checks}.rs (new, slice 3)',
      'apps/api/src/services/journal/{package,ai,check,scan}.rs (new, slice 4) · apps/api/src/services/llm.rs (complete_journal)',
      'apps/api/src/routes/journal.rs · libs/api/src/lib/demo/journal.ts (the seed)',
      'tools/research-notes/scoring.mjs (a header line naming the Brier port)',
      'design/src/screens/final/journal-review.mjs (step 0)',
    ],
  },
  boards: [
    B('staging', 'Staging · Oct 7 review', 1440, 5865, (o) => reviewPage('staging', o)),
    B('ai-off', 'Production · AI off', 1440, 4078, (o) => reviewPage('off', o)),
    B('from-memory', 'Production · mostly from memory', 1440, 4647, (o) => reviewPage('memory', o)),
    B('phone', 'Phone · staging', 390, 7848, (o) => reviewPage('staging', { ...o, phone: true })),
    B('light', 'Light · staging', 1440, 5865, (o) => reviewPage('staging', o), LIGHT),
    B('states', 'States', 1440, 3710, statesBody),
  ],
};
