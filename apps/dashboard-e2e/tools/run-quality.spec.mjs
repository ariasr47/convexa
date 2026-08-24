import assert from 'node:assert/strict';
import test from 'node:test';
import { CHILDREN, aggregateStatus, validateChildCatalog } from './lib/aggregate.mjs';
test('aggregate freezes exactly four ordered children and distinct ports', () => {
  assert.equal(CHILDREN.length, 4);
  assert.deepEqual(
    CHILDREN.map((x) => x.port),
    [4210, 4211, 4212, 4213],
  );
  assert.doesNotThrow(() => validateChildCatalog());
  assert.throws(() => validateChildCatalog([...CHILDREN, { target: 'visual-update', port: 4214 }]));
});
test('aggregate status preserves incomplete over failure over pass', () => {
  assert.equal(aggregateStatus([{ exit_code: 0, status: 'pass' }]), 'pass');
  assert.equal(aggregateStatus([{ exit_code: 1, status: 'fail' }]), 'fail');
  assert.equal(aggregateStatus([{ exit_code: null, status: 'incomplete' }]), 'incomplete');
});
