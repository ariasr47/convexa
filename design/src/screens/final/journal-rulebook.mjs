// Final · Planned · Journal · Rulebook (spec 08, BOARD BRIEF row `journal-rulebook`): the Rulebook tab
// (/positions/rulebook, screen 9) and a rule's page (/positions/rulebook/:ruleId, screen 10), drawn on the journal kit
// (./journal-kit.mjs) and the Sample journal (design/src/data/journal-sample.mjs); the lanes' contract is
// tmp/journal-boards/KIT.md.
//
// Canon: Amendments 2026-10-28 (Positions' section tabs; "Plan a trade" as the Rulebook tab's one amber, outlined
// "Write a rule" and "Copy as text"; the phone bar's amber "Plan a trade" beside the outlined "Margin call"), rule 16's
// verdict-free scope (a draft is AI output with no amber text), P-2 (closed state words), P-3 (staging frames dashed
// with the hatch band and one "Sample journal" chip), P-4 (board notes on boards only), rule 24 (`not set`,
// `not recorded`, `—` in Sans) and The rulebook → How adherence is shown (neutral count dots, no streak or score, his
// answers and computed checks apart and never summed, the floor of 20).
//
// Every figure comes from the Sample journal: rule wordings, versions, whys, limits and the retirement are RULES; the
// asks are RULE_COUNTS (R2's Oct 1 answer is the module's derived Doesn't apply); readings are reading() on LATEST; the
// drafts' Because is FINDINGS and the Oct 7 detector count; R2's origin finding is the Sep 28 review's row 1 (its
// sentence rebuilt from detectors(), equal to the spec's text); the check table's account change is the next
// snapshot's chained change. The States board's illustrations (7 active, a paused rule, a declined draft, computed
// checks) are marked illustrative where they appear; the spec prints no words for some of them (see deviations).
import { B, LIGHT, JR_CSS, JR_ERROR_WORD, JR_NOTES, JR_R2_DERIVED, JR_RULINGS, dotJoin, jrPage, jrHeader, jrHeaderActions, jrBtn, jrGrid, jrOne, jrFrame, jrTag, jrDots, jrAbove, jrWithin, jrGap, jrAnswer, jrQuote, jrSpan, jrStrip, jrKind, jrSym, jrSheet, jrSheetStage, jrSurface, statesBoard, icon, provChip, SAMPLE_CHIP } from './journal-kit.mjs';
import { DETECTOR_ROWS, DRAFTS, ENTRY, FINDINGS, INSTRUMENTS, LATEST, PLANS, REVIEWS, REVIEW_CUTOFF, RULE, RULES, RULE_COUNTS, SCENARIO, SNAPSHOTS, STRINGS, TRADES, ANSWER_WORD, afterLine, asksLine, avgBefore, fmtDate, fmtDay, pct, reading, signedUsd, snapshotBefore, usd } from '../../data/journal-sample.mjs';

// =========================================================================================================
// Words and small parts
// =========================================================================================================
const RB_SUB = 'Your rules, in your words. Each one cites the entries it came from. Convexa never enforces them.';
const DRAFT_INTRO = 'A draft from your entries. Reword it until it’s yours, or set it aside.';
const BEFORE = 'Plan a trade asks each active rule before you place a trade at your broker. Going ahead against one takes a line on why.';
const EMPTY = 'No rules yet. Write one, or let the weekly review draft some from your entries.';
const STALE = 'Evidence changed since this was drafted: 3 new entries.';
const LIMIT_ADOPT = '7 active rules is the limit. Pause or retire one to adopt this.';
const LIMIT_RESUME = '7 active rules is the limit. Pause or retire one to resume this.';
const CANT_LOAD = 'Your journal didn’t load. Nothing is lost.';
const CAP = 7; // at most 7 active (G3, open question 18): the spec's cap, not a sample figure

const m = (x) => `<span class="mono">${x}</span>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const plain = (s) => String(s).replace(/<[^>]+>/g, '');
const SEP = '<span class="jr-sep" aria-hidden="true">·</span>';
const dotsOf = (k, n) => `<span class="jr-dots jr-rb-dots" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i${i < k ? ' class="k"' : ''}></i>`).join('')}</span>`;
const how = (w) => `<span class="jr-rb-how">${w}</span>`;
const reviewDay = (id) => fmtDate(REVIEW_CUTOFF[id]);
const vLine = (r) => { const v = r.versions[r.versions.length - 1]; return `${m(`v${v.v}`)} · since ${fmtDate(v.from)}`; };
const ACTIVE = RULES.filter((r) => r.status === 'active');
const RETIRED = RULES.filter((r) => r.status === 'retired');
const FINDING = Object.fromEntries(FINDINGS.map((f) => [f.id, f]));
const ROW_TITLE = Object.fromEntries(DETECTOR_ROWS.map((d) => [d.row, d.title]));
const OCT7 = Object.fromEntries(REVIEWS.oct7.detectors.filter((d) => d.row).map((d) => [d.row, d]));
const SEP28 = Object.fromEntries(REVIEWS.sep28.detectors.filter((d) => d.row).map((d) => [d.row, d]));

/** "2 active · 7 at most" (STRINGS.rulesCount), figures in Mono. */
const countLine = (active = ACTIVE.length) => `<p class="jr-rb-cnt">${m(active)} active · ${m(CAP)} at most</p>`;
if (plain(countLine()) !== STRINGS.rulesCount) throw new Error(`journal-rulebook: count line drifted from STRINGS.rulesCount: ${plain(countLine())}`);

/** His answers per rule (answered by you): "Asked in 2 plans · Yes 0 · No 1 · Doesn’t apply 1 · Not answered 0", each
 *  answer kind with its neutral dot strip over the plans asked (Design → Charts 4). The words are asksLine's. */
function asks(id) {
  const c = RULE_COUNTS[id];
  const kinds = [[ANSWER_WORD.yes, c.yes], [ANSWER_WORD.no, c.no], [ANSWER_WORD.doesnt_apply, c.doesnt_apply], [ANSWER_WORD.not_answered, c.not_answered]];
  const html = `<span>Asked in ${m(c.asked)} plans</span>${kinds.map(([w, k]) => `${SEP}<span class="jr-rb-ak">${w} ${m(k)}${dotsOf(k, c.asked)}</span>`).join('')}`;
  if (plain(html).replace(/·/g, ' · ').replace(/\s+/g, ' ').trim() !== asksLine(id)) throw new Error(`journal-rulebook: asks line drifted from asksLine(${id})`);
  return `<p class="jr-rb-line jr-rb-asks">${html}</p>`;
}
/** A limit reading on the latest snapshot: "Margin used now 92% · limit 50% · above" (R3); null where code has none. */
function readingLine(id) {
  const rd = reading(id, LATEST.id);
  if (!rd) return '';
  const html = `Margin used now ${m(pct(rd.value, 0))} · limit ${m(`${rd.limit}%`)} · ${rd.above ? jrAbove() : jrWithin()}`;
  if (!plain(html).startsWith(STRINGS.rulebookR3)) throw new Error('journal-rulebook: reading drifted from STRINGS.rulebookR3');
  return `<p class="jr-rb-line">${html}</p>`;
}
/** A limit he didn't write: "position % below average cost · at or above · 15", labelled as Convexa's threshold. */
const limitLine = (r) => `<p class="jr-rb-line"><span class="jr-rb-lbl">Limit</span> ${r.limit.metric} · ${r.limit.cmp} · ${m(`${r.limit.value}${r.limit.unit}`)}<span class="jr-sep jr-rb-nsep" aria-hidden="true">·</span><span class="jr-rb-note">${r.limit.note}</span></p>`;

