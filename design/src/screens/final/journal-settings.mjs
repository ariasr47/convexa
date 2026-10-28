// Final · Planned · Journal · Settings panel (spec 08, BOARD BRIEF row `journal-settings`; row lane B, step 0, 2026-10-28).
//
// Settings › Journal at /settings#journal, from docs/product/specs/2026-10-26/08-trade-journal.md: Screen 13, the Copy
// table's Settings › Journal row, Data and privacy → Egress and Export and delete, and The AI interaction → Off by
// default and Models, cost and caching. Drawn on the journal kit (./journal-kit.mjs) and the Sample journal
// (design/src/data/journal-sample.mjs); every figure is the sample's (AI, SUSPICIONS). Classes are prefixed `jr-st-`.
//
// The panel sits after AI providers (SettingsPage.tsx:644), in the page's one 760px column: the app ships no section
// rail (owner ruling D-B parks it), so these boards draw none. Each part lands with its slice (1b export, restore and
// delete; 3 suspicions; 4 AI consent, models, the Monday offer and caps; 5 read on save). The Monday auto-run is
// deferred to a later spec (open question 16): no control or copy for it here.
import { finalPage } from '../../lib.mjs';
import { H, P } from './account-pages.mjs';
import { B, JR_CSS, JR_NOTES, JR_RULINGS, icon, jrBtn, jrNote, jrSampleChip, jrSeg, jrStrip, jrTag, statesBoard, sw } from './journal-kit.mjs';
import { AI, SUSPICIONS } from '../../data/journal-sample.mjs';

// ---- words (Copy table, Screen 13, Data and privacy) -----------------------------------------------------------------
const W = {
  egress: 'Turning this on lets Convexa send your journal text, numbers and rules to Anthropic on your key when you run a review, tap Read on an entry or accept a bulk read of older entries, and, if you turn it on below, on each save. Nothing is sent until one of those happens.',
  readOnSave: `With this on, each save sends that entry’s text, its numbers, the summaries of your 5 previous entries and your active rules to Anthropic (${AI.models.entry}) on your key. Margin-call entries are never sent on save.`,
  noKey: 'Add an Anthropic key in Settings › AI first',
  otherProviders: 'journal reads run on an Anthropic key for now',
  exportNote: 'This file isn’t encrypted. Keep it somewhere private.',
  suspicionsNote: 'Reviews test these first.',
  deleteType: 'Type “delete journal” to confirm.',
  deleteReach: 'What was already sent to your AI provider is under its terms.',
  // Settings writes on the demo are refused with the demo transport's existing copy, as AI keys are
  // (libs/api/src/lib/demo/transport.ts:1319-1330).
  refused: 'Credentials, sign-in, AI-provider, and OAuth actions are disabled in this local sample.',
  // Settings’ Cap reached has no words of its own in the spec; this is the Review copy’s cap line, the one the page
  // shows when the cap stops a run.
  capLine: `This month’s journal AI cap of ${AI.caps.month} is reached. Change it in Settings.`,
  // The bulk read offer (Copy → Bulk read offer; Data and privacy → Egress, trigger 5; Other flows → Turning on AI
  // reads), slice 5: its own egress sentence above its button.
  bulk: `Sends the full text of ${AI.bulk.entries} entries, once each, with their numbers and your active rules, to Anthropic (${AI.models.entry}, batch price) on your key. Entries you kept out are left out.`,
  signedOut: 'Sign in to open your journal',
  disclaimer: 'Convexa is an analysis tool. Positions are simulated (paper); a connected brokerage is read-only. Not investment advice.',
};

// ---- helpers ------------------------------------------------------------------------------------------------------------
/** Money and counts inside a printed line, in Mono (the type register): "$0.31", "1", "8". */
const figs = (s) => s.replace(/(\$[\d,]+(?:\.\d+)?|\b\d+\b)/g, '<span class="mono">$1</span>');
const sec = (html, cls = '') => `<div class="jr-st-sec${cls ? ' ' + cls : ''}">${html}</div>`;
/** A switch row: the whole row is the label, 44px tall, so the target clears the touch floor. */
const switchRow = (label, on, { tag = '', control = null } = {}) => `<label class="jr-st-row"><span class="l">${label}${tag}</span>${control ?? sw(on, label)}</label>`;
const input = (value, { label = '', mono = false, focus = false } = {}) => `<span class="jr-st-in${mono ? ' mono' : ''}${focus ? ' focus' : ''}" role="textbox" aria-label="${label}">${value}</span>`;
const fieldBox = (label, value, o = {}) => `<label class="jr-st-f"><span class="jr-st-lab">${label}</span>${input(value, { label, ...o })}</label>`;
const spin = '<span class="jr-st-spin" aria-hidden="true"></span>';

