// Final · Planned · Journal · Tidy up and import (spec 08, BOARD BRIEF row `journal-tidy-import`): Tidy up
// (/positions/journal/tidy, screen 6, slice 3) and Import history (/positions/journal/import, screen 11, slice 5; its
// "Write about an earlier day" ships in 1a), drawn on the journal kit (./journal-kit.mjs) and the Sample journal
// (design/src/data/journal-sample.mjs); the lanes' contract is tmp/journal-boards/KIT.md.
//
// Canon: Amendments 2026-10-28 (Positions' section tabs, Journal current on its sub-pages), P-2 (closed state words),
// P-3 (staging frames dashed with the hatch band and one "Sample journal" chip), P-4 (board notes on boards only),
// rule 7 (44px targets on a phone), rule 20 (a highlighted span has a tap and focus path), rule 24 (`unrecognized`,
// `not recorded`, `—` in Sans). No CSV and no column mapping: deferred with open question 16.
//
// What the spec prints and what it doesn't. Tidy's count is printed ("14 details in 6 entries"); its details are not
// (GAPS). The Oct 2 panel is the spec's own flow ("A normal day", step 5: the parser finds the trade already kept from
// his sale row and proposes only its link to the Oct 1 plan); the Oct 5 panel reads his printed words. The position
// prompt is the spec's string on the sample's own figures (160 NVDA at $214.00, the Jul 2 import), shown on the
// recalled Aug 4 entry; the recalled-wording offer uses one of the parser's listed phrases ("looking back", Screens →
// 6) on his Aug 21 first entry, in a remembered sentence composed from the sample's Jul 14 TSLA put trade. The import's
// sample paste is composed from the sample's Aug 4 statement positions. Each board says so in a P-4 board note, and
// the spec card's staging line repeats it.
import { B, JR_CSS, JR_ERROR_WORD, JR_RULINGS, dotJoin, jrPage, jrBtn, jrOne, jrFrame, jrTag, jrKind, jrSym, jrCard, jrGap, jrSpan, jrStrip, jrSurface, statesBoard, icon } from './journal-kit.mjs';
import { ENTRY, INSTRUMENTS, PLAN, Q, SCENARIO, SNAPSHOT, TIDY, TRADES, fmtDate, fmtDay, fmtTime, num, recalledLine, usd } from '../../data/journal-sample.mjs';

// =========================================================================================================
// Words
// =========================================================================================================
const TIDY_SUB = 'Details found in your entries. Only the details you keep count in reviews and rule checks.';
const PASTE_NOTE = 'The paste is read in this browser. Only the rows you import are sent to your account.';
const RECALL = 'Part of this reads like it’s written from memory.';
const SPLIT = 'Split the remembered part into an entry about an earlier day';
const MARK = 'Mark the whole entry as from memory';
const AFTER_IMPORT = 'Want to add what you remember thinking? It’ll be marked as written from memory.';
const PARSE_FAILED = 'This couldn’t be read as positions. Nothing was imported.';
const CANT_LOAD = 'Your journal didn’t load. Nothing is lost.';
const BY_PARSER = 'found by the parser';
const BY_AI = 'found by the AI';
const TIDY_COUNT = `${TIDY.details} details in ${TIDY.entries} entries`;
const NVDA_IMP = TRADES.find((x) => x.id === 't-nvda-imp');
const NVDA_POS = `${NVDA_IMP.qty} ${INSTRUMENTS[NVDA_IMP.inst].symbol} at ${usd(NVDA_IMP.price, { dp: 2 })}`;
const D = { oct5: fmtDate(ENTRY['e-oct05-plan'].writtenAt), oct2: fmtDate(ENTRY['e-oct02'].writtenAt), aug4: fmtDate(ENTRY['e-aug04'].about), aug21: fmtDate(ENTRY['e-aug21'].writtenAt) };
const TIDY_NOTE = `Tidy’s count is the spec’s, ${TIDY_COUNT}; the spec prints none of the details. These four panels are composed for the board: ${D.oct5} and ${D.oct2} from his printed words and the spec’s own flow, ${D.aug4} and ${D.aug21} from the sample’s trades and the spec’s examples (“${NVDA_POS}”, and “looking back” from the parser’s list).`;
const IMPORT_NOTE = `The spec prints no sample paste. This one is composed for the board from the sample’s ${fmtDate(SNAPSHOT['s-aug04'].asOf)} statement positions and their marks.`;

