import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CHILDREN, aggregateStatus, validateChildCatalog } from './lib/aggregate.mjs';
import {
  buildQualityReceipt,
  spawnQualityChildren,
  validateChildEvidence,
} from './run-quality.mjs';
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

test('aggregate bounds only child Playwright workers and preserves the exact environment', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-quality-workers-'));
  const fixture = path.join(dir, 'npm-cli-fixture.mjs');
  fs.writeFileSync(
    fixture,
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(path.join(dir, 'env.json'))}, JSON.stringify({ workers: process.env.BROWSER_QUALITY_WORKERS, marker: process.env.QUALITY_TEST_MARKER })); process.exit(0);`,
  );
  await Promise.all(
    spawnQualityChildren({
      platform: 'win32',
      execPath: process.execPath,
      npmCliPath: fixture,
      cwd: dir,
      env: { QUALITY_TEST_MARKER: 'preserved' },
      runId: 'run-worker-test',
      source: 'a'.repeat(40),
    }),
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'env.json'), 'utf8')), {
    workers: '1',
    marker: 'preserved',
  });
});

test('child evidence validates identity, status and artifact hash after settlement', () => {
  const child = CHILDREN[0];
  const base = {
    gate: child.gate,
    run_id: 'run-evidence',
    source_revision: 'a'.repeat(40),
    status: 'pass',
  };
  const pass = validateChildEvidence({
    child,
    result: { exit_code: 0 },
    runId: base.run_id,
    source: base.source_revision,
    root: 'C:/workspace',
    summaryReader: () => base,
    hashReader: () => 'b'.repeat(64),
  });
  assert.deepEqual(pass, {
    target: child.target,
    execution_key: 'run-evidence:dashboard-e2e:e2e',
    invocation_count: 1,
    exit_code: 0,
    summary_path: 'apps/dashboard-e2e/test-output/playwright/chromium/summary.json',
    summary_sha256: 'b'.repeat(64),
    status: 'pass',
  });
  for (const mutation of [
    { ...base, run_id: 'wrong' },
    { ...base, source_revision: 'c'.repeat(40) },
    { ...base, gate: 'visual' },
    { ...base, status: 'fail' },
  ]) {
    const result = validateChildEvidence({
      child,
      result: { exit_code: 0 },
      runId: base.run_id,
      source: base.source_revision,
      root: 'C:/workspace',
      summaryReader: () => mutation,
      hashReader: () => 'b'.repeat(64),
    });
    assert.equal(result.status, 'fail');
  }
  const missing = validateChildEvidence({
    child,
    result: { exit_code: 1 },
    runId: base.run_id,
    source: base.source_revision,
    root: 'C:/workspace',
    summaryReader: () => {
      throw new Error('missing summary');
    },
  });
  assert.equal(missing.status, 'incomplete');
  assert.equal(missing.summary_sha256, null);
});

test('aggregate receipt has the exact declared fields and status precedence', () => {
  const child = {
    target: 'dashboard-e2e:e2e',
    execution_key: 'run-receipt:dashboard-e2e:e2e',
    invocation_count: 1,
    exit_code: 0,
    summary_path: 'apps/dashboard-e2e/test-output/playwright/chromium/summary.json',
    summary_sha256: 'b'.repeat(64),
    status: 'pass',
  };
  const receipt = buildQualityReceipt({
    runId: 'run-receipt',
    source: 'a'.repeat(40),
    startedAt: '2026-08-24T00:00:00.000Z',
    completedAt: '2026-08-24T00:00:01.000Z',
    children: [child],
  });
  assert.deepEqual(Object.keys(receipt), [
    'schema_version',
    'gate',
    'run_id',
    'source_revision',
    'started_at',
    'completed_at',
    'status',
    'children',
  ]);
  assert.equal(receipt.status, 'pass');
  assert.equal(
    buildQualityReceipt({ ...receipt, children: [{ ...child, status: 'fail' }] }).status,
    'fail',
  );
  assert.equal(
    buildQualityReceipt({ ...receipt, children: [{ ...child, status: 'incomplete' }] }).status,
    'incomplete',
  );
});

test('Windows aggregate uses real shell-free child launches and preserves spawn errors', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-quality-spawn-'));
  const log = path.join(dir, 'children.log');
  const fixture = path.join(dir, 'npm-cli-fixture.mjs');
  fs.writeFileSync(
    fixture,
    `import fs from 'node:fs';\nconst target = process.argv.find((x) => x.startsWith('dashboard-e2e:'));\nconst childRoot = process.env.NX_INVOCATION_ROOT_PID ?? String(process.pid);\nfs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ target, port: process.env.BROWSER_QUALITY_PORT, childRoot, runId: process.env.BROWSER_QUALITY_RUN_ID, marker: process.env.QUALITY_TEST_MARKER, workers: process.env.BROWSER_QUALITY_WORKERS }) + '\\n');\nprocess.exit(target.endsWith(':visual') ? 7 : 0);\n`,
  );

  const results = await Promise.all(
    spawnQualityChildren({
      platform: 'win32',
      execPath: process.execPath,
      npmCliPath: fixture,
      cwd: dir,
      env: { NX_INVOCATION_ROOT_PID: 'aggregate-parent', QUALITY_TEST_MARKER: 'preserved' },
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
      .map((line) => JSON.parse(line))
      .map((entry) => [entry.target, entry]),
  );
  assert.equal(logged.size, 4);
  assert.deepEqual(Object.fromEntries([...logged].map(([target, entry]) => [target, entry.port])), {
    'dashboard-e2e:e2e': '4210',
    'dashboard-e2e:compat': '4211',
    'dashboard-e2e:a11y': '4212',
    'dashboard-e2e:visual': '4213',
  });
  for (const entry of logged.values()) {
    assert.notEqual(entry.childRoot, 'aggregate-parent');
    assert.match(entry.childRoot, /^\d+$/);
    assert.equal(entry.runId, 'run-spawn-test');
    assert.equal(entry.marker, 'preserved');
    assert.equal(entry.workers, '1');
  }

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
