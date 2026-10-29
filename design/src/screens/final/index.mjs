// Final · Convexa v1 (2026-10-14; one page per product area since 2026-10-25; 13 pages by app area, tethered to
// Convexa's version, since 2026-10-28): every screen in its final, ruled state. One row per screen, left to right:
// the spec card, then the row's boards (staging = the demo account, production where it differs, phone, light,
// states). Each group module exports ROWS:
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
import { ROWS as JOURNAL } from './journal.mjs';
import { PROGRESS_CSS, TRACKER_CSS, progressBoard, rowProgress, trackerBoard } from './progress.mjs';
import { CHANGELOG_CSS, CONVEXA_VERSION, SEMVER, changelogBoard, changelogModel, semverCompare } from './changelog.mjs';
import { SHIPPED_IN } from './tracker-data.mjs';

export { CONVEXA_VERSION };

/** A small count as a word, so page sentences follow their modules ("nine tools"). */
const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const count = (n) => words[n] ?? String(n);

/** The public-data tools still planned. Liquidity shipped inside Markets (2026-10-15) and sits on the Research
 *  page as a built row since 2026-10-28; its key keeps its planned- prefix, so no board file is renamed. */
const TOOLS = PLANNED.filter((r) => r.section === 'planned');
/** The journal's screens: those under Positions' tabs, and its panel in Settings (/settings#journal). */
const JOURNAL_IN_SETTINGS = JOURNAL.filter((r) => r.spec?.route?.startsWith('/settings'));
const JOURNAL_UNDER_POSITIONS = JOURNAL.length - JOURNAL_IN_SETTINGS.length;

/**
 * The canvas's pages (2026-10-28): Start here, then the app in its navigation order (Scanner · Ticker ·
 * Research · Positions · Alerts) with the pages around it, then the planned work and the unruled prototypes,
 * then the Changelog.
 * `kind`: 'built' (every row ships; each names its version in SHIPPED_IN), 'planned' (designed, not in a
 * release), 'prototype' (not ruled), 'guide' and 'log'. `nav`: the page follows a top-nav item (TopNav.tsx: Scanner,
 * Ticker, Research, Positions, Alerts); the other built pages are the pages around them. Every row sits on exactly
 * one page; the build fails otherwise. `what` is the page header's sentence; `blurb` names the page in the guide.
 */