const m = (x) => `<span class="mono">${x}</span>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const plain = (s) => String(s).replace(/<[^>]+>/g, '');
/** His printed words with the parser's spans highlighted (each span must occur in the text exactly once). */
function withSpans(text, spans) {
  let out = esc(text);
  for (const s of spans) {
    const e = esc(s);
    if (out.split(e).length !== 2) throw new Error(`journal-tidy-import: span not found once: ${s}`);
    out = out.replace(e, jrSpan(e));
  }
  return out;
}
const cents = (c) => usd(c, { dp: 2 }).replace('$', ''); // a broker's paste writes prices without the dollar sign

// =========================================================================================================
// Tidy up (screen 6): one panel per entry, rows of field · value · origin with Keep / Fix / Not right
// =========================================================================================================
const decide = (size = 'md') => `<div class="jr-ti-b">${jrBtn('Keep', { size })}${jrBtn('Fix', { size })}${jrBtn('Not right', { kind: 'text', size })}</div>`;
const row = ({ field, value, origin }) => `<div class="jr-ti-row" role="listitem"><span class="jr-ti-f">${field}</span><span class="jr-ti-v">${value}</span><span class="jr-ti-o">${origin}</span>${decide()}</div>`;
/** A Tidy panel: the date and kind, the excerpt with its spans, the rows, and "Keep all in this entry". On staging it is
 *  a dashed frame with one "Sample journal" chip. */
function panel(env, { head, excerpt, rows = [], extra = '', keepAll = rows.length > 0 }) {
  const body = `<p class="jr-ti-ex">${excerpt}</p>${rows.length ? `<div class="jr-ti-rows" role="list">${rows.map(row).join('')}</div>` : ''}${extra}`;
  return jrFrame({ env, title: head, level: 'h2', chipAt: 'foot', body, foot: keepAll ? jrBtn('Keep all in this entry') : '', label: plain(head) });
}
const headOf = (date, kind, tickers = []) => `<span class="jr-ti-d">${fmtDay(date)}</span>${jrKind(kind)}${tickers.map(jrSym).join('')}`;

/** Oct 5, the SPY plan: his words; the parser reads the trade it names, the AI its "I’m wrong if" sentence. */
function oct5(env, { parserOnly = false } = {}) {
  const e = ENTRY['e-oct05-plan'];
  const p = PLAN[e.plan];
  const I = INSTRUMENTS[p.inst];
  const tradeSpan = `Buying ${p.qty} ${I.name} at ${num(Q.of(p.price).div(100), 2)}`;
  const wrongSpan = 'I’m wrong if SPY closes above 705';
  if (!e.body.includes(tradeSpan) || !e.body.includes(wrongSpan)) throw new Error('journal-tidy-import: the Oct 5 spans drifted from his printed words');
  return panel(env, {
    head: headOf(e.writtenAt, e.kind, e.tickers),
    excerpt: withSpans(e.body, [tradeSpan, wrongSpan]),
    rows: [
      { field: 'Trade', value: `${I.name} · ${m(p.qty)} at ${m(usd(p.price, { dp: 2 }))}`, origin: BY_PARSER },
      { field: 'I’m wrong if', value: `“${wrongSpan.replace('I’m wrong if ', '')}”`, origin: parserOnly ? BY_PARSER : BY_AI },
    ],
  });
}
/** Oct 2, the TSLA puts trim: the trade is already kept from his sale row, so only its link to the Oct 1 plan is proposed
 *  (A normal day, step 5). */
function oct2(env) {
  const e = ENTRY['e-oct02'];
  const t = TRADES.find((x) => x.id === e.trade);
  const span = `Sold ${t.qty} of the ${INSTRUMENTS[t.inst].short} at ${num(Q.of(t.price).div(100), 2)}`;
  const plan = Object.values(PLAN).find((p) => p.inst === t.inst && p.action === 'sell');
  return panel(env, { head: headOf(e.writtenAt, e.kind, e.tickers), excerpt: withSpans(e.body, [span]), rows: [{ field: 'Plan', value: `This carries out the ${fmtDate(plan.at)} plan`, origin: BY_PARSER }] });
}
/** The recalled Aug 4 statement entry (written Aug 21): a position found in prose, the sample's Jul 2 NVDA import. */
function aug4(env) {
  const t = NVDA_IMP;
  const sym = INSTRUMENTS[t.inst].symbol;
  const span = `${t.qty} ${sym} at ${num(Q.of(t.price).div(100), 0)}`;
  const ask = `<div class="jr-ti-ask"><p class="jr-ti-q">Count “${NVDA_POS}” as a position in this entry?</p><div class="jr-ti-askf"><span class="jr-ti-o">${BY_PARSER}</span><div class="jr-ti-b">${jrBtn('Keep')}${jrBtn('Not right', { kind: 'text' })}</div></div></div>`;
  return panel(env, { head: `<span class="jr-ti-d">${recalledLine('e-aug04')}</span>`, excerpt: `…${jrSpan(span)}…`, extra: ask });
}
/** His Aug 21 first entry, about that day: wording from the parser's list ("looking back", Screens → 6) marks a
 *  remembered part. The offer never re-dates today's numbers: Split (the default) or Mark the whole entry, each with
 *  a date picker. The rest of the entry is unprinted, so the excerpt ends at the span. */
function aug21(env) {
  const e = ENTRY['e-aug21'];
  const t = TRADES.find((x) => x.id === 't-tsla-imp');
  const I = INSTRUMENTS[t.inst];
  const month = new Date(`${t.date}T12:00:00Z`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const remembered = `Looking back, I bought ${t.qty} ${I.symbol} ${I.strike} puts at ${num(Q.of(t.price).div(100), 0)} in ${month}.`;
  const picker = (v) => `<span class="jr-ti-sel" role="combobox" aria-expanded="false" aria-label="About">${v ? `About: ${fmtDate(v)}` : 'About'}${icon('chevron', 16)}</span>`;
  const offer = `<div class="jr-ti-ask"><p class="jr-ti-q jr-ti-qi">${icon('info', 16)}<span>${RECALL}</span></p><div class="jr-ti-opts" role="group" aria-label="${esc(RECALL)}"><div class="jr-ti-opt">${jrBtn(SPLIT)}${picker(t.date)}</div><div class="jr-ti-opt">${jrBtn(MARK, { kind: 'text' })}${picker('')}</div></div><div class="jr-ti-askf"><span class="jr-ti-o">${BY_PARSER}</span>${jrBtn('Not right', { kind: 'text' })}</div></div>`;
  return panel(env, { head: headOf(e.writtenAt, null), excerpt: `${jrSpan(remembered)} …`, extra: offer });
}

const tidyHead = () => `<header class="jr-h"><div><h1 class="display">Tidy up</h1><p class="jr-sub">${TIDY_SUB}</p><p class="jr-ti-count">${m(TIDY.details)} details in ${m(TIDY.entries)} entries</p></div></header>`;
if (`${TIDY.details} details in ${TIDY.entries} entries` !== TIDY_COUNT) throw new Error('journal-tidy-import: count drifted');
const tidyPage = (o) => jrPage({ ...o, env: 'staging', tab: 'journal', label: 'Tidy up', note: TIDY_NOTE, main: jrOne(`${tidyHead()}${oct5('staging')}${oct2('staging')}${aug4('staging')}${aug21('staging')}`) });

// =========================================================================================================
// Import history (screen 11): Choose · Preview · File them, 880 wide; no CSV and no column mapping (open question 16)
// =========================================================================================================
const AUG4 = SNAPSHOT['s-aug04'];
/** The sample paste: the Aug 4 statement's positions with average cost and mark, as a broker lists them, and its total
 *  line, which isn't a position (so it reads `unrecognized`). */
const PASTE = (() => {
  const rows = AUG4.positions.map((p) => {
    const I = INSTRUMENTS[p.inst];
    const sym = I.kind === 'option' ? `${I.symbol} ${I.strike}${I.right === 'put' ? 'P' : 'C'} ${I.expiry.slice(5, 7)}/${I.expiry.slice(8, 10)}/${I.expiry.slice(2, 4)}` : I.symbol;
    return { raw: `${sym}  ${p.qty}  ${cents(p.avg)}  ${cents(p.mark)}`, name: I.name, qty: p.qty, avg: p.avg, mark: p.mark };
  });
  return { rows, bad: [`Total market value  ${usd(AUG4.positionValue, { dp: 2 }).replace('$', '')}`] };
})();
const step = (env, n, title, body, o = {}) => jrFrame({ env, title: `<span class="jr-ti-n">${m(n)}</span>${title}`, level: 'h2', chipAt: 'foot', body, label: `${n}. ${title}`, ...o });
const pasteBox = (lines) => `<span class="jr-ti-paste" role="textbox" aria-multiline="true" aria-label="Paste positions from your broker">${lines.map(esc).join('\n')}</span>`;
function chooseBody(lines = [...PASTE.rows.map((r) => r.raw), ...PASTE.bad]) {
  return `<div class="jr-ti-choose"><div class="jr-ti-optc">${jrBtn('Write about an earlier day', { ic: 'edit' })}</div><div class="jr-ti-pastew"><h3 class="jr-ti-h">Paste positions from your broker</h3>${pasteBox(lines)}<p class="jr-ti-help">${PASTE_NOTE}</p></div></div>`;
}
const td = (l, v, cls = '') => `<td data-l="${l}"${cls ? ` class="${cls}"` : ''}>${v}</td>`;
function previewTable({ skeleton = false } = {}) {
  const head = '<thead><tr><th>Position</th><th>Quantity</th><th>Average cost</th><th>Mark</th></tr></thead>';
  if (skeleton) return `<div class="jr-ti-tw" aria-busy="true"><table class="jr-ti-tbl">${head}<tbody>${PASTE.rows.map(() => `<tr>${['46%', '30%', '50%', '50%'].map((w, i) => td(['Position', 'Quantity', 'Average cost', 'Mark'][i], `<span class="skel" aria-hidden="true" style="display: block; width: ${w}; height: 12px;"></span>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  const ok = PASTE.rows.map((r) => `<tr>${td('Position', r.name)}${td('Quantity', m(r.qty), 'n')}${td('Average cost', m(usd(r.avg, { dp: 2 })), 'n')}${td('Mark', m(usd(r.mark, { dp: 2 })), 'n')}</tr>`).join('');
  const bad = PASTE.bad.map((raw) => `<tr class="jr-ti-bad"><td colspan="3" data-l="As pasted"><span class="mono jr-ti-raw">${esc(raw)}</span></td>${td('Read as', jrGap('unrecognized'))}</tr>`).join('');
  return `<div class="jr-ti-tw" role="region" aria-label="Preview of the pasted rows" tabindex="0"><table class="jr-ti-tbl">${head}<tbody>${ok}${bad}</tbody></table></div>`;
}
const importedLine = () => `Imported ${fmtDate(SCENARIO.date)} · about ${fmtDate(AUG4.asOf)}`;
function fileBody() {
  return `<div class="jr-ti-file"><p class="jr-ti-entry">${jrKind('imported')}<span>${importedLine()}</span></p><div class="jr-ti-filer"><span class="jr-ti-sel" role="combobox" aria-expanded="false" aria-label="About">About: ${fmtDate(AUG4.asOf)}${icon('chevron', 16)}</span><span class="jr-ti-asof">${dotJoin([`As of ${fmtDate(AUG4.asOf)}, ${fmtTime(AUG4.at)}`, '<a href="#about" class="jr-ti-chg">Change</a>'])}</span></div><div class="jr-ti-acts">${jrBtn('Save entry', { kind: 'primary' })}</div></div>`;
}
const importHead = () => '<header class="jr-h"><div><h1 class="display">Import history</h1></div></header>';
const importPage = (o) => jrPage({ ...o, env: 'staging', tab: 'journal', label: 'Import history', note: IMPORT_NOTE, main: jrOne(`${importHead()}${step('staging', 1, 'Choose', chooseBody())}${step('staging', 2, 'Preview', previewTable())}${step('staging', 3, 'File them', fileBody())}`) });

/** The phone: Tidy's cards, then the import's steps, each page stacked at 390 (44px buttons, the preview as cards). */
const phone = (o) => jrSurface({ ...o, gap: 0, html: `${tidyPage({ scheme: o.scheme, minHeight: 0 })}${importPage({ scheme: o.scheme, minHeight: 0 })}` });

// =========================================================================================================
// States (7): Tidy · Empty, Parser only, Couldn’t load; Import · Parsing, Duplicates skipped, Parse failed, Saved
// =========================================================================================================
function states({ scheme = 'dark', minHeight = 0 } = {}) {
  const env = 'production';
  const dupes = PASTE.rows.length; // the same paste filed twice: every row matched by its hash
  const call = ENTRY['e-sep29'].body; // his Sep 29 words, pasted by mistake: no line reads as a position
  const items = [
    { name: 'Tidy · Empty', tag: null, when: 'Every detail is kept, fixed or set aside. No tag.', html: jrFrame({ env, label: 'Tidy up, empty', body: `<p class="jr-ti-p">Nothing to tidy.</p>` }) },
    { name: 'Tidy · Parser only', tag: null, when: 'AI reads off: every row says “found by the parser”; nothing waits on a model.', html: oct5(env, { parserOnly: true }) },
    { name: 'Tidy · Couldn’t load', tag: ['error', JR_ERROR_WORD], when: 'As on the timeline: the cause and Try again. Kept details are on the account; nothing is lost.', html: jrFrame({ env, label: 'Tidy up, couldn’t load', tag: jrTag('error'), body: `<p class="jr-ti-p">${CANT_LOAD}</p><div class="jr-ti-acts">${jrBtn('Try again', { ic: 'refresh' })}</div>` }) },
    { name: 'Import · Parsing', tag: null, when: 'Reading the paste in this browser: the preview’s rows as skeletons at their final height. No words, no tag.', html: step(env, 2, 'Preview', previewTable({ skeleton: true })) },
    { name: 'Import · Duplicates skipped', tag: null, when: 'Merge-only: rows already imported are matched by hash and skipped. Here the same paste is filed twice.', html: step(env, 2, 'Preview', `${previewTable()}${jrStrip('info', `<span>${m(dupes)} rows were already in your journal.</span>`)}`) },
    { name: 'Import · Parse failed', tag: null, when: 'Nothing in the paste reads as a position, so nothing is imported. The paste stays in the box to fix.', html: step(env, 1, 'Choose', `${chooseBody([call])}${jrStrip('warn', PARSE_FAILED)}`) },
    { name: 'Import · Saved', tag: ['local'], wide: true, when: 'One Imported entry, written now and about the day he picked, with the pasted positions as its snapshot; recalled by construction. Then the offer to add what he remembers, marked as written from memory.', html: `<div class="jr-ti-saved">${jrCard({ kind: 'imported', tickers: [...new Set(AUG4.positions.map((p) => INSTRUMENTS[p.inst].symbol))], foot: [importedLine()], label: importedLine() })}<div class="jr-ti-then"><p class="jr-ti-p">${AFTER_IMPORT}</p><div class="jr-ti-acts">${jrBtn('Write about an earlier day', { ic: 'edit' })}</div></div></div>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Journal · Tidy up and import · states', lead: 'Tidy’s and the import’s states, each in the spec’s words where it gives them; Loading and Empty carry no tag. Kept details are append-only decisions; an import is merge-only.', items });
}

// =========================================================================================================
// Row CSS (jr-ti-)
// =========================================================================================================
const TI_CSS = `
  .jr-ti-count { margin: 8px 0 0; font-size: 14px; line-height: 1.5; color: var(--text-dim); } .jr-ti-count .mono { color: var(--phosphor); }
  .jr-ti-d { font-size: 15px; font-weight: 600; }
  .jr-frame .jr-fh h2 .jr-kind, .jr-frame .jr-fh h2 .jr-sym { margin-left: 8px; vertical-align: 1px; }
  .jr-ti-ex { margin: 0; font-size: 16px; line-height: 1.55; color: var(--phosphor); overflow-wrap: anywhere; text-wrap: pretty; }
  .jr-ti-p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--phosphor); }
  .jr-ti-h { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--phosphor); }
  .jr-ti-rows { display: flex; flex-direction: column; border-top: 1px solid var(--line); }
  .jr-ti-row { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto auto; gap: 6px 16px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .jr-ti-f { font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--phosphor); }
  .jr-ti-v { min-width: 0; font-size: 14px; line-height: 1.5; color: var(--phosphor); overflow-wrap: anywhere; }
  .jr-ti-o { font-size: 12.5px; line-height: 1.4; color: var(--steel); white-space: nowrap; }
  .jr-ti-b { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .jr-ti-ask { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--ink-2); }
  .jr-ti-q { margin: 0; font-size: 15px; line-height: 1.5; font-weight: 600; color: var(--phosphor); }
  .jr-ti-qi { display: flex; align-items: flex-start; gap: 8px; } .jr-ti-qi .ico { flex: none; margin-top: 3px; color: var(--steel); }
  .jr-ti-askf { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
  .jr-ti-opts { display: flex; flex-direction: column; gap: 8px; }
  .jr-ti-opt { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .jr-ti-opt .btn { white-space: normal; text-align: left; height: auto; min-height: 36px; padding-top: 8px; padding-bottom: 8px; line-height: 1.3; }
  .jr-ti-sel { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 132px; min-height: 36px; padding: 0 10px; box-sizing: border-box; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font-size: 13px; color: var(--phosphor); white-space: nowrap; }
  .jr-ti-sel .ico { color: var(--steel); }
  .jr-ti-acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .jr-ti-n { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-right: 10px; border-radius: 50%; border: 1px solid var(--line-2); font-size: 12px; vertical-align: 1px; }
  .jr-ti-choose { display: flex; flex-direction: column; gap: 14px; }
  .jr-ti-pastew { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; border-top: 1px solid var(--line); }
  .jr-ti-paste { display: block; min-height: 112px; padding: 10px 12px; box-sizing: border-box; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font: 400 13px/1.7 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: pre-wrap; overflow-wrap: anywhere; }
  .jr-ti-help { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--steel); }
  .jr-ti-tw { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .jr-ti-tw:focus-visible { outline: 2px solid var(--amber-text); outline-offset: 2px; }
  .jr-ti-tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; line-height: 1.45; }
  .jr-ti-tbl th { padding: 8px 12px; text-align: left; font-size: 12px; font-weight: 600; color: var(--steel); background: var(--ink-2); }
  .jr-ti-tbl th:not(:first-child) { text-align: right; }
  .jr-ti-tbl td { padding: 10px 12px; border-top: 1px solid var(--line); color: var(--phosphor); vertical-align: middle; }
  .jr-ti-tbl td.n { text-align: right; white-space: nowrap; }
  .jr-ti-bad td { background: color-mix(in srgb, var(--steel) 8%, transparent); }
  .jr-ti-bad td:last-child { text-align: right; }
  .jr-ti-raw { color: var(--steel); font-size: 13px; }
  .jr-ti-file { display: flex; flex-direction: column; gap: 12px; }
  .jr-ti-entry { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--phosphor); }
  .jr-ti-filer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .jr-ti-asof { font-size: 13px; color: var(--text-dim); }
  .jr-ti-saved { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  .jr-ti-then { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
  @container (max-width: 640px) { .jr-ti-row { grid-template-columns: minmax(0, 1fr) auto; } .jr-ti-row > .jr-ti-v { grid-column: 1 / -1; } .jr-ti-row > .jr-ti-b { grid-column: 1 / -1; } }
  @container (max-width: 560px) {
    .jr-ti-tw { border: 0; border-radius: 0; overflow: visible; }
    .jr-ti-tbl thead { display: none; }
    .jr-ti-tbl, .jr-ti-tbl tbody { display: block; }
    .jr-ti-tbl tr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 12px; padding: 12px; margin-top: 8px; border: 1px solid var(--line); border-radius: 10px; }
    .jr-ti-tbl td { display: flex; flex-direction: column; gap: 2px; padding: 0; border: 0; text-align: left !important; }
    .jr-ti-tbl td::before { content: attr(data-l); font: 600 11px/1.3 'IBM Plex Sans', sans-serif; color: var(--steel); }
    .jr-ti-tbl tr > td:first-child { grid-column: 1 / -1; }
    .jr-ti-bad td { background: transparent; }
  }
  @media (max-width: 599px) { .jr-ti-b .btn, .jr-ti-acts .btn, .jr-ti-opt .btn, .jr-frame .jr-ff .btn { min-height: 44px; } .jr-ti-b { flex: 1 1 100%; } .jr-ti-b .btn { flex: 1 1 0; height: 44px; } .jr-ti-sel { min-height: 44px; } .jr-ti-opt .btn { flex: 1 1 100%; } .jr-ti-acts .btn { flex: 1 1 100%; height: 44px; } }
  @media (max-width: 899px) { .jr-ti-saved { grid-template-columns: minmax(0, 1fr); } }
  @media (pointer: coarse), (max-width: 599px) { .v4 a.jr-ti-chg { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; } .jr-ti-sel { min-height: 44px; } }
`;

// =========================================================================================================
// The row
// =========================================================================================================
const RULINGS = [...JR_RULINGS.filter((r) => ['rule 4', 'rule 5', 'rule 6', 'rule 7', 'rule 13 + D-D', 'rule 17', 'rule 21', 'rule 23', 'rule 24', 'P-2', 'P-3', 'P-4', 'D1', 'D2', 'ruling A'].includes(r)), 'rule 20', 'Amendments 2026-10-28 (section tabs)'];

export const ROW = {
  key: 'journal-tidy-import',
  label: 'Journal · Tidy up and import',
  section: 'planned',
  css: JR_CSS + TI_CSS,
  specH: 3080,
  spec: {
    title: 'Journal · Tidy up and import',
    route: '/positions/journal/tidy · /positions/journal/import',
    job: 'Turn prose into structure afterwards, at his pace: only the details he keeps count. And bring in earlier days, written about or pasted from his broker.',
    env: {
      production: 'The owner’s own entries, signed in: details found by the parser (slice 3) and the AI (slice 4) wait for his Keep, Fix or Not right; a paste is read in his browser and only the rows he files reach his account. Visitors meet the Positions private-testing wall.',
      staging: `The Sample journal on the demo account, ${SCENARIO.label}, every value sample data. Tidy’s count is the spec’s (${TIDY_COUNT}) but its details aren’t printed, so the four panels are composed for the board from his printed words (${D.oct5}, ${D.oct2}), the spec’s own flow and examples, and the sample’s trades (${D.aug4}, ${D.aug21}). The prefilled sample paste is composed from the sample’s ${fmtDate(AUG4.asOf)} statement positions. Board notes say so.`,
    },
    widgets: [
      { name: `Tidy count, “${TIDY_COUNT}”`, source: 'Details the parser (slice 3) and the AI’s entry reads (slice 4) found and he hasn’t decided', production: 'computed', staging: 'sample' },
      { name: 'Tidy panel per entry: excerpt, highlighted spans, field · value · origin, Keep / Fix / Not right, Keep all in this entry', source: 'His sealed text and the details found in it; each decision an append-only row; Fix uses the same unit-bearing inputs', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
      { name: 'Position found in prose', source: 'The parser; kept as a detail, it never changes the sealed snapshot', production: 'computed', staging: 'sample' },
      { name: 'Recalled-wording offer: Split (default) · Mark the whole entry, each with a date picker', source: 'The parser’s list (“fast forward”, “looking back”, “back then”, “in hindsight”) and J1’s flag; Split adds a recalled_span correction, Mark an About-date correction', production: 'computed', staging: 'sample' },
      { name: 'Import · 1 Choose: Write about an earlier day, or Paste positions from your broker', source: 'The composer with About set (slice 1a); the paste stays in this browser', production: null, staging: ['sample', 'Sample paste, prefilled'] },
      { name: 'Import · 2 Preview (“unrecognized” beside the raw line)', source: 'Parsed in the browser; merge-only, rows matched by hash', production: 'computed', staging: 'sample' },
      { name: 'Import · 3 File them: one Imported entry about the day he picks', source: 'One entry of kind Imported, written now, the pasted positions as its snapshot', production: 'local', staging: 'sample' },
    ],
    states: [
      { tag: ['local', 'Stored here'], when: `Tidy loaded: “${TIDY_COUNT}”, one panel per entry with spans highlighted (hover and focus both reveal them) and each row’s origin, “found by the parser” or “found by the AI”.` },
      { tag: null, when: 'Tidy empty: “Nothing to tidy.”' },
      { tag: null, when: 'Tidy loading: panel skeletons at their final height; no tag in the product.' },
      { tag: null, when: 'Tidy, parser only (AI reads off): rows say “found by the parser”.' },
      { tag: ['error', JR_ERROR_WORD], when: `Tidy couldn’t load: “${CANT_LOAD}” and “Try again”, as on the timeline.` },
      { tag: null, when: 'Import empty: the two choices and an empty paste box.' },
      { tag: null, when: 'Import parsing: the preview’s rows as skeletons; no words.' },
      { tag: null, when: 'Import parsed with unrecognized lines: those lines show “unrecognized” beside the raw text.' },
      { tag: null, when: `Duplicates skipped: “N rows were already in your journal.”, N being the paste’s own count (${PASTE.rows.length} when the sample paste is filed twice).` },
      { tag: null, when: `Parse failed: “${PARSE_FAILED}”` },
      { tag: ['local', 'Stored here'], when: `Saved: the Imported entry, “${importedLine()}” on the sample, then “${AFTER_IMPORT}”` },
      { tag: 'locked', when: 'Signed out (production): the Positions private-testing wall, “Sign in to open your journal”, “See it on the demo →”. Not the owner: “This journal is private to the account that owns this Convexa.” and “See it on the demo →”, and “For the site’s operator”, folded, as OwnerOnlyWall ships; no tag.' },
      { tag: 'sample', when: 'Staging: Sample on Tidy; on Import, a sample paste, prefilled. The demo bar once; each frame dashed with the 8px hatch band and one “Sample journal” chip.' },
    ],
    phone: 'Tidy: one card per entry; each row stacks field and origin over its value, and Keep, Fix and Not right share a row of 44px buttons; the recalled-wording choices stack full width. Import: the same three steps stacked; the preview table becomes one card per row with its labels, and “Save entry” is full width at 44px. No sideways scroll.',
    acceptance: [
      'Criterion 8: “unrecognized” and “not recorded” render in Plex Sans; quantities, prices and marks in Mono.',
      'Criterion 27, and Verification → Recalled and dates: “Mark the whole entry as from memory” adds an About-date correction that makes the entry recalled at once and never moves its snapshot’s as_of; a Tidy split creates a recalled entry and a recalled_span and leaves the original’s snapshot untouched.',
      'Criterion 37 (and The rulebook → How it is checked): computed rule checks are derived on read, so a Fix in Tidy, a corrected figure or an About-date correction moves them at once; a recalled entry gets no check.',
      'Verification → Parsers and import: the entry parser (tickers, money, percents, quantities, option notation, dates, action verbs), the recalled-wording list one case each, and paste-positions parsing that keeps an “unrecognized” line and skips a duplicate by its hash.',
      'Open question 16: the Import page has no CSV upload and no column-mapping control; a convexa-journal-v1 export is restored from Settings › Journal, not here.',
      'Criterion 18: on staging, Tidy and Import answer from the demo transport; “Demo · sample data” appears once, in the bar; each frame has data-provenance="sample" and exactly one Sample mark.',
      'Criterion 21: at 390 and 393, in both schemes, scrollWidth equals clientWidth; with a coarse pointer, Keep, Fix, Not right and the import’s buttons are 44px or more.',
      'Criterion 9: no success or error fill; the parse-failed strip is burnt orange with its icon, the duplicates line a quiet info strip.',
    ],
    built: [
      { status: 'todo', waits: 'build', slice: '1a', what: 'Slice 1a: “Write about an earlier day”, the composer with About set (the import page’s first choice).' },
      { status: 'todo', waits: 'build', slice: '3', what: 'Slice 3: the entry parser and Tidy up (/positions/journal/tidy): panels per entry with spans, Keep / Fix / Not right as append-only decisions, Keep all in this entry, and a position found in prose.' },
      { status: 'todo', waits: 'build', slice: '3', what: 'Slice 3: the recalled-wording offer: Split into an entry about an earlier day (a recalled entry and a recalled_span) or Mark the whole entry (an About-date correction), the original sealed and its snapshot unmoved.' },
      { status: 'todo', waits: 'build', slice: '3', what: `Slice 3: the demo seed’s kept details and Tidy’s waiting ones (${TIDY_COUNT}); Review’s “Tidy up · ${TIDY.details} details waiting”.` },
      { status: 'todo', waits: 'build', slice: '4', what: 'Slice 4: details found by the AI’s entry reads (J1) beside the parser’s, each with its origin.' },
      { status: 'todo', waits: 'build', slice: '5', what: 'Slice 5: Import history (/positions/journal/import): paste positions from a broker, read in the browser, the preview with “unrecognized” lines, one Imported entry about the day he picks, merge-only by row hash, and the demo’s sample paste.' },
    ],
    rulings: RULINGS,
    code: [
      'apps/dashboard/src/app/pages/positions/journal/Tidy.tsx (new, slice 3)',
      'apps/dashboard/src/app/pages/positions/journal/Import.tsx (new, slice 5)',
      'apps/api/src/services/journal/parser.rs (new, slice 3) · apps/api/src/services/journal/import.rs (new, slice 5)',
      'apps/api/src/services/journal/ai.rs (J1 details, slice 4) · apps/api/src/routes/journal.rs',
      'libs/api/src/lib/demo/journal.ts (slice 3’s details; slice 5’s sample paste)',
      'design/src/screens/final/journal-tidy-import.mjs · journal-kit.mjs · design/src/data/journal-sample.mjs (step 0)',
    ],
  },
  boards: [
    B('tidy', 'Staging · Tidy', 1440, 1737, (o) => tidyPage(o)),
    B('import', 'Staging · Import', 1440, 1470, (o) => importPage(o)),
    B('phone', 'Phone · staging', 390, 4391, (o) => phone(o)),
    B('states', 'States', 1440, 1875, states),
  ],
};
