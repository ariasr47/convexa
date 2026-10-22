import fs from 'node:fs/promises';

import { verifyOrAcquireTools } from './acquire-tools.mjs';
import { canonicalSha256, sha256 } from './lib/canonical.mjs';
import { gitSha } from './lib/process.mjs';
import { CHECK_AUTHORITIES, normalizePolicyReport, requiredChecksFor } from './normalize.mjs';
import { runCargoDeny } from './policy/cargo-deny.mjs';
import { validateExceptions } from './policy/exceptions.mjs';
import { runGitleaks } from './policy/gitleaks.mjs';
import { compareDependencySnapshots, dependencySnapshot } from './policy/lock-integrity.mjs';
import { combineAudits, runNpmAudit } from './policy/npm-audit.mjs';
import {
  canonicalLockSha256,
  checkLicenseBaseline,
  inspectLicenseInventory,
} from './policy/npm-license.mjs';
import { checkNpmLock } from './policy/npm-lock.mjs';
import { runTrivyConfig } from './policy/trivy.mjs';
import { computeRunKey, subjectSetHash } from './run-key.mjs';

const events = new Set(['pull_request', 'default_branch', 'schedule', 'workflow_dispatch']);

export async function runPolicy({
  event = 'pull_request',
  path = 'policy',
  runKey,
  root = process.cwd(),
  allowDownload = true,
  gitleaksBaseSha = process.env.SCA_GITLEAKS_BASE_SHA,
} = {}) {
  if (!events.has(event) || !['policy', 'artifacts'].includes(path))
    return invocationReport(event, path, runKey, 'invalid-event-path');
  const revision = gitSha(root);
  const subjects =
    path === 'artifacts' ? ['api-production-image', 'dashboard-distribution-archive'] : [];
  const expected = computeRunKey(event, revision, path, subjectSetHash(subjects));
  if (!/^[a-f0-9]{64}$/.test(runKey ?? '') || runKey !== expected)
    return invocationReport(event, path, runKey, 'run-key-mismatch', revision);
  const toolset = await verifyOrAcquireTools({ root, allowDownload }).catch(() => ({
    manifest: { tools: [] },
    resolved: new Map(),
    errors: [],
    complete: false,
  }));
  const dependencyBefore = await dependencySnapshot(root);
  const tool = (id) => toolset.manifest.tools.find((x) => x.tool_id === id);
  const executable = (id) => toolset.resolved.get(id);
  const packageBytes = await fs.readFile(`${root}/package-lock.json`);
  const packageLock = JSON.parse(packageBytes);
  const packageHash = canonicalLockSha256(packageBytes);
  const policyFiles = [
    '.supply-chain/policy.json',
    '.supply-chain/license-baseline.json',
    '.supply-chain/exceptions.json',
    'deny.toml',
  ];
  const policySha256 = canonicalSha256(
    await Promise.all(
      policyFiles.map(async (file) => ({
        file,
        sha256: sha256(await fs.readFile(`${root}/${file}`)),
      })),
    ),
  );
  const checks = [];
  const full = await runNpmAudit({ cwd: root });
  const production = await runNpmAudit({ cwd: root, production: true });
  checks.push(
    asCheck('npm_advisories', tool('npm'), combineAudits(full, production), ['package-lock.json']),
  );
  try {
    const baselineDoc = JSON.parse(
      await fs.readFile(`${root}/.supply-chain/license-baseline.json`),
    );
    const npmBaseline = baselineDoc.licenses.filter((row) => row.ecosystem === 'npm');
    const inventory = await inspectLicenseInventory(packageLock, packageHash);
    const blockedInventory = inventory.violations.some((x) => x.state === 'blocked');
    const license = inventory.violations.length
      ? {
          state: blockedInventory ? 'blocked' : 'fail',
          rule_id: inventory.violations[0].rule_id,
          completion: blockedInventory ? 'unavailable' : 'complete',
          count: inventory.violations.length,
        }
      : checkLicenseBaseline(inventory.rows, npmBaseline);
    checks.push(
      asCheck('npm_licenses', tool('npm-license-inventory'), license, ['package-lock.json']),
    );
  } catch {
    checks.push(
      asCheck(
        'npm_licenses',
        tool('npm-license-inventory'),
        { state: 'blocked', rule_id: 'license-input', completion: 'malformed', count: 0 },
        ['package-lock.json'],
      ),
    );
  }
  checks.push(
    asCheck(
      'npm_sources',
      tool('npm-lock-guard'),
      checkNpmLock(packageLock, { workspaceRoot: root }),
      ['package-lock.json'],
    ),
  );
  checks.push(
    asCheck(
      'cargo_policy',
      tool('cargo-deny'),
      await runCargoDeny({ executable: executable('cargo-deny'), cwd: root }),
      ['Cargo.lock', 'Cargo.toml'],
    ),
  );
  checks.push(
    asCheck(
      'repository_secrets',
      tool('gitleaks'),
      await runGitleaks({
        executable: executable('gitleaks'),
        cwd: root,
        logOptions: gitleaksLogOptions(event, revision, gitleaksBaseSha),
        requireLogOptions: true,
      }),
      ['.git'],
    ),
  );
  const trivy = await runTrivyConfig({ executable: executable('trivy'), cwd: root });
  let exceptionResult;
  try {
    exceptionResult = validateExceptions(
      JSON.parse(await fs.readFile(`${root}/.supply-chain/exceptions.json`)),
    );
  } catch {
    exceptionResult = {
      state: 'blocked',
      rule_id: 'exception-registry-malformed',
      completion: 'malformed',
    };
  }
  const dependencyAfter = await dependencySnapshot(root);
  const dependencyResult = compareDependencySnapshots(dependencyBefore, dependencyAfter);
  checks.push(
    asCheck(
      'configuration',
      tool('trivy'),
      combineConfiguration(trivy, exceptionResult, dependencyResult),
      [
        '.github/workflows',
        'apps/api/Dockerfile',
        'apps/dashboard/Dockerfile',
        'package-lock.json',
        'Cargo.lock',
        '.supply-chain/exceptions.json',
      ],
    ),
  );
  const base = {
    schema_version: 1,
    report_kind: 'supply_chain_policy',
    revision_sha: revision,
    event,
    path,
    run_key: runKey,
    policy_sha256: policySha256,
    created_at: new Date().toISOString(),
    retention_days: 30,
    toolchain: {
      node: process.versions.node,
      npm: tool('npm')?.version ?? 'unknown',
      rust: 'candidate-1.98.0',
    },
    checks,
    findings: [],
    exceptions: [],
    subjects: [],
    redaction: { count: 0, kinds: [] },
    artifacts: [],
  };
  return normalizePolicyReport(base, requiredChecksFor(event, 'policy'));
}

