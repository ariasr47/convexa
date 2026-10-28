import { readFileSync, existsSync } from 'node:fs';
import { CONVEXA_VERSION, FINAL_PAGES, canvasLayout } from './screens/final/index.mjs';
// Canvas registry — which screens become artboards, at which widths, on which page.
//
// Since 2026-10-25 the canvas holds only the current, ruled design. Since 2026-10-28 it has 13 pages by app area
// (screens/final/index.mjs PAGE_ROWS): Start here, the app in its navigation order, the two planned pages, the
// unruled prototypes and the Changelog, and it states Convexa's version (the root package.json's). The earlier
// rounds (the v2 pages, v4 · Data states / Tools / App / Research / Coverage, v5 · Charts / Families / Frontier,
// the Q-5 alerts page, Directions B and C) left the canvas; their screen modules still build the static site,
// and git and design/CHANGELOG.md keep the record.
export { CONVEXA_VERSION };
export const pages = FINAL_PAGES;

const FINAL_HEIGHTS_FILE = new URL('./screens/final/heights.json', import.meta.url);
const FINAL_HEIGHTS = existsSync(FINAL_HEIGHTS_FILE) ? JSON.parse(readFileSync(FINAL_HEIGHTS_FILE, 'utf8')) : {};

// Every page's rows, laid out in screens/final/index.mjs: the Final rows, then the library (under Shell &
// foundations) and the two prototypes (their own page), whose boards come from the wider screen registry.
const LAYOUT = canvasLayout(FINAL_HEIGHTS);

// { name, screen, page, x, y, w, h, title, opts?, expand? }
export const artboards = LAYOUT.boards;

/** Every note: the version card and the guide on Start here, a header on each page, a title over each row. */
export const annotations = LAYOUT.notes();

/** Every artboard carries its own x/y (screens/final lays the rows out per page). */
export function layout() {
  return artboards.map((a) => ({ ...a }));
}

/** The canvas index. `stamp` is the publish step's line for the version card (emit-project.mjs); the
 *  committed design/canvas/canvas.json has none, so its card says what the publish step adds. */
export function canvasJson({ stamp = null } = {}) {
  return {
    pages,
    artboards: layout().map(({ name, screen, page, w, h, title, expand, x, y }) => ({
      file: `${name}.dc.html`, title, x, y, w, h, page,
      ...(screen === 'desk' ? { is_interactive: true } : {}),
      ...(expand ? { expand } : {}),
    })),
    annotations: LAYOUT.notes(stamp).map(({ id, ...n }) => ({ id, ...n, x: n.x ?? 0, y: n.y ?? -150 })),
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
 *  id. Same pages, positions, titles and notes as canvasJson({ stamp }). */
export function canvasIndexV3({ stamp = null } = {}) {
  const legacy = canvasJson({ stamp });
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
