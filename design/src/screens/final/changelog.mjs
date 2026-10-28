// Final · Convexa's version, and the design changelog by version (2026-10-28).
//
// Convexa has one product version: the root package.json "version", in SemVer (1.0.0, the first push after
// 2026-10-28, tagged v1.0.0). The canvas states it on every page header and the version card; each built row's
// title names the version it shipped in (tracker-data.mjs SHIPPED_IN); and the Changelog page lists every
// design/CHANGELOG.md entry under the version it shipped in, worked out from git at build time:
//   1. the commit that added the entry's heading line (git log on design/CHANGELOG.md, oldest first);
//   2. the earliest v* tag that contains that commit, which names the version;
//   3. with no such tag, the root package.json version, marked "not released yet" while no tag v<version> exists.
// An uncommitted entry takes the package.json version; so does every entry when there is no git repository.
// Nothing here reads the clock, so building twice gives byte-identical boards.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root (design/src/screens/final → four levels up). */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CHANGELOG_FILE = join(REPO_ROOT, 'design', 'CHANGELOG.md');

/** SemVer 2.0.0, from semver.org. */
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** SemVer precedence: negative when a < b, 0 when equal (build metadata ignored), positive when a > b. */
export function semverCompare(a, b) {
  const pa = SEMVER.exec(a), pb = SEMVER.exec(b);
  if (!pa || !pb) throw new Error(`not SemVer: ${pa ? b : a}`);
  for (let i = 1; i <= 3; i++) if (+pa[i] !== +pb[i]) return +pa[i] - +pb[i];
  if (!pa[4] || !pb[4]) return (pa[4] ? -1 : 0) - (pb[4] ? -1 : 0);
  const x = pa[4].split('.'), y = pb[4].split('.');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    const nx = /^\d+$/.test(x[i]), ny = /^\d+$/.test(y[i]);
    if (nx && ny && +x[i] !== +y[i]) return +x[i] - +y[i];
    if (nx !== ny) return nx ? -1 : 1;
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

/** Convexa's version: the root package.json "version". The build fails when it isn't SemVer. */
export const CONVEXA_VERSION = (() => {
  const v = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version;
  if (typeof v !== 'string' || !SEMVER.test(v)) throw new Error(`root package.json version ${JSON.stringify(v)} is not SemVer`);
  return v;
})();

/** git in the repository root: its stdout without the last newline, or null when git is missing, the command
 *  fails, or design/ doesn't sit in this repository's own work tree (an export unpacked inside another repo). */
let repoOk;
export function git(args) {
  if (repoOk === undefined) {
    const top = run(['rev-parse', '--show-toplevel']);
    try { repoOk = top !== null && realpathSync(top) === realpathSync(REPO_ROOT); } catch { repoOk = false; }
  }
  return repoOk ? run(args) : null;
}
function run(args) {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).replace(/\n$/, '');
  } catch {
    return null;
  }
}

// ---- The changelog's entries ------------------------------------------------------------------------------

const MAX_SENTENCE = 280;

/** Markdown inline to plain text: bold and links lose their marks; code keeps its backticks. */
const unmark = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

/** The first sentence of an entry's first bullet or paragraph, cut at a word near MAX_SENTENCE. */
export function firstSentence(raw) {
  const t = unmark(raw).trim();
  const end = /[.!?]["”’)]?(?=\s+[A-Z“"(`]|\s*$)/g;
  let s = null, m;
  while ((m = end.exec(t))) {
    if (/\b(?:e\.g|i\.e|vs|etc|cf|No)\.$/.test(t.slice(0, m.index + 1))) continue;
    s = t.slice(0, m.index + m[0].length);
    break;
  }
  s = (s ?? t.replace(/:\s*$/, '.')).trim();
  if (s.length > MAX_SENTENCE) {
    const cut = s.lastIndexOf(' ', MAX_SENTENCE);
    let head = s.slice(0, cut > 120 ? cut : MAX_SENTENCE).replace(/[\s,;:(—–-]+$/, '');
    if ((head.match(/`/g) || []).length % 2) head += '`'; // close a code span the cut opened
    s = `${head} …`;
  }
  return s;
}

/** design/CHANGELOG.md's entries in file order (oldest first): one per "## " heading. `title` is the heading
 *  after its date; an untitled heading takes its first bullet's bold lead, in the entry's own words. */
