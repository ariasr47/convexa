import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyOrAcquireTools } from './acquire-tools.mjs';
import { canonicalSha256 } from './lib/canonical.mjs';
import { spawnCaptured } from './lib/process.mjs';
import { normalize } from './normalize.mjs';
import { ociLayoutReference, subjectDigest, withExtractedOciArchive } from './oci.mjs';
import { runCargoDeny } from './policy/cargo-deny.mjs';
import { runGitleaks } from './policy/gitleaks.mjs';
import { runNpmAudit } from './policy/npm-audit.mjs';
import { checkLicenseBaseline, inventoryFromLock } from './policy/npm-license.mjs';
import { checkNpmLock } from './policy/npm-lock.mjs';
import { runTrivyConfig, runTrivyImage } from './policy/trivy.mjs';
import { sanitize } from './sanitize.mjs';
import { generateInventoryWithSyft } from './syft-inventory.mjs';

export const CAPABILITY_IDS = Object.freeze([
  'npm-audit.full-lock-json',
  'npm-license.spdx-inventory',
  'npm-lock.source-integrity',
  'cargo-deny.advisories-licenses-sources-bans',
  'gitleaks.history-range-json',
  'trivy.config-json',
  'trivy.api-image-digest-json',
  'syft.api-lock-inventory-cyclonedx',
  'syft.dashboard-lock-inventory-cyclonedx',
  'normalizer.strict-aggregate',
  'sanitizer.all-publication-channels',
]);
export const capabilityIds = CAPABILITY_IDS;
const arms = Object.freeze(['pass', 'policy_fail', 'unavailable']);
const toolByCapability = Object.freeze({
  'npm-audit.full-lock-json': 'npm',
  'npm-license.spdx-inventory': 'npm-license-inventory',
  'npm-lock.source-integrity': 'npm-lock-guard',
  'cargo-deny.advisories-licenses-sources-bans': 'cargo-deny',
  'gitleaks.history-range-json': 'gitleaks',
  'trivy.config-json': 'trivy',
  'trivy.api-image-digest-json': 'trivy',
  'syft.api-lock-inventory-cyclonedx': 'syft',
  'syft.dashboard-lock-inventory-cyclonedx': 'syft',
  'normalizer.strict-aggregate': 'normalizer',
  'sanitizer.all-publication-channels': 'sanitizer',
});

export function trivyGithubPatCanary() {
  // Trivy v0.74's built-in github-pat rule requires a 36-character alphanumeric suffix.
  // Keep the prefix split in source so this deterministic fake is only assembled in the fixture.
  return ['gh', 'p_', '0123456789', 'abcdefghijklmnopqrstuvwxyz'].join('');
}

export async function buildCapabilityReceipts({
  capabilities = CAPABILITY_IDS,
  resolveTool,
  resolveFixture,
  runAdapter,
} = {}) {
  const receipts = [];
  for (const capabilityId of capabilities)
    for (const arm of arms) {
      const expectedExit = arm === 'pass' ? 0 : arm === 'policy_fail' ? 1 : 2;
      const expectedState = arm === 'pass' ? 'pass' : arm === 'policy_fail' ? 'fail' : 'blocked';
      let tool, fixture, actual;
      try {
        tool = await resolveTool(toolByCapability[capabilityId], capabilityId);
        fixture = await resolveFixture(capabilityId, arm);
        actual = await runAdapter(capabilityId, fixture, tool);
      } catch (error) {
        actual = {
          exit_code: 2,
          state: 'blocked',
          reason_code: 'adapter-unavailable',
          raw_exit_code: null,
          raw_output_sha256: canonicalSha256({ reason: 'adapter-unavailable' }),
          publication_canary_leaked: false,
        };
        tool = tool ?? {
          tool_id: toolByCapability[capabilityId],
          version: 'unavailable',
          sha256: '0'.repeat(64),
        };
        fixture = fixture ?? {
          fixture_id: `${capabilityId}.${arm}`,
          fixture_sha256: canonicalSha256({ capabilityId, arm }),
        };
      }
      const matches =
        actual.exit_code === expectedExit &&
        actual.state === expectedState &&
        !actual.publication_canary_leaked;
      receipts.push({
        schema_version: 1,
        receipt_kind: 'capability_probe',
        capability_id: capabilityId,
        tool_id: tool.tool_id,
        tool_version: tool.version,
        tool_sha256: tool.sha256,
        fixture_id: fixture.fixture_id,
        fixture_sha256: fixture.fixture_sha256,
        expected_adapter_exit: expectedExit,
        actual_adapter_exit: actual.exit_code,
        expected_state: expectedState,
        actual_state: actual.state,
        reason_code: safeReasonCode(actual.reason_code),
        raw_exit_code: safeToolExitCode(actual.raw_exit_code),
        raw_output_sha256: actual.raw_output_sha256,
        sanitized_evidence_ref: `artifact:capability-receipts#/receipts/${receipts.length}`,
        probe_verdict: matches ? 'pass' : 'capability_stop',
        publication_canary_leaked: Boolean(actual.publication_canary_leaked),
        complete: matches,
      });
    }
  return { receipts };
}