// ---- the panel's parts ---------------------------------------------------------------------------------------------------
/** The AI consent: the egress sentence above the switch (never in a tooltip), the switch, What's sent. With no Anthropic
 *  key the switch gives way to the way to add one, and the other providers say why they don't count. The state's word
 *  (Off, Not set up) is the panel's tag, in its head. */
function consent({ state = 'on', refused = false } = {}) {
  const nokey = state === 'nokey';
  const sw0 = nokey
    ? `<div class="jr-st-row"><span class="l">AI reads of my journal</span></div><a href="/settings#ai-providers" class="jr-st-a">${W.noKey}</a><div class="jr-st-prov"><span>OpenAI · Gemini · Grok</span>${jrTag('notSetUp')}<span>· ${W.otherProviders}</span></div>`
    : switchRow('AI reads of my journal', state === 'on');
  return sec(`<p class="jr-st-eg">${W.egress}</p>${sw0}${refused ? jrStrip('info', W.refused) : ''}${nokey ? '' : `<div>${jrBtn('View what’s sent', { kind: 'text' })}</div>`}`);
}
const models = () => sec(`<span class="jr-st-h">Models for journal reads</span><div class="jr-st-two"><div class="jr-st-grp"><span class="jr-st-lab">Entry reads</span>${jrSeg([AI.models.entry, AI.models.review], AI.models.entry, { size: 32, label: 'Entry reads' })}</div><div class="jr-st-grp"><span class="jr-st-lab">Reviews</span>${jrSeg([AI.models.review, AI.models.entry], AI.models.review, { size: 32, label: 'Reviews' })}</div></div>`);
const monday = () => sec(switchRow('Offer the weekly review each Monday', true));
const readOnSave = () => sec(`${switchRow('Read each entry right after I save it', false)}<p class="jr-st-eg sm">${W.readOnSave}</p>`);
/** The caps, his figures, and "This month" summed from the runs (computed). `capped`: the cap line in its place. */
const caps = ({ capped = false } = {}) => sec(`<div class="jr-st-two">${fieldBox('Monthly cost cap for the journal', AI.caps.month, { mono: true })}${fieldBox('Limit per run', AI.caps.run, { mono: true })}</div>${capped ? jrStrip('info', `<span>${figs(W.capLine)}</span>`) : `<p class="jr-st-month"><span>${figs(AI.month)}</span>${jrTag('computed')}</p>`}`);
/** The bulk read of older entries (slice 5): the egress sentence above "Read them now", with the count and the
 *  estimate in Mono, from the sample's own line ("34 entries haven’t been read. Read them now · ≈ $0.18"). */