const PAGE_ROWS = [
  { id: 'start', name: 'Start here', kind: 'guide', keys: ['progress'],
    blurb: 'the version card, this guide, the board map and the screen tracker',
    what: 'The board map (every screen by page: what’s built, and the Convexa version it first shipped in) and the screen tracker (what’s open on each screen, and why); the version card and the guide sit to their right.' },
  { id: 'scanner', name: 'Scanner', kind: 'built', nav: true, keys: ['scanner'],
    blurb: 'the ranked read of the whole universe',
    what: 'The Scanner: one dense read of the tracked universe, ranked by dealer structure, signed out and signed in.' },
  { id: 'ticker', name: 'Ticker desk', kind: 'built', nav: true, keys: ['desk', 'ai-read', 'technical', 'note'],
    blurb: 'the desk, its AI read, and the Technical and Research tabs',
    what: 'One ticker: the desk, its AI read in depth, and the Technical and Research tabs.' },
  { id: 'research', name: 'Research', kind: 'built', nav: true, keys: ['research-index', 'research-markets', 'planned-liquidity', 'research-filings', 'research-scorecard'],
    blurb: 'Notes, Markets with its Liquidity section, Filings and Scorecard',
    what: 'The Research section: the Notes index, Markets and its Liquidity section, Filings and the Scorecard. A single note (/ticker/:symbol/research, which the nav also lights as Research) is on Ticker desk, as the ticker’s Research tab.' },
  { id: 'positions', name: 'Positions & alerts', kind: 'built', nav: true, keys: ['positions', 'alerts'],
    blurb: 'the simulated book, and alerts on public data',
    what: 'Positions, the simulated book and how past decisions closed, and Alerts on public sources.' },
  { id: 'account', name: 'Settings & operator', kind: 'built', keys: ['settings', 'operator'],
    blurb: 'Settings, and the operator’s unlinked pages',
    what: 'Settings, and the operator’s two unlinked pages: the bundle’s stage timings and the stored session books.' },
  { id: 'overlays', name: 'Dialogs & overlays', kind: 'built', keys: ['dialogs', 'overlays'],
    blurb: 'every dialog, drawer and sheet',
    what: 'Every dialog, drawer and sheet that opens over a page, on a phone as a bottom sheet.' },
  { id: 'site', name: 'Public site', kind: 'built', keys: ['landing', 'methodology', 'blog', 'credits', 'privacy', 'terms', 'not-found'],
    blurb: 'landing, methodology, blog, sources and credits, privacy, terms and the 404',
    what: 'The public pages: landing, methodology, the blog, data sources and credits, privacy, terms, and the 404 with the route fallback.' },
  { id: 'system', name: 'Shell & foundations', kind: 'built', keys: ['shell', 'foundations', 'library'],
    blurb: 'the shell, data states and charts, and the token and component library',
    what: 'The global shell around every page, the foundations every screen keeps (data states, the chart system, third-party frames), and the token and component library.' },
  { id: 'journal', name: 'Planned · Trade journal', kind: 'planned', keys: JOURNAL.map((r) => r.key),
    blurb: `spec 08: ${count(JOURNAL_UNDER_POSITIONS)} screens under Positions, and its panel in Settings`,
    what: `The trade journal (spec 08): ${count(JOURNAL_UNDER_POSITIONS)} screens under Positions’ tabs, from the timeline on, and its panel in Settings.`,
    release: 'Designed but in no Convexa release yet' },
  { id: 'tools', name: 'Planned · Public-data tools', kind: 'planned', keys: TOOLS.map((r) => r.key),
    blurb: `the ${count(TOOLS.length)} planned tools from public data`,
    what: `The ${count(TOOLS.length)} planned tools from public data, each with its spec card. Liquidity, which shipped inside Markets, is on the Research page.`,
    release: 'Designed but in no Convexa release yet as screens of their own (parts of several already ship inside their host pages; the board map shows how much)' },
  { id: 'prototypes', name: 'Prototypes · not ruled', kind: 'prototype', keys: ['prototypes'],
    blurb: 'F2, a year of the curve, and F3, calibration',
    what: 'Two v5 frontier prototypes the owner has not ruled on, F2 (a year of the Treasury curve) and F3 (calibration you can question), each board drawing its designed fallback; the prototypes run in design/site.',
    release: 'Designed but in no Convexa release yet' },
  { id: 'changelog', name: 'Changelog', kind: 'log', keys: ['changelog'],
    blurb: 'design changes up to each Convexa version',
    what: 'Every design/CHANGELOG.md entry, newest first, as the design changes up to each Convexa version. A change up to a version is in the canvas that version’s tag builds; it doesn’t say the screen it draws ships (the planned pages say which don’t).' },
];
export const FINAL_PAGES = PAGE_ROWS.map(({ id, name }) => ({ id, name }));
/** Kept for imports that still name one page: the entry page. */
export const FINAL_PAGE = FINAL_PAGES[0];

/** Rows whose boards come from the wider screen registry, not a Final row module. Their heights are set here
 *  (heights.mjs measures only finalArtboards()), and each sits last on its page.
 *  - The library (tokens, type, controls, data, chrome, overlays, patterns, states, charts, motion, React
 *    mapping) is generated from tokens.json and src/components, so it stays current; a frame caps at 8,000px,
 *    so it is three boards.
 *  - Two v5 frontier prototypes the owner has not ruled on (F1, the dealer-gamma surface, shipped as the landing
 *    hero). The boards draw each one's designed fallback; the prototype runs in design/site. */
