import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// This suite proves the compositional gate in a disposable package root.  The real Rust
// evaluator supplies the recorded result in production; here each mutation substitutes only
// that command while the four preceding aggregate stages remain unchanged.
const families = [
  'p95_latency',
  'maximum_latency',
  'unexpected_error',
  'disconnect',
  'rss',
  'handles',
  'tokio_tasks',
  'child_recovery',
  'aggregate_recovery',
  'elapsed',
  'connector_isolation',
];

function fixtureRoot(family, exitCode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capacity-gate-'));
  const observed = {
    family,
    observed: 123.5,
    unit: 'ms',
    threshold: 100,
    status: exitCode ? 'did_not_pass' : 'pass',
  };
  const expectedBytes = JSON.stringify(observed);
  fs.writeFileSync(path.join(root, 'observed.json'), expectedBytes);
  fs.writeFileSync(
    path.join(root, 'capacity.mjs'),
    `
    import fs from 'node:fs';
    const result = fs.readFileSync(new URL('./observed.json', import.meta.url), 'utf8');
    fs.mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
    fs.writeFileSync(new URL('./data/capacity.json', import.meta.url), result);
    process.exit(Number(process.env.CAPACITY_EXIT || 0));
  `,
  );
  fs.writeFileSync(
    path.join(root, 'aggregate.mjs'),
    `
    import { spawnSync } from 'node:child_process';
    const stages = ['unit', 'connector', 'optional', 'capacity'];
    for (const stage of stages) {
    const result = spawnSync(process.execPath, stage === 'capacity' ? ['capacity.mjs'] : ['-e', 'process.exit(0)'], { cwd: process.cwd(), stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  `,
  );
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ type: 'module', scripts: { test: 'node aggregate.mjs' } }),
  );
  return { root, observed, expectedBytes };
}

function runDisposable(family, exitCode) {
  const { root, observed, expectedBytes } = fixtureRoot(family, exitCode);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : npm;
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `${npm} test --silent`]
      : ['test', '--silent'];
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, CAPACITY_EXIT: String(exitCode) },
    encoding: 'utf8',
  });
  const retainedPath = path.join(root, 'data/capacity.json');
  assert.ok(
    fs.existsSync(retainedPath),
    `capacity report missing (status=${result.status}, error=${result.error ?? ''}, stderr=${result.stderr ?? ''})`,
  );
  const retainedBytes = fs.readFileSync(retainedPath, 'utf8');
  const byteEqual = retainedBytes === expectedBytes;
  assert.equal(byteEqual, true, 'observed value/unit/threshold bytes must be retained exactly');
  const retained = JSON.parse(retainedBytes);
  assert.deepEqual(
    retained,
    observed,
    'observed value/unit/threshold must be retained byte-for-byte',
  );
  return result.status ?? 1;
}

for (const family of families) {
  test(`rejects ${family} and propagates the non-zero exit`, () => {
    assert.notEqual(runDisposable(family, 1), 0);
  });
}

test('all-success control propagates zero exit', () => {
  assert.equal(runDisposable('all_success', 0), 0);
});