export function validateCapabilityReceiptSet(receipts) {
  const errors = [];
  if (!Array.isArray(receipts) || receipts.length !== 33) errors.push('receipt-count');
  const keys = new Set();
  for (const receipt of receipts ?? []) {
    const key = `${receipt.capability_id}:${receipt.fixture_id}`;
    if (keys.has(key)) errors.push('duplicate');
    keys.add(key);
    if (!CAPABILITY_IDS.includes(receipt.capability_id)) errors.push('unknown-capability');
    if (
      receipt.actual_adapter_exit !== receipt.expected_adapter_exit ||
      receipt.actual_state !== receipt.expected_state ||
      receipt.probe_verdict !== 'pass' ||
      receipt.publication_canary_leaked ||
      !receipt.complete
    )
      errors.push('probe-mismatch');
  }
  for (const id of CAPABILITY_IDS)
    for (const arm of arms)
      if (
        ![...keys].some(
          (key) =>
            key === `${id}:${id}.${arm}` ||
            key ===
              `${id}:sanitizer.${arm === 'pass' ? 'safe_publication' : arm === 'policy_fail' ? 'policy_fail_preserved' : 'canary_publication_stop'}`,
        )
      )
        errors.push('missing');
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

async function productionDependencies() {
  const acquired = await verifyOrAcquireTools({ allowDownload: true }).catch(() => ({
    manifest: { tools: [] },
    resolved: new Map(),
  }));
  const fixtureSeed = await fs
    .readFile('.supply-chain/fixtures/capabilities.json')
    .catch(() => Buffer.from('{}'));
  return {
    resolveTool(toolId) {
      const record = acquired.manifest.tools.find((x) => x.tool_id === toolId);
      if (!record) throw new Error('tool record missing');
      if (!acquired.resolved.has(toolId)) throw new Error('tool unavailable');
      return { ...record, executable: acquired.resolved.get(toolId) };
    },
    resolveFixture(capabilityId, arm) {
      const fixtureId =
        capabilityId === 'sanitizer.all-publication-channels'
          ? `sanitizer.${arm === 'pass' ? 'safe_publication' : arm === 'policy_fail' ? 'policy_fail_preserved' : 'canary_publication_stop'}`
          : `${capabilityId}.${arm}`;
      return {
        fixture_id: fixtureId,
        fixture_sha256: canonicalSha256({
          seed_sha256: canonicalSha256(fixtureSeed),
          capabilityId,
          arm,
        }),
        payload: { arm },
      };
    },
    runAdapter: productionAdapter,
  };
}

async function productionAdapter(capabilityId, fixture, tool) {
  const arm = fixture.payload.arm;
  if (capabilityId === 'npm-lock.source-integrity') {
    const value = arm === 'pass' ? cleanLock() : arm === 'policy_fail' ? poisonLock() : null;
    return wrap(checkNpmLock(value, { workspaceRoot: process.cwd() }));
  }
  if (capabilityId === 'npm-license.spdx-inventory') {
    if (arm === 'unavailable') return blocked();
    const lock = cleanLock(true);
    const inventory = await inventoryFromLock(lock, 'a'.repeat(64));
    const baseline =
      arm === 'pass'
        ? inventory
        : inventory.map((x, i) => (i ? x : { ...x, expression: 'Apache-2.0' }));
    return wrap(checkLicenseBaseline(inventory, baseline));
  }
  if (capabilityId === 'npm-audit.full-lock-json')
    return withFixture('npm-audit', async (root) => {
      if (arm === 'unavailable')
        return wrap(await runNpmAudit({ cwd: path.join(root, 'missing') }));
      await fs.writeFile(
        path.join(root, 'package.json'),
        JSON.stringify({
          name: 'probe',
          version: '1.0.0',
          private: true,
          dependencies: arm === 'pass' ? {} : { lodash: '4.17.20' },
        }),
      );
      if (arm === 'pass')
        await fs.writeFile(
          path.join(root, 'package-lock.json'),
          JSON.stringify({
            name: 'probe',
            version: '1.0.0',
            lockfileVersion: 3,
            requires: true,
            packages: { '': { name: 'probe', version: '1.0.0' } },
          }),
        );
      else {
        const install = await spawnCaptured(
          'npm',
          ['install', '--package-lock-only', '--ignore-scripts', '--no-audit'],
          { cwd: root, timeoutMs: 180000 },
        );
        if (install.raw_exit_code !== 0) return blocked();
      }
      return wrap(await runNpmAudit({ cwd: root }));
    });
  if (capabilityId === 'cargo-deny.advisories-licenses-sources-bans')
    return withFixture('cargo-deny', async (root) => {
      if (arm === 'unavailable') return wrap(await runCargoDeny({ executable: null, cwd: root }));
      await fs.writeFile(
        path.join(root, 'Cargo.toml'),
        '[package]\nname="probe"\nversion="0.1.0"\nedition="2021"\nlicense="MIT"\n[dependencies]\nitoa="1"\n',
      );
      await fs.mkdir(path.join(root, 'src'));
      await fs.writeFile(path.join(root, 'src/lib.rs'), 'pub fn probe() {}\n');
      const lock = await spawnCaptured('cargo', ['generate-lockfile'], {
        cwd: root,
        timeoutMs: 180000,
      });
      if (lock.raw_exit_code !== 0) return blocked();
      await fs.writeFile(
        path.join(root, 'deny.toml'),
        arm === 'pass'
          ? '[licenses]\nallow=["MIT","Apache-2.0"]\n'
          : '[licenses]\nallow=["Apache-2.0"]\n',
      );
      const observation = observeToolRun();
      return wrap(
        observation.decorate(
          await runCargoDeny({
            executable: tool.executable,
            cwd: root,
            runner: observation.runner,
          }),
        ),
      );
    });
  if (capabilityId === 'gitleaks.history-range-json')
    return withFixture('gitleaks', async (root) => {
      if (arm === 'unavailable') return wrap(await runGitleaks({ executable: null, cwd: root }));
      await spawnCaptured('git', ['init'], { cwd: root });
      await spawnCaptured('git', ['config', 'user.email', 'probe@example.invalid'], { cwd: root });
      await spawnCaptured('git', ['config', 'user.name', 'Probe'], { cwd: root });
      await fs.writeFile(path.join(root, 'probe.txt'), 'range-base\n');
      await spawnCaptured('git', ['add', 'probe.txt'], { cwd: root });
      await spawnCaptured('git', ['commit', '-m', 'range base'], { cwd: root });
      const base = await spawnCaptured('git', ['rev-parse', 'HEAD'], { cwd: root });
      const canary = ['ghp_', '0123456789abcdefghijklmnopqrstuvwx'].join('');
      await fs.writeFile(
        path.join(root, 'probe.txt'),
        arm === 'pass' ? 'safe range commit one\n' : `token=${canary}\n`,
      );
      await spawnCaptured('git', ['add', 'probe.txt'], { cwd: root });
      await spawnCaptured('git', ['commit', '-m', 'range commit one'], { cwd: root });
      await fs.writeFile(path.join(root, 'probe.txt'), 'safe range commit two\n');
      await spawnCaptured('git', ['add', 'probe.txt'], { cwd: root });
      await spawnCaptured('git', ['commit', '-m', 'range commit two'], { cwd: root });
      const head = await spawnCaptured('git', ['rev-parse', 'HEAD'], { cwd: root });
      const observation = observeToolRun();
      return wrap(
        observation.decorate(
          await runGitleaks({
            executable: tool.executable,
            cwd: root,
            logOptions: `${base.output.trim()}..${head.output.trim()}`,
            requireLogOptions: true,
            runner: observation.runner,
          }),
        ),
      );
    });
  if (capabilityId === 'trivy.config-json')
    return withFixture('trivy-config', async (root) => {
      if (arm === 'unavailable') return wrap(await runTrivyConfig({ executable: null, cwd: root }));
      await fs.mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'Dockerfile'),
        arm === 'pass'
          ? `FROM alpine:3.22@sha256:${'a'.repeat(64)}\nUSER 65532\nHEALTHCHECK NONE\n`
          : 'FROM alpine:latest\nUSER 65532\nHEALTHCHECK NONE\n',
      );
      await fs.writeFile(
        path.join(root, '.github', 'workflows', 'ci.yml'),
        arm === 'pass'
          ? `jobs:\n  test:\n    steps:\n      - uses: actions/checkout@${'b'.repeat(40)}\n`
          : 'jobs:\n  test:\n    steps:\n      - uses: actions/checkout@main\n',
      );
      const observation = observeToolRun();
      return wrap(
        observation.decorate(
          await runTrivyConfig({
            executable: tool.executable,
            cwd: root,
            runner: observation.runner,
          }),
        ),
      );
    });
  if (capabilityId === 'trivy.api-image-digest-json')
    return withFixture('trivy-image', async (root) => {
      if (arm === 'unavailable')
        return wrap(
          await runTrivyImage({
            executable: null,
            digest: `sha256:${'a'.repeat(64)}`,
            input: 'missing',
            cwd: root,
          }),
        );
      await fs.writeFile(
        path.join(root, 'Dockerfile'),
        'FROM scratch\nCOPY probe.txt /probe.txt\nUSER 65532\n',
      );
      await fs.writeFile(
        path.join(root, 'probe.txt'),
        arm === 'pass' ? 'safe\n' : `token=${trivyGithubPatCanary()}\n`,
      );
      const archive = path.join(root, 'probe.oci.tar'),
        build = await spawnCaptured(
          'docker',
          [
            'buildx',
            'build',
            '--platform',
            'linux/amd64',
            '--file',
            'Dockerfile',
            '--output',
            `type=oci,dest=${archive}`,
            '.',
          ],
          { cwd: root, timeoutMs: 300000 },
        );
      if (build.raw_exit_code !== 0) return blocked();
      const archiveBytes = await fs.readFile(archive),
        digest = subjectDigest(archiveBytes);
      return withExtractedOciArchive(archiveBytes, async (layout) => {
        const observation = observeToolRun();
        return wrap(
          observation.decorate(
            await runTrivyImage({
              executable: tool.executable,
              digest,
              input: ociLayoutReference(layout, digest),
              cwd: root,
              runner: observation.runner,
            }),
          ),
        );
      });
    });
  if (capabilityId.startsWith('syft.')) {
    if (arm === 'unavailable') return blocked();
    const component = {
        family: capabilityId.includes('api-') ? 'cargo-normal-build' : 'npm-production-closure',
        ecosystem: capabilityId.includes('api-') ? 'cargo' : 'npm',
        name: 'probe-component',
        version: '1.0.0',
        provenance: {
          kind: 'registry',
          source: capabilityId.includes('api-')
            ? 'registry+https://github.com/rust-lang/crates.io-index'
            : 'https://registry.npmjs.org/probe-component/-/probe-component-1.0.0.tgz',
          integrity: 'sha512-cHJvYmU=',
          path: null,
          manifest_sha256: null,
        },
      },
      expected =
        arm === 'pass' ? [component] : [component, { ...component, name: 'required-but-omitted' }],
      observation = observeToolRun(),
      generated = await generateInventoryWithSyft({
        executable: tool.executable,
        subjectId: capabilityId.includes('api-')
          ? 'api-production-image'
          : 'dashboard-distribution-archive',
        expected,
        runner:
          arm === 'policy_fail'
            ? async (executable, args, options) => {
                const result = await observation.runner(executable, args, options);
                if (result.raw_exit_code !== 0) return result;
                const doc = JSON.parse(result.output);
                doc.artifacts.pop();
                return { ...result, output: JSON.stringify(doc) };
              }
            : observation.runner,
      });
    return wrap(observation.decorate(generated));
  }
  if (capabilityId === 'normalizer.strict-aggregate') {
    const value =
      arm === 'pass'
        ? { checks: [{ state: 'pass', completion: 'complete' }] }
        : arm === 'policy_fail'
          ? { checks: [{ state: 'fail', completion: 'complete' }] }
          : { checks: [] };
    return wrap(normalize(value));
  }
  if (capabilityId === 'sanitizer.all-publication-channels') {
    const value = minimalReport();
    if (arm === 'policy_fail') {
      value.aggregate = 'fail';
      value.checks[0].state = 'fail';
      value.checks[0].finding_count = 1;
    }
    if (arm === 'unavailable') value.toolchain.node = 'SCA_CANARY_SECRET_9f31';
    const result = sanitize(value);
    if (arm === 'unavailable')
      return {
        ...blocked(),
        publication_canary_leaked: JSON.stringify(result).includes('SCA_CANARY_SECRET_9f31'),
      };
    return {
      ...wrap({
        state:
          arm === 'pass' && result.safe
            ? 'pass'
            : arm === 'policy_fail' && !result.safe
              ? 'fail'
              : 'blocked',
      }),
      publication_canary_leaked: false,
    };
  }
  return blocked();
}