const EXTRA_ROWS = [
  {
    key: 'library', label: 'Library', extra: true, title: 'Library · tokens, components and their React mapping',
    boards: [
      ['Library', 6240, 'Library · 1 of 3 · tokens, type, controls, data', 1],
      ['LibraryB', 4750, 'Library · 2 of 3 · chrome, overlays, patterns, states, charts, motion', 2],
      ['LibraryC', 3970, 'Library · 3 of 3 · React mapping', 3],
    ].map(([name, h, title, part]) => ({ name, screen: 'library', w: 1440, h, title, opts: { dataStates: 'summary', charts: 'summary', part } })),
  },
  {
    key: 'prototypes', label: 'Prototypes', extra: true, title: 'F2, a year of the curve · F3, calibration you can question',
    boards: [
      { name: 'V5FrontierCurve', screen: 'v5-frontier-curve', w: 1440, h: 2460, title: 'Prototype F2 · a year of the curve · fallback shown (runs in design/site/v5-frontier-curve.html)' },
      { name: 'V5FrontierCalib', screen: 'v5-frontier-calibration', w: 1440, h: 1880, title: 'Prototype F3 · calibration, explorable · fallback shown (runs in design/site/v5-frontier-calibration.html)' },
    ],
  },
];

const SCREEN_ROWS = [...FOUNDATIONS, ...SHELL_SITE, ...TICKER, ...RESEARCH, ...ACCOUNT, ...TRUST, ...DEEP, ...PLANNED, ...JOURNAL];

function fail(msg) { throw new Error(msg); }

/** The groups of the board map and the tracker: each page's screens (rows with a spec card), in page order. */
const screenGroups = () =>
  PAGE_ROWS.filter((pg) => pg.kind === 'built' || pg.kind === 'planned')
    .map((pg) => ({ label: pg.name, rows: pg.keys.map((k) => SCREEN_ROWS.find((r) => r.key === k)).filter((r) => r?.spec) }))
    .filter((g) => g.rows.length);

/** The first row: the board map and the tracker, generated from every screen's spec card (progress.mjs). */
const PROGRESS_ROW = {
  key: 'progress',
  label: 'Board map',
  css: PROGRESS_CSS + TRACKER_CSS,
  boards: [
    { id: 'map', title: 'What’s built', w: 1440, h: 3200, body: progressBoard(screenGroups(), { version: CONVEXA_VERSION }) },
    { id: 'tracker', title: 'Screen tracker', w: 1440, h: 6000, body: trackerBoard(screenGroups(), { version: CONVEXA_VERSION }) },
  ],
};

/** The last row: design/CHANGELOG.md by Convexa version (changelog.mjs). Not a screen, so no spec card, and it
 *  stays off the board map and the tracker. */
const CHANGELOG_ROW = {
  key: 'changelog',
  label: 'Changelog',
  css: CHANGELOG_CSS,
  boards: [{ id: 'entries', title: 'Design changelog', w: 1440, h: 2600, body: changelogBoard() }],
};

const ALL_ROWS = [PROGRESS_ROW, ...SCREEN_ROWS, ...EXTRA_ROWS, CHANGELOG_ROW];

