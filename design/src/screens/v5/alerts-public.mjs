// Alerts on public data — Q-5, ruled "design it now" by the owner (2026-10-13). The Alerts page, the
// create-alert flow and every state, at desktop and phone. Six kinds work on the semi-live site; each
// names its source and delay and wears a word from the closed state vocabulary (P-2, approved). SEC kinds
// are live (SEC_USER_AGENT is set on production, 2026-10-15) and say "Not set up" only if it is unset;
// FINRA short interest is Off on production until FINRA's terms are confirmed (owner, 2026-10-15);
// structure kinds stay "Not live" (P-1, approved).
// No buy/sell language: an alert reports what a public source published, never what to do about it.
import { icon, v4Page } from '../../lib.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { dlg, fld, seg, statesBoard, sw } from '../v4/kit.mjs';
import { ALERT_KINDS, FIRED, KIND, RULES, STRUCTURE_KINDS } from '../../data/alerts.mjs';
import { rangeBar, fmt } from '../../chart-kit.mjs';
import { CFTC, rangeStats } from '../../data/charts.mjs';

export const ALERTS5_CSS = `
  .al5 { padding-top: 28px; display: flex; flex-direction: column; gap: 20px; }
  .al5-h { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: flex-end; }
  .al5-h > div { flex: 999 1 480px; }
  .al5-h h1 { margin: 0; font-size: clamp(30px, 3vw, 40px); letter-spacing: -0.02em; }
  .al5-h p { margin: 6px 0 0; max-width: 72ch; color: var(--steel); font-size: 14.5px; line-height: 1.55; text-wrap: pretty; }
  .al5-leg { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel); }
  .al5-leg .cnt { font: 500 12px 'IBM Plex Mono', monospace; color: var(--phosphor); margin-left: -6px; }
  .al5-g { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 16px; align-items: start; }
  .al5-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .rule { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 8px 16px; align-items: start; padding: 14px 0; border-top: 1px solid var(--line); }
  .rule .k { padding-top: 1px; }
  .rule:first-child { border-top: 0; }
  .rule .k { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--phosphor); }
  .rule .k .ico { color: var(--steel); }
  .rule .s { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .rule .s b { font: 600 13.5px 'IBM Plex Mono', monospace; }
  .rule .s span { font-size: 12.5px; color: var(--steel); line-height: 1.45; }
  .rule .m { grid-column: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .rule .m .btn { margin-left: auto; }
  .rule .m .last { font: 400 11px 'IBM Plex Mono', monospace; color: var(--steel); }
  .rule.off .s b, .rule.off .k { color: var(--steel); }
  .fire { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-top: 1px solid var(--line); }
  .fire:first-child { border-top: 0; padding-top: 0; }
  .fire .t { display: flex; gap: 10px; align-items: baseline; }
  .fire .t .d { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); min-width: 44px; }
  .fire .t b { font-size: 13.5px; }
  .fire .r { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding-left: 54px; }
  .kref { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .kref th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 8px 8px; border-bottom: 1px solid var(--line-2); }
  .kref td { padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--steel); line-height: 1.45; }
  .kref td:first-child { color: var(--phosphor); font-weight: 600; white-space: nowrap; }
  .ktiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .ktile { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-height: 44px; padding: 12px; border-radius: 10px; border: 1px solid var(--line-2); background: transparent; color: var(--phosphor); font: 600 13.5px 'IBM Plex Sans', sans-serif; text-align: left; }
  .ktile[aria-pressed="true"] { border-color: var(--phosphor); box-shadow: inset 0 0 0 1px var(--phosphor); }
  .ktile .kh { display: flex; align-items: center; gap: 8px; width: 100%; }
  .ktile .kh .ico { color: var(--steel); }
  .ktile .kd { font-size: 12px; font-weight: 400; color: var(--steel); line-height: 1.45; }
  .ktile .kt { display: flex; flex-wrap: wrap; gap: 6px; }
  .ktile:disabled { border-style: dashed; color: var(--steel); }
  .opsnote summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text-info); min-height: 24px; display: inline-flex; align-items: center; }
  .flow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: start; }
  .flow .v4dlg { width: 100%; }
  .flow-cap { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .flow-cap > b { font-family: 'Archivo', sans-serif; font-stretch: 112.5%; font-weight: 700; font-size: 17px; }
  .sumline { margin: 0; font-size: 14px; line-height: 1.55; color: var(--phosphor); text-wrap: pretty; }
  @media (max-width: 1099px) { .flow { grid-template-columns: 1fr; } }
  @media (max-width: 899px) { .al5-g { grid-template-columns: 1fr; } .rule { grid-template-columns: minmax(0, 1fr); } .rule .m { grid-column: 1; } .kref thead { display: none; } .kref tr { display: grid; grid-template-columns: 1fr; padding: 8px 0; border-bottom: 1px solid var(--line); } .kref td { border: 0; padding: 2px 0; } }
  @media (max-width: 599px) { .ktiles { grid-template-columns: 1fr; } .ktile { min-height: 64px; } .rule .m .btn, .fire .r a { min-height: 44px; display: inline-flex; align-items: center; } }
`;

