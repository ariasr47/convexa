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
// (lean-tests batch 22) The shared fixture was a visual-gate summary; the visual gate is retired,
// so the fixture is now the Chromium summary. Derived from the real manifest, not a frozen literal
// — the count/id move together with it (curvature-v2-foundations FE-10 bumped
// `pre-feature-52-v1`/52 → `curvature-v2-foundations-75-v1`/75; this fixture must track whatever
// the manifest says next time it moves too).
function base(root, manifest = loadManifest()) {
  const chromiumCount = manifest.full_chromium.tests.length;
  return {
    schema_version: 1,
    gate: 'chromium',
    run_id: 'run-1',
    source_revision: 'a'.repeat(40),
    selected: chromiumCount,
    executed: chromiumCount,
    passed: chromiumCount,
    failed: 0,
    flaky: 0,
    not_run: 0,
    status: 'pass',
    playwright_version: '1.62.1',
    browser_revision: '1234',
    host_platform: process.platform,
    artifacts: [artifact(root)],
    inventory_id: manifest.full_chromium.inventory_id,
    project: 'chromium',
    tests: manifest.full_chromium.tests.map((record) => ({
      test_id: record.test_id,
      file: record.file,
      title_path: record.title_path,
      project: 'chromium',
      status: 'passed',
      retries: 0,
      artifact_paths: [],
    })),
  };
}

test('Chromium summary accepts scalar inventory identity and project fields', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const manifest = loadManifest();
  const summary = base(root, manifest);
  assert.doesNotThrow(() => validateSummary(summary, { root, manifest }));
});
test('summary rejects exact-count and identity mutations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-'));
  const manifest = loadManifest();
  const summary = base(root, manifest);
  const records = summary.tests;
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
      { ...summary, flaky: 1, passed: summary.passed - 1 },
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
