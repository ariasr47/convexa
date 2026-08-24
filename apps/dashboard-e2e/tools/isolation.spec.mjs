import assert from 'node:assert/strict';
import test from 'node:test';
import { assertIsolatedPaths, D7_PRODUCT_ALLOWLIST, isAllowedPath } from './isolation.mjs';
test('isolation accepts only quality seams', () => {
  assert.equal(isAllowedPath('apps/dashboard-e2e/tools/x.mjs'), true);
  assert.doesNotThrow(() =>
    assertIsolatedPaths(['package.json', 'apps/dashboard-e2e/tools/x.mjs']),
  );
});
test('isolation rejects product, backend and runtime paths', () => {
  for (const file of [
    'apps/dashboard/src/app.tsx',
    'apps/dashboard/public/x.png',
    'libs/api/src/x.ts',
    'apps/api/src/x.rs',
    'libs/quant-engine/src/x.rs',
    'vite.config.ts',
  ])
    assert.throws(() => assertIsolatedPaths([file]));
});
test('D7 admits exactly the nine product files and rejects adjacent dashboard source', () => {
  assert.equal(D7_PRODUCT_ALLOWLIST.length, 9);
  assert.doesNotThrow(() => assertIsolatedPaths(D7_PRODUCT_ALLOWLIST));
  assert.throws(() => assertIsolatedPaths(['apps/dashboard/src/app/shared/theme/tokens.ts']));
  assert.throws(() => assertIsolatedPaths(['apps/dashboard/src/app/pages/landing/Landing.tsx']));
});
