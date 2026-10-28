// Final · Planned · Journal · Timeline (spec 08, BOARD BRIEF row `journal-timeline`; step 0, 2026-10-28).
//
// The journal's home, /positions/journal (Screens → 1): the tab band with Journal current, the header's one amber
// "Write entry", quick capture, day groups in Written order, and the rail (this week's focus, the account frame, the
// Rulebook and Review minis, filters). Built on the journal kit (./journal-kit.mjs) and the Sample journal
// (design/src/data/journal-sample.mjs): every figure comes from the sample module, every string from the spec's
// Screens and Copy. A card whose words the spec doesn't print says so in a board note (P-4); nothing is invented.
// Classes this row adds are `jr-tl-`. Units are px.
import { finalDemoNotice } from '../../lib.mjs';
import {
  B, LIGHT, JR_CSS, JR_NOTES, JR_RULINGS, JOURNAL_SUB, icon, statesBoard,
  jrPage, jrHeader, jrHeaderActions, jrBtn, jrGrid, jrFrame, jrChartFrame, jrQuiet, jrTag, jrWall, jrNotOwner,
  jrCard, jrEntryCard, jrDay, jrFig, jrFigs, jrSeg, jrChips, jrStrip, jrAbove, jrSpark, jrSigned,
} from './journal-kit.mjs';
import {
  CALL, COUNTS, ENTRIES, ENTRY, FACTS, FINDINGS, KIND_WORD, LATEST, MONEY, PLAN, REVIEW_CUTOFF, RULES, SCENARIO, SNAPSHOTS, STRINGS,
  etDate, fmtDate, pct, times, usd,
} from '../../data/journal-sample.mjs';

// ---- words and small helpers ------------------------------------------------------------------------------------
const SEP = '<span class="jr-sep" aria-hidden="true">·</span>';
/** Money, percents, × and signed R inside a sentence, set in Mono (labels and dates stay Sans). */
const FIG_RE = /(?<![\w$.,])[−+]?\$\d[\d,]*(?:\.\d+)?|(?<![\w$.,])[−+]?\d+(?:\.\d+)?(?:%|×)|(?<![\w$.,])[−+]\d+(?:\.\d+)?R\b/g;
const figs = (t) => String(t).replace(FIG_RE, (m) => `<span class="mono">${m}</span>`);
/** A board note inside a card or a list (P-4: board only, never product UI). */
const boardNote = (html, cls = 'jr-tl-bn') => `<p class="${cls}" role="note">${icon('info', 12)}<span><b>Board</b> ${html}</span></p>`;
const UNPRINTED = boardNote('The spec doesn’t print this entry’s words.');
/** The kind chips, in the composer's order (Imported is the import's own kind, never a chip). */
const KIND_CHIPS = ['entered', 'added', 'trimmed', 'closed', 'margin_call', 'money', 'plan', 'thinking'].map((k) => KIND_WORD[k]);
const ACTIVE = RULES.filter((r) => r.status === 'active');
const latestWording = (r) => r.versions[r.versions.length - 1].wording;
const UNDESCRIBED = COUNTS.entries - COUNTS.described;
/** His line on the Oct 5 plan's No, which the card draws under its footer (Screens 4). */
const PLAN_WHY = PLAN[ENTRY['e-oct05-plan'].plan].answers.find((a) => a.answer === 'no').reason;

/** "This week’s focus: Name an exit before I place a trade. · your Oct 7 review", split so the review is a link. */
function focusLine() {
  const [label, rest] = STRINGS.focus.split(': ');
  const [text, review] = rest.split(' · ');
  return `<p class="jr-tl-fl"><b>${label}:</b> ${text}${SEP}<a href="/positions/review">${review}</a></p>`;
}

