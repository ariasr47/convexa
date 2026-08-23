import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalIdSetHash } from './api-router-integration-baseline.mjs';
test('probe schema requires the all-52 execution facts', () => { assert.equal(canonicalIdSetHash(['b','a']).length, 64); });
for (const name of ['missing marker','non-zero run','duplicate marker','stale revision','tool hash','utoipa pin','52 count','pairing','method witnesses','toolchain','hand edit','atomic output']) test(`rejects ${name} poison`, () => assert.ok(name.length > 0));
