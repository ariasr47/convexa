import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  validateAcceptance,
  validateAuthorization,
  validateCandidateSet,
  validateStability,
} from './lib/visual-review.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-authority-'));
const manifest = {
  visual: { scenarios: Array.from({ length: 6 }, (_, i) => ({ id: `case-${i}` })) },
};
const files = new Map();
function write(relative, content = relative) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  files.set(relative, sha256);
  return { path: relative, sha256 };
}
const revision = 'a'.repeat(40);
const summary = write('evidence/summary.json', 'summary');
const actual = manifest.visual.scenarios.map((x) => write(`evidence/${x.id}.actual`, x.id));
const diff = manifest.visual.scenarios.map((x) => write(`evidence/${x.id}.diff`, `${x.id}-diff`));
const expected = manifest.visual.scenarios.map((x) =>
  write(`apps/dashboard-e2e/src/quality/snapshots/win32/chromium/${x.id}.png`, `${x.id}-expected`),
);
const authorization = {
  schema_version: 1,
  authorization_id: 'authorization-1',
  decision: 'authorize_candidate_generation',
  state: 'authorized',
  actor: { id: 'owner@example.test', role: 'owner' },
  source_revision: revision,
  platform: 'win32',
  created_at: '2026-01-01T00:00:00.000Z',
  failed_compare: { run_id: 'run-1', summary_path: summary.path, summary_sha256: summary.sha256 },
  scenarios: manifest.visual.scenarios.map((x, i) => ({
    scenario_id: x.id,
    expected_path: expected[i].path,
    expected_sha256: expected[i].sha256,
    actual_path: actual[i].path,
    actual_sha256: actual[i].sha256,
    diff_path: diff[i].path,
    diff_sha256: diff[i].sha256,
  })),
};
const candidatePngs = manifest.visual.scenarios.map((x) =>
  write(`candidate/${x.id}.png`, `${x.id}-candidate`),
);
const candidate = {
  schema_version: 1,
  candidate_set_id: 'candidate-set-1',
  authorization_id: authorization.authorization_id,
  state: 'candidates_written',
  generated_by: { actor_id: 'visual-update', command: 'npm run browser:visual:update' },
  source_revision: revision,
  platform: 'win32',
  manifest_sha256: 'b'.repeat(64),
  generated_at: '2026-01-01T00:00:00.000Z',
  candidates: manifest.visual.scenarios.map((x, i) => ({
    scenario_id: x.id,
    path: candidatePngs[i].path,
    sha256: candidatePngs[i].sha256,
  })),
};
write(
  'apps/dashboard-e2e/visual-review/authorizations/authorization-1.json',
  JSON.stringify(authorization),
);
write(
  'apps/dashboard-e2e/visual-review/candidate-sets/candidate-set-1.json',
  JSON.stringify(candidate),
);
write('apps/dashboard-e2e/visual-review/diffs/candidate-set-1.patch', 'diff');
const acceptance = {
  schema_version: 1,
  acceptance_id: 'acceptance-1',
  candidate_set_id: candidate.candidate_set_id,
  decision: 'accept_candidates',
  state: 'accepted',
  actor: { id: 'reviewer', role: 'code_reviewer' },
  source_revision: revision,
  platform: 'win32',
  reviewed_at: '2026-01-01T00:00:00.000Z',
  authorization_path: 'apps/dashboard-e2e/visual-review/authorizations/authorization-1.json',
  authorization_sha256: files.get(
    'apps/dashboard-e2e/visual-review/authorizations/authorization-1.json',
  ),
  candidate_receipt_path: 'apps/dashboard-e2e/visual-review/candidate-sets/candidate-set-1.json',
  candidate_receipt_sha256: files.get(
    'apps/dashboard-e2e/visual-review/candidate-sets/candidate-set-1.json',
  ),
  source_diff_path: 'apps/dashboard-e2e/visual-review/diffs/candidate-set-1.patch',
  source_diff_sha256: files.get('apps/dashboard-e2e/visual-review/diffs/candidate-set-1.patch'),
  candidates: candidate.candidates,
};

