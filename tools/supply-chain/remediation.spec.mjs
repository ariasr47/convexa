import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { EXPECTED_OVERRIDES, validateRemediation } from './remediation.mjs';
test('exact override object has two entries', () =>
  assert.deepEqual(Object.keys(EXPECTED_OVERRIDES).sort(), ['nx', 'postcss']));
test('direct Nx remains 23.1.1', async () =>
  assert.equal(JSON.parse(await fs.readFile('package.json', 'utf8')).devDependencies.nx, '23.1.1'));
test('bounded remediation resolves brace expansion', async () =>
  assert.match(await fs.readFile('package-lock.json', 'utf8'), /brace-expansion-5\.0\.9\.tgz/));
test('bounded remediation resolves nanoid', async () =>
  assert.match(await fs.readFile('package-lock.json', 'utf8'), /nanoid-3\.3\.18\.tgz/));
test('no forced audit fix is present', async () =>
  assert.doesNotMatch(
    await fs.readFile('tools/supply-chain/remediation.mjs', 'utf8'),
    /audit fix|--force/,
  ));
test('package remains private', async () =>
  assert.equal(JSON.parse(await fs.readFile('package.json')).private, true));
test('lockfile remains v3', async () =>
  assert.equal(JSON.parse(await fs.readFile('package-lock.json')).lockfileVersion, 3));
test('override scope is Nx edge only', () =>
  assert.deepEqual(Object.keys(EXPECTED_OVERRIDES.nx), ['brace-expansion']));
test('override scope is PostCSS edge only', () =>
  assert.deepEqual(Object.keys(EXPECTED_OVERRIDES.postcss), ['nanoid']));
test('remediation result has explicit state', async () =>
  assert.match((await validateRemediation()).state, /pass|fail|blocked/));
test('override candidate does not claim acceptance before hosted tuple evidence', async () => {
  const result = await validateRemediation();
  assert.equal(result.state, 'blocked');
  assert.equal(result.graph_state, 'pass');
  assert.equal(result.rule_id, 'remediation-hosted-evidence-pending');
});
