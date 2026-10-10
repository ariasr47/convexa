import fs from 'node:fs';
import { atomicWriteJson, repositoryPath, sha256File } from './fs-safe.mjs';
import { loadManifest } from './manifest.mjs';

const COMMON = [
  'schema_version',
  'gate',
  'run_id',
  'source_revision',
  'selected',
  'executed',
  'passed',
  'failed',
  'flaky',
  'not_run',
  'status',
  'playwright_version',
  'browser_revision',
  'host_platform',
  'artifacts',
];
const GATES = new Set(['chromium', 'compatibility', 'accessibility']);
const STATUS = new Set(['pass', 'fail', 'incomplete']);
const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const expected = {
  chromium: ['inventory_id', 'project', 'tests'],
  compatibility: ['arms'],
  accessibility: ['disclaimer', 'scans', 'behaviors', 'findings'],
};
const err = (s) => {
  throw new Error(`invalid ${s}`);
};
const RECORD_STATUS = new Set(['passed', 'failed', 'flaky', 'not_run']);
const exactKeys = (record, keys, label) => {
  if (
    !record ||
    typeof record !== 'object' ||
    Object.keys(record).sort().join('|') !== [...keys].sort().join('|')
  )
    err(`${label} record schema`);
};
const nonEmptyString = (value, label) => {
  if (typeof value !== 'string' || !value) err(label);
};
const validateCommonRecord = (record, label, keys) => {
  exactKeys(record, keys, label);
  if (
    !Array.isArray(record.artifact_paths) ||
    record.artifact_paths.some((x) => typeof x !== 'string')
  )
    err(`${label} artifacts`);
  if (!RECORD_STATUS.has(record.status) || !Number.isInteger(record.retry) || record.retry < 0)
    err(`${label} status`);
  nonEmptyString(record.file, `${label} file`);
  if (record.file.includes('\\') || !record.file.startsWith('apps/dashboard-e2e/'))
    err(`${label} path`);
  if (!Array.isArray(record.identity) || record.identity.some((x) => typeof x !== 'string'))
    err(`${label} identity`);
};
const uniqueSet = (values, label) => {
  if (new Set(values).size !== values.length) err(`${label} duplicate`);
};
export function validateSummary(summary, options = {}) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) err('summary');
  if (
    !GATES.has(summary.gate) ||
    summary.schema_version !== 1 ||
    !HEX40.test(summary.source_revision) ||
    typeof summary.run_id !== 'string' ||
    !STATUS.has(summary.status)
  )
    err('common fields');
  for (const key of COMMON) if (!(key in summary)) err(`missing ${key}`);
  const extras = expected[summary.gate];
  const allowed = new Set([...COMMON, ...extras]);
  if (Object.keys(summary).some((key) => !allowed.has(key))) err('unknown key');
  for (const key of ['selected', 'executed', 'passed', 'failed', 'flaky', 'not_run'])
    if (!Number.isInteger(summary[key]) || summary[key] < 0) err('counts');
  if (
    summary.selected !== summary.passed + summary.failed + summary.flaky + summary.not_run ||
    summary.executed !== summary.passed + summary.failed + summary.flaky ||
    summary.selected === 0
  )
    err('count arithmetic');
  if (summary.status === 'pass' && (summary.failed || summary.flaky || summary.not_run))
    err('pass status');
  const manifest = options.manifest ?? loadManifest();
  if (!Array.isArray(summary.artifacts)) err('artifacts');
  for (const artifact of summary.artifacts) {
    if (!artifact || typeof artifact.path !== 'string' || !HEX64.test(artifact.sha256))
      err('artifact record');
    const absolute = repositoryPath(options.root ?? process.cwd(), artifact.path);
    if (!fs.existsSync(absolute) || sha256File(absolute) !== artifact.sha256) err('artifact hash');
  }
  for (const key of extras)
    if (
      key !== 'inventory_id' &&
      key !== 'project' &&
      key !== 'disclaimer' &&
      !Array.isArray(summary[key])
    )
      err(`${key} inventory`);
  if (
    summary.gate === 'accessibility' &&
    summary.disclaimer !==
      'Automated WCAG-oriented scanning is not a complete manual accessibility audit or assistive-technology certification.'
  )
    err('accessibility disclaimer');
  if (summary.gate === 'chromium') {
    // Read the expected inventory_id/count from the manifest itself, not a second hardcoded literal
    // (curvature-v2-foundations FE-10 bumped `pre-feature-52-v1`/52 → `curvature-v2-foundations-75-
    // v1`/75 — see `manifest.mjs`'s own comment at its matching check for the itemized delta).
    const manifestInventoryId = manifest.full_chromium.inventory_id;
    const manifestCount = manifest.full_chromium.tests.length;
    if (
      summary.inventory_id !== manifestInventoryId ||
      summary.project !== 'chromium' ||
      summary.selected !== manifestCount ||
      summary.tests.length !== manifestCount
    )
      err('Chromium inventory');
  }
  if (summary.gate === 'chromium') {
    const manifestIds = manifest.full_chromium.tests.map((x) => x.test_id);
    const identities = summary.tests.map((record) => record.test_id);
    uniqueSet(identities, 'Chromium tests');
    if (
      manifestIds.length !== manifest.full_chromium.tests.length ||
      new Set(identities).size !== manifestIds.length ||
      !manifestIds.every((x) => identities.includes(x))
    )
      err('Chromium test identity');
    for (const record of summary.tests) {
      exactKeys(
        record,
        ['artifact_paths', 'file', 'project', 'retries', 'status', 'test_id', 'title_path'],
        'Chromium',
      );
      if (
        !HEX64.test(record.test_id) ||
        record.project !== 'chromium' ||
        !Array.isArray(record.title_path) ||
        record.title_path.some((x) => typeof x !== 'string' || !x) ||
        !RECORD_STATUS.has(record.status) ||
        !Number.isInteger(record.retries) ||
        record.retries < 0 ||
        !Array.isArray(record.artifact_paths)
      )
        err('Chromium record');
    }
  }
  if (summary.gate === 'compatibility' && (summary.selected !== 18 || summary.arms.length !== 18))
    err('compatibility inventory');
  if (summary.gate === 'compatibility') {
    const expectedArms = manifest.compatibility.journeys.flatMap((journey) =>
      manifest.compatibility.projects.map((engine) => `${journey.id}:${engine}`),
    );
    const identities = summary.arms.map((record) => `${record.journey_id}:${record.engine}`);
    uniqueSet(identities, 'compatibility arms');
    if (
      expectedArms.length !== identities.length ||
      !expectedArms.every((x) => identities.includes(x))
    )
      err('compatibility identity');
    for (const record of summary.arms) {
      validateCommonRecord(record, 'compatibility', [
        'artifact_paths',
        'engine',
        'file',
        'identity',
        'journey_id',
        'project',
        'retry',
        'status',
      ]);
      if (
        !manifest.compatibility.projects.includes(record.engine) ||
        record.project !== record.engine ||
        !manifest.compatibility.journeys.some((x) => x.id === record.journey_id)
      )
        err('compatibility record');
    }
  }
  if (
    // (curvature-v2-landing-and-site F15) 16 → 19: scans 9 → 12 (one new axe scan per new public
    // surface, AC-G1), held against the unchanged 7 behaviors.
    // (curvature-v2-landing-and-site GATE Z I-2, amendment 5) 19 → 31: scans 12 → 24 (the NAMED
    // six-surface × {dark,light} × 393 matrix, the 404 also at 1280, the open sign-in dialog
    // counted as a surface too), held against the unchanged 7 behaviors.
    // (no-vendor-production-posture AC-10) 31 → 35: scans 24 → 28 (a seventh surface — the paused
    // ticker-desk panel — at both breakpoints and both color schemes), held against the unchanged
    // 7 behaviors.
    summary.gate === 'accessibility' &&
    (summary.selected !== 35 || summary.scans.length !== 28 || summary.behaviors.length !== 7)
  )
    err('accessibility inventory');
  if (summary.gate === 'accessibility') {
    const scanIds = summary.scans.map((record) => record.scan_id);
    const behaviorIds = summary.behaviors.map((record) => record.behavior_id);
    uniqueSet(scanIds, 'accessibility scans');
    uniqueSet(behaviorIds, 'accessibility behaviors');
    if (
      !manifest.accessibility.scans.every((x) => scanIds.includes(x.id)) ||
      !manifest.accessibility.behaviors.every((x) => behaviorIds.includes(x.id))
    )
      err('accessibility identity');
    for (const record of [...summary.scans, ...summary.behaviors]) {
      validateCommonRecord(record, 'accessibility', [
        'artifact_paths',
        'file',
        'identity',
        'project',
        'retry',
        'status',
        record.scan_id ? 'scan_id' : 'behavior_id',
      ]);
      if (record.project !== 'chromium') err('accessibility project');
    }
  }
  return summary;
}
export function validatePublication(summary, options) {
  return validateSummary(summary, options);
}
export function hashFile(file) {
  return sha256File(file);
}
export function writeSummary(file, value) {
  atomicWriteJson(file, value);
}
export function readSummary(file, options) {
  return validateSummary(JSON.parse(fs.readFileSync(file, 'utf8')), options);
}