const BULK = AI.bulk.text.split(' Read them now · ');
if (BULK.length !== 2) throw new Error('journal-settings: the bulk read line drifted from “… Read them now · ≈ …”');
const bulkRead = () => sec(`<p class="jr-st-eg sm">${W.bulk}</p><div class="jr-st-bulk"><span>${figs(BULK[0])}</span>${jrBtn('Read them now')}<span class="jr-st-est">${figs(BULK[1])}</span></div>`);
/** "Downfalls you suspect": up to 5 lines in his words; the sample's three, then two empty lines. */
const suspicions = () => sec(`<span class="jr-st-h">Downfalls you suspect</span><p class="jr-st-help">${W.suspicionsNote}</p><div class="jr-st-lines">${Array.from({ length: 5 }, (_, i) => input(SUSPICIONS[i]?.text ?? '', { label: `Downfall ${i + 1}` })).join('')}</div><div>${jrBtn('Save')}</div>`);
/** Export (a download, with its plaintext warning) beside Restore (merge-only). `busy`: 'export' | 'restore'. */
const exportRestore = ({ busy = '' } = {}) => sec(`<div class="jr-st-acts"><div class="jr-st-grp">${jrBtn(`${busy === 'export' ? spin : icon('down', 16)}Export journal (JSON)`, { attrs: busy === 'export' ? 'aria-busy="true"' : '' })}<p class="jr-st-help">${W.exportNote}</p></div><div class="jr-st-grp">${jrBtn(`${busy === 'restore' ? spin : icon('up', 16)}Restore from an export`, { attrs: busy === 'restore' ? 'aria-busy="true"' : '' })}</div></div>`);
/** The burnt-orange "Delete journal…", with its word and the warning glyph; `confirm` opens the inline confirm. */
const deleteJournal = ({ confirm = false } = {}) => sec(confirm
  ? `<div class="jr-st-confirm" role="group" aria-label="Delete journal"><p class="jr-st-ch">${icon('warn', 16)}<span>${W.deleteType}</span></p>${input('delete journal', { label: 'Type delete journal to confirm', focus: true })}<p class="jr-st-help">${W.deleteReach}</p><div class="jr-st-acts0">${jrBtn('Export first', { ic: 'down' })}${jrBtn('Delete journal', { kind: 'danger', warn: true })}</div></div>`
  : `<div>${jrBtn('Delete journal…', { kind: 'danger', warn: true })}</div>`);

/** The Journal panel (a Settings PanelCard). Staging: dashed with the hatch band and its one "Sample journal" chip, and a
 *  refused write under the switch; production: solid, no tag while reads are on. */
function journalPanel(env, { state = 'on', refused = false, bulk = false } = {}) {
  const sample = env === 'staging';
  const inner = [consent({ state, refused }), models(), monday(), readOnSave(), caps(), bulk ? bulkRead() : '', suspicions(), exportRestore(), deleteJournal()].join('');
  return P('Journal', sample ? jrSampleChip() : '', inner, 'Journal', `jr-st${sample ? ' is-sample' : ''}`);
}

/** The Settings page at #journal: the header, the one 760px column, the panel and the page's standing line. */
function settingsPage({ scheme = 'dark', minHeight = 0, env = 'staging', panel = '', note = '' } = {}) {
  const demo = env === 'staging';
  const main = `<div class="wrap ap">${H('Settings', demo ? 'Saved in this browser’s demo workspace.' : 'Saved to your account.')}<div class="jr-st-col">${panel}<p class="dline" style="margin: 0; font-size: 12px;">${W.disclaimer}</p></div></div>`;
  return (note ? jrNote(scheme, note) : '') + finalPage({ scheme, minHeight, active: '', demo, signedIn: !demo, label: 'Settings', main });
}

// =========================================================================================================
// Boards
// =========================================================================================================
const AT_JOURNAL = 'Settings at /settings#journal, scrolled to the panel: it follows AI providers (SettingsPage.tsx:644) in the page’s one 760px column. The panels above it are drawn on the Settings row.';
const staging = (o) => settingsPage({ ...o, env: 'staging', note: AT_JOURNAL, panel: journalPanel('staging', { state: 'on', refused: true }) });
/** The production phone panel, reads just turned on: the bulk read of older entries is offered under the caps. */
const phone = (o) => settingsPage({ ...o, env: 'production', note: JR_NOTES.illustrative, panel: journalPanel('production', { state: 'on', bulk: true }) });

