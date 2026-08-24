import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const vite = fs.readFileSync('apps/dashboard/vite.config.mts', 'utf8');
const readme = fs.existsSync('apps/dashboard-e2e/README.md')
  ? fs.readFileSync('apps/dashboard-e2e/README.md', 'utf8')
  : '';

test('build target is es2022 and is explicitly emitted-code intent', () => {
  assert.match(vite, /target:\s*['"]es2022['"]/);
  assert.match(readme, /es2022[\s\S]*emitted-code intent only/i);
});

test('no Browserslist transform is declared', () => {
  assert.equal(fs.existsSync('.browserslistrc'), false);
  assert.doesNotMatch(fs.readFileSync('package.json', 'utf8'), /browserslist/i);
  assert.doesNotMatch(vite, /browserslist/i);
});

test('policy names only the pinned Playwright engines', () => {
  assert.match(
    readme,
    /Chromium, Firefox, and WebKit versions installed from Convexa's locked Playwright toolchain/,
  );
  assert.match(
    readme,
    /does not claim coverage for every released Chrome, Edge, Firefox, or Safari version/,
  );
});
