// Publish step beside build.mjs: renders every board from the committed source as the files-based canvas expects
// them, and stamps the version card with what this canvas shows.
//   <out>/project/canvas.json        the v3 index (every page, board and note; the version card stamped)
//   <out>/project/<Name>.dc.html     one file per board, rendered from design/src now (boards.mjs), not copied from
//                                    design/canvas/ (2026-10-28: a copy published whatever build was committed, stale
//                                    or not, and a Changelog board that predated the release tag under a stamp that
//                                    named it)
//   <out>/batches.json               publish batches within the per-call limits (≤ 255 files, ≤ 60 MB), the boards
//                                    changed since the out folder's last emit, the boards that differ from the
//                                    committed design/canvas/, and the stamp
// Run once the build is committed: node design/src/emit-project.mjs <out-folder> [--allow-dirty]
// The out folder must sit where the publishing tool may read it (the main tree's gitignored tmp/).
//
// The stamp (2026-10-28), on the emitted index only (design/canvas/canvas.json keeps the card's committed text):
//   Convexa <version> · <release status> · built from <branch> @ <short sha>, <commit date> · <n> commits not yet on origin/main
// The release status comes from git describe --tags --match 'v[0-9]*': "released as v<version>" when HEAD is that
// tag's commit, "<n> commits after <tag>" past a tag, and "not released yet (no v<version> tag)" while the package
// version has no tag. The Changelog board is rendered in the same run, so it groups its entries by the same tags.
// It refuses (exit 1, one line) when git status --porcelain -- design package.json isn't empty, so a published
// canvas always matches a commit; with --allow-dirty it publishes and the stamp says so. A board whose render
// differs from the committed design/canvas/ is published as rendered and listed (`differsFromCommitted`): either
// the committed build is stale (rebuild and commit), or it is the Changelog board after a release tag.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artboards, canvasIndexV3, CONVEXA_VERSION } from './canvas.config.mjs';
import { renderArtboard } from './boards.mjs';
import { git } from './screens/final/changelog.mjs';

/** Whether to publish, from `git status --porcelain -- design package.json` (null: no git repository).
 *  Returns { exit: 0, dirty } to go on, or { exit: 1, reason } with a one-line reason. */
export function publishGate(porcelain, { allowDirty = false } = {}) {
  if (porcelain === null) {
    return allowDirty
      ? { exit: 0, dirty: true }
      : { exit: 1, reason: 'emit-project: refused: no git repository, so the stamp can name no commit (pass --allow-dirty to publish anyway)' };
  }
  const changed = porcelain.split('\n').filter((l) => l.trim());
  if (!changed.length) return { exit: 0, dirty: false };
  if (allowDirty) return { exit: 0, dirty: true };
  return {
    exit: 1,
    reason: `emit-project: refused: ${changed.length} uncommitted change${changed.length === 1 ? '' : 's'} in design/ or package.json (${changed[0].slice(3)}${changed.length > 1 ? ', …' : ''}); commit first, or pass --allow-dirty`,
  };
}

/** The release status: `describe` is git describe --tags --match 'v[0-9]*' (null when no tag is reachable). */
export function releaseStatus({ version, describe, versionTagExists }) {
  const tag = `v${version}`;
  if (describe === tag) return `released as ${tag}`;
  const parts = [];
  if (!versionTagExists) parts.push(`not released yet (no ${tag} tag)`);
  const past = describe ? /^(.+)-(\d+)-g[0-9a-f]+$/.exec(describe) : null;
  if (past) parts.push(`${past[2]} commit${past[2] === '1' ? '' : 's'} after ${past[1]}`);
  else if (describe) parts.push(`at ${describe}`);
  return parts.join(' · ');
}

/** The stamp line the version card leads with. */
export function stampLine({ version, status, branch, sha, date, dirty, ahead }) {
  const from = sha
    ? `built from ${branch && branch !== 'HEAD' ? `${branch} @ ` : ''}${sha}${dirty ? ' with uncommitted changes' : ''}, ${date}`
    : 'built outside a git checkout';
  const pushed = ahead === null || ahead === undefined ? null : ahead > 0 ? `${ahead} commit${ahead === 1 ? '' : 's'} not yet on origin/main` : 'on origin/main';
  return [`Convexa ${version}`, status, from, pushed].filter(Boolean).join(' · ');
}

