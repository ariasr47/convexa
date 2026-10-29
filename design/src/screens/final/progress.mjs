// Final · the board map (2026-10-15): every screen on this page and how much of it is built, generated
// from each row's spec card ("Built so far") every time the design builds. Nothing here is typed by
// hand: a status changes when a spec card's `built` list does.
//
// A screen is Built when every item on its card is shipped, In progress when some are shipped or
// partly built, and Designed when none are. Items marked `host: true` (the page a planned tool sits
// on) never count toward a status.
//
// Since 2026-10-28 both boards carry a Since column: the Convexa release a screen first shipped in
// (tracker-data.mjs SHIPPED_IN, set once), or Planned for a screen on a planned page. It was headed Version until
// the review the same day: a set-once value under the canvas's own version read as the version the canvas shows.

import { ISSUES, OPEN_QUESTIONS, SHIPPED_IN, WAITS } from './tracker-data.mjs';

const STATUS = {
  built: { word: 'Built', cls: 'built' },
  progress: { word: 'In progress', cls: 'progress' },
  designed: { word: 'Designed', cls: 'designed' },
};

export const PROGRESS_CSS = `
  .pm { padding: 40px 44px 56px; display: flex; flex-direction: column; gap: 28px; font-size: 13.5px; line-height: 1.5; }
  .pm .eyebrow { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--steel); }
  .pm h1 { margin: 6px 0 0; font-size: 38px; line-height: 1.05; letter-spacing: -0.02em; }
  .pm .lead { margin: 10px 0 0; max-width: 92ch; color: var(--steel); font-size: 14px; }
  .pm h2 { margin: 0; font-size: 18px; letter-spacing: -0.01em; }
  .pm .tot { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .pm .tot > div { border: 1px solid var(--line-2); border-radius: 12px; padding: 14px 16px; background: var(--panel); display: flex; flex-direction: column; gap: 4px; }
  .pm .tot .n { font: 500 30px/1.1 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .pm .tot .l { font-size: 12.5px; color: var(--steel); }
  .pm .bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: transparent; border: 1px solid var(--line-2); min-width: 0; }
  .pm .bar i { display: block; height: 100%; }
  .pm .bar i.s { background: var(--phosphor); }
  .pm .bar i.p { background: var(--steel); }
  .pm .bar i.t { background: repeating-linear-gradient(135deg, transparent 0 3px, var(--line-2) 3px 5px); }
  .pm .key { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12.5px; color: var(--steel); align-items: center; }
  .pm .key span { display: inline-flex; align-items: center; gap: 6px; }
  .pm .key i { width: 14px; height: 10px; border-radius: 3px; display: inline-block; border: 1px solid var(--line-2); }
  .pm .grp { display: flex; flex-direction: column; gap: 10px; }
  .pm .grp-h { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .pm .grp-h .c { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .pm table { width: 100%; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
  .pm th { text-align: left; font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 6px 10px; border-bottom: 1px solid var(--line-2); }
  .pm td { padding: 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .pm td.name strong { display: block; font-size: 13.5px; color: var(--phosphor); }
  .pm td.name .route { display: block; margin-top: 3px; font: 12px/1.4 'IBM Plex Mono', monospace; color: var(--steel); word-break: break-word; }
  .pm .boards { display: flex; flex-wrap: wrap; gap: 4px; }
  .pm .boards span { font: 500 11px 'IBM Plex Mono', monospace; border: 1px solid var(--line-2); border-radius: 8px; padding: 0 6px; color: var(--steel); white-space: nowrap; }
  .pm .counts { margin-top: 6px; font: 11.5px 'IBM Plex Mono', monospace; color: var(--steel); }
  .pm .st { display: inline-block; font: 600 11px 'IBM Plex Mono', monospace; padding: 1px 8px; border-radius: 10px; border: 1px solid var(--line-2); white-space: nowrap; }
  .pm .st.built { color: var(--ink); background: var(--phosphor); border-color: var(--phosphor); }
  .pm .st.progress { color: var(--phosphor); border-style: dashed; }
  .pm .st.designed { color: var(--steel); border-style: dotted; }
  .pm .next { color: var(--phosphor); }
  .pm .next .more { display: block; margin-top: 4px; color: var(--steel); font-size: 12px; }
  .pm .next .none { color: var(--steel); }
  .pm td.ver .v { font: 500 12.5px/1.5 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .pm td.ver .none { color: var(--steel); }
`;

