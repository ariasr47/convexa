// Final · Planned · Journal · New entry (spec 08, BOARD BRIEF row `journal-compose`; row lane B, step 0, 2026-10-28).
//
// The composer at /positions/journal/new, its margin-call mode (?kind=margin_call) and Plan a trade (?kind=plan), from
// docs/product/specs/2026-10-26/08-trade-journal.md: Screens 2 to 4, the Copy table, The rulebook → How it is checked,
// and the user flows "A normal day", "The margin-call day" and "A rule check before a trade". Drawn on the journal kit
// (./journal-kit.mjs) and the Sample journal (design/src/data/journal-sample.mjs): every figure is the sample's, printed
// through its formatters. Classes are prefixed `jr-cp-`; units are px.
//
// The boards replay three sample days as he typed them: the Oct 2 trim (a normal day, its numbers carried from Sep 30
// and updated), the Sep 29 call (margin-call mode, saved at 2:14 PM) and the Oct 5 plan (R3 answered No, with his
// reason). The spec prints no draft time for those days, so their footers draw none; the states board shows the
// composer's states in the spec's own example words (EX below), which are not sample figures.
import { finalDemoNotice } from '../../lib.mjs';
import { B, JR_CSS, JR_RULINGS, LIGHT, dotJoin, icon, jrAbove, jrBtn, jrChips, jrDay, jrEntryCard, jrFig, jrFigs, jrFrame, jrGap, jrPage, jrQuiet, jrSeg, jrStrip, jrTag, jrWithin, statesBoard } from './journal-kit.mjs';
import { AI, ANSWER_WORD, CALL, CLOSED_BY_WORD, ENTRY, INSTRUMENTS, KIND_WORD, LABEL_WORD, MONEY, PLAN, PLAN_READINGS, Q, RULE, SCENARIO, SNAPSHOT, SNAPSHOTS, SOURCE_WORD, STRINGS, TRADES, TRIM, daysBetween, etDate, fmtDate, fmtDateTime, fmtDay, fmtTime, pct, rMultiple, signedUsd, snapshotBefore, usd } from '../../data/journal-sample.mjs';

// ---- the sample days the boards replay ------------------------------------------------------------------------------
const KINDS = ['entered', 'added', 'trimmed', 'closed', 'margin_call', 'money', 'plan', 'thinking'].map((k) => KIND_WORD[k]);
const ANSWERS = ['yes', 'no', 'doesnt_apply'].map((a) => ANSWER_WORD[a]);
const LABELS = ['sound', 'mixed', 'poor'].map((l) => LABEL_WORD[l]);
const CLOSED_BY = ['me', 'broker', 'expiry', 'assignment'].map((c) => CLOSED_BY_WORD[c]);
const SOURCES = ['broker', 'statement', 'memory'].map((s) => SOURCE_WORD[s]);

/** A normal day: the Oct 2 TSLA puts trim, Closed by Me, its sale row typed, labelled Sound; numbers carried from Sep 30. */
const DAY = ENTRY['e-oct02'];
const DAY_S = SNAPSHOT[DAY.snapshot];
const DAY_PREV = SNAPSHOT[DAY.carriedFrom];
const DAY_SALE = TRADES.find((t) => t.id === DAY.trade);
/** The margin-call day: the Sep 29 entry, saved 2:14 PM; the snapshot before it (Sep 25) prefills "More numbers". */
const CALL_E = ENTRY[CALL.entry];
const CALL_S = SNAPSHOT[CALL.snapshot];
const CALL_PREV = snapshotBefore(CALL_S.at);
/** A rule check before a trade: the Oct 5 plan, read against the snapshot before it (Oct 2). */
const PLAN_E = ENTRY['e-oct05-plan'];
const PLAN5 = PLAN[PLAN_E.plan];
const READ5 = PLAN_READINGS[PLAN5.id];
const PLAN_S = SNAPSHOT[READ5.snapshot];
const ANSWERED = Object.fromEntries(PLAN5.answers.map((a) => [a.rule, a]));
const PLAN_RULES = PLAN5.answers.map((a) => a.rule).sort((a, b) => RULE[a].number - RULE[b].number);
/** Money in or out: the $2,500 at 10:05 AM, before that day's 3:40 PM numbers. */
const MONEY_IN = MONEY[0];
const MONEY_S = SNAPSHOTS.find((s) => s.asOf === etDate(MONEY_IN.at));

/** The spec's own example words for states the sample never reaches (Screens 2 to 4, Copy, criterion 25). They are the
 *  spec's examples, not sample figures, and appear only on the states board. `invalid` is this board's own instance of
 *  a value that isn't a plain decimal (owner answer 2026-10-16 (4)); the spec prints none. */
const EX = {
  draftSaved: '2:15 PM',
  draftFrom: '1:58 PM',
  oldFrom: '2026-09-06',
  staleDays: 20,
  sanityTyped: 360400,
  mismatch: -276200,
  invalid: '34k',
  account: 'Acct 123456789',
};
/** The sanity question on the spec's example ($3,604 typed where $36,040 was meant), against the sample's Sep 25 value. */
const SANITY = (() => {
  const s = CALL_PREV;
  const drop = new Q(BigInt(s.accountValue - EX.sanityTyped), BigInt(s.accountValue));
  return `This is ${pct(drop, 0)} below your ${fmtDate(s.asOf)} snapshot (${usd(s.accountValue)}). Keep it?`;
})();

// ---- words (Copy table) ---------------------------------------------------------------------------------------------
const W = {
  placeholder: 'What happened, and what are you thinking right now?',
  placeholderAdd: 'What did you buy or sell, why now, and what would tell you you’re wrong?',
  placeholderPlan: 'What are you about to do, and why?',
  placeholderThink: 'Anything on your mind about the account.',
  placeholderCall: 'What’s happening, and what are you weighing? It doesn’t have to be tidy.',
  remember: 'One thing you want to remember from today',
  callStrip: 'Write it as it is, facts first. Nothing here is graded, and you can add more later. This page doesn’t contact your broker; its notice and deadline are what count.',
  keepOut: 'Keep this entry out of AI reads',
  savedNote: 'Saved entries stay as written. You can add a later note any time.',
  snapFoot: 'These are the numbers you type. Convexa can’t read balances or margin from your broker, and never places, changes or cancels an order.',
  planAbove: 'This journal doesn’t stop or place trades. It keeps what you decided, and why.',
  noNumbers: 'No numbers yet. Add them, or save without; they’ll read “not recorded”.',
  validate: 'Use a plain number like 41210 or 41,210.50',
  accountNo: 'This looks like an account number (9 or more digits in a row). Remove it? Entries never need one.',
  saveFailed: 'Couldn’t save to your account. Your text is kept in this browser until it goes through.',
  noRules: 'No rules yet. Plans still save; rules you adopt later show up here.',
  reasonMissing: 'Add a line on why, or change the answer.',
  moneyFoot: 'Money in or out is taken out of the drawdown, so a deposit can’t hide a loss.',
  afterCall: 'When you’re ready, a review can look at the weeks before this call. Nothing runs until you ask.',
  storage: 'Journal storage isn’t set up on this server, so nothing can be saved yet.',
};