// =========================================================================================================
// Drafts: "Drafted from your journal" (slice 4) and "Your drafts" (slice 2, G3)
// =========================================================================================================
/** A draft's Because from the review that drafted it: the finding (named by its pattern, as R2's origin names it),
 *  its cites and code's count with its building line. */
function draftModel(d) {
  const f = FINDING[d.finding];
  const row = OCT7[f.row];
  return { id: d.id, wording: d.wording, review: d.review, finding: ROW_TITLE[f.row], href: `/positions/review?finding=${f.id}`, cites: f.cites.length, k: row.k, n: row.n };
}
const DRAFT = Object.fromEntries(DRAFTS.map((d) => [d.id, draftModel(d)]));
/** R2 as the Sep 28 review drafted it, before he adopted it on Sep 30 (the Adopt-in-progress state). */
const R2_DRAFT = (() => {
  const row = SEP28[RULE.R2.limit.row];
  return { id: 'd-sep28', wording: RULE.R2.versions[0].wording, review: RULE.R2.originReview, finding: RULE.R2.originFinding, href: '/positions/review/sep28?finding=f-sep28-row1', cites: row.k + row.uncounted.length, k: row.k, n: row.n, check: RULE.R2.check, limit: RULE.R2.limit };
})();

const label = (text, inner, cls = '') => `<label class="jr-rb-fld${cls ? ' ' + cls : ''}"><span class="jr-rb-lbl">${text}</span>${inner}</label>`;
const input = (v = '', { focus = false, multi = false, ph = '', mono = false, name = '' } = {}) => `<span class="jr-rb-in${multi ? ' multi' : ''}${focus ? ' focus' : ''}${mono ? ' mono' : ''}" role="textbox"${multi ? ' aria-multiline="true"' : ''}${name ? ` aria-label="${esc(name)}"` : ''}>${v || (ph ? `<span class="jr-rb-ph">${ph}</span>` : '')}${focus ? '<span class="jr-rb-caret" aria-hidden="true"></span>' : ''}</span>`;
const select = (v) => `<span class="jr-rb-in sel" role="combobox" aria-expanded="false">${v}${icon('chevron', 16)}</span>`;
const limitField = (lim) => (lim
  ? label('Limit', `<span class="jr-rb-limit">${lim.metric} · ${lim.cmp} · ${m(`${lim.value}${lim.unit}`)}</span><span class="jr-rb-note">${lim.note}</span>`)
  : label('Limit', select(jrGap('not set'))));
const because = (d) => `<div class="jr-rb-bc"><h3 class="jr-rb-h">Because</h3><p class="jr-rb-line"><a class="jr-rb-fl" href="${d.href}">“${d.finding}”</a></p><p class="jr-rb-sub">${dotJoin([`your ${reviewDay(d.review)} review`, `cites ${m(d.cites)} entries`])}</p>${jrDots(d.k, d.n, { label: `${d.k} of ${d.n}; ${d.n} counted; rates start at 20` })}</div>`;

/** A draft card: unnumbered, the intro, his editable wording (Sans 17), Because, Check by asking, the optional limit,
 *  the required why, outlined "Adopt" and text "Not for me". `under` sits under the actions (a refusal line, a reason
 *  form); `strip` above the wording (the stale strip); `readonly` drops the editing (a declined draft). */
function draftCard(d, { check = '', why = '', whyFocus = false, adoptOff = false, strip = '', under = '', readonly = false, status = '', acts = true, fields: showFields = true } = {}) {
  const word = readonly ? `<p class="jr-rb-word">${d.wording}</p>` : `<div class="jr-rb-wbox" role="textbox" aria-multiline="true" aria-label="Draft wording">${d.wording}</div>`;
  const fields = readonly || !showFields ? '' : `<div class="jr-rb-fields">${label('Check by asking', input(check))}${limitField(d.limit ?? null)}${label('Why this rule, in your words', input(why, { multi: true, focus: whyFocus }), 'req')}</div>`;
  const actions = acts && !readonly ? `<div class="jr-rb-acts">${jrBtn('Adopt', { attrs: adoptOff ? 'disabled aria-disabled="true"' : '' })}${jrBtn('Not for me', { kind: 'text' })}</div>` : '';
  return `<article class="jr-rb-draft" aria-label="Draft: ${esc(plain(d.wording))}">${readonly ? '' : `<p class="jr-rb-intro">${DRAFT_INTRO}</p>`}<p class="jr-rb-meta">drafted by the ${reviewDay(d.review)} review</p>${strip}${word}<div class="jr-rb-dgrid">${because(d)}${fields}</div>${status}${actions}${under}</article>`;
}
/** A draft he wrote himself at the limit (Your drafts): origin "written by you", Edit and an outlined Adopt. */
const ownDraft = (wording, { under = '' } = {}) => `<article class="jr-rb-draft" aria-label="Your draft: ${esc(wording)}"><p class="jr-rb-meta">written by you</p><p class="jr-rb-word">${wording}</p><div class="jr-rb-acts">${jrBtn('Edit', { ic: 'edit' })}${jrBtn('Adopt')}</div>${under}</article>`;
/** A refusal or note line under a control: neutral, with the info glyph (it isn't a warning or a failure). */
const inlineLine = (text) => `<p class="jr-rb-inl" role="status">${icon('info', 14)}<span>${text}</span></p>`;

// =========================================================================================================
// Active, paused and retired rules
// =========================================================================================================
/** One active rule: "R3" (Mono 13) and its wording, "v1 · since Sep 30", a threshold limit's label or the reading
 *  ("above" with the warning glyph), his answers (answered by you) and, on its own line, the computed checks, the
 *  account change after Yes vs after No, and the row menu (Edit · Pause · Retire). */
function ruleRow(id, { computed = null, menu = true, after = true } = {}) {
  const r = RULE[id];
  const lim = r.limit && r.limit.source === 'threshold' ? limitLine(r) : '';
  const comp = computed ?? `<p class="jr-rb-line">${STRINGS.computedNone}</p>`;
  return `<article class="jr-rb-rule" aria-label="${r.id}: ${esc(r.versions[r.versions.length - 1].wording)}">
    <a class="jr-rb-num" href="/positions/rulebook/${r.id}">${r.id}</a>
    <div class="jr-rb-rb"><p class="jr-rb-word"><a class="jr-rb-wl" href="/positions/rulebook/${r.id}">${r.versions[r.versions.length - 1].wording}</a></p><p class="jr-rb-meta">${vLine(r)}</p>${lim}${readingLine(id)}
      <div class="jr-rb-kv">${how('answered by you')}${asks(id)}</div>
      <div class="jr-rb-kv">${how('computed')}${comp}</div>
      ${after ? `<p class="jr-rb-after">${afterLine(id)}</p>` : ''}</div>
    ${menu ? `<button type="button" class="btn ghost jr-rb-mb" aria-haspopup="menu" aria-label="${r.id}: Edit, Pause or Retire">${icon('dots', 18)}</button>` : ''}
  </article>`;
}
/** A retired rule, collapsed to its line: "R1 retired Sep 24: “I add from my phone and can’t always write first.”". */
function retiredRow(r, { open = false } = {}) {
  const v = r.versions[r.versions.length - 1];
  return `<details class="jr-rb-col"${open ? ' open' : ''}><summary><span>${m(r.id)} retired ${fmtDate(r.retired.on)}: “${r.retired.reason}”</span>${icon('chevron', 16, 'class="ico jr-rb-chev"')}</summary><div class="jr-rb-colb"><p class="jr-rb-word">${v.wording}</p><p class="jr-rb-meta">${dotJoin([`${m(`v${v.v}`)} · since ${fmtDate(v.from)}`, r.origin])}</p><p class="jr-rb-line"><span class="jr-rb-lbl">Check by asking</span> “${v.check}”</p><div class="jr-rb-why"><span class="jr-rb-lbl">Why this rule, in your words</span>${jrQuote(r.why)}</div></div></details>`;
}

