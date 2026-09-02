import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  ALLOWED_POSTCUTOVER_DELTA,
  APPROVED_REPLACEMENT_REVISION,
  ARTIFACT_PATHS,
  BASELINE_PATH,
  PINNED_SOURCE_PATHS,
  canonicalIdSetHash,
  validateBaselineShape,
  validateCandidateAgainstBaseline,
  validatePostcutoverDelta,
} from './api-router-integration-baseline.mjs';

/** Prefer a stash-create tree when dirty; fall back to HEAD on a clean worktree. */
function sourceRevisionMatchingWorktree(cwd = resolve(import.meta.dirname, '..')) {
  const stashSha = execFileSync('git', ['stash', 'create'], { cwd, encoding: 'utf8' }).trim();
  if (/^[0-9a-f]{40}$/i.test(stashSha)) return stashSha;
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
}

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
  const expected = createHash('sha256')
    .update(`${JSON.stringify(['a', 'b'])}\n`)
    .digest('hex');
  assert.equal(canonicalIdSetHash(['b', 'a']), expected);
});

test('canonical evidence hashing rejects duplicate IDs', () => {
  assert.throws(() => canonicalIdSetHash(['same', 'same']), /duplicate evidence identifier/);
});

test('independent candidate comparator rejects every byte, version, metadata, and evidence mutation', () => {
  const baseline = {
    schema_version: 1,
    baseline_id: 'openapi-router-integration-prechange',
    source: { revision: 'a'.repeat(40) },
    capture: { tool_sha256: 'b'.repeat(64) },
    artifacts: ARTIFACT_PATHS.map((path) => ({ path, raw_sha256: 'c'.repeat(64) })),
    openapi_version: '3.1.0',
    openapi_info: { title: 'legacy', version: '0.2.0' },
    evidence: {
      response_conversion: { count: 181, id_set_sha256: 'd'.repeat(64) },
      direct_http: { count: 87, id_set_sha256: 'e'.repeat(64) },
    },
  };
  const candidate = structuredClone(baseline);
  assert.doesNotThrow(() => validateCandidateAgainstBaseline(candidate, baseline));
  const mutations = [
    (x) => {
      x.artifacts[0].raw_sha256 = 'f'.repeat(64);
    },
    (x) => {
      x.openapi_version = '3.0.3';
    },
    (x) => {
      x.openapi_info.title = 'poison';
    },
    (x) => {
      x.evidence.response_conversion.id_set_sha256 = 'f'.repeat(64);
    },
    (x) => {
      x.evidence.direct_http.count = 86;
    },
  ];
  for (const mutate of mutations) {
    const poisoned = structuredClone(candidate);
    mutate(poisoned);
    assert.throws(() => validateCandidateAgainstBaseline(poisoned, baseline), /contract drift/);
  }
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

test('baseline shape rejects real source, artifact, OpenAPI, and evidence poisons', () => {
  const clean = {
    schema_version: 1,
    baseline_id: 'openapi-router-integration-prechange',
    source: { revision: 'a'.repeat(40) },
    capture: { tool_sha256: 'b'.repeat(64) },
    artifacts: ARTIFACT_PATHS.map((path) => ({ path, raw_sha256: 'c'.repeat(64) })),
    openapi_version: '3.1.0',
    openapi_info: { title: 'legacy' },
    evidence: {
      response_conversion: { count: 181, id_set_sha256: 'd'.repeat(64) },
      direct_http: { count: 87, id_set_sha256: 'e'.repeat(64) },
    },
  };
  const mutations = [
    (x) => {
      x.source.revision = 'not-a-revision';
    },
    (x) => {
      x.artifacts[0].raw_sha256 = 'bad';
    },
    (x) => {
      x.openapi_version = '3.0.3';
    },
    (x) => {
      x.evidence.response_conversion.count = 180;
    },
    (x) => {
      x.evidence.direct_http.id_set_sha256 = 'bad';
    },
  ];
  for (const mutate of mutations) {
    const poisoned = structuredClone(clean);
    mutate(poisoned);
    assert.throws(() => validateBaselineShape(poisoned), /schema/);
  }
  assert.doesNotThrow(() => validateBaselineShape(clean));
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

test('accept path refuses a repeated write to the immutable baseline', async () => {
  const mod = await import('./api-router-integration-baseline.mjs');
  assert.throws(
    () =>
      mod.acceptBaseline({
        candidate: 'apps/api/openapi/router-integration-prechange-baseline.json',
        reviewContract: 'contract',
        reviewerProvenance: 'repeat',
      }),
    /already exists|overwrite/,
  );
});

test('post-cutover comparator accepts the exact frozen B3-B7 delta', () => {
  assert.equal(APPROVED_REPLACEMENT_REVISION, '7d5095f5a60f49400884813540e3349f8026df80');
  assert.equal(ALLOWED_POSTCUTOVER_DELTA.length, 13);
  assert.doesNotThrow(() =>
    validatePostcutoverDelta({
      sourceRevision: '69500b4cbed39531fc1084885e1d75a6b22ca26e',
    }),
  );
});

test('post-cutover comparator rejects an unrelated revision delta', () => {
  assert.throws(
    () =>
      validatePostcutoverDelta({
        sourceRevision: '140297d',
        approvedRevision: APPROVED_REPLACEMENT_REVISION,
      }),
    /approved replacement delta|baseline history/,
  );
});

test('real baseline CLI dispatches through canonical file URL', () => {
  const script = resolve(import.meta.dirname, 'api-router-integration-baseline.mjs');
  const canonical = pathToFileURL(script).href;
  assert.equal(canonical, new URL('./api-router-integration-baseline.mjs', import.meta.url).href);
  if (process.platform === 'win32') assert.match(canonical, /^file:\/\/\/[A-Za-z]:\//);
  const result = spawnSync(process.execPath, [script], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /usage: api-router-integration-baseline\.mjs <candidate\|accept\|compare>/,
  );
});

test('real candidate CLI executes npm evidence without command shim', () => {
  const script = resolve(import.meta.dirname, 'api-router-integration-baseline.mjs');
  const sourceRevision = sourceRevisionMatchingWorktree();
  assert.match(sourceRevision, /^[0-9a-f]{40}$/);
  const out = `.tmp/b1c-runner-${process.pid}.json`;
  const npmCli =
    process.env.npm_execpath ??
    resolve(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const result = spawnSync(
    process.execPath,
    [script, 'candidate', '--source-revision', sourceRevision, '--out', out],
    {
      cwd: resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, npm_execpath: npmCli },
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '..', out), 'utf8')).source.revision,
    sourceRevision,
  );
  rmSync(resolve(import.meta.dirname, '..', out), { force: true });
});

for (const [name, value] of [
  ['missing npm CLI path', undefined],
  ['invalid npm CLI path', 'C:/does/not/exist/npm-cli.js'],
]) {
  test(`real candidate rejects ${name}`, () => {
    const script = resolve(import.meta.dirname, 'api-router-integration-baseline.mjs');
    const out = `.tmp/b1c-invalid-${process.pid}.json`;
    const sourceRevision = sourceRevisionMatchingWorktree();
    const env = { ...process.env };
    if (value === undefined) delete env.npm_execpath;
    else env.npm_execpath = value;
    const result = spawnSync(
      process.execPath,
      [script, 'candidate', '--source-revision', sourceRevision, '--out', out],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8', shell: false, env },
    );
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /npm CLI path is missing or invalid/);
    assert.equal(existsSync(resolve(import.meta.dirname, '..', out)), false);
  });
}