function states({ scheme = 'dark', minHeight = 0 } = {}) {
  const frame = (tag, html) => P('Journal', tag, html, 'Journal', 'jr-st');
  const items = [
    { name: 'Off', tag: ['off'], when: 'The default. The sentence above the switch says what turning it on sends, and when; nothing is sent while it is off.', html: frame(jrTag('off'), consent({ state: 'off' })) },
    { name: 'On', tag: null, when: `Reads on, on his own Anthropic key: models (${AI.models.entry} for entry reads, ${AI.models.review} for reviews), the Monday offer, and the caps with this month’s spend.`, html: frame('', [consent({ state: 'on' }), models(), monday(), caps()].join('')) },
    { name: 'No key', tag: ['notConfigured'], when: 'No Anthropic key saved: the switch gives way to the way to add one, and no request is made. A key for another provider doesn’t count (open question 5).', html: frame(jrTag('notSetUp'), consent({ state: 'nokey' })) },
    { name: 'Cap reached', tag: null, when: 'The month’s cap would be passed by a run’s worst case, so no request is sent. The spec gives Settings no words for this; the line is the one Review shows.', html: frame('', caps({ capped: true })) },
    { name: 'Exporting', tag: null, when: 'The in-flight indicator in the button while the convexa-journal-v1 file is built. The file is plaintext, and the page says so.', html: frame('', exportRestore({ busy: 'export' })) },
    { name: 'Restoring', tag: null, when: 'Merge-only, matching by id and content hash; it never overwrites. An entry whose seal doesn’t verify comes back as Imported, written now.', html: frame('', exportRestore({ busy: 'restore' })) },
    { name: 'Delete confirm', tag: null, when: 'Inline, no modal: typing “delete journal” arms the button, and “Export first” is offered. The backup sentence is written at build step 1a from the project’s backup setting, so it isn’t drawn.', html: frame('', deleteJournal({ confirm: true })) },
    { name: 'Signed out', tag: ['locked'], when: 'Production, signed out: the panel holds one line, in the Positions wall’s words.', html: frame(jrTag('signIn'), `<p class="jr-st-eg">${W.signedOut}</p>`) },
  ];
  return statesBoard({ scheme, minHeight, title: 'Journal · Settings panel · states', lead: 'Eight states of Settings › Journal. Figures are the Sample journal’s; a production panel holds only the owner’s own.', trace: 'Screen 13 · criteria 14, 15, 16, 23, 28', items });
}

// =========================================================================================================
// The row
// =========================================================================================================
const ST_CSS = `
  .jr-st-col { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 760px; min-width: 0; }
  .hd-p.jr-st { gap: 0; }
  .hd-p.jr-st > .ph { padding-bottom: 4px; }
  .jr-st-sec { display: flex; flex-direction: column; gap: 10px; padding: 16px 0; border-top: 1px solid var(--line); min-width: 0; }
  .hd-p.jr-st > .ph + .jr-st-sec { border-top: 0; padding-top: 8px; }
  .jr-st-sec:last-child { padding-bottom: 0; }
  .jr-st-eg { margin: 0; max-width: 72ch; font-size: 14px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  .jr-st-eg.sm { font-size: 13px; }
  .jr-st-h { font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--phosphor); }
  .jr-st-lab { font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--phosphor); }
  .jr-st-help { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .jr-st-row { display: flex; align-items: center; justify-content: space-between; gap: 12px 16px; min-height: 44px; cursor: pointer; }
  .jr-st-row .l { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--phosphor); }
  .jr-st-a { align-self: flex-start; display: inline-flex; align-items: center; min-height: 24px; font-size: 14px; font-weight: 600; }
  .jr-st-prov { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; font-size: 13px; line-height: 1.45; color: var(--text-dim); }
  .jr-st-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
  .jr-st-grp { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 0; }
  .jr-st-f { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .jr-st-in { display: flex; align-items: center; min-height: 40px; padding: 0 12px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--ink-2); font: 400 14px/1.4 'IBM Plex Sans', sans-serif; color: var(--phosphor); overflow-wrap: anywhere; }
  .jr-st-in.mono { font: 500 15px/1.3 'IBM Plex Mono', monospace; }
  .jr-st-in.focus { border-color: var(--amber-text); box-shadow: 0 0 0 3px var(--amber-tint); }
  .jr-st-lines { display: flex; flex-direction: column; gap: 8px; }
  .jr-st-month { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0; font-size: 13px; line-height: 1.5; color: var(--phosphor); }
  .jr-st-bulk { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 14px; line-height: 1.45; color: var(--phosphor); }
  .jr-st-est { font-size: 13px; color: var(--text-dim); } .jr-st-est .mono { color: var(--phosphor); }
  .jr-st-acts { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px 24px; }
  .jr-st-acts0 { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .jr-st-spin { flex: none; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--amber-text); }
  .jr-st-confirm { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--ink-2); }
  .jr-st-ch { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.45; color: var(--phosphor); }
  .jr-st-ch .ico { flex: none; margin-top: 2px; color: var(--warn); }
  @media (max-width: 599px) {
    .jr-st-two { grid-template-columns: minmax(0, 1fr); }
    .jr-st-in, .hd-p.jr-st .btn, .jr-st-a { min-height: 44px; }
    .jr-st-acts .jr-st-grp, .jr-st-acts .btn, .jr-st-acts0 .btn { width: 100%; }
    .hd-p.jr-st { padding: 16px; }
  }
`;

