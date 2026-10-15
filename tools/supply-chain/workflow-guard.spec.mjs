import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { auditAutomation } from './workflow-guard.mjs';

const workflowFiles = [
  '.github/workflows/ci.yml',
  '.github/workflows/conformance.yml',
  '.github/workflows/deploy-smoke.yml',
  '.github/workflows/supply-chain.yml',
];
const load = async () => ({
  workflows: Object.fromEntries(
    await Promise.all(workflowFiles.map(async (file) => [file, await fs.readFile(file, 'utf8')])),
  ),
  dockerfiles: {
    'apps/api/Dockerfile': await fs.readFile('apps/api/Dockerfile', 'utf8'),
    'apps/dashboard/Dockerfile': await fs.readFile('apps/dashboard/Dockerfile', 'utf8'),
  },
  // Absent since 2026-10-15 (Dependabot off to minimise cost); restore from git history to re-enable.
  dependabot: await fs.readFile('.github/dependabot.yml', 'utf8').catch(() => null),
  pins: JSON.parse(await fs.readFile('.supply-chain/pins.json', 'utf8')),
});

test('live automation passes immutable and fail-closed guard', async () => {
  assert.deepEqual(auditAutomation(await load()), { state: 'pass', errors: [] });
});
test('a push or schedule trigger on supply-chain is rejected (manual mode)', async () => {
  for (const trigger of [
    '  push:\n    branches: [main]\n',
    '  schedule:\n    - cron: "17 3 * * 1"\n',
  ]) {
    const input = await load();
    input.workflows['.github/workflows/supply-chain.yml'] = input.workflows[
      '.github/workflows/supply-chain.yml'
    ].replace('\non:\n', `\non:\n${trigger}`);
    assert.ok(auditAutomation(input).errors.includes('supply-chain:event-matrix'), trigger);
  }
});
test('mutable Action mutation is rejected', async () => {
  const input = await load();
  input.workflows['.github/workflows/supply-chain.yml'] = input.workflows[
    '.github/workflows/supply-chain.yml'
  ].replace(/actions\/setup-node@[a-f0-9]{40}/, 'actions/setup-node@v4');
  assert.equal(auditAutomation(input).state, 'fail');
});
test('floating image mutation is rejected', async () => {
  const input = await load();
  input.dockerfiles['apps/api/Dockerfile'] = input.dockerfiles['apps/api/Dockerfile'].replace(
    /@sha256:[a-f0-9]{64}/,
    '',
  );
  assert.equal(auditAutomation(input).state, 'fail');
});
test('non-always aggregate mutation is rejected', async () => {
  const input = await load();
  const text = input.workflows['.github/workflows/supply-chain.yml'];
  const index = text.indexOf('\n  aggregate:');
  input.workflows['.github/workflows/supply-chain.yml'] =
    text.slice(0, index) + text.slice(index).replace('if: always()', 'if: success()');
  assert.equal(auditAutomation(input).state, 'fail');
});
test('broad upload mutation is rejected', async () => {
  const input = await load();
  input.workflows['.github/workflows/supply-chain.yml'] = input.workflows[
    '.github/workflows/supply-chain.yml'
  ].replace('path: .supply-chain/out/policy-report.json', 'path: .supply-chain/out/**');
  assert.equal(auditAutomation(input).state, 'fail');
});
test('direct scanner mutation is rejected', async () => {
  const input = await load();
  input.workflows['.github/workflows/supply-chain.yml'] += '\n      - run: trivy fs .\n';
  assert.equal(auditAutomation(input).state, 'fail');
});
test('write permission mutation is rejected', async () => {
  const input = await load();
  input.workflows['.github/workflows/supply-chain.yml'] = input.workflows[
    '.github/workflows/supply-chain.yml'
  ].replace('contents: read', 'contents: write');
  assert.equal(auditAutomation(input).state, 'fail');
});
test('non-40-hex and stale Action SHA mutations are rejected', async () => {
  const short = await load();
  short.workflows['.github/workflows/ci.yml'] = short.workflows['.github/workflows/ci.yml'].replace(
    /actions\/checkout@[a-f0-9]{40}/,
    'actions/checkout@1234',
  );
  assert.equal(auditAutomation(short).state, 'fail');
  const stale = await load();
  stale.workflows['.github/workflows/ci.yml'] = stale.workflows['.github/workflows/ci.yml'].replace(
    /actions\/checkout@[a-f0-9]{40}/,
    'actions/checkout@' + 'd'.repeat(40),
  );
  assert.match(auditAutomation(stale).errors.join(','), /unapproved-action-pin/);
});
test('moving Action labels and moving Rust toolchain selectors are rejected', async () => {
  const movingComment = await load();
  movingComment.workflows['.github/workflows/ci.yml'] = movingComment.workflows[
    '.github/workflows/ci.yml'
  ].replace('reviewed-commit-2026-08-05', 'stable');
  assert.match(auditAutomation(movingComment).errors.join(','), /missing-release-comment/);
  const movingToolchain = await load();
  movingToolchain.workflows['.github/workflows/ci.yml'] = movingToolchain.workflows[
    '.github/workflows/ci.yml'
  ].replace('toolchain: 1.97.1', 'toolchain: stable');
  assert.match(auditAutomation(movingToolchain).errors.join(','), /moving-rust-toolchain/);
});
test('only the exact empty image scratch is exempt from digest pinning', async () => {
  for (const image of ['busybox', 'scratch:latest', 'scratchy']) {
    const input = await load();
    input.dockerfiles['apps/api/Dockerfile'] = input.dockerfiles['apps/api/Dockerfile'].replace(
      /^FROM scratch$/m,
      `FROM ${image}`,
    );
    assert.ok(auditAutomation(input).errors.includes('apps/api/Dockerfile:mutable-image'), image);
  }
});
test('missing image digest and tag/digest mismatch are rejected', async () => {
  const missing = await load();
  missing.dockerfiles['apps/dashboard/Dockerfile'] = missing.dockerfiles[
    'apps/dashboard/Dockerfile'
  ].replace(/@sha256:[a-f0-9]{64}/, '');
  assert.equal(auditAutomation(missing).state, 'fail');
  const mismatch = await load();
  mismatch.dockerfiles['apps/dashboard/Dockerfile'] = mismatch.dockerfiles[
    'apps/dashboard/Dockerfile'
  ].replace('node:24-alpine@', 'node:25-alpine@');
  assert.match(auditAutomation(mismatch).errors.join(','), /unapproved-image-pin/);
});
test('workflow_call must explicitly preserve the closed event revision and path', async () => {
  const input = await load();
  input.workflows['.github/workflows/supply-chain.yml'] = input.workflows[
    '.github/workflows/supply-chain.yml'
  ].replace("github.event_name == 'workflow_call' && inputs.contract_event", 'github.event_name');
  assert.match(auditAutomation(input).errors.join(','), /workflow-call-contract/);
});
test('a Dependabot config that auto-merges is rejected; no config at all passes', async () => {
  const input = await load();
  assert.deepEqual(auditAutomation({ ...input, dependabot: null }).errors, []);
  assert.ok(
    auditAutomation({ ...input, dependabot: 'version: 2\n# auto-merge\n' }).errors.includes(
      'dependabot:unsafe',
    ),
  );
  assert.ok(
    auditAutomation({ ...input, dependabot: 'version: 1\n' }).errors.includes('dependabot:unsafe'),
  );
});
