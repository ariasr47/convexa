import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runPromotedConformance } from './run-promoted-conformance.mjs';

test('conformance requires an exact loopback URL', async () => {
  for (const url of [
    undefined,
    'https://example.com',
    'http://localhost:3000',
    'http://127.0.0.1.evil',
  ]) {
    // A runner that would pass: only the guard can make this blocked, and nothing may start.
    const calls = [];
    const result = await runPromotedConformance({
      url,
      runner: async (...call) => {
        calls.push(call);
        return { raw_exit_code: 0, raw_output_sha256: 'a'.repeat(64) };
      },
    });
    assert.equal(result.state, 'blocked');
    assert.equal(result.reason_code, 'loopback-url-required');
    assert.equal(calls.length, 0);
  }
});
test('all four standalone specs execute with exact interface runner argv', async () => {
  const calls = [];
  const result = await runPromotedConformance({
    url: 'http://127.0.0.1:3000',
    runner: async (executable, argv) => {
      calls.push({ executable, argv });
      return { raw_exit_code: 0, raw_output_sha256: 'a'.repeat(64) };
    },
  });
  assert.equal(result.state, 'pass');
  assert.equal(result.results.length, 4);
  assert.deepEqual(
    calls.map((x) => x.argv.slice(0, 2)),
    result.results.map((x) => ['.codex/tools/interface_conformance.mjs', '--spec']),
  );
  assert.equal(calls.filter((x) => x.argv.includes('--auth-signup')).length, 1);
  assert.equal(
    calls
      .find((x) => x.argv.includes('--auth-signup'))
      .argv.some((x) => x.endsWith('auth-gated.json')),
    true,
  );
});
test('one failed spec yields fail and one unavailable spec yields blocked', async () => {
  let n = 0;
  const failed = await runPromotedConformance({
    url: 'http://127.0.0.1:1',
    runner: async () => ({ raw_exit_code: ++n === 2 ? 1 : 0, raw_output_sha256: 'a'.repeat(64) }),
  });
  assert.equal(failed.state, 'fail');
  n = 0;
  const blocked = await runPromotedConformance({
    url: 'http://127.0.0.1:1',
    runner: async () => ({ raw_exit_code: ++n === 3 ? 2 : 0, raw_output_sha256: 'a'.repeat(64) }),
  });
  assert.equal(blocked.state, 'blocked');
});
test('CLI emits one JSON document without child output', () => {
  const run = spawnSync(
    process.execPath,
    ['tools/supply-chain/run-promoted-conformance.mjs', '--url', 'http://127.0.0.1:1'],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 2);
  const result = JSON.parse(run.stdout);
  assert.equal(result.results.length, 4);
  assert.doesNotMatch(run.stdout, /Usage:|at node:|ECONNREFUSED/);
  assert.equal(run.stderr, '');
  // `npm run conformance:auth`, the --auth-signup path people run, is refused by the same guard.
  // Port 1 is closed, so a script that bypassed the guard still reaches nothing outside this host.
  const npmArgv = ['run', '--silent', 'conformance:auth', '--', 'http://localhost:1'];
  const auth = spawnSync('npm', npmArgv, { encoding: 'utf8' });
  assert.equal(auth.status, 2);
  assert.equal(JSON.parse(auth.stdout).reason_code, 'loopback-url-required');
});