// =========================================================================================================
// Sections: a frame that is also an accordion (open by default; Paused and Retired hold collapsed rows). On staging
// each is dashed with the hatch band and names the sample once, with its "Sample journal" chip in the head.
// =========================================================================================================
function section(env, { title, body, open = true, label: lab = '' }) {
  const sample = env === 'staging';
  return `<section class="jr-frame jr-rb-acc${sample ? ' is-sample' : ''}" aria-label="${esc(plain(lab || title))}"><details${open ? ' open' : ''}><summary><span class="jr-fh jr-rb-st"><h2>${title}</h2>${sample ? provChip(SAMPLE_CHIP, 'dashed') : ''}</span>${icon('chevron', 18, 'class="ico jr-rb-chev"')}</summary><div class="jr-rb-ab">${body}</div></details></section>`;
}
const draftsSection = (env, { open = true } = {}) => section(env, { title: `Drafted from your journal (${m(DRAFTS.length)})`, open, body: DRAFTS.map((d) => draftCard(DRAFT[d.id])).join('') });
const activeSection = (env, { open = true } = {}) => section(env, { title: `Active (${m(ACTIVE.length)})`, open, body: `<div class="jr-rb-rules">${ACTIVE.map((r) => ruleRow(r.id)).join('')}</div>` });
const retiredSection = (env, { open = true } = {}) => section(env, { title: `Retired (${m(RETIRED.length)})`, open, body: RETIRED.map((r) => retiredRow(r)).join('') });
const railFrame = (env, { active = ACTIVE.length } = {}) => jrFrame({ env, title: 'Before you trade', level: 'h2', chipAt: 'foot', body: `<p class="jr-rb-p">${BEFORE}</p>${countLine(active)}` });

// =========================================================================================================
// The Rulebook tab (screen 9): header with the one amber, main 840 and rail 320; on a phone, accordions, one card per
// rule, "Write a rule" and "Copy as text" under the header, and the bottom bar's amber "Plan a trade"
// =========================================================================================================
const phoneActs = () => `<div class="jr-rb-phacts">${jrBtn('Write a rule', { ic: 'edit', size: 'touch' })}${jrBtn('Copy as text', { ic: 'copy', size: 'touch' })}</div>`;
/** The staging board note (P-4): R2's asks count its Oct 1 answer, which the spec doesn't print. */
const RB_NOTE = `${JR_NOTES.staging} ${JR_R2_DERIVED}`;
function rulebookPage(o, { phone = false } = {}) {
  const env = 'staging';
  const main = `${draftsSection(env)}${activeSection(env)}${retiredSection(env, { open: !phone })}`;
  return jrPage({ ...o, env, tab: 'rulebook', bar: 'rulebook', label: 'Rulebook', note: RB_NOTE, main: `${jrHeader({ title: 'Rulebook', sub: RB_SUB, actions: jrHeaderActions('rulebook') })}${phoneActs()}${jrGrid(main, railFrame(env), { rail: 840 })}` });
}
/** The phone: the page, then its row menu (opened from R3's ⋯) as a bottom sheet over the page; the sheet names the
 *  sample once, with the Sample tag in its peek row (D1). */
function rulebookPhone(o) {
  const r = RULE.R3;
  const sheet = jrSheet({ title: `${r.id} · ${plain(vLine(r))}`, sub: r.versions[r.versions.length - 1].wording, tag: jrTag('sample'), label: `${r.id} menu`, actions: [jrBtn('Edit', { ic: 'edit', size: 'touch' }), jrBtn('Pause', { size: 'touch' }), jrBtn('Retire', { kind: 'text', size: 'touch' })] });
  return jrSurface({ ...o, gap: 0, html: `${rulebookPage({ scheme: o.scheme, minHeight: 0 }, { phone: true })}<div class="v4" data-scheme="${o.scheme || 'dark'}" style="background: var(--ink); color: var(--phosphor);">${jrSheetStage(sheet)}</div>` });
}

// =========================================================================================================
// The rule's page (screen 10), R2: one column 880 with the version timeline, his why, the origin finding and its
// cited entries, the check table (answered by you; computed at kept entries: none yet) and the counts block
// =========================================================================================================
/** The Sep 28 review's finding on row 1, rebuilt from code's cases (equal to the spec's sentence), with each stated
 *  figure traced (check glyph + Mono), as a finding's figures are. */
function originFinding() {
  const row = SEP28[RULE.R2.limit.row];
  const tr = (x) => `<span class="jr-rb-tr">${icon('check', 12)}${m(x)}</span>`;
  const list = row.cases.map((c) => `${fmtDate(c.date)} (${tr(pct(c.below, 1))})`);
  const claim = `In ${tr(row.k)} of the ${tr(row.n)} adds you wrote at the time, the price was ${tr(`${RULE.R2.limit.value}%`)} or more below your average cost: the ${INSTRUMENTS[row.cases[0].inst].short} on ${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}.`;
  const u = row.uncounted[0];
  const cut = `Cut the other way: ${m(row.uncounted.length)} (${INSTRUMENTS[u.inst].short}, ${fmtDate(u.date)}, ${m(pct(u.below, 1))} below your average cost)`;
  return { row, claim, cut };
}
/** A cited add: day, kind, ticker, the kept detail ("TSLA Dec 18 ’26 440 P · 3 at $25.60") and code's % below the
 *  average cost just before it; Sep 18 also quotes its printed span. */
function citedAdd(c, { counter = false } = {}) {
  const e = ENTRY[c.entry];
  const t = TRADES.find((x) => x.id === e.trade);
  const I = INSTRUMENTS[t.inst];
  const span = e.spans && e.spans[0] ? `<p class="jr-rb-q">“${jrSpan(e.spans[0])}”</p>` : '';
  return `<li class="jr-rb-ci"><div class="jr-rb-cih"><a href="/positions/journal/${e.id}" class="jr-rb-cd">${fmtDay(c.date)}</a>${jrKind(e.kind)}${jrSym(I.symbol)}${counter ? '<span class="jr-rb-cut">Cut the other way</span>' : ''}</div><p class="jr-rb-line">${I.name} · ${m(t.qty)} at ${m(usd(t.price, { dp: 2 }))} · ${m(pct(c.below, 1))} below your average cost of ${m(usd(avgBefore(t), { dp: 2 }))}</p>${span}</li>`;
}
/** His answers to R2, one row per plan: date · entry · how · answer · the reading at the time · on a No, his why ·
 *  the account change to the next snapshot (▼/▲ with its sign, in textDown/textUp). R2's metric needs an add's price,
 *  so no plan has a reading (—). */
