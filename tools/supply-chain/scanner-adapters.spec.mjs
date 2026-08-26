import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { gitleaksLogOptions } from './policy.mjs';
import { runGitleaks } from './policy/gitleaks.mjs';
import { runTrivyConfig, runTrivyImage } from './policy/trivy.mjs';

const sha = (character) => character.repeat(40);
const run = (raw_exit_code, output) => ({
  state: raw_exit_code === 0 ? 'pass' : 'fail',
  raw_exit_code,
  output,
  raw_output_sha256: 'a'.repeat(64),
});

test('policy bounds Gitleaks to the current commit or applicable PR range', () => {
  assert.equal(gitleaksLogOptions('default_branch', sha('b')), `${sha('b')}^!`);
  assert.equal(gitleaksLogOptions('pull_request', sha('b'), sha('a')), `${sha('a')}..${sha('b')}`);
  assert.equal(gitleaksLogOptions('pull_request', sha('b'), ''), null);
});

test('workflow captures raw JSON and explicitly carries the PR base revision', async () => {
  const workflow = await fs.readFile('.github/workflows/supply-chain.yml', 'utf8');
  const caller = await fs.readFile('.github/workflows/ci.yml', 'utf8');
  assert.match(workflow, /contract_base_revision:[\s\S]*?type:\s*string/);
  assert.match(workflow, /SCA_GITLEAKS_BASE_SHA:\s*\$\{\{ inputs\.contract_base_revision \}\}/);
  assert.match(
    caller,
    /contract_base_revision:\s*\$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.sha \}\}/,
  );
  assert.match(
    workflow,
    /node tools\/supply-chain\/policy\.mjs .* > \.supply-chain\/out\/policy-report\.json/,
  );
  assert.match(
    workflow,
    /node tools\/supply-chain\/artifacts\.mjs .* > \.supply-chain\/out\/artifact-report\.json/,
  );
  assert.doesNotMatch(workflow, /npm run supply-chain:(?:policy|artifacts).* >/);
});

test('production Dockerfiles expose health and run final images as non-root', async () => {
  const api = await fs.readFile('apps/api/Dockerfile', 'utf8');
  const dashboard = await fs.readFile('apps/dashboard/Dockerfile', 'utf8');
  const apiEnvironment = api.match(/ENV RUST_LOG=[\s\S]*?POSITIONS_PROVIDER=stub/)?.[0] ?? '';

  assert.match(api, /--target x86_64-unknown-linux-musl/);
  assert.match(api, /FROM scratch/);
  assert.match(
    api,
    /HEALTHCHECK[\s\S]*?CMD \["\/usr\/local\/bin\/api-rust", "healthcheck"\]/,
  );
  assert.doesNotMatch(apiEnvironment, /AUTH_(?:COOKIE_SECURE|STORE_PATH)=/);
  assert.doesNotMatch(api, /ENV[^\n]*AUTH_(?:COOKIE_SECURE|STORE_PATH)=/);
  assert.match(api, /USER 10001:10001/);
  assert.match(api, /CMD \["\/usr\/local\/bin\/api-rust", "serve"\]/);
  assert.doesNotMatch(api, /apt-get install[\s\S]*?ca-certificates curl/);

  assert.match(dashboard, /chown nginx:nginx \/var\/run\/nginx\.pid \/var\/run\/nginx\.lock/);
  assert.match(dashboard, /USER nginx[\s\S]*HEALTHCHECK/);
});

test('gitleaks requires a bounded revision range and counts validated JSON findings', async () => {
  let argv;
  const result = await runGitleaks({
    executable: '/tools/gitleaks',
    logOptions: `${sha('a')}..${sha('b')}`,
    requireLogOptions: true,
    runner: async (_executable, actual) => {
      argv = actual;
      return run(1, JSON.stringify([{ RuleID: 'one' }, { RuleID: 'two' }]));
    },
  });
  assert.deepEqual(argv.slice(-2), ['--log-opts', `${sha('a')}..${sha('b')}`]);
  assert.equal(result.state, 'fail');
  assert.equal(result.count, 2);
  assert.equal(
    (
      await runGitleaks({
        executable: '/tools/gitleaks',
        requireLogOptions: true,
        runner: async () => run(0, '[]'),
      })
    ).rule_id,
    'gitleaks-range-unavailable',
  );
});

