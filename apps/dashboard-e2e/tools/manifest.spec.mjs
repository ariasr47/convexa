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
  // (curvature-v2-surfaces FE-13) 90 → 99 — see `lib/manifest.mjs`'s own comment at this same
  // check for the itemized 9-test delta.
  // (curvature-v2-surfaces GATE Z repair) 99 → 100 — the off-exchange proximity chip's 44px floor,
  // newly reachable — see `lib/manifest.mjs`'s own comment at this same check.
  // (curvature-v2-surfaces GATE Z repair pass 2) 100 → 103 — the input/select 44px floor's 3 new
  // `no-overflow.spec.ts` tests — see `lib/manifest.mjs`'s own comment at this same check.
  // (curvature-v2-surfaces GATE Z repair pass 3) 103 → 105 — criterion 66's second clause:
  // `TrackRecordSection.tsx`'s `<summary>` on `/positions` (touched this phase, `bdc992d8`) now
  // meets the 44px coarse-pointer floor; 2 new `no-overflow.spec.ts` tests (393 coarse + 1280 fine,
  // the latter proving the fix is inert on a fine pointer).
  // (curvature-v2-surfaces GATE Z repair pass 4) 105 → 108 — QA pass 3's Medium finding: the
  // pass-3 fix's `display: flex` removed the `<summary>`'s native disclosure `::marker`; pass 4
  // reaches 44px with `line-height` instead, leaving `display: list-item` intact. 3 new
  // `no-overflow.spec.ts` tests (393 coarse, 393 fine, 1280 fine) each asserting the marker
  // mechanism (`display: list-item`) and full open/close/focus/Enter operability.
  // (curvature-v2-landing-and-site F15) 108 → 126: three new public routes (/blog, /methodology,
  // an unmatched path) × six ROUTES loops in `no-overflow.spec.ts` = 18 net-new Chromium tests.
  // Accessibility scans 9 → 12: one new axe scan per new surface (AC-G1).
  // (curvature-v2-landing-and-site GATE Z I-2, amendment 5) Accessibility scans 12 → 24: the
  // NAMED six-surface × {dark,light} × 393 matrix (the 404 also at 1280, unchanged; the open
  // sign-in dialog counted as a surface too). Chromium was unchanged at 126 by THAT repair.
  // (curvature-v2-landing-and-site GATE Z I-1) Chromium 126 → 128: one e2e case in
  // `navigation.spec.ts` covers the methodology TOC click and the fresh deep link past
  // `index.html`'s `<base href="/">` (AC-M6/AC-M1).
  // (no-vendor-production-posture AC-10) Accessibility scans 24 → 28: the paused ticker-desk
  // panel (F2), a seventh surface, at both breakpoints (393/1280) and both color schemes.
  // (lean-tests batch 22) Chromium 128 → 35: `no-overflow.spec.ts` retired (93 cases); the pixel
  // visual gate and its `visual` manifest section retired with it — see `lib/manifest.mjs`.
  assert.equal(manifest.full_chromium.tests.length, 35);
  assert.equal(manifest.compatibility.journeys.length, 5);
  assert.deepEqual(manifest.compatibility.projects, ['chromium', 'firefox', 'webkit']);
  assert.equal(manifest.accessibility.scans.length, 28);
  assert.equal(manifest.accessibility.behaviors.length, 7);
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
  ]);
});