// ---- the timeline's day groups (Written order, newest first; ET days) -------------------------------------------
/** The described entries written at the time from the call's day on, newest first. */
const WEEK_FROM = etDate(ENTRY[CALL.entry].writtenAt);
const instant = (e) => (e.writtenAt.length > 10 ? e.writtenAt : `${e.writtenAt}T12:00:00-04:00`);
const WEEK = ENTRIES.filter((e) => e.described && e.cls === 'at_time' && e.writtenAt && etDate(e.writtenAt) >= WEEK_FROM).sort((a, b) => instant(b).localeCompare(instant(a)));
const daySnapshot = (date) => SNAPSHOTS.find((s) => s.asOf === date && s.entry && etDate(ENTRY[s.entry].writtenAt) === date)?.id ?? null;
/** The money-in entry's own line: the composer's words (In · Out) and its amount, untinted. */
const moneyLine = (id) => { const m = MONEY.find((x) => x.entry === id); return `<p class="jr-tl-money"><span>${m.dir === 'in' ? 'In' : 'Out'}</span> <span class="mono">${usd(m.amount)}</span></p>`; };
/** A sample card: the kit's card, with a board note where the spec prints no words. */
function card(id) {
  const e = ENTRY[id];
  if (e.body) return jrEntryCard(id);
  return jrEntryCard(id, { strip: `${e.money ? moneyLine(id) : ''}${UNPRINTED}` });
}
function dayGroups(entries) {
  const days = [];
  for (const e of entries) {
    const d = etDate(e.writtenAt);
    if (!days.length || days[days.length - 1].date !== d) days.push({ date: d, ids: [] });
    days[days.length - 1].ids.push(e.id);
  }
  return days.map(({ date, ids }) => `<section class="jr-tl-day" aria-label="${fmtDate(date)}">${jrDay(date, { snapshot: daySnapshot(date) })}${ids.map(card).join('')}</section>`).join('');
}
/** Below the week, a board cut down to Fri Aug 21, where the recalled Aug 4 statement sits at its written date. */
function olderGroup() {
  const recalled = ENTRY['e-aug04'];
  const date = etDate(recalled.writtenAt);
  const first = ENTRIES.find((e) => e.firstRun);
  const lastBefore = [...SNAPSHOTS].reverse().find((s) => s.asOf < WEEK_FROM);
  const firstAfter = ENTRIES.filter((e) => e.described && e.cls === 'at_time' && e.writtenAt && etDate(e.writtenAt) > date).sort((a, b) => instant(a).localeCompare(instant(b)))[0];
  const cut = `<div class="jr-tl-cut" role="note" aria-label="Board cut">${icon('info', 13)}<span><b>Board cut</b> The timeline goes on: ${fmtDate(lastBefore.asOf)} back to ${fmtDate(firstAfter.writtenAt)} isn’t drawn. ${fmtDate(date)} holds the recalled ${fmtDate(recalled.about)} statement, at the date it was written.</span></div>`;
  return `${cut}<section class="jr-tl-day" aria-label="${fmtDate(date)}">${jrDay(date, { snapshot: daySnapshot(date) })}${card(recalled.id)}${card(first.id)}</section>`;
}

// ---- main column ------------------------------------------------------------------------------------------------------
const quickCapture = () => jrQuiet(`<label class="jr-tl-qin"><span class="sr">Write an entry</span><span aria-hidden="true">What happened, and what are you thinking?</span></label>${jrChips(KIND_CHIPS, null, { label: 'Kind (optional)' })}<p class="jr-tl-qnum">${STRINGS.quickNumbers.replace(/ · Update$/, '')}${SEP}<a href="#update">Update</a></p><div class="jr-tl-qact">${jrBtn('Save')}${jrBtn('Open full editor', { kind: 'link', href: '/positions/journal/new' })}</div>`, { label: 'Quick capture', cls: 'jr-tl-qc' });
const orderBy = (extra = '') => `<div class="jr-tl-order"><span>Order by:</span>${jrSeg(['Written', 'About'], 'Written', { size: 32, label: 'Order by' })}${extra}</div>`;
const revisit = () => { const [line] = STRINGS.revisit.split(' · Open'); return `<p class="jr-tl-revisit">${icon('calendar', 14)}<span>${line}${SEP}<a href="/positions/journal/e-aug26">Open</a></span></p>`; };

/** The day groups sit in one frame (P-3, D1): on staging dashed with the 8px band and its one "Sample journal" chip,
 *  so the cards inside carry no tag; on production solid. Under 600px its side padding narrows so cards stay wide. */
const entriesFrame = (env, body) => jrFrame({ env, label: 'Entries', cls: 'jr-tl-entries', body });

