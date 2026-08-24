import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runKey } from './run-key.mjs';
import {
  REQUIRED_CHECK_IDS,
  bindAccepted,
  requiredCheckSetSha256,
  selectorSet,
  validateAcceptedCi,
} from './toolchain.mjs';

const sha = 'a'.repeat(40);
const ci = () => ({
  schema_version: 1,
  receipt_kind: 'accepted_revision_ci',
  accepted_revision_sha: sha,
  event: 'pull_request',
  path: 'policy',
  subject_set_sha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
  run_key: runKey('pull_request', sha, 'policy', []),
  required_check_set_sha256: requiredCheckSetSha256(),
  checks: REQUIRED_CHECK_IDS.map((check_id) => ({
    check_id,
    state: 'pass',
    evidence_sha256: 'b'.repeat(64),
  })),
  complete: true,
  outcome: 'pass',
});
test('required qualification set is exact and unique', () => {
  assert.equal(REQUIRED_CHECK_IDS.length, 21);
  assert.equal(new Set(REQUIRED_CHECK_IDS).size, 21);
  assert.match(requiredCheckSetSha256(), /^[a-f0-9]{64}$/);
});
test('complete same-revision ordinary CI validates', () =>
  assert.deepEqual(validateAcceptedCi(ci(), sha), {
    valid: true,
    reason_code: 'accepted-ci-pass',
  }));
