import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { canonicalSha256 } from './lib/canonical.mjs';

export const REQUIRED_CHECK_IDS = Object.freeze([
  'npm_ci',
  'cargo_locked',
  'api_contract',
  'format',
  'lint',
  'typecheck',
  'node_tool_tests',
  'frontend_unit',
  'shared_client_unit',
  'playwright_e2e',
  'dashboard_production_build',
  'bundle_budget',
  'rust_default_tests',
  'rust_postgres_tests',
  'production_runtime_guardrails',
  'postgres_release_safety',
  'rust_release_build',
  'api_docker_build',
  'dashboard_docker_build',
  'application_conformance',
  'score_tier_gate_fingerprint_identity',
]);
const requiredBasePaths = [
  '.supply-chain/candidate-toolchain.json',
  '.supply-chain/tools.json',
  '.supply-chain/commands.json',
  'tools/supply-chain/capabilities.mjs',
  'tools/supply-chain/policy.mjs',
  'tools/supply-chain/artifacts.mjs',
  '.github/workflows/supply-chain.yml',
];
export const candidateSources = Object.freeze({
  node: {
    url: 'https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz',
    sha256: '14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647',
  },
  npm: {
    url: 'https://registry.npmjs.org/npm/-/npm-11.17.0.tgz',
    sha256: 'b290bbb35b9e72c3ef84edbe041f28c4479c4d9ee79f555817b8caafe7ce4bba',
  },
  rustup: {
    url: 'https://static.rust-lang.org/rustup/archive/1.28.2/x86_64-unknown-linux-gnu/rustup-init',
    sha256: '20a06e644b0d9bd2fbdbfd52d42540bdde820ea7df86e92e533c073da0cdd43c',
  },
});
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', shell: false });

export function validateCandidateBase(baseSha, { root = process.cwd() } = {}) {
  if (!/^[a-f0-9]{40}$/.test(baseSha ?? ''))
    return { state: 'blocked', reason_code: 'base-sha-invalid' };
  if (git(root, ['cat-file', '-e', `${baseSha}^{commit}`]).status !== 0)
    return { state: 'blocked', reason_code: 'base-sha-unresolvable' };
  const listing = git(root, ['ls-tree', '-r', '--name-only', baseSha]);
  if (listing.status !== 0) return { state: 'blocked', reason_code: 'base-tree-unreadable' };
  const paths = new Set(listing.stdout.split(/\r?\n/));
  const missing = requiredBasePaths.filter((file) => !paths.has(file));
  if (missing.length)
    return {
      state: 'blocked',
      reason_code: 'base-missing-supply-chain-foundation',
      missing_count: missing.length,
    };
  const manifest = git(root, ['show', `${baseSha}:.supply-chain/candidate-toolchain.json`]);
  if (manifest.status !== 0)
    return { state: 'blocked', reason_code: 'base-candidate-manifest-missing' };
  return {
    state: 'pass',
    reason_code: 'base-immutable-and-complete',
    base_revision_sha: baseSha,
    candidate_manifest_sha256: hash(Buffer.from(manifest.stdout)),
  };
}
export function candidateRevisionId(baseSha, patchSha, treeSha) {
  return hash(Buffer.from(`sca-candidate-v1\0${baseSha}\0${patchSha}\0${treeSha}`));
}

