import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { annotation, runnerResultLine } from './publication.mjs';
import { renderSummary, renderSummaryCli } from './render-summary.mjs';
import { runKey, subjectSetSha256 } from './run-key.mjs';
import { sanitize, validatePolicyReport } from './sanitize.mjs';

const catalogs = {
  owners: { owners: [{ owner_id: 'security' }] },
  actions: { actions: [{ action_code: 'upgrade_dependency' }] },
  messages: { messages: { finding: { params: ['count'] } } },
};
const check = (id) => ({
  check_id: id,
  authority: {
    npm_advisories: 'npm-audit',
    npm_licenses: 'npm-license-inventory',
    npm_sources: 'npm-lock-guard',
    cargo_policy: 'cargo-deny',
    repository_secrets: 'gitleaks',
    configuration: 'trivy',
  }[id],
  required: true,
  scope: ['package-lock.json'],
  tool: 'tool',
  tool_version: '1.0.0',
  advisory_data_revision: null,
  state: 'pass',
  completion: 'complete',
  rule_id: null,
  reason_code: null,
  reason_params: {},
  finding_count: 0,
  evidence_sha256: null,
});
const report = () => ({
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
  checks: [
    'npm_advisories',
    'npm_licenses',
    'npm_sources',
    'cargo_policy',
    'repository_secrets',
    'configuration',
  ].map(check),
  findings: [],
  exceptions: [],
  subjects: [],
  redaction: { count: 0, kinds: [] },
  artifacts: [],
});

test('strict complete report sanitizes without data synthesis', () => {
  const input = report(),
    result = sanitize(input, catalogs);
  assert.equal(result.safe, true);
  assert.deepEqual(result.value, input);
});
test('unknown report, check, finding, subject and artifact fields block', () => {
  for (const mutation of [
    (x) => (x.raw_output = 'x'),
    (x) => (x.checks[0].stdout = 'x'),
    (x) => {
      x.findings = [finding(x)];
      x.findings[0].snippet = 'x';
    },
    (x) => {
      x.path = 'artifacts';
      x.subjects = [subject(x)];
      x.subjects[0].url = 'x';
    },
    (x) => {
      x.artifacts = [artifact()];
      x.artifacts[0].path = 'x';
    },
  ]) {
    const x = report();
    mutation(x);
    assert.equal(sanitize(x, catalogs).safe, false);
  }
});
test('canary, authorization, credential URL and control bytes block every retained channel', () => {
  for (const poison of [
    'canary-secret-123',
    'SCA_CANARY_SECRET_9f31',
    'SCA-CANARY-SECRET-9f31',
    'Authorization: Bearer abc',
    'https://u:p@example.test/x?token=y',
    'line\nvalue',
  ]) {
    const x = report();
    x.toolchain.node = poison;
    assert.equal(sanitize(x, catalogs).safe, false);
  }
});
test('missing, duplicate, stale, native-skipped and wrong-authority checks block', () => {
  for (const mutate of [
    (x) => x.checks.pop(),
    (x) => x.checks.push(x.checks[0]),
    (x) => (x.checks[0].authority = 'trivy'),
    (x) => {
      x.checks[0].state = 'skipped';
      x.checks[0].completion = 'authorized_skip';
    },
    (x) => (x.revision_sha = 'd'.repeat(39)),
  ]) {
    const x = report();
    mutate(x);
    assert.equal(sanitize(x, catalogs).safe, false);
  }
});
test('finding catalogs, evidence, counts and advisory accountability are enforced', () => {
  const x = report();
  x.artifacts = [artifact()];
  x.findings = [finding(x)];
  x.checks[0].state = 'fail';
  x.checks[0].finding_count = 1;
  x.aggregate = 'fail';
  assert.equal(sanitize(x, catalogs).safe, true);
  for (const mutate of [
    (y) => (y.findings[0].owner_id = 'unknown'),
    (y) => (y.findings[0].evidence_ref = 'artifact:missing#/findings/0'),
    (y) => (y.checks[0].finding_count = 0),
    (y) => {
      y.findings[0].classification = 'advisory';
      y.findings[0].rationale = null;
    },
  ]) {
    const y = structuredClone(x);
    mutate(y);
    assert.equal(sanitize(y, catalogs).safe, false);
  }
});
test('artifact hash, retention interval, size and name are strict', () => {
  const x = report();
  x.artifacts = [artifact()];
  assert.doesNotThrow(() => validatePolicyReport(x, catalogs));
  for (const mutate of [
    (a) => (a.sha256 = 'x'),
    (a) => (a.retention_days = 29),
    (a) => (a.expires_at = '2026-09-21T00:00:00.000Z'),
    (a) => (a.size_bytes = 0),
    (a) => (a.file_name = '../raw.log'),
  ]) {
    const y = report();
    y.artifacts = [artifact()];
    mutate(y.artifacts[0]);
    assert.equal(sanitize(y, catalogs).safe, false);
  }
});
test('policy path rejects subjects and artifact path requires both exact associations', () => {
  const x = report();
  x.subjects = [subject(x)];
  assert.equal(sanitize(x, catalogs).safe, false);
  const y = report();
  y.path = 'artifacts';
  assert.equal(sanitize(y, catalogs).safe, false);
});
test('summary is verdict-first, complete, bounded and reports redaction only when declared', () => {
  const x = report();
  const summary = renderSummary(x);
  assert.ok(summary.startsWith('# Required supply-chain checks passed for revision aaaaaaa.'));
  assert.match(summary, /## Checks/);
  assert.doesNotMatch(summary, /redacted/);
  x.redaction = { count: 1, kinds: ['snippet'] };
  assert.match(renderSummary(x), /Some diagnostic text was redacted/);
});
test('summary uses exact aggregate terminal copy with revision for every state and exact order', () => {
  const expected = {
    pass: '# Required supply-chain checks passed for revision aaaaaaa.',
    pass_with_advisories:
      '# Required supply-chain checks passed with advisories for revision aaaaaaa.',
    fail: '# Supply-chain policy failed for revision aaaaaaa.',
    blocked: '# Supply-chain checks are blocked for revision aaaaaaa. No pass result is available.',
  };
  for (const [aggregate, lead] of Object.entries(expected)) {
    const x = report();
    x.aggregate = aggregate;
    const summary = renderSummary(x);
    assert.equal(summary.split('\n')[0], lead);
    assert.ok(summary.indexOf(lead) < summary.indexOf('Revision:'));
    assert.ok(summary.indexOf('Revision:') < summary.indexOf('## Checks'));
    assert.ok(summary.indexOf('## Checks') < summary.indexOf('## Provenance'));
  }
});
test('summary CLI writes only exact sanitized bytes and preserves closed state exits', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-summary-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'policy-report.json');
  const output = path.join(directory, 'github-step-summary.md');
  for (const [x, exit] of [
    [report(), 0],
    [reportWithAdvisory(), 0],
    [reportWithFailure(), 1],
    [reportBlocked(), 2],
  ]) {
    await fs.writeFile(input, JSON.stringify(x));
    assert.equal(await renderSummaryCli(['--report', input, '--output', output]), exit);
    assert.deepEqual(await fs.readFile(output), Buffer.from(renderSummary(x)));
  }
});
test('artifact summary emits the three exact bounded association sentences in order', () => {
  const x = report();
  x.subjects = [subject(x)];
  const summary = renderSummary(x);
  const generated = summary.indexOf(
    'CycloneDX lock-derived dependency inventory generated and schema-validated',
  );
  const limitation = summary.indexOf(
    'Syft did not observe or catalog the subject bytes; the digest is an association key.',
  );
  const deploy = summary.indexOf(
    'This evidence does not identify bytes independently rebuilt or deployed by Railway or Cloudflare.',
  );
  assert.ok(generated >= 0 && generated < limitation && limitation < deploy);
});
test('runner line and annotation expose only bounded safe fields', () => {
  assert.equal(
    runnerResultLine('npm_sources', 'pass', 'policy-report.json'),
    'SCA_RESULT npm_sources pass policy-report.json',
  );
  assert.equal(runnerResultLine('bad\n', 'pass', 'x'), 'SCA_RESULT blocked sanitizer-output');
  assert.match(
    annotation({ repoPath: 'tools/x.mjs', title: 'Policy', message: 'Repair 100%' }),
    /%25/,
  );
  assert.equal(annotation({ repoPath: '../secret', title: 'x', message: 'y' }), null);
});
test('run and subject keys are deterministic, sorted and duplicate-insensitive', () => {
  assert.equal(
    runKey('pull_request', 'a'.repeat(40), 'policy'),
    runKey('pull_request', 'a'.repeat(40), 'policy'),
  );
  assert.equal(subjectSetSha256(['b', 'a', 'a']), subjectSetSha256(['a', 'b']));
});

