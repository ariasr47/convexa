import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CHILDREN, aggregateStatus } from './lib/aggregate.mjs';
import {
  buildQualityReceipt,
  prepareThenSpawnQualityChildren,
  spawnQualityChildren,
  validateChildEvidence,
} from './run-quality.mjs';
test('aggregate status preserves incomplete over failure over pass', () => {
  assert.equal(aggregateStatus([{ exit_code: 0, status: 'pass' }]), 'pass');
  assert.equal(aggregateStatus([{ exit_code: 1, status: 'fail' }]), 'fail');
  assert.equal(aggregateStatus([{ exit_code: null, status: 'incomplete' }]), 'incomplete');
});

test('aggregate completes one canonical dashboard build before starting all prebuilt children', async () => {
  const events = [];
  const childPromises = await prepareThenSpawnQualityChildren({
    runId: 'run-prebuilt-test',
    source: 'a'.repeat(40),
    spawnOptions: { env: { QUALITY_TEST_MARKER: 'preserved' } },
    prepareFn: async () => {
      events.push('build:start');
      await Promise.resolve();
      events.push('build:close');
      return { exit_code: 0, error: null };
    },
    spawnChildrenFn: (options) => {
      events.push('children:start');
      assert.equal(options.prebuildStatus, 'pass');
      assert.equal(options.env.QUALITY_TEST_MARKER, 'preserved');
      return CHILDREN.map((child) =>
        Promise.resolve({ target: child.target, exit_code: 0, status: 'pass' }),
      );
    },
  });
  assert.deepEqual(events, ['build:start', 'build:close', 'children:start']);
  assert.equal((await Promise.all(childPromises)).length, 3);
});

test('a failed dashboard build still launches all three children once with fail-closed status', async () => {
  let optionsSeen;
  const childPromises = await prepareThenSpawnQualityChildren({
    runId: 'run-prebuild-failure',
    source: 'b'.repeat(40),
    prepareFn: async () => ({ exit_code: 7, error: 'build failed' }),
    spawnChildrenFn: (options) => {
      optionsSeen = options;
      return CHILDREN.map((child) =>
        Promise.resolve({ target: child.target, exit_code: 1, status: 'incomplete' }),
      );
    },
  });
  assert.equal(optionsSeen.prebuildStatus, 'fail');
  assert.equal((await Promise.all(childPromises)).length, 3);
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
    { ...base, gate: 'compatibility' },
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
  const stale = validateChildEvidence({
    child,
    result: { exit_code: 1, status: 'incomplete' },
    runId: base.run_id,
    source: base.source_revision,
    root: 'C:/workspace',
    summaryReader: () => base,
    hashReader: () => 'b'.repeat(64),
  });
  assert.equal(stale.status, 'incomplete');
  assert.equal(stale.summary_sha256, 'b'.repeat(64));
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
    `import fs from 'node:fs';\nconst target = process.argv.find((x) => x.startsWith('dashboard-e2e:'));\nconst childRoot = process.env.NX_INVOCATION_ROOT_PID ?? String(process.pid);\nfs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ target, port: process.env.BROWSER_QUALITY_PORT, childRoot, workspaceData: process.env.NX_WORKSPACE_DATA_DIRECTORY, runId: process.env.BROWSER_QUALITY_RUN_ID, marker: process.env.QUALITY_TEST_MARKER, workers: process.env.BROWSER_QUALITY_WORKERS }) + '\\n');\nprocess.exit(target.endsWith(':a11y') ? 7 : 0);\n`,
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
      ['dashboard-e2e:a11y', 7, 1],
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
  assert.equal(logged.size, 3);
  assert.deepEqual(Object.fromEntries([...logged].map(([target, entry]) => [target, entry.port])), {
    'dashboard-e2e:e2e': '4210',
    'dashboard-e2e:compat': '4211',
    'dashboard-e2e:a11y': '4212',
  });
  assert.equal(new Set([...logged.values()].map((entry) => entry.workspaceData)).size, 3);
  for (const entry of logged.values()) {
    assert.notEqual(entry.childRoot, 'aggregate-parent');
    assert.match(entry.childRoot, /^\d+$/);
    assert.equal(entry.runId, 'run-spawn-test');
    assert.equal(entry.marker, 'preserved');
    assert.equal(entry.workers, '1');
    assert.match(
      entry.workspaceData.replaceAll('\\', '/'),
      /\/\.nx\/workspace-data\/browser-quality\/[a-f0-9]{64}$/,
    );
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
  assert.equal(spawnErrors.length, 3);
  for (const result of spawnErrors) {
    assert.equal(result.invocation_count, 1);
    assert.equal(result.status, 'incomplete');
    assert.match(result.error, /ENOENT|spawn/);
    assert.match(result.target, /^dashboard-e2e:/);
  }
});
