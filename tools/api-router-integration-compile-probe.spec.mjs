import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateCompileProbeReceipt } from './api-contract.mjs';
import { canonicalIdSetHash } from './api-router-integration-baseline.mjs';

test('probe schema requires the all-52 execution facts', () => {
  assert.equal(canonicalIdSetHash(['b', 'a']).length, 64);
});

/** In-repo fixture — do not require the archived cross-feature compile receipt on disk. */
const toolPath = 'tools/api-router-integration-compile-probe.mjs';
const toolBytes = readFileSync(
  resolve(import.meta.dirname, 'api-router-integration-compile-probe.mjs'),
);
const cleanReceipt = {
  schema_version: 1,
  probe_id: 'openapi-router-integration-all-52',
  result: 'PASS',
  source_revision: 'a'.repeat(40),
  command: 'npm run api:router-integration:compile-probe',
  probe_tool_path: toolPath,
  probe_tool_sha256: createHash('sha256').update(toolBytes).digest('hex'),
  utoipa_version: '5.5.0',
  registration_count: 52,
  operation_set_sha256: 'b'.repeat(64),
  pairing_guard: { observed_unique_pair_count: 52, result: 'PASS' },
  metadata_traits: { path: 'PASS', schema_references: 'PASS', tags: 'PASS' },
  method_filters: {
    DELETE: 'PASS',
    GET: 'PASS',
    HEAD: 'PASS',
    OPTIONS: 'PASS',
    PATCH: 'PASS',
    POST: 'PASS',
    PUT: 'PASS',
    TRACE: 'PASS',
  },
  witnesses: {
    sse: { pair: 'stream::stream_ticker / stream::__path_stream_ticker', result: 'PASS' },
    stateful_auth: { pair: 'auth::get_settings / auth::__path_get_settings', result: 'PASS' },
    declared_error: {
      pair: 'recommendation::post_recommendation / recommendation::__path_post_recommendation',
      result: 'PASS',
    },
  },
  invalid_graph_outcomes: 0,
  toolchain: { rustc_vv_sha256: 'c'.repeat(64), cargo_version: 'cargo 1.97.1' },
};

const poisons = {
  'missing marker': () => null,
  'non-zero run': (x) => {
    x.result = 'FAIL';
  },
  'duplicate marker': (x) => {
    x.registration_count = 51;
  },
  'stale revision': (x) => {
    x.source_revision = '0'.repeat(40);
  },
  'tool hash': (x) => {
    x.probe_tool_sha256 = '0'.repeat(64);
  },
  'utoipa pin': (x) => {
    x.utoipa_version = '4.0.0';
  },
  '52 count': (x) => {
    x.registration_count = 53;
  },
  pairing: (x) => {
    x.pairing_guard.observed_unique_pair_count = 51;
  },
  'method witnesses': (x) => {
    x.witnesses.sse.result = 'FAIL';
  },
  toolchain: (x) => {
    x.method_filters.TRACE = 'FAIL';
  },
  'hand edit': (x) => {
    x.command = 'cargo test';
  },
  'atomic output': (x) => {
    x.invalid_graph_outcomes = 1;
  },
};
for (const [name, mutate] of Object.entries(poisons))
  test(`rejects ${name} poison`, () => {
    const poisoned = structuredClone(cleanReceipt);
    const changed = mutate(poisoned);
    assert.throws(
      () =>
        validateCompileProbeReceipt(
          changed === undefined ? poisoned : changed,
          cleanReceipt.source_revision,
        ),
      /compile probe receipt/,
    );
  });
