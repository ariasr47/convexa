// Final · Convexa v1 (2026-10-14): one canvas page with every screen in its final, ruled state.
// One row per screen, left to right: the spec card, then the row's boards (staging = the demo account,
// production where it differs, phone, light, states). Each group module exports ROWS:
//   { key, label, css, specH?, spec, boards: [{ id, title, w, h, body: (opts) => html, opts?, extra? }] }
// Board files are named F<Key><Id> (PascalCase), the spec card F<Key>Spec.
import { SPEC_CSS, specBody } from './spec.mjs';
import { ROWS as FOUNDATIONS } from './foundations.mjs';
import { ROWS as SHELL_SITE } from './shell-site.mjs';
import { ROWS as TICKER } from './ticker.mjs';
import { ROWS as RESEARCH } from './research.mjs';
import { ROWS as ACCOUNT } from './account.mjs';
import { ROWS as TRUST } from './trust.mjs';
import { ROWS as DEEP } from './deep.mjs';
import { ROWS as PLANNED } from './planned.mjs';

export const FINAL_PAGE = { id: 'final', name: 'Final · Convexa v1' };

/** Rows added later name the row they follow (`after: '<key>'`); `section: 'planned'` rows go last,
 *  under their own title, because they are designed but not built. */
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
export const FINAL_ROWS = assemble([...FOUNDATIONS, ...SHELL_SITE, ...TICKER, ...RESEARCH, ...ACCOUNT], [...TRUST, ...DEEP, ...PLANNED]);

const pascal = (s) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
const SPEC_W = 760;
const GAP = 120;
const ROW_GAP = 360;

/** Screen registry entries for every final board and spec card. `s` is screens/index.mjs's factory. */
export function finalScreens(s, baseCss) {
  const out = {};
  for (const r of FINAL_ROWS) {
    if (r.spec) out[`final-${r.key}-spec`] = s(`${r.label} · spec`, FINAL_PAGE.name, r.spec.job, (o) => specBody(r.spec, o), baseCss + SPEC_CSS);
    for (const b of r.boards) out[`final-${r.key}-${b.id}`] = s(`${r.label} · ${b.title}`, FINAL_PAGE.name, b.title, b.body, baseCss + (r.css || ''), b.extra || {});
  }
  return out;
}

/** Artboards for the page: rows stacked, each row's spec card first. Heights come from `measured`
 *  (design/src/screens/final/heights.json, written by measuring the built boards) when present. */
export function finalArtboards(measured = {}) {
  const list = [];
  let y = 0;
  let planned = false;
  for (const r of FINAL_ROWS) {
    if (r.section === 'planned' && !planned) { planned = true; PLANNED_NOTE.y = y + 200; y += 900; }
    let x = 0, rowH = 0;
    const add = (name, screen, w, h0, title, opts = {}) => {
      const h = Math.min(8000, Math.max(200, measured[name] ?? h0));
      list.push({ name, screen, page: FINAL_PAGE.id, x, y, w, h, title, opts, ...(w >= 1280 ? { expand: 'fill' } : {}) });
      x += w + GAP; rowH = Math.max(rowH, h);
    };
    if (r.spec) add(`F${pascal(r.key)}Spec`, `final-${r.key}-spec`, SPEC_W, r.specH || 1800, `Final · ${r.label} · spec`);
    for (const b of r.boards) add(`F${pascal(r.key)}${pascal(b.id)}`, `final-${r.key}-${b.id}`, b.w, b.h, `Final · ${r.label} · ${b.title}`, b.opts || {});
    y += rowH + ROW_GAP;
  }
  return list;
}

export const FINAL_NOTE = {
  id: 'note-final', page: FINAL_PAGE.id, x: 0, y: -460, w: 1100,
  text: 'Final · Convexa v1 (2026-10-14). The whole app in its ruled state, one row per screen: the spec card (purpose, every widget’s data source, production vs staging, every state in its words, phone, acceptance, build status, rulings, code), then staging (the demo account: signed in, all sample), production where it differs (no mocks; what needs the Massive options feed shows Not live), phone, light and states. Carries P-1–P-4, P-6, P-8–P-15 and the 2026-10-14 environment rulings. The earlier pages stay as history.',
};

/** Title over the Planned section; its y is set when the rows are laid out. */
export const PLANNED_NOTE = {
  id: 'note-final-planned', page: FINAL_PAGE.id, x: 0, y: 0, kind: 'title1', maxW: 4000,
  text: 'Planned · designed, not built — the public-data tools from docs/public-data/CANDIDATES.md',
};
