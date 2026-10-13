// Vite plugin: compiles research/<TICKER>/*.md (tools/research-notes/notes.mjs) into the dashboard.
//
// `import { researchIndex, researchUrl } from 'virtual:convexa-research'` gives the per-ticker summary
// list and a URL for each ticker's full notes. The same module re-exports `freshness`, `upcoming` and
// `localToday` from ./freshness.mjs, so the reader's browser and `npm run research:due` run one
// implementation of when a note stops being current. In a build, each ticker's notes become one hashed JSON
// asset (assets/research-<TICKER>-<hash>.json), so note text stays out of the JS bundles and their
// budgets. The dev server answers the same URLs live from disk. Any invalid note fails the build
// (and shows Vite's error overlay in dev), so a malformed note can never deploy.

import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatErrors, loadNotes, summarize } from './notes.mjs';

const FRESHNESS = fileURLToPath(new URL('./freshness.mjs', import.meta.url))
  .split(path.sep)
  .join('/');

const VIRTUAL_ID = 'virtual:convexa-research';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const DEV_PREFIX = '/@convexa-research/';

/** @param {{ researchDir: string }} options */
export function convexaResearch({ researchDir }) {
  let isBuild = false;
  let base = '/';
  let assetsDir = 'assets';
  const repoRoot = path.dirname(researchDir);

  const load = () => {
    const { notes, errors } = loadNotes(researchDir, repoRoot);
    if (errors.length)
      throw new Error(`Research notes have ${errors.length} problem(s):\n${formatErrors(errors)}`);
    /** @type {Map<string, typeof notes>} */
    const byTicker = new Map();
    for (const n of notes) byTicker.set(n.ticker, [...(byTicker.get(n.ticker) ?? []), n]);
    return { notes, byTicker };
  };

  return {
    name: 'convexa-research',
    configResolved(config) {
      isBuild = config.command === 'build';
      base = config.base;
      assetsDir = config.build.assetsDir;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      let loaded;
      try {
        loaded = load();
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
      /** @type {Record<string, string>} */
      const urls = {};
      for (const [ticker, list] of loaded.byTicker) {
        if (isBuild) {
          const source = JSON.stringify(list);
          const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
          const fileName = path.posix.join(assetsDir, `research-${ticker}-${hash}.json`);
          this.emitFile({ type: 'asset', fileName, source });
          urls[ticker] = `${base}${fileName}`;
        } else {
          urls[ticker] = `${DEV_PREFIX}${encodeURIComponent(ticker)}.json`;
        }
        for (const n of list) this.addWatchFile(path.join(repoRoot, n.path));
      }
      return [
        `export const researchIndex = ${JSON.stringify(summarize(loaded.notes))};`,
        `const urls = ${JSON.stringify(urls)};`,
        `export function researchUrl(ticker) { return Object.hasOwn(urls, ticker) ? urls[ticker] : null; }`,
        `export { freshness, upcoming, localToday } from ${JSON.stringify(FRESHNESS)};`,
      ].join('\n');
    },
    configureServer(server) {
      server.watcher.add(researchDir);
      const refresh = (file) => {
        if (!path.resolve(file).startsWith(researchDir + path.sep)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('change', refresh);
      server.watcher.on('unlink', refresh);
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith(DEV_PREFIX)) return next();
        const ticker = decodeURIComponent(url.slice(DEV_PREFIX.length).replace(/\.json$/, ''));
        try {
          const list = load().byTicker.get(ticker);
          res.statusCode = list ? 200 : 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(JSON.stringify(list ?? []));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(error instanceof Error ? error.message : String(error));
        }
      });
    },
  };
}