// ---- Checks: every row on exactly one page, and every built row's version -----------------------------------
/** Convexa's first release; no row can have shipped before it. */
const FIRST_RELEASE = '1.0.0';
/** A release version: MAJOR.MINOR.PATCH, with no prerelease or build suffix. */
const RELEASE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const rowOf = (pg, k) => ALL_ROWS.find((r) => r.key === k) ?? fail(`page ${pg.id}: no row ${k}`);
const ROWS_BY_PAGE = PAGE_ROWS.map((pg) => ({ page: pg, rows: pg.keys.map((k) => rowOf(pg, k)) }));
{
  const placed = ROWS_BY_PAGE.flatMap((x) => x.rows);
  const keys = ALL_ROWS.map((r) => r.key);
  for (const k of keys) if (keys.indexOf(k) !== keys.lastIndexOf(k)) fail(`two rows have the key ${k}`);
  for (const r of ALL_ROWS) if (placed.filter((x) => x === r).length !== 1) fail(`row ${r.key} must sit on exactly one canvas page (PAGE_ROWS)`);
  for (const { page, rows } of ROWS_BY_PAGE) {
    rows.forEach((r, i) => {
      // Planned rows sit on the planned pages only, and the planned pages hold nothing else.
      if ((r.section === 'planned') !== (page.kind === 'planned')) fail(`row ${r.key}: ${r.section === 'planned' ? 'a planned row' : 'a row that is not planned'} on ${page.kind} page ${page.id}`);
      // A screen whose own items have all shipped is Built on the board map, so it can't sit on a planned page,
      // whose rows read Planned (Liquidity did until 2026-10-28: Built, 5/5 shipped, Planned).
      if (page.kind === 'planned' && r.spec && rowProgress(r).status === 'built') fail(`row ${r.key} is Built (every item on its card shipped) but sits on planned page ${page.id}: move it to a built page and give it a SHIPPED_IN version`);
      // The registry rows are laid out under the page's Final rows, so they come last.
      if (r.extra && rows.slice(i + 1).some((x) => !x.extra)) fail(`row ${r.key} must come last on page ${page.id}`);
      // SHIPPED_IN (tracker-data.mjs): every row on a built page names its version; nothing else does.
      const v = SHIPPED_IN[r.key];
      if (page.kind === 'built' && v === undefined) fail(`row ${r.key} sits on built page ${page.id} but has no SHIPPED_IN version (tracker-data.mjs)`);
      if (page.kind !== 'built' && v !== undefined) fail(`row ${r.key} sits on ${page.kind} page ${page.id} but has a SHIPPED_IN version (${v})`);
    });
  }
  for (const [k, v] of Object.entries(SHIPPED_IN)) {
    if (!keys.includes(k)) fail(`SHIPPED_IN names ${k}, which is no row`);
    if (typeof v !== 'string' || !SEMVER.test(v)) fail(`SHIPPED_IN ${k}: ${JSON.stringify(v)} is not SemVer`);
    // A release, never a prerelease or a build: 1.0.0-rc.1 and 1.0.0+x are versions no user ran.
    if (!RELEASE.test(v)) fail(`SHIPPED_IN ${k}: ${v} has a prerelease or build suffix; a row ships in a release (MAJOR.MINOR.PATCH)`);
    if (semverCompare(v, FIRST_RELEASE) < 0) fail(`SHIPPED_IN ${k}: ${v} is before ${FIRST_RELEASE}, Convexa's first release`);
    if (semverCompare(v, CONVEXA_VERSION) > 0) fail(`SHIPPED_IN ${k}: ${v} is after Convexa ${CONVEXA_VERSION} (root package.json)`);
  }
}

/** Every row the canvas draws from a Final module, in page order (the registry rows excluded). */
export const FINAL_ROWS = ROWS_BY_PAGE.flatMap((x) => x.rows).filter((r) => !r.extra);

const pascal = (s) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
const SPEC_W = 760;
const GAP = 120;
const ROW_GAP = 360;

/** A spec card's eyebrow: the release the row first shipped in (SHIPPED_IN, set once, so "since"), or Planned. */
const specEyebrow = (r, page) => (SHIPPED_IN[r.key] ? `Spec · since Convexa ${SHIPPED_IN[r.key]}` : page.kind === 'planned' ? 'Spec · Planned' : 'Spec');

/** Screen registry entries for every final board and spec card. `s` is screens/index.mjs's factory. */
export function finalScreens(s, baseCss) {
  const out = {};
  for (const { page, rows } of ROWS_BY_PAGE) {
    for (const r of rows) {
      if (r.extra) continue;
      const eyebrow = specEyebrow(r, page);
      if (r.spec) out[`final-${r.key}-spec`] = s(`${r.label} · spec`, page.name, r.spec.job, (o) => specBody(r.spec, { ...o, eyebrow }), baseCss + SPEC_CSS);
      for (const b of r.boards) out[`final-${r.key}-${b.id}`] = s(`${r.label} · ${b.title}`, page.name, b.title, b.body, baseCss + (r.css || ''), b.extra || {});
    }
  }
  return out;
}

/** Board file stem: F<Key><Id>; the board map is the canvas's entry, Main. */
const boardName = (r, id) => (r.key === 'progress' && id === 'map' ? 'Main' : `F${pascal(r.key)}${pascal(id)}`);