const H = (title, lead, right = '') => `<div class="al5-h"><div><h1 class="display">${title}</h1><p>${lead}</p></div>${right}</div>`;
const P = (title, tag, inner, label = '') => `<section class="hd-p" aria-label="${label || title}"><div class="ph"><h3>${title}</h3>${tag}</div>${inner}</section>`;
const LEAD = 'Alerts on public data: filings, insider clusters, results dates, futures positioning, short interest and your own notes. Each says where it reads from and how late that source is. Structure alerts need the options feed, which isn’t live on this site.';

function legend(rules = RULES) {
  const order = [['current', 'Updated'], ['delayed', 'Delayed by source'], ['computed', 'Computed'], ['notConfigured', 'Not set up'], ['off', 'Off']];
  const n = (k) => rules.filter((r) => r.state === k).length;
  return `<div class="al5-leg" role="group" aria-label="On this page"><span class="caps">On this page</span>${order.filter(([k]) => n(k)).map(([k, w]) => `${stateTag(k, w)}<span class="cnt">${n(k)}</span>`).join('')}${stateTag('notLive', 'Structure alerts')}<span class="cnt">0</span></div>`;
}
const secStrip = () => `<div class="dwarn" style="background: transparent; border-color: var(--line-2);" role="status">${icon('sliders', 14, 'style="color: var(--steel); margin-top: 2px;"')}<div style="display: flex; flex-direction: column; gap: 4px;"><strong style="font-size: 13px;">Filing and insider alerts are saved but not checking yet.</strong><span class="dline">They read SEC EDGAR, which isn’t set up on this site. They start on their own once it is; nothing is lost.</span><details class="opsnote"><summary>For the operator</summary><span class="dline">Set <span class="mono">SEC_USER_AGENT</span> on the API (a contact string the SEC requires). Status: switch, in docs/public-data/CANDIDATES.md.</span></details></div></div>`;

function ruleRow(r) {
  const k = KIND[r.kind];
  return `<div class="rule${r.on ? '' : ' off'}"><span class="k">${icon(k.glyph, 16)}${k.name}</span><span class="s"><b>${r.subject}</b><span>${r.what}</span></span><span class="m">${stateTag(r.state, r.stateText)}<span class="last">${r.last}</span>${sw(r.on, `${k.name} for ${r.subject}: ${r.on ? 'on' : 'off'}`)}<button class="btn ghost sm" type="button" aria-label="Edit ${k.name} for ${r.subject}">Edit</button></span></div>`;
}
function fireRow(f) {
  return `<div class="fire"><div class="t"><span class="d">${f.date}</span><b>${f.title}</b></div><div class="r"><span class="dline" style="flex: 1 1 260px;">${f.detail}</span>${provChip(f.chip, 'solid')}<a href="${f.link[1]}" class="t-info">${f.link[0]} →</a></div></div>`;
}
function kindRef() {
  return `<table class="kref"><thead><tr><th>Kind</th><th>Fires when</th><th>Source · delay</th><th>On this site</th></tr></thead><tbody>${ALERT_KINDS.map((k) => `<tr><td>${k.name}</td><td>${k.fires}.</td><td>${provChip(k.chip, 'solid')}<br>${k.delay}. Checks: ${k.check.charAt(0).toLowerCase()}${k.check.slice(1)}.</td><td>${stateTag(k.state, k.stateText)}</td></tr>`).join('')}<tr><td style="color: var(--steel);">Score, tier, level touch</td><td>Structure moves on a ticker’s options.</td><td>Needs a paid options feed.</td><td>${stateTag('notLive')}</td></tr></tbody></table>`;
}

