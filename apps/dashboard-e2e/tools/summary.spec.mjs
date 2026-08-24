import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadManifest } from './lib/manifest.mjs';
import { readSummary, validateSummary } from './lib/summary.mjs';

function artifact(root) {
  const file = path.join(root, 'evidence.txt');
  fs.writeFileSync(file, 'fixture');
  return {
    path: 'evidence.txt',
    sha256: crypto.createHash('sha256').update('fixture').digest('hex'),
  };
}
function base(root) {
  const scenarios = [
    'landing',
    'ticker-desktop',
    'ticker-offline-mobile',
    'positions-dense',
    'scanner-dense',
    'ai-recommendation',
  ];
  return {
    schema_version: 1,
    gate: 'visual',
    run_id: 'run-1',
    source_revision: 'a'.repeat(40),
    selected: 6,
    executed: 6,
    passed: 6,
    failed: 0,
    flaky: 0,
    not_run: 0,
    status: 'pass',
    playwright_version: '1.62.1',
    browser_revision: '1234',
    host_platform: process.platform,
    artifacts: [artifact(root)],
    scenarios: scenarios.map((scenario_id) => ({
      identity: ['chromium', 'visual.spec.ts', scenario_id],
      file: 'apps/dashboard-e2e/src/quality/visual.spec.ts',
      project: 'chromium',
      status: 'passed',
      retry: 0,
      artifact_paths: [],
      scenario_id,
      expected_path: null,
      expected_sha256: null,
      actual_path: null,
      actual_sha256: null,
      diff_path: null,
      diff_sha256: null,
    })),
  };
}

test('strict visual summary validates arithmetic, inventory and file hash', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const summary = base(root);
  assert.doesNotThrow(() => validateSummary(summary, { root, manifest: loadManifest() }));
});
test('Chromium summary accepts scalar inventory identity and project fields', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const common = { ...base(root), gate: 'chromium', selected: 52, executed: 52, passed: 52 };
  delete common.scenarios;
  const summary = {
    ...common,
    inventory_id: 'pre-feature-52-v1',
    project: 'chromium',
    tests: loadManifest().full_chromium.tests.map((record) => ({
      test_id: record.test_id,
      file: record.file,
      title_path: record.title_path,
      project: 'chromium',
      status: 'passed',
      retries: 0,
      artifact_paths: [],
    })),
  };
  assert.doesNotThrow(() => validateSummary(summary, { root, manifest: loadManifest() }));
});
test('summary rejects exact-count and identity mutations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const manifest = loadManifest();
  const common = { ...base(root), gate: 'chromium', selected: 52, executed: 52, passed: 52 };
  delete common.scenarios;
  const records = manifest.full_chromium.tests.map((record) => ({
    test_id: record.test_id,
    file: record.file,
    title_path: record.title_path,
    project: 'chromium',
    status: 'passed',
    retries: 0,
    artifact_paths: [],
  }));
  const summary = {
    ...common,
    inventory_id: 'pre-feature-52-v1',
    project: 'chromium',
    tests: records,
  };
  const options = { root, manifest };
  assert.throws(() => validateSummary({ ...summary, selected: 51 }, options));
  assert.throws(() =>
    validateSummary({ ...summary, tests: [...records.slice(0, -1), { ...records[0] }] }, options),
  );
  const missing = { ...records[0] };
  delete missing.retries;
  assert.throws(() =>
    validateSummary({ ...summary, tests: [missing, ...records.slice(1)] }, options),
  );
  assert.throws(() =>
    validateSummary(
      { ...summary, tests: [{ ...records[0], project: 'firefox' }, ...records.slice(1)] },
      options,
    ),
  );
});
test('summary rejects unknown keys, zero selection and hash mismatch', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const summary = base(root);
  assert.throws(() =>
    validateSummary({ ...summary, nope: true }, { root, manifest: loadManifest() }),
  );
  assert.throws(() =>
    validateSummary({ ...summary, selected: 0 }, { root, manifest: loadManifest() }),
  );
  summary.artifacts[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateSummary(summary, { root, manifest: loadManifest() }));
});
test('summary rejects flaky or not-run pass', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const summary = base(root);
  assert.throws(() =>
    validateSummary(
      { ...summary, flaky: 1, passed: 5, executed: 6 },
      { root, manifest: loadManifest() },
    ),
  );
});
test('readSummary rejects source/path escape', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const summary = base(root);
  summary.artifacts[0].path = '../outside';
  assert.throws(() => readSummary(path.join(root, 'x.json'), { root: process.cwd() }));
});