// ---- small helpers ----------------------------------------------------------------------------------------------------
const mono = (t) => `<span class="mono">${t}</span>`;
/** Money and percents inside a printed sentence, set in Mono (the type register): "$2,750", "−$2,750", "84%". */
const figs = (s) => s.replace(/([−+]?\$[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%)/g, '<span class="mono">$1</span>');
/** A typed figure without its unit, which the field draws apart ("$" is visible): 3460300 → "34,603". */
const bare = (cents, dp = 0) => usd(cents, { dp }).replace('$', '');
/** "was $36,021 on Sep 30" under a field: the previous snapshot's value. */
const wasLine = (cents, snap, dp = 0) => `was ${mono(usd(cents, { dp }))} on ${fmtDate(snap.asOf)}`;
const carriedText = (prev, today) => `Carried from ${fmtDate(prev.asOf)} · ${daysBetween(prev.asOf, today)} days old`;
const rv = (label, attrs = '') => `<button type="button" class="jr-cp-rv"${attrs ? ' ' + attrs : ''}>${label}</button>`;
const check = (label, on = false) => `<label class="jr-cp-check"><span class="jr-cp-box${on ? ' on' : ''}" role="checkbox" aria-checked="${on}">${on ? icon('check', 14) : ''}</span>${label}</label>`;
const inset = (caption, html, cls = '') => `<section class="jr-cp-inset${cls ? ' ' + cls : ''}" aria-label="Board inset"><p class="jr-cp-inset-h">${caption}</p>${html}</section>`;
/** "Plan saved · asked 2 rules · went ahead against R3" and the button that names the rule (G1). */
const noRules = (answers) => PLAN_RULES.filter((id) => answers[id]?.answer === 'no');
const planSaveLabel = (answers) => { const no = noRules(answers); return no.length ? `Save plan · going ahead against ${no.join(' and ')}` : 'Save plan'; };
const planSavedLine = (answers) => { const no = noRules(answers); return `Plan saved · asked ${PLAN_RULES.length} rules${no.length ? ` · went ahead against ${no.join(' and ')}` : ''}`; };

/** A field: label, the input with its "$" unit drawn apart, an inline error, and the previous value under it. An empty
 *  number field reads `not recorded` (Sans); a text field (`sans`) holds his words or nothing. */
function field({ label = '', value = '', unit = '$', opt = '', was = '', err = '', focus = false, sans = false, ic = '', empty = 'not recorded', ph = '', w = 0 } = {}) {
  const v = value ? `<span class="v">${value}</span>` : ph ? `<span class="ph">${ph}</span>` : empty ? jrGap(empty) : '';
  const input = `<span class="jr-cp-in${sans ? ' sans' : ''}${focus ? ' focus' : ''}${err ? ' err' : ''}" role="textbox" aria-label="${label || ph}"${w ? ` style="width: ${w}px;"` : ''}>${unit ? `<span class="u">${unit}</span>` : ''}${v}${ic ? icon(ic, 16) : ''}</span>`;
  if (!label) return input;
  return `<label class="jr-cp-f"><span class="jr-cp-fl">${label}${opt ? `<span class="jr-cp-opt">${opt}</span>` : ''}</span>${input}${err ? `<span class="jr-cp-err">${icon('warn', 14)}<span>${err}</span></span>` : ''}${was ? `<span class="jr-cp-was">${was}</span>` : ''}</label>`;
}

/** The composer's top: h1, the meta ("Written when you save · Fri Oct 2" and "About: Today ▾") and the kind chips. */
function head({ title, written, kind = null, chips = true }) {
  return `<header class="jr-cp-head"><h1 class="display">${title}</h1><div class="jr-cp-meta"><span>Written when you save · ${fmtDay(written)}</span><button type="button" class="jr-cp-sel" aria-haspopup="listbox">About: Today${icon('chevron', 14)}</button></div>${chips ? jrChips(KINDS, kind ? KIND_WORD[kind] : null) : ''}</header>`;
}

/** The editor: a quiet panel, a borderless textarea in Plex Sans 17/1.6, about 68ch wide, min-height 320. */
function editor({ text = '', placeholder = W.placeholder, focus = false, caret = false, short = false } = {}) {
  return `<div class="jr-q jr-cp-ed${focus ? ' is-focus' : ''}"><div class="jr-cp-ta${text ? '' : ' ph'}${short ? ' short' : ''}" role="textbox" aria-multiline="true" aria-label="Entry"${text ? '' : ` aria-placeholder="${placeholder}"`}>${text || placeholder}${caret ? '<span class="jr-cp-caret" aria-hidden="true"></span>' : ''}</div></div>`;
}

/** The footer: an optional line above, the draft line (left), "Discard draft" and the screen's one amber (right), and the
 *  promise under them. */
function foot({ primary, draft = '', above = '' } = {}) {
  return `<div class="jr-cp-foot">${above ? `<p class="jr-cp-above">${above}</p>` : ''}<div class="jr-cp-fr"><span class="jr-cp-draft">${draft}</span><span class="jr-cp-acts">${jrBtn('Discard draft', { kind: 'text' })}${primary}</span></div><p class="jr-foot">${W.savedNote}</p></div>`;
}
const SAVE_ENTRY = jrBtn('Save entry<kbd class="jr-cp-k">⌘↵</kbd>', { kind: 'primary', attrs: 'aria-keyshortcuts="Meta+Enter"' });
const SAVING = jrBtn('<span class="jr-cp-spin" aria-hidden="true"></span>Save entry', { kind: 'primary', attrs: 'aria-busy="true"' });

// ---- the snapshot column ------------------------------------------------------------------------------------------------
const sourceSeg = (source) => `<div class="jr-cp-line"><span class="caps">Source</span>${jrSeg(SOURCES, SOURCE_WORD[source], { size: 32, label: 'Source' })}</div>`;
const carriedRow = (text, update) => `<div class="jr-cp-carry"><span>${text}</span>${jrSeg(['Unchanged', 'Update numbers'], update ? 'Update numbers' : 'Unchanged', { size: 32, label: 'Numbers' })}</div>`;
/** A typed position row: "NVDA · 160 sh · avg $208.95 · mark $199.28"; options "TSLA · 10 × Dec 18 ’26 440 P · …". */
function posRow(p) {
  const I = INSTRUMENTS[p.inst];
  const what = I.kind === 'option' ? `${p.qty} × ${I.name.replace(`${I.symbol} `, '')}` : `${p.qty} sh`;
  return `<div class="jr-cp-pos">${dotJoin([`<b class="mono">${I.symbol}</b>`, mono(what), `avg ${mono(usd(p.avg, { dp: 2 }))}`, `mark ${mono(usd(p.mark, { dp: 2 }))}`])}</div>`;
}
const positions = (s, { edit = true } = {}) => `<div class="jr-cp-sub"><div class="jr-cp-subh"><span class="caps">Positions</span>${edit ? jrBtn('Edit positions', { size: 'sm' }) : ''}</div><div>${s.positions.map(posRow).join('')}</div></div>`;
/** The Computed box: margin used, excess liquidity and the change since the previous snapshot, from the shared facts
 *  module before save. Only the signed change takes textDown, with its minus. */
function computedBox(s, prev) {
  const xl = s.excessLiquidity;
  return `<div class="jr-cp-sub"><div class="jr-cp-subh">${jrTag('computed')}</div>${jrFigs([
    jrFig({ label: 'Margin used', value: pct(s.marginUsed, 0), info: 'About margin used' }),
    jrFig({ label: 'Excess liquidity', value: xl == null ? 'not recorded' : signedUsd(xl), gap: xl == null }),
    jrFig({ label: `Since ${fmtDate(prev.asOf)}`, value: `${signedUsd(s.change.usd)} (${pct(s.change.pct, 1, { sign: true })})`, signed: true }),
  ])}</div>`;
}
/** "Account snapshot" (Stored here): staging dashed with its one "Sample journal" chip; production solid. */
const snapshotFrame = (env, body) => jrFrame({ env, title: 'Account snapshot', tag: jrTag('stored'), body, foot: W.snapFoot, label: 'Account snapshot' });

/** The normal day's snapshot column: carried from Sep 30, Update open, the fields with their previous values, source,
 *  positions and the Computed box. Account value and margin loan are retyped; the maintenance requirement reads
 *  `not recorded`, as the sample's Oct 2 snapshot records it. */
function daySnapshot(env) {
  const fields = `<div class="jr-cp-fields">${[
    field({ label: 'Account value', value: bare(DAY_S.accountValue), was: wasLine(DAY_PREV.accountValue, DAY_PREV) }),
    field({ label: 'Cash', value: bare(DAY_S.cash), was: wasLine(DAY_PREV.cash, DAY_PREV) }),
    field({ label: 'Margin loan', value: bare(DAY_S.marginLoan, 2), was: wasLine(DAY_PREV.marginLoan, DAY_PREV, 2) }),
    field({ label: 'Maintenance requirement', value: DAY_S.maint == null ? '' : bare(DAY_S.maint), was: DAY_PREV.maint == null ? '' : wasLine(DAY_PREV.maint, DAY_PREV) }),
    field({ label: 'Buying power', opt: 'optional' }),
  ].join('')}</div>`;
  const body = `${carriedRow(carriedText(DAY_PREV, DAY_S.asOf), true)}${fields}<div>${rv('+ Margin call')}</div>${sourceSeg(DAY_S.source)}${positions(DAY_S)}${computedBox(DAY_S, DAY_PREV)}`;
  return snapshotFrame(env, body);
}

// ---- the editor column's details -----------------------------------------------------------------------------------------
/** The sale row on a Trimmed or Closed entry (1b, G6): "Sold [5] of [TSLA Dec 18 ’26 440 P ▾] at $ [13.10]". */
function saleRow(t) {
  const I = INSTRUMENTS[t.inst];
  return `<div class="jr-cp-line jr-cp-sale" role="group" aria-label="Sale"><span>Sold</span>${field({ value: String(t.qty), unit: '', ph: 'quantity', w: 72 })}<span>of</span><button type="button" class="jr-cp-sel jr-cp-pick" aria-haspopup="listbox">${I.name}${icon('chevron', 14)}</button><span>at</span>${field({ value: bare(t.price, 2), ph: 'price', w: 112 })}</div>`;
}
/** Trimmed or Closed: Closed by, the sale row, and "How did the decision look, apart from the result?" (his label, G6). */
function trimDetails(e, t) {
  const q = 'How did the decision look, apart from the result?';
  return jrQuiet(`<div class="jr-cp-line"><span class="jr-cp-lab">Closed by:</span>${jrSeg(CLOSED_BY, CLOSED_BY_WORD[e.closedBy], { size: 32, label: 'Closed by' })}</div>${saleRow(t)}<div class="jr-cp-q"><span class="jr-cp-lab">${q}</span>${jrSeg(LABELS, e.label ? LABEL_WORD[e.label] : null, { label: q })}</div>`, { label: KIND_WORD[e.kind], cls: 'jr-cp-det' });
}
/** "+ I’m wrong if…" open (Plan a trade opens it by default): "Exit at $ ___" and "No exit set". */
const exitOpen = () => `<fieldset class="jr-cp-open"><legend>I’m wrong if…</legend><div class="jr-cp-line"><span class="jr-cp-lab">Exit at</span>${field({ value: '', empty: '', w: 132 })}${check('No exit set')}</div></fieldset>`;

// ---- Plan a trade: "Your rules" -------------------------------------------------------------------------------------------
const versionAt = (r, date) => [...r.versions].reverse().find((v) => v.from <= date);
/** R3's reading as received, and the projection with its assumption (no maintenance-rate assumption). */
function readingBlock(ruleId) {
  const r = READ5.r3;
  if (!r || r.rule !== ruleId) return '';
  const b = READ5.borrow;
  const line1 = `${r.metric} ${mono(pct(r.value, 0))} of account value (${fmtDate(PLAN_S.asOf)} snapshot, ${mono(String(READ5.ageDays))} days old) · ${r.rule} limit ${mono(`${r.limit}%`)} · ${r.above ? jrAbove() : jrWithin()}`;
  const line2 = b ? `If the ${mono(usd(b.usd))} is borrowed: margin used <span class="jr-cp-nw">${mono(pct(b.before, 0))} → ${mono(pct(b.after, 0))}</span>` : '';
  return `<div class="jr-cp-rd"><div class="jr-cp-subh">${jrTag('computed')}</div><p>${line1}</p>${line2 ? `<p>${line2}</p>` : ''}</div>`;
}
/** The required line on a No (G1): his words, or empty with "Add a line on why, or change the answer." under it. */
function whyField(reason, missing) {
  return `<label class="jr-cp-f jr-cp-why"><span class="jr-cp-fl">Why go ahead anyway?</span><span class="jr-cp-in sans${missing ? ' err focus' : ''}" role="textbox" aria-label="Why go ahead anyway?" aria-required="true"${missing ? ' aria-invalid="true"' : ''}>${reason ? `<span class="v">${reason}</span>` : ''}</span>${missing ? `<span class="jr-cp-err">${icon('warn', 14)}<span>${W.reasonMissing}</span></span>` : ''}</label>`;
}
/** One active rule: number (Mono 13), wording (Sans 15), check question, the reading, the 44px segment (unselected until
 *  he answers; the reading never pre-fills it), and the why on a No. */
function ruleBlock(id, { answer = null, reason = '', missing = false } = {}) {
  const r = RULE[id];
  const v = versionAt(r, PLAN5.at);
  const q = v.check ?? r.check;
  return `<div class="jr-cp-rule" role="group" aria-label="${id}"><div class="jr-cp-rh"><span class="jr-cp-rn">${id}</span><p class="jr-cp-rw">${v.wording}</p></div><p class="jr-cp-rq">${q}</p>${readingBlock(id)}${jrSeg(ANSWERS, answer ? ANSWER_WORD[answer] : null, { label: `${id}: ${q}` })}${answer === 'no' ? whyField(reason, missing) : ''}</div>`;
}
const rulesBody = (answers = {}, { missing = false } = {}) => `<div class="jr-cp-rules">${PLAN_RULES.map((id) => ruleBlock(id, { answer: answers[id]?.answer ?? null, reason: missing ? '' : answers[id]?.reason ?? '', missing: missing && answers[id]?.answer === 'no' })).join('')}</div>`;
const rulesFrame = (env, answers, o) => jrFrame({ env, title: 'Your rules', body: rulesBody(answers, o), label: 'Your rules' });

// =========================================================================================================
// Boards
// =========================================================================================================
const page = (o, main) => jrPage({ ...o, env: 'staging', tab: 'journal', label: 'New entry', main: `<div class="jr-cp">${main}</div>` });
const grid = (left, right) => `<div class="jr-cp-grid"><div class="jr-cp-col">${left}</div><div class="jr-cp-col">${right}</div></div>`;

/** Staging · normal day: the Oct 2 trim, its sale row and Sound picked (G6), the snapshot carried from Sep 30 with
 *  Update open, the Computed box and the source segment. */
function dayPage(o = {}) {
  const left = `${editor({ text: DAY.body })}<div class="jr-cp-revs">${rv('+ I’m wrong if…')}${rv('+ Revisit on…')}${rv('+ Money in or out')}</div>${trimDetails(DAY, DAY_SALE)}${check(W.keepOut)}${foot({ primary: SAVE_ENTRY })}`;
  return page(o, `${head({ title: 'New entry', written: DAY.writtenAt, kind: DAY.kind })}${grid(left, daySnapshot('staging'))}`);
}

/** The margin-call cross-check: two neutral lines with no verdict, computed before save. */
const crossCheck = (lines) => `<div class="jr-cp-xc" role="group" aria-label="Cross-check"><div class="jr-cp-subh">${jrTag('computed')}</div>${lines.map((l) => `<p>${figs(l)}</p>`).join('')}</div>`;
/** Due by is a typed record (rule 13 with D-D), so its value is Mono, as the entry's snapshot prints it. */
const callNumbers = () => [
  field({ label: 'Call amount', value: bare(CALL.amount) }),
  field({ label: 'Due by', value: fmtDateTime(CALL.dueBy), unit: '', ic: 'calendar' }),
  field({ label: 'Account value now', value: bare(CALL_S.accountValue) }),
];
/** Margin call mode: the strip, the three-number row, "More numbers" (open: the loan and maintenance typed that day),
 *  positions unchanged, the cross-check (matching), the editor; then the board inset of what follows the save. */
function callPage(o = {}) {
  const more = `<div class="jr-cp-more">${rv(`More numbers${icon('chevronU', 14)}`, 'aria-expanded="true"')}<div class="jr-cp-fields">${field({ label: 'Margin loan', value: bare(CALL_S.marginLoan, 2), was: wasLine(CALL_PREV.marginLoan, CALL_PREV, 2) })}${field({ label: 'Maintenance requirement', value: bare(CALL_S.maint), was: CALL_PREV.maint == null ? '' : wasLine(CALL_PREV.maint, CALL_PREV) })}</div><div class="jr-cp-line"><span class="caps">Positions</span><span>Unchanged since ${fmtDate(CALL_PREV.asOf)}</span>${jrBtn('Edit positions', { kind: 'text', size: 'sm' })}</div></div>`;
  const left = `${jrStrip('info', W.callStrip)}<div class="jr-cp-three">${callNumbers().join('')}</div>${more}${crossCheck(STRINGS.callCross)}${editor({ text: CALL_E.body, placeholder: W.placeholderCall })}${field({ ph: W.remember, unit: '', sans: true })}${check(W.keepOut)}${foot({ primary: SAVE_ENTRY })}`;
  const at = CALL_E.writtenAt;
  const after = inset('Board inset · after save: back on the timeline, the new card focused', `${jrDay(etDate(at), { snapshot: CALL_S.id })}${jrStrip('info', `<span>Saved · ${fmtDay(at)}, ${fmtTime(at)}. It’s in the record as you wrote it.</span><span>${jrBtn('Add a later note when it’s resolved', { size: 'sm' })}</span>`)}${jrEntryCard(CALL.entry, { foot: [], more: false, cls: 'jr-cp-focus' })}<p class="jr-cp-quiet">${W.afterCall}</p>`);
  return page(o, `${head({ title: 'Margin call', written: at, chips: false })}${grid(left, after)}`);
}

/** Plan a trade: "Your rules" first (R2 Doesn’t apply; R3 No with the required why), the snapshot below; the amber
 *  names the rule. The board inset under it is the same panel before he answers. */
function planPage(o = {}) {
  const left = `${editor({ text: PLAN_E.body, placeholder: W.placeholderPlan })}${exitOpen()}<div class="jr-cp-revs">${rv('+ Revisit on…')}${rv('+ Money in or out')}</div>${check(W.keepOut)}${foot({ above: W.planAbove, primary: jrBtn(planSaveLabel(ANSWERED), { kind: 'primary' }) })}`;
  const snap = snapshotFrame('staging', `${carriedRow(carriedText(PLAN_S, PLAN5.at), false)}${positions(PLAN_S)}`);
  const before = inset('Board inset · before he answers: each segment starts unselected, and the plan saves with every rule “Not answered”', `${rulesFrame('staging', {})}${foot({ above: W.planAbove, primary: jrBtn(planSaveLabel({}), { kind: 'primary' }) })}`);
  return page(o, `${head({ title: 'New entry', written: PLAN_E.writtenAt, kind: PLAN_E.kind })}${grid(`${left}${before}`, `${rulesFrame('staging', ANSWERED)}${snap}`)}`);
}

// ---- phone: a full-screen page (top bar ✕ · title), no shell nav ------------------------------------------------------------
function fullScreen({ scheme = 'dark', minHeight = 0, title, body, bottom = '' } = {}) {
  return `<div class="v4 jr-cp-fs" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">${finalDemoNotice({ phone: true })}<header class="jr-cp-top"><button type="button" class="btn ghost jr-cp-x" aria-label="Leave and keep the draft">${icon('close', 20)}</button><h1>${title}</h1></header><main id="main" class="jr-cp-fsm" aria-label="${title}">${body}<p class="jr-foot">Not investment advice.</p></main>${bottom}</div>`;
}
const keyboard = () => `<div class="jr-cp-kb" aria-hidden="true">${[10, 9, 7].map((n) => `<div class="r">${'<i></i>'.repeat(n)}</div>`).join('')}<div class="r"><i class="w"></i><i class="sp"></i><i class="w"></i></div></div>`;
/** Phone · margin call, typing: stacked 44px fields in the order things happened, the editor focused, and the toolbar
 *  pinned above the keyboard ("Numbers: carried · Update" · "+" · amber "Save"). */
function callPhone(o = {}) {
  const body = `${jrStrip('info', W.callStrip)}${callNumbers().join('')}${crossCheck(STRINGS.callCross)}${editor({ text: CALL_E.body, placeholder: W.placeholderCall, focus: true, caret: true, short: true })}${field({ ph: W.remember, unit: '', sans: true })}`;
  const bar = `<div class="jr-cp-tb" role="toolbar" aria-label="Above the keyboard"><span class="t">Numbers: carried ·</span>${jrBtn('Update', { kind: 'text' })}${jrBtn('+', { attrs: 'aria-label="Add details"' })}${jrBtn('Save', { kind: 'primary' })}</div>${keyboard()}`;
  return fullScreen({ ...o, title: 'Margin call', body, bottom: bar });
}
/** Phone · plan a trade: the rules first with 44px segment rows, the editor second, and the sticky "Save plan" whose
 *  label follows the answers. */
function planPhone(o = {}) {
  const body = `${jrChips(KINDS, KIND_WORD[PLAN_E.kind], { rail: true })}${rulesFrame('staging', ANSWERED)}${editor({ text: PLAN_E.body, placeholder: W.placeholderPlan, short: true })}${exitOpen()}${check(W.keepOut)}`;
  const bar = `<div class="jr-cp-sticky"><p class="jr-cp-above">${W.planAbove}</p>${jrBtn(planSaveLabel(ANSWERED), { kind: 'primary', size: 'touch' })}</div>`;
  return fullScreen({ ...o, title: 'New entry', body, bottom: bar });
}

// ---- States ----------------------------------------------------------------------------------------------------------------------
function states({ scheme = 'dark', minHeight = 0 } = {}) {
  const S25 = CALL_PREV;
  const panel = (html, label) => jrQuiet(html, { label, cls: 'jr-cp-sp' });
  const items = [
    { name: 'Blank', tag: null, when: `Nothing written yet; no kind chosen. Placeholders by kind: Entered or Added “${W.placeholderAdd}” · Plan a trade “${W.placeholderPlan}” · Just thinking “${W.placeholderThink}” · Margin call mode “${W.placeholderCall}”`, html: `${jrChips(KINDS, null)}${editor({ short: true })}` },
    { name: 'Draft restored', tag: ['local'], when: `A draft kept in this browser (convexa.journal.drafts.v1) comes back when the composer opens. The spec’s example time.`, html: `<div class="jr-cp-line">${jrTag('stored')}<span>Picking up your draft from ${EX.draftFrom} ·</span>${jrBtn('Discard', { kind: 'link' })}</div>` },
    { name: 'No earlier snapshot', tag: null, when: 'His first entry: nothing to carry. Saving without numbers is allowed.', html: panel(`<p class="jr-cp-p">${W.noNumbers}</p><div>${jrBtn('Update numbers')}</div>`, 'Account snapshot') },
    { name: 'Carried and old', tag: ['local'], when: 'Plain text, not a warning: his numbers aren’t a feed. The spec’s example dates.', html: panel(carriedRow(carriedText({ asOf: EX.oldFrom }, CALL_S.asOf), false), 'Account snapshot') },
    { name: 'Validating', tag: null, when: 'Inline at the field, saying how to fix it; plain decimals only. The typed value is this board’s example.', html: field({ label: 'Account value', value: EX.invalid, err: W.validate, focus: true, was: wasLine(S25.accountValue, S25) }) },
    { name: 'Sanity question', tag: null, when: 'A value more than 40% from the previous snapshot; never blocking. The spec’s example: $3,604 typed for $36,040.', html: `${field({ label: 'Account value', value: bare(EX.sanityTyped), was: wasLine(S25.accountValue, S25) })}${jrStrip('info', `<span>${figs(SANITY)}</span>`)}` },
    { name: 'Account-number warning', tag: null, when: 'Nine or more digits in a row, before save. It never blocks: Save still works with “Keep it” (criterion 25).', html: `${editor({ text: EX.account, short: true })}${jrStrip('warn', `<span>${W.accountNo}</span><span class="jr-cp-acts0">${jrBtn('Remove', { size: 'sm' })}${jrBtn('Keep it', { kind: 'text', size: 'sm' })}</span>`)}` },
    { name: 'Saving', tag: null, when: 'The in-flight indicator in the button, the screen’s one amber. The draft line is the spec’s example.', html: foot({ draft: `${jrTag('stored')}<span>Draft saved ${EX.draftSaved}</span>`, primary: SAVING }) },
    { name: 'Save failed', tag: null, when: 'Inline, never a toast. The text stays in this browser until it goes through.', html: `${jrStrip('warn', `<span>${W.saveFailed}</span><span>${jrBtn('Try again', { ic: 'refresh', size: 'sm' })}</span>`)}` },
    { name: 'Offline', tag: null, when: 'The same words. The save is queued and retried with the same client id, so it can’t land twice.', html: `${jrStrip('warn', `<span>${W.saveFailed}</span><span>${jrBtn('Try again', { ic: 'refresh', size: 'sm' })}</span>`)}` },
    { name: 'Stale snapshot strip (plan)', tag: null, when: 'Plan a trade, when the snapshot is more than 5 weekdays old: burnt orange with its icon. The spec’s example age.', html: jrStrip('warn', `These numbers are ${EX.staleDays} days old. Update them for a current reading.`) },
    { name: 'Cross-check mismatch', tag: ['computed'], when: 'Margin call mode, when his numbers miss the call by more than $1: two neutral lines and nothing more, no verdict. The spec’s example figure.', html: crossCheck([STRINGS.callCross[0], `Your numbers compute ${signedUsd(EX.mismatch)}`]) },
    { name: 'No rules (plan)', tag: null, when: 'Plan a trade before any rule is active: plans still save.', html: jrQuiet(`<div class="jr-fh"><h3>Your rules</h3></div><p class="jr-cp-p">${W.noRules}</p><div>${jrBtn('Write a rule', { ic: 'edit' })}</div>`, { label: 'Your rules' }) },
    { name: 'Money timing', tag: null, when: `Money in or out on a day with a snapshot says which side of it the money lands on: the sample’s ${usd(MONEY_IN.amount)} at ${fmtTime(MONEY_IN.at)}, before the ${fmtTime(MONEY_S.at)} numbers.`, html: panel(`<div class="jr-cp-line"><span class="jr-cp-lab">Direction</span>${jrSeg(['In', 'Out'], MONEY_IN.dir === 'in' ? 'In' : 'Out', { size: 32, label: 'Direction' })}</div><div class="jr-cp-fields">${field({ label: 'Amount', value: bare(MONEY_IN.amount) })}${field({ label: 'Date and time', value: fmtDateTime(MONEY_IN.at), unit: '', ic: 'calendar' })}</div><div class="jr-cp-line"><span>Counted before your ${fmtTime(MONEY_S.at)} numbers ·</span>${jrBtn('Change', { kind: 'link' })}</div><p class="jr-foot">${W.moneyFoot}</p>`, 'Money in or out') },
    { name: 'Reason missing (plan)', tag: null, when: 'A No with the why empty or only spaces: Save shows the line under the field and saves nothing (G1; the server answers 422 reason_required).', html: `${jrQuiet(ruleBlock('R3', { answer: 'no', missing: true }), { label: 'Your rules' })}<div class="jr-cp-acts0">${jrBtn(planSaveLabel(ANSWERED), { kind: 'primary' })}</div>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Journal · New entry · states', lead: 'Fifteen states of the composer, its margin-call mode and Plan a trade, in the spec’s words. The sample never reaches some of them, so those frames use the spec’s own examples and say so; the rest are the Sample journal’s figures.', trace: 'Screens 2–4 · criteria 4, 20, 25, 30, 35', items });
}

// =========================================================================================================
// The row
// =========================================================================================================
const CP_CSS = `
  /* ---- the composer page: a centred grid, editor 720 and snapshot 400, gap 32 --------------------------- */
  .jr-cp { width: 100%; max-width: 1152px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .jr-cp-head { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .jr-cp-head h1 { margin: 0; font-size: clamp(30px, 3vw, 40px); line-height: 1.1; letter-spacing: -0.02em; }
  .jr-cp-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 14px; line-height: 1.5; color: var(--text-dim); }
  .jr-cp-sel { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--line-2); border-radius: 8px; background: transparent; color: var(--phosphor); font: 500 13px/1.2 'IBM Plex Sans', sans-serif; cursor: pointer; }
  .jr-cp-sel .ico { width: 14px; height: 14px; color: var(--steel); }
  .jr-cp-pick { min-height: 40px; font: 500 14px/1.2 'IBM Plex Mono', monospace; }
  .jr-cp-grid { display: grid; grid-template-columns: minmax(0, 720px) minmax(0, 400px); gap: 32px; align-items: start; }
  @media (max-width: 1199px) { .jr-cp-grid { grid-template-columns: minmax(0, 1fr); } }
  .jr-cp-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .jr-cp-p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--phosphor); }

  /* ---- the editor: Plex Sans 17/1.6, about 68ch, min-height 320 -------------------------------------------- */
  .jr-q.jr-cp-ed { padding: 18px 20px; }
  .jr-cp-ed.is-focus { border-color: var(--amber-text); box-shadow: 0 0 0 3px var(--amber-tint); }
  .jr-cp-ta { min-height: 320px; max-width: 68ch; font: 400 17px/1.6 'IBM Plex Sans', sans-serif; color: var(--phosphor); white-space: pre-wrap; overflow-wrap: anywhere; }
  .jr-cp-ta.ph { color: var(--steel); }
  .jr-cp-ta.short { min-height: 132px; }
  .jr-cp-caret { display: inline-block; width: 2px; height: 20px; margin-left: 1px; vertical-align: -4px; background: var(--phosphor); }

  /* ---- reveals, details, the sale row --------------------------------------------------------------------------- */
  .jr-cp-revs { display: flex; flex-wrap: wrap; gap: 4px 8px; }
  .jr-cp-rv { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--phosphor); font: 600 13px/1.2 'IBM Plex Sans', sans-serif; cursor: pointer; }
  .jr-cp-rv:hover { background: var(--raised); }
  .jr-cp-rv .ico { width: 14px; height: 14px; color: var(--steel); }
  .jr-q.jr-cp-det { gap: 16px; }
  .jr-cp-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; font-size: 14px; line-height: 1.45; color: var(--phosphor); min-width: 0; }
  .jr-cp-lab { font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--phosphor); }
  .jr-cp-q { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
  .jr-cp-open { margin: 0; padding: 12px 14px 14px; border: 1px solid var(--line); border-radius: 10px; min-width: 0; }
  .jr-cp-open legend { padding: 0 6px; font-size: 13px; font-weight: 600; color: var(--phosphor); }
  .jr-cp-more { display: flex; flex-direction: column; gap: 12px; align-items: stretch; }
  .jr-cp-more > .jr-cp-rv { align-self: flex-start; padding-left: 0; }

  /* ---- fields: label, the input with its $ unit, an inline error, the previous value ------------------------ */
  .jr-cp-f { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .jr-cp-fl { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--phosphor); }
  .jr-cp-opt { font-size: 12px; font-weight: 400; color: var(--steel); }
  .jr-cp-in { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; min-width: 0; max-width: 100%; padding: 0 12px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font: 500 15px/1.3 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .jr-cp-f > .jr-cp-in { width: 100%; }
  .jr-cp-in .u { font-family: 'IBM Plex Sans', sans-serif; font-weight: 500; color: var(--steel); }
  .jr-cp-in .v { min-width: 0; overflow-wrap: anywhere; }
  .jr-cp-in .ph { font: 400 15px/1.3 'IBM Plex Sans', sans-serif; color: var(--steel); }
  .jr-cp-in .jr-gap { font-size: 14px; }
  .jr-cp-in > .ico { margin-left: auto; color: var(--steel); }
  .jr-cp-in.sans { font-family: 'IBM Plex Sans', sans-serif; font-weight: 400; }
  .jr-cp-in.focus { border-color: var(--amber-text); box-shadow: 0 0 0 3px var(--amber-tint); }
  .jr-cp-in.err { border-color: var(--warn); }
  .jr-cp-err { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; line-height: 1.45; color: var(--phosphor); }
  .jr-cp-err .ico { flex: none; margin-top: 2px; color: var(--warn); }
  .jr-cp-was { font-size: 12px; line-height: 1.4; color: var(--steel); }
  .jr-cp-was .mono { color: var(--phosphor); }
  .jr-cp-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; }
  .jr-cp-three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .jr-cp-check { display: inline-flex; align-items: center; gap: 10px; min-height: 32px; font-size: 14px; color: var(--phosphor); cursor: pointer; }
  .jr-cp-box { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1.5px solid var(--steel); border-radius: 4px; }
  .jr-cp-box.on { background: var(--phosphor); border-color: var(--phosphor); color: var(--ink); }

  /* ---- footer: the draft line, Discard draft and the one amber --------------------------------------------- */
  .jr-cp-foot { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; min-width: 0; }
  .jr-cp-fr { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
  .jr-cp-draft { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; color: var(--text-dim); }
  .jr-cp-acts { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
  .jr-cp-acts0 { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .jr-cp-above { margin: 0; font-size: 13px; line-height: 1.5; color: var(--phosphor); }
  .jr-cp-k { display: inline-flex; align-items: center; height: 18px; margin-left: 2px; padding: 0 5px; border-radius: 4px; border: 1px solid color-mix(in srgb, var(--amber-ink) 45%, transparent); font: 500 11px/1 'IBM Plex Mono', monospace; }
  .jr-cp-spin { flex: none; width: 14px; height: 14px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--amber-ink) 30%, transparent); border-top-color: var(--amber-ink); }

  /* ---- the snapshot column and Your rules ------------------------------------------------------------------- */
  .jr-cp-carry { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; font-size: 14px; line-height: 1.45; color: var(--phosphor); }
  .jr-cp-sub { display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line); min-width: 0; }
  .jr-cp-subh { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; min-height: 22px; }
  .jr-cp-pos { display: flex; flex-wrap: wrap; align-items: baseline; padding: 7px 0; border-top: 1px solid var(--line); font-size: 13px; line-height: 1.45; color: var(--phosphor); }
  .jr-cp-sub .jr-cp-pos:first-child { border-top: 0; padding-top: 0; }
  .jr-cp-pos b { font-weight: 600; }
  .jr-cp-pos > span, .jr-cp-nw { white-space: nowrap; }
  /* jrFig's signed tint: the kit's .jr-fig-v colour outranks .t-down and .t-up (same specificity, later), so restate it. */
  .jr-fig-v.t-down { color: var(--text-down); } .jr-fig-v.t-up { color: var(--text-up); }
  /* The phone's kind rail opens on the chosen kind: its one snap point. */
  .jr-cp-fs .jr-chips.rail { scroll-snap-type: x mandatory; } .jr-cp-fs .jr-chip[aria-pressed="true"] { scroll-snap-align: center; }
  .jr-cp-rules { display: flex; flex-direction: column; gap: 16px; }
  .jr-cp-rule { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .jr-cp-rule + .jr-cp-rule { padding-top: 16px; border-top: 1px solid var(--line); }
  .jr-cp-rh { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
  .jr-cp-rn { flex: none; font: 600 13px/1.4 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .jr-cp-rw { margin: 0; font-size: 15px; line-height: 1.45; color: var(--phosphor); }
  .jr-cp-rq { margin: 0; font-size: 14px; line-height: 1.45; color: var(--text-dim); }
  .jr-cp-rd { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 10px; background: var(--ink-2); font-size: 13px; line-height: 1.5; color: var(--phosphor); }
  .jr-cp-rd p, .jr-cp-xc p { margin: 0; }
  .jr-cp-why .jr-cp-in { min-height: 44px; }
  .jr-cp-xc { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; line-height: 1.5; color: var(--phosphor); }
  .jr-q.jr-cp-sp { gap: 12px; }

  /* ---- board insets (P-4: a board annotation, never product UI) ---------------------------------------------- */
  .jr-cp-inset { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 14px 16px 16px; border: 1px dashed var(--line-2); border-radius: 14px; background: var(--ink-2); }
  .jr-cp-inset-h { margin: 0; font: 500 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); }
  .jr-cp-focus { outline: 2px solid var(--amber-text); outline-offset: 2px; }
  .jr-cp-quiet { margin: 0; padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 13px; line-height: 1.5; color: var(--text-dim); }

  /* ---- phone: a full-screen page, the keyboard toolbar, the sticky Save plan --------------------------------- */
  .jr-cp-fs { display: flex; flex-direction: column; }
  .jr-cp-top { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 4px; height: 56px; padding: 0 8px; border-bottom: 1px solid var(--line); background: var(--glass); backdrop-filter: blur(12px); }
  .jr-cp-top h1 { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.2; }
  .jr-cp-x { width: 44px; height: 44px; min-height: 44px; padding: 0; color: var(--phosphor); }
  .jr-cp-fsm { flex: 1 1 auto; display: flex; flex-direction: column; gap: 14px; padding: 16px; min-width: 0; }
  .jr-cp-tb { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 16px; border-top: 1px solid var(--line); background: var(--panel); }
  .jr-cp-tb .t { flex: 1 1 auto; min-width: 0; font-size: 13px; color: var(--text-dim); white-space: nowrap; }
  .jr-cp-tb .btn { height: 44px; min-height: 44px; flex: none; }
  .jr-cp-tb .btn.secondary { width: 44px; padding: 0; font-size: 18px; }
  .jr-cp-kb { display: flex; flex-direction: column; gap: 10px; padding: 10px 4px calc(28px + env(safe-area-inset-bottom)); background: var(--raised); }
  .jr-cp-kb .r { display: flex; justify-content: center; gap: 6px; }
  .jr-cp-kb i { display: block; height: 42px; flex: 1 1 0; max-width: 32px; border-radius: 6px; background: var(--raised-2); }
  .jr-cp-kb i.w { max-width: 84px; } .jr-cp-kb i.sp { max-width: 180px; flex: 3 1 0; }
  .jr-cp-sticky { position: sticky; bottom: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--glass); backdrop-filter: blur(12px); }
  .jr-cp-sticky .btn { width: 100%; }
  @media (max-width: 599px) {
    .jr-cp-fields, .jr-cp-three { grid-template-columns: minmax(0, 1fr); }
    .jr-cp-in, .jr-cp-sel, .jr-cp-rv, .jr-cp-check { min-height: 44px; }
    .jr-q.jr-cp-ed { padding: 14px 16px; }
    .jr-cp-ta { font-size: 17px; }
  }
`;

const DAY_TRIM = TRIM[DAY.id];
const SALE_TEXT = `${DAY_SALE.qty} of ${INSTRUMENTS[DAY_SALE.inst].name} at ${usd(DAY_SALE.price, { dp: 2 })}`;
const CALL_SAVED = `Saved · ${fmtDay(CALL_E.writtenAt)}, ${fmtTime(CALL_E.writtenAt)}`;

export const ROW = {
  key: 'journal-compose',
  label: 'Journal · New entry',
  section: 'planned',
  css: JR_CSS + CP_CSS,
  specH: 4030,
  spec: {
    title: 'Journal · New entry',
    route: '/positions/journal/new · ?kind=margin_call · ?kind=plan',
    job: 'The lowest-friction honest capture: text first, numbers carried forward, sealed on save. Margin call mode captures the worst moment in under a minute, with nothing on the page that reads as judgement; Plan a trade checks an intended trade against his own rules before he places it at his broker, records his answers and his reason, and blocks nothing.',
    env: {
      production: 'The owner, signed in: his entry, typed by him and sealed on save to his account (owner-only API, encrypted at rest). The draft is kept in this browser only, in plaintext under convexa.journal.drafts.v1, and cleared on save, on Discard and on sign-out. Signed out: the Positions private-testing wall. Another account: “This journal is private to the account that owns this Convexa.”',
      staging: `The demo account on the ${SCENARIO.label} scenario. Writes go to demo browser storage; the Computed box, the sanity question, the cross-check and the projection come from the shared facts module, and leg-based facts on a visitor’s own entry read “—”. The boards replay the Sample journal’s ${fmtDate(DAY.writtenAt)} trim, ${fmtDate(CALL_E.writtenAt)} call and ${fmtDate(PLAN_E.writtenAt)} plan as he typed them. The spec prints no draft time for those days, so none is drawn; the states board uses the spec’s own examples where the sample has none.`,
    },
    widgets: [
      { name: 'Editor, kind chips and About', source: 'His words; the draft in this browser (convexa.journal.drafts.v1); sealed on save, POST /api/journal/entries with an idempotent client id', production: 'local', staging: 'sample' },
      { name: 'Reveals: confidence, I’m wrong if…, Revisit on…, Closed by, the sale row, his decision label', source: 'Typed. The sale and an exit’s position are kept typed details (1b); the label is his, never computed or suggested (G6)', production: 'local', staging: 'sample' },
      { name: 'Account snapshot: fields, source, positions', source: 'Typed, carried forward from the previous snapshot with its date; positions on RealPositionRows (1b)', production: 'local', staging: 'sample' },
      { name: 'Computed box, sanity question, cross-check', source: 'libs/api/src/lib/journal/facts.ts in the browser before save, so it works offline; the server’s facts after save', production: 'computed', staging: 'computed' },
      { name: 'Money in or out', source: 'Typed direction, amount, date and time (the time defaults to now), placed against a same-day snapshot', production: 'local', staging: 'sample' },
      { name: 'Your rules (Plan a trade)', source: 'Active rule versions; readings from the snapshot before the plan; the projection from the facts module; his answers and reasons (journal_rule_checks)', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
    ],
    states: [
      { tag: null, when: `Blank: placeholders by kind. Default “${W.placeholder}” · Entered or Added “${W.placeholderAdd}” · Plan a trade “${W.placeholderPlan}” · Just thinking “${W.placeholderThink}” · Margin call mode “${W.placeholderCall}”` },
      { tag: 'local', when: `Draft restored: “Picking up your draft from ${EX.draftFrom} · Discard”.` },
      { tag: null, when: `No earlier snapshot: “${W.noNumbers}”` },
      { tag: 'local', when: `Carried: “${carriedText(CALL_PREV, CALL_S.asOf)}”. Carried and old, plain text and never a warning: “${carriedText({ asOf: EX.oldFrom }, CALL_S.asOf)}”.` },
      { tag: null, when: `Validating, inline at the field: “${W.validate}”. Sanity question, never blocking, past a 40% move: “${SANITY}”` },
      { tag: null, when: `Account-number warning, before save, never blocking: “${W.accountNo}” · Remove · Keep it.` },
      { tag: null, when: `Saving: the in-flight indicator in the button. Saved: back to the timeline, the new card focused, “${CALL_SAVED}”.` },
      { tag: null, when: `Save failed, inline and never a toast: “${W.saveFailed}” + Try again. Offline: the same words; the save is queued and retried with the same client id, so it can’t land twice.` },
      { tag: null, when: `Money timing: “Counted before your ${fmtTime(MONEY_S.at)} numbers · Change”; its foot “${W.moneyFoot}”` },
      { tag: 'computed', when: `Margin call cross-check, matching within $1: “${STRINGS.callCross[0]}” and “${STRINGS.callCross[1]}” Otherwise “Your numbers compute ${signedUsd(EX.mismatch)}”, and nothing more.` },
      { tag: null, when: `Margin call saved: “${CALL_SAVED}. It’s in the record as you wrote it.” · “Add a later note when it’s resolved”; then, on the timeline, “${W.afterCall}” A “Call amount not recorded” save is allowed. No AI read runs on a margin-call entry, and it never asks for a decision label.` },
      { tag: null, when: `Plan a trade. No rules: “${W.noRules}” + Write a rule. No snapshot: readings read “not recorded”. Stale snapshot: “These numbers are ${EX.staleDays} days old. Update them for a current reading.” Reason missing: “${W.reasonMissing}” under the field, and nothing is saved. Saved: “${planSavedLine(ANSWERED)}”, or “${planSavedLine({})}” with no No.` },
      { tag: 'notConfigured', when: `No journal key on the server: “${W.storage}”` },
      { tag: 'locked', when: 'Production, signed out: the Positions private-testing wall, “Sign in to open your journal”, and “See it on the demo →”.' },
      { tag: 'sample', when: 'Staging: the demo bar is the page’s one “Demo · sample data”; the snapshot and Your rules frames each carry one “Sample journal” chip, and nothing inside them carries a Sample tag.' },
    ],
    phone: 'A full-screen page: top bar ✕ (leave and keep the draft) · “New entry”. The kind chips are a sideways rail and the editor fills the screen; dictation is the keyboard’s own. A toolbar pinned above the keyboard: “Numbers: carried · Update” · “+” · amber “Save”; Update opens a bottom sheet of inputmode="decimal" fields in 44px rows, actions stacked. Margin call: the three numbers stack as 44px fields above the editor, in the order things happened, and the bottom bar’s “Margin call” opens it from any journal tab. Plan a trade: the rules stack first with 44px segment rows, then the editor, with a sticky “Save plan” whose label follows the answers. No horizontal overflow at 390 or 393.',
    acceptance: [
      'Criterion 4 (1a): at 390 with a coarse pointer, from Positions › Journal, tap “Margin call”, type the call amount, set the due date and time, type the account value and tap Save in at most 6 interactions; Call amount is autofocused and Due by is one native datetime-local input. The entry appears on the timeline with the Margin call pill.',
      'Criterion 5 (5): with “Read each entry right after I save it” on, saving a margin-call entry makes 0 provider requests.',
      'Criterion 8 (1a): typed and computed figures render in Mono with no dotted rule; not recorded, not set, not given, no basis and unrecognized render in Sans (getComputedStyle over the composer at 1440).',
      'Criterion 9 (1a): no success or error fill on any element; textUp and textDown only on text carrying + or −; “above” carries the warning glyph and “within” is never tinted.',
      'Criterion 20 (2): on Plan a trade every rule’s segment starts unselected, nothing in “Your rules” uses success colours, and Save works with every rule unanswered.',
      `Criterion 30 (2, G1): a No makes “Why go ahead anyway?” required and the button reads “${planSaveLabel(ANSWERED)}”; with the line empty or only spaces, Save shows “${W.reasonMissing}” and nothing is saved (the API answers 422 reason_required); with a line it saves as “${planSavedLine(ANSWERED)}”.`,
      'Criterion 31: the composer has at most one amber fill: “Save entry”, and on Plan a trade “Save plan”.',
      `Criterion 35 (1b, G6): the sale row on Trimmed and Closed only; the ${fmtDate(DAY.writtenAt)} trim saved with “${SALE_TEXT}” reads ${rMultiple(DAY_TRIM.R.value)}, and with the row blank reads not recorded. “How did the decision look, apart from the result?” starts unselected and is never asked on a margin-call entry, a broker liquidation, or a trim written while a call is open.`,
      'Criterion 25 (1a): typing “Acct 123456789” shows the account-number warning before save; Save still works with “Keep it”, and “$41,210.50” doesn’t trigger it.',
      'Criterion 24 (1a): with the journal key unset, Save shows “Journal storage isn’t set up on this server” and nothing is written.',
      'Criterion 21: at 390 and 393, in both schemes, no horizontal overflow, and no interactive element under 44px with a coarse pointer.',
      'Criterion 18: on staging the composer writes to demo browser storage, and “Demo · sample data” appears once, in the bar.',
    ],
    built: [
      { status: 'todo', waits: 'build', slice: '1a', what: 'Slice 1a: the composer page: text first, kind chips, About with its as-of, the snapshot carried forward with its source, sanity questions, the 9-digit warning, “Keep this entry out of AI reads”, money in or out with its time, the draft in this browser, sealed on save.' },
      { status: 'todo', waits: 'build', slice: '1a', what: 'Slice 1a: margin-call mode: the three-number row with Call amount autofocused and one datetime-local Due by, “More numbers”, the cross-check, and the after-save line, offer and timeline line.' },
      { status: 'todo', waits: 'build', slice: '1a', what: 'Slice 1a: the shared TypeScript facts module (libs/api/src/lib/journal/facts.ts) behind the Computed box, the sanity question and the cross-check, with its parity test against facts.rs.' },
      { status: 'todo', waits: 'build', slice: '1b', what: 'Slice 1b: Edit positions on RealPositionRows (a copy of the LegFields grid; no SIMULATED chip, no order control), the sale row on Trimmed and Closed, an exit’s position, and his decision label Sound · Mixed · Poor (G6).' },
      { status: 'todo', waits: 'build', slice: '1b', what: 'Slice 1b: the ⌘K Write group, “Write a journal entry” and “Margin call entry”, opening this page and its margin-call mode.' },
      { status: 'todo', waits: 'build', slice: '2', what: 'Slice 2: Plan a trade: its kind chip, “Your rules” with readings and the projection, the 44px Yes · No · Doesn’t apply, and the required “Why go ahead anyway?” on a No (422 reason_required, G1).' },
      { status: 'todo', waits: 'build', slice: '5', what: `Slice 5: with reading on save on, the egress line under Save, “Saving also sends this entry’s text, its numbers, the summaries of your 5 previous entries and your active rules to Anthropic (${AI.models.entry}) on your key.”, never on a margin-call entry.` },
    ],
    rulings: JR_RULINGS.filter((r) => !/^rule (16|19|22)\b|^P-8|^NO-13/.test(r)),
    code: [
      'apps/dashboard/src/app/pages/positions/journal/* (new): the composer, margin-call mode and Plan a trade',
      'libs/api/src/lib/journal/facts.ts (new) and its parity spec',
      'apps/api/src/routes/journal.rs · services/journal/{mod,store,facts,crypto}.rs (new, 1a)',
      'apps/dashboard/src/app/features/journal/RealPositionRows.tsx (new, 1b) · features/trading/positions/leg.ts · features/trading/tradeEntry/LegFields.tsx (multiplierFor moves, 1b)',
      'apps/dashboard/src/app/shell/CommandPalette/CommandPalette.tsx (the Write group, 1b)',
      'apps/api/src/services/journal/rules.rs (new, 2: plan answers and reason_required)',
      'libs/api/src/lib/demo/{transport,workspace,journal}.ts',
      'design/src/screens/final/journal-compose.mjs (step 0)',
    ],
  },
  boards: [
    B('staging', 'Staging · normal day', 1440, 1592, (o) => dayPage(o)),
    B('margin-call', 'Margin call mode', 1440, 1560, (o) => callPage(o)),
    B('plan', 'Plan a trade', 1440, 1909, (o) => planPage(o)),
    B('phone-call', 'Phone · margin call', 390, 1190, (o) => callPhone(o)),
    B('phone-plan', 'Phone · plan a trade', 390, 1321, (o) => planPhone(o)),
    B('light', 'Light · staging', 1440, 1592, (o) => dayPage(o), LIGHT),
    B('states', 'States', 1440, 3019, (o) => states(o)),
  ],
};
