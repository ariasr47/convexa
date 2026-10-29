// Final · Planned · Journal · Entry (spec 08, BOARD BRIEF row `journal-entry`; step 0, 2026-10-28).
//
// One entry, /positions/journal/:entryId (Screens → 5): the meta line, his words as sealed, later notes, and the
// panels at the right: Snapshot, Result (on a trim or close), Details found, AI read (rule 16's states, no verdict) and
// Rules ("answered by you" apart from "computed"), with the foot's keep-out toggle and Delete entry…. Built on the
// journal kit (./journal-kit.mjs) and the Sample journal (design/src/data/journal-sample.mjs): figures come from the
// sample module, strings from the spec's Screens and Copy. Where the spec prints nothing for a sample entry (its words,
// its details) a board note says so (P-4). The Sep 29 digest is composed for the board from the entry's own words and
// the sample's figures, and the boards' notes say so. Classes this row adds are `jr-en-`. Units are px.
import {
  B, LIGHT, JR_CSS, JR_NOTES, JR_RULINGS, icon, statesBoard, sw,
  jrPage, jrBtn, jrFrame, jrTag, jrKind, jrGap, jrAnswer, jrAbove, jrWithin, jrSigned, jrStrip, jrInfo, jrPeek,
} from './journal-kit.mjs';
import {
  AI, ANSWER_WORD, CALL, CLOSED_BY_WORD, CORRECTIONS, DETECTOR_ROWS, ENTRY, FINDINGS, INSTRUMENTS, LABEL_WORD, LATER_NOTES,
  PLAN, PLAN_READINGS, REVIEWS, RULE, SCENARIO, SNAPSHOT, SNAPSHOTS, SOURCE_WORD, STRINGS, TRIM, fmtDate, fmtDateTime,
  fmtLong, fmtTime, pct, rMultiple, signedUsd, times, usd,
} from '../../data/journal-sample.mjs';

// ---- words and small helpers ------------------------------------------------------------------------------------
const SEP = '<span class="jr-sep" aria-hidden="true">·</span>';
/** Money, percents, × and signed R inside a sentence, set in Mono (labels and dates stay Sans). */
const FIG_RE = /(?<![\w$.,])[−+]?\$\d[\d,]*(?:\.\d+)?|(?<![\w$.,])[−+]?\d+(?:\.\d+)?(?:%|×)|(?<![\w$.,])[−+]\d+(?:\.\d+)?R\b/g;
const figs = (t) => String(t).replace(FIG_RE, (m) => `<span class="mono">${m}</span>`);
const p = (html) => `<p class="jr-en-p">${html}</p>`;
/** A board note inside a panel (P-4: board only, never product UI). */
const boardNote = (html) => `<p class="jr-en-bn" role="note">${icon('info', 12)}<span><b>Board</b> ${html}</span></p>`;
const mono = (t) => `<span class="mono">${t}</span>`;
const REVIEW_DAY = fmtDate(SCENARIO.review);
/** The per-entry egress line, above every control in the AI read that sends a request (Copy → AI read states). */
const EGRESS = `Reading sends this entry’s text, its numbers, the summaries of your 5 previous entries and your active rules to Anthropic (${AI.models.entry}) on your key.`;
const egress = () => `<p class="jr-en-egress">${EGRESS}</p>`;

// ---- the left column: meta, words, later notes ---------------------------------------------------------------------
/** "Tue Sep 29, 2026 · 2:14 PM" (set by the server) · the kind pill · "about Sep 29". */
const meta = (e) => `<div class="jr-en-meta"><h1 class="display">${fmtLong(e.writtenAt)}</h1>${e.kind ? `${SEP}${jrKind(e.kind)}` : ''}${SEP}<span class="jr-en-about">about ${fmtDate(e.about)}</span></div>`;
const words = (e) => (e.body ? `<p class="jr-en-body">${e.body}</p>` : boardNote('The spec doesn’t print this entry’s words.'));
function laterNotes(e) {
  const notes = LATER_NOTES.filter((n) => n.entry === e.id && n.described === true);
  const list = notes.map((n) => `<article class="jr-en-note"><span class="when">Later note · ${fmtDateTime(n.at)}</span><p>${n.body}</p></article>`).join('');
  return `<section class="jr-en-sec" aria-label="Later notes"><h2>Later notes</h2>${list}<div>${jrBtn('Add a later note', { ic: 'plus' })}</div></section>`;
}
/** Recalled entries' info strip: "Written Aug 21 about Aug 4. Reviews treat this as memory, …". */
const recalledStrip = (e) => jrStrip('info', `Written ${fmtDate(e.writtenAt)} about ${fmtDate(e.about)}. Reviews treat this as memory, not as what you thought at the time.`);

// ---- Snapshot -------------------------------------------------------------------------------------------------------
const row = (label, value, { gap = false, info = '', extra = '' } = {}) => `<div class="jr-en-row"><span class="l">${label}${info ? jrInfo(info) : ''}</span><span class="v${gap ? '' : ' mono'}">${gap ? jrGap(value) : value}</span>${extra}</div>`;
function positionsTable(s) {
  const rows = s.positions.map((x) => { const I = INSTRUMENTS[x.inst]; return `<tr><th scope="row">${I.name}</th><td>${x.qty}${I.kind === 'stock' ? ' sh' : ''}</td><td>${usd(x.avg, { dp: 2 })}</td><td>${usd(x.mark, { dp: 2 })}</td></tr>`; }).join('');
  return `<table class="jr-en-pos"><caption>Positions</caption><thead><tr><th scope="col">Position</th><th scope="col">Qty</th><th scope="col">Avg cost</th><th scope="col">Mark</th></tr></thead><tbody>${rows}</tbody></table>`;
}
/** The Snapshot panel: as-of and source; his typed figures (Stored here), the correction beside the original;
 *  Convexa's lines (Computed); the positions table; "Correct a figure". */
