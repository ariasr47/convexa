/**
 * Assemble the atlas: the template (template/), the recorded data and the repository's own fonts
 * into one self-contained HTML file. No network is needed to open it, from disk or a server.
 *
 * template/atlas.html  the page: head, chapters and their static prose, with four slots
 * template/atlas.css   the styles
 * template/content.js  every hand-written fact the page states (diagram, folder notes, flows,
 *                      cards, tables); docs/atlas/README.md lists the ones nothing derives
 * template/app.js      the renderers, the startup player and the click replayer
 *
 * Prose in atlas.html and content.js may use tokens that are filled in here from the repository,
 * so the numbers cannot go stale:
 *   {{n:path}}         tracked files under a folder (or 1 for a file); `a+b` sums, `dir/pre*`
 *                      sums the sibling folders whose name starts with `pre`
 *   {{dirs:path}}      sub-folders of a folder, not counting ones whose name starts with `_`
 *   {{tests:path}}     test files under a folder (the file index's `test` kind); `a+b` sums
 *   {{v:npm:name}}     a dependency's version from the package.json files (`^19.2.8` → 19.2)
 *   {{v:cargo:name}}   a dependency's version from the Cargo.toml files
 *   {{version}}        Convexa's version, the root package.json's
 *   {{ops}} {{tracked}} {{nxprojects}} {{crates}} {{node}} {{short}} {{sha}} {{date}}
 * A token that names nothing (a folder that moved, a dependency that left) fails the build
 * rather than print a zero.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'template');

/** The faces the page uses, from the dashboard's self-hosted fonts (latin subsets). */
const FONTS = [
  ['Archivo', '100 900', 'font-stretch:62% 125%;', 'archivo/archivo-latin-standard-normal.woff2'],
  ['IBM Plex Sans', '400', '', 'ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2'],
  ['IBM Plex Sans', '500', '', 'ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2'],
  ['IBM Plex Sans', '600', '', 'ibm-plex-sans/ibm-plex-sans-latin-600-normal.woff2'],
  ['IBM Plex Mono', '400', '', 'ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2'],
  ['IBM Plex Mono', '500', '', 'ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2'],
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `2026-10-21` → `21 Oct 2026`. */
const longDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const fmt = (n) => n.toLocaleString('en-US');

/** Token values for one build. Each resolver throws when the thing it names does not exist. */
function resolver({ meta, facts, page }) {
  const subdirs = (dir) => Object.keys(facts.dirs).filter((d) => path.posix.dirname(d) === dir);
  const count = (part) => {
    if (part.endsWith('*')) {
      const prefix = part.slice(0, -1);
      const parent = path.posix.dirname(prefix);
      const base = path.posix.basename(prefix);
      return subdirs(parent)
        .filter((d) => path.posix.basename(d).startsWith(base))
        .reduce((n, d) => n + facts.dirs[d], 0);
    }
    if (facts.dirs[part]) return facts.dirs[part];
    return page.files.rows.some((r) => r.p === part) ? 1 : 0;
  };
  const version = (arg) => {
    const [kind, name] = arg.split(':');
    return facts.versions[kind]?.[name];
  };
  const simple = {
    ops: () => fmt(facts.ops),
    tracked: () => fmt(facts.tracked),
    nxprojects: () => String(facts.nxProjects),
    crates: () => String(facts.crates),
    node: () => facts.node,
    version: () => facts.version,
    short: () => meta.sha.slice(0, 8),
    sha: () => meta.sha,
    date: () => longDate(meta.date),
  };
  return (kind, arg) => {
    let value;
    if (kind === 'n') {
      const n = arg.split('+').reduce((sum, part) => sum + count(part), 0);
      value = n ? fmt(n) : null;
    } else if (kind === 'dirs') {
      const n = subdirs(arg).filter((d) => !path.posix.basename(d).startsWith('_')).length;
      value = n ? String(n) : null;
    } else if (kind === 'tests') {
      const under = arg.split('+').map((p) => p + '/');
      const n = page.files.rows.filter(
        (r) => r.k === 'test' && under.some((p) => r.p.startsWith(p)),
      ).length;
      value = n ? fmt(n) : null;
    } else if (kind === 'v') {
      value = version(arg);
    } else if (simple[kind] && !arg) {
      value = simple[kind]();
    }
    if (value == null || value === '')
      throw new Error(
        `atlas template: {{${kind}${arg ? ':' + arg : ''}}} names nothing in this commit`,
      );
    return value;
  };
}

const fill = (text, resolve) =>
  text.replace(/\{\{([a-z]+)(?::([^}]+))?\}\}/g, (_, kind, arg) => resolve(kind, arg));

/** `slot` must appear exactly once in `text`; replaced with a function so `$` stays literal. */
function put(text, slot, value) {
  const parts = text.split(slot);
  if (parts.length !== 2)
    throw new Error(`atlas template: slot ${slot} appears ${parts.length - 1} times`);
  return parts[0] + value + parts[1];
}

/**
 * @param {{
 *   meta: { sha: string, date: string, offline: boolean, liveApi: string },
 *   facts: ReturnType<import('./index-files.mjs').repoFacts>,
 *   page: { files: object, startup: object, clicks: object, wire: object, bundle: object, health: object | null },
 *   fontsDir: string,
 * }} input
 * @returns {string} the atlas HTML
 */
export function buildAtlas({ meta, facts, page, fontsDir }) {
  const read = (f) => readFileSync(path.join(TEMPLATE, f), 'utf8');
  const resolve = resolver({ meta, facts, page });
  const fonts = FONTS.map(
    ([family, weight, extra, file]) =>
      `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};${extra}` +
      `src:url(data:font/woff2;base64,${readFileSync(path.join(fontsDir, file)).toString('base64')}) format('woff2')}`,
  ).join('\n');
  const script = `(() => {\n${fill(read('content.js'), resolve)}\n${read('app.js')}\n})();`;
  new Script(script); // compiles without running: a syntax error fails here, not in a browser
  if (/<\/script/i.test(script)) throw new Error('atlas template: a script contains "</script"');
  // `<` is escaped so no string in the data (a file's header comment, say) can close the tag.
  const data = JSON.stringify({ meta, ...page }).replace(/</g, '\\u003c');

  let html = fill(read('atlas.html'), resolve);
  html = put(html, '<!--@FONTS-->', `<style>\n${fonts}\n</style>`);
  html = put(html, '<!--@CSS-->', `<style>\n${read('atlas.css')}</style>`);
  html = put(
    html,
    '<!--@DATA-->',
    `<script type="application/json" id="atlas-data">${data}</script>`,
  );
  html = put(html, '<!--@SCRIPT-->', `<script>\n${script}\n</script>`);
  return html;
}
