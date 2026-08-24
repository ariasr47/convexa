import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const load = () => fs.readFile('.github/dependabot.yml', 'utf8');
test('Dependabot covers five exact ecosystem directories with weekly bounded proposals', async () => {
  const text = await load();
  assert.match(text, /version:\s*2/);
  assert.equal((text.match(/package-ecosystem:/g) ?? []).length, 5);
  for (const value of ['npm', 'cargo', 'github-actions', 'docker'])
    assert.match(text, new RegExp(`package-ecosystem: ${value}`));
  assert.equal((text.match(/interval: weekly/g) ?? []).length, 5);
  assert.equal((text.match(/open-pull-requests-limit: 5/g) ?? []).length, 5);
});
test('routine groups are exact and major updates stay outside them', async () => {
  const text = await load();
  for (const group of [
    'npm-react-runtime',
    'npm-mui-emotion',
    'npm-nx',
    'npm-vite-vitest',
    'npm-playwright-testing',
    'cargo-axum-runtime',
    'cargo-http-tls',
    'cargo-sqlx-postgres',
    'cargo-crypto-auth',
    'github-actions',
  ])
    assert.match(text, new RegExp(`${group}:`));
  assert.equal((text.match(/update-types: \["minor", "patch"\]/g) ?? []).length, 10);
  assert.doesNotMatch(text, /update-types:[^\n]*major/);
});
test('every ecosystem has commit prefix labels owner and reviewer', async () => {
  const text = await load();
  assert.equal((text.match(/commit-message:/g) ?? []).length, 5);
  assert.equal((text.match(/"dependencies"/g) ?? []).length, 5);
  assert.equal((text.match(/"owner:(?:security|build)"/g) ?? []).length, 5);
  assert.equal((text.match(/reviewers: \["ariasr47"\]/g) ?? []).length, 5);
  assert.doesNotMatch(text, /auto-merge|pull-requests:\s*write|miscellaneous/);
});
