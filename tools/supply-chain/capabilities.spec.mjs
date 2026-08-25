import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CAPABILITY_IDS,
  buildCapabilityReceipts,
  trivyGithubPatCanary,
  validateCapabilityReceiptSet,
} from './capabilities.mjs';
import { canonicalSha256 } from './lib/canonical.mjs';

const tool = (id) => ({ tool_id: id, version: '1.0.0', sha256: 'a'.repeat(64) });

test('Trivy policy-fail canary matches the v0.74 built-in GitHub PAT rule', () => {
  const canary = trivyGithubPatCanary();
  const prefix = ['gh', 'p_'].join('');

  assert.equal(canary.startsWith(prefix), true);
  assert.equal(canary.length, prefix.length + 36);
  assert.match(canary.slice(prefix.length), /^[0-9a-zA-Z]{36}$/);
});

test('capability harness invokes each real adapter arm and binds tool and fixture hashes', async () => {
  const calls = [];
  const result = await buildCapabilityReceipts({
    capabilities: CAPABILITY_IDS,
    resolveTool: (id) => tool(id),
    resolveFixture: async (capabilityId, arm) => ({
      fixture_id: `${capabilityId}.${arm}`,
      fixture_sha256: canonicalSha256({ capabilityId, arm }),
      payload: { arm },
    }),
    runAdapter: async (capabilityId, fixture) => {
      calls.push([capabilityId, fixture.payload.arm]);
      const actualExit =
        fixture.payload.arm === 'pass' ? 0 : fixture.payload.arm === 'policy_fail' ? 1 : 2;
      return {
        exit_code: actualExit,
        state: actualExit === 0 ? 'pass' : actualExit === 1 ? 'fail' : 'blocked',
        raw_exit_code: actualExit,
        raw_output_sha256: canonicalSha256({ capabilityId, actualExit }),
        publication_canary_leaked: false,
      };
    },
  });
  assert.equal(calls.length, 33);
  assert.equal(new Set(calls.map((x) => x.join(':'))).size, 33);
  assert.equal(result.receipts.length, 33);
  assert.deepEqual(validateCapabilityReceiptSet(result.receipts), { valid: true, errors: [] });
  for (const receipt of result.receipts) {
    assert.equal(receipt.receipt_kind, 'capability_probe');
    assert.match(receipt.tool_sha256, /^[a-f0-9]{64}$/);
    assert.match(receipt.fixture_sha256, /^[a-f0-9]{64}$/);
    assert.match(receipt.raw_output_sha256, /^[a-f0-9]{64}$/);
  }
});

test('receipt-set validator rejects missing, duplicated, or wrong-state arms', () => {
  const expected = CAPABILITY_IDS.flatMap((capabilityId) =>
    ['pass', 'policy_fail', 'unavailable'].map((arm) => ({
      schema_version: 1,
      receipt_kind: 'capability_probe',
      capability_id: capabilityId,
      tool_id: 'normalizer',
      tool_version: '1.0.0',
      tool_sha256: 'a'.repeat(64),
      fixture_id: `${capabilityId}.${arm}`,
      fixture_sha256: 'b'.repeat(64),
      expected_adapter_exit: arm === 'pass' ? 0 : arm === 'policy_fail' ? 1 : 2,
      actual_adapter_exit: arm === 'pass' ? 0 : arm === 'policy_fail' ? 1 : 2,
      expected_state: arm === 'pass' ? 'pass' : arm === 'policy_fail' ? 'fail' : 'blocked',
      actual_state: arm === 'pass' ? 'pass' : arm === 'policy_fail' ? 'fail' : 'blocked',
      raw_exit_code: arm === 'pass' ? 0 : arm === 'policy_fail' ? 1 : 2,
      raw_output_sha256: 'c'.repeat(64),
      sanitized_evidence_ref: 'artifact:capability-receipts#/receipts/0',
      probe_verdict: 'pass',
      publication_canary_leaked: false,
      complete: true,
    })),
  );
  assert.equal(validateCapabilityReceiptSet(expected.slice(1)).valid, false);
  assert.equal(validateCapabilityReceiptSet([...expected, expected[0]]).valid, false);
  assert.equal(
    validateCapabilityReceiptSet(
      expected.map((x, i) => (i === 0 ? { ...x, actual_state: 'fail' } : x)),
    ).valid,
    false,
  );
});

test('production fixture bytes affect the receipt hash', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sca-capability-'));
  const fixture = path.join(directory, 'fixture.json');
  await writeFile(fixture, '{"safe":true}\n');
  const first = canonicalSha256(await readFile(fixture));
  await writeFile(fixture, '{"safe":false}\n');
  const second = canonicalSha256(await readFile(fixture));
  assert.notEqual(first, second);
});

test('capability receipts expose only safe adapter diagnostics', async () => {
  const secret = 'SCA_DIAGNOSTIC_CANARY_DO_NOT_PUBLISH';
  const result = await buildCapabilityReceipts({
    capabilities: ['trivy.api-image-digest-json'],
    resolveTool: () => tool('trivy'),
    resolveFixture: async (capabilityId, arm) => ({
      fixture_id: `${capabilityId}.${arm}`,
      fixture_sha256: canonicalSha256({ capabilityId, arm }),
      payload: { arm },
    }),
    runAdapter: async (_capabilityId, fixture) => ({
      exit_code: fixture.payload.arm === 'pass' ? 0 : fixture.payload.arm === 'policy_fail' ? 1 : 2,
      state:
        fixture.payload.arm === 'pass'
          ? 'pass'
          : fixture.payload.arm === 'policy_fail'
            ? 'fail'
            : 'blocked',
      reason_code:
        fixture.payload.arm === 'unavailable'
          ? `unsafe-${secret}`
          : fixture.payload.arm === 'policy_fail'
            ? 'api-image-finding'
            : 'api-image-clean',
      raw_exit_code:
        fixture.payload.arm === 'unavailable' ? 17 : fixture.payload.arm === 'policy_fail' ? 1 : 0,
      raw_output_sha256: 'd'.repeat(64),
      raw_stdout: secret,
      raw_stderr: secret,
      publication_canary_leaked: false,
    }),
  });

  assert.equal(result.receipts[0].reason_code, 'api-image-clean');
  assert.equal(result.receipts[1].reason_code, 'api-image-finding');
  assert.equal(result.receipts[2].reason_code, 'adapter-reason-unavailable');
  assert.equal(result.receipts[2].raw_exit_code, 17);
  assert.doesNotMatch(JSON.stringify(result.receipts), new RegExp(secret));
  assert.equal('raw_stdout' in result.receipts[2], false);
  assert.equal('raw_stderr' in result.receipts[2], false);
});