test('missing duplicate or non-pass checks reject', () => {
  const missing = ci();
  missing.checks.pop();
  assert.equal(validateAcceptedCi(missing, sha).valid, false);
  const duplicate = ci();
  duplicate.checks[1] = { ...duplicate.checks[0] };
  assert.equal(validateAcceptedCi(duplicate, sha).valid, false);
  const failed = ci();
  failed.checks[0].state = 'fail';
  assert.equal(validateAcceptedCi(failed, sha).valid, false);
});
test('stale run key rejects', () => {
  const receipt = ci();
  receipt.run_key = 'c'.repeat(64);
  assert.equal(validateAcceptedCi(receipt, sha).reason_code, 'accepted-ci-run-key');
});
test('selector-set hash is order-independent and value-sensitive', () => {
  assert.equal(selectorSet({ a: '1', b: '2' }), selectorSet({ b: '2', a: '1' }));
  assert.notEqual(selectorSet({ a: '1' }), selectorSet({ a: '2' }));
});
test('binding refuses before a real accepted revision is supplied', async () => {
  const receipt = await bindAccepted({ acceptedSha: null });
  assert.equal(receipt.complete, false);
  assert.equal(receipt.outcome, 'blocked');
  assert.equal(receipt.reason_code, 'accepted-revision-sha-required');
});

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
async function bindingFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-binding-test-'));
  const allowed = [
    '.nvmrc',
    '.npmrc',
    'package.json',
    'Cargo.toml',
    'apps/api/Cargo.toml',
    'libs/quant-engine/Cargo.toml',
    'rust-toolchain.toml',
    'apps/api/Dockerfile',
    'apps/dashboard/Dockerfile',
    '.github/workflows/ci.yml',
    '.github/workflows/conformance.yml',
    '.github/workflows/supply-chain.yml',
  ];
  const files = {
    '.supply-chain/candidate-toolchain.json': JSON.stringify({
      node: '24.19.0',
      npm: '11.17.0',
      rust: '1.98.0',
      allowed_selector_paths: allowed,
    }),
    '.supply-chain/pins.json': JSON.stringify({
      actions: { 'x/y': 'c'.repeat(40) },
      images: [
        'rust:1-bookworm@sha256:' + 'a'.repeat(64),
        'node:24-alpine@sha256:' + 'b'.repeat(64),
      ],
    }),
    '.nvmrc': '24.19.0',
    '.npmrc': 'engine-strict=true',
    'package.json': JSON.stringify({
      packageManager: 'npm@11.17.0',
      engines: { node: '24.19.0', npm: '11.17.0' },
    }),
    'package-lock.json': 'package-lock',
    'Cargo.lock': 'cargo-lock',
    'Cargo.toml': '[package]\nrust-version = "1.98.0"',
    'apps/api/Cargo.toml': '[package]\nrust-version = "1.98.0"',
    'libs/quant-engine/Cargo.toml': '[package]\nrust-version = "1.98.0"',
    'rust-toolchain.toml': 'channel = "1.98.0"',
    'apps/api/Dockerfile': 'FROM rust:1-bookworm@sha256:' + 'a'.repeat(64),
    'apps/dashboard/Dockerfile': 'FROM node:24-alpine@sha256:' + 'b'.repeat(64),
    '.github/workflows/ci.yml':
      'node-version: 24.19.0\ntoolchain: 1.98.0\nuses: x/y@' + 'c'.repeat(40),
    '.github/workflows/conformance.yml':
      'node-version: 24.19.0\ntoolchain: 1.98.0\nuses: x/y@' + 'c'.repeat(40),
    '.github/workflows/supply-chain.yml':
      'node-version: 24.19.0\ntoolchain: 1.98.0\nuses: x/y@' + 'c'.repeat(40),
  };
  for (const [relative, value] of Object.entries(files)) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, value);
  }
  const patch = Buffer.from('exact accepted selector patch');
  const qualification = {
    receipt_kind: 'toolchain_qualification',
    base_revision_sha: 'd'.repeat(40),
    candidate_patch_sha256: digest(patch),
    candidate_revision_id: 'e'.repeat(64),
    candidate: { node: '24.19.0', npm: '11.17.0', rust: '1.98.0' },
    inputs: {
      package_lock_sha256: digest(Buffer.from('package-lock')),
      cargo_lock_sha256: digest(Buffer.from('cargo-lock')),
    },
    checks: REQUIRED_CHECK_IDS.map((check_id) => ({ check_id, state: 'pass' })),
    complete: true,
    outcome: 'pass',
  };
  await fs.mkdir(path.join(root, '.supply-chain/out'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.supply-chain/out/toolchain-qualification.json'),
    JSON.stringify(qualification),
  );
  await fs.writeFile(
    path.join(root, '.supply-chain/out/accepted-revision-ci.json'),
    JSON.stringify(ci()),
  );
  return { root, patch };
}
test('binding joins qualification, exact patch, strict CI, selectors, tools, and locks', async (t) => {
  const { root, patch } = await bindingFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const receipt = await bindAccepted({
    root,
    acceptedSha: sha,
    headSha: sha,
    diffBytes: patch,
    detect: async () => ({ node: '24.19.0', npm: '11.17.0', rust: '1.98.0' }),
  });
  assert.equal(receipt.outcome, 'pass');
  assert.equal(receipt.complete, true);
  assert.equal(receipt.accepted_ci_required_check_set_sha256, requiredCheckSetSha256());
  assert.equal(receipt.locks_match_qualification, true);
});
test('binding blocks a selector or accepted patch mutation', async (t) => {
  const { root, patch } = await bindingFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, '.nvmrc'), '24.19.1');
  const selector = await bindAccepted({
    root,
    acceptedSha: sha,
    headSha: sha,
    diffBytes: patch,
    detect: async () => ({ node: '24.19.0', npm: '11.17.0', rust: '1.98.0' }),
  });
  assert.equal(selector.reason_code, 'accepted-selector-parity-mismatch');
  await fs.writeFile(path.join(root, '.nvmrc'), '24.19.0');
  const changed = await bindAccepted({
    root,
    acceptedSha: sha,
    headSha: sha,
    diffBytes: Buffer.from('changed'),
    detect: async () => ({ node: '24.19.0', npm: '11.17.0', rust: '1.98.0' }),
  });
  assert.equal(changed.reason_code, 'accepted-patch-mismatch');
});