export function gitleaksLogOptions(event, revision, baseSha) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) return null;
  if (event === 'pull_request')
    return /^[a-f0-9]{40}$/.test(baseSha ?? '') ? `${baseSha}..${revision}` : null;
  return `${revision}^!`;
}

function asCheck(check_id, tool, result, scope) {
  const count = result.count ?? result.total ?? (result.state === 'fail' ? 1 : 0);
  return {
    check_id,
    authority: CHECK_AUTHORITIES[check_id],
    required: true,
    scope,
    tool: tool?.tool_id ?? CHECK_AUTHORITIES[check_id],
    tool_version: tool?.version ?? 'unavailable',
    advisory_data_revision: result.advisory_data_revision ?? null,
    state: result.state,
    completion: result.completion ?? (result.state === 'blocked' ? 'unavailable' : 'complete'),
    rule_id: result.rule_id ?? null,
    reason_code: result.state === 'blocked' ? result.rule_id : null,
    reason_params: {},
    finding_count: count,
    evidence_sha256: result.raw_output_sha256 ?? null,
  };
}
function combineConfiguration(...results) {
  const blocked = results.find((result) => result.state === 'blocked');
  if (blocked) return blocked;
  const failed = results.find((result) => result.state === 'fail');
  if (failed) return failed;
  return {
    state: 'pass',
    completion: 'complete',
    rule_id: 'configuration-pass',
    count: 0,
    raw_output_sha256: canonicalSha256(
      results.map((result) => result.raw_output_sha256 ?? result.rule_id),
    ),
  };
}
function invocationReport(event, path, run_key, reason_code, revision_sha = '0'.repeat(40)) {
  return {
    schema_version: 1,
    report_kind: 'supply_chain_policy',
    revision_sha,
    event,
    path,
    run_key: run_key ?? '',
    policy_sha256: '0'.repeat(64),
    created_at: new Date().toISOString(),
    retention_days: 30,
    complete: false,
    aggregate: 'blocked',
    toolchain: { node: process.versions.node, npm: 'unknown', rust: 'candidate-1.98.0' },
    checks: [],
    findings: [],
    exceptions: [],
    subjects: [],
    redaction: { count: 0, kinds: [] },
    artifacts: [],
    reason_code,
  };
}
function args(argv) {
  const allowed = new Set(['--event', '--path', '--run-key']);
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.has(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new Error('invalid invocation');
    const key = argv[i] === '--run-key' ? 'runKey' : argv[i].slice(2);
    out[key] = argv[i + 1];
  }
  return out;
}
if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href) {
  let result;
  try {
    result = await runPolicy(args(process.argv.slice(2)));
  } catch {
    result = invocationReport('unknown', 'unknown', null, 'invalid-invocation');
  }
  process.stdout.write(JSON.stringify(result));
  process.exitCode = result.aggregate === 'blocked' ? 2 : result.aggregate === 'fail' ? 1 : 0;
}