function checkRows(ruleId) {
  return PLANS.flatMap((p) => p.answers.filter((a) => a.rule === ruleId).map((a) => {
    const iso = `${p.at}T09:30:00-04:00`;
    const base = snapshotBefore(iso);
    const next = SNAPSHOTS.find((s) => s.at > iso);
    if (next.k !== base.k + 1) throw new Error('journal-rulebook: the next snapshot isn’t the reading snapshot’s successor');
    const ch = next.change;
    const down = ch.usd.sign() < 0;
    const chg = `<span class="mono ${down ? 't-down' : 't-up'}">${down ? '▼' : '▲'} ${signedUsd(ch.usd)} (${pct(ch.pct, 1, { sign: true })})</span>`;
    const rd = reading(ruleId, base.id);
    const rdg = rd ? `${m(pct(rd.value, 0))} · limit ${m(`${rd.limit}%`)} · ${rd.above ? jrAbove() : jrWithin()}` : jrGap('—');
    return `<tr><td>${fmtDate(p.at)}</td><td><a href="/positions/journal/${p.entry}">${fmtDate(p.at)} plan (${INSTRUMENTS[p.inst].short})</a></td><td>${how('answered by you')}</td><td>${jrAnswer(ANSWER_WORD[a.answer])} <span class="jr-rb-vtag">${m(`v${a.v}`)}</span></td><td>${rdg}</td><td>${a.answer === 'no' ? jrQuote(a.reason) : jrGap('—')}</td><td>${chg}<span class="jr-rb-tsub">${fmtDate(base.asOf)} → ${fmtDate(next.asOf)}</span></td></tr>`;
  })).join('');
}
function rulePage(o) {
  const env = 'staging';
  const r = RULE.R2;
  const v = r.versions[r.versions.length - 1];
  const head = `<header class="jr-h jr-rb-rh"><div><p class="jr-rb-crumb"><a href="/positions/rulebook">${icon('back', 14)}Rulebook</a></p><h1 class="display">${r.id}</h1><p class="jr-rb-hw">${v.wording}</p><p class="jr-rb-meta">${dotJoin([`${m(`v${v.v}`)} · since ${fmtDate(v.from)}`, r.origin])}</p></div><div class="jr-acts">${jrBtn('Edit', { ic: 'edit' })}${jrBtn('Pause')}${jrBtn('Retire', { kind: 'text' })}</div></header>`;
  const vt = `<ol class="jr-rb-vt" aria-label="Versions">${r.versions.map((x, i) => `<li><span class="jr-rb-vd">${fmtDate(x.from)}</span><div class="jr-rb-ve"><p>${x.note}</p>${i < r.versions.length - 1 ? `<p class="jr-rb-vw">${x.wording}</p>` : ''}</div></li>`).join('')}</ol>`;
  const def = `<div class="jr-rb-why"><span class="jr-rb-lbl">Why this rule, in your words</span>${jrQuote(r.why)}</div><dl class="jr-rb-dl"><dt>Check by asking</dt><dd>“${r.check}”</dd><dt>Limit</dt><dd>${r.limit.metric} · ${r.limit.cmp} · ${m(`${r.limit.value}${r.limit.unit}`)}${SEP}<span class="jr-rb-note">${r.limit.note}</span></dd></dl>`;
  const of = originFinding();
  const origin = `<div class="jr-rb-fh">${['About what you decided', 'Linked to losses'].map((w) => `<span class="jr-rb-pill">${w}</span>`).join('')}<a href="/positions/review/sep28?finding=f-sep28-row1" class="jr-rb-src">your ${reviewDay(r.originReview)} review</a></div><p class="jr-rb-claim">${of.claim}</p><p class="jr-rb-sub">In ${m(of.row.k)} of ${m(of.row.n)} “Added” entries · cites ${m(of.row.n)}</p>${jrDots(of.row.k, of.row.n)}<p class="jr-rb-line">${of.cut}</p><ul class="jr-rb-cites" aria-label="Cited entries">${of.row.cases.map((c) => citedAdd(c)).join('')}${of.row.uncounted.map((c) => citedAdd(c, { counter: true })).join('')}</ul>`;
  const table = `<div class="jr-rb-tw" role="region" aria-label="Checks of ${r.id}" tabindex="0"><table class="jr-rb-tbl"><thead><tr><th>Date</th><th>Entry</th><th>How</th><th>Answer or result</th><th>Reading at the time</th><th>Why go ahead</th><th>Account change to the next snapshot</th></tr></thead><tbody>${checkRows(r.id)}</tbody></table></div><div class="jr-rb-kv">${how('computed')}<p class="jr-rb-line">${STRINGS.computedNone}</p></div>`;
  const counts = `<div class="jr-rb-counts"><div class="jr-rb-kv">${how('answered by you')}${asks(r.id)}</div><p class="jr-rb-after">${afterLine(r.id)}</p></div>`;
  const main = jrOne(`${head}${jrFrame({ env, label: 'Versions and why', chipAt: 'foot', body: `${vt}${def}` })}${jrFrame({ env, title: 'Because', level: 'h2', body: origin })}${jrFrame({ env, label: 'Checks', chipAt: 'foot', body: `${table}${counts}` })}`);
  return jrPage({ ...o, env, tab: 'rulebook', label: `${r.id} · Rulebook`, note: RB_NOTE, main });
}

