import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runKey } from './run-key.mjs';

const run = (file, args = []) => spawnSync(process.execPath, [file, ...args], { encoding: 'utf8' });
const parse = (result) => JSON.parse(result.stdout);

test('policy rejects a missing run key with closed exit 2', () => {
  const result = run('tools/supply-chain/policy.mjs', [
    '--event',
    'pull_request',
    '--path',
    'policy',
  ]);
  assert.equal(result.status, 2);
  assert.equal(parse(result).aggregate, 'blocked');
});

test('policy executes every PR policy authority instead of only npm audit', () => {
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const result = run('tools/supply-chain/policy.mjs', [
    '--event',
    'pull_request',
    '--path',
    'policy',
    '--run-key',
    runKey('pull_request', revision, 'policy', []),
  ]);
  assert.ok([0, 1, 2].includes(result.status));
  const report = parse(result);
  assert.deepEqual(
    report.checks.map((check) => check.check_id).sort(),
    [
      'cargo_policy',
      'configuration',
      'npm_advisories',
      'npm_licenses',
      'npm_sources',
      'repository_secrets',
    ].sort(),
  );
  assert.notEqual(report.aggregate, undefined);
  assert.equal(
    report.complete,
    report.checks.every((check) => check.completion === 'complete'),
  );
});

test('capability command cannot manufacture passing receipts when pinned tools are unavailable', () => {
  const result = run('tools/supply-chain/capabilities.mjs');
  assert.ok([0, 2].includes(result.status));
  const report = parse(result);
  assert.equal(report.receipt_count, 33);
  if (result.status === 2) {
    assert.equal(report.complete, false);
    assert.ok(report.capability_stops.length > 0);
  }
});

test('verify always returns an aggregate and rejects unknown flags', () => {
  const result = run('tools/supply-chain/verify.mjs', ['--event', 'pull_request', '--wat', 'x']);
  assert.equal(result.status, 2);
  assert.equal(parse(result).aggregate, 'blocked');
});
