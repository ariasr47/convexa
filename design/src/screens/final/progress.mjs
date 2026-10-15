// Final · the board map (2026-10-15): every screen on this page and how much of it is built, generated
// from each row's spec card ("Built so far") every time the design builds. Nothing here is typed by
// hand: a status changes when a spec card's `built` list does.
//
// A screen is Built when every item on its card is shipped, In progress when some are shipped or
// partly built, and Designed when none are. Planned rows read Designed: their shipped items are the
// host page, not the tool.

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
`;

const pascal = (s) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/** Counts and status for one row, from its spec card alone. */
export function rowProgress(row) {
  const built = row.spec?.built ?? [];
  const c = { shipped: 0, partial: 0, todo: 0 };
  for (const b of built) c[b.status] = (c[b.status] ?? 0) + 1;
  const total = c.shipped + c.partial + c.todo;
  // A planned row's shipped items describe its host page (the Markets page Liquidity would sit
  // on), not the tool, so a planned row reads Designed until its own work starts.
  const status =
    row.section === 'planned'
      ? 'designed'
      : total > 0 && c.shipped === total
        ? 'built'
        : c.shipped + c.partial > 0
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

/**
 * The board. `groups` = [{ label, rows }] in page order (the progress row itself excluded).
 */
export function progressBoard(groups) {
  return ({ scheme = 'dark', minHeight = 0 } = {}) => {
    const rows = groups.flatMap((g) => g.rows);
    const all = rows.map(rowProgress);
    const sum = (k) => all.reduce((a, p) => a + p[k], 0);
    const items = { shipped: sum('shipped'), partial: sum('partial'), todo: sum('todo'), total: sum('total') };
    const screens = { built: 0, progress: 0, designed: 0 };
    for (const p of all) screens[p.status] += 1;
    const boards = rows.reduce((a, r) => a + r.boards.length + (r.spec ? 1 : 0), 0);

    const totals = `<div class="tot">
      <div><span class="n">${rows.length}</span><span class="l">screens on this page · ${boards} boards</span></div>
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
          <colgroup><col style="width: 20%;"><col style="width: 9%;"><col style="width: 15%;"><col style="width: 18%;"><col></colgroup>
          <thead><tr><th>Screen</th><th>Status</th><th>Items</th><th>Boards in its row</th><th>Next open item</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </section>`;
    };

    return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><article class="pm" aria-label="Board map">
      <header>
        <div class="eyebrow">Final · Convexa v1 · board map</div>
        <h1 class="display">What’s built</h1>
        <p class="lead">Every screen on this page, read from its own spec card’s “Built so far” each time the design builds; nothing on this board is typed by hand. A screen is <strong>Built</strong> when every item on its card is shipped, <strong>In progress</strong> when some are shipped or partly built, and <strong>Designed</strong> when none are (planned tools stay Designed until their own work starts: their shipped items are the host page). Board names are the ones in its row, left to right.</p>
      </header>
      ${totals}
      ${groups.map(group).join('')}
    </article></div>`;
  };
}
