import fs from 'node:fs';
import { atomicWriteJson, repositoryPath, sha256File } from './fs-safe.mjs';

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
const GATES = new Set(['chromium', 'compatibility', 'accessibility', 'visual']);
const STATUS = new Set(['pass', 'fail', 'incomplete']);
const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const expected = {
  chromium: ['inventory_id', 'project', 'tests'],
  compatibility: ['arms'],
  accessibility: ['scans', 'behaviors', 'findings'],
  visual: ['scenarios'],
};
const err = (s) => {
  throw new Error(`invalid ${s}`);
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
  if (!Array.isArray(summary.artifacts)) err('artifacts');
  for (const artifact of summary.artifacts) {
    if (!artifact || typeof artifact.path !== 'string' || !HEX64.test(artifact.sha256))
      err('artifact record');
    const absolute = repositoryPath(options.root ?? process.cwd(), artifact.path);
    if (!fs.existsSync(absolute) || sha256File(absolute) !== artifact.sha256) err('artifact hash');
  }
  for (const key of extras)
    if (key !== 'inventory_id' && key !== 'project' && !Array.isArray(summary[key]))
      err(`${key} inventory`);
  if (
    summary.gate === 'chromium' &&
    (summary.inventory_id !== 'pre-feature-52-v1' ||
      summary.project !== 'chromium' ||
      summary.tests.length !== 52)
  )
    err('Chromium inventory');
  if (summary.gate === 'compatibility' && summary.arms.length !== 15)
    err('compatibility inventory');
  if (
    summary.gate === 'accessibility' &&
    (summary.scans.length !== 9 || summary.behaviors.length !== 7)
  )
    err('accessibility inventory');
  if (summary.gate === 'visual' && summary.scenarios.length !== 6) err('visual inventory');
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