export function alertsPageBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const right = `<div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><button class="btn primary" type="button">${icon('plus', 16)}New alert</button></div>`;
  const rules = P('Your alerts', `<span class="chip">${RULES.length}</span>`, `<div>${RULES.map(ruleRow).join('')}</div><p class="dline" style="margin: 0;">Kept in this browser. Sign in to keep them on your account.</p>`);
  const fired = P('Fired', stateTag('current', 'Updated · checked 9:32 AM'), `<div>${FIRED.map(fireRow).join('')}</div>`);
  const ref = P('What each kind watches', '', kindRef());
  const main = `<div class="wrap al5">${H('Alerts', LEAD, right)}${legend()}${secStrip()}<div class="al5-g"><div class="al5-col">${rules}${ref}</div><div class="al5-col">${fired}</div></div></div>`;
  return v4Page({ scheme, minHeight, active: 'alerts', label: 'Alerts', main });
}

// ---- the create-alert flow ----------------------------------------------------------------------
const step = (n) => `<span class="chip outline mono" style="font-size: 11px;">Step ${n} of 3</span>`;
function kindTiles(sel = 'filing') {
  return `<div class="ktiles" role="group" aria-label="What to watch">${ALERT_KINDS.map((k) => `<button type="button" class="ktile" aria-pressed="${k.key === sel}"><span class="kh">${icon(k.glyph, 16)}${k.name}${k.key === sel ? `<span style="margin-left: auto;">${icon('check', 16)}</span>` : ''}</span><span class="kd">${k.fires}.</span><span class="kt">${provChip(k.chip, 'solid')}${stateTag(k.state, k.stateText)}</span></button>`).join('')}</div><details class="opsnote"><summary>Structure alerts (${STRUCTURE_KINDS.length})</summary><div class="ktiles" style="margin-top: 8px;">${STRUCTURE_KINDS.map(([n, why]) => `<button type="button" class="ktile" disabled><span class="kh">${icon('notlive', 16)}${n}</span><span class="kd">Not live: ${why}, which this site doesn’t run.</span></button>`).join('')}</div></details>`;
}
export const chooseDialog = (sel = 'filing') => dlg({ title: 'New alert', chip: step(1), wide: true, body: `<p class="sumline" style="font-size: 13.5px; color: var(--steel);">What should Convexa watch? Every kind reads a public source and says how late that source is.</p>${kindTiles(sel)}`, foot: `<span style="flex: 1;"></span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Next</button>` });

