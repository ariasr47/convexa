import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  canonicalRepositoryRoot,
  parseArgs,
  scan,
  validateNegativeControl,
  validateTerminal,
} from './postgres-release-receipt.mjs';

const TOOL = fileURLToPath(new URL('./postgres-release-receipt.mjs', import.meta.url));
const COMMAND = 'api-rust postgres-migrate';
const HEALTH = '/api/health';

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function clone(value) {
  return structuredClone(value);
}

function makeFixture() {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'postgres-receipt-')));
  git(root, 'init');
  git(root, 'config', 'user.email', 'receipt-tests@example.invalid');
  git(root, 'config', 'user.name', 'Receipt Tests');
  const railwayRaw = Buffer.from(
    `${JSON.stringify(
      {
        build: { watchPatterns: ['apps/api/**'] },
        deploy: { preDeployCommand: [COMMAND], healthcheckPath: HEALTH },
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(path.join(root, 'railway.json'), railwayRaw);
  git(root, 'add', 'railway.json');
  git(root, 'commit', '-m', 'valid railway config');
  const sha = git(root, 'rev-parse', 'HEAD');
  const terminal = {
    schema_version: 1,
    kind: 'terminal',
    outcome: 'work applied',
    reason: 'migrations applied',
    message: 'Migrations applied. The PostgreSQL schema is ready for this release.',
    target_version: 12,
    highest_committed_version: 12,
    failing_version: null,
    elapsed_ms: 41,
  };
  const negative = {
    schema_version: 1,
    feature: 'postgres-release-safety',
    git_sha: sha,
    precondition: 'migrations missing',
    command: 'api-rust serve',
    exit_status: 78,
    startup_message: 'Startup refused: required PostgreSQL migrations are missing.',
    listener_bound: false,
    workers_started: false,
    database_fingerprint_before: 'a19d4e88f00367c443f6286ad5e042ceb2983c3559b409b5893759666dbd84dd',
    database_fingerprint_after: 'a19d4e88f00367c443f6286ad5e042ceb2983c3559b409b5893759666dbd84dd',
  };
  const terminalPath = path.join(root, 'terminal.json');
  const negativePath = path.join(root, 'negative.json');
  const receiptPath = path.join(root, 'receipt.json');
  fs.writeFileSync(terminalPath, `${JSON.stringify(terminal, null, 4)}\n`);
  fs.writeFileSync(negativePath, ` ${JSON.stringify(negative)}\r\n`);

  return { root, railwayRaw, sha, terminal, negative, terminalPath, negativePath, receiptPath };
}

function commonArgs(fixture) {
  return [
    '--repository-root',
    fixture.root,
    '--expected-git-sha',
    fixture.sha,
    '--expected-pre-deploy-command',
    COMMAND,
    '--expected-healthcheck-path',
    HEALTH,
    '--migration-terminal',
    fixture.terminalPath,
    '--negative-control',
    fixture.negativePath,
  ];
}

function replaceFlag(args, flag, value) {
  const changed = [...args];
  const index = changed.indexOf(flag);
  assert.notEqual(index, -1);
  changed[index + 1] = value;
  return changed;
}

function run(command, args) {
  return spawnSync(process.execPath, [TOOL, command, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
}

function produce(fixture, args = commonArgs(fixture)) {
  return run('produce', [...args, '--out', fixture.receiptPath]);
}

function validate(fixture, args = commonArgs(fixture)) {
  return run('validate', [...args, '--receipt', fixture.receiptPath]);
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

test('canonical repository root accepts only the absolute canonical git toplevel', () => {
  const fixture = makeFixture();
  try {
    assert.equal(canonicalRepositoryRoot(fixture.root), fixture.root);
    assert.throws(() => canonicalRepositoryRoot(path.relative(process.cwd(), fixture.root)));
    assert.throws(() => canonicalRepositoryRoot(`${fixture.root}${path.sep}`));
    const child = path.join(fixture.root, 'child');
    fs.mkdirSync(child);
    assert.throws(() => canonicalRepositoryRoot(child));
  } finally {
    cleanup(fixture);
  }
});

test('producer reads the immutable commit blob after the railway working tree changes', () => {
  const fixture = makeFixture();
  try {
    fs.writeFileSync(
      path.join(fixture.root, 'railway.json'),
      JSON.stringify({ deploy: { preDeployCommand: ['wrong'], healthcheckPath: '/wrong' } }),
    );
    const result = produce(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'PASS repository_and_process_only\n');
    const receipt = JSON.parse(fs.readFileSync(fixture.receiptPath, 'utf8'));
    assert.equal(
      receipt.railway_config.sha256,
      crypto.createHash('sha256').update(fixture.railwayRaw).digest('hex'),
    );
    assert.deepEqual(receipt.railway_config.pre_deploy_command, [COMMAND]);
    assert.equal(receipt.railway_config.healthcheck_path, HEALTH);
  } finally {
    cleanup(fixture);
  }
});

test('missing or wrong root, SHA, commit, and railway blob are rejected', () => {
  const fixture = makeFixture();
  const other = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repository-')));
  try {
    const base = commonArgs(fixture);
    const cases = [
      base.filter((_, index) => index !== 2 && index !== 3),
      replaceFlag(base, '--repository-root', other),
      replaceFlag(base, '--expected-git-sha', 'A'.repeat(40)),
      replaceFlag(base, '--expected-git-sha', '0'.repeat(40)),
    ];
    for (const args of cases) assert.notEqual(produce(fixture, args).status, 0);

    fs.rmSync(path.join(fixture.root, 'railway.json'));
    git(fixture.root, 'add', '-u');
    git(fixture.root, 'commit', '-m', 'remove railway blob');
    fixture.sha = git(fixture.root, 'rev-parse', 'HEAD');
    fixture.negative.git_sha = fixture.sha;
    fs.writeFileSync(fixture.negativePath, JSON.stringify(fixture.negative));
    assert.notEqual(produce(fixture).status, 0);
  } finally {
    fs.rmSync(other, { recursive: true, force: true });
    cleanup(fixture);
  }
});

test('expected and committed pre-deploy command and health path are fixed policy', () => {
  const fixture = makeFixture();
  try {
    const base = commonArgs(fixture);
    assert.notEqual(
      produce(fixture, replaceFlag(base, '--expected-pre-deploy-command', 'other')).status,
      0,
    );
    assert.notEqual(
      produce(fixture, replaceFlag(base, '--expected-healthcheck-path', '/healthz')).status,
      0,
    );

    fs.writeFileSync(
      path.join(fixture.root, 'railway.json'),
      `${JSON.stringify({ deploy: { preDeployCommand: [COMMAND], healthcheckPath: '/healthz' } })}\n`,
    );
    git(fixture.root, 'add', 'railway.json');
    git(fixture.root, 'commit', '-m', 'wrong immutable policy');
    fixture.sha = git(fixture.root, 'rev-parse', 'HEAD');
    fixture.negative.git_sha = fixture.sha;
    fs.writeFileSync(fixture.negativePath, JSON.stringify(fixture.negative));
    assert.notEqual(produce(fixture).status, 0);
  } finally {
    cleanup(fixture);
  }
});

test('terminal input has the exact success schema, types, outcome, reason, and copy', () => {
  const fixture = makeFixture();
  try {
    const workApplied = fixture.terminal;
    const alreadyCurrent = {
      ...workApplied,
      outcome: 'already current',
      reason: 'already current',
      message: 'No migrations were needed. The PostgreSQL schema is ready for this release.',
    };
    assert.equal(validateTerminal(workApplied), workApplied);
    assert.equal(validateTerminal(alreadyCurrent), alreadyCurrent);

    const mutations = [
      (value) => delete value.reason,
      (value) => (value.extra = true),
      (value) => (value.schema_version = '1'),
      (value) => (value.kind = 'progress'),
      (value) => (value.outcome = 'execution failed'),
      (value) => (value.reason = 'already current'),
      (value) => (value.message = 'close enough'),
      (value) => (value.target_version = null),
      (value) => (value.highest_committed_version = 11),
      (value) => (value.failing_version = 12),
      (value) => (value.elapsed_ms = 1.5),
    ];
    for (const mutate of mutations) {
      const value = clone(workApplied);
      mutate(value);
      assert.throws(() => validateTerminal(value));
    }
  } finally {
    cleanup(fixture);
  }
});

test('negative control has exact fields, types, nonzero exit, and equal real fingerprints', () => {
  const fixture = makeFixture();
  try {
    assert.equal(validateNegativeControl(fixture.negative, fixture.sha), fixture.negative);
    const mutations = [
      (value) => delete value.command,
      (value) => (value.extra = true),
      (value) => (value.schema_version = '1'),
      (value) => (value.feature = 'other'),
      (value) => (value.git_sha = 'b'.repeat(40)),
      (value) => (value.precondition = 'current'),
      (value) => (value.command = 'api-rust postgres-migrate'),
      (value) => (value.exit_status = 0),
      (value) => (value.exit_status = 1.5),
      (value) => (value.startup_message = 'Startup refused.'),
      (value) => (value.listener_bound = 0),
      (value) => (value.workers_started = true),
      (value) => (value.database_fingerprint_before = '0'.repeat(64)),
      (value) => (value.database_fingerprint_before = 'A'.repeat(64)),
      (value) => (value.database_fingerprint_after = 'b'.repeat(64)),
    ];
    for (const mutate of mutations) {
      const value = clone(fixture.negative);
      mutate(value);
      assert.throws(() => validateNegativeControl(value, fixture.sha));
    }
  } finally {
    cleanup(fixture);
  }
});

test('receipt hashes raw bytes and validator independently rejects every receipt mutation', () => {
  const fixture = makeFixture();
  try {
    assert.equal(produce(fixture).status, 0);
    const original = JSON.parse(fs.readFileSync(fixture.receiptPath, 'utf8'));
    assert.equal(
      original.migration_terminal_sha256,
      crypto.createHash('sha256').update(fs.readFileSync(fixture.terminalPath)).digest('hex'),
    );
    assert.equal(
      original.negative_control_sha256,
      crypto.createHash('sha256').update(fs.readFileSync(fixture.negativePath)).digest('hex'),
    );

    const mutations = [
      (value) => delete value.result,
      (value) => (value.unknown = true),
      (value) => (value.schema_version = 2),
      (value) => (value.scope = 'live'),
      (value) => (value.git_sha = 'b'.repeat(40)),
      (value) => (value.railway_config.sha256 = '0'.repeat(64)),
      (value) => (value.migration_terminal.elapsed_ms += 1),
      (value) => (value.migration_terminal_sha256 = '0'.repeat(64)),
      (value) => (value.negative_control.exit_status = 0),
      (value) => (value.negative_control_sha256 = '0'.repeat(64)),
    ];
    for (const mutate of mutations) {
      const changed = clone(original);
      mutate(changed);
      fs.writeFileSync(fixture.receiptPath, JSON.stringify(changed));
      assert.notEqual(validate(fixture).status, 0);
    }
  } finally {
    cleanup(fixture);
  }
});

test('secret scanner rejects every denylisted key and all three forbidden value forms', () => {
  for (const key of [
    'database_url',
    'password',
    'secret',
    'token',
    'credential',
    'authorization',
    'cookie',
    'sql',
    'query',
    'environment',
    'username',
  ]) {
    assert.throws(() => scan({ nested: [{ [key.toUpperCase()]: 'redacted' }] }));
  }
  for (const value of [
    'postgresql://db.internal/service',
    'https://operator:password@example.invalid/path',
    'Bearer abc.def.ghi',
  ]) {
    assert.throws(() => scan({ message: value }));
  }
  assert.doesNotThrow(() => scan({ message: 'PostgreSQL schema is ready.', elapsed_ms: 2 }));
});

test('argument parser rejects duplicates, unknowns, retired live-host flags, and chronology flags', () => {
  const fixture = makeFixture();
  try {
    const base = commonArgs(fixture);
    assert.throws(() => parseArgs('produce', [...base, '--out']));
    assert.throws(() =>
      parseArgs('produce', [...base, '--out', fixture.receiptPath, '--out', fixture.receiptPath]),
    );
    assert.throws(() => parseArgs('produce', [...base, '--receipt', fixture.receiptPath]));
    assert.throws(() => parseArgs('validate', [...base, '--out', fixture.receiptPath]));
    for (const flag of [
      '--deployment-id',
      '--image-revision',
      '--deployment-status',
      '--health-result',
      '--config-source',
      '--host-log',
      '--evidence-locator',
      '--timestamp',
      '--started-at',
      '--duration-ms',
      '--order',
    ]) {
      assert.throws(() =>
        parseArgs('produce', [...base, flag, 'retired', '--out', fixture.receiptPath]),
      );
    }
  } finally {
    cleanup(fixture);
  }
});

test('producer and validator complete an accepting round trip and recompute changed inputs', () => {
  const fixture = makeFixture();
  try {
    const produced = produce(fixture);
    assert.equal(produced.status, 0, produced.stderr);
    assert.equal(validate(fixture).status, 0);
    const receipt = JSON.parse(fs.readFileSync(fixture.receiptPath, 'utf8'));
    assert.deepEqual(Object.keys(receipt).sort(), [
      'feature',
      'git_sha',
      'migration_terminal',
      'migration_terminal_sha256',
      'negative_control',
      'negative_control_sha256',
      'railway_config',
      'result',
      'schema_version',
      'scope',
    ]);
    fixture.terminal.elapsed_ms += 1;
    fs.writeFileSync(fixture.terminalPath, `${JSON.stringify(fixture.terminal)}\n`);
    assert.notEqual(validate(fixture).status, 0);
  } finally {
    cleanup(fixture);
  }
});
