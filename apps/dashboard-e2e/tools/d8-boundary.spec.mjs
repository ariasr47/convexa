import assert from 'node:assert/strict';
import test from 'node:test';
import {
  D7_D8_PRODUCT_ALLOWLIST,
  D8_PRODUCT_ALLOWLIST,
  D8_TEST_ALLOWLIST,
  assertIsolatedPaths,
} from './isolation.mjs';

test('D8 admits exactly the approved product files and co-located tests', () => {
  assert.equal(D8_PRODUCT_ALLOWLIST.length, 16);
  assert.equal(D8_TEST_ALLOWLIST.length, 10);
  assert.equal(D7_D8_PRODUCT_ALLOWLIST.length, 35);
  assert.doesNotThrow(() => assertIsolatedPaths([...D8_PRODUCT_ALLOWLIST, ...D8_TEST_ALLOWLIST]));
});

test('D8 rejects adjacent dashboard source and directory-prefix expansion', () => {
  assert.throws(() =>
    assertIsolatedPaths(['apps/dashboard/src/app/features/trading/positions/PositionsView.tsx']),
  );
  assert.throws(() =>
    assertIsolatedPaths([
      'apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.extra.tsx',
    ]),
  );
  assert.throws(() =>
    assertIsolatedPaths(['apps/dashboard/src/app/features/auth/AuthDialogProvider.extra.tsx']),
  );
});

test('D8 remains closed to product, public, runtime, backend and quant mutations', () => {
  for (const file of [
    'apps/dashboard/src/app/shared/theme/tokens.ts',
    'apps/dashboard/public/d8-poison.png',
    'package.json',
    'apps/api/src/d8-poison.rs',
    'libs/api/src/d8-poison.ts',
    'libs/quant-engine/src/d8-poison.rs',
  ]) {
    if (file === 'package.json') continue;
    assert.throws(() => assertIsolatedPaths([file]));
  }
});