export const ROW = {
  key: 'journal-settings',
  label: 'Journal · Settings panel',
  section: 'planned',
  css: JR_CSS + ST_CSS,
  specH: 3063,
  spec: {
    title: 'Journal · Settings panel',
    route: '/settings#journal',
    job: 'One Settings panel for the journal, beside AI providers: export, restore and delete; the downfalls he suspects; and AI consent, models and caps, each control with its own egress line in the same view. Each part lands with its slice, and a part whose slice hasn’t shipped isn’t drawn.',
    env: {
      production: 'The owner, signed in: his journal’s export (convexa-journal-v1, plaintext), merge-only restore and Delete journal; his suspicions; and from slice 4 “AI reads of my journal”, Off by default, on his own Anthropic key, with the models and caps. Signed out, the panel says Sign in.',
      staging: `The demo account: the Sample journal’s settings (reads on, ${AI.models.entry} and ${AI.models.review}, caps ${AI.caps.month} and ${AI.caps.run}, “${AI.month}”, three suspicions). Writes are refused with the demo transport’s existing copy, as AI keys are.`,
    },
    widgets: [
      { name: 'AI reads of my journal, with its egress sentence', source: 'journal_settings.ai_reads · GET/PUT /api/journal/settings (4); its own resolver reads the Anthropic slot only', production: 'off', staging: 'sample' },
      { name: 'Models for journal reads', source: `journal_settings.model_entry · model_review; ${AI.models.entry} for entry reads, ${AI.models.review} for reviews (open question 6)`, production: 'local', staging: 'sample' },
      { name: 'Offer the weekly review each Monday', source: 'journal_settings.offer_monday (4)', production: 'local', staging: 'sample' },
      { name: 'Read each entry right after I save it, with its egress line', source: 'journal_settings.read_on_save (5); never on a margin-call entry', production: 'off', staging: 'sample' },
      { name: 'Caps and This month', source: 'journal_settings.monthly_cap_cents · run_cap_cents; This month summed from journal_ai_runs.cost_micros, which outlive Delete journal', production: [['local', 'Stored here'], ['computed', 'Computed']], staging: 'sample' },
      { name: 'Downfalls you suspect', source: 'journal_suspicions · GET/PUT /api/journal/suspicions (filled from the first run since 1a; edited here from 3)', production: 'local', staging: 'sample' },
      { name: 'Export, restore, Delete journal', source: 'GET /api/journal/export · POST /api/journal/restore · DELETE /api/journal (1b)', production: 'local', staging: 'sample' },
    ],
    states: [
      { tag: 'off', when: `Off, the default: “${W.egress}” sits above the switch, never in a tooltip.` },
      { tag: null, when: `On: models, “Offer the weekly review each Monday”, “Monthly cost cap for the journal” ${AI.caps.month} and “Limit per run” ${AI.caps.run}, and “${AI.month}”.` },
      { tag: 'notConfigured', when: `No key: the switch is replaced by “${W.noKey}”; other providers read “Not set up · ${W.otherProviders}”.` },
      { tag: null, when: `Cap reached: no request is sent; “${W.capLine}”` },
      { tag: null, when: `Exporting: the in-flight indicator; “${W.exportNote}”` },
      { tag: null, when: 'Restoring: merge-only; a second restore adds nothing (“N rows were already in your journal”).' },
      { tag: null, when: `Delete confirm: “${W.deleteType}”, “Export first”, and what deletion reaches, “${W.deleteReach}”` },
      { tag: null, when: `Read on save, under its switch: “${W.readOnSave}”` },
      { tag: null, when: `Bulk read (slice 5), once reads are on: “${W.bulk}” sits above “${AI.bulk.text}”; nothing is read until he taps it.` },
      { tag: 'locked', when: `Signed out (production): “${W.signedOut}”.` },
      { tag: 'sample', when: `Staging: the panel’s one “Sample journal” chip; a refused write reads “${W.refused}”` },
    ],
    phone: 'The panel stacks in the page column: the egress sentence, then each switch as a full-width 44px row with its own line under it; the model segments and the two caps one per row; the suspicion lines full width; Export, Restore and Delete journal… full-width buttons, stacked. No horizontal overflow at 390 or 393.',
    acceptance: [
      'Criterion 14 (4, 5): every control that can reach the provider renders its egress line in the same view, never in a tooltip: the sentence above “AI reads of my journal”, the line under “Read each entry right after I save it”, and the bulk sentence above “Read them now”.',
      'Criterion 15 (4): Off by default; a fresh account with an Anthropic key saved makes 0 provider requests until the switch is on and a run is asked for.',
      'Criterion 16 (4): a run whose worst case passes what is left of the monthly cap isn’t started, and the cap line shows; after Delete journal the month’s spend is unchanged.',
      'Criterion 28 (4): with no Anthropic key the panel offers “Add an Anthropic key in Settings › AI first” and runs make 0 requests; the journal reads its own models, never the ticker read’s provider.',
      'Criterion 23 (1b): export then restore into an empty journal gives the same entries, written dates, figures, notes and rule versions; a second restore adds nothing; an entry edited by hand restores as Imported, written now.',
      'Criterion 34 (1a, 3): “Downfalls you suspect” edits the list the first run’s “What do you think your downfalls are?” fills (GET /api/journal/suspicions returns it), up to 5 lines.',
      'Criterion 5 (5): with “Read each entry right after I save it” on, a margin-call entry makes 0 provider requests on save.',
      'Delete journal needs “delete journal” typed, offers Export first, and keeps journal_ai_runs’ cost and token columns, so the month’s cap isn’t reset.',
      'Criterion 18: on staging the panel is dashed with one “Sample journal” chip, and every write is refused with the demo’s existing copy.',
      'Criterion 21: at 390 and 393, in both schemes, no horizontal overflow, and every switch row, field and button is at least 44px with a coarse pointer.',
    ],
    built: [
      { status: 'todo', waits: 'build', slice: '1b', what: `Slice 1b: the panel lands with “Export journal (JSON)” (convexa-journal-v1; “${W.exportNote}”), “Restore from an export” (merge-only; an entry whose seal doesn’t verify comes back as Imported) and the burnt-orange “Delete journal…” with its typed confirm.` },
      { status: 'todo', waits: 'build', slice: '3', what: `Slice 3: “Downfalls you suspect”, up to 5 lines, with “${W.suspicionsNote}”; the Review rail’s Edit opens it.` },
      { status: 'todo', waits: 'build', slice: '4', what: 'Slice 4: “AI reads of my journal”, Off by default, with its egress sentence above it, and “Add an Anthropic key in Settings › AI first” with no key; the models for entry reads and reviews; “Offer the weekly review each Monday”; the monthly and per-run caps with “This month”; What’s sent from here.' },
      { status: 'todo', waits: 'build', slice: '5', what: `Slice 5: “Read each entry right after I save it”, off, with its egress line in full; margin-call entries are never read on save. The bulk read of older entries, offered once reads are on, with its egress sentence above “Read them now · ${BULK[1]}”; it never runs without his tap.` },
    ],
    rulings: JR_RULINGS.filter((r) => !/^rule (10|19|22)\b|^P-6|^P-8|^NO-13/.test(r)),
    code: [
      'apps/dashboard/src/app/features/auth/SettingsPage.tsx (the Journal panel: 1b export, restore, delete; 3 suspicions; 4 consent, models, caps; 5 read on save)',
      'apps/api/src/routes/journal.rs · services/journal/store.rs (export and restore, 1b)',
      'apps/api/src/services/llm.rs · services/journal/{package,ai,check,scan}.rs (new, 4)',
      'libs/api/src/lib/demo/transport.ts (the demo’s refused settings writes)',
      'design/src/screens/final/journal-settings.mjs (step 0)',
    ],
  },
  boards: [
    B('staging', 'Staging · demo account', 1440, 1876, (o) => staging(o)),
    B('phone', 'Phone · production', 390, 2496, (o) => phone(o)),
    B('states', 'States', 1440, 2098, (o) => states(o)),
  ],
};
