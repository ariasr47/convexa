import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregate, normalize } from './normalize.mjs';
test('pass aggregate', () => assert.equal(aggregate([{ state: 'pass' }]).state, 'pass'));
test('fail outranks pass', () =>
  assert.equal(aggregate([{ state: 'pass' }, { state: 'fail' }]).state, 'fail'));
test('blocked outranks fail', () =>
  assert.equal(aggregate([{ state: 'fail' }, { state: 'blocked' }]).state, 'blocked'));
test('advisory outranks pass', () =>
  assert.equal(
    aggregate([{ state: 'pass_with_advisories' }, { state: 'pass' }]).state,
    'pass_with_advisories',
  ));
test('empty blocks', () => assert.equal(aggregate([]).state, 'blocked'));
test('invalid blocks', () => assert.equal(normalize(null).state, 'blocked'));
test('missing checks blocks', () => assert.equal(normalize({}).state, 'blocked'));
test('complete pass', () =>
  assert.equal(normalize({ checks: [{ state: 'pass', completion: 'complete' }] }).complete, true));
test('blocked incomplete', () =>
  assert.equal(normalize({ checks: [{ state: 'blocked' }] }).complete, false));
test('skipped incomplete', () =>
  assert.equal(normalize({ checks: [{ state: 'skipped' }] }).complete, false));
