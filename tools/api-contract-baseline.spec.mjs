import assert from 'node:assert/strict';
import test from 'node:test';
import { canonical, interfacePairs, parseRegistrations } from './api-contract-baseline.mjs';

test('literal route is captured', () =>
  assert.deepEqual(parseRegistrations('.route("/x", get(handler))'), [
    { method: 'GET', path: '/x' },
  ]));
test('multiline route is captured', () =>
  assert.deepEqual(parseRegistrations('.route(\n "/x",\n get(handler)\n)'), [
    { method: 'GET', path: '/x' },
  ]));
test('chained method routers expand', () =>
  assert.deepEqual(parseRegistrations('.route("/x", get(a).post(b).put(c).delete(d))'), [
    { method: 'DELETE', path: '/x' },
    { method: 'GET', path: '/x' },
    { method: 'POST', path: '/x' },
    { method: 'PUT', path: '/x' },
  ]));
test('operations sort by path then method', () =>
  assert.deepEqual(parseRegistrations('.route("/z", post(a)).route("/a", get(b))'), [
    { method: 'GET', path: '/a' },
    { method: 'POST', path: '/z' },
  ]));
test('duplicate registrations refuse', () =>
  assert.throws(
    () => parseRegistrations('.route("/x", get(a)).route("/x", get(b))'),
    /duplicate operation/,
  ));
test('dynamic path refuses', () =>
  assert.throws(() => parseRegistrations('.route(path, get(a))'), /unsupported dynamic route/));
test('unknown combinator refuses', () =>
  assert.throws(() => parseRegistrations('.route("/x", trace(a))'), /no recognized method/));
test('empty input refuses', () =>
  assert.throws(() => parseRegistrations('Router::new()'), /no literal/));
test('unconsumed route expression refuses', () => {
  assert.throws(() => parseRegistrations('.route("/x", get(a)'), /no literal|unterminated/);
});
test('interface inventory parses method/path rows', () =>
  assert.deepEqual(interfacePairs('| 1 | GET | `/x` | JSON |'), [{ method: 'GET', path: '/x' }]));
test('canonical candidate bytes have one newline', () =>
  assert.equal(canonical({ b: 1, a: 2 }), '{\n  "b": 1,\n  "a": 2\n}\n'));
test('route scanner ignores comments', () =>
  assert.deepEqual(parseRegistrations('// .route("/bad", delete(x))\n.route("/ok", get(x))'), [
    { method: 'GET', path: '/ok' },
  ]));
