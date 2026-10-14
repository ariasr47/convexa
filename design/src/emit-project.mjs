// Publish step beside build.mjs: lays the built boards out as the files-based canvas expects them.
//   <out>/project/canvas.json        the v3 index (every page, board and note)
//   <out>/project/<Name>.dc.html     one file per board, copied from design/canvas/
//   <out>/batches.json               publish batches within the per-call limits (≤ 255 files, ≤ 60 MB)
// Run after build: node design/src/emit-project.mjs <out-folder> [--changed <prev-out-folder>]
// The out folder must sit where the publishing tool may read it (the main tree's gitignored tmp/).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canvasIndexV3 } from './canvas.config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CANVAS = join(here, '..', 'canvas');
const out = process.argv[2];
if (!out) { console.error('usage: node design/src/emit-project.mjs <out-folder>'); process.exit(2); }
const proj = join(out, 'project');
mkdirSync(proj, { recursive: true });

const index = canvasIndexV3();
const files = Object.keys(index.boards);
const missing = files.filter((f) => !existsSync(join(CANVAS, f)));
if (missing.length) { console.error('boards missing from design/canvas: ' + missing.join(', ')); process.exit(1); }
const extra = readdirSync(CANVAS).filter((f) => f.endsWith('.dc.html') && !index.boards[f]);
if (extra.length) { console.error('boards on disk but not in the index: ' + extra.join(', ')); process.exit(1); }
if (index.order[0] !== 'Main.dc.html') { console.error('the entry board Main.dc.html must come first in order'); process.exit(1); }

const json = JSON.stringify(index, null, 2) + '\n';
const prevIndex = existsSync(join(proj, 'canvas.json')) ? readFileSync(join(proj, 'canvas.json'), 'utf8') : null;
writeFileSync(join(proj, 'canvas.json'), json);
const changed = [];
for (const f of files) {
  const src = join(CANVAS, f), dst = join(proj, f);
  const next = readFileSync(src);
  if (next.includes(0)) { console.error(`${f}: NUL byte`); process.exit(1); }
  const same = existsSync(dst) && Buffer.compare(readFileSync(dst), next) === 0;
  if (!same) { copyFileSync(src, dst); changed.push(f); }
}
// Batches: the index and the entry board go first (the type renders the canvas from them), then the rest.
const MAX_FILES = 250, MAX_BYTES = 60e6;
const rest = files.filter((f) => f !== 'Main.dc.html');
const batches = [['project/canvas.json', 'project/Main.dc.html']];
let cur = [], bytes = 0;
for (const f of rest) {
  const b = statSync(join(proj, f)).size;
  if (cur.length + 1 > MAX_FILES || bytes + b > MAX_BYTES) { batches.push(cur); cur = []; bytes = 0; }
  cur.push(`project/${f}`); bytes += b;
}
if (cur.length) batches.push(cur);
const total = files.reduce((s, f) => s + statSync(join(proj, f)).size, 0) + Buffer.byteLength(json);
const largest = files.map((f) => [f, statSync(join(proj, f)).size]).sort((a, b) => b[1] - a[1])[0];
writeFileSync(join(out, 'batches.json'), JSON.stringify({ batches, changed: changed.map((f) => `project/${f}`), indexChanged: prevIndex !== json }, null, 2) + '\n');
console.log(`project: ${files.length} boards + canvas.json (${(total / 1e6).toFixed(2)} MB; largest ${largest[0]} ${(largest[1] / 1e3).toFixed(0)} kB); ${Object.keys(index.notes).length} notes, ${index.pages.length} pages; ${changed.length} board files changed, index ${prevIndex === json ? 'unchanged' : 'changed'}; ${batches.length} publish batches → ${out}`);
