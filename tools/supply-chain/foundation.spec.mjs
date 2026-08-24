import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { canonicalBytes, canonicalSha256 } from './lib/canonical.mjs';
import { resolveRepoPath, safeDigest, safeId, safeText } from './lib/paths.mjs';
import { spawnCaptured } from './lib/process.mjs';

test('canonical bytes are stable and order object keys', () => {
  assert.equal(canonicalBytes({ b: 2, a: 1 }).toString(), '{"a":1,"b":2}');
  assert.equal(canonicalSha256({ a: 1 }), canonicalSha256({ a: 1 }));
});

test('paths enforce safe identifiers and digests', () => {
  assert.equal(safeId('api-production-image'), 'api-production-image');
  assert.throws(() => safeId('../escape'));
  assert.equal(safeDigest(`sha256:${'a'.repeat(64)}`), `sha256:${'a'.repeat(64)}`);
  assert.throws(() => safeDigest('sha256:BAD'));
  assert.equal(safeText('hello world'), 'hello world');
  assert.throws(() => safeText('line\nfeed'));
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
test('canonical arrays preserve order', () =>
  assert.equal(canonicalBytes([2, 1]).toString(), '[2,1]'));
test('canonical strings use UTF-8', () =>
  assert.equal(canonicalBytes({ é: '✓' }).toString('utf8'), '{"é":"✓"}'));
test('canonical rejects non-finite numbers', () =>
  assert.throws(() => canonicalBytes({ n: Number.NaN })));
test('sha256 is lowercase hexadecimal', () => assert.match(canonicalSha256({}), /^[0-9a-f]{64}$/));
test('safe IDs reject empty strings', () => assert.throws(() => safeId('')));
test('safe IDs reject control characters', () => assert.throws(() => safeId('a\n')));
test('safe text rejects empty strings', () => assert.throws(() => safeText('')));
test('safe digest rejects wrong algorithm', () =>
  assert.throws(() => safeDigest(`sha512:${'a'.repeat(64)}`)));
test('repo paths reject absolute values', async () =>
  assert.rejects(() => resolveRepoPath(process.cwd(), process.cwd())));
test('repo paths reject backslash traversal', async () =>
  assert.rejects(() => resolveRepoPath(process.cwd(), '..\\outside')));
test('process failures are explicit', async () =>
  assert.equal((await spawnCaptured('missing-supply-chain-executable', [])).state, 'blocked'));
test('process nonzero exits are failures', async () =>
  assert.equal((await spawnCaptured(process.execPath, ['-e', 'process.exit(7)'])).state, 'fail'));
test('process output is hashed', async () =>
  assert.match(
    (await spawnCaptured(process.execPath, ['-e', 'process.stdout.write("x")'])).raw_output_sha256,
    /^[0-9a-f]{64}$/,
  ));
test('process output is bounded', async () =>
  assert.ok(
    (
      await spawnCaptured(process.execPath, ['-e', 'process.stdout.write("x".repeat(100))'], {
        maxOutputBytes: 10,
      })
    ).output.length <= 10,
  ));
test('every checked schema is valid JSON and every declared object is closed', async () => {
  for (const name of await fs.readdir('.supply-chain/schemas')) {
    if (!name.endsWith('.schema.json')) continue;
    const schema = JSON.parse(await fs.readFile(`.supply-chain/schemas/${name}`, 'utf8'));
    walk(schema, name);
  }
  function walk(value, label) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'object')
      assert.equal(value.additionalProperties, false, `${label} object must be closed`);
    for (const child of Object.values(value)) walk(child, label);
  }
});
