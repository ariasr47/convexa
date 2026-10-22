import fs from 'node:fs/promises';
import path from 'node:path';
import { verifyOrAcquireTools } from './acquire-tools.mjs';
import {
  componentSetHash,
  deriveCargoComponents,
  deriveNpmComponents,
} from './component-oracle.mjs';
import { canonicalSha256, sha256 as sha } from './lib/canonical.mjs';
import { gitSha, spawnCaptured } from './lib/process.mjs';
import {
  ociLayoutReference,
  rawSha256Digest,
  subjectDigest,
  withExtractedOciArchive,
} from './oci.mjs';
import { runTrivyImage } from './policy/trivy.mjs';
import { runKey as computeRunKey } from './run-key.mjs';
import { generateInventoryWithSyft, validateInventory } from './syft-inventory.mjs';
import { archiveDirectory, validateTar } from './tar.mjs';

const SUBJECTS = ['api-production-image', 'dashboard-distribution-archive'];
const API_SEEDS = ['api-rust', 'quant-engine', 'axum', 'tokio', 'sqlx', 'reqwest'];
const DASHBOARD_SEEDS = [
  '@convexa/dashboard',
  '@convexa/api',
  'react',
  'react-dom',
  'react-router-dom',
  '@mui/material',
  '@emotion/react',
  'recharts',
  'openapi-fetch',
];

export function validateArtifact({ subject, bytes, inventory, expected, requiredSeeds = [] }) {
  if (!SUBJECTS.includes(subject))
    return { state: 'blocked', complete: false, rule_id: 'artifact-subject' };
  try {
    const dashboard = subject === 'dashboard-distribution-archive',
      digest = dashboard ? rawSha256Digest(bytes) : subjectDigest(bytes),
      byteValidation = dashboard
        ? validateTar(bytes)
        : { state: 'pass', rule_id: 'oci-layout-valid', completion: 'complete' },
      inventoryValidation = validateInventory(expected, inventory, {
        subjectId: subject,
        requiredSeeds,
      }),
      state =
        byteValidation.state === 'blocked' || inventoryValidation.state === 'blocked'
          ? 'blocked'
          : byteValidation.state === 'pass' && inventoryValidation.state === 'pass'
            ? 'pass'
            : 'fail';
    return {
      subject_id: subject,
      subject_digest: digest,
      state,
      complete: state !== 'blocked',
      byte_validation: byteValidation,
      inventory: inventoryValidation,
    };
  } catch {
    return {
      subject_id: subject,
      state: 'blocked',
      complete: false,
      rule_id: 'artifact-malformed',
    };
  }
}

