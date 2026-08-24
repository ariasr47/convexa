import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
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
    scenarios: Array.from({ length: 6 }, (_, i) => ({ id: `scenario-${i}` })),
  };
}

test('strict visual summary validates arithmetic, inventory and file hash', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const summary = base(root);
  assert.doesNotThrow(() => validateSummary(summary, { root }));
});
test('Chromium summary accepts scalar inventory identity and project fields', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const common = base(root);
  delete common.scenarios;
  const summary = {
    ...common,
    gate: 'chromium',
    inventory_id: 'pre-feature-52-v1',
    project: 'chromium',
    tests: Array.from({ length: 52 }, (_, i) => ({ id: `test-${i}` })),
  };
  assert.doesNotThrow(() => validateSummary(summary, { root }));
});
test('summary rejects unknown keys, zero selection and hash mismatch', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const summary = base(root);
  assert.throws(() => validateSummary({ ...summary, nope: true }, { root }));
  assert.throws(() => validateSummary({ ...summary, selected: 0 }, { root }));
  summary.artifacts[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateSummary(summary, { root }));
});
test('summary rejects flaky or not-run pass', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const summary = base(root);
  assert.throws(() => validateSummary({ ...summary, flaky: 1, passed: 5, executed: 6 }, { root }));
});
test('readSummary rejects source/path escape', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const summary = base(root);
  summary.artifacts[0].path = '../outside';
  assert.throws(() => readSummary(path.join(root, 'x.json'), { root: process.cwd() }));
});
