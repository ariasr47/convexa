import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  rmSync as rmSyncFs,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { archiveSourcemaps } from './archive-sourcemaps.mjs';
import {
  checkHeads,
  planHeads,
  readInputs,
  readPosts,
  stagingHead,
  writeHeads,
} from './write-blog-heads.mjs';
import { writeRoutes } from './write-dashboard-routes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
test('dashboard mode wrapper rejects invalid explicit values before Nx starts', () => {
  const result = spawnSync(node, [path.join(root, 'tools', 'build-dashboard.mjs')], {
    cwd: root,
    env: { ...process.env, VITE_DATA_MODE: 'preview' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /expected demo or live/);
});

test('Pages routes exclude every Function in demo and preserve live API routing', () => {
  const dist = mkdtempSync(path.join(os.tmpdir(), 'convexa-routes-'));
  try {
    for (const mode of ['demo', 'live']) {
      writeRoutes(dist, mode);
      const routes = JSON.parse(readFileSync(path.join(dist, '_routes.json'), 'utf8'));
      if (mode === 'demo') {
        assert.deepEqual(routes, { version: 1, include: ['/*'], exclude: ['/*'] });
        assert.deepEqual(JSON.parse(readFileSync(path.join(dist, 'demo-mode.json'), 'utf8')), {
          mode,
          scenarioId: 'portfolio-2026-10-07-v1',
        });
      } else {
        assert.deepEqual(routes, { version: 1, include: ['/api/*'], exclude: [] });
        assert.deepEqual(JSON.parse(readFileSync(path.join(dist, 'demo-mode.json'), 'utf8')), {
          mode,
          scenarioId: null,
        });
      }
    }
  } finally {
    const resolved = path.resolve(dist);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    rmSyncFs(resolved, { recursive: true, force: true });
  }
});

function assertResolvedBuildIdentity(project) {
  assert.deepEqual(project.targets.build.inputs, [
    'production',
    '^production',
    { env: 'VITE_DATA_MODE' },
    { env: 'ANALYZE' },
    { runtime: 'node --version' },
    '{workspaceRoot}/tools/build-dashboard.mjs',
    '{workspaceRoot}/tools/write-dashboard-routes.mjs',
    '{workspaceRoot}/tools/archive-sourcemaps.mjs',
    '{workspaceRoot}/tools/precompress-dashboard.mjs',
    '{workspaceRoot}/research/**/*',
    // vite.config.mts loads the research-notes plugin, which imports its siblings (filing-check.mjs
    // through blocks.mjs), and pages/blog/posts.ts bundles each post's source.
    '{workspaceRoot}/tools/research-notes/**/*.mjs',
    '!{workspaceRoot}/tools/research-notes/**/*.spec.mjs',
    '{workspaceRoot}/docs/blog/posts.json',
    '{workspaceRoot}/docs/blog/*.md',
    // vite.config.mts inlines the root package.json "version" (the footer's), and reads no other
    // field of it, so only a version change misses the cache.
    { json: '{workspaceRoot}/package.json', fields: ['version'] },
  ]);
  assert.deepEqual(project.targets.build.outputs, [
    '{projectRoot}/dist',
    '{projectRoot}/sourcemaps-private/current',
  ]);
  assert.deepEqual(project.targets.build.configurations.production.env, { NODE_ENV: 'production' });
}

test('resolved Nx build cache identity rejects missing mode or postprocessor inputs', () => {
  const result = spawnSync(
    node,
    [
      path.join(root, 'node_modules', 'nx', 'dist', 'bin', 'nx.js'),
      'show',
      'project',
      '@convexa/dashboard',
      '--json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NX_DAEMON: 'false', NX_NO_CLOUD: 'true' },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const project = JSON.parse(result.stdout);
  assertResolvedBuildIdentity(project);
  const poisoned = structuredClone(project);
  poisoned.targets.build.inputs = poisoned.targets.build.inputs.filter(
    (input) => input !== '{env.VITE_DATA_MODE}',
  );
  poisoned.targets.build.inputs = poisoned.targets.build.inputs.filter(
    (input) => !(typeof input === 'object' && input.env === 'VITE_DATA_MODE'),
  );
  assert.throws(() => assertResolvedBuildIdentity(poisoned), { code: 'ERR_ASSERTION' });

  const poisonedProductionEnv = structuredClone(project);
  delete poisonedProductionEnv.targets.build.configurations.production.env;
  assert.throws(() => assertResolvedBuildIdentity(poisonedProductionEnv), {
    code: 'ERR_ASSERTION',
  });
});

test('private map archive replaces only current, preserves history, and records empty builds', () => {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'convexa-maps-'));
  const distDir = path.join(workspaceRoot, 'dist');
  const archiveRoot = path.join(workspaceRoot, 'sourcemaps-private');
  const currentDir = path.join(archiveRoot, 'current');
  const historyDir = path.join(archiveRoot, 'archive-previous');
  try {
    mkdirSync(path.join(distDir, 'assets'), { recursive: true });
    mkdirSync(currentDir, { recursive: true });
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(path.join(distDir, 'assets', 'z.js.map'), 'z-map');
    writeFileSync(path.join(distDir, 'assets', 'a.js.map'), 'a-map');
    writeFileSync(path.join(currentDir, 'stale.map'), 'stale');
    writeFileSync(path.join(historyDir, 'keep.map'), 'keep');
    const result = archiveSourcemaps({ workspaceRoot, distDir, currentDir });
    assert.equal(result.count, 2);
    assert.deepEqual(
      result.files.map((file) => file.path),
      ['assets/a.js.map', 'assets/z.js.map'],
    );
    assert.equal(result.files[0].sha256, createHash('sha256').update('a-map').digest('hex'));
    assert.equal(existsSync(path.join(currentDir, 'stale.map')), false);
    assert.equal(readFileSync(path.join(historyDir, 'keep.map'), 'utf8'), 'keep');
    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    writeFileSync(path.join(currentDir, 'stale-again.map'), 'stale');
    assert.equal(archiveSourcemaps({ workspaceRoot, distDir, currentDir }).count, 0);
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(currentDir, 'MANIFEST.json'), 'utf8')).files,
      [],
    );
    assert.equal(existsSync(path.join(currentDir, 'stale-again.map')), false);
    assert.throws(
      () =>
        archiveSourcemaps({
          workspaceRoot,
          distDir,
          currentDir: path.join(os.tmpdir(), 'outside-current'),
        }),
      /outside workspace/,
    );
  } finally {
    const resolved = path.resolve(workspaceRoot);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    rmSync(resolved, { recursive: true, force: true });
  }
});

