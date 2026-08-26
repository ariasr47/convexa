import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { proveRollback } from './api-router-integration-rollback.mjs';

const root = process.cwd();
const rev = (name) =>
  execFileSync('git', ['rev-parse', name], { cwd: root, encoding: 'utf8' }).trim();

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

test('rollback accepts a replacement patch larger than the subprocess default buffer', () => {
  const repository = mkdtempSync(join(tmpdir(), 'convexa-router-large-replacement-'));
  const data = mkdtempSync(join(tmpdir(), 'convexa-router-large-data-'));
  try {
    execFileSync('git', ['init'], { cwd: repository });
    execFileSync('git', ['config', 'user.name', 'Convexa Test'], { cwd: repository });
    execFileSync('git', ['config', 'user.email', 'test@convexa.invalid'], { cwd: repository });
    writeFileSync(join(repository, 'baseline.txt'), 'baseline\n');
    execFileSync('git', ['add', '.'], { cwd: repository });
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: repository });
    const preRevision = revAt(repository, 'HEAD');

    writeFileSync(join(repository, 'large.bin'), randomBytes(2 * 1024 * 1024));
    execFileSync('git', ['add', '.'], { cwd: repository });
    execFileSync('git', ['commit', '-m', 'large replacement'], { cwd: repository });
    const replacementRevision = revAt(repository, 'HEAD');

    const receipt = proveRollback({
      root: repository,
      preRevision,
      replacementRevision,
      dataDir: data,
    });
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.residual_tracked_changes, 0);
  } finally {
    rmSync(repository, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function revAt(repository, name) {
  return execFileSync('git', ['rev-parse', name], { cwd: repository, encoding: 'utf8' }).trim();
}
