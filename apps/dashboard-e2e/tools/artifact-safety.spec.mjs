import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { scanArtifactTree } from './artifact-safety.mjs';
test('artifact scanner permits synthetic loopback evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-'));
  fs.writeFileSync(
    path.join(root, 'trace.txt'),
    'fixture-user@fixture.invalid http://127.0.0.1:4200',
  );
  assert.equal(scanArtifactTree(root).ok, true);
});
test('artifact scanner rejects credential and non-loopback canaries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-'));
  fs.writeFileSync(
    path.join(root, 'trace.txt'),
    'Authorization: Bearer token https://production.example.com',
  );
  assert.equal(scanArtifactTree(root).ok, false);
});