function snapshotPanel(env, sid, { call = false } = {}) {
  const s = SNAPSHOT[sid];
  const prev = SNAPSHOTS[s.k - 1];
  const corr = CORRECTIONS.find((c) => c.snapshot === sid);
  const asOf = s.asOfTime ? `${fmtDate(s.asOf)}, ${fmtTime(s.at)}` : fmtDate(s.asOf);
  const typed = [
    row('Account value', usd(s.accountValue)),
    row('Cash', usd(s.cash)),
    row(corr ? corr.label : 'Margin loan', usd(s.marginLoan, { dp: 2 }), { extra: corr ? `<p class="jr-en-corr">${icon('edit', 12)}<span>${figs(STRINGS.correction)}</span></p>` : '' }),
    // A field he cleared reads `not recorded` like one never typed; a board note says which (Oct 2: spec 08,
    // Corrections, item 19).
    s.maint == null ? row('Maintenance requirement', 'not recorded', { gap: true, extra: s.cleared?.includes('maint') ? boardNote(STRINGS.maintCleared) : '' }) : row('Maintenance requirement', usd(s.maint)),
    row('Buying power', 'not recorded', { gap: true }),
    ...(call ? [row('Call amount', usd(CALL.amount)), row('Due by', fmtDateTime(CALL.dueBy))] : []),
  ];
  const computed = [
    row('Margin used', pct(s.marginUsed, 0), { info: 'About margin used' }),
    s.excessLiquidity == null ? row('Excess liquidity', 'not recorded', { gap: true }) : row('Excess liquidity', signedUsd(s.excessLiquidity)),
    s.change ? row(`Since ${fmtDate(prev.asOf)}`, jrSigned(`${signedUsd(s.change.usd)} (${pct(s.change.pct, 1, { sign: true })})`)) : row('Change since the previous snapshot', '—', { gap: true }),
    row('Leverage', times(s.leverage)),
  ];
  const body = `<p class="jr-en-asof">As of ${asOf}${SEP}${SOURCE_WORD[s.source]}</p><div class="jr-en-gh">${jrTag('stored')}</div><div class="jr-en-rows">${typed.join('')}</div><div class="jr-en-gh">${jrTag('computed')}</div><div class="jr-en-rows">${computed.join('')}</div>${positionsTable(s)}<div><a href="#correct" class="jr-more">Correct a figure</a></div>`;
  return jrFrame({ env, title: 'Account snapshot', chipAt: 'foot', body });
}

// ---- Result (Trimmed or Closed, slice 1b, G6) ------------------------------------------------------------------------
function resultPanel(env, entryId) {
  const t = TRIM[entryId];
  const I = INSTRUMENTS[t.inst];
  const line = (html, tag = '') => `<div class="jr-en-rl"><span>${html}</span>${tag}</div>`;
  const R = t.R.state === 'value' ? mono(rMultiple(t.R.value)) : jrGap(t.R.state);
  const lines = [
    line(`Closed by: ${jrAnswer(CLOSED_BY_WORD[t.closedBy])}`),
    line(`Sold ${mono(t.qty)} of ${I.name} at ${mono(usd(t.price, { dp: 2 }))}`, jrTag('stored')),
    line(`P/L ${jrSigned(usd(t.pl, { dp: 2 }))} against average cost ${mono(usd(t.avg, { dp: 2 }))}`, jrTag('computed')),
    line(`Result against planned risk ${R}`, jrTag('computed')),
    t.label ? line(`Your label: ${jrAnswer(LABEL_WORD[t.label])}`) : '',
  ];
  return jrFrame({ env, title: 'Result', chipAt: 'foot', body: `<div class="jr-en-res">${lines.join('')}</div>` });
}

// ---- Details found (slice 3) ---------------------------------------------------------------------------------------------
const detailsPanel = (env, html) => jrFrame({ env, title: 'Details found', chipAt: 'foot', body: html });

// ---- AI read (slice 4; rule 16's states and anatomy, no verdict, so no amber text) ----------------------------------------
const aiFrame = (env, tag, body, title = 'AI read') => jrFrame({ env, title, tag, chip: false, body, label: 'AI read' });
/** A traced figure: the check glyph and Mono, linked to its fact in the product. */
const traced = (v) => `<span class="jr-en-tr">${icon('check', 12)}<span class="mono">${v}</span></span>`;
/** The Sep 29 read on staging. The digest is composed for the board from the entry's own words (his second sentence is
 *  quoted, so the scan excludes it) and the sample's figures, each traced; the spec prints no digest. */