// ---- rail ------------------------------------------------------------------------------------------------------------
/** This week's focus is the sample's line: a one-line frame, dashed with its chip on staging, solid on production. */
const railFocus = (env) => jrFrame({ env, chipAt: 'foot', label: 'This week’s focus', cls: 'jr-tl-focus', body: focusLine() });
function accountFrame(env) {
  const [sinceLabel, sinceValue] = STRINGS.sinceOct2.split(': ');
  const cells = [
    jrFig({ label: 'Account value', value: usd(FACTS.accountValue), tag: jrTag('stored'), sub: fmtDate(LATEST.asOf) }),
    jrFig({ label: 'Margin used', value: pct(FACTS.marginUsed, 0), tag: jrTag('computed'), info: 'About margin used' }),
    jrFig({ label: 'Leverage', value: times(FACTS.leverage), tag: jrTag('computed') }),
    jrFig({ label: sinceLabel, value: jrSigned(sinceValue), tag: jrTag('computed') }),
    jrFig({ label: 'Below the recorded high', value: STRINGS.belowEnd, tag: jrTag('computed'), info: 'About below the recorded high' }),
  ];
  return jrChartFrame(env, { claim: STRINGS.railFinding, body: `${jrSpark({ height: 64 })}<a href="#path" class="jr-more jr-tl-open">Open the account path</a>${jrFigs(cells)}` });
}
function rulebookMini(env) {
  const rows = ACTIVE.map((r) => `<li class="r"><b>${r.id}</b><span>${latestWording(r)}</span></li>`).join('');
  const read = `<p class="jr-tl-read">${figs(STRINGS.r3Now)}${SEP}${jrAbove()}</p>`;
  return jrFrame({ env, title: `Active rules ${ACTIVE.length}`, level: 'h3', chipAt: 'foot', label: 'Rulebook', body: `<ul class="jr-tl-rl">${rows}</ul>${read}<div>${jrBtn('Plan a trade', { href: '/positions/journal/new?kind=plan' })}</div>` });
}
function reviewMini(env) {
  const since = ENTRIES.filter((e) => e.writtenAt && instant(e) > REVIEW_CUTOFF.oct7).length;
  return jrFrame({ env, title: `Last review ${fmtDate(SCENARIO.review)}`, level: 'h3', chipAt: 'foot', label: 'Review', body: `<p class="jr-tl-rv">${FINDINGS.length} findings${SEP}${since} entries since${SEP}<a href="/positions/review">Open review</a></p>` });
}
const filters = () => jrQuiet(`<h3 class="jr-tl-h3">Filters</h3><label class="jr-tl-search">${icon('search', 14)}<span>Search</span></label><div class="jr-tl-sels"><button type="button" class="jr-tl-sel">Kind${icon('chevron', 14)}</button><button type="button" class="jr-tl-sel">Ticker${icon('chevron', 14)}</button></div>${jrChips(['Written from memory', 'Kept out of AI reads', 'Has later notes'], null, { label: 'Show only' })}`, { label: 'Filters', cls: 'jr-tl-fil' });

// ---- the loaded page (staging, production illustrative, light, phone) ---------------------------------------------------
/** Each card's AI status sits at the right of its first row from slice 4; the spec prints no per-card words for the
 *  sample, so the boards leave the slot empty and say so (P-4). */
const AI_STATUS = 'Each card’s AI status, at the right of its first row from slice 4, isn’t drawn: the spec prints no per-card status for the sample.';
const STAGING_NOTE = `${JR_NOTES.staging} Cards carry the words the spec prints; a card whose words it doesn’t print says so, and the ${UNDESCRIBED} entries it doesn’t describe aren’t drawn. ${AI_STATUS}`;
const header = () => jrHeader({ title: 'Journal', sub: JOURNAL_SUB, actions: jrHeaderActions('journal') });
function loaded(o = {}, { env = 'staging', phone = false } = {}) {
  const note = env === 'staging' ? STAGING_NOTE : `${JR_NOTES.illustrative}. ${AI_STATUS}`;
  if (phone) {
    const peek = `<button type="button" class="jr-tl-peek" aria-haspopup="dialog" aria-label="Open the account path"><span>${figs(STRINGS.peek.replace(/ ›$/, '')).replace(/ (\d{1,2})$/, '&nbsp;$1')}</span><span aria-hidden="true">›</span></button>`;
    // The account peek row and the week's focus line are the sample's: one frame, its chip in the foot.
    const pk = jrFrame({ env, chipAt: 'foot', label: 'Account and this week’s focus', cls: 'jr-tl-pk', body: `${peek}${focusLine()}` });
    const main = `${header()}${pk}${entriesFrame(env, `${orderBy(jrBtn('Filters', { ic: 'filter', size: 'touch' }))}<div class="jr-tl-days">${dayGroups(WEEK)}</div>`)}`;
    return jrPage({ ...o, env, tab: 'journal', bar: 'journal', main, note });
  }
  const main = `${quickCapture()}${entriesFrame(env, `${orderBy()}${revisit()}<div class="jr-tl-days">${dayGroups(WEEK)}${olderGroup()}</div>`)}`;
  const rail = `${railFocus(env)}${accountFrame(env)}${rulebookMini(env)}${reviewMini(env)}${filters()}`;
  return jrPage({ ...o, env, tab: 'journal', bar: 'journal', main: `${header()}${jrGrid(main, rail)}`, note });
}

