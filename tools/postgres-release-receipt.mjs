#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const SHA = /^[0-9a-f]{40}$/u;
const HEX = /^[0-9a-f]{64}$/u;
const DENIED_KEYS = new Set([
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
]);
const DENIED_VALUES = [
  /postgres(?:ql)?:\/\//iu,
  /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s/]+@/iu,
  /\bBearer\s+\S+/iu,
];
const COMMON_FLAGS = new Set([
  '--repository-root',
  '--expected-git-sha',
  '--expected-pre-deploy-command',
  '--expected-healthcheck-path',
  '--migration-terminal',
  '--negative-control',
]);
const TERMINAL_KEYS = [
  'elapsed_ms',
  'failing_version',
  'highest_committed_version',
  'kind',
  'message',
  'outcome',
  'reason',
  'schema_version',
  'target_version',
];
const NEGATIVE_CONTROL_KEYS = [
  'command',
  'database_fingerprint_after',
  'database_fingerprint_before',
  'exit_status',
  'feature',
  'git_sha',
  'listener_bound',
  'precondition',
  'schema_version',
  'startup_message',
  'workers_started',
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  return isObject(value) && isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort());
}

function scan(value) {
  if (Array.isArray(value)) {
    for (const item of value) scan(item);
    return;
  }

  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      invariant(!DENIED_KEYS.has(key.toLocaleLowerCase('en-US')), `forbidden key: ${key}`);
      scan(item);
    }
    return;
  }

  if (typeof value === 'string') {
    invariant(!DENIED_VALUES.some((pattern) => pattern.test(value)), 'forbidden value');
  }
}

function parseJsonBytes(raw, label) {
  let value;
  try {
    value = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  scan(value);
  return value;
}

function readJsonFile(filename, label) {
  const raw = fs.readFileSync(filename);
  return { raw, value: parseJsonBytes(raw, label) };
}

function parseArgs(command, argv) {
  invariant(command === 'produce' || command === 'validate', 'invalid subcommand');
  const allowed = new Set(COMMON_FLAGS);
  allowed.add(command === 'produce' ? '--out' : '--receipt');
  const parsed = {};

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    invariant(typeof flag === 'string' && flag.startsWith('--'), 'unexpected positional argument');
    invariant(allowed.has(flag), `unknown argument: ${flag}`);
    invariant(parsed[flag] === undefined, `duplicate argument: ${flag}`);
    invariant(typeof value === 'string' && !value.startsWith('--'), `missing value: ${flag}`);
    parsed[flag] = value;
  }

  for (const flag of allowed) invariant(parsed[flag] !== undefined, `missing ${flag}`);
  return parsed;
}

function git(root, args, options = {}) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: options.encoding,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(options.message ?? 'git object unavailable');
  }
}

function canonicalRepositoryRoot(givenRoot) {
  invariant(path.isAbsolute(givenRoot), 'repository root must be absolute');
  let canonical;
  try {
    canonical = fs.realpathSync.native(givenRoot);
  } catch {
    throw new Error('repository root unavailable');
  }
  invariant(path.normalize(givenRoot) === canonical, 'repository root is not canonical');

  const topLevel = git(canonical, ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    message: 'repository root is not a git repository',
  }).trim();
  let canonicalTopLevel;
  try {
    canonicalTopLevel = fs.realpathSync.native(topLevel);
  } catch {
    throw new Error('git repository root unavailable');
  }
  invariant(canonicalTopLevel === canonical, 'repository root mismatch');
  return canonical;
}

function validateTerminal(value) {
  invariant(hasExactKeys(value, TERMINAL_KEYS), 'terminal schema mismatch');
  invariant(value.schema_version === 1, 'terminal schema_version mismatch');
  invariant(value.kind === 'terminal', 'terminal kind mismatch');
  invariant(
    Number.isInteger(value.elapsed_ms) && value.elapsed_ms >= 0,
    'terminal elapsed_ms mismatch',
  );
  invariant(
    Number.isInteger(value.target_version) && value.target_version > 0,
    'terminal target_version mismatch',
  );
  invariant(
    Number.isInteger(value.highest_committed_version) &&
      value.highest_committed_version > 0 &&
      value.highest_committed_version === value.target_version,
    'terminal highest_committed_version mismatch',
  );
  invariant(value.failing_version === null, 'terminal failing_version mismatch');

  const success = {
    'work applied': {
      reason: 'migrations applied',
      message: 'Migrations applied. The PostgreSQL schema is ready for this release.',
    },
    'already current': {
      reason: 'already current',
      message: 'No migrations were needed. The PostgreSQL schema is ready for this release.',
    },
  }[value.outcome];
  invariant(success !== undefined, 'terminal outcome mismatch');
  invariant(value.reason === success.reason, 'terminal reason mismatch');
  invariant(value.message === success.message, 'terminal message mismatch');
  return value;
}

