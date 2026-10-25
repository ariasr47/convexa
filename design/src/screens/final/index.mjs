// Final · Convexa v1 (2026-10-14; one page per product area since 2026-10-25): every screen in its
// final, ruled state. One row per screen, left to right: the spec card, then the row's boards (staging =
// the demo account, production where it differs, phone, light, states). Each group module exports ROWS:
//   { key, label, css, specH?, spec, boards: [{ id, title, w, h, body: (opts) => html, opts?, extra? }] }
// Board files are named F<Key><Id> (PascalCase), the spec card F<Key>Spec; the board map is Main.
import { SPEC_CSS, specBody } from './spec.mjs';
import { ROWS as FOUNDATIONS } from './foundations.mjs';
import { ROWS as SHELL_SITE } from './shell-site.mjs';
import { ROWS as TICKER } from './ticker.mjs';
import { ROWS as RESEARCH } from './research.mjs';
import { ROWS as ACCOUNT } from './account.mjs';
import { ROWS as TRUST } from './trust.mjs';
import { ROWS as DEEP } from './deep.mjs';
import { ROWS as PLANNED } from './planned.mjs';
import { PROGRESS_CSS, TRACKER_CSS, progressBoard, trackerBoard } from './progress.mjs';

/** The canvas's pages (2026-10-25): one per product area, in the order a reader meets them. Every row
 *  belongs to exactly one page; a row added without a page fails the build. The first board of the
 *  first page is the canvas's entry, Main.dc.html. */
const PAGE_ROWS = [
  { id: 'start', name: 'Start here', keys: ['progress'], blurb: 'what’s built, what’s open, and where each screen lives' },
  { id: 'ticker', name: 'Ticker desk', keys: ['desk', 'ai-read', 'technical', 'note'], blurb: 'the desk, its AI read, and the Technical and Research tabs' },
  { id: 'research', name: 'Research', keys: ['research-index', 'research-markets', 'research-filings', 'research-scorecard'], blurb: 'Notes, Markets, Filings and Scorecard' },
  { id: 'account', name: 'Scanner & account', keys: ['scanner', 'positions', 'alerts', 'settings'], blurb: 'Scanner, Positions, Alerts and Settings' },
  { id: 'overlays', name: 'Dialogs & overlays', keys: ['dialogs', 'overlays'], blurb: 'every dialog, drawer and sheet' },
  { id: 'site', name: 'Site & shell', keys: ['shell', 'landing', 'methodology', 'blog', 'not-found', 'credits', 'privacy', 'terms', 'operator'], blurb: 'the shell, the public pages and the operator pages' },
  { id: 'foundations', name: 'Foundations', keys: ['foundations'], blurb: 'data states, the chart system, and the token and component library' },
  { id: 'planned', name: 'Planned · not built', keys: null, blurb: 'the public-data tools, designed and waiting, and two prototypes not yet ruled on' },
];
export const FINAL_PAGES = PAGE_ROWS.map(({ id, name }) => ({ id, name }));
/** Kept for imports that still name one page: the entry page. */
export const FINAL_PAGE = FINAL_PAGES[0];

/** Rows added later name the row they follow (`after: '<key>'`); `section: 'planned'` rows go last,
 *  on their own page, because they are designed but not built. */
function assemble(base, extra) {
  const rows = [...base];
  for (const r of extra.filter((x) => x.section !== 'planned')) {
    let i = rows.findIndex((x) => x.key === r.after);
    if (i < 0) i = rows.length - 1;
    while (rows[i + 1]?.after === r.after) i++; // keep several rows after the same key in their own order
    rows.splice(i + 1, 0, r);
  }
  return [...rows, ...extra.filter((x) => x.section === 'planned')];
}
const SCREEN_ROWS = assemble([...FOUNDATIONS, ...SHELL_SITE, ...TICKER, ...RESEARCH, ...ACCOUNT], [...TRUST, ...DEEP, ...PLANNED]);

/** Rows per page, in page order; the Planned page takes every `section: 'planned'` row. */
const rowsOf = (pg) => (pg.keys ? pg.keys.map((k) => SCREEN_ROWS.find((r) => r.key === k) ?? fail(`page ${pg.id}: no row ${k}`)) : SCREEN_ROWS.filter((r) => r.section === 'planned'));
function fail(msg) { throw new Error(msg); }
const PLACED = PAGE_ROWS.slice(1).flatMap(rowsOf);
for (const r of SCREEN_ROWS) if (PLACED.filter((x) => x === r).length !== 1) fail(`row ${r.key} must sit on exactly one canvas page (PAGE_ROWS)`);

/** The board map's groups: one per page after Start here, rows in their page order. */
const GROUPS = PAGE_ROWS.slice(1).map((pg) => ({ label: pg.name, rows: rowsOf(pg) }));