// ---- Served heads and edge routing (site audit 2026-10-25, B5) -----------------------------------

/** A dist with the shell and public/ as the build copies them, run through the head step. */
async function headsDist(mode) {
  const dist = mkdtempSync(path.join(os.tmpdir(), `convexa-heads-${mode}-`));
  cpSync(path.join(root, 'apps', 'dashboard', 'public'), dist, { recursive: true });
  cpSync(path.join(root, 'apps', 'dashboard', 'index.html'), path.join(dist, 'index.html'));
  writeHeads(dist, { ...(await readInputs(root)), mode });
  return dist;
}

function removeTmp(dir) {
  const resolved = path.resolve(dir);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
  rmSync(resolved, { recursive: true, force: true });
}

/** Cloudflare Pages' order, as its docs give it: the first matching _redirects rule applies before
 *  any file; then the file (`/x` from x.html or x/index.html); then the closest 404.html with 404,
 *  or, with no 404.html at all, the root for every path (its single-page-app mode). */
function servePages(dist, pathname) {
  const isFile = (rel) =>
    existsSync(path.join(dist, rel)) && statSync(path.join(dist, rel)).isFile();
  const asset = (p) => {
    if (p === '/') return 'index.html';
    const rel = p.slice(1);
    const tries = p.endsWith('/')
      ? [`${rel}index.html`]
      : [rel, `${rel}.html`, `${rel}/index.html`];
    return tries.find(isFile) ?? null;
  };
  const missing = () =>
    isFile('404.html') ? { status: 404, file: '404.html' } : { status: 200, file: 'index.html' };
  const rules = isFile('_redirects')
    ? readFileSync(path.join(dist, '_redirects'), 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split(/\s+/))
    : [];
  for (const [from, to, status] of rules) {
    const pattern = from
      .split('/')
      .map((seg) =>
        seg === '*'
          ? '.*'
          : seg.startsWith(':')
            ? '[^/]+'
            : seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('/');
    if (!new RegExp(`^${pattern}$`).test(pathname)) continue;
    assert.equal(status, '200', `${from}: only rewrites are expected`);
    const file = asset(to);
    return file ? { status: 200, file } : missing();
  }
  const file = asset(pathname);
  return file ? { status: 200, file } : missing();
}

const SAMPLES = {
  ':ticker': ['SPY', 'NVDA', 'spy', 'ZZZQ'],
  ':symbol': ['SPY', 'NVDA', 'ZZZQ'],
  ':slug': ['2026-10-13-initiation', 'no-such-note'],
};
const UNKNOWN = [
  '/this-page-does-not-exist-404',
  '/llms.txt',
  '/manifest.json',
  '/.well-known/ai-catalog.json',
  '/blog/no-such-post',
  '/research/nope',
  '/ticker/SPY/nope',
  // SEC-5's second half: a hashed chunk a deploy removed gets 404, not the shell as a 200.
  '/assets/Missing-abc123.js',
];

/** Every path of app.tsx's route table, with sample values for its parameters. */
function routeTableUrls(postSlugs) {
  const source = readFileSync(
    path.join(root, 'apps', 'dashboard', 'src', 'app', 'app.tsx'),
    'utf8',
  );
  const paths = ['/', ...[...source.matchAll(/\spath="([^"]+)"/g)].map((m) => m[1])];
  const samples = { ...SAMPLES, ':file': postSlugs };
  const urls = [];
  for (const p of paths.filter((x) => x !== '*')) {
    let expanded = [p];
    for (const [param, values] of Object.entries(samples)) {
      expanded = expanded.flatMap((u) =>
        u.split('/').includes(param) ? values.map((v) => u.replace(param, v)) : [u],
      );
    }
    assert.ok(
      expanded.every((u) => !u.includes(':')),
      `${p}: a parameter with no samples`,
    );
    urls.push(...expanded);
  }
  return { paths, urls };
}

/** The misses: a route-table address that is not a 200 page of the shell, or an unknown address
 *  that is not a noindex 404. */
function routingMisses(dist, urls) {
  const misses = [];
  for (const url of urls) {
    const { status, file } = servePages(dist, url);
    const html = readFileSync(path.join(dist, file), 'utf8');
    if (status !== 200 || !html.includes('<div id="root">')) {
      misses.push(`${url} -> ${status} ${file}`);
    }
  }
  for (const url of UNKNOWN) {
    const { status, file } = servePages(dist, url);
    const html = readFileSync(path.join(dist, file), 'utf8');
    if (status !== 404 || !/<meta name="robots" content="noindex/.test(html)) {
      misses.push(`${url} -> ${status} ${file}`);
    }
  }
  return misses;
}

test('every route in app.tsx is served 200 and every other address 404 noindex', async () => {
  const { postsJson } = await readInputs(root);
  const { paths, urls } = routeTableUrls(readPosts(postsJson).map((post) => post.slug));
  assert.ok(paths.includes('/ticker/:symbol/research/:slug') && paths.length > 20, 'app.tsx parse');
  for (const mode of ['live', 'demo']) {
    const dist = await headsDist(mode);
    try {
      assert.deepEqual(routingMisses(dist, urls), [], mode);
      // /api/* keeps the fallback it had; live, the API Function serves it before any rule.
      assert.deepEqual(servePages(dist, '/api/anything'), { status: 200, file: 'index.html' });
      // The guard fails: a static route with no page, and a route app.tsx gains with no rule.
      rmSync(path.join(dist, 'credits.html'));
      assert.deepEqual(routingMisses(dist, ['/credits', '/ticker/SPY/new-tab']), [
        '/credits -> 404 404.html',
        '/ticker/SPY/new-tab -> 404 404.html',
      ]);
    } finally {
      removeTmp(dist);
    }
  }
  // When the built dist is there, it agrees too.
  const built = path.join(root, 'apps', 'dashboard', 'dist');
  if (existsSync(path.join(built, '404.html'))) {
    assert.deepEqual(routingMisses(built, urls), [], 'apps/dashboard/dist');
  }
});

test("no listed route's head names / and staging pages are noindex with no canonical", async () => {
  const inputs = await readInputs(root);
  const indexHtml = readFileSync(path.join(root, 'apps', 'dashboard', 'index.html'), 'utf8');
  const posts = readPosts(inputs.postsJson);
  const homeTitle = indexHtml.match(/<title>([^<]*)<\/title>/)[1];
  const live = planHeads({ indexHtml, posts, ...inputs, mode: 'live' });
  const options = { origin: live.origin, mode: 'live', homeTitle };
  checkHeads(live.pages, options);
  const own = (p) => live.pages.find((page) => page.path === p).html;
  assert.match(
    own('/ticker/SPY'),
    /<link rel="canonical" href="https:\/\/convexa\.pages\.dev\/ticker\/SPY" \/>/,
  );
  assert.match(
    own('/credits'),
    /<meta property="og:url" content="https:\/\/convexa\.pages\.dev\/credits" \/>/,
  );
  // The guard fails on a listed route that kept the home head, or one whose canonical says /.
  const home = { file: 'credits.html', path: '/credits', html: indexHtml, listed: true };
  assert.throws(
    () => checkHeads([home], options),
    /canonical https:\/\/convexa\.pages\.dev\/, expected/,
  );
  const slash = { ...home, html: own('/credits').replace('dev/credits"', 'dev/"') };
  assert.throws(() => checkHeads([slash], options), /\/credits: canonical/);

  const pages = live.pages.map((page) => ({
    ...page,
    html: stagingHead(page.html, page.path ?? '/'),
  }));
  checkHeads(pages, { ...options, mode: 'demo' });
  assert.equal(stagingHead(pages[0].html, pages[0].path), pages[0].html, 'idempotent');
  assert.throws(
    () => checkHeads(live.pages.slice(0, 1), { ...options, mode: 'demo' }),
    /on a demo build/,
  );
});
