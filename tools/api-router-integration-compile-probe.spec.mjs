import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalIdSetHash } from './api-router-integration-baseline.mjs';
import { validateCompileProbeReceipt } from './api-contract.mjs';
test('probe schema requires the all-52 execution facts', () => { assert.equal(canonicalIdSetHash(['b','a']).length, 64); });
const receiptPath = '.spire/clusters/tech/contracts/openapi-router-dependency-replacement/router-integration-compile-probe-receipt.json';
const cleanReceipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
const poisons = {
  'missing marker': () => null,
  'non-zero run': (x) => { x.result = 'FAIL'; },
  'duplicate marker': (x) => { x.registration_count = 51; },
  'stale revision': (x) => { x.source_revision = '0'.repeat(40); },
  'tool hash': (x) => { x.probe_tool_sha256 = '0'.repeat(64); },
  'utoipa pin': (x) => { x.utoipa_version = '4.0.0'; },
  '52 count': (x) => { x.registration_count = 53; },
  pairing: (x) => { x.pairing_guard.observed_unique_pair_count = 51; },
  'method witnesses': (x) => { x.witnesses.sse.result = 'FAIL'; },
  toolchain: (x) => { x.method_filters.TRACE = 'FAIL'; },
  'hand edit': (x) => { x.command = 'cargo test'; },
  'atomic output': (x) => { x.invalid_graph_outcomes = 1; },
};
for (const [name, mutate] of Object.entries(poisons)) test(`rejects ${name} poison`, () => {
  const poisoned = structuredClone(cleanReceipt);
  const changed = mutate(poisoned);
  assert.throws(() => validateCompileProbeReceipt(changed ?? poisoned), /compile probe receipt/);
});