function callRead(env, { title = 'AI read' } = {}) {
  const e = ENTRY[CALL.entry], s = SNAPSHOT[CALL.snapshot];
  const quote = e.body.slice(e.body.indexOf('I don’t'));
  const digest = `A margin call of ${traced(usd(CALL.amount))}, due ${traced(fmtDateTime(CALL.dueBy))}. Account value ${traced(usd(s.accountValue))}, margin used ${traced(pct(s.marginUsed, 0))}, excess liquidity ${traced(signedUsd(s.excessLiquidity))}. You wrote that the broker raised the NVDA requirement before earnings, and: “${quote}”`;
  const cited = FINDINGS.filter((f) => f.cites.includes(e.id)).map((f) => `<li><a href="/positions/review?finding=${f.id}">${DETECTOR_ROWS.find((d) => d.row === f.row).title}</a><span class="jr-en-src">${SEP}${REVIEW_DAY} review</span></li>`).join('');
  const body = `<section class="jr-en-ais" aria-label="Summary"><h3>How the AI summarised this entry (used in reviews)</h3><p class="jr-en-dg">${digest}</p><div>${jrBtn('That’s not right', { kind: 'text', size: 'sm' })}</div></section><section class="jr-en-ais" aria-label="Cited in"><h3>Cited in</h3><ul class="jr-en-cited">${cited}</ul></section><div><a href="#whats-sent" class="jr-more">What was sent</a></div>${egress()}<div>${jrBtn('Run again', { ic: 'refresh' })}</div>`;
  // Staging: the tag is P-2's word, Sample; the state's words lead the panel (Copy → AI read states: Tag "Sample",
  // Words "Sample read · No model was called").
  return aiFrame(env, env === 'staging' ? jrTag('sample') : '', `${env === 'staging' ? SAMPLE_READ : ''}${body}`, title);
}
/** The AI read's staging words, the panel's first line under its Sample tag. */
const SAMPLE_READ = '<p class="jr-en-sr">Sample read · No model was called</p>';

// ---- Rules (slice 2; computed checks slice 3, G8) -------------------------------------------------------------------------
const groupHead = (word) => `<span class="jr-en-gl">${word}</span>`;
/** "answered by you" on an entry that carries out a plan: the plan's answers, each with its reading as received. */
function planAnswers(planId) {
  const pl = PLAN[planId], rd = PLAN_READINGS[planId], s = SNAPSHOT[rd.snapshot];
  const what = `${fmtDate(pl.at)} plan (${INSTRUMENTS[pl.inst].short})`;
  const items = pl.answers.map((a) => {
    const lim = RULE[a.rule].limit;
    const reading = a.rule === 'R3' && rd.r3 ? `<p class="jr-en-rd">${figs(`Margin used ${pct(rd.r3.value, 0)} of account value (${fmtDate(s.asOf)} snapshot, ${rd.ageDays} day${rd.ageDays === 1 ? '' : 's'} old) · ${a.rule} limit ${lim.value}${lim.unit}`)}${SEP}${rd.r3.above ? jrAbove() : jrWithin()}</p>` : '';
    return `<li><div class="h"><b>${a.rule}</b>${SEP}${what}${SEP}${jrAnswer(ANSWER_WORD[a.answer])}</div>${reading}</li>`;
  }).join('');
  return `<ul class="jr-en-ans">${items}</ul>`;
}
const rulesPanel = (env, body) => jrFrame({ env, title: 'Rules', chipAt: 'foot', body });

// ---- the foot ----------------------------------------------------------------------------------------------------------------
const keepOut = () => `<label class="jr-en-keep">${sw(false, 'Keep this entry out of AI reads')}<span>Keep this entry out of AI reads</span></label>`;
const foot = () => `<div class="jr-en-foot">${keepOut()}${jrBtn('Delete entry…', { kind: 'danger', warn: true })}</div>`;

// ---- pages ------------------------------------------------------------------------------------------------------------------
const page = (o, { env = 'staging', left, right, note }) => jrPage({ ...o, env, tab: 'journal', label: 'Journal entry', note, main: `<div class="jr-en"><div class="jr-en-grid"><div class="jr-en-left">${left}</div><div class="jr-en-right">${right}</div></div>${foot()}</div>` });
const CALL_NOTE = `${JR_NOTES.staging} The digest is composed for this board from the entry’s own words and the sample’s figures; the spec prints none. Details found and Rules hold nothing the spec prints for this entry.`;

/** Staging · the Sep 29 call (Read). */
function callBoard(o = {}) {
  const e = ENTRY[CALL.entry];
  const rules = `<div class="jr-en-grp">${groupHead('answered by you')}</div><div class="jr-en-grp">${groupHead('computed')}</div>${boardNote(`Nothing here in the sample: the entry isn’t a plan, the spec prints no touch for it, and no rule was active on ${fmtDate(e.writtenAt)} (R2 and R3 from ${fmtDate(RULE.R3.versions[0].from)}), so it has no computed check.`)}`;
  const right = `${snapshotPanel('staging', CALL.snapshot, { call: true })}${detailsPanel('staging', boardNote('The spec prints no details for this entry.'))}${callRead('staging')}${rulesPanel('staging', rules)}`;
  return page(o, { left: `${meta(e)}${words(e)}${laterNotes(e)}`, right, note: CALL_NOTE });
}

/** Staging · the recalled Aug 4 statement (Corrected). */
function recalledBoard(o = {}) {
  const e = ENTRY['e-aug04'];
  const note = `${JR_NOTES.staging} The recalled Aug 4 entry: its strip, its statement snapshot and the correction. The spec prints its words, details and read nowhere, so this board draws the panels that differ.`;
  return page(o, { left: `${meta(e)}${recalledStrip(e)}${words(e)}${laterNotes(e)}`, right: snapshotPanel('staging', e.snapshot), note });
}

/** Light · staging: the Oct 2 TSLA puts trim, with its Result and the Rules panel's "answered by you" group. */
function trimBoard(o = {}) {
  const e = ENTRY['e-oct02'];
  const plan = Object.values(PLAN).find((x) => x.inst === TRIM[e.id].inst && x.price === TRIM[e.id].price);
  const rules = `<div class="jr-en-grp">${groupHead('answered by you')}${planAnswers(plan.id)}</div>`;
  const note = `${JR_NOTES.staging} The Oct 2 trim carries out the Oct 1 plan: its Result, and the plan’s answers under “answered by you” (R2’s answer there is derived: the spec doesn’t print it). Details found and the AI read sit as on the Sep 29 board.`;
  return page(o, { left: `${meta(e)}${words(e)}${laterNotes(e)}`, right: `${snapshotPanel('staging', e.snapshot)}${resultPanel('staging', e.id)}${rulesPanel('staging', rules)}`, note });
}