export function parseChangelog(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('## ')) continue;
    const heading = lines[i];
    const m = /^## (\d{4}-\d{2}-\d{2})(?:\s*·\s*(.+))?$/.exec(heading);
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    const first = [];
    for (let k = j; k < lines.length; k++) {
      const l = lines[k];
      if (k > j && (!l.trim() || /^\s*- /.test(l) || l.startsWith('#'))) break;
      if (k === j && l.startsWith('#')) break;
      first.push(l.replace(/^\s*- /, '').trim());
    }
    const body = first.join(' ');
    const lead = /^\*\*(.+?)\*\*/.exec(body);
    out.push({
      heading,
      line: i + 1,
      date: m ? m[1] : null,
      title: (m ? m[2] : heading.slice(3)) ?? (lead ? lead[1].replace(/[.:]$/, '') : ''),
      sentence: body ? firstSentence(body) : '',
    });
  }
  return out;
}

/** For each entry (file order), the commit that added its heading line, or null when no commit did (an
 *  uncommitted entry). git log runs oldest first; the n-th copy of a heading takes the n-th commit that added it. */
function headingCommits(entries) {
  const log = git(['log', '--follow', '--reverse', '--no-color', '--no-ext-diff', '--unified=0', '--format=commit %H', '-p', '--', 'design/CHANGELOG.md']);
  if (log === null) return entries.map(() => null);
  const added = new Map();
  let sha = null;
  for (const l of log.split('\n')) {
    if (l.startsWith('commit ')) sha = l.slice(7).trim();
    else if (l.startsWith('+## ') && sha) {
      const h = l.slice(1);
      if (!added.has(h)) added.set(h, []);
      added.get(h).push(sha);
    }
  }
  const used = new Map();
  return entries.map((e) => {
    const n = used.get(e.heading) ?? 0;
    used.set(e.heading, n + 1);
    return added.get(e.heading)?.[n] ?? null;
  });
}

/** The v* tags that are SemVer, oldest version first. */
function versionTags() {
  const list = git(['tag', '--list', 'v[0-9]*']);
  return (list ? list.split('\n') : []).filter((t) => SEMVER.test(t.slice(1))).sort((a, b) => semverCompare(a.slice(1), b.slice(1)));
}

let memo = null;
/**
 * The changelog by version: { version, git, groups: [{ key, label, version, status, entries }] }, groups newest
 * version first, entries newest first. `status`: 'released' (its tag exists), 'unreleased' (no tag yet),
 * 'after' (entries after the package.json version's tag, before the version is bumped) or 'nogit'.
 */
export function changelogModel() {
  if (memo) return memo;
  const entries = parseChangelog(readFileSync(CHANGELOG_FILE, 'utf8'));
  const hasGit = git(['rev-parse', '--git-dir']) !== null;
  const tags = hasGit ? versionTags() : [];
  const tagged = new Set(tags);
  const shas = hasGit ? headingCommits(entries) : entries.map(() => null);
  const firstTag = new Map();
  const tagOf = (sha) => {
    if (!sha || !tags.length) return null;
    if (!firstTag.has(sha)) {
      const holding = new Set((git(['tag', '--contains', sha, '--list', 'v[0-9]*']) ?? '').split('\n'));
      firstTag.set(sha, tags.find((t) => holding.has(t)) ?? null);
    }
    return firstTag.get(sha);
  };
  const pkg = CONVEXA_VERSION;
  const groups = new Map();
  entries.forEach((e, i) => {
    const tag = tagOf(shas[i]);
    const g = !hasGit
      ? { key: `nogit-${pkg}`, version: pkg, status: 'nogit' }
      : tag
        ? { key: tag, version: tag.slice(1), status: 'released' }
        : tagged.has(`v${pkg}`)
          ? { key: `after-${pkg}`, version: pkg, status: 'after' }
          : { key: `v${pkg}`, version: pkg, status: 'unreleased' };
    if (!groups.has(g.key)) groups.set(g.key, { ...g, entries: [] });
    groups.get(g.key).entries.push(e);
  });
  const rank = (g) => (g.status === 'after' ? 1 : 0);
  const sorted = [...groups.values()].sort((a, b) => semverCompare(b.version, a.version) || rank(b) - rank(a));
  for (const g of sorted) g.entries.reverse();
  memo = { version: pkg, git: hasGit, entries: entries.length, groups: sorted };
  return memo;
}

// ---- The board ----------------------------------------------------------------------------------------------

