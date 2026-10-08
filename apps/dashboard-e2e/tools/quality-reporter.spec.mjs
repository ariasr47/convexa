import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('accessibility reporter retains axe finding fields and attachment evidence', () => {
  const source = fs.readFileSync(
    path.resolve('apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts'),
    'utf8',
  );
  assert.match(source, /attachment\.name === 'axe-findings\.json'/);
  assert.match(source, /artifact_path: artifact\.path/);
  assert.match(source, /findings: this\.findings/);
  assert.match(
    source,
    /Automated WCAG-oriented scanning is not a complete manual accessibility audit or assistive-technology certification/,
  );
  assert.doesNotMatch(source, /findings: \[\]/);
  // (lean-tests batch 22) Moved here from the retired visual-attachment case: the scan/behavior
  // split is accessibility behavior, not visual.
  assert.match(source, /includes\('A11Y-'\) && !String\(x\.identity\)\.includes\('A11Y-B'\)/);
});

test('real reporter identity helpers map manifest Chromium and all behavior IDs', () => {
  const script = `
    import fs from 'node:fs';
    import { mapChromiumIdentity, mapAccessibilityBehaviorId } from './apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts';
    const manifest = JSON.parse(fs.readFileSync('./apps/dashboard-e2e/src/quality/manifest.json', 'utf8'));
    const first = manifest.full_chromium.tests[0];
    if (mapChromiumIdentity(first.file, first.title_path, first.project) !== first.test_id) process.exit(1);
    for (const behavior of manifest.accessibility.behaviors) {
      if (mapAccessibilityBehaviorId(['', 'chromium', 'accessibility.spec.ts', behavior.id + ' behavior']) !== behavior.id) process.exit(2);
    }
    try { mapChromiumIdentity(first.file, ['wrong'], first.project); process.exit(3); } catch {}
  `;
  assert.doesNotThrow(() =>
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--input-type=module', '-e', script],
      {
        cwd: path.resolve('.'),
        stdio: 'pipe',
      },
    ),
  );
});