// =========================================================================================================
// States (12): the tab's states and the rule page's (Paused, Retired, Declined draft), on the sample where it has
// them and illustrative where it can't (7 active, a paused rule, a declined draft, computed checks)
// =========================================================================================================
const prodFrame = (o) => jrFrame({ env: 'production', ...o });
const skel = (w, h) => `<span class="skel" aria-hidden="true" style="display: block; width: ${w}; height: ${h}px;"></span>`;
function states({ scheme = 'dark', minHeight = 0 } = {}) {
  const exit = DRAFT['d-exit'];
  const earn = DRAFT['d-earnings'];
  const declineReason = 'R3 already covers margin.'; // composed for the board: the sample declines no draft (deviations)
  const paused = RULE.R2;
  const pausedRow = (under = '') => `<article class="jr-rb-rule is-paused" aria-label="${paused.id}, paused"><span class="jr-rb-num">${paused.id}</span><div class="jr-rb-rb"><p class="jr-rb-word">${paused.versions[paused.versions.length - 1].wording}</p><p class="jr-rb-meta">${dotJoin([vLine(paused), `paused ${fmtDate(SCENARIO.date)}`])}</p><div class="jr-rb-acts">${jrBtn('Resume')}</div>${under}</div></article>`;
  const focusWords = REVIEWS.oct7.focus.text; // his own line from the Oct 7 review, written as a rule at the limit
  // Computed checks are illustrative (the sample has none): three Added entries after the scenario day, read as the
  // Sep 18 add would be (28.3%, as STRINGS.r2Touch computes it), as the spec's edge example (14.96%) and with a
  // missing input.
  const add3 = TRADES.find((t) => t.id === ENTRY['e-sep18'].trade);
  const below3 = pct(avgBefore(add3).sub(add3.price).div(avgBefore(add3)), 1);
  const l2 = RULE.R2.limit.value;
  const compCount = `<p class="jr-rb-line jr-rb-asks"><span class="jr-rb-lead">Computed:</span><span class="jr-rb-ak">within ${m(1)}${dotsOf(1, 3)}</span>${SEP}<span class="jr-rb-ak">${jrAbove()} ${m(1)}${dotsOf(1, 3)}</span>${SEP}<span class="jr-rb-ak">not recorded ${m(1)}${dotsOf(1, 3)}</span></p>`;
  const illRows = [['2026-10-12', jrAbove(), `${m(below3)} below average cost at the add price · limit ${m(l2)}`], ['2026-10-14', jrWithin(), `${m('14.96%')} · limit ${m(l2)}`], ['2026-10-16', jrGap('not recorded'), `${jrGap('not recorded')} · limit ${m(l2)}`]]
    .map(([d, res, rdg]) => `<tr><td>${fmtDate(d)}</td><td>${jrKind('added')}</td><td>${how('computed')}</td><td>${res}</td><td>${rdg}</td><td>${jrGap('—')}</td><td>${jrGap('—')}</td></tr>`).join('');
  const compTable = `<div class="jr-rb-tw" role="region" aria-label="Checks of R2, illustrative" tabindex="0"><table class="jr-rb-tbl"><thead><tr><th>Date</th><th>Entry</th><th>How</th><th>Answer or result</th><th>Reading at the time</th><th>Why go ahead</th><th>Account change to the next snapshot</th></tr></thead><tbody>${checkRows('R2')}${illRows}</tbody></table></div>`;
  const tail = `<article class="jr-rb-draft jr-rb-tail" aria-label="The same draft, his why written">${label('Why this rule, in your words', input(RULE.R2.why, { multi: true }))}<div class="jr-rb-acts">${jrBtn('Adopt', { attrs: 'data-focus="true" style="outline: 2px solid var(--amber-text); outline-offset: 2px;"' })}${jrBtn('Not for me', { kind: 'text' })}</div></article>`;
  const items = [
    { name: 'Empty', tag: null, when: 'No rule and no draft. From slice 2 it holds “One rule from today” (G5): his wording, the required why and an outlined “Adopt as R1”, so a journal that already has entries meets it here.', html: prodFrame({ label: 'Rulebook, empty', body: `<p class="jr-rb-p">${EMPTY}</p><div class="jr-rb-form"><h3 class="jr-rb-h">One rule from today</h3>${input('', { ph: 'When …, I …', name: 'One rule from today' })}${label('Why this rule, in your words', input('', { multi: true }))}<div class="jr-rb-acts">${jrBtn('Adopt as R1')}</div></div>` }) },
    { name: 'Drafts only', tag: null, when: 'The review drafted rules and none is adopted yet; no words of its own. The rail counts what is active.', html: `${section('production', { title: `Drafted from your journal (${m(DRAFTS.length)})`, body: draftCard(exit) })}${prodFrame({ title: 'Before you trade', level: 'h3', body: `<p class="jr-rb-p">${BEFORE}</p>${countLine(0)}` })}` },
    { name: 'Stale draft', tag: null, when: 'New entries changed the evidence the draft was drawn from: a burnt-orange strip with its icon, on the card. The count is the spec’s example.', html: draftCard(earn, { strip: jrStrip('warn', STALE) }) },
    { name: 'Adopt in progress · Why required', tag: null, when: `R2 on ${fmtDate(RULE.R2.versions[0].from)}, as the ${reviewDay(RULE.R2.originReview)} review drafted it: Adopt waits until “Why this rule, in your words” has a line (above), then adopts it as R2 v1 (below, focus on Adopt). The spec prints no error words for a missing why.`, html: `${draftCard(R2_DRAFT, { check: R2_DRAFT.check, whyFocus: true, adoptOff: true })}${tail}` },
    { name: 'Not for me, with his reason', tag: null, when: 'He sets a draft aside with a line on why; it stays read-only, unnumbered, and isn’t drafted again until 5 more entries change the count. Illustrative: the reason is composed for the board.', html: draftCard(earn, { fields: false, acts: false, under: `<div class="jr-rb-form">${label('Reason', input(declineReason, { focus: true }))}<div class="jr-rb-acts">${jrBtn('Not for me')}</div></div>` }) },
    { name: 'Paused', tag: null, when: 'Collapsed with its dates; no checks are asked and it doesn’t count toward the 7. Its menu offers Resume. Illustrative: R2 paused on the scenario day.', html: section('production', { title: 'Paused', body: pausedRow() }) },
    { name: 'Retired', tag: null, when: `R1, written ${fmtDate(RULE.R1.versions[0].from)} as his first run’s rule and retired ${fmtDate(RULE.R1.retired.on)} with his reason: it keeps its number and stays listed, and nothing is deleted.`, html: section('production', { title: `Retired (${m(RETIRED.length)})`, body: RETIRED.map((r) => retiredRow(r, { open: true })).join('') }) },
    { name: 'Declined draft, read-only', tag: null, when: 'The rule page of a draft he set aside: his wording kept, no number, his reason under it, no Adopt. Illustrative, as above.', html: draftCard(earn, { readonly: true, status: `<p class="jr-rb-line jr-rb-dec">${dotJoin(['Not for me', fmtDate(SCENARIO.date), `“${declineReason}”`])}</p>` }) },
    { name: 'Loading', tag: null, when: 'Skeletons at their final height: the drafts, the rule rows and the rail. No tag.', html: `<div class="jr-rb-sk">${skel('42%', 22)}${skel('100%', 150)}${skel('100%', 96)}${skel('100%', 96)}${skel('60%', 14)}</div>` },
    { name: 'Couldn’t load', tag: ['error', JR_ERROR_WORD], when: 'As on the timeline: the cause and Try again. Drafts and rules are on the account; nothing is lost.', html: prodFrame({ label: 'Rulebook, couldn’t load', tag: jrTag('error'), body: `<p class="jr-rb-p">${CANT_LOAD}</p><div class="jr-rb-acts">${jrBtn('Try again', { ic: 'refresh' })}</div>` }) },
    { name: 'At the limit · 7 active', tag: null, wide: true, when: `Illustrative, with 7 rules active (G3): Adopt and Resume are refused inline and adopt nothing; “Write a rule” offers “Save as draft”, and his words land under “Your drafts”, origin “written by you”, with Edit and an outlined Adopt. Drafts and paused rules don’t count. The line he writes is his ${reviewDay('oct7')} focus.`, html: `<div class="jr-rb-pair">${draftCard(exit, { under: inlineLine(LIMIT_ADOPT) })}<div class="jr-rb-col2">${section('production', { title: 'Paused', body: pausedRow(inlineLine(LIMIT_RESUME)) })}${prodFrame({ title: 'Write a rule', level: 'h3', body: `${input(focusWords, { name: 'Write a rule' })}${label('Why this rule, in your words', input('', { multi: true }))}<div class="jr-rb-acts">${jrBtn('Save as draft')}</div>` })}${section('production', { title: 'Your drafts', body: ownDraft(focusWords) })}${prodFrame({ title: 'Before you trade', level: 'h3', body: countLine(CAP) })}</div></div>` },
    { name: 'Computed checks', tag: ['computed'], wide: true, when: `Slice 3 (G8), on illustrative Added entries after the scenario day: the sample has none, since no Entered or Added entry follows ${fmtDate(RULE.R2.versions[0].from)}. Each reads within (plain), above (warning glyph) or not recorded (Sans), derived on read, counted on the rule apart from his answers and never summed with them.`, html: `<div class="jr-rb-rules">${ruleRow('R2', { computed: compCount, menu: false })}</div>${compTable}` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Journal · Rulebook · states', lead: 'The Rulebook tab and a rule’s page in every state the spec names: the sample where it has them, illustrative where it can’t (7 active, a paused rule, a declined draft, computed checks). Counts stay neutral dots; “within” is plain text; “above” carries the warning glyph.', items });
}

// =========================================================================================================
// Row CSS (jr-rb-)
// =========================================================================================================
const RB_CSS = `
  .jr-rb-ab { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
  .jr-rb-acc > details > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 32px; }
  .jr-rb-st { flex: 1 1 auto; min-width: 0; }
  .jr-rb-acc > details > summary::-webkit-details-marker { display: none; }
  .jr-rb-acc > details > summary > .jr-rb-chev, .jr-rb-col > summary > .jr-rb-chev { flex: none; color: var(--steel); transition: transform 180ms ease; }
  .jr-rb-acc > details[open] > summary > .jr-rb-chev, .jr-rb-col[open] > summary > .jr-rb-chev { transform: rotate(180deg); }
  .jr-rb-acc > details > summary h2 .mono, .jr-rb-acc > details > summary h3 .mono { font-weight: 500; }
  .jr-rb-lbl { font-size: 12.5px; font-weight: 600; line-height: 1.4; color: var(--phosphor); }
  .jr-rb-h { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--phosphor); }
  .jr-rb-p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .jr-rb-line { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--phosphor); overflow-wrap: anywhere; }
  .jr-rb-sub { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .jr-rb-meta { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .jr-rb-meta .mono, .jr-rb-sub .mono { color: var(--phosphor); }
  .jr-rb-note { display: inline-block; font-size: 12.5px; line-height: 1.45; color: var(--steel); }
  .jr-rb-intro { margin: 0; font-size: 14px; line-height: 1.5; color: var(--phosphor); }
  .jr-rb-cnt { margin: 0; font-size: 13.5px; color: var(--text-dim); } .jr-rb-cnt .mono { color: var(--phosphor); }
  .jr-rb-word { margin: 0; font: 600 17px/1.45 'IBM Plex Sans', sans-serif; color: var(--phosphor); overflow-wrap: anywhere; text-wrap: pretty; }
  .v4 a.jr-rb-wl, .v4 a.jr-rb-num { color: var(--phosphor) !important; text-decoration: none; }
  a.jr-rb-wl:hover, a.jr-rb-num:hover { text-decoration: underline; }
  .jr-rb-wbox { padding: 10px 12px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font: 400 17px/1.5 'IBM Plex Sans', sans-serif; color: var(--phosphor); overflow-wrap: anywhere; }
  .jr-rb-fld { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .jr-rb-in { position: relative; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 8px 12px; box-sizing: border-box; border-radius: 8px; border: 1px solid var(--line-2); background: var(--ink-2); font: 400 14px/1.45 'IBM Plex Sans', sans-serif; color: var(--phosphor); overflow-wrap: anywhere; }
  .jr-rb-in.multi { align-items: flex-start; min-height: 64px; }
  .jr-rb-in.sel { justify-content: space-between; }
  .jr-rb-in.sel .ico { color: var(--steel); }
  .jr-rb-in.focus { border-color: var(--amber-text); box-shadow: 0 0 0 3px var(--amber-tint); }
  .jr-rb-caret { display: inline-block; width: 1px; height: 18px; background: var(--phosphor); }
  .jr-rb-ph { color: var(--steel); }
  .jr-rb-limit { font-size: 13.5px; line-height: 1.5; color: var(--phosphor); }
  .jr-rb-draft { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); container-type: inline-size; }
  .jr-rb-dgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 16px 24px; align-items: start; }
  .jr-rb-bc { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .v4 a.jr-rb-fl { font-weight: 600; }
  .jr-rb-fields { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .jr-rb-acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .jr-rb-inl { margin: 0; display: flex; align-items: flex-start; gap: 6px; font-size: 13px; line-height: 1.5; color: var(--phosphor); }
  .jr-rb-inl .ico { flex: none; margin-top: 3px; color: var(--steel); }
  .jr-rb-form { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
  .jr-rb-rules { display: flex; flex-direction: column; }
  .jr-rb-rule { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 4px 12px; align-items: start; padding: 14px 0; border-top: 1px solid var(--line); }
  .jr-rb-rules > .jr-rb-rule:first-child { border-top: 0; padding-top: 2px; }
  .jr-rb-num { font: 500 13px/24px 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .jr-rb-rb { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .jr-rb-kv { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; min-width: 0; }
  .jr-rb-how { flex: none; display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border: 1px solid var(--line-2); border-radius: 999px; font-size: 11.5px; font-weight: 600; line-height: 1; color: var(--steel); white-space: nowrap; }
  .jr-rb-asks { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 0; }
  .jr-rb-ak { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .jr-rb-dots { margin-left: 2px; gap: 3px; }
  .jr-rb-lead { margin-right: 8px; }
  @container (max-width: 520px) { .jr-rb-asks > .jr-sep, .jr-rb-nsep { display: none; } .jr-rb-asks { gap: 4px 14px; } .jr-rb-nsep + .jr-rb-note { display: block; } }
  .jr-rb-after { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--steel); }
  .jr-rb-mb { width: 36px; padding: 0; }
  .jr-rb-col { border-top: 1px solid var(--line); }
  .jr-rb-ab > .jr-rb-col:first-child { border-top: 0; }
  .jr-rb-col > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 4px 0; font-size: 13.5px; line-height: 1.5; color: var(--phosphor); }
  .jr-rb-col > summary::-webkit-details-marker { display: none; }
  .jr-rb-col > summary > span { flex: 1 1 auto; min-width: 0; }
  .jr-rb-colb { display: flex; flex-direction: column; gap: 8px; padding: 4px 0 12px; }
  .jr-rb-why { display: flex; flex-direction: column; gap: 6px; }
  .jr-rb-phacts { display: none; }
  @media (max-width: 767px) { .jr-rb-phacts { display: flex; flex-wrap: wrap; gap: 8px; } .jr-rb-phacts .btn { flex: 1 1 140px; } }
  @container (max-width: 480px) { .jr-rb-dgrid { grid-template-columns: minmax(0, 1fr); } }
  @media (pointer: coarse), (max-width: 599px) { .jr-rb-in { min-height: 44px; } .v4 a.jr-rb-fl, .jr-rb-crumb a, .jr-rb-src, .jr-rb-cd { display: inline-flex; align-items: center; min-height: 44px; } .v4 a.jr-rb-wl { display: block; min-height: 44px; } .v4 a.jr-rb-num { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; } }
  @media (max-width: 599px) { .jr-rb-acc > details > summary, .jr-rb-col > summary { min-height: 44px; } .jr-rb-acts .btn, .jr-rb-mb { min-height: 44px; height: 44px; } .jr-rb-mb { width: 44px; } .jr-rb-acts .btn { flex: 1 1 120px; } .jr-rb-draft { padding: 12px; }
    .jr-rb-rules { gap: 10px; } .jr-rb-rule, .jr-rb-rules > .jr-rb-rule:first-child { grid-template-columns: minmax(0, 1fr) 44px; gap: 2px 8px; padding: 8px 12px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    .jr-rb-rule > .jr-rb-num { grid-column: 1; grid-row: 1; align-self: center; } .jr-rb-rule > .jr-rb-mb { grid-column: 2; grid-row: 1; } .jr-rb-rule > .jr-rb-rb { grid-column: 1 / -1; grid-row: 2; } }
  /* the rule page */
  .jr-rb-rh > div:first-child { display: flex; flex-direction: column; gap: 8px; }
  .jr-rb-crumb { margin: 0; font-size: 13px; } .jr-rb-crumb a { display: inline-flex; align-items: center; gap: 4px; min-height: 24px; font-weight: 600; }
  .jr-rb-hw { margin: 0; max-width: 62ch; font: 600 17px/1.45 'IBM Plex Sans', sans-serif; color: var(--phosphor); text-wrap: pretty; }
  .jr-rb-vt { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .jr-rb-vt li { position: relative; display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 4px 16px; padding: 0 0 14px; }
  .jr-rb-vt li::before { content: ''; position: absolute; left: 76px; top: 6px; bottom: -6px; width: 1px; background: var(--line-2); }
  .jr-rb-vt li:last-child::before { display: none; }
  .jr-rb-vt li::after { content: ''; position: absolute; left: 72px; top: 5px; width: 9px; height: 9px; border-radius: 50%; box-sizing: border-box; border: 2px solid var(--steel); background: var(--panel); }
  .jr-rb-vd { font-size: 13px; line-height: 1.5; color: var(--text-dim); white-space: nowrap; }
  .jr-rb-ve { display: flex; flex-direction: column; gap: 4px; padding-left: 16px; min-width: 0; }
  .jr-rb-ve p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--phosphor); }
  .jr-rb-ve p.jr-rb-vw { font-size: 13.5px; color: var(--text-dim); }
  .jr-rb-dl { margin: 0; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 16px; font-size: 13.5px; line-height: 1.5; }
  .jr-rb-dl dt { font-weight: 600; color: var(--phosphor); } .jr-rb-dl dd { margin: 0; color: var(--phosphor); min-width: 0; }
  .jr-rb-fh { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
  .jr-rb-pill { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border: 1px solid var(--line-2); border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1; color: var(--phosphor); white-space: nowrap; }
  .jr-rb-src { margin-left: auto; font-size: 13px; font-weight: 600; }
  .jr-rb-claim { margin: 0; font: 400 17px/1.55 'IBM Plex Sans', sans-serif; color: var(--phosphor); text-wrap: pretty; }
  .jr-rb-tr { display: inline-flex; align-items: baseline; gap: 2px; white-space: nowrap; } .jr-rb-tr .ico { width: 12px; height: 12px; color: var(--steel); align-self: center; }
  .jr-rb-cites { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; border-top: 1px solid var(--line); }
  .jr-rb-ci { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .jr-rb-cih { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
  .jr-rb-cd { font-size: 13px; font-weight: 600; min-height: 24px; display: inline-flex; align-items: center; }
  .jr-rb-cut { font-size: 12px; color: var(--steel); }
  .jr-rb-q { margin: 0; font-size: 14px; line-height: 1.55; color: var(--phosphor); }
  .jr-rb-tw { max-width: 100%; overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
  .jr-rb-tw:focus-visible { outline: 2px solid var(--amber-text); outline-offset: 2px; }
  .jr-rb-tbl { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.45; }
  .jr-rb-tbl th { padding: 8px 10px; text-align: left; vertical-align: bottom; font-size: 12px; font-weight: 600; color: var(--steel); background: var(--ink-2); border-bottom: 1px solid var(--line); }
  .jr-rb-tbl td { padding: 10px; text-align: left; vertical-align: top; border-top: 1px solid var(--line); color: var(--phosphor); }
  .jr-rb-tbl .jr-quote { font-size: 13px; }
  .jr-rb-tbl td:first-child, .jr-rb-tbl td:nth-child(2) a, .jr-rb-tbl td:nth-child(3) { white-space: nowrap; }
  .jr-rb-vtag { margin-left: 4px; font-size: 12px; color: var(--steel); } .jr-rb-vtag .mono { color: var(--steel); }
  .jr-rb-tsub { display: block; margin-top: 2px; font-size: 12px; color: var(--steel); white-space: nowrap; }
  .jr-rb-counts { display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
  /* states */
  .jr-rb-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
  .jr-rb-col2 { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .jr-rb-sk { display: flex; flex-direction: column; gap: 12px; }
  .jr-rb-dec { display: flex; flex-wrap: wrap; align-items: center; }
  .jr-rb-cl { display: flex; flex-direction: column; gap: 6px; }
  .jr-rb-rule.is-paused .jr-rb-word { color: var(--text-dim); }
  @media (max-width: 899px) { .jr-rb-pair { grid-template-columns: minmax(0, 1fr); } }
`;

// =========================================================================================================
// The row
// =========================================================================================================
// Sample-derived words for the spec card (never typed by hand)
const N = { drafts: DRAFTS.length, active: ACTIVE.length, retired: RETIRED.length, plans: PLANS.length };
const R1V = RULE.R1.versions[0], R2V1 = RULE.R2.versions[0], R2V = RULE.R2.versions[RULE.R2.versions.length - 1];

const RULINGS = [...JR_RULINGS.filter((r) => ['rule 4', 'rule 5', 'rule 6', 'rule 7', 'rule 13 + D-D', 'rule 16 (verdict-free scope, 2026-10-28)', 'rule 17', 'rule 21', 'rule 23', 'rule 24', 'P-2', 'P-3', 'P-4', 'P-8–P-13', 'D1', 'D2', 'ruling A'].includes(r)), 'rule 20', 'Amendments 2026-10-28 (section tabs; one amber per tab: Plan a trade)'];

export const ROW = {
  key: 'journal-rulebook',
  label: 'Journal · Rulebook',
  section: 'planned',
  css: JR_CSS + RB_CSS,
  specH: 3330,
  spec: {
    title: 'Journal · Rulebook',
    route: '/positions/rulebook · /positions/rulebook/:ruleId',
    job: 'His rules, in his words, each tied to the entries it came from, with how often he answered when asked.',
    env: {
      production: 'The owner’s own rules, signed in: his wording, versions, whys and plan answers, Stored here; asks, readings and computed checks, Computed. Visitors meet the Positions private-testing wall; another account, the not-the-owner sentence.',
      staging: `The Sample journal on the demo account, ${SCENARIO.label}: R1 retired, R2 at v${R2V.v}, R3, the ${reviewDay('oct7')} review’s ${N.drafts} drafts and the ${N.plans} plans’ answers, every value sample data. R2’s ${fmtDate(PLANS[0].at)} answer, which the spec doesn’t print, is the sample’s derived Doesn’t apply. A visitor can adopt or retire a rule; Reset demo data restores the seed.`,
    },
    widgets: [
      { name: 'Header: amber “Plan a trade”, outlined “Write a rule” and “Copy as text”', source: 'Plan a trade opens the composer’s plan mode (?kind=plan); Copy as text copies the active rules as text; no print (open question 16)', production: null, staging: null },
      { name: 'Drafted from your journal (draft cards)', source: 'The weekly review’s drafts (J3, at most 3 a review, slice 4); Because reads the finding and code’s count of its pattern', production: [['computed', 'Computed'], ['off', 'Off']], staging: 'sample' },
      { name: 'Your drafts', source: 'What “Write a rule” saves at the limit (slice 2, G3), origin “written by you”', production: 'local', staging: 'Not drawn: the sample has none' },
      { name: 'Active (rule rows)', source: 'Rule versions (his wording); his plan answers counted by code; the limit read on the latest snapshot', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
      { name: 'Computed checks line (G8)', source: 'services/journal/checks.rs, derived on every read from kept Entered or Added details and the corrected snapshots (slice 3)', production: 'computed', staging: ['sample', 'Sample · none yet'] },
      { name: 'Paused and Retired (collapsed)', source: 'The rule’s lifecycle rows, with dates and, on retirement, his reason', production: 'local', staging: 'sample' },
      { name: `Rail: Before you trade, “${STRINGS.rulesCount}”`, source: 'The count of active rules; the server refuses an eighth (409 rule_limit)', production: 'computed', staging: 'sample' },
      { name: 'Rule page: versions, his why, origin finding and cited entries', source: 'Append-only versions; the finding from its review (slice 4; before it, the finding’s title as text)', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
      { name: 'Rule page: check table and counts', source: 'His plan answers (answered by you) and computed checks (computed), apart and never summed; the account change to the next snapshot', production: 'computed', staging: 'sample' },
    ],
    states: [
      { tag: ['local', 'Stored here'], when: `Loaded: “Drafted from your journal (${N.drafts})”, “Your drafts” only while he has one, “Active (${N.active})”, “Paused” and “Retired (${N.retired})” collapsed with reasons and dates; the rail “Before you trade” and “${STRINGS.rulesCount}”.` },
      { tag: null, when: `Empty: “${EMPTY}” From slice 2 it holds “One rule from today” (G5): his wording (“When …, I …”), the required “Why this rule, in your words” and an outlined “Adopt as R1”.` },
      { tag: null, when: 'Drafts only: the review’s drafts and no active rule; no words of its own.' },
      { tag: null, when: `Stale draft: “${STALE}”` },
      { tag: null, when: `At the limit, 7 active: “${LIMIT_ADOPT}” on Adopt; “${LIMIT_RESUME}” on Resume; “Write a rule” offers “Save as draft”, which lands under “Your drafts” (G3).` },
      { tag: null, when: 'Loading: skeletons at their final height; no tag in the product.' },
      { tag: ['error', JR_ERROR_WORD], when: `Couldn’t load: “${CANT_LOAD}” and “Try again”, as on the timeline.` },
      { tag: 'locked', when: 'Signed out (production): the Positions private-testing wall, “Sign in to open your journal”, “See it on the demo →”.' },
      { tag: null, when: 'Not the owner: “This journal is private to the account that owns this Convexa.” and “See it on the demo →”; no tag (open question 12).' },
      { tag: 'sample', when: 'Staging: the demo bar once; each frame dashed with the 8px hatch band and one “Sample journal” chip; cards and rows untagged.' },
      { tag: null, when: 'Rule page: Active · Paused (Resume, refused at 7 active) · Retired (its reason and date) · Declined draft (read-only, with his reason) · Building counts (dots below 20, “rates start at 20”) · Staging.' },
    ],
    phone: 'Accordion sections (Drafted from your journal, Active, Retired) and one card per rule. The row menu (Edit · Pause · Retire) is a bottom sheet with a grab handle and actions stacked at 44px. The sticky, safe-area-padded bottom bar carries the amber “Plan a trade” and the outlined 44px “Margin call” with the warning glyph; “Write a rule” and “Copy as text” sit under the header, outlined, so the page keeps one amber. The rule page stacks and its check table becomes cards, its table twin staying the accessible path.',
    acceptance: [
      'Criterion 31: /positions/rulebook has exactly one amber fill, “Plan a trade”, in the header at 1440 and in the bottom bar at 390; “Write a rule” and “Copy as text” are outlined.',
      'Criterion 32: with 7 active, Adopt shows “7 active rules is the limit. Pause or retire one to adopt this.” and no rule gains a number; Resume shows the resume line; “Write a rule” offers “Save as draft”, which lands under “Your drafts”; drafts and paused rules never count; an eighth activation gets 409 rule_limit.',
      'Criterion 34: from slice 2, the empty Rulebook holds “One rule from today”; it adopts R1 only with its why, and adopts nothing without it.',
      'Criterion 37: the rule’s check table labels computed checks “computed”, apart from “answered by you”, never summed; in the sample R2 and R3 read “Computed at kept entries: none yet”.',
      'Criterion 9: no success or error fill on any element; “within” is plain text and “above” carries the warning glyph; counts are neutral dots, with no streak, badge or score.',
      'The rulebook → How adherence is shown: “Account change after Yes vs after No” reads “too few to judge (… counted; rates start at 20)” until both sides reach 20.',
      'Criterion 18: on staging, /positions/rulebook answers from the demo transport; “Demo · sample data” appears once, in the bar; each frame has data-provenance="sample" and exactly one Sample mark.',
      'Criterion 21: at 390 and 393, in both schemes, scrollWidth equals clientWidth, and with a coarse pointer no interactive element is under 44px.',
      'Criterion 19: no rule or limit reaches a Settings risk input; the Rulebook has no hand-off control. Open question 16: no print control.',
    ],
    built: [
      { status: 'todo', waits: 'build', slice: '2', what: 'Slice 2: the Rulebook tab and route, hand-written rules (“Write a rule”), numbering at activation, versions on Edit, Pause, Resume, and Retire with a reason; migration journal_rules.' },
      { status: 'todo', waits: 'build', slice: '2', what: 'Slice 2: at most 7 active, the server’s 409 rule_limit, the adopt and resume lines, and “Save as draft” into “Your drafts” (G3).' },
      { status: 'todo', waits: 'build', slice: '2', what: 'Slice 2: “Plan a trade” as the tab’s one amber, in the header and the phone bar (G2); “Copy as text”; the empty state’s “One rule from today” with its required why (G5).' },
      { status: 'todo', waits: 'build', slice: '2', what: 'Slice 2: asks as neutral dots with the floor of 20, the limit readings, and the rule page: version timeline, his why, the check table’s “answered by you” rows and the counts block.' },
      { status: 'todo', waits: 'build', slice: '2', what: `Slice 2: the demo seed’s R1 (retired), R2 (${RULE.R2.versions.length} versions), R3 and the ${N.plans} plans’ answers; R2’s origin shows the finding’s title as text until slice 4.` },
      { status: 'todo', waits: 'build', slice: '3', what: 'Slice 3: computed checks (G8), derived on read from kept Entered or Added details, on each rule and in its check table, counted apart from his answers.' },
      { status: 'todo', waits: 'build', slice: '4', what: 'Slice 4: “Drafted from your journal”: the review’s drafts with Because, Adopt and Not for me, the stale-draft strip, and R2’s origin finding with its cited entries.' },
    ],
    rulings: RULINGS,
    code: [
      'apps/dashboard/src/app/pages/positions/rulebook/* (new, slice 2)',
      'apps/dashboard/src/app/shared/ui/SectionTabs.tsx (from pages/research/ResearchTabs.tsx, slice 1a)',
      'apps/api/src/routes/journal.rs · apps/api/src/services/journal/rules.rs (new, slice 2)',
      'apps/api/src/services/journal/checks.rs (new, slice 3)',
      'apps/api/src/services/journal/{package,ai,check}.rs (new, slice 4: the drafts)',
      'apps/api/src/db/migrations.rs (journal_rules)',
      'libs/api/src/lib/demo/journal.ts (slice 2’s seed)',
      'design/src/screens/final/journal-rulebook.mjs · journal-kit.mjs · design/src/data/journal-sample.mjs (step 0)',
    ],
  },
  boards: [
    B('staging', 'Staging · rulebook', 1440, 2218, (o) => rulebookPage(o)),
    B('rule', 'Staging · rule R2', 1440, 1992, (o) => rulePage(o)),
    B('phone', 'Phone · staging', 390, 3930, (o) => rulebookPhone(o)),
    B('light', 'Light · staging', 1440, 2218, (o) => rulebookPage(o), LIGHT),
    B('states', 'States', 1440, 5092, states),
  ],
};
