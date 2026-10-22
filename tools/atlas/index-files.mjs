/**
 * The atlas's every-file index, and the repository facts the page derives instead of hard-coding.
 *
 * `indexFiles(root, paths)` reads each tracked file of a clean export (`root`, the `paths` from
 * `git ls-tree -r <ref>`) and returns one row per file: lines, kind, a description quoted from the
 * file itself (header comment, Rust `//!` doc, first Markdown heading), exports, local imports and
 * concern tags. Bulk folders (generated output, agent adapters, recorded fixtures, `.spire`) are
 * summarised with a count and a few examples instead of being listed. `comp` maps every component
 * name declared in a .tsx file to the files that declare it; the recorders use it to tell our
 * components from library ones, leaving out the names in `shadowed`: also imported from a package
 * (run.mjs adds the names the vendor chunks declare), so a fiber's name cannot say whose it is.
 *
 * `repoFacts(root, paths)` returns the numbers the page states as facts — tracked files, folder
 * counts, API operations, Nx projects, Rust crates, the Node pin and dependency versions — so they
 * are recomputed on every run instead of going stale in prose.
 *
 * Everything is ordered by path (the order `git ls-tree` prints), so two runs on one ref produce
 * the same index byte for byte.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Folders summarised as one row with a count; descriptions say what they are, not how many. */
const BULK = [
  ['.spire/', 'Spire product memory: context, feature contracts, conformance specs, state'],
  ['.claude/', 'Claude agent adapter: roles, skills, commands, tools, path-guard hook'],
  ['.codex/', 'Codex agent adapter (mirror of .claude)'],
  ['.grok/', 'Grok agent adapter (mirror of .claude)'],
  ['design/canvas/', 'Generated design boards (from design/src); never hand-edited'],
  ['design/site/', 'Generated static design site (from design/src); never hand-edited'],
  [
    'apps/api/tests/fixtures/',
    'Recorded fixtures for Rust tests (real SEC, Treasury, CFTC… responses)',
  ],
  ['research/_filings/', 'Saved SEC company-facts used by the offline filing check'],
  ['docs/backend-atlas/evidence/', 'Evidence files from the backend audit'],
];
const BULK_EXAMPLES = 6;
const SKIP_EXT = /\.(png|jpg|jpeg|gif|ico|woff2?|ttf|otf|br|gz|map|lock|pem|patch|csv)$/i;

