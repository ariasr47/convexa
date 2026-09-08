import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const sha256 = (file: string) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const qualityManifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'apps/dashboard-e2e/src/quality/manifest.json'), 'utf8'),
) as {
  full_chromium: {
    inventory_id: string;
    tests: Array<{ test_id: string; file: string; title_path: string[]; project: string }>;
  };
  accessibility: { behaviors: Array<{ id: string }> };
};
export function mapChromiumIdentity(file: string, titlePath: string[], project: string) {
  const matches = qualityManifest.full_chromium.tests.filter(
    (record) =>
      record.file === file &&
      record.project === project &&
      JSON.stringify(record.title_path) === JSON.stringify(titlePath),
  );
  if (matches.length !== 1)
    throw new Error(
      `Chromium manifest identity did not uniquely match ${file} ${titlePath.join(' › ')}`,
    );
  return matches[0].test_id;
}
export function mapAccessibilityBehaviorId(titlePath: string[]) {
  const title = titlePath.find((value) => /^A11Y-B[1-7](?:\b|\s)/.test(value));
  const id = title?.match(/^(A11Y-B[1-7])(?:\b|\s)/)?.[1];
  if (!id || !qualityManifest.accessibility.behaviors.some((record) => record.id === id))
    throw new Error(
      `Accessibility behavior manifest identity did not match ${titlePath.join(' › ')}`,
    );
  return id;
}
const relative = (file: string) => path.relative(ROOT, file).replaceAll(path.sep, '/');
const runtime = () => {
  const browserFile = path.join(ROOT, 'node_modules/playwright-core/browsers.json');
  const browserData = JSON.parse(fs.readFileSync(browserFile, 'utf8')) as {
    browsers?: Array<{ name?: string; revision?: string }>;
  };
  const browser = Object.fromEntries(
    (browserData.browsers ?? []).map((entry) => [entry.name, entry]),
  );
  return {
    playwright_version: (
      JSON.parse(
        fs.readFileSync(path.join(ROOT, 'node_modules/@playwright/test/package.json'), 'utf8'),
      ) as {
        version: string;
      }
    ).version,
    browser_revision: browser.chromium?.revision ?? 'unknown',
    host_platform: process.platform,
  };
};
const gateCounts: Record<string, number> = {
  // (curvature-v2-foundations FE-10) 52 → 75: matches `manifest.json`'s `full_chromium.inventory_id`
  // bump to `curvature-v2-foundations-75-v1` (`tools/lib/manifest.mjs` enforces the same number).
  // (curvature-v2-desk-and-read FE-12) 75 → 86: FE-12 registered `desk-and-read.spec.ts` (6 new
  // Chromium tests: criterion 45's two, the criteria 20/22 evidence pair, criterion 52's two) and
  // added 5 new criterion-50 read-strip-rail tests to `no-overflow.spec.ts` (393 dark/light, 834,
  // 900, 1280) — the first net-new e2e tests this phase's own lanes have added to the registered six
  // (FE-1 through FE-11 only edited/re-pointed existing ones); bump to
  // `curvature-v2-desk-and-read-86-v1` (`tools/lib/manifest.mjs` enforces the same number).
  // (curvature-v2-surfaces FE-12) 86 → 90: U-32's frame-scoped extension to `curvature-v2.spec.ts`
  // (all eight `widget-{id}` frame roots, hero and live tape included) added 4 tests, one per
  // checked width; bump to `curvature-v2-surfaces-90-v1` (`tools/lib/manifest.mjs` enforces the
  // same number).
  // (curvature-v2-surfaces FE-13) 90 → 99: the 1280px light-scheme walk over the four seeded
  // surfaces (criterion 64, 6 tests), the criterion 7a rendered-container-step review-evidence
  // test (1), and the criterion 66 alerts write-affordance describe block (2); bump to
  // `curvature-v2-surfaces-99-v1` (`tools/lib/manifest.mjs` enforces the same number).
  // (curvature-v2-surfaces GATE Z repair, finding 2) 99 → 100: the off-exchange proximity chip's
  // 44px floor, newly reachable via a local fixture override (1 new test); bump to
  // `curvature-v2-surfaces-100-v1` (`tools/lib/manifest.mjs` enforces the same number).
  // (curvature-v2-surfaces GATE Z repair pass 2, finding 3) 100 → 103: the coarse-pointer floor
  // widened to `input`/`[role="combobox"]` (`theme.ts`), hard-asserted on 3 new
  // `no-overflow.spec.ts` tests (Settings risk-inputs account-size/cap-value, Settings
  // ticker/persona, the alerts composer Symbol/Kind controls); bump to
  // `curvature-v2-surfaces-103-v1` (`tools/lib/manifest.mjs` enforces the same number).
  // (curvature-v2-surfaces GATE Z repair pass 3, criterion 66 second clause) 103 → 105:
  // `TrackRecordSection.tsx`'s `<summary>` on `/positions` (touched this phase, `bdc992d8`) FIXED
  // to meet the coarse-pointer floor, 2 new `no-overflow.spec.ts` tests (393 coarse + 1280 fine,
  // desktop-unmoved); bump to `curvature-v2-surfaces-105-v1` (`tools/lib/manifest.mjs` enforces the
  // same number).
  // (curvature-v2-surfaces GATE Z repair pass 4, QA pass 3 Medium finding) 105 → 108: the pass-3
  // fix's `display: flex` removed the `<summary>`'s native disclosure `::marker`; pass 4 reaches
  // 44px with `line-height` instead, leaving `display: list-item` intact. 3 new
  // `no-overflow.spec.ts` tests (393 coarse, 393 fine, 1280 fine); bump to
  // `curvature-v2-surfaces-108-v1` (`tools/lib/manifest.mjs` enforces the same number).
  chromium: 108,
  compatibility: 15,
  accessibility: 16,
  visual: 6,
};
export type VisualAttachmentRole = 'expected' | 'actual' | 'diff' | undefined;
export function visualAttachmentRole(attachment: {
  name?: string;
  path?: string;
}): VisualAttachmentRole {
  if (!attachment.path) return undefined;
  const value = `${attachment.name ?? ''} ${path.basename(attachment.path)}`.toLowerCase();
  if (/(^|[-_. ])expected([-. _]|$)/.test(value)) return 'expected';
  if (/(^|[-_. ])actual([-. _]|$)/.test(value)) return 'actual';
  if (/(^|[-_. ])diff([-. _]|$)/.test(value)) return 'diff';
  return undefined;
}
const atomicWrite = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'w' });
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== 'EEXIST' &&
      (error as NodeJS.ErrnoException).code !== 'EPERM'
    )
      throw error;
    fs.rmSync(file, { force: true });
    fs.renameSync(temporary, file);
  }
};

