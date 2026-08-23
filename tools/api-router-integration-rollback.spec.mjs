import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { proveRollback } from './api-router-integration-rollback.mjs';

const root = process.cwd();
const rev = (name) => execFileSync('git', ['rev-parse', name], { cwd: root, encoding: 'utf8' }).trim();

test('full replacement rollback is disposable and preserves declared persistence bytes', () => {
  const data = mkdtempSync(join(tmpdir(), 'convexa-router-data-'));
  const nested = join(data, 'market', 'quotes.bin');
  mkdirSync(join(data, 'market'), { recursive: true });
  writeFileSync(nested, Buffer.from([0, 1, 2, 255]));
  const before = readFileSync(nested);
  try {
    const receipt = proveRollback({
      root,
      preRevision: rev('HEAD^'),
      replacementRevision: rev('HEAD'),
      dataDir: data,
    });
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.residual_tracked_changes, 0);
    assert.deepEqual(readFileSync(nested), before);
    assert.equal(receipt.data_before.sha256, receipt.data_after.sha256);
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
});

test('rollback refuses an omitted persistence root', () => {
  assert.throws(
    () => proveRollback({ root, preRevision: rev('HEAD^'), replacementRevision: rev('HEAD') }),
    /--data-dir is required/,
  );
});