function artifact() {
  return {
    artifact_id: 'policy-report',
    kind: 'policy_report',
    file_name: 'policy-report.json',
    media_type: 'application/json',
    sha256: 'd'.repeat(64),
    size_bytes: 10,
    created_at: '2026-08-23T00:00:00.000Z',
    retention_days: 30,
    expires_at: '2026-09-22T00:00:00.000Z',
  };
}
function finding() {
  return {
    finding_id: 'npm-1',
    check_id: 'npm_advisories',
    rule_id: 'npm-advisory',
    classification: 'blocker',
    subject_kind: 'package',
    subject: 'npm:x@1.0.0',
    message_code: 'finding',
    message_params: { count: 1 },
    owner_id: 'security',
    action_code: 'upgrade_dependency',
    evidence_ref: 'artifact:policy-report#/findings/0',
    rationale: null,
    approver_id: null,
    review_at: null,
    expires_at: null,
    exception_id: null,
  };
}
function reportWithFailure() {
  const x = report();
  x.aggregate = 'fail';
  x.artifacts = [artifact()];
  x.findings = [finding()];
  x.checks[0].state = 'fail';
  x.checks[0].finding_count = 1;
  return x;
}
function reportWithAdvisory() {
  const x = report();
  x.aggregate = 'pass_with_advisories';
  x.artifacts = [artifact()];
  x.findings = [
    {
      ...finding(),
      finding_id: 'license-1',
      check_id: 'npm_licenses',
      rule_id: 'license-obligation',
      classification: 'advisory',
      rationale: 'Current baseline notice requires review.',
      approver_id: 'security',
      review_at: '2026-08-24T00:00:00.000Z',
      expires_at: '2026-09-01T00:00:00.000Z',
    },
  ];
  x.checks[1].state = 'pass_with_advisories';
  x.checks[1].finding_count = 1;
  return x;
}
function reportBlocked() {
  const x = report();
  x.aggregate = 'blocked';
  x.complete = false;
  x.checks[0].state = 'blocked';
  x.checks[0].completion = 'unavailable';
  x.checks[0].reason_code = 'tool-unavailable';
  return x;
}
function subject(x) {
  return {
    subject_id: 'api-production-image',
    subject_kind: 'oci_image',
    digest: 'sha256:' + 'e'.repeat(64),
    revision_sha: x.revision_sha,
    run_key: x.run_key,
    build_run_id: '1',
    source_inputs_sha256: 'f'.repeat(64),
    scan_artifact_id: null,
    dependency_inventory_artifact_id: 'policy-report',
    inventory_receipt_artifact_id: 'policy-report',
  };
}