export async function runArtifacts({
  event = 'default_branch',
  pathName = 'artifacts',
  runKey,
  root = process.cwd(),
  environment = process.env,
  platform = process.platform,
  arch = process.arch,
  runner = spawnCaptured,
} = {}) {
  const revision = gitSha(root),
    base = {
      schema_version: 1,
      report_kind: 'supply_chain_artifacts',
      revision_sha: revision,
      event,
      path: pathName,
      run_key: runKey ?? '',
      complete: false,
      aggregate: 'blocked',
      checks: [],
      subjects: [],
      receipts: [],
      rule_id: 'artifact-input',
    };
  if (
    !['default_branch', 'workflow_dispatch'].includes(event) ||
    pathName !== 'artifacts' ||
    runKey !== computeRunKey(event, revision, pathName, SUBJECTS)
  )
    return base;
  if (
    platform !== 'linux' ||
    arch !== 'x64' ||
    environment.GITHUB_ACTIONS !== 'true' ||
    !/^[0-9]{1,32}$/.test(environment.GITHUB_RUN_ID_SAFE ?? '')
  )
    return { ...base, rule_id: 'artifact-host-required' };
  const out = path.join(root, '.supply-chain', 'out');
  await fs.mkdir(out, { recursive: true });
  let stage = 'tool-acquisition';
  try {
    const tools = await verifyOrAcquireTools({ root }),
      syft = tools.resolved.get('syft'),
      trivy = tools.resolved.get('trivy');
    if (!tools.complete || !syft || !trivy) throw new Blocked('artifact-tools-unavailable');
    stage = 'docker-probe';
    const docker = await runner('docker', ['version', '--format', '{{.Server.Version}}'], {
      cwd: root,
      timeoutMs: 30000,
    });
    if (docker.raw_exit_code !== 0) throw new Blocked('docker-unavailable');
    stage = 'api-build';
    const apiArchive = path.join(out, 'api-production-image.oci.tar');
    await fs.rm(apiArchive, { force: true });
    const apiBuild = await runner(
      'docker',
      [
        'buildx',
        'build',
        '--platform',
        'linux/amd64',
        '--file',
        'apps/api/Dockerfile',
        '--output',
        `type=oci,dest=${apiArchive}`,
        '.',
      ],
      {
        cwd: root,
        timeoutMs: 1200000,
        maxOutputBytes: 4 * 1024 * 1024,
        outputStream: 'stderr',
      },
    );
    if (apiBuild.raw_exit_code !== 0) throw new Blocked(classifyApiBuildFailure(apiBuild.output));
    stage = 'api-read';
    const apiBytes = await fs.readFile(apiArchive),
      apiDigest = subjectDigest(apiBytes);
    stage = 'dashboard-build';
    const dashboardBuild = await runner('npm', ['run', 'build:dashboard'], {
      cwd: root,
      timeoutMs: 600000,
      maxOutputBytes: 4 * 1024 * 1024,
    });
    if (dashboardBuild.raw_exit_code !== 0) throw new Blocked('dashboard-build-failed');
    stage = 'dashboard-archive';
    const dashboardArchive = await archiveDirectory(path.join(root, 'apps', 'dashboard', 'dist')),
      dashboardFile = path.join(out, 'dashboard-distribution.tar');
    await fs.writeFile(dashboardFile, dashboardArchive.bytes);
    const dashboardValidation = validateTar(dashboardArchive.bytes);
    if (dashboardValidation.state !== 'pass') throw new Blocked('dashboard-archive-invalid');
    stage = 'component-derivation';
    const packageLock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'))),
      dashboardExpected = deriveNpmComponents({
        lock: packageLock,
        workspaceManifests: {
          'apps/dashboard': {
            path: 'apps/dashboard/package.json',
            bytes: await fs.readFile(path.join(root, 'apps/dashboard/package.json')),
          },
          'libs/api': {
            path: 'libs/api/package.json',
            bytes: await fs.readFile(path.join(root, 'libs/api/package.json')),
          },
        },
      });
    const cargoRun = await runner(
      'cargo',
      [
        'metadata',
        '--locked',
        '--format-version',
        '1',
        '--features',
        'postgres',
        '--manifest-path',
        'apps/api/Cargo.toml',
        '--filter-platform',
        'x86_64-unknown-linux-gnu',
      ],
      { cwd: root, timeoutMs: 300000, maxOutputBytes: 64 * 1024 * 1024 },
    );
    if (cargoRun.raw_exit_code !== 0) throw new Blocked('cargo-metadata-failed');
    let metadata;
    try {
      metadata = JSON.parse(cargoRun.output);
    } catch {
      throw new Blocked('cargo-metadata-malformed');
    }
    const cargoExpected = deriveCargoComponents({
      metadata,
      repoRoot: root,
      lockText: await fs.readFile(path.join(root, 'Cargo.lock'), 'utf8'),
      manifestBytes: {
        'apps/api/Cargo.toml': await fs.readFile(path.join(root, 'apps/api/Cargo.toml')),
        'libs/quant-engine/Cargo.toml': await fs.readFile(
          path.join(root, 'libs/quant-engine/Cargo.toml'),
        ),
      },
    });
    stage = 'inventory-evaluation';
    const [apiGenerated, dashboardGenerated, scan] = await Promise.all([
      generateInventoryWithSyft({
        executable: syft,
        subjectId: 'api-production-image',
        expected: cargoExpected,
        runner,
      }),
      generateInventoryWithSyft({
        executable: syft,
        subjectId: 'dashboard-distribution-archive',
        expected: dashboardExpected,
        runner,
      }),
      withExtractedOciArchive(apiBytes, (layout) =>
        runTrivyImage({
          executable: trivy,
          digest: apiDigest,
          input: ociLayoutReference(layout, apiDigest),
          cwd: root,
        }),
      ),
    ]);
    if (
      apiGenerated.state === 'blocked' ||
      dashboardGenerated.state === 'blocked' ||
      scan.state === 'blocked'
    )
      throw new Blocked('artifact-evaluation-unavailable');
    stage = 'artifact-validation';
    const apiValidation = validateArtifact({
        subject: 'api-production-image',
        bytes: apiBytes,
        inventory: apiGenerated.inventory,
        expected: cargoExpected,
        requiredSeeds: API_SEEDS,
      }),
      dashboardArtifactValidation = validateArtifact({
        subject: 'dashboard-distribution-archive',
        bytes: dashboardArchive.bytes,
        inventory: dashboardGenerated.inventory,
        expected: dashboardExpected,
        requiredSeeds: DASHBOARD_SEEDS,
      });
    stage = 'evidence-hash';
    const policySha256 = await policyHash(root),
      sourceInputsSha256 = await sourceHash(root),
      now = new Date().toISOString(),
      buildRunId = environment.GITHUB_RUN_ID_SAFE;
    const apiInventoryBytes = Buffer.from(`${JSON.stringify(apiGenerated.inventory)}\n`),
      dashboardInventoryBytes = Buffer.from(`${JSON.stringify(dashboardGenerated.inventory)}\n`);
    stage = 'inventory-write';
    await fs.writeFile(path.join(out, 'api-dependency-inventory.cdx.json'), apiInventoryBytes);
    await fs.writeFile(
      path.join(out, 'dashboard-dependency-inventory.cdx.json'),
      dashboardInventoryBytes,
    );
    stage = 'api-receipt-component-set';
    const apiComponentSetSha256 = componentSetHash(cargoExpected);
    stage = 'api-receipt-inventory-hash';
    const apiInventorySha256 = sha(apiInventoryBytes);
    stage = 'api-receipt-seeds';
    const apiRequiredSeedsPresent = API_SEEDS.every((seed) =>
      cargoExpected.some((component) => component.name === seed),
    );
    stage = 'api-receipt-assemble';
    const apiReceipt = createArtifactReceipt({
      subjectId: 'api-production-image',
      kind: 'oci_image',
      digest: apiDigest,
      revision,
      runKey,
      buildRunId,
      version: '1.51.0',
      inventorySha256: apiInventorySha256,
      policySha256,
      componentCount: cargoExpected.length,
      componentSetSha256: apiComponentSetSha256,
      requiredSeedCount: API_SEEDS.length,
      requiredSeedsPresent: apiRequiredSeedsPresent,
      sourceInputsSha256,
      byteScan: scan.raw_output_sha256,
      archiveValidation: null,
      validation: apiValidation.state,
    });
    stage = 'dashboard-receipt-component-set';
    const dashboardComponentSetSha256 = componentSetHash(dashboardExpected);
    stage = 'dashboard-receipt-inventory-hash';
    const dashboardInventorySha256 = sha(dashboardInventoryBytes);
    stage = 'dashboard-receipt-seeds';
    const dashboardRequiredSeedsPresent = DASHBOARD_SEEDS.every((seed) =>
      dashboardExpected.some((component) => component.name === seed),
    );
    stage = 'dashboard-receipt-assemble';
    const dashboardReceipt = createArtifactReceipt({
      subjectId: 'dashboard-distribution-archive',
      kind: 'file_archive',
      digest: `sha256:${dashboardArchive.digest}`,
      revision,
      runKey,
      buildRunId,
      version: '1.51.0',
      inventorySha256: dashboardInventorySha256,
      policySha256,
      componentCount: dashboardExpected.length,
      componentSetSha256: dashboardComponentSetSha256,
      requiredSeedCount: DASHBOARD_SEEDS.length,
      requiredSeedsPresent: dashboardRequiredSeedsPresent,
      sourceInputsSha256,
      byteScan: null,
      archiveValidation: canonicalSha256(dashboardValidation),
      validation: dashboardArtifactValidation.state,
    });
    stage = 'receipt-write';
    await fs.writeFile(
      path.join(out, 'api-inventory-receipt.json'),
      `${JSON.stringify(apiReceipt)}\n`,
    );
    await fs.writeFile(
      path.join(out, 'dashboard-inventory-receipt.json'),
      `${JSON.stringify(dashboardReceipt)}\n`,
    );
    stage = 'aggregate';
    const checks = [
        artifactCheck('api_image', 'trivy', scan),
        artifactCheck('api_dependency_inventory', 'syft', apiValidation),
        artifactCheck('dashboard_dependency_inventory', 'syft', dashboardArtifactValidation),
      ],
      aggregate = checks.some((x) => x.state === 'blocked')
        ? 'blocked'
        : checks.some((x) => x.state === 'fail')
          ? 'fail'
          : 'pass',
      complete = !checks.some((x) => x.state === 'blocked');
    return {
      ...base,
      rule_id: aggregate === 'pass' ? 'artifact-evidence-pass' : 'artifact-evidence-finding',
      complete,
      aggregate,
      checks,
      subjects: [
        { subject_id: 'api-production-image', subject_kind: 'oci_image', digest: apiDigest },
        {
          subject_id: 'dashboard-distribution-archive',
          subject_kind: 'file_archive',
          digest: `sha256:${dashboardArchive.digest}`,
        },
      ],
      receipts: [apiReceipt, dashboardReceipt],
      created_at: now,
    };
  } catch (error) {
    if (!(error instanceof Blocked)) {
      process.stderr.write(`artifact internal failure: ${stage} @ ${internalLocation(error)}\n`);
    }
    return {
      ...base,
      rule_id: error instanceof Blocked ? error.message : `artifact-internal-${stage}`,
    };
  }
}

