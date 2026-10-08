import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

for (const gate of ['chromium', 'compatibility']) {
  test(`${gate} retry outcomes count manifest identities once and retain every attempt attachment`, () => {
    const outputRoot = `apps/dashboard-e2e/test-output/playwright/reporter-retries-${gate}-${process.pid}`;
    const outputDirectory = path.resolve(outputRoot);
    const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import path from 'node:path';
    import { QualityReporter } from './apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts';
    import { loadManifest } from './apps/dashboard-e2e/tools/lib/manifest.mjs';
    import { validateSummary } from './apps/dashboard-e2e/tools/lib/summary.mjs';
    const manifest = loadManifest();
    for (const gate of [${JSON.stringify(gate)}]) {
      const identities = gate === 'chromium'
        ? manifest.full_chromium.tests
        : manifest.compatibility.journeys.flatMap((journey) =>
            manifest.compatibility.projects.map((project) => ({
              file: 'apps/dashboard-e2e/src/quality/compatibility.spec.ts',
              title_path: [journey.id],
              project,
            })));
      const tests = identities.map((identity) => ({
        titlePath: () => ['', identity.project, path.basename(identity.file), ...identity.title_path],
        location: { file: path.resolve(identity.file) },
        parent: { project: () => ({ name: identity.project }) },
      }));
      const chromiumRetryIndex = identities.findIndex((identity) =>
        identity.title_path.some((title) => title.includes('AC-35')));
      if (gate === 'chromium') assert.ok(chromiumRetryIndex >= 0);
      const output = ${JSON.stringify(outputRoot)} + '/' + gate + '/summary.json';
      const reporter = new QualityReporter({ gate, output });
      reporter.onBegin({ rootDir: process.cwd() }, { allTests: () => tests });
      const bodies = [];
      const retried = [];
      const endAttempt = (index, status, retry) => {
        const body = gate + ':' + index + ':' + retry + ':' + status;
        bodies.push(body);
        reporter.onTestEnd(tests[index], {
          status, retry,
          attachments: [{ name: 'attempt.txt', contentType: 'text/plain', body: Buffer.from(body) }],
        });
      };
      for (const [index, identity] of identities.entries()) {
        const retries = gate === 'chromium' ? index === chromiumRetryIndex : identity.project === 'webkit';
        endAttempt(index, retries ? 'failed' : 'passed', 0);
        if (retries) {
          retried.push(index);
          endAttempt(index, gate === 'chromium' ? 'passed' : 'failed', 1);
        }
      }
      reporter.onEnd();
      const summary = validateSummary(JSON.parse(fs.readFileSync(output, 'utf8')), { manifest });
      const expected = gate === 'chromium'
        ? { selected: 128, executed: 128, passed: 127, failed: 0, flaky: 1, not_run: 0, status: 'fail' }
        : { selected: 15, executed: 15, passed: 10, failed: 5, flaky: 0, not_run: 0, status: 'fail' };
      for (const [key, value] of Object.entries(expected)) assert.equal(summary[key], value, gate + ':' + key);
      const records = gate === 'chromium' ? summary.tests : summary.arms;
      assert.equal(records.length, tests.length);
      for (const index of retried) {
        const identity = identities[index];
        const record = records.find((entry) => gate === 'chromium'
          ? entry.test_id === identity.test_id
          : entry.journey_id === identity.title_path[0] && entry.engine === identity.project);
        assert.equal(record[gate === 'chromium' ? 'retries' : 'retry'], 1);
        assert.equal(record.status, gate === 'chromium' ? 'flaky' : 'failed');
        assert.equal(record.artifact_paths.length, 2);
        assert.deepEqual(record.artifact_paths.map((file) => fs.readFileSync(file, 'utf8')), [
          gate + ':' + index + ':0:failed',
          gate + ':' + index + ':1:' + (gate === 'chromium' ? 'passed' : 'failed'),
        ]);
      }
      assert.equal(summary.artifacts.length, bodies.length);
      assert.equal(new Set(summary.artifacts.map((artifact) => artifact.path)).size, bodies.length);
      assert.deepEqual(summary.artifacts.map((artifact) => fs.readFileSync(artifact.path, 'utf8')), bodies);
      assert.equal(records.flatMap((record) => record.artifact_paths).length, bodies.length);
    }
  `;
    try {
      execFileSync(
        process.execPath,
        ['--experimental-strip-types', '--input-type=module', '-e', script],
        { cwd: path.resolve('.'), stdio: 'pipe' },
      );
    } finally {
      fs.rmSync(outputDirectory, { recursive: true, force: true });
    }
  });
}

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

  const output = `apps/dashboard-e2e/test-output/playwright/reporter-visual-attachments-${process.pid}/summary.json`;
  const outputDirectory = path.dirname(path.resolve(output));
  const script = `
    import assert from 'node:assert/strict';
    import { createHash } from 'node:crypto';
    import fs from 'node:fs';
    import path from 'node:path';
    import { QualityReporter, visualAttachmentRole } from './apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts';
    import { validateSummary } from './apps/dashboard-e2e/tools/lib/summary.mjs';
    const output = ${JSON.stringify(output)};
    const actualBody = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const diffBody = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 4, 5, 6]);
    assert.equal(visualAttachmentRole({ name: 'ticker-desktop-actual.png' }), 'actual');
    assert.equal(visualAttachmentRole({ name: 'unclassified.bin' }), undefined);
    const tests = Array.from({ length: 6 }, (_, index) => ({
      titlePath: () => ['', 'chromium', 'visual.spec.ts', ['ticker-desktop', 'landing', 'ticker-offline-mobile', 'positions-dense', 'scanner-dense', 'ai-recommendation'][index]],
      location: { file: path.resolve('apps/dashboard-e2e/src/quality/visual.spec.ts') },
      parent: { project: () => ({ name: 'chromium' }) },
    }));
    const reporter = new QualityReporter({ gate: 'visual', output });
    reporter.onBegin({ rootDir: process.cwd() }, { allTests: () => tests });
    reporter.onTestEnd(tests[0], {
      status: 'failed',
      retry: 0,
      attachments: [
        { name: 'ticker-desktop-expected.png', contentType: 'image/png', body: Buffer.from('expected') },
        { name: 'ticker-desktop-actual.png', contentType: 'image/png', body: actualBody },
        { name: 'ticker-desktop-diff.png', contentType: 'image/png', body: diffBody },
      ],
    });
    reporter.onTestEnd(tests[0], { status: 'passed', retry: 1, attachments: [] });
    for (let index = 1; index < tests.length; index += 1) {
      reporter.onTestEnd(tests[index], { status: 'passed', retry: 0, attachments: [] });
    }
    reporter.onEnd();
    const summary = validateSummary(JSON.parse(fs.readFileSync(output, 'utf8')));
    assert.equal(summary.status, 'fail');
    assert.equal(summary.executed, 6);
    assert.equal(summary.flaky, 1);
    const row = summary.scenarios.find((scenario) => scenario.scenario_id === 'ticker-desktop');
    assert.ok(row?.actual_path);
    assert.equal(row.actual_sha256, createHash('sha256').update(actualBody).digest('hex'));
    const artifact = path.resolve(row.actual_path);
    assert.deepEqual(fs.readFileSync(artifact), actualBody);
    assert.ok(summary.artifacts.some((item) => item.path === row.actual_path && item.sha256 === row.actual_sha256));
    assert.equal(row.diff_sha256, createHash('sha256').update(diffBody).digest('hex'));
    assert.deepEqual(fs.readFileSync(row.diff_path), diffBody);
    assert.equal(row.artifact_paths.length, 3);
  `;
  try {
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
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
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

test('accessibility reporter persists Buffer-body axe attachments and their findings', () => {
  const output = `apps/dashboard-e2e/test-output/playwright/reporter-body-${process.pid}/summary.json`;
  const outputDirectory = path.dirname(path.resolve(output));
  const findings = [
    {
      id: 'color-contrast',
      impact: 'serious',
      target_selector: '.sample-label',
    },
  ];
  const body = Buffer.from(JSON.stringify(findings));
  const source = `
    import fs from 'node:fs';
    import path from 'node:path';
    import { QualityReporter } from './apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts';
    const output = ${JSON.stringify(output)};
    const tests = Array.from({ length: 35 }, (_, index) => ({
      titlePath: () => ['', 'chromium', 'accessibility.spec.ts', 'scan-' + index],
      location: { file: path.resolve('apps/dashboard-e2e/src/quality/accessibility.spec.ts') },
      parent: { project: () => ({ name: 'chromium' }) },
    }));
    const findings = ${JSON.stringify(findings)};
    const reporter = new QualityReporter({ gate: 'accessibility', output });
    reporter.onBegin({ rootDir: process.cwd() }, { allTests: () => tests });
    reporter.onTestEnd(tests[0], {
      status: 'passed',
      retry: 0,
      attachments: [{ name: 'axe-findings.json', contentType: 'application/json', body: Buffer.from(JSON.stringify(findings)) }],
    });
    for (let index = 1; index < tests.length; index += 1) {
      reporter.onTestEnd(tests[index], { status: 'passed', retry: 0, attachments: [] });
    }
    reporter.onEnd();
    const summary = JSON.parse(fs.readFileSync(output, 'utf8'));
    if (summary.status !== 'pass' || summary.findings.length !== 1) process.exit(1);
    const finding = summary.findings[0];
    if (finding.id !== 'color-contrast' || !finding.artifact_path) process.exit(2);
    const artifact = path.resolve(finding.artifact_path);
    if (JSON.stringify(JSON.parse(fs.readFileSync(artifact, 'utf8'))) !== JSON.stringify(findings)) process.exit(3);
    if (summary.artifacts.length !== 1 || summary.artifacts[0].path !== finding.artifact_path) process.exit(4);
  `;
  try {
    assert.doesNotThrow(() =>
      execFileSync(
        process.execPath,
        ['--experimental-strip-types', '--input-type=module', '-e', source],
        {
          cwd: path.resolve('.'),
          stdio: 'pipe',
        },
      ),
    );
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
  assert.equal(body.toString('utf8'), JSON.stringify(findings));
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
  const output = `apps/dashboard-e2e/test-output/playwright/reporter-visual-${process.pid}/summary.json`;
  const outputDirectory = path.dirname(path.resolve(output));
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
  try {
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
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});
