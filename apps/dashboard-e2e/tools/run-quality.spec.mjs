import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CHILDREN, aggregateStatus, validateChildCatalog } from './lib/aggregate.mjs';
import { spawnQualityChildren } from './run-quality.mjs';
test('aggregate freezes exactly four ordered children and distinct ports', () => {
  assert.equal(CHILDREN.length, 4);
  assert.deepEqual(
    CHILDREN.map((x) => x.port),
    [4210, 4211, 4212, 4213],
  );
  assert.doesNotThrow(() => validateChildCatalog());
  assert.throws(() => validateChildCatalog([...CHILDREN, { target: 'visual-update', port: 4214 }]));
});
test('aggregate status preserves incomplete over failure over pass', () => {
  assert.equal(aggregateStatus([{ exit_code: 0, status: 'pass' }]), 'pass');
  assert.equal(aggregateStatus([{ exit_code: 1, status: 'fail' }]), 'fail');
  assert.equal(aggregateStatus([{ exit_code: null, status: 'incomplete' }]), 'incomplete');
});

test('Windows aggregate uses real shell-free child launches and preserves spawn errors', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-quality-spawn-'));
  const log = path.join(dir, 'children.log');
  const fixture = path.join(dir, 'npm-cli-fixture.mjs');
  fs.writeFileSync(
    fixture,
    `import fs from 'node:fs';\nconst target = process.argv.find((x) => x.startsWith('dashboard-e2e:'));\nfs.appendFileSync(${JSON.stringify(log)}, target + ':' + process.env.BROWSER_QUALITY_PORT + '\\n');\nprocess.exit(target.endsWith(':visual') ? 7 : 0);\n`,
  );

  const results = await Promise.all(
    spawnQualityChildren({
      platform: 'win32',
      execPath: process.execPath,
      npmCliPath: fixture,
      cwd: dir,
      env: {},
      runId: 'run-spawn-test',
      source: 'a'.repeat(40),
    }),
  );
  assert.deepEqual(
    results.map(({ target, exit_code, invocation_count }) => [target, exit_code, invocation_count]),
    [
      ['dashboard-e2e:e2e', 0, 1],
      ['dashboard-e2e:compat', 0, 1],
      ['dashboard-e2e:a11y', 0, 1],
      ['dashboard-e2e:visual', 7, 1],
    ],
  );
  const logged = new Map(
    fs
      .readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((line) => line.split(':'))
      .map(([scope, name, port]) => [`${scope}:${name}`, port]),
  );
  assert.equal(logged.size, 4);
  assert.deepEqual(Object.fromEntries(logged), {
    'dashboard-e2e:e2e': '4210',
    'dashboard-e2e:compat': '4211',
    'dashboard-e2e:a11y': '4212',
    'dashboard-e2e:visual': '4213',
  });

  const spawnErrors = await Promise.all(
    spawnQualityChildren({
      platform: 'win32',
      execPath: path.join(dir, 'missing-node.exe'),
      npmCliPath: fixture,
      cwd: dir,
      env: {},
      runId: 'run-error-test',
      source: 'b'.repeat(40),
    }),
  );
  assert.equal(spawnErrors.length, 4);
  for (const result of spawnErrors) {
    assert.equal(result.invocation_count, 1);
    assert.equal(result.status, 'incomplete');
    assert.match(result.error, /ENOENT|spawn/);
    assert.match(result.target, /^dashboard-e2e:/);
  }
});