export function filingConfig({ err = '' } = {}) {
  const forms = ['8-K', '10-Q', '10-K'].map((f) => `<span class="pill-on">${icon('check', 14)}${f}</span>`).join('');
  const items = [['Any item', false], ['2.02 Results', true], ['5.02 Officers', true], ['1.01 Agreements', false], ['8.01 Other events', false]].map(([l, on]) => `<span class="${on ? 'pill-on' : 'pill'}">${on ? icon('check', 14) : ''}${l}</span>`).join('');
  return dlg({ title: 'New filing', chip: step(2), body: `${fld('Ticker', err ? 'AMZN' : 'NVDA', { mono: true, focus: !!err, help: err ? '' : 'Followed: you have notes on NVDA.', err })}<div class="fld">Forms<span style="display: flex; flex-wrap: wrap; gap: 8px;">${forms}</span></div><div class="fld">8-K items<span style="display: flex; flex-wrap: wrap; gap: 8px;">${items}</span><span class="help">An 8-K’s items say what it is about; leave “Any item” on to hear about every one.</span></div><div class="fld">Tell me<span style="display: flex; flex-direction: column; gap: 8px; font-weight: 400;"><span class="dline" style="font-size: 13px; color: var(--phosphor);">${icon('check', 14)} On the Alerts page, always</span><span style="display: inline-flex; gap: 10px; align-items: center; font-weight: 400; font-size: 13px;">${sw(true, 'Browser notification')}Browser notification</span></span></div>`, foot: `<button class="btn ghost" type="button">Back</button><span style="flex: 1;"></span><button class="btn primary" type="button">Next</button>` });
}
export function cftcConfig() {
  const s = CFTC.series.lev; const st = rangeStats(s);
  return dlg({ title: 'Positioning extreme', chip: step(2), body: `${fld('Contract', '10-year T-note futures', { help: 'Traders in Financial Futures, CBOT.' })}<div class="fld">Trader group${seg(['Asset managers', 'Leveraged funds', 'Dealers', 'Other'], 'Leveraged funds')}</div><div class="fld">Fire when the net position reaches its${seg(['3-year high', '3-year low', 'Either'], '3-year low')}</div><div class="fld">How close${seg(['At the extreme', 'Within 5%'], 'Within 5%')}</div><div class="fld">Where it is now<div style="font-weight: 400;">${rangeBar({ lo: st.min, hi: st.max, median: st.median, now: st.last, band: [st.p10, st.p90], labels: [{ v: st.min, text: `${fmt.signedCompact(st.min)} 3-yr low`, align: 0 }, { v: st.max, text: `${fmt.signedCompact(st.max)} high`, align: 1 }], aria: `Leveraged funds net ${fmt.signedCompact(st.last)}, ${st.pct}% of the 3-year range` })}</div><span class="help">${fmt.signedCompact(st.last)} net, ${st.pct}% of its 3-year range (tick = median, band = 10th–90th percentile). Positions as of Tue Oct 6, published Fri Oct 9.</span></div>`, foot: `<button class="btn ghost" type="button">Back</button><span style="flex: 1;"></span><button class="btn primary" type="button">Next</button>` });
}
export function siConfig({ err = '' } = {}) {
  return dlg({ title: 'Short interest change', chip: step(2), body: `${fld('Ticker', 'AMD', { mono: true, help: 'FINRA settles short interest twice a month and publishes about a week later.' })}<div class="fld">Fire when${seg(['Shares short change', 'Days to cover crosses'], 'Shares short change')}</div>${fld('By more than', err ? '150 %' : '15 %', { mono: true, focus: !!err, err, help: err ? '' : 'Between two settlements, up or down.' })}`, foot: `<button class="btn ghost" type="button">Back</button><span style="flex: 1;"></span><button class="btn primary" type="button">Next</button>` });
}
export function reviewDialog({ busy = false, failed = false } = {}) {
  const k = KIND.filing;
  return dlg({ title: 'Review', chip: step(3), body: `<p class="sumline">Tell me when <span class="mono">NVDA</span> files an 8-K with item 2.02 or 5.02, a 10-Q or a 10-K.</p><div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">${provChip(k.chip, 'solid')}${stateTag(k.state, k.stateText)}</div><dl style="margin: 0; display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 6px 12px; font-size: 13px;"><dt class="steel">Delay</dt><dd style="margin: 0;">${k.delay}.</dd><dt class="steel">Checks</dt><dd style="margin: 0;">${k.check}.</dd><dt class="steel">Tells you</dt><dd style="margin: 0;">On the Alerts page and by browser notification.</dd></dl>${failed ? `<div class="dwarn" role="alert">${icon('warn', 14)}<div style="display: flex; flex-direction: column; gap: 4px;"><strong style="font-size: 13px;">Couldn’t save the alert.</strong><span class="dline">This browser’s storage refused the write (it may be full or private). Your choices are kept; try again, or sign in to keep alerts on your account.</span></div></div>` : ''}`, foot: `<button class="btn ghost" type="button">Back</button><span style="flex: 1;"></span><button class="btn primary" type="button"${busy ? ' aria-busy="true" aria-label="Saving" style="min-width: 112px;"' : ' style="min-width: 112px;"'}>${busy ? '<span class="skel" style="width: 64px; height: 10px; display: inline-block;" aria-hidden="true"></span>' : failed ? 'Try again' : 'Save alert'}</button>` });
}

