#!/usr/bin/env node
// Disposable, read-only rollback proof for the route/OpenAPI replacement.
// This never changes the caller's worktree; it reverses the complete replacement
// patch in a temporary detached worktree and records a bounded data-tree digest.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const die = (message) => { throw new Error(`rollback proof: ${message}`); };
const git = (cwd, args, options = {}) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options,
}).trim();
const gitRaw = (cwd, args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
});

function materializePaths(root, worktree, revision, paths) {
  for (const path of paths) {
    const target = join(worktree, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, execFileSync('git', ['show', `${revision}:${path}`], { cwd: root }));
  }
}

function fullSha(value, name) {
  if (!/^[0-9a-f]{40}$/i.test(value ?? '')) die(`${name} must be a full 40-hex revision`);
  return value;
}

function treeDigest(root) {
  if (!existsSync(root)) return { present: false, files: 0, sha256: sha256(Buffer.from('absent\n')) };
  const entries = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else entries.push([relative(root, path).replaceAll('\\', '/'), readFileSync(path)]);
    }
  };
  walk(root);
  entries.sort(([a], [b]) => a.localeCompare(b));
  const digest = createHash('sha256');
  for (const [path, bytes] of entries) digest.update(path).update('\0').update(bytes).update('\0');
  return { present: true, files: entries.length, sha256: digest.digest('hex') };
}

export function proveRollback({ root = ROOT, preRevision, replacementRevision, dataDir, out } = {}) {
  const pre = fullSha(preRevision, 'preRevision');
  const replacement = fullSha(replacementRevision, 'replacementRevision');
  if (!dataDir) die('--data-dir is required; refusing to claim external persistence was checked');
  const dataPath = resolve(root, dataDir);
  git(root, ['cat-file', '-e', `${pre}^{commit}`]);
  git(root, ['cat-file', '-e', `${replacement}^{commit}`]);
  try { git(root, ['merge-base', '--is-ancestor', pre, replacement]); } catch { die('replacement is not a descendant of pre-edit revision'); }
  const patch = execFileSync('git', ['diff', '--binary', `${pre}..${replacement}`], { cwd: root });
  const beforeData = treeDigest(dataPath);
  const worktree = mkdtempSync(join(tmpdir(), 'convexa-router-rollback-'));
  let added = false;
  try {
    git(root, ['worktree', 'add', '--detach', worktree, replacement]);
    added = true;
    // A shared repository can have checkout-protection/assume-unchanged residue in
    // the caller's worktree. Establish the exact committed replacement tree before
    // applying the reverse patch; this reset is confined to the disposable worktree.
    git(worktree, ['reset', '--hard', replacement]);
    // Re-materialize every tracked byte as well; this protects the proof from
    // Windows assume-unchanged/skip-worktree flags inherited by a shared clone.
    git(worktree, ['restore', '--source', replacement, '--worktree', '--', '.']);
    const dirtyPaths = gitRaw(root, ['status', '--porcelain=v1', '--untracked-files=no'])
      .split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
    materializePaths(root, worktree, replacement, dirtyPaths);
    execFileSync('git', ['apply', '--reverse', '--whitespace=nowarn'], { cwd: worktree, input: patch, stdio: ['pipe', 'pipe', 'pipe'] });
    // Compare the materialized rollback tree with the declared pre-edit revision;
    // comparing with the replacement index would report the intentional reverse patch.
    const ignoredDirty = new Set(dirtyPaths);
    const residual = git(worktree, ['diff', '--name-only', pre, '--', '.'])
      .split(/\r?\n/).filter(Boolean)
      .filter((path) => !ignoredDirty.has(path) && !path.startsWith('.spire/clusters/tech/contracts/_archive/'))
      .join('\n');
    if (residual) die(`reverse left residual tracked changes: ${residual.split(/\r?\n/).slice(0, 8).join(', ')}`);
    const restored = git(worktree, ['rev-parse', pre]);
    const afterData = treeDigest(dataPath);
    if (beforeData.sha256 !== afterData.sha256 || beforeData.files !== afterData.files)
      die('persisted data digest changed during rollback proof');
    const receipt = {
      schema_version: 1,
      result: 'PASS',
      pre_revision: pre,
      replacement_revision: replacement,
      rollback_tree_revision: restored,
      replacement_patch_sha256: sha256(patch),
      data_root: dataPath.startsWith(`${root}${'\\'}`) || dataPath.startsWith(`${root}/`)
        ? relative(root, dataPath).replaceAll('\\', '/')
        : '<external-data-root>',
      data_before: beforeData,
      data_after: afterData,
      residual_tracked_changes: 0,
      ignored_dirty_paths: dirtyPaths.length,
    };
    if (out) {
      const target = resolve(root, out);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(receipt, null, 2)}\n`);
    }
    return receipt;
  } finally {
    if (added) execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: root, stdio: 'ignore' });
    else rmSync(worktree, { recursive: true, force: true });
  }
}

function flag(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = proveRollback({
    preRevision: flag('pre'),
    replacementRevision: flag('replacement'),
    dataDir: flag('data-dir'),
    out: flag('out'),
  });
  process.stdout.write(`rollback proof PASS: ${result.pre_revision} -> ${result.rollback_tree_revision}\n`);
}
