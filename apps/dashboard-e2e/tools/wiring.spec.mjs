import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PUBLICATION_GATES, validatePublication } from './validate-publication.mjs';

test('browser workflow invokes the aggregate once and publishes four distinct roots', () => {
  const workflow = fs.readFileSync(
    new URL('../../../.github/workflows/ci.yml', import.meta.url),
    'utf8',
  );
  assert.equal((workflow.match(/run: npm run browser:quality/g) ?? []).length, 1);
  assert.equal(
    (workflow.match(/path: apps\/dashboard-e2e\/test-output\/playwright\//g) ?? []).length,
    4,
  );
  for (const gate of PUBLICATION_GATES)
    assert.match(workflow, new RegExp(`path: apps/dashboard-e2e/test-output/playwright/${gate}`));
  assert.doesNotMatch(workflow, /run: npm run browser:(chromium|compat|a11y|visual)\b/);
  assert.match(workflow, /npx playwright install --with-deps chromium firefox webkit/);
  for (const gate of PUBLICATION_GATES) {
    const publication = new RegExp(
      `if: always\\(\\)[\\s\\S]{0,500}path: apps/dashboard-e2e/test-output/playwright/${gate}`,
    );
    assert.match(workflow, publication);
  }
});

test('Linux visual candidates remain manually dispatched, read-only, and cannot publish to git', () => {
  const workflow = fs.readFileSync(
    new URL('../../../.github/workflows/browser-visual-linux-candidates.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request:|push:/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /npm run browser:visual:update -- --authorization/);
  assert.doesNotMatch(workflow, /contents: write/);
});

test('publication validator requires all four non-empty roots and matching summaries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-publication-'));
  for (const gate of PUBLICATION_GATES) {
    const directory = path.join(root, 'apps/dashboard-e2e/test-output/playwright', gate);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify({ gate }));
  }
  assert.doesNotThrow(() => validatePublication(root));
  fs.rmSync(path.join(root, 'apps/dashboard-e2e/test-output/playwright/visual'), {
    recursive: true,
  });
  assert.throws(() => validatePublication(root), /visual: missing artifact root/);
});
