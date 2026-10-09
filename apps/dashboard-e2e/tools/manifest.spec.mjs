import assert from 'node:assert/strict';
import test from 'node:test';
import { loadManifest, validateManifest } from './lib/manifest.mjs';

test('manifest rejects duplicate, blank and unknown records', () => {
  const manifest = loadManifest();
  assert.throws(() =>
    validateManifest({
      ...manifest,
      full_chromium: {
        ...manifest.full_chromium,
        tests: [...manifest.full_chromium.tests, manifest.full_chromium.tests[0]],
      },
    }),
  );
  assert.throws(() => validateManifest({ ...manifest, unexpected: true }));
  assert.throws(() =>
    validateManifest({ ...manifest, accessibility: { ...manifest.accessibility, scans: [] } }),
  );
});
