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
const normalizerCases = [
  ['duplicate checks', () => normalize({ checks: [{ state: 'pass' }, { state: 'pass' }] })],
  ['unknown state', () => normalize({ checks: [{ state: 'mystery' }] })],
  ['null check', () => normalize({ checks: [null] })],
  ['missing state', () => normalize({ checks: [{}] })],
  ['multiple pass', () => aggregate([{ state: 'pass' }, { state: 'pass' }])],
  ['advisory count', () => aggregate([{ state: 'pass_with_advisories' }])],
  ['fail count', () => aggregate([{ state: 'fail' }])],
  ['blocked count', () => aggregate([{ state: 'blocked' }])],
  ['skip count', () => aggregate([{ state: 'skipped' }])],
  ['mixed states', () => aggregate([{ state: 'pass' }, { state: 'fail' }, { state: 'blocked' }])],
  ['empty report', () => normalize({ checks: [] })],
  ['nonarray checks', () => normalize({ checks: {} })],
  ['undefined input', () => normalize(undefined)],
  ['string input', () => normalize('x')],
  ['complete advisory', () => normalize({ checks: [{ state: 'pass_with_advisories' }] })],
  ['complete fail', () => normalize({ checks: [{ state: 'fail' }] })],
  ['complete mixed', () => normalize({ checks: [{ state: 'pass' }, { state: 'fail' }] })],
  ['blocked mixed', () => normalize({ checks: [{ state: 'pass' }, { state: 'blocked' }] })],
  ['authorized skip shape', () => normalize({ checks: [{ state: 'skipped', rule_id: 'x' }] })],
  ['repeated fail', () => aggregate([{ state: 'fail' }, { state: 'fail' }])],
  ['repeated blocked', () => aggregate([{ state: 'blocked' }, { state: 'blocked' }])],
  ['advisory then fail', () => aggregate([{ state: 'pass_with_advisories' }, { state: 'fail' }])],
  ['pass then advisory', () => aggregate([{ state: 'pass' }, { state: 'pass_with_advisories' }])],
  ['pass only', () => aggregate([{ state: 'pass' }])],
  ['fail only', () => aggregate([{ state: 'fail' }])],
  ['blocked only', () => aggregate([{ state: 'blocked' }])],
  ['skip only', () => aggregate([{ state: 'skipped' }])],
  [
    'report metadata',
    () => normalize({ checks: [{ state: 'pass' }], revision_sha: 'a'.repeat(40) }),
  ],
  [
    'report evidence',
    () => normalize({ checks: [{ state: 'pass', evidence_sha256: 'a'.repeat(64) }] }),
  ],
  ['report owner', () => normalize({ checks: [{ state: 'pass', owner_id: 'build' }] })],
  [
    'report action',
    () => normalize({ checks: [{ state: 'pass', action_code: 'rerun_current_revision' }] }),
  ],
  ['report scope', () => normalize({ checks: [{ state: 'pass', scope: 'repo' }] })],
];
for (const [name, fn] of normalizerCases) test(`normalizer ${name}`, () => assert.ok(fn()));
