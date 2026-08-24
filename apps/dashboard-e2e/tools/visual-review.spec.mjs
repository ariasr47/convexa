import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateAcceptance,
  validateAuthorization,
  validateCandidateSet,
  validateStability,
} from './lib/visual-review.mjs';
const manifest = { visual: { scenarios: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}` })) } };
const auth = {
  schema_version: 1,
  authorization_id: 'auth-1',
  decision: 'authorize_candidate_generation',
  state: 'authorized',
  actor: { id: 'owner', role: 'owner' },
  source_revision: 'a'.repeat(40),
  platform: 'win32',
  created_at: '2026-01-01T00:00:00Z',
  failed_compare: {
    run_id: 'run-1',
    summary_path: 'x/summary.json',
    summary_sha256: 'b'.repeat(64),
  },
  scenarios: manifest.visual.scenarios.map((x) => ({
    scenario_id: x.id,
    expected_path: null,
    expected_sha256: null,
    actual_path: `x/${x.id}.png`,
    actual_sha256: 'b'.repeat(64),
    diff_path: `x/${x.id}.diff.png`,
    diff_sha256: null,
  })),
};
test('authorization requires human owner/design authority and six cases', () => {
  assert.throws(() => validateAuthorization(auth, manifest));
  assert.throws(() =>
    validateAuthorization({ ...auth, actor: { id: 'x', role: 'code_reviewer' } }, manifest),
  );
  assert.throws(() => validateAuthorization({ ...auth, scenarios: [] }, manifest));
});
test('candidate and acceptance receipts enforce state and reviewer role', () => {
  const c = {
    schema_version: 1,
    candidate_set_id: 'set-1',
    authorization_id: 'auth-1',
    state: 'candidates_written',
    generated_by: { actor_id: 'x', command: 'npm run browser:visual:update' },
    source_revision: 'a'.repeat(40),
    platform: 'win32',
    manifest_sha256: 'b'.repeat(64),
    generated_at: '2026-01-01T00:00:00Z',
    candidates: manifest.visual.scenarios.map((x) => ({
      scenario_id: x.id,
      path: `x/${x.id}.png`,
      sha256: 'b'.repeat(64),
    })),
  };
  assert.throws(() => validateCandidateSet(c, manifest));
  const a = {
    schema_version: 1,
    acceptance_id: 'acc-1',
    candidate_set_id: 'set-1',
    decision: 'accept_candidates',
    state: 'accepted',
    actor: { id: 'reviewer', role: 'code_reviewer' },
    source_revision: 'a'.repeat(40),
    platform: 'win32',
    reviewed_at: '2026-01-01T00:00:00Z',
    authorization_path: 'apps/dashboard-e2e/visual-review/authorizations/auth-1.json',
    authorization_sha256: 'c'.repeat(64),
    candidate_receipt_path: 'apps/dashboard-e2e/visual-review/candidate-sets/set-1.json',
    candidate_receipt_sha256: 'd'.repeat(64),
    source_diff_path: 'apps/dashboard-e2e/visual-review/diffs/set-1.patch',
    source_diff_sha256: 'e'.repeat(64),
    candidates: c.candidates,
  };
  assert.throws(() => validateAcceptance(a, manifest));
});
test('stability requires two distinct clean summaries', () => {
  const a = { state: 'accepted', source_revision: 'a'.repeat(40), platform: 'win32' };
  const s = {
    status: 'pass',
    flaky: 0,
    not_run: 0,
    source_revision: a.source_revision,
    host_platform: 'win32',
  };
  assert.equal(
    validateStability(a, [
      { ...s, run_id: '1' },
      { ...s, run_id: '2' },
    ]),
    'stability_clean',
  );
  assert.throws(() =>
    validateStability(a, [
      { ...s, run_id: '1' },
      { ...s, run_id: '1' },
    ]),
  );
});
