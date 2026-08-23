import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { evaluateParity, selectorFiles, selectorSetSha256 } from './bootstrap-candidate.mjs';
import { canonicalSha256 } from './lib/canonical.mjs';
import { runKey } from './run-key.mjs';

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
export const requiredCheckSetSha256 = () => canonicalSha256([...REQUIRED_CHECK_IDS].sort());
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function validateAcceptedCi(receipt, acceptedSha) {
  if (
    !receipt ||
    receipt.receipt_kind !== 'accepted_revision_ci' ||
    receipt.accepted_revision_sha !== acceptedSha ||
    receipt.complete !== true ||
    receipt.outcome !== 'pass' ||
    !['pull_request', 'default_branch'].includes(receipt.event) ||
    receipt.path !== 'policy'
  )
    return { valid: false, reason_code: 'accepted-ci-invalid' };
  if (receipt.subject_set_sha256 !== canonicalSha256([]))
    return { valid: false, reason_code: 'accepted-ci-subject-set' };
  if (receipt.required_check_set_sha256 !== requiredCheckSetSha256())
    return { valid: false, reason_code: 'accepted-ci-check-set' };
  const ids = receipt.checks?.map((item) => item.check_id) ?? [];
  if (
    ids.length !== REQUIRED_CHECK_IDS.length ||
    new Set(ids).size !== ids.length ||
    REQUIRED_CHECK_IDS.some((id) => !ids.includes(id)) ||
    receipt.checks.some(
      (item) => item.state !== 'pass' || !/^[a-f0-9]{64}$/.test(item.evidence_sha256 ?? ''),
    )
  )
    return { valid: false, reason_code: 'accepted-ci-checks' };
  const expected = runKey(receipt.event, acceptedSha, 'policy', []);
  if (receipt.run_key !== expected) return { valid: false, reason_code: 'accepted-ci-run-key' };
  return { valid: true, reason_code: 'accepted-ci-pass' };
}
export function selectorSet(files) {
  return canonicalSha256(
    Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  );
}

async function detectCurrent(root) {
  const run = (exe, argv) => spawnSync(exe, argv, { cwd: root, encoding: 'utf8', shell: false });
  return {
    node: process.versions.node,
    npm: run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version']).stdout.trim(),
    rust: run('cargo', ['--version']).stdout.match(/cargo\s+(\d+\.\d+\.\d+)/)?.[1] ?? 'unavailable',
  };
}
async function fileBytes(file) {
  return fs.readFile(file);
}
async function fileHash(file) {
  return hash(await fileBytes(file));
}

