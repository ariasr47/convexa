import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  rmSync as rmSyncFs,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { archiveSourcemaps } from './archive-sourcemaps.mjs';
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
