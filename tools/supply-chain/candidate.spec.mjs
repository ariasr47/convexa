import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  bootstrapCandidate,
  candidateRevisionId,
  candidateSources,
  validateCandidateBase,
  validateCommandCatalog,
} from './bootstrap-candidate.mjs';

test('candidate sources are exact Linux artifacts with independent SHA-256', () => {
  for (const source of Object.values(candidateSources)) {
    assert.match(source.url, /^https:\/\//);
    assert.doesNotMatch(source.url, /win|latest|stable/);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
  }
});
test('invalid and unresolved base identities block', () => {
  assert.equal(validateCandidateBase('bad').state, 'blocked');
  assert.equal(validateCandidateBase('f'.repeat(40)).state, 'blocked');
});
test('current HEAD cannot self-vouch while foundation bytes are unaccepted', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const result = validateCandidateBase(head);
  assert.equal(result.state, 'blocked');
  assert.equal(result.reason_code, 'base-missing-supply-chain-foundation');
});
test('candidate revision identity is domain-separated and sensitive to every input', () => {
  const value = candidateRevisionId('a'.repeat(40), 'b'.repeat(64), 'c'.repeat(64));
  assert.match(value, /^[a-f0-9]{64}$/);
  assert.notEqual(value, candidateRevisionId('a'.repeat(40), 'b'.repeat(64), 'd'.repeat(64)));
});
test('CLI emits one strict blocked JSON receipt without raw stderr', () => {
  const run = spawnSync(
    process.execPath,
    ['tools/supply-chain/bootstrap-candidate.mjs', '--base', 'bad'],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 2);
  assert.equal(run.stderr, '');
  const receipt = JSON.parse(run.stdout);
  assert.equal(receipt.receipt_kind, 'toolchain_qualification');
  assert.equal(receipt.complete, false);
  assert.equal(receipt.outcome, 'blocked');
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-candidate-test-'));
  const manifest = {
    schema_version: 1,
    status: 'candidate',
    node: '24.19.0',
    npm: '11.17.0',
    rust: '1.98.0',
    allowed_selector_paths: [
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
    ],
  };
  const catalog = JSON.parse(await fs.readFile('.supply-chain/commands.json', 'utf8'));
  const files = {
    '.supply-chain/candidate-toolchain.json': JSON.stringify(manifest),
    '.supply-chain/tools.json': '{}',
    '.supply-chain/commands.json': JSON.stringify(catalog),
    '.supply-chain/policy.json': '{}',
    '.supply-chain/pins.json': JSON.stringify({
      actions: { 'actions/checkout': 'c'.repeat(40) },
      images: [
        'rust:1-bookworm@sha256:' + 'a'.repeat(64),
        'node:24-alpine@sha256:' + 'b'.repeat(64),
      ],
    }),
    'tools/supply-chain/capabilities.mjs': 'x',
    'tools/supply-chain/policy.mjs': 'x',
    'tools/supply-chain/artifacts.mjs': 'x',
    'tools/supply-chain/bootstrap-candidate.mjs': 'x',
    '.nvmrc': '24.19.0\n',
    '.npmrc': 'engine-strict=true\n',
    'package.json': JSON.stringify({
      packageManager: 'npm@11.17.0',
      engines: { node: '24.19.0', npm: '11.17.0' },
    }),
    'package-lock.json': 'package-lock',
    'Cargo.toml': '[package]\nrust-version = "1.98.0"',
    'apps/api/Cargo.toml': '[package]\nrust-version = "1.98.0"',
    'libs/quant-engine/Cargo.toml': '[package]\nrust-version = "1.98.0"',
    'Cargo.lock': 'cargo-lock',
    'rust-toolchain.toml': '[toolchain]\nchannel = "1.98.0"',
    'apps/api/Dockerfile': 'FROM rust:1-bookworm@sha256:' + 'a'.repeat(64),
    'apps/dashboard/Dockerfile': 'FROM node:24-alpine@sha256:' + 'b'.repeat(64),
    '.github/workflows/ci.yml':
      'node-version: 24.19.0\ntoolchain: 1.98.0\nuses: actions/checkout@' + 'c'.repeat(40),
    '.github/workflows/conformance.yml':
      'node-version: 24.19.0\ntoolchain: 1.98.0\nuses: actions/checkout@' + 'c'.repeat(40),
    '.github/workflows/supply-chain.yml':
      'node-version: 24.19.0\ntoolchain: 1.98.0\nuses: actions/checkout@' + 'c'.repeat(40),
  };
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
  spawnSync('git', ['init'], { cwd: root });
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync(
    'git',
    ['-c', 'user.name=test', '-c', 'user.email=test@example.test', 'commit', '-m', 'base'],
    { cwd: root },
  );
  const baseSha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim();
  return { root, baseSha };
}
test('command catalog rejects missing checks and shell interpolation', () => {
  const catalog = { commands: [] };
  assert.equal(validateCommandCatalog(catalog).valid, false);
  const live = JSON.parse(
    spawnSync(
      process.execPath,
      [
        '-e',
        "process.stdout.write(require('fs').readFileSync('.supply-chain/commands.json','utf8'))",
      ],
      { encoding: 'utf8' },
    ).stdout,
  );
  live.commands[0].argv = ['$TOKEN'];
  assert.equal(validateCommandCatalog(live).reason_code, 'command-argv');
});
test('simulated hermetic candidate executes all 21 checks and records distinct patch and tree identities', async (t) => {
  const { root, baseSha } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const receipt = await bootstrapCandidate({
    root,
    baseSha,
    platform: 'linux',
    arch: 'x64',
    hosted: true,
    tempRoot: path.join(root, 'temp'),
    prepareWorkspace: async () => ({
      worktree: root,
      patchBytes: Buffer.from('selector patch'),
      treeIdentity: 'd'.repeat(40),
    }),
    acquireTools: async () => ({}),
    detect: async () => ({ node: '24.19.0', npm: '11.17.0', rust: '1.98.0' }),
    executeCheck: async () => ({ status: 0, stdout: 'ok', stderr: '' }),
  });
  assert.equal(receipt.outcome, 'pass');
  assert.equal(receipt.complete, true);
  assert.equal(receipt.checks.length, 21);
  assert.notEqual(receipt.candidate_patch_sha256, receipt.candidate_tree_sha256);
  assert.match(receipt.candidate_revision_id, /^[a-f0-9]{64}$/);
});
test('dependency mutation during qualification fails even when commands report pass', async (t) => {
  const { root, baseSha } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let once = false;
  const receipt = await bootstrapCandidate({
    root,
    baseSha,
    platform: 'linux',
    arch: 'x64',
    hosted: true,
    tempRoot: path.join(root, 'temp'),
    prepareWorkspace: async () => ({
      worktree: root,
      patchBytes: Buffer.from('selector patch'),
      treeIdentity: 'd'.repeat(40),
    }),
    acquireTools: async () => ({}),
    detect: async () => ({ node: '24.19.0', npm: '11.17.0', rust: '1.98.0' }),
    executeCheck: async () => {
      if (!once) {
        once = true;
        await fs.appendFile(path.join(root, 'package-lock.json'), 'poison');
      }
      return { status: 0, stdout: 'ok', stderr: '' };
    },
  });
  assert.equal(receipt.outcome, 'fail');
  assert.equal(receipt.locks_unchanged, false);
});