/** Concern tags: a file is tagged when its source matches. They drive the "Where to look" cards. */
const CONCERNS = [
  [
    'state',
    /useSyncExternalStore|createContext\(|useReducer\(|localStorage|sessionStorage|subscribe\(/,
  ],
  ['routing', /from ['"]react-router|useNavigate\(|useParams\(|<Route\b|<Navigate\b|useLocation\(/],
  [
    'data',
    /from ['"]@convexa\/api['"]|usePollingResource|useRead\(|openapi-fetch|\bfetch\(|getTicker|dataOf\(/,
  ],
  ['streaming', /EventSource|text\/event-stream|\bSse\b|sse::|stream_ticker|streamTicker/],
  ['auth', /useAuth\(|AuthContext|require_user|session|oauth|signIn|sign_in|login/i],
  ['theme', /useTheme\(|createTheme|extrasFor|tokens\b|data-theme|palette\./],
  ['demo', /isDemoBuild|dataMode|__CONVEXA_BOOT__|demoFetch|STAGING_DEMO/],
  ['charts', /recharts|<svg\b|getContext\(['"](?:2d|webgl2?)|WebGL|<canvas\b/],
  ['a11y', /aria-[a-z]+|role=["']|useReducedMotion|prefers-reduced-motion/],
  ['errors', /ErrorBoundary|componentDidCatch|thiserror|AppError|IntoResponse for/],
  ['cache', /TtlCache|GexCache|cache\.get|Cache-Control|keepOnError/],
  ['db', /sqlx|PgPool|migration|postgres/i],
  ['contract', /utoipa|openapi|schema\.ts|components\['schemas'\]/],
  ['money', /maxLoss|max_loss|pnl|PnL|notional|premium|\bfill\b/],
];

const clean = (s) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/^[\s*/!#-]+/, '')
    .trim();

/** The first sentences of a comment, cut at a sentence end when one falls late enough. */
function firstSentences(s, max = 240) {
  s = clean(s);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return dot > 80 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

/** The first block or line comment after the imports of a TS/JS file. */
function tsHeader(src) {
  const lines = src.split('\n').slice(0, 80);
  const skippable = (l) =>
    /^\s*$/.test(l) ||
    /^#!/.test(l) ||
    /^\s*['"]use (client|strict)['"];?/.test(l) ||
    /^\s*(import|export \* from|export \{[^}]*\} from)\b/.test(l) ||
    /^\s*(\}|[\w$,\s{}]+)\s*from\s*['"]/.test(l) ||
    /^\s*\/\/\/\s*<reference/.test(l) ||
    /^\s*\/\/\s*(eslint|@ts-|prettier)/.test(l);
  let i = 0;
  let inImport = false;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (inImport) {
      if (/from\s*['"]|['"];\s*$/.test(l)) inImport = false;
      continue;
    }
    if (/^\s*import\b/.test(l) && !/from\s*['"]|^\s*import\s*['"]/.test(l)) {
      inImport = true;
      continue;
    }
    if (skippable(l)) continue;
    break;
  }
  const rest = lines.slice(i).join('\n');
  let m = rest.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
  if (m)
    return firstSentences(
      m[1]
        .split('\n')
        .map((x) => x.replace(/^\s*\*\s?/, ''))
        .join(' '),
    );
  m = rest.match(/^((?:\s*\/\/[^\n]*\n)+)/);
  if (m)
    return firstSentences(
      m[1]
        .split('\n')
        .map((x) => x.replace(/^\s*\/\/\s?/, ''))
        .join(' '),
    );
  return '';
}

/** A Rust file's `//!` doc, else the `///` doc of its first public item, else a leading comment. */
function rustHeader(src) {
  const inner = src
    .split('\n')
    .filter((l) => /^\s*\/\/!/.test(l))
    .slice(0, 8)
    .map((l) => l.replace(/^\s*\/\/!\s?/, ''));
  if (inner.length) return firstSentences(inner.join(' '));
  const m = src.match(/((?:^\s*\/\/\/[^\n]*\n)+)\s*(?:#\[[^\n]*\n\s*)*pub/m);
  if (m)
    return firstSentences(
      m[1]
        .split('\n')
        .map((x) => x.replace(/^\s*\/\/\/\s?/, ''))
        .join(' '),
    );
  const c = src.match(/^((?:\s*\/\/[^\n]*\n)+)/);
  if (c)
    return firstSentences(
      c[1]
        .split('\n')
        .map((x) => x.replace(/^\s*\/\/\s?/, ''))
        .join(' '),
    );
  return '';
}

/** "Heading: first paragraph" of a Markdown file. */
function mdHeader(src) {
  const h = src.match(/^#\s+(.+)$/m);
  const para = src
    .replace(/^---[\s\S]*?---/, '')
    .split('\n\n')
    .map((x) => x.trim())
    .find(
      (x) =>
        x && !x.startsWith('#') && !x.startsWith('|') && !x.startsWith('```') && !x.startsWith('<'),
    );
  if (h && para)
    return firstSentences(`${h[1].replace(/[*_`]/g, '')}: ${para.replace(/[*_`>]/g, '')}`, 200);
  return h ? clean(h[1]).replace(/[*_`]/g, '') : '';
}

function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(
    /export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  ))
    names.add(m[1]);
  for (const m of src.matchAll(/export\s+default\s+([A-Z][\w$]*)\s*;/g)) names.add(m[1]);
  return [...names].slice(0, 14);
}

function rustPub(src) {
  const names = new Set();
  for (const m of src.matchAll(
    /^\s*pub(?:\([^)]*\))?\s+(?:async\s+)?(?:fn|struct|enum|trait|mod|const|type)\s+([A-Za-z_][\w]*)/gm,
  ))
    names.add(m[1]);
  return [...names].slice(0, 14);
}

/** Capitalised function and const components (plain, memo, forwardRef, lazy) and class components. */
function componentsDeclared(src) {
  const names = new Set();
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?function\s+([A-Z][\w$]*)\s*\(/g,
  ))
    names.add(m[1]);
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:export\s+)?const\s+([A-Z][\w$]*)\s*(?::[^=]+)?=\s*(?:React\.)?(?:memo|forwardRef|lazy)?\s*\(?\s*(?:\(|function|async\s*\()/g,
  ))
    names.add(m[1]);
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?class\s+([A-Z][\w$]*)\s+extends\s+(?:React\.)?(?:Pure)?Component\b/g,
  ))
    names.add(m[1]);
  return [...names];
}

/** Capitalised names a file imports from a package (`import { Grid } from '@mui/material'`). */
function packageImports(src) {
  const names = [];
  for (const m of src.matchAll(
    /import\s+(?:type\s+)?([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g,
  )) {
    const [, def, named, spec] = m;
    if (spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('@convexa/')) continue;
    if (def && /^[A-Z]/.test(def)) names.push(def);
    for (const part of (named || '').split(',')) {
      const original = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0];
      if (/^[A-Z][\w$]*$/.test(original)) names.push(original);
    }
  }
  return names;
}

const RESOLVE_EXTS = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.mjs',
  '.js',
  '/index.ts',
  '/index.tsx',
  '/index.mjs',
];

/** A TS/JS import specifier → the tracked file it names, or null for packages. */
function resolveTs(files, from, spec) {
  let base;
  if (spec.startsWith('@/')) base = 'apps/dashboard/src/app/' + spec.slice(2);
  else if (spec === '@convexa/api')
    return files.has('libs/api/src/index.ts') ? 'libs/api/src/index.ts' : null;
  else if (spec.startsWith('.'))
    base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  for (const e of RESOLVE_EXTS) if (files.has(base + e)) return base + e;
  return null;
}

/** `mod x;` declarations → the tracked files they load. */
function resolveRustMods(files, from, src) {
  const out = [];
  const dir = path.posix.dirname(from);
  const own = /\/(mod|lib|main)\.rs$/.test(from)
    ? dir
    : path.posix.join(dir, path.posix.basename(from, '.rs'));
  for (const m of src.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+([a-z_][\w]*)\s*;/gm)) {
    for (const c of [`${own}/${m[1]}.rs`, `${own}/${m[1]}/mod.rs`]) {
      if (files.has(c)) {
        out.push(c);
        break;
      }
    }
  }
  return out;
}

const isTest = (p) =>
  /\.(spec|test)\.[cm]?[tj]sx?$/.test(p) ||
  /^apps\/api\/tests\/|^libs\/quant-engine\/tests\//.test(p);

function tsKind(p, ext, src, test) {
  const base = path.posix.basename(p);
  if (test) return 'test';
  if (/(^|\/)(main|mountApp|prebootstrap)\.tsx?$/.test(p)) return 'entry';
  if (/\.d\.ts$/.test(p)) return 'types';
  if (/^use[A-Z]/.test(base)) return 'hook';
  if (/createContext\(/.test(src)) return 'context';
  if (/useSyncExternalStore|store\.[tm]?s$/.test(src + base) && ext !== 'tsx') return 'store';
  if (ext === 'tsx' && /\/pages\//.test(p)) return 'page';
  if (ext === 'tsx') return 'component';
  if (/^tools\/|^apps\/dashboard-e2e\/tools\//.test(p)) return 'script';
  if (/config\.|\.config\./.test(base)) return 'config';
  return 'module';
}

function rustKind(p, test) {
  if (test) return 'test';
  if (/\/routes\//.test(p)) return 'route';
  if (/\/services\//.test(p)) return 'service';
  if (/\/bin\//.test(p)) return 'binary';
  if (/(main|lib)\.rs$/.test(p)) return 'entry';
  return 'module';
}

/**
 * @param {string} root  the export directory
 * @param {string[]} paths  tracked paths, sorted
 */
export function indexFiles(root, paths) {
  const files = new Set(paths);
  const read = (p) => {
    try {
      return readFileSync(path.join(root, p), 'utf8');
    } catch {
      return ''; // a submodule or a path the export left out reads as empty
    }
  };
  const rows = [];
  const bulk = new Map();
  const comp = {};
  const fromPackages = new Set();
  for (const p of paths) {
    const b = BULK.find(([prefix]) => p.startsWith(prefix));
    if (b) {
      const entry = bulk.get(b[0]) ?? { p: b[0], d: b[1], n: 0, ex: [] };
      entry.n++;
      if (entry.ex.length < BULK_EXAMPLES) entry.ex.push(p.slice(b[0].length));
      bulk.set(b[0], entry);
      continue;
    }
    const ext = (p.match(/\.([a-z0-9]+)$/i) || [null, ''])[1].toLowerCase();
    const isText = !SKIP_EXT.test(p);
    const src = isText ? read(p) : '';
    const test = isTest(p);
    let d = '';
    let how = 'none';
    let ex = [];
    let im = [];
    let k = 'file';
    if (['ts', 'tsx', 'js', 'mjs', 'mts', 'cjs'].includes(ext)) {
      d = tsHeader(src);
      how = d ? 'header' : 'none';
      ex = exportsOf(src);
      const specs = new Set();
      for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g))
        specs.add(m[1]);
      im = [...specs].map((s) => resolveTs(files, p, s)).filter(Boolean);
      for (const name of packageImports(src)) fromPackages.add(name);
      if (ext === 'tsx') for (const c of componentsDeclared(src)) (comp[c] ||= []).push(p);
      k = tsKind(p, ext, src, test);
    } else if (ext === 'rs') {
      d = rustHeader(src);
      how = d ? 'header' : 'none';
      ex = rustPub(src);
      im = resolveRustMods(files, p, src);
      k = rustKind(p, test);
    } else if (ext === 'md') {
      d = mdHeader(src);
      how = d ? 'heading' : 'none';
      k = 'doc';
    } else if (ext === 'css' || ext === 'scss') {
      const m = src.match(/\/\*([\s\S]*?)\*\//);
      d = m ? firstSentences(m[1]) : '';
      how = d ? 'header' : 'none';
      k = 'style';
    } else if (
      ['yml', 'yaml', 'toml', 'sh', 'py'].includes(ext) ||
      /^(Dockerfile|\.[a-z]+rc|\.?[a-z-]+ignore|pre-push)$/i.test(path.posix.basename(p))
    ) {
      const c = src
        .split('\n')
        .filter((l) => /^\s*#(?!!)/.test(l))
        .slice(0, 4)
        .map((l) => l.replace(/^\s*#\s?/, ''));
      d = c.length ? firstSentences(c.join(' ')) : '';
      how = d ? 'header' : 'none';
      k = ext === 'py' ? 'script' : 'config';
      if (ext === 'py') {
        const m = src.match(/^"""([\s\S]*?)"""/m);
        if (m) {
          d = firstSentences(m[1]);
          how = 'header';
        }
      }
    } else if (ext === 'json') {
      k = 'config';
      try {
        const j = JSON.parse(src);
        const c = j.$comment || j.description || j._comment;
        if (typeof c === 'string') {
          d = firstSentences(c);
          how = 'header';
        }
      } catch {
        // not JSON (or JSONC): no description
      }
    } else if (ext === 'html') {
      const m = src.match(/<title>([^<]*)<\/title>/);
      d = m ? clean(m[1]) : '';
      how = d ? 'heading' : 'none';
      k = 'page-html';
    } else if (!isText) {
      k = 'asset';
      d = /\.woff2?$/.test(p) ? 'Font file' : /\.(png|jpg|ico|svg)$/.test(p) ? 'Image' : '';
      how = d ? 'known' : 'none';
    }
    const t =
      isText && ['ts', 'tsx', 'mjs', 'mts', 'js', 'rs'].includes(ext)
        ? CONCERNS.filter(([, re]) => re.test(src)).map(([tag]) => tag)
        : [];
    rows.push({ p, l: src ? src.split('\n').length : 0, k, d, h: how, ex, im, t });
  }
  // A component of ours that shares its name with one imported from a package (a local `Grid`
  // beside MUI's) cannot be told apart by name at runtime, so the recorders leave it out.
  const shadowed = Object.keys(comp).filter((name) => fromPackages.has(name));
  return { rows, bulk: [...bulk.values()], comp, shadowed };
}

/** `^19.2.8` → `19.2`; an exact pin stays exact. */
const npmVersion = (spec) =>
  /^[~^]/.test(spec) ? spec.slice(1).split('.').slice(0, 2).join('.') : spec;

/** `name = "1"` and `name = { version = "1", … }` lines of the dependency tables of a Cargo.toml. */
function cargoDeps(src) {
  const out = {};
  let inDeps = false;
  for (const line of src.split('\n')) {
    const section = line.match(/^\s*\[([^\]]+)\]/);
    if (section) {
      inDeps = /(^|\.)(dependencies|dev-dependencies)$/.test(section[1]);
      continue;
    }
    if (!inDeps) continue;
    const m = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]+)"|\{[^}]*version\s*=\s*"([^"]+)")/);
    if (m && !(m[1] in out)) out[m[1]] = m[2] ?? m[3];
  }
  return out;
}

/**
 * @param {string} root  the export directory
 * @param {string[]} paths  tracked paths, sorted
 */
export function repoFacts(root, paths) {
  const read = (p) => readFileSync(path.join(root, p), 'utf8');
  const has = new Set(paths);

  // Files per directory, for every directory, so prose can say "{{n:design/src}} files".
  const dirs = {};
  for (const p of paths) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join('/');
      dirs[d] = (dirs[d] ?? 0) + 1;
    }
  }

  const spec = JSON.parse(read('apps/api/openapi/convexa.openapi.json'));
  const METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'head', 'options']);
  const ops = Object.values(spec.paths).reduce(
    (n, item) => n + Object.keys(item).filter((m) => METHODS.has(m)).length,
    0,
  );

  // An Nx project is a folder under apps/ or libs/ with a project.json or a workspace package.json.
  const projects = new Set(
    paths
      .filter((p) => /^(apps|libs)\/[^/]+\/(project|package)\.json$/.test(p))
      .map((p) => path.posix.dirname(p)),
  );
  const members = read('Cargo.toml').match(/members\s*=\s*\[([^\]]*)\]/);
  const crates = members ? [...members[1].matchAll(/"([^"]+)"/g)].length : 0;

  const npm = {};
  for (const p of [
    'package.json',
    ...paths.filter((x) => /^(apps|libs)\/[^/]+\/package\.json$/.test(x)),
  ]) {
    const j = JSON.parse(read(p));
    for (const [name, v] of Object.entries({ ...j.dependencies, ...j.devDependencies })) {
      if (!(name in npm)) npm[name] = npmVersion(v);
    }
  }
  const cargo = {};
  for (const p of [
    'Cargo.toml',
    ...paths.filter((x) => /^(apps|libs)\/[^/]+\/Cargo\.toml$/.test(x)),
  ]) {
    for (const [name, v] of Object.entries(cargoDeps(read(p))))
      if (!(name in cargo)) cargo[name] = v;
  }

  const nodePin = ['.nvmrc', '.node-version'].find((p) => has.has(p));
  return {
    tracked: paths.length,
    dirs,
    ops,
    nxProjects: projects.size,
    crates,
    node: nodePin ? read(nodePin).trim().replace(/^v/, '') : null,
    versions: { npm, cargo },
  };
}
