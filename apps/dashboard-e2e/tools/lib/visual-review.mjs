import fs from 'node:fs';
import path from 'node:path';
import { repositoryPath, sha256File } from './fs-safe.mjs';

const ID = /^[a-z0-9][a-z0-9._-]+$/;
const SHA = /^[a-f0-9]{64}$/;
const REV = /^[a-f0-9]{40}$/;
const PLATFORMS = new Set(['win32', 'linux']);
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const exact = (value, required, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`invalid ${label}`);
  const actual = Object.keys(value).sort();
  if (actual.join('|') !== [...required].sort().join('|')) throw new Error(`${label} keys drift`);
};
const string = (value, label) => {
  if (typeof value !== 'string' || !value) throw new Error(`invalid ${label}`);
};
const id = (value, label) => {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`invalid ${label}`);
};
const sha = (value, label, nullable = false) => {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !SHA.test(value)) throw new Error(`invalid ${label}`);
};
const timestamp = (value, label) => {
  if (typeof value !== 'string' || !UTC.test(value) || Number.isNaN(Date.parse(value)))
    throw new Error(`invalid ${label}`);
};
const rootOf = (root) => path.resolve(root ?? process.cwd());
const safe = (root, value, label) => {
  try {
    return repositoryPath(rootOf(root), value);
  } catch {
    throw new Error(`invalid ${label}`);
  }
};
const existingHash = (root, relative, expected, label, required = true) => {
  if (relative === null && !required) return;
  const file = safe(root, relative, `${label} path`);
  if (!fs.existsSync(file) || sha256File(file) !== expected)
    throw new Error(`${label} hash mismatch`);
};
const manifestIds = (manifest) => {
  const ids = manifest?.visual?.scenarios?.map((x) => x.id);
  if (!Array.isArray(ids) || ids.length !== 6 || new Set(ids).size !== 6)
    throw new Error('manifest visual inventory');
  return ids;
};
const rows = (value, ids, key, label) => {
  if (!Array.isArray(value) || value.length !== ids.length) throw new Error(`${label} inventory`);
  const got = value.map((x) => x?.[key]);
  if (
    got.some((x) => typeof x !== 'string') ||
    new Set(got).size !== got.length ||
    got.some((x) => !ids.includes(x))
  )
    throw new Error(`${label} scenario set`);
};
const actor = (value, role, label) => {
  exact(value, ['id', 'role'], label);
  string(value.id, `${label} id`);
  if (value.role !== role && !(Array.isArray(role) && role.includes(value.role)))
    throw new Error(`invalid ${label} role`);
};
const common = (value, label) => {
  if (
    value.schema_version !== 1 ||
    !REV.test(value.source_revision) ||
    !PLATFORMS.has(value.platform)
  )
    throw new Error(`invalid ${label} source`);
};

export const fileHash = (file) => sha256File(file);
export const manifestHash = (manifestFile) => fileHash(manifestFile);

export function validateAuthorization(value, manifest, now = Date.now(), root = process.cwd()) {
  exact(
    value,
    [
      'schema_version',
      'authorization_id',
      'decision',
      'state',
      'actor',
      'source_revision',
      'platform',
      'created_at',
      'failed_compare',
      'scenarios',
    ],
    'authorization',
  );
  id(value.authorization_id, 'authorization id');
  if (
    value.schema_version !== 1 ||
    value.decision !== 'authorize_candidate_generation' ||
    value.state !== 'authorized'
  )
    throw new Error('invalid authorization state');
  actor(value.actor, ['owner', 'design_reviewer'], 'authorization actor');
  common(value, 'authorization');
  timestamp(value.created_at, 'created_at');
  if (Date.parse(value.created_at) > now) throw new Error('authorization is from the future');
  exact(value.failed_compare, ['run_id', 'summary_path', 'summary_sha256'], 'failed compare');
  id(value.failed_compare.run_id, 'failed compare run id');
  sha(value.failed_compare.summary_sha256, 'summary sha');
  existingHash(
    root,
    value.failed_compare.summary_path,
    value.failed_compare.summary_sha256,
    'summary',
  );
  const ids = manifestIds(manifest);
  rows(value.scenarios, ids, 'scenario_id', 'authorization');
  for (const row of value.scenarios) {
    exact(
      row,
      [
        'scenario_id',
        'expected_path',
        'expected_sha256',
        'actual_path',
        'actual_sha256',
        'diff_path',
        'diff_sha256',
      ],
      'authorization scenario',
    );
    id(row.scenario_id, 'scenario id');
    sha(row.actual_sha256, 'actual sha');
    sha(row.diff_sha256, 'diff sha', true);
    sha(row.expected_sha256, 'expected sha', true);
    existingHash(root, row.actual_path, row.actual_sha256, 'actual');
    if (row.expected_sha256 === null) {
      if (row.expected_path !== null) throw new Error('missing expected hash requires null path');
    } else existingHash(root, row.expected_path, row.expected_sha256, 'expected');
    if (row.diff_sha256 === null) {
      if (row.diff_path !== null) throw new Error('missing diff hash requires null path');
    } else existingHash(root, row.diff_path, row.diff_sha256, 'diff');
  }
  return value;
}