/** A row's title: its label and first route, then the release a built row first shipped in. SHIPPED_IN is set once,
 *  so it reads "since": after a bump the page header names the newer version the canvas shows. */
const rowTitle = (r) => {
  const base = r.extra ? r.title : r.spec?.route ? `${r.label} · ${r.spec.route.split(' · ')[0]}` : r.label;
  return SHIPPED_IN[r.key] ? `${base} · since Convexa ${SHIPPED_IN[r.key]}` : base;
};

/** A frame caps at 8,000px (the Design type). A board measured taller fails the build rather than being cut off. */
const FRAME_MAX = 8000;

/** Rows stacked from y = 0 on each page, each row's spec card first, a title note 300px over each row. Heights
 *  come from `measured` (heights.json, keyed by the F<Key><Id> stem) when present; the registry rows keep theirs. */
function layout(measured) {
  const boards = [];
  const titles = [];
  for (const { page, rows } of ROWS_BY_PAGE) {
    let y = 0;
    for (const r of rows) {
      let x = 0, rowH = 0;
      const add = (a) => {
        boards.push({ ...a, page: page.id, x, y, ...(a.w >= 1280 ? { expand: 'fill' } : {}) });
        x += a.w + GAP; rowH = Math.max(rowH, a.h);
      };
      const fit = (stem, h0) => {
        const h = measured[stem] ?? h0;
        if (h > FRAME_MAX) fail(`${stem}: its height ${h} is over the ${FRAME_MAX}px frame cap (heights.json): split the board, or the canvas cuts its bottom off`);
        return Math.max(200, h);
      };
      if (r.extra) for (const b of r.boards) add({ name: b.name, screen: b.screen, w: b.w, h: b.h, title: b.title, opts: b.opts || {}, extra: true });
      else {
        if (r.spec) add({ name: `F${pascal(r.key)}Spec`, screen: `final-${r.key}-spec`, w: SPEC_W, h: fit(`F${pascal(r.key)}Spec`, r.specH || 1800), title: `${r.label} · spec`, opts: {} });
        for (const b of r.boards) add({ name: boardName(r, b.id), screen: `final-${r.key}-${b.id}`, w: b.w, h: fit(`F${pascal(r.key)}${pascal(b.id)}`, b.h), title: `${r.label} · ${b.title}`, opts: b.opts || {} });
      }
      titles.push({ id: `row-${r.key}`, page: page.id, x: 0, y: y - 300, kind: 'title1', maxW: Math.max(1200, x - GAP), text: rowTitle(r) });
      y += rowH + ROW_GAP;
    }
  }
  return { boards, titles };
}

/** Artboards for every Final row (what heights.mjs measures): the registry rows are left out. */
export function finalArtboards(measured = {}) {
  return layout(measured).boards.filter((a) => !a.extra);
}

// ---- Notes: a header on every page, the version card and the guide on Start here ---------------------------

const HOW_TO_READ = 'Read each row left to right: the spec card, then staging, production where it differs, phone, light and states.';
/** A page header: the page's name, one sentence of what's on it, and the Convexa version the canvas shows. */
function headerText(pg) {
  const v = `Convexa ${CONVEXA_VERSION}`;
  if (pg.kind === 'built') return `${pg.name} · ${v}\n\n${pg.what}\n\n${HOW_TO_READ}`;
  if (pg.kind === 'planned') return `${pg.name}\n\n${pg.what} ${pg.release}; this canvas shows ${v}.\n\n${HOW_TO_READ}`;
  if (pg.kind === 'prototype') return `${pg.name}\n\n${pg.what} ${pg.release}; this canvas shows ${v}.`;
  return `${pg.name} · ${v}\n\n${pg.what}`;
}

/** The version card's text. With the publish step's stamp (emit-project.mjs) it states the release status, the
 *  commit and the date; the committed canvas says the publish step adds them. */
export function versionCardText(stamp = null) {
  return stamp
    ? `${stamp}\n\nThe version this canvas shows (the root package.json’s), stamped from git when it was published.`
    : `Convexa ${CONVEXA_VERSION}\n\nThe version this canvas shows (the root package.json’s). The publish step adds the commit, the date and the release status.`;
}

