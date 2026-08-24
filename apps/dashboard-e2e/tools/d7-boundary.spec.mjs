import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { D7_PRODUCT_ALLOWLIST, assertIsolatedPaths } from './isolation.mjs';

test('D7 product allowlist is closed and contains only the approved dashboard files', () => {
  assert.equal(D7_PRODUCT_ALLOWLIST.length, 9);
  assert.doesNotThrow(() => assertIsolatedPaths(D7_PRODUCT_ALLOWLIST));
  assert.throws(() => assertIsolatedPaths(['apps/dashboard/src/app/shared/theme/tokens.ts']));
  assert.throws(() => assertIsolatedPaths(['apps/dashboard/src/app/app.tsx']));
});

test('axe remains development-only and D7 does not introduce runtime dependencies', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
  assert.equal(typeof pkg.devDependencies?.['@axe-core/playwright'], 'string');
  assert.equal(pkg.dependencies?.['@axe-core/playwright'], undefined);
  assert.equal(pkg.dependencies?.['playwright'], undefined);
});