function cleanLock(withPackage = false) {
  const packages = { '': { name: 'fixture', version: '1.0.0' } };
  if (withPackage)
    packages['node_modules/example'] = {
      version: '1.0.0',
      resolved: 'https://registry.npmjs.org/example/-/example-1.0.0.tgz',
      integrity: 'sha512-YWJjZA==',
      license: 'MIT',
    };
  return { name: 'fixture', version: '1.0.0', lockfileVersion: 3, requires: true, packages };
}
function poisonLock() {
  const lock = cleanLock(true);
  lock.packages['node_modules/example'].resolved = 'http://registry.npmjs.org/example.tgz';
  return lock;
}
function wrap(result) {
  const state = result.state ?? 'blocked';
  const exit_code = state === 'pass' ? 0 : state === 'fail' ? 1 : 2;
  return {
    exit_code,
    state,
    reason_code: safeReasonCode(result.reason_code ?? result.rule_id),
    raw_exit_code: safeToolExitCode(result.tool_exit_code ?? result.raw_exit_code),
    raw_output_sha256: canonicalSha256(result),
    publication_canary_leaked: false,
  };
}
function blocked() {
  return {
    exit_code: 2,
    state: 'blocked',
    reason_code: 'required-capability-not-executable',
    raw_exit_code: null,
    raw_output_sha256: canonicalSha256({ reason: 'required-capability-not-executable' }),
    publication_canary_leaked: false,
  };
}
function safeReasonCode(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,95}$/.test(value)
    ? value
    : 'adapter-reason-unavailable';
}
function safeToolExitCode(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 255 ? value : null;
}
function observeToolRun() {
  let rawExitCode = null;
  return {
    async runner(executable, argv, options) {
      const result = await spawnCaptured(executable, argv, options);
      rawExitCode = safeToolExitCode(result.raw_exit_code);
      return result;
    },
    decorate(result) {
      return { ...result, tool_exit_code: rawExitCode };
    },
  };
}
async function withFixture(prefix, fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `convexa-${prefix}-`));
  try {
    return await fn(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
function minimalReport() {
  const ids = [
    'npm_advisories',
    'npm_licenses',
    'npm_sources',
    'cargo_policy',
    'repository_secrets',
    'configuration',
  ];
  return {
    schema_version: 1,
    report_kind: 'supply_chain_policy',
    revision_sha: 'a'.repeat(40),
    event: 'pull_request',
    path: 'policy',
    run_key: 'b'.repeat(64),
    policy_sha256: 'c'.repeat(64),
    created_at: '2026-08-23T00:00:00.000Z',
    retention_days: 30,
    complete: true,
    aggregate: 'pass',
    toolchain: { node: '24.19.0', npm: '11.17.0', rust: '1.98.0' },
    checks: ids.map((check_id) => ({
      check_id,
      authority: {
        npm_advisories: 'npm-audit',
        npm_licenses: 'npm-license-inventory',
        npm_sources: 'npm-lock-guard',
        cargo_policy: 'cargo-deny',
        repository_secrets: 'gitleaks',
        configuration: 'trivy',
      }[check_id],
      required: true,
      scope: ['package-lock.json'],
      tool: 'probe',
      tool_version: '1.0.0',
      advisory_data_revision: null,
      state: 'pass',
      completion: 'complete',
      rule_id: null,
      reason_code: null,
      reason_params: {},
      finding_count: 0,
      evidence_sha256: null,
    })),
    findings: [],
    exceptions: [],
    subjects: [],
    redaction: { count: 0, kinds: [] },
    artifacts: [],
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href) {
  let result;
  try {
    const deps = await productionDependencies();
    const built = await buildCapabilityReceipts(deps);
    const validation = validateCapabilityReceiptSet(built.receipts);
    result = {
      schema_version: 1,
      receipt_count: built.receipts.length,
      receipts: built.receipts,
      complete: validation.valid,
      capability_stops: validation.errors,
    };
    await fs.mkdir('.supply-chain/out', { recursive: true });
    await fs.writeFile('.supply-chain/out/capability-receipts.json', JSON.stringify(result));
  } catch {
    result = {
      schema_version: 1,
      receipt_count: 33,
      receipts: [],
      complete: false,
      capability_stops: ['harness-unavailable'],
    };
  }
  process.stdout.write(
    JSON.stringify({
      schema_version: 1,
      receipt_count: result.receipt_count,
      complete: result.complete,
      capability_stops: result.capability_stops,
      artifact: 'capability-receipts.json',
    }),
  );
  process.exitCode = result.complete ? 0 : 2;
}
