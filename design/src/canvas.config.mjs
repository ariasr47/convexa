import { readFileSync, existsSync } from 'node:fs';
import { FINAL_PAGES, finalArtboards, finalNotes } from './screens/final/index.mjs';
// Canvas registry — which screens become artboards, at which widths, on which page.
//
// Since 2026-10-25 the canvas holds only the current, ruled design: one page per product area (the final
// rows, screens/final/index.mjs) plus the token and component library on Foundations and two unruled
// prototypes on Planned. The earlier rounds
// (the v2 pages, v4 · Data states / Tools / App / Research / Coverage, v5 · Charts / Families / Frontier,
// the Q-5 alerts page, Directions B and C) left the canvas; their screen modules still build the static
// site, and git and design/CHANGELOG.md keep the record.
export const pages = FINAL_PAGES;

const FINAL_HEIGHTS_FILE = new URL('./screens/final/heights.json', import.meta.url);
const FINAL_HEIGHTS = existsSync(FINAL_HEIGHTS_FILE) ? JSON.parse(readFileSync(FINAL_HEIGHTS_FILE, 'utf8')) : {};

const FINAL = finalArtboards(FINAL_HEIGHTS);

/** A row of extra boards under everything already on `page`: 120px apart, its title note above. */
const EXTRA_NOTES = [];
function rowUnder(page, placed, boards, title) {
  const y = Math.max(...placed.filter((a) => a.page === page).map((a) => a.y + a.h)) + 360;
  let x = 0;
  const row = boards.map((b) => { const a = { page, x, y, expand: 'fill', ...b }; x += b.w + 120; return a; });
  EXTRA_NOTES.push({ id: `row-${row[0].name}`, page, x: 0, y: y - 300, kind: 'title1', maxW: x - 120, text: title });
  return row;
}

// The library (tokens, type, controls, data, chrome, overlays, patterns, states, charts, motion, React
// mapping) is generated from tokens.json and src/components, so it stays current; a frame caps at 8,000px,
// so it is three boards. It sits under the Foundations row.
const LIBRARY = rowUnder('foundations', FINAL, [
  ['Library', 6240, 'Library · 1 of 3 · tokens, type, controls, data', 1],
  ['LibraryB', 4750, 'Library · 2 of 3 · chrome, overlays, patterns, states, charts, motion', 2],
  ['LibraryC', 3970, 'Library · 3 of 3 · React mapping', 3],
].map(([name, h, title, part]) => ({ name, screen: 'library', w: 1440, h, title, opts: { dataStates: 'summary', charts: 'summary', part } })), 'Library · tokens, components and their React mapping');

// Two v5 frontier prototypes the owner has not ruled on (F1, the dealer-gamma surface, shipped as the
// landing hero). The boards draw each one's designed fallback; the prototype runs in design/site.
const PROTOTYPES = rowUnder('planned', FINAL, [
  { name: 'V5FrontierCurve', screen: 'v5-frontier-curve', w: 1440, h: 2460, title: 'Prototype F2 · a year of the curve · fallback shown (runs in design/site/v5-frontier-curve.html)' },
  { name: 'V5FrontierCalib', screen: 'v5-frontier-calibration', w: 1440, h: 1880, title: 'Prototype F3 · calibration, explorable · fallback shown (runs in design/site/v5-frontier-calibration.html)' },
], 'Prototypes · not ruled: a year of the curve (F2), calibration you can question (F3)');

// { name, screen, page, x, y, w, h, title, opts?, expand? }
export const artboards = [...FINAL, ...LIBRARY, ...PROTOTYPES];

export const annotations = [...finalNotes(), ...EXTRA_NOTES];

/** Every artboard carries its own x/y (screens/final lays the rows out per page). */
export function layout() {
  return artboards.map((a) => ({ ...a }));
}

export function canvasJson() {
  return {
    pages,
    artboards: layout().map(({ name, screen, page, w, h, title, expand, x, y }) => ({
      file: `${name}.dc.html`, title, x, y, w, h, page,
      ...(screen === 'desk' ? { is_interactive: true } : {}),
      ...(expand ? { expand } : {}),
    })),
    annotations: annotations.map(({ id, ...n }) => ({ id, ...n, x: n.x ?? 0, y: n.y ?? -150 })),
    launch: { view: 'canvas', page: pages[0].id },
  };
}

// ---- The editable canvas, from v5 on (2026-10-13) ---------------------------------------------
// A canvas made from the Design artifact type keeps one file per board (`project/<name>.dc.html`) plus
// the index `project/canvas.json` (format v3), so size is per file, not per page. The v2–v4 canvas
// (artifact 82be651e, one self-contained 13.5 MB page) and the research canvas stay as history.
export const CANVAS_URL = 'https://claude.ai/artifact/3ooV24ayHwh52t3qAhFiBe';
export const CANVAS_TITLE = 'Convexa Desk Redesign';
// Written once when the index was first created on files; the type asks that it never change after.
export const CREATED_ON_FILES = { v: 1, at: '2026-10-14T04:05:17Z' };

/** The v3 index for the files-based canvas: boards keyed by file, `order` back to front, notes keyed by
 *  id. Same pages, positions, titles and notes as canvasJson(). */
export function canvasIndexV3() {
  const legacy = canvasJson();
  const boards = {};
  for (const a of legacy.artboards) {
    const { file, ...rest } = a;
    boards[file] = rest;
  }
  const notes = {};
  for (const n of legacy.annotations) {
    const { id, ...rest } = n;
    if (notes[id]) throw new Error(`duplicate note id ${id}`);
    notes[id] = rest;
  }
  const ids = Object.keys(notes);
  if (ids.length > 200) throw new Error(`canvas notes ${ids.length} > 200 (type limit)`);
  if (legacy.pages.length > 40) throw new Error(`canvas pages ${legacy.pages.length} > 40 (type limit)`);
  for (const id of [...ids, ...legacy.pages.map((p) => p.id)]) if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new Error(`bad id ${id}`);
  for (const [f, b] of Object.entries(boards)) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.dc\.html$/.test(f)) throw new Error(`bad board file ${f}`);
    if (b.w < 40 || b.w > 8000 || b.h < 40 || b.h > 8000) throw new Error(`${f}: frame ${b.w}x${b.h} outside 40–8000`);
  }
  return {
    v: 3,
    createdOnFiles: CREATED_ON_FILES,
    title: CANVAS_TITLE,
    launch: legacy.launch,
    pages: legacy.pages,
    boards,
    // Back-to-front draw order; the entry board (the board map) first.
    order: ['Main.dc.html', ...legacy.artboards.map((a) => a.file).filter((f) => f !== 'Main.dc.html')],
    notes,
    designSystems: [],
  };
}