export const CHANGELOG_CSS = `
  .cl { padding: 40px 44px 56px; display: flex; flex-direction: column; gap: 32px; font-size: 13.5px; line-height: 1.5; }
  .cl .eyebrow { font: 600 11px/1.4 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--steel); }
  .cl h1 { margin: 6px 0 0; font-size: 38px; line-height: 1.05; letter-spacing: -0.02em; }
  .cl .lead { margin: 10px 0 0; max-width: 96ch; color: var(--steel); font-size: 14px; }
  .cl code { font: 400 12px/1.4 'IBM Plex Mono', monospace; color: var(--phosphor); }
  .cl .ver { display: flex; flex-direction: column; }
  .cl .ver-h { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; padding-bottom: 10px; border-bottom: 1px solid var(--line-2); }
  .cl .ver-h h2 { margin: 0; font-size: 20px; letter-spacing: -0.01em; }
  .cl .ver-h h2 .v { font: 500 20px 'IBM Plex Mono', monospace; }
  .cl .ver-h .c { font: 500 12px 'IBM Plex Mono', monospace; color: var(--steel); }
  .cl .chip { display: inline-block; font: 600 11px/1.6 'IBM Plex Mono', monospace; padding: 0 8px; border-radius: 10px; border: 1px dashed var(--line-2); color: var(--steel); white-space: nowrap; }
  .cl .chip.released { border-style: solid; color: var(--phosphor); }
  .cl ol { margin: 0; padding: 0; list-style: none; }
  .cl li { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--line); }
  .cl li time { font: 500 12.5px/1.65 'IBM Plex Mono', monospace; color: var(--steel); }
  .cl li strong { display: block; font-size: 14px; font-weight: 600; line-height: 1.45; color: var(--phosphor); }
  .cl li p { margin: 3px 0 0; color: var(--steel); max-width: 120ch; }
`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Plain text with `code` spans as <code>. */
const inline = (s) => s.split('`').map((part, i) => (i % 2 ? `<code>${esc(part)}</code>` : esc(part))).join('');

const STATUS = {
  released: (g) => ({ chip: `Released · v${g.version}`, cls: 'released', label: `Convexa <span class="v">${esc(g.version)}</span>` }),
  unreleased: (g) => ({ chip: 'Not released yet', cls: '', label: `Convexa <span class="v">${esc(g.version)}</span>` }),
  after: (g) => ({ chip: `Not released yet · after v${g.version}`, cls: '', label: `After Convexa <span class="v">${esc(g.version)}</span>` }),
  nogit: (g) => ({ chip: 'Release unknown · no git history', cls: '', label: `Convexa <span class="v">${esc(g.version)}</span>` }),
};

/** The board: every entry, newest first, under the version it shipped in. */
export function changelogBoard() {
  return ({ scheme = 'dark', minHeight = 0 } = {}) => {
    const m = changelogModel();
    const group = (g) => {
      const s = STATUS[g.status](g);
      const dates = g.entries.map((e) => e.date).filter(Boolean).sort();
      const span = dates.length ? ` · ${dates[0]}${dates.length > 1 && dates[dates.length - 1] !== dates[0] ? ` to ${dates[dates.length - 1]}` : ''}` : '';
      return `<section class="ver" aria-label="${s.label.replace(/<[^>]+>/g, '')}">
        <div class="ver-h"><h2>${s.label}</h2><span class="chip ${s.cls}">${esc(s.chip)}</span><span class="c">${g.entries.length} entr${g.entries.length === 1 ? 'y' : 'ies'}${span}</span></div>
        <ol>${g.entries.map((e) => `<li>${e.date ? `<time datetime="${e.date}">${e.date}</time>` : '<span></span>'}<div><strong>${inline(e.title)}</strong>${e.sentence ? `<p>${inline(e.sentence)}</p>` : ''}</div></li>`).join('')}</ol>
      </section>`;
    };
    return `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><article class="cl" aria-label="Design changelog">
      <header>
        <div class="eyebrow">Changelog · by Convexa version</div>
        <h1 class="display">Design changelog</h1>
        <p class="lead">Every entry in <code>design/CHANGELOG.md</code>, newest first, under the Convexa version it shipped in: the earliest <code>v*</code> tag that holds the commit that added its heading, or, before that tag exists, the root <code>package.json</code> version, marked not released yet. Each line is the entry’s date, its title and its first sentence (cut near two lines); the file keeps every entry in full. Built from git each time the design builds; nothing here is typed by hand.</p>
      </header>
      ${m.groups.map(group).join('')}
    </article></div>`;
  };
}
