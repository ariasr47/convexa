import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRepoPath, safeDigest, safeId, safeText } from './lib/paths.mjs';
import { spawnCaptured } from './lib/process.mjs';

test('paths enforce safe identifiers and digests', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const cases = [
    [safeId, 'api-production-image', true],
    [safeId, '../escape', false],
    [safeId, '', false],
    [safeId, 'a\n', false],
    [safeDigest, digest, true],
    [safeDigest, 'sha256:BAD', false],
    [safeDigest, `sha512:${'a'.repeat(64)}`, false],
    [safeText, 'hello world', true],
    [safeText, 'line\nfeed', false],
    [safeText, '', false],
  ];
  for (const [check, value, accepted] of cases) {
    const label = `${check.name}(${JSON.stringify(value)})`;
    if (accepted) assert.equal(check(value), value, label);
    else assert.throws(() => check(value), TypeError, label);
  }
});

test('repo paths remain inside root', async () => {
  assert.equal(await resolveRepoPath(process.cwd(), 'package.json'), 'package.json');
  await assert.rejects(() => resolveRepoPath(process.cwd(), '../outside'));
});

test('process wrapper captures output without shell', async () => {
  const result = await spawnCaptured(process.execPath, ['-e', 'process.stdout.write("ok")']);
  assert.equal(result.state, 'pass');
  assert.equal(result.raw_exit_code, 0);
  assert.equal(result.output, 'ok');
  const blocked = await spawnCaptured(process.execPath, ['-e', 'setTimeout(()=>{},100)'], {
    timeoutMs: 5,
  });
  assert.equal(blocked.state, 'blocked');
});
test('repo paths reject absolute values', async () =>
  assert.rejects(() => resolveRepoPath(process.cwd(), process.cwd())));
test('repo paths reject backslash traversal', async () =>
  assert.rejects(() => resolveRepoPath(process.cwd(), '..\\outside')));
test('process failures are explicit', async () =>
  assert.equal((await spawnCaptured('missing-supply-chain-executable', [])).state, 'blocked'));
test('process nonzero exits are failures', async () =>
  assert.equal((await spawnCaptured(process.execPath, ['-e', 'process.exit(7)'])).state, 'fail'));
test('process output is bounded', async () =>
  assert.ok(
    (
      await spawnCaptured(process.execPath, ['-e', 'process.stdout.write("x".repeat(100))'], {
        maxOutputBytes: 10,
      })
    ).output.length <= 10,
  ));