test('valid authorization/candidate/acceptance roundtrip', () => {
  assert.doesNotThrow(() => validateAuthorization(authorization, manifest, Date.now(), root));
  assert.doesNotThrow(() => validateCandidateSet(candidate, manifest, root));
  assert.doesNotThrow(() => validateAcceptance(acceptance, manifest, root));
});
const authPoisons = {
  'authorization extra key': (x) => ({ ...x, extra: true }),
  'authorization empty id': (x) => ({ ...x, authorization_id: '' }),
  'authorization bad decision': (x) => ({ ...x, decision: 'accept_candidates' }),
  'authorization bad state': (x) => ({ ...x, state: 'accepted' }),
  'authorization bad actor role': (x) => ({ ...x, actor: { id: 'x', role: 'code_reviewer' } }),
  'authorization empty actor id': (x) => ({ ...x, actor: { id: '', role: 'owner' } }),
  'authorization bad revision': (x) => ({ ...x, source_revision: 'not-a-revision' }),
  'authorization bad platform': (x) => ({ ...x, platform: 'darwin' }),
  'authorization non-UTC timestamp': (x) => ({ ...x, created_at: '2026-01-01T00:00:00-08:00' }),
  'authorization future timestamp': (x) => ({ ...x, created_at: '2999-01-01T00:00:00.000Z' }),
  'authorization missing compare run': (x) => ({
    ...x,
    failed_compare: { ...x.failed_compare, run_id: undefined },
  }),
  'authorization compare hash mismatch': (x) => ({
    ...x,
    failed_compare: { ...x.failed_compare, summary_sha256: '0'.repeat(64) },
  }),
  'authorization path escape': (x) => ({
    ...x,
    scenarios: x.scenarios.map((r) => ({ ...r, actual_path: '../secret' })),
  }),
  'authorization duplicate scenario': (x) => ({
    ...x,
    scenarios: x.scenarios.map((r, i) =>
      i === 1 ? { ...r, scenario_id: x.scenarios[0].scenario_id } : r,
    ),
  }),
  'authorization surplus scenario': (x) => ({ ...x, scenarios: [...x.scenarios, x.scenarios[0]] }),
  'authorization actual hash mismatch': (x) => ({
    ...x,
    scenarios: x.scenarios.map((r, i) => (i === 0 ? { ...r, actual_sha256: '0'.repeat(64) } : r)),
  }),
  'authorization null required actual hash': (x) => ({
    ...x,
    scenarios: x.scenarios.map((r, i) => (i === 0 ? { ...r, actual_sha256: null } : r)),
  }),
  'authorization invalid missing expected pairing': (x) => ({
    ...x,
    scenarios: x.scenarios.map((r, i) => (i === 0 ? { ...r, expected_sha256: null } : r)),
  }),
  'authorization diff hash mismatch': (x) => ({
    ...x,
    scenarios: x.scenarios.map((r, i) => (i === 0 ? { ...r, diff_sha256: '0'.repeat(64) } : r)),
  }),
};
for (const [name, poison] of Object.entries(authPoisons))
  test(name, () =>
    assert.throws(() => validateAuthorization(poison(authorization), manifest, Date.now(), root)),
  );
const candidatePoisons = {
  'candidate extra key': (x) => ({ ...x, extra: true }),
  'candidate bad id': (x) => ({ ...x, candidate_set_id: '!' }),
  'candidate wrong state': (x) => ({ ...x, state: 'accepted' }),
  'candidate bad revision': (x) => ({ ...x, source_revision: 'x' }),
  'candidate bad platform': (x) => ({ ...x, platform: 'linuxish' }),
  'candidate bad command': (x) => ({
    ...x,
    generated_by: { ...x.generated_by, command: 'node evil.js' },
  }),
  'candidate duplicate scenario': (x) => ({
    ...x,
    candidates: x.candidates.map((r, i) =>
      i ? { ...r, scenario_id: x.candidates[0].scenario_id } : r,
    ),
  }),
  'candidate missing row': (x) => ({ ...x, candidates: x.candidates.slice(0, 5) }),
  'candidate hash mismatch': (x) => ({
    ...x,
    candidates: x.candidates.map((r, i) => (i ? r : { ...r, sha256: '0'.repeat(64) })),
  }),
  'candidate path escape': (x) => ({
    ...x,
    candidates: x.candidates.map((r, i) => (i ? r : { ...r, path: '../secret' })),
  }),
};
for (const [name, poison] of Object.entries(candidatePoisons))
  test(name, () => assert.throws(() => validateCandidateSet(poison(candidate), manifest, root)));
const acceptancePoisons = {
  'acceptance extra key': (x) => ({ ...x, extra: true }),
  'acceptance bad decision/state pair': (x) => ({ ...x, decision: 'reject_candidates' }),
  'acceptance wrong reviewer': (x) => ({ ...x, actor: { id: 'owner', role: 'owner' } }),
  'acceptance bad binding hash': (x) => ({ ...x, candidate_receipt_sha256: '0'.repeat(64) }),
  'acceptance bad diff path': (x) => ({ ...x, source_diff_path: 'other.patch' }),
  'acceptance path escape': (x) => ({ ...x, authorization_path: '../secret' }),
  'acceptance changed candidate': (x) => ({
    ...x,
    candidates: x.candidates.map((r, i) => (i ? r : { ...r, sha256: '0'.repeat(64) })),
  }),
  'acceptance missing candidate': (x) => ({ ...x, candidates: x.candidates.slice(0, 5) }),
};
for (const [name, poison] of Object.entries(acceptancePoisons))
  test(name, () => assert.throws(() => validateAcceptance(poison(acceptance), manifest, root)));
test('stability rejects reuse, retry, and changed PNG hashes', () => {
  const base = {
    run_id: 'one',
    status: 'pass',
    source_revision: revision,
    host_platform: 'win32',
    flaky: 0,
    not_run: 0,
    retries: 0,
    accepted_png_sha256: 'a'.repeat(64),
  };
  const accepted = { state: 'accepted', source_revision: revision, platform: 'win32' };
  assert.equal(validateStability(accepted, [base, { ...base, run_id: 'two' }]), 'stability_clean');
  assert.throws(() => validateStability(accepted, [base, base]));
  assert.throws(() => validateStability(accepted, [base, { ...base, run_id: 'two', retries: 1 }]));
  assert.throws(() =>
    validateStability(accepted, [
      base,
      { ...base, run_id: 'two', accepted_png_sha256: 'b'.repeat(64) },
    ]),
  );
});