/** Phone · staging: the Sep 29 call stacked, then accordions; "What was sent" leaves the What's sent sheet's peek row. */
function callPhone(o = {}) {
  const e = ENTRY[CALL.entry];
  const acc = (title, open, html = '') => `<section class="jr-en-acc"><button type="button" class="jr-en-acch" aria-expanded="${open}"><span>${title}</span>${icon(open ? 'chevronU' : 'chevron', 18)}</button>${open ? html : ''}</section>`;
  const accs = `<div class="jr-en-accs">${acc('Numbers', true, snapshotPanel('staging', CALL.snapshot, { call: true }))}${acc('Details found', false)}${acc('AI read', true, callRead('staging', { title: '' }))}${acc('Rules', false)}</div>`;
  const main = `<div class="jr-en">${meta(e)}${words(e)}${laterNotes(e)}${accs}${foot()}</div>`;
  const dock = `<div class="jr-en-dock"><section class="jr-sheet" role="dialog" aria-label="What’s sent"><div class="jr-grab" aria-hidden="true"></div>${jrPeek({ title: 'What’s sent to Anthropic', sub: 'No model is called on the demo', open: false, tag: jrTag('sample') })}</section></div>`;
  const html = jrPage({ ...o, env: 'staging', tab: 'journal', label: 'Journal entry', note: CALL_NOTE, main });
  return html.replace(/<\/div>\s*$/, `${dock}</div>`);
}