export function validateCandidateSet(value, manifest, root = process.cwd()) {
  exact(
    value,
    [
      'schema_version',
      'candidate_set_id',
      'authorization_id',
      'state',
      'generated_by',
      'source_revision',
      'platform',
      'manifest_sha256',
      'generated_at',
      'candidates',
    ],
    'candidate set',
  );
  if (value.schema_version !== 1 || value.state !== 'candidates_written')
    throw new Error('invalid candidate state');
  id(value.candidate_set_id, 'candidate set id');
  id(value.authorization_id, 'authorization id');
  common(value, 'candidate set');
  sha(value.manifest_sha256, 'manifest sha');
  timestamp(value.generated_at, 'generated_at');
  exact(value.generated_by, ['actor_id', 'command'], 'generated_by');
  string(value.generated_by.actor_id, 'generated_by actor');
  if (value.generated_by.command !== 'npm run browser:visual:update')
    throw new Error('invalid generation command');
  const ids = manifestIds(manifest);
  rows(value.candidates, ids, 'scenario_id', 'candidate');
  for (const row of value.candidates) {
    exact(row, ['scenario_id', 'path', 'sha256'], 'candidate');
    id(row.scenario_id, 'candidate scenario');
    sha(row.sha256, 'candidate sha');
    existingHash(root, row.path, row.sha256, 'candidate');
  }
  return value;
}

export function validateAcceptance(value, manifest, root = process.cwd()) {
  exact(
    value,
    [
      'schema_version',
      'acceptance_id',
      'candidate_set_id',
      'decision',
      'state',
      'actor',
      'source_revision',
      'platform',
      'reviewed_at',
      'authorization_path',
      'authorization_sha256',
      'candidate_receipt_path',
      'candidate_receipt_sha256',
      'source_diff_path',
      'source_diff_sha256',
      'candidates',
    ],
    'acceptance',
  );
  if (
    value.schema_version !== 1 ||
    !['accept_candidates', 'reject_candidates'].includes(value.decision) ||
    value.state !== (value.decision === 'accept_candidates' ? 'accepted' : 'rejected')
  )
    throw new Error('invalid acceptance state');
  id(value.acceptance_id, 'acceptance id');
  id(value.candidate_set_id, 'candidate set id');
  actor(value.actor, 'code_reviewer', 'acceptance actor');
  common(value, 'acceptance');
  timestamp(value.reviewed_at, 'reviewed_at');
  for (const [key, hash] of [
    ['authorization_path', 'authorization_sha256'],
    ['candidate_receipt_path', 'candidate_receipt_sha256'],
    ['source_diff_path', 'source_diff_sha256'],
  ]) {
    safe(root, value[key], key);
    sha(value[hash], hash);
    existingHash(root, value[key], value[hash], key);
  }
  if (
    value.source_diff_path !==
    `apps/dashboard-e2e/visual-review/diffs/${value.candidate_set_id}.patch`
  )
    throw new Error('source diff path mismatch');
  const candidateReceipt = JSON.parse(
    fs.readFileSync(safe(root, value.candidate_receipt_path, 'candidate receipt'), 'utf8'),
  );
  validateCandidateSet(candidateReceipt, manifest, root);
  if (
    candidateReceipt.candidate_set_id !== value.candidate_set_id ||
    candidateReceipt.source_revision !== value.source_revision ||
    candidateReceipt.platform !== value.platform
  )
    throw new Error('candidate binding mismatch');
  const authorization = JSON.parse(
    fs.readFileSync(safe(root, value.authorization_path, 'authorization'), 'utf8'),
  );
  validateAuthorization(authorization, manifest, Date.now(), root);
  if (
    authorization.authorization_id !== candidateReceipt.authorization_id ||
    authorization.source_revision !== value.source_revision ||
    authorization.platform !== value.platform
  )
    throw new Error('authorization binding mismatch');
  const ids = manifestIds(manifest);
  rows(value.candidates, ids, 'scenario_id', 'acceptance');
  for (const row of value.candidates) {
    exact(row, ['scenario_id', 'path', 'sha256'], 'accepted candidate');
    id(row.scenario_id, 'candidate scenario');
    sha(row.sha256, 'candidate sha');
    existingHash(root, row.path, row.sha256, 'accepted candidate');
  }
  return value;
}

export function validateStability(acceptance, summaries) {
  if (acceptance?.state !== 'accepted' || !Array.isArray(summaries) || summaries.length !== 2)
    throw new Error('stability is not clean');
  const [a, b] = summaries;
  if (
    !a ||
    !b ||
    !a.run_id ||
    a.run_id === b.run_id ||
    a.status !== 'pass' ||
    b.status !== 'pass' ||
    a.source_revision !== acceptance.source_revision ||
    b.source_revision !== acceptance.source_revision ||
    a.host_platform !== acceptance.platform ||
    b.host_platform !== acceptance.platform ||
    a.flaky ||
    b.flaky ||
    a.not_run ||
    b.not_run ||
    a.retries ||
    b.retries
  )
    throw new Error('stability is not clean');
  const hashes = (x) =>
    x.accepted_png_sha256 ??
    JSON.stringify(x.scenarios?.map((s) => s.sha256 ?? s.actual_sha256) ?? null);
  if (hashes(a) !== hashes(b)) throw new Error('stability PNG hashes changed');
  return 'stability_clean';
}
