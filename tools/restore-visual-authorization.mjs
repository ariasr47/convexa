import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// CI-only: the dispatch revision carries the authorization; HEAD stays at the
// earlier, genuinely observed source. No application code is restored from it.
const root = process.cwd();
const source = process.env.EXPECTED_SOURCE_REVISION;
const receiptRevision = process.env.AUTHORIZATION_REVISION;
const authorizationPath = process.env.AUTHORIZATION_PATH;
const revisionPattern = /^[a-f0-9]{40}$/;
assert.match(source ?? '', revisionPattern);
assert.match(receiptRevision ?? '', revisionPattern);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), source);
const safePath = (relative, prefix) => {
  assert.equal(typeof relative, 'string');
  assert.ok(relative.startsWith(prefix) && !relative.includes('\\'));
  assert.ok(!path.isAbsolute(relative) && !relative.split('/').includes('..'));
  const absolute = path.resolve(root, relative);
  assert.ok(absolute.startsWith(root + path.sep));
  return absolute;
};
safePath(authorizationPath, 'apps/dashboard-e2e/visual-review/authorizations/');
const readReceiptFile = (relative) =>
  execFileSync('git', ['show', `${receiptRevision}:${relative}`]);
const authorizationBytes = readReceiptFile(authorizationPath);
const authorization = JSON.parse(authorizationBytes);
assert.equal(authorization.source_revision, source);
assert.equal(authorization.platform, 'linux');
const pending = new Map([[authorizationPath, authorizationBytes]]);
const preserve = (relative, expectedHash) => {
  if (relative === null && expectedHash === null) return;
  safePath(relative, 'apps/dashboard-e2e/visual-review/evidence/');
  assert.match(expectedHash, /^[a-f0-9]{64}$/);
  const bytes = readReceiptFile(relative);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
  pending.set(relative, bytes);
};
preserve(authorization.failed_compare.summary_path, authorization.failed_compare.summary_sha256);
const summary = JSON.parse(pending.get(authorization.failed_compare.summary_path));
assert.equal(summary.source_revision, source);
assert.equal(summary.host_platform, 'linux');
assert.equal(summary.status, 'fail');
assert.equal(summary.executed, 6);
assert.equal(summary.run_id, authorization.failed_compare.run_id);
assert.equal(authorization.scenarios.length, 6);
for (const row of authorization.scenarios) {
  for (const kind of ['expected', 'actual', 'diff'])
    preserve(row[`${kind}_path`], row[`${kind}_sha256`]);
}
// Validate all bytes before any writes, and never replace different source files.
for (const [relative, bytes] of pending) {
  const absolute = path.resolve(root, relative);
  if (fs.existsSync(absolute)) assert.deepEqual(fs.readFileSync(absolute), bytes);
}
for (const [relative, bytes] of pending) {
  const absolute = path.resolve(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, bytes);
}
console.log(
  JSON.stringify({
    source_revision: source,
    receipt_revision: receiptRevision,
    files: pending.size,
  }),
);