// ---- states -------------------------------------------------------------------------------------------------------------------
function states(o = {}) {
  const btn = (label, ic = '') => `<div>${jrBtn(label, ic ? { ic } : {})}</div>`;
  const reading = `<div class="jr-en-fly" role="progressbar" aria-label="Reading this entry"><span></span></div><ol class="jr-en-steps"><li class="on">${icon('clock', 12)}Reading this entry</li><li>Finding details</li><li>Writing the summary</li></ol><span class="skel jr-en-sk" style="width: 90%; height: 14px;"></span><span class="skel jr-en-sk" style="width: 76%; height: 14px;"></span><span class="skel jr-en-sk" style="width: 58%; height: 14px;"></span>`;
  const sk = (w, h) => `<span class="skel jr-en-sk" style="width: ${w}%; height: ${h}px;"></span>`;
  const loading = `<div class="jr-en-st2" aria-busy="true" aria-label="Loading the entry"><div class="jr-en-left">${sk(46, 22)}${sk(96, 16)}${sk(88, 16)}${sk(60, 16)}</div>${jrFrame({ env: 'production', title: 'Account snapshot', body: `${sk(100, 14)}${sk(100, 14)}${sk(100, 14)}${sk(70, 14)}` })}</div>`;
  const failed = jrFrame({ env: 'production', label: 'Entry', tag: jrTag('error', 'Couldn’t load'), body: `${p('Your journal didn’t load. Nothing is lost.')}${btn('Try again', 'refresh')}` });
  const del = `<div class="jr-en-del">${keepOut()}${jrStrip('warn', 'Delete this entry’s words and numbers? The timeline keeps a line saying an entry was deleted on Oct 27. What was already sent to your AI provider is under its terms.')}<div class="jr-en-acts">${jrBtn('Delete entry', { kind: 'danger', warn: true })}${jrBtn('Keep it')}</div></div>`;
  const add = REVIEWS.oct7.detectors.find((d) => d.row === 1).cases.find((c) => c.entry === 'e-sep18');
  const r2 = RULE.R2.limit, r3 = RULE.R3.limit;
  const r2Line = (below, verdict) => `<li>R2${SEP}${figs(`${below} below average cost at the add price`)}${SEP}limit ${r2.value}${SEP}${verdict}</li>`;
  const r3Line = (value, verdict) => `<li>R3${SEP}margin used ${value}${SEP}${figs(`limit ${r3.value}${r3.unit}`)}${verdict ? `${SEP}${verdict}` : ''}</li>`;
  const touch = `${p(figs(STRINGS.r2Touch))}<div class="jr-en-acts">${jrBtn('That’s right', { size: 'sm' })}${jrBtn('Not right', { size: 'sm' })}</div>`;
  const illus = (label, answered, computed) => `<div class="jr-en-illus"><span class="jr-en-il">${label}</span>${rulesPanel('production', `<div class="jr-en-grp">${groupHead('answered by you')}${answered}</div><div class="jr-en-grp">${groupHead('computed')}<ul class="jr-en-cmp">${computed}</ul></div>`)}</div>`;
  const computedChecks = `<div class="jr-en-two">${illus('Illustrative Added entry A', touch, `${r2Line(pct(add.below, 1), jrAbove())}${r3Line(jrGap('not recorded'), '')}`)}${illus('Illustrative Added entry B', boardNote('No answer or kept touch on this entry.'), `${r2Line('14.96%', jrWithin())}${r3Line(mono('34%'), jrWithin())}`)}</div>`;
  const items = [
    { name: 'AI read · Off', tag: ['off'], when: 'AI reads are off, the default. Nothing is sent.', html: aiFrame('production', jrTag('off'), p('AI reads are off. Turn them on in Settings › Journal.')) },
    { name: 'AI read · No key', tag: ['notConfigured'], when: 'No Anthropic key saved: no request is made.', html: aiFrame('production', jrTag('notSetUp'), p('Add an Anthropic key in Settings to turn on AI reads. Writing, numbers and the rulebook work without one.')) },
    { name: 'AI read · Model unset', tag: ['notConfigured'], when: 'It links to the “Models for journal reads” control (Settings › Journal).', html: aiFrame('production', jrTag('notSetUp'), p('Choose a model for journal reads in <a href="/settings#journal">Settings › Journal</a>.')) },
    { name: 'AI read · Not read yet', tag: null, when: 'Entries are read with the review unless reading on save is on.', html: aiFrame('production', '', p('Not read yet. It’s read with the next review.')) },
    { name: 'AI read · Reading', tag: null, when: 'Named steps, the in-flight indicator (rule 16’s amber that isn’t text) and skeletons in the result’s shape.', html: aiFrame('production', '', reading) },
    { name: 'AI read · Held', tag: null, when: 'A margin-call entry with reading on save on (slice 5): no request on the day; the egress line sits above “Read it now”.', html: aiFrame('production', '', `${p('No read on the day of a margin call. It’s read with the next review.')}${egress()}${btn('Read it now')}`) },
    { name: 'AI read · Didn’t pass the check', tag: null, when: 'The number check failed: nothing from the read is shown.', html: aiFrame('production', '', `${jrStrip('warn', 'This read didn’t pass the number check, so it isn’t shown.')}${egress()}${btn('Run again', 'refresh')}`) },
    { name: 'AI read · Request failure', tag: null, when: 'Its own line, never shown as idle; a read already shown stays pinned.', html: aiFrame('production', '', `${jrStrip('warn', 'AI unavailable · Anthropic returned an error. Nothing was lost.')}${egress()}${btn('Retry', 'refresh')}`) },
    { name: 'AI read · Refused', tag: null, when: 'No automatic retry.', html: aiFrame('production', '', jrStrip('warn', 'Anthropic declined this read. Nothing from it is shown.')) },
    { name: 'AI read · Cap reached', tag: null, when: 'The month’s cap is spent: no request is sent.', html: aiFrame('production', '', p(figs(`This month’s journal AI cap of ${AI.caps.month} is reached. Change it in Settings.`))) },
    { name: 'AI read · Kept out', tag: null, when: '“Keep this entry out of AI reads” is on: none of its text, numbers, details or notes is sent.', html: aiFrame('production', '', p('Kept out of AI reads since Oct 26.')) },
    { name: 'AI read · Sample', tag: ['sample'], when: 'Staging: no model is called on the demo. The tag is Sample; the words lead the panel. The Sep 29 board draws it in full.', html: aiFrame('staging', jrTag('sample'), `${SAMPLE_READ}<div><a href="#whats-sent" class="jr-more">What was sent</a></div>`) },
    { name: 'Deleted', tag: null, when: 'A tombstone line only; findings that cite it read “out of date”.', html: `<p class="jr-en-tomb">An entry written ${fmtDate(ENTRY[CALL.entry].writtenAt)} was deleted on Oct 27.</p>` },
    { name: 'Loading', tag: null, when: 'Skeletons at the panels’ final height; frames name their metric. No tag.', html: loading },
    { name: 'Couldn’t load', tag: ['error', 'Couldn’t load'], when: 'As on the timeline.', html: failed },
    { name: 'Delete entry · inline confirm', tag: null, when: 'Inline in the foot, never a modal. Burnt orange with the word, never red.', html: del },
    { name: 'Result · not set', tag: null, when: 'The Sep 30 NVDA trim: no exit was named for NVDA, so R reads “not set” and its P/L still shows. The call was open, so no label was asked and no label line is drawn (G6).', html: resultPanel('production', 'e-sep30-trim') },
    { name: 'Rules · computed checks apart from “answered by you”', tag: ['computed'], wide: true, when: `Drawn on illustrative entries: the sample has none, because no Entered or Added entry follows ${fmtDate(RULE.R3.versions[0].from)}, when R2 and R3 became active (G8). “above” carries the warning glyph; “within” is plain; a missing input reads “not recorded”, never within. The two groups are never summed.`, html: computedChecks },
  ];
  return statesBoard({ ...o, title: 'Journal · Entry · states', lead: 'The AI read’s states (rule 16, with no verdict), the page’s states, the delete confirm, a Result with no exit named, and the Rules panel’s computed checks. Production frames are solid; the Sample read is the staging state.', items });
}

