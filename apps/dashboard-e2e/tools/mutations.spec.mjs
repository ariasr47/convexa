import assert from 'node:assert/strict';
import test from 'node:test';
import { D8_PRODUCT_ALLOWLIST, D8_TEST_ALLOWLIST, assertIsolatedPaths } from './isolation.mjs';
import { loadManifest, validateManifest } from './lib/manifest.mjs';
test('manifest mutation controls reject deletion and duplication', () => {
  const manifest = loadManifest();
  assert.throws(() =>
    validateManifest({
      ...manifest,
      full_chromium: { ...manifest.full_chromium, tests: manifest.full_chromium.tests.slice(1) },
    }),
  );
  assert.throws(() =>
    validateManifest({
      ...manifest,
      full_chromium: {
        ...manifest.full_chromium,
        tests: [...manifest.full_chromium.tests, manifest.full_chromium.tests[0]],
      },
    }),
  );
});
test('manifest positive restoration remains valid', () => {
  assert.doesNotThrow(() => validateManifest(loadManifest()));
});

test('D8 mutation controls reject adjacent source and prefix widening', () => {
  const approved = [...D8_PRODUCT_ALLOWLIST, ...D8_TEST_ALLOWLIST];
  assert.doesNotThrow(() => assertIsolatedPaths(approved));
  for (const poison of [
    'apps/dashboard/src/app/features/trading/positions/PositionsView.tsx',
    'apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.extra.tsx',
    'apps/dashboard/src/app/pages/scanner/ScanCard.extra.tsx',
    'apps/dashboard/src/app/shared/theme/tokens.ts',
  ]) {
    assert.throws(() => assertIsolatedPaths([...approved, poison]));
  }
});