export function validateCommandCatalog(catalog) {
  const commands = catalog?.commands;
  if (!Array.isArray(commands) || commands.length !== REQUIRED_CHECK_IDS.length)
    return { valid: false, reason_code: 'command-catalog-count' };
  const ids = commands.map((item) => item.command_id);
  if (new Set(ids).size !== ids.length || REQUIRED_CHECK_IDS.some((id) => !ids.includes(id)))
    return { valid: false, reason_code: 'command-catalog-set' };
  for (const command of commands) {
    if (!['node', 'npm', 'npx', 'cargo', 'docker'].includes(command.executable))
      return { valid: false, reason_code: 'command-executable' };
    if (
      !Array.isArray(command.argv) ||
      command.argv.length > 64 ||
      command.argv.some(
        (token) =>
          typeof token !== 'string' ||
          token.length < 1 ||
          token.length > 240 ||
          /[\x00-\x1f`$]/.test(token),
      )
    )
      return { valid: false, reason_code: 'command-argv' };
    if (
      typeof command.working_directory !== 'string' ||
      path.isAbsolute(command.working_directory) ||
      command.working_directory.includes('..')
    )
      return { valid: false, reason_code: 'command-working-directory' };
  }
  return { valid: true, reason_code: 'command-catalog-valid' };
}
export async function selectorFiles(root, paths) {
  const entries = [];
  for (const relative of [...paths].sort()) {
    try {
      entries.push([relative, await fs.readFile(path.join(root, relative), 'utf8')]);
    } catch {
      entries.push([relative, null]);
    }
  }
  return Object.fromEntries(entries);
}
export function selectorSetSha256(files) {
  return canonicalSha256(files);
}
async function replaceFile(file, transform) {
  const before = await fs.readFile(file, 'utf8');
  const after = transform(before);
  if (after !== before) await fs.writeFile(file, after);
}

export async function applyCandidateSelectors(worktree, manifest) {
  const allowed = new Set(manifest.allowed_selector_paths ?? []);
  const required = [
    '.nvmrc',
    '.npmrc',
    'package.json',
    'Cargo.toml',
    'apps/api/Cargo.toml',
    'libs/quant-engine/Cargo.toml',
    'rust-toolchain.toml',
  ];
  if (!required.every((item) => allowed.has(item))) throw new Error('selector-path-set-incomplete');
  await fs.writeFile(path.join(worktree, '.nvmrc'), `${manifest.node}\n`);
  await fs.writeFile(path.join(worktree, '.npmrc'), 'engine-strict=true\n');
  await replaceFile(path.join(worktree, 'package.json'), (text) => {
    const value = JSON.parse(text);
    value.packageManager = `npm@${manifest.npm}`;
    value.engines = { ...(value.engines ?? {}), node: manifest.node, npm: manifest.npm };
    return `${JSON.stringify(value, null, 2)}\n`;
  });
  await fs.writeFile(
    path.join(worktree, 'rust-toolchain.toml'),
    `[toolchain]\nchannel = "${manifest.rust}"\nprofile = "minimal"\n`,
  );
  for (const relative of ['Cargo.toml', 'apps/api/Cargo.toml', 'libs/quant-engine/Cargo.toml']) {
    await replaceFile(path.join(worktree, relative), (text) => {
      if (/^rust-version\s*=/m.test(text))
        return text.replace(/^rust-version\s*=.*$/m, `rust-version = "${manifest.rust}"`);
      const header = text.indexOf('[package]');
      if (header < 0) return text;
      const end = text.indexOf('\n', header);
      return `${text.slice(0, end + 1)}rust-version = "${manifest.rust}"\n${text.slice(end + 1)}`;
    });
  }
  for (const relative of [
    '.github/workflows/ci.yml',
    '.github/workflows/conformance.yml',
    '.github/workflows/supply-chain.yml',
  ]) {
    await replaceFile(path.join(worktree, relative), (text) =>
      text.replace(
        /^(\s*toolchain:\s*)(?:stable|[0-9]+(?:\.[0-9]+){1,2})\s*$/gm,
        `$1${manifest.rust}`,
      ),
    );
  }
}

async function acquireCandidateTools(temp, fetcher = fetch, processRunner = spawnSync) {
  const downloads = path.join(temp, 'downloads');
  const toolsRoot = path.join(temp, 'tools');
  await fs.mkdir(downloads, { recursive: true });
  await fs.mkdir(toolsRoot, { recursive: true });
  for (const [id, source] of Object.entries(candidateSources)) {
    const response = await fetcher(source.url);
    if (!response.ok) throw new Error(`${id}-download-unavailable`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== source.sha256) throw new Error(`${id}-checksum-mismatch`);
    await fs.writeFile(path.join(downloads, id), bytes, {
      flag: 'wx',
      mode: id === 'rustup' ? 0o700 : 0o600,
    });
  }
  let run = processRunner('tar', ['-xJf', path.join(downloads, 'node'), '-C', toolsRoot], {
    encoding: 'utf8',
    shell: false,
  });
  if (run.status !== 0) throw new Error('node-extract-failed');
  run = processRunner('tar', ['-xzf', path.join(downloads, 'npm'), '-C', toolsRoot], {
    encoding: 'utf8',
    shell: false,
  });
  if (run.status !== 0) throw new Error('npm-extract-failed');
  const rustupHome = path.join(toolsRoot, 'rustup');
  const cargoHome = path.join(toolsRoot, 'cargo');
  run = processRunner(
    path.join(downloads, 'rustup'),
    ['-y', '--no-modify-path', '--profile', 'minimal', '--default-toolchain', '1.98.0'],
    {
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, RUSTUP_HOME: rustupHome, CARGO_HOME: cargoHome },
    },
  );
  if (run.status !== 0) throw new Error('rust-install-failed');
  return {
    node: path.join(toolsRoot, 'node-v24.19.0-linux-x64', 'bin', 'node'),
    npm: path.join(toolsRoot, 'node-v24.19.0-linux-x64', 'bin', 'node'),
    npx: path.join(toolsRoot, 'node-v24.19.0-linux-x64', 'bin', 'node'),
    npmCli: path.join(toolsRoot, 'package', 'bin', 'npm-cli.js'),
    npxCli: path.join(toolsRoot, 'package', 'bin', 'npx-cli.js'),
    cargo: path.join(cargoHome, 'bin', 'cargo'),
    docker: '/usr/bin/docker',
    env: { RUSTUP_HOME: rustupHome, CARGO_HOME: cargoHome },
  };
}
function directCommand(command, tools, worktree, temp) {
  let argv = command.argv.map((token) =>
    token
      .replaceAll('{TEMP}', temp)
      .replaceAll('{CONFORMANCE_URL}', process.env.SCA_CONFORMANCE_URL ?? 'http://127.0.0.1:8000'),
  );
  if (command.executable === 'npm') argv = [tools.npmCli, ...argv];
  if (command.executable === 'npx') argv = [tools.npxCli, ...argv];
  return {
    executable: tools[command.executable],
    argv,
    cwd: path.join(worktree, command.working_directory),
  };
}
async function defaultPrepare({ root, baseSha, temp, manifest }) {
  const worktree = path.join(temp, 'worktree');
  const add = git(root, ['worktree', 'add', '--detach', worktree, baseSha]);
  if (add.status !== 0) throw new Error('candidate-worktree-create-failed');
  await applyCandidateSelectors(worktree, manifest);
  const changed = git(worktree, ['diff', '--name-only'])
    .stdout.trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (changed.some((file) => !manifest.allowed_selector_paths.includes(file)))
    throw new Error('candidate-patch-outside-allowlist');
  const patch = git(worktree, [
    'diff',
    '--binary',
    '--',
    ...manifest.allowed_selector_paths,
  ]).stdout;
  git(worktree, ['add', '--', ...manifest.allowed_selector_paths]);
  const tree = git(worktree, ['write-tree']);
  if (tree.status !== 0) throw new Error('candidate-tree-write-failed');
  return {
    worktree,
    patchBytes: Buffer.from(patch),
    treeIdentity: tree.stdout.trim(),
    cleanup: () => git(root, ['worktree', 'remove', '--force', worktree]),
  };
}

export async function bootstrapCandidate({
  baseSha,
  root = process.cwd(),
  platform = process.platform,
  arch = process.arch,
  hosted = process.env.GITHUB_ACTIONS === 'true',
  prepareWorkspace = defaultPrepare,
  acquireTools = acquireCandidateTools,
  detect = detectTools,
  executeCheck,
  tempRoot,
} = {}) {
  const base = validateCandidateBase(baseSha, { root });
  if (base.state !== 'pass') return blockedReceipt(baseSha, base.reason_code);
  if (platform !== 'linux' || arch !== 'x64' || !hosted)
    return blockedReceipt(baseSha, 'hosted-ubuntu-24.04-required');
  const temp = tempRoot ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'convexa-sca-candidate-')));
  let prepared;
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(root, '.supply-chain/candidate-toolchain.json'), 'utf8'),
    );
    const catalog = JSON.parse(
      await fs.readFile(path.join(root, '.supply-chain/commands.json'), 'utf8'),
    );
    const catalogResult = validateCommandCatalog(catalog);
    if (!catalogResult.valid) return blockedReceipt(baseSha, catalogResult.reason_code);
    prepared = await prepareWorkspace({ root, baseSha, temp, manifest });
    const patchSha = hash(prepared.patchBytes);
    const treeSha = hash(Buffer.from(`git-tree\0${prepared.treeIdentity}`));
    const candidateId = candidateRevisionId(baseSha, patchSha, treeSha);
    const beforeLocks = await lockHashes(prepared.worktree);
    const tools = await acquireTools(temp);
    const detected = await detect(tools, prepared.worktree);
    const checks = [];
    for (const command of catalog.commands) {
      const invocation = directCommand(command, tools, prepared.worktree, temp);
      const result = executeCheck
        ? await executeCheck({ ...invocation, command })
        : spawnSync(invocation.executable, invocation.argv, {
            cwd: invocation.cwd,
            encoding: 'utf8',
            shell: false,
            env: {
              ...process.env,
              ...tools.env,
              SCA_CONFORMANCE_URL: process.env.SCA_CONFORMANCE_URL ?? '',
            },
          });
      const state = result.status === 0 ? 'pass' : result.status === 1 ? 'fail' : 'blocked';
      checks.push({
        check_id: command.command_id,
        command_id: command.command_id,
        state,
        evidence_sha256: hash(
          Buffer.from(`${result.status}\0${result.stdout ?? ''}\0${result.stderr ?? ''}`),
        ),
      });
    }
    const afterLocks = await lockHashes(prepared.worktree);
    const locksUnchanged =
      beforeLocks.package === afterLocks.package && beforeLocks.cargo === afterLocks.cargo;
    const parity = await evaluateParity(prepared.worktree, manifest);
    const allPass =
      checks.every((item) => item.state === 'pass') &&
      locksUnchanged &&
      Object.values(parity).every(Boolean) &&
      detected.node === manifest.node &&
      detected.npm === manifest.npm &&
      detected.rust === manifest.rust;
    const anyFail =
      checks.some((item) => item.state === 'fail') ||
      !locksUnchanged ||
      Object.values(parity).some((value) => !value);
    return {
      schema_version: 1,
      receipt_kind: 'toolchain_qualification',
      base_revision_sha: baseSha,
      candidate_patch_sha256: patchSha,
      candidate_tree_sha256: treeSha,
      candidate_revision_id: candidateId,
      bootstrap: {
        tool_id: 'candidate-bootstrap',
        version: '1.0.0',
        sha256: await fileHash(path.join(root, 'tools/supply-chain/bootstrap-candidate.mjs')),
        selection_source: 'candidate-toolchain.json',
      },
      candidate: { node: manifest.node, npm: manifest.npm, rust: manifest.rust },
      detected,
      inputs: {
        package_lock_sha256: beforeLocks.package,
        cargo_lock_sha256: beforeLocks.cargo,
        policy_sha256: await fileHash(path.join(prepared.worktree, '.supply-chain/policy.json')),
        action_pin_set_sha256: await pinSetHash(prepared.worktree, /uses:/),
        image_pin_set_sha256: await pinSetHash(prepared.worktree, /FROM /),
      },
      parity,
      checks,
      locks_unchanged: locksUnchanged,
      complete: allPass,
      outcome: allPass ? 'pass' : anyFail ? 'fail' : 'blocked',
    };
  } catch (error) {
    return blockedReceipt(
      baseSha,
      String(error?.message ?? 'candidate-bootstrap-error').slice(0, 120),
    );
  } finally {
    try {
      prepared?.cleanup?.();
    } catch {}
    if (!tempRoot) await fs.rm(temp, { recursive: true, force: true });
  }
}

async function fileHash(file) {
  try {
    return hash(await fs.readFile(file));
  } catch {
    return '0'.repeat(64);
  }
}
async function lockHashes(root) {
  return {
    package: await fileHash(path.join(root, 'package-lock.json')),
    cargo: await fileHash(path.join(root, 'Cargo.lock')),
  };
}
async function pinSetHash(root, pattern) {
  const files = await selectorFiles(root, [
    '.github/workflows/ci.yml',
    '.github/workflows/conformance.yml',
    '.github/workflows/supply-chain.yml',
    'apps/api/Dockerfile',
    'apps/dashboard/Dockerfile',
  ]);
  return canonicalSha256(
    Object.fromEntries(
      Object.entries(files).map(([file, text]) => [
        file,
        text?.split(/\r?\n/).filter((line) => pattern.test(line.trim())) ?? [],
      ]),
    ),
  );
}
async function detectTools(tools, cwd) {
  const call = (exe, argv) =>
    spawnSync(exe, argv, {
      cwd,
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, ...tools.env },
    });
  return {
    node: call(tools.node, ['--version']).stdout.trim().replace(/^v/, ''),
    npm: call(tools.npm, [tools.npmCli, '--version']).stdout.trim(),
    rust:
      call(tools.cargo, ['--version'])
        .stdout.trim()
        .match(/cargo\s+(\d+\.\d+\.\d+)/)?.[1] ?? 'unavailable',
  };
}
export async function evaluateParity(root, manifest) {
  const read = async (relative) => {
    try {
      return await fs.readFile(path.join(root, relative), 'utf8');
    } catch {
      return '';
    }
  };
  const pkg = JSON.parse((await read('package.json')) || '{}');
  const cargoFiles = await Promise.all(
    ['Cargo.toml', 'apps/api/Cargo.toml', 'libs/quant-engine/Cargo.toml'].map(read),
  );
  const workflows = await Promise.all(
    [
      '.github/workflows/ci.yml',
      '.github/workflows/conformance.yml',
      '.github/workflows/supply-chain.yml',
    ].map(read),
  );
  const docker = await Promise.all(['apps/api/Dockerfile', 'apps/dashboard/Dockerfile'].map(read));
  const pins = JSON.parse((await read('.supply-chain/pins.json')) || '{"actions":{},"images":[]}');
  const nestedLock = await fs.stat(path.join(root, 'libs/quant-engine/Cargo.lock')).then(
    () => true,
    () => false,
  );
  return {
    nvmrc: (await read('.nvmrc')).trim() === manifest.node,
    package_metadata:
      pkg.packageManager === `npm@${manifest.npm}` &&
      pkg.engines?.node === manifest.node &&
      pkg.engines?.npm === manifest.npm,
    rust_toolchain: (await read('rust-toolchain.toml')).includes(`channel = "${manifest.rust}"`),
    crate_rust_version: cargoFiles.every((text) =>
      text.includes(`rust-version = "${manifest.rust}"`),
    ),
    ci:
      workflows.every(
        (text) =>
          !text.includes('actions/setup-node@') ||
          text.includes('node-version-file: .nvmrc') ||
          text.includes(`node-version: ${manifest.node}`),
      ) &&
      workflows.every(
        (text) =>
          !text.includes('dtolnay/rust-toolchain@') || text.includes(`toolchain: ${manifest.rust}`),
      ),
    dockerfiles:
      docker[0].includes(`rust:${manifest.rust.split('.')[0]}-`) &&
      docker[1].includes(`node:${manifest.node.split('.')[0]}-`),
    actions_full_sha: workflows.every((text) =>
      [...text.matchAll(/uses:\s*([^\s@]+)@([^\s#]+)/g)].every(
        (match) => match[1].startsWith('./') || pins.actions[match[1]] === match[2],
      ),
    ),
    images_tag_and_digest: docker.every((text) =>
      [...text.matchAll(/^(?:FROM\s+|#\s*syntax=)([^\s]+)/gm)].every((match) =>
        pins.images.includes(match[1]),
      ),
    ),
    root_locks_only: !nestedLock,
  };
}
function blockedReceipt(base_revision_sha, reason_code) {
  return {
    schema_version: 1,
    receipt_kind: 'toolchain_qualification',
    base_revision_sha: /^[a-f0-9]{40}$/.test(base_revision_sha ?? '')
      ? base_revision_sha
      : '0'.repeat(40),
    candidate_patch_sha256: '0'.repeat(64),
    candidate_tree_sha256: '0'.repeat(64),
    candidate_revision_id: '0'.repeat(64),
    bootstrap: {
      tool_id: 'candidate-bootstrap',
      version: '1.0.0',
      sha256: '0'.repeat(64),
      selection_source: 'candidate-toolchain.json',
    },
    candidate: { node: '24.19.0', npm: '11.17.0', rust: '1.98.0' },
    detected: { node: 'unavailable', npm: 'unavailable', rust: 'unavailable' },
    inputs: {
      package_lock_sha256: '0'.repeat(64),
      cargo_lock_sha256: '0'.repeat(64),
      policy_sha256: '0'.repeat(64),
      action_pin_set_sha256: '0'.repeat(64),
      image_pin_set_sha256: '0'.repeat(64),
    },
    parity: {
      nvmrc: false,
      package_metadata: false,
      rust_toolchain: false,
      crate_rust_version: false,
      ci: false,
      dockerfiles: false,
      actions_full_sha: false,
      images_tag_and_digest: false,
      root_locks_only: false,
    },
    checks: [],
    locks_unchanged: false,
    complete: false,
    outcome: 'blocked',
    reason_code,
  };
}
function parse(argv) {
  return argv.length === 2 && argv[0] === '--base' ? argv[1] : null;
}
if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href) {
  const result = await bootstrapCandidate({ baseSha: parse(process.argv.slice(2)) });
  process.stdout.write(JSON.stringify(result));
  process.exitCode = result.outcome === 'pass' ? 0 : result.outcome === 'fail' ? 1 : 2;
}