// ---- row CSS (jr-en-) ------------------------------------------------------------------------------------------------------
const EN_CSS = `
  .jr-en { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
  .jr-en-grid { display: grid; grid-template-columns: minmax(0, 720px) minmax(0, 400px); gap: 32px; align-items: start; }
  .jr-en-left, .jr-en-right { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  @media (max-width: 1099px) { .jr-en-grid { grid-template-columns: minmax(0, 1fr); } }
  .jr-en-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 0; min-width: 0; }
  .jr-en-meta h1 { margin: 0; font-size: 24px; line-height: 1.25; letter-spacing: -0.01em; }
  .jr-en-about { font-size: 14px; line-height: 1.4; color: var(--text-dim); }
  .jr-en-body { margin: 0; max-width: 68ch; font-size: 17px; line-height: 1.6; color: var(--phosphor); overflow-wrap: anywhere; text-wrap: pretty; }
  .jr-en-p { margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .jr-en-sec { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; border-top: 1px solid var(--line); }
  .jr-en-sec > h2 { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.35; }
  .jr-en-note { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
  .jr-en-note .when { font-size: 12.5px; line-height: 1.4; color: var(--steel); }
  .jr-en-note p { margin: 0; font-size: 16px; line-height: 1.55; color: var(--phosphor); }
  .jr-en-bn { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 6px 10px; border: 1px dashed var(--line-2); border-radius: 8px; background: var(--ink-2); font: 500 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); }
  .jr-en-bn .ico { flex: none; margin-top: 2px; }
  .jr-en-bn b { font-weight: 600; color: var(--phosphor); }
  .jr-en-asof { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--steel); }
  .jr-en-gh { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
  .jr-en-rows { display: flex; flex-direction: column; }
  .jr-en-row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; line-height: 1.4; }
  .jr-en-rows > .jr-en-row:last-child { border-bottom: 0; }
  .jr-en-row .l { display: inline-flex; align-items: center; gap: 2px; min-width: 0; color: var(--steel); }
  .jr-en-row .v { text-align: right; color: var(--phosphor); }
  .jr-en-row .v.mono { font-size: 14px; font-variant-numeric: tabular-nums; }
  .jr-en-row .v .jr-gap { font-size: 13.5px; }
  .jr-en-corr { flex: 1 1 100%; display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--phosphor); }
  .jr-en-row > .jr-en-bn { flex: 1 1 100%; }
  .jr-en-corr .ico { flex: none; margin-top: 3px; color: var(--steel); }
  .jr-en-pos { width: 100%; border-collapse: collapse; font-size: 13px; }
  .jr-en-pos caption { caption-side: top; padding: 4px 0 6px; text-align: left; font-size: 13px; font-weight: 600; color: var(--phosphor); }
  .jr-en-pos thead th { padding: 4px; text-align: right; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); border-bottom: 1px solid var(--line-2); }
  .jr-en-pos thead th:first-child { text-align: left; padding-left: 0; }
  .jr-en-pos tbody th { padding: 6px 4px 6px 0; text-align: left; font-weight: 500; color: var(--phosphor); border-bottom: 1px solid var(--line); }
  .jr-en-pos td { padding: 6px 4px; text-align: right; font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--phosphor); border-bottom: 1px solid var(--line); }
  .jr-en-pos td:last-child { padding-right: 0; }
  .jr-en-res { display: flex; flex-direction: column; }
  .jr-en-rl { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 4px 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 14px; line-height: 1.45; color: var(--phosphor); }
  .jr-en-rl > .stag { margin-top: 1px; }
  .jr-en-rl:last-child { border-bottom: 0; }
  .jr-en-ais { display: flex; flex-direction: column; gap: 6px; }
  .jr-en-ais h3 { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--steel); }
  .jr-en-dg { margin: 0; font-size: 15px; line-height: 1.6; color: var(--phosphor); text-wrap: pretty; }
  .jr-en-sr { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.45; color: var(--steel); }
  .jr-en-tr { white-space: nowrap; }
  .jr-en-tr .ico { margin-right: 2px; vertical-align: -1px; color: var(--steel); }
  .jr-en-cited { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; font-size: 14px; line-height: 1.5; }
  .jr-en-cited a { font-weight: 600; }
  .jr-en-src { color: var(--steel); }
  .jr-en-egress { margin: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--ink-2); font-size: 13px; line-height: 1.5; color: var(--phosphor); text-wrap: pretty; }
  .jr-en-grp { display: flex; flex-direction: column; gap: 8px; }
  .jr-en-gl { font-size: 12px; font-weight: 600; line-height: 1.4; letter-spacing: 0.02em; color: var(--steel); }
  .jr-en-ans, .jr-en-cmp { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; font-size: 14px; line-height: 1.5; color: var(--phosphor); }
  .jr-en-ans .h b { font-weight: 600; }
  .jr-en-rd { margin: 4px 0 0; font-size: 13px; line-height: 1.55; color: var(--phosphor); }
  .jr-en-rd .jr-above, .jr-en-cmp .jr-above { vertical-align: -2px; }
  .jr-en-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; padding-top: 16px; border-top: 1px solid var(--line); }
  .jr-en-keep { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; color: var(--phosphor); cursor: pointer; }
  .jr-en-accs { display: flex; flex-direction: column; gap: 10px; }
  .jr-en-acc { display: flex; flex-direction: column; gap: 10px; }
  .jr-en-acch { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); color: var(--phosphor); font: 600 15px/1.3 'IBM Plex Sans', sans-serif; text-align: left; cursor: pointer; }
  .jr-en-acch .ico { flex: none; color: var(--steel); }
  .jr-en-dock { position: sticky; bottom: 0; z-index: 10; }
  .jr-en-tomb { margin: 0; padding: 12px 14px; border: 1px dashed var(--line-2); border-radius: 12px; font-size: 14px; line-height: 1.5; color: var(--steel); }
  .jr-en-fly { position: relative; height: 3px; overflow: hidden; border-radius: 2px; background: var(--line); }
  .jr-en-fly > span { position: absolute; left: 0; top: 0; bottom: 0; width: 38%; border-radius: 2px; background: var(--amber); }
  .jr-en-steps { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 13px; line-height: 1.4; color: var(--steel); }
  .jr-en-steps li { display: flex; align-items: center; gap: 6px; padding-left: 18px; }
  .jr-en-steps li.on { padding-left: 0; font-weight: 600; color: var(--phosphor); }
  .jr-en-sk { display: block; }
  .jr-en-st2 { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 16px; align-items: start; }
  .jr-en-st2 .jr-en-left { gap: 10px; }
  .jr-en-del { display: flex; flex-direction: column; gap: 12px; }
  .jr-en-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .jr-en-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
  .jr-en-illus { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .jr-en-il { font: 500 12px/1.4 'IBM Plex Mono', monospace; color: var(--steel); }
  @media (max-width: 899px) { .jr-en-two, .jr-en-st2 { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 599px) {
    .jr-en-meta h1 { flex: 1 1 100%; font-size: 22px; }
    .jr-en-meta h1 + .jr-sep { display: none; }
    .jr-en .btn { min-height: 44px; }
    .jr-en .btn.link { min-height: 0; }
    .jr-en .jr-more { min-height: 44px; }
    .jr-en-cited a { display: inline-flex; align-items: center; min-height: 44px; }
    .jr-en-foot { flex-direction: column; align-items: stretch; }
    .jr-en-foot .btn { justify-content: flex-start; }
  }
`;

