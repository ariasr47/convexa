import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const tracked = [
  'package.json',
  'package-lock.json',
  'Cargo.toml',
  'Cargo.lock',
  'apps/api/Cargo.toml',
  'libs/quant-engine/Cargo.toml',
];
export async function dependencySnapshot(root = process.cwd()) {
  const files = {};
  for (const relative of tracked) {
    try {
      files[relative] = hash(await fs.readFile(path.join(root, relative)));
    } catch {
      return { state: 'blocked', rule_id: 'dependency-input-missing', files, nested_locks: [] };
    }
  }
  const nested = [];
  for (const workspace of ['apps', 'libs']) await walk(path.join(root, workspace), root, nested);
  return {
    state: nested.length ? 'fail' : 'pass',
    rule_id: nested.length ? 'nested-cargo-lock' : 'dependency-bytes-recorded',
    files,
    nested_locks: nested.sort(),
  };
}
export function compareDependencySnapshots(before, after) {
  if (!before || !after || before.state === 'blocked' || after.state === 'blocked')
    return {
      state: 'blocked',
      rule_id: 'dependency-snapshot-unavailable',
      completion: 'unavailable',
    };
  if (before.nested_locks.length || after.nested_locks.length)
    return { state: 'fail', rule_id: 'nested-cargo-lock', completion: 'complete' };
  const changed = Object.keys(before.files).filter(
    (file) => before.files[file] !== after.files[file],
  );
  return {
    state: changed.length ? 'fail' : 'pass',
    rule_id: changed.length ? 'dependency-bytes-mutated' : 'dependency-bytes-unchanged',
    completion: 'complete',
    count: changed.length,
    changed,
  };
}
async function walk(directory, root, output) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, root, output);
    else if (entry.name === 'Cargo.lock')
      output.push(path.relative(root, absolute).replaceAll('\\', '/'));
  }
}