export class QualityReporter implements Reporter {
  private gate: 'chromium' | 'compatibility' | 'accessibility' | 'visual' = 'chromium';
  private output = 'apps/dashboard-e2e/test-output/playwright/chromium/summary.json';
  private selected = 0;
  private records: Array<Record<string, unknown>> = [];
  private artifacts: Array<{ path: string; sha256: string }> = [];
  private findings: Array<Record<string, unknown>> = [];
  private results = new Map<string, TestResult>();
  private configRoot = ROOT;

  constructor(options: unknown = {}) {
    if (typeof options === 'string') this.output = options;
    else if (options && typeof options === 'object') {
      const value = options as { gate?: string; output?: string };
      if (value.gate && value.gate in gateCounts) this.gate = value.gate as typeof this.gate;
      if (value.output) this.output = value.output;
    }
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.configRoot = config.rootDir || ROOT;
    this.selected = suite.allTests().length;
    const expected = gateCounts[this.gate];
    if (this.selected !== expected)
      console.error(`[FAIL] ${this.gate} — expected ${expected}, selected ${this.selected}`);
    const identity = runtime();
    console.log(
      `[RUNNING] ${this.gate} — Playwright ${identity.playwright_version} — ${identity.browser_revision} — ${this.selected} selected`,
    );
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const key = `${test.location.file}:${test.titlePath().join(' › ')}:${result.retry}`;
    this.results.set(key, result);
    const attachmentPaths: string[] = [];
    let actualArtifact: { path: string; sha256: string } | undefined;
    let diffArtifact: { path: string; sha256: string } | undefined;
    for (const [index, attachment] of result.attachments.entries()) {
      if (!attachment.path || !fs.existsSync(attachment.path)) continue;
      const destination = path.resolve(
        this.output.startsWith('apps/') ? ROOT : this.configRoot,
        path.dirname(this.output.replace(/\\/g, '/')),
        'attachments',
        `${this.records.length}-${index}-${path.basename(attachment.path)}`,
      );
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(attachment.path, destination);
      const artifact = { path: relative(destination), sha256: sha256(destination) };
      this.artifacts.push(artifact);
      attachmentPaths.push(artifact.path);
      const role = visualAttachmentRole(attachment);
      if (role === 'actual') actualArtifact = artifact;
      if (role === 'diff') diffArtifact = artifact;
      if (this.gate === 'accessibility' && attachment.name === 'axe-findings.json') {
        const findings = JSON.parse(fs.readFileSync(attachment.path, 'utf8'));
        if (!Array.isArray(findings)) throw new Error('axe findings attachment must be an array');
        for (const finding of findings) {
          if (!finding || typeof finding !== 'object') throw new Error('invalid axe finding');
          this.findings.push({
            ...(finding as Record<string, unknown>),
            artifact_path: artifact.path,
          });
        }
      }
    }
    const status =
      result.status === 'skipped' || result.status === 'interrupted'
        ? 'not_run'
        : result.status === 'passed' && result.retry > 0
          ? 'flaky'
          : result.status === 'passed'
            ? 'passed'
            : 'failed';
    const title = test.titlePath();
    const identifier =
      title.at(-1) ?? path.basename(test.location.file, path.extname(test.location.file));
    const file = relative(test.location.file);
    const project = test.parent?.project()?.name ?? 'chromium';
    const record: Record<string, unknown> =
      this.gate === 'chromium'
        ? {
            test_id: mapChromiumIdentity(file, title.slice(3), project),
            file,
            title_path: title.slice(3),
            project,
            status,
            retries: result.retry,
            artifact_paths: attachmentPaths,
          }
        : {
            identity: title,
            file,
            project,
            status,
            retry: result.retry,
            artifact_paths: attachmentPaths,
          };
    if (this.gate === 'visual') {
      const expected = `apps/dashboard-e2e/src/quality/snapshots/${process.platform}/chromium/${identifier}.png`;
      const expectedFile = path.join(ROOT, expected);
      Object.assign(record, {
        scenario_id: identifier,
        expected_path: fs.existsSync(expectedFile) ? expected : null,
        expected_sha256: fs.existsSync(expectedFile) ? sha256(expectedFile) : null,
        actual_path: actualArtifact?.path ?? null,
        actual_sha256: actualArtifact?.sha256 ?? null,
        diff_path: diffArtifact?.path ?? null,
        diff_sha256: diffArtifact?.sha256 ?? null,
      });
    } else if (this.gate === 'compatibility')
      Object.assign(record, { journey_id: identifier, engine: record.project });
    else if (this.gate === 'accessibility')
      Object.assign(
        record,
        title.some((x) => x.startsWith('A11Y-B'))
          ? { behavior_id: mapAccessibilityBehaviorId(title) }
          : { scan_id: identifier },
      );
    this.records.push(record);
  }