// ---- the spec card ------------------------------------------------------------------------------------------------------------
const RULINGS = [...JR_RULINGS.filter((r) => r !== 'rule 10' && r !== 'rule 19'), 'rule 20'];
const sep29 = SNAPSHOT[CALL.snapshot];
const oct2 = TRIM['e-oct02'];

export const ROW = {
  key: 'journal-entry',
  label: 'Journal · Entry',
  section: 'planned',
  css: JR_CSS + EN_CSS,
  specH: 3230,
  spec: {
    title: 'Journal · Entry',
    route: '/positions/journal/:entryId',
    job: 'One entry exactly as written, with its numbers, the details found in it, what the AI made of it, and the rules it touched.',
    env: {
      production: 'The owner’s entry, sealed: his words and the server’s written_at, his typed figures (Stored here) beside Convexa’s (Computed), any correction beside the original, and the AI read in rule 16’s states with no verdict. Solid frames. Visitors meet the Positions private-testing wall; another account sees “This journal is private to the account that owns this Convexa.”',
      staging: 'The Sample journal’s entries on the demo account, Oct 7, 2026: dashed frames with the 8px hatch band and one “Sample journal” chip each; the AI read says “Sample read · No model was called”. Composed for the boards, and marked there: the Sep 29 digest (from the entry’s own words and the sample’s figures; the spec prints none) and R2’s answer on the Oct 1 plan (derived, Doesn’t apply). Words and details the spec doesn’t print carry a board note.',
    },
    widgets: [
      { name: 'Meta and words', source: 'journal_entries: sealed text, written_at set by the server, about date; recalled derived on read', production: 'local', staging: 'No tag (D1)' },
      { name: 'Later notes', source: 'journal_later_notes, append-only; a note can be marked “Context for the AI”', production: 'local', staging: 'No tag (D1)' },
      { name: 'Account snapshot', source: 'His typed figures with source and as-of; facts.rs for margin used, excess liquidity, the change and leverage; corrections supersede and the original stays', production: [['local'], ['computed']], staging: ['sample', 'Sample journal'] },
      { name: 'Result', source: 'His typed sale (a kept detail, origin typed); P/L against average cost and R from facts.rs; his label as he chose it (1b)', production: [['local'], ['computed']], staging: ['sample', 'Sample journal'] },
      { name: 'Details found', source: 'The parser (slice 3) or J1 (slice 4); kept, fixed or rejected by him in place or in Tidy', production: 'Origin line: found by the parser, or found by the AI', staging: ['sample', 'Sample journal'] },
      { name: 'AI read', source: `J1 on his own Anthropic key (${AI.models.entry}), read with the review; journal_ai_runs; What was sent from the package table`, production: 'Rule 16’s states, no verdict: Off, Not set up, or none', staging: 'sample' },
      { name: 'Rules', source: 'His plan answers with their reasons and kept touches (answered by you); computed checks derived on read from kept details (checks.rs, slice 3)', production: [['local'], ['computed']], staging: ['sample', 'Sample journal'] },
    ],
    states: [
      { tag: null, when: `Read: “${AI.entryRead.head}”, “How the AI summarised this entry (used in reviews)” with the 60-word digest and “That’s not right”, “Cited in”, “What was sent”, and the per-entry egress line above every control that sends a request: “${EGRESS}”` },
      { tag: 'off', when: 'AI read · Off: “AI reads are off. Turn them on in Settings › Journal.”' },
      { tag: 'notConfigured', when: 'No key: “Add an Anthropic key in Settings to turn on AI reads. Writing, numbers and the rulebook work without one.” Model unset: “Choose a model for journal reads in Settings › Journal.”, linked to “Models for journal reads”.' },
      { tag: null, when: 'Not read yet: “Not read yet. It’s read with the next review.” Reading: “Reading this entry · Finding details · Writing the summary”, with the in-flight indicator.' },
      { tag: null, when: 'Held (slice 5): “No read on the day of a margin call. It’s read with the next review.” + the egress line + “Read it now”.' },
      { tag: null, when: 'Didn’t pass the check: “This read didn’t pass the number check, so it isn’t shown.” + “Run again”. Request failure: “AI unavailable · Anthropic returned an error. Nothing was lost.” + “Retry”, never shown as idle. Refused: “Anthropic declined this read. Nothing from it is shown.”' },
      { tag: null, when: `Cap reached: “This month’s journal AI cap of ${AI.caps.month} is reached. Change it in Settings.” Kept out: “Kept out of AI reads since Oct 26.”` },
      { tag: 'sample', when: 'Staging: tagged Sample, its first line “Sample read · No model was called”.' },
      { tag: null, when: 'Recalled: “Written Aug 21 about Aug 4. Reviews treat this as memory, not as what you thought at the time.”' },
      { tag: 'local', when: `Corrected: ${STRINGS.correction}; the original stays visible.` },
      { tag: null, when: 'Deleted: a tombstone line only, “An entry written Sep 29 was deleted on Oct 27.”; the delete confirm is inline: “Delete this entry’s words and numbers? …” + “Delete entry” · “Keep it”.' },
      { tag: null, when: 'Loading: skeletons at the panels’ final height.' },
      { tag: ['error', 'Couldn’t load'], when: 'Couldn’t load: “Your journal didn’t load. Nothing is lost.” + “Try again”.' },
    ],
    phone: 'One column: meta, words, later notes; then accordions “Numbers”, “Result” (on a Trimmed or Closed entry), “Details found”, “AI read” and “Rules”, each with its count. Drawers become bottom sheets with a grab handle and a peek row: “What was sent” leaves the What’s sent sheet’s peek row docked at the foot. Buttons, the keep-out toggle and Delete entry… stack at 44px; no horizontal overflow at 390 or 393.',
    acceptance: [
      'No control changes an entry’s words or written_at: the page offers “Add a later note” and “Correct a figure”, never an edit; a correction keeps the original visible (criterion 2).',
      `The Sep 29 snapshot reads the worked example: margin used ${pct(sep29.marginUsed, 0)}, excess liquidity ${signedUsd(sep29.excessLiquidity)}, leverage ${times(sep29.leverage)} (criterion 6).`,
      `The Oct 2 trim’s Result reads “P/L ${usd(oct2.pl, { dp: 2 })} against average cost ${usd(oct2.avg, { dp: 2 })}”, “Result against planned risk ${rMultiple(oct2.R.value)}” and “Your label: ${LABEL_WORD[oct2.label]}”; the Sep 30 NVDA trim reads “not set” and draws no label line (criterion 35).`,
      'Figures render in the Mono token with no dotted rule; “not recorded” and “not set” render in Sans; the P/L takes textDown with its “−”, R and the label stay untinted (criteria 8 and 9).',
      'Every control in the AI read that sends a request (“Read it now”, “Run again”, “Retry”) has the per-entry egress line above it, in full, never in a tooltip; the read renders no amber text (criterion 14; the 2026-10-28 rule 16 row).',
      'With reading on save on, a margin-call entry makes 0 provider requests and reads “No read on the day of a margin call. It’s read with the next review.” (criterion 5).',
      'After “Delete entry” the page shows only “An entry written Sep 29 was deleted on Oct 27.”, and findings citing it read “out of date” (criterion 22).',
      'The Aug 4 statement written Aug 21 shows the recalled strip, and its snapshot sorts at Aug 4 (criterion 27).',
      'Rules: computed lines sit apart from “answered by you” and are never summed; a missing input reads “not recorded”, never within (criterion 37).',
      'Staging: each frame has data-provenance="sample" and exactly one Sample mark, and the read says “Sample read · No model was called” (criterion 18).',
      'At 390 and 393, in both schemes: scrollWidth equals clientWidth, and with a coarse pointer no interactive element is under 44px (criterion 21).',
    ],
    built: [
      { status: 'todo', waits: 'build', slice: '1a', what: 'Slice 1a: the entry page: meta, sealed words, later notes, the Snapshot panel (typed figures, computed lines, “Correct a figure”), the recalled strip, “Keep this entry out of AI reads”, and Delete entry… with its inline confirm and the tombstone.' },
      { status: 'todo', waits: 'build', slice: '1b', what: 'Slice 1b: the positions table, leverage, and the Result panel (his sale, P/L, R and his label).' },
      { status: 'todo', waits: 'build', slice: '2', what: 'Slice 2: the Rules panel’s “answered by you” (plan answers with their readings and reasons, and kept touches).' },
      { status: 'todo', waits: 'build', slice: '3', what: 'Slice 3: Details found (the parser) and the computed rule checks, apart from his answers.' },
      { status: 'todo', waits: 'build', slice: '4', what: 'Slice 4: the AI read: the digest, “Cited in”, “What was sent”, the per-entry egress line, and its states.' },
      { status: 'todo', waits: 'build', slice: '5', what: 'Slice 5: the Held state (reading on save, never on a margin-call day).' },
    ],
    rulings: RULINGS,
    code: [
      'apps/dashboard/src/app/pages/positions/journal/ (new: the entry page and its panels)',
      'apps/dashboard/src/app/features/journal/RealPositionRows.tsx (new, slice 1b)',
      'apps/api/src/routes/journal.rs · apps/api/src/services/journal/{store,facts,crypto}.rs (seal, corrections, withdraw, R)',
      'apps/api/src/services/journal/{parser,checks}.rs (new, slice 3) · {package,ai,check,scan}.rs (new, slice 4)',
      'apps/api/src/services/llm.rs (complete_journal, slice 4)',
      'libs/api/src/lib/demo/journal.ts (the sample entries, reads and package)',
      'design/src/screens/final/journal-entry.mjs (these boards)',
    ],
  },
  boards: [
    B('staging', 'Staging · the Sep 29 call', 1440, 2478, (o) => callBoard(o)),
    B('recalled', 'Staging · recalled entry', 1440, 1372, (o) => recalledBoard(o)),
    B('phone', 'Phone · staging', 390, 3100, (o) => callPhone(o)),
    B('light', 'Light · staging', 1440, 2089, (o) => trimBoard(o), LIGHT),
    B('states', 'States', 1440, 3319, (o) => states(o)),
  ],
};
