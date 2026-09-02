import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('visual reporter maps named actual/diff attachments instead of first PNG', () => {
  const source = fs.readFileSync(
    path.resolve('apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts'),
    'utf8',
  );
  assert.match(source, /visualAttachmentRole\(attachment\)/);
  assert.match(source, /if \(role === 'actual'\) actualArtifact = artifact/);
  assert.match(source, /if \(role === 'diff'\) diffArtifact = artifact/);
  assert.doesNotMatch(source, /!actualArtifact && path\.extname/);
  assert.match(source, /diff_path: diffArtifact\?\.path \?\? null/);
  assert.match(source, /includes\('A11Y-'\) && !String\(x\.identity\)\.includes\('A11Y-B'\)/);
});

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

test('visual mismatch operator line uses exact SPEC §4 scenario wording', () => {
  const output = 'apps/dashboard-e2e/test-output/playwright/visual/summary.json';
  const script = `
    import { QualityReporter } from './apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts';
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));
    const ids = ['landing', 'ticker-desktop', 'ticker-offline-mobile', 'positions-dense', 'scanner-dense', 'ai-recommendation'];
    const reporter = new QualityReporter({ gate: 'visual', output: ${JSON.stringify(output)} });
    const tests = ids.map((id) => ({
      titlePath: () => ['', 'chromium', 'visual.spec.ts', id],
      location: { file: process.cwd().replaceAll('\\\\', '/') + '/apps/dashboard-e2e/src/quality/visual.spec.ts' },
      parent: { project: () => ({ name: 'chromium' }) },
    }));
    reporter.onBegin({ rootDir: process.cwd() }, { allTests: () => tests });
    reporter.onTestEnd(tests[0], { status: 'failed', retry: 0, attachments: [] });
    for (let i = 1; i < tests.length; i += 1) {
      reporter.onTestEnd(tests[i], { status: 'passed', retry: 0, attachments: [] });
    }
    reporter.onEnd();
    console.log = originalLog;
    console.error = originalError;
    const expected = ${JSON.stringify(`[FAIL] visual — landing: the approved baseline differs. Review expected, actual, and diff images. Open: ${output}`)};
    if (!logs.includes(expected)) {
      console.error(JSON.stringify(logs));
      process.exit(1);
    }
    if (logs.some((line) => /\\[FAIL\\] visual — \\d+ failed/.test(line))) process.exit(2);
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
