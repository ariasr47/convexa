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

/**
 * Regression guard for the defect the 2026-09 mainline merge exposed (GATE Z item 3).
 *
 * `git apply --reverse` writes only the WORKTREE, so the index kept describing the REPLACEMENT
 * tree while the residual comparison after it is index-aware. Every path the replacement
 * DELETED OR RENAMED AWAY therefore came back to disk with correct bytes yet stayed UNTRACKED,
 * and the proof reported a phantom whole-file deletion. The real case was a file-to-directory
 * rename, `services/session_chain_archive/coverage.rs` into `coverage/policy.rs`.
 *
 * This repository reproduces it: a file-to-directory rename plus a dirty tracked file the
 * replacement also modified (so `materializePaths` runs). Drop the staging step in the tool and
 * this test goes red with "residual tracked changes: src/services/coverage.rs".
 */
test('rollback reverses a file-to-directory rename with a dirty caller path', () => {
  const repository = mkdtempSync(join(tmpdir(), 'convexa-router-rename-'));
  const data = mkdtempSync(join(tmpdir(), 'convexa-router-rename-data-'));
  const run = (...args) => execFileSync('git', args, { cwd: repository });
  const lines = Array.from({ length: 40 }, (_, i) => `// coverage line ${i}`);
  const body = (marker) => `${lines.join('\n')}\n${marker}\n`;
  try {
    run('init');
    run('config', 'user.name', 'Convexa Test');
    run('config', 'user.email', 'test@convexa.invalid');
    run('config', 'core.autocrlf', 'false');
    mkdirSync(join(repository, 'src', 'services'), { recursive: true });
    writeFileSync(join(repository, 'src', 'services', 'coverage.rs'), body('// pre'));
    writeFileSync(join(repository, 'README.md'), 'pre\n');
    run('add', '.');
    run('commit', '-m', 'pre-edit');
    const preRevision = revAt(repository, 'HEAD');

    // File into directory: the moved body keeps >50% similarity so git records a rename.
    rmSync(join(repository, 'src', 'services', 'coverage.rs'));
    mkdirSync(join(repository, 'src', 'services', 'coverage'), { recursive: true });
    writeFileSync(
      join(repository, 'src', 'services', 'coverage', 'policy.rs'),
      body('// replacement'),
    );
    writeFileSync(join(repository, 'src', 'services', 'coverage', 'mod.rs'), 'pub mod policy;\n');
    writeFileSync(join(repository, 'README.md'), 'replacement\n');
    run('add', '-A');
    run('commit', '-m', 'file-to-directory replacement');
    const replacementRevision = revAt(repository, 'HEAD');

    // A tracked path the replacement also touched, left dirty in the caller's worktree.
    writeFileSync(join(repository, 'README.md'), 'replacement + local edit\n');

    const receipt = proveRollback({
      root: repository,
      preRevision,
      replacementRevision,
      dataDir: data,
    });
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.residual_tracked_changes, 0);
    assert.equal(receipt.rollback_tree_revision, preRevision);
    assert.equal(receipt.ignored_dirty_paths, 1);
    // The proof is disposable: the caller's dirty edit survives untouched.
    assert.equal(readFileSync(join(repository, 'README.md'), 'utf8'), 'replacement + local edit\n');
  } finally {
    rmSync(repository, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function revAt(repository, name) {
  return execFileSync('git', ['rev-parse', name], { cwd: repository, encoding: 'utf8' }).trim();
}