export function classifyApiBuildFailure(output) {
  if (typeof output !== 'string') return 'api-build-failed';
  if (/\breadelf:\s+not found\b/i.test(output)) return 'api-build-tool-readelf';
  if (/cp: cannot stat ['"]?\/etc\/ssl\/certs\/ca-certificates\.crt/i.test(output))
    return 'api-build-ca-certificates';
  if (/error:\s+linking with .+ failed/i.test(output)) return 'api-build-link';
  const custom = output.match(/error:\s+failed to run custom build command for [`']([^\s`']+)/i);
  if (custom) {
    const crate = ['ring', 'aws-lc-sys', 'openssl-sys', 'libsqlite3-sys'].includes(custom[1])
      ? custom[1]
      : 'crate';
    return `api-build-custom-${crate}`;
  }
  if (/error\[E\d{4}\]:/i.test(output) || /error:\s+could not compile\b/i.test(output))
    return 'api-build-rust-compile';
  const failedProcess = output.match(/ERROR:\s+process [^\r\n]+/i)?.[0] ?? '';
  if (/rustup target add x86_64-unknown-linux-musl/i.test(failedProcess))
    return 'api-build-musl-toolchain';
  if (/cargo build[^\r\n]+x86_64-unknown-linux-musl/i.test(failedProcess))
    return 'api-build-rust-compile';
  if (/readelf -l[^\r\n]+x86_64-unknown-linux-musl/i.test(failedProcess))
    return 'api-build-static-verification';
  if (/mkdir -p \/runtime\/app\/data/i.test(failedProcess)) return 'api-build-runtime-root';
  return 'api-build-failed';
}

function internalLocation(error) {
  const stack = String(error?.stack ?? '');
  const match = stack.match(/[\\/]tools[\\/]supply-chain[\\/]([a-z0-9.-]+\.mjs):(\d+):\d+/i);
  return match ? `${match[1]}:${match[2]}` : 'unknown';
}

export function createArtifactReceipt({
  subjectId,
  kind,
  digest,
  revision,
  runKey,
  buildRunId,
  version,
  inventorySha256,
  policySha256,
  componentCount,
  componentSetSha256,
  requiredSeedCount,
  requiredSeedsPresent,
  sourceInputsSha256,
  byteScan,
  archiveValidation,
  validation,
}) {
  return {
    schema_version: 1,
    receipt_kind: 'associated_dependency_inventory',
    subject_id: subjectId,
    subject_kind: kind,
    subject_digest: digest,
    revision_sha: revision,
    run_key: runKey,
    build_run_id: buildRunId,
    builder: 'github-actions-ubuntu-24.04',
    generator: { name: 'syft', version },
    inventory_basis: 'lock_derived',
    association_kind: 'named_subject_digest',
    subject_bytes_observed_by_generator: false,
    format: 'CycloneDX 1.6 JSON dependency inventory',
    schema_version_declared: '1.6',
    inventory_sha256: inventorySha256,
    policy_sha256: policySha256,
    validation,
    component_families:
      subjectId === 'api-production-image'
        ? ['convexa-workspace', 'cargo-normal-build']
        : ['convexa-workspace', 'npm-production-closure'],
    component_count: componentCount,
    component_oracle_sha256: componentSetSha256,
    component_identity_set_sha256: componentSetSha256,
    required_seed_count: requiredSeedCount,
    required_seeds_present: requiredSeedsPresent,
    source_inputs_sha256: sourceInputsSha256,
    byte_scan_evidence_sha256: byteScan,
    archive_validation_sha256: archiveValidation,
    complete: validation !== 'blocked',
  };
}
function artifactCheck(check_id, tool, result) {
  return {
    check_id,
    state: result.state,
    completion: result.state === 'blocked' ? 'unavailable' : 'complete',
    tool,
    rule_id: result.rule_id ?? null,
    evidence_sha256: result.raw_output_sha256 ?? null,
  };
}
async function policyHash(root) {
  const files = [
    '.supply-chain/policy.json',
    '.supply-chain/license-baseline.json',
    '.supply-chain/exceptions.json',
    'deny.toml',
  ];
  return canonicalSha256(
    await Promise.all(
      files.map(async (file) => ({ file, sha256: sha(await fs.readFile(path.join(root, file))) })),
    ),
  );
}
async function sourceHash(root) {
  const files = [
    'package-lock.json',
    'Cargo.lock',
    'apps/dashboard/package.json',
    'libs/api/package.json',
    'apps/api/Cargo.toml',
    'libs/quant-engine/Cargo.toml',
  ];
  return canonicalSha256(
    await Promise.all(
      files.map(async (file) => ({ file, sha256: sha(await fs.readFile(path.join(root, file))) })),
    ),
  );
}
function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index],
      value = argv[index + 1];
    if (!['--event', '--path', '--run-key'].includes(key) || !value)
      throw new TypeError('artifact-invocation');
    out[key === '--run-key' ? 'runKey' : key === '--path' ? 'pathName' : 'event'] = value;
  }
  return out;
}
class Blocked extends Error {}

if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href) {
  let result;
  try {
    result = await runArtifacts(parseArgs(process.argv.slice(2)));
  } catch {
    result = {
      schema_version: 1,
      report_kind: 'supply_chain_artifacts',
      revision_sha: '0'.repeat(40),
      event: 'unknown',
      path: 'unknown',
      run_key: '',
      complete: false,
      aggregate: 'blocked',
      checks: [],
      subjects: [],
      receipts: [],
      rule_id: 'artifact-invocation',
    };
  }
  process.stdout.write(JSON.stringify(result));
  process.exitCode = result.aggregate === 'blocked' ? 2 : result.aggregate === 'fail' ? 1 : 0;
}