export function alertsFlowBody({ minHeight = 0, scheme = 'dark' } = {}) {
  const cap = (t, d, html) => `<div class="flow-cap"><b>${t}</b><p class="dline" style="margin: 0; font-size: 12.5px;">${d}</p>${html}</div>`;
  return `<div class="v4 v5" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="sb">
    <header><div class="caps" style="color: var(--steel);">Q-5 · ruled “design it now” by the owner · 2026-10-13</div><h1 class="display" style="margin-top: 6px;">New alert, in three steps</h1><p class="lead">Choose what to watch, set it up, read it back. Every kind names its source and its delay before it is saved, and a kind that can’t check yet says so without blocking the save. On a phone each step is a bottom sheet (the 390 board).</p><p class="trace">Resolves Q-5 · uses P-1 and P-2 (approved) · no buy/sell language</p></header>
    <div class="flow">${cap('1 · Choose', 'Six kinds that work on public data; structure kinds folded away, Not live.', chooseDialog())}${cap('2 · Set up · a filing', 'Followed tickers only; forms and 8-K items; how to be told.', filingConfig())}${cap('3 · Read it back', 'One sentence, the source, the delay, when it checks. Then save.', reviewDialog())}</div>
    <div class="flow">${cap('2 · Set up · positioning', 'Where the group sits now, drawn with the chart system’s range bar, before you pick the extreme.', cftcConfig())}${cap('2 · Set up · short interest', 'A change between settlements, or days to cover.', siConfig())}${cap('After saving', 'The rule joins the list with its state; nothing pretends to have checked.', `<div class="hd-p" style="gap: 8px;">${ruleRow({ ...RULES[1], last: 'First check within the hour' })}</div><div role="status" class="toast" style="display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 10px; background: var(--raised); border: 1px solid var(--line-2); box-shadow: var(--e4); font-size: 13px;">${icon('check', 16)}Alert saved. It checks EDGAR every hour.</div>`)}</div>
    <p style="margin: 0; font-size: 12px; color: var(--steel);">Figures are illustrative design values. Research and tools, not investment advice.</p>
  </div></div>`;
}