function validateNegativeControl(value, expectedGitSha) {
  invariant(hasExactKeys(value, NEGATIVE_CONTROL_KEYS), 'negative-control schema mismatch');
  invariant(value.schema_version === 1, 'negative-control schema_version mismatch');
  invariant(value.feature === 'postgres-release-safety', 'negative-control feature mismatch');
  invariant(value.git_sha === expectedGitSha, 'negative-control git_sha mismatch');
  invariant(value.precondition === 'migrations missing', 'negative-control precondition mismatch');
  invariant(value.command === 'api-rust serve', 'negative-control command mismatch');
  invariant(
    Number.isInteger(value.exit_status) && value.exit_status !== 0,
    'negative-control exit_status mismatch',
  );
  invariant(
    value.startup_message === 'Startup refused: required PostgreSQL migrations are missing.',
    'negative-control startup_message mismatch',
  );
  invariant(value.listener_bound === false, 'negative-control listener_bound mismatch');
  invariant(value.workers_started === false, 'negative-control workers_started mismatch');
  invariant(HEX.test(value.database_fingerprint_before), 'negative-control fingerprint mismatch');
  invariant(
    value.database_fingerprint_before !== '0'.repeat(64),
    'negative-control fingerprint must identify real state',
  );
  invariant(
    value.database_fingerprint_after === value.database_fingerprint_before,
    'negative-control fingerprints differ',
  );
  return value;
}

function validateRailwayConfig(value) {
  invariant(isObject(value), 'railway config must be an object');
  invariant(
    isDeepStrictEqual(value.deploy?.preDeployCommand, ['api-rust postgres-migrate']),
    'committed pre-deploy command mismatch',
  );
  invariant(value.deploy?.healthcheckPath === '/api/health', 'committed healthcheck path mismatch');
  return value;
}

function sha256(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function loadInputs(args) {
  invariant(SHA.test(args['--expected-git-sha']), 'invalid expected git sha');
  invariant(
    args['--expected-pre-deploy-command'] === 'api-rust postgres-migrate',
    'invalid expected pre-deploy command',
  );
  invariant(
    args['--expected-healthcheck-path'] === '/api/health',
    'invalid expected healthcheck path',
  );

  const root = canonicalRepositoryRoot(args['--repository-root']);
  const gitSha = args['--expected-git-sha'];
  git(root, ['cat-file', '-e', `${gitSha}^{commit}`], {
    message: 'expected git commit unavailable',
  });
  const railwayRaw = git(root, ['show', `${gitSha}:railway.json`], {
    message: 'immutable railway.json blob unavailable',
  });
  validateRailwayConfig(parseJsonBytes(railwayRaw, 'immutable railway.json'));

  const terminal = readJsonFile(args['--migration-terminal'], 'migration terminal');
  validateTerminal(terminal.value);
  const negativeControl = readJsonFile(args['--negative-control'], 'negative control');
  validateNegativeControl(negativeControl.value, gitSha);

  return { gitSha, railwayRaw, terminal, negativeControl };
}

function expectedReceipt(inputs) {
  return {
    schema_version: 1,
    feature: 'postgres-release-safety',
    scope: 'repository_and_process_only',
    result: 'PASS',
    git_sha: inputs.gitSha,
    railway_config: {
      path: 'railway.json',
      sha256: sha256(inputs.railwayRaw),
      pre_deploy_command: ['api-rust postgres-migrate'],
      healthcheck_path: '/api/health',
    },
    migration_terminal: inputs.terminal.value,
    migration_terminal_sha256: sha256(inputs.terminal.raw),
    negative_control: inputs.negativeControl.value,
    negative_control_sha256: sha256(inputs.negativeControl.raw),
  };
}

function writeJsonAtomic(filename, value) {
  const target = path.resolve(filename);
  const directory = path.dirname(target);
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`,
  );
  let created = false;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    created = true;
    fs.renameSync(temporary, target);
  } finally {
    if (created && fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function produce(args) {
  const receipt = expectedReceipt(loadInputs(args));
  scan(receipt);
  writeJsonAtomic(args['--out'], receipt);
  return receipt;
}

function validate(args) {
  const expected = expectedReceipt(loadInputs(args));
  const supplied = readJsonFile(args['--receipt'], 'receipt').value;
  invariant(isDeepStrictEqual(supplied, expected), 'receipt mismatch');
  return supplied;
}

function main(argv = process.argv.slice(2)) {
  try {
    const [command, ...rest] = argv;
    const args = parseArgs(command, rest);
    if (command === 'produce') produce(args);
    else validate(args);
    console.log('PASS repository_and_process_only');
    return 0;
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : 'unknown error'}`);
    return 1;
  }
}

export {
  canonicalRepositoryRoot,
  expectedReceipt,
  loadInputs,
  main,
  parseArgs,
  produce,
  scan,
  validate,
  validateNegativeControl,
  validateRailwayConfig,
  validateTerminal,
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