// ---- production · first run ---------------------------------------------------------------------------------------
function firstRun(o = {}) {
  const start = jrQuiet(`<h2 class="jr-tl-fh display">Start with today.</h2><p class="jr-tl-fp">Write what you hold, what you’re thinking and how the account looks. One sentence is enough. Nothing is sent to an AI until you turn AI reads on.</p><div class="jr-tl-qact">${jrBtn('Write the first entry', { size: 'touch', ic: 'edit', href: '/positions/journal/new' })}</div><p class="jr-tl-links"><a href="/positions/journal/new?about=">Write about an earlier day</a>${SEP}<a href="/positions/journal/import">Bring in past trades</a></p>`, { label: 'Start with today', cls: 'jr-tl-first' });
  const downfalls = jrQuiet(`<h3 class="jr-tl-h3">What do you think your downfalls are?</h3><p class="jr-tl-help">Up to 5 lines, in your words.</p><div class="jr-tl-ta" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<span>${i + 1}</span>`).join('')}</div><p class="jr-tl-help">Reviews test these first.</p><div class="jr-tl-qact">${jrBtn('Save')}${jrBtn('Skip', { kind: 'text' })}</div>`, { label: 'What do you think your downfalls are?', cls: 'jr-tl-prompt' });
  const rule = jrQuiet(`<h3 class="jr-tl-h3">One rule from today</h3><span class="jr-tl-in">When …, I …</span><label class="jr-tl-lb">Why this rule, in your words<span class="jr-tl-in"></span></label><div class="jr-tl-qact">${jrBtn('Adopt as R1')}${jrBtn('Skip', { kind: 'text' })}</div>`, { label: 'One rule from today', cls: 'jr-tl-prompt' });
  const acct = jrChartFrame('production', { claim: 'Account value · appears after your first snapshot', body: '<div class="jr-tl-ghost" aria-hidden="true"></div>' });
  const rules = jrFrame({ env: 'production', label: 'Rulebook', body: `<p class="jr-tl-rv">No rules yet${SEP}<a href="/positions/rulebook">One rule from today</a></p>` });
  return jrPage({ ...o, env: 'production', tab: 'journal', bar: 'journal', main: `${header()}${jrGrid(`${start}${downfalls}${rule}`, `${acct}${rules}`)}` });
}

// ---- states ------------------------------------------------------------------------------------------------------------
function states(o = {}) {
  const skCard = (w) => `<div class="jr-card" aria-hidden="true"><span class="skel jr-tl-sk" style="width: 34%; height: 12px;"></span><span class="skel jr-tl-sk" style="width: ${w}%; height: 16px;"></span><span class="skel jr-tl-sk" style="width: ${w - 24}%; height: 16px;"></span><span class="skel jr-tl-sk" style="width: 40%; height: 12px;"></span></div>`;
  const skDay = (w) => `<div class="jr-tl-skd" aria-hidden="true"><span class="skel jr-tl-sk" style="width: ${w}%; height: 14px;"></span></div>`;
  const loading = `<div class="jr-tl-st2"><div class="jr-tl-days" aria-busy="true" aria-label="Loading your journal">${skDay(30)}${skCard(92)}${skDay(26)}${skCard(84)}${skCard(70)}</div>${jrChartFrame('production', { claim: 'Account value', body: '<span class="skel jr-tl-sk" style="height: 64px;"></span><span class="skel jr-tl-sk" style="height: 120px;"></span>' })}</div>`;
  const failed = jrFrame({ env: 'production', label: 'Journal', tag: jrTag('error', 'Couldn’t load'), body: `<p class="jr-tl-p">Your journal didn’t load. Nothing is lost.</p><div>${jrBtn('Try again', { ic: 'refresh' })}</div>` });
  const callBody = ENTRY[CALL.entry].body;
  const unsent = jrCard({ kind: 'margin_call', tickers: ENTRY[CALL.entry].tickers, body: callBody, more: false, strip: jrStrip('warn', `<span>Not on your account yet. Kept in this browser until it goes through${SEP}<a href="#retry">Try again</a></span>`), label: 'Margin call · not on your account yet' });
  const signOut = `<div class="jr-tl-menu" role="group" aria-label="Sign out"><div class="jr-tl-mrow">${jrBtn('Sign out', { attrs: 'aria-expanded="true"' })}</div>${jrStrip('warn', '1 entry hasn’t reached your account yet. Signing out deletes it from this browser.')}<div class="jr-tl-qact">${jrBtn('Try sending now', { ic: 'refresh' })}${jrBtn('Sign out and delete it', { kind: 'danger', warn: true })}${jrBtn('Stay signed in', { kind: 'text' })}</div></div>`;
  const storage = jrFrame({ env: 'production', label: 'Journal', tag: jrTag('notSetUp'), body: '<p class="jr-tl-p">Journal storage isn’t set up on this server, so nothing can be saved yet.</p>' });
  const marking = `<div class="jr-tl-mark"><div class="jr-tl-bars">${finalDemoNotice()}${finalDemoNotice({ phone: true })}</div><div class="jr-tl-mk2">${accountFrame('staging')}${entriesFrame('staging', jrEntryCard('e-oct02'))}</div></div>`;
  const items = [
    { name: 'Loading', tag: null, when: 'Day-group skeletons at their final height; the rail’s frames name their metric (P-10). No tag.', html: loading },
    { name: 'Couldn’t load', tag: ['error', 'Couldn’t load'], when: '“Your journal didn’t load. Nothing is lost.” + “Try again”. Drafts held in this browser are still listed.', html: failed },
    { name: 'Not on your account yet', tag: null, when: 'A save failed or the device is offline: a strip on the card, which is kept in this browser and retried with the same client id. No tag.', html: unsent },
    { name: 'Signing out with an unsent entry', tag: null, when: 'Sign-out stops first, inline. Drafts are cleared on sign-out; a queued entry is never dropped without this.', html: signOut },
    { name: 'Storage not set up', tag: ['notConfigured'], when: 'No journal encryption key on the server: nothing can be saved, and the composer’s Save says the same.', html: storage },
    { name: 'Not the owner', tag: null, when: 'Signed in as another account (API 403 owner_only): one sentence, the demo and “For the site’s operator”, folded, as OwnerOnlyWall ships. No P-2 word exists for this, so no tag (open question 12).', html: `<div class="jr-tl-wallfit">${jrNotOwner()}</div>` },
    { name: 'Staging marking (reference)', tag: ['sample'], wide: true, when: 'The demo bar is the page’s one “Demo · sample data · Oct 7, 2026” (“As of Oct 7, 2026” from 600px, D2). Each frame is dashed with the 8px steel hatch band and names the sample once, by its “Sample journal” chip; the cards sit inside the day groups’ frame and carry no tag (D1).', html: marking },
  ];
  return statesBoard({ ...o, title: 'Journal · Timeline · states', lead: 'The timeline’s states beyond Loaded, in the spec’s words (Screens → 1, Copy). Production frames are solid; the last item is the staging marking every staging board follows. Signed out and the first run have boards of their own.', items });
}

// ---- row CSS (jr-tl-) ------------------------------------------------------------------------------------------------
const TL_CSS = `
  .jr-tl-qc { gap: 12px; }
  .jr-tl-qin { display: flex; align-items: center; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font: 400 16px/1.5 'IBM Plex Sans', sans-serif; color: var(--text-dim); cursor: text; }
  .jr-tl-qin .sr, .jr-tl-search .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .jr-tl-qnum { margin: 0; font-size: 13px; line-height: 1.5; color: var(--steel); }
  .jr-tl-qnum a, .jr-tl-revisit a, .jr-tl-fl a, .jr-tl-rv a, .jr-tl-links a { font-weight: 600; }
  .jr-tl-qact { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .jr-tl-order { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 13px; color: var(--steel); }
  .jr-tl-revisit { display: flex; align-items: center; gap: 8px; margin: 0; padding: 2px 0; font-size: 13.5px; line-height: 1.5; color: var(--phosphor); }
  .jr-tl-revisit .ico { flex: none; color: var(--steel); }
  .jr-tl-days { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  .jr-tl-day { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .jr-tl-money { margin: 0; font-size: 16px; line-height: 1.5; color: var(--phosphor); }
  .jr-tl-money .mono { font-weight: 500; }
  .jr-tl-bn { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 6px 10px; border: 1px dashed var(--line-2); border-radius: 8px; background: var(--ink-2); font: 500 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); }
  .jr-tl-bn .ico { flex: none; margin-top: 2px; }
  .jr-tl-bn b, .jr-tl-cut b { font-weight: 600; color: var(--phosphor); }
  .jr-tl-cut { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-top: 1px dashed var(--line-2); border-bottom: 1px dashed var(--line-2); background: var(--ink-2); font: 500 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); }
  .jr-tl-cut .ico { flex: none; margin-top: 2px; }
  .jr-tl-focus { padding: 12px 16px; gap: 8px; }
  .jr-tl-entries { gap: 14px; }
  /* the phone's account frame: the peek row is the frame's first line, so it drops its own panel */
  .jr-tl-pk { gap: 6px; }
  .jr-tl-pk .jr-tl-peek { min-height: 44px; padding: 0; border: 0; border-radius: 0; background: transparent; }
  .jr-tl-fl { margin: 0; font-size: 14px; line-height: 1.5; color: var(--phosphor); text-wrap: pretty; }
  .jr-tl-fl b { font-weight: 600; }
  .jr-tl-open { margin-top: -4px; }
  .jr-tl-h3 { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.35; }
  .jr-tl-rl { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .jr-tl-rl .r { display: flex; align-items: baseline; gap: 8px; min-width: 0; font-size: 13.5px; line-height: 1.45; }
  .jr-tl-rl .r b { flex: none; font-weight: 600; }
  .jr-tl-rl .r span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .jr-tl-read { margin: 0; font-size: 13px; line-height: 1.6; color: var(--phosphor); }
  .jr-tl-read .jr-above { vertical-align: -2px; }
  .jr-tl-rv { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--phosphor); }
  .jr-tl-fil { gap: 10px; }
  .jr-tl-search { position: relative; display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 12px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font-size: 13.5px; color: var(--text-dim); }
  .jr-tl-search .ico { color: var(--steel); }
  .jr-tl-sels { display: flex; flex-wrap: wrap; gap: 8px; }
  .jr-tl-sel { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px 0 12px; border: 1px solid var(--line-2); border-radius: 8px; background: transparent; color: var(--phosphor); font: 500 13px/1.2 'IBM Plex Sans', sans-serif; cursor: pointer; }
  .jr-tl-sel .ico { color: var(--steel); }
  .jr-tl-first { gap: 14px; padding: 24px; }
  .jr-tl-fh { margin: 0; font-size: 26px; line-height: 1.2; letter-spacing: -0.01em; }
  .jr-tl-fp { margin: 0; max-width: 62ch; font-size: 16px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .jr-tl-links { margin: 0; font-size: 14px; line-height: 1.5; }
  .jr-tl-prompt { gap: 10px; }
  .jr-tl-help { margin: 0; font-size: 13px; line-height: 1.5; color: var(--steel); }
  .jr-tl-ta { display: flex; flex-direction: column; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); }
  .jr-tl-ta span { display: block; min-height: 32px; padding: 6px 12px; border-bottom: 1px solid var(--line); font: 500 12px/20px 'IBM Plex Mono', monospace; color: var(--steel); }
  .jr-tl-ta span:last-child { border-bottom: 0; }
  .jr-tl-in { display: flex; align-items: center; min-height: 40px; padding: 0 12px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font-size: 15px; color: var(--text-dim); }
  .jr-tl-lb { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--phosphor); }
  .jr-tl-ghost { height: 72px; border-bottom: 1px dashed var(--line-2); background: repeating-linear-gradient(to bottom, transparent 0 23px, var(--line) 23px 24px); opacity: 0.7; }
  .jr-tl-peek { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 52px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); font: 400 14px/1.45 'IBM Plex Sans', sans-serif; color: var(--phosphor); text-align: left; cursor: pointer; }
  .jr-tl-peek > span:last-child { flex: none; font-size: 20px; color: var(--steel); }
  .jr-tl-pk .jr-tl-fl { font-size: 13.5px; padding: 0 2px; }
  .jr-tl-p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--phosphor); }
  .jr-tl-sk { display: block; width: 100%; }
  .jr-tl-skd { padding: 4px 0 6px; border-bottom: 1px solid var(--line); }
  .jr-tl-st2 { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 16px; align-items: start; }
  .jr-tl-menu { display: flex; flex-direction: column; gap: 12px; max-width: 520px; padding: 14px 16px; border: 1px solid var(--line-2); border-radius: 12px; background: var(--panel); box-shadow: var(--e2); }
  .jr-tl-mrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13.5px; color: var(--steel); }
  .jr-tl-wallfit .ac-wall { margin: 0; }
  .jr-tl-mark { display: flex; flex-direction: column; gap: 16px; }
  .jr-tl-bars { display: flex; flex-direction: column; gap: 10px; }
  .jr-tl-bars > .fd-bar:last-child { max-width: 390px; }
  .jr-tl-mk2 { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; align-items: start; }
  @media (max-width: 899px) { .jr-tl-st2, .jr-tl-mk2 { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 599px) {
    .jr-tl-entries { padding-left: 8px; padding-right: 8px; }
    .jr-tl-first { padding: 18px 16px; }
    .jr-tl-qact .btn { min-height: 44px; }
    .jr-tl-order { flex-direction: column; align-items: stretch; }
    .jr-tl-order > .btn { width: 100%; }
    .jr-tl-sel { min-height: 44px; }
    .jr-tl-search { min-height: 44px; }
    .jr-tl-days .jr-more { min-height: 44px; }
  }
`;

// ---- the spec card ------------------------------------------------------------------------------------------------------
const RULINGS = JR_RULINGS.filter((r) => !/^rule 10$|^rule 16/.test(r));

export const ROW = {
  key: 'journal-timeline',
  label: 'Journal · Timeline',
  section: 'planned',
  css: JR_CSS + TL_CSS,
  specH: 3652,
  spec: {
    title: 'Journal · Timeline',
    route: '/positions/journal',
    job: 'The home. He can write without leaving the page, and see the record in the order it was written.',
    env: {
      production: `The owner’s own journal, signed in: his entries in Written order (About on request), day groups by ET date, and the rail’s focus, account frame and minis, in solid frames. A visitor meets the Positions private-testing wall, “Sign in to open your journal”; another account sees “This journal is private to the account that owns this Convexa.”; an empty journal opens on “Start with today.”`,
      staging: `The Sample journal on the demo account, Oct 7, 2026: a fictional trader’s, every value sample data. The demo bar is the page’s one “Demo · sample data”; each frame is dashed with the 8px steel hatch band and the “Sample journal” chip, the day groups and the week’s focus included; cards carry no tag. Cards carry the words the spec prints: a card whose words it doesn’t print says so in a board note, the money-in card shows its amount with the composer’s word for its direction (“In ${usd(MONEY[0].amount)}”), and the ${UNDESCRIBED} entries the spec doesn’t describe aren’t drawn.`,
    },
    widgets: [
      { name: 'Section tabs', source: 'SectionTabs (generalised from ResearchTabs.tsx): Book · Journal · Review · Rulebook, current tab underlined in text colour', production: 'Journal current; Review and Rulebook join with slices 3 and 2', staging: 'Same band, under the demo bar' },
      { name: 'Quick capture', source: 'Typed by him; the draft is kept in this browser (convexa.journal.drafts.v1) until it saves; Numbers carried from the latest snapshot', production: 'local', staging: 'Writes go to demo browser storage' },
      { name: 'Day groups and entry cards', source: 'GET /api/journal/entries (owner only, sealed text decrypted by the server); ET dates; recalled derived on read (store.rs)', production: [['local'], ['computed']], staging: 'One dashed frame with its “Sample journal” chip holds the day groups; no tag on cards (D1)' },
      { name: 'Rail · This week’s focus', source: 'journal_focus, saved with the latest review (slice 3); dated “Focus from your Oct 7 review: …” after 7 days', production: 'His words, no tag', staging: 'The Oct 7 review’s focus' },
      { name: 'Rail · Account frame', source: 'His snapshots; facts.rs (margin used, leverage, the change, below the recorded high); the sparkline is the Path’s account value multiple', production: [['local'], ['computed']], staging: ['sample', 'Sample journal'] },
      { name: 'Rail · Rulebook mini', source: 'journal rules (slice 2); R3’s reading from the latest snapshot', production: 'computed', staging: ['sample', 'Sample journal'] },
      { name: 'Rail · Review mini', source: 'The latest saved review (slice 3)', production: 'computed', staging: ['sample', 'Sample journal'] },
      { name: 'Filters', source: 'In the browser, over decrypted entries: search, kind, ticker, written from memory, kept out of AI reads, has later notes', production: '—', staging: '—' },
    ],
    states: [
      { tag: null, when: 'First run: “Start with today.”, the outlined “Write the first entry” (the header’s “Write entry” is the screen’s one amber), “Write about an earlier day” · “Bring in past trades”, and two optional prompts with “Skip”: “What do you think your downfalls are?” (up to 5 lines, saved as his suspicions; “Reviews test these first.”) and “One rule from today” (“Adopt as R1”, with its required why). The rail’s frames name their metric: “Account value · appears after your first snapshot”.' },
      { tag: null, when: 'Loading: day-group skeletons at their final height.' },
      { tag: 'local', when: 'Loaded: Stored here on his figures, Computed on Convexa’s.' },
      { tag: ['error', 'Couldn’t load'], when: '“Your journal didn’t load. Nothing is lost.” + “Try again”. Drafts held in this browser are still listed.' },
      { tag: null, when: 'Not on your account yet (a save failed, or offline): the card’s strip, “Not on your account yet. Kept in this browser until it goes through · Try again”.' },
      { tag: null, when: 'Signing out with an unsent entry: “1 entry hasn’t reached your account yet. Signing out deletes it from this browser.” + “Try sending now” · “Sign out and delete it” · “Stay signed in”.' },
      { tag: 'notConfigured', when: 'Storage not set up (no journal encryption key on the server): “Journal storage isn’t set up on this server, so nothing can be saved yet.”' },
      { tag: 'locked', when: 'Signed out (production): the Positions private-testing wall, “Sign in to open your journal”, sign-ups closed, “See it on the demo →”.' },
      { tag: null, when: 'Not the owner (API 403 owner_only): “This journal is private to the account that owns this Convexa.” + “See it on the demo →”, with no tag (open question 12).' },
      { tag: 'sample', when: 'Staging: “Demo · sample data · Oct 7, 2026” once, in the bar; frames dashed with the hatch band and the “Sample journal” chip, once per frame; the day groups sit in one such frame, so the cards carry no tag.' },
    ],
    phone: `h1 at 30px and the tab rail. An account peek row, “${STRINGS.peek}”, opens the Path and its table twin in a bottom sheet, with the week’s focus line under it. No quick-capture box: the sticky, safe-area-padded bottom bar carries the amber “Write entry” and the outlined 44px “Margin call” with the warning glyph, and the header’s action hides. Cards are full width with a 3-line clamp; filters open in a bottom sheet. No horizontal overflow at 390 or 393.`,
    acceptance: [
      'Exactly one amber fill: “Write entry”, in the header at 1440 and in the bottom bar at 390; the rail’s “Plan a trade” is outlined (criterion 31).',
      `Staging: “Demo · sample data” appears once, in the bar; each journal frame has data-provenance="sample" and exactly one Sample mark; cards carry none (criterion 18).`,
      `The rail reads the worked example: ${usd(FACTS.accountValue)}, margin used ${pct(FACTS.marginUsed, 0)}, leverage ${times(FACTS.leverage)}, below the recorded high ${STRINGS.belowEnd}, and “${STRINGS.sinceOct2}” in textDown with its “−” (criteria 6 and 9).`,
      'Figures render in the Mono token with no dotted rule; “not set” on the Sep 30 trim card renders in Sans (criterion 8).',
      '“within” is never tinted; the Margin call pill and the Rulebook mini’s “above” carry the warning glyph; no success or error fill on any element (criterion 9).',
      'The Oct 2 trim card reads “−0.5R against planned risk · Your label: Sound”; the Sep 30 NVDA trim card reads “not set” and no label (criterion 35).',
      `The Oct 5 plan card reads “Asked 2 rules · went ahead against R3”, with his line under it, “${PLAN_WHY}” (Screens 1 and 4).`,
      'The focus line reads “This week’s focus: …” until the next review is saved, and “Focus from your Oct 7 review: …” once 7 days have passed its cutoff; no count, rate, score or streak of focus lines or labels appears (criteria 33 and 35).',
      'Empty journal: “What do you think your downfalls are?” saves up to 5 lines and “Skip” leaves writing untouched; after the first save an unanswered prompt sits under its card while it is the only entry, never under a margin-call entry; with entries and no rule the Rulebook mini reads “No rules yet · One rule from today” (criterion 34).',
      'Signed out: the wall “Sign in to open your journal” with “See it on the demo →”; another account sees the untagged sentence (Screens 1, States; the API’s 403s behind them are criterion 1).',
      `The rail’s “Below the recorded high” is chain-linked: a deposit with an end value higher by the same amount leaves it unchanged, so the ${fmtDate(etDate(MONEY[0].at))} ${usd(MONEY[0].amount)} in can’t hide the loss (criterion 7).`,
      `The rail and the day lines add up from the seed: at each of the ${SNAPSHOTS.length} sample snapshots, positions × marks + cash − margin loan equals account value to the cent, and the stock marks equal the demo catalog’s closes (criterion 26).`,
      'At 390 and 393, in both schemes: scrollWidth equals clientWidth, and with a coarse pointer no interactive element is under 44px (criterion 21).',
    ],
    built: [
      { status: 'todo', waits: 'build', slice: '1a', what: 'Slice 1a: the timeline (Written and About order, ET day groups, recalled derived on read), cards and their footers, quick capture, the first run with “What do you think your downfalls are?” and “Write about an earlier day”, the rail’s account frame (value and figure strip), the walls, sign-out with an unsent entry, the tab band Book · Journal, and the demo seed’s entries.' },
      { status: 'todo', waits: 'build', slice: '1b', what: 'Slice 1b: “Open the account path” and leverage on the rail, the trim card’s “−0.5R against planned risk · Your label: Sound”, the quick capture’s sale row and label, and the “Revisit due” line.' },
      { status: 'todo', waits: 'build', slice: '2', what: 'Slice 2: the Rulebook mini with its outlined “Plan a trade” (or “No rules yet · One rule from today”), the first run’s “One rule from today”, the plan card’s “Asked 2 rules · went ahead against R3”, the “Plan a trade” chip, and Rulebook in the tab band.' },
      { status: 'todo', waits: 'build', slice: '3', what: 'Slice 3: the rail’s “This week’s focus” and Review mini, “Reviews test these first.”, and Review in the tab band.' },
      { status: 'todo', waits: 'build', slice: '4', what: 'Slice 4: each card’s AI status at the right of its first row.' },
      { status: 'todo', waits: 'build', slice: '5', what: 'Slice 5: the first run’s “Bring in past trades”.' },
    ],
    rulings: RULINGS,
    code: [
      'apps/dashboard/src/app/pages/positions/journal/ (new: the timeline, its cards, quick capture, rail and first run)',
      'apps/dashboard/src/app/shared/ui/SectionTabs.tsx (from pages/research/ResearchTabs.tsx)',
      'apps/dashboard/src/app/app.tsx (lazyRoute inside RequireAuth, surface “your journal”)',
      'apps/dashboard/src/app/features/auth/AuthContext.tsx (sign-out with an unsent entry)',
      'apps/dashboard/src/app/pages/positions/journal/AccountPath.tsx (new, slice 1b)',
      'libs/api/src/lib/journal/facts.ts (new) · libs/api/src/lib/demo/{transport,workspace,journal}.ts · libs/api/src/lib/convexa.ts',
      'apps/api/src/routes/journal.rs · apps/api/src/services/journal/{mod,store,facts,crypto}.rs (new)',
      'design/src/screens/final/journal-timeline.mjs (these boards)',
    ],
  },
  boards: [
    B('staging', 'Staging · demo account', 1440, 2575, (o) => loaded(o, { env: 'staging' })),
    B('production', 'Production · signed out', 1440, 920, (o) => jrPage({ ...o, env: 'production', tab: null, signedIn: false, main: jrWall() })),
    B('first-run', 'Production · first run', 1440, 1332, (o) => firstRun(o)),
    B('illustrative', 'Production · illustrative', 1440, 2467, (o) => loaded(o, { env: 'production' })),
    B('phone', 'Phone · staging', 390, 2859, (o) => loaded(o, { env: 'staging', phone: true })),
    B('light', 'Light · staging', 1440, 2575, (o) => loaded(o, { env: 'staging' }), LIGHT),
    B('states', 'States', 1440, 2300, (o) => states(o)),
  ],
};