  onEnd() {
    const passed = this.records.filter((x) => x.status === 'passed').length;
    const failed = this.records.filter((x) => x.status === 'failed').length;
    const flaky = this.records.filter((x) => x.status === 'flaky').length;
    const notRun =
      this.records.filter((x) => x.status === 'not_run').length +
      Math.max(0, this.selected - this.records.length);
    const incomplete =
      this.records.length !== this.selected || this.selected !== gateCounts[this.gate];
    const status = incomplete ? 'incomplete' : failed || flaky || notRun ? 'fail' : 'pass';
    const identity = runtime();
    const summary: Record<string, unknown> = {
      schema_version: 1,
      gate: this.gate,
      run_id: process.env.BROWSER_QUALITY_RUN_ID ?? 'local',
      source_revision: process.env.BROWSER_QUALITY_SOURCE_REVISION ?? '0'.repeat(40),
      selected: this.selected,
      executed: passed + failed + flaky,
      passed,
      failed,
      flaky,
      not_run: notRun,
      status,
      ...identity,
      artifacts: this.artifacts,
    };
    if (this.gate === 'chromium')
      Object.assign(summary, {
        // Read from the manifest itself rather than a second hardcoded literal (curvature-v2-
        // foundations FE-10 bumped this to `curvature-v2-foundations-75-v1` — a duplicated string
        // here would have been a second place to forget on the next bump).
        inventory_id: qualityManifest.full_chromium.inventory_id,
        project: 'chromium',
        tests: this.records,
      });
    else if (this.gate === 'compatibility') summary.arms = this.records;
    else if (this.gate === 'accessibility')
      Object.assign(summary, {
        disclaimer:
          'Automated WCAG-oriented scanning is not a complete manual accessibility audit or assistive-technology certification.',
        scans: this.records.filter(
          (x) => String(x.identity).includes('A11Y-') && !String(x.identity).includes('A11Y-B'),
        ),
        behaviors: this.records.filter((x) => String(x.identity).includes('A11Y-B')),
        findings: this.findings,
      });
    else summary.scenarios = this.records;
    const output = path.resolve(
      this.output.startsWith('apps/') ? ROOT : this.configRoot,
      this.output,
    );
    atomicWrite(output, summary);
    if (status === 'pass') {
      console.log(`[PASS] ${this.gate} — ${passed}/${this.selected} passed — 0 flaky`);
      return;
    }
    if (flaky > 0) {
      console.log(
        `[FAIL] ${this.gate} — ${flaky} test(s) passed only after retry; no stability-clean pass recorded. Open: ${this.output}`,
      );
      return;
    }
    if (this.gate === 'visual') {
      const failedScenarios = this.records.filter((record) => record.status === 'failed');
      if (failedScenarios.length > 0) {
        for (const record of failedScenarios) {
          console.log(
            `[FAIL] visual — ${String(record.scenario_id)}: the approved baseline differs. Review expected, actual, and diff images. Open: ${this.output}`,
          );
        }
        return;
      }
    }
    console.log(`[FAIL] ${this.gate} — ${failed} failed. Open: ${this.output}`);
  }
}
export default QualityReporter;