test('gitleaks and Trivy block exit-code claims without valid scanner JSON', async () => {
  assert.equal(
    (
      await runGitleaks({
        executable: '/tools/gitleaks',
        logOptions: `${sha('a')}^!`,
        runner: async () => run(1, 'not-json'),
      })
    ).state,
    'blocked',
  );
  assert.equal(
    (
      await runTrivyConfig({
        executable: '/tools/trivy',
        runner: async () => run(1, 'unknown flag'),
      })
    ).state,
    'blocked',
  );
});

test('Trivy config uses its supported command and counts only validated misconfigurations', async () => {
  let argv;
  const runner = async (_executable, actual) => {
    argv = actual;
    return run(
      1,
      JSON.stringify({
        SchemaVersion: 2,
        Results: [{ Misconfigurations: [{ ID: 'DS-0002' }, { ID: 'DS-0026' }] }],
      }),
    );
  };
  const result = await runTrivyConfig({ executable: '/tools/trivy', runner });
  assert.equal(argv[0], 'config');
  assert.equal(argv.includes('--scanners'), false);
  assert.equal(result.state, 'fail');
  assert.equal(result.count, 2);
});

test('Trivy image validates clean and finding-bearing JSON reports', async () => {
  const clean = await runTrivyImage({
    executable: '/tools/trivy',
    digest: `sha256:${'a'.repeat(64)}`,
    input: 'image.oci.tar',
    runner: async () => run(0, JSON.stringify({ SchemaVersion: 2, Results: null })),
  });
  assert.equal(clean.state, 'pass');
  const cleanWithOmittedResults = await runTrivyImage({
    executable: '/tools/trivy',
    digest: `sha256:${'a'.repeat(64)}`,
    input: 'image.oci.tar',
    runner: async () => run(0, JSON.stringify({ SchemaVersion: 2 })),
  });
  assert.equal(cleanWithOmittedResults.state, 'pass');
  assert.equal(cleanWithOmittedResults.count, 0);
  const finding = await runTrivyImage({
    executable: '/tools/trivy',
    digest: `sha256:${'a'.repeat(64)}`,
    input: 'image.oci.tar',
    runner: async () =>
      run(
        1,
        JSON.stringify({
          SchemaVersion: 2,
          Results: [{ Vulnerabilities: [{ VulnerabilityID: 'CVE-test' }], Secrets: [] }],
        }),
      ),
  });
  assert.equal(finding.state, 'fail');
  assert.equal(finding.count, 1);
});

test('Trivy reports granular allow-listed malformed reasons without raw output', async () => {
  const canary = 'SCA_TRIVY_RAW_CANARY_DO_NOT_PUBLISH';
  const cases = [
    ['empty', run(0, '  \n'), 'trivy-empty-output'],
    ['parse', run(0, `{${canary}`), 'trivy-json-parse'],
    [
      'schema-version',
      run(0, JSON.stringify({ SchemaVersion: 1, Results: null })),
      'trivy-schema-version',
    ],
    [
      'results-object',
      run(0, JSON.stringify({ SchemaVersion: 2, Results: {} })),
      'trivy-results-shape',
    ],
    [
      'finding-field-object',
      run(0, JSON.stringify({ SchemaVersion: 2, Results: [{ Secrets: {} }] })),
      'trivy-results-shape',
    ],
    [
      'exit-one-without-findings',
      run(1, JSON.stringify({ SchemaVersion: 2, Results: null })),
      'trivy-exit-count-mismatch',
    ],
    [
      'exit-zero-with-findings',
      run(
        0,
        JSON.stringify({
          SchemaVersion: 2,
          Results: [{ Secrets: [{ RuleID: 'test' }] }],
        }),
      ),
      'trivy-exit-count-mismatch',
    ],
  ];

  for (const [label, toolRun, expectedReason] of cases) {
    const result = await runTrivyImage({
      executable: '/tools/trivy',
      digest: `sha256:${'a'.repeat(64)}`,
      input: 'image.oci.tar',
      runner: async () => toolRun,
    });
    assert.equal(result.state, 'blocked', label);
    assert.equal(result.rule_id, expectedReason, label);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(canary), label);
  }
});