const pageList = (pick) => PAGE_ROWS.filter(pick).map((pg) => `${pg.name} (${pg.blurb})`).join(' · ');
const GUIDE_TEXT = [
  `Convexa Desk Redesign: every screen of Convexa in its current, ruled design, on ${PAGE_ROWS.length} pages (organized by app area 2026-10-28).`,
  `Pages: the app in its navigation order, ${pageList((pg) => pg.nav)}; then the pages around it, ${pageList((pg) => pg.kind === 'built' && !pg.nav)}; then the planned work and the unruled prototypes, ${pageList((pg) => pg.kind === 'planned' || pg.kind === 'prototype')}; and ${pageList((pg) => pg.kind === 'log')}.`,
  'Each row is one screen, left to right: its spec card (purpose, where every number comes from, states, acceptance, what is built), then staging (the demo account, all sample), production where it differs, phone, light, and its states.',
  `Versions: each release of Convexa has a version, the root package.json’s (the first, 1.0.0, is the first push after 2026-10-28), and the version card states the version and commit this canvas shows. Each built row’s title and spec card name the version it first shipped in (“since Convexa 1.0.0”), and the Changelog page lists the design changes up to each version. To see the design as of any release, build design/ at its tag (a worktree at v${CONVEXA_VERSION}, then node design/src/build.mjs there).`,
  'Ruled questions, fixed issues and the earlier rounds (v2–v5 directions, audits and before/after boards) are off the canvas: the record is git, design/CHANGELOG.md and DESIGN_SYSTEM.md Amendments.',
].join('\n\n');

// Sticky notes grow up to 4/3 of their width (the Design type), so each keeps that box clear: a page header
// ends 40px above its page's first row title (y = -300), and Start here's version card and guide sit right of
// its row, side by side, where the canvas is empty.
const HEADER = { w: 800, size: 'l' };
const VERSION_CARD = { w: 1600, size: 'xl' };
const GUIDE = { w: 1500, size: 'l' };
const stickyH = (w) => Math.ceil((w * 4) / 3);

/** The Changelog board grows with design/CHANGELOG.md, one line or two per entry, so its height is measured at an
 *  entry count, recorded beside it in heights.json. A different count fails the build rather than clipping the
 *  oldest entries: re-measure the board (design/README.md, "When you append to CHANGELOG.md"). */
const CL_STEM = 'FChangelogEntries';
const CL_COUNT = `${CL_STEM}.entries`;
function checkChangelogHeight(measured) {
  if (measured[CL_STEM] === undefined) return;
  const n = changelogModel().entries;
  if (measured[CL_COUNT] !== n) fail(`${CL_STEM} was measured at ${measured[CL_COUNT] ?? 'an unrecorded number of'} entries, and design/CHANGELOG.md has ${n}: run node tmp/journal-boards/heights.mjs --only '^${CL_STEM}$' --write, set "${CL_COUNT}": ${n} in heights.json, and build again`);
}

/** Every artboard and note for the canvas. `notes(stamp)` puts the publish stamp on the version card. */
export function canvasLayout(measured = {}) {
  checkChangelogHeight(measured);
  const { boards, titles } = layout(measured);
  const startRight = Math.max(...boards.filter((a) => a.page === PAGE_ROWS[0].id).map((a) => a.x + a.w)) + GAP;
  const headers = PAGE_ROWS.map((pg) => ({ id: `page-${pg.id}`, page: pg.id, x: 0, y: -300 - 40 - stickyH(HEADER.w), w: HEADER.w, size: HEADER.size, text: headerText(pg) }));
  const notes = (stamp = null) => [
    { id: 'version', page: PAGE_ROWS[0].id, x: startRight, y: 0, w: VERSION_CARD.w, size: VERSION_CARD.size, text: versionCardText(stamp) },
    { id: 'note-start', page: PAGE_ROWS[0].id, x: startRight + VERSION_CARD.w + GAP, y: 0, w: GUIDE.w, size: GUIDE.size, text: GUIDE_TEXT },
    ...headers,
    ...titles,
  ];
  return { boards, notes };
}