/** What git says about the working tree and HEAD (every value null where git can't say). */
export function gitFacts() {
  const porcelain = git(['status', '--porcelain', '--', 'design', 'package.json']);
  if (porcelain === null) return { git: false, porcelain: null, describe: null, versionTagExists: false, branch: null, sha: null, date: null, ahead: null };
  const ahead = git(['rev-list', '--count', 'origin/main..HEAD']);
  return {
    git: true,
    porcelain,
    describe: git(['describe', '--tags', '--match', 'v[0-9]*']),
    versionTagExists: git(['rev-parse', '-q', '--verify', `refs/tags/v${CONVEXA_VERSION}`]) !== null,
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    sha: git(['rev-parse', '--short', 'HEAD']),
    date: git(['show', '-s', '--format=%cs', 'HEAD']),
    ahead: ahead === null ? null : Number(ahead),
  };
}

function main(argv) {
  const args = argv.slice(2);
  const allowDirty = args.includes('--allow-dirty');
  const out = args.find((a) => !a.startsWith('--'));
  if (!out) { console.error('usage: node design/src/emit-project.mjs <out-folder> [--allow-dirty]'); process.exit(2); }

  const facts = gitFacts();
  const gate = publishGate(facts.porcelain, { allowDirty });
  if (gate.exit) { console.error(gate.reason); process.exit(gate.exit); }
  const status = facts.git ? releaseStatus({ version: CONVEXA_VERSION, describe: facts.describe, versionTagExists: facts.versionTagExists }) : 'release unknown (no git)';
  const stamp = stampLine({ version: CONVEXA_VERSION, status, branch: facts.branch, sha: facts.sha, date: facts.date, dirty: gate.dirty, ahead: facts.ahead });

  const here = dirname(fileURLToPath(import.meta.url));
  const CANVAS = join(here, '..', 'canvas');
  const proj = join(out, 'project');
  const index = canvasIndexV3({ stamp });
  const files = Object.keys(index.boards);
  const board = new Map(artboards.map((a) => [`${a.name}.dc.html`, a]));
  const unknown = files.filter((f) => !board.has(f));
  if (unknown.length) { console.error('boards in the index but not in the registry: ' + unknown.join(', ')); process.exit(1); }
  if (index.order[0] !== 'Main.dc.html') { console.error('the entry board Main.dc.html must come first in order'); process.exit(1); }
  mkdirSync(proj, { recursive: true });

  const json = JSON.stringify(index, null, 2) + '\n';
  const prevIndex = existsSync(join(proj, 'canvas.json')) ? readFileSync(join(proj, 'canvas.json'), 'utf8') : null;
  writeFileSync(join(proj, 'canvas.json'), json);
  const changed = [];
  // Boards whose render differs from design/canvas/ (or is missing there), and committed boards no longer drawn.
  const differs = [];
  for (const f of files) {
    const dst = join(proj, f);
    const next = Buffer.from(renderArtboard(board.get(f))); // throws on a NUL byte
    const same = existsSync(dst) && Buffer.compare(readFileSync(dst), next) === 0;
    if (!same) { writeFileSync(dst, next); changed.push(f); }
    const committed = join(CANVAS, f);
    if (!existsSync(committed) || Buffer.compare(readFileSync(committed), next) !== 0) differs.push(f);
  }
  const orphaned = existsSync(CANVAS) ? readdirSync(CANVAS).filter((f) => f.endsWith('.dc.html') && !index.boards[f]) : [];
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
  const record = { text: stamp, version: CONVEXA_VERSION, status, branch: facts.branch, commit: facts.sha, date: facts.date, describe: facts.describe, ahead: facts.ahead, dirty: gate.dirty };
  writeFileSync(join(out, 'batches.json'), JSON.stringify({ batches, changed: changed.map((f) => `project/${f}`), indexChanged: prevIndex !== json, differsFromCommitted: differs, orphanedInCommitted: orphaned, stamp: record }, null, 2) + '\n');
  console.log(`project: ${files.length} boards rendered from design/src + canvas.json (${(total / 1e6).toFixed(2)} MB; largest ${largest[0]} ${(largest[1] / 1e3).toFixed(0)} kB); ${Object.keys(index.notes).length} notes, ${index.pages.length} pages; ${changed.length} board files changed, index ${prevIndex === json ? 'unchanged' : 'changed'}; ${batches.length} publish batches → ${out}`);
  if (differs.length || orphaned.length) {
    const list = (xs) => `${xs.slice(0, 6).join(', ')}${xs.length > 6 ? `, … (${xs.length})` : ''}`;
    console.log(`note: published as rendered; the committed design/canvas/ differs on ${differs.length} board${differs.length === 1 ? '' : 's'}${differs.length ? ` (${list(differs)})` : ''}${orphaned.length ? ` and still holds ${orphaned.length} the index no longer draws (${list(orphaned)})` : ''}. Rebuild and commit, unless it is only FChangelogEntries after a release tag.`);
  }
  console.log(`stamp: ${stamp}`);
}

// Run as a script; imported (by a check), only the functions above load.
if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main(process.argv);