const pascal = (s) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/** Counts and status for one row, from its spec card alone. */
export function rowProgress(row) {
  const built = row.spec?.built ?? [];
  const c = { shipped: 0, partial: 0, todo: 0 };
  for (const b of built) c[b.status] = (c[b.status] ?? 0) + 1;
  const total = c.shipped + c.partial + c.todo;
  // Items marked `host: true` describe the page a planned tool sits on (the Markets page Liquidity
  // lives on), not the tool, so the status counts only the tool's own items.
  const own = built.filter((b) => !b.host);
  const o = { shipped: 0, partial: 0 };
  for (const b of own) if (b.status in o) o[b.status] += 1;
  const status =
    own.length > 0 && o.shipped === own.length
      ? 'built'
      : o.shipped + o.partial > 0
        ? 'progress'
        : 'designed';
  const open = built.filter((b) => b.status !== 'shipped');
  return { ...c, total, status, open };
}

const bar = ({ shipped, partial, todo, total }) =>
  `<div class="bar" role="img" aria-label="${shipped} shipped, ${partial} partly built, ${todo} designed, of ${total}">${[
    ['s', shipped],
    ['p', partial],
    ['t', todo],
  ]
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `<i class="${k}" style="width: ${(n / Math.max(1, total)) * 100}%;"></i>`)
    .join('')}</div>`;

// Plain text from a spec item (they may hold <code> and the like), cut at a word near `max`.
const plain = (s) => s.replace(/<[^>]+>/g, '');
const clip = (s, max = 190) => {
  const t = plain(s);
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(' ', max);
  return `${t.slice(0, cut > 80 ? cut : max)} …`;
};

/** A screen's Since cell: the Convexa release it first shipped in (Mono, a figure), or Planned (Sans, a word). */
const versionCell = (r) => (SHIPPED_IN[r.key] ? `<span class="v">${SHIPPED_IN[r.key]}</span>` : '<span class="none">Planned</span>');

/**
 * The board. `groups` = [{ label, rows }] in page order (the progress row itself excluded).
 */