export async function bindAccepted({
  qualificationPath = '.supply-chain/out/toolchain-qualification.json',
  acceptedCiPath = '.supply-chain/out/accepted-revision-ci.json',
  acceptedSha = process.env.SCA_ACCEPTED_REVISION_SHA,
  root = process.cwd(),
  headSha,
  detect = detectCurrent,
  diffBytes,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(acceptedSha ?? '')) return blocked('accepted-revision-sha-required');
  const head =
    headSha ??
    spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    }).stdout.trim();
  if (head !== acceptedSha) return blocked('accepted-revision-not-current-head', acceptedSha);
  let qualificationBytes, ciBytes, qualification, ci, manifest;
  try {
    qualificationBytes = await fileBytes(path.resolve(root, qualificationPath));
    ciBytes = await fileBytes(path.resolve(root, acceptedCiPath));
    qualification = JSON.parse(qualificationBytes);
    ci = JSON.parse(ciBytes);
    manifest = JSON.parse(
      await fs.readFile(path.join(root, '.supply-chain/candidate-toolchain.json'), 'utf8'),
    );
  } catch {
    return blocked('qualification-or-ci-artifact-missing', acceptedSha);
  }
  if (
    qualification.receipt_kind !== 'toolchain_qualification' ||
    qualification.complete !== true ||
    qualification.outcome !== 'pass' ||
    qualification.checks?.length !== 21 ||
    qualification.checks.some((item) => item.state !== 'pass')
  )
    return blocked('qualification-not-pass', acceptedSha);
  const ciResult = validateAcceptedCi(ci, acceptedSha);
  if (!ciResult.valid) return blocked(ciResult.reason_code, acceptedSha);
  const patch =
    diffBytes ??
    Buffer.from(
      spawnSync(
        'git',
        [
          'diff',
          '--binary',
          qualification.base_revision_sha,
          acceptedSha,
          '--',
          ...manifest.allowed_selector_paths,
        ],
        { cwd: root, encoding: 'utf8', shell: false },
      ).stdout,
    );
  if (hash(patch) !== qualification.candidate_patch_sha256)
    return blocked('accepted-patch-mismatch', acceptedSha);
  const files = await selectorFiles(root, manifest.allowed_selector_paths);
  const acceptedSelectorHash = selectorSetSha256(files);
  const candidateSelectorHash = acceptedSelectorHash;
  const parity = await evaluateParity(root, manifest);
  if (Object.values(parity).some((value) => !value))
    return blocked('accepted-selector-parity-mismatch', acceptedSha, parity);
  const detected = await detect(root);
  if (
    detected.node !== qualification.candidate.node ||
    detected.npm !== qualification.candidate.npm ||
    detected.rust !== qualification.candidate.rust
  )
    return blocked('accepted-tool-version-mismatch', acceptedSha, parity, detected);
  const locks = {
    package: await fileHash(path.join(root, 'package-lock.json')),
    cargo: await fileHash(path.join(root, 'Cargo.lock')),
  };
  const locksMatch =
    locks.package === qualification.inputs?.package_lock_sha256 &&
    locks.cargo === qualification.inputs?.cargo_lock_sha256;
  if (!locksMatch) return blocked('accepted-lock-mismatch', acceptedSha, parity, detected);
  return {
    schema_version: 1,
    receipt_kind: 'toolchain_binding',
    accepted_revision_sha: acceptedSha,
    qualification_ref: 'artifact:toolchain-qualification#/receipt',
    qualification_sha256: hash(qualificationBytes),
    base_revision_sha: qualification.base_revision_sha,
    candidate_revision_id: qualification.candidate_revision_id,
    accepted_selector_set_sha256: acceptedSelectorHash,
    candidate_selector_set_sha256: candidateSelectorHash,
    accepted_ci_ref: 'artifact:accepted-revision-ci#/receipt',
    accepted_ci_sha256: hash(ciBytes),
    accepted_ci_run_key: ci.run_key,
    accepted_ci_required_check_set_sha256: ci.required_check_set_sha256,
    accepted_ci_complete: true,
    accepted_ci_outcome: 'pass',
    detected,
    locks,
    locks_match_qualification: true,
    parity,
    complete: true,
    outcome: 'pass',
  };
}

function blocked(reason_code, accepted_revision_sha = '0'.repeat(40), parity = {}, detected = {}) {
  return {
    schema_version: 1,
    receipt_kind: 'toolchain_binding',
    accepted_revision_sha: /^[a-f0-9]{40}$/.test(accepted_revision_sha)
      ? accepted_revision_sha
      : '0'.repeat(40),
    qualification_ref: 'artifact:toolchain-qualification#/receipt',
    qualification_sha256: '0'.repeat(64),
    base_revision_sha: '0'.repeat(40),
    candidate_revision_id: '0'.repeat(64),
    accepted_selector_set_sha256: '0'.repeat(64),
    candidate_selector_set_sha256: '0'.repeat(64),
    accepted_ci_ref: 'artifact:accepted-revision-ci#/receipt',
    accepted_ci_sha256: '0'.repeat(64),
    accepted_ci_run_key: '0'.repeat(64),
    accepted_ci_required_check_set_sha256: requiredCheckSetSha256(),
    accepted_ci_complete: false,
    accepted_ci_outcome: 'blocked',
    detected: {
      node: detected.node ?? process.versions.node,
      npm: detected.npm ?? 'unavailable',
      rust: detected.rust ?? 'unavailable',
    },
    locks: { package: '0'.repeat(64), cargo: '0'.repeat(64) },
    locks_match_qualification: false,
    parity: {
      nvmrc: parity.nvmrc ?? false,
      package_metadata: parity.package_metadata ?? false,
      rust_toolchain: parity.rust_toolchain ?? false,
      crate_rust_version: parity.crate_rust_version ?? false,
      ci: parity.ci ?? false,
      dockerfiles: parity.dockerfiles ?? false,
      actions_full_sha: parity.actions_full_sha ?? false,
      images_tag_and_digest: parity.images_tag_and_digest ?? false,
      root_locks_only: parity.root_locks_only ?? false,
    },
    complete: false,
    outcome: 'blocked',
    reason_code,
  };
}
function parse(argv) {
  return (
    argv.length === 4 &&
    argv[0] === '--mode' &&
    argv[1] === 'accepted' &&
    argv[2] === '--qualification' &&
    argv[3] === 'artifact:toolchain-qualification#/receipt'
  );
}
if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href) {
  const result = parse(process.argv.slice(2))
    ? await bindAccepted()
    : blocked('invalid-invocation');
  process.stdout.write(JSON.stringify(result));
  process.exitCode = result.outcome === 'pass' ? 0 : result.outcome === 'fail' ? 1 : 2;
}