/** The first row: the board map, generated from every other row's spec card (progress.mjs). */
const PROGRESS_ROW = {
  key: 'progress',
  label: 'Board map',
  css: PROGRESS_CSS + TRACKER_CSS,
  boards: [
    { id: 'map', title: 'What’s built', w: 1440, h: 3200, body: progressBoard(GROUPS) },
    { id: 'tracker', title: 'Screen tracker', w: 1440, h: 6000, body: trackerBoard(GROUPS) },
  ],
};

export const FINAL_ROWS = [PROGRESS_ROW, ...SCREEN_ROWS];
const ROWS_BY_PAGE = [{ page: PAGE_ROWS[0], rows: [PROGRESS_ROW] }, ...PAGE_ROWS.slice(1).map((pg) => ({ page: pg, rows: rowsOf(pg) }))];

const pascal = (s) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
const SPEC_W = 760;
const GAP = 120;
const ROW_GAP = 360;

/** Screen registry entries for every final board and spec card. `s` is screens/index.mjs's factory. */
export function finalScreens(s, baseCss) {
  const out = {};
  for (const { page, rows } of ROWS_BY_PAGE) {
    for (const r of rows) {
      if (r.spec) out[`final-${r.key}-spec`] = s(`${r.label} · spec`, page.name, r.spec.job, (o) => specBody(r.spec, o), baseCss + SPEC_CSS);
      for (const b of r.boards) out[`final-${r.key}-${b.id}`] = s(`${r.label} · ${b.title}`, page.name, b.title, b.body, baseCss + (r.css || ''), b.extra || {});
    }
  }
  return out;
}

/** Board file stem: F<Key><Id>; the board map is the canvas's entry, Main. */
const boardName = (r, id) => (r.key === 'progress' && id === 'map' ? 'Main' : `F${pascal(r.key)}${pascal(id)}`);

/** Artboards for every page: rows stacked from y = 0 on each page, each row's spec card first, a title
 *  note over each row. Heights come from `measured` (design/src/screens/final/heights.json, written by
 *  measuring the built boards, keyed by the F<Key><Id> stem) when present. */
export function finalArtboards(measured = {}) {
  const list = [];
  ROW_NOTES.length = 0;
  for (const { page, rows } of ROWS_BY_PAGE) {
    let y = 0;
    for (const r of rows) {
      let x = 0, rowH = 0;
      const add = (name, stem, screen, w, h0, title, opts = {}) => {
        const h = Math.min(8000, Math.max(200, measured[stem] ?? h0));
        list.push({ name, screen, page: page.id, x, y, w, h, title, opts, ...(w >= 1280 ? { expand: 'fill' } : {}) });
        x += w + GAP; rowH = Math.max(rowH, h);
      };
      if (r.spec) add(`F${pascal(r.key)}Spec`, `F${pascal(r.key)}Spec`, `final-${r.key}-spec`, SPEC_W, r.specH || 1800, `${r.label} · spec`);
      for (const b of r.boards) add(boardName(r, b.id), `F${pascal(r.key)}${pascal(b.id)}`, `final-${r.key}-${b.id}`, b.w, b.h, `${r.label} · ${b.title}`, b.opts || {});
      ROW_NOTES.push({ id: `row-${r.key}`, page: page.id, x: 0, y: y - 300, kind: 'title1', maxW: Math.max(1200, x - GAP), text: r.spec?.route ? `${r.label} · ${r.spec.route.split(' · ')[0]}` : r.label });
      y += rowH + ROW_GAP;
    }
  }
  return list;
}

/** One title over each row, filled in by finalArtboards. */
const ROW_NOTES = [];

/** The guide on Start here, above the board map. */
const GUIDE = {
  id: 'note-start', page: PAGE_ROWS[0].id, x: 3120, y: 0, w: 900, size: 'l',
  text: [
    'Convexa Desk Redesign: every screen in its current, ruled design (organized 2026-10-25).',
    'Pages: ' + PAGE_ROWS.slice(1).map((pg) => `${pg.name} (${pg.blurb})`).join(' · ') + '.',
    'Each row is one screen, left to right: its spec card (purpose, where every number comes from, states, acceptance, what is built), then staging (the demo account, all sample), production where it differs, phone, light, and its states.',
    'Ruled questions, fixed issues and the earlier rounds (v2–v5 directions, audits and before/after boards) are off the canvas: the record is git, design/CHANGELOG.md and DESIGN_SYSTEM.md Amendments.',
  ].join('\n\n'),
};

/** Every note the final pages carry. Call after finalArtboards. */
export const finalNotes = () => [GUIDE, ...ROW_NOTES];