export function progressBoard(groups, { version } = {}) {
  return ({ scheme = 'dark', minHeight = 0 } = {}) => {
    const rows = groups.flatMap((g) => g.rows);
    const all = rows.map(rowProgress);
    const sum = (k) => all.reduce((a, p) => a + p[k], 0);
    const items = { shipped: sum('shipped'), partial: sum('partial'), todo: sum('todo'), total: sum('total') };
    const screens = { built: 0, progress: 0, designed: 0 };
    for (const p of all) screens[p.status] += 1;
    const boards = rows.reduce((a, r) => a + r.boards.length + (r.spec ? 1 : 0), 0);

    const totals = `<div class="tot">
      <div><span class="n">${rows.length}</span><span class="l">screens on this canvas · ${boards} boards</span></div>
      <div><span class="n">${screens.built}</span><span class="l">built: every item on the card shipped</span></div>
      <div><span class="n">${screens.progress}</span><span class="l">in progress: some shipped or partly built</span></div>
      <div><span class="n">${screens.designed}</span><span class="l">designed, not started</span></div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${bar(items)}
      <div class="key">
        <span><i style="background: var(--phosphor); border-color: var(--phosphor);"></i>Shipped · ${items.shipped} (${pct(items.shipped, items.total)}%)</span>
        <span><i style="background: var(--steel); border-color: var(--steel);"></i>Partly built · ${items.partial}</span>
        <span><i style="background: repeating-linear-gradient(135deg, transparent 0 3px, var(--line-2) 3px 5px);"></i>Designed, not built · ${items.todo}</span>
        <span>of ${items.total} items across every spec card</span>
      </div>
    </div>`;

    const group = (g) => {
      const ps = g.rows.map(rowProgress);
      const gs = { shipped: 0, partial: 0, todo: 0, total: 0 };
      for (const p of ps) for (const k of Object.keys(gs)) gs[k] += p[k];
      const body = g.rows
        .map((r, i) => {
          const p = ps[i];
          const s = STATUS[p.status];
          const names = [...(r.spec ? ['Spec'] : []), ...r.boards.map((b) => pascal(b.id))];
          const next = p.open[0];
          return `<tr>
            <td class="name"><strong>${r.label}</strong>${r.spec?.route ? `<span class="route">${r.spec.route}</span>` : ''}</td>
            <td class="ver">${versionCell(r)}</td>
            <td><span class="st ${s.cls}">${s.word}</span></td>
            <td>${bar(p)}<div class="counts">${p.shipped}/${p.total} shipped${p.partial ? ` · ${p.partial} partly` : ''}${p.todo ? ` · ${p.todo} not built` : ''}</div></td>
            <td><div class="boards">${names.map((n) => `<span>${n}</span>`).join('')}</div></td>
            <td class="next">${next ? `${clip(next.what)}${p.open.length > 1 ? `<span class="more">+ ${p.open.length - 1} more open on its spec card</span>` : ''}` : '<span class="none">Nothing open</span>'}</td>
          </tr>`;
        })
        .join('');
      return `<section class="grp">
        <div class="grp-h"><h2>${g.label}</h2><span class="c">${g.rows.length} screen${g.rows.length === 1 ? '' : 's'} · ${gs.shipped}/${gs.total} items shipped</span></div>
        <table>
          <colgroup><col style="width: 19%;"><col style="width: 6%;"><col style="width: 8%;"><col style="width: 14%;"><col style="width: 17%;"><col></colgroup>
          <thead><tr><th>Screen</th><th>Since</th><th>Status</th><th>Items</th><th>Boards in its row</th><th>Next open item</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </section>`;
    };

    return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><article class="pm" aria-label="Board map">
      <header>
        <div class="eyebrow">Start here · board map${version ? ` · Convexa ${version}` : ''}</div>
        <h1 class="display">What’s built</h1>
        <p class="lead">Every screen on this canvas, grouped by the page it sits on (the page list, top left), read from its own spec card’s “Built so far” each time the design builds; nothing on this board is typed by hand. <strong>Since</strong> is the Convexa release a screen first shipped in, from <code>tracker-data.mjs</code>, set once; a screen on a planned page has none yet and reads <strong>Planned</strong>. A screen is <strong>Built</strong> when every item on its card is shipped, <strong>In progress</strong> when some are shipped or partly built, and <strong>Designed</strong> when none are. A planned tool’s status counts only its own items, not the page it sits on. Board names are the ones in its row, left to right.</p>
      </header>
      ${totals}
      ${groups.map(group).join('')}
    </article></div>`;
  };
}

// ---- The screen tracker (2026-10-15) -------------------------------------------------------------
// Every screen with every open item and why it is open (the item's `waits`, default "To build"), the
// known issues checks found on it (tracker-data.mjs ISSUES), and the owner's open questions with what
// each one unblocks. Like the map, nothing about a screen is typed here: items come from spec cards.

export const TRACKER_CSS = `
  .tk { padding: 40px 44px 56px; display: flex; flex-direction: column; gap: 30px; font-size: 13.5px; line-height: 1.5; }
  .tk .eyebrow { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--steel); }
  .tk h1 { margin: 6px 0 0; font-size: 38px; line-height: 1.05; letter-spacing: -0.02em; }
  .tk .lead { margin: 10px 0 0; max-width: 96ch; color: var(--steel); font-size: 14px; }
  .tk h2 { margin: 0; font-size: 18px; letter-spacing: -0.01em; }
  .tk .tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .tk .tile { border: 1px solid var(--line-2); border-radius: 12px; padding: 14px 16px; background: var(--panel); display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .tk .tile .h { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); }
  .tk .tile .nums { display: flex; flex-direction: column; gap: 4px; }
  .tk .tile .row { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
  .tk .tile .n { font: 500 18px/1.2 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .tk .chip { display: inline-block; font: 600 11px/1.6 'IBM Plex Mono', monospace; padding: 0 8px; border-radius: 10px; border: 1px solid var(--line-2); white-space: nowrap; color: var(--phosphor); }
  .tk .w-build { border-style: solid; }
  .tk .w-owner { background: var(--phosphor); color: var(--ink); border-color: var(--phosphor); }
  .tk .w-parked { border-style: dashed; color: var(--steel); }
  .tk .w-spend { border-style: dotted; color: var(--steel); }
  .tk .w-decided { border-color: transparent; color: var(--steel); padding-left: 0; }
  .tk .sv-high { border-width: 2px; }
  .tk .sv-medium { border-style: solid; }
  .tk .sv-low { border-style: dotted; color: var(--steel); }
  .tk .st { display: inline-block; font: 600 11px 'IBM Plex Mono', monospace; padding: 1px 8px; border-radius: 10px; border: 1px solid var(--line-2); white-space: nowrap; }
  .tk .st.built { color: var(--ink); background: var(--phosphor); border-color: var(--phosphor); }
  .tk .st.progress { color: var(--phosphor); border-style: dashed; }
  .tk .st.designed { color: var(--steel); border-style: dotted; }
  .tk .bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid var(--line-2); margin-top: 8px; }
  .tk .bar i { display: block; height: 100%; }
  .tk .bar i.s { background: var(--phosphor); }
  .tk .bar i.p { background: var(--steel); }
  .tk .bar i.t { background: repeating-linear-gradient(135deg, transparent 0 3px, var(--line-2) 3px 5px); }
  .tk .counts { margin-top: 6px; font: 11.5px 'IBM Plex Mono', monospace; color: var(--steel); }
  .tk table { width: 100%; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
  .tk th { text-align: left; font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 6px 10px; border-bottom: 1px solid var(--line-2); }
  .tk td { padding: 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .tk td.name strong { display: block; font-size: 13.5px; color: var(--phosphor); }
  .tk td.name .route { display: block; margin-top: 3px; font: 12px/1.4 'IBM Plex Mono', monospace; color: var(--steel); word-break: break-word; }
  .tk ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .tk li { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px; align-items: baseline; }
  .tk li .t { color: var(--phosphor); }
  .tk li .t .ask { color: var(--steel); font: 11.5px 'IBM Plex Mono', monospace; }
  .tk li.fixed .t { color: var(--steel); text-decoration: line-through; }
  .tk .env { font: 11px 'IBM Plex Mono', monospace; color: var(--steel); margin-left: 6px; white-space: nowrap; }
  .tk .none { color: var(--steel); }
  .tk .grp { display: flex; flex-direction: column; gap: 10px; }
  .tk .grp-h { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .tk .grp-h .c { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .tk .qs td.id { font: 600 12px 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .tk .qs td .why { display: block; margin-top: 4px; color: var(--steel); }
  .tk .qs td .ub { display: flex; flex-wrap: wrap; gap: 4px; }
  .tk table.answered td { color: var(--steel); }
  .tk table.answered td b { color: var(--phosphor); font-weight: 500; }
  .tk td.ver .v { font: 500 12.5px/1.5 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .tk td.ver .none { color: var(--steel); }
`;

const SEV_WORD = { high: 'High', medium: 'Medium', low: 'Low' };
const SEV_ORDER = { high: 0, medium: 1, low: 2 };
const waitOf = (b) => b.waits ?? 'build';
/** An open item's gap: a partly built item usually says what shipped first and what's left after a
 *  marker ("Left:", "Not yet:", …); show the gap, not the part that shipped. */
const gapText = (b) => {
  const t = plain(b.what);
  const m = b.status === 'partial' ? t.match(/(?:Left to build|Left|Not yet|Still not built|Not reachable yet)\s*:\s*/) : null;
  return clip(m ? t.slice(m.index + m[0].length).replace(/^./, (c) => c.toUpperCase()) : t, 230);
};

/** An issue is closed when fixed, or when a check could not reproduce it (it says why). */
const closedIssue = (i) => i.status === 'fixed' || i.status === 'not_reproduced' || i.status === 'decided';
/** The issue's state after its env: fixed (commit), partly fixed and what's left, or not reproduced. */
const issueState = (i) =>
  i.status === 'fixed'
    ? ` · fixed${i.commit ? ` ${i.commit}` : ''}`
    : i.status === 'partial'
      ? ` · partly fixed${i.commit ? ` ${i.commit}` : ''}; left: ${i.left ?? 'see the card'}`
      : i.status === 'not_reproduced'
        ? ` · not reproduced${i.left ? `: ${i.left}` : ''}`
        : i.status === 'decided'
          ? ` · closed by your ruling${i.left ? `: ${i.left}` : ''}`
          : '';

/** The tracker board. `groups` as for progressBoard. */
export function trackerBoard(groups, { version } = {}) {
  return ({ scheme = 'dark', minHeight = 0 } = {}) => {
    const rows = groups.flatMap((g) => g.rows);
    const info = rows.map((r) => {
      const p = rowProgress(r);
      const issues = ISSUES.filter((i) => i.screens.includes(r.label)).sort(
        (a, b) => closedIssue(a) - closedIssue(b) || SEV_ORDER[a.sev] - SEV_ORDER[b.sev],
      );
      return { r, p, issues };
    });
    const openItems = info.flatMap((x) => x.p.open.map((b) => ({ ...b, screen: x.r.label })));
    const byWait = Object.fromEntries(Object.keys(WAITS).map((k) => [k, openItems.filter((b) => waitOf(b) === k).length]));
    const screens = { built: 0, progress: 0, designed: 0 };
    for (const x of info) screens[x.p.status] += 1;
    const openIssues = ISSUES.filter((i) => !closedIssue(i));
    const sevCount = (s) => openIssues.filter((i) => i.sev === s).length;
    const questions = OPEN_QUESTIONS.filter((q) => q.status !== 'answered');
    const answered = OPEN_QUESTIONS.filter((q) => q.status === 'answered');

    const row = (k, n, label) => `<div class="row"><span>${label ?? k}</span><span class="n">${n}</span></div>`;
    const tiles = `<div class="tiles">
      <div class="tile"><span class="h">Screens · ${rows.length}</span><div class="nums">
        ${row('built', screens.built, '<span class="st built">Built</span>')}
        ${row('progress', screens.progress, '<span class="st progress">In progress</span>')}
        ${row('designed', screens.designed, '<span class="st designed">Designed</span>')}
      </div></div>
      <div class="tile"><span class="h">Open items · ${openItems.length}</span><div class="nums">
        ${Object.entries(WAITS).map(([k, w]) => row(k, byWait[k], `<span class="chip w-${k}">${w.word}</span>`)).join('')}
      </div></div>
      <div class="tile"><span class="h">Known issues open · ${openIssues.length}</span><div class="nums">
        ${['high', 'medium', 'low'].map((s) => row(s, sevCount(s), `<span class="chip sv-${s}">${SEV_WORD[s]}</span>`)).join('')}
        ${row('fixed', ISSUES.length - openIssues.length, '<span class="none">Fixed or not reproduced</span>')}
      </div></div>
      <div class="tile"><span class="h">Waiting on you</span><div class="nums">
        ${row('q', questions.length, 'Open questions')}
        ${row('qi', byWait.owner, 'Items they hold')}
        ${row('a', answered.length, '<span class="none">Answered</span>')}
      </div></div>
    </div>`;

    const unblocks = (q) => {
      const its = openItems.filter((b) => b.ask === q.id);
      const names = [...new Set(its.map((b) => b.screen))];
      return names.length ? `<div class="ub">${names.map((n) => `<span class="chip">${n}</span>`).join('')}</div>` : '<span class="none">No card item; see why</span>';
    };
    const qTable = `<section class="grp qs">
      <div class="grp-h"><h2>Waiting on you</h2><span class="c">${questions.length} open question${questions.length === 1 ? '' : 's'}</span></div>
      <table>
        <colgroup><col style="width: 11%;"><col style="width: 55%;"><col></colgroup>
        <thead><tr><th>Question</th><th>What’s asked, and why</th><th>Screens it holds</th></tr></thead>
        <tbody>${questions.map((q) => `<tr><td class="id">${q.id}</td><td>${q.ask}<span class="why">${q.why}</span></td><td>${unblocks(q)}</td></tr>`).join('')}</tbody>
      </table>
      ${answered.length ? `<p class="lead">${answered.length} answered question${answered.length === 1 ? '' : 's'} left this board; <code>tracker-data.mjs</code> and DESIGN_SYSTEM.md Amendments keep the answers.</p>` : ''}
    </section>`;

    const group = (g) => {
      const xs = info.filter((x) => g.rows.includes(x.r));
      const nOpen = xs.reduce((a, x) => a + x.p.open.length, 0);
      const nIss = xs.reduce((a, x) => a + x.issues.filter((i) => !closedIssue(i)).length, 0);
      const body = xs
        .map(({ r, p, issues }) => {
          const s = STATUS[p.status];
          const items = p.open.length
            ? `<ul>${p.open.map((b) => `<li><span class="chip w-${waitOf(b)}">${WAITS[waitOf(b)].word}</span><span class="t">${gapText(b)}${b.ask ? ` <span class="ask">${b.ask}</span>` : ''}</span></li>`).join('')}</ul>`
            : '<span class="none">Nothing open</span>';
          const openIss = issues.filter((i) => !closedIssue(i));
          const iss = openIss.length
            ? `<ul>${openIss.map((i) => `<li><span class="chip sv-${i.sev}">${i.id}</span><span class="t">${i.title}<span class="env">${i.env}${issueState(i)}</span></span></li>`).join('')}</ul>`
            : `<span class="none">${issues.length ? `None open · ${issues.length} fixed or closed` : 'None known'}</span>`;
          return `<tr>
            <td class="name"><strong>${r.label}</strong>${r.spec?.route ? `<span class="route">${r.spec.route}</span>` : ''}</td>
            <td class="ver">${versionCell(r)}</td>
            <td><span class="st ${s.cls}">${s.word}</span>${bar(p)}<div class="counts">${p.shipped}/${p.total} shipped${issues.some((i) => !closedIssue(i)) ? ` · ${issues.filter((i) => !closedIssue(i)).length} issue${issues.filter((i) => !closedIssue(i)).length === 1 ? '' : 's'} open` : ''}</div></td>
            <td>${items}</td>
            <td>${iss}</td>
          </tr>`;
        })
        .join('');
      return `<section class="grp">
        <div class="grp-h"><h2>${g.label}</h2><span class="c">${g.rows.length} screen${g.rows.length === 1 ? '' : 's'} · ${nOpen} open item${nOpen === 1 ? '' : 's'} · ${nIss} known issue${nIss === 1 ? '' : 's'} open</span></div>
        <table>
          <colgroup><col style="width: 15%;"><col style="width: 6%;"><col style="width: 11%;"><col style="width: 39%;"><col></colgroup>
          <thead><tr><th>Screen</th><th>Since</th><th>Status</th><th>Open items and why</th><th>Known issues</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </section>`;
    };

    return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><article class="tk" aria-label="Screen tracker">
      <header>
        <div class="eyebrow">Start here · screen tracker${version ? ` · Convexa ${version}` : ''}</div>
        <h1 class="display">Screen tracker</h1>
        <p class="lead">Every screen, the Convexa release it first shipped in (Since, or Planned), every item still open on its spec card and why it is open, and the known issues checks found on it. Items and statuses come from the spec cards each time the design builds. Open questions and known issues come from <code>tracker-data.mjs</code>; this board shows only what is still open, and the file keeps every answer and fix as the record. Reasons: <strong>To build</strong> is buildable now; <strong>Waiting on you</strong> needs an answer (its question id is beside it); <strong>Parked by you</strong> and <strong>Needs paid data</strong> are blocked by a ruling or a licence; <strong>Left out on purpose</strong> is deliberate.</p>
      </header>
      ${tiles}
      ${qTable}
      ${groups.map(group).join('')}
    </article></div>`;
  };
}
