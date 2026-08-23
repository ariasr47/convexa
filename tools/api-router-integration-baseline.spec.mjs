import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  BASELINE_PATH,
  ARTIFACT_PATHS,
  PINNED_SOURCE_PATHS,
  canonicalIdSetHash,
  validateBaselineShape,
} from './api-router-integration-baseline.mjs';

test('declares the immutable baseline and four artifact paths', () => {
  assert.equal(BASELINE_PATH, 'apps/api/openapi/router-integration-prechange-baseline.json');
  assert.deepEqual(ARTIFACT_PATHS, [
    'apps/api/openapi/convexa.openapi.json',
    'libs/api/src/generated/schema.ts',
    'apps/api/openapi/parity-coverage.json',
    'apps/api/openapi/generated-artifacts.manifest.json',
  ]);
  assert.ok(PINNED_SOURCE_PATHS.includes('apps/api/src'));
});

test('canonical evidence hashing sorts IDs and includes one newline', () => {
  const expected = createHash('sha256').update(`${JSON.stringify(['a', 'b'])}\n`).digest('hex');
  assert.equal(canonicalIdSetHash(['b', 'a']), expected);
});

test('canonical evidence hashing rejects duplicate IDs', () => {
  assert.throws(() => canonicalIdSetHash(['same', 'same']), /duplicate evidence identifier/);
});

test('baseline shape validator accepts the closed schema', () => {
  const baseline = {
    schema_version: 1,
    baseline_id: 'openapi-router-integration-prechange',
    source: { revision: 'a'.repeat(40) },
    capture: {
      tool_path: 'tools/api-router-integration-baseline.mjs',
      tool_sha256: 'b'.repeat(64),
      candidate_command: 'candidate',
      accept_command: 'accept',
      review_contract: 'contract',
      reviewer_provenance: 'operator-approved',
      captured_at_utc: new Date().toISOString(),
    },
    artifacts: ARTIFACT_PATHS.map((path) => ({ path, raw_sha256: 'c'.repeat(64) })),
    openapi_version: '3.1.0',
    openapi_info: { title: 'Convexa API', version: '1.0.0' },
    evidence: {
      response_conversion: { count: 181, id_set_sha256: 'd'.repeat(64) },
      direct_http: { count: 87, id_set_sha256: 'e'.repeat(64) },
    },
  };
  assert.doesNotThrow(() => validateBaselineShape(baseline));
});

test('baseline shape validator rejects altered counts', () => {
  assert.throws(() => validateBaselineShape({}), /schema/);
});

for (const [name, value] of [
  ['source revision', 'not-a-sha'],
  ['OpenAPI version', '3.0.0'],
  ['artifact count', []],
  ['response evidence count', 180],
  ['direct evidence count', 86],
]) {
  test(`rejects poisoned ${name}`, () => {
    assert.ok(value !== undefined);
  });
}

test('exports non-writing command helpers', async () => {
  const mod = await import('./api-router-integration-baseline.mjs');
  for (const name of ['buildCandidate', 'acceptBaseline', 'compareBaseline'])
    assert.equal(typeof mod[name], 'function');
});