export function alertsStates5Body({ minHeight = 0, scheme = 'dark' } = {}) {
  const suggest = `<div class="hd-p" style="gap: 10px;"><strong style="font-size: 14px;">No alerts yet.</strong><span class="dline" style="font-size: 13px;">These work on this site today:</span>${[['cftc', 'When leveraged funds in 10-year notes reach a 3-year extreme'], ['results', 'A week before NVDA’s expected results date'], ['note', 'When one of your notes is due for review']].map(([k, t]) => `<button type="button" class="ktile" style="width: 100%;"><span class="kh">${icon(KIND[k].glyph, 16)}${t}</span><span class="kt">${provChip(KIND[k].chip, 'solid')}${stateTag(KIND[k].state, KIND[k].stateText)}</span></button>`).join('')}</div>`;
  const items = [
    { name: 'No alerts yet', tag: ['empty'], when: 'Teaches with three alerts that work now; none needs SEC access.', html: suggest },
    { name: 'SEC kinds not set up', tag: ['notConfigured'], when: 'Only if SEC_USER_AGENT is unset (production has it set): saved and listed; the reader sentence first, the operator hint folded (DS-02).', html: `<div class="hd-p" style="gap: 8px;">${[RULES[1], RULES[2]].map((r) => ruleRow({ ...r, last: 'Starts when SEC access is set up', state: 'notConfigured', stateText: 'Not set up' })).join('')}</div>${secStrip()}` },
    { name: 'Source down', tag: ['unavailable'], when: 'The CFTC didn’t answer when Alerts opened. Unknown, not quiet: nothing fires from an old report, and Convexa asks again the next time Alerts opens.', html: `<div class="hd-p" style="gap: 8px;">${ruleRow({ ...RULES[3], state: 'unavailable', stateText: 'Source down', last: 'The source didn’t answer' })}</div>` },
    { name: 'Couldn’t load your alerts', tag: ['error'], when: 'Our read failed; editing waits for a reload, nothing deleted.', html: `<div class="dwarn" role="alert">${icon('warn', 14)}<div><strong style="font-size: 13px;">Couldn’t read your saved alerts.</strong><span class="dline" style="display: block;">Nothing was deleted. Reload the page to try again.</span><button class="btn secondary sm" type="button" style="margin-top: 6px;">Reload the page</button></div></div>` },
    { name: 'Switched off', tag: ['off'], when: 'Off on purpose: no checks, no firings, one switch to turn it back on.', html: `<div class="hd-p" style="gap: 8px;">${ruleRow(RULES[6])}</div>` },
    { name: 'A rule fired', tag: ['current', 'Fired Oct 9, 9:32 AM'], when: 'Says what the source published, with its date, and where to read more. Never what to do about it.', html: `<div class="hd-p">${fireRow(FIRED[0])}</div><div role="status" style="display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: var(--raised); border: 1px solid var(--line-2); box-shadow: var(--e4); font-size: 13px; max-width: 420px;">${icon('bell', 16)}<span><strong>Convexa · 10-year T-note positioning</strong><br><span class="dline">Leveraged funds at a 3-year low, as of Tue Oct 6 (CFTC, published Fri).</span></span></div>` },
    { name: 'Notifications blocked', tag: ['notConfigured', 'Blocked here'], when: 'Says where to change it; firings still list on the page.', html: `<div class="hd-p"><div class="ph"><h3>Browser notification</h3>${stateTag('notConfigured', 'Blocked here')}</div><span class="dline">Browser notifications are blocked for this site. Allow them in your browser’s site settings; firings still appear under Fired.</span></div>` },
    { name: 'Demo build', tag: ['demo'], when: 'Alerts never fire in the demo; its firings are samples, dashed and dated.', html: `<div class="hd-p is-sample" style="gap: 8px;"><div class="ph"><h3>Fired</h3>${stateTag('demo')}</div>${fireRow({ ...FIRED[1], chip: 'Sample · shaped like a Convexa note', date: 'Oct 7' }).replace(provChip('Sample · shaped like a Convexa note', 'solid'), provChip('Sample · shaped like a Convexa note', 'dashed'))}<span class="dline">Scenario · Oct 7, 2026 · nothing here was published by a source.</span></div>` },
    { name: 'Ticker not followed', tag: ['notConfigured', 'Check the ticker'], when: 'Filing and insider alerts are for followed tickers; the error says how to fix it.', html: filingConfig({ err: 'AMZN isn’t followed. Follow it from its research page, or pick a ticker you follow.' }) },
    { name: 'Out of range', tag: ['error', 'Check the value'], when: 'Inline, at the field, with the allowed range.', html: siConfig({ err: 'Enter a change between 5% and 100%.' }) },
    { name: 'Already watching', tag: ['current', 'Exists'], when: 'A duplicate opens the existing alert instead of making a second.', html: `<div class="dwarn" style="background: transparent; border-color: var(--line-2);">${icon('info', 14, 'style="color: var(--steel); margin-top: 2px;"')}<div><strong style="font-size: 13px;">You already have this alert.</strong><span class="dline" style="display: block;">New filing · NVDA · 8-K 2.02, 5.02 · 10-Q · 10-K.</span><a href="#rule" class="t-info" style="display: inline-flex; min-height: 24px; align-items: center;">Open it →</a></div></div>` },
    { name: 'Saving, and couldn’t save', tag: ['error', 'Kept your choices'], when: 'The button keeps its width while saving; a failed save keeps every choice and names the cause.', html: `${reviewDialog({ busy: true })}${reviewDialog({ failed: true })}` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Alerts on public data · states', lead: 'The Alerts page and the new-alert flow in every state the semi-live site can reach: empty, SEC kinds not set up, a source down, our own failure, switched off, fired, notifications blocked, the demo, and the dialog’s validation, duplicate, saving and failed-save states.', trace: 'Q-5 (ruled 2026-10-13) · P-1, P-2 (approved)', items });
}
