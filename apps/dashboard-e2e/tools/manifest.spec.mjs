import assert from 'node:assert/strict';
import test from 'node:test';
import { loadManifest, validateManifest } from './lib/manifest.mjs';

test('browser quality manifest is closed and has the required inventories', () => {
  const manifest = loadManifest();
  assert.equal(manifest.schema_version, 1);
  // (curvature-v2-foundations FE-10) 52 → 75 — see `lib/manifest.mjs`'s own comment at this same
  // check for the itemized 23-test delta.
  // (curvature-v2-desk-and-read FE-12) 75 → 86 — see `lib/manifest.mjs`'s own comment at this same
  // check for the itemized 11-test delta (`desk-and-read.spec.ts` + criterion 50).
  // (curvature-v2-surfaces FE-12) 86 → 90 — U-32's frame-scoped extension to `curvature-v2.spec.ts`
  // (4 new tests, one per checked width).
  assert.equal(manifest.full_chromium.tests.length, 90);
  assert.equal(manifest.compatibility.journeys.length, 5);
  assert.deepEqual(manifest.compatibility.projects, ['chromium', 'firefox', 'webkit']);
  assert.equal(manifest.accessibility.scans.length, 9);
  assert.equal(manifest.accessibility.behaviors.length, 7);
  assert.equal(manifest.visual.scenarios.length, 6);
});

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

test('manifest keeps quality files disjoint from retained full suite', () => {
  const manifest = loadManifest();
  const files = new Set(manifest.full_chromium.tests.map((t) => t.file));
  for (const journey of manifest.compatibility.journeys) assert.ok(!files.has(journey.file));
});

test('manifest pins engine policy and artifact roots', () => {
  const manifest = loadManifest();
  assert.equal(manifest.support_policy_id, 'playwright-engines-1.62.1');
  assert.deepEqual(Object.keys(manifest.artifact_roots).sort(), [
    'accessibility',
    'chromium',
    'compatibility',
    'visual',
  ]);
  assert.equal(manifest.visual.threshold, 0);
});
